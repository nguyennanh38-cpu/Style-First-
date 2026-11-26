/* Inline review of the exact expressions missed in a checked exercise.
   This data lives inside the current study session and is included in backups. */
(function(root){
'use strict';
const escapeHtml=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function locate(){
 if(typeof selected!=='function'||typeof progress!=='function')return null;
 const essay=selected();if(!essay)return null;
 const p=progress(essay,stageId),index=p.session.current;
 return {p,index,essay};
}
function stateFor(p,index,original,answer){
 p.session.mistakeReviews ||= {};
 const old=p.session.mistakeReviews[index];
 if(!old||old.source!==answer||old.original!==original)
  p.session.mistakeReviews[index]={source:answer,original,drafts:{},checked:false,attempts:0,alignmentVersion:2};
 else if(old.alignmentVersion!==2){
  // Keep the old review intact as a backup and transfer answers for unchanged spans.
  const prior=root.MistakeReview.buildLegacy(original,answer),next=root.MistakeReview.build(original,answer);
  const spans=c=>{let offset=0;return c.parts.flatMap(part=>{const start=offset;offset+=(part.type==='text'?part.text:part.expected).length;return part.type==='blank'?[{start,end:offset,index:part.index,expected:part.expected}]:[];});};
  const oldSpans=spans(prior),newSpans=spans(next),drafts={};
  for(const n of newSpans){const p=oldSpans.find(x=>x.start===n.start&&x.end===n.end);if(p&&Object.prototype.hasOwnProperty.call(old.drafts||{},p.index))drafts[n.index]=old.drafts[p.index];}
  const unchanged=oldSpans.length===newSpans.length&&newSpans.every((n,i)=>n.start===oldSpans[i].start&&n.end===oldSpans[i].end);
  p.session.mistakeReviews[index]={...old,legacyReview:{drafts:{...old.drafts},checked:old.checked},drafts,checked:unchanged&&old.checked,alignmentVersion:2};
 }
 return p.session.mistakeReviews[index];
}
function renderReview(original,answer,p,index){
 const helper=root.MistakeReview;
 if(!helper||!original||!answer)return '';
 const cloze=helper.build(original,answer);
 if(!cloze.blanks.length)return '';
 const m=stateFor(p,index,original,answer);
 const missing=cloze.parts.map(part=>{
  if(part.type==='text')return escapeHtml(part.text);
  const blank=cloze.blanks[part.index-1],raw=m.drafts[part.index]||'';
  const correct=m.checked&&helper.answerMatches(raw,blank.expected);
  const bad=m.checked&&!correct;
  const width=Math.max(9,Math.min(48,Math.max(blank.wordCount*5+3,raw.length+2)));
  const className=correct?'is-correct':bad?'is-wrong':'';
  return '<label class="cloze-inline mistake-inline '+className+'">'+
   '<span class="cloze-inline-label">('+blank.index+'·'+blank.wordCount+')</span>'+
   '<input class="mistake-input cloze-inline-input" data-mistake-index="'+blank.index+'" data-base-width="'+Math.max(9,Math.min(48,blank.wordCount*5+3))+'" aria-label="Correct expression '+blank.index+', '+blank.wordCount+' words" style="width:'+width+'ch" value="'+escapeHtml(raw)+'" placeholder="type here" autocomplete="off" spellcheck="false" '+(m.checked?'disabled':'')+'/>'+
   (m.checked?'<span class="cloze-inline-feedback '+(correct?'correct':'incorrect')+'">'+(correct?'✓':'Original: '+escapeHtml(blank.expected))+'</span>':'')+
   '</label>';
 }).join('');
 const correctCount=m.checked?cloze.blanks.filter(x=>helper.answerMatches(m.drafts[x.index]||'',x.expected)).length:0;
 const summary=m.checked?'<strong class="mistake-review-result">'+correctCount+'/'+cloze.blanks.length+' correct · '+Math.round(100*correctCount/cloze.blanks.length)+'%</strong>':'';
 return '<section class="mistake-review-panel" id="mistakeReviewPanel" aria-label="Retry incorrect expressions">'+
 '<div class="mistake-review-title"><div><div class="eyebrow">TARGETED PRACTICE</div><h3>Review your mistakes</h3></div><span class="tag blue">'+cloze.blanks.length+' '+(cloze.blanks.length===1?'expression':'expressions')+' to revisit</span></div>'+
 '<p class="mistake-review-intro">Only unmatched original words are hidden. Extra words are listed separately below. Type the <strong>author’s exact expressions</strong> directly in the passage. Press Tab to move between gaps.</p>'+
 '<div class="cloze-passage mistake-review-passage">'+missing+'</div>'+
 '<div class="mistake-review-footer"><span class="footer-hint">Blank number · number of missing words. Does not change your original score.</span><div class="btn-group">'+summary+
 (m.checked?'<button class="btn btn-outline" data-action="redoMistakeReview">Try these blanks again</button>':'<button class="btn btn-blue" data-action="checkMistakeReview">Check my corrections</button>')+
 '</div></div></section>';
}
function renderFromCurrent(){
 if(typeof render==='function')render();
}
function check(){
 const l=locate();if(!l)return;
 const m=l.p.session.mistakeReviews?.[l.index];if(!m||m.checked)return;
 const c=root.MistakeReview.build(m.original,m.source);
 if(!c.blanks.length)return;
 m.checked=true;m.attempts=(m.attempts||0)+1;
 if(typeof save==='function')save();
 renderFromCurrent();
 const node=document.getElementById('mistakeReviewPanel');node?.scrollIntoView({block:'nearest'});
}
function redo(){
 const l=locate();if(!l)return;
 const m=l.p.session.mistakeReviews?.[l.index];if(!m)return;
 m.checked=false;m.drafts={};
 if(typeof save==='function')save();
 renderFromCurrent();
 document.querySelector('#mistakeReviewPanel .mistake-input')?.focus();
}
document.addEventListener('input',ev=>{
 const input=ev.target;
 if(!input.classList?.contains('mistake-input'))return;
 const l=locate();if(!l)return;
 const m=l.p.session.mistakeReviews?.[l.index];
 if(!m||m.checked)return;
 m.drafts[input.dataset.mistakeIndex]=input.value;
 const base=Number(input.dataset.baseWidth)||9;
 input.style.width=Math.min(48,Math.max(base,input.value.length+2))+'ch';
 if(typeof save==='function')save();
});
document.addEventListener('click',ev=>{
 const button=ev.target.closest?.('[data-action]');
 if(!button)return;
 if(button.dataset.action==='checkMistakeReview'){ev.preventDefault();check();}
 else if(button.dataset.action==='redoMistakeReview'){ev.preventDefault();redo();}
});
root.MistakeReviewUI={render:renderReview,check,redo};
})(typeof window!=='undefined'?window:globalThis);
