/* Interaktionstests für den Prototyp Konzept B.
   Playwright liegt global, daher Auflösung über `npm root -g`. */
const { execSync } = require('child_process');
const G = execSync('npm root -g').toString().trim().split('\\').join('/');
const { chromium } = require(G + '/playwright');

const PAGE = 'file:///C:/Users/hp/git-px/extendscriptApiDocTransformations/design/concept-b-console.html';
const OUT = 'C:/Users/hp/AppData/Local/Temp/claude/c--Users-hp-git-px-extendscriptApiDocTransformations/ee178e32-f9fb-45ac-8639-d5b566d5b3bb/scratchpad/shots/';

const results = [];
const check = (name, got, want) => {
  const ok = String(got) === String(want);
  results.push((ok ? 'PASS ' : 'FAIL ') + name.padEnd(46) + got + (ok ? '' : '   (expected ' + want + ')'));
};

(async () => {
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome' }); console.log('browser: system Chrome'); }
  catch (e) { browser = await chromium.launch(); console.log('browser: bundled chromium'); }

  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: 'dark' });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(PAGE + '#Rectangle');
  await page.waitForSelector('.sechead');

  /* --- ExtendScript baseline --- */
  const esMethods = await page.locator('.mem').count();
  check('ExtendScript: Rectangle method blocks', esMethods, 60);

  /* --- the UXP switch on a collection class, where [] exists --- */
  await page.goto(PAGE + '#Pages');
  await page.waitForSelector('.sechead');
  const pagesEs = await page.locator('.mem').count();
  check('ExtendScript: Pages method blocks', pagesEs, 15);
  const hasBracket = await page.locator('.mem .id', { hasText: '[]' }).count();
  check('ExtendScript: Pages has [] accessor', hasBracket > 0, true);

  await page.click('#rt button[data-r="uxp"]');
  await page.waitForTimeout(150);
  const pagesUxp = await page.locator('.mem').count();
  check('UXP: Pages method blocks', pagesUxp, 14);
  const uxpPill = await page.locator('.pill', { hasText: 'methods' }).innerText();
  check('UXP: method pill text', uxpPill.trim(), 'methods 14');
  await page.screenshot({ path: OUT + 'uxp-pages.png' });

  /* --- $ and ScriptUI disappear in UXP (still in UXP mode from above) --- */
  const sideTxt = await page.locator('#side').innerText();
  check('UXP: no SUI class in sidebar', /\bSUI\n|\bSUI$/m.test(sideTxt), false);
  check("UXP: no hidden-count note", /hidden in uxp/i.test(sideTxt), false);
  await page.keyboard.press('Control+k');
  await page.fill('#pq', 'ButtonSUI');
  await page.waitForTimeout(200);
  check('UXP: palette hides SUI classes', await page.locator('.res .r').count(), 0);
  await page.keyboard.press('Escape');
  /* landing on a hidden class must redirect, not show an empty page */
  await page.goto(PAGE + '#ButtonSUI!uxp');
  await page.waitForSelector('.sechead');
  check('UXP: hidden class redirects', await page.locator('.doc h1').innerText(), 'Document');

  /* back to ExtendScript for the remaining checks */
  await page.click('#rt button[data-r="es"]');
  await page.waitForTimeout(150);
  await page.goto(PAGE + '#Rectangle');
  await page.waitForSelector('.sechead');
  check('ExtendScript: SUI back in sidebar',
    (await page.locator('#side').innerText()).includes('ButtonSUI'), true);

  /* --- no leading dot, and the clipboard helper is back --- */
  const firstProp = (await page.locator('td.n').first().innerText()).trim();
  check('property name has no leading dot', firstProp.startsWith('.'), false);
  const firstMeth = (await page.locator('.mem .id').first().innerText()).trim();
  check('method name has no leading dot', firstMeth.startsWith('.'), false);
  check('names are copy targets', (await page.locator('td.n .cpx').count()) > 0, true);

  /* enum values must sit in the Type column, not the Description column */
  const enumRow = page.locator('tr', { has: page.locator('.vals') }).first();
  check('enum chips live in Type cell', await enumRow.locator('td.t .vals').count(), 1);
  check('enum chips gone from Description', await enumRow.locator('td.d .vals').count(), 0);

  /* --- command palette --- */
  await page.goto(PAGE + '#Document');
  await page.waitForSelector('.sechead');
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(120);
  const palOpen = await page.locator('.scrim.on').count();
  check('palette opens on Ctrl+K', palOpen, 1);
  await page.fill('#pq', 'geometricBounds');
  await page.waitForTimeout(200);
  const rows = await page.locator('.res .r').count();
  check('palette results for geometricBounds', rows > 0, true);
  const first = await page.locator('.res .r').first().innerText();
  results.push('      first hit: ' + first.replace(/\s+/g, ' ').slice(0, 70));
  await page.screenshot({ path: OUT + 'palette.png' });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  const landed = await page.locator('.doc h1').innerText();
  results.push('      Enter navigated to: ' + landed);

  /* --- light theme, never yet seen --- */
  await page.goto(PAGE + '#Rectangle');
  await page.waitForSelector('.sechead');
  await page.click('#tbtn');
  await page.waitForTimeout(150);
  const theme = await page.evaluate(() => document.documentElement.dataset.t);
  check('theme toggle sets data-t', theme, 'light');
  await page.screenshot({ path: OUT + 'light.png' });

  /* --- narrow viewport --- */
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: OUT + 'narrow-1280.png' });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check('no horizontal overflow at 1280px', overflow, false);

  /* --- footer actually reachable --- */
  await page.setViewportSize({ width: 1600, height: 1000 });
  const footTxt = await page.locator('footer').innerText();
  check('footer mentions Adobe Inc.', footTxt.includes('Adobe Inc.'), true);
  check("footer discloses AI", /AI assistance/.test(footTxt), true);
  check('footer credits publishingX', /publishingX/.test(footTxt), true);
  check('footer credits Gregor Fellenz', footTxt.includes('Gregor Fellenz'), true);
  check('publishingX link target',
    await page.locator('footer a[href="https://www.publishingx.de/"]').first().getAttribute('href'),
    'https://www.publishingx.de/');
  check('Gregor Fellenz links to LinkedIn',
    await page.locator('footer a', { hasText: 'Gregor Fellenz' }).getAttribute('href'),
    'https://www.linkedin.com/in/gregor-fellenz/');

  /* --- Zwischenablage: Klassenebene qualifiziert, Instanz-Properties nackt --- */
  await page.goto(PAGE + '#CopyrightStatus');
  await page.waitForSelector('.sechead');
  const enumClip = await page.locator('tr#p-YES .cpx').getAttribute('data-cp');
  check('enum value copies qualified', enumClip, 'CopyrightStatus.YES');
  await page.goto(PAGE + '#Rectangle');
  await page.waitForSelector('.sechead');
  check('instance property copies bare',
    await page.locator('tr#p-absoluteFlip .cpx').getAttribute('data-cp'), 'absoluteFlip');
  check('event copies qualified',
    await page.locator('tr#e-AFTER_PLACE .cpx').getAttribute('data-cp'), 'Rectangle.AFTER_PLACE');
  await page.goto(PAGE + '#$');
  await page.waitForSelector('.sechead');
  check('static property copies qualified',
    await page.locator('tr#p-build .cpx').getAttribute('data-cp'), '$.build');

  /* Methoden: Signatur anzeigen, aber name() kopieren — ohne Parameter */
  await page.goto(PAGE + '#Rectangle');
  await page.waitForSelector('.sechead');
  const dup = page.locator('#m-duplicate .id .cpx');
  check('method copies with () suffix', await dup.getAttribute('data-cp'), 'duplicate()');
  check('method still displays its parameters',
    /^duplicate\(.+\)$/.test((await dup.innerText()).replace(/\s+/g, '')), true);
  const noArg = page.locator('#m-getElements .id .cpx');
  check('parameterless method copies name()',
    await noArg.getAttribute('data-cp'), 'getElements()');
  /* der Kopier-Klick auf einer Methode darf nicht die Seite wechseln */
  await dup.click();
  await page.waitForTimeout(150);
  check('copy click keeps the page', await page.locator('.doc h1').innerText(), 'Rectangle');

  /* --- Klassenart: Class / Collection / Enumeration --- */
  await page.goto(PAGE + '#AngleComboboxes');
  await page.waitForSelector('.sechead');
  const collKind = (await page.locator('.doc .kind').innerText()).trim();
  check('collection labelled Collection', /^COLLECTION/i.test(collKind), true);
  check('collection names its element type', /AngleCombobox$/i.test(collKind), true);
  await page.goto(PAGE + '#AngleCombobox');
  await page.waitForSelector('.sechead');
  check('plain class labelled Object',
    (await page.locator('.doc .kind').innerText()).trim(), 'OBJECT');
  await page.goto(PAGE + '#CopyrightStatus');
  await page.waitForSelector('.sechead');
  check('enum labelled Enumeration',
    (await page.locator('.doc .kind').innerText()).trim(), 'ENUMERATION');
  check('sidebar says Objects, not Classes',
    /OBJECTS · \d+/.test(await page.locator('#side .h').first().innerText()), true);

  /* Collection-Properties verlinken zusaetzlich auf das enthaltene Objekt */
  await page.goto(PAGE + '#Document');
  await page.waitForSelector('.sechead');
  const pagesCell = page.locator('tr#p-pages td.t');
  check('collection type links to collection',
    await pagesCell.locator('a[href="#Pages"]').count(), 1);
  check('collection type links through to element',
    await pagesCell.locator('a[href="#Page"]').count(), 1);
  check('element shown in angle brackets',
    /Pages<Page>/.test((await pagesCell.innerText()).replace(/\s+/g, '')), true);

  /* --- Enum-Chips in der Typspalte sind selbst Kopierziele --- */
  await page.goto(PAGE + '#Application');
  await page.waitForSelector('.sechead');
  const chip = page.locator('tr#p-activeScriptUndoMode td.t .vchip').first();
  check('enum chip is a copy target', await chip.getAttribute('data-cp'), 'UndoModes.AUTO_UNDO');
  check('enum chip shows bare value', (await chip.innerText()).trim(), 'AUTO_UNDO');
  const chipCount = await page.locator('tr#p-activeScriptUndoMode td.t .vchip').count();
  check('all four undo modes offered', chipCount, 4);
  await chip.click();
  await page.waitForTimeout(120);
  check('chip flashes without losing its label', (await chip.innerText()).trim(), 'AUTO_UNDO');
  /* Enums mit mehr als 12 Werten verlinken auf die Enumeration statt sie abzuschneiden */
  await page.goto(PAGE + '#Document');
  await page.waitForSelector('.sechead');
  const more = page.locator('td.t .more').first();
  if (await more.count()) {
    check('overflow marker links to the enum',
      (await more.getAttribute('href') || '').startsWith('#'), true);
  }

  await page.goto(PAGE + '#Document');
  await page.waitForSelector('.sechead');

  /* --- aus fixDom.xsl abgeleitete Angaben: Wertebereich und Masseinheit --- */
  check('range shown for tintValue',
    (await page.locator('tr#p-tintValue td.t .rngv').innerText()).replace(/\s/g, ''), '0–100');
  check('measurement unit marked on zeroPoint',
    await page.locator('tr#p-zeroPoint td.t .muv').count(), 1);
  check('plain Number has no range badge',
    await page.locator('tr#p-documentPreferences td.t .rngv').count(), 0);

  /* Footer nennt Version und Erzeugungsdatum */
  const footMeta = await page.locator('#foot-ver').innerText();
  check('footer states generation date', /on \d{4}-\d{2}-\d{2}/.test(footMeta), true);
  results.push('      footer meta: ' + footMeta.trim());
  /* Einstufung darf sich mit der Laufzeit nicht aendern, obwohl [] in UXP fehlt */
  await page.goto(PAGE + '#AngleComboboxes!uxp');
  await page.waitForSelector('.sechead');
  check('still a Collection in UXP',
    /^COLLECTION/i.test((await page.locator('.doc .kind').innerText()).trim()), true);
  await page.click('#rt button[data-r="es"]');
  await page.waitForTimeout(150);

  /* --- Verwendungsnachweis für Enumerations --- */
  /* ExportFormat hat keine einzige Property, aber 88 Parameter — vor "Parameter of"
     blieb der Seitenfuß dieser Enums komplett leer. */
  await page.goto(PAGE + '#ExportFormat');
  await page.waitForSelector('.sechead');
  const revHeads = (await page.locator('.rev .sechead').allInnerTexts()).join(' ');
  check('enum shows Parameter of', /PARAMETER OF/i.test(revHeads), true);
  check('Parameter of count', /PARAMETER OF\s+88/i.test(revHeads), true);
  check('Parameter of names the argument',
    /exportFile\(format\)/.test(await page.locator('.rev .revbox').last().innerText()), true);
  check('rail counts parameter of',
    /88 parameter of/i.test(await page.locator('#rail2 .kv').innerText()), true);
  /* eine nirgends verwendete Enumeration sagt das ausdrücklich */
  await page.goto(PAGE + '#AttachedDevices');
  await page.waitForSelector('.sechead');
  check('unused enum states it explicitly',
    /Used by/i.test((await page.locator('.rev .sechead').allInnerTexts()).join(' ')), true);
  /* normale Klasse behält Object of und Return */
  await page.goto(PAGE + '#Rectangle');
  await page.waitForSelector('.sechead');
  const rectRev = (await page.locator('.rev .sechead').allInnerTexts()).join(' ');
  check('class keeps Object of', /OBJECT OF/i.test(rectRev), true);
  check('class keeps Return', /RETURN/i.test(rectRev), true);

  /* --- Volltextsuche --- */
  await page.goto(PAGE + '#Document');
  await page.waitForSelector('.sechead');
  await page.keyboard.press('Control+k');
  /* "deprecated" kommt in keinem Membernamen vor, nur in Beschreibungen —
     damit trennt der Test die beiden Modi sauber. */
  await page.fill('#pq', 'deprecated');         /* Namensmodus: darf nichts finden */
  await page.waitForTimeout(200);
  check('name search finds nothing for a prose word', await page.locator('.res .r').count(), 0);
  await page.fill('#pq', '?deprecated');        /* Volltext erzwungen */
  await page.waitForTimeout(250);
  check('? finds description matches', (await page.locator('.res .r').count()) > 0, true);
  check('full-text count is labelled',
    /in descriptions/.test(await page.locator('#rescount').innerText()), true);
  const snip = await page.locator('.res .r .d').first().innerText();
  check('result shows description snippet', /deprecated/i.test(snip), true);
  /* mehrere Woerter schalten ohne Praefix auf Volltext */
  await page.fill('#pq', 'adjust layout');
  await page.waitForTimeout(250);
  check('two words auto-switch to full text',
    /in descriptions/.test(await page.locator('#rescount').innerText()), true);
  check('two-word query returns hits', (await page.locator('.res .r').count()) > 0, true);
  await page.keyboard.press('Escape');
  /* "?" oeffnet die Palette direkt im Volltextmodus */
  await page.waitForTimeout(150);
  await page.keyboard.press('?');
  await page.waitForTimeout(200);
  check('? opens palette prefilled', await page.inputValue('#pq'), '?');
  await page.keyboard.press('Escape');

  /* rechte Spalte listet alle drei Membertypen, nicht nur Methoden */
  await page.goto(PAGE + '#AdjustLayoutPreference');
  await page.waitForSelector('.sechead');
  const railHeads = (await page.locator('#rail2 .h').allInnerTexts()).map(s => s.trim().split(' ')[0]);
  check('rail lists Properties', railHeads.includes('PROPERTIES'), true);
  check('rail lists Methods', railHeads.includes('METHODS'), true);
  check('rail link count = members',
    await page.locator('#rail2 a[data-jump]').count(), 12 + 5);
  /* mit aktivem Filter darf die Spalte nicht leer bleiben (der gemeldete Fehler) */
  await page.locator('.pill', { hasText: 'properties' }).click();
  await page.waitForTimeout(150);
  check('rail not empty with properties filter',
    await page.locator('#rail2 a[data-jump]').count(), 12);
  /* eine Klasse mit Events muss auch die Events auflisten */
  await page.goto(PAGE + '#Rectangle');
  await page.waitForSelector('.sechead');
  check('rail lists Events',
    (await page.locator('#rail2 .h').allInnerTexts()).some(t => /EVENTS/i.test(t)), true);
  /* Sprung darf den Hash nicht zerschiessen */
  await page.locator('#rail2 a[data-jump]').first().click();
  await page.waitForTimeout(200);
  check('jump keeps class in hash', /#Rectangle/.test(page.url()), true);

  /* API-Version im Kopf */
  const ver = (await page.locator('#apiver').innerText()).trim();
  check('header shows product', /InDesign 20\d\d/.test(ver), true);
  check('header shows API build', /API \d+\.\d+/.test(ver), true);
  results.push('      header version reads: ' + ver);

  console.log('\n' + results.join('\n'));
  console.log('\nconsole/page errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
  const failed = results.filter(r => r.startsWith('FAIL')).length;
  console.log('\n' + (failed ? failed + ' CHECK(S) FAILED' : 'all checks passed'));
  await browser.close();
})();
