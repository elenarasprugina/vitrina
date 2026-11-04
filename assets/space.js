/* «Пространство 13 MIRRORS» — живая комната-оранжерея (замысел и решения — docs/prostranstvo.md, шаг 2).
   Страница: prostranstvo/ (data-base="../"). Данные — data/settings.json → space (правятся в панели, раздел «Пространство»);
   в предпросмотре панели — её черновик (window.parent.M13_SP_DRAFT).
   Одна большая картинка; поверх — движение (пылинки, искорки на подвесках, радужные блики на мозаике, свечи) и зоны предметов.
   Предмет со ссылкой светится при наведении/касании, показывает подпись, нажатие — переход. Предмет без ссылки стоит тихо (сад растёт).
   Ничего не собирает и никуда не отправляет. Если на странице нет #sp — только отдаёт заготовку (window.M13SP) панели. */
(function () {
  'use strict';

  /* ---------- Заготовка ---------- */
  // Встроенные картинки (её оранжереи 03.11). Зоны предметов — у каждой картинки свои (pos[pic]), в процентах картинки.
  var PICS = {
    '2': { src: 'assets/prostranstvo/oranzhereya-2.jpg', w: 2000, h: 1129, name: 'Оранжерея 2 — радужная',
      candles: [[16.3, 57.2], [18.4, 57], [30.6, 55.5], [37.4, 56.5], [38.9, 55.8], [45.1, 56.3], [46.4, 55.6]],
      glints: [0, 0, 100, 42], dust: [12, 18, 80, 50] },
    '1': { src: 'assets/prostranstvo/oranzhereya-1.jpg', w: 2000, h: 1129, name: 'Оранжерея 1 — тёплая',
      candles: [[22.6, 56], [23.8, 55.8], [52.7, 54.2], [54.5, 54.4], [55.8, 54], [12.1, 65.6], [13.2, 65.3]],
      glints: [0, 0, 100, 60], dust: [20, 20, 70, 45] }
  };
  function Z(a, b) { return { '2': { x: a[0], y: a[1], w: a[2], h: a[3] }, '1': { x: b[0], y: b[1], w: b[2], h: b[3] } }; }
  var DEF = {
    title: 'Пространство 13 MIRRORS', back: '← К витрине', pic: '2', image: '', imageW: 0, imageH: 0,
    hint: 'Коснись предмета — он откроет своё место', hintPan: 'Веди пальцем — комната шире экрана',
    splash: { on: true, text: 'Каждый день — это приглашение посмотреть иначе', sec: 2.8 },
    fx: { dust: true, glints: true, floor: true, candles: true, call: true },
    door: { on: false, text: 'Пространство' },
    items: [
      { id: 'telescope', name: 'Витрина месяца', sub: 'Посмотреть вдаль: что сейчас и что будет', url: './', pos: Z([25, 55, 11, 27], [36, 53, 10, 28]) },
      { id: 'kaleido', name: 'Узоры', sub: 'Найди свой узор', url: 'uzory/', pos: Z([25, 87, 34, 18], [27, 87, 50, 14]) },
      { id: 'candles', name: 'Костёр', sub: 'Огонь волны', url: 'uzory/cvetok/', pos: Z([39, 55.8, 18, 7], [54.3, 54.2, 7, 6]) },
      { id: 'center', name: 'Моё', sub: 'Здесь отразится твой путь', url: '', pos: Z([50, 73, 56, 17], [45, 73, 50, 18]) },
      { id: 'mirror', name: 'Зеркало', sub: 'Вопрос без имени', url: '', pos: Z([8, 50, 11, 48], [10, 57, 15, 62]) },
      { id: 'book', name: 'Гримуар', sub: 'Калейдоскоп твоих миров', url: '', pos: Z([86, 86, 29, 28], [81, 75, 38, 40]) },
      { id: 'crystals', name: 'Отклики', sub: 'Стёклышки тех, кто был здесь', url: '', pos: Z([82, 16, 30, 30], [60, 14, 50, 22]) },
      { id: 'arch', name: 'Дорога в сад', sub: 'Маршруты и то, что появится', url: '', pos: Z([72, 47, 17, 40], [79, 48, 14, 40]) }
    ]
  };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  // Её настройки поверх заготовки (пустое поле — как в заготовке)
  function merged(sp) {
    sp = sp || {};
    var o = clone(DEF);
    Object.keys(sp).forEach(function (k) {
      var v = sp[k];
      if (v == null || v === '') return;
      if (k === 'items') { if (Array.isArray(v) && v.length) o.items = v; return; }
      if (typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object') {
        Object.keys(v).forEach(function (j) { if (v[j] != null && v[j] !== '') o[k][j] = v[j]; });
      } else o[k] = v;
    });
    return o;
  }
  // Какая картинка: своя (загружена в панели) или встроенная
  function picOf(o) {
    if (o.pic === 'own' && o.image) return { key: 'own', src: o.image, w: +o.imageW || 1600, h: +o.imageH || 900, candles: [], glints: [0, 0, 100, 40], dust: [10, 15, 80, 55], own: true };
    var k = PICS[o.pic] ? o.pic : '2', p = PICS[k];
    return { key: k, src: p.src, w: p.w, h: p.h, candles: p.candles, glints: p.glints, dust: p.dust };
  }
  function posOf(it, key) {
    var p = it.pos && (it.pos[key] || (key === 'own' ? it.pos['2'] : null));
    return p && +p.w > 0 && +p.h > 0 ? p : null;
  }
  window.M13SP = { DEF: DEF, PICS: PICS, merged: merged, picOf: picOf, posOf: posOf };

  var root = document.getElementById('sp');
  if (!root) return;

  /* ---------- Страница ---------- */
  var BASE = root.getAttribute('data-base') || '../';
  var PANEL = (function () { try { return window.parent !== window && !!window.parent.M13_SP_DRAFT; } catch (e) { return false; } })();
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function imgUrl(v) { return !v ? '' : /^(data:|blob:|https?:)/.test(v) ? v : BASE + v; }
  function hrefOf(u) { u = String(u || '').trim(); if (!u) return ''; if (/^(https?:|\/|mailto:)/.test(u)) return u; return BASE + (u === './' || u === '.' ? '' : u.replace(/^\.\//, '')); }
  function load() {
    if (PANEL) { try { return Promise.resolve(window.parent.M13_SP_DRAFT()); } catch (e) {} }
    return fetch(BASE + 'data/settings.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (s) { return { settings: s }; });
  }

  var O, PIC, view, stage, img, cvs, ctx, zones = [], sel = null, lastPointer = 'mouse', W = 0, H = 0;

  function build() {
    document.title = O.title || '13 MIRRORS';
    root.innerHTML = '';
    view = el('div', 'sp-view');
    stage = el('div', 'sp-stage');
    img = el('img', 'sp-img'); img.alt = ''; img.decoding = 'async'; img.draggable = false;
    cvs = el('canvas', 'sp-fx'); ctx = cvs.getContext('2d');
    stage.appendChild(img); stage.appendChild(cvs);
    zones = [];
    O.items.forEach(function (it) {
      var p = posOf(it, PIC.key);
      if (!p || it.visible === false) return;
      var live = !!String(it.url || '').trim();
      var z = el(live ? 'a' : 'div', 'sp-zone' + (live ? ' sp-zone--live' : ''));
      z.style.left = (p.x - p.w / 2) + '%'; z.style.top = (p.y - p.h / 2) + '%'; z.style.width = p.w + '%'; z.style.height = p.h + '%';
      if (live) {
        z.href = hrefOf(it.url);
        z.setAttribute('aria-label', it.name + (it.sub ? ' — ' + it.sub : ''));
        z.innerHTML = '<span class="sp-glow"></span><span class="sp-label"><b>' + esc(it.name) + '</b>' + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '<i>Войти →</i></span>';
        if (p.y < 22) z.classList.add('sp-zone--low');   // подпись — под предметом, если он у самого верха
        z.addEventListener('click', function (e) { onZone(e, z, it); });
        z.addEventListener('mouseenter', function () { if (lastPointer !== 'touch') pick(z); });
        z.addEventListener('mouseleave', function () { if (lastPointer !== 'touch' && sel === z) pick(null); });
        z.addEventListener('focus', function () { if (lastPointer === 'key') pick(z); });
        z.addEventListener('blur', function () { if (sel === z) pick(null); });
        zones.push(z);
      } else z.setAttribute('aria-hidden', 'true');
      stage.appendChild(z);
    });
    view.appendChild(stage);
    var top = el('div', 'sp-top', '<a class="sp-back" href="' + esc(hrefOf('./')) + '">' + esc(O.back) + '</a><h1 class="sp-title">' + esc(O.title) + '</h1>');
    var hint = el('div', 'sp-hint');
    root.appendChild(view); root.appendChild(top); root.appendChild(hint);
    view.addEventListener('pointerdown', function (e) { lastPointer = e.pointerType || 'mouse'; }, { passive: true });
    document.addEventListener('keydown', function (e) { if (e.key === 'Tab') lastPointer = 'key'; });
    view.addEventListener('click', function (e) { if (!e.target.closest('.sp-zone--live')) pick(null); });
    img.onload = function () { layout(true); root.classList.add('is-ready'); };
    img.src = imgUrl(PIC.src);
    if (img.complete && img.naturalWidth) img.onload();
    window.addEventListener('resize', function () { layout(false); });
    showHint(hint);
  }
  // Касание пальцем: первое — свет и подпись, второе (или «Войти →») — переход. Мышью — сразу переход.
  function onZone(e, z, it) {
    if (lastPointer === 'touch' && sel !== z) { e.preventDefault(); pick(z); return; }
    if (PANEL) { e.preventDefault(); note('В панели переход не выполняется. На сайте откроется: ' + (it.url || '')); }
  }
  function pick(z) {
    if (sel) sel.classList.remove('is-on');
    sel = z;
    if (z) z.classList.add('is-on');
  }
  var noteT = 0;
  function note(t) {
    var n = root.querySelector('.sp-note') || root.appendChild(el('div', 'sp-note'));
    n.textContent = t; n.classList.add('is-on');
    clearTimeout(noteT); noteT = setTimeout(function () { n.classList.remove('is-on'); }, 2600);
  }
  function showHint(h) {
    var phone = window.innerWidth / Math.max(1, window.innerHeight) < 1.2;
    var t = phone && O.hintPan ? O.hintPan : O.hint;
    if (!t) return;
    h.textContent = t;
    setTimeout(function () { h.classList.add('is-on'); }, (O.splash.on ? +O.splash.sec * 1000 : 0) + 1200);
    setTimeout(function () { h.classList.remove('is-on'); }, (O.splash.on ? +O.splash.sec * 1000 : 0) + 6500);
  }

  // Картинка накрывает экран (как фон); что не влезло — листается пальцем (на телефоне — панорама влево-вправо)
  var placed = false;
  function layout(first) {
    var vw = view.clientWidth || window.innerWidth, vh = view.clientHeight || window.innerHeight;
    var iw = img.naturalWidth || PIC.w, ih = img.naturalHeight || PIC.h;
    var k = Math.max(vw / iw, vh / ih);
    W = Math.round(iw * k); H = Math.round(ih * k);
    stage.style.width = W + 'px'; stage.style.height = H + 'px';
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cvs.width = Math.round(W * dpr); cvs.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    root.classList.toggle('is-pan', W > vw + 4);
    if (first || !placed) {
      // Начало — середина комнаты (мозаичный круг)
      var c = (O.items.filter(function (x) { return x.id === 'center'; })[0] || {}), p = posOf(c, PIC.key) || { x: 50, y: 60 };
      view.scrollLeft = Math.max(0, W * p.x / 100 - vw / 2);
      view.scrollTop = Math.max(0, Math.min(H - vh, H * 0.62 - vh / 2));
      placed = true;
    }
    seed();
  }

  /* ---------- Движение (холст поверх картинки) ---------- */
  var dust = [], glints = [], blicks = [], t0 = 0, running = false;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function seed() {
    var d = PIC.dust, g = PIC.glints, n = W < 900 ? 0.7 : 1;
    dust = []; glints = []; blicks = [];
    var i;
    for (i = 0; i < Math.round(46 * n); i++) dust.push({ x: rnd(d[0], d[0] + d[2]), y: rnd(d[1], d[1] + d[3]), r: rnd(0.6, 1.9), s: rnd(0.15, 0.6), ph: rnd(0, 6.28), a: rnd(0.25, 0.7) });
    for (i = 0; i < Math.round(26 * n); i++) glints.push({ x: rnd(g[0], g[0] + g[2]), y: rnd(g[1], g[1] + g[3]), r: rnd(3, 8), per: rnd(2.6, 6.5), ph: rnd(0, 1), hue: rnd(0, 360) });
    var c = (O.items.filter(function (x) { return x.id === 'center'; })[0] || {}), p = posOf(c, PIC.key);
    if (p) for (i = 0; i < 12; i++) blicks.push({ cx: p.x, cy: p.y, ax: p.w / 2 * rnd(0.15, 0.85), ay: p.h / 2 * rnd(0.15, 0.85), sp: rnd(0.02, 0.06) * (i % 2 ? 1 : -1), ph: rnd(0, 6.28), r: rnd(0.035, 0.07) * p.w, hue: i * 30 });
    if (!running) { running = true; requestAnimationFrame(frame); }
  }
  function frame(ts) {
    if (!t0) t0 = ts;
    var t = (ts - t0) / 1000, i, q, a;
    if (document.hidden) { requestAnimationFrame(frame); return; }
    if (REDUCED) t = 4;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    var fx = O.fx;
    // Радужные блики плывут по мозаичному кругу (сплюснуты, как свет на полу)
    if (fx.floor) for (i = 0; i < blicks.length; i++) {
      q = blicks[i]; a = q.ph + t * q.sp * 6.28;
      var bx = (q.cx + Math.cos(a) * q.ax) / 100 * W, by = (q.cy + Math.sin(a * 1.3) * q.ay) / 100 * H, br = q.r / 100 * W;
      var hue = (q.hue + t * 8) % 360, al = 0.13 + 0.09 * Math.sin(t * 0.7 + q.ph);
      ctx.save(); ctx.translate(bx, by); ctx.scale(1, 0.38);
      var gr = ctx.createRadialGradient(0, 0, 0, 0, 0, br);
      gr.addColorStop(0, 'hsla(' + hue + ',95%,72%,' + al + ')'); gr.addColorStop(1, 'hsla(' + hue + ',95%,60%,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, br, 0, 6.2832); ctx.fill(); ctx.restore();
    }
    // Свечи мерцают
    if (fx.candles) for (i = 0; i < PIC.candles.length; i++) {
      q = PIC.candles[i];
      var f = 0.75 + 0.15 * Math.sin(t * 9 + i * 2.1) + 0.1 * Math.sin(t * 23 + i * 5.3);
      var cx = q[0] / 100 * W, cy = (q[1] - 1.2) / 100 * H, cr = Math.max(10, W * 0.013) * f;
      var cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr * 2.4);
      cg.addColorStop(0, 'rgba(255,214,140,' + (0.45 * f) + ')'); cg.addColorStop(0.35, 'rgba(255,170,80,' + (0.16 * f) + ')'); cg.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, cr * 2.4, 0, 6.2832); ctx.fill();
    }
    // Искорки на подвесках-стёклышках: вспыхивают и гаснут
    if (fx.glints) for (i = 0; i < glints.length; i++) {
      q = glints[i];
      var ph = ((t / q.per + q.ph) % 1), s = ph < 0.22 ? Math.sin(ph / 0.22 * Math.PI) : 0;
      if (s <= 0.01) { if (ph > 0.95) { q.x = rnd(PIC.glints[0], PIC.glints[0] + PIC.glints[2]); q.y = rnd(PIC.glints[1], PIC.glints[1] + PIC.glints[3]); q.hue = rnd(0, 360); } continue; }
      var gx = q.x / 100 * W, gy = q.y / 100 * H, gr2 = q.r * s * (W / 1400 + 0.4);
      ctx.strokeStyle = 'hsla(' + q.hue + ',80%,88%,' + (0.85 * s) + ')'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(gx - gr2 * 2, gy); ctx.lineTo(gx + gr2 * 2, gy); ctx.moveTo(gx, gy - gr2 * 2); ctx.lineTo(gx, gy + gr2 * 2); ctx.stroke();
      var gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr2);
      gg.addColorStop(0, 'rgba(255,255,255,' + (0.9 * s) + ')'); gg.addColorStop(1, 'hsla(' + q.hue + ',90%,75%,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(gx, gy, gr2, 0, 6.2832); ctx.fill();
    }
    // Пылинки в луче света
    if (fx.dust) for (i = 0; i < dust.length; i++) {
      q = dust[i];
      var dx = (q.x + Math.sin(t * 0.13 + q.ph) * 2.2) / 100 * W, dy = ((q.y - t * q.s * 0.35 + 100) % 100) / 100 * H;
      if (dy < PIC.dust[1] / 100 * H) dy += PIC.dust[3] / 100 * H;
      var da = q.a * (0.55 + 0.45 * Math.sin(t * 0.9 + q.ph));
      ctx.fillStyle = 'rgba(255,236,190,' + da + ')';
      ctx.beginPath(); ctx.arc(dx, dy, q.r * (W / 1600 + 0.5), 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (!REDUCED) requestAnimationFrame(frame); else running = false;
  }

  // Предметы со ссылкой иногда тихо «зовут» — по одному мягко светятся (видно, что их можно коснуться)
  function calls() {
    if (!O.fx.call || REDUCED || !zones.length) return;
    var i = 0;
    setInterval(function () {
      if (sel || document.hidden) return;
      var z = zones[i++ % zones.length];
      z.classList.add('is-call');
      setTimeout(function () { z.classList.remove('is-call'); }, 1800);
    }, 3400);
  }

  /* ---------- Заставка: пятно света с фразой раскрывается в оранжерею ---------- */
  function splash(done) {
    var seen = false;
    try { seen = !PANEL && sessionStorage.getItem('m13-sp-splash') === '1'; } catch (e) {}
    if (!O.splash.on || seen || REDUCED) { done(); return; }
    try { sessionStorage.setItem('m13-sp-splash', '1'); } catch (e) {}
    var s = el('div', 'sp-splash', '<div class="sp-sun"></div><p>' + esc(O.splash.text) + '</p>');
    root.appendChild(s);
    var sec = Math.max(1.2, Math.min(8, +O.splash.sec || 2.8)), gone = false;
    function go() { if (gone) return; gone = true; s.classList.add('is-open'); done(); setTimeout(function () { s.remove(); }, 1400); }
    requestAnimationFrame(function () { s.classList.add('is-in'); });
    s.addEventListener('click', go);
    setTimeout(go, sec * 1000);
  }

  load().then(function (d) {
    O = merged(((d && d.settings) || {}).space);
    PIC = picOf(O);
    build();
    splash(function () { root.classList.add('is-open'); setTimeout(calls, 1500); });
  }).catch(function (e) {
    console.error(e);
    root.innerHTML = '<p style="padding:40px;color:#f3e6c8">Не получилось открыть страницу. Обновите её через минуту.</p>';
  });
})();
