/* Prüft, ob die Parameterspalten innerhalb einer Methode wirklich fluchten.
   Misst die linken Kanten der drei Spalten je Methode und meldet Abweichungen. */
const { execSync } = require('child_process');
const G = execSync('npm root -g').toString().trim().split('\\').join('/');
const { chromium } = require(G + '/playwright');
const PAGE = 'file:///C:/Users/hp/git-px/extendscriptApiDocTransformations/design/concept-b-console.html';

/* Klassen mit vielen und teils sehr breiten Parametertypen */
const CLASSES = ['Document', 'Rectangle', 'Story', 'Application', 'Table', 'AnimationSetting'];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  let bad = 0, checked = 0, worst = 0, worstWhere = '';

  for (const cls of CLASSES) {
    await page.goto(PAGE + '#' + cls);
    await page.waitForSelector('.sechead');

    const report = await page.evaluate(() => {
      const out = [];
      for (const args of document.querySelectorAll('.args')) {
        const rows = [...args.children];
        // display:contents -> Kinder sind die Grid-Items, je 3 pro Parameter
        const cells = rows.flatMap(r => [...r.children]);
        if (cells.length < 6) continue;                    // <2 Parameter: nichts zu fluchten
        const cols = [[], [], []];
        cells.forEach((c, i) => cols[i % 3].push(Math.round(c.getBoundingClientRect().left)));
        const method = args.closest('.mem')?.id.replace('m-', '') || '?';
        const spread = cols.map(xs => Math.max(...xs) - Math.min(...xs));
        out.push({ method, spread, params: cols[0].length });
      }
      return out;
    });

    for (const r of report) {
      checked++;
      const max = Math.max(...r.spread);
      if (max > worst) { worst = max; worstWhere = cls + '.' + r.method; }
      if (max > 1) { bad++; if (bad <= 8) console.log('  MISALIGNED ' + cls + '.' + r.method +
        '  spread px per column: ' + r.spread.join(' / ') + '  (' + r.params + ' params)'); }
    }
  }

  /* Kopfzeile: liegen die Textgrundlinien der Elemente auf einer Linie?
     Gemessen wird ueber eine eingefuegte Inline-Sonde, nicht ueber die Box. */
  await page.goto(PAGE + '#Rectangle');
  await page.waitForSelector('.sechead');
  const base = await page.evaluate(() => {
    const probe = el => {
      const s = document.createElement('span');
      s.textContent = 'X'; s.style.cssText = 'display:inline-block;width:0;overflow:hidden';
      el.appendChild(s);
      const b = s.getBoundingClientRect().bottom;
      s.remove();
      return b;
    };
    const targets = [['logo', '.top .logo'], ['switch', '.rt button.on'],
                     ['version', '.apiver'], ['search', '.kbtn span'], ['theme', '.tg']];
    return targets.map(([n, sel]) => {
      const el = document.querySelector(sel);
      return { n, y: el ? Math.round(probe(el) * 10) / 10 : null };
    }).filter(x => x.y !== null);
  });
  const ys = base.map(b => b.y);
  const spread = Math.round((Math.max(...ys) - Math.min(...ys)) * 10) / 10;
  console.log('\n=== HEADER BASELINES ===');
  base.forEach(b => console.log('  ' + b.n.padEnd(10) + b.y + 'px'));
  console.log('  spread: ' + spread + 'px' + (spread <= 1 ? '  ok' : '   <-- MISALIGNED'));

  /* zusaetzlich: sitzt die Gruppe mittig in der Leiste und laeuft nichts ueber? */
  const box = await page.evaluate(() => {
    const t = document.querySelector('.top').getBoundingClientRect();
    const kids = [...document.querySelectorAll('.top>*')].map(e => e.getBoundingClientRect());
    return { h: t.height, top: Math.min(...kids.map(k => k.top)) - t.top,
             bot: t.bottom - Math.max(...kids.map(k => k.bottom)) };
  });
  const off = Math.round((box.top - box.bot) * 10) / 10;
  console.log('  gap above/below: ' + box.top.toFixed(1) + ' / ' + box.bot.toFixed(1) +
    'px  -> ' + (Math.abs(off) <= 2 ? 'centred' : 'OFF-CENTRE by ' + off + 'px'));
  if (Math.abs(off) > 2 || spread > 1) bad++;

  console.log('\nmethods with >=2 parameters checked: ' + checked);
  console.log('misaligned: ' + bad);
  console.log('worst column spread: ' + worst + 'px' + (worstWhere ? '  at ' + worstWhere : ''));
  console.log(bad === 0 ? '\nall parameter columns line up' : '\nALIGNMENT PROBLEM');
  await browser.close();
})();
