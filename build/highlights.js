/* Highlights für whatsnew.html: die Neuerungen einer Version, die im
   Skript-Objektmodell ankommen, in eigenen Worten und mit den Objekten und
   Membern, die dazugehören. Steht über den erzeugten Abschnitten.

   Schlüssel: slug aus products.js, dann key der neuen Version (versions[0]).
   Je Eintrag:
     title  kurz, Englisch wie die Oberfläche
     text   ein, zwei Sätze, eigene Worte — nichts aus Adobes Release Notes
            übernehmen
     refs   'Klasse' oder 'Klasse.member'; build.js warnt, wenn einer ins
            Leere zeigt
     example  optional { file, code }: Codeblock wie auf der Übersichtsseite.
            Jedes Beispiel braucht einen Fall in live/cases.js, der genau
            diesen Code ausführt.

   Nur, was ein Skript betrifft. Funktionen ohne Spur im Objektmodell
   (Bedienfelder, Plattformen) gehören nicht hierher.

   2026 ist nur Probelauf-Material (build/products-dryrun.js): veröffentlicht
   wird die Seite erst ab 2027 mit 2026 als Vorversion. */
'use strict';

/* Einstellungen in einer JSON-Datei lesen, ändern, zurückschreiben. Die
   beiden Helfer übersetzen zwischen Adobes Paar-Form und normalen Objekten.
   In InDesign 2027 (22.0) gelaufen: live/cases.js json-example. */
const JSON_JSX = [
  '// Objects come as ["__jsonObject__", [[key, value], ...]], arrays as arrays.',
  'function toObject(v) {',
  '  if (!(v instanceof Array)) return v;',
  '  var r = [], i;',
  '  if (v[0] === "__jsonObject__") {',
  '    r = {};',
  '    for (i = 0; i < v[1].length; i++) r[v[1][i][0]] = toObject(v[1][i][1]);',
  '  } else {',
  '    for (i = 0; i < v.length; i++) r.push(toObject(v[i]));',
  '  }',
  '  return r;',
  '}',
  'function toPairs(v) {',
  '  if (v === null || typeof v !== "object") return v;',
  '  var r = [], k;',
  '  if (v instanceof Array) {',
  '    for (k = 0; k < v.length; k++) r.push(toPairs(v[k]));',
  '    return r;',
  '  }',
  '  for (k in v) if (v.hasOwnProperty(k)) r.push([k, toPairs(v[k])]);',
  '  return ["__jsonObject__", r];',
  '}',
  '',
  'var file = File(Folder.desktop + "/settings.json");',
  'var settings = file.exists ? toObject(app.parseJsonFile(file.fsName)) : { runs: 0 };',
  'settings.runs++;',
  'settings.lastRun = new Date().toString();',
  'app.writeJsonFile(file.fsName, toPairs(settings), true); // true: indented'
].join('\n');

module.exports = {
  indesign: {
    '2027': [
      {
        title: 'Table summaries and Check Document',
        text: 'Tables and table styles carry a table summary for accessibility — Check Document ' +
          'looks for missing table summaries and alt text before export. Preferences set ' +
          'whether Check Document runs on export, whether generated table summaries get an ' +
          'AI tag, and whether alt text icons show in the layout.',
        refs: ['Table.tableSummary', 'TableStyle.tableSummary',
          'Application.checkDocumentOnExportPreference',
          'GeneralPreference.addAITagToTableSummary', 'ViewPreference.showAltTextIcon']
      },
      {
        title: 'Grammar and copy suggestions',
        text: 'Every story and text range can check its grammar, report the issues as a ' +
          'JSON string and apply the suggested fixes; called on a document, the methods ' +
          'cover every story. Only for English (International) and English (North America). ' +
          'The two preferences are Enable Grammar Check and Enable Copy Suggestion.',
        refs: ['Story.checkGrammar', 'Story.getGrammarIssues', 'Story.applyGrammarFix',
          'Story.applyAllGrammarFixes', 'Story.requestGrammarCheck',
          'Application.grammarCheckPreference', 'Application.copySuggestionsPreference']
      },
      {
        title: 'JSON in ExtendScript',
        text: 'The application can read and write JSON — from a string or a file — without a ' +
          'polyfill. An object comes as ["__jsonObject__", [[key, value], …]], not as a plain ' +
          'object, and the write methods accept only that shape; keys come back sorted ' +
          'alphabetically. ExtendScript only; UXP has JSON built in.',
        refs: ['Application.parseJson', 'Application.parseJsonFile', 'Application.stringifyJson',
          'Application.writeJsonFile'],
        example: { file: 'json.jsx', code: JSON_JSX }
      },
      {
        title: 'Generative AI',
        text: 'New objects describe AI models and the images they generated in a document. ' +
          'Almost all of their properties are read-only, and scripts cannot add models. ' +
          'ExtendScript only.',
        refs: ['GenAIModel', 'GenAIModels', 'GenAIImage', 'GenAIImages', 'Document.genaiModels']
      }
    ],
    /* Nur Probelauf-Material (build/products-dryrun.js). */
    '2026': [
      {
        title: 'Flex Layout',
        text: 'Containers that arrange their children automatically — direction, wrapping, ' +
          'spacing and alignment, much like CSS flexbox. Page items report how they size ' +
          'inside such a container.',
        refs: ['FlexObject', 'FlexObjects', 'FlexDirection', 'FlexWrap', 'FlexSpacing',
          'FlexPosition', 'PageItem.flexItemWidthMode', 'PageItem.flexItemHeightMode',
          'Spread.flexObjects', 'ObjectStyle.flexLayoutAttributeOptions']
      },
      {
        title: 'Accessible tables',
        text: 'Header columns, captions and column types, so a table keeps its structure ' +
          'in tagged exports.',
        refs: ['Table.numHeaderColumns', 'Table.headerColumnsPosition', 'Table.captionPosition',
          'Table.captionParagraphCount', 'Cell.columnType', 'Column.columnType', 'ColumnTypes']
      },
      {
        title: 'HTML5 export',
        text: 'A new export format with its own preferences on the document.',
        refs: ['Html5ExportPreference', 'Document.html5ExportPreferences', 'ExportFormat.HTML5']
      },
      {
        title: 'ARIA roles in EPUB',
        text: 'Styles and hyperlinks can carry an ARIA role for EPUB export.',
        refs: ['ParagraphStyle.epubAriaRole', 'CharacterStyle.epubAriaRole',
          'ObjectStyle.epubAriaRole', 'Hyperlink.epubAriaRole', 'EpubAriaLabelSourceType']
      },
      {
        title: 'Events around script methods',
        text: 'The application now dispatches an event before and after a script method ' +
          'is invoked.',
        refs: ['Application.BEFORE_SCRIPT_METHOD', 'Application.AFTER_SCRIPT_METHOD']
      }
    ]
  }
};
