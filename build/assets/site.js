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
    /* Hell ist der Standard, dunkel wird ausdruecklich gesetzt. */
    const dark = document.documentElement.dataset.t === 'dark';
    tg.textContent = dark ? 'light mode' : 'dark mode';
    tg.setAttribute('aria-label', 'Switch to ' + (dark ? 'light' : 'dark') + ' mode');
  }
  if (tg) {
    tg.hidden = false;
    labelTheme();
    tg.addEventListener('click', () => {
      const next = document.documentElement.dataset.t === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.t = next;
      store.set('theme', next);
      labelTheme();
    });
  }

  /* ---------- Zoom ----------
     --fs ist der Zoom auf :root und skaliert die ganze Seite. Gesetzt wird er
     schon vom Inline-Skript im <head>, hier kommen nur die Knoepfe dazu.
     BASE ist die 100%-Stufe und steht ebenso als --fs im Stylesheet, damit
     ohne JavaScript dasselbe gilt. Die Stufen sind relativ dazu, die
     Beschriftung auch: "100%" bedeutet zoom 1.15. */
  const BASE = 1.15;
  const STEPS = [0.85, 1, 1.15, 1.3, 1.5];
  const zoomOf = step => Math.round(BASE * step * 1000) / 1000;
  /* Setzen die Bloecke weiter unten. Zoomen aendert die nutzbare Kopfbreite und
     die Hoehe der Filterzeile, loest aber kein resize aus — beides muss hier
     mitgezogen werden. */
  let fitTrail = null;
  let refreshSticky = null;
  const fsBox = $('[data-enhance="fontsize"]');
  if (fsBox) {
    const lvl = $('.lvl', fsBox);
    const buttons = $$('button', fsBox);
    /* Auf die naechstgelegene Stufe einrasten, falls jemand einen krummen Wert
       im Speicher hat — etwa aus einer Fassung mit anderer Basis. */
    const stored = parseFloat(store.get('fs', String(BASE))) / BASE;
    let i = STEPS.indexOf(STEPS.reduce((a, b) =>
      Math.abs(b - stored) < Math.abs(a - stored) ? b : a, STEPS[1]));

    function applyFs() {
      document.documentElement.style.setProperty('--fs', zoomOf(STEPS[i]));
      if (lvl) lvl.textContent = Math.round(STEPS[i] * 100) + '%';
      buttons.forEach(b => {
        b.disabled = b.dataset.f === '-' ? i === 0 : i === STEPS.length - 1;
      });
      fsBox.title = 'Text size ' + Math.round(STEPS[i] * 100) + '%';
      if (fitTrail) fitTrail();
      if (refreshSticky) refreshSticky();
    }
    buttons.forEach(b => b.addEventListener('click', () => {
      i = Math.min(STEPS.length - 1, Math.max(0, i + (b.dataset.f === '+' ? 1 : -1)));
      /* Gespeichert wird der wirkliche Zoom, denn genau den setzt das
         Inline-Skript im <head> beim naechsten Seitenaufruf. */
      store.set('fs', String(zoomOf(STEPS[i])));
      applyFs();
    }));
    applyFs();
    fsBox.hidden = false;
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
    /* Deckt beides ab: ganze Member (die []-Methoden) und einzelne
       Typangaben, die nur unter ExtendScript gelten (File als Event-Handler). */
    $$('[data-uxp="hide"]').forEach(el => { el.hidden = uxp; });
    /* Verweise in die Kern-JavaScript-Bibliothek stimmen unter UXP nicht mehr.
       Wo es ein richtiges Ziel gibt, zeigt der Link dorthin — Adobes
       UXP-Referenz fuer File und Folder, MDN fuer die Standardklassen. Das
       urspruengliche Ziel bleibt in data-es-href, damit das Zurueckschalten
       stimmt. */
    $$('a[data-uxp-href]').forEach(a => {
      if (!a.dataset.esHref) a.dataset.esHref = a.getAttribute('href');
      a.setAttribute('href', uxp ? a.dataset.uxpHref : a.dataset.esHref);
      a.title = !uxp ? ''
        : /developer\.adobe\.com/.test(a.dataset.uxpHref)
          ? 'UXP: a different API with the same name'
          : 'UXP uses the standard JavaScript class';
    });
    /* Und wo es keins gibt, wird der Link abgeschaltet: ein <a> ohne href ist
       kein Link mehr und auch nicht mehr per Tastatur erreichbar. */
    $$('a[data-uxp="off"]').forEach(a => {
      if (!a.dataset.esHref) a.dataset.esHref = a.getAttribute('href');
      if (uxp) {
        a.removeAttribute('href');
        a.title = 'Not available in UXP';
      } else {
        a.setAttribute('href', a.dataset.esHref);
        a.title = '';
      }
    });
    /* Hinweise, die nur eine Laufzeit betreffen — am Objekt (.warn) wie an
       einzelnen Zeilen (.mwarn). */
    $$('[data-only]').forEach(el => {
      el.hidden = el.dataset.only !== runtime;
    });
    /* Die Zahl steht nur noch auf der Pille — in der Ueberschrift war sie
       doppelt und damit Rauschen. */
    const shown = $$('.mem').filter(el => !el.hidden).length;
    const mp = $('.pill[data-o="m"]');
    /* Nur den Text vor dem Kuerzel ersetzen — textContent loeschte das <kbd>
       mit, und die Methodenpille stand danach ohne ihr M da. */
    if (mp && mp.firstChild) mp.firstChild.nodeValue = 'Methods ' + shown;
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

  /* ---------- Zuletzt besucht ----------
     Die fuenf zuvor geoeffneten Objekte, neuestes zuerst; die aktuelle Seite
     steht nicht darin, sie ist ja schon offen. Wieviele davon wirklich zu sehen
     sind, entscheidet fitTrail() nach dem Platz in der Kopfzeile.

     Eine Liste ueber alle Objektmodelle: der Weg von Document zu String fuehrt
     ueber die Bibliotheksgrenze, und genau dorthin will man auch zurueck.
     Gleichnamige Objekte verschiedener Modelle stehen unbeschriftet
     nebeneinander — welches gemeint ist, zeigt die Statusleiste beim Zeigen
     auf den Link. */
  const trail = $('[data-enhance="trail"]');
  if (trail) {
    const HERE = document.body.dataset.target || '';
    let seen;
    try { seen = JSON.parse(store.get('recent', '[]')); } catch (e) { seen = null; }
    if (!Array.isArray(seen)) seen = [];
    /* Gespeichert wird [slug, name]; nach Ziel UND Name aussortieren, damit
       gleichnamige Objekte verschiedener Modelle nebeneinander bestehen. */
    seen = seen.filter(e => Array.isArray(e) && typeof e[0] === 'string' &&
      typeof e[1] === 'string' && !(e[0] === HERE && e[1] === CURRENT));

    if (CURRENT) store.set('recent', JSON.stringify([[HERE, CURRENT]].concat(seen).slice(0, 12)));
    const prev = seen.slice(0, 5);
    if (prev.length) {
      /* Trenner als eigene Elemente, nicht als ::before im Link: sonst gehoerte
         der Strich zur Klickflaeche und wuerde beim Kuerzen mit abgeschnitten. */
      trail.innerHTML = '<span class="h">Recent</span>' + prev.map(([slug, n]) => {
        const href = slug === HERE ? page(n)
          : '../' + encodeURIComponent(slug) + '/' + page(n);
        return `<a href="${href}" title="${esc(n)}">${esc(n)}</a>`;
      }).join('<span class="sep">|</span>');
      trail.hidden = false;

      /* Ungekuerzte Namen sind der Sinn der Spur. Passt der aelteste nicht mehr
         ganz hinein, faellt er weg — sonst schrumpfen alle fuenf gleichmaessig
         und aus "Page" wird "Pa…". Wieviel Platz noetig ist, haengt an den
         besuchten Objekten (AutoCorrectPreference braucht das Fuenffache von
         Page), deshalb wird gemessen statt nach Fensterbreite geschaltet. */
      const glieder = [...trail.children].filter(e => e.tagName === 'A' ||
        e.classList.contains('sep'));
      /* Alles in Layout-Pixeln (offsetWidth, clientWidth, scrollWidth).
         getBoundingClientRect rechnet den Zoom mit ein, computed styles nicht —
         gemischt ergibt das unter A+ falsche Breiten. */
      fitTrail = () => {
        glieder.forEach(e => e.classList.remove('gone'));
        const namen = glieder.filter(e => e.tagName === 'A');
        /* Steht kein Name beschnitten da, passt alles und es ist nichts zu tun.
           Die Frage laesst sich nur an den Namen stellen, nicht an der Spur:
           die Flexbox staucht ihre Kinder, statt sie ueberlaufen zu lassen —
           scrollWidth und clientWidth der Spur sind deshalb immer gleich. */
        if (!namen.some(a => a.scrollWidth > a.clientWidth + 2)) return;

        const stil = getComputedStyle(trail);
        const luecke = parseFloat(stil.columnGap || stil.gap) || 9;
        const kappe = parseFloat(getComputedStyle(glieder[0]).maxWidth) || Infinity;
        /* Mit allen Eintraegen sichtbar ist clientWidth genau der Platz, den die
           Flexbox der Spur zugesteht: laeuft der Inhalt ueber, die Zuteilung,
           sonst die Inhaltsbreite — und dann muss ohnehin nichts weichen. */
        /* 4 px Rundungsreserve: offsetWidth und scrollWidth sind ganzzahlig,
           die Summe faellt dadurch bis zu einigen Pixeln zu knapp aus. */
        const raum = trail.clientWidth - 4;
        const marke = trail.querySelector('.h');
        const trenner = glieder.find(e => e.classList.contains('sep'));
        /* Die Trenner ziehen sich mit negativen Raendern an die Namen heran —
           ohne die faellt der fuenfte Eintrag weg, obwohl er passt. */
        const sepStil = trenner && getComputedStyle(trenner);
        const sepBreit = trenner ? trenner.offsetWidth +
          parseFloat(sepStil.marginLeft) + parseFloat(sepStil.marginRight) : 8;

        /* Von neu nach alt aufnehmen, solange der naechste Name ganz hineinpasst.
           Der erste bleibt immer stehen, auch wenn er dafuer gekuerzt wird. */
        let breit = marke ? marke.offsetWidth : 0, passt = 0;
        for (const a of namen) {
          const dazu = Math.min(a.scrollWidth, kappe) + luecke +
            (passt ? sepBreit + luecke : 0);
          if (passt && breit + dazu > raum) break;
          breit += dazu;
          passt++;
        }

        let n = 0;
        for (const e of glieder) {
          if (e.tagName === 'A') { if (++n > passt) e.classList.add('gone'); }
          else if (n >= passt) e.classList.add('gone');
        }
      };
      fitTrail();
      let t = 0;
      addEventListener('resize', () => {
        clearTimeout(t);
        t = setTimeout(fitTrail, 120);
      });
    }
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
  /* Tabellen oder Liste. Die Wahl gilt weiter, wenn man zum naechsten Objekt
     blaettert — wer die Liste zum Navigieren nutzt, will sie ueberall. Ein
     Deep-Link auf einen Member gewinnt aber: sonst zeigte die Seite die Liste,
     waehrend die Adresse auf eine Zeile in der Tabelle deutet. */
  let mode = location.hash ? 'table' : store.get('mode', 'table');

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
    $$('.pill[data-o]', bar).forEach(p => p.classList.toggle('on', p.dataset.o === only));
    applyMode();
  }

  /* ---------- Listenansicht ----------
     Statt der Tabellen alle Member als Verweise, mehrspaltig: ein Objekt mit
     341 Membern passt so auf einen Blick, und ein Klick fuehrt zurueck in die
     Tabelle an die richtige Stelle. Loest die frueher rechts stehende Spalte
     ab — die nahm dauerhaft Platz und zeigte dasselbe. */
  function buildList(box) {
    /* Der Typ steht mit dabei — er ist die zweite Frage nach dem Namen und
       kostet in der Liste nur ein paar Zeichen. Bei Properties die Typspalte,
       bei Methoden der Rueckgabetyp ohne den Pfeil; Events haben keinen. */
    const typVon = el => {
      const t = el.querySelector('td.t, .ret');
      if (!t) return '';
      /* Ohne die Wertechips: sonst steht in der Liste
         "RepaginateOptionNEXT_EVEN_PAGENEXT_ODD_PAGE…" statt des Typnamens.
         Ausgeblendetes zaehlt textContent mit — der async-Chip stuende sonst
         auch unter ExtendScript in der Liste. */
      const kopie = t.cloneNode(true);
      kopie.querySelectorAll('.vals, [hidden]').forEach(v => v.remove());
      const s = kopie.textContent.replace(/[→\s]+/g, ' ').trim();
      return s && s !== '—' ? ` <i>${esc(s)}</i>` : '';
    };
    const teil = (label, sel, suffix) => {
      const items = $$(sel).filter(el => !el.closest('[hidden]') && !el.hidden);
      if (!items.length) return '';
      return `<div class="h">${label} <span class="n">${items.length}</span></div>` +
        '<div class="cols">' + items.map(el => {
          const name = (el.querySelector('.cpx, td.n, .id') || el).textContent.trim()
            .replace(/\(.*$/, '');
          return `<a href="#${esc(el.id)}">${esc(name)}${suffix}${typVon(el)}</a>`;
        }).join('') + '</div>';
    };
    box.innerHTML = teil('Properties', 'tbody tr[id^="p-"]', '')
      + teil('Events', 'tbody tr[id^="e-"]', '')
      + teil('Methods', '.mem[id^="m-"]', '()');
    if (!box.innerHTML) box.innerHTML = '<div class="h">Nothing matches the filter</div>';
  }

  /* Sichtbar ist entweder die Liste oder die Tabellen — nie beides. Die
     Rueckwaertsverweise darunter bleiben in beiden Ansichten stehen. */
  function applyMode() {
    const box = $('[data-enhance="list"]');
    if (!box) return;
    const alsListe = mode === 'list';
    if (alsListe) {
      buildList(box);
      $$('section[data-sec]').forEach(s => { s.hidden = true; });
    }
    box.hidden = !alsListe;
    const pille = $('.pill[data-mode="list"]', bar);
    if (pille) pille.classList.toggle('on', alsListe);
  }

  /* Umschalten mitten in einer langen Tabelle: die Liste ist kuerzer und
     beginnt weit ueber dem Sichtfeld — ohne den Sprung sieht man nur den
     Fussbereich und muss hochscrollen. Nur wenn sie wirklich oberhalb liegt,
     sonst rutschte die Seite beim Umschalten vom Anfang weg. */
  function zeigeAnsicht() {
    const box = $('[data-enhance="list"]');
    const ziel = mode === 'list' ? box : $('section[data-sec]:not([hidden])');
    if (!ziel || !bar) return;
    if (ziel.getBoundingClientRect().top < bar.getBoundingClientRect().bottom)
      ziel.scrollIntoView({ block: 'start' });
  }

  function toggleListe() {
    mode = mode === 'list' ? 'table' : 'list';
    store.set('mode', mode);
    applyFilter();
    zeigeAnsicht();
  }

  /* Wie weit ein Sprungziel unter dem Seitenanfang beginnen muss, damit es
     nicht unter der klebenden Filterzeile liegt. offsetHeight, nicht
     getBoundingClientRect: gebraucht wird die Hoehe in Layout-Pixeln, denn
     --sticky wird als CSS-Wert wieder mit dem Zoom skaliert. */
  function stickyOffset() {
    if (!bar || bar.hidden) return;
    /* Gerechnet wird mit der Hoehe im klebenden Zustand: dort ist die Leiste
       um die Namenszeile hoeher, und genau dann wird gesprungen. Ohne den
       Zuschlag landete das Ziel 30 px zu hoch, also unter der Leiste. */
    const namerow = parseFloat(getComputedStyle(bar).getPropertyValue('--namerow')) || 0;
    const hoch = bar.offsetHeight + (bar.classList.contains('stuck') ? 0 : namerow);
    document.documentElement.style.setProperty('--sticky', (44 + hoch + 6) + 'px');

  }

  if (bar) {
    bar.hidden = false;
    /* Der Objektname erscheint erst, wenn die Leiste wirklich klebt: am
       Seitenanfang stuende er doppelt da, direkt unter der Ueberschrift.
       Ein nullhoher Waechter vor der Leiste beantwortet die Frage ohne
       Scroll-Handler; der Rand von 45 px ist die Hoehe der Kopfzeile plus
       einem Pixel, damit der Wechsel genau am Anschlag stattfindet. */
    const watch = $('.barwatch');
    if (watch && window.IntersectionObserver) {
      new IntersectionObserver(([e]) => {
        bar.classList.toggle('stuck', !e.isIntersecting);
      }, { rootMargin: '-45px 0px 0px 0px', threshold: 0 }).observe(watch);
    }
    refreshSticky = stickyOffset;
    stickyOffset();
    let st = 0;
    addEventListener('resize', () => {
      clearTimeout(st);
      st = setTimeout(stickyOffset, 120);
    });
    $('#f', bar).addEventListener('input', applyFilter);
    /* Escape raeumt das Feld und gibt die Tastatur wieder an die Seite. */
    $('#f', bar).addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.target.value = '';
      applyFilter();
      e.target.blur();
    });
    $$('.pill[data-o]', bar).forEach(p => p.addEventListener('click', () => {
      only = p.dataset.o;
      /* Eine Pille waehlt die Memberart — dafuer muessen die Tabellen sichtbar
         sein. In der Liste wirkt sie trotzdem: sie filtert deren Abschnitte. */
      applyFilter();
    }));
    const modePille = $('.pill[data-mode="list"]', bar);
    if (modePille) modePille.addEventListener('click', () => {
      mode = mode === 'list' ? 'table' : 'list';
      store.set('mode', mode);
      applyFilter();
    });
    /* Ein Sprung auf einen Member — aus der Palette, aus einem Link auf der
       Seite oder aus der Adresszeile — braucht die Tabelle. Innerhalb
       derselben Seite laedt nichts neu, die Wahl beim Seitenaufbau greift dort
       also nicht. */
    addEventListener('hashchange', () => {
      if (!location.hash || mode !== 'list') return;
      mode = 'table';
      store.set('mode', mode);
      applyFilter();
      const ziel = document.querySelector(location.hash);
      if (ziel) ziel.scrollIntoView({ block: 'start' });
    });
    /* Ein Klick in der Liste fuehrt zurueck in die Tabelle, an die Stelle des
       Members. Der Sprung braucht scrollIntoView statt nur der Adresse: steht
       dort schon dieselbe Marke, scrollt der Browser kein zweites Mal. */
    const box = $('[data-enhance="list"]');
    if (box) box.addEventListener('click', e => {
      const a = e.target.closest('a');
      if (!a) return;
      e.preventDefault();
      const ziel = document.querySelector(a.getAttribute('href'));
      mode = 'table';
      store.set('mode', mode);
      applyFilter();
      history.replaceState(null, '', a.getAttribute('href'));
      if (ziel) ziel.scrollIntoView({ block: 'start' });
    });
  }

  /* ---------- Navigationsliste ----------
     Nicht in jede Seite gerendert: 1153 Eintraege waeren ~70 KB pro Seite. */
  let NAV = null;
  let navQuery = store.get('navq', '');
  function buildNav() {
    const side = $('.side');
    const list = $('.sidelist');
    if (!side || !list || !NAV) return;
    const q = navQuery.trim().toLowerCase();
    const vis = q ? NAV.filter(([n]) => n.toLowerCase().indexOf(q) !== -1) : NAV;
    const group = (title, kind) => {
      const all = NAV.filter(([, k]) => k === kind);
      const hit = vis.filter(([, k]) => k === kind);
      if (!hit.length) return '';
      /* Beim Filtern beide Zahlen zeigen — eine kurze Liste soll sich
         selbst erklaeren, ohne dass man das Eingabefeld absucht. */
      const n = q ? hit.length + ' <span class="of">/ ' + all.length + '</span>' : all.length;
      return `<div class="h">${title} · ${n}</div>` + hit.map(([nm, k, cnt]) =>
        `<a href="${esc(page(nm))}" class="${nm === CURRENT ? 'on' : ''}${
          k === 2 ? ' e' : k === 1 ? ' co' : ''}"><span>${esc(nm)}</span><i>${
          k === 2 ? 'enum' : k === 1 ? 'coll' : cnt}</i></a>`).join('');
    };
    list.innerHTML = vis.length
      ? group('Objects', 0) + group('Collections', 1) + group('Enumerations', 2)
      : '<p class="none">Nothing matches “' + esc(navQuery.trim()) + '”.</p>';

    const allLink = $('.allobjects', side);
    if (allLink) allLink.hidden = true;   /* die vollstaendige Liste steht jetzt darunter */
    /* Erst hier einschalten, nicht schon beim Verdrahten: ohne geladene Liste
       waere das Feld ein Bedienelement ohne Wirkung. */
    const box = $('[data-enhance="navfilter"]');
    if (box) box.hidden = false;

    /* scrollTop direkt setzen statt scrollIntoView: letzteres scrollt auch das
       Fenster mit und schiebt die Kopfzeile der Seite unter die Leiste.
       Beim Filtern nach oben, sonst sucht man den Anfang der Treffer. */
    const on = $('a.on', list);
    side.scrollTop = on && !q ? Math.max(0, on.offsetTop - side.clientHeight / 2) : 0;
  }

  /* ---------- Filter der Objektspalte ----------
     Wirkt nur auf die linke Liste, nicht auf die Member der Seite — das macht
     das Feld ueber den Tabellen. Der Begriff bleibt erhalten, damit ein Weg
     durch mehrere Text*-Objekte nicht bei jedem Klick von vorn beginnt; sichtbar
     bleibt er im Feld und in der Zahl neben der Ueberschrift. */
  const nf = $('#nf');
  if (nf) {
    nf.value = navQuery;
    nf.addEventListener('input', () => {
      navQuery = nf.value;
      store.set('navq', navQuery);
      buildNav();
    });
    nf.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();          /* nicht die Suchpalette mitschliessen */
      nf.value = ''; navQuery = ''; store.set('navq', '');
      buildNav();
      /* Fokus zurueck an die Seite, sonst tippt das naechste F oder O in
         dieses Feld statt zu springen. */
      nf.blur();
    });
  }

  /* ---------- rechte Spalte ---------- */

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
      /* F springt in den Memberfilter dieser Seite, O in den der Objektliste.
         Modifikatoren bleiben dem Browser: Strg+F ist seine Suche und darf
         nicht abgefangen werden. */
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        /* L schaltet zwischen Tabellen und Liste, A/P/E/M waehlen die
           Memberart — dieselben Buchstaben, die auf den Pillen stehen. Eine
           Pille, die es auf dieser Seite nicht gibt (kein Event), tut nichts:
           sonst blendete die Taste den ganzen Inhalt aus. */
        if (e.key === 'l' && bar) {
          e.preventDefault();
          toggleListe();
          return;
        }
        const art = { a: 'all', p: 'p', e: 'e', m: 'm' }[e.key];
        if (art && bar && $('.pill[data-o="' + art + '"]', bar)) {
          e.preventDefault();
          only = art;
          applyFilter();
          zeigeAnsicht();
          return;
        }
        const ziel = e.key === 'f' ? (bar && $('#f', bar)) : e.key === 'o' ? $('#nf') : null;
        if (ziel && ziel.offsetParent) {
          e.preventDefault();
          ziel.focus();
          ziel.select();
          return;
        }
      }
    }
    if (!scrim.classList.contains('on')) return;
    if (e.key === 'Escape') closePal();
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, hits.length - 1); mark(); res.children[sel] && res.children[sel].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); res.children[sel] && res.children[sel].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(); }
  });

  applyRuntime();
})();
