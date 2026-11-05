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

const { BASE, pageOf } = require('./render');
const examples = require('./examples');
const mdOf = name => pageOf(name).replace(/\.html$/, '.md');

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
  /* TypeScripts Array ist generisch und braucht ein Typargument; Adobe meint
     an dieser Stelle eine Liste beliebigen Inhalts. */
  Array: 'any[]',
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

/* known: Klassennamen, die die Datei deklariert.
   toAny: Namen, die sie bewusst nicht deklariert, obwohl es sie im Modell gibt
   (die kombinierte Datei laesst neun Produktklassen fuer ScriptUI weichen).
   Ohne diesen Weg zeigte der Verweis auf die gleichnamige ScriptUI-Klasse —
   still und falsch. */
function makeTypeMapper(known, toAny) {
  let unknown = 0;
  const seen = new Map();
  const dangling = new Set();

  function map(raw, depth) {
    const name = String(raw == null ? '' : raw).trim();
    if (!name) return 'any';
    if (depth > 4) return 'any';

    if (toAny && toAny.has(name)) return 'any';
    if (SCALAR[name]) return SCALAR[name];
    /* Object, Function, Date … deklariert TypeScript selbst. Sie stehen in
       keiner Datei und muessen trotzdem gelten, sonst wuerde aus dem
       Rueckgabetyp von ScriptUIs add() ein any, ohne dass es jemand merkt. */
    if (TS_BUILTIN.has(name)) return name;
    if (known.has(name)) return name;

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
  let quiet = false;
  function note(n) {
    if (quiet) return;
    unknown++;
    seen.set(n, (seen.get(n) || 0) + 1);
  }

  return {
    /* Wie of(), aber ohne die Statistik zu beruehren: der Vergleich mit der
       Oberklasse fragt Typen ab, die an ihrer eigenen Klasse schon gezaehlt
       worden sind. */
    peek(t, arr, mu) {
      quiet = true;
      try { return this.of(t, arr, mu); } finally { quiet = false; }
    },
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

/* Globale Namen, die lib.es5 schon deklariert. ExtendScript hat sie ebenfalls,
   aber Adobes Signaturen weichen ab — doppelt deklariert gaebe das entweder
   einen Fehler oder eine irrefuehrende zweite Ueberladung. */
const ES5_GLOBALS = new Set(['Infinity', 'NaN', 'undefined', 'eval', 'parseInt',
  'parseFloat', 'isNaN', 'isFinite', 'decodeURI', 'decodeURIComponent',
  'encodeURI', 'encodeURIComponent', 'escape', 'unescape']);

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
  /* Der Kopf muss beschreiben, was wirklich in der Datei steht — sonst sucht
     jemand ScriptUI in einer Produktdatei, in der es nicht mehr ist. */
  const von = new Set(classes.map(c => c.g));
  if (meta.yielded) {
    out.push('// Object model, Core JavaScript, the global names AND ScriptUI in one');
    out.push('// file — for scripts that put up a dialog.');
    out.push('//');
    for (const l of wrap(meta.yielded.length + ' product classes give way to the ' +
      'ScriptUI classes of the same name: ' + meta.yielded.join(', ') + '.', 70))
      out.push('// ' + l);
    out.push('// TypeScript holds one meaning per global name, and a dialog needs');
    out.push('// new Window(…). References to them read "any" — no help, but nothing');
    out.push('// false either. Where those classes matter more than a dialog, take');
    out.push('// the plain product file instead.');
  } else if (von.has('p')) {
    out.push('// Self-contained: includes the Core JavaScript classes and the global');
    out.push('// names (app, alert, …), so no other file is needed.');
    out.push('//');
    out.push('// ScriptUI is not in here. Nine of its classes carry the names of');
    out.push('// product classes — Window, Button, Event, Events, Group, ListBox,');
    out.push('// Panel, RadioButton, StaticText — and TypeScript cannot hold both');
    out.push('// under one global name. Dialog code therefore uses scriptui.d.ts');
    out.push('// instead of this file.');
  } else if (von.has('sui')) {
    out.push('// The ScriptUI classes under the names the code uses: new Window(…),');
    out.push('// new Button(…). The website appends SUI to tell them apart from the');
    out.push('// product classes of the same name; a declaration file has no such');
    out.push('// room, so the suffix is gone here.');
    out.push('//');
    out.push('// Use it INSTEAD OF a product file, not next to one: nine names exist');
    out.push('// in both (Window, Button, Event, Events, Group, ListBox, Panel,');
    out.push('// RadioButton, StaticText) and TypeScript takes only one meaning per');
    out.push('// global name.');
  } else {
    out.push('// The Core JavaScript classes of ExtendScript and its global names');
    out.push('// (app, alert, …). Every product file already contains them.');
  }
  out.push('//');
  out.push('// ExtendScript is not a browser. With the DOM library loaded, Document,');
  out.push('// Event, Text and Window resolve to the browser versions and everything');
  out.push('// below becomes invisible — doc.pages would be unknown, doc.createElement');
  out.push('// would not. Put this next to your scripts as jsconfig.json:');
  out.push('//');
  out.push('//   {');
  out.push('//     "compilerOptions": { "lib": ["es5"], "types": [], "checkJs": false },');
  out.push('//     "include": ["**/*.js", "**/*.d.ts"]');
  out.push('//   }');
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

  /* Signatur und @param-Zeilen einer Methode — fuer Klassenmethoden wie fuer
     die globalen Funktionen gleich. */
  const sig = m => {
    /* Hinter einem optionalen Parameter darf kein Pflichtparameter stehen
       (TS1016). Adobe markiert das uneinheitlich: alert(message, title?,
       errorIcon) — also gilt ab dem ersten optionalen alles Weitere als
       optional. Sonst liesse sich die Datei nicht uebersetzen und alert("x")
       waere ein Aufruf mit zu wenigen Argumenten. */
    let opt = false;
    return {
      args: m.a.map(a => {
        /* Math.max/min fuehren ihre Parameter als "value1, value2, ..." — das
           ist ein Restparameter, kein Bezeichner. */
        if (!IDENT.test(a.n)) return '...values: ' + T.of(a.t, true, a.mu);
        opt = opt || !!a.o;
        return argName(a.n) + (opt ? '?' : '') + ': ' + T.of(a.t, a.arr, a.mu);
      }),
      doc: m.a.map(a => '@param ' + (IDENT.test(a.n) ? argName(a.n) : 'values') + ' ' +
        String(a.d || '').replace(/\s+/g, ' ').trim())
    };
  };

  /* Ueberschriebene Member gegen die Oberklassenkette pruefen. */
  const by = new Map(classes.map(c => [c.n, c]));
  const inherited = (c, key, name) => {
    for (let s = c.sup; s && by.has(s); s = by.get(s).sup) {
      const hit = (by.get(s)[key] || []).find(x => x.n === name);
      if (hit) return hit;
    }
    return null;
  };

  /* TypeScript verlangt, dass der Typ eines ueberschriebenen Members zum Typ
     der Oberklasse passt (TS2416). Adobe weitet in den FindChange*-Klassen
     jede Property um NothingEnum aus — eine Weitung, keine Verengung. Der Typ
     bleibt stehen wie er ist, unterdrueckt wird nur die Pruefung: sonst zeigt
     jedes Projekt, das die Datei einbindet, Fehler darin an. Der Kommentar
     muss unmittelbar ueber der Zeile stehen, das JSDoc darueber bleibt
     trotzdem am Member haengen. */
  const ignore = sup => '  // @ts-ignore Adobe widens the type inherited from ' + sup + '.\n';
  const widens = (mine, base) => {
    if (!base || mine === base || mine === 'any' || base === 'any') return false;
    const parts = new Set(base.split(' | '));
    return !mine.split(' | ').every(x => parts.has(x));
  };

  /* Weitet eine Klasse einen Property-Typ, passt sie strukturell nicht mehr zu
     ihrer Oberklasse — dann stoert auch jede Methode, die die Klasse selbst
     zurueckgibt (getElements, duplicate). Weitet sie nichts, ist so ein
     Rueckgabetyp von sich aus vertraeglich und braucht keine Unterdrueckung. */
  const propWidens = new Map();
  for (const c of classes) {
    if (c.enum || !c.sup) continue;
    propWidens.set(c.n, c.p.some(p => {
      const base = inherited(c, 'p', p.n);
      return base && widens(T.peek(p.t, p.arr, p.mu), T.peek(base.t, base.arr, base.mu));
    }));
  }
  const bare = s => String(s).replace(/\[\]$/, '');
  const selfReturn = (c, ret, baseRet) => bare(ret) === c.n && by.has(bare(baseRet)) &&
    ret.endsWith('[]') === baseRet.endsWith('[]');

  for (const c of classes) {
    if (TS_BUILTIN.has(c.n)) continue;      /* TypeScript deklariert die selbst */

    /* Adobes Modell fasst die globalen Namen zu einer Klasse "global"
       zusammen. In TypeScript muessen es einzelne Deklarationen sein — sonst
       kennt der Sprachserver "app" beim Tippen nicht. Was lib.es5 selbst
       mitbringt, bleibt weg: eine zweite Deklaration mit abweichender
       Signatur ist ein Fehler. */
    if (c.n === 'global') {
      for (const p of c.p) {
        if (ES5_GLOBALS.has(p.n)) continue;
        out.push(jsdoc(p.d, [rangeNote(p), unitNote(p)], 0) + 'declare ' +
          (p.rw === 'readonly' ? 'const ' : 'var ') + p.n + ': ' +
          T.of(p.t, p.arr, p.mu) + ';');
      }
      for (const m of c.m) {
        if (ES5_GLOBALS.has(m.n)) continue;
        const s = sig(m);
        out.push(jsdoc(m.d, s.doc, 0) + 'declare function ' + m.n + '(' +
          s.args.join(', ') + '): ' + (m.r && m.r.length ? T.of(m.r, m.rarr) : 'void') + ';');
      }
      out.push('');
      continue;
    }

    if (c.enum) {
      out.push(jsdoc(c.d, [], 0) + 'declare enum ' + c.n + ' {');
      for (const p of c.p)
        out.push(jsdoc(p.d, [], 2) + '  ' + member(p.n) + ' = ' + p.v + ',');
      out.push('}\n');
      continue;
    }

    /* Erweitert wird nur, was in dieser Datei auch eine Klasse ist. Photoshop
       laesst Klassen von der Enumeration SaveOptions erben — in TypeScript
       kein Konstruktor und damit ein Fehler (TS2507); und die kombinierte
       Datei laesst neun Produktklassen ganz weg. */
    const erbt = c.sup && !TS_BUILTIN.has(c.sup) && by.has(c.sup) && !by.get(c.sup).enum;
    const ext = erbt ? ' extends ' + c.sup : '';
    out.push(jsdoc(c.d, [], 0) + 'declare class ' + c.n + ext + ' {');

    /* Der Index-Zugriff einer Collection ist in TypeScript keine Methode,
       sondern eine Indexsignatur. Adobes Modell nennt ihn "[]". */
    if (c.element) {
      out.push('  /** Returns the ' + c.element + ' with the specified index or name. */');
      out.push('  [index: number]: ' + c.element + ';');
    }

    for (const p of c.p) {
      const mods = (p.st ? 'static ' : '') + (p.rw === 'readonly' ? 'readonly ' : '');
      let t = T.of(p.t, p.arr, p.mu);

      /* Ein readonly Object ist in TypeScript unbrauchbar: auf Object ist jeder
         Zugriff ein Fehler, und gelesen wird so eine Property immer —
         evt.target.name, ScriptUI.FontStyle.BOLD. any heisst hier "nicht naeher
         bestimmt" statt "damit kann man nichts machen". Betrifft 23 Member.
         Die 435 .properties-Buendel von InDesign bleiben Object: die werden
         geschrieben, und dort weist der Typ ein Objektliteral nach. */
      if (t === 'Object' && p.rw === 'readonly') t = 'any';
      const base = inherited(c, 'p', p.n);
      out.push(jsdoc(p.d, [rangeNote(p), unitNote(p)], 2) +
        (base && widens(t, T.peek(base.t, base.arr, base.mu)) ? ignore(c.sup) : '') +
        '  ' + mods + member(p.n) + ': ' + t + ';');
    }
    /* Events sind Zeichenkettenkonstanten auf Klassenebene. */
    for (const e of c.ev)
      out.push(jsdoc(e.d, [], 2) + '  static readonly ' + member(e.n) + ': string;');

    for (const m of c.m) {
      if (m.n === '[]') continue;           /* siehe Indexsignatur oben */
      const s = sig(m);

      /* Den Konstruktor beschreibt Adobe als Methode mit dem Klassennamen:
         File(path), Folder(path), XML(text). In TypeScript muss daraus ein
         constructor werden, sonst laesst sich new File("…") nicht pruefen. */
      if (m.n === c.n) {
        out.push(jsdoc(m.d, s.doc, 2) + '  constructor(' + s.args.join(', ') + ');');
        continue;
      }

      /* everyItem() gibt kein Array zurueck, sondern einen Sammelverweis: auf
         ihm setzt man eine Property fuer alle Elemente auf einmal, und
         getElements() holt daraus die echte Liste. Adobes Modell schreibt
         Page[] — damit scheitert genau der uebliche Gebrauch
         (pages.everyItem().appliedMaster = m). Der Elementtyp trifft beides. */
      let ret = m.r && m.r.length
        ? T.of(m.r, m.n === 'everyItem' ? 0 : m.rarr) : 'void';

      /* Zwei Stellen, an denen Adobes ScriptUI-Angabe jeden Dialog blockiert:
         add() gibt das erzeugte Element zurueck — welches, haengt am ersten
         Argument ("button", "group") —, im Modell steht Object, und auf Object
         ist jeder Zugriff ein Fehler. show() liefert bei einem Dialog das
         Ergebnis, im Modell steht void, und dlg.show() === 1 waere ein Fehler.
         any sagt hier "steht nicht fest" statt etwas Falsches. */
      if (c.g === 'sui' && ((m.n === 'add' && ret === 'Object') ||
        (m.n === 'show' && ret === 'void'))) ret = 'any';
      const base = inherited(c, 'm', m.n);
      const baseRet = base && (base.r && base.r.length ? T.peek(base.r, base.rarr) : 'void');
      const stoert = widens(ret, baseRet) &&
        (propWidens.get(c.n) || !selfReturn(c, ret, baseRet));
      out.push(jsdoc(m.d, s.doc, 2) +
        (stoert ? ignore(c.sup) : '') +
        '  ' + (m.st ? 'static ' : '') +
        member(m.n) + '(' + s.args.join(', ') + '): ' + ret + ';');
    }
    out.push('}\n');

    /* Die ScriptUI-Klassen tragen ein Suffix, damit sie nicht mit gleichnamigen
       Produktklassen kollidieren. Das globale Objekt heisst aber ScriptUI —
       unter diesem Namen wird es angesprochen. Kein Produkt fuehrt eine Klasse
       dieses Namens, der Verweis ist also frei. */
    if (c.n === 'ScriptUISUI' && !by.has('ScriptUI')) {
      out.push('/** The ScriptUI object, the entry point to the user interface classes. */');
      out.push('declare const ScriptUI: typeof ScriptUISUI;\n');
    }
  }
  return '\n' + out.join('\n');
}

/* Fuer die eigenstaendige scriptui.d.ts fallen die SUI-Suffixe weg: im Skript
   heisst die Klasse Window, nicht WindowSUI. Das Suffix trennt sie auf der
   Website von den neun gleichnamigen Produktklassen (Window, Button, Event,
   Events, Group, ListBox, Panel, RadioButton, StaticText) — in einer eigenen
   Datei stehen die nicht daneben. Umgeschrieben wird der Klassenname wie jeder
   Verweis darauf, sonst zeigt die Datei auf Namen, die sie nicht deklariert. */
const bareName = n => String(n).replace(/SUI$/, '');
function withoutSuiSuffix(classes) {
  const list = xs => (xs || []).map(bareName);
  return classes.map(c => Object.assign({}, c, {
    n: bareName(c.n),
    sup: c.sup ? bareName(c.sup) : c.sup,
    element: c.element ? bareName(c.element) : c.element,
    p: c.p.map(p => Object.assign({}, p, { t: list(p.t) })),
    m: c.m.map(m => Object.assign({}, m, {
      r: m.r ? list(m.r) : m.r,
      a: (m.a || []).map(a => Object.assign({}, a, { t: list(a.t) }))
    }))
  }));
}

/* ---------- Laufzeit-Abweichungen ----------
   Was unter UXP anders ist, sagt runtime.js. Markdown und api.json nennen
   beide Fassungen nebeneinander — umschalten wie auf der Seite kann eine
   Datei nicht. */

/* Der Typ unter UXP: ux.hide faellt weg, ux.promise wird Promise<…>. */
function uxpType(T, ts, arr, mu, ux) {
  const list = (ts || []).filter(n => !ux.hide.includes(n))
    .map(n => ux.promise.includes(n) ? 'Promise<' + T.peek([n]) + '>' : T.peek([n]));
  if (mu && !list.includes('string')) list.push('string');
  const one = [...new Set(list)].join(' | ');
  return arr ? (/[|\s]/.test(one) ? '(' + one + ')[]' : one + '[]') : one;
}

const RUNTIME_NAME = { uxp: 'UXP', es: 'ExtendScript' };
const RUNTIME_ID = { uxp: 'uxp', es: 'extendscript' };

/* ---------- Markdown je Objekt ---------- */

const mdEsc = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const mdNotes = ns => ns.map(n => ' **' + (RUNTIME_NAME[n.runtime] || 'Note') + ':** ' +
  mdEsc(n.text)).join('');

function markdown(c, ctx) {
  const { kind, element, T, target, version, rt } = ctx;
  const L = [];
  L.push('# ' + c.n);
  L.push('');
  L.push('> ' + kind + (element ? ' of ' + element : '') + ' · ' + target.label + ' · ' + version);
  L.push('');
  if (c.d) L.push(mdEsc(c.d), '');
  for (const n of rt.notes(c.n, kind)) L.push(mdNotes([n]).trim(), '');
  if (c.sup) L.push('Extends: `' + c.sup + '`', '');

  /* Typ, und wo UXP abweicht, dessen Fassung dahinter. */
  const sig = x => T.of(x.t, x.arr, x.mu);
  const typed = (x, ux) => '`' + sig(x) + '`' +
    (ux ? ' (UXP: `' + uxpType(T, x.t, x.arr, x.mu, ux) + '`)' : '');
  /* In einer Tabellenzelle trennt GFM auch an einem | im Codespan; nur \|
     haelt die Zeile zusammen. Im Methodenkopf stuende es dagegen woertlich. */
  const cell = s => s.replace(/\|/g, '\\|');

  if (c.p.length) {
    L.push('## ' + (c.enum ? 'Values' : 'Properties'), '');
    L.push('| Name | Type | Access | Description |');
    L.push('| --- | --- | --- | --- |');
    for (const p of c.p)
      L.push('| `' + (p.st || c.enum ? c.n + '.' : '') + p.n + '` | ' +
        cell(typed(p, rt.member(c.n, 'p', p))) +
        (p.v ? ' = `' + mdEsc(p.v) + '`' : '') + ' | ' + p.rw + ' | ' + mdEsc(p.d) +
        mdNotes(rt.memberNotes(c.n, p.n)) + ' |');
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
      const ret = { t: m.r, arr: m.rarr };
      L.push('### `' + (m.st ? c.n + '.' : '') + m.n + '(' + args + ')` → ' +
        (m.r && m.r.length ? typed(ret, rt.member(c.n, 'r', m)) : '`void`'));
      L.push('');
      if (rt.member(c.n, 'm', m)) L.push('_ExtendScript only — not available in UXP._', '');
      if (m.d) L.push(mdEsc(m.d) + mdNotes(rt.memberNotes(c.n, m.n)), '');
      if (m.a.length) {
        L.push('| Parameter | Type | Description |');
        L.push('| --- | --- | --- |');
        for (const a of m.a)
          L.push('| `' + a.n + (a.o ? '?' : '') + '` | ' + cell(typed(a, rt.member(c.n, 'a', a, m.n))) +
            ' | ' + mdEsc(a.d) + ' |');
        L.push('');
      }
    }
  }
  L.push('---', '');
  L.push('Source: Adobe’s own object model export. Descriptive texts are Adobe’s.');
  return L.join('\n') + '\n';
}

/* ---------- api.json ---------- */

/* Format von api.json und manifest.json. Erhoeht wird nur bei einer
   Aenderung, die bestehende Leser bricht: ein Feld faellt weg, wird
   umbenannt oder bedeutet etwas anderes. Neue Felder erhoehen nicht.

     1  ohne Angabe: Index hiess "Index_", kein page, static, uxp, runtimes
     2  Index heisst Index, page nennt die Datei; static an Methoden;
        runtimes, uxp und notes */
const FORMAT_VERSION = 2;

/* Ausgeschriebene Feldnamen statt der internen Kuerzel: die Datei ist fuer
   Fremde gedacht, die das Modell nicht kennen. */
function apiJson(target, classes, ctx) {
  const { kindOf, elementOf, T, version, generated, rt } = ctx;
  /* notes: [{ runtime, text }], runtime "uxp", "extendscript" oder null
     fuer beide. */
  const notesOf = ns => ns.map(n => ({ runtime: RUNTIME_ID[n.runtime] || null, text: n.text }));
  /* uxp: nur wo UXP abweicht — { type } bzw. { returns } mit der Fassung
     unter UXP, oder { available: false }. */
  const mem = (x, ux, ns) => {
    const o = { name: x.n, type: T.of(x.t, x.arr, x.mu), description: x.d || '' };
    if (x.rw) o.access = x.rw;
    if (x.st) o.static = true;
    if (x.v !== undefined) o.value = x.v;
    if (x.rng) o.range = { min: x.rng[0], max: x.rng[1] };
    if (x.mu) o.measurementUnit = true;
    if (x.o) o.optional = true;
    if (ux) o.uxp = { type: uxpType(T, x.t, x.arr, x.mu, ux) };
    if (ns && ns.length) o.notes = notesOf(ns);
    return o;
  };
  return JSON.stringify({
    formatVersion: FORMAT_VERSION,
    product: target.label,
    slug: target.slug,
    version, generated,
    /* Welche Laufzeiten dieses Modell beschreibt. Mit "uxp" tragen
       abweichende Member ein Feld uxp. */
    runtimes: rt.on ? ['extendscript', 'uxp'] : ['extendscript'],
    counts: {
      objects: classes.length,
      properties: classes.reduce((n, c) => n + c.p.length, 0),
      events: classes.reduce((n, c) => n + c.ev.length, 0),
      methods: classes.reduce((n, c) => n + c.m.length, 0)
    },
    objects: classes.map(c => {
      /* page: Dateiname relativ zum Ziel. Er folgt nicht immer dem Namen —
         Index liegt als Index_.html neben index.html. */
      const o = { name: c.n, page: pageOf(c.n), kind: kindOf(c), description: c.d || '' };
      const ns = rt.notes(c.n, kindOf(c));
      if (ns.length) o.notes = notesOf(ns);
      if (c.sup) o.extends = c.sup;
      const el = elementOf(c);
      if (el) o.elementType = el;
      o.properties = c.p.map(p => mem(p, rt.member(c.n, 'p', p), rt.memberNotes(c.n, p.n)));
      o.events = c.ev.map(e => ({ name: e.n, description: e.d || '' }));
      o.methods = c.m.map(m => {
        const gone = rt.member(c.n, 'm', m);
        const ret = rt.member(c.n, 'r', m);
        const ns = rt.memberNotes(c.n, m.n);
        return Object.assign(
          { name: m.n, returns: m.r && m.r.length ? T.of(m.r, m.rarr) : 'void' },
          m.st ? { static: true } : {},
          gone ? { uxp: { available: false } }
            : ret ? { uxp: { returns: uxpType(T, m.r, m.rarr, false, ret) } } : {},
          { description: m.d || '' },
          ns.length ? { notes: notesOf(ns) } : {},
          { parameters: m.a.map(a => mem(a, rt.member(c.n, 'a', a, m.n))) });
      });
      return o;
    })
  }, null, 1);
}

/* ---------- uxp.md ----------

   Leitfaden fuer Agenten, die UXP-Code gegen dieses Objektmodell schreiben.
   Die Member-Seiten zeigen Abweichungen dort, wo sie auftreten; hier stehen
   die allgemeinen Regeln einmal, und die betroffenen Member als Liste. Die
   Listen kommen aus runtime.js, die Regeln sind Text. Quellen wie dort. */

const UXP_LINKS = {
  uxp: 'https://developer.adobe.com/uxp/',
  indesign: 'https://developer.adobe.com/indesign/uxp/',
  migration: 'https://developer.adobe.com/indesign/uxp/resources/migration-guides/extendscript/',
  args: 'https://developer.adobe.com/indesign/uxp/scripts/tutorials/arguments/',
  result: 'https://developer.adobe.com/indesign/uxp/scripts/tutorials/script-result/',
  types: 'https://www.npmjs.com/package/indesign-uxp-types'
};

function uxpGuide(t, classes, rt, kindOf) {
  const promised = [], stringOnly = [], gone = [];
  let index = 0;
  const promiseOf = ux => '`' + ux.promise.map(n => 'Promise<' + n + '>').join(' | ') + '`';
  for (const c of classes) {
    for (const p of c.p) {
      const ux = rt.member(c.n, 'p', p);
      if (!ux) continue;
      const row = '`' + c.n + '.' + p.n + '`';
      if (ux.promise.length) promised.push(row + ' → ' + promiseOf(ux));
      else stringOnly.push(row);
    }
    for (const m of c.m) {
      if (rt.member(c.n, 'm', m)) {
        if (m.n === '[]') index++;
        else gone.push('`' + c.n + '.' + m.n + '()`');
        continue;
      }
      const ux = rt.member(c.n, 'r', m);
      if (ux && ux.promise.length) promised.push('`' + c.n + '.' + m.n + '()` returns ' +
        promiseOf(ux));
    }
  }
  const page = n => '[' + n + '](' + BASE + t.slug + '/' + mdOf(n) + ')';

  const L = [];
  L.push('# UXP and ExtendScript — ' + t.label);
  L.push('');
  L.push('> ' + t.data.version + '. How the object model in this reference is used ' +
    'from UXP, and where that differs from ExtendScript.');
  L.push('');
  L.push('InDesign runs scripts in two engines. **ExtendScript** (`.jsx`) is the ' +
    'original one: JavaScript at the level of ES3, with `app` and every enumeration ' +
    'as globals. **UXP** (`.idjs` scripts; UXP plugins since 18.5) ' +
    'is modern JavaScript. Both drive the same object model — the classes, ' +
    'properties and methods documented here. What differs is how you reach it and a ' +
    'handful of rules around it.');
  L.push('');
  L.push('## Reaching the object model');
  L.push('');
  L.push('```js');
  L.push('const { app, PathType } = require("indesign");');
  L.push('');
  L.push('async function main() {');
  L.push('  const doc = app.activeDocument;');
  L.push('  const page = doc.pages.item(0);        // not doc.pages[0]');
  L.push('  const path = page.polygons.item(0).paths.item(0);');
  L.push('  if (path.pathType.equals(PathType.CLOSED_PATH)) {   // not ==');
  L.push('    console.log("closed");');
  L.push('  }');
  L.push('  const file = await doc.fullName;      // a Promise under UXP');
  L.push('  console.log(file.nativePath);');
  L.push('}');
  L.push('main();');
  L.push('```');
  L.push('');
  L.push('## Rules');
  L.push('');
  L.push('| | ExtendScript | UXP |');
  L.push('| --- | --- | --- |');
  L.push('| `app`, enumerations | globals | `require("indesign")` |');
  L.push('| Collection item | `pages[0]` or `pages.item(0)` | `pages.item(0)` only — `[]` does not exist |');
  L.push('| Compare enumerations, DOM objects | `==` | `.equals()` — `==` and `===` do not work |');
  L.push('| Files and folders | ExtendScript `File`, `Folder` | entries from `require("uxp").storage` |');
  L.push('| Reading a file or folder property | the object | a Promise — `await` it |');
  L.push('| Passing a file | `File` | path string or UXP `File` entry |');
  L.push('| Passing a folder | `Folder` | path string only |');
  L.push('| Does a DOM object have a property? | `obj.hasOwnProperty("name")` or ' +
    '`"name" in obj` | `"name" in obj` only — `hasOwnProperty()` and `Object.hasOwn()` ' +
    'are always `false` |');
  L.push('| Script arguments | `app.scriptArgs.getValue("name")`; `arguments` in a script ' +
    'run by `doScript()` | `require("uxp").script.args` — an array of strings; ' +
    '`app.scriptArgs` is `undefined` |');
  L.push('| Script result | the value of the last expression | ' +
    '`script.setResult(value)` — the last expression is ignored |');
  L.push('| Event handler | function or `File` | function only |');
  L.push('| Output | `$.writeln()` | `console.log()` |');
  L.push('| User interface | ScriptUI | HTML |');
  L.push('| Not available | — | `$`, ScriptUI, `XML`/`XMLList` (E4X), `Socket`, `UnitValue`, `Reflection` |');
  L.push('');
  L.push('`app.doScript()` still runs an ExtendScript file from UXP. Its ' +
    '`withArguments` reach an ExtendScript as `arguments` with their types, a UXP ' +
    'script as strings in `script.args` (`true` becomes `"TRUE"`). `doScript()` ' +
    'returns the called script\'s result: the last expression of an ExtendScript, ' +
    'the `script.setResult()` value of a UXP script.');
  L.push('');
  if (t.server) {
    const ex = examples.forTarget(t);
    L.push('## InDesign Server: arguments and result');
    L.push('');
    L.push('A server script runs on behalf of a client, so both ends matter: what the ' +
      'client passes in and what the script hands back. The two engines do both ' +
      'differently.');
    L.push('');
    L.push('- **Arguments.** ExtendScript reads them from `app.scriptArgs`. UXP gets ' +
      'them in `require("uxp").script.args` as an array of `"name=value"` strings; ' +
      '`app.scriptArgs` does not exist there. ' +
      '[Adobe: passing arguments](' + UXP_LINKS.args + ')');
    L.push('- **Result.** ExtendScript returns the value of the last expression to ' +
      'the client. UXP returns only what the script passes to ' +
      '`script.setResult()`. [Adobe: script result](' + UXP_LINKS.result + ')');
    L.push('');
    L.push('```js');
    L.push('// server.jsx');
    L.push(ex.jsx);
    L.push('```');
    L.push('');
    L.push('```js');
    L.push('// server.idjs');
    L.push(ex.idjs);
    L.push('```');
    L.push('');
  }
  L.push('## How this reference marks the differences');
  L.push('');
  L.push('- Markdown: a type that differs carries `(UXP: …)`, for example ' +
    '`File` (UXP: `Promise<File>`). Methods that do not exist under UXP say ' +
    '_ExtendScript only — not available in UXP._ Runtime notes start with **UXP:**.');
  L.push('- [api.json](' + BASE + t.slug + '/api.json): `runtimes` lists both engines. ' +
    'A member that differs has `uxp: { type }`, `uxp: { returns }` or ' +
    '`uxp: { available: false }`; notes are `notes: [{ runtime, text }]`.');
  L.push('- The website has an ExtendScript / UXP switch in the header that shows ' +
    'every page as the chosen engine sees it.');
  L.push('- The `.d.ts` files here describe ExtendScript. For UXP type declarations use ' +
    '[indesign-uxp-types](' + UXP_LINKS.types + ').');
  L.push('');
  L.push('## File and folder values that are Promises under UXP');
  L.push('');
  L.push(promised.length + ' members. Measured at runtime in InDesign 2026 ' +
    '(indesign-uxp-types).');
  L.push('');
  for (const r of promised) L.push('- ' + r);
  L.push('');
  if (stringOnly.length) {
    L.push('## String or File: only the String under UXP');
    L.push('');
    L.push('Adobe types these as `String | File`. Under UXP they return the path as a ' +
      'string.');
    L.push('');
    for (const r of stringOnly) L.push('- ' + r);
    L.push('');
  }
  L.push('## Methods that do not exist under UXP');
  L.push('');
  L.push('- `[]` — the index accessor on ' + index + ' collections. Use `item(index)`.');
  for (const r of gone) L.push('- ' + r);
  L.push('');
  const noted = classes.filter(c => rt.notes(c.n, kindOf(c)).some(n => n.runtime === 'uxp'));
  const memberNoted = [];
  for (const c of classes)
    for (const x of [...c.p, ...c.m])
      for (const n of rt.memberNotes(c.n, x.n))
        if (n.runtime === 'uxp') memberNoted.push('`' + c.n + '.' + x.n + '`: ' + n.text);
  if (memberNoted.length || noted.some(c => !c.enum)) {
    L.push('## Further notes');
    L.push('');
    for (const c of noted.filter(c => !c.enum))
      for (const n of rt.notes(c.n, kindOf(c))) L.push('- ' + page(c.n) + ': ' + n.text);
    for (const r of memberNoted) L.push('- ' + r);
    L.push('');
  }
  L.push('## Adobe’s documentation');
  L.push('');
  L.push('- [UXP](' + UXP_LINKS.uxp + ') — the platform: modules, storage, network, UI');
  L.push('- [InDesign UXP](' + UXP_LINKS.indesign + ') — scripts and plugins in InDesign');
  L.push('- [Migrating from ExtendScript](' + UXP_LINKS.migration + ')');
  L.push('- [Passing arguments](' + UXP_LINKS.args + ') and [script result](' +
    UXP_LINKS.result + ') — `script.args`, `script.setResult()`');
  return L.join('\n') + '\n';
}

/* ---------- llms.txt ----------

   Eine Konvention, kein Standard: nichts findet die Datei von allein. Ihr Wert
   liegt darin, dass man sagen kann „richte deinen Agenten auf diese URL".
   Deshalb steht hier nicht der Inhalt, sondern der Weg dorthin, samt Groessen —
   das vollstaendige Modell passt in kein Kontextfenster. */

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
    '[' + classes[0].n + '](' + BASE + t.slug + '/' + mdOf(classes[0].n) + ').');
  L.push('Fetch the Markdown, not the HTML: same content, a fraction of the tokens.');
  L.push('');
  /* Ein Agent, der UXP-Code schreibt, braucht vor allem zwei Dinge: wo die
     Abweichungen stehen, und dass die .d.ts hier ExtendScript beschreibt. */
  if (t.uxp) {
    L.push('## UXP');
    L.push('');
    L.push('The same object model drives UXP scripts (`.idjs`) and plugins via ' +
      '`require("indesign")`. Where UXP differs, the Markdown adds `(UXP: …)` to the ' +
      'type, marks methods that do not exist there as ExtendScript only, and prefixes ' +
      'runtime notes with **UXP:**. In `api.json` the same shows as a `uxp` field on ' +
      'the member and as `notes`. File and Folder properties return a Promise of a ' +
      '`require("uxp").storage` entry under UXP.');
    L.push('The `.d.ts` files here describe ExtendScript. For UXP use the ' +
      '[indesign-uxp-types](https://www.npmjs.com/package/indesign-uxp-types) package.');
    L.push('Before writing UXP code, read [uxp.md](' + BASE + t.slug + '/uxp.md): ' +
      'the rules that differ from ExtendScript, with every affected member listed.');
    L.push('');
  }
  L.push('## Files');
  L.push('');
  L.push('- [' + t.slug + '.d.ts](' + BASE + t.slug + '/' + t.slug + '.d.ts): TypeScript ' +
    'declarations, self-contained — the classes, the enumerations and the global ' +
    'names (app, alert, $). Drop it into a project and the language server answers ' +
    'without any lookup. It needs a jsconfig.json next to the scripts: ' +
    '`{ "compilerOptions": { "lib": ["es5"], "types": [], "checkJs": false }, ' +
    '"include": ["**/*.js", "**/*.d.ts"] }`. Without it the editor loads the DOM ' +
    'library, and Document, Event, Text and Window resolve to the browser versions. ' +
    (t.kind === 'Product' ? 'ScriptUI is not in this file.' : ''));
  if (t.kind === 'Product')
    L.push('- [' + t.slug + '-scriptui.d.ts](' + BASE + t.slug + '/' + t.slug +
      '-scriptui.d.ts): the same plus ScriptUI, for scripts with a dialog. Nine ' +
      'classes carry a name in both models (Window, Button, Event, Events, Group, ' +
      'ListBox, Panel, RadioButton, StaticText); here they are the ScriptUI ones, ' +
      'and references to the product classes read `any`. Use either this file or ' +
      'the plain one, never both — TypeScript holds one meaning per global name.');
  L.push('- [api.json](' + BASE + t.slug + '/api.json): the whole model as JSON. ' +
    'Large — page through it, do not paste it.' +
    (t.uxp ? ' `runtimes` lists ExtendScript and UXP; members that differ under UXP ' +
      'carry a `uxp` field.' : ''));
  L.push('- [index.html](' + BASE + t.slug + '/index.html): every object, linked.');
  L.push('');
  L.push('## Objects');
  L.push('');
  for (const c of classes)
    L.push('- [' + c.n + '](' + BASE + t.slug + '/' + mdOf(c.n) + '): ' +
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
  L.push('- [manifest.json](' + BASE + 'manifest.json) lists every target with its ' +
    'version and a `contentHash` that changes only when the model does — check it ' +
    'before fetching an `api.json` again.');
  return L.join('\n') + '\n';
}

/* ---------- manifest.json ----------

   Fuer Werkzeuge, die die maschinenlesbaren Dateien zwischenspeichern: was es
   gibt, in welcher Version, und ob sich seit dem letzten Abruf etwas
   geaendert hat.

   Zwei Arten Pruefsumme, weil generated das Baudatum ist und damit jede
   Datei bei jedem Bau anders ausfaellt:
     files[].sha256  die Datei, wie sie auf dem Server liegt — Integritaet
     contentHash     api.json ohne generated — aendert sich nur, wenn sich
                     das Modell oder das Format aendert

   sha256 steht als "sha256:<hex>", damit ein spaeterer Wechsel des
   Verfahrens am Wert erkennbar bleibt. */
const sha256 = s => 'sha256:' + require('crypto').createHash('sha256').update(s).digest('hex');

/* api.json ohne Baudatum, als Grundlage des contentHash. */
const contentHashOf = apiJsonText => {
  const o = JSON.parse(apiJsonText);
  delete o.generated;
  return sha256(JSON.stringify(o));
};

/* files: Map slug → [[Pfad relativ zum Ziel, Inhalt], …] */
function manifest(targets, generated, files) {
  return JSON.stringify({
    formatVersion: FORMAT_VERSION,
    generated,
    base: BASE,
    targets: targets.map(t => {
      const own = files.get(t.slug) || [];
      const api = own.find(([rel]) => rel === 'api.json');
      return {
        slug: t.slug,
        label: t.label,
        kind: t.kind,
        version: t.data.version,
        runtimes: t.uxp ? ['extendscript', 'uxp'] : ['extendscript'],
        objects: t.data.classes.length,
        contentHash: api ? contentHashOf(api[1]) : null,
        files: own.map(([rel, content]) => ({
          path: t.slug + '/' + rel,
          bytes: Buffer.byteLength(content),
          sha256: sha256(content)
        }))
      };
    })
  }, null, 1) + '\n';
}

module.exports = {
  makeTypeMapper, buildTypes, markdown, apiJson, uxpGuide, llmsProduct, llmsRoot, TS_BUILTIN,
  withoutSuiSuffix, manifest, contentHashOf, FORMAT_VERSION
};
