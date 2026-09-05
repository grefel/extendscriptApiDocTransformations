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

   byName gilt fuer ein Objekt, byKind fuer alle Objekte einer Art. */
'use strict';

const ID = ['indesign', 'indesign-server'];

const byName = {
  XMLElements: {
    products: ID,
    text: 'itemByName() does not work here — the method is not part of the ' +
      'object model at all, although most other collections have it. ' +
      'Use evaluateXPathExpression() on the parent XMLElement instead.'
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

/* Alle Hinweise, die auf ein Objekt passen. */
function notesFor(cls, kind, slug) {
  const fits = n => !n.products || n.products.includes(slug);
  const out = [];
  if (byName[cls] && fits(byName[cls])) out.push(byName[cls]);
  for (const n of byKind) if (n.kind === kind && fits(n)) out.push(n);
  return out;
}

module.exports = { notesFor, byName, byKind };
