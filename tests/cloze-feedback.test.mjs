import test from 'node:test';
import assert from 'node:assert/strict';
import '../cloze-feedback.js';
const {classify,highlight}=globalThis.ClozeFeedback;
test('punctuation-only differences are minor (yellow)',()=>{
 assert.equal(classify('provincial ones are','provincial ones, are').kind,'minor');
 assert.equal(classify('ones are','ones, are').reason,'Punctuation or spacing');
});
test('capitalization-only differences are minor (yellow)',()=>{
 assert.equal(classify('Governments are having','governments are having').kind,'minor');
 assert.equal(classify('Governments are having','governments are having').reason,'Capitalization only');
});
test('straight and curly apostrophes are fully equivalent',()=>{
 assert.equal(classify("children's achievements","children’s achievements").kind,'exact');
});
test('genuine common spelling typos are minor',()=>{
 assert.equal(classify('goverment coffers','government coffers').kind,'minor');
 assert.equal(classify('colours and museums','colors and museums').kind,'minor');
});
test('grammar and meaning-uncertain substitutions remain red',()=>{
 for(const [a,b] of [
  ['could propose','might propose'],['government coffers','government coffer'],
  ['particularly those','especially those'],['financial burden','financial burdens'],
  ['for museums','of museums'],['accept','except']
 ])assert.equal(classify(a,b).kind,'major',a+' / '+b);
});
test('differences are bolded in both learner and original text',()=>{
 const r=highlight('government coffers particularly those','government coffers especially those');
 assert.match(r.answer,/<strong class="cloze-diff-word">particularly<\/strong>/);
 assert.match(r.expected,/<strong class="cloze-diff-word">especially<\/strong>/);
 assert.doesNotMatch(r.answer,/<strong[^>]*>government/);
});
test('inserted and omitted words are highlighted correctly',()=>{
 const r=highlight('children feel that they must','children feel they must');
 assert.match(r.answer,/<strong class="cloze-diff-word">that<\/strong>/);
 assert.doesNotMatch(r.expected,/<strong[^>]*>they/);
 const missing=highlight('children feel must','children feel they must');
 assert.match(missing.expected,/<strong class="cloze-diff-word">they<\/strong>/);
});
test('markup in answers is HTML escaped',()=>{
 const r=highlight('<img onerror=alert(1)>','actual answer');
 assert.doesNotMatch(r.answer,/<img/);
 assert.match(r.answer,/&lt;img/);
});

test('reordering intact coordination is yellow',()=>{
 for(const [student,original] of [
  ['learn about culture and history','learn about history and culture'],
  ['B and C and A','A and B and C'],
  ['C, A, and B','A, B, and C'],
  ['A and A and B','A and B and A']
 ]) assert.equal(classify(student,original).kind,'minor',student);
});
test('missing elements and altered relations are not yellow',()=>{
 for(const [student,original] of [
  ['A and B','A and B and C'],
  ['A and C','A and B'],
  ['Cats chase dogs','Dogs chase cats'],
  ['cats and dogs','cats but dogs']
 ]) assert.equal(classify(student,original).kind,'major',student);
});
test('original correction underlines capitalization and reordered list items',()=>{
 assert.match(highlight('Of Art','of Art').expected,/<strong class="cloze-diff-word">of<\/strong>/);
 const r=highlight('learn about culture and history','learn about history and culture');
 assert.match(r.expected,/cloze-diff-word/);
});
