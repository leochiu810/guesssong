import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Game, score, challengePool, createRound, titleKey, selectedPool, uniqueSongCount } from '../public/core.js';
const selection=JSON.parse(await readFile(new URL('../tools/spotify-selection.json',import.meta.url)));
const data = JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url)));
test('計分邊界：第一秒扣分、進位秒數、最低零分及答錯', () => {
  for (const [ms,expected] of [[0,100],[1,98],[999,98],[1000,98],[1001,96],[5000,90],[49000,2],[49001,0],[50000,0],[999999,0]]) assert.equal(score(ms,true),expected);
  assert.equal(score(0,false),0);
});
test('中文題庫與每局十題九選一，歌名不重複', () => {
  assert.deepEqual(data.categories.map(c=>c.code),['mandarin','english','japanese','korean']);
  for (const c of data.categories) {
    assert.ok(c.songs.length>=10);
    const artists = new Set(c.songs.map(s=>s.catalogArtist)); assert.equal(artists.size,selection.artists.filter(a=>a.language===c.code).length);
    for(const artist of artists){const expected=selection.artists.find(a=>a.name===artist || a.songs.some(track=>c.songs.some(song=>song.catalogArtist===artist && song.id===track.appleId)));assert.equal(c.songs.filter(s=>s.catalogArtist===artist).length,expected.songs.length);assert.ok(expected.songs.length<=expected.targetCount);}
    for (const song of c.songs) { assert.ok(song.id > 0); assert.ok(song.artist); assert.equal(song.language,c.code); assert.match(song.previewUrl,/^https:\/\//); assert.match(song.storeUrl,/^https:\/\/(music|itunes)\.apple\.com\//); }
    for (let i = 0; i < 100; i++) {
      const q = createRound(c.songs); assert.equal(q.length,10); assert.equal(new Set(q.map(x=>titleKey(x.answer.title))).size,10);
      for (const item of q) { assert.equal(item.options.length,9); assert.equal(new Set(item.options.map(x=>titleKey(x.title))).size,9); assert.equal(item.options.filter(x=>x.id === item.answer.id).length,1); }
    }
  }
});
test('重複點擊、不合法狀態、十題總分與正確題數', () => {
  let time = 0; const game = new Game(data.categories[0].songs,() => time);
  assert.equal(game.answer(1),null); assert.equal(game.next(),false);
  for (let i = 0; i < 10; i++) {
    assert.equal(game.show(),true); assert.equal(game.show(),false); time += i === 0 ? 7001 : 1000;
    const id = game.questions[i].answer.id;
    assert.equal(game.answer(-1),null); assert.ok(game.answer(id)); assert.equal(game.answer(id),null); assert.equal(game.next(),true); assert.equal(game.next(),false);
  }
  assert.equal(game.phase,'finished'); assert.equal(game.correct,10); assert.equal(game.total,966); assert.equal(game.answers.length,10);
});
test('不足題庫拒絕開始，版本歌名去重', () => {
  assert.equal(titleKey('Hello (Live)'), titleKey('Hello'));
  assert.throws(()=>createRound(data.categories[0].songs.slice(0,9)));
});


test('歌手篩選涵蓋所有配對，題目與干擾選項不混入未選歌手',()=>{
  const c=data.categories[0];
  assert.equal(selectedPool(c.songs,[]).length,0);
  for(const name of c.artists) {const pool=selectedPool(c.songs,[name]);assert.equal(pool.length,selection.artists.find(a=>a.name===name).songs.length);if(uniqueSongCount(pool)<10)assert.throws(()=>createRound(pool));else assert.equal(createRound(pool).length,10);}
  for(let a=0;a<c.artists.length;a++)for(let b=a+1;b<c.artists.length;b++){
    const names=[c.artists[a],c.artists[b]], pool=selectedPool(c.songs,names);
    if(uniqueSongCount(pool)<10){assert.throws(()=>createRound(pool));continue;}
    const round=createRound(pool);
    assert.equal(round.length,10);
    assert.equal(new Set(round.map(q=>titleKey(q.answer.title))).size,10);
    for(const q of round)for(const option of q.options)assert.ok(names.includes(option.catalogArtist));
  }
});

test('挑戰逐關累加語言，與分類排列順序無關',()=>{
 const expected=[['mandarin'],['mandarin','english'],['mandarin','english','japanese'],['mandarin','english','japanese','korean'],['mandarin','english','japanese','korean']];
 expected.forEach((languages,level)=>{
  const pool=challengePool([...data.categories].reverse(),level);
  assert.deepEqual(new Set(pool.map(s=>s.language)),new Set(languages));
  assert.equal(pool.length,data.categories.filter(c=>languages.includes(c.code)).reduce((n,c)=>n+c.songs.length,0));
 });
});

test('新增英文七組歌手均有七首可出題歌曲',()=>{
 const english=data.categories.find(c=>c.code==='english');
 for(const name of ['Harry Styles','Post Malone','SZA','Charlie Puth','Lauv','Jason Mraz','The Chainsmokers']){const source=selection.artists.find(a=>a.name===name);const display=english.songs.find(t=>source.songs.some(x=>x.appleId===t.id))?.catalogArtist;assert.ok(english.artists.includes(display));assert.equal(uniqueSongCount(selectedPool(english.songs,[display])),7);}
 assert.equal(english.artists.length,33);assert.equal(english.songs.length,230);
});

test('五關選項與答案同語言，九選一且歌名不重複',()=>{
 for(let level=0;level<5;level++)for(let run=0;run<30;run++){
  const round=createRound(challengePool(data.categories,level));
  assert.equal(new Set(round.map(q=>titleKey(q.answer.title))).size,10);
  for(const q of round){
   assert.equal(q.options.length,9);
   assert.equal(new Set(q.options.map(s=>titleKey(s.title))).size,9);
   assert.equal(q.options.filter(s=>s.id===q.answer.id).length,1);
   assert.ok(q.options.every(s=>s.language===q.answer.language));
  }
 }
});

test('新增中文十組歌手各七首，名稱別名不重複建立歌手',()=>{
 const chinese=data.categories.find(c=>c.code==='mandarin');
 for(const name of ["荷爾蒙少年","icyball 冰球樂團","溫室雜草 (Easy Weeds)","YELLOW黃宣","旺福 (Wonfu)","李千娜","鄧福如 AFÜ","陳芳語","陳綺貞","deca joins"]){assert.equal(chinese.artists.filter(a=>a===name).length,1);assert.equal(uniqueSongCount(selectedPool(chinese.songs,[name])),7);}
 assert.equal(chinese.artists.length,71);assert.equal(chinese.songs.length,511);
});

test('新增英文第二批七組：各七首且來源與語言完整',()=>{const english=data.categories.find(c=>c.code==='english');for(const name of ["Avril Lavigne","Avicii","One Direction","Gracie Abrams","OneRepublic","Linkin Park","Calum Scott"]){const songs=selectedPool(english.songs,[name]);assert.equal(uniqueSongCount(songs),7);assert.ok(songs.every(t=>t.language==='english'&&t.selectionType==='spotify-top'&&t.spotifyRank>=1&&t.spotifyRank<=10));}});
