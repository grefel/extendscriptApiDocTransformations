# Live-Test gegen InDesign

Die Dokumentation behauptet an einigen Stellen, wie sich InDesign *verhält* —
nicht nur, was im Objektmodell steht: `filePath` liefert einen Ordner,
`itemByName()` geht unter UXP nicht, `==` vergleicht unter UXP keine
Enumerationen, `doScript()` reicht Argumente so oder so durch. Diese Angaben
stammen aus Versuchen am laufenden Programm. `build/live/` wiederholt die
Versuche automatisch, in **ExtendScript und UXP**, und hält das Ergebnis je
InDesign-Version fest.

| Datei | Inhalt |
|---|---|
| `cases.js` | die Fälle: Behauptung, Fundstelle, Skript je Laufzeit, Erwartung |
| `run.js` | Läufer: COM, Hüllen um jeden Fall, Auswertung, Ergebnisdatei |
| `host.ps1` | PowerShell-Brücke zu `DoScript`, schließt hängende Dialoge |
| `results/indesign-<app.version>.json` | was in welcher Version gemessen wurde |

## Aufruf

InDesign muss laufen (Windows, COM). Der Test legt eigene, unsichtbare
Dokumente an und schließt sie wieder; offene Dokumente des Nutzers fasst er
nicht an, `userInteractionLevel` stellt er nach jedem Fall zurück.

```sh
node build/live/run.js                         # InDesign 2026, alle Fälle
node build/live/run.js --version 2025          # andere Version (COM-ProgID InDesign.Application.2025)
node build/live/run.js --only filepath-book,enum-equals-uxp
node build/live/run.js --write                 # Ergebnis nach results/ schreiben
```

Weitere Schalter: `--timeout <ms>` (je Fall und Laufzeit, Vorgabe 30000),
`--keep` (Arbeitsordner unter `%TEMP%\idlive-*` behalten), `--no-dismiss`
(fremde Dialoge nicht schließen), `--cases <datei>` (andere Fallliste, etwa
zum Ausprobieren).

Ausgabe je Fall und Laufzeit: **PASS**, **FAIL** (Erwartung verfehlt, mit dem
tatsächlichen Wert), **ERROR** (Skriptfehler, Zeitlimit, Dialog), **n/a**
(`requires` nicht erfüllt) oder **—** (kein Skript für diese Laufzeit).
Bei FAIL oder ERROR endet `run.js` mit Exit-Code 1.

## Einen Fall ergänzen

Ein Eintrag in `cases.js` (Felder oben in der Datei beschrieben):

```js
{
  id: 'textframe-contents-string',
  title: 'TextFrame.contents is a string',
  claim: 'contents liefert bei Text einen String.',
  where: 'notes.js byMember TextFrame.contents',
  requires: ['TextFrame.contents'],          // fehlt es im Modell → n/a
  es: `
    var f = scratch().pages[0].textFrames.add();
    f.contents = "x";
    return typeof f.contents;`,
  uxp: `
    const f = scratch().pages.item(0).textFrames.add();
    f.contents = "x";
    return typeof f.contents;`,
  expect: { es: 'string', uxp: 'string' }  // Wert oder Funktion v => true
}
```

- Die Rümpfe **geben einen Wert zurück**; die Hülle macht JSON daraus. Unter
  UXP darf es ein Promise sein — dann mit `return`, sonst ist das DOM in der
  Fortsetzung schon weg. `await` nur in `return (async () => { … })();`.
- `scratch()` für Dokumente, `track(obj)` für Bücher und Bibliotheken, Dateien
  nur unter `WORK`. Testdateien, die schon vorher da sein müssen, gehören in
  `FIXTURES`.
- `requires` mit einem Member braucht ein Beispielobjekt in `SAMPLES`.
- Ohne `expect` meldet der Fall **INFO** mit dem gemessenen Wert — so lässt
  sich erst messen und dann die Erwartung eintragen.
- Erst prüfen, dass der Fall scheitern **kann**: Erwartung kurz umdrehen,
  FAIL sehen, zurückdrehen.

## Vom Ergebnis zur Notiz „geprüft in InDesign X“

Kommentare in `notes.js`, `additions.js`, `runtime.js` und `examples.js`
nennen die Version, in der eine Angabe geprüft wurde. Jeder solche Satz soll
einen Fall in `cases.js` haben, dessen `where` auf die Stelle zeigt. Die
Versionsnummer im Kommentar darf nur steigen, wenn
`results/indesign-<version>.json` für diesen Fall in beiden Laufzeiten PASS
(oder bewusst `—`) zeigt. Ändert InDesign sein Verhalten, zeigt der Diff der
Ergebnisdatei gegenüber dem Vorjahr genau den Fall — dann die Doku
anpassen und die Erwartung im Fall gleich mit.

## Am Release-Tag

```sh
npm run live -- --version 2027 --write
```

Danach `results/indesign-22.*.json` mit dem Vorjahr vergleichen und
committen. FAILs sind Verhaltensänderungen (oder ein falscher Fall), ERRORs
meist Umgebung: Version nicht installiert, Dialog offen, Zeitlimit.

## Was man über DoScript wissen muss (gemessen in 21.6)

- **ExtendScript** (Sprachcode 1246973031): der letzte Ausdruck kommt zurück.
  Fehler kommen über COM ohne Meldungstext; die Hülle fängt sie selbst ab.
  Jeder Aufruf beginnt mit leerem Global-Objekt. Ein per `doScript()`
  gestartetes Kind läuft im Gültigkeitsbereich des Aufrufers: `arguments`
  sind nur auf oberster Ebene die `withArguments` (Fall `doscript-es-child`,
  Feld `esTopLevel`).
- **UXP** (1431522407): zurück kommt nur `setResult()`, und das nur einmal je
  Skript; der letzte Ausdruck nicht.
  - **Wartet DoScript auf ein asynchrones Skript?** Nur, wenn das Skript auf
    oberster Ebene ein Promise (eine `.then`-Kette) mit `return` zurückgibt.
    Dann wartet `DoScript`, das DOM bleibt in den Fortsetzungen erreichbar,
    und ein `setResult()` daraus kommt an.
  - Ohne dieses `return` kehrt `DoScript` nach dem synchronen Teil zurück.
    Danach ist das DOM für die Fortsetzungen weg (`app.documents` undefined,
    `close()` wirkungslos), Timer und Event-Rückrufe kommen nicht mehr an.
  - `return main()` mit einer `async function main` kehrte sofort und leer
    zurück; ein Skript, in dem das Wort `async` auch nur im Kommentar steht,
    verlor sogar ein synchrones `setResult()`. Wer über DoScript ein Ergebnis
    braucht, nimmt besser eine `.then`-Kette.
  - Die Hülle gibt deshalb eine `.then`-Kette zurück und schreibt das
    Ergebnis in eine Datei; Fälle dürfen `async` trotzdem benutzen.
- Event-Handler feuern unter UXP nicht synchron im auslösenden Aufruf
  (`doc.save()`), sondern danach.
- **Ein nicht abgefangener UXP-Fehler öffnet einen modalen Dialog**, der
  `DoScript` blockiert bzw. jeden weiteren Skriptzugriff („modales
  Dialogfeld aktiv“). Die Hüllen fangen alles ab; erscheint trotzdem ein
  Dialog, fotografiert `run.js` ihn (PrintWindow, Pfad in der Meldung) und
  schließt ihn mit `WM_CLOSE`. Ist beim Start schon ein Dialog offen, bricht
  `run.js` ab.
- **Ein zurückgegebenes UXP-Promise, das nie fertig wird, sperrt InDesigns
  Skripting** — jeder weitere COM-Aufruf hängt, auch nachdem der aufrufende
  Prozess beendet ist (einmal etwa drei Minuten, einmal deutlich länger; die
  Oberfläche bleibt bedienbar). Die Hülle lässt deshalb jedes Promise gegen einen
  Zeitgeber laufen (`--timeout` minus 5 s). Hängt ein Aufruf trotzdem, beendet
  `run.js` nach dem Zeitlimit den PowerShell-Host und startet ihn neu — das
  Skript in InDesign lässt sich von außen nicht abbrechen.
