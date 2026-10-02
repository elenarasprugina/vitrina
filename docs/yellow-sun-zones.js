// Жёлтое Солнце: как получена разметка кирпичей по умолчанию (zones в data/journeys.json). Запуск: node docs/yellow-sun-zones.js → zones2.json
// Переложено 02.10 по её объяснению: сзади путь идёт по второй яркой полосе (верхняя — внешний обрезанный виток, справа уходит за кадр, не трогаем),
// справа — по внутреннему ряду; одна спираль ~2,5 оборота, 12-й день — последнее кольцо вокруг центра. Дальше её правки — в панели.
// Путь по виткам спирали: в каждой стороне свои опорные значения по оборотам.
// L — x левой стороны (θ = 90, 450, 810…), R — x правой (270, 630, 990…), F — y спереди (0, 360, 720…), B — y сзади (180, 540, 900…).
// θ = 0 — спереди (к зрителю), растёт посолонь: слева → сзади → справа → спереди.
function lerpK(K, t) { // K: [[θ, v]...] по возрастанию, с продолжением по краям
  if (t <= K[0][0]) { const a = K[0], b = K[1]; return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]); }
  for (let i = 0; i < K.length - 1; i++) if (t <= K[i + 1][0]) { const a = K[i], b = K[i + 1]; return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]); }
  const a = K[K.length - 2], b = K[K.length - 1]; return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]);
}
function make(c) {
  const P = th => { const a = th * Math.PI / 180, L = lerpK(c.L, th), R = lerpK(c.R, th), F = lerpK(c.F, th), B = lerpK(c.B, th);
    return [(L + R) / 2 - (R - L) / 2 * Math.sin(a), (F + B) / 2 + (F - B) / 2 * Math.cos(a)]; };
  // Внешний край плиты: тот же виток, «раздутый» на долю расстояния до следующего витка внутрь — своя у каждой стороны
  const Pout = th => { const a = th * Math.PI / 180, h = (K) => c.k / 2 * Math.abs(lerpK(K, th) - lerpK(K, th + 360));
    const L = lerpK(c.L, th) - h(c.L), R = lerpK(c.R, th) + h(c.R), F = lerpK(c.F, th) + h(c.F), B = lerpK(c.B, th) - h(c.B);
    return [(L + R) / 2 - (R - L) / 2 * Math.sin(a), (F + B) / 2 + (F - B) / 2 * Math.cos(a)]; };
  const pts = [], poly = [];
  for (let k = 0; k <= 24; k++) {
    const th = c.th0 + (c.th1 - c.th0) * k / 24, p = P(th), o = Pout(th);
    pts.push([+(p[0] / c.W).toFixed(4), +(p[1] / c.H).toFixed(4), +((o[0] - p[0]) / c.W).toFixed(4), +((o[1] - p[1]) / c.H).toFixed(4)]);
  }
  for (let k = 0; k <= 400; k++) poly.push(P(c.th0 + (c.th1 - c.th0) * k / 400).map(Math.round));
  const C = c.center;
  return { z: { width: 100, path: pts, center: { x: +(C[0] / c.W).toFixed(4), y: +(C[1] / c.H).toFixed(4), rx: +(C[2] / c.W).toFixed(4), ry: +(C[3] / c.H).toFixed(4) } }, poly };
}
const D = { W: 1672, H: 941, th0: 18, th1: 940, k: .66,
  L: [[90, 200], [450, 478], [810, 645], [1170, 760]], R: [[270, 1232], [630, 1000], [990, 880]],
  F: [[0, 612], [360, 512], [720, 452], [1080, 405]], B: [[-180, 268], [180, 298], [540, 334], [900, 350], [1260, 368]], center: [788, 398, 98, 32] };
const M = { W: 941, H: 1672, th0: 22, th1: 940, k: .66,
  L: [[90, 90], [450, 230], [810, 325], [1170, 395]], R: [[270, 712], [630, 605], [990, 530]],
  F: [[0, 1088], [360, 1000], [720, 957], [1080, 925]], B: [[-180, 785], [180, 812], [540, 840], [900, 862], [1260, 878]], center: [457, 905, 68, 22] };
const d = make(D), m = make(M), fs = require('fs');
fs.writeFileSync('zones2.json', JSON.stringify({ desktop: d.z, mobile: m.z }));
function marks(r, W, H) { return [{ poly: r.poly, c: '#f00', sw: 2 }].concat(r.z.path.map((p, i) => [Math.round(p[0] * W), Math.round(p[1] * H), i % 2 ? String((i + 1) / 2) : '·'])); }
fs.writeFileSync('d2_pts.json', JSON.stringify(marks(d, 1672, 941)));
fs.writeFileSync('m2_pts.json', JSON.stringify(marks(m, 941, 1672)));
