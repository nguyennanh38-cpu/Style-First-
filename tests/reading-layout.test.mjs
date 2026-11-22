import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function appFrom(path){
 const html=readFileSync(new URL(path,import.meta.url),'utf8');
 const source=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
 assert.ok(source,'Main training script must exist');
 assert.doesNotThrow(()=>new vm.Script(source),'Main script must be syntactically valid');
 const sandbox=vm.createContext({console,Math,Date,Intl,URL,TextEncoder,window:{},localStorage:{getItem:()=>null,setItem:()=>{}}});
 vm.runInContext(readFileSync(new URL('../argument-workbook.js',import.meta.url),'utf8'),sandbox,{timeout:5000});
 vm.runInContext(source.replace(/\binitialize\(\);\s*$/,''),sandbox,{timeout:5000});
 const run=expression=>vm.runInContext(expression,sandbox,{timeout:15000});
 return {html,run};
}

for(const path of ['../index.html','../sites/index.html']){
 test(path+': preserves full essay in an independently scrollable reader',()=>{
  const {html,run}=appFrom(path);
  assert.match(html,/id="navReader"/);
  assert.match(html,/id="workspace"/);
  assert.match(html,/\.reading-source-scroll\{overflow:auto/);
  const view=run("db=fresh(); mode='reader'; renderReader()");
  assert.match(view,/Read the original essay/);
  assert.match(view,/id="readingSourceScroll"/);
  assert.match(view,/PARAGRAPH 1/);
  assert.match(view,/PARAGRAPH 5/);
  assert.match(view,/the paradigm of work has shifted/);
  assert.match(view,/the varying demands of each partner/);
  assert.match(view,/IELTS QUESTION/);
 });
 test(path+': Stage 1 is a single notebook containing the overall argument and all paragraphs',()=>{
  const {html,run}=appFrom(path);
  const view=run("db=fresh();mode='stage';stageId='1';renderStage()");
  assert.match(view,/class="reading-workspace argument-reading-workspace"/);
  assert.match(view,/id="readingSourceScroll"/);
  assert.match(view,/THE WHOLE ESSAY/);
  assert.match(view,/data-argument-field="whole.stance"/);
  assert.match(view,/id="argumentCard-0"/);
  assert.match(view,/id="argumentCard-4"/);
  assert.match(view,/data-argument-field="paragraph.0.purpose"/);
  assert.match(view,/data-argument-field="paragraph.1.steps"/);
  assert.match(view,/data-argument-field="paragraph.4.steps"/);
  assert.match(view,/data-argument-field="insights.global"/);
  assert.match(view,/Interesting insights &amp; patterns/);
  assert.doesNotMatch(view,/argument-mode-tabs|data-action="argumentView"|Existing analysis questions/);
  assert.doesNotMatch(view,/data-argument-field="paragraph.1.evidence"/);
  assert.match(html,/\.argument-insights-dock\{/);
  assert.match(html,/\.argument-unified\{height:calc\(100vh/);
 });
 test(path+': previously saved paragraph work survives the simplified view',()=>{
  const {run}=appFrom(path);
  const data=run("db=fresh();mode='stage';stageId='1';const e=selected();const d=argumentWorkbookData(e).drafts;d['paragraph.0.purpose']='Intro purpose';d['paragraph.1.steps']='First -> second';d['paragraph.2.evidence']='Old citation';d['map.1.main']='Saved topic';d['whole.nuance']='A qualification';d['insights.global']='Repeated concession pattern';renderStage()");
  assert.match(data,/Intro purpose/);
  assert.match(data,/First -&gt; second/);
  assert.match(data,/Old citation/);
  assert.match(data,/Saved topic/);
  assert.match(data,/A qualification/);
  assert.match(data,/Repeated concession pattern/);
  assert.match(data,/data-argument-field="paragraph.2.evidence"/);
  assert.match(data,/data-argument-field="map.1.main"/);
  assert.doesNotMatch(data,/data-action="argumentSelectParagraph"/);
 });
 test(path+': whole essay and all notes stay accessible in one view',()=>{
  const {run}=appFrom(path);
  const view=run("db=fresh();mode='stage';stageId='1';renderStage()");
  assert.equal((view.match(/id="argumentWorkbook"/g)||[]).length,1);
  assert.equal((view.match(/class="argument-insights-dock"/g)||[]).length,1);
  const paragraphCount=run("splitEssay(selected().essay).paragraphs.length");
  assert.equal((view.match(/class="argument-paragraph-card"/g)||[]).length,paragraphCount);
  assert.equal((view.match(/data-action="argumentScrollTo"/g)||[]).length,paragraphCount+1);
  assert.match(view,/PARAGRAPH 5/);
  assert.match(view,/id="argumentWorkbookBody"/);
 });
 test(path+': workbook notes persist independently of stage one redo',()=>{
  const {run}=appFrom(path);
  const data=run("db=fresh();stageId='1';argumentView='whole';const e=selected();argumentWorkbookData(e).drafts['whole.stance']='The writer partially disagrees.';progress(e,'1').session.drafts[0]='Earlier answer';redo.toString().includes('p.session=');argumentWorkbookData(e).drafts['whole.stance']");
  assert.equal(data,'The writer partially disagrees.');
 });
 test(path+': Stage 2 also shows essay while maintaining cloze and other stages',()=>{
  const {run}=appFrom(path);
  const noun=run("db=fresh();mode='stage';stageId='2';renderStage()");
  assert.match(noun,/class="reading-workspace"/);
  assert.match(noun,/id="answerArea"/);
  const cloze=run("stageId='5';renderStage()");
  assert.match(cloze,/cloze-passage/);
  assert.doesNotMatch(cloze,/class="reading-workspace"/);
 });

 test(path+': every essay has its own rename control, independent of the opening button',()=>{
  const {html,run}=appFrom(path);
  const cards=run("db=fresh(); const original=db.essays[0]; db.essays.push({...original,id:'another-essay',title:'Another paper',progress:{}});renderDashboard()");
  assert.equal((cards.match(/class="essay-rename-action"/g)||[]).length,2);
  assert.equal((cards.match(/class="essay-tile-wrap"/g)||[]).length,2);
  assert.match(cards,/data-action="renameEssay"/);
  assert.match(cards,/data-action="selectEssay"/);
  assert.match(cards,/Rename Another paper/);
  assert.match(html,/id="renameEssayModal"/);
  assert.match(html,/id="renameEssayForm"/);
 });
 test(path+': renaming preserves essay IDs, source, progress and selected essay',()=>{
  const {run}=appFrom(path);
  const result=run("db=fresh(); const e=db.essays[0];e.progress={'5':{history:[{complete:true}],session:{drafts:{0:'remember'},results:{},current:0}}};const original=e.essay;const before=JSON.stringify(e.progress);const id=e.id;const selectedId=db.selectedId;const result=renameEssayRecord(id,'  New Study Title  ');({result,title:e.title,unchangedSource:e.essay===original,unchangedProgress:JSON.stringify(e.progress)===before,unchangedId:e.id===id,unchangedSelection:db.selectedId===selectedId})");
  assert.equal(result.result.ok,true);
  assert.equal(result.result.changed,true);
  assert.equal(result.title,'New Study Title');
  assert.equal(result.unchangedSource,true);
  assert.equal(result.unchangedProgress,true);
  assert.equal(result.unchangedId,true);
  assert.equal(result.unchangedSelection,true);
 });
 test(path+': invalid or unchanged names do not modify an essay',()=>{
  const {run}=appFrom(path);
  const result=run("db=fresh();const essay=db.essays[0];const old=essay.title; const empty=renameEssayRecord(essay.id,'  ');const tooLong=renameEssayRecord(essay.id,'a'.repeat(121));const unchanged=renameEssayRecord(essay.id,old);const absent=renameEssayRecord('no-such-id','Other');({empty,tooLong,unchanged,absent,old,title:essay.title})");
  assert.equal(result.empty.ok,false);
  assert.equal(result.tooLong.ok,false);
  assert.equal(result.absent.ok,false);
  assert.equal(result.unchanged.ok,true);
  assert.equal(result.unchanged.changed,false);
  assert.equal(result.title,result.old);
 });
}
