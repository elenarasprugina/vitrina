/* 13 MIRRORS · живой калейдоскоп-витраж. ES5, без библиотек. window.M13K
   Узор — из числа (seed, у личного узора — h32 от кода): число зеркал, самоцветы, рисунок граней, ритм движения.
   Всё — функция (seed, время): на любом устройстве и в панели узор одинаковый; кадр t = 0 — «фирменный» (его и сохраняют).
   Рисуется один сектор (на отдельном холсте), остальные — его зеркальные отражения, как в настоящем калейдоскопе.
   Стили: 'rose' — витраж-роза (грани с золотыми прожилками), 'gems' — самоцветы пересыпаются между зеркалами,
   'mix' — роза с самоцветами (витражная основа, поверх плывут кристаллы), 'mandala' — мандала (нарисованный узор на светлом фоне, см. «Мандала»).
   Образец стиля — docs/yellow-sun-img/kaleidoscope-style.webp */
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
  // ex (необязательно): { sym: число пар зеркал (6 = 12 лучей), glass: [{ c: [r, g, b], look: вид камня (см. «Камни») или старое sh }, …] — узор из заданных стёклышек
  //   (финал маршрута: стёклышки дней, состояния, бонусные); их цвета идут и в витраж }
  function pattern(seed, style, ex) {
    if (style === 'mandala') return mandalaPattern(seed, ex);
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
      // Вид камня (самоцвет, жемчуг, кристалл…), размер и прозрачность — из стёклышка (настройки маршрута)
      var G = P.gems[i]; G.L = lookOf(gi || { sh: G.sh }); G.s *= G.L.size; G.al = 1 - G.L.clear;
    }
    return P;
  }

  /* ---------- Камни: вид рисуется один раз на маленьком холсте (спрайт), потом только поворачивается ----------
     Вид камня (look): { kind, cut, shine, clear, size, img }
       kind — 'gem' гранёный самоцвет · 'cabochon' гладкий кабошон · 'pearl' жемчуг · 'bead' бусина с отверстием ·
              'crystal' кристалл (горный хрусталь: шестигранная призма с острием) · 'glass' плоское витражное стекло · 'image' своя картинка
       cut (у самоцвета и стекла) — 'round' круг, 'oval' овал, 'rect' прямоугольник, 'drop' капля, 'marquise' лодочка, 'tri' треугольник, 'hex' шестигранник
       shine — блик, % (0 — без блика … 150); clear — прозрачность, % (0…70); size — размер в узоре, % (50…200); img — адрес картинки (PNG с прозрачным фоном)
     Старый вид стёклышка { sh: 'bead' | 'brilliant' | 'hex' | 'emerald' | 'trillion' | 'marquise' } читается так же. */
  function ring(n, sx, sy, a0) { var v = [], i; for (i = 0; i < n; i++) v.push([Math.cos(i / n * TAU + (a0 || 0)) * sx, Math.sin(i / n * TAU + (a0 || 0)) * sy]); return v; }
  var CUTS = {
    round: function () { return ring(10, 1, 1, TAU / 20); },
    oval: function () { return ring(10, 1, .74, TAU / 20); },
    rect: function () { return [[1, -.38], [1, .38], [.72, .66], [-.72, .66], [-1, .38], [-1, -.38], [-.72, -.66], [.72, -.66]]; },
    drop: function () {
      var v = [[0, -1], [.46, -.42]], i, a;
      for (i = 0; i <= 6; i++) { a = -.25 + i / 6 * (Math.PI + .5); v.push([Math.cos(a) * .68, .26 + Math.sin(a) * .68]); }
      v.push([-.46, -.42]); return v;
    },
    marquise: function () { var v = [], i, a; for (i = 0; i < 10; i++) { a = i / 10 * TAU; v.push([Math.cos(a), Math.sin(a) * .46 * Math.pow(Math.abs(Math.sin(a)), .35)]); } return v; },
    tri: function () { var v = [], i, a; for (i = 0; i < 3; i++) { a = i / 3 * TAU - Math.PI / 2; v.push([Math.cos(a - .16) * .98, Math.sin(a - .16) * .98 + .12]); v.push([Math.cos(a + .16) * .98, Math.sin(a + .16) * .98 + .12]); } return v; },
    hex: function () { return ring(6, 1, .92); }
  };
  var KINDS = ['gem', 'cabochon', 'pearl', 'bead', 'crystal', 'glass', 'image'];
  var OLD_SH = { bead: ['cabochon'], brilliant: ['gem', 'round'], hex: ['gem', 'hex'], emerald: ['gem', 'rect'], trillion: ['gem', 'tri'], marquise: ['gem', 'marquise'] };
  function num(v, def, lo, hi) { v = v === '' || v == null || isNaN(+v) ? def : +v; return Math.max(lo, Math.min(hi, v)); }
  function lookOf(g) {
    var L = g && g.look ? g.look : {}, o = OLD_SH[g && g.sh] || ['gem', 'round'];
    var kind = KINDS.indexOf(L.kind) >= 0 ? L.kind : o[0];
    if (kind === 'image' && !L.img) kind = 'gem';
    return { kind: kind, cut: CUTS[L.cut] ? L.cut : o[1] || 'round', shine: num(L.shine, 100, 0, 150) / 100,
      clear: num(L.clear, 8, 0, 70) / 100, size: num(L.size, 100, 50, 200) / 100, img: kind === 'image' ? L.img : '' };
  }
  function lookKey(L) { return [L.kind, L.cut, L.shine, L.img].join('|'); }

  // Картинки камней («своя картинка»): грузятся один раз; когда загрузилась — калейдоскопы на экране перерисовываются
  var IMGS = {}, WAITERS = [];
  function imgOf(src) {
    var im = IMGS[src];
    if (!im) {
      im = IMGS[src] = new Image();
      im.onload = im.onerror = function () { WAITERS = WAITERS.filter(function (f) { return f(); }); };
      im.src = src;
    }
    return im.complete && im.naturalWidth ? im : null;
  }
  // Загрузить заранее (картинка «Сохранить узор» рисуется один раз): done — когда все готовы (или не загрузились)
  function preload(srcs, done) {
    var left = 0;
    (srcs || []).forEach(function (s) {
      if (!s) return;
      var im = IMGS[s]; if (im && im.complete) return;
      left++; imgOf(s); IMGS[s].addEventListener('load', one); IMGS[s].addEventListener('error', one);
    });
    function one() { if (--left === 0 && done) done(); }
    if (!left && done) done();
  }

  function poly(x, v, k) { x.beginPath(); for (var i = 0; i < v.length; i++) x[i ? 'lineTo' : 'moveTo'](v[i][0] * k, v[i][1] * k); x.closePath(); }
  // Гранёный самоцвет: грани вокруг площадки, «огонь» внутри, тёмный поясок, рёбра огранки, блик
  function paintGem(x, c, v, k, sh) {
    var t = v.map(function (p) { return [p[0] * .52, p[1] * .52]; }), lt = -2.3, i, j, a, g;
    for (i = 0; i < v.length; i++) {
      j = (i + 1) % v.length; a = Math.atan2((v[i][1] + v[j][1]) / 2, (v[i][0] + v[j][0]) / 2);
      x.fillStyle = css(shade(c, .5 + .85 * Math.max(0, Math.cos(a - lt)) + (i % 2) * .12));
      x.beginPath(); x.moveTo(v[i][0] * k, v[i][1] * k); x.lineTo(v[j][0] * k, v[j][1] * k); x.lineTo(t[j][0] * k, t[j][1] * k); x.lineTo(t[i][0] * k, t[i][1] * k); x.closePath(); x.fill();
    }
    g = x.createLinearGradient(-k * .5, -k * .5, k * .5, k * .5);
    g.addColorStop(0, css(shade(c, 1.55))); g.addColorStop(.5, css(shade(c, 1.05))); g.addColorStop(1, css(shade(c, .7)));
    x.fillStyle = g; poly(x, t, k); x.fill();
    g = x.createRadialGradient(k * .14, k * .18, 0, k * .14, k * .18, k * .5);
    g.addColorStop(0, css(shade(c, 1.8), .55)); g.addColorStop(1, css(shade(c, 1.3), 0));
    x.fillStyle = g; poly(x, t, k); x.fill();
    x.strokeStyle = css(shade(c, .3), .8); x.lineWidth = k * .05; poly(x, v, k); x.stroke();
    x.strokeStyle = 'rgba(255,250,235,' + (.38 * Math.min(1.2, .4 + sh * .6)) + ')'; x.lineWidth = Math.max(1, k * .022); x.lineJoin = 'round';
    x.beginPath();
    for (i = 0; i < v.length; i++) { x.moveTo(v[i][0] * k, v[i][1] * k); x.lineTo(t[i][0] * k, t[i][1] * k); }
    x.stroke(); poly(x, t, k); x.stroke();
    if (sh > 0) { x.fillStyle = 'rgba(255,255,255,' + Math.min(.9, .55 * sh) + ')'; x.beginPath(); x.moveTo(-k * .34, -k * .3); x.lineTo(-k * .12, -k * .36); x.lineTo(-k * .26, -k * .12); x.closePath(); x.fill(); }
  }
  // Кабошон — гладкий отполированный камень: тёмная кромка, свет проходит насквозь и собирается внизу справа, блик сверху слева
  function paintCabochon(x, c, k, sh) {
    var r0 = k * .8, g;
    g = x.createRadialGradient(-r0 * .25, -r0 * .3, r0 * .05, 0, 0, r0);
    g.addColorStop(0, css(shade(c, 1.35))); g.addColorStop(.45, css(shade(c, .95))); g.addColorStop(.85, css(shade(c, .5))); g.addColorStop(1, css(shade(c, .28)));
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, r0, 0, TAU); x.fill();
    g = x.createRadialGradient(r0 * .3, r0 * .38, 0, r0 * .3, r0 * .38, r0 * .62);
    g.addColorStop(0, css(shade(c, 1.6), .85)); g.addColorStop(1, css(shade(c, 1.2), 0));
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, r0, 0, TAU); x.fill();
    if (!sh) return;
    x.strokeStyle = css(shade(c, 1.5), .45 * Math.min(1, sh)); x.lineWidth = r0 * .06; x.beginPath(); x.arc(0, 0, r0 * .93, .25 * Math.PI, .95 * Math.PI); x.stroke();
    g = x.createRadialGradient(-r0 * .34, -r0 * .4, 0, -r0 * .34, -r0 * .4, r0 * .34);
    g.addColorStop(0, 'rgba(255,255,255,' + Math.min(1, .95 * sh) + ')'); g.addColorStop(.35, 'rgba(255,255,255,' + Math.min(.8, .55 * sh) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.ellipse(-r0 * .32, -r0 * .4, r0 * .3, r0 * .18, -.6, 0, TAU); x.fill();
    x.fillStyle = 'rgba(255,255,255,' + Math.min(.8, .5 * sh) + ')'; x.beginPath(); x.arc(r0 * .42, -r0 * .5, r0 * .05, 0, TAU); x.fill();
  }
  // Жемчуг: матовый мягкий свет, перламутровые отливы (розовый и зеленоватый), размытый блик
  function paintPearl(x, c, k, sh) {
    var r0 = k * .78, g;
    g = x.createRadialGradient(-r0 * .3, -r0 * .35, r0 * .05, 0, 0, r0);
    g.addColorStop(0, css(shade(c, 1.6))); g.addColorStop(.5, css(shade(c, 1.12))); g.addColorStop(.88, css(shade(c, .74))); g.addColorStop(1, css(shade(c, .52)));
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, r0, 0, TAU); x.fill();
    [[r0 * .38, r0 * .3, '255,170,210', .28], [-r0 * .25, r0 * .46, '170,255,220', .2], [r0 * .1, -r0 * .5, '190,200,255', .16]].forEach(function (p) {
      g = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], r0 * .55);
      g.addColorStop(0, 'rgba(' + p[2] + ',' + p[3] + ')'); g.addColorStop(1, 'rgba(' + p[2] + ',0)');
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, r0, 0, TAU); x.fill();
    });
    x.strokeStyle = css(shade(c, 1.4), .35); x.lineWidth = r0 * .05; x.beginPath(); x.arc(0, 0, r0 * .9, .2 * Math.PI, .9 * Math.PI); x.stroke();
    if (!sh) return;
    g = x.createRadialGradient(-r0 * .3, -r0 * .36, 0, -r0 * .3, -r0 * .36, r0 * .5);
    g.addColorStop(0, 'rgba(255,255,255,' + Math.min(1, .85 * sh) + ')'); g.addColorStop(.4, 'rgba(255,255,255,' + Math.min(.6, .3 * sh) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, r0, 0, TAU); x.fill();
  }
  // Бусина сверху: стеклянный шарик с отверстием посередине, свет проходит и вспыхивает у края отверстия
  function paintBead(x, c, k, sh) {
    var r0 = k * .78, h = r0 * .24, g;
    g = x.createRadialGradient(-r0 * .28, -r0 * .32, r0 * .05, 0, 0, r0);
    g.addColorStop(0, css(shade(c, 1.4))); g.addColorStop(.5, css(c)); g.addColorStop(.9, css(shade(c, .5))); g.addColorStop(1, css(shade(c, .32)));
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, r0, 0, TAU); x.fill();
    x.strokeStyle = css(shade(c, 1.35), .3); x.lineWidth = r0 * .1; x.beginPath(); x.arc(0, 0, h * 1.75, 0, TAU); x.stroke();
    g = x.createRadialGradient(0, 0, 0, 0, 0, h);
    g.addColorStop(0, css(shade(c, .12))); g.addColorStop(.8, css(shade(c, .22))); g.addColorStop(1, css(shade(c, .45)));
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, h, 0, TAU); x.fill();
    x.strokeStyle = css(shade(c, 1.7), .7); x.lineWidth = h * .22; x.beginPath(); x.arc(0, 0, h * .92, .1 * Math.PI, .8 * Math.PI); x.stroke();
    if (!sh) return;
    x.fillStyle = 'rgba(255,255,255,' + Math.min(.95, .75 * sh) + ')'; x.beginPath(); x.ellipse(-r0 * .4, -r0 * .42, r0 * .24, r0 * .12, -.75, 0, TAU); x.fill();
    x.fillStyle = 'rgba(255,255,255,' + Math.min(.7, .4 * sh) + ')'; x.beginPath(); x.arc(r0 * .5, r0 * .36, r0 * .05, 0, TAU); x.fill();
  }
  // Кристалл, как горный хрусталь: шестигранная призма с острием — видны три боковые грани и три грани острия; прозрачный, с прожилками
  function paintCrystal(x, c, k, sh) {
    var w = .5, m = .19, yt = -.98, ys = -.5, yi = -.58, b = [.9, .95, .9, .86], i, g;
    function face(pts, col) { x.fillStyle = col; poly(x, pts, k); x.fill(); }
    x.save(); x.globalAlpha = .9;
    face([[-w, ys], [-m, yi], [-m, b[1]], [-w, b[0]]], css(shade(c, .58)));
    g = x.createLinearGradient(-m * k, 0, m * k, 0);
    g.addColorStop(0, css(shade(c, 1.3))); g.addColorStop(.6, css(shade(c, 1.02))); g.addColorStop(1, css(shade(c, .82)));
    face([[-m, yi], [m, yi], [m, b[2]], [-m, b[1]]], g);
    face([[m, yi], [w, ys], [w, b[3]], [m, b[2]]], css(shade(c, .9)));
    face([[0, yt], [-w, ys], [-m, yi]], css(shade(c, 1.05)));
    face([[0, yt], [-m, yi], [m, yi]], css(shade(c, 1.5)));
    face([[0, yt], [m, yi], [w, ys]], css(shade(c, 1.18)));
    x.restore();
    // Прожилки внутри и рёбра
    x.strokeStyle = 'rgba(255,255,255,.22)'; x.lineWidth = Math.max(1, k * .012);
    x.beginPath(); x.moveTo(-m * .3 * k, -.2 * k); x.lineTo(m * .5 * k, .35 * k); x.moveTo(-m * .7 * k, .3 * k); x.lineTo(-m * .1 * k, .7 * k); x.stroke();
    x.strokeStyle = 'rgba(255,252,240,.55)'; x.lineWidth = Math.max(1, k * .02); x.lineJoin = 'round';
    x.beginPath();
    [[[-w, ys], [0, yt], [w, ys]], [[-m, yi], [0, yt], [m, yi]], [[-w, ys], [-m, yi], [m, yi], [w, ys]], [[-m, yi], [-m, b[1]]], [[m, yi], [m, b[2]]]].forEach(function (l) {
      l.forEach(function (p, j) { x[j ? 'lineTo' : 'moveTo'](p[0] * k, p[1] * k); });
    });
    x.stroke();
    x.strokeStyle = css(shade(c, .3), .7); x.lineWidth = Math.max(1, k * .03);
    poly(x, [[0, yt], [w, ys], [w, b[3]], [m, b[2]], [-m, b[1]], [-w, b[0]], [-w, ys]], k); x.stroke();
    if (!sh) return;
    g = x.createLinearGradient(-m * k, 0, -m * .2 * k, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,' + Math.min(.85, .6 * sh) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(-m * k, yi * k + 2, m * .8 * k, (b[1] - yi) * k * .8);
    x.fillStyle = 'rgba(255,255,255,' + Math.min(.9, .6 * sh) + ')'; x.beginPath(); x.moveTo(0, yt * k + 2); x.lineTo(-m * .5 * k, (yi + .05) * k); x.lineTo(-m * .1 * k, (yi + .02) * k); x.closePath(); x.fill();
  }
  // Плоское витражное стекло: цветное стекло с лёгкими разводами в золотой оправе (как кусочек витража)
  function paintGlass(x, c, v, k, sh) {
    var g, i;
    k *= .94;
    x.save(); poly(x, v, k); x.clip();
    g = x.createLinearGradient(-k, -k, k, k);
    g.addColorStop(0, css(shade(c, 1.3), .9)); g.addColorStop(.5, css(c, .84)); g.addColorStop(1, css(shade(c, .62), .9));
    x.fillStyle = g; x.fillRect(-k, -k, k * 2, k * 2);
    x.strokeStyle = 'rgba(255,255,255,.1)'; x.lineWidth = k * .05;
    for (i = 0; i < 4; i++) { x.beginPath(); x.moveTo(-k, (-.6 + i * .4) * k); x.bezierCurveTo(-k * .3, (-.9 + i * .4) * k, k * .3, (-.3 + i * .4) * k, k, (-.6 + i * .4) * k); x.stroke(); }
    if (sh > 0) {
      g = x.createLinearGradient(-k, -k, k * .2, k * .2);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.45, 'rgba(255,255,255,' + Math.min(.6, .38 * sh) + ')'); g.addColorStop(.6, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(-k, -k, k * 2, k * 2);
    }
    x.restore();
    x.lineJoin = 'round';
    x.strokeStyle = 'rgba(38,22,4,.92)'; x.lineWidth = k * .11; poly(x, v, k); x.stroke();
    x.strokeStyle = '#c99a45'; x.lineWidth = k * .055; x.stroke();
    x.strokeStyle = 'rgba(255,240,196,.5)'; x.lineWidth = k * .018; x.stroke();
  }
  function sprite(P, L, ci) {
    var key = lookKey(L) + '|' + ci;
    if (P.sprites[key]) return P.sprites[key];
    var im = L.kind === 'image' ? imgOf(L.img) : null;
    if (L.kind === 'image' && !im) return null;
    var S = P.spriteSize || 112, cv = document.createElement('canvas'), x = cv.getContext('2d'), c = P.pal[ci], h = S / 2, k = h * .92;
    cv.width = cv.height = S; x.translate(h, h);
    if (im) { var q = Math.min(S * .96 / im.naturalWidth, S * .96 / im.naturalHeight); x.drawImage(im, -im.naturalWidth * q / 2, -im.naturalHeight * q / 2, im.naturalWidth * q, im.naturalHeight * q); }
    else if (L.kind === 'cabochon') paintCabochon(x, c, k, L.shine);
    else if (L.kind === 'pearl') paintPearl(x, c, k, L.shine);
    else if (L.kind === 'bead') paintBead(x, c, k, L.shine);
    else if (L.kind === 'crystal') paintCrystal(x, c, k, L.shine);
    else if (L.kind === 'glass') paintGlass(x, c, CUTS[L.cut](), k, L.shine);
    else paintGem(x, c, CUTS[L.cut](), k, L.shine);
    P.sprites[key] = cv;
    return cv;
  }
  // Один камень крупно (панель, «стёклышко легло в узор»): холст px × px; c — [r, g, b]; look — вид камня
  function stone(cv, c, look, px) {
    var d = Math.min(2, window.devicePixelRatio || 1), S = Math.round((px || cv.clientWidth || 96) * d), L = lookOf({ look: look || {} });
    var sp = sprite({ pal: [c], sprites: {}, spriteSize: S }, L, 0);
    cv.width = cv.height = S;
    var x = cv.getContext('2d'); x.clearRect(0, 0, S, S);
    if (sp) x.drawImage(sp, 0, 0);
    else if (L.kind === 'image') WAITERS.push(function () { if (imgOf(L.img)) { stone(cv, c, look, px); return false; } return true; });
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
      sp = sprite(P, G.L, G.c);
      if (!sp) continue;
      x.save(); x.translate(px, py); x.rotate(G.rot + G.wr * t); x.globalAlpha = G.al;
      x.drawImage(sp, -s, -s, s * 2, s * 2);
      x.restore();
      x.globalAlpha = 1;
      star(x, px - s * .3, py - s * .3, s * .9, Math.pow(Math.max(0, Math.sin(t * G.sw + G.sp)), 14) * .9 * Math.min(1, G.L.shine));
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
  function frame(ctx, layers, cx, cy, rad, rot, flash, open) {
    if (layers[layers.length - 1][0].mandala) { mandalaFrame(ctx, layers, cx, cy, rad, rot, flash, open); return; }
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

  /* ---------- Мандала (стиль 'mandala') ----------
     Не стёклышки в зеркалах, а нарисованный узор: кольца лепестков, бусин, капель и листьев вокруг центра, на тёплом светлом фоне,
     цвета — из стёклышек (ex.glass), у каждого кода своя. Живёт так: медленно поворачивается, а отдельные лепестки и кусочки
     по одному ловят свет и вспыхивают (блики; ex.neon — неон бликов, 0…1,5). Кадр t = 0 — «фирменный».
     line — контур для раскрашивания (чёрные линии на белом), open — раскрытие от центра к краю (0…1). */
  function mixC(a, b, k) { return [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)]; }
  function lum(c) { return .299 * c[0] + .587 * c[1] + .114 * c[2]; }
  // Неон: насыщеннее и «изнутри» (к чистому цвету средней светлоты); k 0…1,5
  function neonC(c, k) {
    if (!k) return c;
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, s = 0, h = 0, d = mx - mn;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; if (h < 0) h += 1;
    }
    var q = Math.min(1, k);
    s = s + (1 - s) * q * (d < .04 ? .25 : 1); l = l + (.58 - l) * q * .75;
    var C = (1 - Math.abs(2 * l - 1)) * s, X = C * (1 - Math.abs((h * 6) % 2 - 1)), m = l - C / 2, o;
    var i = Math.floor(h * 6) % 6;
    o = [[C, X, 0], [X, C, 0], [0, C, X], [0, X, C], [X, 0, C], [C, 0, X]][i];
    return [Math.round((o[0] + m) * 255), Math.round((o[1] + m) * 255), Math.round((o[2] + m) * 255)];
  }
  var M_BIG = ['petals', 'lotus', 'leaves', 'drops', 'scallop'], M_SMALL = ['dots', 'band', 'teeth'];
  var M_W = { petals: [.15, .2], lotus: [.13, .17], leaves: [.13, .17], drops: [.11, .14], scallop: [.07, .09], dots: [.04, .055], band: [.02, .028], teeth: [.05, .07] };
  function mandalaPattern(seed, ex) {
    ex = ex || {};
    var R = rng((seed >>> 0) ^ 0x5bd1e995), n0 = [8, 12, 12, 16][Math.floor(R() * 4)], pal = [], glass = ex.glass && ex.glass.length ? ex.glass : null, i;
    if (glass) glass.forEach(function (g) { if (!pal.some(function (c) { return c[0] === g.c[0] && c[1] === g.c[1] && c[2] === g.c[2]; })) pal.push(g.c); });
    else { var pick = GEMS.slice(); for (i = 0; i < 4; i++) pal.push(pick.splice(Math.floor(R() * pick.length), 1)[0]); }
    if (pal.length < 3) pal.push(GOLD, AMBER);
    // Цвета по кольцам — по очереди, чтобы в узор легли все стёклышки
    var ci = Math.floor(R() * pal.length);
    function nextC() { var c = ci % pal.length; ci++; return c; }
    function count(r, w, k) { var n = Math.max(1, Math.round(TAU * r / (w * k) / n0)) * n0; return Math.min(n, n0 * 4); }
    var rings = [{ t: 'rosette', r0: 0, r1: .12, n: n0, a: nextC(), b: nextC(), off: 0 }], r = .12, last = '', big = true, guard = 0;
    rings.push({ t: 'band', r0: r, r1: r + .02, n: n0 * 2, a: nextC(), b: nextC(), off: 0 }); r += .02;
    while (r < .8 && guard++ < 20) {
      var L = big ? M_BIG : M_SMALL, t = L[Math.floor(R() * L.length)];
      if (t === last) t = L[(L.indexOf(t) + 1) % L.length];
      var w = M_W[t][0] + R() * (M_W[t][1] - M_W[t][0]); if (r + w > .86) w = Math.max(M_W[t][0] * .8, .86 - r);
      var k = t === 'dots' ? 1.25 : t === 'band' ? 1 : t === 'teeth' ? 1.1 : t === 'scallop' ? 2.2 : t === 'petals' || t === 'leaves' ? .85 : t === 'lotus' ? 1.05 : 1;
      rings.push({ t: t, r0: r, r1: r + w, n: t === 'band' ? n0 * 4 : count(r + w / 2, w, k), a: nextC(), b: nextC(), off: R() < .5 ? .5 : 0 });
      r += w; last = t; big = !big;
    }
    rings.push({ t: 'outer', r0: r, r1: .965, n: count((r + .965) / 2, .965 - r, .95), a: nextC(), b: nextC(), off: .5 });
    rings.push({ t: 'rim', r0: .965, r1: 1, n: n0 * 6, a: nextC(), b: nextC(), off: 0 });
    // Блики: часть лепестков и кусочков вспыхивает по очереди
    var glints = [];
    rings.forEach(function (g, ri) {
      if (g.t === 'band' || g.t === 'rim') return;
      for (var j = 0; j < g.n; j++) if (R() < (g.n > 40 ? .22 : .4)) glints.push({ ri: ri, j: j, w: .16 + R() * .3, p: R() * TAU });
    });
    return { mandala: true, seed: seed >>> 0, style: 'mandala', sym: n0, W: Math.PI / n0, pal: pal, rings: rings, glints: glints,
      spin: (R() < .5 ? -1 : 1) * (.012 + R() * .01), neon: ex.neon == null ? .5 : +ex.neon, cache: null };
  }
  // Один элемент кольца g в местных координатах (ось элемента — вдоль x, единица — радиус). Только путь, без заливки.
  function mPath(x, g, rad, part) {
    var r0 = g.r0 * rad, r1 = g.r1 * rad, w = r1 - r0, hw = Math.PI / g.n, rm = (r0 + r1) / 2;
    function P(r, a) { return [r * Math.cos(a), r * Math.sin(a)]; }
    function mv(p) { x.moveTo(p[0], p[1]); }
    function bz(c1, c2, p) { x.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p[0], p[1]); }
    var t = g.t, s = part === 'in' ? .55 : 1, a, b;
    x.beginPath();
    if (t === 'petals' || t === 'outer' || t === 'rosette' || t === 'leaves') {
      var tilt = t === 'leaves' ? hw * .55 : 0, h = hw * (t === 'outer' ? .96 : .9);
      a = part === 'in' ? r0 + w * .2 : r0 + (t === 'rosette' ? w * .18 : 0); b = part === 'in' ? r1 - w * .22 : r1;
      var ww = b - a;
      mv(P(a, 0));
      bz(P(a + ww * .3, -h * 1.15 * s), P(a + ww * .78, -h * .75 * s + tilt), P(b, tilt));
      bz(P(a + ww * .78, h * .75 * s + tilt), P(a + ww * .3, h * 1.15 * s), P(a, 0));
    } else if (t === 'lotus') {
      var hl = hw * .98 * s; a = part === 'in' ? r0 + w * .25 : r0; b = part === 'in' ? r1 - w * .18 : r1;
      mv(P(a, -hl * .55));
      bz(P(a + (b - a) * .55, -hl * 1.25), P(b, -hl * .75), P(b, 0));
      bz(P(b, hl * .75), P(a + (b - a) * .55, hl * 1.25), P(a, hl * .55));
      x.closePath();
    } else if (t === 'drops') {
      var dr = Math.min(w * .3, rm * hw * .8) * s, dc = r0 + w * .36;
      x.arc(dc, 0, dr, Math.PI * .5, Math.PI * 1.5);
      bz([dc + dr * .2, -dr], [r1 - w * .25 * (part === 'in' ? 1.6 : 1), -dr * .2], [part === 'in' ? r1 - w * .3 : r1, 0]);
      bz([r1 - w * .25 * (part === 'in' ? 1.6 : 1), dr * .2], [dc + dr * .2, dr], [dc, dr]);
    } else if (t === 'scallop') {
      var cr = Math.min(w * .95, r0 * Math.sin(hw) * 1.02) * (part === 'in' ? .58 : 1);
      x.arc(r0, 0, cr, -Math.PI / 2, Math.PI / 2); x.closePath();
    } else if (t === 'dots' || t === 'rim') {
      var rr = Math.min(w * .42, rm * Math.sin(hw) * .8) * (part === 'in' ? .45 : 1);
      x.arc(rm, 0, rr, 0, TAU);
    } else if (t === 'teeth') {
      var ht = hw * .95; mv(P(r0, -ht)); x.lineTo(P(r1, 0)[0], P(r1, 0)[1]); x.lineTo(P(r0, ht)[0], P(r0, ht)[1]); x.closePath();
    }
  }
  // Прожилки, точки и прочие мелочи элемента
  function mDetail(x, g, rad) {
    var r0 = g.r0 * rad, r1 = g.r1 * rad, w = r1 - r0, hw = Math.PI / g.n, t = g.t;
    x.beginPath();
    if (t === 'petals' || t === 'outer' || t === 'leaves') {
      var tilt = t === 'leaves' ? hw * .55 : 0;
      x.moveTo(r0 + w * .12, 0); x.quadraticCurveTo(r0 + w * .6, tilt * (r0 + w * .6) * .5, (r1 - w * .1) * Math.cos(tilt), (r1 - w * .1) * Math.sin(tilt));
      if (t === 'leaves') for (var i = 1; i <= 3; i++) {
        var q = r0 + w * (.22 + i * .17), yy = q * tilt * i / 4.5;
        x.moveTo(q, yy); x.lineTo(q - w * .12, yy - q * hw * .45); x.moveTo(q, yy); x.lineTo(q - w * .12, yy + q * hw * .45);
      }
    } else if (t === 'lotus' || t === 'drops') {
      x.moveTo(r1 - w * .2 + w * .045, 0); x.arc(r1 - w * .2, 0, w * .045, 0, TAU);
    } else if (t === 'scallop') {
      x.moveTo(r0 + w * .12, 0); x.arc(r0, 0, w * .12, 0, TAU);
    }
  }
  // Весь узор (вектором). open — раскрытие (0…1): кольца по очереди от центра выходят и разворачиваются
  function mandalaDraw(x, P, rad, line, open) {
    var lw = Math.max(.8, rad * (line ? .0042 : .0046)), ink = line ? '#1c1c1c' : 'rgba(74,44,10,.88)', gold = line ? '#1c1c1c' : '#c99a45', N = P.rings.length;
    if (open == null) open = 1;
    // Фон: тёплый светлый круг (у раскраски — белый)
    var g = x.createRadialGradient(0, 0, 0, 0, 0, rad);
    if (line) { g.addColorStop(0, '#fff'); g.addColorStop(1, '#fff'); }
    else { g.addColorStop(0, '#fffaf0'); g.addColorStop(.55, '#f8e8c8'); g.addColorStop(1, '#ecd09a'); }
    // Пока мандала раскрывается, светлый круг растёт вместе с кольцами
    var rb = rad * (open >= 1 ? 1 : .2 + .8 * smooth(open * 1.3));
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, rb, 0, TAU); x.fill();
    x.lineJoin = 'round'; x.lineCap = 'round';
    // Пока раскрывается — кольца видны только внутри растущего светлого круга
    if (open < 1) { x.save(); x.beginPath(); x.arc(0, 0, rb, 0, TAU); x.clip(); }
    P.rings.forEach(function (R, ri) {
      var k = open >= 1 ? 1 : smooth((open - ri / N * .72) / .28);
      if (k < .01) return;
      x.save();
      if (k < 1) { x.globalAlpha = k; x.rotate((1 - k) * .6 * (ri % 2 ? -1 : 1)); x.scale(.7 + .3 * k, .7 + .3 * k); }
      var A = P.pal[R.a], B = P.pal[R.b], j, a0 = R.off * TAU / R.n, GR = {};
      // Эмаль: у каждого элемента свет от основания к кончику (градиент один на кольцо — элементы рисуются в своих координатах)
      function grad(c) {
        var key = c.join(','); if (GR[key]) return GR[key];
        var cc = lum(c) > 205 ? shade(c, .88) : c, gg = x.createLinearGradient(R.r0 * rad, 0, R.r1 * rad, 0);
        gg.addColorStop(0, css(shade(cc, 1.3))); gg.addColorStop(.5, css(cc)); gg.addColorStop(1, css(shade(cc, .8)));
        return (GR[key] = gg);
      }
      // У лепестков — второй ряд позади, со сдвигом на полшага: узор плотный, без пустого фона между лепестками
      if (R.t === 'petals' || R.t === 'outer' || R.t === 'lotus' || R.t === 'rosette' || R.t === 'drops' || R.t === 'leaves') {
        var BK = { t: R.t === 'drops' || R.t === 'leaves' ? 'petals' : R.t, r0: R.r0, r1: R.r0 + (R.r1 - R.r0) * .78, n: R.n };
        for (j = 0; j < R.n; j++) {
          x.save(); x.rotate(a0 + (j + .5) * TAU / R.n);
          mPath(x, BK, rad);
          if (!line) { x.fillStyle = css(mixC(B, [120, 70, 16], .12)); x.fill(); }
          x.strokeStyle = ink; x.lineWidth = lw * .9; x.stroke();
          x.restore();
        }
      }
      if (R.t === 'band' || R.t === 'rim') {
        // Полоса: светлая лента между двумя золотыми кругами
        x.beginPath(); x.arc(0, 0, R.r1 * rad, 0, TAU); x.arc(0, 0, R.r0 * rad, 0, TAU, true);
        if (!line) { x.fillStyle = css(mixC(A, [255, 246, 226], .55)); x.fill(); }
        x.strokeStyle = gold; x.lineWidth = lw * (line ? 1 : 1.2);
        x.beginPath(); x.arc(0, 0, R.r0 * rad, 0, TAU); x.stroke(); x.beginPath(); x.arc(0, 0, R.r1 * rad, 0, TAU); x.stroke();
      }
      for (j = 0; j < R.n; j++) {
        x.save(); x.rotate(a0 + j * TAU / R.n);
        var c = R.t === 'dots' || R.t === 'teeth' ? (j % 2 ? B : A) : A, c2 = R.t === 'dots' || R.t === 'teeth' ? (j % 2 ? A : B) : B;
        if (R.t !== 'band') {
          mPath(x, R, rad);
          if (!line) { x.fillStyle = R.t === 'rim' ? css(mixC(A, GOLD, .5)) : grad(c); x.fill(); }
          x.strokeStyle = ink; x.lineWidth = lw; x.stroke();
          if (R.t !== 'teeth' && R.t !== 'rim') {
            mPath(x, R, rad, 'in');
            if (!line) { x.fillStyle = css(mixC(c2, [255, 250, 236], .35)); x.fill(); }
            x.lineWidth = lw * .8; x.stroke();
          }
          mDetail(x, R, rad); x.lineWidth = lw * .7; x.strokeStyle = line ? ink : 'rgba(74,44,10,.6)'; x.stroke();
        } else if (j % 2 === 0) {
          x.beginPath(); x.arc((R.r0 + R.r1) / 2 * rad, 0, (R.r1 - R.r0) * rad * .26, 0, TAU);
          if (!line) { x.fillStyle = gold; x.fill(); } else x.stroke();
        }
        x.restore();
      }
      x.restore();
    });
    if (open < 1) x.restore();
    // Центр — золотая пуговка
    var bs = rad * .045;
    if (line) { x.beginPath(); x.arc(0, 0, bs, 0, TAU); x.strokeStyle = ink; x.lineWidth = lw; x.stroke(); }
    else {
      g = x.createRadialGradient(-bs * .3, -bs * .35, bs * .1, 0, 0, bs);
      g.addColorStop(0, '#fff6d6'); g.addColorStop(.45, '#eabf62'); g.addColorStop(1, '#8a5a16');
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, bs, 0, TAU); x.fill();
    }
    if (!line) {
      // Мягкий свет из середины и лёгкая тень к краю — узор как будто светится изнутри
      g = x.createRadialGradient(0, 0, 0, 0, 0, rad);
      g.addColorStop(0, 'rgba(255,248,225,.32)'); g.addColorStop(.5, 'rgba(255,240,205,.08)'); g.addColorStop(.86, 'rgba(120,70,10,0)'); g.addColorStop(1, 'rgba(120,70,10,.22)');
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, rb, 0, TAU); x.fill();
    }
    if (open >= 1 || open > .75) { x.globalAlpha = open >= 1 ? 1 : (open - .75) * 4; x.strokeStyle = line ? ink : '#b8862e'; x.lineWidth = lw * 1.6; x.beginPath(); x.arc(0, 0, rad - lw, 0, TAU); x.stroke(); x.globalAlpha = 1; }
  }
  // Блики: лепесток вспыхивает своим (неоновым) цветом, на нём искра
  function mandalaGlints(x, P, rad, t, a) {
    if (!t || a < .01) return;
    x.save(); x.globalCompositeOperation = 'lighter';
    P.glints.forEach(function (G) {
      var v = Math.pow(Math.max(0, Math.sin(t * G.w + G.p)), 18) * a;
      if (v < .02) return;
      var R = P.rings[G.ri], c = neonC(P.pal[R.a], P.neon), ang = R.off * TAU / R.n + G.j * TAU / R.n;
      x.save(); x.rotate(ang);
      mPath(x, R, rad);
      x.shadowColor = css(c, .9 * v); x.shadowBlur = rad * .03 * (1 + P.neon);
      x.fillStyle = css(mixC(c, [255, 255, 255], .1), .5 * v); x.fill();
      x.shadowBlur = 0;
      x.restore();
      var rm = (R.r0 + R.r1) / 2 * rad;
      star(x, Math.cos(ang) * rm, Math.sin(ang) * rm, (R.r1 - R.r0) * rad * .45, .6 * v);
    });
    x.restore();
  }
  // Кадр мандалы: layers — [[узор, время, прозрачность], …] (как у калейдоскопа), open — раскрытие
  function mandalaFrame(ctx, layers, cx, cy, rad, rot, flash, open) {
    var n, L, P, d = Math.ceil(rad * 2);
    ctx.save(); ctx.translate(cx, cy);
    for (n = 0; n < layers.length; n++) {
      L = layers[n]; P = L[0];
      if (L[2] < .01) continue;
      ctx.save(); ctx.globalAlpha = L[2]; ctx.rotate(rot + P.spin * L[1]);
      if (open != null && open < 1) mandalaDraw(ctx, P, rad, false, open);
      else {
        // Неподвижная часть рисуется один раз, потом только поворачивается
        if (!P.cache || P.cache.width !== d) {
          var cv = P.cache = document.createElement('canvas'); cv.width = cv.height = d;
          var x = cv.getContext('2d'); x.translate(d / 2, d / 2); mandalaDraw(x, P, rad, false, 1);
        }
        ctx.drawImage(P.cache, -d / 2, -d / 2);
        mandalaGlints(ctx, P, rad, L[1], L[2]);
      }
      ctx.restore();
    }
    if (flash > .01) {
      ctx.globalCompositeOperation = 'lighter';
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
      g.addColorStop(0, 'rgba(255,240,200,' + flash * .5 + ')'); g.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rad, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // Мандала одним кадром на любом холсте (картинка, PDF): o.line — контур для раскрашивания
  function mandalaStill(ctx, seed, cx, cy, rad, ex, o) {
    var P = mandalaPattern(seed, ex);
    ctx.save(); ctx.translate(cx, cy); mandalaDraw(ctx, P, rad, !!(o && o.line), 1); ctx.restore();
  }

  /* ---------- Калейдоскоп на холсте ----------
     show(seed) — узор сразу (фирменный кадр); idle(seed) — живёт; turn(seed, done) — поворот трубки: старый узор пересыпается, складывается новый.
     opts: { style: 'rose'|'gems'|'mix', speed: 1 } */
  function Kaleido(cv, px, opts) {
    opts = opts || {};
    var ctx = cv.getContext('2d'), P = null, raf = 0, t = 0, rot = 0, last = 0, style = opts.style || 'mix', speed = opts.speed || 1, q = 1, slow = 0, fast = 0, openK = 1, openT = 0, openDur = 0;
    function size() {
      var d = Math.min(2, window.devicePixelRatio || 1) * q, w = Math.round((px || cv.clientWidth || 280) * d);
      if (cv.width !== w || cv.height !== w) { cv.width = w; cv.height = w; }
      return w;
    }
    function draw(layers, flash) {
      var t0 = window.performance ? performance.now() : 0, w = size();
      ctx.clearRect(0, 0, w, w);
      frame(ctx, layers, w / 2, w / 2, w / 2 * .985, rot, flash || 0, openK);
      // Если телефон не успевает — чуть меньше точек на холсте (узор тот же)
      if (t0) { var dt = performance.now() - t0; if (dt > 22) { slow++; fast = 0; } else if (dt < 9) { fast++; slow = 0; } if (slow > 12 && q > .55) { q *= .85; slow = 0; } if (fast > 90 && q < 1) { q = Math.min(1, q / .85); fast = 0; } }
    }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function loop(ts) {
      var dt = last ? Math.min(.1, (ts - last) / 1000) : 0; last = ts;
      t += dt * speed;
      // Мандала раскрывается от центра (unfold)
      if (openK < 1) { openT += dt; openK = Math.min(1, openT / openDur); }
      draw([[P, t, 1]]);
      raf = requestAnimationFrame(loop);
    }
    function live() { stop(); last = 0; if (REDUCED) return; raf = requestAnimationFrame(loop); }
    // Загрузилась картинка камня («своя картинка») — перерисовать, если узор сейчас стоит
    WAITERS.push(function () { if (P && !raf) draw([[P, t, 1]]); return cv.isConnected || !P; });
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
      // Мандала: раскрыться от центра к краю за ms (кольца по очереди выходят и разворачиваются), потом жить
      unfold: function (ms) { if (REDUCED || !ms) { openK = 1; return; } openK = 0; openT = 0; openDur = ms / 1000; if (P && !raf) live(); },
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
  function styleOk(s) { return s === 'rose' || s === 'gems' || s === 'mix' || s === 'mandala'; }

  window.M13K = { stone: stone, preload: preload, lookOf: lookOf, CUTS: Object.keys(CUTS), KINDS: KINDS, Kaleido: Kaleido, pattern: pattern, frame: frame, still: still, h32: h32,
    STYLES: ['rose', 'gems', 'mix', 'mandala'], styleOk: styleOk, mandalaStill: mandalaStill, neonC: neonC };
})();
