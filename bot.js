// Happy Family – automa (bot) che gioca con le regole complete.
// Per ogni scelta simula ogni opzione con il motore vero, dal punto in cui si trova,
// fino alla fine del turno, poi valuta lo stato risultante con una funzione a pesi.
// Le carte future vengono rimescolate nella simulazione: il bot non "vede" il mazzo.
'use strict';
const BOT_DEFAULT_WEIGHTS = {
  coin: 0.35, coinK: 40, income: 0.8, cardInc: 0.35, hand: 1.0, jolly: 0.7, icon: 0.22, distinct: 0.1,
  tree: 0.8, parkLead: 1.0, benefit: 1.8, culture: 0.45, stressHigh: 0.4,
  upJolly: 2, upPesca: 2, upMano: 1, kidCharge: 1, opp: 1, rPerMs: 2, noise: 0.05,
  // linee guida del designer (19/11): 0 = spente
  roomCell: 1.0,         // valore di una stanza per casella che copre (scelta delle carte da tenere/scartare/giocare)
  houseProg: 4,        // avanzamento verso la prossima area della casa completata
  chainTurns: 2,       // turni consecutivi simulati quando gli altri hanno passato
  targetRounds: 0,     // durata attesa della partita (round); 0 = solo dal ritmo osservato
  earlyIncome: 0,     // 1) nei primi round la rendita vale di più (testata: neutra, spenta)
  roomInc: 0.45,      // 2) stanze con rendita: valore per round rimanente
  dreamReady: 1.4,    // 3) Sogni realizzabili adesso (seguire i sogni)
  msProg: 0,          // 4) avanzamento verso la prossima milestone (testata: peggiora, spenta)
  msEarly: 0,         // 4) milestone collocate presto (testata: peggiora, spenta)
  parkDanger: 0.5,    // 5) parchi che l'avversario può chiudere e vincere
  iconConc: 0.12,     // 6) icone uguali sullo stesso lavoratore
  blockRisk: 0.5,     // 7) lavoratore forte ancora da piazzare (rischio di essere bloccato)
};
const Bot = {
  busy: false,
  weights: {},          // pesi per giocatore (pid -> oggetto); se assente usa i default
  maxRollouts: 90,
  stats: { decisions: 0, rollouts: 0, ms: 0 },
  base: null,           // pesi allenati scelti nel simulatore (localStorage), se presenti
  W(pid) { return Object.assign({}, BOT_DEFAULT_WEIGHTS, typeof BOT_TRAINED_WEIGHTS !== 'undefined' ? BOT_TRAINED_WEIGHTS : {}, this.base || {}, this.weights[pid] || {}); },
};

// ---------- valutazione dello stato ----------
function botRoundsLeft(w) {
  if (G.phase === 'over' || G.phase === 'final' || G.endTrigger != null) return 0;
  const mx = Math.max(...G.players.map(p => p.milestonesPlaced));
  const pace = mx > 0 ? Math.max(1, G.round / mx) : w.rPerMs; // round per milestone osservati finora
  let R = Math.max(0.5, Math.min(12, (6 - mx) * Math.min(4, pace)));
  // durata attesa di una partita giocata bene (umani: 6,5–7 round): evita il circolo vizioso "gioco lento → stimo partita lunga → costruisco economia"
  if (w.targetRounds) R = Math.min(R, Math.max(0.5, w.targetRounds + 0.5 - G.round));
  return R;
}
function botCardValue(p, c) {
  if (c.kind === 'dream') return 2;
  const d = cardData(c); const L = logicOf(c.name);
  let v = (typeof d.pv === 'number' ? d.pv : 0) + d.icone.length * 1.6 + (L.imm ? 1.5 : 0) + (L.rendita ? 2 : 0) + (L.end ? 2 : 0) + ((d.beneficio || (d.benefici || []).length) ? 1 : 0) - d.costo * 0.12;
  if (canPlay(p, c, 0)) v += 1;
  // stanze: valgono per le caselle che coprono (bonus e aree della casa → milestone), non per le icone
  if (c.kind === 'room') { const W = Bot.W(p.id); if (W.roomCell) v += (d.dim || 0) * W.roomCell + (p.msGot.house < 3 && d.dim > 0 ? W.roomCell : 0); }
  return v;
}
function botEvalPlayer(p, R, w) {
  const f = Math.min(1, R / 3);
  let v = liveScore(p);
  // denaro: valore decrescente di monete attuali + rendita futura (oltre una certa quota servono a poco)
  const early = 1 + (w.earlyIncome || 0) * Math.max(0, Math.min(1, (R - 3) / 5));
  const money = p.coins * Math.min(1, R / 1.5) + p.income * Math.min(R, 8) * w.income * early;
  v += w.coin * w.coinK * (1 - Math.exp(-money / w.coinK));
  const [d, s] = CARD_INCOME[p.cardInc]; v += (d - 0.5 * s) * R * w.cardInc;
  { // mano: valgono solo le carte entro il limite, le migliori; le altre verranno scartate
    const lim = handLimit(p);
    const hv = p.hand.map(c => c.kind === 'dream' ? 0.6 : (canPlay(p, c, 0) ? 1.3 : 0.8)).sort((a, b) => b - a).slice(0, lim);
    v += hv.reduce((a, b) => a + b, 0) * w.hand * f;
  }
  v += p.jolly * w.jolly * f;
  for (let k = 0; k < 2; k++) {
    const iw = iconsW(p, k);
    v += ICONS.reduce((a, i) => a + Math.min(5, iw[i]), 0) * w.icon * R;
    // 6) concentrare icone uguali sullo stesso lavoratore alza la forza delle azioni
    if (w.iconConc) v += ICONS.reduce((a, i) => { const n = Math.min(5, iw[i]); return a + n * (n - 1) / 2; }, 0) * w.iconConc * Math.min(R, 6);
  }
  // 2) stanze con rendita: producono a ogni fase di rendita
  if (w.roomInc) v += p.rooms.filter(c => logicOf(c.name).rendita).length * w.roomInc * Math.min(R, 8);
  // 3) Sogni: quanti se ne possono realizzare adesso (visibili o in mano) con dischi disponibili
  if (w.dreamReady && MEDAL_LEVELS.some(l => p.medals[l].some(Boolean))) {
    const names = G.dreams.filter(d => !Object.values(d.spots).includes(p.id)).map(d => d.card.name).concat(p.hand.filter(c => c.kind === 'dream').map(c => c.name));
    const ready = names.filter(n => bestDreamLevel(p, n) >= 0).length;
    v += Math.min(2, ready) * w.dreamReady * f;
  }
  // 4) milestone: avanzamento verso la prossima di ogni tipo, e quelle già collocate valgono di più presto
  if (w.msProg) {
    const prog = (steps, got, cur) => { if (got >= steps.length) return 0; const prev = got ? steps[got - 1] : 0; return Math.max(0, Math.min(1, (cur - prev) / (steps[got] - prev))); };
    v += (prog(MILESTONE_SOURCES.parks, p.msGot.parks, p.parksJoined) + prog(MILESTONE_SOURCES.house, p.msGot.house, areasCompleted(p)) + prog(MILESTONE_SOURCES.dreams, p.msGot.dreams, p.medalsPlaced.length)) * w.msProg * f;
  }
  if (w.msEarly) v += p.milestonesPlaced * w.msEarly * Math.min(1, R / 4);
  // aree della casa: quanto manca a completare l'area incompleta più avanti (vale di più vicino al completamento)
  if (w.houseProg && p.msGot.house < 3) {
    let best = 0;
    for (const t of ['B', 'G', 'V']) { let tot = 0, cov = 0; for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) if (houseType(p, r, c) === t) { tot++; if (p.house[r][c]) cov++; } if (tot && cov < tot) best = Math.max(best, cov / tot); }
    v += best * best * w.houseProg * f;
  }
  v += Math.max(distinctW(p, 0), distinctW(p, 1)) * w.distinct * R;
  for (const pk of G.parks.visible) {
    if (!pk) continue; const t = pk.trees[p.id] || 0; if (!t) continue;
    v += t * w.tree * f;
    const others = Object.entries(pk.trees).filter(([k]) => +k !== p.id).map(([, x]) => x);
    if (t >= Math.max(0, ...others)) v += PARK[pk.id].pv * w.parkLead * Math.min(1, totalTrees(pk) / PARK[pk.id].sogliaInaugurazione);
  }
  v += BENEFITS.filter(b => p.benefits[b]).length * w.benefit * f;
  v += p.culture * w.culture * f;
  v -= Math.max(0, p.stress - 12) * w.stressHigh * f;
  v += ((p.upgrades.jolly - 1) * w.upJolly + (p.upgrades.pesca - 1) * w.upPesca + (p.upgrades.mano - 1) * w.upMano) * f;
  if (p.famSlots.child2) v += p.kidCharges * w.kidCharge * f;
  return v;
}
// 5) parchi vicini alla chiusura dove guida un avversario; 7) lavoratore forte ancora libero
function botRisks(p, R, w) {
  let r = 0;
  // 5) un avversario può chiudere un parco e prendersi la carta con pochi alberi (in parità vince chi è di turno)
  if (w.parkDanger) for (const pk of G.parks.visible) {
    if (!pk) continue; const d = PARK[pk.id]; const rem = d.sogliaInaugurazione - totalTrees(pk);
    let worst = 0;
    for (const q of G.players) {
      if (q.id === p.id || G.passed.includes(q.id) || q.trees <= 0) continue;
      const others = Math.max(0, ...G.players.filter(o => o.id !== q.id).map(o => pk.trees[o.id] || 0));
      const need = Math.max(rem, others - (pk.trees[q.id] || 0), 1);
      if (need <= 2 && need <= q.trees) worst = Math.max(worst, need === 1 ? 1 : 0.6);
    }
    r += worst * w.parkDanger * (d.pv + 3);
  }
  if (w.blockRisk && G.phase === 'actions') {
    const others = G.players.filter(q => q.id !== p.id && !G.passed.includes(q.id)).length;
    for (let k = 0; k < 2; k++) {
      if (!p.workersAvail[k]) continue;
      let s = 0;
      for (const sd of G.spaceDefs) if (!G.spaces[sd.id]) for (const a of sd.actions) s = Math.max(s, a === 'DayOut' ? Math.floor(distinctW(p, k) / 2) : Math.min(5, iconsW(p, k)[a]));
      if (s >= 3) r += w.blockRisk * (s - 2) * others;
    }
  }
  return r;
}
function botEval(pid, w) {
  const R = botRoundsLeft(w);
  const me = botEvalPlayer(P(pid), R, w) - botRisks(P(pid), R, w);
  const others = G.players.filter(q => q.id !== pid).map(q => botEvalPlayer(q, R, w));
  return me - (others.length ? w.opp * Math.max(...others) : 0);
}

// ---------- politica rapida (usata dentro le simulazioni e per le scelte multiple) ----------
function botPolicy(pid, pr) {
  const p = P(pid);
  if (pr.type === 'multi') {
    const keep = /tenere|tieni/i.test(pr.title);
    const sc = pr.options.map((o, i) => ({ i, v: o.card ? botCardValue(p, o.card) : 0 }));
    sc.sort((a, b) => keep ? b.v - a.v : a.v - b.v);
    return sc.slice(0, pr.min).map(x => pr.options[x.i].value);
  }
  if (pr.type === 'house') return botHouseHeuristic(p, pr.placements);
  if (pr.type === 'setup') return { keep: botBestKeep(p, pr), family: 0 };
  const en = pr.options.map((o, i) => Object.assign({ i }, o)).filter(o => !o.disabled);
  if (!en.length) return pr.options[0].value;
  const t = pr.title || '';
  const pick = fn => { let best = en[0], bv = -1e9; for (const o of en) { const v = fn(o); if (v > bv) { bv = v; best = o; } } return best.value; };
  if (pr.turnMenu) {
    const np = en.filter(o => o.value.t !== 'pass'); if (!np.length) return en[0].value;
    return pick(o => { const v = o.value; if (v.t === 'hobby') return hobbyPrice(p) <= 2 ? 3.5 - hobbyPrice(p) * 0.5 : 1; if (v.t === 'coins') return 0.5; if (v.t !== 'place') return 0; return (v.a === 'DayOut' ? distinctW(p, v.w) / 2 : Math.min(5, iconsW(p, v.w)[v.a])) + 0.1; });
  }
  if (/carta da giocare/.test(t)) return pick(o => o.value === 'none' ? -5 : o.card ? botCardValue(p, o.card) : 0);
  if (/Sotto quale lavoratore/.test(t)) return pick(o => -distinctW(p, o.value));
  if (/Prendi una carta|Pesca|prendi una carta/.test(t)) return pick(o => o.value === 'deck' ? 2.5 : o.card ? botCardValue(p, o.card) - displayCost(p, o.value) * 0.35 : 0);
  if (/Upgrade/.test(t)) return pick(o => ({ jolly: 4, pesca: 3, mano: 2, verde: 1 }[o.value] || 0));
  if (/Azione Hobby/.test(t)) return pick(o => ({ medal: 6, play: 5, tree: 4, pick: 3, draw: 2, jolly: 1 }[HOBBY_MENU[o.value].id] || 0));
  if (/gettone Beneficio/.test(t)) return pick(o => /nuovo/.test(o.label) ? 2 : /girare/.test(o.label) ? 1 : 0);
  if (/disco medaglia/.test(t)) return pick(o => { const m = o.label.match(/da (\d+) PV/); return m ? +m[1] : 0; });
  if (/Sogno e livello/.test(t)) return pick(o => /oro/.test(o.label) ? 3 : /argento/.test(o.label) ? 2 : 1);
  if (pr.context === 'park') return pick(o => { const pk = G.parks.visible[o.value]; if (!pk) return 0; const mine = pk.trees[pid] || 0; return mine * 2 + totalTrees(pk) / PARK[pk.id].sogliaInaugurazione; });
  // sì/no e opzioni "rinuncia": preferisci agire
  return pick(o => (o.value === 'none' || o.value === -1 || o.value === 0 && o.label === 'No' || o.value === null || o.label === 'Basta' || o.label === 'No') ? -1 : 1 - o.i * 0.01);
}
function botBestKeep(p, pr) {
  return pr.options.map(o => ({ v: botCardValue(p, o.card), id: o.value })).sort((a, b) => b.v - a.v).slice(0, pr.keepN).map(x => x.id);
}
function botHouseHeuristic(p, placements) {
  let best = 0, bv = -1e9;
  placements.forEach((cells, i) => {
    let v = 0;
    for (const [y, x] of cells) {
      if (HOUSE_BONUS[p.board][y + ',' + x]) v += 2;
      for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const yy = y + dy, xx = x + dx; if (yy < 0 || yy > 5 || xx < 0 || xx > 5) v += 0.3; else if (p.house[yy][xx]) v += 0.5; }
    }
    if (v > bv) { bv = v; best = i; }
  });
  return best;
}

// ---------- simulazione ----------
function botHideFuture() {
  G.rngState = (Math.random() * 4294967296) >>> 0;
  shuffle(G.deck); shuffle(G.parks.stack);
}
async function botRollout(snap, before, k, cand, pid, title, w) {
  const realG = G, ra = IO.ask, ru = IO.update, rl = IO.log;
  let n = 0, ok = true;
  G = JSON.parse(snap); G._answers = []; G._decisions = 0;
  IO.update = () => { }; IO.log = () => { };
  IO.ask = (qpid, pr) => {
    const i = n++;
    if (i < k) return Promise.resolve(before[i]);
    if (i === k) { if (pr.title !== title) ok = false; botHideFuture(); return Promise.resolve(cand); }
    if (n > 600) return Promise.reject(new Error('bot: troppe richieste'));
    return Promise.resolve(botPolicy(qpid, pr));
  };
  let val = -1e9;
  try {
    await step();
    // se gli altri hanno passato, il turno successivo è ancora mio: continuo a simulare (pianificare 2–3 turni di fila)
    for (let t = 0; t < (w.chainTurns || 0) && ok && G.phase === 'actions'; t++) { const nx = nextActive(); if (!nx || nx.pid !== pid) break; await step(); }
    if (ok && n > k) val = botEval(pid, w);
  }
  catch (e) { val = -1e9; }
  finally { G = realG; IO.ask = ra; IO.update = ru; IO.log = rl; }
  Bot.stats.rollouts++;
  return val;
}
function botCandidates(pid, pr) {
  const p = P(pid);
  if (pr.type === 'setup') { const keep = botBestKeep(p, pr); return pr.families.map((f, i) => ({ keep, family: i })); }
  if (pr.type === 'house') {
    let idx = pr.placements.map((_, i) => i);
    if (idx.length > 40) { // preselezione euristica
      const sc = idx.map(i => { let v = 0; for (const [y, x] of pr.placements[i]) if (HOUSE_BONUS[p.board][y + ',' + x]) v++; return { i, v: v + Math.random() * 0.5 }; });
      idx = sc.sort((a, b) => b.v - a.v).slice(0, 40).map(x => x.i);
    }
    return idx;
  }
  const out = [];
  for (const o of pr.options) {
    if (o.disabled) continue;
    if (pr.turnMenu && o.value.t === 'place') {
      const base = o.value.a === 'DayOut' ? distinctW(p, o.value.w) : iconsW(p, o.value.w)[o.value.a];
      for (let j = 0; j <= jollyLeft(p) && (j === 0 || base + j <= (o.value.a === 'DayOut' ? 9 : 5)); j++) out.push(Object.assign({}, o.value, { j }));
    } else out.push(o.value);
  }
  return out;
}
Bot.decide = async function (pid, pr) {
  const t0 = Date.now(); Bot.stats.decisions++;
  if (pr.type === 'multi') return botPolicy(pid, pr);
  const cands = botCandidates(pid, pr);
  if (cands.length === 0) return botPolicy(pid, pr);
  if (cands.length === 1) return cands[0];
  const snap = HISTORY[HISTORY.length - 1];
  if (!snap) return botPolicy(pid, pr);
  const before = (G._answers || []).slice(); const k = before.length;
  const w = Bot.W(pid);
  const samples = cands.length <= 4 ? 3 : cands.length <= 12 ? 2 : 1;
  Bot.busy = true;
  let best = null, bv = -Infinity;
  try {
    for (const c of cands) {
      let s = 0; for (let r = 0; r < samples; r++) s += await botRollout(snap, before, k, c, pid, pr.title, w);
      const v = s / samples + Math.random() * w.noise;
      if (v > bv) { bv = v; best = c; }
    }
  } finally { Bot.busy = false; }
  Bot.stats.ms += Date.now() - t0;
  if (bv <= -1e8) return botPolicy(pid, pr); // simulazione fallita: ripiega sull'euristica
  return best;
};
try { const sw = typeof localStorage !== 'undefined' && localStorage.getItem('happyfamily.botweights'); if (sw) Bot.base = JSON.parse(sw); } catch (e) { }
if (typeof module !== 'undefined') module.exports = { Bot };
