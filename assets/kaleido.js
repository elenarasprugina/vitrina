/* 13 MIRRORS · живой калейдоскоп-витраж. ES5, без библиотек. window.M13K
   Узор — из числа (seed, у личного узора — h32 от кода): число зеркал, самоцветы, рисунок граней, ритм движения.
   Всё — функция (seed, время): на любом устройстве и в панели узор одинаковый; кадр t = 0 — «фирменный» (его и сохраняют).
   Рисуется один сектор (на отдельном холсте), остальные — его зеркальные отражения, как в настоящем калейдоскопе.
   Стили: 'rose' — витраж-роза (грани с золотыми прожилками), 'gems' — самоцветы пересыпаются между зеркалами,
   'mix' — роза с самоцветами (витражная основа, поверх плывут кристаллы). Образец стиля — docs/yellow-sun-img/kaleidoscope-style.webp */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

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
  // Цвет: k < 1 — темнее, k > 1 — светлее (к белому)
  function shade(c, k) {
    var i, o = [];
    for (i = 0; i < 3; i++) o.push(Math.round(k <= 1 ? c[i] * k : c[i] + (255 - c[i]) * Math.min(1, k - 1)));
    return o;
  }
  function css(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a == null ? 1 : a) + ')'; }
  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function smooth(k) { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); }

  // Самоцветы. Золото и янтарь есть у всех (общая нить маршрута), остальные камни — свои у каждого узора.
  var GOLD = [234, 168, 40], AMBER = [214, 104, 20];
  var GEMS = [
    [226, 38, 74],   // рубин
    [176, 26, 70],   // гранат
    [255, 208, 70],  // цитрин
    [24, 172, 112],  // изумруд
    [42, 192, 196],  // бирюза
    [44, 96, 226],   // сапфир
    [150, 82, 220],  // аметист
    [240, 98, 164],  // турмалин
    [196, 214, 255]  // хрусталь
  ];

  /* ---------- Узор из числа ---------- */
  // ex (необязательно): { sym: число пар зеркал (6 = 12 лучей), glass: [{ c: [r, g, b], sh: форма }, …] — узор из заданных стёклышек
  //   (финал маршрута: стёклышки дней, состояния, бонусные); их цвета идут и в витраж }
  function pattern(seed, style, ex) {
    ex = ex || {};
    var R = rng(seed >>> 0), sym = [6, 8, 10, 12][Math.floor(R() * 4)], W, i, j, pick = GEMS.slice(), pal = [GOLD, AMBER], glass = ex.glass && ex.glass.length ? ex.glass : null;
    if (ex.sym) sym = ex.sym;
    W = Math.PI / sym;
    if (glass) glass.forEach(function (g) { if (!pal.some(function (c) { return c[0] === g.c[0] && c[1] === g.c[1] && c[2] === g.c[2]; })) pal.push(g.c); });
    else {
      for (i = 0; i < 3; i++) pal.push(pick.splice(Math.floor(R() * pick.length), 1)[0]);
      if (R() < .35 && pal.indexOf(GEMS[8]) < 0) pal.push(GEMS[8]);
    }
    var P = { seed: seed >>> 0, style: style || 'mix', sym: sym, W: W, pal: pal, spin: (R() < .5 ? -1 : 1) * (.012 + R() * .012), sprites: {}, off: null };
    function col() { return R() < .16 ? Math.floor(R() * 2) : 2 + Math.floor(R() * (pal.length - 2)); }

    // Витраж: кольца граней от центра к краю; на кольце столько вершин, сколько помещается по ширине сектора
    var rings = 4 + Math.floor(R() * 3), seg = .1 + R() * .07, rr = [], acc = 0, gaps = [], r0 = .1 + R() * .05;
    for (i = 0; i < rings; i++) { gaps.push(.6 + R()); acc += gaps[i]; }
    rr.push(r0);
    for (i = 0; i < rings; i++) rr.push(rr[i] + gaps[i] / acc * (1.06 - r0));
    P.rings = [];
    for (i = 0; i < rr.length; i++) {
      var m = Math.max(2, Math.round(rr[i] * W / seg) + 1 + (i % 2)), ring = [];
      for (j = 0; j < m; j++) ring.push({ a: W * j / (m - 1), r: rr[i], edge: j === 0 || j === m - 1,
        ja: (R() - .5) * .5 * W / (m - 1), wa: .15 + R() * .35, pa: R() * TAU,
        jr: (R() - .5) * .45 * (i < rings ? gaps[Math.min(i, rings - 1)] / acc : .02), wr: .12 + R() * .3, pr: R() * TAU });
      P.rings.push(ring);
    }
    // Треугольники между соседними кольцами (по исходным углам — рисунок не «прыгает»)
    P.tris = [];
    function tri(a, b, c) { P.tris.push({ v: [a, b, c], c1: col(), c2: col(), w: .08 + R() * .22, p: R() * TAU, wl: .2 + R() * .5, pl: R() * TAU, from: Math.floor(R() * 3) }); }
    var core = { a: W / 2, r: 0, edge: true, ja: 0, jr: 0, wa: 0, pa: 0, wr: 0, pr: 0 };
    for (j = 0; j < P.rings[0].length - 1; j++) tri(core, P.rings[0][j], P.rings[0][j + 1]);
    for (i = 0; i < P.rings.length - 1; i++) {
      var A = P.rings[i], B = P.rings[i + 1], x = 0, y = 0;
      while (x < A.length - 1 || y < B.length - 1) {
        if (x < A.length - 1 && (y === B.length - 1 || A[x + 1].a <= B[y + 1].a)) { tri(A[x], A[x + 1], B[y]); x++; }
        else { tri(A[x], B[y], B[y + 1]); y++; }
      }
    }
    // Искры — на некоторых вершинах
    P.sparks = [];
    for (i = 1; i < P.rings.length; i++) for (j = 0; j < P.rings[i].length; j++) if (R() < .22) P.sparks.push({ v: P.rings[i][j], w: .3 + R() * .5, p: R() * TAU, s: .025 + R() * .03 });
    P.glow = { w1: .13 + R() * .1, w2: .17 + R() * .12, p: R() * TAU };

    // Самоцветы: «камера» шире сектора; камни медленно плывут по кругу (внутренние быстрее), кувыркаются, входят и выходят через зеркала
    var n = style === 'gems' ? 24 + Math.floor(R() * 9) : 9 + Math.floor(R() * 5), shapes = ['brilliant', 'hex', 'emerald', 'trillion', 'marquise', 'bead'];
    P.chamber = W * 2.6; P.gems = [];
    function palIx(c) { for (var k = 0; k < pal.length; k++) if (pal[k][0] === c[0] && pal[k][1] === c[1] && pal[k][2] === c[2]) return k; return 0; }
    // Мало стёклышек (вход: три состояния) — каждое лежит в камере дважды и крупнее, чтобы камни читались, а не терялись точками
    var rep = glass && glass.length < 6 ? 2 : 1, big = glass && glass.length < 6 ? 1.5 : 1;
    if (glass) n = glass.length * rep;
    for (i = 0; i < n; i++) {
      var gr = .14 + Math.pow(R(), .8) * .9, gi = glass ? glass[i % glass.length] : null;
      P.gems.push({ a: glass ? (i + R() * .8) / n * P.chamber : R() * P.chamber, r: gr, s: (.045 + R() * .085) * (.65 + gr * .55) * (style === 'gems' ? 1 : 1.12) * big,
        sh: gi ? gi.sh || 'brilliant' : shapes[Math.floor(R() * shapes.length)], c: gi ? palIx(gi.c) : 2 + Math.floor(R() * (pal.length - 2)) - (R() < .2 ? 2 : 0),
        w: (.05 + R() * .07) * (1.25 - gr * .5), rot: R() * TAU, wr: (R() - .5) * .5, br: .025 + R() * .03, wb: .1 + R() * .25, pb: R() * TAU,
        sp: R() * TAU, sw: .25 + R() * .4 });
    }
    return P;
  }

  /* ---------- Спрайт камня: огранка рисуется один раз, потом только поворачивается ---------- */
  var SHAPES = {
    brilliant: function () { var v = [], i; for (i = 0; i < 8; i++) v.push([Math.cos(i / 8 * TAU + TAU / 16), Math.sin(i / 8 * TAU + TAU / 16)]); return v; },
    hex: function () { var v = [], i; for (i = 0; i < 6; i++) v.push([Math.cos(i / 6 * TAU), Math.sin(i / 6 * TAU) * .92]); return v; },
    emerald: function () { return [[1, -.38], [1, .38], [.72, .66], [-.72, .66], [-1, .38], [-1, -.38], [-.72, -.66], [.72, -.66]]; },
    trillion: function () { var v = [], i, a; for (i = 0; i < 3; i++) { a = i / 3 * TAU - Math.PI / 2; v.push([Math.cos(a - .16) * .98, Math.sin(a - .16) * .98 + .12]); v.push([Math.cos(a + .16) * .98, Math.sin(a + .16) * .98 + .12]); } return v; },
    marquise: function () { var v = [], i, a; for (i = 0; i < 10; i++) { a = i / 10 * TAU; v.push([Math.cos(a), Math.sin(a) * .46 * Math.pow(Math.abs(Math.sin(a)), .35)]); } return v; }
  };
  function sprite(P, sh, ci) {
    var key = sh + ci;
    if (P.sprites[key]) return P.sprites[key];
    var S = 112, cv = document.createElement('canvas'), x = cv.getContext('2d'), c = P.pal[ci], h = S / 2, k = h * .92, i, v, t, a, lt, g;
    cv.width = cv.height = S; x.translate(h, h);
    if (sh === 'bead') {
      // Кабошон — гладкий отполированный камень: тёмная кромка, свет проходит насквозь и собирается внизу справа, блик сверху слева
      var r0 = k * .8;
      g = x.createRadialGradient(-r0 * .25, -r0 * .3, r0 * .05, 0, 0, r0);
      g.addColorStop(0, css(shade(c, 1.35))); g.addColorStop(.45, css(shade(c, .95))); g.addColorStop(.85, css(shade(c, .5))); g.addColorStop(1, css(shade(c, .28)));
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, r0, 0, TAU); x.fill();
      g = x.createRadialGradient(r0 * .3, r0 * .38, 0, r0 * .3, r0 * .38, r0 * .62);
      g.addColorStop(0, css(shade(c, 1.6), .85)); g.addColorStop(1, css(shade(c, 1.2), 0));
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, r0, 0, TAU); x.fill();
      x.strokeStyle = css(shade(c, 1.5), .45); x.lineWidth = r0 * .06; x.beginPath(); x.arc(0, 0, r0 * .93, .25 * Math.PI, .95 * Math.PI); x.stroke();
      g = x.createRadialGradient(-r0 * .34, -r0 * .4, 0, -r0 * .34, -r0 * .4, r0 * .34);
      g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.ellipse(-r0 * .32, -r0 * .4, r0 * .3, r0 * .18, -.6, 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.arc(r0 * .42, -r0 * .5, r0 * .05, 0, TAU); x.fill();
    } else {
      v = SHAPES[sh](); t = v.map(function (p) { return [p[0] * .52, p[1] * .52]; });
      lt = -2.3; // свет сверху слева
      for (i = 0; i < v.length; i++) {
        var j = (i + 1) % v.length, mx = (v[i][0] + v[j][0]) / 2, my = (v[i][1] + v[j][1]) / 2;
        a = Math.atan2(my, mx);
        x.fillStyle = css(shade(c, .5 + .85 * Math.max(0, Math.cos(a - lt)) + (i % 2) * .12));
        x.beginPath(); x.moveTo(v[i][0] * k, v[i][1] * k); x.lineTo(v[j][0] * k, v[j][1] * k); x.lineTo(t[j][0] * k, t[j][1] * k); x.lineTo(t[i][0] * k, t[i][1] * k); x.closePath(); x.fill();
      }
      g = x.createLinearGradient(-k * .5, -k * .5, k * .5, k * .5);
      g.addColorStop(0, css(shade(c, 1.55))); g.addColorStop(.5, css(shade(c, 1.05))); g.addColorStop(1, css(shade(c, .7)));
      x.fillStyle = g; x.beginPath();
      for (i = 0; i < t.length; i++) x[i ? 'lineTo' : 'moveTo'](t[i][0] * k, t[i][1] * k);
      x.closePath(); x.fill();
      // «Огонь» внутри камня: свет, преломлённый нижними гранями, — тёплое пятно под площадкой
      g = x.createRadialGradient(k * .14, k * .18, 0, k * .14, k * .18, k * .5);
      g.addColorStop(0, css(shade(c, 1.8), .55)); g.addColorStop(1, css(shade(c, 1.3), 0));
      x.fillStyle = g; x.beginPath();
      for (i = 0; i < t.length; i++) x[i ? 'lineTo' : 'moveTo'](t[i][0] * k, t[i][1] * k);
      x.closePath(); x.fill();
      // Тёмный поясок по краю — камень читается объёмным, а не плоской наклейкой
      x.strokeStyle = css(shade(c, .3), .8); x.lineWidth = k * .05; x.beginPath();
      for (i = 0; i <= v.length; i++) x[i ? 'lineTo' : 'moveTo'](v[i % v.length][0] * k, v[i % v.length][1] * k);
      x.stroke();
      // Рёбра огранки — тонкие светлые линии
      x.strokeStyle = 'rgba(255,250,235,.38)'; x.lineWidth = 1.2; x.lineJoin = 'round';
      x.beginPath();
      for (i = 0; i < v.length; i++) { x.moveTo(v[i][0] * k, v[i][1] * k); x.lineTo(t[i][0] * k, t[i][1] * k); }
      for (i = 0; i <= v.length; i++) x[i ? 'lineTo' : 'moveTo'](v[i % v.length][0] * k, v[i % v.length][1] * k);
      for (i = 0; i <= t.length; i++) x[i ? 'lineTo' : 'moveTo'](t[i % t.length][0] * k, t[i % t.length][1] * k);
      x.stroke();
      x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.moveTo(-k * .34, -k * .3); x.lineTo(-k * .12, -k * .36); x.lineTo(-k * .26, -k * .12); x.closePath(); x.fill();
    }
    P.sprites[key] = cv;
    return cv;
  }
  function star(x, cx, cy, s, a) {
    if (a < .02) return;
    var g = x.createRadialGradient(cx, cy, 0, cx, cy, s);
    g.addColorStop(0, 'rgba(255,252,236,' + a + ')'); g.addColorStop(.25, 'rgba(255,236,190,' + a * .5 + ')'); g.addColorStop(1, 'rgba(255,220,150,0)');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(cx - s, cy); x.quadraticCurveTo(cx, cy, cx, cy - s); x.quadraticCurveTo(cx, cy, cx + s, cy); x.quadraticCurveTo(cx, cy, cx, cy + s); x.quadraticCurveTo(cx, cy, cx - s, cy); x.fill();
    x.beginPath(); x.arc(cx, cy, s * .32, 0, TAU); x.fill();
  }

  /* ---------- Один сектор на отдельном холсте ---------- */
  function vpos(v, t, rad) {
    var a = v.edge ? v.a : v.a + v.ja * Math.sin(t * v.wa + v.pa), r = v.r + (v.r ? v.jr * Math.sin(t * v.wr + v.pr) : 0);
    return [Math.cos(a) * r * rad, Math.sin(a) * r * rad];
  }
  function drawRose(x, P, t, rad, dim) {
    var i, T, a, b, c, k, col, g, from, op, mx, my, lw = Math.max(1, rad * .011), pts = [];
    for (i = 0; i < P.tris.length; i++) {
      T = P.tris[i]; a = vpos(T.v[0], t, rad); b = vpos(T.v[1], t, rad); c = vpos(T.v[2], t, rad); pts.push([a, b, c]);
      k = smooth(.5 + .5 * Math.sin(t * T.w + T.p));
      col = mix(P.pal[T.c1], P.pal[T.c2], k).map(Math.round);
      var l = (.82 + .28 * Math.sin(t * T.wl + T.pl)) * dim;
      from = [a, b, c][T.from]; op = [[b, c], [c, a], [a, b]][T.from];
      mx = (op[0][0] + op[1][0]) / 2; my = (op[0][1] + op[1][1]) / 2;
      g = x.createLinearGradient(from[0], from[1], mx, my);
      g.addColorStop(0, css(shade(col, 1 + .4 * l))); g.addColorStop(.45, css(shade(col, .92 * l))); g.addColorStop(1, css(shade(col, .4 * l)));
      x.fillStyle = g;
      x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(c[0], c[1]); x.closePath(); x.fill();
    }
    // Золотые прожилки: тёмная подложка, золото, светлая кромка
    x.beginPath();
    for (i = 0; i < pts.length; i++) { x.moveTo(pts[i][0][0], pts[i][0][1]); x.lineTo(pts[i][1][0], pts[i][1][1]); x.lineTo(pts[i][2][0], pts[i][2][1]); x.closePath(); }
    x.lineJoin = 'round';
    x.strokeStyle = 'rgba(38,22,4,.92)'; x.lineWidth = lw * 1.9; x.stroke();
    x.strokeStyle = '#c99a45'; x.lineWidth = lw; x.stroke();
    x.strokeStyle = 'rgba(255,240,196,.5)'; x.lineWidth = lw * .35; x.stroke();
  }
  function drawGems(x, P, t, rad) {
    var i, G, a, r, s, px, py, sp, m0 = (P.chamber - P.W) / 2;
    // У «самоцветов» камни просвечивают друг сквозь друга (screen); поверх витража — лежат чётко
    x.globalCompositeOperation = P.style === 'gems' ? 'screen' : 'source-over';
    for (i = 0; i < P.gems.length; i++) {
      G = P.gems[i];
      a = ((G.a + G.w * t * P.dir) % P.chamber + P.chamber) % P.chamber - m0;
      r = G.r + G.br * Math.sin(t * G.wb + G.pb); s = G.s * rad;
      if (a < -G.s * 1.6 / r || a > P.W + G.s * 1.6 / r) continue;
      px = Math.cos(a) * r * rad; py = Math.sin(a) * r * rad;
      sp = sprite(P, G.sh, G.c);
      x.save(); x.translate(px, py); x.rotate(G.rot + G.wr * t); x.globalAlpha = .92;
      x.drawImage(sp, -s, -s, s * 2, s * 2);
      x.restore();
      x.globalAlpha = 1;
      star(x, px - s * .3, py - s * .3, s * .9, Math.pow(Math.max(0, Math.sin(t * G.sw + G.sp)), 14) * .9);
    }
    x.globalCompositeOperation = 'source-over';
  }
  function source(P, t, rad) {
    var W = P.W, mg = Math.ceil(rad * .08), w = Math.ceil(rad * 1.08) + 2, h = Math.ceil(rad * 1.08 * Math.sin(W) + mg * 2) + 2, x, i, S, g, gx, gy, gr;
    if (!P.off) P.off = document.createElement('canvas');
    if (P.off.width !== w || P.off.height !== h) { P.off.width = w; P.off.height = h; }
    x = P.off.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h); x.translate(0, mg);
    P.dir = P.spin < 0 ? -1 : 1;
    if (P.style !== 'gems') drawRose(x, P, t, rad, P.style === 'mix' ? .72 : 1);
    if (P.style !== 'rose') drawGems(x, P, t, rad);
    // Свет сквозь стекло: блуждающее тёплое пятно (в отражениях — пульсирующее кольцо света) и искры на вершинах
    x.globalCompositeOperation = 'lighter';
    gr = .55 + .35 * Math.sin(t * P.glow.w1 + P.glow.p); gx = Math.cos(W * (.5 + .5 * Math.sin(t * P.glow.w2))) * gr * rad; gy = Math.sin(W * (.5 + .5 * Math.sin(t * P.glow.w2))) * gr * rad;
    g = x.createRadialGradient(gx, gy, 0, gx, gy, rad * .32);
    g.addColorStop(0, 'rgba(255,236,190,.26)'); g.addColorStop(1, 'rgba(255,220,150,0)');
    x.fillStyle = g; x.fillRect(0, -mg, w, h);
    if (P.style !== 'gems') for (i = 0; i < P.sparks.length; i++) {
      S = P.sparks[i]; var p = vpos(S.v, t, rad);
      star(x, p[0], p[1], S.s * rad, Math.pow(Math.max(0, Math.sin(t * S.w + S.p)), 10) * .95);
    }
    x.globalCompositeOperation = 'source-over';
    return mg;
  }

  /* ---------- Кадр: сектор отражается по кругу; поверх — «пуговка» в центре, оправа ---------- */
  // layers — [[узор, время, прозрачность], …]; rot — поворот всего круга; flash — вспышка при повороте (0…1)
  function frame(ctx, layers, cx, cy, rad, rot, flash) {
    var g, k, L, P, mg, e, n, i;
    ctx.save(); ctx.translate(cx, cy);
    ctx.beginPath(); ctx.arc(0, 0, rad, 0, TAU); ctx.clip();
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
    g.addColorStop(0, '#2c1a07'); g.addColorStop(.65, '#140b04'); g.addColorStop(1, '#070402');
    ctx.fillStyle = g; ctx.fillRect(-rad, -rad, rad * 2, rad * 2);
    for (n = 0; n < layers.length; n++) {
      L = layers[n]; P = L[0];
      if (L[2] < .01) continue;
      mg = source(P, L[1], rad); e = .7 / rad;
      ctx.save(); ctx.rotate(rot + P.spin * L[1]); ctx.globalAlpha = L[2];
      for (k = 0; k < P.sym * 2; k++) {
        ctx.save();
        if (k % 2) { ctx.rotate((k + 1) * P.W); ctx.scale(1, -1); } else ctx.rotate(k * P.W);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, rad * 1.02, -e, P.W + e); ctx.closePath(); ctx.clip();
        ctx.drawImage(P.off, 0, -mg);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    P = layers[layers.length - 1][0];
    // Пуговка в центре — золотая, с бусинами по числу зеркал
    var bs = rad * .085;
    g = ctx.createRadialGradient(-bs * .3, -bs * .35, bs * .1, 0, 0, bs);
    g.addColorStop(0, '#fff6d6'); g.addColorStop(.45, '#eabf62'); g.addColorStop(1, '#7a4c12');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, bs, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(40,22,4,.85)'; ctx.lineWidth = Math.max(1, rad * .008); ctx.stroke();
    ctx.fillStyle = '#e2b35a';
    for (i = 0; i < P.sym; i++) { ctx.beginPath(); ctx.arc(Math.cos(i / P.sym * TAU + rot) * bs * 1.32, Math.sin(i / P.sym * TAU + rot) * bs * 1.32, rad * .013, 0, TAU); ctx.fill(); }
    if (flash > .01) {
      ctx.globalCompositeOperation = 'lighter';
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
      g.addColorStop(0, 'rgba(255,240,200,' + flash * .5 + ')'); g.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = g; ctx.fillRect(-rad, -rad, rad * 2, rad * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    // Мягкое затемнение к краю
    g = ctx.createRadialGradient(0, 0, rad * .62, 0, 0, rad);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,5,0,.55)');
    ctx.fillStyle = g; ctx.fillRect(-rad, -rad, rad * 2, rad * 2);
    ctx.restore();
    // Латунная оправа
    ctx.save(); ctx.translate(cx, cy);
    var lw = Math.max(2, rad * .028);
    g = ctx.createLinearGradient(-rad, -rad, rad, rad);
    g.addColorStop(0, '#fbe3a0'); g.addColorStop(.35, '#c08a34'); g.addColorStop(.6, '#f0cd7a'); g.addColorStop(1, '#6e4310');
    ctx.strokeStyle = g; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(0, 0, rad - lw / 2, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,16,2,.7)'; ctx.lineWidth = Math.max(1, rad * .006); ctx.beginPath(); ctx.arc(0, 0, rad - lw, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  /* ---------- Калейдоскоп на холсте ----------
     show(seed) — узор сразу (фирменный кадр); idle(seed) — живёт; turn(seed, done) — поворот трубки: старый узор пересыпается, складывается новый.
     opts: { style: 'rose'|'gems'|'mix', speed: 1 } */
  function Kaleido(cv, px, opts) {
    opts = opts || {};
    var ctx = cv.getContext('2d'), P = null, raf = 0, t = 0, rot = 0, last = 0, style = opts.style || 'mix', speed = opts.speed || 1, q = 1, slow = 0, fast = 0;
    function size() {
      var d = Math.min(2, window.devicePixelRatio || 1) * q, w = Math.round((px || cv.clientWidth || 280) * d);
      if (cv.width !== w || cv.height !== w) { cv.width = w; cv.height = w; }
      return w;
    }
    function draw(layers, flash) {
      var t0 = window.performance ? performance.now() : 0, w = size();
      ctx.clearRect(0, 0, w, w);
      frame(ctx, layers, w / 2, w / 2, w / 2 * .985, rot, flash || 0);
      // Если телефон не успевает — чуть меньше точек на холсте (узор тот же)
      if (t0) { var dt = performance.now() - t0; if (dt > 22) { slow++; fast = 0; } else if (dt < 9) { fast++; slow = 0; } if (slow > 12 && q > .55) { q *= .85; slow = 0; } if (fast > 90 && q < 1) { q = Math.min(1, q / .85); fast = 0; } }
    }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function loop(ts) {
      var dt = last ? Math.min(.1, (ts - last) / 1000) : 0; last = ts;
      t += dt * speed;
      draw([[P, t, 1]]);
      raf = requestAnimationFrame(loop);
    }
    function live() { stop(); last = 0; if (REDUCED) return; raf = requestAnimationFrame(loop); }
    var api = {
      // ex (необязательно) — другие стёклышки и число зеркал: { sym, glass } (см. pattern)
      show: function (seed, ex) { stop(); if (ex !== undefined) opts.ex = ex; P = pattern(seed, style, opts.ex); t = 0; draw([[P, 0, 1]]); },
      idle: function (seed, ex) {
        if (ex !== undefined) { opts.ex = ex; P = null; }
        if (seed != null && (!P || P.seed !== (seed >>> 0) || P.style !== style)) { P = pattern(seed, style, opts.ex); t = 0; }
        draw([[P, t, 1]]); live();
      },
      turn: function (seed, done, ex) {
        stop();
        if (ex !== undefined) opts.ex = ex;
        var A = P, tA = t, B = pattern(seed, style, opts.ex), r0 = rot, t0 = 0, dur = REDUCED ? 0 : 3200, TW = 7;
        if (!dur || !A) { P = B; t = 0; draw([[B, 0, 1]]); if (!REDUCED) live(); if (done) done(); return; }
        raf = requestAnimationFrame(function step(ts) {
          if (!t0) t0 = ts;
          var k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 3);
          rot = r0 + e * Math.PI * 1.4;
          draw([[A, tA + k * TW * 1.4, 1 - smooth(k * 1.6)], [B, -TW * (1 - e), smooth(k * 1.7 - .25)]], Math.sin(Math.PI * Math.min(1, k * 1.3)) * .6);
          if (k < 1) { raf = requestAnimationFrame(step); return; }
          raf = 0; P = B; t = 0; live(); if (done) done();
        });
      },
      stop: stop,
      style: function (s) { if (s && s !== style) { style = s; if (P) P = pattern(P.seed, style, opts.ex); if (!raf && P) draw([[P, t, 1]]); } return style; },
      speed: function (v) { if (v != null) speed = v; return speed; },
      // Другой набор стёклышек (финал): узор пересобирается из них
      glass: function (ex, seed) { opts.ex = ex; P = pattern(seed != null ? seed : P ? P.seed : 1, style, ex); t = 0; if (!raf) draw([[P, 0, 1]]); },
      seed: function () { return P ? P.seed : null; }
    };
    return api;
  }

  // Фирменный кадр узора на любом холсте (картинка «Сохранить», панель): время 0
  function still(ctx, seed, cx, cy, rad, style, ex) { frame(ctx, [[pattern(seed, style || 'mix', ex), 0, 1]], cx, cy, rad, 0, 0); }

  window.M13K = { Kaleido: Kaleido, pattern: pattern, frame: frame, still: still, h32: h32, STYLES: ['rose', 'gems', 'mix'] };
})();
