/* Rendert ein Datenmodell zu statischem HTML. Eine Datei je Objekt.

   Grundsatz: Jede Seite ist ohne JavaScript vollstaendig lesbar. Das Skript
   ergaenzt nur Suche, Navigationsliste, Filter und Zwischenablage — es baut
   keine Inhalte auf. Der komplette Inhalt steht im Markup, nur die
   Navigationsliste nicht: 1000+ Eintraege wuerden jede Seite aufblaehen. */
'use strict';

const shortcuts = require('./shortcuts');
const examples = require('./examples');
/* Syntaxfarben entstehen beim Bauen: die Seiten tragen fertige <span>s,
   laden kein Skript dafuer und sehen ohne JavaScript und offline gleich aus.
   Nur der Kern mit den zwei Sprachen, die hier vorkommen. */
const hljs = require('highlight.js/lib/core');
hljs.registerLanguage('javascript', require('highlight.js/lib/languages/javascript'));
hljs.registerLanguage('json', require('highlight.js/lib/languages/json'));

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Oeffentliche Adresse der Website. Steht im Canonical jeder Seite und in den
   maschinenlesbaren Dateien (agents.js). */
const BASE = 'https://www.indesignjs.de/indesignapi/';

/* Laeuft synchron im <head>, vor dem ersten Zeichnen. site.js hat "defer" und
   ist damit zu spaet: die Folgeseite erschiene kurz im Standard und klappte
   dann um. Ohne gespeicherte Wahl wird hier nichts gesetzt — dann entscheidet
   prefers-color-scheme im Stylesheet, und der Zoom bleibt bei 1,15.

   Geschrieben werden beide Werte, "light" wie "dark": ausdrueckliches Hell
   muss ein dunkel eingestelltes System ueberstimmen koennen. */
const THEME_BOOT =
  'try{var d=document.documentElement,s=localStorage,t=s.getItem("theme");' +
  'if(t==="dark"||t==="light")d.dataset.t=t;' +
  'var f=parseFloat(s.getItem("fs"));if(f>0)d.style.setProperty("--fs",f)}catch(e){}';

/* Dateiname je Objekt. Im aktuellen Modell ist "$" das einzige Sonderzeichen und
   in Dateinamen wie in URLs unbedenklich — pauschales encodeURIComponent machte
   daraus nur ein haessliches %24. Alles Uebrige wird sicherheitshalber kodiert.
   Auf Gross-/Kleinschreibung darf man sich nicht verlassen, build.js prueft das.
   Die Klasse Index wird deshalb zu Index_.html — index.html ist die
   Objektliste. Dieselbe Regel steht in site.js (page). */
const pageOf = name =>
  name.replace(/[^A-Za-z0-9_$.-]/g, ch => '%' + ch.charCodeAt(0).toString(16).toUpperCase())
  + (name.toLowerCase() === 'index' ? '_' : '') + '.html';

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

/* Codeblock mit Syntaxfarben und Kopier-Icon oben rechts. Kopiert wird code,
   angezeigt auf Wunsch mit einer Kopfzeile ("// hello.jsx") davor. Das Icon
   startet hidden: ohne JavaScript kopiert es nichts, dann bleibt der Code
   zum Markieren. site.js blendet es ein; .ok tauscht es kurz gegen den Haken. */
const ICON_COPY = '<svg class="i-copy" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
  '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/>' +
  '<path d="M10.5 3.5V3A1.5 1.5 0 0 0 9 1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5"/></svg>';
const ICON_OK = '<svg class="i-ok" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
  '<path d="M3 8.5l3 3 7-7"/></svg>';
function snippet(code, lang, label, head) {
  const shown = head ? head + '\n' + code : code;
  /* Das Icon sitzt im Rahmen um den <pre>, nicht darin: der Block scrollt
     auf schmalen Schirmen seitlich, und das Icon wanderte sonst mit. */
  return `<div class="snipbox"><pre class="snip"><code class="hljs language-${lang}">${
    hljs.highlight(shown, { language: lang }).value}</code></pre><button type="button" class="cpicon" hidden
    data-cp="${esc(code)}" title="Copy ${esc(label)}" aria-label="Copy ${esc(label)}">${
    ICON_COPY}${ICON_OK}</button></div>`;
}

/* ctx.resolve(name) -> relativer Pfad oder null. Damit landen Typen wie "File"
   auf der gemeinsamen JavaScript-Bibliothek statt ins Leere zu zeigen. */
function make(data, d, ctx) {
  const { isCollection, elementOf, objectOf, paramOf, returnedBy, subOf,
    parentsOf, childrenOf, prefsOf } = d;
  const { target, targets, resolve, rt } = ctx;
  const kindOf = c => (c.enum ? 'Enumeration' : isCollection(c) ? 'Collection' : 'Object');
  /* Was unter UXP anders ist, sagt runtime.js. Umgeschaltet wird in site.js;
     hier steht nur das zweite Ziel im Markup, damit es ohne JavaScript keine
     falsche Zusage gibt. */
  const link = n => {
    const href = resolve(n);
    if (!href) return esc(n);
    const u = rt.coreLink(n);
    const extra = !u ? '' : u.off ? ' data-uxp="off"' : ` data-uxp-href="${esc(u.href)}"`;
    return `<a href="${esc(href)}"${extra}>${esc(n)}</a>`;
  };
  const known = n => resolve(n) !== null;

  /* File und Folder sind unter UXP Eintraege aus
     require('uxp').storage.localFileSystem, und wer sie aus einer Property
     liest, bekommt ein Promise darauf. Die Huelle "Promise<…>" steht nur im
     UXP-Modus; ohne JavaScript gilt ExtendScript, deshalb hidden im Markup.
     Ohne Leerraum dazwischen — die Listenansicht liest textContent. */
  const PROMISE_OPEN = '<span class="uxpv" data-only="uxp" hidden title="UXP: resolves to an entry'
    + " from require('uxp').storage.localFileSystem — await it\">Promise<span class=\"gen\">&lt;</span></span>";
  const PROMISE_CLOSE = '<span class="gen" data-only="uxp" hidden>&gt;</span>';

  const OR = ' <span class="or">|</span> ';

  /* ux: Abweichung unter UXP aus runtime.js. ux.promise bekommt die Huelle
     Promise<…>, ux.hide gilt nur unter ExtendScript und wird samt Trennstrich
     in einen data-uxp="hide"-Knoten gepackt, damit im UXP-Modus kein
     einsames "|" stehen bleibt. */
  function typeList(ts, arr, ux) {
    if (!ts || !ts.length) return '';
    const suffix = arr ? '<span class="arr">[]</span>' : '';
    const esOnly = ux && ux.hide;
    const parts = ts.map(t => {
      let out = ux && ux.promise.includes(t)
        ? PROMISE_OPEN + link(t) + PROMISE_CLOSE + suffix
        : link(t) + suffix;
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
    /* Ein Hinweis nur fuer UXP startet verborgen: ohne JavaScript gibt es
       keinen Umschalter, dann gilt ExtendScript. */
    return rt.memberNotes(cls, member).map(n =>
      `<span class="mwarn"${n.runtime ? ` data-only="${esc(n.runtime)}" ${
        n.runtime === 'uxp' ? 'hidden' : ''}` : ''}
      >${esc(n.text)}</span>`).join('');
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
    for (const note of rt.notes(c.n, kindOf(c))) {
      h += `<p class="warn"${note.runtime ? ` data-only="${esc(note.runtime)}" ${
        note.runtime === 'uxp' ? 'hidden' : ''}` : ''}
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
      <div class="barname">${esc(c.n)}<span class="bkind">${kindOf(c)}</span></div>
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
          <td class="t">${typeList(p.t, p.arr, rt.member(c.n, 'p', p)) || '<span class="none">—</span>'}${
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
        const esOnlyMethod = !!rt.member(c.n, 'm', m);
        h += `<article class="mem" id="m-${esc(m.n)}" data-uxp="${esOnlyMethod ? 'hide' : ''}">
          <div class="top1"><span class="id">${copyable((m.st ? c.n + '.' : '') + m.n + '()', sig)}${
            m.st ? '<span class="stat">static</span>' : ''}</span>
            <span class="ret">→ ${typeList(m.r, m.rarr, rt.member(c.n, 'r', m)) || '<b>void</b>'}</span></div>
          <p class="desc">${esc(m.d)}${memberNote(c.n, m.n)}</p>`;
        if (m.a.length) {
          h += '<div class="args">' + m.a.map(a => `<div class="arg">
            <span class="an${a.o ? ' o' : ''}">${esc(a.n)}${a.o ? '?' : ''}</span>
            <span class="at">${typeList(a.t, a.arr, rt.member(c.n, 'a', a, m.n)) || '—'}${extras(a)}</span>
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

    /* Zwei Laufzeiten, ein Objektmodell. Nur, wo das Modell UXP mitbeschreibt
       (products.js: uxp) — dieselben Regeln fuer Agenten stehen in uxp.md. */
    if (target.uxp) {
      /* Dasselbe Beispiel in beiden Laufzeiten (examples.js). Beim Server
         stehen Argumente und Ergebnis vorn: dort laeuft jedes Skript im
         Auftrag eines Clients, und genau das regeln beide Laufzeiten anders.
         Argumente, Ergebnis und hasOwnProperty() in InDesign 2026 (21.6)
         geprueft. Versionsangaben bewusst nur eine: aeltere UXP-Fassungen
         spielen keine Rolle mehr. */
      const hello = (file, code) => snippet(code, 'javascript', file, '// ' + file);
      const ex = examples.forTarget(target);
      const srv = target.server;
      const esIo = `
            <li>Arguments: <code>app.scriptArgs.getValue("name")</code>${srv ? '' : `, or
              <code>arguments</code> in a script run by <code>doScript()</code>`}</li>
            <li>The result${srv ? ' sent back to the client' : ''} is the value of the
              last expression</li>`;
      const uxpIo = `
            <li>Arguments: <code>require("uxp").script.args</code>, an array of strings${
              srv ? ' such as <code>"name=value"</code>' : ''} — <code>app.scriptArgs</code>
              does not exist</li>
            <li>The result${srv ? ' sent back to the client' : ''} is what you pass to
              <code>script.setResult()</code>; the last expression is ignored</li>`;
      h += `<section class="runtimes"><h2 class="sechead" id="extendscript-uxp">ExtendScript and UXP</h2>
        <p class="hint">${srv ? 'InDesign Server' : 'InDesign'} runs scripts in two engines.
        Both drive the same object model — the objects, properties and methods on these
        pages. What differs is the language around it${srv ? ', and on a server above all how a script gets its arguments and how it hands back its result' : ''}.
        The <b>ExtendScript / UXP</b> switch in the header shows every page as the chosen
        engine sees it.</p>
        <div class="rtcols">
          <div class="rtcard"><h3>ExtendScript</h3><ul>
            <li><code>.jsx</code> files, ${srv ? 'run on behalf of a client' : 'run from the Scripts panel'}</li>${srv ? esIo : ''}
            <li>JavaScript at the level of ES3 (1999): <code>var</code>, no <code>let</code>,
              arrow functions or promises</li>
            <li><code>app</code>, every enumeration, <code>File</code>, <code>Folder</code>
              and <code>$</code> are globals</li>
            <li><code>doc.pages[0]</code> or <code>doc.pages.item(0)</code></li>
            <li>Enumerations compare with <code>==</code></li>
            <li>Property check: <code>obj.hasOwnProperty("name")</code> or
              <code>"name" in obj</code></li>${srv ? '' : esIo}
            <li>Dialogs with ScriptUI</li>
          </ul>${hello(srv ? 'server.jsx' : 'hello.jsx', ex.jsx)}</div>
          <div class="rtcard"><h3>UXP</h3><ul>
            <li><code>.idjs</code> files, ${srv ? 'run on behalf of a client' : 'run from the Scripts panel'};
              UXP plugins since 18.5</li>${srv ? uxpIo : ''}
            <li>Modern JavaScript: <code>let</code>, <code>const</code>, arrow functions,
              <code>async</code>/<code>await</code></li>
            <li><code>const { app } = require("indesign")</code> — enumerations come from
              there too</li>
            <li><code>doc.pages.item(0)</code> only — there is no <code>[0]</code></li>
            <li>Enumerations compare with <code>.equals()</code>, not <code>==</code></li>
            <li>Property check: <code>"name" in obj</code> only —
              <code>hasOwnProperty()</code> is always <code>false</code> on DOM objects</li>${srv ? '' : uxpIo}
            <li>Files come from <code>require("uxp").storage</code>; file and folder
              properties return a Promise — <code>await doc.fullName</code></li>
            <li>No ScriptUI, no <code>$</code>, no E4X <code>XML</code>; the user
              interface is HTML</li>
          </ul>${hello(srv ? 'server.idjs' : 'hello.idjs', ex.idjs)}</div>
        </div>
        <p class="rtlinks"><a href="https://developer.adobe.com/uxp/" rel="noopener">Adobe UXP
          documentation</a><span class="sep">·</span><a
          href="https://developer.adobe.com/indesign/uxp/resources/migration-guides/extendscript/"
          rel="noopener">Migrating from ExtendScript</a><span class="sep">·</span><a
          href="https://developer.adobe.com/indesign/uxp/scripts/tutorials/arguments/"
          rel="noopener">Arguments</a><span class="sep">·</span><a
          href="https://developer.adobe.com/indesign/uxp/scripts/tutorials/script-result/"
          rel="noopener">Script result</a><span class="sep">·</span><a
          href="uxp.md">uxp.md</a> — the full list of differences, for people and AI agents</p>
      </section>`;
    }

    /* Maschinenlesbare Ausgaben und das Offline-Archiv, danach die Typen.
       Bewusst hier und nicht in der Kopfzeile: das holt man einmal je
       Projekt, nicht dutzendfach je Stunde — und der Kopf ist voll. Erzeugt
       von build/agents.js; __ZIPMB__ ersetzt build.js, sobald gepackt ist. */
    h += `<section class="machine"><h2 class="sechead" id="for-tools">For editors and AI agents</h2>
      <ul class="dl">
        <li><a href="llms.txt"><b>llms.txt</b>
          <span>Where everything lives, for an AI agent. Every object also has a
          Markdown twin at the same path as its page.</span></a></li>
        <li><a href="api.json" download><b>api.json</b>
          <span>The whole model as JSON, for your own tooling. Large.</span></a></li>
        <li id="offline"><a href="../indesignapi.zip" download><b>indesignapi.zip</b>
          <span>The whole site: every application and both shared libraries,
          __ZIPPAGES__ pages. Unpack it and open <code>index.html</code> —
          no server, no internet. About __ZIPMB__ MB.</span></a></li>
      </ul></section>`;

    h += `<section class="types"><h2 class="sechead" id="types">Types</h2>
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
        ${target.uxp ? `<li><a href="https://www.npmjs.com/package/indesign-uxp-types" rel="noopener">
          <b>indesign-uxp-types</b>
          <span>TypeScript declarations for UXP (<code>require("indesign")</code>),
          the counterpart to the ExtendScript files above. A community package by
          Vlad Vladila on npm, not part of this site.</span></a></li>` : ''}
      </ul>
      <p class="hint">ExtendScript is not a browser. With the DOM library loaded,
      <code>Document</code>, <code>Event</code>, <code>Text</code> and
      <code>Window</code> resolve to the browser versions and the declarations
      below them go unseen — <code>doc.pages</code> unknown,
      <code>doc.createElement</code> offered instead. Save this next to your
      scripts as <code>jsconfig.json</code>:</p>
      ${snippet(JSCONFIG, 'json', 'jsconfig.json')}</section>`;

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
   Browser sie ueber alle Produkte hinweg einmal cacht.

   Das Canonical nennt die Verzeichnisform (.../indesign/), die Uebersicht ist
   also unter zwei Adressen erreichbar. Die Links im Markup bleiben relativ und
   zeigen auf index.html, sonst liefe die Website nicht ueber file:// aus dem
   Offline-Archiv. */
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
<link rel="canonical" href="${esc(BASE + target.slug + '/' + (isIndex ? '' : pageOf(current)))}">
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

module.exports = { make, shell, esc, pageOf, splitVersion, THEME_BOOT, BASE };
