/* 13 MIRRORS · сцена «Двери» — второй вид пространства маршрута (конструктор, 06.10.2026; подробно — docs/doors.md).
   Маршрут со сценой «Двери» (route.scene === 'doors'): общая картинка с дверями — своя для компьютера (16:9) и телефона (9:16);
   у каждого дня — своя дверь: контур (точки по картинке), слои по состояниям, жест зова, открытие, пространство за дверью.
   Здесь — только то, как сцена выглядит и движется. Какой сегодня день, в какие двери входили, ключи и коды — в route.js (M13R);
   страница маршрута грузит этот файл сама, только у маршрутов с дверями. Панель рисует этим же кодом предпросмотр и контуры.

   route.doors = {
     desktop, mobile — общая сцена; fit: 'contain' (целиком, по краям — та же картинка размыто) | 'cover' (во весь экран); dim — приглушить сверху, %;
     items: [дверь × число дней] — дверь N = день N:
       { title — название / внутренний ID, seal — архетип / печать (для себя), on — активна (false — двери нет на сцене),
         zone: { desktop: [[x, y] …], mobile: [[x, y] …] } — контур, доли картинки (0…1), не съезжает при любом размере экрана,
         layers: [слой], open: { type, desktop, mobile, hold, ms, soft, tap }, space: пространство за дверью },
     final: пространство финала (+ on) — после 13-го дня }
   Слой: { name, visible, st: { состояние: да/нет } — в каких состояниях виден (нет st — во всех),
     area: 'door' (картинка размером со сцену, видна только внутри контура) | 'scene' (вся сцена, без контура) | 'frag' (готовый фрагмент — в рамку двери),
     desktop, mobile — картинка слоя (PNG/WebP с прозрачностью; необязательно), color + fill — заливка цветом (%), opacity, blend,
     soft — мягкий край контура, fx — движение (FX ниже), speed, power — его скорость и сила (%), fade — сколько длится смена состояния, мс, scale — фрагмент крупнее/мельче }
   Пространство: { desktop, mobile — фон, color, dim, place: 'center' | 'left' | 'right' | 'bottom', plate: 'glass' | 'dark' | 'none', blocks: [блок] }
   Блок: { kind: 'title' | 'small' | 'text' | 'image' | 'dayCard' | 'deck' | 'glass' | 'final', text, image, label, auto, who: { формат: да/нет }, visible } */
(function () {
  'use strict';
  // Пять состояний двери (её список 06.10). Порядок важен: так они идут в панели.
  var STATES = ['future', 'today_unvisited', 'today_visited', 'past_visited', 'past_unvisited'];
  var STATE_NAMES = { future: 'будущая', today_unvisited: 'сегодня, ещё не входили', today_visited: 'сегодня, уже входили', past_visited: 'прошла — входили', past_unvisited: 'прошла — не входили' };
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var SVGNS = 'http://www.w3.org/2000/svg';

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function sv(tag, attrs) { var n = document.createElementNS(SVGNS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; }
  function src(base, v) { if (!v) return ''; return /^(data:|blob:|https?:)/.test(v) ? v : (base || '') + v; }
  function num(v, def, lo, hi) { v = v == null || v === '' || isNaN(+v) ? def : +v; return Math.max(lo, Math.min(hi, v)); }
  function hexOk(c) { return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c || ''); }

  /* ---------- Контур двери ---------- */
  function ptsOk(a) { return !!(a && a.length >= 3); }
  function bbox(a) {
    var x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    a.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    return { x: x0, y: y0, w: Math.max(.001, x1 - x0), h: Math.max(.001, y1 - y0), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  function inPoly(a, x, y) {
    var ins = false, i, j;
    for (i = 0, j = a.length - 1; i < a.length; j = i++) if ((a[i][1] > y) !== (a[j][1] > y) && x < (a[j][0] - a[i][0]) * (y - a[i][1]) / (a[j][1] - a[i][1]) + a[i][0]) ins = !ins;
    return ins;
  }
  function pct(a) { return 'polygon(' + a.map(function (p) { return (p[0] * 100).toFixed(2) + '% ' + (p[1] * 100).toFixed(2) + '%'; }).join(',') + ')'; }
  function pts100(a) { return a.map(function (p) { return (p[0] * 100).toFixed(2) + ',' + (p[1] * 100).toFixed(2); }).join(' '); }
  // Контур как маска: soft — мягкий край (размытие в долях сцены, 0 — резкий край, тогда обычная обрезка)
  function clip(n, a, soft) {
    if (!soft) { n.style.webkitClipPath = n.style.clipPath = pct(a); return; }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="' + (soft / 10).toFixed(2) + '"/></filter><polygon points="' + pts100(a) + '" fill="#fff" filter="url(#b)"/></svg>';
    var u = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    n.style.webkitMaskImage = n.style.maskImage = u;
    n.style.webkitMaskSize = n.style.maskSize = '100% 100%';
    n.style.webkitMaskRepeat = n.style.maskRepeat = 'no-repeat';
  }
  // Случайные, но одни и те же для двери (звёздочки ложатся каждый раз одинаково)
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (s + 0x6d2b79f5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function ptIn(a, R) {
    var b = bbox(a), i, x, y;
    for (i = 0; i < 60; i++) { x = b.x + R() * b.w; y = b.y + R() * b.h; if (inPoly(a, x, y)) return [x, y]; }
    return [b.cx, b.cy];
  }

  /* ---------- Настройки ---------- */
  function cfg(r) { return (r && r.doors) || {}; }
  function count(r) { return ((r && r.days) || []).length || 13; }
  function doorOf(r, n) { return (cfg(r).items || [])[n - 1] || {}; }
  function zoneOf(d, key) { var z = (d.zone || {})[key]; return ptsOk(z) ? z : null; }
  // Картинка сцены для экрана: вытянутый (телефон) — mobile, иначе desktop; нет своей — берётся другая (вместе с её контурами)
  function pick(r, tall) {
    var D = cfg(r), t = tall ? !!D.mobile || !D.desktop : !D.desktop && !!D.mobile;
    return { src: t ? D.mobile : D.desktop, key: t ? 'mobile' : 'desktop', tall: t };
  }
  function layerOn(L, st) { return !L.st || L.st[st] === true; }
  // Заготовка — только устройство (панель): сколько дверей, где хранятся контуры, слои, открытие и пространство
  function norm(r) {
    var D = r.doors = r.doors || {}, n = count(r), i;
    D.items = D.items || [];
    for (i = 0; i < n; i++) {
      var d = D.items[i] = D.items[i] || {};
      d.zone = d.zone || {}; d.layers = d.layers || []; d.open = d.open || {};
      d.space = d.space || {}; d.space.blocks = d.space.blocks || [];
    }
    D.final = D.final || {}; D.final.blocks = D.final.blocks || [];
    return D;
  }

  /* ---------- Движение слоя (жест зова, след и всё прочее) ----------
     Расширяется здесь: новый вид — ещё одна строка в FX (название для панели + run). run(слой, c) получает
     c = { L — настройки слоя, poly — контур двери (или null), box — его рамка, n — номер двери, color, k — скорость (1 — обычная), p — сила (1 — обычная) }
     и добавляет в слой свои элементы или класс; время — переменная --fx-t (секунды), сила — --fx-p. */
  var FX = {
    none: { name: 'без движения' },
    pulse: { name: 'пульсация — дышит прозрачностью', t: 3, run: function (ln) { ln.classList.add('ys-fx-pulse'); } },
    glow: { name: 'мягкий свет изнутри', t: 4.2, run: function (ln, c) {
      var b = c.box || { cx: .5, cy: .5, w: .3, h: .4 }, g = el('div', 'ys-fx-glow');
      g.style.left = ((b.cx - b.w * .8) * 100) + '%'; g.style.top = ((b.cy - b.h * .8) * 100) + '%';
      g.style.width = (b.w * 160) + '%'; g.style.height = (b.h * 160) + '%';
      ln.firstChild.appendChild(g);
    } },
    glint: { name: 'блик — пробегает полоса света', t: 5, run: function (ln, c) {
      var b = c.box || { x: 0, y: 0, w: 1, h: 1 }, g = el('div', 'ys-fx-glint');
      g.style.left = (b.x * 100) + '%'; g.style.top = (b.y * 100) + '%'; g.style.width = (b.w * 100) + '%'; g.style.height = (b.h * 100) + '%';
      g.appendChild(el('i'));
      ln.firstChild.appendChild(g);
    } },
    contour: { name: 'бегущая линия по контуру', t: 6, run: function (ln, c) {
      if (!c.poly) return;
      var s = sv('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', class: 'ys-fx-line' });
      s.appendChild(sv('polygon', { points: pts100(c.poly), pathLength: '100' }));
      ln.firstChild.appendChild(s);
    } },
    sparkle: { name: 'звёздочки — мерцают', t: 2.6, run: function (ln, c) {
      var R = rng(c.n * 7919 + 13), k = Math.round(4 + 5 * Math.min(2, c.p)), i, p, s;
      for (i = 0; i < k; i++) {
        p = c.poly ? ptIn(c.poly, R) : [R(), R()];
        s = el('i', 'ys-fx-star');
        s.style.left = (p[0] * 100) + '%'; s.style.top = (p[1] * 100) + '%';
        s.style.setProperty('--z', (0.6 + R() * 0.9).toFixed(2)); s.style.animationDelay = (-R() * 6).toFixed(2) + 's';
        ln.firstChild.appendChild(s);
      }
    } },
    drift: { name: 'движение среды — слой медленно плывёт (туман, вода)', t: 16, run: function (ln) { ln.classList.add('ys-fx-drift'); } },
    reveal: { name: 'проявление — слой медленно проступает', t: 2.4, run: function (ln) { ln.classList.add('ys-fx-reveal'); } }
  };
  // Открытие двери: как человек входит в пространство дня
  var OPEN = {
    portal: 'дверь раскрывается в пространство (по её контуру)',
    zoom: 'камера входит в дверь',
    fade: 'мягкая смена'
  };
  var BLEND = [['', 'обычно'], ['screen', 'светом (светлое светит, тёмное исчезает)'], ['multiply', 'тенью (тёмное темнит, светлое исчезает)'], ['overlay', 'перекрытие'], ['soft-light', 'мягкий свет'], ['color', 'цветом']];
  // Блоки пространства за дверью — подключаемые части маршрута (существующие механики — кнопками, как и были)
  var BLOCKS = [['title', 'Заголовок'], ['small', 'Строка мелко'], ['text', 'Текст'], ['image', 'Картинка'],
    ['dayCard', 'Карта дня (кнопка)'], ['deck', 'Колода вслепую (кнопка)'], ['glass', 'Стёклышко дня (кнопка)'], ['final', 'Кнопка в финал']];
  var BTN_DEF = { dayCard: 'Карта дня', deck: 'Вытянуть карту', glass: 'Стёклышко дня', final: 'Дальше' };

  /* ---------- Слой двери ---------- */
  function layerNode(L, d, n, key, base) {
    var poly = zoneOf(d, key), area = L.area === 'scene' || L.area === 'frag' ? L.area : 'door';
    if (area !== 'scene' && !poly) return null;
    var ln = el('div', 'ys-dl'), box = el('div', 'ys-dl-box'), inner = el('div', 'ys-dl-in'), b = poly ? bbox(poly) : null, pic = L[key];
    var k = num(L.speed, 100, 20, 400) / 100, p = num(L.power, 100, 10, 300) / 100, f = FX[L.fx] || FX.none, color = hexOk(L.color) ? L.color : '#ffe2a0';
    ln.style.setProperty('--o', num(L.opacity, 100, 0, 100) / 100);
    ln.style.setProperty('--fade', num(L.fade, 900, 0, 8000) + 'ms');
    ln.style.setProperty('--fx-t', ((f.t || 3) / k).toFixed(2) + 's');
    ln.style.setProperty('--fx-p', p.toFixed(2));
    ln.style.setProperty('--fx-c', color);
    if (L.blend) ln.style.mixBlendMode = L.blend;
    if (area !== 'scene') clip(ln, poly, num(L.soft, 0, 0, 40));
    if (pic) {
      var im = el('img', 'ys-dl-pic'); im.alt = ''; im.src = src(base, pic); im.draggable = false;
      if (area === 'frag') {
        var sc = num(L.scale, 100, 50, 200) / 100;
        im.className = 'ys-dl-frag';
        im.style.left = ((b.cx - b.w * sc / 2) * 100) + '%'; im.style.top = ((b.cy - b.h * sc / 2) * 100) + '%';
        im.style.width = (b.w * sc * 100) + '%'; im.style.height = (b.h * sc * 100) + '%';
      }
      inner.appendChild(im);
    }
    if (+L.fill > 0) { var fl = el('div', 'ys-dl-fill'); fl.style.background = color; fl.style.opacity = num(L.fill, 0, 0, 100) / 100; inner.appendChild(fl); }
    box.appendChild(inner); ln.appendChild(box);
    if (f.run) f.run(ln, { L: L, poly: poly, box: b, n: n, color: color, k: k, p: p });
    return ln;
  }

  /* ---------- Сцена ----------
     o: { key — 'desktop' | 'mobile', base, onTap(n), zones — показать контуры, all — и выключенные двери (панель) }.
     Возвращает { node, img, set(n, состояние, сразу), state(n), poly(n), door(n), zones(да/нет) }. Размер и место node задаёт тот, кто её показывает. */
  function scene(r, o) {
    o = o || {};
    var key = o.key || 'desktop', D = cfg(r), N = count(r), G = {};
    var stage = el('div', 'ys-dstage'), img = el('img', 'ys-dscene'), wrap = el('div', 'ys-doors');
    var hit = sv('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', class: 'ys-dhit' + (o.zones ? ' is-zones' : '') });
    img.alt = ''; img.draggable = false;
    if (D[key]) img.src = src(o.base, D[key]); else stage.classList.add('is-empty');
    stage.appendChild(img); stage.appendChild(wrap); stage.appendChild(hit);
    for (var n = 1; n <= N; n++) (function (n) {
      var d = doorOf(r, n);
      if (d.on === false && !o.all) return;
      var g = el('div', 'ys-door'), list = [];
      g.setAttribute('data-n', n);
      (d.layers || []).forEach(function (L) {
        if (!L || L.visible === false) return;
        var ln = layerNode(L, d, n, key, o.base);
        if (ln) { g.appendChild(ln); list.push({ L: L, ln: ln }); }
      });
      wrap.appendChild(g);
      var poly = zoneOf(d, key), pg = null;
      if (poly) {
        pg = sv('polygon', { points: pts100(poly), 'data-n': n, class: 'ys-dpoly' });
        pg.addEventListener('click', function (e) { e.stopPropagation(); if (o.onTap) o.onTap(n); });
        pg.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && o.onTap) { e.preventDefault(); o.onTap(n); } });
        hit.appendChild(pg);
      }
      G[n] = { g: g, list: list, poly: poly, pg: pg, st: null };
    })(n);
    function set(n, st, now) {
      var x = G[n]; if (!x) return;
      x.st = st;
      x.list.forEach(function (it) {
        var on = layerOn(it.L, st);
        if (now) it.ln.classList.add('is-now');
        if (on && !it.ln.classList.contains('is-on')) {
          it.ln.classList.add('is-on');
          // «Проявление» — заново каждый раз, когда слой появляется
          if (!now && it.ln.classList.contains('ys-fx-reveal')) { it.ln.classList.remove('ys-fx-reveal'); void it.ln.offsetWidth; it.ln.classList.add('ys-fx-reveal'); }
        } else if (!on) it.ln.classList.remove('is-on');
        if (now) { void it.ln.offsetWidth; it.ln.classList.remove('is-now'); }
      });
      x.g.setAttribute('data-st', st);
      if (x.pg) {
        x.pg.setAttribute('class', 'ys-dpoly is-' + st);
        var today = st === 'today_unvisited' || st === 'today_visited';
        if (today) { x.pg.setAttribute('tabindex', '0'); x.pg.setAttribute('role', 'button'); x.pg.setAttribute('aria-label', 'Дверь дня ' + n); }
        else { x.pg.removeAttribute('tabindex'); x.pg.removeAttribute('role'); x.pg.setAttribute('aria-hidden', 'true'); }
      }
    }
    return { node: stage, img: img, key: key, set: set, state: function (n) { return G[n] ? G[n].st : null; },
      poly: function (n) { return G[n] ? G[n].poly : null; }, door: function (n) { return G[n] ? G[n].g : null; },
      zones: function (on) { hit.setAttribute('class', 'ys-dhit' + (on ? ' is-zones' : '')); } };
  }
  // Где сцена на экране: целиком (по краям — размытая та же картинка) или во весь экран (края срезаются)
  function fit(stage, iw, ih, mode, W, H) {
    var s = mode === 'cover' ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih);
    stage.style.width = iw * s + 'px'; stage.style.height = ih * s + 'px';
    stage.style.left = (W - iw * s) / 2 + 'px'; stage.style.top = (H - ih * s) / 2 + 'px';
  }

  /* ---------- Пространство за дверью ----------
     o: { base, tall, mode, ctx, fill, put (текст с переносами), backText, onBack, act(kind, блок), code — есть личный код } */
  function space(r, sp, o) {
    sp = sp || {};
    var tall = !!o.tall, bgSrc = tall ? sp.mobile || sp.desktop : sp.desktop || sp.mobile;
    var root = el('section', 'ys-space ys-space--' + (sp.place || 'center') + ' ys-space--' + (sp.plate || 'glass'));
    var bg = el('div', 'ys-space-bg');
    bg.style.backgroundColor = hexOk(sp.color) ? sp.color : '#0d0906';
    if (bgSrc) bg.style.backgroundImage = 'url("' + src(o.base, bgSrc) + '")';
    var dim = el('div', 'ys-space-dim'); dim.style.opacity = num(sp.dim, 30, 0, 90) / 100;
    var back = el('button', 'ys-space-back', o.backText || '← Назад к дверям'); back.type = 'button';
    back.addEventListener('click', function () { if (o.onBack) o.onBack(); });
    var scroll = el('div', 'ys-space-in'), col = el('div', 'ys-space-col');
    function T(s) { return o.fill ? o.fill(s || '', o.ctx || {}) : String(s || ''); }
    function put(n, s) { if (o.put) o.put(n, s); else n.textContent = s; return n; }
    (sp.blocks || []).forEach(function (b) {
      if (!b || b.visible === false) return;
      if (b.who && b.who[o.mode] === false) return;
      var t, n;
      if (b.kind === 'title' || b.kind === 'small') { t = T(b.text).trim(); if (!t) return; n = put(el(b.kind === 'title' ? 'h2' : 'p', 'ys-sp-' + b.kind), t); }
      else if (b.kind === 'text') {
        t = T(b.text).trim(); if (!t) return;
        n = el('div', 'ys-sp-text');
        t.split(/\n{2,}/).forEach(function (p) { n.appendChild(put(el('p'), p)); });
      } else if (b.kind === 'image') {
        if (!b.image) return;
        n = el('figure', 'ys-sp-img'); var im = el('img'); im.alt = ''; im.src = src(o.base, b.image); n.appendChild(im);
        if (b.text) n.appendChild(put(el('figcaption'), T(b.text)));
      } else if (BTN_DEF[b.kind]) {
        // Колода и стёклышко — только у Путешествия и Погружения (у Наблюдения их нет)
        if ((b.kind === 'deck' || b.kind === 'glass') && o.mode === 'observation') return;
        n = el('button', 'ys-sp-btn ys-sp-btn--' + b.kind, T(b.label).trim() || BTN_DEF[b.kind]); n.type = 'button';
        n.addEventListener('click', function () { if (o.act) o.act(b.kind, b); });
      }
      if (n) { if (b.align) n.style.textAlign = b.align; col.appendChild(n); }
    });
    if (!col.firstChild) col.appendChild(el('p', 'ys-sp-small', o.empty || ''));
    scroll.appendChild(col);
    root.appendChild(bg); root.appendChild(dim); root.appendChild(scroll); root.appendChild(back);
    return root;
  }
  // Блоки, которые открываются сами при входе (Карта дня с «сразу»)
  function autoBlocks(sp, mode) { return ((sp || {}).blocks || []).filter(function (b) { return b && b.visible !== false && b.auto && !(b.who && b.who[mode] === false) && BTN_DEF[b.kind]; }); }

  /* ---------- Вход в дверь и выход ----------
     sc — сцена, n — дверь (null — финал, без двери), node — пространство (уже собрано), o: { open — настройки открытия двери,
     now — сразу, без движения (предпросмотр), onCover() — пространство закрыло экран (тут дверь меняет состояние) } */
  function after(ms, f) { return setTimeout(f, ms); }
  function screenPoly(sc, n) {
    var a = sc && n ? sc.poly(n) : null, st = sc && sc.node;
    if (!a || !st || !st.isConnected) return null;
    var rc = st.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
    return a.map(function (p) { return [(rc.left + p[0] * rc.width) / W, (rc.top + p[1] * rc.height) / H]; });
  }
  function grown(a) {
    var b = bbox(a), K = 3.2 / Math.max(.02, Math.min(b.w, b.h));
    return a.map(function (p) { return [b.cx + (p[0] - b.cx) * K, b.cy + (p[1] - b.cy) * K]; });
  }
  function pctFree(a) { return 'polygon(' + a.map(function (p) { return (p[0] * 100).toFixed(2) + '% ' + (p[1] * 100).toFixed(2) + '%'; }).join(',') + ')'; }
  function setClip(n, v) { n.style.webkitClipPath = n.style.clipPath = v; }
  // Камера к двери: дверь встаёт в середину экрана и растёт; k задан — только чуть ближе, дверь на месте
  function camera(sc, n, k) {
    var st = sc.node, a = sc.poly(n); if (!a) return;
    var rc = st.getBoundingClientRect(), b = bbox(a), W = window.innerWidth, H = window.innerHeight;
    var cx = b.cx * rc.width, cy = b.cy * rc.height, K = k || Math.min(6, Math.max(1.4, Math.min(W / (b.w * rc.width), H / (b.h * rc.height)) * .85));
    st.style.transformOrigin = cx + 'px ' + cy + 'px';
    st.style.transform = k ? 'scale(' + K + ')' : 'translate(' + (W / 2 - rc.left - cx) + 'px,' + (H / 2 - rc.top - cy) + 'px) scale(' + K + ')';
  }
  function openLayer(sc, n, o) {
    var g = sc.door(n), d = o.door || {}, op = o.open || {}, a = sc.poly(n), pic = op[sc.key];
    if (!g || !a || !pic) return null;
    var ln = el('div', 'ys-dl ys-dl--open'), box = el('div', 'ys-dl-box'), inner = el('div', 'ys-dl-in'), im = el('img', 'ys-dl-pic');
    im.alt = ''; im.src = src(o.base, pic);
    ln.style.setProperty('--fade', num(op.fadeIn, 700, 0, 5000) + 'ms');
    clip(ln, a, num(op.soft, 8, 0, 40));
    inner.appendChild(im); box.appendChild(inner); ln.appendChild(box); g.appendChild(ln);
    void ln.offsetWidth; ln.classList.add('is-on');
    return ln;
  }
  function go(sc, n, node, o, done) {
    o = o || {};
    var op = o.open || {}, type = OPEN[op.type] ? op.type : 'portal', ms = num(op.ms, 1100, 200, 5000);
    var g = sc && n ? sc.door(n) : null, poly = screenPoly(sc, n);
    if (o.now || REDUCED || !poly) type = o.now ? 'now' : 'fade';
    document.body.appendChild(node);
    if (type === 'now') { node.classList.add('is-in'); if (o.onCover) o.onCover(); if (done) done(); return; }
    // Жест: дверь откликается на касание, потом (если есть картинка «открыто») проступает открытая дверь
    if (g && op.tap !== false) { g.classList.add('is-tap'); after(320, function () { g.classList.remove('is-tap'); }); }
    var ol = sc && n ? openLayer(sc, n, o) : null, hold = ol ? num(op.hold, 900, 0, 6000) : g && op.tap !== false ? 260 : 0;
    node.classList.add('is-hold');
    after(hold, function () {
      node.style.setProperty('--ms', ms + 'ms');
      if (type === 'portal') {
        setClip(node, pctFree(poly)); node.classList.remove('is-hold'); node.classList.add('is-portal');
        void node.offsetWidth;
        if (sc) { sc.node.classList.add('is-cam'); camera(sc, n, 1.12); }
        setClip(node, pctFree(grown(poly)));
        after(ms, function () { node.classList.remove('is-portal'); setClip(node, ''); node.classList.add('is-in'); if (o.onCover) o.onCover(); if (done) done(); });
      } else if (type === 'zoom') {
        if (sc) { sc.node.classList.add('is-cam'); camera(sc, n); }
        after(ms * .55, function () { node.classList.remove('is-hold'); node.classList.add('is-fade'); void node.offsetWidth; node.classList.add('is-in'); });
        after(ms * .55 + 600, function () { if (o.onCover) o.onCover(); if (done) done(); });
      } else {
        node.classList.remove('is-hold'); node.classList.add('is-fade'); void node.offsetWidth; node.classList.add('is-in');
        after(650, function () { if (o.onCover) o.onCover(); if (done) done(); });
      }
      // Пока человек внутри, сцена возвращается на место (её не видно), открытая дверь остаётся до выхода
      after(ms + 700, function () { if (sc) { sc.node.classList.remove('is-cam'); sc.node.style.transform = ''; } });
      node._ol = ol;
    });
  }
  function back(sc, n, node, o, done) {
    o = o || {};
    var op = o.open || {}, type = OPEN[op.type] ? op.type : 'portal', ms = num(op.ms, 1100, 200, 5000) * .8, poly = screenPoly(sc, n), ol = node._ol;
    function end() {
      node.remove();
      if (ol) { ol.classList.remove('is-on'); after(1200, function () { ol.remove(); }); }
      if (done) done();
    }
    if (REDUCED || !poly || type !== 'portal') {
      if (sc && poly && type === 'zoom' && !REDUCED) { camera(sc, n); void sc.node.offsetWidth; sc.node.classList.add('is-cam'); sc.node.style.transform = ''; }
      node.classList.add('is-fade'); node.classList.remove('is-in');
      after(650, function () { if (sc) sc.node.classList.remove('is-cam'); end(); });
      return;
    }
    node.style.setProperty('--ms', ms + 'ms');
    setClip(node, pctFree(grown(poly))); node.classList.add('is-portal');
    void node.offsetWidth;
    setClip(node, pctFree(poly));
    after(ms, function () { node.classList.add('is-gone'); after(260, end); });
  }

  window.M13D = { STATES: STATES, STATE_NAMES: STATE_NAMES, FX: FX, OPEN: OPEN, BLEND: BLEND, BLOCKS: BLOCKS, BTN_DEF: BTN_DEF,
    cfg: cfg, doorOf: doorOf, zoneOf: zoneOf, pick: pick, norm: norm, layerOn: layerOn, bbox: bbox, inPoly: inPoly, ptsOk: ptsOk,
    scene: scene, fit: fit, space: space, autoBlocks: autoBlocks, go: go, back: back };
})();
