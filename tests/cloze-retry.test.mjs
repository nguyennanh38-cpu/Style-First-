import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import '../cloze-retry.js';

const {model,render,check,retry,incorrectIndices,activeParagraphs,sourceText}=globalThis.ClozeRetry;
const text="An introductory sentence with learning.\n\nThe second paragraph has genuine reasoning and insight.\n\nA final conclusion summarizes those ideas.";
const phrases=[{expected:'introductory',wordCount:1},{expected:'genuine reasoning',wordCount:2},{expected:'final conclusion',wordCount:2}];
function fixture(){
 const blanks=phrases.map((x,i)=>{
  const start=text.indexOf(x.expected);
  return {...x,index:i+1,start,end:start+x.expected.length};
 });
 let parts=[],position=0;
 for(const b of blanks){parts.push({type:'text',text:text.slice(position,b.start)});parts.push({type:'gap',index:b.index});position=b.end;}
 parts.push({type:'text',text:text.slice(position)});
 return {blanks,parts,ratio:.2,masked:5,totalWords:21};
}
function progress(){
 return {history:[{at:'2026-11-24T00:00:00.000Z',score:33,complete:true,correct:1,total:3}],
 session:{saved:true,clozeResults:[{exact:true},{exact:false},{exact:false}],drafts:{0:'introductory',1:'other phrase',2:''}}};
}
test('Only incorrect original blanks become editable; correct ones appear as prose',()=>{
 const c=fixture(),p=progress();
 const html=render(c,p);
 assert.deepEqual(incorrectIndices(c,p.session.clozeResults),[2,3]);
 assert.equal((html.match(/class="cloze-inline cloze-retry-blank/g)||[]).length,2);
 assert.doesNotMatch(html,/introductory sentence/);
 // A correct blank in a paragraph that also contains a mistake must remain visible as prose.
 const mixed=progress();
 mixed.session.clozeResults=[{exact:false},{exact:true},{exact:false}];
 const mixedC={...c,parts:c.parts.map(part=>part.type==='text'?{...part,text:part.text.replace(' sentence with learning.\n\nThe second paragraph has ',' sentence with learning. The second paragraph has ')}:part)};
 // Rebuild the fixture with matching offsets after joining paragraphs.
 const joined=text.replace('learning.\n\nThe second','learning. The second');
 mixedC.blanks=c.blanks.map(b=>({...b,start:joined.indexOf(b.expected),end:joined.indexOf(b.expected)+b.expected.length}));
 const mixedHtml=render(mixedC,mixed);
 assert.match(mixedHtml,/genuine reasoning and insight/);
 assert.doesNotMatch(mixedHtml,/data-retry-gap="2"/);
 assert.match(html,/data-retry-gap="2"/);
 assert.match(html,/data-retry-gap="3"/);
 assert.doesNotMatch(html,/data-retry-gap="1"/);
 assert.equal(sourceText(c),text);
 assert.equal(activeParagraphs(c,[2]).length,1);
});
test('Retry checks only target blanks and preserves the original score and attempt',()=>{
 const c=fixture(),p=progress();
 const backup=JSON.stringify({history:p.history,results:p.session.clozeResults,drafts:p.session.drafts});
 const m=model(p,c);m.drafts[2]='genuine reasoning';m.drafts[3]='a final conclusion';
 const r=check(p,c);
 assert.equal(r.total,2);assert.equal(r.correct,1);assert.deepEqual(r.remaining,[3]);
 assert.equal(m.attempts.length,1);
 assert.equal(JSON.stringify({history:p.history,results:p.session.clozeResults,drafts:p.session.drafts}),backup);
 assert.match(render(c,p),/1 of 2 corrected/);
 assert.equal(retry(p,c),true);
 assert.deepEqual(m.pending,[3]);
 assert.equal(Object.keys(m.drafts).length,0);
 assert.match(render(c,p),/data-retry-gap="3"/);
 assert.doesNotMatch(render(c,p),/data-retry-gap="2"/);
});
test('Successfully correcting remaining blanks supports redoing all missed blanks',()=>{
 const c=fixture(),p=progress(),m=model(p,c);
 m.drafts[2]='genuine reasoning';m.drafts[3]='wrong';check(p,c);retry(p,c);
 m.drafts[3]='final conclusion';const r=check(p,c);
 assert.equal(r.correct,1);
 assert.match(render(c,p),/all targeted blanks are correct/i);
 assert.equal(m.attempts.length,2);
 assert.equal(retry(p,c),true);
 assert.deepEqual(m.pending,[2,3]);
});
test('Retry model persists when a checked Cloze rerenders',()=>{
 const c=fixture(),p=progress(),m=model(p,c);
 m.drafts[2]='genuine';model(p,c);assert.equal(m.drafts[2],'genuine');
 check(p,c);model(p,c);assert.equal(m.checked,true);
});
test('Text injection is escaped',()=>{
 const c=fixture(),p=progress(),m=model(p,c);
 m.drafts[2]='<img src=x onerror=alert(1)>';
 const html=render(c,p);
 assert.doesNotMatch(html,/<img/);
 assert.match(html,/&lt;img/);
});
for(const page of ['../index.html','../sites/index.html']){
 test(page+': actual Cloze page integrates targeted retry with preserved score',()=>{
  const html=readFileSync(new URL(page,import.meta.url),'utf8');
  assert.match(html,/<script src="\/cloze-retry.js"><\/script>/);
  const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(()=>new vm.Script(script));
  const sandbox=vm.createContext({console,Math,Date,Intl,URL,TextEncoder,window:{ClozeRetry:globalThis.ClozeRetry}});
  vm.runInContext(script.replace(/\binitialize\(\);\s*$/,''),sandbox,{timeout:5000});
  const expr="db=fresh();stageId='5';const e=selected();const c=bundle().stages['5'].cloze;const p=progress(e,'5');p.session.saved=true;p.session.clozeResults=c.blanks.map((b,i)=>({exact:i%3!==0}));p.session.drafts={};const html=renderCloze(bundle().stages['5'],p,STAGES.find(x=>x.id==='5'));({html,wrong:p.session.clozeResults.filter(r=>!r.exact).length,total:c.blanks.length})";
  const res=vm.runInContext(expr,sandbox,{timeout:15000});
  assert.match(res.html,/Retry incorrect blanks/);
  assert.equal((res.html.match(/class="cloze-inline cloze-retry-blank/g)||[]).length,res.wrong);
  assert.match(res.html,/cloze-summary/);
 });
}
