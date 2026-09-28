import { Game } from './core.js';
const $ = id => document.getElementById(id);
let catalog, game, audio, tick, watchdog, advanceTimer, generation = 0, blocked = false, currentCategory;
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
  audio.onplaying = () => { if (token !== generation) return; clearTimeout(watchdog); $('audio-status').textContent = '正在播放 Apple 歌曲試聽'; };
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
  }, 800);
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
try {
  const response = await fetch('./data/catalog.json'); if (!response.ok) throw Error(); catalog = await response.json();
  if (catalog.categories.length !== 6 || catalog.categories.some(c => c.songs.length < 10)) throw Error();
  $('languages').replaceChildren(...catalog.categories.map(c => { const b = document.createElement('button'); b.className = 'language'; const text = document.createElement('span'); const name = document.createElement('strong'); name.textContent = c.name; const n = document.createElement('small'); n.textContent = `${c.songs.length} 首歌曲`; text.append(name,n); const arrow = document.createElement('span'); arrow.className = 'arrow'; arrow.textContent = '↗'; b.append(text,arrow); b.onclick = () => { try { currentCategory = c; game = new Game(c.songs); showQuestion(); } catch (error) { fail(error.message); } }; return b; }));
  $('load-status').textContent = `題庫更新：${catalog.generatedAt.slice(0,10)} · 點選分類開始`;
} catch { $('load-status').textContent = '題庫載入失敗，請重新整理。若從本機開啟，請先執行 npm start。'; }
