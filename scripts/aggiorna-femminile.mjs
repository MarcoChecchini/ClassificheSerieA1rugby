// Aggiorna femminile.html (Serie A Elite femminile):
//  1. risultati dal Match Centre FIR; le mete di ogni partita si ricavano dal totale mete della classifica del
//     Match Centre (ogni squadra gioca una partita per giornata), altrimenti dai marcatori del tabellino;
//  2. tabellini (formazioni, marcatori, cartellini) dagli articoli "Serie A Elite Femminile" di federugby.it,
//     convertiti nel formato della pagina da scripts/femtab.mjs.
// Uso: node scripts/aggiorna-femminile.mjs                          (scarica tutto dal sito)
//      node scripts/aggiorna-femminile.mjs mc.json articoli.json    (prove: risposta del Match Centre e [{id,date,link,content}])
import fs from "node:fs";
import { htmlToText } from "./tabellini.mjs";
import { parseFemArticle, toTabText } from "./femtab.mjs";

const FILE = new URL("../femminile.html", import.meta.url);
const STAG = process.env.STAGIONE_MC || "20262027";
const CAT = process.env.CATEGORIA_MC_F || "1638" + STAG;          // "SERIE A "ELITE" FEMMINILE" nel Match Centre
const MC = `https://www.federugby.it/matchcentre/firapi.php?action=dettagli&id=${CAT}&session_id=${STAG.slice(4)}`;
const API = "https://www.federugby.it/wp-json/wp/v2/posts";
const DA = process.env.STAGIONE_DAL || "2026-08-01T00:00:00";
const UA = { "User-Agent": "ClassificheSerieA1rugby (+https://github.com/MarcoChecchini/ClassificheSerieA1rugby)" };

const html = fs.readFileSync(FILE, "utf8");
const tSrc = html.match(/const T=(\[[\s\S]*?\]\.map\(\(\[n,g,re\]\)=>\(\{n,g,re\}\)\));/);
if (!tSrc) throw new Error("Tabella squadre (const T) non trovata in femminile.html");
const T = new Function("return " + tSrc[1])();
const find = s => { s = String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/C\.\s*U\.\s*S\./gi, "CUS").toUpperCase(); return T.find(t => t.re.test(s)); };
const dm = html.match(/\/\*DATI-INIZIO\*\/([\s\S]*?)\/\*DATI-FINE\*\//);
const tm = html.match(/\/\*TABELLINI-INIZIO\*\/([\s\S]*?)\/\*TABELLINI-FINE\*\//);
if (!dm || !tm) throw new Error("Blocchi DATI o TABELLINI non trovati in femminile.html");
const DATA = JSON.parse(dm[1]), TAB = JSON.parse(tm[1]);
DATA["1"] ??= {};
const row = line => { const m = line.match(/^(.*?)\s+(\d+)\s*-\s*(\d+)\s*\(\s*(\d+)\s*-\s*(\d+)\s*\)/); if (!m) return null; const p = m[1].split(/\s+-\s*/), h = find(p[0]), a = find(p[1]); return h && a ? { h: h.n, a: a.n, hs: +m[2], as: +m[3], ht: +m[4], at: +m[5] } : null; };
const line = (H, A, hs, as, ht, at) => `${H} - ${A} ${hs} - ${as} ( ${ht}- ${at})`;
const getJSON = async (url) => { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(`${url}: risposta ${r.status}`); return r.json(); };

const changes = [], problems = [], tabNew = [];

// ---------- articoli: tabellini (servono anche come riserva per le mete) ----------
let posts = [];
try {
  posts = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], "utf8"))
    : (await getJSON(`${API}?search=${encodeURIComponent("Serie A Elite Femminile")}&after=${DA}&per_page=50&orderby=date&order=asc&_fields=id,date,link,content`))
        .map(p => ({ id: p.id, date: p.date, link: p.link, content: p.content.rendered }));
} catch (e) { problems.push("Articoli FIR non letti: " + e.message); }
const arts = [], artProblems = [];
for (const p of posts) {
  const { matches, problems: pr } = parseFemArticle(htmlToText(p.content), T);
  matches.forEach(m => arts.push({ ...m, link: p.link }));
  pr.forEach(x => artProblems.push(`${x}  (${p.link || p.id})`));
}

// ---------- 1. risultati dal Match Centre ----------
try {
  const body = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], "utf8")) : await getJSON(MC);
  if (!body.success || !body.result || !body.result.fasi) throw new Error("risposta non valida");
  const played = [], mete = {};
  for (const fase of body.result.fasi) {
    if (!/regolare|regular/i.test(fase.fase || "")) continue;
    for (const gir of fase.gironi || []) {
      for (const c of [...(gir.classifica || []), ...(fase.classifica || [])]) { const t = find(c.squadra); if (t) mete[t.n] = +c.mete; }
      for (const c of gir.comunicati || []) for (const ti of c.tipi_incontro || []) for (const gg of ti.giornate || []) {
        const gi = +((gg.giornata || "").match(/\d+/) || [])[0];
        for (const p of gg.partite || []) {
          const s = String(p.punteggio || "").match(/^\s*(\d+)\s*:\s*(\d+)\s*$/); if (!s) continue;
          const h = find(p.home_nome), a = find(p.guest_nome);
          if (!h || !a) { problems.push(`Giornata ${gi}: squadra non riconosciuta (${p.home_nome} – ${p.guest_nome})`); continue; }
          played.push({ gi, h: h.n, a: a.n, H: p.home_nome.trim(), A: p.guest_nome.trim(), hs: +s[1], as: +s[2] });
        }
      }
    }
  }
  const where = x => { for (const [gi, rows] of Object.entries(DATA["1"])) for (let i = 0; i < rows.length; i++) { const r = row(rows[i]); if (r && r.h === x.h && r.a === x.a) return { gi, i, r }; } return null; };
  const nuove = played.filter(x => !where(x));
  // mete già note per squadra
  const note = {}; Object.values(DATA["1"]).flat().map(row).filter(Boolean).forEach(r => { note[r.h] = (note[r.h] || 0) + r.ht; note[r.a] = (note[r.a] || 0) + r.at; });
  const quante = n => nuove.filter(x => x.h === n || x.a === n).length;
  const daMC = n => quante(n) === 1 && mete[n] != null ? mete[n] - (note[n] || 0) : null;
  for (const x of played) {
    const w = where(x);
    if (w) {
      if (w.r.hs === x.hs && w.r.as === x.as) continue;
      DATA["1"][w.gi][w.i] = line(x.H, x.A, x.hs, x.as, w.r.ht, w.r.at);
      changes.push(`Rettifica giornata ${w.gi}: ${x.h} – ${x.a} ${x.hs}-${x.as} (mete da controllare: ${w.r.ht}-${w.r.at})`);
      continue;
    }
    let ht = daMC(x.h), at = daMC(x.a);
    const art = arts.find(m => m.h === x.h && m.a === x.a);
    if ((ht == null || at == null) && art) { const r = toTabText({ ...art, hs: x.hs, as: x.as }, T); if (r.ok) { ht ??= r.tries[0]; at ??= r.tries[1]; } }
    const ok = v => v != null && v >= 0 && v <= 30;
    if (!ok(ht) || !ok(at) || ht * 5 > x.hs + 2 || at * 5 > x.as + 2) { problems.push(`Giornata ${x.gi}: ${x.h} – ${x.a} ${x.hs}-${x.as}: mete non ricavabili, da inserire a mano`); continue; }
    (DATA["1"][x.gi] ??= []).push(line(x.H, x.A, x.hs, x.as, ht, at));
    changes.push(`Nuova giornata ${x.gi}: ${x.h} – ${x.a} ${x.hs}-${x.as} (mete ${ht}-${at})`);
  }
} catch (e) { problems.push("Match Centre FIR non letto: " + e.message); }

// ---------- 2. tabellini nuovi ----------
const tabKey = s => { const m = s.match(/^(.+?)\s+[–—-]\s+(.+?)\s+\d+\s*[-–—]/); if (!m) return null; const h = find(m[1]), a = find(m[2]); return h && a ? h.n + "|" + a.n : null; };
const keys = new Set(TAB.map(tabKey).filter(Boolean));
const off = {}; Object.values(DATA["1"]).flat().map(row).filter(Boolean).forEach(r => off[r.h + "|" + r.a] = r);
for (const m of arts) {
  const k = m.h + "|" + m.a; if (keys.has(k)) continue;      // già presente: non si tocca (può essere stato corretto a mano)
  const o = off[k]; if (o) { m.hs = o.hs; m.as = o.as; }       // punteggio ufficiale
  const r = toTabText(m, T);
  keys.add(k); TAB.push(r.text); tabNew.push(`${m.h} – ${m.a}${r.ok ? "" : " (marcatori incompleti: controllare)"}`);
}

// problemi degli articoli solo per le partite che non hanno ancora il tabellino
artProblems.forEach(x => { const m = x.match(/^(.+?) – (.+?):/); if (!m || !keys.has(m[1] + "|" + m[2])) problems.push(x); });

let out = html;
if (changes.length) {
  const gis = Object.keys(DATA["1"]).sort((a, b) => a - b).map(gi => ` "${gi}":[\n` + DATA["1"][gi].map(r => "  " + JSON.stringify(r)).join(",\n") + "]");
  out = out.replace(dm[0], `/*DATI-INIZIO*/{\n"1":{\n${gis.join(",\n")}}\n}/*DATI-FINE*/`);
}
if (tabNew.length) out = out.replace(tm[0], "/*TABELLINI-INIZIO*/[\n" + TAB.map(t => JSON.stringify(t)).join(",\n") + "\n]/*TABELLINI-FINE*/");
if (out !== html) fs.writeFileSync(FILE, out);

const report = [
  "### Serie A Elite femminile",
  `Articoli letti: ${posts.length}`,
  changes.length ? `Risultati (${changes.length}):\n- ` + changes.join("\n- ") : "Nessun risultato nuovo.",
  tabNew.length ? `Tabellini aggiunti (${tabNew.length}):\n- ` + tabNew.join("\n- ") : "",
  problems.length ? `Da controllare (${problems.length}):\n- ` + problems.join("\n- ") : "",
].filter(Boolean).join("\n\n");
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report.replace(/\n- /g, "\n* ") + "\n");
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `problemi_f=${problems.length}\n`);
