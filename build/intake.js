/* npm run intake — nimmt neue Adobe-XMLs in sourceXML/ auf.

   Jede XML direkt in sourceXML/ bekommt den Namen, der zu ihrem Titel passt
   (build/sources.js): indesign-22.0.0.61.xml, indesign-server-…, illustrator-29.xml.
   Danach steht da, welche Datei products.js noch nicht kennt, und was dafür
   in products.js zu ändern ist. products.js selbst bleibt unangetastet.

   --dry-run   nur anzeigen, nichts umbenennen

   sourceXML/archive/ wird nicht angefasst. Eine Datei, deren Zielname schon
   von einer anderen belegt ist, bleibt liegen: bei gleichem Inhalt als Doppel
   gemeldet, sonst als Konflikt (Exit 1). Unterscheiden sich die Namen nur in
   der Schreibweise (Windows: dieselbe Datei), wird über einen Zwischennamen
   umbenannt. */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { describe, compareVersions } = require('./sources');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'sourceXML');
const DRY = process.argv.includes('--dry-run');
const products = require(process.env.PRODUCTS ? path.resolve(process.env.PRODUCTS) : './products');

const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const rel = name => 'sourceXML/' + name;
const norm = f => path.resolve(f).toLowerCase();

/* Welche Dateien products.js verwendet — über den vollen Pfad, denn eine
   gleichnamige Datei in archive/ ist eine andere. descFrom zählt mit. */
const used = new Map();
for (const p of products) {
  for (const v of p.versions || [{ src: p.src }]) used.set(norm(path.resolve(ROOT, v.src)), v.src);
  if (p.descFrom) used.set(norm(path.resolve(ROOT, p.descFrom)), p.descFrom);
}

/* Was in products.js zu ändern ist, damit die neue Datei veröffentlicht wird. */
function advice(d) {
  const p = products.find(x => x.slug === d.product);
  if (!p) return 'kein Produkt "' + d.product + '" in products.js';
  const key = d.year || d.version;
  const entry = '{ key: \'' + key + '\', src: \'' + rel(d.name) + '\' }';
  const vs = (p.versions || [{ src: p.src }]).map(v => {
    const f = path.resolve(ROOT, v.src);
    const info = fs.existsSync(f) ? describe(f) : {};
    return { src: v.src, key: v.key || info.year || info.version, version: info.version };
  });

  /* Gleicher key: ein Update innerhalb des Jahres (21.5 → 21.6) ersetzt den
     Eintrag, statt einen zweiten mit demselben key anzulegen. */
  const same = vs.findIndex(v => v.key === key);
  if (same >= 0) {
    if (vs[same].version && compareVersions(d.version, vs[same].version) <= 0)
      return 'nicht verwendet, nicht neuer als ' + vs[same].src + ' — nach sourceXML/archive/ verschieben';
    return 'NEU — in products.js ' + (p.versions ? 'versions[' + same + '] von ' + d.product : 'src von ' + d.product) +
      ' ersetzen (bisher ' + vs[same].src + '):\n      ' + (p.versions ? entry + ',' : 'src: \'' + rel(d.name) + '\',');
  }
  if (vs[0].version && compareVersions(d.version, vs[0].version) <= 0)
    return 'nicht verwendet, älter als ' + vs[0].version + ' — nach sourceXML/archive/ verschieben';
  return 'NEU — in products.js oben in versions von ' + d.product + ' einfügen' +
    (p.versions ? '' : ' (bisher nur src: daraus versions machen)') + ':\n      ' + entry + ',';
}

let failed = false;
const rows = [];
for (const name of fs.readdirSync(DIR).filter(f => /\.xml$/i.test(f)).sort()) {
  const file = path.join(DIR, name);
  const d = describe(file);
  const row = { name, d, note: [] };
  rows.push(row);

  if (!d.product) {
    row.note.push('unbekannter Titel „' + d.title + '“ — Muster in build/sources.js ergänzen');
    failed = true;
    continue;
  }

  let current = file;
  if (name !== d.name) {
    const target = path.join(DIR, d.name);
    const caseOnly = name.toLowerCase() === d.name.toLowerCase();
    if (!caseOnly && fs.existsSync(target)) {
      if (hash(target) === hash(file))
        row.note.push('Doppel von ' + d.name + ' — kann weg oder nach archive/');
      else { row.note.push('Konflikt: ' + d.name + ' existiert mit anderem Inhalt'); failed = true; }
      continue;
    }
    if (!DRY) {
      if (caseOnly) {
        const tmp = target + '.intake-' + process.pid;
        fs.renameSync(file, tmp);
        fs.renameSync(tmp, target);
      } else fs.renameSync(file, target);
      current = target;
    }
    row.note.push((DRY ? 'würde umbenannt' : 'umbenannt') + ' → ' + d.name);
    if (used.has(norm(file)))
      row.note.push('products.js nennt noch ' + used.get(norm(file)) + ' — auf ' + rel(d.name) + ' ändern');
  }

  /* Kopfzeilen, die beim Release-Tag auffallen sollten. */
  const head = fs.readFileSync(current).subarray(0, 3);
  if (head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) row.note.push('beginnt mit BOM');

  if (d.product === 'javascript' || d.product === 'scriptui') continue;
  if (used.has(norm(file)) || used.has(norm(path.join(DIR, d.name)))) continue;
  row.note.push(advice(d));
}

for (const r of rows) {
  const d = r.d;
  console.log(r.name.padEnd(34) + (d.product ? (d.year || '').padEnd(6) + d.title : '?'));
  for (const n of r.note) console.log('    ' + n);
}
if (DRY) console.log('\n(--dry-run: nichts umbenannt)');
process.exit(failed ? 1 : 0);
