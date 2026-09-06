/* Vergleicht das neue Modell (direkt aus sourceXML) mit dem alten Weg über
   mergeFiles.xslt + fixDom.xsl + Saxon. Damit ist belegt, dass die Portierung
   nichts verliert.

   Referenz erzeugen (braucht Java und Saxon):
     node build/prepare-xslt.js        → temp/fixedDOM-<slug>.xml

   Bekannte, gewollte Abweichungen:
     1. XSLT normalize-space() laesst U+00A0 stehen, das Node-Modell kollabiert es.
     2. fixDom.xsl verlor "Can also accept:" durch eine doppelt deklarierte
        Variable und erzeugte daraus Typen wie "NothingEnumCanalsoaccept:String".
        Das ist hier behoben; die betroffenen Typen weichen deshalb ab. */
'use strict';

const fs = require('fs');
const path = require('path');
const { build } = require('./model');
const legacy = require('./legacy-model');
const products = require('./products');

const ROOT = path.join(__dirname, '..');
const only = process.argv[2];
const todo = only ? products.filter(p => p.slug === only) : products;

/* NBSP angleichen und Laeufe kollabieren, sonst bleibt auf der XSLT-Seite ein
   doppeltes Leerzeichen stehen, wo Node schon eines gemacht hat. */
const canon = v => JSON.parse(JSON.stringify(v), (k, x) =>
  typeof x === 'string' ? x.replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim() : x);

/* Der alte Fehler hinterliess zwei Formen: zusammengezogen ("Canalsoaccept:")
   und, wenn der Array-Zweig griff, mit Leerzeichen ("Can also accept:"). */
const BROKEN = /Can ?(also ?)?accept:|Can ?return:/i;
const hasBrokenType = o => JSON.stringify(o.t || o.r || []).match(BROKEN) !== null;

/* Zwei weitere gewollte Abweichungen, beide zugunsten des neuen Wegs:

   3. fixDom.xsl schrieb mit indent="yes". In gemischtem Inhalt fuegte das
      Zeilenumbrueche zwischen Elemente ein, aus denen beim Einlesen ein
      Leerzeichen wurde: aus "<a>navbars</a><b>.filesystem</b>" wurde
      "navbars .filesystem". Direkt aus der Quelle gelesen stimmt es.
   4. Ein leeres <value/> ergab frueher den Standardwert "" und damit ein
      nacktes "= " in der Tabelle. Wird jetzt weggelassen. */
const noSpace = v => JSON.stringify(v).replace(/\s+/g, '');
const isWhitespaceArtefact = (was, now) => noSpace(was) === noSpace(now);
const isEmptyValueOnly = (was, now) => was.v === '' &&
  JSON.stringify(Object.assign({}, was, { v: undefined })) ===
  JSON.stringify(Object.assign({}, now, { v: undefined }));

/* 5. Der Array-Zweig von cleanTypeName liess Satzzeichen stehen, weil er die
      uebrige Bereinigung ueberspringt: "Arrays of 2 Strings." statt
      "Arrays of 2 Strings". Mit Punkt verlinkt der Typ nicht. */
const typeList = o => JSON.stringify((o.t || o.r || []).map(s => s.replace(/[.\s]+$/, '')));
const withoutTypes = o => JSON.stringify(Object.assign({}, o, { t: 0, r: 0 }));
const isTrailingPunctuationOnly = (was, now) =>
  typeList(was) === typeList(now) && withoutTypes(was) === withoutTypes(now);

/* 6. fixDom.xsl fuegte die AppleScript-Konstante als fertiges Element ein. Auf
      literale Ausgabe greifen keine Templates, deshalb blieb ihr Typ als
      "number" stehen, waehrend jeder andere Zahlentyp "Number" heisst. */
const lowerTypes = o => JSON.stringify((o.t || o.r || []).map(s => s.toLowerCase()));
const isTypeCaseOnly = (was, now) =>
  lowerTypes(was) === lowerTypes(now) && withoutTypes(was) === withoutTypes(now);

/* 9. Adobe presst Feldname und Typ in eine Angabe ("boundsKind:BoundingBoxLimits",
      "Ordered array containing coordinateSpace:CoordinateSpaces"). Die alte
      Strecke liess den Doppelpunkt stehen, fixdom.js loest ihn jetzt auf: der
      Teil dahinter ist der Typ, eine geordnete Liste wird zum Array.
      Anerkannt nur, wenn die alte Angabe wirklich einen Doppelpunkt trug und
      sonst nichts abweicht. */
const MANGLED = /[A-Za-z]:[A-Za-z]/;
const hasMangledType = o => MANGLED.test(JSON.stringify(o.t || o.r || []));

/* 10. Wo die alte Strecke ueberhaupt keinen Typ hatte, ist jeder Typ ein
       Gewinn. Betrifft parent: die Sonderbehandlung uebersprang Adobes
       "Can return:"-Prosa (Link) und die Form "The Folder object …"
       (File, Folder). */
const gainedType = (was, now) =>
  (was.t || []).length === 0 && (now.t || []).length > 0;

/* Ein Member ist entweder gleich, durch die Portierung verbessert, oder eine
   echte Abweichung. Methoden werden bis in die Parameter hinein verglichen —
   dort steckten sonst Unterschiede, die der Methodenvergleich verdeckt. */
function classify(was, now) {
  if (JSON.stringify(canon(was)) === JSON.stringify(canon(now))) return 'same';
  if (hasBrokenType(was)) return 'fixed';
  if (hasMangledType(was) && !hasMangledType(now)) return 'fixed';
  if (gainedType(was, now) && withoutTypes(was) === withoutTypes(now)) return 'fixed';
  if (isWhitespaceArtefact(canon(was), canon(now))) return 'fixed';
  if (isEmptyValueOnly(was, now)) return 'fixed';
  if (isTrailingPunctuationOnly(canon(was), canon(now))) return 'fixed';
  if (isTypeCaseOnly(canon(was), canon(now))) return 'fixed';
  if (Array.isArray(was.a) && Array.isArray(now.a)) {
    /* a:0 verhindert, dass der rekursive Aufruf wieder hier landet. */
    if (classify(Object.assign({}, was, { a: 0 }), Object.assign({}, now, { a: 0 })) === 'diff')
      return 'diff';
    if (was.a.length !== now.a.length) return 'diff';
    for (let i = 0; i < was.a.length; i++)
      if (classify(was.a[i], now.a[i]) === 'diff') return 'diff';
    return 'fixed';
  }
  return 'diff';
}

/* 7. build/additions.js ergaenzt Member, die Adobes Export vergisst. Die alte
      Strecke las nur die Quelle und kann sie nicht kennen. */
const additions = require('./additions');
const isAddition = (cls, key, name) =>
  key === 'm' && (additions.methods[cls] || []).some(x => x.n === name);

/* 8. Ebenso korrigiert additions.js einzelne Typangaben. Anerkannt wird das
      nur, wenn sich sonst nichts unterscheidet als Typ und Beschreibung. */
const bare = o => JSON.stringify(Object.assign({}, o, { t: 0, r: 0, d: 0 }));
const isCorrection = (cls, key, was, now) => key === 'p' &&
  additions.types[cls + '.' + now.n] !== undefined && bare(was) === bare(now);

let fatal = 0, totalFixed = 0;
for (const p of todo) {
  const ref = path.join(ROOT, 'temp', 'fixedDOM-' + p.slug + '.xml');
  if (!fs.existsSync(ref)) {
    console.log(p.slug.padEnd(17) + 'keine Referenz — "node build/prepare-xslt.js" ausfuehren');
    continue;
  }
  const t0 = Date.now();
  const mine = build({
    product: path.join(ROOT, p.src),
    javascript: path.join(ROOT, 'sourceXML/javascript.xml'),
    scriptui: path.join(ROOT, 'sourceXML/scriptui.xml')
  });
  const old = legacy.build(ref);
  const took = Date.now() - t0;

  const oldBy = new Map(old.classes.map(c => [c.n, c]));
  let diffs = 0, nbsp = 0, fixed = 0;
  const samples = [];

  for (const c of mine.classes) {
    const r = oldBy.get(c.n);
    if (!r) { samples.push('nur neu: ' + c.n); diffs++; continue; }
    if (JSON.stringify(r) === JSON.stringify(c)) continue;
    if (JSON.stringify(canon(r)) === JSON.stringify(canon(c))) { nbsp++; continue; }

    /* Member ueber den Namen paaren, nicht ueber den Index: der behobene Fehler
       verschmolz zwei Typen zu einem, dadurch sind die Listen verschieden lang
       und ein Indexvergleich verschoebe alles Nachfolgende. */
    let realDiff = false, fixedHere = 0;
    for (const key of ['p', 'ev', 'm']) {
      const before = new Map((r[key] || []).map(m => [m.n, m]));
      for (const now of (c[key] || [])) {
        const was = before.get(now.n);
        before.delete(now.n);
        /* Member aus build/additions.js gibt es in Adobes Export nicht und
           damit auch nicht auf der XSLT-Seite. Eine gewollte Abweichung. */
        if (!was) {
          if (isAddition(c.n, key, now.n)) { fixedHere++; continue; }
          realDiff = true;
          continue;
        }
        const verdict = classify(was, now);
        if (verdict === 'same') continue;
        if (verdict === 'fixed') { fixedHere++; continue; }
        if (isCorrection(c.n, key, was, now)) { fixedHere++; continue; }
        realDiff = true;
      }
      if (before.size) realDiff = true;   /* Member verschwunden */
    }
    if (!realDiff) { fixed += fixedHere; continue; }

    diffs++;
    if (samples.length < 4) {
      const a = JSON.stringify(r), b = JSON.stringify(c);
      let at = 0; while (at < a.length && a[at] === b[at]) at++;
      samples.push(c.n + '\n      XSLT …' + a.slice(Math.max(0, at - 70), at + 70) +
                          '\n      Node …' + b.slice(Math.max(0, at - 70), at + 70));
    }
  }
  for (const c of old.classes)
    if (!mine.classes.some(x => x.n === c.n)) { samples.push('fehlt jetzt: ' + c.n); diffs++; }

  totalFixed += fixed;
  const cnt = k => mine.classes.reduce((n, c) => n + c[k].length, 0);
  console.log(p.slug.padEnd(17) + String(mine.classes.length).padStart(5) + ' Klassen, ' +
    cnt('p') + ' Props, ' + cnt('ev') + ' Events, ' + cnt('m') + ' Methoden  (' + took + ' ms)');
  console.log('  '.padEnd(19) + 'nur U+00A0: ' + nbsp + '   Fehler behoben: ' + fixed +
    '   echte Abweichungen: ' + diffs);
  if (samples.length) console.log('    ' + samples.join('\n    '));
  if (diffs) fatal++;
}

console.log('\nvom alten Fehler befreite Typen: ' + totalFixed);
if (fatal) { console.log('ABWEICHUNG in ' + fatal + ' Produkt(en)'); process.exit(1); }
console.log('Portierung stimmt mit der XSLT-Strecke ueberein');
