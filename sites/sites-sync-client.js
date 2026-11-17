/* Style First — ChatGPT Sites sync client. Data stays local until the user explicitly imports. */
(()=>{
"use strict";
const DATA_KEY="style-first-workbook-v1",OWNER_KEY="style-first-sites-owner";
let active=false,authenticated=false,userEmail="",inFlight=false,changed=false,timer=null,revision=0,ready=false;
const el=id=>document.getElementById(id);
const escapeText=s=>String(s||"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const empty=()=>({version:1,essays:[],selectedId:null,deletedIds:[]});
function localData(){try{const d=JSON.parse(localStorage.getItem(DATA_KEY));return d?.version===1&&Array.isArray(d.essays)?{version:1,essays:d.essays,selectedId:d.selectedId||null,deletedIds:d.deletedIds||[]}:empty()}catch{return empty()}}
function backup(tag){
 const original=localStorage.getItem(DATA_KEY);
 if(!original)return;
 try{localStorage.setItem("style-first-sites-backup-"+tag+"-"+Date.now(),original)}
 catch{throw Error("Cannot create a local safety copy. Export a backup from Settings first.")}
}
async function fetchJson(url,data){
 const options={cache:"no-store",credentials:"same-origin"};
 if(data!==undefined){options.method="POST";options.headers={"Content-Type":"application/json"};options.body=JSON.stringify(data)}
 const r=await fetch(url,options);
 const reply=await r.json().catch(()=>({error:"Server did not return valid JSON"}));
 if(!r.ok)throw Error(reply.error||"Cloud sync is unavailable");
 return reply;
}
function accountBadge(msg){
 const btn=el("sitesCloudButton");
 if(btn)btn.textContent=msg||"☁ Sync";
}
function modal(){
 let dialog=el("sitesCloudModal");
 if(dialog)return dialog;
 dialog=document.createElement("div");dialog.id="sitesCloudModal";dialog.className="modal-backdrop";dialog.hidden=true;
 dialog.innerHTML='<section class="modal-card settings-modal" role="dialog" aria-modal="true" aria-labelledby="sitesCloudTitle"><div class="modal-header"><div><div class="eyebrow">CHATGPT SITES</div><h2 id="sitesCloudTitle">Sync your learning progress</h2></div><button class="icon-btn" type="button" id="sitesCloudClose" aria-label="Close">×</button></div><div id="sitesCloudContent"></div></section>';
 document.body.append(dialog);el("sitesCloudClose").onclick=()=>dialog.hidden=true;
 dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.hidden=true});
 return dialog;
}
function message(text){const n=el("sitesCloudMessage");if(n){n.textContent=text;n.hidden=false}}
function show(){
 modal();
 const root=el("sitesCloudContent");
 if(!active){
  root.innerHTML='<p>Cloud storage has not been provisioned for this Site yet. Your browser data is still intact. Export a JSON backup before switching devices.</p>';
 }else if(!authenticated){
  root.innerHTML='<p>Sign in with ChatGPT to synchronize saved essays, drafts, scores and completed attempts across browsers.</p><a class="btn btn-dark" href="/signin-with-chatgpt">Sign in with ChatGPT</a><p style="font-size:11px;color:#8993a2;margin-top:14px">Existing work in Arc on Render must first be exported as JSON and imported in Settings on this new Site.</p>';
 }else{
  const owned=localStorage.getItem(OWNER_KEY)===userEmail;
  root.innerHTML='<p>Signed in with ChatGPT as <strong>'+escapeText(userEmail)+'</strong>.</p>'+
    (owned?'<p>Your existing browser progress is linked to this account and will sync automatically.</p>':
    '<p><strong>First-time setup:</strong> export your data from Arc on Render, import that JSON file in the Settings of this Site, and then select <strong>Merge this browser into cloud</strong>. The merge preserves prior attempts.</p>')+
    '<div class="btn-group" style="margin-top:16px">'+
    (!owned?'<button type="button" class="btn btn-blue" id="sitesCloudImport">Merge this browser into cloud</button>':
    '<button type="button" class="btn btn-blue" id="sitesCloudPush">Sync now</button>')+
    '<a class="btn btn-outline" href="/signout-with-chatgpt">Sign out</a></div>'+
    '<p id="sitesCloudMessage" role="status" style="color:#9d493e;font-size:12px;margin-top:15px" hidden></p>'+
    '<p style="font-size:11px;color:#8993a2">Before each first-time merge, a safety copy is kept in this browser. Exported JSON backups are also supported.</p>';
  if(owned)el("sitesCloudPush").onclick=()=>push(true);
  else el("sitesCloudImport").onclick=importBrowser;
 }
 el("sitesCloudModal").hidden=false;
}
function installButton(){
 if(el("sitesCloudButton"))return;
 const button=document.createElement("button");button.id="sitesCloudButton";button.type="button";
 button.className="btn btn-outline";button.style.cssText="padding:8px 11px;font-size:11px";
 button.onclick=show;button.textContent="☁ Sync";
 const parent=document.querySelector(".header-actions"),settings=el("settingsButton");
 if(parent&&settings)parent.insertBefore(button,settings);
}
function useRemote(remote){
 if(!remote||remote.version!==1||!Array.isArray(remote.essays))throw Error("Invalid remote workbook");
 const old=JSON.parse(localStorage.getItem(DATA_KEY)||"{}");
 const merged={...remote,accessCode:old.accessCode||"",version:1};
 const originalRevision=revision;
 localStorage.setItem(DATA_KEY,JSON.stringify(merged));
 // Main app is the source of UI state; never interrupt active typing.
 if(typeof db!=="undefined"){
  db=merged;
  if(!db.essays.find(e=>e.id===db.selectedId))mode="dashboard";
  if(originalRevision===revision&&!document.activeElement?.matches("input,textarea"))render();
 }
}
async function push(interactive=false){
 if(!active||!authenticated||localStorage.getItem(OWNER_KEY)!==userEmail)return;
 if(inFlight){changed=true;return;}
 inFlight=true;const startedAt=revision,owner=userEmail;
 try{
  const result=await fetchJson("/api/sync/merge",{state:localData()});
  if(owner!==userEmail)return;
  if(startedAt===revision){useRemote(result.state);changed=false;accountBadge("☁ Synced")}
  else{changed=true;accountBadge("☁ Saving…")}
  if(interactive)message("Your data was merged successfully.");
 }catch(error){changed=true;accountBadge("☁ Offline");if(interactive)message(error.message)}
 finally{inFlight=false;if(changed&&authenticated&&localStorage.getItem(OWNER_KEY)===userEmail)setTimeout(()=>push(false),10000)}
}
async function importBrowser(){
 if(inFlight)return;
 if(!confirm("Merge this browser's essays, drafts, scores and all previous attempts into the ChatGPT account "+userEmail+"? Existing cloud data will be retained. A local safety backup will be made first."))return;
 try{
  backup("before-first-cloud-merge");
  const data=localData();
  inFlight=true;
  const result=await fetchJson("/api/sync/merge",{state:data});
  localStorage.setItem(OWNER_KEY,userEmail);
  useRemote(result.state);changed=false;inFlight=false;accountBadge("☁ Synced");show();message("Import and synchronization completed. You can now sign in on another browser.");
 }catch(e){inFlight=false;message(e.message)}
}
function onChange(){
 if(!active||!authenticated||localStorage.getItem(OWNER_KEY)!==userEmail)return;
 revision++;changed=true;clearTimeout(timer);timer=setTimeout(()=>push(),1300);
}
async function init(){
 installButton();
 try{
  const h=await fetchJson("/api/health");active=!!h.sync;
  if(!active){accountBadge("☁ Local only");return}
  const identity=await fetchJson("/api/sync/me");
  authenticated=identity.signedIn;userEmail=identity.email||"";
  if(!authenticated){accountBadge("☁ Sign in");return}
  if(localStorage.getItem(OWNER_KEY)===userEmail)await push();
  else accountBadge("☁ Import data");
 }catch(e){accountBadge("☁ Local only")}
}
window.styleSync={changed:onChange,show,setup:init};
window.styleSync.setup();
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&authenticated)push()});
window.addEventListener("focus",()=>{if(authenticated)push()});
setInterval(()=>{if(authenticated&&!document.hidden)push()},30000);
})();