import test from 'node:test';
import assert from 'node:assert/strict';
import {nickname} from '../public/ranking-engine.js';
import {validateResult} from '../supabase/functions/ranked-game/result.js';
test('暱稱前後端皆接受Emoji、膚色、旗幟及組合Emoji',()=>{
 for(const name of ['小明🎵','🐱貓王','👍🏽','🇹🇼','👨‍👩‍👧‍👦','❤️','😀'.repeat(16)]){
  assert.equal(nickname(name),name);
  assert.equal(validateResult({action:'submit',nickname:name,passed:1,total:100}).nickname,name);
 }
 for(const name of ['😀'.repeat(17),'<script>','小明\u202Eabc','a\nb','']){
  assert.throws(()=>nickname(name));
  assert.throws(()=>validateResult({action:'submit',nickname:name,passed:1,total:100}));
 }
});
