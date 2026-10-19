/* 13 MIRRORS · колесо даты «Узнать свой кин» — window.M13KINW (19.10.2026, docs/kin.md, «Колесо даты»).
   Перенос пробы docs/kin-koleso-proba.tpl.html (заход 2 и правки). Её решение «делаем»: все варианты остаются, выбор — в панели
   (reflection.kin.wheel: материал, щелчок, звук «Открыть», вид Цолькина, 52 портала, переключатель вида у участника).
   Колесо-сейф: три кольца (год 1950 — нынешний / месяц / день) поворачиваются пальцем под неподвижной стрелкой, на каждом делении щелчок;
   в середине дата и «Открыть» → 260 точек перелетают в Цолькин, кин человека светится, любую точку можно нажать.
   Сам расчёт кина и тексты результата — на витрине (vitrina.js, «СВОЙ КИН»); здесь только колесо и Цолькин.
   Ничего не отправляет и не хранит, кроме «звук выкл» на самом устройстве (localStorage m13kinSnd). */
(function () {
  'use strict';
  var TAU = Math.PI * 2, Y0 = 1950, DAY = 864e5;
  var MON = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  var MONF = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var MONN = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  var COL = ['#e0533d', '#f2efe6', '#4a86de', '#f2c62e'], GOLD = '#f0d68c', PORT = '#5fd39a';
  var SERIF = '"Cormorant Garamond", Georgia, "Times New Roman", serif', SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  // 52 портала (постоянные, без описаний)
  var GAP = [1, 20, 22, 39, 43, 50, 51, 58, 64, 69, 72, 77, 85, 88, 93, 96, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115,
    146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 165, 168, 173, 176, 184, 189, 192, 197, 203, 210, 211, 218, 222, 239, 241, 260];
  var isGap = {}; GAP.forEach(function (k) { isGap[k] = 1; });

  // Материалы колеса: тёмный / средний / светлый край металла, блик, цвет надписей и их тень, окошко-стрелка, утопленная середина
  var MATS = {
    bronze: { lo: '#3a2213', mid: '#8c5a2c', hi: '#e2ad72', sheen: 'rgba(255,226,180,.42)', ink: '#fdebd2', inkSh: 'rgba(30,14,4,.85)', dim: 'rgba(253,235,210,.22)', win: '#ffe1a6', well: '#120b08' },
    gold: { lo: '#5e4914', mid: '#b08f33', hi: '#f6e39a', sheen: 'rgba(255,250,215,.5)', ink: '#2a2005', inkSh: 'rgba(255,246,210,.55)', dim: 'rgba(42,32,5,.25)', win: '#fff3c4', well: '#14100a' },
    silver: { lo: '#4c5262', mid: '#9ba4b6', hi: '#f0f3f8', sheen: 'rgba(255,255,255,.55)', ink: '#1c2130', inkSh: 'rgba(255,255,255,.5)', dim: 'rgba(28,33,48,.25)', win: '#ffffff', well: '#0e0f18' },
    glass: { lo: 'rgba(70,80,170,.30)', mid: 'rgba(140,150,235,.20)', hi: 'rgba(235,235,255,.38)', sheen: 'rgba(255,255,255,.45)', ink: '#eef0ff', inkSh: 'rgba(10,10,40,.7)', dim: 'rgba(238,240,255,.2)', win: '#ffffff', well: 'rgba(8,8,24,.6)' }
  };
  var CLKS = { safe: 1, wood: 1, soft: 1 }, OPNS = { lock: 1, bowl: 1, flow: 1 }, LAYS = { waves: 1, spiral: 1, grid: 1 };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- звук: общий на все колёса страницы ---------- */
  var sound = true, ac = null, noise = null;
  try { sound = localStorage.getItem('m13kinSnd') !== '0'; } catch (e) {}
  function audio() {
    if (!sound) return null;
    try {
      if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        noise = ac.createBuffer(1, ac.sampleRate * .3, ac.sampleRate);
        var d = noise.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    } catch (e) { return null; }
  }
  function burst(t, type, f, q, g, dur) {
    var s = ac.createBufferSource(), fl = ac.createBiquadFilter(), gn = ac.createGain();
    s.buffer = noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl); fl.connect(gn); gn.connect(ac.destination); s.start(t, Math.random() * .2); s.stop(t + dur + .01);
  }
  function tone(t, f, g, dur, type) {
    var o = ac.createOscillator(), gn = ac.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * .7, t + dur);
    gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + .002); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + dur + .02);
  }
  // колокольчик: основной тон + неровные обертоны, долгое затухание, высота не плывёт
  function bell(t, f, g, dur) {
    [[1, 1], [2.76, .35], [5.4, .12]].forEach(function (h) {
      var o = ac.createOscillator(), gn = ac.createGain(); o.frequency.value = f * h[0];
      gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(g * h[1], t + .006);
      gn.gain.exponentialRampToValueAtTime(.0001, t + dur / h[0] * 1.4);
      o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + dur * 1.5);
    });
  }
  function buzz(p) { if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }
  // щелчок на делении; hv — тяжелее (десятилетие, январь, 1-е число)
  function click(kind, hv) {
    buzz(hv ? 16 : 6);
    if (!audio()) return;
    var t = ac.currentTime;
    if (kind === 'wood') { burst(t, 'bandpass', hv ? 1000 : 1500, 3, hv ? .8 : .5, hv ? .03 : .02); tone(t, hv ? 300 : 440, hv ? .25 : .14, .03, 'triangle'); }
    else if (kind === 'soft') burst(t, 'lowpass', hv ? 600 : 800, 1, hv ? .5 : .3, hv ? .04 : .025);
    else {
      burst(t, 'bandpass', hv ? 2600 : 3600, 5, hv ? .9 : .55, hv ? .02 : .012); tone(t, hv ? 120 : 190, hv ? .35 : .16, hv ? .06 : .03);
      if (hv) burst(t + .022, 'bandpass', 4200, 6, .25, .01);
    }
  }
  // «Открыть»: два щелчка замка и звон — замок и звон / поющая чаша / перелив 13 колокольчиков
  function lockSound(kind) {
    buzz([12, 60, 12, 90, 40]);
    if (!audio()) return;
    var t = ac.currentTime;
    burst(t, 'bandpass', 2600, 5, .8, .02); tone(t, 140, .3, .05);
    burst(t + .09, 'bandpass', 2400, 5, .8, .02); tone(t + .09, 130, .3, .05);
    if (kind === 'bowl') { tone(t + .2, 90, .35, .25); bell(t + .26, 392, .11, 4.5); return; }
    if (kind === 'flow') {
      // 13 тихих колокольчиков снизу вверх (пентатоника) — как 13 тонов волны
      var PEN = [0, 2, 4, 7, 9];
      for (var i = 0; i < 13; i++) bell(t + .22 + i * .075, 392 * Math.pow(2, (PEN[i % 5] + 12 * Math.floor(i / 5)) / 12), .045, 1.4);
      return;
    }
    tone(t + .21, 70, .6, .3); bell(t + .24, 660, .06, 1.6); bell(t + .24, 990, .035, 1.2);
  }
  // нажатие на кин в Цолькине — тихое стеклянное «тинь», не щелчок сейфа
  function tink() { buzz(5); if (audio()) bell(ac.currentTime, 1568, .05, .5); }
  var sndBtns = [];
  function sndUI() {
    sndBtns.forEach(function (b) {
      b.textContent = sound ? '🔊' : '🔇'; b.setAttribute('aria-pressed', sound ? 'false' : 'true');
      b.title = sound ? 'Выключить звук щелчков' : 'Включить звук щелчков';
    });
  }

  /* ---------- 260 точек: раскладки ---------- */
  var SPIRAL = (function () {
    var out = [], th = 0, r;
    while (out.length < 260) { r = 14 + th * 10.5; out.push([r, th]); th += 6.6 / r; }
    var mx = out[259][0];
    return out.map(function (p) { return [p[0] / mx * .95, p[1]]; });
  })();
  function sealCol(k) { return COL[((k - 1) % 20) % 4]; }
  function waveCol(k) { return COL[Math.floor((k - 1) / 13) % 4]; }
  // [радиус (доля), угол, цвет]; ring — тонкое кольцо в середине колеса, медленно идёт против часовой
  function layout(name, k, now) {
    var w, t, i;
    if (name === 'ring') { w = Math.floor((k - 1) / 13); return [.345, (k - 1 + w * 1.4) / (260 + 20 * 1.4) * TAU - (reduce ? 0 : now / 60000), sealCol(k)]; }
    if (name === 'waves') { w = Math.floor((k - 1) / 13); t = (k - 1) % 13; return [.25 + t * .058, w / 20 * TAU, waveCol(k)]; }
    if (name === 'grid') { i = (k - 1) % 20; t = Math.floor((k - 1) / 20); return [.25 + t * .058, i / 20 * TAU, sealCol(k)]; }
    return [SPIRAL[k - 1][0], SPIRAL[k - 1][1], sealCol(k)];
  }
  function hex(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  function mix(a, b, t) { var x = hex(a), y = hex(b); return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(x[i] + (y[i] - x[i]) * t); }).join(',') + ')'; }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function wrapPi(a) { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; }
  function daysIn(y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- даты (для карточки любого кина) ---------- */
  function isoOf(y, m, d) { return y + '-' + ('0' + (m + 1)).slice(-2) + '-' + ('0' + d).slice(-2); }
  function addIso(iso, n) { return new Date(Date.parse(iso + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10); }
  function todayIso() { if (window.M13_TODAY) return window.M13_TODAY; var d = new Date(); return isoOf(d.getFullYear(), d.getMonth(), d.getDate()); }
  function niceIso(iso) { var p = iso.split('-'); return +p[2] + ' ' + MONF[+p[1] - 1] + ' ' + p[0]; }
  function shortIso(iso) { var p = iso.split('-'); return p[2] + '.' + p[1]; }

  /* ================= одно колесо =================
     box — пустой элемент; o: { mat, clk, opn, lay, portals, laySwitch, T(ключ) — текст, onOpen(iso) — нажали «Открыть»,
     waveTitle(отIso, название по первому дню) — название волны (маршрут из «Маршрутов», если есть),
     look — цвета месяца { ink, mut, gold, light } (пусто — ночной круг, как было) }.
     Возвращает { setDate(iso), reveal(кины), reset(), pick(кин), wait(текст подсказки) }. */
  function mount(box, o) {
    var K = window.M13KIN, T = o.T || function () { return ''; };
    var Y1 = Math.max(new Date().getFullYear(), Y0 + 10), NY = Y1 - Y0 + 1;
    box.innerHTML = '<p class="m13-kw-hint" aria-live="polite"></p>' +
      '<div class="m13-kw-stage"><canvas class="m13-kw-cv" role="img" aria-label="Колесо даты рождения: внешнее кольцо — год, среднее — месяц, внутреннее — день; стрелка наверху показывает выбранное"></canvas>' +
      '<button type="button" class="m13-kw-snd"></button><div class="m13-kw-ctr"></div></div>' +
      (o.laySwitch ? '<div class="m13-kw-lays" hidden>' + [['waves', 'wLayWaves'], ['spiral', 'wLaySpiral'], ['grid', 'wLayGrid']].map(function (x) {
        return '<button type="button" class="m13-kw-pill" data-lay="' + x[0] + '">' + esc(T(x[1])) + '</button>'; }).join('') + '</div>' : '') +
      '<div class="m13-kw-pick" hidden></div><div class="m13-kw-legend" hidden></div>';
    var cv = box.querySelector('canvas'), ctx = cv.getContext('2d'), hintEl = box.querySelector('.m13-kw-hint'), ctr = box.querySelector('.m13-kw-ctr'),
      pickEl = box.querySelector('.m13-kw-pick'), legEl = box.querySelector('.m13-kw-legend'), laysEl = box.querySelector('.m13-kw-lays'), snd = box.querySelector('.m13-kw-snd');

    // Кольца: n значений, slots делений по кругу (у лет 2 пустых у макушки), off — с какого деления начинаются значения
    var RING = {
      y: { n: NY, slots: NY + 2, off: 1, rIn: .755, rOut: .905 },
      m: { n: 12, slots: 12, off: 0, rIn: .595, rOut: .74 },
      d: { n: 31, slots: 31, off: 0, rIn: .435, rOut: .58 }
    };
    ['y', 'm', 'd'].forEach(function (k) { var r = RING[k]; r.rot = 0; r.vel = 0; r.target = null; r.val = -1; r.set = false; r.drag = false; r.step = TAU / r.slots; });
    var st = { mat: MATS[o.mat] ? o.mat : 'bronze', clk: CLKS[o.clk] ? o.clk : 'safe', opn: OPNS[o.opn] ? o.opn : 'lock', lay: LAYS[o.lay] ? o.lay : 'waves',
      portals: o.portals !== false, from: null, morph: 1, open: 0, openTo: 0, mine: [], pick: null, sealW: {}, nowW: -1, pos: [], dpr: 1, S: 300,
      live: '', liveT: 0, wait: '', run: false, seen: true };
    var bumpT = {};
    // цвета месяца: надписи и золото на фоне круга; на светлом фоне белые печати темнее, свой кин — в круге цвета надписей
    var LK = o.look || {}, GD = LK.gold || GOLD, MUT = LK.mut || 'rgb(165,157,194)', MINE = LK.light ? (LK.ink || '#2b2620') : '#fff';
    function dotCol(c) { return LK.light && c === COL[1] ? '#bab1a1' : c; }

    function resize() {
      var r = cv.getBoundingClientRect(); if (!r.width) return;
      st.dpr = Math.min(window.devicePixelRatio || 1, 2.5); st.S = r.width;
      cv.width = Math.round(r.width * st.dpr); cv.height = Math.round(r.width * st.dpr);
    }
    function P(r, a) { var C = st.S / 2; return [C + r * C * Math.sin(a), C - r * C * Math.cos(a)]; }

    /* ---------- значения колец ---------- */
    function yearOf() { return Y0 + RING.y.val; }
    function maxIdx(k) { return k === 'd' ? daysIn(yearOf(), RING.m.val < 0 ? 0 : RING.m.val) - 1 : RING[k].n - 1; }
    // какое значение сейчас под стрелкой (стрелка — наверху)
    function under(k) {
      var r = RING[k], s = Math.round(-r.rot / r.step - .5), i;
      s = ((s % r.slots) + r.slots) % r.slots; i = s - r.off;
      return Math.max(0, Math.min(maxIdx(k), i));
    }
    function rotFor(k, i) { var r = RING[k], t = -(i + r.off + .5) * r.step; return r.rot + wrapPi(t - r.rot); }
    function heavy(k, i) { return k === 'y' ? (Y0 + i) % 10 === 0 : i === 0; }
    function label(k, i) { return k === 'y' ? String(Y0 + i) : k === 'm' ? MONN[i] : String(i + 1); }
    function check(k) {
      var v = under(k), r = RING[k];
      if (v === r.val) return;
      var first = r.val < 0; r.val = v;
      if (!first) { click(st.clk, heavy(k, v)); bumpT[k] = performance.now(); st.live = label(k, v); st.liveT = performance.now(); }
      if (k !== 'd') check('d');
      center();
    }
    function bump(k) { var b = bumpT[k]; if (!b) return 0; var t = (performance.now() - b) / 140; return t >= 1 ? 0 : Math.sin(t * Math.PI); }

    /* ---------- рисование колеса ---------- */
    function annulus(rIn, rOut) { var C = st.S / 2; ctx.beginPath(); ctx.arc(C, C, rOut * C, 0, TAU); ctx.arc(C, C, rIn * C, 0, TAU, true); }
    function txt(s, x, y, size, color, weight, font, sh) {
      ctx.font = (weight || '400') + ' ' + size + 'px ' + (font || SANS);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (sh) { ctx.fillStyle = sh; ctx.fillText(s, x, y + size * .08 + .4); }
      ctx.fillStyle = color; ctx.fillText(s, x, y);
    }
    function ringBody(k, M, f) {
      var r = RING[k], C = st.S / 2, ro = r.rOut * C;
      // тень под кольцом — кольца как ступеньки
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 12 * f; ctx.shadowOffsetY = 5 * f;
      annulus(r.rIn, r.rOut); ctx.fillStyle = M.mid; ctx.fill(); ctx.restore();
      // металл: свет слева сверху
      var g = ctx.createLinearGradient(C - ro * .75, C - ro * .75, C + ro * .75, C + ro * .75);
      g.addColorStop(0, M.hi); g.addColorStop(.5, M.mid); g.addColorStop(1, M.lo);
      annulus(r.rIn, r.rOut); ctx.fillStyle = g; ctx.fill();
      // блик точёного металла — стоит на месте, пока кольцо вращается
      if (ctx.createConicGradient) {
        var c = ctx.createConicGradient(-Math.PI / 2 - .7, C, C);
        c.addColorStop(0, 'rgba(255,255,255,0)'); c.addColorStop(.07, M.sheen); c.addColorStop(.16, 'rgba(255,255,255,0)');
        c.addColorStop(.45, 'rgba(0,0,0,.16)'); c.addColorStop(.57, M.sheen); c.addColorStop(.64, 'rgba(255,255,255,0)'); c.addColorStop(1, 'rgba(255,255,255,0)');
        annulus(r.rIn, r.rOut); ctx.fillStyle = c; ctx.fill();
      }
      // фаска: внешний край светлый сверху, внутренний — тёмный сверху
      function edge(rr, light) {
        var gg = ctx.createLinearGradient(0, C - rr * C, 0, C + rr * C);
        gg.addColorStop(0, light ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.55)'); gg.addColorStop(1, light ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.35)');
        ctx.beginPath(); ctx.arc(C, C, rr * C, 0, TAU); ctx.strokeStyle = gg; ctx.lineWidth = 1.3 * f; ctx.stroke();
      }
      edge(r.rOut - .004, true); edge(r.rIn + .004, false);
    }
    function drawWheel(f, fx, M) {
      var C = st.S / 2, i, a, p, q;
      // утопленная середина
      var wg = ctx.createRadialGradient(C, C - C * .05, C * .05, C, C, C * .44);
      wg.addColorStop(0, M.well); wg.addColorStop(.85, M.well); wg.addColorStop(1, 'rgba(0,0,0,.9)');
      ctx.beginPath(); ctx.arc(C, C, C * .44, 0, TAU); ctx.fillStyle = wg; ctx.fill();
      ['y', 'm', 'd'].forEach(function (k) { ringBody(k, M, f); });

      // годы: насечки по краю, черточки, десятилетия подписаны
      var Y = RING.y;
      for (i = 0; i < 150; i++) {
        a = i / 150 * TAU + Y.rot; p = P(Y.rOut - .002, a); q = P(Y.rOut - .02, a);
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.strokeStyle = M.inkSh; ctx.lineWidth = .9 * f; ctx.stroke();
      }
      for (i = 0; i < NY; i++) {
        var yr = Y0 + i, dec = yr % 10 === 0; a = (i + Y.off + .5) * Y.step + Y.rot;
        p = P(dec ? .775 : .79, a); q = P(dec ? .845 : .825, a);
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.lineWidth = (dec ? 1.8 : 1) * f; ctx.strokeStyle = M.ink; ctx.stroke();
        if (dec && Math.abs(wrapPi(a)) > .2) { p = P(.868, a); txt(String(yr), p[0], p[1], 9.5 * fx, M.ink, '500', 0, M.inkSh); }
      }
      // месяцы и дни — поворачиваются со своим кольцом; лишние дни короткого месяца гаснут
      var Mr = RING.m, D = RING.d, dmax = maxIdx('d');
      for (i = 0; i < 12; i++) {
        a = (i + .5) * Mr.step + Mr.rot; p = P(.667, a);
        txt(MON[i], p[0], p[1], 12.5 * fx, M.ink, '500', 0, M.inkSh);
        q = P(.6, a + Mr.step / 2); p = P(.625, a + Mr.step / 2);
        ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(p[0], p[1]); ctx.strokeStyle = M.dim; ctx.lineWidth = f; ctx.stroke();
      }
      for (i = 0; i < 31; i++) {
        a = (i + .5) * D.step + D.rot; p = P(.508, a);
        txt(String(i + 1), p[0], p[1], 10 * fx, i <= dmax ? M.ink : M.dim, '500', 0, i <= dmax ? M.inkSh : 0);
      }
      // окошко-стрелка наверху: неподвижно, кольца едут под ним
      var w = .07 * C, top = C - .93 * C, bot = C - .425 * C;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(C - w, bot); ctx.lineTo(C - w * 1.25, top); ctx.lineTo(C + w * 1.25, top); ctx.lineTo(C + w, bot); ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill(); ctx.strokeStyle = M.win; ctx.globalAlpha = .75; ctx.lineWidth = 1.2 * f; ctx.stroke();
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(C - 7 * f, top - 9 * f); ctx.lineTo(C + 7 * f, top - 9 * f); ctx.lineTo(C, top - 1 * f); ctx.closePath();
      ctx.fillStyle = M.win; ctx.fill();
      // значения под окошком — крупно, светятся, когда кольцо выбрано
      [['y', .83, 13], ['m', .667, 13.5], ['d', .508, 12]].forEach(function (x) {
        var k = x[0], r = RING[k], s = 1 + .22 * bump(k), v = r.val < 0 ? under(k) : r.val;
        var t = k === 'y' ? String(Y0 + v) : k === 'm' ? MON[v] : String(v + 1);
        p = P(x[1], 0);
        ctx.save(); ctx.shadowColor = r.set ? 'rgba(255,230,160,.9)' : 'rgba(0,0,0,0)'; ctx.shadowBlur = 10 * f;
        ctx.beginPath(); ctx.ellipse(p[0], p[1], w * (k === 'y' ? 1.22 : .98), x[2] * fx * .95, 0, 0, TAU);
        ctx.fillStyle = r.set ? 'rgba(20,14,30,.82)' : 'rgba(20,14,30,.55)'; ctx.fill(); ctx.restore();
        txt(t, p[0], p[1], x[2] * fx * s, r.set ? GOLD : 'rgba(236,230,247,.75)', '500');
      });
    }

    /* ---------- кадр ---------- */
    var lastT = performance.now();
    function frame(now) {
      if (!box.isConnected) { st.run = false; window.removeEventListener('resize', resize); return; }
      if (!st.seen) { st.run = false; return; }
      if (!cv.width || Math.abs(cv.getBoundingClientRect().width - st.S) > .5) resize();
      var S = st.S, C = S / 2, f = C / 190, fx = Math.max(f, .86), k, dt = Math.min(50, now - lastT); lastT = now;
      ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); ctx.clearRect(0, 0, S, S);
      // инерция и доводка колец
      ['y', 'm', 'd'].forEach(function (key) {
        var r = RING[key];
        if (r.drag) return;
        if (r.target != null) {
          r.rot += (r.target - r.rot) * Math.min(1, dt / 70);
          if (Math.abs(r.target - r.rot) < .0006) { r.rot = r.target; r.target = null; }
          check(key);
        } else if (r.vel) {
          r.rot += r.vel * dt; r.vel *= Math.pow(.9935, dt);
          check(key);
          if (Math.abs(r.vel) < .00012) { r.vel = 0; r.target = rotFor(key, under(key)); }
        }
      });
      var sp = reduce ? 4 : 1;
      if (st.open < st.openTo) st.open = Math.min(1, st.open + dt / 1300 * sp);
      if (st.open > st.openTo) st.open = Math.max(0, st.open - dt / 900 * sp);
      if (st.morph < 1) st.morph = Math.min(1, st.morph + dt / 1200 * sp);
      var op = ease(st.open), wheelA = Math.max(0, 1 - op * 1.8), M = MATS[st.mat];

      if (wheelA > 0) {
        ctx.save(); ctx.globalAlpha = wheelA;
        var sc = 1 + op * .25; ctx.translate(C, C); ctx.scale(sc, sc); ctx.translate(-C, -C);
        drawWheel(f, fx, M); ctx.restore();
      }

      // 260 точек: в середине колеса мерцают и медленно идут против часовой; после «Открыть» перелетают в Цолькин
      var mine = {}; st.mine.forEach(function (m) { mine[m] = 1; });
      var tm = ease(st.morph), tpo = st.portals ? op : 0, pw = st.pick ? Math.floor((st.pick - 1) / 13) : -1;
      for (k = 1; k <= 260; k++) {
        var d0 = reduce ? 0 : ((k * 37) % 260) / 260 * .35, ok = Math.max(0, Math.min(1, (op - d0) / .65)), e = ease(ok);
        var l0 = layout('ring', k, now), l1 = layout(st.lay, k, now);
        if (st.morph < 1 && st.from) { var lf = layout(st.from, k, now); l1 = [lf[0] + (l1[0] - lf[0]) * tm, lf[1] + (l1[1] - lf[1]) * tm, l1[2]]; }
        var pa = P(l0[0], l0[1]), pb = P(l1[0], l1[1]), x = pa[0] + (pb[0] - pa[0]) * e, y = pa[1] + (pb[1] - pa[1]) * e;
        st.pos[k] = [x, y];
        var col = mix(dotCol(l0[2]), dotCol(l1[2]), e); if (isGap[k] && tpo > 0) col = mix(l0[2], PORT, tpo);
        var inW = Math.floor((k - 1) / 13), al = op < .02 ? (reduce ? .7 : .5 + .4 * Math.sin(now / 700 + k * .45)) : (pw >= 0 && inW !== pw && !mine[k] ? .42 : .92);
        var rad = (op < .02 ? 1.05 : 1.1 + 1.6 * e) * f * (isGap[k] && tpo > .5 ? 1.2 : 1) * (pw === inW && op > .5 ? 1.25 : 1);
        // волна, что идёт сейчас, — обводка цвета надписей; ближайшая волна с печатью человека — золотая
        if (op > .5 && (st.sealW[inW] || inW === st.nowW)) {
          ctx.globalAlpha = (st.sealW[inW] ? .5 : .42) * op; ctx.beginPath(); ctx.arc(x, y, rad * 2.1, 0, TAU);
          ctx.strokeStyle = st.sealW[inW] ? GD : MINE; ctx.lineWidth = (st.sealW[inW] ? 1.3 : 1) * f; ctx.stroke();
          if (st.sealW[inW] && inW === st.nowW) { ctx.globalAlpha = .42 * op; ctx.beginPath(); ctx.arc(x, y, rad * 2.1 + 2.2 * f, 0, TAU); ctx.strokeStyle = MINE; ctx.lineWidth = f; ctx.stroke(); }
        }
        ctx.globalAlpha = al; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fillStyle = col; ctx.fill();
        if (mine[k] && op > 0) {
          var pulse = reduce ? 1 : 1 + .25 * Math.sin(now / 420);
          ctx.globalAlpha = .18 * op; ctx.beginPath(); ctx.arc(x, y, 14 * f * pulse, 0, TAU); ctx.fillStyle = MINE; ctx.fill();
          ctx.globalAlpha = op; ctx.beginPath(); ctx.arc(x, y, 7.5 * f, 0, TAU); ctx.strokeStyle = MINE; ctx.lineWidth = 1.5 * f; ctx.stroke();
        }
        if (st.pick === k && op > .5) {
          ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, 9 * f, 0, TAU); ctx.strokeStyle = GD; ctx.lineWidth = 2 * f; ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      if (op > .6 && st.lay !== 'spiral' && st.mine.length) {
        ctx.globalAlpha = (op - .6) / .4; var sk = st.pick || st.mine[0];
        txt('Kin', C, C - 10 * f, 12 * fx, MUT);
        txt(String(sk), C, C + 9 * f, 24 * fx, GD, '500', SERIF);
        ctx.globalAlpha = 1;
      }
      // середина с датой и «Открыть» после раскрытия убирается совсем — и для глаза, и для пальца
      ctr.style.opacity = String(wheelA); ctr.style.visibility = wheelA > 0 && !st.openTo ? '' : 'hidden';
      if (st.live && now - st.liveT > 900 && !anyDrag()) { st.live = ''; center(); }
      requestAnimationFrame(frame);
    }
    function anyDrag() { return RING.y.drag || RING.m.drag || RING.d.drag; }
    function go() { if (st.run || !st.seen) return; st.run = true; lastT = performance.now(); requestAnimationFrame(frame); }
    // Колесо не видно на экране — не рисуем (бережём батарейку)
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { st.seen = es[es.length - 1].isIntersecting; go(); }).observe(cv);

    /* ---------- середина: дата и «Открыть» ---------- */
    function allSet() { return RING.y.set && RING.m.set && RING.d.set; }
    function center() {
      var h = '';
      if (st.openTo) h = '';
      else if (st.live) h = '<div class="m13-kw-big">' + esc(st.live) + '</div>';
      else {
        var d = RING.d.set ? String(RING.d.val + 1) : '<i>··</i>', m = RING.m.set ? MONF[RING.m.val] : '<i>···</i>', y = RING.y.set ? String(yearOf()) : '<i>····</i>';
        h = '<div class="m13-kw-date">' + d + ' ' + m + '<br>' + y + '</div>' + (allSet() ? '<button class="m13-kw-open" type="button">' + esc(T('wOpen')) + '</button>' : '');
      }
      if (ctr.innerHTML !== h) {
        ctr.innerHTML = h;
        var b = ctr.querySelector('.m13-kw-open'); if (b) b.addEventListener('click', openIt);
      }
      hint();
    }
    function hint() {
      var t = st.openTo ? T(st.pick ? 'wHintPick' : 'wHintOpen') : st.wait ? st.wait :
        !RING.y.set ? T('wHintY') : !RING.m.set ? T('wHintM') : !RING.d.set ? T('wHintD') : T('wHintReady');
      if (hintEl.textContent !== t) hintEl.textContent = t;
    }
    function openIt() {
      var iso = isoOf(yearOf(), RING.m.val, RING.d.val + 1);
      if (o.onOpen) o.onOpen(iso);
    }

    /* ---------- палец по кольцу ---------- */
    function where(e) {
      var r = cv.getBoundingClientRect(), C = r.width / 2, dx = e.clientX - r.left - C, dy = e.clientY - r.top - C;
      var a = Math.atan2(dx, -dy); if (a < 0) a += TAU;
      return { rr: Math.sqrt(dx * dx + dy * dy) / C, a: a, x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function ringAt(rr) { return rr > .745 && rr < 1.02 ? 'y' : rr > .585 && rr <= .745 ? 'm' : rr > .4 && rr <= .585 ? 'd' : ''; }
    var drag = null;
    cv.addEventListener('pointerdown', function (e) {
      var w = where(e);
      if (st.openTo) { pickAt(w.x, w.y); return; }
      var k = ringAt(w.rr); if (!k) return;
      e.preventDefault(); e.stopPropagation(); try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      audio(); cv.classList.add('is-drag');
      var r = RING[k]; r.drag = true; r.vel = 0; r.target = null;
      drag = { k: k, a: w.a, t: performance.now(), moved: 0, x0: w.x, y0: w.y };
      st.wait = ''; go();
    });
    cv.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var w = where(e), r = RING[drag.k], da = wrapPi(w.a - drag.a), now = performance.now(), dt = Math.max(1, now - drag.t), dx = w.x - drag.x0, dy = w.y - drag.y0;
      r.rot += da; r.vel = r.vel * .6 + (da / dt) * .4; drag.a = w.a; drag.t = now;
      drag.moved = Math.max(drag.moved, Math.sqrt(dx * dx + dy * dy));
      check(drag.k);
    });
    function up(e) {
      if (!drag) return;
      var k = drag.k, r = RING[k], w = where(e);
      r.drag = false; cv.classList.remove('is-drag');
      if (drag.moved < 6) {
        // просто нажали на число — кольцо само подвезёт его под стрелку
        var s = Math.floor((w.a - r.rot) / r.step), i = (((s % r.slots) + r.slots) % r.slots) - r.off;
        i = Math.max(0, Math.min(maxIdx(k), i)); r.vel = 0; r.target = rotFor(k, i);
      } else if (reduce || performance.now() - drag.t > 80) { r.vel = 0; r.target = rotFor(k, under(k)); }
      r.set = true; drag = null; center();
    }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('click', function (e) { e.stopPropagation(); });

    /* ---------- нажать на любой кин ---------- */
    function pickAt(x, y) {
      if (st.open < .8) return;
      var best = 0, bd = 16 * 16, k, dx, dy, d;
      for (k = 1; k <= 260; k++) { if (!st.pos[k]) continue; dx = st.pos[k][0] - x; dy = st.pos[k][1] - y; d = dx * dx + dy * dy; if (d < bd) { bd = d; best = k; } }
      if (best) { tink(); showPick(best); }
    }
    function nextOf(kin) { var t = todayIso(), i, d; for (i = 0; i < 262; i++) { d = addIso(t, i); if (K.kinOf(d) === kin) return d; } return ''; }
    // волна (13 дней), в которой стоит дата: от, до, день N, название — по первому дню (так называются маршруты)
    function waveOf(d) {
      var k = K.kinOf(d), day = K.toneOf(k), a = d, b = d, s = day, e = day;
      while (s > 1) { a = addIso(a, -1); if (K.kinOf(a)) s--; }
      while (e < 13) { b = addIso(b, 1); if (K.kinOf(b)) e++; }
      var t = K.sealName(K.sealOf(k - day + 1));
      return { kin: k, day: day, from: a, to: b, title: o.waveTitle ? o.waveTitle(a, t) : t };
    }
    function fill(t, c) { return String(t || '').replace(/\{([^{}]{1,30})\}/g, function (all, n) { n = n.trim().toLowerCase(); return c[n] != null ? c[n] : all; }); }
    function showPick(k) {
      if (st.mine.indexOf(k) >= 0) { st.pick = null; pickEl.hidden = true; hint(); return; }
      st.pick = k;
      var I = K.info(k), nx = nextOf(k), w = nx ? waveOf(nx) : null;
      pickEl.innerHTML = '<div class="m13-kw-pk">Kin ' + k + '</div><div class="m13-kw-pn">' + esc(I.kinName) + '</div>' +
        '<p class="m13-kw-ps">Печать — ' + esc(I.seal) + ' · тон ' + I.toneN + ', ' + esc(I.tone) + (isGap[k] ? ' · портал' : '') + '</p>' +
        (nx ? '<p>' + esc(fill(T('wNext'), { 'дата': nx === todayIso() ? 'сегодня' : niceIso(nx) })) + '</p>' : '') +
        (w ? '<p class="m13-kw-ps">' + esc(fill(T('wWave'), { 'маршрут': w.title, 'даты': shortIso(w.from) + '–' + shortIso(w.to), 'день': String(w.day) })) + '</p>' : '') +
        '<button class="m13-kw-link" type="button">' + esc(T('wMine')) + '</button>';
      pickEl.hidden = false;
      pickEl.querySelector('button').addEventListener('click', function () { st.pick = null; pickEl.hidden = true; hint(); });
      hint();
    }
    pickEl.addEventListener('click', function (e) { e.stopPropagation(); });

    /* ---------- подписи к подсвеченным волнам (её просьба 19.10: «конкретика — эта волна идёт, а вот эта будет») ---------- */
    function legend() {
      var t = todayIso(), kt = K.kinOf(t), now = kt ? waveOf(t) : null, rows = [], seen = {};
      st.sealW = {}; st.nowW = kt ? Math.floor((kt - 1) / 13) : -1;
      if (now) {
        var past = '';
        st.mine.forEach(function (m) {
          var sl = K.sealOf(m), i, d, k;
          for (i = 1; i < now.day; i++) { d = addIso(t, -i); k = K.kinOf(d); if (k && K.sealOf(k) === sl && d >= now.from) { past = fill(T('wNowPast'), { 'дата': niceIso(d), 'день': String(K.toneOf(k)) }); break; } }
        });
        rows.push(['now', fill(T('wNow'), { 'маршрут': now.title, 'даты': shortIso(now.from) + '–' + shortIso(now.to), 'день': String(now.day) }) + (past ? ' ' + past : '')]);
      }
      st.mine.forEach(function (m) {
        var sl = K.sealOf(m), i, d, k;
        if (seen[sl]) return; seen[sl] = 1;
        for (i = 0; i < 560; i++) {
          d = addIso(t, i); k = K.kinOf(d);
          if (!k || K.sealOf(k) !== sl) continue;
          var w = waveOf(d), I = K.info(k), c = { 'дата': niceIso(d), 'кин': String(k), 'имя': I.kinName, 'день': String(w.day), 'маршрут': w.title, 'даты': shortIso(w.from) + '–' + shortIso(w.to) };
          st.sealW[Math.floor((k - 1) / 13)] = 1;
          rows.push(['seal', fill(T(i === 0 ? 'wSealToday' : now && w.from === now.from ? 'wSealHere' : 'wSeal'), c)]);
          break;
        }
      });
      legEl.innerHTML = rows.map(function (r) { return '<p class="m13-kw-lg m13-kw-lg--' + r[0] + '"><span class="m13-kw-mk" aria-hidden="true"></span><span>' + esc(r[1]) + '</span></p>'; }).join('');
      legEl.hidden = !rows.length;
    }

    /* ---------- вид Цолькина (если она разрешила участнику) ---------- */
    function laysUI() {
      if (!laysEl) return;
      laysEl.hidden = !st.openTo;
      [].forEach.call(laysEl.querySelectorAll('[data-lay]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-lay') === st.lay ? 'true' : 'false'); });
    }
    if (laysEl) laysEl.addEventListener('click', function (e) {
      e.stopPropagation();
      var b = e.target.closest('[data-lay]'), v = b && b.getAttribute('data-lay'); if (!v || v === st.lay) return;
      st.from = st.lay; st.lay = v; st.morph = st.open > 0 ? 0 : 1; laysUI(); go();
    });

    /* ---------- звук ---------- */
    sndBtns.push(snd); sndUI();
    snd.addEventListener('click', function (e) {
      e.stopPropagation(); sound = !sound;
      try { localStorage.setItem('m13kinSnd', sound ? '1' : '0'); } catch (x) {}
      sndBtns = sndBtns.filter(function (b) { return b.isConnected; }); sndUI();
    });

    // начальное положение: 1985, январь, 1 — под стрелкой, но ещё не выбрано
    RING.y.rot = rotFor('y', 1985 - Y0); RING.m.rot = rotFor('m', 0); RING.d.rot = rotFor('d', 0);
    ['y', 'm', 'd'].forEach(function (k) { RING[k].val = under(k); });
    window.addEventListener('resize', resize);
    resize(); center(); go();

    return {
      // кольца сами доезжают до даты (дата цифрами, «Подробнее» с оборота); годы до 1950 — колесо остаётся на 1950
      setDate: function (iso) {
        var p = String(iso || '').split('-'); if (p.length !== 3) return;
        var y = Math.max(0, Math.min(NY - 1, +p[0] - Y0));
        RING.y.target = rotFor('y', y); RING.m.target = rotFor('m', +p[1] - 1); RING.d.target = rotFor('d', +p[2] - 1);
        RING.y.set = RING.m.set = RING.d.set = true; st.wait = ''; center(); go();
      },
      // «Открыть»: щелчки замка и звон, точки перелетают в Цолькин; кины человека (два — 29 февраля, «не знаю»)
      reveal: function (kins, quiet) {
        if (!quiet) lockSound(st.opn);
        st.mine = kins.slice(); st.openTo = 1; st.from = null; st.morph = 1; st.pick = null; st.wait = '';
        legend();
        pickEl.hidden = true; cv.classList.add('is-open'); center(); laysUI(); go();
      },
      reset: function () {
        st.openTo = 0; st.mine = []; st.pick = null; st.sealW = {}; st.nowW = -1; st.wait = '';
        pickEl.hidden = true; legEl.hidden = true; cv.classList.remove('is-open'); center(); laysUI(); go();
      },
      pick: function (k) { if (st.openTo) { showPick(k); go(); } },
      // подсказка над колесом, пока ждём ответа (29 февраля: до или после полудня)
      wait: function (t) { st.wait = t || ''; hint(); }
    };
  }

  window.M13KINW = { mount: mount, MATS: Object.keys(MATS) };
})();
