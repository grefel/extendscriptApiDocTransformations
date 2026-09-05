/* Hinweise, die nicht im Objektmodell stehen.

   Adobes Export beschreibt, was es gibt — nicht, was davon kaputt ist oder
   anders heisst als erwartet. Solche Erfahrungswerte stehen hier und werden
   als Warnung auf die Objektseite gesetzt.

   Aufbau je Eintrag:
     products  Auf welche Ziele der Hinweis passt. Ein Fehler in InDesign gilt
               nicht automatisch fuer Illustrator.
     runtime   'uxp' oder 'es', wenn er nur eine Laufzeit betrifft; sonst
               weglassen, dann gilt er immer.
     text      Was dasteht. Englisch wie die uebrige Oberflaeche. */
'use strict';

const ID = ['indesign', 'indesign-server'];

module.exports = {
  XMLElements: {
    products: ID,
    text: 'itemByName() does not work here — the method is not part of the ' +
      'object model at all, although most other collections have it. ' +
      'Use evaluateXPathExpression() on the parent XMLElement instead.'
  }
};
