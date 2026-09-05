/* Member, die Adobes XML-Export vergisst, die es aber wirklich gibt.

   Nicht zu verwechseln mit notes.js: dort stehen Hinweise ueber Member, hier
   stehen die Member selbst. Beides ist von Hand gepflegt und beides ist eine
   Abweichung von Adobes Daten — deshalb wird sie markiert (uxp/es) und in
   verify-model.js als gewollt verbucht.

   Belegt heisst: nachgewiesen, nicht vermutet. Wer hier etwas eintraegt, sollte
   es ausprobiert haben.

   Felder je Member:
     uxp: false  Der Member gibt es nur unter ExtendScript. render.js setzt
                 data-uxp="hide", der UXP-Modus blendet ihn aus.
     added       Woher die Kenntnis kommt — bleibt im Code, nicht auf der Seite. */
'use strict';

module.exports = {
  methods: {
    XMLElements: [
      {
        n: 'itemByName',
        r: ['XMLElement'],
        d: 'Returns the XMLElement with the specified name.',
        a: [{ n: 'name', t: ['String'], d: 'The name.' }],
        uxp: false,
        added: 'Fehlt in Adobes XML-Export, steht aber im Object Model Viewer ' +
          'und funktioniert seit CS3 bis InDesign 2026. Unter UXP nicht mehr.'
      }
    ]
  }
};
