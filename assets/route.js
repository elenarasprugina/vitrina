/* 13 MIRRORS · страница маршрута по дням (первым — «Жёлтое Солнце»).
   Данные — data/journeys.json (настраиваются в панели: «Страницы маршрутов»).
   Здесь же — Карта дня и личная карта: их рисует и сама страница, и панель (предпросмотр).
   Этап 1: фон-спираль, экран ожидания, Карта дня. Этап 2: кирпичи на спирали (свет, импульс к центру), путь Наблюдателя, режим проверки ?debug=1.
   Этап 3: ключ → калейдоскоп → личный код, колода, выбор карты (круг закрытых карт), личная карта.
   С 02.10: колода-колесо (13 карт: ось, спица, обод, изнанка), вход: ключ → 3 состояния → калейдоскоп (assets/kaleido.js, 12 лучей) → код со состояниями.
   С 03.10: на личной карте вместо колеса — диск (картинка/видео, 6 зон касания, примерка → «Здесь» → камушек в узор, дорога назад в центр). */
(function () {
  'use strict';
  var MSK = 3, DAY = 864e5;
  var MODES = ['observation', 'journey', 'immersion'];
  var MODE_NAMES = { observation: 'Наблюдение', journey: 'Путешествие', immersion: 'Погружение' };
  var MON_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) putText(n, text);
    return n;
  }
  // Надписи: Enter в панели — новая строка; число держится со следующим словом («5 октября»), «5–17» не рвётся на тире
  function glue(s) { return String(s).replace(/(\d)([–—-])(?=\d)/g, '$1\u2060$2\u2060').replace(/(\d)[ \t]+(?=[A-Za-zА-Яа-яЁё«(])/g, '$1\u00a0'); }
  // Выравнивание строки (её просьба 03.10): метка в начале строки — {слева} {по центру} {справа} {по ширине}
  // (в панели — кнопки над полем). Есть хоть одна метка — каждая строка становится своим блоком со своим выравниванием.
  var AL_TAGS = { 'слева': 'left', 'по центру': 'center', 'справа': 'right', 'по ширине': 'justify' }, AL_RE = /^\s*\{(слева|по центру|справа|по ширине)\}[ \t]*/i;
  function lineAlign(line) { var m = AL_RE.exec(line); return m ? { al: AL_TAGS[m[1].toLowerCase()], text: line.slice(m[0].length) } : null; }
  function untag(s) { return String(s == null ? '' : s).split('\n').map(function (l) { var m = lineAlign(l); return m ? m.text : l; }).join('\n'); }
  function putText(n, text) {
    n.textContent = '';
    var lines = String(text).split('\n');
    if (lines.some(lineAlign)) {
      lines.forEach(function (line) {
        var m = lineAlign(line), s = document.createElement('span');
        s.className = 'ys-ln' + (m ? ' ys-al--' + m.al : '');
        s.appendChild(document.createTextNode(glue(m ? m.text : line) || '\u00a0'));
        n.appendChild(s);
      });
      return n;
    }
    lines.forEach(function (line, i) { if (i) n.appendChild(document.createElement('br')); n.appendChild(document.createTextNode(glue(line))); });
    return n;
  }
  function tn(text) { return putText(document.createDocumentFragment(), text); }
  // Для картинок (холст): переносов там нет — строка через пробел
  function flat(s) { return untag(s).replace(/\s*\n\s*/g, ' '); }
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
  // Колода-колесо: 13 карт { id, quality, axis, way (способ — в начальной форме), less: { rim, spoke }, more: { spoke, rim }, recognize, road, image }
  function cardsOf(route) { return ((route.deck || {}).cards) || []; }
  // Метки карты и откуда берётся значение. Значение ставится с маленькой буквы; {Качество} с большой — с большой.
  // Формы качества: «чего?» ({качества}: решительности) и «ваше …» ({ваше качество}: вашу решительность). Поле карты пустое — форма угадывается по окончанию.
  function qualityOf(k) {
    var q = String(k.qualityOf || '').trim(); if (q) return q;
    q = low(String(k.quality || '').trim());
    return /ие$/i.test(q) ? q.replace(/е$/i, 'я') : /[ья]$/i.test(q) ? q.replace(/.$/, 'и') : /[гкхжшчщ]а$/i.test(q) ? q.replace(/.$/, 'и') : /а$/i.test(q) ? q.replace(/.$/, 'ы') : q;
  }
  function qualityYour(k) {
    var q = String(k.qualityYour || '').trim(); if (q) return q;
    q = low(String(k.quality || '').trim());
    return /[оеё]$/i.test(q) ? 'ваше ' + q : /а$/i.test(q) ? 'вашу ' + q.replace(/а$/i, 'у') : /я$/i.test(q) ? 'вашу ' + q.replace(/я$/i, 'ю') : /ь$/i.test(q) ? 'вашу ' + q : 'ваш ' + q;
  }
  var CARD_TOKENS = [['качество', function (k) { return k.quality; }], ['качества', qualityOf], ['ваше качество', qualityYour], ['ось', function (k) { return k.axis; }], ['способ', function (k) { return k.way; }],
    ['обод-мало', function (k) { return (k.less || {}).rim; }], ['спица-мало', function (k) { return (k.less || {}).spoke; }],
    ['спица-много', function (k) { return (k.more || {}).spoke; }], ['обод-много', function (k) { return (k.more || {}).rim; }]];
  function low(s) { s = String(s || ''); return s && s.charAt(1) !== s.charAt(1).toUpperCase() ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  // Метки: {день}, {дата}, {кин}, {имя кина}, {печать}, {тон}, {что делаем}, {среда}; у личной карты — метки карты (CARD_TOKENS).
  function ctxOf(route, n, k) {
    var d = dayOf(route, n), c = {
      'день': String(n), 'дата': dateOf(route, n), 'кин': d.kin == null ? '' : String(d.kin),
      'имя кина': d.kinName || '', 'печать': d.seal || '', 'тон': d.tone || '',
      'что делаем': d.cardOperation || '', 'среда': d.environment || '', 'финал': wordsOf(route).name
    };
    if (k) CARD_TOKENS.forEach(function (t) { c[t[0]] = low(t[1](k)); });
    return c;
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  /* Слова маршрута (панель → «Основное» → «Слова маршрута»; конструктор, 04.10): как называется то, что складывается в финале.
     route.words: final — «Солнце» (кто? что?), finalYour — «ваше Солнце» («…сложится ваше Солнце»), finalInto — «в ваше Солнце» («…лягут в ваше Солнце»).
     Пусто — из названия: род угадывается по окончанию (-о/-е — ваше, -а/-я — ваша/вашу, иначе — ваш). Метка {финал} — название. */
  function wordsOf(route) {
    var w = (route && route.words) || {}, name = String(w.final || '').trim() || 'Солнце';
    var g = /[оеё]$/i.test(name.split(' ')[0]) ? 'n' : /[ая]$/i.test(name.split(' ')[0]) ? 'f' : 'm';
    var acc = g === 'f' ? name.replace(/^(\S*?)а(\s|$)/i, '$1у$2').replace(/^(\S*?)я(\s|$)/i, '$1ю$2') : name;
    return { name: name, your: String(w.finalYour || '').trim() || (g === 'n' ? 'ваше ' : g === 'f' ? 'ваша ' : 'ваш ') + name,
      into: String(w.finalInto || '').trim() || 'в ' + (g === 'n' ? 'ваше ' : g === 'f' ? 'вашу ' : 'ваш ') + acc };
  }
  // Надписи по умолчанию, в которых есть название финала (панель показывает их серым в пустом поле)
  function defText(route, key) {
    var W = wordsOf(route);
    return { diskStone: 'Камушек этой зоны лёг в ваш узор — он войдёт и ' + W.into + '.',
      exitLead: 'Выберите до трёх стёклышек — они тоже лягут ' + W.into + '. Можно не выбирать.',
      glassNote: 'Каждый день маршрута добавляет в ваш узор своё стёклышко — цвета печати дня. В конце из них сложится ' + W.your + '.' }[key] || '';
  }
  // {Действие} с большой буквы — значение тоже с большой. Неизвестная метка остаётся как есть.
  function fill(tpl, ctx, miss) {
    tpl = String(tpl == null ? '' : tpl);
    return tpl.replace(/\{([^{}\n]{1,40})\}/g, function (all, name, at) {
      var k = name.trim().toLowerCase();
      if (AL_TAGS[k]) return all;
      if (!Object.prototype.hasOwnProperty.call(ctx, k)) { if (miss) miss.push(name.trim()); return all; }
      var v = ctx[k];
      v = name.trim().charAt(0) !== k.charAt(0) ? cap(v) : v;
      // Значение с оборотом через запятую («менять способ действия, когда меняется ситуация») посреди фразы — оборот закрывается запятой
      if (/,/.test(v) && !/[,.:;!?…)»\s]$/.test(v) && /^\s+[A-Za-zА-Яа-яЁё]/.test(tpl.slice(at + all.length))) v += ',';
      return v;
    });
  }
  function tokens(route) {
    var t = ['день', 'дата', 'кин', 'имя кина', 'печать', 'тон', 'что делаем', 'среда', 'финал'];
    return { day: t, card: CARD_TOKENS.map(function (x) { return x[0]; }) };
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

  /* ---------- Лицо карты — колесо ----------
     В центре ось (качество вместе с противовесом), через неё линия «слишком мало ↔ слишком много»;
     по сторонам — спица (ближе) и обод (дальше). За кругом — изнанка: общая для всех карт.
     Названия зон и подписи — route.deck (zones, sides, underside); пусто — как здесь. */
  var ZONE_DEF = { axis: 'Ось', spoke: 'Спица', rim: 'Обод', underside: 'Изнанка' };
  // Название зоны колеса (подарки, путь назад). Есть диск — по названиям зон диска: центр, плоскость, край, за диском
  // (её правило 03.10: «ось, спица, обод, изнанка» — технические слова, участник их не видит)
  function zoneName(route, z) {
    if ((route.deck || {}).disk) {
      var dz = { axis: 'center', spoke: 'flatUp', rim: 'edgeUp', underside: 'beyond' }[z];
      if (dz) { var nm = String(diskName(route, dz) || ''); return z === 'spoke' || z === 'rim' ? nm.split(',')[0].trim() : nm; }
    }
    var Z = (route.deck || {}).zones || {}; return Z[z] || ZONE_DEF[z];
  }
  function wheelNode(route, k, o) {
    var D = route.deck || {}, sd = D.sides || {}, box = el('div', 'ys-wheel');
    if (!k) k = { quality: 'Качество', axis: 'Качество и его противовес', less: { rim: 'обод', spoke: 'спица' }, more: { spoke: 'спица', rim: 'обод' } };
    if (k.image) {
      var img = el('img', 'ys-w-img'); img.src = imgSrc(o && o.base, k.image); img.alt = k.quality || ''; box.appendChild(img); box.classList.add('has-img');
      return box;
    }
    box.appendChild(el('p', 'ys-w-q', k.quality || ''));
    var w = el('div', 'ys-w-box');
    var rays = '', i, a;
    for (i = 0; i < 24; i++) { a = i / 24 * Math.PI * 2; rays += '<line x1="' + r1(50 + 17.6 * Math.cos(a)) + '" y1="' + r1(50 + 17.6 * Math.sin(a)) + '" x2="' + r1(50 + 29.6 * Math.cos(a)) + '" y2="' + r1(50 + 29.6 * Math.sin(a)) + '"/>'; }
    w.innerHTML = '<svg class="ys-w-svg" viewBox="0 0 100 100" aria-hidden="true"><defs>' +
      '<radialGradient id="yswa" cx="50%" cy="46%" r="55%"><stop offset="0" stop-color="#fff2c4" stop-opacity=".5"/><stop offset=".7" stop-color="#ffcf5a" stop-opacity=".2"/><stop offset="1" stop-color="#ffcf5a" stop-opacity=".08"/></radialGradient>' +
      '<radialGradient id="ysws" cx="50%" cy="50%" r="50%"><stop offset=".55" stop-color="#d98a2a" stop-opacity=".16"/><stop offset="1" stop-color="#d98a2a" stop-opacity=".05"/></radialGradient>' +
      '<radialGradient id="yswr" cx="50%" cy="50%" r="50%"><stop offset=".7" stop-color="#a8402a" stop-opacity=".1"/><stop offset="1" stop-color="#a8402a" stop-opacity=".3"/></radialGradient></defs>' +
      '<circle cx="50" cy="50" r="42" fill="url(#yswr)" stroke="#e9c77e" stroke-opacity=".75" stroke-width=".5"/>' +
      '<circle cx="50" cy="50" r="29.8" fill="url(#ysws)" stroke="#e9c77e" stroke-opacity=".55" stroke-width=".4"/>' +
      '<g stroke="#e9c77e" stroke-opacity=".12" stroke-width=".3">' + rays + '</g>' +
      '<circle cx="50" cy="50" r="17.6" fill="url(#yswa)" stroke="#ffd76a" stroke-opacity=".8" stroke-width=".5"/>' +
      '<g stroke="#ffd76a" stroke-opacity=".6" stroke-width=".35" fill="none" stroke-linecap="round"><line x1="50" y1="5.5" x2="50" y2="32"/><line x1="50" y1="68" x2="50" y2="94.5"/>' +
      '<path d="M48.4 7.6 L50 5.5 L51.6 7.6"/><path d="M48.4 92.4 L50 94.5 L51.6 92.4"/></g></svg>';
    function lab(cls, t) { var x = el('span', cls, t || ''); w.appendChild(x); return x; }
    lab('ys-w-side ys-w-side--more', sd.more || 'слишком много');
    lab('ys-w-word ys-w-rim ys-w-top', (k.more || {}).rim);
    lab('ys-w-word ys-w-spoke ys-w-top', (k.more || {}).spoke);
    var ax = el('div', 'ys-w-axis'); ax.appendChild(el('small', null, zoneName(route, 'axis'))); ax.appendChild(el('b', null, k.axis || k.quality || '')); w.appendChild(ax);
    lab('ys-w-word ys-w-spoke ys-w-bot', (k.less || {}).spoke);
    lab('ys-w-word ys-w-rim ys-w-bot', (k.less || {}).rim);
    lab('ys-w-side ys-w-side--less', sd.less || 'слишком мало');
    lab('ys-w-zone ys-w-zl ys-w-z-spoke', zoneName(route, 'spoke')); lab('ys-w-zone ys-w-zr ys-w-z-spoke', zoneName(route, 'spoke'));
    lab('ys-w-zone ys-w-zl ys-w-z-rim', zoneName(route, 'rim')); lab('ys-w-zone ys-w-zr ys-w-z-rim', zoneName(route, 'rim'));
    lab('ys-w-zone ys-w-under ys-w-under--tl', zoneName(route, 'underside')); lab('ys-w-zone ys-w-under ys-w-under--br', zoneName(route, 'underside'));
    box.appendChild(w);
    var uq = D.undersideQ == null ? 'кто цепляет? → а нет ли этого во мне?' : D.undersideQ;
    if (uq) { var u = el('p', 'ys-w-uq'); u.appendChild(el('b', null, zoneName(route, 'underside') + ': ')); u.appendChild(tn(uq)); box.appendChild(u); }
    return box;
  }
  // Путь назад в ось — по зонам колеса (route.deck.wayBack)
  function wayBackNode(route, b) {
    var wb = (route.deck || {}).wayBack || {}, list = el('ul', 'ys-wb-l'), any = false;
    ['axis', 'spoke', 'rim', 'underside'].forEach(function (z) {
      if (!wb[z]) return; any = true;
      var li = el('li'); li.appendChild(el('b', null, zoneName(route, z))); li.appendChild(tn(' — ' + wb[z])); list.appendChild(li);
    });
    if (!any) return null;
    var box = el('div', 'ys-c-text ys-wb');
    box.appendChild(el('span', 'ys-c-label', b.label == null ? 'Дорога в центр' : b.label));
    box.appendChild(list);
    return box;
  }

  /* ---------- Лицо карты — диск (с 03.10, вместо колеса) ----------
     Картинка диска — route.deck.disk.image (пусто — диск, нарисованный кодом); видео-петля disk.video — поверх картинки:
     пока видео грузится и если в системе включено «уменьшить движение», видна картинка.
     6 зон касания (DISK_ZONES). Разметка — disk.areas[зона] = [[x, y], …] (доли картинки), её обводит Проводник в панели («Диск»);
     нет ни одной — круги от середины картинки. Точка относится к первой зоне по порядку: центр → плоскость → край;
     «за диском» — всё остальное (если её обвели — только внутри обводки).
     Пока ничего не выбрано — по диску бежит свет (disk.pulse — см. diskPulse; лежит по овалу диска disk.oval, скорость disk.speed, %). Касание — примерка: зона светится, остальные приглушены, под диском — название зоны,
     слово карты и «Узнаю себя, если…» (card.recognize[зона]). После первой примерки — «Здесь»: выбор окончателен (o.onMark),
     зона светится ровно, камушек её формы ложится в узор, под диском — дорога назад в центр (card.road[зона];
     пусто — общий «путь назад в ось» этой зоны колеса). Отметка — только на устройстве (o.mark), в код не входит. */
  var DISK_ZONES = ['center', 'flatUp', 'flatDown', 'edgeUp', 'edgeDown', 'beyond'];
  var DISK_DEF = { center: 'Центр', flatUp: 'Плоскость, ближе к пустыне', flatDown: 'Плоскость, ближе к болоту', edgeUp: 'Край, пустыня', edgeDown: 'Край, туман', beyond: 'За диском' };
  // Зона диска → зона колеса: форма камушка, общий путь назад
  var DISK_FAMILY = { center: 'axis', flatUp: 'spoke', flatDown: 'spoke', edgeUp: 'rim', edgeDown: 'rim', beyond: 'underside' };
  function diskCfg(route) { return (route.deck || {}).disk || {}; }
  function diskName(route, z) { var N = diskCfg(route).names || {}; return N[z] || DISK_DEF[z]; }
  // Слово карты для зоны: центр — ось, плоскость — спица, край — обод (↑ — «слишком много», ↓ — «слишком мало»), за диском — строка изнанки
  function diskWord(route, k, z) {
    k = k || {};
    if (z === 'beyond') { var uq = (route.deck || {}).undersideQ; return uq == null ? 'кто цепляет? → а нет ли этого во мне?' : uq; }
    return z === 'center' ? k.axis || k.quality : ((z === 'flatUp' || z === 'edgeUp' ? k.more : k.less) || {})[z.indexOf('flat') === 0 ? 'spoke' : 'rim'];
  }
  function diskText(k, key, z) { return String(((k || {})[key] || {})[z] || '').trim(); }
  function ellPts(rx, ry, a0, a1, n) {
    var p = [], i, a;
    for (i = 0; i <= n; i++) { a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; p.push([Math.round((.5 + rx * Math.cos(a)) * 1e4) / 1e4, Math.round((.5 + ry * Math.sin(a)) * 1e4) / 1e4]); }
    return p;
  }
  // Без разметки — круги от середины: центр, плоскость, край; верх и низ делит линия через середину
  var DISK_AREAS_DEF = { center: ellPts(.16, .16, 0, 360, 40), flatUp: ellPts(.32, .32, 180, 360, 40), flatDown: ellPts(.32, .32, 0, 180, 40),
    edgeUp: ellPts(.47, .47, 180, 360, 48), edgeDown: ellPts(.47, .47, 0, 180, 48) };
  function areaOk(a) { return !!(a && a.length >= 3); }
  function diskMarked(route) { var A = diskCfg(route).areas || {}; return DISK_ZONES.some(function (z) { return areaOk(A[z]); }); }
  function diskAreas(route) {
    var A = diskCfg(route).areas || {}, own = diskMarked(route), o = {};
    DISK_ZONES.forEach(function (z) { var a = own ? A[z] : DISK_AREAS_DEF[z]; if (areaOk(a)) o[z] = a; });
    return o;
  }
  /* Овал диска (disk.oval) — по нему панель строит зоны и по нему лежит свет. x, y — середина (доли картинки), rx, ry — полуоси (доли ширины),
     rot — наклон (°), ar — высота картинки / ширина, core — размер центра, edge — ширина края (доли полуосей),
     split — линия между ↑ и ↓ (°; 90 — отвесно, ↑ слева), tx, ty — низ скалы под диском. Овала нет — по обводкам зон или круг. */
  var OVAL_DEF = { x: .5, y: .5, rx: .47, ry: .47, rot: 0, ar: 1, core: .3, edge: .3, split: 90, tx: .5, ty: .98 };
  function ovalOk(v) { return !!(v && +v.rx > 0 && +v.ry > 0); }
  function ovalFix(v) {
    var o = {}, k;
    for (k in OVAL_DEF) o[k] = v && v[k] != null && v[k] !== '' && isFinite(+v[k]) ? +v[k] : OVAL_DEF[k];
    o.ar = o.ar > 0 ? o.ar : 1; o.core = Math.max(.05, Math.min(.8, o.core)); o.edge = Math.max(.05, Math.min(.8, o.edge));
    if (o.core > .95 - o.edge) o.core = .95 - o.edge;
    return o;
  }
  function ovalOf(route) {
    var D = diskCfg(route), A = D.areas || {}, xs = [], ys = [];
    if (ovalOk(D.oval)) return ovalFix(D.oval);
    if (diskMarked(route)) DISK_ZONES.slice(0, 5).forEach(function (z) { if (areaOk(A[z])) A[z].forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
    if (xs.length < 3) return ovalFix(null);
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    return ovalFix({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2, tx: (x0 + x1) / 2, ty: Math.min(1, y1 + (y1 - y0)) });
  }
  // Точка овала: угол a (°; 0 — справа, 90 — ближний край), s — доля полуосей
  function ovalPt(v, a, s) {
    var t = a * Math.PI / 180, R = v.rot * Math.PI / 180, u = v.rx * s * Math.cos(t), w = v.ry * s * Math.sin(t);
    return [v.x + u * Math.cos(R) - w * Math.sin(R), v.y + (u * Math.sin(R) + w * Math.cos(R)) / v.ar];
  }
  function q4(p) { return [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4]; }
  function ovalArc(v, s, a0, a1, n) { var p = [], i; for (i = 0; i <= n; i++) p.push(q4(ovalPt(v, a0 + (a1 - a0) * i / n, s))); return p; }
  // Зоны по овалу: центр — малый овал; плоскость и край — половины овалов (внутренние зоны важнее, поэтому край — вся половина);
  // за диском — скала: ближний край овала и вниз к острию (tx, ty)
  function ovalAreas(v) {
    v = ovalFix(v);
    var c = q4([v.x, v.y]), sp = v.split, inn = 1 - v.edge, o = { center: ovalArc(v, v.core, 0, 360, 28).slice(0, -1) };
    o.flatUp = [c].concat(ovalArc(v, inn, sp, sp + 180, 20)); o.flatDown = [c].concat(ovalArc(v, inn, sp + 180, sp + 360, 20));
    o.edgeUp = [c].concat(ovalArc(v, 1, sp, sp + 180, 24)); o.edgeDown = [c].concat(ovalArc(v, 1, sp + 180, sp + 360, 24));
    var L = ovalPt(v, 180, 1), Rr = ovalPt(v, 0, 1), dy = (v.ty - v.y) * .3, T = [v.tx, v.ty], i, b = ovalArc(v, 1, 0, 180, 24);
    L = [L[0] + (v.tx - L[0]) * .06, L[1] + dy]; Rr = [Rr[0] + (v.tx - Rr[0]) * .06, Rr[1] + dy];
    for (i = 0; i <= 4; i++) b.push(q4([L[0] + (T[0] - L[0]) * i / 5, L[1] + (T[1] - L[1]) * i / 5]));
    for (i = 0; i < 5; i++) b.push(q4([T[0] + (Rr[0] - T[0]) * i / 5, T[1] + (Rr[1] - T[1]) * i / 5]));
    b.push(q4(Rr));
    o.beyond = b;
    return o;
  }
  /* Спираль света на диске: своя линия (disk.path — нарисована от руки) или по овалу (disk.turns витков, disk.spin: 'cw' — по часовой, 'ccw').
     Точки — по ходу света (disk.dir: 'in' — от края к центру, 'out' — из центра к краю), на равном расстоянии друг от друга. */
  function spiralPts(route, n) {
    var D = diskCfg(route), v = ovalOf(route), raw = [], i, f;
    n = n || 360;
    if (D.path && D.path.length >= 2) {
      raw = D.path.map(function (p) { return [+p[0], +p[1]]; });
      var e0 = raw[0], e1 = raw[raw.length - 1], d0 = Math.pow(e0[0] - v.x, 2) + Math.pow((e0[1] - v.y) * v.ar, 2), d1 = Math.pow(e1[0] - v.x, 2) + Math.pow((e1[1] - v.y) * v.ar, 2);
      if (d0 < d1) raw.reverse();
    } else {
      var turns = Math.max(.5, Math.min(8, +D.turns || 3)), sg = D.spin === 'ccw' ? -1 : 1;
      for (i = 0; i <= 600; i++) { f = i / 600; raw.push(ovalPt(v, 90 + sg * turns * 360 * f, .93 - .89 * f)); }
    }
    if (D.dir === 'out') raw.reverse();
    // Равномерно по длине (с учётом пропорций картинки)
    var L = [0], out = [], j = 1;
    for (i = 1; i < raw.length; i++) L.push(L[i - 1] + Math.sqrt(Math.pow(raw[i][0] - raw[i - 1][0], 2) + Math.pow((raw[i][1] - raw[i - 1][1]) * v.ar, 2)));
    var tot = L[L.length - 1] || 1;
    for (i = 0; i < n; i++) {
      var want = tot * i / (n - 1);
      while (j < L.length - 1 && L[j] < want) j++;
      var a = raw[j - 1], b2 = raw[j], k = (want - L[j - 1]) / ((L[j] - L[j - 1]) || 1);
      out.push([a[0] + (b2[0] - a[0]) * k, a[1] + (b2[1] - a[1]) * k]);
    }
    return out;
  }
  // Вид света до выбора: 'spark' — огонёк со следом по спирали (по умолчанию), 'swave' — волна по спирали, 'ring' — кольца по овалу, 'zones' — по зонам
  function diskPulse(route) { var p = diskCfg(route).pulse; return p === 'swave' || p === 'ring' || p === 'zones' ? p : 'spark'; }
  function diskSpeed(route) { var s = +diskCfg(route).speed; return s > 0 ? Math.max(.25, Math.min(3, s / 100)) : 1; }
  /* Огонёк по спирали: рисуется каждый кадр (след — 18 кусочков, тают к хвосту). Останавливается, когда диск убрали со страницы;
     замирает на время перелистывания и пока зона примеряется или выбрана (тогда слой скрыт). */
  function diskRun(route, fig, mode) {
    var D = diskCfg(route), v = ovalOf(route), P = spiralPts(route, 360), M = P.length - 1, N = 18, sp = diskSpeed(route);
    var trail = Math.max(.03, Math.min(.9, (+D.trail || 25) / 100)) * M, NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg'), segs = [], i;
    svg.setAttribute('class', 'ys-d-run'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    function mk(tag, cls) { var e = document.createElementNS(NS, tag); if (cls) e.setAttribute('class', cls); svg.appendChild(e); return e; }
    var pts = P.map(function (p) { return r1(p[0] * 1000) / 10 + ',' + r1(p[1] * 1000) / 10; });
    var gid = 'ysdg' + (++ZID);
    svg.innerHTML = '<defs><radialGradient id="' + gid + '"><stop offset="0" class="ys-d-g0"/><stop offset=".45" class="ys-d-g1"/><stop offset="1" class="ys-d-g2"/></radialGradient></defs>';
    if (D.line) mk('polyline', 'ys-d-sline').setAttribute('points', pts.join(' '));
    var cg = mk('ellipse', 'ys-d-core');
    cg.setAttribute('fill', 'url(#' + gid + ')');
    cg.setAttribute('cx', r1(v.x * 1000) / 10); cg.setAttribute('cy', r1(v.y * 1000) / 10);
    for (i = 0; i < N; i++) segs.push([mk('polyline', 'ys-d-t1'), mk('polyline', 'ys-d-t2'), mk('polyline', 'ys-d-t3')]);
    var halo = mk('ellipse', 'ys-d-halo'), head = mk('ellipse', 'ys-d-head');
    halo.setAttribute('fill', 'url(#' + gid + ')');
    fig.appendChild(svg);
    var T = 6.5 / sp, pause = 1.4 / sp, t = 0, last = 0, seen = false, born = Date.now(), W = 0, H = 0, cyc = -1;
    function size() { W = fig.clientWidth || 300; H = fig.clientHeight || W; var k = W / 400;
      svg.style.setProperty('--k', k);
      cg.setAttribute('rx', r1(v.rx * v.core * 1000) / 10); cg.setAttribute('ry', r1(v.ry * v.core / v.ar * 1000) / 10);
      head.setAttribute('rx', r1(2.4 * k / W * 1000) / 10); head.setAttribute('ry', r1(2.4 * k / H * 1000) / 10);
      halo.setAttribute('rx', r1(13 * k / W * 1000) / 10); halo.setAttribute('ry', r1(13 * k / H * 1000) / 10); }
    function part(a, b) { a = Math.max(0, Math.floor(a)); b = Math.min(M, Math.ceil(b)); return b > a ? pts.slice(a, b + 1).join(' ') : ''; }
    function frame(now) {
      if (!svg.isConnected) { if (seen || Date.now() - born > 4000) return; requestAnimationFrame(frame); return; }
      seen = true;
      var dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
      var hide = document.hidden || document.body.classList.contains('ys-sliding') || fig.classList.contains('is-try') || fig.closest('.is-chosen');
      if (!hide) {
        t += dt;
        var drain = mode === 'swave' ? T * .45 : T * trail / M, C = T + drain + pause, ph = t % C, n = Math.floor(t / C);
        if (n !== cyc) { cyc = n; size(); }
        var h = ph < T ? ph / T * M : M + (ph - T) / drain * (mode === 'swave' ? 0 : trail), len = mode === 'swave' ? Math.max(1, Math.min(h, M)) : trail;
        var fade = mode === 'swave' && ph > T ? Math.max(0, 1 - (ph - T) / drain) : 1;
        if (ph >= T + drain) { h = -1; fade = 0; }
        for (i = 0; i < N; i++) {
          var a = h - len * (i + 1) / N, b = h - len * i / N, s = part(a, b), op = Math.pow(1 - i / N, 1.7) * fade;
          segs[i].forEach(function (e) { e.setAttribute('points', s); e.style.opacity = s ? op : 0; });
        }
        var hp = P[Math.max(0, Math.min(M, Math.round(h)))];
        head.style.opacity = halo.style.opacity = h >= 0 && h <= M && mode !== 'swave' ? 1 : 0;
        if (hp) [head, halo].forEach(function (e) { e.setAttribute('cx', r1(hp[0] * 1000) / 10); e.setAttribute('cy', r1(hp[1] * 1000) / 10); });
        // Вспышка в центре — когда свет доходит до центра (от края) или выходит из него (из центра)
        var at = D.dir === 'out' ? 0 : M, dd = Math.abs(Math.min(h < 0 ? 1e9 : h, M + trail) - at) / (M * .12);
        cg.style.opacity = (mode === 'swave' ? fade * .6 * (h >= M ? 1 : 0) : Math.max(0, 1 - dd) * .75).toFixed(3);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return svg;
  }
  function inPoly(p, x, y) {
    var ins = false, i, j;
    for (i = 0, j = p.length - 1; i < p.length; j = i++) {
      if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) ins = !ins;
    }
    return ins;
  }
  function diskHit(areas, x, y) {
    for (var i = 0; i < DISK_ZONES.length - 1; i++) { var z = DISK_ZONES[i]; if (areas[z] && inPoly(areas[z], x, y)) return z; }
    return !areas.beyond || inPoly(areas.beyond, x, y) ? 'beyond' : null;
  }
  function polyD(a) { return 'M' + a.map(function (p) { return r1(p[0] * 100) + ' ' + r1(p[1] * 100); }).join('L') + 'Z'; }
  // Форма зоны для SVG: своя обводка (за диском без обводки — весь кадр)
  function zoneD(areas, z) { return areas[z] ? polyD(areas[z]) : z === 'beyond' ? 'M-1 -1H101V101H-1Z' : ''; }
  // Маска «только эта зона»: она белым, зоны раньше по порядку — чёрным (у точки одна зона)
  function zoneMask(areas, z, id, inv) {
    var k = DISK_ZONES.indexOf(z), h = '<mask id="' + id + '" maskUnits="userSpaceOnUse" x="-1" y="-1" width="102" height="102">';
    h += inv ? '<rect x="-1" y="-1" width="102" height="102" fill="#fff"/><path d="' + zoneD(areas, z) + '" fill="#000"/>' : '<path d="' + zoneD(areas, z) + '" fill="#fff"/>';
    DISK_ZONES.slice(0, k).forEach(function (q) { if (areas[q]) h += '<path d="' + zoneD(areas, q) + '" fill="' + (inv ? '#fff' : '#000') + '"/>'; });
    return h + '</mask>';
  }
  // Диск, нарисованный кодом (пока нет картинки): каменный круг с кольцами — как зоны без разметки
  function diskPlaceholder() {
    var rays = '', i, a;
    for (i = 0; i < 36; i++) { a = i / 36 * Math.PI * 2; rays += '<line x1="' + r1(50 + 33 * Math.cos(a)) + '" y1="' + r1(50 + 33 * Math.sin(a)) + '" x2="' + r1(50 + 46 * Math.cos(a)) + '" y2="' + r1(50 + 46 * Math.sin(a)) + '"/>'; }
    return '<svg class="ys-d-ph" viewBox="0 0 100 100" aria-hidden="true"><defs>' +
      '<radialGradient id="ysdp1" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#6b4a1c"/><stop offset=".6" stop-color="#3a260d"/><stop offset="1" stop-color="#1c1206"/></radialGradient>' +
      '<radialGradient id="ysdp2" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="#ffe9a8"/><stop offset=".55" stop-color="#d9a441"/><stop offset="1" stop-color="#8a5a18"/></radialGradient></defs>' +
      '<rect width="100" height="100" fill="#0c0804"/>' +
      '<circle cx="50" cy="50" r="47" fill="url(#ysdp1)" stroke="#e9c77e" stroke-opacity=".55" stroke-width=".5"/>' +
      '<g stroke="#e9c77e" stroke-opacity=".2" stroke-width=".35">' + rays + '</g>' +
      '<circle cx="50" cy="50" r="32" fill="#2a1b08" fill-opacity=".55" stroke="#e9c77e" stroke-opacity=".45" stroke-width=".4"/>' +
      '<line x1="3" y1="50" x2="97" y2="50" stroke="#e9c77e" stroke-opacity=".18" stroke-width=".3" stroke-dasharray="1 1.2"/>' +
      '<circle cx="50" cy="50" r="16" fill="url(#ysdp2)" fill-opacity=".85" stroke="#ffd76a" stroke-opacity=".8" stroke-width=".5"/></svg>';
  }
  // b — блок, n — день, k — карта, ctx — метки дня и карты; o.mark — уже выбранная зона, o.onMark(зона) — «Здесь»
  function diskNode(route, n, k, ctx, o, b) {
    o = o || {};
    var D = diskCfg(route), tx = route.texts || {}, areas = diskAreas(route), id = 'ysd' + (++ZID);
    var chosen = DISK_ZONES.indexOf(o.mark) >= 0 ? o.mark : null, tried = null;
    if (!k) k = { quality: 'Качество', axis: 'Качество и его противовес', less: { rim: 'обод', spoke: 'спица' }, more: { spoke: 'спица', rim: 'обод' } };
    var box = el('div', 'ys-disk' + (chosen ? ' is-chosen' : ''));
    if (k.quality) box.appendChild(el('p', 'ys-w-q', k.quality));
    // Способ — под названием качества (в вопросы больше не подставляется)
    if (k.way) box.appendChild(el('p', 'ys-d-way', String(k.way).trim()));
    var dq = fill(((dayOf(route, n).texts || {}).diskQuestion) || '', ctx || {}).trim();
    if (dq) box.appendChild(textNode('ys-d-q', dq));
    var fig = el('div', 'ys-d-box');
    if (D.image) { var img = el('img', 'ys-d-img'); img.src = imgSrc(o.base, D.image); img.alt = ''; img.draggable = false; fig.appendChild(img); }
    else fig.insertAdjacentHTML('beforeend', diskPlaceholder());
    // Видео-петля: появляется, только когда пошло; при «уменьшить движение» — не грузим, остаётся картинка
    if (D.video && !REDUCED) {
      var v = el('video', 'ys-d-vid');
      v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.preload = 'auto';
      v.addEventListener('playing', function () { v.classList.add('is-on'); });
      v.src = imgSrc(o.base, D.video);
      fig.appendChild(v);
      var tryPlay = function () { var p = v.play && v.play(); if (p && p.catch) p.catch(function () {}); };
      setTimeout(tryPlay, 0);
    }
    // Свет зон: приглушение остальных, свечение выбранной, приглашение (по зонам или волной)
    var defs = '', layers = '';
    DISK_ZONES.forEach(function (z) {
      if (!zoneD(areas, z)) return;
      defs += zoneMask(areas, z, id + z, false) + zoneMask(areas, z, id + z + 'x', true);
      layers += '<g class="ys-d-z" data-z="' + z + '"><rect class="ys-d-dim" x="-1" y="-1" width="102" height="102" mask="url(#' + id + z + 'x)"/>' +
        '<g mask="url(#' + id + z + ')"><path class="ys-d-fill" d="' + zoneD(areas, z) + '"/><path class="ys-d-line" d="' + zoneD(areas, z) + '"/></g></g>';
    });
    var pulse = diskPulse(route);
    if (pulse === 'zones') [['center'], ['flatUp', 'flatDown'], ['edgeUp', 'edgeDown']].forEach(function (g, j) {
      layers += '<g class="ys-d-wave" style="--j:' + j + '">' + g.map(function (z) { return zoneD(areas, z) ? '<path mask="url(#' + id + z + ')" d="' + zoneD(areas, z) + '"/>' : ''; }).join('') + '</g>';
    });
    var svg = '<svg class="ys-d-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs>' + defs + '</defs>' + layers + '</svg>';
    fig.insertAdjacentHTML('beforeend', svg);
    fig.style.setProperty('--dsp', diskSpeed(route));
    // Кольца лежат на диске: овал диска, его наклон
    if (pulse === 'ring') {
      var ov = ovalOf(route), rb = el('i', 'ys-d-ringbox');
      rb.style.left = (ov.x * 100) + '%'; rb.style.top = (ov.y * 100) + '%';
      rb.style.width = (ov.rx * 200) + '%'; rb.style.height = (ov.ry / ov.ar * 200) + '%';
      if (ov.rot) rb.style.transform = 'translate(-50%,-50%) rotate(' + ov.rot + 'deg)';
      rb.appendChild(el('i', 'ys-d-ring'));
      fig.appendChild(rb);
    }
    if ((pulse === 'spark' || pulse === 'swave') && !REDUCED && !chosen) diskRun(route, fig, pulse);
    if (hexOk(D.color)) fig.style.setProperty('--dc', D.color);
    box.appendChild(fig);
    var hint = el('p', 'ys-d-hint', fill(tx.diskHint || 'Коснитесь места на диске, где вы были тогда. Можно примерить разные.', ctx || {}));
    var info = el('div', 'ys-d-info'), here = el('button', 'ys-key-go ys-d-here', tx.diskHere || 'Здесь'), hn = el('p', 'ys-d-note', tx.diskHereNote == null ? 'Выбор окончательный — передумать будет нельзя.' : tx.diskHereNote);
    var after = el('div', 'ys-d-after');
    here.type = 'button'; here.hidden = true; hn.hidden = true;
    box.appendChild(hint); box.appendChild(info); box.appendChild(here); if (hn.textContent) box.appendChild(hn); box.appendChild(after);
    // Невидимые кнопки зон — для чтения с экрана и клавиатуры
    var sr = el('div', 'ys-d-sr');
    DISK_ZONES.forEach(function (z) { if (!zoneD(areas, z)) return; var x = el('button', null, diskName(route, z)); x.type = 'button'; x.addEventListener('click', function () { tryZone(z); }); sr.appendChild(x); });
    box.appendChild(sr);
    function showInfo(z) {
      info.replaceChildren();
      if (!z) return;
      info.appendChild(el('span', 'ys-d-zone', diskName(route, z)));
      var w = diskWord(route, k, z); if (w) info.appendChild(el('b', 'ys-d-word' + (z === 'beyond' ? ' is-q' : ''), w));
      var rec = diskText(k, 'recognize', z);
      // Описание зоны — без вводных слов (её решение 06.10): с большой буквы и с точкой; вводные слова — только если заданы в панели
      if (rec) {
        var p = el('p', 'ys-d-rec'), lead = String(tx.diskRecognize || '').trim(), rt = fill(rec, ctx || {}).trim();
        if (lead) p.appendChild(el('i', null, lead + ' '));
        else { rt = cap(rt); if (!/[.!?…»)]$/.test(rt)) rt += '.'; }
        p.appendChild(tn(rt)); info.appendChild(p);
      }
    }
    function light(z, on) { [].forEach.call(fig.querySelectorAll('.ys-d-z'), function (g) { g.classList.toggle('is-on', g.getAttribute('data-z') === z && on); }); fig.classList.toggle('is-try', !!on); }
    function tryZone(z) {
      if (chosen || !z) return;
      tried = z; light(z, true); showInfo(z);
      hint.hidden = true; here.hidden = false; hn.hidden = false;
      box.classList.add('is-trying');
    }
    function done(z, fresh) {
      chosen = z; light(z, true); showInfo(z);
      box.classList.remove('is-trying'); box.classList.add('is-chosen');
      hint.hidden = true; here.hidden = true; hn.hidden = true;
      after.replaceChildren();
      // Камушек формы этой зоны — в узор (вид — «Стёклышки» → «Отметка на диске»)
      if (n < daysCount(route)) {
        var st = el('div', 'ys-d-stone' + (fresh ? ' is-new' : '')), cv = el('canvas');
        if (window.M13K && window.M13K.stone) { var g = markGlass(route, n, z); window.M13K.stone(cv, g.c, g.look, 46); }
        st.appendChild(cv); st.appendChild(el('span', null, fill(tx.diskStone || defText(route, 'diskStone'), ctx || {})));
        after.appendChild(st);
      }
      var road = diskText(k, 'road', z) || ((route.deck || {}).wayBack || {})[DISK_FAMILY[z]] || '';
      if (road) {
        var rd = el('div', 'ys-c-text ys-d-road');
        rd.appendChild(el('span', 'ys-c-label', tx.diskRoad || 'Дорога в центр'));
        rd.appendChild(textNode('ys-c-body', fill(road, ctx || {})));
        after.appendChild(rd);
      }
    }
    fig.addEventListener('click', function (e) {
      if (chosen) return;
      var rc2 = fig.getBoundingClientRect();
      tryZone(diskHit(areas, (e.clientX - rc2.left) / rc2.width, (e.clientY - rc2.top) / rc2.height));
    });
    here.addEventListener('click', function () {
      if (!tried || chosen) return;
      if (o.onMark) o.onMark(tried);
      done(tried, true);
    });
    if (chosen) done(chosen, false);
    return box;
  }

  /* ---------- Карта дня и личная карта ----------
     kind: 'day' | 'personal'; mode: observation | journey | immersion; perm — выпавшая карта колоды (для личной).
     o: { base, onSpiral(), traceUrl, traceLabel, preview } */
  function textNode(cls, text) {
    var box = el('div', cls);
    String(text).split(/\n{2,}/).forEach(function (p) {
      var q = el('p', null, p);
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
    // Лицо выпавшей карты — колесо ('permission' — старое название блока)
    if (b.kind === 'wheel' || b.kind === 'permission') return wheelNode(route, perm, o);
    if (b.kind === 'disk') return diskNode(route, n, perm, ctx, o, b);
    if (b.kind === 'wayback') return wayBackNode(route, b);
    if (b.kind === 'small' || b.kind === 'title' || b.kind === 'note') {
      t = fill(b.text, ctx).trim(); if (!t) return null;
      if (b.kind === 'title') return el('h2', 'ys-c-title', t);
      return b.kind === 'small' ? el('p', 'ys-c-small', t) : textNode('ys-c-note', t);
    }
    // text / question — у каждого дня свой текст (day.texts[b.id]); в нём тоже можно ставить метки.
    // Своё название дня под подписью блока (day.texts[b.id + 'Title'], «Фокус дня» → «Свет, который зовёт»)
    t = fill(((d.texts || {})[b.id]) || '', ctx).trim(); if (!t) return null;
    var box = el('div', b.kind === 'question' ? 'ys-c-q' : 'ys-c-text'), tt = fill(((d.texts || {})[b.id + 'Title']) || '', ctx).trim();
    if (b.label) box.appendChild(el('span', 'ys-c-label', b.label));
    if (tt) box.appendChild(el('h3', 'ys-c-sub', tt));
    box.appendChild(textNode('ys-c-body', t));
    return box;
  }
  // Карта дня 13 — урезанная: какие блоки Карты дня на ней видны (route.final.blocks: { id блока: да/нет });
  // не задано — строки и заголовок (кин, печать, тон) и вопрос, без картинки и текстов.
  function finBlock(route, b) {
    var f = (route.final || {}).blocks || {};
    if (f[b.id] != null) return f[b.id] !== false;
    return b.kind === 'small' || b.kind === 'title' || b.kind === 'question';
  }
  // Шрифты для надписей (как на витрине); лежат на самом сайте (assets/fonts), грузятся, только когда выбраны
  var FONTS = { 'Cormorant Garamond': 'cormorant-garamond', 'Playfair Display': 'playfair-display', 'Philosopher': 'philosopher', 'Lora': 'lora',
    'Montserrat': 'montserrat', 'Comfortaa': 'comfortaa', 'Marck Script': 'marck-script' }, FONT_ON = {};
  var FONT_DIR = (function () {
    var sc = document.currentScript, src = sc && sc.src;
    if (!src) { var all = document.getElementsByTagName('script'); for (var i = 0; i < all.length; i++) if (/assets\/route\.js/.test(all[i].src)) src = all[i].src; }
    return src ? src.replace(/route\.js(\?.*)?$/, 'fonts/') : '../../assets/fonts/';
  })();
  function ensureFont(name) {
    if (!name || !FONTS[name] || FONT_ON[name] || name === 'Cormorant Garamond') return;
    FONT_ON[name] = true;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONT_DIR + FONTS[name] + '.css';
    document.head.appendChild(l);
  }
  // «С чем вы выходите?» — до трёх состояний (можно не выбирать). chosen — уже выбранные (номера), onChange(список)
  // Вид (route.final.exitView): 'balls' — шарики с подписью (как на входе), 'glass' — настоящие стёклышки (вид — «Стёклышки» → «Состояния»).
  // Заголовок — своим шрифтом и размером (final.exitFont, final.exitSize, px). Выбранное — мягко светится своим цветом, с золотым ободком.
  function exitPicker(route, chosen, onChange) {
    var tx = route.texts || {}, f = route.final || {}, L = statesOf(route), glassV = f.exitView === 'glass', box = el('div', 'ys-states ys-exit' + (glassV ? ' ys-exit--glass' : ''));
    chosen = (chosen || []).slice();
    var NG = neonOf(route, 'glass');
    var h = el('h3', 'ys-exit-t', tx.exitTitle || 'С чем вы выходите?');
    if (f.exitFont && FONTS[f.exitFont]) { ensureFont(f.exitFont); h.style.fontFamily = "'" + f.exitFont + "',Georgia,serif"; }
    if (+f.exitSize) h.style.fontSize = Math.max(16, Math.min(48, +f.exitSize)) + 'px';
    box.appendChild(h);
    if (tx.exitLead !== '') box.appendChild(el('p', 'ys-exit-lead', tx.exitLead || defText(route, 'exitLead')));
    var wrap = el('div', 'ys-st-list');
    shuffled(L.length).forEach(function (i) {
      var b = el('button', 'ys-st' + (glassV ? ' ys-st--glass' : '') + (chosen.indexOf(i) >= 0 ? ' is-on' : '')), dot = el(glassV ? 'canvas' : 'i', 'ys-st-g'); b.type = 'button';
      var col = L[i].color || '#ffcf5a';
      dot.style.setProperty('--c', col);
      b.style.setProperty('--cn', neonHex(col, NG));
      if (glassV && window.M13K && window.M13K.stone) { var g = stateGlass(route, i); window.M13K.stone(dot, g.c, g.look, 52); }
      b.appendChild(dot); b.appendChild(el('span', null, L[i].name || ''));
      b.setAttribute('aria-pressed', String(chosen.indexOf(i) >= 0));
      b.addEventListener('click', function () {
        var k = chosen.indexOf(i);
        if (k >= 0) chosen.splice(k, 1); else if (chosen.length < 3) chosen.push(i); else return;
        b.classList.toggle('is-on', k < 0); b.setAttribute('aria-pressed', String(k < 0));
        box.classList.toggle('is-full', chosen.length === 3);
        onChange(chosen.slice().sort(function (a, b) { return a - b; }));
      });
      wrap.appendChild(b);
    });
    box.classList.toggle('is-full', chosen.length === 3);
    box.appendChild(wrap);
    return box;
  }
  /* Кнопка «Собрать маршрут» — спираль из 13 светящихся точек (route.final.gatherStyle: 'spiral' по умолчанию | 'plain' — золотая кнопка).
     12 точек по виткам — стёклышки 12 дней (их цвета), 13-я в центре — цвета выбранных «С чем вы выходите?» (ничего не выбрано — золото).
     Вид точек — final.gatherDots: 'dots' (светящиеся точки) | 'glass' (маленькие стёклышки, вид — «Стёклышки» → «Дни»).
     Ждёт: точки по очереди медленно загораются от края к центру, потом пауза (скорость — final.gatherSpeed, %, по умолчанию 100).
     Нажали: огоньки сбегаются в центр, вспышка — и финал. Общая деталь: M13R.spiralButton — для других страниц позже. */
  function spiralSpeed(v) { return Math.max(30, Math.min(250, v == null || v === '' || isNaN(+v) ? 100 : +v)) / 100; }
  function gatherButton(route, exit, onGo) {
    var tx = route.texts || {}, f = route.final || {}, label = tx.gather || 'Собрать маршрут';
    if (f.gatherStyle === 'plain') {
      var pb = el('button', 'ys-key-go ys-gather', label); pb.type = 'button';
      pb.addEventListener('click', function () { onGo(); });
      return { node: pb, update: function () {} };
    }
    var NB = neonOf(route, 'button'), glassV = f.gatherDots === 'glass', last = daysCount(route), busy = false;
    var b = el('button', 'ys-gbtn'), sp = el('span', 'ys-gbtn-sp'), pts = [], i, a, r, line = [];
    b.type = 'button'; b.setAttribute('aria-label', label);
    // Спираль посолонь от края к центру (как знак спирали), точки — через равные отрезки пути
    var N = 400, P = [], L = [0];
    for (i = 0; i <= N; i++) { a = i / N * Math.PI * 2 * 2.3; r = 47 - i / N * 39; P.push([50 + r * Math.cos(a - Math.PI / 2), 50 + r * Math.sin(a - Math.PI / 2)]); }
    for (i = 1; i <= N; i++) L.push(L[i - 1] + Math.sqrt(Math.pow(P[i][0] - P[i - 1][0], 2) + Math.pow(P[i][1] - P[i - 1][1], 2)));
    P.forEach(function (q, j) { if (j % 4 === 0) line.push(q[0].toFixed(1) + ',' + q[1].toFixed(1)); });
    sp.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><polyline points="' + line.join(' ') + '" fill="none" stroke="#ffd98a" stroke-opacity=".28" stroke-width="1.1" stroke-linecap="round"/></svg>';
    for (i = 0; i < last - 1; i++) {
      var want = L[N] * i / (last - 1) * .97, j = 0;
      while (j < N && L[j] < want) j++;
      pts.push(P[j]);
    }
    pts.push([50, 50]);
    var dots = pts.map(function (q, k) {
      var c = k < last - 1 ? dayGlassColor(route, k + 1) : null, d = el(glassV && c ? 'canvas' : 'i', 'ys-gd' + (c ? '' : ' ys-gd--c'));
      d.style.left = q[0] + '%'; d.style.top = q[1] + '%';
      d.style.setProperty('--i', k); d.style.setProperty('--dx', ((50 - q[0]) * 1.12).toFixed(1) + 'px'); d.style.setProperty('--dy', ((50 - q[1]) * 1.12).toFixed(1) + 'px');
      if (c) {
        var nc = neonRgb(c, NB); d.style.setProperty('--c', rgbHex(nc));
        if (glassV && window.M13K && window.M13K.stone) window.M13K.stone(d, c, glassLook(route, 'days'), 22);
      }
      sp.appendChild(d);
      return d;
    });
    var center = dots[dots.length - 1];
    function update(l) {
      var cs = (l || []).map(function (n) { var g = stateGlass(route, n); return g ? rgbHex(neonRgb(g.c, NB)) : null; }).filter(Boolean);
      if (!cs.length) cs = ['#ffd76a'];
      center.style.setProperty('--c', cs[0]);
      center.style.background = cs.length === 1 ? '' : 'conic-gradient(' + cs.map(function (c, k) { return c + ' ' + Math.round(k / cs.length * 360) + 'deg ' + Math.round((k + 1) / cs.length * 360) + 'deg'; }).join(',') + ')';
    }
    update(exit);
    // Шаг между точками и пауза после круга — по скорости из панели
    var spd = spiralSpeed(f.gatherSpeed), gs = .45 / spd;
    b.style.setProperty('--gs', gs.toFixed(3) + 's'); b.style.setProperty('--gc', (gs * last + 2.6 / spd).toFixed(2) + 's');
    b.appendChild(sp); b.appendChild(el('span', 'ys-gbtn-t', label));
    b.addEventListener('click', function () {
      if (busy) return; busy = true;
      if (REDUCED) { onGo(); return; }
      b.classList.add('is-go');
      setTimeout(function () { b.classList.add('is-flash'); }, 950);
      setTimeout(function () { onGo(); setTimeout(function () { busy = false; b.classList.remove('is-go', 'is-flash'); }, 800); }, 1300);
    });
    return { node: b, update: update };
  }
  // Выравнивание (её просьба 03.10): у карты — для абзацев (route.dayCard.align / personalCard.align: '' как задумано | left | center | right | justify),
  // у блока — своё (b.align, '' — как у карты; у строк и заголовков '' — по центру, как задумано)
  var AL_OK = { left: 1, center: 1, right: 1, justify: 1 }, AL_PARA = { text: 1, question: 1, note: 1, disk: 1, wayback: 1 };
  function blockAlign(b, cardAl) { return AL_OK[b.align] ? b.align : AL_PARA[b.kind] && AL_OK[cardAl] ? cardAl : ''; }
  function card(route, n, mode, kind, perm, o) {
    o = o || {};
    var cfg = (kind === 'personal' ? route.personalCard : route.dayCard) || {}, list = cfg.blocks || [];
    var ctx = ctxOf(route, n, kind === 'personal' ? perm : null), fin = kind === 'day' && n === daysCount(route);
    var root = el('article', 'ys-card ys-card--' + kind + (n === daysCount(route) ? ' ys-card--center' : '') + (fin ? ' ys-card--final' : ''));
    var inner = el('div', 'ys-card-in');
    list.forEach(function (b) {
      if (!b || b.visible === false) return;
      if (b.who && b.who[mode] === false) return;
      if (fin && !finBlock(route, b)) return;
      var node = blockNode(b, route, n, perm, ctx, o), al = blockAlign(b, cfg.align);
      if (node && al) node.classList.add('ys-al', 'ys-al--' + al);
      if (node) inner.appendChild(node);
    });
    var foot = el('div', 'ys-c-foot');
    // День 13: у Путешествия и Погружения — «С чем вы выходите?»; внизу — «Собрать маршрут» (финал Солнца)
    // Двери v2: «Есть ключ? Введи ключ» — живой вход глубже (виден и в Наблюдении, чтобы человек знал, что глубже что-то есть)
    function keyBtn() {
      if (!o.onKey) return;
      var k = el('button', 'ys-c-key'); k.type = 'button';
      k.innerHTML = spiralSVG(); k.appendChild(el('span', null, o.keyText || 'Есть ключ? Введи ключ'));
      k.addEventListener('click', function () { o.onKey(); });
      foot.appendChild(k);
    }
    if (fin) {
      var exit = (o.exit || []).slice(), gb;
      if (mode !== 'observation' && statesOf(route).length >= 3 && (route.final || {}).exitOn !== false) inner.appendChild(exitPicker(route, exit, function (l) { exit = l; if (gb) gb.update(l); }));
      keyBtn();
      gb = gatherButton(route, exit, function () { if (o.onGather) o.onGather(exit); else if (o.onSpiral) o.onSpiral(); });
      foot.appendChild(gb.node);
      inner.appendChild(foot); root.appendChild(inner);
      return root;
    }
    if (kind === 'personal' && mode !== 'observation') {
      var url = ((route.trace || {})[mode]) || '';
      var tr = el('a', 'ys-c-trace', ((route.texts || {}).trace) || 'Оставить след');
      if (url) { tr.href = url; tr.target = '_blank'; tr.rel = 'noopener'; } else tr.setAttribute('aria-disabled', 'true');
      foot.appendChild(tr);
    }
    keyBtn();
    var sp = el('button', 'ys-spiral');
    sp.type = 'button';
    sp.setAttribute('aria-label', o.spiralLabel || (kind === 'personal' || mode === 'observation' ? 'Вернуться на спираль' : 'Дальше — выбрать карту'));
    sp.innerHTML = spiralSVG();
    sp.addEventListener('click', function () { if (o.onSpiral) o.onSpiral(); });
    foot.appendChild(sp);
    inner.appendChild(foot);
    root.appendChild(inner);
    return root;
  }


  /* ---------- Кирпичи на спирали ----------
     Разметка — route.zones.desktop и route.zones.mobile (своя у каждой картинки; панель → «Кирпичи на спирали»):
     { path: [[x, y, ox, oy] × 25], center: {x, y, rx, ry}, width: 100 }. x, y — доли картинки; ox, oy — от середины плиты
     до её внешнего края поперёк витка (доли ширины и высоты картинки: сзади витки сжаты перспективой, по бокам — нет);
     старый вид [x, y, w] — ширина w по линии к центру. width — общая толщина подсветки в %. Точки 0, 2 … 24 — стыки дней, 1, 3 … 23 — середины: день d идёт от точки 2(d−1) до 2d.
     Путь — от входа (внешний край слева) по часовой стрелке внутрь, посолонь; день 13 — диск в центре. */
  var PATH_DAYS = 12, SPAN = 10, ZID = 0;
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function zoneOk(z) { return !!(z && z.path && z.path.length >= PATH_DAYS * 2 + 1 && z.center); }
  // Картинка и разметка для экрана: вытянутый (телефон) — mobile, иначе desktop; если своей картинки нет — берётся другая.
  function pickMaster(route, tall) {
    var z = route.zones || {}, t = tall ? !!route.masterMobile || !route.masterDesktop : !route.masterDesktop && !!route.masterMobile;
    var zone = t ? z.mobile : z.desktop;
    return { src: t ? route.masterMobile : route.masterDesktop, zone: zoneOk(zone) ? zone : null, tall: t };
  }
  function cr(p0, p1, p2, p3, t) { var t2 = t * t; return .5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t2 * t); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  // Сглаженная линия пути (через все точки) с толщиной; у каждой выборки — номер дня. Координаты — пиксели картинки.
  function trace(z, iw, ih) {
    var k = (z.width == null || z.width === '' ? 100 : +z.width) / 100, n = PATH_DAYS * 2, out = [], i, s, t, a, b, c, d;
    var P = z.path.slice(0, n + 1).map(function (p) {
      return p.length >= 4 ? [p[0] * iw, p[1] * ih, p[2] * iw * k, p[3] * ih * k] : [p[0] * iw, p[1] * ih, (p[2] || .02) * iw * k, null];
    });
    var C = { x: z.center.x * iw, y: z.center.y * ih };
    for (i = 0; i < n; i++) {
      a = P[i - 1] || P[i]; b = P[i]; c = P[i + 1]; d = P[i + 2] || P[i + 1];
      for (s = 0; s < SPAN || (i === n - 1 && s === SPAN); s++) {
        t = s / SPAN;
        var q = { x: cr(a[0], b[0], c[0], d[0], t), y: cr(a[1], b[1], c[1], d[1], t), day: Math.min(PATH_DAYS, Math.floor(i / 2) + 1) };
        if (b[3] != null && c[3] != null) { q.ox = cr(a[2], b[2], c[2], d[2], t); q.oy = cr(a[3], b[3], c[3], d[3], t); }
        else {
          // Старая разметка: поперёк витка — по линии к центру (так полоса не заворачивается на крутых изгибах)
          var h = (b[2] + (c[2] - b[2]) * t) / 2, l = dist(q, C) || 1;
          q.ox = (q.x - C.x) / l * h; q.oy = (q.y - C.y) / l * h;
        }
        q.w = 2 * Math.sqrt(q.ox * q.ox + q.oy * q.oy);
        out.push(q);
      }
    }
    return out;
  }
  // Выборки дня d вместе с первой точкой следующего (чтобы полосы стыковались).
  function daySlice(tr, d) {
    var a = -1, b = -1;
    tr.forEach(function (p, j) { if (p.day === d) { if (a < 0) a = j; b = j; } });
    return a < 0 ? [] : tr.slice(a, b + 2);
  }
  function ribbonPath(pts, f) {
    if (pts.length < 2) return '';
    var L = [], R = [];
    pts.forEach(function (p) {
      L.push(r1(p.x + p.ox * f) + ',' + r1(p.y + p.oy * f)); R.unshift(r1(p.x - p.ox * f) + ',' + r1(p.y - p.oy * f));
    });
    return 'M' + L.join('L') + 'L' + R.join('L') + 'Z';
  }
  function xy(p) { return r1(p.x) + ',' + r1(p.y); }
  // Цвет свечения дня d: свой у дня (days[d−1].glowColor) или общий glow.color.
  function hexOk(c) { return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c || ''); }
  function dayColor(route, d, base) {
    var day = (route.days || [])[d - 1], g = route.glow || {};
    return day && hexOk(day.glowColor) ? day.glowColor : hexOk(base) ? base : hexOk(g.color) ? g.color : '#ffcf5a';
  }
  // Цвет печати Dreamspell по Kin (красный, белый, синий, жёлтый по кругу); нет Kin — по названию печати. Для кнопки в панели.
  // Белая печать — розовый жемчуг (её выбор 03.10: чисто белый огонёк и камень сливались в белое пятно)
  var SEAL_GLOW = ['#ff5a3c', '#e9cde0', '#4f9dff', '#ffcf5a'];
  function sealColor(day) {
    var k = day && +day.kin, s = String(day && (day.seal || day.kinName) || '').toLowerCase();
    if (k >= 1) return SEAL_GLOW[((k - 1) % 20) % 4];
    if (/красн/.test(s)) return SEAL_GLOW[0];
    if (/бел/.test(s)) return SEAL_GLOW[1];
    if (/син/.test(s)) return SEAL_GLOW[2];
    if (/ж[её]лт/.test(s)) return SEAL_GLOW[3];
    return '';
  }
  /* Неон (route.neon, панель → «Основное» → «Неон»): цвет насыщеннее и светится изнутри, вокруг — цветное сияние.
     all — общий, 0…150 % (по умолчанию 40); свой у места (пусто — как общий): spiral — камни на спирали в дни маршрута (пусто — 0),
     lights — огоньки финала и их след, stones — свет камней в финале, disk — центральный диск, button — точки кнопки «Собрать маршрут»,
     glass — подсветка выбранных стёклышек, mandala — блики на мандале, plants — светящиеся растения. */
  var NEON_KEYS = ['spiral', 'lights', 'stones', 'disk', 'button', 'glass', 'mandala', 'plants'];
  function neonOf(route, key) {
    var N = (route && route.neon) || {}, v = N[key];
    // Камни на спирали без своего значения — без неона: их золотой свет не меняется, пока она сама не подвинет ползунок
    if ((v == null || v === '' || isNaN(+v)) && key === 'spiral') v = 0;
    if (v == null || v === '' || isNaN(+v)) v = N.all;
    if (v == null || v === '' || isNaN(+v)) v = 40;
    return Math.max(0, Math.min(150, +v)) / 100;
  }
  function neonRgb(c, k) { return window.M13K && window.M13K.neonC ? window.M13K.neonC(c, k) : c; }
  function rgbHex(c) { return '#' + c.map(function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(''); }
  function neonHex(h, k) { return k ? rgbHex(neonRgb(hexRgb(h), k)) : h; }
  // Сила свечения: 100 % — как было в начале, больше — ярче и шире ореол
  function glowPower(route) { var g = route.glow || {}; return Math.max(50, Math.min(300, g.power == null || g.power === '' ? 150 : +g.power)) / 100; }
  // Свет кирпичей 0…1: дни 1…12 и центр (последний день). n — сегодняшний день (0 — до начала, больше последнего — после конца).
  // Кирпичи — время маршрута, не личный путь: прошедшие — спокойно, сегодняшний — ярко и «дышит» (после нажатия — ровно), будущие — в тени.
  function lights(route, n, opened) {
    var g = route.glow || {}, last = daysCount(route), lv = [], d;
    function v(x, def) { return Math.max(0, Math.min(100, x == null || x === '' ? def : +x)) / 100; }
    var T = v(g.today, 100), D = v(g.done, 55), F = v(g.future, 12);
    for (d = 1; d <= last; d++) lv[d] = n > last ? T : d < n ? D : d > n ? F : opened ? (T + D) / 2 : T;
    return { lv: lv, today: n >= 1 && n <= last ? n : 0, calling: n >= 1 && n <= last && !opened, after: n > last, last: last };
  }
  // Слои света поверх картинки (все — в пикселях картинки, тянутся вместе с ней):
  // сумрак с «окнами» на светящихся кирпичах; мягкое свечение (screen); сегодняшний — отдельным слоем, он дышит; импульс; разметка (проверка).
  // o: { color, dusk 0…1, zones — показать контуры и номера ('outline' — только контуры) }
  function bricksLayer(route, z, iw, ih, o) {
    var id = 'ysz' + (++ZID), tr = trace(z, iw, ih), c = z.center;
    var B = { id: id, iw: iw, ih: ih, trace: tr, color: hexOk(o.color) ? o.color : '#ffcf5a', center: { cx: c.x * iw, cy: c.y * ih, rx: c.rx * iw, ry: c.ry * ih } };
    var vb = ' viewBox="0 0 ' + iw + ' ' + ih + '" preserveAspectRatio="none" aria-hidden="true"';
    var soft = r1(iw * .006), halo = r1(iw * .012), last = daysCount(route), shapes = [];
    var box = el('div', 'ys-bricks');
    var svgs = ['ys-l-dusk', 'ys-l-glow', 'ys-l-today', 'ys-l-pulse', 'ys-l-zones'].map(function (cls) {
      box.insertAdjacentHTML('beforeend', '<svg class="' + cls + '"' + vb + '></svg>');
      return box.lastChild;
    });
    for (var d = 1; d <= last; d++) shapes[d] = d === last ? null : ribbonPath(daySlice(tr, d), 1);
    var NS = neonOf(route, 'spiral');
    B.colorOf = function (d) { return neonHex(dayColor(route, d, B.color), NS); };
    if (NS) { halo = r1(iw * .012 * (1 + NS * .7)); }
    var P = (o.power == null ? glowPower(route) : o.power) * (1 + NS * .35), bloom = r1(iw * .03 * (1 + NS * .5));
    function shape(d, attrs, grow) {
      var C = B.center, g = grow || 1;
      return d === last ? '<ellipse cx="' + r1(C.cx) + '" cy="' + r1(C.cy) + '" rx="' + r1(C.rx * g) + '" ry="' + r1(C.ry * g) + '" ' + attrs + '/>' : '<path d="' + shapes[d] + '" ' + attrs + '/>';
    }
    function filt(name, sd, all) {
      // all — широкий ореол: область фильтра на всю картинку, иначе размытие обрежется у краёв полосы
      return '<filter id="' + id + name + '"' + (all ? ' filterUnits="userSpaceOnUse" x="0" y="0" width="' + iw + '" height="' + ih + '"' : ' x="-30%" y="-30%" width="160%" height="160%"') + '><feGaussianBlur stdDeviation="' + sd + '"/></filter>';
    }
    // Сила P: ярче сама полоса и сердцевина; больше 100 % — ещё широкий ореол (bloom) вокруг светящихся камней
    function op(x) { return Math.min(1, x).toFixed(2); }
    B.paint = function (st) {
      var holes = '', glow = '', wide = '', today = '', todayWide = '', col, d, lv, pb = Math.max(0, P - 1);
      for (d = 1; d <= last; d++) {
        lv = st.lv[d] || 0; col = B.colorOf(d);
        holes += shape(d, 'fill="#000" fill-opacity="' + Math.min(1, lv * 1.5).toFixed(2) + '"');
        if (d === st.today && st.calling) {
          today += shape(d, 'fill="' + col + '"' + (P < 1 ? ' fill-opacity="' + op(P) + '"' : '')) + shape(d, 'fill="#fff4cf" fill-opacity="' + op(.55 * Math.sqrt(P)) + '"', .6);
          if (pb) todayWide += shape(d, 'fill="' + col + '" fill-opacity="' + op(.5 * pb) + '"', 1.15);
        } else if (lv > 0) {
          glow += shape(d, 'fill="' + col + '" fill-opacity="' + op(lv * .62 * Math.min(P, 1.6)) + '"');
          if (pb) wide += shape(d, 'fill="' + col + '" fill-opacity="' + op(lv * .45 * pb) + '"', 1.15);
        }
      }
      // После конца маршрута в центре — Солнце (заглушка): большой мягкий диск
      if (st.after) glow += shape(last, 'fill="' + B.color + '" fill-opacity=".55"', 1.9) + shape(last, 'fill="#fff4cf" fill-opacity=".7"', .9);
      svgs[0].innerHTML = '<defs>' + filt('s', soft) + '<mask id="' + id + 'm" maskUnits="userSpaceOnUse" x="0" y="0" width="' + iw + '" height="' + ih + '">' +
        '<rect width="' + iw + '" height="' + ih + '" fill="#fff"/><g filter="url(#' + id + 's)">' + holes + '</g></mask></defs>' +
        '<rect width="' + iw + '" height="' + ih + '" fill="#070402" fill-opacity="' + (o.dusk == null ? .35 : o.dusk) + '" mask="url(#' + id + 'm)"/>';
      svgs[1].innerHTML = '<defs>' + filt('h', halo) + filt('w', bloom, 1) + '</defs>' + (wide ? '<g filter="url(#' + id + 'w)">' + wide + '</g>' : '') + '<g filter="url(#' + id + 'h)">' + glow + '</g>';
      // Центр (день 13): плоский эллипс — область фильтра на всю картинку, иначе свечение обрезается квадратом
      svgs[2].innerHTML = today ? '<defs>' + filt('t', halo, st.today === last) + filt('tw', bloom, 1) + '</defs>' + (todayWide ? '<g filter="url(#' + id + 'tw)">' + todayWide + '</g>' : '') + '<g filter="url(#' + id + 't)">' + today + '</g>' : '';
    };
    if (o.zones) {
      var zs = '', fs = r1(iw * .02);
      for (d = 1; d <= last; d++) {
        var m = d === last ? { x: B.center.cx, y: B.center.cy } : tr[(2 * d - 1) * SPAN];
        zs += shape(d, 'fill="none" stroke="#7ff" stroke-width="' + r1(iw * .0015) + '"') + (o.zones === 'outline' ? '' :
          '<text x="' + r1(m.x) + '" y="' + r1(m.y + fs * .35) + '" font-size="' + fs + '" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="' + r1(fs * .12) + '" paint-order="stroke" font-family="sans-serif" font-weight="700">' + d + '</text>');
      }
      svgs[4].innerHTML = zs;
    }
    B.node = box; B.pulse = svgs[3]; B.today = svgs[2]; B.spark = sparkPower(route); B.sparkSpd = sparkSpeed(route);
    B.run = function (d, done) { pulse(B, d, done || function () {}); };
    return B;
  }
  // Какой кирпич под точкой (x, y в пикселях картинки). tol — запас вокруг полосы; у сегодняшнего (prefer) — запас больше (big).
  function hitDay(B, x, y, last, tol, prefer, big) {
    var C = B.center, best = 0, bd = 1e9, p = { x: x, y: y };
    function inC(t) { var dx = (x - C.cx) / (C.rx + t), dy = (y - C.cy) / (C.ry + t); return dx * dx + dy * dy <= 1; }
    if (prefer === last && inC(big)) return last;
    if (prefer && prefer < last) B.trace.forEach(function (q) { if (q.day === prefer && dist(p, q) - q.w / 2 <= big) best = prefer; });
    if (best) return best;
    if (inC(tol)) return last;
    B.trace.forEach(function (q) { var dd = dist(p, q) - q.w / 2; if (dd < bd) { bd = dd; best = q.day; } });
    return bd <= tol ? best : 0;
  }
  // Огонёк к центру — яркость (glow.spark, 20–200 %, по умолчанию 100 %)
  function sparkPower(route) { var g = route.glow || {}; return Math.max(20, Math.min(200, g.spark == null || g.spark === '' ? 100 : +g.spark)) / 100; }
  // Огонёк к центру — скорость (glow.sparkSpeed, 30–250 %, по умолчанию 100 %: от последнего камня ~0,65 с, от первого ~1,9 с)
  function sparkSpeed(route) { var g = route.glow || {}, v = g.sparkSpeed; return Math.max(30, Math.min(250, v == null || v === '' || isNaN(+v) ? 100 : +v)) / 100; }
  // Световой импульс: от середины кирпича дня d по спирали к центру, вспышка в центре, затем done().
  // Огонёк — цветом дня, прозрачный и насыщенный, без белой серединки (как огоньки финала); в центре — мягкая цветная вспышка.
  function pulse(B, d, done) {
    var tr = B.trace, C = B.center, svg = B.pulse, iw = B.iw, col = B.colorOf ? B.colorOf(d) : B.color, fid = B.id + 'p', k1 = B.spark || 1;
    var pts = (d <= PATH_DAYS ? tr.slice((2 * d - 1) * SPAN) : []).concat([{ x: C.cx, y: C.cy, w: C.ry * 1.4 }]);
    var acc = [0], L = 0, i, t0 = 0;
    for (i = 1; i < pts.length; i++) { L += dist(pts[i - 1], pts[i]); acc.push(L); }
    var dur = pts.length > 1 ? (650 + 1250 * Math.min(1, (pts.length - 1) / (tr.length - SPAN))) / (B.sparkSpd || 1) : 0;
    function op(x) { return Math.min(1, x * k1).toFixed(2); }
    svg.classList.remove('is-fade');
    svg.innerHTML = '<defs><filter id="' + fid + '" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="' + r1(iw * .005) + '"/></filter>' +
      '<radialGradient id="' + fid + 'g"><stop offset="0" stop-color="' + col + '" stop-opacity="' + op(1) + '"/><stop offset=".35" stop-color="' + col + '" stop-opacity="' + op(.62) + '"/>' +
      '<stop offset=".7" stop-color="' + col + '" stop-opacity="' + op(.2) + '"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></radialGradient></defs>' +
      '<path fill="none" stroke="' + col + '" stroke-opacity="' + op(.6) + '" stroke-linecap="round" stroke-linejoin="round" filter="url(#' + fid + ')"/>' +
      '<ellipse cx="' + r1(C.cx) + '" cy="' + r1(C.cy) + '" rx="' + r1(C.rx * 1.35) + '" ry="' + r1(C.ry * 1.35) + '" fill="url(#' + fid + 'g)" opacity="0"/>' +
      '<circle fill="url(#' + fid + 'g)"/>';
    var trail = svg.childNodes[1], flash = svg.childNodes[2], halo = svg.childNodes[3];
    function step(ts) {
      if (!t0) t0 = ts;
      var k = dur ? Math.min(1, (ts - t0) / dur) : 1, e = k < .5 ? 2 * k * k : 1 - Math.pow(2 - 2 * k, 2) / 2, s = e * L, j = 1;
      while (j < pts.length - 1 && acc[j] < s) j++;
      var a = pts[j - 1] || pts[0], b = pts[j] || pts[0], f = acc[j] > acc[j - 1] ? (s - acc[j - 1]) / (acc[j] - acc[j - 1]) : 1;
      var h = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, w = a.w + (b.w - a.w) * f;
      trail.setAttribute('d', 'M' + pts.slice(0, j).map(xy).join('L') + 'L' + xy(h));
      trail.setAttribute('stroke-width', r1(Math.max(w * .22, iw * .004)));
      halo.setAttribute('cx', r1(h.x)); halo.setAttribute('cy', r1(h.y)); halo.setAttribute('r', r1(Math.max(w * .5, iw * .016)));
      if (k < 1) { requestAnimationFrame(step); return; }
      var f0 = 0;
      (function fl(ts2) {
        if (!f0) f0 = ts2;
        var q = Math.min(1, (ts2 - f0) / 320);
        flash.setAttribute('opacity', q.toFixed(2)); halo.setAttribute('opacity', (1 - q).toFixed(2));
        if (q < 1) { requestAnimationFrame(fl); return; }
        done();
        svg.classList.add('is-fade');
        setTimeout(function () { if (svg.classList.contains('is-fade')) { svg.innerHTML = ''; svg.classList.remove('is-fade'); } }, 1100);
      })(ts);
    }
    requestAnimationFrame(step);
  }

  /* ---------- Личный код и колода ----------
     Ключ (слово из группы) проверяется в браузере: на сайте лежит только его отпечаток — SHA-1 от «m13|<маршрут>|ключ»
     (ключ строчными, без пробелов, ё → е; панель считает так же). Подошёл ключ → человек выбирает 3 состояния из 12 →
     один раз случайное число seed → личный код вида ИСКРА-7ЖК-4Б2: слово + 6 знаков = 34 бита:
     seed (16) · формат (1 — Погружение) · состояния (8: номер тройки из 220) · проверка (9, от маршрута, первого дня, формата, seed и состояний).
     Состояния живут только в коде — сервера нет. Из кода считаются колода (день d → карта deck[d − 1]) и узор калейдоскопа —
     на любом устройстве одинаково. Что человек нажал в круге карт, на результат не влияет (вариант А, «колода нашей жизни»).
     Порядок состояний и карт в панели после выдачи кодов не менять: номера в коде — по этому порядку. */
  var CODE_ABC = 'АБВГДЕЖИКЛМНПРСТУФХЦШЭЮЯ23456789';
  var CODE_WORDS = ['СОЛНЦЕ', 'ЛУЧ', 'ЗАРЯ', 'СВЕТ', 'ИСКРА', 'ПЛАМЯ', 'ЯНТАРЬ', 'ЗОЛОТО', 'РАССВЕТ', 'ПОЛДЕНЬ', 'ВОСХОД', 'ОГОНЬ', 'КОЛОС', 'ЖАР', 'СИЯНИЕ', 'ТЕПЛО'];
  var LAT = { A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У' };
  var TAIL = 6, P30 = 1073741824;
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
  // Тройки состояний из 12: номер 0…219 ↔ [a, b, c] (a < b < c — номера в списке состояний)
  var TRIPLES = (function () { var l = [], a, b, c; for (a = 0; a < 12; a++) for (b = a + 1; b < 12; b++) for (c = b + 1; c < 12; c++) l.push([a, b, c]); return l; })();
  function tripleNo(st) {
    var x = (st || []).slice().sort(function (a, b) { return a - b; }).join(',');
    for (var i = 0; i < TRIPLES.length; i++) if (TRIPLES[i].join(',') === x) return i;
    return -1;
  }
  function statesOf(route) { return ((route.states || {}).items) || []; }
  function codeCheck(route, mode, seed, st) { return h32('m13code|' + route.id + '|' + (route.start || '') + '|' + mode + '|' + seed + '|' + st) & 511; }
  function makeCode(route, mode, seed, st) {
    seed = seed & 0xffff; st = st >= 0 && st < TRIPLES.length ? st : 0;
    var raw = ((seed * 2 + (mode === 'immersion' ? 1 : 0)) * 256 + st) * 512 + codeCheck(route, mode, seed, st), tail = raw % P30, s = '', i;
    for (i = TAIL - 1; i >= 0; i--) s += CODE_ABC.charAt(Math.floor(tail / Math.pow(32, i)) % 32);
    return CODE_WORDS[Math.floor(raw / P30)] + '-' + s.slice(0, 3) + '-' + s.slice(3);
  }
  // states — номера трёх состояний (по порядку в панели); нет — случайные (тестовый код)
  function newCode(route, mode, states) {
    var seed = Math.floor(Math.random() * 65536), st = tripleNo(states);
    try { seed = crypto.getRandomValues(new Uint16Array(1))[0]; } catch (e) {}
    if (st < 0) st = Math.floor(Math.random() * TRIPLES.length);
    return readCode(route, makeCode(route, mode, seed, st));
  }
  // Код из того, что набрал человек: регистр, пробелы, дефисы, латинские двойники (C, O, X…), ё/й, З вместо 3 — не важны.
  // Неверный код (опечатка) — null: проверка не сходится.
  function readCode(route, input) {
    var s = String(input || '').toUpperCase().replace(/Ё/g, 'Е').replace(/Й/g, 'И').replace(/[ABCEHKMOPTXY]/g, function (c) { return LAT[c]; }).replace(/[^А-Я0-9]/g, '');
    for (var w = 0; w < CODE_WORDS.length; w++) {
      var W = CODE_WORDS[w]; if (s.length !== W.length + TAIL || s.indexOf(W) !== 0) continue;
      var tail = s.slice(W.length).replace(/З/g, '3'), t = 0, i, k;
      for (i = 0; i < TAIL; i++) { k = CODE_ABC.indexOf(tail.charAt(i)); if (k < 0) return null; t = t * 32 + k; }
      var raw = w * P30 + t, chk = raw % 512, rest = Math.floor(raw / 512), st = rest % 256, ms = Math.floor(rest / 256);
      var mode = ms % 2 ? 'immersion' : 'journey', seed = Math.floor(ms / 2);
      if (st >= TRIPLES.length || chk !== codeCheck(route, mode, seed, st)) return null;
      return { code: W + '-' + tail.slice(0, 3) + '-' + tail.slice(3), mode: mode, seed: seed, states: TRIPLES[st].slice() };
    }
    return null;
  }
  // Порядок карт колоды у человека: перемешаны один раз — от кода. Порядок карт в панели после выдачи кодов не менять.
  function deckOf(route, c) {
    var n = cardsOf(route).length, a = [], i, j, t, R = rng(h32('m13deck|' + route.id + '|' + (route.start || '') + '|' + c.mode + '|' + c.seed));
    for (i = 0; i < n; i++) a.push(i);
    for (i = n - 1; i > 0; i--) { j = Math.floor(R() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // Карта дня d по коду. 13 карт на 12 дней: последняя в колоде остаётся закрытой, ей ничего не придаём.
  function cardFor(route, c, d) { var dk = c ? deckOf(route, c) : []; return dk.length ? cardsOf(route)[dk[(d - 1) % dk.length]] : null; }

  // Ключ → формат ('journey' | 'immersion' | ''). SHA-1 — браузерный, а где его нет (страница не по https) — свой.
  function keyNorm(k) { return String(k || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ''); }
  function sha1js(bytes) {
    var n = bytes.length, words = ((n + 8) >> 6) + 1, w = [], i, j, x = [];
    for (i = 0; i < words * 16; i++) w[i] = 0;
    for (i = 0; i < n; i++) w[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
    w[n >> 2] |= 0x80 << (24 - (n % 4) * 8);
    w[words * 16 - 1] = (n * 8) >>> 0;
    var H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
    function rol(v, s) { return (v << s) | (v >>> (32 - s)); }
    for (i = 0; i < w.length; i += 16) {
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f, k, t;
      for (j = 0; j < 80; j++) {
        x[j] = j < 16 ? w[i + j] : rol(x[j - 3] ^ x[j - 8] ^ x[j - 14] ^ x[j - 16], 1);
        if (j < 20) { f = (b & c) | (~b & d); k = 0x5a827999; } else if (j < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
        else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; } else { f = b ^ c ^ d; k = 0xca62c1d6; }
        t = (rol(a, 5) + f + e + k + x[j]) | 0; e = d; d = c; c = rol(b, 30); b = a; a = t;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0;
    }
    return H.map(function (h) { return ('0000000' + (h >>> 0).toString(16)).slice(-8); }).join('');
  }
  function sha1Hex(str) {
    var bytes = new TextEncoder().encode(str);
    if (!(window.crypto && crypto.subtle && crypto.subtle.digest)) return Promise.resolve(sha1js(bytes));
    return crypto.subtle.digest('SHA-1', bytes).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }
  function keyMode(route, input) {
    var k = keyNorm(input), keys = route.keys || {};
    if (!k) return Promise.resolve('');
    return sha1Hex('m13|' + route.id + '|' + k).then(function (h) { return keys.journey && keys.journey === h ? 'journey' : keys.immersion && keys.immersion === h ? 'immersion' : ''; });
  }

  /* ---------- Калейдоскоп: живой узор (assets/kaleido.js, window.M13K) ----------
     12 лучей (6 пар зеркал). Общий узор маршрута — из h32('m13kal|' + id), самоцветы свои у узора.
     Личный — из h32('m13kal|' + код): стёклышки — три состояния входа (цвета — route.states, панель).
     Стиль — route.kaleido.style: 'rose' витраж-роза, 'gems' самоцветы, 'mix' роза с самоцветами, 'mandala' мандала.
     Вид мандалы (её просьба 03.10 — тонкие линии, как Солнце финала): route.kaleido.mandala '' — тонкие золотые линии на прозрачном фоне |
     'enamel' — эмаль на светлом круге (прежний вид); line — толщина линий, % (40…220, по умолчанию 100); back — лёгкое напыление (по умолчанию нет). */
  function hexRgb(h) {
    h = String(h || '').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&');
    var n = parseInt(h, 16); return isNaN(n) || h.length !== 6 ? [255, 207, 90] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function kalStyle(route) { var s = (route.kaleido || {}).style; return s === 'rose' || s === 'gems' || s === 'mix' || s === 'mandala' ? s : 'mix'; }
  function kalLook(route) {
    var k = (route && route.kaleido) || {};
    return { mandala: k.mandala === 'enamel' ? 'enamel' : '', thick: numIn(k.line, 100, 40, 220) / 100, back: k.back === true };
  }
  function kalSeed(c) { return h32('m13kal|' + (c && c.code ? c.code : String(c || ''))); }
  function routeSeed(route) { return h32('m13kal|' + route.id); }
  /* ---------- Стёклышки узора ----------
     Узор человека = три состояния входа (из кода) + стёклышко каждого наступившего дня 1…12 (у всех, пропуск не важен)
     + подарки Проводника (слово-подарок; хранится только на этом устройстве). Вид камней — route.glass (панель, вкладка «Стёклышки»):
     glass.states, glass.days, glass.gifts.{axis, spoke, rim, underside} = { kind, cut, color, shine, clear, size, img } (см. kaleido.js, «Камни»).
     Отметка на диске (с 03.10) — камушек формы зоны: glass.marks.{axis, spoke, rim, underside} (центр — ось, плоскость — спица, край — обод, за диском — изнанка).
     Вид в код не зашит — менять можно в любой момент, коды и подарки не ломаются. */
  var GIFT_ZONES = ['axis', 'spoke', 'rim', 'underside'];
  var GLASS_DEF = { states: { kind: 'cabochon' }, days: { kind: 'gem', cut: 'rect' },
    gifts: { axis: { kind: 'gem', cut: 'round' }, spoke: { kind: 'crystal' }, rim: { kind: 'gem', cut: 'tri' }, underside: { kind: 'gem', cut: 'hex' } },
    marks: { axis: { kind: 'cabochon' }, spoke: { kind: 'gem', cut: 'marquise' }, rim: { kind: 'gem', cut: 'drop' }, underside: { kind: 'pearl' } } };
  // Картинки камней: на странице — от корня сайта (S.base), в панели — '../'
  function glassBase() { return S.route ? S.base : '../'; }
  function glassLook(route, group, zone) {
    var g = route.glass || {}, z = group === 'gifts' || group === 'marks', L = z ? ((g[group] || {})[zone] || GLASS_DEF[group][zone]) : g[group] || GLASS_DEF[group], o = {}, k;
    for (k in L) o[k] = L[k];
    if (!o.kind) o.kind = (z ? GLASS_DEF[group][zone] : GLASS_DEF[group]).kind;
    if (o.img) o.img = imgSrc(glassBase(), o.img);
    return o;
  }
  function mixW(c, k) { return [Math.round(c[0] + (255 - c[0]) * k), Math.round(c[1] + (255 - c[1]) * k), Math.round(c[2] + (255 - c[2]) * k)]; }
  // Цвет стёклышка дня: свой цвет в «Стёклышках» → цвет камня дня (13 дней) → цвет печати дня
  function dayGlassColor(route, d) {
    var L = (route.glass || {}).days || {}, day = (route.days || [])[d - 1];
    return hexRgb(hexOk(L.color) ? L.color : day && hexOk(day.glowColor) ? day.glowColor : sealColor(day) || dayColor(route, d));
  }
  // Подарок: свой цвет зоны → оттенок дня (ось — светлый, почти прозрачный; спица — светлее; обод — как день; изнанка — дымчатый)
  function giftColor(route, d, z, group) {
    var L = ((route.glass || {})[group || 'gifts'] || {})[z] || {}, c = dayGlassColor(route, d);
    if (hexOk(L.color)) return hexRgb(L.color);
    return z === 'underside' ? [128, 118, 146] : z === 'axis' ? mixW(c, .62) : z === 'spoke' ? mixW(c, .3) : c;
  }
  function dayGlass(route, d) { return { c: dayGlassColor(route, d), look: glassLook(route, 'days') }; }
  function giftGlass(route, d, z) { return { c: giftColor(route, d, z), look: glassLook(route, 'gifts', z) }; }
  // Камушек отметки на диске: форма — по зоне (зона диска → зона колеса), цвет — оттенок дня, как у подарка
  function markGlass(route, d, zone) { var f = DISK_FAMILY[zone] || 'axis'; return { c: giftColor(route, d, f, 'marks'), look: glassLook(route, 'marks', f) }; }
  // Сколько дней уже дали стёклышко: наступившие дни 1…12 (день 13 — само Солнце)
  function glassDaysOf(route, n) { return Math.max(0, Math.min(daysCount(route) - 1, n)); }
  // Стёклышки узора. o.days — сколько дней (по умолчанию 0: только состояния), o.gifts — [[день, зона], …],
  // o.exit — номера состояний выхода (день 13, «С чем вы выходите?»; хранятся только на устройстве), o.marks — отметки на диске [[день, зона], …]
  function stateGlass(route, i) { var L = statesOf(route); return L[i] ? { c: hexRgb(L[i].color), look: glassLook(route, 'states') } : null; }
  function kalEx(route, c, o) {
    o = o || {};
    var glass = [], n = o.days || 0, gifts = o.gifts || [], marks = o.marks || [], d;
    function st(i) { var g = stateGlass(route, i); if (g) glass.push(g); }
    if (c && c.states) c.states.forEach(st);
    function giftsOf(d) {
      marks.forEach(function (m) { if (m[0] === d && DISK_FAMILY[m[1]]) glass.push(markGlass(route, d, m[1])); });
      gifts.forEach(function (g) { if (g[0] === d && GIFT_ZONES[g[1]]) glass.push(giftGlass(route, d, GIFT_ZONES[g[1]])); });
    }
    for (d = 1; d <= n; d++) { glass.push(dayGlass(route, d)); giftsOf(d); }
    for (d = n + 1; d < daysCount(route); d++) giftsOf(d);
    (o.exit || []).forEach(st);
    return glass.length ? { sym: 6, glass: glass } : { sym: 6 };
  }
  // Картинки камней («своя картинка») — загрузить заранее (для «Сохранить узор»)
  function glassImgs(route) {
    var g = route.glass || {}, l = [g.states, g.days].concat(GIFT_ZONES.map(function (z) { return (g.gifts || {})[z]; }), GIFT_ZONES.map(function (z) { return (g.marks || {})[z]; }));
    return l.filter(function (L) { return L && L.kind === 'image' && L.img; }).map(function (L) { return imgSrc(glassBase(), L.img); });
  }

  /* ---------- Слово-подарок ----------
     Проводник выдаёт в панели («Код участника»): код человека + день + зона → слово вида ДАР-К7М2. Подходит только к этому коду
     (и этому маршруту с этим первым днём). 4 знака = 20 бит: день и зона (6 бит: (день − 1) × 4 + зона) · проверка (14 бит);
     всё перемешано маской от кода, поэтому у разных людей слова разные. Одно и то же (код, день, зона) — всегда одно и то же слово. */
  function giftMask(route, c) { return h32('m13giftmask|' + route.id + '|' + (route.start || '') + '|' + c.code) & 0xfffff; }
  function giftCheck(route, c, p) { return h32('m13gift|' + route.id + '|' + (route.start || '') + '|' + c.code + '|' + p) & 0x3fff; }
  function makeGift(route, c, day, zone) {
    var p = (day - 1) * 4 + zone, v = ((p * 16384) + giftCheck(route, c, p)) ^ giftMask(route, c), s = '', i;
    for (i = 3; i >= 0; i--) s += CODE_ABC.charAt(Math.floor(v / Math.pow(32, i)) % 32);
    return 'ДАР-' + s;
  }
  // Что набрал человек → { day, zone } или null. Регистр, дефис, «ДАР», латинские двойники — не важны.
  function readGift(route, c, input) {
    if (!c) return null;
    var s = String(input || '').toUpperCase().replace(/Ё/g, 'Е').replace(/Й/g, 'И').replace(/[ABCEHKMOPTXY]/g, function (x) { return LAT[x]; }).replace(/[^А-Я0-9]/g, '');
    if (s.length === 7 && s.indexOf('ДАР') === 0) s = s.slice(3);
    if (s.length !== 4) return null;
    s = s.replace(/З/g, '3');
    var v = 0, i, k;
    for (i = 0; i < 4; i++) { k = CODE_ABC.indexOf(s.charAt(i)); if (k < 0) return null; v = v * 32 + k; }
    v = (v ^ giftMask(route, c)) >>> 0;
    var p = Math.floor(v / 16384), day = Math.floor(p / 4) + 1;
    if (p > 47 || day > daysCount(route) - 1 || (v & 0x3fff) !== giftCheck(route, c, p)) return null;
    return { day: day, zone: p % 4 };
  }
  function Kaleido(cv, px, route) { return window.M13K ? window.M13K.Kaleido(cv, px || 0, { style: kalStyle(route || S.route || {}), look: kalLook(route || S.route), ex: { sym: 6 } }) : null; }
  // Узор человека сразу (панель «Код участника», «Мой код»)
  // o — какие стёклышки, кроме состояний (см. kalEx)
  function kalShow(cv, px, route, c, o) { var k = Kaleido(cv, px, route); if (k) k.show(kalSeed(c), kalEx(route, c, o)); return k; }
  // Картинка «узор и код» для сохранения: 1080 × 1350 (как пост), узор, код, маршрут.
  function patternImage(route, c, cb, ex) {
    var W = 1080, H = 1350, cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    cv.width = W; cv.height = H;
    function paint() {
      var g = ctx.createRadialGradient(W / 2, 560, 60, W / 2, 560, 900);
      g.addColorStop(0, '#3b250a'); g.addColorStop(1, '#0a0604');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (window.M13K) window.M13K.still(ctx, kalSeed(c), W / 2, 560, 420, kalStyle(route), ex || (S.route === route ? myEx(c) : kalEx(route, c)), kalLook(route));
      ctx.textAlign = 'center'; ctx.fillStyle = '#e9c77e';
      ctx.font = '500 30px "Cormorant Garamond", Georgia, serif';
      ctx.fillText(('13 MIRRORS · ' + (route.title || '')).toUpperCase().split('').join(String.fromCharCode(8202)), W / 2, 86);
      ctx.fillText((MODE_NAMES[c.mode] || '').toUpperCase().split('').join(String.fromCharCode(8202)), W / 2, 1080);
      // Код длинный (РАССВЕТ-…-…) — шрифт мельче, чтобы влез в ширину картинки
      var fs = 104; ctx.font = '600 104px "Cormorant Garamond", Georgia, serif';
      while (fs > 60 && ctx.measureText(c.code).width > W - 110) { fs -= 4; ctx.font = '600 ' + fs + 'px "Cormorant Garamond", Georgia, serif'; }
      ctx.fillStyle = '#fff3d6';
      ctx.fillText(c.code, W / 2, 1200);
      cb(cv);
    }
    function fonts() { if (document.fonts && document.fonts.load) document.fonts.load('600 104px "Cormorant Garamond"').then(paint, paint); else paint(); }
    if (window.M13K && window.M13K.preload) window.M13K.preload(glassImgs(route), fonts); else fonts();
  }

  /* ---------- Страница маршрута ---------- */
  // Файл пустой или обрезан (сайт как раз обновлялся, или браузер запомнил такую копию) — ещё раз мимо памяти браузера.
  function getJSON(url, n) {
    n = n || 0;
    return fetch(url, { cache: n ? 'reload' : 'no-cache' }).then(function (r) {
      if (r.status === 404) { var e = new Error(url); e.final = true; throw e; }
      if (!r.ok) throw new Error(url);
      return r.json();
    }).catch(function (e) {
      if (e.final || n >= 3) throw e;
      return new Promise(function (ok) { setTimeout(ok, [0, 1500, 4000][n]); }).then(function () { return getJSON(url, n + 1); });
    });
  }
  function q(name) { var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(location.search); return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null; }
  // sim — день на спирали из режима проверки (0 — до начала, 14 — после конца), zonesOn — показать разметку кирпичей
  // code — личный код человека ({code, mode, seed}) или null
  var S = { route: null, base: '', mode: 'observation', debug: false, debugNow: null, preview: false, sim: null, zonesOn: false, dbgMin: window.innerWidth <= 600, B: null, busy: false, code: null, plants: null,
    tz: null, DS: null, space: null, spaceN: null };

  function curDay() { return S.sim != null ? S.sim : dayNumber(S.route, nowRoute()); }
  /* ---------- Двери: часы маршрута и посещения (сцена «Двери», 06.10; assets/doors.js) ----------
     Смена дня (route.dayClock): 'msk' — в 00:00 по Москве, 'local' — в 00:00 по часовому поясу участника; пусто — спираль по Москве, двери по участнику.
     Пояс участника запоминается на этом устройстве при первом входе на страницу маршрута и дальше не меняется
     (поменял пояс в поездке — дни маршрута не перескакивают). Никуда не отправляется. */
  function isDoors(r) { return ((r || S.route || {}).scene) === 'doors'; }
  function dayClock(r) { var c = (r || {}).dayClock; return c === 'msk' || c === 'local' ? c : isDoors(r) ? 'local' : 'msk'; }
  function tzKey() { return 'm13ys-tz-' + S.route.id + '-' + (S.route.start || ''); }
  function tzHere() { var z = ''; try { z = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {} return { tz: z, off: new Date().getTimezoneOffset() }; }
  function routeTz() {
    if (S.tz) return S.tz;
    var z = null;
    try { z = JSON.parse(localStorage.getItem(tzKey()) || 'null'); } catch (e) {}
    if (!z || typeof z !== 'object' || (z.off !== +z.off && !z.tz)) {
      z = tzHere();
      // Предпросмотр из панели пояс не запоминает
      if (!S.preview) try { localStorage.setItem(tzKey(), JSON.stringify(z)); } catch (e) {}
    }
    return (S.tz = z);
  }
  function resetTz() { S.tz = null; try { localStorage.removeItem(tzKey()); } catch (e) {} }
  // Сейчас по часам пояса как «настенные часы» (как nowMsk): Date, у которого getUTC* — время в этом поясе
  function nowIn(z, debugNow) {
    if (debugNow) return nowMsk(debugNow);
    if (z && z.tz) try {
      var P = {}, t = new Date();
      new Intl.DateTimeFormat('en-US', { timeZone: z.tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
        .formatToParts(t).forEach(function (x) { P[x.type] = +x.value; });
      if (P.year && P.month && P.day) return new Date(Date.UTC(P.year, P.month - 1, P.day, (P.hour || 0) % 24, P.minute || 0));
    } catch (e) {}
    return new Date(Date.now() - ((z && z.off === +z.off) ? z.off : new Date().getTimezoneOffset()) * 60e3);
  }
  function nowRoute() { return dayClock(S.route) === 'local' ? nowIn(routeTz(), S.debugNow) : nowMsk(S.debugNow); }
  // Двери: { "1": "v" — входили в свой день, "2": "m" — день прошёл без входа }. Только на этом устройстве, общее для всех форматов.
  function doorKey() { return storeKey() + '-doors'; }
  function doorLog() { try { var o = JSON.parse(localStorage.getItem(doorKey()) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
  function doorSave(o) { try { localStorage.setItem(doorKey(), JSON.stringify(o)); } catch (e) {} }
  function doorVisit(n) { var o = doorLog(); if (o[n] !== 'v') { o[n] = 'v'; doorSave(o); } }
  // Прошедшие дни без входа записываются как пропущенные (их дверь остаётся закрытой навсегда)
  function doorSync(today) {
    var o = doorLog(), ch = false, last = Math.min(today - 1, daysCount(S.route)), i;
    for (i = 1; i <= last; i++) if (!o[i]) { o[i] = 'm'; ch = true; }
    if (ch && S.sim == null && !S.preview) doorSave(o);
  }
  function doorState(n, today) {
    var v = doorLog()[n] === 'v';
    if (today < 1 || n > today) return 'future';
    if (n === today) return v ? 'today_visited' : 'today_unvisited';
    return v ? 'past_visited' : 'past_unvisited';
  }
  function resetDoors() { try { localStorage.removeItem(doorKey()); localStorage.removeItem(choiceKey()); } catch (e) {} }
  /* Двери v2 — участник выбирает дверь (doors.doorAssignmentMode = 'userChoice'; docs/doors.md, «Решения 06.10»).
     День → дверь запоминается на этом устройстве в момент открытия: { "1": id двери, "3": id … }. Заменить нельзя, дверь второй раз не участвует.
     Пропущенный день — записи нет (следа нет, задним числом не выбрать). Никуда не отправляется. */
  function isChoice(r) { return isDoors(r) && ((r || S.route).doors || {}).doorAssignmentMode === 'userChoice'; }
  // Что открывается первым после двери: Карта дня (глубже — по ключу) или сразу пространство
  function doorsCard(r) { return isDoors(r) && !!window.M13D && window.M13D.first(r) === 'card'; }
  function choiceKey() { return storeKey() + '-choice'; }
  function choiceLog() { try { var o = JSON.parse(localStorage.getItem(choiceKey()) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
  function choose(day, id) { var o = choiceLog(); if (o[day]) return false; o[day] = id; try { localStorage.setItem(choiceKey(), JSON.stringify(o)); } catch (e) {} return true; }
  function doorIdOf(n) { return ((doorsCfg().items || [])[n - 1] || {}).id || ''; }
  // В какой день выбрана дверь n (0 — свободная)
  function dayOfDoor(n, log) { var id = doorIdOf(n), k; log = log || choiceLog(); if (!id) return 0; for (k in log) if (log[k] === id) return +k; return 0; }
  function doorOfDay(day, log) { var id = (log || choiceLog())[day], it = doorsCfg().items || [], i; if (!id) return 0; for (i = 0; i < it.length; i++) if (it[i] && it[i].id === id) return i + 1; return 0; }
  function ucState(n, today, log) { var d = dayOfDoor(n, log); return !d ? 'free' : d === today ? 'today' : 'past'; }
  // Какие дни на этом устройстве уже открывали (сегодняшний кирпич после нажатия светится ровно). Только для света, не для доступа.
  function storeKey() { return 'm13ys-' + S.route.id + '-' + (S.route.start || ''); }
  function openedList() { try { var l = JSON.parse(localStorage.getItem(storeKey()) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function markOpened(n) {
    var l = openedList(); if (l.indexOf(n) >= 0) return;
    l.push(n); try { localStorage.setItem(storeKey(), JSON.stringify(l)); } catch (e) {}
  }
  function resetOpened() { try { localStorage.removeItem(storeKey()); } catch (e) {} }
  // Личный код помнит это устройство; на другом человек вводит свой код (не ключ).
  function codeKey() { return 'm13ys-code-' + S.route.id + '-' + (S.route.start || ''); }
  function loadCode() { try { return readCode(S.route, localStorage.getItem(codeKey()) || ''); } catch (e) { return null; } }
  function saveCode(c) { S.code = c; try { if (c) localStorage.setItem(codeKey(), c.code); else localStorage.removeItem(codeKey()); } catch (e) {} }
  // В какие дни карта уже перевёрнута (выбор окончателен: до 00:00 по кирпичу открывается та же личная карта)
  function pickKey() { return storeKey() + '-pick-' + (S.code ? S.code.code : ''); }
  function pickedList() { try { var l = JSON.parse(localStorage.getItem(pickKey()) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function markPicked(n) { var l = pickedList(); if (l.indexOf(n) < 0) { l.push(n); try { localStorage.setItem(pickKey(), JSON.stringify(l)); } catch (e) {} } }
  function resetPicks() { try { localStorage.removeItem(pickKey()); } catch (e) {} }
  // Подарки ([[день, зона], …]) и дни, чьё стёклышко уже показали («легло в узор»), — у каждого кода свои, только на этом устройстве
  function listOf(key) { try { var l = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function giftKey(c) { return storeKey() + '-gift-' + (c ? c.code : ''); }
  function giftList(c) { return listOf(giftKey(c)).filter(function (g) { return Array.isArray(g) && g.length === 2; }); }
  function addGift(c, g) {
    var l = giftList(c);
    if (l.some(function (x) { return x[0] === g.day && x[1] === g.zone; })) return false;
    l.push([g.day, g.zone]);
    try { localStorage.setItem(giftKey(c), JSON.stringify(l)); } catch (e) {}
    return true;
  }
  function resetGlass() { try { localStorage.removeItem(seenKey()); localStorage.removeItem(giftKey(S.code)); localStorage.removeItem(exitKey(S.code)); localStorage.removeItem(finKey()); localStorage.removeItem(markKey(S.code)); } catch (e) {} }
  // Отметки на диске личной карты: [[день, зона], …] — у каждого кода свои, только на этом устройстве (в код не входят)
  function markKey(c) { return storeKey() + '-mark-' + (c ? c.code : ''); }
  function markList(c) { return c ? listOf(markKey(c)).filter(function (m) { return Array.isArray(m) && m.length === 2 && DISK_FAMILY[m[1]]; }) : []; }
  function markOf(c, n) { var m = markList(c).filter(function (x) { return x[0] === n; })[0]; return m ? m[1] : null; }
  function saveMark(c, n, z) {
    if (!c || markOf(c, n)) return;
    var l = markList(c); l.push([n, z]);
    try { localStorage.setItem(markKey(c), JSON.stringify(l)); } catch (e) {}
  }
  // День 13: состояния выхода (номера, до трёх) и «финал уже собран» — у каждого кода свои (у Наблюдения — общий), только на этом устройстве
  function exitKey(c) { return storeKey() + '-exit-' + (c ? c.code : ''); }
  function exitList(c) { return c ? listOf(exitKey(c)).filter(function (i) { return i === +i && i >= 0 && i < 12; }).slice(0, 3) : []; }
  function saveExit(c, l) { if (c) try { localStorage.setItem(exitKey(c), JSON.stringify(l || [])); } catch (e) {} }
  function finKey() { return storeKey() + '-final-' + (S.code && S.mode !== 'observation' ? S.code.code : 'obs'); }
  function finDone() { try { return localStorage.getItem(finKey()) === '1'; } catch (e) { return false; } }
  function markFin() { try { localStorage.setItem(finKey(), '1'); } catch (e) {} }
  function seenKey() { return storeKey() + '-glass-' + (S.code ? S.code.code : ''); }
  function markSeen(n) { var l = listOf(seenKey()); if (l.indexOf(n) < 0) { l.push(n); try { localStorage.setItem(seenKey(), JSON.stringify(l)); } catch (e) {} } }
  // Узор человека сейчас: состояния + стёклышки наступивших дней + подарки на этом устройстве. upto — узор «до дня» (без его стёклышка)
  function myEx(c, upto) { return kalEx(S.route, c, { days: upto != null ? upto : glassDaysOf(S.route, curDay()), gifts: giftList(c), marks: markList(c) }); }
  function setUrlMode(m) {
    try {
      var s = location.search.replace(/([?&])mode=[^&#]*&?/, '$1').replace(/[?&]$/, '');
      history.replaceState(null, '', location.pathname + s + (s ? '&' : '?') + 'mode=' + m + location.hash);
    } catch (e) {}
  }

  /* Картинка спирали на экране. Центр спирали (центр разметки кирпичей) — ровно посередине экрана по ширине,
     чтобы надписи, печать, луч и Солнце стояли на одной линии. route.stage (панель → «Основное» → «Спираль»):
     zoom — на компьютере картинка меньше экрана, % (по умолчанию 100 — во весь экран, её решение 02.10; меньше — вокруг темно, края растворяются),
     shiftX / shiftXMobile — подвинуть ещё, % ширины картинки (+ вправо). */
  function stageCfg(route) { return route.stage || {}; }
  function stageFit(stage, img, zone) {
    var W = window.innerWidth, H = window.innerHeight, iw = img.naturalWidth || 16, ih = img.naturalHeight || 9;
    var tall = H / W > 1.25, sc = stageCfg(S.route || {}), s, x, y, soft = false;
    var cx = (zone && zone.center ? zone.center.x : .5) * iw;
    function num(v, def, lo, hi) { v = v == null || v === '' || isNaN(+v) ? def : +v; return Math.max(lo, Math.min(hi, v)); }
    if (tall && W / H < iw / ih) {
      // Телефон: спираль во всю ширину и прижата к низу; чтобы центр встал посередине — чуть крупнее (не больше чем на 8 %)
      s = W / iw;
      s = Math.max(s, Math.min(s * 1.08, W / (2 * Math.max(1, cx)), W / (2 * Math.max(1, iw - cx))));
      x = W / 2 - cx * s + num(sc.shiftXMobile, 0, -15, 15) / 100 * iw * s;
      x = Math.min(0, Math.max(W - iw * s, x));
      y = H - ih * s;
    } else {
      var z = tall ? 100 : num(sc.zoom, 100, 50, 100);
      s = Math.max(W / iw, H / ih) * z / 100;
      x = W / 2 - cx * s + num(sc.shiftX, 0, -15, 15) / 100 * iw * s;
      // Во весь экран — без тёмных полос по краям; меньше экрана — вокруг темнота, края картинки растворяются
      if (z >= 100) x = Math.min(0, Math.max(W - iw * s, x)); else soft = true;
      y = H > ih * s ? (H - ih * s) * .7 : (H - ih * s) / 2;
    }
    stage.style.width = iw * s + 'px'; stage.style.height = ih * s + 'px';
    stage.style.left = x + 'px'; stage.style.top = y + 'px';
    stage.classList.toggle('is-gap', y > 1 && !soft);
    stage.classList.toggle('is-soft', soft);
  }
  // Центр спирали на экране — относительно середины окна (из него появляется Карта дня).
  function centerOffset() {
    var B = S.B, st = B && B.node.parentNode;
    if (!st) return null;
    var rc = st.getBoundingClientRect();
    return { x: rc.left + B.center.cx / B.iw * rc.width - window.innerWidth / 2, y: rc.top + B.center.cy / B.ih * rc.height - window.innerHeight / 2 };
  }
  // sticky — не закрывается щелчком мимо (вход по ключу); onclose — что остановить при закрытии (калейдоскоп)
  function layer(node, cls, from, sticky) {
    var ov = el('div', 'ys-layer' + (cls ? ' ' + cls : ''));
    if (from) { ov.style.setProperty('--ys-ox', Math.round(from.x) + 'px'); ov.style.setProperty('--ys-oy', Math.round(from.y) + 'px'); }
    ov.appendChild(node);
    ov.addEventListener('click', function (e) { if (e.target === ov && !sticky) closeLayer(ov); });
    document.body.appendChild(ov);
    document.body.classList.add('ys-locked');
    slideCalm(750);
    requestAnimationFrame(function () { requestAnimationFrame(function () { ov.classList.add('is-in'); }); });
    return ov;
  }
  // Пока карта выезжает — всё остальное замирает (растения, дыхание камня, точки кнопки), чтобы не было рывков
  function slideCalm(ms) {
    document.body.classList.add('ys-sliding');
    if (S.plants && S.plants.hold) S.plants.hold(ms);
    clearTimeout(S.calmT);
    S.calmT = setTimeout(function () { document.body.classList.remove('ys-sliding'); }, ms);
  }
  function closeLayer(ov) {
    ov = ov || document.querySelector('.ys-layer:not(.is-out)');
    if (!ov) return;
    if (ov.onclose) { ov.onclose(); ov.onclose = null; }
    ov.classList.remove('is-in'); ov.classList.add('is-out');
    setTimeout(function () { ov.remove(); if (!document.querySelector('.ys-layer')) document.body.classList.remove('ys-locked'); }, 380);
  }
  function note(text) {
    [].forEach.call(document.querySelectorAll('.ys-toast'), function (t) { t.remove(); });
    var t = el('div', 'ys-toast', text);
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-in'); });
    setTimeout(function () { t.classList.remove('is-in'); setTimeout(function () { t.remove(); }, 400); }, 3200);
  }
  function openDay(n, mode, from) {
    var r = S.route;
    closeLayer();
    var c = card(r, n, mode, 'day', null, { base: S.base, exit: exitList(S.code), onGather: function (exit) {
      // «Собрать маршрут»: состояния выхода — на устройство, дальше финал на спирали
      if (mode !== 'observation' && S.code) saveExit(S.code, exit);
      if (isDoors(r)) { openDoorsFinal(); return; }
      var m = musicStart();
      closeLayer(); setTimeout(function () { finalScene({ music: m }); }, 300);
    }, onKey: doorsCard(r) && !S.code ? function () { openKey(S.mode); } : null, keyText: fill((r.texts || {}).doorKey || 'Есть ключ? Введи ключ', ctxOf(r, n)),
      spiralLabel: doorsCard(r) ? 'Дальше' : null, onSpiral: function () {
      // Двери, сначала Карта дня: глубже — в пространстве дня за картой
      if (doorsCard(r)) { closeLayer(); return; }
      if (mode === 'observation') { closeLayer(); return; }
      if (!S.code) { openKey(mode); return; }
      // Карта сегодня уже перевёрнута — сразу та же личная карта, нового выбора нет
      if (pickedList().indexOf(n) >= 0) openPersonal(n, mode, cardFor(r, S.code, n));
      else openFan(n, mode);
    } });
    layer(c, 'ys-layer--day', from || centerOffset());
  }
  function openPersonal(n, mode, perm) {
    closeLayer();
    var mk = S.code && mode !== 'observation';
    layer(card(S.route, n, mode, 'personal', perm, { base: S.base, mark: mk ? markOf(S.code, n) : null, onMark: mk ? function (z) { saveMark(S.code, n, z); } : null, onSpiral: function () {
      // Первый раз за этот день — стёклышко дня ложится в узор
      if (S.code && mode !== 'observation' && n < daysCount(S.route) && n <= glassDaysOf(S.route, curDay()) && listOf(seenKey()).indexOf(n) < 0) openGlass(n);
      else closeLayer();
    } }), 'ys-layer--personal');
  }

  /* ---------- Вход по ключу: калейдоскоп → узор и код ----------
     want — формат из адреса (до ввода ключа); show — показать уже полученный код («Мой код»). */
  function copyText(t, ok) {
    function old() {
      var a = el('textarea'); a.value = t; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(a); a.select();
      try { document.execCommand('copy'); ok(); } catch (e) {}
      a.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, old); else old();
  }
  function savePattern(c) { patternImage(S.route, c, function (cv) { saveCanvas(cv, finFileName(c)); }); }
  // Состояния кода словами: «ясность · тревога · интерес»
  function statesText(route, c) { var L = statesOf(route); return ((c && c.states) || []).map(function (i) { return L[i] ? L[i].name : ''; }).filter(Boolean).join(' · '); }
  // Перемешать (при каждом показе — свой порядок, чтобы никакие группы не считывались)
  function shuffled(n) { var a = [], i, j, t; for (i = 0; i < n; i++) a.push(i); for (i = n - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // Выбор трёх состояний: равноправные стёклышки без подписей групп и без толкований. done(список номеров по порядку панели)
  function statesPicker(route, need, done) {
    var tx = route.texts || {}, L = statesOf(route), chosen = [], box = el('div', 'ys-states');
    box.appendChild(el('p', 'ys-key-lead', tx.statesLead || 'Выберите три стёклышка — три состояния, с которыми вы сейчас входите в маршрут.'));
    var wrap = el('div', 'ys-st-list');
    shuffled(L.length).forEach(function (i) {
      var b = el('button', 'ys-st'), dot = el('i', 'ys-st-g'); b.type = 'button';
      dot.style.setProperty('--c', L[i].color || '#ffcf5a'); b.style.setProperty('--cn', neonHex(L[i].color || '#ffcf5a', neonOf(route, 'glass')));
      b.appendChild(dot); b.appendChild(el('span', null, L[i].name || ''));
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        var k = chosen.indexOf(i);
        if (k >= 0) chosen.splice(k, 1); else if (chosen.length < need) chosen.push(i); else return;
        b.classList.toggle('is-on', k < 0); b.setAttribute('aria-pressed', String(k < 0));
        upd();
      });
      wrap.appendChild(b);
    });
    box.appendChild(wrap);
    var cnt = el('p', 'ys-st-n'), go = el('button', 'ys-key-go', tx.statesGo || tx.keyGo || 'Повернуть калейдоскоп'); go.type = 'button';
    function upd() {
      putText(cnt, fill(tx.statesCount || 'Выбрано {выбрано} из {нужно}', { 'выбрано': String(chosen.length), 'нужно': String(need) }));
      go.disabled = chosen.length !== need; box.classList.toggle('is-full', chosen.length === need);
    }
    go.addEventListener('click', function () { if (chosen.length === need) { go.disabled = true; done(chosen.slice()); } });
    box.appendChild(cnt); box.appendChild(go);
    if (tx.statesNote !== '') box.appendChild(el('p', 'ys-key-note', tx.statesNote || 'Стёклышки войдут в ваш узор. Они хранятся только в вашем коде — больше нигде.'));
    upd();
    return box;
  }
  // Стёклышко крупно над калейдоскопом → уменьшается в центр → калейдоскоп поворачивается и пересобирает узор уже с ним
  function kalWrap(cv) { var w = el('div', 'ys-kal-wrap'), sc = el('canvas', 'ys-drop'); w.appendChild(cv); w.appendChild(sc); return w; }
  function dropGlass(wrap, g, after) {
    var sc = wrap.querySelector('.ys-drop');
    if (window.M13K && window.M13K.stone) window.M13K.stone(sc, g.c, g.look, Math.round((wrap.clientWidth || 300) * .46));
    if (REDUCED) { after(); return; }
    wrap.classList.remove('is-fall'); wrap.classList.add('is-drop');
    setTimeout(function () { wrap.classList.remove('is-drop'); wrap.classList.add('is-fall'); }, 1500);
    setTimeout(after, 1900);
    setTimeout(function () { wrap.classList.remove('is-fall'); }, 2600);
  }
  // «Стёклышко дня легло в ваш узор» — один раз за день, после личной карты (Путешествие, Погружение)
  function openGlass(n) {
    var r = S.route, tx = r.texts || {}, ctx = ctxOf(r, n), c = S.code, box = el('div', 'ys-key ys-glass'), cv = el('canvas', 'ys-kal'), wrap = kalWrap(cv);
    box.appendChild(el('p', 'ys-key-mode', fill(tx.glassSmall || 'День {день} · {имя кина}', ctx)));
    box.appendChild(el('h2', 'ys-key-t', fill(tx.glassDay || 'Стёклышко дня {день} легло в ваш узор', ctx)));
    box.appendChild(wrap);
    if (tx.glassNote !== '') box.appendChild(el('p', 'ys-key-note', fill(tx.glassNote || defText(r, 'glassNote'), ctx)));
    var go = el('button', 'ys-key-go', tx.glassGo || (isDoors(r) ? 'Дальше' : 'На спираль')); go.type = 'button';
    go.addEventListener('click', function () { closeLayer(); });
    box.appendChild(go);
    markSeen(n);
    closeLayer();
    var ov = layer(box, 'ys-layer--key ys-layer--glass'), kal = Kaleido(cv, 0, r);
    ov.onclose = function () { if (kal) kal.stop(); };
    if (!kal) return;
    requestAnimationFrame(function () {
      kal.show(kalSeed(c), myEx(c, n - 1));
      setTimeout(function () { dropGlass(wrap, dayGlass(r, n), function () { kal.turn(kalSeed(c), null, myEx(c, Math.max(n, glassDaysOf(r, curDay())))); }); }, 350);
    });
  }
  // gift — слово-подарок, которое сразу вписать («Мой код» по ссылке ?gift= или из режима проверки)
  // want = 'observation' — «Мой код» из Наблюдения: без строки формата, выход — «Остаться в Наблюдении», закрывается и щелчком мимо
  function openKey(want, show, gift) {
    var r = S.route, tx = r.texts || {}, box = el('div', 'ys-key'), kal = null;
    var have = !!(show && S.code), fromObs = !have && want === 'observation';
    var mname = el('p', 'ys-key-mode', fromObs ? '' : MODE_NAMES[have ? S.code.mode : want] || '');
    var title = el('h2', 'ys-key-t', have ? tx.myCode || 'Мой узор и код' : tx.keyTitle || 'Ключ к маршруту');
    var cv = el('canvas', 'ys-kal'), wrap = kalWrap(cv);
    box.appendChild(mname); box.appendChild(title); box.appendChild(wrap);
    var form = el('form', 'ys-key-form'), res = el('div', 'ys-key-res'), stBox = el('div', 'ys-key-st');
    form.appendChild(el('p', 'ys-key-lead', tx.keyLead || 'Введите ключ, который Проводник дал в группе. Потом выберите три состояния — калейдоскоп повернётся и сложит ваш личный узор и код.'));
    var inp = el('input', 'ys-key-in');
    inp.type = 'text'; inp.autocomplete = 'off'; inp.setAttribute('autocapitalize', 'off'); inp.setAttribute('autocorrect', 'off'); inp.spellcheck = false;
    inp.placeholder = tx.keyPh || 'Ключ или ваш код';
    var go = el('button', 'ys-key-go', tx.keyNext || 'Дальше'); go.type = 'submit';
    var err = el('p', 'ys-key-err');
    form.appendChild(inp); form.appendChild(go); form.appendChild(err);
    form.appendChild(el('p', 'ys-key-note', tx.keyNote || 'Код уже есть? Введите его — на новом телефоне или компьютере нужен код, а не ключ.'));
    var obs = el('button', 'ys-key-alt', fromObs ? tx.keyStay || 'Остаться в Наблюдении' : tx.keyObserve || 'Пока просто смотреть — Наблюдение'); obs.type = 'button';
    obs.addEventListener('click', function () { if (fromObs) { closeLayer(); return; } S.mode = 'observation'; setUrlMode('observation'); closeLayer(); render(); });
    form.appendChild(obs);
    function result(c) {
      res.replaceChildren();
      res.appendChild(el('p', 'ys-code-l', tx.codeLabel || 'Ваш код'));
      res.appendChild(el('p', 'ys-code' + (c.code.length > 12 ? ' is-long' : ''), c.code));
      var sw = statesText(r, c);
      if (sw && tx.codeStates !== '') res.appendChild(el('p', 'ys-code-st', fill(tx.codeStates || 'Вы вошли с: {состояния}', { 'состояния': sw })));
      res.appendChild(el('p', 'ys-code-n', tx.codeNote || 'Сохраните узор и код и пришлите код Проводнику в личные. На другом устройстве входите по этому коду.'));
      var row = el('div', 'ys-code-btns');
      function b(t, f) { var x = el('button', 'ys-code-b', t); x.type = 'button'; x.addEventListener('click', f); row.appendChild(x); return x; }
      b(tx.save || 'Сохранить узор', function () { savePattern(c); });
      b(tx.copy || 'Скопировать код', function () { copyText(c.code, function () { note(tx.copied || 'Код скопирован'); }); });
      var url = r.guide || (r.trace || {}).immersion;
      if (url) b(tx.send || 'Отправить код Проводнику', function () {
        copyText(c.code, function () { note(tx.sendNote || 'Код скопирован — вставьте его в сообщение Проводнику'); });
        window.open(url, '_blank', 'noopener');
      });
      res.appendChild(row);
      if (have) res.appendChild(giftForm(c));
      var enter = el('button', 'ys-key-go', have ? tx.toSpiral || (isDoors(r) ? 'Дальше' : 'На спираль') : tx.enter || (isDoors(r) ? 'Войти' : 'Войти на спираль')); enter.type = 'button';
      enter.addEventListener('click', function () {
        if (!have) { S.mode = c.mode; setUrlMode(c.mode); }
        closeLayer(); render();
      });
      res.appendChild(enter);
      if (have) {
        var other = el('button', 'ys-key-alt', tx.codeOther || 'Ввести другой код'); other.type = 'button';
        other.addEventListener('click', function () {
          if (!confirm(tx.codeOtherAsk || 'Забыть этот код на этом устройстве? Запишите его, если ещё не сохранили.')) return;
          var m = S.code.mode; saveCode(null); closeLayer(); render(); setTimeout(function () { openKey(m); }, 400);
        });
        res.appendChild(other);
      }
      box.classList.remove('is-states');
      box.classList.add('is-done');
    }
    // «Получили стёклышко?» — слово-подарок от Проводника: подходит только к этому коду, хранится на этом устройстве
    function giftForm(c) {
      var wrapF = el('div', 'ys-gift'), open = el('button', 'ys-key-alt', tx.giftBtn || 'Получили стёклышко? Ввести слово'); open.type = 'button';
      var f = el('form', 'ys-gift-f'), gi = el('input', 'ys-key-in'), gok = el('button', 'ys-code-b', tx.giftGo || 'Положить в узор'), gerr = el('p', 'ys-key-err');
      gi.type = 'text'; gi.autocomplete = 'off'; gi.setAttribute('autocapitalize', 'characters'); gi.setAttribute('autocorrect', 'off'); gi.spellcheck = false;
      gi.placeholder = tx.giftPh || 'Слово-подарок, например ДАР-К7М2'; gok.type = 'submit'; f.hidden = true;
      if (tx.giftLead !== '') f.appendChild(el('p', 'ys-key-note', tx.giftLead || 'Проводник прислал слово-подарок — впишите его, и стёклышко ляжет в ваш узор.'));
      f.appendChild(gi); f.appendChild(gok); f.appendChild(gerr);
      open.addEventListener('click', function () { f.hidden = false; open.hidden = true; gi.focus(); });
      f.addEventListener('submit', function (e) {
        e.preventDefault(); putText(gerr, '');
        var g = readGift(r, c, gi.value);
        if (!g) { putText(gerr, tx.giftBad || 'Это слово не подходит к вашему коду. Проверьте буквы — или спросите Проводника.'); box.classList.remove('is-shake'); void box.offsetWidth; box.classList.add('is-shake'); return; }
        if (!addGift(c, g)) { note(tx.giftHave || 'Это стёклышко уже в вашем узоре.'); return; }
        gi.value = ''; f.hidden = true; open.hidden = false;
        var z = GIFT_ZONES[g.zone], was = title.textContent;
        putText(title, fill(tx.giftOk || 'Подарок: день {день} · {зона}', { 'день': String(g.day), 'зона': zoneName(r, z) }));
        wrap.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
        dropGlass(wrap, giftGlass(r, g.day, z), function () {
          if (kal) kal.turn(kalSeed(c), null, myEx(c));
          setTimeout(function () { putText(title, was); }, 4200);
        });
      });
      wrapF.appendChild(open); wrapF.appendChild(f);
      if (gift) setTimeout(function () { open.click(); gi.value = gift; f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true })); }, 700);
      return wrapF;
    }
    // Узор складывается: калейдоскоп поворачивается к личному узору (стёклышки — состояния входа и наступившие дни)
    function turn(c) {
      saveCode(c); putText(mname, MODE_NAMES[c.mode]); putText(title, tx.codeTitle || 'Ваш личный узор');
      box.classList.add('is-turn'); inp.blur();
      kal.turn(kalSeed(c), function () { box.classList.remove('is-turn'); result(c); }, myEx(c));
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = inp.value; putText(err, '');
      if (!keyNorm(v)) { inp.focus(); return; }
      go.disabled = true;
      var c = readCode(r, v);
      if (c) { turn(c); return; }
      keyMode(r, v).then(function (m) {
        if (!m) {
          go.disabled = false; putText(err, tx.keyBad || 'Ключ не подошёл. Проверьте, как он написан, — или спросите Проводника.');
          box.classList.remove('is-shake'); void box.offsetWidth; box.classList.add('is-shake');
          return;
        }
        inp.blur(); putText(mname, MODE_NAMES[m]);
        // Ключ подошёл → три состояния → код
        if (statesOf(r).length < 3) { turn(newCode(r, m)); return; }
        putText(title, tx.statesTitle || 'С чем вы входите?');
        stBox.replaceChildren(statesPicker(r, 3, function (st) { turn(newCode(r, m, st)); }));
        box.classList.add('is-states');
      });
    });
    box.appendChild(have ? res : form); if (!have) { box.appendChild(stBox); box.appendChild(res); }
    if (have) result(S.code);
    closeLayer();
    var ov = layer(box, 'ys-layer--key', null, !have && !fromObs);
    kal = Kaleido(cv, 0, r);
    // Пока ключа нет — калейдоскоп живёт общим узором маршрута
    requestAnimationFrame(function () { if (!kal) return; if (have) kal.idle(kalSeed(S.code), myEx(S.code)); else kal.idle(routeSeed(r), { sym: 6 }); });
    ov.onclose = function () { if (kal) kal.stop(); };
  }

  /* ---------- Выбор карты колоды ----------
     Закрытые карты лучами по кругу, центр пуст; в колоде 13 карт на 12 дней: в 1-й день 13, каждый день на одну меньше,
     в 12-й — выбор из двух (последняя остаётся закрытой, ничего с ней не делаем).
     Нажал любую → она выходит в центр и переворачивается (выбор окончателен) → «Открыть» → личная карта.
     Какая карта откроется, решает колода из кода, а не то, какую нажали. */
  function backSVG() {
    var rays = '', i, a;
    for (i = 0; i < 16; i++) { a = i / 16 * Math.PI * 2; rays += '<line x1="' + r1(45 + 13 * Math.cos(a)) + '" y1="' + r1(60 + 13 * Math.sin(a)) + '" x2="' + r1(45 + (i % 2 ? 19 : 24) * Math.cos(a)) + '" y2="' + r1(60 + (i % 2 ? 19 : 24) * Math.sin(a)) + '"/>'; }
    return '<svg viewBox="0 0 90 120" preserveAspectRatio="none" aria-hidden="true"><rect x="5" y="5" width="80" height="110" rx="6" fill="none" stroke="#e9c77e" stroke-opacity=".55" stroke-width="1.2"/>' +
      '<rect x="9" y="9" width="72" height="102" rx="4" fill="none" stroke="#e9c77e" stroke-opacity=".25" stroke-width=".8"/>' +
      '<g stroke="#ffd76a" stroke-opacity=".75" stroke-width="1.6" stroke-linecap="round">' + rays + '</g><circle cx="45" cy="60" r="9" fill="#ffcf5a" fill-opacity=".85"/>' +
      '<circle cx="45" cy="20" r="1.6" fill="#e9c77e"/><circle cx="45" cy="100" r="1.6" fill="#e9c77e"/></svg>';
  }
  function backFace(r) {
    var b = el('span', 'ys-fc-back');
    if (r.cardBack) { var img = el('img'); img.src = imgSrc(S.base, r.cardBack); img.alt = ''; img.draggable = false; b.appendChild(img); b.classList.add('has-img'); }
    else b.innerHTML = backSVG();
    return b;
  }
  // Лицо перевёрнутой карты в круге: качество на маленьком диске (полный диск — на личной карте; с 03.10 вместо колеса)
  function frontFace(k) {
    var f = el('span', 'ys-fc-face');
    if (k && k.image) { var img = el('img'); img.src = imgSrc(S.base, k.image); img.alt = k.quality || ''; f.appendChild(img); f.classList.add('has-img'); }
    else {
      // Диск в наклоне: край, плоскость, светлый центр; снизу — скала, как у парящего диска
      f.insertAdjacentHTML('beforeend', '<svg class="ys-fc-w" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="#e9c77e" stroke-linecap="round">' +
        '<path d="M10 70v3c1 4 6 6 12 7 5 6 12 10 20 13 5 2 11 2 16 0 8-3 15-7 20-13 6-1 11-3 12-7v-3" stroke-opacity=".36"/>' +
        '<path d="M24 82v5M37 88v6M63 88v6M76 82v5" stroke-opacity=".2"/>' +
        '<ellipse cx="50" cy="70" rx="40" ry="11" stroke-opacity=".55"/><ellipse cx="50" cy="70" rx="25" ry="6.8" stroke-opacity=".38"/>' +
        '<ellipse cx="50" cy="70" rx="10" ry="2.8" stroke="#ffd76a" stroke-opacity=".8" fill="#ffcf5a" fill-opacity=".16"/></g></svg>');
      var t = el('span', 'ys-fc-t', k ? k.quality : '');
      // Длинное слово («Рассудительность») — мельче, чтобы не рвалось по слогам
      t.style.setProperty('--fs', Math.min(.056, .66 / Math.max(1, String(k ? k.quality : '').length)).toFixed(4));
      f.appendChild(t);
    }
    return f;
  }
  function openFan(n, mode) {
    var r = S.route, tx = r.texts || {}, ctx = ctxOf(r, n), N = Math.max(1, cardsOf(r).length - (n - 1)), perm = cardFor(r, S.code, n), done = false, i;
    var box = el('div', 'ys-fan'), ring = el('div', 'ys-fan-ring' + (N === 1 ? ' is-one' : ''));
    box.appendChild(el('p', 'ys-fan-small', fill(tx.chooseSmall || 'День {день} · {имя кина}', ctx)));
    var title = el('h2', 'ys-fan-t', fill(tx.choose || 'Выберите карту', ctx));
    box.appendChild(title);
    var pk = el('div', 'ys-pick'), pin = el('div', 'ys-pick-in');
    pin.appendChild(backFace(r)); pin.appendChild(frontFace(perm)); pk.appendChild(pin);
    for (i = 0; i < N; i++) (function (a, i) {
      var b = el('button', 'ys-fc'); b.type = 'button';
      b.style.setProperty('--a', a + 'deg'); b.style.transitionDelay = (i * 40) + 'ms';
      b.setAttribute('aria-label', 'Закрытая карта ' + (i + 1) + ' из ' + N);
      b.appendChild(backFace(r));
      b.addEventListener('click', function () { pick(b, a); });
      ring.appendChild(b);
    })(i * 360 / N, i);
    ring.appendChild(pk);
    box.appendChild(ring);
    var hint = el('p', 'ys-fan-n', fill(tx.chooseNote || 'Карты лежат рубашкой вверх — выбирайте наугад. Та, что откроется, — ваша на сегодня.', ctx));
    var open = el('button', 'ys-key-go ys-fan-open', tx.open || 'Открыть'); open.type = 'button';
    open.addEventListener('click', function () { openPersonal(n, mode, perm); });
    box.appendChild(hint); box.appendChild(open);
    function pick(b, a) {
      if (done) return; done = true;
      markPicked(n);
      // Последняя карта (12-й день) лежит в середине круга, крупнее
      var R = N === 1 ? 0 : ring.offsetWidth / 2 - b.offsetHeight / 2 - 2, k = b.offsetWidth * (N === 1 ? 1.6 : 1) / pk.offsetWidth;
      pk.style.transition = 'none';
      pk.style.transform = 'rotate(' + a + 'deg) translateY(' + (-R) + 'px) scale(' + k.toFixed(3) + ')';
      pk.classList.add('is-on'); b.classList.add('is-gone'); ring.classList.add('is-picked');
      void pk.offsetWidth;
      pk.style.transition = '';
      pk.style.transform = 'rotate(' + (a > 180 ? 360 : 0) + 'deg)';
      setTimeout(function () { pk.classList.add('is-flip'); }, REDUCED ? 0 : 420);
      setTimeout(function () {
        putText(title, fill(tx.chosen || 'Ваша карта на сегодня', ctx));
        hint.style.visibility = 'hidden'; open.classList.add('is-on'); open.focus();
      }, REDUCED ? 50 : 1500);
    }
    closeLayer();
    var ov = layer(box, 'ys-layer--fan', centerOffset());
    requestAnimationFrame(function () { requestAnimationFrame(function () { ring.classList.add('is-in'); }); });
    // Карты вылетают по очереди; потом задержку убираем, чтобы наведение откликалось сразу
    setTimeout(function () { [].forEach.call(ring.querySelectorAll('.ys-fc'), function (b) { b.style.transitionDelay = ''; }); }, 1300);
    return ov;
  }
  /* ---------- Финал Солнца (день 13) ----------
     Урезанная Карта дня 13 («Собрать маршрут»; у Путешествия и Погружения — «С чем вы выходите?») → на спирали, всё светом:
     темнеет → камни загораются по очереди от входа посолонь, из каждого выходит сгусток света своего стёклышка и плывёт по камням
     в центр (состояния входа — из начала пути, подарки — вместе со своим днём, состояния выхода — с последнего витка) →
     центральный диск светится их цветами и закручивается → свет собирается и уходит столбом вверх (или видео route.final.video*) →
     к зрителю выходит Солнце — калейдоскоп с узором из этих стёклышек → «Маршрут пройден» / «Увидимся за поворотом…» →
     «Сохранить моё Солнце» (не у Наблюдения), «Оставить отзыв» (route.final.review). Звук — только её музыка (route.final.music).
     Нажатие во время анимации — сразу к концу. После конца маршрута страница открывается сразу на последнем кадре. */
  function finCfg() { return S.route.final || {}; }
  function finPersonal() { return !!(S.code && S.mode !== 'observation'); }
  function finSeed() { return finPersonal() ? kalSeed(S.code) : routeSeed(S.route); }
  // Узор Солнца: состояния входа, 12 дней, подарки, состояния выхода; у Наблюдения — общий узор маршрута с 12 днями
  function finEx() {
    var r = S.route, ex = finPersonal() ? kalEx(r, S.code, { days: daysCount(r) - 1, gifts: giftList(S.code), marks: markList(S.code), exit: exitList(S.code) }) : kalEx(r, null, { days: daysCount(r) - 1 });
    ex.neon = neonOf(r, 'mandala');
    return ex;
  }
  /* Солнце в финале (route.final.sun): 'filigree' — Б «Золотая филигрань» (по умолчанию, её выбор 02.10), 'lace' — А «Кружево света»
     (оба — assets/sun.js, M13S), 'kaleido' — калейдоскоп маршрута. Прежняя мандала заменена филигранью ('mandala' → филигрань).
     final.sunLine — толщина линий, % (40…220, по умолчанию 100); final.sunBack — лёгкое напыление под узором (по умолчанию нет);
     final.pdfHint — подсказка цвета в PDF для раскрашивания (по умолчанию да); блеск и искорки — неон route.neon.mandala. */
  function finSunStyle() { var s = finCfg().sun; return s === 'kaleido' && window.M13K ? 'kaleido' : !window.M13S ? 'kaleido' : s === 'lace' ? 'lace' : 'filigree'; }
  function finStyle() { return kalStyle(S.route); }
  function numIn(v, def, lo, hi) { v = v == null || v === '' || isNaN(+v) ? def : +v; return Math.max(lo, Math.min(hi, v)); }
  // Данные Солнца: 12 делений — цвета стёклышек дней; в центре — стёклышки человека (середина — первое состояние выхода, ничего — золото;
  // вокруг — состояния входа, остальные выхода, подарки, отметки на диске). У Наблюдения в центре только золото.
  function finSunData() {
    var r = S.route, last = daysCount(r), cols = [], center = [], d;
    for (d = 1; d <= 12; d++) cols.push(dayGlassColor(r, (d - 1) % Math.max(1, last - 1) + 1));
    if (finPersonal()) {
      var ex = exitList(S.code), g0 = ex.length ? stateGlass(r, ex[0]) : null;
      center.push(g0 ? g0.c : [255, 205, 110]);
      (S.code.states || []).concat(ex.slice(1)).forEach(function (n) { var g = stateGlass(r, n); if (g) center.push(g.c); });
      giftList(S.code).forEach(function (g) { if (GIFT_ZONES[g[1]]) center.push(giftColor(r, g[0], GIFT_ZONES[g[1]])); });
      // Отметки на диске — следом, сколько поместится (в узоре калейдоскопа — все)
      markList(S.code).forEach(function (m) { center.push(markGlass(r, m[0], m[1]).c); });
    }
    return window.M13S.data(finSeed(), cols, center.slice(0, 13), glassLook(r, 'days'), glassLook(r, 'states'));
  }
  function finSunOpts(mode) {
    var f = finCfg();
    return { style: finSunStyle(), thick: numIn(f.sunLine, 100, 40, 220) / 100, back: f.sunBack === true, mode: mode || 'screen', hint: f.pdfHint !== false, shine: .76 + .6 * neonOf(S.route, 'mandala') };
  }
  function finBeamW(C) { return Math.max(70, Math.min(480, C.rx * 3.1)); }
  // Звёздочки у строки «Увидимся за поворотом…» — как у подписи на витрине (route.final.star: none | before | after | both, starKind)
  var STAR_PATH = { spark: 'M12 0C12.9 7.6 16.4 11.1 24 12 16.4 12.9 12.9 16.4 12 24 11.1 16.4 7.6 12.9 0 12 7.6 11.1 11.1 7.6 12 0Z',
    star: 'M12 1.8l2.8 6.6 7.2.6-5.5 4.7 1.7 7-6.2-3.8-6.2 3.8 1.7-7L2 9l7.2-.6z', moon: 'M19.6 15.8A8.6 8.6 0 0 1 8.2 4.4a8.6 8.6 0 1 0 11.4 11.4z' };
  function starNode(kind, side) {
    var i = el('i', 'ys-star ys-star--' + side); i.setAttribute('aria-hidden', 'true');
    i.innerHTML = '<svg viewBox="0 0 24 24"><path d="' + (STAR_PATH[kind] || STAR_PATH.spark) + '"/></svg>';
    return i;
  }
  function finNoteNode(tx, f) {
    var p = el('p', 'ys-fin-n'), st = f.star == null ? 'after' : f.star, k = f.starKind;
    if (st === 'before' || st === 'both') p.appendChild(starNode(k, 'b'));
    p.appendChild(el('span', null, tx.finNote || 'Увидимся за поворотом…'));
    if (st === 'after' || st === 'both') p.appendChild(starNode(k, 'a'));
    return p;
  }
  // Подпись внизу: логотип, надпись или ничего (route.final.brand: logo | text | none);
  // где — brandAt: end — в самом низу, под кнопкой-спиралью (по умолчанию) | text — в середине, под надписями; размер логотипа — brandSize: s | m | l.
  // Логотип — тот же, что на витрине (её решение 03.10): общий из «Настроек» (settings.logo, S.logo) или обычный; ведёт на главную, как внизу витрины.
  function finLogoSrc() { return S.logo && S.logo.src ? imgSrc(S.base, S.logo.src) : (S.base || '../../') + 'assets/logo.png'; }
  function finBrandNode(tx, f) {
    var b = f.brand || 'logo';
    if (b === 'none' || (b === 'text' && tx.finBrand === '')) return null;
    if (b === 'text') return el('p', 'ys-fin-brand', tx.finBrand || '13 MIRRORS');
    var u = finLogoSrc(), lg = el('span', 'ys-fin-logo ys-fin-logo--' + (f.brandSize === 'm' || f.brandSize === 'l' ? f.brandSize : 's')), a = el('a', 'ys-fin-logo-a');
    lg.setAttribute('role', 'img'); lg.setAttribute('aria-label', '13 MIRRORS');
    lg.style.cssText = "-webkit-mask-image:url('" + u + "');mask-image:url('" + u + "');--lr:" + (+(S.logo && S.logo.src && S.logo.ratio) || 2454 / 545).toFixed(3);
    a.href = (S.base || '../../') + '../'; a.setAttribute('aria-label', '13 MIRRORS — на главную');
    a.addEventListener('click', function (e) { e.stopPropagation(); });
    a.appendChild(lg);
    return a;
  }
  function rgba(c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')'; }
  function sm(k) { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); }
  function toWhite(c, k) { return [c[0] + (255 - c[0]) * k, c[1] + (255 - c[1]) * k, c[2] + (255 - c[2]) * k]; }
  // Музыка финала — только её файл; запускается прямо в нажатии (иначе телефон не даст играть)
  function soundPref() { try { return localStorage.getItem('m13ys-sound') !== '0'; } catch (e) { return true; } }
  function musicStart() {
    var f = finCfg();
    if (!f.music || f.sound === false) return null;
    var a = new Audio(imgSrc(S.base, f.music)), vol = Math.max(0, Math.min(100, f.volume == null || f.volume === '' ? 70 : +f.volume)) / 100;
    a.preload = 'auto'; a.m13vol = vol;
    if (soundPref()) fadeAudio(a, vol, 1800);
    return a;
  }
  function fadeAudio(a, to, ms, done) {
    clearInterval(a.m13fade);
    if (to > 0 && a.paused) { try { a.volume = 0; } catch (e) {} var p = a.play(); if (p && p.catch) p.catch(function () { if (a.m13upd) a.m13upd(); }); }
    var from = a.volume, t0 = Date.now();
    a.m13fade = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / ms);
      try { a.volume = from + (to - from) * k; } catch (e) {}
      if (k >= 1) { clearInterval(a.m13fade); if (!to) a.pause(); if (done) done(); }
    }, 50);
    if (a.m13upd) a.m13upd();
  }
  // Разметка кирпичей для финала: со спирали (S.B), а если камни сейчас не светятся (до начала, после «Сброса») —
  // прямо из route.zones по картинке спирали: финал всегда знает, где печать и путь
  function finBase() {
    if (S.B && S.B.node.parentNode) return { B: S.B, st: S.B.node.parentNode };
    var st = document.querySelector('.ys-stage'), img = st && st.querySelector('.ys-master'), M = pickMaster(S.route, window.innerHeight / window.innerWidth > 1.25);
    if (!st || !img || !img.naturalWidth || !M.zone) return null;
    var iw = img.naturalWidth, ih = img.naturalHeight, c = M.zone.center;
    return { B: { iw: iw, ih: ih, trace: trace(M.zone, iw, ih), center: { cx: c.x * iw, cy: c.y * ih, rx: c.rx * iw, ry: c.ry * ih } }, st: st };
  }
  // Где на экране путь по камням и центр (из разметки кирпичей); нет разметки — центр внизу посередине, без пути
  function finGeo() {
    var FB = finBase(), B = FB && FB.B, st = FB && FB.st, W = window.innerWidth, H = window.innerHeight, m = Math.min(W, H);
    if (!st || !st.getBoundingClientRect) return { W: W, H: H, C: { x: W / 2, y: H * .66, rx: m * .1, ry: m * .045 }, pts: [], L: [0], Lt: 0 };
    var rc = st.getBoundingClientRect(), k = rc.width / B.iw, pts = [], L = [0], i;
    B.trace.forEach(function (q) { pts.push({ x: rc.left + q.x * k, y: rc.top + q.y * k, w: q.w * k }); });
    var C = { x: rc.left + B.center.cx * k, y: rc.top + B.center.cy * k, rx: B.center.rx * k, ry: B.center.ry * k };
    pts.push({ x: C.x, y: C.y, w: C.ry * 1.2 });
    for (i = 1; i < pts.length; i++) L.push(L[i - 1] + dist(pts[i - 1], pts[i]));
    return { W: W, H: H, C: C, pts: pts, L: L, Lt: L[L.length - 1], rc: rc, k: k, B: B };
  }
  function finAt(G, s) {
    var P = G.pts, L = G.L, lo = 0, hi = L.length - 1, m;
    if (s <= 0) return P[0];
    if (s >= G.Lt) return P[P.length - 1];
    while (hi - lo > 1) { m = (lo + hi) >> 1; if (L[m] <= s) lo = m; else hi = m; }
    var f = (s - L[lo]) / ((L[hi] - L[lo]) || 1), a = P[lo], b = P[hi];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, w: a.w + (b.w - a.w) * f };
  }
  // Свет на камне дня: мягкое пятно по форме плиты (рисуется один раз; форма — только размытой тенью, без края).
  // Цвет спокойнее (чуть к тёплому), края мягче; на экран кладётся режимом «светлее» — без светлых швов между днями
  function finStone(G, d, col, dpr) {
    var B = G.B, pts = daySlice(B.trace, d), k = G.k, L = [], R = [], x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, wm = 0;
    if (pts.length < 2) return null;
    pts.forEach(function (p) {
      var X = G.rc.left + p.x * k, Y = G.rc.top + p.y * k, ox = p.ox * k * .6, oy = p.oy * k * .6;
      L.push([X + ox, Y + oy]); R.unshift([X - ox, Y - oy]); wm = Math.max(wm, p.w * k);
    });
    L.concat(R).forEach(function (q) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
    var pad = Math.max(8, wm * .42), cv = document.createElement('canvas'), x = cv.getContext('2d'), OFF = 4000;
    cv.width = Math.ceil((x1 - x0 + pad * 2) * dpr); cv.height = Math.ceil((y1 - y0 + pad * 2) * dpr);
    x.scale(dpr, dpr); x.translate(pad - x0 - OFF, pad - y0);
    var poly = L.concat(R);
    // Сама плита рисуется далеко за краем холста — на холст попадает только её размытая тень
    function shape(c, blur) {
      x.shadowOffsetX = OFF * dpr; x.shadowColor = c; x.shadowBlur = blur * dpr;
      x.beginPath(); poly.forEach(function (q, i) { x[i ? 'lineTo' : 'moveTo'](q[0], q[1]); }); x.closePath(); x.fill();
    }
    x.fillStyle = '#000';
    col = neonRgb(col, neonOf(S.route, 'stones'));
    col = [col[0] + (255 - col[0]) * .22, col[1] + (214 - col[1]) * .22, col[2] + (150 - col[2]) * .22];
    shape(rgba(col, .46), pad * .85);
    shape(rgba(col, .2), pad * .45);
    return { cv: cv, x: x0 - pad, y: y0 - pad, w: cv.width / dpr, h: cv.height / dpr };
  }
  // Столб света из центра вверх: тёплый, прозрачный, с лёгкой радугой по краям (как от призмы); рисуется один раз.
  // Внизу — шириной с диск печати (bw), кверху чуть шире
  function finBeam(bw, h, dpr) {
    var tw = bw * 1.45, W = Math.ceil(tw * 1.4), cv = document.createElement('canvas'), x = cv.getContext('2d'), N = Math.max(60, Math.round(h / 4)), i;
    cv.width = Math.ceil(W * dpr); cv.height = Math.ceil(h * dpr);
    // Полосами по высоте (столб чуть шире кверху); границы полос — целые точки экрана, без нахлёста (иначе видны строчки)
    var H = cv.height;
    for (i = 0; i < N; i++) {
      var y0 = Math.round(H * i / N), y1 = Math.round(H * (i + 1) / N), f = 1 - (i + .5) / N, w = (bw + (tw - bw) * f) * 1.3 * dpr, cx = W * dpr / 2, g = x.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
      g.addColorStop(0, 'rgba(255,120,90,0)'); g.addColorStop(.13, 'rgba(255,110,90,.05)'); g.addColorStop(.2, 'rgba(255,196,96,.09)');
      g.addColorStop(.36, 'rgba(255,226,170,.3)'); g.addColorStop(.5, 'rgba(255,244,214,.5)'); g.addColorStop(.64, 'rgba(255,226,170,.3)');
      g.addColorStop(.8, 'rgba(130,200,255,.08)'); g.addColorStop(.87, 'rgba(170,130,255,.05)'); g.addColorStop(1, 'rgba(170,130,255,0)');
      x.fillStyle = g; x.fillRect(cx - w / 2, y0, w, y1 - y0);
    }
    x.globalCompositeOperation = 'destination-in';
    var v = x.createLinearGradient(0, 0, 0, H);
    // Низ столба растворяется в светящемся диске — без шва: печать сама становится лучом
    v.addColorStop(0, 'rgba(0,0,0,.22)'); v.addColorStop(.5, 'rgba(0,0,0,.55)'); v.addColorStop(.86, 'rgba(0,0,0,1)'); v.addColorStop(.95, 'rgba(0,0,0,.5)'); v.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = v; x.fillRect(0, 0, cv.width, H);
    return { cv: cv, w: W, h: h };
  }
  function finFileName(c, tail) {
    var TR = 'A B V G D E ZH I K L M N P R S T U F H C SH E YU YA'.split(' ');
    return '13mirrors-' + (c ? c.code.replace(/[А-Я]/g, function (ch) {
      var i = 'АБВГДЕЖИКЛМНПРСТУФХЦШЭЮЯ'.indexOf(ch); return i < 0 ? ({ О: 'O', Ь: '', З: 'Z', Ч: 'CH', Ы: 'Y' })[ch] || '' : TR[i];
    }) : S.route.id) + (tail || '') + '.png';
  }
  function saveCanvas(cv, name) {
    cv.toBlob(function (blob) {
      // Телефон: «Поделиться» → «Сохранить изображение»; компьютер — файл в загрузки
      try {
        var f = new File([blob], name, { type: 'image/png' });
        if (window.matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f] }).catch(function () {}); return; }
      } catch (e) {}
      var a = el('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    }, 'image/png');
  }
  // «5–17 октября 2026»
  function datesText(r) {
    var s = startOf(r); if (isNaN(s)) return '';
    var a = new Date(s), b = new Date(s + (daysCount(r) - 1) * DAY);
    return a.getUTCMonth() === b.getUTCMonth() ? a.getUTCDate() + '–' + b.getUTCDate() + ' ' + MON_GEN[b.getUTCMonth()] + ' ' + b.getUTCFullYear()
      : a.getUTCDate() + ' ' + MON_GEN[a.getUTCMonth()] + ' — ' + b.getUTCDate() + ' ' + MON_GEN[b.getUTCMonth()] + ' ' + b.getUTCFullYear();
  }
  /* Фон картинки (route.final.saveBg): warm — тёплый янтарный свет, как в конце финала (по умолчанию), light — светлый сливочный,
     dark — тёмный (как было до 02.10). На светлых фонах надписи тёмно-коричневые, золото Солнца глубже (M13S: ground 'light'). */
  var SAVE_BG = {
    warm: { bg: ['#fff3d6', '#f6d391', '#e3a85a', '#c98840'], glow: 'rgba(255,250,232,', ray: 'rgba(255,248,226,', mode: 'source-over', light: true,
      kick: '#7a4a14', title: '#3a2006', note: '#7a4a14', num: '#8a5c26', card: '#3f2409', foot: '#6e4416' },
    light: { bg: ['#fffdf7', '#fff6e4', '#fbe9c8', '#f3dbb0'], glow: 'rgba(240,190,105,', ray: 'rgba(226,170,80,', mode: 'source-over', light: true,
      kick: '#8a5f2a', title: '#3a2410', note: '#8a5f2a', num: '#a07c4e', card: '#4a3018', foot: '#8a6a40' },
    dark: { bg: ['#4a2f0b', '#2c1b07', '#170e05', '#070402'], glow: 'rgba(255,214,140,', ray: 'rgba(255,230,170,', mode: 'lighter', light: false,
      kick: '#e9c77e', title: '#fff3d6', note: '#e9c77e', num: '#b9a582', card: '#f3e2bd', foot: '#b9a582' }
  };
  function saveBgOf(f) { return SAVE_BG[f.saveBg] || SAVE_BG.warm; }
  // Картинка «Сохранить моё Солнце»: 1080 × 1350 — Солнце с узором, «Маршрут пройден», по желанию — карты 12 дней (route.final.saveCards)
  function sunImage(cb) {
    var r = S.route, tx = r.texts || {}, f = finCfg(), W = 1080, H = 1350, cv = document.createElement('canvas'), x = cv.getContext('2d'), c = S.code, cards = f.saveCards !== false && c;
    var P = saveBgOf(f);
    cv.width = W; cv.height = H;
    function paint() {
      var cy = cards ? 470 : 540, R = cards ? 270 : 320, g = x.createRadialGradient(W / 2, cy, 40, W / 2, cy, 1050), i;
      g.addColorStop(0, P.bg[0]); g.addColorStop(.28, P.bg[1]); g.addColorStop(.62, P.bg[2]); g.addColorStop(1, P.bg[3]);
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      // Корона: мягкое сияние и лучи
      x.globalCompositeOperation = P.mode;
      g = x.createRadialGradient(W / 2, cy, R * .9, W / 2, cy, R * 1.9);
      g.addColorStop(0, P.glow + (P.light ? '.55)' : '.5)')); g.addColorStop(.35, P.glow + (P.light ? '.2)' : '.18)')); g.addColorStop(1, P.glow + '0)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      g = x.createRadialGradient(W / 2, cy, R, W / 2, cy, R * 1.85);
      g.addColorStop(0, P.ray + (P.light ? '.5)' : '.26)')); g.addColorStop(1, P.ray + '0)');
      x.fillStyle = g; x.beginPath();
      for (i = 0; i < 96; i++) {
        var a = i / 96 * Math.PI * 2, da = (i % 3 ? .006 : .011), len = R * (i % 2 ? 1.55 : 1.85);
        x.moveTo(W / 2 + Math.cos(a - da) * R, cy + Math.sin(a - da) * R); x.lineTo(W / 2 + Math.cos(a) * len, cy + Math.sin(a) * len); x.lineTo(W / 2 + Math.cos(a + da) * R, cy + Math.sin(a + da) * R);
      }
      x.fill();
      if (finSunStyle() !== 'kaleido' && !P.light) {
        // Филигрань и кружево — на прозрачном: под ними тёплое свечение (на светлом фоне оно не нужно)
        g = x.createRadialGradient(W / 2, cy, 0, W / 2, cy, R * 1.05);
        g.addColorStop(0, 'rgba(255,214,140,.26)'); g.addColorStop(.7, 'rgba(255,190,100,.12)'); g.addColorStop(1, 'rgba(255,170,60,0)');
        x.fillStyle = g; x.fillRect(0, 0, W, H);
      }
      x.globalCompositeOperation = 'source-over';
      if (finSunStyle() !== 'kaleido') { var so = finSunOpts('screen'); so.ground = P.light ? 'light' : ''; window.M13S.still(x, finSunData(), W / 2, cy, R, so); }
      else if (window.M13K) window.M13K.still(x, finSeed(), W / 2, cy, R, finStyle(), finEx(), kalLook(S.route));
      function spaced(t) { return String(t).toUpperCase().split('').join(String.fromCharCode(8202)); }
      x.textAlign = 'center';
      x.fillStyle = P.kick; x.font = '500 30px "Cormorant Garamond", Georgia, serif';
      x.fillText(spaced('13 MIRRORS · ' + (r.title || '')), W / 2, 76);
      var ty = cy + R * 1.62;
      x.fillStyle = P.title; x.font = '600 66px "Cormorant Garamond", Georgia, serif';
      x.fillText(flat(tx.finTitle || 'Маршрут пройден'), W / 2, ty);
      if (tx.finNote !== '') { x.fillStyle = P.note; x.font = 'italic 500 40px "Cormorant Garamond", Georgia, serif'; x.fillText(flat(tx.finNote || 'Увидимся за поворотом…'), W / 2, ty + 56); }
      if (cards) {
        x.font = '500 30px "Cormorant Garamond", Georgia, serif';
        for (i = 1; i < daysCount(r); i++) {
          var k = cardFor(r, c, i), col = (i - 1) % 3, row = Math.floor((i - 1) / 3);
          if (!k) continue;
          x.fillStyle = P.num; x.textAlign = 'right'; x.fillText(i + ' ·', 120 + col * 320, ty + 138 + row * 46);
          x.fillStyle = P.card; x.textAlign = 'left'; x.fillText(' ' + (k.quality || ''), 120 + col * 320, ty + 138 + row * 46);
        }
        x.textAlign = 'center';
      }
      x.fillStyle = P.foot; x.font = '500 28px "Cormorant Garamond", Georgia, serif';
      x.fillText(spaced([MODE_NAMES[S.mode] || '', datesText(r)].filter(Boolean).join(' · ')), W / 2, H - 44);
      cb(cv);
    }
    function fonts() { if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('600 66px "Cormorant Garamond"'), document.fonts.load('italic 500 40px "Cormorant Garamond"')]).then(paint, paint); else paint(); }
    if (window.M13K && window.M13K.preload) window.M13K.preload(glassImgs(r), fonts); else fonts();
  }

  /* PDF A4 (книжный) для раскрашивания: Солнце чёрными линиями на белом (подсказка цвета — final.pdfHint), чтобы распечатать.
     line = false — тот же лист в цвете (сейчас кнопки нет: её решение 02.10 — только картинка и PDF для раскрашивания).
     Страница рисуется картинкой 2480 × 3508 (300 точек на дюйм) и кладётся в PDF как JPEG — PDF собирается здесь же, без библиотек.
     Кода на листе нет. */
  function pdfBytes(jpeg, w, h) {
    var enc = new TextEncoder(), parts = [], off = 0, xref = [];
    function put(x) { var b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); off += b.length; }
    function obj(n, body, stream) {
      xref[n] = off; put(n + ' 0 obj\n' + body + '\n');
      if (stream) { put('stream\n'); put(stream); put('\nendstream\n'); }
      put('endobj\n');
    }
    var PW = 595.28, PH = 841.89, cs = enc.encode('q ' + PW + ' 0 0 ' + PH + ' 0 0 cm /Im0 Do Q');
    put('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>');
    obj(4, '<< /Length ' + cs.length + ' >>', cs);
    obj(5, '<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>', jpeg);
    var xo = off, t = 'xref\n0 6\n0000000000 65535 f \n';
    for (var i = 1; i <= 5; i++) t += ('000000000' + xref[i]).slice(-10) + ' 00000 n \n';
    put(t + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xo + '\n%%EOF\n');
    return new Blob(parts, { type: 'application/pdf' });
  }
  function saveBlob(blob, name) {
    try {
      var f = new File([blob], name, { type: blob.type });
      if (window.matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f] }).catch(function () {}); return; }
    } catch (e) {}
    var a = el('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  // Логотип нужного цвета на холсте (маска логотипа, залитая цветом); done(canvas | null)
  function logoTint(color, hpx, done) {
    var im = new Image();
    im.onload = function () {
      var w = Math.round(hpx * im.naturalWidth / im.naturalHeight), c = document.createElement('canvas'), x = c.getContext('2d');
      c.width = w; c.height = hpx; x.drawImage(im, 0, 0, w, hpx); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, w, hpx);
      done(c);
    };
    im.onerror = function () { done(null); };
    im.src = finLogoSrc();
  }
  function sunPdf(line) {
    var r = S.route, tx = r.texts || {}, f = finCfg(), W = 2480, H = 3508, cv = document.createElement('canvas'), x = cv.getContext('2d'), c = S.code;
    var ink = line ? '#2a2a2a' : '#5a3a12', soft = line ? '#8a8a8a' : '#9a7a4c', cards = !line && f.saveCards !== false && c;
    cv.width = W; cv.height = H;
    function spaced(t) { return String(t).toUpperCase().split('').join(String.fromCharCode(8202)); }
    function paint(logo) {
      x.fillStyle = line ? '#fff' : '#fffaf1'; x.fillRect(0, 0, W, H);
      var cy = line ? 1560 : 1300, R = line ? 1080 : 930;
      if (!line) {
        // Мягкое тёплое сияние вокруг мандалы
        var g = x.createRadialGradient(W / 2, cy, R * .9, W / 2, cy, R * 1.35);
        g.addColorStop(0, 'rgba(240,196,110,.35)'); g.addColorStop(1, 'rgba(240,196,110,0)');
        x.fillStyle = g; x.fillRect(0, 0, W, H);
      }
      if (window.M13S) window.M13S.still(x, finSunData(), W / 2, cy, R, finSunOpts(line ? 'paper' : 'screen'));
      x.textAlign = 'center';
      x.fillStyle = soft; x.font = '500 64px "Cormorant Garamond", Georgia, serif';
      x.fillText(spaced('13 MIRRORS · ' + (r.title || '')), W / 2, 200);
      var ty = cy + R + (line ? 250 : 230);
      x.fillStyle = ink; x.font = '600 ' + (line ? 120 : 150) + 'px "Cormorant Garamond", Georgia, serif';
      x.fillText(flat(tx.finTitle || 'Маршрут пройден'), W / 2, ty);
      if (tx.finNote !== '') { x.fillStyle = soft; x.font = 'italic 500 ' + (line ? 76 : 90) + 'px "Cormorant Garamond", Georgia, serif'; x.fillText(flat(tx.finNote || 'Увидимся за поворотом…'), W / 2, ty + (line ? 115 : 135)); }
      if (cards) {
        x.font = '500 62px "Cormorant Garamond", Georgia, serif';
        for (var i = 1; i < daysCount(r); i++) {
          var k = cardFor(r, c, i), col = (i - 1) % 3, row = Math.floor((i - 1) / 3), yy = ty + 300 + row * 96;
          if (!k) continue;
          x.fillStyle = soft; x.textAlign = 'right'; x.fillText(i + ' ·', 330 + col * 720, yy);
          x.fillStyle = ink; x.textAlign = 'left'; x.fillText(' ' + (k.quality || ''), 330 + col * 720, yy);
        }
        x.textAlign = 'center';
      }
      if (logo) x.drawImage(logo, (W - logo.width) / 2, H - 330);
      x.fillStyle = soft; x.font = '500 54px "Cormorant Garamond", Georgia, serif';
      x.fillText(spaced([c ? MODE_NAMES[c.mode] || '' : '', datesText(r)].filter(Boolean).join(' · ')), W / 2, H - 150);
      cv.toBlob(function (b) {
        if (!b) return;
        b.arrayBuffer().then(function (buf) { saveBlob(pdfBytes(new Uint8Array(buf), W, H), finFileName(c, line ? '-raskraska' : '-solnce').replace(/\.png$/, '.pdf')); });
      }, 'image/jpeg', .92);
    }
    function fonts() {
      var go = function () { if ((f.brand || 'logo') === 'logo') logoTint(ink, 90, paint); else paint(null); };
      if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('600 150px "Cormorant Garamond"'), document.fonts.load('italic 500 90px "Cormorant Garamond"')]).then(go, go); else go();
    }
    if (window.M13K && window.M13K.preload) window.M13K.preload(glassImgs(r), fonts); else fonts();
  }

  // o: { instant — сразу последний кадр (после конца маршрута), music — уже запущенная музыка (из нажатия) }
  var FIN = null;
  function finalScene(o) {
    o = o || {};
    var r = S.route, tx = r.texts || {}, f = finCfg(), last = daysCount(r), per = finPersonal();
    if (FIN) FIN.kill();
    if (!o.instant) markFin();
    var G = finGeo(), dpr = Math.min(2, window.devicePixelRatio || 1), C = G.C;
    var root = el('div', 'ys-fin'), cv = el('canvas', 'ys-fin-fx'), x = cv.getContext('2d');
    var ui = el('div', 'ys-fin-ui'), sun = el('div', 'ys-fin-sun'), kc = el('canvas', 'ys-fin-kal'), end = el('div', 'ys-fin-end');
    sun.appendChild(el('div', 'ys-fin-corona')); sun.appendChild(kc);
    end.appendChild(el('h2', 'ys-fin-t', tx.finTitle || 'Маршрут пройден'));
    if (tx.finNote !== '') end.appendChild(finNoteNode(tx, f));
    var brand = finBrandNode(tx, f), brandEnd = f.brandAt !== 'text';
    if (brand && !brandEnd) end.appendChild(brand);
    var btns = el('div', 'ys-fin-btns'), saveRow = null;
    // Сохранить Солнце — две маленькие кнопки рядом: картинка для телефона и PDF A4 для раскрашивания (route.final.pdf = false — только картинка)
    if (per) {
      [[tx.finSavePng || 'Картинка для телефона', function () { sunImage(function (c) { saveCanvas(c, finFileName(S.code, '-solnce')); }); }]]
        .concat(f.pdf === false ? [] : [[tx.finSaveLine || 'PDF для раскрашивания', function () { sunPdf(true); }]]).forEach(function (o) {
          var b = el('button', 'ys-code-b ys-fin-save', o[0]); b.type = 'button';
          b.addEventListener('click', function (e) { e.stopPropagation(); o[1](); });
          btns.appendChild(b);
        });
    }
    // «Оставить отзыв»: есть вопросы (панель → «Как идти и отзыв») — окно отзыва; иначе — прежняя ссылка route.final.review
    if (reviewOf(r)) {
      var rw = el('button', 'ys-code-b ys-fin-review', tx.finReview || 'Оставить отзыв'); rw.type = 'button';
      rw.addEventListener('click', function (e) { e.stopPropagation(); openReview(); });
      btns.appendChild(rw);
    } else if (f.review) {
      var rv = el('a', 'ys-code-b ys-fin-review', tx.finReview || 'Оставить отзыв'); rv.href = f.review; rv.target = '_blank'; rv.rel = 'noopener';
      rv.addEventListener('click', function (e) { e.stopPropagation(); });
      btns.appendChild(rv);
    }
    var sp = el('button', 'ys-spiral ys-fin-back'); sp.type = 'button'; sp.setAttribute('aria-label', tx.finBack || 'Вернуться на спираль'); sp.innerHTML = spiralSVG();
    sp.addEventListener('click', function (e) { e.stopPropagation(); close(); });
    end.appendChild(btns); if (saveRow) end.appendChild(saveRow); end.appendChild(sp);
    if (brand && brandEnd) { brand.classList.add('ys-fin-brand-end'); end.appendChild(brand); }
    ui.appendChild(sun); ui.appendChild(end);
    root.appendChild(cv); root.appendChild(ui);
    // Музыка: кнопка «звук», если есть её файл
    var mus = o.music || null, sb = null;
    if (!mus && f.music && f.sound !== false) { mus = new Audio(imgSrc(S.base, f.music)); mus.preload = 'auto'; mus.m13vol = Math.max(0, Math.min(100, f.volume == null || f.volume === '' ? 70 : +f.volume)) / 100; }
    if (mus) {
      sb = el('button', 'ys-fin-snd'); sb.type = 'button';
      mus.m13upd = function () { var on = !mus.paused; putText(sb, '♪ ' + (on ? tx.soundOff || 'Выключить звук' : tx.soundOn || 'Включить звук')); sb.classList.toggle('is-on', on); };
      sb.addEventListener('click', function (e) {
        e.stopPropagation();
        var on = mus.paused;
        try { localStorage.setItem('m13ys-sound', on ? '1' : '0'); } catch (er) {}
        if (on) { if (mus.ended) mus.currentTime = 0; fadeAudio(mus, mus.m13vol, 900); } else fadeAudio(mus, 0, 500);
        setTimeout(mus.m13upd, 60);
      });
      mus.addEventListener('play', mus.m13upd); mus.addEventListener('pause', mus.m13upd); mus.addEventListener('ended', mus.m13upd);
      root.appendChild(sb); mus.m13upd();
    }
    document.body.appendChild(root);
    document.body.classList.add('ys-fin-on');
    cv.width = Math.round(G.W * dpr); cv.height = Math.round(G.H * dpr);

    // Солнце рождается из печати: лежит на диске в перспективе (размером с диск) → поднимается → встаёт лицом к зрителю
    var colH = Math.max(40, C.y);
    function sunFrom() {
      // Место Солнца без сдвига (getBoundingClientRect учитывал бы уже заданный transform)
      var ru = ui.getBoundingClientRect(), sw = sun.offsetWidth || 1, cx0 = ru.left + sun.offsetLeft + sw / 2, cy0 = ru.top + sun.offsetTop + sun.offsetHeight / 2;
      sun.style.setProperty('--fx', Math.round(C.x - cx0) + 'px');
      sun.style.setProperty('--fy', Math.round(C.y - cy0) + 'px');
      sun.style.setProperty('--fs', Math.max(.08, Math.min(1, C.rx * 2.1 / sw)).toFixed(3));
      sun.style.setProperty('--tilt', Math.round(Math.acos(Math.max(.15, Math.min(.95, C.ry / (C.rx || 1)))) * 180 / Math.PI) + 'deg');
    }
    sunFrom();
    sun.classList.add('is-from');
    var sunSt = finSunStyle(), kal = null, sunL = null, seed = finSeed(), ex = null, sunD = null;
    if (sunSt === 'kaleido') { ex = finEx(); kal = window.M13K ? window.M13K.Kaleido(kc, 0, { style: finStyle(), look: kalLook(r), ex: { sym: 6 } }) : null; if (kal) kal.show(seed, ex); }
    else { sunD = finSunData(); sunL = window.M13S.Sun(kc, finSunOpts()); }
    // Камни-картинки («своя картинка» стёклышка) — заранее, чтобы Солнце раскрылось сразу с ними
    if (window.M13K && window.M13K.preload) window.M13K.preload(glassImgs(r), function () { if (sunL && sunOn) sunL.show(sunD); });
    sun.classList.toggle('is-fili', sunSt !== 'kaleido');

    // Сгустки света: { c, s0 — откуда по пути, t0 — когда, k — вид }
    var lights = [], d, i, GOLD0 = [255, 214, 140];
    function at(ix) { return G.L[Math.max(0, Math.min(G.L.length - 2, ix))]; }
    if (G.pts.length > 2) {
      if (per) S.code.states.forEach(function (n, j) { var g = stateGlass(r, n); if (g) lights.push({ c: g.c, s0: at(j * 3), t0: 1.3 + j * .38, k: 'state' }); });
      for (d = 1; d < last; d++) (function (d) {
        lights.push({ c: dayGlass(r, d).c, s0: at((2 * d - 1) * SPAN), t0: 1.9 + (d - 1) * .42, k: 'day', d: d });
        if (per) markList(S.code).forEach(function (m) { if (m[0] === d) lights.push({ c: markGlass(r, d, m[1]).c, s0: at((2 * d - 1) * SPAN), t0: 1.9 + (d - 1) * .42 + .12, k: 'gift' }); });
        if (per) giftList(S.code).forEach(function (g) { if (g[0] === d && GIFT_ZONES[g[1]]) lights.push({ c: giftColor(r, d, GIFT_ZONES[g[1]]), s0: at((2 * d - 1) * SPAN), t0: 1.9 + (d - 1) * .42 + .24, k: 'gift' }); });
      })(d);
      if (per) exitList(S.code).forEach(function (n, j) { var g = stateGlass(r, n); if (g) lights.push({ c: g.c, s0: at(22 * SPAN + j * 4), t0: 7.1 + j * .34, k: 'state' }); });
    }
    var TA = 2;
    // Огоньки — неоновым цветом своего стёклышка (route.neon.lights), яркость — final.lightsPower (%), свет камней — final.stoneLight (%)
    var NL = neonOf(r, 'lights'), ND = neonOf(r, 'disk'), LP = numIn(f.lightsPower, 100, 20, 200) / 100, SP = numIn(f.stoneLight, 100, 0, 200) / 100;
    lights.forEach(function (L) { L.dur = 1.1 + 2.5 * (G.Lt - L.s0) / (G.Lt || 1); L.arr = L.t0 + L.dur; TA = Math.max(TA, L.arr); L.a = Math.random() * 6.283; L.rr = .3 + Math.random() * .55; L.c = neonRgb(L.c, NL); });
    /* Сбор света (final.gather): 'fire' — «Костёр» (по умолчанию): огни тихо кружат по диску и гаснут, над печатью поднимаются искры
       (их цветами и тёплые; размер — final.sparkSize, %) и складываются в луч; 'swirl' — «Медленный водоворот»: ровно, без разгона,
       огни по спирали тают к центру. Потом луч; Солнце рождается из печати (sunT), тёплый свет заливает экран (fl0). */
    var mode = f.gather === 'swirl' ? 'swirl' : 'fire';
    var tw0 = TA + .3, tw1 = tw0 + (mode === 'fire' ? 2.6 : 3), b0 = tw1, sunT = b0 + 1.7, fl0 = sunT + 1.7, txtT = sunT + 4.4, btnT = txtT + .9, endT = btnT + .7;
    // Искры «Костра»: рождаются над печатью, поднимаются, покачиваясь, и стягиваются к середине — в луч
    var sparks = [], SK = numIn(f.sparkSize, 100, 40, 250) / 100, sprC = {};
    if (mode === 'fire') for (i = 0; i < 230; i++) {
      var u = (Math.random() + Math.random() - 1), Lc = lights.length ? lights[Math.floor(Math.random() * lights.length)].c : GOLD0;
      sparks.push({ tb: tw0 - .3 + (b0 + 1.3 - tw0) * Math.pow(Math.random(), .8), u: u, v: Math.random() * 2 - 1, vy: .22 + Math.random() * .3, ac: .1 + Math.random() * .25,
        life: 1.5 + Math.random() * 1.7, s: (.8 + Math.random() * 1.5), p: Math.random() * 6.283, fw: 5 + Math.random() * 9, sw: .6 + Math.random() * 1.2,
        c: Math.random() < .45 ? [255, 206 + Math.random() * 30, 130 + Math.random() * 50] : [Lc[0] + (255 - Lc[0]) * .25, Lc[1] + (220 - Lc[1]) * .25, Lc[2] + (170 - Lc[2]) * .25] });
    }
    function sparkSprite(c) {
      var k = Math.round(c[0] / 16) + ',' + Math.round(c[1] / 16) + ',' + Math.round(c[2] / 16);
      if (sprC[k]) return sprC[k];
      var q = document.createElement('canvas'), z = 32, y = q.getContext('2d'), g = y.createRadialGradient(z / 2, z / 2, 0, z / 2, z / 2, z / 2);
      q.width = q.height = z;
      g.addColorStop(0, rgba(toWhite(c, .55), 1)); g.addColorStop(.18, rgba(c, .75)); g.addColorStop(.5, rgba(c, .16)); g.addColorStop(1, rgba(c, 0));
      y.fillStyle = g; y.fillRect(0, 0, z, z);
      return (sprC[k] = q);
    }
    // Свет на камнях дней
    var stones = [];
    if (G.B && G.rc) for (d = 1; d < last; d++) stones[d] = finStone(G, d, dayGlass(r, d).c, dpr);
    var dayT = []; lights.forEach(function (L) { if (L.k === 'day') dayT[L.d] = L.t0; });
    var beam = finBeam(finBeamW(C), colH + 12, dpr);
    var dust = []; for (i = 0; i < 70; i++) dust.push({ u: Math.random() * 2 - 1, y: Math.random(), v: .015 + Math.random() * .04, s: .5 + Math.random() * 1.3, p: Math.random() * 6.283, w: 1.2 + Math.random() * 2.4 });

    // Видео из генератора (необязательно): своё у компьютерной и телефонной картинки, камера неподвижна — ложится ровно на спираль
    var tall = pickMaster(r, window.innerHeight / window.innerWidth > 1.25).tall, vsrc = tall ? f.videoMobile : f.videoDesktop, V = null, vT = 0;
    if (vsrc && !o.instant && !REDUCED) {
      var stage = document.querySelector('.ys-stage');
      if (stage) {
        V = el('video', 'ys-fin-video'); V.muted = true; V.setAttribute('muted', ''); V.playsInline = true; V.setAttribute('playsinline', ''); V.preload = 'auto';
        V.src = imgSrc(S.base, vsrc); stage.appendChild(V);
        V.addEventListener('error', function () { if (V && !V.m13on) { V.remove(); V = null; } });
      }
    }

    // Сгусток света: прозрачный и насыщенный, без белой серединки; сияние вокруг — сильнее с неоном
    function blob(px, py, rad, c, a) {
      a *= LP;
      if (a < .01) return;
      x.save(); x.translate(px, py + rad * .3); x.scale(1, .5);
      var g = x.createRadialGradient(0, 0, 0, 0, 0, rad * 2.3);
      g.addColorStop(0, rgba(c, (.2 + .14 * NL) * a)); g.addColorStop(1, rgba(c, 0));
      x.fillStyle = g; x.fillRect(-rad * 2.3, -rad * 2.3, rad * 4.6, rad * 4.6); x.restore();
      g = x.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, rgba(c, .42 * a)); g.addColorStop(.3, rgba(c, .3 * a)); g.addColorStop(.65, rgba(c, .1 * a)); g.addColorStop(1, rgba(c, 0));
      x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    function oval(px, py, rx, ry, c, a, c2) {
      if (a < .01) return;
      x.save(); x.translate(px, py); x.scale(1, ry / rx);
      var g = x.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, rgba(c2 || c, a)); g.addColorStop(.45, rgba(c, a * .55)); g.addColorStop(1, rgba(c, 0));
      x.fillStyle = g; x.fillRect(-rx, -rx, rx * 2, rx * 2); x.restore();
    }
    var GOLD = [255, 214, 140], spin = 0, lastT = 0;
    function draw(T) {
      var j, dt = Math.max(0, Math.min(.1, T - lastT)); lastT = T;
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, G.W, G.H);
      var tw = sm((T - tw0) / (tw1 - tw0)), bl = T < b0 ? 0 : sm((T - b0) / .6) * (1 - .82 * sm((T - sunT - .6) / 2.4)), vid = V && V.m13on;
      // Темно, как в комнате с диафильмом; со столбом света — светлее
      var dk = .62 * sm(T / 1.2);
      if (T > tw0) dk += .1 * tw;
      if (T > b0) dk -= .24 * sm((T - b0) / 1.6);
      if (vid) dk = dk * (1 - sm((T - vT) / .9)) + .5 * sm((T - sunT) / 1.6);
      x.fillStyle = 'rgba(5,3,1,' + dk.toFixed(3) + ')'; x.fillRect(0, 0, G.W, G.H);
      x.globalCompositeOperation = 'lighter';
      // Камни загораются по очереди, сгусток уходит — камень тихо светится. Режим «светлее» — на стыках дней нет светлых швов
      x.globalCompositeOperation = 'lighten';
      for (d = 1; d < last; d++) {
        var S0 = stones[d]; if (!S0) continue;
        var t0 = dayT[d] == null ? 2 : dayT[d], lv = T < t0 ? sm((T - t0 + .45) / .45) : .18 + .82 * Math.exp(-(T - t0) * 1.5);
        lv *= 1 - .6 * tw;
        if (T > sunT) lv = lv + (.26 - lv) * sm((T - sunT) / 2);
        lv *= SP;
        if (lv > .01) { x.globalAlpha = Math.min(1, lv); x.drawImage(S0.cv, S0.x, S0.y, S0.w, S0.h); if (lv > 1) { x.globalAlpha = Math.min(1, lv - 1); x.drawImage(S0.cv, S0.x, S0.y, S0.w, S0.h); } x.globalAlpha = 1; }
      }
      x.globalCompositeOperation = 'lighter';
      // Свечение центрального диска — растёт с каждым прилетевшим светом, их цветами
      var got = 0, mixc = [0, 0, 0];
      lights.forEach(function (L) { if (T >= L.arr) { got++; mixc[0] += L.c[0]; mixc[1] += L.c[1]; mixc[2] += L.c[2]; } });
      var avg = got ? [mixc[0] / got, mixc[1] / got, mixc[2] / got] : GOLD, cg = neonRgb([(avg[0] + GOLD[0] * 2) / 3, (avg[1] + GOLD[1] * 2) / 3, (avg[2] + GOLD[2] * 2) / 3], ND * .7);
      var vfade = vid ? 1 - sm((T - vT) / 1.2) : 1;
      oval(C.x, C.y, C.rx * 1.45, C.ry * 1.45, cg, Math.min(.5, .1 + got * .022 + tw * .25) * (1 - .5 * sm((T - sunT) / 2)) * vfade);
      // Пришедшие огни тихо кружат по диску (в перспективе), ровно, без разгона. «Водоворот» — по спирали тают к центру;
      // «Костёр» — гаснут на месте, а над печатью поднимаются искры
      var spotA = Math.min(.42, .5 / Math.sqrt(got + 1)) * LP; spin += (mode === 'swirl' ? .55 : .4) * dt;
      if (T < tw1 + .6 && vfade > .01) lights.forEach(function (L) {
        if (T < L.arr) return;
        var a0 = L.a + spin, fa = sm((T - L.arr) / .4) * (1 - sm(mode === 'swirl' ? (tw - .55) / .45 : tw / .8)) * vfade * spotA;
        var fl = 1 - sm((T - L.arr) / .8);
        if (fl > 0) oval(C.x, C.y, C.rx * (.5 + .9 * (1 - fl)), C.ry * (.5 + .9 * (1 - fl)), L.c, .35 * fl * vfade * LP);
        var rr = mode === 'swirl' ? L.rr * (1 - tw) + .03 : L.rr + .04;
        if (fa > .005) oval(C.x + Math.cos(a0) * C.rx * rr, C.y + Math.sin(a0) * C.ry * rr, C.rx * .34, C.ry * .34, L.c, fa, toWhite(L.c, .1));
      });
      // Свет собирается в один сгусток и уходит вверх
      var cm = sm((T - tw1 + 1) / 1) * (1 - .7 * sm((T - b0 - .2) / 1.4)) * vfade;
      if (!vid && cm > .01) {
        var cr = C.rx * (.6 + .4 * cm), g0 = x.createRadialGradient(C.x, C.y - C.ry * .3, 0, C.x, C.y - C.ry * .3, cr);
        g0.addColorStop(0, rgba(toWhite(cg, .3), .55 * cm)); g0.addColorStop(.35, rgba(cg, .3 * cm)); g0.addColorStop(1, rgba(cg, 0));
        x.fillStyle = g0; x.fillRect(C.x - cr, C.y - C.ry * .3 - cr, cr * 2, cr * 2);
      }
      // Летящие сгустки — по камням к центру, с мягким следом
      lights.forEach(function (L) {
        if (T < L.t0 || T >= L.arr) return;
        var k = (T - L.t0) / L.dur, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, s = L.s0 + (G.Lt - L.s0) * e, p = finAt(G, s);
        var rad = Math.max(4, Math.min(26, p.w * (L.k === 'day' ? .3 : .22))), a = sm(k / .1) * (1 - sm((k - .9) / .1) * .5), j;
        for (j = 6; j >= 1; j--) { var qq = finAt(G, s - j * rad * .5); blob(qq.x, qq.y, rad * (1 - j * .08), L.c, a * (.42 - j * .055)); }
        blob(p.x, p.y, rad, L.c, a);
      });
      // Искры «Костра»: поднимаются над печатью, покачиваются и стягиваются к середине — складываются в луч
      if (sparks.length && vfade > .01 && T > tw0 - .4 && T < b0 + 4.6) {
        var top = Math.max(40, C.y), bh = beam.w * .22;
        sparks.forEach(function (P) {
          var ag = T - P.tb; if (ag < 0 || ag > P.life) return;
          var rise = (P.vy * ag + .5 * P.ac * ag * ag) * top, py = C.y + P.v * C.ry * .45 - rise; if (py < -10) return;
          var cv0 = sm(rise / (top * .55)), px = C.x + (P.u * C.rx * .8) * (1 - cv0) + P.u * bh * cv0 + Math.sin(T * P.sw * 2 + P.p) * (3 + 6 * (1 - cv0));
          var a = sm(ag / .25) * (1 - sm((ag - P.life + .6) / .6)) * (.55 + .45 * Math.pow(.5 + .5 * Math.sin(T * P.fw + P.p), 2)) * vfade;
          var sz = P.s * SK * Math.max(1.4, Math.min(3.2, C.rx / 34)) * (1 - .35 * cv0) * 4;
          if (a < .02) return;
          x.globalAlpha = Math.min(1, a); x.drawImage(sparkSprite(P.c), px - sz / 2, py - sz / 2, sz, sz);
        });
        x.globalAlpha = 1;
      }
      // Столб света
      if (bl > .01 && !vid) {
        var grow = 1 - Math.pow(1 - sm((T - b0) / 1.2), 2), vh = beam.h * grow, sh = .9 + .1 * Math.sin(T * 2.1);
        x.globalAlpha = Math.min(1, bl * sh);
        x.drawImage(beam.cv, 0, (beam.h - vh) * dpr, beam.cv.width, vh * dpr, C.x - beam.w / 2, C.y + C.ry * .7 - vh, beam.w, vh);
        // Живые полосы внутри столба
        x.globalAlpha = Math.min(1, bl * .28);
        for (j = 0; j < 2; j++) { var off = Math.sin(T * (.35 + j * .2) + j * 2) * beam.w * .12, sw = beam.w * (.32 + j * .1); x.drawImage(beam.cv, 0, (beam.h - vh) * dpr, beam.cv.width, vh * dpr, C.x - sw / 2 + off, C.y + C.ry * .7 - vh, sw, vh); }
        x.globalAlpha = 1;
        // Сам диск печати светится и переходит в луч
        oval(C.x, C.y, C.rx * 1.25, C.ry * 1.35, GOLD, .55 * bl, [255, 240, 205]);
        oval(C.x, C.y - C.ry * .5, C.rx * .95, C.ry * 1.6, GOLD, .3 * bl, [255, 236, 196]);
        // Тёплый свет по всей поляне
        var g = x.createRadialGradient(C.x, C.y, 0, C.x, C.y, Math.max(G.W, G.H) * .7);
        g.addColorStop(0, 'rgba(255,214,150,' + (.16 * bl).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,214,150,0)');
        x.fillStyle = g; x.fillRect(0, 0, G.W, G.H);
        // Пылинки в луче
        dust.forEach(function (P) {
          var yy = (P.y + P.v * T) % 1, py = C.y - yy * vh, half = (beam.w / 2.6) * (1 + yy * .6), px = C.x + P.u * half + Math.sin(T * .3 + P.p) * 5;
          if (yy * beam.h > vh) return;
          var a = bl * (.25 + .75 * Math.pow(.5 + .5 * Math.sin(T * P.w + P.p), 3)) * (1 - Math.abs(P.u) * .6) * .75;
          x.fillStyle = 'rgba(255,242,210,' + a.toFixed(3) + ')'; x.beginPath(); x.arc(px, py, P.s, 0, 6.283); x.fill();
        });
      }
      // Тёплый свет заливает весь экран (из него выходит Солнце), потом спокойно оседает тёплым янтарём
      var fl = T < fl0 ? 0 : sm((T - fl0) / 1.5) * (1 - .55 * sm((T - sunT - .4) / 2.6));
      if (fl > .01) {
        var gF = x.createRadialGradient(G.W / 2, G.H * .42, 0, G.W / 2, G.H * .42, Math.max(G.W, G.H) * .75);
        gF.addColorStop(0, 'rgba(255,214,140,' + (.62 * fl).toFixed(3) + ')'); gF.addColorStop(.55, 'rgba(255,186,90,' + (.36 * fl).toFixed(3) + ')'); gF.addColorStop(1, 'rgba(214,130,40,' + (.22 * fl).toFixed(3) + ')');
        x.fillStyle = gF; x.fillRect(0, 0, G.W, G.H);
      }
      x.globalCompositeOperation = 'source-over';
      // Чтобы надписи читались: под ними — мягкая тень
      if (fl > .01) { x.fillStyle = 'rgba(20,10,2,' + (.22 * fl).toFixed(3) + ')'; x.fillRect(0, 0, G.W, G.H); }
    }
    var raf = 0, t0 = 0, Tnow = 0, done = false, sunOn = false, txtOn = false, btnOn = false;
    function showSun(fast) {
      if (sunOn) return; sunOn = true;
      if (fast) sun.classList.add('is-fast');
      if (!fast) sunFrom();
      sun.classList.add('is-on');
      // Солнце раскрывается от центра к краю, пока лежит на печати, потом живёт: медленно поворачивается, по золоту — блеск, искорки
      if (sunL) { sunL.show(sunD); if (!fast) sunL.unfold(2600); }
      if (kal) { if (fast || REDUCED) kal.show(seed, ex); kal.idle(seed); }
      setTimeout(function () { sun.classList.add('is-open'); }, fast || REDUCED ? 0 : 3200);
    }
    function step(ts) {
      if (!t0) t0 = ts;
      Tnow = (ts - t0) / 1000;
      // Видео: когда свет собрался — вместо закручивания и столба, если успело загрузиться
      if (V && !V.m13on && Tnow >= tw0) {
        if (V.readyState >= 2) {
          V.m13on = true; vT = Tnow; var p = V.play(); if (p && p.catch) p.catch(function () {});
          V.classList.add('is-on');
          var vd = isFinite(V.duration) && V.duration > 1 ? Math.min(14, V.duration) : 7;
          sunT = vT + Math.max(2, vd - 1.2); fl0 = sunT + 1.7; txtT = sunT + 4.4; btnT = txtT + .9; endT = btnT + .7; b0 = 1e9;
        } else { V.remove(); V = null; }
      }
      draw(Tnow);
      if (Tnow >= sunT) showSun();
      if (Tnow >= txtT && !txtOn) { txtOn = true; end.classList.add('is-on'); }
      if (Tnow >= btnT && !btnOn) { btnOn = true; end.classList.add('is-btns'); root.classList.add('is-end'); }
      if (Tnow < endT) raf = requestAnimationFrame(step); else { raf = 0; done = true; }
    }
    // Сразу к концу: последний кадр
    function finish() {
      if (raf) cancelAnimationFrame(raf); raf = 0; done = true;
      if (V) { V.remove(); V = null; }
      lastT = endT; draw(endT + 3);
      showSun(true);
      end.classList.add('is-on', 'is-btns', 'is-fast'); root.classList.add('is-end');
    }
    function onResize() { G = finGeo(); C = G.C; cv.width = Math.round(G.W * dpr); cv.height = Math.round(G.H * dpr); if (G.B && G.rc) for (d = 1; d < last; d++) stones[d] = finStone(G, d, dayGlass(r, d).c, dpr); beam = finBeam(finBeamW(C), Math.max(40, C.y) + 12, dpr); finish(); }
    function kill() {
      if (raf) cancelAnimationFrame(raf); raf = 0;
      if (kal) kal.stop();
      if (sunL) sunL.stop();
      if (V) V.remove();
      if (mus) fadeAudio(mus, 0, 700);
      window.removeEventListener('resize', onResize);
      root.remove(); FIN = null;
    }
    function close() {
      root.classList.add('is-out');
      document.body.classList.remove('ys-fin-on');
      if (mus) fadeAudio(mus, 0, 700);
      setTimeout(function () { kill(); }, 650);
      render();
    }
    root.addEventListener('click', function () { if (!done) finish(); });
    window.addEventListener('resize', onResize);
    FIN = { kill: kill, finish: finish };
    if (o.instant || REDUCED) { requestAnimationFrame(function () { root.classList.add('is-in'); finish(); }); return; }
    requestAnimationFrame(function () { root.classList.add('is-in'); raf = requestAnimationFrame(step); });
  }
  // Нажали на центр после конца маршрута (или «Финал Солнца» в проверке): финал уже собирали — сразу финал; нет — Карта дня 13
  function openFinal() {
    var r = S.route, last = daysCount(r);
    if (S.mode !== 'observation' && !S.code) { openKey(S.mode); return; }
    if (finDone()) { var m = musicStart(); closeLayer(); finalScene({ music: m }); return; }
    openDay(last, S.mode);
  }

  /* ---------- Светящиеся растения (живая среда, как в «Аватаре») ----------
     Тонкие светящиеся нити и бусинки по лианам, листики папоротников, линии, нарисованные от руки, и светящиеся фигурки —
     поверх картинки спирали, в её координатах, «в глубине»: тонко, тихо. Медленно проявляются и гаснут по одному
     (в каждый момент меняется что-то одно). Разгораются с каждым днём маршрута: в 1-й день едва заметны, к 13-му — в полную силу.
     route.plants (панель → вкладка «Растения»): on (выкл. — false), color (по умолчанию бирюзовый #3fe8d0),
     power — яркость, % (по умолчанию 100), byDay — разгораться по дням (по умолчанию да); неон — route.neon.plants.
     Раскладка — route.plants.desktop / .mobile (своя у каждой картинки; нет — PLANTS ниже). x, y — % картинки. Виды:
       { k: 'vine' | 'fern' | 'line', p: [[x, y], …], c } — лиана (бусинки по сторонам), папоротник (листики к кончику), линия от руки;
       { k: 'fig', f: 'pebble' | 'snail' | 'firefly' | 'mushroom' | 'flower' | 'butterfly' | 'drop' | 'curl', x, y, s — размер (% ширины картинки), r — поворот (°), c };
       { k: 'img', src — своя картинка, x, y, s, r }. c — свой цвет (пусто — общий).
     Если поменять картинку спирали — растения могут не совпасть с её лианами: тогда перерисовать в панели или выключить. */
  var PLANTS = {
    mobile: [
      { k: 'vine', p: [[9.5, 10], [10, 13], [9, 16], [10.5, 19], [9.2, 22], [9.8, 25], [8.4, 28], [9.2, 31], [8.6, 34], [9.6, 37.5]] },
      { k: 'vine', p: [[6.8, 13], [7.2, 17], [6.3, 21], [7, 25], [6, 29], [6.6, 33]] },
      { k: 'vine', p: [[12.5, 0], [12.8, 4], [12.2, 8], [12.9, 12]] },
      { k: 'vine', p: [[72.5, 2], [73.5, 6], [72.6, 9], [73.2, 12], [73.6, 15], [74, 18], [74.2, 21], [74.6, 24], [75.2, 27], [75.8, 30], [76.4, 33], [77, 36]] },
      { k: 'vine', p: [[80, 1], [80.6, 5], [80.1, 9], [80.9, 14], [81.4, 19], [81.9, 24], [82.4, 29], [82.9, 34]] },
      { k: 'vine', p: [[52, 0], [52.6, 4], [52, 8], [52.5, 11]] },
      { k: 'fern', p: [[14, 41], [16.5, 38], [19.5, 36.3], [23, 35.8]] },
      { k: 'fern', p: [[17, 42], [20.5, 40], [24, 39.3], [27, 40]] },
      { k: 'fern', p: [[78, 44], [80, 41.5], [83, 40.3], [86, 40.6]] },
      { k: 'fern', p: [[71, 45], [73.5, 42.5], [76, 41.6]] }
    ],
    desktop: [
      { k: 'fern', p: [[30, 27], [29.8, 22], [29.4, 17], [29.2, 13]] },
      { k: 'fern', p: [[30.5, 26], [32, 21.5], [34, 17.5]] },
      { k: 'fern', p: [[29.5, 26], [27.6, 21], [26, 17]] },
      { k: 'fern', p: [[31, 27], [34, 24.5], [37, 23]] },
      { k: 'fern', p: [[7, 28], [6, 23], [5, 19]] },
      { k: 'fern', p: [[8, 28], [10, 24.5], [12, 22]] },
      { k: 'fern', p: [[82, 25], [81, 20], [80, 15.5]] },
      { k: 'fern', p: [[83, 25], [86, 21.5], [88, 18.5]] },
      { k: 'fern', p: [[93, 27], [92.2, 22], [91.6, 18]] },
      { k: 'vine', p: [[5, 0], [5.5, 5], [4.8, 10], [5.4, 15], [4.9, 19]] },
      { k: 'vine', p: [[13, 0], [12.6, 4], [13.3, 8], [12.9, 11.5]] },
      { k: 'vine', p: [[66, 0], [66.5, 4], [65.8, 8], [66.4, 12]] },
      { k: 'vine', p: [[74, 0], [73.6, 5], [74.3, 10], [73.8, 14], [74.5, 18]] },
      { k: 'vine', p: [[89, 0], [89.5, 4], [88.8, 8], [89.4, 13]] }
    ]
  };

  function plantsCfg(route) { return route.plants || {}; }
  function plantsLevel(route) {
    var n = curDay(), last = daysCount(route);
    if (plantsCfg(route).byDay === false || n > last) return 1;
    return n < 1 ? .12 : .15 + .85 * (n - 1) / (last - 1);
  }
  var PLANT_FIGS = ['pebble', 'snail', 'firefly', 'mushroom', 'flower', 'butterfly', 'drop', 'curl'];
  // Фигурка тонкими линиями в единичном круге (радиус 1, центр 0,0); q — холст, уже сдвинутый и повёрнутый
  function plantFig(q, f) {
    function ell(x, y, rx, ry, a) { q.beginPath(); q.ellipse(x, y, rx, ry, a || 0, 0, Math.PI * 2); q.stroke(); }
    function ln(pts) { q.beginPath(); pts.forEach(function (p, i) { q[i ? 'lineTo' : 'moveTo'](p[0], p[1]); }); q.stroke(); }
    function bz(a, b, c, d) { q.beginPath(); q.moveTo(a[0], a[1]); q.bezierCurveTo(b[0], b[1], c[0], c[1], d[0], d[1]); q.stroke(); }
    function spiral(cx, cy, r0, turns, a0) { var pts = [], i, n = 60, t, rr, a; for (i = 0; i <= n; i++) { t = i / n; rr = r0 * (1 - .85 * t); a = a0 + t * turns * Math.PI * 2; pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); } ln(pts); }
    function dot(x, y, r) { q.beginPath(); q.arc(x, y, r, 0, Math.PI * 2); q.fill(); }
    if (f === 'pebble') { ell(0, .1, .9, .55); bz([-.5, -.05], [-.25, -.3], [.25, -.3], [.5, -.1]); }
    else if (f === 'snail') { spiral(.15, -.15, .55, 2.2, -Math.PI / 2); bz([-.95, .55], [-.4, .5], [.4, .5], [.75, .45]); bz([-.95, .55], [-1, .35], [-.85, .2], [-.75, .25]); ln([[-.82, .22], [-.95, -.15]]); ln([[-.75, .25], [-.7, -.12]]); dot(-.95, -.17, .05); dot(-.7, -.14, .05); }
    else if (f === 'firefly') { ell(0, .1, .16, .32); ell(-.32, -.1, .3, .16, -.5); ell(.32, -.1, .3, .16, .5); ln([[-.05, -.2], [-.18, -.5]]); ln([[.05, -.2], [.18, -.5]]); dot(0, .5, .16); }
    else if (f === 'mushroom') { bz([-.85, -.05], [-.75, -.75], [.75, -.75], [.85, -.05]); ln([[-.85, -.05], [.85, -.05]]); bz([-.22, -.05], [-.28, .45], [-.2, .8], [-.25, .9]); bz([.22, -.05], [.28, .45], [.2, .8], [.25, .9]); dot(-.35, -.38, .07); dot(.12, -.5, .06); dot(.45, -.28, .05); }
    else if (f === 'flower') { var i; for (i = 0; i < 5; i++) { var a = -Math.PI / 2 + i * Math.PI * 2 / 5; ell(Math.cos(a) * .42, Math.sin(a) * .42 - .15, .3, .15, a); } ell(0, -.15, .13, .13); bz([0, .05], [.05, .4], [-.05, .7], [.05, .95]); }
    else if (f === 'butterfly') { bz([0, -.1], [-.7, -.95], [-1, -.1], [0, 0]); bz([0, -.1], [.7, -.95], [1, -.1], [0, 0]); bz([0, .05], [-.6, .2], [-.55, .75], [0, .15]); bz([0, .05], [.6, .2], [.55, .75], [0, .15]); ln([[0, -.25], [0, .4]]); bz([0, -.25], [-.05, -.45], [-.15, -.6], [-.25, -.65]); bz([0, -.25], [.05, -.45], [.15, -.6], [.25, -.65]); }
    else if (f === 'drop') { q.beginPath(); q.moveTo(0, -.95); q.bezierCurveTo(.25, -.45, .65, -.05, .65, .3); q.arc(0, .3, .65, 0, Math.PI); q.bezierCurveTo(-.65, -.05, -.25, -.45, 0, -.95); q.stroke(); bz([-.3, .25], [-.32, .45], [-.2, .6], [-.05, .65]); }
    else { spiral(.2, -.2, .55, 1.6, Math.PI * .3); bz([.75, -.05], [.7, .4], [.3, .7], [-.6, .95]); }
  }
  function plantsLayer(route, tall, o) {
    o = o || {};
    var P = plantsCfg(route), list = (tall ? P.mobile : P.desktop) || PLANTS[tall ? 'mobile' : 'desktop'];
    var cv = el('canvas', 'ys-plants'), x = cv.getContext('2d'), W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1), raf = 0, t0 = 0, lastDraw = 0, holdTo = 0;
    var base = hexOk(P.color) ? P.color : '#3fe8d0', pw = Math.max(0, Math.min(200, P.power == null || P.power === '' ? 100 : +P.power)) / 100;
    var NP = neonOf(route, 'plants'), lv = o.still ? 1 : plantsLevel(route), items = [];
    cv.setAttribute('aria-hidden', 'true');
    function curve(pts) {
      var out = [], i, s, a, b, c, d;
      for (i = 0; i < pts.length - 1; i++) {
        a = pts[i - 1] || pts[i]; b = pts[i]; c = pts[i + 1]; d = pts[i + 2] || pts[i + 1];
        for (s = 0; s < 8; s++) { var t = s / 8; out.push({ x: cr(a[0], b[0], c[0], d[0], t) / 100 * W, y: cr(a[1], b[1], c[1], d[1], t) / 100 * H }); }
      }
      var e = pts[pts.length - 1]; out.push({ x: e[0] / 100 * W, y: e[1] / 100 * H });
      return out;
    }
    // Каждое растение — на своём маленьком холсте (рисуется один раз): тонкий стебель, бусинки и листики — в глубине, с мягким ореолом
    function paintItem(it, si, R) {
      var col = neonRgb(hexRgb(hexOk(it.c) ? it.c : base), NP), sc = Math.max(.7, W / 1000), pad = 14 * sc, x0, y0, x1, y1, c = null;
      if (it.k === 'fig' || it.k === 'img') {
        var rad = Math.max(2, (+it.s || 3) / 100 * W / 2), cx = (+it.x || 0) / 100 * W, cy = (+it.y || 0) / 100 * H;
        x0 = cx - rad * 1.45 - pad; y0 = cy - rad * 1.45 - pad; x1 = cx + rad * 1.45 + pad; y1 = cy + rad * 1.45 + pad;
      } else {
        if (!it.p || it.p.length < 2) return null;
        c = curve(it.p); x0 = 1e9; y0 = 1e9; x1 = -1e9; y1 = -1e9;
        c.forEach(function (p) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
        x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
      }
      var q0 = document.createElement('canvas'), q = q0.getContext('2d');
      q0.width = Math.max(1, Math.ceil((x1 - x0) * dpr)); q0.height = Math.max(1, Math.ceil((y1 - y0) * dpr));
      q.scale(dpr, dpr); q.translate(-x0, -y0); q.lineCap = 'round'; q.lineJoin = 'round';
      q.shadowColor = rgba(col, .8); q.shadowBlur = (3 + 4 * NP) * sc;
      var res = { cv: q0, x: x0, y: y0, w: x1 - x0, h: y1 - y0, it: it };
      if (it.k === 'img') {
        var im = new Image();
        im.onload = function () {
          var rr = Math.max(2, (+it.s || 3) / 100 * W / 2), k = rr * 2 / Math.max(im.naturalWidth, im.naturalHeight);
          q.save(); q.translate(+it.x / 100 * W, +it.y / 100 * H); q.rotate((+it.r || 0) * Math.PI / 180);
          q.drawImage(im, -im.naturalWidth * k / 2, -im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k); q.restore();
          if (o.still) draw(0);
        };
        im.src = imgSrc(glassBase(), it.src);
        return res;
      }
      if (it.k === 'fig') {
        var r0 = Math.max(2, (+it.s || 3) / 100 * W / 2);
        q.save(); q.translate(+it.x / 100 * W, +it.y / 100 * H); q.rotate((+it.r || 0) * Math.PI / 180); q.scale(r0, r0);
        q.strokeStyle = rgba(col, .75); q.fillStyle = rgba(toWhite(col, .3), .9); q.lineWidth = .7 * sc / r0;
        plantFig(q, it.f);
        q.shadowBlur = 0; q.strokeStyle = rgba(toWhite(col, .45), .55); q.lineWidth = .3 * sc / r0; plantFig(q, it.f);
        q.restore();
        return res;
      }
      // Стебель — тонкий
      q.strokeStyle = rgba(col, .34); q.lineWidth = (it.k === 'line' ? .7 : .55) * sc;
      q.beginPath(); c.forEach(function (p, i) { q[i ? 'lineTo' : 'moveTo'](p.x, p.y); }); q.stroke();
      // Бусинки (лиана, линия) или листики (папоротник) через равные отрезки
      var step = (it.k === 'fern' ? 6.5 : 9) * sc, acc = 0, j = 0, side = 1, len = 0, i;
      for (i = 1; i < c.length; i++) len += dist(c[i - 1], c[i]);
      q.shadowBlur = (2 + 3 * NP) * sc;
      for (i = 1; i < c.length; i++) {
        var sl = dist(c[i - 1], c[i]) || 1e-6;
        while (acc + sl >= step * (j + 1)) {
          var f = (step * (j + 1) - acc) / sl, px = c[i - 1].x + (c[i].x - c[i - 1].x) * f, py = c[i - 1].y + (c[i].y - c[i - 1].y) * f;
          var nx = -(c[i].y - c[i - 1].y) / sl, ny = (c[i].x - c[i - 1].x) / sl, u = step * (j + 1) / len;
          if (it.k === 'fern') {
            var L = (1 - u * .7) * 6 * sc, tx = (c[i].x - c[i - 1].x) / sl, ty = (c[i].y - c[i - 1].y) / sl;
            if (R() < .35 + .65 * lv) [1, -1].forEach(function (sd) {
              var ex = px + (nx * sd * .85 + tx * .55) * L, ey = py + (ny * sd * .85 + ty * .55) * L;
              q.strokeStyle = rgba(col, .28); q.lineWidth = .45 * sc; q.beginPath(); q.moveTo(px, py); q.quadraticCurveTo((px + ex) / 2 + (ey - py) * .15, (py + ey) / 2, ex, ey); q.stroke();
              q.fillStyle = rgba(toWhite(col, .4), .55); q.beginPath(); q.arc(ex, ey, .7 * sc, 0, Math.PI * 2); q.fill();
            });
          } else if (R() < .4 + .6 * lv) {
            var br = (.55 + R() * .55) * sc, off = (it.k === 'line' ? 1.6 : 2.2) * sc;
            q.fillStyle = rgba(toWhite(col, .35), .6 + R() * .3); q.beginPath(); q.arc(px + nx * side * off, py + ny * side * off, br, 0, Math.PI * 2); q.fill();
          }
          side = -side; j++;
        }
        acc += sl;
      }
      return res;
    }
    function build() {
      var R = rng(h32('m13plants|' + route.id + (tall ? 'm' : 'd'))), n = list.length, order = shuffledR(n, R);
      // Свой ритм: цикл на всех, у каждого — своё окно; появляются и гаснут по очереди, по одному
      var cyc = Math.max(20, n * 2.6);
      items = list.map(function (it, si) { var p = paintItem(it, si, R); if (p) p.ph = order[si] / Math.max(1, n) * cyc; return p; }).filter(Boolean);
      items.cyc = cyc;
    }
    function shuffledR(n, R) { var a = [], i, j, t; for (i = 0; i < n; i++) a.push(i); for (i = n - 1; i > 0; i--) { j = Math.floor(R() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function env(T, ph) {
      if (o.still || REDUCED) return 1;
      var u = ((T + ph) / items.cyc) % 1;
      // видно ~70 % цикла: медленно проявилось (12 %), светит, медленно ушло (12 %), отдых
      return u < .12 ? sm(u / .12) : u < .62 ? 1 : u < .74 ? 1 - sm((u - .62) / .12) : 0;
    }
    function draw(T) {
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height);
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      var b = Math.min(1, (.3 + .7 * lv) * pw * .85);
      items.forEach(function (I) {
        var a = b * env(T, I.ph); if (a < .01) return;
        x.globalAlpha = Math.min(1, a); x.drawImage(I.cv, I.x, I.y, I.w, I.h);
      });
      x.globalAlpha = 1;
    }
    function loop(ts) {
      raf = requestAnimationFrame(loop);
      // Пока выезжает карта — не рисуем (без рывков); медленные растения — 15 кадров в секунду достаточно
      if (ts < holdTo || ts - lastDraw < 66) return; lastDraw = ts;
      if (!t0) t0 = ts;
      draw((ts - t0) / 1000);
    }
    function size(w, h) {
      if (!w || (Math.abs(w - W) < 1 && Math.abs(h - H) < 1)) return;
      W = w; H = h; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      build(); draw(0);
      if (!raf && !REDUCED && !o.still) raf = requestAnimationFrame(loop);
    }
    var api = {
      node: cv,
      // Положение и размер — как у картинки спирали
      fit: function (stage) {
        cv.style.left = stage.style.left; cv.style.top = stage.style.top; cv.style.width = stage.style.width; cv.style.height = stage.style.height;
        cv.classList.toggle('is-soft', stage.classList.contains('is-soft'));
        size(parseFloat(stage.style.width) || 0, parseFloat(stage.style.height) || 0);
      },
      size: size,
      hold: function (ms) { holdTo = (window.performance ? performance.now() : 0) + ms; },
      stop: function () { if (raf) cancelAnimationFrame(raf); raf = 0; }
    };
    return api;
  }
  // Нажатие на кирпич d. Сегодняшний — импульс к центру и Карта дня; прошедший, будущий — короткая подсказка.
  function tapDay(d) {
    var r = S.route, tx = r.texts || {}, n = curDay(), last = daysCount(r), ctx = ctxOf(r, d);
    // После конца маршрута: центр — финал ещё раз
    if (n > last) { if (d === last) openFinal(); else note(fill(tx.past || 'День {день} пройден', ctx)); return; }
    if (n < 1) return;
    if (d < n) { note(fill(tx.past || 'День {день} пройден', ctx)); return; }
    if (d > n) { note(fill(tx.future || 'День {день} откроется {дата}', ctx)); return; }
    if (S.busy) return;
    if (S.mode !== 'observation' && !S.code) { openKey(S.mode); return; }
    var first = openedList().indexOf(d) < 0, B = S.B;
    markOpened(d);
    var hint = document.querySelector('.ys-tap'); if (hint) hint.classList.add('is-gone');
    if (!B || !first || REDUCED) { if (B) B.paint(lights(r, n, true)); openDay(d, S.mode); return; }
    S.busy = true;
    B.today.classList.add('is-go');
    pulse(B, d, function () {
      S.busy = false;
      B.paint(lights(r, n, true)); B.today.classList.remove('is-go');
      openDay(d, S.mode);
    });
  }
  /* ---------- «Как идти по маршруту» и окно отзыва (её план 06.10) ----------
     route.howto = { on, title, sub, back, home, go, card, phrase, sections: [{ id, title, text, sub, frame, visible }] } — страница routes/<id>/kak/ (M13R.howto()),
     кружок «?» вверху страницы маршрута, ссылка на карточке витрины. sub — подраздел (заголовок меньше); frame — раздел в рамке (вместе с подразделами до следующего раздела).
     Разметка текста (панель): пустая строка — новый абзац, Enter — новая строка, **жирное**, строки «1. …» — нумерованный список, «• …» или «- …» — список,
     [слова](Название раздела) — ссылка на раздел этой страницы, [слова](https://…) — на другой сайт.
     route.review = { on, title, lead, ph, head, btn, copyOnly, done, tg, questions: [{ id, text }], consent: { on, label, note, yes, no } } — окно «Оставить отзыв» (кнопка ✎ вверху и в финале).
     Ответы — только на этом устройстве (localStorage, недописанное сохраняется); «Отправить в Telegram» копирует «вопрос + ответ» и открывает её чат.
     Сайт ничего не отправляет; код участника в отзыв не кладётся. */
  function howtoOf(r) {
    var h = (r && r.howto) || {};
    return h.on !== false && (h.sections || []).some(function (s) { return s && s.visible !== false && String(s.text || s.title || '').trim(); }) ? h : null;
  }
  function howtoUrl(r, base) { return (base || '') + (r.path || 'routes/' + r.id + '/') + 'kak/'; }
  function reviewOf(r) {
    var v = (r && r.review) || {};
    return v.on !== false && (v.questions || []).some(function (x) { return x && String(x.text || '').trim(); }) ? v : null;
  }
  function reviewTg(r) { return String(((r.review || {}).tg) || '').trim() || r.guide || (r.trace || {}).immersion || ''; }
  function richInline(node, s, find) {
    var re = /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\(([^)\n]+)\)/g, at = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > at) node.appendChild(document.createTextNode(glue(s.slice(at, m.index))));
      if (m[1] != null) node.appendChild(el('b', null, m[1]));
      else {
        var to = m[3].trim(), web = /^(https?:|mailto:|tel:)/.test(to), a = el('a', 'ysg-more', m[2]);
        a.href = web || /^#/.test(to) ? to : find(to);
        if (/^https?:/.test(to)) { a.target = '_blank'; a.rel = 'noopener'; }
        node.appendChild(a);
      }
      at = re.lastIndex;
    }
    if (at < s.length) node.appendChild(document.createTextNode(glue(s.slice(at))));
  }
  function richNodes(text, find) {
    var out = [], para = null, list = null;
    String(text || '').split('\n').forEach(function (line) {
      var t = untag(line).trim(), mo = /^(\d{1,2})[.)]\s+(.+)$/.exec(t), mu = /^[•\-]\s+(.+)$/.exec(t);
      if (!t) { para = null; list = null; return; }
      if (mo || mu) {
        var tag = mo ? 'OL' : 'UL';
        if (!list || list.tagName !== tag) { list = el(tag.toLowerCase()); if (mo && +mo[1] > 1) list.start = +mo[1]; out.push(list); }
        para = null;
        var li = el('li'); richInline(li, mo ? mo[2] : mu[1], find); list.appendChild(li);
        return;
      }
      list = null;
      if (para) para.appendChild(el('br')); else { para = el('p'); out.push(para); }
      richInline(para, t, find);
    });
    return out;
  }
  function howtoNorm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"“”.?!:]/g, '').replace(/\s+/g, ' ').trim(); }
  // Страница «Как идти по маршруту» целиком (и предпросмотр в панели). base — путь к корню витрины от страницы.
  function howtoNode(r, base) {
    var h = r.howto || {}, ctx = { 'маршрут': r.title || '', 'даты': datesText(r) };
    var list = (h.sections || []).filter(function (s) { return s && s.visible !== false && String(s.text || s.title || '').trim(); });
    function aid(i) { return 'r' + (i + 1); }
    function find(name) {
      var k = howtoNorm(name), i = -1;
      list.some(function (s, j) { if (howtoNorm(s.title) === k) { i = j; return true; } return false; });
      if (i < 0) list.some(function (s, j) { if (k && howtoNorm(s.title).indexOf(k) === 0) { i = j; return true; } return false; });
      return i < 0 ? '#' : '#' + aid(i);
    }
    var root = el('div', 'ysg'), top = el('div', 'ysg-top'), route = base + (r.path || 'routes/' + r.id + '/');
    howtoLook(root, h.look);
    var back = el('a', null, h.back || '← К маршруту'); back.href = route;
    var home = el('a', null, h.home || 'Витрина'); home.href = base || './';
    top.appendChild(back); top.appendChild(home); root.appendChild(top);
    root.appendChild(el('h1', 'ysg-h', fill(h.title || 'Как идти по маршруту', ctx)));
    var sub = h.sub == null || h.sub === '' ? '{маршрут} · {даты} · 13 MIRRORS' : h.sub;
    if (h.sub !== '-') root.appendChild(el('p', 'ysg-sub', fill(sub, ctx)));
    var box = root;
    list.forEach(function (s, i) {
      if (!s.sub) box = root;
      if (!s.sub && s.frame) { box = el('section', 'ysg-frame'); root.appendChild(box); }
      if (String(s.title || '').trim()) { var hd = el(s.sub ? 'h3' : 'h2', null, fill(s.title, ctx)); hd.id = aid(i); box.appendChild(hd); }
      else { var an = el('span', 'ysg-a'); an.id = aid(i); box.appendChild(an); }
      richNodes(fill(s.text || '', ctx), find).forEach(function (n) { box.appendChild(n); });
    });
    if (h.go !== '-') { var go = el('a', 'ysg-go', h.go || 'Перейти к маршруту'); go.href = route; root.appendChild(go); }
    return root;
  }
  /* Оформление страницы «Как идти» (её просьба 06.10: было слишком темно) — route.howto.look, панель → «Как идти и отзыв» → «Оформление страницы»:
     { shade: затемнение картинки фона 0–90 (%), panel: 'dark' | 'light' | 'none' — подложка под текстом, size: '' | 'lg' | 'xl', font: '' (Cormorant) | 'sans', text: '#rrggbb' } */
  function howtoLook(root, L) {
    L = L || {};
    var panel = { light: 1, none: 1 }[L.panel] ? L.panel : 'dark';
    root.classList.add('ysg--' + panel);
    if (L.size === 'lg' || L.size === 'xl') root.classList.add('ysg--' + L.size);
    if (L.font === 'sans') root.classList.add('ysg--sans');
    if (/^#[0-9a-f]{6}$/i.test(L.text || '')) root.style.setProperty('--ysg-tx', L.text);
  }
  function howtoShade(L) { var n = parseFloat((L || {}).shade); return isNaN(n) ? 45 : Math.max(0, Math.min(90, n)); }
  // Страница routes/<id>/kak/: <div id="ysg" data-base="../../../" data-route="<id>">, затем M13R.howto()
  function howtoBoot() {
    var app = document.getElementById('ysg'); if (!app) return;
    var base = app.getAttribute('data-base') || '../../../', id = app.getAttribute('data-route');
    getJSON(base + 'data/journeys.json').then(function (j) {
      var r = (j.items || []).filter(function (x) { return x.id === id; })[0];
      if (!r) throw new Error();
      var D = r.scene === 'doors' ? r.doors || {} : r, m = D.masterMobile || D.mobile || D.masterDesktop || D.desktop, d = D.masterDesktop || D.desktop || m;
      if (m) document.body.style.setProperty('--ysg-m', 'url("' + imgSrc(base, m) + '")');
      if (d) document.body.style.setProperty('--ysg-d', 'url("' + imgSrc(base, d) + '")');
      document.body.style.setProperty('--ysg-sh', (howtoShade((r.howto || {}).look) / 100).toFixed(2));
      document.title = '13 MIRRORS · ' + untag((r.howto || {}).title || 'Как идти по маршруту').replace(/\n/g, ' ') + ' · ' + (r.title || '');
      if (!howtoOf(r)) {
        var w = el('div', 'ysg'), a = el('a', 'ysg-go', 'Перейти к маршруту'); a.href = base + (r.path || 'routes/' + id + '/');
        w.appendChild(el('p', 'ysg-sub', 'Страница готовится.')); w.appendChild(a); app.replaceChildren(w); return;
      }
      app.replaceChildren(howtoNode(r, base));
      if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
    }).catch(function () {
      app.replaceChildren(el('p', 'ys-err', 'Не удалось загрузить страницу. Обновите её через минуту.'));
    });
  }
  function reviewKey() { return 'm13ys-review-' + S.route.id + '-' + (S.route.start || ''); }
  // ok — галочка согласия (true / false); undefined — галочки нет (route.review.consent.on === false)
  function reviewText(r, v, qs, ans, ok) {
    var head = fill(v.head == null || v.head === '' ? 'Отзыв о маршруте «{маршрут}»' : v.head, { 'маршрут': r.title || '' }), C = v.consent || {};
    var parts = qs.map(function (x, i) { var a = String(ans[i] || '').trim(); return a ? (qs.length > 1 ? (i + 1) + '. ' : '') + untag(x.text).trim() + '\n' + a : ''; }).filter(Boolean);
    if (!parts.length) return '';
    if (ok != null) parts.push(ok ? C.yes || '✓ Согласие: можно опубликовать без имени' : C.no || 'Только для Проводника, не для публикации');
    return (head && head !== '-' ? head + '\n\n' : '') + parts.join('\n\n');
  }
  function openReview() {
    var r = S.route, v = reviewOf(r); if (!v) return;
    var box = el('div', 'ys-key ys-rv'), saved = {}, tg = reviewTg(r), copyOnly = !tg || v.copyOnly;
    try { saved = JSON.parse(localStorage.getItem(reviewKey()) || '{}') || {}; } catch (e) {}
    function store() { if (S.preview) return; try { localStorage.setItem(reviewKey(), JSON.stringify(saved)); } catch (e) {} }
    box.appendChild(el('h2', 'ys-key-t', v.title || 'Ваш отзыв'));
    if (v.lead !== '-') box.appendChild(el('p', 'ys-key-lead', v.lead || 'Пишите как есть, коротко или подробно — любой ответ поможет. Можно ответить не на все вопросы. Недописанное сохранится на этом устройстве.'));
    var qs = v.questions.filter(function (x) { return x && String(x.text || '').trim(); }), areas = [];
    var form = el('div', 'ys-rv-list');
    qs.forEach(function (x, i) {
      var id = x.id || 'q' + (i + 1), lab = el('label', 'ys-rv-q'), t = el('textarea', 'ys-rv-a');
      lab.appendChild(el('span', 'ys-rv-qt', (qs.length > 1 ? (i + 1) + '. ' : '') + untag(x.text).trim()));
      t.rows = 2; t.value = saved[id] || ''; if (v.ph) t.placeholder = v.ph;
      function fit() { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 2, 320) + 'px'; }
      t.addEventListener('input', function () { saved[id] = t.value; if (!t.value) delete saved[id]; fit(); store(); });
      lab.appendChild(t); form.appendChild(lab); areas.push(t);
      requestAnimationFrame(fit);
    });
    box.appendChild(form);
    // Согласие на публикацию без имени — галочку ставит сам человек (по умолчанию не стоит); попадает в текст отзыва, сайт его не хранит
    var C = v.consent || {}, ok = null;
    if (C.on !== false) {
      var cl = el('label', 'ys-rv-ok');
      ok = el('input'); ok.type = 'checkbox'; ok.checked = !!saved._ok;
      ok.addEventListener('change', function () { if (ok.checked) saved._ok = 1; else delete saved._ok; store(); });
      cl.appendChild(ok); cl.appendChild(el('span', null, C.label || 'Можно опубликовать мой отзыв без имени'));
      box.appendChild(cl);
      if (C.note !== '-') box.appendChild(el('p', 'ys-rv-oknote', C.note || 'Опубликую без имени и ника, в разделе «Отзывы».'));
    }
    var send = el('a', 'ys-key-go ys-rv-go', copyOnly ? v.copyBtn || 'Скопировать отзыв' : v.btn || 'Отправить в Telegram');
    if (!copyOnly) { send.href = tg; send.target = '_blank'; send.rel = 'noopener'; } else { send.href = '#'; send.setAttribute('role', 'button'); }
    var done = el('div', 'ys-rv-done'), err = el('p', 'ys-key-err');
    send.addEventListener('click', function (e) {
      var msg = reviewText(r, v, qs, areas.map(function (t) { return t.value; }), ok ? ok.checked : undefined);
      putText(err, '');
      if (!msg) { e.preventDefault(); putText(err, v.empty || 'Напишите ответ хотя бы на один вопрос.'); return; }
      if (copyOnly) e.preventDefault();
      copyText(msg, function () {});
      done.replaceChildren(el('p', 'ys-key-lead', v.done || (copyOnly ? 'Текст отзыва скопирован — вставьте его в сообщение Проводнику.' : 'Текст отзыва скопирован. В открывшемся чате Telegram вставьте его в сообщение и отправьте.')));
      var more = el('details', 'ys-rv-raw'), ta = el('textarea', 'ys-rv-a');
      more.appendChild(el('summary', null, v.rawLabel || 'Не вставляется? Вот текст — выделите и скопируйте'));
      ta.value = msg; ta.readOnly = true; ta.rows = 6; more.appendChild(ta); done.appendChild(more);
    });
    box.appendChild(send); box.appendChild(err); box.appendChild(done);
    box.appendChild(el('p', 'ys-key-note', v.note || 'Сайт ничего не отправляет и не хранит: ответы видны только вам, пока вы сами не отправите их. Ваш код в отзыв не попадает.'));
    var close = el('button', 'ys-key-alt', v.close || 'Закрыть'); close.type = 'button';
    close.addEventListener('click', function () { closeLayer(); });
    box.appendChild(close);
    var ov = layer(box, 'ys-layer--key ys-layer--rv');
    // Затемнение под окном отзыва — route.review.shade (0–90 %, панель); обычно 35 %, сквозь него видна страница маршрута
    var sh = parseFloat(v.shade); if (ov && ov.style) ov.style.setProperty('--ys-rv-sh', ((isNaN(sh) ? 35 : Math.max(0, Math.min(90, sh))) / 100).toFixed(2));
  }
  // Сверху: ссылка на витрину слева, «Мой код» справа — во всех форматах: есть код — узор и код ещё раз (сохранить, отправить, ввести другой);
  // в Наблюдении без кода — окно ввода ключа или кода (из него можно остаться в Наблюдении)
  function topLinks(page) {
    var tx = S.route.texts || {};
    var back = el('a', 'ys-back', tx.back || '← Вернуться на витрину');
    back.href = S.base || '../../';
    page.appendChild(back);
    var obsMe = S.mode === 'observation' && !S.code;
    var me = el('button', 'ys-me', S.code || obsMe ? tx.myCodeBtn || 'Мой код' : tx.keyBtn || 'Ввести ключ'); me.type = 'button';
    me.addEventListener('click', function () { if (obsMe) openKey('observation'); else openKey(S.code ? S.code.mode : S.mode, true); });
    // Рядом с «Мой код» — кружки «?» (страница «Как идти по маршруту») и ✎ (окно отзыва), если они заполнены в панели
    var tools = el('div', 'ys-tools'), H = howtoOf(S.route), V = reviewOf(S.route);
    if (H) {
      var hq = el('a', 'ys-me ys-ic', '?'); hq.href = howtoUrl(S.route, S.base);
      hq.title = untag(H.title || 'Как идти по маршруту').replace(/\n/g, ' '); hq.setAttribute('aria-label', hq.title);
      if (S.preview) hq.target = '_blank';
      tools.appendChild(hq);
    }
    if (V) {
      var rb = el('button', 'ys-me ys-ic ys-ic--rv'); rb.type = 'button';
      rb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4.4L15.8 5a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.4 18.8z"/><path d="M13.5 7.3l3.2 3.2"/></svg>';
      rb.title = tx.finReview || 'Оставить отзыв'; rb.setAttribute('aria-label', rb.title);
      rb.addEventListener('click', openReview);
      tools.appendChild(rb);
    }
    tools.appendChild(me);
    page.appendChild(tools);
  }

  /* ---------- Сцена «Двери» (route.scene === 'doors'; вид и движение — assets/doors.js, M13D) ----------
     В день N зовёт дверь N: нажали → жест → дверь открывается → пространство дня на весь экран → «Назад к дверям».
     До полуночи (по поясу маршрута) в сегодняшнюю дверь можно входить сколько угодно; прошедшие закрыты навсегда, но хранят след. */
  function doorsCfg() { return S.route.doors || {}; }
  function renderDoors() {
    var r = S.route, app = document.getElementById('ys'), tx = r.texts || {}, D = doorsCfg(), M = window.M13D;
    app.replaceChildren(); S.B = null; clearInterval(S.dayT);
    if (S.plants) { S.plants.stop(); S.plants = null; }
    var page = el('div', 'ys-page ys-page--doors'), bg = el('div', 'ys-bgwrap');
    var P = M.pick(r, window.innerHeight / window.innerWidth > 1.25);
    if (P.src && D.fit !== 'cover') { var blur = el('div', 'ys-dblur'); blur.style.backgroundImage = 'url("' + imgSrc(S.base, P.src) + '")'; bg.appendChild(blur); }
    var n = curDay(), last = daysCount(r), d, uc = isChoice(r), log = uc ? choiceLog() : null, mine = uc && n >= 1 && n <= last ? doorOfDay(n, log) : 0;
    if (S.sim == null && !uc) doorSync(n);
    var sc = S.DS = M.scene(r, { key: P.key, base: S.base, zones: S.zonesOn, onTap: tapDoor }), free = [];
    if (uc) {
      // Свободная — можно выбрать, пока сегодня ещё не выбрано; сегодняшняя — входить снова; прошлая — только надпись
      for (d = 1; d <= M.count(r); d++) {
        var st = ucState(d, n, log), dd = dayOfDoor(d, log), ok = n >= 1 && n <= last && (st === 'today' || (st === 'free' && !mine));
        sc.set(d, st, true, ok);
        if (dd) { sc.mark(d, dd, true); if (D.showDayNumbers) sc.num(d, String(dd)); }
        if (ok && st === 'free' && M.doorOf(r, d).on !== false) free.push(d);
      }
      if (D.call !== false) sc.call(free, { color: D.callColor, ms: D.callMs });
    } else for (d = 1; d <= last; d++) sc.set(d, doorState(d, n), true);
    // Мир: слои дней по календарю — у всех одинаково (after — после конца дня, during — уже в течение дня)
    worldShow(sc, n, true);
    bg.appendChild(sc.node); page.appendChild(bg);
    var dim = el('div', 'ys-dim');
    dim.style.setProperty('--ys-dim', Math.max(0, Math.min(95, D.dim == null || D.dim === '' ? 45 : +D.dim)) / 100);
    page.appendChild(dim);
    topLinks(page);
    var hud = el('div', 'ys-hud'), ctx = ctxOf(r, Math.max(1, Math.min(last, n))), fin = D.final && D.final.on;
    if (n === 0) {
      hud.appendChild(el('h1', 'ys-h', fill(tx.before || 'Маршрут скоро начнётся', ctx)));
      if (tx.beforeNote) hud.appendChild(el('p', 'ys-sub', fill(tx.beforeNote, ctx)));
    } else if (n > last) {
      hud.appendChild(el('h1', 'ys-h', fill(tx.after || 'Маршрут пройден', ctx)));
      if (tx.afterNote) hud.appendChild(el('p', 'ys-sub', fill(tx.afterNote, ctx)));
    } else if (uc) {
      hud.appendChild(el('p', 'ys-sub', fill(tx.today || 'Сегодня — день {день}', ctx)));
      var pick = mine ? (sc.poly(mine) ? 0 : mine) : (free.filter(function (k) { return sc.poly(k); }).length ? 0 : free[0] || 0);
      if (!pick) hud.appendChild(el('p', 'ys-tap' + (mine ? ' ys-tap--calm' : ''), fill(mine ? tx.doorAgain || 'Сегодняшняя дверь открыта до полуночи' : tx.doorChoose || 'Выберите дверь', ctx)));
      else {
        // У нужной двери нет контура на этой картинке — вход кнопкой
        var gb2 = el('button', 'ys-go', tx.doorEnter || 'Войти в дверь дня'); gb2.type = 'button';
        gb2.addEventListener('click', function () { tapDoor(pick); });
        hud.appendChild(gb2);
      }
    } else {
      hud.appendChild(el('p', 'ys-sub', fill(tx.today || 'Сегодня — день {день}', ctx)));
      var seen = doorLog()[n] === 'v', can = !!sc.poly(n);
      if (can) hud.appendChild(el('p', 'ys-tap' + (seen ? ' ys-tap--calm' : ''), fill(seen ? tx.doorAgain || 'Сегодняшняя дверь открыта до полуночи' : tx.doorTap || 'Коснитесь двери дня', ctx)));
      else {
        // Нет контура сегодняшней двери на этой картинке (или дверь выключена) — вход кнопкой
        var go = el('button', 'ys-go', tx.doorEnter || 'Войти в дверь дня'); go.type = 'button';
        go.addEventListener('click', function () { tapDoor(n); });
        hud.appendChild(go);
      }
    }
    if (fin && (n > last || (n === last && (uc ? !!mine : doorLog()[last] === 'v')))) {
      var fb = el('button', 'ys-go ys-go--fin', tx.doorFinal || 'Финал'); fb.type = 'button';
      fb.addEventListener('click', openDoorsFinal);
      hud.appendChild(fb);
    }
    // «Сохранить мою фигуру» (заход «б»): после конца маршрута (или с первого следа — doors.figure = 'always'), если есть хоть один след
    var fg = D.figure || '';
    if (uc && fg !== 'off' && Object.keys(log).length && (fg === 'always' || n > last || (n === last && !!mine))) {
      var sb = el('button', 'ys-go ys-go--fig', tx.figureSave || 'Сохранить мою фигуру'); sb.type = 'button';
      sb.addEventListener('click', saveFigure);
      hud.appendChild(sb);
    }
    page.appendChild(hud);
    app.appendChild(page);
    if (S.debug) app.appendChild(debugPanel());
    function place() {
      var iw = sc.img.naturalWidth || (P.tall ? 9 : 16), ih = sc.img.naturalHeight || (P.tall ? 16 : 9);
      M.fit(sc.node, iw, ih, D.fit, window.innerWidth, window.innerHeight);
    }
    sc.img.addEventListener('load', place); place();
    window.onresize = function () {
      if (M.pick(r, window.innerHeight / window.innerWidth > 1.25).key !== P.key) { if (S.space) S.redraw = true; else render(); return; }
      place();
    };
    // Человек в пространстве, а страницу перестроили (вошёл по ключу) — пространство дня собирается заново под его формат
    if (S.space && S.spaceDay) refreshSpace();
    // Полночь, пока страница открыта: сцена перестраивается сама (вчерашняя дверь закрывается)
    S.doorDay = n;
    S.dayT = setInterval(function () { if (S.sim == null && !S.space && !S.busy && curDay() !== S.doorDay) render(); }, 30000);
  }
  // Мировые слои: день k виден после своего дня (after) или уже в свой день (during); после конца маршрута — все
  function worldShow(sc, n, now) {
    var r = S.route, M = window.M13D, last = daysCount(r), k;
    for (k = 1; k <= last; k++) {
      var w = M.dayCfg(r, k).world || [];
      if (w.length) sc.world(k, n > k || (n === k && w.some(function (L) { return L && L.when === 'during'; })), now);
    }
  }
  function tapChoice(d) {
    var r = S.route, tx = r.texts || {}, n = curDay(), last = daysCount(r), log = choiceLog(), st = ucState(d, n, log), ctx = ctxOf(r, Math.max(1, Math.min(last, n)));
    ctx['начало'] = dateOf(r, 1); ctx['конец'] = dateOf(r, last);
    if (n < 1) { note(fill(tx.doorBefore || 'Маршрут начнётся {начало}', ctx)); return; }
    if (n > last) { note(fill(tx.doorAfter || 'Маршрут пройден', ctx)); return; }
    if (st === 'past') { var pd = dayOfDoor(d, log); note(fill(tx.doorPastChoice || 'День {день} · Kin {кин}', ctxOf(r, pd))); return; }
    if (st === 'free' && doorOfDay(n, log)) { note(fill(tx.doorTomorrow || 'Новую дверь можно будет выбрать завтра', ctx)); return; }
    if (!doorsCard(r) && S.mode !== 'observation' && !S.code) { openKey(S.mode); return; }
    // Свободная дверь открывает сегодняшний день — выбор запоминается сразу, заменить нельзя
    if (st === 'free') { choose(n, doorIdOf(d)); if (S.DS) S.DS.call([]); }
    enterDoor(d, false, n);
  }
  /* «Моя фигура» — одна картинка: сцена + мир состоявшихся дней + личные следы (M13D.figure; собирается на устройстве, никуда не уходит).
     Картинка — та, что сейчас на экране (компьютер или телефон). */
  function saveFigure() {
    var r = S.route, M = window.M13D, tx = r.texts || {};
    if (!isChoice(r) || !Object.keys(choiceLog()).length) { note(tx.figureEmpty || 'Фигура появится, когда вы выберете первую дверь.'); return; }
    if (S.busy) return;
    S.busy = true;
    M.figure(r, { key: S.DS ? S.DS.key : M.pick(r, window.innerHeight / window.innerWidth > 1.25).key, base: S.base, day: curDay(), choice: choiceLog() }, function (cv) {
      S.busy = false;
      // Имя файла — латиницей: не все браузеры сохраняют файл с русским именем
      var name = '13mirrors-' + String(r.id || 'route').replace(/[^\w-]+/g, '') + '-figure.png';
      function fail() { note('Не получилось собрать картинку на этом устройстве.'); }
      if (!cv) { fail(); return; }
      try {
        cv.toBlob(function (b) {
          if (!b) { fail(); return; }
          var u = URL.createObjectURL(b), a = document.createElement('a');
          a.href = u; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 1000);
          setTimeout(function () { URL.revokeObjectURL(u); }, 30000);
          note(tx.figureDone || 'Ваша фигура сохранена картинкой.');
        }, 'image/png');
      } catch (e) { fail(); }
    });
  }
  function tapDoor(d) {
    var r = S.route, tx = r.texts || {}, n = curDay(), ctx = ctxOf(r, d), st = doorState(d, n);
    if (S.busy || S.space) return;
    if (isChoice(r)) { tapChoice(d); return; }
    if (st === 'future') { if (n >= 1 || tx.doorFuture) note(fill(tx.doorFuture || 'Эта дверь откроется {дата}', ctx)); return; }
    if (st === 'past_visited' || st === 'past_unvisited') { note(fill(st === 'past_visited' ? tx.doorPast || 'Эта дверь уже закрылась — её день прошёл' : tx.doorMissed || tx.doorPast || 'Эта дверь уже закрылась — её день прошёл', ctx)); return; }
    if (S.mode !== 'observation' && !S.code && !doorsCard(r)) { openKey(S.mode); return; }
    enterDoor(d);
  }
  // d — день (в fixed день = дверь) или 'final'
  function spaceNode(d) {
    var r = S.route, M = window.M13D, fin = d === 'final', n = fin ? daysCount(r) : d, tx = r.texts || {};
    var cfg = fin ? doorsCfg().final || {} : M.spaceOf(r, d);
    return M.space(r, cfg, { base: S.base, tall: window.innerHeight / window.innerWidth > 1.25, mode: S.mode, ctx: ctxOf(r, n), fill: fill, put: putText,
      backText: tx.doorBack || '← Назад к дверям', onBack: leaveSpace, act: function (kind) { spaceAct(kind, n); },
      empty: S.preview ? (fin ? 'Финал пока пустой — блоки добавляются в панели: «За дверью» → «Финал».' : 'Здесь пока пусто — блоки добавляются в панели: «За дверью» → ' + (isChoice(r) ? 'день ' : 'дверь ') + n + '.') : '' });
  }
  // Пространство уже открыто, а формат поменялся (вошли по ключу) — то же место, новое содержание
  function refreshSpace() {
    var old = S.space, nw = spaceNode(S.spaceDay);
    nw.classList.add('is-in'); nw._ol = old._ol;
    old.parentNode.replaceChild(nw, old); S.space = nw;
  }
  // d — дверь (0 — без двери: предпросмотр пространства дня), day — день (в fixed — тот же номер); now — сразу, без движения и без отметки «входили» (предпросмотр из панели)
  function enterDoor(d, now, day) {
    var r = S.route, M = window.M13D, uc = isChoice(r), door = d ? M.doorOf(r, d) : {}, sp, cfg;
    day = day || d; sp = spaceNode(day); cfg = M.spaceOf(r, day);
    if (!now && !uc) doorVisit(d);
    var hint = document.querySelector('.ys-tap'); if (hint) hint.classList.add('is-gone');
    S.busy = true; S.space = sp; S.spaceN = d || null; S.spaceDay = day;
    M.go(d ? S.DS : null, d || null, sp, { open: door.open, door: door, base: S.base, now: now, onCover: function () {
      if (S.DS && d && !now) { if (uc) S.DS.set(d, 'today', false, true); else S.DS.set(d, doorState(d, curDay())); }
    } }, function () {
      S.busy = false;
      // Сначала Карта дня — одна для всех форматов; глубже — по ключу, за картой
      if (M.first(r) === 'card') { if (!now) openDay(day, S.mode); return; }
      var a = M.autoBlocks(cfg, S.mode)[0];
      if (a && !now) setTimeout(function () { spaceAct(a.kind, day); }, 250);
    });
  }
  function openDoorsFinal() {
    var D = doorsCfg();
    if (S.busy) return;
    if (!(D.final && D.final.on)) { closeLayer(); return; }
    if (S.space) { S.space.remove(); S.space = null; }
    closeLayer();
    var sp = spaceNode('final');
    S.busy = true; S.space = sp; S.spaceN = null;
    S.spaceDay = 'final';
    window.M13D.go(null, null, sp, { base: S.base }, function () { S.busy = false; });
  }
  function leaveSpace() {
    var sp = S.space, d = S.spaceN, M = window.M13D; if (!sp || S.busy) return;
    closeLayer();
    S.busy = true;
    var day = S.spaceDay;
    M.back(S.spaceN ? S.DS : null, d, sp, { open: d ? M.doorOf(S.route, d).open : null }, function () {
      S.busy = false; S.space = null; S.spaceN = null; S.spaceDay = null;
      if (S.redraw || (S.sim == null && curDay() !== S.doorDay)) { S.redraw = false; render(); return; }
      // Выбор двери: личный след дня проступает на выбранной двери, когда человек возвращается к дверям
      if (isChoice(S.route) && d && S.DS && typeof day === 'number') { S.DS.mark(d, day, false); if (doorsCfg().showDayNumbers) S.DS.num(d, String(day)); }
      // Подсказка над дверями: сегодняшняя уже открыта
      var h = document.querySelector('.ys-tap.is-gone');
      if (h && d) { putText(h, fill((S.route.texts || {}).doorAgain || 'Сегодняшняя дверь открыта до полуночи', ctxOf(S.route, d))); h.classList.add('ys-tap--calm'); h.classList.remove('is-gone'); }
    });
  }
  // Подключаемые части маршрута в пространстве дня: те же Карта дня, колода, стёклышко, что и на спирали
  function spaceAct(kind, n) {
    var r = S.route, tx = r.texts || {};
    if (kind === 'dayCard') openDay(n, S.mode);
    else if (kind === 'deck') {
      if (S.mode === 'observation') return;
      if (!S.code) { openKey(S.mode); return; }
      if (n >= daysCount(r)) { openDay(n, S.mode); return; }
      if (pickedList().indexOf(n) >= 0) openPersonal(n, S.mode, cardFor(r, S.code, n)); else openFan(n, S.mode);
    } else if (kind === 'glass') {
      if (!S.code) { openKey(S.mode === 'observation' ? 'journey' : S.mode); return; }
      if (n < daysCount(r) && listOf(seenKey()).indexOf(n) < 0) openGlass(n);
      else note(fill(tx.glassSeen || 'Стёклышко дня {день} уже в вашем узоре', ctxOf(r, n)));
    } else if (kind === 'final') openDoorsFinal();
    else if (kind === 'figure') saveFigure();
  }
  function render() {
    if (isDoors(S.route) && window.M13D) { renderDoors(); return; }
    var r = S.route, app = document.getElementById('ys'), tx = r.texts || {};
    app.replaceChildren(); S.B = null; S.DS = null; clearInterval(S.dayT);
    if (S.plants) { S.plants.stop(); S.plants = null; }
    var page = el('div', 'ys-page');
    var bg = el('div', 'ys-bgwrap'), stage = el('div', 'ys-stage'), img = el('img', 'ys-master');
    var M = pickMaster(r, window.innerHeight / window.innerWidth > 1.25);
    img.alt = ''; img.src = imgSrc(S.base, M.src);
    stage.appendChild(img); bg.appendChild(stage); page.appendChild(bg);
    var dim = el('div', 'ys-dim');
    dim.style.setProperty('--ys-dim', Math.max(0, Math.min(95, r.dimTop == null ? 60 : +r.dimTop)) / 100);
    page.appendChild(dim);
    // Светящиеся растения — поверх затемнения, чтобы светились и вверху
    if (plantsCfg(r).on !== false && M.src) { S.plants = plantsLayer(r, M.tall); page.appendChild(S.plants.node); }

    topLinks(page);

    var n = curDay(), last = daysCount(r), opened = openedList().indexOf(n) >= 0;
    // Финал собран (день 13) — спираль уже золотая, как после конца маршрута
    var lit = n === last && finDone() ? last + 1 : n;
    var bricks = !!M.zone && n >= 1;
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
      if (bricks) { if (!opened) hud.appendChild(el('p', 'ys-tap', fill(n === last ? tx.tapLast || 'Коснитесь центра спирали' : tx.tap || 'Коснитесь светящегося камня', ctx))); }
      else {
        // Нет разметки кирпичей для этой картинки — Карта дня открывается кнопкой
        var go = el('button', 'ys-go', tx.openDay || 'Карта дня');
        go.type = 'button';
        go.addEventListener('click', function () { markOpened(n); openDay(n, S.mode); });
        hud.appendChild(go);
      }
    }
    page.appendChild(hud);
    app.appendChild(page);
    if (S.debug) app.appendChild(debugPanel());

    function build() {
      stageFit(stage, img, M.zone);
      if (S.plants && img.naturalWidth) S.plants.fit(stage);
      if (!bricks || S.B || !img.naturalWidth) return;
      var iw = img.naturalWidth, ih = img.naturalHeight, g = r.glow || {};
      var B = S.B = bricksLayer(r, M.zone, iw, ih, { color: g.color, dusk: Math.max(0, Math.min(90, g.dusk == null || g.dusk === '' ? 35 : +g.dusk)) / 100, zones: S.zonesOn });
      B.paint(lights(r, lit, opened));
      stage.appendChild(B.node);
      // Большая невидимая кнопка на сегодняшнем кирпиче (на телефоне плиты внутренних витков маленькие), после конца — на центре
      var hd = n <= last ? n : last;
      var hp = hd === last ? { x: B.center.cx, y: B.center.cy } : B.trace[(2 * hd - 1) * SPAN];
      var hit = el('button', 'ys-hit' + (hd === last ? ' ys-hit--c' : ''));
      hit.type = 'button';
      hit.setAttribute('aria-label', n > last ? wordsOf(r).name + ' в центре' : 'Открыть день ' + hd);
      hit.style.left = (hp.x / iw * 100) + '%'; hit.style.top = (hp.y / ih * 100) + '%';
      hit.addEventListener('click', function (e) { e.stopPropagation(); tapDay(hd); });
      stage.appendChild(hit);
      stage.addEventListener('click', function (e) {
        var rc = stage.getBoundingClientRect(), k = iw / rc.width;
        var d = hitDay(B, (e.clientX - rc.left) * k, (e.clientY - rc.top) * k, last, 10 * k, hd, 30 * k);
        if (d) tapDay(d);
      });
    }
    img.addEventListener('load', build);
    if (img.complete) build();
    window.onresize = function () {
      if (pickMaster(r, window.innerHeight / window.innerWidth > 1.25).src !== M.src) { render(); return; }
      if (img.complete) { stageFit(stage, img, M.zone); if (S.plants) S.plants.fit(stage); }
    };
  }
  // Режим проверки: ?debug=1 — спираль на любой день, все пройдены, центр, финал, сброс; любая карта в любом формате.
  function debugPanel() {
    var r = S.route, box = el('div', 'ys-debug' + (S.dbgMin ? ' is-min' : '')), last = daysCount(r);
    var head = el('button', 'ys-debug-h'); head.type = 'button';
    var body = el('div', 'ys-debug-b');
    function headText() { head.textContent = S.dbgMin ? 'Проверка ▴ развернуть' : 'Проверка ▾ свернуть'; }
    headText();
    head.addEventListener('click', function () { S.dbgMin = !S.dbgMin; box.classList.toggle('is-min', S.dbgMin); headText(); });
    function sel(opts, val) { var s = el('select'); opts.forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; s.appendChild(op); }); s.value = val; return s; }
    function btn(t, f) { var b = el('button', null, t); b.type = 'button'; b.addEventListener('click', f); return b; }
    function row(kids) { var d = el('div', 'ys-debug-row'); kids.forEach(function (k) { d.appendChild(k); }); return d; }
    var real = dayNumber(r, nowRoute()), now = curDay(), i, dr = isDoors(r), W = dr ? 'Двери' : 'Спираль';
    var spOpts = [['', W + ' — как сейчас (по дате)'], ['0', W + ' — до начала']];
    for (i = 1; i <= last; i++) spOpts.push([String(i), W + ' — день ' + i + (i === last && !dr ? ' (центр)' : '') + ' · ' + dateOf(r, i)]);
    spOpts.push([String(last + 1), W + ' — все пройдены']);
    var ss = sel(spOpts, S.sim == null ? '' : String(S.sim));
    ss.addEventListener('change', function () { S.sim = ss.value === '' ? null : +ss.value; render(); });
    var zl = el('label', 'ys-debug-chk'), zc = el('input'); zc.type = 'checkbox'; zc.checked = S.zonesOn;
    zc.addEventListener('change', function () { S.zonesOn = zc.checked; render(); });
    zl.appendChild(zc); zl.appendChild(document.createTextNode(dr ? ' Показать контуры дверей' : ' Показать разметку кирпичей'));
    var days = []; for (i = 1; i <= last; i++) days.push([String(i), 'День ' + i + ' · ' + dateOf(r, i)]);
    var sd = sel(days, String(Math.max(1, Math.min(last, now || 1))));
    var sm = sel(MODES.map(function (m) { return [m, MODE_NAMES[m]]; }), S.mode);
    sm.addEventListener('change', function () { S.mode = sm.value; });
    var sp = sel([['code', 'Карта — по коду (колода)']].concat(cardsOf(r).map(function (p, k) { return [String(k), (k + 1) + '. ' + (p.quality || '')]; })), S.code ? 'code' : '0');
    function permSel(d) { return sp.value === 'code' ? cardFor(r, S.code, d) || cardsOf(r)[0] : cardsOf(r)[+sp.value]; }
    function testCode(m) { saveCode(newCode(r, m)); S.mode = m; setUrlMode(m); closeLayer(); render(); note('Код для проверки: ' + S.code.code + ' · ' + MODE_NAMES[m]); }
    var cinfo = S.code ? 'Код: ' + S.code.code + ' · ' + MODE_NAMES[S.code.mode] + ' · вошли с: ' + (statesText(r, S.code) || '—') + ' · перевёрнуты дни: ' + (pickedList().sort(function (a, b) { return a - b; }).join(', ') || 'нет') +
      ' · отметки на диске: ' + (markList(S.code).map(function (m) { return m[0] + ' ' + diskName(r, m[1]).toLowerCase(); }).join(', ') || 'нет') +
      ' · подарки: ' + (giftList(S.code).map(function (g) { return g[0] + ' ' + zoneName(r, GIFT_ZONES[g[1]]).toLowerCase(); }).join(', ') || 'нет') +
      ' · выходят с: ' + (exitList(S.code).map(function (i) { return (statesOf(r)[i] || {}).name; }).join(' · ') || '—') + ' · финал: ' + (finDone() ? 'собран' : 'нет') : 'Кода на этом устройстве нет';
    function needCode() { if (!S.code) note('Сначала нужен код: «Код Путешествия» или «Код Погружения».'); return !!S.code; }
    var z = dayClock(r) === 'local' ? routeTz() : null, wall = nowRoute();
    function p2(v) { return (v < 10 ? '0' : '') + v; }
    var clock = z ? 'Пояс маршрута на этом устройстве: ' + (z.tz || 'UTC' + (z.off > 0 ? '−' : '+') + Math.abs(z.off / 60)) + ' (запомнен при первом входе) · там сейчас ' + p2(wall.getUTCDate()) + '.' + p2(wall.getUTCMonth() + 1) + ' ' + p2(wall.getUTCHours()) + ':' + p2(wall.getUTCMinutes()) : 'Сейчас по Москве';
    var log = doorLog(), ucl = isChoice(r) ? choiceLog() : null, doorsInfo = !dr ? '' : ucl ? 'Выбор дверей (день → дверь): ' + (Object.keys(ucl).sort(function (a, b) { return a - b; }).map(function (k) { var x = doorOfDay(+k, ucl); return k + ' → ' + (x ? x + ((doorsCfg().items[x - 1] || {}).title ? ' «' + doorsCfg().items[x - 1].title + '»' : '') : 'дверь удалена'); }).join(', ') || 'ещё ни одной') :
      'Двери: ' + (Object.keys(log).sort(function (a, b) { return a - b; }).map(function (k) { return k + (log[k] === 'v' ? ' входили' : ' пропущена'); }).join(', ') || 'ещё ни в одну не входили');
    [el('span', null, clock + (S.debugNow ? ' · подмена: ' + S.debugNow : '') + ' · ' + (real === 0 ? 'до начала' : real > last ? 'после конца' : 'день ' + real)),
      ss, zl].concat(dr ? [
      el('span', 'ys-debug-sep', 'Двери'),
      el('span', null, doorsInfo),
      row([btn('Пространство дня', function () { if (S.space) { S.space.remove(); S.space = null; } S.busy = false; if (isChoice(r)) enterDoor(0, true, +sd.value); else enterDoor(+sd.value, true); }), btn('Финальная сцена', function () { var D = doorsCfg(); if (!(D.final && D.final.on)) { note('Финальная сцена выключена: панель → «За дверью» → «Финал».'); return; } S.busy = false; openDoorsFinal(); })]),
      isChoice(r) ? row([btn('Моя фигура — сохранить картинкой', function () { S.busy = false; saveFigure(); })]) : null,
      row([btn('Забыть пояс', function () { resetTz(); render(); note('Пояс забыт: на этом устройстве снова запомнится текущий — ' + (tzHere().tz || 'по часам устройства') + '.'); }),
        btn('Сброс дверей', function () { resetDoors(); S.sim = null; render(); note(isChoice(r) ? 'Сброшено: ни одна дверь не выбрана, следов нет.' : 'Сброшено: ни в одну дверь не входили, сегодняшняя снова зовёт.'); })])] : []).concat([
      el('span', 'ys-debug-sep', 'Финал · ' + wordsOf(r).name),
      // «Карта дня 13» сама ставит спираль на 13-й день (после «Сброса» дата может быть до начала маршрута)
      row([btn('Карта дня 13', function () { closeLayer(); if (FIN) FIN.kill(); if (curDay() !== last) { S.sim = last; render(); } openDay(last, S.mode); }), btn('Финал сразу', function () { var m = musicStart(); closeLayer(); finalScene({ music: m }); })]),
      row([btn('Последний кадр', function () { closeLayer(); finalScene({ instant: true }); }), btn('Сброс', function () { if (FIN) FIN.kill(); resetOpened(); resetPicks(); resetGlass(); resetDoors(); S.sim = null; render(); note(dr ? 'Сброшено: двери по настоящей дате, ни в одну не входили, карты снова закрыты, отметок на диске, подарков и финала нет.' : 'Сброшено: спираль по настоящей дате, сегодняшний кирпич снова зовёт, карты снова закрыты, отметок на диске, подарков и финала нет.'); })]),
      el('span', 'ys-debug-sep', 'Код и колода'),
      el('span', null, cinfo),
      row([btn('Код Путешествия', function () { testCode('journey'); }), btn('Код Погружения', function () { testCode('immersion'); })]),
      row([btn('Ввод ключа', function () { openKey(S.mode === 'observation' ? 'journey' : S.mode); }), btn('Забыть код', function () { resetPicks(); resetGlass(); saveCode(null); closeLayer(); render(); note('Код забыт на этом устройстве.'); })]),
      row([btn('Стёклышко дня', function () {
        if (!needCode()) return;
        if (+sd.value >= last) { note('У дня ' + last + ' своего стёклышка нет — это сам финал (' + wordsOf(r).name + ').'); return; }
        openGlass(+sd.value);
      }), btn('Подарок (тест)', function () { if (needCode()) openKey(S.code.mode, true, makeGift(r, S.code, Math.min(+sd.value, last - 1), Math.floor(Math.random() * 4))); })]),
      el('span', 'ys-debug-sep', 'Формат и карты'),
      sm, sd, sp,
      row([btn('Карта дня', function () { openDay(+sd.value, sm.value); }),
        btn('Личная карта', function () { if (sm.value === 'observation') { note('У Наблюдения личной карты нет — выберите Путешествие или Погружение.'); return; } openPersonal(+sd.value, sm.value, permSel(+sd.value)); })]),
      btn('Выбор карты (круг)', function () {
        if (sm.value === 'observation') { note('У Наблюдения выбора карты нет — выберите Путешествие или Погружение.'); return; }
        if (+sd.value === last) { note('В день ' + last + ' выбора нет — там финал.'); return; }
        if (!S.code) { note('Сначала нужен код: «Код Путешествия» или «Код Погружения».'); return; }
        var l = pickedList().filter(function (x) { return x !== +sd.value; });
        try { localStorage.setItem(pickKey(), JSON.stringify(l)); } catch (e) {}
        openFan(+sd.value, sm.value);
      })
    ]).forEach(function (x) { if (x) body.appendChild(x); });
    box.appendChild(head); box.appendChild(body);
    return box;
  }
  // Формат: Наблюдение — всем; Путешествие и Погружение — по коду (код сам определяет формат). Кода нет — сначала вход по ключу.
  function useRoute(route) {
    if (isDoors(route) && !window.M13D) { loadDoors(function () { useRoute(route); }); return; }
    S.route = route; S.tz = null;
    S.code = loadCode();
    var m = q('mode'), gate = false;
    if (m === 'observation') S.mode = m;
    else if (m === 'journey' || m === 'immersion') { S.mode = S.code ? S.code.mode : m; gate = !S.code; }
    else S.mode = S.code ? S.code.mode : 'observation';
    if (route.title) document.title = '13 MIRRORS · ' + route.title;
    if (FIN) FIN.kill();
    // Предпросмотр из панели: Путешествие без кода — временный код (только в памяти), чтобы увидеть личное
    // (и «Посмотреть финал» — спираль в 13-й день без карты: она сама касается центра)
    if (S.preview && (/^final/.test(q('card') || '') || S.sim === daysCount(route)) && S.mode !== 'observation' && !S.code) { S.code = newCode(route, S.mode); gate = false; }
    // «Посмотреть финал» из панели: центр снова зовёт, как в настоящий 13-й день
    if (S.preview && !q('card') && S.sim === daysCount(route)) try { localStorage.setItem(storeKey(), JSON.stringify(openedList().filter(function (d) { return d !== S.sim; }))); } catch (e) {}
    render();
    var c = q('card'), n = +q('day') || 1, last = daysCount(route);
    if (isDoors(route) && q('door')) { var qd = Math.max(1, Math.min(last, +q('door') || 1)); if (q('door') === 'final') openDoorsFinal(); else if (isChoice(route)) enterDoor(0, true, qd); else enterDoor(qd, true); }
    else if (c === 'final') openDay(last, S.mode);
    else if (c === 'finalnow') { if (isDoors(route)) openDoorsFinal(); else finalScene({ instant: q('instant') === '1' }); }
    else if (c === 'day') openDay(n, S.mode);
    else if (c === 'personal') openPersonal(n, S.mode, q('perm') == null && S.code ? cardFor(route, S.code, n) : cardsOf(route)[+q('perm') || 0]);
    else if (c === 'fan' && S.code) openFan(n, S.mode);
    else if (q('gift') && S.code) openKey(S.code.mode, true, q('gift'));
    // Двери, сначала Карта дня: ключ не нужен, чтобы войти, — без кода человек в Наблюдении, ключ — на Карте дня
    else if (gate && doorsCard(route)) { S.mode = 'observation'; render(); }
    else if (gate) openKey(m);
    // После конца маршрута страница открывается сразу на последнем кадре финала
    else if (curDay() > last && !isDoors(route)) finalScene({ instant: true });
    if (q('gift') && !S.code) setTimeout(function () { note((route.texts || {}).giftNeed || 'Чтобы положить подарок в узор, сначала войдите своим кодом.'); }, 600);
  }
  // Сцена «Двери» — отдельный файл, грузится только у маршрутов с дверями
  // Вместе со стилями сцены (assets/doors.css): маршрут рисуется, когда пришло и то и другое (иначе слои на миг видны без стилей)
  function loadDoors(done) {
    var base = (S.base || '../../') + 'assets/doors.', v = '?v=' + (window.M13RV || ''), left = 2;
    function one() { if (!--left) done(); }
    function fail() { var app = document.getElementById('ys'); if (app) app.replaceChildren(el('p', 'ys-err', 'Не удалось загрузить маршрут. Обновите страницу через минуту.')); }
    var ln = document.createElement('link'); ln.rel = 'stylesheet'; ln.href = base + 'css' + v; ln.onload = one; ln.onerror = one;
    var sc = document.createElement('script'); sc.src = base + 'js' + v; sc.onload = one; sc.onerror = fail;
    document.head.appendChild(ln); document.head.appendChild(sc);
  }
  function boot() {
    var app = document.getElementById('ys'); if (!app) return;
    S.base = app.getAttribute('data-base') || '../../';
    S.debug = q('debug') === '1'; S.debugNow = q('debugNow'); S.preview = q('preview') === '1';
    var sim = q('sim'); if (sim != null && sim !== '' && !isNaN(+sim)) S.sim = +sim;
    S.zonesOn = q('zones') === '1';
    var id = app.getAttribute('data-route');
    // Предпросмотр из панели: черновик приходит сообщением (как у Гримуара)
    if (S.preview) {
      window.addEventListener('message', function (e) {
        if (e.origin !== location.origin || !e.data || !e.data.m13journey) return;
        S.base = e.data.base || S.base; if (e.data.logo) S.logo = e.data.logo;
        closeLayer(); useRoute(e.data.m13journey);
      });
      try { window.parent.postMessage({ m13journeyReady: true }, location.origin); } catch (e) {}
      return;
    }
    // Общий логотип витрины (финал): тихо, без него — обычный
    getJSON(S.base + 'data/settings.json').then(function (st) { if (st && st.logo) S.logo = { src: st.logo, ratio: st.logoRatio }; }, function () {});
    getJSON(S.base + 'data/journeys.json').then(function (j) {
      var route = (j.items || []).filter(function (x) { return x.id === id; })[0];
      if (!route) throw new Error();
      useRoute(route);
    }).catch(function () {
      app.replaceChildren(el('p', 'ys-err', 'Не удалось загрузить маршрут. Обновите страницу через минуту.'));
    });
  }

  window.M13R = { howto: howtoBoot, howtoNode: howtoNode, howtoOf: howtoOf, howtoUrl: howtoUrl, reviewOf: reviewOf, reviewTg: reviewTg, reviewText: reviewText,
    putText: putText, isDoors: isDoors, dayClock: dayClock, card: card, fill: fill, ctxOf: ctxOf, tokens: tokens, wordsOf: wordsOf, defText: defText, dateOf: dateOf, dayNumber: dayNumber, nowMsk: nowMsk,
    spiralSVG: spiralSVG, MODES: MODES, MODE_NAMES: MODE_NAMES, boot: boot,
    trace: trace, bricksLayer: bricksLayer, lights: lights, dayColor: dayColor, sealColor: sealColor, glowPower: glowPower, sparkPower: sparkPower, sparkSpeed: sparkSpeed, PATH_DAYS: PATH_DAYS, SPAN: SPAN, finalScene: finalScene, datesText: datesText,
    untag: untag, lineAlign: lineAlign, readCode: readCode, makeCode: makeCode, newCode: newCode, deckOf: deckOf, cardFor: cardFor, cardsOf: cardsOf, keyNorm: keyNorm,
    kaleido: Kaleido, kalSeed: kalSeed, kalEx: kalEx, kalShow: kalShow, kalStyle: kalStyle, kalLook: kalLook, routeSeed: routeSeed, statesOf: statesOf, statesText: statesText,
    wheelNode: wheelNode, zoneName: zoneName, diskNode: diskNode, DISK_ZONES: DISK_ZONES, DISK_DEF: DISK_DEF, DISK_FAMILY: DISK_FAMILY, DISK_AREAS_DEF: DISK_AREAS_DEF, ovalOf: ovalOf, ovalFix: ovalFix, ovalPt: ovalPt, ovalAreas: ovalAreas, spiralPts: spiralPts, OVAL_DEF: OVAL_DEF,
    diskName: diskName, diskAreas: diskAreas, diskPlaceholder: diskPlaceholder, diskHit: diskHit, diskMarked: diskMarked, diskWord: diskWord, markGlass: markGlass, CARD_TOKENS: CARD_TOKENS, spiralButton: gatherButton, plantsLayer: plantsLayer, PLANTS: PLANTS, PLANT_FIGS: PLANT_FIGS,
    GIFT_ZONES: GIFT_ZONES, GLASS_DEF: GLASS_DEF, hexRgb: hexRgb, glassLook: glassLook, dayGlass: dayGlass, giftGlass: giftGlass, glassDaysOf: glassDaysOf, makeGift: makeGift, readGift: readGift };
})();
