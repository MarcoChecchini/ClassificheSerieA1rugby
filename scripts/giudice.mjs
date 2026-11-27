// Legge i comunicati del Giudice Sportivo della Serie A maschile (PDF su federugby.it)
// e salva in index.html, nel blocco SQUALIFICHE, le squalifiche dei giocatori con il motivo.
// Uso: node scripts/giudice.mjs          (scarica i comunicati della stagione)
//      node scripts/giudice.mjs --dump   (stampa solo il testo dei PDF, per le prove)
// Serve pdfjs-dist:  npm i --no-save pdfjs-dist@4
import fs from "node:fs";

// CAMPIONATO=<chiave di scripts/campionati.mjs> (femminile, serie-b, serie-a-femminile, under-18): comunicati di
// quel campionato, salvati nella sua pagina. Senza CAMPIONATO: Serie A maschile in index.html.
import { CAMPIONATI } from "./campionati.mjs";
const CFG = CAMPIONATI[process.env.CAMPIONATO || "maschile"];
if (!CFG) throw new Error("CAMPIONATO sconosciuto: " + process.env.CAMPIONATO);
const PAGINA = CFG.pagina;
const FILE = new URL("../" + PAGINA, import.meta.url);
const QUERY = CFG.query;
const URL_OK = CFG.url;
const SIGLA = CFG.sigla;
const SITE = "https://www.federugby.it";
const STAGIONE = process.env.STAGIONE_GS || "2026.2027";        // come nel nome dei PDF: COMAMASCH04GS2026.2027.pdf
const UA = { "User-Agent": "ClassificheSerieA1rugby (+https://github.com/MarcoChecchini/ClassificheSerieA1rugby)" };
const DUMP = process.argv.includes("--dump");


// testo del PDF, riga per riga (le parole con la stessa altezza sulla pagina formano una riga)
async function pdfText(buf) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false }).promise;
  const out = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const { items } = await page.getTextContent();
    const rows = [];
    for (const it of items) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5]), x = it.transform[4];
      let r = rows.find(r => Math.abs(r.y - y) <= 2);
      if (!r) rows.push(r = { y, parts: [] });
      r.parts.push({ x, s: it.str });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) out.push(r.parts.sort((a, b) => a.x - b.x).map(p => p.s).join("").replace(/\s+/g, " ").trim());
  }
  return out.filter(Boolean);
}

// elenco dei comunicati: pagine "documenti" del sito con il PDF COMAMASCHxxGS<stagione>.pdf
async function comunicati() {
  const seen = new Map();
  for (const q of QUERY) {
    for (let page = 1; page <= 3; page++) {
      const r = await fetch(`${SITE}/wp-json/wp/v2/search?search=${encodeURIComponent(q)}&per_page=50&page=${page}`, { headers: UA });
      if (!r.ok) break;
      const list = await r.json();
      if (!list.length) break;
      for (const it of list) {
        if (!URL_OK(it.url) || seen.has(it.url)) continue;
        seen.set(it.url, it.title);
      }
    }
  }
  const out = [];
  for (const [url, title] of seen) {
    const h = await (await fetch(url, { headers: UA })).text();
    const pdf = [...new Set(h.match(new RegExp(`https?:\\/\\/[^"' ]+${SIGLA}\\d+GS[^"' ]+\\.pdf`, "gi")) || [])]
      .find(u => u.includes(STAGIONE));
    if (!pdf) continue;
    const num = +(pdf.match(new RegExp(`${SIGLA}(\\d+)GS`, "i")) || [])[1];
    out.push({ url, title: title.replace(/&#\d+;/g, "–"), pdf, num });
  }
  // i PDF compaiono anche tra gli "ultimi documenti" di ogni pagina: uno per numero
  const byNum = new Map();
  out.forEach(c => { if (!byNum.has(c.num) || c.url.includes(String(c.num).padStart(2, "0"))) byNum.set(c.num, c); });
  return [...byNum.values()].sort((a, b) => a.num - b.num);
}

const MESI = { gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6, luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12 };
function riunione(lines) {
  const t = lines.slice(0, 15).join(" ");
  const m = t.match(/Riunione\s+del(?:l['’])?\s*(\d{1,2})\s+([a-zà]+)\s+(\d{4})/i);
  if (!m || !MESI[m[2].toLowerCase()]) return null;
  return `${m[3]}-${String(MESI[m[2].toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

// Sezioni con le squalifiche dei giocatori:
//  "SQUALIFICA AUTOMATICA - Doppio Cartellino Giallo" e "ILLECITI TECNICI A CARICO DI GIOCATORI - SQUALIFICHE".
// Ogni voce comincia con "- COGNOME NOME, della SQUADRA, ..." e può continuare sulle righe dopo.
const NUM = "UN|UNA|DUE|TRE|QUATTRO|CINQUE|SEI|SETTE|OTTO|NOVE|DIECI|UNDICI|DODICI|\\d+";
const SANZ = new RegExp(`(?:${NUM})\\s+(?:SETTIMAN[AE]|GIORNAT[AE]|MES[EI]|GIORNI)\\s+DI\\s+SQUALIFICA(?:\\s+AUTOMATICA)?`, "gi");
const INIZIO = /^(SQUALIFICA\s+AUTOMATICA|ILLECITI\s+TECNICI\s+A\s+CARICO\s+DI\s+GIOCATORI)/i;
const FINE = /^(ILLECITI\s+TECNICI\s+A\s+CARICO\s+DI\s+(TESSERATI|SOGGETTI)|ILLECITI\s+DISCIPLINARI|ATTENZIONE|AMMONIZIONI|SANZIONI\s+DI\s+GIOCO|Il\s+Segretario|DELIBERA)/i;
function squalifiche(lines) {
  const voci = [];let dentro = false;
  for (const l of lines) {
    if (INIZIO.test(l)) { dentro = true; continue; }
    if (FINE.test(l)) { dentro = false; continue; }
    if (!dentro || /^Segue$|^Com\.?\s*A\s*(Masch|Elite)/i.test(l)) continue;
    if (/^[-–•]\s+/.test(l)) voci.push(l.replace(/^[-–•]\s+/, ""));
    else if (voci.length) voci[voci.length - 1] += " " + l;
  }
  return voci.map(v => {
    v = v.replace(/\s+/g, " ").trim();
    const m = v.match(/^([^,]+?),\s*della\s+(.+?),\s*(.*)$/i);
    if (!m) return { testo: v };
    const testo = m[3].trim();
    const sanz = [...testo.matchAll(SANZ)].map(x => x[0]);
    const periodo = (testo.match(/\(\s*dal\s[^)]*\)/i) || [])[0] || "";
    const motivo = (testo.match(/infraz\.?\s*Art\.?\s*[\d/.]+\s*lett\.?\s*\w+\)\s*\(([^)]+)\)/i) || [])[1] || "";
    const mins = [...testo.matchAll(/al\s+(\d+)\s*[°º'’′]?\s*del\s*(1|2|primo|secondo)\s*°?\s*tempo/gi)];
    const last = mins[mins.length - 1];
    return {
      nome: m[1].trim(), squadra: m[2].trim(), motivo: motivo.trim().replace(/\bpungo\b/gi, "pugno"),
      squalifica: sanz.length ? sanz[sanz.length - 1].toLowerCase() : "",
      periodo: periodo.replace(/^\(\s*|\s*\)$/g, ""),
      minuto: last ? +last[1] + (/^(2|secondo)$/i.test(last[2]) ? 40 : 0) : null,
      testo
    };
  });
}

// Tutte le altre voci del comunicato (ammende alle società, ammonizioni, sanzioni a dirigenti e tecnici...):
// una voce per ogni riga che comincia con "-", con il titolo della sezione in cui si trova.
// Le squalifiche dei giocatori restano nel blocco SQUALIFICHE e qui non vengono ripetute.
const SEZ = /^(ILLECITI|SANZIONI|AMMEND|AMMONIZION|PROVVEDIMENT|INIBIZION|SQUALIFIC|RECLAM|OMOLOGAZION|RISULTAT|DECISION|DELIBER|RICHIAM|DIFFID|PENALIZZAZ)/i;
const STOP = /^(Il\s+Segretario|Il\s+Giudice|ATTENZIONE|Roma,?\s)/i;
function altreSanzioni(lines) {
  const voci = [];let sez = null;
  for (const l of lines) {
    if (STOP.test(l)) { sez = null; continue; }
    if (!/^[-–•]/.test(l) && SEZ.test(l) && l === l.toUpperCase()) { sez = INIZIO.test(l) ? null : l.replace(/\s+/g, " ").trim(); continue; }
    if (!sez || /^Segue$|^Com\.?\s*A\s*(Masch|Elite)/i.test(l)) continue;
    if (/^[-–•]\s+/.test(l)) voci.push({ sezione: sez, testo: l.replace(/^[-–•]\s+/, "") });
    else if (voci.length && voci[voci.length - 1].sezione === sez) voci[voci.length - 1].testo += " " + l;
  }
  return voci.map(v => ({ sezione: v.sezione, testo: v.testo.replace(/\s+/g, " ").trim() }));
}

// prova senza rete: node scripts/giudice.mjs --file dump.txt  (testo come lo stampa --dump)
if (process.argv.includes("--file")) {
  const t = fs.readFileSync(process.argv[process.argv.indexOf("--file") + 1], "utf8").split(/\n===== /).slice(1);
  for (const blk of t) { const lines = blk.split("\n"); console.log("\n#" + lines[0], riunione(lines.slice(1))); squalifiche(lines.slice(1)).forEach(x => console.log(JSON.stringify(x))); altreSanzioni(lines.slice(1)).forEach(x => console.log("altro", JSON.stringify(x))); }
  process.exit(0);
}

const html = fs.readFileSync(FILE, "utf8");
const bm = html.match(/\/\*SQUALIFICHE-INIZIO\*\/([\s\S]*?)\/\*SQUALIFICHE-FINE\*\//);
if (!bm && !DUMP) throw new Error("Blocco SQUALIFICHE-INIZIO / SQUALIFICHE-FINE non trovato in " + PAGINA);
const OLD = bm ? JSON.parse(bm[1]) : [];
const giaFatti = new Set(OLD.map(s => s.pdf));    // i comunicati già letti non si toccano: restano le correzioni a mano
const zm = html.match(/\/\*SANZIONI-INIZIO\*\/([\s\S]*?)\/\*SANZIONI-FINE\*\//);
const OLDZ = zm ? JSON.parse(zm[1]) : [];
const giaFattiZ = new Set(OLDZ.map(s => s.pdf));

const list = await comunicati();
console.log(`Comunicati trovati: ${list.map(c => c.num).join(", ") || "nessuno"}`);
const nuovi = [], nuoviZ = [], problemi = [];
for (const c of list) {
  if (!DUMP && giaFatti.has(c.pdf) && (!zm || giaFattiZ.has(c.pdf))) continue;
  const r = await fetch(c.pdf, { headers: UA });
  if (!r.ok) { problemi.push(`${c.pdf}: risposta ${r.status}`); continue; }
  const lines = await pdfText(await r.arrayBuffer());
  if (DUMP) { console.log(`\n===== ${c.num} ${c.pdf}\n` + lines.join("\n")); continue; }
  const data = riunione(lines);
  if (zm && !giaFattiZ.has(c.pdf)) {
    const z = altreSanzioni(lines);
    z.forEach(x => nuoviZ.push({ com: c.num, data, pdf: c.pdf, ...x }));
    if (!z.length) nuoviZ.push({ com: c.num, data, pdf: c.pdf, vuoto: true });
    console.log(`Comunicato ${c.num} (${data}): ${z.length} altre voci (ammende, ammonizioni...)`);
  }
  if (giaFatti.has(c.pdf)) continue;
  const sq = squalifiche(lines);
  sq.forEach(s => nuovi.push({ com: c.num, data, pdf: c.pdf, ...s }));
  if (!sq.length) nuovi.push({ com: c.num, data, pdf: c.pdf, vuoto: true });   // segna il comunicato come letto
  console.log(`Comunicato ${c.num} (${data}): ${sq.length} squalifiche`);
  sq.filter(s => !s.nome).forEach(s => problemi.push(`Comunicato ${c.num}: voce non riconosciuta: ${s.testo.slice(0, 120)}`));
}
if (DUMP) process.exit(0);

let out = html;
if (nuoviZ.length) {
  const all = [...OLDZ, ...nuoviZ].sort((a, b) => a.com - b.com);
  out = out.replace(zm[0], "/*SANZIONI-INIZIO*/[\n" + all.map(s => JSON.stringify(s)).join(",\n") + "\n]/*SANZIONI-FINE*/");
  console.log(`Aggiunte ${nuoviZ.filter(s => !s.vuoto).length} altre voci del Giudice Sportivo.`);
}
if (nuovi.length) {
  const all = [...OLD, ...nuovi].sort((a, b) => a.com - b.com);
  const block = "/*SQUALIFICHE-INIZIO*/[\n" + all.map(s => JSON.stringify(s)).join(",\n") + "\n]/*SQUALIFICHE-FINE*/";
  out = out.replace(bm[0], block);
  console.log(`Aggiunte ${nuovi.filter(s => !s.vuoto).length} squalifiche da ${new Set(nuovi.map(s => s.com)).size} comunicati.`);
} else console.log("Nessun comunicato nuovo.");
if (out !== html) fs.writeFileSync(FILE, out);

if (process.env.GITHUB_STEP_SUMMARY) {
  let md = `### Giudice Sportivo (${PAGINA})\n\nComunicati letti: ${list.map(c => c.num).join(", ") || "nessuno"}. Squalifiche nuove: ${nuovi.filter(s => !s.vuoto).length}.\n`;
  if (problemi.length) md += "\n**Da controllare a mano** (blocco `SQUALIFICHE` di `${PAGINA}`):\n\n" + problemi.map(p => "- " + p).join("\n") + "\n";
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `problemi_gs=${problemi.length}\n`);
problemi.forEach(p => console.log("ATTENZIONE: " + p));
