/* Der Fall, fuer den es die kombinierte Datei gibt: ein Skript, das einen
   Dialog zeigt und danach am Dokument arbeitet. Beides muss in einem Projekt
   pruefen — mit indesign.d.ts und scriptui.d.ts nebeneinander ginge das nicht,
   dort waeren neun Namen doppelt. Ausgefuehrt wird das Skript nie. */

var dlg = new Window('dialog', 'Rahmen anlegen');
var reihe = dlg.add('group');
reihe.add('statictext', undefined, 'Breite in mm:');
var feld = reihe.add('edittext', undefined, '80');
var knoepfe = dlg.add('group');
knoepfe.add('button', undefined, 'OK', { name: 'ok' });
knoepfe.add('button', undefined, 'Abbrechen', { name: 'cancel' });

if (dlg.show() === 1) {
  var doc = app.activeDocument;
  var page = doc.pages.item(0);
  var tf = page.textFrames.add();
  tf.geometricBounds = ['10mm', '10mm', '50mm', feld.text + 'mm'];
  tf.contents = 'Hallo';
  doc.pages.everyItem().appliedMaster = doc.masterSpreads.item(0);
  $.writeln('fertig in ' + doc.filePath.fsName);
}
