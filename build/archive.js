/* Alte, nicht mehr erzeugte Dokumentationen, die weitgehend unveraendert
   mitgeliefert werden. Sie liegen fertig als HTML unter legacy/ und werden nur
   durchgereicht — kein Modell, kein Rendering, keine gemeinsamen Assets.

   Hintergrund: Die 2014 mit oXygen WebHelp gebaute CS6-Fassung stand bisher
   unter /extendscriptAPI/indesign8/. Dieses Verzeichnis faellt auf dem Server
   weg, die Fassung zieht deshalb nach /indesignapi/indesign8/ um. Beim Kopieren
   wird umgebogen, was aus dem Ordner herauszeigte, und jede Seite auf noindex
   gesetzt: Die CS6-Fassung soll erreichbar bleiben, aber nicht laenger neben
   der aktuellen Dokumentation in den Suchergebnissen stehen. Verlinkt ist sie
   nur von der Startseite aus. */
'use strict';

const fs = require('fs');
const path = require('path');

const LEGACY = path.join(__dirname, '..', 'legacy');
const ROBOTS = '<meta name="robots" content="noindex, follow">';

const archives = [{
  dir: 'indesign8',
  label: 'InDesign CS6 (8.0)',
  blurb: 'The previous documentation, generated in 2014 from Adobe’s CS6 object ' +
    'model. Kept for scripts that still target CS6 — old layout, its own search. ' +
    'Online only, not part of the offline download.',
  noindex: true,

  /* oXygen WebHelp laedt die Themenseiten in einen iframe; Einstieg ist die
     Seite mit Inhaltsverzeichnis und Suche. */
  entry: 'index.html',

  /* Reste des DITA-OT-Laufs von 2014. Sie gehoeren nicht auf eine Website und
     nennen ausserdem den lokalen Pfad des Rechners, auf dem gebaut wurde.
     check.html ist die Diagnoseseite von oXygen: Niemand verlinkt sie, und das
     einzige Skript, das sie laedt, hat es nie in die Ausgabe geschafft. */
  skip: [/^dita\.list$/, /^dita\.xml\.properties$/, /^oxygen-webhelp\/check\.html$/],

  rewrite: [
    /* Die Kopfgestaltung kam als /skin.css von der Domainwurzel. Dieselbe
       Datei liegt byteglich im Archiv — relativ verlinkt bleibt es auch
       offline und nach einem Umbau der Wurzel vollstaendig. Alle Seiten mit
       diesem Verweis liegen im Wurzelverzeichnis des Archivs, der relative
       Pfad stimmt dort. */
    [/href="\/skin\.css"/g, 'href="skin.css"'],
    /* Im Kopf von Einstiegs- und Inhaltsseite stehen zwei Verweise nach
       /extendscriptAPI/: das Download-Zip und die naechstjuengere Fassung.
       Beide sterben mit dem Verzeichnis, an ihre Stelle kommt der Weg zurueck
       zur aktuellen API. */
    [/<div class="versionLinks">[\s\S]*?<\/div>/g,
      '<div class="versionLinks"><a href="../index.html">Current ExtendScript API</a>' +
      ' | Files are serverd by <a href="http://www.publishingx.de">publishingX</a></div>'],
    /* Die Klasse Index hat nie eine eigene Seite gehabt: Auf dem Server liegt
       unter Index.html eine aeltere Kopie der Einstiegsseite — geoeffnet
       steckte das ganze WebHelp im iframe des WebHelp. Der Name beisst sich
       ausserdem auf einer Windows-Platte mit index.html. Die Seite faellt
       deshalb weg, die Verweise darauf verlieren ihren Link, der Name bleibt
       als Text stehen. */
    [/<a [^>]*href="Index\.html(#[^"]*)?"[^>]*>([\s\S]*?)<\/a>/g, '$2']
  ]
}];

/* Schreibt jedes Archiv nach OUT. write(rel, Buffer) ist der Schreiber aus
   build.js, log(text) die Ausgabe. */
function copyAll(write, log) {
  for (const a of archives) {
    const src = path.join(LEGACY, a.dir);
    if (!fs.existsSync(src)) { log('legacy   fehlt: legacy/' + a.dir + ' — uebersprungen'); continue; }

    let dateien = 0, seiten = 0, ohneKopf = 0, weggelassen = 0;
    /* Je Regel mitzaehlen, auf wie vielen Seiten sie gegriffen hat. Eine Regel
       ohne Treffer heisst: Die Vorlage sieht anders aus als angenommen, und
       etwas bleibt stehen — im fertigen HTML faellt das sonst nicht auf. */
    const treffer = a.rewrite.map(() => 0);

    const umschreiben = (rel, buf) => {
      if (!/\.html?$/i.test(rel)) return buf;
      seiten++;
      let s = buf.toString('utf8');
      a.rewrite.forEach(([suchen, ersetzen], i) => {
        const vorher = s;
        s = s.replace(suchen, ersetzen);
        if (s !== vorher) treffer[i]++;
      });
      if (a.noindex) {
        if (/<head[^>]*>/i.test(s)) s = s.replace(/<head[^>]*>/i, m => m + ROBOTS);
        else ohneKopf++;
      }
      return Buffer.from(s, 'utf8');
    };

    let entry = null;
    (function walk(dir, rel) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name), r = rel ? rel + '/' + e.name : e.name;
        if (e.isDirectory()) { walk(p, r); continue; }
        if ((a.skip || []).some(re => re.test(r))) { weggelassen++; continue; }
        const buf = umschreiben(r, fs.readFileSync(p));
        dateien++;
        /* Windows haelt Gross- und Kleinschreibung nicht auseinander: welche
           der beiden Einstiegsseiten in der Kopie gelandet ist, entscheidet
           die Reihenfolge des Kopierens. Beide Namen gelten deshalb. */
        if (r.toLowerCase() === a.entry.toLowerCase()) { entry = buf; continue; }
        write(a.dir + '/' + r, buf);
      }
    })(src, '');

    if (!entry) { log('legacy   ' + a.dir + ': Einstiegsseite ' + a.entry + ' fehlt'); continue; }
    write(a.dir + '/index.html', entry);

    log('legacy   ' + a.dir.padEnd(17) + String(dateien).padStart(5) + ' Dateien, ' +
      seiten + ' Seiten auf noindex' + (weggelassen ? ', ' + weggelassen + ' weggelassen' : ''));
    if (ohneKopf) log('legacy   ' + a.dir + ': ' + ohneKopf + ' Seiten ohne <head>, kein noindex gesetzt');
    treffer.forEach((n, i) => {
      log('legacy   ' + a.dir + ': ' + (n ? String(n).padStart(5) + ' Seiten ersetzt — ' : 'Regel ohne Treffer — ') + a.rewrite[i][0]);
    });
  }
}

module.exports = { archives, copyAll };
