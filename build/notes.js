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

   Quelle: Adobes Migrationsanleitung
   developer.adobe.com/indesign/uxp/resources/migration-guides/extendscript/ */
const byMember = {
  'Application.scriptArgs': {
    products: ID,
    runtime: 'uxp',
    text: 'In UXP, read arguments from script.args instead of ' +
      'app.scriptArgs.getValue().'
  }
};

module.exports = { byName, byKind, byMember };
