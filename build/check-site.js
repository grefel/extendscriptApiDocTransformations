/* Prueft die generierte Website im echten Browser: statischer Inhalt ohne
   JavaScript, danach dieselben Seiten mit aktiviertem Skript. */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium, firefox } = require('playwright');

const ROOT = path.join(__dirname, '..');
const SITE = process.env.OUT_DIR || path.join(ROOT, 'site');
const url = f => 'file:///' + path.join(SITE, f).replace(/\\/g, '/');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

const results = [];
const check = (name, got, want) => {
  const ok = String(got) === String(want);
  results.push((ok ? 'PASS ' : 'FAIL ') + name.padEnd(48) + got + (ok ? '' : '   (erwartet ' + want + ')'));
  return ok;
};

(async () => {
  if (!fs.existsSync(path.join(SITE, 'index.html'))) {
    console.error('Keine Website unter ' + SITE + ' — erst "npm run build".');
    process.exit(2);
  }

  let browser;
  try { browser = await chromium.launch({ channel: 'chrome' }); }
  catch (e) { browser = await chromium.launch(); }

  /* ---------- ohne JavaScript ---------- */
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const p0 = await noJs.newPage();
  await p0.goto(url('indesign/Rectangle.html'));
  check('ohne JS: Titel steht im Markup', await p0.locator('h1').innerText(), 'Rectangle');
  check('ohne JS: Properties gerendert', await p0.locator('tbody tr[id^="p-"]').count(), 126);
  check('ohne JS: Events gerendert', await p0.locator('tbody tr[id^="e-"]').count(), 2);
  check('ohne JS: Methoden gerendert', await p0.locator('.mem').count(), 60);
  /* innerText setzt im Flex-Layout Zeilenumbrueche zwischen die Glieder */
  check('ohne JS: Vererbung sichtbar',
    (await p0.locator('.chain').innerText()).split(/\s+/).filter(Boolean).join(' '),
    'PageItem › SplineItem › Rectangle');
  check('ohne JS: Rueckwaertsverweise da',
    (await p0.locator('.rev').count()) >= 2, true);
  check('ohne JS: Footer vollstaendig',
    /Adobe Inc\..*Built from/s.test(await p0.locator('footer').innerText()), true);
  check('ohne JS: Bedienelemente ausgeblendet',
    await p0.locator('[data-enhance]:not([hidden])').count(), 0);
  check('ohne JS: Navigation zum Index moeglich',
    await p0.locator('a[href="index.html"]').count() > 0, true);
  await noJs.close();

  /* ---------- mit JavaScript ---------- */
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(url('indesign/Rectangle.html'));
  await page.waitForSelector('.side a.on', { timeout: 10000 });
  /* Genau die Objekte des Produkts — ScriptUI und Kern-JavaScript sind eigene
     Bibliotheken und tauchen hier nicht mehr auf. */
  /* .sidelist, nicht .side: darin steht zusaetzlich der Notnagel-Link
     "All entries →", den das Skript nur verbirgt. */
  check('mit JS: Seitenleiste nachgeladen',
    await page.locator('.sidelist a').count(), 1097);
  check('mit JS: Notnagel-Link verborgen',
    await page.locator('.allobjects').isVisible(), false);
  check('mit JS: aktuelle Seite markiert',
    (await page.locator('.side a.on').innerText()).split(/\s+/).filter(Boolean).join(' '), 'Rectangle 188');
  check('mit JS: rechte Spalte gefuellt',
    (await page.locator('.rail2 a').count()) > 100, true);
  /* Die Seitenleiste darf beim Positionieren nicht das Fenster mitscrollen,
     sonst verschwindet die Kopfzeile der Seite unter der Leiste. */
  check('mit JS: Fenster bleibt oben', await page.evaluate(() => window.scrollY), 0);
  check('mit JS: Objektart sichtbar',
    await page.evaluate(() => Math.round(document.querySelector('.kind').getBoundingClientRect().top) >= 44),
    true);
  /* Die Spur ist der einzige data-enhance-Knoten, der auch mit JS verborgen
     bleiben darf: ohne Verlauf gaebe es nur eine leere Beschriftung. */
  check('mit JS: Bedienelemente sichtbar',
    await page.locator('[data-enhance][hidden]:not(.trail)').count(), 0);
  check('mit JS: Spur ohne Verlauf bleibt aus',
    await page.locator('.trail[hidden]').count(), 1);

  /* Kopieren */
  check('Property kopiert nackt',
    await page.locator('tr#p-absoluteFlip .cpx').getAttribute('data-cp'), 'absoluteFlip');
  check('Event kopiert qualifiziert',
    await page.locator('tr#e-AFTER_PLACE .cpx').getAttribute('data-cp'), 'Rectangle.AFTER_PLACE');
  check('Methode kopiert mit ()',
    await page.locator('#m-duplicate .cpx').getAttribute('data-cp'), 'duplicate()');

  /* Textfilter */
  await page.fill('#f', 'corner');
  await page.waitForTimeout(200);
  const visible = await page.locator('tbody tr:not([hidden])').count();
  check('Filter reduziert die Tabelle', visible > 0 && visible < 126, true);
  await page.fill('#f', '');
  await page.waitForTimeout(200);

  /* Umschalter je Membertyp */
  /* Zahlen stehen nur auf den Pillen, nicht doppelt in den Ueberschriften.
     innerText liefert die Ueberschriften per CSS in Grossbuchstaben zurueck. */
  check('Ueberschriften ohne Zahl',
    (await page.locator('#properties').innerText()).trim().toLowerCase(), 'properties');
  check('Methoden-Ueberschrift ohne Zahl',
    (await page.locator('#methods').innerText()).trim().toLowerCase(), 'methods');
  check('Pills vorhanden', await page.locator('.bar .pill').count(), 4);
  /* Nicht nur die Klasse pruefen: die .pill-Regeln fehlten anfangs im
     Stylesheet, die aktive Pille sah dadurch aus wie ein Standardknopf. */
  const pillStyle = await page.evaluate(() => {
    const on = document.querySelector('.bar .pill.on');
    const off = document.querySelector('.bar .pill:not(.on)');
    const bg = e => getComputedStyle(e).backgroundColor;
    return { on: bg(on), off: bg(off), same: bg(on) === bg(off) };
  });
  check('aktive Pille hebt sich ab', pillStyle.same, false);
  check('Pill-Beschriftungen',
    (await page.locator('.bar .pill').allInnerTexts()).map(s => s.trim()).join(' | '),
    'All | Properties 126 | Events 2 | Methods 60');
  await page.locator('.bar .pill[data-o="e"]').click();
  await page.waitForTimeout(200);
  check('nur Events sichtbar',
    (await page.locator('section[data-sec]:not([hidden])').count()), 1);
  check('sichtbarer Abschnitt ist Events',
    await page.locator('section[data-sec]:not([hidden])').getAttribute('data-sec'), 'e');
  check('Rueckwaertsverweise bleiben',
    (await page.locator('.rev:not([hidden])').count()) >= 2, true);
  check('rechte Spalte folgt dem Filter',
    (await page.locator('.rail2 a').count()), 2);
  await page.locator('.bar .pill[data-o="all"]').click();
  await page.waitForTimeout(200);
  check('zurueck auf alle Abschnitte',
    await page.locator('section[data-sec]:not([hidden])').count(), 3);

  /* Laufzeit-Umschalter auf einer Collection */
  await page.goto(url('indesign/Pages.html'));
  await page.waitForSelector('.side a.on', { timeout: 10000 });
  check('ExtendScript: Pages Methoden', await page.locator('.mem:not([hidden])').count(), 15);
  await page.click('.rt button[data-r="uxp"]');
  await page.waitForTimeout(250);
  check('UXP: Pages Methoden', await page.locator('.mem:not([hidden])').count(), 14);
  check('UXP: Zaehler auf der Pille',
    (await page.locator('.pill[data-o="m"]').innerText()).trim(), 'Methods 14');
  await page.click('.rt button[data-r="es"]');
  await page.waitForTimeout(250);

  /* Suche */
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(150);
  await page.fill('#pq', 'geometricBounds');
  await page.waitForTimeout(500);
  check('Suche findet Treffer', (await page.locator('.res .r').count()) > 0, true);
  await page.fill('#pq', '?deprecated');
  await page.waitForTimeout(400);
  check('Volltext findet Beschreibungen', (await page.locator('.res .r').count()) > 0, true);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  check('Enter navigiert auf eine Objektseite',
    /\.html/.test(page.url()) && !/Pages\.html$/.test(page.url()), true);

  /* Enum-Chips und Typverweise */
  await page.goto(url('indesign/Application.html'));
  await page.waitForSelector('.side a.on', { timeout: 10000 });
  check('Enum-Chip qualifiziert',
    await page.locator('tr#p-activeScriptUndoMode .vchip').first().getAttribute('data-cp'),
    'UndoModes.AUTO_UNDO');
  await page.goto(url('indesign/Document.html'));
  check('Collection verlinkt ihr Element',
    await page.locator('tr#p-pages td.t a[href="Page.html"]').count(), 1);
  check('Wertebereich angezeigt',
    (await page.locator('tr#p-tintValue .rngv').innerText()).replace(/\s/g, ''), '0–100');

  /* Footer */
  const footTxt = await page.locator('footer').innerText();
  check('Footer sagt Created with', /Created with/.test(footTxt), true);
  /* "Generated" soll nur einmal vorkommen — die Versionszeile sagt "Built from". */
  check('Footer ohne doppeltes Generated', (footTxt.match(/Generated/g) || []).length, 1);
  check('Footer nennt publishingX', /publishingX/.test(footTxt), true);
  check('Footer verlinkt LinkedIn',
    await page.locator('footer a[href*="linkedin"]').count(), 1);

  /* Index je Bibliothek */
  await page.goto(url('indesign/index.html'));
  check('Index listet alle InDesign-Objekte',
    (await page.locator('ul.grid li').count()), 1097);

  /* --- Produktumschalter und getrennte Bibliotheken --- */
  await page.goto(url('indesign/Rectangle.html'));
  await page.waitForSelector('.side a.on', { timeout: 10000 });
  check('Umschalter listet alle Bibliotheken',
    await page.locator('.prodmenu a').count(), 7);
  /* textContent statt innerText: im zugeklappten <details> ist der Inhalt
     nicht sichtbar und innerText liefert dann einen leeren String. */
  check('aktuelles Produkt markiert',
    (await page.locator('.prodmenu a.on span').first().textContent()).trim(), 'InDesign');
  /* Gleichnamiges Objekt drueben: Rectangle kennen auch Illustrator und Photoshop */
  check('Umschalter springt auf das gleichnamige Objekt',
    await page.locator('.prodmenu a[href="../illustrator/Rectangle.html"]').count(), 1);
  /* Bridge kennt kein Rectangle -> auf dessen Index statt ins Leere */
  check('sonst auf den Index des Ziels',
    await page.locator('.prodmenu a[href="../bridge/index.html"]').count(), 1);

  /* ScriptUI und JavaScript sind eigene Bibliotheken, nicht Teil eines Produkts */
  check('ScriptUI nicht mehr im Produkt',
    (await page.locator('.side a').allInnerTexts()).some(t => /SUI/.test(t)), false);
  await page.goto(url('scriptui/index.html'));
  check('ScriptUI hat eine eigene Bibliothek',
    (await page.locator('ul.grid li').count()), 34);
  await page.goto(url('javascript/index.html'));
  check('Core JavaScript hat eine eigene Bibliothek',
    (await page.locator('ul.grid li').count()), 22);
  /* Typen aus dem Produkt verweisen in die gemeinsame Bibliothek */
  await page.goto(url('indesign/Rectangle.html'));
  check('Produkttyp verlinkt in die JS-Bibliothek',
    (await page.locator('a[href^="../javascript/"]').count()) > 0, true);

  /* --- ExtendScript-only Bibliotheken: kein Laufzeit-Umschalter --- */
  for (const lib of ['javascript', 'scriptui']) {
    await page.goto(url(lib + '/index.html'));
    await page.waitForTimeout(200);
    check(lib + ': kein UXP-Umschalter', await page.locator('.rt').count(), 0);
    check(lib + ': als ExtendScript-only gekennzeichnet',
      /ExtendScript only/.test(await page.locator('.prod summary').textContent()), true);
  }

  /* --- Laufzeit-Umschalter tragen nur die beiden InDesign-Ziele --- */
  for (const slug of ['illustrator', 'photoshop', 'bridge']) {
    await page.goto(url(slug + '/index.html'));
    await page.waitForTimeout(200);
    check(slug + ': kein UXP-Umschalter', await page.locator('.rt').count(), 0);
  }
  await page.goto(url('indesign-server/index.html'));
  await page.waitForTimeout(200);
  check('indesign-server behaelt den Umschalter', await page.locator('.rt').count(), 1);
  await page.goto(url('indesign/Rectangle.html'));
  await page.waitForSelector('.side a.on', { timeout: 10000 });
  check('indesign behaelt den Umschalter', await page.locator('.rt').count(), 1);

  /* --- Hinweise, die nicht im Objektmodell stehen (build/notes.js) --- */
  await page.goto(url('indesign/XMLElements.html'));
  await page.waitForSelector('.sidelist a', { timeout: 10000 });
  check('XMLElements traegt den Hinweis', await page.locator('.warn').isVisible(), true);
  /* Der Hinweis behauptet, die Methode fehle — das muss stimmen. */
  check('itemByName fehlt dort wirklich',
    await page.locator('#m-itemByName').count(), 0);
  check('andere Collections haben itemByName',
    await (async () => {
      await page.goto(url('indesign/Pages.html'));
      await page.waitForTimeout(200);
      return page.locator('#m-itemByName').count();
    })(), 1);
  check('Hinweis steht nur dort',
    await page.locator('.warn').count(), 0);

  /* --- UXP: ein File als Event-Handler gibt es dort nicht ---
     Der Strich muss mit verschwinden, sonst begaenne die Zeile mit "|". */
  await page.goto(url('indesign/Document.html'));
  await page.waitForSelector('.sidelist a', { timeout: 10000 });
  const handler = () => page.locator('#m-addEventListener .arg').nth(1)
    .locator('.at').innerText();
  check('ExtendScript: File oder Funktion',
    (await handler()).trim(), 'File | JavaScriptFunction');
  await page.click('.rt button[data-r="uxp"]');
  await page.waitForTimeout(300);
  check('UXP: nur die Funktion', (await handler()).trim(), 'JavaScriptFunction');
  await page.click('.rt button[data-r="es"]');
  await page.waitForTimeout(250);
  check('und wieder beides', (await handler()).trim(), 'File | JavaScriptFunction');
  /* doScript fuehrt eine ExtendScript-Datei auch unter UXP aus — hier darf
     nichts verschwinden. */
  await page.goto(url('indesign/Application.html'));
  await page.waitForSelector('.sidelist a', { timeout: 10000 });
  await page.waitForTimeout(400);
  const doScriptArg = () => page.locator('#m-doScript .arg').first()
    .locator('.at').innerText();
  const before = (await doScriptArg()).trim();
  await page.click('.rt button[data-r="uxp"]');
  await page.waitForTimeout(300);
  check('doScript bleibt unberuehrt', (await doScriptArg()).trim(), before);
  await page.click('.rt button[data-r="es"]');
  await page.waitForTimeout(250);

  /* --- equals() statt == : nur an Enumerations, nur unter UXP --- */
  await page.goto(url('indesign/PathType.html'));
  await page.waitForSelector('.sidelist a', { timeout: 10000 });
  check('Enumeration: kein Hinweis unter ExtendScript',
    await page.locator('.warn').isVisible(), false);
  await page.click('.rt button[data-r="uxp"]');
  await page.waitForTimeout(300);
  check('Enumeration: Hinweis unter UXP',
    /equals\(\)/.test(await page.locator('.warn').innerText()), true);
  await page.click('.rt button[data-r="es"]');
  await page.waitForTimeout(250);
  /* Nicht an Objekten — dort waere er Rauschen. */
  await page.goto(url('indesign/Rectangle.html'));
  await page.waitForSelector('.sidelist a', { timeout: 10000 });
  check('kein equals-Hinweis an Objekten', await page.locator('.warn').count(), 0);

  /* --- UXP: File und Folder zeigen auf Adobes UXP-Referenz --- */
  await page.goto(url('indesign/Rectangle.html'));
  await page.waitForSelector('.sidelist a', { timeout: 10000 });
  const uxpLink = page.locator('a[data-uxp-href]').first();
  check('File verlinkt im ExtendScript-Modus die Klasse',
    await uxpLink.getAttribute('href'), '../javascript/File.html');
  await page.click('.rt button[data-r="uxp"]');
  await page.waitForTimeout(250);
  check('im UXP-Modus auf developer.adobe.com',
    /developer\.adobe\.com.*persistent-file-storage/.test(await uxpLink.getAttribute('href')),
    true);
  await page.click('.rt button[data-r="es"]');
  await page.waitForTimeout(250);
  check('und wieder zurueck', await uxpLink.getAttribute('href'), '../javascript/File.html');
  /* Ohne Laufzeit-Umschalter waere das Umhaengen eine leere Zusage. */
  await page.goto(url('illustrator/Document.html'));
  await page.waitForTimeout(250);
  check('Illustrator bekommt kein UXP-Ziel',
    await page.locator('a[data-uxp-href]').count(), 0);

  /* --- Startseite traegt dieselbe Kopfzeile --- */
  const headGeom = async f => {
    await page.goto(url(f));
    await page.waitForTimeout(300);
    return page.evaluate(() => {
      const r = s => {
        const e = document.querySelector(s);
        return e ? Math.round(e.getBoundingClientRect().top * 10) / 10 : null;
      };
      const right = s => {
        const e = document.querySelector(s);
        return e ? Math.round(e.getBoundingClientRect().right) : null;
      };
      return { logo: r('.logo'), fs: right('.fs'), tg: right('.tg') };
    });
  };
  const homeHead = await headGeom('index.html');
  const pageHead = await headGeom('indesign/index.html');
  check('Startseite hat die Zoomknoepfe', homeHead.fs !== null, true);
  /* Die Wortmarke sass auf der Startseite hoeher, weil dort das Suchfeld fehlt
     und damit die gemeinsame Grundlinie der Kopfzeile anders lag. */
  check('Wortmarke sitzt ueberall gleich', homeHead.logo, pageHead.logo);
  check('Zoom rechtsbuendig wie sonst', homeHead.fs, pageHead.fs);
  check('Themeknopf rechtsbuendig wie sonst', homeHead.tg, pageHead.tg);
  await page.goto(url('indesign/Rectangle.html'));
  await page.waitForSelector('.sidelist a', { timeout: 10000 });

  /* --- Theme: Hell ist der Standard --- */
  const scheme = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  /* Ohne gespeicherte Wahl setzt niemand data-t; es gilt die Palette auf
     :root. Genau so sieht es auch ohne JavaScript aus. */
  check('Standard ist hell, ohne data-t',
    await page.evaluate(() => document.documentElement.dataset.t || '(nicht gesetzt)'),
    '(nicht gesetzt)');
  check('hell: color-scheme hell', await scheme(), 'light');
  check('Themeknopf nennt das Ziel',
    (await page.locator('.tg').innerText()).trim(), 'dark mode');
  await page.click('.tg');
  await page.waitForTimeout(200);
  check('nach dem Umschalten umgekehrt',
    (await page.locator('.tg').innerText()).trim(), 'light mode');
  /* color-scheme muss mitwandern, sonst zeichnet Chrome Systemscrollbalken
     im falschen Ton. */
  check('dunkel: color-scheme dunkel', await scheme(), 'dark');
  /* Entscheidend: das Inline-Skript im <head> setzt Thema und Schriftgroesse
     vor dem ersten Zeichnen. Ohne das erschiene jede Folgeseite kurz im
     Standard und klappte dann um. */
  const boot = await page.evaluate(() => {
    const s = document.head.querySelector('script:not([src])');
    return s ? s.textContent.includes('localStorage') : false;
  });
  check('Theme wird im <head> gesetzt', boot, true);
  await page.goto(url('indesign/Document.html'));
  check('Theme ueberlebt die Navigation',
    await page.evaluate(() => document.documentElement.dataset.t), 'dark');

  /* --- Schriftgroesse ---
     Umgesetzt als zoom auf :root, damit sich das Layout wie beim Zoom des
     Browsers mitskaliert. Deshalb NICHT ueber getComputedStyle().fontSize
     pruefen: zoom laesst die berechnete Schriftgroesse unveraendert und
     wirkt erst beim Zeichnen. Gemessen wird, was auf dem Schirm ankommt. */
  const fsState = () => page.evaluate(() => {
    const r = s => Math.round(document.querySelector(s).getBoundingClientRect().width);
    return {
      fs: getComputedStyle(document.documentElement).getPropertyValue('--fs').trim(),
      lvl: document.querySelector('.fs .lvl').textContent,
      kopf: Math.round(document.querySelector('.top').getBoundingClientRect().height),
      spalte: r('.side'),
      /* Die Seitenleiste darf nicht unter das Fenster reichen: 100vh rechnet
         den Zoom nicht mit, deshalb steht dort 100vh/var(--fs). */
      unten: Math.round(document.querySelector('.side').getBoundingClientRect().bottom),
      fenster: window.innerHeight
    };
  });
  const fs0 = await fsState();
  check('Schriftgroesse startet bei 100%', fs0.lvl, '100%');
  /* 100% ist nicht zoom 1: der Standard war zu klein, 1.15 ist die neue
     Bezugsgroesse — im Stylesheet ebenso, damit es ohne JavaScript stimmt. */
  check('100% bedeutet zoom 1.15', fs0.fs, '1.15');

  /* Grundlinien: die vier Spalten haben verschiedene Schriftgroessen. Mit
     vertical-align:top standen die Kaesten buendig und die Schriften versetzt
     — gemessen 7 px Versatz, mit baseline 1 px. */
  const rowSpread = await page.evaluate(() => {
    const row = document.querySelector('tbody tr');
    const bottoms = [];
    for (const td of row.cells) {
      const w = document.createTreeWalker(td, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        if (!n.textContent.trim()) continue;
        const r = document.createRange();
        r.selectNodeContents(n);
        const b = r.getBoundingClientRect();
        if (b.height) bottoms.push(b.bottom);
        break;
      }
    }
    return Math.max(...bottoms) - Math.min(...bottoms);
  });
  check('Zellen sitzen auf einer Grundlinie', rowSpread <= 2, true);

  /* Event-Namen sind Namen wie alle anderen — die Farbe unterscheidet sie
     nicht mehr. Kenntlich sind sie durch die eigene Tabelle. */
  await page.goto(url('indesign/Document.html'));
  await page.waitForSelector('.sidelist a', { timeout: 10000 });
  const nameColours = await page.evaluate(() => {
    const c = s => getComputedStyle(document.querySelector(s)).color;
    return { ev: c('tr[id^="e-"] td.n'), p: c('tr[id^="p-"] td.n') };
  });
  check('Event-Namen wie Property-Namen', nameColours.ev, nameColours.p);

  /* Der Rahmen der Eingabefelder muss sich vom Untergrund abheben — WCAG 1.4.11
     verlangt 3:1. Mit --line lag er bei 1,03:1 und war im dunklen Thema
     praktisch unsichtbar. */
  const fieldContrast = () => page.evaluate(() => {
    const lum = c => {
      const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => {
        x /= 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const l1 = lum(getComputedStyle(document.querySelector('#nf')).borderTopColor);
    const l2 = lum(getComputedStyle(document.querySelector('.side')).backgroundColor);
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
    return Math.round((hi + 0.05) / (lo + 0.05) * 100) / 100;
  });
  /* Beide Paletten pruefen — beschwert hatte sich das dunkle Thema, aber eine
     Zusage fuer nur eines der beiden waere die halbe Miete. */
  const wasDark = await page.evaluate(() => document.documentElement.dataset.t === 'dark');
  for (const want of ['light', 'dark']) {
    await page.evaluate(t => {
      if (t === 'dark') document.documentElement.dataset.t = 'dark';
      else delete document.documentElement.dataset.t;
    }, want);
    await page.waitForTimeout(150);
    const r = await fieldContrast();
    check('Filterfeld hebt sich ab, ' + want + ' (' + r + ':1)', r >= 3, true);
  }
  await page.evaluate(d => {
    if (d) document.documentElement.dataset.t = 'dark';
    else delete document.documentElement.dataset.t;
  }, wasDark);
  await page.click('.fs button[data-f="+"]');
  await page.click('.fs button[data-f="+"]');
  await page.waitForTimeout(200);
  const fs2 = await fsState();
  check('A+ vergroessert die Darstellung', fs2.kopf > fs0.kopf, true);
  /* Der Unterschied zum blossen Vergroessern der Schrift: die Objektspalte
     waechst mit, sonst schnitte sie die Namen ab. */
  check('die Objektspalte waechst mit', fs2.spalte > fs0.spalte, true);
  check('die Seitenleiste endet am Fensterrand', fs2.unten, fs2.fenster);
  await page.goto(url('indesign/Rectangle.html'));
  await page.waitForTimeout(300);
  check('Schriftgroesse ueberlebt die Navigation', (await fsState()).lvl, fs2.lvl);
  check('bei 130% laeuft nichts heraus',
    await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  /* Am unteren Anschlag wird A− abgeblendet statt zu verschwinden — deshalb
     klicken, solange der Knopf noch reagiert, statt eine Anzahl zu raten. */
  const minus = page.locator('.fs button[data-f="-"]');
  for (let k = 0; k < 8 && !(await minus.isDisabled()); k++) {
    await minus.click();
    await page.waitForTimeout(80);
  }
  check('kleinste Stufe erreicht', (await fsState()).lvl, '85%');
  check('A− am Anschlag abgeblendet',
    await page.locator('.fs button[data-f="-"]').isDisabled(), true);
  await page.click('.fs button[data-f="+"]');
  await page.waitForTimeout(150);

  /* --- Kurzreferenz nur bei den beiden InDesign-Zielen --- */
  await page.goto(url('indesign/index.html'));
  await page.waitForTimeout(300);
  check('Kurzreferenz verlinkt',
    await page.locator('.refcard a[href="https://www.indesignjs.de/idskurzreferenz.pdf"]').count(),
    1);
  check('Vorschaubild geladen',
    await page.evaluate(() => {
      const i = document.querySelector('.refcard img');
      return !!i && i.naturalWidth > 0;
    }), true);
  await page.goto(url('indesign-server/index.html'));
  await page.waitForTimeout(250);
  check('Server hat sie auch', await page.locator('.refcard').count(), 1);
  await page.goto(url('illustrator/index.html'));
  await page.waitForTimeout(250);
  check('Illustrator hat sie nicht', await page.locator('.refcard').count(), 0);
  await page.goto(url('indesign/Rectangle.html'));
  await page.waitForTimeout(250);

  /* --- Impressum und Datenschutz --- */
  check('Footer verlinkt Impressum',
    await page.locator('footer a[href="https://www.publishingx.de/impressum/"]').count(), 1);
  check('Footer verlinkt Datenschutz',
    await page.locator('footer a[href="https://www.publishingx.de/datenschutzerklaerung/"]').count(), 1);

  /* Die Signatur schliesst den Footer ab; publishingX, Impressum und Datenschutz
     stehen darin auf einer Zeile. Bei schmalem Viewport darf sie umbrechen. */
  check('Signatur ist der letzte Absatz',
    await page.evaluate(() => document.querySelector('footer p:last-child').className), 'by');
  check('Rechtslinks stehen in der Signaturzeile',
    await page.evaluate(() => {
      const a = [...document.querySelectorAll('footer .by a')].slice(-3);
      return a.length === 3 && new Set(a.map(x => Math.round(x.getBoundingClientRect().top))).size === 1;
    }), true);

  /* --- Filter der Objektspalte --- */
  await page.goto(url('indesign/Rectangle.html'));
  await page.waitForSelector('.side a.on', { timeout: 10000 });
  const navAll = await page.locator('.sidelist a').count();
  check('Objektspalte vollstaendig', navAll, 1097);
  await page.fill('#nf', 'text');
  await page.waitForTimeout(200);
  const navHits = await page.locator('.sidelist a span').allTextContents();
  check('Filter kuerzt die Spalte', navHits.length < navAll && navHits.length > 0, true);
  check('nur Treffer in der Spalte',
    navHits.every(n => n.toLowerCase().includes('text')), true);
  check('Ueberschrift nennt Treffer und Gesamtzahl',
    /^Objects · \d+ \/ 423$/.test((await page.locator('.side .h').first().textContent()).trim()),
    true);
  /* Der Filter gehoert zur Spalte, nicht zur Seite: die Member bleiben stehen. */
  check('Filter laesst die Member der Seite unberuehrt',
    await page.locator('tbody tr[id^="p-"]:not([hidden])').count(), 126);
  await page.fill('#nf', 'PAGEITEM');
  await page.waitForTimeout(200);
  check('Filter ignoriert Gross-/Kleinschreibung',
    (await page.locator('.sidelist a').count()) > 0, true);
  await page.fill('#nf', 'zzzz');
  await page.waitForTimeout(200);
  check('ohne Treffer eine Meldung statt leerer Spalte',
    (await page.locator('.sidelist .none').count()), 1);
  await page.click('#nf');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('Escape leert den Filter', await page.locator('.sidelist a').count(), navAll);
  check('Escape schliesst nicht die Palette', await page.locator('.scrim').isVisible(), false);

  /* --- Zuletzt besucht --- */
  await page.goto(url('indesign/Polygon.html'));
  await page.waitForTimeout(200);
  await page.goto(url('indesign/GraphicLine.html'));
  await page.waitForTimeout(200);
  const seen = await page.locator('.trail a').allTextContents();
  check('Spur nennt zuerst die vorige Seite', seen[0], 'Polygon');
  check('Spur laesst die aktuelle Seite aus', seen.includes('GraphicLine'), false);
  check('Spur zeigt drei Eintraege', seen.length, 3);
  /* Trenner als eigene Elemente, nicht im Link: sonst gehoerten sie zur
     Klickflaeche. Bei drei Eintraegen also zwei Striche. */
  check('Trenner zwischen den Eintraegen', await page.locator('.trail .sep').count(), 2);
  check('Trenner ist nicht klickbar', await page.locator('.trail a .sep').count(), 0);
  await page.locator('.trail a').first().click();
  await page.waitForTimeout(300);
  check('Spur fuehrt zum Ziel', await page.locator('h1').innerText(), 'Polygon');
  /* Eine Spur ueber alle Objektmodelle: der Weg von einem Produkt in die
     gemeinsamen Bibliotheken (Document → String) soll auch zurueckfuehren. */
  await page.goto(url('javascript/String.html'));
  await page.waitForTimeout(250);
  check('Spur reicht ueber das Objektmodell hinaus',
    await page.locator('.trail a').first().getAttribute('href'),
    '../indesign/Polygon.html');
  await page.locator('.trail a').first().click();
  await page.waitForTimeout(400);
  check('Spur fuehrt ins andere Modell',
    await page.evaluate(() => document.body.dataset.target), 'indesign');
  check('und auf das richtige Objekt', await page.locator('h1').innerText(), 'Polygon');
  /* Gleichnamige Objekte zweier Modelle stehen nebeneinander, statt sich
     gegenseitig zu verdraengen. */
  await page.goto(url('indesign/Document.html'));
  await page.waitForTimeout(250);
  await page.goto(url('illustrator/Document.html'));
  await page.waitForTimeout(250);
  await page.goto(url('photoshop/Document.html'));
  await page.waitForTimeout(250);
  const hrefs = await page.locator('.trail a')
    .evaluateAll(as => as.map(a => a.getAttribute('href')));
  check('gleichnamige Objekte zweier Modelle bleiben beide stehen',
    hrefs.filter(h => /\/Document\.html$/.test(h)).length, 2);
  /* Ueber die href pruefen, nicht ueber den Text: gleichnamige Eintraege
     verschiedener Modelle sehen im Kopf gleich aus. */
  check('die aktuelle Seite bleibt trotzdem draussen',
    hrefs.includes('Document.html'), false);

  /* Startseite */
  await page.goto(url('index.html'));
  check('Startseite listet alle Bibliotheken',
    await page.locator('ul.cards a').count(), 7);
  check('Startseite weist auf veraltete Photoshop-Daten hin',
    (await page.locator('ul.cards .note').count()) >= 1, true);

  /* --- Maschinenlesbare Ausgaben ---
     Nur Vorhandensein und Verweise; ob die Deklarationen uebersetzen, prueft
     "npm run check:types" mit dem echten Compiler. */
  const exists = f => fs.existsSync(path.join(SITE, f));
  for (const f of ['llms.txt', 'indesign/llms.txt', 'indesign/api.json',
    'indesign/indesign.d.ts', 'indesign/Rectangle.md', 'scriptui/scriptui.d.ts',
    'extendscriptAPI.zip'])
    check('erzeugt: ' + f, exists(f), true);
  /* Das Archiv traegt die ganze Website; die Groesse steht auf den
     Uebersichtsseiten und wird erst nach dem Packen eingesetzt. */
  check('Archiv nennt seine Groesse',
    /About \d+ MB/.test(fs.readFileSync(path.join(SITE, 'indesign/index.html'), 'utf8')),
    true);
  check('kein Platzhalter uebrig',
    /__ZIP/.test(fs.readFileSync(path.join(SITE, 'index.html'), 'utf8')), false);
  /* Der Markdown-Zwilling liegt unter derselben URL wie die Seite — nur so
     kann ein Agent von einem gefundenen Link auf die guenstigere Fassung
     schliessen. */
  check('Markdown-Zwilling zu jeder Seite',
    fs.readdirSync(path.join(SITE, 'indesign')).filter(f => f.endsWith('.md')).length,
    1097);
  const md = fs.readFileSync(path.join(SITE, 'indesign/Rectangle.md'), 'utf8');
  check('Markdown nennt Art und Version', /^# Rectangle\n\n> Object · InDesign/.test(md), true);
  check('Markdown ist deutlich kleiner als die Seite',
    Buffer.byteLength(md) * 2 < fs.statSync(path.join(SITE, 'indesign/Rectangle.html')).size,
    true);
  await page.goto(url('indesign/index.html'));
  await page.waitForTimeout(250);
  check('Produktseite verlinkt die Typen',
    await page.locator('.machine a[href="indesign.d.ts"]').count(), 1);
  check('Produktseite verlinkt llms.txt',
    await page.locator('.machine a[href="llms.txt"]').count(), 1);
  await page.goto(url('index.html'));
  await page.waitForTimeout(200);
  check('Startseite verweist auf llms.txt',
    await page.locator('.machine a[href="llms.txt"]').count(), 1);

  /* --- Schmales Fenster: nichts darf seitlich herauslaufen ---
     Die Tabellen laufen mit table-layout:fixed. Deren Kehrseite: eine zu schmal
     deklarierte Spalte schiebt ihren Inhalt in die Nachbarspalte, statt die
     Tabelle zu verbreitern. Deshalb beides pruefen — Seitenueberhang UND
     Zellen, deren Inhalt breiter ist als die Zelle. */
  const overflowAt = async (w, file) => {
    await page.setViewportSize({ width: w, height: 1000 });
    await page.goto(url(file));
    await page.waitForTimeout(220);
    return page.evaluate(() => ({
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      cells: [...document.querySelectorAll('td,th')]
        .filter(e => e.scrollWidth > e.clientWidth + 1).length
    }));
  };
  /* Massgeblich ist die LOGISCHE Breite, also Fenster ÷ Zoom: darauf reagieren
     die Container-Queries, und dort liegt die 650-px-Grenze. Der Standardzoom
     ist 1,15, ein 750-px-Fenster sind also logisch 652 px — gerade noch drin.
     Rectangle traegt viele Methoden mit Parametern, AssignedStory eine
     Collection-Typangabe; zusammen decken sie beide Engpaesse ab. */
  const BASE = 1.15;
  for (const w of [1600, 1300, 1150, 1000, 900, 800, 750]) {
    for (const f of ['indesign/Rectangle.html', 'indesign/AssignedStory.html']) {
      const o = await overflowAt(w, f);
      const tag = w + 'px (logisch ' + Math.round(w / BASE) + ') ' +
        f.replace('indesign/', '').replace('.html', '');
      check(tag + ': kein Ueberhang', o.page, 0);
      check(tag + ': keine Zelle laeuft aus', o.cells, 0);
    }
  }
  /* Dasselbe bei der groessten Stufe. 150 % heisst zoom 1,725, also braucht es
     mindestens 650 × 1,725 ≈ 1120 px Fenster. Darunter fehlt dieselbe
     Seitenleisten-Faltung wie bei 640 px ohne Zoom. */
  const ZOOM150 = BASE * 1.5;
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(url('indesign/Rectangle.html'));
  await page.waitForSelector('.sidelist a', { timeout: 10000 });
  for (let k = 0; k < 3; k++) {
    await page.click('.fs button[data-f="+"]');
    await page.waitForTimeout(90);
  }
  for (const w of [1600, 1400, 1200]) {
    const o = await overflowAt(w, 'indesign/Document.html');
    check('150% bei ' + w + 'px (logisch ' + Math.round(w / ZOOM150) + '): kein Ueberhang',
      o.page, 0);
    check('150% bei ' + w + 'px: keine Zelle laeuft aus', o.cells, 0);
  }
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(url('indesign/Rectangle.html'));
  await page.waitForSelector('.sidelist a', { timeout: 10000 });
  const back = page.locator('.fs button[data-f="-"]');
  for (let k = 0; k < 8 && !(await back.isDisabled()); k++) {
    await back.click();
    await page.waitForTimeout(70);
  }
  await page.click('.fs button[data-f="+"]');   /* zurueck auf 100% */
  await page.waitForTimeout(120);

  /* Zugriffsspalte: voller Wortlaut solange er passt, darunter abgekuerzt. */
  await overflowAt(1300, 'indesign/AssignedStory.html');
  check('breit: Zugriff ausgeschrieben',
    await page.evaluate(() => getComputedStyle(document.querySelector('td.a')).fontSize),
    '10.5px');
  await overflowAt(900, 'indesign/AssignedStory.html');
  check('schmal: Zugriff abgekuerzt',
    await page.evaluate(() =>
      getComputedStyle(document.querySelector('td.a'), '::after').content), '"ro"');
  await page.setViewportSize({ width: 1600, height: 1000 });

  await browser.close();

  /* ---------- Gegenprobe in Firefox, ueber http ----------
     Alles bis hier lief in Chrome ueber file://. Theme und Spur halten ihren
     Zustand in localStorage, und das verhaelt sich je Browser anders.

     Bewusst ueber http und nicht ueber file://: ein ausgeliefertes Firefox gibt
     jeder lokalen Datei einen eigenen Storage-Origin, dort kann kein
     Seitenzustand ueberdauern (siehe README, "Offline in Firefox"). Playwrights
     Firefox bildet das nicht nach — eine file://-Zusage waere hier also gruen
     und in der Wirklichkeit falsch. Ueber http gibt es einen Origin, und genau
     das ist der Fall, der auf dem Server zaehlt.

     Ohne Firefox-Build wird uebersprungen: "npx playwright install firefox". */
  let ff = null, srv = null;
  try {
    ff = await firefox.launch();
    srv = http.createServer((rq, rs) => {
      const rel = decodeURIComponent(rq.url.split('?')[0]);
      const f = path.join(SITE, path.normalize(rel === '/' ? '/index.html' : rel)
        .replace(/^([/\\])+/, ''));
      fs.readFile(f, (e, d) => {
        if (e) { rs.writeHead(404).end(); return; }
        rs.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
        rs.end(d);
      });
    });
    await new Promise(r => srv.listen(0, r));
    const base = 'http://localhost:' + srv.address().port + '/';

    const fp = await (await ff.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
    const ffErr = [];
    fp.on('pageerror', e => ffErr.push(String(e)));

    await fp.goto(base + 'indesign/Rectangle.html');
    await fp.waitForTimeout(300);
    await fp.click('.tg');
    await fp.waitForTimeout(200);
    await fp.goto(base + 'indesign/Document.html');
    await fp.waitForTimeout(300);
    check('Firefox/http: Theme ueberlebt die Navigation',
      await fp.evaluate(() => document.documentElement.dataset.t), 'dark');
    check('Firefox/http: Spur nennt die vorige Seite',
      (await fp.locator('.trail a').allTextContents())[0], 'Rectangle');
    await fp.goto(base + 'indesign/Page.html');
    await fp.waitForTimeout(300);
    check('Firefox/http: Spur waechst mit',
      (await fp.locator('.trail a').allTextContents()).join(','), 'Document,Rectangle');
    check('Firefox/http: keine Skriptfehler', ffErr.join(' / ') || 'keine', 'keine');
  } catch (e) {
    results.push('SKIP Firefox-Gegenprobe: ' + e.message.split('\n')[0]);
  } finally {
    if (ff) await ff.close();
    if (srv) srv.close();
  }

  console.log('\n' + results.join('\n'));
  console.log('\nKonsolenfehler: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'keine'));
  const failed = results.filter(r => r.startsWith('FAIL')).length;
  console.log('\n' + (failed ? failed + ' PRUEFUNG(EN) FEHLGESCHLAGEN' : 'alle Pruefungen bestanden'));
  process.exit(failed || errors.length ? 1 : 0);
})();
