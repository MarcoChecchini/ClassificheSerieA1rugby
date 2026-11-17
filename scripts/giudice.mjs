// Legge i comunicati del Giudice Sportivo della Serie A maschile (PDF su federugby.it)
// e salva in index.html, nel blocco SQUALIFICHE, le squalifiche dei giocatori con il motivo.
// Uso: node scripts/giudice.mjs          (scarica i comunicati della stagione)
//      node scripts/giudice.mjs --dump   (stampa solo il testo dei PDF, per le prove)
// Serve pdfjs-dist:  npm i --no-save pdfjs-dist@4
import fs from "node:fs";

const FILE = new URL("../index.html", import.meta.url);
const SITE = "https://www.federugby.it";
const STAGIONE = process.env.STAGIONE_GS || "2026.2027";        // come nel nome dei PDF: COMAMASCH04GS2026.2027.pdf
const UA = { "User-Agent": "ClassificheSerieA1rugby (+https://github.com/MarcoChecchini/ClassificheSerieA1rugby)" };
const DUMP = process.argv.includes("--dump");

const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

// testo del PDF, riga per riga (le parole con la stessa altezza sulla pagina formano una riga)
async function pdfText(buf) {
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
  for (const q of ["Comunicato Serie A Maschile GS", "Giudice Sportivo Comunicato Serie A Maschile"]) {
    for (let page = 1; page <= 3; page++) {
      const r = await fetch(`${SITE}/wp-json/wp/v2/search?search=${encodeURIComponent(q)}&per_page=50&page=${page}`, { headers: UA });
      if (!r.ok) break;
      const list = await r.json();
      if (!list.length) break;
      for (const it of list) {
        if (!/serie-a-maschile/i.test(it.url) || /elite|femminile/i.test(it.url) || seen.has(it.url)) continue;
        seen.set(it.url, it.title);
      }
    }
  }
  const out = [];
  for (const [url, title] of seen) {
    const h = await (await fetch(url, { headers: UA })).text();
    const pdf = [...new Set(h.match(/https?:\/\/[^"' ]+COMAMASCH\d+GS[^"' ]+\.pdf/gi) || [])]
      .find(u => u.includes(STAGIONE));
    if (!pdf) continue;
    const num = +(pdf.match(/COMAMASCH(\d+)GS/i) || [])[1];
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

// sezione "ILLECITI TECNICI A CARICO DI GIOCATORI - SQUALIFICHE": una voce per riga che inizia con "-"
function squalifiche(lines) {
  const i = lines.findIndex(l => /ILLECITI\s+TECNICI\s+A\s+CARICO\s+DI\s+GIOCATORI/i.test(l));
  if (i < 0) return [];
  const voci = [];
  for (let k = i + 1; k < lines.length; k++) {
    const l = lines[k];
    if (/^(ILLECITI|AMMONIZIONI|SANZIONI|ATTENZIONE|Il Segretario|Il Giudice|SQUALIFICHE A CARICO|ILLECITI DISCIPLINARI)/i.test(l) && !/^-/.test(l)) break;
    if (/^[-–•]\s*/.test(l)) voci.push(l.replace(/^[-–•]\s*/, ""));
    else if (voci.length) voci[voci.length - 1] += " " + l;
  }
  return voci.map(v => {
    const m = v.match(/^([A-ZÀ-ÝʼʹŸ'’ .-]+?),\s*della\s+(.+?),\s*(.*)$/);
    if (!m) return { testo: v };
    const testo = m[3].trim();
    const squal = (testo.match(/((?:UNA|DUE|TRE|QUATTRO|CINQUE|SEI|SETTE|OTTO|NOVE|DIECI|\d+)\s+(?:SETTIMAN[AE]|GIORNAT[AE]|MES[EI])[^()]*?SQUALIFICA)/i) || [])[1] || "";
    const periodo = (testo.match(/\(\s*dal[^)]*\)/i) || [])[0] || "";
    const motivo = (testo.match(/infraz\.?[^,]*?\(([^)]+)\)/i) || [])[1] || "";
    const min = testo.match(/espulso\s+al\s+(\d+)\s*['’′]?\s*del\s*(\d)/i);
    return { nome: m[1].trim(), squadra: m[2].trim(), testo, motivo, squalifica: (squal + " " + periodo).trim(), minuto: min ? +min[1] + (min[2] === "2" ? 40 : 0) : null };
  });
}

const html = fs.readFileSync(FILE, "utf8");
const bm = html.match(/\/\*SQUALIFICHE-INIZIO\*\/([\s\S]*?)\/\*SQUALIFICHE-FINE\*\//);
if (!bm && !DUMP) throw new Error("Blocco SQUALIFICHE-INIZIO / SQUALIFICHE-FINE non trovato in index.html");
const OLD = bm ? JSON.parse(bm[1]) : [];
const giaFatti = new Set(OLD.map(s => s.pdf));    // i comunicati già letti non si toccano: restano le correzioni a mano

const list = await comunicati();
console.log(`Comunicati trovati: ${list.map(c => c.num).join(", ") || "nessuno"}`);
const nuovi = [], problemi = [];
for (const c of list) {
  if (!DUMP && giaFatti.has(c.pdf)) continue;
  const r = await fetch(c.pdf, { headers: UA });
  if (!r.ok) { problemi.push(`${c.pdf}: risposta ${r.status}`); continue; }
  const lines = await pdfText(await r.arrayBuffer());
  if (DUMP) { console.log(`\n===== ${c.num} ${c.pdf}\n` + lines.join("\n")); continue; }
  const data = riunione(lines);
  const sq = squalifiche(lines);
  sq.forEach(s => nuovi.push({ com: c.num, data, pdf: c.pdf, ...s }));
  if (!sq.length) nuovi.push({ com: c.num, data, pdf: c.pdf, vuoto: true });   // segna il comunicato come letto
  console.log(`Comunicato ${c.num} (${data}): ${sq.length} squalifiche`);
  sq.filter(s => !s.nome).forEach(s => problemi.push(`Comunicato ${c.num}: voce non riconosciuta: ${s.testo.slice(0, 120)}`));
}
if (DUMP) process.exit(0);

if (nuovi.length) {
  const all = [...OLD, ...nuovi].sort((a, b) => a.com - b.com);
  const block = "/*SQUALIFICHE-INIZIO*/[\n" + all.map(s => JSON.stringify(s)).join(",\n") + "\n]/*SQUALIFICHE-FINE*/";
  fs.writeFileSync(FILE, html.replace(bm[0], block));
  console.log(`Aggiunte ${nuovi.filter(s => !s.vuoto).length} squalifiche da ${new Set(nuovi.map(s => s.com)).size} comunicati.`);
} else console.log("Nessun comunicato nuovo.");

if (process.env.GITHUB_STEP_SUMMARY) {
  let md = `### Giudice Sportivo\n\nComunicati letti: ${list.map(c => c.num).join(", ") || "nessuno"}. Squalifiche nuove: ${nuovi.filter(s => !s.vuoto).length}.\n`;
  if (problemi.length) md += "\n**Da controllare a mano** (blocco `SQUALIFICHE` di `index.html`):\n\n" + problemi.map(p => "- " + p).join("\n") + "\n";
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `problemi_gs=${problemi.length}\n`);
problemi.forEach(p => console.log("ATTENZIONE: " + p));
