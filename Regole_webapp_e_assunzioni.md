# Happy Family – Regole implementate nella webapp (v0.1)

Questo documento raccoglie le regole implementate nella webapp, incluse le risposte al questionario, e le **assunzioni** che ho preso dove le regole non erano ancora definite. Ogni assunzione è segnata con 🟡 ed è facile da cambiare.

## Struttura del round
- **Rendita**, in ordine di turno: si incassano le monete della rendita, poi si pescano le carte della rendita carte. Le carte si prendono dal mazzo, oppure dal display se l'Upgrade Pesca è al livello 2 o superiore. Si risolvono quindi le rendite delle Stanze e si scartano le carte richieste. Infine, se si supera il limite della mano, si scarta fino al limite.
- **Azioni**: i giocatori agiscono a turno, una azione alla volta. Ogni azione è una di queste:
  - piazzare un lavoratore su uno spazio azione libero;
  - piazzare un lavoratore sullo spazio "prendi 2 monete", che è sempre libero;
  - avanzare sul tracciato Hobby pagando il costo e svolgere un'azione Hobby. Questa azione non richiede un lavoratore.
  
  Chi passa ha finito il round. Gli spazi sono esclusivi.
- **Fine round**: si scartano le 2 carte del display a costo più basso e il display si riempie. Ricalcolo dell'ordine di turno: chi è più avanti sul tracciato Hobby gioca dopo; in caso di parità si inverte l'ordine precedente. Poi tutti i segnalini Hobby tornano sulla casella di partenza e i lavoratori rientrano.
- **Display**: viene riempito alla fine del turno di ogni giocatore.
- **Fine partita**: si innesca quando un giocatore colloca la 6ª milestone. Chi la innesca prende 2 PV e non fa altre azioni; ogni altro giocatore svolge una sola azione Hobby. Spareggio: vince chi ha innescato la fine, poi chi ha più milestone.

## Azioni
- **Forza dell'azione** = icone di quel tipo sul lavoratore usato + jolly spesi (al massimo 1 per turno, 2 con l'Upgrade Jolly). Le icone delle Stanze non contano.
- **Valori degli spazi**: sono quelli del questionario.
  - Burning the Midnight Oil: lo Stress per riga è +1/+1/+1/+2/+2/+1. La moneta rossa nella riga 2 è un costo di 1 moneta.
  - A Day Out: conta le icone diverse sul lavoratore e dà un'azione Hobby gratuita, senza avanzare sul tracciato.
- 🟡 **Spazi accorpati sul tabellone a 2 giocatori**: ho letto che Smart Investing e Home Renovation condividono uno spazio, così come Family Time e Neighborhood Catch-up. Chi occupa lo spazio sceglie quale delle due azioni svolgere. In 3–4 giocatori ogni azione ha il suo spazio. In 4 giocatori Deep Study Day e Home Renovation hanno un secondo spazio.
- **Hobby**: i segnalini partono dalla seconda casella, quindi il primo passo costa 1; il costo per avanzare è il numero della casella in cui sei (1, 2…7, poi 8 per sempre). La prima casella (costo 0) si raggiunge solo con gli effetti che fanno arretrare il segnalino quando è sulla partenza. Le scelte possibili sono 6: Professione o Stanza a costo pieno, 1 albero, 1 jolly, una medaglia su un Sogno, pesca 2, 1 carta dal display. Le opzioni impossibili in quel momento sono disattivate.
- **"Omino con X" sulle carte**: si svolge l'azione alla forza del lavoratore migliore, senza piazzare un meeple, anche se lo spazio è occupato.

## Carte
- **Prerequisiti**: si contano su tutto il tableau e i jolly possono coprire le icone mancanti, rispettando il limite per turno.
- **Effetti catena**: si attivano subito se possiedi già il gettone, altrimenti appena lo ottieni.
- **Display**: costo di presa 0/0/1/1/2/2/3. Con il simbolo carta-occhio si può prendere qualsiasi carta del display pagando il costo. Il livello di Cultura (≥ 0/2/4/6/8/10/12) limita solo le carte prese al posto della pesca dal mazzo con l'Upgrade Pesca al livello 2. Al livello 3 dell'Upgrade Pesca le carte del display sono gratuite.
- **Stanze**:
  - Si piazzano adiacenti a una stanza già piazzata; la prima copre la casella S. Si possono ruotare e capovolgere.
  - Si ottengono i bonus delle caselle coperte.
  - Le stanze di dimensione 0 non si piazzano.
  - I Giardini sono tessere da 1 casella.
  - Un'area colorata è completata quando tutte le sue caselle sono coperte.
- **Cane e gatto** si piazzano nella casa. Il cane segue le regole normali. Il gatto non richiede adiacenza e dà 3 volte il bonus coperto (tranne Upgrade e Allargamento famiglia).

## Parchi
- Parchi visibili: 2 in 2 giocatori, 3 in 3–4 giocatori.
- Gli alberi si possono piazzare anche oltre la soglia di inaugurazione. Il parco viene conteggiato alla **fine del turno** del giocatore che ha raggiunto o superato la soglia (anche durante la rendita e nelle ultime azioni Hobby).
- Il bonus personale del parco si ottiene subito, appena raggiungi la tua soglia.
- 🟡 Inaugurazione: vince chi ha più alberi; in parità vince il giocatore di turno, altrimenti il primo in ordine di turno.
- Compost (o effetti simili che inaugurano esplicitamente) inaugura subito.

## Tracciati e milestone
- **Rendita denaro**: si parte da 8.
  - 🟡 La milestone "+40" si ottiene quando la rendita arriva a 30.
  - Uno Stress che andrebbe oltre i limiti si converte in rendita: −1 rendita oltre il 20, +1 rendita sotto l'1.
- **Cultura**:
  - premi alle caselle 1/3/5/7/9 (+1 rendita carte), 2/4/6 (Upgrade), 8 (Allargamento famiglia), 13 (milestone);
  - PV alle caselle 10/11/12 = 1/2/4; 🟡 la casella 13 vale 4 PV;
  - ogni passo oltre il 13 vale +1 rendita denaro.
- 🟡 La rendita carte oltre l'ultima casella si converte in +1 rendita denaro.
- **Stress**: si parte da 13.
  - Ogni barra rossa attraversata vale ±1 rendita; con la famiglia The Relaxed vale ±2.
  - Premi: casella 1 = milestone, 4 = Allargamento famiglia, 8 = tessera Relax e un Upgrade.
  - 🟡 Le tessere Relax disponibili in 2 giocatori sono quelle da 4 e da 1 PV; quella da 2 PV si aggiunge in 3+ giocatori e quella da 3 PV in 4.
- **Milestone**:
  - parchi: alla 2ª, 5ª e 9ª carta Parco ottenuta (vinta all'inaugurazione o presa con un effetto, es. Arborist o The Greenfields);
  - aree della casa: 1, 2 e 3 aree completate;
  - Sogni: 1, 3 e 5 Sogni realizzati;
  - più Cultura 13, Stress 1 e rendita +40.
  
  Ogni disco di una riga vale il moltiplicatore più a destra occupato; una riga piena vale 5 a disco. Lo spazio ∞ vale 3 PV. Una milestone in ognuna delle tre righe dà un Allargamento della famiglia.
- 🟡 **Bonus delle righe milestone**: trascritti dai tabelloni. In 3 giocatori la casella "solo 4 giocatori" è bloccata.
- **Parchi per le milestone**: contano solo le carte Parco ottenute. Partecipare a un'inaugurazione senza vincerla dà solo il bonus personale (se hai raggiunto la soglia), non conta per la milestone.

## Sogni e medaglie
- Per piazzare una medaglia serve un'azione Hobby (dal tracciato, da A Day Out o da una carta).
- Si sceglie un disco del livello raggiunto o di un livello inferiore, si prende subito il bonus scoperto e i PV del disco valgono a fine partita. Un livello di un Sogno già occupato da un altro giocatore non è disponibile.
- Si può mettere in gioco un Sogno dalla mano e piazzarci subito la medaglia.
- 🟡 Nei Sogni del mazzo con due icone su sfondo di carta blu, entrambe le icone devono stare sullo stesso lavoratore.
- 🟡 **Park Grand Opening**: conta i tuoi alberi nei parchi visibili. **Luxury Estate**: conta le righe della casa completamente coperte.
- 🟡 I jolly valgono per i Sogni solo con l'Upgrade Jolly al livello 3.

## Upgrade
- 🟡 **Livelli e punti**: livello 1 = tessera base, livello 2 = tessera girata, livello 3 = tessera rimossa.

  | Upgrade | PV per livello (1/2/3) | Effetto |
  |---|---|---|
  | Pesca | 0/1/3 | Al livello 2 si può pescare dal display entro la propria Cultura; al livello 3 il display è gratis. |
  | Jolly | 0/1/2 | Il livello 3 rende i jolly validi per i Sogni. |
  | Mano | 0/1/4 | Limite della mano 4/6/8. |
  | PV | 0/2/7 | — |

  I PV sotto le tessere li ho letti dalla plancia (3, 4, 2, 7).
- **Headteacher, CEO, Humanitarian Worker, Conservatory**: rimuovi dalla plancia un disco medaglia del livello indicato (solo quel livello), senza piazzarlo su un Sogno. Ottieni il suo bonus e i suoi PV; non conta per le milestone, ma conta per Photo Wall, Listening Lounge e The Dreamer.
- **Mudroom**: riprendi un tuo lavoratore già piazzato, da qualsiasi casella (anche Prendi 2 monete), e rimettilo sulla tua plancia; lo ripiazzi con un'azione successiva.
- **The Sweet One**: riportando lo Stress a 11 si riattraversano le barre rosse e si riprende la rendita persa.

## Cosa non è automatico
- Il pulsante **Correggi** permette di modificare a mano qualsiasi risorsa, i Benefici, gli Upgrade e le carte in mano. Serve per risolvere a mano un effetto non previsto o un errore.
- Le interpretazioni delle carte segnate ⚠️ in *Trascrizione_effetti.md* sono implementate nella lettura più probabile. L'elenco completo è nel file `card-logic.js`, una riga per carta, facile da correggere.

## Automi
- Ogni posto può essere un umano o un automa. L'automa usa le stesse regole e lo stesso motore dei giocatori umani.
- **Come sceglie**: per ogni decisione simula ogni opzione fino alla fine del turno. Nella simulazione le carte del mazzo e la pila dei parchi vengono rimescolate, quindi l'automa non conosce il futuro. Valuta poi lo stato con una funzione a pesi: punti attuali più il valore stimato di monete, rendita, carte, icone, alberi e tracciati, meno il miglior avversario.
- **Durata stimata**: i round rimanenti sono stimati dal ritmo con cui si collocano le milestone; le risorse valgono meno quando la fine si avvicina.
- Le scelte multiple (carte da tenere o da scartare) usano una regola rapida basata sul valore delle carte.


## Linee guida del designer per l'automa (19/11)
Tradotte in valori della funzione di valutazione (`bot.js`, `BOT_DEFAULT_WEIGHTS`). Verificate con partite simulate a 2 giocatori, automa con le linee guida contro automa precedente, posti scambiati e stessi semi.

| Linea guida | Peso | Esito del test |
|---|---|---|
| 1. Nei primi round la rendita è importante | `earlyIncome` 0 | neutra/negativa → spenta |
| 2. Nei primi round le stanze con rendita sono importanti | `roomInc` 0.45 | aiuta |
| 3. Seguire i Sogni | `dreamReady` 1.4 | aiuta (la più utile) |
| 4. Piazzare le milestone, prima è meglio | `msProg` 0, `msEarly` 0 | come l'ho tradotta peggiora → spenta |
| 5. Alberi per il bonus; non lasciare chiusure di parco all'avversario | `parkDanger` 0.5 | neutra |
| 6. Icone uguali sullo stesso lavoratore | `iconConc` 0.12 | neutra |
| 7. Lavoratore forte piazzato presto per non farselo bloccare | `blockRisk` 0.5 | leggermente utile |

Risultato complessivo della versione adottata: vince 64 partite su 100 contro l'automa precedente (+6,6 PV medi).
I pesi spenti restano nel codice: l'allenamento del Simulatore li può riattivare se trova valori che funzionano.

### Aggiornamento 20/11: durata delle partite
Le partite tra automi duravano in media 11,9 round contro 6,5–7 di una partita umana. Modifiche adottate, misurate con partite simulate:
- l'automa valuta di più gli alberi e la maggioranza nei parchi (`tree` 0.8, `parkLead` 1.0) e meno i jolly (`jolly` 0.7): ora usa l'Hobby soprattutto per giocare carte e piantare alberi, come un giocatore umano;
- se gli altri hanno passato simula anche i suoi turni successivi (`chainTurns` 2), così può pianificare per esempio due Hobby di fila per vincere un parco.

Risultato: vince 70 partite su 100 contro la versione precedente (+10,8 PV medi); prima milestone al round 2,8; durata 9,5–10,5 round. Ancora lontano dai 6,5–7 umani.
Provata e spenta: durata attesa fissa a 7 round (`targetRounds`).

### Aggiornamento 20/11: stanze
Gli automi giocavano 12,6 Professioni e 0,8 Stanze a partita: valutavano le carte soprattutto dalle icone, e le Stanze ne hanno quasi zero (0,2 contro 1,7), quindi le scartavano già nella scelta iniziale.
Ora una Stanza vale anche per le caselle che copre (`roomCell` 1.0) e l'automa valuta l'avanzamento verso la prossima area della casa completata (`houseProg` 4).
Risultato: 3,9 Stanze e 6,5 Professioni a partita; prima area completata in media al round 6 (a volte al 2); vince 66 partite su 100 contro la versione precedente (+7,3 PV medi); partite di circa 9 round.

### Aggiornamento 20/11: carte Parco e pericolo di chiusura
Per la milestone dei parchi contano solo le carte Parco ottenute. L'automa ora valuta, per ogni parco, quanti alberi servirebbero a ogni avversario che deve ancora giocare per chiuderlo e vincerlo (in parità vince chi è di turno): se bastano 1 o 2 alberi lo considera un'occasione regalata (`parkDanger` 0.5). Il peso esatto conta poco nei test (tra 0 e 1.2 risultati simili). Con la regola corretta le partite tra automi durano circa 10 round.

## Aggiornamento 21/11: dati delle carte allineati a Excel e grafica
Costi, PV, icone, prerequisiti, dimensioni e Benefici di Professioni, Stanze e Famiglie ora coincidono con `Terraforming Fantasy CALCOLI Revised.xlsx` e con i fogli grafici del 21/11. Le immagini in `cards/` sono state rigenerate dai fogli nuovi.
- Catene modificate: Wedding Planner (Amici: 1 jolly + 1 moneta), Hairdresser (Amici: pesca 2 + 1 moneta), Conservatory (immediato: medaglia argento; catena Amici: +1 Cultura e 1 albero).
- Basement: lo scambio in rendita si fa una volta sola (tolto il simbolo catena).
- Famiglie: The Relaxed 22 monete, The Savers 17 monete.

## Aggiornamento 23/11: Figli, Famiglie e schermata iniziale
Dati e immagini dei Figli e di The Brighton presi dai fogli grafici del 23/11.
- Figli istantanei: The Painter 2 cariche (il raddoppio vale solo quando giochi la Stanza); The Green Thumb 3 PV; The Music Lover 2 monete per ogni Giardino collegato, compreso il nuovo; The Dancer 2 PV.
- Figli di fine partita: Explorer, Cozy One e Friend Maker 1:2 · 2:5 · 3:8 · 4:12 · 5+:16; Jack of all trades 4:1 · 5:3 · 6:5 · 7:7 · 8:10 · 9:14; The Specialist 3:2 · 4:5 · 5:8 · 6:12 · 7+:16; The Bookworm 8:2 · 9:4 · 10:6 · 11:8 · 12:10 · 13:12; The Animal Lover 6 PV per il Cane e 6 per il Gatto.
- Famiglie: The Brighton 22 monete.
- Nuova schermata iniziale (Continua, Nuova partita, Importa, Carte, Simulatore, Highscore) e pulsante Menu in partita. Highscore salvato nel browser (chiave `the2ofus.highscores.v1`), solo giocatori umani.
- Fase di rendita in ordine libero: monete, carte e ogni Stanza con rendita si risolvono nell'ordine scelto dal giocatore. L'app lo chiede solo se almeno una Stanza ha una rendita in cui l'ordine conta (scambi a pagamento, rendita, Stress, Cultura); altrimenti risolve in automatico. Gli scarti della rendita carte e il limite della mano restano alla fine.
