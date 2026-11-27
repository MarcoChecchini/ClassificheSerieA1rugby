// Costruisce e aggiorna i dati di un campionato senza tabellini (Serie B, Serie A femminile, Under 18 Titolo)
// dal Match Centre FIR e dai comunicati del Giudice Sportivo:
//  - squadre e gironi (tabella T), calendario (CAL), arbitri/orari/campi (ARBITRI), penalità (PEN) dal Match Centre;
//  - risultati (DATA) dal Match Centre, con le mete di ogni partita lette dall'omologazione dei comunicati
//    (PDF); se il comunicato non è ancora uscito, dal totale mete della classifica del Match Centre.
// Uso: node scripts/campionato.mjs serie-b            (chiave di scripts/campionati.mjs)
//      node scripts/campionato.mjs serie-b mc.json    (prova con una risposta del Match Centre salvata; niente comunicati)
// Serve pdfjs-dist per leggere i comunicati:  npm i --no-save pdfjs-dist@4
import fs from "node:fs";
import { CAMPIONATI } from "./campionati.mjs";

const KEY = process.argv[2], C = CAMPIONATI[KEY];
if (!C) throw new Error("Campionato sconosciuto: " + KEY + " (vedi scripts/campionati.mjs)");
const FILE = new URL("../" + C.pagina, import.meta.url);
const STAG = process.env.STAGIONE_MC || "20262027", STAGIONE = process.env.STAGIONE_GS || "2026.2027";
const SITE = "https://www.federugby.it";
const MC = `${SITE}/matchcentre/firapi.php?action=dettagli&id=${C.mc}${STAG}&session_id=${STAG.slice(4)}`;
const UA = { "User-Agent": "ClassificheSerieA1rugby (+https://github.com/MarcoChecchini/ClassificheSerieA1rugby)" };
const problems = [], changes = [];

let html = fs.readFileSync(FILE, "utf8");
const block = (name) => { const m = html.match(new RegExp(`\\/\\*${name}-INIZIO\\*\\/([\\s\\S]*?)\\/\\*${name}-FINE\\*\\/`)); if (!m) throw new Error(`Blocco ${name} non trovato in ${C.pagina}`); return m; };
const put = (name, val) => { const m = block(name); html = html.replace(m[0], () => `/*${name}-INIZIO*/${val}/*${name}-FINE*/`); };

// ---------- nomi ----------
const plain = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
// forme societarie da togliere dal nome mostrato (il nome completo resta per riconoscere la squadra)
const SUFF = [/SOC\.?\s*COOP\.?\s*(S\.?\s*D\.?|DIL\.?)?\s*(A\.?\s*R\.?\s*L\.?)?/g, /\bS\.?\s?S\.?\s?D\.?\s*(A\s*R\.?\s*L\.?|ARL|RL)?/g, /\bA\.?\s?S\.?\s?D\.?/g, /\bS\.?\s?R\.?\s?L\.?/g,
  /\bA\.?\s?R\.?\s?L\.?/g, /\bA\s+R\.\s?L\./g, /\bS\.D\.?/g, /\bS\.?P\.?A\.?(?=\s|$)/g, /\b(SCARL|SCRL|SSDARL|SSDRL|ONLUS|APS|A\.P\.S\.)(?=\s|$)/g, /\bDIL\.(?=\s|$)/g, /^POL\.\s*/g, /\bAD$/g, /\bF\.C\.\s*(?=\d)/g];
const tcap = s => s.toLowerCase().replace(/(^|[\s'’.-])(\S)/g, (a, b, c) => b + c.toUpperCase()).replace(/\bCus\b/g, "CUS").replace(/\bAsr\b/g, "ASR").replace(/\bXv\b/g, "XV").replace(/\b(R|F)\.(C|Fem|F)\b/g, m => m.toUpperCase());
const pretty = n => { let s = plain(n).replace(/C\.\s?U\.\s?S\./g, "CUS").replace(/\bF\.C\.(?=\d)/g, "F.C. "); for (const re of SUFF) s = s.replace(re, " ");
  s = s.replace(/\s+/g, " ").replace(/^[\s.,-]+|[\s.,-]+$/g, "").trim(); return s ? tcap(s) : tcap(plain(n)); };
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------- Match Centre ----------
const body = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], "utf8"))
  : await (async () => { const r = await fetch(MC, { headers: UA }); if (!r.ok) throw new Error(`Match Centre: risposta ${r.status}`); return r.json(); })();
if (!body.success || !body.result || !body.result.fasi) throw new Error("Match Centre: risposta non valida");
let fasi = body.result.fasi.filter(f => /regolare|regular/i.test(f.fase || ""));
if (!fasi.length) fasi = body.result.fasi.slice(0, 1);
const v = s => (s || "").trim();
const persona = (nome, pv) => { nome = v(nome).replace(/\s*\(\s*\)\s*$/, ""); if (!nome) return null; const m = nome.match(/^(.*?)\s*\(([A-Z]{2})\)$/); if (m) { nome = m[1]; pv = m[2]; } return [nome, v(pv)]; };
const gir = [], partite = [], classifica = {};
for (const fase of fasi) for (const g of fase.gironi || []) {
  const gn = gir.length + 1; gir.push(v(g.girone) || "Girone " + gn);
  for (const c of [...(g.classifica || []), ...(fase.classifica && fase.gironi.length === 1 ? fase.classifica : [])]) classifica[plain(c.squadra)] = c;
  for (const cm of g.comunicati || []) for (const ti of cm.tipi_incontro || []) for (const gg of ti.giornate || []) {
    const gi = +((gg.giornata || "").match(/\d+/) || [])[0];
    for (const p of gg.partite || []) {
      const d = (v(p.data).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) || []);
      const s = v(p.punteggio).match(/^(\d+)\s*:\s*(\d+)$/);
      partite.push({ g: gn, gi, H: plain(p.home_nome), A: plain(p.guest_nome), data: d.length ? `${d[3]}-${d[2].padStart(2, "0")}-${d[1].padStart(2, "0")}` : "",
        ora: v(p.ora), campo: v(p.campo), hs: s ? +s[1] : null, as: s ? +s[2] : null, arb: persona(p.arbitro), gl: [persona(p.giudiceLinea1, p.giudice1Pv), persona(p.giudiceLinea2, p.giudice2Pv)].filter(Boolean), tmo: persona(p.tmo, p.tmoPv) });
    }
  }
}
if (!partite.length) throw new Error("Match Centre: nessuna partita");

// ---------- squadre ----------
const teams = new Map();   // nome MC -> {n, g}
for (const p of partite) for (const k of [p.H, p.A]) if (!teams.has(k)) teams.set(k, { n: pretty(k), g: p.g });
const nomi = new Map(); for (const [k, t] of teams) { const d = [...teams.values()].filter(x => x.n === t.n); if (d.length > 1) t.n = tcap(plain(k)); }
const T = [...teams.entries()].sort((a, b) => a[1].g - b[1].g || a[1].n.localeCompare(b[1].n));
const byLen = [...T].sort((a, b) => b[0].length - a[0].length);      // i nomi più lunghi prima (nessun nome contenuto in un altro)
const tSrc = "const T=[\n" + byLen.map(([k, t]) => `[${JSON.stringify(t.n)},${t.g},/(^|[^A-Z0-9])${esc(k).replace(/\//g, "\\/")}($|[^A-Z0-9])/]`).join(",\n") + "\n].map(([n,g,re])=>({n,g,re}));";
html = html.replace(/const T=\[[\s\S]*?\]\.map\(\(\[n,g,re\]\)=>\(\{n,g,re\}\)\);/, () => tSrc);
const N = k => teams.get(k).n;
// gironi: nomi per le schede
html = html.replace(/const GIRNOMI=\{.*?\};/, () => "const GIRNOMI=" + JSON.stringify(Object.fromEntries(gir.map((n, i) => [i + 1, n]))) + ";");

// ---------- calendario e arbitri ----------
const CAL = {};
for (let g = 1; g <= gir.length; g++) {
  const ps = partite.filter(p => p.g === g), ng = Math.max(0, ...ps.map(p => p.gi));
  CAL[g] = Array.from({ length: ng }, (_, i) => { const r = ps.filter(p => p.gi === i + 1), ds = {}; r.forEach(p => { if (p.data) ds[p.data] = (ds[p.data] || 0) + 1 });
    return { d: Object.entries(ds).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "", m: r.map(p => [N(p.H), N(p.A)]) }; });
}
const NGT = Math.max(...Object.values(CAL).map(c => c.length));
html = html.replace(/const NGT=\d+,CAL=\{.*?\};\n/, () => `const NGT=${NGT},CAL=${JSON.stringify(CAL)};\n`);
const ARB = partite.map(p => { const x = { g: p.g, gi: p.gi, h: N(p.H), a: N(p.A), data: p.data, ora: p.ora, campo: p.campo }; if (p.arb) x.arb = p.arb; if (p.gl.length) x.gl = p.gl; if (p.tmo) x.tmo = p.tmo; return x; })
  .sort((x, y) => x.g - y.g || x.gi - y.gi || x.h.localeCompare(y.h));
put("ARBITRI", "[\n" + ARB.map(x => JSON.stringify(x)).join(",\n") + "\n]");
// penalità in classifica dal Match Centre (valgono dalla prima giornata)
const PEN = T.map(([k, t]) => { const c = classifica[k]; const p = c ? parseInt(String(c.penalita).replace(/\s/g, "").replace(/^(\d+)-$/, "-$1"), 10) : 0; return p ? { t: t.n, r: 0, p: p > 0 ? -p : p } : null; }).filter(Boolean);
html = html.replace(/const PEN=\[.*?\];/, () => "const PEN=" + JSON.stringify(PEN) + ";");

// ---------- risultati con le mete ----------
const dm = block("DATI"), OLD = JSON.parse(dm[1]);
const oldTries = {};      // "H|A" -> [ht, at] dalle righe già presenti (nomi MC in maiuscolo)
for (const o of Object.values(OLD)) for (const rows of Object.values(o)) for (const l of rows) {
  const m = l.match(/^(.*?)\s+(\d+)\s*-\s*(\d+)\s*\(\s*(\d+)\s*-\s*(\d+)\s*\)/); if (!m) continue;
  const [h, a] = m[1].split(/\s+-\s+/); if (h && a) oldTries[plain(h) + "|" + plain(a)] = [+m[4], +m[5]];
}
const giocate = partite.filter(p => p.hs != null);
const mancano = giocate.filter(p => !oldTries[p.H + "|" + p.A]);
// mete dai comunicati (solo se servono)
const fromCom = {};
if (mancano.length && !process.argv[3]) {
  try { Object.assign(fromCom, await meteDaiComunicati()); } catch (e) { problems.push("Comunicati non letti: " + e.message); }
}
// riserva: totale mete della classifica del Match Centre meno le mete già note (una sola partita nuova per squadra)
const note = {}; giocate.forEach(p => { const t = oldTries[p.H + "|" + p.A] || fromCom[p.H + "|" + p.A]; if (t) { note[p.H] = (note[p.H] || 0) + t[0]; note[p.A] = (note[p.A] || 0) + t[1]; } });
const senza = giocate.filter(p => !oldTries[p.H + "|" + p.A] && !fromCom[p.H + "|" + p.A]);
const daMC = k => senza.filter(p => p.H === k || p.A === k).length === 1 && classifica[k] ? +classifica[k].mete - (note[k] || 0) : null;
const DATA = {};
for (const p of giocate.sort((x, y) => x.g - y.g || x.gi - y.gi)) {
  let t = oldTries[p.H + "|" + p.A] || fromCom[p.H + "|" + p.A];
  if (!t) { const a = daMC(p.H), b = daMC(p.A); if (a != null && b != null && a >= 0 && b >= 0 && a * 5 <= p.hs + 2 && b * 5 <= p.as + 2) t = [a, b]; }
  if (!t) { problems.push(`Girone ${p.g}, giornata ${p.gi}: ${N(p.H)} – ${N(p.A)} ${p.hs}-${p.as}: mete non ancora disponibili (arriveranno con il comunicato)`); continue; }
  ((DATA[p.g] ??= {})[p.gi] ??= []).push(`${p.H} - ${p.A} ${p.hs} - ${p.as} ( ${t[0]}- ${t[1]})`);
  if (!oldTries[p.H + "|" + p.A]) changes.push(`Girone ${p.g}, giornata ${p.gi}: ${N(p.H)} – ${N(p.A)} ${p.hs}-${p.as} (mete ${t[0]}-${t[1]})`);
}
const dataSrc = "{\n" + Object.keys(DATA).sort((a, b) => a - b).map(g => `"${g}":{\n` + Object.keys(DATA[g]).sort((a, b) => a - b).map(gi => ` "${gi}":[\n` + DATA[g][gi].map(r => "  " + JSON.stringify(r)).join(",\n") + "]").join(",\n") + "}").join(",\n") + "\n}";
put("DATI", dataSrc);
fs.writeFileSync(FILE, html);

const report = [`### ${C.nome} ${C.sub} (${C.pagina})`, `Gironi: ${gir.length}, squadre: ${teams.size}, partite giocate: ${giocate.length}.`,
  changes.length ? `Risultati nuovi (${changes.length}):\n- ` + changes.slice(0, 60).join("\n- ") + (changes.length > 60 ? `\n- … e altri ${changes.length - 60}` : "") : "Nessun risultato nuovo.",
  problems.length ? `Da controllare (${problems.length}):\n- ` + problems.join("\n- ") : ""].filter(Boolean).join("\n\n");
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report.replace(/\n- /g, "\n* ") + "\n");

// ---------- comunicati: omologazione dei risultati con le mete ----------
async function meteDaiComunicati() {
  const seen = new Map();
  for (const q of C.query) for (let page = 1; page <= 3; page++) {
    const r = await fetch(`${SITE}/wp-json/wp/v2/search?search=${encodeURIComponent(q)}&per_page=50&page=${page}`, { headers: UA });
    if (!r.ok) break; const list = await r.json(); if (!list.length) break;
    for (const it of list) if (C.url(it.url) && !seen.has(it.url)) seen.set(it.url, it.title);
  }
  const pdfs = new Set();
  for (const url of seen.keys()) {
    const h = await (await fetch(url, { headers: UA })).text();
    // il PDF del comunicato è il primo della pagina (a volte con il nome sbagliato, es. COMB02S invece di COMB02GS)
    const u = (h.match(new RegExp(`https?:\\/\\/[^"' ]+${C.sigla}\\d+G?S[^"' ]*\\.pdf`, "i")) || [])[0];
    if (u && u.includes(STAGIONE)) pdfs.add(u);
  }
  // righe dell'omologazione: "CASA -OSPITE 33 - 15 ( 5- 2) Sig. ..." -> si abbina alla partita con lo stesso punteggio
  // e il maggior numero di parole dei due nomi (i nomi nei PDF a volte sono tagliati o scritti diversamente)
  const STOP = new Set(["RUGBY", "ASD", "SSD", "A.S.D.", "S.S.D.", "ARL", "SRL", "CLUB", "A", "R.L.", "DI", "DEL", "1"]);
  const words = s => plain(s).replace(/[^A-Z0-9' ]/g, " ").split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
  const righe = [];
  for (const u of pdfs) {
    const r = await fetch(u, { headers: UA }); if (!r.ok) { problems.push(`${u}: risposta ${r.status}`); continue; }
    for (const l of await pdfText(await r.arrayBuffer())) {
      const m = plain(l).match(/^(.+?)\s+(\d+)\s*-\s*(\d+)\s*\(\s*(\d+)\s*-\s*(\d+)\s*\)/); if (m) righe.push({ w: words(m[1]), hs: +m[2], as: +m[3], ht: +m[4], at: +m[5] });
    }
  }
  const out = {};
  for (const p of partite) {
    if (p.hs == null) continue;
    const wh = words(p.H), wa = words(p.A);
    let best = null, bs = 0;
    for (const r of righe) {
      if (r.hs !== p.hs || r.as !== p.as) continue;
      const ih = Math.max(-1, ...wh.map(w => r.w.indexOf(w))), ia = Math.max(-1, ...wa.map(w => r.w.lastIndexOf(w)));
      const sh = wh.filter(w => r.w.includes(w)).length, sa = wa.filter(w => r.w.includes(w)).length;
      if (!sh || !sa || ih > ia) continue;
      const sc = sh / wh.length + sa / wa.length;
      if (sc > bs) { bs = sc; best = r; } else if (sc === bs && best && (best.ht !== r.ht || best.at !== r.at)) best = null;
    }
    if (best && bs >= 1) out[p.H + "|" + p.A] = [best.ht, best.at];
  }
  console.log(`Comunicati letti: ${pdfs.size}, partite con le mete: ${Object.keys(out).length}`);
  return out;
}
async function pdfText(buf) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false }).promise;
  const out = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const { items } = await (await doc.getPage(n)).getTextContent(), rows = [];
    for (const it of items) { if (!it.str) continue; const y = Math.round(it.transform[5]), x = it.transform[4]; let r = rows.find(r => Math.abs(r.y - y) <= 2); if (!r) rows.push(r = { y, parts: [] }); r.parts.push({ x, s: it.str }); }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) out.push(r.parts.sort((a, b) => a.x - b.x).map(p => p.s).join("").replace(/\s+/g, " ").trim());
  }
  return out.filter(Boolean);
}
