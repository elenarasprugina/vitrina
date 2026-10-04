/* 13 MIRRORS · календарь кинов (Dreamspell) — window.M13KIN.
   Расчёт — перенос dreamspell.ts из её программы «космолёт» (порт dreamspell_core_v1.py, те же контрольные даты):
   23.06.1987 — Kin 1; 25 июля (День вне времени) — обычный кин и двигает счёт; 29 февраля — 0.0 Хунаб Ку: кина нет и счёт не двигается.
   Названия — её словарь (решение 04.10.2026, docs/konstruktor.md, раздел 0а): тоны «Самосущий», «Кристаллический»;
   печати «Волшебник», «Буря», «Небесный Странник», «Соединитель Миров». Цвет и тон согласуются с родом печати:
   «Жёлтое Магнитное Солнце», «Синяя Самосущая Ночь», «Белый Резонансный Соединитель Миров». */
(function () {
  'use strict';
  var DAY = 864e5, REF = Date.UTC(1987, 5, 23);
  // 13 тонов — мужской род (как в поле «Тон» у дня)
  var TONES = ['Магнитный', 'Лунный', 'Электрический', 'Самосущий', 'Обертонный', 'Ритмический', 'Резонансный',
    'Галактический', 'Солнечный', 'Планетарный', 'Спектральный', 'Кристаллический', 'Космический'];
  // 20 печатей: [название, род] (m — он, f — она, n — оно)
  var SEALS = [['Дракон', 'm'], ['Ветер', 'm'], ['Ночь', 'f'], ['Семя', 'n'], ['Змей', 'm'], ['Соединитель Миров', 'm'], ['Рука', 'f'],
    ['Звезда', 'f'], ['Луна', 'f'], ['Собака', 'f'], ['Обезьяна', 'f'], ['Человек', 'm'], ['Небесный Странник', 'm'], ['Волшебник', 'm'],
    ['Орёл', 'm'], ['Воин', 'm'], ['Земля', 'f'], ['Зеркало', 'n'], ['Буря', 'f'], ['Солнце', 'n']];
  // Цвета печатей по кругу: Красный, Белый, Синий, Жёлтый (печать 1 — красная)
  var COLORS = ['Красный', 'Белый', 'Синий', 'Жёлтый'];

  // Прилагательное в нужном роде: Магнитный → Магнитная / Магнитное, Синий → Синяя / Синее, Самосущий → Самосущая / Самосущее
  function agree(adj, g) {
    if (g === 'm') return adj;
    var stem = adj.slice(0, -2), end = adj.slice(-2), last = stem.slice(-1);
    if (end === 'ый') return stem + (g === 'f' ? 'ая' : 'ое');
    if (/н/.test(last)) return stem + (g === 'f' ? 'яя' : 'ее');               // Синий
    if (/[жшчщ]/.test(last)) return stem + (g === 'f' ? 'ая' : 'ее');          // Самосущий
    return stem + (g === 'f' ? 'ая' : 'ое');                                  // Электрический
  }
  function pyMod(n, m) { return ((n % m) + m) % m; }
  function toneOf(kin) { return pyMod(kin - 1, 13) + 1; }
  function sealOf(kin) { return pyMod(kin - 1, 20) + 1; }
  function colorOf(seal) { return pyMod(seal - 1, 4); }   // 0 красный, 1 белый, 2 синий, 3 жёлтый

  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
    if (!m || +m[1] < 1000) return NaN;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3]), d = new Date(t);
    return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? t : NaN;
  }
  function isHunabKu(t) { var d = new Date(t); return d.getUTCMonth() === 1 && d.getUTCDate() === 29; }
  // Сколько 29 февраля строго после a и не позже b (a < b)
  function leapDays(a, b) {
    var y0 = new Date(a).getUTCFullYear(), y1 = new Date(b).getUTCFullYear(), n = 0, y, t;
    for (y = y0; y <= y1; y++) {
      if (!(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) continue;
      t = Date.UTC(y, 1, 29);
      if (t > a && t <= b) n++;
    }
    return n;
  }
  // Кин даты 'ГГГГ-ММ-ДД' (или числа — миллисекунды UTC): 1…260; null — 29 февраля или неверная дата
  function kinOf(date) {
    var t = typeof date === 'number' ? date : parse(date);
    if (isNaN(t) || isHunabKu(t)) return null;
    var days = Math.round((t - REF) / DAY);
    days += days >= 0 ? -leapDays(REF, t) : leapDays(t, REF);
    return pyMod(days, 260) + 1;
  }
  function sealName(seal) { var s = SEALS[seal - 1]; return agree(COLORS[colorOf(seal)], s[1]) + ' ' + s[0]; }
  function kinName(kin) {
    var s = SEALS[sealOf(kin) - 1];
    return agree(COLORS[colorOf(sealOf(kin))], s[1]) + ' ' + agree(TONES[toneOf(kin) - 1], s[1]) + ' ' + s[0];
  }
  // Всё про один кин — в полях, как у дня маршрута: { kin, kinName, seal, tone, toneN, sealN, color }
  function info(kin) {
    if (!(kin >= 1 && kin <= 260)) return null;
    var t = toneOf(kin), s = sealOf(kin);
    return { kin: kin, kinName: kinName(kin), seal: sealName(s), tone: TONES[t - 1], toneN: t, sealN: s, color: colorOf(s) };
  }
  // Дни подряд от даты начала: [{ n, date, kin…, special }]; special — 'hunabku' (29.02) или 'dayout' (25.07, День вне времени)
  function days(start, count) {
    var t0 = parse(start), out = [], i, t, d, k;
    if (isNaN(t0)) return out;
    for (i = 0; i < (count || 13); i++) {
      t = t0 + i * DAY; d = new Date(t); k = kinOf(t);
      out.push(Object.assign({ n: i + 1, date: d.toISOString().slice(0, 10),
        special: isHunabKu(t) ? 'hunabku' : d.getUTCMonth() === 6 && d.getUTCDate() === 25 ? 'dayout' : '' }, k ? info(k) : { kin: null }));
    }
    return out;
  }
  // Ближайшее начало волны (кин с тоном 1) в этот день или позже — для подсказки в панели
  function waveStart(start) {
    var t = parse(start), i, k;
    if (isNaN(t)) return '';
    for (i = 0; i < 20; i++) { k = kinOf(t + i * DAY); if (k && toneOf(k) === 1) return new Date(t + i * DAY).toISOString().slice(0, 10); }
    return '';
  }

  window.M13KIN = { kinOf: kinOf, info: info, days: days, kinName: kinName, sealName: sealName, toneOf: toneOf, sealOf: sealOf,
    waveStart: waveStart, agree: agree, TONES: TONES, SEALS: SEALS, COLORS: COLORS };
})();
