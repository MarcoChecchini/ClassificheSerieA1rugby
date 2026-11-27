// Tabellini della Serie A Elite femminile (articoli di federugby.it) -> stesso formato dei tabellini
// della pagina maschile, così femminile.html li legge con lo stesso codice (formazioni, minuti, mete, cartellini).
// Gli articoli femminili sono scritti a mano dalle società e cambiano molto da partita a partita:
// il parser cerca di capire marcatori, formazioni e cartellini in tutte le forme viste finora.
// Funzioni pure, senza dipendenze.

const strip = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const up = s => strip(s).replace(/C\.\s*U\.\s*S\./gi, "CUS").replace(/[’`]/g, "'").toUpperCase();
const AP = "['’′°`]";

// Grafie diverse dello stesso nome viste negli articoli (chiave in maiuscolo, senza accenti)
export const NOMI = {
  "RITA DA LIO": "R. Da Lio", "DA LIO RITA": "R. Da Lio", "EMMA DA LIO": "E. Da Lio", "DA LIO EMMA": "E. Da Lio",
  "TRIOLA": "Triolo", "MAGNON": "Magnoni", "IVASCHENKO": "Ivashchenko", "DONA": "Donà", "ZOPPE'": "Zoppè", "ZOPPE": "Zoppè",
  // come nell'annuario Rugby 2027
  "MARSILI FELICIANGELI": "Marsili", "ALBANESE": "Albanese Ginammi", "REVERSO PEILA": "Reverso", "FERNANDEZ SUAREZ": "Fernandez", "DEROBERTIS": "De Robertis",
  "SPIRLI": "Spirlì",
};
const tcase = s => s.toLowerCase().replace(/(^|[\s'’-])(\S)/g, (a, b, c) => b + c.toUpperCase());
// "Tombolato B." -> "B. Tombolato"; maiuscolo -> iniziali maiuscole; grafie note
export function cleanName(n) {
  n = n.replace(/\((?:c|cap|vcap|vc)\)/gi, "").replace(/\s+/g, " ").replace(/^[\s.,;:()]+|[\s,;:()]+$/g, "").replace(/\.$/, m => /\s[A-Z]\.$/.test(n.trim()) ? m : "");
  const k = up(n).replace(/\.$/, "");
  if (NOMI[k]) return NOMI[k];
  let m = n.match(/^(.+?)\s+([A-ZÀ-Ý])\.?$/);
  if (m && m[1].length > 2) n = `${m[2]}. ${m[1]}`;
  if (n === n.toUpperCase() && /[A-Z]{3}/.test(n)) n = tcase(n);
  return n;
}

// divide per virgola / punto e virgola fuori dalle parentesi
function splitTop(s, seps = ",;") { const o = []; let d = 0, cur = ""; for (const c of s) { if (c === "(") d++; if (c === ")") d = Math.max(0, d - 1); if (d === 0 && seps.includes(c)) { o.push(cur); cur = "" } else cur += c } o.push(cur); return o.map(x => x.trim()).filter(Boolean) }

// minuti assoluti (0-80) -> "12’ pt" / "5’ st"
const fm = t => t == null ? "" : t <= 40 ? `${t}’ pt` : `${t - 40}’ st`;

// ---------- formazioni ----------
// "Negroni (64°Laurenti)", "Pelonzi (HT Laurenti)", "Benini (55’ Jeni, 78’ Benini)", "Tombolato I. (14’ pt Ristorto; 15’ st De Paoli)",
// "Gobello 65’ Ianniello)", "Comina (Porrazzo)", "Derobertis(43’ Zoboli, Citino" (parentesi non chiusa)
function parseSub(s) {
  s = s.replace(/^\(|\)$/g, "").trim();
  let m = s.match(new RegExp(`^(?:al\\s+)?(\\d+)\\s*${AP}?\\s*(p\\.?\\s*t\\b\\.?|s\\.?\\s*t\\b\\.?)?\\s*(.+)$`, "i"));
  if (m) { let t = +m[1]; if (m[2] && /s/i.test(m[2])) t += 40; return { t: Math.min(t, 80), n: cleanName(m[3]) } }
  m = s.match(/^(?:HT|intervallo)\s+(.+)$/i); if (m) return { t: 40, n: cleanName(m[1]) };
  return { t: null, n: cleanName(s) };
}
export function parseLineup(s) {
  s = s.replace(/\s*\b(A\s+disposizione|A\s+disp\.?|Non\s+entrat[ei]|Panchina)\b[\s\S]*$/i, "")
       .replace(/\s*\bAll\.?(?:enatore|enatrice)?\s*:?\s[\s\S]*$/i, "")
       .replace(/\((?:c|cap|vcap|vc)\)/gi, "").replace(/\s+/g, " ").trim().replace(/[.;,]+$/, "");
  const raw = s.split(/[,;]/).map(x => x.trim()).filter(Boolean), out = [];
  let open = false;
  for (let tok of raw) {
    const isSub = new RegExp(`^(?:al\\s+)?\\d+\\s*${AP}|^HT\\b`, "i").test(tok);
    if (isSub && out.length && (open || /\)\s*$/.test(tok))) { out[out.length - 1].subs.push(parseSub(tok)); open = !/\)\s*$/.test(tok); continue; }
    // "Nome (sub" / "Nome (sub)" / "Nome 65’ Sub)" / "Nome"
    let m = tok.match(/^([^(]+?)\s*\((.*)$/);
    if (!m) { const g = tok.match(new RegExp(`^(.+?)\\s+(\\d+\\s*${AP}.+?)\\)?$`)); if (g) m = [tok, g[1], g[2] + ")"] }
    if (m) {
      const p = { n: cleanName(m[1]), subs: [] }; out.push(p);
      const inner = m[2].trim();
      open = !/\)\s*$/.test(inner);
      if (inner.replace(/\)$/, "").trim()) p.subs.push(parseSub(inner));
    } else { out.push({ n: cleanName(tok), subs: [] }); open = false; }
  }
  return out.filter(p => p.n);
}

// ---------- marcatori ----------
const TIPO = [
  ["mt", /^(?:m\.?|meta|mt\.?)?\s*(?:tecnica|di\s+punizione|punizione\s+tecnica)\b\s*(.*)$/i],
  ["cp", /^(?:c\.?\s*p\.?|cp\.?|p\.|punizione|calcio\s+piazzato)\s+(.+)$/i],
  ["dr", /^(?:drop|d\.\s*r\.?)\s+(.+)$/i],
  ["tr", /^(?:tr|trasf)\.?\s+(.+)$/i],
  ["m", /^(?:meta\b|mt\b\.?|m\b\.?)\s*(.+)$/i],
];
export function parseScorers(s) {
  s = s.replace(/^\s*Marcat(?:ori|rici)\s*:?\s*/i, "")
       .replace(/([a-zà-ÿ])tr\.\s/g, "$1 tr. ")                       // "Affinitotr. Barabino"
       .replace(/\(\s*(\d+)\s*[-–]\s*(\d+)\s*\)/g, "|$1-$2|");         // punteggi parziali -> segnaposto
  // primo e secondo tempo
  const parts = s.split(/(?:^|[\s;,.|])(?:s\.\s*t\.?|st|secondo\s+tempo)\s*:?\s*(?=[\d(a-zA-Z|])/i);
  const ev = [];
  parts.slice(0, 2).forEach((half, hi) => {
    half = half.replace(/^\s*(?:p\.\s*t\.?|pt|primo\s+tempo)\s*:?\s*/i, "").replace(/\.\s+(?=(?:al\s+)?\d)/g, ", ");   // "Danieli. 80’ meta Buso"
    const toks = half.split(/[,;]|(\|\d+-\d+\|)/).filter(x => x && x.trim());
    const es = [];
    for (let tk of toks) {
      tk = tk.trim();
      const sc = tk.match(/^\|(\d+)-(\d+)\|$/);
      if (sc) { if (es.length) es[es.length - 1].sc = [+sc[1], +sc[2]]; continue; }
      tk = tk.replace(/\|/g, "").replace(/\.\s*$/, "").trim();
      const mm = tk.match(new RegExp(`^(?:al\\s+)?(\\d+)\\s*${AP}?\\s*(?:p\\.?t\\b\\.?|s\\.?t\\b\\.?)?\\s*`, "i"));
      let t = mm ? +mm[1] : null; let r = mm ? tk.slice(mm[0].length) : tk;
      r = r.replace(/\s+meta\b/i, "").trim();                          // "Blaskovic meta tr. Buso"
      if (!r) continue;
      let k = "m", name = r;
      for (const [kk, re] of TIPO) { const x = r.match(re); if (x) { k = kk; name = x[1]; break } }
      let conv = null;
      const c = name.match(/^(.*?)\s+(?:tr|trasf|te)(?:\.\s*|\s+)(.+)$/i);
      if (c) { name = c[1]; conv = cleanName(c[2]); }
      name = name.replace(/\s+NT\.?$/i, "");
      if (k === "tr" && !name) continue;
      es.push({ half: hi + 1, t, k, name: k === "mt" ? name.trim() : cleanName(name), conv });
    }
    // minuti del secondo tempo: assoluti (41-80) o contati dall'inizio del tempo (1-40)
    if (hi === 1) { const ts = es.map(e => e.t).filter(x => x != null); const rel = ts.length && Math.max(...ts) <= 40; es.forEach(e => { if (e.t != null && (rel || e.t <= 40)) e.t += 40 }) }
    ev.push(...es);
  });
  return ev;
}

// ---------- cartellini ----------
export function parseCards(s, players) {
  if (!s) return [];
  s = s.replace(/^.*?Cartellini[^:]*:\s*/i, "");
  const segs = s.split(/;|,\s*(?=(?:al\s+)?\d)/).map(x => x.trim()).filter(Boolean), out = [];
  for (const g of segs) {
    const U = up(g), rx = k => new RegExp(`(^|[^A-Z])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^A-Z])`);
    const cand = [...new Set(players)].map(n => { const q = up(n), sur = q.replace(/^[A-Z]\.\s*/, ""), ini = (q.match(/^([A-Z])\./) || [])[1];
      let sc = 0; if (sur.length > 2 && rx(sur).test(U)) sc = 1 + sur.length / 100; if (sc && ini && (rx(sur + " " + ini).test(U) || rx(ini + ". " + sur).test(U))) sc += 1; return [n, sc, sur] }).filter(c => c[1] > 0).sort((a, b) => b[1] - a[1]);
    if (!cand.length) continue;
    if (cand.length > 1 && cand[1][2] === cand[0][2] && Math.floor(cand[1][1]) === Math.floor(cand[0][1])) continue;   // cognome ambiguo
    const p = cand[0];
    const m = g.match(/(\d+)/); let t = m ? +m[1] : null;
    if (t != null && /\b(s\.\s*t\.?|st|secondo\s+tempo)\b/i.test(g) && t <= 40) t += 40;
    const red = /rosso/i.test(g), dg = /giallo\s*\+\s*rosso|doppio|second[oa]\s+giallo/i.test(g);
    out.push({ n: p[0], t, k: red ? "r" : "y", dg });
  }
  return out;
}

// ---------- articolo -> partite ----------
// teams: [{n, re}] come nella tabella T della pagina
export function parseFemArticle(text, teams) {
  const find = s => { const u = up(s); return teams.find(t => t.re.test(u)); };
  const teamsInLine = l => { const u = up(l), f = []; teams.forEach(t => { const m = u.match(t.re); if (m) f.push([m.index, t]) }); return f.sort((a, b) => a[0] - b[0]).map(x => x[1]); };
  const lines = text.split(/\n|\s{3,}|\u00a0{2,}/).flatMap(l => {
    // "... (16-36). Unione Rugby Capitolina: Negroni, ..." -> la formazione va su una riga sua
    const m = l.match(/^(.*?[.)])\s+([A-Z][^:.]{2,45}):\s*(.*)$/);
    return m && find(m[2]) && (m[3].match(/[,;]/g) || []).length >= 9 ? [m[1], m[2] + ": " + m[3]] : [l];
  }).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const isLineup = l => { const m = l.match(/^([^:]{2,45}):\s*(.+)$/); if (m && find(m[1]) && (m[2].match(/[,;]/g) || []).length >= 9) return [find(m[1]), m[2]];
    const w = l.split(" "); for (let k = 1; k <= 4 && k < w.length; k++) { const t = find(w.slice(0, k).join(" ")); const rest = w.slice(k).join(" "); if (t && !find(rest.split(/[,;]/)[0] || "") && (rest.match(/[,;]/g) || []).length >= 9) return [t, rest] } return null; };
  const SKIP = /^(Punti conquistati|Calciat|Cartellini|Player|Note|La classifica|Marcat)/i;
  // intestazioni: due squadre (e il punteggio sulla riga o su quella prima)
  const heads = [];
  lines.forEach((l, i) => { if (SKIP.test(l) || isLineup(l)) return; const ts = teamsInLine(l); if (ts.length >= 2 && ts[0] !== ts[1]) heads.push(i) });
  const out = [], problems = [];
  heads.forEach((hi, j) => {
    const end = j + 1 < heads.length ? heads[j + 1] : lines.length, blk = lines.slice(hi, end), L = lines[hi];
    const mk = blk.find(l => /^Marcat(?:ori|rici)\s*:?/i.test(l)); if (!mk) return;   // riepilogo, non un tabellino
    const [H, A] = teamsInLine(L);
    // punteggio: "16 – 36", "10/26", "111 – FORUM IULII 0", oppure "92/05" sulla riga prima
    let sc = L.match(/(\d{1,3})\s*[-–\/]\s*(\d{1,3})(?!\s*\))/) || (lines[hi - 1] || "").match(/^(\d{1,3})\s*[-–\/]\s*(\d{1,3})/);
    if (!sc) { const n = [...L.matchAll(/\b(\d{1,3})\b/g)].map(x => +x[1]); if (n.length >= 2) sc = [null, n[0], n[1]] }
    if (!sc) { problems.push(`${H.n} – ${A.n}: punteggio non trovato`); return; }
    const hs = +sc[1], as = +sc[2];
    const lu = {}, coach = {};let last = null;
    for (const l of blk) {
      const x = isLineup(l);
      if (x && (x[0] === H || x[0] === A) && !lu[x[0].n]) { lu[x[0].n] = parseLineup(x[1]); last = x[0].n; const c = x[1].match(/\bAll\.?\s*:?\s*([^]*)$/); if (c) coach[last] = c[1]; continue }
      const c = l.match(/^All\.?(?:enatore|enatrice)?\s*:?\s*(.+)$/i); if (c && last && !coach[last]) coach[last] = c[1];
    }
    if (!lu[H.n] || !lu[A.n]) { problems.push(`${H.n} – ${A.n}: formazioni non trovate`); return; }
    const all = blk.join("\n");
    const ref = ((all.match(/(?:Arb|ARB)(?:itro|ITRO)?\s*\.?\s*:\s*([^\n]+)/) || [])[1] || "").replace(/\s*AA1.*$/i, "").trim();
    for (const k in coach) coach[k] = coach[k].replace(/(?:Arb|ARB)[\s\S]*$/, "").trim();
    const cardTxt = (all.match(/Cartellini[^\n]*/i) || [""])[0];
    const players = [H, A].flatMap(t => lu[t.n].flatMap(p => [p.n, ...p.subs.map(s => s.n)]));
    out.push({ h: H.n, a: A.n, hs, as, lu, coach, ref, ev: parseScorers(mk), cards: parseCards(cardTxt, players) });
  });
  return { matches: out, problems };
}

// ---------- partita -> testo del tabellino nel formato della pagina ----------
const PT = { m: 5, mt: 7, cp: 3, dr: 3, tr: 2 };
export function toTabText(x, teams) {
  const H = x.h, A = x.a, LBL = n => up(n);
  const roster = { [H]: x.lu[H].flatMap(p => [p.n, ...p.subs.map(s => s.n)]), [A]: x.lu[A].flatMap(p => [p.n, ...p.subs.map(s => s.n)]) };
  // nome del marcatore -> nome in formazione (cognome, iniziale, nome completo) e squadra
  const res = n => {
    if (!n) return null; const k = up(n).replace(/\.$/, "");
    const c = [];
    for (const tn of [H, A]) for (const p of roster[tn]) { const q = up(p).replace(/\.$/, ""), sur = q.replace(/^[A-Z]\.\s*/, "");
      if (q === k || sur === k || q.startsWith(k + " ") || q.endsWith(" " + k) || (q === sur && k.endsWith(" " + sur))) c.push([tn, p]) }
    if (c.some(z => up(z[1]).replace(/\.$/, "") === k)) return c.find(z => up(z[1]).replace(/\.$/, "") === k);
    const u = [...new Map(c.map(z => [z[0] + "|" + z[1], z])).values()];
    return u.length === 1 ? u[0] : null;
  };
  // squadra di ogni evento: punteggio parziale, poi nome in formazione, poi nome della meta tecnica
  const sc = [0, 0];
  const ev = x.ev.map(e => {
    const pts = PT[e.k] + (e.conv ? 2 : 0);let side = null;
    if (e.sc) { const d = [e.sc[0] - sc[0], e.sc[1] - sc[1]]; if (d[0] === pts && d[1] === 0) side = 0; else if (d[1] === pts && d[0] === 0) side = 1; sc[0] = e.sc[0]; sc[1] = e.sc[1]; }
    const r = e.k === "mt" ? null : res(e.name);
    if (side == null && r) side = r[0] === H ? 0 : 1;
    if (side == null && e.k === "mt") { const t = teams.find(t => t.re.test(up(e.name))); if (t) side = t.n === H ? 0 : t.n === A ? 1 : null }
    const cv = e.conv ? res(e.conv) : null;
    return { ...e, side, name: e.k === "mt" ? null : r ? r[1] : e.name, conv: e.conv ? (cv ? cv[1] : e.conv) : null };
  });
  if (!sc[0] && !sc[1]) {} // nessun parziale: va bene
  // primo tempo dai marcatori del primo tempo
  const ht = [0, 0]; ev.filter(e => e.half === 1 && e.side != null).forEach(e => ht[e.side] += PT[e.k] + (e.conv ? 2 : 0));
  const tok = e => {
    const t = e.t == null ? "" : (e.t > 40 ? e.t - 40 : e.t) + "’ ";
    if (e.k === "mt") return `${t}m.tecnica ${LBL(e.side === 0 ? H : e.side === 1 ? A : "")}`;
    if (e.k === "m") return `${t}m. ${e.name}${e.conv ? " tr. " + e.conv : ""}`;
    if (e.k === "cp") return `${t}cp ${e.name}`;
    if (e.k === "dr") return `${t}drop ${e.name}`;
    return `${t}tr. ${e.name}`;
  };
  const slot = p => p.n + (p.subs.length ? ` (${p.subs.map(s => s.t == null ? s.n : `${fm(s.t)} ${s.n}`).join(", ")})` : "");
  const team = tn => `${LBL(tn)}: ${x.lu[tn].map(slot).join(", ")}. All. ${(x.coach[tn] || "n.d.").replace(/\./g, "").replace(/\s+/g, " ").trim() || "n.d."}.`;
  const h1 = ev.filter(e => e.half === 1).map(tok).join(", "), h2 = ev.filter(e => e.half === 2).map(tok).join(", ");
  const reds = x.cards.filter(c => c.k === "r").map(c => `espulso ${c.n} al ${fm(c.t) || "0’ pt"}${c.dg ? " (doppio giallo)" : ""}`);
  const ys = x.cards.filter(c => c.k === "y").map(c => `${c.n}${c.t != null ? ` (${fm(c.t)})` : ""}`);
  const note = [...reds, ys.length ? "esp.temp. di " + ys.join(", ") : ""].filter(Boolean).join("; ");
  const ref = (x.ref || "").replace(/\./g, "").replace(/\s+/g, " ").trim();
  const tries = [0, 1].map(s => ev.filter(e => e.side === s && (e.k === "m" || e.k === "mt")).length);
  const pts = [0, 1].map(s => ev.filter(e => e.side === s).reduce((a, e) => a + PT[e.k] + (e.conv ? 2 : 0), 0));
  return {
    text: `${LBL(H)} – ${LBL(A)} ${x.hs}-${x.as} (${ht[0]}-${ht[1]}) – ${team(H)} ${team(A)} Arbitro: ${ref || "n.d"}. Marcatori: ${h1}${h2 ? "; st: " + h2 : ""}.${note ? " Note: " + note + "." : ""}`,
    tries, pts, ok: pts[0] === x.hs && pts[1] === x.as && ev.every(e => e.side != null)
  };
}
