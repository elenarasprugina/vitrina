/* 13 MIRRORS · страница маршрута по дням (первым — «Жёлтое Солнце»).
   Данные — data/journeys.json (настраиваются в панели: «Страницы маршрутов»).
   Здесь же — Карта дня и личная карта: их рисует и сама страница, и панель (предпросмотр).
   Этап 1: фон-спираль, экран ожидания, Карта дня, режим проверки ?debug=1. Спираль с кирпичами — этап 2, колода и код — этап 3. */
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

  /* ---------- Страница маршрута ---------- */
  function q(name) { var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(location.search); return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null; }
  var S = { route: null, base: '', mode: 'observation', debug: false, debugNow: null, preview: false };

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
  function layer(node, cls) {
    var ov = el('div', 'ys-layer' + (cls ? ' ' + cls : ''));
    ov.appendChild(node);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeLayer(ov); });
    document.body.appendChild(ov);
    document.body.classList.add('ys-locked');
    requestAnimationFrame(function () { ov.classList.add('is-in'); });
    return ov;
  }
  function closeLayer(ov) {
    ov = ov || document.querySelector('.ys-layer');
    if (!ov) return;
    ov.classList.remove('is-in'); ov.classList.add('is-out');
    setTimeout(function () { ov.remove(); if (!document.querySelector('.ys-layer')) document.body.classList.remove('ys-locked'); }, 380);
  }
  function note(text) {
    var t = el('div', 'ys-toast', text);
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-in'); });
    setTimeout(function () { t.classList.remove('is-in'); setTimeout(function () { t.remove(); }, 400); }, 3200);
  }
  function openDay(n, mode) {
    var r = S.route;
    closeLayer();
    var c = card(r, n, mode, 'day', null, { base: S.base, onSpiral: function () {
      if (mode === 'observation') { closeLayer(); return; }
      if (n === daysCount(r)) { closeLayer(); note('Финал Солнца появится здесь позже.'); return; }
      note(((r.texts || {}).next) || 'Выбор карты-разрешения появится здесь совсем скоро.');
    } });
    layer(c, 'ys-layer--day');
  }
  function openPersonal(n, mode, perm) {
    closeLayer();
    layer(card(S.route, n, mode, 'personal', perm, { base: S.base, onSpiral: function () { closeLayer(); } }), 'ys-layer--personal');
  }
  function render() {
    var r = S.route, app = document.getElementById('ys'), tx = r.texts || {};
    app.replaceChildren();
    var page = el('div', 'ys-page');
    var bg = el('div', 'ys-bgwrap'), stage = el('div', 'ys-stage'), img = el('img', 'ys-master');
    var tall = window.innerHeight / window.innerWidth > 1.25;
    img.alt = ''; img.src = imgSrc(S.base, tall ? (r.masterMobile || r.masterDesktop) : (r.masterDesktop || r.masterMobile));
    img.addEventListener('load', function () { stageFit(stage, img); });
    stage.appendChild(img); bg.appendChild(stage); page.appendChild(bg);
    var dim = el('div', 'ys-dim');
    dim.style.setProperty('--ys-dim', Math.max(0, Math.min(95, r.dimTop == null ? 60 : +r.dimTop)) / 100);
    page.appendChild(dim);

    var back = el('a', 'ys-back', tx.back || '← Вернуться на витрину');
    back.href = S.base || '../../';
    page.appendChild(back);

    var n = dayNumber(r, nowMsk(S.debugNow)), last = daysCount(r);
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
      // Этап 1: вместо светящегося кирпича — кнопка. Спираль с кирпичами придёт на этапе 2.
      var go = el('button', 'ys-go', tx.openDay || 'Карта дня');
      go.type = 'button';
      go.addEventListener('click', function () { openDay(n, S.mode); });
      hud.appendChild(go);
    }
    page.appendChild(hud);
    app.appendChild(page);
    if (S.debug) app.appendChild(debugPanel());
    window.onresize = function () { if (img.complete) stageFit(stage, img); };
    if (img.complete) stageFit(stage, img);
  }
  // Режим проверки: ?debug=1 — любой день, любой формат, личная карта с любой картой-разрешением.
  function debugPanel() {
    var r = S.route, box = el('div', 'ys-debug');
    var head = el('button', 'ys-debug-h', 'Проверка ▾'); head.type = 'button';
    var body = el('div', 'ys-debug-b');
    head.addEventListener('click', function () { box.classList.toggle('is-min'); });
    function sel(opts, val) { var s = el('select'); opts.forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; s.appendChild(op); }); s.value = val; return s; }
    var days = []; for (var i = 1; i <= daysCount(r); i++) days.push([String(i), 'День ' + i + ' · ' + dateOf(r, i)]);
    var now = dayNumber(r, nowMsk(S.debugNow));
    var sd = sel(days, String(Math.max(1, Math.min(daysCount(r), now || 1))));
    var sm = sel(MODES.map(function (m) { return [m, MODE_NAMES[m]]; }), S.mode);
    var sp = sel((r.permissions || []).map(function (p, k) { return [String(k), (k + 1) + '. ' + (p.title || '')]; }), '0');
    var b1 = el('button', null, 'Карта дня'), b2 = el('button', null, 'Личная карта');
    b1.type = b2.type = 'button';
    b1.addEventListener('click', function () { openDay(+sd.value, sm.value); });
    b2.addEventListener('click', function () { if (sm.value === 'observation') { note('У Наблюдения личной карты нет — выберите Путешествие или Погружение.'); return; } openPersonal(+sd.value, sm.value, (r.permissions || [])[+sp.value]); });
    [el('span', null, 'Сейчас по Москве: ' + (S.debugNow ? S.debugNow + ' (подмена)' : 'настоящее время') + ' · ' + (now === 0 ? 'до начала' : now > daysCount(r) ? 'после конца' : 'день ' + now)),
      sd, sm, sp, el('div', 'ys-debug-row', null)].forEach(function (x) { body.appendChild(x); });
    body.lastChild.appendChild(b1); body.lastChild.appendChild(b2);
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
    spiralSVG: spiralSVG, MODES: MODES, MODE_NAMES: MODE_NAMES, boot: boot };
})();
