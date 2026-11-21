/*
 * Style First - ChatGPT Sites edition.
 * Durable per-user progress on the Sites D1 binding DB, authenticated with
 * the platform's Sign in with ChatGPT identity header.
 * The Render version and its browser data are NOT modified by this worker.
 */
const LIMIT=1_800_000;
const empty=()=>({version:1,essays:[],selectedId:null,deletedIds:[]});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const fail=(status,message)=>json({error:message},status);
const str=(x,max)=>typeof x==="string"?x.slice(0,max):"";
function validate(raw){
 if(!raw||raw.version!==1||!Array.isArray(raw.essays)||raw.essays.length>150)
  throw new Error("Invalid or oversized workbook");
 if(raw.essays.some(e=>!e||typeof e.id!=="string"||typeof e.essay!=="string"||e.id.length>120||e.essay.length>25000))
  throw new Error("Invalid model essay");
 const essays=raw.essays.map(e=>({
  id:e.id,title:str(e.title,400),essay:e.essay,question:str(e.question,5000),
  plan:e.plan||null,createdAt:str(e.createdAt,80),updatedAt:str(e.updatedAt,80),
  progress:(e.progress&&typeof e.progress==="object"&&!Array.isArray(e.progress))?e.progress:{},demo:!!e.demo
 }));
 if(essays.some(e=>Object.keys(e.progress).length>30))throw new Error("Too many training stages");
 return {version:1,essays,selectedId:str(raw.selectedId,120)||null,deletedIds:Array.isArray(raw.deletedIds)?raw.deletedIds.filter(x=>typeof x==="string").slice(-2000):[]};
}
function unique(arr){
 const seen=new Set();const out=[];
 for(const x of arr){const key=JSON.stringify(x);if(!seen.has(key)){out.push(x);seen.add(key);}}
 return out;
}
function scoreSession(s){
 if(!s||typeof s!=="object")return 0;
 return Object.values(s.drafts||{}).reduce((n,x)=>n+str(x,100000).length,0)
  +Object.keys(s.results||{}).length*100
  +(s.clozeResults?.length||0)*100+(s.saved?10:0);
}
function mergeSession(a,b,backups){
 if(!a)return b||{drafts:{},results:{},current:0};
 if(!b)return a;
 const ta=Date.parse(a.updatedAt||"")||0,tb=Date.parse(b.updatedAt||"")||0;
 const primary=ta!==tb?(ta>tb?a:b):(scoreSession(a)>=scoreSession(b)?a:b);
 const secondary=primary===a?b:a;
 if(JSON.stringify(primary)!==JSON.stringify(secondary)&&scoreSession(secondary)>0){
  const key=JSON.stringify(secondary);
  if(!backups.some(x=>JSON.stringify(x.data)===key))
   backups.push({id:"other-"+backups.length+"-"+(secondary.updatedAt||""),savedAt:new Date().toISOString(),data:secondary});
 }
 return primary;
}
function mergeArgumentWorkbook(a,b){
 const left=a&&typeof a==='object'?a:{},right=b&&typeof b==='object'?b:{};
 const first=(Date.parse(left.updatedAt||'')||0)<=(Date.parse(right.updatedAt||'')||0)?left:right;
 const second=first===left?right:left;
 const drafts={...((first.drafts&&typeof first.drafts==='object')?first.drafts:{})};
 for(const [k,v]of Object.entries(second.drafts||{}))if(typeof v==='string')drafts[k]=v;
 return {drafts,updatedAt:(Date.parse(left.updatedAt||'')||0)>(Date.parse(right.updatedAt||'')||0)?left.updatedAt||null:right.updatedAt||null};
}
function mergeProgress(a={},b={}){
 const result={};
 for(const k of new Set([...Object.keys(a||{}),...Object.keys(b||{})])){
  if(!/^[0-9.]{1,10}$/.test(k))continue;
  const x=a[k]||{},y=b[k]||{};
  const history=unique([...(Array.isArray(x.history)?x.history:[]),...(Array.isArray(y.history)?y.history:[])])
    .sort((v,w)=>(Date.parse(v?.at||"")||0)-(Date.parse(w?.at||"")||0));
  const backups=unique([...(x.sessionBackups||[]),...(y.sessionBackups||[])])
    .filter(z=>z&&typeof z==="object"&&z.data);
  const session=mergeSession(x.session,y.session,backups);
  result[k]={history:history.slice(-2000),session,sessionBackups:unique(backups).slice(-30),...(k==='1'&&(x.argumentWorkbook||y.argumentWorkbook)?{argumentWorkbook:mergeArgumentWorkbook(x.argumentWorkbook,y.argumentWorkbook)}:{})};
 }
 return result;
}
export function mergeStates(a,b){
 const left=validate(a),right=validate(b);
 const deleted=new Set([...left.deletedIds,...right.deletedIds]);
 const records=new Map();
 for(const e of [...left.essays,...right.essays]){
  if(deleted.has(e.id))continue;
  const existing=records.get(e.id);
  if(!existing){records.set(e.id,e);continue;}
  const t1=Date.parse(existing.updatedAt||existing.createdAt||"")||0;
  const t2=Date.parse(e.updatedAt||e.createdAt||"")||0;
  const latest=t2>t1?e:existing;
  records.set(e.id,{...existing,...latest,plan:latest.plan||existing.plan||e.plan||null,
    progress:mergeProgress(existing.progress,e.progress)});
 }
 const essays=[...records.values()].sort((x,y)=>(Date.parse(y.createdAt||"")||0)-(Date.parse(x.createdAt||"")||0));
 const selectedId=essays.some(x=>x.id===right.selectedId)?right.selectedId:
   essays.some(x=>x.id===left.selectedId)?left.selectedId:essays[0]?.id||null;
 return {version:1,essays,selectedId,deletedIds:[...deleted]};
}
function sameOrigin(request){
 const origin=request.headers.get("origin");
 if(!origin)return true;
 try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}
}
async function getBody(request){
 if(Number(request.headers.get("content-length")||0)>LIMIT)throw new Error("Workbook exceeds limit");
 const data=await request.text();
 if(data.length>LIMIT)throw new Error("Workbook exceeds limit");
 try{return JSON.parse(data);}catch{throw new Error("Invalid JSON");}
}
async function setup(db){
 await db.prepare("CREATE TABLE IF NOT EXISTS style_workbooks (email TEXT PRIMARY KEY, state TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
}
async function mergeIntoD1(db,email,incoming){
 // Compare-and-swap prevents concurrent devices from overwriting another's update.
 await db.prepare("INSERT OR IGNORE INTO style_workbooks (email,state,revision) VALUES(?,?,0)")
   .bind(email,JSON.stringify(empty())).run();
 for(let attempt=0;attempt<8;attempt++){
  const row=await db.prepare("SELECT state,revision FROM style_workbooks WHERE email=?").bind(email).first();
  if(!row)throw new Error("Cloud record unavailable");
  const current=JSON.parse(row.state);
  const merged=mergeStates(current,incoming),serialized=JSON.stringify(merged);
  if(serialized.length>LIMIT)throw new Error("Workbook is too large to synchronize");
  const out=await db.prepare("UPDATE style_workbooks SET state=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE email=? AND revision=?")
   .bind(serialized,email,row.revision).run();
  if(out.meta?.changes===1)return merged;
 }
 throw new Error("A simultaneous edit prevented this sync. Please retry.");
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(path==="/api/health")return json({ai:false,model:null,accessCodeRequired:false,sync:!!env.DB,platform:"ChatGPT Sites"});
  if(path==="/api/sync/me"||path==="/api/sync/merge"){
   if(!env.DB)return fail(503,"Sites D1 storage has not been connected");
   const email=request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
   if(!email)return fail(401,"Please sign in with ChatGPT to synchronize.");
   try{
    await setup(env.DB);
    if(path==="/api/sync/me"&&request.method==="GET")return json({signedIn:true,email});
    if(path==="/api/sync/merge"&&request.method==="POST"){
     if(!sameOrigin(request))return fail(403,"Cross-site requests are not permitted.");
     const input=await getBody(request);
     const merged=await mergeIntoD1(env.DB,email,validate(input.state));
     return json({ok:true,state:merged,serverTime:new Date().toISOString()});
    }
    return fail(405,"Method not allowed");
   }catch(e){
    console.error("Style First sync:",e.message);
    return fail(e.message.includes("Invalid")||e.message.includes("exceeds")||e.message.includes("too large")?400:503,
      "Sync could not be completed: "+e.message+". Local browser progress remains unchanged.");
   }
  }
  if(path==="/api/generate"||path==="/api/grade")return fail(503,"AI enhancement is not configured for this Sites edition.");
  if(path.startsWith("/api/"))return fail(404,"Not found");
  if(env.ASSETS)return env.ASSETS.fetch(request);
  return fail(503,"Site assets have not been configured.");
 }
};
