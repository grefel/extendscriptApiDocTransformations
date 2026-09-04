/* Die Produkte, aus denen die Website gebaut wird — jeweils die neueste
   verfügbare OMV-XML aus sourceXML/.

   slug   Ordnername und URL-Segment
   label  Kurzname für den Umschalter im Kopf
   src    Produkt-XML; javascript.xml und scriptui.xml kommen immer dazu
   abbr   Kuerzel in der Recent-Spur, wenn der Eintrag aus einem anderen
          Objektmodell stammt
   uxp    zeigt den Laufzeit-Umschalter ExtendScript/UXP
   note   optionaler Hinweis, wenn die Datenlage nicht aktuell ist */
'use strict';

module.exports = [
  {
    slug: 'indesign',
    label: 'InDesign',
    src: 'sourceXML/id_26.xml',
    abbr: 'id',
    uxp: true
  },
  {
    slug: 'indesign-server',
    label: 'InDesign Server',
    src: 'sourceXML/id_25-server.xml',
    abbr: 'ids',
    uxp: true
  },
  /* Ohne uxp: Nur fuer InDesign beschreibt dieses Objektmodell zugleich die
     UXP-Laufzeit. Illustrator und Bridge kennen ohnehin keine Methode [],
     Photoshop hat 14 davon, aber eine eigene, hier nicht abgebildete UXP-API —
     ein Umschalter waere dort irrefuehrend. */
  {
    slug: 'illustrator',
    label: 'Illustrator',
    src: 'sourceXML/illu_25.xml',
    abbr: 'ai'
  },
  {
    slug: 'photoshop',
    label: 'Photoshop',
    src: 'sourceXML/photoshop_12.xml',
    abbr: 'ps',
    /* Neueste vorliegende Photoshop-XML stammt von 2016. Sichtbar kennzeichnen,
       damit niemand sie für den aktuellen Stand hält. */
    note: 'Newest object model available to us is CC 2015.5 — Adobe has not shipped a newer OMV export.'
  },
  {
    slug: 'bridge',
    label: 'Bridge',
    src: 'sourceXML/bridge-omv.xml',
    abbr: 'br'
  }
];
