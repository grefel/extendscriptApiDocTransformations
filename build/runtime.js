/* Was unter UXP anders ist als unter ExtendScript.

   InDesign und InDesign Server beschreiben mit demselben Objektmodell beide
   Laufzeiten (products.js: uxp: true). Die Unterschiede stehen nicht in
   Adobes Export; sie werden hier einmal festgehalten und von allen Ausgaben
   gleich abgefragt — der Seite (render.js), dem Markdown und api.json
   (agents.js). Die Seite blendet um, die Dateien nennen beide Fassungen.

   Belege:
     Adobes Migrationsanleitung
       developer.adobe.com/indesign/uxp/resources/migration-guides/extendscript/
     indesign-uxp-types 1.0.0 (InDesign 2026, zur Laufzeit gemessen)
       www.npmjs.com/package/indesign-uxp-types

   Hinweistexte stehen weiter in notes.js, ergaenzte Member in additions.js
   (uxp: false). Dieses Modul liest beide. */
'use strict';

const notes = require('./notes');

/* File und Folder heissen unter UXP genauso, sind aber Eintraege aus
   require('uxp').storage.localFileSystem — eine andere API. */
const UXP_DOCS = {
  File: 'https://developer.adobe.com/indesign/uxp/reference/uxp-api/reference-js/' +
    'modules/uxp/persistent-file-storage/file',
  Folder: 'https://developer.adobe.com/indesign/uxp/reference/uxp-api/reference-js/' +
    'modules/uxp/persistent-file-storage/folder'
};

/* Standard-ECMAScript gibt es unter UXP in moderner Fassung; die Seiten hier
   beschreiben ES3 von 2003, deshalb zeigt der Verweis auf MDN. */
const MDN = 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/';
const MDN_CLASSES = new Set(['Array', 'Boolean', 'Date', 'Error', 'Function',
  'Math', 'Number', 'Object', 'RegExp', 'String']);

/* Gibt es unter UXP gar nicht: das Debugobjekt, die E4X-Klassen und Adobes
   Eigenbauten. */
const NO_UXP = new Set(['$', 'Namespace', 'QName', 'Reflection', 'ReflectionInfo',
  'Socket', 'UnitValue', 'XML', 'XMLList', 'global']);

/* Produktklassen und -member, die Adobes Export ohne Einschränkung führt, die
   es unter UXP aber nicht gibt: require('indesign') exportiert die Klasse
   nicht, der Member ist dort undefined. Eintragen erst, wenn ein Fall in
   build/live/cases.js es in beiden Laufzeiten belegt.
     classes  Klassenname → { products, live }
     members  'Klasse.member' → { products, live } — Property, Methode oder Event
   products wie in notes.js; live nennt die ID des Falls in build/live/.
   Eine Klasse bekommt oben auf ihrer Seite einen Hinweis, ihre Members
   bleiben dort sichtbar; Verweise auf sie werden unter UXP abgeschaltet.
   Eine Property, die auf sie zeigt (Document.genaiModels), braucht einen
   eigenen Eintrag unter members. */
const ES_ONLY = { classes: {}, members: {} };

/* Ein File als Event-Handler gibt es unter UXP nicht — dort ist es immer eine
   Funktion. app.doScript() bleibt unberuehrt: es fuehrt eine
   ExtendScript-Datei auch unter UXP aus. */
const isHandler = (cls, method, arg) => arg === 'handler' &&
  (/^(add|remove)EventListener$/.test(method) ||
    (cls === 'EventListeners' && method === 'add'));

const FILE_TYPES = ['File', 'Folder'];

/* target: Eintrag aus build.js. isCore(name): verweist der Typname auf die
   Kern-JavaScript-Bibliothek? Ein Produkt darf eine eigene Klasse File
   haben — die bleibt unberuehrt. */
function forTarget(target, isCore) {
  const on = !!target.uxp;
  const fits = n => !n.products || n.products.includes(target.slug);
  /* Ohne Umschalter beschreibt das Ziel nur ExtendScript: Hinweise, die
     allein UXP betreffen, fallen dort weg. */
  const shown = n => fits(n) && (on || !n.runtime || n.runtime === 'es');
  const strip = n => ({ runtime: n.runtime || null, text: n.text });
  const esOnlyClass = n => on && !!ES_ONLY.classes[n] && fits(ES_ONLY.classes[n]);
  const esOnlyMember = (cls, n) =>
    on && !!ES_ONLY.members[cls + '.' + n] && fits(ES_ONLY.members[cls + '.' + n]);

  /* Typnamen, die als Wert zurueckkommen. Unter UXP ist ein File oder Folder
     dort ein Promise auf einen localFileSystem-Eintrag. Steht String
     daneben, liefert UXP nur den Pfad als String (Link.filePath und sechs
     weitere, gemessen) — dann entfaellt der Dateityp. */
  function valueTypes(ts) {
    const files = (ts || []).filter(n => FILE_TYPES.includes(n) && isCore(n));
    if (!files.length) return null;
    return ts.includes('String') ? { promise: [], hide: files } : { promise: files, hide: [] };
  }

  return {
    on,

    /* Ziel eines Typverweises unter UXP: { href } fuer ein anderes Ziel,
       { off: true }, wenn es die Klasse dort nicht gibt, sonst null.
       Betrifft die Kernklassen und die Produktklassen aus ES_ONLY. */
    coreLink(n) {
      if (esOnlyClass(n)) return { off: true };
      if (!on || !isCore(n)) return null;
      if (UXP_DOCS[n]) return { href: UXP_DOCS[n] };
      if (MDN_CLASSES.has(n)) return { href: MDN + n };
      if (NO_UXP.has(n)) return { off: true };
      return null;
    },

    /* Abweichung eines Members unter UXP, oder null.
         kind 'm'  die Methode als Ganzes → { available: false }
         kind 'p'  Property-Typ            → { promise, hide }
         kind 'r'  Rueckgabetyp            → { promise, hide }
         kind 'a'  Parameter (method, arg) → { promise, hide }
       promise: Typnamen, die unter UXP Promise<…> sind.
       hide:    Typnamen, die es an dieser Stelle unter UXP nicht gibt. */
    member(cls, kind, x, method) {
      if (!on) return null;
      if (kind === 'm')
        /* [] ist der Index-Zugriff auf Collections, den UXP nicht kennt. */
        return x.n === '[]' || x.uxp === false || esOnlyMember(cls, x.n) ? { available: false } : null;
      if (kind === 'p' || kind === 'r') return valueTypes(kind === 'p' ? x.t : x.r);
      if (kind === 'a' && isHandler(cls, method, x.n) && (x.t || []).includes('File'))
        return { promise: [], hide: ['File'] };
      return null;
    },

    /* Property oder Event, das es unter UXP nicht gibt (ES_ONLY). Methoden
       fragt member(cls, 'm', …) ab. */
    gone(cls, name) {
      return esOnlyMember(cls, name);
    },

    /* Klasse, die es unter UXP nicht gibt (ES_ONLY). */
    esOnly(cls) {
      return esOnlyClass(cls);
    },

    /* Hinweise am Objekt und an einem Member, je { runtime, text }. */
    notes(cls, kind) {
      const out = [];
      if (esOnlyClass(cls)) out.push({ runtime: 'uxp', text: 'Not available in UXP — ' +
        'require("indesign") does not export this object. ExtendScript only.' });
      const n = notes.byName[cls];
      if (n && shown(n)) out.push(strip(n));
      for (const k of notes.byKind) if (k.kind === kind && shown(k)) out.push(strip(k));
      return out;
    },
    memberNotes(cls, member) {
      return [].concat(notes.byMember[cls + '.' + member] || []).filter(shown).map(strip);
    }
  };
}

module.exports = { forTarget, UXP_DOCS, MDN, MDN_CLASSES, NO_UXP, ES_ONLY };
