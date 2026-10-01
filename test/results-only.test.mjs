import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LocalRankedGame} from '../public/ranking-local.js';
import {validateResult} from '../supabase/functions/ranked-game/result.js';
const categories=JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url))).categories;
test('排名整關在本機運作，僅儲存完成結果，失敗可重試',async()=>{
 let now=0,fail=true;const sent=[];
 const game=new LocalRankedGame({claimName:async()=>{},submit:async result=>{sent.push(result);if(fail)throw Error('offline');return {saved:true};}},()=>categories,()=>now);
 let view=await game.command('start',null,{nickname:'玩家'});
 assert.deepEqual(game.pending,{nickname:'玩家',passed:1,total:0,cumulative:0});
 for(let i=0;i<10;i++){now+=1000;view=await game.command('answer',view,{selected:game.state.questions[i].answer.id});if(i<9){now+=2800;view=await game.command('next',view);}}
 assert.equal(sent.length,0);assert.equal(view.total,980);assert.equal(view.passed,1);
 await assert.rejects(()=>game.save());fail=false;await game.save();
 assert.deepEqual(sent,[{nickname:'玩家',passed:1,total:980,cumulative:980},{nickname:'玩家',passed:1,total:980,cumulative:980}]);
 view=await game.command('next-level',view);assert.equal(view.level,1);assert.equal(sent.length,2);assert.deepEqual(game.pending,{nickname:'玩家',passed:2,total:0,cumulative:980});
 for(let i=0;i<10;i++){now+=1000;const q=game.state.questions[i];view=await game.command('answer',view,{selected:i<6?q.answer.id:q.options.find(o=>o.id!==q.answer.id).id});if(i<9){now+=2800;view=await game.command('next',view);}}
 assert.deepEqual(game.pending,{nickname:'玩家',passed:2,total:588,cumulative:1568});await game.save();assert.equal(sent.at(-1).total,588);
});
test('結果端點驗證格式及範圍，不依賴任何歌曲',()=>{
 assert.deepEqual(validateResult({action:'submit',nickname:' 玩家 ',passed:1,total:800}),{nickname:'玩家',passed:1,total:800,cumulative:null});
 for(const fields of [{passed:6,total:5000},{passed:1,total:-1},{passed:0,total:5000},{passed:1.5,total:800},{passed:1,total:Infinity},{nickname:'<script>',passed:1,total:800}])assert.throws(()=>validateResult({action:'submit',nickname:'玩家',...fields}));
 assert.throws(()=>validateResult({action:'answer'}));
});

test('同暱稱可在不同玩家端開始，不預約或占用名稱',async()=>{
 const client={claimName:async()=>{throw Error('不應呼叫');}};
 for(let i=0;i<2;i++){const game=new LocalRankedGame(client,()=>categories,()=>0);const view=await game.command('start',null,{nickname:'玩家'});assert.equal(view.phase,'question');assert.equal(view.nickname,'玩家');}
});

test('總得分驗證與單關得分分開',()=>{assert.equal(validateResult({action:'submit',nickname:'玩家',passed:2,total:600,cumulative:1400}).cumulative,1400);for(const cumulative of [-1,599,1601,1.5])assert.throws(()=>validateResult({action:'submit',nickname:'玩家',passed:2,total:600,cumulative}));});
