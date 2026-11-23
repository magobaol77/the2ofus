// Partite automatiche tra bot (Node.js): node bot-sim.js [partite] [giocatori] [--random=1]
// Esempio: node bot-sim.js 20 2      -> 20 partite bot contro bot a 2 giocatori, con statistiche
const fs = require('fs'); const vm = require('vm');
function load() {
  const ctx = { console, Math, JSON, Date, Promise, setTimeout, module: undefined }; vm.createContext(ctx);
  for (const f of ['board-data.js', 'effects-data.js', 'card-logic.js', 'engine.js', 'bot-weights.js', 'bot.js', 'sim-core.js'])
    vm.runInContext(fs.readFileSync(__dirname + '/' + f, 'utf8').replace(/^const /gm, 'var ').replace(/^let /gm, 'var ').replace(/^'use strict';/m, ''), ctx, { filename: f });
  return ctx;
}
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
const N = +args[0] || 10, nP = +args[1] || 2;
const randomSeats = (flags.random || '').split(',').filter(Boolean).map(Number); // posti con giocatore casuale
async function playGame(ctx, seed, weightsBySeat) {
  ctx.Bot.weights = weightsBySeat || {};
  ctx.IO.log = () => { };
  ctx.IO.ask = async (pid, pr) => {
    if (randomSeats.includes(pid)) { // giocatore casuale (riferimento)
      if (pr.type === 'multi') return pr.options.slice(0, pr.min).map(o => o.value);
      if (pr.type === 'setup') return { keep: pr.options.slice(0, pr.keepN).map(o => o.value), family: 0 };
      if (pr.type === 'house') return Math.floor(Math.random() * pr.placements.length);
      const en = pr.options.filter(o => !o.disabled); const np = pr.turnMenu ? en.filter(o => o.value.t !== 'pass') : en;
      return (np.length ? np : en)[Math.floor(Math.random() * (np.length || en.length))].value;
    }
    return ctx.Bot.decide(pid, pr);
  };
  ctx.HISTORY.length = 0;
  ctx.newGame({ players: Array.from({ length: nP }, (_, i) => ({ name: 'Bot ' + (i + 1), ai: true })), seed });
  await ctx.runGame(20000);
  return vm.runInContext('G', ctx);
}
if (require.main === module) (async () => {
  const ctx = load(); const res = []; const t0 = Date.now();
  const cats = {};
  for (let g = 0; g < N; g++) {
    const G = await playGame(ctx, 1000 + g);
    if (G.phase !== 'over') { console.log('partita', g, 'non finita'); continue; }
    const tot = G.scores.breakdown.map(s => s.total);
    res.push({ rounds: G.round, tot, win: G.scores.ranking[0] });
    G.scores.breakdown.forEach((b, i) => { if (randomSeats.includes(i)) return; for (const k in b) cats[k] = (cats[k] || 0) + b[k]; });
    console.log('partita ' + (g + 1) + ': round ' + G.round + ', punti ' + tot.join(' / ') + ', vince Bot ' + (G.scores.ranking[0] + 1));
  }
  const n = res.length * (nP - randomSeats.length);
  console.log('\nMedia round: ' + (res.reduce((a, r) => a + r.rounds, 0) / res.length).toFixed(1));
  for (let i = 0; i < nP; i++) console.log('Media punti Bot ' + (i + 1) + (randomSeats.includes(i) ? ' (casuale)' : '') + ': ' + (res.reduce((a, r) => a + r.tot[i], 0) / res.length).toFixed(1));
  console.log('Vittorie per posto: ' + Array.from({ length: nP }, (_, i) => 'Bot ' + (i + 1) + ' ' + res.filter(r => r.win === i).length).join(', '));
  console.log('Punti medi per categoria: ' + Object.entries(cats).map(([k, v]) => k + ' ' + (v / n).toFixed(1)).join(', '));
  console.log('Tempo: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s, simulazioni ' + ctx.Bot.stats.rollouts);
})();
module.exports = { load, playGame };
