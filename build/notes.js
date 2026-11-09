/* Hinweise, die nicht im Objektmodell stehen.

   Adobes Export beschreibt, was es gibt — nicht, was davon kaputt ist, anders
   heisst als erwartet oder unter UXP nicht gilt. Solche Erfahrungswerte stehen
   hier und erscheinen als Warnung unter der Beschreibung des Objekts.

   Felder je Eintrag:
     products  Auf welche Ziele der Hinweis passt. Ein Fehler in InDesign gilt
               nicht automatisch fuer Illustrator.
     runtime   'uxp' oder 'es', wenn er nur eine Laufzeit betrifft; sonst
               weglassen, dann gilt er immer. site.js blendet ihn im anderen
               Modus aus — Ziele ohne Umschalter zeigen nur 'es' und die
               allgemeinen.
     text      Was dasteht. Englisch wie die uebrige Oberflaeche.

   byName gilt fuer ein Objekt, byKind fuer alle Objekte einer Art.
   Abgefragt wird ueber runtime.js, das auch die Produktauswahl vornimmt. */
'use strict';

const ID = ['indesign', 'indesign-server'];

const byName = {
  XMLElements: {
    products: ID,
    runtime: 'uxp',
    /* Unter ExtendScript funktioniert itemByName() hier seit CS3 — Adobes
       XML-Export fuehrt sie nur nicht auf, deshalb ergaenzt sie
       additions.js. Unter UXP ist sie tot. */
    text: 'itemByName() does not work under UXP. Use ' +
      'evaluateXPathExpression() on the parent XMLElement instead.'
  },
  ScriptArg: {
    products: ID,
    runtime: 'uxp',
    /* In InDesign 2026 (21.6) geprueft: app.scriptArgs ist unter UXP
       undefined. */
    text: 'Not reachable in UXP — app.scriptArgs is undefined there. Read ' +
      'arguments from require("uxp").script.args.'
  }
};

const byKind = [
  {
    kind: 'Enumeration',
    products: ID,
    runtime: 'uxp',
    /* Adobes Migrationsanleitung nennt genau diesen Fall, mit einem
       Enumerationswert als Beispiel:
       developer.adobe.com/indesign/uxp/resources/migration-guides/extendscript/ */
    text: 'In UXP, compare with equals() — the == and === operators do not work ' +
      'on DOM objects: myPath.pathType.equals(PathType.CLOSED_PATH), not ' +
      'myPath.pathType == PathType.CLOSED_PATH.'
  }
];

/* Hinweise an einem einzelnen Member, Schluessel "Objekt.member". Sie stehen
   in der Beschreibungsspalte der Zeile — ein Kasten oben an der Seite waere
   fuer eine von 341 Properties die falsche Stelle.

   Dass File- und Folder-Properties unter UXP ein Promise liefern, steht
   nicht hier, sondern als Regel in runtime.js — auch fuer activeScript.

   Ein Member kann je Laufzeit einen eigenen Hinweis tragen, dann steht
   statt des Eintrags eine Liste.

   Quellen: Adobes Migrationsanleitung
   developer.adobe.com/indesign/uxp/resources/migration-guides/extendscript/
   und die Anleitungen .../indesign/uxp/scripts/tutorials/arguments/ und
   .../script-result/. Das Verhalten von doScript() in InDesign 2026 (21.6)
   geprueft: UXP macht aus jedem Argument einen String (true wird "TRUE"),
   ExtendScript behaelt die Typen; der letzte Ausdruck eines UXP-Skripts
   kommt nicht zurueck. Dass ein ExtendScript-Kind withArguments nur bei
   Aufruf auf oberster Ebene als arguments sieht, belegt build/live
   (doscript-es-child). */
const byMember = {
  'Application.scriptArgs': {
    products: ID,
    runtime: 'uxp',
    text: 'Undefined in UXP. Read arguments from require("uxp").script.args — ' +
      'an array of strings; InDesign Server passes them as "name=value".'
  },
  'Application.doScript': [
    {
      products: ID,
      runtime: 'es',
      text: 'The called script receives withArguments as arguments — but only when ' +
        'doScript() is called at the top level of a script. The called script runs in ' +
        'the caller’s scope, so inside a function arguments is that function’s own. ' +
        'doScript() returns the value of its last expression.'
    },
    {
      products: ID,
      runtime: 'uxp',
      text: 'A called UXP script receives withArguments as strings in ' +
        'require("uxp").script.args; an ExtendScript receives them as arguments ' +
        'with their types. doScript() returns what a UXP script passes to ' +
        'script.setResult() — its last expression is ignored.'
    }
  ]
};

module.exports = { byName, byKind, byMember };
