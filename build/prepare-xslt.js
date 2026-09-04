/* Erzeugt je Produkt eine bereinigte DOM-Datei unter temp/.

     sourceXML/<produkt>.xml + javascript.xml + scriptui.xml
       → mergeFiles.xslt → fixDom.xsl → temp/fixedDOM-<slug>.xml

   Beide Transformationen sind noch XSLT und brauchen Saxon (Stufe 2 der
   Ablösung). Saxon wird über SAXON_JAR gesucht; ohne Java lässt sich der
   Schritt auch von Hand ausführen, siehe build/README.md. */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const products = require('./products');

const ROOT = path.join(__dirname, '..');
const TEMP = path.join(ROOT, 'temp');

/* Übliche Fundorte, damit man SAXON_JAR nicht jedes Mal setzen muss. */
const CANDIDATES = [
  process.env.SAXON_JAR,
  path.join(ROOT, 'tools', 'saxon-he.jar'),
  'C:/Users/hp/Desktop/Oxygen XML Editor 17/lib/saxon9ee.jar',
  'C:/Program Files/Oxygen XML Editor 17/lib/saxon9ee.jar'
].filter(Boolean);

const saxon = CANDIDATES.find(p => fs.existsSync(p));
if (!saxon) {
  console.error('Kein Saxon gefunden. SAXON_JAR setzen oder saxon-he.jar nach tools/ legen.');
  console.error('Gesucht in:\n  ' + CANDIDATES.join('\n  '));
  process.exit(2);
}

const run = args => execFileSync('java', ['-cp', saxon, 'net.sf.saxon.Transform', ...args],
  { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });

fs.mkdirSync(TEMP, { recursive: true });
const only = process.argv[2];
const todo = only ? products.filter(p => p.slug === only) : products;
if (!todo.length) {
  console.error('Unbekanntes Produkt: ' + only);
  console.error('Bekannt: ' + products.map(p => p.slug).join(', '));
  process.exit(2);
}

for (const p of todo) {
  const src = path.join(ROOT, p.src);
  if (!fs.existsSync(src)) { console.error('fehlt: ' + p.src); process.exitCode = 1; continue; }

  const merged = path.join(TEMP, 'merged-' + p.slug + '.xml');
  const fixed = path.join(TEMP, 'fixedDOM-' + p.slug + '.xml');
  const t0 = Date.now();

  run(['-it:mergeDOMFiles', '-xsl:mergeFiles.xslt', 'product.xml=' + p.src, '-o:' + merged]);
  run(['-s:' + merged, '-xsl:fixDom.xsl', '-o:' + fixed]);
  fs.rmSync(merged, { force: true });

  console.log(p.slug.padEnd(17) + (fs.statSync(fixed).size / 1048576).toFixed(1).padStart(5) +
    ' MB  ' + (Date.now() - t0) + ' ms  ← ' + p.src);
}
