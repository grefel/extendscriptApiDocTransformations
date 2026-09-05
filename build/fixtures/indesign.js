/* Ein Alltagsskript als Regressionstest fuer indesign.d.ts: es benutzt genau
   die Stellen, an denen Adobes Modell nicht unmittelbar zu TypeScript passt.
   Wird von build/check-types.js mit checkJs uebersetzt und muss fehlerfrei
   durchlaufen. Ausgefuehrt wird es nie. */

var doc = app.activeDocument;                       /* app als globaler Name */
var page = doc.pages.item(0);
var tf = page.textFrames.add();
tf.contents = 'Hallo';
tf.geometricBounds = ['10mm', '10mm', '50mm', '80mm'];   /* Masseinheit als String */

/* everyItem() ist ein Sammelverweis, kein Array. */
doc.pages.everyItem().appliedMaster = doc.masterSpreads.item(0);
var alle = doc.pages.everyItem().getElements();

/* filePath ist ein Folder, nicht die Datei — die steht in fullName. */
var ordner = doc.filePath;
var log = new File(ordner.fsName + '/log.txt');     /* Konstruktor, nicht Methode */
log.open('w');
log.writeln('Seiten: ' + alle.length);
log.close();

var indds = new Folder(ordner.fsName).getFiles('*.indd');
var xml = new XML('<a><b>1</b></a>');

$.writeln('Version ' + $.build + ', ' + indds.length + ' Dateien, ' + xml.toString());
alert('fertig');                                    /* globale Funktion */
