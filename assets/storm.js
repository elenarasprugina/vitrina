/* «Глаз бури» — живая страница волны Синей Бури (её решения 12.11.2026, docs/glaz-buri.md; проба — docs/glaz-buri/proba.html).
   С 13.11 (вечер) — пространство «Узоров» (uzory/<id>/, space.scene = 'storm', волна — space.storm в uzory.json; M13_STORM_RUN).
   Старая страница: routes/<id>/ (<div id="gb" data-base="../../" data-route="blue-storm">). Данные — data/storm.json = { items: [волна] }
   (панель → «Глаз бури»); в предпросмотре панели — её черновик (window.parent.M13_STORM_DRAFT). Нет файла — заготовка ниже (её тексты 12.11).
   Ход: вихрь; держишь палец на глазу — «вдох / выдох», буря стихает → отпустил — огонёк дня по кругу уходит в глаз, глаз в цвет печати →
   прозрачная Карта дня → «Вернуться в бурю» → звёздный дождь. День — сегодняшний по Москве; огоньки не нажимаются.
   Карта дня открывается на устройстве один раз (устройство помнит только номера открытых дней — без имён и текстов, на сервер ничего не уходит);
   повторно в тот же день — «Подыши вместе с бурей», без карты. 13-й день: карта → финал (огоньки уходят в глаз, буря стихает, выходят витком,
   «Что ты забираешь с собой?» и «Увидимся за поворотом…»). После волны — сразу финал, без бури.
   Проверка: ?debug=1 — кружки дней и «↺ звёзды» (память отдельная, настоящую не трогает); ?den=ГГГГ-ММ-ДД — как будто сегодня этот день. */
(function () {
  'use strict';
  var COL = { red: '#ef6a5a', white: '#eef3fa', blue: '#6aa6ff', yellow: '#f4cd55' }, ORDER = ['red', 'white', 'blue', 'yellow'];
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  // Заготовка — её тексты 12.11 (на сайте берутся из data/storm.json, правятся в панели)
  window.M13_STORM_DEFAULT = {
    id: 'blue-storm', start: '2026-11-13', title: 'Глаз бури', tag: 'Синяя Буря · 13–25 ноября',
    days: [
      { kin: 79, name: 'Синяя Магнитная Буря', seal: 'blue', tone: 'магнитный · цель', word: 'Предчувствие', q: 'Что для тебя сейчас актуально?' },
      { kin: 80, name: 'Жёлтое Лунное Солнце', seal: 'yellow', tone: 'лунный · вызов', word: 'Ясность', q: 'В каких моментах выбор по-настоящему твой?' },
      { kin: 81, name: 'Красный Электрический Дракон', seal: 'red', tone: 'электрический · служение', word: 'Забота', q: 'Как ты можешь сегодня позаботиться о себе?' },
      { kin: 82, name: 'Белый Самосущий Ветер', seal: 'white', tone: 'самосущий · форма', word: 'Искренность', q: 'Что на самом деле ты чувствуешь?' },
      { kin: 83, name: 'Синяя Обертонная Ночь', seal: 'blue', tone: 'обертонный · сияние', word: 'Достаточность', q: 'Что у тебя уже есть, чего хватает?' },
      { kin: 84, name: 'Жёлтое Ритмическое Семя', seal: 'yellow', tone: 'ритмический · равновесие', word: 'Терпение', q: 'Чему в твоей жизни нужно время, чтобы созреть?' },
      { kin: 85, name: 'Красный Резонансный Змей', seal: 'red', tone: 'резонансный · настройка', word: 'Чуткость', q: 'Как чувствует себя твоё тело?' },
      { kin: 86, name: 'Белый Галактический Соединитель Миров', seal: 'white', tone: 'галактический · целостность', word: 'Принятие', q: 'Что в твоей жизни уже достаточно хорошо?' },
      { kin: 87, name: 'Синяя Солнечная Рука', seal: 'blue', tone: 'солнечный · намерение', word: 'Исцеление', q: 'Что из простого и привычного приносит тебе спокойствие?' },
      { kin: 88, name: 'Жёлтая Планетарная Звезда', seal: 'yellow', tone: 'планетарный · проявление', word: 'Красота', q: 'Что радует твой взгляд?' },
      { kin: 89, name: 'Красная Спектральная Луна', seal: 'red', tone: 'спектральный · освобождение', word: 'Гибкость', q: 'Что помогает тебе не сломаться, а удержать равновесие?' },
      { kin: 90, name: 'Белая Кристаллическая Собака', seal: 'white', tone: 'кристаллический · сотрудничество', word: 'Верность', q: 'В чём ты остаёшься собой, что бы ни происходило?' },
      { kin: 91, name: 'Синяя Космическая Обезьяна', seal: 'blue', tone: 'космический · присутствие', word: 'Лёгкость', q: 'Что сделаешь просто так, для удовольствия?' }
    ],
    texts: {}
  };
  // Надписи по умолчанию (панель → «Глаз бури» → «Надписи»; пусто — эти)
  window.M13_STORM_TEXTS = [
    ['hint', 'Подсказка внизу', 'Иди в центр бури — держи палец и дыши'],
    ['short', 'Если отпустил слишком рано', 'Подержи подольше — сделай хотя бы один вдох и выдох'],
    ['again', 'Подсказка, когда карта дня уже открыта (и в финале)', 'Подыши вместе с бурей'],
    ['inhale', 'Дыхание: вдох', 'вдох'], ['exhale', 'Дыхание: выдох', 'выдох'],
    ['today', 'Под названием: идёт волна ({n} — номер дня)', 'Сегодня — день {n}'],
    ['before', 'Под названием: до начала ({date} — дата первого дня)', 'Буря начнётся {date}'],
    ['after', 'Под названием: волна прошла', 'Буря прошла'],
    ['cardDay', 'Карта: верхняя строка ({n} — день, {date} — дата)', 'День {n} · {date}'],
    ['cardKin', 'Карта: строка кина ({kin}, {name})', 'Кин {kin} · {name}'],
    ['cardTone', 'Карта: строка тона ({n} — номер тона, {tone} — что вписано у дня)', 'Тон {n} · {tone}'],
    ['back', 'Кнопка на карте', 'Вернуться в бурю'],
    ['finalQ', 'Финал: вопрос («-» — без него)', 'Что ты забираешь с собой?'],
    ['farewell', 'Финал: прощание', 'Увидимся за поворотом…'],
    ['wind', 'Кнопка звука', '♪ Ветер'], ['windOff', 'Кнопка звука, когда играет', '♪ Ветер · выкл'],
    ['home', 'Ссылка вверху справа («-» — без неё)', '← К витрине']
  ];
  var BASE = '../../';
  function getJSON(u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function str(v, d) { v = v == null ? '' : String(v); return v.trim() ? v : (d || ''); }
  function fill(s, map) { return String(s || '').replace(/\{(\w+)\}/g, function (m, k) { return map[k] != null ? map[k] : m; }); }
  function load(id) {
    try { if (window.parent !== window && window.parent.M13_STORM_DRAFT) return Promise.resolve(window.parent.M13_STORM_DRAFT(id)); } catch (e) {}
    return getJSON(BASE + 'data/storm.json').then(function (d) {
      return ((d && d.items) || []).filter(function (x) { return x && x.id === id; })[0] || null;
    }).catch(function () { return null; });
  }
  function boot() {
    var root = document.getElementById('gb');
    if (!root) return;
    BASE = root.getAttribute('data-base') || '../../';
    var id = root.getAttribute('data-route') || 'blue-storm';
    load(id).then(function (W) {
      if (!W && id === window.M13_STORM_DEFAULT.id) W = window.M13_STORM_DEFAULT;
      if (!W) { root.innerHTML = '<p class="gb-err">Страница готовится.</p>'; return; }
      run(root, W);
    });
  }

  // Пространство «Узоров» (её решение 13.11: буря — одно из пространств, как сад и костёр): assets/uzory.js зовёт сюда
  // с волной из uzory.json (space.storm). opts.okno — живое окошко на карточке витрины: только вихрь, без надписей.
  window.M13_STORM_RUN = function (root, W, base, opts) {
    BASE = base || BASE;
    var D = window.M13_STORM_DEFAULT;
    if (!W || !(W.days && W.days.length)) W = Object.assign({}, D, W || {}, { days: (W && W.days && W.days.length) ? W.days : D.days, id: (W && W.id) || D.id });
    run(root, W, opts || {});
  };

  function run(root, WAVE, OPT) {
    OPT = OPT || {};
    var DEF = window.M13_STORM_DEFAULT, TX = WAVE.texts || {}, TD = {};
    window.M13_STORM_TEXTS.forEach(function (t) { TD[t[0]] = t[2]; });
    function T(k) { var v = str(TX[k], TD[k]); return v === '-' ? '' : v; }
    var DAYS = [], i;
    for (i = 0; i < 13; i++) {
      var d = (WAVE.days || [])[i] || {}, d0 = (WAVE.id === DEF.id ? DEF.days[i] : null) || {};
      DAYS.push({ kin: d.kin || d0.kin || '', name: str(d.name, d0.name), c: COL[d.seal] ? d.seal : (COL[d0.seal] ? d0.seal : 'blue'),
        w: str(d.word), t: str(d.tone), q: str(d.q), text: str(d.text) });
    }
    var START = /^\d{4}-\d\d-\d\d$/.test(WAVE.start || '') ? WAVE.start : DEF.start;
    function utc(s) { var p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
    function dateOf(k) { var t = new Date(utc(START) + k * 864e5); return t.getUTCDate() + ' ' + MONTHS[t.getUTCMonth()]; }
    var Q = location.search, DEBUG = /[?&]debug=1/.test(Q), denM = /[?&]den=(\d{4}-\d\d-\d\d)/.exec(Q);
    // какой сегодня день волны — по Москве
    var todayIso = denM ? denM[1] : new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
    var n = Math.round((utc(todayIso) - utc(START)) / 864e5);
    var phase = n < 0 ? 'before' : n > 12 ? 'after' : 'wave';

    document.documentElement.className += ' gb-html';
    document.body.className = 'gb-body' + (DEBUG ? ' gb-debug' : '') + (OPT.okno ? ' gb-okno' : '');
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    root.innerHTML =
      '<div class="gb-scene"><canvas id="gb-storm"></canvas><canvas id="gb-fx" aria-label="' + esc(T('hint')) + '"></canvas></div>' +
      '<button class="gb-wind" id="gb-wind" type="button" aria-pressed="false">' + esc(T('wind')) + '</button>' +
      (T('home') ? '<a class="gb-home" href="' + esc(BASE) + '">' + esc(T('home')) + '</a>' : '') +
      '<header class="gb-top">' + (str(WAVE.tag, DEF.tag) && str(WAVE.tag) !== '-' ? '<div class="gb-tag">' + esc(str(WAVE.tag, WAVE.id === DEF.id ? DEF.tag : '')) + '</div>' : '') +
        '<h1>' + esc(str(WAVE.title, DEF.title)) + '</h1><div class="gb-sub" id="gb-today"></div></header>' +
      '<div class="gb-fare" id="gb-fare" aria-live="polite">' + (T('finalQ') ? '<div class="gb-fq">' + esc(T('finalQ')) + '</div>' : '') +
        '<div class="gb-fw">' + esc(T('farewell')) + '</div></div>' +
      '<div class="gb-hint" id="gb-hint"></div>' +
      (DEBUG ? '<nav class="gb-days" id="gb-days"><span>Проверка · день</span></nav>' : '') +
      '<div class="gb-card" id="gb-card" role="dialog" aria-live="polite">' +
        '<div class="gb-c-day" id="gb-cDay"></div><div class="gb-c-kin"><i id="gb-cDot"></i><span id="gb-cKin"></span></div>' +
        '<div class="gb-c-word" id="gb-cWord"></div><div class="gb-c-tone" id="gb-cTone"></div><div class="gb-c-q" id="gb-cQ"></div>' +
        '<p class="gb-c-text" id="gb-cText"></p>' +
        '<button id="gb-back" type="button">' + esc(T('back')) + '</button></div>';

    var todayEl = document.getElementById('gb-today');
    function sub() {
      todayEl.textContent = phase === 'before' ? fill(T('before'), { date: dateOf(0) }) : phase === 'after' ? T('after') : fill(T('today'), { n: sel + 1 });
    }
    var sel = Math.max(0, Math.min(12, n));

    // открытые карты — только на этом устройстве: номера дней этой волны
    var KEY = 'm13storm-' + (WAVE.id || 'wave') + '-' + START + (DEBUG || denM ? '-check' : ''), got = {};
    try { got = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { got = {}; }
    function saveGot() { try { localStorage.setItem(KEY, JSON.stringify(got)); } catch (e) {} }

    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var sc = document.getElementById('gb-storm'), sx = sc.getContext('2d');
    var fc = document.getElementById('gb-fx'), fx = fc.getContext('2d');
    var W, H, R, cx, cy, dpr, eyeR, parts = [], lights = [], ringR, lastW = 0, lastH = 0;
    // финал — виток, а не кольцо (её выбор 12.11): огоньки по часовой среди мерцающих точек вокруг глаза; нить — одна плавная спираль из центра
    // глаза через все дни и дальше 13-го, раскрывается и тает — «за поворотом»; виток живой, по нити бежит огонёк
    var CONT = 5.5, LEAD = 7, runT0 = null, fwA = 0, cubeA = 0, FW_U0 = 12.45;
    function FWPX() { return W < 520 ? 21 : 27; }
    // цвет бегущего огонька — по кругу цветов печатей, начиная со следующей волны (у Синей Бури: жёлтый, красный, белый, синий…)
    var c0 = ORDER.indexOf(DAYS[0].c), RUNC = [0, 1, 2, 3].map(function (k) { return ORDER[(c0 + 1 + k) % 4]; });
    function figPos(u) {
      var sway = 0.07 * Math.sin(time * 0.21), br = 1 + 0.025 * Math.sin(time * 0.8),
        a = -Math.PI / 2 + (u + 0.5) / 13 * 6.283 + sway, f = 0.84 * Math.exp(0.0297 * u);
      if (u < 0) { var t = Math.max(0, (u + LEAD) / LEAD); f *= t * t * (3 - 2 * t); }
      if (u > 12) f *= Math.exp(0.025 * (u - 12) * (u - 12));
      var r = ringR * br * f;
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.82, a: a, r: r };
    }
    var fare = document.getElementById('gb-fare'), hint = document.getElementById('gb-hint'), card = document.getElementById('gb-card');

    function resize() {
      // телефон: строка адреса прячется/появляется — высота чуть меняется; вихрь заново не рассыпаем
      if (innerWidth === lastW && Math.abs(innerHeight - lastH) < 140 && parts.length) { place(); return; }
      lastW = innerWidth; lastH = innerHeight;
      place();
      sx.fillStyle = '#050916'; sx.fillRect(0, 0, W, H);
      var N = W < 520 ? 900 : 1600; parts = []; for (var k = 0; k < N; k++) parts.push(spawn(true));
    }
    function place() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      [sc, fc].forEach(function (c) { c.width = W * dpr; c.height = H * dpr; });
      sx.setTransform(dpr, 0, 0, dpr, 0, 0); fx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sx.fillStyle = '#050916'; sx.fillRect(0, 0, W, H);
      cx = W / 2; cy = H * 0.52; R = Math.min(W, H) * 0.58; if (W < 520) R = Math.min(W * 0.78, H * 0.42);
      eyeR = R * 0.17;
      lights = [];
      for (var k = 0; k < 13; k++) {
        var t = k / 12, r = R * (0.93 - 0.68 * t), a = -2.2 + t * Math.PI * 2.3;
        lights.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.82 });
      }
      ringR = eyeR * 1.3;
      // вопрос финала — над спиралью (её решение 13.11), между заголовком и витком; «Увидимся за поворотом…» — по хвосту нити (fwDraw)
      var fh = fare.offsetHeight || 40, tp = document.querySelector('.gb-top'), hb = tp ? tp.getBoundingClientRect().bottom : 120,
        spTop = cy - ringR * 1.3 * 0.82 - FWPX() * 1.6;
      fare.style.top = Math.max(hb + 14, (hb + spTop) / 2 - fh / 2) + 'px';
    }
    var TW = 1.9;
    function spawn(any) {
      var r = any ? eyeR + Math.pow(Math.random(), 0.7) * (R * 1.15 - eyeR) : R * (1.0 + Math.random() * 0.18);
      var col = Math.random() < 0.16 ? 'day' : (Math.random() < 0.5 ? 'ice' : 'storm');
      return { r: r, arm: Math.floor(Math.random() * 3), j: (Math.random() - 0.5) * (0.35 + Math.random() * 0.6),
        v: 0.12 + Math.random() * 0.35, s: 0.5 + Math.random() * 1.4, col: col, free: Math.random() < 0.25, a: Math.random() * 6.28 };
    }

    // состояние: idle → breath (держат) → sign (огонёк летит в глаз) → card → rain → idle; 13-й день: card → final
    var state = 'idle', holdT = 0, calm = 0, signT = 0, rainT = 0, rot = 0, boost = 0, boostT = 0, time = 0, last = performance.now();
    var FLY = 3.6, GAP = 0.45, FIN = 12 * 0.45 + 3.6, OUT0 = 12 * 0.45 + 3.6 + 1.6, OUTD = 3.6, CON0 = OUT0 + 12 * 0.22 + 3.6, LINED = 5, TXT0 = CON0 + LINED,
      finT = 0, still = 0, finished = false, ftr = [], tint = 0, trail = [], RAIN = 7, dropAcc = 0, drops = [], bolts = [], nextBolt = 4 + Math.random() * 5, flash = 0, hintTimer = 0;
    // после волны и после финала 13-го дня — сразу виток, без бури
    if (phase === 'after' || (phase === 'wave' && sel === 12 && got.fin)) { finished = true; still = 1; }
    // карта сегодня уже открыта (или волна ещё не началась / прошла) — просто дышим с бурей
    function rest() { return finished || phase !== 'wave' || !!got[sel]; }
    function idleHint() { return rest() ? T('again') : T('hint'); }
    function setHint(t, big) { hint.textContent = t; hint.classList.toggle('breath', !!big); hint.style.opacity = t ? 1 : 0; }

    function frame(now) {
      var dt = Math.min(50, now - last) / 1000; last = now; time += dt;
      if (boostT > 0) { boostT -= dt; boost += (1 - boost) * Math.min(1, dt * 3); } else boost += (0 - boost) * Math.min(1, dt * 0.8);
      // спокойствие: растёт, пока держат; держится, пока открыта карта; потом медленно уходит
      if (state === 'breath') { holdT += dt; calm += (Math.min(1, holdT / 7) - calm) * Math.min(1, dt * 1.5); }
      else if (state === 'sign' || state === 'card' || state === 'final') { calm += ((state === 'final' ? 1 : 0.85) - calm) * Math.min(1, dt * 0.6); }
      else calm += (0 - calm) * Math.min(1, dt * 0.35);
      if (state === 'final') {
        finT += dt; if (finT > FIN - 1) still += (1 - still) * Math.min(1, dt * 0.5);
        if (finT > TXT0 + 1) { state = 'idle'; finished = true; got.fin = 1; saveGot(); marks(); setHint(T('again')); }
      } else if (!finished) still += (0 - still) * Math.min(1, dt * 0.5);
      var sp = (reduce ? 0.25 : 1) * ((1 - calm * 0.85) + boost * 2.5) * (1 - still * 0.96);
      rot += dt * 0.22 * sp;

      if (state === 'breath') { var ph = (holdT % 8) / 8; setHint(ph < 0.5 ? T('inhale') : T('exhale'), true); }
      if (state === 'sign') { signT += dt; if (signT > FLY + 0.9) openCard(); }
      // окраска глаза в цвет дня: приходит с огоньком, держится при карте, уходит после
      if (state === 'sign' && signT > FLY * 0.8 || state === 'card') tint += (1 - tint) * Math.min(1, dt * 1.6); else tint += (0 - tint) * Math.min(1, dt * 0.4);
      if (state === 'rain') { rainT -= dt; if (rainT <= 0) { state = 'idle'; setHint(idleHint()); } }

      // зарницы — редко и беззвучно
      if (!reduce && !finished && state !== 'breath' && state !== 'sign' && state !== 'final') { nextBolt -= dt; if (nextBolt <= 0) { bolt(); nextBolt = 6 + Math.random() * 9; } }
      flash = Math.max(0, flash - dt * 3);

      sx.globalCompositeOperation = 'source-over';
      sx.fillStyle = 'rgba(5,9,22,' + (reduce ? 0.3 : 0.14) + ')'; sx.fillRect(0, 0, W, H);
      sx.globalCompositeOperation = 'lighter';
      var dc = COL[DAYS[sel].c];
      for (var k = 0; k < parts.length; k++) {
        var p = parts[k];
        p.r -= dt * p.v * R * 0.05 * sp * (0.6 + eyeR * 2.2 / p.r);
        if (p.r < eyeR * 0.95) { parts[k] = spawn(false); continue; }
        var ang;
        if (p.free) { p.a += dt * sp * 0.9 * Math.pow(R / p.r, 0.75) * 0.35; ang = p.a; }
        else ang = p.arm * 2.094 + TW * Math.log(p.r / R) + rot * (1 + 0.4 * Math.pow(eyeR / p.r, 0.5)) + p.j;
        var x = cx + Math.cos(ang) * p.r, y = cy + Math.sin(ang) * p.r * 0.82;
        var fade = Math.min(1, (p.r - eyeR) / (eyeR * 1.2)) * Math.min(1, (R * 1.18 - p.r) / (R * 0.3));
        sx.fillStyle = p.col === 'day' ? dc : (p.col === 'ice' ? '#cfe2ff' : '#5f9dff');
        sx.globalAlpha = Math.max(0, (0.35 + 0.4 * boost + 0.5 * flash) * fade * (1 - calm * 0.35) * (1 - still * 0.8));
        sx.fillRect(x, y, p.s, p.s);
      }
      sx.globalAlpha = 1;
      drawFx(dt);
      wind();
      requestAnimationFrame(frame);
    }
    // зарница: мягкая вспышка света внутри облака, без линий
    function bolt() {
      var a = Math.random() * 6.28, r = R * (0.45 + Math.random() * 0.5);
      bolts.push({ a: a, r: r, t: 0, s: R * (0.25 + Math.random() * 0.2) }); flash = 0.25;
    }

    function drawFx(dt) {
      fx.clearRect(0, 0, W, H);
      for (var b = bolts.length - 1; b >= 0; b--) {
        var B = bolts[b]; B.t += dt;
        if (B.t > 1.4) { bolts.splice(b, 1); continue; }
        var al = B.t < 0.12 ? B.t / 0.12 : (B.t < 0.22 ? 0.55 + 0.45 * Math.cos((B.t - 0.12) * 31) : Math.max(0, 1 - (B.t - 0.22) / 1.18));
        var ba = B.a + rot, bx = cx + Math.cos(ba) * B.r, by = cy + Math.sin(ba) * B.r * 0.82;
        var zg = fx.createRadialGradient(bx, by, 0, bx, by, B.s);
        zg.addColorStop(0, 'rgba(200,222,255,' + (0.32 * al) + ')'); zg.addColorStop(0.4, 'rgba(120,170,255,' + (0.14 * al) + ')'); zg.addColorStop(1, 'rgba(95,157,255,0)');
        fx.fillStyle = zg; fx.beginPath(); fx.arc(bx, by, B.s, 0, 6.29); fx.fill();
      }
      // дыхание: глаз растёт на вдохе, сжимается на выдохе
      var breathe = state === 'breath' ? (0.5 - 0.5 * Math.cos((holdT % 8) / 8 * 6.283)) : 0;
      var br = 1 + Math.sin(time * 0.9) * 0.05 + boost * 0.3 + breathe * 0.55 + calm * 0.25;
      var g = fx.createRadialGradient(cx, cy, 0, cx, cy, eyeR * 2.4 * br);
      g.addColorStop(0, 'rgba(225,238,255,' + (0.5 + boost * 0.3 + calm * 0.3) + ')');
      g.addColorStop(0.35, 'rgba(140,185,255,' + (0.2 + calm * 0.12) + ')');
      g.addColorStop(1, 'rgba(95,157,255,0)');
      fx.fillStyle = g; fx.beginPath(); fx.arc(cx, cy, eyeR * 2.4 * br, 0, 6.29); fx.fill();
      var core = eyeR * (0.62 + breathe * 0.12);
      // глаз без чёткой границы: несколько мягких пятен, край неровный и медленно дышит
      var da = 0.5 - calm * 0.2;
      for (var e5 = 0; e5 < 5; e5++) {
        var ea = e5 * 1.257 + time * 0.07, eo = core * 0.16 * (0.6 + 0.4 * Math.sin(time * 0.31 + e5 * 2.1)),
          ex = cx + Math.cos(ea) * eo, ey = cy + Math.sin(ea) * eo * 0.85, er = core * (1.05 + 0.12 * Math.sin(time * 0.23 + e5 * 1.3));
        var eg = fx.createRadialGradient(ex, ey, 0, ex, ey, er);
        eg.addColorStop(0, 'rgba(8,16,40,' + (da * 0.42) + ')'); eg.addColorStop(0.55, 'rgba(8,16,40,' + (da * 0.3) + ')'); eg.addColorStop(1, 'rgba(8,16,40,0)');
        fx.fillStyle = eg; fx.beginPath(); fx.arc(ex, ey, er, 0, 6.29); fx.fill();
      }
      // в самой середине — чуть светлее, как чистое небо в глазу
      var sk = fx.createRadialGradient(cx, cy, 0, cx, cy, core * 0.6);
      sk.addColorStop(0, 'rgba(150,185,240,' + (0.10 + calm * 0.08) + ')'); sk.addColorStop(1, 'rgba(150,185,240,0)');
      fx.fillStyle = sk; fx.beginPath(); fx.arc(cx, cy, core * 0.6, 0, 6.29); fx.fill();
      if (tint > 0.01) {
        var tc = hexA(COL[DAYS[sel].c]), tg = fx.createRadialGradient(cx, cy, 0, cx, cy, eyeR * 2.2 * br);
        tg.addColorStop(0, 'rgba(' + tc + ',' + (0.5 * tint) + ')'); tg.addColorStop(0.45, 'rgba(' + tc + ',' + (0.22 * tint) + ')'); tg.addColorStop(1, 'rgba(' + tc + ',0)');
        fx.fillStyle = tg; fx.beginPath(); fx.arc(cx, cy, eyeR * 2.2 * br, 0, 6.29); fx.fill();
      }
      // вокруг глаза бегут мерцающие искры (линию-кольцо убрали)
      var wr = eyeR * 1.25 * (1 + breathe * 0.15);
      for (var s = 0; s < 22; s++) {
        var sa = s / 22 * 6.283 + rot * 2.2 + Math.sin(s * 7.3) * 0.3, sr = wr * (1 + Math.sin(s * 3.1 + time) * 0.05);
        var sxp = cx + Math.cos(sa) * sr, syp = cy + Math.sin(sa) * sr * 0.82, tw = 0.5 + 0.5 * Math.sin(time * 3 + s * 1.7);
        fx.fillStyle = 'rgba(225,238,255,' + (0.35 + 0.5 * tw) + ')'; fx.beginPath(); fx.arc(sxp, syp, 0.8 + tw * 1.1, 0, 6.29); fx.fill();
      }
      if (state === 'sign') {
        // огонёк дня срывается со своего места на спирали и по кругу уходит в глаз, оставляя след
        var ft = Math.min(1, signT / FLY), fp0 = flyPos(sel, ft), dcol = COL[DAYS[sel].c];
        if (ft < 1) { trail.push(fp0); if (trail.length > 26) trail.shift(); } else if (trail.length) trail.shift();
        for (var ti = 0; ti < trail.length; ti++) { fx.globalAlpha = (ti / trail.length) * 0.5; glow(trail[ti][0], trail[ti][1], 1.4 + ti / trail.length * 1.8, dcol, 1); }
        fx.globalAlpha = 1;
        if (ft < 1) glow(fp0[0], fp0[1], 5, dcol, Math.min(1, signT * 2));
      }
      if (state === 'final' || finished) {
        for (var fd = 0; fd < 13; fd++) {
          var fdt = state === 'final' ? (finT - fd * GAP) / FLY : 2; if (fdt <= 0) continue;
          var fc2 = COL[DAYS[fd].c], TR = ftr[fd] || (ftr[fd] = []);
          if (fdt < 1) { var fp = flyPos(fd, fdt); TR.push(fp); if (TR.length > 22) TR.shift(); glow(fp[0], fp[1], 4.5, fc2, 1); } else if (TR.length) TR.shift();
          for (var q = 0; q < TR.length; q++) glow(TR[q][0], TR[q][1], 1.2 + q / TR.length * 1.6, fc2, (q / TR.length) * 0.5);
        }
        var built = !(state === 'final'), lk = built ? 1 : Math.max(0, Math.min(1, (finT - CON0) / LINED)), ck = built ? 1 : Math.max(0, Math.min(1, (finT - TXT0) / 2.6));
        // нить: одна плавная спираль из центра глаза через все дни и дальше «за поворот»; в центре проявляется, в конце тает
        if (lk > 0) {
          var uA = -LEAD + (12 + LEAD) * lk, uB = ck > 0 ? 12 + CONT * ck : uA, SU = 0.08, pv, pu, al0 = 0.34 + 0.05 * Math.sin(time * 0.9), u;
          fx.save(); fx.lineWidth = 0.9; fx.lineCap = 'round'; fx.lineJoin = 'round';
          pv = figPos(-LEAD);
          for (u = -LEAD + SU; u <= Math.min(uB, -LEAD + 3) + 1e-6; u += SU) {
            pu = figPos(u); var fi = (u + LEAD) / 3;
            fx.strokeStyle = 'rgba(207,226,255,' + (al0 * fi * fi) + ')'; fx.beginPath(); fx.moveTo(pv.x, pv.y); fx.lineTo(pu.x, pu.y); fx.stroke(); pv = pu;
          }
          if (uB > -LEAD + 3) {
            fx.strokeStyle = 'rgba(207,226,255,' + al0 + ')'; fx.shadowColor = 'rgba(140,185,255,.7)'; fx.shadowBlur = 6; fx.beginPath(); fx.moveTo(pv.x, pv.y);
            for (u = -LEAD + 3; u <= Math.min(uB, 12) + 1e-6; u += SU) { pu = figPos(u); fx.lineTo(pu.x, pu.y); pv = pu; }
            fx.stroke(); fx.shadowBlur = 0;
          }
          for (u = 12 + SU; u <= uB + 1e-6; u += SU) {
            pu = figPos(u); var fa2 = 1 - (u - 12) / CONT;
            fx.strokeStyle = 'rgba(207,226,255,' + (al0 * fa2 * fa2) + ')'; fx.beginPath(); fx.moveTo(pv.x, pv.y); fx.lineTo(pu.x, pu.y); fx.stroke(); pv = pu;
          }
          fx.restore();
        }
        // бегущий огонёк: из ока по нити через все дни и за поворот, раз в ~9 с
        var runU = -99, rc = COL[RUNC[0]];
        if (built || finT > TXT0 + 2.6) { if (runT0 === null) runT0 = time; var rt = (time - runT0) / 9, rp = rt % 1; runU = -LEAD + rp * (LEAD + 12 + CONT + 1); rc = COL[RUNC[Math.floor(rt) % 4]]; }
        if (runU > -LEAD && runU < 12 + CONT) { var RP = figPos(runU), ra = runU > 12 ? 1 - (runU - 12) / CONT : Math.min(1, (runU + LEAD) / 2.5); glow(RP.x, RP.y, 2, rc, 0.95 * ra); }
        for (var od = 0; od < 13; od++) {
          var ot = built ? 2 : (finT - OUT0 - od * 0.22) / OUTD; if (ot <= 0) continue;
          var oc = COL[DAYS[od].c], OT = ftr[20 + od] || (ftr[20 + od] = []), Lo = figPos(od), tw2 = 1 + 0.18 * Math.sin(time * (1.3 + od * 0.17) + od * 2.1) + 0.5 * Math.exp(-(od - runU) * (od - runU) / 0.5);
          if (ot < 1) {
            var oe = ot * ot * (3 - 2 * ot), orr = Lo.r * oe, oa = Lo.a - (1 - oe) * 3.4, op = [cx + Math.cos(oa) * orr, cy + Math.sin(oa) * orr * 0.82];
            OT.push(op); if (OT.length > 16) OT.shift(); glow(op[0], op[1], 4, oc, Math.min(1, ot * 6));
          } else { if (OT.length) OT.shift(); glow(Lo.x, Lo.y, 3.4 * tw2, oc, 1); starDot(Lo.x, Lo.y, 1.2 * tw2, '#f4f8ff', 0.8); }
          for (var oq = 0; oq < OT.length; oq++) glow(OT[oq][0], OT[oq][1], 1.1 + oq / OT.length * 1.6, oc, (oq / OT.length) * 0.5);
        }
      }
      var fareOn = (finished && state !== 'breath' || state === 'final' && finT > TXT0) && state !== 'card' && state !== 'sign';
      fare.classList.toggle('on', fareOn);
      fwA += ((fareOn ? 1 : 0) - fwA) * 0.03;
      if ((state === 'final' || finished) && fwA > 0.01 && !OPT.okno) fwDraw(fwA, built ? 1 : ck, runU);
      // спираль 13 огоньков дней: пройденные (по календарю) — ярко, сегодняшний пульсирует, пока карта не открыта; будущие — едва
      for (var dd = 0; dd < 13; dd++) {
        var Ld = lights[dd], c = COL[DAYS[dd].c], on = phase === 'wave' && dd === sel;
        if (finished || state === 'final' && finT > dd * GAP) continue;
        var past = phase === 'after' || (phase === 'wave' && dd < sel) || got[dd];
        var opened = on && (state === 'card' || !!got[dd]);
        if (on && state === 'sign') continue;   // огонёк дня сейчас летит в глаз
        var pr = on && !opened ? (4.5 + Math.sin(time * 2.4) * 1.5) : opened ? 3.8 : (past ? 3.4 + Math.sin(time * 1.6 + dd) * 0.5 : 2.2);
        glow(Ld.x, Ld.y, pr * 0.8, c, (on || past ? 1 : 0.5) * (1 - calm * 0.4));
      }
      // звёздный дождь после карты: метеоры редеют постепенно, каждый гаснет сам
      if (state === 'rain') {
        var kf = Math.pow(Math.max(0, rainT / RAIN), 1.6); dropAcc += dt * (W < 520 ? 10 : 16) * kf;
        while (dropAcc >= 1) {
          dropAcc -= 1; var ma = 1.95 + (Math.random() - 0.5) * 0.25, mv = 260 + Math.random() * 380;
          drops.push({ x: W * (0.1 + Math.random() * 1.0), y: H * (Math.random() * 0.65) - 40, vx: Math.cos(ma) * mv, vy: Math.sin(ma) * mv,
            age: 0, life: 0.7 + Math.random() * 0.9, len: 40 + Math.random() * 90, c: Math.random() < 0.22 ? COL[DAYS[sel].c] : '#e4efff' });
        }
      }
      for (var r = drops.length - 1; r >= 0; r--) {
        var D = drops[r]; D.age += dt; if (D.age > D.life) { drops.splice(r, 1); continue; }
        D.x += D.vx * dt; D.y += D.vy * dt; var ma2 = Math.sin(Math.PI * D.age / D.life), sp2 = Math.hypot(D.vx, D.vy);
        var tx = D.x - D.vx / sp2 * D.len, ty = D.y - D.vy / sp2 * D.len, lg = fx.createLinearGradient(D.x, D.y, tx, ty);
        lg.addColorStop(0, 'rgba(235,244,255,' + (0.75 * ma2) + ')'); lg.addColorStop(1, 'rgba(120,170,255,0)');
        fx.strokeStyle = lg; fx.lineWidth = 1.2; fx.beginPath(); fx.moveTo(D.x, D.y); fx.lineTo(tx, ty); fx.stroke();
        fx.save(); fx.globalAlpha = ma2; starDot(D.x, D.y, 1.4, D.c, 1); fx.restore();
      }
    }
    // где летящий огонёк дня d: срывается со своего места на спирали и по кругу уходит в глаз
    function flyPos(d, ft) {
      var Ls = lights[d], r0 = Math.hypot(Ls.x - cx, (Ls.y - cy) / 0.82), a0 = Math.atan2((Ls.y - cy) / 0.82, Ls.x - cx);
      var e = ft * ft * (3 - 2 * ft), rr = r0 * (1 - e) + 0.5, fa = a0 + e * 3.4; return [cx + Math.cos(fa) * rr, cy + Math.sin(fa) * rr * 0.82];
    }
    // «Увидимся за поворотом…» — по хвосту нити, буквы встают на неё по мере того, как нить раскрывается; в конце — куб Метатрона (её звёздочка, 13.11)
    function fwDraw(al, prog, runU) {
      var txt = T('farewell') || '', px = FWPX(), ff = '"Cormorant Garamond",Georgia,serif', pts = [], S = 0, u, p, pv = null, k;
      for (u = FW_U0; u <= 12 + CONT - 0.15; u += 0.03) { p = figPos(u); if (pv) S += Math.sqrt((p.x - pv.x) * (p.x - pv.x) + (p.y - pv.y) * (p.y - pv.y)); pts.push({ x: p.x, y: p.y, s: S, u: u }); pv = p; }
      function at(s) {
        var i = 1; while (i < pts.length - 1 && pts[i].s < s) i++;
        var A = pts[i - 1], B = pts[i], f = Math.max(0, Math.min(1, (s - A.s) / ((B.s - A.s) || 1)));
        return { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f, r: Math.atan2(B.y - A.y, B.x - A.x), u: A.u + (B.u - A.u) * f };
      }
      fx.save(); fx.font = 'italic ' + px + 'px ' + ff;
      var sp = px * 0.03, ws = [], tw = 0;
      for (k = 0; k < txt.length; k++) { ws.push(fx.measureText(txt[k]).width + sp); tw += ws[k]; }
      var cubeR = px * 0.62, need = tw + px * 0.5 + cubeR * 2;
      if (need > S * 0.97) { var sc = S * 0.97 / need; px *= sc; sp *= sc; cubeR *= sc; tw *= sc; for (k = 0; k < ws.length; k++) ws[k] *= sc; fx.font = 'italic ' + px + 'px ' + ff; }
      var off = px * 0.32, s0 = Math.max(0, (S - (tw + px * 0.5 + cubeR * 2)) * 0.12), s = s0, n = txt.length;
      fx.fillStyle = '#cfe2ff'; fx.textAlign = 'center'; fx.textBaseline = 'alphabetic';
      fx.shadowColor = 'rgba(95,157,255,.6)'; fx.shadowBlur = 12;
      for (k = 0; k < n; k++) {
        var la = Math.max(0, Math.min(1, prog * (n + 6) - k));
        if (la > 0) {
          var P = at(s + ws[k] / 2);
          fx.save(); fx.globalAlpha = al * Math.min(1, la); fx.translate(P.x, P.y); fx.rotate(P.r); fx.fillText(txt[k], 0, -off); fx.restore();
        }
        s += ws[k];
      }
      fx.restore();
      // куб Метатрона: 13 кругов (как 13 дней) и линии между всеми их центрами; тихо сияет и медленно поворачивается, вспыхивает, когда до него добегает огонёк
      cubeA += ((prog >= 1 ? 1 : 0) - cubeA) * 0.02;
      if (cubeA < 0.01) return;
      var C = at(s + px * 0.5 + cubeR), nx = Math.sin(C.r), ny = -Math.cos(C.r), cxk = C.x + nx * (off + px * 0.3), cyk = C.y + ny * (off + px * 0.3);
      var fl = Math.exp(-(runU - C.u) * (runU - C.u) / 0.4), pulse = 0.5 + 0.5 * Math.sin(time * 1.05);
      starDot(cxk, cyk, cubeR * (0.55 + 0.15 * pulse + 0.35 * fl), 'rgba(150,190,255,.55)', al * cubeA * (0.55 + 0.45 * pulse));
      var r0 = cubeR / 5, rot = reduce ? 0 : time * 0.12, c = [[0, 0]], j, q;
      for (j = 0; j < 6; j++) { var a = rot + j * Math.PI / 3 - Math.PI / 2; c.push([Math.cos(a) * 2 * r0, Math.sin(a) * 2 * r0]); }
      for (j = 0; j < 6; j++) { var b = rot + j * Math.PI / 3 - Math.PI / 2; c.push([Math.cos(b) * 4 * r0, Math.sin(b) * 4 * r0]); }
      fx.save(); fx.translate(cxk, cyk); fx.globalAlpha = al * cubeA * (0.75 + 0.25 * pulse + 0.3 * fl);
      fx.strokeStyle = '#eef5ff'; fx.shadowColor = 'rgba(150,190,255,.95)'; fx.shadowBlur = 4; fx.lineCap = 'round';
      fx.lineWidth = 0.55; fx.globalAlpha *= 0.6; fx.beginPath();
      for (j = 0; j < 13; j++) for (q = j + 1; q < 13; q++) { fx.moveTo(c[j][0], c[j][1]); fx.lineTo(c[q][0], c[q][1]); }
      fx.stroke(); fx.globalAlpha /= 0.6;
      fx.lineWidth = 0.7; fx.beginPath();
      for (j = 0; j < 13; j++) { fx.moveTo(c[j][0] + r0, c[j][1]); fx.arc(c[j][0], c[j][1], r0, 0, 6.2832); }
      fx.stroke(); fx.restore();
    }
    function hexA(h) { var v = parseInt(h.slice(1), 16); return (v >> 16 & 255) + ',' + (v >> 8 & 255) + ',' + (v & 255); }
    // огонёк одного цвета: плотная середина и мягкий ореол того же цвета
    function glow(x, y, pr, c, al) {
      var t = hexA(c); fx.save(); fx.globalAlpha *= al;
      var gg = fx.createRadialGradient(x, y, 0, x, y, pr * 3.2);
      gg.addColorStop(0, 'rgba(' + t + ',1)'); gg.addColorStop(0.25, 'rgba(' + t + ',0.75)'); gg.addColorStop(0.55, 'rgba(' + t + ',0.22)'); gg.addColorStop(1, 'rgba(' + t + ',0)');
      fx.fillStyle = gg; fx.beginPath(); fx.arc(x, y, pr * 3.2, 0, 6.29); fx.fill(); fx.restore();
    }
    function starDot(x, y, pr, c, al) {
      fx.save(); fx.globalAlpha *= al;
      var gg = fx.createRadialGradient(x, y, 0, x, y, pr * 4); gg.addColorStop(0, c); gg.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = gg; fx.beginPath(); fx.arc(x, y, pr * 4, 0, 6.29); fx.fill();
      fx.fillStyle = '#fff'; fx.beginPath(); fx.arc(x, y, pr * 0.45, 0, 6.29); fx.fill(); fx.restore();
    }

    // Звук: по кнопке. Своя запись из панели (WAVE.soundFile) — по кругу; нет — ветер рождается в браузере (шум + фильтр).
    // Громкость идёт за бурей: стихает, когда дышат, и почти замирает в финале.
    var AC = null, nGain, bp, lp, windOn = false, FILE = str(WAVE.soundFile);
    var wbtn = document.getElementById('gb-wind');
    if (FILE && !/^(data:|blob:|https?:)/.test(FILE)) FILE = BASE + FILE;
    wbtn.addEventListener('click', function () {
      if (!AC) {
        try {
          AC = new (window.AudioContext || window.webkitAudioContext)();
          nGain = AC.createGain(); nGain.gain.value = 0; nGain.connect(AC.destination);
          if (FILE) {
            fetch(FILE).then(function (r) { return r.arrayBuffer(); }).then(function (ab) {
              return new Promise(function (ok, no) { AC.decodeAudioData(ab, ok, no); });
            }).then(function (buf) { var s = AC.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(nGain); s.start(); })
              .catch(function () { wbtn.textContent = 'Звук недоступен'; });
          } else {
            var len = AC.sampleRate * 3, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0), b = 0;
            for (var k = 0; k < len; k++) { b = (b + 0.04 * (Math.random() * 2 - 1)) / 1.04; d[k] = b * 3.2; }
            var src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
            bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9; bp.frequency.value = 500;
            lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
            src.connect(bp); bp.connect(lp); lp.connect(nGain); src.start();
          }
        } catch (e) { wbtn.textContent = 'Звук недоступен'; return; }
      }
      windOn = !windOn; if (AC.state === 'suspended') AC.resume();
      wbtn.classList.toggle('on', windOn); wbtn.setAttribute('aria-pressed', windOn); wbtn.textContent = windOn ? T('windOff') : T('wind');
    });
    function wind() {
      if (!AC) return; var t = AC.currentTime, lvl = Math.max(0, (1 - calm * 0.85) + boost * 0.8) * (1 - still * 0.9);
      var sway = Math.sin(time * 0.37) * 0.5 + Math.sin(time * 0.13) * 0.5;
      if (FILE) { nGain.gain.setTargetAtTime(windOn ? 0.25 + 0.65 * Math.min(1, lvl) : 0, t, 0.5); return; }
      nGain.gain.setTargetAtTime(windOn ? (0.05 + 0.13 * lvl) * (0.8 + 0.2 * sway) : 0, t, 0.4);
      bp.frequency.setTargetAtTime(260 + 380 * lvl + 140 * sway, t, 0.5);
    }

    // касания: держишь глаз — дышишь
    function onEye(x, y) { return Math.hypot(x - cx, y - cy) < eyeR * 1.7; }
    fc.addEventListener('pointerdown', function (e) {
      if (state === 'card' || state === 'sign' || state === 'final') return;
      if (!onEye(e.clientX, e.clientY)) return;
      try { fc.setPointerCapture(e.pointerId); } catch (_) {}
      clearTimeout(hintTimer); state = 'breath'; holdT = 0;
    });
    function release() {
      if (state !== 'breath') return;
      state = 'idle';
      if (rest()) { setHint(T('again')); return; }   // карта сегодня уже была — просто подышали вместе с бурей
      if (holdT < 2.5) { setHint(T('short')); hintTimer = setTimeout(function () { if (state === 'idle') setHint(idleHint()); }, 3200); return; }
      state = 'sign'; signT = 0; trail = []; setHint('');
    }
    fc.addEventListener('pointerup', release); fc.addEventListener('pointercancel', release);
    fc.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    function put(idn, t) { var e = document.getElementById(idn); e.textContent = t; e.style.display = t ? '' : 'none'; }
    function fillCard(k) {
      var d = DAYS[k];
      put('gb-cDay', fill(T('cardDay'), { n: k + 1, date: dateOf(k) }));
      put('gb-cKin', d.kin || d.name ? fill(T('cardKin'), { kin: d.kin, name: d.name }).replace(/^[\s·]+|[\s·]+$/g, '') : '');
      document.getElementById('gb-cDot').style.color = COL[d.c];
      put('gb-cWord', d.w);
      put('gb-cTone', d.t ? fill(T('cardTone'), { n: k + 1, tone: d.t }) : '');
      put('gb-cQ', d.q);
      put('gb-cText', d.text);
    }
    // карта засчитывается, когда её показали: закрыл страницу раньше — в тот же день откроется снова
    function openCard() {
      state = 'card'; fillCard(sel); got[sel] = 1; saveGot(); marks();
      card.classList.add('open'); setTimeout(function () { try { document.getElementById('gb-back').focus({ preventScroll: true }); } catch (e) {} }, 900);
    }
    document.getElementById('gb-back').addEventListener('click', function () {
      card.classList.remove('open'); setHint('');
      // 13-й день: после его карты — финал
      if (sel === 12 && !finished) { state = 'final'; finT = 0; ftr = []; runT0 = null; return; }
      state = 'rain'; rainT = RAIN; dropAcc = 0;
    });

    // проверка (?debug=1): кружки дней и «↺ звёзды» — посетители их не видят
    var daysNav = document.getElementById('gb-days');
    function marks() {
      if (!daysNav) return;
      [].forEach.call(daysNav.querySelectorAll('button:not(.reset)'), function (b, j) { b.classList.toggle('on', j === sel && phase === 'wave'); b.classList.toggle('got', !!got[j]); });
    }
    if (daysNav) {
      DAYS.forEach(function (_, k) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = k + 1; b.setAttribute('aria-label', 'День ' + (k + 1));
        b.addEventListener('click', function () {
          if (state === 'card') card.classList.remove('open');
          state = 'idle'; sel = k; phase = 'wave'; finished = !!(k === 12 && got.fin); if (!finished) still = 0; sub(); marks(); setHint(idleHint());
        });
        daysNav.appendChild(b);
      });
      var rs = document.createElement('button'); rs.type = 'button'; rs.className = 'reset'; rs.textContent = '↺ звёзды';
      rs.addEventListener('click', function () { got = {}; finished = false; still = 0; saveGot(); marks(); setHint(idleHint()); });
      daysNav.appendChild(rs);
    }
    sub(); marks(); setHint(idleHint());
    addEventListener('resize', resize); resize(); requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
