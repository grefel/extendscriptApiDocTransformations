/* Minimaler ZIP-Schreiber. Node bringt keinen mit, und eine Abhaengigkeit nur
   fuers Packen waere zu viel — zlib.deflateRawSync und eine CRC-Tabelle reichen.

   Erzeugt wird das klassische Format (kein Zip64): 32-Bit-Groessen und -Offsets.
   Das genuegt hier mit weitem Abstand, der Inhalt liegt bei rund 30 MB. Wenn die
   Website je ueber 4 GB oder 65.535 Dateien waechst, bricht createZip ab, statt
   ein stilles Falschergebnis zu liefern. */
'use strict';

const zlib = require('zlib');

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/* MS-DOS-Zeitstempel; Sekunden nur in Zweierschritten, so ist das Format. */
function dosTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  };
}

const MAX = 0xffffffff;

/* files: [{ name: "indesign/Rectangle.html", data: Buffer }]
   Rueckgabe: ein Buffer mit dem fertigen Archiv. */
function createZip(files, when) {
  const stamp = dosTime(when || new Date());
  const parts = [];
  const central = [];
  let offset = 0;

  if (files.length > 0xffff)
    throw new Error('mehr als 65.535 Dateien — dafuer braeuchte es Zip64');

  for (const f of files) {
    const name = Buffer.from(f.name.split('\\').join('/'), 'utf8');
    const raw = f.data;
    const packed = zlib.deflateRawSync(raw, { level: 9 });
    /* Wenn Packen nichts bringt, unkomprimiert ablegen (Methode 0). */
    const deflated = packed.length < raw.length;
    const body = deflated ? packed : raw;
    const crc = crc32(raw);

    if (raw.length > MAX || body.length > MAX || offset > MAX)
      throw new Error('ueber 4 GB — dafuer braeuchte es Zip64');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);            /* Version, die zum Entpacken reicht */
    local.writeUInt16LE(0x800, 6);         /* Bit 11: Dateiname ist UTF-8 */
    local.writeUInt16LE(deflated ? 8 : 0, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, body);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);              /* erzeugt von */
    dir.writeUInt16LE(20, 6);              /* benoetigt */
    dir.writeUInt16LE(0x800, 8);
    dir.writeUInt16LE(deflated ? 8 : 0, 10);
    dir.writeUInt16LE(stamp.time, 12);
    dir.writeUInt16LE(stamp.date, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(body.length, 20);
    dir.writeUInt32LE(raw.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(0, 38);              /* externe Attribute */
    dir.writeUInt32LE(offset, 42);
    central.push(dir, name);

    offset += local.length + name.length + body.length;
  }

  const dirBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dirBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...parts, dirBuf, end]);
}

module.exports = { createZip, crc32 };
