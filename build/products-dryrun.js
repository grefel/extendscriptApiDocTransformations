/* Probelauf für einen Versionswechsel, ohne etwas zu veröffentlichen:
   InDesign 2025 (20.0.0.95, aus sourceXML/archive/) steht als Vorversion
   hinter 2026 — so wie beim Release 2026 hinter 2027 stehen wird.
   Alle anderen Produkte wie in build/products.js.

     PRODUCTS=build/products-dryrun.js OUT_DIR=<scratch>/site npm run build

   build.js verlangt dabei OUT_DIR und packt kein site.zip. */
'use strict';

module.exports = require('./products').map(p => p.slug !== 'indesign' ? p :
  Object.assign({}, p, {
    versions: [
      ...p.versions,
      { key: '2025', src: 'sourceXML/archive/id_25.xml' }
    ]
  }));
