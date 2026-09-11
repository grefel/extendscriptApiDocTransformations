/* Member, die Adobes XML-Export vergisst, die es aber wirklich gibt, und
   Typangaben, die darin belegbar falsch stehen.

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
  },

  /* Typkorrekturen an Properties, Schluessel "Klasse.property".

     "from" nennt die falsche Angabe und begrenzt den Eingriff darauf: schreibt
     Adobe den Typ eines Tages richtig oder anders, greift die Korrektur nicht
     mehr, statt eine dann falsche zu erzwingen. Gilt fuer beide Laufzeiten. */
  types: {
    'Document.filePath': {
      from: ['File'],
      t: ['Folder'],
      d: 'The path to the folder containing the document.',
      added: 'Adobes Export sagt File; der Wert ist ein Folder — die Datei ' +
        'selbst steht in fullName. In InDesign 2026 geprueft. Bei Application, ' +
        'BookContent und Library steht dasselbe im Export, dort unangetastet.'
    },
    'Book.filePath': {
      from: ['File'],
      t: ['Folder'],
      d: 'The path to the folder containing the book.',
      added: 'Wie Document.filePath: der Wert ist der Ordner, die .indb-Datei ' +
        'selbst steht in fullName.'
    },
    'ScriptPreference.scriptsFolder': {
      from: ['File'],
      t: ['Folder'],
      added: 'Adobes Export sagt File; der Wert ist der Skripte-Ordner — die ' +
        'Beschreibung im Export sagt selbst "folder". Betrifft InDesign und ' +
        'InDesign Server, andere Produkte kennen die Klasse nicht.'
    }
  }
};
