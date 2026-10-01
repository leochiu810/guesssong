import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const data = JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url)));
class Element {
  constructor(tag='div') {this.tag=tag;this.children=[];this.hidden=false;this.dataset={};this.style={};this.classList={add:()=>{}};this.textContent='';}
  append(...items) {this.children.push(...items);}
  replaceChildren(...items) {this.children=items;}
  focus() {}
  closest() {return ['button','a','summary'].includes(this.tag) ? this : null;}
}
test('介面自動換題整局、答案鎖定、重來、音訊受阻、錯誤及過期事件',async(t)=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let refreshScore;
  t.mock.method(globalThis,'setInterval',fn=>{refreshScore=fn;return 1;});
  t.mock.method(globalThis,'clearInterval',()=>{});
  let now = 0; t.mock.method(performance, 'now', () => now);
  const elements = new Map(); const handlers = {}; const windowHandlers = {}; const audios = [];
  let rejectAudio = false;
  globalThis.document = {hidden:false,getElementById:id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement:tag=>new Element(tag),addEventListener:(name,fn)=>handlers[name]=fn};
  globalThis.window = {addEventListener:(name,fn)=>windowHandlers[name]=fn};
  globalThis.fetch = async()=>({ok:true,json:async()=>data});
  globalThis.Audio = class {constructor(){audios.push(this);} play(){this.playCount=(this.playCount||0)+1;if(rejectAudio)return Promise.reject(Object.assign(new Error(),{name:'NotAllowedError'}));this.onplaying?.();return Promise.resolve();} pause(){} removeAttribute(){} load(){} };
  const get=id=>document.getElementById(id);
  await import('../public/app.js');
  assert.equal(get('artists').children.length,71);
  assert.equal(get('choose-chinese').disabled,false);
  get('choose-chinese').onclick(); assert.equal(get('library').hidden,false); assert.equal(get('home').hidden,true);
  get('back-languages').onclick(); assert.equal(get('home').hidden,false); assert.equal(get('library').hidden,true);
  get('choose-chinese').onclick();
  assert.equal(get('start-game').disabled,false);
  get('start-game').onclick();
  for(let i=0;i<10;i++){
    assert.equal(get('game').hidden,false); assert.equal(get('options').children.length,9);
    assert.equal(audios.length,1,'整局沿用首次點擊啟用的播放器');
    assert.equal(audios[0].playCount,i+1,'換題立即嘗試播放');
    if(i===0){
      assert.equal(audios[0].volume,1);
      get('volume').value='0';get('volume').oninput();assert.equal(audios[0].muted,true);assert.equal(get('volume-value').textContent,'靜音');
      get('volume').value='35';get('volume').oninput();assert.equal(audios[0].muted,false);
    }
    assert.equal(audios[0].volume,0.35,'立即生效，換題保留音量');
    const answer=data.categories.flatMap(c=>c.songs).find(s=>s.storeUrl===get('song-link').href);
    const button=get('options').children.find(b=>Number(b.dataset.id)===answer.id);
    assert.equal(get('live-score').textContent,i*98,'換題保留累積總分');
    now += 1; refreshScore();assert.equal(get('live-score').textContent,i*98,'作答前累積分數不隨時間扣減');
    button.onclick(); button.onclick();
    assert.equal(get('live-score').textContent,(i+1)*98,'作答後加上實得分數，重複點擊不重複累加');
    assert.equal(get('reveal').hidden,false); assert.ok(get('options').children.every(b=>b.disabled));
    t.mock.timers.tick(2799);
    assert.equal(get('reveal').hidden,false);
    t.mock.timers.tick(1);
  }
  assert.equal(get('result').hidden,false); assert.equal(get('final-score').textContent,980); assert.match(get('final-correct').textContent,/10 \/ 10/); assert.equal(get('history').children.length,10);
  get('again').onclick(); assert.equal(get('home').hidden,false);
  get('start-game').onclick();assert.equal(audios.at(-1).volume,0.35,'新的一局保留音量');get('options').children[0].onclick();
  get('exit').onclick();get('start-game').onclick();
  t.mock.timers.tick(2800);assert.equal(get('progress').textContent,'第 1 / 10 題');
  get('exit').onclick();
  rejectAudio=true;get('start-game').onclick();await Promise.resolve();await Promise.resolve();assert.equal(get('unlock').hidden,false);
  rejectAudio=false;handlers.click({type:'click',target:new Element()});await Promise.resolve();assert.equal(get('unlock').hidden,true);
  const oldError=audios.at(-1).onerror;get('exit').onclick();oldError();assert.equal(get('home').hidden,false);
  get('start-game').onclick();audios.at(-1).onerror();assert.equal(get('failure').hidden,false);assert.match(get('failure-message').textContent,/不產生成績/);
  get('recover').onclick();get('start-game').onclick();windowHandlers.pagehide();assert.equal(get('home').hidden,false);
  get('select-none').onclick();assert.equal(get('start-game').disabled,true);
  get('start-game').onclick();assert.equal(get('home').hidden,false);
  const labels=get('artists').children;
  labels[5].children[0].checked=true;labels[5].children[0].onchange();
  assert.equal(get('start-game').disabled,true);
  labels[16].children[0].checked=true;labels[16].children[0].onchange();
  assert.equal(get('start-game').disabled,false);
  const selected=[labels[5].children[0].value,labels[16].children[0].value];
  get('start-game').onclick();
  for(const b of get('options').children){assert.ok(data.categories[0].songs.some(s=>s.id===Number(b.dataset.id)&&selected.includes(s.catalogArtist)));}
  get('exit').onclick();assert.equal(labels[0].children[0].checked,false);assert.equal(labels[5].children[0].checked,true);
  get('select-all').onclick();assert.ok(labels.every(l=>l.children[0].checked));
  assert.equal(get('start-game').disabled,false);
  get('select-none').onclick();
  get('choose-challenge').onclick(); assert.equal(get('challenge').hidden,false);
  get('start-challenge').onclick(); assert.equal(get('exit').hidden,false);
  function completeRound(correctCount, stage = 1) {
    const allowed=['mandarin','english','japanese','korean'].slice(0,Math.min(stage,4));
    const pool=data.categories.filter(c=>allowed.includes(c.code)).flatMap(c=>c.songs);
    assert.equal(get('live-score').textContent,0,'挑戰新關與重試從零累積');
    for (let i=0;i<10;i++) {
      const answer=data.categories.flatMap(c=>c.songs).find(s=>s.storeUrl===get('song-link').href);
      assert.ok(pool.some(s=>s.id===answer.id));
      for(const option of get('options').children)assert.ok(pool.some(s=>s.id===Number(option.dataset.id)&&s.language===answer.language));
      const button=get('options').children.find(b=>(Number(b.dataset.id)===answer.id)===(i<correctCount));
      button.onclick(); assert.equal(get('live-score').textContent,Math.min(i+1,correctCount)*100); t.mock.timers.tick(2800);
    }
  }
  completeRound(4); assert.equal(get('final-score').textContent,400);
  assert.equal(get('next-level').hidden,true); assert.equal(get('retry-level').hidden,false);
  get('next-level').onclick(); assert.equal(get('result').hidden,false);
  get('retry-level').onclick(); assert.equal(get('progress').textContent,'第 1 / 10 題');
  completeRound(5,1);get('next-level').onclick();
  completeRound(5,2);assert.equal(get('final-score').textContent,500);
  assert.match(get('challenge-result').textContent,/未達 600 分.*從第一關/);
  assert.equal(get('next-level').hidden,true);
  get('next-level').onclick();assert.equal(get('result').hidden,false);
  get('retry-level').onclick();
  assert.equal(get('live-score').textContent,0);
  get('retry-level').onclick();assert.equal(get('progress').textContent,'第 1 / 10 題');
  for(let stage=1;stage<=5;stage++) {
    assert.equal(get('exit').hidden,false);
    completeRound(stage+4,stage);
    assert.equal(get('final-score').textContent,400+stage*100);
    assert.match(get('final-correct').textContent,new RegExp(`第 ${stage} / 5 關`));
    assert.equal(get('exit').hidden,true);
    assert.equal(get('retry-level').hidden,true);
    if(stage<5) {
      assert.equal(get('next-level').hidden,false);get('next-level').onclick();
      get('next-level').onclick(); assert.equal(get('progress').textContent,'第 1 / 10 題');
    }
  }
  assert.match(get('challenge-result').textContent,/五關全部通過/);
  assert.equal(get('next-level').hidden,true);get('next-level').onclick();assert.equal(get('result').hidden,false);
  get('again').onclick();get('start-challenge').onclick();assert.equal(get('progress').textContent,'第 1 / 10 題');
  get('exit').onclick();

});

