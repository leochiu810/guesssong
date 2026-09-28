export const titleKey = value => value.normalize('NFKC').replace(/(?:\s*[（(\[][^()（）\[\]]*[）)\]])+\s*$/u, '').replace(/[^\p{L}\p{N}]/gu, '').toLocaleLowerCase();
export function shuffle(items, random = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
export function createRound(songs, random = Math.random) {
  const unique = [...new Map(songs.map(s => [titleKey(s.title), s])).values()];
  if (unique.length < 10) throw new Error('此分類題庫不足十首，請更新題庫。');
  return shuffle(unique, random).slice(0, 10).map(answer => ({answer, options: shuffle([answer, ...shuffle(unique.filter(s => titleKey(s.title) !== titleKey(answer.title)), random).slice(0, 8)], random)}));
}
export function score(elapsed, correct) { return correct ? Math.max(0, 100 - 3 * Math.ceil(Math.max(0, elapsed) / 1000)) : 0; }
export class Game {
  constructor(songs, now = () => performance.now()) { this.questions = createRound(songs); this.now = now; this.index = 0; this.answers = []; this.phase = 'ready'; }
  show() { if (this.phase !== 'ready') return false; this.started = this.now(); this.phase = 'question'; return true; }
  answer(id) {
    if (this.phase !== 'question' || !this.questions[this.index].options.some(s => s.id === id)) return null;
    this.phase = 'reveal';
    const correct = id === this.questions[this.index].answer.id;
    const result = {correct, points: score(this.now() - this.started, correct), selected: id};
    this.answers.push(result); return result;
  }
  next() { if (this.phase !== 'reveal') return false; this.index++; this.phase = this.index === 10 ? 'finished' : 'ready'; return true; }
  get total() { return this.answers.reduce((n, a) => n + a.points, 0); }
  get correct() { return this.answers.filter(a => a.correct).length; }
}
