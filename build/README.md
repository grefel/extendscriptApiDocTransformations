# build — XML → statische Website

Einziger Schritt vom Adobe-Objektmodell zur fertigen Website.
**Weder oXygen noch Java noch Saxon werden gebraucht.**

```
sourceXML/*.xml → build/ (Node) → site/   2.681 Seiten
```

## Benutzung

```sh
npm install
npm run build      # site/ neu bauen        ~7 s
npm run check      # Website im Browser prüfen (Playwright)
npm run serve      # http://localhost:8080

# nur solange die alte Strecke als Gegenprobe dient (braucht Java + Saxon):
npm run verify:prepare   # temp/fixedDOM-*.xml über mergeFiles.xslt + fixDom.xsl
npm run verify           # Portierung dagegen halten — 0 echte Abweichungen
```

Abweichende Pfade über `DOM_XML` und `OUT_DIR`.

## Dateien

| Datei | Aufgabe |
|---|---|
| `model.js` | XML → Datenmodell, plus Ableitungen (Collections, Rückwärtsindizes) |
| `render.js` | Datenmodell → HTML |
| `build.js` | schreibt `site/`, prüft Dateinamen-Kollisionen |
| `assets/site.css` | Stylesheet aller Seiten |
| `assets/site.js` | Verbesserungen: Navigation, Filter, Suche, Zwischenablage |
| `verify-model.js` | Gegenprobe zur XSLT-Extraktion |
| `check-site.js` | Browsertest der fertigen Website |
| `serve.js` | Entwicklungsserver, ohne Abhängigkeit |
| `zip.js` | minimaler ZIP-Schreiber für das Offline-Archiv |
| `notes.js` | Hinweise, die nicht im Objektmodell stehen |
| `additions.js` | Member, die Adobes Export vergisst |
| `shortcuts.js` | Einstiegspunkte auf der Übersichtsseite |
| `agents.js` | Markdown, api.json, llms.txt und die TypeScript-Deklarationen |

## Abhängigkeiten

Genau eine zur Laufzeit des Builds: **`@xmldom/xmldom`** (0 transitive
Abhängigkeiten). Playwright nur für `npm run check`. Die **Website selbst hat
keine** — kein Framework, kein CDN, kein Build-Schritt im Browser.

## Zwei Entscheidungen, die im Code nicht sofort sichtbar sind

**Kein `fetch`.** Navigationsliste und Suchindex kommen als `<script>`-Dateien,
nicht per `fetch`. Grund ist der Offline-Download: über `file://` blockiert Chrome
`fetch`, ein Script-Tag lädt weiterhin. Der Suchindex (3 MB, 490 KB gzip) wird
erst beim ersten Öffnen der Palette nachgeladen.

**Die Seitenleiste steht nicht im Markup.** 1.153 Einträge wären ~70 KB auf jeder
der 1.153 Seiten. Sie kommt aus `assets/nav.js`, das der Browser einmal cacht.
Ohne JavaScript führt stattdessen ein Link auf `index.html`, das alle Objekte
vollständig auflistet — jede Seite bleibt also navigierbar. Das Skript verbirgt
diesen Notnagel-Link, sobald die Liste steht; er bleibt im DOM.

**Zwei Filter, die nichts miteinander zu tun haben.** Das Feld über den Tabellen
filtert die Member der Seite, das Feld in der Seitenleiste nur die Objektliste
daneben. Letzteres ist reine Teilzeichenkette ohne Rücksicht auf Groß- und
Kleinschreibung — die unscharfe Suche über alles leistet die Palette (`Strg/Cmd+K`).
Gefiltert wird in `buildNav()` selbst, deshalb stimmen die Zahlen in den
Zwischenüberschriften automatisch und zeigen beim Filtern beide Werte
(`Objects · 31 / 423`). Ein Neuaufbau kostet ~6 ms je Anschlag.
Der Begriff überlebt den Seitenwechsel (`navq`), damit ein Weg durch mehrere
`Text*`-Objekte nicht bei jedem Klick von vorn beginnt; sichtbar bleibt er im
Feld und in den Zahlen. `Esc` leert ihn, ohne die Palette zu öffnen.

## Ohne JavaScript

Jede Seite ist vollständig im Markup: Beschreibung, Vererbung, Properties, Events,
Methoden mit Parametern, die drei Rückwärtsverweise und der Footer. Das Skript
ergänzt nur Bedienelemente; die sind im HTML als `[hidden]` markiert und werden
erst durch das Skript eingeschaltet. `check-site.js` prüft das mit abgeschaltetem
JavaScript mit.

## Offline: die ganze Website als Archiv

`site/extendscriptAPI.zip` — **16 MB, 5.395 Dateien**, entpacken und
`index.html` öffnen. Verlinkt auf der Startseite und jeder Übersichtsseite.
Es muss wirklich alles hinein: die Typverweise gehen über Produktgrenzen
hinweg, ein Teilarchiv wäre kaputt.

Geschrieben von `build/zip.js`, rund 100 Zeilen über `zlib.deflateRawSync`
plus CRC-Tabelle. **Keine Abhängigkeit** — ZIP ist ein eingefrorenes Format,
und die Abhängigkeitsarmut ist hier ein Merkmal. Kein Zip64: bei mehr als
65.535 Dateien oder 4 GB bricht der Schreiber ab, statt still Falsches zu
liefern.

**Zweimal gepackt.** Die Übersichtsseiten nennen die Archivgröße, und die steht
erst nach dem Packen fest. Der zweite Durchgang unterscheidet sich nur um
wenige Bytes; auf ganze MB gerundet stimmt die Zahl in beiden — auch in der
Fassung, die im Archiv landet. Kostet rund 10 s der 21 s Bauzeit.

Geprüft wird das Archiv, indem es entpackt und die entpackte Kopie im Browser
bedient wird: Navigation, Seitenleiste, Volltextsuche.

## Kurzreferenz

Die Übersichtsseiten von InDesign und InDesign Server zeigen die
**InDesign-Skripting-Kurzreferenz** — das Objektmodell auf einer Querformatseite,
verlinkt auf <https://www.indesignjs.de/idskurzreferenz.pdf>. Gesteuert über
`refcard: true` in `products.js`; Illustrator und Photoshop bekommen sie nicht,
dort wäre sie falsch.

**Die Vorschau ist ein Standbild und wird nicht mitgeneriert.** Sie liegt als
`build/assets/idskurzreferenz.jpg` (840×604, 86 KB) und muss von Hand erneuert
werden, wenn sich das PDF ändert. Erzeugt mit Chrome im **sichtbaren** Fenster —
headless gibt es keinen PDF-Betrachter:

```js
const pg = await browser.newPage({ viewport: { width: 420, height: 302 },
                                   deviceScaleFactor: 2 });
await pg.goto("file:///…/idskurzreferenz.pdf#toolbar=0&navpanes=0&view=Fit");
await pg.screenshot({ path: "build/assets/idskurzreferenz.jpg",
                      type: "jpeg", quality: 82 });
```

## Für Editoren und KI-Agenten

`build/agents.js` erzeugt aus demselben Modell wie das HTML vier weitere
Ausgaben. Nichts davon wird aus der fertigen Seite zurückgelesen.

| Ausgabe | wofür | Größe (InDesign) |
|---|---|---|
| `<slug>/<slug>.d.ts` | beim **Schreiben** von Code: liegt im Projekt, der Sprachserver antwortet ohne Abruf | 4,5 MB |
| `<slug>/<Object>.md` | beim **Nachschlagen**: gleiche URL wie die Seite, ohne Markup | 40 KB statt 137 KB |
| `<slug>/api.json` | eigenes Werkzeug | 7 MB |
| `llms.txt` (Wurzel und je Ziel) | der Einstieg, der auf all das zeigt | 1,8 KB / 151 KB |

Die `.d.ts` ist **in sich geschlossen**: ein Produkt plus Core JavaScript und
ScriptUI. Eine Datei ins Projekt legen und fertig — Verweise auf Nachbardateien
wären beim Herunterladen nur eine Fehlerquelle.

`llms.txt` ist eine Konvention, kein Standard; nichts findet sie von allein. Ihr
Wert liegt darin, dass man sagen kann „richte deinen Agenten auf diese URL".

### Was beim Übersetzen schiefging

**`npm run check:types` übersetzt jede Deklaration mit dem echten Compiler.**
Ohne diesen Lauf wäre die Zusage „hier sind Typen" ungedeckt — beim ersten
Versuch scheiterten alle sieben Dateien an **719 Fehlern**, alle mit derselben
Ursache: Adobe benutzt reservierte Wörter als Parameternamen
(`findKeyStrings(for)`, `prompt(…, default, …)`, `rotate(with)`). In einer
Deklarationsdatei ist der Parametername reine Dokumentation, deshalb trägt er
jetzt einen Unterstrich (`for_`, `default_`).

Übersetzt wird mit `--lib es5` und **ohne `dom`**: ExtendScript ist kein Browser,
und mit den DOM-Definitionen kollidieren `Document` und `Event`.

### Typabbildung

Adobes Typangaben sind teils Prosa; 116 der vorkommenden Namen bezeichnen keine
Klasse. Die Regeln in `agents.js` fangen das Meiste ab — `Int`/`LongInteger`/
`Unit` → `number`, `3 Reals (0 - 255)` → `number[]`, `NothingEnums` →
`NothingEnum[]`, `Index` → `Index_`.

Zwei Sonderwege:

- Ein **sauberer Bezeichner, den Adobe nie definiert** (`ElementPlacement`,
  `MatrixContent`) behält seinen Namen und bekommt am Kopf der Datei ein
  `type X = any`. Das ist ehrlicher als ein nacktes `any` und lässt erkennen,
  was gemeint war.
- Ein **Doppelpunkt im Typnamen** ist immer ein Adobe-Datenfehler
  (`Orderedarraycontainingkey:String`) und wird zu `any`. Der Build meldet je
  Produkt, wie oft das passiert: 856 bei InDesign, davon allein 528 aus zwei
  kaputten Angaben.

## Schmales Fenster

Sauber bis hinunter zu **650 px** Fensterbreite, ohne waagerechtes Scrollen.
`check-site.js` misst das bei sieben Breiten auf zwei Seiten nach.

Mit Zoom zählt die **logische** Breite, also Fenster ÷ Zoom — dieselbe Grenze.
Beim Standardzoom 1,15 heißt das: ein 750-px-Fenster ist logisch 652 px und
gerade noch drin. Der Kopf ist der engste Punkt; gemessen passt er bis 950 px
logischer Breite, bei 925 px ragt er 11 px heraus. Darum treten Tastenkürzel
und API-Version ab 950 px ab, nicht erst ab 900.
1000 px bei 150 % sind logisch 667 px und damit in Ordnung, 900 px wären 600 px
und damit darunter. Unterhalb von 650 px müsste die Seitenleiste einklappen; das
ist eigene Arbeit.

Drei Stellen brauchen deshalb eine Reserve, die bei normaler Schrift nie greift:
`.args` bekommt `minmax(0,auto)` statt `auto` für die beiden ersten Spalten, und
Beschreibungen (`.mem .desc`, `td.d`, `.arg .ad`) `overflow-wrap:anywhere` —
Adobe schreibt dort gelegentlich einen Pfad oder Bezeichner am Stück.

Die Tabellen laufen mit **`table-layout:fixed`**. Vorher bestimmte der längste
Bezeichner die Namensspalte — `allowFontSizeAndLeadingAdjustment` erzwang 229 px,
und bei schmalem Fenster blieb der Beschreibung nichts mehr. Die Kehrseite: eine
zu schmal deklarierte Spalte schiebt ihren Inhalt jetzt in die Nachbarspalte,
statt die Tabelle zu verbreitern. Deshalb prüft `check-site.js` **beides** —
Seitenüberhang *und* Zellen, deren Inhalt breiter ist als die Zelle.

Genau daran ist die Zugriffsspalte zuerst gescheitert: als Prozentwert war sie
bei mittlerer Fensterbreite zu schmal für „read/write", und der Text lief in die
Beschreibung. Sie hat jetzt eine **feste Breite** — der Wortlaut ist fest, der
Platzbedarf also auch.

| Breite | Verhalten |
|---|---|
| ab 1250 px | „Recent" mit drei Einträgen |
| ab 1100 px | rechte Spalte, Zugriff ausgeschrieben (78 px) |
| unter 1100 px | rechte Spalte weg, Zugriff als `ro`/`rw` (46 px, Kopf „ACC"), Beschreibung bekommt den Platz |
| unter 900 px | Kopfzeile schrumpft (Tastenkürzel und API-Version treten ab), Parameter stehen untereinander statt in drei Spalten |

Zwei Stellen brauchen eine saubere Trennstelle statt eines harten Umbruchs:
`td.n` und `td.t` bekommen `overflow-wrap:anywhere` als letzte Reserve, und die
Collection-Notation trägt ein `<wbr>` vor der Klammer — aus
`EventListeners<EventListener>` wird so ein Umbruch **vor** `<EventListener>`
statt mitten im Bezeichner.

## Zwei Browser

Der Hauptlauf nutzt das System-Chrome (`channel: 'chrome'`) über `file://`. Am
Ende folgt eine kurze **Gegenprobe in Firefox über http** — Theme und „Recent"
halten ihren Zustand in `localStorage`, und das verhält sich je Browser anders.

Der Firefox-Build gehört nicht zum globalen Playwright und wird bei Bedarf mit
`npx playwright install firefox` geholt; fehlt er, meldet der Lauf `SKIP` statt
zu scheitern.

### Offline in Firefox: kein Seitenzustand möglich

**Ein ausgeliefertes Firefox gibt jeder lokalen Datei einen eigenen
Storage-Origin** (`privacy.file_unique_origin`, Standard seit FF 68). Nachgemessen
an Firefox 152, zwei Seiten desselben Ordners:

```
storage/default/file++++…+site+indesign+Rectangle.html
storage/default/file++++…+site+indesign+Document.html
```

Zwei Ordner, zwei getrennte Speicher. Folge beim Offline-Download:

- Das **Theme** fällt bei jedem Seitenwechsel auf den Standard zurück.
- **„Recent"** füllt sich nie und bleibt deshalb ausgeblendet.

Es gibt dort keinen Ausweg: `sessionStorage` und IndexedDB unterliegen derselben
Trennung, Cookies gibt es auf `file://` nicht, und `window.name` — sonst die
klassische Reserve — wird beim Origin-Wechsel geleert (ebenfalls nachgemessen).
Bliebe der Zustand in jedem Link, was jede URL verschmutzt.

**Chrome ist nicht betroffen**, es teilt einen Origin über alle lokalen Dateien.
Über http, also auf dem Server, gibt es ohnehin nur einen Origin — dort
funktioniert Firefox genauso wie Chrome.

Wichtig für Tests: **Playwrights Firefox bildet das nicht nach**, auch nicht mit
gesetztem `privacy.file_unique_origin`. Eine `file://`-Zusage wäre dort grün und
in der Wirklichkeit falsch — deshalb läuft die Gegenprobe über http.

## Größen

| | roh | gzip |
|---|---|---|
| Objektseite (Rectangle) | 133 KB | **16 KB** |
| größte Seite (Document) | 197 KB | 22 KB |
| `site.css` + `site.js` | 24 KB | 8 KB |
| `nav.js` | 29 KB | 7 KB |
| `search.js` (bei Bedarf) | 3,0 MB | 491 KB |
| gesamt `site/` | 25 MB | — |

## Noch offen

- Vom UXP-Umschalter ist nur noch der Wegfall der `[]`-Methoden übrig. Welche
  weiteren Unterschiede zwischen ExtendScript und UXP in die Daten gehören,
  ist noch zu klären.
- Für Illustrator und Photoshop sind fünf bzw. zwei Collections ohne erkennbaren
  Elementtyp — dort fehlen `[]`, `getByName` und `add`.

## Mehrere Produkte

`build/products.js` listet die Anwendungen mit ihrer jeweils neuesten OMV-XML.
`npm run build` liest sie direkt und baut daraus die Website.

| Ordner | Einträge |
|---|---|
| `indesign` | 1.097 |
| `indesign-server` | 966 |
| `illustrator` | 292 |
| `photoshop` | 226 |
| `bridge` | 37 |
| `javascript` | 22 |
| `scriptui` | 34 |

**ScriptUI und die Kern-JavaScript-Klassen sind eigene Bibliotheken.** Sie stecken
in jeder Produkt-XML identisch drin (22 bzw. 34 Klassen) und werden einmal
ausgegeben statt fünfmal. Damit entfällt auch die alte Sonderbehandlung, `$` und
alles mit Suffix `SUI` im UXP-Modus auszublenden — im Objektmodell eines Produkts
kommen sie gar nicht mehr vor. Vom UXP-Umschalter bleibt genau ein Unterschied:
die Methoden mit dem Namen `[]`.

Typverweise lösen erst im eigenen Produkt auf, dann in den gemeinsamen
Bibliotheken. `Document` bleibt so im eigenen Produkt, `File` landet unter
`../javascript/File.html`.

Der Produktumschalter im Kopf ist ein `<details>` und funktioniert ohne
JavaScript. Gibt es das gleichnamige Objekt im Zielprodukt, springt er direkt
dorthin (`indesign/Rectangle` → `illustrator/Rectangle`), sonst auf dessen Index.

### Produktspezifische Fallstricke

- **Collections werden je Produkt anders markiert.** InDesign: Methode
  `everyItem`. Illustrator und Photoshop: die Properties `length` + `parent` +
  `typename`. Sonst: die Beschreibung nennt sich selbst „collection". Nur
  `length` allein reicht nirgends — das haben auch `Array`, `String` und
  `Function`. Bridge hat danach null Collections, und das stimmt.
- **Elementtyp einer Collection**: InDesign liefert ihn über `[]`, Illustrator
  und Photoshop über `getByName` oder `add`.
- **Der Titel kommt in drei Formen** — „Object Model", „Type Library",
  „Object Library" — und nur InDesign nennt eine Buildnummer.
- **Illustrator, Photoshop und Bridge haben keine Events.**
- Photoshops neueste verfügbare XML ist CC 2015.5 von 2016; das steht als
  Hinweis auf der Startseite und der Produktseite.

### Hinweise, die nicht im Objektmodell stehen

Adobes Export beschreibt, was es gibt — nicht, was davon kaputt ist. Solche
Erfahrungswerte stehen in `build/notes.js` und erscheinen als Warnung unter der
Beschreibung des Objekts. Je Eintrag: auf welche Ziele er passt (`products`),
optional auf welche Laufzeit (`runtime`), und der Text.

Drei Sorten: `byName` für ein einzelnes Objekt, `byKind` für alle Objekte
einer Art, `byMember` für eine einzelne Tabellenzeile (Schlüssel
`Objekt.member`). Der Member-Hinweis steht in der Beschreibungsspalte —
ein Kasten oben an der Seite wäre für eine von 341 Properties die falsche
Stelle.

Nicht zu verwechseln mit `additions.js`: dort stehen **Member selbst**, die
Adobes Export vergisst, hier nur Hinweise **ueber** Member.

**`XMLElements.itemByName()`** — nur unter UXP ein Problem. Dort funktioniert
sie nicht, der Weg führt über `evaluateXPathExpression()` am übergeordneten
`XMLElement`.

Der Fall zeigt, wozu `additions.js` da ist: **Adobes XML-Export führt die
Methode gar nicht auf** (nachgesehen in `sourceXML/id_26.xml`, dort stehen
nur `count`, `add`, `item`, `itemByID`, `itemByRange` und die üblichen).
Im Object Model Viewer steht sie, und unter ExtendScript funktioniert sie seit
CS3 bis InDesign 2026. Sie wird deshalb ergänzt und als
`uxp: false` markiert, damit der UXP-Modus sie ausblendet.

`check-site.js` prüft beide Richtungen: unter ExtendScript ist die Methode da
und der Hinweis weg, unter UXP umgekehrt. Und dass `Pages` seine eigene
`itemByName` aus der Quelle behält.

**`equals()` statt `==` an allen Enumerations**, nur unter UXP. Adobes
Migrationsanleitung nennt genau diesen Fall, und zwar mit einem
Enumerationswert als Beispiel — deshalb steht der Hinweis dort und nicht an
jedem Objekt, wo er nur Rauschen wäre.

### Zwei Zeilen, die nur Rauschen waren

**`NothingEnum` erzeugt keine Wertechips mehr.** Der Enum hat genau einen Wert,
`NOTHING`, und der heißt nur „kann auch leer sein". Als Chip stand er unter
**1.487 Properties** und verdeckte in 11 Fällen den echten Enum daneben — bei
`CellStyle` trug fast jede Zeile einen. `inlineEnum()` überspringt ihn jetzt;
die nützlichen Chips (`CENTER_ALIGN`, `ASCENT_OFFSET` …) bleiben.

**Die Vererbungszeile entfällt, wenn es keine Vorfahren gibt.** Bei `CellStyle`
stand dort nur `CellStyle` — eine Zeile, die den Seitentitel wiederholt.
Betrifft alle 432 Enumerations und jedes Objekt ohne `superclass`.

Nachfahren zeigt die Seite nicht; ableitbar wäre das (`sup` rückwärts), bisher
nicht gebaut.

### Einstiegspunkte auf der Übersichtsseite

Die Seitenleiste listet alle 1.097 Objekte — das hilft beim Suchen, nicht beim
Anfangen. `build/shortcuts.js` hält 19 Blasen, geordnet nach der Hierarchie
statt alphabetisch: `app → document → spread/page → Rahmen → Text`, dazu
Bilder, Formate, Tabellen und die GREP-Einstellungen. Sie stehen links neben
der Kurzreferenz, weil beide dieselbe Frage beantworten.

Nur für InDesign und InDesign Server. `render.js` filtert die Liste gegen das
jeweilige Modell, damit keine Blase ins Leere zeigt, falls Adobe einmal ein
Objekt umbenennt — geprüft wird das auch.

### Zwei Hinweise aus Adobes Migrationsanleitung

An `Application.activeScript` (unter UXP nur ein Pfad als String, kein
File-Objekt) und `Application.scriptArgs` (unter UXP `script.args`). Beide nur
im UXP-Modus sichtbar.

### Was unter UXP wegfällt

**Ein `File` als Event-Handler gibt es dort nicht.** Betrifft
`addEventListener`, `removeEventListener` und `EventListeners.add` — 832
Parameter. Im UXP-Modus verschwindet die Alternative aus der Typangabe,
**samt Trennstrich**: sonst begänne die Zeile mit einem einsamen `|`.
`typeList()` packt dafür den Typ und den angrenzenden Strich in einen
gemeinsamen `data-uxp="hide"`-Knoten.

`app.doScript()` bleibt ausdrücklich unberührt — dort läuft eine
ExtendScript-Datei auch unter UXP.

### File und Folder unter UXP

Beide heißen in UXP genauso und sind eine völlig andere API — kein globales
`File`, sondern `require("uxp").storage.localFileSystem`. Im UXP-Modus zeigen
die Typlinks deshalb auf Adobes UXP-Referenz statt auf die ExtendScript-Klasse.

Das Ziel steht als `data-uxp-href` im Markup, umgehängt wird in `site.js`; das
ursprüngliche Ziel wandert dabei nach `data-es-href`, damit das Zurückschalten
stimmt. Nur die beiden InDesign-Ziele bekommen das Attribut — sie allein haben
den Umschalter.

### Theme, Laufzeit und Rechtliches

- **Hell ist der Standard.** Ohne gespeicherte Wahl und ohne JavaScript gilt die
  helle Palette — sie steht auf `:root`, die dunkle unter `:root[data-t="dark"]`.
  Es wird also nur gesetzt, wer ausdrücklich dunkel will.
- **100 % bedeutet zoom 1,15.** Der ungezoomte Standard war zu klein. Die
  Bezugsgröße steht als `--fs: 1.15` im Stylesheet, damit ohne JavaScript
  dasselbe gilt, und die Knöpfe beschriften relativ dazu.
- **Tabellenzellen sitzen auf einer Grundlinie** (`vertical-align: baseline`).
  Die vier Spalten haben verschiedene Schriftgrößen; mit `top` standen die
  Kästen bündig und die Schriften versetzt — gemessen 7 px Versatz, jetzt 1 px.
- **Zoom über A− / A+ im Kopf.** Fünf Stufen von 85 % bis 150 %, gemerkt unter
  `fs`, gesetzt als `zoom: var(--fs)` auf `:root`. Am Anschlag wird der Knopf
  abgeblendet statt ausgeblendet, sonst springt der Kopf.

  Ein erster Versuch skalierte **nur die Schriftgrößen** und ließ das Layout
  stehen. Das Ergebnis war eng: die Objektspalte blieb 230 px breit und schnitt
  die Namen ab, `read/write` brach auf zwei Zeilen um. `zoom` skaliert Schrift,
  Polsterung und Spaltenbreiten zusammen — wie der Zoom des Browsers.

  Zwei Dinge, die `zoom` mitbringt und die man einmal wissen muss:

  - **`100vh` rechnet den Zoom nicht mit.** Im skalierten Koordinatenraum
    stehen nur `100vh / var(--fs)` zur Verfügung; ohne die Division ragte die
    Seitenleiste bei 150 % um 500 px unter das Fenster.
  - **Media Queries sehen weiter die echte Fensterbreite.** Bei 150 % auf
    1000 px hat die Seite logisch 667 px, nähme aber die Regeln für 1000 px.
    Die drei Breiten-Umbrüche sind deshalb **Container Queries** auf `body`
    (`container: page / inline-size`) — ein Container misst im skalierten Raum.
    Nur `@media print` ist geblieben.

  Geprüft wird die gerenderte Größe, nicht `getComputedStyle().fontSize`:
  `zoom` lässt die berechnete Schriftgröße unverändert.
- **Das Thema setzt ein Inline-Skript im `<head>`**, nicht `site.js`. Letzteres
  läuft mit `defer` und damit erst nach dem Parsen — die Folgeseite erschien
  dadurch beim Navigieren kurz im dunklen Standardthema und klappte dann um.
  Das sah aus, als ginge die Einstellung verloren; tatsächlich hält
  `localStorage` auch über `file://` hinweg. Ein URL-Parameter wäre die
  Alternative gewesen, hätte aber jeden Link verschmutzt.
- Der Themeknopf nennt das **Ziel**, nicht den Zustand: „light mode" schaltet
  nach hell.
- **Eingabefelder haben einen eigenen Rahmenton, `--field`.** `--line` ist für
  Tabellenlinien gedacht und lag bei **1,03:1** gegen die Leiste — als Umriss
  eines Bedienelements unsichtbar, im dunklen Thema erst recht. WCAG 1.4.11
  verlangt dort 3:1; `--field` liefert 3,09 (hell) und 3,13 (dunkel), in beiden
  Themen geprüft.
- **Event-Namen sind Namen wie alle anderen.** Sie hatten `--ev` und damit eine
  eigene Farbe; kenntlich sind sie schon durch die eigene Tabelle. Die Farbe
  bleibt nur als Art-Kennzeichnung in der Suchpalette.
- **Die Recent-Spur trennt mit `|`.** Als eigene Elemente, nicht als `::before`
  im Link — sonst gehörte der Strich zur Klickfläche und würde beim Kürzen
  mit abgeschnitten.
- **`color-scheme` wandert mit dem Theme mit.** Ohne das zeichnet Chrome helle
  System-Scrollbalken in die dunkle Seite — Firefox ist da von Haus aus
  zurückhaltender, deshalb fiel es zuerst nur in Chrome auf. Es färbt auch die
  Löschtaste im Suchfeld und die Fokusringe mit. Zusätzlich `scrollbar-width`
  und `scrollbar-color` (Standard, Firefox ab 64, Chrome ab 121) sowie
  `::-webkit-scrollbar` für ältere WebKit-Stände.
  Zu prüfen ist das nur in einem **echten Fenster**: headless zeichnet Chrome
  Overlay-Balken, die keinen Platz belegen und im Bildschirmfoto fehlen. Die
  Prüfung beschränkt sich deshalb auf `color-scheme`.
- **Den Laufzeit-Umschalter tragen nur InDesign und InDesign Server**
  (`uxp: true` in `products.js`). Nur für sie beschreibt dieses Objektmodell
  zugleich die UXP-Laufzeit. Illustrator und Bridge kennen ohnehin keine Methode
  `[]`; Photoshop hat 14 davon, aber eine eigene, hier nicht abgebildete
  UXP-API — ein Umschalter wäre dort irreführend.
  Fehlt der Umschalter, gilt auf der Seite immer ExtendScript: sonst könnte ein
  anderswo gespeichertes `uxp` Member ausblenden, die niemand zurückholen kann.
- **Core JavaScript und ScriptUI** gibt es nur unter ExtendScript — UXP nutzt
  eine andere Engine und kennt weder `$` und `File` noch ScriptUI. Im
  Produktumschalter stehen sie als „ExtendScript only".
- **„Recent" im Kopf ist eine Recency-Spur, kein Breadcrumb** — die drei zuvor
  geöffneten Objekte, neuestes zuerst, ohne die aktuelle Seite. Deshalb auch die
  Beschriftung: ohne sie liest sich die Reihe als Hierarchie.
  **Eine Liste über alle sieben Ziele** (`recent` in `localStorage`, Einträge als
  `[slug, name]`). Der Weg von `Document` zu `String` führt über die
  Bibliotheksgrenze, und genau dorthin will man zurück. Aussortiert wird nach
  Ziel **und** Namen, damit InDesigns und Illustrators `Document` nebeneinander
  stehen bleiben. Sie werden bewusst **nicht** beschriftet — welches gemeint
  ist, zeigt die Statusleiste beim Zeigen auf den Link, und drei Einträge
  vertragen keine zusätzliche Spalte.
  Sie ist der einzige `data-enhance`-Knoten, der auch mit JavaScript verborgen
  bleiben darf — ohne Verlauf gäbe es nur eine leere Beschriftung.
  Die Grenzwerte sind gemessen, nicht geschätzt: bis 1250 px stehen alle drei
  Namen ungekürzt, darunter fällt der älteste weg, unter 1100 px die ganze Spur
  — dort verschwindet auch die rechte Spalte. Eine erste Fassung blendete schon
  ab 1280 px aus und war auf einem normalen Laptopfenster nie zu sehen.
- Der Footer verlinkt **Impressum** und **Datenschutz** auf publishingx.de.

## Stufe 2: XSLT vollständig abgelöst

`mergeFiles.xslt` und `fixDom.xsl` sind nach `build/fixdom.js` portiert. Der Build
liest die drei OMV-XMLs direkt und bereinigt beim Einlesen — es gibt keine
Zwischendatei mehr.

`npm run verify` hält die Portierung gegen die alte Saxon-Strecke:
**0 echte Abweichungen in allen fünf Produkten**, bei 252 verbesserten Membern.

### Dabei behobene Fehler der alten Strecke

1. **`Can also accept:` ging verloren.** In `px:cleanAcceptReturn` hieß die zweite
   Variable wie die erste und las deren *Eingabe* statt deren Ergebnis:

   ```xml
   <xsl:variable name="clean2" select="replace($clean1, 'Can also accept:', ',')"/>
   <xsl:variable name="clean2" select="replace($clean1, 'Can accept:', ',')"/>
   ```

   Aus „Can return: Swatch or NothingEnum enumerator. Can also accept: String."
   wurde dadurch der Typ `NothingEnumCanalsoaccept:String` statt der drei Typen
   `Swatch`, `NothingEnum`, `String`. Betraf 78 Typen je InDesign-Modell.
2. **Satzzeichen am Typnamen.** Der `Array`-Zweig von `cleanTypeName` überspringt
   die übrige Bereinigung, deshalb blieb aus „Array of Conditions." der Typ
   `Conditions.` übrig — mit Punkt verlinkte er nicht.
3. **Leerraum aus `indent="yes"`.** In gemischtem Inhalt fügte die Zwischendatei
   Zeilenumbrüche zwischen Elemente ein: aus `<a>navbars</a><b>.filesystem</b>`
   wurde „navbars .filesystem".
4. **Leeres `<value/>`** ergab den Standardwert `""` und damit ein nacktes „= "
   in der Tabelle. Wird jetzt weggelassen.
5. **Die eingefügte AppleScript-Konstante** trug den Typ `number` klein, weil auf
   literale Ausgabe keine Templates greifen. Jetzt `Number` wie überall sonst.

### Was von der alten Strecke noch da ist

`mergeFiles.xslt`, `fixDom.xsl`, `build/prepare-xslt.js` und `build/legacy-model.js`
werden **nur noch für `npm run verify`** gebraucht. Sobald die Gegenprobe nicht
mehr gewünscht ist, können alle vier weg — der Build rührt sie nicht an.
