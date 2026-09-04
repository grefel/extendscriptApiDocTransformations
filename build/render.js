/* Rendert ein Datenmodell zu statischem HTML. Eine Datei je Objekt.

   Grundsatz: Jede Seite ist ohne JavaScript vollstaendig lesbar. Das Skript
   ergaenzt nur Suche, Navigationsliste, Filter und Zwischenablage — es baut
   keine Inhalte auf. Der komplette Inhalt steht im Markup, nur die
   Navigationsliste nicht: 1000+ Eintraege wuerden jede Seite aufblaehen. */
'use strict';

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Muss synchron im <head> laufen, bevor der Browser das erste Mal zeichnet.
   site.js laeuft mit defer und damit zu spaet: die Seite erschiene beim
   Navigieren kurz im dunklen Standardthema und klappte dann um. */
const THEME_BOOT =
  'try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.t=t}catch(e){}';

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

/* ctx.resolve(name) -> relativer Pfad oder null. Damit landen Typen wie "File"
   auf der gemeinsamen JavaScript-Bibliothek statt ins Leere zu zeigen. */
function make(data, d, ctx) {
  const { isCollection, elementOf, objectOf, paramOf, returnedBy } = d;
  const { target, targets, resolve } = ctx;
  const kindOf = c => (c.enum ? 'Enumeration' : isCollection(c) ? 'Collection' : 'Object');
  const link = n => { const href = resolve(n); return href ? `<a href="${esc(href)}">${esc(n)}</a>` : esc(n); };
  const known = n => resolve(n) !== null;

  function typeList(ts, arr) {
    if (!ts || !ts.length) return '';
    const suffix = arr ? '<span class="arr">[]</span>' : '';
    return ts.map(t => {
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
    }).join(' <span class="or">|</span> ');
  }

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

  const copyable = (clip, label) =>
    `<button class="cpx" data-cp="${esc(clip)}" title="Copy ${esc(clip)}">${label}</button>`;

  function chain(c) {
    const out = []; let x = c, guard = 0;
    while (x && guard++ < 12) { out.push(x.n); x = x.sup ? d.byName.get(x.sup) : null; }
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

    h += `<div class="kind">${kindOf(c)}${
      el && known(el) ? ` <span class="of">of</span> ${link(el)}` : ''}</div>
      <h1>${esc(c.n)}</h1>
      <p class="lede">${esc(c.d)}</p>
      <div class="chain">${chain(c)}</div>`;

    const pill = (key, text, n) =>
      `<button class="pill" type="button" data-o="${key}">${text} ${n}</button>`;
    h += `<div class="bar" hidden data-enhance="filter">
      <input id="f" type="search" placeholder="Filter members…" spellcheck="false" autocomplete="off">
      <button class="pill on" type="button" data-o="all">All</button>
      ${c.p.length ? pill('p', label, c.p.length) : ''}
      ${c.ev.length ? pill('e', 'Events', c.ev.length) : ''}
      ${c.m.length ? pill('m', 'Methods', c.m.length) : ''}</div>`;

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
          <td class="d">${esc(p.d)}</td></tr>`;
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
        h += `<article class="mem" id="m-${esc(m.n)}" data-uxp="${m.n === '[]' ? 'hide' : ''}">
          <div class="top1"><span class="id">${copyable(m.n + '()', sig)}</span>
            <span class="ret">→ ${typeList(m.r, m.rarr) || '<b>void</b>'}</span></div>
          <p class="desc">${esc(m.d)}</p>`;
        if (m.a.length) {
          h += '<div class="args">' + m.a.map(a => `<div class="arg">
            <span class="an${a.o ? ' o' : ''}">${esc(a.n)}${a.o ? '?' : ''}</span>
            <span class="at">${typeList(a.t, a.arr) || '—'}${extras(a)}</span>
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

    /* Maschinenlesbare Ausgaben. Bewusst hier und nicht in der Kopfzeile: das
       holt man einmal je Projekt, nicht dutzendfach je Stunde — und der Kopf
       ist voll. Erzeugt von build/agents.js. */
    h += `<section class="machine"><h2 class="sechead" id="for-tools">For editors and AI agents</h2>
      <ul class="dl">
        <li><a href="${esc(target.slug)}.d.ts" download><b>${esc(target.slug)}.d.ts</b>
          <span>TypeScript declarations, self-contained. Drop it into a project and
          the editor answers without a lookup.</span></a></li>
        <li><a href="llms.txt"><b>llms.txt</b>
          <span>Where everything lives, for an AI agent. Every object also has a
          Markdown twin at the same path as its page.</span></a></li>
        <li><a href="api.json" download><b>api.json</b>
          <span>The whole model as JSON, for your own tooling. Large.</span></a></li>
      </ul></section>`;

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
  <button class="tg" type="button" hidden data-enhance="theme"></button>
</header>
<div class="grid">
  <nav class="side" aria-label="Objects"><a class="allobjects" href="index.html">All entries →</a>
    <div class="sidef" hidden data-enhance="navfilter">
      <input id="nf" type="search" placeholder="Filter objects…" spellcheck="false"
        autocomplete="off" aria-label="Filter the object list"></div>
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
  <aside class="rail2" aria-label="On this page"></aside>
</div>
<script src="nav.js" defer></script>
<script src="../assets/site.js" defer></script>
</body>
</html>
`;
}

module.exports = { make, shell, esc, pageOf, splitVersion, THEME_BOOT };
