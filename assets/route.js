/* 13 MIRRORS · страница маршрута по дням (первым — «Жёлтое Солнце»).
   Данные — data/journeys.json (настраиваются в панели: «Страницы маршрутов»).
   Здесь же — Карта дня и личная карта: их рисует и сама страница, и панель (предпросмотр).
   Этап 1: фон-спираль, экран ожидания, Карта дня. Этап 2: кирпичи на спирали (свет, импульс к центру), путь Наблюдателя, режим проверки ?debug=1.
   Колода и код — этап 3. */
(function () {
  'use strict';
  var MSK = 3, DAY = 864e5;
  var MODES = ['observation', 'journey', 'immersion'];
  var MODE_NAMES = { observation: 'Наблюдение', journey: 'Путешествие', immersion: 'Погружение' };
  var MON_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function imgSrc(base, v) { if (!v) return ''; return /^(data:|blob:|https?:)/.test(v) ? v : (base || '') + v; }

  /* ---------- Даты (по Москве) ---------- */
  // Сейчас по Москве как «настенные часы»: Date, у которого getUTC* — московское время.
  function nowMsk(debugNow) {
    if (debugNow) {
      var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(debugNow);
      if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 12), +(m[5] || 0)));
    }
    return new Date(Date.now() + MSK * 3600e3);
  }
  function startOf(route) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(route.start || '');
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  }
  function daysCount(route) { return (route.days || []).length || 13; }
  // Номер дня: 0 — ещё не начался, 1…13 — идёт, 14 — закончился.
  function dayNumber(route, now) {
    var s = startOf(route); if (isNaN(s)) return 0;
    var d = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - s) / DAY) + 1;
    return d < 1 ? 0 : d > daysCount(route) ? daysCount(route) + 1 : d;
  }
  function dateOf(route, n) {
    var s = startOf(route); if (isNaN(s)) return '';
    var d = new Date(s + (n - 1) * DAY);
    return d.getUTCDate() + ' ' + MON_GEN[d.getUTCMonth()];
  }

  /* ---------- Подстановка в шаблоны ---------- */
  function dayOf(route, n) { return (route.days || [])[n - 1] || { n: n, texts: {} }; }
  // Метки: {день}, {дата}, {кин}, {имя кина}, {печать}, {тон}; у личной карты — {разрешение} и словоформы карты.
  function ctxOf(route, n, perm) {
    var d = dayOf(route, n), c = {
      'день': String(n), 'дата': dateOf(route, n), 'кин': d.kin == null ? '' : String(d.kin),
      'имя кина': d.kinName || '', 'печать': d.seal || '', 'тон': d.tone || ''
    };
    if (perm) {
      c['разрешение'] = perm.title || '';
      var f = perm.f || {};
      Object.keys(f).forEach(function (k) { c[String(k).trim().toLowerCase()] = f[k] || ''; });
    }
    return c;
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  // {Действие} с большой буквы — значение тоже с большой. Неизвестная метка остаётся как есть.
  function fill(tpl, ctx, miss) {
    return String(tpl == null ? '' : tpl).replace(/\{([^{}\n]{1,40})\}/g, function (all, name) {
      var k = name.trim().toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(ctx, k)) { if (miss) miss.push(name.trim()); return all; }
      var v = ctx[k];
      return name.trim().charAt(0) !== k.charAt(0) ? cap(v) : v;
    });
  }
  function tokens(route) {
    var t = ['день', 'дата', 'кин', 'имя кина', 'печать', 'тон'];
    return { day: t, card: ['разрешение'].concat((route.forms || []).map(function (f) { return f.key; })) };
  }

  /* ---------- Значки ---------- */
  // Знак спирали (кнопка без подписи): виток посолонь от края к центру.
  function spiralSVG() {
    var pts = [], i, a, r;
    for (i = 0; i <= 160; i++) { a = i / 160 * Math.PI * 2 * 2.6; r = 26 - i / 160 * 23; pts.push((32 + r * Math.cos(a - Math.PI / 2)).toFixed(1) + ',' + (32 + r * Math.sin(a - Math.PI / 2)).toFixed(1)); }
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="32" r="3.2" fill="currentColor"/></svg>';
  }
  // Заглушка картинки дня (16:9): солнце над тёмной землёй и номер дня.
  function dayPlaceholder(n) {
    var rays = '', i, a;
    for (i = 0; i < 24; i++) { a = i / 24 * Math.PI * 2; rays += '<line x1="' + (320 + 70 * Math.cos(a)).toFixed(1) + '" y1="' + (150 + 70 * Math.sin(a)).toFixed(1) + '" x2="' + (320 + (i % 2 ? 105 : 128) * Math.cos(a)).toFixed(1) + '" y2="' + (150 + (i % 2 ? 105 : 128) * Math.sin(a)).toFixed(1) + '"/>'; }
    return '<svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><radialGradient id="ysg' + n + '" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="#5a3c0e"/><stop offset=".55" stop-color="#22160a"/><stop offset="1" stop-color="#0c0805"/></radialGradient>' +
      '<radialGradient id="yss' + n + '" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff2c4"/><stop offset=".55" stop-color="#ffcf5a"/><stop offset="1" stop-color="#e0961e"/></radialGradient></defs>' +
      '<rect width="640" height="360" fill="url(#ysg' + n + ')"/>' +
      '<g stroke="#ffcf5a" stroke-opacity=".55" stroke-width="3" stroke-linecap="round">' + rays + '</g>' +
      '<circle cx="320" cy="150" r="56" fill="url(#yss' + n + ')"/>' +
      '<text x="320" y="166" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="48" fill="#5a3a0a">' + n + '</text>' +
      '<path d="M0 300 Q320 255 640 300 L640 360 L0 360 Z" fill="#0b0704" fill-opacity=".85"/></svg>';
  }

  /* ---------- Карта дня и личная карта ----------
     kind: 'day' | 'personal'; mode: observation | journey | immersion; perm — карта-разрешение (для личной).
     o: { base, onSpiral(), traceUrl, traceLabel, preview } */
  function textNode(cls, text) {
    var box = el('div', cls);
    String(text).split(/\n{2,}/).forEach(function (p) {
      var q = el('p'); p.split('\n').forEach(function (line, i) { if (i) q.appendChild(el('br')); q.appendChild(document.createTextNode(line)); });
      box.appendChild(q);
    });
    return box;
  }
  function blockNode(b, route, n, perm, ctx, o) {
    var d = dayOf(route, n), t;
    if (b.kind === 'image') {
      var fig = el('div', 'ys-c-img');
      if (d.image) { var img = el('img'); img.src = imgSrc(o.base, d.image); img.alt = ''; fig.appendChild(img); }
      else fig.innerHTML = dayPlaceholder(n);
      return fig;
    }
    if (b.kind === 'permission') {
      var face = el('div', 'ys-c-perm');
      if (perm && perm.image) { var pi = el('img'); pi.src = imgSrc(o.base, perm.image); pi.alt = perm.title || ''; face.appendChild(pi); face.classList.add('has-img'); }
      else face.appendChild(el('div', 'ys-c-perm-t', perm ? perm.title : 'Карта-разрешение'));
      return face;
    }
    if (b.kind === 'small' || b.kind === 'title' || b.kind === 'note') {
      t = fill(b.text, ctx).trim(); if (!t) return null;
      if (b.kind === 'title') return el('h2', 'ys-c-title', t);
      return b.kind === 'small' ? el('p', 'ys-c-small', t) : textNode('ys-c-note', t);
    }
    // text / question — у каждого дня свой текст (day.texts[b.id]); в нём тоже можно ставить метки
    t = fill(((d.texts || {})[b.id]) || '', ctx).trim(); if (!t) return null;
    var box = el('div', b.kind === 'question' ? 'ys-c-q' : 'ys-c-text');
    if (b.label) box.appendChild(el('span', 'ys-c-label', b.label));
    box.appendChild(textNode('ys-c-body', t));
    return box;
  }
  function card(route, n, mode, kind, perm, o) {
    o = o || {};
    var list = ((kind === 'personal' ? route.personalCard : route.dayCard) || {}).blocks || [];
    var ctx = ctxOf(route, n, kind === 'personal' ? perm : null);
    var root = el('article', 'ys-card ys-card--' + kind + (n === daysCount(route) ? ' ys-card--center' : ''));
    var inner = el('div', 'ys-card-in');
    list.forEach(function (b) {
      if (!b || b.visible === false) return;
      if (b.who && b.who[mode] === false) return;
      var node = blockNode(b, route, n, perm, ctx, o);
      if (node) inner.appendChild(node);
    });
    var foot = el('div', 'ys-c-foot');
    if (kind === 'personal' && mode !== 'observation') {
      var url = ((route.trace || {})[mode]) || '';
      var tr = el('a', 'ys-c-trace', ((route.texts || {}).trace) || 'Оставить след');
      if (url) { tr.href = url; tr.target = '_blank'; tr.rel = 'noopener'; } else tr.setAttribute('aria-disabled', 'true');
      foot.appendChild(tr);
    }
    var sp = el('button', 'ys-spiral');
    sp.type = 'button';
    sp.setAttribute('aria-label', kind === 'personal' || mode === 'observation' ? 'Вернуться на спираль' : 'Дальше — выбрать карту');
    sp.innerHTML = spiralSVG();
    sp.addEventListener('click', function () { if (o.onSpiral) o.onSpiral(); });
    foot.appendChild(sp);
    inner.appendChild(foot);
    root.appendChild(inner);
    return root;
  }


  /* ---------- Кирпичи на спирали ----------
     Разметка — route.zones.desktop и route.zones.mobile (своя у каждой картинки; панель → «Кирпичи на спирали»):
     { path: [[x, y, w] × 25], center: {x, y, rx, ry}, width: 100 }. x, y — доли картинки, w — ширина плиты поперёк витка
     (по линии к центру спирали) в долях ширины картинки,
     width — общая толщина подсветки в %. Точки 0, 2 … 24 — стыки дней, 1, 3 … 23 — середины: день d идёт от точки 2(d−1) до 2d.
     Путь — от входа (внешний край слева) по часовой стрелке внутрь, посолонь; день 13 — диск в центре. */
  var PATH_DAYS = 12, SPAN = 10, ZID = 0;
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function zoneOk(z) { return !!(z && z.path && z.path.length >= PATH_DAYS * 2 + 1 && z.center); }
  // Картинка и разметка для экрана: вытянутый (телефон) — mobile, иначе desktop; если своей картинки нет — берётся другая.
  function pickMaster(route, tall) {
    var z = route.zones || {}, t = tall ? !!route.masterMobile || !route.masterDesktop : !route.masterDesktop && !!route.masterMobile;
    var zone = t ? z.mobile : z.desktop;
    return { src: t ? route.masterMobile : route.masterDesktop, zone: zoneOk(zone) ? zone : null, tall: t };
  }
  function cr(p0, p1, p2, p3, t) { var t2 = t * t; return .5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t2 * t); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  // Сглаженная линия пути (через все точки) с толщиной; у каждой выборки — номер дня. Координаты — пиксели картинки.
  function trace(z, iw, ih) {
    var k = (z.width == null || z.width === '' ? 100 : +z.width) / 100, n = PATH_DAYS * 2, out = [], i, s, t, a, b, c, d;
    var P = z.path.slice(0, n + 1).map(function (p) { return [p[0] * iw, p[1] * ih, (p[2] || .02) * iw * k]; });
    for (i = 0; i < n; i++) {
      a = P[i - 1] || P[i]; b = P[i]; c = P[i + 1]; d = P[i + 2] || P[i + 1];
      for (s = 0; s < SPAN || (i === n - 1 && s === SPAN); s++) {
        t = s / SPAN;
        out.push({ x: cr(a[0], b[0], c[0], d[0], t), y: cr(a[1], b[1], c[1], d[1], t), w: b[2] + (c[2] - b[2]) * t, day: Math.min(PATH_DAYS, Math.floor(i / 2) + 1) });
      }
    }
    // Поперёк витка — по линии к центру: так полоса не заворачивается на крутых изгибах по краям эллипса
    var C = { x: z.center.x * iw, y: z.center.y * ih };
    out.forEach(function (p) { var l = dist(p, C) || 1; p.nx = (p.x - C.x) / l; p.ny = (p.y - C.y) / l; });
    return out;
  }
  // Выборки дня d вместе с первой точкой следующего (чтобы полосы стыковались).
  function daySlice(tr, d) {
    var a = -1, b = -1;
    tr.forEach(function (p, j) { if (p.day === d) { if (a < 0) a = j; b = j; } });
    return a < 0 ? [] : tr.slice(a, b + 2);
  }
  function ribbonPath(pts, f) {
    if (pts.length < 2) return '';
    var L = [], R = [];
    pts.forEach(function (p) {
      var h = p.w * f / 2;
      L.push(r1(p.x + p.nx * h) + ',' + r1(p.y + p.ny * h)); R.unshift(r1(p.x - p.nx * h) + ',' + r1(p.y - p.ny * h));
    });
    return 'M' + L.join('L') + 'L' + R.join('L') + 'Z';
  }
  function xy(p) { return r1(p.x) + ',' + r1(p.y); }
  // Свет кирпичей 0…1: дни 1…12 и центр (последний день). n — сегодняшний день (0 — до начала, больше последнего — после конца).
  // Кирпичи — время маршрута, не личный путь: прошедшие — спокойно, сегодняшний — ярко и «дышит» (после нажатия — ровно), будущие — в тени.
  function lights(route, n, opened) {
    var g = route.glow || {}, last = daysCount(route), lv = [], d;
    function v(x, def) { return Math.max(0, Math.min(100, x == null || x === '' ? def : +x)) / 100; }
    var T = v(g.today, 100), D = v(g.done, 55), F = v(g.future, 12);
    for (d = 1; d <= last; d++) lv[d] = n > last ? T : d < n ? D : d > n ? F : opened ? (T + D) / 2 : T;
    return { lv: lv, today: n >= 1 && n <= last ? n : 0, calling: n >= 1 && n <= last && !opened, after: n > last, last: last };
  }
  // Слои света поверх картинки (все — в пикселях картинки, тянутся вместе с ней):
  // сумрак с «окнами» на светящихся кирпичах; мягкое свечение (screen); сегодняшний — отдельным слоем, он дышит; импульс; разметка (проверка).
  // o: { color, dusk 0…1, zones — показать контуры и номера ('outline' — только контуры) }
  function bricksLayer(route, z, iw, ih, o) {
    var id = 'ysz' + (++ZID), tr = trace(z, iw, ih), c = z.center;
    var B = { id: id, iw: iw, ih: ih, trace: tr, color: o.color || '#ffcf5a', center: { cx: c.x * iw, cy: c.y * ih, rx: c.rx * iw, ry: c.ry * ih } };
    var vb = ' viewBox="0 0 ' + iw + ' ' + ih + '" preserveAspectRatio="none" aria-hidden="true"';
    var soft = r1(iw * .006), halo = r1(iw * .012), last = daysCount(route), shapes = [];
    var box = el('div', 'ys-bricks');
    var svgs = ['ys-l-dusk', 'ys-l-glow', 'ys-l-today', 'ys-l-pulse', 'ys-l-zones'].map(function (cls) {
      box.insertAdjacentHTML('beforeend', '<svg class="' + cls + '"' + vb + '></svg>');
      return box.lastChild;
    });
    for (var d = 1; d <= last; d++) shapes[d] = d === last ? null : ribbonPath(daySlice(tr, d), 1);
    function shape(d, attrs, grow) {
      var C = B.center, g = grow || 1;
      return d === last ? '<ellipse cx="' + r1(C.cx) + '" cy="' + r1(C.cy) + '" rx="' + r1(C.rx * g) + '" ry="' + r1(C.ry * g) + '" ' + attrs + '/>' : '<path d="' + shapes[d] + '" ' + attrs + '/>';
    }
    function filt(name, sd) { return '<filter id="' + id + name + '" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="' + sd + '"/></filter>'; }
    B.paint = function (st) {
      var holes = '', glow = '', today = '', col = B.color, d, lv;
      for (d = 1; d <= last; d++) {
        lv = st.lv[d] || 0;
        holes += shape(d, 'fill="#000" fill-opacity="' + Math.min(1, lv * 1.5).toFixed(2) + '"');
        if (d === st.today && st.calling) today += shape(d, 'fill="' + col + '"') + shape(d, 'fill="#fff4cf" fill-opacity=".55"', .6);
        else if (lv > 0) glow += shape(d, 'fill="' + col + '" fill-opacity="' + (lv * .62).toFixed(2) + '"');
      }
      // После конца маршрута в центре — Солнце (заглушка): большой мягкий диск
      if (st.after) glow += shape(last, 'fill="' + col + '" fill-opacity=".55"', 1.9) + shape(last, 'fill="#fff4cf" fill-opacity=".7"', .9);
      svgs[0].innerHTML = '<defs>' + filt('s', soft) + '<mask id="' + id + 'm" maskUnits="userSpaceOnUse" x="0" y="0" width="' + iw + '" height="' + ih + '">' +
        '<rect width="' + iw + '" height="' + ih + '" fill="#fff"/><g filter="url(#' + id + 's)">' + holes + '</g></mask></defs>' +
        '<rect width="' + iw + '" height="' + ih + '" fill="#070402" fill-opacity="' + (o.dusk == null ? .35 : o.dusk) + '" mask="url(#' + id + 'm)"/>';
      svgs[1].innerHTML = '<defs>' + filt('h', halo) + '</defs><g filter="url(#' + id + 'h)">' + glow + '</g>';
      svgs[2].innerHTML = today ? '<defs>' + filt('t', halo) + '</defs><g filter="url(#' + id + 't)">' + today + '</g>' : '';
    };
    if (o.zones) {
      var zs = '', fs = r1(iw * .02);
      for (d = 1; d <= last; d++) {
        var m = d === last ? { x: B.center.cx, y: B.center.cy } : tr[(2 * d - 1) * SPAN];
        zs += shape(d, 'fill="none" stroke="#7ff" stroke-width="' + r1(iw * .0015) + '"') + (o.zones === 'outline' ? '' :
          '<text x="' + r1(m.x) + '" y="' + r1(m.y + fs * .35) + '" font-size="' + fs + '" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="' + r1(fs * .12) + '" paint-order="stroke" font-family="sans-serif" font-weight="700">' + d + '</text>');
      }
      svgs[4].innerHTML = zs;
    }
    B.node = box; B.pulse = svgs[3]; B.today = svgs[2];
    return B;
  }
  // Какой кирпич под точкой (x, y в пикселях картинки). tol — запас вокруг полосы; у сегодняшнего (prefer) — запас больше (big).
  function hitDay(B, x, y, last, tol, prefer, big) {
    var C = B.center, best = 0, bd = 1e9, p = { x: x, y: y };
    function inC(t) { var dx = (x - C.cx) / (C.rx + t), dy = (y - C.cy) / (C.ry + t); return dx * dx + dy * dy <= 1; }
    if (prefer === last && inC(big)) return last;
    if (prefer && prefer < last) B.trace.forEach(function (q) { if (q.day === prefer && dist(p, q) - q.w / 2 <= big) best = prefer; });
    if (best) return best;
    if (inC(tol)) return last;
    B.trace.forEach(function (q) { var dd = dist(p, q) - q.w / 2; if (dd < bd) { bd = dd; best = q.day; } });
    return bd <= tol ? best : 0;
  }
  // Световой импульс: от середины кирпича дня d по спирали к центру, вспышка в центре, затем done().
  function pulse(B, d, done) {
    var tr = B.trace, C = B.center, svg = B.pulse, iw = B.iw, col = B.color, fid = B.id + 'p';
    var pts = (d <= PATH_DAYS ? tr.slice((2 * d - 1) * SPAN) : []).concat([{ x: C.cx, y: C.cy, w: C.ry * 1.4 }]);
    var acc = [0], L = 0, i, t0 = 0;
    for (i = 1; i < pts.length; i++) { L += dist(pts[i - 1], pts[i]); acc.push(L); }
    var dur = pts.length > 1 ? 650 + 1250 * Math.min(1, (pts.length - 1) / (tr.length - SPAN)) : 0;
    svg.classList.remove('is-fade');
    svg.innerHTML = '<defs><filter id="' + fid + '" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="' + r1(iw * .005) + '"/></filter></defs>' +
      '<path fill="none" stroke="' + col + '" stroke-opacity=".6" stroke-linecap="round" stroke-linejoin="round" filter="url(#' + fid + ')"/>' +
      '<ellipse cx="' + r1(C.cx) + '" cy="' + r1(C.cy) + '" rx="' + r1(C.rx * 1.15) + '" ry="' + r1(C.ry * 1.15) + '" fill="' + col + '" opacity="0" filter="url(#' + fid + ')"/>' +
      '<circle fill="' + col + '" filter="url(#' + fid + ')"/><circle fill="#fff6dc"/>';
    var trail = svg.childNodes[1], flash = svg.childNodes[2], halo = svg.childNodes[3], core = svg.childNodes[4];
    function step(ts) {
      if (!t0) t0 = ts;
      var k = dur ? Math.min(1, (ts - t0) / dur) : 1, e = k < .5 ? 2 * k * k : 1 - Math.pow(2 - 2 * k, 2) / 2, s = e * L, j = 1;
      while (j < pts.length - 1 && acc[j] < s) j++;
      var a = pts[j - 1] || pts[0], b = pts[j] || pts[0], f = acc[j] > acc[j - 1] ? (s - acc[j - 1]) / (acc[j] - acc[j - 1]) : 1;
      var h = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, w = a.w + (b.w - a.w) * f;
      trail.setAttribute('d', 'M' + pts.slice(0, j).map(xy).join('L') + 'L' + xy(h));
      trail.setAttribute('stroke-width', r1(Math.max(w * .22, iw * .004)));
      halo.setAttribute('cx', r1(h.x)); halo.setAttribute('cy', r1(h.y)); halo.setAttribute('r', r1(Math.max(w * .3, iw * .01)));
      core.setAttribute('cx', r1(h.x)); core.setAttribute('cy', r1(h.y)); core.setAttribute('r', r1(Math.max(w * .1, iw * .004)));
      if (k < 1) { requestAnimationFrame(step); return; }
      var f0 = 0;
      (function fl(ts2) {
        if (!f0) f0 = ts2;
        var q = Math.min(1, (ts2 - f0) / 320);
        flash.setAttribute('opacity', (q * .95).toFixed(2));
        if (q < 1) { requestAnimationFrame(fl); return; }
        done();
        svg.classList.add('is-fade');
        setTimeout(function () { if (svg.classList.contains('is-fade')) { svg.innerHTML = ''; svg.classList.remove('is-fade'); } }, 1100);
      })(ts);
    }
    requestAnimationFrame(step);
  }

  /* ---------- Страница маршрута ---------- */
  function q(name) { var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(location.search); return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null; }
  // sim — день на спирали из режима проверки (0 — до начала, 14 — после конца), zonesOn — показать разметку кирпичей
  var S = { route: null, base: '', mode: 'observation', debug: false, debugNow: null, preview: false, sim: null, zonesOn: false, dbgMin: false, B: null, busy: false };

  function curDay() { return S.sim != null ? S.sim : dayNumber(S.route, nowMsk(S.debugNow)); }
  // Какие дни на этом устройстве уже открывали (сегодняшний кирпич после нажатия светится ровно). Только для света, не для доступа.
  function storeKey() { return 'm13ys-' + S.route.id + '-' + (S.route.start || ''); }
  function openedList() { try { var l = JSON.parse(localStorage.getItem(storeKey()) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function markOpened(n) {
    var l = openedList(); if (l.indexOf(n) >= 0) return;
    l.push(n); try { localStorage.setItem(storeKey(), JSON.stringify(l)); } catch (e) {}
  }
  function resetOpened() { try { localStorage.removeItem(storeKey()); } catch (e) {} }

  function stageFit(stage, img) {
    var W = window.innerWidth, H = window.innerHeight, iw = img.naturalWidth || 16, ih = img.naturalHeight || 9;
    var tall = H / W > 1.25, s, x, y;
    // Телефон: спираль во всю ширину и прижата к низу (приближать нельзя — обрежется начало пути). Иначе — заполнить экран.
    if (tall && W / H < iw / ih) { s = W / iw; x = 0; y = H - ih * s; }
    else { s = Math.max(W / iw, H / ih); x = (W - iw * s) / 2; y = (H - ih * s) / 2; }
    stage.style.width = iw * s + 'px'; stage.style.height = ih * s + 'px';
    stage.style.left = x + 'px'; stage.style.top = y + 'px';
    stage.classList.toggle('is-gap', y > 1);
  }
  // Центр спирали на экране — относительно середины окна (из него появляется Карта дня).
  function centerOffset() {
    var B = S.B, st = B && B.node.parentNode;
    if (!st) return null;
    var rc = st.getBoundingClientRect();
    return { x: rc.left + B.center.cx / B.iw * rc.width - window.innerWidth / 2, y: rc.top + B.center.cy / B.ih * rc.height - window.innerHeight / 2 };
  }
  function layer(node, cls, from) {
    var ov = el('div', 'ys-layer' + (cls ? ' ' + cls : ''));
    if (from) { ov.style.setProperty('--ys-ox', Math.round(from.x) + 'px'); ov.style.setProperty('--ys-oy', Math.round(from.y) + 'px'); }
    ov.appendChild(node);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeLayer(ov); });
    document.body.appendChild(ov);
    document.body.classList.add('ys-locked');
    requestAnimationFrame(function () { requestAnimationFrame(function () { ov.classList.add('is-in'); }); });
    return ov;
  }
  function closeLayer(ov) {
    ov = ov || document.querySelector('.ys-layer:not(.is-out)');
    if (!ov) return;
    ov.classList.remove('is-in'); ov.classList.add('is-out');
    setTimeout(function () { ov.remove(); if (!document.querySelector('.ys-layer')) document.body.classList.remove('ys-locked'); }, 380);
  }
  function note(text) {
    [].forEach.call(document.querySelectorAll('.ys-toast'), function (t) { t.remove(); });
    var t = el('div', 'ys-toast', text);
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-in'); });
    setTimeout(function () { t.classList.remove('is-in'); setTimeout(function () { t.remove(); }, 400); }, 3200);
  }
  function openDay(n, mode, from) {
    var r = S.route;
    closeLayer();
    var c = card(r, n, mode, 'day', null, { base: S.base, onSpiral: function () {
      if (mode === 'observation') { closeLayer(); return; }
      if (n === daysCount(r)) { openFinal(); return; }
      note(((r.texts || {}).next) || 'Выбор карты-разрешения появится здесь совсем скоро.');
    } });
    layer(c, 'ys-layer--day', from || centerOffset());
  }
  function openPersonal(n, mode, perm) {
    closeLayer();
    layer(card(S.route, n, mode, 'personal', perm, { base: S.base, onSpiral: function () { closeLayer(); } }), 'ys-layer--personal');
  }
  // Финал Солнца — пока заглушка. Это заменяемый слой: M13R.finalSunLayer можно подменить целиком, когда придумаем драматургию.
  function sunSVG() {
    var rays = '', i, a;
    for (i = 0; i < 36; i++) { a = i / 36 * Math.PI * 2; rays += '<line x1="' + r1(100 + 52 * Math.cos(a)) + '" y1="' + r1(100 + 52 * Math.sin(a)) + '" x2="' + r1(100 + (i % 2 ? 76 : 94) * Math.cos(a)) + '" y2="' + r1(100 + (i % 2 ? 76 : 94) * Math.sin(a)) + '"/>'; }
    return '<svg class="ys-final-sun" viewBox="0 0 200 200" aria-hidden="true"><defs><radialGradient id="ysfs" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#fffbe8"/><stop offset=".5" stop-color="#ffd76a"/><stop offset="1" stop-color="#e39a22"/></radialGradient></defs>' +
      '<g stroke="#ffd76a" stroke-width="3" stroke-linecap="round" opacity=".8">' + rays + '</g><circle cx="100" cy="100" r="44" fill="url(#ysfs)"/></svg>';
  }
  function finalSunLayer() {
    var tx = S.route.texts || {}, box = el('div', 'ys-final');
    box.innerHTML = sunSVG();
    box.appendChild(el('h2', 'ys-final-t', tx.final || 'Финал Солнца'));
    box.appendChild(el('p', 'ys-final-n', tx.finalNote || 'Здесь скоро откроется финал маршрута.'));
    var sp = el('button', 'ys-spiral'); sp.type = 'button'; sp.setAttribute('aria-label', 'Вернуться на спираль'); sp.innerHTML = spiralSVG();
    sp.addEventListener('click', function () { closeLayer(); });
    box.appendChild(sp);
    closeLayer();
    layer(box, 'ys-layer--final', centerOffset());
  }
  function openFinal() { (window.M13R && window.M13R.finalSunLayer || finalSunLayer)(); }

  // Нажатие на кирпич d. Сегодняшний — импульс к центру и Карта дня; прошедший, будущий — короткая подсказка.
  function tapDay(d) {
    var r = S.route, tx = r.texts || {}, n = curDay(), last = daysCount(r), ctx = ctxOf(r, d);
    if (n > last) { if (d === last) openFinal(); else note(fill(tx.past || 'День {день} пройден', ctx)); return; }
    if (n < 1) return;
    if (d < n) { note(fill(tx.past || 'День {день} пройден', ctx)); return; }
    if (d > n) { note(fill(tx.future || 'День {день} откроется {дата}', ctx)); return; }
    if (S.busy) return;
    var first = openedList().indexOf(d) < 0, B = S.B;
    markOpened(d);
    var hint = document.querySelector('.ys-tap'); if (hint) hint.classList.add('is-gone');
    if (!B || !first || REDUCED) { if (B) B.paint(lights(r, n, true)); openDay(d, S.mode); return; }
    S.busy = true;
    B.today.classList.add('is-go');
    pulse(B, d, function () {
      S.busy = false;
      B.paint(lights(r, n, true)); B.today.classList.remove('is-go');
      openDay(d, S.mode);
    });
  }
  function render() {
    var r = S.route, app = document.getElementById('ys'), tx = r.texts || {};
    app.replaceChildren(); S.B = null;
    var page = el('div', 'ys-page');
    var bg = el('div', 'ys-bgwrap'), stage = el('div', 'ys-stage'), img = el('img', 'ys-master');
    var M = pickMaster(r, window.innerHeight / window.innerWidth > 1.25);
    img.alt = ''; img.src = imgSrc(S.base, M.src);
    stage.appendChild(img); bg.appendChild(stage); page.appendChild(bg);
    var dim = el('div', 'ys-dim');
    dim.style.setProperty('--ys-dim', Math.max(0, Math.min(95, r.dimTop == null ? 60 : +r.dimTop)) / 100);
    page.appendChild(dim);

    var back = el('a', 'ys-back', tx.back || '← Вернуться на витрину');
    back.href = S.base || '../../';
    page.appendChild(back);

    var n = curDay(), last = daysCount(r), opened = openedList().indexOf(n) >= 0;
    var bricks = !!M.zone && n >= 1;
    var hud = el('div', 'ys-hud');
    var ctx = ctxOf(r, Math.max(1, Math.min(last, n)));
    if (n === 0) {
      hud.appendChild(el('h1', 'ys-h', fill(tx.before || 'Маршрут скоро начнётся', ctx)));
      if (tx.beforeNote) hud.appendChild(el('p', 'ys-sub', fill(tx.beforeNote, ctx)));
    } else if (n > last) {
      hud.appendChild(el('h1', 'ys-h', fill(tx.after || 'Маршрут пройден', ctx)));
      if (tx.afterNote) hud.appendChild(el('p', 'ys-sub', fill(tx.afterNote, ctx)));
    } else {
      hud.appendChild(el('p', 'ys-sub', fill(tx.today || 'Сегодня — день {день}', ctx)));
      if (bricks) { if (!opened) hud.appendChild(el('p', 'ys-tap', fill(tx.tap || 'Коснитесь светящегося камня', ctx))); }
      else {
        // Нет разметки кирпичей для этой картинки — Карта дня открывается кнопкой
        var go = el('button', 'ys-go', tx.openDay || 'Карта дня');
        go.type = 'button';
        go.addEventListener('click', function () { markOpened(n); openDay(n, S.mode); });
        hud.appendChild(go);
      }
    }
    page.appendChild(hud);
    app.appendChild(page);
    if (S.debug) app.appendChild(debugPanel());

    function build() {
      stageFit(stage, img);
      if (!bricks || S.B || !img.naturalWidth) return;
      var iw = img.naturalWidth, ih = img.naturalHeight, g = r.glow || {};
      var B = S.B = bricksLayer(r, M.zone, iw, ih, { color: g.color, dusk: Math.max(0, Math.min(90, g.dusk == null || g.dusk === '' ? 35 : +g.dusk)) / 100, zones: S.zonesOn });
      B.paint(lights(r, n, opened));
      stage.appendChild(B.node);
      // Большая невидимая кнопка на сегодняшнем кирпиче (на телефоне плиты внутренних витков маленькие), после конца — на центре
      var hd = n <= last ? n : last;
      var hp = hd === last ? { x: B.center.cx, y: B.center.cy } : B.trace[(2 * hd - 1) * SPAN];
      var hit = el('button', 'ys-hit' + (hd === last ? ' ys-hit--c' : ''));
      hit.type = 'button';
      hit.setAttribute('aria-label', n > last ? 'Солнце в центре' : 'Открыть день ' + hd);
      hit.style.left = (hp.x / iw * 100) + '%'; hit.style.top = (hp.y / ih * 100) + '%';
      hit.addEventListener('click', function (e) { e.stopPropagation(); tapDay(hd); });
      stage.appendChild(hit);
      stage.addEventListener('click', function (e) {
        var rc = stage.getBoundingClientRect(), k = iw / rc.width;
        var d = hitDay(B, (e.clientX - rc.left) * k, (e.clientY - rc.top) * k, last, 10 * k, hd, 30 * k);
        if (d) tapDay(d);
      });
    }
    img.addEventListener('load', build);
    if (img.complete) build();
    window.onresize = function () {
      if (pickMaster(r, window.innerHeight / window.innerWidth > 1.25).src !== M.src) { render(); return; }
      if (img.complete) stageFit(stage, img);
    };
  }
  // Режим проверки: ?debug=1 — спираль на любой день, все пройдены, центр, финал, сброс; любая карта в любом формате.
  function debugPanel() {
    var r = S.route, box = el('div', 'ys-debug' + (S.dbgMin ? ' is-min' : '')), last = daysCount(r);
    var head = el('button', 'ys-debug-h', 'Проверка ▾'); head.type = 'button';
    var body = el('div', 'ys-debug-b');
    head.addEventListener('click', function () { S.dbgMin = !S.dbgMin; box.classList.toggle('is-min', S.dbgMin); });
    function sel(opts, val) { var s = el('select'); opts.forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; s.appendChild(op); }); s.value = val; return s; }
    function btn(t, f) { var b = el('button', null, t); b.type = 'button'; b.addEventListener('click', f); return b; }
    function row(kids) { var d = el('div', 'ys-debug-row'); kids.forEach(function (k) { d.appendChild(k); }); return d; }
    var real = dayNumber(r, nowMsk(S.debugNow)), now = curDay(), i;
    var spOpts = [['', 'Спираль — как сейчас (по дате)'], ['0', 'Спираль — до начала']];
    for (i = 1; i <= last; i++) spOpts.push([String(i), 'Спираль — день ' + i + (i === last ? ' (центр)' : '') + ' · ' + dateOf(r, i)]);
    spOpts.push([String(last + 1), 'Спираль — все пройдены']);
    var ss = sel(spOpts, S.sim == null ? '' : String(S.sim));
    ss.addEventListener('change', function () { S.sim = ss.value === '' ? null : +ss.value; render(); });
    var zl = el('label', 'ys-debug-chk'), zc = el('input'); zc.type = 'checkbox'; zc.checked = S.zonesOn;
    zc.addEventListener('change', function () { S.zonesOn = zc.checked; render(); });
    zl.appendChild(zc); zl.appendChild(document.createTextNode(' Показать разметку кирпичей'));
    var days = []; for (i = 1; i <= last; i++) days.push([String(i), 'День ' + i + ' · ' + dateOf(r, i)]);
    var sd = sel(days, String(Math.max(1, Math.min(last, now || 1))));
    var sm = sel(MODES.map(function (m) { return [m, MODE_NAMES[m]]; }), S.mode);
    sm.addEventListener('change', function () { S.mode = sm.value; });
    var sp = sel((r.permissions || []).map(function (p, k) { return [String(k), (k + 1) + '. ' + (p.title || '')]; }), '0');
    [el('span', null, 'Сейчас по Москве: ' + (S.debugNow ? S.debugNow + ' (подмена)' : 'настоящее время') + ' · ' + (real === 0 ? 'до начала' : real > last ? 'после конца' : 'день ' + real)),
      ss, zl,
      row([btn('Финал Солнца', openFinal), btn('Сброс', function () { resetOpened(); S.sim = null; render(); note('Сброшено: спираль по настоящей дате, сегодняшний кирпич снова зовёт.'); })]),
      el('span', 'ys-debug-sep', 'Формат и карты'),
      sm, sd, sp,
      row([btn('Карта дня', function () { openDay(+sd.value, sm.value); }),
        btn('Личная карта', function () { if (sm.value === 'observation') { note('У Наблюдения личной карты нет — выберите Путешествие или Погружение.'); return; } openPersonal(+sd.value, sm.value, (r.permissions || [])[+sp.value]); })])
    ].forEach(function (x) { body.appendChild(x); });
    box.appendChild(head); box.appendChild(body);
    return box;
  }
  function useRoute(route) {
    S.route = route;
    var m = q('mode'); S.mode = MODES.indexOf(m) >= 0 ? m : 'observation';
    if (route.title) document.title = '13 MIRRORS · ' + route.title;
    render();
    var c = q('card'), n = +q('day') || 1;
    if (c === 'day') openDay(n, S.mode);
    if (c === 'personal') openPersonal(n, S.mode, (route.permissions || [])[+q('perm') || 0]);
  }
  function boot() {
    var app = document.getElementById('ys'); if (!app) return;
    S.base = app.getAttribute('data-base') || '../../';
    S.debug = q('debug') === '1'; S.debugNow = q('debugNow'); S.preview = q('preview') === '1';
    var sim = q('sim'); if (sim != null && sim !== '' && !isNaN(+sim)) S.sim = +sim;
    S.zonesOn = q('zones') === '1';
    var id = app.getAttribute('data-route');
    // Предпросмотр из панели: черновик приходит сообщением (как у Гримуара)
    if (S.preview) {
      window.addEventListener('message', function (e) {
        if (e.origin !== location.origin || !e.data || !e.data.m13journey) return;
        S.base = e.data.base || S.base;
        closeLayer(); useRoute(e.data.m13journey);
      });
      try { window.parent.postMessage({ m13journeyReady: true }, location.origin); } catch (e) {}
      return;
    }
    fetch(S.base + 'data/journeys.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(function (j) {
      var route = (j.items || []).filter(function (x) { return x.id === id; })[0];
      if (!route) throw new Error();
      useRoute(route);
    }).catch(function () {
      app.replaceChildren(el('p', 'ys-err', 'Не удалось загрузить маршрут. Обновите страницу через минуту.'));
    });
  }

  window.M13R = { card: card, fill: fill, ctxOf: ctxOf, tokens: tokens, dateOf: dateOf, dayNumber: dayNumber, nowMsk: nowMsk,
    spiralSVG: spiralSVG, MODES: MODES, MODE_NAMES: MODE_NAMES, boot: boot,
    trace: trace, bricksLayer: bricksLayer, lights: lights, PATH_DAYS: PATH_DAYS, SPAN: SPAN, finalSunLayer: finalSunLayer };
})();
