// Legge i "tabellini" della Serie A da federugby.it e aggiorna i risultati in index.html.
// Uso: node scripts/aggiorna.mjs            (scarica gli articoli dal sito)
//      node scripts/aggiorna.mjs file.json  (usa un file con [{id,date,title,content}] per le prove)
import fs from "node:fs";
import { parseArticle, toLine, matchTexts } from "./tabellini.mjs";

const FILE = new URL("../index.html", import.meta.url);
const API = "https://www.federugby.it/wp-json/wp/v2/posts";
const DA = process.env.STAGIONE_DAL || "2026-08-01T00:00:00"; // inizio stagione

const html = fs.readFileSync(FILE, "utf8");

// squadre e regole di riconoscimento: le stesse usate dalla pagina
const tSrc = html.match(/const T=(\[[\s\S]*?\]\.map\(\(\[n,g,re\]\)=>\(\{n,g,re\}\)\));/);
if (!tSrc) throw new Error("Tabella squadre (const T) non trovata in index.html");
const T = new Function("return " + tSrc[1])();
const find = s => { s = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase(); return T.find(t => t.re.test(s)); };

const dm = html.match(/\/\*DATI-INIZIO\*\/([\s\S]*?)\/\*DATI-FINE\*\//);
if (!dm) throw new Error("Blocco DATI-INIZIO / DATI-FINE non trovato in index.html");
const DATA = JSON.parse(dm[1]);

const teamsOf = line => {
  const m = line.match(/^(.*?)\s+(\d+)\s*-\s*(\d+)\s*\(/);
  if (!m) return null;
  const p = m[1].split(/\s+-\s*/);
  const h = find(p[0]), a = find(p[1]);
  return h && a ? { h: h.n, a: a.n, hs: +m[2], as: +m[3] } : null;
};

async function getPosts() {
  if (process.argv[2]) return JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const url = `${API}?search=tabellini&after=${DA}&per_page=30&orderby=date&order=asc&_fields=id,date,title,link,content`;
  const r = await fetch(url, { headers: { "User-Agent": "ClassificheSerieA1rugby (+https://github.com/MarcoChecchini/ClassificheSerieA1rugby)" } });
  if (!r.ok) throw new Error(`federugby.it ha risposto ${r.status}`);
  return (await r.json()).map(p => ({ id: p.id, date: p.date, title: p.title.rendered, link: p.link, content: p.content.rendered }));
}

// testi dei tabellini usati dalla pagina dei giocatori (blocco TABELLINI)
const tm = html.match(/\/\*TABELLINI-INIZIO\*\/([\s\S]*?)\/\*TABELLINI-FINE\*\//);
const TAB = tm ? JSON.parse(tm[1]) : null;
const tabKey = s => { const m = s.match(/^(.+?)\s+[–—-]\s+(.+?)\s+\d+\s*[-–—]/); if (!m) return null; const h = find(m[1]), a = find(m[2]); return h && a ? h.n + "|" + a.n : null; };
const tabKeys = new Set((TAB || []).map(tabKey).filter(Boolean));
const tabNew = [];

const posts = (await getPosts()).sort((a, b) => a.date.localeCompare(b.date));
const changes = [], problems = [];

for (const post of posts) {
  const { matches, skipped } = parseArticle(post.content, T);
  for (const x of matches) {
    const g = String(x.g);
    DATA[g] ??= {};
    // la partita c'è già?
    let where = null;
    for (const [gi, rows] of Object.entries(DATA[g]))
      rows.forEach((row, i) => { const t = teamsOf(row); if (t && t.h === x.h && t.a === x.a) where = { gi, i, t }; });
    if (where) {
      if (where.t.hs === x.hs && where.t.as === x.as) continue;   // invariata: si tengono i dati esistenti
      DATA[g][where.gi][where.i] = toLine(x);
      changes.push(`Rettifica girone ${g}, giornata ${where.gi}: ${toLine(x)}`);
      continue;
    }
    // giornata: dal titoletto dell'articolo, altrimenti la prima giornata in cui le due squadre non hanno giocato
    let gi = x.giornata;
    if (!gi) {
      const nums = Object.keys(DATA[g]).map(Number);
      const last = nums.length ? Math.max(...nums) : 0;
      const busy = k => (DATA[g][k] || []).some(r => { const t = teamsOf(r); return t && [t.h, t.a].some(n => n === x.h || n === x.a); });
      gi = last && !busy(last) ? last : last + 1;
    }
    (DATA[g][gi] ??= []).push(toLine(x));
    changes.push(`Nuova girone ${g}, giornata ${gi}: ${toLine(x)}`);
  }
  if (TAB) for (const x of matchTexts(post.content, T)) {
    const k = x.h + "|" + x.a;
    if (tabKeys.has(k)) continue;          // già presente: non si tocca (può essere stato corretto a mano)
    tabKeys.add(k); TAB.push(x.text); tabNew.push(`${x.h} – ${x.a}`);
  }
  for (const s of skipped) {
    // da segnalare solo se la partita non è già nei dati
    const m = s.match(/^(.+?) – (.+?) \d/);
    const known = m && Object.values(DATA).some(o => Object.values(o).some(rows => rows.some(r => { const t = teamsOf(r); return t && t.h === m[1] && t.a === m[2]; })));
    if (!known) problems.push(`${s}  (${post.link || post.id})`);
  }
}

let out = html;
if (changes.length) {
  const gs = Object.keys(DATA).sort((a, b) => a - b).map(g => {
    const gis = Object.keys(DATA[g]).sort((a, b) => a - b).map(gi =>
      ` "${gi}":[\n` + DATA[g][gi].map(r => "  " + JSON.stringify(r)).join(",\n") + "]");
    return `"${g}":{\n` + gis.join(",\n") + "}";
  });
  const block = "{\n" + gs.join(",\n") + "\n}";
  out = out.replace(dm[0], `/*DATI-INIZIO*/${block}/*DATI-FINE*/`);
}
if (tabNew.length) out = out.replace(tm[0], "/*TABELLINI-INIZIO*/[\n" + TAB.map(t => JSON.stringify(t)).join(",\n") + "\n]/*TABELLINI-FINE*/");
if (out !== html) fs.writeFileSync(FILE, out);

const report = [
  `Articoli letti: ${posts.length}`,
  tabNew.length ? `Tabellini aggiunti alla pagina giocatori (${tabNew.length}):\n- ` + tabNew.join("\n- ") : "",
  changes.length ? `Aggiornamenti (${changes.length}):\n- ` + changes.join("\n- ") : "Nessun risultato nuovo.",
  problems.length ? `Partite da inserire a mano (${problems.length}):\n- ` + problems.join("\n- ") : "",
].filter(Boolean).join("\n\n");
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report.replace(/\n- /g, "\n* ") + "\n");
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `cambiati=${changes.length}\nproblemi=${problems.length}\n`);
