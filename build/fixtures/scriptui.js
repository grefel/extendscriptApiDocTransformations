/* Ein Dialog als Regressionstest fuer scriptui.d.ts: die Klassen muessen unter
   den Namen ansprechbar sein, die im Skript stehen — Window, nicht WindowSUI.
   Wird von build/check-types.js mit checkJs uebersetzt. Ausgefuehrt wird es nie. */

var dlg = new Window('dialog', 'Export');
dlg.orientation = 'column';
dlg.alignChildren = 'left';

var reihe = dlg.add('group');
reihe.add('statictext', undefined, 'Aufloesung:');
var wahl = reihe.add('dropdownlist', undefined, ['72 ppi', '150 ppi', '300 ppi']);
wahl.selection = 2;

var kasten = dlg.add('checkbox', undefined, 'Ebenen behalten');
kasten.value = true;

var knoepfe = dlg.add('group');
var ok = knoepfe.add('button', undefined, 'OK', { name: 'ok' });
knoepfe.add('button', undefined, 'Abbrechen', { name: 'cancel' });

ok.onClick = function () {
  dlg.close(1);
};

if (dlg.show() === 1) {
  ScriptUI.newFont('Helvetica', ScriptUI.FontStyle.BOLD, 12);
}
