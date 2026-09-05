/* Baut die komplette Website direkt aus sourceXML/ nach site/.
   Einziger Schritt vom Objektmodell zur Website. Weder oXygen noch Java
   werden gebraucht.

   Ausgabe:
     site/index.html          Auswahl der Bibliotheken
     site/assets/             gemeinsames CSS und JS
     site/<slug>/             je Produkt bzw. Bibliothek eine Seite pro Objekt

   ScriptUI und die Kern-JavaScript-Klassen stecken in jedem Produkt-XML
   identisch drin. Sie werden deshalb einmal als eigene Bibliotheken ausgegeben
   statt in jedem Produkt zu wiederholen. */
'use strict';

const fs = require('fs');
const path = require('path');
const { build, derive } = require('./model');
const { make, esc, pageOf, splitVersion, THEME_BOOT } = require('./render');
const products = require('./products');
const agents = require('./agents');
const { createZip } = require('./zip');

const ROOT = path.join(__dirname, '..');
const OUT = process.env.OUT_DIR || path.join(ROOT, 'site');
const started = Date.now();

/* ---------- Modelle laden ----------
   Direkt aus sourceXML, ohne Zwischenschritt: mergeFiles.xslt und fixDom.xsl
   sind nach build/fixdom.js portiert, Saxon wird nicht mehr gebraucht. */
const JS_XML = path.join(ROOT, 'sourceXML/javascript.xml');
const SUI_XML = path.join(ROOT, 'sourceXML/scriptui.xml');
const models = [];
for (const p of products) {
  const src = path.join(ROOT, p.src);
  if (!fs.existsSync(src)) { console.error('fehlt: ' + p.src); process.exit(2); }
  models.push({ product: p, data: build({ product: src, javascript: JS_XML, scriptui: SUI_XML }) });
}
console.log('modelle  ' + models.length + ' Produkte in ' + (Date.now() - started) + ' ms');

/* ---------- Ziele zusammenstellen ---------- */
/* Jedes Ziel bekommt nur die Klassen seiner Herkunft. Die gemeinsamen
   Bibliotheken stammen aus dem ersten Produkt — sie sind ueberall gleich. */
const shared = models[0].data;
const subset = (data, origin, version) => ({
  version, generated: data.generated,
  classes: data.classes.filter(c => c.g === origin)
});

const targets = [
  ...models.map(m => ({
    slug: m.product.slug, label: m.product.label, note: m.product.note,
    uxp: m.product.uxp, refcard: m.product.refcard, kind: 'Product',
    data: subset(m.data, 'p', m.data.version)
  })),
  /* Beide Bibliotheken gibt es nur unter ExtendScript — UXP nutzt eine andere
     Engine und kennt weder $ und File noch ScriptUI. */
  { slug: 'javascript', label: 'Core JavaScript', kind: 'Shared library',
    shortVersion: 'ExtendScript only', esOnly: true,
    data: subset(shared, 'js', 'Core JavaScript Classes') },
  /* Das Suffix (WindowSUI) trennt die ScriptUI-Klassen im gemeinsamen Modell
     von den neun gleichnamigen Produktklassen. Im eigenen Ziel steht keine
     davon daneben, und im Skript heisst die Klasse Window — deshalb faellt es
     hier weg, fuer die Seiten wie fuer die Typen. Geprueft: kein Produkt- und
     kein Kerntyp heisst wie eine ScriptUI-Klasse, ohne selbst eine zu sein. */
  { slug: 'scriptui', label: 'ScriptUI', kind: 'Shared library',
    shortVersion: 'ExtendScript only', esOnly: true,
    data: Object.assign(subset(shared, 'sui', 'ScriptUI Classes'), {
      classes: agents.withoutSuiSuffix(subset(shared, 'sui', '').classes)
    }) }
];

for (const t of targets) {
  t.names = new Set(t.data.classes.map(c => c.n));
  /* Nur der Versionsteil: aus "Illustrator 29" neben dem Label "Illustrator"
     bliebe sonst "Illustrator Illustrator 29" stehen. */
  if (!t.shortVersion)
    t.shortVersion = splitVersion(t.data.version).name.replace(t.label, '').trim();
}

/* Auflösung von Typnamen: erst im eigenen Ziel, dann in den gemeinsamen
   Bibliotheken. "Document" bleibt so im eigenen Produkt, "File" landet bei
   Core JavaScript statt ins Leere zu zeigen. */
const js = targets.find(t => t.slug === 'javascript');
const sui = targets.find(t => t.slug === 'scriptui');
const resolverFor = t => name => {
  if (t.names.has(name)) return pageOf(name);
  if (js.names.has(name)) return '../javascript/' + pageOf(name);
  if (sui.names.has(name)) return '../scriptui/' + pageOf(name);
  return null;
};

/* ---------- schreiben ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });

let bytes = 0, pages = 0;
const typeStats = [];
const write = (rel, content) => {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
  bytes += Buffer.byteLength(content);
};

/* Windows unterscheidet Gross-/Kleinschreibung nicht. Zwei Objekte, die sich nur
   darin unterscheiden, wuerden sich ueberschreiben — InDesign hat eine Klasse
   namens Changes, ein Topic changes.html loeschte sie einmal.
   index.html ist vom Generator belegt. */
function assertNoCollisions(t) {
  const seen = new Map([['index.html', '(reserviert)']]);
  for (const c of t.data.classes) {
    const key = pageOf(c.n).toLowerCase();
    if (seen.has(key)) {
      console.error(t.slug + ': Dateinamen-Kollision "' + seen.get(key) + '" / "' + c.n + '" → ' + key);
      process.exit(1);
    }
    seen.set(key, c.n);
  }
}

for (const t of targets) {
  assertNoCollisions(t);
  const d = derive(t.data);
  const r = make(t.data, d, { target: t, targets, resolve: resolverFor(t) });

  for (const c of t.data.classes) { write(t.slug + '/' + pageOf(c.n), r.page(c)); pages++; }
  write(t.slug + '/index.html', r.indexPage()); pages++;

  write(t.slug + '/nav.js', 'window.__NAV=' + JSON.stringify(t.data.classes.map(c => [
    c.n, c.enum ? 2 : d.isCollection(c) ? 1 : 0,
    c.enum ? 0 : c.p.length + c.ev.length + c.m.length
  ])) + ';');

  const index = [];
  for (const c of t.data.classes) {
    index.push([0, c.n, c.n, c.d]);
    for (const p of c.p) index.push([1, c.n, p.n, p.d]);
    for (const e of c.ev) index.push([2, c.n, e.n, e.d]);
    for (const m of c.m) index.push([3, c.n, m.n, m.d]);
  }
  write(t.slug + '/search.js', 'window.__SEARCH=' + JSON.stringify(index) + ';');

  /* ---------- maschinenlesbare Zwillinge ----------
     Markdown je Objekt unter derselben URL wie die Seite, dazu api.json und
     eine TypeScript-Deklaration. Siehe build/agents.js. */
  const kindOf = c => c.enum ? 'Enumeration' : d.isCollection(c) ? 'Collection' : 'Object';
  const elementOf = c => d.isCollection(c) ? d.elementOf(c) : null;
  const T = agents.makeTypeMapper(new Set(
    /* Die Typabbildung kennt auch die gemeinsamen Bibliotheken: File und
       WindowSUI kommen in Produkttypen vor, stehen aber nicht im Produkt. */
    [...t.names, ...js.names, ...sui.names]));

  for (const c of t.data.classes)
    write(t.slug + '/' + pageOf(c.n).replace(/\.html$/, '.md'),
      agents.markdown(c, {
        kind: kindOf(c), element: elementOf(c), T, target: t, version: t.data.version
      }));

  write(t.slug + '/api.json', agents.apiJson(t, t.data.classes, {
    kindOf, elementOf, T, version: t.data.version, generated: t.data.generated
  }));

  /* Die .d.ts eines Produkts ist in sich geschlossen: das Produkt plus Core
     JavaScript. Eine Datei ins Projekt legen und fertig — Verweise auf
     Nachbardateien waeren beim Herunterladen nur eine Fehlerquelle.

     ScriptUI steckt bewusst nicht darin. Neun seiner Klassen heissen wie
     Produktklassen (Window, Button, Event, Events, Group, ListBox, Panel,
     RadioButton, StaticText); auf der Website trennt sie ein Suffix, im Code
     waere WindowSUI aber falsch — dort heisst die Klasse Window. ScriptUI
     bekommt deshalb seine eigene Datei mit den richtigen Namen. */
  const forTypes = t.kind === 'Product'
    ? t.data.classes.concat(js.data.classes)
    : t.data.classes;
  const withElement = cs => cs.map(c => Object.assign({}, c, { element: elementOf(c) }))
    .sort((a, b) => a.n < b.n ? -1 : a.n > b.n ? 1 : 0);
  /* Eigene Typabbildung je Deklarationsdatei: sie darf nur Namen kennen, die
     in derselben Datei stehen. Die gemeinsame kennt auch die Nachbarziele —
     damit stand in scriptui.d.ts ein Verweis auf File, den die Datei nicht
     deklariert. Was hier fehlt, wird zum Alias auf any. */
  const dtsClasses = withElement(forTypes);
  const Tdts = agents.makeTypeMapper(new Set(dtsClasses.map(c => c.n)));
  write(t.slug + '/' + t.slug + '.d.ts', agents.buildTypes(dtsClasses, Tdts, {
    title: t.label + ' — ' + t.data.version,
    generated: t.data.generated,
    home: 'https://www.indesignjs.de/extendscriptAPI/' + t.slug + '/'
  }));

  /* ---------- Produkt und ScriptUI in einer Datei ----------
     Neun Klassennamen gibt es in beiden Modellen; TypeScript kennt je globalem
     Namen nur eine Bedeutung. Wer einen Dialog baut, braucht new Window() —
     deshalb gewinnt hier ScriptUI, und die neun Produktklassen fallen weg.
     Ihre Verweise werden zu any: keine Hilfe, aber auch keine falsche. Ohne
     das erbte etwa ImportExportEvent von ScriptUIs Event. */
  if (t.kind === 'Product') {
    const suiNames = new Set(sui.data.classes.map(c => c.n));
    const weicht = new Set(t.data.classes.map(c => c.n).filter(n => suiNames.has(n)));
    const kombi = t.data.classes.filter(c => !weicht.has(c.n))
      .map(c => weicht.has(c.sup) ? Object.assign({}, c, { sup: null }) : c)
      .concat(js.data.classes, sui.data.classes);
    const Tk = agents.makeTypeMapper(new Set(kombi.map(c => c.n)), weicht);
    write(t.slug + '/' + t.slug + '-scriptui.d.ts', agents.buildTypes(withElement(kombi), Tk, {
      title: t.label + ' + ScriptUI — ' + t.data.version,
      generated: t.data.generated,
      home: 'https://www.indesignjs.de/extendscriptAPI/' + t.slug + '/',
      yielded: [...weicht].sort()
    }));
  }
  write(t.slug + '/llms.txt', agents.llmsProduct(t, t.data.classes, kindOf));
  typeStats.push([t.slug, T.stats()]);

  console.log('  ' + t.slug.padEnd(17) + String(t.data.classes.length).padStart(5) + ' Seiten');
}

/* ---------- Startseite ---------- */
write('index.html', homePage(targets, models[0].data.generated));
write('llms.txt', agents.llmsRoot(targets, models[0].data.generated));
for (const f of ['site.css', 'site.js', 'idskurzreferenz.jpg'])
  write('assets/' + f, fs.readFileSync(path.join(__dirname, 'assets', f)));

/* ---------- die ganze Website als ein Archiv ----------
   Fuer den Offline-Gebrauch: entpacken, index.html oeffnen, fertig. Deshalb
   muss wirklich alles hinein, auch die Querverweise zwischen den Produkten.

   Zweimal gepackt, weil die Uebersichtsseiten die Groesse nennen und die erst
   nach dem Packen feststeht. Der zweite Durchgang unterscheidet sich nur um
   wenige Bytes; auf ganze MB gerundet ist die Zahl in beiden gleich — auch in
   der Fassung, die im Archiv landet. */
const ZIP = 'extendscriptAPI.zip';
function collect() {
  const out = [];
  (function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort(
      (a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const p = path.join(dir, e.name), r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { walk(p, r); continue; }
      if (e.name.endsWith('.zip')) continue;      /* nicht sich selbst einpacken */
      out.push({ name: r, data: fs.readFileSync(p) });
    }
  })(OUT, '');
  return out;
}

const zipStart = Date.now();
let entries = collect();
const mb = Math.round(createZip(entries, new Date()).length / 1048576);
for (const e of entries) {
  if (!/(^|\/)index\.html$/.test(e.name)) continue;
  const html = e.data.toString('utf8');
  if (!html.includes('__ZIPMB__')) continue;
  fs.writeFileSync(path.join(OUT, e.name), html
    .split('__ZIPMB__').join(String(mb))
    .split('__ZIPPAGES__').join(pages.toLocaleString('en-US')));
}
const archive = createZip(collect(), new Date());
write(ZIP, archive);
console.log('archiv   ' + ZIP + '  ' + (archive.length / 1048576).toFixed(1) + ' MB aus ' +
  entries.length + ' Dateien in ' + ((Date.now() - zipStart) / 1000).toFixed(1) + ' s');

for (const [slug, st] of typeStats)
  if (st.unknown)
    console.log('  ' + slug.padEnd(17) + st.unknown + ' Typangaben ohne Entsprechung → any' +
      (st.top.length ? '  (' + st.top.map(x => x[0] + '×' + x[1]).slice(0, 3).join(', ') + ')' : ''));

console.log('gesamt   ' + pages + ' Seiten, ' + (bytes / 1048576).toFixed(1) + ' MB in ' +
  (Date.now() - started) + ' ms → ' + path.relative(ROOT, OUT));

function homePage(targets, generated) {
  const card = t => {
    const v = splitVersion(t.data.version);
    return `<li><a href="${esc(t.slug)}/index.html">
      <b>${esc(t.label)}</b>
      <span class="v">${esc(v.name === t.label ? '' : v.name)}${v.build ? ' · ' + esc(v.build) : ''}</span>
      <span class="c">${t.data.classes.length} entries</span>
      ${t.note ? `<span class="note">${esc(t.note)}</span>` : ''}</a></li>`;
  };
  const prods = targets.filter(t => t.kind === 'Product');
  const libs = targets.filter(t => t.kind !== 'Product');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Adobe ExtendScript API</title>
<meta name="description" content="Reference for the Adobe ExtendScript object models: InDesign, Illustrator, Photoshop, Bridge, plus ScriptUI and the core JavaScript classes.">
<link rel="stylesheet" href="assets/site.css">
<script>${THEME_BOOT}</script>
</head>
<body class="home">
<header class="top">
  <span class="logo">indesign<b>js</b></span>
  <div class="fs" hidden data-enhance="fontsize">
    <button type="button" data-f="-" aria-label="Smaller text">A−</button>
    <span class="lvl"></span>
    <button type="button" data-f="+" aria-label="Larger text">A+</button>
  </div>
  <button class="tg" type="button" hidden data-enhance="theme"></button>
</header>
<main class="doc"><div class="dmain">
  <div class="kind">Reference</div>
  <h1>Adobe ExtendScript API</h1>
  <p class="lede">Object models for the Adobe applications, generated from Adobe’s own
  OMV exports. ScriptUI and the core JavaScript classes are shared by every application
  and documented once.</p>
  <section><h2 class="sechead">Applications <b>${prods.length}</b></h2>
    <ul class="cards">${prods.map(card).join('')}</ul></section>
  <section><h2 class="sechead">Shared libraries <b>${libs.length}</b></h2>
    <ul class="cards">${libs.map(card).join('')}</ul></section>
  <section class="offline"><h2 class="sechead" id="offline">Offline</h2>
    <ul class="dl">
      <li><a href="extendscriptAPI.zip" download><b>extendscriptAPI.zip</b>
        <span>The whole site: every application and both shared libraries,
        __ZIPPAGES__ pages. Unpack it and open <code>index.html</code> —
        no server, no internet. About __ZIPMB__ MB.</span></a></li>
    </ul></section>
  <section class="machine"><h2 class="sechead" id="for-tools">For editors and AI agents</h2>
    <p class="lede">Every target ships TypeScript declarations, a JSON model and a
    Markdown twin of each page at the same path. Point an agent at
    <a href="llms.txt">llms.txt</a>, or open a target above and look under
    <i>For editors and AI agents</i>.</p></section>
  <footer>
    <p class="legal">Generated with AI assistance from Adobe’s original sources — descriptive texts
    are Adobe’s, transformation errors are ours. Copyright of the original files, and the trademarks
    InDesign, Photoshop, Illustrator, ExtendScript and ScriptUI, are held by Adobe Inc.</p>
    <p class="meta">Built on ${esc(generated)}.</p>
    <p class="by">Created with <span class="hrt">&#9829;</span> by
      <a href="https://www.linkedin.com/in/gregor-fellenz/" rel="noopener">Gregor Fellenz</a>,
      <a href="https://www.publishingx.de/" rel="noopener">publishingX</a>
      <span class="sep">|</span>
      <a href="https://www.publishingx.de/impressum/" rel="noopener">Impressum</a>
      <span class="sep">|</span>
      <a href="https://www.publishingx.de/datenschutzerklaerung/" rel="noopener">Datenschutz</a></p>
  </footer>
</div></main>
<script src="assets/site.js" defer></script>
</body>
</html>
`;
}
