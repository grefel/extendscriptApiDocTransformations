/* Erkennt, was in einer Adobe-OMV-XML steckt: Produkt, Jahr und Version,
   abgelesen am Titel des ersten <map>. Daraus entsteht der Dateiname in
   sourceXML/ (npm run intake), und build.js prüft damit, ob die Datei zu dem
   Platz in products.js passt.

   Das Attribut name taugt nicht als Version: id_25-server trug name="20.4"
   bei Build 20.5.0.49, id_24 name="19.0" bei 19.2.0.46. Verlässlich ist nur
   der Titel. Nur InDesign nennt eine Buildnummer; Illustrator hat nur die
   Hauptversion („Illustrator 29"), Photoshop „CC 2015.5", Bridge das Jahr. */
'use strict';

const fs = require('fs');

/* Die Reihenfolge zählt: Server vor dem Desktop-InDesign, sonst fängt das
   allgemeinere Muster den Server ab. product ist der slug aus products.js. */
const RULES = [
  [/^Adobe InDesign (?:CC )?Server (?:CC )?(\d{4}) \(([\d.]+)\) Object Model$/,
    m => ({ product: 'indesign-server', year: m[1], version: m[2] })],
  [/^Adobe InDesign (?:CC )?(\d{4}) \(([\d.]+)\) Object Model$/,
    m => ({ product: 'indesign', year: m[1], version: m[2] })],
  [/^Adobe Illustrator (\d+) Type Library$/,
    m => ({ product: 'illustrator', year: null, version: m[1] })],
  [/^Adobe Photoshop (?:CC )?(\d{4}(?:\.\d+)?) Object Library$/,
    m => ({ product: 'photoshop', year: m[1].slice(0, 4), version: m[1] })],
  [/^Adobe Bridge (\d{4})(?: Object Model)?$/,
    m => ({ product: 'bridge', year: m[1], version: m[1] })],
  /* Neuerer Export; Adobe schreibt dort „Adobe Adobe Media Encoder 2027". */
  [/^Adobe (?:Adobe )?Media Encoder (\d{4})$/,
    m => ({ product: 'media-encoder', year: m[1], version: m[1] })],
  /* Die beiden gemeinsamen Bibliotheken tragen keine Version. */
  [/^Core JavaScript Classes$/, () => ({ product: 'javascript', year: null, version: null })],
  [/^ScriptUI Classes$/, () => ({ product: 'scriptui', year: null, version: null })]
];

/* Der Titel steht in den ersten Zeilen; 64 KB reichen weit. Ein BOM oder eine
   XML-Deklaration davor stört den regulären Ausdruck nicht. Adobes neuerer
   Export (Bridge 2027, Media Encoder) hat kein title am <map>; dort trägt
   der erste <topicref> den Namen („Adobe Bridge 2027"). */
function titleOf(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(65536);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    const head = buf.toString('utf8', 0, n);
    const m = /<map\b[^>]*\btitle="([^"]*)"/.exec(head) || /<topicref\b[^>]*\bnavtitle="([^"]*)"/.exec(head);
    return m ? m[1].replace(/\s+/g, ' ').trim() : null;
  } finally {
    fs.closeSync(fd);
  }
}

/* { title, product, year, version, name } — oder product: null, wenn der
   Titel unbekannt ist. name ist der Dateiname, unter dem die XML in
   sourceXML/ liegen soll. */
function describe(file) {
  const title = titleOf(file);
  for (const [re, f] of RULES) {
    const m = re.exec(title || '');
    if (m) {
      const d = Object.assign({ title }, f(m));
      d.name = d.product + (d.version ? '-' + d.version : '') + '.xml';
      return d;
    }
  }
  return { title, product: null, year: null, version: null, name: null };
}

/* Versionsvergleich für "21.5.1.73" gegen "20.0.0.95"; fehlende Stellen
   zählen als 0. Negativ, wenn a älter ist. */
function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/* Bringt die Einträge aus products.js in eine Form: jedes Produkt bekommt
   versions[] (neueste zuerst), jede Version { key, src, file, info }.
   Ein einfaches src steht für eine einzige Version.

   Bricht ab (Rückgabe errors), wenn eine Datei fehlt, nicht zum Produkt passt,
   ein key doppelt vorkommt oder die Reihenfolge nicht absteigt — jeder dieser
   Fehler würde sonst eine falsche Version als neueste veröffentlichen.
   Ein key, der nicht zum Titel passt, ist nur eine Warnung: Ein geänderter
   Titelaufbau bei Adobe soll den Release-Tag nicht aufhalten. */
function resolveProducts(products, root) {
  const path = require('path');
  const errors = [], warnings = [];
  const list = products.map(p => {
    const raw = p.versions || [{ src: p.src }];
    const versions = raw.map(v => {
      const file = path.resolve(root, v.src);
      if (!fs.existsSync(file)) { errors.push(p.slug + ': fehlt ' + v.src); return null; }
      const info = describe(file);
      if (info.product !== p.slug)
        errors.push(p.slug + ': ' + v.src + ' ist ' +
          (info.product ? '„' + info.title + '“ (' + info.product + ')' : 'unbekannt („' + info.title + '“)'));
      const key = v.key || (raw.length === 1 ? info.year || info.version : null);
      if (!key) errors.push(p.slug + ': ' + v.src + ' braucht einen key');
      else if (info.product && key !== info.year && key !== info.version)
        warnings.push(p.slug + ': key "' + key + '" passt nicht zum Titel „' + info.title + '“');
      return { key, src: v.src, file, info };
    }).filter(Boolean);

    const keys = versions.map(v => v.key);
    keys.forEach((k, i) => { if (k && keys.indexOf(k) !== i) errors.push(p.slug + ': key "' + k + '" doppelt'); });
    for (let i = 1; i < versions.length; i++) {
      const a = versions[i - 1].info.version, b = versions[i].info.version;
      if (a && b && compareVersions(a, b) <= 0)
        errors.push(p.slug + ': versions muss absteigen, ' + a + ' steht vor ' + b);
    }
    let descFrom = null;
    if (p.descFrom) {
      descFrom = path.resolve(root, p.descFrom);
      if (!fs.existsSync(descFrom)) errors.push(p.slug + ': fehlt descFrom ' + p.descFrom);
      else if (describe(descFrom).product !== p.slug) errors.push(p.slug + ': descFrom ' + p.descFrom + ' ist kein ' + p.slug);
    }
    return Object.assign({}, p, { versions, src: versions[0] && versions[0].src, descFrom });
  });
  return { products: list, errors, warnings };
}

module.exports = { describe, titleOf, compareVersions, resolveProducts };
