/* Die Produkte, aus denen die Website gebaut wird.

   slug     Ordnername und URL-Segment
   label    Kurzname für den Umschalter im Kopf
   versions Quell-XMLs aus sourceXML/, neueste zuerst. versions[0] wird unter
            /<slug>/ veröffentlicht; versions[1] ist die Vorversion. key ist
            das Jahr (Illustrator: die Hauptversion); passt es nicht zum
            Titel der XML, warnt der Bau. Die Dateinamen vergibt
            npm run intake (build/sources.js).
   src      Kurzform für eine einzige Version
            javascript.xml und scriptui.xml kommen immer dazu.
   uxp      zeigt den Laufzeit-Umschalter ExtendScript/UXP
   refcard  zeigt die InDesign-Skripting-Kurzreferenz auf der Übersichtsseite
   server   Skripte laufen im Auftrag eines Clients: Argumente und Ergebnis
            stehen im Vordergrund (examples.js, Übersichtsseite, uxp.md)
   note     optionaler Hinweis, wenn die Datenlage nicht aktuell ist

   Neue Version: XML nach sourceXML/ legen, npm run intake, dann den
   ausgegebenen Eintrag oben in versions einfügen. */
'use strict';

module.exports = [
  {
    slug: 'indesign',
    label: 'InDesign',
    versions: [
      { key: '2027', src: 'sourceXML/indesign-22.0.0.104.xml' },
      { key: '2026', src: 'sourceXML/indesign-21.5.1.73.xml' }
    ],
    uxp: true,
    refcard: true
  },
  {
    slug: 'indesign-server',
    label: 'InDesign Server',
    versions: [
      { key: '2025', src: 'sourceXML/indesign-server-20.5.0.49.xml' }
    ],
    uxp: true,
    server: true,
    refcard: true
  },
  /* Ohne uxp: Nur für InDesign beschreibt dieses Objektmodell zugleich die
     UXP-Laufzeit. Illustrator und Bridge kennen ohnehin keine Methode [],
     Photoshop hat 14 davon, aber eine eigene, hier nicht abgebildete UXP-API —
     ein Umschalter wäre dort irreführend. */
  {
    slug: 'illustrator',
    label: 'Illustrator',
    versions: [
      { key: '31', src: 'sourceXML/illustrator-31.xml' },
      { key: '29', src: 'sourceXML/illustrator-29.xml' }
    ]
  },
  {
    slug: 'photoshop',
    label: 'Photoshop',
    src: 'sourceXML/photoshop-2015.5.xml',
    /* Neueste vorliegende Photoshop-XML stammt von 2016. Sichtbar kennzeichnen,
       damit niemand sie für den aktuellen Stand hält. */
    note: 'Newest object model available to us is CC 2015.5 — Adobe has not shipped a newer OMV export.'
  },
  {
    slug: 'bridge',
    label: 'Bridge',
    src: 'sourceXML/bridge-2021.xml'
  }
];
