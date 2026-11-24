/* Targeted cloze retry for completed Style First cloze stages.
   Only the originally incorrect blanks are editable. No AI required.
   The original score, checked answers, and attempt history are immutable. */
(function(root){
'use strict';
const escapeHtml=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function cleanup(s){
 return String(s??'').normalize('NFKC').replace(/[\u2018\u2019\u02bc\u201b\uFF07]/g,"'")
 .replace(/[\u201c\u201d]/g,'"').replace(/[\u2010-\u2015\u2212]/g,'-')
 .replace(/[\u00a0\u2007\u202f]/g,' ').replace(/\s+/g,' ').trim();
}
const exact=(a,b)=>cleanup(a)===cleanup(b);
function incorrectIndices(cloze,results){
 if(!cloze||!Array.isArray(results))return [];
 return cloze.blanks.filter((blank,i)=>!results[i]?.exact).map(blank=>blank.index);
}
function signature(cloze,incorrect){
 return cloze.blanks.map(b=>b.index+':'+b.start+':'+b.end+':'+b.expected).join('|')+';wrong='+incorrect.join(',');
}
function model(progress,cloze){
 const ses=progress?.session;
 if(!ses||!Array.isArray(ses.clozeResults))return null;
 const wrong=incorrectIndices(cloze,ses.clozeResults);
 if(!wrong.length)return null;
 const key=signature(cloze,wrong);
 const old=ses.clozeRetry;
 if(!old||old.signature!==key||!Array.isArray(old.pending)||typeof old.drafts!=='object'){
  ses.clozeRetry={version:1,signature:key,originalWrong:wrong,pending:[...wrong],drafts:{},checked:false,results:{},attempts:[]};
 }
 return ses.clozeRetry;
}
function sourceText(cloze){
 return cloze.parts.map(part=>part.type==='text'?part.text:cloze.blanks[part.index-1]?.expected||'').join('');
}
function paragraphs(text){
 const sections=[];let start=0;
 const re=/\n\s*\n/g;let m;
 while((m=re.exec(text))!==null){if(m.index>start)sections.push({start,end:m.index});start=re.lastIndex;}
 if(start<text.length)sections.push({start,end:text.length});
 return sections;
}
function activeParagraphs(cloze,pending){
 const original=sourceText(cloze),ranges=paragraphs(original),indexes=new Set(pending);
 return ranges.filter(p=>cloze.blanks.some(b=>indexes.has(b.index)&&b.start>=p.start&&b.end<=p.end)).map(p=>({...p,original}));
}
function field(blank,m){
 const v=m.drafts[blank.index]||'',r=m.checked?m.results[blank.index]:null;
 const style=r?(r.exact?'is-correct':r.minor?'is-minor':'is-wrong'):'';
 const baseWidth=Math.min(44,Math.max(9,blank.wordCount*5+4));
 const width=Math.min(52,Math.max(baseWidth,v.length+2));
 let feedback='';
 if(r){
  if(r.exact)feedback='<span class="cloze-inline-feedback correct">✓</span>';
  else {
   const highlighted=root.ClozeFeedback?.highlight(v,blank.expected)?.expected||escapeHtml(blank.expected);
   feedback='<span class="cloze-inline-diff" aria-label="Original wording">'+highlighted+'</span>';
  }
 }
 return '<label class="cloze-inline cloze-retry-blank '+style+'">'+
  '<span class="cloze-inline-label">('+blank.index+'·'+blank.wordCount+')</span>'+
  '<input type="text" class="cloze-inline-input cloze-retry-input" data-retry-gap="'+blank.index+'" data-base-width="'+baseWidth+'" style="width:'+width+'ch" '+
  'aria-label="Retry blank '+blank.index+': '+blank.wordCount+' words" autocomplete="off" spellcheck="false" autocapitalize="off" placeholder="type here" value="'+escapeHtml(v)+'" '+(m.checked?'disabled':'')+'/>'+feedback+'</label>';
}
function passage(cloze,m){
 const indices=new Set(m.pending);
 const blocks=activeParagraphs(cloze,m.pending);
 return blocks.map((p,i)=>{
  const gaps=cloze.blanks.filter(b=>b.start>=p.start&&b.end<=p.end);
  let cursor=p.start,html='';
  for(const b of gaps){
   if(b.start>cursor)html+=escapeHtml(p.original.slice(cursor,b.start));
   html+=indices.has(b.index)?field(b,m):escapeHtml(b.expected);
   cursor=b.end;
  }
  if(cursor<p.end)html+=escapeHtml(p.original.slice(cursor,p.end));
  return '<p class="cloze-retry-paragraph">'+html+'</p>';
 }).join('');
}
function render(cloze,progress){
 const m=model(progress,cloze);
 if(!m)return '';
 const total=m.originalWrong.length,n=m.pending.length;
 const correct=m.checked?m.pending.filter(i=>m.results[i]?.exact).length:0;
 const remaining=m.checked?n-correct:n;
 const success=m.checked&&remaining===0;
 const attemptLabel=m.attempts.length;
 const status=m.checked?(success?'All blanks corrected':correct+' of '+n+' corrected'):'Only '+n+' incorrect '+(n===1?'blank':'blanks')+' to fill';
 const content=success?
  '<div class="cloze-retry-success"><strong>Excellent — all targeted blanks are correct.</strong><p>Review completed without changing your original Cloze score.</p></div>':
  '<div class="cloze-passage cloze-retry-passage" aria-label="Retry only incorrect blanks in their original paragraphs">'+passage(cloze,m)+'</div>';
 const button=m.checked?
  '<button type="button" class="btn btn-outline" data-action="redoClozeRetry">'+(success?'Practice missed blanks again':'Retry remaining mistakes')+'</button>':
  '<button type="button" class="btn btn-blue" data-action="checkClozeRetry">Check corrections</button>';
 return '<section class="cloze-retry-panel" id="clozeRetryPanel" aria-label="Targeted practice for incorrect Cloze answers">'+
  '<div class="cloze-retry-top"><div><div class="eyebrow">TARGETED PRACTICE · NO AI REQUIRED</div><h3>Retry incorrect blanks</h3></div>'+
  '<span class="tag blue">'+total+' originally missed</span></div>'+
  '<p class="cloze-retry-explainer">Only the blanks you missed are hidden. Correct answers and paragraphs without mistakes stay out of the way. Reconstruct the author’s exact wording.</p>'+
  '<div class="cloze-retry-status"><span>'+status+'</span><span>'+attemptLabel+' '+(attemptLabel===1?'retry':'retries')+' checked</span></div>'+
  content+'<div class="cloze-retry-footer"><span class="footer-hint">Answers are saved as you type. Your original score and attempt history stay unchanged.</span>'+button+'</div></section>';
}
function check(progress,cloze){
 const m=model(progress,cloze);if(!m||m.checked)return null;
 const result={};
 for(const id of m.pending){
  const b=cloze.blanks[id-1],value=m.drafts[id]||'',match=exact(value,b.expected);
  const minor=!match&&root.ClozeFeedback?.classify(value,b.expected)?.kind==='minor';
  result[id]={exact:match,minor:!!minor};
 }
 m.results=result;m.checked=true;
 const failures=m.pending.filter(id=>!result[id]?.exact);
 const record={at:new Date().toISOString(),total:m.pending.length,correct:m.pending.length-failures.length,remaining:[...failures]};
 m.attempts.push(record);
 return record;
}
function retry(progress,cloze){
 const m=model(progress,cloze);if(!m||!m.checked)return false;
 const remaining=m.pending.filter(id=>!m.results[id]?.exact);
 m.pending=remaining.length?remaining:[...m.originalWrong];
 m.drafts={};m.results={};m.checked=false;
 return true;
}
function locate(){
 if(typeof selected!=='function'||typeof progress!=='function'||typeof bundle!=='function')return null;
 const e=selected();if(!e)return null;
 const data=bundle()?.stages?.[stageId];
 if(!data?.cloze)return null;
 const p=progress(e,stageId);
 return {p,cloze:data.cloze};
}
function redraw(){
 if(typeof render==='function'){} // renderer below is separate from the main app's render()
 if(typeof root.render==='function')root.render();
 else if(typeof globalThis.render==='function')globalThis.render();
 const panel=typeof document!=='undefined'?document.getElementById('clozeRetryPanel'):null;
 panel?.scrollIntoView({block:'start'});
}
if(typeof document!=='undefined'){
 document.addEventListener('input',ev=>{
  const t=ev.target;if(!t.classList?.contains('cloze-retry-input'))return;
  const loc=locate();if(!loc)return;
  const state=model(loc.p,loc.cloze);if(!state||state.checked)return;
  state.drafts[t.dataset.retryGap]=t.value;
  const base=Number(t.dataset.baseWidth)||9;
  t.style.width=Math.min(52,Math.max(base,t.value.length+2))+'ch';
  if(typeof save==='function')save();
 });
 document.addEventListener('click',ev=>{
  const btn=ev.target.closest?.('[data-action]');if(!btn)return;
  const act=btn.dataset.action;if(act!=='checkClozeRetry'&&act!=='redoClozeRetry')return;
  ev.preventDefault();const loc=locate();if(!loc)return;
  if(act==='checkClozeRetry')check(loc.p,loc.cloze);
  else retry(loc.p,loc.cloze);
  if(typeof save==='function')save();
  redraw();
  if(act==='redoClozeRetry')document.querySelector('#clozeRetryPanel .cloze-retry-input')?.focus();
 });
}
root.ClozeRetry={render,check,retry,model,exact,incorrectIndices,activeParagraphs,sourceText};
})(typeof window!=='undefined'?window:globalThis);
