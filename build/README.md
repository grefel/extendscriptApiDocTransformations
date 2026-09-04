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
vollständig auflistet — jede Seite bleibt also navigierbar.

## Ohne JavaScript

Jede Seite ist vollständig im Markup: Beschreibung, Vererbung, Properties, Events,
Methoden mit Parametern, die drei Rückwärtsverweise und der Footer. Das Skript
ergänzt nur Bedienelemente; die sind im HTML als `[hidden]` markiert und werden
erst durch das Skript eingeschaltet. `check-site.js` prüft das mit abgeschaltetem
JavaScript mit.

## Zwei Browser

Der Hauptlauf nutzt das System-Chrome (`channel: 'chrome'`). Am Ende folgt eine
kurze **Gegenprobe in Firefox**: Theme und „Recent" halten ihren Zustand über
`localStorage`, und dessen Verhalten auf `file://` unterscheidet sich je Browser
— geprüft, nicht angenommen. Firefox hält beides auch dort.

Der Firefox-Build gehört nicht zum globalen Playwright und wird bei Bedarf mit
`npx playwright install firefox` geholt; fehlt er, meldet der Lauf `SKIP` statt
zu scheitern.

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

### Theme, Laufzeit und Rechtliches

- **Das Thema setzt ein Inline-Skript im `<head>`**, nicht `site.js`. Letzteres
  läuft mit `defer` und damit erst nach dem Parsen — die Folgeseite erschien
  dadurch beim Navigieren kurz im dunklen Standardthema und klappte dann um.
  Das sah aus, als ginge die Einstellung verloren; tatsächlich hält
  `localStorage` auch über `file://` hinweg. Ein URL-Parameter wäre die
  Alternative gewesen, hätte aber jeden Link verschmutzt.
- Der Themeknopf nennt das **Ziel**, nicht den Zustand: „light mode" schaltet
  nach hell.
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
  geöffneten Objekte, neuestes zuerst, ohne die aktuelle Seite. Je Produkt eine
  eigene Liste (`recent:<slug>` in `localStorage`), sonst stünde nach einem
  Produktwechsel ein fremdes `Document` neben dem eigenen. Deshalb auch die
  Beschriftung: ohne sie liest sich die Reihe als Hierarchie.
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
