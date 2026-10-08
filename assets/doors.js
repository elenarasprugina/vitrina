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
     final: пространство финала (+ on) — после 13-го дня,
     doorAssignmentMode: 'fixed' (по умолчанию: день N → дверь N) | 'userChoice' (участник сам выбирает любую свободную дверь; дверей сколько угодно),
     first: '' (по режиму: выбор — Карта дня, fixed — пространство) | 'card' (Карта дня, глубже — по ключу) | 'space' (сразу пространство),
     days: [{ space — пространство дня (в userChoice; в fixed — у двери), world: [слой мира] }], marks: [след тона × 13], showDayNumbers, call, callColor, callMs }
   v2 (06.10, docs/doors.md «Схема v2»): у двери в userChoice — id (по нему запоминается выбор), markFix: { x, y, scale, rot } — поправка следа.
   Слой мира: как слой двери, по всей сцене, + when: 'after' (после конца дня, по умолчанию) | 'during' (уже в течение дня).
   След тона: { image, color, fill, opacity, blend, fx, speed, power, fade, scale, clip, soft, line — толщина линий SVG (×), glow — свечение линий, % } — знак кладётся в рамку выбранной двери.
   Слой: { name, visible, st: { состояние: да/нет } — в каких состояниях виден (нет st — во всех),
     area: 'door' (картинка размером со сцену, видна только внутри контура) | 'scene' (вся сцена, без контура) | 'frag' (готовый фрагмент — в рамку двери),
     desktop, mobile — картинка слоя (PNG/WebP с прозрачностью; необязательно), color + fill — заливка цветом (%), opacity, blend,
     soft — мягкий край контура, fx — движение (FX ниже), speed, power — его скорость и сила (%), fade — сколько длится смена состояния, мс, scale — фрагмент крупнее/мельче }
   Пространство: { desktop, mobile — фон, color, dim, place: 'center' | 'left' | 'right' | 'bottom', plate: 'glass' | 'dark' | 'none', blocks: [блок],
     kal: { on, image, n, speed, bright } — фон «калейдоскоп из картинки» (09.10, kalLive) }
   Узор на двери (09.10): doors.pattern ('' узор + знак | 'pattern' | 'mark'), patternNone ('' знак | 'archetype'), patternOpacity, patternSoft — face().
   Блок: { kind: 'title' | 'small' | 'text' | 'image' | 'dayCard' | 'deck' | 'glass' | 'final' | 'figure', text, image, label, auto, who: { формат: да/нет }, visible }
   Заход «б» (06.10): живая обложка на витрине — doors.cover = { on, desktop, mobile — своя картинка (нет — сцена), fit, dim, world — мировые слои на обложке,
     marks — личные следы этого устройства на обложке, text — надписи карточки поверх }; жест дня на обложке — doors.days[N].gesture =
     { on, desktop: [x, y], mobile: [x, y] — точка на картинке обложки (доли), size — диаметр, % ширины, fx, color, fill, image, opacity, blend, soft, speed, power };
     «Моя фигура» — doors.figure: '' (после конца маршрута) | 'always' (как только есть след) | 'off'; figure(r, o, готово) собирает одну картинку.
   07.10 (docs/doors.md, «Сделано 07.10»): у слоя — out (как уходит, OUT ниже), outMs, outDir; картинки слоёв грузятся, только когда слой виден.
     doors.markWhen: '' (след проступает после конца дня) | 'now' (сразу, когда человек вернулся к дверям);
     doors.worldMode: '' (мир копится) | 'weather' (погода дня — виден только мир сегодняшнего дня); doors.skies: [{ name, desktop, mobile }] — общие картинки погоды;
     у слоя мира: sky — номер общей картинки (вместо своей), tint + tintPow — окрасить картинку в цвет, bright — яркость, %, top — поверх дверей;
     блок пространства audio: { audio — запись, text — подпись, icon: 'phones' | 'wave' | 'rings' | 'voice' } — во время звучания значок становится волной. */
(function () {
  'use strict';
  // Пять состояний двери (её список 06.10). Порядок важен: так они идут в панели.
  var STATES = ['future', 'today_unvisited', 'today_visited', 'past_visited', 'past_unvisited'];
  // Режим «участник выбирает дверь» (v2): дверь не привязана к дню — три состояния
  var STATES_UC = ['free', 'today', 'past'];
  var STATE_NAMES = { future: 'будущая', today_unvisited: 'сегодня, ещё не входили', today_visited: 'сегодня, уже входили', past_visited: 'прошла — входили', past_unvisited: 'прошла — не входили',
    free: 'свободная — ещё не выбирали', today: 'выбрана сегодня', past: 'выбрана в прошлый день' };
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
  function days(r) { return ((r && r.days) || []).length || 13; }
  function isChoice(r) { return cfg(r).doorAssignmentMode === 'userChoice'; }
  function statesOf(r) { return isChoice(r) ? STATES_UC : STATES; }
  // Сколько дверей: в fixed — по числу дней, в userChoice — сколько добавлено в панели
  function count(r) { return isChoice(r) ? (cfg(r).items || []).length : days(r); }
  // Что открывается первым после двери: Карта дня (глубже — по ключу) или сразу пространство
  function first(r) { var f = cfg(r).first; return f === 'card' || f === 'space' ? f : isChoice(r) ? 'card' : 'space'; }
  function dayCfg(r, n) { return (cfg(r).days || [])[n - 1] || {}; }
  // Пространство дня: в userChoice — у дня, в fixed — у двери N (как было)
  function spaceOf(r, n) { return (isChoice(r) ? dayCfg(r, n).space : doorOf(r, n).space) || {}; }
  function markOf(r, day) { return (cfg(r).marks || [])[day - 1] || {}; }
  // Слой мира в виде слоя сцены: своя картинка или общая картинка погоды (doors.skies[sky])
  function skyOf(r, L) { var a = cfg(r).skies || []; return L.sky != null && L.sky !== '' && a[+L.sky] ? a[+L.sky] : null; }
  function worldLayer(r, L) {
    var s = skyOf(r, L), o = {}, k;
    for (k in L) o[k] = L[k];
    o.area = 'scene';
    if (s) { o.desktop = s.desktop || s.mobile; o.mobile = s.mobile || s.desktop; }
    // Картинка только для компьютера (широкая) на телефоне не растягивается: во всю ширину, своей высоты, сверху (облака — в небе)
    var own = s || L;
    if (own.desktop && !own.mobile) o.ratioOn = 'mobile';
    else if (own.mobile && !own.desktop) o.ratioOn = 'desktop';
    return o;
  }
  function weather(r) { return cfg(r).worldMode === 'weather'; }
  /* Виден ли мир дня k в день n (0 — до начала, больше числа дней — после конца).
     Мир копится: день k — после своего дня (after) или уже в свой день (during). Погода дня: только сегодняшний; после конца — последнего дня. */
  function worldOn(r, k, n) {
    var w = (dayCfg(r, k).world || []).filter(function (L) { return L && L.visible !== false; }), N = days(r);
    if (!w.length) return false;
    if (weather(r)) return n > N ? k === N : k === n;
    return n > k || (n === k && w.some(function (L) { return L.when === 'during'; }));
  }
  // След тона дня day виден в день n: после конца своего дня (по умолчанию) или сразу
  function markOn(r, day, n) { return cfg(r).markWhen === 'now' ? day <= n : day < n || n > days(r); }
  /* Карта дня — по второму нажатию: первое касание выбирает дверь (фактура уходит), второе открывает Карту дня.
     Только «выбирает сам» и «сначала Карта дня»; по умолчанию — да. */
  function tap2(r) { return isChoice(r) && first(r) === 'card' && cfg(r).tap2 !== false; }
  /* Пространство за Картой дня: 'key' — только по лестнице на карте (ключ / код Путешествия или Погружения), 'all' — всем, под картой.
     По умолчанию: «выбирает сам» — по ключу, «по порядку» — всем (как было). '' — сначала открывается пространство. */
  function deep(r) { var v = cfg(r).deep; return first(r) !== 'card' ? '' : v === 'key' || v === 'all' ? v : isChoice(r) ? 'key' : 'all'; }
  /* Значок входа глубже на Карте дня: лестницы рисуются линией, перекладины загораются снизу вверх (ys-lr, --i — снизу) */
  function rungs(list) { return list.map(function (d, i) { return '<path class="ys-lr" style="--i:' + i + '" d="' + d + '"/>'; }).join(''); }
  var KEY_ICONS = {
    rope: '<g class="ys-lsway"><path d="M20 4C17 24 23 44 19 76M44 4C41 24 47 44 43 76"/>' + rungs(['M19.5 68H43.5', 'M20.5 56H44.5', 'M21 44H45', 'M20.5 32H44', 'M19.5 20H42.5']) + '<circle cx="20" cy="4" r="2" fill="currentColor" stroke="none"/><circle cx="44" cy="4" r="2" fill="currentColor" stroke="none"/></g>',
    steps: rungs(['M6 74H20V60', 'M20 60H32V46', 'M32 46H44V32', 'M44 32H56V20']) + '<circle class="ys-ldot" cx="56" cy="11" r="4" fill="currentColor" stroke="none"/><circle class="ys-ldot" cx="56" cy="11" r="9" stroke-width="1" opacity=".45"/>',
    screw: '<path d="M32 4V76" stroke-width="1.4" opacity=".5"/><path d="M54 64C60 50 50 42 38 40C22 38 8 32 12 24C14 18 20 12 22 12" stroke-width="1" opacity=".5"/>' + rungs(['M32 70L54 64', 'M32 60L50 50', 'M32 50L38 40', 'M32 40L14 36', 'M32 30L12 24', 'M32 20L22 12'])
  };
  var KEY_NAMES = [['rope', 'верёвочная лестница — покачивается'], ['steps', 'ступени к свету — огонёк наверху дышит'], ['screw', 'винтовая лестница'], ['spiral', 'спираль (как раньше)'], ['svg', 'свой значок — SVG']];
  // Какой значок: { html } — готовый, { svg: адрес } — свой SVG (рисуется линией), { spiral: true } — спираль маршрута
  function keyIcon(r) {
    var D = cfg(r), k = D.keyIcon || 'rope';
    if (k === 'svg' && D.keySvg) return { svg: D.keySvg };
    if (k === 'spiral') return { spiral: true };
    return { html: '<svg class="ys-ladder ys-ladder--' + (KEY_ICONS[k] ? k : 'rope') + '" viewBox="0 0 64 80" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (KEY_ICONS[k] || KEY_ICONS.rope) + '</svg>' };
  }
  function uid() { return 'd' + Math.random().toString(36).slice(2, 9); }
  function doorOf(r, n) { return (cfg(r).items || [])[n - 1] || {}; }
  function zoneOf(d, key) { var z = (d.zone || {})[key]; return ptsOk(z) ? z : null; }
  // Картинка сцены для экрана: вытянутый (телефон) — mobile, иначе desktop; нет своей — берётся другая (вместе с её контурами)
  function pick(r, tall) {
    var D = cfg(r), t = tall ? !!D.mobile || !D.desktop : !D.desktop && !!D.mobile;
    return { src: t ? D.mobile : D.desktop, key: t ? 'mobile' : 'desktop', tall: t };
  }
  // Нет отметки у состояния — слой виден (так слои не пропадают, когда меняется режим и набор состояний)
  function layerOn(L, st) { return !L.st || L.st[st] !== false; }
  // Заготовка — только устройство (панель): сколько дверей, где хранятся контуры, слои, открытие и пространство
  function norm(r) {
    var D = r.doors = r.doors || {}, N = days(r), n, i;
    D.items = D.items || [];
    // userChoice: дверей сколько добавлено (пусто — по числу дней для начала); fixed — по числу дней
    n = isChoice(r) ? D.items.length || N : N;
    for (i = 0; i < n; i++) {
      var d = D.items[i] = D.items[i] || {};
      d.id = d.id || uid();
      d.zone = d.zone || {}; d.layers = d.layers || []; d.open = d.open || {};
      d.space = d.space || {}; d.space.blocks = d.space.blocks || [];
    }
    D.days = D.days || [];
    for (i = 0; i < N; i++) {
      var y = D.days[i] = D.days[i] || {};
      y.space = y.space || {}; y.space.blocks = y.space.blocks || []; y.world = y.world || [];
    }
    D.marks = D.marks || [];
    for (i = 0; i < N; i++) D.marks[i] = D.marks[i] || {};
    D.final = D.final || {}; D.final.blocks = D.final.blocks || [];
    return D;
  }

  /* ---------- Движение слоя (жест зова, след и всё прочее) ----------
     Расширяется здесь: новый вид — ещё одна строка в FX (название для панели + run). run(слой, c) получает
     c = { L — настройки слоя, poly — контур двери (или null), box — его рамка, n — номер двери, color, k — скорость (1 — обычная), p — сила (1 — обычная) }
     и добавляет в слой свои элементы или класс; время — переменная --fx-t (секунды), сила — --fx-p. */
  var auraN = 0;
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
    contour: { name: 'живой контур — край светится и дышит, по нему бежит свет', t: 6, run: function (ln, c) {
      if (!c.poly) return;
      var s = sv('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', class: 'ys-fx-line' });
      s.appendChild(sv('path', { class: 'ys-fx-line-glow' }));
      s.appendChild(sv('path', { class: 'ys-fx-line-run', pathLength: '100' }));
      s._poly = c.poly; ln._line = s;
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
    aura: { name: 'сияющий контур с бликом — край дышит светом, по двери пробегает блик (как на плашках витрины)', t: 5, run: function (ln, c) {
      if (!c.poly) return;
      var id = 'ysa' + (++auraN), s = sv('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', class: 'ys-fx-line ys-fx-aura' });
      var cp = sv('clipPath', { id: id }), gr = sv('linearGradient', { id: id + 'g', x1: '0', y1: '0', x2: '1', y2: '0' });
      cp.appendChild(sv('path', {}));
      [[0, 0], [.5, 1], [1, 0]].forEach(function (x) { gr.appendChild(sv('stop', { offset: x[0], 'stop-color': '#fff6dc', 'stop-opacity': x[1] })); });
      var defs = sv('defs', {}); defs.appendChild(cp); defs.appendChild(gr); s.appendChild(defs);
      var g = sv('g', { 'clip-path': 'url(#' + id + ')' }), band = sv('rect', { class: 'ys-fx-aura-band', fill: 'url(#' + id + 'g)' });
      g.appendChild(band); s.appendChild(g);
      s.appendChild(sv('path', { class: 'ys-fx-line-glow' }));
      s._poly = c.poly; s._band = band; ln._line = s;
      ln.firstChild.appendChild(s);
    } },
    /* Свет из-за двери (09.10, её «проступает из-за двери, не линия»): за дверью словно горит лампа — мягкий ореол снаружи контура
       и размытая кайма, которая сочится внутрь по краю (как сквозь щели). Линии нет: размытие прячет неточность точек контура. Дышит. */
    halo: { name: 'свет из-за двери — мягкий ореол, сочится по краю (не линия)', t: 7, run: function (ln, c) {
      if (!c.poly) return;
      var id = 'ysh' + (++auraN), s = sv('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', class: 'ys-fx-line ys-fx-halo' });
      var defs = sv('defs', {}), fo = sv('filter', { id: id + 'o', filterUnits: 'userSpaceOnUse' }), fi = sv('filter', { id: id + 'i', filterUnits: 'userSpaceOnUse' });
      var mk = sv('mask', { id: id + 'm', maskUnits: 'userSpaceOnUse' }), cp = sv('clipPath', { id: id + 'c' });
      fo.appendChild(sv('feGaussianBlur', {})); fi.appendChild(sv('feGaussianBlur', {}));
      mk.appendChild(sv('rect', { fill: '#fff' })); mk.appendChild(sv('path', { fill: '#000' }));
      cp.appendChild(sv('path', {}));
      [fo, fi, mk, cp].forEach(function (x) { defs.appendChild(x); }); s.appendChild(defs);
      var out = sv('g', { mask: 'url(#' + id + 'm)' }), inn = sv('g', { 'clip-path': 'url(#' + id + 'c)' });
      out.appendChild(sv('path', { class: 'ys-fx-halo-out', filter: 'url(#' + id + 'o)' }));
      inn.appendChild(sv('path', { class: 'ys-fx-halo-in', filter: 'url(#' + id + 'i)' }));
      s.appendChild(out); s.appendChild(inn);
      s._poly = c.poly; s._halo = { fo: fo, fi: fi, mk: mk }; ln._line = s;
      ln.firstChild.appendChild(s);
    } },
    drift: { name: 'движение среды — слой медленно плывёт (туман, вода)', t: 16, run: function (ln) { ln.classList.add('ys-fx-drift'); } },
    reveal: { name: 'проявление — слой медленно проступает', t: 2.4, run: function (ln) { ln.classList.add('ys-fx-reveal'); } },
    flow: { name: 'бесконечно плывёт — облака идут по кругу, без пустот', t: 90, run: flowStrip }
  };
  var FLOW_DIR = [['right', 'вправо'], ['left', 'влево'], ['up', 'вверх'], ['down', 'вниз']];
  var FLOW_SEAM = [['', 'зеркально — подходит любая картинка'], ['tile', 'картинка бесшовная — левый край продолжает правый']];
  /* «Бесконечно плывёт» (09.10): лента из копий картинки едет по кругу — уходящая копия сменяется следующей, слой не пустеет.
     Стык: зеркально (A | A отражённая | A — края совпадают у любой картинки) или бесшовная картинка (A | A). Фрагмент двери едет в своей рамке. */
  function flowStrip(ln, c) {
    var L = c.L, d = L.flowDir, v = d === 'up' || d === 'down', back = d === 'left' || d === 'up', tile = L.flowSeam === 'tile';
    var inner = ln.firstChild.firstChild, host = inner, frag = inner.querySelector('.ys-dl-frag');
    if (frag) {
      host = el('div', 'ys-fx-flowbox');
      ['left', 'top', 'width', 'height'].forEach(function (k) { host.style[k] = frag.style[k]; frag.style[k] = k === 'left' || k === 'top' ? '0' : '100%'; });
      inner.insertBefore(host, frag); host.appendChild(frag);
    }
    var k = tile ? 2 : 3, strip = el('div', 'ys-fx-flow ys-fx-flow--' + (v ? 'v' : 'h') + (back ? ' is-back' : '')), a = el('div', 'ys-fx-pane'), i, b;
    while (host.firstChild) a.appendChild(host.firstChild);
    strip.style.setProperty('--n', k); strip.style.setProperty('--d', (-(k - 1) * 100 / k).toFixed(4) + '%');
    for (i = 0; i < k; i++) {
      b = i ? a.cloneNode(true) : a;
      b.style.setProperty('--i', i);
      if (i === 1 && !tile) b.classList.add('is-mirror');
      strip.appendChild(b);
    }
    host.appendChild(strip);
  }
  // Открытие двери: как человек входит в пространство дня
  var OPEN = {
    portal: 'дверь раскрывается в пространство (по её контуру)',
    zoom: 'камера входит в дверь',
    fade: 'мягкая смена'
  };
  /* Как уходит слой (её список 07.10) — когда слой гаснет: дверь сменила состояние или сменилась погода дня.
     Новый уход — строка здесь + класс ys-out-<имя> в doors.css (run — если нужны свои элементы; вернуть функцию уборки). */
  var OUT = [['', 'растворяется'], ['blur', 'рассеивается — размывается'], ['light', 'растворяется в свет — вспышка'],
    ['center', 'уходит от центра — окно расширяется к краям'], ['split', 'разлетается в стороны — половинки, как занавес'], ['drift', 'уплывает (направление ниже)'],
    ['rise', 'поднимается вверх'], ['melt', 'тает — снизу вверх, неровная кромка'], ['sparks', 'рассыпается в искры'],
    ['burn', 'сгорает от края — светящаяся кромка'], ['shade', 'шторка (направление ниже)']];
  var OUT_DIR = [['right', 'вправо'], ['left', 'влево'], ['up', 'вверх'], ['down', 'вниз']];
  var OUT_RUN = {
    split: function (ln) {
      var a = ln.querySelector('.ys-dl-box'); if (!a) return null;
      var b = a.cloneNode(true); a.classList.add('ys-half-a'); b.classList.add('ys-half-b'); ln.appendChild(b);
      return function () { a.classList.remove('ys-half-a'); b.remove(); };
    },
    sparks: function (ln, c) {
      var host = ln.parentNode; if (!host) return null;
      var box = el('div', 'ys-sparks'), R = rng(Math.floor(Math.random() * 1e6)), k = 30, i, p, s;
      box.style.setProperty('--fx-c', c.color); box.style.setProperty('--out', ln.style.getPropertyValue('--out'));
      for (i = 0; i < k; i++) {
        p = c.poly ? ptIn(c.poly, R) : [.05 + R() * .9, .1 + R() * .85];
        s = el('i'); s.style.left = (p[0] * 100) + '%'; s.style.top = (p[1] * 100) + '%';
        s.style.setProperty('--tx', ((R() - .5) * 14).toFixed(1) + 'vmin'); s.style.setProperty('--ty', (-6 - R() * 16).toFixed(1) + 'vmin');
        s.style.setProperty('--z', (.6 + R() * 1.1).toFixed(2)); s.style.animationDelay = (R() * .35).toFixed(2) + 's';
        box.appendChild(s);
      }
      host.appendChild(box);
      return function () { box.remove(); };
    },
    burn: function (ln) { var g = el('div', 'ys-out-ring'); ln.appendChild(g); return function () { g.remove(); }; }
  };
  var OUT_OK = {}; OUT.forEach(function (x) { if (x[0]) OUT_OK[x[0]] = true; });
  var BLEND = [['', 'обычно'], ['screen', 'светом (светлое светит, тёмное исчезает)'], ['multiply', 'тенью (тёмное темнит, светлое исчезает)'], ['overlay', 'перекрытие'], ['soft-light', 'мягкий свет'], ['color', 'цветом']];
  // Блоки пространства за дверью — подключаемые части маршрута (существующие механики — кнопками, как и были)
  var BLOCKS = [['title', 'Заголовок'], ['small', 'Строка мелко'], ['text', 'Текст'], ['image', 'Картинка'],
    ['audio', 'Аудио — запись с кнопкой'], ['trace', 'Оставить след — кнопка в Telegram'], ['dayCard', 'Карта дня (кнопка)'], ['deck', 'Колода вслепую (кнопка)'], ['glass', 'Стёклышко дня (кнопка)'], ['final', 'Кнопка в финал'], ['figure', 'Сохранить мою фигуру (кнопка)']];
  var BTN_DEF = { dayCard: 'Карта дня', deck: 'Вытянуть карту', glass: 'Стёклышко дня', final: 'Дальше', figure: 'Сохранить мою фигуру' };

  /* ---------- Слой двери ---------- */
  function layerNode(L, d, n, key, base) {
    var poly = zoneOf(d, key), area = L.area === 'scene' || L.area === 'frag' || L.area === 'mark' ? L.area : 'door';
    if (area !== 'scene' && !poly) return null;
    var ln = el('div', 'ys-dl'), box = el('div', 'ys-dl-box'), inner = el('div', 'ys-dl-in'), b = poly ? bbox(poly) : null, pic = area === 'mark' ? L.image || L[key] : L[key];
    var k = num(L.speed, 100, 20, 400) / 100, p = num(L.power, 100, 10, 300) / 100, f = FX[L.fx] || FX.none, color = hexOk(L.color) ? L.color : '#ffe2a0';
    ln.style.setProperty('--o', num(L.opacity, 100, 0, 100) / 100);
    ln.style.setProperty('--fade', num(L.fade, 900, 0, 8000) + 'ms');
    ln.style.setProperty('--fx-t', ((f.t || 3) / k).toFixed(2) + 's');
    ln.style.setProperty('--fx-p', p.toFixed(2));
    ln.style.setProperty('--fx-c', color);
    if (L.blend) ln.style.mixBlendMode = L.blend;
    // Середина двери — для уходов «от центра», «сгорает от края», «половинки»
    ln.style.setProperty('--cx', ((b ? b.cx : .5) * 100).toFixed(2) + '%'); ln.style.setProperty('--cy', ((b ? b.cy : .5) * 100).toFixed(2) + '%');
    var dir = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] }[L.outDir] || (L.out === 'shade' ? [0, -1] : [1, 0]);
    ln.style.setProperty('--dx', dir[0]); ln.style.setProperty('--dy', dir[1]);
    outVars(ln, b || { x: 0, y: 0, w: 1, h: 1 }, dir);
    ln._L = L; ln._c = { L: L, poly: poly, box: b, n: n, color: color, k: k, p: p };
    if (area === 'mark') return markBody(ln, box, inner, L, d, b, pic, base, f, ln._c);
    if (area !== 'scene') clip(ln, poly, num(L.soft, 0, 0, 40));
    if (pic) {
      // Картинка грузится, только когда слой впервые виден (wake) — невидимые слои страницу не тяжелят
      var im = el('img', 'ys-dl-pic'), fit = L.ratioOn === key && area !== 'frag'; im.alt = ''; im.setAttribute('data-src', src(base, pic)); im.draggable = false;
      if (fit) im.style.height = 'auto';
      if (L.bright != null && L.bright !== '' && +L.bright !== 100) im.style.filter = 'brightness(' + num(L.bright, 100, 20, 250) / 100 + ')';
      if (area === 'frag') {
        var sc = num(L.scale, 100, 50, 200) / 100;
        im.className = 'ys-dl-frag';
        im.style.left = ((b.cx - b.w * sc / 2) * 100) + '%'; im.style.top = ((b.cy - b.h * sc / 2) * 100) + '%';
        im.style.width = (b.w * sc * 100) + '%'; im.style.height = (b.h * sc * 100) + '%';
      }
      inner.appendChild(im);
      // Окрасить картинку (утренние розовые облака, серые…): цвет ложится только на саму картинку, яркость её сохраняется
      if (area !== 'frag' && hexOk(L.tint) && +L.tintPow > 0) {
        var tn = el('div', 'ys-dl-tint'); tn.style.background = L.tint; tn.style.opacity = num(L.tintPow, 0, 0, 100) / 100;
        tn.setAttribute('data-mask', src(base, pic)); if (fit) tn.setAttribute('data-fit', '1'); inner.style.isolation = 'isolate'; inner.appendChild(tn);
      }
    }
    if (+L.fill > 0) { var fl = el('div', 'ys-dl-fill'); fl.style.background = color; fl.style.opacity = num(L.fill, 0, 0, 100) / 100; inner.appendChild(fl); }
    box.appendChild(inner); ln.appendChild(box);
    if (f.run) f.run(ln, { L: L, poly: poly, box: b, n: n, color: color, k: k, p: p });
    return ln;
  }

  /* След тона в рамке выбранной двери: знак по центру рамки (пропорции сохраняются), поправка двери — сдвиг, масштаб, поворот.
     Без картинки, но с заливкой — мягкий светящийся круг цвета следа. clip — только внутри контура. */
  function markBody(ln, box, inner, L, d, b, pic, base, f, c) {
    var fx = d.markFix || {}, sc = num(L.scale, 100, 20, 300) / 100 * num(fx.scale, 100, 20, 300) / 100;
    var w = b.w * sc, h = b.h * sc, cx = b.cx + num(fx.x, 0, -200, 200) / 100 * b.w, cy = b.cy + num(fx.y, 0, -200, 200) / 100 * b.h;
    var m = el('div', 'ys-dl-mark');
    m.style.left = ((cx - w / 2) * 100) + '%'; m.style.top = ((cy - h / 2) * 100) + '%'; m.style.width = (w * 100) + '%'; m.style.height = (h * 100) + '%';
    if (+fx.rot) m.style.transform = 'rotate(' + num(fx.rot, 0, -180, 180) + 'deg)';
    if (pic && isSvg(pic)) {
      // SVG — знак рисуется линией (svgMark): грузится, когда слой виден; «проявление» ему не нужно — он проступает линиями
      var sb = el('div', 'ys-dl-svg'); m.appendChild(sb);
      ln._svg = { url: src(base, pic), box: sb, color: c.color, line: L.line, glow: L.glow, ms: Math.round(num(L.draw, 3, .5, 20) * 1000 / c.k) };
      if (L.fx === 'reveal') f = FX.none;
    } else if (pic) { var im = el('img'); im.alt = ''; im.setAttribute('data-src', src(base, pic)); im.draggable = false; m.appendChild(im); }
    if (+L.fill > 0) { var g = el('i', 'ys-dl-disc'); g.style.background = 'radial-gradient(closest-side,' + c.color + ',transparent)'; g.style.opacity = num(L.fill, 0, 0, 100) / 100; m.appendChild(g); }
    if (L.clip) clip(ln, c.poly, num(L.soft, 0, 0, 40));
    inner.appendChild(m); box.appendChild(inner); ln.appendChild(box);
    ln.classList.add('ys-dl--mark');
    if (f.run) f.run(ln, c);
    return ln;
  }

  /* ---------- Знак следа в SVG — «рисуется линией» (08.10, ТЗ — docs/tz-svg-sled.md) ----------
     Знак вставляется в страницу как есть (после чистки svgClean): все цвета заменены на цвет следа (currentColor).
     Наутро, когда след впервые проступил, линии прорисовываются по очереди (порядок — как в файле), заливки проявляются после линий;
     в остальные разы знак просто стоит. PNG/WebP-следы — как раньше. */
  var SVG_TAGS = { svg: 1, g: 1, path: 1, line: 1, polyline: 1, polygon: 1, circle: 1, ellipse: 1, rect: 1 };
  var SVG_SHAPES = { path: 1, line: 1, polyline: 1, polygon: 1, circle: 1, ellipse: 1, rect: 1 };
  var SVG_ATTRS = { d: 1, points: 1, x1: 1, y1: 1, x2: 1, y2: 1, cx: 1, cy: 1, r: 1, rx: 1, ry: 1, x: 1, y: 1, width: 1, height: 1, transform: 1, viewBox: 1, preserveAspectRatio: 1 };
  var SVG_PAINT = { fill: 1, stroke: 1, 'stroke-width': 1, 'stroke-linecap': 1, 'stroke-linejoin': 1, 'stroke-miterlimit': 1, opacity: 1, 'fill-opacity': 1, 'stroke-opacity': 1, 'fill-rule': 1 };
  function isSvg(v) { return /^data:image\/svg\+xml/i.test(v || '') || /\.svg(\?|#|$)/i.test(v || ''); }
  function cssDecl(s, to) { String(s || '').split(';').forEach(function (p) { var i = p.indexOf(':'); if (i > 0) to[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim(); }); return to; }
  /* Чистка: остаются только svg, g и простые фигуры с геометрией и обводкой/заливкой; текст, картинки, скрипты, ссылки, фильтры, градиенты — убираются.
     Стили (style="…" и простые правила .класс{…} из <style>) переводятся в атрибуты. Вернёт { svg — строка, lines, fills, cut — что убрано } или null. */
  function svgClean(text) {
    var doc, root, rules = {}, cut = {}, lines = 0, fills = 0;
    try { doc = new DOMParser().parseFromString(String(text || ''), 'image/svg+xml'); } catch (e) { return null; }
    root = doc && doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
    Array.prototype.forEach.call(root.getElementsByTagName('style'), function (st) {
      String(st.textContent || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/([^{}]+)\{([^}]*)\}/g, function (m, sel, body) {
        sel.split(',').forEach(function (s) { s = s.trim(); if (/^\.[\w-]+$/.test(s)) cssDecl(body, rules[s.slice(1)] = rules[s.slice(1)] || {}); });
      });
    });
    var out = document.implementation.createDocument(SVGNS, 'svg', null), top = out.documentElement;
    function paint(v) { v = String(v || '').trim(); return /^none$|^transparent$/i.test(v) ? 'none' : 'currentColor'; }
    function copy(a, b, inh) {
      var p = {}, i, k, v;
      (a.getAttribute('class') || '').split(/\s+/).forEach(function (c) { if (rules[c]) for (k in rules[c]) p[k] = rules[c][k]; });
      for (i = 0; i < a.attributes.length; i++) { k = a.attributes[i].name; if (SVG_PAINT[k]) p[k] = a.attributes[i].value; }
      cssDecl(a.getAttribute('style'), p);
      for (i = 0; i < a.attributes.length; i++) {
        k = a.attributes[i].name; v = a.attributes[i].value;
        if (SVG_ATTRS[k] && !/[<>"]|url\(|script:/i.test(v)) b.setAttribute(k, v);
      }
      for (k in p) if (SVG_PAINT[k]) {
        v = p[k];
        if (k === 'fill' || k === 'stroke') b.setAttribute(k, paint(v));
        else if (!/[()<>"]/.test(v)) b.setAttribute(k, v);
      }
      return { fill: b.getAttribute('fill') || inh.fill, stroke: b.getAttribute('stroke') || inh.stroke };
    }
    function walk(a, b, inh) {
      Array.prototype.forEach.call(a.childNodes, function (c) {
        if (c.nodeType !== 1) return;
        var t = c.nodeName.toLowerCase().replace(/^svg:/, '');
        if (!SVG_TAGS[t] || t === 'svg') { if (!/^(title|desc|metadata|style|defs)$/.test(t)) cut[t] = 1; return; }
        var n = out.createElementNS(SVGNS, t), me = copy(c, n, inh);
        if (SVG_SHAPES[t]) { if (me.stroke !== 'none') lines++; else if (me.fill !== 'none') fills++; }
        b.appendChild(n);
        if (t === 'g') walk(c, n, me);
      });
    }
    var inh = copy(root, top, { fill: 'currentColor', stroke: 'none' });
    if (!top.getAttribute('fill')) top.setAttribute('fill', 'currentColor');
    if (!top.getAttribute('viewBox')) {
      var w = parseFloat(root.getAttribute('width')), h = parseFloat(root.getAttribute('height'));
      if (w > 0 && h > 0) top.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    }
    top.removeAttribute('width'); top.removeAttribute('height');
    walk(root, top, inh);
    if (!lines && !fills) return null;
    return { svg: new XMLSerializer().serializeToString(top), lines: lines, fills: fills, cut: Object.keys(cut) };
  }
  // Текст SVG по адресу (data: или файл на сайте) — один раз на адрес
  var SVG_CACHE = {};
  function svgLoad(u, done) {
    if (SVG_CACHE[u]) { if (SVG_CACHE[u].ok) done(SVG_CACHE[u].v); else SVG_CACHE[u].q.push(done); return; }
    var c = SVG_CACHE[u] = { q: [done] };
    function fin(t) { var x = svgClean(t); c.ok = true; c.v = x; c.q.forEach(function (f) { f(x); }); c.q = null; }
    var m = /^data:[^,]*?(;base64)?,(.*)$/i.exec(u);
    if (m) { try { fin(m[1] ? decodeURIComponent(escape(atob(m[2]))) : decodeURIComponent(m[2])); } catch (e) { fin(''); } return; }
    var x = new XMLHttpRequest();
    x.open('GET', u); x.onload = function () { fin(x.status < 300 ? x.responseText : ''); }; x.onerror = function () { fin(''); };
    x.send();
  }
  // Готовый знак: узел <svg> цвета color
  /* o: { line — толщина линий (1 — как в файле, 2.5 — в 2,5 раза толще), glow — свечение вокруг линий, % } (09.10: на маленькой двери
     линия в 2 % ширины знака тоньше волоса; толще — заметнее, но остаётся рисунком, а не пятном) */
  function svgNode(c, color, o) {
    var n = new DOMParser().parseFromString(c.svg, 'image/svg+xml').documentElement, k = num(o && o.line, 1, .5, 6), g = num(o && o.glow, 0, 0, 100);
    n = document.importNode(n, true);
    n.setAttribute('class', 'ys-svgmark'); n.setAttribute('aria-hidden', 'true'); n.setAttribute('focusable', 'false');
    n.style.color = color;
    if (k !== 1) {
      if (!n.hasAttribute('stroke-width')) n.setAttribute('stroke-width', '1');
      [n].concat(Array.prototype.slice.call(n.querySelectorAll('[stroke-width]'))).forEach(function (e) {
        var w = parseFloat(e.getAttribute('stroke-width')); if (w > 0) e.setAttribute('stroke-width', +(w * k).toFixed(2));
      });
    }
    if (g) n.style.filter = 'drop-shadow(0 0 ' + (g / 25).toFixed(1) + 'px ' + color + ') drop-shadow(0 0 ' + (g / 10).toFixed(1) + 'px ' + color + ')';
    return n;
  }
  /* Прорисовать линии знака: ms — сколько идут все линии вместе (каждая — по своей длине), потом проявляются заливки.
     Вернёт, сколько длится всё, мс. */
  function svgDraw(n, ms) {
    var all = Array.prototype.filter.call(n.querySelectorAll('*'), function (e) { return SVG_SHAPES[e.nodeName.toLowerCase()]; }), lines = [], fills = [], sum = 0, t = 250;
    all.forEach(function (e) {
      var cs = getComputedStyle(e), L = 0;
      if (cs.stroke && cs.stroke !== 'none') {
        try { L = e.getTotalLength(); } catch (x) { L = 0; }
        if (!(L > 0)) { e.setAttribute('pathLength', '1000'); L = 1000; e._pl = true; }
        lines.push([e, L]); sum += e._pl ? 0 : L;
      }
      if (cs.fill && cs.fill !== 'none') fills.push(e);
    });
    lines.forEach(function (x) {
      var e = x[0], L = x[1], d = Math.max(180, ms * (e._pl || !sum ? 1 / lines.length : L / sum));
      e.style.strokeDasharray = L + ' ' + L; e.style.strokeDashoffset = L; e.style.opacity = 0;
      x.push(t, d); t += d;
    });
    fills.forEach(function (e) { e.style.fillOpacity = 0; });
    void n.getBoundingClientRect();
    lines.forEach(function (x) {
      var e = x[0];
      e.style.transition = 'stroke-dashoffset ' + x[3] + 'ms ease-in-out ' + x[2] + 'ms, opacity 0s linear ' + x[2] + 'ms';
      e.style.strokeDashoffset = 0; e.style.opacity = '';
    });
    var fo = lines.length ? 900 : 1400;
    fills.forEach(function (e) {
      var v = e.getAttribute('fill-opacity');
      e.style.transition = (e.style.transition ? e.style.transition + ', ' : '') + 'fill-opacity ' + fo + 'ms ease ' + t + 'ms';
      e.style.fillOpacity = v || 1;
    });
    var end = t + (fills.length ? fo : 0) + 80;
    setTimeout(function () { all.forEach(function (e) { e.style.cssText = ''; if (e._pl) e.removeAttribute('pathLength'); }); }, end);
    return end;
  }
  // Знак в слое следа: загрузился — встаёт; если след проступает на глазах (want) — рисуется
  function svgMark(ln) {
    var S = ln._svg; if (!S || S.busy || S.done) return;
    S.busy = true;
    svgLoad(S.url, function (c) {
      S.busy = false; if (!c) return;
      var n = svgNode(c, S.color, S); S.box.replaceChildren(n); S.done = true;
      if (S.want && !REDUCED) svgDraw(n, S.ms);
    });
  }
  // Картинка знака для холста («Моя фигура»): тот же знак цвета color, размер — по viewBox
  function svgImg(u, color, ok, o) {
    svgLoad(u, function (c) {
      if (!c) { ok(null); return; }
      var vb = ((/viewBox="([^"]+)"/.exec(c.svg) || [])[1] || '0 0 600 900').split(/[\s,]+/);
      var t = o && num(o.line, 1, .5, 6) !== 1 ? new XMLSerializer().serializeToString(svgNode(c, color, { line: o.line })).replace(/ (class|style|aria-hidden|focusable)="[^"]*"/g, '') : c.svg;
      var s = t.replace(/currentColor/g, color).replace(/^<svg /, '<svg width="' + (+vb[2] || 600) + '" height="' + (+vb[3] || 900) + '" ');
      var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); };
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    });
  }

  /* Уходы считаются по рамке двери (по всей сцене — у слоёв без контура): --bw/--bh — размер рамки, --rw/--rh — овал «от центра» и «сгорает»,
     --m0/--m1 — где начинается и кончается таяние, --s0/--s1 — шторка от края рамки до края */
  function outVars(ln, b, dir) {
    function P(v) { return (v * 100).toFixed(2) + '%'; }
    ln.style.setProperty('--bw', P(b.w)); ln.style.setProperty('--bh', P(b.h));
    ln.style.setProperty('--rw', P(b.w * .72)); ln.style.setProperty('--rh', P(b.h * .72));
    var k = 3 * b.h; if (Math.abs(1 - k) < .05) k = 1.1;
    ln.style.setProperty('--mh', P(k)); ln.style.setProperty('--m0', P(b.y / (1 - k))); ln.style.setProperty('--m1', P((b.y - 2 * b.h) / (1 - k)));
    var s0 = [0, 0, 0, 0], s1 = [0, 0, 0, 0];
    if (dir[1] < 0) { s0[2] = 1 - b.y - b.h; s1[2] = 1 - b.y; } else if (dir[1] > 0) { s0[0] = b.y; s1[0] = b.y + b.h; }
    else if (dir[0] < 0) { s0[1] = 1 - b.x - b.w; s1[1] = 1 - b.x; } else { s0[3] = b.x; s1[3] = b.x + b.w; }
    ln.style.setProperty('--s0', 'inset(' + s0.map(P).join(' ') + ')'); ln.style.setProperty('--s1', 'inset(' + s1.map(P).join(' ') + ')');
  }
  // Замкнутая плавная кривая через точки контура (Катмулл — Ром → кривые Безье): свет по краю не показывает изломы между точками
  // Настоящие углы (поворот круче 55°, как низ двери) остаются острыми, мелкие изломы по дуге сглаживаются.
  function smoothD(a) {
    var n = a.length, i, p0, p1, p2, p3, f = function (v) { return v.toFixed(1); }, d = 'M' + f(a[0][0]) + ',' + f(a[0][1]), sharp = [];
    for (i = 0; i < n; i++) {
      p0 = a[(i - 1 + n) % n]; p1 = a[i]; p2 = a[(i + 1) % n];
      var t = Math.abs(Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) - Math.atan2(p1[1] - p0[1], p1[0] - p0[0]));
      sharp[i] = Math.min(t, 2 * Math.PI - t) > 0.96;
    }
    for (i = 0; i < n; i++) {
      p0 = a[(i - 1 + n) % n]; p1 = a[i]; p2 = a[(i + 1) % n]; p3 = a[(i + 2) % n];
      var k1 = sharp[i] ? 0 : 1 / 6, k2 = sharp[(i + 1) % n] ? 0 : 1 / 6;
      d += 'C' + f(p1[0] + (p2[0] - p0[0]) * k1) + ',' + f(p1[1] + (p2[1] - p0[1]) * k1) + ' ' + f(p2[0] - (p3[0] - p1[0]) * k2) + ',' + f(p2[1] - (p3[1] - p1[1]) * k2) + ' ' + f(p2[0]) + ',' + f(p2[1]);
    }
    return d + 'Z';
  }
  /* Линия по контуру: координаты — в пропорциях сцены (измеряются, когда слой виден), чтобы толщина была ровной,
     а бегущий свет — одним отрезком (с non-scaling-stroke длина штриха считалась в пикселях экрана — выходили чёрточки) */
  function fitLine(ln, n) {
    var s = ln._line, b = ln.getBoundingClientRect();
    if (!b.width || !b.height) { if ((n || 0) < 20) setTimeout(function () { fitLine(ln, (n || 0) + 1); }, 250); return; }
    var W = 1000, H = 1000 * b.height / b.width, d = smoothD(s._poly.map(function (p) { return [p[0] * W, p[1] * H]; }));
    s.setAttribute('viewBox', '0 0 ' + W + ' ' + H.toFixed(1));
    s.style.setProperty('--k', (W / b.width).toFixed(4));
    Array.prototype.forEach.call(s.querySelectorAll('path'), function (g) { g.setAttribute('d', d); });
    if (s._band) {
      // Блик: косая полоса шире двери в полтора раза по высоте, проходит слева направо (--x0 → --x1, в единицах рисунка)
      var bx = bbox(s._poly), x = bx.x * W, y = bx.y * H, w = bx.w * W, h = bx.h * H, bw = Math.max(w * .4, 10);
      s._band.setAttribute('x', 0); s._band.setAttribute('y', (y - h * .3).toFixed(1)); s._band.setAttribute('width', bw.toFixed(1)); s._band.setAttribute('height', (h * 1.6).toFixed(1));
      s.style.setProperty('--x0', (x - bw * 1.6).toFixed(1) + 'px'); s.style.setProperty('--x1', (x + w + bw * .6).toFixed(1) + 'px');
      s.style.setProperty('--cy', (y + h / 2).toFixed(1) + 'px');
    }
    if (s._halo) {
      // Ореол: размытие — по размеру двери (снаружи шире, кайма внутри уже); фильтры и маска — на весь рисунок с запасом
      var hb = bbox(s._poly), m = Math.sqrt(hb.w * W * hb.h * H), so = Math.max(m * .26, 3), si = Math.max(m * .09, 1.5), X = s._halo;
      [X.fo, X.fi, X.mk].forEach(function (f) { f.setAttribute('x', -W * .5); f.setAttribute('y', -H * .5); f.setAttribute('width', W * 2); f.setAttribute('height', H * 2); });
      X.mk.firstChild.setAttribute('x', -W * .5); X.mk.firstChild.setAttribute('y', -H * .5); X.mk.firstChild.setAttribute('width', W * 2); X.mk.firstChild.setAttribute('height', H * 2);
      X.fo.firstChild.setAttribute('stdDeviation', so.toFixed(1)); X.fi.firstChild.setAttribute('stdDeviation', si.toFixed(1));
      s.querySelector('.ys-fx-halo-out').setAttribute('stroke-width', (so * 1.8).toFixed(1));
      s.querySelector('.ys-fx-halo-in').setAttribute('stroke-width', (si * 2.4).toFixed(1));
    }
  }
  // Слой впервые виден — картинки начинают грузиться
  function wake(ln) {
    if (ln._awake) return; ln._awake = true;
    if (ln._svg) svgMark(ln);
    Array.prototype.forEach.call(ln.querySelectorAll('img[data-src]'), function (im) { im.src = im.getAttribute('data-src'); im.removeAttribute('data-src'); });
    Array.prototype.forEach.call(ln.querySelectorAll('[data-mask]'), function (t) {
      var u = 'url("' + t.getAttribute('data-mask') + '")';
      t.style.webkitMaskImage = t.style.maskImage = u; t.style.webkitMaskSize = t.style.maskSize = t.hasAttribute('data-fit') ? '100% auto' : '100% 100%';
      if (t.hasAttribute('data-fit')) { t.style.webkitMaskRepeat = t.style.maskRepeat = 'no-repeat'; t.style.webkitMaskPosition = t.style.maskPosition = 'top'; }
      t.removeAttribute('data-mask');
    });
  }
  function stopOut(ln) {
    if (!ln._out) return;
    clearTimeout(ln._out.t); if (ln._out.end) ln._out.end();
    ln.classList.remove('is-out', 'ys-out-' + ln._out.k); ln._out = null;
  }
  // Показать / убрать слой. now — сразу, без движения. Уходит так, как задано у слоя (out); вернёт, сколько длится уход, мс
  function show(ln, on, now) {
    var L = ln._L || {};
    if (on) {
      if (ln._svg && !ln._svg.done) ln._svg.want = !now;
      wake(ln); stopOut(ln);
      if (ln._line) fitLine(ln);
      if (now) ln.classList.add('is-now');
      if (!ln.classList.contains('is-on')) {
        ln.classList.add('is-on');
        // «Проявление» — заново каждый раз, когда слой появляется
        if (!now && ln.classList.contains('ys-fx-reveal')) { ln.classList.remove('ys-fx-reveal'); void ln.offsetWidth; ln.classList.add('ys-fx-reveal'); }
      }
      if (now) { void ln.offsetWidth; ln.classList.remove('is-now'); }
      return 0;
    }
    if (ln._out) return 0;
    if (!ln.classList.contains('is-on')) { ln.classList.remove('is-on'); return 0; }
    if (now || REDUCED || !OUT_OK[L.out]) {
      if (now) ln.classList.add('is-now');
      ln.classList.remove('is-on');
      if (now) { void ln.offsetWidth; ln.classList.remove('is-now'); }
      return now ? 0 : num(L.fade, 900, 0, 8000);
    }
    var k = L.out, ms = num(L.outMs, 1600, 200, 8000);
    ln.style.setProperty('--out', ms + 'ms');
    var end = OUT_RUN[k] ? OUT_RUN[k](ln, ln._c || {}) : null;
    void ln.offsetWidth;
    ln.classList.add('is-out', 'ys-out-' + k);
    ln._out = { k: k, end: end, t: setTimeout(function () {
      ln.classList.add('is-now'); ln.classList.remove('is-on');
      stopOut(ln); void ln.offsetWidth; ln.classList.remove('is-now');
    }, ms) };
    return ms;
  }

  /* ---------- Сцена ----------
     o: { key — 'desktop' | 'mobile', base, onTap(n), zones — показать контуры, all — и выключенные двери (панель),
          pic — другая картинка вместо сцены (обложка), still — без касаний (обложка: нажатие переворачивает карточку) }.
     Возвращает { node, img, set(n, состояние, сразу), state(n), poly(n), door(n), zones(да/нет) }. Размер и место node задаёт тот, кто её показывает. */
  function scene(r, o) {
    o = o || {};
    var key = o.key || 'desktop', D = cfg(r), N = count(r), G = {}, W = {};
    var stage = el('div', 'ys-dstage'), img = el('img', 'ys-dscene'), wrap = el('div', 'ys-doors'), world = el('div', 'ys-dworld'), worldTop = el('div', 'ys-dworld ys-dworld--top');
    var hit = sv('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', class: 'ys-dhit' + (o.zones ? ' is-zones' : '') });
    img.alt = ''; img.draggable = false;
    if (o.pic || D[key]) img.src = src(o.base, o.pic || D[key]); else stage.classList.add('is-empty');
    stage.appendChild(img); stage.appendChild(world); stage.appendChild(wrap); stage.appendChild(worldTop); if (!o.still) stage.appendChild(hit);
    // Мировые слои дней (мир и погода) — на всю сцену, под дверями (или поверх — top); видны, когда их включает страница (world(день, да/нет))
    for (var y = 1; y <= days(r); y++) W[y] = (dayCfg(r, y).world || []).map(function (L) {
      if (!L || L.visible === false) return null;
      var ln = layerNode(worldLayer(r, L), {}, 100 + y, key, o.base);
      if (ln) (L.top ? worldTop : world).appendChild(ln);
      return ln;
    }).filter(Boolean);
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
    // Состояние двери; вернёт, сколько длится самый долгий уход слоя (мс) — страница может подождать, пока облака разойдутся
    function set(n, st, now, can) {
      var x = G[n], ms = 0; if (!x) return 0;
      x.st = st;
      x.list.forEach(function (it) { ms = Math.max(ms, show(it.ln, layerOn(it.L, st), now) || 0); });
      x.g.setAttribute('data-st', st);
      if (x.pg) {
        x.pg.setAttribute('class', 'ys-dpoly is-' + st);
        var today = can != null ? !!can : st === 'today_unvisited' || st === 'today_visited';
        if (today) { x.pg.setAttribute('class', 'ys-dpoly is-' + st + ' is-can'); x.pg.removeAttribute('aria-hidden'); }
        if (today) { x.pg.setAttribute('tabindex', '0'); x.pg.setAttribute('role', 'button'); x.pg.setAttribute('aria-label', 'Дверь дня ' + n); }
        else { x.pg.removeAttribute('tabindex'); x.pg.removeAttribute('role'); x.pg.setAttribute('aria-hidden', 'true'); }
      }
      return ms;
    }
    // След тона дня day на двери n (now — сразу, без проявления); day = 0 — убрать
    function mark(n, day, now) {
      var x = G[n]; if (!x) return;
      if (x.mk && x.mkDay === day) return;
      if (x.mk) { x.mk.remove(); x.mk = null; }
      if (!day) return;
      var M = markOf(r, day);
      if (!M.image && !(+M.fill > 0) && !(FX[M.fx] && M.fx !== 'none')) return;
      var ln = layerNode({ area: 'mark', image: M.image, color: M.color, fill: M.fill, opacity: M.opacity, blend: M.blend, fx: M.fx || 'reveal', speed: M.speed, power: M.power, fade: M.fade == null ? 1600 : M.fade, draw: M.draw, line: M.line, glow: M.glow, scale: M.scale, clip: M.clip, soft: M.soft }, doorOf(r, n), n, key, o.base);
      if (!ln) return;
      x.g.appendChild(ln); x.mk = ln; x.mkDay = day;
      if (now) show(ln, true, true); else { void ln.offsetWidth; show(ln, true, false); }
    }
    /* Узор пространства на двери n (день day, поворот a); day = 0 — убрать. Лежит под следом тона, над слоями двери.
       Прозрачность и мягкий край — doors.patternOpacity, patternSoft; появляется мягко (now — сразу). */
    function pattern(n, day, a, now, gl) {
      var x = G[n]; if (!x) return;
      var my = day + ':' + a + ':' + JSON.stringify(gl || []);
      if (x.pt && x.ptKey === my) return;
      if (x.pt) { x.pt.remove(); x.pt = null; x.ptKey = null; }
      if (!day || !x.poly) return;
      var Dc = cfg(r), box = el('div', 'ys-dpat'), b = bbox(x.poly);
      box.style.setProperty('--pat-o', num(Dc.patternOpacity, 100, 0, 100) / 100);
      clip(box, x.poly, num(Dc.patternSoft, 0, 0, 40));
      x.pt = box; x.ptKey = my;
      x.g.insertBefore(box, x.mk || null);
      function put() {
        kalDoor(r, day, a, x.poly, img, o.base, function (cv) {
          if (!cv || x.ptKey !== my) return;
          cv.className = 'ys-dpat-cv';
          cv.style.left = (b.x * 100) + '%'; cv.style.top = (b.y * 100) + '%'; cv.style.width = (b.w * 100) + '%'; cv.style.height = (b.h * 100) + '%';
          var f = kalFilter(kalOn(r, day)); if (f) cv.style.filter = f;
          box.appendChild(cv);
          if (now || REDUCED) box.classList.add('is-on'); else { void box.offsetWidth; box.classList.add('is-on'); }
        }, gl);
      }
      if (img.complete && img.naturalWidth) put(); else img.addEventListener('load', put);
    }
    // Число дня на выбранной двери (showDayNumbers)
    function numOn(n, t) {
      var x = G[n]; if (!x || !x.poly) return;
      if (x.nm) x.nm.remove();
      if (!t) { x.nm = null; return; }
      var b = bbox(x.poly), s = el('span', 'ys-dnum', t);
      s.style.left = (b.cx * 100) + '%'; s.style.top = ((b.y + b.h) * 100) + '%';
      wrap.appendChild(s); x.nm = s;
    }
    /* Блик по свободным дверям по очереди (движение сцены, не двери): list — номера дверей; пусто — блика нет.
       c: { color, ms — пауза между дверями }. Останавливается сам, когда сцену убрали со страницы. */
    var callT = null, callEls = [];
    function call(list, c) {
      clearInterval(callT); callEls.forEach(function (e) { e.remove(); }); callEls = [];
      if (REDUCED || !list || !list.length) return;
      c = c || {};
      list.forEach(function (n) {
        var x = G[n]; if (!x || !x.poly) return;
        var b = bbox(x.poly), e = el('div', 'ys-dcall'), gl = el('div', 'ys-fx-glint');
        e.style.setProperty('--fx-c', hexOk(c.color) ? c.color : '#fff1c8');
        clip(e, x.poly, 0);
        gl.style.left = (b.x * 100) + '%'; gl.style.top = (b.y * 100) + '%'; gl.style.width = (b.w * 100) + '%'; gl.style.height = (b.h * 100) + '%';
        gl.appendChild(el('i')); e.appendChild(gl); wrap.appendChild(e); callEls.push(e);
      });
      if (!callEls.length) return;
      var i = -1, ms = num(c.ms, 1800, 600, 8000);
      function step() {
        if (!stage.isConnected && i >= 0) { clearInterval(callT); return; }
        if (i >= 0) callEls[i % callEls.length].classList.remove('is-run');
        i++;
        var e = callEls[i % callEls.length]; void e.offsetWidth; e.classList.add('is-run');
      }
      setTimeout(step, 400); callT = setInterval(step, ms);
    }
    /* Жест дня (обложка на витрине): точка на картинке + движение; круг считается по пропорциям картинки, поэтому — когда она загрузилась.
       y = 0 — убрать. */
    var gst = null, gy = 0;
    function gesture(y) {
      if (gst) { gst.remove(); gst = null; }
      gy = y;
      var g = y ? dayCfg(r, y).gesture : null, pt = g && g.on !== false && g[key];
      if (!pt || pt.length < 2) return;
      function put() {
        if (gy !== y || gst) return;
        var k = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : (key === 'mobile' ? 9 / 16 : 16 / 9);
        var rx = num(g.size, 14, 2, 80) / 200, ry = rx * k, poly = [], i;
        for (i = 0; i < 28; i++) poly.push([pt[0] + Math.cos(i / 28 * 2 * Math.PI) * rx, pt[1] + Math.sin(i / 28 * 2 * Math.PI) * ry]);
        var z = {}; z[key] = poly;
        var ln = layerNode({ area: g.image ? 'frag' : 'door', desktop: g.image, mobile: g.image, color: g.color, fill: g.fill, opacity: g.opacity, blend: g.blend,
          soft: g.soft == null ? 18 : g.soft, fx: g.fx || 'glow', speed: g.speed, power: g.power, fade: 1200, scale: 100 }, { zone: z }, 200 + y, key, o.base);
        if (!ln) return;
        if (g.image) ln.style.webkitClipPath = ln.style.clipPath = ln.style.webkitMaskImage = ln.style.maskImage = '';
        ln.classList.add('ys-dgest'); wrap.appendChild(ln); gst = ln;
        void ln.offsetWidth; show(ln, true, false);
      }
      if (img.complete && img.naturalWidth) put(); else img.addEventListener('load', put);
    }
    return { node: stage, img: img, key: key, set: set, state: function (n) { return G[n] ? G[n].st : null; },
      poly: function (n) { return G[n] ? G[n].poly : null; }, door: function (n) { return G[n] ? G[n].g : null; },
      world: function (y, on, now) { var ms = 0; (W[y] || []).forEach(function (ln) { ms = Math.max(ms, show(ln, on, now) || 0); }); return ms; },
      mark: mark, pattern: pattern, num: numOn, call: call, gesture: gesture,
      zones: function (on) { hit.setAttribute('class', 'ys-dhit' + (on ? ' is-zones' : '')); } };
  }
  // Где сцена на экране: целиком (по краям — размытая та же картинка) или во весь экран (края срезаются)
  function fit(stage, iw, ih, mode, W, H) {
    var s = mode === 'cover' ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih);
    stage.style.width = iw * s + 'px'; stage.style.height = ih * s + 'px';
    stage.style.left = (W - iw * s) / 2 + 'px'; stage.style.top = (H - ih * s) / 2 + 'px';
  }

  /* ---------- Пространство архетипа — живой калейдоскоп из картинки (09.10, docs/doors.md «Калейдоскоп пространства») ----------
     Картинка дня — «камера» внутри трубки: сдвинута от центра и медленно поворачивается, клин отражается в зеркалах — узор перетекает
     (как «Эскиз гримуара»). У пространства: kal = { on, image, n — зеркал (8 | 12 | 16), speed — скорость, %, bright — ярче и сочнее, %,
     zoom — крупность узора, % (меньше — трубка берёт больше картинки: мельче и чётче), contrast — контраст, %, sharp — чёткость линий, %, vign — тень к краям, % }.
     Узор человека — один поворот трубки (a, радианы): хранится на его устройстве, по нему узор перерисовывается на двери, обложке и в фигуре. */
  var KCX = .28, KCY = .1, KSPIN = .072, KPAD = .03;
  function kalOf(sp) { var k = sp && sp.kal; return k && k.on && k.image ? k : null; }
  function kalOn(r, day) { return kalOf(spaceOf(r, day)); }
  function kalN(k) { var n = +k.n; return n === 8 || n === 16 ? n : 12; }
  function kalFilter(k) { var v = num(k.bright, 100, 50, 200) / 100; return v === 1 ? '' : 'brightness(' + v + ') saturate(' + (1 + (v - 1) * .8).toFixed(2) + ')'; }
  var kWedge = null;
  /* Контраст и чёткость линий (09.10) — один раз на картинку, прямо в точках: дальше узор рисуется как обычно, без лишней работы в кадре.
     Чёткость — «нерезкая маска»: к картинке прибавляется её разница с чуть размытой копией (линии и края резче). */
  function kalPrep(im, k) {
    var c = num(k.contrast, 100, 50, 200) / 100, a = num(k.sharp, 0, 0, 100) / 100 * 2.5, key = c + '/' + a;
    if (c === 1 && !a) return im;
    if (im._m13p && im._m13p.key === key) return im._m13p.cv;
    var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height, cv, x, d, o, b, i, j, v;
    try {
      cv = document.createElement('canvas'); cv.width = w; cv.height = h; x = cv.getContext('2d');
      x.drawImage(im, 0, 0); d = x.getImageData(0, 0, w, h); o = d.data;
    } catch (e) { return im; }
    if (a) b = kalBlur(im, o, w, h);
    for (i = 0; i < o.length; i += 4) for (j = i; j < i + 3; j++) {
      v = o[j]; if (a) v += (v - b[j]) * a;
      o[j] = (v - 128) * c + 128;
    }
    x.putImageData(d, 0, 0);
    im._m13p = { key: key, cv: cv };
    return cv;
  }
  // Размытая копия: браузер умеет сам (быстро); не умеет — размытие на 1 точку по строкам и столбцам, два раза
  function kalBlur(im, o, w, h) {
    var cv = document.createElement('canvas'), x = cv.getContext('2d'), b, t, n, y, i, e, c, r;
    if ('filter' in x) {
      cv.width = w; cv.height = h; x.filter = 'blur(1px)'; x.drawImage(im, 0, 0);
      try { return x.getImageData(0, 0, w, h).data; } catch (er) {}
    }
    b = new Float32Array(o); t = new Float32Array(o.length); r = w * 4;
    for (n = 0; n < 2; n++) {
      for (y = 0; y < h; y++) for (i = y * r, e = i + r; i < e; i++) t[i] = (b[i - 4 < y * r ? i : i - 4] + b[i] + b[i + 4 >= e ? i : i + 4]) / 3;
      for (i = 0; i < o.length; i++) b[i] = (t[i < r ? i : i - r] + t[i] + t[i + r < o.length ? i + r : i]) / 3;
    }
    return b;
  }

  /* Стёклышки и искры в узоре (шаг 2, 09.10): лежат в самой картинке-«камере» — плывут вместе с ней и отражаются в зеркалах.
     Стёклышко = { at: [x, y] — место в долях R (от центра «камеры»), c: [r, g, b], look — вид камня (вкладка «Стёклышки»), k: 'glass' | 'spark', ph — фаза мерцания }.
     Хранится на устройстве: g = [{ x, y, id, k, c, l }] — l: какой вид (days | gifts.axis | …), вид берётся из настроек маршрута при рисовании. */
  var KGLASS = .055, KLOOK = { days: { kind: 'gem', cut: 'rect' }, 'gifts.axis': { kind: 'gem', cut: 'round' }, 'gifts.spoke': { kind: 'crystal' }, 'gifts.rim': { kind: 'gem', cut: 'tri' }, 'gifts.underside': { kind: 'gem', cut: 'hex' } };
  function kalLook(r, l, base) {
    var p = String(l || 'days').split('.'), g = r.glass || {}, d = KLOOK[l] || KLOOK.days, L = (p[1] ? (g[p[0]] || {})[p[1]] : g[p[0]]) || d, o = {}, k;
    for (k in L) o[k] = L[k];
    if (!o.kind) o.kind = d.kind;
    if (o.img) o.img = src(base, o.img);
    return o;
  }
  // Сохранённые стёклышки → для рисования (узор на двери, обложка, фигура)
  function kalPcs(r, g, base) {
    return (Array.isArray(g) ? g : []).filter(function (s) { return s && isFinite(+s.x) && isFinite(+s.y) && Array.isArray(s.c); })
      .map(function (s, i) { return { at: [+s.x, +s.y], c: s.c, look: kalLook(r, s.l, base), k: s.k === 'spark' ? 'spark' : 'glass', ph: i * 1.7 }; });
  }
  // Картинки камней («своя картинка») — загрузить до того, как узор рисуется один раз (дверь, фигура)
  function kalPre(P, done) {
    var l = (P || []).filter(function (p) { return p.k === 'glass' && p.look.kind === 'image' && p.look.img; }).map(function (p) { return p.look.img; });
    if (l.length && window.M13K && window.M13K.preload) window.M13K.preload(l, done); else done();
  }
  function kalSize(r) { return KGLASS * num(cfg(r).kalGlassSize, 100, 50, 200) / 100; }
  function rgbA(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function liftC(c, k) { return [Math.round(c[0] + (255 - c[0]) * k), Math.round(c[1] + (255 - c[1]) * k), Math.round(c[2] + (255 - c[2]) * k)]; }
  var kSpr = {};
  // Камень так же, как в узоре маршрута (kaleido.js, M13K.stone); нет kaleido.js (витрина) — простое стёклышко
  function kalSprite(it) {
    var key = it.c.join(',') + '|' + [it.look.kind, it.look.cut, it.look.shine, it.look.img].join('|');
    if (kSpr[key]) return kSpr[key];
    if (!window.M13K || !window.M13K.stone) return null;
    var cv = document.createElement('canvas'); window.M13K.stone(cv, it.c, it.look, 96);
    return (kSpr[key] = cv);
  }
  function kalPiece(x, it, r, t) {
    if (it.k === 'spark') {
      var k = .75 + .25 * Math.sin(t * 2.2 + it.ph), R = r * (2.1 + .4 * k), c = it.c;
      x.save(); x.globalCompositeOperation = 'lighter';
      var g2 = x.createRadialGradient(0, 0, 0, 0, 0, R);
      g2.addColorStop(0, 'rgba(255,255,255,1)'); g2.addColorStop(.12, 'rgba(255,255,255,' + (.9 * k) + ')'); g2.addColorStop(.28, rgbA(c, .75 * k)); g2.addColorStop(.6, rgbA(c, .2 * k)); g2.addColorStop(1, rgbA(c, 0));
      x.fillStyle = g2; x.beginPath(); x.arc(0, 0, R, 0, 6.2832); x.fill();
      x.strokeStyle = rgbA(liftC(c, .7), .85 * k); x.lineWidth = Math.max(.8, r * .06);
      x.beginPath(); x.moveTo(-R * 1.1, 0); x.lineTo(R * 1.1, 0); x.moveTo(0, -R * 1.1); x.lineTo(0, R * 1.1); x.stroke();
      x.restore(); return;
    }
    r *= num(it.look.size, 100, 50, 200) / 100;
    var sp = kalSprite(it);
    if (sp && sp.width) { x.drawImage(sp, -r, -r, r * 2, r * 2); return; }
    // Запасное стёклышко (как в пробе): многоугольник с бликом
    x.save(); x.rotate(it.ph);
    var gr = x.createRadialGradient(-r * .35, -r * .35, r * .05, 0, 0, r * 1.1), j;
    gr.addColorStop(0, rgbA(liftC(it.c, .75), .95)); gr.addColorStop(.45, rgbA(it.c, .85)); gr.addColorStop(1, rgbA(it.c, .55));
    x.fillStyle = gr; x.beginPath();
    for (j = 0; j < 6; j++) { var b = j * 6.2832 / 6, rr = r * (j % 2 ? .82 : 1); x[j ? 'lineTo' : 'moveTo'](Math.cos(b) * rr, Math.sin(b) * rr); }
    x.closePath(); x.globalAlpha = .8; x.fill();
    x.globalAlpha = .5; x.strokeStyle = '#fff'; x.lineWidth = Math.max(.7, r * .035); x.stroke();
    x.restore(); x.globalAlpha = 1;
  }

  /* Узор в прямоугольник W×H (центр трубки — середина); reveal — сама картинка, без зеркал (кнопка «Что внутри?»).
     P — стёклышки в узоре (см. выше), ps — их размер в долях R, t — время (мерцание искр) */
  function kalDraw(c, W, H, im, k, ang, reveal, P, ps, t) {
    var R = Math.sqrt(W * W + H * H) / 2 + 2, n = kalN(k), A = 2 * Math.PI / n, sw = im.naturalWidth || im.width, sh = im.naturalHeight || im.height;
    if (!sw || !sh) return;
    im = kalPrep(im, k);
    // Крупность: 100 % — как было; меньше — в клин попадает больше картинки, она меньше растянута (не меньше 70 %: картинка закрывает клин при любом повороте)
    var sc = R * 2.3 * num(k.zoom, 100, 70, 130) / 100 / Math.min(sw, sh);
    function cam(x) {
      x.rotate(ang); x.drawImage(im, -sw * sc / 2, -sh * sc / 2, sw * sc, sh * sc);
      (P || []).forEach(function (it) { if (!it.at) return; x.save(); x.translate(it.at[0] * R, it.at[1] * R); kalPiece(x, it, (ps || KGLASS) * R, t || 1.2); x.restore(); });
    }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#07060b'; c.fillRect(0, 0, W, H);
    if (reveal) { c.translate(W / 2, H / 2); cam(c); c.restore(); return; }
    // Клин чуть шире сектора: соседние отражения перекрываются, на стыках нет тонких линий
    var pad = Math.ceil(R * Math.sin(KPAD)) + 3, ww = Math.ceil(R) + 2, wh = Math.ceil(R * Math.sin(Math.min(A + KPAD, Math.PI / 2))) + pad + 4;
    var wc = kWedge = kWedge || document.createElement('canvas');
    if (wc.width !== ww || wc.height !== wh) { wc.width = ww; wc.height = wh; }
    var wg = wc.getContext('2d');
    wg.setTransform(1, 0, 0, 1, 0, 0); wg.clearRect(0, 0, ww, wh);
    wg.save(); wg.translate(0, pad); wg.beginPath(); wg.moveTo(0, 0); wg.arc(0, 0, R + 2, -KPAD, A + KPAD); wg.closePath(); wg.clip();
    wg.translate(R * KCX, R * KCY); cam(wg); wg.restore();
    c.translate(W / 2, H / 2);
    for (var i = 0; i < n; i++) {
      c.save();
      if (i % 2) { c.rotate((i + 1) * A); c.scale(1, -1); } else c.rotate(i * A);
      c.drawImage(wc, 0, -pad); c.restore();
    }
    // Мягкая тень к краям — узор глубже
    var v = c.createRadialGradient(0, 0, R * .5, 0, 0, R); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,' + num(k.vign, 40, 0, 60) / 100 + ')');
    if (num(k.vign, 40, 0, 60)) { c.fillStyle = v; c.fillRect(-W / 2, -H / 2, W, H); }
    c.restore();
  }
  function kalImg(base, k, f) { var im = new Image(); im.onload = function () { f(im); }; im.onerror = function () { f(null); }; im.src = src(base, k.image); return im; }

  /* Живой калейдоскоп на весь экран пространства. Провёл — повернул трубку; коснулся — мягкий толчок (с затуханием).
     Выбрано стёклышко в чаше — касание кладёт его в узор; коснулся своего стёклышка в узоре — оно вернулось в чашу.
     o: { base, a — с какого поворота начать (сохранённый узор), still — без движения (предпросмотр снимка),
          bowl — стёклышки человека [{ id, c, l, look, k }], g — сохранённые места [{ x, y, id }], ps — размер стёклышка (доли R), onPut — что-то положили/вернули }.
     Возвращает { node, ang(), mine, sel(i), placed(), freeze(да/нет), reveal(да/нет) }; останавливается сам, когда пространство убрали со страницы. */
  function kalLive(k, o) {
    var cv = el('canvas', 'ys-kal-cv'), g = cv.getContext('2d'), im = null, q = Math.min(1.5, window.devicePixelRatio || 1);
    var S = { ang: +o.a || 0, vel: 0, t: 0, frozen: false, reveal: false, sel: -1 }, drag = null, last = 0, slow = 0, started = false;
    var at = {}; (o.g || []).forEach(function (p) { if (p && p.id != null && isFinite(+p.x) && isFinite(+p.y)) at[p.id] = [+p.x, +p.y]; });
    var mine = (o.bowl || []).map(function (b, i) { return { id: b.id, c: b.c, l: b.l, look: b.look || {}, k: b.k === 'spark' ? 'spark' : 'glass', ph: i * 1.7, at: at[b.id] || null }; });
    var ps = o.ps || KGLASS;
    cv.setAttribute('aria-label', 'Живой узор пространства'); cv.setAttribute('role', 'img');
    var f = kalFilter(k); if (f) cv.style.filter = f;
    kalImg(o.base, k, function (x) { im = x; kalPre(mine, draw); draw(); });
    function draw() {
      var w = Math.round((cv.clientWidth || window.innerWidth) * q), h = Math.round((cv.clientHeight || window.innerHeight) * q);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      if (im) kalDraw(g, w, h, im, k, S.ang, S.reveal, mine, ps, S.t);
    }
    function loop(ts) {
      if (started && !cv.isConnected) return;
      if (cv.isConnected) started = true;
      var dt = last ? Math.min(.1, (ts - last) / 1000) : 0; last = ts;
      if (!S.frozen && !o.still) {
        S.t += REDUCED ? 0 : dt;
        S.ang += (REDUCED ? 0 : KSPIN * num(k.speed, 100, 10, 400) / 100 * dt) + S.vel; S.vel *= .95;
        var t0 = performance.now(); draw();
        // Телефон не успевает — чуть меньше точек (узор тот же)
        if (performance.now() - t0 > 26) { if (++slow > 10 && q > .6) { q *= .85; slow = 0; } } else slow = 0;
      }
      requestAnimationFrame(loop);
    }
    // Точка на экране → место в «камере» (через зеркала), в долях R
    function toCam(ex, ey) {
      var bx = cv.getBoundingClientRect(), W = cv.width, H = cv.height, R = Math.sqrt(W * W + H * H) / 2 + 2, A = 2 * Math.PI / kalN(k);
      var px = (ex - bx.left) * W / (bx.width || 1) - W / 2, py = (ey - bx.top) * H / (bx.height || 1) - H / 2, c = Math.cos(-S.ang), s = Math.sin(-S.ang), wx, wy;
      if (S.reveal) { wx = px; wy = py; }
      else {
        var r = Math.sqrt(px * px + py * py), th = Math.atan2(py, px); if (th < 0) th += 2 * Math.PI;
        var i = Math.floor(th / A), l = th - i * A; if (i % 2) l = A - l;
        wx = r * Math.cos(l) - R * KCX; wy = r * Math.sin(l) - R * KCY;
      }
      return [(wx * c - wy * s) / R, (wx * s + wy * c) / R];
    }
    function changed() { if (o.onPut) o.onPut(); if (REDUCED || o.still) draw(); }
    cv.addEventListener('pointerdown', function (e) { if (S.frozen) return; drag = { x: e.clientX, y: e.clientY, a: S.ang, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (er) {} });
    cv.addEventListener('pointermove', function (e) {
      if (!drag) return; var dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4 || Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
      if (drag.moved) { S.ang = drag.a + dx * .006; S.vel = 0; if (REDUCED) draw(); }
    });
    function up(e) {
      if (!drag) return; var m = drag.moved; drag = null; if (m || S.frozen) return;
      if (mine.length) {
        var p = toCam(e.clientX, e.clientY), i;
        if (S.sel >= 0 && mine[S.sel]) { mine[S.sel].at = [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]; S.sel = -1; changed(); return; }
        for (i = mine.length - 1; i >= 0; i--) {
          var it = mine[i]; if (!it.at) continue;
          var dx = it.at[0] - p[0], dy = it.at[1] - p[1];
          if (Math.sqrt(dx * dx + dy * dy) < ps * 1.7) { it.at = null; changed(); return; }
        }
      }
      S.vel += .045; if (REDUCED) { S.ang += .5; draw(); }
    }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', function () { drag = null; });
    window.addEventListener('resize', function () { if (cv.isConnected) draw(); });
    requestAnimationFrame(loop);
    return { node: cv, ang: function () { return S.ang; }, draw: draw, mine: mine, ps: ps,
      sel: function (i) { if (i === undefined) return S.sel; S.sel = i; },
      placed: function () { return mine.filter(function (m) { return m.at; }).map(function (m) { return { x: m.at[0], y: m.at[1], id: m.id, k: m.k, c: m.c, l: m.l }; }); },
      freeze: function (v) { S.frozen = !!v; S.vel = 0; draw(); },
      reveal: function (v) { S.reveal = !!v; draw(); } };
  }

  /* Узор на двери (сцена, обложка): холст в рамке двери, обрезан по контуру; центр трубки — середина рамки.
     key, poly — контур на этой картинке, scn — картинка сцены (её пропорции нужны для рамки), done(холст | null) */
  function kalDoor(r, day, a, poly, scn, base, done, g) {
    var k = kalOn(r, day); if (!k || !poly) { done(null); return; }
    var P = kalPcs(r, g, base);
    kalImg(base, k, function (im) { kalPre(P, function () { put(im); }); });
    function put(im) {
      if (!im) { done(null); return; }
      var b = bbox(poly), iw = scn.naturalWidth || 1600, ih = scn.naturalHeight || 900, rw = b.w * iw, rh = b.h * ih, s = 520 / Math.max(rw, rh);
      var cv = document.createElement('canvas'); cv.width = Math.max(8, Math.round(rw * s)); cv.height = Math.max(8, Math.round(rh * s));
      kalDraw(cv.getContext('2d'), cv.width, cv.height, im, k, a, false, P, kalSize(r));
      done(cv);
    }
  }
  /* Что видно на двери дня day сегодня (n): след тона и/или узор. P — сохранённые узоры этого устройства { день: { a, g — его стёклышки } }.
     doors.pattern: '' — узор и знак тона поверх | 'pattern' — только узор | 'mark' — только знак (как раньше);
     doors.patternNone: '' — не сохранил узор: знак тона | 'archetype' — узор архетипа (картинка дня, без его поворота) после конца дня. */
  function face(r, day, n, P) {
    var D = cfg(r), mk = markOn(r, day, n), p = (P || {})[day], show = D.pattern || '';
    if (!kalOn(r, day) || show === 'mark') return { mark: mk, pat: null };
    if (p && typeof p === 'object' && isFinite(+p.a)) return { mark: show !== 'pattern' && mk, pat: +p.a, g: p.g || null };
    if (D.patternNone === 'archetype' && mk) return { mark: show !== 'pattern', pat: 0 };
    return { mark: mk, pat: null };
  }

  /* ---------- Пространство за дверью ----------
     o: { base, tall, mode, ctx, fill, put (текст с переносами), backText, onBack, act(kind, блок), code — есть личный код } */
  function space(r, sp, o) {
    sp = sp || {};
    var tall = !!o.tall, bgSrc = tall ? sp.mobile || sp.desktop : sp.desktop || sp.mobile;
    var root = el('section', 'ys-space ys-space--' + (sp.place || 'center') + ' ys-space--' + (sp.plate || 'glass'));
    var bg = el('div', 'ys-space-bg');
    bg.style.backgroundColor = hexOk(sp.color) ? sp.color : '#0d0906';
    var K = kalOf(sp), live = null;
    if (K) {
      live = kalLive(K, { base: o.base, a: o.kalA, still: o.still, bowl: o.kalBowl, g: o.kalG, ps: o.kalPs, onPut: function () { if (live.onPut) live.onPut(); } });
      bg.appendChild(live.node); root.classList.add('ys-space--kal');
      if (o.kalSave && o.kalBowl && o.kalBowl.length) root.classList.add('ys-space--bowl');
    }
    else if (bgSrc) bg.style.backgroundImage = 'url("' + src(o.base, bgSrc) + '")';
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
        var tx = el('div', 'ys-sp-text');
        t.split(/\n{2,}/).forEach(function (p) { tx.appendChild(put(el('p'), p)); });
        // Свёрнутый текст: заголовок-кнопка, нажали — текст раскрылся (текст медитации)
        if (b.fold) { n = el('details', 'ys-sp-fold'); n.appendChild(put(el('summary'), T(b.foldTitle).trim() || 'Текст')); n.appendChild(tx); }
        else n = tx;
      } else if (b.kind === 'trace') {
        // «Оставить след» — ссылка своего формата (Путешествие — группа, Погружение — Проводник); у Наблюдения кнопки нет
        var url = ((o.trace || {})[o.mode]) || '';
        if (o.mode === 'observation' || (!url && !o.empty)) return;
        n = el('a', 'ys-sp-btn ys-sp-btn--trace', T(b.label).trim() || o.traceText || 'Оставить след');
        if (url) { n.href = url; n.target = '_blank'; n.rel = 'noopener'; } else n.setAttribute('aria-disabled', 'true');
      } else if (b.kind === 'image') {
        if (!b.image) return;
        n = el('figure', 'ys-sp-img'); var im = el('img'); im.alt = ''; im.src = src(o.base, b.image); n.appendChild(im);
        if (b.text) n.appendChild(put(el('figcaption'), T(b.text)));
      } else if (b.kind === 'audio') {
        if (!b.audio) return;
        n = audioBlock(b, o, T(b.text).trim(), put);
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
    if (live) root.appendChild(kalBar(live, o));
    return root;
  }
  /* Кнопки калейдоскопа внизу: чаша со стёклышками человека (если есть), «Что внутри?» (сама картинка, вращается)
     и «Сохранить мой узор» (узор застывает и ложится на дверь дня вместе со стёклышками).
     o.kalSave(a, g) — сохранить поворот и стёклышки (нет — кнопки «Сохранить» и чаши нет: Наблюдение, финал); o.kalTx — надписи; o.onBack — к дверям. */
  function kalBar(live, o) {
    var t = o.kalTx || {}, bar = el('div', 'ys-kal-bar'), row = el('div', 'ys-kal-row'), hint = el('p', 'ys-kal-hint');
    var M = o.kalSave ? live.mine : [], bowl = null;
    var peek = el('button', 'ys-kal-btn ys-kal-btn--ghost', t.peek || 'Что внутри?'), on = false; peek.type = 'button';
    peek.addEventListener('click', function () { on = !on; live.reveal(on); peek.textContent = on ? t.unpeek || 'Снова узор' : t.peek || 'Что внутри?'; });
    row.appendChild(peek);
    // Подсказка: своя из панели — пока ничего не выбрано и не положено; дальше — что делать сейчас
    function say() {
      var sel = live.sel(), placed = M.some(function (m) { return m.at; }), s;
      if (!M.length) s = t.hint || '';
      else if (sel >= 0) s = t.place || 'Теперь коснитесь узора — туда оно и ляжет';
      else if (placed) s = t.back || 'Коснитесь своего стёклышка в узоре — оно вернётся в чашу';
      else s = t.hint || t.pick || 'Коснитесь своего стёклышка, потом — узора';
      hint.textContent = s; hint.hidden = !s;
    }
    // Чаша: стёклышки, ещё не положенные в узор. Коснулся — выбрано (ещё раз — снято)
    function fill() {
      if (!bowl) return;
      bowl.textContent = '';
      var left = 0;
      M.forEach(function (it, i) {
        if (it.at) return; left++;
        var b = el('button', 'ys-kal-it' + (live.sel() === i ? ' is-on' : '')), c = el('canvas');
        b.type = 'button'; b.setAttribute('aria-pressed', live.sel() === i ? 'true' : 'false');
        b.setAttribute('aria-label', it.k === 'spark' ? 'Искра света' : 'Стёклышко');
        c.width = c.height = 84; b.appendChild(c);
        var x = c.getContext('2d'); x.translate(42, 42); kalPiece(x, it, it.k === 'spark' ? 13 : 30, 1.2);
        // Камень со своей картинкой ещё грузится — дорисовать, когда загрузится
        if (it.k === 'glass' && it.look.kind === 'image') kalPre([it], function () { x.clearRect(-42, -42, 84, 84); kalPiece(x, it, 30, 1.2); });
        b.addEventListener('click', function () { live.sel(live.sel() === i ? -1 : i); fill(); say(); });
        bowl.appendChild(b);
      });
      if (!left) bowl.appendChild(el('span', 'ys-kal-empty', t.empty || 'Все ваши стёклышки — в узоре'));
    }
    if (M.length) {
      bowl = el('div', 'ys-kal-bowl'); bowl.setAttribute('role', 'group'); bowl.setAttribute('aria-label', t.bowl || 'Ваши стёклышки');
      live.onPut = function () { fill(); say(); };
    }
    if (o.kalSave) {
      var sv = el('button', 'ys-kal-btn', t.save || 'Сохранить мой узор'); sv.type = 'button';
      sv.addEventListener('click', function () {
        if (on) { on = false; live.reveal(false); peek.textContent = t.peek || 'Что внутри?'; }
        live.sel(-1); fill(); say();
        live.freeze(true); o.kalSave(live.ang(), live.placed());
        var done = el('div', 'ys-kal-done'), plate = el('div', 'ys-kal-plate'), r2 = el('div', 'ys-kal-row');
        plate.appendChild(el('b', '', t.saved || 'Ваш узор сохранён'));
        plate.appendChild(el('p', '', t.savedNote || 'Он ляжет на вашу дверь этого дня.'));
        var again = el('button', 'ys-kal-btn ys-kal-btn--ghost', t.again || 'Покрутить ещё'), home = el('button', 'ys-kal-btn', o.backText || '← Назад к дверям');
        again.type = home.type = 'button';
        again.addEventListener('click', function () { done.remove(); live.freeze(false); bar.hidden = false; });
        home.addEventListener('click', function () { if (o.onBack) o.onBack(); });
        r2.appendChild(again); r2.appendChild(home); plate.appendChild(r2); done.appendChild(plate);
        bar.hidden = true; bar.parentNode.appendChild(done);
        try { home.focus({ preventScroll: true }); } catch (e) {}
      });
      row.appendChild(sv);
    }
    bar.appendChild(hint);
    if (bowl) bar.appendChild(bowl);
    bar.appendChild(row);
    fill(); say();
    return bar;
  }
  /* Аудио в пространстве: кнопка со значком (наушники, волна, круги, голос — на выбор в панели), подпись, полоска времени.
     Во время звучания значок — дышащая волна. Запись не грузится, пока не нажали (preload none); ушли из пространства — пауза (back). */
  var AU_IC = {
    phones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="7" rx="1.8"/><rect x="16.5" y="14" width="4.5" height="7" rx="1.8"/>',
    wave: '<path d="M3 12h1.5M6.5 8v8M10 5v14M13.5 9v6M17 6.5v11M20.5 10.5v3"/>',
    rings: '<circle cx="12" cy="12" r="1.6"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
    voice: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>'
  };
  var AU_NAMES = [['phones', 'наушники'], ['wave', 'звуковая волна'], ['rings', 'расходящиеся круги'], ['voice', 'голос (микрофон)']];
  function auSvg(k) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (AU_IC[k] || AU_IC.phones) + '</svg>'; }
  function mmss(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ':' + ('0' + t % 60).slice(-2); }
  function audioBlock(b, o, cap, put) {
    var box = el('div', 'ys-sp-audio'), btn = el('button', 'ys-au-btn'), main = el('div', 'ys-au-main'), bar = el('div', 'ys-au-bar'), fillb = el('i'), time = el('span', 'ys-au-t');
    var a = el('audio'); a.preload = 'none'; a.src = src(o.base, b.audio);
    var rest = AU_IC[b.icon] ? b.icon : 'phones', wave = '<span class="ys-au-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
    btn.type = 'button'; btn.innerHTML = auSvg(rest); btn.setAttribute('aria-label', cap || 'Слушать');
    function ui() {
      var on = !a.paused && !a.ended;
      box.classList.toggle('is-play', on);
      btn.innerHTML = on ? wave : auSvg(rest);
      btn.setAttribute('aria-label', on ? 'Пауза' : cap || 'Слушать');
    }
    function tick() {
      var d = a.duration;
      fillb.style.width = d && isFinite(d) ? (a.currentTime / d * 100) + '%' : '0';
      time.textContent = d && isFinite(d) ? mmss(a.currentTime) + ' / ' + mmss(d) : a.currentTime ? mmss(a.currentTime) : '';
    }
    btn.addEventListener('click', function () { if (a.paused || a.ended) { var p = a.play(); if (p && p.catch) p.catch(function () {}); } else a.pause(); });
    bar.addEventListener('click', function (e) {
      var d = a.duration; if (!d || !isFinite(d)) return;
      var rc = bar.getBoundingClientRect(); a.currentTime = Math.max(0, Math.min(1, (e.clientX - rc.left) / rc.width)) * d; tick();
    });
    ['play', 'pause', 'ended'].forEach(function (ev) { a.addEventListener(ev, ui); });
    ['timeupdate', 'loadedmetadata', 'durationchange'].forEach(function (ev) { a.addEventListener(ev, tick); });
    a.addEventListener('ended', function () { a.currentTime = 0; tick(); });
    bar.appendChild(fillb);
    if (cap) main.appendChild(put(el('p', 'ys-au-cap'), cap));
    main.appendChild(bar); main.appendChild(time);
    box.appendChild(btn); box.appendChild(main); box.appendChild(a);
    return box;
  }
  function hush(node) { Array.prototype.forEach.call(node.querySelectorAll('audio'), function (a) { try { a.pause(); } catch (e) {} }); }
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
    var ol = sc && n ? openLayer(sc, n, o) : null, hold = (ol ? num(op.hold, 900, 0, 6000) : g && op.tap !== false ? 260 : 0) + num(o.wait, 0, 0, 3000);
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
    hush(node);
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

  /* ---------- Живая обложка на витрине (заход «б») ----------
     Сцена (или своя картинка обложки) в том виде, какой она сегодня: двери — по календарю, мир — по дням (cover.world), жест сегодняшнего дня,
     личные следы — только если cover.marks и только с этого устройства (o.choice). Без касаний: нажатие по карточке переворачивает её.
     o: { key, base, day — день маршрута (0 — до начала, больше числа дней — после конца), choice — { день: id двери }, visits — { день: 'v' } (по порядку),
          pats — сохранённые узоры { день: { a, g } } (тоже с этого устройства) } */
  function cover(r, o) {
    var C = cfg(r).cover || {}, key = o.key, n = o.day, N = days(r), log = o.choice || {}, vis = o.visits || {}, ids = {}, d, k;
    var sc = scene(r, { key: key, base: o.base, pic: C[key] || '', still: true });
    if (isChoice(r)) {
      for (k in log) ids[log[k]] = +k;
      for (d = 1; d <= count(r); d++) {
        var dd = ids[doorOf(r, d).id] || 0;
        sc.set(d, !dd ? 'free' : dd === n ? 'today' : 'past', true, false);
        if (dd) { var fc = face(r, dd, n, o.pats); if (fc.mark) sc.mark(d, dd, true); if (fc.pat != null) sc.pattern(d, dd, fc.pat, true, fc.g); }
        if (dd && cfg(r).showDayNumbers) sc.num(d, String(dd));
      }
    } else for (d = 1; d <= N; d++) sc.set(d, d > n ? 'future' : (d === n ? 'today_' : 'past_') + (vis[d] === 'v' ? 'visited' : 'unvisited'), true, false);
    if (C.world !== false) for (k = 1; k <= N; k++) if (worldOn(r, k, n)) sc.world(k, true, true);
    if (n >= 1 && n <= N) sc.gesture(n);
    return sc;
  }
  // Картинка обложки для экрана: своя (cover) или сцена; key — как у сцены
  function coverPic(r, key) { var C = cfg(r).cover || {}; return C[key] || cfg(r)[key] || ''; }

  /* ---------- «Моя фигура» — одна картинка: сцена + мир состоявшихся дней + личные следы на выбранных дверях ----------
     Собирается здесь же, на устройстве (canvas), ничего никуда не отправляется. Движения не переносятся (картинка неподвижная);
     мягкий край следа «внутри контура» — там, где браузер умеет размывать на холсте, иначе ровный.
     o: { key, base, day — день маршрута, choice — { день: id двери }, pats — сохранённые узоры пространств { день: { a, g } } }; done(canvas | null) */
  function figure(r, o, done) {
    var D = cfg(r), key = o.key, N = days(r), n = o.day, log = o.choice || {}, jobs = [], i, k;
    if (!D[key]) { done(null); return; }
    function load(u) { return new Promise(function (ok) { if (!u) { ok(null); return; } var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = src(o.base, u); }); }
    var world = [], marks = [], pats = [];
    for (k = 1; k <= N; k++) if (worldOn(r, k, n)) world = world.concat((dayCfg(r, k).world || []).filter(function (L) { return L && L.visible !== false; }).map(function (L) { return worldLayer(r, L); }));
    for (k in log) for (i = 1; i <= count(r); i++) if (doorOf(r, i).id === log[k] && doorOf(r, i).on !== false && zoneOf(doorOf(r, i), key)) {
      var fc = face(r, +k, n, o.pats);
      if (fc.mark) marks.push({ day: +k, d: doorOf(r, i) });
      if (fc.pat != null) pats.push({ day: +k, d: doorOf(r, i), a: fc.pat, P: kalPcs(r, fc.g, o.base) });
    }
    jobs.push(load(D[key]));
    world.forEach(function (L) { jobs.push(load(L[key])); });
    pats.forEach(function (p) { jobs.push(new Promise(function (ok) { kalImg(o.base, kalOn(r, p.day), function (im) { kalPre(p.P, function () { ok(im); }); }); })); });
    marks.forEach(function (m) {
      var M = markOf(r, m.day);
      jobs.push(isSvg(M.image) ? new Promise(function (ok) { svgImg(src(o.base, M.image), hexOk(M.color) ? M.color : '#ffe2a0', ok, M); }) : load(M.image));
    });
    Promise.all(jobs).then(function (ims) {
      var bg = ims[0]; if (!bg) { done(null); return; }
      var W = bg.naturalWidth, H = bg.naturalHeight, f = Math.min(1, 4096 / Math.max(W, H));
      W = Math.round(W * f); H = Math.round(H * f);
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var c = cv.getContext('2d');
      c.drawImage(bg, 0, 0, W, H);
      function mode(b) { c.globalCompositeOperation = b && /^(screen|multiply|overlay|soft-light|color)$/.test(b) ? b : 'source-over'; }
      world.forEach(function (L, j) {
        var im = ims[1 + j], op = num(L.opacity, 100, 0, 100) / 100;
        if (im && (hexOk(L.tint) && +L.tintPow > 0 || (L.bright != null && L.bright !== '' && +L.bright !== 100))) {
          // Окраска и яркость погоды — на отдельном холсте: цвет только по самой картинке
          var tc = document.createElement('canvas'); tc.width = W; tc.height = H;
          var t = tc.getContext('2d');
          if (+L.bright && +L.bright !== 100 && 'filter' in t) t.filter = 'brightness(' + num(L.bright, 100, 20, 250) / 100 + ')';
          t.drawImage(im, 0, 0, W, H); t.filter = 'none';
          if (hexOk(L.tint) && +L.tintPow > 0) {
            t.globalCompositeOperation = 'color'; t.globalAlpha = num(L.tintPow, 0, 0, 100) / 100; t.fillStyle = L.tint; t.fillRect(0, 0, W, H);
            t.globalAlpha = 1; t.globalCompositeOperation = 'destination-in'; t.drawImage(im, 0, 0, W, H);
          }
          im = tc;
        }
        mode(L.blend);
        if (im) { c.globalAlpha = op; c.drawImage(im, 0, 0, W, H); }
        if (+L.fill > 0) { c.globalAlpha = op * num(L.fill, 0, 0, 100) / 100; c.fillStyle = hexOk(L.color) ? L.color : '#ffe2a0'; c.fillRect(0, 0, W, H); }
      });
      // Узоры пространств — в рамке двери, по контуру, под следами
      pats.forEach(function (p, j) {
        var im = ims[1 + world.length + j], poly = zoneOf(p.d, key), b = bbox(poly), Dc = cfg(r), kk = kalOn(r, p.day);
        if (!im) return;
        var w = Math.max(8, Math.round(b.w * W)), h = Math.max(8, Math.round(b.h * H)), pc = document.createElement('canvas'); pc.width = w; pc.height = h;
        kalDraw(pc.getContext('2d'), w, h, im, kk, p.a, false, p.P, kalSize(r));
        var lc = document.createElement('canvas'); lc.width = W; lc.height = H;
        var x = lc.getContext('2d'), f = kalFilter(kk);
        if (f && 'filter' in x) x.filter = f;
        x.drawImage(pc, b.x * W, b.y * H, w, h); x.filter = 'none';
        var mk = document.createElement('canvas'); mk.width = W; mk.height = H;
        var y = mk.getContext('2d'), soft = num(Dc.patternSoft, 0, 0, 40);
        if (soft && 'filter' in y) y.filter = 'blur(' + (soft / 10 / 100 * Math.min(W, H)).toFixed(1) + 'px)';
        y.beginPath(); poly.forEach(function (q, t) { if (t) y.lineTo(q[0] * W, q[1] * H); else y.moveTo(q[0] * W, q[1] * H); }); y.closePath(); y.fillStyle = '#fff'; y.fill();
        x.globalCompositeOperation = 'destination-in'; x.drawImage(mk, 0, 0);
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = num(Dc.patternOpacity, 100, 0, 100) / 100; c.drawImage(lc, 0, 0);
      });
      marks.forEach(function (m, j) {
        var M = markOf(r, m.day), im = ims[1 + world.length + pats.length + j], poly = zoneOf(m.d, key), b = bbox(poly), fx = m.d.markFix || {};
        var sc = num(M.scale, 100, 20, 300) / 100 * num(fx.scale, 100, 20, 300) / 100, w = b.w * sc * W, h = b.h * sc * H;
        var cx = (b.cx + num(fx.x, 0, -200, 200) / 100 * b.w) * W, cy = (b.cy + num(fx.y, 0, -200, 200) / 100 * b.h) * H;
        if (!im && !(+M.fill > 0)) return;
        // Слой следа рисуется отдельно (обрезка по контуру, мягкий край), потом ложится на картинку как задано
        var lc = document.createElement('canvas'); lc.width = W; lc.height = H;
        var x = lc.getContext('2d');
        x.translate(cx, cy); if (+fx.rot) x.rotate(num(fx.rot, 0, -180, 180) * Math.PI / 180);
        if (+M.fill > 0) {
          var rr = w * .3, gr = x.createRadialGradient(0, 0, 0, 0, 0, rr), col = hexOk(M.color) ? M.color : '#ffe2a0';
          gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
          x.globalAlpha = num(M.fill, 0, 0, 100) / 100; x.globalCompositeOperation = 'screen'; x.fillStyle = gr; x.fillRect(-rr, -rr, rr * 2, rr * 2);
          x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
        }
        if (im) { var s2 = Math.min(w / im.naturalWidth, h / im.naturalHeight), iw = im.naturalWidth * s2, ih = im.naturalHeight * s2; x.drawImage(im, -iw / 2, -ih / 2, iw, ih); }
        x.setTransform(1, 0, 0, 1, 0, 0);
        if (M.clip) {
          var mk = document.createElement('canvas'); mk.width = W; mk.height = H;
          var y = mk.getContext('2d'), soft = num(M.soft, 0, 0, 40);
          if (soft && 'filter' in y) y.filter = 'blur(' + (soft / 10 / 100 * Math.min(W, H)).toFixed(1) + 'px)';
          y.beginPath(); poly.forEach(function (p, q) { if (q) y.lineTo(p[0] * W, p[1] * H); else y.moveTo(p[0] * W, p[1] * H); }); y.closePath(); y.fillStyle = '#fff'; y.fill();
          x.globalCompositeOperation = 'destination-in'; x.drawImage(mk, 0, 0); x.globalCompositeOperation = 'source-over';
        }
        mode(M.blend); c.globalAlpha = num(M.opacity, 100, 0, 100) / 100; c.drawImage(lc, 0, 0);
      });
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      done(cv);
    });
  }

  window.M13D = { STATES: STATES, STATES_UC: STATES_UC, STATE_NAMES: STATE_NAMES, FX: FX, FLOW_DIR: FLOW_DIR, FLOW_SEAM: FLOW_SEAM, OPEN: OPEN, BLEND: BLEND, BLOCKS: BLOCKS, BTN_DEF: BTN_DEF, OUT: OUT, OUT_DIR: OUT_DIR, AU_NAMES: AU_NAMES,
    worldOn: worldOn, markOn: markOn, tap2: tap2, deep: deep, keyIcon: keyIcon, KEY_NAMES: KEY_NAMES, weather: weather, hush: hush, face: face, kalOf: kalOf, kalOn: kalOn, kalDraw: kalDraw, kalSize: kalSize,
    cfg: cfg, doorOf: doorOf, isChoice: isChoice, statesOf: statesOf, count: count, first: first, dayCfg: dayCfg, spaceOf: spaceOf, markOf: markOf, uid: uid, zoneOf: zoneOf, pick: pick, norm: norm, layerOn: layerOn, bbox: bbox, inPoly: inPoly, ptsOk: ptsOk,
    scene: scene, fit: fit, space: space, autoBlocks: autoBlocks, go: go, back: back, cover: cover, coverPic: coverPic, figure: figure,
    isSvg: isSvg, svgClean: svgClean, svgLoad: svgLoad, svgNode: svgNode, svgDraw: svgDraw };
})();
