import test from 'node:test';
import assert from 'node:assert/strict';
import '../mistake-review.js';
const {build,answerMatches}=globalThis.MistakeReview;
test('No exercise appears for correctly reproduced text with curly/straight apostrophes',()=>{
 const r=build("Their children’s achievements were remarkable.","Their children's achievements were remarkable.");
 assert.equal(r.blanks.length,0);
});
test('An inserted optional that is reported without hiding correctly recalled words',()=>{
 const original="Parents may feel compelled to show off their children’s achievements to gain validation, inadvertently creating an environment where children feel they must constantly outperform their peers.";
 const learner="Parents may feel compelled to show off their children's achievements to gain validation, inadvertently creating an environment where children feel that they must constantly outperform their peers.";
 const r=build(original,learner);
 assert.equal(r.blanks.length,0);
 assert.deepEqual(r.extra,["that"]);
});
test('Missing multiword expressions turn into one cloze',()=>{
 const r=build('The culture of parental boasting, fueled by social media, further exacerbates this pressure.','The culture of parental boasting further exacerbates this pressure.');
 assert.equal(r.blanks.length,1);
 assert.equal(r.blanks[0].expected,'fueled by social media');
});
test('A substituted word is masked while the correct surrounding text remains visible',()=>{
 const r=build('Sharing household tasks can promote mutual respect.','Sharing household chores can promote mutual respect.');
 assert.deepEqual(r.blanks.map(x=>x.expected),['tasks']);
 assert.match(r.parts[0].text,/Sharing household $/);
});
test('A long essay creates local blanks rather than hiding the entire paragraph',()=>{
 const original=Array.from({length:30},(_,i)=>'Paragraph '+i+' includes carefully chosen words to explain the logic of an argument.').join('\n\n');
 const learner=original.replace('carefully chosen words','roughly chosen expressions').replace('an argument.','an essay.');
 const r=build(original,learner);
 assert.ok(r.blanks.length>=2);
 assert.ok(r.blanks.length<30);
 assert.equal(r.parts.map(p=>p.type==='text'?p.text:p.expected).join(''),original);
});
test('A correct cloze answer can use a straight apostrophe in place of a typographic apostrophe',()=>{
 assert.equal(answerMatches("children's achievements","children’s achievements"),true);
 assert.equal(answerMatches("children's accomplishment","children’s achievements"),false);
});

test('Insertions never hide neighboring correct expressions',()=>{
 const r=build('It is true that observable trends exist. Cultural and regional influences also play a significant role.','It is certainly true that observable trends exist. Cultural and regional influences and also play a significant role.');
 assert.equal(r.blanks.length,0);
 assert.deepEqual(r.extra,['certainly','and']);
});
test('Highlighted words and cloze blanks use exactly the same alignment',()=>{
 const original='Individuals may be less inclined towards impulsive purchases, regardless of age.';
 const r=build(original,'Individuals can may be less inclined towards impulsive purchases, irrespective of age.');
 assert.deepEqual(r.blanks.map(b=>b.expected),['regardless']);
 assert.deepEqual(r.errorWords.map(w=>original.slice(w.start,w.end)),['regardless']);
 assert.deepEqual(r.extra,['can','irrespective']);
});
