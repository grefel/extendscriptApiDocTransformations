/* Beispielskripte je Laufzeit, für die Übersichtsseite (render.js) und
   uxp.md (agents.js). Paarweise parallel gebaut, damit die Unterschiede ins
   Auge fallen.

   Alle vier sind in InDesign 2026 (21.6) gelaufen. Die Server-Fassungen
   ohne InDesign Server: die Argumente kamen dort über doScript() bzw. ein
   vorher gesetztes app.scriptArgs herein — beides landet an derselben
   Stelle wie die Argumente eines Server-Clients. */
'use strict';

/* Hello World mit einer Enumeration — an ihr zeigt sich der Unterschied beim
   Vergleichen: unter UXP greift == nicht. */
const HELLO_JSX = [
  'var doc = app.documents.add();',
  'var frame = doc.pages[0].textFrames.add();',
  'frame.geometricBounds = [20, 20, 40, 120];',
  'frame.contents = "Hello World";',
  'var para = frame.paragraphs[0];',
  'para.justification = Justification.CENTER_ALIGN;',
  'if (para.justification == Justification.CENTER_ALIGN) {',
  '  alert("centered");',
  '}'
].join('\n');
const HELLO_IDJS = [
  'const { app, Justification } = require("indesign");',
  'const doc = app.documents.add();',
  'const frame = doc.pages.item(0).textFrames.add();',
  'frame.geometricBounds = [20, 20, 40, 120];',
  'frame.contents = "Hello World";',
  'const para = frame.paragraphs.item(0);',
  'para.justification = Justification.CENTER_ALIGN;',
  'if (para.justification.equals(Justification.CENTER_ALIGN)) {',
  '  console.log("centered");',
  '}'
].join('\n');

/* InDesign Server: Argument hinein, Ergebnis an den Client. Ohne Vergleich
   der Enumeration — das Thema hier sind Argumente und Ergebnis.
   ExtendScript liest app.scriptArgs und gibt den letzten Ausdruck zurück;
   UXP bekommt "name=value"-Strings in script.args, app.scriptArgs ist dort
   undefined, und nur script.setResult() erreicht den Client. */
const SERVER_JSX = [
  'var args = app.scriptArgs;',
  'var name = args.isDefined("name") ? args.getValue("name") : "World";',
  'var doc = app.documents.add();',
  'var frame = doc.pages[0].textFrames.add();',
  'frame.geometricBounds = [20, 20, 40, 120];',
  'frame.contents = "Hello " + name;',
  'frame.paragraphs[0].justification = Justification.CENTER_ALIGN;',
  'var result = frame.contents;',
  'doc.close(SaveOptions.NO);',
  'result; // returned to the client'
].join('\n');
const SERVER_IDJS = [
  'const { app, Justification, SaveOptions } = require("indesign");',
  'const { script } = require("uxp");',
  'const arg = script.args.find(a => a.startsWith("name="));',
  'const doc = app.documents.add();',
  'const frame = doc.pages.item(0).textFrames.add();',
  'frame.geometricBounds = [20, 20, 40, 120];',
  'frame.contents = "Hello " + (arg ? arg.slice(5) : "World");',
  'frame.paragraphs.item(0).justification = Justification.CENTER_ALIGN;',
  'const result = frame.contents;',
  'doc.close(SaveOptions.NO);',
  'script.setResult(result); // returned to the client'
].join('\n');

/* Das passende Paar je Ziel. */
const forTarget = t => t.server
  ? { jsx: SERVER_JSX, idjs: SERVER_IDJS }
  : { jsx: HELLO_JSX, idjs: HELLO_IDJS };

module.exports = { HELLO_JSX, HELLO_IDJS, SERVER_JSX, SERVER_IDJS, forTarget };
