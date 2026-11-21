/* Style First — single-page, offline argument notebook.
   Uses the original keys so every existing note survives without migration.
   No AI-generated reasoning, no grading, and no replacement questions. */
(function(root){
'use strict';
const safe=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
 .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const has=(drafts,key)=>typeof drafts[key]==='string'&&drafts[key].trim().length>0;
function field(key,label,drafts,rows=3,placeholder='Write the argument in your own words…',kind=''){
 const value=typeof drafts[key]==='string'?drafts[key]:'';
 const lines=value.split(/\n/).length;
 const height=Math.max(rows,Math.min(9,lines+1));
 return '<label class="argument-field '+kind+'"><span class="argument-field-label">'+safe(label)+'</span>'+
  '<textarea class="argument-textarea" rows="'+height+'" data-argument-field="'+safe(key)+'" '+
  'spellcheck="true" placeholder="'+safe(placeholder)+'">'+safe(value)+'</textarea></label>';
}
function mainKey(i,drafts){
 const purpose='paragraph.'+i+'.purpose',steps='paragraph.'+i+'.steps';
 if(i===0)return has(drafts,purpose)||!has(drafts,steps)?purpose:steps;
 return has(drafts,steps)||!has(drafts,purpose)?steps:purpose;
}
const extras=[['purpose','Purpose / central idea'],['steps','Sequence of ideas'],
 ['evidence','Textual evidence'],['connections','Logical connections'],['contribution','Contribution to the stance']];
function preservedNotes(drafts,i,primary){
 const fields=[];
 for(const [suffix,name] of extras){
  const key='paragraph.'+i+'.'+suffix;
  if(key!==primary&&has(drafts,key))fields.push([key,name]);
 }
 for(const [suffix,name] of [['main','Whole-essay map: main idea'],['contribution','Whole-essay map: contribution']]){
  const key='map.'+i+'.'+suffix;
  if(has(drafts,key))fields.push([key,name]);
 }
 if(!fields.length)return '';
 return '<div class="argument-saved-extras"><div class="argument-saved-heading">Other previously saved notes</div>'+
  fields.map(([key,name])=>field(key,name,drafts,2,'Your saved note…','argument-preserved-field')).join('')+'</div>';
}
function paragraphsView(paragraphs,drafts){
 const count=paragraphs.length;
 return paragraphs.map((p,i)=>{
  const key=mainKey(i,drafts),note=has(drafts,key),intro=i===0,conclusion=i===count-1;
  const role=intro?'Introduction':conclusion?'Conclusion':'Body paragraph';
  const label=intro?'Central idea & purpose':'Actual sequence of ideas';
  const hint=intro?'Identify the issue and the author’s stated position.':'Trace the main claim → supporting details → development, using only ideas actually present.';
  return '<section class="argument-paragraph-card" id="argumentCard-'+i+'" data-argument-paragraph="'+i+'">'+
   '<div class="argument-card-head"><div class="argument-card-label"><span class="argument-paragraph-number">P'+(i+1)+'</span>'+
   '<div><strong>'+role+'</strong><small>'+(note?'Notes saved':'Ready for analysis')+'</small></div></div>'+
   '<button type="button" class="argument-read-link" data-action="argumentJumpSource" data-id="'+i+'" aria-label="Show paragraph '+(i+1)+' in original essay">Show in essay</button></div>'+
   '<div class="argument-card-hint">'+hint+'</div>'+
   field(key,label,drafts,intro?3:4,'Describe the author’s actual moves in order…')+
   preservedNotes(drafts,i,key)+'</section>';
 }).join('');
}
function countNotes(paragraphs,drafts){
 return paragraphs.reduce((n,_,i)=>n+Number(has(drafts,mainKey(i,drafts))),0);
}
function render(paragraphs,drafts){
 const count=paragraphs.length;
 const completed=countNotes(paragraphs,drafts);
 const nav='<div class="argument-jumpbar" aria-label="Go directly to your paragraph analysis">'+
  '<button type="button" class="argument-jump-button" data-action="argumentScrollTo" data-id="overview">Overview</button>'+
  paragraphs.map((p,i)=>'<button type="button" class="argument-jump-button '+(has(drafts,mainKey(i,drafts))?'has-notes':'')+
  '" data-action="argumentScrollTo" data-id="'+i+'">P'+(i+1)+'</button>').join('')+'</div>';
 let overview='<section class="argument-overview-card" id="argumentOverviewCard">'+
  '<div class="argument-card-head"><div><span class="eyebrow">THE WHOLE ESSAY</span><h2>Overall argument</h2></div>'+
  '<span class="argument-coverage">'+completed+' / '+count+' paragraphs noted</span></div>'+
  '<p class="argument-card-hint">What is the writer’s position? Keep it precise. Then trace the individual paragraphs below.</p>'+
  field('whole.stance','Writer’s position',drafts,3,'State the author’s exact stance…');
 // Retain original whole-essay annotations if they contain user writing.
 for(const [key,label] of [['whole.nuance','Previously saved: Qualifications'],['whole.progression','Previously saved: Essay progression']])
  if(has(drafts,key))overview+=field(key,label,drafts,2,'Your saved note…','argument-preserved-field');
 overview+='</section>';
 const insights=field('insights.global','',drafts,3,
  'Capture an interesting move, repeated pattern, useful structure, or writing technique the moment you notice it…','argument-insights-field');
 return '<section class="argument-workbook argument-unified" id="argumentWorkbook" aria-label="Single-page argument analysis">'+
  '<div class="argument-workbook-body" id="argumentWorkbookBody">'+
  '<div class="argument-notebook-heading"><div><span class="eyebrow">STAGE 01 · ARGUMENT ANATOMY</span><h2>Argument notebook</h2></div>'+
  '<span class="argument-saved-status">Autosaved</span></div>'+
  '<p class="argument-notebook-intro">One page for the whole argument and every paragraph. Record only reasoning that actually appears in the essay; identify any inference explicitly.</p>'+
  nav+overview+paragraphsView(paragraphs,drafts)+
  '<div class="argument-end-marker">End of analysis · '+count+' paragraphs</div></div>'+
  '<aside class="argument-insights-dock" aria-label="Always-visible interesting insights and patterns">'+
  '<div class="argument-insights-head"><span class="argument-insight-sparkle">✦</span>'+
  '<strong>Interesting insights &amp; patterns</strong><span class="argument-saved-status">Always available</span></div>'+
  '<p>Capture ideas immediately without leaving this page.</p>'+insights+
  '</aside></section>';
}
root.ArgumentWorkbook={render,mainKey,countNotes};
})(typeof window!=='undefined'?window:globalThis);
