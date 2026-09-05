/* Uebersetzt jede erzeugte .d.ts mit dem echten TypeScript-Compiler.

   Ohne diesen Lauf waere die Zusage "hier sind Typen" ungedeckt: beim ersten
   Mal scheiterten alle sieben Dateien an 719 Fehlern, weil Adobe reservierte
   Woerter als Parameternamen benutzt (findKeyStrings(for), prompt(default)).

   Bewusst ohne "dom" und mit lib es5 — genau die Umgebung, fuer die die
   Deklarationen gedacht sind. Mit dem DOM kollidierten Document und Event. */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SITE = process.env.OUT_DIR || path.join(ROOT, 'site');

/* Jede Deklaration unter site/, nicht nur <ziel>/<ziel>.d.ts: die kombinierten
   Dateien (indesign-scriptui.d.ts) muessen genauso uebersetzen. */
const files = fs.readdirSync(SITE, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .flatMap(e => fs.readdirSync(path.join(SITE, e.name))
    .filter(f => f.endsWith('.d.ts'))
    .map(f => path.join(SITE, e.name, f)))
  .sort();

if (!files.length) {
  console.error('Keine .d.ts unter ' + SITE + ' — erst "npm run build".');
  process.exit(2);
}

/* Nicht node_modules/.bin/tsc.cmd: seit Node 18.20/20.12 verweigert
   execFileSync das Starten von .cmd ohne shell (CVE-2024-27980). Der Fehler
   kam als EINVAL im catch an, dort stand keine Zeile mit "error TS" — und
   jede Datei galt als fehlerfrei, ohne dass der Compiler je lief. Deshalb
   direkt das JS des Compilers mit demselben node aufrufen. */
const tsc = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
if (!fs.existsSync(tsc)) {
  console.error('TypeScript fehlt — "npm install" ausfuehren.');
  process.exit(2);
}
const run = args => {
  try {
    execFileSync(process.execPath, [tsc, ...args],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return '';
  } catch (e) {
    /* status null heisst: der Compiler lief gar nicht erst. Das darf nie als
       bestanden durchgehen. */
    const out = String(e.stdout || '') + String(e.stderr || '');
    return e.status === null && !/error TS/.test(out)
      ? 'error TS0000: Compiler nicht gestartet — ' + (e.message || '').split('\n')[0]
      : out;
  }
};

let failed = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f);
  const kb = Math.round(fs.statSync(f).size / 1024);
  /* Ohne --skipLibCheck: geprueft werden soll gerade der Inhalt dieser
     Deklarationsdatei. Mit dem Schalter blieben Fehler darin unsichtbar —
     im Editor des Nutzers aber nicht. */
  const out = run(['--noEmit', '--lib', 'es5', '--types', '', f]);
  const errs = out.split('\n').filter(l => /error TS/.test(l));
  if (errs.length) {
    failed++;
    console.log('FAIL ' + rel.padEnd(46) + errs.length + ' Fehler');
    for (const l of errs.slice(0, 5)) console.log('       ' + l.trim());
  } else {
    console.log('PASS ' + rel.padEnd(46) + kb + ' KB');
  }
}

console.log('\n' + (failed
  ? failed + ' von ' + files.length + ' Deklarationen uebersetzen NICHT'
  : 'alle ' + files.length + ' Deklarationen uebersetzen fehlerfrei'));

/* Dass die Datei uebersetzt, heisst noch nicht, dass man mit ihr arbeiten
   kann: app, alert, new File und everyItem() fehlten oder waren falsch
   getypt, obwohl alle sieben Dateien fehlerfrei durchliefen. Deshalb kommt
   ein echtes Skript hinzu — mit checkJs, sonst prueft niemand den Aufruf. */
for (const fx of fs.readdirSync(path.join(__dirname, 'fixtures'))) {
  const slug = path.basename(fx, '.js');
  /* indesign.js gehoert zu indesign/indesign.d.ts, indesign-scriptui.js zu
     indesign/indesign-scriptui.d.ts — der Ordner ist der Teil vor dem Zusatz. */
  const dts = [path.join(SITE, slug, slug + '.d.ts'),
    path.join(SITE, slug.replace(/-[^-]+$/, ''), slug + '.d.ts')].find(fs.existsSync);
  if (!dts) {
    failed++;
    console.log('FAIL Beispielskript build/fixtures/' + fx + '   keine passende .d.ts');
    continue;
  }
  const out = run(['--noEmit', '--allowJs', '--checkJs', '--lib', 'es5',
    '--types', '', path.join(__dirname, 'fixtures', fx), dts]);
  const errs = out.split('\n').filter(l => /error TS/.test(l));
  if (errs.length) {
    failed++;
    console.log('FAIL Beispielskript build/fixtures/' + fx + '   ' + errs.length + ' Fehler');
    for (const l of errs.slice(0, 5)) console.log('       ' + l.trim().replace(/^.*fixtures./, ''));
  } else {
    console.log('PASS Beispielskript build/fixtures/' + fx + ' gegen ' + slug + '.d.ts');
  }
}

process.exit(failed ? 1 : 0);
