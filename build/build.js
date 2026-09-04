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
    uxp: m.product.uxp, kind: 'Product',
    data: subset(m.data, 'p', m.data.version)
  })),
  /* Beide Bibliotheken gibt es nur unter ExtendScript — UXP nutzt eine andere
     Engine und kennt weder $ und File noch ScriptUI. */
  { slug: 'javascript', label: 'Core JavaScript', kind: 'Shared library',
    shortVersion: 'ExtendScript only', esOnly: true,
    data: subset(shared, 'js', 'Core JavaScript Classes') },
  { slug: 'scriptui', label: 'ScriptUI', kind: 'Shared library',
    shortVersion: 'ExtendScript only', esOnly: true,
    data: subset(shared, 'sui', 'ScriptUI Classes') }
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

  console.log('  ' + t.slug.padEnd(17) + String(t.data.classes.length).padStart(5) + ' Seiten');
}

/* ---------- Startseite ---------- */
write('index.html', homePage(targets, models[0].data.generated));
for (const f of ['site.css', 'site.js'])
  write('assets/' + f, fs.readFileSync(path.join(__dirname, 'assets', f)));

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
