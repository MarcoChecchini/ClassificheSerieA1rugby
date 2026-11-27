// Campionati del sito: pagina, categoria del Match Centre FIR e comunicati del Giudice Sportivo.
// "mc" è il numero della categoria nel Match Centre (www.federugby.it/campionati), senza la stagione.
// "sigla" è l'inizio del nome dei PDF dei comunicati (es. COMB05GS2026.2027.pdf), "url" riconosce le loro pagine.
export const CAMPIONATI = {
  maschile:  { pagina: "index.html",             nome: "Serie A",                 sub: "maschile",  mc: "522",  sigla: "COMAMASCH",     query: ["Comunicato Serie A Maschile GS", "Giudice Sportivo Comunicato Serie A Maschile"], url: u => /serie-a-maschile/i.test(u) && !/elite|femminile/i.test(u) },
  femminile: { pagina: "femminile.html",         nome: "Serie A Elite",           sub: "femminile", mc: "1638", sigla: "COMAELITEFEMM", query: ["Comunicato Serie A Elite Femminile GS", "Giudice Sportivo Comunicato Serie A Elite Femminile"], url: u => /serie-a-elite-femminile/i.test(u) },
  "serie-b": { pagina: "serie-b.html",           nome: "Serie B",                 sub: "maschile",  mc: "474",  sigla: "COMB",          query: ["Comunicato Serie B GS", "Giudice Sportivo Comunicato Serie B"], url: u => /comunicato-serie-b-/i.test(u) },
  "serie-a-femminile": { pagina: "serie-a-femminile.html", nome: "Serie A",        sub: "femminile", mc: "1167", sigla: "COMAFEMM",      query: ["Comunicato Serie A Femminile GS", "Giudice Sportivo Comunicato Serie A Femminile"], url: u => /comunicato-serie-a-femminile-/i.test(u) },
  "under-18": { pagina: "under-18.html",         nome: "Under 18",                sub: "titolo",    mc: "1026", sigla: "COMU18TITOLO",  query: ["Comunicato Under 18 Titolo GS", "Giudice Sportivo Comunicato Under 18 Titolo"], url: u => /under-18-titolo/i.test(u) },
};
// ordine del banner in cima alle pagine
export const BANNER = ["maschile", "femminile", "serie-b", "serie-a-femminile", "under-18"];
export const banner = on => `<nav class="camp" aria-label="Campionato">` + BANNER.map(k => { const c = CAMPIONATI[k], href = c.pagina === "index.html" ? "./" : c.pagina;
  return `<a href="${href}"${k === on ? ' class="on" aria-current="page"' : ""}>${c.nome}<small>${c.sub}</small></a>`; }).join("") + `</nav>`;
export const BANNER_CSS = `/* scelta del campionato */
.camp{display:flex;gap:0;margin:0 0 14px;border:1px solid var(--bd);border-radius:12px;overflow-x:auto;scrollbar-width:none;background:var(--card);box-shadow:var(--sh)}.camp::-webkit-scrollbar{display:none}
.camp a{flex:1 0 auto;min-width:92px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:9px 8px;text-align:center;text-decoration:none;color:var(--tx);font-weight:600;font-size:14px;line-height:1.2;white-space:nowrap}
.camp a+a{border-left:1px solid var(--bd)}
.camp a small{font-weight:400;font-size:11.5px;color:var(--mu)}
.camp a:hover{background:var(--acbg)}
@media(max-width:560px){.camp a{flex:1 1 0;min-width:68px;padding:8px 4px;font-size:12.5px;white-space:normal}.camp a small{font-size:10.5px}}
.camp a.on{background:var(--ac);color:#fff}.camp a.on small{color:inherit;opacity:.85}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .camp a.on{color:#06231b}}:root[data-theme="dark"] .camp a.on{color:#06231b}
`;
