// Happy Family - dati di tabellone e plance (rilevati dalle immagini)
const ICONS = ['Intelligenza','Manualità','Affari','Comunicazione','Empatia','Disciplina','Natura','Leadership','Creatività'];
const ICON_EMOJI = {Intelligenza:'💡',Manualità:'🔧',Affari:'💰',Comunicazione:'💬',Empatia:'❤️',Disciplina:'📋',Natura:'🌿',Leadership:'👑',Creatività:'🎨',Viaggi:'✈️',Serenità:'☀️',Amici:'🤝'};
const BENEFITS = ['Viaggi','Serenità','Amici'];

const ACTIONS = {
  Intelligenza: {name:'Deep Study Day', kind:'play', type:'prof', discount:[0,1,3,5,8,11]},
  Manualità:    {name:'Home Renovation', kind:'play', type:'room', discount:[0,1,3,5,8,11]},
  Affari:       {name:'Smart Investing', kind:'rows', rows:[
    [{income:1}], [{income:1,coins:1}], [{income:1,coins:3}],
    [{choice:[[{income:1,coins:5}],[{benefit:'Viaggi'}]]}],
    [{income:2,coins:6}], [{income:3,coins:8}]]},
  Comunicazione:{name:'Neighborhood Catch-up', kind:'rows', rows:[
    [{pick:1,coins:1}], [{culture:1}], [{pick:1,culture:1}],
    [{choice:[[{culture:1,pick:1,coins:2}],[{benefit:'Amici'}]]}],
    [{culture:2,pick:1,coins:1}], [{culture:3,pick:2}]]},
  Empatia:      {name:'Family Time', kind:'rows', rows:[
    [{stress:-1}], [{stress:-1,coins:1}], [{stress:-2}],
    [{choice:[[{stress:-2,coins:2}],[{benefit:'Serenità'}]]}],
    [{stress:-2,coins:5}], [{stress:-3,coins:5}]]},
  Natura:       {name:'Park Cleanup', kind:'rows', rows:[
    [{coins:1,trees:1}], [{trees:2}], [{coins:2,trees:2}], [{coins:1,trees:3}], [{trees:4}], [{coins:1,trees:5}]]},
  Disciplina:   {name:'Burning the Midnight Oil', kind:'midnight', rows:[
    {stress:1,coins:1,tiles:['grey']}, {stress:1,tiles:['gold']}, {stress:1,coins:-1,tiles:['grey','grey']},
    {stress:2,coins:2,tiles:['grey','gold']}, {stress:2,coins:3,tiles:['gold','gold']}, {stress:1,coins:3,tiles:['gold','gold']}]},
  DayOut:       {name:'A Day Out', kind:'dayout', rows:[
    {min:0,ops:[]}, {min:2,ops:[{coins:1}]}, {min:4,ops:[{coins:1,jolly:1}]}, {min:6,ops:[{coins:2,jolly:2}]}, {min:8,ops:[{coins:4,jolly:3}]}]},
};
const MIDNIGHT_TILES = {
  grey:[{label:'5 monete',ops:[{coins:5}]},{label:'Gioca carta con sconto 2',ops:[{playCard:{type:'any',discount:2}}]},{label:'2 alberi + 1 moneta',ops:[{trees:2,coins:1}]}],
  gold:[{label:'7 monete',ops:[{coins:7}]},{label:'Gioca carta con sconto 4',ops:[{playCard:{type:'any',discount:4}}]},{label:'3 alberi',ops:[{trees:3}]}],
};
// Spazi azione. Sul tabellone 2 giocatori alcune azioni sono accorpate (un solo spazio, scegli quale azione).
const SPACES = {
  2:[{id:'study',actions:['Intelligenza']},{id:'dayout',actions:['DayOut']},{id:'invest',actions:['Affari','Manualità']},
     {id:'park',actions:['Natura']},{id:'midnight',actions:['Disciplina']},{id:'social',actions:['Comunicazione','Empatia']}],
  3:[{id:'study',actions:['Intelligenza']},{id:'dayout',actions:['DayOut']},{id:'invest',actions:['Affari']},{id:'reno',actions:['Manualità']},
     {id:'park',actions:['Natura']},{id:'midnight',actions:['Disciplina']},{id:'family',actions:['Empatia']},{id:'neigh',actions:['Comunicazione']}],
};
SPACES[4] = SPACES[3].concat([{id:'study2',actions:['Intelligenza']},{id:'reno2',actions:['Manualità']}]);

const HOBBY_MENU = [
  {id:'play',label:'Gioca una Professione o una Stanza dalla mano (costo pieno)',ops:[{playCard:{type:'any',discount:0}}]},
  {id:'tree',label:'Pianta 1 albero',ops:[{trees:1}]},
  {id:'jolly',label:'Prendi 1 jolly',ops:[{jolly:1}]},
  {id:'medal',label:'Piazza una medaglia su un Sogno',ops:[{medal:'dream'}]},
  {id:'draw',label:'Pesca 2 carte',ops:[{draw:[2,0]}]},
  {id:'pick',label:'Prendi 1 carta dal display (o pesca)',ops:[{pick:1}]},
];
// Tracciato Hobby: la casella 0 si raggiunge solo con gli effetti "arretra"; i segnalini partono dalla casella 1.
// Il costo per avanzare è il numero della casella in cui sei (0, 1, 2 … 7, poi 8 per sempre): quindi di norma il primo passo costa 1.
const HOBBY_START = 1;
function hobbyCost(pos){ return Math.min(pos,8); }

// Milestone: righe condivise. 2 giocatori: 5 spazi; 3-4 giocatori: 8 spazi (indice 2 solo in 4 giocatori)
const MILESTONE_ROWS = {
  2:{ prosperity:{name:'Prosperity',mult:[1,2,3,4,5],bonus:[{income:2},{income:1,coins:1},{coins:2},{coins:1},{}]},
      knowledge:{name:'Knowledge',mult:[1,2,3,4,5],bonus:[{culture:1,draw:[2,0]},{culture:1},{draw:[2,0]},{draw:[1,0]},{}]},
      leisure:{name:'Leisure',mult:[1,2,3,4,5],bonus:[{stress:-2},{stress:-1,coins:1},{jolly:1,coins:1},{coins:1},{}]} },
  34:{ prosperity:{name:'Prosperity',mult:[1,1,1,2,2,3,4,5],fourOnly:[2],bonus:[{income:2},{income:1,coins:2},{income:1,coins:1},{coins:3},{coins:2},{coins:1},{},{}]},
       knowledge:{name:'Knowledge',mult:[1,1,1,2,2,3,4,5],fourOnly:[2],bonus:[{culture:1,draw:[2,0]},{culture:1,draw:[2,1]},{culture:1},{draw:[3,0]},{draw:[2,0]},{draw:[1,0]},{},{}]},
       leisure:{name:'Leisure',mult:[1,1,1,2,2,3,4,5],fourOnly:[2],bonus:[{stress:-2},{stress:-1,jolly:1},{stress:-1,coins:1},{stress:-2},{jolly:1},{coins:1},{},{}]} },
};
const MILESTONE_INF_VP = 3;
const MILESTONE_SOURCES = {parks:[2,5,9], house:[1,2,3], dreams:[1,3,5]};
const MONEY_MILESTONE = 30; // il cubo delle decine raggiunge la casella +40 (rendita letta 30)

// Display: 7 slot, costo e livello Cultura minimo
const DISPLAY = [{cost:0,cult:0},{cost:0,cult:2},{cost:1,cult:4},{cost:1,cult:6},{cost:2,cult:8},{cost:2,cult:10},{cost:3,cult:12}];

// Cultura 0..13
const CULTURE_REWARDS = {1:{cardInc:1},2:{upgrade:1},3:{cardInc:1},4:{upgrade:1},5:{cardInc:1},6:{upgrade:1},7:{cardInc:1},8:{family:1},9:{cardInc:1},13:{milestone:'culture'}};
const CULTURE_VP = {10:1,11:2,12:4,13:4};
// Rendita carte: [pesca, scarta]
const CARD_INCOME = [[1,1],[2,1],[3,2],[3,1],[4,2],[5,3],[5,2],[6,3]];
// Stress 1..20, start 13; barre rosse tra le caselle (valore = casella a sinistra della barra)
const STRESS_BARS = [1,3,5,7,9,11,14,16,18];
const STRESS_VP = {1:5,2:4,3:3,4:2,5:1,16:-1,17:-2,18:-3,19:-4,20:-5};
const STRESS_REWARDS = {1:{milestone:'stress'},4:{family:1},8:{relax:1}};
const RELAX_TILES = [{vp:4,min:2},{vp:3,min:4},{vp:2,min:3},{vp:1,min:2}];

// Upgrade: livello 1 base, 2 tessera girata, 3 tessera rimossa
const UPGRADES = {
  pesca:{name:'Pesca',vp:[0,1,3],desc:['Mazzo: pesca dal mazzo. Occhio: display pagando','Mazzo: puoi anche scegliere dal display (entro la Cultura) pagando','Carte dal display gratis']},
  jolly:{name:'Jolly',vp:[0,1,2],desc:['Max 1 jolly per turno','Max 2 jolly per turno','Max 2 jolly; validi anche per i Sogni']},
  mano:{name:'Mano',vp:[0,1,4],desc:['Limite mano 4','Limite mano 6','Limite mano 8']},
  verde:{name:'PV',vp:[0,2,7],desc:['—','2 PV','7 PV']},
};

// Residenza: tipi B=marrone G=grigio V=verde W=bianco. (5,0) = casella S
const HOUSE_TYPES = [
 'WWWWWW',
 'GGGGGW',
 'BBGGGW',
 'BBGGGW',
 'BBVVVV',
 'BVVVVV'];
const HOUSE_TYPES_C = ['WWWWWW','GGGGGW','BBGGGW','BBGGGW','BBVVVV','BVVVVV']; // dal 21/11 uguale alle altre plance
const HOUSE_BONUS = {
 A:{'0,1':{upgrade:1},'0,5':{family:1},'1,0':{stress:-1},'1,2':{coins:1},'2,1':{coins:2},'2,4':{income:2},'3,0':{jolly:1},'3,2':{pick:1},'4,4':{stress:-1},'5,2':{coins:2},'5,5':{culture:1}},
 B:{'0,1':{upgrade:1},'0,5':{family:1},'1,0':{coins:3},'1,3':{trees:3},'2,1':{garden:1},'2,4':{income:1},'3,0':{coins:2},'4,3':{jolly:1},'4,5':{coins:4},'5,2':{coins:1},'5,4':{jolly:1}},
 C:{'0,1':{upgrade:1},'0,5':{family:1},'1,0':{pick:1},'2,1':{coins:2},'2,4':{culture:1},'3,0':{trees:1},'3,2':{jolly:3},'4,3':{garden:1},'4,5':{stress:-1},'5,1':{coins:1},'5,4':{draw:[3,0]}},
 D:{'0,1':{upgrade:1},'0,5':{family:1},'1,2':{trees:2},'1,4':{coins:4},'2,1':{jolly:1},'3,0':{pick:1},'3,4':{garden:2},'4,3':{coins:2},'5,2':{jolly:1},'5,5':{coins:5}},
};
const MEDAL_ROWS = {
 A:{oro:[{vp:5,b:{income:2}},{vp:4,b:{culture:2}},{vp:7,b:{}}],argento:[{vp:1,b:{upgrade:1}},{vp:1,b:{coins:7}},{vp:2,b:{garden:3}}],bronzo:[{vp:0,b:{stress:-1,coins:1}},{vp:0,b:{jolly:2}},{vp:0,b:{pick:1,coins:2}}]},
 B:{oro:[{vp:5,b:{income:2}},{vp:3,b:{stress:-3}},{vp:7,b:{}}],argento:[{vp:3,b:{income:1}},{vp:2,b:{pick:1,coins:4}},{vp:1,b:{trees:3}}],bronzo:[{vp:0,b:{coins:4}},{vp:0,b:{culture:1}},{vp:0,b:{garden:2}}]},
 C:{oro:[{vp:1,b:{trees:5}},{vp:4,b:{culture:2}},{vp:7,b:{}}],argento:[{vp:2,b:{garden:3}},{vp:1,b:{coins:7}},{vp:1,b:{benefit:'any'}}],bronzo:[{vp:0,b:{stress:-1,coins:1}},{vp:0,b:{income:1,coins:1}},{vp:0,b:{jolly:2}}]},
 D:{oro:[{vp:3,b:{coins:8}},{vp:5,b:{income:2}},{vp:7,b:{}}],argento:[{vp:2,b:{jolly:3}},{vp:3,b:{income:1}},{vp:2,b:{stress:-2}}],bronzo:[{vp:0,b:{pick:1,coins:2}},{vp:0,b:{garden:2}},{vp:0,b:{trees:2}}]},
};
const MEDAL_LEVELS = ['oro','argento','bronzo'];

const SHAPES = {
 '1':[[0,0]], I2:[[0,0],[0,1]], L3:[[0,0],[1,0],[1,1]], T4:[[0,0],[0,1],[0,2],[1,1]], I3:[[0,0],[0,1],[0,2]],
 O4:[[0,0],[0,1],[1,0],[1,1]], I4:[[0,0],[0,1],[0,2],[0,3]], S4:[[0,1],[0,2],[1,0],[1,1]], X5:[[0,1],[1,0],[1,1],[1,2],[2,1]],
 L4:[[0,0],[0,1],[0,2],[1,2]], T5:[[0,0],[0,1],[0,2],[1,1],[2,1]], P5:[[0,0],[0,1],[1,0],[1,1],[2,0]], W5:[[0,2],[1,1],[1,2],[2,0],[2,1]],
};
const FAMILY_SLOTS = {child1:{label:'Figlio (fine partita)',stress:2},child2:{label:'Figlio (istantaneo)',stress:2},dog:{label:'Cane',stress:1},cat:{label:'Gatto',stress:0}};
const PARK_SETUP = {2:[6,6,6],3:[7,7,6],4:[8,8,3]};
const PLAYER_COLORS = ['#d9534f','#337ab7','#5cb85c','#f0ad4e'];
