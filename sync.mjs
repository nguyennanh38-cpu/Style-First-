import crypto from 'node:crypto';
import {promisify} from 'node:util';
import pg from 'pg';

const {Pool}=pg;
const scrypt=promisify(crypto.scrypt);
const pool=process.env.DATABASE_URL?new Pool({
  connectionString:process.env.DATABASE_URL,
  max:5,
  connectionTimeoutMillis:10000,
  idleTimeoutMillis:30000
}):null;
export const syncEnabled=Boolean(pool);
let schemaReady;
const LIMIT=2_000_000;
const blankState=()=>({version:1,essays:[],selectedId:null,deletedIds:[]});
function err(status,message){const e=new Error(message);e.status=status;return e;}
function json(res,status,body,headers={}){
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
  res.end(JSON.stringify(body));
}
async function body(req){
  const chunks=[];let size=0;
  for await(const part of req){size+=part.length;if(size>LIMIT)throw err(413,'Sync data exceeds the 2 MB limit');chunks.push(part);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw err(400,'Invalid JSON');}
}
async function init(){
  if(!pool)throw err(503,'Cloud synchronization requires durable database configuration.');
  if(!schemaReady)schemaReady=(async()=>{
    await pool.query('CREATE TABLE IF NOT EXISTS style_users (id BIGSERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    await pool.query('CREATE TABLE IF NOT EXISTS style_sessions (token_hash TEXT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES style_users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL)');
    await pool.query("CREATE TABLE IF NOT EXISTS style_user_states (user_id BIGINT PRIMARY KEY REFERENCES style_users(id) ON DELETE CASCADE, data JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())");
    await pool.query('CREATE INDEX IF NOT EXISTS style_sessions_expiry_idx ON style_sessions(expires_at)');
  })().catch(e=>{schemaReady=null;throw e;});
  return schemaReady;
}
function normalizeEmail(x){
  const email=String(x||'').trim().toLowerCase();
  if(email.length>254||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).test(email))throw err(400,'Enter a valid email address.');
  return email;
}
function validPassword(p){if(typeof p!=='string'||p.length<12||p.length>256)throw err(400,'Password must contain 12 to 256 characters.');return p;}
async function hashPassword(p){const salt=crypto.randomBytes(18).toString('hex');const d=await scrypt(p,salt,64);return salt+':'+d.toString('hex');}
async function verifyPassword(p,stored){
  const [salt,hex]=String(stored).split(':');
  if(!salt||!hex||hex.length!==128)return false;
  const test=await scrypt(p,salt,64);
  return crypto.timingSafeEqual(test,Buffer.from(hex,'hex'));
}
function cookie(req){
  const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('style_session='));
  if(!raw)return null;
  const token=raw.slice('style_session='.length);
  return /^[0-9a-f]{64}$/.test(token)?token:null;
}
function tokenHash(x){return crypto.createHash('sha256').update(x).digest('hex');}
const authCookie=token=>'style_session='+token+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000';
const clearCookie='style_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
async function currentUser(req){
  const token=cookie(req);if(!token)return null;
  const x=await pool.query('SELECT u.id,u.email FROM style_sessions s JOIN style_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()', [tokenHash(token)]);
  return x.rows[0]||null;
}
function originAllowed(req){
  const origin=req.headers.origin;if(!origin)return true;
  try {const u=new URL(origin),host=req.headers.host;return u.host===host&&(u.protocol==='https:'||(u.protocol==='http:'&&/^(localhost|127\.0\.0\.1)(:|$)/.test(host)));}catch{return false;}
}
const cleanStr=(x,n)=>String(x||'').slice(0,n);
function validateState(x){
  if(!x||x.version!==1||!Array.isArray(x.essays)||x.essays.length>100)throw err(400,'Invalid or oversized workbook.');
  const essays=x.essays.map(e=>{
    if(!e||typeof e.id!=='string'||typeof e.title!=='string'||typeof e.essay!=='string'||e.id.length>120||e.essay.length>20000)throw err(400,'Invalid essay entry.');
    const progress=e.progress&&typeof e.progress==='object'&&!Array.isArray(e.progress)?e.progress:{};
    if(Object.keys(progress).length>30)throw err(400,'Too many stages.');
    return {id:cleanStr(e.id,120),title:cleanStr(e.title,350),question:cleanStr(e.question,4500),
      essay:e.essay,plan:e.plan||null,createdAt:e.createdAt||null,updatedAt:e.updatedAt||null,progress, demo:!!e.demo};
  });
  return {version:1,essays,selectedId:typeof x.selectedId==='string'?x.selectedId:null,
    deletedIds:Array.isArray(x.deletedIds)?x.deletedIds.filter(y=>typeof y==='string').slice(-500):[]};
}
const stable=(x)=>JSON.stringify(x,Object.keys(x||{}).sort());
function sessionValue(s){if(!s||typeof s!=='object')return 0;
  const drafts=Object.values(s.drafts||{}).reduce((n,v)=>n+String(v||'').length,0);
  return drafts+Object.keys(s.results||{}).length*100+(s.clozeResults?.length||0)*100+(s.saved?5:0);
}
function combineSessions(a,b,archive){
  if(!a)return b||{drafts:{},results:{},current:0};
  if(!b)return a;
  const ta=Date.parse(a.updatedAt||'')||0,tb=Date.parse(b.updatedAt||'')||0;
  let preferred,other;
  if(ta!==tb){preferred=ta>tb?a:b;other=ta>tb?b:a;}
  else{preferred=sessionValue(a)>=sessionValue(b)?a:b;other=preferred===a?b:a;}
  if(stable(preferred)!==stable(other)&&sessionValue(other)>0){
    const id=crypto.createHash('sha256').update(JSON.stringify(other)).digest('hex').slice(0,20);
    if(!archive.some(v=>v.id===id))archive.push({id,savedAt:new Date().toISOString(),data:other});
  }
  return preferred;
}
function mergeProgress(a={},b={}){
  const out={};
  for(const stage of new Set([...Object.keys(a||{}),...Object.keys(b||{})])){
    if(!/^[0-9.]{1,10}$/.test(stage))continue;
    const left=a[stage]||{},right=b[stage]||{};
    const histories=[...(Array.isArray(left.history)?left.history:[]),...(Array.isArray(right.history)?right.history:[])];
    const unique=new Map();
    for(const h of histories)if(h&&typeof h==='object'){
      const key=crypto.createHash('sha256').update(JSON.stringify(h)).digest('hex');
      if(!unique.has(key))unique.set(key,h);
    }
    const archives=[...(left.sessionBackups||[]),...(right.sessionBackups||[])].filter(x=>x&&x.id&&x.data);
    const archMap=new Map(archives.map(x=>[x.id,x]));
    const archive=[...archMap.values()];
    const session=combineSessions(left.session,right.session,archive);
    out[stage]={history:[...unique.values()].sort((x,y)=>(Date.parse(x.at||'')||0)-(Date.parse(y.at||'')||0)).slice(-1500),session,sessionBackups:archive.slice(-20)};
  }
  return out;
}
function mergeStates(a,b){
  const left=validateState(a),right=validateState(b);
  const deleted=new Set([...left.deletedIds,...right.deletedIds]);
  const merged=new Map();
  for(const e of [...left.essays,...right.essays]){
    if(deleted.has(e.id))continue;
    const previous=merged.get(e.id);
    if(!previous){merged.set(e.id,e);continue;}
    const timeA=Date.parse(previous.updatedAt||previous.createdAt||'')||0;
    const timeB=Date.parse(e.updatedAt||e.createdAt||'')||0;
    const latest=timeB>timeA?e:previous;
    merged.set(e.id,{...previous,...latest,plan:latest.plan||previous.plan||e.plan||null,
      progress:mergeProgress(previous.progress,e.progress)});
  }
  const essays=[...merged.values()].sort((x,y)=>(Date.parse(y.createdAt||'')||0)-(Date.parse(x.createdAt||'')||0));
  const selected=essays.find(x=>x.id===right.selectedId)?right.selectedId:
                 essays.find(x=>x.id===left.selectedId)?left.selectedId:essays[0]?.id||null;
  return {version:1,essays,selectedId:selected,deletedIds:[...deleted]};
}
async function loginSession(res,u){
  const token=crypto.randomBytes(32).toString('hex');
  await pool.query("INSERT INTO style_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 days')",[tokenHash(token),u.id]);
  json(res,200,{ok:true,email:u.email},{'Set-Cookie':authCookie(token)});
}
export async function syncRoute(req,res,pathname){
  if(!pathname.startsWith('/api/auth/')&&!pathname.startsWith('/api/sync/'))return false;
  if(!syncEnabled){json(res,503,{error:'Cloud sync has not been activated. Your local progress has not been changed.'});return true;}
  try{
    await init();
    if(req.method!=='GET'&&!originAllowed(req))throw err(403,'Origin not allowed.');
    if(req.method==='GET'&&pathname==='/api/auth/me'){
      const u=await currentUser(req);json(res,200,{signedIn:!!u,email:u?.email||null});return true;
    }
    if(req.method!=='POST')throw err(405,'Method not allowed');
    if(pathname==='/api/auth/register'||pathname==='/api/auth/login'){
      const data=await body(req),email=normalizeEmail(data.email),password=validPassword(data.password);
      if(pathname==='/api/auth/register'){
        const exists=await pool.query('SELECT id FROM style_users WHERE email=$1',[email]);
        if(exists.rowCount)throw err(409,'An account with this email already exists. Please sign in.');
        const hashed=await hashPassword(password);
        let added;
        try{added=await pool.query('INSERT INTO style_users(email,pass_hash) VALUES($1,$2) RETURNING id,email',[email,hashed]);}
        catch(e){if(e.code==='23505')throw err(409,'Account already exists.');throw e;}
        await pool.query('INSERT INTO style_user_states(user_id,data) VALUES($1,$2)',[added.rows[0].id,blankState()]);
        await loginSession(res,added.rows[0]);return true;
      }
      const found=await pool.query('SELECT id,email,pass_hash FROM style_users WHERE email=$1',[email]);
      if(!found.rowCount||!(await verifyPassword(password,found.rows[0].pass_hash)))throw err(401,'Incorrect email or password.');
      await loginSession(res,found.rows[0]);return true;
    }
    const user=await currentUser(req);
    if(!user)throw err(401,'Please sign in to synchronize.');
    if(pathname==='/api/auth/logout'){
      const token=cookie(req);
      if(token)await pool.query('DELETE FROM style_sessions WHERE token_hash=$1',[tokenHash(token)]);
      json(res,200,{ok:true},{'Set-Cookie':clearCookie});return true;
    }
    if(pathname==='/api/sync/merge'){
      const data=await body(req);
      const incoming=validateState(data.state);
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        await client.query("INSERT INTO style_user_states(user_id,data) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING",[user.id,blankState()]);
        const row=await client.query('SELECT data FROM style_user_states WHERE user_id=$1 FOR UPDATE',[user.id]);
        const combined=mergeStates(row.rows[0].data,incoming);
        await client.query('UPDATE style_user_states SET data=$2,updated_at=now() WHERE user_id=$1',[user.id,combined]);
        await client.query('COMMIT');
        json(res,200,{ok:true,state:combined,serverTime:new Date().toISOString()});return true;
      }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
    }
    throw err(404,'Not found');
  }catch(e){
    if((e.status||500)>=500)console.error('sync error:',e.message);
    json(res,e.status||500,{error:e.status?e.message:'Cloud service unavailable. Local progress remains untouched.'});
    return true;
  }
}
