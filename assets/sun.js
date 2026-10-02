/* 13 MIRRORS · Солнце финала маршрута. ES5, без библиотек. window.M13S
   Стили (её выбор 02.10, проба — routes/yellow-sun/sun-lab.html): 'filigree' — Б «Золотая филигрань» (по умолчанию),
   'lace' — А «Кружево света». Тонкие линии на прозрачном фоне, цвет только подкрашивает лепестки.
   12 делений всегда (день = деление, цвет его стёклышка); в центре — стёклышки человека: середина — первое состояние выхода
   (ничего не выбрали — золото), вокруг — вход, подарки, остальные состояния выхода.
   Узор — из числа (seed, у личного Солнца — от кода): кольца, завитки, сквозная вязь дугами. Всё одинаково на любом устройстве.
   Живёт: раскрывается от центра, очень медленно поворачивается, по золоту наискосок проходит блеск полировки (первый — сразу
   после раскрытия, потом раз в 7–11 с), самоцветы по одному тихо вспыхивают искоркой. В каждый момент движется что-то одно.
   Вид 'paper' — для раскрашивания: чёрные линии на белом, подсказка цвета (hint) по желанию.
   Камни рисует kaleido.js (M13K.stone). */
(function () {
  'use strict';
  var TAU = Math.PI * 2, N = 12, W = TAU / N;
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6d2b79f5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function sm(k) { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); }
  function rgba(c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')'; }
  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  var WHITE = [255, 248, 230], GOLD = [233, 190, 110], GOLD_HI = [255, 236, 190], GOLD_DEEP = [176, 118, 36], GOLD_DEEP_HI = [236, 190, 104], BRONZE = [92, 54, 14];
  function styleOf(s) { return s === 'lace' ? 'lace' : 'filigree'; }

  /* ---------- Геометрия узора (единица — радиус; ось сектора — вдоль x; сектор зеркален по оси) ---------- */
  function P(r, a) { return [r * Math.cos(a), r * Math.sin(a)]; }
  function cub(p0, p1, p2, p3, n) {
    var o = [], i, t, u;
    for (i = 0; i <= n; i++) { t = i / n; u = 1 - t; o.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); }
    return o;
  }
  function flip(pts) { return pts.map(function (p) { return [p[0], -p[1]]; }); }
  // Замкнутая фигура из верхней половины (от основания к кончику на оси) и её зеркала
  function closed(up) { return up.concat(flip(up).reverse().slice(1)); }
  // Лепесток: основание r0, кончик r1, полуширина hw (радианы), b — пузатость, ogee — кончик с перегибом
  function petal(r0, r1, hw, b, ogee) {
    var L = r1 - r0, up;
    if (ogee) up = cub(P(r0, 0), P(r0 + L * .12, hw * 1.05 * b), P(r0 + L * .55, hw * 1.1), P(r0 + L * .72, hw * .45), 14)
      .concat(cub(P(r0 + L * .72, hw * .45), P(r0 + L * .82, hw * .12), P(r0 + L * .9, hw * .1), P(r1, 0), 10).slice(1));
    else up = cub(P(r0, 0), P(r0 + L * .2, hw * 1.15 * b), P(r0 + L * .7, hw * .95), P(r1, 0), 22);
    return closed(up);
  }
  // Двулистник-сердечко: две доли и выемка на оси
  function heart(r0, r1, hw) {
    var L = r1 - r0;
    return closed(cub(P(r0, 0), P(r0 + L * .3, hw * 1.25), P(r1 + L * .08, hw * 1.05), P(r1 - L * .18, 0), 24));
  }
  // Завиток: от точки a кривой к началу спирали (центр c, радиус rs, угол входа a0, направление dir, витков turns)
  function curl(a, c, rs, a0, dir, turns, ctrl) {
    var s = [c[0] + rs * Math.cos(a0), c[1] + rs * Math.sin(a0)], tg = [-Math.sin(a0) * dir, Math.cos(a0) * dir];
    var k = ctrl || .5, d = Math.sqrt(Math.pow(s[0] - a[0], 2) + Math.pow(s[1] - a[1], 2));
    var pts = cub(a, [a[0] + (s[0] - a[0]) * .35 + (c[0] - s[0]) * .3, a[1] + (s[1] - a[1]) * .35 + (c[1] - s[1]) * .3], [s[0] - tg[0] * d * k, s[1] - tg[1] * d * k], s, 18), i, t, ang, rr;
    var n = Math.round(28 * turns);
    for (i = 1; i <= n; i++) { t = i / n; ang = a0 + dir * turns * TAU * t; rr = rs * (1 - .78 * t); pts.push([c[0] + rr * Math.cos(ang), c[1] + rr * Math.sin(ang)]); }
    return pts;
  }
  function circle(r, n) { var o = [], i; n = n || 160; for (i = 0; i <= n; i++) o.push(P(r, i / n * TAU)); return o; }
  function circleAt(c, r, n) { var o = [], i; n = n || 24; for (i = 0; i <= n; i++) o.push([c[0] + r * Math.cos(i / n * TAU), c[1] + r * Math.sin(i / n * TAU)]); return o; }
  function turnAt(pts, b, a) { return pts.map(function (p) { return [b[0] + p[0] * Math.cos(a) - p[1] * Math.sin(a), b[1] + p[0] * Math.sin(a) + p[1] * Math.cos(a)]; }); }
  function shift(pts, da) { return pts.map(function (p) { var a = Math.atan2(p[1], p[0]) + da, r = Math.sqrt(p[0] * p[0] + p[1] * p[1]); return P(r, a); }); }

  // Узор: { sec: фигуры одного сектора [{ pts, fill: 'day'|'center'|null, ring, w }], all: фигуры на весь круг, gems: [{ r, a, s, k }] }
  function build(seed) {
    var R = rng(seed ^ 0x2f6a91c3), sec = [], all = [], i;
    function add(pts, fill, ring, w) { sec.push({ pts: pts, fill: fill || null, ring: ring, w: w || 1 }); }
    function both(pts, fill, ring, w) { add(pts, fill, ring, w); add(flip(pts), fill, ring, w); }
    var vA = Math.floor(R() * 3), vB = Math.floor(R() * 3), vC = Math.floor(R() * 3), vE = Math.floor(R() * 2);
    var bul = .85 + R() * .3, curlT = 1.1 + R() * .5;

    // Центр: розетка из 12 маленьких лепестков, два тонких кольца
    add(petal(.035, .15, W * .36, 1), 'center', .1, .8);
    all.push({ pts: circle(.17), ring: .17, w: .9 }); all.push({ pts: circle(.185), ring: .185, w: .6 });

    // Кольцо А (.19….42): внутренние лепестки
    if (vA === 0) { add(petal(.2, .42, W * .3, bul, true), 'day', .3); add(petal(.25, .36, W * .15, 1, true), null, .3, .6); add([P(.23, 0), P(.33, 0)], null, .3, .5); }
    else if (vA === 1) { add(heart(.2, .41, W * .42), 'day', .3); add(circleAt(P(.29, 0), .018), null, .3, .6); add([P(.22, 0), P(.27, 0)], null, .3, .5); }
    else { add(petal(.2, .41, W * .32, bul), 'day', .3); add(petal(.24, .39, W * .2, bul), null, .3, .6); add(petal(.28, .37, W * .12, 1), 'day', .3, .5); }
    // между лепестками — капля
    add(shift(petal(.33, .44, W * .1, 1), W / 2), null, .4, .6);
    all.push({ pts: circle(.445), ring: .445, w: .7 });

    // Кольцо Б (.45….74): главное — эльфийский мотив
    if (vB === 0) {
      // Лист-пламя на оси и два завитка из его основания
      add(petal(.47, .74, W * .2, bul, true), 'day', .6); add([P(.5, 0), P(.68, 0)], null, .6, .5);
      both(curl(P(.48, W * .07), P(.6, W * .33), .045, -Math.PI * .1, 1, curlT, .55), null, .6, .9);
      both(turnAt(petal(0, .06, .5, 1), P(.545, W * .2), .9), 'day', .55, .6);
    } else if (vB === 1) {
      // Стрельчатая арка через сектор, внутри — пара завитков с вершины
      var arch = cub(P(.455, W * .49), P(.6, W * .5), P(.7, W * .22), P(.745, 0), 24);
      add(closed(cub(P(.455, 0), P(.455, W * .25), P(.455, W * .45), P(.455, W * .49), 6).concat(arch.slice(1))), 'day', .6);
      both(curl(P(.72, 0), P(.6, W * .2), .04, Math.PI * .55, -1, curlT, .5), null, .6, .8);
      add(petal(.47, .6, W * .14, 1), null, .53, .6);
    } else {
      // Лира: две плавные ветви от основания, наружу и снова внутрь, кончики закручены
      both(cub(P(.46, 0), P(.52, W * .55), P(.66, W * .5), P(.7, W * .14), 30).concat(curl(P(.7, W * .14), P(.735, W * .2), .028, Math.PI, -1, curlT * .9, .4).slice(1)), null, .6, .9);
      add(petal(.5, .7, W * .12, 1, true), 'day', .6);
      both(turnAt(petal(0, .05, .5, 1), P(.6, W * .36), 1.6), 'day', .6, .6);
    }

    // Сквозная вязь: из основания каждого листа — длинная плавная дуга к венцу соседнего дня; дуги перекрещиваются стрельчатыми арками
    var ie = .74 + R() * .02;
    both(cub(P(.465, 0), P(.56, W * .04), P(.66, W * (.85 + R() * .2)), P(ie, W), 34), null, .62, .75);
    if (R() < .6) both(cub(P(.2, 0), P(.27, W * .05), P(.36, W * .8), P(.43, W), 24), null, .32, .6);

    // Кольцо В (.76….93): венец, в нём — стёклышко дня
    if (vC === 0) { add(closed(cub(P(.76, W * .5), P(.84, W * .48), P(.9, W * .3), P(.92, 0), 24)), 'day', .85); add(closed(cub(P(.79, W * .3), P(.84, W * .28), P(.885, W * .16), P(.895, 0), 16)), null, .85, .6); }
    else if (vC === 1) { add(petal(.765, .935, W * .3, bul, true), 'day', .85); both(curl(P(.77, W * .3), P(.86, W * .45), .025, -Math.PI * .5, 1, curlT * .8, .5), null, .85, .7); }
    else { add(heart(.765, .93, W * .36), 'day', .85); both(shift(petal(.78, .87, W * .1, 1), W * .5), null, .85, .6); }
    all.push({ pts: circle(.755), ring: .755, w: .7 });

    // Край: два тонких кольца и бусины или волна-лоза
    all.push({ pts: circle(.95), ring: .95, w: .8 }); all.push({ pts: circle(.99), ring: .99, w: .9 });
    if (vE === 0) for (i = 0; i < N * 6; i++) all.push({ pts: circleAt(P(.97, (i + .5) / (N * 6) * TAU), .006, 10), ring: .97, w: .6 });
    else { var wave = [], t; for (i = 0; i <= 720; i++) { t = i / 720 * TAU; wave.push(P(.97 + .011 * Math.sin(t * N * 3), t)); } all.push({ pts: wave, ring: .97, w: .6 }); }

    // Камни: стёклышко дня — в венце на оси; между днями — маленькая капелька света
    var gems = [{ r: vC === 1 ? .835 : .845, a: 0, s: .05, k: 'day' }, { r: .445, a: W / 2, s: .024, k: 'day2' }];
    return { sec: sec, all: all, gems: gems, glints: [.3, .6, .85] };
  }

  /* ---------- Рисование ---------- */
  var SPR = {};
  function gemSprite(c, look, px) {
    var key = c.join(',') + '|' + JSON.stringify(look || {}) + '|' + px;
    if (SPR[key]) return SPR[key];
    var cv = document.createElement('canvas');
    if (window.M13K && window.M13K.stone) window.M13K.stone(cv, c, look, px / Math.min(2, window.devicePixelRatio || 1));
    return (SPR[key] = cv);
  }
  function strokePts(x, pts, close) {
    x.beginPath(); pts.forEach(function (p, i) { x[i ? 'lineTo' : 'moveTo'](p[0], p[1]); }); if (close) x.closePath();
  }
  function isClosed(pts) { var a = pts[0], b = pts[pts.length - 1]; return pts.length > 3 && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6; }
  function centerAt(D, i, rad) { var n = D.center.length; return i ? P(rad * .118, -Math.PI / 2 + W / 2 + Math.round((i - 1) * N / Math.max(1, n - 1)) * W) : [0, 0]; }

  // Один кадр узора (центр — в начале координат). D — данные Солнца: { pat, cols, center, look, slook };
  // o: { style, mode: 'screen' | 'paper' | 'mask', hint, thick (1 = как есть), back — полупрозрачное напыление; open — раскрытие 0…1;
  //      ground: 'light' — Солнце на светлом фоне (картинка для телефона): золото глубже, кружево без «сложения света» }
  function draw(x, D, rad, o) {
    var style = styleOf(o.style), mode = o.mode || 'screen', paper = mode === 'paper', open = o.open == null ? 1 : o.open;
    var lite = !paper && o.ground === 'light', GD = lite ? GOLD_DEEP : GOLD, GH = lite ? GOLD_DEEP_HI : GOLD_HI;
    var cols = D.cols, S = D.pat, lw = rad * (style === 'lace' ? .0026 : .0034) * (o.thick || 1), k;
    if (mode === 'mask') { drawMask(x, D, style, rad, lw); return; }
    function vis(r) { return open >= 1 ? 1 : sm((open * 1.15 - r) / .16); }
    function colOf(s, d) { return s.fill === 'center' ? D.center[0] : cols[d]; }
    // Подложка: на бумаге — белый круг; на экране — лёгкое напыление, если включено
    if (paper) { x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, rad * 1.01, 0, TAU); x.fill(); }
    else if (o.back) {
      var g = x.createRadialGradient(0, 0, 0, 0, 0, rad);
      g.addColorStop(0, 'rgba(255,226,170,.20)'); g.addColorStop(.75, 'rgba(255,200,120,.09)'); g.addColorStop(1, 'rgba(255,190,100,.03)');
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, rad * Math.max(.05, Math.min(1, open * 1.15)), 0, TAU); x.fill();
    }
    // Подкраска: цвет лишь ложится на лепесток («можно так, а можно по-своему»)
    var tintA = paper ? (o.hint ? .16 : 0) : style === 'lace' ? .16 : .13;
    if (tintA) for (k = 0; k < N; k++) {
      x.save(); x.rotate(-Math.PI / 2 + k * W);
      S.sec.forEach(function (s) {
        if (!s.fill) return;
        var a = vis(s.ring) * tintA * (s.fill === 'center' ? .9 : s.ring > .8 ? .6 : 1); if (a < .005) return;
        strokePts(x, s.pts.map(function (p) { return [p[0] * rad, p[1] * rad]; }), true);
        x.fillStyle = rgba(paper ? mix(colOf(s, k), WHITE, .2) : colOf(s, k), a); x.fill();
      });
      x.restore();
    }
    // Линии
    function lines(pass) {
      function one(s, c, rot) {
        var a = vis(s.ring); if (a < .01) return;
        var pp = s.pts.map(function (p) { return [p[0] * rad, p[1] * rad]; }), w = lw * (s.w || 1);
        x.save(); if (rot != null) x.rotate(rot);
        strokePts(x, pp, isClosed(s.pts));
        if (paper) { x.strokeStyle = 'rgba(30,22,14,' + (.9 * a) + ')'; x.lineWidth = Math.max(.7, w * 1.1); x.stroke(); }
        else if (style === 'lace' && lite) {
          if (pass === 0) { x.strokeStyle = rgba(mix(c, WHITE, .5), .45 * a); x.lineWidth = w * 3.2; x.stroke(); }
          else { x.strokeStyle = rgba(mix(c, BRONZE, .55), .9 * a); x.lineWidth = w * 1.1; x.stroke(); }
        } else if (style === 'lace') {
          if (pass === 0) { x.strokeStyle = rgba(mix(c, WHITE, .3), .22 * a); x.lineWidth = w * 3.2; x.stroke(); }
          else { x.strokeStyle = rgba(mix(c, WHITE, .72), .95 * a); x.lineWidth = w; x.stroke(); }
        } else if (pass === 0) { x.strokeStyle = 'rgba(70,40,6,' + ((lite ? .7 : .55) * a) + ')'; x.lineWidth = w * 2.2; x.stroke(); }
        else { x.strokeStyle = rgba(GD, a); x.lineWidth = w * 1.25; x.stroke(); x.strokeStyle = rgba(GH, .7 * a); x.lineWidth = w * .45; x.stroke(); }
        x.restore();
      }
      for (k = 0; k < N; k++) S.sec.forEach(function (s) { one(s, s.fill === 'center' ? D.center[0] : cols[k], -Math.PI / 2 + k * W); });
      S.all.forEach(function (s) { one(s, GOLD); });
    }
    x.lineCap = 'round'; x.lineJoin = 'round';
    if (style === 'lace' && !paper && !lite) { x.globalCompositeOperation = 'lighter'; lines(0); lines(1); x.globalCompositeOperation = 'source-over'; }
    else if (paper) lines(1);
    else if (style === 'lace') { lines(0); lines(1); }
    else { lines(0); lines(1); }
    // Камни: стёклышки дней
    for (k = 0; k < N; k++) S.gems.forEach(function (gm) {
      var a = vis(gm.r); if (a < .02) return;
      var p = P(gm.r * rad, -Math.PI / 2 + k * W + gm.a), s = gm.s * rad * 2, c = gm.k === 'day2' ? mix(cols[k], cols[(k + 1) % N], .5) : cols[k];
      x.globalAlpha = a;
      if (paper) { x.strokeStyle = 'rgba(30,22,14,.9)'; x.lineWidth = Math.max(.7, lw); x.beginPath(); x.arc(p[0], p[1], s * .42, 0, TAU); x.stroke(); }
      else {
        if (style === 'filigree') { x.strokeStyle = rgba(GD, .9); x.lineWidth = lw * 1.2; x.beginPath(); x.arc(p[0], p[1], s * .56, 0, TAU); x.stroke(); }
        else { var gl = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], s * 1.1); gl.addColorStop(0, rgba(c, .35)); gl.addColorStop(1, rgba(c, 0)); x.fillStyle = gl; x.fillRect(p[0] - s * 1.1, p[1] - s * 1.1, s * 2.2, s * 2.2); }
        x.drawImage(gemSprite(c.map(Math.round), gm.k === 'day' ? D.look : { kind: 'cabochon', shine: 100 }, Math.max(8, Math.round(s))), p[0] - s / 2, p[1] - s / 2, s, s);
      }
      x.globalAlpha = 1;
    });
    // Центр: стёклышки человека — одно в середине, остальные вокруг
    var a0 = vis(.05);
    if (a0 > .02) {
      x.globalAlpha = a0;
      D.center.forEach(function (c, i) {
        var p = centerAt(D, i, rad), s = rad * (i ? .046 : .1);
        if (paper) { x.strokeStyle = 'rgba(30,22,14,.9)'; x.lineWidth = Math.max(.7, lw); x.beginPath(); x.arc(p[0], p[1], s * .45, 0, TAU); x.stroke(); return; }
        if (style === 'filigree') { x.strokeStyle = rgba(GD, .9); x.lineWidth = lw * 1.1; x.beginPath(); x.arc(p[0], p[1], s * .58, 0, TAU); x.stroke(); }
        else { var gl = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], s); gl.addColorStop(0, rgba(c, .4)); gl.addColorStop(1, rgba(c, 0)); x.fillStyle = gl; x.fillRect(p[0] - s, p[1] - s, s * 2, s * 2); }
        x.drawImage(gemSprite(c.map(Math.round), D.slook, Math.max(8, Math.round(s))), p[0] - s / 2, p[1] - s / 2, s, s);
      });
      x.globalAlpha = 1;
    }
  }
  // Где камни (для мерцания): [x, y, размер]
  function gemSpots(D, rad) {
    var o = [], k;
    for (k = 0; k < N; k++) D.pat.gems.forEach(function (gm) { var p = P(gm.r * rad, -Math.PI / 2 + k * W + gm.a); o.push([p[0], p[1], gm.s * rad * 2]); });
    D.center.forEach(function (c, i) { var p = centerAt(D, i, rad); o.push([p[0], p[1], rad * (i ? .046 : .1)]); });
    return o;
  }
  // Трафарет золота: только линии и оправы камней — по нему бежит блеск полировки
  function drawMask(x, D, style, rad, lw) {
    x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
    function one(s, rot) {
      x.save(); if (rot != null) x.rotate(rot);
      strokePts(x, s.pts.map(function (p) { return [p[0] * rad, p[1] * rad]; }), isClosed(s.pts)); x.lineWidth = lw * (s.w || 1) * (style === 'lace' ? 1.6 : 1.4); x.stroke();
      x.restore();
    }
    var k;
    for (k = 0; k < N; k++) D.pat.sec.forEach(function (s) { one(s, -Math.PI / 2 + k * W); });
    D.pat.all.forEach(function (s) { one(s); });
    gemSpots(D, rad).forEach(function (g) { x.lineWidth = lw * 1.4; x.beginPath(); x.arc(g[0], g[1], g[2] * .56, 0, TAU); x.stroke(); x.globalAlpha = .55; x.beginPath(); x.arc(g[0], g[1], g[2] * .4, 0, TAU); x.fill(); x.globalAlpha = 1; });
  }
  // Искорка на камне: тонкие лучи крестом, тихо вспыхивает и гаснет
  function sparkle(x, px, py, s, a, turn) {
    x.save(); x.translate(px, py); x.rotate(turn); x.globalCompositeOperation = 'lighter';
    var g = x.createRadialGradient(0, 0, 0, 0, 0, s * .5);
    g.addColorStop(0, 'rgba(255,255,255,' + (.75 * a) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(-s * .5, -s * .5, s, s);
    [[1.5, 0], [1.5, Math.PI / 2], [.75, Math.PI / 4], [.75, -Math.PI / 4]].forEach(function (r) {
      var L = s * r[0] * (.6 + .4 * a), lg;
      x.save(); x.rotate(r[1]);
      lg = x.createLinearGradient(-L, 0, L, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.5, 'rgba(255,255,255,' + (.95 * a) + ')'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = lg; x.beginPath(); x.moveTo(-L, 0); x.lineTo(0, -s * .045); x.lineTo(L, 0); x.lineTo(0, s * .045); x.closePath(); x.fill();
      x.restore();
    });
    x.restore();
  }

  // Данные Солнца: seed — узор; cols — 12 цветов дней [r,g,b]; center — стёклышки человека (первое — в середине);
  // look — вид камней дней, slook — вид стёклышек в центре (M13K, «Стёклышки»)
  function data(seed, cols, center, look, slook) {
    return { pat: build(seed >>> 0), cols: cols, center: center && center.length ? center : [[255, 205, 110]], look: look || { kind: 'gem', cut: 'rect', shine: 100 }, slook: slook || { kind: 'cabochon', shine: 100 } };
  }
  // Одним кадром на любом холсте (картинка, PDF): центр (cx, cy), радиус rad
  function still(ctx, D, cx, cy, rad, o) { ctx.save(); ctx.translate(cx, cy); draw(ctx, D, rad, o || {}); ctx.restore(); }

  /* ---------- Живое Солнце на холсте ----------
     o: { style, thick, back, shine — сила блеска и искорок (1 — как в пробе) }.
     show(D) — сразу целиком; unfold(ms) — раскрыться от центра; stop() — остановить. Холст квадратный, размер — по CSS. */
  function Sun(cv, o) {
    o = o || {};
    var x = cv.getContext('2d'), D = null, raf = 0, still0 = null, mask = null, tmp = document.createElement('canvas'), spots = [];
    var t0 = 0, T = 0, lastT = 0, rot = 0, openAt = -1, openDur = 0, G = null, GT = null, SH = null, shine = o.shine == null ? 1 : o.shine;
    function size() {
      var dpr = Math.min(2, window.devicePixelRatio || 1), px = Math.round((cv.clientWidth || 300) * dpr);
      if (cv.width !== px) { cv.width = cv.height = px; still0 = null; mask = null; }
    }
    function opts(m, open) { return { style: o.style, thick: o.thick, back: o.back, mode: m, open: open }; }
    function openK() { return openAt < 0 ? 1 : Math.min(1, (T - openAt) / openDur); }
    function render() {
      var Dm = cv.width, rad = Dm / 2 * .96, open = openK();
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, Dm, Dm);
      x.translate(Dm / 2, Dm / 2); x.rotate(rot);
      if (open >= 1 && !still0) {
        still0 = document.createElement('canvas'); still0.width = still0.height = Dm;
        var y = still0.getContext('2d'); y.translate(Dm / 2, Dm / 2); draw(y, D, rad, opts('screen', 1));
        mask = document.createElement('canvas'); mask.width = mask.height = Dm;
        y = mask.getContext('2d'); y.translate(Dm / 2, Dm / 2); draw(y, D, rad, opts('mask', 1));
        tmp.width = tmp.height = Dm; spots = gemSpots(D, rad);
      }
      if (open >= 1) x.drawImage(still0, -Dm / 2, -Dm / 2); else draw(x, D, rad, opts('screen', open));
      // Облачко-блик: одно место за раз, слабо
      if (G) {
        var k = (T - G.t) / G.dur;
        if (k > 0 && k < 1) {
          var a = Math.sin(k * Math.PI), p = P(G.r * rad, G.a), rr = rad * .13, g = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], rr);
          g.addColorStop(0, rgba(mix(G.c, WHITE, .6), .2 * a * shine)); g.addColorStop(1, rgba(G.c, 0));
          x.globalCompositeOperation = 'lighter'; x.fillStyle = g; x.fillRect(p[0] - rr, p[1] - rr, rr * 2, rr * 2); x.globalCompositeOperation = 'source-over';
        }
      }
      if (open < 1 || !mask) return;
      // Самоцвет мерцает: по одному, медленно
      if (GT) { var q = (T - GT.t) / GT.dur; if (q > 0 && q < 1 && spots[GT.i]) { var sp = spots[GT.i]; sparkle(x, sp[0], sp[1], sp[2] * 1.5, Math.min(1, shine) * Math.pow(Math.sin(q * Math.PI), 1.5), q * .6 - rot); } }
      // Блеск полировки: светлая полоса медленно проходит по золоту наискосок (как блик на витрине)
      if (SH) {
        var f = (T - SH.t) / SH.dur;
        if (f > 0 && f < 1) {
          var e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2, c = 1.6 * e - .3, t = tmp.getContext('2d'), ang = 100 * Math.PI / 180;
          t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, Dm, Dm);
          t.translate(Dm / 2, Dm / 2); t.rotate(rot); t.drawImage(mask, -Dm / 2, -Dm / 2); t.setTransform(1, 0, 0, 1, 0, 0);
          var dx = Math.cos(ang) * Dm, dy = Math.sin(ang) * Dm, lg = t.createLinearGradient(Dm / 2 - dx / 2, Dm / 2 - dy / 2, Dm / 2 + dx / 2, Dm / 2 + dy / 2);
          var hc = styleOf(o.style) === 'lace' ? '255,250,235' : '255,238,190';
          lg.addColorStop(Math.max(0, Math.min(1, c - .17)), 'rgba(' + hc + ',0)');
          lg.addColorStop(Math.max(0, Math.min(1, c)), 'rgba(' + hc + ',' + Math.min(1, .95 * shine).toFixed(3) + ')');
          lg.addColorStop(Math.max(0, Math.min(1, c + .17)), 'rgba(' + hc + ',0)');
          t.globalCompositeOperation = 'source-in'; t.fillStyle = lg; t.fillRect(0, 0, Dm, Dm);
          x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'lighter'; x.drawImage(tmp, 0, 0); x.drawImage(tmp, 0, 0); x.globalCompositeOperation = 'source-over';
        }
      }
    }
    function step(ts) {
      raf = requestAnimationFrame(step);
      // Спрятан (вкладка, ещё не показан) — ждём
      if (!cv.clientWidth) return;
      if (!t0) t0 = ts - T * 1000;
      T = (ts - t0) / 1000;
      var dt = Math.min(.1, Math.max(0, T - lastT)); lastT = T;
      size();
      rot += dt * TAU / 360;
      if (!G || T > G.t + G.dur) { var kk = Math.floor(Math.random() * N); G = { t: T + 1.2 + Math.random() * 2.2, dur: 2.6, a: -Math.PI / 2 + kk * W, r: D.pat.glints[Math.floor(Math.random() * 3)], c: D.cols[kk] }; }
      if (spots.length && (!GT || T > GT.t + GT.dur)) GT = { t: T + .5 + Math.random() * 1.6, dur: 2.2, i: Math.floor(Math.random() * spots.length) };
      // Первый блеск — сразу как Солнце раскрылось, дальше — раз в 7–11 секунд
      if (openK() < 1 || !SH) SH = { t: (openAt < 0 ? T : openAt + openDur) + .4, dur: 3.4 };
      else if (T > SH.t + SH.dur) SH = { t: T + 4 + Math.random() * 4, dur: 3.4 };
      render();
    }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    return {
      show: function (d) {
        D = d; still0 = null; mask = null; openAt = -1; G = GT = SH = null;
        size(); render();
        if (!REDUCED && !raf) raf = requestAnimationFrame(step);
      },
      unfold: function (ms) { if (REDUCED || !ms) { openAt = -1; return; } openAt = T; openDur = ms / 1000; SH = null; if (D) render(); },
      opts: function (p) { for (var k in p) o[k] = p[k]; if (p.shine != null) shine = p.shine; still0 = null; mask = null; if (D) render(); },
      stop: stop
    };
  }

  window.M13S = { Sun: Sun, data: data, still: still, draw: draw, styleOf: styleOf, STYLES: ['filigree', 'lace'] };
})();
