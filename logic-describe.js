// Happy Family – descrizione in italiano di ciò che il motore fa davvero per ogni carta.
// Serve alla pagina di verifica: si confronta con il testo stampato sulla carta.
'use strict';
const LD_WHAT = {
  rooms: 'Stanza nel tuo tableau', profs: 'Professione nel tuo tableau', milestones: 'milestone che hai collocato',
  benefits: 'gettone Beneficio che possiedi', parksTrees: 'parco visibile in cui hai almeno un albero', parkCards: 'carta Parco vinta',
  income: 'punto di rendita denaro', medalsOnDreams: 'medaglia piazzata sui Sogni', medalsUsed: 'medaglia rimossa dalla tua plancia (piazzata sui Sogni o rimossa da un effetto)', pets: 'animale (cane o gatto) in famiglia',
  distinctW: 'icona diversa sul lavoratore di questa carta',
};
function ldWhat(w) {
  if (w.startsWith('left:')) { const r = w.slice(5); const [k2, a2] = r.split(':'); return (k2 === 'iconT' ? 'icona ' + a2 + ' nel tableau' : k2 === 'rooms' ? 'Stanza' : k2 === 'profs' ? 'Professione' : ldWhat(r)) + ' del giocatore alla tua sinistra'; }
  const [k, a] = w.split(':');
  if (k === 'iconT') return 'icona ' + a + ' in tutto il tableau (Professioni, Stanze e carta Famiglia)';
  if (k === 'iconW') return 'icona ' + a + ' sul lavoratore di questa carta';
  return LD_WHAT[k] || w;
}
const LD_COND = {
  'stress>=16': 'il tuo Stress è 16 o più', hasCat: 'hai il gatto', hasDog: 'hai il cane', 'gardens>=2': 'hai almeno 2 Giardini',
  leftLessLeadership: 'il giocatore alla tua sinistra ha meno icone Leadership di te (in tutto il tableau)',
  otherWorkerLessLeadership: "l'altro lavoratore ha meno icone Leadership di questo",
};
function ldCond(c) { const m = c.match(/^iconT:(\S+)>=(\d+)$/); return m ? 'hai almeno ' + m[2] + ' icone ' + m[1] + ' nel tableau' : (LD_COND[c] || c); }
const LD_SPECIAL = {
  doubleTrees: 'scegli un parco in cui hai alberi e raddoppiali (pianti tanti alberi quanti ne hai già lì)',
  actor: "copia l'effetto immediato di un'altra tua Professione con costo 10 o meno",
  caregiver: 'scegli un bonus ancora scoperto della tua casa (non Upgrade né Allargamento) e ottienilo due volte',
  nurseryGardener: 'Giardini in base allo Stress: 3 con Stress 1-5, 2 con 6-10, 1 con 11-15, nessuno oltre',
  moveTrees: 'sposta fino a 3 tuoi alberi da un parco a un altro',
  archivist: 'guarda 5 carte a caso dagli scarti e tienine 1',
  recycling: 'paga per piantare alberi in un parco: 1 albero gratis, 2 per 1 moneta, 3 per 3, 4 per 6, 5 per 10',
  arborist: 'prendi a caso una carta Parco di livello 1 non usata e ottieni il suo bonus personale',
  randomPark: 'prendi a caso una carta Parco di livello 1 non usata e ottieni il suo bonus personale',
  mudroom: 'riprendi un tuo lavoratore già piazzato e ripiazzalo subito su uno spazio libero (o Prendi 2 monete), svolgendo l\'azione',
  compost: 'inaugura subito un parco in cui hai più alberi di ogni altro giocatore (non in parità) e vinci tu la carta',
  attic: 'prendi una carta dal display o dal mazzo; se è giocabile puoi giocarla subito con sconto 11',
  fountain: '3 monete per ogni Giardino adiacente alla stanza appena piazzata',
  findLeadership: 'scopri carte dal mazzo finché trovi una carta con icona Leadership e tienila',
};
const LD_HOOK = {
  parkBonus: 'ottieni il bonus personale di un parco', parkWon: 'vinci una carta Parco (inaugurazione, effetti, carta iniziale)', gardenGain: 'ottieni 1 o più Giardini (una volta per effetto)', benefitGain: 'ottieni o giri un gettone Beneficio',
  roomPlayed: 'giochi una Stanza', milestone: 'collochi una milestone', medalPlaced: 'rimuovi una medaglia dalla tua plancia (piazzandola su un Sogno o con un effetto)',
  treesPlanted3: 'pianti 3 o più alberi in una volta', cultureAdvance: 'avanzi sul tracciato Cultura',
  stressDown2: 'scendi di 2 o più sullo Stress in una volta', petUnlocked: 'sblocchi il cane o il gatto',
  chainActivated: 'attivi un effetto catena', incomeGainEach: 'ottieni +1 rendita denaro (per ogni punto)', upgradeDone: 'sviluppi un Upgrade',
};
function ldHook(h) {
  let m;
  if ((m = h.match(/^iconGain_(.+)$/))) return 'giochi una carta con icona ' + m[1] + ' (una volta per ogni icona ' + m[1] + ' sulla carta)';
  if ((m = h.match(/^action_(.+)$/))) return "svolgi l'azione " + (typeof ACTIONS !== 'undefined' && ACTIONS[m[1]] ? ACTIONS[m[1]].name : m[1]);
  return LD_HOOK[h] || h;
}
const LD_FLAG = {
  doubleCover: 'quando piazzi questa stanza ottieni due volte i bonus delle caselle coperte',
  handLimit: 'limite della mano +1', noKidStress: 'i figli non aumentano lo Stress',
  hobbyDiscount: 'avanzare sul tracciato Hobby costa 1 in meno', doubleBars: 'le barre rosse dello Stress valgono il doppio (±2 rendita)',
  ignorePrereq: 'ignori i prerequisiti delle carte',
};
function ldCost(c) {
  if (c.income) return 'perdi ' + c.income + ' di rendita';
  if (c.coins) return 'paga ' + c.coins + ' monete';
  if (c.jolly) return 'spendi ' + c.jolly + ' jolly';
  if (c.stress) return 'prendi +' + c.stress + ' Stress';
  if (c.discard === 'any') return 'scarta ' + (c.count || 1) + ' carta/e';
  if (c.discard === 'room') return 'scarta 1 Stanza';
  if (c.treeRemove) return 'togli 1 tuo albero da un parco';
  if (c.hobbyFwd) return 'avanza di ' + c.hobbyFwd + ' sul tracciato Hobby';
  return JSON.stringify(c);
}
function ldOps(ops) {
  if (ops == null) return '';
  if (!Array.isArray(ops)) ops = [ops];
  return ops.map(ldOp).filter(Boolean).join('; ');
}
function ldOp(o) {
  if (!o) return '';
  if (o.special) return LD_SPECIAL[o.special] || ('effetto speciale ' + o.special);
  if (o.per) return (o.per.div ? 'per ogni gruppo di ' + o.per.div + ' di: ' : 'per ogni ') + ldWhat(o.per.what) + ': ' + ldOps(o.per.do);
  if (o.repeat) return 'fino a ' + o.repeat.n + ' volte, se vuoi: ' + ldCost(o.repeat.cost) + (o.repeat.cost.treeRemove ? ' (ogni volta scegli il parco, anche diverso)' : '') + ' → ' + ldOps(o.repeat.do);
  if (o.choice) return 'a scelta: ' + o.choice.map(c => '(' + ldOps(c) + ')').join(' oppure ');
  if (o.if) return 'se ' + ldCond(o.if.cond) + ': ' + ldOps(o.if.do);
  const p = [];
  const sg = n => (n > 0 ? '+' : '−') + Math.abs(n);
  if (o.coins) p.push(o.coins > 0 ? '+' + o.coins + (o.coins === 1 ? ' moneta' : ' monete') : 'paga ' + (-o.coins) + (o.coins === -1 ? ' moneta' : ' monete'));
  if (o.income) p.push(sg(o.income) + ' rendita denaro');
  if (o.cardInc) p.push('+' + o.cardInc + ' rendita carte');
  if (o.culture) p.push('+' + o.culture + ' Cultura');
  if (o.stress) p.push(sg(o.stress) + ' Stress');
  if (o.jolly) p.push(sg(o.jolly) + ' jolly');
  if (o.vp) p.push(o.vp + ' PV');
  if (o.benefit) p.push('gettone Beneficio ' + (o.benefit === 'any' ? 'a scelta' : o.benefit));
  if (o.upgrade) p.push(o.upgrade + ' Upgrade');
  if (o.garden) p.push(o.garden + (o.garden > 1 ? ' Giardini' : ' Giardino'));
  if (o.tile) p.push('piazza nella casa una tessera di forma ' + o.tile + (typeof SHAPES !== 'undefined' && SHAPES[o.tile] ? ' (' + SHAPES[o.tile].length + ' caselle)' : '') + ' e ottieni i bonus coperti');
  if (o.trees) p.push('pianta ' + o.trees + ' alber' + (o.trees > 1 ? 'i' : 'o') + ' in un solo parco');
  if (o.treesEach) p.push(o.treesEach + ' albero in ogni parco visibile');
  if (o.treesSplit) p.push(o.treesSplit + ' alberi, ognuno nel parco che vuoi');
  if (o.draw) p.push('pesca ' + o.draw[0] + (o.draw[1] ? ' e scarta ' + o.draw[1] : '') + ' (dal display entro la tua Cultura solo con Upgrade Pesca 2+)');
  if (o.pick) p.push('prendi ' + o.pick + ' carta dal display (qualsiasi casella) o dal mazzo');
  if (o.hobby) p.push((o.hobby > 0 ? 'avanza di ' : 'torna indietro di ') + Math.abs(o.hobby) + ' sul tracciato Hobby');
  if (o.medal === 'dream') p.push('piazza una medaglia su un Sogno');
  else if (o.medal === 'dreamPlus') p.push('piazza una medaglia su un Sogno una riga sopra il livello raggiunto (serve almeno il bronzo; se non lo raggiungi in nessun Sogno non piazzi nulla)');
  else if (o.medal) p.push('rimuovi un disco medaglia ' + o.medal + ' dalla tua plancia senza piazzarlo su un Sogno: ottieni bonus e PV, non conta per le milestone (se non ne hai più, nulla)');
  if (o.doAction) p.push("svolgi l'azione " + (typeof ACTIONS !== 'undefined' && ACTIONS[o.doAction] ? ACTIONS[o.doAction].name : o.doAction) + ' alla forza del tuo lavoratore migliore, senza piazzare');
  if (o.playCard) p.push('puoi giocare ' + ({ prof: 'una Professione', room: 'una Stanza', any: 'una carta' }[o.playCard.type] || 'una carta') + (o.playCard.discount ? ' con sconto ' + o.playCard.discount : ''));
  if (o.family) p.push('Allargamento della famiglia');
  if (o.milestone) p.push('una milestone');
  if (o.relax) p.push('tessera Relax');
  return p.join(', ');
}
// Restituisce un elenco di righe {tipo, testo} per una carta di qualsiasi tipo
function describeCardLogic(kind, name) {
  const out = [];
  const push = (t, x) => { if (x) out.push({ tipo: t, testo: x }); };
  if (kind === 'prof' || kind === 'room') {
    const L = CARD_LOGIC[name];
    if (kind === 'room') { const d = ROOM[name]; push('Piazzamento', d.dim > 0 && d.forma ? 'tessera di forma ' + d.forma + ' (' + d.dim + (d.dim === 1 ? ' casella' : ' caselle') + ') nella casa, prendendo i bonus coperti' : 'dimensione 0: non si piazza nella casa'); }
    if (!L) { push('attenzione', 'Nessun effetto implementato per questa carta.'); return out; }
    if (L.imm) push('Immediato', ldOps(L.imm));
    if (L.rendita) push('Rendita', ldOps(L.rendita) + ' (a ogni fase di rendita e anche quando la giochi)');
    if (L.chain) for (const b in L.chain) push('Catena ' + b, ldOps(L.chain[b]) + ' (appena possiedi il gettone ' + b + ', una sola volta)');
    if (L.hooks) for (const h in L.hooks) push('Continuo', 'quando ' + ldHook(h) + ': ' + ldOps(L.hooks[h]));
    if (L.mods) for (const t in L.mods) push('Continuo', 'le ' + (t === 'room' ? 'Stanze' : 'Professioni') + ' ti costano ' + Math.abs(L.mods[t]) + (L.mods[t] > 0 ? ' in meno' : ' in più'));
    if (L.flags) for (const f in L.flags) push('Continuo', LD_FLAG[f] || f);
    if (L.end) push('Fine partita', L.end.vp + ' PV per ogni ' + (L.end.div ? L.end.div + ' ' : '') + ldWhat(L.end.what));
    if (!out.some(l => l.tipo !== 'Piazzamento')) push('Nota', 'nessun effetto oltre a icone, PV' + (kind === 'room' ? ' e piazzamento' : ''));
    return out;
  }
  if (kind === 'family') {
    const F = HF_DATA.famiglie.find(f => f.nome === name); const L = FAMILY_LOGIC[name] || {};
    push('Inizio', F.monete + ' monete' + (L.start ? '; ' + ldOps(L.start) : ''));
    if (L.icon) push('Continuo', 'conta come un\'icona ' + L.icon + ' nel tableau');
    if (L.hooks) for (const h in L.hooks) push('Continuo', 'quando ' + ldHook(h) + ': ' + ldOps(L.hooks[h]));
    if (L.mods) for (const t in L.mods) push('Continuo', 'le ' + (t === 'room' ? 'Stanze' : 'Professioni') + ' ti costano ' + Math.abs(L.mods[t]) + (L.mods[t] > 0 ? ' in meno' : ' in più'));
    if (L.flags) for (const f in L.flags) push('Continuo', LD_FLAG[f] || f);
    if (!L.start && !L.icon && !L.hooks && !L.mods && !L.flags) push('attenzione', 'Nessun potere della famiglia implementato.');
    return out;
  }
  if (kind === 'dream') {
    const D = DREAM[name];
    push('Requisito', D.requisito + ' – oro ' + D.soglie.oro + ', argento ' + D.soglie.argento + ', bronzo ' + D.soglie.bronzo + (D.requisito === 'Stress al massimo' ? ' (Stress uguale o inferiore)' : ' (uguale o superiore)'));
    if (/ \+ /.test(D.requisito)) push('Nota', D.requisito.startsWith('stesso lavoratore') ? 'entrambe le icone devono essere sullo stesso lavoratore' : 'conta le icone su tutto il tableau');
    push('Medaglia', 'serve un\'azione Hobby; jolly validi solo con Upgrade Jolly al livello 3');
    return out;
  }
  if (kind === 'park') {
    const K = PARK[name];
    push('Parco', 'livello ' + K.livello + ' · si inaugura con ' + K.sogliaInaugurazione + ' alberi totali (contati a fine turno) · carta da ' + K.pv + ' PV a chi ha più alberi');
    push('Bonus personale', 'con ' + K.sogliaPersonale + '+ tuoi alberi: ' + ldOps(parseBonus(K.bonus)) + ' (testo trascritto: ' + K.bonus + ')');
    return out;
  }
  if (kind === 'kidEnd') {
    const K = KIDE[name];
    push('Fine partita', 'conta: ' + K.conteggio + ' → ' + (K.tabella ? Object.entries(K.tabella).map(([a, b]) => a + ': ' + b + ' PV').join(', ') : K.testo || '—'));
    return out;
  }
  if (kind === 'kidInst') {
    const K = KIDI[name]; const L = KID_INST_LOGIC[name] || {};
    push('Arrivo', K.pv + ' PV e ' + K.cariche + ' cariche del potere');
    const TR = {
      placeOccupied: 'piazzi un lavoratore su uno spazio occupato, con 2 jolly virtuali', stressSet11: 'quando sali di Stress e superi 11 puoi riportarlo a 11 (riattraversando le barre rosse)',
      roomDouble: "raddoppi l'effetto (immediato e rendita) della Stanza giocata", treesDouble: 'raddoppi gli alberi che pianti',
      medalUp: 'quando piazzi una medaglia (serve comunque un\'azione Hobby o un effetto) puoi metterla una riga più in alto, anche se occupata', incomeGain2: 'quando ottieni +2 o più rendita: +3 PV e 4 monete',
      gardenConnected: 'quando piazzi un Giardino: 3 monete per ogni Giardino collegato', upgradeJump: 'un Upgrade passa direttamente al livello 3',
      profHalf: 'paghi metà prezzo (per eccesso) una Professione', parkWonAgain: 'quando vinci una carta Parco ottieni di nuovo il suo bonus',
      cultureCoins: 'quando avanzi sulla Cultura: monete pari alla tua Cultura', benefitBonus: 'quando ottieni un Beneficio: 6 monete e il gettone già girato',
    };
    push('Potere', 'usando una carica: ' + (TR[L.trigger] || L.trigger || 'non implementato'));
    return out;
  }
  return out;
}
