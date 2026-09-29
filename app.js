import { Game, selectedPool, uniqueSongCount } from './core.js?v=0.2.1';
const $ = id => document.getElementById(id);
let catalog, game, audio, tick, watchdog, advanceTimer, generation = 0, blocked = false, currentCategory;
let artistInputs = [];
const sections = ['home','game','result','failure'];
function screen(id) { sections.forEach(s => $(s).hidden = s !== id); }
function stop() { generation++; clearInterval(tick); clearTimeout(watchdog); clearTimeout(advanceTimer); blocked = false; $('unlock').hidden = true; if (audio) { audio.onended = audio.onerror = audio.onplaying = null; audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; } }
function fail(message) { stop(); game = null; $('failure-message').textContent = message; screen('failure'); }
function home() { stop(); game = null; screen('home'); }
function play() {
  if (!audio || game?.phase !== 'question') return;
  const token = generation;
  audio.play().then(() => { if (token !== generation) return; blocked = false; $('unlock').hidden = true; }).catch(error => {
    if (token !== generation || game?.phase !== 'question') return;
    if (error.name === 'NotAllowedError') { blocked = true; clearTimeout(watchdog); $('unlock').hidden = false; $('audio-status').textContent = '等待你點頁面啟用音訊'; }
    else if (error.name !== 'AbortError') fail('Apple 試聽無法播放，可能是網路或歌曲已下架。請稍後重試。');
  });
}
function showQuestion() {
  stop(); const token = generation; const q = game.questions[game.index];
  $('reveal').hidden = true; $('category').textContent = `${currentCategory.name} · 旋律挑戰`; $('progress').textContent = `第 ${game.index + 1} / 10 題`; $('correct').textContent = game.correct; $('bar').style.width = `${(game.index + 1) * 10}%`; $('timer').textContent = '0.0 秒';
  $('audio-status').textContent = '正在連接 Apple 試聽…'; $('song-link').href = q.answer.storeUrl;
  $('options').replaceChildren(...q.options.map(s => { const b = document.createElement('button'); b.textContent = s.title; b.dataset.id = s.id; b.onclick = () => answer(s.id); return b; }));
  screen('game'); game.show(); $('question').focus({preventScroll:true});
  tick = setInterval(() => { if (game?.phase === 'question') $('timer').textContent = `${((performance.now() - game.started) / 1000).toFixed(1)} 秒`; },100);
  audio = new Audio(); audio.preload = 'none'; audio.src = q.answer.previewUrl;
  audio.onplaying = () => { if (token !== generation) return; clearTimeout(watchdog); $('audio-status').textContent = ''; };
  audio.onwaiting = audio.onstalled = () => { if (token !== generation || game?.phase !== 'question' || blocked || document.hidden) return; clearTimeout(watchdog); $('audio-status').textContent = '試聽正在緩衝…'; watchdog = setTimeout(() => { if (token === generation) fail('試聽串流中斷，本局不計分。請確認網路後重試。'); },20000); };
  audio.onerror = () => { if (token === generation && game?.phase === 'question') fail('Apple 試聽載入失敗。本局已中止，不產生成績；請確認網路後重新開始。'); };
  audio.onended = () => { if (token === generation) $('audio-status').textContent = '試聽已結束，請選擇你聽到的歌名。'; };
  watchdog = setTimeout(() => { if (token === generation && !blocked) fail('試聽載入逾時。本局不計分，請確認網路後重試。'); },20000);
  play();
}
function answer(id) {
  const result = game?.answer(id); if (!result) return;
  const q = game.questions[game.index]; stop(); $('audio-status').textContent = '答案已揭曉';
  for (const b of $('options').children) { b.disabled = true; if (Number(b.dataset.id) === q.answer.id) { b.classList.add('right'); b.textContent = `✓ ${b.textContent}`; } else if (Number(b.dataset.id) === id) { b.classList.add('wrong'); b.textContent = `× ${b.textContent}`; } }
  $('correct').textContent = game.correct; $('answer-result').textContent = `${result.correct ? '答對了！' : '這次沒猜中'} 本題 ${result.points} 分`;
  $('answer-title').textContent = q.answer.title; $('answer-artist').textContent = q.answer.artist; $('reveal').hidden = false;
  const token = generation;
  advanceTimer = setTimeout(() => {
    if (token !== generation || !game?.next()) return;
    if (game.phase === 'finished') finish(); else showQuestion();
  }, 2800);
}
function finish() {
  stop(); $('final-score').textContent = game.total; $('final-correct').textContent = `答對 ${game.correct} / 10 題 · ${currentCategory.name}`;
  $('history').replaceChildren(...game.questions.map((q,i) => { const row = document.createElement('div'); row.className = 'history-row'; const a = document.createElement('a'); a.href = q.answer.storeUrl; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = `${i + 1}. ${q.answer.title} ↗`; const artist = document.createElement('small'); artist.textContent = q.answer.artist; a.append(artist); const points = document.createElement('span'); points.textContent = `${game.answers[i].correct ? '✓' : '×'} ${game.answers[i].points} 分`; row.append(a,points); return row; }));
  screen('result'); $('result').focus();
}
$('exit').onclick = home; $('again').onclick = home; $('recover').onclick = home;
function unlock(event) {
  if (!blocked || game?.phase !== 'question' || event.target.closest('button,a,summary') || (event.type === 'keydown' && event.key !== 'Enter')) return;
  const token = generation; clearTimeout(watchdog); watchdog = setTimeout(() => {if (token === generation) fail('啟用後仍無法載入試聽，請確認網路後重試。');},20000); play();
}
document.addEventListener('click',unlock); document.addEventListener('keydown',unlock);
document.addEventListener('visibilitychange',() => { if (game?.phase !== 'question' || !audio) return; if (document.hidden) audio.pause(); else play(); });
window.addEventListener('pagehide',home);
function chosenArtists() { return artistInputs.filter(input => input.checked).map(input => input.value); }
function updateSelection() {
  const names = chosenArtists();
  const count = uniqueSongCount(selectedPool(catalog.categories[0].songs, names));
  $('selection-status').textContent = `已選 ${names.length} 位歌手 · ${count} 個不同歌名${count < 10 ? '｜請至少選 2 位歌手，湊足 10 個不同歌名。' : ''}`;
  $('start-game').disabled = count < 10;
}
$('select-all').onclick = () => { artistInputs.forEach(input => input.checked = true); updateSelection(); };
$('select-none').onclick = () => { artistInputs.forEach(input => input.checked = false); updateSelection(); };
$('start-game').onclick = () => {
  if (!catalog) return;
  const names = chosenArtists();
  const songs = selectedPool(catalog.categories[0].songs, names);
  if (uniqueSongCount(songs) < 10) { updateSelection(); return; }
  try { currentCategory = {name: `中文 · ${names.length} 位歌手`}; game = new Game(songs); showQuestion(); }
  catch (error) { fail(error.message); }
};
try {
  const response = await fetch('./data/catalog.json', {cache: 'no-store'}); if (!response.ok) throw Error(); catalog = await response.json();
  if (catalog.categories.length !== 1 || catalog.categories.some(c => c.songs.length < 10)) throw Error();
  const category = catalog.categories[0];
  $('artists').replaceChildren(...category.artists.map(name => {
    const label = document.createElement('label'); label.className = 'artist-choice';
    const input = document.createElement('input'); input.type = 'checkbox'; input.value = name; input.checked = true;
    input.onchange = updateSelection; artistInputs.push(input);
    const text = document.createElement('span'); text.textContent = name;
    const count = document.createElement('small'); count.textContent = `${selectedPool(category.songs, [name]).length} 首`;
    label.append(input,text,count); return label;
  }));
  $('artist-picker').hidden = false; updateSelection();
  $('load-status').textContent = `題庫更新：${catalog.generatedAt.slice(0,10)} · 中文 ${category.songs.length} 筆歌曲`;
} catch { $('load-status').textContent = '題庫載入失敗，請重新整理。若從本機開啟，請先執行 npm start。'; }
