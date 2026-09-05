/* Die Produkte, aus denen die Website gebaut wird — jeweils die neueste
   verfügbare OMV-XML aus sourceXML/.

   slug   Ordnername und URL-Segment
   label  Kurzname für den Umschalter im Kopf
   src    Produkt-XML; javascript.xml und scriptui.xml kommen immer dazu
   uxp    zeigt den Laufzeit-Umschalter ExtendScript/UXP
   refcard zeigt die InDesign-Skripting-Kurzreferenz auf der Uebersichtsseite
   note   optionaler Hinweis, wenn die Datenlage nicht aktuell ist */
'use strict';

module.exports = [
  {
    slug: 'indesign',
    label: 'InDesign',
    src: 'sourceXML/id_26.xml',
    uxp: true,
    refcard: true
  },
  {
    slug: 'indesign-server',
    label: 'InDesign Server',
    src: 'sourceXML/id_25-server.xml',
    uxp: true,
    refcard: true
  },
  /* Ohne uxp: Nur fuer InDesign beschreibt dieses Objektmodell zugleich die
     UXP-Laufzeit. Illustrator und Bridge kennen ohnehin keine Methode [],
     Photoshop hat 14 davon, aber eine eigene, hier nicht abgebildete UXP-API —
     ein Umschalter waere dort irrefuehrend. */
  {
    slug: 'illustrator',
    label: 'Illustrator',
    src: 'sourceXML/illu_25.xml'
  },
  {
    slug: 'photoshop',
    label: 'Photoshop',
    src: 'sourceXML/photoshop_12.xml',
    /* Neueste vorliegende Photoshop-XML stammt von 2016. Sichtbar kennzeichnen,
       damit niemand sie für den aktuellen Stand hält. */
    note: 'Newest object model available to us is CC 2015.5 — Adobe has not shipped a newer OMV export.'
  },
  {
    slug: 'bridge',
    label: 'Bridge',
    src: 'sourceXML/bridge-omv.xml'
  }
];
