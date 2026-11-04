/* Bereinigt Adobes OMV-Daten beim Einlesen: Typnamen, Zusatztypen aus der
   Beschreibung, Wertebereiche, Masseinheiten. Eine Zwischendatei gibt es
   nicht. */
'use strict';

/* ScriptUI-Klassen heissen im Original wie Produktklassen (Button, Group …).
   Das Suffix haelt sie auseinander — ausser bei den Grundtypen. */
const SUI_EXEMPT = /(object|string|bool|number|array|function|file|folder)/i;

/* Adobes Typnamen sind uneinheitlich geschrieben. Reihenfolge der Ersetzungen
   ist wichtig, sie bauen aufeinander auf. */
function cleanTypeName(text, isSui) {
  let s = String(text == null ? '' : text);

  /* Adobe presst Feldname und Typ in eine Angabe:
       "boundsKind:BoundingBoxLimits enumerator"
       "Ordered array containing coordinateSpace:CoordinateSpaces enumerator,
        boundsKind:BoundingBoxLimits enumerator"
     Ohne Behandlung zieht die Bereinigung das zu "BoundsKind:BoundingBoxLimits"
     zusammen — ein Name, der nirgends verlinkt und in der Typspalte als Rohtext
     steht. Gemeint ist der Teil hinter dem letzten Doppelpunkt; nennt der Text
     eine geordnete Liste, ist es ein Array. Dessen Elemente sind verschieden
     getypt (Koordinatenraum, Bezugsrahmen, Zahlen), deshalb bleibt es beim
     allgemeinen Array — ein Elementtyp waere geraten und wuerde richtigen Code
     als falsch melden. Was genau in der Liste steht, sagt die Beschreibung.
     Betrifft 231 Angaben je InDesign-Modell, 223 davon aufloesbar. */
  if (s.includes(':')) {
    if (/ordered\s*array\s*containing/i.test(s)) return 'Array';
    const tail = s.slice(s.lastIndexOf(':') + 1);
    if (/[A-Za-z]/.test(tail)) return cleanTypeName(tail, isSui);
  }

  if (isSui && !SUI_EXEMPT.test(s)) s += 'SUI';

  /* "Array of X" behaelt seine Schreibweise, nur das Praefix faellt weg. */
  /* Der Array-Zweig laesst die Schreibweise stehen, deshalb bleiben hier sonst
     Satzzeichen kleben: aus "Array of Conditions." wuerde "Conditions." und der
     Typ verlinkte nicht mehr. */
  if (/Array/.test(s)) return s.replace(/Array of /g, '').trim().replace(/[.\s]+$/, '');

  s = s.replace(/enumerator/g, '')
       .replace(/[\s.]/g, '');
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s.replace(/Varies=any/g, 'Varies')
          .replace(/VariesType/g, 'Varies')   /* "dataValue:VariesType" */
          .replace(/Any/g, 'Varies')
          .replace(/NothingEnumerat/g, 'NothingEnum')
          .replace(/Bool/g, 'Boolean')
          .replace(/Booleanean/g, 'Boolean')
          .replace(/SpecialCharacterss/g, 'SpecialCharacters');
}

/* Adobe haengt Zusatztypen als Prosa an die Beschreibung:
     "… Can return: Swatch or NothingEnum enumerator. Can also accept: String."

   Beide Marken muessen ersetzt werden, sonst entsteht aus dem Beispiel ein
   Typ "NothingEnumCanalsoaccept:String". */
function splitAcceptReturn(text) {
  return String(text)
    .replace(/ or /g, ',')
    .replace(/Can also accept:/g, ',')
    .replace(/Can accept:/g, ',')
    .split(',');
}

const ACCEPT_RE = /(Can also accept:|Can return:|Can accept:)([\s\S]*)$/;
const RANGE_RE = /(?:range of|Range:) (\d+) to (\d+)/;

/* Wertebereiche stehen nur im Fliesstext: "(Range: 0 to 100)". */
function rangeOf(description) {
  const m = RANGE_RE.exec(String(description || ''));
  return m ? [m[1], m[2]] : null;
}

/* Aus einem <property>/<parameter>/<method> die vollstaendige Typliste bauen:
   die deklarierten <datatype>-Kinder plus die aus der Beschreibung abgeleiteten.

   Rueckgabe: { types:[{name, array, isUnit, value}], range } */
function datatypesOf(node, description, isSui, kids, textOf) {
  const out = [];
  const declared = kids(node, 'datatype');
  const MU = 'Measurement Unit (Number or String)=any';
  let range = null;

  for (const dt of declared) {
    const raw = textOf(kids(dt, 'type')[0]);
    const hasArray = kids(dt, 'array').length > 0;
    const valueEl = kids(dt, 'value')[0];
    const value = valueEl ? textOf(valueEl) : null;
    const isMU = raw.startsWith(MU);

    const dminEl = kids(dt, 'min')[0], dmaxEl = kids(dt, 'max')[0];
    const dmin = dminEl ? textOf(dminEl) : null, dmax = dmaxEl ? textOf(dmaxEl) : null;
    /* Die Beschreibung wird nur geparst, wenn die Quelle nicht beide
       Grenzen nennt. Wo sich beides widerspricht, gewinnt die Quelle:
       BevelAndEmbossSetting.altitude sagt im Text "0 to 90", deklariert 0..100. */
    const parsed = (dmin !== null && dmax !== null) ? null : rangeOf(description);

    if (isMU) {
      /* Masseinheit: min/max der Quelle werden NICHT uebernommen — nur ein
         aus der Beschreibung geparster Bereich gilt hier. */
      if (range === null && parsed) range = [parsed[0], parsed[1]];
      out.push({ name: 'Number', array: hasArray, isUnit: true, value: null });
      out.push({ name: 'String', array: hasArray, isUnit: true, value: null });
    } else {
      if (range === null) {
        const mn = dmin !== null ? dmin : (parsed ? parsed[0] : null);
        const mx = dmax !== null ? dmax : (parsed ? parsed[1] : null);
        if (mn !== null || mx !== null) range = [mn === null ? '' : mn, mx === null ? '' : mx];
      }
      out.push({ name: cleanTypeName(raw, isSui), array: hasArray, isUnit: false, value });
    }

    /* Die abgeleiteten Typen haengen an jedem datatype-Element, nicht an der
       Property; bei mehreren datatype-Kindern entstehen sie also mehrfach. */
    const m = ACCEPT_RE.exec(String(description || '').replace(/\(Optional\)/g, ''));
    if (m) {
      const parts = splitAcceptReturn(m[2])
        .filter(t => t.replace(/\s/g, '') !== '')
        .sort();
      for (const part of parts) {
        const name = cleanTypeName(part, isSui);
        /* NothingEnum ist nie ein Array, auch wenn das Elternteil eines ist. */
        const arr = name.startsWith('NothingEnum') ? false
          : (hasArray || /Array of/.test(part));
        out.push({ name, array: arr, isUnit: false, value: null });
      }
    }
  }
  return { types: out, range };
}

/* Die parent-Property nennt ihre moeglichen Typen nur im Text:
     "The parent of the Rectangle (a Spread, Page or Group)." */
const PARENT_RE = /^The parent.+?\(a ([\s\S]+?)\)/;
function parentTypes(description, isSui) {
  const s = String(description || '');
  const typ = t => ({ name: cleanTypeName(t, isSui), array: false, isUnit: false, value: null });

  const m = PARENT_RE.exec(s);
  if (m) return m[1].replace(/ or /g, ',').split(',').sort().map(typ);

  /* Ohne die Klammerform nennt Adobe den Typ in zwei anderen Formen. Die
     Sonderbehandlung von parent uebersprang beide, und 21 parent-Angaben
     blieben ohne Typ — damit fehlten sie auch in der Hierarchie.

       Link.parent   "The linked object. Can return: Story, Graphic, Movie or Sound."
       File.parent   "The Folder object for the folder that contains this file."

     Ein Artikel ist kein Typ: "The object's container" (135 Collections in
     Illustrator und Photoshop) nennt keinen. Ohne Treffer gilt die
     datatype-Angabe der Quelle, siehe model.js. */
  const acc = ACCEPT_RE.exec(s);
  if (acc) {
    const parts = splitAcceptReturn(acc[2]).filter(t => t.replace(/\s/g, '') !== '');
    if (parts.length) return parts.sort().map(typ);
  }
  const obj = /\b(?!(?:The|An?)\b)([A-Z][A-Za-z]+) object\b/.exec(s);
  if (obj) return [typ(obj[1])];
  return [];
}

/* Nachtraege, die in Adobes Export fehlen. */
const APPLESCRIPT_LANGUAGE = {
  n: 'APPLESCRIPT_LANGUAGE', t: ['Number'], rw: 'readonly',
  d: 'The AppleScript language.', v: '1095978087'
};
const GLOBAL_APP = {
  n: 'app', t: ['Application'], rw: 'readonly', d: 'The application object'
};

module.exports = {
  cleanTypeName, splitAcceptReturn, datatypesOf, parentTypes, rangeOf,
  APPLESCRIPT_LANGUAGE, GLOBAL_APP
};
