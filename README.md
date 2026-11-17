# ClassificheSerieA1rugby
Contiene le classifiche giornata per giornata del campionato di Serie A di rugby (girone A1 e i tre gironi A2), con calendario completo e le rose dei giocatori.

La pagina ha due sezioni:
- **Classifiche**: classifica, risultati e calendario di tutte le 22 giornate (le partite da giocare hanno il punteggio `-- – --`). Toccando una squadra si vedono i giocatori scesi in campo, partita per partita o in totale, con minuti, mete, trasformazioni, calci, drop, punti e cartellini.
- **Rose giocatori**: le rose 2026-27 dall'annuario *Rugby 2027* (Pacitti – Volpe), divise per girone e per ruolo. Toccando un giocatore si vede la sua scheda partita per partita.

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

Il codice è in `scripts/aggiorna.mjs` (aggiornamento del file) e `scripts/tabellini.mjs` (lettura degli articoli).
Se una squadra compare negli articoli con un nome nuovo, basta aggiungere l'alias alla sua espressione regolare nella tabella `T` di `index.html`.
