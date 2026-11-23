// the 2 of us – interfaccia hot-seat, layout "Tavolo"
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STORE = 'happyfamily.save.v1';

let SEL = 0;          // giocatore mostrato nel pannello
let SELW = null;      // lavoratore selezionato (0/1) durante il proprio turno
let JOLLY = 0;        // jolly da aggiungere all'azione
let PIN = null;       // spazio con il popup dei livelli fissato
let PENDING = null;   // richiesta del motore in attesa
let houseState = null;
let multiSel = [];
let setupSel = { fam: null, keep: [] };
let promptMin = false;

// ---------- risorse grafiche ----------
const I = n => 'icons/' + n + '.png';
const ic = (n, cls = 'ic', alt = '') => '<img class="' + cls + '" src="' + I(n) + '" alt="' + esc(alt) + '">';
const ACT_ICON = { Intelligenza: 'intelligenza', Manualità: 'manualita', Affari: 'affari', Comunicazione: 'comunicazione', Empatia: 'empatia', Disciplina: 'disciplina', Natura: 'natura', Leadership: 'leadership', Creatività: 'creatività', DayOut: 'hobby' };
ACT_ICON['Creatività'] = 'creativita';
const BEN_ICON = { Viaggi: 'viaggi', Serenità: 'serenita', Amici: 'amici' };
const cimg = name => CARD_IMG[name] ? 'cards/' + CARD_IMG[name] : '';
function cardImg(name, cls = 'card') { const s = cimg(name); return s ? '<img class="' + cls + '" src="' + s + '" alt="' + esc(name) + '" data-peek="' + esc(name) + '">' : '<div class="small">' + esc(name) + '</div>'; }
const TREE_SVG = (col, empty) => '<svg class="tree' + (empty ? ' empty' : '') + '" viewBox="0 0 14 18" aria-hidden="true"><path d="M7 0.5 L12.5 8 H9.5 L13 13 H1 L4.5 8 H1.5 Z" fill="' + (empty ? 'none' : col) + '" stroke="' + (empty ? '#9DB98F' : 'rgba(0,0,0,.35)') + '" stroke-width="0.8" stroke-dasharray="' + (empty ? '1.5 1.2' : '0') + '"/><rect x="6" y="13" width="2" height="4.5" rx="0.5" fill="' + (empty ? '#C9D9C0' : '#7A5333') + '"/></svg>';
function treeRow(pk, need) {
  const out = [];
  Object.entries(pk.trees).forEach(([k, v]) => { for (let n = 0; n < v; n++) out.push('<span title="' + esc(P(+k).name) + '">' + TREE_SVG(P(+k).color) + '</span>'); });
  for (let n = out.length; n < need; n++) out.push(TREE_SVG('', true));
  return out.join('');
}
const dot = (pid, size) => '<span class="dot" style="background:' + (pid < 0 ? '#999' : P(pid).color) + (size ? ';width:' + size + 'px;height:' + size + 'px' : '') + '" title="' + esc(pid < 0 ? '' : P(pid).name) + '"></span>';
function bonusIcon(b) {
  if (b.family) return 'famiglia'; if (b.upgrade) return 'upgrade'; if (b.coins) return 'moneta'; if (b.income) return 'rendita_denaro';
  if (b.culture) return 'cultura'; if (b.stress) return 'stress_giu'; if (b.jolly) return 'jolly'; if (b.pick) return 'pesca_display';
  if (b.trees) return 'pianta_albero'; if (b.garden) return 'giardino'; if (b.draw) return 'pesca'; if (b.benefit) return 'beneficio_any'; return null;
}
function bonusNum(b) { const v = b.coins || b.income || b.culture || (b.stress ? -b.stress : 0) || b.jolly || b.trees || b.garden || (b.draw ? b.draw[0] : 0); return v > 1 ? v : ''; }


// ---------- icone degli effetti ----------
const oi = (name, n, tip) => '<span class="oi" title="' + esc(tip || '') + '">' + '<img src="' + I(name) + '" alt="' + esc(tip || name) + '">' + (n != null && n !== '' ? '<b>' + n + '</b>' : '') + '</span>';
function opsIcons(ops) {
  if (ops == null) return '';
  if (!Array.isArray(ops)) ops = [ops];
  const out = [];
  for (const o of ops) {
    if (!o) continue;
    if (o.choice) { out.push('<span class="oalt">' + o.choice.map(opsIcons).join('<i>/</i>') + '</span>'); continue; }
    if (o.coins) out.push(oi('moneta', (o.coins > 0 ? '+' : '−') + Math.abs(o.coins), describeOps({ coins: o.coins })));
    if (o.income) out.push(oi('rendita_denaro', '+' + o.income, '+' + o.income + ' rendita denaro'));
    if (o.cardInc) out.push(oi('rendita_carte', '+' + o.cardInc, '+' + o.cardInc + ' rendita carte'));
    if (o.culture) out.push(oi('cultura', '+' + o.culture, '+' + o.culture + ' Cultura'));
    if (o.stress) out.push(oi(o.stress < 0 ? 'stress_giu' : 'stress_su', Math.abs(o.stress), (o.stress > 0 ? '+' : '') + o.stress + ' Stress'));
    if (o.jolly) out.push(oi('jolly', o.jolly > 1 ? o.jolly : '', o.jolly + ' jolly'));
    if (o.vp) out.push(oi('pv', o.vp, o.vp + ' PV'));
    if (o.benefit) out.push(oi(o.benefit === 'any' ? 'beneficio_any' : BEN_ICON[o.benefit] || 'beneficio_any', '', 'gettone Beneficio ' + (o.benefit === 'any' ? 'a scelta' : o.benefit)));
    if (o.upgrade) out.push(oi('upgrade', o.upgrade > 1 ? o.upgrade : '', 'Upgrade'));
    if (o.garden) out.push(oi('giardino', o.garden > 1 ? o.garden : '', o.garden + ' Giardino'));
    if (o.trees || o.treesSplit) out.push(oi('pianta_albero', o.trees || o.treesSplit, (o.trees || o.treesSplit) + ' alberi'));
    if (o.treesEach) out.push(oi('pianta_albero', o.treesEach + '×', o.treesEach + ' alberi in ogni parco'));
    if (o.draw) { out.push(oi('pesca', o.draw[0], 'pesca ' + o.draw[0])); if (o.draw[1]) out.push(oi('scarta', o.draw[1], 'scarta ' + o.draw[1])); }
    if (o.pick) out.push(oi('pesca_display', o.pick > 1 ? o.pick : '', o.pick + ' carta dal display'));
    if (o.hobby) out.push(oi('hobby', o.hobby, 'tracciato Hobby ' + o.hobby));
    if (o.medal) out.push(oi('medaglia', '', 'medaglia'));
    if (o.doAction) out.push(oi(ACT_ICON[o.doAction] || 'meeple', '', 'svolgi l\'azione ' + (ACTIONS[o.doAction] ? ACTIONS[o.doAction].name : o.doAction)));
    if (o.playCard) out.push(oi('carta_sconto', o.playCard.discount ? '−' + o.playCard.discount : '', 'gioca una carta' + (o.playCard.discount ? ' con sconto ' + o.playCard.discount : '')));
    if (o.family) out.push(oi('famiglia', '', 'Allargamento della famiglia'));
    if (o.milestone) out.push(oi('milestone', '', 'milestone'));
    if (o.relax) out.push(oi('upgrade', 'R', 'tessera Relax'));
    if (o.special || o.per || o.repeat || o.if) out.push('<span class="otx">' + esc(describeOps(o)) + '</span>');
  }
  return out.length ? '<span class="ops">' + out.join('') + '</span>' : '<span class="small">—</span>';
}
const MEEPLE_PATH = 'M50 3c10 0 17 8 17 17 0 6-3 11-7 14 11 3 33 9 33 21 0 7-8 8-17 6l11 31c1 4-1 6-5 6H64c-3 0-5-2-6-4L50 76l-8 18c-1 2-3 4-6 4H18c-4 0-6-2-5-6l11-31c-9 2-17 1-17-6 0-12 22-18 33-21-4-3-7-8-7-14 0-9 7-17 17-17z';
const meeple = (color, size = 18, cls = 'mpl') => '<svg class="' + cls + '" viewBox="0 0 100 100" width="' + size + '" height="' + size + '" aria-hidden="true"><path d="' + MEEPLE_PATH + '" fill="' + color + '" stroke="rgba(0,0,0,.45)" stroke-width="4"/></svg>';

// ---------- livelli delle azioni ----------
function actRows(a) {
  const A = ACTIONS[a];
  const L5 = i => i === 5 ? '5+' : '' + i;
  if (A.kind === 'play') return A.discount.map((d, i) => ({ lab: L5(i), txt: 'Gioca ' + (A.type === 'prof' ? 'una Professione' : 'una Stanza') + ' dalla mano con sconto ' + d, html: '<span class="ops">' + oi(A.type === 'prof' ? 'carta_prof' : 'carta_room', d ? '−' + d : '', 'Gioca ' + (A.type === 'prof' ? 'una Professione' : 'una Stanza') + (d ? ' con sconto ' + d : ' a costo pieno')) + '</span>' }));
  if (A.kind === 'rows') return A.rows.map((r, i) => ({ lab: L5(i), txt: r.map(o => o.choice ? o.choice.map(describeOps).join(' OPPURE ') : describeOps(o)).join(', '), html: opsIcons(r) }));
  if (A.kind === 'midnight') return A.rows.map((r, i) => ({ lab: L5(i), txt: '+' + r.stress + ' Stress' + (r.coins ? (r.coins > 0 ? ', ' + r.coins + ' monete' : ', paga ' + (-r.coins) + ' moneta') : '') + '; ' + r.tiles.map(t => t === 'gold' ? 'bonus oro' : 'bonus grigio').join(' + ') + (r.tiles.length > 1 ? ' (diversi)' : ''),
    html: '<span class="ops">' + oi('stress_su', r.stress, '+' + r.stress + ' Stress') + (r.coins ? oi('moneta', (r.coins > 0 ? '+' : '−') + Math.abs(r.coins), r.coins + ' monete') : '') + r.tiles.map(t => '<span class="tile ' + t + '" title="bonus ' + (t === 'gold' ? 'oro' : 'grigio') + '">bonus</span>').join('') + '</span>' }));
  if (A.kind === 'dayout') return A.rows.map(r => ({ lab: r.min + '–' + (r.min + 1), txt: 'Azione Hobby gratuita' + (r.ops.length ? ', ' + describeOps(r.ops) : ''), html: '<span class="ops">' + oi('hobby', '', 'azione Hobby gratuita') + '</span>' + (r.ops.length ? opsIcons(r.ops) : '') }));
  return [];
}
function rowIndex(a, s) { const A = ACTIONS[a]; if (A.kind === 'dayout') { let k = 0; A.rows.forEach((r, i) => { if (s >= r.min) k = i; }); return k; } return Math.min(5, s); }
function strength(p, w, a) { return a === 'DayOut' ? distinctW(p, w) : iconsW(p, w)[a]; }
function actNote(a) {
  if (a === 'Disciplina') return 'Bonus grigio: ' + MIDNIGHT_TILES.grey.map(t => t.label).join(' / ') + '. Bonus oro: ' + MIDNIGHT_TILES.gold.map(t => t.label).join(' / ') + '.';
  if (a === 'DayOut') return 'Conta le icone diverse sul lavoratore. L\'azione Hobby non fa avanzare sul tracciato.';
  if (a === 'Natura') return 'Tutti gli alberi vanno nello stesso parco.';
  return 'La forza è il numero di icone ' + a + ' sul lavoratore.';
}

// ---------- stato del turno ----------
function turnPrompt() { return PENDING && PENDING.prompt.turnMenu ? PENDING : null; }
function turnOpt(pred) { const t = turnPrompt(); if (!t) return null; return t.prompt.options.find(o => pred(o.value)) || null; }
function isMyTurnView() { const t = turnPrompt(); return t && t.pid === SEL; }

// ---------- header ----------
function renderHeader() {
  const ph = { setup: 'Preparazione', income: 'Rendita', actions: 'Azioni', endRound: 'Fine round', final: 'Ultime azioni Hobby', over: 'Fine partita' }[G.phase];
  $('#hinfo').innerHTML = '<span class="pill sun">Round ' + G.round + ' · ' + ph + '</span>' +
    '<span class="pill">Ordine: ' + G.turnOrder.map(pid => dot(pid) + ' ' + esc(P(pid).name)).join(' → ') + '</span>' +
    (G.endTrigger != null ? '<span class="pill">Fine partita innescata da ' + esc(P(G.endTrigger).name) + '</span>' : '');
}

// ---------- tabellone ----------
function renderBoard() {
  const t = turnPrompt(); const tp = t ? P(t.pid) : null;
  let h = '<section class="panel"><div class="ph"><h2>Spazi azione</h2><span class="small">' +
    (t ? (SELW == null ? 'Seleziona un lavoratore nel tuo pannello, oppure passa sopra uno spazio per vedere tutti i livelli' : 'Lavoratore ' + (SELW + 1) + (JOLLY ? ' + ' + JOLLY + ' jolly' : '') + ': clicca lo spazio per svolgere l\'azione') : 'Passa sopra uno spazio per vedere tutti i livelli') + '</span></div><div class="spaces">';
  for (const sd of G.spaceDefs) {
    const occ = G.spaces[sd.id]; const extra = (G.spaceExtra || []).filter(x => x.s === sd.id);
    h += '<div class="space' + (occ ? ' occ' : '') + '" data-space="' + sd.id + '">';
    for (const a of sd.actions) h += '<div class="actwrap' + (PIN === sd.id + ':' + a ? ' pin' : '') + '">' + actButton(sd, a, occ, tp) + levelsPopup(a, tp) + '</div>';
    if (occ || extra.length) h += '<div style="position:absolute;right:8px;top:8px;display:flex;gap:3px">' + (occ ? '<span title="' + esc(P(occ.pid).name) + ', lavoratore ' + (occ.w + 1) + '">' + meeple(P(occ.pid).color, 26) + '</span>' : '') + extra.map(x => meeple(P(x.pid).color, 26)).join('') + '</div>';
    h += '</div>';
  }
  const coinOpt = SELW != null ? turnOpt(v => v.t === 'coins' && v.w === SELW) : null;
  h += '<button class="coins2' + (coinOpt ? ' can' : '') + '" data-coins="1"' + (coinOpt ? '' : ' aria-disabled="true"') + '>' + ic('due_monete', '', '') + '<span><b>Prendi 2 monete</b><br><span class="small">Spazio sempre libero</span></span></button>';
  h += '</div></section>';

  // Hobby
  const nextPos = tp ? tp.hobby + 1 : -1; const hobOpt = turnOpt(v => v.t === 'hobby');
  h += '<div class="row2 rowht"><section class="panel hob"><div class="ph"><h2>Hobby</h2><span class="small">' + (tp ? 'clicca la casella evidenziata' : '') + '</span></div><div class="htrack">';
  // caselle piccole e, tra una casella e l'altra, il costo del passo (come sul tabellone)
  const myPos = tp ? Math.min(tp.hobby, 9) : -1;
  for (let i = 0; i <= 9; i++) {
    const here = G.players.filter(p => p.hobby === i || (i === 9 && p.hobby > 9));
    const isNext = tp && (i === Math.min(nextPos, 9)) && !(i === 9 && tp.hobby >= 9);
    const tag = isNext ? 'button' : 'div';
    const tip = i === 0 ? 'Casella 0: ci arrivi solo con un effetto che fa arretrare il segnalino Hobby'
      : i === HOBBY_START ? 'Partenza: a inizio round tutti tornano qui' : i === 9 ? 'Ultima casella: da qui ogni passo costa 8 e resti qui' : 'Casella ' + i;
    h += '<' + tag + ' class="hcell' + (i === 0 ? ' zero' : '') + (i === HOBBY_START ? ' start' : '') + (isNext ? ' next' : '') + '"' + (isNext ? ' data-hobby="1"' + (hobOpt && !hobOpt.disabled ? '' : ' disabled') + ' title="Avanza qui pagando ' + hobbyPrice(tp) + ' e svolgi un\'azione Hobby"' : ' title="' + esc(tip) + '"') + '>' +
      (i === HOBBY_START ? '<div class="n">via</div>' : i === 0 ? '<div class="n">↶</div>' : '<div class="n">&nbsp;</div>') +
      '<div class="pins">' + here.map(p => dot(p.id)).join('') + '</div></' + tag + '>';
    // costo del passo da questa casella alla successiva (dopo la 4 si va a capo; dopo la 9 si resta lì)
    const cost = hobbyCost(i); const pay = tp && i === myPos;
    const stip = i === 9 ? 'Oltre l\'ultima casella: ogni passo costa 8' : 'Avanzare dalla casella ' + i + ' alla ' + (i + 1) + ' costa ' + cost;
    h += '<div class="hcost' + (pay ? ' pay' : '') + (i === 4 ? ' wrap' : '') + (i === 9 ? ' loop' : '') + '" title="' + esc(stip + (pay ? ' · è il tuo prossimo passo' + (hobbyPrice(tp) !== cost ? ' (per te ' + hobbyPrice(tp) + ')' : '') : '')) + '">' + ic('moneta') + '<b>' + (pay ? hobbyPrice(tp) : cost) + '</b>' + (i === 4 ? '<span class="arr">↵</span>' : i === 9 ? '<span class="arr">↻</span>' : '') + '</div>';
  }
  h += '</div><div class="hmenu"><span class="hico" title="Azione Hobby: scegli una di queste">' + ic('hobby', '', 'Azione Hobby') + '</span><div class="hopts">' +
    [['carta_any', '', 'Gioca una Professione o una Stanza a costo pieno'], ['pianta_albero', '1', 'Pianta 1 albero'], ['jolly', '1', 'Prendi 1 jolly'],
     ['medaglia', '', 'Piazza una medaglia su un Sogno'], ['pesca', '2', 'Pesca 2 carte'], ['pesca_display', '1', 'Prendi 1 carta dal display']]
      .map(([n, k, t]) => '<span class="hopt" title="' + esc(t) + '">' + ic(n, '', t) + (k ? '<b>' + k + '</b>' : '') + '</span>').join('') + '</div></div></section>';
  // Tracciati Cultura e Stress (tutti i giocatori)
  h += '<section class="panel"><div class="ph"><h2>Cultura e Stress</h2><span class="small">le barre rosse cambiano la rendita</span></div>' + bigTrack('cultura', 'Cultura', 0, 13, 'culture', CULTURE_REWARDS, [], CULTURE_VP) + bigTrack('stress', 'Stress', 1, 20, 'stress', STRESS_REWARDS, STRESS_BARS, STRESS_VP) + '</section></div>';
  // Parchi + Display
  const parkPick = PENDING && PENDING.prompt.context === 'park';
  h += '<div class="row2"><section class="panel"><div class="ph"><h2>Parchi</h2><span class="small">pila: ' + G.parks.stack.length + '</span></div><div class="parks" style="grid-template-columns:repeat(' + G.parks.visible.length + ',minmax(0,1fr))">';
  G.parks.visible.forEach((pk, i) => {
    if (!pk) { h += '<div class="park small">vuoto</div>'; return; }
    const d = PARK[pk.id]; const tot = totalTrees(pk);
    const pickable = parkPick && PENDING.prompt.options.some(o => o.value === i && !o.disabled);
    h += '<' + (pickable ? 'button' : 'div') + ' class="park' + (pickable ? ' pick' : '') + '"' + (pickable ? ' data-park="' + i + '"' : '') + '>' + cardImg(pk.id, '') +
      '<div class="trees">' + treeRow(pk, d.sogliaInaugurazione) + '</div>' +
      '<div class="ln"><span>' + (Object.entries(pk.trees).filter(([k, v]) => v > 0).map(([k, v]) => dot(+k) + ' ' + v).join(' &nbsp; ') || '<span class="small">nessun albero</span>') + '</span><b' + (tot >= d.sogliaInaugurazione ? ' class="ready" title="Si inaugura alla fine del turno"' : '') + '>' + tot + '/' + d.sogliaInaugurazione + (tot >= d.sogliaInaugurazione ? ' · si inaugura a fine turno' : '') + '</b></div>' +
      '<div class="bar"><i style="width:' + Math.min(100, 100 * tot / d.sogliaInaugurazione) + '%"></i></div>' +
      '<div class="pbon" title="' + esc('Bonus personale con ' + d.sogliaPersonale + '+ alberi: ' + d.bonus + ' · carta ' + d.pv + ' PV') + '">' + oi('pianta_albero', d.sogliaPersonale + '+', '') + '<span class="arr">→</span>' + opsIcons(parseBonus(d.bonus)) + '<span class="pvp">' + oi('pv', d.pv, d.pv + ' PV') + '</span></div></' + (pickable ? 'button' : 'div') + '>';
  });
  h += '</div></section>';
  const vp = P(SEL);
  h += '<section class="panel"><div class="ph"><h2>Display</h2><span class="small">mazzo ' + G.deck.length + ' · scarti ' + G.discard.length + '</span></div><div class="display">';
  G.display.forEach((c, i) => {
    const lock = vp.culture < DISPLAY[i].cult;
    h += '<div class="dslot' + (lock ? ' far' : '') + '" title="' + (lock ? 'Oltre la tua Cultura: si prende con il simbolo carta-occhio, non con la pesca potenziata' : 'Entro la tua Cultura') + '"><div class="h"><span>' + ic('moneta') + DISPLAY[i].cost + '</span><span>' + ic('cultura') + DISPLAY[i].cult + '</span></div><div class="wrap">' + (c ? cardImg(c.name) : '') + '</div></div>';
  });
  h += '</div><div class="small" style="margin-top:6px">A fine round si scartano le prime 2 carte. Bordo tratteggiato: oltre la Cultura di ' + esc(vp.name) + ' (vale solo per la pesca potenziata).</div></section></div>';

  // Milestone
  const def = MILESTONE_ROWS[G.boardKey];
  const msPick = PENDING && PENDING.prompt.context === 'milestone';
  const msOpt = k => msPick && PENDING.prompt.options.some(o => o.value === k && !o.disabled);
  h += '<div class="row2"><section class="panel' + (msPick ? ' mspick' : '') + '" id="msPanel"><div class="ph"><h2>Milestone</h2><span class="small">' + (msPick ? '<b>' + esc(P(PENDING.pid).name) + ': clicca lo spazio evidenziato nella riga che vuoi</b>' : 'la sesta chiude la partita') + '</span></div>';
  for (const k of ['prosperity', 'knowledge', 'leisure']) {
    h += '<div class="ms"><div class="lab">' + ic(k) + def[k].name + '</div>';
    const nextFree = G.milestones[k].findIndex(x => x === null);
    G.milestones[k].forEach((x, i) => {
      const blk = x && x.pid === -1;
      const took = x && !blk;
      const pick = i === nextFree && msOpt(k);
      h += '<' + (pick ? 'button' : 'div') + ' class="sl' + (took ? ' on' : '') + (blk ? ' blk' : '') + (pick ? ' pick' : '') + '"' + (pick ? ' data-msrow="' + k + '" title="Colloca qui la milestone: ' + esc(describeOps(def[k].bonus[i])) + '"' : '') + '><b>×' + def[k].mult[i] + '</b><div title="' + esc(describeOps(def[k].bonus[i])) + '">' + opsIcons(def[k].bonus[i]) + '</div>' +
        (took ? '<span class="msdisc" style="background:' + P(x.pid).color + '" title="' + esc(P(x.pid).name) + '">' + esc(P(x.pid).name.trim().charAt(0).toUpperCase()) + '</span>' : '') + '</' + (pick ? 'button' : 'div') + '>';
    });
    if (nextFree < 0 && msOpt(k)) h += '<button class="sl pick inf" data-msrow="' + k + '" title="Riga completa: spazio ∞ (' + MILESTONE_INF_VP + ' PV)"><b>∞</b><div>' + MILESTONE_INF_VP + ' PV</div></button>';
    h += '</div>';
  }
  h += '<div class="small">Spazio ∞ (' + MILESTONE_INF_VP + ' PV): ' + (G.milestones.inf.map(pid => dot(pid)).join(' ') || '—') + '</div></section>';

  // Sogni
  h += '<section class="panel"><div class="ph"><h2>Chase Your Dreams</h2><span class="small">serve un\'azione Hobby per piazzare una medaglia</span></div><div class="dreams">';
  for (const dr of G.dreams) {
    h += '<div class="dream">' + cardImg(dr.card.name) + MEDAL_LEVELS.map((l, k) => dr.spots[l] != null ? '<span class="dmark" style="top:' + [36, 61, 84][k] + '%;background:' + P(dr.spots[l]).color + '" title="' + esc(P(dr.spots[l]).name) + ' – ' + l + '"></span>' : '').join('') + '</div>';
  }
  h += '</div></section></div>';
  $('#boardCol').innerHTML = h;
}
function actButton(sd, a, occ, tp) {
  const A = ACTIONS[a];
  let pills = '', now = '', can = false;
  const viewP = tp || P(SEL);
  if (tp && SELW != null) {
    const o = turnOpt(v => v.t === 'place' && v.w === SELW && v.s === sd.id && v.a === a);
    can = !!(o && !o.disabled);
    const s = strength(tp, SELW, a) + JOLLY; const ri = rowIndex(a, s);
    now = '<div class="now" title="' + esc(actRows(a)[ri].txt) + '"><b>Forza ' + s + '</b> ' + actRows(a)[ri].html + '</div>';
    const room = jollyLeft(tp) - JOLLY;
    for (let k = 1; k <= room; k++) { const r2 = rowIndex(a, s + k); if (r2 !== rowIndex(a, s + k - 1)) now += '<div class="next1" title="' + esc(actRows(a)[r2].txt) + '"><b>+' + (JOLLY + k) + ' jolly →</b> ' + actRows(a)[r2].html + '</div>'; }
  } else {
    const s = [0, 1].map(w => strength(viewP, w, a)); const best = Math.max(...s);
    pills = '<div class="pills">' + s.map((v, w) => '<span class="spill' + (v === best ? ' best' : '') + '">L' + (w + 1) + ' · forza ' + v + '</span>').join('') + '</div>';
    now = '<div class="now" title="' + esc(actRows(a)[rowIndex(a, best)].txt) + '"><b>L' + (s[0] >= s[1] ? 1 : 2) + '</b> ' + actRows(a)[rowIndex(a, best)].html + '</div>';
  }
  return '<button class="act' + (can ? ' can' : '') + '" data-act="' + a + '" data-sp="' + sd.id + '"' + (tp && SELW != null && !can ? ' disabled' : '') + '><span class="t">' + ic(ACT_ICON[a], '', '') + '<span class="nm">' + esc(A.name) + '</span></span>' +
    (occ ? '<span class="occby">' + dot(occ.pid) + ' occupato da ' + esc(P(occ.pid).name) + '</span>' : '') + pills + now + '</button>';
}
function levelsPopup(a, tp) {
  const p = tp || P(SEL);
  let h = '<div class="levels" role="tooltip">';
  {
    const s1 = strength(p, 0, a), s2 = strength(p, 1, a);
    const r1 = rowIndex(a, s1), r2 = rowIndex(a, s2);
    h += '<h3>' + ic(ACT_ICON[a]) + ' ' + esc(ACTIONS[a].name) + '</h3><table>';
    actRows(a).forEach((r, i) => {
      const cls = (i === r1 ? ' l1' : '') + (i === r2 ? ' l2' : '');
      h += '<tr class="' + cls.trim() + '"><td>' + r.lab + '</td><td><div class="pi">' + r.html + '</div><div class="pt">' + esc(r.txt) + '</div>' + (i === r1 ? '<span class="tag" style="background:' + p.color + ';color:#fff">L1</span>' : '') + (i === r2 ? '<span class="tag" style="background:#2F6FCB;color:#fff">L2</span>' : '') + '</td></tr>';
    });
    h += '</table><div class="note">' + esc(actNote(a)) + ' Jolly disponibili: ' + p.jolly + ' (max ' + jollyMax(p) + ' per turno).</div>';
  }
  return h + '</div>';
}

// ---------- pannello giocatore ----------
function renderPlayer() {
  const t = turnPrompt();
  let h = '<div class="ptabs">';
  for (const p of G.players) {
    const cur = PENDING && PENDING.pid === p.id;
    h += '<button class="ptab' + (SEL === p.id ? ' sel' : '') + (cur ? ' cur' : '') + '" data-p="' + p.id + '"><div class="n">' + dot(p.id) + esc(p.name) + ' <span class="small">' + (G.turnOrder.indexOf(p.id) + 1) + '°' + (G.passed.includes(p.id) ? ' · passato' : '') + '</span></div><div class="s">' + p.coins + ' monete (+' + p.income + ') · Cultura ' + p.culture + ' · Stress ' + p.stress + ' · ' + liveScore(p) + ' PV</div></button>';
  }
  h += '</div>';
  const p = P(SEL); const mine = isMyTurnView();
  const fam = FAMILY[p.family];
  h += '<section class="panel me" style="border-color:' + p.color + '"><div class="mehead">' + dot(p.id, 18) + '<div><div class="nm">' + esc(p.name) + (mine ? ' · tocca a te' : '') + '</div><div class="small">' + esc(p.family || '') + ' · plancia ' + p.board + '</div></div><div class="vp">' + liveScore(p) + ' PV</div></div>';
  if (fam && fam.continuo) h += '<div class="small" style="margin:-4px 0 8px">' + esc(fam.continuo) + '</div>';
  const [dr, ds] = CARD_INCOME[p.cardInc];
  const chips = [['moneta', p.coins, 'monete'], ['rendita_denaro', '+' + p.income, 'rendita'], ['rendita_carte', dr + '/' + ds, 'carte'], ['cultura', p.culture, 'Cultura'], ['stress', p.stress, 'Stress'], ['jolly', p.jolly, 'jolly'], ['pianta_albero', p.trees, 'alberi'], ['milestone', p.milestonesPlaced + '/6', 'milestone']];
  h += '<div class="res">' + chips.map(([k, v, l]) => '<div class="chip">' + ic(k) + '<div><b>' + v + '</b><span>' + l + '</span></div></div>').join('') + '</div>';
  // lavoratori
  h += '<div class="sect">Lavoratori</div><div class="workers">';
  for (let w = 0; w < 2; w++) {
    const avail = p.workersAvail[w];
    const can = mine && avail;
    const iw = iconsW(p, w);
    h += '<div class="wcol"><button class="wbtn' + (can ? ' can' : '') + (mine && SELW === w ? ' on' : '') + (!avail ? ' used' : '') + '" data-w="' + w + '"' + (can ? '' : ' aria-disabled="true"') + '><span class="mp">' + meeple(p.color, 34) + '</span><span><span class="wl">Lavoratore ' + (w + 1) + '</span><br><span class="ws">' + (!avail ? 'già piazzato' : can ? (SELW === w ? 'selezionato' : 'clicca per selezionare') : 'disponibile') + ' · ' + distinctW(p, w) + ' icone diverse</span></span></button>' +
      '<div class="tally">' + ICONS.filter(k => iw[k]).map(k => '<span>' + ic(ACT_ICON[k] || k.toLowerCase()) + iw[k] + '</span>').join('') + (ICONS.some(k => iw[k]) ? '' : '<span class="small">nessuna icona</span>') + '</div>' +
      '<div class="stackbox"><div class="stack">' + p.workers[w].map(c => cardImg(c.name)).join('') + '</div></div></div>';
  }
  h += '</div>';
  if (mine && SELW != null) {
    const max = jollyLeft(p);
    h += '<div class="jbar"><span class="lbl">' + ic('jolly') + 'Potenzia con i jolly</span><span class="seg">' + [0, 1, 2].filter(n => n <= jollyMax(p)).map(n => '<button data-j="' + n + '"' + (JOLLY === n ? ' class="on"' : '') + (n > max ? ' disabled' : '') + '>' + (n ? '+' + n : '0') + '</button>').join('') + '</span><span class="small">hai ' + p.jolly + ' jolly · max ' + jollyMax(p) + ' per turno</span><button class="btn" data-w-cancel="1">Annulla selezione</button></div>';
  }
  // tracciati
  // casa
  const kidsHTML = '<div class="kidsrow">' + [['child1', p.kids.end, 'Figlio fine partita'], ['child2', p.kids.inst, 'Figlio istantaneo'], ['dog', null, 'Cane'], ['cat', null, 'Gatto']].map(([k, n, lab]) => '<div class="kid' + (p.famSlots[k] ? ' on' : ' locked') + '"' + (p.famSlots[k] ? ' style="border-color:' + p.color + ';box-shadow:inset 0 -4px 0 ' + p.color + '"' : '') + ' title="' + esc(lab + (n ? ': ' + n : '') + (p.famSlots[k] ? ' · in famiglia' : ' · bloccato: entra con un Allargamento della famiglia') + (k === 'child2' && p.famSlots.child2 ? ' · cariche ' + p.kidCharges : '')) + '">' + (n ? cardImg(n, '') : ic('famiglia')) + (p.famSlots[k] ? '' : '<span class="lock" aria-hidden="true"><svg viewBox="0 0 16 18" width="14" height="16"><rect x="2" y="8" width="12" height="9" rx="2" fill="#56645C"/><path d="M5 8V5.5a3 3 0 0 1 6 0V8" fill="none" stroke="#56645C" stroke-width="2"/></svg></span>') + '<span>' + esc(p.famSlots[k] ? (n ? (k === 'child1' ? 'Fine partita' : 'Istantaneo · ' + p.kidCharges) : lab) : 'bloccato') + '</span></div>').join('') + '</div>';
  h += '<div class="sect">Residenza · aree completate ' + areasCompleted(p) + '/3 <span class="famhd">Famiglia</span></div><div class="housewrap"><div class="hleft">' + houseHTML(p, 34) + kidsHTML + '</div><div class="famcol">' + familyTile(p) + '</div></div><div class="side under">' +
    '<div class="ben">' + BENEFITS.map(b => '<span class="' + (p.benefits[b] ? '' : 'off') + '" title="' + b + '">' + ic(BEN_ICON[b]) + (p.benefits[b] === 2 ? '3 PV' : p.benefits[b] ? 'sì' : '—') + '</span>').join('') + '</div>' +
    '<div class="medals">' + MEDAL_LEVELS.map(l => '<div class="mr">' + ic(l) + MEDAL_ROWS[p.board][l].map((d, i) => '<span class="md' + (p.medals[l][i] ? '' : ' used') + '" title="' + esc(d.vp + ' PV · bonus: ' + describeOps(d.b)) + '"><b>' + d.vp + '</b>' + opsIcons(d.b) + '</span>').join('') + '</div>').join('') + '</div>' +
    '<div class="ups">' + Object.keys(UPGRADES).map(k => '<span title="' + esc(UPGRADES[k].desc[p.upgrades[k] - 1]) + '">' + ic('upgrade') + ' ' + UPGRADES[k].name + ' ' + p.upgrades[k] + '</span>').join('') + (p.relax.length ? '<span>Relax ' + p.relax.join('+') + ' PV</span>' : '') + '</div>' +
    '</div>';
  if (p.rooms.length) h += '<div class="sect">Stanze</div><div class="rooms">' + p.rooms.map(c => cardImg(c.name)).join('') + '</div>';
  h += msBoard(p);
  h += '</section>';
  $('#playerCol').innerHTML = h;
}
// le 9 milestone della plancia personale, una riga per tipo: il pallino sparisce quando la colloci
function msBoard(p) {
  const pv = p.parkCards.reduce((a, id) => a + (PARK[id] ? PARK[id].pv : 0), 0);
  const rows = [['Parchi', MILESTONE_SOURCES.parks, p.msGot.parks, p.parksJoined, p.parksJoined + ' conquistat' + (p.parksJoined === 1 ? 'o' : 'i') + ' · ' + pv + ' PV'],
    ['Aree residenza', MILESTONE_SOURCES.house, p.msGot.house, areasCompleted(p), areasCompleted(p) + ' complet' + (areasCompleted(p) === 1 ? 'a' : 'e')],
    ['Sogni', MILESTONE_SOURCES.dreams, p.msGot.dreams, p.medalsPlaced.length, p.medalsPlaced.length + ' realizzat' + (p.medalsPlaced.length === 1 ? 'o' : 'i')]];
  let h = '<div class="sect">Milestone della plancia</div><div class="msrows">';
  for (const [label, steps, got, cur, sub] of rows) {
    h += '<div class="msrow"><div class="mscat"><b>' + label + '</b>' + '<span class="mscount">' + sub + '</span>' + '</div><div class="mscells">';
    steps.forEach((t, i) => {
      const done = i < got;
      h += '<div class="msb' + (done ? ' done' : '') + '" title="' + esc(label + ': milestone a ' + t + (done ? ' (collocata)' : '')) + '"><span class="mdisc"' + (done ? '' : ' style="background:' + p.color + '"') + '></span><b>' + t + '</b></div>';
    });
    h += '</div></div>';
  }
  return h + '</div>';
}
function familyTile(p) {
  if (!p.family) return '';
  const f = FAMILY[p.family] || {};
  return '<div class="famcard" title="' + esc(p.family + (f.iniziale ? ' · Inizio: ' + f.iniziale : '') + (f.continuo ? ' · Sempre: ' + f.continuo : '')) + '">' + (cimg(p.family) ? cardImg(p.family, '') : '<b>' + esc(p.family) + '</b>') + '</div>';
}
function bigTrack(k, name, from, to, field, rewards, bars, vps) {
  let c = '';
  for (let i = from; i <= to; i++) {
    const rw = rewards[i]; let sym = '';
    if (rw) sym = ic(rw.cardInc ? 'rendita_carte' : rw.upgrade || rw.relax ? 'upgrade' : rw.family ? 'famiglia' : 'milestone');
    const here = G.players.filter(p => p[field] === i);
    const tip = rw ? (rw.milestone ? 'milestone' : rw.family ? 'Allargamento della famiglia' : rw.relax ? 'tessera Relax e Upgrade' : describeOps(rw)) : '';
    c += '<div class="bt' + (bars.includes(i) ? ' bar' : '') + (here.some(p => p.id === SEL) ? ' me' : '') + '" title="' + esc(tip + (vps[i] ? (tip ? ' · ' : '') + vps[i] + ' PV a fine partita' : '')) + '"><b>' + i + '</b><div class="sy">' + sym + '</div><div class="vp">' + (vps[i] ? (vps[i] > 0 ? '+' : '') + vps[i] : '') + '</div><div class="pins">' + here.map(p => dot(p.id)).join('') + '</div></div>';
  }
  return '<div class="btrack"><div class="lab">' + ic(k) + name + '</div><div class="bcells" style="--n:' + (to - from + 1) + '">' + c + '</div></div>';
}
function trackRow(k, name, from, to, cur, rewards, bars) {
  let c = '';
  for (let i = from; i <= to; i++) {
    const rw = rewards[i]; let sym = '';
    if (rw) sym = rw.cardInc ? ic('rendita_carte') : rw.upgrade || rw.relax ? ic('upgrade') : rw.family ? ic('famiglia') : rw.milestone ? ic('milestone') : '';
    c += '<div class="cl' + (i === cur ? ' cur' : '') + (bars.includes(i) ? ' bar' : '') + '" title="' + esc(rw ? describeOps(rw) || (rw.milestone ? 'milestone' : rw.family ? 'Allargamento famiglia' : rw.relax ? 'tessera Relax' : '') : '') + '">' + i + sym + '</div>';
  }
  return '<div class="trk"><div class="lab">' + ic(k) + name + '</div><div class="cells" style="--n:' + (to - from + 1) + '">' + c + '</div></div>';
}
function houseHTML(p, cell, cands) {
  let h = '<div class="house" style="--c:' + cell + 'px" data-house="' + p.id + '">';
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
    const b = HOUSE_BONUS[p.board][y + ',' + x]; const o = p.house[y][x];
    const isC = cands && cands.some(([a, c]) => a === y && c === x);
    let inner = '';
    if (b && !o) { const bi = bonusIcon(b); inner = (bi ? '<img class="b" src="' + I(bi) + '" alt="">' : '') + (bonusNum(b) ? '<span style="position:absolute;right:2px;bottom:0;font-size:9px;font-weight:800">' + bonusNum(b) + '</span>' : ''); }
    if (o) inner = '<div class="o ' + o.kind + '">' + (o.kind === 'garden' ? '<img src="' + I('giardino') + '" alt="Giardino">' : o.kind === 'dog' ? 'Cane' : o.kind === 'cat' ? 'Gatto' : esc((o.name || '').slice(0, 12))) + '</div>';
    h += '<div class="hc ' + houseType(p, y, x) + (y === 5 && x === 0 ? ' S' : '') + (isC ? ' cand' : '') + (cands ? ' clk' : '') + '" data-y="' + y + '" data-x="' + x + '" title="' + esc(b ? (b.family ? 'Allargamento della famiglia' : describeOps(b)) : '') + '">' + inner + '</div>';
  }
  return h + '</div>';
}

// ---------- dock: mano e turno ----------
function renderDock() {
  const p = P(SEL); const t = turnPrompt();
  let h = '<div class="hand"><div class="sect" style="margin:0">Mano di ' + esc(p.name) + ' · ' + p.hand.length + '/' + handLimit(p) + '</div><div class="cards">';
  for (const c of p.hand) {
    let cls = 'no', st = '';
    if (c.kind === 'dream') { cls = 'dream'; st = 'Sogno'; }
    else {
      const cost = cardCost(p, c, 0); const miss = prereqMissing(p, c);
      if (miss > jollyLeft(p)) st = miss >= 99 ? 'requisito Stress' : 'mancano ' + miss + ' icone';
      else if (miss) { cls = 'jl'; st = 'costo ' + cost + ' · ' + miss + ' jolly'; }
      else if (p.coins >= cost) { cls = 'ok'; st = 'costo ' + cost; }
      else st = 'costo ' + cost + ' · troppo cara';
    }
    h += '<div class="hc2 ' + cls + '">' + cardImg(c.name) + '<span class="st">' + st + '</span></div>';
  }
  if (!p.hand.length) h += '<span class="small">Nessuna carta</span>';
  h += '</div></div>';
  // riquadro turno
  h += '<div class="turnbox">';
  if (G.phase === 'over') h += '<div class="tt">Partita terminata</div><div class="btns"><button class="go" id="bScores">Mostra punteggi</button></div>';
  else if (t) {
    const tp = P(t.pid);
    const recent = G.players.some(p => p.ai) ? G.log.slice(-40).filter(e => !e.msg.startsWith(tp.name + ':')).slice(-4) : [];
    if (recent.length) h += '<div class="recent"><b>Ultime mosse:</b> ' + recent.map(e => esc(e.msg)).join(' · ') + '</div>';
    h += '<div class="tt">' + dot(t.pid, 14) + esc(tp.name) + ', cosa vuoi fare?</div><div class="tx">' +
      (SEL !== t.pid ? 'Stai guardando la plancia di ' + esc(P(SEL).name) + '. <button class="btn" data-p="' + t.pid + '">Torna alla tua</button>' :
        SELW == null ? '1. Clicca un tuo lavoratore (o premi 1 / 2) · 2. scegli i jolly · 3. clicca lo spazio azione. Oppure clicca la casella evidenziata del tracciato Hobby.' :
          'Lavoratore ' + (SELW + 1) + ' selezionato' + (JOLLY ? ' con ' + JOLLY + ' jolly' : '') + ': clicca uno spazio azione o "Prendi 2 monete". Esc per annullare.') + '</div>' +
      '<div class="btns">' + [0, 1].map(w => { const av = tp.workersAvail[w] && SEL === t.pid; return '<button class="btn wq' + (SELW === w ? ' on' : '') + '" data-w="' + w + '"' + (av ? '' : ' disabled') + '>' + meeple(tp.color, 20) + ' Lavoratore ' + (w + 1) + '</button>'; }).join('') + '<button class="btn" data-hobbybtn="1"' + (turnOpt(v => v.t === 'hobby' && true) && !turnOpt(v => v.t === 'hobby').disabled ? '' : ' disabled') + '>' + ic('hobby') + ' Avanza Hobby (' + hobbyPrice(tp) + ')</button><button class="btn" data-pass="1">Passa</button></div>';
  } else if (PENDING && PENDING.prompt.context === 'milestone') h += '<div class="tt">' + dot(PENDING.pid, 14) + esc(P(PENDING.pid).name) + ': ' + esc(PENDING.prompt.title) + '</div><div class="tx">Clicca sul tabellone, nell\'area Milestone, lo spazio evidenziato della riga che vuoi. <button class="btn" id="bMsGo">Vai alle milestone</button></div>';
  else if (PENDING) h += '<div class="tt">' + dot(PENDING.pid, 14) + esc(P(PENDING.pid).name) + ' sta decidendo</div><div class="tx">Rispondi nel riquadro in alto.' + (promptMin ? ' <button class="btn" id="bShowPrompt">Mostra la richiesta</button>' : '') + '</div>';
  else if (BOTTHINK) h += '<div class="tt">' + dot(BOTTHINK.pid, 14) + esc(P(BOTTHINK.pid).name) + ' (automa) ' + esc(BOTTHINK.title) + '…</div><div class="tx">' + G.log.slice(-3).map(e => esc(e.msg)).join('<br>') + '</div>';
  else h += '<div class="tt">…</div>';
  h += '</div>';
  $('#dock').innerHTML = h;
}

// ---------- richieste contestuali ----------
function renderPrompt() {
  const el = $('#prompt');
  if (!PENDING || PENDING.prompt.turnMenu || promptMin) { el.hidden = true; return; }
  el.hidden = false;
  const { pid, prompt } = PENDING; const p = P(pid);
  let h = '<button class="btn min" id="bMin" title="Riduci per guardare il tavolo">Guarda il tavolo</button><div class="who" style="border-color:' + p.color + '">' + dot(pid, 14) + '<span>Scelta di <b>' + esc(p.name) + '</b></span>' + (G.players.some(q => q.ai) ? '<span class="small">' + G.players.filter(q => q.ai).map(q => esc(q.name)).join(', ') + ' (automa) sceglie da solo</span>' : '') + '</div><h3>' + esc(prompt.title) + '</h3>';
  if (prompt.type === 'choose' && prompt.context === 'dream') h += dreamPicker(p, prompt);
  else if (prompt.type === 'choose') {
    const withCard = prompt.options.filter(o => o.card || o.kids || o.family);
    if (withCard.length) {
      h += '<div class="cardopts">' + prompt.options.map((o, i) => {
        const imgs = o.card ? cardImg(o.card.name) : o.family ? cardImg(o.family) : o.kids ? '<div style="display:flex;gap:4px">' + cardImg(o.kids.end) + cardImg(o.kids.inst) + '</div>' : '';
        return imgs ? '<button class="cardopt" data-i="' + i + '"' + (o.disabled ? ' disabled' : '') + '>' + imgs + esc(o.label) + '</button>' : '';
      }).join('') + '</div>';
      const rest = prompt.options.map((o, i) => (o.card || o.kids || o.family) ? '' : '<button class="opt" data-i="' + i + '"' + (o.disabled ? ' disabled' : '') + '>' + esc(o.label) + '</button>').join('');
      if (rest.trim()) h += '<div class="opts" style="margin-top:10px">' + rest + '</div>';
    } else {
      let grp = null; h += '<div class="opts">';
      prompt.options.forEach((o, i) => {
        if (o.group && o.group !== grp) { grp = o.group; h += '<div class="grp">' + esc(grp) + '</div>'; }
        h += '<button class="opt" data-i="' + i + '"' + (o.disabled ? ' disabled' : '') + '>' + esc(o.label) + '</button>';
      });
      h += '</div>';
      if (prompt.context === 'park') h += '<div class="hint">Puoi anche cliccare direttamente il parco sul tabellone.</div>';
    }
  } else if (prompt.type === 'setup') {
    const ok = setupSel.fam != null && setupSel.keep.length === prompt.keepN;
    h += '<div class="sect" style="margin-top:0">1 · Scegli la Famiglia</div><div class="famopts">' + prompt.families.map((f, i) => {
      const fd = FAMILY[f] || {};
      return '<button class="famopt' + (setupSel.fam === i ? ' sel' : '') + '" data-sf="' + i + '">' + cardImg(f, '') + '<span><b>' + esc(f) + '</b>' + (fd.monete != null ? '<br>' + oi('moneta', fd.monete, fd.monete + ' monete iniziali') : '') + (fd.continuo ? '<br><span class="small">' + esc(fd.continuo) + '</span>' : '') + '</span></button>';
    }).join('') + '</div>';
    h += '<div class="sect">2 · Scegli ' + prompt.keepN + ' carte da tenere · selezionate ' + setupSel.keep.length + '</div><div class="cardopts">';
    prompt.options.forEach((o, i) => { h += '<button class="cardopt' + (setupSel.keep.includes(i) ? ' sel' : '') + '" data-sk="' + i + '">' + cardImg(o.card.name) + esc(o.label) + '</button>'; });
    h += '</div><div class="btns" style="margin-top:10px"><button class="go" id="sOk"' + (ok ? '' : ' disabled') + '>Conferma famiglia e carte</button></div>';
  } else if (prompt.type === 'multi') {
    h += '<div class="small">Selezionate ' + multiSel.length + ' di ' + prompt.min + (prompt.max !== prompt.min ? '–' + prompt.max : '') + '</div><div class="cardopts">';
    prompt.options.forEach((o, i) => { h += '<button class="cardopt' + (multiSel.includes(i) ? ' sel' : '') + '" data-m="' + i + '">' + (o.card ? cardImg(o.card.name) : '') + esc(o.label) + '</button>'; });
    h += '</div><div class="btns" style="margin-top:10px"><button class="go" id="mOk"' + (multiSel.length < prompt.min || multiSel.length > prompt.max ? ' disabled' : '') + '>Conferma</button></div>';
  } else if (prompt.type === 'house') {
    const cand = houseState.placements[houseState.cur];
    const cover = cand.map(([y, x]) => HOUSE_BONUS[p.board][y + ',' + x]).filter(Boolean);
    h += '<div class="housewrap">' + houseHTML(p, 52, cand) + '<div class="side" style="font-size:13px"><span>Clicca una casella per spostare la tessera lì; clicca di nuovo la stessa casella per provare le altre rotazioni. Tasti ← → per scorrere.</span><span><b>Posizione ' + (houseState.cur + 1) + ' di ' + houseState.placements.length + '</b></span><span>Bonus coperti: ' + (cover.length ? cover.map(b => b.family ? 'Allargamento famiglia' : b.upgrade ? 'Upgrade' : describeOps(b)).join(' · ') : 'nessuno') + '</span><div class="btns"><button class="btn" id="hPrev">◀</button><button class="btn" id="hNext">▶</button><button class="go" id="hOk">Conferma posizione</button></div></div></div>';
  }
  el.innerHTML = h;
}

// i Sogni come sul tabellone: si clicca direttamente la riga (oro/argento/bronzo) dove mettere la medaglia
const DREAM_BANDS = { oro: [13, 29], argento: [43, 28], bronzo: [72, 27] };
function dreamPicker(p, prompt) {
  const groups = [];
  G.dreams.forEach(dr => groups.push({ name: dr.card.name, hand: false, spots: dr.spots }));
  prompt.options.forEach(o => { if (o.fromHand && !groups.some(g => g.hand && g.name === o.dream)) groups.push({ name: o.dream, hand: true, spots: {} }); });
  let h = '<div class="small">Le righe evidenziate sono quelle che puoi reclamare: cliccane una.</div><div class="dpick">';
  for (const g of groups) {
    const any = prompt.options.some(o => o.dream === g.name && !!o.fromHand === g.hand && !o.disabled);
    h += '<div class="dpc' + (any ? '' : ' off') + '"><div class="dimg">' + cardImg(g.name, '');
    for (const lv of MEDAL_LEVELS) {
      const [top, ht] = DREAM_BANDS[lv]; const pos = 'top:' + top + '%;height:' + ht + '%';
      const who = g.spots[lv];
      const i = prompt.options.findIndex(o => o.dream === g.name && !!o.fromHand === g.hand && o.lv === lv);
      const o = prompt.options[i];
      if (o && !o.disabled) h += '<button class="dlv" data-i="' + i + '" style="' + pos + '" title="' + esc(o.label) + '"><span>' + (o.occupied ? 'Occupato: usa il figlio' : 'Metti qui') + '</span></button>';
      if (who != null) h += '<span class="dtaken" style="top:' + (top + ht / 2) + '%;background:' + P(who).color + '" title="' + esc(P(who).name + ' – ' + lv) + '"></span>';
    }
    h += '</div><div class="dcap">' + esc(g.name) + (g.hand ? ' · dalla tua mano' : '') + '</div></div>';
  }
  return h + '</div>';
}

// ---------- rendering ----------
function render() {
  if (!G || Bot.busy) return;
  const sb = $('#bSpeed'); if (sb) sb.textContent = 'Velocità automi: ' + BOT_SPEEDS[botSpeed][0];
  document.body.classList.toggle('noworker', SELW == null);
  renderHeader(); renderBoard(); renderPlayer(); renderDock(); renderPrompt(); renderLog();
}
function renderLog() {
  if (!G || $('#logPanel').hidden) return;
  $('#log').innerHTML = G.log.slice(-250).reverse().map(e => '<div><span class="small">R' + e.r + '</span> ' + esc(e.msg) + '</div>').join('');
}

// ---------- eventi ----------
function answer(v) {
  const pd = PENDING; PENDING = null; houseState = null; multiSel = []; promptMin = false;
  SELW = null; JOLLY = 0; PIN = null;
  pd.resolve(v);
}
document.addEventListener('click', e => {
  if (!G) return;
  const tg = e.target.closest('[data-p],[data-w],[data-j],[data-w-cancel],.act,[data-coins],[data-hobby],[data-hobbybtn],[data-pass],[data-park],[data-msrow],.prompt [data-i],.prompt [data-m],.prompt [data-sf],.prompt [data-sk],#sOk,#mOk,#hOk,#hPrev,#hNext,#bMin,#bShowPrompt,#bMsGo,#bScores,.house .hc.clk');
  if (!tg) { if (PIN && !e.target.closest('.levels')) { PIN = null; render(); } return; }
  const t = turnPrompt();
  if (tg.dataset.p != null && !tg.closest('.prompt')) { SEL = +tg.dataset.p; SELW = null; JOLLY = 0; render(); return; }
  if (tg.dataset.w != null) {
    if (!isMyTurnView() || !P(SEL).workersAvail[+tg.dataset.w]) return;
    const w = +tg.dataset.w; SELW = SELW === w ? null : w; JOLLY = 0; PIN = null; render(); return;
  }
  if (tg.dataset.j != null) { if (!tg.disabled) { JOLLY = +tg.dataset.j; render(); } return; }
  if (tg.dataset.wCancel != null) { SELW = null; JOLLY = 0; render(); return; }
  if (tg.classList.contains('act')) {
    const sp = tg.dataset.sp, a = tg.dataset.act;
    if (t && SELW != null) {
      const o = turnOpt(v => v.t === 'place' && v.w === SELW && v.s === sp && v.a === a);
      if (o && !o.disabled) answer(Object.assign({}, o.value, { j: JOLLY }));
      return;
    }
    PIN = PIN === sp + ':' + a ? null : sp + ':' + a; render(); return;
  }
  if (tg.dataset.coins != null) { const o = SELW != null ? turnOpt(v => v.t === 'coins' && v.w === SELW) : null; if (o) answer(o.value); return; }
  if (tg.dataset.hobby != null || tg.dataset.hobbybtn != null) { const o = turnOpt(v => v.t === 'hobby'); if (o && !o.disabled) answer(o.value); return; }
  if (tg.dataset.pass != null) { const o = turnOpt(v => v.t === 'pass'); if (o) answer(o.value); return; }
  if (tg.dataset.park != null) { answer(+tg.dataset.park); return; }
  if (tg.dataset.msrow != null) { if (PENDING && PENDING.prompt.context === 'milestone') answer(tg.dataset.msrow); return; }
  if (tg.id === 'bScores') { showScores(); return; }
  if (tg.id === 'bMin') { promptMin = true; render(); return; }
  if (tg.id === 'bShowPrompt') { promptMin = false; render(); return; }
  if (tg.id === 'bMsGo') { const mp = $('#msPanel'); if (mp) mp.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (!PENDING) return;
  const pr = PENDING.prompt;
  if (tg.dataset.i != null) { const o = pr.options[+tg.dataset.i]; if (!o.disabled) answer(o.value); return; }
  if (tg.dataset.m != null) { const i = +tg.dataset.m; const k = multiSel.indexOf(i); if (k >= 0) multiSel.splice(k, 1); else if (multiSel.length < pr.max) multiSel.push(i); renderPrompt(); return; }
  if (tg.dataset.sf != null) { setupSel.fam = +tg.dataset.sf; renderPrompt(); return; }
  if (tg.dataset.sk != null) { const i = +tg.dataset.sk; const k = setupSel.keep.indexOf(i); if (k >= 0) setupSel.keep.splice(k, 1); else if (setupSel.keep.length < pr.keepN) setupSel.keep.push(i); renderPrompt(); return; }
  if (tg.id === 'sOk') { if (setupSel.fam != null && setupSel.keep.length === pr.keepN) answer({ keep: setupSel.keep.map(i => pr.options[i].value), family: setupSel.fam }); return; }
  if (tg.id === 'mOk') { answer(multiSel.map(i => pr.options[i].value)); return; }
  if (pr.type === 'house') {
    if (tg.id === 'hOk') { answer(houseState.cur); return; }
    if (tg.id === 'hPrev' || tg.id === 'hNext') { const n = houseState.placements.length; houseState.cur = (houseState.cur + (tg.id === 'hNext' ? 1 : n - 1)) % n; renderPrompt(); return; }
    if (tg.classList.contains('hc')) {
      const y = +tg.dataset.y, x = +tg.dataset.x;
      const idxs = houseState.placements.map((pl, i) => pl.some(([a, b]) => a === y && b === x) ? i : -1).filter(i => i >= 0);
      if (!idxs.length) return; const pos = idxs.indexOf(houseState.cur); houseState.cur = idxs[(pos + 1) % idxs.length]; renderPrompt();
    }
  }
});
document.addEventListener('keydown', e => {
  if (!G || e.target.closest('input,select,textarea')) return;
  if (PENDING && PENDING.prompt.type === 'house' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { const n = houseState.placements.length; houseState.cur = (houseState.cur + (e.key === 'ArrowRight' ? 1 : n - 1)) % n; renderPrompt(); return; }
  if (PENDING && PENDING.prompt.type === 'house' && e.key === 'Enter') { answer(houseState.cur); return; }
  if (!isMyTurnView()) return;
  if (e.key === '1' || e.key === '2') { const w = +e.key - 1; if (P(SEL).workersAvail[w]) { SELW = SELW === w ? null : w; JOLLY = 0; render(); } }
  if (e.key === 'Escape') { SELW = null; JOLLY = 0; PIN = null; render(); }
});
// anteprima carte
document.addEventListener('mouseover', e => {
  const im = e.target.closest('[data-peek]'); const pk = $('#peek');
  if (!im) { pk.hidden = true; return; }
  const n = im.dataset.peek; const d = PROF[n] || ROOM[n] || DREAM[n];
  let tx = '';
  if (FAMILY[n]) tx = (FAMILY[n].iniziale ? 'Inizio: ' + esc(FAMILY[n].iniziale) + '<br>' : '') + (FAMILY[n].continuo ? 'Sempre: ' + esc(FAMILY[n].continuo) : '');
  else if (KIDI[n]) tx = esc(KIDI[n].pv + ' PV, ' + KIDI[n].cariche + ' cariche: ' + KIDI[n].potere);
  else if (KIDE[n]) tx = esc('Fine partita, in base a: ' + KIDE[n].conteggio + ' (' + Object.entries(KIDE[n].tabella).map(([a, b]) => a + '→' + b).join(', ') + ' PV)');
  if (d && d.effetti) tx = d.effetti.map(x => ({ immediato: 'Immediato', rendita: 'Rendita', continuo: 'Continuo', catena: 'Catena ' + (x.beneficio || ''), fine: 'Fine partita' }[x.tipo] || '') + ': ' + esc(x.testo) + (x.incerto ? ' (da verificare)' : '')).join('<br>');
  pk.innerHTML = '<img src="' + im.getAttribute('src') + '" alt="">' + (tx ? '<div class="tx">' + tx + '</div>' : '');
  pk.hidden = false;
  const r = im.getBoundingClientRect(); const w = 272;
  let x = r.right + 10; if (x + w > innerWidth) x = r.left - w - 10; if (x < 4) x = 4;
  let y = Math.min(Math.max(70, r.top - 40), innerHeight - 460);
  pk.style.left = x + 'px'; pk.style.top = Math.max(4, y) + 'px';
});

// ---------- motore ↔ interfaccia ----------
// automi: ritmo regolabile; la generazione evita che un automa di una partita chiusa continui a giocare
const BOT_SPEEDS = [['Lenta', 1200], ['Normale', 500], ['Veloce', 120], ['Istantanea', 0]];
let botSpeed = +(localStorage.getItem('happyfamily.botspeed') || 1);
let GAMEGEN = 0, BOTTHINK = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function botAsk(pid, prompt) {
  const gen = GAMEGEN;
  BOTTHINK = { pid, title: prompt.turnMenu ? 'sceglie la mossa' : prompt.title };
  if (prompt.turnMenu || SEL !== pid) { if (!G.players.some(p => !p.ai) || P(SEL).ai) SEL = pid; }
  render();
  const ms = BOT_SPEEDS[botSpeed][1];
  if (ms) await sleep(prompt.turnMenu ? ms : ms / 2); else await sleep(0);
  if (gen !== GAMEGEN) throw { abort: true };
  const v = await Bot.decide(pid, prompt);
  BOTTHINK = null;
  return v;
}
IO.ask = (pid, prompt) => P(pid).ai ? botAsk(pid, prompt) : new Promise((resolve, reject) => {
  BOTTHINK = null;
  PENDING = { pid, prompt, resolve, reject };
  multiSel = []; promptMin = false; setupSel = { fam: null, keep: [] };
  houseState = prompt.type === 'house' ? { pid, placements: prompt.placements, cur: 0 } : null;
  if (!prompt.turnMenu || SEL !== pid) { SEL = pid; }
  if (!prompt.turnMenu) { SELW = null; JOLLY = 0; }
  if (prompt.context === 'milestone') promptMin = true; // si sceglie cliccando sul tabellone
  render();
  if (prompt.context === 'milestone') { const mp = $('#msPanel'); if (mp) mp.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
});
IO.update = () => { try { localStorage.setItem(STORE, JSON.stringify({ hist: HISTORY.slice(-1)[0] || JSON.stringify(G) })); } catch (e) { } };
IO.log = () => renderLog();

// ---------- punteggio ----------
const SCORE_CATS = [['milestone', 'Milestone', '#2F6FCB'], ['carte', 'PV carte', '#8A5A2B'], ['fineCarte', 'Fine partita carte', '#C47A2C'], ['parchi', 'Parchi', '#2F8A42'],
  ['upgrade', 'Upgrade e Relax', '#7A4FB5'], ['medaglie', 'Medaglie', '#D4A017'], ['famiglia', 'Famiglia', '#D2576B'], ['cultura', 'Cultura', '#3FA7B5'],
  ['stress', 'Stress', '#C0392B'], ['benefici', 'Benefici girati', '#6E8B3D'], ['altri', 'Gettoni e altri PV', '#7F8C8D']];
function lineChartSVG(series, labels, opts = {}) {
  // series: [{name,color,values}] · labels: etichette asse X
  const W = opts.w || 640, H = opts.h || 220, L = 36, R = 12, T = 12, B = 26;
  const max = Math.max(10, ...series.flatMap(s => s.values)); const n = labels.length;
  const x = i => L + (n <= 1 ? 0 : i * (W - L - R) / (n - 1)), y = v => T + (H - T - B) * (1 - v / max);
  let g = '';
  const step = max > 150 ? 50 : max > 60 ? 20 : 10;
  for (let v = 0; v <= max; v += step) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#E4E9E1"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="#56645C">' + v + '</text>';
  labels.forEach((l, i) => { if (n < 16 || i % 2 === 0 || i === n - 1) g += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="#56645C">' + esc(l) + '</text>'; });
  for (const s of series) {
    g += '<polyline fill="none" stroke="' + s.color + '" stroke-width="2.5" stroke-linejoin="round" points="' + s.values.map((v, i) => x(i) + ',' + y(v)).join(' ') + '"/>';
    s.values.forEach((v, i) => { g += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3.5" fill="' + s.color + '"><title>' + esc(s.name + ' – ' + labels[i] + ': ' + v + ' PV') + '</title></circle>'; });
  }
  return '<svg class="lchart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.label || 'grafico') + '">' + g + '</svg>';
}
function showScores() {
  const sc = G.scores || finalScores();
  const ord = sc.ranking; const br = sc.breakdown;
  const maxTot = Math.max(1, ...G.players.map(p => br[p.id].total));
  let h = '<div class="sc-head"><h3>Fine partita · ' + G.round + ' round</h3><button class="btn" id="bScoreClose">Chiudi</button></div>';
  // podio
  h += '<div class="podium">' + ord.map((pid, i) => '<div class="pod' + (i === 0 ? ' win' : '') + '"><span class="pos">' + (i + 1) + '°</span>' + dot(pid, 14) + '<b>' + esc(P(pid).name) + '</b><span class="tot">' + br[pid].total + ' PV</span>' + (G.endTrigger === pid ? '<span class="small">ha chiuso la partita</span>' : '') + '</div>').join('') + '</div>';
  // barre impilate
  h += '<div class="sect">Da dove vengono i punti</div><div class="stack-bars">';
  for (const pid of ord) {
    h += '<div class="sbrow"><span class="sbn">' + dot(pid) + ' ' + esc(P(pid).name) + '</span><div class="sbbar" style="width:' + (100 * br[pid].total / maxTot) + '%">' +
      SCORE_CATS.filter(([k]) => br[pid][k] > 0).map(([k, l, c]) => '<i style="flex:' + br[pid][k] + ';background:' + c + '" title="' + esc(l + ': ' + br[pid][k] + ' PV') + '">' + (br[pid][k] >= 6 ? br[pid][k] : '') + '</i>').join('') + '</div><b>' + br[pid].total + '</b></div>';
  }
  h += '</div><div class="legend">' + SCORE_CATS.map(([k, l, c]) => '<span><i style="background:' + c + '"></i>' + l + '</span>').join('') + '</div>';
  // tabella
  h += '<div class="sect">Dettaglio</div><table class="sctab"><tr><th></th>' + ord.map(pid => '<th>' + dot(pid) + ' ' + esc(P(pid).name) + '</th>').join('') + '</tr>';
  for (const [k, l, c] of SCORE_CATS) {
    const vals = ord.map(pid => br[pid][k]); const mx = Math.max(...vals);
    h += '<tr><td><i class="sw" style="background:' + c + '"></i>' + l + '</td>' + vals.map(v => '<td class="' + (v === mx && v > 0 && ord.length > 1 ? 'best' : '') + '">' + v + '</td>').join('') + '</tr>';
  }
  h += '<tr class="tot"><td>Totale</td>' + ord.map(pid => '<td>' + br[pid].total + '</td>').join('') + '</tr></table>';
  // andamento
  const tr = (G.stats && G.stats.track) || [];
  if (tr.length) {
    const labels = tr.map((_, i) => 'R' + (i + 1)).concat(['Fine']);
    h += '<div class="sect">Andamento dei punti (stima a fine round)</div>' + lineChartSVG(G.players.map(p => ({ name: p.name, color: p.color, values: tr.map(r => r[p.id]).concat([br[p.id].total]) })), labels, { label: 'punti per round' });
  }
  // milestone
  const ms = (G.stats && G.stats.ms) || [];
  if (ms.length) h += '<div class="sect">Milestone</div><div class="mslist">' + ms.map(m => '<span>' + dot(m.pid) + ' R' + m.r + ' · ' + esc(m.src) + '</span>').join('') + '</div>';
  h += '<p class="small">Spareggio: chi ha innescato la fine, poi chi ha più milestone.</p>';
  $('#scoreBox').innerHTML = h; $('#mScore').classList.add('on');
  $('#bScoreClose').onclick = () => $('#mScore').classList.remove('on');
}

// ---------- correzioni manuali ----------
function openFix() {
  if (!G) return; const p = P(SEL);
  const fields = [['coins', 'Monete'], ['income', 'Rendita denaro'], ['cardInc', 'Rendita carte (indice)'], ['culture', 'Cultura'], ['stress', 'Stress'], ['jolly', 'Jolly'], ['vp', 'Gettoni PV'], ['hobby', 'Hobby'], ['trees', 'Alberi in riserva'], ['kidCharges', 'Cariche figlio']];
  let h = '<h3>Correzioni manuali – ' + esc(p.name) + '</h3><p class="small">Per risolvere a mano un effetto non previsto o correggere un errore. Non attivano altri effetti.</p>';
  for (const [k, l] of fields) h += '<div class="adj"><span>' + l + '</span><button class="btn" data-k="' + k + '" data-d="-1">−</button><b style="text-align:center">' + p[k] + '</b><button class="btn" data-k="' + k + '" data-d="1">+</button></div>';
  h += '<div style="margin-top:8px">Benefici: ' + BENEFITS.map(b => '<label style="display:inline">' + b + ' <select data-b="' + b + '">' + [0, 1, 2].map(v => '<option' + (p.benefits[b] === v ? ' selected' : '') + ' value="' + v + '">' + ['no', 'sì', 'girato'][v] + '</option>').join('') + '</select></label>').join(' ') + '</div>';
  h += '<div style="margin-top:8px">Upgrade: ' + Object.keys(UPGRADES).map(k => '<label style="display:inline">' + UPGRADES[k].name + ' <select data-u="' + k + '">' + [1, 2, 3].map(v => '<option' + (p.upgrades[k] === v ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>').join(' ') + '</div>';
  h += '<div style="margin-top:8px">Aggiungi una carta in mano: <input id="fixCard" list="allCards" size="28"><datalist id="allCards">' + Object.keys(PROF).concat(Object.keys(ROOM), Object.keys(DREAM)).map(n => '<option value="' + esc(n) + '">').join('') + '</datalist> <button class="btn" id="fixAdd">Aggiungi</button></div>';
  h += '<div style="margin-top:8px">Scarta una carta dalla mano: <select id="fixRm">' + p.hand.map(c => '<option value="' + c.uid + '">' + esc(c.name) + '</option>').join('') + '</select> <button class="btn" id="fixDel">Scarta</button></div>';
  h += '<p><button class="go" id="fixClose">Chiudi</button></p>';
  $('#fixBox').innerHTML = h; $('#mFix').classList.add('on');
  $('#fixBox').querySelectorAll('button[data-k]').forEach(b => b.onclick = () => { p[b.dataset.k] += +b.dataset.d; log('correzione manuale: ' + b.dataset.k + ' ' + (b.dataset.d > 0 ? '+1' : '-1'), p.id); openFix(); render(); });
  $('#fixBox').querySelectorAll('select[data-b]').forEach(s => s.onchange = () => { p.benefits[s.dataset.b] = +s.value; log('correzione manuale: ' + s.dataset.b, p.id); render(); });
  $('#fixBox').querySelectorAll('select[data-u]').forEach(s => s.onchange = () => { p.upgrades[s.dataset.u] = +s.value; log('correzione manuale: Upgrade ' + s.dataset.u, p.id); render(); });
  $('#fixAdd').onclick = () => { const n = $('#fixCard').value; const kind = PROF[n] ? 'prof' : ROOM[n] ? 'room' : DREAM[n] ? 'dream' : null; if (!kind) return; p.hand.push({ uid: G.uid++, kind, name: n }); log('correzione manuale: aggiunge ' + n, p.id); openFix(); render(); };
  $('#fixDel').onclick = () => { const uid = +$('#fixRm').value; const i = p.hand.findIndex(c => c.uid === uid); if (i >= 0) { G.discard.push(p.hand.splice(i, 1)[0]); openFix(); render(); } };
  $('#fixClose').onclick = () => $('#mFix').classList.remove('on');
}

// ---------- avvio e file ----------
let running = false;
async function start() {
  if (running) return; running = true;
  try { await runGame(); } catch (e) { console.error(e); alert('Errore del motore: ' + e.message + '\nUsa "Annulla" oppure esporta la partita e segnalalo.'); }
  running = false; render();
  if (G.phase === 'over') showScores();
}
function abortPending() { if (PENDING) { const pd = PENDING; PENDING = null; pd.reject({ abort: true }); } }
function newGameDialog() {
  const upd = () => {
    const n = +$('#nP').value; let h = '';
    for (let i = 0; i < n; i++) h += '<label>Giocatore ' + (i + 1) + ' <select class="pt" aria-label="Tipo giocatore ' + (i + 1) + '"><option value="h">Umano</option><option value="a"' + (i > 0 ? ' selected' : '') + '>Automa</option></select> <input class="pn" value="' + (i > 0 ? 'Automa ' + i : 'Giocatore 1') + '" size="16"> plancia <select class="pb">' + 'ABCD'.split('').map(b => '<option' + (b === 'ABCD'[i] ? ' selected' : '') + '>' + b + '</option>').join('') + '</select></label>';
    $('#pNames').innerHTML = h + '<p class="small" style="margin:4px 0 0">I posti seguono il giro del tavolo: alla sinistra di ogni giocatore siede quello della riga sotto (l\'ultimo ha alla sinistra il primo).</p>';
  };
  $('#nP').onchange = upd; upd(); $('#mNew').classList.add('on');
}
$('#bStart').onclick = () => {
  // le ricerche restano dentro la finestra "Nuova partita": il tavolo usa la classe "pt" anche nei popup dei livelli
  const box = $('#pNames');
  const names = [...box.querySelectorAll('input.pn')].map(i => i.value || 'Giocatore'), boards = [...box.querySelectorAll('select.pb')].map(s => s.value), types = [...box.querySelectorAll('select.pt')].map(s => s.value);
  const seed = $('#seed').value ? +$('#seed').value : undefined;
  $('#mNew').classList.remove('on');
  abortPending(); HISTORY.length = 0; GAMEGEN++; BOTTHINK = null;
  newGame({ players: names.map((n, i) => ({ name: n, board: boards[i], ai: types[i] === 'a' })), seed });
  SEL = 0; SELW = null; JOLLY = 0; running = false; start();
};
$('#bCancelNew').onclick = () => $('#mNew').classList.remove('on');
$('#bNew').onclick = newGameDialog;
$('#bUndo').onclick = () => { if (PENDING) { const pd = PENDING; PENDING = null; houseState = null; SELW = null; JOLLY = 0; pd.reject(UNDO); } };
$('#bFix').onclick = openFix;
$('#bSpeed').onclick = () => { botSpeed = (botSpeed + 1) % BOT_SPEEDS.length; try { localStorage.setItem('happyfamily.botspeed', botSpeed); } catch (e) { } render(); };
$('#bLog').onclick = () => { $('#logPanel').hidden = !$('#logPanel').hidden; renderLog(); };
$('#bLogClose').onclick = () => { $('#logPanel').hidden = true; };
$('#bSave').onclick = () => {
  const data = HISTORY.slice(-1)[0] || JSON.stringify(G);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = 'the-2-of-us-round' + G.round + '.json'; a.click();
};
$('#bLoad').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = async e => { const f = e.target.files[0]; if (f) loadState(await f.text()); };
function loadState(txt) { indexData(); abortPending(); GAMEGEN++; BOTTHINK = null; G = JSON.parse(txt); HISTORY.length = 0; SEL = G.current || 0; SELW = null; running = false; start(); }
window.addEventListener('load', () => {
  indexData();
  let saved = null; try { saved = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { }
  if (saved && saved.hist) loadState(saved.hist); else newGameDialog();
});
window.addEventListener('unhandledrejection', e => { if (e.reason && e.reason.abort) e.preventDefault(); });
