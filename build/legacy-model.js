/* Liest eine von fixDom.xsl erzeugte temp/fixedDOM-*.xml.

   Wird nur noch von verify-model.js gebraucht, um die Portierung gegen die alte
   Saxon-Strecke zu halten. Sobald die Referenz nicht mehr gebraucht wird, kann
   diese Datei zusammen mit mergeFiles.xslt und fixDom.xsl weg. */
'use strict';

const fs = require('fs');
const { DOMParser } = require('@xmldom/xmldom');

function kids(el, name) {
  const out = [];
  if (!el) return out;
  for (let n = el.firstChild; n; n = n.nextSibling)
    if (n.nodeType === 1 && (!name || n.nodeName === name)) out.push(n);
  return out;
}
const firstKid = (el, name) => kids(el, name)[0];
const attr = (el, a) => (el && el.getAttribute(a)) || '';
const text = el => (el ? el.textContent || '' : '').replace(/[\s   ]+/g, ' ').trim();
const desc = el => text(firstKid(el, 'shortdesc') || firstKid(el, 'description'));

function types(node) {
  if (!node) return [];
  const all = [];
  for (const dt of kids(node, 'datatype'))
    for (const ty of kids(dt, 'type')) { const t = text(ty); if (t) all.push(t); }
  return all.length > 1 ? all.filter(t => t !== 'Varies') : all;
}
const hasArray = node => kids(node, 'datatype').some(dt => kids(dt, 'array').length > 0);

function extras(node, target) {
  let min = null, max = null, unit = false;
  for (const dt of kids(node, 'datatype')) {
    if (min === null) { const m = firstKid(dt, 'min'); if (m && text(m)) min = text(m); }
    if (max === null) { const m = firstKid(dt, 'max'); if (m && text(m)) max = text(m); }
    if (kids(dt, 'is').some(i => text(i) === 'Measurement Unit')) unit = true;
  }
  if (min !== null || max !== null) target.rng = [min || '', max || ''];
  if (unit) target.mu = 1;
}

const isEvent = p => desc(p).startsWith('Dispatched');

function property(p, isStatic) {
  const o = { n: attr(p, 'name'), t: types(p), rw: attr(p, 'rwaccess'), d: desc(p) };
  if (hasArray(p)) o.arr = 1;
  extras(p, o);
  const dt = firstKid(p, 'datatype');
  const v = dt && firstKid(dt, 'value');
  if (v) o.v = text(v);
  if (isStatic) o.st = 1;
  return o;
}

function method(m) {
  const o = { n: attr(m, 'name'), r: types(m) };
  if (hasArray(m)) o.rarr = 1;
  o.d = desc(m);
  const ps = firstKid(m, 'parameters');
  o.a = (ps ? kids(ps, 'parameter') : []).map(a => {
    const p = { n: attr(a, 'name'), t: types(a), d: desc(a) };
    if (hasArray(a)) p.arr = 1;
    extras(a, p);
    if (attr(a, 'optional') === 'true' || p.d.endsWith('(Optional)')) p.o = 1;
    return p;
  });
  return o;
}

const byName = (a, b) => (a.n < b.n ? -1 : a.n > b.n ? 1 : 0);

function classModel(cd, origin) {
  const isEnum = attr(cd, 'enumeration') === 'true';
  const classProps = [], instanceProps = [], methods = [];
  for (const els of kids(cd, 'elements')) {
    const onClass = attr(els, 'type') === 'class';
    for (const p of kids(els, 'property')) (onClass ? classProps : instanceProps).push(p);
    for (const m of kids(els, 'method')) methods.push(m);
  }
  const o = { n: attr(cd, 'name'), d: desc(cd) };
  if (isEnum) o.enum = 1;
  o.g = origin;
  const sup = firstKid(cd, 'superclass');
  if (sup) o.sup = text(sup);
  o.p = (isEnum
    ? classProps.map(p => property(p, false))
    : [...classProps.filter(p => !isEvent(p)).map(p => property(p, true)),
       ...instanceProps.map(p => property(p, false))]).sort(byName);
  o.ev = (isEnum ? [] : classProps.filter(isEvent))
    .map(e => ({ n: attr(e, 'name'), d: desc(e) })).sort(byName);
  o.m = methods.map(method).sort(byName);
  return o;
}

function build(xmlPath) {
  const doc = new DOMParser({ onError: () => {} })
    .parseFromString(fs.readFileSync(xmlPath, 'utf8'), 'text/xml');
  const root = doc.documentElement;
  const ORIGIN = { js: 'js', sui: 'sui', product: 'p' };
  const found = [];
  (function walk(el, origin) {
    for (const c of kids(el)) {
      const here = ORIGIN[c.nodeName] || origin;
      if (c.nodeName === 'classdef') found.push([c, origin]); else walk(c, here);
    }
  })(root, 'p');
  const product = firstKid(root, 'product');
  const dictionary = product && firstKid(product, 'dictionary');
  const map = dictionary && firstKid(dictionary, 'map');
  return {
    version: attr(map, 'title'),
    generated: new Date().toISOString().slice(0, 10),
    classes: found.map(([cd, o]) => classModel(cd, o)).sort(byName)
  };
}

module.exports = { build };
