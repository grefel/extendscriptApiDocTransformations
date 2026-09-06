# extendscriptApiDocTransformations — Projektkontext

Transformation der Adobe-ExtendScript-Objektmodell-XMLs in eine lesbare
API-Dokumentation. Veröffentlicht unter <https://www.indesignjs.de/indesignapi/>.

**Zielgruppe:** InDesign-Scripter. Sie schlagen Klassen, Properties und Methoden nach —
schnell, oft dutzende Male pro Stunde, häufig offline. Geschwindigkeit und Scanbarkeit
schlagen jedes Designdetail.

---

## Aktueller Stand (2026-09-04)

Branch **`redesign-html-direct`**. Die Ablösung der alten Pipeline ist **fertig** und
geht in den öffentlichen Test.

```
sourceXML/*.xml → build/ (Node) → site/     2.681 Seiten, ~7 s
```

Kein Java, kein Saxon, kein DITA, kein DITA-OT, kein oXygen. Eine Laufzeit-Abhängigkeit
im Build (`@xmldom/xmldom`, 0 transitive), **keine** in der erzeugten Website.

Sieben Ziele: fünf Produkte (InDesign, InDesign Server, Illustrator, Photoshop, Bridge)
plus die beiden gemeinsamen Bibliotheken Core JavaScript und ScriptUI. Letztere stecken
in jeder Produkt-XML identisch drin und werden einmal ausgegeben statt fünfmal.

Details zur Umsetzung, zu den Fallstricken je Produkt und zu den Größen:
**[build/README.md](build/README.md)** — dort steht das Meiste, was beim Weiterarbeiten
gebraucht wird.

### Was von der alten Strecke bleibt

`mergeFiles.xslt`, `fixDom.xsl`, `build/prepare-xslt.js` und `build/legacy-model.js`
existieren nur noch als **Gegenprobe** (`npm run verify`, braucht Java + Saxon).
Sie belegt: 0 echte Abweichungen in allen fünf Produkten, 252 verbesserte Member.
Der Build rührt sie nicht an; sobald die Gegenprobe nicht mehr gebraucht wird,
können alle vier weg.

`dom2sublimeCodeCompletion.xsl` erzeugt die Sublime-Text-Vervollständigungen und
hängt noch an derselben XSLT-Strecke — eigenständiges Nebenprodukt.

---

## Entscheidungen

- Konzept B („Console") ist umgesetzt: dreispaltig, tastaturzentriert,
  Command-Palette über alle Member, Properties/Events/Methoden je als eigene Tabelle.
- **Eine statische Seite je Objekt.** Deep-Links, Drucken und Nutzung ohne JS
  funktionieren; JavaScript ergänzt nur Bedienelemente.
- Kein `fetch` — Navigationsliste und Suchindex kommen als `<script src>`, damit der
  Offline-Download über `file://` funktioniert.
- Kein Build-Step und keine Laufzeit-Abhängigkeit im Output.
- Hausbegriff für eine Seite ist **Object**, nicht Class. Arten: Object / Collection /
  Enumeration.
- Es heißt **Methode**, nicht Funktion.

## Offene Fragen

1. **ExtendScript vs. UXP.** Vom Umschalter ist genau ein Unterschied übrig: die
   242 Methoden namens `[]`. Er steht nur noch bei InDesign und InDesign Server
   (`uxp: true` in `products.js`). `$` und ScriptUI sind aus den Produkten heraus in
   eigene Bibliotheken gewandert, die als „ExtendScript only" gekennzeichnet sind.
   **Welche weiteren Unterschiede in die Daten gehören, ist weiterhin offen** — etwa
   `File`, `Folder`, `Socket`, `XML`/`XMLList`, `UnitValue`, `Reflection`.
2. Bleibt der Download-Zip pro InDesign-Version bestehen? Die Zips liegen im
   Wurzelverzeichnis, sind aber nicht versioniert.
3. Soll der Vergleichs-Modus aus Konzept C (2–3 Objekte nebeneinander, nur dort
   vorhandene Member markiert) als Zusatzseite kommen? Deshalb liegt `design/` noch da.
4. Umgang mit kaputten Adobe-Typangaben (siehe unten).
5. `fixDom.xsl` benennt die Klasse `Index` in `Index_` um — ein Workaround aus der
   DITA-Zeit. Im HTML-Pfad vermutlich unnötig, wird derzeit aber mit angezeigt.
6. Wie tief soll die Typabbildung gehen? 231 Typangaben je InDesign-Modell sind
   Adobe-Prosa und landen als `any` — siehe build/README.md. (Die Zahl zählt
   einen Durchgang über das Modell; früher meldete der Build 856, weil dieselben
   Typen für Markdown, api.json und `.d.ts` dreifach gezählt wurden.)

---

## Datenmodell — teuer erarbeitete Fallstricke

Quelle sind die Roh-XMLs in `sourceXML/`; bereinigt wird beim Einlesen in
`build/fixdom.js`. Die folgenden Punkte kosten sonst jedes Mal neu Zeit:

- **Rückgabetyp einer Methode hängt als `<datatype>` direkt am `<method>`.**
  Ein Element `<returns>` existiert **nicht**. Eine erste Fassung des Extraktors suchte
  danach und lieferte stillschweigend leere Rückgabewerte.
- **Events sind Properties auf Klassenebene** (`elements[@type='class']`) und nur daran
  erkennbar, dass die Beschreibung mit `Dispatched` beginnt. 211 Events auf 56 Klassen.
- Die **übrigen** Klassen-Properties sind echte statische Properties (86, z. B. `$.build`,
  `$.engineName`) — nicht mit Events vermischen.
- Bei `classdef[@enumeration='true']` sind die Klassen-Properties die **Enum-Werte**.
- **`<datatype><array/>`** markiert die `Type[]`-Notation (703 Properties).
- **Die `parent`-Property ist die Hierarchie.** Sie nennt, worin ein Objekt
  stecken kann; die Kinderliste ist deren Umkehrung (`derive()`:
  `parentsOf`/`childrenOf`). Sammlungen haben in Adobes Export **keine**
  `parent`-Angabe. `Event`/`EventListener`/`MutationEvent` nennen über 400
  Eltern — fast jedes Objekt löst Events aus.
- **242 Methoden heißen wörtlich `[]`** (`Pages.[]`, `Rectangles.[]`) — der Index-Zugriff
  auf Collections. Der funktioniert in UXP nicht und wird dort ausgeblendet.
- **Optionale Parameter** sind uneinheitlich markiert: teils `@optional`, teils nur durch
  ein `(Optional)` am Ende der Beschreibung. Beides prüfen.
- **`<is>Measurement Unit</is>`** (1.313 Properties, 122 Parameter) erlaubt den Wert auch
  als String (`"12mm"`); **`<min>`/`<max>`** (1.002 Properties, 100 Parameter) stehen teils
  nur im Fließtext als „(Range: 0 to 100)". Beides wird ausgewertet.
- `Varies` ist ein Adobe-Platzhalter und wird verworfen, sobald konkretere Typen daneben
  stehen.
- Einzelne Typangaben sind unbrauchbar, z. B. `AnimationSetting.motionPath`
  (`Orderedarraycontainingkey…`). Adobe-Datenfehler, kein Darstellungsproblem.
- **Einzelne Typangaben sind schlicht falsch.** `Document.filePath` und
  `Book.filePath` stehen als `File`, liefern aber einen `Folder`. Korrigiert in
  `build/additions.js` (`types`), abgesichert durch `from`. Die gleichlautenden
  `Application`/`BookContent`/`Library` sind ungeprüft und bleiben stehen.
- **Konstruktoren stehen als Methode mit dem Klassennamen** (`File(path)`,
  `XML(text)`), und die globalen Namen stecken in einer Klasse `global`.
  Für die `.d.ts` wird beides umgeformt — siehe build/README.md.
- **Das SUI-Suffix gilt nur innerhalb des gemeinsamen Modells.** Neun
  ScriptUI-Klassen heißen wie Produktklassen (`Window`, `Button`, `Event`,
  `Events`, `Group`, `ListBox`, `Panel`, `RadioButton`, `StaticText`), deshalb
  braucht `derive()` die Unterscheidung. **In der Ausgabe kommt es nirgends
  vor** — die ScriptUI-Seiten heißen `Window.html`, die Typen `Window`. Je
  Produkt gibt es zusätzlich `<slug>-scriptui.d.ts` für Skripte mit Dialog;
  darin weichen die neun Produktklassen. Nebeneinander legen kann man die
  Dateien nicht, TypeScript kennt je globalem Namen nur eine Bedeutung.
- **`check-types.js` hat den Compiler früher nie gestartet** und trotzdem
  „bestanden" gemeldet (Node verweigert `.cmd` über `execFileSync`). Bei jedem
  Prüfer, der nur Erfolge meldet: erst nachweisen, dass er fehlschlagen *kann*.
- **`Changes` ist eine echte Klasse.** Dateinamen wie `changes.html` kollidieren unter
  Windows mit der generierten `Changes.html`; in der DITA-Strecke ging sie so einmal
  verloren. `build.js` prüft das jetzt und bricht ab. Beim Anlegen neuer Topics immer
  gegen die Objektliste prüfen — das Changelog heißt deshalb `whatsnew`.
- **Collections erkennt jedes Produkt anders**, und der Elementtyp kommt aus
  unterschiedlichen Quellen. Siehe build/README.md, Abschnitt „Produktspezifische
  Fallstricke".

### Kennzahlen (InDesign 2026, 21.5.1.73)

| | |
|---|---|
| Objekte | 1.097 im Produkt (+ 22 Core JavaScript, 34 ScriptUI) |
| Arten | 479 Objekte, 242 Collections, 432 Enumerations |
| Properties | 19.590 (davon 86 statisch) |
| Events | 211 |
| Methoden | 8.841 (7.046 mit Rückgabetyp, Rest echt `void`) |
| Member gesamt | 28.642 |
| Objektseite (Rectangle) | 133 KB roh, **16 KB gzip** |
| Suchindex | 3,0 MB roh, 491 KB gzip — erst bei Bedarf geladen |
| Suche über alle Member | ~5 ms pro Anschlag |

---

## Befehle

```sh
npm install
npm run build      # sourceXML/*.xml → site/, dazu site.zip zum Hochladen
npm run serve      # http://localhost:8080
npm run check      # Browsertest der fertigen Website (Playwright)
npm run check:types # jede .d.ts und jedes Beispielskript mit dem echten Compiler
npm run verify     # Portierung gegen die alte XSLT-Strecke halten
```

Abweichende Pfade über `OUT_DIR`. `NO_PACKAGE=1` lässt `site.zip` weg
(~90 s Bauzeit mit Paket, ~85 s ohne — der Löwenanteil ist das Offline-Archiv,
das zweimal gepackt werden muss).

### Gegenprobe vorbereiten (braucht Java + Saxon)

```sh
OX="C:/Users/hp/Desktop/Oxygen XML Editor 17/lib"
java -cp "$OX/saxon9ee.jar" net.sf.saxon.Transform -s:<in> -xsl:<xsl> -o:<out>

npm run verify:prepare     # erzeugt temp/fixedDOM-<slug>.xml
```

### Browser

Chrome und Edge sind installiert. **Playwright liegt global** (`npm i -g playwright`),
bewusst nicht im Repo. `check-site.js` löst es über `npm root -g` auf und startet das
System-Chrome (`channel: 'chrome'`). Geprüft wird mit **und ohne** JavaScript.

Screenshot ohne Playwright, reicht für einen schnellen Blick:

```sh
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu \
  --window-size=1600,1000 --virtual-time-budget=8000 --allow-file-access-from-files \
  --screenshot=out.png "file:///<absoluter Pfad>/site/indesign/Rectangle.html"
```

`--dump-dom` gibt das DOM nach JS-Ausführung aus. **Achtung:** Die Ausgabe enthält auch
`<style>` und `<script>`; beim Zählen von Elementen beide vorher entfernen, sonst zählt
man Template-Literale aus dem Quelltext mit.

---

## Verzeichnisse

| Pfad | Inhalt |
|---|---|
| `build/` | die Pipeline — Modell, Rendering, Tests, agents.js |
| `sourceXML/` | Adobe-Originale je Produkt/Version, **nicht** versioniert |
| `site/` | erzeugte Website, gitignored |
| `design/` | eingefrorene Prototypen der Designphase (Konzepte A, B, C) |
| `temp/` | nur für `npm run verify`; `prepare-xslt.js` legt den Ordner selbst an |

`domOut/`, `skinAndInfo/` und die Download-Zips sind mit der DITA-Strecke weg.
Der Inhalt von `sourceXML/` ist **nicht in der Git-Historie** — vor dem Löschen dort
immer rückfragen.

---

## Konventionen

- Commit-Messages ohne `Co-Authored-By`-Zeilen.
- Code-Kommentare auf Deutsch mit Umlauten; keine Historie oder alte Bugs beschreiben,
  nur den aktuellen Zustand samt knapper Begründung möglicher Fallstricke.
- Bezeichner, Dateinamen und Beispielcode bleiben Englisch. Das Wurzel-`README.md` ist
  englisch (öffentliches GitHub-Publikum), `build/README.md` deutsch (interne Doku).
- Im generierten Output gehören Adobe-Copyright und ein Hinweis auf die
  KI-Unterstützung in den Footer.
