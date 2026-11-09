/* Live-Test: prüft die Verhaltensangaben aus notes.js, additions.js,
   runtime.js und examples.js am laufenden InDesign, in beiden Laufzeiten.

     node build/live/run.js [--version 2026] [--only id,id] [--write]
                            [--timeout 30000] [--keep] [--no-dismiss]

   Die Fälle stehen in cases.js, die Bedienung in README.md. Hier steht nur
   die Mechanik: COM über PowerShell (host.ps1), die Hüllen um jeden Fall
   und die Auswertung.

   Gemessen beim Bauen (InDesign 2026 21.6.0.57 und 2025 20.5.5.119), und
   davon hängt die Form der Hüllen ab:
   - UXP liefert über DoScript nur, was script.setResult() übergibt — einmal
     je Skript, der zweite Aufruf wirft.
   - Gibt ein UXP-Skript auf oberster Ebene ein Promise (eine .then-Kette)
     mit return zurück, wartet DoScript darauf, das DOM bleibt in den
     Fortsetzungen erreichbar, und ein setResult() daraus kommt an.
   - Ohne dieses return ist nach dem Skriptrumpf das DOM weg
     (app.documents undefined, close() wirkungslos), setTimeout- und
     Event-Rückrufe kommen nicht mehr an, und DoScript liefert nichts aus
     späteren Fortsetzungen.
   - Mit async-Funktionen ist es uneinheitlich: return main() mit einer
     async function main kehrte sofort und leer zurück, und ein Skript, in
     dem das Wort async auch nur im Kommentar steht, verlor ein synchrones
     setResult(). Fälle dürfen async benutzen — die Hülle hängt sich mit
     einer .then-Kette dahinter und schreibt das Ergebnis in eine Datei.
   - Ein zurückgegebenes Promise, das nie fertig wird, sperrt das Skripting
     von InDesign: DoScript hängt, jeder weitere COM-Aufruf auch — einmal
     etwa drei Minuten, einmal über zehn. Deshalb das Zeitlimit in uxpWrap.
   - Event-Handler feuern unter UXP nicht synchron im auslösenden Aufruf,
     sondern danach.
   - Ein nicht abgefangener Fehler unter UXP öffnet einen modalen Dialog
     („UXPScript Fehler!“). Synchron blockiert er DoScript, bis jemand OK
     klickt; asynchron blockiert er jeden späteren Zugriff aufs DOM („modales
     Dialogfeld aktiv“). Die Hüllen fangen deshalb alles ab; was trotzdem
     durchrutscht, fotografiert run.js und schließt es (--no-dismiss: nicht).
   - ExtendScript-Fehler kommen über COM ohne Dialog, aber ohne Text
     zurück. Auch hier fängt die Hülle ab und liefert die Meldung selbst. */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
let cases = require('./cases');

const ES = 1246973031;   // ScriptLanguage.JAVASCRIPT
const UXP = 1431522407;  // ScriptLanguage.UXPSCRIPT
const UXP_MIN = '18.5';  // UXP-Skripte gibt es ab InDesign 18.5

/* ---------- Argumente ---------- */

function parseArgs(argv) {
  const o = { version: '2026', only: null, write: false, timeout: 30000, keep: false, dismiss: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--version') o.version = argv[++i];
    else if (a === '--only') o.only = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--write') o.write = true;
    else if (a === '--timeout') o.timeout = Number(argv[++i]);
    else if (a === '--keep') o.keep = true;
    else if (a === '--no-dismiss') o.dismiss = false;
    else if (a === '--cases') o.cases = path.resolve(argv[++i]);
    else throw new Error('unbekanntes Argument: ' + a);
  }
  return o;
}

/* ---------- Versionen ---------- */

function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}
const isVersion = s => /^\d+(\.\d+)*$/.test(s);

/* ---------- Hüllen ---------- */

const jsStr = s => JSON.stringify(s);

/* ExtendScript kennt kein JSON. Die Hülle serialisiert selbst, alles außerhalb
   von ASCII als \uXXXX — so kommt der Text unbeschadet durch COM.

   Die Hülle steht auf oberster Ebene, nicht in einer Funktion: Ein per
   doScript() aufgerufenes ExtendScript läuft im Gültigkeitsbereich des
   Aufrufers und sieht dessen arguments — die withArguments nur, wenn der
   Aufruf auf oberster Ebene steht (gemessen in 21.6). Fälle mit
   esTopLevel: true stehen deshalb ohne Funktion da und setzen result.
   Globale Namen bleiben nicht hängen: jeder DoScript-Aufruf über COM
   beginnt mit leerem Global-Objekt. */
function esWrap(body, work, top) {
  const run = top
    ? `  var result;\n${body}\n  __r = { ok: true, value: result };`
    : `  __r = { ok: true, value: (function () {\n${body}\n  })() };`;
  return `var WORK = ${jsStr(work)};
var __made = [], __uil = app.scriptPreferences.userInteractionLevel, __r;
function scratch() { var d = app.documents.add(false); __made.push(d); return d; }
function track(o) { __made.push(o); return o; }
function na(why) { throw { __na: String(why) }; }
function __str(s) {
  return '"' + String(s).replace(/[\\\\"\\u0000-\\u001f\\u007f-\\uffff]/g, function (c) {
    if (c == '"') return '\\\\"';
    if (c == '\\\\') return '\\\\\\\\';
    var h = c.charCodeAt(0).toString(16); while (h.length < 4) h = '0' + h;
    return '\\\\u' + h;
  }) + '"';
}
function __json(v) {
  if (v === null || v === undefined) return 'null';
  var t = typeof v, a = [], k;
  if (t == 'number') return isFinite(v) ? String(v) : 'null';
  if (t == 'boolean') return String(v);
  if (t == 'string') return __str(v);
  if (v instanceof Array) { for (k = 0; k < v.length; k++) a.push(__json(v[k])); return '[' + a.join(',') + ']'; }
  if (t == 'object' && v.constructor === Object) {
    for (k in v) if (v.hasOwnProperty(k)) a.push(__str(k) + ':' + __json(v[k]));
    return '{' + a.join(',') + '}';
  }
  return __str(String(v));
}
try {
  app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
${run}
} catch (e) {
  __r = e && e.__na !== undefined ? { na: e.__na }
    : { ok: false, error: String(e && e.message !== undefined ? e.message : e), line: e && e.line };
} finally {
  for (var __i = __made.length - 1; __i >= 0; __i--) {
    try { if (__made[__i].isValid) { try { __made[__i].close(SaveOptions.NO); } catch (e1) { __made[__i].close(); } } } catch (e2) {}
  }
  app.scriptPreferences.userInteractionLevel = __uil;
}
__json(__r);`;
}

/* UXP-Hülle. Sie gibt ihr Promise mit return zurück, damit das DOM in den
   Fortsetzungen erreichbar bleibt (Aufräumen!), und lässt jedes Promise des
   Falls gegen einen Zeitgeber laufen, der vor dem Zeitlimit von run.js
   abläuft — ein nie fertiges Promise sperrte sonst InDesign. Das Ergebnis
   kommt über eine Datei, nicht über setResult(): das funktioniert auch,
   wenn der Fall async benutzt. Siehe Kopfkommentar. */
function uxpWrap(body, work, out, limit) {
  return `const __fs = require("fs");
const __id = require("indesign");
const WORK = ${jsStr(work)};
const __made = [];
let __uil = null, __sent = false, __p, __timer = null;
function scratch() { const d = __id.app.documents.add(false); __made.push(d); return d; }
function track(o) { __made.push(o); return o; }
function na(why) { throw { __na: String(why) }; }
function __ascii(s) { return s.replace(/[\\u007f-\\uffff]/g, c => "\\\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")); }
function __err(e) {
  if (e && e.__na !== undefined) return { na: e.__na };
  return { ok: false, error: String(e && e.message !== undefined ? e.message : e), stack: e && e.stack ? String(e.stack).split("\\n").slice(0, 3).join(" | ") : undefined };
}
function __finish(r) {
  if (__sent) return; __sent = true;
  if (__timer !== null) clearTimeout(__timer);
  for (let i = __made.length - 1; i >= 0; i--) {
    try { if (__made[i].isValid) { try { __made[i].close(__id.SaveOptions.NO); } catch (e1) { __made[i].close(); } } } catch (e2) {}
  }
  try { if (__uil !== null) __id.app.scriptPreferences.userInteractionLevel = __uil; } catch (e3) {}
  let s;
  try { s = JSON.stringify(r); } catch (e4) { s = JSON.stringify({ ok: false, error: "result not serializable: " + e4 }); }
  try { __fs.writeFileSync(${jsStr(out)}, __ascii(s)); } catch (e5) {}
}
try {
  __uil = __id.app.scriptPreferences.userInteractionLevel;
  __id.app.scriptPreferences.userInteractionLevel = __id.UserInteractionLevels.NEVER_INTERACT;
  const __v = (function () {
${body}
  })();
  if (__v && typeof __v.then === "function") {
    const __limit = new Promise((_, no) => { __timer = setTimeout(() => no(new Error("UXP: Promise nach ${limit} ms nicht erfüllt")), ${limit}); });
    __p = Promise.race([__v, __limit]).then(v => __finish({ ok: true, value: v }), e => __finish(__err(e)));
  }
  else __finish({ ok: true, value: __v });
} catch (e) {
  __finish(__err(e));
}
return __p;
`;
}

/* ---------- PowerShell-Host ---------- */

const HOST = path.join(__dirname, 'host.ps1');

class Host {
  constructor(progId) { this.progId = progId; this.proc = null; this.buf = ''; this.waiters = []; this.lines = []; }

  start() {
    this.proc = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', HOST,
      '-ProgId', this.progId], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    this.buf = ''; this.lines = []; this.waiters = [];
    this.stderr = '';
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', d => {
      this.buf += d;
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).replace(/\r$/, '');
        this.buf = this.buf.slice(i + 1);
        this.lines.push(line);
        this.pump();
      }
    });
    this.proc.stderr.setEncoding('utf8');
    this.proc.stderr.on('data', d => { this.stderr += d; });
    this.proc.on('exit', () => { this.dead = true; this.pump(); });
    this.dead = false;
    return this.expect(l => l === 'READY', 60000);
  }

  pump() {
    for (const w of this.waiters.slice()) {
      const k = this.lines.findIndex(w.match);
      if (k >= 0) {
        const [line] = this.lines.splice(k, 1);
        this.waiters.splice(this.waiters.indexOf(w), 1);
        clearTimeout(w.timer); w.resolve(line);
      } else if (this.dead) {
        this.waiters.splice(this.waiters.indexOf(w), 1);
        clearTimeout(w.timer); w.reject(new Error('PowerShell-Host beendet. ' + this.stderr.trim()));
      }
    }
  }

  /* Wartet auf eine Zeile; null nach Ablauf der Zeit. */
  expect(match, ms) {
    return new Promise((resolve, reject) => {
      const w = { match, resolve, reject };
      w.timer = setTimeout(() => {
        this.waiters.splice(this.waiters.indexOf(w), 1);
        resolve(null);
      }, ms);
      this.waiters.push(w);
      this.pump();
    });
  }

  send(...fields) { this.proc.stdin.write(fields.join('\t') + '\n'); }

  kill() {
    if (this.proc && !this.dead) spawnSync('taskkill', ['/PID', String(this.proc.pid), '/T', '/F'], { windowsHide: true });
    this.dead = true;
  }
}

/* ---------- Läufer ---------- */

class Runner {
  constructor(opt) {
    this.opt = opt;
    this.progId = /^\d{4}$/.test(opt.version) ? 'InDesign.Application.' + opt.version : 'InDesign.Application';
    this.root = fs.mkdtempSync(path.join(os.tmpdir(), 'idlive-'));
    this.work = path.join(this.root, 'work').replace(/\\/g, '/');
    this.shots = path.join(this.root, 'dialogs');
    fs.mkdirSync(this.work); fs.mkdirSync(this.shots);
    for (const [name, data] of Object.entries(cases.FIXTURES || {}))
      fs.writeFileSync(path.join(this.work, name), data);
    this.seq = 0;
    this.baseDialogs = new Set();
    this.notes = [];
  }

  async startHost() {
    this.host = new Host(this.progId);
    const ok = await this.host.start();
    if (!ok) throw new Error('PowerShell-Host meldet sich nicht (' + this.progId + ').');
    if (this.pid) { this.host.send('PID', this.pid); await this.host.expect(l => l === 'OK', 10000); }
  }

  /* Ein Aufruf von DoScript. Liefert die Hülle als Objekt:
     { ok, value } | { ok:false, error } | { na } | { timeout } */
  async call(lang, source, timeout, top) {
    const id = String(++this.seq);
    const src = path.join(this.root, 'case-' + id + (lang === UXP ? '.idjs' : '.jsx'));
    const out = path.join(this.root, 'out-' + id + '.json');
    const uxpOut = path.join(this.root, 'uxp-' + id + '.json').replace(/\\/g, '/');
    fs.writeFileSync(src, lang === UXP ? uxpWrap(source, this.work, uxpOut, Math.max(1000, timeout - 5000)) : esWrap(source, this.work, top));
    const t0 = Date.now();
    this.host.send('RUN', id, lang, src, out);
    let line = await this.host.expect(l => l.startsWith('DONE\t' + id + '\t'), timeout);
    let res;
    if (line === null) {
      /* DoScript hängt. Meist an einem modalen Dialog: den schließen, dann
         kehrt DoScript mit Fehler zurück. Ein Skript, das schlicht nicht
         endet, lässt sich von außen nicht abbrechen — dann bleibt nur, den
         Host zu beenden; InDesign rechnet weiter. */
      const closed = await this.dismissNew();
      line = await this.host.expect(l => l.startsWith('DONE\t' + id + '\t'), 10000);
      if (line === null) {
        this.host.kill();
        await this.startHost();
        return { timeout: true, error: 'Zeitlimit ' + timeout + ' ms überschritten, Host neu gestartet' +
          (closed.length ? '; Dialog geschlossen: ' + closed.join(', ') : '') };
      }
      res = { ok: false, error: 'blockiert durch modalen Dialog' + (closed.length ? ' (geschlossen: ' + closed.join(', ') + ')' : '') };
      return res;
    }
    const raw = JSON.parse(fs.readFileSync(out, 'utf8').replace(/^﻿/, ''));
    if (!raw.ok) res = { ok: false, error: 'DoScript: ' + raw.error };
    else if (lang === ES) {
      try { res = JSON.parse(raw.value); } catch (e) { res = { ok: false, error: 'keine JSON-Antwort: ' + raw.value }; }
    } else {
      /* UXP: Ergebnisdatei abwarten — bei asynchronen Fällen kommt sie nach
         DoScript. */
      while (!fs.existsSync(uxpOut) && Date.now() - t0 < timeout) await new Promise(r => setTimeout(r, 100));
      if (!fs.existsSync(uxpOut)) res = { timeout: true, error: 'keine Ergebnisdatei nach ' + timeout + ' ms' };
      else {
        await new Promise(r => setTimeout(r, 50));
        try { res = JSON.parse(fs.readFileSync(uxpOut, 'utf8')); } catch (e) { res = { ok: false, error: 'Ergebnisdatei unlesbar: ' + e.message }; }
      }
    }
    /* Neue Dialoge nach dem Fall: bei asynchronen Fehlern erscheinen sie erst
       nach DoScript, deshalb bei UXP noch einmal nachfragen. */
    const closed = await this.dismissNew(lang === UXP ? await this.dialogs() : line.split('\t')[2].split(',').filter(Boolean));
    if (closed.length && !res.timeout) res = { ok: false, error: 'modaler Dialog erschienen und geschlossen (' + closed.join(', ') + ')', was: res };
    return res;
  }

  async dialogs() {
    if (!this.pid) return [];
    const id = String(++this.seq);
    this.host.send('DIALOGS', id);
    const l = await this.host.expect(x => x.startsWith('DIALOGS\t' + id + '\t'), 5000);
    return l === null ? [] : l.split('\t')[2].split(',').filter(Boolean);
  }

  /* Schließt Dialoge, die beim Start nicht da waren. list kommt vom Host;
     ohne list (Host hängt in DoScript) fragt ein eigener Prozess. */
  async dismissNew(list) {
    if (!this.pid) return [];
    if (!list) list = this.dialogsDirect();
    const fresh = list.filter(h => !this.baseDialogs.has(h));
    if (!fresh.length) return [];
    if (!this.opt.dismiss) return fresh.map(h => h + ' (offen gelassen)');
    spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', HOST, '-Dismiss',
      '-Handles', fresh.join(','), '-ShotDir', this.shots], { encoding: 'utf8', windowsHide: true });
    this.opt.keep = true;  // Screenshots nicht mit dem Arbeitsordner löschen
    return fresh.map(h => 'Foto ' + path.join(this.shots, 'dialog-' + h + '.png'));
  }

  /* Dialogliste ohne den Host, falls der blockiert. */
  dialogsDirect() {
    const ps = `Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices; using System.Collections.Generic;
public class LiveEnum {
  public delegate bool P(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(P f, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  public static string D(uint pid) { var r = new List<string>(); EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p);
    if (p == pid && IsWindowVisible(h)) { var sb = new StringBuilder(64); GetClassName(h, sb, 64); if (sb.ToString() == "#32770") r.Add(h.ToInt64().ToString()); } return true; }, IntPtr.Zero); return string.Join(",", r); }
}
"@
[LiveEnum]::D(${this.pid})`;
    const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', windowsHide: true });
    return (r.stdout || '').trim().split(',').filter(Boolean);
  }

  async info() {
    const r = await this.call(ES, `
      var docs = [], i;
      for (i = 0; i < app.documents.length; i++) docs.push(app.documents[i].id);
      return { version: app.version, name: app.name, folder: app.filePath.fsName, docs: docs };`, 20000);
    if (!r.ok) throw new Error('InDesign antwortet nicht (' + this.progId + '): ' + (r.error || JSON.stringify(r)));
    return r.value;
  }

  findPid(folder) {
    const r = spawnSync('powershell', ['-NoProfile', '-Command',
      'Get-Process InDesign -ErrorAction SilentlyContinue | ForEach-Object { "$($_.Id)`t$($_.Path)" }'],
    { encoding: 'utf8', windowsHide: true });
    const want = folder.toLowerCase().replace(/[\\/]+$/, '') + '\\';
    for (const l of (r.stdout || '').split(/\r?\n/)) {
      const [pid, p] = l.split('\t');
      if (p && p.toLowerCase().startsWith(want)) return Number(pid);
    }
    return 0;
  }

  /* requires: Mindestversionen und Member des Objektmodells. Member werden
     in ExtendScript an einem Beispielobjekt geprüft (SAMPLES in cases.js) —
     über reflect oder, weil reflect manches nicht kennt (itemByName an
     XMLElements), über typeof. */
  async probe(list) {
    const paths = [...new Set(list.flatMap(c => (c.requires || []).filter(r => !isVersion(r))))];
    if (!paths.length) return {};
    const missing = paths.filter(p => !cases.SAMPLES[p.split('.')[0]]);
    const known = paths.filter(p => cases.SAMPLES[p.split('.')[0]]);
    const body = `
      var out = {}, cache = {}, p, cls, mem, o, i, r, hit;
      var want = ${JSON.stringify(known)};
      var samples = ${JSON.stringify(Object.fromEntries(known.map(p => [p.split('.')[0], cases.SAMPLES[p.split('.')[0]]])))};
      for (i = 0; i < want.length; i++) {
        p = want[i]; cls = p.split('.')[0]; mem = p.split('.').slice(1).join('.');
        try {
          if (!(cls in cache)) cache[cls] = eval(samples[cls]);
          o = cache[cls]; hit = false;
          if (!o) { out[p] = 'no sample'; continue; }
          r = o.reflect;
          for (var k = 0; k < r.methods.length && !hit; k++) if (r.methods[k].name == mem) hit = true;
          for (var k2 = 0; k2 < r.properties.length && !hit; k2++) if (r.properties[k2].name == mem) hit = true;
          if (!hit) { try { hit = typeof o[mem] != 'undefined'; } catch (e) { hit = true; } }
          out[p] = hit ? 'yes' : 'no';
        } catch (e) { out[p] = 'error: ' + e.message; }
      }
      return out;`;
    const r = await this.call(ES, body, this.opt.timeout);
    const res = r.ok ? r.value : Object.fromEntries(known.map(p => [p, 'error: ' + (r.error || 'probe')]));
    for (const p of missing) res[p] = 'error: kein Beispielobjekt für ' + p.split('.')[0] + ' in cases.SAMPLES';
    return res;
  }

  /* Räumt auf, was ein Fall trotz finally liegen ließ: unsichtbare Dokumente,
     die beim Start nicht offen waren, und Bücher/Bibliotheken im
     Arbeitsordner. Sichtbare Dokumente fasst das nie an — die könnte der
     Nutzer währenddessen geöffnet haben. */
  async sweep(startDocs) {
    const r = await this.call(ES, `
      var keep = ${JSON.stringify(startDocs)}, n = [], i, d, seen;
      for (i = app.documents.length - 1; i >= 0; i--) {
        d = app.documents[i]; seen = false;
        for (var k = 0; k < keep.length; k++) if (keep[k] == d.id) seen = true;
        if (!seen && d.windows.length == 0) { n.push('document ' + d.name); d.close(SaveOptions.NO); }
      }
      var sets = [app.books, app.libraries];
      for (var s = 0; s < sets.length; s++) for (i = sets[s].length - 1; i >= 0; i--) {
        d = sets[s][i];
        if (String(d.fullName.fsName).replace(/\\\\/g, '/').indexOf(WORK) == 0) { n.push(d.name); try { d.close(SaveOptions.NO); } catch (e) { d.close(); } }
      }
      return n;`, this.opt.timeout);
    return r.ok ? r.value : ['Aufräumen fehlgeschlagen: ' + r.error];
  }
}

/* ---------- Auswertung ---------- */

function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function judge(c, engine, res, ctx) {
  if (res.na !== undefined) return { status: 'n/a', reason: res.na };
  if (!res.ok) return { status: 'ERROR', error: res.error, was: res.was };
  const exp = c.expect && c.expect[engine];
  if (exp === undefined) return { status: 'INFO', value: res.value };
  let ok, why;
  try {
    ok = typeof exp === 'function' ? exp(res.value, ctx) : deepEqual(res.value, exp);
  } catch (e) { ok = false; why = 'expect warf: ' + e.message; }
  if (typeof ok === 'string') { why = ok; ok = false; }
  return ok === true || (ok && typeof ok !== 'string')
    ? { status: 'PASS', value: res.value }
    : { status: 'FAIL', value: res.value, reason: why,
        expected: typeof exp === 'function' ? exp.toString().replace(/\s+/g, ' ') : exp };
}

const short = (v, n = 140) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s && s.length > n ? s.slice(0, n) + '…' : s; };

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  if (opt.cases) cases = require(opt.cases);
  let list = cases.cases;
  if (opt.only) {
    const unknown = opt.only.filter(id => !list.some(c => c.id === id));
    if (unknown.length) throw new Error('unbekannte Fälle: ' + unknown.join(', '));
    list = list.filter(c => opt.only.includes(c.id));
  }
  const ids = new Set();
  for (const c of cases.cases) {
    if (ids.has(c.id)) throw new Error('doppelte id ' + c.id);
    ids.add(c.id);
  }

  const R = new Runner(opt);
  await R.startHost();
  const info = await R.info();
  R.pid = R.findPid(info.folder);
  if (R.pid) {
    R.host.send('PID', R.pid); await R.host.expect(l => l === 'OK', 10000);
    const d = await R.dialogs();
    if (d.length) {
      R.host.kill();
      throw new Error('InDesign ' + info.version + ' zeigt einen Dialog (' + d.join(', ') +
        '). Bitte zuerst schließen.');
    }
  } else {
    R.notes.push('InDesign-Prozess nicht gefunden — Dialoge werden weder erkannt noch geschlossen.');
  }
  const ctx = { version: info.version };
  console.log(`${info.name} ${info.version} (${R.progId}), ${list.length} Fälle\n`);

  const probe = await R.probe(list);
  const rows = [];
  for (const c of list) {
    const row = { id: c.id, title: c.title, claim: c.claim, where: c.where, requires: c.requires || [] };
    const need = (c.requires || []);
    const lacking = need.filter(r => isVersion(r) ? compareVersions(info.version, r) < 0 : probe[r] !== 'yes');
    const probeErr = need.filter(r => !isVersion(r) && /^error|no sample/.test(probe[r] || ''));
    for (const [engine, lang] of [['es', ES], ['uxp', UXP]]) {
      const src = c[engine];
      const t0 = Date.now();
      if (!src) { row[engine] = { status: '—' }; continue; }
      if (probeErr.length) { row[engine] = { status: 'ERROR', error: 'requires: ' + probeErr.map(r => r + ' ' + probe[r]).join('; ') }; continue; }
      if (lacking.length) { row[engine] = { status: 'n/a', reason: 'fehlt: ' + lacking.join(', ') }; continue; }
      if (engine === 'uxp' && compareVersions(info.version, UXP_MIN) < 0) { row[engine] = { status: 'n/a', reason: 'UXP erst ab ' + UXP_MIN }; continue; }
      /* Syntaxfehler vorher abfangen: unter UXP öffnen sie einen modalen
         Dialog, unter ExtendScript kommt über COM keine Meldung. ES3-Eigenheiten
         erkennt Node nicht, grobe Fehler schon. */
      try { new Function(src); } catch (e) { row[engine] = { status: 'ERROR', error: 'Syntaxfehler: ' + e.message }; continue; }
      const res = await R.call(lang, src, c.timeout || opt.timeout, engine === 'es' && c.esTopLevel);
      row[engine] = Object.assign(judge(c, engine, res, ctx), { ms: Date.now() - t0 });
    }
    rows.push(row);
    const mark = s => s.status.padEnd(5);
    console.log(`${c.id.padEnd(34)} ES ${mark(row.es)}  UXP ${mark(row.uxp)}`);
    for (const e of ['es', 'uxp']) {
      const r = row[e];
      if (r.status === 'FAIL') console.log(`    ${e}: erhalten ${short(r.value)}${r.reason ? ' — ' + r.reason : ''}`);
      if (r.status === 'ERROR') console.log(`    ${e}: ${short(r.error, 300)}`);
      if (r.status === 'INFO') console.log(`    ${e}: ${short(r.value)}`);
    }
  }

  const swept = await R.sweep(info.docs);
  if (swept.length) R.notes.push('Liegengeblieben und geschlossen: ' + swept.join(', '));
  R.host.kill();

  const count = s => rows.reduce((n, r) => n + (r.es.status === s) + (r.uxp.status === s), 0);
  const summary = Object.fromEntries(['PASS', 'FAIL', 'ERROR', 'n/a', 'INFO'].map(s => [s, count(s)]));
  console.log('\n' + Object.entries(summary).map(([k, v]) => k + ' ' + v).join(', '));
  for (const n of R.notes) console.log('Hinweis: ' + n);

  if (opt.write) {
    const dir = path.join(__dirname, 'results');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'indesign-' + info.version + '.json');
    const doc = {
      indesign: info.version, name: info.name, progId: R.progId,
      date: new Date().toISOString(), node: process.version,
      partial: !!opt.only, summary, notes: R.notes,
      cases: rows.map(r => ({ id: r.id, title: r.title, where: r.where,
        es: clean(r.es), uxp: clean(r.uxp) }))
    };
    fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
    console.log('geschrieben: ' + path.relative(process.cwd(), file));
  }
  if (!opt.keep) fs.rmSync(R.root, { recursive: true, force: true });
  else console.log('Arbeitsordner: ' + R.root);
  process.exitCode = summary.FAIL || summary.ERROR ? 1 : 0;
}

/* Für die Ergebnisdatei: ohne Laufzeiten, damit ein erneuter Lauf nur dort
   einen Diff erzeugt, wo sich Verhalten geändert hat. */
function clean(r) {
  const o = { status: r.status };
  for (const k of ['value', 'reason', 'error']) if (r[k] !== undefined) o[k] = r[k];
  return o;
}

if (require.main === module) {
  main().catch(e => { console.error('Abbruch: ' + e.message); process.exitCode = 2; });
}

module.exports = { esWrap, uxpWrap, compareVersions };
