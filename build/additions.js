/* Member, die Adobes XML-Export vergisst, die es aber wirklich gibt, und
   Typangaben, die darin belegbar falsch stehen.

   Nicht zu verwechseln mit notes.js: dort stehen Hinweise ueber Member, hier
   stehen die Member selbst. Beides ist von Hand gepflegt und beides ist eine
   Abweichung von Adobes Daten — deshalb wird sie markiert (uxp/es).

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
        'selbst steht in fullName. In InDesign 2026 geprueft.'
    },
    'Book.filePath': {
      from: ['File'],
      t: ['Folder'],
      d: 'The path to the folder containing the book.',
      added: 'Wie Document.filePath: der Wert ist der Ordner, die .indb-Datei ' +
        'selbst steht in fullName.'
    },
    /* Die folgenden vier stehen in indesign-21.5.1.73.xml und
       indesign-server-20.5.0.49.xml als File.
       Geprueft in InDesign 2026 (21.6) per Skript: unter ExtendScript ist
       jeder Wert ein Folder (instanceof Folder, constructor Folder), unter
       UXP gemessen ein Promise<Folder> (indesign-uxp-types). */
    'Application.filePath': {
      from: ['File'],
      t: ['Folder'],
      d: 'The path to the folder containing the application.',
      added: 'Liefert den Programmordner, die .exe/.app steht in fullName.'
    },
    'BookContent.filePath': {
      from: ['File'],
      t: ['Folder'],
      d: 'The path to the folder containing the document.',
      added: 'Liefert den Ordner des Buchkapitels, die Datei steht in fullName.'
    },
    'Library.filePath': {
      from: ['File'],
      t: ['Folder'],
      d: 'The path to the folder containing the library.',
      added: 'Liefert den Ordner der .indl, die Datei steht in fullName.'
    },
    'GeneralPreference.temporaryFolder': {
      from: ['File'],
      t: ['Folder'],
      added: 'Liefert den Ordner fuer temporaere Dateien; die Beschreibung im ' +
        'Export sagt selbst "location".'
    },
    'ScriptPreference.scriptsFolder': {
      from: ['File'],
      t: ['Folder'],
      added: 'Adobes Export sagt File; der Wert ist der Skripte-Ordner — die ' +
        'Beschreibung im Export sagt selbst "folder". Betrifft InDesign und ' +
        'InDesign Server, andere Produkte kennen die Klasse nicht.'
    }
  },

  /* Falsche Rückgabetypen von Methoden, Schlüssel "Klasse.methode".
     from und Absicherung wie bei types; r ist der richtige Rückgabetyp.
     Erst eintragen, wenn ein Fall in build/live/ den Typ belegt. Steht eine
     Methode an vielen Klassen, die Einträge per Schleife erzeugen. */
  returns: Object.fromEntries(
    /* applyGrammarFix() liefert 1 oder 0, Adobes Export sagt bool. Geprüft
       in InDesign 2027 (22.0.0.104), beide Laufzeiten (build/live:
       applygrammarfix-number); zuerst gefunden von vamitul. */
    ['Character', 'Document', 'InsertionPoint', 'Line', 'Paragraph', 'Story', 'Text',
      'TextColumn', 'TextStyleRange', 'Word', 'XmlStory'].map(c => [c + '.applyGrammarFix', {
      from: ['Boolean'],
      r: ['Number'],
      added: 'Liefert 1, wenn ein Vorschlag angewendet wurde, sonst 0.'
    }]))
};
