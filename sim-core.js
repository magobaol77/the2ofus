// Happy Family – partite tra automi, statistiche e allenamento dei pesi.
// Usato da simulatore.html (browser) e da bot-sim.js (Node).
'use strict';
const SIM = { stop: false };

async function simPlayGame(nP, seed, weightsBySeat) {
  Bot.weights = weightsBySeat || {};
  const saved = { ask: IO.ask, update: IO.update, log: IO.log };
  // nel browser: ogni ~40 ms si restituisce il controllo alla pagina, così Firefox/Chrome non la considerano bloccata
  // e il pulsante Ferma risponde subito (interrompe anche la partita in corso)
  let last = Date.now();
  const inBrowser = typeof window !== 'undefined';
  IO.ask = async (pid, pr) => {
    if (inBrowser && Date.now() - last > 40) { await new Promise(r => setTimeout(r, 0)); last = Date.now(); }
    if (SIM.stop) throw { abort: true };
    return Bot.decide(pid, pr);
  };
  IO.update = () => { }; IO.log = () => { };
  HISTORY.length = 0;
  try {
    newGame({ players: Array.from({ length: nP }, (_, i) => ({ name: 'Automa ' + (i + 1), ai: true, board: 'ABCD'[i] })), seed });
    await runGame(20000);
  } finally { IO.ask = saved.ask; IO.update = saved.update; IO.log = saved.log; }
  if (G.phase !== 'over') return null;
  return {
    seed, nP, rounds: G.round,
    scores: G.scores.breakdown.map(b => Object.assign({}, b)),
    ranking: G.scores.ranking.slice(),
    stats: JSON.parse(JSON.stringify(G.stats || {})),
    players: G.players.map(p => ({
      family: p.family, kids: p.kids.end + ' + ' + p.kids.inst,
      cards: allTableauCards(p).map(c => c.name), parks: p.parkCards.length,
      milestones: p.milestonesPlaced, coins: p.coins, income: p.income,
    })),
  };
}

function simNewStats() { return { games: 0, rounds: 0, roundsHist: {}, seatWins: {}, seatScore: {}, firstWins: 0, firstGames: 0, cats: {}, winCats: {}, loseCats: {}, margin: 0, cards: {}, families: {}, ms: {}, msFirst: 0, msLast: 0, msGames: 0, act: {}, hob: {} }; }
function simAddGame(S, g) {
  S.games++; S.rounds += g.rounds; S.roundsHist[g.rounds] = (S.roundsHist[g.rounds] || 0) + 1;
  const win = g.ranking[0]; const nP = g.scores.length;
  S.seatWins[win] = (S.seatWins[win] || 0) + 1;
  const st = g.stats || {};
  if (st.first != null) { S.firstGames++; if (st.first === win) S.firstWins++; }
  const mean = g.scores.reduce((a, b) => a + b.total, 0) / nP;
  const sorted = g.scores.map(b => b.total).sort((a, b) => b - a); S.margin += sorted[0] - (sorted[1] || 0);
  g.scores.forEach((b, i) => {
    S.seatScore[i] = (S.seatScore[i] || 0) + b.total;
    const tgt = i === win ? S.winCats : S.loseCats;
    for (const k in b) { S.cats[k] = (S.cats[k] || 0) + b[k]; tgt[k] = (tgt[k] || 0) + b[k]; }
    const pl = g.players[i]; const won = i === win ? 1 : 0;
    for (const c of pl.cards) { const e = S.cards[c] || (S.cards[c] = { played: 0, wins: 0, score: 0, adv: 0, round: 0, rn: 0 }); e.played++; e.wins += won; e.score += b.total; e.adv += b.total - mean; }
    const f = S.families[pl.family] || (S.families[pl.family] = { games: 0, wins: 0, score: 0, adv: 0 }); f.games++; f.wins += won; f.score += b.total; f.adv += b.total - mean;
  });
  for (const pc of st.played || []) { const e = S.cards[pc.name]; if (e) { e.round += pc.r; e.rn++; } }
  const ms = st.ms || [];
  if (ms.length) {
    S.msGames++; S.msFirst += ms[0].r;
    const per = {}; let sixth = null;
    for (const m of ms) { per[m.pid] = (per[m.pid] || 0) + 1; if (per[m.pid] === 6 && sixth == null) sixth = m.r; const e = S.ms[m.src] || (S.ms[m.src] = { n: 0, r: 0 }); e.n++; e.r += m.r; }
    S.msLast += sixth != null ? sixth : g.rounds;
  }
  for (const [tab, dst] of [['act', S.act], ['hob', S.hob]]) for (const k in (st[tab] || {})) for (const pid in st[tab][k]) dst[k] = (dst[k] || 0) + st[tab][k][pid];
}
function simSummary(S, nP) {
  const np = S.games * nP;
  const per = (o, d) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / d]));
  return {
    games: S.games, nP, avgRounds: S.rounds / S.games, roundsHist: S.roundsHist,
    avgScore: Object.values(S.seatScore).reduce((a, b) => a + b, 0) / np, margin: S.margin / S.games,
    firstRate: S.firstGames ? S.firstWins / S.firstGames : null,
    seatWins: Array.from({ length: nP }, (_, i) => S.seatWins[i] || 0),
    seatAvg: Array.from({ length: nP }, (_, i) => (S.seatScore[i] || 0) / S.games),
    cats: per(S.cats, np), winCats: per(S.winCats, S.games), loseCats: per(S.loseCats, Math.max(1, np - S.games)),
    ms: Object.entries(S.ms).map(([src, e]) => ({ src, perGame: e.n / S.games, round: e.r / e.n })).sort((a, b) => b.perGame - a.perGame),
    msFirst: S.msGames ? S.msFirst / S.msGames : null, msSixth: S.msGames ? S.msLast / S.msGames : null,
    act: Object.entries(S.act).map(([k, v]) => ({ k, perPlayer: v / np })).sort((a, b) => b.perPlayer - a.perPlayer),
    hob: Object.entries(S.hob).map(([k, v]) => ({ k, perPlayer: v / np })).sort((a, b) => b.perPlayer - a.perPlayer),
    cards: Object.entries(S.cards).map(([name, e]) => ({ name, played: e.played, playRate: e.played / np, winRate: e.wins / e.played, avgScore: e.score / e.played, adv: e.adv / e.played, round: e.rn ? e.round / e.rn : null })),
    families: Object.entries(S.families).map(([name, e]) => ({ name, games: e.games, winRate: e.wins / e.games, avgScore: e.score / e.games, adv: e.adv / e.games })),
  };
}

// ---------- allenamento: strategia evolutiva (1+1) ----------
// Lo sfidante = pesi del campione con piccole variazioni casuali. Giocano partite a coppie
// (stesso seme, posti scambiati); se lo sfidante fa meglio in modo netto, diventa il campione.
const TRAIN_KEYS = Object.keys(BOT_DEFAULT_WEIGHTS).filter(k => k !== 'noise');
function simMutate(w, sigma) {
  const out = Object.assign({}, w);
  const keys = TRAIN_KEYS.filter(() => Math.random() < 0.4);
  if (!keys.length) keys.push(TRAIN_KEYS[Math.floor(Math.random() * TRAIN_KEYS.length)]);
  // un peso a 0 (linea guida spenta) può essere riacceso con un valore piccolo: lo sfidante verrà messo alla prova
  for (const k of keys) out[k] = +((out[k] || 0.1) * Math.exp(sigma * (Math.random() * 2 - 1) * 1.7)).toFixed(4);
  return out;
}
async function simTrainStep(champ, opts, onGame) {
  const chall = simMutate(champ, opts.sigma || 0.25);
  let cw = 0, games = 0, diff = 0;
  for (let i = 0; i < opts.pairs && !SIM.stop; i++) {
    const seed = Math.floor(Math.random() * 1e9);
    for (const seat of [0, 1]) {
      const wb = {}; for (let s = 0; s < 2; s++) wb[s] = s === seat ? chall : champ;
      const g = await simPlayGame(2, seed, wb); if (!g) continue;
      games++; if (g.ranking[0] === seat) cw++;
      diff += g.scores[seat].total - g.scores[1 - seat].total;
      if (onGame) await onGame(g);
    }
  }
  const rate = games ? cw / games : 0;
  return { chall, rate, avgDiff: games ? diff / games : 0, accepted: games > 0 && rate >= (opts.threshold || 0.6) && diff > 0 };
}
if (typeof module !== 'undefined') module.exports = { SIM, simPlayGame, simNewStats, simAddGame, simSummary, simTrainStep };
