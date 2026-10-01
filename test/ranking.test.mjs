import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {begin,transition,snapshot,nickname} from '../public/ranking-engine.js';
import {RankingClient,rankingConfigured} from '../public/ranking-client.js';
const categories=JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url))).categories;
const action=(s,type,extra={})=>({action:type,runId:s.runId,revision:s.revision,questionToken:s.questionToken,...extra});
function finish(s,correct=10){let now=s.openedAt;for(let i=0;i<10;i++){now+=1;const q=s.questions[s.index],selected=i<correct?q.answer.id:q.options.find(o=>o.id!==q.answer.id).id;s=transition(s,action(s,'answer',{selected,points:99999,total:99999}),categories,now);if(i<9){now+=2800;s=transition(s,action(s,'next'),categories,now);}}return s;}
test('排名由網站計分，畫面只揭曉已作答答案',()=>{
 let s=begin('玩家A',categories,1000);let view=snapshot(s);assert.equal(view.question.answer,undefined);assert.equal(view.history,undefined);assert.equal(view.question.options.length,9);assert.ok(view.question.options.every(o=>!('previewUrl' in o)));
 s=transition(s,action(s,'answer',{selected:s.questions[0].answer.id,points:100,total:5000}),categories,3501);
 assert.equal(s.stageScore,94);assert.equal(s.total,0);assert.equal(snapshot(s).question.result.points,94);
 assert.throws(()=>transition(s,action(s,'answer',{selected:s.questions[0].answer.id}),categories,4000));
 assert.throws(()=>transition(s,action(s,'next'),categories,6000));
 const next=transition(s,action(s,'next'),categories,6301);assert.equal(next.index,1);assert.equal(next.stageScore,94);assert.equal(snapshot(next).question.answer,undefined);
});
test('排名阻止過期／跨場次／跳關／無效答案，原始狀態不被修改',()=>{
 const s=begin('玩家',categories,0);assert.throws(()=>transition(s,{...action(s,'answer'),selected:-1},categories,1));assert.throws(()=>transition(s,{...action(s,'answer'),runId:'wrong'},categories,1));assert.throws(()=>transition(s,{...action(s,'answer'),revision:99},categories,1));assert.throws(()=>transition(s,action(s,'next-level'),categories,1));assert.throws(()=>transition(s,action(s,'next'),categories,7200001));assert.equal(s.answers.length,0);
});
test('排名五關累積上限與語言限制，失敗不能重試原關',()=>{
 let s=begin('玩家',categories,0);
 for(let level=0;level<5;level++){
  assert.equal(s.level,level);assert.ok(s.questions.every(q=>q.options.every(o=>o.language===q.answer.language)));
  assert.ok(s.questions.every(q=>['mandarin','english','japanese','korean'].slice(0,Math.min(level+1,4)).includes(q.answer.language)));
  s=finish(s);assert.equal(s.total,(level+1)*980);assert.equal(s.passed,level+1);
  if(level<4)s=transition(s,action(s,'next-level'),categories,s.answeredAt+2800);
 }
 assert.throws(()=>transition(s,action(s,'next-level'),categories,s.answeredAt+3000));
 let failed=finish(begin('玩家',categories,0),0);assert.equal(failed.passed,0);assert.equal(failed.total,0);assert.throws(()=>transition(failed,action(failed,'next-level'),categories,failed.answeredAt+3000));
 let stage2=finish(begin('玩家',categories,0));stage2=transition(stage2,action(stage2,'next-level'),categories,stage2.answeredAt+2800);stage2=finish(stage2,5);assert.equal(stage2.passed,1);assert.equal(stage2.total,1470);assert.throws(()=>transition(stage2,action(stage2,'next-level'),categories,stage2.answeredAt+2800));
 const restarted=begin('玩家',categories,stage2.answeredAt+3000);assert.equal(restarted.level,0);assert.equal(restarted.total,0);
});
test('暱稱驗證、未設定雲端不可用',()=>{assert.equal(nickname('  小明  '),'小明');for(const n of ['','<script>','a'.repeat(17)])assert.throws(()=>nickname(n));assert.equal(rankingConfigured({url:"",publishableKey:""}),false);assert.equal(rankingConfigured({url:'https://test.supabase.co',publishableKey:'public'}),true);});
test('排名客戶端重用玩家身分與更新登入憑證，只送完成成績',async t=>{
 const calls=[],storage=new Map(),config={url:'https://test.supabase.co',publishableKey:'public'};
 const client=new RankingClient(config,{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)});
 t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.includes('/signup')||url.includes('/token?')?{access_token:'user-token',refresh_token:'refresh',expires_in:3600}:{rows:[]}};});
 await client.submit({nickname:'玩家',passed:1,total:800});await client.submit({nickname:'玩家',passed:2,total:1600,questions:['private'],selected:123});assert.equal(calls.filter(c=>c.url.includes('/signup')).length,1);const body=JSON.parse(calls.at(-1).options.body);assert.deepEqual(body,{action:'submit',nickname:'玩家',passed:2,total:1600});
 client.session.expires_at=0;await client.authenticate();assert.ok(calls.at(-1).url.includes('grant_type=refresh_token'));
 const second=new RankingClient(config,{getItem:k=>storage.get(k)});await second.authenticate();assert.equal(calls.filter(c=>c.url.includes('/signup')).length,1);
});

