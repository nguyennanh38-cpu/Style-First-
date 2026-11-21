/* Style First: always-available, entirely offline argument-structure workbook.
   This is a writing FRAMEWORK, not generated analysis or automated grading. */
(function(root){
'use strict';
const safe=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function textarea(key,label,tip,drafts,rows=3){
 return '<label class="argument-field"><span class="argument-field-label">'+safe(label)+'</span>'+
 (tip?'<span class="argument-field-tip">'+safe(tip)+'</span>':'')+
 '<textarea class="argument-textarea" rows="'+rows+'" data-argument-field="'+safe(key)+'" spellcheck="true" placeholder="Write your own analysis here. Saved as you type.">'+safe(drafts[key]||'')+'</textarea></label>';
}
function filled(drafts,prefix){
 return Object.entries(drafts||{}).filter(([k,v])=>k.startsWith(prefix)&&typeof v==='string'&&v.trim()).length;
}
function whole(paragraphs,drafts){
 let html='<div class="argument-heading"><div><span class="eyebrow">PART 1 · WHOLE-ESSAY LOGIC</span><h2>Map the argument before its details</h2></div><span class="argument-saved-status" aria-live="polite">Saved locally as you type</span></div>'+
 '<p class="argument-instructions">Identify the writer’s actual position and trace how every paragraph develops, limits or supports it. <strong>Do not invent reasoning that is not in the essay.</strong> Separate textual evidence from any inference.</p>';
 html+=textarea('whole.stance','1. The writer’s overall position','What is the answer to the IELTS question? State the precise stance, including degree of agreement or disagreement when relevant.',drafts,3);
 html+=textarea('whole.nuance','2. Qualifications or limits to that position','What does the writer concede, restrict, or distinguish? If the writer makes no qualification, write “None stated.”',drafts,3);
 html+='<div class="argument-map-header"><h3>3. Paragraph-by-paragraph argument map</h3><p>For each paragraph, state its central idea and how that idea contributes to the essay’s position. Introduction and conclusion count too.</p></div>';
 for(let i=0;i<paragraphs.length;i++){
  html+='<section class="argument-map-entry"><div class="argument-map-index"><strong>PARAGRAPH '+(i+1)+'</strong><button type="button" class="argument-read-link" data-action="argumentJumpSource" data-id="'+i+'">Locate in essay</button></div>'+
  textarea('map.'+i+'.main','Main idea / argumentative role','Identify the claim, concession, background, response, or conclusion actually present.',drafts,2)+
  textarea('map.'+i+'.contribution','How this paragraph advances the overall position','Explain its specific contribution; avoid generic answers such as “supports the essay.”',drafts,2)+'</section>';
 }
 html+=textarea('whole.progression','4. Overall progression of the argument','Write the sequence of moves across paragraphs (P1 → P2 → P3 …) and explain why it leads to the final position.',drafts,4);
 return html;
}
function paragraph(paragraphs,drafts,selected){
 const i=Math.max(0,Math.min(paragraphs.length-1,Number(selected)||0)),prefix='paragraph.'+i+'.';
 const navigation=paragraphs.map((_,j)=>'<button type="button" class="argument-paragraph-tab '+(i===j?'active':'')+'" data-action="argumentSelectParagraph" data-id="'+j+'" aria-pressed="'+(i===j)+'">P'+(j+1)+'</button>').join('');
 return '<div class="argument-heading"><div><span class="eyebrow">PART 2 · PARAGRAPH LOGIC</span><h2>Trace the steps in each paragraph</h2></div><span class="argument-saved-status" aria-live="polite">Saved locally as you type</span></div>'+
 '<p class="argument-instructions">Read the selected paragraph on the left. Reconstruct <strong>only the steps the author actually states</strong>, in the order they appear. No fixed number of steps is required. Label anything beyond the text as <em>Inference</em>.</p>'+
 '<div class="argument-paragraph-nav" aria-label="Choose the paragraph to analyze">'+navigation+'</div>'+
 '<p class="argument-selected">Analyzing paragraph '+(i+1)+' of '+paragraphs.length+'</p>'+
 textarea(prefix+'purpose','1. Central idea and purpose','What claim or argumentative move does this paragraph make? For an introduction or conclusion, explain its role.',drafts,3)+
 textarea(prefix+'steps','2. Actual sequence of ideas','One step per line, following the text. Include explanations, examples and results only if they really appear. For example: “Claim → reason → consequence.”',drafts,6)+
 textarea(prefix+'evidence','3. Exact textual evidence','Quote the shortest relevant words or sentences supporting each important step. Refer to the original paragraph, not invented examples.',drafts,4)+
 textarea(prefix+'connections','4. Why one step leads to the next','Explain the explicit logical links between adjacent steps. If a link requires interpretation beyond the text, mark it “Inference”.',drafts,4)+
 textarea(prefix+'contribution','5. Contribution to the essay’s overall position','How does this paragraph help establish, develop, qualify, challenge or conclude the writer’s stance?',drafts,3)+
 '<div class="argument-paragraph-footer"><button class="btn btn-outline" data-action="argumentSelectParagraph" data-id="'+Math.max(i-1,0)+'" '+(i===0?'disabled':'')+'>Previous paragraph</button><span>P'+(i+1)+' / '+paragraphs.length+'</span><button class="btn btn-blue" data-action="argumentSelectParagraph" data-id="'+Math.min(i+1,paragraphs.length-1)+'" '+(i===paragraphs.length-1?'disabled':'')+'>Next paragraph</button></div>';
}
function render(paragraphs,drafts,view,index){
 const count=filled(drafts,view==='whole'?'whole.':'paragraph.');
 return '<section class="argument-workbook" id="argumentWorkbook"><div class="argument-workbook-body">'+
 (view==='paragraph'?paragraph(paragraphs,drafts,index):whole(paragraphs,drafts))+
 '</div><div class="argument-workbook-foot"><span>Offline framework · No AI · No automatic correctness score</span><span>'+count+' fields with notes</span></div></section>';
}
root.ArgumentWorkbook={render,whole,paragraph,filled};
})(typeof window!=='undefined'?window:globalThis);
