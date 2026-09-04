/* Verbessert die statischen Seiten: Navigationsliste, Filter, Zwischenablage,
   Laufzeit-Umschalter, Theme und Volltextsuche.

   Grundsatz: Diese Datei erzeugt keine Inhalte. Faellt sie aus, bleibt jede Seite
   vollstaendig lesbar — die Bedienelemente sind im Markup als [hidden] markiert
   und werden erst hier eingeschaltet. */
'use strict';
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const store = {
    get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  const CURRENT = document.body.dataset.object || null;
  const page = n => encodeURIComponent(n) + '.html';

  /* ---------- Theme ----------
     Gesetzt wird es bereits vom Inline-Skript im <head>, damit beim Navigieren
     nichts aufblitzt. Hier kommt nur der Umschalter dazu. Die Beschriftung nennt
     das Ziel, nicht den Zustand: "light mode" schaltet nach hell. */
  const tg = $('[data-enhance="theme"]');
  function labelTheme() {
    if (!tg) return;
    const dark = document.documentElement.dataset.t !== 'light';
    tg.textContent = dark ? 'light mode' : 'dark mode';
    tg.setAttribute('aria-label', 'Switch to ' + (dark ? 'light' : 'dark') + ' mode');
  }
  if (tg) {
    tg.hidden = false;
    labelTheme();
    tg.addEventListener('click', () => {
      const next = document.documentElement.dataset.t === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.t = next;
      store.set('theme', next);
      labelTheme();
    });
  }

  /* ---------- Laufzeit ExtendScript / UXP ----------
     Bleibt genau ein Inhaltsunterschied: UXP kennt keinen Index-Zugriff auf
     Collections, deshalb entfallen die Methoden mit dem Namen "[]".
     $ und ScriptUI mussten frueher hier ausgeblendet werden — sie sind jetzt
     eigene Bibliotheken im Produktumschalter und tauchen gar nicht mehr im
     Objektmodell eines Produkts auf. */
  const rt = $('[data-enhance="runtime"]');
  /* Den Umschalter tragen nur InDesign und InDesign Server. Ohne ihn gilt immer
     ExtendScript — ein anderswo gespeichertes "uxp" wuerde sonst Member
     ausblenden, die auf dieser Seite niemand zurueckholen kann. */
  let runtime = rt ? store.get('runtime', 'es') : 'es';

  function applyRuntime() {
    const uxp = runtime === 'uxp';
    $$('.mem[data-uxp="hide"]').forEach(el => { el.hidden = uxp; });
    /* Die Zahl steht nur noch auf der Pille — in der Ueberschrift war sie
       doppelt und damit Rauschen. */
    const shown = $$('.mem').filter(el => !el.hidden).length;
    const mp = $('.pill[data-o="m"]');
    if (mp) mp.textContent = 'Methods ' + shown;
    $$('.rt button').forEach(b => b.classList.toggle('on', b.dataset.r === runtime));
    document.body.dataset.runtime = runtime;
    buildNav();
    applyFilter();
  }
  if (rt) {
    rt.hidden = false;
    $$('.rt button').forEach(b => b.addEventListener('click', () => {
      runtime = b.dataset.r; store.set('runtime', runtime);
      applyRuntime();
    }));
  }

  /* ---------- Zwischenablage ----------
     Member auf Klassenebene werden qualifiziert kopiert (CopyrightStatus.YES),
     Instanz-Properties nackt, Methoden mit (). Das steckt bereits in data-cp. */
  document.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-cp]');
    if (!b) return;
    ev.preventDefault();
    const t = b.dataset.cp;
    try { await navigator.clipboard.writeText(t); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = t; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e2) {}
      ta.remove();
    }
    /* Kein Textwechsel — Name und Wert muessen lesbar bleiben. */
    b.classList.add('ok');
    setTimeout(() => b.classList.remove('ok'), 900);
  });

  /* ---------- Filter: Textfeld und Umschalter je Membertyp ---------- */
  const bar = $('[data-enhance="filter"]');
  let only = 'all';

  function applyFilter() {
    if (!bar) return;
    const q = ($('#f', bar).value || '').trim().toLowerCase();
    const hit = name => !q || name.toLowerCase().includes(q);

    $$('tbody tr').forEach(tr => {
      tr.hidden = !hit(($('td.n', tr) || {}).textContent || '');
    });
    $$('.mem').forEach(m => {
      const uxpHidden = runtime === 'uxp' && m.dataset.uxp === 'hide';
      m.hidden = uxpHidden || !hit(($('.id', m) || {}).textContent || '');
    });
    /* Abschnitt aus, wenn der Umschalter ihn ausschliesst oder nichts uebrig
       bleibt. Die Rueckwaertsverweise ohne data-sec bleiben immer stehen. */
    $$('section[data-sec]').forEach(s => {
      const rows = $$('tbody tr, .mem', s);
      s.hidden = (only !== 'all' && s.dataset.sec !== only) || rows.every(r => r.hidden);
    });
    $$('.pill', bar).forEach(p => p.classList.toggle('on', p.dataset.o === only));
    buildRail();
  }

  if (bar) {
    bar.hidden = false;
    $('#f', bar).addEventListener('input', applyFilter);
    $$('.pill', bar).forEach(p => p.addEventListener('click', () => {
      only = p.dataset.o;
      applyFilter();
    }));
  }

  /* ---------- Navigationsliste ----------
     Nicht in jede Seite gerendert: 1153 Eintraege waeren ~70 KB pro Seite. */
  let NAV = null;
  function buildNav() {
    const side = $('.side');
    if (!side || !NAV) return;
    const vis = NAV;
    const group = (title, kind) => {
      const list = vis.filter(([, k]) => k === kind);
      if (!list.length) return '';
      return `<div class="h">${title} · ${list.length}</div>` + list.map(([n, k, cnt]) =>
        `<a href="${esc(page(n))}" class="${n === CURRENT ? 'on' : ''}${
          k === 2 ? ' e' : k === 1 ? ' co' : ''}"><span>${esc(n)}</span><i>${
          k === 2 ? 'enum' : k === 1 ? 'coll' : cnt}</i></a>`).join('');
    };
    side.innerHTML = group('Objects', 0) + group('Collections', 1) + group('Enumerations', 2);
    /* scrollTop direkt setzen statt scrollIntoView: letzteres scrollt auch das
       Fenster mit und schiebt die Kopfzeile der Seite unter die Leiste. */
    const on = $('a.on', side);
    if (on) side.scrollTop = Math.max(0, on.offsetTop - side.clientHeight / 2);
  }

  /* ---------- rechte Spalte ---------- */
  function buildRail() {
    const rail = $('.rail2');
    if (!rail || !CURRENT) return;
    const sect = (label, sel, suffix) => {
      const items = $$(sel).filter(el => !el.closest('[hidden]') && !el.hidden);
      if (!items.length) return '';
      return `<div class="h">${label} <span style="opacity:.6">${items.length}</span></div>` +
        items.map(el => {
          const name = (el.querySelector('.cpx, td.n, .id') || el).textContent.trim()
            .replace(/\(.*$/, '');
          return `<a href="#${esc(el.id)}">${esc(name)}${suffix}</a>`;
        }).join('');
    };
    rail.innerHTML = sect('Properties', 'tbody tr[id^="p-"]', '')
      + sect('Events', 'tbody tr[id^="e-"]', '')
      + sect('Methods', '.mem[id^="m-"]', '()');
  }

  /* nav.js liegt als <script> vor dieser Datei — kein fetch, damit der
     Offline-Download auch ueber file:// funktioniert. */
  if (window.__NAV) { NAV = window.__NAV; buildNav(); }

  /* ---------- Volltextsuche ----------
     Namenssuche als Standard; "?" oder mehrere Woerter durchsuchen zusaetzlich
     die Beschreibungen. Bezeichner enthalten nie ein Leerzeichen, deshalb ist
     ein zweites Wort ein sicheres Signal fuer Prosa. */
  const KIND = ['object', 'prop', 'event', 'method'];
  let IDX = null, hits = [], sel = 0;
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="pal">
    <input id="pq" type="search" placeholder="Name to jump to — or ? / several words to search descriptions"
      spellcheck="false" autocomplete="off">
    <div class="res"></div>
    <div class="palfoot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span>
      <span><kbd>esc</kbd> close</span><span><kbd>?</kbd> full text</span>
      <span style="margin-left:auto" class="rescount"></span></div></div>`;
  document.body.appendChild(scrim);
  const pq = $('#pq', scrim), res = $('.res', scrim), rescount = $('.rescount', scrim);

  function parseQuery(raw) {
    const s = raw.trim();
    if (s.startsWith('?'))
      return { full: true, terms: s.slice(1).trim().toLowerCase().split(/\s+/).filter(Boolean) };
    const terms = s.toLowerCase().split(/\s+/).filter(Boolean);
    return { full: terms.length > 1, terms };
  }
  function snippet(text, term) {
    if (!text) return '';
    const i = text.toLowerCase().indexOf(term);
    if (i < 0) return esc(text.slice(0, 120));
    const from = Math.max(0, i - 45);
    return (from ? '…' : '') + esc(text.slice(from, i)) + '<b>' + esc(text.substr(i, term.length))
      + '</b>' + esc(text.slice(i + term.length, i + term.length + 75));
  }
  function search() {
    if (!IDX) return;
    const { full, terms } = parseQuery(pq.value);
    const q = terms[0] || '';
    hits = [];
    if (terms.length) {
      const scored = [];
      for (const e of IDX) {
        const [kind, cls, name] = e;
        if (runtime === 'uxp' && kind === 3 && name === '[]') continue;
        const lname = name.toLowerCase();
        if (full) {
          const hay = (cls + ' ' + name + ' ' + (e[3] || '')).toLowerCase();
          let ok = true;
          for (const t of terms) if (!hay.includes(t)) { ok = false; break; }
          if (!ok) continue;
          scored.push([(lname.includes(q) ? 0 : 500) + (kind === 0 ? 0 : 10) + name.length, e]);
        } else {
          const i = lname.indexOf(q);
          if (i < 0) continue;
          scored.push([(i === 0 ? 0 : 100) + (kind === 0 ? 0 : 10) + name.length + i, e]);
        }
      }
      scored.sort((a, b) => a[0] - b[0]);
      hits = scored.slice(0, 50).map(x => x[1]);
      rescount.textContent = scored.length.toLocaleString() +
        (full ? ' in descriptions' : ' of ' + IDX.length.toLocaleString());
    } else rescount.textContent = '';
    sel = 0;
    res.innerHTML = hits.map(([kind, cls, name, d], i) => {
      const at = name.toLowerCase().indexOf(q);
      const nm = at < 0 ? esc(name)
        : esc(name.slice(0, at)) + '<b>' + esc(name.slice(at, at + q.length)) + '</b>' +
          esc(name.slice(at + q.length));
      const label = kind === 0 ? nm : `<em>${esc(cls)}.</em>${nm}${kind === 3 ? '()' : ''}`;
      return `<div class="r ${i === sel ? 'sel' : ''}" data-i="${i}">
        <span class="t k${kind}">${KIND[kind]}</span><span class="n">${label}</span>
        <span class="d">${full ? snippet(d, q) : esc(d || '')}</span></div>`;
    }).join('');
    $$('.r', res).forEach(r => {
      r.addEventListener('mouseenter', () => { sel = +r.dataset.i; mark(); });
      r.addEventListener('click', pick);
    });
  }
  const mark = () => $$('.r', res).forEach((r, i) => r.classList.toggle('sel', i === sel));
  function pick() {
    const e = hits[sel];
    if (!e) return;
    const [kind, cls, name] = e;
    const frag = kind === 1 ? '#p-' + name : kind === 2 ? '#e-' + name : kind === 3 ? '#m-' + name : '';
    location.href = page(cls) + frag;
  }
  /* Der Suchindex ist ~3 MB und wird erst beim ersten Oeffnen der Palette geholt.
     Als <script>-Element statt per fetch, damit es auch aus dem Offline-Ordner
     ueber file:// laedt. */
  let idxLoading = false;
  function loadIndex(then) {
    if (IDX) return then();
    if (idxLoading) return;
    idxLoading = true;
    const s = document.createElement('script');
    /* liegt neben der Seite im Ordner der Bibliothek, nicht unter assets/ */
    s.src = 'search.js';
    s.onload = () => { IDX = window.__SEARCH || []; then(); };
    s.onerror = () => { idxLoading = false; rescount.textContent = 'search index unavailable'; };
    document.head.appendChild(s);
  }
  function openPal(prefill) {
    scrim.classList.add('on');
    pq.value = prefill || '';
    loadIndex(search);
    pq.focus();
  }
  const closePal = () => scrim.classList.remove('on');

  const kbtn = $('[data-enhance="search"]');
  if (kbtn) { kbtn.hidden = false; kbtn.addEventListener('click', () => openPal()); }
  scrim.addEventListener('click', e => { if (e.target === scrim) closePal(); });
  pq.addEventListener('input', search);
  const inField = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
  addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPal(); return; }
    if (!scrim.classList.contains('on') && !inField(e.target)) {
      if (e.key === '?') { e.preventDefault(); openPal('?'); return; }
      if (e.key === '/') { e.preventDefault(); openPal(); return; }
    }
    if (!scrim.classList.contains('on')) return;
    if (e.key === 'Escape') closePal();
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, hits.length - 1); mark(); res.children[sel] && res.children[sel].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); res.children[sel] && res.children[sel].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(); }
  });

  applyRuntime();
  buildRail();
})();
