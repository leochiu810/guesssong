import test from 'node:test';
import assert from 'node:assert/strict';
import {bestByNickname} from '../public/ranking-ui.js';
test('排行榜同名合併：關數優先、總分其次、同分保留較早成績',()=>{
 const rows=[{nickname:'ann',passed:1,total:728,achieved_at:'2026-10-01T02:59:20Z'},{nickname:' ＡＮＮ ',passed:1,total:896,achieved_at:'2026-10-01T03:20:05Z'},{nickname:'Ann',passed:1,total:896,achieved_at:'2026-10-01T04:00:00Z'},{nickname:'bob',passed:2,total:700,achieved_at:'2026-10-01T04:00:00Z'}];
 assert.deepEqual(bestByNickname(rows),[rows[3],rows[1]]);assert.equal(rows.length,4);assert.deepEqual(bestByNickname(null),[]);
});

test('最高得分只顯示目前關卡，不加入前關',async()=>{const {highestScore}=await import('../public/ranking-ui.js');assert.equal(highestScore({total:800,stageScore:0}),0);assert.equal(highestScore({total:800,stageScore:600}),600);assert.equal(highestScore({total:1400,stageScore:600}),600);});
