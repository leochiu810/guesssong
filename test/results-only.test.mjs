import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LocalRankedGame} from '../public/ranking-local.js';
import {validateResult} from '../supabase/functions/ranked-game/result.js';
const categories=JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url))).categories;
test('排名整關在本機運作，僅儲存完成結果，失敗可重試',async()=>{
 let now=0,fail=true;const sent=[];
 const game=new LocalRankedGame({submit:async result=>{sent.push(result);if(fail)throw Error('offline');return {saved:true};}},()=>categories,()=>now);
 let view=await game.command('start',null,{nickname:'玩家'});
 await assert.rejects(()=>game.save());
 for(let i=0;i<10;i++){now+=1000;view=await game.command('answer',view,{selected:game.state.questions[i].answer.id});if(i<9){now+=2800;view=await game.command('next',view);}}
 assert.equal(sent.length,0);assert.equal(view.total,980);assert.equal(view.passed,1);
 await assert.rejects(()=>game.save());fail=false;await game.save();
 assert.deepEqual(sent,[{nickname:'玩家',passed:1,total:980},{nickname:'玩家',passed:1,total:980}]);
 view=await game.command('next-level',view);assert.equal(view.level,1);assert.equal(sent.length,2);
});
test('結果端點驗證格式及範圍，不依賴任何歌曲',()=>{
 assert.deepEqual(validateResult({action:'submit',nickname:' 玩家 ',passed:1,total:800}),{nickname:'玩家',passed:1,total:800});
 for(const fields of [{passed:6,total:5000},{passed:1,total:1},{passed:0,total:5000},{passed:1.5,total:800},{passed:1,total:Infinity},{nickname:'<script>',passed:1,total:800}])assert.throws(()=>validateResult({action:'submit',nickname:'玩家',...fields}));
 assert.throws(()=>validateResult({action:'answer'}));
});
