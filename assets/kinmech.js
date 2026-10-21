/* 13 MIRRORS · «Свой кин» — механизм (21.10.2026, её решения — docs/tzolkin-gears.md, «Разговор 3» и «Сделано»).
   На странице кина после «Открыть»: сейф уходит, на его месте шестерёнки (13 тонов и 20 печатей) и Цолькин в объёме — бублик из 260 точек.
   Шестерёнки крутят день, по бублику идёт огонёк; бублик раскладывается в «Таблицу» (привычный Цолькин) или «Полотно» (разрезанный бублик).
   Её правки 21.10 (вечер): огонёк бежит только на близкое (до 26 дней), дальше — гаснет и загорается на новом месте; линия волны — точками;
   бублик крутится во все стороны; шестерёнки и окна — из материала сейфа.
   window.M13KINM.mount(элемент, o) → { show(кины, тихо), go(кин, 'ГГГГ-ММ-ДД'), hide() }.
   o: { T(ключ) — тексты (vitrina.js, KIN_T: m…), today — 'ГГГГ-ММ-ДД', cfg — reflection.kin.mech, mat — материал шестерёнок (как у сейфа),
        waveTitle(первый день волны, имя) }.
   Ничего не отправляет и не хранит, кроме «звук вкл/выкл» на самом устройстве (localStorage m13kinSnd, общий с колесом; по умолчанию звук выключен). */
(function () {
  'use strict';
  var TAU = Math.PI * 2, DAY = 864e5;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GAP = [1, 20, 22, 39, 43, 50, 51, 58, 64, 69, 72, 77, 85, 88, 93, 96, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115,
    146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 165, 168, 173, 176, 184, 189, 192, 197, 203, 210, 211, 218, 222, 239, 241, 260];
  var isGap = {}; GAP.forEach(function (k) { isGap[k] = 1; });
  var MONF = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var WD = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

  /* ---------- слои Dreamspell: цвет печати, замок, сезон (три разных вещи — не смешивать) ---------- */
  var CC = ['#ff5a40', '#f4efe4', '#4f8cff', '#ffcc33', '#4fd18b'];
  var CN = ['Красный', 'Белый', 'Синий', 'Жёлтый', 'Зелёный'];
  var SEAL_F = ['красная', 'белая', 'синяя', 'жёлтая'];
  var CASTLE_SIDE = ['Восточный', 'Северный', 'Западный', 'Южный', 'Центральный'];
  // сезоны по 65 дней, начинаются с «полярного» кина на тоне 3: Красный 185–249, Белый 250–54, Синий 55–119, Жёлтый 120–184
  var SEASON_EL = ['Кровь', 'Истина', 'Небо', 'Огонь'], POLAR = { 185: 1, 250: 1, 55: 1, 120: 1 };
  function season(k) { return k >= 185 && k <= 249 ? 0 : (k >= 250 || k <= 54) ? 1 : k <= 119 ? 2 : 3; }
  function castle(k) { return Math.floor((k - 1) / 52); }
  function mod(n, m) { return ((n % m) + m) % m; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function feb29(t) { var d = new Date(t); return d.getUTCMonth() === 1 && d.getUTCDate() === 29; }
  function isoT(s) { var p = String(s).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function tIso(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  function fmt(t) { var d = new Date(t); return d.getUTCDate() + ' ' + MONF[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }

  /* ---------- звук: выключен, пока человек сам не включит; «вкл/выкл» — общий с колесом даты ---------- */
  var ac = null, noise = null, lastClk = 0;
  function soundOn() { try { return localStorage.getItem('m13kinSnd') === '1'; } catch (e) { return false; } }
  function audio() {
    if (!soundOn()) return null;
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
  function burst(t, f, q, g, dur) {
    var s = ac.createBufferSource(), fl = ac.createBiquadFilter(), gn = ac.createGain();
    s.buffer = noise; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
    gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl); fl.connect(gn); gn.connect(ac.destination); s.start(t, Math.random() * .2); s.stop(t + dur + .01);
  }
  function tone(t, f, g, dur) {
    var o = ac.createOscillator(), gn = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * .7, t + dur);
    gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + .002); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + dur + .02);
  }
  // мягкий щелчок зубца; hv — начало волны (тон 1), чуть ниже и полнее
  function click(hv) {
    var now = performance.now(); if (now - lastClk < 60) return; lastClk = now;
    if (!audio()) return;
    var t = ac.currentTime;
    burst(t, hv ? 2200 : 3000, 4, hv ? .38 : .22, hv ? .03 : .016); tone(t, hv ? 150 : 210, hv ? .16 : .07, hv ? .08 : .035);
  }
  // значок динамика — линией, без подложки: ложится на любой фон (её просьба 21.10)
  var SND_ON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path d="M18.2 6.8a7.4 7.4 0 0 1 0 10.4"/></svg>';
  var SND_OFF = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';

  // материалы шестерёнок — те же, что у колеса-сейфа (kinwheel.js)
  var GMATS = {
    bronze: { lo: '#3a2213', mid: '#8c5a2c', hi: '#e2ad72', sheen: 'rgba(255,226,180,.42)', ink: '#fdebd2', inkSh: 'rgba(30,14,4,.85)', well: '#120b08' },
    gold: { lo: '#5e4914', mid: '#b08f33', hi: '#f6e39a', sheen: 'rgba(255,250,215,.5)', ink: '#2a2005', inkSh: 'rgba(255,246,210,.55)', well: '#14100a' },
    silver: { lo: '#4c5262', mid: '#9ba4b6', hi: '#f0f3f8', sheen: 'rgba(255,255,255,.55)', ink: '#1c2130', inkSh: 'rgba(255,255,255,.5)', well: '#0e0f18' },
    glass: { lo: 'rgba(70,80,170,.30)', mid: 'rgba(140,150,235,.20)', hi: 'rgba(235,235,255,.38)', sheen: 'rgba(255,255,255,.45)', ink: '#eef0ff', inkSh: 'rgba(10,10,40,.7)', well: 'rgba(8,8,24,.6)' }
  };

  /* ---------- раскладки бублика ---------- */
  var Rt = 1, rt = .42;
  function torus(ph, th, u1, u2) {
    var s1 = th * rt, k1 = (1 - u1) / rt, a, b;
    if (k1 > 1e-3) { a = rt - (1 - Math.cos(k1 * s1)) / k1; b = Math.sin(k1 * s1) / k1; } else { a = rt; b = s1; }
    var Rc = Rt + a, s2 = ph * Rc, k2 = (1 - u2) / Rc, x, z;
    if (k2 > 1e-3) { x = Math.sin(k2 * s2) / k2; z = Rc - (1 - Math.cos(k2 * s2)) / k2; } else { x = s2; z = Rc; }
    return [x, b, z - (Rt + rt) * u2];
  }
  // точный бублик с разворотом: u1 — трубка раскрывается (бублик → широкое кольцо-лента), u2 — кольцо распрямляется в лист
  function knotU(i, u1, u2) { var j = i % 20, q = i % 13; return torus((j - 9.5) / 20 * TAU, (q - 6) / 13 * TAU, u1, u2); }
  function coilPos(i) {
    var ph = i / 260 * TAU, th = (i % 13) / 13 * TAU - Math.PI / 2, r = .36;
    return [(1 + r * Math.cos(th)) * Math.sin(ph), r * Math.sin(th), (1 + r * Math.cos(th)) * Math.cos(ph)];
  }
  function towerPos(i) {
    var th = (i % 13) / 13 * TAU + Math.floor(i / 13) * .08, y = -1.15 + i / 259 * 2.3, rr = .78 - i / 259 * .18;
    return [rr * Math.sin(th), y, rr * Math.cos(th)];
  }
  function form3d(f, i) { return f === 'coil' ? coilPos(i) : f === 'tower' ? towerPos(i) : knotU(i, 0, 0); }
  function ease(t) { t = Math.max(0, Math.min(1, t)); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function hexA(h, a) { var n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  var sprites = null;
  function mkSprites() {
    sprites = CC.concat(['#fff1c2']).map(function (c) {
      var s = document.createElement('canvas'); s.width = s.height = 64; var g = s.getContext('2d');
      var rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      rg.addColorStop(0, '#ffffff'); rg.addColorStop(.18, c); rg.addColorStop(.42, hexA(c, .35)); rg.addColorStop(1, hexA(c, 0));
      g.fillStyle = rg; g.fillRect(0, 0, 64, 64); return s;
    });
  }

  function mount(box, o) {
    var K = window.M13KIN, T = o.T, cfg = o.cfg || {};
    if (!sprites) mkSprites();
    var COLORS = { seal: 1, castle: 1, season: 1 }, FORMS = { knot: 1, coil: 1, tower: 1 };
    var FLATS = ['3d'].concat(cfg.cut !== false ? ['cut'] : [], cfg.classic !== false ? ['classic'] : []);
    var opt = { form: FORMS[cfg.form] ? cfg.form : 'knot', flat: '3d', lay: COLORS[cfg.color] ? cfg.color : 'seal', hl: '' };
    var show = { form: !!cfg.formShow, flat: cfg.flatShow !== false && FLATS.length > 1, lay: !!cfg.colorShow, hl: !!cfg.hlShow };
    function colorOf(k) { return opt.lay === 'castle' ? castle(k) : opt.lay === 'season' ? season(k) : (k - 1) % 20 % 4; }
    function chips(g, list) {
      var h = T('m' + g.charAt(0).toUpperCase() + g.slice(1) + 'H');
      return '<div class="m13-km-row" data-g="' + g + '"' + (show[g] ? '' : ' hidden') + '>' + (h ? '<b>' + esc(h) + '</b>' : '') +
        list.map(function (x) { return '<button type="button" class="m13-km-chip" data-v="' + x[0] + '" aria-pressed="' + (opt[g] === x[0]) + '">' + esc(T(x[1])) + '</button>'; }).join('') + '</div>';
    }
    box.innerHTML =
      '<div class="m13-km-grid">' +
        '<div class="m13-km-panel m13-km-gears">' +
          '<button type="button" class="m13-km-snd"></button>' +
          '<div class="m13-km-date"></div>' +
          '<canvas class="m13-km-gv" aria-label="Шестерёнки: 13 тонов и 20 печатей, в месте сцепления — кин дня"></canvas>' +
          '<div class="m13-km-nav">' +
            '<button type="button" data-step="-13" title="Назад на волну (13 дней)" aria-label="Назад на волну">«</button><button type="button" data-step="-1" title="Назад на день" aria-label="Назад на день">‹</button>' +
            '<button type="button" data-go="today">' + esc(T('mToday')) + '</button><button type="button" class="is-hi" data-go="mine">' + esc(T('mMine')) + '</button>' +
            '<button type="button" data-step="1" title="Вперёд на день" aria-label="Вперёд на день">›</button><button type="button" data-step="13" title="Вперёд на волну (13 дней)" aria-label="Вперёд на волну">»</button></div>' +
          (T('mHint') ? '<p class="m13-km-hint">' + esc(T('mHint')) + '</p>' : '') +
        '</div>' +
        '<div class="m13-km-panel">' +
          chips('form', [['knot', 'mKnot'], ['coil', 'mCoil'], ['tower', 'mTower']]) +
          '<div class="m13-km-scene"><canvas class="m13-km-tv" aria-label="260 кинов в объёме"></canvas></div><p class="m13-km-cap"></p>' +
          chips('flat', [['3d', 'm3d'], ['classic', 'mClassic'], ['cut', 'mCut']].filter(function (x) { return FLATS.indexOf(x[0]) >= 0; })) +
          '<p class="m13-km-about"></p><div class="m13-km-legend"></div>' +
        '</div>' +
      '</div>' +
      '<div class="m13-km-card" aria-live="polite"></div>' +
      '<div class="m13-km-panel m13-km-opts">' +
        chips('lay', [['seal', 'mSeal'], ['castle', 'mCastle'], ['season', 'mSeason']]) +
        chips('hl', [['', 'mHlNone'], ['wave', 'mHlWave'], ['seal', 'mHlSeal'], ['tone', 'mHlTone'], ['port', 'mHlPort']]) +
      '</div>';
    function q(s) { return box.querySelector(s); }
    var gridEl = q('.m13-km-grid'), gPan = q('.m13-km-gears'), tPan = gPan.nextElementSibling, optsEl = q('.m13-km-opts');
    var gv = q('.m13-km-gv'), gx = gv.getContext('2d'), tv = q('.m13-km-tv'), tx = tv.getContext('2d'), sndB = q('.m13-km-snd');

    var T0 = isoT(o.today), KT = K.kinOf(T0) || K.kinOf(T0 - DAY);
    var mine = [];   // кин человека (два — 29 февраля «не знаю») — только в памяти страницы
    // st.k — счёт кинов без конца (кин = k mod 260 + 1); shown — куда сейчас повёрнуты колёса, v — их скорость (дней в секунду)
    var st = { t: T0, k: KT - 1, hunab: false, shown: KT - 1, v: 0, drag: null };
    // огонёк на бублике (её решение 21.10): близко (до 26 дней) — бежит вместе с шестерёнками;
    // дальше или пока шестерёнки крутят пальцем — стоит, а когда они остановились, гаснет и загорается на новом месте
    var NEAR = 26, fire = { s: KT - 1, hold: false, f: 0, old: KT - 1 };
    function kinNow() { return mod(st.k, 260) + 1; }
    function fireAim() { if (st.drag || Math.abs(st.k - fire.s) > NEAR) fire.hold = true; }
    function step(n) {
      var d = n > 0 ? 1 : -1;
      st.hunab = false;
      for (var i = 0; i < Math.abs(n); i++) { st.t += d * DAY; if (feb29(st.t)) st.t += d * DAY; st.k += d; }
      if (reduce) st.shown = st.k;
      fireAim(); changed();
    }
    // сколько дней Цолькина от сегодня до t (29 февраля не считается) — колёса идут ровно назад или вперёд, а не короткой дорогой по кругу
    function dayN(t) {
      var a = Math.min(t, T0), b = Math.max(t, T0), c = 0, y;
      for (y = new Date(a).getUTCFullYear(); y <= new Date(b).getUTCFullYear(); y++) {
        var f = Date.UTC(y, 1, 29);
        if (new Date(f).getUTCMonth() === 1 && f > a && f <= b) c++;
      }
      return Math.round((t - T0) / DAY) - (t > T0 ? c : -c);
    }
    function setDate(t) {
      st.t = t;
      st.hunab = !K.kinOf(t);
      st.k = KT - 1 + dayN(t); if (reduce) st.shown = st.k;
      fireAim(); changed();
    }
    function goKin(k) {
      var diff = mod(k - kinNow(), 260); if (diff > 130) diff -= 260;
      if (diff) step(diff); else changed();
    }
    // ближайший день своего кина — сегодня или впереди
    function goMine() {
      if (!mine.length) return;
      if (Math.round((st.t - T0) / DAY)) setDate(T0);
      var n = Math.min.apply(null, mine.map(function (m) { return mod(m - kinNow(), 260); }));
      if (n) step(n); else changed();
    }

    /* ================= шестерёнки: материал сейфа (kinwheel.js, MATS), тоны точками и чертами ================= */
    var M = GMATS[o.mat] || GMATS.gold;
    var SC = ['#cf4632', '#efe9dc', '#3a6dc2', '#efc137'], SI = ['#fff4ee', '#2a2620', '#f2f6ff', '#2c2205'], GOLD = '#f0d68c';
    var R2 = 1, R1 = 13 / 20, AD = .1, DD = .125, S1 = TAU / 13, S2 = TAU / 20;
    var G = { u: 1, c1: [0, 0], c2: [0, 0], dpr: 1, W: 0, H: 0 };
    function gLayout() {
      var w = gv.clientWidth, dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!w) return;
      var spanX = (R1 + AD) + (R1 + R2) + (R2 + AD) + .06, spanY = 2 * (R2 + AD) + .06;
      var u = w / spanX, h = Math.round(spanY * u);
      gv.style.height = h + 'px';
      gv.width = Math.round(w * dpr); gv.height = Math.round(h * dpr);
      G = { u: u, dpr: dpr, W: w, H: h, c1: [(R1 + AD + .03) * u, h / 2], c2: [(R1 + AD + .03 + R1 + R2) * u, h / 2] };
    }
    function gearPath(c, R, n, th, half) {
      var u = G.u, stp = TAU / n, i, rt2 = (R + AD) * u, rr = (R - DD) * u;
      gx.beginPath();
      for (i = 0; i < n; i++) {
        var a = th + (i + (half ? .5 : 0)) * stp;
        [[a - .34 * stp, rr], [a - .17 * stp, rt2], [a + .17 * stp, rt2], [a + .34 * stp, rr]].forEach(function (p, j) {
          var x = c[0] + Math.cos(p[0]) * p[1], y = c[1] + Math.sin(p[0]) * p[1];
          if (i === 0 && j === 0) gx.moveTo(x, y); else gx.lineTo(x, y);
        });
      }
      gx.closePath();
    }
    function drawGear(c, R, n, th, half) {
      var u = G.u, ro = (R + AD) * u;
      gx.save(); gx.shadowColor = 'rgba(0,0,0,.6)'; gx.shadowBlur = 14; gx.shadowOffsetY = 6;
      gearPath(c, R, n, th, half); gx.fillStyle = M.mid; gx.fill(); gx.restore();
      var g = gx.createLinearGradient(c[0] - ro * .75, c[1] - ro * .75, c[0] + ro * .75, c[1] + ro * .75);
      g.addColorStop(0, M.hi); g.addColorStop(.5, M.mid); g.addColorStop(1, M.lo);
      gearPath(c, R, n, th, half); gx.fillStyle = g; gx.fill();
      if (gx.createConicGradient) {
        var cg = gx.createConicGradient(-Math.PI / 2 - .7, c[0], c[1]);
        cg.addColorStop(0, 'rgba(255,255,255,0)'); cg.addColorStop(.07, M.sheen); cg.addColorStop(.16, 'rgba(255,255,255,0)');
        cg.addColorStop(.45, 'rgba(0,0,0,.16)'); cg.addColorStop(.57, M.sheen); cg.addColorStop(.64, 'rgba(255,255,255,0)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
        gearPath(c, R, n, th, half); gx.fillStyle = cg; gx.fill();
      }
      gearPath(c, R, n, th, half);
      var eg = gx.createLinearGradient(0, c[1] - R * u, 0, c[1] + R * u);
      eg.addColorStop(0, 'rgba(255,255,255,.55)'); eg.addColorStop(1, 'rgba(0,0,0,.5)');
      gx.strokeStyle = eg; gx.lineWidth = 1.2; gx.stroke();
      var rw = (half ? .5 : .52) * R * u;
      var wg = gx.createRadialGradient(c[0], c[1] - rw * .1, rw * .1, c[0], c[1], rw);
      wg.addColorStop(0, M.well); wg.addColorStop(.85, M.well); wg.addColorStop(1, 'rgba(0,0,0,.9)');
      gx.beginPath(); gx.arc(c[0], c[1], rw, 0, TAU); gx.fillStyle = wg; gx.fill();
      var lg = gx.createLinearGradient(0, c[1] - rw, 0, c[1] + rw);
      lg.addColorStop(0, 'rgba(0,0,0,.6)'); lg.addColorStop(1, 'rgba(255,255,255,.3)');
      gx.strokeStyle = lg; gx.lineWidth = 1.2; gx.stroke();
    }
    function roundRect(c, x, y, w, h, r) {
      c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    }
    function maya(n, x, y, size, up, color, sh) {
      var bars = Math.floor(n / 5), dots = n % 5, bh = size * .16, gap = size * .11, dr = size * .085;
      var hgt = bars * bh + Math.max(0, bars - 1) * gap + (dots ? dr * 2 + (bars ? gap : 0) : 0);
      gx.save(); gx.translate(x, y); gx.rotate(up + Math.PI / 2);
      function paint(col, dy) {
        gx.fillStyle = col;
        var yy = -hgt / 2 + dy, i;
        if (dots) {
          for (i = 0; i < dots; i++) { gx.beginPath(); gx.arc((i - (dots - 1) / 2) * size * .25, yy + dr, dr, 0, TAU); gx.fill(); }
          yy += dr * 2 + gap;
        }
        for (i = 0; i < bars; i++) { roundRect(gx, -size / 2, yy, size, bh, bh / 2); gx.fill(); yy += bh + gap; }
      }
      if (sh) paint(sh, size * .04);
      paint(color, 0);
      gx.restore();
    }
    function gtxt(s, x, y, size, color, weight) {
      gx.font = (weight || '600') + ' ' + size + 'px "Cormorant Garamond", Georgia, serif';
      gx.textAlign = 'center'; gx.textBaseline = 'middle'; gx.fillStyle = color; gx.fillText(s, x, y);
    }
    function sealTile(s, x, y, size, up, glow) {
      var i = (s - 1) % 4;
      gx.save(); gx.translate(x, y); if (up != null) gx.rotate(up + Math.PI / 2);
      if (glow) { gx.shadowColor = 'rgba(240,214,140,.95)'; gx.shadowBlur = size * .5; }
      else { gx.shadowColor = 'rgba(0,0,0,.5)'; gx.shadowBlur = size * .15; gx.shadowOffsetY = size * .05; }
      roundRect(gx, -size / 2, -size / 2, size, size, size * .16); gx.fillStyle = SC[i]; gx.fill();
      gx.shadowColor = 'transparent';
      gx.font = '700 ' + (size * .5) + 'px "Cormorant Garamond", Georgia, serif';
      gx.textAlign = 'center'; gx.textBaseline = 'middle'; gx.fillStyle = SI[i]; gx.fillText(String(s), 0, size * .03);
      roundRect(gx, -size / 2, -size / 2, size, size, size * .16); gx.strokeStyle = glow ? GOLD : 'rgba(0,0,0,.35)'; gx.lineWidth = glow ? 2 : 1; gx.stroke();
      gx.restore();
    }
    function gDraw() {
      var u = G.u, p = st.shown, a, i;
      gx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0); gx.clearRect(0, 0, G.W, G.H);
      var t1 = -p * S1, t2 = Math.PI + p * S2, c1 = G.c1, c2 = G.c2, sN = mod(Math.round(p), 20);
      var mx = c1[0] + R1 * u, my = c1[1];
      var hg = gx.createRadialGradient(mx, my, 0, mx, my, .55 * u);
      hg.addColorStop(0, 'rgba(240,214,140,.35)'); hg.addColorStop(1, 'rgba(240,214,140,0)');
      gx.fillStyle = hg; gx.fillRect(mx - .6 * u, my - .6 * u, 1.2 * u, 1.2 * u);
      drawGear(c2, R2, 20, t2, true);
      drawGear(c1, R1, 13, t1, false);
      for (i = 0; i < 13; i++) {
        a = t1 + i * S1;
        maya(i + 1, c1[0] + Math.cos(a) * (R1 - .02) * u, c1[1] + Math.sin(a) * (R1 - .02) * u, u * .2 * .82, a, M.ink, M.inkSh);
      }
      for (i = 0; i < 20; i++) {
        a = t2 - i * S2;
        sealTile(i + 1, c2[0] + Math.cos(a) * (R2 - .2) * u, c2[1] + Math.sin(a) * (R2 - .2) * u, .17 * u, a, i === sN);
      }
      var wy = (R2 + AD + .015) * u * .62;
      [-1, 1].forEach(function (s) {
        gx.beginPath(); gx.moveTo(mx, my + s * wy * .78); gx.lineTo(mx - .045 * u, my + s * wy); gx.lineTo(mx + .045 * u, my + s * wy); gx.closePath();
        gx.fillStyle = GOLD; gx.shadowColor = 'rgba(240,214,140,.8)'; gx.shadowBlur = 8; gx.fill(); gx.shadowBlur = 0;
      });
      var I = K.info(mod(Math.round(p), 260) + 1);
      maya(I.toneN, c1[0], c1[1] - .07 * u, .2 * u, -Math.PI / 2, GOLD);
      gtxt(K.TONES[I.toneN - 1], c1[0], c1[1] + .14 * u, .082 * u, 'rgba(244,234,216,.85)', '500');
      sealTile(I.sealN, c2[0], c2[1] - .07 * u, .3 * u, null, true);
      var nm = K.SEALS[I.sealN - 1][0];
      gtxt(nm, c2[0], c2[1] + .21 * u, (nm.length > 12 ? .075 : .09) * u, 'rgba(244,234,216,.85)', '500');
    }
    function gHit(e) {
      var b = gv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      if (Math.hypot(x - G.c1[0], y - G.c1[1]) < (R1 + AD) * G.u) return { g: 1, a: Math.atan2(y - G.c1[1], x - G.c1[0]) };
      if (Math.hypot(x - G.c2[0], y - G.c2[1]) < (R2 + AD) * G.u) return { g: 2, a: Math.atan2(y - G.c2[1], x - G.c2[0]) };
      return null;
    }
    function wrapPi(a) { return mod(a + Math.PI, TAU) - Math.PI; }
    gv.addEventListener('pointerdown', function (e) {
      var h = gHit(e); if (!h) return;
      audio();
      st.drag = { g: h.g, a: h.a, p: st.shown, id: e.pointerId }; st.v = 0;
      gv.setPointerCapture(e.pointerId); gv.classList.add('is-drag');
    });
    gv.addEventListener('pointermove', function (e) {
      var D = st.drag; if (!D || e.pointerId !== D.id) return;
      var b = gv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, c = D.g === 1 ? G.c1 : G.c2;
      var a = Math.atan2(y - c[1], x - c[0]), da = wrapPi(a - D.a); D.a = a;
      D.p += D.g === 1 ? -da / S1 : da / S2;
      st.shown = D.p;
      var r = Math.round(D.p);
      if (r !== st.k) step(r - st.k);
    });
    function gUp(e) { var D = st.drag; if (!D || e.pointerId !== D.id) return; st.drag = null; gv.classList.remove('is-drag'); }
    gv.addEventListener('pointerup', gUp); gv.addEventListener('pointercancel', gUp);
    box.querySelectorAll('[data-step]').forEach(function (b) {
      b.addEventListener('click', function () { audio(); step(+b.getAttribute('data-step')); });
    });
    q('[data-go="today"]').addEventListener('click', function () { audio(); setDate(T0); });
    q('[data-go="mine"]').addEventListener('click', function () { audio(); goMine(); });

    /* ================= Цолькин в объёме ================= */
    var W = 0, H = 0, dpr = 1, cam = { yaw: .5, pitch: .55, yawT: null, pitchT: null }, PITCH = { knot: .55, coil: .62, tower: .22 };
    function pu() { return Math.min(W, H) * .62 * .44; }   // пикселей на единицу у плоскости z = 0
    // клетка таблицы на экране → координаты сцены (строка — печать, столбец — тон или столбец таблицы)
    var TB = { cw: 20, ch: 16, x0: 0, y0: 0 };
    function tbLayout() { var cw = (W - 52) / 13, ch = (H - 64) / 20; TB = { cw: Math.min(cw, ch * 2.4), ch: ch, x0: W / 2 + 12, y0: H / 2 - 4 }; }
    function cellXY(col, row) { return [TB.x0 + (col - 6) * TB.cw, TB.y0 + (row - 9.5) * TB.ch]; }
    function toWorld(sx, sy) { var p = pu(); return [(sx - W / 2) / p, (H / 2 + 6 - sy) / p]; }
    // U: 0 — объём, 0…1 раскрывается трубка, 1…2 распрямляется кольцо, 2…3 лист ложится в таблицу; C: 0 — разрезанный бублик, 1 — привычная
    var U = 0, Ut = 0, C = 0, Ct = 0, from = null, fm = 1, P = [], proj = [];
    function positions() {
      var out = [], i, sheetFit = (W * .92 / pu()) / (TAU * (Rt + rt));
      var e1 = ease(U), e2 = ease(U - 1), e3 = ease(U - 2), eL = ease(U / 3), eC = ease(C);
      for (i = 0; i < 260; i++) {
        var j = i % 20, col = (i % 13) + (Math.floor(i / 20) - (i % 13)) * eC;
        var cxy = cellXY(col, j), tw = toWorld(cxy[0], cxy[1]), p;
        if (opt.form === 'knot') {
          if (U < 2) {
            p = knotU(i, e1, e2);
            var sc = 1 + (sheetFit - 1) * e2;
            p = [p[0] * sc, p[1] * sc, p[2] * sc];
          } else {
            // лист: печати по горизонтали, тоны по вертикали → поворачивается на 90° и ложится в клетки
            var Xs = (j - 9.5) / 20 * TAU * (Rt + rt) * sheetFit, Ys = ((i % 13) - 6) / 13 * TAU * rt * sheetFit;
            var X = Xs + (-tw[1] - Xs) * e3, Y = Ys + (tw[0] - Ys) * e3, an = -e3 * Math.PI / 2;
            p = [X * Math.cos(an) - Y * Math.sin(an), X * Math.sin(an) + Y * Math.cos(an), 0];
          }
        } else {
          var f = form3d(opt.form, i);
          p = [f[0] + (tw[0] - f[0]) * eL, f[1] + (tw[1] - f[1]) * eL, f[2] * (1 - eL)];
        }
        out.push(p);
      }
      if (fm < 1) { var e = ease(fm); out = out.map(function (p, m) { return [0, 1, 2].map(function (n) { return from[m][n] + (p[n] - from[m][n]) * e; }); }); }
      return out;
    }
    function flatK() { return opt.form === 'knot' ? Math.max(0, Math.min(1, U - 2)) : ease(U / 3); }
    var stars = []; for (var si = 0; si < 120; si++) stars.push([Math.random(), Math.random(), Math.random() * .9 + .2, Math.random() * TAU]);
    function tSize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2); W = tv.clientWidth; H = tv.clientHeight;
      tv.width = Math.round(W * dpr); tv.height = Math.round(H * dpr); tbLayout();
    }
    function project(p) {
      var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      var x = p[0] * cy - p[2] * sy, z = p[0] * sy + p[2] * cy, y = p[1];
      var y2 = y * cp - z * sp, z2 = y * sp + z * cp;
      var d = 3.4, s = d / (d - z2), f = pu();
      return [W / 2 + x * f * s, H / 2 + 6 - y2 * f * s, z2, s];
    }
    function dn(z) { return Math.max(0, Math.min(1, (z + 1.5) / 3)); }   // 0 — дальняя сторона, 1 — ближняя
    // тонкие кольца-направляющие (только в объёме)
    function guides(alpha) {
      if (alpha <= .01 || opt.form === 'tower') return;
      var B = [[], [], [], []], i, n, a, b, qq;
      function seg(p1, p2) { var bk = Math.min(3, Math.floor(dn((p1[2] + p2[2]) / 2) * 4)); B[bk].push(p1, p2); }
      if (opt.form === 'knot') {
        for (i = 0; i < 20; i++) {
          var ph = (i - 9.5) / 20 * TAU;
          for (n = 0; n < 36; n++) { a = project(torus(ph, n / 36 * TAU, 0, 0)); b = project(torus(ph, (n + 1) / 36 * TAU, 0, 0)); seg(a, b); }
        }
        for (qq = 0; qq < 13; qq++) {
          var th = (qq - 6) / 13 * TAU;
          for (n = 0; n < 60; n++) { a = project(torus(n / 60 * TAU, th, 0, 0)); b = project(torus((n + 1) / 60 * TAU, th, 0, 0)); seg(a, b); }
        }
      } else {
        for (qq = 0; qq < 13; qq++) {
          var t2 = qq / 13 * TAU - Math.PI / 2, r = .36;
          for (n = 0; n < 60; n++) {
            var f1 = n / 60 * TAU, f2 = (n + 1) / 60 * TAU;
            a = project([(1 + r * Math.cos(t2)) * Math.sin(f1), r * Math.sin(t2), (1 + r * Math.cos(t2)) * Math.cos(f1)]);
            b = project([(1 + r * Math.cos(t2)) * Math.sin(f2), r * Math.sin(t2), (1 + r * Math.cos(t2)) * Math.cos(f2)]);
            seg(a, b);
          }
        }
      }
      tx.lineWidth = .7;
      for (i = 0; i < 4; i++) {
        if (!B[i].length) continue;
        tx.beginPath();
        for (n = 0; n < B[i].length; n += 2) { tx.moveTo(B[i][n][0], B[i][n][1]); tx.lineTo(B[i][n + 1][0], B[i][n + 1][1]); }
        tx.strokeStyle = 'rgba(190,190,255,' + ((.03 + .07 * i) * alpha) + ')'; tx.stroke();
      }
    }
    function isHl(k, sel) {
      var I = K.info(k), S = K.info(sel);
      if (opt.hl === 'wave') return mod(k - (sel - S.toneN + 1), 260) < 13;
      if (opt.hl === 'seal') return I.sealN === S.sealN;
      if (opt.hl === 'tone') return I.toneN === S.toneN;
      if (opt.hl === 'port') return !!isGap[k];
      return false;
    }
    function label(s, x, y, col, size, align) {
      tx.font = '500 ' + (size || 13) + 'px "Cormorant Garamond", Georgia, serif'; tx.textBaseline = 'middle';
      // у правого края — подпись слева от точки
      if ((align || 'left') === 'left' && x + tx.measureText(s).width > W - 6) x -= tx.measureText(s).width + 18;
      tx.textAlign = align || 'left';
      tx.fillStyle = 'rgba(0,0,0,.7)'; tx.fillText(s, x + 1, y + 1);
      tx.fillStyle = col; tx.fillText(s, x, y);
    }
    // место огонька между днями: s — дробный счёт дней; в таблице через край — перескок, а не полёт через всё поле
    function posAt(s, lim) {
      var a0 = mod(Math.floor(s), 260), a1 = mod(a0 + 1, 260), fr = s - Math.floor(s), pa = proj[a0], pb = proj[a1];
      if (Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) > lim) return fr < .5 ? pa : pb;
      return [pa[0] + (pb[0] - pa[0]) * fr, pa[1] + (pb[1] - pa[1]) * fr];
    }
    function tDraw(now) {
      tx.setTransform(dpr, 0, 0, dpr, 0, 0); tx.clearRect(0, 0, W, H);
      var i, s, fl = flatK(), sel = kinNow();
      for (i = 0; i < stars.length; i++) {
        s = stars[i]; tx.globalAlpha = (.2 + .2 * Math.sin(now / 1400 + s[3])) * (1 - fl * .6);
        tx.fillStyle = '#cfd6ff'; tx.fillRect(s[0] * W, s[1] * H, s[2], s[2]);
      }
      tx.globalAlpha = 1;
      P = positions(); proj = P.map(project);
      guides(1 - Math.min(1, U * 2));
      // таблица: подписи строк (печати) и столбцов
      if (fl > .3) {
        tx.globalAlpha = (fl - .3) / .7;
        for (i = 0; i < 20; i++) {
          var hy = cellXY(0, i)[1], hx = cellXY(-1, i)[0] - 4;
          tx.fillStyle = SC[i % 4]; tx.beginPath(); tx.arc(hx, hy, Math.min(5, TB.ch * .3), 0, TAU); tx.fill();
        }
        for (i = 0; i < 13; i++) { var c = cellXY(i, -1); label(String(i + 1), c[0], c[1] + 2, 'rgba(244,234,216,.6)', 12, 'center'); }
        tx.globalAlpha = 1;
      }
      // волна дня под огоньком: её 13 точек крупнее и светлее (линию убрали — её решение 21.10)
      var fk = mod(Math.round(fire.s), 260) + 1, w0 = fk - K.toneOf(fk) + 1, lim = Math.max(TB.cw, TB.ch) * 2.6;
      // точки — от дальних к ближним; дальние мельче и тусклее (туман)
      var ord = []; for (i = 0; i < 260; i++) ord.push(i);
      ord.sort(function (x, y) { return proj[x][2] - proj[y][2]; });
      var base3 = Math.min(W, H) / 64, baseF = Math.min(TB.cw, TB.ch) * .3, hlOn = !!opt.hl;
      ord.forEach(function (i) {
        var p = proj[i], k = i + 1, lit = k <= KT, hl = hlOn && isHl(k, sel), d = dn(p[2]), wv = !hlOn && mod(k - w0, 260) < 13;
        var fog = fl + (1 - fl) * (.22 + .78 * Math.pow(d, 1.4));
        var r = (base3 * p[3] * (.75 + .3 * d) * (1 - fl) + baseF * fl) * (lit ? 1 : .72) * (hl ? 1.3 : 1) * (wv ? 1.5 : 1);
        if (hlOn && !hl) r *= .75;
        var al = (lit ? 1 : .5) * fog * (hlOn && !hl ? .3 : 1);
        if (hl || wv) al = Math.max(al, .95 * fog);
        if (wv) { tx.globalAlpha = .3 * fog; tx.drawImage(sprites[5], p[0] - r * 2.6, p[1] - r * 2.6, r * 5.2, r * 5.2); }
        tx.globalAlpha = Math.min(1, al);
        tx.drawImage(sprites[colorOf(k)], p[0] - r * 2, p[1] - r * 2, r * 4, r * 4);
        if (opt.lay === 'season' && POLAR[k]) {
          tx.globalAlpha = Math.min(1, .4 + .6 * fog); tx.beginPath();
          var qd = r * 1.5 + 3; tx.moveTo(p[0], p[1] - qd); tx.lineTo(p[0] + qd, p[1]); tx.lineTo(p[0], p[1] + qd); tx.lineTo(p[0] - qd, p[1]); tx.closePath();
          tx.strokeStyle = CC[season(k)]; tx.lineWidth = 1.1; tx.stroke();
        }
      });
      tx.globalAlpha = 1;
      // мой кин — пунктирный круг
      mine.forEach(function (m, n) {
        var pm = proj[m - 1];
        tx.beginPath(); tx.arc(pm[0], pm[1], 9, 0, TAU); tx.setLineDash([3, 3]); tx.strokeStyle = GOLD; tx.lineWidth = 1.3; tx.stroke(); tx.setLineDash([]);
        if (!n) label('мой кин', pm[0] - 11, pm[1] + 13, '#fff3d6', 13, 'right');
      });
      // сегодня — звезда
      var t = proj[KT - 1], pulse = reduce ? 1 : 1 + .1 * Math.sin(now / 900), R = Math.max(5, (base3 * t[3] * (1 - fl) + baseF * fl) * 1.5) * pulse;
      tx.globalAlpha = .85; tx.drawImage(sprites[5], t[0] - R * 1.6, t[1] - R * 1.6, R * 3.2, R * 3.2);
      tx.save(); tx.translate(t[0], t[1]); tx.rotate(reduce ? 0 : now / 9000);
      tx.strokeStyle = 'rgba(255,240,200,1)'; tx.lineWidth = 1;
      for (i = 0; i < 4; i++) { tx.rotate(Math.PI / 4); tx.beginPath(); tx.moveTo(-R * 1.15, 0); tx.lineTo(R * 1.15, 0); tx.globalAlpha = i % 2 ? .25 : .55; tx.stroke(); }
      tx.restore(); tx.globalAlpha = 1;
      label('сегодня', t[0] + R * 1.3 + 2, t[1] - R * .9, '#fff3d6', 13);
      // огонёк: на близкое бежит с тающим шлейфом; на дальнее — гаснет на старом месте и загорается на новом
      var rr = Math.max(6, (base3 * (1 - fl) + baseF * fl) * 1.9), av = Math.abs(st.v), dir = st.v > 0 ? 1 : -1, j, pp;
      if (!fire.hold && av > .4 && !reduce) {
        var gap = Math.min(.45, Math.max(.12, av * .018));
        for (j = 7; j >= 1; j--) {
          pp = posAt(fire.s - dir * j * gap, lim * 1.5);
          var tr = rr * (1 - j * .09);
          tx.globalAlpha = .32 * (1 - j / 8) * Math.min(1, av / 4);
          tx.drawImage(sprites[5], pp[0] - tr * 1.6, pp[1] - tr * 1.6, tr * 3.2, tr * 3.2);
        }
      }
      var br = reduce ? 1 : 1 + .06 * Math.sin(now / 700);
      function glow(s, a) {
        if (a <= .01) return;
        var g = posAt(s, lim * 1.5);
        tx.globalAlpha = .95 * a; tx.drawImage(sprites[5], g[0] - rr * 2 * br, g[1] - rr * 2 * br, rr * 4 * br, rr * 4 * br);
        tx.globalAlpha = .6 * a; tx.beginPath(); tx.arc(g[0], g[1], rr * .9 + 3, 0, TAU); tx.strokeStyle = '#fff8e6'; tx.lineWidth = 1; tx.stroke();
      }
      if (fire.f) { glow(fire.old, ease(fire.f)); glow(fire.s, ease(1 - fire.f)); } else glow(fire.s, 1);
      tx.globalAlpha = 1;
    }

    /* ---------- управление бубликом: палец крутит во все стороны (как в пробе, её просьба 21.10); страницу листают мимо бублика ---------- */
    var drag = null, spin = { x: 0, y: 0 };
    tv.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId }; spin.x = spin.y = 0;
      try { tv.setPointerCapture(e.pointerId); } catch (er) {}
      tv.classList.add('is-drag');
    });
    tv.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      if (Ut === 0 && U < .01) {
        cam.yaw -= dx * .009; cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch + dy * .009)); cam.pitchT = null;
        spin.x = -dx * .009; spin.y = dy * .009;
      }
    });
    function tUp(e) { var D = drag; drag = null; tv.classList.remove('is-drag'); if (D && D.moved < 8) { spin.x = spin.y = 0; if (e.type === 'pointerup') pick(e); } }
    tv.addEventListener('pointerup', tUp); tv.addEventListener('pointercancel', tUp);
    function pick(e) {
      var b = tv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, best = -1, bd = 24 * 24, bz = -9;
      proj.forEach(function (p, i) {
        var d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y);
        if (d < bd - 60 || (d < bd + 60 && p[2] > bz)) { bd = Math.min(bd, d); best = i; bz = p[2]; }
      });
      if (best < 0) return;
      audio(); goKin(best + 1);
    }
    function press(g) { box.querySelectorAll('[data-g="' + g + '"] .m13-km-chip').forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-v') === opt[g] ? 'true' : 'false'); }); }
    function setFlat(v) {
      opt.flat = v; press('flat');
      var cap = q('.m13-km-cap');
      if (v === '3d') { Ut = 0; cap.textContent = ''; cam.pitchT = PITCH[opt.form]; }
      else { Ut = 3; Ct = v === 'classic' ? 1 : 0; cam.yawT = Math.round(cam.yaw / TAU) * TAU; cam.pitchT = 0; cap.textContent = T(v === 'classic' ? 'mClassicCap' : 'mCutCap'); }
      spin.x = spin.y = 0;
      if (reduce) { U = Ut; C = Ct; }
    }
    function setForm(f) {
      if (P.length) { from = P.map(function (p) { return p.slice(); }); fm = reduce ? 1 : 0; }
      opt.form = f; press('form'); U = 0; Ut = 0; setFlat('3d'); U = 0;
      var ab = q('.m13-km-about'); ab.textContent = T(f === 'coil' ? 'mAboutCoil' : f === 'tower' ? 'mAboutTower' : 'mAboutKnot'); ab.hidden = !ab.textContent;
    }

    /* ---------- карточка дня на шестерёнках ---------- */
    function rel(t) {
      var n = Math.round((t - T0) / DAY);
      if (!n) return 'сегодня';
      var a = Math.abs(n), w = a % 10 === 1 && a % 100 !== 11 ? 'день' : a % 10 >= 2 && a % 10 <= 4 && (a % 100 < 10 || a % 100 >= 20) ? 'дня' : 'дней';
      return n > 0 ? 'через ' + a + ' ' + w : a + ' ' + w + ' назад';
    }
    function dot(i) { return '<span class="m13-km-dot" style="background:' + CC[i] + '"></span>'; }
    // первый день волны выбранного дня (29 февраля не считается)
    function waveFrom(t, n) { while (n > 1) { t -= DAY; if (!feb29(t)) n--; } return t; }
    function changed() {
      var k = kinNow(), I = K.info(k), d = new Date(st.t), cs = castle(k), se = season(k);
      q('.m13-km-date').textContent = d.getUTCDate() + ' ' + MONF[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + ' · ' + WD[d.getUTCDay()];
      var wn = K.sealName(K.sealOf(k - I.toneN + 1)), w = o.waveTitle ? o.waveTitle(tIso(waveFrom(st.t, I.toneN)), wn) : wn;
      q('.m13-km-card').innerHTML =
        '<div class="m13-km-cd">' + (st.hunab ? '29 февраля — 0.0 Хунаб Ку, день без кина · колёса на кине накануне' : fmt(st.t) + ' · ' + rel(st.t)) +
          (mine.indexOf(k) >= 0 ? ' · день вашего кина' : '') + '</div>' +
        '<div class="m13-km-ck">Kin ' + k + ' · ' + esc(I.kinName) + '</div>' +
        '<div>Волна <b>«' + esc(w) + '»</b> · день ' + I.toneN + ' из 13' + (isGap[k] ? ' · <b>портал</b>' : '') + '</div>' +
        // замок и сезон — только когда цвет точек показывает их (лишние сведения убрали — её решение 21.10)
        (opt.lay === 'castle' ? '<div class="m13-km-lay"><span>' + dot(cs) + 'замок <b>' + CN[cs] + '</b> (' + CASTLE_SIDE[cs] + '), день ' + ((k - 1) % 52 + 1) + ' из 52</span></div>' : '') +
        (opt.lay === 'season' ? '<div class="m13-km-lay"><span>' + dot(se) + 'сезон <b>' + CN[se] + '</b> (' + SEASON_EL[se] + ')' + (POLAR[k] ? ' — первый день сезона' : '') + '</span></div>' : '') +
        (show.flat && FLATS.indexOf('classic') >= 0 && opt.flat !== 'classic' && T('mToTable') ? '<button type="button" class="m13-km-ok" data-km-table>' + esc(T('mToTable')) + '</button>' : '');
    }
    q('.m13-km-card').addEventListener('click', function (e) {
      if (!e.target.closest('[data-km-table]')) return;
      setFlat('classic'); changed(); tv.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    });
    function legend() {
      var L = {
        seal: 'Цвет точки — цвет печати дня: ' + [0, 1, 2, 3].map(function (i) { return dot(i) + SEAL_F[i]; }).join(' '),
        castle: 'Цвет — замок, по 52 дня (4 волны): ' + [[0, '1–52'], [1, '53–104'], [2, '105–156'], [3, '157–208'], [4, '209–260']].map(function (x) { return dot(x[0]) + CN[x[0]] + ' ' + x[1]; }).join(' · '),
        season: 'Цвет — сезон, по 65 дней: ' + [[1, '250–54'], [2, '55–119'], [3, '120–184'], [0, '185–249']].map(function (x) { return dot(x[0]) + CN[x[0]] + ' ' + x[1]; }).join(' · ') + ' · ◇ — первый день сезона (тон 3)'
      };
      // цвет печатей понятен и без подписи — строка только для замков и сезонов или своя (её решение 21.10)
      var lg = q('.m13-km-legend');
      lg.innerHTML = (opt.lay !== 'seal' ? '<span>' + L[opt.lay] + '</span>' : '') + (T('mLegend') ? '<span>' + esc(T('mLegend')) + '</span>' : '');
      lg.hidden = !lg.innerHTML;
      optsEl.hidden = !show.lay && !show.hl;
    }
    box.querySelectorAll('.m13-km-row[data-g]').forEach(function (row) {
      var g = row.getAttribute('data-g');
      row.addEventListener('click', function (e) {
        var b = e.target.closest('.m13-km-chip'); if (!b) return;
        var v = b.getAttribute('data-v');
        if (g === 'flat') { setFlat(v); changed(); return; }
        if (g === 'form') setForm(v); else { opt[g] = v; press(g); }
        legend(); changed(); fitH();
      });
    });

    /* ---------- звук ---------- */
    function sndUI() {
      var on = soundOn();
      sndB.innerHTML = on ? SND_ON : SND_OFF; sndB.setAttribute('aria-pressed', on ? 'true' : 'false');
      sndB.title = on ? 'Выключить звук щелчков' : 'Включить звук щелчков';
      sndB.setAttribute('aria-label', sndB.title);
    }
    sndB.addEventListener('click', function () {
      try { localStorage.setItem('m13kinSnd', soundOn() ? '0' : '1'); } catch (e) {}
      try { window.dispatchEvent(new Event('m13kinsnd')); } catch (e) {}
      if (soundOn()) { audio(); click(true); }
    });
    window.addEventListener('m13kinsnd', sndUI);
    sndUI();

    /* ---------- общий цикл: плавный разгон и торможение шестерёнок ---------- */
    var A = 10, VMAX = 20;   // дней/с² и дней/с: шаг на волну — около 2 с, дальний путь (130 дней) — около 8 с
    var last = 0, lastInt = Math.round(st.shown), running = false, seen = true, open = false;
    function frame(now) {
      if (!running || !box.isConnected) { running = false; return; }
      if (!seen) { running = false; return; }
      var dt = Math.min(64, now - (last || now)), sec = dt / 1000; last = now;
      if (!st.drag) {
        var d = st.k - st.shown, ad = Math.abs(d);
        if (ad < .002 && Math.abs(st.v) < .2) { st.shown = st.k; st.v = 0; }
        else {
          var vt = (d > 0 ? 1 : -1) * Math.min(VMAX, Math.sqrt(2 * A * ad) + .3);
          st.v = st.v < vt ? Math.min(vt, st.v + A * 1.5 * sec) : Math.max(vt, st.v - A * 1.5 * sec);
          var mv = st.v * sec;
          if ((d > 0 && mv >= d) || (d < 0 && mv <= d)) { st.shown = st.k; st.v = 0; } else st.shown += mv;
        }
      }
      if (!fire.hold) fire.s = st.shown;
      else if (!fire.f && !st.drag && st.shown === st.k) { fire.old = fire.s; fire.s = st.k; fire.f = reduce ? 1e-6 : 1; }
      if (fire.f) { fire.f = Math.max(0, fire.f - dt / 900); if (!fire.f) fire.hold = st.shown !== st.k; }
      var r = Math.round(st.shown);
      // на ходу щёлкает только начало каждой волны, шагом — каждый день
      if (r !== lastInt) { if (Math.abs(st.v) < 7 || st.drag || mod(r, 13) === 0) click(mod(r, 13) === 0); lastInt = r; }
      if (fm < 1) fm = Math.min(1, fm + dt / 900);
      var sp = 1 / 1000;
      if (U !== Ut) U = U < Ut ? Math.min(Ut, U + dt * sp) : Math.max(Ut, U - dt * sp * 1.5);
      if (C !== Ct) C = C < Ct ? Math.min(Ct, C + dt / 900) : Math.max(Ct, C - dt / 900);
      // наклон: в объёме — как повернул человек (после смены формы или возврата из таблицы — к своему); в таблице и полотне — ровно
      var kk = Math.min(1, dt / 260);
      if (cam.pitchT != null) { cam.pitch += (cam.pitchT - cam.pitch) * kk; if (Ut === 0 && Math.abs(cam.pitchT - cam.pitch) < .002) cam.pitchT = null; }
      if (Ut > 0 && cam.yawT != null) cam.yaw += (cam.yawT - cam.yaw) * kk;
      else if (!drag && U === 0) {
        // отпустил — бублик ещё немного докручивается по инерции и затихает
        if (Math.abs(spin.x) + Math.abs(spin.y) > .0004 && !reduce) {
          cam.yaw += spin.x * dt / 16; cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch + spin.y * dt / 16));
          var fr = Math.pow(.94, dt / 16); spin.x *= fr; spin.y *= fr;
        } else if (!reduce) cam.yaw += .00008 * dt;
      }
      gDraw(); tDraw(now);
      requestAnimationFrame(frame);
    }
    // окна шестерёнок и бублика — одной высоты (её просьба 21.10): высоту бублика подгоняем под окно шестерёнок
    function fitH() {
      if (!open) return;
      tv.style.height = '';
      var one = getComputedStyle(gridEl).gridTemplateColumns.split(' ').length < 2;
      var h = tv.offsetHeight + gPan.offsetHeight - tPan.offsetHeight;
      tv.style.height = Math.round(Math.max(one ? 260 : 320, Math.min(h, window.innerHeight * (one ? .62 : .8)))) + 'px';
      tSize();
    }
    function start() { if (running || !open) return; running = true; last = 0; requestAnimationFrame(frame); }
    // не рисуем, когда механизма не видно на экране
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; if (seen) start(); }).observe(box);
    window.addEventListener('resize', function () { if (open && box.isConnected) { gLayout(); fitH(); } });

    setForm(opt.form); legend();
    return {
      // кины человека → механизм стоит на сегодня; к своему кину человек едет сам кнопкой «Мой кин» (её решение 21.10)
      show: function (kins, quiet) {
        mine = (kins || []).slice(); open = true; box.hidden = false;
        gLayout(); tSize(); setDate(T0); st.shown = st.k; st.v = 0; lastInt = Math.round(st.shown);
        fire.s = st.k; fire.hold = false; fire.f = 0;
        changed(); start(); fitH();
      },
      // кин — шестерёнки докручиваются к нему (±130 дней); с датой — ровно к этому дню
      go: function (k, iso) { if (!open) return; if (iso) setDate(isoT(iso)); else goKin(k); },
      hide: function () { open = false; running = false; box.hidden = true; }
    };
  }
  window.M13KINM = { mount: mount };
})();
