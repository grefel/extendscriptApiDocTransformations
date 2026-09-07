/* Rendert ein Datenmodell zu statischem HTML. Eine Datei je Objekt.

   Grundsatz: Jede Seite ist ohne JavaScript vollstaendig lesbar. Das Skript
   ergaenzt nur Suche, Navigationsliste, Filter und Zwischenablage — es baut
   keine Inhalte auf. Der komplette Inhalt steht im Markup, nur die
   Navigationsliste nicht: 1000+ Eintraege wuerden jede Seite aufblaehen. */
'use strict';

const notes = require('./notes');
const shortcuts = require('./shortcuts');

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Laeuft synchron im <head>, vor dem ersten Zeichnen. site.js hat "defer" und
   ist damit zu spaet: die Folgeseite erschiene kurz im Standard und klappte
   dann um. Ohne gespeicherte Wahl gilt Hell bei Zoom 1,15 — das steht im
   Stylesheet, hier wird dann nichts gesetzt. */
const THEME_BOOT =
  'try{var d=document.documentElement,s=localStorage;' +
  'if(s.getItem("theme")==="dark")d.dataset.t="dark";' +
  'var f=parseFloat(s.getItem("fs"));if(f>0)d.style.setProperty("--fs",f)}catch(e){}';

/* Dateiname je Objekt. Im aktuellen Modell ist "$" das einzige Sonderzeichen und
   in Dateinamen wie in URLs unbedenklich — pauschales encodeURIComponent machte
   daraus nur ein haessliches %24. Alles Uebrige wird sicherheitshalber kodiert.
   Auf Gross-/Kleinschreibung darf man sich nicht verlassen, build.js prueft das. */
const pageOf = name =>
  name.replace(/[^A-Za-z0-9_$.-]/g, ch => '%' + ch.charCodeAt(0).toString(16).toUpperCase())
  + '.html';

/* Der Titel kommt je Produkt in drei Formen:
     "Adobe InDesign 2026 (21.5.1.73) Object Model"
     "Adobe Illustrator 29 Type Library"
     "Adobe Photoshop CC 2015.5 Object Library"
   Daraus einen kurzen Namen und, falls vorhanden, die Buildnummer gewinnen. */
function splitVersion(title) {
  const build = (/\(([\d.]+)\)/.exec(title || '') || [])[1] || null;
  const name = String(title || '')
    .replace(/^Adobe\s+/, '')
    .replace(/\s*\([\d.]+\)\s*/, ' ')
    .replace(/\s+(Object Model|Type Library|Object Library)\s*$/i, '')
    .trim();
  return { name, build };
}

/* Ohne diese Datei laedt der Editor die DOM-Bibliothek mit und Document, Event,
   Text und Window zeigen auf die Browser-Fassung — die Deklarationen des
   Objektmodells sind dann unerreichbar. Steht wortgleich auch im Kopf jeder
   .d.ts (build/agents.js). */
const JSCONFIG = [
  '{',
  '  "compilerOptions": { "lib": ["es5"], "types": [], "checkJs": false },',
  '  "include": ["**/*.js", "**/*.d.ts"]',
  '}'
].join('\n');

/* ctx.resolve(name) -> relativer Pfad oder null. Damit landen Typen wie "File"
   auf der gemeinsamen JavaScript-Bibliothek statt ins Leere zu zeigen. */
function make(data, d, ctx) {
  const { isCollection, elementOf, objectOf, paramOf, returnedBy, subOf,
    parentsOf, childrenOf, prefsOf } = d;
  const { target, targets, resolve } = ctx;
  const kindOf = c => (c.enum ? 'Enumeration' : isCollection(c) ? 'Collection' : 'Object');
  /* File und Folder heissen in UXP genauso, sind aber eine voellig andere API:
     kein globales File-Objekt, sondern require('uxp').storage.localFileSystem.
     Im UXP-Modus zeigt der Link deshalb auf Adobes UXP-Referenz statt auf die
     ExtendScript-Klasse. Umgeschaltet wird in site.js; hier steht nur das
     zweite Ziel im Markup, damit es ohne JavaScript keine falsche Zusage gibt. */
  const UXP_DOCS = {
    File: 'https://developer.adobe.com/indesign/uxp/reference/uxp-api/reference-js/' +
      'modules/uxp/persistent-file-storage/file',
    Folder: 'https://developer.adobe.com/indesign/uxp/reference/uxp-api/reference-js/' +
      'modules/uxp/persistent-file-storage/folder'
  };

  /* Die uebrigen Kern-JavaScript-Klassen zerfallen unter UXP in zwei Gruppen.

     Standard-ECMAScript gibt es dort, nur in einer modernen Fassung — die
     Seiten hier beschreiben ES3 von 2003, also zeigt der Link auf MDN. */
  const MDN = 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/';
  const MDN_CLASSES = new Set(['Array', 'Boolean', 'Date', 'Error', 'Function',
    'Math', 'Number', 'Object', 'RegExp', 'String']);

  /* Der Rest gibt es unter UXP gar nicht: das Debugobjekt, die E4X-Klassen und
     Adobes Eigenbauten. Dorthin fuehrt kein Link, auch kein fremder. */
  const NO_UXP = new Set(['$', 'Namespace', 'QName', 'Reflection', 'ReflectionInfo',
    'Socket', 'UnitValue', 'XML', 'XMLList', 'global']);

  const link = n => {
    const href = resolve(n);
    if (!href) return esc(n);
    /* Nur greifen, wenn der Verweis wirklich in die gemeinsame
       JavaScript-Bibliothek zeigt — ein Produkt darf eine eigene Klasse
       gleichen Namens haben, und die bleibt richtig. */
    const core = target.uxp && href.startsWith('../javascript/');
    let extra = '';
    if (core && UXP_DOCS[n]) extra = ` data-uxp-href="${esc(UXP_DOCS[n])}"`;
    else if (core && MDN_CLASSES.has(n)) extra = ` data-uxp-href="${esc(MDN + n)}"`;
    else if (core && NO_UXP.has(n)) extra = ' data-uxp="off"';
    return `<a href="${esc(href)}"${extra}>${esc(n)}</a>`;
  };
  const known = n => resolve(n) !== null;

  const OR = ' <span class="or">|</span> ';

  /* esOnly: Typen, die an dieser Stelle nur unter ExtendScript gelten. Sie
     werden samt ihrem Trennstrich in einen data-uxp="hide"-Knoten gepackt,
     damit im UXP-Modus kein einsames "|" stehen bleibt. */
  function typeList(ts, arr, esOnly) {
    if (!ts || !ts.length) return '';
    const suffix = arr ? '<span class="arr">[]</span>' : '';
    const parts = ts.map(t => {
      let out = link(t) + suffix;
      const c = d.byName.get(t);
      if (c && isCollection(c)) {
        const el = elementOf(c);
        /* <wbr> gibt der Typspalte eine saubere Trennstelle: aus
           EventListeners<EventListener> wird bei Platzmangel ein Umbruch vor
           der Klammer statt mitten im Bezeichner. */
        if (el && known(el))
          out += `<wbr><span class="gen">&lt;</span>${link(el)}<span class="gen">&gt;</span>`;
      }
      return out;
    });
    if (!esOnly || !esOnly.length) return parts.join(OR);
    let out = '';
    let sepDone = false;   /* der Strich wurde schon vom Vorgaenger mitgenommen */
    parts.forEach((html, i) => {
      const sep = i && !sepDone ? OR : '';
      sepDone = false;
      if (!esOnly.includes(ts[i])) { out += sep + html; return; }
      if (i) {
        /* Steht der Typ hinten, geht der Strich VOR ihm mit weg. */
        out += `<span data-uxp="hide">${sep}${html}</span>`;
      } else {
        /* Steht er vorn, der Strich DAHINTER — sonst beginnt die Zeile mit ihm. */
        out += `<span data-uxp="hide">${html}${parts.length > 1 ? OR : ''}</span>`;
        sepDone = true;
      }
    });
    return out;
  }

  /* Ein File als Event-Handler gibt es in UXP nicht — dort ist es immer eine
     Funktion. Betrifft addEventListener, removeEventListener und
     EventListeners.add. app.doScript() bleibt ausdruecklich unberuehrt: dort
     laeuft eine ExtendScript-Datei auch unter UXP. */
  const esOnlyArg = (cls, method, arg) =>
    target.uxp && arg === 'handler' &&
      (/^(add|remove)EventListener$/.test(method) ||
        (cls === 'EventListeners' && method === 'add'))
      ? ['File'] : null;

  /* Auch NothingEnum bekommt seinen Chip: er ist die Kopierhilfe fuer
     NothingEnum.NOTHING, und genau so schreibt man es im Skript. */
  function inlineEnum(ts) {
    for (const t of ts || []) {
      const e = d.byName.get(t);
      if (e && e.enum && e.p.length) {
        const shown = e.p.slice(0, 12).map(v =>
          `<button class="vchip" data-cp="${esc(e.n + '.' + v.n)}" title="Copy ${esc(e.n + '.' + v.n)}">${esc(v.n)}</button>`).join('');
        const rest = e.p.length > 12 && known(e.n)
          ? `<a class="more" href="${esc(resolve(e.n))}">+${e.p.length - 12} more</a>` : '';
        return `<div class="vals">${shown}${rest}</div>`;
      }
    }
    return '';
  }

  const extras = x => (x.rng ? ` <span class="rngv">${esc(x.rng[0])}&ndash;${esc(x.rng[1])}</span>` : '')
    + (x.mu ? ' <span class="muv" title="Measurement unit — may also be written as a string such as &quot;12mm&quot;">unit</span>' : '');

  /* Hinweis an einer einzelnen Zeile, direkt unter der Beschreibung. Ein Kasten
     oben an der Seite waere fuer eine von 341 Properties die falsche Stelle.
     Gilt er nur fuer UXP, erscheint er nur bei Zielen mit Umschalter. */
  function memberNote(cls, member) {
    const n = notes.noteForMember(cls, member, target.slug);
    if (!n) return '';
    if (n.runtime && n.runtime !== 'es' && !target.uxp) return '';
    return `<span class="mwarn"${n.runtime ? ` data-only="${esc(n.runtime)}"` : ''}
      >${esc(n.text)}</span>`;
  }

  const copyable = (clip, label) =>
    `<button class="cpx" data-cp="${esc(clip)}" title="Copy ${esc(clip)}">${label}</button>`;

  /* Leer, wenn es keine Vorfahren gibt: eine Zeile, die nur den Namen der
     Seite wiederholt, ist keine Information. Betrifft 432 Enumerations und
     alle Objekte ohne superclass. */
  function chain(c) {
    const out = []; let x = c, guard = 0;
    while (x && guard++ < 12) { out.push(x.n); x = x.sup ? d.byName.get(x.sup) : null; }
    if (out.length < 2) return '';
    return out.reverse().map((n, i) =>
      (i ? '<span class="sep">›</span>' : '') + (n === c.n ? `<b>${esc(n)}</b>` : link(n))).join(' ');
  }

  function revSection(title, arr, hint) {
    if (!arr || !arr.length) return '';
    const items = arr.map(([cls, mem, isM, arg]) => {
      const href = resolve(cls);
      const inner = `<em>${esc(cls)}.</em>${esc(mem)}${
        isM ? (arg ? `(<span class="argn">${esc(arg)}</span>)` : '()') : ''}`;
      return href ? `<a href="${esc(href)}">${inner}</a>` : `<span>${inner}</span>`;
    }).join('');
    return `<section class="rev"><h2 class="sechead">${title} <b>${arr.length}</b></h2>
      <p class="hint">${hint}</p><div class="revbox">${items}</div></section>`;
  }

  function page(c) {
    const el = isCollection(c) ? elementOf(c) : null;
    const oo = objectOf.get(c.n) || [], po = paramOf.get(c.n) || [], rb = returnedBy.get(c.n) || [];
    const label = c.enum ? 'Values' : 'Properties';
    const what = c.enum ? 'an ' + esc(c.n) + ' value' : 'a ' + esc(c.n);
    let h = '';

    /* Kopfbereich zweispaltig: links Name, Beschreibung und Vererbung, rechts
       die Hierarchie. Die Flaeche neben dem Titel stand sonst leer, und die
       Hierarchie schob die Tabellen nach unten. */
    let kopf = `<div class="kind">${kindOf(c)}${
      el && known(el) ? ` <span class="of">of</span> ${link(el)}` : ''}</div>
      <h1>${esc(c.n)}</h1>
      <p class="lede">${esc(c.d)}</p>`;
    const anc = chain(c);
    if (anc) kopf += `<div class="chain">${anc}</div>`;
    /* Der Weg nach unten. Adobe liefert nur superclass; von PageItem aus ist
       die Liste der Rahmenarten aber das Nuetzlichere. */
    const subs = subOf.get(c.n) || [];
    if (subs.length)
      kopf += `<div class="subs"><span class="h">Extended by</span>${
        subs.map(n => link(n)).join('<span class="sep">·</span>')}</div>`;

    /* Enthaltensein statt Vererbung: worin dieses Objekt stecken kann, und was
       in ihm stecken kann. Drei Zeilen um den eigenen Namen, wie im Object
       Model Viewer — die Frage "wo bekomme ich das her" ist beim Skripten die
       haeufigste. Fehlt eine Richtung, faellt die Zeile weg. */
    const ups = parentsOf.get(c.n) || [], downs = childrenOf.get(c.n) || [];
    const prefs = prefsOf.get(c.n) || [];
    let baum = '';
    if (ups.length || downs.length || prefs.length) {
      /* Leerzeichen um den Trenner, nicht nur Rand: ohne sie hat die Zeile
         keine Umbruchstelle und 85 Kindernamen laufen aus der Spalte. */
      const reihe = ns => ns.map(n => link(n)).join(' <span class="sep">|</span> ');
      /* Ab vierzig Namen hinter einen Pfeil: die 81 Kinder von Document machten
         den Kasten hoeher als den halben Bildschirm und schoben die Tabellen
         hinaus. Darunter bleibt die Liste offen — ein Klick fuer drei Zeilen
         waere nur im Weg. */
      const MAX_OFFEN = 40;
      const zeile = (ns, cls, was) => ns.length <= MAX_OFFEN
        ? `<p class="${cls}">${reihe(ns)}</p>`
        : `<details class="viele"><summary>${ns.length} ${was}</summary>
            <p class="${cls}">${reihe(ns)}</p></details>`;
      baum = `<div class="tree"><span class="h">Hierarchy</span>
        ${ups.length ? zeile(ups, 'up', 'objects') : ''}
        <p class="self">${esc(c.n)}</p>
        ${downs.length ? zeile(downs, 'down', 'objects') : ''}
        ${prefs.length ? `<details class="prefs"${prefs.length <= 6 ? ' open' : ''}>
          <summary>${prefs.length} preference object${prefs.length > 1 ? 's' : ''}</summary>
          <p class="down">${reihe(prefs)}</p></details>` : ''}</div>`;
    }
    h += `<div class="head"><div class="headmain">${kopf}</div>${baum}</div>`;

    /* Erfahrungswerte, die nicht im Objektmodell stehen — siehe build/notes.js.
       Gilt ein Hinweis nur fuer eine Laufzeit, blendet site.js ihn im anderen
       Modus aus; ohne Umschalter erscheinen nur die allgemeinen. */
    for (const note of notes.notesFor(c.n, kindOf(c), target.slug)) {
      if (note.runtime && note.runtime !== 'es' && !target.uxp) continue;
      h += `<p class="warn"${note.runtime ? ` data-only="${esc(note.runtime)}"` : ''}
        role="note">${esc(note.text)}</p>`;
    }

    /* Das Kuerzel steht auf der Pille, wie F und O in ihren Feldern: ein
       Tastenweg, den niemand kennt, ist keiner. */
    const pill = (key, text, n) =>
      `<button class="pill" type="button" data-o="${key}">${text} ${n}<kbd>${
        key === 'p' ? 'P' : key === 'e' ? 'E' : 'M'}</kbd></button>`;
    /* Der Name steht in der klebenden Zeile mit: nach ein paar Bildschirmen
       Properties ist die Ueberschrift lange weggescrollt, und bei 423 Objekten
       mit aehnlichen Namen (TextFrame, TextFramePreference) will man sich
       vergewissern, wo man ist. */
    h += `<div class="barwatch"></div>
      <div class="bar" hidden data-enhance="filter">
      <div class="barname">${esc(c.n)}</div>
      <div class="barrow">
      <label class="fwrap" for="f">
        <input id="f" type="search" placeholder="Filter members…" spellcheck="false" autocomplete="off">
        <kbd>F</kbd></label>
      <button class="pill on" type="button" data-o="all">All<kbd>A</kbd></button>
      ${c.p.length ? pill('p', label, c.p.length) : ''}
      ${c.ev.length ? pill('e', 'Events', c.ev.length) : ''}
      ${c.m.length ? pill('m', 'Methods', c.m.length) : ''}
      <button class="pill mode" type="button" data-mode="list"
        title="All members as a list">List<kbd>L</kbd></button></div></div>
      <div class="mlist" hidden data-enhance="list"></div>`;

    if (c.p.length) {
      h += `<section data-sec="p"><h2 class="sechead" id="properties">${label}</h2>
        <table><thead><tr><th class="c-n">Name</th><th class="c-t">Type</th>
        <th class="c-a">Access</th><th>Description</th></tr></thead><tbody>`;
      for (const p of c.p) {
        const clip = (c.enum || p.st) ? c.n + '.' + p.n : p.n;
        h += `<tr id="p-${esc(p.n)}"><td class="n">${copyable(clip, esc(p.n))}${
          p.st ? '<span class="stat">static</span>' : ''}</td>
          <td class="t">${typeList(p.t, p.arr) || '<span class="none">—</span>'}${
            p.v ? ` <span class="lit">= ${esc(p.v)}</span>` : ''}${extras(p)}${inlineEnum(p.t)}</td>
          <td class="a ${p.rw === 'readonly' ? 'ro' : 'rw'}" title="${esc(p.rw)}">${esc(p.rw)}</td>
          <td class="d">${esc(p.d)}${memberNote(c.n, p.n)}</td></tr>`;
      }
      h += '</tbody></table></section>';
    }

    if (c.ev.length) {
      h += `<section data-sec="e"><h2 class="sechead" id="events">Events</h2>
        <table><thead><tr><th class="c-n">Name</th><th>Description</th></tr></thead><tbody>`;
      for (const e of c.ev)
        h += `<tr id="e-${esc(e.n)}"><td class="n ev">${copyable(c.n + '.' + e.n, esc(e.n))}</td>
          <td class="d">${esc(e.d)}</td></tr>`;
      h += '</tbody></table></section>';
    }

    if (c.m.length) {
      h += `<section data-sec="m"><h2 class="sechead" id="methods">Methods</h2>`;
      for (const m of c.m) {
        const sig = esc(m.n) + '<span class="d">(' +
          m.a.map(a => a.o ? `<span class="opt">${esc(a.n)}?</span>` : esc(a.n)).join(', ') + ')</span>';
        /* Unter UXP entfaellt der Index-Zugriff "[]" — und alles, was
           additions.js ausdruecklich als ExtendScript-only eintraegt. */
        const esOnlyMethod = m.n === '[]' || m.uxp === false;
        h += `<article class="mem" id="m-${esc(m.n)}" data-uxp="${esOnlyMethod ? 'hide' : ''}">
          <div class="top1"><span class="id">${copyable(m.n + '()', sig)}</span>
            <span class="ret">→ ${typeList(m.r, m.rarr) || '<b>void</b>'}</span></div>
          <p class="desc">${esc(m.d)}</p>`;
        if (m.a.length) {
          h += '<div class="args">' + m.a.map(a => `<div class="arg">
            <span class="an${a.o ? ' o' : ''}">${esc(a.n)}${a.o ? '?' : ''}</span>
            <span class="at">${typeList(a.t, a.arr, esOnlyArg(c.n, m.n, a.n)) || '—'}${extras(a)}</span>
            <span class="ad">${esc(a.d.replace(/\s*\(Optional\)$/, ''))}</span></div>`).join('') + '</div>';
        }
        h += '</article>';
      }
      h += '</section>';
    }

    h += revSection('Object of', oo, `Properties elsewhere that hold ${what}.`);
    h += revSection('Parameter of', po, `Method parameters that accept ${what}.`);
    h += revSection('Return', rb, `Methods that return ${what}.`);
    if (c.enum && !oo.length && !po.length && !rb.length)
      h += `<section class="rev"><h2 class="sechead">Used by <b>0</b></h2>
        <p class="hint">No documented property, parameter or return value uses ${esc(c.n)}.</p></section>`;

    return shell({ title: c.n, description: c.d || (kindOf(c) + ' ' + c.n),
      body: h, current: c.n, target, targets, data });
  }

  function indexPage() {
    const own = data.classes;
    const groups = [
      ['Objects', own.filter(c => !c.enum && !isCollection(c))],
      ['Collections', own.filter(c => !c.enum && isCollection(c))],
      ['Enumerations', own.filter(c => c.enum)]
    ].filter(([, l]) => l.length);
    const v = splitVersion(data.version);
    let h = `<div class="kind">${esc(target.kind || 'Reference')}</div><h1>${esc(target.label)}</h1>
      <p class="lede">${esc(data.version)}${v.build ? '' : ''}. ${own.length} entries.</p>`;
    if (target.note) h += `<p class="note">${esc(target.note)}</p>`;

    /* Die Kurzreferenz auf einer Seite. Nur bei den beiden InDesign-Zielen —
       sie zeigt das InDesign-Objektmodell, fuer Illustrator oder Photoshop
       waere sie falsch. Die Vorschau ist ein Standbild der ersten Seite und
       muss von Hand erneuert werden, wenn das PDF sich aendert (siehe
       build/README.md). */
    /* Einstiegspunkte links, Kurzreferenz rechts — beide beantworten dieselbe
       Frage („wo fange ich an?"), deshalb stehen sie nebeneinander. */
    const quick = shortcuts.products.includes(target.slug)
      ? shortcuts.list.filter(n => data.classes.some(c => c.n === n)) : [];

    if (quick.length || target.refcard) {
      h += '<section class="start"><h2 class="sechead" id="start">Start here</h2><div class="startrow">';
    }
    if (quick.length) {
      h += `<nav class="quick" aria-label="Frequently used objects">
        ${quick.map(n => `<a href="${esc(pageOf(n))}">${esc(n)}</a>`).join('')}</nav>`;
    }

    if (target.refcard) {
      h += `<div class="refcard">
        <a href="https://www.indesignjs.de/idskurzreferenz.pdf" rel="noopener">
          <img src="../assets/idskurzreferenz.jpg" width="840" height="604" loading="lazy"
            alt="InDesign-Skripting-Kurzreferenz: the object model on one page, with the
                 classes app, Document, Page, TextFrame, Story and Text and the
                 properties connecting them.">
          <span><b>InDesign-Skripting-Kurzreferenz</b>
          <span class="d">The object model on one page: which class holds which
          collection, what a property returns, and how you get from
          <code>app</code> to a single character. One landscape page, German
          labels, English identifiers. PDF, 288 KB.</span></span></a></div>`;
    }
    if (quick.length || target.refcard) h += '</div></section>';

    /* Die ganze Website als ein Archiv. __ZIPMB__ ersetzt build.js, sobald
       gepackt ist — vorher steht die Groesse nicht fest. */
    h += `<section class="offline"><h2 class="sechead" id="offline">Offline</h2>
      <ul class="dl">
        <li><a href="../indesignapi.zip" download><b>indesignapi.zip</b>
          <span>The whole site: every application and both shared libraries,
          __ZIPPAGES__ pages. Unpack it and open <code>index.html</code> —
          no server, no internet. About __ZIPMB__ MB.</span></a></li>
      </ul></section>`;

    /* Maschinenlesbare Ausgaben. Bewusst hier und nicht in der Kopfzeile: das
       holt man einmal je Projekt, nicht dutzendfach je Stunde — und der Kopf
       ist voll. Erzeugt von build/agents.js. */
    h += `<section class="machine"><h2 class="sechead" id="for-tools">For editors and AI agents</h2>
      <ul class="dl">
        <li><a href="${esc(target.slug)}.d.ts" download><b>${esc(target.slug)}.d.ts</b>
          <span>TypeScript declarations: this object model, the Core JavaScript
          classes and the global names. Drop it into a project and the editor
          answers without a lookup.</span></a></li>
        ${target.kind === 'Product' ? `<li>
          <a href="${esc(target.slug)}-scriptui.d.ts" download><b>${esc(target.slug)}-scriptui.d.ts</b>
          <span>The same plus ScriptUI, for scripts with a dialog. Nine classes
          share a name with ScriptUI (Window, Button, Event, …); in this file
          they belong to ScriptUI, because <code>new Window()</code> is what a
          dialog needs. Take one file or the other, never both.</span></a></li>` : ''}
        <li><a href="llms.txt"><b>llms.txt</b>
          <span>Where everything lives, for an AI agent. Every object also has a
          Markdown twin at the same path as its page.</span></a></li>
        <li><a href="api.json" download><b>api.json</b>
          <span>The whole model as JSON, for your own tooling. Large.</span></a></li>
      </ul>
      <p class="hint">ExtendScript is not a browser. With the DOM library loaded,
      <code>Document</code>, <code>Event</code>, <code>Text</code> and
      <code>Window</code> resolve to the browser versions and the declarations
      below them go unseen — <code>doc.pages</code> unknown,
      <code>doc.createElement</code> offered instead. Save this next to your
      scripts as <code>jsconfig.json</code>:</p>
      <pre class="snip"><button class="cpx" data-cp="${esc(JSCONFIG)}"
        title="Copy jsconfig.json">${esc(JSCONFIG)}</button></pre></section>`;

    for (const [name, list] of groups) {
      h += `<section><h2 class="sechead" id="${name.toLowerCase()}">${name} <b>${list.length}</b></h2>
        <ul class="grid">` + list.map(c =>
          `<li><a href="${esc(pageOf(c.n))}">${esc(c.n)}</a></li>`).join('') + '</ul></section>';
    }
    return shell({ title: target.label, description: data.version,
      body: h, current: null, target, targets, data, isIndex: true });
  }

  return { page, indexPage, pageOf };
}

/* Gemeinsames Seitengeruest. CSS und JS liegen eine Ebene hoeher, damit der
   Browser sie ueber alle Produkte hinweg einmal cacht. */
function shell({ title, description, body, current, target, targets, data, isIndex }) {
  const v = splitVersion(data.version);
  /* Produktumschalter als <details>: funktioniert ohne JavaScript, ist per
     Tastatur bedienbar und braucht kein Skript zum Navigieren. */
  const options = targets.map(t => {
    const here = t.slug === target.slug;
    /* Wenn das gleichnamige Objekt drueben existiert, direkt dorthin springen. */
    const to = (!here && current && t.names.has(current))
      ? '../' + t.slug + '/' + pageOf(current)
      : '../' + t.slug + '/index.html';
    return `<a class="${here ? 'on' : ''}" href="${esc(here ? (isIndex ? '#' : 'index.html') : to)}">
      <span>${esc(t.label)}</span><i>${esc(t.shortVersion || '')}</i></a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — ${esc(target.label)} API</title>
<meta name="description" content="${esc(description).slice(0, 300)}">
<link rel="stylesheet" href="../assets/site.css">
<script>${THEME_BOOT}</script>
</head>
<body${current ? ` data-object="${esc(current)}"` : ''} data-target="${esc(target.slug)}">
<header class="top">
  <a class="logo" href="../index.html">indesign<b>js</b></a>
  <details class="prod">
    <summary><span class="pl">${esc(target.label)}</span><span class="pv">${
      esc(target.shortVersion || '')}</span></summary>
    <div class="prodmenu">${options}</div>
  </details>
  ${v.build ? `<span class="apiver">API ${esc(v.build)}</span>` : ''}
  ${target.uxp ? `<div class="rt" hidden data-enhance="runtime">
    <button type="button" data-r="es" class="on">ExtendScript</button>
    <button type="button" data-r="uxp">UXP</button>
  </div>` : ''}
  <nav class="trail" hidden data-enhance="trail" aria-label="Recently visited"></nav>
  <button class="kbtn" type="button" hidden data-enhance="search">
    <span>Search ${esc(target.label)}…</span><span class="keys"><kbd>Ctrl</kbd><kbd>K</kbd></span></button>
  <div class="fs" hidden data-enhance="fontsize">
    <button type="button" data-f="-" aria-label="Smaller text">A−</button>
    <span class="lvl"></span>
    <button type="button" data-f="+" aria-label="Larger text">A+</button>
  </div>
  <button class="tg" type="button" hidden data-enhance="theme"></button>
</header>
<div class="grid">
  <nav class="side" aria-label="Objects"><a class="allobjects" href="index.html">All entries →</a>
    <div class="sidef" hidden data-enhance="navfilter">
      <label class="fwrap" for="nf">
        <input id="nf" type="search" placeholder="Filter objects…" spellcheck="false"
          autocomplete="off" aria-label="Filter the object list">
        <kbd>O</kbd></label></div>
    <div class="sidelist"></div></nav>
  <main class="doc"><div class="dmain">${body}</div>
    <footer>
      <p class="legal">Generated with AI assistance from Adobe’s original sources — descriptive texts
      are Adobe’s, transformation errors are ours. Copyright of the original files, and the trademarks
      InDesign, Photoshop, Illustrator, ExtendScript and ScriptUI, are held by Adobe Inc. In case of
      doubt, refer to the original files supplied by Adobe.</p>
      <p class="meta">Built from ${esc(data.version)} on ${esc(data.generated)}.</p>
      <p class="by">Created with <span class="hrt">&#9829;</span> by
        <a href="https://www.linkedin.com/in/gregor-fellenz/" rel="noopener">Gregor Fellenz</a>,
        <a href="https://www.publishingx.de/" rel="noopener">publishingX</a>
        <span class="sep">|</span>
        <a href="https://www.publishingx.de/impressum/" rel="noopener">Impressum</a>
        <span class="sep">|</span>
        <a href="https://www.publishingx.de/datenschutzerklaerung/" rel="noopener">Datenschutz</a></p>
    </footer>
  </main>
</div>
<script src="nav.js" defer></script>
<script src="../assets/site.js" defer></script>
</body>
</html>
`;
}

module.exports = { make, shell, esc, pageOf, splitVersion, THEME_BOOT };
