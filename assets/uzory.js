/* «Узоры» — образные опросники 13 MIRRORS (решения 21.10.2026, docs/uzory.md).
   Страницы: uzory/ — список узоров (data-view="list"), uzory/<id>/ — сам узор (data-view="garden").
   Данные — data/uzory.json (правятся в панели, раздел «Узоры»); в предпросмотре панели — её черновик (window.parent.M13_UZ_DRAFT).
   Всё считается в браузере; на сервер ничего не уходит. «Сохранить себе» — картинка или текст на устройстве,
   «Написать проводнику» — копирует итог и открывает Telegram.
   Пространство узора — общее для всех узоров: 12 элементов хороводом, 13-й — человек (свет в центре).
   Вид элемента: живой (картинка PNG на прозрачном фоне) · линией (светящийся рисунок; он же — пока нет картинки) · стеклянная карта. */
(function () {
  'use strict';
  var BASE = '../../', D = null, SET = null, IT = null;

  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function str(v, d) { v = v == null ? '' : String(v); return v.trim() ? v : (d || ''); }
  function imgUrl(v) { return !v ? '' : /^(data:|blob:|https?:)/.test(v) ? v : BASE + v; }
  function getJSON(u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  // Род: в тексте «[Твой|Твоя|Твоё]» — форма по роду цветка (м, ж, ср; нет формы — первая). Свой цветок — «цветок», мужской.
  function gForm(s, g) {
    return String(s || '').replace(/\[([^\]]*)\]/g, function (m, x) {
      var p = x.split('|'), i = g === 'f' ? 1 : g === 'n' ? 2 : 0;
      return p[i] != null ? p[i] : p[0];
    });
  }
  function fill(s, map) { return String(s || '').replace(/\{(\w+)\}/g, function (m, k) { return map[k] != null ? map[k] : m; }); }
  function T(k, d) { return str(((IT && IT.ui) || {})[k], d); }

  function load() {
    if (window.M13_UZ_DATA) return Promise.resolve(window.M13_UZ_DATA);   // проба: данные внутри страницы
    try {
      if (window.parent !== window && window.parent.M13_UZ_DRAFT) return Promise.resolve(window.parent.M13_UZ_DRAFT());
    } catch (e) {}
    return Promise.all([getJSON(BASE + 'data/uzory.json'), getJSON(BASE + 'data/settings.json').catch(function () { return {}; })])
      .then(function (r) { return { uzory: r[0], settings: r[1] }; });
  }
  function boot() {
    var root = document.getElementById('uz');
    BASE = root.getAttribute('data-base') || '../../';
    load().then(function (d) {
      D = d.uzory || {}; SET = d.settings || {};
      if (root.getAttribute('data-view') === 'list') listPage(root);
      else {
        var id = root.getAttribute('data-id');
        IT = (D.items || []).filter(function (x) { return x && x.id === id && x.visible !== false; })[0];
        if (!IT) { notFound(root); return; }
        garden(root);
      }
    }).catch(function (e) {
      console.error(e);
      root.innerHTML = '<p style="padding:40px">Не получилось открыть страницу. Обновите её через минуту.</p>';
    });
  }

  /* ================= Рисунки-заглушки (до её картинок): 100 × 140, цветок «стоит» на нижнем крае ================= */
  var STEM = '#6f9c7a', LEAF = '#5d8c6c';
  function stem(x1, y1, x2, y2, c) { return '<path d="M' + x1 + ' ' + y1 + ' Q' + ((x1 + x2) / 2 + 4) + ' ' + ((y1 + y2) / 2) + ' ' + x2 + ' ' + y2 + '" stroke="' + (c || STEM) + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>'; }
  function leaf(x, y, a, l, w) { return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + l + '" ry="' + w + '" fill="' + LEAF + '" opacity=".9" transform="rotate(' + a + ' ' + x + ' ' + y + ')"/>'; }
  function ring(cx, cy, n, len, wid, col, off, op) { var s = '', i, a; for (i = 0; i < n; i++) { a = off + i * 360 / n; s += '<ellipse cx="' + cx + '" cy="' + (cy - len) + '" rx="' + wid + '" ry="' + len + '" fill="' + col + '" opacity="' + (op || 1) + '" transform="rotate(' + a + ' ' + cx + ' ' + cy + ')"/>'; } return s; }
  function dot(x, y, r, c, op) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + c + '"' + (op ? ' opacity="' + op + '"' : '') + '/>'; }
  function five(cx, cy, r, c) { return ring(cx, cy, 5, r, r * .7, c, 0) + dot(cx, cy, r * .45, '#f5d64a'); }
  var DRAW = {
    podsolnuh: function () { return stem(50, 140, 50, 58) + leaf(38, 100, -35, 14, 6) + leaf(63, 88, 30, 14, 6) + ring(50, 44, 22, 20, 5, '#f2c23a', 0) + ring(50, 44, 22, 15, 4, '#e6a91f', 8) + dot(50, 44, 13, '#5a3a1a') + dot(50, 44, 8, '#3d2711'); },
    romashka: function () { return stem(50, 140, 52, 60) + leaf(44, 104, -40, 11, 4) + ring(52, 48, 18, 17, 4.2, '#f6f3ea', 0) + dot(52, 48, 7.5, '#f2c23a'); },
    mak: function () { return stem(50, 140, 48, 64, '#7aa07f') + ring(48, 48, 4, 17, 15, '#e2443a', 45, .95) + ring(48, 48, 4, 13, 11, '#c22e2e', 0, .9) + dot(48, 48, 6, '#2a1a22') + dot(48, 48, 2.5, '#6b5a3a'); },
    lavanda: function () { var s = '', k, i, xs = [38, 50, 62], tops = [34, 22, 38]; for (k = 0; k < 3; k++) { s += stem(50, 140, xs[k], tops[k] + 20, '#88a594'); for (i = 0; i < 7; i++) s += '<ellipse cx="' + (xs[k] + (i % 2 ? 2 : -2)) + '" cy="' + (tops[k] + i * 5) + '" rx="3.4" ry="4.4" fill="' + (i % 2 ? '#a68ad8' : '#8f6fca') + '"/>'; } return s + leaf(44, 114, -60, 12, 2.5) + leaf(57, 116, 60, 12, 2.5); },
    oduvanchik: function () { var s = stem(36, 140, 34, 70) + stem(62, 140, 66, 50) + ring(34, 62, 16, 10, 3, '#f5d64a', 0) + dot(34, 62, 5, '#e9b02a'), i, a; for (i = 0; i < 20; i++) { a = i * Math.PI * 2 / 20; s += '<line x1="66" y1="40" x2="' + (66 + Math.cos(a) * 15).toFixed(1) + '" y2="' + (40 + Math.sin(a) * 15).toFixed(1) + '" stroke="#f3f0ff" stroke-width=".8" opacity=".85"/>' + dot((66 + Math.cos(a) * 15.5).toFixed(1), (40 + Math.sin(a) * 15.5).toFixed(1), 1.5, '#fff'); } return s + dot(84, 22, 1.4, '#fff', .8) + dot(88, 16, 1.2, '#fff', .6) + dot(80, 14, 1.2, '#fff', .7) + leaf(40, 112, -30, 12, 4); },
    pion: function () { return stem(50, 140, 50, 66) + leaf(38, 92, -30, 14, 6) + leaf(62, 98, 35, 14, 6) + ring(50, 48, 9, 20, 12, '#f5b8cf', 0, .95) + ring(50, 48, 8, 15, 10, '#f19fbe', 20, .95) + ring(50, 48, 7, 10, 7, '#e47ea4', 10) + dot(50, 48, 5, '#d8648f'); },
    podsnezhnik: function () { var s = '', d = [[34, 60], [52, 46], [68, 64]], i, x, y; for (i = 0; i < 3; i++) { x = d[i][0]; y = d[i][1]; s += '<path d="M' + x + ' 134 Q' + (x + 2) + ' ' + (y + 20) + ' ' + (x + 8) + ' ' + y + '" stroke="' + STEM + '" stroke-width="2" fill="none"/>' + '<path d="M' + (x + 8) + ' ' + (y + 2) + ' q-7 6 -4 18 q4 5 8 0 q3 -12 -4 -18z" fill="#f7fbff"/>' + '<path d="M' + (x + 8) + ' ' + y + ' q4 0 5 3" stroke="#7fb08a" stroke-width="2" fill="none"/>'; } return s + leaf(42, 110, -75, 14, 3) + leaf(60, 112, 70, 14, 3); },
    vasilyok: function () { var s = stem(52, 140, 52, 58) + '<path d="M28 140 Q26 80 22 54" stroke="#cfb36a" stroke-width="1.6" fill="none"/>' + '<path d="M76 140 Q78 86 82 60" stroke="#cfb36a" stroke-width="1.6" fill="none"/>', i; for (i = 0; i < 5; i++) s += '<ellipse cx="' + (22 + (i % 2 ? 2 : -2)) + '" cy="' + (54 + i * 5) + '" rx="2.2" ry="3.4" fill="#d9be72"/><ellipse cx="' + (82 + (i % 2 ? -2 : 2)) + '" cy="' + (60 + i * 5) + '" rx="2.2" ry="3.4" fill="#d9be72"/>'; for (i = 0; i < 9; i++) s += '<path d="M52 46 l-5 -15 l3 2 l2 -4 l2 4 l3 -2z" fill="#4f73e6" transform="rotate(' + (i * 40) + ' 52 46)"/>'; return s + dot(52, 46, 5, '#2d3f9a'); },
    liliya: function () { var s = stem(50, 140, 50, 66) + leaf(42, 100, -25, 16, 4) + leaf(58, 92, 25, 16, 4), i, a; for (i = 0; i < 6; i++) s += '<path d="M50 50 q-7 -14 0 -28 q7 14 0 28z" fill="#faf6ee" opacity=".95" transform="rotate(' + (i * 60) + ' 50 50)"/>'; for (i = 0; i < 5; i++) { a = (i * 72 - 90) * Math.PI / 180; s += '<line x1="50" y1="50" x2="' + (50 + Math.cos(a) * 12).toFixed(1) + '" y2="' + (50 + Math.sin(a) * 12).toFixed(1) + '" stroke="#c9a24a" stroke-width="1"/>' + dot((50 + Math.cos(a) * 12).toFixed(1), (50 + Math.sin(a) * 12).toFixed(1), 1.8, '#b8762e'); } return s; },
    roza: function () { return stem(50, 140, 50, 62, '#5e8a68') + '<path d="M48 90 l-4 -3 l5 -1z M52 104 l5 -3 l-5 -1z M49 118 l-5 -2 l5 -2z" fill="#4f7a5a"/>' + leaf(38, 96, -35, 12, 5) + leaf(62, 108, 35, 12, 5) + '<path d="M50 62 C34 60 32 40 42 32 C46 30 54 30 58 32 C68 40 66 60 50 62Z" fill="#b8304e"/>' + '<path d="M50 60 C40 56 40 42 46 38 C50 44 56 46 58 40 C62 50 58 58 50 60Z" fill="#d23c5c"/>' + '<path d="M44 36 C48 30 56 30 58 36 C54 34 48 34 44 36Z" fill="#e8607e"/>' + '<path d="M48 42 q4 -4 7 0" stroke="#8e2240" stroke-width="1.2" fill="none"/>'; },
    landysh: function () { var s = '<path d="M44 140 Q40 60 70 36" stroke="' + STEM + '" stroke-width="2" fill="none"/>' + '<ellipse cx="34" cy="100" rx="11" ry="32" fill="' + LEAF + '" transform="rotate(-12 34 100)"/>' + '<ellipse cx="62" cy="108" rx="10" ry="28" fill="#6a9a78" transform="rotate(14 62 108)"/>', b = [[46, 66], [50, 54], [56, 45], [63, 39], [70, 36]], i, x, y; for (i = 0; i < 5; i++) { x = b[i][0]; y = b[i][1]; s += '<path d="M' + x + ' ' + (y + 2) + ' v4" stroke="' + STEM + '" stroke-width="1.2"/><path d="M' + (x - 4.5) + ' ' + (y + 6) + ' q0 7 4.5 7 q4.5 0 4.5 -7z" fill="#f3f6ef"/>'; } return s; },
    nezabudka: function () { var s = stem(50, 140, 50, 70) + stem(50, 140, 34, 58) + stem(50, 140, 66, 56) + leaf(42, 110, -40, 12, 3.5), p = [[50, 56], [38, 48], [62, 46], [30, 62], [70, 60], [46, 40], [56, 66], [42, 70], [64, 34]], i; for (i = 0; i < p.length; i++) s += five(p[i][0], p[i][1], 4.6, i % 3 ? '#86b8f2' : '#a6cbf6'); return s; }
  };
  // Цветок без своего рисунка (новый в панели или «свой» у человека) — общий, в его цвете
  function drawAny(col) { return stem(50, 140, 50, 62) + leaf(40, 104, -35, 13, 5) + leaf(61, 94, 32, 13, 5) + ring(50, 46, 8, 17, 8, col, 0, .95) + ring(50, 46, 8, 11, 6, '#fff3dc', 22, .55) + dot(50, 46, 6, '#ffe3b0'); }
  function drawBud(col) {
    return stem(50, 140, 50, 74) + leaf(39, 110, -38, 14, 5) + leaf(61, 100, 34, 14, 5) +
      '<path d="M50 34 C40 46 39 62 50 72 C61 62 60 46 50 34Z" fill="' + col + '" opacity=".95"/>' +
      '<path d="M50 40 C46 50 46 62 50 70" stroke="#fff6e6" stroke-width="1" fill="none" opacity=".45"/>' +
      '<path d="M50 74 C43 72 39 65 40 57 C44 64 47 68 50 69Z" fill="' + LEAF + '"/><path d="M50 74 C57 72 61 65 60 57 C56 64 53 68 50 69Z" fill="' + LEAF + '"/>';
  }
  var SVG_HEAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" width="100" height="140" aria-hidden="true">';
  // «Линией»: заливки — в тонкий светящийся контур (рисунок «вырастает» штрихами — pathLength=1)
  function toLine(s) {
    return s.replace(/<(ellipse|circle|path|line)([^>]*?)\/>/g, function (m, tag, at) {
      var f = /fill="([^"]+)"/.exec(at), st = /stroke="/.test(at);
      if (f && f[1] !== 'none' && !st) at = at.replace(/fill="[^"]+"/, 'fill="none" stroke="' + f[1] + '" stroke-width="1.3"');
      else if (st) at = at.replace(/stroke-width="[^"]+"/, 'stroke-width="1.5"');
      // атрибуты не повторять: картинка для «Сохранить» читается как строгий SVG
      return '<' + tag + at.replace(/\sopacity="[^"]+"/, '') + ' pathLength="1"' + (/stroke-linecap=/.test(at) ? '' : ' stroke-linecap="round"') + '/>';
    });
  }
  function artSvg(fl, line) { var s = fl && DRAW[fl.id] ? DRAW[fl.id]() : drawAny((fl && fl.col) || '#f2c9a0'); return SVG_HEAD + (line ? toLine(s) : s) + '</svg>'; }
  function budSvg(fl, line) { var s = drawBud((fl && fl.col) || '#f2c9a0'); return SVG_HEAD + (line ? toLine(s) : s) + '</svg>'; }

  /* ================= Список узоров (uzory/) ================= */
  function listPage(root) {
    document.body.className = 'uz-body uz-list-page';
    var items = (D.items || []).filter(function (x) { return x && x.visible !== false; });
    var h = '<div class="uz-list"><a class="uz-eyebrow" href="' + BASE + '">' + esc(str(D.back, '← К витрине')) + '</a>' +
      '<h1 class="uz-h1">' + esc(str(D.title, 'Узоры')) + '</h1>' +
      (str(D.invite) ? '<p class="uz-list-lead">' + esc(D.invite) + '</p>' : '') +
      (str(D.lead) ? '<p class="uz-honest" style="max-width:46ch;font-size:14px">' + esc(D.lead) + '</p>' : '');
    if (!items.length) h += '<p class="uz-empty">Скоро здесь появятся узоры.</p>';
    else h += '<div class="uz-list-grid">' + items.map(function (it) {
      // картинка в списке: своя (панель: «Картинка в списке узоров»); у костра — кадр огня; иначе — первый цветок
      var fl = (it.flowers || [])[0], ks = (it.space || {}).scene === 'koster' ? (it.space.koster || {}) : null,
        img = str(it.cardImage) || (ks ? str(ks.poster, ks.video ? '' : 'assets/koster/ogon-7-poster.jpg') : '') || (fl && fl.image);
      return '<a class="uz-list-card" href="' + esc(it.id) + '/"><div class="uz-list-art' + (img ? ' uz-list-art--img' : '') + '">' +
        (img ? '<img class="uz-list-img" src="' + esc(imgUrl(img)) + '" alt="">' : artSvg(fl, true)) + '</div>' +
        '<b>' + esc(it.title) + '</b>' + (str(it.card) ? '<span>' + esc(it.card) + '</span>' : '') + '</a>';
    }).join('') + '</div>';
    root.innerHTML = h + '</div>';
    document.title = (str((SET || {}).siteTitle, '13 MIRRORS')) + ' · ' + str(D.title, 'Узоры');
  }
  function notFound(root) {
    document.body.className = 'uz-body uz-list-page';
    root.innerHTML = '<div class="uz-list"><a class="uz-eyebrow" href="../">' + esc(str(D.title, 'Узоры')) + '</a><h1 class="uz-h1">Этот узор пока скрыт</h1>' +
      '<p class="uz-honest" style="font-size:14px">Загляни чуть позже.</p></div>';
  }

  /* ================= Итог: из ответов — строки (как cvetok_runner.py) ================= */
  function stepOf(id) { return (IT.steps || []).filter(function (s) { return s.id === id; })[0] || {}; }
  function optLabel(step, id) { var o = (step.options || []).filter(function (x) { return x.id === id; })[0]; return o ? o.label : ''; }
  function joinList(p) { return p.length <= 1 ? p.join('') : p.slice(0, -1).join(', ') + ' и ' + p[p.length - 1]; }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return Math.abs(h); }
  /* ---------- дар цветка (её решения 29.10, docs/uzory-duh-cvetov.md) ----------
     У цветка: spirit (дух), gen (кого/чего), gifts [{ t — на карте после «Прими от меня в дар», p — абзац под картой }], few, many, bye.
     Дар выпадает наугад из ещё не выпадавших этому человеку; один дар в день. Помнит только устройство человека (localStorage), на сервер ничего не уходит.
     В окне панели день не считается — чтобы можно было смотреть сколько угодно. */
  var PANEL = (function () { try { return window.parent !== window && !!window.parent.M13_UZ_DRAFT; } catch (e) { return false; } })();
  function dayNow() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function giftMem(v) {
    try {
      var k = 'm13uz-gift-' + IT.id;
      if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null') || {};
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
    return {};
  }
  function giftsOf(fl) { return ((fl && fl.gifts) || []).filter(function (x) { return x && str(x.t); }); }
  function giftDaily() { return !PANEL && (IT.space || {}).giftDaily !== false; }
  function giftToday() { var M = giftMem(); return giftDaily() && M.day === dayNow() && M.fl ? M : null; }
  function drawGift(fl) {
    var G = giftsOf(fl); if (!G.length) return -1;
    var M = giftMem(), seen = ((M.seen || {})[fl.id] || []).filter(function (i) { return i < G.length; }), free = [], i;
    for (i = 0; i < G.length; i++) if (seen.indexOf(i) < 0) free.push(i);
    if (!free.length) { seen = []; for (i = 0; i < G.length; i++) if (i !== M.last || G.length < 2) free.push(i); }   // все выпадали — по кругу, без повтора подряд
    var gi = free[Math.floor(Math.random() * free.length)];
    M.seen = M.seen || {}; M.seen[fl.id] = seen.concat([gi]);
    M.day = dayNow(); M.fl = fl.id; M.gi = gi; M.last = gi;
    giftMem(M);
    return gi;
  }
  function buildResult(A) {
    var a = IT.answers || {}, rv = IT.reveal || {}, lines = [], title = str(rv.title_if_skipped, 'Твой сад'), reveal = rv.text_if_skipped || '';
    var fl = A.flower && !A.flower.own ? A.flower.fl : null, own = A.flower && A.flower.own ? A.flower.text : '';
    var g = fl ? fl.g : 'm';
    if (fl) {
      title = fill(gForm(((a.listed_flower || {}).title) || 'Твой цветок: {nom_cap}', g), { nom_cap: fl.nom_cap, nom: fl.nom });
      if (str(fl.text)) lines.push(fl.text);
      reveal = rv.text || '';
    } else if (own) {
      var of = a.own_flower || {};
      title = fill(of.title || 'Твой цветок: {text}', { text: own });
      if (str(of.text)) lines.push(fill(of.text, { text: own }));
      reveal = str(rv.text_own, rv.text);
    }
    if (A.place && (a.place || {})[A.place]) lines.push(gForm(a.place[A.place], g));
    if (A.care && (a.care || {})[A.care]) lines.push(gForm(a.care[A.care], g));
    var lm = a.lamps || {}, L = A.lamps || {}, labels = lm.enough_labels || {};
    var enough = Object.keys(labels).filter(function (k) { return L[k] === 'enough'; }).map(function (k) { return labels[k]; });
    var fm = Object.keys(lm.few || {}).filter(function (k) { return L[k] === 'few'; }).map(function (k) { return lm.few[k]; })
      .concat(Object.keys(lm.many || {}).filter(function (k) { return L[k] === 'many'; }).map(function (k) { return lm.many[k]; }));
    if (Object.keys(labels).length && enough.length === Object.keys(labels).length) { if (str(lm.all_enough)) lines.push(lm.all_enough); }
    else if (enough.length) lines.push(fill(lm.enough_template || 'Цветку хватает: {list}.', { list: joinList(enough) }));
    fm.forEach(function (x) { lines.push(gForm(x, g)); });
    if (fm.length && str(lm.weather_note)) lines.push(lm.weather_note);
    var says = a.says || {};
    if (A.says) {
      if (A.says.id === 'own') { if (A.says.text) lines.push(fill(gForm(says.own || '«{text}»', g), { text: A.says.text })); }
      else if (says[A.says.id]) lines.push(gForm(says[A.says.id], g));
    }
    if (fl && str((a.listed_flower || {}).unique)) lines.push(fill(gForm(a.listed_flower.unique, g), { nom: fl.nom, nom_cap: fl.nom_cap }));
    else if (own && str((a.own_flower || {}).unique)) lines.push(fill(a.own_flower.unique, { text: own }));
    var dar = null, G = giftsOf(fl);
    if (fl && A.gift >= 0 && G[A.gift]) {
      var fw = Object.keys(L).some(function (k) { return L[k] === 'few'; }), mn = Object.keys(L).some(function (k) { return L[k] === 'many'; });
      dar = { name: fl.nom_cap, spirit: str(fl.spirit), lead: T('giftLead', 'Прими от меня в дар'), t: G[A.gift].t, p: str(G[A.gift].p), bye: str(G[A.gift].b, str(fl.bye)),
        lines: [fw ? str(fl.few) : '', mn ? str(fl.many) : ''].filter(function (x) { return x; }),
        more: fill(gForm(T('giftMore', 'Возвращайся за другими дарами.'), g), { gen: str(fl.gen, fl.nom), nom: fl.nom, nom_cap: fl.nom_cap }) };
    } else if (own && str(T('giftOwn', 'У твоего цветка свои дары, и никто не записал их заранее. То, что ты о нём знаешь, — и есть его дар.'))) {
      dar = { name: own, spirit: '', lead: '', t: '', own: T('giftOwn', 'У твоего цветка свои дары, и никто не записал их заранее. То, что ты о нём знаешь, — и есть его дар.'), p: '', bye: '', lines: [], more: '' };
    }
    var sl = (IT.support_lines || []).filter(function (x) { return str(x); });
    var seed = JSON.stringify([A.flower ? (A.flower.own ? A.flower.text : A.flower.fl.id) : '', A.place, A.care, L, A.says, A.reflect]);
    return {
      title: title, lines: lines, reveal: reveal, support: sl.length ? sl[hash(seed) % sl.length] : '',
      closing: ((IT.closing_question || {}).inside) || '', reflection: str(A.reflect), ack: str(A.reflect) ? IT.reflection_ack || '' : '',
      footer: IT.footer || '', dar: dar
    };
  }

  /* ================= Пространство узора ================= */
  var WINDS = { calm: .1, breeze: 1, strong: 3.4 }, SPEEDS = { slow: .06, norm: .12, fast: .22 }, AIRS = { few: .5, mid: 1, many: 1.8, lots: 3 };
  var LINKS = { few: .25, mid: .5, many: 1 };
  // Время суток по часам человека (её решение 29.10): утро 4–10, день 10–17, вечер 17–21, ночь 21–4. Считается на устройстве.
  // Вечер — каждый раз один из четырёх наугад. Для проверки: ?t=morning|day|gold|blue|rain|lights|night в адресе.
  var EVES = ['gold', 'blue', 'rain', 'lights'], EVE = EVES[Math.floor(Math.random() * EVES.length)];
  function partOf(v) { return v === 'morning' || v === 'day' || v === 'night' ? v : 'evening'; }
  function partNow() { var h = new Date().getHours(); return h >= 4 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 21 ? 'evening' : 'night'; }
  function timeNow(v) {
    var q = /[?&]t=(\w+)/.exec(location.search); if (q) return q[1];
    if (v && v !== 'auto') return v;
    var p = partNow(); return p === 'evening' ? EVE : p;
  }
  // Костёр Самайна вместо сада (её решение 30.10; panel: «Пространство» → «Что в пространстве»; проверка — ?koster=1 / ?sad=1)
  function koster(root, OKNO) {
    var v = '20261031l', sc = document.createElement('script');
    ['assets/fonts/marck-script.css', 'assets/koster.css?v=' + v].forEach(function (h) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = BASE + h; document.head.appendChild(l); });
    sc.src = BASE + 'assets/koster.js?v=' + v;
    sc.onload = function () { window.M13_KOSTER(root, { IT: IT, SET: SET, T: T, esc: esc, str: str, imgUrl: imgUrl, PANEL: PANEL, OKNO: OKNO }); };
    document.head.appendChild(sc);
  }
  function garden(root) {
    // окошко (живое окошко на карте витрины, её решение 29.10): только сад, без надписей и кнопок; нажатие — у витрины
    var OKNO = /[?&]okno=1/.test(location.search);
    if (/[?&]koster=1/.test(location.search) || ((IT.space || {}).scene === 'koster' && !/[?&]sad=1/.test(location.search))) { koster(root, OKNO); return; }
    var SP = IT.space || {}, UIt = IT.ui || {};
    // пока — просто сад, без вопросов (её решение 29.10); вопросы вернёт «Вопросы в саду» в панели (space.quiz)
    var WALK = SP.quiz !== true;
    document.body.className = 'uz-body uz-garden' + (OKNO ? ' uz-okno' : '') + (WALK ? ' uz-walk' : '');
    var LY0 = SP.layers && SP.layers.on ? SP.layers : null, PART = LY0 ? partOf(timeNow(LY0.time)) : '';
    var st = str((SET || {}).siteTitle, '13 MIRRORS');
    document.title = st + ' · ' + str(IT.title, 'Узор');
    var FL = (IT.flowers || []).filter(function (f) { return f && f.visible !== false; }).slice(0, 12);
    var N = FL.length || 1, STEP = Math.PI * 2 / N;
    var enter = stepOf('enter'), pickStep = stepOf('pick_mode'), flStep = stepOf('flower');
    var ownOpt = flStep.own || {};
    // текст входа — свой у утра, дня, вечера и ночи (её решение 29.10; пусто — общий)
    // вступление — карточкой перед хороводом (её текст 29.10: «у нас не викторина»); «-» в панели — без него
    var INTRO_DEF = 'Это не викторина и не тест.\nЦветок — это метафорический образ, через который можно соприкоснуться с собой и с тем, что с тобой сейчас происходит.\n' +
      'Выбери первый откликнувшийся тебе цветок или позволь ему выбрать тебя. После чего начни отвечать на вопросы, представляя себя этим цветком. Первое, что придёт в голову, будет самым правильным ответом. Любой вопрос можно пропустить.';
    function introLines() { var t = T('introText', INTRO_DEF); return t === '-' ? [] : t.split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean); }
    function enterText() { return str(PART && (enter.byTime || {})[PART], str(enter.text)); }

    root.innerHTML =
      '<div class="uz-scene" id="uz-scene"><canvas id="uz-bg"></canvas><div class="uz-ring" id="uz-ring" aria-label="Двенадцать элементов в хороводе">' +
        '<div class="uz-me" id="uz-me"><div class="uz-halo"></div><div class="uz-heart" id="uz-heart"></div><div class="uz-core"></div>' +
        '<button class="uz-tap" id="uz-tap" type="button" aria-label="Свет в центре — это ты"></button></div></div>' +
        '<div class="uz-name" id="uz-name" hidden></div><div class="uz-cap" id="uz-cap"></div><div class="uz-ghint" id="uz-ghint" aria-live="polite"></div><canvas class="uz-fx" id="uz-fx"></canvas></div>' +
      '<div class="uz-ui uz-top"><div><a class="uz-eyebrow" href="../">' + esc(T('eyebrow', 'Узоры')) + '</a><h1 class="uz-h1">' + esc(IT.title) + '</h1>' +
        (T('honest') ? '<p class="uz-honest">' + esc(T('honest')) + '</p>' : '') + '</div>' +
        '<button class="uz-tbtn" id="uz-still" type="button"></button></div>' +
      '<div class="uz-ui uz-intro" id="uz-intro" hidden><div class="uz-sheet uz-intro-card">' + introLines().map(function (l, i) {
        return '<p class="' + (i ? 'uz-p' : 'uz-q') + '">' + esc(l) + '</p>'; }).join('') +
        '<button class="uz-btn" id="b-intro" type="button">' + esc(T('introBtn', 'Входи в сад')) + '</button></div></div>' +
      '<div class="uz-ui uz-bottom" id="uz-bottom">' +
        '<div class="uz-sheet" id="sh-mode">' + (enterText() ? '<p class="uz-p is-dim">' + esc(enterText()) + '</p>' : '') +
          '<p class="uz-q">' + esc(str(pickStep.text, 'Как выбрать цветок?')) + '</p><div class="uz-row">' +
          ((pickStep.options || []).length ? pickStep.options : [{ id: 'random', label: 'Наугад' }, { id: 'choose', label: 'По картинке' }]).map(function (o) {
            return '<button class="uz-btn" type="button" data-pick="' + esc(o.id) + '">' + esc(o.label) + '</button>'; }).join('') + '</div>' +
          // ссылки реже нужны — под одной «ещё…» (её решение 29.10: меньше текста на экране)
          '<button class="uz-link uz-link--dim uz-more-b" id="b-more" type="button" aria-expanded="false">' + esc(T('more', 'ещё…')) + '</button>' +
          '<div class="uz-more" id="uz-more" hidden><button class="uz-link" id="b-own" type="button">' + esc(str(ownOpt.label, 'Моего цветка здесь нет')) + '</button>' +
          '<button class="uz-link" id="b-name" type="button"></button>' +
          (flStep.skippable === false ? '' : '<button class="uz-link uz-link--dim" id="b-skipfl" type="button">' + esc(T('skipFlower', 'Сегодня не выбирать')) + '</button>') + '</div></div>' +
        '<div class="uz-sheet" id="sh-random" hidden><p class="uz-p" id="randomText">' + esc(T('randomHint')) + '</p><button class="uz-link" data-back type="button">' + esc(T('otherWay', 'Выбрать иначе')) + '</button></div>' +
        '<div class="uz-sheet" id="sh-choose" hidden><p class="uz-p">' + esc(T('chooseHint')) + '</p><button class="uz-link" data-back type="button">' + esc(T('otherWay', 'Выбрать иначе')) + '</button></div>' +
        '<form class="uz-sheet" id="sh-own" hidden><label class="uz-p" for="ownName">' + esc(T('ownAsk', 'Как называется твой цветок?')) + '</label>' +
          '<div class="uz-field"><input id="ownName" maxlength="' + (+ownOpt.max_chars || 30) + '" autocomplete="off" placeholder="' + esc(T('ownPh')) + '"><button class="uz-btn" type="submit">' + esc(T('done', 'Готово')) + '</button></div>' +
          '<button class="uz-link" data-back type="button">' + esc(T('back', '← Назад')) + '</button></form>' +
        '<div class="uz-sheet" id="sh-wait" hidden><p class="uz-p is-dim" id="waitText"></p></div>' +
        '<div class="uz-sheet" id="sh-reveal" hidden><p class="uz-title" id="rvTitle"></p><p class="uz-p" id="rvText"></p><p class="uz-p is-dim" id="rvReveal"></p>' +
          '<div class="uz-row"><button class="uz-btn" id="b-toq" type="button">' + esc(T('toQuestions', 'Дальше')) + '</button>' +
          '<button class="uz-btn uz-btn--ghost" id="b-tochoose" type="button" hidden>' + esc(T('toChoose', 'Посмотреть по картинке')) + '</button></div>' +
          '<button class="uz-link uz-link--dim" data-again type="button">' + esc(T('again', 'Начать сначала')) + '</button></div>' +
        '<form class="uz-sheet" id="sh-name" hidden><label class="uz-p" for="nameIn">' + esc(T('nameAsk', 'Твоё имя у света')) + '</label>' +
          '<div class="uz-field"><input id="nameIn" maxlength="24" autocomplete="off" placeholder="' + esc(T('namePh')) + '"><button class="uz-btn" type="submit">' + esc(T('done', 'Готово')) + '</button></div></form>' +
        '<div class="uz-sheet" id="sh-today" hidden><p class="uz-p" id="todayText"></p><div class="uz-row"><button class="uz-btn" id="b-today" type="button">' + esc(T('giftTodayBtn', 'Мой сегодняшний дар')) + '</button></div></div>' +
        '<div class="uz-sheet" id="sh-q" hidden></div>' +
        '<div class="uz-sheet uz-sheet--long" id="sh-res" hidden></div>' +
      '</div>';

    var scene = $('#uz-scene'), bg = $('#uz-bg'), fx = $('#uz-fx'), ringEl = $('#uz-ring'), me = $('#uz-me'), heart = $('#uz-heart'),
      cap = $('#uz-cap'), nameEl = $('#uz-name'), g = bg.getContext('2d'), gf = fx.getContext('2d');
    var W = 0, H = 0, DPR = 1, cx = 0, cy = 0, R = 0, R0 = 0, CAM = 0, sinT = .5, cosT = .87, cw = 0, ch = 0, hc = 0, px = 0, py = 0, phone = false;
    var els = [], base = SP.speed === 'off' ? STEP / 2 : 0, speed = 0, speedTarget = spd(), still = false, lite = false, touched = false;
    var mode = 'idle', spin = null, fly = null, focus = null, hoverStop = false, merged = null, lastPick = null;
    var drag = null, coast = null, snap = null, lastTick = 0, randomSpin = false;
    var lift = 0, liftTo = 0, heartW = 0, heartH = 0, born = 0;
    var grass = [], pollen = [], petals = [], stars = [], ripples = [], sparks = [], sparkAcc = 0, lastBreath = 0;
    var tufts = [], treesFar = [], treesNear = [], flies = [], bflies = [], mists = [], hY = 0;
    var now = 0, wp = 0, last = performance.now(), frameSum = 0, frameN = 0;
    var A = { flower: null, place: null, care: null, lamps: {}, says: null, reflect: '' }, myName = '';
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Сад слоями (решения 22.10): небо — сайт, дальний план / земля / передняя трава — её картинки; время суток — подкраской
    var LY = LY0, lyImg = {}, lyTime = '', glints = [], par = 0, prevBase = 0;
    var size = Math.max(50, Math.min(200, +SP.size || 100)) / 100, linkBright = Math.max(0, Math.min(200, SP.linkBright == null ? 100 : +SP.linkBright)) / 100;

    // хоровод сам кружится (или нет — её «Не кружится»: цветы стоят, крутить можно пальцем)
    function spd() { return SP.speed === 'off' ? 0 : SPEEDS[SP.speed] || .12; }
    function viewOf(f) { var v = (f && f.view) || SP.view || 'live'; if (v === 'live' && !(f && f.image) && !LY) v = 'line'; return v; }
    function proj(X, Y, Z) { var f = CAM / (CAM - Z); return { x: cx + X * f, y: cy + (Z * sinT - Y * cosT) * f, f: f }; }

    function makeEl(f, own) {
      var v = own ? 'line' : viewOf(f), n = el('div', 'uz-el uz-v-' + v + (own ? ' uz-own' : ''));
      n.setAttribute('role', 'button'); n.tabIndex = -1; n.setAttribute('aria-label', own ? own : f.nom_cap || f.nom || '');
      var art = v === 'live' && f.image ? '<img src="' + esc(imgUrl(f.image)) + '" alt="" draggable="false">' : artSvg(own ? null : f, v === 'line');
      var bud = v === 'card' ? '' : f && f.bud ? '<img src="' + esc(imgUrl(f.bud)) + '" alt="" draggable="false">' : budSvg(own ? { col: '#f2c9a0' } : f, v === 'line');
      n.innerHTML = (v === 'card' ? '<div class="uz-glass"></div>' : '') + '<div class="uz-art">' + art + '</div>' + (bud ? '<div class="uz-bud">' + bud + '</div>' : '') +
        '<div class="uz-nm">' + esc(own || f.nom_cap || f.nom || '') + '</div>';
      ringEl.appendChild(n);
      return { el: n, fl: own ? null : f, own: own || '', v: v, x: 0, y: 0, gx: 0, gy: 0, hx: 0, hy: 0, f: 1, d: 0, op: 1, gone: false, ph: Math.random() * 6.28, w: 0, h: 0 };
    }
    function sizeEl(c) {
      c.k = c.v === 'card' || !c.fl ? 1 : Math.max(.6, Math.min(1.8, (+c.fl.tall || 100) / 100));
      if (c.v === 'card') { c.w = cw; c.h = ch; } else { c.w = cw * 1.3 * size; c.h = ch * 1.25 * size * c.k; }
      var s = c.el.style; s.width = c.w + 'px'; s.height = c.h + 'px'; s.left = (-c.w / 2) + 'px';
      s.top = (c.v === 'card' || c.flying ? -c.h / 2 : -c.h) + 'px'; s.transformOrigin = c.v === 'card' || c.flying ? '50% 50%' : '50% 100%';
      var nm = c.el.querySelector('.uz-nm'); if (nm) nm.style.fontSize = Math.max(10, cw * (c.v === 'card' ? .19 : .24)) + 'px';
    }
    FL.forEach(function (f, i) { var c = makeEl(f); c.i = i; els.push(c); });
    if (LY) { lyLoad(); document.body.classList.add('uz-layers'); }

    function layout() {
      W = scene.clientWidth; H = scene.clientHeight; DPR = Math.min(window.devicePixelRatio || 1, lite ? 1 : 2);
      [bg, fx].forEach(function (c) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); });
      g.setTransform(DPR, 0, 0, DPR, 0, 0); gf.setTransform(DPR, 0, 0, DPR, 0, 0);
      phone = W < 700;
      sinT = LY && LY.tilt ? Math.max(.2, Math.min(.8, LY.tilt / 100)) : phone ? .52 : .4; cosT = Math.sqrt(1 - sinT * sinT);
      R0 = Math.min(W * (phone ? .40 : .31), 430);
      cw = Math.max(OKNO ? 12 : 44, Math.min(R0 * (phone ? .27 : .24), 82)); ch = cw * 1.38; hc = ch * .62;
      // ширина хоровода (её поле 22.10, % от прежней): цветы те же, между ними просторнее; на телефоне — не шире экрана
      R0 = Math.min(R0 * Math.max(80, Math.min(180, +SP.ringW || 125)) / 100, phone ? W * .47 : W * .44);
      heartW = Math.min(cw * 2.3, 160); heartH = heartW * 1.4;
      heart.style.width = heartW + 'px'; heart.style.height = heartH + 'px'; heart.style.left = (-heartW / 2) + 'px'; heart.style.top = (-heartH * .32) + 'px';
      els.forEach(sizeEl);
      grass = []; var n = Math.round(W / 6), i;
      for (i = 0; i < n; i++) grass.push({ x: i * W / n + Math.random() * 4, h: (26 + Math.random() * 60) * (phone ? .8 : 1), w: 2 + Math.random() * 2.5, ph: Math.random() * 6.28, c: Math.random() });
      stars = []; for (i = 0; i < Math.round(W * H / 9000); i++) stars.push({ x: Math.random() * W, y: Math.random() * H * .42, r: Math.random() * 1.1 + .2, ph: Math.random() * 6.28 });
      seedAir(); seedLife(); geo(); ringWarp();
    }
    // хоровод в саду слоями (её слово 23.10: «в кучке», роза и лилия слиплись, линия ломается): чуть овалом в ширину,
    // и цветы стоят так, что НА ЭКРАНЕ промежутки между ними примерно равны (по бокам круг сжат перспективой)
    var warpT = null;
    function ovalX() { return LY ? Math.max(1, Math.min(1.2, (phone ? W * .46 : W * .44) / (R || 1))) : 1; }
    function ringWarp() {
      if (!LY) { warpT = null; return; }
      // промежуток в ширину важнее: цветы высокие, вверх-вниз они друг друга не разводят
      var n = 360, i, len = [0], ov = ovalX(), prev = proj(0, 0, R), q;
      for (i = 1; i <= n; i++) { var a = i / n * 6.2832; q = proj(R * ov * Math.sin(a), 0, R * Math.cos(a)); len.push(len[i - 1] + Math.sqrt((q.x - prev.x) * (q.x - prev.x) + .2 * (q.y - prev.y) * (q.y - prev.y))); prev = q; }
      warpT = []; var tot = len[n], j = 0;
      for (i = 0; i <= n; i++) { var want = i / n * tot; while (j < n && len[j + 1] < want) j++; var u = (want - len[j]) / ((len[j + 1] - len[j]) || 1); warpT.push((j + u) / n * 6.2832); }
    }
    function ringA(a) {
      if (!warpT) return a;
      var t2 = 6.2832, k = Math.floor(a / t2), r = a - k * t2, x = r / t2 * 360, i = Math.min(359, Math.floor(x)), w2 = warpT[i] + (warpT[i + 1] - warpT[i]) * (x - i);
      return k * t2 + r + (w2 - r) * .8;
    }
    // Сцена поднимается и чуть уменьшается на вопросах и в итоге — чтобы цветок в центре был виден над стеклом
    function geo() {
      var k = lift * lift * (3 - 2 * lift), zoom = 1 - (phone ? .28 : .15) * k;
      R = R0 * zoom; CAM = R0 * 3.4;
      cx = W / 2; cy = H * (OKNO || WALK ? .56 : (phone ? .45 : .46) - ((phone ? .18 : .17) * k));
      var p = proj(0, hc * zoom * (LY ? 1.35 : 1), 0); px = p.x; py = p.y;   // в саду слоями свет чуть выше — выглядывает над цветами
      return zoom;
    }
    function seedAir() {
      var k = Math.min((W * H) / (390 * 800), 2.4) * (AIRS[SP.air] || 1) * (lite ? .5 : 1);
      var np = Math.round(30 * k), nl = Math.round(12 * k), i;
      pollen = []; petals = [];
      for (i = 0; i < np; i++) pollen.push({ x: Math.random() * W, y: Math.random() * H, r: .8 + Math.random() * 1.6, v: .2 + Math.random() * .6, ph: Math.random() * 6.28 });
      for (i = 0; i < nl; i++) petals.push(newPetal(true));
    }
    function newPetal(any) {
      var f = FL[Math.floor(Math.random() * FL.length)] || {};
      return { x: any ? Math.random() * W : wdir() > 0 ? -20 : W + 20, y: any ? Math.random() * H : Math.random() * H * .8, s: 3 + Math.random() * 3.5, a: Math.random() * 6.28, va: (Math.random() - .5) * 2, v: .4 + Math.random() * .6, c: f.col || '#f2c9a0', front: Math.random() < .35 };
    }
    // Живой сад: поляна до горизонта (кустики травы в перспективе), лес вдали, туман, светлячки, мотыльки
    function trees(n, lo, hi) {
      var a = [], i, ph1 = Math.random() * 6, ph2 = Math.random() * 6, top = 0;
      for (i = 0; i <= n; i++) {
        var u = i / n, hill = .5 + .3 * Math.sin(u * 7 + ph1) + .2 * Math.sin(u * 17 + ph2);
        if (i % 3 === 0) top = Math.random();
        a.push(lo + (hi - lo) * (hill * .65 + top * .35) * (.85 + .15 * Math.sin(i * 1.9)));
      }
      return a;
    }
    function seedLife() {
      var k = lite ? .45 : 1, i, n = Math.round((phone ? 620 : 1200) * k);
      tufts = [];
      for (i = 0; i < n; i++) {
        var X = (Math.random() * 2 - 1) * (phone ? 2.6 : 3.4), Z = -4.2 + Math.random() * 5.8;
        if (X * X + Z * Z < .12) continue;                       // под светом — чистая трава, без кустиков
        tufts.push({ X: X, Z: Z, h: 6 + Math.random() * 14, n: 3 + Math.floor(Math.random() * 3), ph: Math.random() * 6.28, c: Math.random() });
      }
      tufts.sort(function (a, b) { return a.Z - b.Z; });
      var tn = Math.round(W / 7);
      treesFar = trees(tn, 6, phone ? 22 : 30); treesNear = trees(tn, 2, phone ? 16 : 22);
      mists = []; for (i = 0; i < 5; i++) mists.push({ x: Math.random() * W, w: W * (.25 + Math.random() * .3), v: wdir() * (Math.random() < .25 ? .4 : 1) * (4 + Math.random() * 6), a: .5 + Math.random() * .5 });
      flies = []; for (i = 0; i < Math.round((phone ? 12 : 20) * k); i++) flies.push({ X: (Math.random() * 2 - 1) * 2, Z: -2.4 + Math.random() * 3.4, y: .15 + Math.random() * .9, dir: Math.random() * 6.28, v: .05 + Math.random() * .08, ph: Math.random() * 6.28, bl: .5 + Math.random() * .9 });
    }
    // откуда дует ветер (её слово 23.10): с востока — справа налево (север вверху, восток справа); 'west' — слева направо
    function wdir() { return SP.windFrom === 'west' ? 1 : -1; }
    function wind(t) { var lv = WINDS[SP.wind] != null ? WINDS[SP.wind] : 1, gust = Math.max(0, Math.sin(t * .23) * Math.sin(t * .61 + 1.3)); return lv * (.55 + .3 * Math.sin(t * .37) + .6 * gust); }
    function breathVal(t) {
      if (SP.breath !== 'soft') { var p = t % 10; return p < 4 ? .5 - .5 * Math.cos(Math.PI * p / 4) : .5 + .5 * Math.cos(Math.PI * (p - 4) / 6); }   // вдох 4 с, выдох 6 с
      return .5 + .5 * Math.sin(t * 1.3) * (.6 + .4 * Math.sin(t * .31));
    }
    function frontIdx() { return ((-Math.round(base / STEP)) % N + N) % N; }

    // окошко на витрине: 30 кадров в секунду; витрина ставит на паузу, когда окошко не видно
    var paused = false, lastOk = 0;
    if (OKNO) window.addEventListener('message', function (e) {
      var m = e.data && e.data.m13okno; if (!m) return;
      if (m === 'pause') paused = true; else if (paused) { paused = false; requestAnimationFrame(function (ts) { last = ts; frame(ts); }); }
    });
    function frame(ts) {
      if (paused) return;
      if (OKNO && ts - lastOk < 30) { requestAnimationFrame(frame); return; }
      lastOk = ts;
      if (W < 2 || H < 2) { layout(); if (W < 2 || H < 2) { requestAnimationFrame(frame); return; } }   // окошко ещё не получило размер
      var dt = Math.min(.05, (ts - last) / 1000); last = ts;
      if (frameN < 90) { frameSum += dt; frameN++; if (frameN === 90 && frameSum / 90 > .024 && !lite) { lite = true; layout(); } }
      if (!still) now += dt;
      var t = now, w = still ? 0 : wind(t);
      if (!still) wp += dt * (1 + .3 * w);
      lift += (liftTo - lift) * Math.min(1, dt * 1.6); if (Math.abs(liftTo - lift) < .002) lift = liftTo;
      var zoom = geo();
      if (spin) {
        var u = Math.min(1, (ts - spin.t0) / spin.T);
        base = spin.b0 + spin.v0 * spin.T / 1000 * (u - 2 * u * u + u * u * u) + spin.D * (3 * u * u - 2 * u * u * u);
        if (u >= 1) { var sp = spin; spin = null; sp.done(); }
      } else if (drag) {
        speed = 0;
      } else if (coast) {
        base += coast.v * dt; coast.v *= Math.exp(-dt * coast.fr);
        if (Math.abs(coast.v) < .5) { var cv = coast; coast = null; snapTo(cv.spun ? Math.round(base / STEP + (cv.v > 0 ? .3 : -.3)) * STEP : rest(base, cv.v > 0 ? .3 : -.3), cv.spun); }
      } else if (snap) {
        var su = Math.min(1, (ts - snap.t0) / snap.T), se = 1 - Math.pow(1 - su, 3);
        base = snap.from + (snap.to - snap.from) * se;
        if (su >= 1) { var sn = snap; snap = null; if (sn.done) sn.done(); }
      } else {
        var tgt = (still || hoverStop || fly || focus || touched) ? 0 : speedTarget;
        speed += (tgt - speed) * Math.min(1, dt * 2.2);
        base += speed * dt;
        // остановился сам — мягко доворачивается, чтобы перед светом был просвет
        if (!tgt && Math.abs(speed) < .03 && !fly && !focus && mode !== 'random' && Math.abs(rest(base) - base) > .002) { speed = 0; snapTo(rest(base)); }
      }
      // глубина: когда хоровод крутят, слои чуть отстают — дальний меньше, передний больше
      if (dt > 0) { var av = Math.max(-3, Math.min(3, (base - prevBase) / dt)); par += (av - par) * Math.min(1, dt * 2.5); }
      prevBase = base;
      var tick = Math.round(base / STEP);
      if (tick !== lastTick) { lastTick = tick; if ((drag || coast || snap) && SP.vibrate !== false && navigator.vibrate) { try { navigator.vibrate(6); } catch (e) {} } }
      placeEls(t, w, ts, zoom);
      drawBack(t, w, ts, zoom, dt);
      placeMe(t, ts, zoom);
      drawFront(t, w, dt, ts, zoom);
      requestAnimationFrame(frame);
    }
    function groundEllipse(ctx, r) {
      ctx.beginPath();
      for (var k = 0; k <= 48; k++) { var a = k / 48 * 6.283, p = proj(r * Math.sin(a), 0, r * Math.cos(a)); if (k) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
    }
    function drawBack(t, w, ts, zoom, dt) {
      var i, s, c;
      if (LY) { drawLayers(t, dt, zoom); drawFlies(g, t, dt, zoom, false); }
      else {
      // горизонт — выше дальних цветов: все цветы стоят на поляне, а не в небе
      var back = proj(0, 0, -R), hInf = cy - CAM * sinT;
      hY = Math.max(H * .07, hInf, back.y - Math.max(28, R * .26));
      var sky = g.createLinearGradient(0, 0, 0, hY);
      sky.addColorStop(0, '#0a0e24'); sky.addColorStop(.6, '#1d1c44'); sky.addColorStop(1, '#4a3a5e');
      g.fillStyle = sky; g.fillRect(0, 0, W, hY + 1);
      g.fillStyle = '#fff';
      for (i = 0; i < stars.length; i++) { s = stars[i]; if (s.y > hY - 8) continue; g.globalAlpha = (.25 + .35 * (.5 + .5 * Math.sin(t * .8 + s.ph))) * Math.min(1, (hY - s.y) / 40); g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.283); g.fill(); }
      g.globalAlpha = 1;
      // луна — тихая, в углу неба
      var my = Math.min(hY * .45, 90), mx = W * (phone ? .82 : .86), mr = phone ? 9 : 13;
      if (hY > 70) {
        var mg = g.createRadialGradient(mx, my, 0, mx, my, mr * 6); mg.addColorStop(0, 'rgba(255,244,220,.22)'); mg.addColorStop(1, 'rgba(255,244,220,0)');
        g.fillStyle = mg; g.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12);
        g.fillStyle = '#fbf3df'; g.beginPath(); g.arc(mx, my, mr, 0, 6.283); g.fill();
        g.fillStyle = 'rgba(29,28,68,.92)'; g.beginPath(); g.arc(mx + mr * .45, my - mr * .2, mr * .92, 0, 6.283); g.fill();
      }
      // лес вдали — два слоя
      function forest(a, col, lift) {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, hY + 2);
        for (var k = 0; k < a.length; k++) g.lineTo(k * W / (a.length - 1), hY + lift - a[k]);
        g.lineTo(W, hY + 2); g.closePath(); g.fill();
      }
      forest(treesFar, '#2b2a4c', 0); forest(treesNear, '#1c1f38', 3);
      // поляна
      var mead = g.createLinearGradient(0, hY, 0, H);
      mead.addColorStop(0, '#272c46'); mead.addColorStop(.12, '#1c2a3a'); mead.addColorStop(.55, '#172636'); mead.addColorStop(1, '#0d1520');
      g.fillStyle = mead; g.fillRect(0, hY, W, H - hY);
      var edge = g.createLinearGradient(0, hY - 14, 0, hY + 26); edge.addColorStop(0, 'rgba(90,84,130,0)'); edge.addColorStop(.4, 'rgba(90,84,130,.22)'); edge.addColorStop(1, 'rgba(90,84,130,0)');
      g.fillStyle = edge; g.fillRect(0, hY - 14, W, 40);
      // туман у горизонта медленно плывёт
      if (SP.mist !== false) {
        for (i = 0; i < mists.length; i++) {
          var ms = mists[i]; if (!still) { ms.x += ms.v * dt; if (ms.x > W + ms.w) ms.x = -ms.w; if (ms.x < -ms.w) ms.x = W + ms.w; }
          g.save(); g.translate(ms.x, hY + 4); g.scale(1, .16);
          var mg2 = g.createRadialGradient(0, 0, 0, 0, 0, ms.w); mg2.addColorStop(0, 'rgba(150,150,200,' + (.16 * ms.a) + ')'); mg2.addColorStop(1, 'rgba(150,150,200,0)');
          g.fillStyle = mg2; g.beginPath(); g.arc(0, 0, ms.w, 0, 6.283); g.fill(); g.restore();
        }
      }
      // трава по всей поляне: кустики в перспективе, дальние мельче и тусклее, у света — тёплые
      g.lineCap = 'round';
      for (i = 0; i < tufts.length; i++) {
        var tf = tufts[i], tp = proj(tf.X * R, 0, tf.Z * R);
        if (tp.y < hY + 3 || tp.y > H + 20 || tp.x < -20 || tp.x > W + 20) continue;
        var ts2 = tp.f * zoom * (phone ? .8 : 1), dist = Math.sqrt(tf.X * tf.X + tf.Z * tf.Z), warm = Math.max(0, 1 - dist / 1.5);
        var dep = Math.min(1, Math.max(0, (tp.y - hY) / (H - hY) * 2.2));
        var rr = Math.round(46 + 120 * warm + tf.c * 14), gg = Math.round(74 + 80 * warm + tf.c * 18), bb = Math.round(78 + 30 * warm);
        g.strokeStyle = 'rgba(' + rr + ',' + gg + ',' + bb + ',' + (.25 + .5 * dep).toFixed(2) + ')'; g.lineWidth = Math.max(.6, 1.3 * ts2);
        var lean0 = still ? 0 : wdir() * (w * .12 + .02) * (.35 + .65 * Math.sin(wp * 1.3 - wdir() * tf.X * 2 + tf.ph));
        g.beginPath();
        for (var b2 = 0; b2 < tf.n; b2++) {
          var off = (b2 - (tf.n - 1) / 2) * 2.2 * ts2, hh = tf.h * ts2 * (.7 + .3 * ((b2 * 7 + tf.c * 10) % 3) / 2), ang = lean0 + (b2 - (tf.n - 1) / 2) * .22;
          g.moveTo(tp.x + off, tp.y); g.quadraticCurveTo(tp.x + off + Math.sin(ang) * hh * .3, tp.y - hh * .6, tp.x + off + Math.sin(ang) * hh, tp.y - Math.cos(ang) * hh);
        }
        g.stroke();
      }
      drawFlies(g, t, dt, zoom, false);
      g.save(); g.translate(cx, cy); g.scale(1, sinT);
      var lawn = g.createRadialGradient(0, 0, 0, 0, 0, R * 1.7);
      lawn.addColorStop(0, 'rgba(130,150,160,.22)'); lawn.addColorStop(.6, 'rgba(70,90,110,.10)'); lawn.addColorStop(1, 'rgba(40,50,80,0)');
      g.fillStyle = lawn; g.beginPath(); g.arc(0, 0, R * 1.7, 0, 6.283); g.fill(); g.restore();
      g.strokeStyle = 'rgba(255,226,170,.08)'; g.lineWidth = 1; groundEllipse(g, R); g.stroke();
      }
      // дыхание: на выдохе по траве уходит еле заметная волна, цветы чуть отзываются
      var br = still ? .5 : breathVal(t);
      if (SP.breathWave !== false && !still) {
        var ph = t % 10;
        if (SP.breath !== 'soft' && lastBreath < 4 && ph >= 4) ripples.push({ t0: ts, soft: true });
        lastBreath = ph;
      }
      ringEl.style.setProperty('--lb', SP.breathWave === false ? 0 : (1 - br).toFixed(3));
      for (i = ripples.length - 1; i >= 0; i--) {
        var rp = ripples[i], T0 = rp.soft ? 4200 : 1800, u = (ts - rp.t0) / T0;
        if (u > 1) { ripples.splice(i, 1); continue; }
        g.strokeStyle = 'rgba(255,226,170,' + ((rp.soft ? .12 : .55) * (1 - u) * linkBright) + ')'; g.lineWidth = rp.soft ? 1 : 1.5;
        groundEllipse(g, R * (rp.soft ? 1.05 : 1.35) * Math.sqrt(u) + 4); g.stroke();
      }
      // свет человека: пятно на траве, лучик, сияние
      var gl = (merged ? .30 : .20) * (LY && (lyTime === 'lights' || lyTime === 'night') ? 1.9 : LY && lyTime === 'blue' ? 1.4 : 1);
      g.save(); g.translate(cx, cy); g.scale(1, sinT);
      var pool = g.createRadialGradient(0, 0, 0, 0, 0, cw * 1.1);
      pool.addColorStop(0, 'rgba(255,220,160,' + (.45 + .15 * br) + ')'); pool.addColorStop(1, 'rgba(255,220,160,0)');
      g.fillStyle = pool; g.beginPath(); g.arc(0, 0, cw * 1.1, 0, 6.283); g.fill(); g.restore();
      var beam = g.createLinearGradient(0, cy, 0, py); beam.addColorStop(0, 'rgba(255,226,170,.35)'); beam.addColorStop(1, 'rgba(255,226,170,.05)');
      g.fillStyle = beam; g.beginPath(); g.moveTo(cx - 3, cy); g.lineTo(cx + 3, cy); g.lineTo(cx + 1, py); g.lineTo(cx - 1, py); g.fill();
      var glow = g.createRadialGradient(px, py, 0, px, py, R * 1.1);
      glow.addColorStop(0, 'rgba(255,214,150,' + (gl + .08 * br) + ')'); glow.addColorStop(.45, 'rgba(233,184,114,' + (gl * .35) + ')'); glow.addColorStop(1, 'rgba(233,184,114,0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
      if (LY && lyTime === 'day') drawRays(t, br);
      // тени на траве
      for (i = 0; i < els.length; i++) {
        c = els[i]; if (c.gone || c.flying) continue;
        if (LY && lyTime === 'gold') {
          var sl = c.h * c.f * zoom * 1.3;
          g.save(); g.translate(c.gx, c.gy + 1); g.rotate(-.05); g.scale(1, .14);
          var sg2 = g.createLinearGradient(0, 0, sl, 0); sg2.addColorStop(0, 'rgba(40,24,40,' + (.3 * c.op) + ')'); sg2.addColorStop(1, 'rgba(40,24,40,0)');
          g.fillStyle = sg2; g.beginPath(); g.ellipse(sl / 2, 0, sl / 2, c.w * c.f * zoom * .9, 0, 0, 6.283); g.fill(); g.restore();
          continue;
        }
        if (LY) continue;   // её слово 22.10: тёмное пятно под цветком на фото читается как подставка — цветок «в ямке» без него
        g.save(); g.translate(c.gx, c.gy); g.scale(1, sinT * .6); g.fillStyle = LY ? 'rgba(30,40,24,' + (.28 * c.op) + ')' : 'rgba(8,10,24,' + (.35 * c.op) + ')';
        g.beginPath(); g.arc(0, 0, (c.v === 'card' ? cw * .45 : c.w * .32) * c.f * zoom, 0, 6.283); g.fill(); g.restore();
      }
      drawSparks(ts, dt);
      if (SP.pollen !== false) {
        var psz = (+SP.psize || 100) / 100;
        g.fillStyle = 'rgba(255,230,180,.75)';
        for (i = 0; i < pollen.length; i++) {
          var p = pollen[i];
          if (!still) { p.y -= p.v * .35; p.x += wdir() * w * 1.1 + Math.sin(t + p.ph) * .25; if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; } if (p.x > W + 5) p.x = -5; if (p.x < -5) p.x = W + 5; }
          g.globalAlpha = .3 + .4 * (.5 + .5 * Math.sin(t * 2 + p.ph)); g.beginPath(); g.arc(p.x, p.y, p.r * psz, 0, 6.283); g.fill();
        }
        g.globalAlpha = 1;
        drawPetals(g, t, w, false);
      }
    }
    /* ---------- Сад слоями (SP.layers): back — дальний план во весь экран, ground — земля под хороводом, front — передняя трава ---------- */
    var SKIES = { day: ['#a9bccf', '#d3dbe5', '#f2ede6'], evening: ['#2c2d5a', '#86607f', '#eaa98a'], night: ['#0a0e24', '#1d1c44', '#4a3a5e'] };
    // время суток (её просьба 22.10 — четыре вечера на выбор): m — подкраска картинок (умножение), sat — насколько приглушить цвет,
    // light — светлое (тёмный текст шапки), flies — светлячки
    // утро (её решение 29.10): розоватый рассвет, солнце встаёт на востоке — справа, туман у земли
    var TINTS = { morning: { m: '#fae4dc', sat: .06, light: 1 }, gold: { m: '#f7cfa4' }, blue: { m: '#8796cf', sat: .2 }, rain: { m: '#e8e5ee', sat: .42, light: 1 },
      lights: { m: '#4d5788', sat: .3, flies: 1 }, evening: { m: '#e9b7a2' }, night: { m: '#4e5a92', flies: 1 } };
    var HAZE = { morning: '252,234,228', day: '246,242,238', gold: '255,214,168', blue: '150,160,214', rain: '234,232,242', lights: '70,74,122', evening: '236,176,146', night: '86,86,138' };
    var lyWant = 'day', lyT0 = 0;
    function tm() { return TINTS[lyTime] || {}; }
    function lyLoad() {
      ['back', 'ground', 'front'].forEach(function (k) {
        var L = LY[k]; if (!L || !L.image) return;
        var im = new Image(); im.onload = function () { lyImg[k] = { im: im, tint: null, tt: '' }; if (k === 'back' && L.glints) seedGlints(im); };
        im.src = imgUrl(L.image);
      });
    }
    // вечер и ночь — те же дневные картинки, подкрашенные (множение цветом, прозрачность картинки сохраняется)
    function lyPic(k) {
      var o = lyImg[k]; if (!o) return null;
      if (lyTime === 'day' || !TINTS[lyTime]) return o.im;
      if (o.tt !== lyTime) {
        var im = o.im, sc = Math.min(1, 1600 / im.width), cv = o.tint || document.createElement('canvas'), x;
        cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc); x = cv.getContext('2d');
        x.drawImage(im, 0, 0, cv.width, cv.height);
        if (TINTS[lyTime].sat) { x.globalCompositeOperation = 'saturation'; x.fillStyle = 'rgba(128,128,128,' + TINTS[lyTime].sat + ')'; x.fillRect(0, 0, cv.width, cv.height); }
        x.globalCompositeOperation = 'multiply'; x.fillStyle = TINTS[lyTime].m; x.fillRect(0, 0, cv.width, cv.height);
        x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0, cv.width, cv.height);
        o.tint = cv; o.tt = lyTime;
      }
      return o.tint;
    }
    // роса: блики там, где на картинке самые светлые точки — мерцают звёздочками
    function seedGlints(im) {
      try {
        var w = 220, h = Math.round(im.height * w / im.width), cv = document.createElement('canvas'), x, d, i, j, l, k, a = [];
        cv.width = w; cv.height = h; x = cv.getContext('2d'); x.drawImage(im, 0, 0, w, h); d = x.getImageData(0, 0, w, h).data;
        function lum(i, j) { k = (j * w + i) * 4; return d[k] * .3 + d[k + 1] * .59 + d[k + 2] * .11; }
        for (j = 1; j < h - 1; j++) for (i = 1; i < w - 1; i++) {
          l = lum(i, j); if (l < 215 || j < h * .42) continue;   // её слово 23.10: блики висели в небе — только на земле, ниже кромки леса
          if (l < lum(i - 1, j) || l < lum(i + 1, j) || l < lum(i, j - 1) || l < lum(i, j + 1)) continue;
          if (i < 3 || j > h - 4 || i > w - 4 || l - Math.max(lum(i - 3, j), lum(i + 3, j), lum(i, j - 3), lum(i, j + 3)) < 30) continue;   // точка, а не светлое пятно
          a.push({ u: i / w, v: j / h, ph: Math.random() * 6.28, sp: .6 + Math.random() * 1.4, r: .6 + Math.random() * .8 });
        }
        a.sort(function () { return Math.random() - .5; }); glints = a.slice(0, lite ? 14 : 26);
      } catch (e) { glints = []; }
    }
    function backRect(zoom) {
      var o = lyImg.back, L = LY.back || {}; if (!o) return null;
      var iw = o.im.width, ih = o.im.height, sc = Math.max(W / iw, H / ih) * (1 + (+L.zoom || 10) / 100), dw = iw * sc, dh = ih * sc;
      // точка картинки (fx, fy в %) — под центром хоровода, но картинка всегда закрывает экран
      var x = cx - dw * (L.fx == null ? 50 : +L.fx) / 100, y = cy - dh * (L.fy == null ? 50 : +L.fy) / 100;
      x += -par * (L.depth == null ? .3 : +L.depth) * W * .03;
      x = Math.min(0, Math.max(W - dw, x)); y = Math.min(0, Math.max(H - dh, y));
      return { x: x, y: y, w: dw, h: dh };
    }
    // настроение вечера поверх картинки: солнце сбоку и его лучи, прохлада сумерек, перламутр после дождя, темнота с огоньками
    function lyMood(t, dt) {
      var gr, i;
      if (lyTime === 'gold') {
        var sx = -W * .02, sy = H * .3, sr = Math.max(W, H) * .75;   // солнце садится на западе — слева (её слово 23.10)
        // теневая сторона — дальше от солнца
        gr = g.createLinearGradient(W, 0, 0, 0); gr.addColorStop(0, 'rgba(52,30,60,.34)'); gr.addColorStop(.6, 'rgba(52,30,60,0)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        g.save(); g.globalCompositeOperation = 'lighter';
        gr = g.createRadialGradient(sx, sy, 0, sx, sy, sr); gr.addColorStop(0, 'rgba(255,226,170,.75)'); gr.addColorStop(.18, 'rgba(255,190,110,.32)'); gr.addColorStop(.55, 'rgba(255,150,80,.08)'); gr.addColorStop(1, 'rgba(255,150,80,0)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        g.restore();
        // косые лучи от низкого солнца — рассеянные, медленно дышат (её слово 22.10: без резких полос)
        if (SP.rays !== 'off') {
          var rs = [];
          for (i = 0; i < 4; i++) rs.push({ a: Math.PI * (.21 - i * .06) + Math.sin(t * .07 + i * 1.3) * .02, w: .06 + (i % 2) * .04, al: .07 + .04 * Math.sin(t * .23 + i * 2.1) });
          softRays(sx, sy, rs, Math.max(W, H) * 1.5, '255,210,145');
        }
      } else if (lyTime === 'morning') {
        var mx = W * 1.02, my = H * .34, mr = Math.max(W, H) * .7;
        g.save(); g.globalCompositeOperation = 'lighter';
        gr = g.createRadialGradient(mx, my, 0, mx, my, mr); gr.addColorStop(0, 'rgba(255,228,214,.5)'); gr.addColorStop(.2, 'rgba(255,204,192,.2)'); gr.addColorStop(.6, 'rgba(255,196,206,.05)'); gr.addColorStop(1, 'rgba(255,196,206,0)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        g.restore();
        // утренний туман полосами у земли
        for (i = 0; i < mists.length; i++) {
          var mm = mists[i]; if (!still) { mm.x += mm.v * dt * .4; if (mm.x > W + mm.w) mm.x = -mm.w; if (mm.x < -mm.w) mm.x = W + mm.w; }
          g.save(); g.translate(mm.x, H * (.4 + (i % 3) * .1)); g.scale(1, .28);
          var mq = g.createRadialGradient(0, 0, 0, 0, 0, mm.w * 1.5); mq.addColorStop(0, 'rgba(255,244,240,' + (.3 * mm.a) + ')'); mq.addColorStop(1, 'rgba(255,244,240,0)');
          g.fillStyle = mq; g.beginPath(); g.arc(0, 0, mm.w * 1.5, 0, 6.283); g.fill(); g.restore();
        }
        if (SP.rays !== 'off') {
          var rm = [];
          for (i = 0; i < 3; i++) rm.push({ a: Math.PI * (.8 + i * .06) + Math.sin(t * .06 + i * 1.7) * .02, w: .07 + (i % 2) * .04, al: .05 + .03 * Math.sin(t * .2 + i * 2.3) });
          softRays(mx, my, rm, Math.max(W, H) * 1.5, '255,226,210');
        }
      } else if (lyTime === 'blue') {
        gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(60,70,140,.28)'); gr.addColorStop(.5, 'rgba(60,70,140,.05)'); gr.addColorStop(1, 'rgba(20,24,60,.35)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      } else if (lyTime === 'rain') {
        g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(214,212,236,.2)'; g.fillRect(0, 0, W, H); g.restore();
        for (i = 0; i < mists.length; i++) {
          var ms = mists[i]; if (!still) { ms.x += ms.v * dt * .6; if (ms.x > W + ms.w) ms.x = -ms.w; if (ms.x < -ms.w) ms.x = W + ms.w; }
          g.save(); g.translate(ms.x, H * (.3 + (i % 3) * .14)); g.scale(1, .3);
          var mg = g.createRadialGradient(0, 0, 0, 0, 0, ms.w * 1.5); mg.addColorStop(0, 'rgba(240,238,248,' + (.32 * ms.a) + ')'); mg.addColorStop(1, 'rgba(240,238,248,0)');
          g.fillStyle = mg; g.beginPath(); g.arc(0, 0, ms.w * 1.5, 0, 6.283); g.fill(); g.restore();
        }
      } else if (lyTime === 'lights') {
        gr = g.createRadialGradient(cx, cy, R * .3, cx, cy, Math.max(W, H) * .8); gr.addColorStop(0, 'rgba(10,12,34,0)'); gr.addColorStop(1, 'rgba(10,12,34,.55)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
    }
    function drawLayers(t, dt, zoom) {
      if (!lyT0 || now - lyT0 > 30) { lyT0 = now || .001; lyWant = timeNow(LY.time); }   // раз в полминуты сверяемся с часами
      var tm0 = lyWant;
      if (tm0 !== lyTime) {
        document.body.classList.remove('uz-t-' + lyTime); lyTime = tm0; document.body.classList.add('uz-t-' + tm0);
        document.body.classList.toggle('uz-day', tm0 === 'day' || !!tm().light);
      }
      var sk = SKIES[lyTime] || (tm().light ? SKIES.evening : SKIES.night), i, br = backRect(zoom), gi = LY.ground || {}, go = lyImg.ground;
      hY = H * .3;
      if (!br) {
        var sky = g.createLinearGradient(0, 0, 0, H * .8);
        sky.addColorStop(0, sk[0]); sky.addColorStop(.55, sk[1]); sky.addColorStop(1, sk[2]);
        g.fillStyle = sky; g.fillRect(0, 0, W, H);
        if (lyTime === 'night') { g.fillStyle = '#fff'; for (i = 0; i < stars.length; i++) { var s = stars[i]; g.globalAlpha = .25 + .35 * (.5 + .5 * Math.sin(t * .8 + s.ph)); g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.283); g.fill(); } g.globalAlpha = 1; }
        // солнце (днём — за дымкой, вечером — низко), луна ночью
        var sx = lyTime === 'evening' ? W * .22 : W * .78, sy = lyTime === 'evening' ? H * .3 : H * .12, sr = Math.max(W, H) * (lyTime === 'night' ? .12 : .32);
        var sg = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
        sg.addColorStop(0, lyTime === 'night' ? 'rgba(255,244,220,.25)' : lyTime === 'evening' ? 'rgba(255,214,170,.7)' : 'rgba(255,252,240,.85)');
        sg.addColorStop(.12, lyTime === 'night' ? 'rgba(255,244,220,.06)' : 'rgba(255,240,215,.35)'); sg.addColorStop(1, 'rgba(255,240,215,0)');
        g.fillStyle = sg; g.fillRect(0, 0, W, H);
      } else {
        g.drawImage(lyPic('back'), br.x, br.y, br.w, br.h);
        // дымка сверху — чтобы читался заголовок на пёстрой картинке
        lyMood(t, dt);
        var top = g.createLinearGradient(0, 0, 0, H * .22); top.addColorStop(0, 'rgba(' + (HAZE[lyTime] || HAZE.day) + ',' + (lyTime === 'day' ? .75 : .5) + ')'); top.addColorStop(1, 'rgba(' + (HAZE[lyTime] || HAZE.day) + ',0)');
        g.fillStyle = top; g.fillRect(0, 0, W, H * .22);
      }
      // дымка: плывёт полосами (за землёй и под ней — остров стоит в тумане)
      function haze(y0, k) {
        for (var j = 0; j < mists.length; j++) {
          var ms = mists[j]; if (!still && k === 1) { ms.x += ms.v * dt; if (ms.x > W + ms.w) ms.x = -ms.w; if (ms.x < -ms.w) ms.x = W + ms.w; }
          g.save(); g.translate(ms.x, y0 + (j % 3) * H * .05); g.scale(1, .22);
          var mg = g.createRadialGradient(0, 0, 0, 0, 0, ms.w * 1.4); mg.addColorStop(0, 'rgba(' + (HAZE[lyTime] || HAZE.day) + ',' + (k * .38 * ms.a) + ')'); mg.addColorStop(1, 'rgba(' + (HAZE[lyTime] || HAZE.day) + ',0)');
          g.fillStyle = mg; g.beginPath(); g.arc(0, 0, ms.w * 1.4, 0, 6.283); g.fill(); g.restore();
        }
      }
      if (SP.mist !== false && !br) haze(cy - R * sinT * 1.2, 1);
      if (go) {
        var pic = lyPic('ground'), gw = R * (+gi.w || 300) / 100, gh = gw * go.im.height / go.im.width;
        var gx = cx - gw * (gi.x == null ? 50 : +gi.x) / 100 - par * (gi.depth == null ? 0 : +gi.depth) * W * .03, gy = cy - gh * (gi.y == null ? 44 : +gi.y) / 100;
        g.drawImage(pic, gx, gy, gw, gh);
        if (SP.mist !== false && !br) {
          var bot = g.createLinearGradient(0, gy + gh * .7, 0, H);
          bot.addColorStop(0, 'rgba(' + (HAZE[lyTime] || HAZE.day) + ',0)'); bot.addColorStop(1, 'rgba(' + (HAZE[lyTime] || HAZE.day) + ',.85)');
          g.fillStyle = bot; g.fillRect(0, gy + gh * .7, W, H);
        }
      }
      if (SP.mist !== false && !br) haze(Math.min(H * .95, cy + R * sinT * 2.2), .8);
      if (br && SP.motes !== false) drawMotes(t, dt);
      if (br && glints.length && !still) {
        g.save(); g.globalCompositeOperation = 'lighter';
        for (i = 0; i < glints.length; i++) {
          // редкая тихая вспышка точкой (её слово 23.10: без растущего крестика-«мишени»)
          var q = glints[i], a = Math.pow(Math.max(0, Math.sin(t * q.sp * .5 + q.ph)), 24); if (a < .05) continue;
          var x = br.x + q.u * br.w, y = br.y + q.v * br.h; if (y < hY + H * .06) continue;
          g.fillStyle = 'rgba(255,252,240,' + (.9 * a).toFixed(3) + ')'; g.beginPath(); g.arc(x, y, (phone ? .9 : 1.1) * q.r, 0, 6.283); g.fill();
          g.fillStyle = 'rgba(255,246,220,' + (.25 * a).toFixed(3) + ')'; g.beginPath(); g.arc(x, y, (phone ? 2.4 : 3) * q.r, 0, 6.283); g.fill();
        }
        g.restore();
      }
    }
    // частички света (её слово 23.10): мельчайшие золотые пылинки в полосе тумана у кромки леса, немного; плывут по ветру, чуть мерцают
    var motes = [];
    function drawMotes(t, dt) {
      var n = phone || lite ? 16 : 28, i, y0 = H * .2, y1 = Math.max(H * .3, hY + H * .14);
      while (motes.length < n) motes.push({ x: Math.random() * W, y: y0 + Math.random() * (y1 - y0), v: 3 + Math.random() * 6, ph: Math.random() * 6.28, r: .5 + Math.random() * .7 });
      var dark = lyTime === 'night' || lyTime === 'lights' || lyTime === 'blue';
      g.save(); g.globalCompositeOperation = 'lighter';
      for (i = 0; i < motes.length; i++) {
        var m = motes[i];
        if (!still) { m.x += wdir() * m.v * dt; m.y += Math.sin(t * .5 + m.ph) * 2 * dt; if (m.x < -4) m.x = W + 4; if (m.x > W + 4) m.x = -4; }
        var a = (.35 + .45 * (.5 + .5 * Math.sin(t * (.8 + m.r) + m.ph))) * (dark ? .7 : 1);
        g.fillStyle = 'rgba(255,214,140,' + a.toFixed(3) + ')'; g.beginPath(); g.arc(m.x, m.y, m.r * (phone ? .8 : 1), 0, 6.283); g.fill();
      }
      g.restore();
    }
    // лучи рассеянные (её слово 22.10: «прорезанные» полосы не выглядят настоящими): рисуются на маленьком холсте
    // и растягиваются на экран — края сами размываются. Выключатель — space.rays: 'off'
    var rayCv = null;
    function softRays(ox, oy, rays, L, rgb) {
      var k = lite ? 12 : 9, w = Math.ceil(W / k), h = Math.ceil(H / k), x, i;
      if (!rayCv) rayCv = document.createElement('canvas');
      if (rayCv.width !== w || rayCv.height !== h) { rayCv.width = w; rayCv.height = h; }
      x = rayCv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h); x.setTransform(1 / k, 0, 0, 1 / k, 0, 0);
      for (i = 0; i < rays.length; i++) {
        var r = rays[i], rg = x.createLinearGradient(ox, oy, ox + Math.cos(r.a) * L, oy + Math.sin(r.a) * L);
        rg.addColorStop(0, 'rgba(' + rgb + ',' + r.al + ')'); rg.addColorStop(.55, 'rgba(' + rgb + ',' + (r.al * .4) + ')'); rg.addColorStop(1, 'rgba(' + rgb + ',0)');
        x.fillStyle = rg; x.beginPath(); x.moveTo(ox, oy);
        x.lineTo(ox + Math.cos(r.a - r.w) * L, oy + Math.sin(r.a - r.w) * L); x.lineTo(ox + Math.cos(r.a + r.w) * L, oy + Math.sin(r.a + r.w) * L); x.closePath(); x.fill();
      }
      g.save(); g.globalCompositeOperation = 'lighter'; g.imageSmoothingEnabled = true; g.drawImage(rayCv, 0, 0, w * k, h * k); g.restore();
    }
    // днём свет человека — тёплое сияние с медленными мягкими лучами
    function drawRays(t, br) {
      if (SP.rays === 'off') return;
      var n = 6, rs = [];
      for (var i = 0; i < n; i++) rs.push({ a: i / n * 6.283 + t * .04 + Math.sin(t * .3 + i) * .08, w: .16 + .05 * Math.sin(i * 2.3), al: (.04 + .025 * Math.sin(t * .6 + i * 1.7)) * (.8 + .4 * br) });
      softRays(px, py, rs, R * 1.7, '255,236,190');
    }
    // передняя трава — её картинка по низу экрана, качается и сдвигается сильнее всех
    function drawLayerFront(t, w) {
      var o = lyImg.front, L = LY.front || {}; if (!o) return;
      var pic = lyPic('front'), fw = W * (1 + (+L.zoom || 12) / 100), fh = fw * o.im.height / o.im.width, sw = still ? 0 : Math.sin(t * .6) * w * 4;
      gf.drawImage(pic, (W - fw) / 2 - par * (L.depth == null ? 1.4 : +L.depth) * W * .03 + sw, H - fh * (L.show == null ? 1 : +L.show / 100), fw, fh);
    }
    // Искорки: из света по плавной дуге к цветам, гаснут по дороге. Касание света — по искорке к каждому, цветы вспыхивают.
    function spark(c, T, lit) {
      var side = Math.random() < .5 ? -1 : 1;
      sparks.push({ c: c, t0: performance.now(), T: T, bend: (.25 + Math.random() * .35) * side, up: .3 + Math.random() * .4, lit: lit, r: 1.2 + Math.random() * 1.1 });
    }
    function drawSparks(ts, dt) {
      if (SP.sparks !== false && !still && !fly) {
        sparkAcc += dt * (LINKS[SP.linkAmount] || .5) * (lite ? .6 : 1);
        while (sparkAcc >= 1) {
          sparkAcc -= 1;
          var free = els.filter(function (x) { return !x.gone && !x.flying; });
          if (free.length) spark(free[Math.floor(Math.random() * free.length)], 3200 + Math.random() * 1800, false);
        }
      }
      for (var i = sparks.length - 1; i >= 0; i--) {
        var S = sparks[i], c = S.c, u = (ts - S.t0) / S.T;
        if (u >= 1 || c.gone) {
          if (S.lit && !c.gone) { c.el.classList.add('is-lit'); (function (n) { setTimeout(function () { n.classList.remove('is-lit'); }, 700); })(c.el); }
          sparks.splice(i, 1); continue;
        }
        var e = S.lit ? u : u * (2 - u), dx = c.hx - px, dy = c.hy - py, len = Math.sqrt(dx * dx + dy * dy) || 1;
        var mx = px + dx / 2 - dy / len * len * S.bend, my = py + dy / 2 + dx / len * len * S.bend - len * S.up * .3;
        var x = (1 - e) * (1 - e) * px + 2 * (1 - e) * e * mx + e * e * c.hx, y = (1 - e) * (1 - e) * py + 2 * (1 - e) * e * my + e * e * c.hy;
        var al = S.lit ? (u < .85 ? 1 : (1 - u) / .15) : Math.min(1, u * 6) * Math.max(0, 1 - Math.max(0, u - .55) / .4);
        al *= linkBright;
        if (al <= 0) continue;
        var rg = g.createRadialGradient(x, y, 0, x, y, S.r * 5);
        rg.addColorStop(0, 'rgba(255,244,220,' + Math.min(1, al) + ')'); rg.addColorStop(.3, 'rgba(255,220,160,' + Math.min(1, al * .5) + ')'); rg.addColorStop(1, 'rgba(255,220,160,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(x, y, S.r * 5, 0, 6.283); g.fill();
      }
    }
    // светлячки: летают низко над поляной, мигают; дальние — за цветами, ближние — перед ними
    function drawFlies(ctx, t, dt, zoom, front) {
      if (SP.fireflies === false || (LY && !tm().flies && lyTime !== 'blue')) return;
      for (var i = 0; i < flies.length; i++) {
        var f = flies[i]; if (LY && lyTime === 'blue' && i % 3) continue;
        if ((f.Z >= 0) !== front) continue;
        if (!still) { f.dir += (Math.random() - .5) * dt * 2; f.X += Math.cos(f.dir) * f.v * dt; f.Z += Math.sin(f.dir) * f.v * dt;
          if (f.X * f.X + f.Z * f.Z > 6 || f.Z > 1.1 || f.Z < -2.6) f.dir += Math.PI * dt * 2; }
        var p = proj(f.X * R, (f.y + .08 * Math.sin(t * 1.3 + f.ph)) * hc * zoom * 1.6, f.Z * R);
        if (p.y < hY) continue;
        var bl = Math.pow(Math.max(0, Math.sin(t * f.bl + f.ph)), 3), r = 7 * p.f * zoom;
        if (bl < .03) continue;
        var rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        rg.addColorStop(0, 'rgba(240,255,170,' + (.95 * bl) + ')'); rg.addColorStop(.25, 'rgba(210,240,120,' + (.45 * bl) + ')'); rg.addColorStop(1, 'rgba(210,240,120,0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      }
    }
    /* ---------- Бабочки (её решение 22.10): сидят на поляне и на цветах, у каждой свой узор, он медленно меняется.
       Тронул сидящую — вспорхнула; тронул летящую — «поймал», и она садится на ближайший цветок. Всё — только на экране. ---------- */
    var bfGrabbed = false, bfPerch = null;
    var BF_KINDS = ['kapustnica', 'limonnica', 'golubyanka', 'krapivnica', 'pavlin'];
    var BF_TINT = { morning: 'rgba(255,214,204,.1)', gold: 'rgba(255,160,80,.16)', blue: 'rgba(40,52,120,.32)', rain: 'rgba(220,220,235,.12)', lights: 'rgba(18,22,58,.45)',
      night: 'rgba(14,18,48,.5)', evening: 'rgba(240,150,110,.15)' };
    function bfKinds() {
      var on = SP.bfly && SP.bfly.length ? SP.bfly : BF_KINDS;
      return BF_KINDS.filter(function (k) { return on.indexOf(k) >= 0; });
    }
    // место на поляне (в плоскости земли, в долях радиуса): не под светом, не под нижним окном, на экране
    function bfSpot() {
      var sh = document.querySelector('.uz-sheet:not([hidden])'), top = H, sr = scene.getBoundingClientRect(), k, X, Z, p;
      if (sh) { var r = sh.getBoundingClientRect(); if (r.height) top = r.top - sr.top - 14; }
      var near = LY && Math.random() < .6;   // сад слоями: чаще — на мху и кочках впереди (её слово 23.10)
      for (k = 0; k < 40; k++) {
        X = (Math.random() * 2 - 1) * (near ? 1.9 : 1.5); Z = near ? 1.1 + Math.random() * 1.3 : -1.3 + Math.random() * 2.6;
        if (X * X + Z * Z < .2) continue;
        p = proj(X * R, 0, Z * R);
        if (p.x > 24 && p.x < W - 24 && p.y > hY + 16 && p.y < top) return { X: X, Z: Z };
      }
      return { X: .9, Z: .2 };
    }
    // садятся только на цветы переднего полукруга: бабочки рисуются поверх цветов, на заднем цветке она «висела» бы перед ближними (её слово 23.10 про перспективу)
    function bfFree() { return focus || fly ? [] : els.filter(function (x) { return !x.gone && !x.flying && x.v !== 'card' && x.op > .45 && (!LY || x.d > .42); }); }   // выбрали цветок — на цветы не садятся
    function seedBflies() {
      if (bflies.length || SP.moths === false) return;
      var kinds = bfKinds(), n = Math.min(kinds.length, phone ? 4 : 5), i, fl = bfFree();
      kinds = kinds.slice().sort(function () { return Math.random() - .5; });
      for (i = 0; i < n; i++) {
        var b = { k: kinds[i], st: 'sit', on: null, g: null, x: W / 2, y: H / 2, f: 1, vx: 0, vy: 0, ph: Math.random() * 6.28, s: .85 + Math.random() * .3,
          side: Math.random() < .5 ? -1 : 1, hd: (Math.random() - .5) * 1.1, until: performance.now() + 15000 + Math.random() * 40000, open: .8, seed: Math.random(), seedTo: 0, tx: 0, ty: 0, next: 0 };
        b.seedTo = b.seed;
        if (i < 2 && fl.length) b.on = fl.splice(Math.floor(Math.random() * fl.length), 1)[0]; else b.g = bfSpot();
        bflies.push(b);
      }
    }
    function bfPos(b, zoom) {
      if (b.on) return { x: b.on.hx, y: b.on.hy - 2, f: b.on.f * zoom };
      var p = proj(b.g.X * R, 0, b.g.Z * R); return { x: p.x, y: p.y, f: p.f * zoom };
    }
    // летящая: чем выше на экране (ближе к горизонту), тем дальше и меньше
    function bfDepth(y) { var u = (y - hY) / (H - hY); return LY ? Math.max(.5, Math.min(1.3, .5 + u * .9)) : Math.max(.75, Math.min(1.3, .7 + u * .7)); }
    function bfSize(f) { return LY ? (phone ? 9 : 11) * Math.max(.4, Math.min(1.3, f)) : (phone ? 12 : 15) * Math.max(.75, Math.min(1.35, f)); }   // сад слоями: мельче, вдали заметно меньше (её слово 23.10)
    function bfTakeOff(b, ts, free) {
      b.st = 'fly'; b.on = null; b.g = null; b.vy = -90; b.vx = (Math.random() - .5) * 80; b.next = 0;
      b.until = ts + (free ? 9000 + Math.random() * 8000 : 1500 + Math.random() * 1500);
      b.seedTo = Math.random();                                 // в полёте узор перетекает в новый
    }
    function bfLand(b, c, spot) { b.st = 'land'; b.tgt = c || null; b.gt = c ? null : spot || bfSpot(); }
    function bfHit(x, y, zoom) {
      var best = null, bd = 1e9;
      for (var i = 0; i < bflies.length; i++) {
        var b = bflies[i], s = bfSize(b.f || 1) * b.s, r = b.st === 'sit' ? Math.max(24, s * 2.4) : Math.max(36, s * 3.2), dx = b.x - x, dy = b.y - y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < r && d < bd) { bd = d; best = b; }
      }
      return best;
    }
    function bfTap(b, x, y) {
      var ts = performance.now(); hideGardenHint();
      if (b.st === 'sit') { bfTakeOff(b, ts, true); return; }
      // поймал — садится на ближайший к пальцу цветок
      var fl = bfFree(), c = null, bd = 1e9;
      fl.forEach(function (e) { var dx = e.hx - x, dy = e.hy - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; c = e; } });
      bfLand(b, c);
    }
    // «зацепить и пересадить» (её слово 22.10): нажал и держишь — бабочка у тебя (сияние, трепещет, лёгкая вибрация),
    // ведёшь — летит за пальцем; отпустил над цветком — садится на него, над травой — на траву под пальцем
    function bfGrab(b, x, y) {
      b.st = 'held'; b.on = null; b.g = null; b.tgt = null; b.hx = x; b.hy = y - (phone ? 34 : 18); b.seedTo = Math.random();
      hideGardenHint(); bfGrabbed = true;
      if (SP.vibrate !== false && navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
    }
    function bfPerchAt(x, y) {
      var c = null, bd = 1e9;
      bfFree().forEach(function (e) { var dx = e.hx - x, dy = e.hy - y, d = Math.sqrt(dx * dx + dy * dy), r = Math.max(34, cw * .9 * e.f); if (d < r && d < bd) { bd = d; c = e; } });
      return c;
    }
    function groundAt(x, y) {
      var dy = y - cy; if (y < hY + 10 || sinT * CAM + dy <= 0) return null;
      var Z = dy * CAM / (sinT * CAM + dy), f = CAM / (CAM - Z), X = (x - cx) / f;
      if (Z > R * 2.2 || Z < -R * 3) return null;
      return { X: X / R, Z: Z / R };
    }
    function bfDrop(b) {
      var c = bfPerchAt(b.hx, b.hy);
      if (c) bfLand(b, c); else bfLand(b, null, groundAt(b.x, b.y + 6));
    }
    function drawBflies(ctx, t, dt, ts, zoom) {
      if (SP.moths === false) return;
      if (!bflies.length) seedBflies();
      var tint = LY ? BF_TINT[lyTime] : 'rgba(20,24,60,.42)';
      for (var i = 0; i < bflies.length; i++) {
        var b = bflies[i];
        if (b.on && (b.on.gone || b.on.flying || fly || focus)) bfTakeOff(b, ts, false);   // выбрали цветок — бабочки с цветов вспархивают
        if (b.st === 'held') {
          // в руке: летит за пальцем (чуть выше него — чтобы палец не закрывал)
          var kk = Math.min(1, dt * 14); b.x += (b.hx - b.x) * kk; b.y += (b.hy - b.y) * kk;
          b.f = LY ? b.f + (bfDepth(b.y) - b.f) * Math.min(1, dt * 3) : bfDepth(b.y);
        } else if (b.st === 'sit') {
          var p = bfPos(b, zoom); b.x = p.x; b.y = p.y; b.f = LY ? b.f + (bfDepth(p.y) - b.f) * Math.min(1, dt * 3) : p.f;
          if (!still && ts > b.until && mode !== 'flying') { bfTakeOff(b, ts, false); }
        } else if (!still) {
          var tx, ty;
          if (b.st === 'fly') {
            if (ts > b.until) { var fl = bfFree(); bfLand(b, fl.length && Math.random() < (LY ? .35 : .5) && mode !== 'q' ? fl[Math.floor(Math.random() * fl.length)] : null); }
            else {
              if (ts > b.next) { b.tx = W * (.1 + Math.random() * .8); b.ty = Math.max(hY - 20, 50) + Math.random() * H * .45; b.next = ts + 1800 + Math.random() * 2500; }
              tx = b.tx; ty = b.ty;
            }
          }
          if (b.st === 'land') {
            if (b.tgt && (b.tgt.gone || b.tgt.flying || focus || fly)) { b.tgt = null; b.gt = bfSpot(); }
            var q = b.tgt ? { x: b.tgt.hx, y: b.tgt.hy - 2 } : proj(b.gt.X * R, 0, b.gt.Z * R); tx = q.x; ty = q.y;
          }
          var dx = tx - b.x, dy = ty - b.y, d = Math.sqrt(dx * dx + dy * dy) || 1, sp = b.st === 'land' ? Math.min(110, 40 + d * 1.2) : 75;
          if (b.st === 'land' && d < 5) {
            b.st = 'sit'; b.on = b.tgt; b.g = b.tgt ? null : b.gt; b.tgt = null; b.hd = (Math.random() - .5) * 1.1; b.side = b.vx > 0 ? -1 : 1;
            b.until = ts + (b.on ? 12000 : LY ? 30000 : 20000) + Math.random() * (LY && !b.on ? 50000 : 35000); continue;
          }
          var wob = b.st === 'land' && d < 40 ? .3 : 1;
          b.vx += (dx / d * sp - b.vx) * dt * 2.2 + Math.sin(t * 3.3 + b.ph) * 46 * dt * wob;
          b.vy += (dy / d * sp - b.vy) * dt * 2.2 + Math.cos(t * 2.5 + b.ph) * 60 * dt * wob;
          b.x += b.vx * dt; b.y += b.vy * dt;
          b.f = LY ? b.f + (bfDepth(b.y) - b.f) * Math.min(1, dt * 3) : bfDepth(b.y);
        }
        if (!still) b.seed += (b.seedTo - b.seed) * Math.min(1, dt * .5);
        // крылья: сидит — полусложены, медленно чуть раскрываются; летит — машет; в руке — часто трепещет
        var sit = b.st === 'sit', held = b.st === 'held';
        var target = sit ? Math.pow(.5 + .5 * Math.sin(t * .9 + b.ph), 1.6) : .2 + .8 * Math.abs(Math.cos(t * (held ? 24 : 13) + b.ph));
        if (!still) b.open = sit ? b.open + (target - b.open) * Math.min(1, dt * 4) : target;
        var s = bfSize(b.f || 1) * b.s, hd = sit ? b.hd * .4 : Math.max(-.6, Math.min(.6, b.vx / 150));
        if (held) {
          var hg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, s * 4); hg.addColorStop(0, 'rgba(255,244,210,.8)'); hg.addColorStop(.35, 'rgba(255,236,190,.35)'); hg.addColorStop(1, 'rgba(255,240,200,0)');
          ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(b.x, b.y, s * 4, 0, 6.283); ctx.fill();
        }
        // вдали — меньше и в дымке (сад слоями — без дымки, как и цветы)
        ctx.globalAlpha = held || LY ? 1 : Math.max(.6, Math.min(1, .45 + .5 * (b.f || 1)));
        if (sit) {
          // тень на траве или на цветке — еле заметная, сбоку снизу
          ctx.save(); ctx.translate(b.x + s * .25, b.y + s * (b.on ? .12 : .08)); ctx.scale(1, .28);
          ctx.fillStyle = 'rgba(20,30,16,' + (b.on ? .14 : .24) + ')'; ctx.beginPath(); ctx.arc(0, 0, s * .95, 0, 6.283); ctx.fill(); ctx.restore();
          bfSide(ctx, b, s, hd, b.open, t, tint);
        } else bfDraw(ctx, b, s, hd, b.open, t, tint);
        ctx.globalAlpha = 1;
      }
    }
    // форма крыла (правое; левое — зеркально). Единица — длина переднего крыла.
    function wingFore(ctx, k) {
      ctx.beginPath(); ctx.moveTo(.04, -.12);
      if (k === 'limonnica') { ctx.bezierCurveTo(.25, -.75, .7, -.98, 1.02, -.92); ctx.bezierCurveTo(.98, -.55, .9, -.22, .7, -.05); ctx.bezierCurveTo(.45, .02, .2, .02, .05, .02); }
      else if (k === 'golubyanka') { ctx.bezierCurveTo(.2, -.62, .6, -.86, .86, -.78); ctx.bezierCurveTo(.98, -.5, .82, -.16, .55, -.04); ctx.bezierCurveTo(.35, .02, .15, .02, .05, .02); }
      else { ctx.bezierCurveTo(.22, -.7, .66, -.95, .98, -.86); ctx.bezierCurveTo(1.05, -.62, .95, -.28, .74, -.08); ctx.bezierCurveTo(.48, .02, .2, .03, .05, .02); }
      ctx.closePath();
    }
    function wingHind(ctx, k) {
      ctx.beginPath(); ctx.moveTo(.05, -.02);
      if (k === 'limonnica') { ctx.bezierCurveTo(.5, -.06, .86, .14, .82, .42); ctx.lineTo(.86, .5); ctx.bezierCurveTo(.66, .8, .3, .74, .06, .3); }
      else if (k === 'golubyanka') { ctx.bezierCurveTo(.42, -.04, .7, .14, .66, .4); ctx.bezierCurveTo(.6, .62, .28, .64, .06, .3); }
      else if (k === 'pavlin' || k === 'krapivnica') { ctx.bezierCurveTo(.5, -.06, .82, .1, .8, .36); ctx.quadraticCurveTo(.78, .48, .7, .5); ctx.quadraticCurveTo(.64, .62, .54, .64); ctx.bezierCurveTo(.4, .76, .2, .62, .06, .3); }
      else { ctx.bezierCurveTo(.5, -.05, .8, .16, .74, .44); ctx.bezierCurveTo(.66, .7, .3, .7, .06, .3); }
      ctx.closePath();
    }
    function hsl(h, s, l, a) { return 'hsla(' + Math.round(h) + ',' + s + '%,' + l + '%,' + (a == null ? 1 : a) + ')'; }
    function disc(ctx, x, y, r, col) { if (r <= 0) return; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); }
    // узор: m — медленное «дыхание» узора (0..1), v — вариант (меняется после полёта), o — раскрытость крыла (для отлива)
    function wingPattern(ctx, k, fore, m, v, o) {
      var i, gr;
      if (k === 'kapustnica') {
        ctx.fillStyle = hsl(48, 40, 95); ctx.fillRect(-.2, -1.2, 1.5, 2.2);
        gr = ctx.createRadialGradient(0, 0, 0, 0, 0, .7); gr.addColorStop(0, 'rgba(120,130,110,.35)'); gr.addColorStop(1, 'rgba(120,130,110,0)'); ctx.fillStyle = gr; ctx.fillRect(-.2, -1.2, 1.5, 2.2);
        if (fore) {
          disc(ctx, 1.02, -.92, .34 + .08 * m + .06 * v, hsl(225, 12, 22, .92));
          disc(ctx, .5 + .06 * v, -.4, .065 + .03 * m, hsl(225, 12, 22, .9));
          disc(ctx, .62 + .05 * v, -.15, (.05 + .02 * m) * (v > .4 ? 1 : .3), hsl(225, 12, 22, .85));
        } else { ctx.fillStyle = hsl(52, 70, 82, .45 + .25 * m); ctx.fillRect(.4, .1, 1, 1); disc(ctx, .28, .02, .045, hsl(225, 12, 30, .7)); }
      } else if (k === 'limonnica') {
        var h = 54 + 12 * m + 6 * v;
        ctx.fillStyle = hsl(h, 85, 70); ctx.fillRect(-.2, -1.2, 1.5, 2.2);
        gr = ctx.createLinearGradient(0, 0, 1, 0); gr.addColorStop(0, hsl(h + 18, 60, 62, .5)); gr.addColorStop(1, hsl(h, 90, 80, 0)); ctx.fillStyle = gr; ctx.fillRect(-.2, -1.2, 1.5, 2.2);
        ctx.strokeStyle = hsl(h - 10, 40, 45, .25); ctx.lineWidth = .02;
        for (i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(.05, 0); ctx.quadraticCurveTo(.4, fore ? -.3 - i * .12 : .1 + i * .1, fore ? .95 : .78, fore ? -.75 + i * .2 : .2 + i * .1); ctx.stroke(); }
        disc(ctx, fore ? .46 : .42, fore ? -.44 : .3, .045 + .025 * m, hsl(24, 90, 52));
      } else if (k === 'golubyanka') {
        var hb = 222 + 26 * (m - .5) + 30 * (o - .5) + 14 * v;        // отлив меняется, когда крыло поворачивается
        gr = ctx.createRadialGradient(0, 0, 0, 0, 0, .95); gr.addColorStop(0, hsl(hb + 34, 50, 48)); gr.addColorStop(.6, hsl(hb, 72, 66)); gr.addColorStop(1, hsl(hb - 12, 80, 78));
        ctx.fillStyle = gr; ctx.fillRect(-.2, -1.2, 1.5, 2.2);
        if (!fore) for (i = 0; i < 4; i++) disc(ctx, .24 + i * .14, .5 - Math.abs(i - 1.5) * .06, .028 + .012 * m, hsl(230, 30, 22, .7));
      } else if (k === 'krapivnica') {
        ctx.fillStyle = hsl(20 + 6 * v, 86, 54); ctx.fillRect(-.2, -1.2, 1.5, 2.2);
        gr = ctx.createRadialGradient(0, 0, 0, 0, 0, fore ? .45 : .62); gr.addColorStop(0, 'rgba(40,24,18,.95)'); gr.addColorStop(1, 'rgba(40,24,18,0)'); ctx.fillStyle = gr; ctx.fillRect(-.2, -1.2, 1.5, 2.2);
        if (fore) {
          [[.3, -.56], [.56, -.7], [.82, -.82]].forEach(function (q, j) { ctx.fillStyle = 'rgba(30,20,16,.92)'; ctx.fillRect(q[0] - .07, q[1] - .1, .14, .2 + .04 * m); if (j < 2) disc(ctx, q[0] + .13, q[1] - .02, .05, hsl(48, 90, 70, .9)); });
          disc(ctx, .92, -.74, .04, 'rgba(255,255,250,.9)'); disc(ctx, .42, -.3, .05 + .02 * v, 'rgba(30,20,16,.85)');
        }
      } else if (k === 'pavlin') {
        ctx.fillStyle = fore ? hsl(356 + 8 * v, 58, 38) : hsl(14, 30, 26); ctx.fillRect(-.2, -1.2, 1.5, 2.2);
        var ex = fore ? .74 : .5, ey = fore ? -.66 : .36, er = (fore ? .2 : .19) * (.92 + .1 * m), bh = 205 + 30 * m;
        disc(ctx, ex, ey, er, 'rgba(25,18,20,.95)'); disc(ctx, ex, ey, er * .8, fore ? hsl(45, 70, 72) : hsl(bh, 55, 55));
        disc(ctx, ex, ey, er * .58, fore ? hsl(bh, 60, 58) : 'rgba(20,16,20,.95)'); disc(ctx, ex, ey, er * .3, 'rgba(20,16,20,.95)');
        disc(ctx, ex + er * .2, ey - er * .25, er * .12, 'rgba(255,255,255,.85)');
      }
    }
    function bfDraw(ctx, b, s, hd, open, t, tint) {
      var m = .5 + .5 * Math.sin(t * .35 + b.ph), k = b.k, sd;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(hd); ctx.scale(s, s * .82);
      for (sd = -1; sd <= 1; sd += 2) {
        ctx.save(); ctx.scale(sd * open, 1);
        [false, true].forEach(function (fore) {
          ctx.save(); if (fore) wingFore(ctx, k); else wingHind(ctx, k); ctx.clip();
          wingPattern(ctx, k, fore, m, b.seed, open);
          // край крыла темнее, блик — бежит по крылу, когда оно поворачивается
          ctx.lineWidth = .1; ctx.strokeStyle = k === 'kapustnica' ? 'rgba(60,60,70,.35)' : k === 'golubyanka' ? 'rgba(255,255,255,.9)' : 'rgba(30,20,20,.55)';
          if (fore) wingFore(ctx, k); else wingHind(ctx, k); ctx.stroke();
          if (k === 'krapivnica') { ctx.fillStyle = 'rgba(30,20,16,.7)'; for (var j = 0; j < 5; j++) disc(ctx, fore ? .98 - j * .02 : .74 - j * .14, fore ? -.7 + j * .14 : .44 + j * .05, .035, hsl(205, 80, 62, .9)); }
          var gx = -.4 + 1.6 * open, gl = ctx.createLinearGradient(gx - .3, -.6, gx + .3, .4);
          gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(.5, 'rgba(255,255,255,' + (.18 + .1 * m) + ')'); gl.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = gl; ctx.fillRect(-.2, -1.2, 1.5, 2.2);
          if (tint) { ctx.fillStyle = tint; ctx.fillRect(-.2, -1.2, 1.5, 2.2); }
          ctx.restore();
        });
        ctx.restore();
      }
      // тельце, голова, усики с булавами
      ctx.fillStyle = k === 'kapustnica' || k === 'limonnica' ? 'rgba(70,64,56,.95)' : 'rgba(34,26,24,.95)';
      ctx.beginPath(); ctx.ellipse(0, .12, .06, .36, 0, 0, 6.283); ctx.fill(); disc(ctx, 0, -.27, .07, ctx.fillStyle);
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = .025;
      for (sd = -1; sd <= 1; sd += 2) { ctx.beginPath(); ctx.moveTo(sd * .02, -.32); ctx.quadraticCurveTo(sd * .08, -.6, sd * .2, -.7); ctx.stroke(); disc(ctx, sd * .2, -.7, .035, ctx.strokeStyle); }
      ctx.restore();
    }
    // сидящая бабочка — сбоку: тельце лежит, крылья подняты и полусложены «домиком» (её слово 22.10: не «на экране», а на траве)
    function bfSide(ctx, b, s, hd, open, t, tint) {
      var m = .5 + .5 * Math.sin(t * .35 + b.ph), k = b.k, sd = b.side || 1, v = .1 + .32 * open;
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(sd, 1); ctx.rotate(hd); ctx.scale(s * 1.1, s * 1.1); ctx.rotate(-Math.PI / 2);
      // дальние крылья — чуть темнее и отклонены назад, ближние — вперёд
      [[-v, .62, 'rgba(20,24,20,.28)'], [v * .4, 1, null]].forEach(function (w) {
        ctx.save(); ctx.translate(0, .08); ctx.rotate(w[0]); ctx.scale(w[1] * (.9 + .1 * open), 1);
        [false, true].forEach(function (fore) {
          ctx.save(); if (fore) wingFore(ctx, k); else wingHind(ctx, k); ctx.clip();
          wingPattern(ctx, k, fore, m, b.seed, .5);
          if (w[2]) { ctx.fillStyle = w[2]; ctx.fillRect(-.2, -1.2, 1.5, 2.2); }
          if (tint) { ctx.fillStyle = tint; ctx.fillRect(-.2, -1.2, 1.5, 2.2); }
          ctx.restore();
          ctx.lineWidth = .06; ctx.strokeStyle = k === 'golubyanka' ? 'rgba(255,255,255,.7)' : 'rgba(30,20,20,.45)';
          if (fore) wingFore(ctx, k); else wingHind(ctx, k); ctx.stroke();
        });
        ctx.restore();
      });
      // тельце вдоль земли, голова и усики вперёд-вверх
      ctx.fillStyle = k === 'kapustnica' || k === 'limonnica' ? 'rgba(70,64,56,.95)' : 'rgba(34,26,24,.95)';
      ctx.beginPath(); ctx.ellipse(0, .12, .07, .38, 0, 0, 6.283); ctx.fill(); disc(ctx, 0, -.28, .08, ctx.fillStyle);
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = .035;
      [.16, .3].forEach(function (u) { ctx.beginPath(); ctx.moveTo(.03, -.33); ctx.quadraticCurveTo(u * .5, -.6, u, -.72); ctx.stroke(); disc(ctx, u, -.72, .04, ctx.strokeStyle); });
      ctx.restore();
    }
    // кустик травы у корня каждого цветка — цветок растёт из травы
    function drawRoots(t, w, zoom) {
      gf.lineCap = 'round';
      for (var i = 0; i < els.length; i++) {
        var c = els[i]; if (c.gone || c.flying || c.v === 'card') continue;
        var s = c.f * zoom * size, n = 7, hh = ch * .26 * s, lean = still ? 0 : wdir() * (w * .1 + .02) * (.4 + .6 * Math.sin(t * 1.4 + c.ph));
        gf.strokeStyle = 'rgba(' + Math.round(60 + 40 * c.d) + ',' + Math.round(96 + 40 * c.d) + ',' + Math.round(92 + 20 * c.d) + ',' + (.55 + .35 * c.d) * c.op + ')';
        gf.lineWidth = Math.max(.8, 1.6 * s);
        gf.beginPath();
        for (var k = 0; k < n; k++) {
          var u = k / (n - 1) - .5, x0 = c.gx + u * cw * .62 * s, h2 = hh * (.55 + .45 * Math.cos(u * 2.6)) * (.8 + .2 * Math.sin(k * 2.7 + c.ph)), a = lean + u * .9;
          gf.moveTo(x0, c.gy + 1); gf.quadraticCurveTo(x0 + Math.sin(a) * h2 * .3, c.gy - h2 * .6, x0 + Math.sin(a) * h2, c.gy - Math.cos(a) * h2);
        }
        gf.stroke();
      }
    }
    function drawPetals(ctx, t, w, front) {
      var psz = (+SP.psize || 100) / 100;
      for (var i = 0; i < petals.length; i++) {
        var p = petals[i]; if (p.front !== front) continue;
        if (!still) {
          p.x += wdir() * (w * 1.8 + .25) * p.v; p.y += (.25 + Math.sin(t * 1.3 + i) * .35) * p.v; p.a += p.va * .02 * (1 + w);
          if (p.x > W + 20 || p.x < -20 || p.y > H + 20) { petals[i] = newPetal(false); petals[i].front = front; continue; }
        }
        var sz = p.s * psz;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(1, .45 + .55 * Math.abs(Math.sin(p.a * 1.7)));
        ctx.globalAlpha = front ? .75 : .55; ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, sz, sz * .55, 0, 0, 6.283); ctx.fill(); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    function drawFront(t, w, dt, ts, zoom) {
      gf.clearRect(0, 0, W, H);
      if (LY) { drawLayerFront(t, w); drawFlies(gf, t, dt, zoom, true); drawBflies(gf, t, dt, ts, zoom); if (SP.pollen !== false) drawPetals(gf, t, w, true); return; }
      drawRoots(t, w, zoom);
      drawFlies(gf, t, dt, zoom, true);
      drawBflies(gf, t, dt, ts, zoom);
      for (var i = 0; i < grass.length; i++) {
        var b = grass[i], lean = wdir() * (w * .12 + .02) * (1 + .6 * Math.sin(wp * 1.4 - wdir() * b.x * .03 + b.ph)) + .04 * Math.sin(b.ph);
        var tx = b.x + Math.sin(lean) * b.h, ty = H - Math.cos(lean) * b.h;
        gf.fillStyle = b.c < .5 ? 'rgba(14,22,36,.95)' : 'rgba(24,36,52,.92)';
        gf.beginPath(); gf.moveTo(b.x - b.w, H + 2); gf.quadraticCurveTo(b.x + (tx - b.x) * .4, H - b.h * .55, tx, ty); gf.quadraticCurveTo(b.x + (tx - b.x) * .45, H - b.h * .5, b.x + b.w, H + 2); gf.fill();
      }
      if (SP.pollen !== false) drawPetals(gf, t, w, true);
    }
    function placeEls(t, w, ts, zoom) {
      var fi = frontIdx(), showFront = mode === 'choose';
      for (var i = 0; i < els.length; i++) {
        var c = els[i]; if (c.gone) continue;
        var a = ringA(base + i * STEP), sn = Math.sin(a), cs = Math.cos(a);
        var card = c.v === 'card', sway = still || !card ? 0 : wdir() * w * (.04 + .03 * Math.sin(wp * 1.1 + c.ph));
        var X = R * sn * (card ? 1 : ovalX()) + sway * R * .15, Z = R * cs;
        var lift2 = card && SP.wave !== false ? ch * .12 * Math.sin(3 * a - now * .7) : 0;
        var p = proj(X, card ? (hc + lift2) * zoom : 0, Z), gp = proj(X, 0, Z);
        var d = (cs + 1) / 2, s = p.f * zoom, op = .5 + .5 * d, sink = 0;
        // сад слоями: цветок посажен «в ямку» — основание чуть ниже земли (низ стебля растворяется в мох, CSS),
        // задние чуть меньше, без дымки (её слово 23.10: дымка — «как в пыли», цветы ясные и вдали)
        if (LY && !card && !c.flying) { s *= .86 + .14 * d; op = 1; sink = c.h * s * .06 / (c.k || 1); p.y += sink; }
        var turn = card ? Math.asin(sn) * 180 / Math.PI * .85 : 0;
        // живой цветок медленно покачивается от основания стебля: своё качание (~10 и ~23 с) + волна ветра идёт по саду
        var rot = still ? 0 : card ? wdir() * w * (2 + 1.6 * Math.sin(wp * 1.2 + c.ph)) + Math.sin(now * .9 + c.ph) * 1.2
          : Math.sin(now * .62 + c.ph) * 1.5 + Math.sin(now * .27 + c.ph * 1.7) * .9 + wdir() * w * 1.7 * (Math.sin(wp * .45 - wdir() * c.gx / (W || 1) * 3) + .35);
        var front = showFront && i === fi && d > .9 && !fly;
        if (focus && c !== focus) op *= .22;
        var z = Math.round(50 + Z / R * 45);
        if (c.flying) { var r = flyPos(c, ts); p = { x: r.x, y: r.y }; s = r.s; op = r.op; rot = 0; turn = turn * (1 - r.e); z = 170; }
        else if (c === focus) z = 99;
        if (front) s *= 1.1;
        c.x = p.x; c.y = p.y; c.gx = gp.x; c.gy = gp.y; c.f = p.f || 1; c.d = d; c.op = op;
        var hl = card || c.flying ? 0 : c.h * s * (1 - .26 / (c.k || 1)), rr = rot * Math.PI / 180;
        c.hx = p.x + Math.sin(rr) * hl; c.hy = p.y - Math.cos(rr) * hl;
        if (c.isFront !== front) { c.isFront = front; c.el.classList.toggle('is-front', front); }
        c.el.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px) scale(' + s.toFixed(3) + ')' +
          (card ? ' perspective(' + (cw * 6) + 'px) rotateY(' + turn.toFixed(1) + 'deg)' : '') + ' rotate(' + rot.toFixed(2) + 'deg)';
        c.el.style.opacity = op.toFixed(3);
        c.el.style.zIndex = z;
        if (card) c.el.style.setProperty('--gl', (sn * -45).toFixed(1) + '%');
      }
    }
    var flareAt = -1e9;
    function flare(ts) { var u = (ts - flareAt) / 1600; return u < 0 || u > 1 ? 0 : Math.sin(Math.PI * Math.min(1, u)) * .9; }
    function placeMe(t, ts, zoom) {
      var br = still ? .5 : breathVal(t);
      me.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px)';
      me.style.setProperty('--br', (0.85 + .35 * br + flare(ts)).toFixed(3));
      me.style.setProperty('--bc', (0.9 + .18 * br + flare(ts) * .5).toFixed(3));
      var hz = zoom * (phone ? 1 : .9);
      if (merged && ts - born > 1900) { me.classList.add('is-calm'); heart.style.setProperty('--hb', (hz * (1 + .045 * (br - .5))).toFixed(4)); heart.style.setProperty('--hc', (.55 + .45 * br).toFixed(3)); }
      else if (merged) heart.style.setProperty('--hb', hz.toFixed(4));
      var below = merged ? heartH * .68 * hz + 8 : 19, above = merged ? heartH * .32 * hz + 10 : 21;
      cap.style.transform = 'translate(' + px.toFixed(1) + 'px,' + (py + below).toFixed(1) + 'px) translateX(-50%)';
      nameEl.style.transform = 'translate(' + px.toFixed(1) + 'px,' + (py - above).toFixed(1) + 'px) translate(-50%,-100%)';
    }

    /* ---------- действия ---------- */
    function pulse() {
      var ts = performance.now(); flareAt = ts;
      if (SP.ground !== false) ripples.push({ t0: ts });
      if (SP.sparks !== false || SP.ground !== false) els.forEach(function (c, k) { if (!c.gone && !c.flying) spark(c, 900 + k * 25 + Math.random() * 200, true); });
    }
    function liven() { if (!spin && !fly && !touched && spd()) speed = Math.max(speed, .9); }
    var SHEETS = ['sh-mode', 'sh-random', 'sh-choose', 'sh-own', 'sh-wait', 'sh-reveal', 'sh-name', 'sh-q', 'sh-res', 'sh-today'];
    function sheet(id) { SHEETS.forEach(function (s) { $('#' + s).hidden = s !== id; }); }
    var bloomT = [];
    function bloomStop() { bloomT.forEach(clearTimeout); bloomT = []; if (ringEl.classList.contains('is-bloom')) { ringEl.classList.remove('is-bloom', 'is-buds'); els.forEach(function (c) { c.el.classList.remove('is-open'); }); } }
    function bloomIntro() {
      if (SP.bloom === false || still || !els.some(function (c) { return c.v !== 'card'; })) return;
      ringEl.classList.add('is-buds', 'is-bloom');
      var order = els.slice().sort(function () { return Math.random() - .5; }), k;
      for (k = 0; k < order.length; k++) (function (c, d) { bloomT.push(setTimeout(function () { c.el.classList.add('is-open'); }, d)); })(order[k], 1800 + k * 520);
      bloomT.push(setTimeout(function () { ringEl.classList.remove('is-buds', 'is-bloom'); els.forEach(function (c) { c.el.classList.remove('is-open'); }); bloomT = []; }, 1800 + order.length * 520 + 1600));
    }
    function setMode(m) {
      if (m !== 'idle') bloomStop();
      mode = m; if (m !== 'idle' && ghint) hideGardenHint();
      if (!ringEl.classList.contains('is-bloom')) ringEl.classList.toggle('is-buds', m === 'random' || m === 'spin');
      ringEl.classList.toggle('is-pick', m === 'choose');
      els.forEach(function (c) { c.el.tabIndex = m === 'choose' ? 0 : -1; });
      speedTarget = spd() * (m === 'choose' ? .5 : 1);
      if (m === 'idle') { if (todayShow()) return; sheet('sh-mode'); }
      else if (m === 'random') { sheet('sh-random'); $('#randomText').textContent = T('randomHint'); }
      else if (m === 'choose') sheet('sh-choose');
      else if (m === 'own') { sheet('sh-own'); setTimeout(function () { $('#ownName').focus(); }, 50); }
      capShow();
    }
    // дар сегодня уже был (её решение 29.10: не проходить все дары за один день) — вместо выбора цветка приглашение вернуться завтра
    function todayFl() { var M = giftToday(); return M ? { M: M, fl: FL.filter(function (f) { return f.id === M.fl; })[0] } : null; }
    function todayShow() {
      var t = todayFl(); if (!t || !t.fl || !giftsOf(t.fl)[t.M.gi]) return false;
      $('#todayText').textContent = fill(gForm(T('giftToday', 'Возвращайся завтра — за новым даром.'), t.fl.g), { nom_cap: t.fl.nom_cap, nom: t.fl.nom, gen: str(t.fl.gen, t.fl.nom) });
      sheet('sh-today'); capShow(); return true;
    }
    function capShow() {
      var c = merged && merged.own ? merged.own : T('caption', 'Ты Здесь');
      cap.textContent = c; cap.classList.toggle('uz-word', !!(merged && merged.own));
      cap.style.opacity = (mode === 'idle' || mode === 'random' || mode === 'done' || mode === 'q') ? 1 : 0;
    }
    $('#uz-tap').addEventListener('click', function () {
      pulse();
      if (mode === 'random' && !spin && !coast && !snap) startRandom();
      else if (mode !== 'spin' && !fly) liven();
    });
    function startRandom() {
      setMode('spin'); sheet('sh-wait'); $('#waitText').textContent = T('waitSpin', 'Хоровод замедляется…');
      var free = els.filter(function (c) { return !c.gone; }), c = free[Math.floor(Math.random() * free.length)];
      var want = -c.i * STEP, cur = base, turn = Math.PI * 2, tgt = want + Math.ceil((cur + turn * 1.4 - want) / turn) * turn;
      spin = { t0: performance.now(), T: still ? 2600 : 5600, b0: cur, v0: Math.max(speed, .25), D: tgt - cur, done: function () { openBud(c); } };
    }
    function openBud(c) {
      speed = 0; focus = c; c.el.classList.add('is-open'); setMode('spin'); sheet('sh-wait'); $('#waitText').textContent = T('waitOpen', 'Бутон раскрывается…');
      setTimeout(function () { startFly(c, 'random'); }, 1700);
    }
    function pickEl(c) { if (fly || c.gone) return; focus = c; setMode('flying'); sheet('sh-wait'); $('#waitText').textContent = ''; startFly(c, 'choose'); }

    /* ---------- хоровод пальцем: туда-сюда, по инерции докатывается и встаёт цветком впереди ---------- */
    function canDrag() { return !fly && !spin && mode !== 'flying' && mode !== 'own' && mode !== 'name'; }
    // где хоровод встаёт: перед светом — просвет между двумя цветами (её просьба 22.10: шарик видно), «Наугад» — цветком вперёд
    function rest(b, d) { var o = mode === 'random' ? 0 : STEP / 2; return (Math.round((b - o) / STEP + (d || 0)) * STEP) + o; }
    function snapTo(b, spun) {
      snap = { from: base, to: b, t0: performance.now(), T: 520, done: function () {
        if (mode === 'random' && spun) { var c = els[frontIdx()]; if (c && !c.gone) { randomSpin = false; openBud(c); } }
      } };
    }
    // бабочку трогают коротким касанием — хоровод при этом не крутится
    var bTap = null;
    function scenePt(e) { var r = scene.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    scene.addEventListener('pointerdown', function (e) {
      if (e.button > 0 || e.target.closest('#uz-tap')) return;
      var pt = scenePt(e), hb = SP.moths === false ? null : bfHit(pt.x, pt.y);
      if (hb) {
        bTap = { id: e.pointerId, b: hb, x: pt.x, y: pt.y, grab: false };
        bTap.tm = setTimeout(function () { if (bTap && bTap.b === hb && !bTap.grab) { bTap.grab = true; bfGrab(hb, bTap.lx || pt.x, bTap.ly || pt.y); } }, 280);
        try { scene.setPointerCapture(e.pointerId); } catch (x) {}
        return;
      }
      if (!canDrag()) return;
      var t = e.target.closest && e.target.closest('.uz-el');
      drag = { id: e.pointerId, x0: e.clientX, b0: base, lx: e.clientX, lt: performance.now(), v: 0, moved: false, el: t };
      spin = null; coast = null; snap = null;
      try { scene.setPointerCapture(e.pointerId); } catch (x) {}
    });
    scene.addEventListener('pointermove', function (e) {
      if (bTap && e.pointerId === bTap.id) {
        var q = scenePt(e); bTap.lx = q.x; bTap.ly = q.y;
        if (!bTap.grab && Math.abs(q.x - bTap.x) + Math.abs(q.y - bTap.y) > 10) { bTap.grab = true; bfGrab(bTap.b, q.x, q.y); }
        if (bTap.grab) {
          var hb = bTap.b; hb.hx = q.x; hb.hy = q.y - (phone ? 34 : 18);
          var pc = bfPerchAt(hb.hx, hb.hy);
          if (pc !== bfPerch) { if (bfPerch) bfPerch.el.classList.remove('is-perch'); bfPerch = pc; if (pc) pc.el.classList.add('is-perch'); }
        }
        return;
      }
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x0;
      if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; touched = true; hint(''); }
      if (!drag.moved) return;
      var k = 1 / (R * 1.05), tn = performance.now(), dt = (tn - drag.lt) / 1000;
      base = drag.b0 + dx * k;
      if (dt > 0) { var inst = (e.clientX - drag.lx) * k / dt; drag.v = drag.v * .5 + inst * .5; }
      drag.lx = e.clientX; drag.lt = tn;
    });
    // имя цветка — только когда его коснулись (её решение 29.10: поляна — картина, а не подписанный гербарий)
    function sayName(n) { n.classList.add('is-say'); clearTimeout(n._say); n._say = setTimeout(function () { n.classList.remove('is-say'); }, 2600); }
    function dragEnd(e) {
      if (bTap && e.pointerId === bTap.id) {
        var bt = bTap, pt = scenePt(e); bTap = null; clearTimeout(bt.tm);
        if (bfPerch) { bfPerch.el.classList.remove('is-perch'); bfPerch = null; }
        if (bt.grab) { bfDrop(bt.b); return; }
        if (e.type === 'pointerup') { bfTap(bt.b, pt.x, pt.y); bfHintOnce(); }
        return;
      }
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag; drag = null;
      if (!d.moved) {
        if (d.el && mode === 'choose') { var c = els.filter(function (x) { return x.el === d.el; })[0]; if (c) pickEl(c); }
        else if (!d.el || mode !== 'choose') { if (d.el && mode === 'idle') sayName(d.el); if (!coast && !snap) snapTo(rest(base)); }
        return;
      }
      var v = performance.now() - d.lt > 90 ? 0 : d.v;
      v = Math.max(-14, Math.min(14, v));
      if (mode === 'random') {
        if (Math.abs(v) < 2.2) { snapTo(rest(base)); hint(T('spinMore', 'Раскрути посильнее — или коснись света.')); return; }
        coast = { v: v, fr: 1.2 + Math.random() * .7, spun: true }; randomSpin = true; sheet('sh-wait'); $('#waitText').textContent = T('waitSpin', 'Хоровод замедляется…');
        return;
      }
      if (Math.abs(v) < .5) snapTo(rest(base)); else coast = { v: v, fr: 2.6 };
    }
    scene.addEventListener('pointerup', dragEnd);
    scene.addEventListener('pointercancel', dragEnd);
    function hint(s) { if (mode === 'random') { var p = $('#randomText'); p.textContent = s || T('randomHint'); } }
    ringEl.addEventListener('pointerover', function (e) { if (e.pointerType === 'mouse' && e.target.closest('.uz-el')) hoverStop = true; });
    ringEl.addEventListener('pointerout', function (e) { if (e.pointerType === 'mouse') hoverStop = false; });
    document.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && canDrag() && (mode === 'idle' || mode === 'choose' || mode === 'random' || mode === 'done' || mode === 'q')) {
        e.preventDefault(); touched = true; coast = null;
        snapTo(rest(snap ? snap.to : base, e.key === 'ArrowRight' ? 1 : -1));
      } else if (e.key === 'Enter' && mode === 'choose' && document.activeElement === document.body) { var c = els[frontIdx()]; if (c) pickEl(c); }
    });
    els.forEach(function (c) { c.el.addEventListener('keydown', function (e) { if (mode === 'choose' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pickEl(c); } }); });

    /* ---------- выбранный выходит вперёд крупно, стоит, уходит в свет — и свет раскрывается этим цветком ---------- */
    var FLY_IN = 1.3, FLY_HOLD = 1.4, FLY_OUT = .9;
    function startFly(c, how) {
      var zoom = geo();
      c.from = { x: c.x, y: c.v === 'card' ? c.y : c.y - c.h * c.f * zoom / 2, s: c.f * zoom };
      c.flying = true; sizeEl(c); c.t0 = performance.now(); c.how = how; fly = c; focus = c; c.el.classList.add('is-big');
      setTimeout(function () { flareAt = performance.now(); me.classList.add('is-inhale'); }, (FLY_IN + FLY_HOLD) * 1000);
      setTimeout(function () { mergeDone(c); }, (FLY_IN + FLY_HOLD + FLY_OUT) * 1000);
    }
    function bigScale(c) { return Math.min(W * .5 / c.w, (H * .40) / c.h, 3.2); }
    function flyPos(c, ts) {
      var u = (ts - c.t0) / 1000, e, x, y, s, op = 1, S = bigScale(c), hy = Math.max(c.h * S / 2 + 70, py - c.h * S * .08);
      if (u < FLY_IN) { e = ease(u / FLY_IN); x = c.from.x + (px - c.from.x) * e; y = c.from.y + (hy - c.from.y) * e; s = c.from.s + (S - c.from.s) * e; }
      else if (u < FLY_IN + FLY_HOLD) { e = 1; x = px; y = hy + Math.sin((u - FLY_IN) * 2) * 2; s = S; }
      else { var v = Math.min(1, (u - FLY_IN - FLY_HOLD) / FLY_OUT), k = ease(v); e = 1; x = px; y = hy + (py - hy) * k; s = S * (1 - k * .94); op = 1 - v * v; }
      return { x: x, y: y, s: s, op: op, e: e };
    }
    function ease(u) { return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
    function heartArt(c) {
      if (!c || c.own) return artSvg(null, true);
      var v = c.v; if (v === 'live' && c.fl.image) return '<img src="' + esc(imgUrl(c.fl.image)) + '" alt="">';
      return artSvg(c.fl, v === 'line');
    }
    function mergeDone(c) {
      c.flying = false; c.gone = true; c.el.classList.remove('is-big'); c.el.style.opacity = 0; c.el.style.visibility = 'hidden'; fly = null; focus = null;
      merged = c; born = performance.now();
      heart.innerHTML = '<div class="uz-heart-glow"></div><div class="uz-heart-art' + (c.own || c.v === 'line' ? ' uz-v-line' : '') + '">' + heartArt(c) + '</div><div class="uz-heart-core"></div>';
      me.classList.remove('is-inhale', 'is-calm'); void heart.offsetWidth; me.classList.add('is-flower');
      ringEl.classList.remove('is-buds'); els.forEach(function (x) { x.el.classList.remove('is-open'); });
      A.flower = c.own ? { own: true, text: c.own } : { fl: c.fl };
      A.pick = c.how;
      setMode('done');
      var rs = buildResult(A), a = IT.answers || {}, fl = c.fl;
      $('#rvTitle').textContent = rs.title;
      $('#rvText').textContent = fl ? fl.text || '' : fill((a.own_flower || {}).text || '', { text: c.own });
      $('#rvReveal').textContent = rs.reveal;
      $('#b-tochoose').hidden = c.how !== 'random';
      sheet('sh-reveal');
      speedTarget = spd() * .6;
      lastPick = c;
    }
    function reset(toMode) {
      if (lastPick) {
        if (lastPick.own) { lastPick.el.remove(); els.splice(els.indexOf(lastPick), 1); }
        else { lastPick.gone = false; lastPick.el.style.visibility = ''; sizeEl(lastPick); }
      }
      els.forEach(function (c) { c.el.classList.remove('is-open', 'is-big'); });
      lastPick = null; merged = null; focus = null; touched = false; randomSpin = false;
      me.classList.remove('is-flower', 'is-calm', 'is-inhale'); heart.innerHTML = '';
      A = { flower: null, place: null, care: null, lamps: {}, says: null, reflect: '' };
      liftTo = 0; Q.i = 0;
      setMode(toMode || 'idle');
    }
    Array.prototype.forEach.call(root.querySelectorAll('[data-pick]'), function (b) {
      b.addEventListener('click', function () { var id = b.getAttribute('data-pick'); setMode(id === 'random' ? 'random' : 'choose'); });
    });
    $('#b-more').addEventListener('click', function () { var m = $('#uz-more'); m.hidden = !m.hidden; this.setAttribute('aria-expanded', String(!m.hidden)); this.hidden = !m.hidden; });
    $('#b-own').addEventListener('click', function () { setMode('own'); });
    var skipB = $('#b-skipfl'); if (skipB) skipB.addEventListener('click', function () { A.flower = null; A.pick = 'skip'; startQuestions(); });
    Array.prototype.forEach.call(root.querySelectorAll('[data-back]'), function (b) { b.addEventListener('click', function () { setMode('idle'); }); });
    Array.prototype.forEach.call(root.querySelectorAll('[data-again]'), function (b) { b.addEventListener('click', function () { reset('idle'); }); });
    $('#b-tochoose').addEventListener('click', function () { reset('choose'); });
    $('#b-toq').addEventListener('click', function () { startQuestions(); });
    $('#b-today').addEventListener('click', function () {
      var t = todayFl(); if (!t || !t.fl) return;
      A = { flower: { fl: t.fl }, gift: t.M.gi, place: null, care: null, lamps: {}, says: null, reflect: '' }; A.pick = 'today';
      showResult(true);
    });
    $('#sh-own').addEventListener('submit', function (e) {
      e.preventDefault(); var v = $('#ownName').value.trim(); if (!v) { $('#ownName').focus(); return; }
      $('#ownName').blur();
      var c = makeEl(null, v); c.i = 0; sizeEl(c); els.push(c);
      c.x = px; c.y = Math.min(H - c.h, cy + R * sinT * 1.6); c.f = .5;
      setMode('flying'); sheet('sh-wait'); $('#waitText').textContent = '';
      c.from = { x: c.x, y: c.y, s: .5 }; c.flying = true; sizeEl(c); c.t0 = performance.now(); c.how = 'own'; fly = c; focus = c; c.el.classList.add('is-big');
      setTimeout(function () { flareAt = performance.now(); me.classList.add('is-inhale'); }, (FLY_IN + FLY_HOLD) * 1000);
      setTimeout(function () { mergeDone(c); $('#ownName').value = ''; }, (FLY_IN + FLY_HOLD + FLY_OUT) * 1000);
    });
    // имя у света — по желанию, вписывает сам
    function nameBtnText() { $('#b-name').textContent = myName ? T('nameEdit', 'Изменить имя у света') : T('nameBtn', 'Подписать свет своим именем'); }
    nameBtnText();
    $('#b-name').addEventListener('click', function () { mode = 'name'; sheet('sh-name'); $('#nameIn').value = myName; setTimeout(function () { $('#nameIn').focus(); }, 50); });
    $('#sh-name').addEventListener('submit', function (e) {
      e.preventDefault(); myName = $('#nameIn').value.trim(); nameEl.textContent = myName; nameEl.hidden = !myName; nameBtnText(); $('#nameIn').blur(); setMode('idle');
    });
    // подсказка «погуляй по саду» — один раз, мягко появляется и уходит
    var ghint = $('#uz-ghint'), ghintT = 0;
    function hideGardenHint() { clearTimeout(ghintT); ghint.classList.remove('is-on'); }
    (function () {
      var txt = T('gardenHint', 'Погуляй по саду — здесь можно дышать и касаться.');
      if (txt === '-' || SP.moths === false || OKNO) return;
      ghint.textContent = txt;
      setTimeout(function () { if (mode !== 'idle') return; ghint.classList.add('is-on'); ghintT = setTimeout(hideGardenHint, 8000); }, 2600);
    })();
    // после первого касания бабочки — один раз подсказка, что её можно взять и пересадить
    var bfHinted = false;
    function bfHintOnce() {
      var txt = T('bflyHint', 'Бабочку можно взять и пересадить на цветок — нажми и держи.');
      if (bfHinted || bfGrabbed || txt === '-') return; bfHinted = true;
      setTimeout(function () { if (bfGrabbed) return; ghint.textContent = txt; ghint.classList.add('is-on'); clearTimeout(ghintT); ghintT = setTimeout(hideGardenHint, 6000); }, 900);
    }
    function setStill(v) { still = v; $('#uz-still').textContent = v ? T('move', 'Включить движение') : T('still', 'Остановить движение'); }
    $('#uz-still').addEventListener('click', function () { setStill(!still); });

    /* ---------- вопросы: по одному, поверх сада ---------- */
    var Q = { pages: [], i: 0 };
    (IT.steps || []).forEach(function (s) {
      if (!s || /^(enter|pick_mode|flower|result|viewpoint)$/.test(s.id)) return;
      if (s.type === 'matrix') (s.rows || []).forEach(function (r) { Q.pages.push({ s: s, row: r }); });
      else if (s.type === 'choice' || s.type === 'choice_or_text' || s.type === 'text') Q.pages.push({ s: s });
    });
    var QSTEPS = []; Q.pages.forEach(function (p) { if (QSTEPS.indexOf(p.s) < 0) QSTEPS.push(p.s); });
    function startQuestions() {
      mode = 'q'; capShow(); liftTo = 1; Q.i = 0; ringEl.classList.remove('is-buds', 'is-pick');
      if (!Q.pages.length) { showResult(); return; }
      drawQ();
    }
    function stepsHTML(p) {
      var h = '<div class="uz-steps" aria-hidden="true">', k = QSTEPS.indexOf(p.s);
      QSTEPS.forEach(function (s, j) {
        if (s.type === 'matrix') {
          h += '<b></b>';
          (s.rows || []).forEach(function (r) { var v = (A.lamps || {})[r.id]; h += '<i class="' + (p.row === r ? 'is-now' : v ? 'is-done' : '') + '"></i>'; });
          h += '<b></b>';
        } else h += '<i class="' + (j === k ? 'is-now' : answered(s) ? 'is-done' : '') + '"></i>';
      });
      return h + '</div>';
    }
    function answered(s) { return s.id === 'reflect' || s.type === 'text' ? !!str(A[s.id]) : A[s.id] != null; }
    function navHTML(p, nextBtn) {
      return '<div class="uz-row uz-row--between"><button class="uz-link uz-link--dim" type="button" data-q="back">' + esc(T('back', '← Назад')) + '</button>' +
        (nextBtn || '') + (p.s.skippable === false ? '' : '<button class="uz-link uz-link--dim" type="button" data-q="skip">' + esc(p.row ? T('dontKnow', 'Не знаю') : T('skip', 'Пропустить')) + '</button>') + '</div>';
    }
    function lampIcon(id) {
      var S = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">', i, h = '', a;
      if (id === 'light') { h = '<circle cx="32" cy="32" r="9"/>'; for (i = 0; i < 8; i++) { a = i * Math.PI / 4; h += '<line x1="' + (32 + Math.cos(a) * 15).toFixed(1) + '" y1="' + (32 + Math.sin(a) * 15).toFixed(1) + '" x2="' + (32 + Math.cos(a) * 21).toFixed(1) + '" y2="' + (32 + Math.sin(a) * 21).toFixed(1) + '"/>'; }
        h += '<g class="uz-more">'; for (i = 0; i < 8; i++) { a = (i + .5) * Math.PI / 4; h += '<line x1="' + (32 + Math.cos(a) * 19).toFixed(1) + '" y1="' + (32 + Math.sin(a) * 19).toFixed(1) + '" x2="' + (32 + Math.cos(a) * 29).toFixed(1) + '" y2="' + (32 + Math.sin(a) * 29).toFixed(1) + '"/>'; } h += '</g>'; }
      else if (id === 'water') h = '<path d="M32 10 C25 22 19 30 19 39 a13 13 0 0 0 26 0 C45 30 39 22 32 10Z"/><path d="M26 40 a6 6 0 0 0 6 6"/><g class="uz-more"><path d="M12 22 C9 27 8 29 8 31 a4 4 0 0 0 8 0 C16 29 15 27 12 22Z"/><path d="M52 18 C49 23 48 25 48 27 a4 4 0 0 0 8 0 C56 25 55 23 52 18Z"/></g>';
      else if (id === 'soil') h = '<line x1="10" y1="36" x2="54" y2="36"/><path d="M32 36 V20"/><path d="M32 24 C26 22 23 17 24 12 C29 13 32 17 32 22"/><path d="M32 26 C38 24 41 19 40 14 C35 15 32 19 32 24"/><path d="M32 36 C30 42 26 45 22 47"/><path d="M32 36 C34 42 38 45 42 47"/><g class="uz-more"><path d="M32 36 V54"/><path d="M28 46 C24 50 20 52 16 56"/><path d="M36 46 C40 50 44 52 48 56"/></g>';
      else if (id === 'warmth') h = '<path d="M12 34 C12 46 20 52 32 52 C44 52 52 46 52 34"/><path d="M12 34 C14 31 17 31 19 34"/><path d="M45 34 C47 31 50 31 52 34"/><path d="M32 18 C27 25 27 31 32 37 C37 31 37 25 32 18Z"/><g class="uz-more"><path d="M6 30 C4 48 16 60 32 60 C48 60 60 48 58 30"/></g>';
      else if (id === 'space') h = '<circle cx="32" cy="32" r="5"/><circle cx="32" cy="32" r="15" stroke-dasharray="3 5"/><g class="uz-more"><circle cx="32" cy="32" r="26" stroke-dasharray="2 6"/></g>';
      else h = '<circle cx="32" cy="32" r="10"/><g class="uz-more"><circle cx="32" cy="32" r="22"/></g>';
      return S + h + '</svg>';
    }
    var LAMP = ['few', 'enough', 'many'], LOOK = { few: [.72, .38, 0], enough: [1, .9, 0], many: [1.18, 1, 1] };
    function drawQ() {
      var p = Q.pages[Q.i], s = p.s, box = $('#sh-q'), h = stepsHTML(p);
      sheet('sh-q');
      if (p.row) {
        var v = (A.lamps || {})[p.row.id], val = LAMP.indexOf(v), fresh = val < 0;
        h += '<p class="uz-q">' + esc(str(p.row.ask, s.text + ' · ' + p.row.label)) + '</p>' +
          '<div class="uz-lamp"><div class="uz-lamp-ic" id="lampIc">' + lampIcon(p.row.id) + '</div>' +
          '<div class="uz-slider' + (fresh ? ' is-fresh' : '') + '" id="lampSl"><div class="uz-ticks"><i></i><i></i><i></i></div>' +
          '<input type="range" min="0" max="2" step="1" value="' + (fresh ? 1 : val) + '" aria-label="' + esc(p.row.label) + '">' +
          '<div class="uz-ends"><span>' + esc(optLabel(s, 'few')) + '</span><span>' + esc(optLabel(s, 'many')) + '</span></div></div>' +
          '<div class="uz-word-now" id="lampWord" aria-live="polite"></div></div>' +
          navHTML(p, '<button class="uz-btn uz-btn--small" type="button" data-q="next"' + (fresh ? ' disabled' : '') + '>' + esc(T('next', 'Дальше')) + '</button>');
        box.innerHTML = h;
        var inp = box.querySelector('input'), sl = $('#lampSl'), ic = $('#lampIc'), wd = $('#lampWord'), nb = box.querySelector('[data-q="next"]');
        var look = function (id) { var L = LOOK[id] || [.9, .55, 0]; ic.style.setProperty('--k', L[0]); ic.style.setProperty('--o', L[1]); ic.style.setProperty('--m', L[2]); wd.textContent = id ? optLabel(s, id) : ''; };
        var setV = function () { var id = LAMP[+inp.value]; A.lamps[p.row.id] = id; sl.classList.remove('is-fresh'); nb.disabled = false; look(id); };
        look(fresh ? '' : v);
        inp.addEventListener('input', setV); inp.addEventListener('change', setV);
        inp.addEventListener('pointerup', function () { if (sl.classList.contains('is-fresh')) setV(); });
        inp.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && sl.classList.contains('is-fresh')) { e.preventDefault(); setV(); } });
      } else if (s.type === 'text') {
        var max = +s.max_chars || 1000;
        h += '<label class="uz-q" for="qText">' + esc(s.text) + '</label><textarea class="uz-area" id="qText" maxlength="' + max + '" placeholder="' + esc(T('reflectPh')) + '">' + esc(A[s.id] || '') + '</textarea>' +
          '<p class="uz-count" id="qCount"></p>' + navHTML(p, '<button class="uz-btn uz-btn--small" type="button" data-q="next">' + esc(T('next', 'Дальше')) + '</button>');
        box.innerHTML = h;
        var ta = $('#qText'), cnt = $('#qCount'), upd = function () { A[s.id] = ta.value; cnt.textContent = ta.value.length > max * .8 ? ta.value.length + ' / ' + max : ''; };
        ta.addEventListener('input', upd); upd();
      } else {
        var cur = A[s.id], curId = cur && typeof cur === 'object' ? cur.id : cur;
        h += '<p class="uz-q">' + esc(s.text) + '</p><div class="uz-opts">' + (s.options || []).map(function (o) {
          return '<button class="uz-opt' + (curId === o.id ? ' is-on' : '') + '" type="button" data-opt="' + esc(o.id) + '">' + esc(gForm(o.label, merged && merged.fl ? merged.fl.g : 'm')) + '</button>';
        }).join('') + '</div>';
        var ownO = (s.options || []).filter(function (o) { return o.allow_text; })[0];
        if (ownO) h += '<div class="uz-field" id="qOwn"' + (curId === ownO.id ? '' : ' hidden') + '><input id="qOwnIn" maxlength="' + (+ownO.max_chars || 80) + '" autocomplete="off" placeholder="' + esc(T('ownPhSays')) + '" value="' + esc(cur && cur.text || '') + '">' +
          '<button class="uz-btn" type="button" data-q="ownok">' + esc(T('done', 'Готово')) + '</button></div>';
        h += navHTML(p, '');
        box.innerHTML = h;
        Array.prototype.forEach.call(box.querySelectorAll('[data-opt]'), function (b) {
          b.addEventListener('click', function () {
            var id = b.getAttribute('data-opt');
            Array.prototype.forEach.call(box.querySelectorAll('[data-opt]'), function (x) { x.classList.toggle('is-on', x === b); });
            if (ownO && id === ownO.id) { $('#qOwn').hidden = false; setTimeout(function () { $('#qOwnIn').focus(); }, 30); return; }
            if (ownO) $('#qOwn').hidden = true;
            A[s.id] = s.type === 'choice_or_text' ? { id: id } : id;
            setTimeout(qNext, 380);
          });
        });
        if (ownO) {
          var okOwn = function () { var tx = $('#qOwnIn').value.trim(); if (!tx) { $('#qOwnIn').focus(); return; } A[s.id] = { id: ownO.id, text: tx }; qNext(); };
          box.querySelector('[data-q="ownok"]').addEventListener('click', okOwn);
          $('#qOwnIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); okOwn(); } });
        }
      }
      box.querySelector('[data-q="back"]').addEventListener('click', qBack);
      var sk = box.querySelector('[data-q="skip"]');
      if (sk) sk.addEventListener('click', function () { if (p.row) A.lamps[p.row.id] = 'unknown'; else A[s.id] = s.type === 'text' ? '' : null; qNext(); });
      var nx = box.querySelector('[data-q="next"]'); if (nx) nx.addEventListener('click', qNext);
    }
    function qNext() { if (Q.i < Q.pages.length - 1) { Q.i++; drawQ(); } else showResult(); }
    function qBack() {
      if (Q.i > 0) { Q.i--; drawQ(); return; }
      liftTo = 0;
      if (merged) { mode = 'done'; capShow(); sheet('sh-reveal'); } else setMode('idle');
    }

    /* ---------- итог ---------- */
    var RES = null;
    function darArt(fl, own) {
      if (!own && fl && fl.image && (fl.view || SP.view || 'live') === 'live') return '<img src="' + esc(imgUrl(fl.image)) + '" alt="">';
      return '<div class="uz-v-line">' + artSvg(own ? null : fl, true) + '</div>';
    }
    // стеклянная карта цветка: имя · дух, «Прими от меня в дар», дар, прощальное слово; под ней — абзац дара, строчки цветка, приглашение вернуться
    function darHTML(R, A) {
      var d = R.dar; if (!d) return '';
      var fl = A.flower && !A.flower.own ? A.flower.fl : null;
      return '<div class="uz-dar"><div class="uz-dar-glass"></div><div class="uz-dar-art">' + darArt(fl, !fl) + '</div>' +
          '<p class="uz-dar-name">' + esc(d.name) + (d.spirit ? '<span>' + esc(d.spirit) + '</span>' : '') + '</p>' +
          (d.t ? '<p class="uz-dar-lead">' + esc(d.lead) + '</p><p class="uz-dar-gift">' + esc(d.t) + '</p>' : '') +
          (d.own ? '<p class="uz-dar-own">' + esc(d.own) + '</p>' : '') +
          (d.bye ? '<p class="uz-dar-bye">' + esc(d.bye) + '</p>' : '') + '</div>' +
        (d.p ? '<p class="uz-p">' + esc(d.p) + '</p>' : '') +
        d.lines.map(function (l) { return '<p class="uz-p">' + esc(l) + '</p>'; }).join('') +
        (d.more ? '<p class="uz-p is-dim uz-dar-more">' + esc(d.more) + '</p>' : '');
    }
    function showResult(only) {
      if (A.flower && !A.flower.own && A.gift == null) A.gift = drawGift(A.flower.fl);
      RES = buildResult(A); mode = 'done'; capShow(); liftTo = 1;
      if (only) { RES.lines = []; RES.reveal = ''; RES.support = ''; RES.closing = ''; RES.reflection = ''; RES.ack = ''; }
      // под картой дара — только абзац дара, без пересказа ответов (её решение 29.10: «портянку невозможно читать»); вернуть — reveal.recap
      else if (RES.dar && (IT.reveal || {}).recap !== true) { RES.answers = RES.lines; RES.lines = []; RES.reveal = ''; RES.support = ''; }
      var hp = IT.help || {}, box = $('#sh-res');
      var h = (RES.dar ? darHTML(RES, A) : '<p class="uz-title">' + esc(RES.title) + '</p>') + '<div class="uz-res-lines">' + RES.lines.map(function (l) { return '<p class="uz-p">' + esc(l) + '</p>'; }).join('') + '</div>' +
        (RES.reveal ? '<p class="uz-p is-dim">' + esc(RES.reveal) + '</p>' : '') +
        (RES.support ? '<p class="uz-p">' + esc(RES.support) + '</p>' : '') +
        (RES.ack ? '<p class="uz-p is-dim">' + esc(RES.ack) + '</p>' : '') +
        (RES.closing ? '<div class="uz-res-q"><p class="uz-note">' + esc(T('closingLabel', 'Вопрос с собой')) + '</p><p class="uz-p">' + esc(RES.closing) + '</p></div>' : '') +
        '<p class="uz-note">' + esc(T('save', 'Сохранить себе')) + '</p><div class="uz-row">' +
          '<button class="uz-btn" type="button" data-r="img">' + esc(T('saveImg', 'Картинкой')) + '</button>' +
          '<button class="uz-btn uz-btn--ghost" type="button" data-r="copy">' + esc(T('copy', 'Скопировать текст')) + '</button></div>' +
        (T('writeInvite') ? '<p class="uz-p">' + esc(T('writeInvite')) + '</p>' : '') +
        '<div class="uz-row"><button class="uz-btn" type="button" data-r="write">' + esc(T('write', 'Написать проводнику')) + '</button></div>' +
        '<p class="uz-note uz-status" id="resStatus" aria-live="polite"></p>' +
        '<div class="uz-row uz-row--between">' + (only ? '<button class="uz-link uz-link--dim" type="button" data-again>' + esc(T('back', '← Назад')) + '</button>' : '<button class="uz-link uz-link--dim" type="button" data-r="back">' + esc(T('back', '← Назад')) + '</button>' +
          '<button class="uz-link uz-link--dim" type="button" data-again>' + esc(T('again', 'Начать сначала')) + '</button>') + '</div>';
      if (hp.show !== false && ((hp.contacts || []).length || str(hp.text))) {
        h += '<div class="uz-help">' + (str(hp.title) ? '<h3>' + esc(hp.title) + '</h3>' : '') + (str(hp.text) ? '<p class="uz-p is-dim">' + esc(hp.text) + '</p>' : '') +
          '<ul>' + (hp.contacts || []).filter(function (c) { return c && str(c.phone); }).map(function (c) {
            return '<li><a href="tel:' + esc(String(c.phone).replace(/[^\d+]/g, '')) + '">' + esc(c.phone) + '</a> — ' + esc(c.label) + (str(c.note) ? ' <span>(' + esc(c.note) + ')</span>' : '') + '</li>';
          }).join('') + '</ul>' + (str(hp.abroad_line) ? '<p class="uz-note">' + esc(hp.abroad_line) + '</p>' : '') + '</div>';
      }
      if (str(RES.footer)) h += '<p class="uz-note">' + esc(RES.footer) + '</p>';
      box.innerHTML = h; sheet('sh-res'); box.scrollTop = 0;
      var stt = $('#resStatus');
      box.querySelector('[data-r="copy"]').addEventListener('click', function () { stt.textContent = copyText(selfText()) ? T('copied', 'Скопировано.') : ''; });
      box.querySelector('[data-r="write"]').addEventListener('click', function () {
        var ok = copyText(guideText()), url = guideUrl();
        if (url) window.open(url, '_blank', 'noopener');
        stt.textContent = ok ? T('writeDone', 'Итог скопирован — вставь его в чат.') : '';
      });
      box.querySelector('[data-r="img"]').addEventListener('click', function () { stt.textContent = '…'; saveImage(function () { stt.textContent = ''; }); });
      var bb = box.querySelector('[data-r="back"]'); if (bb) bb.addEventListener('click', function () { if (Q.pages.length) { Q.i = Q.pages.length - 1; mode = 'q'; capShow(); drawQ(); } else qBack(); });
      box.querySelector('[data-again]').addEventListener('click', function () { reset('idle'); });
    }
    function darLines() {
      var d = RES.dar; if (!d || !d.t) return [];
      return [d.name + (d.spirit ? ' · ' + d.spirit : ''), d.lead + ': ' + d.t + '.', d.bye, d.p].concat(d.lines).filter(function (x) { return str(x); }).concat(['']);
    }
    function pickWord() { return A.pick === 'random' ? 'наугад' : A.pick === 'choose' ? 'по картинке' : A.pick === 'own' ? 'свой цветок' : A.pick === 'today' ? 'сегодня раньше' : 'не выбран'; }
    function selfText() {
      var out = [str((SET || {}).siteTitle, '13 MIRRORS') + ' · ' + T('eyebrow', 'Узоры') + ' · ' + IT.title, '', RES.title, ''].concat(darLines(), RES.lines);
      if (RES.reveal) out.push('', RES.reveal);
      if (RES.support) out.push('', RES.support);
      if (RES.closing) out.push('', T('closingLabel', 'Вопрос с собой') + ':', RES.closing);
      if (RES.reflection) out.push('', T('wordsLabel', 'Мои слова') + ':', RES.reflection);
      if (RES.footer) out.push('', RES.footer);
      var hp = IT.help || {};
      if (hp.show !== false && (hp.contacts || []).length) {
        out.push('', hp.title || '');
        (hp.contacts || []).forEach(function (c) { if (c && str(c.phone)) out.push(c.phone + ' — ' + c.label + (str(c.note) ? ' (' + c.note + ')' : '')); });
      }
      return out.join('\n');
    }
    function guideText() {
      var out = [IT.title + ' · ' + str((SET || {}).siteTitle, '13 MIRRORS')];
      if (myName) out.push('Имя у света: ' + myName);
      out.push('Цветок выбран: ' + pickWord(), '', RES.title, '');
      if (RES.dar && RES.dar.t) out.push('Дар (выпал наугад): ' + RES.dar.t, '');
      out = out.concat(RES.answers || RES.lines);   // проводнику — ответы всегда, даже если на экране их нет
      if (RES.reflection) out.push('', T('wordsLabel', 'Мои слова') + ':', RES.reflection);
      return out.join('\n');
    }
    function guideUrl() {
      var ct = (SET && SET.contacts) || {}, label = str(IT.host), bot = String(ct.host || '').replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '').trim(), tg = String(ct.telegram || '').replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '').trim();
      if (bot && /^[A-Za-z0-9_-]{1,64}$/.test(label)) return 'https://t.me/' + encodeURIComponent(bot) + '?start=' + label;
      return tg ? 'https://t.me/' + encodeURIComponent(tg) : '';
    }
    function copyText(s) {
      try {
        var ta = document.createElement('textarea'); ta.value = s; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, s.length);
        var ok = document.execCommand('copy'); document.body.removeChild(ta); if (ok) return true;
      } catch (e) {}
      if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(s).catch(function () {}); return true; }
      return false;
    }
    /* ---------- «Сохранить себе» картинкой: светящийся цветок, название, итог (как «Сохранить узор» на маршрутах) ---------- */
    function wrap(ctx, text, maxW) {
      var words = String(text).split(/\s+/), lines = [], ln = '';
      words.forEach(function (w) { var t2 = ln ? ln + ' ' + w : w; if (ctx.measureText(t2).width > maxW && ln) { lines.push(ln); ln = w; } else ln = t2; });
      if (ln) lines.push(ln);
      return lines;
    }
    function saveImage(done) {
      var f0 = A.flower && !A.flower.own ? A.flower.fl : null, own0 = !!(A.flower && A.flower.own), v0 = merged ? merged.v : f0 ? viewOf(f0) : 'line';
      var src = f0 && f0.image && v0 === 'live' ? imgUrl(f0.image) : f0 || own0 ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(own0 ? artSvg(null, true) : artSvg(f0, v0 === 'line' || !!RES.dar)) : '';
      var im = new Image(), go = function () { try { if (RES.dar) paintDar(src ? im : null); else paint(src ? im : null); } catch (e) { console.error(e); } done(); };
      var fonts = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('italic 500 64px "Cormorant Garamond"'), document.fonts.load('500 40px "Cormorant Garamond"')]).catch(function () {}) : Promise.resolve();
      fonts.then(function () { if (!src) { go(); return; } im.onload = go; im.onerror = function () { src = ''; go(); }; im.src = src; });
    }
    function rrect(c2, x, y, w, h, r) { c2.beginPath(); c2.moveTo(x + r, y); c2.arcTo(x + w, y, x + w, y + h, r); c2.arcTo(x + w, y + h, x, y + h, r); c2.arcTo(x, y + h, x, y, r); c2.arcTo(x, y, x + w, y, r); c2.closePath(); }
    function shareCanvas(cv) {
      var name = '13mirrors-' + IT.id + '.png';
      cv.toBlob(function (blob) {
        try {
          var f = new File([blob], name, { type: 'image/png' });
          if (window.matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f] }).catch(function () {}); return; }
        } catch (e) {}
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      }, 'image/png');
    }
    // «Сохранить себе» с даром — сама стеклянная карта (её решение 29.10)
    function paintDar(im) {
      var d = RES.dar, Wc = 1080, Hc = 1350, cv = document.createElement('canvas'), c2 = cv.getContext('2d');
      var HEAD = '"Cormorant Garamond", Georgia, serif', UI = '-apple-system, "Segoe UI", Roboto, sans-serif';
      var X = 110, Y = 96, CW = Wc - X * 2, CH = Hc - Y * 2 - 40, pad = 70, mw = CW - pad * 2;
      cv.width = Wc; cv.height = Hc; c2.textBaseline = 'top';
      var sky = c2.createLinearGradient(0, 0, 0, Hc); sky.addColorStop(0, '#0b0f26'); sky.addColorStop(.4, '#231f4a'); sky.addColorStop(.7, '#2a2340'); sky.addColorStop(1, '#121428');
      c2.fillStyle = sky; c2.fillRect(0, 0, Wc, Hc);
      for (var i = 0; i < 160; i++) { c2.globalAlpha = .15 + Math.random() * .4; c2.fillStyle = '#fff'; c2.beginPath(); c2.arc(Math.random() * Wc, Math.random() * Hc, Math.random() * 1.6 + .3, 0, 6.283); c2.fill(); }
      c2.globalAlpha = 1;
      // стекло
      c2.save(); rrect(c2, X, Y, CW, CH, 44); c2.shadowColor = 'rgba(0,0,0,.45)'; c2.shadowBlur = 50; c2.shadowOffsetY = 18;
      var gl = c2.createLinearGradient(X, Y, X + CW, Y + CH); gl.addColorStop(0, 'rgba(255,255,255,.20)'); gl.addColorStop(.46, 'rgba(255,255,255,.06)'); gl.addColorStop(1, 'rgba(170,190,255,.14)');
      c2.fillStyle = gl; c2.fill(); c2.restore();
      c2.save(); rrect(c2, X, Y, CW, CH, 44); c2.clip();
      var sh = c2.createLinearGradient(X, Y, X + CW * .9, Y + CH * .6); sh.addColorStop(.40, 'rgba(255,255,255,0)'); sh.addColorStop(.47, 'rgba(255,255,255,.16)'); sh.addColorStop(.52, 'rgba(255,255,255,.03)'); sh.addColorStop(.58, 'rgba(255,255,255,0)');
      c2.fillStyle = sh; c2.fillRect(X, Y, CW, CH); c2.restore();
      rrect(c2, X, Y, CW, CH, 44); c2.lineWidth = 2; c2.strokeStyle = 'rgba(255,236,206,.55)'; c2.stroke();
      // текст — сначала меряем, чтобы картинка цветка заняла остальное
      var B = [];
      B.push({ f: 'italic 500 64px ' + HEAD, c: '#fff4e2', t: d.name, lh: 68, gap: 4 });
      if (d.spirit) B.push({ f: 'italic 500 38px ' + HEAD, c: 'rgba(255,226,180,.9)', t: d.spirit, lh: 44, gap: 30 }); else B[0].gap = 30;
      if (d.t) B.push({ f: '500 24px ' + UI, c: 'rgba(233,184,114,.95)', t: d.lead.toUpperCase(), lh: 32, gap: 10, sp: true }, { f: 'italic 600 48px ' + HEAD, c: '#fff8ec', t: d.t, lh: 56, gap: 30 });
      if (d.own) B.push({ f: 'italic 500 38px ' + HEAD, c: '#fff4e2', t: d.own, lh: 46, gap: 30 });
      if (d.bye) B.push({ f: 'italic 500 34px ' + HEAD, c: 'rgba(232,230,244,.85)', t: d.bye, lh: 42, gap: 0 });
      var th = 0; B.forEach(function (x) { c2.font = x.f; if (x.sp) c2.letterSpacing = '3px'; x.L = wrap(c2, x.t, mw); if (x.sp) c2.letterSpacing = '0px'; th += x.L.length * x.lh + x.gap; });
      var artH = Math.max(300, Math.min(560, CH - pad * 2 - th - 40)), ay = Y + Math.max(pad - 10, (CH - artH - 40 - th) / 2);   // всё — посередине карты
      var gx = Wc / 2, gy = ay + artH * .5, glow = c2.createRadialGradient(gx, gy, 0, gx, gy, artH * .62);
      glow.addColorStop(0, 'rgba(255,236,200,.42)'); glow.addColorStop(.45, 'rgba(255,214,150,.12)'); glow.addColorStop(1, 'rgba(255,214,150,0)');
      c2.fillStyle = glow; c2.fillRect(X, ay - 30, CW, artH + 60);
      if (im) {
        var ar = (im.naturalWidth || 100) / (im.naturalHeight || 140), hh = artH, ww = hh * ar; if (ww > mw) { ww = mw; hh = ww / ar; }
        c2.save(); c2.shadowColor = 'rgba(255,226,170,.8)'; c2.shadowBlur = 34; c2.drawImage(im, (Wc - ww) / 2, ay + (artH - hh), ww, hh); c2.restore();
      }
      var y = ay + artH + 40;
      B.forEach(function (x) {
        c2.font = x.f; c2.fillStyle = x.c; if (x.sp) c2.letterSpacing = '3px';
        x.L.forEach(function (l) { var lw = c2.measureText(l).width; c2.fillText(l, (Wc - lw) / 2, y); y += x.lh; });
        if (x.sp) c2.letterSpacing = '0px'; y += x.gap;
      });
      c2.font = '600 20px ' + UI; c2.fillStyle = 'rgba(232,230,244,.6)'; c2.letterSpacing = '4px';
      var brand = (str((SET || {}).siteTitle, '13 MIRRORS') + ' · ' + T('eyebrow', 'Узоры') + ' · ' + IT.title).toUpperCase() + (myName ? '   — ' + myName : '');
      var bw = c2.measureText(brand).width; c2.fillText(brand, (Wc - bw) / 2, Hc - 76); c2.letterSpacing = '0px';
      shareCanvas(cv);
    }
    function paint(im) {
      var Wc = 1080, pad = 96, mw = Wc - pad * 2, cv = document.createElement('canvas'), c2 = cv.getContext('2d');
      var HEAD = '"Cormorant Garamond", Georgia, serif', UI = '-apple-system, "Segoe UI", Roboto, sans-serif';
      // сначала меряем, потом рисуем
      function blocks() {
        var b = [];
        b.push({ f: '600 22px ' + UI, c: 'rgba(232,230,244,.7)', t: (str((SET || {}).siteTitle, '13 MIRRORS') + ' · ' + T('eyebrow', 'Узоры') + ' · ' + IT.title).toUpperCase(), lh: 30, gap: 20, sp: true });
        b.push({ art: true, h: 420, gap: 28 });
        b.push({ f: 'italic 500 66px ' + HEAD, c: '#fff4e2', t: RES.title, lh: 72, gap: 26, center: true });
        RES.lines.forEach(function (l) { b.push({ f: '400 30px ' + UI, c: '#e8e6f4', t: l, lh: 44, gap: 14 }); });
        if (RES.reveal) b.push({ f: 'italic 500 36px ' + HEAD, c: 'rgba(255,236,206,.92)', t: RES.reveal, lh: 46, gap: 18, top: 14 });
        if (RES.support) b.push({ f: '400 28px ' + UI, c: 'rgba(232,230,244,.8)', t: RES.support, lh: 40, gap: 14 });
        if (RES.closing) b.push({ f: '600 20px ' + UI, c: 'rgba(233,184,114,.9)', t: T('closingLabel', 'Вопрос с собой').toUpperCase(), lh: 30, gap: 6, top: 16, sp: true }, { f: 'italic 500 38px ' + HEAD, c: '#fff4e2', t: RES.closing, lh: 46, gap: 14 });
        if (RES.reflection) b.push({ f: '600 20px ' + UI, c: 'rgba(233,184,114,.9)', t: T('wordsLabel', 'Мои слова').toUpperCase(), lh: 30, gap: 6, top: 16, sp: true }, { f: '400 28px ' + UI, c: '#e8e6f4', t: RES.reflection, lh: 40, gap: 14 });
        if (myName) b.push({ f: 'italic 500 32px ' + HEAD, c: 'rgba(255,236,206,.85)', t: '— ' + myName, lh: 40, gap: 14, top: 6 });
        return b;
      }
      var B = blocks(), y = pad;
      B.forEach(function (x) { y += x.top || 0; if (x.art) { y += x.h + x.gap; return; } c2.font = x.f; x.L = wrap(c2, x.t, mw); y += x.L.length * x.lh + x.gap; });
      var Hc = Math.max(1350, Math.ceil(y + pad));
      cv.width = Wc; cv.height = Hc;
      var sky = c2.createLinearGradient(0, 0, 0, Hc); sky.addColorStop(0, '#0b0f26'); sky.addColorStop(.35, '#231f4a'); sky.addColorStop(.62, '#2a2340'); sky.addColorStop(1, '#121428');
      c2.fillStyle = sky; c2.fillRect(0, 0, Wc, Hc);
      for (var i = 0; i < 140; i++) { c2.globalAlpha = .2 + Math.random() * .4; c2.fillStyle = '#fff'; c2.beginPath(); c2.arc(Math.random() * Wc, Math.random() * Hc * .5, Math.random() * 1.6 + .3, 0, 6.283); c2.fill(); }
      c2.globalAlpha = 1; y = pad; c2.textBaseline = 'top';
      B.forEach(function (x) {
        y += x.top || 0;
        if (x.art) {
          var gx = Wc / 2, gy = y + x.h * .42, gl = c2.createRadialGradient(gx, gy, 0, gx, gy, x.h * .6);
          gl.addColorStop(0, 'rgba(255,236,200,.55)'); gl.addColorStop(.4, 'rgba(255,214,150,.18)'); gl.addColorStop(1, 'rgba(255,214,150,0)');
          c2.fillStyle = gl; c2.fillRect(0, y - 40, Wc, x.h + 80);
          if (im) {
            var ar = (im.naturalWidth || 100) / (im.naturalHeight || 140), hh = x.h, ww = hh * ar; if (ww > mw) { ww = mw; hh = ww / ar; }
            c2.save(); c2.shadowColor = 'rgba(255,226,170,.85)'; c2.shadowBlur = 36; c2.drawImage(im, (Wc - ww) / 2, y + (x.h - hh), ww, hh); c2.restore();
          } else {
            var cr = c2.createRadialGradient(gx, gy, 0, gx, gy, 40); cr.addColorStop(0, '#fff'); cr.addColorStop(.45, '#ffe9c2'); cr.addColorStop(1, 'rgba(233,184,114,0)');
            c2.fillStyle = cr; c2.beginPath(); c2.arc(gx, gy, 40, 0, 6.283); c2.fill();
          }
          y += x.h + x.gap; return;
        }
        c2.font = x.f; c2.fillStyle = x.c;
        x.L.forEach(function (l) { var lw = c2.measureText(l).width; c2.fillText(l, x.center ? (Wc - lw) / 2 : pad, y); y += x.lh; });
        y += x.gap;
      });
      c2.font = '400 20px ' + UI; c2.fillStyle = 'rgba(232,230,244,.5)';
      var ft = str(IT.footer); if (ft) { var fl2 = wrap(c2, ft, mw); fl2.forEach(function (l, k) { c2.fillText(l, pad, Hc - pad / 2 - (fl2.length - k) * 28); }); }
      shareCanvas(cv);
    }

    // для проверки (Playwright) и панели
    window.M13U = { state: function () { return { mode: mode, front: (els[frontIdx()] || {}).fl, merged: merged && (merged.own || merged.fl.id), q: Q.i, A: A }; },
      result: function () { return RES || buildResult(A); }, text: selfText, guide: guideText,
      bflies: function () { return bflies.map(function (b) { return { k: b.k, st: b.st, x: b.x, y: b.y, on: b.on ? (b.on.fl || {}).id : null }; }); } };

    lite = OKNO || (navigator.hardwareConcurrency || 8) <= 4;
    layout(); window.addEventListener('resize', layout);
    setMode('idle');
    if (reduce) setStill(true); else setStill(false);
    speed = speedTarget;
    // вступление: только когда в саду есть вопросы и сегодня ещё не было дара; хоровод появляется после «Входи в сад»
    if (!OKNO && !WALK && mode === 'idle' && !giftToday() && introLines().length) {
      document.body.classList.add('uz-pre'); $('#uz-intro').hidden = false;
      $('#b-intro').addEventListener('click', function () {
        $('#uz-intro').hidden = true; document.body.classList.remove('uz-pre'); bloomIntro();
      });
    } else if (!OKNO) bloomIntro();
    els.forEach(function (c) { if (c.v === 'line') c.el.classList.add('is-grow'); });
    requestAnimationFrame(function (ts) { last = ts; frame(ts); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
