import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBalancedRound,challengePool,titleKey,Game} from '../public/core.js';
import {begin,transition} from '../public/ranking-engine.js';
const categories=JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url))).categories;
test('五關平均分配語言，多一題的語言輪流出現，題目與選項不重複',()=>{
 let seed=42;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
 const expected=[[10],[5,5],[3,3,4],[2,2,3,3],[2,2,3,3]];
 for(let level=0;level<5;level++){
  const extras=new Set();
  for(let i=0;i<80;i++){
   const round=createBalancedRound(challengePool(categories,level),random),counts={};
   assert.equal(new Set(round.map(q=>titleKey(q.answer.title))).size,10);
   for(const q of round){counts[q.answer.language]=(counts[q.answer.language]||0)+1;assert.equal(q.options.length,9);assert.equal(new Set(q.options.map(o=>titleKey(o.title))).size,9);assert.ok(q.options.every(o=>o.language===q.answer.language));}
   assert.deepEqual(Object.values(counts).sort((a,b)=>a-b),expected[level]);
   for(const [language,count] of Object.entries(counts))if(count===Math.max(...expected[level]))extras.add(language);
  }
  if(level>=2)assert.equal(extras.size,Math.min(level+1,4));
 }
 const game=new Game(challengePool(categories,1),undefined,createBalancedRound);assert.equal(game.questions.filter(q=>q.answer.language==='english').length,5);
 let s=begin('測試',categories,0);s={...s,phase:'result',passed:1,level:0};
 s=transition(s,{action:'next-level',runId:s.runId,revision:s.revision},categories,1);
 assert.equal(s.questions.filter(q=>q.answer.language==='english').length,5);
});
