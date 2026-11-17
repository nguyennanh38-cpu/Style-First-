import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeStates} from '../sync.mjs';
const essay=(id, progress={})=>({id,title:id,essay:'This is a model essay. '.repeat(15),question:'Discuss',createdAt:'2026-11-15T00:00:00Z',progress});
const state=(essays=[],deletedIds=[])=>({version:1,essays,selectedId:essays[0]?.id||null,deletedIds});
test('Combines unique essays and preserves the selected local essay',()=>{
 const a=state([essay('Arc'),essay('Shared')]),b=state([essay('Dia'),essay('Shared')]);
 const c=mergeStates(a,b);
 assert.equal(c.essays.length,3);
 assert.equal(c.selectedId,'Dia');
});
test('Preserves completed attempts from different browsers',()=>{
 const arc={history:[{at:'2026-11-15T01:00:00Z',score:80,complete:true}],session:{drafts:{0:'Arc answer'},results:{},current:0,updatedAt:'2026-11-15T01:00:00Z'}};
 const dia={history:[{at:'2026-11-15T02:00:00Z',score:100,complete:true}],session:{drafts:{0:'Dia answer'},results:{},current:0,updatedAt:'2026-11-15T02:00:00Z'}};
 const merged=mergeStates(state([essay('Same',{'5':arc})]),state([essay('Same',{'5':dia})]));
 assert.deepEqual(merged.essays[0].progress['5'].history.map(x=>x.score),[80,100]);
 assert.equal(merged.essays[0].progress['5'].session.drafts[0],'Dia answer');
 assert.equal(merged.essays[0].progress['5'].sessionBackups.length,1);
 assert.equal(merged.essays[0].progress['5'].sessionBackups[0].data.drafts[0],'Arc answer');
});
test('Repeated sync does not duplicate attempt history',()=>{
 const a=state([essay('Same',{'5':{history:[{at:'2026-11-15T01:00:00Z',score:80}],session:{drafts:{},results:{},current:0}}})]);
 const once=mergeStates(a,a),twice=mergeStates(once,a);
 assert.equal(twice.essays[0].progress['5'].history.length,1);
});
test('Deletion markers prevent reintroducing deleted essays',()=>{
 const merged=mergeStates(state([essay('Keep'),essay('Remove')]),state([essay('Keep')],['Remove']));
 assert.deepEqual(merged.essays.map(x=>x.id),['Keep']);
 assert.deepEqual(merged.deletedIds,['Remove']);
});
test('Empty cloud state can accept old browser data unchanged',()=>{
 const old={version:1,essays:[essay('Parental Pressure',{'5':{session:{drafts:{0:'A'},results:{},current:0},history:[{at:'2026-11-15T01:00:00Z',score:75,complete:true}]}})],selectedId:'Parental Pressure'};
 const merged=mergeStates(state(),old);
 assert.equal(merged.essays.length,1);
 assert.equal(merged.essays[0].progress['5'].history[0].score,75);
 assert.equal(merged.essays[0].progress['5'].session.drafts[0],'A');
});
