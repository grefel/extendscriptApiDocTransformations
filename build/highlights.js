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

   Nur, was ein Skript betrifft. Funktionen ohne Spur im Objektmodell
   (Bedienfelder, Plattformen) gehören nicht hierher.

   2026 ist nur Probelauf-Material (build/products-dryrun.js): veröffentlicht
   wird die Seite erst ab 2027 mit 2026 als Vorversion. */
'use strict';

module.exports = {
  indesign: {
    '2027': [
      {
        title: 'Table summaries and alt text',
        text: 'Tables and table styles carry an accessibility summary; preferences control the ' +
          'AI tag on generated summaries and the alt text icons in the layout.',
        refs: ['Table.tableSummary', 'TableStyle.tableSummary',
          'GeneralPreference.addAITagToTableSummary', 'ViewPreference.showAltTextIcon',
          'Application.checkDocumentOnExportPreference']
      },
      {
        title: 'Grammar check',
        text: 'Every story and text range can check its grammar, report the issues as a ' +
          'JSON string and apply the suggested fixes. Called on a document, the methods ' +
          'cover every story. Grammar suggestions are available for English text only.',
        refs: ['Story.checkGrammar', 'Story.getGrammarIssues', 'Story.applyGrammarFix',
          'Story.applyAllGrammarFixes', 'Story.requestGrammarCheck',
          'Application.grammarCheckPreference', 'Application.copySuggestionsPreference']
      },
      {
        title: 'JSON in ExtendScript',
        text: 'The application can read and write JSON — from a string or a file — without a ' +
          'polyfill. The parsed result comes as [key, value] pairs, not as a plain object. ' +
          'ExtendScript only; UXP has JSON built in.',
        refs: ['Application.parseJson', 'Application.parseJsonFile', 'Application.stringifyJson',
          'Application.writeJsonFile']
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
