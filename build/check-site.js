/* Prueft die generierte Website im echten Browser: statischer Inhalt ohne
   JavaScript, danach dieselben Seiten mit aktiviertem Skript. */
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const SITE = process.env.OUT_DIR || path.join(ROOT, 'site');
const url = f => 'file:///' + path.join(SITE, f).replace(/\\/g, '/');

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
  check('mit JS: Seitenleiste nachgeladen',
    await page.locator('.side a').count(), 1097);
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
  check('mit JS: Bedienelemente sichtbar',
    await page.locator('[data-enhance][hidden]').count(), 0);

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

  /* --- Theme: Beschriftung und kein Aufblitzen beim Navigieren --- */
  check('Themeknopf nennt das Ziel',
    (await page.locator('.tg').innerText()).trim(), 'light mode');
  await page.click('.tg');
  await page.waitForTimeout(200);
  check('nach dem Umschalten umgekehrt',
    (await page.locator('.tg').innerText()).trim(), 'dark mode');
  /* Entscheidend: das Inline-Skript im <head> setzt das Thema vor dem ersten
     Zeichnen. Ohne das erschiene jede Folgeseite kurz dunkel. */
  const boot = await page.evaluate(() => {
    const s = document.head.querySelector('script:not([src])');
    return s ? s.textContent.includes('localStorage') : false;
  });
  check('Theme wird im <head> gesetzt', boot, true);
  await page.goto(url('indesign/Document.html'));
  check('Theme ueberlebt die Navigation',
    await page.evaluate(() => document.documentElement.dataset.t), 'light');
  await page.click('.tg');   /* zurueck auf dunkel fuer die restlichen Pruefungen */
  await page.waitForTimeout(150);

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

  /* Startseite */
  await page.goto(url('index.html'));
  check('Startseite listet alle Bibliotheken',
    await page.locator('ul.cards a').count(), 7);
  check('Startseite weist auf veraltete Photoshop-Daten hin',
    (await page.locator('ul.cards .note').count()) >= 1, true);

  console.log('\n' + results.join('\n'));
  console.log('\nKonsolenfehler: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'keine'));
  const failed = results.filter(r => r.startsWith('FAIL')).length;
  console.log('\n' + (failed ? failed + ' PRUEFUNG(EN) FEHLGESCHLAGEN' : 'alle Pruefungen bestanden'));
  await browser.close();
  process.exit(failed || errors.length ? 1 : 0);
})();
