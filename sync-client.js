(function(){
'use strict';
const STORAGE='style-first-workbook-v1';
const OWNER='style-first-cloud-owner';
const SYNC_DELAY=1200;
let enabled=false, email=null, pending=null, syncing=false, dirty=false, lastSynced=0, loginBusy=false, editRevision=0;
const $=id=>document.getElementById(id);
const h=t=>String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const state=()=>{try{const d=JSON.parse(localStorage.getItem(STORAGE));return {version:1,essays:d.essays||[],selectedId:d.selectedId||null,deletedIds:d.deletedIds||[]};}catch{return {version:1,essays:[],selectedId:null,deletedIds:[]}}};
function backup(label){
 const key='style-first-preserved-'+Date.now()+'-'+label;
 const raw=localStorage.getItem(STORAGE);
 if(raw){try{localStorage.setItem(key,raw);}catch(e){throw new Error('No browser storage available for a safety backup. Export a JSON backup before continuing.');}}
 return key;
}
async function request(url,body){
 const opts={credentials:'same-origin',cache:'no-store'};
 if(body!==undefined){opts.method='POST';opts.headers={'Content-Type':'application/json'};opts.body=JSON.stringify(body);}
 const r=await fetch(url,opts);const d=await r.json().catch(()=>({error:'Unexpected server response'}));
 if(!r.ok)throw new Error(d.error||'Cloud connection failed');
 return d;
}
function status(text,ok){
 const el=$('syncStatusText');if(el){el.textContent=text;el.style.color=ok?'#287a4a':'#8b5660';}
 const pill=$('cloudSyncButton');
 if(pill){pill.title=text;pill.textContent=email?(syncing?'↻ Syncing':'☁ Synced'):'☁ Cloud sync';}
}
function notice(text){const el=$('cloudSyncNotice');if(el){el.textContent=text;el.hidden=false;}}
function cloudModal(){
 let el=$('cloudSyncModal');if(el)return el;
 el=document.createElement('div');el.id='cloudSyncModal';el.className='modal-backdrop';el.hidden=true;
 el.innerHTML='<section class="modal-card settings-modal" role="dialog" aria-modal="true" aria-labelledby="cloudSyncTitle"><div class="modal-header"><div><div class="eyebrow">BACKUP & SYNC</div><h2 id="cloudSyncTitle">Cloud synchronization</h2></div><button class="icon-btn" type="button" id="closeCloudSync" aria-label="Close">×</button></div><div id="cloudSyncMain"></div></section>';
 document.body.append(el);
 $('closeCloudSync').onclick=()=>el.hidden=true;
 el.onclick=e=>{if(e.target===el)el.hidden=true;};
 return el;
}
function show(){
 cloudModal();
 const box=$('cloudSyncMain');
 if(!enabled){
  box.innerHTML='<p style="line-height:1.7">Cloud sync software is installed, but durable database storage has not yet been connected. <strong>All existing browser data is safe and unchanged.</strong></p><p>Continue studying normally, or use Export backup in Settings.</p>';
 }else if(email){
  box.innerHTML='<p><strong>Signed in as '+h(email)+'</strong></p><p id="syncStatusText">Synchronizing securely...</p><div class="btn-group"><button class="btn btn-blue" id="cloudSyncNow">Sync now</button><button class="btn btn-outline" id="cloudSyncLogout">Sign out</button></div><p id="cloudSyncNotice" style="font-size:12px;color:#8b5660" hidden></p><p style="font-size:11px;color:#8791a1">Sync combines saved attempts and essays from all browsers. Local safety copies remain on each browser.</p>';
  $('cloudSyncNow').onclick=()=>push(true);
  $('cloudSyncLogout').onclick=signout;
  status(lastSynced?'Synced '+new Date(lastSynced).toLocaleTimeString():'Signed in',true);
 }else{
  box.innerHTML='<p>Sign in using the same account in Arc, Dia, or another device. Your existing progress is backed up before the first merge.</p><form id="cloudAuthForm"><label style="display:block;margin:12px 0 5px;font-weight:700">Email</label><input id="cloudEmail" type="email" autocomplete="email" required placeholder="you@example.com" style="width:100%;padding:12px;border:1px solid #cbd2dd;border-radius:8px"/><label style="display:block;margin:12px 0 5px;font-weight:700">Password (12+ characters)</label><input id="cloudPassword" type="password" minlength="12" autocomplete="current-password" required placeholder="Your password" style="width:100%;padding:12px;border:1px solid #cbd2dd;border-radius:8px"/><div class="btn-group" style="margin-top:17px"><button class="btn btn-dark" type="submit" data-mode="login">Sign in</button><button class="btn btn-outline" type="button" id="cloudCreate">Create account</button></div></form><p id="cloudSyncNotice" role="status" style="font-size:12px;color:#8b5660" hidden></p><p style="font-size:11px;color:#8894a2">Your essays and history are private to this account. The server does not store your password in plain text.</p>';
  $('cloudAuthForm').onsubmit=ev=>{ev.preventDefault();authenticate('login');};
  $('cloudCreate').onclick=()=>authenticate('register');
 }
 $('cloudSyncModal').hidden=false;
}
function installButton(){
 if($('cloudSyncButton'))return;
 const b=document.createElement('button');b.id='cloudSyncButton';b.type='button';b.className='btn btn-outline';b.style.cssText='font-size:11px;padding:8px 12px;';b.textContent='☁ Cloud sync';b.onclick=show;
 const target=document.querySelector('.header-actions');const settings=$('settingsButton');if(target&&settings)target.insertBefore(b,settings);
}
function suspendWrites(fn){
 const previous=window.styleSyncDisabled;window.styleSyncDisabled=true;
 try{return fn();}finally{window.styleSyncDisabled=previous;}
}
function useCloud(stateCloud){
 if(!stateCloud||stateCloud.version!==1||!Array.isArray(stateCloud.essays))throw new Error('Invalid server data');
 // Preserve per-device AI access code. Never save passwords or session tokens to localStorage.
 const local=JSON.parse(localStorage.getItem(STORAGE)||'{}');
 const data={...stateCloud,accessCode:local.accessCode||'',version:1};
 suspendWrites(()=>{
  localStorage.setItem(STORAGE,JSON.stringify(data));
  if(typeof db!=='undefined'){db=data;if(!document.activeElement?.matches('textarea,input'))render();}
 });
}
async function push(interactive=false){
 if(!enabled||!email){if(interactive)notice('Please sign in first.');return;}
 if(syncing){dirty=true;return;}
 syncing=true;status('Synchronizing changes...',true);
 const revAtStart=editRevision;
 try{
  const res=await request('/api/sync/merge',{state:state()});
  // Never overwrite answers typed while the network request was in flight.
  if(editRevision!==revAtStart){dirty=true;status('Saving newer edits...',true);}
  else{useCloud(res.state);lastSynced=Date.now();dirty=false;status('All saved changes synchronized',true);}
 }catch(e){dirty=true;status('Sync failed — changes remain on this browser',false);if(interactive)notice(e.message);}
 finally{syncing=false;if(dirty&&email){setTimeout(()=>{if(!syncing)push(false)},8000);}}
}
function schedule(){
 if(!email||!enabled||window.styleSyncDisabled)return;
 dirty=true;editRevision++;clearTimeout(pending);pending=setTimeout(()=>push(),SYNC_DELAY);
}
async function authenticate(mode){
 if(loginBusy)return;
 const rawEmail=$('cloudEmail')?.value.trim().toLowerCase(),pass=$('cloudPassword')?.value;
 if(!rawEmail||!pass)return notice('Enter your email and password.');
 if(pass.length<12)return notice('Use a password of at least 12 characters.');
 // Never upload an unknown account's local data without explicit consent.
 const local=state(),owner=localStorage.getItem(OWNER);
 const userData=local.essays.some(x=>x.id!=='demo-household' || Object.keys(x.progress||{}).length>0);
 if(owner&&owner!==rawEmail){
  if(!confirm('This browser contains data associated with another account. A local safety copy will be retained. Continue to the new account?'))return;
 }
 let shouldImport=false;
 if(userData&&!owner){
  shouldImport=confirm('Import the essays and exercise history already saved in THIS browser into your cloud account? Choose OK on your Arc browser to preserve your existing progress; Cancel to keep the browser copy separate and load the cloud account.');
 }else shouldImport=owner===rawEmail;
 loginBusy=true;notice('Signing in...');
 try{
  await request('/api/auth/'+mode,{email:rawEmail,password:pass});
  backup('before-cloud-login');
  email=rawEmail;localStorage.setItem(OWNER,email);
  const result=await request('/api/sync/merge',{state:shouldImport?local:{version:1,essays:[],selectedId:null,deletedIds:[]}});
  useCloud(result.state);lastSynced=Date.now();dirty=false;show();
  status('Cloud sync active',true);
 }catch(e){notice(e.message);}
 finally{loginBusy=false;}
}
async function signout(){
 if(!confirm('Sign out of this account? A safety copy of the data will stay in this browser.'))return;
 try{await request('/api/auth/logout',{});backup('signed-out');localStorage.removeItem(OWNER);email=null;lastSynced=0;
 // Clear visible account-specific data, without destroying the safety copies.
 suspendWrites(()=>useCloud({version:1,essays:[],selectedId:null,deletedIds:[]}));
 show();}catch(e){notice(e.message);}
}
async function initializeCloud(){
 installButton();
 try{
  const health=await request('/api/health');enabled=!!health.sync;
  const me=enabled?await request('/api/auth/me'):{signedIn:false};
  if(me.signedIn){
   const owner=localStorage.getItem(OWNER);
   if(owner&&owner===me.email){
    email=me.email;await push(false);
   }else{
    // Do not automatically import potentially unrelated local progress.
    backup('account-found');email=me.email;localStorage.setItem(OWNER,email);
    const r=await request('/api/sync/merge',{state:{version:1,essays:[],selectedId:null,deletedIds:[]}});
    useCloud(r.state);lastSynced=Date.now();
   }
  }
 }catch(e){status('Cloud unavailable — local progress still works',false);}
 window.addEventListener('focus',()=>{if(email)push(false)});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&email)push(false)});
 setInterval(()=>{if(email&&!document.hidden)push(false)},25000);
}
window.styleSync={changed:schedule,show,setup:initializeCloud};
window.styleSync.setup();
})();