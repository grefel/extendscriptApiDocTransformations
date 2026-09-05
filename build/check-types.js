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

const files = fs.readdirSync(SITE, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => path.join(SITE, e.name, e.name + '.d.ts'))
  .filter(fs.existsSync);

if (!files.length) {
  console.error('Keine .d.ts unter ' + SITE + ' — erst "npm run build".');
  process.exit(2);
}

const tsc = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
if (!fs.existsSync(tsc)) {
  console.error('TypeScript fehlt — "npm install" ausfuehren.');
  process.exit(2);
}

let failed = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f);
  const kb = Math.round(fs.statSync(f).size / 1024);
  let out = '';
  try {
    /* Ohne --skipLibCheck: geprueft werden soll gerade der Inhalt dieser
       Deklarationsdatei. Mit dem Schalter blieben Fehler darin unsichtbar —
       im Editor des Nutzers aber nicht. */
    execFileSync(tsc, ['--noEmit', '--lib', 'es5', '--types', '', f],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out = String(e.stdout || '') + String(e.stderr || '');
  }
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
  const dts = path.join(SITE, slug, slug + '.d.ts');
  if (!fs.existsSync(dts)) continue;
  let out = '';
  try {
    execFileSync(tsc, ['--noEmit', '--allowJs', '--checkJs', '--lib', 'es5',
      '--types', '', path.join(__dirname, 'fixtures', fx), dts],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out = String(e.stdout || '') + String(e.stderr || '');
  }
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
