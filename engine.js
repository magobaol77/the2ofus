// Happy Family - motore di gioco (hot-seat). Richiede board-data.js, effects-data.js, card-logic.js
// L'interfaccia fornisce IO.ask(pid, prompt) -> Promise(valore) e IO.update()
'use strict';
let G = null;
const IO = { ask: null, update: () => {}, log: () => {} };
const UNDO = { undo: true };

// ---------- utilità ----------
function rng() { // mulberry32 con stato in G
  let t = (G.rngState += 0x6D2B79F5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
const PROF = {}, ROOM = {}, DREAM = {}, PARK = {}, FAMILY = {}, KIDE = {}, KIDI = {};
function indexData() {
  HF_DATA.professioni.forEach(c => PROF[c.nome] = c);
  HF_DATA.stanze.forEach(c => ROOM[c.nome] = c);
  HF_DATA.sogni.forEach(c => DREAM[c.nome] = c);
  HF_DATA.parchi.forEach(c => PARK[c.id] = c);
  HF_DATA.famiglie.forEach(c => FAMILY[c.nome] = c);
  HF_DATA.figliFinePartita.forEach(c => KIDE[c.nome] = c);
  HF_DATA.figliIstantanei.forEach(c => KIDI[c.nome] = c);
}
function cardData(c) { return c.kind === 'prof' ? PROF[c.name] : c.kind === 'room' ? ROOM[c.name] : DREAM[c.name]; }
function logicOf(name) { return CARD_LOGIC[name] || {}; }
function P(pid) { return G.players[pid]; }
// statistiche raccolte durante la partita (riepilogo finale e simulatore)
function ST() { return G.stats || (G.stats = { ms: [], act: {}, hob: {}, played: [], track: [], first: null }); }
function stCount(tab, k, pid) { const t = ST()[tab]; const e = t[k] || (t[k] = {}); e[pid] = (e[pid] || 0) + 1; }
function log(msg, pid) { const e = { r: G.round, msg: (pid != null ? P(pid).name + ': ' : '') + msg }; G.log.push(e); IO.log(e); }
async function ask(pid, prompt) {
  IO.update();
  const v = await IO.ask(pid, prompt);
  G._decisions = (G._decisions || 0) + 1;
  (G._answers = G._answers || []).push(v);
  return v;
}
async function choose(pid, title, options, extra = {}) {
  const opts = options.map((o, i) => typeof o === 'string' ? { label: o, value: i } : o);
  const enabled = opts.filter(o => !o.disabled);
  if (enabled.length === 1 && !extra.forceAsk) return enabled[0].value;
  if (enabled.length === 0) return null;
  return ask(pid, Object.assign({ type: 'choose', title, options: opts }, extra));
}
function cardName(c) { return c ? c.name : '?'; }

// ---------- setup ----------
function newGame(cfg) {
  indexData();
  const nP = cfg.players.length;
  G = {
    version: 1, nP, rngState: (cfg.seed != null ? cfg.seed : Math.floor(Math.random() * 1e9)) >>> 0,
    round: 0, phase: 'setup', log: [], uid: 1,
    players: [], deck: [], discard: [], display: new Array(7).fill(null),
    dreams: [], parks: { stack: [], visible: [], unused: [] },
    milestones: {}, spaces: {}, relaxTiles: [], turnOrder: [], turnPos: 0, passed: [],
    endTrigger: null, finalQueue: null, scores: null, cfg,
    stats: { ms: [], act: {}, hob: {}, played: [], track: [], first: null },
  };
  const board = nP === 2 ? 2 : 34;
  G.boardKey = board;
  for (const k of ['prosperity', 'knowledge', 'leisure']) {
    const def = MILESTONE_ROWS[board][k];
    G.milestones[k] = def.mult.map((m, i) => (nP === 3 && def.fourOnly && def.fourOnly.includes(i)) ? { pid: -1 } : null);
  }
  G.milestones.inf = [];
  G.spaceDefs = SPACES[nP];
  G.spaceDefs.forEach(s => G.spaces[s.id] = null);
  G.relaxTiles = RELAX_TILES.filter(t => nP >= t.min).map(t => t.vp).sort((a, b) => b - a);
  // mazzo
  const mk = (kind, name) => ({ uid: G.uid++, kind, name });
  HF_DATA.professioni.forEach(c => G.deck.push(mk('prof', c.nome)));
  HF_DATA.stanze.forEach(c => G.deck.push(mk('room', c.nome)));
  HF_DATA.sogni.filter(s => s.tipo === 'mazzo').forEach(c => G.deck.push(mk('dream', c.nome)));
  shuffle(G.deck);
  // sogni base
  const base = shuffle(HF_DATA.sogni.filter(s => s.tipo === 'base').map(s => s.nome));
  base.slice(0, nP === 4 ? 4 : 3).forEach(n => G.dreams.push({ card: mk('dream', n), spots: { oro: null, argento: null, bronzo: null } }));
  // parchi
  const byLv = [1, 2, 3].map(l => shuffle(HF_DATA.parchi.filter(p => p.livello === l).map(p => p.id)));
  const cnt = PARK_SETUP[nP];
  const stack = [];
  [2, 1, 0].forEach(i => stack.push(...byLv[i].slice(0, cnt[i])));
  G.parks.unused = byLv.map((l, i) => l.slice(cnt[i])).flat();
  G.parks.stack = stack; // l'ultima posizione e' la cima (livello 1)
  const nParks = nP === 2 ? 2 : 3; // in 2 giocatori il display ha solo 2 parchi
  for (let i = 0; i < nParks; i++) G.parks.visible.push(drawPark());
  // giocatori
  const boards = ['A', 'B', 'C', 'D'];
  cfg.players.forEach((pc, i) => { const np = newPlayer(i, pc.name, pc.board || boards[i]); np.ai = !!pc.ai; G.players.push(np); });
  G.turnOrder = shuffle(G.players.map(p => p.id));
  G.stats.first = G.turnOrder[0];
  refillDisplay();
}
function newPlayer(id, name, board) {
  return {
    id, name, board, color: PLAYER_COLORS[id], coins: 0, income: 8, cardInc: 0, culture: 0, stress: 13, hobby: HOBBY_START, jolly: 0, vp: 0,
    hand: [], workers: [[], []], rooms: [], house: Array.from({ length: 6 }, () => Array(6).fill(null)),
    upgrades: { pesca: 1, jolly: 1, mano: 1, verde: 1 }, benefits: { Viaggi: 0, Serenità: 0, Amici: 0 },
    medals: { oro: [true, true, true], argento: [true, true, true], bronzo: [true, true, true] }, medalsPlaced: [], medalsLoose: [],
    trees: 20, parkCards: [], parkBonus: {}, parksJoined: 0, msGot: { parks: 0, house: 0, dreams: 0, money: 0, culture: 0, stress: 0 },
    milestonesPlaced: 0, msRows: {}, allRowsDone: false, family: null, kids: { end: null, inst: null }, famSlots: { child1: false, child2: false, dog: false, cat: false },
    kidCharges: 0, relax: [], rewards: {}, chainsDone: {}, workersAvail: [true, true], jollyUsedTurn: 0, played: [], hobbyFree: false,
  };
}
function drawPark() { return G.parks.stack.length ? { id: G.parks.stack.pop(), trees: {} } : null; }

async function setupStep() {
  const nP = G.nP;
  log('Nuova partita: ' + G.players.map(p => p.name).join(', '));
  const fams = shuffle(HF_DATA.famiglie.map(f => f.nome));
  for (const p of G.players) {
    const dealt = [drawCard(), drawCard(), drawCard(), drawCard(), drawCard(), drawCard(), drawCard(), drawCard()].filter(Boolean);
    const two = [fams.pop(), fams.pop()];
    // un'unica schermata: 4 carte da tenere + famiglia
    const r = await ask(p.id, { type: 'setup', title: 'Scegli la Famiglia e le 4 carte da tenere', keepN: 4, families: two, options: dealt.map(c => ({ label: c.name, value: c.uid, card: c })) });
    dealt.forEach(c => r.keep.includes(c.uid) ? p.hand.push(c) : G.discard.push(c));
    p.family = two[r.family];
  }
  // coppie figli
  const ke = shuffle(HF_DATA.figliFinePartita.map(k => k.nome)), ki = shuffle(HF_DATA.figliIstantanei.map(k => k.nome));
  const pairs = []; for (let i = 0; i <= nP; i++) pairs.push({ end: ke[i], inst: ki[i] });
  for (const pid of G.turnOrder.slice().reverse()) {
    const idx = await choose(pid, 'Scegli una coppia di figli', pairs.map((pr, i) => ({ label: pr.end + ' + ' + pr.inst, value: i, kids: pr })), { forceAsk: true });
    P(pid).kids = pairs.splice(idx, 1)[0];
  }
  for (let i = 0; i < G.turnOrder.length; i++) {
    const p = P(G.turnOrder[i]);
    const f = FAMILY[p.family];
    p.coins += f.monete + i;
    log('Famiglia ' + p.family + ': ' + f.monete + ' monete' + (i ? ' (+' + i + ' per ordine di turno)' : ''), p.id);
    const fl = FAMILY_LOGIC[p.family] || {};
    if (fl.start) await applyOps(p, fl.start, { src: p.family });
  }
  G.phase = 'income'; G.round = 1;
}

// ---------- mazzo e display ----------
function drawCard() {
  if (!G.deck.length) { if (!G.discard.length) return null; G.deck = shuffle(G.discard); G.discard = []; log('Mazzo rimescolato'); }
  return G.deck.pop();
}
function refillDisplay() {
  const cards = G.display.filter(Boolean);
  G.display = new Array(7).fill(null);
  cards.forEach((c, i) => G.display[i] = c);
  for (let i = 0; i < 7; i++) if (!G.display[i]) G.display[i] = drawCard();
}
function displayRange(p) { return DISPLAY.map((d, i) => p.culture >= d.cult ? i : -1).filter(i => i >= 0); }
function displayCost(p, i) { return p.upgrades.pesca >= 3 ? 0 : DISPLAY[i].cost; }

async function takeFromDisplayOrDeck(p, allowDisplay, label, cultureLimited) {
  const opts = [{ label: 'Pesca dal mazzo', value: 'deck' }];
  if (allowDisplay) for (const i of (cultureLimited ? displayRange(p) : DISPLAY.map((d, k) => k))) {
    const c = G.display[i]; if (!c) continue;
    const cost = displayCost(p, i);
    opts.push({ label: 'Display #' + (i + 1) + ': ' + c.name + ' (costo ' + cost + ')', value: i, card: c, disabled: p.coins < cost });
  }
  const v = await choose(p.id, label || 'Prendi una carta', opts);
  if (v === 'deck' || v == null) { const c = drawCard(); if (c) p.hand.push(c); return c; }
  const c = G.display[v]; p.coins -= displayCost(p, v); G.display[v] = null; p.hand.push(c);
  log('prende ' + c.name + ' dal display', p.id); return c;
}
async function opDraw(p, n, d) {
  for (let i = 0; i < n; i++) await takeFromDisplayOrDeck(p, p.upgrades.pesca >= 2, 'Pesca ' + (i + 1) + '/' + n, true);
  if (n) log('pesca ' + n + ' carte', p.id);
  if (d > 0) await discardCards(p, Math.min(d, p.hand.length), 'Scarta ' + d + ' carte');
}
async function discardCards(p, n, title, filter) {
  const cand = p.hand.filter(c => !filter || filter(c));
  if (n <= 0 || !cand.length) return [];
  n = Math.min(n, cand.length);
  const sel = await ask(p.id, { type: 'multi', title, min: n, max: n, options: cand.map(c => ({ label: c.name, value: c.uid, card: c })) });
  const out = [];
  for (const uid of sel) { const i = p.hand.findIndex(c => c.uid === uid); out.push(p.hand[i]); G.discard.push(p.hand.splice(i, 1)[0]); }
  log('scarta ' + out.map(c => c.name).join(', '), p.id);
  return out;
}
function handLimit(p) { return [4, 6, 8][p.upgrades.mano - 1] + (hasFlag(p, 'handLimit') ? 1 : 0); }

// ---------- icone e tableau ----------
function allTableauCards(p) { return p.workers[0].concat(p.workers[1], p.rooms); }
function iconsT(p) {
  const r = {}; ICONS.forEach(i => r[i] = 0);
  for (const c of allTableauCards(p)) for (const ic of cardData(c).icone) r[ic] = (r[ic] || 0) + 1;
  const fi = FAMILY_LOGIC[p.family] && FAMILY_LOGIC[p.family].icon; if (fi) r[fi]++;
  return r;
}
function iconsW(p, w) { const r = {}; ICONS.forEach(i => r[i] = 0); for (const c of p.workers[w]) for (const ic of PROF[c.name].icone) r[ic]++; return r; }
function distinctW(p, w) { const r = iconsW(p, w); return ICONS.filter(i => r[i] > 0).length; }
function benefitIcons(p, b) { let n = 0; for (const c of allTableauCards(p)) { const d = cardData(c); if (d.beneficio === b || (d.benefici || []).includes(b)) n++; } return n; }
function hasFlag(p, f) {
  for (const c of p.rooms) { const l = logicOf(c.name); if (l.flags && l.flags[f]) return l.flags[f]; }
  const fl = FAMILY_LOGIC[p.family]; if (fl && fl.flags && fl.flags[f]) return fl.flags[f];
  return false;
}
function costMod(p, type) {
  let m = 0;
  for (const c of p.rooms) { const l = logicOf(c.name); if (l.mods && l.mods[type]) m += l.mods[type]; }
  const fl = FAMILY_LOGIC[p.family]; if (fl && fl.mods && fl.mods[type]) m += fl.mods[type];
  return m;
}
function jollyMax(p) { return p.upgrades.jolly >= 2 ? 2 : 1; }
function jollyLeft(p) { return Math.min(p.jolly, jollyMax(p) - p.jollyUsedTurn); }
function countMilestones(p) { return p.milestonesPlaced; }
function housePlaced(p) { let n = 0; p.house.forEach(r => r.forEach(c => { if (c) n++; })); return n; }
function gardensCount(p) { let n = 0; p.house.forEach(r => r.forEach(c => { if (c && c.kind === 'garden') n++; })); return n; }

function leftOf(p) { return G.players[(p.id + 1) % G.players.length]; } // giocatore alla sinistra = posto successivo
function perCount(p, what, ctx) {
  if (what.startsWith('left:')) return perCount(leftOf(p), what.slice(5), {});
  const [k, arg] = what.split(':');
  switch (k) {
    case 'iconT': return iconsT(p)[arg] || 0;
    case 'iconW': return ctx.worker != null ? iconsW(p, ctx.worker)[arg] : Math.max(iconsW(p, 0)[arg], iconsW(p, 1)[arg]);
    case 'distinctW': return ctx.worker != null ? distinctW(p, ctx.worker) : Math.max(distinctW(p, 0), distinctW(p, 1));
    case 'rooms': return p.rooms.length;
    case 'profs': return p.workers[0].length + p.workers[1].length;
    case 'benefits': return BENEFITS.filter(b => p.benefits[b] > 0).length;
    case 'milestones': return countMilestones(p);
    case 'parksTrees': return G.parks.visible.filter(pk => pk && (pk.trees[p.id] || 0) > 0).length;
    case 'parkCards': return p.parkCards.length;
    case 'income': return p.income;
    case 'medalsOnDreams': return p.medalsPlaced.length;
    case 'medalsUsed': return p.medalsPlaced.length + p.medalsLoose.length;
    case 'pets': return (p.famSlots.dog ? 1 : 0) + (p.famSlots.cat ? 1 : 0);
  }
  return 0;
}
function evalCond(p, cond, ctx) {
  if (cond === 'stress>=16') return p.stress >= 16;
  if (cond === 'hasCat') return p.famSlots.cat;
  if (cond === 'hasDog') return p.famSlots.dog;
  if (cond === 'gardens>=2') return gardensCount(p) >= 2;
  if (cond === 'leftLessLeadership') return (iconsT(leftOf(p)).Leadership || 0) < (iconsT(p).Leadership || 0);
  if (cond === 'otherWorkerLessLeadership') { if (ctx.worker == null) return false; return iconsW(p, 1 - ctx.worker).Leadership < iconsW(p, ctx.worker).Leadership; }
  let m = cond.match(/^iconT:(\S+)>=(\d+)$/); if (m) return (iconsT(p)[m[1]] || 0) >= +m[2];
  return false;
}

// ---------- esecuzione ops ----------
const OP_ORDER = ['coins', 'income', 'cardInc', 'culture', 'stress', 'jolly', 'vp', 'benefit', 'upgrade', 'garden', 'tile', 'trees', 'treesEach', 'treesSplit', 'draw', 'pick', 'hobby', 'medal', 'doAction', 'playCard', 'family', 'milestone', 'relax'];
async function applyOps(p, ops, ctx = {}) {
  if (!ops) return;
  if (!Array.isArray(ops)) ops = [ops];
  for (const op of ops) await applyOp(p, op, ctx);
}
async function applyOp(p, op, ctx) {
  if (op.special) return SPECIALS[op.special](p, op, ctx);
  if (op.per) return opPer(p, op.per, ctx);
  if (op.repeat) return opRepeat(p, op.repeat, ctx);
  if (op.choice) {
    const i = await choose(p.id, 'Scegli', op.choice.map((o, i) => ({ label: describeOps(o), value: i })), { forceAsk: true });
    return applyOps(p, op.choice[i], ctx);
  }
  if (op.if) { if (evalCond(p, op.if.cond, ctx)) return applyOps(p, op.if.do, ctx); return; }
  for (const k of OP_ORDER) if (op[k] != null) await BASIC[k](p, op[k], ctx);
}
async function opPer(p, per, ctx) {
  let n = perCount(p, per.what, ctx);
  if (per.div) n = Math.floor(n / per.div);
  if (n <= 0) return;
  const hasChoice = per.do.some(o => o.choice || o.special || o.per || o.repeat);
  if (hasChoice) { for (let i = 0; i < n; i++) await applyOps(p, per.do, ctx); return; }
  for (const o of per.do) {
    const m = {};
    for (const k in o) m[k] = Array.isArray(o[k]) ? o[k].map(x => x * n) : (typeof o[k] === 'number' ? o[k] * n : o[k]);
    await applyOp(p, m, ctx);
  }
}
function canPayCost(p, cost) {
  if (cost.income) return p.income >= cost.income;
  if (cost.coins) return p.coins >= cost.coins;
  if (cost.jolly) return p.jolly >= cost.jolly;
  if (cost.discard === 'any') return p.hand.length >= (cost.count || 1);
  if (cost.discard === 'room') return p.hand.some(c => c.kind === 'room');
  if (cost.treeRemove) return G.parks.visible.some(pk => pk && (pk.trees[p.id] || 0) > 0);
  return true;
}
async function payCost(p, cost) {
  if (cost.income) p.income = Math.max(0, p.income - cost.income);
  if (cost.coins) p.coins -= cost.coins;
  if (cost.jolly) p.jolly -= cost.jolly;
  if (cost.stress) await moveStress(p, cost.stress);
  if (cost.discard === 'any') await discardCards(p, cost.count || 1, 'Scarta ' + (cost.count || 1) + ' carta/e');
  if (cost.discard === 'room') await discardCards(p, 1, 'Scarta 1 Stanza', c => c.kind === 'room');
  if (cost.treeRemove) {
    const opts = G.parks.visible.map((pk, i) => pk && (pk.trees[p.id] || 0) > 0 ? { label: 'Parco ' + pk.id + ' (' + pk.trees[p.id] + ' tuoi alberi)', value: i } : null).filter(Boolean);
    const i = await choose(p.id, 'Da quale parco togli un albero?', opts);
    G.parks.visible[i].trees[p.id]--; p.trees++;
  }
  if (cost.hobbyFwd) p.hobby += cost.hobbyFwd;
}
async function opRepeat(p, rep, ctx) {
  for (let i = 0; i < rep.n; i++) {
    if (!canPayCost(p, rep.cost)) return;
    const v = await choose(p.id, rep.label + (rep.n > 1 ? ' (' + (i + 1) + '/' + rep.n + ')' : '') + '?', [{ label: 'Sì', value: 1 }, { label: 'No', value: 0 }], { forceAsk: true });
    if (!v) return;
    await payCost(p, rep.cost);
    await applyOps(p, rep.do, ctx);
  }
}
const BASIC = {
  coins: async (p, n) => { p.coins = Math.max(0, p.coins + n); },
  income: async (p, n) => opIncome(p, n),
  cardInc: async (p, n) => { for (let i = 0; i < n; i++) { if (p.cardInc < CARD_INCOME.length - 1) p.cardInc++; else await opIncome(p, 1); } },
  culture: async (p, n) => opCulture(p, n),
  stress: async (p, n) => moveStress(p, n),
  jolly: async (p, n) => { p.jolly = Math.max(0, p.jolly + n); },
  vp: async (p, n) => { p.vp += n; },
  benefit: async (p, b) => gainBenefit(p, b),
  upgrade: async (p, n) => { for (let i = 0; i < n; i++) await doUpgrade(p); },
  garden: async (p, n) => { for (let i = 0; i < n; i++) await placeTile(p, { kind: 'garden', shape: '1' }); await fireHooks(p, 'gardenGain'); },
  tile: async (p, shape) => placeTile(p, { kind: 'tile', shape }),
  trees: async (p, n, ctx) => plantTrees(p, n),
  treesEach: async (p, n) => { for (let i = 0; i < G.parks.visible.length; i++) if (G.parks.visible[i]) await plantTrees(p, n, i); },
  treesSplit: async (p, n) => { for (let i = 0; i < n; i++) await plantTrees(p, 1); },
  draw: async (p, d) => opDraw(p, d[0], d[1]),
  pick: async (p, n) => { for (let i = 0; i < n; i++) await takeFromDisplayOrDeck(p, true, 'Prendi una carta dal display o pesca'); },
  hobby: async (p, n) => { p.hobby = Math.max(0, p.hobby + n); log('tracciato Hobby ' + (n < 0 ? 'indietro' : 'avanti') + ' di ' + Math.abs(n), p.id); },
  medal: async (p, lv, ctx) => lv === 'dream' || lv === 'dreamPlus' ? placeMedalOnDream(p, lv === 'dreamPlus') : takeLooseMedal(p, lv),
  doAction: async (p, icon, ctx) => {
    const s = Math.max(iconsW(p, 0)[icon], iconsW(p, 1)[icon]);
    log('svolge l\'azione ' + ACTIONS[icon].name + ' a forza ' + Math.min(5, s), p.id);
    await performAction(p, icon, iconsW(p, 0)[icon] >= iconsW(p, 1)[icon] ? 0 : 1, Math.min(5, s));
  },
  playCard: async (p, o, ctx) => playCardFlow(p, o.type, o.discount || 0, { optional: true, extraCtx: ctx }),
  family: async (p, n) => { for (let i = 0; i < n; i++) await familyEnlarge(p); },
  milestone: async (p, src) => gainMilestone(p, src),
  relax: async (p) => {
    if (!G.relaxTiles.length) return;
    const vp = G.relaxTiles.shift(); p.relax.push(vp); log('prende la tessera Relax da ' + vp + ' PV', p.id); await doUpgrade(p);
  },
};
function describeOps(ops) {
  if (!Array.isArray(ops)) ops = [ops];
  const parts = [];
  for (const o of ops) {
    if (o.coins) parts.push((o.coins > 0 ? '+' : '') + o.coins + ' monete');
    if (o.income) parts.push('+' + o.income + ' rendita');
    if (o.culture) parts.push('+' + o.culture + ' Cultura');
    if (o.stress) parts.push((o.stress > 0 ? '+' : '') + o.stress + ' Stress');
    if (o.jolly) parts.push('+' + o.jolly + ' jolly');
    if (o.benefit) parts.push('gettone ' + (o.benefit === 'any' ? 'Beneficio a scelta' : o.benefit));
    if (o.upgrade) parts.push('Upgrade');
    if (o.trees) parts.push(o.trees + ' alberi');
    if (o.garden) parts.push(o.garden + ' Giardino');
    if (o.pick) parts.push(o.pick + ' carta dal display');
    if (o.draw) parts.push('pesca ' + o.draw[0] + (o.draw[1] ? ' scarta ' + o.draw[1] : ''));
    if (o.vp) parts.push(o.vp + ' PV');
    if (o.cardInc) parts.push('+' + o.cardInc + ' rendita carte');
  }
  return parts.join(', ') || '—';
}
async function fireHooks(p, name, n = 1) {
  const srcs = [];
  for (const c of p.rooms) { const l = logicOf(c.name); if (l.hooks && l.hooks[name]) srcs.push([c.name, l.hooks[name]]); }
  const fl = FAMILY_LOGIC[p.family]; if (fl && fl.hooks && fl.hooks[name]) srcs.push([p.family, fl.hooks[name]]);
  for (const [src, ops] of srcs) for (let i = 0; i < n; i++) { log('effetto continuo di ' + src, p.id); await applyOps(p, ops, { src }); }
}

// ---------- tracciati ----------
async function opIncome(p, n) {
  if (n < 0) { p.income = Math.max(0, p.income + n); return; }
  if (n === 0) return;
  p.income += n;
  await fireHooks(p, 'incomeGainEach', n);
  if (n >= 2) await useKid(p, 'incomeGain2', 'Usa ' + p.kids.inst + ' (+3 PV e 4 monete)?', async () => { p.vp += 3; p.coins += 4; });
  await checkMilestones(p);
}
async function opCulture(p, n) {
  if (n <= 0) return;
  for (let i = 0; i < n; i++) {
    if (p.culture >= 13) { await opIncome(p, 1); continue; }
    p.culture++;
    const rw = CULTURE_REWARDS[p.culture];
    if (rw && !p.rewards['c' + p.culture]) {
      p.rewards['c' + p.culture] = true;
      if (rw.milestone) { p.msGot.culture = 1; await gainMilestone(p, 'Cultura 13'); }
      else await applyOps(p, rw, { src: 'Cultura' });
    }
  }
  await fireHooks(p, 'cultureAdvance');
  await useKid(p, 'cultureCoins', 'Usa ' + p.kids.inst + ' (' + p.culture + ' monete)?', async () => { p.coins += p.culture; });
}
async function moveStress(p, n) {
  if (!n) return;
  const dbl = hasFlag(p, 'doubleBars') ? 2 : 1;
  const dir = n > 0 ? 1 : -1;
  for (let i = 0; i < Math.abs(n); i++) {
    const s = p.stress;
    if (dir < 0 && s === 1) { await opIncome(p, 1); continue; }
    if (dir > 0 && s === 20) { p.income = Math.max(0, p.income - 1); continue; }
    const crossed = dir > 0 ? STRESS_BARS.includes(s) : STRESS_BARS.includes(s - 1);
    p.stress += dir;
    if (crossed) { if (dir > 0) p.income = Math.max(0, p.income - dbl); else await opIncome(p, dbl); }
    const rw = STRESS_REWARDS[p.stress];
    if (rw && !p.rewards['s' + p.stress]) {
      p.rewards['s' + p.stress] = true;
      if (rw.milestone) { p.msGot.stress = 1; await gainMilestone(p, 'Stress 1'); }
      else await applyOps(p, rw, { src: 'Stress' });
    }
  }
  if (n <= -2) await fireHooks(p, 'stressDown2');
  if (n > 0 && p.stress > 11) await useKid(p, 'stressSet11', 'Usa ' + p.kids.inst + ' per portare lo Stress a 11?', async () => { await moveStress(p, 11 - p.stress); });
}
async function useKid(p, trigger, question, fn) {
  if (!p.famSlots.child2 || p.kidCharges <= 0) return false;
  const kl = KID_INST_LOGIC[p.kids.inst]; if (!kl || kl.trigger !== trigger) return false;
  const v = await choose(p.id, question + ' (cariche: ' + p.kidCharges + ')', [{ label: 'Sì', value: 1 }, { label: 'No', value: 0 }], { forceAsk: true });
  if (!v) return false;
  p.kidCharges--; log('usa il potere di ' + p.kids.inst, p.id); await fn(); return true;
}

// ---------- benefici ----------
async function gainBenefit(p, b) {
  if (b === 'any') b = BENEFITS[await choose(p.id, 'Scegli un gettone Beneficio', BENEFITS.map((x, i) => ({ label: x + (p.benefits[x] === 2 ? ' (già girato)' : p.benefits[x] ? ' (da girare: 3 PV)' : ' (nuovo)'), value: i })), { forceAsk: true })];
  const was = p.benefits[b];
  let dancer = false;
  await useKid(p, 'benefitBonus', 'Usa ' + p.kids.inst + ' (6 monete' + (was ? '' : ' e gettone già girato') + ')?', async () => { p.coins += 6; dancer = true; });
  if (was === 0) { p.benefits[b] = dancer ? 2 : 1; log('ottiene il gettone ' + b, p.id); await activateChains(p, b); }
  else if (was === 1) { p.benefits[b] = 2; log('gira il gettone ' + b + ' (3 PV)', p.id); }
  await fireHooks(p, 'benefitGain');
}
async function activateChains(p, b) {
  for (const c of allTableauCards(p)) await tryChain(p, c, b);
}
async function tryChain(p, c, b) {
  const l = logicOf(c.name); if (!l.chain || !l.chain[b] || !p.benefits[b]) return;
  const key = c.uid + ':' + b; if (p.chainsDone[key]) return;
  p.chainsDone[key] = true;
  log('attiva l\'effetto catena di ' + c.name + ' (' + b + ')', p.id);
  const w = p.workers[0].includes(c) ? 0 : p.workers[1].includes(c) ? 1 : null;
  await applyOps(p, l.chain[b], { card: c, worker: w });
  await fireHooks(p, 'chainActivated');
}

// ---------- upgrade ----------
async function doUpgrade(p) {
  const opts = Object.keys(UPGRADES).map(k => ({ label: UPGRADES[k].name + ' (liv. ' + p.upgrades[k] + ' → ' + (p.upgrades[k] + 1) + '): ' + (UPGRADES[k].desc[p.upgrades[k]] || ''), value: k, disabled: p.upgrades[k] >= 3 }));
  if (opts.every(o => o.disabled)) return;
  const k = await choose(p.id, 'Sviluppa un Upgrade', opts, { forceAsk: true });
  let jump = false;
  if (p.upgrades[k] === 1) jump = await useKid(p, 'upgradeJump', 'Usa ' + p.kids.inst + ' per passare direttamente al livello 3?', async () => { });
  p.upgrades[k] = jump ? 3 : p.upgrades[k] + 1;
  log('sviluppa l\'Upgrade ' + UPGRADES[k].name + ' al livello ' + p.upgrades[k], p.id);
  await fireHooks(p, 'upgradeDone');
}

// ---------- residenza ----------
function orientations(shape) {
  const base = SHAPES[shape]; const res = []; const seen = new Set();
  for (let f = 0; f < 2; f++) for (let r = 0; r < 4; r++) {
    let cells = base.map(([y, x]) => [y, f ? -x : x]);
    for (let k = 0; k < r; k++) cells = cells.map(([y, x]) => [x, -y]);
    const my = Math.min(...cells.map(c => c[0])), mx = Math.min(...cells.map(c => c[1]));
    cells = cells.map(([y, x]) => [y - my, x - mx]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const key = JSON.stringify(cells); if (!seen.has(key)) { seen.add(key); res.push(cells); }
  }
  return res;
}
function validPlacements(p, shape, noAdj) {
  const out = []; const empty = housePlaced(p) === 0;
  for (const o of orientations(shape)) for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
    const cells = o.map(([y, x]) => [y + r, x + c]);
    if (cells.some(([y, x]) => y > 5 || x > 5 || p.house[y][x])) continue;
    if (empty && !noAdj) { if (!cells.some(([y, x]) => y === 5 && x === 0)) continue; }
    else if (!noAdj) { if (!cells.some(([y, x]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dy, dx]) => { const yy = y + dy, xx = x + dx; return yy >= 0 && yy < 6 && xx >= 0 && xx < 6 && p.house[yy][xx]; }))) continue; }
    out.push(cells);
  }
  // deduplica
  const seen = new Set(); return out.filter(cs => { const k = JSON.stringify(cs.slice().sort()); if (seen.has(k)) return false; seen.add(k); return true; });
}
function houseType(p, r, c) { return (p.board === 'C' ? HOUSE_TYPES_C : HOUSE_TYPES)[r][c]; }
function areaComplete(p, t) { for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) if (houseType(p, r, c) === t && !p.house[r][c]) return false; return true; }
function areasCompleted(p) { return ['B', 'G', 'V'].filter(t => areaComplete(p, t)).length; }
async function placeTile(p, tile, opts = {}) {
  const pl = validPlacements(p, tile.shape, opts.noAdj);
  if (!pl.length) { log('non c\'è spazio per piazzare ' + (tile.label || tile.kind), p.id); return null; }
  const idx = await ask(p.id, { type: 'house', title: 'Piazza ' + (tile.label || ({ garden: 'un Giardino', tile: 'una tessera stanza', dog: 'il Cane', cat: 'il Gatto' }[tile.kind] || tile.kind)), placements: pl });
  const cells = pl[idx];
  for (const [r, c] of cells) p.house[r][c] = { kind: tile.kind, name: tile.label || tile.kind, uid: tile.uid };
  // bonus coperti
  const mult = opts.mult || 1;
  for (const [r, c] of cells) {
    const b = HOUSE_BONUS[p.board][r + ',' + c]; if (!b) continue;
    const special = b.family || b.upgrade;
    const times = special ? 1 : mult;
    for (let i = 0; i < times; i++) { log('ottiene il bonus della casa: ' + (b.family ? 'Allargamento famiglia' : describeOps(b)), p.id); await applyOps(p, b, { src: 'casa' }); }
  }
  if (tile.kind === 'garden') await useKid(p, 'gardenConnected', 'Usa ' + p.kids.inst + ' (2 monete per Giardino collegato)?', async () => { p.coins += 2 * connectedGardens(p, cells[0]); });
  await checkMilestones(p);
  return cells;
}
function connectedGardens(p, [r0, c0]) {
  const seen = new Set(); const st = [[r0, c0]]; let n = 0;
  while (st.length) { const [r, c] = st.pop(); const k = r + ',' + c; if (seen.has(k)) continue; seen.add(k); if (r < 0 || r > 5 || c < 0 || c > 5) continue; const h = p.house[r][c]; if (!h || h.kind !== 'garden') continue; n++; st.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]); }
  return n;
}

// ---------- famiglia ----------
async function familyEnlarge(p) {
  const opts = Object.keys(FAMILY_SLOTS).map(k => {
    let dis = p.famSlots[k];
    if (!dis && k === 'dog') dis = !validPlacements(p, 'I2').length;
    if (!dis && k === 'cat') dis = !validPlacements(p, '1', true).length;
    const kidName = k === 'child1' ? p.kids.end : k === 'child2' ? p.kids.inst : '';
    return { label: FAMILY_SLOTS[k].label + (kidName ? ' – ' + kidName : '') + ' (Stress +' + (k.startsWith('child') && hasFlag(p, 'noKidStress') ? 0 : FAMILY_SLOTS[k].stress) + ')', value: k, disabled: dis };
  });
  if (opts.every(o => o.disabled)) { log('nessun Allargamento della famiglia disponibile', p.id); return; }
  const k = await choose(p.id, 'Allargamento della famiglia: chi arriva?', opts, { forceAsk: true });
  p.famSlots[k] = true;
  log('allarga la famiglia: ' + FAMILY_SLOTS[k].label, p.id);
  let st = FAMILY_SLOTS[k].stress; if (k.startsWith('child') && hasFlag(p, 'noKidStress')) st = 0;
  await moveStress(p, st);
  if (k === 'child2') { const kd = KIDI[p.kids.inst]; p.vp += kd.pv || 0; p.kidCharges = kd.cariche; }
  if (k === 'dog') await placeTile(p, { kind: 'dog', shape: 'I2', label: 'Cane' });
  if (k === 'cat') await placeTile(p, { kind: 'cat', shape: '1', label: 'Gatto' }, { noAdj: true, mult: 3 });
  if (k === 'dog' || k === 'cat') await fireHooks(p, 'petUnlocked');
}

// ---------- milestone ----------
async function checkMilestones(p) {
  const want = {
    parks: MILESTONE_SOURCES.parks.filter(t => p.parksJoined >= t).length,
    house: MILESTONE_SOURCES.house.filter(t => areasCompleted(p) >= t).length,
    dreams: MILESTONE_SOURCES.dreams.filter(t => p.medalsPlaced.length >= t).length,
    money: p.income >= MONEY_MILESTONE ? 1 : 0,
  };
  const names = { parks: 'parchi', house: 'aree della casa', dreams: 'Sogni realizzati', money: 'rendita denaro' };
  for (const k of Object.keys(want)) while (p.msGot[k] < want[k]) { p.msGot[k]++; await gainMilestone(p, names[k]); }
}
async function gainMilestone(p, src) {
  const def = MILESTONE_ROWS[G.boardKey];
  const opts = ['prosperity', 'knowledge', 'leisure'].map(k => {
    const i = G.milestones[k].findIndex(x => x === null);
    return { label: def[k].name + (i < 0 ? ' (riga completa: spazio ∞, ' + MILESTONE_INF_VP + ' PV)' : ' – spazio x' + def[k].mult[i] + ': ' + describeOps(def[k].bonus[i])), value: k };
  });
  const k = await choose(p.id, 'Milestone (' + src + '): scegli la riga', opts, { forceAsk: true, context: 'milestone' });
  const i = G.milestones[k].findIndex(x => x === null);
  p.milestonesPlaced++;
  ST().ms.push({ pid: p.id, src, r: G.round });
  p.msRows[k] = (p.msRows[k] || 0) + 1;
  if (i < 0) { G.milestones.inf.push(p.id); log('milestone (' + src + ') nello spazio ∞', p.id); }
  else { G.milestones[k][i] = { pid: p.id }; log('milestone (' + src + ') in ' + def[k].name + ' x' + def[k].mult[i], p.id); await applyOps(p, def[k].bonus[i], { src: 'milestone' }); }
  await fireHooks(p, 'milestone');
  if (!p.allRowsDone && ['prosperity', 'knowledge', 'leisure'].every(r => p.msRows[r])) { p.allRowsDone = true; await familyEnlarge(p); }
  if (p.milestonesPlaced >= 6 && G.endTrigger == null) { G.endTrigger = p.id; p.vp += 2; log('colloca la sesta milestone: la partita sta per finire (+2 PV)', p.id); }
}

// ---------- parchi ----------
function parseBonus(t) {
  const o = [];
  for (const part of t.split('+').map(s => s.trim()).filter(Boolean)) {
    let m;
    if ((m = part.match(/^(-?\d+) monet/))) o.push({ coins: +m[1] });
    else if ((m = part.match(/^(\d+) rendita denaro/)) || part.match(/^rendita denaro/)) o.push({ income: m ? +m[1] : 1 });
    else if ((m = part.match(/^(-?\d+) stress/))) o.push({ stress: +m[1] });
    else if ((m = part.match(/^(\d+) jolly/))) o.push({ jolly: +m[1] });
    else if ((m = part.match(/^(\d+) Giardino/))) o.push({ garden: +m[1] });
    else if ((m = part.match(/^(\d+) Cultura/)) || part.match(/^Cultura/)) o.push({ culture: m ? +m[1] : 1 });
    else if ((m = part.match(/^pesca (\d+)/))) o.push({ draw: [+m[1], 0] });
    else if ((m = part.match(/^(\d+) Upgrade/))) o.push({ upgrade: +m[1] });
    else if ((m = part.match(/^(\d+) PV/))) o.push({ vp: +m[1] });
    else if ((m = part.match(/^\+?(\d+) rendita/))) o.push({ income: +m[1] });
  }
  return o;
}
async function plantTrees(p, n, parkIdx) {
  if (n <= 0) return;
  if (await useKid(p, 'treesDouble', 'Usa ' + p.kids.inst + ' per raddoppiare gli alberi (' + n + ' → ' + 2 * n + ')?', async () => { })) n *= 2;
  n = Math.min(n, p.trees);
  if (n <= 0) { log('non ha più alberi', p.id); return; }
  if (parkIdx == null) {
    const opts = G.parks.visible.map((pk, i) => pk ? { label: 'Parco ' + pk.id + ' (liv. ' + PARK[pk.id].livello + ') – alberi: ' + totalTrees(pk) + '/' + PARK[pk.id].sogliaInaugurazione + ', tuoi ' + (pk.trees[p.id] || 0) + ', bonus ' + PARK[pk.id].sogliaPersonale + '+: ' + PARK[pk.id].bonus, value: i } : null).filter(Boolean);
    if (!opts.length) return;
    parkIdx = await choose(p.id, 'Pianta ' + n + ' alberi: scegli il parco', opts, { forceAsk: true, context: 'park' });
  }
  const pk = G.parks.visible[parkIdx]; if (!pk) return;
  pk.trees[p.id] = (pk.trees[p.id] || 0) + n; p.trees -= n;
  log('pianta ' + n + ' alberi nel parco ' + pk.id, p.id);
  if (n >= 3) await fireHooks(p, 'treesPlanted3');
  await checkPark(p, parkIdx);
}
function totalTrees(pk) { return Object.values(pk.trees).reduce((a, b) => a + b, 0); }
async function checkPark(p, idx) {
  const pk = G.parks.visible[idx]; if (!pk) return;
  const d = PARK[pk.id];
  if ((pk.trees[p.id] || 0) >= d.sogliaPersonale && !p.parkBonus[pk.id]) {
    p.parkBonus[pk.id] = true;
    await gainParkBonus(p, d);
  }
  // l'inaugurazione non è immediata: si controlla alla fine del turno del giocatore (si può superare la soglia)
}
async function endOfTurnParks(activePid) {
  for (let idx = 0; idx < G.parks.visible.length; idx++) {
    const pk = G.parks.visible[idx];
    if (pk && totalTrees(pk) >= PARK[pk.id].sogliaInaugurazione) await inaugurate(idx, activePid);
  }
}
async function gainParkBonus(p, d) {
  log('bonus personale del parco ' + d.id + ': ' + d.bonus, p.id);
  await applyOps(p, parseBonus(d.bonus), { src: 'parco' });
  await fireHooks(p, 'parkBonus');
}
// quando un giocatore ottiene una carta Parco (inaugurazione, Compost, Arborist, The Greenfields all'inizio)
async function parkWon(p, id) {
  await fireHooks(p, 'parkWon');
  await useKid(p, 'parkWonAgain', 'Usa ' + p.kids.inst + ' per ottenere di nuovo il bonus del parco ' + id + ' (' + PARK[id].bonus + ')?', async () => applyOps(p, parseBonus(PARK[id].bonus), { src: 'parco' }));
}
async function inaugurate(idx, activePid, forcedWinner) {
  const pk = G.parks.visible[idx]; if (!pk || !totalTrees(pk)) return;
  let winner = forcedWinner;
  if (winner == null) {
    const max = Math.max(...Object.values(pk.trees));
    const tied = Object.keys(pk.trees).map(Number).filter(k => pk.trees[k] === max);
    winner = tied.includes(activePid) ? activePid : G.turnOrder.find(k => tied.includes(k));
  }
  const w = P(winner);
  w.parkCards.push(pk.id);
  log('inaugura il parco ' + pk.id + ' e prende la carta (' + PARK[pk.id].pv + ' PV)', winner);
  G.parks.visible[idx] = drawPark();
  // per la milestone conta solo la carta Parco ottenuta (dal vincitore); partecipare dà solo il bonus personale
  w.parksJoined++;
  for (const k of Object.keys(pk.trees)) { P(+k).trees += pk.trees[k]; }
  await parkWon(w, pk.id);
  await checkMilestones(w);
}

// ---------- sogni e medaglie ----------
function dreamReq(p, name, jollyOk) {
  const d = DREAM[name]; const r = d.requisito; const it = iconsT(p);
  const extra = jollyOk && p.upgrades.jolly >= 3 ? jollyLeft(p) : 0;
  let m;
  if (r === 'Cultura') return { vals: [p.culture] };
  if (r === 'rendita denaro') return { vals: [p.income] };
  if (r.startsWith('Upgrade')) return { vals: [Object.values(p.upgrades).reduce((a, b) => a + b - 1, 0)] };
  if (r === 'Stanze') return { vals: [p.rooms.length] };
  if (r === 'Professioni') return { vals: [p.workers[0].length + p.workers[1].length] };
  if (r === 'Stress al massimo') return { vals: [p.stress], max: true };
  if (r.startsWith('icone Viaggi')) return { vals: [benefitIcons(p, 'Viaggi')] };
  if (r === 'icone Serenità') return { vals: [benefitIcons(p, 'Serenità')] };
  if (r === 'icone Amici') return { vals: [benefitIcons(p, 'Amici')] };
  if (r.startsWith('carte Parco')) return { vals: [p.parkCards.length] };
  if (r.startsWith('righe complete')) { let n = 0; for (let y = 0; y < 6; y++) if (p.house[y].every(Boolean)) n++; return { vals: [n] }; }
  if (r === 'gettoni Beneficio') return { vals: [BENEFITS.filter(b => p.benefits[b]).length] };
  if (r === 'icone diverse su un lavoratore') return { vals: [Math.max(distinctW(p, 0), distinctW(p, 1)) + extra] };
  if (r.startsWith('carte (Prof+Stanze) con costo <=5')) return { vals: [allTableauCards(p).filter(c => cardData(c).costo <= 5).length] };
  if (r.startsWith('carte con costo >=20')) return { vals: [allTableauCards(p).filter(c => cardData(c).costo >= 20).length] };
  if ((m = r.match(/^icone (\S+)$/))) return { vals: [it[m[1]] + extra] };
  if ((m = r.match(/^stesso lavoratore: (\S+) \+ (\S+)$/))) { const w0 = iconsW(p, 0), w1 = iconsW(p, 1); return { vals: [[w0[m[1]], w0[m[2]]], [w1[m[1]], w1[m[2]]]], pairs: true, extra }; }
  if ((m = r.match(/^(\S+) \+ (\S+)$/))) return { vals: [[it[m[1]], it[m[2]]]], pairs: true, extra };
  return { vals: [0] };
}
function dreamLevelOk(p, name, lv, jollyOk) {
  const th = DREAM[name].soglie[lv]; const q = dreamReq(p, name, jollyOk);
  if (q.pairs) {
    const [a, b] = th.split('+').map(Number);
    return q.vals.some(([x, y]) => { const need = Math.max(0, a - x) + Math.max(0, b - y); return need <= (q.extra || 0); });
  }
  if (q.max) return q.vals[0] <= +th;
  return q.vals[0] >= +th;
}
function bestDreamLevel(p, name) { for (let i = 0; i < 3; i++) if (dreamLevelOk(p, name, MEDAL_LEVELS[i], true)) return i; return -1; }
function anyDreamPossible(p) {
  const names = G.dreams.filter(d => !Object.values(d.spots).includes(p.id)).map(d => d.card.name).concat(p.hand.filter(c => c.kind === 'dream').map(c => c.name));
  return names.some(n => bestDreamLevel(p, n) >= 0) && MEDAL_LEVELS.some(l => p.medals[l].some(Boolean));
}
async function placeMedalOnDream(p, plus) {
  const cands = [];
  const sources = G.dreams.map((d, i) => ({ d, i, hand: false })).concat(p.hand.filter(c => c.kind === 'dream').map(c => ({ d: { card: c, spots: { oro: null, argento: null, bronzo: null } }, hand: true })));
  for (const s of sources) {
    const name = s.d.card.name;
    if (!s.hand && Object.values(s.d.spots).includes(p.id)) continue;
    let best = bestDreamLevel(p, name); if (best < 0) continue;
    if (plus) best = Math.max(0, best - 1);
    for (let li = best; li < 3; li++) {
      const lv = MEDAL_LEVELS[li];
      const occupied = s.d.spots[lv] != null;
      const hasDisc = MEDAL_LEVELS.slice(li).some(l => p.medals[l].some(Boolean));
      if (!hasDisc) continue;
      cands.push({ label: name + (s.hand ? ' (dalla mano)' : '') + ' – ' + lv + (occupied ? ' (occupato)' : ''), value: cands.length, s, lv, occupied, dream: name, fromHand: s.hand });
    }
  }
  const visionary = p.famSlots.child2 && p.kidCharges > 0 && KID_INST_LOGIC[p.kids.inst].trigger === 'medalUp';
  cands.forEach(c => { if (c.occupied && !visionary) c.disabled = true; });
  if (!cands.some(c => !c.disabled)) { log('nessun Sogno realizzabile', p.id); return; }
  const ci = await choose(p.id, 'Su quale Sogno e livello piazzi la medaglia?', cands, { forceAsk: true, context: 'dream' });
  const c = cands[ci];
  let lv = c.lv;
  if (c.occupied) { p.kidCharges--; log('usa ' + p.kids.inst, p.id); }
  else if (visionary && MEDAL_LEVELS.indexOf(lv) > 0) await useKid(p, 'medalUp', 'Usa ' + p.kids.inst + ' per salire di una riga?', async () => { lv = MEDAL_LEVELS[MEDAL_LEVELS.indexOf(lv) - 1]; });
  if (c.s.hand) { const i = p.hand.indexOf(c.s.d.card); p.hand.splice(i, 1); G.dreams.push(c.s.d); log('mette in gioco il Sogno ' + c.s.d.card.name, p.id); }
  const disc = await chooseDisc(p, lv);
  c.s.d.spots[lv] = p.id;
  p.medalsPlaced.push({ dream: c.s.d.card.name, level: lv, disc });
  log('piazza una medaglia su ' + c.s.d.card.name + ' (' + lv + '), disco da ' + disc.vp + ' PV', p.id);
  await applyOps(p, disc.b, { src: 'medaglia' });
  await fireHooks(p, 'medalPlaced');
  await checkMilestones(p);
}
async function chooseDisc(p, lv, exact) {
  const opts = [];
  (exact ? [lv] : MEDAL_LEVELS.slice(MEDAL_LEVELS.indexOf(lv))).forEach(l => p.medals[l].forEach((av, i) => { if (av) { const d = MEDAL_ROWS[p.board][l][i]; opts.push({ label: 'Disco ' + l + ' da ' + d.vp + ' PV – bonus: ' + describeOps(d.b), value: l + ':' + i }); } }));
  const v = await choose(p.id, 'Scegli il disco medaglia', opts, { forceAsk: true });
  const [l, i] = v.split(':'); p.medals[l][+i] = false;
  return Object.assign({ row: l, idx: +i }, MEDAL_ROWS[p.board][l][+i]);
}
async function takeLooseMedal(p, lv) {
  // solo dischi del livello indicato; se sono finiti non succede nulla. Non conta per le milestone.
  if (!p.medals[lv].some(Boolean)) { log('nessun disco medaglia ' + lv + ' disponibile', p.id); return; }
  const disc = await chooseDisc(p, lv, true);
  p.medalsLoose.push(disc);
  log('rimuove un disco medaglia (' + disc.row + ', ' + disc.vp + ' PV)', p.id);
  await applyOps(p, disc.b, { src: 'medaglia' });
  await fireHooks(p, 'medalPlaced'); // gli effetti "quando rimuovi una medaglia dalla plancia" valgono anche qui
}

// ---------- giocare carte ----------
function cardCost(p, c, discount, half) {
  const d = cardData(c);
  let base = d.costo; if (half) base = Math.ceil(base / 2);
  return Math.max(0, base - discount - costMod(p, c.kind));
}
function prereqMissing(p, c) {
  const d = cardData(c); if (!d.prereq || hasFlag(p, 'ignorePrereq')) return 0;
  if (d.prereq.icona) return Math.max(0, d.prereq.n - (iconsT(p)[d.prereq.icona] || 0));
  if (d.prereq.stress === '<10') return p.stress < 10 ? 0 : 99;
  if (d.prereq.stress === '>15') return p.stress > 15 ? 0 : 99;
  return 0;
}
function canPlay(p, c, discount) {
  if (c.kind === 'dream') return false;
  const miss = prereqMissing(p, c); if (miss > jollyLeft(p)) return false;
  const d = cardData(c);
  if (c.kind === 'room' && d.dim > 0 && !validPlacements(p, d.forma).length) return false;
  return p.coins >= cardCost(p, c, discount) || (c.kind === 'prof' && kidReady(p, 'profHalf') && p.coins >= cardCost(p, c, discount, true));
}
function kidReady(p, trig) { return p.famSlots.child2 && p.kidCharges > 0 && KID_INST_LOGIC[p.kids.inst].trigger === trig; }
async function playCardFlow(p, type, discount, opts = {}) {
  const pool = opts.cards || p.hand;
  const cand = pool.filter(c => (type === 'any' ? c.kind !== 'dream' : c.kind === type) && canPlay(p, c, discount));
  if (!cand.length) { log('nessuna carta giocabile', p.id); return null; }
  const choices = cand.map(c => ({ label: c.name + ' (costo ' + cardCost(p, c, discount) + ')', value: c.uid, card: c }));
  if (opts.optional) choices.push({ label: 'Non giocare', value: 'none' });
  const uid = await choose(p.id, 'Scegli la carta da giocare' + (discount ? ' (sconto ' + discount + ')' : ''), choices, { forceAsk: true });
  if (uid === 'none') return null;
  const c = cand.find(x => x.uid === uid);
  return playCard(p, c, discount, opts);
}
async function playCard(p, c, discount, opts = {}) {
  const d = cardData(c); const L = logicOf(c.name);
  // costo
  let cost = cardCost(p, c, discount);
  if (c.kind === 'prof' && kidReady(p, 'profHalf')) {
    const half = cardCost(p, c, discount, true);
    if (half < cost && await useKid(p, 'profHalf', 'Usa ' + p.kids.inst + ' (costo ' + half + ' invece di ' + cost + ')?', async () => { })) cost = half;
  }
  const miss = prereqMissing(p, c);
  if (miss) { p.jolly -= miss; p.jollyUsedTurn += miss; log('usa ' + miss + ' jolly per il requisito', p.id); }
  p.coins -= cost;
  const hi = p.hand.indexOf(c); if (hi >= 0) p.hand.splice(hi, 1);
  const di = G.display.indexOf(c); if (di >= 0) G.display[di] = null;
  let worker = null;
  if (c.kind === 'prof') {
    worker = await choose(p.id, 'Sotto quale lavoratore metti ' + c.name + '?', [0, 1].map(w => ({ label: 'Lavoratore ' + (w + 1) + ' (' + iconSummary(iconsW(p, w)) + ')', value: w })), { forceAsk: true });
    p.workers[worker].push(c);
  } else {
    p.rooms.push(c);
  }
  p.played.push(c.uid);
  ST().played.push({ pid: p.id, name: c.name, r: G.round });
  log('gioca ' + c.name + ' pagando ' + cost, p.id);
  const ctx = { card: c, worker };
  // piazzamento stanza
  let painter = 1;
  if (c.kind === 'room') {
    if (d.dim > 0) {
      const dbl = L.flags && L.flags.doubleCover ? 2 : 1;
      ctx.cells = await placeTile(p, { kind: 'room', shape: d.forma, label: c.name, uid: c.uid }, { mult: dbl });
    }
    if ((L.imm || L.rendita) && kidReady(p, 'roomDouble')) { if (await useKid(p, 'roomDouble', 'Usa ' + p.kids.inst + ' per raddoppiare l\'effetto di ' + c.name + '?', async () => { })) painter = 2; }
  }
  // icone guadagnate
  for (const ic of d.icone) await fireHooks(p, 'iconGain_' + ic);
  if (c.kind === 'room') await fireHooks(p, 'roomPlayed');
  for (let i = 0; i < painter; i++) {
    if (L.imm) await applyOps(p, L.imm, ctx);
    if (L.rendita) await applyOps(p, L.rendita, ctx);
  }
  if (L.chain) for (const b of Object.keys(L.chain)) await tryChain(p, c, b);
  await checkMilestones(p);
  return c;
}
function iconSummary(r) { return ICONS.filter(i => r[i]).map(i => ICON_EMOJI[i] + r[i]).join(' ') || 'nessuna icona'; }

// ---------- azioni ----------
async function useJollyForStrength(p, base) {
  const max = Math.min(jollyLeft(p), 5 - base);
  if (max <= 0) return 0;
  const opts = []; for (let i = 0; i <= max; i++) opts.push({ label: i ? 'Usa ' + i + ' jolly (forza ' + (base + i) + ')' : 'Nessun jolly (forza ' + base + ')', value: i });
  const n = await choose(p.id, 'Vuoi potenziare l\'azione con i jolly?', opts, { forceAsk: true });
  p.jolly -= n; p.jollyUsedTurn += n; return n;
}
async function performAction(p, key, worker, strength, virtualJolly = 0) {
  const A = ACTIONS[key];
  if (A.kind === 'dayout') {
    let s = strength;
    const row = A.rows.slice().reverse().find(r => s >= r.min);
    log('A Day Out (icone diverse: ' + s + ')', p.id);
    await applyOps(p, row.ops);
    await hobbyMenu(p);
    return;
  }
  const lv = Math.min(5, strength);
  if (A.kind === 'play') await playCardFlow(p, A.type, A.discount[lv], { optional: true });
  else if (A.kind === 'rows') await applyOps(p, A.rows[lv]);
  else if (A.kind === 'midnight') {
    const row = A.rows[lv];
    await moveStress(p, row.stress);
    if (row.coins) await BASIC.coins(p, row.coins);
    const used = [];
    for (const t of row.tiles) {
      const opts = MIDNIGHT_TILES[t].map((o, i) => ({ label: (t === 'gold' ? 'Oro: ' : 'Grigio: ') + o.label, value: i, disabled: used.includes(i) }));
      const i = await choose(p.id, 'Burning the Midnight Oil: scegli il bonus', opts, { forceAsk: true });
      used.push(i);
      await applyOps(p, MIDNIGHT_TILES[t][i].ops);
    }
  }
  await fireHooks(p, 'action_' + key);
}
async function hobbyMenu(p) {
  const opts = HOBBY_MENU.map((h, i) => ({ label: h.label, value: i,
    disabled: (h.id === 'play' && !p.hand.some(c => canPlay(p, c, 0))) || (h.id === 'medal' && !anyDreamPossible(p)) || (h.id === 'tree' && (!p.trees || !G.parks.visible.some(Boolean))) }));
  const i = await choose(p.id, 'Azione Hobby: scegli', opts, { forceAsk: true });
  log('azione Hobby: ' + HOBBY_MENU[i].label, p.id);
  stCount('hob', HOBBY_MENU[i].id, p.id);
  await applyOps(p, HOBBY_MENU[i].ops);
}
function hobbyPrice(p) { return Math.max(0, hobbyCost(p.hobby) - (hasFlag(p, 'hobbyDiscount') || 0)); }

async function playerTurn(p) {
  p.jollyUsedTurn = 0;
  const opts = [];
  const helper = kidReady(p, 'placeOccupied');
  for (let w = 0; w < 2; w++) if (p.workersAvail[w]) {
    for (const s of G.spaceDefs) {
      const occ = G.spaces[s.id];
      for (const a of s.actions) {
        const st = a === 'DayOut' ? distinctW(p, w) : iconsW(p, w)[a];
        opts.push({ label: 'Lavoratore ' + (w + 1) + ' → ' + ACTIONS[a].name + ' (forza ' + Math.min(st, a === 'DayOut' ? 9 : 5) + ')' + (occ ? ' [occupato]' : ''), value: { t: 'place', w, s: s.id, a }, disabled: !!occ && !helper, group: 'Piazza un lavoratore' });
      }
    }
    opts.push({ label: 'Lavoratore ' + (w + 1) + ' → prendi 2 monete', value: { t: 'coins', w }, group: 'Piazza un lavoratore' });
  }
  const hc = hobbyPrice(p);
  opts.push({ label: 'Hobby: avanza sul tracciato pagando ' + hc + ' e svolgi un\'azione Hobby', value: { t: 'hobby' }, disabled: p.coins < hc, group: 'Hobby' });
  opts.push({ label: 'Passa (fine del tuo round)', value: { t: 'pass' }, group: 'Passa' });
  const v = await choose(p.id, 'Il tuo turno', opts, { forceAsk: true, turnMenu: true });
  stCount('act', v.t === 'place' ? v.a : v.t, p.id);
  if (v.t === 'pass') { G.passed.push(p.id); log('passa', p.id); return; }
  if (v.t === 'coins') { p.workersAvail[v.w] = false; (G.coinsPlaced = G.coinsPlaced || []).push({ pid: p.id, w: v.w }); p.coins += 2; log('prende 2 monete', p.id); return; }
  if (v.t === 'hobby') {
    p.coins -= hc; p.hobby++; log('avanza sul tracciato Hobby pagando ' + hc, p.id);
    await hobbyMenu(p); return;
  }
  // piazzamento
  let virt = 0;
  if (G.spaces[v.s]) { p.kidCharges--; virt = 2; log('usa ' + p.kids.inst + ' per uno spazio occupato (+2 jolly virtuali)', p.id); G.spaceExtra = G.spaceExtra || []; G.spaceExtra.push({ pid: p.id, w: v.w, s: v.s }); }
  else G.spaces[v.s] = { pid: p.id, w: v.w };
  p.workersAvail[v.w] = false;
  const base = (v.a === 'DayOut' ? distinctW(p, v.w) : iconsW(p, v.w)[v.a]) + virt;
  let j;
  if (v.j != null) { j = Math.max(0, Math.min(v.j, jollyLeft(p))); p.jolly -= j; p.jollyUsedTurn += j; }
  else j = await useJollyForStrength(p, base);
  log('Lavoratore ' + (v.w + 1) + ' su ' + ACTIONS[v.a].name + ' (forza ' + (base + j) + ')', p.id);
  await performAction(p, v.a, v.w, base + j);
}

// ---------- fasi ----------
async function incomePhase() {
  if (G.round === 1) { log('— Round 1: nessuna fase di rendita —'); G.phase = 'actions'; G.passed = []; G.turnPos = 0; return; }
  log('— Round ' + G.round + ': fase di rendita —');
  for (const pid of G.turnOrder) {
    const p = P(pid);
    const s = await incomeSteps(p);
    if (s) await discardCards(p, Math.min(s, p.hand.length), 'Rendita carte: scarta ' + s + ' carte');
    const lim = handLimit(p);
    if (p.hand.length > lim) await discardCards(p, p.hand.length - lim, 'Limite della mano ' + lim + ': scarta ' + (p.hand.length - lim));
    await endOfTurnParks(pid);
    refillDisplay(); // il display si riempie alla fine del turno di ogni giocatore, anche in rendita
  }
  G.phase = 'actions'; G.passed = []; G.turnPos = 0;
}
// passi della rendita (monete, carte, Stanze) in ordine libero: si chiede solo se l'ordine può contare
function roomIncomeText(c) { const e = (cardData(c).effetti || []).find(x => x.tipo === 'rendita'); return e ? e.testo : ''; }
function incomeOrderMatters(rooms) { return rooms.some(c => /"(income|stress|culture|repeat)"/.test(JSON.stringify(logicOf(c.name).rendita))); }
async function incomeSteps(p) {
  const rooms = p.rooms.filter(c => logicOf(c.name).rendita);
  const steps = [{ k: 'coins' }, { k: 'draw' }].concat(rooms.map(c => ({ k: 'room', c })));
  const free = incomeOrderMatters(rooms);
  let discardN = 0;
  while (steps.length) {
    let i = 0;
    if (free && steps.length > 1) {
      const lab = st => st.k === 'coins' ? 'Incassa la rendita: ' + p.income + ' monete' : st.k === 'draw' ? 'Pesca ' + CARD_INCOME[p.cardInc][0] + ' carte (rendita carte, poi ne scarti ' + CARD_INCOME[p.cardInc][1] + ')' : 'Rendita di ' + st.c.name + ': ' + roomIncomeText(st.c);
      i = await choose(p.id, 'Fase di rendita: cosa risolvi adesso?', steps.map((st, j) => ({ label: lab(st), value: j })), { forceAsk: true });
    }
    const st = steps.splice(i, 1)[0];
    if (st.k === 'coins') { p.coins += p.income; log('rendita: ' + p.income + ' monete', p.id); }
    else if (st.k === 'draw') { const [d, s] = CARD_INCOME[p.cardInc]; discardN = s; await opDraw(p, d, 0); }
    else { log('rendita di ' + st.c.name, p.id); await applyOps(p, logicOf(st.c.name).rendita, { card: st.c }); }
  }
  return discardN;
}
function nextActive() {
  for (let k = 0; k < G.turnOrder.length; k++) { const pid = G.turnOrder[(G.turnPos + k) % G.turnOrder.length]; if (!G.passed.includes(pid)) return { pid, pos: (G.turnPos + k) % G.turnOrder.length }; }
  return null;
}
async function actionStep() {
  const nx = nextActive();
  if (!nx) { G.phase = 'endRound'; return; }
  G.current = nx.pid;
  await playerTurn(P(nx.pid));
  await endOfTurnParks(nx.pid);
  refillDisplay();
  G.turnPos = (nx.pos + 1) % G.turnOrder.length;
  if (G.endTrigger != null) {
    G.phase = 'final';
    const i = G.turnOrder.indexOf(G.endTrigger);
    G.finalQueue = G.turnOrder.slice(i + 1).concat(G.turnOrder.slice(0, i));
  }
}
async function endRound() {
  log('— Fine del round ' + G.round + ' —');
  G.discard.push(...[G.display[0], G.display[1]].filter(Boolean)); G.display[0] = G.display[1] = null; refillDisplay();
  // ordine di turno: chi è più avanti sul tracciato Hobby gioca dopo; parità: si inverte l'ordine precedente
  const prev = G.turnOrder.slice();
  G.turnOrder = prev.slice().sort((a, b) => (P(a).hobby - P(b).hobby) || (prev.indexOf(b) - prev.indexOf(a)));
  G.players.forEach(p => { p.hobby = HOBBY_START; p.workersAvail = [true, true]; });
  G.spaceDefs.forEach(s => G.spaces[s.id] = null); G.spaceExtra = []; G.coinsPlaced = [];
  ST().track.push(G.players.map(p => liveScore(p)));
  G.round++; G.phase = 'income';
}
async function finalStep() {
  if (!G.finalQueue.length) { G.phase = 'over'; G.scores = finalScores(); log('— Partita terminata —'); return; }
  const pid = G.finalQueue.shift(); G.current = pid; const p = P(pid); p.jollyUsedTurn = 0;
  log('ultima azione Hobby', pid);
  await hobbyMenu(p);
  await endOfTurnParks(pid);
  refillDisplay();
}

// ---------- punteggio ----------
function finalScores() {
  const res = G.players.map(p => scorePlayer(p));
  const order = G.players.map(p => p.id).sort((a, b) => res[b].total - res[a].total || (b === G.endTrigger) - (a === G.endTrigger) || P(b).milestonesPlaced - P(a).milestonesPlaced);
  return { breakdown: res, ranking: order };
}
function scorePlayer(p) {
  const s = {};
  const def = MILESTONE_ROWS[G.boardKey];
  s.milestone = 0;
  for (const k of ['prosperity', 'knowledge', 'leisure']) {
    const row = G.milestones[k]; let last = -1; row.forEach((x, i) => { if (x) last = i; });
    const full = row.every(Boolean);
    const val = full ? 5 : last >= 0 ? def[k].mult[last] : 0;
    s.milestone += row.filter(x => x && x.pid === p.id).length * val;
  }
  s.milestone += G.milestones.inf.filter(x => x === p.id).length * MILESTONE_INF_VP;
  s.carte = 0; s.fineCarte = 0;
  for (const c of allTableauCards(p)) {
    const d = cardData(c); if (typeof d.pv === 'number') s.carte += d.pv;
    const e = logicOf(c.name).end;
    if (e) { let n = perCount(p, e.what, {}); if (e.div) n = Math.floor(n / e.div); s.fineCarte += n * e.vp; }
  }
  s.parchi = p.parkCards.reduce((a, id) => a + PARK[id].pv, 0);
  s.upgrade = Object.keys(UPGRADES).reduce((a, k) => a + UPGRADES[k].vp[p.upgrades[k] - 1], 0) + p.relax.reduce((a, b) => a + b, 0);
  s.medaglie = p.medalsPlaced.reduce((a, m) => a + m.disc.vp, 0) + p.medalsLoose.reduce((a, d) => a + d.vp, 0);
  s.famiglia = 0;
  if (p.famSlots.child1) s.famiglia += kidEndScore(p);
  if (p.famSlots.dog) { const it = iconsT(p); s.famiglia += ICONS.filter(i => it[i] > 0).length; }
  if (p.famSlots.cat) s.famiglia += 1;
  s.cultura = CULTURE_VP[p.culture] || 0;
  s.stress = STRESS_VP[p.stress] || 0;
  s.benefici = BENEFITS.filter(b => p.benefits[b] === 2).length * 3;
  s.altri = p.vp; // gettoni PV, fine partita, figlio istantaneo, catene
  s.total = Object.values(s).reduce((a, b) => a + b, 0);
  return s;
}
function kidEndScore(p) {
  const k = KIDE[p.kids.end]; if (!k) return 0;
  if (k.nome === 'The Animal Lover') return (p.famSlots.dog ? 6 : 0) + (p.famSlots.cat ? 6 : 0);
  const it = iconsT(p); let n = 0;
  switch (k.nome) {
    case 'The Top Student': n = p.workers[0].length + p.workers[1].length; break;
    case 'The Explorer': n = benefitIcons(p, 'Viaggi'); break;
    case 'The Builder': n = p.rooms.length; break;
    case 'The Cozy One': n = benefitIcons(p, 'Serenità'); break;
    case 'The Bookworm': n = p.culture; break;
    case 'The Dreamer': n = p.medalsPlaced.length + p.medalsLoose.length; break; // tutte le medaglie rimosse dalla plancia
    case 'The Friend Maker': n = benefitIcons(p, 'Amici'); break;
    case 'Jack of all trades': n = Math.max(distinctW(p, 0), distinctW(p, 1)); break;
    case 'The Specialist': n = Math.max(...[0, 1].map(w => Math.max(...Object.values(iconsW(p, w))))); break;
    case 'The Gifted': n = allTableauCards(p).filter(c => cardData(c).icone.length >= 2).length; break;
    case 'The Ambitious': n = allTableauCards(p).filter(c => cardData(c).costo >= 17).length; break;
  }
  let best = 0;
  for (const [t, v] of Object.entries(k.tabella)) if (n >= parseInt(t)) best = Math.max(best, v);
  return best;
}
function liveScore(p) { return scorePlayer(p).total; }

// ---------- effetti speciali ----------
const SPECIALS = {
  async doubleTrees(p) {
    const opts = G.parks.visible.map((pk, i) => pk && pk.trees[p.id] ? { label: 'Parco ' + pk.id + ' (' + pk.trees[p.id] + ' tuoi alberi)', value: i } : null).filter(Boolean);
    if (!opts.length) return;
    const i = await choose(p.id, 'Raddoppia i tuoi alberi in un parco', opts, { forceAsk: true });
    await plantTrees(p, G.parks.visible[i].trees[p.id], i);
  },
  async actor(p, op, ctx) {
    const c = allTableauCards(p).filter(x => x.kind === 'prof' && x.uid !== (ctx.card && ctx.card.uid) && PROF[x.name].costo <= 10 && logicOf(x.name).imm);
    if (!c.length) return;
    const uid = await choose(p.id, 'Copia l\'effetto immediato di una Professione (costo ≤10)', c.map(x => ({ label: x.name, value: x.uid, card: x })), { forceAsk: true });
    const x = c.find(y => y.uid === uid); log('copia ' + x.name, p.id);
    await applyOps(p, logicOf(x.name).imm, ctx);
  },
  async caregiver(p) {
    const opts = [];
    for (const [k, b] of Object.entries(HOUSE_BONUS[p.board])) { const [r, c] = k.split(',').map(Number); if (!p.house[r][c] && !b.family && !b.upgrade) opts.push({ label: 'Casella ' + k + ': ' + describeOps(b), value: k }); }
    if (!opts.length) return;
    const k = await choose(p.id, 'Scegli un bonus visibile della casa da ottenere due volte', opts, { forceAsk: true });
    await applyOps(p, HOUSE_BONUS[p.board][k]); await applyOps(p, HOUSE_BONUS[p.board][k]);
  },
  async nurseryGardener(p) { const n = p.stress <= 5 ? 3 : p.stress <= 10 ? 2 : p.stress <= 15 ? 1 : 0; if (n) await BASIC.garden(p, n); },
  async moveTrees(p) {
    for (let k = 0; k < 3; k++) {
      const from = G.parks.visible.map((pk, i) => pk && pk.trees[p.id] ? { label: 'Da parco ' + pk.id + ' (' + pk.trees[p.id] + ')', value: i } : null).filter(Boolean);
      if (!from.length) return;
      from.push({ label: 'Basta', value: -1 });
      const f = await choose(p.id, 'Sposta un albero (' + (k + 1) + '/3)', from, { forceAsk: true }); if (f < 0) return;
      const to = G.parks.visible.map((pk, i) => pk && i !== f ? { label: 'A parco ' + pk.id, value: i } : null).filter(Boolean);
      if (!to.length) return;
      const t = await choose(p.id, 'Verso quale parco?', to, { forceAsk: true });
      G.parks.visible[f].trees[p.id]--; G.parks.visible[t].trees[p.id] = (G.parks.visible[t].trees[p.id] || 0) + 1;
      await checkPark(p, t);
    }
  },
  async archivist(p) {
    shuffle(G.discard); const five = G.discard.splice(-5);
    if (!five.length) return;
    const uid = await choose(p.id, 'Archivist: tieni una carta', five.map(c => ({ label: c.name, value: c.uid, card: c })), { forceAsk: true });
    five.forEach(c => c.uid === uid ? p.hand.push(c) : G.discard.push(c));
  },
  async recycling(p) {
    const cost = [0, 1, 3, 6, 10];
    const k = await choose(p.id, 'Recycling Specialist: quanti alberi?', cost.map((c, i) => ({ label: (i + 1) + ' alberi per ' + c + ' monete', value: i, disabled: p.coins < c })), { forceAsk: true });
    p.coins -= cost[k]; await plantTrees(p, k + 1);
  },
  async arborist(p) {
    const l1 = G.parks.unused.filter(id => PARK[id].livello === 1);
    if (!l1.length) return;
    const id = l1[Math.floor(rng() * l1.length)]; G.parks.unused.splice(G.parks.unused.indexOf(id), 1);
    p.parkCards.push(id); p.parksJoined++; log('prende il parco ' + id, p.id); await gainParkBonus(p, PARK[id]); await parkWon(p, id);
    await checkMilestones(p); // anche i parchi presi con una carta contano per le milestone dei parchi
  },
  async randomPark(p) { return SPECIALS.arborist(p); },
  async compost(p) {
    const opts = G.parks.visible.map((pk, i) => { if (!pk || !pk.trees[p.id]) return null; const max = Math.max(...Object.values(pk.trees)); const others = Object.entries(pk.trees).filter(([k]) => +k !== p.id).map(([, v]) => v); return pk.trees[p.id] > Math.max(0, ...others) ? { label: 'Parco ' + pk.id, value: i } : null; }).filter(Boolean);
    if (!opts.length) { log('non ha la maggioranza assoluta (più di ogni altro) in nessun parco', p.id); return; }
    const i = await choose(p.id, 'Inaugura un parco dove hai la maggioranza', opts, { forceAsk: true });
    await inaugurate(i, p.id, p.id);
  },
  async fountain(p, op, ctx) {
    if (!ctx.cells) return; const seen = new Set();
    for (const [r, c] of ctx.cells) for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const y = r + dy, x = c + dx; if (y < 0 || y > 5 || x < 0 || x > 5) continue; const h = p.house[y][x]; if (h && h.kind === 'garden') seen.add(y + ',' + x); }
    if (seen.size) { p.coins += 3 * seen.size; log('Fountain: ' + 3 * seen.size + ' monete', p.id); }
  },
  async mudroom(p) {
    // riprendi un tuo lavoratore già piazzato (da qualsiasi casella, anche "Prendi 2 monete") e rimettilo sulla tua plancia:
    // lo potrai ripiazzare con un'azione successiva di questo round
    const nameOf = id => G.spaceDefs.find(s => s.id === id).actions.map(a => ACTIONS[a].name).join(' / ');
    const opts = [];
    for (const [k, v] of Object.entries(G.spaces)) if (v && v.pid === p.id) opts.push({ label: 'Lavoratore ' + (v.w + 1) + ' da ' + nameOf(k), value: { kind: 'space', k } });
    (G.spaceExtra || []).forEach((x, i) => { if (x.pid === p.id) opts.push({ label: 'Lavoratore ' + (x.w + 1) + ' da ' + nameOf(x.s), value: { kind: 'extra', i } }); });
    (G.coinsPlaced || []).forEach((x, i) => { if (x.pid === p.id) opts.push({ label: 'Lavoratore ' + (x.w + 1) + ' da Prendi 2 monete', value: { kind: 'coins', i } }); });
    if (!opts.length) { log('Mudroom: nessun lavoratore da riprendere', p.id); return; }
    const v = await choose(p.id, 'Mudroom: quale lavoratore riprendi?', opts.concat([{ label: 'Nessuno', value: null }]), { forceAsk: true });
    if (!v) return;
    let w;
    if (v.kind === 'space') { w = G.spaces[v.k].w; G.spaces[v.k] = null; }
    else if (v.kind === 'extra') { w = G.spaceExtra[v.i].w; G.spaceExtra.splice(v.i, 1); }
    else { w = G.coinsPlaced[v.i].w; G.coinsPlaced.splice(v.i, 1); }
    p.workersAvail[w] = true;
    log('Mudroom: riprende il lavoratore ' + (w + 1) + ', lo potrà ripiazzare in un turno successivo', p.id);
  },
  async attic(p) {
    const c = await takeFromDisplayOrDeck(p, true, 'Attic: prendi una carta');
    if (c && c.kind !== 'dream' && canPlay(p, c, 11)) {
      const v = await choose(p.id, 'Giocare subito ' + c.name + ' con sconto 11?', [{ label: 'Sì', value: 1 }, { label: 'No', value: 0 }], { forceAsk: true });
      if (v) await playCard(p, c, 11);
    }
  },
  async findLeadership(p) {
    for (let i = 0; i < 300; i++) {
      const c = drawCard(); if (!c) return;
      if (c.kind !== 'dream' && cardData(c).icone.includes('Leadership')) { p.hand.push(c); log('trova ' + c.name, p.id); return; }
      G.discard.push(c);
    }
  },
};

// ---------- ciclo principale ----------
const HISTORY = [];
function snapshot() { HISTORY.push(JSON.stringify(G)); if (HISTORY.length > 60) HISTORY.shift(); }
function restore(stepsBack) {
  let s = null;
  for (let i = 0; i < stepsBack && HISTORY.length; i++) s = HISTORY.pop();
  if (s) G = JSON.parse(s);
}
function stepIsBot() {
  if (G.phase === 'actions') { const nx = nextActive(); return !!(nx && P(nx.pid).ai); }
  if (G.phase === 'final') return !!(G.finalQueue && G.finalQueue.length && P(G.finalQueue[0]).ai);
  return false;
}
async function step() {
  if (G.phase === 'setup') return setupStep();
  if (G.phase === 'income') return incomePhase();
  if (G.phase === 'actions') return actionStep();
  if (G.phase === 'endRound') return endRound();
  if (G.phase === 'final') return finalStep();
}
async function runGame(maxSteps = Infinity) {
  let n = 0;
  while (G.phase !== 'over' && n++ < maxSteps) {
    G._answers = []; snapshot(); G._decisions = 0;
    try { await step(); }
    catch (e) {
      if (e && e.abort) return;
      if (e && e.undo) { const back = G._decisions ? 1 : 2; restore(back); while (HISTORY.length && stepIsBot()) restore(1); IO.update(); continue; }
      throw e;
    }
    IO.update();
  }
  IO.update();
}
if (typeof module !== 'undefined') module.exports = { get G() { return G; }, IO, newGame, runGame, finalScores, liveScore, UNDO };
