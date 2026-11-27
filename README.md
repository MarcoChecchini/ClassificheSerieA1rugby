# ClassificheSerieA1rugby
Contiene le classifiche giornata per giornata del campionato di Serie A di rugby (girone A1 e i tre gironi A2), con calendario completo e le rose dei giocatori.

La pagina ha tre sezioni:
- **Classifiche**: risultati della giornata (una partita per riga), poi classifica e calendario di tutte le 22 giornate (le partite da giocare hanno il punteggio `-- – --`). Toccando una squadra in classifica si apre la sua formazione nella giornata scelta (titolari e panchina, minuti giocati, ingressi e uscite, mete, cartellini e punti); con le frecce si passa alle formazioni delle altre squadre in ordine di classifica. Da lì si apre anche il riquadro con tutte le partite e il totale della stagione.
  Toccando un **risultato** si apre la scheda della partita: le due formazioni complete a confronto (i 15 titolari numero per numero e la panchina) con i minuti giocati, ingressi e uscite; le mete di ogni squadra con marcatore, minuto e trasformazione; calci piazzati e drop; i cartellini gialli e rossi con il minuto (per i rossi motivo e squalifica dal Giudice Sportivo); le multe date alle due squadre, se ci sono; l'arbitro.
- **Statistiche**: per ogni girone, all'ultima giornata giocata, miglior attacco e miglior difesa, i 5 giocatori con più punti, i 5 con più mete e i 5 migliori al piede (punti da trasformazioni e punizioni) e le classifiche dei cartellini gialli e rossi, più la **squadra più fallosa** (somma di gialli e rossi della squadra). Con pari merito sull'ultimo posto utile compaiono tutti. L'ultimo riquadro, **Tutti i gironi**, mette insieme i quattro gironi. Sotto i gironi si sceglie **Totale** oppure una singola giornata. Si aggiornano da sole con risultati e tabellini.
- **Rose giocatori**: le rose 2026-27 dall'annuario *Rugby 2027* (Pacitti – Volpe), divise per girone e per ruolo. Nella pagina di ogni squadra, in cima, il pulsante **Info società** sotto il nome, che apre staff tecnico e società, più fondazione, colori, campo e sponsor, dall'annuario; blocco `STAFF` di `index.html`), poi i 5 migliori per punti, mete e punti al piede, più gialli e rossi. Toccando un giocatore si vede la sua scheda partita per partita.

## Serie A Elite femminile

Sotto la barra in alto, in tutte e due le pagine, c'è il banner per scegliere il campionato: **Serie A maschile** (`index.html`) oppure **Serie A Elite femminile** (`femminile.html`).

`femminile.html` usa lo stesso codice della pagina maschile, con le stesse tre sezioni (Classifiche con schede partita e formazioni, Statistiche, Rose giocatrici) e gli stessi blocchi di dati: `DATA`, `ARBITRI`, `TABELLINI`, `SQUALIFICHE`, `SANZIONI`. Girone unico da 8 squadre, 14 giornate: le prime 4 in semifinale, l'ultima retrocede. Penalità in `PEN` (CUS Torino −4).

- **Rose**: non c'è un annuario per il femminile, quindi la rosa di ogni squadra è fatta dalle giocatrici scese in campo nei tabellini, con il ruolo della maglia indossata più spesso da titolare (dipende dall'ordine in cui la società scrive la formazione). Allenatori dai tabellini, campo dal Match Centre (blocco `STAFF`).
- **Aggiornamento automatico** (stessa Action):
  - `scripts/aggiorna-femminile.mjs`: risultati dal Match Centre FIR (categoria `163820262027`); le mete di ogni partita si ricavano dal totale mete della classifica del Match Centre, altrimenti dai marcatori del tabellino. Poi i tabellini dagli articoli "Serie A Elite Femminile" di federugby.it.
  - `scripts/femtab.mjs` converte i tabellini femminili (scritti a mano dalle società, in forme diverse) nel formato della pagina. Le grafie diverse dello stesso nome si sistemano nella tabella `NOMI` in cima al file.
  - `scripts/arbitri.mjs` con `PAGINA=femminile.html CATEGORIA_MC=163820262027` e `scripts/giudice.mjs` con `CAMPIONATO=femminile` (PDF `COMAELITEFEMMxxGS`).
- Quello che non torna (mete non ricavabili, tabellini incompleti) compare nel riepilogo dell'esecuzione con un avviso giallo. I tabellini già presenti non vengono toccati, così le correzioni a mano restano.
- Prova senza rete: `node scripts/aggiorna-femminile.mjs mc.json articoli.json`.

Le statistiche dei giocatori sono calcolate nella pagina dal testo dei tabellini FIR, salvato nel blocco `TABELLINI` di `index.html`.

## Aggiornamento automatico

I risultati stanno in `index.html`, nel blocco `DATA` (girone → giornata → una riga per partita, con le mete tra parentesi).

La GitHub Action **Aggiorna risultati** (`.github/workflows/aggiorna.yml`) gira da sola: ogni 2 ore dal lunedì al mercoledì e una volta al giorno negli altri giorni.
Legge gli articoli "tabellini" della Serie A pubblicati su [federugby.it](https://www.federugby.it/campionati/), ricava punteggio e mete dai marcatori e salva i risultati nuovi con un commit.

- Ogni partita viene controllata: le mete, le trasformazioni e i calci elencati devono dare esattamente il punteggio finale. Se non tornano, la partita non viene inserita.
- Le partite che non è riuscita a leggere (marcatori mancanti o sbagliati nell'articolo) compaiono nel riepilogo dell'esecuzione, nella scheda **Actions**, con un avviso giallo: vanno aggiunte a mano nel blocco `DATA`.
- Le partite già presenti non vengono toccate, salvo che l'articolo riporti un punteggio diverso (rettifica).
- Le penalità in classifica (`PEN`) restano da inserire a mano.
- La stessa Action aggiunge al blocco `TABELLINI` il testo dei tabellini nuovi; quelli già presenti non vengono toccati, così le correzioni fatte a mano restano.
- Per lanciarla subito: scheda **Actions** → *Aggiorna risultati* → **Run workflow**.

### Arbitri e giudici di linea

La stessa Action legge dal Match Centre della FIR (quello della pagina [federugby.it/campionati](https://www.federugby.it/campionati/)) gli ufficiali di gara di ogni partita della Serie A maschile — arbitro, due giudici di linea e TMO — con data, ora e campo, e li salva nel blocco `ARBITRI` di `index.html` (`scripts/arbitri.mjs`). Il blocco viene riscritto a ogni esecuzione con i dati della FIR. Le designazioni escono di solito il giovedì, per questo il giovedì l'Action gira ogni 2 ore. Nella pagina compaiono nella scheda della partita (sezione **Ufficiali di gara**) e, per le partite da giocare, anche nella riga del risultato.

- Se una squadra non viene riconosciuta compare un avviso giallo nel riepilogo dell'esecuzione: basta aggiungere l'alias nella tabella `T` di `index.html`.
- Per provare senza rete: `node scripts/arbitri.mjs risposta.json` con una risposta del Match Centre salvata.

### Squalifiche (motivo dei cartellini rossi)

La stessa Action legge anche i comunicati del Giudice Sportivo della Serie A maschile (PDF su federugby.it) con `scripts/giudice.mjs` e salva le squalifiche dei giocatori nel blocco `SQUALIFICHE` di `index.html`: motivo, durata e periodo. La pagina collega ogni cartellino rosso alla sua squalifica (stessa squadra, stesso cognome, primo comunicato dopo la partita) e la mostra in Statistiche, nella pagina squadra delle Rose e nella scheda del giocatore. Finché il comunicato non esce compare "motivo non ancora pubblicato".

- Le altre voci dei comunicati (multe, ammonizioni, interdizioni...) finiscono nel blocco `SANZIONI`; la scheda della partita mostra solo le multe alle due squadre, dal primo comunicato uscito dopo la partita.
- I comunicati già letti non vengono riscritti: le correzioni a mano restano.
- Le voci che lo script non riesce a leggere compaiono nel riepilogo dell'esecuzione con un avviso giallo.
- Per provare senza rete: `node scripts/giudice.mjs --dump` stampa il testo dei PDF; `node scripts/giudice.mjs --file testo.txt` lo analizza.

Il codice è in `scripts/aggiorna.mjs` (aggiornamento del file) e `scripts/tabellini.mjs` (lettura degli articoli) e `scripts/giudice.mjs` (comunicati del Giudice Sportivo).
Se una squadra compare negli articoli con un nome nuovo, basta aggiungere l'alias alla sua espressione regolare nella tabella `T` di `index.html`.
