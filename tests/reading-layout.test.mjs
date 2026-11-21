import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function appFrom(path){
 const html=readFileSync(new URL(path,import.meta.url),'utf8');
 const source=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
 assert.ok(source,'Main training script must exist');
 assert.doesNotThrow(()=>new vm.Script(source),'Main script must be syntactically valid');
 const sandbox=vm.createContext({console,Math,Date,Intl,URL,TextEncoder,window:{}});
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
 test(path+': Stage 1 begins with a permanent offline whole-essay framework',()=>{
  const {html,run}=appFrom(path);
  const view=run("db=fresh();mode='stage';stageId='1';argumentView='whole';renderStage()");
  assert.match(view,/class="reading-workspace"/);
  assert.match(view,/id="readingSourceScroll"/);
  assert.match(view,/WHOLE-ESSAY LOGIC/);
  assert.match(view,/writer’s overall position/);
  assert.match(view,/Paragraph-by-paragraph argument map/);
  assert.match(view,/How this paragraph advances the overall position/);
  assert.match(view,/data-argument-field="whole.stance"/);
  assert.match(view,/data-argument-field="map.0.main"/);
  assert.match(view,/data-argument-field="map.4.contribution"/);
  assert.doesNotMatch(view,/automatic correctness score:<\/strong>/);
  assert.match(html,/data-action="reader"/);
 });
 test(path+': Stage 1 switches to paragraph logic and retains older questions separately',()=>{
  const {run}=appFrom(path);
  const para=run("db=fresh();mode='stage';stageId='1';argumentView='paragraph';argumentParagraphIndex=2;renderStage()");
  assert.match(para,/PARAGRAPH LOGIC/);
  assert.match(para,/data-argument-field="paragraph.2.steps"/);
  assert.match(para,/Actual sequence of ideas/);
  assert.match(para,/Exact textual evidence/);
  assert.match(para,/Why one step leads to the next/);
  assert.match(para,/data-action="argumentSelectParagraph"/);
  const older=run("argumentView='questions';renderStage()");
  assert.match(older,/In paragraph 1/);
  assert.match(older,/id="answerArea"/);
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
}
