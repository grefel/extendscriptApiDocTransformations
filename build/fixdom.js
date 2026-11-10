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

/* Adobes neuerer Export (erkennbar am <map> ohne title; Media Encoder 2027,
   Bridge 2027) hat Parameter zerlegt. Der Exporter schrieb „Text:typ" in
   <type> und trennte an jedem Komma einen neuen <parameter> ab, dessen Name
   ein Satzfetzen ist; die Beschreibung der Methode landete dabei am letzten
   Fetzen. Hier wird das im DOM zurückgebaut, bevor model.js liest:

   - Fetzen (Name kein Bezeichner) gehören zum Parameter davor; ihre Namen
     und Texte werden mit „, " wieder zur Beschreibung, der Typ hinter dem
     letzten Doppelpunkt gilt.
   - Eine <shortdesc> am letzten Parameter oder Fetzen geht an die Methode,
     wenn die keine hat.
   - „Optional…" am Anfang macht den Parameter optional.
   - „A | null" wird A, „X[]" wird X mit <array/>; übrig bleibende Prosa
     („Close count") wird any.
   - Interne Notizen („### TODO: …") fallen aus den Beschreibungen.

   Im älteren Export greift nichts davon: dort ist Text im Typ gewollt
   („Measurement Unit (Number or String)"). */
const IDENT = /^[A-Za-z_$][\w$]*$/;
const TYPE_TAIL = /^([\s\S]*?\S)\s*:\s*([A-Za-z_$][\w$]*(?:\[\])?)$/;

function repairNewExport(doc) {
  const st = { merged: 0, retyped: 0, moved: 0, todo: 0 };
  const map = doc.getElementsByTagName('map')[0];
  if (!map || map.getAttribute('title')) return st;
  const el = (node, name) => [...node.childNodes].filter(n => n.nodeType === 1 && n.nodeName === name);
  const squash = s => s.replace(/\s+/g, ' ').trim();
  const setText = (node, s) => { while (node.firstChild) node.removeChild(node.firstChild); node.appendChild(doc.createTextNode(s)); };
  const shortdescOf = node => {
    let sd = el(node, 'shortdesc')[0];
    if (!sd) { sd = doc.createElement('shortdesc'); node.insertBefore(sd, node.firstChild); }
    return sd;
  };

  for (const ps of [...doc.getElementsByTagName('parameters')]) {
    const method = ps.parentNode;
    /* Der Exporter hängt die Beschreibung der Methode an den letzten
       Parameter — in Media Encoder 2027 296-mal, an keinem anderen Platz. */
    const params = el(ps, 'parameter'), last = params[params.length - 1];
    const lastSd = last && el(last, 'shortdesc')[0];
    if (lastSd && !el(method, 'shortdesc').length) { method.insertBefore(lastSd, method.firstChild); st.moved++; }
    const groups = [];
    for (const p of el(ps, 'parameter')) {
      const name = squash(p.getAttribute('name'));
      if (IDENT.test(name)) { groups.push({ node: p, extra: [] }); continue; }
      if (groups.length) { groups[groups.length - 1].extra.push(p); continue; }
      /* Fetzen ganz vorn: ohne Namen ist es kein Parameter (PluginSupport),
         sonst wird das erste Wort der Name und der Rest Text
         (ObjectReflection: „object to inspect"). */
      if (!name) { ps.removeChild(p); st.merged++; continue; }
      const first = name.split(' ')[0];
      p.setAttribute('name', IDENT.test(first) ? first : 'value');
      setText(shortdescOf(p), squash(name + ' ' + (el(p, 'shortdesc')[0] || { textContent: '' }).textContent));
      groups.push({ node: p, extra: [] });
      st.retyped++;
    }
    for (const g of groups) {
      const typeEl = g.node.getElementsByTagName('type')[0];
      const own = typeEl ? squash(typeEl.textContent) : '';
      if (!g.extra.length && !/\s/.test(own)) continue;
      const parts = [];
      let type = null;
      const read = s => {
        const m = TYPE_TAIL.exec(s);
        if (m) { parts.push(m[1]); type = m[2]; } else if (/\s/.test(s)) parts.push(s); else if (s) type = s;
      };
      read(own);
      for (const x of g.extra) {
        parts.push(squash(x.getAttribute('name')));
        const t = x.getElementsByTagName('type')[0];
        read(t ? squash(t.textContent) : '');
        const sd = el(x, 'shortdesc')[0];
        if (sd) {
          if (!el(method, 'shortdesc').length) { method.insertBefore(sd, method.firstChild); st.moved++; }
          else parts.push(squash(sd.textContent));
        }
        ps.removeChild(x);
        st.merged++;
      }
      if (typeEl) setText(typeEl, type || 'any');
      const text = parts.join(', ');
      const sd = shortdescOf(g.node);
      setText(sd, squash([text, sd.textContent].join(' ')));
      if (/^Optional\b/i.test(text)) g.node.setAttribute('optional', 'true');
      st.retyped++;
    }
  }

  for (const t of [...doc.getElementsByTagName('type')]) {
    const raw = squash(t.textContent);
    const names = raw.split(/\s*\|\s*/).filter(n => n && n !== 'null');
    if (names.length === 1 && names[0] === raw && !/\[\]$/.test(raw) && !/\s/.test(raw)) continue;
    const dt = t.parentNode;
    const clean = names.map(n => /\s/.test(n) ? 'any' : n);
    clean.forEach((n, i) => {
      const target = i === 0 ? dt : dt.parentNode.insertBefore(doc.createElement('datatype'), dt.nextSibling);
      const typeNode = i === 0 ? t : target.appendChild(doc.createElement('type'));
      setText(typeNode, n.replace(/\[\]$/, ''));
      if (/\[\]$/.test(n) && !el(target, 'array').length) target.appendChild(doc.createElement('array'));
    });
    st.retyped++;
  }

  for (const sd of [...doc.getElementsByTagName('shortdesc')]) {
    const s = sd.textContent, cut = s.replace(/\s*#{2,}\s*TODO\b[\s\S]*$/, '');
    if (cut !== s) { setText(sd, cut.trim()); st.todo++; }
  }
  return st;
}

module.exports = {
  cleanTypeName, splitAcceptReturn, datatypesOf, parentTypes, rangeOf, repairNewExport,
  APPLESCRIPT_LANGUAGE, GLOBAL_APP
};
