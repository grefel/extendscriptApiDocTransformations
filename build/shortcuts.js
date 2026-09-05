/* Einstiegspunkte auf der Uebersichtsseite.

   Die Seitenleiste listet alle 1.097 Objekte — das hilft beim Suchen, nicht
   beim Anfangen. Diese Auswahl ist der Weg, den ein InDesign-Skript fast immer
   nimmt, von oben nach unten durch die Hierarchie:

     app → document → spread/page → Rahmen → Text
     dazu Bilder, Formate, Tabellen und die GREP-Einstellungen

   Nur fuer InDesign und InDesign Server. Bei Illustrator oder Photoshop waere
   die Reihenfolge anders und die Namen teils falsch.

   render.js filtert die Liste gegen das jeweilige Modell, damit kein Link ins
   Leere zeigt, falls Adobe einmal ein Objekt umbenennt. */
'use strict';

module.exports = {
  products: ['indesign', 'indesign-server'],
  /* Reihenfolge = Hierarchie, nicht Alphabet. Das Alphabet steht links. */
  list: [
    'Application', 'Document', 'Spread', 'Page',
    'PageItem', 'Rectangle', 'TextFrame', 'Group',
    'Story', 'Paragraph', 'Text',
    'Graphic', 'Image', 'Link',
    'ParagraphStyle', 'Swatch', 'Table',
    'FindGrepPreference', 'ChangeGrepPreference'
  ]
};
