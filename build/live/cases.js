/* Live-Testfälle: Verhaltensangaben der Dokumentation, die am laufenden
   InDesign nachprüfbar sind. run.js führt jeden Fall in ExtendScript und
   in UXP aus; README.md erklärt, wie man einen ergänzt.

   Felder je Fall:
     id        kurz, kebab-case; Schlüssel in results/*.json
     title     englisch, eine Zeile
     claim     deutsch: was die Doku behauptet
     where     welche Datei/welcher Eintrag sich darauf stützt
     requires  Liste: Mindestversionen ('19.0') und Member des Objektmodells
               ('XMLElements.itemByName'). Fehlt eins, meldet der Fall n/a.
               Member prüft run.js an einem Beispielobjekt aus SAMPLES.
     es, uxp   Funktionsrumpf je Laufzeit. Er gibt einen Wert zurück
               (UXP auch ein Promise); die Hülle in run.js macht JSON daraus
               und bringt ihn heraus. Fehlt einer, steht dort „—“.
     expect    { es, uxp }: Wert (Vergleich über JSON) oder Funktion
               (value, { version }) → true. Fehlt die Angabe, meldet der
               Fall INFO mit dem Wert, ohne zu scheitern.
     timeout   optional, ms
     esTopLevel  optional: der ES-Rumpf steht auf oberster Ebene statt in
               einer Funktion, kein return, sondern result = …; nötig, wenn
               ein doScript()-Kind die withArguments sehen soll

   In jedem Rumpf stehen bereit:
     WORK        Arbeitsordner (Schrägstriche), wird danach gelöscht;
                 darin die Dateien aus FIXTURES
     scratch()   neues unsichtbares Dokument, wird danach geschlossen
     track(o)    Buch, Bibliothek o. Ä. danach schließen
     na(grund)   Fall gilt hier nicht → n/a
   Die Hülle schaltet userInteractionLevel auf NEVER_INTERACT und stellt es
   danach zurück. Fremde Dokumente nie anfassen — nur, was scratch() oder
   der Fall selbst angelegt hat.

   UXP: Der Rumpf steht in einer Funktion; await nur innerhalb von
   `return (async () => { … })();`. Das Promise unbedingt zurückgeben:
   Fortsetzungen eines nicht zurückgegebenen Promise finden kein DOM mehr
   vor (app.documents undefined) — Einzelheiten an uxpWrap in run.js.
   setResult() nicht selbst aufrufen; das Ergebnis bringt die Hülle über
   eine Datei heraus. */
'use strict';

const examples = require('../examples');

/* Wie run.js an ein Objekt kommt, um requires zu prüfen (ExtendScript). */
const SAMPLES = {
  Application: 'app',
  Document: 'scratch()',
  Pages: 'scratch().pages',
  Page: 'scratch().pages[0]',
  XMLElements: 'scratch().xmlElements',
  XMLElement: 'scratch().xmlElements[0]',
  Links: 'scratch().links',
  ScriptArg: 'app.scriptArgs',
  GeneralPreference: 'app.generalPreferences',
  ScriptPreference: 'app.scriptPreferences',
  Book: 'track(app.books.add(File(WORK + "/probe.indb")))',
  BookContent: '(function () { var d = scratch(); d.save(File(WORK + "/probe-bc.indd")); ' +
    'var b = track(app.books.add(File(WORK + "/probe-bc.indb"))); ' +
    'return b.bookContents.add(File(WORK + "/probe-bc.indd")); })()',
  Library: 'track(app.libraries.add(File(WORK + "/probe.indl")))'
};

/* Event-Handler als Datei (ExtendScript): legt neben sich <name>.fired an. */
const HANDLER = 'var f = File(File($.fileName).fsName + ".fired"); ' +
  'f.open("w"); f.write("fired"); f.close();\n';

/* Dateien, die run.js vor dem Lauf in WORK anlegt. */
const FIXTURES = {
  'pixel.png': Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQ' +
    'DwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
  'handler-es.jsx': HANDLER,
  'handler-uxp.jsx': HANDLER
};

/* UXP: Promise auf einen localFileSystem-Eintrag → was davon prüfbar ist.
   Ohne Pfade: die Ergebnisdateien sollen nur bei Verhaltensänderungen
   abweichen, nicht je Rechner oder Arbeitsordner. */
const UXP_ENTRY = `
function entry(p) {
  const promise = p instanceof Promise;
  return Promise.resolve(p).then(e => ({ promise, isFolder: !!(e && e.isFolder),
    isFile: !!(e && e.isFile) }));
}`;
const isFolderPromise = v => v.promise === true && v.isFolder === true;

/* Die sieben File→Folder-Korrekturen aus additions.js (types). */
function folderCase(id, cls, prop, es, uxp, extra = {}) {
  return Object.assign({
    id,
    title: `${cls}.${prop} is a Folder, not a File`,
    claim: `Adobes Export sagt File; der Wert ist ein Folder. ExtendScript: instanceof Folder ` +
      `und constructor Folder. UXP: Promise auf einen Ordner-Eintrag (isFolder).`,
    where: `additions.js types ${cls}.${prop}; runtime.js valueTypes (Promise unter UXP)`,
    requires: [`${cls}.${prop}`],
    es: es + `
      return { instanceofFolder: v instanceof Folder, ctorFolder: v.constructor === Folder,
        instanceofFile: v instanceof File };`,
    uxp: UXP_ENTRY + uxp,
    expect: {
      es: { instanceofFolder: true, ctorFolder: true, instanceofFile: false },
      uxp: isFolderPromise
    }
  }, extra);
}

/* Beispiele aus examples.js mit unsichtbarem Dokument. Steht der Aufruf dort
   anders, scheitert der Fall laut, statt ein sichtbares Dokument zu öffnen. */
function hidden(src, replacement) {
  const needle = 'app.documents.add()';
  if (!src.includes(needle))
    return `throw new Error("examples.js: ${needle} nicht gefunden — cases.js anpassen");`;
  return src.split(needle).join(replacement);
}

const cases = [
  {
    id: 'xmlelements-itembyname',
    title: 'XMLElements.itemByName() works in ExtendScript, not in UXP',
    claim: 'itemByName() fehlt in Adobes XML-Export, funktioniert aber unter ExtendScript. ' +
      'Unter UXP geht es nicht; dort evaluateXPathExpression() am Eltern-XMLElement.',
    where: 'additions.js methods.XMLElements itemByName (uxp: false); notes.js byName.XMLElements',
    requires: ['XMLElements.itemByName'],
    es: `
      var root = scratch().xmlElements[0];
      root.xmlElements.add("live");
      var hit = root.xmlElements.itemByName("live");
      return { valid: hit.isValid, tag: hit.markupTag.name };`,
    uxp: `
      const root = scratch().xmlElements.item(0);
      root.xmlElements.add("live");
      const r = { type: typeof root.xmlElements.itemByName };
      try {
        const hit = root.xmlElements.itemByName("live");
        r.valid = !!(hit && hit.isValid);
      } catch (e) { r.threw = String(e.message || e); }
      const xp = root.evaluateXPathExpression("live");
      r.xpath = xp.length;
      r.xpathTag = xp.length ? xp[0].markupTag.name : null;
      return r;`,
    expect: {
      es: { valid: true, tag: 'live' },
      uxp: v => v.valid !== true && v.xpath === 1 && v.xpathTag === 'live'
    }
  },

  {
    id: 'scriptargs-undefined-uxp',
    title: 'app.scriptArgs is undefined in UXP',
    claim: 'app.scriptArgs ist unter UXP undefined; Argumente kommen dort aus ' +
      'require("uxp").script.args. Unter ExtendScript ist es ein ScriptArg.',
    where: 'notes.js byName.ScriptArg, byMember Application.scriptArgs; agents.js uxp.md',
    requires: ['Application.scriptArgs'],
    es: `
      return { type: typeof app.scriptArgs, cls: app.scriptArgs.constructor.name };`,
    uxp: `
      const { app } = require("indesign");
      const { script } = require("uxp");
      return { type: typeof app.scriptArgs, argsIsArray: Array.isArray(script.args) };`,
    expect: {
      es: { type: 'object', cls: 'ScriptArg' },
      uxp: { type: 'undefined', argsIsArray: true }
    }
  },

  folderCase('filepath-application', 'Application', 'filePath', `
      var v = app.filePath;`, `
      const { app } = require("indesign");
      return entry(app.filePath);`),

  folderCase('filepath-document', 'Document', 'filePath', `
      var doc = scratch();
      doc.save(File(WORK + "/live-es.indd"));
      if (!(doc.fullName instanceof File)) throw new Error("fullName ist kein File");
      var v = doc.filePath;`, `
      const doc = scratch();
      doc.save(WORK + "/live-uxp.indd");
      return Promise.all([entry(doc.filePath), entry(doc.fullName)]).then(([dir, file]) =>
        Object.assign(dir, { fullNamePromise: file.promise, fullNameIsFile: file.isFile }));`,
  {
    claim: 'Document.filePath ist der Ordner, die Datei steht in fullName. ExtendScript: ' +
      'instanceof Folder. UXP: Promise auf einen Ordner-Eintrag; fullName ist ein Promise ' +
      'auf einen Datei-Eintrag (await doc.fullName). doc.save() nimmt unter UXP einen Pfad-String.',
    where: 'additions.js types Document.filePath; agents.js uxp.md (await doc.fullName, ' +
      'Passing a file: path string)',
    expect: {
      es: { instanceofFolder: true, ctorFolder: true, instanceofFile: false },
      uxp: v => isFolderPromise(v) && v.fullNamePromise === true && v.fullNameIsFile === true
    }
  }),

  folderCase('filepath-book', 'Book', 'filePath', `
      var book = track(app.books.add(File(WORK + "/live-es.indb")));
      var v = book.filePath;`, `
      const { app } = require("indesign");
      const book = track(app.books.add(WORK + "/live-uxp.indb"));
      return entry(book.filePath);`),

  folderCase('filepath-bookcontent', 'BookContent', 'filePath', `
      var doc = scratch();
      doc.save(File(WORK + "/bc-es.indd"));
      var book = track(app.books.add(File(WORK + "/bc-es.indb")));
      var v = book.bookContents.add(File(WORK + "/bc-es.indd")).filePath;`, `
      const { app } = require("indesign");
      const doc = scratch();
      doc.save(WORK + "/bc-uxp.indd");
      const book = track(app.books.add(WORK + "/bc-uxp.indb"));
      return entry(book.bookContents.add(WORK + "/bc-uxp.indd").filePath);`),

  folderCase('filepath-library', 'Library', 'filePath', `
      var lib = track(app.libraries.add(File(WORK + "/live-es.indl")));
      var v = lib.filePath;`, `
      const { app } = require("indesign");
      const lib = track(app.libraries.add(WORK + "/live-uxp.indl"));
      return entry(lib.filePath);`),

  folderCase('temporaryfolder', 'GeneralPreference', 'temporaryFolder', `
      var v = app.generalPreferences.temporaryFolder;`, `
      const { app } = require("indesign");
      return entry(app.generalPreferences.temporaryFolder);`),

  folderCase('scriptsfolder', 'ScriptPreference', 'scriptsFolder', `
      var v = app.scriptPreferences.scriptsFolder;`, `
      const { app } = require("indesign");
      return entry(app.scriptPreferences.scriptsFolder);`),

  {
    id: 'string-or-file-is-string-uxp',
    title: 'Link.filePath (String | File) is a plain string in UXP',
    claim: 'Steht String neben File, liefert UXP nur den Pfad als String, kein Promise ' +
      '(Link.filePath und weitere, gemessen).',
    where: 'runtime.js valueTypes (String | File → String); agents.js uxp.md ' +
      '„String or File: only the String under UXP“',
    requires: ['Links.item'],
    es: `
      var doc = scratch();
      doc.pages[0].place(File(WORK + "/pixel.png"));
      var p = doc.links[0].filePath;
      return { type: typeof p, isFile: p instanceof File, endsWith: /pixel\\.png$/.test(String(p)) };`,
    uxp: `
      const doc = scratch();
      doc.pages.item(0).place(WORK + "/pixel.png");
      const p = doc.links.item(0).filePath;
      return { type: typeof p, promise: p instanceof Promise, endsWith: /pixel\\.png$/.test(String(p)) };`,
    expect: {
      es: v => v.endsWith === true,
      uxp: { type: 'string', promise: false, endsWith: true }
    }
  },

  {
    id: 'doscript-es-child',
    title: 'doScript() runs an ExtendScript child: typed arguments, last expression returned',
    claim: 'Ein per doScript() aufgerufenes ExtendScript bekommt withArguments als arguments ' +
      'mit ihren Typen, auch wenn UXP aufruft; doScript() liefert seinen letzten Ausdruck. ' +
      'Unter ExtendScript nur, wenn doScript() auf oberster Ebene steht — in einer Funktion ' +
      'sieht das Kind deren arguments.',
    where: 'notes.js byMember Application.doScript (es und uxp); agents.js uxp.md',
    /* Fallstrick, gemessen in 21.6: das Kind läuft im Gültigkeitsbereich des
       Aufrufers. Nur ein doScript() auf oberster Ebene reicht withArguments
       als arguments durch; in einer Funktion sieht das Kind deren arguments.
       Deshalb esTopLevel, und inFunction hält den Fallstrick fest. */
    esTopLevel: true,
    es: `
      var top = app.doScript("var a = arguments; 'last:' + typeof a[0] + ',' + typeof a[1] + ',' + a[1];",
        ScriptLanguage.JAVASCRIPT, [true, 5]);
      var inFunction = (function () {
        return app.doScript("typeof arguments[0] + ',' + arguments.length;", ScriptLanguage.JAVASCRIPT, [true, 5]);
      })(7, 8, 9);
      result = { top: top, inFunction: inFunction };`,
    uxp: `
      const { app, ScriptLanguage } = require("indesign");
      return app.doScript("var a = arguments; 'last:' + typeof a[0] + ',' + typeof a[1] + ',' + a[1];",
        ScriptLanguage.JAVASCRIPT, [true, 5]);`,
    expect: {
      es: { top: 'last:boolean,number,5', inFunction: 'number,3' },
      uxp: 'last:boolean,number,5'
    }
  },

  {
    id: 'doscript-uxp-child',
    title: 'doScript() runs a UXP child: string arguments, setResult() returned',
    claim: 'Ein per doScript() aufgerufenes UXP-Skript bekommt withArguments als Strings in ' +
      'require("uxp").script.args (true wird "TRUE"); doScript() liefert, was es an ' +
      'script.setResult() übergibt — sein letzter Ausdruck kommt nicht zurück.',
    where: 'notes.js byMember Application.doScript (uxp); agents.js uxp.md; render.js runtimes',
    es: `
      var withResult = app.doScript('const { script } = require("uxp"); ' +
        'script.setResult(JSON.stringify(script.args)); "ignored";', ScriptLanguage.UXPSCRIPT, [true, 5, "x"]);
      var lastOnly = app.doScript('"last expression";', ScriptLanguage.UXPSCRIPT);
      return { withResult: withResult, lastOnly: lastOnly === undefined ? "undefined" : String(lastOnly) };`,
    uxp: `
      const { app, ScriptLanguage } = require("indesign");
      const withResult = app.doScript('const { script } = require("uxp"); ' +
        'script.setResult(JSON.stringify(script.args)); "ignored";', ScriptLanguage.UXPSCRIPT, [true, 5, "x"]);
      const lastOnly = app.doScript('"last expression";', ScriptLanguage.UXPSCRIPT);
      return { withResult, lastOnly: lastOnly === undefined ? "undefined" : String(lastOnly) };`,
    expect: {
      es: v => v.withResult === '["TRUE","5","x"]' && v.lastOnly !== 'last expression',
      uxp: v => v.withResult === '["TRUE","5","x"]' && v.lastOnly !== 'last expression'
    }
  },

  {
    id: 'collection-index-uxp',
    title: 'Collection index access [] does not exist in UXP',
    claim: 'Die 242 Methoden namens [] (Index-Zugriff auf Collections) gibt es unter UXP ' +
      'nicht: pages[0] geht nicht, nur pages.item(0).',
    where: 'runtime.js member() kind m ([] → available: false); agents.js uxp.md; render.js runtimes',
    requires: ['Pages.item'],
    es: `
      var doc = scratch();
      return { index: doc.pages[0].isValid, item: doc.pages.item(0).isValid };`,
    uxp: `
      const doc = scratch();
      return { index: typeof doc.pages[0], item: doc.pages.item(0).isValid };`,
    expect: {
      es: { index: true, item: true },
      uxp: { index: 'undefined', item: true }
    }
  },

  {
    id: 'enum-equals-uxp',
    title: 'Enumerations compare with equals() in UXP, == in ExtendScript',
    claim: 'Unter UXP greifen == und === bei Enumerationswerten nicht; verglichen wird mit ' +
      'equals(). Unter ExtendScript geht ==.',
    where: 'notes.js byKind Enumeration; examples.js HELLO_JSX/HELLO_IDJS; agents.js uxp.md',
    es: `
      var frame = scratch().pages[0].textFrames.add();
      frame.contents = "x";
      var para = frame.paragraphs[0];
      para.justification = Justification.CENTER_ALIGN;
      return { eq: para.justification == Justification.CENTER_ALIGN,
        strict: para.justification === Justification.CENTER_ALIGN };`,
    uxp: `
      const { Justification } = require("indesign");
      const frame = scratch().pages.item(0).textFrames.add();
      frame.contents = "x";
      const para = frame.paragraphs.item(0);
      para.justification = Justification.CENTER_ALIGN;
      const j = para.justification;
      return { eq: j == Justification.CENTER_ALIGN, strict: j === Justification.CENTER_ALIGN,
        equals: typeof j.equals === "function" ? j.equals(Justification.CENTER_ALIGN) : "no equals()",
        notEquals: typeof j.equals === "function" ? j.equals(Justification.LEFT_ALIGN) : "no equals()" };`,
    expect: {
      es: { eq: true, strict: true },
      uxp: { eq: false, strict: false, equals: true, notEquals: false }
    }
  },

  {
    id: 'dom-equals-uxp',
    title: 'DOM objects compare with equals() in UXP, == in ExtendScript',
    claim: 'Zwei Verweise auf dasselbe DOM-Objekt: unter ExtendScript gleich mit ==, unter ' +
      'UXP nur mit equals() — == und === greifen nicht.',
    where: 'agents.js uxp.md „Compare enumerations, DOM objects“; notes.js byKind Enumeration',
    es: `
      var doc = scratch();
      return { eq: doc.pages[0] == doc.pages.item(0) };`,
    uxp: `
      const doc = scratch();
      const a = doc.pages.item(0), b = doc.pages.item(0);
      return { eq: a == b, strict: a === b, equals: a.equals(b) };`,
    expect: {
      es: { eq: true },
      uxp: { eq: false, strict: false, equals: true }
    }
  },

  {
    id: 'hasownproperty-uxp',
    title: 'hasOwnProperty() is false on DOM objects in UXP; "in" works',
    claim: 'Unter ExtendScript prüft man eine Property mit hasOwnProperty() oder in. Unter UXP ' +
      'sind hasOwnProperty() und Object.hasOwn() an DOM-Objekten immer false; nur in geht.',
    where: 'render.js runtimes (Property check); agents.js uxp.md; examples.js-Kommentar',
    es: `
      var page = scratch().pages[0];
      return { own: page.hasOwnProperty("name"), inOp: "name" in page,
        ownMissing: page.hasOwnProperty("noSuchProperty") };`,
    uxp: `
      const page = scratch().pages.item(0);
      return { own: page.hasOwnProperty("name"), hasOwn: Object.hasOwn(page, "name"),
        inOp: "name" in page, inMissing: "noSuchProperty" in page };`,
    expect: {
      es: { own: true, inOp: true, ownMissing: false },
      uxp: { own: false, hasOwn: false, inOp: true, inMissing: false }
    }
  },

  {
    id: 'extendscript-only-globals',
    title: '$, E4X, ScriptUI and Adobe extras do not exist in UXP',
    claim: 'Unter UXP gibt es $, Namespace, QName, Reflection, ReflectionInfo, Socket, ' +
      'UnitValue, XML, XMLList und ScriptUI nicht; unter ExtendScript sind sie global.',
    where: 'runtime.js NO_UXP; agents.js uxp.md „Not available“; render.js runtimes',
    es: `
      var names = ["$", "Namespace", "QName", "Reflection", "ReflectionInfo", "Socket",
        "UnitValue", "XML", "XMLList", "ScriptUI"], out = {};
      for (var i = 0; i < names.length; i++) out[names[i]] = eval("typeof " + names[i]);
      return out;`,
    uxp: `
      const names = ["$", "Namespace", "QName", "Reflection", "ReflectionInfo", "Socket",
        "UnitValue", "XML", "XMLList", "ScriptUI"], out = {};
      for (const n of names) out[n] = typeof globalThis[n];
      return out;`,
    expect: {
      es: v => Object.values(v).every(t => t !== 'undefined') || 'nicht global: ' +
        Object.keys(v).filter(k => v[k] === 'undefined').join(', '),
      uxp: v => Object.values(v).every(t => t === 'undefined') || 'vorhanden: ' +
        Object.keys(v).filter(k => v[k] !== 'undefined').join(', ')
    }
  },

  {
    id: 'event-handler-file',
    title: 'Event handler: function or File in ExtendScript, function or .jsx path in UXP',
    claim: 'addEventListener() nimmt unter ExtendScript eine Funktion oder ein File, unter UXP ' +
      'eine Funktion oder den Pfad einer .jsx als String; die .jsx läuft beim Ereignis.',
    where: 'runtime.js isHandler und HANDLER_NOTE; agents.js uxp.md (Tabelle)',
    /* Die erste Speicherung eines neuen Dokuments ist ein Speichern unter —
       beforeSave/afterSave feuern dabei nicht, afterSaveAs schon.
       handler-*.jsx legt neben sich eine Datei <name>.fired an. Unter UXP
       feuern Handler erst nach dem auslösenden Aufruf, deshalb dort ein paar
       Promise-Runden Abstand. */
    es: `
      var doc = scratch();
      var l = doc.addEventListener("afterSaveAs", File(WORK + "/handler-es.jsx"));
      var registered = l.isValid;
      doc.save(File(WORK + "/handler-es.indd"));
      l.remove();
      return { fileHandler: registered, fired: File(WORK + "/handler-es.jsx.fired").exists };`,
    uxp: `
      const { app } = require("indesign");
      const fs = require("fs");
      const doc = scratch();
      const r = {}, hits = [];
      const fn = doc.addEventListener("afterSaveAs", ev => hits.push(ev.eventType));
      r.functionHandler = !!(fn && fn.isValid);
      try {
        const l = doc.addEventListener("afterSaveAs", WORK + "/handler-uxp.jsx");
        r.pathHandler = !!(l && l.isValid);
      } catch (e) { r.pathHandler = "threw: " + String(e.message || e); }
      doc.save(WORK + "/handler-uxp.indd");
      const later = () => app.filePath;
      return later().then(later).then(later).then(() => {
        r.functionFired = hits.length > 0;
        try { fs.readFileSync(WORK + "/handler-uxp.jsx.fired"); r.pathFired = true; } catch (e) { r.pathFired = false; }
        return r;
      });`,
    expect: {
      es: { fileHandler: true, fired: true },
      uxp: { functionHandler: true, pathHandler: true, functionFired: true, pathFired: true }
    }
  },

  {
    id: 'uxp-save-file-entry',
    title: 'UXP accepts a localFileSystem File entry where a file is passed',
    claim: 'Eine Datei übergibt man unter UXP als Pfad-String oder als File-Eintrag aus ' +
      'require("uxp").storage.',
    where: 'agents.js uxp.md „Passing a file“',
    uxp: `
      const { localFileSystem } = require("uxp").storage;
      const doc = scratch();
      return (async () => {
        const dir = await localFileSystem.getEntryWithUrl("file:" + WORK);
        const f = await dir.createFile("entry.indd", { overwrite: true });
        doc.save(f);
        const full = await doc.fullName;
        return { saved: doc.saved, isFile: full.isFile, path: /[\\\\/]entry\\.indd$/.test(full.nativePath) };
      })();`,
    expect: { uxp: { saved: true, isFile: true, path: true } }
  },

  {
    id: 'example-hello',
    title: 'examples.js Hello World runs in both engines',
    claim: 'Die Hello-World-Beispiele der Übersichtsseite laufen; ExtendScript vergleicht die ' +
      'Enumeration mit ==, UXP mit equals(), beide melden "centered".',
    where: 'examples.js HELLO_JSX, HELLO_IDJS; render.js runtimes; check-site.js',
    es: `
      var __log = [];
      var alert = function (m) { __log.push(String(m)); };
      ${hidden(examples.HELLO_JSX, 'scratch()')}
      return __log;`,
    uxp: `
      const __log = [];
      const console = { log: m => __log.push(String(m)) };
      ${hidden(examples.HELLO_IDJS, 'scratch()')}
      return __log;`,
    expect: { es: ['centered'], uxp: ['centered'] }
  },

  {
    id: 'example-server',
    title: 'examples.js server scripts take the argument and return the result',
    claim: 'Server-Beispiel: ExtendScript liest app.scriptArgs und liefert den letzten Ausdruck; ' +
      'UXP liest "name=value" aus script.args und liefert per setResult(). Geprüft über ' +
      'doScript() mit gesetztem Argument, wie es ein Server-Client übergibt.',
    where: 'examples.js SERVER_JSX, SERVER_IDJS; agents.js uxp.md (InDesign Server)',
    es: `
      app.scriptArgs.save();
      try {
        app.scriptArgs.setValue("name", "Live");
        return app.doScript(${JSON.stringify(hidden(examples.SERVER_JSX, 'app.documents.add(false)'))},
          ScriptLanguage.JAVASCRIPT);
      } finally { app.scriptArgs.restore(); }`,
    uxp: `
      const { app, ScriptLanguage } = require("indesign");
      return app.doScript(${JSON.stringify(hidden(examples.SERVER_IDJS, 'app.documents.add(false)'))},
        ScriptLanguage.UXPSCRIPT, ["name=Live"]);`,
    expect: { es: 'Hello Live', uxp: 'Hello Live' }
  },

  /* ---------- seit InDesign 2027 (22.0) ----------
     Zuerst gefunden von Vlad Vladila (vamitul) im Prerelease. */
  {
    id: 'json-methods-es-only',
    title: 'Application JSON methods exist in ExtendScript, not in UXP',
    claim: 'parseJson, parseJsonFile, stringifyJson, writeJsonFile: unter ExtendScript Funktionen ' +
      '(Rundreise klappt), unter UXP undefined.',
    where: 'runtime.js ES_ONLY.members Application.parseJson u. a.',
    requires: ['22.0'],
    es: `
      var names = ["parseJson", "parseJsonFile", "stringifyJson", "writeJsonFile"], t = [];
      for (var i = 0; i < names.length; i++) t.push(typeof app[names[i]]);
      return { types: t.join(), roundTrip: app.stringifyJson(app.parseJson('{"a":[1,2]}')) };`,
    uxp: `
      const { app } = require("indesign");
      return { types: ["parseJson", "parseJsonFile", "stringifyJson", "writeJsonFile"].map(n => typeof app[n]).join() };`,
    expect: {
      es: v => v.types === 'function,function,function,function' && /"a"/.test(v.roundTrip),
      uxp: { types: 'undefined,undefined,undefined,undefined' }
    }
  },

  {
    id: 'genai-es-only',
    title: 'GenAI classes and Document.genaiModels are missing in UXP; add() fails in ExtendScript',
    claim: 'require("indesign") exportiert GenAIModel(s)/GenAIImage(s) nicht, Document.genaiModels ' +
      'ist unter UXP undefined. Unter ExtendScript eine leere Sammlung, add() wirft.',
    where: 'runtime.js ES_ONLY.classes GenAI*, ES_ONLY.members Document.genaiModels; notes.js GenAIModels.add',
    requires: ['22.0'],
    es: `
      var d = scratch(), r = { type: d.genaiModels.constructor.name, length: d.genaiModels.length };
      try { d.genaiModels.add(); r.add = "ok"; } catch (e) { r.add = "threw"; }
      return r;`,
    uxp: `
      const DOM = require("indesign");
      const d = scratch();
      return {
        classes: ["GenAIModel", "GenAIModels", "GenAIImage", "GenAIImages"].map(n => typeof DOM[n]).join(),
        genaiModels: typeof d.genaiModels
      };`,
    expect: {
      es: { type: 'GenAIModels', length: 0, add: 'threw' },
      uxp: { classes: 'undefined,undefined,undefined,undefined', genaiModels: 'undefined' }
    }
  },

  {
    id: 'checkdocument-pref-throws',
    title: 'Reading app.checkDocumentOnExportPreference throws',
    claim: 'Die Property existiert, Lesen wirft in beiden Laufzeiten.',
    where: 'notes.js byMember Application.checkDocumentOnExportPreference',
    requires: ['22.0'],
    es: `
      try { return { value: String(app.checkDocumentOnExportPreference) }; }
      catch (e) { return { threw: true }; }`,
    uxp: `
      const { app } = require("indesign");
      const r = { inApp: "checkDocumentOnExportPreference" in app };
      try { r.value = String(app.checkDocumentOnExportPreference); } catch (e) { r.threw = true; }
      return r;`,
    expect: { es: { threw: true }, uxp: { inApp: true, threw: true } }
  },

  {
    id: 'applygrammarfix-number',
    title: 'applyGrammarFix() returns a number, not a boolean',
    claim: 'Adobes Export sagt bool, geliefert wird eine Zahl (1 angewendet, 0 nicht).',
    where: 'additions.js returns *.applyGrammarFix',
    requires: ['22.0'],
    es: `
      var f = scratch().pages[0].textFrames.add();
      f.contents = "He go to the store.";
      var r = f.parentStory.applyGrammarFix(99999);
      return typeof r + "," + r;`,
    uxp: `
      const f = scratch().pages.item(0).textFrames.add();
      f.contents = "He go to the store.";
      const r = f.parentStory.applyGrammarFix(99999);
      return typeof r + "," + r;`,
    expect: { es: 'number,0', uxp: 'number,0' }
  },

  {
    id: 'tablestyle-summary-unset',
    title: 'TableStyle.tableSummary throws until set; NothingEnum is rejected',
    claim: 'Ohne eigenen Wert wirft das Lesen; nach dem Setzen lesbar. NothingEnum.NOTHING wird ' +
      'abgelehnt, auch an Table.tableSummary (dort ist ungesetzt "").',
    where: 'notes.js byMember TableStyle.tableSummary',
    requires: ['22.0'],
    es: `
      var d = scratch(), st = d.tableStyles.add(), r = {};
      try { st.tableSummary; r.unsetRead = "ok"; } catch (e) { r.unsetRead = "threw"; }
      st.tableSummary = "x"; r.afterSet = st.tableSummary;
      try { st.tableSummary = NothingEnum.NOTHING; r.nothing = "accepted"; } catch (e) { r.nothing = "rejected"; }
      var f = d.pages[0].textFrames.add(); f.geometricBounds = [10, 10, 150, 150];
      r.tableUnset = f.parentStory.insertionPoints[0].tables.add().tableSummary;
      return r;`,
    uxp: `
      const { NothingEnum } = require("indesign");
      const d = scratch(), st = d.tableStyles.add(), r = {};
      try { st.tableSummary; r.unsetRead = "ok"; } catch (e) { r.unsetRead = "threw"; }
      st.tableSummary = "x"; r.afterSet = st.tableSummary;
      try { st.tableSummary = NothingEnum.NOTHING; r.nothing = "accepted"; } catch (e) { r.nothing = "rejected"; }
      const f = d.pages.item(0).textFrames.add(); f.geometricBounds = [10, 10, 150, 150];
      r.tableUnset = f.parentStory.insertionPoints.item(0).tables.add().tableSummary;
      return r;`,
    expect: {
      es: { unsetRead: 'threw', afterSet: 'x', nothing: 'rejected', tableUnset: '' },
      uxp: { unsetRead: 'threw', afterSet: 'x', nothing: 'rejected', tableUnset: '' }
    }
  }
];

module.exports = { cases, SAMPLES, FIXTURES };
