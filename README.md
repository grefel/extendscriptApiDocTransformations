# Adobe ExtendScript API documentation

Generates a readable, searchable reference for the Adobe ExtendScript object models
from Adobe's own OMV exports. Published at
<https://www.indesignjs.de/indesignapi/>.

Covered: InDesign, InDesign Server, Illustrator, Photoshop and Bridge, plus ScriptUI
and the core JavaScript classes — the latter two shared by every application and
therefore documented once.

## Build

```sh
npm install
npm run build      # sourceXML/*.xml → site/          2,681 pages, ~7 s
npm run serve      # http://localhost:8080
npm run check      # browser test suite (needs Playwright)
```

One runtime dependency: [`@xmldom/xmldom`](https://www.npmjs.com/package/@xmldom/xmldom)
(no transitive dependencies). No Java, no XSLT processor, no DITA-OT, no oXygen.
**The generated site itself has no dependencies at all** — no framework, no CDN, no
build step in the browser, and every page is complete without JavaScript.

`build/products.js` lists the applications and their source XML.
Details in [build/README.md](build/README.md).

## Source files

Put Adobe's OMV exports into `sourceXML/`. They are not redistributed here.

On macOS:

  - `/Library/Application Support/Adobe/Scripting Dictionaries CC/CommonFiles`
  - `~/Library/Preferences/ExtendScript Toolkit/4.0/omv$indesign-9.064$9.0.xml`

On Windows:

  - `\Users\[Username]\AppData\Roaming\Adobe\ExtendScript Toolkit\4.0\omv$indesign-10.064$10.0.xml`
  - `C:\Program Files (x86)\Common Files\Adobe\Scripting Dictionaries CC\CommonFiles\`

## For editors and AI agents

Every target ships more than the pages:

- `<target>/<target>.d.ts` — self-contained TypeScript declarations with Adobe’s
  descriptions as JSDoc. Compile with `"lib": ["es5"]` and without `dom`.
  `npm run check:types` translates every one of them with the real compiler.
- `<target>/<Object>.md` — a Markdown twin of each page at the same path, for
  agents that fetch rather than browse. Roughly a third of the tokens.
- `<target>/api.json` — the whole model as JSON.
- `llms.txt` at the root and per target — the entry point that names all of it.

## Sublime Text code completions

Separate output, still on the XSLT route: transform a merged and fixed DOM file with
`dom2sublimeCodeCompletion.xsl` and drop the resulting `jsx.sublime-completions` into
your Sublime Text `Packages` folder.

## Verifying the port

The pipeline used to be `mergeFiles.xslt` → `fixDom.xsl` → `dom2dita.xsl` → DITA-OT.
The first two are ported to `build/fixdom.js`; `npm run verify` holds the port against
the original XSLT chain and reports zero real differences. That comparison needs Java
and Saxon and is the only thing `mergeFiles.xslt` and `fixDom.xsl` are still kept for:

```sh
npm run verify:prepare   # temp/fixedDOM-<slug>.xml via Saxon
npm run verify
```

## License

<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png" /></a><br /><span xmlns:dct="http://purl.org/dc/terms/" property="dct:title">extendscriptApiDocTransformations
</span> by <a xmlns:cc="http://creativecommons.org/ns#" href="https://www.publishingx.de/" property="cc:attributionName" rel="cc:attributionURL">Gregor Fellenz</a> is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>.<br />Based on a work at <a xmlns:dct="http://purl.org/dc/terms/" href="https://www.adobe.com/" rel="dct:source">https://www.adobe.com/</a>.

The copyright of the original object model files and the trademarks InDesign,
Photoshop, Illustrator, ExtendScript and ScriptUI are held by
[Adobe Inc.](https://www.adobe.com/) The descriptive texts are Adobe's;
transformation errors are ours.

## Acknowledgements

This project is based on the fantastic ExtendScript API HTML by
[Theunis de Jong](https://web.archive.org/web/20170106130344/http://www.jongware.com/idjshelp.html)
a.k.a. **Jongware** († 2020). Without his efforts and inspiration I would not have
realized it. Thank you!
