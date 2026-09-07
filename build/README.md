# build — XML → statische Website

Einziger Schritt vom Adobe-Objektmodell zur fertigen Website.
**Weder oXygen noch Java noch Saxon werden gebraucht.**

```
sourceXML/*.xml → build/ (Node) → site/   2.681 Seiten
```

## Benutzung

```sh
npm install
npm run build      # site/ neu bauen, dazu site.zip zum Hochladen   ~90 s
NO_PACKAGE=1 npm run build   # ohne das Paket, für schnelle Durchläufe
npm run check      # Website im Browser prüfen (Playwright)
npm run check:types # jede .d.ts und jedes Beispielskript mit tsc
npm run serve      # http://localhost:8080

# nur solange die alte Strecke als Gegenprobe dient (braucht Java + Saxon):
npm run verify:prepare   # temp/fixedDOM-*.xml über mergeFiles.xslt + fixDom.xsl
npm run verify           # Portierung dagegen halten — 0 echte Abweichungen
```

Abweichende Pfade über `DOM_XML` und `OUT_DIR`.

## Dateien

| Datei | Aufgabe |
|---|---|
| `model.js` | XML → Datenmodell, plus Ableitungen (Collections, Rückwärtsindizes, Nachfahren) |
| `render.js` | Datenmodell → HTML |
| `build.js` | schreibt `site/`, prüft Dateinamen-Kollisionen |
| `assets/site.css` | Stylesheet aller Seiten |
| `assets/site.js` | Verbesserungen: Navigation, Filter, Suche, Zwischenablage |
| `verify-model.js` | Gegenprobe zur XSLT-Extraktion |
| `check-site.js` | Browsertest der fertigen Website |
| `serve.js` | Entwicklungsserver, ohne Abhängigkeit |
| `zip.js` | minimaler ZIP-Schreiber für das Offline-Archiv |
| `notes.js` | Hinweise, die nicht im Objektmodell stehen |
| `additions.js` | Member, die Adobes Export vergisst, und falsche Typangaben |
| `shortcuts.js` | Einstiegspunkte auf der Übersichtsseite |
| `agents.js` | Markdown, api.json, llms.txt und die TypeScript-Deklarationen |
| `check-types.js` | übersetzt jede `.d.ts` und jedes Beispielskript mit `tsc` |
| `fixtures/*.js` | Alltagsskripte als Regressionstest der Deklarationen |

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

`site/indesignapi.zip` — **16 MB, 5.395 Dateien**, entpacken und
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

## Auslieferung: `site.zip`

Der Build legt am Ende **`site.zip` neben `site/`** — den ganzen Ordner in einem
Archiv, so wie er auf den Server geht: **ohne Ordnerpräfix**, `index.html` liegt
also gleich oben. Das Offline-Archiv `indesignapi.zip` ist mit drin, sonst zeigte
der Download auf dem Server ins Leere. 5.401 Dateien, 35,5 MB.

Ein vorhandenes `site.zip` wird **vor** dem Packen gelöscht: bricht der Lauf ab,
liegt lieber keines da als ein veraltetes, das wie das neue aussieht.

Gepackt wird aus dem, was ohnehin im Speicher liegt, plus dem eben gebauten
Archiv — kostet 3 s. Es ein zweites Mal von der Platte zu lesen kostete 27.
`NO_PACKAGE=1 npm run build` lässt das Paket weg (löscht das alte trotzdem);
für schnelle Durchläufe beim Entwickeln.

Geprüft mit `Expand-Archive`: 5.401 Dateien, Prüfsummen von `index.html`,
`Rectangle.html`, `indesign.d.ts`, dem JPEG und dem eingebetteten 18-MB-Archiv
stimmen mit `site/` überein.

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

Die `.d.ts` eines Produkts ist **in sich geschlossen**: das Objektmodell plus
Core JavaScript plus die globalen Namen. Eine Datei ins Projekt legen und fertig
— Verweise auf Nachbardateien wären beim Herunterladen nur eine Fehlerquelle.

### ScriptUI: kein Suffix mehr, dafür drei Dateien

Neun ScriptUI-Klassen heißen wie Produktklassen: `Window`, `Button`, `Event`,
`Events`, `Group`, `ListBox`, `Panel`, `RadioButton`, `StaticText`. Deshalb trug
das Modell sie mit Suffix (`WindowSUI`). **Sichtbar ist das Suffix nirgends
mehr** — weder in den Typen noch auf der Website: seit ScriptUI ein eigenes Ziel
mit eigenem Ordner ist, steht dort keine Produktklasse daneben.
`agents.withoutSuiSuffix` schreibt beim Zusammenstellen des Ziels Klassennamen
**und** alle Verweise um; im gemeinsamen Modell bleibt das Suffix, sonst
kollidierten die Klassen in `derive()`. Geprüft wurde vorher, dass kein
Produkt- und kein Kerntyp so heißt wie eine ScriptUI-Klasse, ohne selbst eine
zu sein — sonst zeigten Links plötzlich in die falsche Bibliothek.

Damit gibt es drei Zuschnitte:

| Datei | Inhalt | wofür |
|---|---|---|
| `<slug>.d.ts` | Objektmodell + Core JavaScript + globale Namen | Skript ohne Dialog |
| `scriptui.d.ts` | nur ScriptUI | Dialog ohne Hostbezug |
| `<slug>-scriptui.d.ts` | beides, die neun Produktklassen weichen | Skript **mit** Dialog |

Nebeneinander legen kann man sie nicht: gemessen 20 Fehler, zehn Namen doppelt.
TypeScript kennt je globalem Namen nur eine Bedeutung, das ist keine
Einstellungssache. In der kombinierten Datei gewinnt deshalb ScriptUI — ein
Dialog braucht `new Window(…)` —, und die neun Produktklassen fallen weg.
Verweise auf sie werden über `makeTypeMapper(known, toAny)` zu `any`: keine
Hilfe, aber auch nichts Falsches. Ohne diesen Weg zeigten sie stumm auf die
gleichnamige ScriptUI-Klasse. Wer von den neun erbt, verliert das `extends`,
sonst erbte `ImportExportEvent` von ScriptUIs `Event`.

Zwei Angaben aus Adobes ScriptUI-Modell blockieren jeden Dialog und werden
deshalb zu `any`: `add()` steht als `Object` da (auf `Object` ist jeder Zugriff
ein Fehler; welches Element entsteht, hängt am ersten Argument), und `show()`
steht als `void`, obwohl ein Dialog sein Ergebnis zurückgibt. Noch besser wären
Überladungen nach dem Zeichenketten-Argument (`add("button")` → `Button`) —
dafür bräuchte es eine Tabelle der Elementarten, bisher nicht gebaut.

`llms.txt` ist eine Konvention, kein Standard; nichts findet sie von allein. Ihr
Wert liegt darin, dass man sagen kann „richte deinen Agenten auf diese URL".

### Der Prüfer lief jahrelang ins Leere

**`check-types.js` hat den Compiler nie gestartet und trotzdem „bestanden"
gemeldet.** Es rief `node_modules/.bin/tsc.cmd` über `execFileSync` — und seit
Node 18.20/20.12 verweigert Node das Starten von `.bat`/`.cmd` ohne `shell`
(CVE-2024-27980). Der `EINVAL` landete im `catch`, dort stand keine Zeile mit
`error TS`, und damit galt jede Datei als fehlerfrei. Aufgefallen ist es nur,
weil derselbe Aufruf von Hand einen Fehler zeigte, den der Lauf nicht kannte.

Zwei Lehren, beide eingebaut: Der Compiler wird jetzt als **JS mit demselben
`node`** aufgerufen (`node_modules/typescript/bin/tsc`), und ein Lauf ohne
Ausgabe **und** ohne Exit-Code gilt als Fehler, nicht als Erfolg. Ein Prüfer,
der nichts findet, muss beweisen können, dass er gesucht hat.

Was dabei sofort sichtbar wurde: 16 Fehler in Photoshop (Klassen erben von der
Enumeration `SaveOptions` — in TypeScript kein Konstruktor, TS2507; das
`extends` fällt jetzt weg) und ein Verweis auf `File` in `scriptui.d.ts`, das
die Datei nicht deklariert. Deshalb hat jede Deklarationsdatei jetzt ihre
**eigene Typabbildung**, die nur Namen aus derselben Datei kennt; was fehlt,
wird zum Alias auf `any`.

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

### Warum die Datei allein noch nichts nützt

Alle sieben Dateien übersetzten fehlerfrei — und trotzdem ließ sich mit ihnen
nicht arbeiten. Gemeldet wurde: `app` unbekannt, und `doc.` bot
`createElement`, `createCDATASection`, `createRange` an. Nachgestellt und je
mit dem echten Compiler belegt:

- **Die globalen Namen fehlten.** Adobes Modell fasst sie zur Klasse `global`
  zusammen (`app`, `alert`, `confirm`, `prompt`, `localize`, `isXMLName`,
  `uneval`, `setDefaultXMLNamespace`). Als `declare class global { … }` sind
  sie unerreichbar. Sie stehen jetzt einzeln als `declare const app:
  Application` und `declare function alert(…)`. Was `lib.es5` selbst
  mitbringt — `parseInt`, `isNaN`, `encodeURI` … — bleibt weg, sonst gäbe es
  eine zweite, abweichende Überladung.
- **Mit geladener DOM-Bibliothek gewinnt der Browser.** `declare class
  Document` und `interface Document` aus `lib.dom` stehen nebeneinander; mit
  `skipLibCheck` bleibt der Konflikt stumm, und die Suche landet bei der
  Browserfassung: `doc.pages` unbekannt, `doc.createElement` erlaubt. Deshalb
  steht die nötige `jsconfig.json` jetzt im Kopf jeder `.d.ts`, auf der
  Produktseite als Kopierblock und in `llms.txt`:

  ```json
  { "compilerOptions": { "lib": ["es5"], "types": [], "checkJs": false },
    "include": ["**/*.js", "**/*.d.ts"] }
  ```
- **`new File("…")` ging nicht.** Den Konstruktor beschreibt Adobe als Methode
  mit dem Klassennamen — `File(path)`, `Folder(path)`, `XML(text)`, `QName`,
  `Namespace`, `Socket`. Daraus wird jetzt ein `constructor`.
- **`$.writeln()` ging nicht.** `$` und `ScriptUI` sind einzelne Objekte, ihre
  Methoden führt Adobe aber als Instanzmethoden. Beide sind als `SINGLETON`
  markiert und bekommen `static`. Nicht zu verwechseln mit `XML` oder
  `RegExp`: dort sind nur die *Properties* statische Schalter. Weil die
  ScriptUI-Klassen ein Suffix tragen, kommt zusätzlich
  `declare const ScriptUI: typeof ScriptUISUI` dazu.
- **`pages.everyItem()` gab `Page[]`.** Adobes Angabe, aber der Sammelverweis
  ist kein Array: `everyItem().appliedMaster = m` und `everyItem().getElements()`
  scheiterten beide. Der Rückgabetyp ist jetzt der Elementtyp.
- **`alert("x")` war ein Aufruf mit zu wenigen Argumenten.** Adobe markiert
  Pflichtparameter hinter optionalen (`alert(message, title?, errorIcon)`) —
  in TypeScript verboten (TS1016). Ab dem ersten optionalen gilt jetzt alles
  Weitere als optional. Betrifft 2 bis 3 Methoden je Produkt.
- **`Array` ohne Typargument** (4 Stellen) ist jetzt `any[]`.

Zwei Konsequenzen für die Prüfung: `check-types.js` läuft **ohne
`--skipLibCheck`** — genau der Schalter hatte 66 Fehler *in* der Datei
verdeckt — und übersetzt zusätzlich `build/fixtures/indesign.js`, ein echtes
Alltagsskript mit `checkJs`. Dass eine Deklaration übersetzt, heißt eben nicht,
dass man mit ihr schreiben kann.

Die 66 verdeckten Fehler waren echt: die `FindChange*Setting`-Klassen weiten
jede geerbte Property um `NothingEnum` aus, was TypeScript verbietet (TS2416).
Der Typ bleibt stehen wie er ist, darüber steht ein `// @ts-ignore` mit
Begründung — 114 Zeilen in den beiden InDesign-Dateien, sonst keine. Der
Kommentar muss unmittelbar über der Deklaration stehen; das JSDoc darüber
bleibt trotzdem am Member hängen (mit der Compiler-API nachgeprüft).

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
- Ein **Doppelpunkt im Typnamen** heißt, dass Adobe Feldname und Typ in eine
  Angabe gepresst hat. `fixdom.js` löst ihn auf: der Teil hinter dem letzten
  Doppelpunkt ist der Typ, eine „Ordered array containing …"-Angabe wird zum
  `Array`. Aus `BoundsKind:BoundingBoxLimits` wird `BoundingBoxLimits`, aus
  `reframe(in: CoordinateSpaces | any)` also
  `reframe(in: CoordinateSpaces | BoundingBoxLimits | any[])` — und auf der
  Seite stehen drei verlinkte Typen statt Rohtext. Betraf **231 Angaben je
  InDesign-Modell**, 223 davon auflösbar; die übrigen acht nannten hinter dem
  Doppelpunkt selbst keinen Typ (`dataValue:VariesType` → `Varies`).
  Der Elementtyp des Arrays bleibt bewusst offen: die Listen sind gemischt
  (Koordinatenraum, Bezugsrahmen, Zahlen), ein geratener Elementtyp würde
  richtigen Code als falsch melden. Was drinsteht, sagt die Beschreibung.

  **Damit meldet der Build keine unauflösbaren Typnamen mehr.** Was noch `any`
  wird, sind Adobes eigene Platzhalter, alle in `SCALAR` benannt: `Varies` (221
  Stellen, davon nur 3 an einer Property), `VariesSUI` (17) und die vier
  Sammelbegriffe `IDBasedObject`, `NonIDBasedObject`, `UIDBasedObject`,
  `RootObject` (je 3).

- **`parent` braucht drei Lesarten.** Die Sonderbehandlung kannte nur Adobes
  Klammerform („The parent … (a Document)"). 21 `parent`-Angaben blieben ohne
  Typ — und fehlten damit auch in der Hierarchie. Zwei weitere Formen stehen
  jetzt mit drin: die `Can return:`-Prosa (`Link.parent` → `Story`, `Graphic`,
  `Movie`, `Sound`) und „The Folder object …" (`File.parent`, `Folder.parent`
  → `Folder`, samt Adobes Tippfehler „TThe"). Bleiben 18 ScriptUI-Elemente mit
  „The parent element." — dort nennt Adobe den Behälter nirgends, geraten wird
  hier nicht.

### Sprungziele unter zwei klebenden Zeilen

Kopfzeile (44 px) und Filterzeile kleben beide oben. Ein Verweis aus der rechten
Spalte, aus der Palette oder ein Deep-Link scrollte das Ziel deshalb **unter**
die Filterzeile: sichtbar war der nächste Member, und man hielt ihn für den
gesuchten. Gemeldet als „springt zum nächsten".

Behoben mit `scroll-margin-top` auf allen Ankern in `.dmain`. Der Wert ist
gemessen, nicht geschätzt: `site.js` setzt `--sticky` auf
`44 + Höhe der Filterzeile + 6` und zieht ihn beim Zoomen und bei
Größenänderung nach — bei schmalem Fenster bricht die Pillenreihe um
(135 px gegenüber 171 px). Gerechnet wird mit `offsetHeight`, also in
Layout-Pixeln: `--sticky` wird als CSS-Wert später wieder mit dem Zoom
skaliert.

Ohne JavaScript ist die Filterzeile ausgeblendet, dann klebt nur die Kopfzeile —
deshalb steht im Stylesheet 50 px als Vorgabe. Alle drei Fälle liegen jetzt 6
bis 7 px unter der klebenden Kante, geprüft in `check-site.js`.

## Listenansicht statt rechter Spalte

Eine fünfte Pille **List** zeigt alle Member als Verweise dort, wo sonst die
Tabellen stehen — mehrspaltig (`columns: 220px`), nach Properties, Events und
Methoden gruppiert. `Application` sind das 341 Namen auf einen Blick statt
sieben Bildschirmhöhen Tabelle. Ein Klick führt zurück in die Tabelle, an die
Stelle des Members.

Sie ersetzt die frühere **rechte Spalte**: die nahm dauerhaft 210 px, war nur so
breit wie ein Bezeichner und zeigte dasselbe. Damit ist das Raster überall
zweispaltig, und der Kopfbereich bekommt die volle Inhaltsbreite.

**Tastenwege:** `L` schaltet um, `A`/`P`/`E`/`M` wählen die Memberart — die
Buchstaben stehen als `<kbd>` auf den Pillen, wie `F` und `O` in ihren Feldern.
Eine Pille, die es auf der Seite nicht gibt (kein Event), tut nichts; sonst
blendete die Taste den ganzen Inhalt aus.

Beim Umschalten **mitten in einer langen Tabelle** springt die Seite zur Liste:
die ist kürzer und begänne sonst weit über dem Sichtfeld — man sähe nur den
Fußbereich. Nur wenn sie wirklich oberhalb liegt, sonst rutschte die Seite beim
Umschalten vom Anfang weg.

Jeder Eintrag nennt **den Typ** hinter dem Namen (`filePath Folder`,
`addEventListener() EventListener`). Die Wertechips einer Enumeration müssen
dabei draußen bleiben, sonst steht dort `RepaginateOptionNEXT_EVEN_PAGE…` statt
des Typnamens.

Drei Feinheiten, alle beim Prüfen aufgefallen:

- **Der Filter wirkt in beiden Ansichten**, die Pillen für die Memberart
  ebenso — die Liste zeigt genau das, was die Tabellen zeigen würden.
- **Die Wahl gilt beim Blättern weiter** (`mode` in `localStorage`): wer die
  Liste zum Navigieren nutzt, will sie auf jeder Seite. Ein Sprung auf einen
  Member gewinnt aber dagegen — sonst zeigte die Seite die Liste, während die
  Adresse auf eine Tabellenzeile deutet.
- **Innerhalb derselben Seite lädt nichts neu**, deshalb hört `site.js` auf
  `hashchange`: ohne das blieb die Liste stehen, wenn man aus der Palette auf
  einen Member derselben Seite sprang.

Die Polsterung des Inhalts liegt bei **16/20/27 px** — zwei Drittel der
früheren Werte. Der Inhalt soll die Fläche nutzen, der Rand nur trennen.

### Der Objektname in der klebenden Zeile

Über dem Filterfeld steht der Name des Objekts — 17 px statt der 26 px der
Überschrift, aber dieselbe Schrift und dasselbe Gewicht: es ist derselbe Name,
keine Beschriftung. Nach ein paar Bildschirmen Properties ist die Überschrift
weggescrollt, und bei 423 Objekten ähneln sich viele Namen (`TextFrame`,
`TextFramePreference`).

**Er erscheint erst, wenn die Leiste wirklich klebt** — am Seitenanfang stünde er
doppelt da, direkt unter der Überschrift. Beantwortet wird das von einem
nullhohen Wächter (`.barwatch`) vor der Leiste, den ein `IntersectionObserver`
mit `rootMargin: -45px` beobachtet: das ist die Höhe der Kopfzeile plus ein
Pixel, der Wechsel fällt damit genau auf den Anschlag. Kein Scroll-Handler.

Dabei wächst die Leiste um die Namenszeile, und **der Inhalt sprang gemessen um
30 px**, sobald sie ansetzte — Chromes Scroll-Anchoring fing das nicht ab. Die
Höhe steht deshalb als `--namerow` fest, die Namenszeile ist genau so hoch, und
`.bar.stuck` nimmt sie über einen negativen Rand wieder zurück: im Fluss
beansprucht die Leiste immer dasselbe. Gemessen mit echtem Radscrollen über den
Anschlag, in Chrome und Firefox: 0 px Abweichung. `--sticky` rechnet die
Namenszeile immer mit, sonst landete ein Sprungziel 30 px zu hoch — also unter
der Leiste.

Damit ist die Leiste kein Flexcontainer mehr, sondern trägt zwei Zeilen. Die
Umbruchregel für schmale Fenster musste deshalb von `.bar` auf `.barrow`
wandern — ohne sie lief die Pillenreihe bei 750 px um 313 px aus der Spalte und
die Seite scrollte seitlich.

**Der Breitendurchlauf hat das nicht gemeldet.** Er wartete nach dem Laden nur
220 ms und maß, während die Filterzeile noch `[hidden]` war. Jetzt wartet er
auf `.bar:not([hidden])`; mit deaktivierter Umbruchregel meldet er den
Überhang prompt (140 px bei 900, 240 bei 800) — nachgewiesen, nicht vermutet.

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
| ab 1100 px | Zugriff ausgeschrieben (78 px) |
| unter 1100 px | Zugriff als `ro`/`rw` (46 px, Kopf „ACC"), Beschreibung bekommt den Platz |
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

### Falsche Typangaben richtigstellen

`additions.js` trägt neben Membern auch **Typkorrekturen**, Schlüssel
`Klasse.property`. Bisher zwei: `Document.filePath` und `Book.filePath` stehen
im Export als `File`, liefern aber einen `Folder` — die Datei selbst steht in
`fullName`. Gilt in beiden Laufzeiten; im UXP-Modus zeigt der Verweis
entsprechend auf Adobes `folder`-Seite statt auf `file`.

Jeder Eintrag nennt mit `from` die falsche Angabe und greift nur, solange
genau die dasteht. Schreibt Adobe den Typ eines Tages richtig oder anders,
greift die Korrektur nicht mehr, statt eine dann falsche zu erzwingen.

Bewusst **nicht** angefasst: `Application.filePath`, `BookContent.filePath`
und `Library.filePath` tragen denselben Satz im Export. Ob sie ebenso falsch
sind, ist nicht nachgeprüft — geraten wird hier nicht.

### Hierarchie: worin steckt es, was steckt darin

Über den Membern stehen drei zentrierte Zeilen — mögliche Eltern, der eigene
Name, mögliche Kinder — nach dem Vorbild von Adobes Object Model Viewer. Das ist
**Enthaltensein, nicht Vererbung**: die beiden Blöcke darüber (`.chain`,
`Extended by`) beantworten „was bin ich", dieser beantwortet „wo bekomme ich das
her" und „was erreiche ich von hier".

Quelle ist die `parent`-Property: sie nennt, worin ein Objekt stecken kann
(`Document` → `Application`, `Rectangle` → 18 Behälter). Die Kinderliste ist
deren Umkehrung, gebildet in `derive()` als `parentsOf` / `childrenOf`.

Vier Entscheidungen dabei, alle gegen Rauschen:

- **Enumerations sind nie dabei.** Sie stecken nirgends, sie sind Werte.
- **Sammlungen bleiben draußen.** Dass eine `Page` in `Pages` steckt, ist eine
  Frage der Schreibweise, keine Hierarchie. (Nebenbei: Adobes Export gibt
  Sammlungen ohnehin keine `parent`-Angabe, sie bekommen also gar keinen Block.)
- **Ein reiner Selbstbezug fällt weg.** `Application.parent` nennt
  `Application` — das sagt nichts. Steht der eigene Name neben anderen, bleibt
  er: ein `Rectangle` kann in einem `Rectangle` liegen.
- **Was fast überall steht, fällt ganz heraus.** `MutationEvent` steht in 422
  der 423 Kinderlisten, `Event` und `EventListener` in 415 — jedes Objekt kann
  Events auslösen. Solche Klassen ordnen nichts mehr ein und sind in beiden
  Richtungen weg, auch auf ihrer eigenen Seite. Die Schwelle ist die Hälfte
  aller Objekte, damit die Regel bei künftigen Modellen greift, statt drei
  Namen festzuschreiben.

**Die Preference-Familie steht getrennt und eingeklappt.** 172 der 423 Objekte
erben von `Preference` und hängen an fast jedem Objekt; `Document` allein hat
54 davon. Wer nach Struktur sucht, will `Article` und `Story` sehen, nicht 54
mal „…Preference". Erkannt wird die Familie an der Oberklasse, nicht am Namen —
sonst fehlten `AnchoredObjectDefault` und `BaselineFrameGridOption`. Bis sechs
Namen steht die Zeile offen, darüber hinter einer Zusammenfassung
(`54 preference objects`).

Der Block trägt echte Information, nicht nur Zierde: eine `Page` steckt laut
Adobe im `Spread`, nicht im `Document`. Wer sie über `doc.pages` holt, sieht
hier den Umweg. `check-site.js` prüft genau das.

**Der Kopf ist halbiert: links Name, Beschreibung und Vererbung, rechts oben
die Hierarchie.** Die Fläche neben dem Titel stand vorher leer, und die
Hierarchie schob die Tabellen nach unten.

Beide Hälften sind **fest**, nicht nach Inhalt bemessen. Eine Breite nach Inhalt
war zuerst gebaut und wieder verworfen: der Kasten sprang von Seite zu Seite in
eine andere Größe, das Blättern wurde unruhig. Jetzt ist er überall gleich breit
(49 % des Kopfes), nur die Höhe folgt dem Inhalt. Der Inhalt bleibt zentriert —
die drei Zeilen beziehen sich aufeinander.

Erst unter 900 px Spaltenbreite rutscht der Kasten unter den Kopf;
nebeneinander bliebe für den Namen zu wenig übrig. Die Regel dafür steht als
`.head .tree`, weil die Halbierung weiter unten im Stylesheet sonst gewönne.

Gemessen bei 1848 px Fenster: die Filterzeile steht auf `Book` bei y = 320
statt 475, auf `Color` bei 243 statt 364.

**Ab vierzig Namen steht eine Liste hinter einem Pfeil**; die Preferences
klappen schon ab sieben ein, sie sind Nebensache. Offen blieben sonst 81 Kinder
auf `Document` — der Kasten war höher als der halbe Bildschirm und schob die
Tabellen hinaus. Darunter bleibt die Liste offen: ein Klick für drei Zeilen wäre
nur im Weg, und im Schnitt sind offene Listen 1,6 Zeilen lang.

**Preis:** `Document` 153 px, `Application` 129, `Rectangle` 305 (34 Kinder
offen), `Color` 102. Die Filterzeile steht auf `Document` damit bei y = 250
statt 604. Vor dem Ausdünnen waren es 609 und 754 px. Drei Objekte haben
überhaupt keinen Block.

### Vererbung in beide Richtungen

**Die Vererbungszeile entfällt, wenn es keine Vorfahren gibt.** Bei `CellStyle`
stand dort nur `CellStyle` — eine Zeile, die den Seitentitel wiederholt.
Betrifft alle 432 Enumerations und jedes Objekt ohne `superclass`.

**Darunter „EXTENDED BY", der Weg nach unten.** Adobe liefert nur
`superclass`; `derive()` dreht das um (`subOf`). Von `PageItem` aus sieht man so
alle neun Rahmenarten auf einmal — die interessantere Richtung, wenn man von
einem Meta-Objekt aus sucht. `SplineItem` hat vier, `Text` sieben.

### Wertechips brauchen Luft

Gemessen lagen zwischen dem letzten Chip und dem Zeilentrenner nur **3 bis
5 px**; der Chip sah aus, als sitze er auf der Linie. Jetzt oben und unten je
6 px, also 10 px bis zum Trenner — `check-site.js` misst das nach.

**Auch `NothingEnum` bekommt seinen Chip.** Er hat nur den einen Wert `NOTHING`,
ist aber die Kopierhilfe für `NothingEnum.NOTHING` — und genau so schreibt man
es im Skript. Ihn zu unterdrücken war ein Fehlschluss: der Chip ist kein
Informationsträger, sondern ein Knopf.

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

### Kern-JavaScript unter UXP

Die 22 Klassen der gemeinsamen Bibliothek beschreiben **ES3 von 2003**. Unter
UXP stimmt davon nur die Hälfte, deshalb zerfallen die Verweise in drei Fälle:

| | Ziel im UXP-Modus |
|---|---|
| `Array`, `Boolean`, `Date`, `Error`, `Function`, `Math`, `Number`, `Object`, `RegExp`, `String` | MDN — es gibt sie dort, nur in moderner Fassung |
| `File`, `Folder` | Adobes UXP-Referenz — gleicher Name, andere API |
| `$`, `Namespace`, `QName`, `Reflection`, `ReflectionInfo`, `Socket`, `UnitValue`, `XML`, `XMLList`, `global` | **kein Ziel**, der Link wird abgeschaltet (durchgestrichen) |

Ein `<a>` ohne `href` ist kein Link mehr und auch per Tastatur nicht mehr
erreichbar — deshalb wird das Attribut entfernt und nicht nur die Farbe
geändert.

**Die Regel greift nur, wenn der Verweis wirklich nach `../javascript/`
zeigt.** Ein Produkt darf eine eigene Klasse gleichen Namens haben — InDesigns
`Document` ist kein Kernobjekt und bleibt unberührt. Geprüft wird das mit.

Kosten: die drei Primitiven `String`, `Number` und `Boolean` machen über 21.000
der Verweise aus. Das sind pro Seite **+1 KB gzip** (Rectangle: 17 statt 16 KB)
und +1,1 MB im Archiv. Wer das sparen will, nimmt die drei aus `MDN_CLASSES` —
wer `String` anklickt, weiß meist ohnehin, was eine Zeichenkette ist.

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
- **„Recent" im Kopf ist eine Recency-Spur, kein Breadcrumb** — die fünf zuvor
  geöffneten Objekte, neuestes zuerst, ohne die aktuelle Seite. Deshalb auch die
  Beschriftung: ohne sie liest sich die Reihe als Hierarchie.
  **Eine Liste über alle sieben Ziele** (`recent` in `localStorage`, Einträge als
  `[slug, name]`). Der Weg von `Document` zu `String` führt über die
  Bibliotheksgrenze, und genau dorthin will man zurück. Aussortiert wird nach
  Ziel **und** Namen, damit InDesigns und Illustrators `Document` nebeneinander
  stehen bleiben. Sie werden bewusst **nicht** beschriftet — welches gemeint
  ist, zeigt die Statusleiste beim Zeigen auf den Link, und fünf Einträge
  vertragen keine zusätzliche Spalte.
  Sie ist der einzige `data-enhance`-Knoten, der auch mit JavaScript verborgen
  bleiben darf — ohne Verlauf gäbe es nur eine leere Beschriftung.
  **Wieviele der fünf zu sehen sind, misst `fitTrail()` in `site.js`**, statt
  nach Fensterbreite zu schalten: fünfmal `Page` braucht weniger Platz als
  einmal `AutoCorrectPreference`. Ist ein Name angeschnitten, fällt der älteste
  weg — ein Eintrag weniger orientiert besser als fünf, aus denen „Pa…" wird.
  Unter 1100 px verschwindet die Spur ganz, zusammen mit der rechten Spalte.

  Drei Fallstricke steckten darin: die Flexbox **staucht ihre Kinder, statt
  überzulaufen** — `scrollWidth` der Spur ist deshalb immer gleich
  `clientWidth`, gefragt werden müssen die Namen. Die Trenner tragen **negative
  Ränder** (`margin: 0 -3px`), ohne die fiel der fünfte Eintrag grundlos weg.
  Und `getBoundingClientRect` rechnet den **Zoom** mit ein, `getComputedStyle`
  nicht — gemischt ergibt das unter A+ falsche Breiten, deshalb durchgehend
  `offsetWidth`/`scrollWidth`.
- **`F` springt in den Memberfilter, `O` in den der Objektliste**, `Escape`
  leert das jeweilige Feld und gibt den Fokus zurück — ohne das Zurückgeben
  tippt der nächste Buchstabe ins Feld, statt zu springen. Das Kürzel steht als
  `<kbd>` im Feld und verschwindet beim Tippen. Modifikatoren bleiben dem
  Browser: `Strg+F` ist seine Suche. Damit sind es vier Tastenwege —
  `Strg+K` oder `/` in die Palette, `?` in die Volltextsuche, `F` in den Filter
  der offenen Seite, `O` in die Objektliste daneben.
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
