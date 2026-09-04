# Design-Phase: neue API-Darstellung

Prototypen für den Umbau **XML → HTML** (ohne DITA, ohne DITA-OT).

> **Eingefroren.** Konzept B ist gebaut und liegt in `build/`; die Prototypen
> hier sind nur noch Entscheidungsgrundlage. Sie liegen weiter im Repo, solange
> offen ist, ob der Vergleichs-Modus aus Konzept C noch kommt. Zum Laufen
> brauchen sie `design/api-data.js` und damit Saxon — die Website selbst nicht.
> Der Text unten beschreibt den Stand der Designphase, nicht den der Website;
> maßgeblich ist `build/README.md`.

## Öffnen

`design/index.html` im Browser öffnen und von dort die drei Konzepte starten.
Die Prototypen laufen direkt per `file://` — kein Server nötig, weil die Daten
über ein klassisches `<script src>` geladen werden statt per `fetch`.

## Daten neu erzeugen

`api-data.js` ist generiert und nicht im Repo. Neu bauen:

```sh
java -cp "<saxon>/saxon9ee.jar" net.sf.saxon.Transform \
  -s:temp/fixedDOM.xml -xsl:design/extract-json.xsl -o:design/api.json
printf 'window.API=' > design/api-data.js
cat design/api.json >> design/api-data.js
printf ';\n' >> design/api-data.js
```

`extract-json.xsl` ist reines Gerüst für die Designphase und **nicht** Teil der
späteren Transformation.

## Kennzahlen (InDesign 2026, 21.5.1.73)

| | |
|---|---|
| Klassen | 1.153 (721 echte Klassen, 432 Enumerations) |
| Properties | 19.590 |
| Events | 211 |
| Methoden | 8.841 |
| Member gesamt | 28.642 |
| Datenmenge | 4,9 MB roh, 706 KB gzip |
| Parse-Zeit | ~150 ms |
| Volltextsuche über alle Member | ~5 ms pro Anschlag |

Die 706 KB gzip sind die entscheidende Zahl: das komplette Objektmodell passt in
einen einzigen Download, damit ist auch Konzept C realistisch.

## Konzepte

- **A — Codex** (`concept-a-codex.html`): das heutige Modell, sauber gemacht.
  Klassenliste links, dichte Tabellen, In-Page-Filter, Copy-Button, Typ-Links.
- **B — Console** (`concept-b-console.html`, **gewählte Richtung**): dreispaltig,
  tastaturzentriert, Command-Palette (`Strg/Cmd+K`) über alle Member, Vererbungskette,
  Properties/Events/Methoden je als eigene Tabelle mit eigener Zählung, klickbare
  Rückgabetypen, Enum-Werte inline in der Beschreibung, Reverse-Lookups „Object of"
  und „Return", Laufzeit-Umschalter ExtendScript/UXP, Footer mit Copyright.
- **C — Atlas** (`concept-c-atlas.html`): ein globales Suchfeld, 2–3 Klassen
  nebeneinander vergleichbar, Member die es nur in einem Pane gibt sind markiert.

Details und Vergleichstabelle in `index.html`.

## Laufzeit-Umschalter ExtendScript / UXP

Konzept B hat einen Umschalter im Kopf. Inhaltlich zeigen beide Modi bislang dasselbe,
mit genau einem echten Unterschied: In UXP gibt es keinen Index-Zugriff auf Collections,
deshalb werden die **242 Methoden mit dem Namen `[]`** ausgeblendet (z. B. `Pages.[]`,
`Rectangles.[]`) und die Methodenzählung entsprechend reduziert.

Welche weiteren Unterschiede zwischen ExtendScript und UXP in die Daten gehören, ist noch
offen und muss vor der eigentlichen Transformation geklärt werden.

## Datenmodell-Notizen aus der Extraktion

- Der **Rückgabetyp einer Methode** hängt als `<datatype>` direkt am `<method>`.
  Ein Element `<returns>` gibt es nicht — eine erste Fassung des Extraktors suchte danach
  und lieferte deshalb leere Rückgabewerte.
- **Events** sind Properties auf Klassenebene (`elements[@type='class']`), erkennbar nur
  daran, dass die Beschreibung mit `Dispatched` beginnt. 211 Events auf 56 Klassen.
- Übrige Properties auf Klassenebene sind echte **statische** Properties (86 Stück, z. B. `$.build`).
- `<datatype><array/>` markiert Collections in `Type[]`-Notation (703 Properties).
- Einzelne Typangaben Adobes sind unbrauchbar, etwa `AnimationSetting.motionPath`.
  Das ist ein Fall für die Transformation, kein Darstellungsproblem.

## Prüfen im echten Browser

Playwright liegt global (`npm i -g playwright`), nicht im Repo — das Projekt soll
abhängigkeitsfrei bleiben. Die Skripte lösen es über `npm root -g` auf und starten
das bereits installierte System-Chrome.

```sh
node design/check-interaction.cjs   # UXP-Umschalter, Palette, Theme, Viewport, Konsolenfehler
node design/check-contrast.cjs      # WCAG-Kontrast in beiden Themes + Zustand nach Reload
node design/check-align.cjs         # Fluchten der Parameterspalten
```

Beide liefen zuletzt vollständig grün: 12 Interaktionstests, keine Konsolenfehler,
alle Kontraste über WCAG AA (hell 5,05–17,64, dunkel 5,21–15,13).

### Dabei gefunden und behoben

- **Helles Theme unter AA.** Vier Elemente lagen bei 4,20–4,27:1 gegen `--rail`
  bzw. `--accent-soft`. `--dim` und `--accent` sind jetzt so gesetzt, dass sie auf
  allen drei Untergründen (`--bg`, `--panel`, `--rail`) über 4,5:1 liegen.
- **Laufzeitmodus ging beim Reload verloren.** UXP steht jetzt im Hash
  (`#Pages!uxp`) und zusätzlich in `localStorage`, ist damit teilbar und überlebt
  einen Reload. Das Theme wird ebenfalls gespeichert.

## Feinschliff nach dem zweiten Review

- **Kein führender Punkt mehr** vor Property- und Methodennamen. Der Punkt war früher
  nur Teil des Clipboard-Texts. Stattdessen gibt es wieder einen **Kopierknopf**, der
  beim Hovern erscheint und den reinen Namen ablegt (bei Methoden mit `()`).
  Mit Fallback über `document.execCommand`, falls die Clipboard-API blockiert ist.
- **Enum-Werte stehen jetzt in der Spalte TYPE**, direkt unter dem Typ, auf den sie
  sich beziehen — nicht mehr in der Beschreibung.
- **UXP blendet zusätzlich `$` und alle 34 ScriptUI-Klassen aus** (Suffix `SUI`).
  Sie verschwinden aus Navigation und Suche, werden in Typangaben nicht mehr verlinkt,
  und ein Link auf eine ausgeblendete Klasse (`#ButtonSUI!uxp`) landet auf `Document`,
  damit Anzeige und URL nicht auseinanderlaufen. Die Seitenleiste weist die Zahl der
  ausgeblendeten Klassen aus.

Der Testlauf deckt diese Punkte mit ab: 22 Prüfungen, alle grün, keine Konsolenfehler.
- **Parameterspalten fluchten.** Die Parameterliste einer Methode war ein Flexbox-Layout
  mit `min-width`; ein breiter Typ wie `File | JavaScriptFunction` sprengte damit nur
  seine eigene Zeile und die Beschreibungen standen versetzt. Jetzt ein echtes Grid
  (`.args` als Grid, `.arg` mit `display:contents`), die ersten beiden Spalten richten
  sich am breitesten Inhalt der jeweiligen Methode aus. `check-align.cjs` misst das
  nach: 112 Methoden mit mindestens zwei Parametern, Spaltenversatz 0 px.
- **Kopfzeile.** Die API-Version des zugrunde liegenden Objektmodells steht jetzt als
  Pille im Kopf (`InDesign 2026 · API 21.5.1.73`, aus `D.version` zerlegt). Der
  Laufzeit-Umschalter ist zurückhaltender: kein Farbblock mehr, sondern ein leicht
  angehobenes Feld für den aktiven Modus. Die Wortmarke `indesignjs` ist größer (16 px).
- **Footer** nennt jetzt Urheber und Hosting:
  „Presented with ♥ by Gregor Fellenz, publishingX."
  mit Link auf <https://www.publishingx.de/> (erreichbar geprüft).
- **Rechte Spalte listet alle Membertypen.** Vorher standen dort nur Methoden; mit
  aktivem Filter „properties" blieb die Spalte leer. Jetzt je eine Sektion für
  Properties, Events und Methoden, passend zum aktiven Filter. Property- und
  Eventzeilen haben dafür Anker (`p-…`, `e-…`) bekommen. Die Sprünge laufen über
  JS statt über `href`, weil Ankernamen wie `m-[]` sonst im Hash landen und das
  Routing über den Klassennamen stören.
- Der aktive Modus des Laufzeit-Umschalters ist wieder blau, die kompaktere Größe bleibt.

## Volltextsuche in der Palette

Die Palette kennt zwei Modi:

| Eingabe | Modus |
|---|---|
| `geometricBounds` | Namenssuche über Klassen, Properties, Events, Methoden |
| `?bleed` | Volltext erzwungen |
| `font size` | Volltext **automatisch** — Bezeichner enthalten nie ein Leerzeichen |

Mehrere Begriffe werden UND-verknüpft. Durchsucht werden Klassenname, Membername,
Beschreibung und bei Methoden zusätzlich Parameternamen und -beschreibungen.
Treffer im Namen werden vor reinen Beschreibungstreffern einsortiert, die Trefferstelle
wird als Textausschnitt mit Hervorhebung gezeigt.

Tastatur: `Strg/Cmd+K` öffnet die Namenssuche, `/` ebenfalls, `?` öffnet direkt im
Volltextmodus.

**Warum `?` und nicht `:`** — `:` liest sich wie ein Befehl (vim, VS Code), hier wird
aber nur der Suchraum gewechselt. `?` steht für „Frage an den Text", kann keinen
Bezeichner beginnen und ist auf deutscher wie US-Tastatur bequem erreichbar.
Wichtiger als das Zeichen ist aber die Leerzeichen-Regel: Sie deckt die meisten
Volltextsuchen ab, ohne dass man ein Präfix kennen muss.

Kosten: ~3,3 MB Suchtext, 5–8 ms pro Anschlag über alle 29.795 Einträge. Kein Index nötig.

## Verwendungsnachweis, Kopfzeile, Footer

- **„Parameter of" als dritter Reverse-Lookup.** `Object of` und `Return` deckten nur
  Properties und Rückgabewerte ab. Enumerations erscheinen aber meist ausschließlich als
  **Parametertyp**: `ExportFormat` hat null Properties, aber 88 Parameter, und 39 der 432
  Enumerations werden nur so verwendet. Deren Seitenfuß war bisher leer. Der Abschnitt
  nennt Klasse, Methode und Argumentnamen (`Book.exportFile(format)`). 14 Enumerations
  werden nirgends verwendet — das steht jetzt ausdrücklich da, statt leer zu bleiben.
- **Kopfzeile fluchtet.** `align-items:center` zentriert nur die Boxen; bei 16 px
  Wortmarke neben 11 px Steuerelementen lagen die Textgrundlinien 2 px auseinander.
  Jetzt `align-items:baseline` plus gleicher Versatz auf alle Kinder, damit die Gruppe
  trotzdem mittig in der 44-px-Leiste sitzt. Wichtig: die `font:`-Kurzschreibweise setzt
  `line-height` zurück, deshalb steht überall `11px/1` statt nur `11px`.
  `check-align.cjs` misst Grundlinien und Zentrierung mit.
- **Footer farbärmer.** Herz und die Marke „AI generated" laufen in Text- bzw.
  Dimmfarbe mit, kein Rot und kein Orange mehr.

## Benennung: Class / Collection / Enumeration

Die Kopfzeile einer Seite nennt jetzt drei Arten statt zwei:

| Art | Anzahl | Erkennung |
|---|---|---|
| Class | 479 | Rest |
| Collection | 242 | Methode `everyItem` vorhanden |
| Enumeration | 432 | `classdef/@enumeration` |

Die Erkennung ist eindeutig: Alle 242 Klassen mit `everyItem` haben auch `[]`, und
keine hat das eine ohne das andere. Bewusst **nicht** über `[]` geprüft, weil das in
UXP ausgeblendet wird — die Art einer Klasse darf nicht von der Ansicht abhängen.
Die Beschreibung taugt ebenfalls nicht: acht Collections beginnen nicht mit
„A collection of" (`PageItems`, `SplineItems`, `MediaItems` …).

Collections nennen zusätzlich ihren Elementtyp (`COLLECTION OF ANGLECOMBOBOX`),
in der Seitenleiste sind sie mit `coll` markiert.

**Warum „Class" und nicht „Object":** Eine Referenzseite beschreibt den *Typ*, nicht
eine Instanz. `Document` ist die Klasse, `app.documents[0]` das Objekt. Adobe selbst
ist uneinheitlich — die Scripting Guides sagen „object", der Object Model Viewer sagt
„Classes". Gegen „Object" spricht außerdem, dass es im Modell eine Klasse namens
`Object` gibt. Der Begriff ist eine Zeile Code (`kindOf`), falls das Team sich anders
entscheidet.

## Weitere Anpassungen

- **Zwischenablage qualifiziert bei Membern auf Klassenebene.** Enum-Werte, Events und
  statische Properties werden qualifiziert benutzt und deshalb auch so kopiert:
  `CopyrightStatus.YES`, `Rectangle.AFTER_PLACE`, `$.build`. Instanz-Properties bleiben
  nackt (`absoluteFlip`), weil davor die eigene Objektreferenz steht.
- Der Hinweis auf die in UXP ausgeblendeten Klassen ist aus der Seitenleiste entfernt.
- Footer: „Gregor Fellenz" verlinkt auf LinkedIn, „publishingX" auf publishingx.de.
  Ruhiger gesetzt — eine Signaturzeile, ein Fließtext, eine kleine Versionszeile;
  keine Rahmen, keine Fettung, keine Signalfarben.

## Korrekturen aus dem Review

- **Hausbegriff ist „Object", nicht „Class".** Die Kopfzeile sagt jetzt
  `OBJECT` / `COLLECTION` / `ENUMERATION`, die Seitenleiste „Objects · 479",
  die Palette kennzeichnet Treffer als `object`. Die XML-Herkunft heißt weiterhin
  `classdef` — das ist Adobes Elementname, kein Anzeigetext.
- **Collections in der Typspalte verlinken auch auf ihr Element.** `Document.pages`
  zeigt `Pages<Page>`, beide Teile klickbar. Vorher brauchte man von einer
  Collection-Property zum eigentlichen Objekt immer einen Zwischenschritt.
- **Footer nennt das Erzeugungsdatum**: „Generated from Adobe InDesign 2026
  (21.5.1.73) Object Model on 2026-09-04." Das Datum kommt über `current-date()`
  aus `extract-json.xsl` in die Daten, nicht aus der Seite.
- Der mittlere Absatz im Footer ist gekürzt und die künstliche Breitenbegrenzung
  entfernt — drei Zeilen sind zwei geworden.

## Aus fixDom.xsl nachgezogen

`fixDom.xsl` leitet aus Adobes Beschreibungstexten zwei Angaben ab, die der Extraktor
zunächst verworfen hat:

- **`<min>`/`<max>`** aus Formulierungen wie „(Range: 0 to 100)" —
  1.002 Properties und 100 Parameter. Steht jetzt als Bereich in der Typspalte
  (`Number 0–100`).
- **`<is>Measurement Unit</is>`** — 1.313 Properties und 122 Parameter dürfen den Wert
  auch als String schreiben (`"12mm"`). Steht jetzt als `unit` neben dem Typ.

Ebenfalls aus `fixDom.xsl`, und bereits genutzt: das `SUI`-Suffix (Grundlage der
UXP-Ausblendung), `<array/>`, die aus „Can accept/Can return" abgeleiteten Zusatztypen,
der Standardwert `read/write` für fehlendes `@rwaccess` und die Typnormalisierung
(`Any` → `Varies`, `Bool` → `Boolean`).

Offen: `fixDom.xsl` benennt die Klasse `Index` in **`Index_`** um. Der Unterstrich ist
ein Workaround aus der DITA-Zeit; im neuen HTML-Pfad wäre zu prüfen, ob er noch nötig
ist — angezeigt wird er derzeit mit.
- **Enum-Chips in der Typspalte sind selbst Kopierziele.** Ein Klick legt den
  qualifizierten Wert ab (`UndoModes.AUTO_UNDO`), so wie er im Skript steht. Die
  Chips wechseln dabei nicht ihren Text, sondern blinken kurz auf — der Wert muss
  lesbar bleiben. `wireCopy()` bindet deshalb alles mit `data-cp`, nicht nur `.cp`.
  Enums mit mehr als zwölf Werten zeigen „+N more" jetzt als Link auf die Enumeration.
- **Namen sind selbst Kopierziele**, wie zuvor schon die Enum-Chips. Der separate
  `copy`-Knopf beim Hovern ist entfallen — weniger Unruhe in der Tabelle. Hinweis auf
  die Funktion ist eine gepunktete Linie beim Hovern plus Tooltip mit dem exakten Text,
  der abgelegt wird. Was kopiert wird:

  | Member | Anzeige | Zwischenablage |
  |---|---|---|
  | Instanz-Property | `absoluteFlip` | `absoluteFlip` |
  | Statische Property | `build` | `$.build` |
  | Enum-Wert | `YES` | `CopyrightStatus.YES` |
  | Event | `AFTER_PLACE` | `Rectangle.AFTER_PLACE` |
  | Methode | `duplicate(to?, by?)` | `duplicate()` |

  Methoden zeigen also ihre Signatur, kopieren aber nur `name()` — die Parameter
  schreibt man ohnehin selbst.
- **Beschreibungen dürfen die volle Breite nutzen.** `.mem .desc` hatte
  `max-width:72ch`. Einzelne Adobe-Beschreibungen sind mehrere tausend Zeichen lang —
  `Application.createCustomMiniFolio` ist eine als Fließtext gequetschte Schematabelle
  mit 2.473 Zeichen, `Event.parent` hat 7.540. Bei 72ch wurden daraus rund 30 Zeilen,
  während rechts daneben zwei Drittel der Spalte leer blieben. Ohne die Begrenzung
  sind es zehn Zeilen. Ein Kürzen mit „show more" war der falsche Weg — das Problem
  war die Leseweite, nicht die Textmenge.
- Die Versionszeile im Footer hat jetzt dieselbe Schriftgröße wie der Absatz darüber (11 px).
