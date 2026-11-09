/* What's new: Unterschiede zwischen versions[1] und versions[0] eines
   Produkts (products.js), für whatsnew.html und whatsnew.md.

   Beide Seiten laufen durch dasselbe model.build(), deshalb erscheinen
   Änderungen an fixdom.js oder additions.js nie als API-Änderung. Verglichen
   werden nur die Produktklassen; Core JavaScript und ScriptUI kommen aus
   denselben festen Dateien.

   Gefaltet wird, was sonst die Liste füllt:
   - parent-Änderungen, die nur neue Objekte hinzufügen, fallen weg — sie
     stehen als „can hold" beim neuen Objekt (childrenOf aus derive()).
   - Dieselbe Änderung an drei und mehr Objekten wird eine Zeile mit
     Objektliste: Adobe führt geerbte Member flach an jeder Klasse.
   - Beschreibungsänderungen zählen nur, wenn sich am Member sonst nichts
     geändert hat (meist wiederholt der Text nur den neuen Typ).

   breaking heißt: ein bestehendes Skript kann danach scheitern — Entferntes,
   ein Typ, der Werte verliert, readonly statt read/write, ein neuer Pflicht-
   oder verschobener Parameter, ein geänderter Enum-Code. */
'use strict';

const { derive } = require('./model');

const WIDE = 3;
const MINOR_HINT = 'Renamed parameters and reworded descriptions. Calls are positional, ' +
  'so a renamed parameter keeps working.';
const key = ts => (ts || []).slice().sort().join(' | ');
const typeOf = (ts, arr) => (ts || []).join(' | ') + (arr ? '[]' : '');

/* Properties und Events: je Name einer. */
function byKey(list) {
  const m = new Map(), seen = new Map();
  for (const x of list) {
    const n = seen.get(x.n) || 0;
    m.set(n ? x.n + '#' + n : x.n, x);
    seen.set(x.n, n + 1);
  }
  return m;
}

/* Methoden können überladen sein (Illustrator, Photoshop). Paare zuerst nach
   Name plus Parameternamen bilden, den Rest nach Name in Reihenfolge — sonst
   gälte beim Wegfall der ersten Überladung die zweite als verändert. */
function pairMethods(olds, news) {
  const sigOf = m => m.n + '(' + m.a.map(a => a.n).join(',') + ')';
  const pairs = [];
  const restA = olds.slice(), restB = [];
  for (const y of news) {
    const i = restA.findIndex(x => sigOf(x) === sigOf(y));
    if (i >= 0) pairs.push([restA.splice(i, 1)[0], y]); else restB.push(y);
  }
  const added = [];
  for (const y of restB) {
    const i = restA.findIndex(x => x.n === y.n);
    if (i >= 0) pairs.push([restA.splice(i, 1)[0], y]); else added.push(y);
  }
  return { pairs, added, removed: restA };
}

/* Typänderung einordnen. Ein Bereich im Typnamen (Unit(0-144points) →
   Unit(0-1000points)) ist keine neue Typart. */
function typeChange(from, to) {
  const lost = from.filter(t => !to.includes(t)), gained = to.filter(t => !from.includes(t));
  const base = t => t.replace(/\(.*$/, '');
  const range = lost.length && lost.every(t => gained.some(g => base(g) === base(t)));
  return { lost, gained, op: range ? 'range' : 'type', breaking: !range && lost.length > 0 };
}

function diff(oldData, newData) {
  const A = oldData.classes, B = newData.classes;
  const dA = derive(oldData), dB = derive(newData);
  const kind = (c, d) => c.enum ? 'Enumeration' : d.isCollection(c) ? 'Collection' : 'Object';
  const mapA = new Map(A.map(c => [c.n, c]));
  const mapB = new Map(B.map(c => [c.n, c]));
  const changes = [];
  const push = c => changes.push(c);

  const added = B.filter(c => !mapA.has(c.n)).map(c => ({
    n: c.n, kind: kind(c, dB), members: c.p.length + c.ev.length + c.m.length,
    element: dB.isCollection(c) ? dB.elementOf(c) : null
  }));
  const removed = A.filter(c => !mapB.has(c.n)).map(c => ({ n: c.n, kind: kind(c, dA) }));
  const isNew = new Set(added.map(o => o.n));

  for (const b of B) {
    const a = mapA.get(b.n);
    if (!a) continue;
    const cls = b.n;
    if (kind(a, dA) !== kind(b, dB))
      push({ cls, kind: 'object', op: 'kind', from: kind(a, dA), to: kind(b, dB), breaking: true });
    if ((a.sup || '') !== (b.sup || ''))
      push({ cls, kind: 'object', op: 'superclass', from: a.sup || '', to: b.sup || '' });

    const K = b.enum ? 'value' : 'property';
    const pa = byKey(a.p), pb = byKey(b.p);
    for (const [k, y] of pb) if (!pa.has(k)) push({ cls, kind: K, op: 'added', member: y.n, m: y });
    for (const [k, x] of pa) if (!pb.has(k)) push({ cls, kind: K, op: 'removed', member: x.n, m: x, breaking: true });
    for (const [k, y] of pb) {
      const x = pa.get(k);
      if (!x) continue;
      const before = changes.length;
      let folded = false;
      if (b.enum) {
        if (String(x.v) !== String(y.v))
          push({ cls, kind: K, op: 'code', member: y.n, from: x.v, to: y.v, breaking: true });
      } else {
        if (key(x.t) !== key(y.t)) {
          const tc = typeChange(x.t, y.t);
          /* parent bekommt nur neue Objekte dazu: steht beim neuen Objekt. */
          folded = y.n === 'parent' && !tc.lost.length && tc.gained.every(n => isNew.has(n));
          if (!folded) push({ cls, kind: K, op: tc.op, member: y.n, m: y, from: typeOf(x.t, x.arr),
            to: typeOf(y.t, y.arr), lost: tc.lost, gained: tc.gained, breaking: tc.breaking });
        } else if (!!x.arr !== !!y.arr)
          push({ cls, kind: K, op: 'type', member: y.n, m: y, from: typeOf(x.t, x.arr), to: typeOf(y.t, y.arr), breaking: true });
        if (x.rw !== y.rw)
          push({ cls, kind: K, op: 'access', member: y.n, from: x.rw, to: y.rw, breaking: y.rw === 'readonly' });
        if (String(x.rng || '') !== String(y.rng || ''))
          push({ cls, kind: K, op: 'range', member: y.n, from: x.rng || '', to: y.rng || '' });
        if (!!x.mu !== !!y.mu)
          push({ cls, kind: K, op: 'unit', member: y.n, from: !!x.mu, to: !!y.mu, breaking: !y.mu });
        if (!!x.st !== !!y.st)
          push({ cls, kind: K, op: 'static', member: y.n, from: !!x.st, to: !!y.st, breaking: true });
      }
      if (changes.length === before && !folded && x.d !== y.d)
        push({ cls, kind: K, op: 'desc', member: y.n, from: x.d, to: y.d });
    }

    const ea = byKey(a.ev), eb = byKey(b.ev);
    for (const [k, y] of eb) if (!ea.has(k)) push({ cls, kind: 'event', op: 'added', member: y.n, m: y });
    for (const [k, x] of ea) if (!eb.has(k)) push({ cls, kind: 'event', op: 'removed', member: x.n, m: x, breaking: true });
    const mp = pairMethods(a.m, b.m);
    for (const y of mp.added) push({ cls, kind: 'method', op: 'added', member: y.n, m: y });
    for (const x of mp.removed) push({ cls, kind: 'method', op: 'removed', member: x.n, m: x, breaking: true });
    for (const [x, y] of mp.pairs) {
      const before = changes.length;
      const M = { cls, kind: 'method', member: y.n, m: y };
      if (key(x.r) !== key(y.r) || !!x.rarr !== !!y.rarr) {
        const tc = typeChange(x.r, y.r);
        push(Object.assign({}, M, { op: 'returns', from: typeOf(x.r, x.rarr) || 'void', to: typeOf(y.r, y.rarr) || 'void',
          breaking: tc.breaking || !!x.rarr !== !!y.rarr }));
      }
      if (!!x.st !== !!y.st) push(Object.assign({}, M, { op: 'static', from: !!x.st, to: !!y.st, breaking: true }));

      /* Parameter nach Namen abgleichen; ein neuer Name an der Stelle eines
         verschwundenen mit gleichem Typ ist eine Umbenennung. Aufgerufen wird
         nach Position, eine Umbenennung bricht also nichts. */
      const an = new Map(x.a.map((p, i) => [p.n, i])), bn = new Map(y.a.map((p, i) => [p.n, i]));
      const gone = x.a.filter(p => !bn.has(p.n)), fresh = y.a.filter(p => !an.has(p.n));
      for (const p of fresh.slice()) {
        const q = x.a[y.a.indexOf(p)];
        if (q && gone.includes(q) && key(q.t) === key(p.t)) {
          push(Object.assign({}, M, { op: 'param-renamed', param: p.n, from: q.n, to: p.n }));
          fresh.splice(fresh.indexOf(p), 1);
          gone.splice(gone.indexOf(q), 1);
        }
      }
      /* Ein neuer Parameter vor einem bestehenden verschiebt alle folgenden
         Argumente — auch ein optionaler bricht dann jeden Aufruf. */
      for (const p of fresh) {
        const inserted = y.a.slice(y.a.indexOf(p) + 1).some(q => an.has(q.n));
        push(Object.assign({}, M, { op: 'param-added', param: p.n, to: typeOf(p.t, p.arr), optional: !!p.o,
          inserted, breaking: !p.o || inserted }));
      }
      for (const p of gone)
        push(Object.assign({}, M, { op: 'param-removed', param: p.n, from: typeOf(p.t, p.arr), breaking: true }));
      for (const [n, i] of bn) {
        if (!an.has(n)) continue;
        const j = an.get(n), q = x.a[j], p = y.a[i];
        if (key(q.t) !== key(p.t) || !!q.arr !== !!p.arr) {
          const tc = typeChange(q.t, p.t);
          push(Object.assign({}, M, { op: 'param-type', param: n, from: typeOf(q.t, q.arr), to: typeOf(p.t, p.arr),
            breaking: tc.breaking || !!q.arr !== !!p.arr }));
        }
        if (!!q.o !== !!p.o)
          push(Object.assign({}, M, { op: 'param-optional', param: n, from: !!q.o, to: !!p.o, breaking: !p.o }));
        if (i !== j && fresh.length === 0 && gone.length === 0)
          push(Object.assign({}, M, { op: 'param-moved', param: n, from: j + 1, to: i + 1, breaking: true }));
      }
      if (changes.length === before && x.d !== y.d)
        push(Object.assign({}, M, { op: 'desc', from: x.d, to: y.d }));
    }
  }

  return group({
    from: oldData.version, to: newData.version,
    added, removed, changes,
    holds: n => (dB.childrenOf.get(n) || []).slice()
  });
}

/* Gliederung für Seite und Markdown. */
function group(raw) {
  const { added, removed, changes } = raw;
  const isNew = new Set(added.map(o => o.n));

  /* Eine Collection, die mit ihrem neuen Element kommt, steht in dessen Zeile. */
  const companion = new Map();
  for (const o of added)
    if (o.kind === 'Collection' && o.element && isNew.has(o.element)) companion.set(o.element, o.n);
  const companions = new Set(companion.values());
  const newObjects = added.filter(o => !companions.has(o.n)).map(o => Object.assign({}, o, {
    collection: companion.get(o.n) || null,
    holds: raw.holds(o.n)
  }));

  /* Gleiche Änderung an mehreren Objekten zusammenfassen. */
  const sig = c => [c.kind, c.op, c.member, c.param, JSON.stringify(c.from), JSON.stringify(c.to),
    c.m && c.op === 'added' ? JSON.stringify([c.m.t, c.m.r, c.m.arr, c.m.rw, c.m.v, (c.m.a || []).map(a => [a.n, a.t, a.o])]) : '']
    .join('|');
  const groups = new Map();
  for (const c of changes) {
    const k = sig(c);
    if (!groups.has(k)) groups.set(k, Object.assign({}, c, { objects: [] }));
    groups.get(k).objects.push(c.cls);
  }
  const all = [...groups.values()];
  const minorOp = c => c.op === 'desc' || c.op === 'param-renamed';

  const breaking = all.filter(c => c.breaking);
  const minor = all.filter(c => !c.breaking && minorOp(c));
  const rest = all.filter(c => !c.breaking && !minorOp(c));
  const wide = rest.filter(c => c.objects.length >= WIDE);
  const byObject = new Map();
  for (const c of rest.filter(c => c.objects.length < WIDE))
    for (const cls of c.objects) {
      if (!byObject.has(cls)) byObject.set(cls, []);
      byObject.get(cls).push(c);
    }

  const touched = new Set(changes.filter(c => c.op !== 'desc').map(c => c.cls));
  return {
    from: raw.from, to: raw.to,
    newObjects, removed, breaking, wide, minor,
    byObject: [...byObject].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
    counts: {
      added: added.length,
      removed: removed.length,
      changes: changes.filter(c => c.op !== 'desc').length,
      objects: touched.size,
      breaking: removed.length + breaking.reduce((n, c) => n + c.objects.length, 0)
    },
    empty: !added.length && !removed.length && !changes.length
  };
}

/* Kurzer Text einer Änderung ohne Member- und Objektnamen, für Seite und
   Markdown gleich. Das Hinzugefügte (added) beschreibt die Seite selbst, mit
   verlinkten Typen. */
function phrase(c) {
  const v = x => String(x === '' || x == null ? '—' : x);
  const delta = () => c.lost && c.lost.length + c.gained.length < (c.from.split(' | ').length + c.to.split(' | ').length)
    ? [...c.gained.map(t => '+' + t), ...c.lost.map(t => '−' + t)].join(', ')
    : null;
  switch (c.op) {
    case 'removed': return 'removed';
    case 'type': return 'type ' + (delta() || v(c.from) + ' → ' + v(c.to));
    case 'range': return 'range ' + v(c.from) + ' → ' + v(c.to);
    case 'returns': return 'returns ' + v(c.from) + ' → ' + v(c.to);
    case 'access': return 'now ' + c.to;
    case 'unit': return c.to ? 'now also accepts a measurement string' : 'no longer accepts a measurement string';
    case 'static': return c.to ? 'now static' : 'no longer static';
    case 'code': return 'value ' + v(c.from) + ' → ' + v(c.to);
    case 'kind': return v(c.from) + ' → ' + v(c.to);
    case 'superclass': return 'superclass ' + v(c.from) + ' → ' + v(c.to);
    case 'param-added': return 'new ' + (c.optional ? 'optional' : 'required') + ' parameter ' + c.param + (c.to ? ': ' + c.to : '') +
      (c.inserted ? ', inserted before existing parameters' : '');
    case 'param-removed': return 'parameter ' + c.param + ' removed';
    case 'param-renamed': return 'parameter ' + c.from + ' renamed to ' + c.to;
    case 'param-type': return 'parameter ' + c.param + ' ' + v(c.from) + ' → ' + v(c.to);
    case 'param-optional': return 'parameter ' + c.param + (c.to ? ' now optional' : ' now required');
    case 'param-moved': return 'parameter ' + c.param + ' moved from position ' + c.from + ' to ' + c.to;
    case 'desc': return 'description: “' + c.from + '” → “' + c.to + '”';
    default: return c.op;
  }
}

/* Highlights aus build/highlights.js gegen die Klassen der neuen Version
   auflösen. Jeder ref wird { label, cls, anchor }; was es nicht gibt, landet
   in missing (build.js warnt). */
function resolveHighlights(list, classes) {
  const byName = new Map(classes.map(c => [c.n, c]));
  const missing = [];
  const items = (list || []).map(h => ({
    title: h.title, text: h.text,
    refs: (h.refs || []).map(ref => {
      const [cls, member] = ref.split('.');
      const c = byName.get(cls);
      const kind = !c ? null : !member ? '' : c.p.some(x => x.n === member) ? 'p-'
        : c.ev.some(x => x.n === member) ? 'e-' : c.m.some(x => x.n === member) ? 'm-' : null;
      if (kind === null) { missing.push(ref); return null; }
      return { label: ref + (kind === 'm-' ? '()' : ''), cls, anchor: kind ? kind + member : '' };
    }).filter(Boolean)
  }));
  return { items, missing };
}

/* Sprungziel auf der Objektseite (render.js: p-, e-, m-). */
const anchorOf = c => c.kind === 'object' ? '' :
  (c.kind === 'event' ? 'e-' : c.kind === 'method' ? 'm-' : 'p-') + c.member;

function markdown(w, meta) {
  const { label, from, to } = meta;
  const md = n => n.replace(/^Index$/, 'Index_') + '.md';
  /* Die Markdown-Zwillinge haben keine Sprungziele (p-…, m-…) — Links
     zeigen deshalb nur auf die Datei. */
  const ref = (cls, c) => '[' + cls + (c && c.member ? '.' + c.member + (c.kind === 'method' ? '()' : '') : '') +
    '](' + md(cls) + ')';
  const objs = c => c.objects.length === 1 ? ref(c.objects[0], c)
    : (c.member ? '`' + c.member + '` ' : '') + 'on ' + c.objects.length + ' objects: ' +
      c.objects.map(o => '[' + o + '](' + md(o) + ')').join(', ');
  const addedText = c => c.kind === 'method'
    ? '(' + c.m.a.map(a => a.n + (a.o ? '?' : '') + ': ' + typeOf(a.t, a.arr)).join(', ') + ')' + (c.m.r.length ? ': ' + typeOf(c.m.r, c.m.rarr) : '')
    : c.kind === 'event' ? '' : c.kind === 'value' ? (c.m.v ? ' = ' + c.m.v : '') : ': ' + typeOf(c.m.t, c.m.arr) + (c.m.rw === 'readonly' ? ' (readonly)' : '');
  /* Typ allein, ohne den Doppelpunkt davor; leer bei Events. */
  const typeSpan = c => { const s = addedText(c).replace(/^[\s:=]+/, '').trim(); return s ? '`' + s + '`' : ''; };
  const line = c => c.op === 'added'
    ? '- + ' + c.kind + ' ' + objs(c) + (typeSpan(c) ? (c.objects.length === 1 ? ' ' : ' — ') + typeSpan(c) : '')
    : '- ' + (c.kind === 'object' ? '' : c.kind + ' ') + objs(c) + ': ' + phrase(c);

  const L = [];
  L.push('# What’s new in ' + to.name + (to.build ? ' (' + to.build + ')' : ''));
  L.push('');
  L.push('> ' + label + ' scripting API compared with ' + from.name + (from.build ? ' (' + from.build + ')' : '') + '. ' +
    (w.empty ? 'No changes to the scripting API.' :
      w.counts.added + ' new objects, ' + w.counts.changes + ' changes on ' + w.counts.objects + ' objects, ' +
      w.counts.breaking + ' that can break existing scripts.') +
    ' Generated from Adobe’s object model exports.');
  for (const h of meta.highlights || []) {
    if (h === meta.highlights[0]) { L.push(''); L.push('## Highlights'); }
    L.push('');
    L.push('### ' + h.title);
    L.push('');
    L.push(h.text);
    if (h.refs.length) {
      L.push('');
      L.push(h.refs.map(r => '[' + r.label + '](' + md(r.cls) + ')').join(', '));
    }
  }
  if (w.empty) return L.join('\n') + '\n';
  L.push('');
  L.push('## Breaking');
  L.push('');
  if (!w.removed.length && !w.breaking.length) L.push('Nothing removed or broken.');
  for (const o of w.removed) L.push('- ' + o.kind + ' ' + o.n + ' removed');
  for (const c of w.breaking) L.push(line(c));
  if (w.newObjects.length) {
    L.push('');
    L.push('## New objects');
    L.push('');
    for (const o of w.newObjects)
      L.push('- [' + o.n + '](' + md(o.n) + ') — ' + o.kind + ', ' + o.members + (o.members === 1 ? ' member' : ' members') +
        (o.collection ? '; collection [' + o.collection + '](' + md(o.collection) + ')' : '') +
        (o.holds.length ? '; can hold ' + o.holds.join(', ') : ''));
  }
  if (w.wide.length) {
    L.push('');
    L.push('## On many objects');
    L.push('');
    for (const c of w.wide) L.push(line(c));
  }
  if (w.byObject.length) {
    L.push('');
    L.push('## By object');
    for (const [cls, list] of w.byObject) {
      L.push('');
      L.push('### [' + cls + '](' + md(cls) + ')');
      L.push('');
      for (const c of list) L.push(c.op === 'added'
        ? '- + ' + c.kind + ' `' + c.member + addedText(c) + '`'
        : '- ' + (c.kind === 'object' ? '' : c.kind + ' `' + c.member + '` ') + phrase(c));
    }
  }
  if (w.minor.length) {
    L.push('');
    L.push('## Minor');
    L.push('');
    L.push(MINOR_HINT);
    L.push('');
    for (const c of w.minor) L.push(line(c));
  }
  return L.join('\n') + '\n';
}

module.exports = { diff, markdown, phrase, anchorOf, typeOf, resolveHighlights, MINOR_HINT };
