/* Maschinenlesbare Zwillinge der Website: Markdown je Objekt, api.json je Ziel,
   llms.txt als Wegweiser und eine TypeScript-Deklaration je Produkt.

   Zielgruppe sind KI-Coding-Agenten und Editoren, nicht der Browser. Die
   Aufteilung folgt zwei verschiedenen Momenten:

     .d.ts    beim Schreiben von Code — liegt im Projekt, der Sprachserver
              liefert Typen und Beschreibungen ohne jeden Abruf
     .md      beim Nachschlagen — dieselbe URL wie die Seite, nur ohne Markup
              und Bedienelemente, also ein Bruchteil der Token
     api.json wenn jemand eigenes Werkzeug baut
     llms.txt der Einstieg, der auf all das zeigt

   Alle vier stammen aus demselben Modell wie das HTML; nichts wird aus der
   fertigen Seite zurueckgelesen. */
'use strict';

/* ---------- Typabbildung ExtendScript → TypeScript ----------

   Adobes Typangaben sind teils Prosa. 105 der vorkommenden Namen bezeichnen
   keine Klasse des Modells; die folgenden Regeln bilden sie ab, der Rest wird
   zu "any". buildTypes() zaehlt mit, wie oft das passiert. */

const SCALAR = {
  String: 'string', Strings: 'string[]',
  Number: 'number', Real: 'number', Reals: 'number[]',
  Int: 'number', Int32: 'number', Uint: 'number', Uint32: 'number',
  LongInteger: 'number', LongIntegers: 'number[]',
  LongLongInteger: 'number',
  ShortInteger: 'number', ShortIntegers: 'number[]',
  Unit: 'number', Units: 'number[]',
  Boolean: 'boolean', Booleans: 'boolean[]',
  Varies: 'any', VariesSUI: 'any', Objects: 'any[]', 'Any Types': 'any',
  Undefined: 'undefined',
  JavaScriptFunction: 'Function',
  DateSUI: 'Date',
  /* Punkt und Rechteck gibt Adobe als Zahlenfolge zurueck. */
  Rect: 'number[]', UnitPoint: 'number[]', UnitRect: 'number[]',
  'Property Name/Value Pairs': 'any[]',
  /* Adobes Sammelbegriffe fuer "irgendein Objektverweis". */
  IDBasedObject: 'any', NonIDBasedObject: 'any', UIDBasedObject: 'any',
  RootObject: 'any'
};

/* "3 Reals (0 - 255)", "Unit(0-8640points)", "LongInteger(1-40)" — der Bereich
   steht am Typnamen und interessiert TypeScript nicht. */
const RANGE = /\s*\(([^)]*)\)\s*$/;
/* "Arrays of 2 Reals", "2 Arrays of 2 Reals", "6 Reals" */
const ARRAYS_OF = /^(\d+\s+)?Arrays?\s+of\s+(.+)$/i;
const COUNTED = /^(\d+)\s+(.+)$/;
/* "2 TaskAlertType enumerators", "MatrixContent enumerators" */
const ENUMERATORS = /^(.*?)\s+enumerators?$/i;

function makeTypeMapper(known) {
  let unknown = 0;
  const seen = new Map();
  const dangling = new Set();

  function map(raw, depth) {
    const name = String(raw == null ? '' : raw).trim();
    if (!name) return 'any';
    if (depth > 4) return 'any';

    if (SCALAR[name]) return SCALAR[name];
    if (known.has(name)) return name;
    /* fixDom.xsl benennt die Klasse Index in Index_ um. */
    if (name === 'Index' && known.has('Index_')) return 'Index_';

    let m = ARRAYS_OF.exec(name);
    if (m) return arrayOf(map(m[2], depth + 1));
    m = COUNTED.exec(name);
    if (m) return arrayOf(map(m[2], depth + 1));
    m = ENUMERATORS.exec(name);
    if (m) return map(m[1], depth + 1);
    if (RANGE.test(name)) return map(name.replace(RANGE, ''), depth + 1);
    /* Ein Doppelpunkt im Typnamen ist immer ein Adobe-Datenfehler:
       "Orderedarraycontainingkey:String", "Description:String". */
    if (name.includes(':')) { note(name); return 'any'; }
    /* Sloppy pluralisiert: "NothingEnums", "BoundingBoxLimitss", "Files". */
    if (/s$/.test(name)) {
      const one = name.replace(/s$/, '');
      if (SCALAR[one]) return arrayOf(SCALAR[one]);
      if (known.has(one)) return arrayOf(one);
    }
    /* Ein sauberer Bezeichner, den Adobe benutzt aber nirgends definiert
       (ElementPlacement, MatrixContent …). Der Name bleibt stehen und bekommt
       am Kopf der Datei ein Alias auf any — das ist ehrlicher als ein nacktes
       any und laesst erkennen, was Adobe gemeint hat. */
    if (IDENT.test(name) && !TS_BUILTIN.has(name)) { dangling.add(name); return name; }
    note(name);
    return 'any';
  }

  function arrayOf(t) { return /[|\s]/.test(t) ? '(' + t + ')[]' : t + '[]'; }
  function note(n) { unknown++; seen.set(n, (seen.get(n) || 0) + 1); }

  return {
    /* t: Liste der Typnamen, arr: Type[]-Notation, mu: auch als String erlaubt */
    of(t, arr, mu) {
      const list = (t && t.length ? t : ['Varies']).map(x => map(x, 0));
      if (mu && !list.includes('string')) list.push('string');
      const uniq = [...new Set(list)];
      const one = uniq.length === 1 ? uniq[0] : uniq.join(' | ');
      return arr ? arrayOf(one) : one;
    },
    /* Namen, fuer die buildTypes ein "type X = any" ausgeben muss. */
    dangling: () => [...dangling].sort(),
    stats: () => ({ unknown, top: [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5) })
  };
}

/* ---------- TypeScript-Deklaration ---------- */

/* Diese Namen deklariert TypeScript selbst; eine zweite Deklaration waere ein
   Fehler. Sie stehen ausschliesslich in der Kern-JavaScript-Bibliothek. */
const TS_BUILTIN = new Set(['String', 'Number', 'Boolean', 'Object', 'Array',
  'Function', 'Date', 'RegExp', 'Error', 'Math', 'JSON']);

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const member = n => IDENT.test(n) ? n : JSON.stringify(n);

/* Als Membername sind reservierte Woerter erlaubt, als Parametername nicht.
   Adobe benutzt sie: findKeyStrings(for), prompt(default), rotate(with).
   In einer Deklarationsdatei ist der Parametername reine Dokumentation, ein
   angehaengter Unterstrich also folgenlos — und besser als eine Datei, die
   sich nicht uebersetzen laesst. */
const RESERVED = new Set(('break case catch class const continue debugger default ' +
  'delete do else enum export extends false finally for function if import in ' +
  'instanceof new null return super switch this throw true try typeof var void ' +
  'while with implements interface let package private protected public static yield')
  .split(' '));
const argName = n => RESERVED.has(n) ? n + '_' : n;

/* Beschreibungen als JSDoc — genau dafuer ist die Datei da: der Sprachserver
   zeigt sie beim Tippen an, ohne dass jemand etwas nachschlagen muss. */
function jsdoc(text, extra, indent) {
  const body = String(text || '').replace(/\s+/g, ' ').trim();
  const lines = [];
  if (body) lines.push(...wrap(body, 76));
  for (const e of (extra || [])) if (e) lines.push(e);
  if (!lines.length) return '';
  const pad = ' '.repeat(indent);
  return pad + '/**\n' + lines.map(l => pad + ' * ' + l).join('\n') + '\n' + pad + ' */\n';
}

function wrap(text, width) {
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > width) { out.push(line); line = word; }
    else line = line ? line + ' ' + word : word;
  }
  if (line) out.push(line);
  /* Ein Sternchen-Schraegstrich im Fliesstext wuerde den JSDoc-Block vorzeitig
     schliessen und alles danach zu Code machen. */
  return out.map(l => l.split('*/').join('*\\/'));
}

function rangeNote(x) {
  if (!x.rng) return '';
  const [mn, mx] = x.rng;
  return '@remarks Range: ' + (mn === '' ? '…' : mn) + ' to ' + (mx === '' ? '…' : mx);
}
const unitNote = x => x.mu ? '@remarks Measurement unit — also accepts a string such as "12mm".' : '';

function buildTypes(classes, T, meta) {
  /* Erst die Klassenruempfe bauen: dabei stoesst T.of() auf weitere Typnamen,
     die Adobe nie definiert. Kopf und Aliase entstehen danach — sonst fehlte
     das Alias fuer alles, was erst hier zum ersten Mal auftaucht. */
  const body = classBodies(classes, T);

  const out = [];
  out.push('// ' + meta.title);
  out.push('// Generated from Adobe’s object model export on ' + meta.generated + '.');
  out.push('// ' + meta.home);
  out.push('//');
  out.push('// Self-contained: includes the Core JavaScript and ScriptUI classes,');
  out.push('// so no other file is needed. ExtendScript is not a browser — compile');
  out.push('// with "lib": ["es5"] and without "dom", or names such as Event and');
  out.push('// Document will clash with the DOM definitions.');
  out.push('//');
  out.push('// The descriptive texts are Adobe’s. Where Adobe’s own type information');
  out.push('// is unusable, the type is "any" — see the project README.');
  out.push('//');
  out.push('// Parameters whose Adobe name is a reserved word carry a trailing');
  out.push('// underscore: findKeyStrings(for_), prompt(…, default_, …).');
  out.push('');

  const declared = new Set(classes.map(c => c.n));
  const dangling = T.dangling().filter(n => !declared.has(n));
  if (dangling.length) {
    out.push('// Adobe references these type names without ever defining them.');
    out.push('// The name is kept so the intent stays readable; the type is not known.');
    for (const n of dangling) out.push('type ' + n + ' = any;');
    out.push('');
  }
  return out.join('\n') + body;
}

function classBodies(classes, T) {
  const out = [];
  for (const c of classes) {
    if (TS_BUILTIN.has(c.n)) continue;      /* TypeScript deklariert die selbst */

    if (c.enum) {
      out.push(jsdoc(c.d, [], 0) + 'declare enum ' + c.n + ' {');
      for (const p of c.p)
        out.push(jsdoc(p.d, [], 2) + '  ' + member(p.n) + ' = ' + p.v + ',');
      out.push('}\n');
      continue;
    }

    const ext = c.sup && !TS_BUILTIN.has(c.sup) ? ' extends ' + c.sup : '';
    out.push(jsdoc(c.d, [], 0) + 'declare class ' + c.n + ext + ' {');

    /* Der Index-Zugriff einer Collection ist in TypeScript keine Methode,
       sondern eine Indexsignatur. Adobes Modell nennt ihn "[]". */
    if (c.element) {
      out.push('  /** Returns the ' + c.element + ' with the specified index or name. */');
      out.push('  [index: number]: ' + c.element + ';');
    }

    for (const p of c.p) {
      const mods = (p.st ? 'static ' : '') + (p.rw === 'readonly' ? 'readonly ' : '');
      out.push(jsdoc(p.d, [rangeNote(p), unitNote(p)], 2) +
        '  ' + mods + member(p.n) + ': ' + T.of(p.t, p.arr, p.mu) + ';');
    }
    /* Events sind Zeichenkettenkonstanten auf Klassenebene. */
    for (const e of c.ev)
      out.push(jsdoc(e.d, [], 2) + '  static readonly ' + member(e.n) + ': string;');

    for (const m of c.m) {
      if (m.n === '[]') continue;           /* siehe Indexsignatur oben */
      const args = m.a.map(a => {
        /* Math.max/min fuehren ihre Parameter als "value1, value2, ..." — das
           ist ein Restparameter, kein Bezeichner. */
        if (!IDENT.test(a.n)) return '...values: ' + T.of(a.t, true, a.mu);
        return argName(a.n) + (a.o ? '?' : '') + ': ' + T.of(a.t, a.arr, a.mu);
      });
      const doc = m.a.map(a => '@param ' + (IDENT.test(a.n) ? argName(a.n) : 'values') + ' ' +
        String(a.d || '').replace(/\s+/g, ' ').trim());
      out.push(jsdoc(m.d, doc, 2) +
        '  ' + member(m.n) + '(' + args.join(', ') + '): ' +
        (m.r && m.r.length ? T.of(m.r, m.rarr) : 'void') + ';');
    }
    out.push('}\n');
  }
  return '\n' + out.join('\n');
}

/* ---------- Markdown je Objekt ---------- */

const mdEsc = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

function markdown(c, ctx) {
  const { kind, element, T, target, version } = ctx;
  const L = [];
  L.push('# ' + c.n);
  L.push('');
  L.push('> ' + kind + (element ? ' of ' + element : '') + ' · ' + target.label + ' · ' + version);
  L.push('');
  if (c.d) L.push(mdEsc(c.d), '');
  if (c.sup) L.push('Extends: `' + c.sup + '`', '');

  const sig = x => T.of(x.t, x.arr, x.mu);

  if (c.p.length) {
    L.push('## ' + (c.enum ? 'Values' : 'Properties'), '');
    L.push('| Name | Type | Access | Description |');
    L.push('| --- | --- | --- | --- |');
    for (const p of c.p)
      L.push('| `' + (p.st || c.enum ? c.n + '.' : '') + p.n + '` | `' + sig(p) + '`' +
        (p.v ? ' = `' + mdEsc(p.v) + '`' : '') + ' | ' + p.rw + ' | ' + mdEsc(p.d) + ' |');
    L.push('');
  }
  if (c.ev.length) {
    L.push('## Events', '');
    L.push('| Name | Description |');
    L.push('| --- | --- |');
    for (const e of c.ev) L.push('| `' + c.n + '.' + e.n + '` | ' + mdEsc(e.d) + ' |');
    L.push('');
  }
  if (c.m.length) {
    L.push('## Methods', '');
    for (const m of c.m) {
      const args = m.a.map(a => a.n + (a.o ? '?' : '') + ': ' + sig(a)).join(', ');
      L.push('### `' + m.n + '(' + args + ')` → `' +
        (m.r && m.r.length ? T.of(m.r, m.rarr) : 'void') + '`');
      L.push('');
      if (m.d) L.push(mdEsc(m.d), '');
      if (m.a.length) {
        L.push('| Parameter | Type | Description |');
        L.push('| --- | --- | --- |');
        for (const a of m.a)
          L.push('| `' + a.n + (a.o ? '?' : '') + '` | `' + sig(a) + '` | ' + mdEsc(a.d) + ' |');
        L.push('');
      }
    }
  }
  L.push('---', '');
  L.push('Source: Adobe’s own object model export. Descriptive texts are Adobe’s.');
  return L.join('\n') + '\n';
}

/* ---------- api.json ---------- */

/* Ausgeschriebene Feldnamen statt der internen Kuerzel: die Datei ist fuer
   Fremde gedacht, die das Modell nicht kennen. */
function apiJson(target, classes, ctx) {
  const { kindOf, elementOf, T, version, generated } = ctx;
  const mem = x => {
    const o = { name: x.n, type: T.of(x.t, x.arr, x.mu), description: x.d || '' };
    if (x.rw) o.access = x.rw;
    if (x.st) o.static = true;
    if (x.v !== undefined) o.value = x.v;
    if (x.rng) o.range = { min: x.rng[0], max: x.rng[1] };
    if (x.mu) o.measurementUnit = true;
    if (x.o) o.optional = true;
    return o;
  };
  return JSON.stringify({
    product: target.label,
    slug: target.slug,
    version, generated,
    counts: {
      objects: classes.length,
      properties: classes.reduce((n, c) => n + c.p.length, 0),
      events: classes.reduce((n, c) => n + c.ev.length, 0),
      methods: classes.reduce((n, c) => n + c.m.length, 0)
    },
    objects: classes.map(c => {
      const o = { name: c.n, kind: kindOf(c), description: c.d || '' };
      if (c.sup) o.extends = c.sup;
      const el = elementOf(c);
      if (el) o.elementType = el;
      o.properties = c.p.map(mem);
      o.events = c.ev.map(e => ({ name: e.n, description: e.d || '' }));
      o.methods = c.m.map(m => ({
        name: m.n,
        returns: m.r && m.r.length ? T.of(m.r, m.rarr) : 'void',
        description: m.d || '',
        parameters: m.a.map(mem)
      }));
      return o;
    })
  }, null, 1);
}

/* ---------- llms.txt ----------

   Eine Konvention, kein Standard: nichts findet die Datei von allein. Ihr Wert
   liegt darin, dass man sagen kann „richte deinen Agenten auf diese URL".
   Deshalb steht hier nicht der Inhalt, sondern der Weg dorthin, samt Groessen —
   das vollstaendige Modell passt in kein Kontextfenster. */

const BASE = 'https://www.indesignjs.de/extendscriptAPI/';

function llmsProduct(t, classes, kindOf) {
  const n = k => classes.filter(c => kindOf(c) === k).length;
  const L = [];
  L.push('# ' + t.label + ' — Adobe ExtendScript API');
  L.push('');
  L.push('> ' + t.data.version + ', generated ' + t.data.generated + '. ' +
    classes.length + ' entries: ' + n('Object') + ' objects, ' +
    n('Collection') + ' collections, ' + n('Enumeration') + ' enumerations.');
  L.push('');
  L.push('Every object has a page and a Markdown twin at the same path:');
  L.push('`' + BASE + t.slug + '/<Object>.md` — for example ' +
    '[' + classes[0].n + '](' + BASE + t.slug + '/' + encodeURIComponent(classes[0].n) + '.md).');
  L.push('Fetch the Markdown, not the HTML: same content, a fraction of the tokens.');
  L.push('');
  L.push('## Files');
  L.push('');
  L.push('- [' + t.slug + '.d.ts](' + BASE + t.slug + '/' + t.slug + '.d.ts): TypeScript ' +
    'declarations, self-contained. Drop it into a project and the language server ' +
    'answers without any lookup. Compile with `"lib": ["es5"]` and without `dom`.');
  L.push('- [api.json](' + BASE + t.slug + '/api.json): the whole model as JSON. ' +
    'Large — page through it, do not paste it.');
  L.push('- [index.html](' + BASE + t.slug + '/index.html): every object, linked.');
  L.push('');
  L.push('## Objects');
  L.push('');
  for (const c of classes)
    L.push('- [' + c.n + '](' + BASE + t.slug + '/' + encodeURIComponent(c.n) + '.md): ' +
      kindOf(c) + '. ' + String(c.d || '').replace(/\s+/g, ' ').trim());
  return L.join('\n') + '\n';
}

function llmsRoot(targets, generated) {
  const L = [];
  L.push('# Adobe ExtendScript API');
  L.push('');
  L.push('> Reference for the Adobe ExtendScript object models, generated from ' +
    'Adobe’s own OMV exports on ' + generated + '. ScriptUI and the core ' +
    'JavaScript classes are shared by every application and documented once.');
  L.push('');
  L.push('Each target below has its own `llms.txt` with the full object list, a ' +
    'self-contained `.d.ts`, an `api.json`, and one Markdown file per object at ' +
    '`<target>/<Object>.md`.');
  L.push('');
  L.push('## Applications');
  L.push('');
  for (const t of targets.filter(x => x.kind === 'Product'))
    L.push('- [' + t.label + '](' + BASE + t.slug + '/llms.txt): ' +
      t.data.classes.length + ' entries, ' + t.data.version +
      (t.note ? '. ' + t.note : '.'));
  L.push('');
  L.push('## Shared libraries');
  L.push('');
  for (const t of targets.filter(x => x.kind !== 'Product'))
    L.push('- [' + t.label + '](' + BASE + t.slug + '/llms.txt): ' +
      t.data.classes.length + ' entries. ExtendScript only — UXP uses a different engine.');
  L.push('');
  L.push('## Notes');
  L.push('');
  L.push('- The descriptive texts are Adobe’s; transformation errors are ours.');
  L.push('- A handful of Adobe’s own type entries are unusable prose. Those types ' +
    'are `any` in the declarations rather than invented.');
  L.push('- Methods named `[]` are the collection index accessor. They do not ' +
    'exist in UXP; in the declarations they are an index signature.');
  return L.join('\n') + '\n';
}

module.exports = {
  makeTypeMapper, buildTypes, markdown, apiJson, llmsProduct, llmsRoot, TS_BUILTIN
};
