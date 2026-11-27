// Legge dal Match Centre della FIR (www.federugby.it/campionati/) gli ufficiali di gara della Serie A maschile
// (o, con PAGINA=femminile.html CATEGORIA_MC=163820262027, della Serie A Elite femminile)
// (arbitro, giudici di linea, TMO), più data, ora e campo di ogni partita, e li salva nel blocco ARBITRI di index.html.
// Le designazioni escono di solito il giovedì: la GitHub Action gira anche quel giorno.
// Uso: node scripts/arbitri.mjs              (scarica i dati dal sito)
//      node scripts/arbitri.mjs file.json    (usa una risposta già salvata, per le prove)
import fs from "node:fs";

const PAGINA = process.env.PAGINA || "index.html";
const FILE = new URL("../" + PAGINA, import.meta.url);
const UA = { "User-Agent": "ClassificheSerieA1rugby (+https://github.com/MarcoChecchini/ClassificheSerieA1rugby)" };
// Categoria "SERIE A1" del Match Centre (= Serie A maschile) e stagione: la pagina FIR usa session_id = anno di fine stagione.
const STAG = process.env.STAGIONE_MC || "20262027";
const CAT = process.env.CATEGORIA_MC || "522" + STAG;
const URL_API = `https://www.federugby.it/matchcentre/firapi.php?action=dettagli&id=${CAT}&session_id=${STAG.slice(4)}`;

const html = fs.readFileSync(FILE, "utf8");
const tSrc = html.match(/const T=(\[[\s\S]*?\]\.map\(\(\[n,g,re\]\)=>\(\{n,g,re\}\)\));/);
if (!tSrc) throw new Error("Tabella squadre (const T) non trovata in " + PAGINA);
const T = new Function("return " + tSrc[1])();
const find = s => { s = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase(); return T.find(t => t.re.test(s)); };

const bm = html.match(/\/\*ARBITRI-INIZIO\*\/([\s\S]*?)\/\*ARBITRI-FINE\*\//);
if (!bm) throw new Error("Blocco ARBITRI-INIZIO / ARBITRI-FINE non trovato in " + PAGINA);

let body;
if (process.argv[2]) body = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
else {
  const r = await fetch(URL_API, { headers: UA });
  if (!r.ok) throw new Error(`Match Centre FIR: risposta ${r.status}`);
  body = await r.json();
}
if (!body.success || !body.result || !body.result.fasi) throw new Error("Match Centre FIR: risposta non valida " + JSON.stringify(body).slice(0, 200));

const v = s => (s || "").trim();
const persona = (nome, pv) => { nome = v(nome).replace(/\s*\(\s*\)\s*$/, ""); if (!nome) return null;
  const m = nome.match(/^(.*?)\s*\(([A-Z]{2})\)$/); if (m) { nome = m[1]; pv = m[2]; }
  return [nome, v(pv)]; };

const out = [], problemi = [];
for (const fase of body.result.fasi) {
  if (!/regolare|regular/i.test(fase.fase || "")) continue;     // solo la stagione regolare
  for (const gir of fase.gironi || []) {
    const g = +((gir.girone || "").match(/\d+/) || [])[0];
    for (const c of gir.comunicati || []) for (const ti of c.tipi_incontro || []) for (const gg of ti.giornate || []) {
      const gi = +((gg.giornata || "").match(/\d+/) || [])[0];
      for (const p of gg.partite || []) {
        const h = find(p.home_nome), a = find(p.guest_nome);
        if (!h || !a) { problemi.push(`Girone ${g}, giornata ${gi}: squadra non riconosciuta (${p.home_nome} – ${p.guest_nome})`); continue; }
        const d = (v(p.data).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) || []);
        const x = { g: h.g, gi, h: h.n, a: a.n, data: d.length ? `${d[3]}-${d[2].padStart(2, "0")}-${d[1].padStart(2, "0")}` : "", ora: v(p.ora), campo: v(p.campo) };
        const arb = persona(p.arbitro), g1 = persona(p.giudiceLinea1, p.giudice1Pv), g2 = persona(p.giudiceLinea2, p.giudice2Pv), tmo = persona(p.tmo, p.tmoPv);
        if (arb) x.arb = arb;
        const gl = [g1, g2].filter(Boolean); if (gl.length) x.gl = gl;
        if (tmo) x.tmo = tmo;
        out.push(x);
      }
    }
  }
}
out.sort((x, y) => x.g - y.g || x.gi - y.gi || x.h.localeCompare(y.h));
const block = "/*ARBITRI-INIZIO*/[\n" + out.map(x => JSON.stringify(x)).join(",\n") + "\n]/*ARBITRI-FINE*/";
const designate = out.filter(x => x.arb).length;
if (out.length && block !== bm[0]) {
  fs.writeFileSync(FILE, html.replace(bm[0], block));
  console.log(`Ufficiali di gara aggiornati: ${out.length} partite, ${designate} con arbitro designato.`);
} else console.log(out.length ? "Ufficiali di gara: nessuna novità." : "Match Centre FIR: nessuna partita trovata.");

problemi.forEach(p => console.log("ATTENZIONE: " + p));
if (process.env.GITHUB_STEP_SUMMARY) {
  let md = `### Arbitri e giudici di linea (${PAGINA})\n\nPartite lette: ${out.length}, con arbitro designato: ${designate}.\n`;
  if (problemi.length) md += "\n**Da controllare** (aggiungere l'alias della squadra nella tabella `T` di `${PAGINA}`):\n\n" + problemi.map(p => "- " + p).join("\n") + "\n";
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `problemi_arb=${problemi.length}\n`);
