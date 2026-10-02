/* 13 MIRRORS · страница маршрута по дням (первым — «Жёлтое Солнце»).
   Данные — data/journeys.json (настраиваются в панели: «Страницы маршрутов»).
   Здесь же — Карта дня и личная карта: их рисует и сама страница, и панель (предпросмотр).
   Этап 1: фон-спираль, экран ожидания, Карта дня. Этап 2: кирпичи на спирали (свет, импульс к центру), путь Наблюдателя, режим проверки ?debug=1.
   Этап 3: ключ → калейдоскоп → личный код, колода, выбор карты (круг закрытых карт), личная карта.
   С 02.10: колода-колесо (13 карт: ось, спица, обод, изнанка), вход: ключ → 3 состояния → калейдоскоп (assets/kaleido.js, 12 лучей) → код со состояниями. */
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
  // Колода-колесо: 13 карт { id, quality, axis, less: { rim, spoke }, more: { spoke, rim }, image }
  function cardsOf(route) { return ((route.deck || {}).cards) || []; }
  // Метки карты и откуда берётся значение. Значение ставится с маленькой буквы; {Качество} с большой — с большой.
  var CARD_TOKENS = [['качество', function (k) { return k.quality; }], ['ось', function (k) { return k.axis; }],
    ['обод-мало', function (k) { return (k.less || {}).rim; }], ['спица-мало', function (k) { return (k.less || {}).spoke; }],
    ['спица-много', function (k) { return (k.more || {}).spoke; }], ['обод-много', function (k) { return (k.more || {}).rim; }]];
  function low(s) { s = String(s || ''); return s && s.charAt(1) !== s.charAt(1).toUpperCase() ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  // Метки: {день}, {дата}, {кин}, {имя кина}, {печать}, {тон}, {что делаем}, {среда}; у личной карты — метки карты (CARD_TOKENS).
  function ctxOf(route, n, k) {
    var d = dayOf(route, n), c = {
      'день': String(n), 'дата': dateOf(route, n), 'кин': d.kin == null ? '' : String(d.kin),
      'имя кина': d.kinName || '', 'печать': d.seal || '', 'тон': d.tone || '',
      'что делаем': d.cardOperation || '', 'среда': d.environment || ''
    };
    if (k) CARD_TOKENS.forEach(function (t) { c[t[0]] = low(t[1](k)); });
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
    var t = ['день', 'дата', 'кин', 'имя кина', 'печать', 'тон', 'что делаем', 'среда'];
    return { day: t, card: CARD_TOKENS.map(function (x) { return x[0]; }) };
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

  /* ---------- Лицо карты — колесо ----------
     В центре ось (качество вместе с противовесом), через неё линия «слишком мало ↔ слишком много»;
     по сторонам — спица (ближе) и обод (дальше). За кругом — изнанка: общая для всех карт.
     Названия зон и подписи — route.deck (zones, sides, underside); пусто — как здесь. */
  var ZONE_DEF = { axis: 'Ось', spoke: 'Спица', rim: 'Обод', underside: 'Изнанка' };
  function zoneName(route, z) { var Z = (route.deck || {}).zones || {}; return Z[z] || ZONE_DEF[z]; }
  function wheelNode(route, k, o) {
    var D = route.deck || {}, sd = D.sides || {}, box = el('div', 'ys-wheel');
    if (!k) k = { quality: 'Качество', axis: 'Качество и его противовес', less: { rim: 'обод', spoke: 'спица' }, more: { spoke: 'спица', rim: 'обод' } };
    if (k.image) {
      var img = el('img', 'ys-w-img'); img.src = imgSrc(o && o.base, k.image); img.alt = k.quality || ''; box.appendChild(img); box.classList.add('has-img');
      return box;
    }
    box.appendChild(el('p', 'ys-w-q', k.quality || ''));
    var w = el('div', 'ys-w-box');
    var rays = '', i, a;
    for (i = 0; i < 24; i++) { a = i / 24 * Math.PI * 2; rays += '<line x1="' + r1(50 + 17.6 * Math.cos(a)) + '" y1="' + r1(50 + 17.6 * Math.sin(a)) + '" x2="' + r1(50 + 29.6 * Math.cos(a)) + '" y2="' + r1(50 + 29.6 * Math.sin(a)) + '"/>'; }
    w.innerHTML = '<svg class="ys-w-svg" viewBox="0 0 100 100" aria-hidden="true"><defs>' +
      '<radialGradient id="yswa" cx="50%" cy="46%" r="55%"><stop offset="0" stop-color="#fff2c4" stop-opacity=".5"/><stop offset=".7" stop-color="#ffcf5a" stop-opacity=".2"/><stop offset="1" stop-color="#ffcf5a" stop-opacity=".08"/></radialGradient>' +
      '<radialGradient id="ysws" cx="50%" cy="50%" r="50%"><stop offset=".55" stop-color="#d98a2a" stop-opacity=".16"/><stop offset="1" stop-color="#d98a2a" stop-opacity=".05"/></radialGradient>' +
      '<radialGradient id="yswr" cx="50%" cy="50%" r="50%"><stop offset=".7" stop-color="#a8402a" stop-opacity=".1"/><stop offset="1" stop-color="#a8402a" stop-opacity=".3"/></radialGradient></defs>' +
      '<circle cx="50" cy="50" r="42" fill="url(#yswr)" stroke="#e9c77e" stroke-opacity=".75" stroke-width=".5"/>' +
      '<circle cx="50" cy="50" r="29.8" fill="url(#ysws)" stroke="#e9c77e" stroke-opacity=".55" stroke-width=".4"/>' +
      '<g stroke="#e9c77e" stroke-opacity=".12" stroke-width=".3">' + rays + '</g>' +
      '<circle cx="50" cy="50" r="17.6" fill="url(#yswa)" stroke="#ffd76a" stroke-opacity=".8" stroke-width=".5"/>' +
      '<g stroke="#ffd76a" stroke-opacity=".6" stroke-width=".35" fill="none" stroke-linecap="round"><line x1="50" y1="5.5" x2="50" y2="32"/><line x1="50" y1="68" x2="50" y2="94.5"/>' +
      '<path d="M48.4 7.6 L50 5.5 L51.6 7.6"/><path d="M48.4 92.4 L50 94.5 L51.6 92.4"/></g></svg>';
    function lab(cls, t) { var x = el('span', cls, t || ''); w.appendChild(x); return x; }
    lab('ys-w-side ys-w-side--more', sd.more || 'слишком много');
    lab('ys-w-word ys-w-rim ys-w-top', (k.more || {}).rim);
    lab('ys-w-word ys-w-spoke ys-w-top', (k.more || {}).spoke);
    var ax = el('div', 'ys-w-axis'); ax.appendChild(el('small', null, zoneName(route, 'axis'))); ax.appendChild(el('b', null, k.axis || k.quality || '')); w.appendChild(ax);
    lab('ys-w-word ys-w-spoke ys-w-bot', (k.less || {}).spoke);
    lab('ys-w-word ys-w-rim ys-w-bot', (k.less || {}).rim);
    lab('ys-w-side ys-w-side--less', sd.less || 'слишком мало');
    lab('ys-w-zone ys-w-zl ys-w-z-spoke', zoneName(route, 'spoke')); lab('ys-w-zone ys-w-zr ys-w-z-spoke', zoneName(route, 'spoke'));
    lab('ys-w-zone ys-w-zl ys-w-z-rim', zoneName(route, 'rim')); lab('ys-w-zone ys-w-zr ys-w-z-rim', zoneName(route, 'rim'));
    lab('ys-w-zone ys-w-under ys-w-under--tl', zoneName(route, 'underside')); lab('ys-w-zone ys-w-under ys-w-under--br', zoneName(route, 'underside'));
    box.appendChild(w);
    var uq = D.undersideQ == null ? 'кто цепляет? → а нет ли этого во мне?' : D.undersideQ;
    if (uq) { var u = el('p', 'ys-w-uq'); u.appendChild(el('b', null, zoneName(route, 'underside') + ': ')); u.appendChild(document.createTextNode(uq)); box.appendChild(u); }
    return box;
  }
  // Путь назад в ось — по зонам колеса (route.deck.wayBack)
  function wayBackNode(route, b) {
    var wb = (route.deck || {}).wayBack || {}, list = el('ul', 'ys-wb-l'), any = false;
    ['axis', 'spoke', 'rim', 'underside'].forEach(function (z) {
      if (!wb[z]) return; any = true;
      var li = el('li'); li.appendChild(el('b', null, zoneName(route, z))); li.appendChild(document.createTextNode(' — ' + wb[z])); list.appendChild(li);
    });
    if (!any) return null;
    var box = el('div', 'ys-c-text ys-wb');
    box.appendChild(el('span', 'ys-c-label', b.label == null ? 'Путь назад в ось' : b.label));
    box.appendChild(list);
    return box;
  }

  /* ---------- Карта дня и личная карта ----------
     kind: 'day' | 'personal'; mode: observation | journey | immersion; perm — выпавшая карта колоды (для личной).
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
    // Лицо выпавшей карты — колесо ('permission' — старое название блока)
    if (b.kind === 'wheel' || b.kind === 'permission') return wheelNode(route, perm, o);
    if (b.kind === 'wayback') return wayBackNode(route, b);
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
     { path: [[x, y, ox, oy] × 25], center: {x, y, rx, ry}, width: 100 }. x, y — доли картинки; ox, oy — от середины плиты
     до её внешнего края поперёк витка (доли ширины и высоты картинки: сзади витки сжаты перспективой, по бокам — нет);
     старый вид [x, y, w] — ширина w по линии к центру. width — общая толщина подсветки в %. Точки 0, 2 … 24 — стыки дней, 1, 3 … 23 — середины: день d идёт от точки 2(d−1) до 2d.
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
    var P = z.path.slice(0, n + 1).map(function (p) {
      return p.length >= 4 ? [p[0] * iw, p[1] * ih, p[2] * iw * k, p[3] * ih * k] : [p[0] * iw, p[1] * ih, (p[2] || .02) * iw * k, null];
    });
    var C = { x: z.center.x * iw, y: z.center.y * ih };
    for (i = 0; i < n; i++) {
      a = P[i - 1] || P[i]; b = P[i]; c = P[i + 1]; d = P[i + 2] || P[i + 1];
      for (s = 0; s < SPAN || (i === n - 1 && s === SPAN); s++) {
        t = s / SPAN;
        var q = { x: cr(a[0], b[0], c[0], d[0], t), y: cr(a[1], b[1], c[1], d[1], t), day: Math.min(PATH_DAYS, Math.floor(i / 2) + 1) };
        if (b[3] != null && c[3] != null) { q.ox = cr(a[2], b[2], c[2], d[2], t); q.oy = cr(a[3], b[3], c[3], d[3], t); }
        else {
          // Старая разметка: поперёк витка — по линии к центру (так полоса не заворачивается на крутых изгибах)
          var h = (b[2] + (c[2] - b[2]) * t) / 2, l = dist(q, C) || 1;
          q.ox = (q.x - C.x) / l * h; q.oy = (q.y - C.y) / l * h;
        }
        q.w = 2 * Math.sqrt(q.ox * q.ox + q.oy * q.oy);
        out.push(q);
      }
    }
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
      L.push(r1(p.x + p.ox * f) + ',' + r1(p.y + p.oy * f)); R.unshift(r1(p.x - p.ox * f) + ',' + r1(p.y - p.oy * f));
    });
    return 'M' + L.join('L') + 'L' + R.join('L') + 'Z';
  }
  function xy(p) { return r1(p.x) + ',' + r1(p.y); }
  // Цвет свечения дня d: свой у дня (days[d−1].glowColor) или общий glow.color.
  function hexOk(c) { return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c || ''); }
  function dayColor(route, d, base) {
    var day = (route.days || [])[d - 1], g = route.glow || {};
    return day && hexOk(day.glowColor) ? day.glowColor : hexOk(base) ? base : hexOk(g.color) ? g.color : '#ffcf5a';
  }
  // Цвет печати Dreamspell по Kin (красный, белый, синий, жёлтый по кругу); нет Kin — по названию печати. Для кнопки в панели.
  var SEAL_GLOW = ['#ff5a3c', '#fff1dc', '#4f9dff', '#ffcf5a'];
  function sealColor(day) {
    var k = day && +day.kin, s = String(day && (day.seal || day.kinName) || '').toLowerCase();
    if (k >= 1) return SEAL_GLOW[((k - 1) % 20) % 4];
    if (/красн/.test(s)) return SEAL_GLOW[0];
    if (/бел/.test(s)) return SEAL_GLOW[1];
    if (/син/.test(s)) return SEAL_GLOW[2];
    if (/ж[её]лт/.test(s)) return SEAL_GLOW[3];
    return '';
  }
  // Сила свечения: 100 % — как было в начале, больше — ярче и шире ореол
  function glowPower(route) { var g = route.glow || {}; return Math.max(50, Math.min(300, g.power == null || g.power === '' ? 150 : +g.power)) / 100; }
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
    var B = { id: id, iw: iw, ih: ih, trace: tr, color: hexOk(o.color) ? o.color : '#ffcf5a', center: { cx: c.x * iw, cy: c.y * ih, rx: c.rx * iw, ry: c.ry * ih } };
    var vb = ' viewBox="0 0 ' + iw + ' ' + ih + '" preserveAspectRatio="none" aria-hidden="true"';
    var soft = r1(iw * .006), halo = r1(iw * .012), last = daysCount(route), shapes = [];
    var box = el('div', 'ys-bricks');
    var svgs = ['ys-l-dusk', 'ys-l-glow', 'ys-l-today', 'ys-l-pulse', 'ys-l-zones'].map(function (cls) {
      box.insertAdjacentHTML('beforeend', '<svg class="' + cls + '"' + vb + '></svg>');
      return box.lastChild;
    });
    for (var d = 1; d <= last; d++) shapes[d] = d === last ? null : ribbonPath(daySlice(tr, d), 1);
    B.colorOf = function (d) { return dayColor(route, d, B.color); };
    var P = o.power == null ? glowPower(route) : o.power, bloom = r1(iw * .03);
    function shape(d, attrs, grow) {
      var C = B.center, g = grow || 1;
      return d === last ? '<ellipse cx="' + r1(C.cx) + '" cy="' + r1(C.cy) + '" rx="' + r1(C.rx * g) + '" ry="' + r1(C.ry * g) + '" ' + attrs + '/>' : '<path d="' + shapes[d] + '" ' + attrs + '/>';
    }
    function filt(name, sd, all) {
      // all — широкий ореол: область фильтра на всю картинку, иначе размытие обрежется у краёв полосы
      return '<filter id="' + id + name + '"' + (all ? ' filterUnits="userSpaceOnUse" x="0" y="0" width="' + iw + '" height="' + ih + '"' : ' x="-30%" y="-30%" width="160%" height="160%"') + '><feGaussianBlur stdDeviation="' + sd + '"/></filter>';
    }
    // Сила P: ярче сама полоса и сердцевина; больше 100 % — ещё широкий ореол (bloom) вокруг светящихся камней
    function op(x) { return Math.min(1, x).toFixed(2); }
    B.paint = function (st) {
      var holes = '', glow = '', wide = '', today = '', todayWide = '', col, d, lv, pb = Math.max(0, P - 1);
      for (d = 1; d <= last; d++) {
        lv = st.lv[d] || 0; col = B.colorOf(d);
        holes += shape(d, 'fill="#000" fill-opacity="' + Math.min(1, lv * 1.5).toFixed(2) + '"');
        if (d === st.today && st.calling) {
          today += shape(d, 'fill="' + col + '"' + (P < 1 ? ' fill-opacity="' + op(P) + '"' : '')) + shape(d, 'fill="#fff4cf" fill-opacity="' + op(.55 * Math.sqrt(P)) + '"', .6);
          if (pb) todayWide += shape(d, 'fill="' + col + '" fill-opacity="' + op(.5 * pb) + '"', 1.15);
        } else if (lv > 0) {
          glow += shape(d, 'fill="' + col + '" fill-opacity="' + op(lv * .62 * Math.min(P, 1.6)) + '"');
          if (pb) wide += shape(d, 'fill="' + col + '" fill-opacity="' + op(lv * .45 * pb) + '"', 1.15);
        }
      }
      // После конца маршрута в центре — Солнце (заглушка): большой мягкий диск
      if (st.after) glow += shape(last, 'fill="' + B.color + '" fill-opacity=".55"', 1.9) + shape(last, 'fill="#fff4cf" fill-opacity=".7"', .9);
      svgs[0].innerHTML = '<defs>' + filt('s', soft) + '<mask id="' + id + 'm" maskUnits="userSpaceOnUse" x="0" y="0" width="' + iw + '" height="' + ih + '">' +
        '<rect width="' + iw + '" height="' + ih + '" fill="#fff"/><g filter="url(#' + id + 's)">' + holes + '</g></mask></defs>' +
        '<rect width="' + iw + '" height="' + ih + '" fill="#070402" fill-opacity="' + (o.dusk == null ? .35 : o.dusk) + '" mask="url(#' + id + 'm)"/>';
      svgs[1].innerHTML = '<defs>' + filt('h', halo) + filt('w', bloom, 1) + '</defs>' + (wide ? '<g filter="url(#' + id + 'w)">' + wide + '</g>' : '') + '<g filter="url(#' + id + 'h)">' + glow + '</g>';
      svgs[2].innerHTML = today ? '<defs>' + filt('t', halo) + filt('tw', bloom, 1) + '</defs>' + (todayWide ? '<g filter="url(#' + id + 'tw)">' + todayWide + '</g>' : '') + '<g filter="url(#' + id + 't)">' + today + '</g>' : '';
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
    var tr = B.trace, C = B.center, svg = B.pulse, iw = B.iw, col = B.colorOf ? B.colorOf(d) : B.color, fid = B.id + 'p';
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

  /* ---------- Личный код и колода ----------
     Ключ (слово из группы) проверяется в браузере: на сайте лежит только его отпечаток — SHA-1 от «m13|<маршрут>|ключ»
     (ключ строчными, без пробелов, ё → е; панель считает так же). Подошёл ключ → человек выбирает 3 состояния из 12 →
     один раз случайное число seed → личный код вида ИСКРА-7ЖК-4Б2: слово + 6 знаков = 34 бита:
     seed (16) · формат (1 — Погружение) · состояния (8: номер тройки из 220) · проверка (9, от маршрута, первого дня, формата, seed и состояний).
     Состояния живут только в коде — сервера нет. Из кода считаются колода (день d → карта deck[d − 1]) и узор калейдоскопа —
     на любом устройстве одинаково. Что человек нажал в круге карт, на результат не влияет (вариант А, «колода нашей жизни»).
     Порядок состояний и карт в панели после выдачи кодов не менять: номера в коде — по этому порядку. */
  var CODE_ABC = 'АБВГДЕЖИКЛМНПРСТУФХЦШЭЮЯ23456789';
  var CODE_WORDS = ['СОЛНЦЕ', 'ЛУЧ', 'ЗАРЯ', 'СВЕТ', 'ИСКРА', 'ПЛАМЯ', 'ЯНТАРЬ', 'ЗОЛОТО', 'РАССВЕТ', 'ПОЛДЕНЬ', 'ВОСХОД', 'ОГОНЬ', 'КОЛОС', 'ЖАР', 'СИЯНИЕ', 'ТЕПЛО'];
  var LAT = { A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У' };
  var TAIL = 6, P30 = 1073741824;
  function h32(s) {
    var h = 0x811c9dc5 ^ s.length, i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6d2b79f5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // Тройки состояний из 12: номер 0…219 ↔ [a, b, c] (a < b < c — номера в списке состояний)
  var TRIPLES = (function () { var l = [], a, b, c; for (a = 0; a < 12; a++) for (b = a + 1; b < 12; b++) for (c = b + 1; c < 12; c++) l.push([a, b, c]); return l; })();
  function tripleNo(st) {
    var x = (st || []).slice().sort(function (a, b) { return a - b; }).join(',');
    for (var i = 0; i < TRIPLES.length; i++) if (TRIPLES[i].join(',') === x) return i;
    return -1;
  }
  function statesOf(route) { return ((route.states || {}).items) || []; }
  function codeCheck(route, mode, seed, st) { return h32('m13code|' + route.id + '|' + (route.start || '') + '|' + mode + '|' + seed + '|' + st) & 511; }
  function makeCode(route, mode, seed, st) {
    seed = seed & 0xffff; st = st >= 0 && st < TRIPLES.length ? st : 0;
    var raw = ((seed * 2 + (mode === 'immersion' ? 1 : 0)) * 256 + st) * 512 + codeCheck(route, mode, seed, st), tail = raw % P30, s = '', i;
    for (i = TAIL - 1; i >= 0; i--) s += CODE_ABC.charAt(Math.floor(tail / Math.pow(32, i)) % 32);
    return CODE_WORDS[Math.floor(raw / P30)] + '-' + s.slice(0, 3) + '-' + s.slice(3);
  }
  // states — номера трёх состояний (по порядку в панели); нет — случайные (тестовый код)
  function newCode(route, mode, states) {
    var seed = Math.floor(Math.random() * 65536), st = tripleNo(states);
    try { seed = crypto.getRandomValues(new Uint16Array(1))[0]; } catch (e) {}
    if (st < 0) st = Math.floor(Math.random() * TRIPLES.length);
    return readCode(route, makeCode(route, mode, seed, st));
  }
  // Код из того, что набрал человек: регистр, пробелы, дефисы, латинские двойники (C, O, X…), ё/й, З вместо 3 — не важны.
  // Неверный код (опечатка) — null: проверка не сходится.
  function readCode(route, input) {
    var s = String(input || '').toUpperCase().replace(/Ё/g, 'Е').replace(/Й/g, 'И').replace(/[ABCEHKMOPTXY]/g, function (c) { return LAT[c]; }).replace(/[^А-Я0-9]/g, '');
    for (var w = 0; w < CODE_WORDS.length; w++) {
      var W = CODE_WORDS[w]; if (s.length !== W.length + TAIL || s.indexOf(W) !== 0) continue;
      var tail = s.slice(W.length).replace(/З/g, '3'), t = 0, i, k;
      for (i = 0; i < TAIL; i++) { k = CODE_ABC.indexOf(tail.charAt(i)); if (k < 0) return null; t = t * 32 + k; }
      var raw = w * P30 + t, chk = raw % 512, rest = Math.floor(raw / 512), st = rest % 256, ms = Math.floor(rest / 256);
      var mode = ms % 2 ? 'immersion' : 'journey', seed = Math.floor(ms / 2);
      if (st >= TRIPLES.length || chk !== codeCheck(route, mode, seed, st)) return null;
      return { code: W + '-' + tail.slice(0, 3) + '-' + tail.slice(3), mode: mode, seed: seed, states: TRIPLES[st].slice() };
    }
    return null;
  }
  // Порядок карт колоды у человека: перемешаны один раз — от кода. Порядок карт в панели после выдачи кодов не менять.
  function deckOf(route, c) {
    var n = cardsOf(route).length, a = [], i, j, t, R = rng(h32('m13deck|' + route.id + '|' + (route.start || '') + '|' + c.mode + '|' + c.seed));
    for (i = 0; i < n; i++) a.push(i);
    for (i = n - 1; i > 0; i--) { j = Math.floor(R() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // Карта дня d по коду. 13 карт на 12 дней: последняя в колоде остаётся закрытой, ей ничего не придаём.
  function cardFor(route, c, d) { var dk = c ? deckOf(route, c) : []; return dk.length ? cardsOf(route)[dk[(d - 1) % dk.length]] : null; }

  // Ключ → формат ('journey' | 'immersion' | ''). SHA-1 — браузерный, а где его нет (страница не по https) — свой.
  function keyNorm(k) { return String(k || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ''); }
  function sha1js(bytes) {
    var n = bytes.length, words = ((n + 8) >> 6) + 1, w = [], i, j, x = [];
    for (i = 0; i < words * 16; i++) w[i] = 0;
    for (i = 0; i < n; i++) w[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
    w[n >> 2] |= 0x80 << (24 - (n % 4) * 8);
    w[words * 16 - 1] = (n * 8) >>> 0;
    var H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
    function rol(v, s) { return (v << s) | (v >>> (32 - s)); }
    for (i = 0; i < w.length; i += 16) {
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f, k, t;
      for (j = 0; j < 80; j++) {
        x[j] = j < 16 ? w[i + j] : rol(x[j - 3] ^ x[j - 8] ^ x[j - 14] ^ x[j - 16], 1);
        if (j < 20) { f = (b & c) | (~b & d); k = 0x5a827999; } else if (j < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
        else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; } else { f = b ^ c ^ d; k = 0xca62c1d6; }
        t = (rol(a, 5) + f + e + k + x[j]) | 0; e = d; d = c; c = rol(b, 30); b = a; a = t;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0;
    }
    return H.map(function (h) { return ('0000000' + (h >>> 0).toString(16)).slice(-8); }).join('');
  }
  function sha1Hex(str) {
    var bytes = new TextEncoder().encode(str);
    if (!(window.crypto && crypto.subtle && crypto.subtle.digest)) return Promise.resolve(sha1js(bytes));
    return crypto.subtle.digest('SHA-1', bytes).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }
  function keyMode(route, input) {
    var k = keyNorm(input), keys = route.keys || {};
    if (!k) return Promise.resolve('');
    return sha1Hex('m13|' + route.id + '|' + k).then(function (h) { return keys.journey && keys.journey === h ? 'journey' : keys.immersion && keys.immersion === h ? 'immersion' : ''; });
  }

  /* ---------- Калейдоскоп: живой узор (assets/kaleido.js, window.M13K) ----------
     12 лучей (6 пар зеркал). Общий узор маршрута — из h32('m13kal|' + id), самоцветы свои у узора.
     Личный — из h32('m13kal|' + код): стёклышки — три состояния входа (цвета — route.states, панель).
     Стиль — route.kaleido.style: 'rose' витраж-роза, 'gems' самоцветы, 'mix' роза с самоцветами. */
  function hexRgb(h) {
    h = String(h || '').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&');
    var n = parseInt(h, 16); return isNaN(n) || h.length !== 6 ? [255, 207, 90] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function kalStyle(route) { var s = (route.kaleido || {}).style; return s === 'rose' || s === 'gems' || s === 'mix' ? s : 'mix'; }
  function kalSeed(c) { return h32('m13kal|' + (c && c.code ? c.code : String(c || ''))); }
  function routeSeed(route) { return h32('m13kal|' + route.id); }
  /* ---------- Стёклышки узора ----------
     Узор человека = три состояния входа (из кода) + стёклышко каждого наступившего дня 1…12 (у всех, пропуск не важен)
     + подарки Проводника (слово-подарок; хранится только на этом устройстве). Вид камней — route.glass (панель, вкладка «Стёклышки»):
     glass.states, glass.days, glass.gifts.{axis, spoke, rim, underside} = { kind, cut, color, shine, clear, size, img } (см. kaleido.js, «Камни»).
     Вид в код не зашит — менять можно в любой момент, коды и подарки не ломаются. */
  var GIFT_ZONES = ['axis', 'spoke', 'rim', 'underside'];
  var GLASS_DEF = { states: { kind: 'cabochon' }, days: { kind: 'gem', cut: 'rect' },
    gifts: { axis: { kind: 'gem', cut: 'round' }, spoke: { kind: 'crystal' }, rim: { kind: 'gem', cut: 'tri' }, underside: { kind: 'gem', cut: 'hex' } } };
  // Картинки камней: на странице — от корня сайта (S.base), в панели — '../'
  function glassBase() { return S.route ? S.base : '../'; }
  function glassLook(route, group, zone) {
    var g = route.glass || {}, L = group === 'gifts' ? ((g.gifts || {})[zone] || GLASS_DEF.gifts[zone]) : g[group] || GLASS_DEF[group], o = {}, k;
    for (k in L) o[k] = L[k];
    if (!o.kind) o.kind = (group === 'gifts' ? GLASS_DEF.gifts[zone] : GLASS_DEF[group]).kind;
    if (o.img) o.img = imgSrc(glassBase(), o.img);
    return o;
  }
  function mixW(c, k) { return [Math.round(c[0] + (255 - c[0]) * k), Math.round(c[1] + (255 - c[1]) * k), Math.round(c[2] + (255 - c[2]) * k)]; }
  // Цвет стёклышка дня: свой цвет в «Стёклышках» → цвет камня дня (13 дней) → цвет печати дня
  function dayGlassColor(route, d) {
    var L = (route.glass || {}).days || {}, day = (route.days || [])[d - 1];
    return hexRgb(hexOk(L.color) ? L.color : day && hexOk(day.glowColor) ? day.glowColor : sealColor(day) || dayColor(route, d));
  }
  // Подарок: свой цвет зоны → оттенок дня (ось — светлый, почти прозрачный; спица — светлее; обод — как день; изнанка — дымчатый)
  function giftColor(route, d, z) {
    var L = ((route.glass || {}).gifts || {})[z] || {}, c = dayGlassColor(route, d);
    if (hexOk(L.color)) return hexRgb(L.color);
    return z === 'underside' ? [128, 118, 146] : z === 'axis' ? mixW(c, .62) : z === 'spoke' ? mixW(c, .3) : c;
  }
  function dayGlass(route, d) { return { c: dayGlassColor(route, d), look: glassLook(route, 'days') }; }
  function giftGlass(route, d, z) { return { c: giftColor(route, d, z), look: glassLook(route, 'gifts', z) }; }
  // Сколько дней уже дали стёклышко: наступившие дни 1…12 (день 13 — само Солнце)
  function glassDaysOf(route, n) { return Math.max(0, Math.min(daysCount(route) - 1, n)); }
  // Стёклышки узора. o.days — сколько дней (по умолчанию 0: только состояния), o.gifts — [[день, зона], …]
  function kalEx(route, c, o) {
    o = o || {};
    var L = statesOf(route), glass = [], n = o.days || 0, gifts = o.gifts || [], d;
    if (c && c.states) c.states.forEach(function (i) { if (L[i]) glass.push({ c: hexRgb(L[i].color), look: glassLook(route, 'states') }); });
    function giftsOf(d) { gifts.forEach(function (g) { if (g[0] === d && GIFT_ZONES[g[1]]) glass.push(giftGlass(route, d, GIFT_ZONES[g[1]])); }); }
    for (d = 1; d <= n; d++) { glass.push(dayGlass(route, d)); giftsOf(d); }
    for (d = n + 1; d < daysCount(route); d++) giftsOf(d);
    return glass.length ? { sym: 6, glass: glass } : { sym: 6 };
  }
  // Картинки камней («своя картинка») — загрузить заранее (для «Сохранить узор»)
  function glassImgs(route) {
    var g = route.glass || {}, l = [g.states, g.days].concat(GIFT_ZONES.map(function (z) { return (g.gifts || {})[z]; }));
    return l.filter(function (L) { return L && L.kind === 'image' && L.img; }).map(function (L) { return imgSrc(glassBase(), L.img); });
  }

  /* ---------- Слово-подарок ----------
     Проводник выдаёт в панели («Код участника»): код человека + день + зона → слово вида ДАР-К7М2. Подходит только к этому коду
     (и этому маршруту с этим первым днём). 4 знака = 20 бит: день и зона (6 бит: (день − 1) × 4 + зона) · проверка (14 бит);
     всё перемешано маской от кода, поэтому у разных людей слова разные. Одно и то же (код, день, зона) — всегда одно и то же слово. */
  function giftMask(route, c) { return h32('m13giftmask|' + route.id + '|' + (route.start || '') + '|' + c.code) & 0xfffff; }
  function giftCheck(route, c, p) { return h32('m13gift|' + route.id + '|' + (route.start || '') + '|' + c.code + '|' + p) & 0x3fff; }
  function makeGift(route, c, day, zone) {
    var p = (day - 1) * 4 + zone, v = ((p * 16384) + giftCheck(route, c, p)) ^ giftMask(route, c), s = '', i;
    for (i = 3; i >= 0; i--) s += CODE_ABC.charAt(Math.floor(v / Math.pow(32, i)) % 32);
    return 'ДАР-' + s;
  }
  // Что набрал человек → { day, zone } или null. Регистр, дефис, «ДАР», латинские двойники — не важны.
  function readGift(route, c, input) {
    if (!c) return null;
    var s = String(input || '').toUpperCase().replace(/Ё/g, 'Е').replace(/Й/g, 'И').replace(/[ABCEHKMOPTXY]/g, function (x) { return LAT[x]; }).replace(/[^А-Я0-9]/g, '');
    if (s.length === 7 && s.indexOf('ДАР') === 0) s = s.slice(3);
    if (s.length !== 4) return null;
    s = s.replace(/З/g, '3');
    var v = 0, i, k;
    for (i = 0; i < 4; i++) { k = CODE_ABC.indexOf(s.charAt(i)); if (k < 0) return null; v = v * 32 + k; }
    v = (v ^ giftMask(route, c)) >>> 0;
    var p = Math.floor(v / 16384), day = Math.floor(p / 4) + 1;
    if (p > 47 || day > daysCount(route) - 1 || (v & 0x3fff) !== giftCheck(route, c, p)) return null;
    return { day: day, zone: p % 4 };
  }
  function Kaleido(cv, px, route) { return window.M13K ? window.M13K.Kaleido(cv, px || 0, { style: kalStyle(route || S.route || {}), ex: { sym: 6 } }) : null; }
  // Узор человека сразу (панель «Код участника», «Мой код»)
  // o — какие стёклышки, кроме состояний (см. kalEx)
  function kalShow(cv, px, route, c, o) { var k = Kaleido(cv, px, route); if (k) k.show(kalSeed(c), kalEx(route, c, o)); return k; }
  // Картинка «узор и код» для сохранения: 1080 × 1350 (как пост), узор, код, маршрут.
  function patternImage(route, c, cb, ex) {
    var W = 1080, H = 1350, cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    cv.width = W; cv.height = H;
    function paint() {
      var g = ctx.createRadialGradient(W / 2, 560, 60, W / 2, 560, 900);
      g.addColorStop(0, '#3b250a'); g.addColorStop(1, '#0a0604');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (window.M13K) window.M13K.still(ctx, kalSeed(c), W / 2, 560, 420, kalStyle(route), ex || (S.route === route ? myEx(c) : kalEx(route, c)));
      ctx.textAlign = 'center'; ctx.fillStyle = '#e9c77e';
      ctx.font = '500 30px "Cormorant Garamond", Georgia, serif';
      ctx.fillText(('13 MIRRORS · ' + (route.title || '')).toUpperCase().split('').join(String.fromCharCode(8202)), W / 2, 86);
      ctx.fillText((MODE_NAMES[c.mode] || '').toUpperCase().split('').join(String.fromCharCode(8202)), W / 2, 1080);
      // Код длинный (РАССВЕТ-…-…) — шрифт мельче, чтобы влез в ширину картинки
      var fs = 104; ctx.font = '600 104px "Cormorant Garamond", Georgia, serif';
      while (fs > 60 && ctx.measureText(c.code).width > W - 110) { fs -= 4; ctx.font = '600 ' + fs + 'px "Cormorant Garamond", Georgia, serif'; }
      ctx.fillStyle = '#fff3d6';
      ctx.fillText(c.code, W / 2, 1200);
      cb(cv);
    }
    function fonts() { if (document.fonts && document.fonts.load) document.fonts.load('600 104px "Cormorant Garamond"').then(paint, paint); else paint(); }
    if (window.M13K && window.M13K.preload) window.M13K.preload(glassImgs(route), fonts); else fonts();
  }

  /* ---------- Страница маршрута ---------- */
  // Файл пустой или обрезан (сайт как раз обновлялся, или браузер запомнил такую копию) — ещё раз мимо памяти браузера.
  function getJSON(url, n) {
    n = n || 0;
    return fetch(url, { cache: n ? 'reload' : 'no-cache' }).then(function (r) {
      if (r.status === 404) { var e = new Error(url); e.final = true; throw e; }
      if (!r.ok) throw new Error(url);
      return r.json();
    }).catch(function (e) {
      if (e.final || n >= 3) throw e;
      return new Promise(function (ok) { setTimeout(ok, [0, 1500, 4000][n]); }).then(function () { return getJSON(url, n + 1); });
    });
  }
  function q(name) { var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(location.search); return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null; }
  // sim — день на спирали из режима проверки (0 — до начала, 14 — после конца), zonesOn — показать разметку кирпичей
  // code — личный код человека ({code, mode, seed}) или null
  var S = { route: null, base: '', mode: 'observation', debug: false, debugNow: null, preview: false, sim: null, zonesOn: false, dbgMin: false, B: null, busy: false, code: null };

  function curDay() { return S.sim != null ? S.sim : dayNumber(S.route, nowMsk(S.debugNow)); }
  // Какие дни на этом устройстве уже открывали (сегодняшний кирпич после нажатия светится ровно). Только для света, не для доступа.
  function storeKey() { return 'm13ys-' + S.route.id + '-' + (S.route.start || ''); }
  function openedList() { try { var l = JSON.parse(localStorage.getItem(storeKey()) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function markOpened(n) {
    var l = openedList(); if (l.indexOf(n) >= 0) return;
    l.push(n); try { localStorage.setItem(storeKey(), JSON.stringify(l)); } catch (e) {}
  }
  function resetOpened() { try { localStorage.removeItem(storeKey()); } catch (e) {} }
  // Личный код помнит это устройство; на другом человек вводит свой код (не ключ).
  function codeKey() { return 'm13ys-code-' + S.route.id + '-' + (S.route.start || ''); }
  function loadCode() { try { return readCode(S.route, localStorage.getItem(codeKey()) || ''); } catch (e) { return null; } }
  function saveCode(c) { S.code = c; try { if (c) localStorage.setItem(codeKey(), c.code); else localStorage.removeItem(codeKey()); } catch (e) {} }
  // В какие дни карта уже перевёрнута (выбор окончателен: до 00:00 по кирпичу открывается та же личная карта)
  function pickKey() { return storeKey() + '-pick-' + (S.code ? S.code.code : ''); }
  function pickedList() { try { var l = JSON.parse(localStorage.getItem(pickKey()) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function markPicked(n) { var l = pickedList(); if (l.indexOf(n) < 0) { l.push(n); try { localStorage.setItem(pickKey(), JSON.stringify(l)); } catch (e) {} } }
  function resetPicks() { try { localStorage.removeItem(pickKey()); } catch (e) {} }
  // Подарки ([[день, зона], …]) и дни, чьё стёклышко уже показали («легло в узор»), — у каждого кода свои, только на этом устройстве
  function listOf(key) { try { var l = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function giftKey(c) { return storeKey() + '-gift-' + (c ? c.code : ''); }
  function giftList(c) { return listOf(giftKey(c)).filter(function (g) { return Array.isArray(g) && g.length === 2; }); }
  function addGift(c, g) {
    var l = giftList(c);
    if (l.some(function (x) { return x[0] === g.day && x[1] === g.zone; })) return false;
    l.push([g.day, g.zone]);
    try { localStorage.setItem(giftKey(c), JSON.stringify(l)); } catch (e) {}
    return true;
  }
  function resetGlass() { try { localStorage.removeItem(seenKey()); localStorage.removeItem(giftKey(S.code)); } catch (e) {} }
  function seenKey() { return storeKey() + '-glass-' + (S.code ? S.code.code : ''); }
  function markSeen(n) { var l = listOf(seenKey()); if (l.indexOf(n) < 0) { l.push(n); try { localStorage.setItem(seenKey(), JSON.stringify(l)); } catch (e) {} } }
  // Узор человека сейчас: состояния + стёклышки наступивших дней + подарки на этом устройстве. upto — узор «до дня» (без его стёклышка)
  function myEx(c, upto) { return kalEx(S.route, c, { days: upto != null ? upto : glassDaysOf(S.route, curDay()), gifts: giftList(c) }); }
  function setUrlMode(m) {
    try {
      var s = location.search.replace(/([?&])mode=[^&#]*&?/, '$1').replace(/[?&]$/, '');
      history.replaceState(null, '', location.pathname + s + (s ? '&' : '?') + 'mode=' + m + location.hash);
    } catch (e) {}
  }

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
  // sticky — не закрывается щелчком мимо (вход по ключу); onclose — что остановить при закрытии (калейдоскоп)
  function layer(node, cls, from, sticky) {
    var ov = el('div', 'ys-layer' + (cls ? ' ' + cls : ''));
    if (from) { ov.style.setProperty('--ys-ox', Math.round(from.x) + 'px'); ov.style.setProperty('--ys-oy', Math.round(from.y) + 'px'); }
    ov.appendChild(node);
    ov.addEventListener('click', function (e) { if (e.target === ov && !sticky) closeLayer(ov); });
    document.body.appendChild(ov);
    document.body.classList.add('ys-locked');
    requestAnimationFrame(function () { requestAnimationFrame(function () { ov.classList.add('is-in'); }); });
    return ov;
  }
  function closeLayer(ov) {
    ov = ov || document.querySelector('.ys-layer:not(.is-out)');
    if (!ov) return;
    if (ov.onclose) { ov.onclose(); ov.onclose = null; }
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
      if (!S.code) { openKey(mode); return; }
      // Карта сегодня уже перевёрнута — сразу та же личная карта, нового выбора нет
      if (pickedList().indexOf(n) >= 0) openPersonal(n, mode, cardFor(r, S.code, n));
      else openFan(n, mode);
    } });
    layer(c, 'ys-layer--day', from || centerOffset());
  }
  function openPersonal(n, mode, perm) {
    closeLayer();
    layer(card(S.route, n, mode, 'personal', perm, { base: S.base, onSpiral: function () {
      // Первый раз за этот день — стёклышко дня ложится в узор
      if (S.code && mode !== 'observation' && n < daysCount(S.route) && n <= glassDaysOf(S.route, curDay()) && listOf(seenKey()).indexOf(n) < 0) openGlass(n);
      else closeLayer();
    } }), 'ys-layer--personal');
  }

  /* ---------- Вход по ключу: калейдоскоп → узор и код ----------
     want — формат из адреса (до ввода ключа); show — показать уже полученный код («Мой код»). */
  function copyText(t, ok) {
    function old() {
      var a = el('textarea'); a.value = t; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(a); a.select();
      try { document.execCommand('copy'); ok(); } catch (e) {}
      a.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, old); else old();
  }
  function savePattern(c) {
    patternImage(S.route, c, function (cv) {
      cv.toBlob(function (blob) {
        // Имя файла — латиницей: русские буквы в имени браузер может заменить на «download»
        var TR = 'A B V G D E ZH I K L M N P R S T U F H C SH E YU YA'.split(' '), name = '13mirrors-' + c.code.replace(/[А-Я]/g, function (ch) {
          var i = 'АБВГДЕЖИКЛМНПРСТУФХЦШЭЮЯ'.indexOf(ch); return i < 0 ? ({ О: 'O', Ь: '', З: 'Z', Ч: 'CH', Ы: 'Y' })[ch] || '' : TR[i];
        }) + '.png';
        // Телефон: «Поделиться» → «Сохранить изображение»; компьютер — файл в загрузки
        try {
          var f = new File([blob], name, { type: 'image/png' });
          if (window.matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f] }).catch(function () {}); return; }
        } catch (e) {}
        var a = el('a'); a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      }, 'image/png');
    });
  }
  // Состояния кода словами: «ясность · тревога · интерес»
  function statesText(route, c) { var L = statesOf(route); return ((c && c.states) || []).map(function (i) { return L[i] ? L[i].name : ''; }).filter(Boolean).join(' · '); }
  // Перемешать (при каждом показе — свой порядок, чтобы никакие группы не считывались)
  function shuffled(n) { var a = [], i, j, t; for (i = 0; i < n; i++) a.push(i); for (i = n - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // Выбор трёх состояний: равноправные стёклышки без подписей групп и без толкований. done(список номеров по порядку панели)
  function statesPicker(route, need, done) {
    var tx = route.texts || {}, L = statesOf(route), chosen = [], box = el('div', 'ys-states');
    box.appendChild(el('p', 'ys-key-lead', tx.statesLead || 'Выберите три стёклышка — три состояния, с которыми вы сейчас входите в маршрут.'));
    var wrap = el('div', 'ys-st-list');
    shuffled(L.length).forEach(function (i) {
      var b = el('button', 'ys-st'), dot = el('i', 'ys-st-g'); b.type = 'button';
      dot.style.setProperty('--c', L[i].color || '#ffcf5a');
      b.appendChild(dot); b.appendChild(el('span', null, L[i].name || ''));
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        var k = chosen.indexOf(i);
        if (k >= 0) chosen.splice(k, 1); else if (chosen.length < need) chosen.push(i); else return;
        b.classList.toggle('is-on', k < 0); b.setAttribute('aria-pressed', String(k < 0));
        upd();
      });
      wrap.appendChild(b);
    });
    box.appendChild(wrap);
    var cnt = el('p', 'ys-st-n'), go = el('button', 'ys-key-go', tx.statesGo || tx.keyGo || 'Повернуть калейдоскоп'); go.type = 'button';
    function upd() {
      cnt.textContent = fill(tx.statesCount || 'Выбрано {выбрано} из {нужно}', { 'выбрано': String(chosen.length), 'нужно': String(need) });
      go.disabled = chosen.length !== need; box.classList.toggle('is-full', chosen.length === need);
    }
    go.addEventListener('click', function () { if (chosen.length === need) { go.disabled = true; done(chosen.slice()); } });
    box.appendChild(cnt); box.appendChild(go);
    if (tx.statesNote !== '') box.appendChild(el('p', 'ys-key-note', tx.statesNote || 'Стёклышки войдут в ваш узор. Они хранятся только в вашем коде — больше нигде.'));
    upd();
    return box;
  }
  // Стёклышко крупно над калейдоскопом → уменьшается в центр → калейдоскоп поворачивается и пересобирает узор уже с ним
  function kalWrap(cv) { var w = el('div', 'ys-kal-wrap'), sc = el('canvas', 'ys-drop'); w.appendChild(cv); w.appendChild(sc); return w; }
  function dropGlass(wrap, g, after) {
    var sc = wrap.querySelector('.ys-drop');
    if (window.M13K && window.M13K.stone) window.M13K.stone(sc, g.c, g.look, Math.round((wrap.clientWidth || 300) * .46));
    if (REDUCED) { after(); return; }
    wrap.classList.remove('is-fall'); wrap.classList.add('is-drop');
    setTimeout(function () { wrap.classList.remove('is-drop'); wrap.classList.add('is-fall'); }, 1500);
    setTimeout(after, 1900);
    setTimeout(function () { wrap.classList.remove('is-fall'); }, 2600);
  }
  // «Стёклышко дня легло в ваш узор» — один раз за день, после личной карты (Путешествие, Погружение)
  function openGlass(n) {
    var r = S.route, tx = r.texts || {}, ctx = ctxOf(r, n), c = S.code, box = el('div', 'ys-key ys-glass'), cv = el('canvas', 'ys-kal'), wrap = kalWrap(cv);
    box.appendChild(el('p', 'ys-key-mode', fill(tx.glassSmall || 'День {день} · {имя кина}', ctx)));
    box.appendChild(el('h2', 'ys-key-t', fill(tx.glassDay || 'Стёклышко дня {день} легло в ваш узор', ctx)));
    box.appendChild(wrap);
    if (tx.glassNote !== '') box.appendChild(el('p', 'ys-key-note', fill(tx.glassNote || 'Каждый день маршрута добавляет в ваш узор своё стёклышко — цвета печати дня. В конце из них сложится ваше Солнце.', ctx)));
    var go = el('button', 'ys-key-go', tx.glassGo || 'На спираль'); go.type = 'button';
    go.addEventListener('click', function () { closeLayer(); });
    box.appendChild(go);
    markSeen(n);
    closeLayer();
    var ov = layer(box, 'ys-layer--key ys-layer--glass'), kal = Kaleido(cv, 0, r);
    ov.onclose = function () { if (kal) kal.stop(); };
    if (!kal) return;
    requestAnimationFrame(function () {
      kal.show(kalSeed(c), myEx(c, n - 1));
      setTimeout(function () { dropGlass(wrap, dayGlass(r, n), function () { kal.turn(kalSeed(c), null, myEx(c, Math.max(n, glassDaysOf(r, curDay())))); }); }, 350);
    });
  }
  // gift — слово-подарок, которое сразу вписать («Мой код» по ссылке ?gift= или из режима проверки)
  function openKey(want, show, gift) {
    var r = S.route, tx = r.texts || {}, box = el('div', 'ys-key'), kal = null;
    var have = !!(show && S.code);
    var mname = el('p', 'ys-key-mode', MODE_NAMES[have ? S.code.mode : want] || '');
    var title = el('h2', 'ys-key-t', have ? tx.myCode || 'Мой узор и код' : tx.keyTitle || 'Ключ к маршруту');
    var cv = el('canvas', 'ys-kal'), wrap = kalWrap(cv);
    box.appendChild(mname); box.appendChild(title); box.appendChild(wrap);
    var form = el('form', 'ys-key-form'), res = el('div', 'ys-key-res'), stBox = el('div', 'ys-key-st');
    form.appendChild(el('p', 'ys-key-lead', tx.keyLead || 'Введите ключ, который Проводник дал в группе. Потом выберите три состояния — калейдоскоп повернётся и сложит ваш личный узор и код.'));
    var inp = el('input', 'ys-key-in');
    inp.type = 'text'; inp.autocomplete = 'off'; inp.setAttribute('autocapitalize', 'off'); inp.setAttribute('autocorrect', 'off'); inp.spellcheck = false;
    inp.placeholder = tx.keyPh || 'Ключ или ваш код';
    var go = el('button', 'ys-key-go', tx.keyNext || 'Дальше'); go.type = 'submit';
    var err = el('p', 'ys-key-err');
    form.appendChild(inp); form.appendChild(go); form.appendChild(err);
    form.appendChild(el('p', 'ys-key-note', tx.keyNote || 'Код уже есть? Введите его — на новом телефоне или компьютере нужен код, а не ключ.'));
    var obs = el('button', 'ys-key-alt', tx.keyObserve || 'Пока просто смотреть — Наблюдение'); obs.type = 'button';
    obs.addEventListener('click', function () { S.mode = 'observation'; setUrlMode('observation'); closeLayer(); render(); });
    form.appendChild(obs);
    function result(c) {
      res.replaceChildren();
      res.appendChild(el('p', 'ys-code-l', tx.codeLabel || 'Ваш код'));
      res.appendChild(el('p', 'ys-code' + (c.code.length > 12 ? ' is-long' : ''), c.code));
      var sw = statesText(r, c);
      if (sw && tx.codeStates !== '') res.appendChild(el('p', 'ys-code-st', fill(tx.codeStates || 'Вы вошли с: {состояния}', { 'состояния': sw })));
      res.appendChild(el('p', 'ys-code-n', tx.codeNote || 'Сохраните узор и код и пришлите код Проводнику в личные. На другом устройстве входите по этому коду.'));
      var row = el('div', 'ys-code-btns');
      function b(t, f) { var x = el('button', 'ys-code-b', t); x.type = 'button'; x.addEventListener('click', f); row.appendChild(x); return x; }
      b(tx.save || 'Сохранить узор', function () { savePattern(c); });
      b(tx.copy || 'Скопировать код', function () { copyText(c.code, function () { note(tx.copied || 'Код скопирован'); }); });
      var url = r.guide || (r.trace || {}).immersion;
      if (url) b(tx.send || 'Отправить код Проводнику', function () {
        copyText(c.code, function () { note(tx.sendNote || 'Код скопирован — вставьте его в сообщение Проводнику'); });
        window.open(url, '_blank', 'noopener');
      });
      res.appendChild(row);
      if (have) res.appendChild(giftForm(c));
      var enter = el('button', 'ys-key-go', have ? tx.toSpiral || 'На спираль' : tx.enter || 'Войти на спираль'); enter.type = 'button';
      enter.addEventListener('click', function () {
        if (!have) { S.mode = c.mode; setUrlMode(c.mode); }
        closeLayer(); render();
      });
      res.appendChild(enter);
      if (have) {
        var other = el('button', 'ys-key-alt', tx.codeOther || 'Ввести другой код'); other.type = 'button';
        other.addEventListener('click', function () {
          if (!confirm(tx.codeOtherAsk || 'Забыть этот код на этом устройстве? Запишите его, если ещё не сохранили.')) return;
          var m = S.code.mode; saveCode(null); closeLayer(); render(); setTimeout(function () { openKey(m); }, 400);
        });
        res.appendChild(other);
      }
      box.classList.remove('is-states');
      box.classList.add('is-done');
    }
    // «Получили стёклышко?» — слово-подарок от Проводника: подходит только к этому коду, хранится на этом устройстве
    function giftForm(c) {
      var wrapF = el('div', 'ys-gift'), open = el('button', 'ys-key-alt', tx.giftBtn || 'Получили стёклышко? Ввести слово'); open.type = 'button';
      var f = el('form', 'ys-gift-f'), gi = el('input', 'ys-key-in'), gok = el('button', 'ys-code-b', tx.giftGo || 'Положить в узор'), gerr = el('p', 'ys-key-err');
      gi.type = 'text'; gi.autocomplete = 'off'; gi.setAttribute('autocapitalize', 'characters'); gi.setAttribute('autocorrect', 'off'); gi.spellcheck = false;
      gi.placeholder = tx.giftPh || 'Слово-подарок, например ДАР-К7М2'; gok.type = 'submit'; f.hidden = true;
      if (tx.giftLead !== '') f.appendChild(el('p', 'ys-key-note', tx.giftLead || 'Проводник прислал слово-подарок — впишите его, и стёклышко ляжет в ваш узор.'));
      f.appendChild(gi); f.appendChild(gok); f.appendChild(gerr);
      open.addEventListener('click', function () { f.hidden = false; open.hidden = true; gi.focus(); });
      f.addEventListener('submit', function (e) {
        e.preventDefault(); gerr.textContent = '';
        var g = readGift(r, c, gi.value);
        if (!g) { gerr.textContent = tx.giftBad || 'Это слово не подходит к вашему коду. Проверьте буквы — или спросите Проводника.'; box.classList.remove('is-shake'); void box.offsetWidth; box.classList.add('is-shake'); return; }
        if (!addGift(c, g)) { note(tx.giftHave || 'Это стёклышко уже в вашем узоре.'); return; }
        gi.value = ''; f.hidden = true; open.hidden = false;
        var z = GIFT_ZONES[g.zone], was = title.textContent;
        title.textContent = fill(tx.giftOk || 'Подарок: день {день} · {зона}', { 'день': String(g.day), 'зона': zoneName(r, z) });
        wrap.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
        dropGlass(wrap, giftGlass(r, g.day, z), function () {
          if (kal) kal.turn(kalSeed(c), null, myEx(c));
          setTimeout(function () { title.textContent = was; }, 4200);
        });
      });
      wrapF.appendChild(open); wrapF.appendChild(f);
      if (gift) setTimeout(function () { open.click(); gi.value = gift; f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true })); }, 700);
      return wrapF;
    }
    // Узор складывается: калейдоскоп поворачивается к личному узору (стёклышки — состояния входа и наступившие дни)
    function turn(c) {
      saveCode(c); mname.textContent = MODE_NAMES[c.mode]; title.textContent = tx.codeTitle || 'Ваш личный узор';
      box.classList.add('is-turn'); inp.blur();
      kal.turn(kalSeed(c), function () { box.classList.remove('is-turn'); result(c); }, myEx(c));
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = inp.value; err.textContent = '';
      if (!keyNorm(v)) { inp.focus(); return; }
      go.disabled = true;
      var c = readCode(r, v);
      if (c) { turn(c); return; }
      keyMode(r, v).then(function (m) {
        if (!m) {
          go.disabled = false; err.textContent = tx.keyBad || 'Ключ не подошёл. Проверьте, как он написан, — или спросите Проводника.';
          box.classList.remove('is-shake'); void box.offsetWidth; box.classList.add('is-shake');
          return;
        }
        inp.blur(); mname.textContent = MODE_NAMES[m];
        // Ключ подошёл → три состояния → код
        if (statesOf(r).length < 3) { turn(newCode(r, m)); return; }
        title.textContent = tx.statesTitle || 'С чем вы входите?';
        stBox.replaceChildren(statesPicker(r, 3, function (st) { turn(newCode(r, m, st)); }));
        box.classList.add('is-states');
      });
    });
    box.appendChild(have ? res : form); if (!have) { box.appendChild(stBox); box.appendChild(res); }
    if (have) result(S.code);
    closeLayer();
    var ov = layer(box, 'ys-layer--key', null, !have);
    kal = Kaleido(cv, 0, r);
    // Пока ключа нет — калейдоскоп живёт общим узором маршрута
    requestAnimationFrame(function () { if (!kal) return; if (have) kal.idle(kalSeed(S.code), myEx(S.code)); else kal.idle(routeSeed(r), { sym: 6 }); });
    ov.onclose = function () { if (kal) kal.stop(); };
  }

  /* ---------- Выбор карты колоды ----------
     Закрытые карты лучами по кругу, центр пуст; в колоде 13 карт на 12 дней: в 1-й день 13, каждый день на одну меньше,
     в 12-й — выбор из двух (последняя остаётся закрытой, ничего с ней не делаем).
     Нажал любую → она выходит в центр и переворачивается (выбор окончателен) → «Открыть» → личная карта.
     Какая карта откроется, решает колода из кода, а не то, какую нажали. */
  function backSVG() {
    var rays = '', i, a;
    for (i = 0; i < 16; i++) { a = i / 16 * Math.PI * 2; rays += '<line x1="' + r1(45 + 13 * Math.cos(a)) + '" y1="' + r1(60 + 13 * Math.sin(a)) + '" x2="' + r1(45 + (i % 2 ? 19 : 24) * Math.cos(a)) + '" y2="' + r1(60 + (i % 2 ? 19 : 24) * Math.sin(a)) + '"/>'; }
    return '<svg viewBox="0 0 90 120" preserveAspectRatio="none" aria-hidden="true"><rect x="5" y="5" width="80" height="110" rx="6" fill="none" stroke="#e9c77e" stroke-opacity=".55" stroke-width="1.2"/>' +
      '<rect x="9" y="9" width="72" height="102" rx="4" fill="none" stroke="#e9c77e" stroke-opacity=".25" stroke-width=".8"/>' +
      '<g stroke="#ffd76a" stroke-opacity=".75" stroke-width="1.6" stroke-linecap="round">' + rays + '</g><circle cx="45" cy="60" r="9" fill="#ffcf5a" fill-opacity=".85"/>' +
      '<circle cx="45" cy="20" r="1.6" fill="#e9c77e"/><circle cx="45" cy="100" r="1.6" fill="#e9c77e"/></svg>';
  }
  function backFace(r) {
    var b = el('span', 'ys-fc-back');
    if (r.cardBack) { var img = el('img'); img.src = imgSrc(S.base, r.cardBack); img.alt = ''; img.draggable = false; b.appendChild(img); b.classList.add('has-img'); }
    else b.innerHTML = backSVG();
    return b;
  }
  // Лицо перевёрнутой карты в круге: качество на маленьком колесе (полное колесо — на личной карте)
  function frontFace(k) {
    var f = el('span', 'ys-fc-face');
    if (k && k.image) { var img = el('img'); img.src = imgSrc(S.base, k.image); img.alt = k.quality || ''; f.appendChild(img); f.classList.add('has-img'); }
    else {
      f.insertAdjacentHTML('beforeend', '<svg class="ys-fc-w" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="#e9c77e"><circle cx="50" cy="50" r="46" stroke-opacity=".45"/><circle cx="50" cy="50" r="32" stroke-opacity=".4"/>' +
        '<circle cx="50" cy="50" r="19" stroke="#ffd76a" stroke-opacity=".7"/><line x1="50" y1="4" x2="50" y2="96" stroke-opacity=".35"/></g></svg>');
      var t = el('span', 'ys-fc-t', k ? k.quality : '');
      // Длинное слово («Рассудительность») — мельче, чтобы не рвалось по слогам
      t.style.setProperty('--fs', Math.min(.056, .66 / Math.max(1, String(k ? k.quality : '').length)).toFixed(4));
      f.appendChild(t);
    }
    return f;
  }
  function openFan(n, mode) {
    var r = S.route, tx = r.texts || {}, ctx = ctxOf(r, n), N = Math.max(1, cardsOf(r).length - (n - 1)), perm = cardFor(r, S.code, n), done = false, i;
    var box = el('div', 'ys-fan'), ring = el('div', 'ys-fan-ring' + (N === 1 ? ' is-one' : ''));
    box.appendChild(el('p', 'ys-fan-small', fill(tx.chooseSmall || 'День {день} · {имя кина}', ctx)));
    var title = el('h2', 'ys-fan-t', fill(tx.choose || 'Выберите карту', ctx));
    box.appendChild(title);
    var pk = el('div', 'ys-pick'), pin = el('div', 'ys-pick-in');
    pin.appendChild(backFace(r)); pin.appendChild(frontFace(perm)); pk.appendChild(pin);
    for (i = 0; i < N; i++) (function (a, i) {
      var b = el('button', 'ys-fc'); b.type = 'button';
      b.style.setProperty('--a', a + 'deg'); b.style.transitionDelay = (i * 40) + 'ms';
      b.setAttribute('aria-label', 'Закрытая карта ' + (i + 1) + ' из ' + N);
      b.appendChild(backFace(r));
      b.addEventListener('click', function () { pick(b, a); });
      ring.appendChild(b);
    })(i * 360 / N, i);
    ring.appendChild(pk);
    box.appendChild(ring);
    var hint = el('p', 'ys-fan-n', fill(tx.chooseNote || 'Карты лежат рубашкой вверх — выбирайте наугад. Та, что откроется, — ваша на сегодня.', ctx));
    var open = el('button', 'ys-key-go ys-fan-open', tx.open || 'Открыть'); open.type = 'button';
    open.addEventListener('click', function () { openPersonal(n, mode, perm); });
    box.appendChild(hint); box.appendChild(open);
    function pick(b, a) {
      if (done) return; done = true;
      markPicked(n);
      // Последняя карта (12-й день) лежит в середине круга, крупнее
      var R = N === 1 ? 0 : ring.offsetWidth / 2 - b.offsetHeight / 2 - 2, k = b.offsetWidth * (N === 1 ? 1.6 : 1) / pk.offsetWidth;
      pk.style.transition = 'none';
      pk.style.transform = 'rotate(' + a + 'deg) translateY(' + (-R) + 'px) scale(' + k.toFixed(3) + ')';
      pk.classList.add('is-on'); b.classList.add('is-gone'); ring.classList.add('is-picked');
      void pk.offsetWidth;
      pk.style.transition = '';
      pk.style.transform = 'rotate(' + (a > 180 ? 360 : 0) + 'deg)';
      setTimeout(function () { pk.classList.add('is-flip'); }, REDUCED ? 0 : 420);
      setTimeout(function () {
        title.textContent = fill(tx.chosen || 'Ваша карта на сегодня', ctx);
        hint.style.visibility = 'hidden'; open.classList.add('is-on'); open.focus();
      }, REDUCED ? 50 : 1500);
    }
    closeLayer();
    var ov = layer(box, 'ys-layer--fan', centerOffset());
    requestAnimationFrame(function () { requestAnimationFrame(function () { ring.classList.add('is-in'); }); });
    // Карты вылетают по очереди; потом задержку убираем, чтобы наведение откликалось сразу
    setTimeout(function () { [].forEach.call(ring.querySelectorAll('.ys-fc'), function (b) { b.style.transitionDelay = ''; }); }, 1300);
    return ov;
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
    if (S.mode !== 'observation' && !S.code) { openKey(S.mode); return; }
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
    // Путешествие и Погружение: «Мой код» — узор и код ещё раз (сохранить, отправить, ввести другой)
    if (S.mode !== 'observation') {
      var me = el('button', 'ys-me', S.code ? tx.myCodeBtn || 'Мой код' : tx.keyBtn || 'Ввести ключ'); me.type = 'button';
      me.addEventListener('click', function () { openKey(S.mode, true); });
      page.appendChild(me);
    }

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
    var sp = sel([['code', 'Карта — по коду (колода)']].concat(cardsOf(r).map(function (p, k) { return [String(k), (k + 1) + '. ' + (p.quality || '')]; })), S.code ? 'code' : '0');
    function permSel(d) { return sp.value === 'code' ? cardFor(r, S.code, d) || cardsOf(r)[0] : cardsOf(r)[+sp.value]; }
    function testCode(m) { saveCode(newCode(r, m)); S.mode = m; setUrlMode(m); closeLayer(); render(); note('Код для проверки: ' + S.code.code + ' · ' + MODE_NAMES[m]); }
    var cinfo = S.code ? 'Код: ' + S.code.code + ' · ' + MODE_NAMES[S.code.mode] + ' · вошли с: ' + (statesText(r, S.code) || '—') + ' · перевёрнуты дни: ' + (pickedList().sort(function (a, b) { return a - b; }).join(', ') || 'нет') +
      ' · подарки: ' + (giftList(S.code).map(function (g) { return g[0] + ' ' + zoneName(r, GIFT_ZONES[g[1]]).toLowerCase(); }).join(', ') || 'нет') : 'Кода на этом устройстве нет';
    function needCode() { if (!S.code) note('Сначала нужен код: «Код Путешествия» или «Код Погружения».'); return !!S.code; }
    [el('span', null, 'Сейчас по Москве: ' + (S.debugNow ? S.debugNow + ' (подмена)' : 'настоящее время') + ' · ' + (real === 0 ? 'до начала' : real > last ? 'после конца' : 'день ' + real)),
      ss, zl,
      row([btn('Финал Солнца', openFinal), btn('Сброс', function () { resetOpened(); resetPicks(); resetGlass(); S.sim = null; render(); note('Сброшено: спираль по настоящей дате, сегодняшний кирпич снова зовёт, карты снова закрыты, подарков нет.'); })]),
      el('span', 'ys-debug-sep', 'Код и колода'),
      el('span', null, cinfo),
      row([btn('Код Путешествия', function () { testCode('journey'); }), btn('Код Погружения', function () { testCode('immersion'); })]),
      row([btn('Ввод ключа', function () { openKey(S.mode === 'observation' ? 'journey' : S.mode); }), btn('Забыть код', function () { resetPicks(); resetGlass(); saveCode(null); closeLayer(); render(); note('Код забыт на этом устройстве.'); })]),
      row([btn('Стёклышко дня', function () {
        if (!needCode()) return;
        if (+sd.value >= last) { note('У дня ' + last + ' своего стёклышка нет — это само Солнце.'); return; }
        openGlass(+sd.value);
      }), btn('Подарок (тест)', function () { if (needCode()) openKey(S.code.mode, true, makeGift(r, S.code, Math.min(+sd.value, last - 1), Math.floor(Math.random() * 4))); })]),
      el('span', 'ys-debug-sep', 'Формат и карты'),
      sm, sd, sp,
      row([btn('Карта дня', function () { openDay(+sd.value, sm.value); }),
        btn('Личная карта', function () { if (sm.value === 'observation') { note('У Наблюдения личной карты нет — выберите Путешествие или Погружение.'); return; } openPersonal(+sd.value, sm.value, permSel(+sd.value)); })]),
      btn('Выбор карты (круг)', function () {
        if (sm.value === 'observation') { note('У Наблюдения выбора карты нет — выберите Путешествие или Погружение.'); return; }
        if (+sd.value === last) { note('В день ' + last + ' выбора нет — там финал Солнца.'); return; }
        if (!S.code) { note('Сначала нужен код: «Код Путешествия» или «Код Погружения».'); return; }
        var l = pickedList().filter(function (x) { return x !== +sd.value; });
        try { localStorage.setItem(pickKey(), JSON.stringify(l)); } catch (e) {}
        openFan(+sd.value, sm.value);
      })
    ].forEach(function (x) { body.appendChild(x); });
    box.appendChild(head); box.appendChild(body);
    return box;
  }
  // Формат: Наблюдение — всем; Путешествие и Погружение — по коду (код сам определяет формат). Кода нет — сначала вход по ключу.
  function useRoute(route) {
    S.route = route;
    S.code = loadCode();
    var m = q('mode'), gate = false;
    if (m === 'observation') S.mode = m;
    else if (m === 'journey' || m === 'immersion') { S.mode = S.code ? S.code.mode : m; gate = !S.code; }
    else S.mode = S.code ? S.code.mode : 'observation';
    if (route.title) document.title = '13 MIRRORS · ' + route.title;
    render();
    var c = q('card'), n = +q('day') || 1;
    if (c === 'day') openDay(n, S.mode);
    else if (c === 'personal') openPersonal(n, S.mode, q('perm') == null && S.code ? cardFor(route, S.code, n) : cardsOf(route)[+q('perm') || 0]);
    else if (c === 'fan' && S.code) openFan(n, S.mode);
    else if (q('gift') && S.code) openKey(S.code.mode, true, q('gift'));
    else if (gate) openKey(m);
    if (q('gift') && !S.code) setTimeout(function () { note((route.texts || {}).giftNeed || 'Чтобы положить подарок в узор, сначала войдите своим кодом.'); }, 600);
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
    getJSON(S.base + 'data/journeys.json').then(function (j) {
      var route = (j.items || []).filter(function (x) { return x.id === id; })[0];
      if (!route) throw new Error();
      useRoute(route);
    }).catch(function () {
      app.replaceChildren(el('p', 'ys-err', 'Не удалось загрузить маршрут. Обновите страницу через минуту.'));
    });
  }

  window.M13R = { card: card, fill: fill, ctxOf: ctxOf, tokens: tokens, dateOf: dateOf, dayNumber: dayNumber, nowMsk: nowMsk,
    spiralSVG: spiralSVG, MODES: MODES, MODE_NAMES: MODE_NAMES, boot: boot,
    trace: trace, bricksLayer: bricksLayer, lights: lights, dayColor: dayColor, sealColor: sealColor, glowPower: glowPower, PATH_DAYS: PATH_DAYS, SPAN: SPAN, finalSunLayer: finalSunLayer,
    readCode: readCode, makeCode: makeCode, newCode: newCode, deckOf: deckOf, cardFor: cardFor, cardsOf: cardsOf, keyNorm: keyNorm,
    kaleido: Kaleido, kalSeed: kalSeed, kalEx: kalEx, kalShow: kalShow, kalStyle: kalStyle, routeSeed: routeSeed, statesOf: statesOf, statesText: statesText,
    wheelNode: wheelNode, zoneName: zoneName, CARD_TOKENS: CARD_TOKENS,
    GIFT_ZONES: GIFT_ZONES, GLASS_DEF: GLASS_DEF, hexRgb: hexRgb, glassLook: glassLook, dayGlass: dayGlass, giftGlass: giftGlass, glassDaysOf: glassDaysOf, makeGift: makeGift, readGift: readGift };
})();
