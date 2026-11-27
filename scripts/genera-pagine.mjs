// Crea (o rigenera) le pagine dei campionati senza tabellini — Serie B, Serie A femminile, Under 18 Titolo —
// partendo dal codice di index.html. Se la pagina esiste già, i suoi dati (squadre, calendario, risultati,
// arbitri, Giudice Sportivo) vengono tenuti: si rigenera solo il codice. Mette anche il banner dei campionati
// in index.html e femminile.html.
// Uso: node scripts/genera-pagine.mjs            (dopo una modifica al codice di index.html)
import fs from "node:fs";
import { CAMPIONATI, banner, BANNER_CSS } from "./campionati.mjs";

const R = new URL("../", import.meta.url);
const read = f => fs.readFileSync(new URL(f, R), "utf8");
const write = (f, s) => fs.writeFileSync(new URL(f, R), s);

// ---------- banner in tutte le pagine ----------
const setBanner = (h, key) => {
  h = h.replace(/\/\* scelta del campionato \*\/[\s\S]*?\n(?=<\/style>)/, () => BANNER_CSS);
  if (!h.includes("/* scelta del campionato */")) h = h.replace("</style>\n</head>", () => BANNER_CSS + "</style>\n</head>");
  h = h.replace(/<nav class="camp"[^]*?<\/nav>/, () => banner(key));
  if (!h.includes('<nav class="camp"')) h = h.replace(/(<div class="views" id="views">.*?<\/div>\n)/, (m) => m + banner(key) + "\n");
  return h;
};
let engine = setBanner(read("index.html"), "maschile");
write("index.html", engine);
if (fs.existsSync(new URL("femminile.html", R))) write("femminile.html", setBanner(read("femminile.html"), "femminile"));

// ---------- pagine nuove ----------
const BLOCKS = ["DATI", "ARBITRI", "SQUALIFICHE", "SANZIONI"];
const getBlock = (h, n) => (h.match(new RegExp(`\\/\\*${n}-INIZIO\\*\\/([\\s\\S]*?)\\/\\*${n}-FINE\\*\\/`)) || [])[1];
const LINES = [/const T=\[[\s\S]*?\]\.map\(\(\[n,g,re\]\)=>\(\{n,g,re\}\)\);/, /const PEN=\[.*?\];/, /const NGT=\d+,CAL=\{.*?\};\n/, /const GIRNOMI=\{.*?\};/];

for (const key of ["serie-b", "serie-a-femminile", "under-18"]) {
  const C = CAMPIONATI[key], titolo = `${C.nome} ${C.sub === "titolo" ? "Titolo" : C.sub}`;
  let h = setBanner(engine, key);
  const rep = (a, b, all) => { if (!h.includes(a)) throw new Error(`${key}: manca ` + a.slice(0, 80)); h = all ? h.split(a).join(b) : h.replace(a, () => b); };
  const repRe = (re, b) => { if (!re.test(h)) throw new Error(`${key}: manca ` + re); h = h.replace(re, () => b); };

  // dati vuoti: li riempie scripts/campionato.mjs (Match Centre) e scripts/giudice.mjs (comunicati)
  repRe(LINES[0], "const T=[\n].map(([n,g,re])=>({n,g,re}));\nconst GIRNOMI={};\nconst GIRONI=[...new Set(T.map(t=>t.g))].sort((a,b)=>a-b);if(!GIRONI.length)GIRONI.push(1);");
  repRe(LINES[1], "const PEN=[];");
  repRe(LINES[2], 'const NGT=1,CAL={"1":[{"d":"","m":[]}]};\nconst NGTG=g=>(CAL[g]||[]).length||NGT;\n');
  for (const b of BLOCKS) repRe(new RegExp(`\\/\\*${b}-INIZIO\\*\\/[\\s\\S]*?\\/\\*${b}-FINE\\*\\/`), `/*${b}-INIZIO*/${b === "DATI" ? "{}" : "[]"}/*${b}-FINE*/`);
  repRe(/\/\*TABELLINI-INIZIO\*\/[\s\S]*?\/\*TABELLINI-FINE\*\//, "/*TABELLINI-INIZIO*/[]/*TABELLINI-FINE*/");
  repRe(/const ROSE=\{.*?\};\n/, "const ROSE={};\n");
  repRe(/const STAFF=\{.*?\};\n/, "const STAFF={};\n");
  h = h.split("\n").filter(l => !l.startsWith("Object.assign(CRESTS,")).join("\n");
  repRe(/const COL=\{.*?\};/, "const COL={};");
  repRe(/const TALIAS=\{.*?\};/, "const TALIAS={};");

  // gironi variabili (nomi dal Match Centre), giornate per girone, niente zone playoff/retrocessione
  rep("[1,2,3,4]", "GIRONI", true);
  rep('data-g="${g}">Girone ${g}</button>', 'data-g="${g}">${GIRNOMI[g]||"Girone "+g}</button>');
  rep('data-sg="${g}">Girone ${g}</button>', 'data-sg="${g}">${GIRNOMI[g]||"Girone "+g}</button>');
  rep("const L=NGT-1,", "const L=NGTG(G)-1,");
  rep('"Giornata "+(R+1)+" di "+NGT', '"Giornata "+(R+1)+" di "+NGTG(G)');
  rep('(R<11?"Andata":"Ritorno")', '(R<NGTG(G)/2?"Andata":"Ritorno")');
  rep("R=Math.min(NGT-1,R+1)", "R=Math.min(NGTG(G)-1,R+1)");
  rep("const NPO=G===1?3:1,NT=cur.length;", "const NPO=0,NT=cur.length;");
  rep("o.pos>NT-2?", "false?"); rep("o.pos===NT-2?", "false?");
  repRe(/document\.getElementById\("zleg"\)\.innerHTML=`.*?`;/, 'document.getElementById("zleg").innerHTML=`<span class="swp">scorri la tabella → per tutte le colonne</span>`;');
  rep("Girone ${g}</h2>", "${GIRNOMI[g]||\"Girone \"+g}</h2>");
  rep("· Girone ${g}${(arbOf", "· ${GIRNOMI[g]||\"Girone \"+g}${(arbOf");

  // niente tabellini: niente rose, formazioni e statistiche dei giocatori
  rep('<button data-v="r">Rose giocatori</button>', "");
  rep('const r=e.target.closest("tr[data-n]");if(r){teamLineup(r.dataset.n)}', 'const r=e.target.closest("tr[data-n]");if(r&&MATCHES.length){teamLineup(r.dataset.n)}');
  rep("Il tabellino ufficiale di questa partita non è ancora disponibile: formazioni, marcatori e cartellini compariranno appena la FIR lo pubblica.", "La FIR non pubblica i tabellini di questo campionato: formazioni e marcatori non sono disponibili.");
  rep("`</div>`+falli(ms,gs,one,1)+\n  `<div class=\"card\"><h2>Top realizzatori</h2>", "`</div>`+(MATCHES.length?falli(ms,gs,one,1)+\n  `<div class=\"card\"><h2>Top realizzatori</h2>");
  rep("Con più giocatori a pari merito vengono mostrati tutti (se sono tanti, in un elenco da aprire).</div>`}", "Con più giocatori a pari merito vengono mostrati tutti (se sono tanti, in un elenco da aprire).</div>`:giudiceBox(gs))}");
  rep("let SALL=false;", `// Giudice Sportivo (senza tabellini): squalifiche e multe delle squadre dei gironi scelti, dai comunicati
function giudiceBox(gs){
 const tOf=s=>{const t=findT(String(s||"").replace(/^della\\s+/i,""));return t&&gs.includes(t.g)?t:null};
 const sq=SQUALIFICHE.filter(s=>s.nome&&tOf(s.squadra)).sort((a,b)=>b.com-a.com);
 const mu=SANZIONI.filter(s=>s.testo&&/\\b(MULTA|AMMENDA)\\b/i.test(s.testo)&&tOf(s.testo.split(",")[0])).sort((a,b)=>b.com-a.com);
 const lk=s=>\`<a href="\${esc(s.pdf)}" target="_blank" rel="noopener">comunicato n. \${s.com}</a>\`;
 let h=\`<div class="card"><h2>Squalifiche</h2><div class="msg" style="margin:-4px 0 6px">Dai comunicati del Giudice Sportivo</div>\`+(sq.length?\`<ul class="el">\`+sq.map(s=>{const t=tOf(s.squadra);
  return \`<li>\${bdg(t.n)}<b>\${esc(tcap(s.nome))}</b> <small>(\${nm(t.n)})</small> · \${esc(sqTxt(s))}\${s.periodo?\` <small>(\${esc(s.periodo)})</small>\`:""} · \${lk(s)}</li>\`}).join("")+\`</ul>\`:'<div class="msg">Nessuna squalifica nei comunicati usciti finora.</div>')+\`</div>\`;
 h+=\`<div class="card"><h2>Multe alle società</h2>\`+(mu.length?\`<ul class="el">\`+mu.map(s=>{const t=tOf(s.testo.split(",")[0]),im=[...s.testo.matchAll(/(?:MULTA|AMMENDA)\\s+DI\\s+EURO\\s*([\\d.,]+)/gi)].map(x=>x[1].replace(/,00$/,"").replace(/[.,]$/,"")),
  mo=(s.testo.match(/infraz\\.?\\s*Art\\.?\\s*[\\d/.]+\\s*lett\\.?\\s*\\w+\\)\\s*\\(([^)]+)\\)/i)||[])[1]||"";
  return \`<li>\${bdg(t.n)}<b>\${nm(t.n)}</b> · \${im.length?\`<b>\${esc(im[im.length-1])} €</b>\`:"multa"}\${mo?\` <small>· \${esc(mo)}</small>\`:""} · \${lk(s)}</li>\`}).join("")+\`</ul>\`:'<div class="msg">Nessuna multa nei comunicati usciti finora.</div>')+\`</div>\`;
 return h+'<div class="msg">La FIR non pubblica i tabellini di questo campionato: non ci sono statistiche dei singoli giocatori.</div>'}
let SALL=false;`);

  // testi
  rep("<title>Serie A Rugby – Classifiche e rose</title>", `<title>${titolo} Rugby – Classifiche</title>`);
  rep("<h1>Serie A maschile – classifiche per giornata</h1>", `<h1>${titolo} – classifiche per giornata</h1>`);
  rep("Tocca una squadra per vedere i giocatori scesi in campo.</details>", "Risultati e mete dai comunicati ufficiali; calendario, orari e arbitri dal Match Centre FIR.</details>");
  rep("<h1>Serie A maschile – statistiche</h1>", `<h1>${titolo} – statistiche</h1>`);
  rep("<div class=\"sub\">Miglior attacco e miglior difesa dai risultati; giocatori dai tabellini FIR. Tocca un giocatore per vedere la sua scheda.</div>", "<div class=\"sub\">Miglior attacco e miglior difesa dai risultati; squalifiche e multe dai comunicati del Giudice Sportivo.</div>");

  // dati già presenti nella pagina: si tengono
  const P = `${C.pagina}`;
  if (fs.existsSync(new URL(P, R))) {
    const old = read(P);
    for (const re of LINES) { const m = old.match(re); if (m) h = h.replace(re, () => m[0]); }
    for (const b of [...BLOCKS]) { const v = getBlock(old, b); if (v != null) h = h.replace(new RegExp(`\\/\\*${b}-INIZIO\\*\\/[\\s\\S]*?\\/\\*${b}-FINE\\*\\/`), () => `/*${b}-INIZIO*/${v}/*${b}-FINE*/`); }
  }
  write(P, h);
  console.log(`${P}: ${h.length} byte`);
}
