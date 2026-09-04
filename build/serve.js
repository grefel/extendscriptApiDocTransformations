/* Winziger Server zum Anschauen der gebauten Website.
   Nur fuer die Entwicklung — die Website selbst ist statisch und braucht ihn nicht.
   Bewusst ohne Abhaengigkeit: node:http und node:fs reichen. */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = process.env.OUT_DIR || path.join(ROOT, 'site');
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

if (!fs.existsSync(path.join(SITE, 'index.html'))) {
  console.error('Keine Website unter ' + SITE + ' — erst "npm run build".');
  process.exit(2);
}

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  /* Pfad einsperren, damit kein ../ aus dem Ausgabeordner herausfuehrt. */
  const file = path.join(SITE, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!file.startsWith(SITE)) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found: ' + rel); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, () => console.log('http://localhost:' + PORT + '  (' + path.relative(ROOT, SITE) + ')'));
