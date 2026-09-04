/* Kontrast- und Zustandsaudit für Konzept B in beiden Themes. */
const { execSync } = require('child_process');
const G = execSync('npm root -g').toString().trim().split('\\').join('/');
const { chromium } = require(G + '/playwright');
const PAGE = 'file:///C:/Users/hp/git-px/extendscriptApiDocTransformations/design/concept-b-console.html';

const lum = ([r, g, b]) => {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05); };
const rgb = s => (s.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number);

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(PAGE + '#Rectangle');
    await page.waitForSelector('.sechead');
    if (theme === 'light') { await page.click('#tbtn'); await page.waitForTimeout(150); }

    const samples = await page.evaluate(() => {
      const pick = (sel, label) => {
        const el = document.querySelector(sel); if (!el) return null;
        const cs = getComputedStyle(el);
        // effektiven Hintergrund suchen, transparente Eltern überspringen
        let bgEl = el, bg = cs.backgroundColor;
        while (bgEl && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) {
          bgEl = bgEl.parentElement; if (!bgEl) break; bg = getComputedStyle(bgEl).backgroundColor;
        }
        return { label, fg: cs.color, bg: bg || 'rgb(255,255,255)', size: cs.fontSize };
      };
      return [
        pick('.side a:not(.on)', 'sidebar class name'),
        pick('.side a i', 'sidebar member count'),
        pick('.doc .lede', 'class description'),
        pick('td.d', 'property description'),
        pick('td.n', 'property name'),
        pick('td.a.ro', 'access: readonly'),
        pick('td.a.rw', 'access: read/write'),
        pick('.vals code', 'enum value chip'),
        pick('.mem .desc', 'method description'),
        pick('.arg .at', 'parameter type'),
        pick('.rail2 .kv', 'right rail stats'),
        pick('.rail2 a', 'right rail links'),
        pick('footer', 'footer text'),
        pick('.chain', 'inheritance chain'),
      ].filter(Boolean);
    });

    console.log('\n=== ' + theme.toUpperCase() + ' ===');
    for (const s of samples) {
      const r = ratio(rgb(s.fg), rgb(s.bg));
      const px = parseFloat(s.size);
      const need = px >= 18.66 ? 3 : 4.5;              // WCAG AA
      const flag = r < need ? (r < 3 ? '  <-- FAIL' : '  <-- low') : '';
      console.log('  ' + s.label.padEnd(24) + r.toFixed(2).padStart(5) + ':1  ' + px + 'px' + flag);
    }
    await page.close();
  }

  /* Zustand: überlebt der Umschalter einen Reload? */
  const p = await browser.newPage();
  await p.goto(PAGE + '#Pages');
  await p.waitForSelector('.sechead');
  await p.click('#rt button[data-r="uxp"]');
  await p.waitForTimeout(120);
  const before = await p.locator('.mem').count();
  await p.reload();
  await p.waitForSelector('.sechead');
  const after = await p.locator('.mem').count();
  const url = p.url();
  console.log('\n=== STATE ===');
  console.log('  Pages methods in UXP before reload: ' + before);
  console.log('  after reload:                       ' + after + (before === after ? '' : '   <-- runtime lost'));
  console.log('  URL carries runtime?                ' + (url.includes('uxp') ? 'yes' : 'no  <-- not shareable'));

  await browser.close();
})();
