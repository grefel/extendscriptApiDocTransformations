/* Liest die Adobe-OMV-XMLs und baut daraus das Datenmodell der Website.

   Produkt-, JavaScript- und ScriptUI-XML werden direkt gelesen und dabei
   bereinigt (siehe fixdom.js); eine Zwischendatei gibt es nicht.

   build/verify-model.js vergleicht das Ergebnis gegen die alte Saxon-Strecke.
   Fallstricke des Adobe-DOM siehe CLAUDE.md. */
'use strict';

const fs = require('fs');
const { DOMParser } = require('@xmldom/xmldom');
const fix = require('./fixdom');

/* ---------- kleine DOM-Helfer ---------- */

function kids(el, name) {
  const out = [];
  if (!el) return out;
  for (let n = el.firstChild; n; n = n.nextSibling)
    if (n.nodeType === 1 && (!name || localName(n) === name)) out.push(n);
  return out;
}
/* Die Quellen tragen teils den omv-Namespace, teils nicht — mergeFiles.xslt hat
   ihn frueher entfernt. Hier wird stattdessen ueber den lokalen Namen gesucht. */
const localName = n => n.localName || n.nodeName.replace(/^.*:/, '');
const firstKid = (el, name) => kids(el, name)[0];
const attr = (el, a) => (el && el.getAttribute(a)) || '';

/* XSLT normalize-space() kennt nur Leerzeichen, Tab, CR und LF. JavaScripts \s
   erfasst zusaetzlich U+00A0 und Verwandte. Wir kollabieren die bewusst mit —
   im Fliesstext ist ein geschuetztes Leerzeichen aus Adobes Quelle kein Gewinn. */
const text = el => (el ? el.textContent || '' : '')
  .replace(/[\s   ]+/g, ' ').trim();

const desc = el => text(firstKid(el, 'shortdesc') || firstKid(el, 'description'));

/* ---------- Member ---------- */

/* Events sind Klassenkonstanten und nur am Beschreibungstext erkennbar.
   Die uebrigen Klassen-Properties sind echte statische Properties ($.build). */
const isEvent = p => desc(p).startsWith('Dispatched');

/* "Varies" ist Adobes Platzhalter und faellt weg, sobald konkretere Typen
   danebenstehen. */
function typeNames(list) {
  const all = list.map(t => t.name).filter(Boolean);
  return all.length > 1 ? all.filter(t => t !== 'Varies') : all;
}

function member(node, description, isSui) {
  const { types, range } = fix.datatypesOf(node, description, isSui, kids, text);
  const o = { t: typeNames(types) };
  if (types.some(t => t.array)) o.arr = 1;
  if (range) o.rng = range;
  if (types.some(t => t.isUnit)) o.mu = 1;
  const withValue = types.find(t => t.value);
  if (withValue) o.v = withValue.value;
  return o;
}

function property(p, isStatic, isSui) {
  const d = desc(p);
  const o = { n: attr(p, 'name') };

  /* Die parent-Property nennt ihre Typen nur im Text und ist immer readonly. */
  if (o.n === 'parent') {
    const types = fix.parentTypes(d, isSui);
    o.t = typeNames(types);
    o.rw = 'readonly';
    o.d = d;
    if (isStatic) o.st = 1;
    return o;
  }

  const m = member(p, d, isSui);
  o.t = m.t;
  o.rw = attr(p, 'rwaccess') || 'read/write';   /* fehlt in der Quelle oft */
  o.d = d;
  if (m.arr) o.arr = 1;
  if (m.rng) o.rng = m.rng;
  if (m.mu) o.mu = 1;
  if (m.v) o.v = m.v;
  if (isStatic) o.st = 1;
  return o;
}

function method(m, isSui) {
  const d = desc(m);
  /* Der Rueckgabetyp haengt direkt am <method>; ein <returns> gibt es nicht. */
  const r = member(m, d, isSui);
  const o = { n: attr(m, 'name'), r: r.t };
  if (r.arr) o.rarr = 1;
  o.d = d;
  const ps = firstKid(m, 'parameters');
  o.a = (ps ? kids(ps, 'parameter') : []).map(a => {
    const ad = desc(a);
    const am = member(a, ad, isSui);
    const p = { n: attr(a, 'name'), t: am.t, d: ad };
    if (am.arr) p.arr = 1;
    if (am.rng) p.rng = am.rng;
    if (am.mu) p.mu = 1;
    /* Adobe markiert optionale Parameter uneinheitlich: teils @optional,
       teils nur mit "(Optional)" am Ende der Beschreibung. */
    if (attr(a, 'optional') === 'true' || ad.endsWith('(Optional)')) p.o = 1;
    return p;
  });
  return o;
}

const byName = (a, b) => (a.n < b.n ? -1 : a.n > b.n ? 1 : 0);

/* ---------- Klassen ---------- */

function classModel(cd, origin) {
  const isEnum = attr(cd, 'enumeration') === 'true';
  const isSui = origin === 'sui';
  const classProps = [], instanceProps = [], methods = [];
  for (const els of kids(cd, 'elements')) {
    const onClass = attr(els, 'type') === 'class';
    for (const p of kids(els, 'property')) (onClass ? classProps : instanceProps).push(p);
    for (const m of kids(els, 'method')) methods.push(m);
  }

  let name = attr(cd, 'name');
  /* ScriptUI-Klassen bekommen ein Suffix, "Index" einen Unterstrich — sonst
     kollidiert es mit Produktklassen bzw. mit index.html. */
  if (isSui && !/(object|string|bool|number|array|function|file|folder)/i.test(name)) name += 'SUI';
  if (attr(cd, 'name') === 'Index') name += '_';

  const o = { n: name, d: desc(cd) };
  if (isEnum) o.enum = 1;
  /* Herkunft: js = Kern-JavaScript, sui = ScriptUI, p = Objektmodell des Produkts. */
  o.g = origin;
  const sup = firstKid(cd, 'superclass');
  if (sup) o.sup = fix.cleanTypeName(text(sup), isSui);

  /* Bei Enumerations sind die Klassen-Properties die Werte. */
  o.p = (isEnum
    ? classProps.map(p => property(p, false, isSui))
    : [...classProps.filter(p => !isEvent(p)).map(p => property(p, true, isSui)),
       ...instanceProps.map(p => property(p, false, isSui))]
  ).sort(byName);

  /* fixDom.xsl ergaenzt AppleScript im Windows-DOM. */
  if (name === 'ScriptLanguage' && !o.p.some(p => p.n === fix.APPLESCRIPT_LANGUAGE.n))
    o.p = [...o.p, Object.assign({}, fix.APPLESCRIPT_LANGUAGE)].sort(byName);
  /* … und app am globalen Objekt. */
  if (name === 'global' && origin === 'js' && !o.p.some(p => p.n === 'app'))
    o.p = [Object.assign({}, fix.GLOBAL_APP), ...o.p].sort(byName);

  o.ev = (isEnum ? [] : classProps.filter(isEvent))
    .map(e => ({ n: attr(e, 'name'), d: desc(e) })).sort(byName);

  o.m = methods.map(m => method(m, isSui)).sort(byName);
  return o;
}

/* ---------- oeffentliche API ---------- */

function parse(file) {
  return new DOMParser({ onError: () => {} })
    .parseFromString(fs.readFileSync(file, 'utf8'), 'text/xml');
}

function classdefsIn(doc) {
  const found = [];
  (function walk(el) {
    for (const c of kids(el)) {
      if (localName(c) === 'classdef') found.push(c); else walk(c);
    }
  })(doc.documentElement);
  return found;
}

const titleOf = doc => {
  const dict = doc.documentElement;
  const map = (function find(el, depth) {
    if (depth > 4) return null;
    for (const c of kids(el)) {
      if (localName(c) === 'map') return c;
      const r = find(c, depth + 1); if (r) return r;
    }
    return null;
  })(dict, 0);
  return attr(map, 'title');
};

/* sources = { product, javascript, scriptui } — Pfade zu den OMV-XMLs. */
function build(sources) {
  const parts = [
    ['js', sources.javascript],
    ['sui', sources.scriptui],
    ['p', sources.product]
  ].filter(([, f]) => f && fs.existsSync(f));

  const classes = [];
  let version = '';
  for (const [origin, file] of parts) {
    const doc = parse(file);
    if (origin === 'p') version = titleOf(doc);
    for (const cd of classdefsIn(doc)) {
      /* Photoshop bringt ein zweites "global" mit, das das echte verdeckt. */
      if (origin === 'p' && attr(cd, 'name') === 'global') continue;
      classes.push(classModel(cd, origin));
    }
  }

  return {
    version,
    generated: new Date().toISOString().slice(0, 10),
    classes: classes.sort(byName)
  };
}

/* Collections werden je Produkt voellig unterschiedlich markiert:
     InDesign        Methode "everyItem" (nicht "[]" — das entfaellt in UXP)
     Illustrator/PS  Dreiklang der Properties length + parent + typename
     Rest            Beschreibung nennt sich selbst "collection"
   Nur "length" reicht nirgends: das haben auch Array, String und Function. */
function derive(data) {
  const byNameMap = new Map(data.classes.map(c => [c.n, c]));
  const has = (c, name) => c.p.some(p => p.n === name);
  const isCollection = c => !c.enum && (
    c.m.some(m => m.n === 'everyItem') ||
    (has(c, 'length') && has(c, 'parent') && has(c, 'typename')) ||
    /^(a )?collection\b/i.test(c.d || '') || / collection\.?$/i.test(c.d || ''));

  /* Elementtyp: InDesign liefert ihn ueber "[]", Illustrator und Photoshop
     ueber "getByName" oder "add". Sonst der Singular, falls es ihn gibt. */
  const elementOf = c => {
    for (const name of ['[]', 'getByName', 'add', 'item']) {
      const m = c.m.find(x => x.n === name);
      if (m && m.r && m.r[0] && byNameMap.has(m.r[0]) && m.r[0] !== c.n) return m.r[0];
    }
    const singular = c.n.replace(/s$/, '');
    return singular !== c.n && byNameMap.has(singular) ? singular : null;
  };

  /* Rueckwaertsindizes fuer "Object of", "Parameter of" und "Return".
     Enumerations tauchen fast nur als Parametertyp auf — ohne paramOf blieben
     ihre Seiten leer (ExportFormat: 0 Properties, 88 Parameter). */
  const objectOf = new Map(), paramOf = new Map(), returnedBy = new Map();
  const push = (map, key, val) => {
    if (!byNameMap.has(key)) return;
    let a = map.get(key); if (!a) map.set(key, a = []); a.push(val);
  };
  for (const c of data.classes) {
    for (const p of c.p) for (const t of p.t) push(objectOf, t, [c.n, p.n, false, null]);
    for (const m of c.m) {
      for (const t of m.r) push(returnedBy, t, [c.n, m.n, true, null]);
      const seen = new Set();
      for (const a of m.a) for (const t of a.t)
        if (!seen.has(t)) { seen.add(t); push(paramOf, t, [c.n, m.n, true, a.n]); }
    }
  }
  return { byName: byNameMap, isCollection, elementOf, objectOf, paramOf, returnedBy };
}

module.exports = { build, derive };
