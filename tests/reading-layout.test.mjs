import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function appFrom(path){
 const html=readFileSync(new URL(path,import.meta.url),'utf8');
 const source=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
 assert.ok(source,'Main training script must exist');
 assert.doesNotThrow(()=>new vm.Script(source),'Main script must be syntactically valid');
 const sandbox=vm.createContext({console,Math,Date,Intl,URL,TextEncoder});
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
 test(path+': Stage 1 has a side-by-side source essay and answer form',()=>{
  const {html,run}=appFrom(path);
  const view=run("db=fresh();mode='stage';stageId='1';renderStage()");
  assert.match(view,/class="reading-workspace"/);
  assert.match(view,/class="reading-question-pane"/);
  assert.match(view,/id="readingSourceScroll"/);
  assert.match(view,/id="answerArea"/);
  assert.match(view,/In paragraph 1/);
  assert.match(view,/PARAGRAPH 1/);
  assert.match(view,/PARAGRAPH 5/);
  assert.match(html,/data-action="reader"/);
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
