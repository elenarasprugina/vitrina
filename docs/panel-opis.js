// Опись панели (п. 40, 19.10): обходит все разделы и вкладки панели, раскрывает группы и первые пункты списков, пишет поля с путём.
// Запуск: python3 -m http.server 8765 (в корне vitrina) и node docs/panel-opis.js raw.json. Без её ключа — по опубликованным data/ (Библиотеки нет).
// Обход панели: все разделы, вкладки, карточки; раскрыть группы и первые пункты списков; записать поля с путём.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = process.argv[2];
const SKIP_BTN = /Посмотреть|телефоне|Ролик|Открыть|Скачать|Загрузить|Проба|⬇|▶|●/;

async function snap(page, where) {
  return page.evaluate((where) => {
    const main = document.getElementById('a-main');
    // раскрыть всё: группы, блоки, первые пункты списков (несколько кругов — вложенные)
    for (let round = 0; round < 6; round++) {
      main.querySelectorAll('details:not([open])').forEach(d => { d.open = true; });
      let clicked = 0;
      main.querySelectorAll('.a-coll').forEach(c => {
        if (c.querySelector(':scope > .a-ci > .a-ci-title[aria-expanded="true"], :scope > .a-ci > .a-ci-head > .a-ci-title[aria-expanded="true"]')) return;
        const t = c.querySelector(':scope > .a-ci > .a-ci-head > .a-ci-title[aria-expanded="false"]');
        if (t) { t.click(); clicked++; }
      });
      if (!clicked && round > 1) break;
    }
    main.querySelectorAll('details:not([open])').forEach(d => { d.open = true; });
    const shown = n => { for (; n && n !== main; n = n.parentElement) { if (n.hidden) return false; const cs = getComputedStyle(n); if (cs.display === 'none') return false; } return true; };
    const txt = n => (n ? n.textContent : '').replace(/\s+/g, ' ').trim();
    const pathOf = u => {
      const out = [];
      for (let n = u.parentElement && u.parentElement.closest('details, .a-ci'); n; n = n.parentElement && n.parentElement.closest('details, .a-ci')) {
        let s = n.classList.contains('a-fold') ? n.getAttribute('data-ft')
          : n.classList.contains('a-ci') ? txt(n.querySelector('.a-ci-name'))
          : txt(n.querySelector(':scope > summary'));
        s = String(s || '').trim();
        if (s) out.unshift(s.length > 60 ? s.slice(0, 58) + '…' : s);
      }
      return out;
    };
    const items = [];
    main.querySelectorAll('.a-field, .a-switch').forEach(u => {
      if (u.parentElement.closest('.a-field, .a-switch')) return;
      if (u.closest('.a-foldbar, .a-jpv, .a-phone, iframe')) return;
      let n = u.querySelector('.a-label, .a-switch-text');
      let name = n ? (n.classList.contains('a-switch-text') && n.firstChild ? n.firstChild.textContent : n.textContent) : '';
      name = String(name).replace(/\s+/g, ' ').trim();
      const inp = u.querySelector('input, select, textarea');
      let kind = u.classList.contains('a-switch') ? 'вкл/выкл' : !inp ? 'другое' : inp.tagName === 'SELECT' ? 'выбор' : inp.tagName === 'TEXTAREA' ? 'текст' : (inp.type === 'range' ? 'ползунок' : inp.type === 'color' ? 'цвет' : inp.type === 'file' ? 'файл' : inp.type === 'checkbox' ? 'галочка' : inp.type === 'number' ? 'число' : 'текст');
      if (u.querySelector('img, .a-img')) kind = kind === 'файл' ? 'картинка' : kind;
      const h = u.querySelector('.a-hint, small');
      items.push({ where, path: pathOf(u), name: name || '(без названия)', kind, hint: h ? txt(h).slice(0, 160) : '', vis: shown(u) });
    });
    return items;
  }, where);
}

async function tabsHere(page) {
  return page.evaluate((skip) => {
    const main = document.getElementById('a-main');
    const bars = [...main.querySelectorAll('.a-tabs')];
    return bars.map((b, bi) => [...b.querySelectorAll(':scope > button')].map((x, i) => ({ bi, i, text: x.textContent.trim(), active: x.classList.contains('is-active') }))
      .filter(x => !new RegExp(skip).test(x.text)));
  }, SKIP_BTN.source);
}

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await br.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on('pageerror', e => console.error('PAGEERR', e.message));
  page.on('dialog', d => d.dismiss());
  await page.goto('http://localhost:8765/admin/');
  await page.waitForSelector('.a-nav button');
  await page.waitForTimeout(2500);
  const all = [];
  const sections = await page.$$eval('.a-nav button', bs => bs.map(b => b.textContent.trim()));
  async function goSection(s) {
    await page.locator('.a-nav button', { hasText: s }).first().click();
    await page.waitForTimeout(400);
  }
  for (const s of sections) {
    await goSection(s);
    if (s === 'Витрины') {
      all.push(...await snap(page, [s, 'Список месяцев']));
      await page.locator('.a-sc-item').first().click(); await page.waitForTimeout(500);
      const n = await page.locator('.a-mcard').count();
      for (let i = 0; i < n; i++) {
        await page.locator('.a-mcard').nth(i).click(); await page.waitForTimeout(500);
        const title = (await page.locator('.a-mcard').nth(i).locator('.a-mcard-t').textContent()).trim();
        all.push(...await snap(page, [s, 'Месяц', 'Карточка ' + (i + 1) + ' · ' + title]));
      }
      continue;
    }
    // маршруты страниц: перебрать оба маршрута
    let routesSel = [null];
    if (s === 'Страницы маршрутов') routesSel = await page.$$eval('#a-main select', ss => { const s = ss[0]; return s ? [...s.options].map(o => o.value) : [null]; });
    for (const rv of routesSel) {
      await goSection(s);
      if (rv) { await page.selectOption('#a-main select >> nth=0', rv); await page.waitForTimeout(600); }
      const rname = rv || '';
      // перебор вкладок (одна-две полосы)
      const visited = new Set();
      async function walk(prefix) {
        const bars = await tabsHere(page);
        const tabBars = bars.filter(b => b.length > 1 && b.some(x => x.active));
        const bar = tabBars[0];
        if (!bar) { all.push(...await snap(page, [s, rname, ...prefix].filter(Boolean))); return; }
        all.push(...await snap(page, [s, rname, ...prefix, bar.find(x => x.active).text].filter(Boolean)));
        for (const t of bar) {
          if (t.active) continue;
          await page.evaluate(({ bi, i }) => document.querySelectorAll('#a-main .a-tabs')[bi].querySelectorAll(':scope > button')[i].click(), t);
          await page.waitForTimeout(700);
          all.push(...await snap(page, [s, rname, ...prefix, t.text].filter(Boolean)));
        }
      }
      await walk([]);
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(all, null, 1));
  console.log('fields', all.length);
  await br.close();
})();
