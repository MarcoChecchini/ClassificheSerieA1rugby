// Parser dei "tabellini" pubblicati su federugby.it.
// Funzioni pure, senza dipendenze: girano sia in Node sia nel browser.

const ENT = { amp: "&", nbsp: " ", quot: '"', apos: "'", lt: "<", gt: ">", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘" };

export function htmlToText(html) {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ");
}

const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’‘`]/g, "'").toLowerCase().replace(/\s+/g, " ").trim();
const plain = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/’/g, "'");

// Riga partita: "CASA – OSPITI 19-35 (5-13) – CASA: formazione ... Marcatori: ... Note: ..."
const MATCH_RE = /^\s*(.+?)\s+[–-]\s+(.+?)\s+(\d+)\s*[-–]\s*(\d+)\s*\((\d+)\s*[-–]\s*(\d+)\)\s*[–-]\s*(.*)$/;
const HEAD_RE = /girone\s*(\d)\s*\(\s*(\d+)\s*[ªa°º]?\s*giornata\s*\)?/gi;

// Divide i marcatori in eventi {type, n, name, conv}
function parseScorers(s) {
  const ev = [];
  s = s.replace(/marcatori\s*:/gi, ",")
       .replace(/\b(pt|st|sts|pts|primo tempo|secondo tempo|tempi supplementari)\s*:/gi, ",")
       .replace(/\(\s*\d+\s*-\s*\d+\s*\)/g, "");             // parziali tipo (0-6)
  const MIN = /^\d+\s*['’′]?(?:\s*\+\s*\d+\s*['’′]?)?$/;      // un minuto da solo, es. "26’"
  const chunks = [];
  let pending = "";
  for (let c of s.split(/[,;]/)) {
    c = c.trim();
    if (!c) continue;
    if (MIN.test(c)) { pending += c + " "; continue; }     // "26’, 30’ e 34’ cp Mazzi"
    chunks.push(pending + c); pending = "";
  }
  for (let chunk of chunks) {
    const lead = chunk.match(/^(?:\d+\s*['’′]?(?:\s*\+\s*\d+\s*['’′]?)?\s*(?:e\s+)?)+/i);
    const n = lead ? Math.max(1, (lead[0].match(/\d+(?:\s*\+\s*\d+)?/g) || []).length) : 1;
    chunk = chunk.slice(lead ? lead[0].length : 0).trim();
    if (!chunk) continue;
    let m;
    if ((m = chunk.match(/^m(?:eta)?\.?\s*tecnica\s+(.+)$/i))) { ev.push({ type: "mt", n, name: m[1].trim() }); continue; }
    if ((m = chunk.match(/^m\.?\s+(.+?)(?:\s+tr\.?\s+(.+))?$/i)) || (m = chunk.match(/^m\.(\S.*?)(?:\s+tr\.?\s+(.+))?$/i))) {
      ev.push({ type: "m", n, name: m[1].trim(), conv: m[2] ? m[2].trim() : null }); continue;
    }
    if ((m = chunk.match(/^c\.?\s*p\.?\s+(.+)$/i))) { ev.push({ type: "cp", n, name: m[1].trim() }); continue; }
    if ((m = chunk.match(/^(?:d\.?\s*r\.?|drop)\s+(.+)$/i))) { ev.push({ type: "dr", n, name: m[1].trim() }); continue; }
    if ((m = chunk.match(/^tr\.?\s+(.+)$/i))) { ev.push({ type: "tr", n, name: m[1].trim() }); continue; }
    ev.push({ type: "?", n, name: chunk });
  }
  return ev;
}

// In quale formazione compare il giocatore? 0 = casa, 1 = ospiti, null = non si sa
function side(name, lineups) {
  const nn = norm(name).replace(/\.$/, "");
  const word = w => new RegExp("(^|[^a-z])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^a-z])");
  for (const key of [nn, nn.split(" ").pop()]) {
    if (key.length < 3) continue;
    const re = word(key), a = re.test(lineups[0]), b = re.test(lineups[1]);
    if (a !== b) return a ? 0 : 1;
    if (a && b) return null; // cognome presente in entrambe le squadre
  }
  return null;
}

const PTS = { m: 5, mt: 7, cp: 3, dr: 3, tr: 2 };

function scoreMatch(rest, homeLbl, awayLbl, hs, as) {
  const mk = rest.match(/Marcatori\s*:\s*([\s\S]*?)(?:\.?\s*Note\s*:|$)/i);
  if (!mk) return { err: "marcatori non trovati" };
  const pre = rest.split(/Arbitro\s*:/i)[0];
  // le due formazioni: la seconda inizia con "NOME OSPITI:" (maiuscolo)
  const labels = [...pre.matchAll(/(?:^|\.\s+)([A-ZÀ-Ý0-9&'’.\- ]{2,}?):/g)];
  let lineups;
  if (labels.length >= 2) lineups = [pre.slice(0, labels[1].index), pre.slice(labels[1].index)].map(norm);
  else return { err: "formazioni non trovate" };

  const evs = parseScorers(mk[1].replace(/\.\s*$/, ""));
  const tries = [0, 0], pts = [0, 0], unk = [];
  const add = (s, type, n) => { pts[s] += PTS[type] * n; if (type === "m" || type === "mt") tries[s] += n; };
  for (const e of evs) {
    if (e.type === "?") return { err: "evento non riconosciuto: " + e.name };
    let s;
    if (e.type === "mt") {
      const t = norm(e.name), H = norm(homeLbl), A = norm(awayLbl);
      const inH = H.includes(t) || t.split(" ").some(w => w.length > 3 && H.includes(w));
      const inA = A.includes(t) || t.split(" ").some(w => w.length > 3 && A.includes(w));
      s = inH && !inA ? 0 : inA && !inH ? 1 : side(e.name, lineups);
    } else s = side(e.name, lineups);
    // una trasformazione segue la meta della stessa squadra
    const parts = [[e.type, e.n]];
    if (e.conv) parts.push(["tr", e.n]);   // "20’ e 25’ m. X tr. Y" = due trasformazioni
    if (s === null) { unk.push(parts); continue; }
    parts.forEach(([t, n]) => add(s, t, n));
  }
  // giocatori non riconosciuti: si sceglie l'unica assegnazione che torna con il punteggio
  if (unk.length) {
    if (unk.length > 10) return { err: "troppi marcatori non riconosciuti" };
    const sols = [];
    for (let mask = 0; mask < 1 << unk.length; mask++) {
      const p = [...pts], t = [...tries];
      unk.forEach((parts, i) => { const s = (mask >> i) & 1; parts.forEach(([ty, n]) => { p[s] += PTS[ty] * n; if (ty === "m" || ty === "mt") t[s] += n; }); });
      if (p[0] === hs && p[1] === as) sols.push(t.join("-"));
    }
    const uniq = [...new Set(sols)];
    if (uniq.length !== 1) return { err: `marcatori ambigui (${unk.length})` };
    const [a, b] = uniq[0].split("-").map(Number);
    return { tries: [a, b] };
  }
  if (pts[0] !== hs || pts[1] !== as) return { err: `i marcatori danno ${pts[0]}-${pts[1]} invece di ${hs}-${as}` };
  return { tries };
}

// teams: [{n, g, re}] dal file index.html
export function parseArticle(html, teams) {
  const find = s => { s = plain(s).toUpperCase().trim(); return teams.find(t => t.re.test(s)); };
  const text = htmlToText(html);
  const head = {};          // girone -> giornata indicata nel titoletto
  const out = [], skipped = [];
  for (let line of text.split("\n")) {
    // titoletto "GIRONE 1 (3ª giornata)", a volte sulla stessa riga della prima partita
    const heads = [...line.matchAll(HEAD_RE)];
    heads.forEach(h => { head[+h[1]] = +h[2]; });
    if (heads.length) { const l = heads[heads.length - 1]; line = line.slice(l.index + l[0].length); }
    const m = line.match(MATCH_RE);
    if (!m) continue;
    const [, hl, al, hs, as, , , rest] = m;
    const H = find(hl), A = find(al);
    if (!H || !A || H.g !== A.g) { if (H || A) skipped.push(`${hl} – ${al}: squadra non riconosciuta`); continue; }
    const r = scoreMatch(rest, hl, al, +hs, +as);
    if (r.err) { skipped.push(`${H.n} – ${A.n} ${hs}-${as}: ${r.err}`); continue; }
    out.push({ g: H.g, giornata: head[H.g] ?? null, h: H.n, a: A.n, hs: +hs, as: +as, ht: r.tries[0], at: r.tries[1] });
  }
  return { matches: out, skipped };
}

// Riga nel formato usato da index.html
export const toLine = x => `${plain(x.h).toUpperCase()} - ${plain(x.a).toUpperCase()} ${x.hs} - ${x.as} ( ${x.ht}- ${x.at})`;
