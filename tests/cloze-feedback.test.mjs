import test from 'node:test';
import assert from 'node:assert/strict';
import '../cloze-feedback.js';
const {classify,classifyWithContext,highlight}=globalThis.ClozeFeedback;
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
 assert.match(r.answer,/&lt;/);
 assert.match(r.answer,/&gt;/);
 assert.match(r.answer,/<strong class="cloze-diff-word">img<\/strong>/);
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
 assert.match(highlight('Of Art','of Art').expected,/<strong class="cloze-diff-char">o<\/strong>f Art/);
 const r=highlight('learn about culture and history','learn about history and culture');
 assert.match(r.expected,/cloze-diff-word/);
});

test('Only the mismatched capital I is bold and highlighted in a cloze original',()=>{
 const r=highlight('via the internet, which is why','via the Internet, which is why');
 assert.match(r.expected,/via the <strong class="cloze-diff-char">I<\/strong>nternet, which is why/);
 assert.doesNotMatch(r.expected,/cloze-diff-word.*Internet/);
});
test('Only the mismatched lowercase o in of Art is emphasized',()=>{
 const r=highlight('Of Art','of Art');
 assert.match(r.expected,/<strong class="cloze-diff-char">o<\/strong>f Art/);
});
test('Reordered list words remain highlighted',()=>{
 const r=highlight('culture and history','history and culture');
 assert.match(r.expected,/<strong class="cloze-diff-word">history<\/strong>/);
 assert.match(r.expected,/<strong class="cloze-diff-word">culture<\/strong>/);
});

test('A reordered list with duplicated visible trailing word is minor (yellow)',()=>{
 const expected='experience culture and history, it';
 const typed='experience history and culture, it seems';
 const c=classifyWithContext(typed,expected,'',' seems logical to reevaluate');
 assert.equal(classify(typed,expected).kind,'major');
 assert.equal(c.kind,'minor');
 assert.equal(c.comparedAnswer,'experience history and culture, it');
 assert.equal(c.overlap.after,1);
});
test('A repeated boundary word is minor only if remaining content is exact or minor',()=>{
 assert.equal(classifyWithContext('learn about museums museums','learn about museums','',' museums are important').kind,'minor');
 assert.equal(classifyWithContext('experience history and it seems','experience culture and history, it','',' seems logical').kind,'major');
 assert.equal(classifyWithContext('experience history and culture, it seems','experience culture and history, it','',' is logical').kind,'major');
 assert.equal(classifyWithContext('experience history and culture, they seems','experience culture and history, it','',' seems logical').kind,'major');
});
test('Same words in new order are still yellow without boundary repeats',()=>{
 assert.equal(classifyWithContext('B and C and A','A and B and C','','').kind,'minor');
 assert.equal(classifyWithContext('B and C','A and B and C','','').kind,'major');
});

test('Correct word ones is never marked when only its following comma differs',()=>{
 const r=highlight('museums, especially small, provincial ones,','museums, particularly small, provincial ones');
 assert.match(r.expected,/<strong class="cloze-diff-word">particularly<\/strong>/);
 assert.doesNotMatch(r.expected,/<strong[^>]*>ones/);
 assert.doesNotMatch(r.answer,/<strong class="cloze-diff-word">ones/);
 assert.match(r.answer,/ones<strong class="cloze-diff-char">,<\/strong>/);
});
test('Missing comma highlights punctuation alone, not adjacent correct word',()=>{
 const r=highlight('museums particularly small provincial ones','museums, particularly small, provincial ones');
 assert.doesNotMatch(r.expected,/<strong class="cloze-diff-word">(?:museums|small|ones)/);
 assert.match(r.expected,/museums<strong class="cloze-diff-char">,<\/strong>/);
});
test('Correct word stays unchanged when comma is present only in original',()=>{
 const r=highlight('provincial ones','provincial ones,');
 assert.equal(r.expected,'provincial ones<strong class="cloze-diff-char">,</strong>');
 assert.equal(r.answer,'provincial ones');
});

test('Two missing adjacent internal letters are yellow, not red',()=>{
 const typed='an oversimplication to view it as';
 const original='an oversimplification to view it as';
 assert.equal(classify(typed,original).kind,'minor');
 assert.equal(classifyWithContext(typed,original,'','').kind,'minor');
 assert.match(highlight(typed,original).expected,/oversimpli<strong class="cloze-diff-char">fi<\/strong>cation/);
 assert.equal(classify('an oversimplification to view it as',original).kind,'exact');
});
test('Recognizes other conservative two-character omissions inside long words',()=>{
 assert.equal(classify('oversimplication','oversimplification').kind,'minor');
 assert.equal(classify('oversimplification','oversimplication').kind,'minor');
});
test('Preserves red for real meaning or grammatical changes',()=>{
 for(const [student,original] of [
  ['unhappy','happy'],['inefficient','efficient'],
  ['coffer','coffers'],['especially those','particularly those'],
  ['could propose','might propose'],['oversimplication to view it','oversimplification to view it as']
 ])assert.equal(classify(student,original).kind,'major',student);
});
test('No false error in unchanged words adjacent to a typo',()=>{
 const markup=highlight('an oversimplication to view it as','an oversimplification to view it as').expected;
 assert.doesNotMatch(markup,/<strong[^>]*>(an|to|view|it|as)<\/strong>/);
});
