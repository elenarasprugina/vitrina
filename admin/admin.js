/* 13 MIRRORS · Панель управления (этап 2: сохранение в этом браузере + предпросмотр).
   Подключение к GitHub (сохранение в приватный репозиторий и публикация) — этап 3. */
(function () {
  'use strict';

  var KEY = 'm13-admin-draft-v1';
  var MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  // Оборот карточки собирается из блоков. У каждого блока — переключатель «видно/скрыто» и стрелки ↑↓.
  var BLOCKS = [
    ['heading', 'Заголовок на обороте'], ['desc', 'Описание'], ['more', 'Подробнее ↓ (раскрывающийся текст)'], ['facts', 'Факты (маленькие плашки: 90 минут · онлайн…)'],
    ['images', 'Картинки'], ['price', 'Цена'],
    ['day', '«Сегодня день N из M»'], ['routeButton', 'Большая кнопка-ссылка («Пройти маршрут»)'], ['formats', 'Форматы участия'],
    ['items', 'Плашки (встречи, варианты, виды работы)'], ['dates', 'Даты с подписью'], ['info', 'Дополнительно (состав, пояснение)'],
    ['examples', 'Кнопка «Примеры»'], ['actions', 'Кнопки (до 4): написать, ссылка, календарь, поделиться…'], ['sandbox', 'Кнопка «Как устроены маршруты»']
  ];
  var BLOCK_NAMES = {}; BLOCKS.forEach(function (x) { BLOCK_NAMES[x[0]] = x[1]; });
  var PRESETS = [['route', 'Маршрут'], ['list', 'Встречи или услуги (плашки)'], ['product', 'Продукт'], ['simple', 'Текст и кнопка']];

  var DATA = null, ORIGINAL = null, dirty = false, savedAt = null;
  var ST = { section: 'showcases', showcase: null, card: 0, mobileForm: false, sbTab: 'days', openRoute: null };
  var OPENED = new WeakSet(), CONFIRM = new WeakSet();
  var APP;

  /* ---------- Помощники ---------- */
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function uid(p) { return (p || 'x') + '-' + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else if (k === 'value') n.value = v;
      else if (k === 'checked') n.checked = !!v;
      else if (k === 'style') n.style.cssText = v;
      else n.setAttribute(k, v === true ? '' : v);
    });
    add(n, kids);
    return n;
  }
  function add(n, kids) {
    if (kids == null) return n;
    (Array.isArray(kids) ? kids : [kids]).forEach(function (k) {
      if (k == null || k === false) return;
      if (Array.isArray(k)) return add(n, k);
      n.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
    });
    return n;
  }
  function optVal(f) { return f && typeof f === 'object' ? (f.show === false ? '' : (f.value || '')) : (f || ''); }
  function routes() { return DATA.routes.routes; }
  function routeById(id) { return routes().filter(function (r) { return r.id === id; })[0] || null; }
  function fmtDates(d) {
    if (!d || !d.from) return '';
    var f = d.from.split('-'), t = (d.to || '').split('-');
    return f[2] + '.' + f[1] + (t.length === 3 ? '–' + t[2] + '.' + t[1] : '');
  }

  var toastTimer;
  function toast(msg, isErr) {
    var t = document.getElementById('a-toast');
    t.textContent = msg; t.classList.toggle('is-err', !!isErr); t.classList.add('is-on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, isErr ? 6500 : 3800);
  }

  /* ---------- Сохранение ---------- */
  function changed() { if (!dirty) { dirty = true; updateState(); } }
  function updateState() {
    var s = document.getElementById('a-state'), b = document.getElementById('a-save');
    if (!s) return;
    if (dirty) { s.textContent = 'Есть несохранённые изменения'; s.classList.add('is-dirty'); }
    else {
      s.classList.remove('is-dirty');
      var fmt = function (d) { return new Date(d).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); };
      s.textContent = GHS.user && GHS.contentTime ? 'Сохранено в GitHub · ' + fmt(GHS.contentTime)
        : savedAt ? 'Сохранено в этом браузере · ' + fmt(savedAt) : 'Изменений нет';
    }
    b.disabled = !dirty;
  }
  function syncIndex() {
    DATA.index = DATA.index || {};
    DATA.index.showcases = Object.keys(DATA.showcases).sort().map(function (id) {
      var s = DATA.showcases[id];
      return { id: s.id, title: s.title, status: s.status, basedOn: s.basedOn || null };
    });
  }
  function save() {
    syncIndex();
    var t = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify({ savedAt: t, data: DATA }));
    } catch (e) {
      toast('Не получилось сохранить: в браузере не хватает места. Скорее всего, слишком много больших картинок — уберите одну-две и попробуйте снова.', true);
      return;
    }
    savedAt = t; dirty = false; updateState();
    if (GHS.token) saveToGitHub();
    else toast('Сохранено в этом браузере. Чтобы черновик был доступен с других устройств и его можно было опубликовать — войдите в GitHub.');
  }

  /* ---------- Загрузка ---------- */
  function getJSON(u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); }); }
  function loadSource() {
    if (window.M13_DATA) return Promise.resolve(clone(window.M13_DATA));
    var d = '../data/';
    return Promise.all(['settings', 'routes', 'formats', 'sandbox', 'reflection'].map(function (n) { return getJSON(d + n + '.json'); }))
      .then(function (r) {
        var out = { settings: r[0], routes: r[1], formats: r[2], sandbox: r[3], reflection: r[4], showcases: {} };
        return getJSON(d + 'showcases/index.json').then(function (idx) {
          out.index = idx;
          return Promise.all(idx.showcases.map(function (s) {
            return getJSON(d + 'showcases/' + s.id + '.json').then(function (sc) { out.showcases[s.id] = sc; });
          }));
        }).then(function () { return out; });
      });
  }

  /* ---------- Поля ---------- */
  function field(label, input, hint, warn) {
    return el('label', { class: 'a-field' }, [
      label ? el('span', { class: 'a-label', text: label }) : null, input,
      hint ? el('span', { class: 'a-hint' + (warn ? ' a-hint--warn' : ''), text: hint }) : null
    ]);
  }
  function textIn(obj, key, label, o) {
    o = o || {};
    var i = el(o.multi ? 'textarea' : 'input', { class: 'a-input', type: o.multi ? null : (o.type || 'text'), placeholder: o.ph || '', rows: o.multi ? (o.rows || 3) : null });
    i.value = obj[key] == null ? '' : obj[key];
    i.addEventListener('input', function () {
      obj[key] = o.type === 'number' ? (i.value === '' ? null : Number(i.value)) : i.value;
      changed(); if (o.onInput) o.onInput(i.value);
    });
    return field(label, i, o.hint);
  }
  function optIn(obj, key, label, o) {
    o = o || {};
    var f = obj[key];
    if (!f || typeof f !== 'object') f = obj[key] = { value: f == null ? '' : String(f), show: f != null && f !== '' };
    var i = el(o.multi ? 'textarea' : 'input', { class: 'a-input', placeholder: o.ph || '', rows: o.multi ? (o.rows || 3) : null });
    i.value = f.value || '';
    i.addEventListener('input', function () { f.value = i.value; changed(); });
    var wrap = el('div', { class: 'a-field a-opt' + (f.show ? '' : ' is-off') });
    var cb = el('input', { type: 'checkbox', checked: !!f.show });
    cb.addEventListener('change', function () { f.show = cb.checked; wrap.classList.toggle('is-off', !cb.checked); changed(); });
    return add(wrap, [
      el('div', { class: 'a-opt-head' }, [el('span', { class: 'a-label', text: label }), el('label', { class: 'a-mini-switch' }, [cb, el('span', { text: 'показывать' })])]),
      i, o.hint ? el('span', { class: 'a-hint', text: o.hint }) : null
    ]);
  }
  // Переключатель. o.defTrue — если поля нет, считать «включено» (как visible).
  function switchIn(obj, key, label, o) {
    o = o || {};
    var cb = el('input', { type: 'checkbox', checked: o.defTrue ? obj[key] !== false : !!obj[key] });
    cb.addEventListener('change', function () { obj[key] = cb.checked; changed(); if (o.onChange) o.onChange(cb.checked); });
    return el('label', { class: 'a-switch' }, [cb, el('span', { class: 'a-switch-ui' }),
      el('span', { class: 'a-switch-text' }, [label, o.hint ? el('small', { text: o.hint }) : null])]);
  }
  // Ползунок с подписью значения: o.min, o.max, o.step, o.unit
  function rangeIn(obj, key, label, o) {
    o = o || {};
    var v = obj[key] == null || obj[key] === '' ? (o.def || 0) : +obj[key];
    var out = el('span', { class: 'a-range-val', text: v + (o.unit || '') });
    var r = el('input', { type: 'range', class: 'a-range', min: o.min || 0, max: o.max || 100, step: o.step || 1, value: v });
    r.addEventListener('input', function () { obj[key] = +r.value; out.textContent = r.value + (o.unit || ''); changed(); if (o.onChange) o.onChange(+r.value); });
    return field(label, el('div', { class: 'a-range-row' }, [r, out]), o.hint);
  }
  function selectIn(obj, key, label, options, o) {
    o = o || {};
    var s = el('select', { class: 'a-input' }, options.map(function (op) { return el('option', { value: op[0], text: op[1] }); }));
    s.value = obj[key] == null ? (o.def || options[0][0]) : obj[key];
    s.addEventListener('change', function () { obj[key] = s.value; changed(); if (o.onChange) o.onChange(s.value); });
    return field(label, s, o.hint);
  }
  function colorIn(obj, key, label) {
    var c = el('input', { type: 'color' }), t = el('input', { class: 'a-input', style: 'max-width:120px' });
    c.value = obj[key] || '#f2f2f2'; t.value = obj[key] || '';
    c.addEventListener('input', function () { obj[key] = c.value; t.value = c.value; changed(); });
    t.addEventListener('input', function () { obj[key] = t.value; if (/^#[0-9a-f]{6}$/i.test(t.value)) c.value = t.value; changed(); });
    return field(label, el('div', { class: 'a-color' }, [c, t]));
  }
  function colorOptIn(obj, key, label, o) {
    o = o || {};
    var box = el('div', { class: 'a-field' });
    function draw() {
      var v = obj[key] || '';
      var c = el('input', { type: 'color' }); c.value = /^#[0-9a-f]{6}$/i.test(v) ? v : (o.pick || '#ffffff');
      c.addEventListener('input', function () { obj[key] = c.value; changed(); draw(); if (o.onChange) o.onChange(); });
      box.replaceChildren();
      add(box, [el('span', { class: 'a-label', text: label }),
        el('div', { class: 'a-color' }, [c,
          el('span', { class: 'a-hint', text: v ? v : (o.none || 'по умолчанию') }),
          v ? el('button', { type: 'button', class: 'a-btn a-btn--small a-btn--ghost', text: 'Сбросить', onclick: function () {
            obj[key] = ''; changed(); draw(); if (o.onChange) o.onChange(); } }) : null]),
        o.hint ? el('span', { class: 'a-hint', text: o.hint }) : null]);
    }
    draw();
    return box;
  }
  function fontOptions(inherit) {
    var list = [[ '', inherit ? 'Как у всей витрины' : 'Обычный (как сейчас)' ]];
    return list.concat((window.M13.FONTS || []).map(function (f) { return [f, f]; }));
  }
  // Поля оформления. forCard — для одной карточки (с вариантом «как у всей витрины»).
  function styleFields(stl, forCard, onChange) {
    var inh = forCard ? [['inherit', 'Как у всей витрины']] : [];
    var fontSel = selectIn(stl, 'font', 'Шрифт', fontOptions(forCard), { onChange: function (v) { window.M13.ensureFont(v); preview(); onChange && onChange(); } });
    var sample = el('div', { class: 'a-font-sample', text: 'Синяя Рука · Карта-Отражение · 3 000 ₽' });
    function preview() { var f = stl.font; if (f) window.M13.ensureFont(f); sample.style.fontFamily = f ? "'" + f + "',Georgia,serif" : ''; }
    preview();
    return [
      el('div', { class: 'a-row' }, [el('div', { class: 'a-field' }, [fontSel, sample]),
        colorOptIn(stl, 'textColor', 'Цвет текста', { none: forCard ? 'как у всей витрины' : 'обычный тёмный', pick: '#ffffff', onChange: onChange })]),
      el('div', { class: 'a-row' }, [
        selectIn(stl, 'overlay', 'Дымка поверх картинки (чтобы текст читался)', inh.concat([['light', 'Светлая дымка — для тёмного текста'], ['dark', 'Тёмная дымка — для светлого текста'], ['none', 'Без дымки — картинка как есть']]),
          { def: forCard ? 'inherit' : 'light' }),
        colorOptIn(stl, 'bg', 'Цвет карточки (когда нет картинки)', { none: forCard ? 'как у всей витрины' : 'белый', onChange: onChange })]),
      el('div', { class: 'a-row' }, [
        selectIn(stl, 'textPos', 'Где текст на лицевой стороне', inh.concat([['top', 'Сверху'], ['center', 'По центру'], ['bottom', 'Снизу']]),
          { def: forCard ? 'inherit' : 'top', onChange: onChange, hint: 'Выбирайте по картинке: чтобы текст не закрывал главное.' }),
        selectIn(stl, 'textAlign', 'Выравнивание текста', inh.concat([['left', 'По левому краю'], ['center', 'По центру'], ['right', 'По правому краю']]),
          { def: forCard ? 'inherit' : 'left', onChange: onChange })]),
      el('div', { class: 'a-row' }, [
        selectIn(stl, 'titleSize', 'Размер названия', inh.concat([['sm', 'Меньше'], ['md', 'Обычный'], ['lg', 'Крупнее']]),
          { def: forCard ? 'inherit' : 'md', onChange: onChange }),
        selectIn(stl, 'smallSize', 'Размер мелких надписей', inh.concat([['md', 'Обычный'], ['lg', 'Крупнее'], ['xl', 'Ещё крупнее']]),
          { def: forCard ? 'inherit' : 'md', onChange: onChange,
            hint: 'Тип, даты, «Вход открыт», «открыть», «Нажать — открыть оборот». На телефоне увеличиваются мягче — там мало места.' })]),
      el('div', { class: 'a-row' }, [
        colorOptIn(stl, 'accent', 'Акцентный цвет', { none: forCard ? 'как у всей витрины' : 'без акцента', pick: '#8a6bb8', onChange: onChange }),
        el('p', { class: 'a-hint', style: 'align-self:end', text: 'Красит рамку карточки, главную кнопку, счётчик дня и статус-плашку. Если цвет свечения не выбран — светится этим цветом.' })]),
      el('div', { class: 'a-row' }, [
        selectIn(stl, 'glow', 'Свечение', inh.concat([['off', 'Без свечения'], ['soft', 'Ровное свечение'], ['live', 'Живое (мягко пульсирует)']]),
          { def: forCard ? 'inherit' : 'off', onChange: onChange }),
        colorOptIn(stl, 'glowColor', 'Цвет свечения', { none: forCard ? 'как у всей витрины' : 'золотистый', pick: '#e8c77a', onChange: onChange })]),
      el('div', { class: 'a-row' }, [
        selectIn(stl, 'glowStrength', 'Сила свечения', inh.concat([['weak', 'Слабое'], ['medium', 'Среднее'], ['strong', 'Сильное']]),
          { def: forCard ? 'inherit' : 'medium', onChange: onChange }),
        selectIn(stl, 'glowDir', 'Откуда идёт свет', inh.concat([['around', 'Вокруг всей карточки'], ['bottom', 'Снизу'], ['top', 'Сверху']]),
          { def: forCard ? 'inherit' : 'around', onChange: onChange })]),
      glassFields(stl, forCard, onChange),
      buttonFields(stl, forCard, onChange),
      el('p', { class: 'a-hint', text: forCard
        ? 'Совет: свечение лучше всего работает, когда светятся одна-две карточки — например, центральная и ещё одна, на которую хочется обратить внимание.'
        : 'Совет: обычно для всей витрины свечение лучше выключить, а включить только у центральной карточки и одной акцентной — в их формах, раздел «Оформление».' })
    ];
  }

  // Ползунок у отдельной карточки: «как у всей витрины» или своё значение
  function rangeOptIn(obj, key, label, o, forCard) {
    if (!forCard) return rangeIn(obj, key, label, o);
    var box = el('div', { class: 'a-field' });
    function draw() {
      var own = obj[key] != null && obj[key] !== '';
      var cb = el('input', { type: 'checkbox', checked: own });
      cb.addEventListener('change', function () {
        if (cb.checked) obj[key] = o.def || 0; else delete obj[key];
        changed(); if (o.onChange) o.onChange(); draw();
      });
      box.replaceChildren();
      add(box, [el('div', { class: 'a-opt-head' }, [el('span', { class: 'a-label', text: label }), el('label', { class: 'a-mini-switch' }, [cb, el('span', { text: 'своё' })])]),
        own ? rangeIn(obj, key, '', o) : el('span', { class: 'a-hint', text: 'Как у всей витрины.' })]);
    }
    draw();
    return box;
  }
  // «Стекло и узор»: прозрачность, размытие, кромка, узор, помощь тексту, цвет оборота
  function glassFields(stl, forCard, onChange) {
    var inh = forCard ? [['inherit', 'Как у всей витрины']] : [];
    var box = el('div', { class: 'a-glass' });
    function redraw() { if (onChange) onChange(); draw(); }
    function draw() {
      var pat = stl.pattern && stl.pattern !== 'inherit' ? stl.pattern : '';
      box.replaceChildren();
      add(box, [
        sub('Стекло и узор'),
        el('div', { class: 'a-row' }, [
          rangeOptIn(stl, 'glass', 'Прозрачность карточек («зеркала»)', { max: 100, step: 5, unit: '%', def: 60, onChange: onChange,
            hint: '0% — сплошной цвет. 60–90% — сквозь карточку видна картинка фона. 100% — только стекло. Работает у карточек без своей картинки.' }, forCard),
          rangeOptIn(stl, 'glassBlur', 'Размытие за карточкой', { max: 20, step: 1, unit: ' px', def: 10, onChange: onChange,
            hint: '0 — картинка за карточкой чёткая. 2–4 — матовое стекло. 10 — сильно размыто.' }, forCard)]),
        el('div', { class: 'a-row' }, [
          selectIn(stl, 'rim', 'Кромка стекла', inh.concat([['none', 'Без кромки'], ['light', 'Светлая'], ['cold', 'Холодная (зимняя)'], ['gold', 'Золотая — акцентным цветом']]),
            { def: forCard ? 'inherit' : 'none', onChange: onChange, hint: 'Тонкая линия с бликом по краю карточки.' }),
          selectIn(stl, 'textHelp', 'Чтобы текст читался', inh.concat([['none', 'Ничего не добавлять'], ['shadow', 'Тень у букв'], ['shade', 'Мягкое затемнение там, где текст']]),
            { def: forCard ? 'inherit' : 'none', onChange: onChange, hint: 'Пригодится, когда за прозрачной карточкой яркая картинка.' })]),
        el('div', { class: 'a-row' }, [
          selectIn(stl, 'pattern', 'Узор на стекле', inh.concat([['none', 'Без узора'], ['frost', 'Иней'], ['sparks', 'Искры'], ['kaleido', 'Калейдоскоп'], ['custom', 'Свой узор (загрузить картинку)']]),
            { def: forCard ? 'inherit' : 'none', onChange: redraw }),
          selectIn(stl, 'patternPlace', 'Где узор', inh.concat([['corners', 'В уголках'], ['edge', 'По краю — во всех углах'], ['full', 'По всей карточке']]),
            { def: forCard ? 'inherit' : 'corners', onChange: onChange })]),
        pat === 'custom' ? imageIn(stl, 'patternImage', 'Картинка узора', { max: 1200, onChange: onChange,
          hint: 'Лучше PNG с прозрачным фоном. Для «В уголках» и «По краю» — уголок для левого верхнего угла (для остальных углов он отразится сам). Для «По всей карточке» — узор или рамка на всю карточку.' }) : null,
        pat && pat !== 'none' ? el('div', { class: 'a-row' }, [
          rangeOptIn(stl, 'patternOpacity', 'Заметность узора', { min: 5, max: 100, step: 5, unit: '%', def: 80, onChange: onChange }, forCard),
          pat === 'custom' ? el('p', { class: 'a-hint', style: 'align-self:end', text: 'Свой узор показывается в своих цветах.' })
            : colorOptIn(stl, 'patternColor', 'Цвет узора', { none: 'иней — белый, остальные — акцентный', pick: '#eef6ff', onChange: onChange })]) : null,
        el('div', { class: 'a-row' }, [
          colorOptIn(stl, 'backBg', 'Цвет оборота карточки', { none: forCard ? 'как у всей витрины' : 'светлый', pick: '#15110c', onChange: onChange }),
          el('p', { class: 'a-hint', style: 'align-self:end', text: 'Узор и кромка появляются и на обороте открытой карточки.' })])
      ]);
    }
    draw();
    return box;
  }

  // «Кнопки на обороте»: вид главной кнопки, цвета, остальные кнопки, «живость», готовые наборы
  var BTN_KEYS = ['btnStyle', 'btnColor', 'btnColor2', 'btnDir', 'btnInk', 'btnOther', 'btnOtherColor', 'btnLive'];
  var BTN_PRESETS = [
    ['✨ Золото', { btnStyle: 'gradient', btnColor: '#f8e7bf', btnColor2: '#c49a5a', btnDir: 'diag', btnLive: 'glint' }],
    ['🌹 Розовое золото', { btnStyle: 'gradient', btnColor: '#f6dcd2', btnColor2: '#b8877a', btnDir: 'diag', btnLive: 'glint' }],
    ['❄️ Зимнее серебро', { btnStyle: 'gradient', btnColor: '#ffffff', btnColor2: '#a9bdd2', btnDir: 'diag', btnLive: 'glint' }],
    ['🪞 Стекло', { btnStyle: 'glass', btnColor: '#ecd3a3', btnLive: 'glint' }],
    ['🐚 Перламутр', { btnStyle: 'gradient', btnColor: '#fbe9f1', btnColor2: '#c9def3', btnDir: 'diag', btnLive: 'both' }],
    ['🌅 Закат', { btnStyle: 'gradient', btnColor: '#f7c46c', btnColor2: '#d9607e', btnDir: 'h', btnLive: 'both' }],
    ['🌌 Северное сияние', { btnStyle: 'gradient', btnColor: '#62e0bd', btnColor2: '#8a6bd8', btnDir: 'h', btnLive: 'both' }],
    ['🔥 Янтарь', { btnStyle: 'gradient', btnColor: '#ffd27a', btnColor2: '#c2571a', btnDir: 'v', btnLive: 'both' }]
  ];
  function buttonFields(stl, forCard, onChange) {
    var inh = forCard ? [['inherit', 'Как у всей витрины']] : [];
    var box = el('div', { class: 'a-glass' });
    function redraw() { if (onChange) onChange(); draw(); }
    function preset(p) {
      BTN_KEYS.forEach(function (k) { delete stl[k]; });
      if (p) Object.keys(p).forEach(function (k) { stl[k] = p[k]; });
      changed(); redraw();
    }
    function draw() {
      var bs = stl.btnStyle && stl.btnStyle !== 'inherit' ? stl.btnStyle : '';
      var on = bs && bs !== 'none';
      box.replaceChildren();
      add(box, [
        sub('Кнопки на обороте'),
        el('p', { class: 'a-hint', text: 'Готовые наборы — одним нажатием, потом можно подправить. «Как по акцентному цвету» — вернуть как было.' }),
        el('div', { class: 'a-presets' }, BTN_PRESETS.map(function (p) {
          return el('button', { type: 'button', class: 'a-btn a-btn--small a-preset', style: '--p1:' + (p[1].btnColor || '#ecd3a3') + ';--p2:' + (p[1].btnColor2 || p[1].btnColor || '#ecd3a3'), text: p[0], onclick: function () { preset(p[1]); } });
        }).concat([el('button', { type: 'button', class: 'a-btn a-btn--small a-btn--ghost', text: forCard ? 'Как у всей витрины' : 'Как по акцентному цвету', onclick: function () { preset(null); } })])),
        el('div', { class: 'a-row' }, [
          selectIn(stl, 'btnStyle', 'Вид главной кнопки', inh.concat([['none', 'Как по акцентному цвету'], ['fill', 'Заливка — один цвет'], ['gradient', 'Градиент — два цвета'], ['glass', 'Стекло — прозрачная с кромкой'], ['outline', 'Контур — только рамка']]),
            { def: forCard ? 'inherit' : 'none', onChange: redraw, hint: 'Главная — первая кнопка в ряду.' }),
          on ? selectIn(stl, 'btnLive', 'Живость', inh.concat([['none', 'Спокойная'], ['glint', 'Блик пробегает по кнопке'], ['flow', 'Цвета переливаются (для градиента)'], ['both', 'Блик и перелив']]),
            { def: forCard ? 'inherit' : 'none', onChange: onChange }) : el('span')]),
        on ? el('div', { class: 'a-row' }, [
          colorOptIn(stl, 'btnColor', bs === 'gradient' ? 'Первый цвет' : 'Цвет кнопки', { none: 'акцентный', pick: '#ecd3a3', onChange: onChange }),
          bs === 'gradient' ? colorOptIn(stl, 'btnColor2', 'Второй цвет', { none: 'как первый', pick: '#c49a5a', onChange: onChange })
            : colorOptIn(stl, 'btnInk', 'Цвет надписи', { none: 'подберётся сам', pick: '#1c150c', onChange: onChange })]) : null,
        on && bs === 'gradient' ? el('div', { class: 'a-row' }, [
          selectIn(stl, 'btnDir', 'Направление градиента', inh.concat([['h', 'Слева направо'], ['diag', 'По диагонали'], ['v', 'Сверху вниз']]),
            { def: forCard ? 'inherit' : 'diag', onChange: onChange }),
          colorOptIn(stl, 'btnInk', 'Цвет надписи', { none: 'подберётся сам', pick: '#1c150c', onChange: onChange })]) : null,
        el('div', { class: 'a-row' }, [
          on ? selectIn(stl, 'btnOther', 'Остальные кнопки', inh.concat([['outline', 'Прозрачные с рамкой'], ['same', 'Такие же, как главная']]),
            { def: forCard ? 'inherit' : 'outline', onChange: onChange }) : el('span'),
          colorOptIn(stl, 'btnOtherColor', 'Цвет рамки и надписи остальных кнопок', { none: 'обычный', pick: '#ecd3a3', onChange: onChange })])
      ]);
    }
    draw();
    return box;
  }

  // crop: [ширина, высота] — обрезать по центру ровно под этот размер и сохранить в JPEG
  // (так нужно для превью ссылок: Telegram и VK надёжно понимают только JPEG/PNG).
  function compressImage(file, max, crop) {
    max = max || 1600;
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var iw = img.naturalWidth, ih = img.naturalHeight, c = document.createElement('canvas');
        if (crop) {
          var k2 = Math.max(crop[0] / iw, crop[1] / ih), sw = crop[0] / k2, sh = crop[1] / k2;
          c.width = crop[0]; c.height = crop[1];
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, crop[0], crop[1]);
          g.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, crop[0], crop[1]);
          URL.revokeObjectURL(url); return res(c.toDataURL('image/jpeg', 0.86));
        }
        var w = iw, h = ih, k = Math.min(1, max / Math.max(w, h));
        w = Math.round(w * k); h = Math.round(h * k);
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        var d = c.toDataURL('image/webp', 0.82);
        if (d.indexOf('data:image/webp') !== 0) d = c.toDataURL('image/jpeg', 0.85);
        URL.revokeObjectURL(url); res(d);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('bad')); };
      img.src = url;
    });
  }
  function imgSrc(v) { if (!v) return ''; return /^(data:|blob:|https?:)/.test(v) ? v : '../' + v; }
  function imageIn(obj, key, label, o) {
    o = o || {};
    var box = el('div', { class: 'a-field' });
    function draw() {
      var v = obj[key];
      var file = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
      file.addEventListener('change', function () {
        var f = file.files && file.files[0]; if (!f) return;
        compressImage(f, o.max, o.crop).then(function (d) { obj[key] = d; changed(); draw(); if (o.onChange) o.onChange(); })
          .catch(function () { toast('Не получилось открыть эту картинку. Попробуйте файл JPG или PNG.', true); });
      });
      box.replaceChildren();
      add(box, [label ? el('span', { class: 'a-label', text: label }) : null,
        el('div', { class: 'a-img' }, [
          el('div', { class: 'a-img-thumb' + (o.crop ? ' a-img-thumb--wide' : ''), style: v ? "background-image:url('" + imgSrc(v) + "')" : null, text: v ? '' : 'нет' }),
          el('button', { type: 'button', class: 'a-btn a-btn--small', text: v ? 'Заменить картинку' : 'Загрузить картинку', onclick: function () { file.click(); } }),
          v ? el('button', { type: 'button', class: 'a-btn a-btn--small a-btn--ghost', text: 'Убрать', onclick: function () { obj[key] = null; changed(); draw(); if (o.onChange) o.onChange(); } }) : null,
          file]),
        o.hint ? el('span', { class: 'a-hint', text: o.hint }) : null]);
    }
    draw();
    return box;
  }
  // Действие кнопки. o.kinds — какие типы можно выбрать (по умолчанию «написать» и «ссылка»).
  var ACTION_KINDS = [
    ['contact', 'Написать — окно «Telegram или VK»', 'Написать'], ['link', 'Открыть страницу (ссылку)', 'Подробнее'],
    ['examples', 'Примеры — страница Карт-Отражений', 'Примеры'], ['sandbox', 'Как устроено — Песочница', 'Как устроены маршруты'],
    ['calendar', 'Добавить в календарь', 'Добавить в календарь'], ['share', 'Поделиться ссылкой на карточку', 'Поделиться'],
    ['download', 'Скачать файл', 'Скачать']
  ];
  function kindOf(a) { return a.kind === 'internal' ? (a.target === 'sandbox' ? 'sandbox' : 'examples') : (a.kind || 'contact'); }
  function defLabel(k) { return (ACTION_KINDS.filter(function (x) { return x[0] === k; })[0] || [])[2] || 'Написать'; }
  function calFields(cal, o) {
    o = o || {};
    var warn = el('p', { class: 'a-hint a-hint--warn', text: 'Укажите дату — без неё кнопка не появится. После окончания события кнопка пропадёт сама.' });
    function upd() { warn.style.display = cal.date ? 'none' : ''; }
    upd();
    return [
      el('div', { class: 'a-row3', oninput: upd, onchange: upd }, [
        textIn(cal, 'date', 'Дата', { type: 'date' }),
        textIn(cal, 'time', 'Время (по Москве)', { type: 'time', hint: 'Пусто — событие на весь день.' }),
        textIn(cal, 'duration', 'Длится, минут', { type: 'number', ph: '60' })]),
      textIn(cal, 'title', 'Название события', { ph: o.titlePh || 'Пусто — название карточки или плашки' }),
      textIn(cal, 'place', 'Где', { ph: 'Онлайн, Zoom, адрес…', hint: 'Без ссылок на конференцию — их лучше прислать лично.' }),
      textIn(cal, 'details', 'Описание в календаре', { multi: true, rows: 2, ph: 'Необязательно' }),
      warn
    ];
  }
  function actionIn(obj, key, title, o) {
    o = o || {};
    if (!obj[key]) obj[key] = { kind: 'contact', label: o.defLabel || 'Написать' };
    var a = obj[key];
    var kinds = ACTION_KINDS.filter(function (x) { return (o.kinds || ['contact', 'link']).indexOf(x[0]) >= 0; });
    var box = el('div', { class: 'a-action' });
    var ui = { k: kindOf(a) };
    function draw() {
      var k = ui.k;
      box.replaceChildren();
      add(box, [
        title ? el('div', { class: 'a-action-title', text: title }) : null,
        o.noLabel ? null : textIn(a, 'label', 'Текст на кнопке', { ph: defLabel(k) }),
        kinds.length > 1 ? selectIn(ui, 'k', 'Что происходит при нажатии', kinds.map(function (x) { return [x[0], x[1]]; }), { onChange: function (v) {
          var old = kindOf(a);
          if (!a.label || a.label === defLabel(old)) a.label = defLabel(v);
          delete a.target;
          if (v === 'examples' || v === 'sandbox') { a.kind = 'internal'; a.target = v === 'sandbox' ? 'sandbox' : 'reflection'; }
          else a.kind = v;
          if (v === 'calendar' && !a.cal) a.cal = { date: '', time: '', duration: 60, title: '', place: '', details: '' };
          draw(); } }) : null,
        k === 'link' ? textIn(a, 'url', 'Ссылка', { ph: 'https://…', hint: o.linkHint || 'Полный адрес страницы, начиная с https://' }) : null,
        k === 'download' ? textIn(a, 'url', 'Ссылка на файл', { ph: 'https://…', hint: 'Пока — ссылкой (например, на Яндекс Диск). Загрузка файлов прямо из панели появится вместе с публикацией.' }) : null,
        k === 'calendar' ? calFields(a.cal = a.cal || { duration: 60 }) : null,
        k === 'share' ? el('p', { class: 'a-hint', text: 'На телефоне откроется меню «Поделиться» (Telegram, VK…), на компьютере ссылка на эту карточку скопируется.' }) : null,
        k === 'examples' || k === 'sandbox' ? el('p', { class: 'a-hint', text: k === 'sandbox' ? 'Откроется Песочница — «Как устроены маршруты».' : 'Откроется страница примеров Карт-Отражений.' }) : null,
        k === 'contact'
          ? [textIn(a, 'message', 'Текст обращения', { multi: true, rows: 2, ph: o.msgPh || 'Можно оставить пустым — текст соберётся сам', hint: 'Этот текст человек увидит в окне и сможет вставить в чат.' }),
            el('details', {}, [el('summary', { class: 'a-hint', style: 'cursor:pointer', text: 'Свои контакты для этой кнопки (необязательно)' }),
              el('div', { class: 'a-row', style: 'margin-top:8px' }, [
                textIn(a, 'telegram', 'Telegram', { ph: 'как в Настройках' }),
                textIn(a, 'vk', 'VK', { ph: 'как в Настройках' })])])] : null
      ]);
    }
    draw();
    return box;
  }
  function block(title, kids, o) {
    o = o || {};
    return el('details', { class: 'a-block', open: o.open === false ? null : true }, [
      el('summary', {}, [title, o.note ? el('small', { text: o.note }) : null]),
      el('div', { class: 'a-block-body' }, kids)]);
  }
  function sub(t) { return el('div', { class: 'a-sub', text: t }); }

  /* ---------- Коллекция: список элементов с порядком, видимостью, удалением ---------- */
  // Перетаскивание мышкой (на компьютере): тянем за «⋮⋮» слева. На телефоне ручка скрыта — там стрелки.
  var DRAG = null;
  function collection(arr, o) {
    var box = el('div', { class: 'a-coll' });
    function moveTo(from, to) {
      if (to > from) to--;
      if (to === from) return;
      arr.splice(to, 0, arr.splice(from, 1)[0]); renumber(); changed(); render(); if (o.onChange) o.onChange();
    }
    function renumber() { if (o.ordered !== false) arr.forEach(function (x, i) { if (x && typeof x === 'object') x.order = i + 1; }); }
    function render() {
      box.replaceChildren();
      if (!arr.length && o.empty) box.appendChild(el('p', { class: 'a-empty', text: o.empty }));
      arr.forEach(function (it, i) {
        var open = o.alwaysOpen || OPENED.has(it);
        var hidden = o.visible && it.visible === false;
        var name = el('span', { class: 'a-ci-name', text: o.title(it, i) || 'Без названия' });
        var handle = el('span', { class: 'a-drag', title: 'Перетащить мышкой', 'aria-hidden': 'true', text: '⋮⋮' });
        var head = el('div', { class: 'a-ci-head' }, [handle,
          el('button', { type: 'button', class: 'a-ci-title', 'aria-expanded': open ? 'true' : 'false', onclick: function () {
            if (open) OPENED.delete(it); else OPENED.add(it); render(); } },
            [el('span', { class: 'a-caret', text: open ? '▾' : '▸' }), name])
        ]);
        if (CONFIRM.has(it)) {
          add(head, el('span', { class: 'a-confirm' }, ['Удалить?',
            el('button', { type: 'button', class: 'a-btn a-btn--small a-btn--danger', text: 'Да', onclick: function () {
              CONFIRM.delete(it); arr.splice(i, 1); renumber(); changed(); render(); if (o.onChange) o.onChange(); } }),
            el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Нет', onclick: function () { CONFIRM.delete(it); render(); } })]));
        } else {
          add(head, [
            o.visible ? el('button', { type: 'button', class: 'a-pill' + (hidden ? ' is-off' : ''), text: hidden ? 'скрыто' : 'видно',
              title: 'Показывать или скрывать на сайте',
              onclick: function () { it.visible = it.visible === false; changed(); render(); if (o.onChange) o.onChange(); } }) : null,
            el('button', { type: 'button', class: 'a-icon', text: '↑', title: 'Выше', 'aria-label': 'Выше', disabled: i === 0, onclick: function () {
              arr.splice(i - 1, 0, arr.splice(i, 1)[0]); renumber(); changed(); render(); if (o.onChange) o.onChange(); } }),
            el('button', { type: 'button', class: 'a-icon', text: '↓', title: 'Ниже', 'aria-label': 'Ниже', disabled: i === arr.length - 1, onclick: function () {
              arr.splice(i + 1, 0, arr.splice(i, 1)[0]); renumber(); changed(); render(); if (o.onChange) o.onChange(); } }),
            el('button', { type: 'button', class: 'a-icon', text: '×', title: 'Удалить', 'aria-label': 'Удалить', onclick: function () {
              var why = o.canDelete && o.canDelete(it);
              if (why) { toast(why, true); return; }
              CONFIRM.add(it); render(); } })
          ]);
        }
        var row = el('div', { class: 'a-ci' + (hidden ? ' is-hidden' : '') }, head);
        // Тянуть можно за строку-заголовок (в ней нет полей ввода, поэтому выделение текста не ломается).
        head.draggable = true;
        head.addEventListener('dragstart', function (e) {
          e.stopPropagation(); DRAG = { arr: arr, i: i };
          try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); } catch (x) {}
          setTimeout(function () { row.classList.add('is-dragging'); }, 0);
        });
        head.addEventListener('dragend', function () { DRAG = null; box.querySelectorAll('.a-ci').forEach(function (r) { r.classList.remove('is-dragging', 'drop-before', 'drop-after'); }); });
        function where(e) { var r = row.getBoundingClientRect(); return e.clientY < r.top + Math.min(r.height, 44) / 2 ? 'before' : 'after'; }
        row.addEventListener('dragover', function (e) {
          if (!DRAG || DRAG.arr !== arr) return;
          e.preventDefault(); e.stopPropagation();
          var w = where(e);
          row.classList.toggle('drop-before', w === 'before'); row.classList.toggle('drop-after', w === 'after');
        });
        row.addEventListener('dragleave', function (e) { if (!row.contains(e.relatedTarget)) row.classList.remove('drop-before', 'drop-after'); });
        row.addEventListener('drop', function (e) {
          if (!DRAG || DRAG.arr !== arr) return;
          e.preventDefault(); e.stopPropagation();
          var from = DRAG.i; DRAG = null;
          moveTo(from, where(e) === 'before' ? i : i + 1);
        });
        if (open) {
          var body = el('div', { class: 'a-ci-body' }, o.body(it, render));
          var upd = function () { name.textContent = o.title(it, i) || 'Без названия'; if (o.onChange) o.onChange(); };
          body.addEventListener('input', upd); body.addEventListener('change', upd);
          row.appendChild(body);
        }
        box.appendChild(row);
      });
      var can = !o.max || arr.length < o.max;
      if (o.addBox) { box.appendChild(o.addBox(function (n) { arr.push(n); renumber(); OPENED.add(n); changed(); render(); if (o.onChange) o.onChange(); })); return; }
      box.appendChild(el('button', { type: 'button', class: 'a-btn a-add', disabled: !can,
        text: can ? (o.addLabel || '+ Добавить') : 'Больше добавить нельзя: предел ' + o.max,
        onclick: function () { var n = o.make(); arr.push(n); renumber(); OPENED.add(n); changed(); render(); if (o.onChange) o.onChange(); } }));
    }
    render();
    return box;
  }

  /* ---------- Каркас ---------- */
  var SECTIONS = [['showcases', 'Витрины'], ['home', 'Главная страница'], ['routes', 'Маршруты'], ['sandbox', 'Песочница'], ['reflection', 'Карты-Отражения'], ['settings', 'Настройки']];

  function renderShell() {
    APP.replaceChildren();
    add(APP, [
      el('header', { class: 'a-top' }, [
        el('div', { class: 'a-brand' }, ['13 MIRRORS', el('small', { text: 'Панель управления витриной' })]),
        el('span', { class: 'a-state', id: 'a-state' }),
        el('div', { class: 'a-topbtns' }, [
          el('button', { type: 'button', class: 'a-btn a-btn--dark', id: 'a-save', text: 'Сохранить', onclick: save }),
          el('button', { type: 'button', class: 'a-btn', text: 'Посмотреть', onclick: function () { openPreview(); } }),
          el('button', { type: 'button', class: 'a-btn', text: 'Опубликовать', onclick: publish })
        ]),
        GHS.token && GHS.user
          ? el('div', { class: 'a-gh is-on' }, [el('span', { text: 'GitHub: ' + GHS.user }),
              el('button', { type: 'button', class: 'a-gh-btn', text: 'Выйти', onclick: logout })])
          : el('div', { class: 'a-gh' }, [el('button', { type: 'button', class: 'a-gh-btn', text: 'Войти в GitHub', onclick: openLogin })])
      ]),
      el('div', { class: 'a-layout' }, [
        el('nav', { class: 'a-nav', 'aria-label': 'Разделы' }, SECTIONS.map(function (s) {
          return el('button', { type: 'button', class: ST.section === s[0] ? 'is-active' : '', text: s[1], onclick: function () {
            ST.section = s[0]; ST.showcase = null; ST.mobileForm = false; renderShell(); window.scrollTo(0, 0); } });
        })),
        el('main', { class: 'a-main', id: 'a-main' })
      ]),
      el('div', { class: 'a-preview', id: 'a-preview' }),
      el('div', { class: 'a-toast', id: 'a-toast', role: 'status', 'aria-live': 'polite' })
    ]);
    updateState();
    renderMain();
  }
  function renderMain() {
    var m = document.getElementById('a-main');
    m.replaceChildren();
    var s = ST.section;
    if (s === 'showcases') add(m, ST.showcase ? viewShowcase() : viewShowcaseList());
    else if (s === 'home') add(m, viewHome());
    else if (s === 'routes') add(m, viewRoutes());
    else if (s === 'sandbox') add(m, viewSandbox());
    else if (s === 'reflection') add(m, viewReflection());
    else add(m, viewSettings());
  }

  /* ================= ВИТРИНЫ ================= */
  function viewShowcaseList() {
    var ids = Object.keys(DATA.showcases).sort().reverse();
    var cur = DATA.settings.currentShowcase;
    // Предложить следующий месяц после самого позднего
    var last = ids[0] ? ids[0].split('-').map(Number) : [2026, 9];
    var ny = last[0], nm = last[1] + 1; if (nm > 12) { nm = 1; ny++; }
    var form = { year: String(ny), month: String(nm), base: ids[0] || '' };
    var yearOpts = []; for (var y = 2026; y <= 2030; y++) yearOpts.push([String(y), String(y)]);

    return [
      el('div', {}, [el('h1', { class: 'a-h1', text: 'Витрины' }),
        el('p', { class: 'a-lead', text: 'Каждый месяц — отдельная витрина со своим адресом. Старые месяцы не перезаписываются и остаются в архиве.' })]),
      el('div', { class: 'a-sc-list' }, ids.map(function (id) {
        var sc = DATA.showcases[id];
        return el('button', { type: 'button', class: 'a-sc-item', onclick: function () { ST.showcase = id; ST.card = 0; ST.mobileForm = false; renderMain(); window.scrollTo(0, 0); } }, [
          el('b', { text: sc.title }),
          el('span', { class: 'a-hint', text: 'Адрес: 13mirrors.ru/vitrina/' + id + '/' }),
          el('div', { class: 'a-tags' }, [
            el('span', { class: 'a-tag ' + (sc.status === 'published' ? 'a-tag--pub' : 'a-tag--draft'), text: sc.status === 'published' ? 'Опубликована' : 'Черновик' }),
            id === cur ? el('span', { class: 'a-tag a-tag--main', text: 'Открывается по основному адресу' }) : null])
        ]);
      })),
      el('div', { class: 'a-card' }, [
        el('h2', { class: 'a-label', style: 'font-size:15px;margin-bottom:10px', text: 'Новый месяц' }),
        el('div', { class: 'a-new' }, [
          selectIn(form, 'month', 'Месяц', MONTHS.map(function (n, i) { return [String(i + 1), n]; })),
          selectIn(form, 'year', 'Год', yearOpts),
          selectIn(form, 'base', 'Взять за основу', ids.map(function (id) { return [id, DATA.showcases[id].title]; }).concat([['', 'Пустая витрина']])),
          el('button', { type: 'button', class: 'a-btn a-btn--dark', text: 'Создать черновик', onclick: function () { createShowcase(+form.year, +form.month, form.base); } })
        ]),
        el('p', { class: 'a-hint', style: 'margin-top:8px', text: 'Карточки скопируются из выбранного месяца. Списки, у которых выключено «Переносить в новый месяц» (например, встречи «Другого мира»), начнутся пустыми.' })
      ])
    ];
  }

  function createShowcase(y, m, baseId) {
    var id = y + '-' + pad(m);
    if (DATA.showcases[id]) { toast('Витрина «' + MONTHS[m - 1] + ' ' + y + '» уже есть. Откройте её в списке.', true); return; }
    var last = new Date(y, m, 0).getDate();
    var sc;
    if (baseId && DATA.showcases[baseId]) {
      sc = clone(DATA.showcases[baseId]);
      sc.cards.forEach(function (c) {
        if (!c.back || c.back.type === 'static') return;
        c.back = window.M13.toBlocks(c.back);
        (c.back.blocks || []).forEach(function (x) {
          x.id = uid('b');
          if (x.kind !== 'items') return;
          if (x.copyItems === false) x.items = [];
          (x.items || []).forEach(function (it) { it.id = uid('i'); });
        });
      });
    } else {
      sc = { background: { color: '#f2f2f2', image: null }, intro: { value: '', show: false }, cards: [] };
      for (var i = 1; i <= 9; i++) sc.cards.push({ id: 'c' + i, visible: true, interactive: false,
        front: { image: null, eyebrow: '', title: 'Карточка ' + i, subtitle: { value: '', show: false }, status: { value: '', show: false }, foot: { value: '', show: false } },
        back: { type: 'static' } });
    }
    sc.id = id; sc.title = MONTHS[m - 1] + ' ' + y; sc.status = 'draft'; sc.basedOn = baseId || null;
    sc.period = { from: id + '-01', to: id + '-' + pad(last) };
    DATA.showcases[id] = sc; syncIndex(); changed();
    ST.showcase = id; ST.card = 0; renderMain(); window.scrollTo(0, 0);
    toast('Создан черновик «' + sc.title + '». Не забудьте нажать «Сохранить».');
  }

  function viewShowcase() {
    var sc = DATA.showcases[ST.showcase];
    var st = DATA.settings;
    sc.background = sc.background || { color: '#f2f2f2', image: null };
    var monthMeta = { main: st.currentShowcase === sc.id };

    var wrap = el('div', { class: 'a-sc' + (ST.mobileForm ? ' is-form' : '') });
    var gridBox = el('div', { class: 'a-sc-grid' });
    var formBox = el('div', { class: 'a-sc-form' });
    function drawGrid() {
      gridBox.replaceChildren();
      add(gridBox, [
        el('div', { class: 'a-mgrid' }, sc.cards.map(function (c, i) {
          var f = c.front || {}, b = c.back || {};
          var isStatic = c.interactive === false || !b.type || b.type === 'static';
          var tags = [];
          if (c.visible === false) tags.push(['скрыта', 1]);
          else if (isStatic) tags.push(['без оборота', 0]);
          else tags.push([b.routeId && routeById(b.routeId) ? 'маршрут' : 'оборот', 0]);
          var d = sc.cardStyle || {}, fs = f.style || {};
          var font = fs.font || d.font, tc = fs.textColor || d.textColor, bg = fs.bg || d.bg;
          function pk(k, def) { return fs[k] && fs[k] !== 'inherit' ? fs[k] : (d[k] || def); }
          var glow = pk('glow', 'off'), gc = fs.glowColor || d.glowColor || '#e8c77a';
          var ph = window.M13.phaseOf(c, { routes: DATA.routes, settings: DATA.settings });
          if (ph && ph.glow && glow !== 'soft' && glow !== 'live') glow = 'live';
          var gk = { weak: 0.55, medium: 1, strong: 1.7 }[pk('glowStrength', 'medium')] || 1;
          var gdir = pk('glowDir', 'around'), gy = gdir === 'bottom' ? 1 : gdir === 'top' ? -1 : 0;
          var ov = fs.overlay && fs.overlay !== 'inherit' ? fs.overlay : (d.overlay || 'light');
          var ac = fs.accent || d.accent;
          if (!fs.glowColor && fs.accent) gc = fs.accent; else if (!fs.glowColor && !d.glowColor && d.accent) gc = d.accent;
          if (font) window.M13.ensureFont(font);
          var css = [f.image ? "background-image:url('" + imgSrc(f.image) + "')" : '', font ? "font-family:'" + font + "',Georgia,serif" : '',
            tc ? 'color:' + tc : '', bg && !f.image && c.visible !== false ? 'background-color:' + bg : '', ac && c.visible !== false ? 'border-color:' + ac : '',
            glow === 'soft' || glow === 'live' ? 'box-shadow:0 ' + Math.round(gy * 7 * gk) + 'px ' + Math.round(12 * gk) + 'px ' + (gy ? -2 : Math.round(2 * gk)) + 'px ' + gc : ''].filter(Boolean).join(';');
          return el('button', { type: 'button', class: 'a-mcard' + (i === ST.card ? ' is-sel' : '') + (c.visible === false ? ' is-hidden' : '') +
              (isStatic && c.visible !== false ? ' is-static' : '') + (f.image ? ' has-img ov-' + ov : '') + (tc ? ' has-tc' : ''),
            style: css || null,
            onclick: function () { ST.card = i; ST.mobileForm = true; wrap.classList.add('is-form'); drawGrid(); drawForm(); window.scrollTo(0, 0); } }, [
            el('div', {}, [el('div', { class: 'a-mcard-n', text: String(i + 1) }),
              f.eyebrow ? el('div', { class: 'a-mcard-e', text: f.eyebrow }) : null,
              el('div', { class: 'a-mcard-t', text: f.title || 'Без названия' })]),
            el('div', { class: 'a-mcard-b' }, tags.map(function (t) { return el('span', { class: t[1] ? 'warn' : '', text: t[0] }); }))
          ]);
        })),
        el('p', { class: 'a-hint', text: 'Нажмите на карточку, чтобы изменить её. Порядок меняется кнопками «Сдвинуть» в форме.' }),
        el('button', { type: 'button', class: 'a-btn', text: 'Посмотреть витрину целиком', onclick: function () { openPreview('showcase', sc.id); } })
      ]);
    }
    function drawForm() {
      formBox.replaceChildren();
      add(formBox, cardForm(sc, ST.card, { redrawGrid: drawGrid, redrawAll: function () { drawGrid(); drawForm(); } }));
      formBox.oninput = drawGrid; formBox.onchange = drawGrid;
    }
    drawGrid(); drawForm();
    add(wrap, [gridBox, formBox]);

    return [
      el('button', { type: 'button', class: 'a-btn a-back', text: '← Все витрины', onclick: function () { ST.showcase = null; renderMain(); } }),
      el('div', {}, [el('h1', { class: 'a-h1', text: sc.title }),
        el('p', { class: 'a-lead', text: 'Адрес этого месяца: 13mirrors.ru/vitrina/' + sc.id + '/' })]),
      block('Страница месяца', [
        el('div', { class: 'a-row' }, [
          textIn(sc, 'title', 'Название витрины', { onInput: function () { syncIndex(); } }),
          selectIn(sc, 'status', 'Статус', [['draft', 'Черновик — на сайт не попадает'], ['published', 'Опубликована']])
        ]),
        el('div', { class: 'a-row' }, [
          textIn(sc.period = sc.period || {}, 'from', 'Период: с', { type: 'date' }),
          textIn(sc.period, 'to', 'по', { type: 'date' })
        ]),
        switchIn(monthMeta, 'main', 'Открывать эту витрину по основному адресу 13mirrors.ru/vitrina/', {
          hint: 'Можно включить только у одной витрины. Остальные открываются по своим адресам.',
          onChange: function (on) {
            if (on) st.currentShowcase = sc.id;
            else if (st.currentShowcase === sc.id) { monthMeta.main = true; toast('Основной адрес всегда ведёт на одну из витрин. Чтобы сменить её — включите это у другого месяца.'); renderMain(); }
          } }),
        themeButtons(sc),
        sub('Фон страницы'),
        el('div', { class: 'a-row' }, [
          imageIn(sc.background, 'image', 'Фоновая картинка', { max: 2400, hint: 'Растягивается на весь экран. Лучше горизонтальная.' }),
          imageIn(sc.background, 'imageTall', 'Картинка для телефона', { max: 2000, hint: 'Необязательно. Вертикальная; пусто — на телефоне та же, что выше.' })]),
        el('div', { class: 'a-row3' }, [
          colorIn(sc.background, 'color', 'Цвет фона'),
          rangeIn(sc.background, 'dim', 'Затемнение картинки', { max: 90, step: 5, unit: '%', hint: 'Чтобы карточки читались лучше.' }),
          rangeIn(sc.background, 'blur', 'Размытие картинки', { max: 20, unit: ' px', hint: '0 — чёткая; 4–8 — мягкий фон.' })]),
        sub('Надписи над сеткой'),
        el('div', { class: 'a-row3' }, [
          colorOptIn(sc.head = sc.head || {}, 'color', 'Цвет надписей', { none: 'обычный тёмный', pick: '#ecd3a3' }),
          selectIn(sc.head, 'align', 'Положение', [['left', 'Слева'], ['center', 'По центру']]),
          el('div', { class: 'a-field', style: 'align-self:end' }, switchIn(sc.head, 'logo', 'Логотип вместо надписи «13 MIRRORS · Витрина»'))]),
        optIn(sc, 'intro', 'Общий текст на странице (под заголовком)', { multi: true, rows: 2 }),
        sub('Оформление всех карточек'),
        el('p', { class: 'a-hint', text: 'Задаётся один раз для всего месяца. У любой карточки можно поменять отдельно — в её форме, раздел «Оформление».' })
      ].concat(styleFields(sc.cardStyle = sc.cardStyle || {}, false, function () { drawGrid(); })),
        { open: !!ST.pageOpen, note: 'фон, надписи, оформление карточек, темы' }),
      shareBlock(sc),
      wrap
    ];
  }

  /* ---------- Превью ссылки в Telegram и VK ---------- */
  // Мессенджеры не запускают скрипты страницы: они читают только теги <meta> в самом HTML-файле.
  // Поэтому данные хранятся в JSON (share), а при публикации из них заново собираются HTML-файлы страниц.
  var SHARE_SIZE = [1200, 630];
  function siteUrl(D) {
    var u = String((D || DATA).settings.siteUrl || 'https://13mirrors.ru/vitrina/').trim();
    return u.slice(-1) === '/' ? u : u + '/';
  }
  // Итоговые картинка и подписи: своё у месяца, иначе — общее из «Настроек».
  function shareOf(sc, D) {
    var st = (D || DATA).settings, def = st.share || {}, own = (sc && sc.share) || {};
    return {
      title: String(own.title || '').trim() || (sc ? (st.siteTitle || '13 MIRRORS') + ' · ' + sc.title : String(def.title || '').trim() || st.siteTitle || '13 MIRRORS'),
      description: String(own.description || '').trim() || String(def.description || '').trim(),
      image: own.image || def.image || null
    };
  }
  function shareMock(sh) {
    return el('div', { class: 'a-share-mock' }, [
      el('div', { class: 'a-share-bubble' }, [
        el('div', { class: 'a-share-link', text: siteUrl().replace(/^https?:\/\//, '') }),
        el('div', { class: 'a-share-site', text: DATA.settings.siteTitle || '13 MIRRORS' }),
        el('div', { class: 'a-share-title', text: sh.title }),
        sh.description ? el('div', { class: 'a-share-desc', text: sh.description }) : null,
        sh.image ? el('div', { class: 'a-share-img', style: "background-image:url('" + imgSrc(sh.image) + "')" })
          : el('div', { class: 'a-share-noimg', text: 'Без картинки превью будет только текстовым.' })
      ])
    ]);
  }
  function shareFields(obj, o) {
    var mockBox = el('div');
    function drawMock() { mockBox.replaceChildren(shareMock(o.resolve())); }
    var fields = el('div', { class: 'a-share-fields' }, [
      imageIn(obj, 'image', 'Картинка', { crop: SHARE_SIZE, onChange: drawMock,
        hint: 'Лучше горизонтальная. Обрежется по центру до размера 1200×630 — так её показывают Telegram и VK.' }),
      textIn(obj, 'title', 'Заголовок', { ph: o.titlePh, hint: 'Коротко, до 60 знаков. ' + (o.titleHint || '') }),
      textIn(obj, 'description', 'Подпись', { multi: true, rows: 3, ph: o.descPh, hint: 'Одно-два предложения, до 160 знаков — длиннее обрежется.' })
    ]);
    fields.addEventListener('input', drawMock);
    drawMock();
    return el('div', { class: 'a-share' }, [fields, el('div', {}, [el('span', { class: 'a-label', text: 'Так примерно будет выглядеть в Telegram' }), mockBox])]);
  }
  function shareBlock(sc) {
    var def = DATA.settings.share || {};
    return block('Превью ссылки в Telegram и VK', [
      el('p', { class: 'a-hint', text: 'Когда кто-то отправляет ссылку на эту витрину, мессенджер показывает под ней картинку, заголовок и подпись. Пустые поля берутся из раздела «Настройки».' }),
      shareFields(sc.share = sc.share || { title: '', description: '', image: null }, {
        resolve: function () { return shareOf(sc); },
        titlePh: (DATA.settings.siteTitle || '13 MIRRORS') + ' · ' + sc.title,
        titleHint: 'Если оставить пустым — будет «' + (DATA.settings.siteTitle || '13 MIRRORS') + ' · ' + sc.title + '».',
        descPh: def.description || ''
      }),
      el('p', { class: 'a-hint', text: 'Изменения появятся в мессенджерах после публикации. Telegram и VK запоминают превью на несколько дней: если ссылку уже кто-то отправлял, старое превью может держаться какое-то время.' })
    ], { open: false, note: 'картинка и подпись, когда ссылкой делятся' });
  }

  // HTML-файл страницы с тегами превью. Вызывается при публикации для уже очищенных данных D:
  // картинки к этому моменту — файлы media/…, а не data:.
  // kind: 'main' (13mirrors.ru/vitrina/), 'month' (…/2026-10/), 'card' (…/2026-10/sun/ — превью одной карточки
  // и сразу переход на витрину с открытой карточкой), 'sandbox', 'reflection'.
  var PAGE_TITLES = { sandbox: 'Как устроены маршруты', reflection: 'Карта-Отражение' };
  function escAttr(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\s+/g, ' ').trim(); }
  function absImg(src, D) { return src && !/^(data:|blob:)/.test(src) ? (/^https?:/.test(src) ? src : siteUrl(D) + src) : ''; }
  function metaTags(o, D) {
    var site = D.settings.siteTitle || '13 MIRRORS';
    var m = ['<meta property="og:type" content="website">', '<meta property="og:site_name" content="' + escAttr(site) + '">',
      '<meta property="og:url" content="' + escAttr(o.url) + '">', '<meta property="og:title" content="' + escAttr(o.title) + '">'];
    if (o.description) {
      m.unshift('<meta name="description" content="' + escAttr(o.description) + '">');
      m.push('<meta property="og:description" content="' + escAttr(o.description) + '">');
    }
    if (o.image) {
      m.push('<meta property="og:image" content="' + escAttr(o.image) + '">');
      if (o.sized) m.push('<meta property="og:image:width" content="' + SHARE_SIZE[0] + '">', '<meta property="og:image:height" content="' + SHARE_SIZE[1] + '">');
      m.push('<meta property="vk:image" content="' + escAttr(o.image) + '">', '<meta name="twitter:card" content="summary_large_image">');
    }
    return m.join('\n');
  }
  function pageHTML(kind, id, D, cardId) {
    D = D || DATA;
    var st = D.settings, site = st.siteTitle || '13 MIRRORS';
    var isMonth = kind === 'main' || kind === 'month' || kind === 'card';
    var sc = isMonth ? D.showcases[kind === 'main' ? st.currentShowcase : id] : null;
    var sh = shareOf(sc, D);
    if (kind === 'card') {
      var c = (sc.cards || []).filter(function (x) { return x.id === cardId; })[0] || { front: {} }, f = c.front || {};
      var ctitle = (f.title || '') + ' · ' + site;
      var cdesc = [optVal(f.subtitle), optVal(f.status)].filter(Boolean).join(' · ') || sh.description;
      var cimg = absImg(f.image, D), sized = false;
      if (!cimg) { cimg = absImg(sh.image, D); sized = !!cimg; }
      var target = '../#' + encodeURIComponent(cardId);
      return '<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="UTF-8">\n' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + escAttr(ctitle) + '</title>\n' +
        metaTags({ url: siteUrl(D) + sc.id + '/' + encodeURIComponent(cardId) + '/', title: ctitle, description: cdesc, image: cimg, sized: sized }, D) + '\n' +
        '<meta http-equiv="refresh" content="0; url=' + target + '">\n<link rel="canonical" href="' + escAttr(siteUrl(D) + sc.id + '/') + '">\n</head>\n' +
        '<body style="font-family:sans-serif;padding:24px"><script>location.replace(' + JSON.stringify(target) + ');</script>\n' +
        '<a href="' + target + '">' + escAttr(f.title || 'Открыть карточку') + '</a>\n</body>\n</html>\n';
    }
    var base = kind === 'main' ? './' : '../';
    var url = siteUrl(D) + (kind === 'main' ? '' : kind === 'month' ? sc.id + '/' : kind + '/');
    var title = site + ' · ' + (sc ? sc.title : PAGE_TITLES[kind] || '');
    if (!sc && !String((st.share || {}).title || '').trim()) sh.title = title;
    var img = absImg(sh.image, D);
    return '<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n' +
      '<title>' + escAttr(title) + '</title>\n' + metaTags({ url: url, title: sh.title, description: sh.description, image: img, sized: true }, D) + '\n' +
      '<link rel="stylesheet" href="' + base + 'assets/vitrina.css">\n</head>\n<body class="m13-body">\n' +
      '<div id="m13" data-base="' + base + '" data-view="' + (isMonth ? 'showcase' : kind) + '"' + (kind === 'month' ? ' data-showcase="' + escAttr(sc.id) + '"' : '') + '></div>\n' +
      '<script src="' + base + 'assets/vitrina.js"></script>\n<script>M13.boot();</script>\n</body>\n</html>\n';
  }


  /* ---------- Готовые темы месяца: одно нажатие — согласованные цвета, дальше можно подправить ---------- */
  var DARK_THEME = {
    background: { color: '#0d0a07', dim: 55, blur: 6 },
    head: { color: '#ecd3a3', logo: true },
    cardStyle: { font: 'Cormorant Garamond', textColor: '#efe4d2', bg: '#17120c', glass: 75, glassBlur: 3, rim: 'gold', textHelp: 'shadow', accent: '#ecd3a3', overlay: 'dark', backBg: '#15110c' }
  };
  function themeButtons(sc) {
    function apply(dark) {
      sc.background = sc.background || {}; sc.head = sc.head || {}; sc.cardStyle = sc.cardStyle || {};
      if (dark) {
        Object.assign(sc.background, DARK_THEME.background);
        Object.assign(sc.head, DARK_THEME.head);
        Object.assign(sc.cardStyle, DARK_THEME.cardStyle);
      } else {
        sc.background.color = '#f2f2f2'; delete sc.background.dim; delete sc.background.blur;
        sc.head = { align: sc.head.align };
        ['font', 'textColor', 'bg', 'glass', 'glassBlur', 'rim', 'textHelp', 'pattern', 'patternImage', 'patternPlace', 'patternColor', 'patternOpacity', 'accent', 'overlay', 'backBg'].forEach(function (k) { delete sc.cardStyle[k]; });
      }
      ST.pageOpen = true; changed(); renderMain();
      toast(dark ? 'Тёмная тема применена. Загрузите фоновую картинку и подправьте, что хочется, — всё ниже.' : 'Вернули светлое оформление, как было.');
    }
    return el('div', { class: 'a-theme' }, [
      el('button', { type: 'button', class: 'a-btn a-btn--dark', text: '✨ Тёмная тема, как на главной', onclick: function () { apply(true); } }),
      el('button', { type: 'button', class: 'a-btn', text: 'Светлая тема', onclick: function () {
        var bg = sc.background || {};
        if (!bg.image && !bg.imageTall) return apply(false);
        // На светлом фоне тёмная картинка мешает читать — предлагаем убрать и её
        dialog({ title: 'Светлая тема', body: 'Фоновую картинку тоже убрать? На светлом оформлении тёмная картинка мешает читать надписи. Картинку всегда можно загрузить снова.',
          buttons: [['all', 'Убрать и картинку', 'dark'], ['keep', 'Картинку оставить'], ['cancel', 'Отмена']] }).then(function (v) {
          if (v === 'all') { delete sc.background.image; delete sc.background.imageTall; apply(false); }
          else if (v === 'keep') apply(false);
        });
      } }),
      el('span', { class: 'a-hint', text: 'Меняет фон, надписи и оформление карточек этого месяца. Тексты и картинки карточек не трогает. Свечение отдельных карточек остаётся как было.' })]);
  }

  /* ---------- Форма карточки ---------- */
  function newItem() {
    return { id: uid('i'), visible: true, order: 0, date: { value: '', show: false }, title: 'Новый элемент', text: { value: '', show: false },
      duration: { value: '', show: false }, price: { value: '', show: false }, status: { value: '', show: false },
      action: { kind: 'contact', label: 'Записаться' } };
  }
  function itemTitle(it) { return [optVal(it.date), it.title, optVal(it.price)].filter(Boolean).join(' · '); }
  function itemBody(it) {
    return [
      textIn(it, 'title', 'Название'),
      el('div', { class: 'a-row' }, [optIn(it, 'date', 'Дата', { ph: '08 октября' }), optIn(it, 'price', 'Цена', { ph: '2 500 ₽ или «Свободный вход»' })]),
      optIn(it, 'text', 'Короткое описание', { multi: true, rows: 2 }),
      el('div', { class: 'a-row' }, [optIn(it, 'duration', 'Длительность', { ph: 'до 90 минут' }), optIn(it, 'status', 'Статус', { ph: 'осталось 2 места' })]),
      actionIn(it, 'action', 'Кнопка на плашке', { defLabel: 'Записаться' }),
      itemCalendar(it)
    ];
  }

  /* ---------- Блоки оборота ---------- */
  function newBlock(kind) {
    var b = { id: uid('b'), kind: kind, visible: true };
    if (kind === 'desc' || kind === 'info' || kind === 'heading') b.text = '';
    if (kind === 'images') b.images = [];
    if (kind === 'facts') b.facts = [{ id: uid('f'), text: '', visible: true }];
    if (kind === 'more') { b.label = 'Подробнее'; b.labelClose = 'Свернуть'; b.text = ''; }
    if (kind === 'price') { b.label = ''; b.value = ''; }
    if (kind === 'routeButton') { b.label = 'Пройти маршрут'; b.url = ''; }
    if (kind === 'formats') { b.closed = 'dim'; b.formats = DATA.formats.formats.map(function (x) { return { formatId: x.id, visible: true, availability: 'open' }; }); }
    if (kind === 'items') { b.items = []; b.max = 10; b.copyItems = true; b.tpl = 'container'; }
    if (kind === 'dates') { b.label = ''; b.dates = ''; b.note = ''; }
    if (kind === 'examples') b.label = 'Примеры';
    if (kind === 'actions') b.actions = [{ kind: 'contact', label: 'Написать', visible: true }];
    if (kind === 'sandbox') b.label = 'Как устроены маршруты 13 MIRRORS';
    return b;
  }
  // Заготовка: набор блоков, с которого удобно начать. Дальше всё можно менять.
  function presetBack(name, routeId) {
    var kinds = { route: ['desc', 'day', 'routeButton', 'formats', 'sandbox'], list: ['desc', 'items', 'info'],
      product: ['images', 'desc', 'price', 'items', 'dates', 'info', 'examples', 'actions'], simple: ['desc', 'actions'] }[name] || ['desc'];
    var off = { route: { routeButton: 1 }, list: { info: 1 }, product: { images: 1, price: 1, dates: 1, info: 1, examples: 1 } }[name] || {};
    return { type: 'blocks', routeId: name === 'route' ? (routeId || (routes()[0] || {}).id || '') : '', blocks: kinds.map(function (k) {
      var b = newBlock(k); if (off[k]) b.visible = false;
      if (k === 'items' && name === 'product') b.tpl = 'offerItem';
      return b; }) };
  }
  function blockTitle(x) {
    var n = { actions: 'Кнопки', facts: 'Факты', more: 'Подробнее ↓' }[x.kind] || BLOCK_NAMES[x.kind] || x.kind, t = '';
    if (x.kind === 'facts') t = (x.facts || []).filter(function (q) { return q.visible !== false && q.text; }).map(function (q) { return q.text; }).join(' · ');
    if (x.kind === 'more') t = String(x.text || '').split('\n')[0];
    if (x.kind === 'desc' || x.kind === 'info' || x.kind === 'heading') t = String(x.text || '').split('\n')[0];
    if (x.kind === 'price') t = x.value;
    if (x.kind === 'items') t = (x.items || []).length + ' шт.';
    if (x.kind === 'images') t = (x.images || []).length + ' шт.';
    if (x.kind === 'dates') t = x.dates;
    if (x.kind === 'routeButton' || x.kind === 'examples' || x.kind === 'sandbox') t = '«' + (x.label || '') + '»';
    if (x.kind === 'actions') t = (x.actions || []).map(function (a) { return '«' + (a.label || '') + '»'; }).join(', ');
    t = String(t || '').trim();
    return n + (t ? ' · ' + (t.length > 40 ? t.slice(0, 40) + '…' : t) : '');
  }
  function blockBody(x, back, cb) {
    var r = back.routeId ? routeById(back.routeId) : null;
    function needRoute(what) {
      return r ? null : el('p', { class: 'a-hint a-hint--warn', text: what + ' Выберите маршрут выше, в поле «Маршрут карточки».' });
    }
    if (x.kind === 'desc') return [textIn(x, 'text', '', { multi: true, rows: 4, ph: r ? r.description : '',
      hint: r ? 'Если оставить пустым — возьмётся описание маршрута из библиотеки.' : null })];
    if (x.kind === 'heading') return [textIn(x, 'text', '', { ph: 'Короткий заголовок' })];
    if (x.kind === 'info') return [textIn(x, 'text', '', { multi: true, rows: 3, ph: 'Состав, пояснение, важная деталь' })];
    if (x.kind === 'facts') return [el('p', { class: 'a-hint', text: 'Короткие плашки в одну строку: «90 минут», «7 000 ₽», «онлайн», «3 места». Каждую можно скрыть.' }),
      collection(x.facts = x.facts || [], { visible: true, max: 8, ordered: false, alwaysOpen: true, title: function (q) { return q.text || 'Пустой факт'; },
        body: function (q) { return [textIn(q, 'text', '', { ph: '90 минут' })]; },
        make: function () { return { id: uid('f'), text: '', visible: true }; }, addLabel: '+ Добавить факт' })];
    if (x.kind === 'more') return [el('p', { class: 'a-hint', text: 'Сначала видна только кнопка, по нажатию раскрывается текст. Короткое описание — в блоке «Описание» над этим.' }),
      el('div', { class: 'a-row' }, [textIn(x, 'label', 'Кнопка', { ph: 'Подробнее' }), textIn(x, 'labelClose', 'Кнопка, когда открыто', { ph: 'Свернуть' })]),
      textIn(x, 'text', 'Текст, который раскрывается', { multi: true, rows: 5 })];
    if (x.kind === 'images') return [collection(x.images = x.images || [], { visible: true, max: 6, title: function (m, k) { return 'Картинка ' + (k + 1); },
      body: function (m) { return [imageIn(m, 'src', '')]; }, make: function () { return { id: uid('img'), src: null, visible: true }; },
      addLabel: '+ Добавить картинку', empty: 'Пока без картинок.' })];
    if (x.kind === 'price') return [el('div', { class: 'a-row' }, [textIn(x, 'value', 'Цена', { ph: '3 000 ₽' }),
      textIn(x, 'label', 'Подпись к цене', { ph: 'Пусто — название карточки' })])];
    if (x.kind === 'day') return [el('p', { class: 'a-hint', text: 'Появляется только в дни маршрута и считается по его датам.' }), needRoute('Счётчику нужны даты маршрута.')];
    if (x.kind === 'routeButton') return [textIn(x, 'label', 'Текст на кнопке'),
      textIn(x, 'url', 'Куда ведёт', { ph: r && r.routeUrl ? r.routeUrl : 'https://…', hint: r ? 'Пусто — страница маршрута из библиотеки.' : 'Полный адрес, начиная с https://' }),
      !String(x.url || '').trim() && !(r && r.routeUrl) ? el('p', { class: 'a-hint a-hint--warn', text: 'Пока нет адреса — кнопка не появится.' }) : null];
    if (x.kind === 'formats') {
      var fmts = DATA.formats.formats;
      x.formats = x.formats || [];
      fmts.forEach(function (fm) { if (!x.formats.some(function (q) { return q.formatId === fm.id; })) x.formats.push({ formatId: fm.id, visible: true, availability: 'open' }); });
      var out = [selectIn(x, 'closed', 'Форматы с закрытым набором', [['dim', 'Показывать бледными с подписью «набор закрыт»'], ['hide', 'Не показывать']])];
      x.formats.forEach(function (q) {
        var fm = fmts.filter(function (z) { return z.id === q.formatId; })[0];
        if (!fm) return;
        q.price = q.price && typeof q.price === 'object' ? q.price : { value: '', show: true };
        q.price.show = true;
        out.push(el('div', { class: 'a-action', style: 'background:#fff' }, [
          el('div', { class: 'a-action-title', text: fm.title }),
          switchIn(q, 'visible', 'Показывать этот формат', { defTrue: true }),
          el('div', { class: 'a-row' }, [
            selectIn(q, 'availability', 'Набор', [['open', 'Открыт'], ['closed', 'Закрыт']]),
            textIn(q.price, 'value', 'Цена для этой карточки', { ph: fm.price, hint: 'Пусто — цена по умолчанию: ' + fm.price })]),
          actionIn(q, 'action', 'Нажатие на плашку', { noLabel: true,
            msgPh: 'Пусто — «Здравствуйте! Хочу на маршрут «…», формат «' + fm.title + '»»',
            linkHint: 'Пусто — откроется страница маршрута из библиотеки.' })]));
      });
      return out;
    }
    if (x.kind === 'items') return [
      collection(x.items = x.items || [], { visible: true, max: x.max || 10, title: itemTitle, body: itemBody, make: newItem,
        addLabel: '+ Добавить плашку', empty: 'Пока нет ни одной плашки.' }),
      selectIn(x, 'tpl', 'Готовый текст обращения для плашек', [['container', 'Как для встреч и услуг'], ['offerItem', 'Как для вариантов продукта']],
        { hint: 'Сами тексты — в «Настройках». У любой плашки можно написать свой.' }),
      switchIn(x, 'copyItems', 'Переносить эти плашки в новый месяц', { defTrue: true, hint: 'Для встреч обычно выключено: каждый месяц встречи новые.' })];
    if (x.kind === 'dates') return [textIn(x, 'label', 'Заголовок над датами', { ph: 'Портальные дни октября' }),
      textIn(x, 'dates', 'Даты', { ph: '04 · 08 · 15 · 16 · 23 · 29', hint: 'Просто строка текста, не кнопки.' }),
      textIn(x, 'note', 'Пояснение под датами', { multi: true, rows: 2 })];
    if (x.kind === 'examples') return [textIn(x, 'label', 'Текст на кнопке'), el('p', { class: 'a-hint', text: 'Ведёт на страницу примеров Карт-Отражений.' })];
    if (x.kind === 'sandbox') return [textIn(x, 'label', 'Текст на кнопке'), el('p', { class: 'a-hint', text: 'Ведёт в Песочницу — «Как устроены маршруты».' })];
    if (x.kind === 'actions') return [el('p', { class: 'a-hint', text: 'До 4 кнопок. Три-четыре встают сеткой 2×2; первая — главная, в акцентном цвете.' }),
      collection(x.actions = x.actions || [], { visible: true, max: 4, ordered: false, title: function (a) { return (a.label || defLabel(kindOf(a))) + ' · ' + (ACTION_KINDS.filter(function (k) { return k[0] === kindOf(a); })[0] || [, ''])[1].split(' — ')[0]; },
      body: function (a) { return [actionIn({ a: a }, 'a', '', { kinds: ACTION_KINDS.map(function (k) { return k[0]; }) })]; },
      make: function () { return { kind: 'contact', label: 'Написать', visible: true }; }, addLabel: '+ Добавить кнопку' })];
    return [];
  }
  function backBlocksForm(c, cb) {
    var b = c.back = window.M13.toBlocks(c.back);
    b.blocks = b.blocks || [];
    var addSel = { k: 'desc' };
    var preset = { p: 'route', armed: false }, presetBox = el('div');
    function drawPreset() {
      presetBox.replaceChildren();
      add(presetBox, el('div', { class: 'a-row a-row--end' }, [
        selectIn(preset, 'p', 'Начать с заготовки', PRESETS, { hint: 'Заменит блоки оборота готовым набором. Лицевая сторона не меняется.' }),
        preset.armed
          ? el('div', { class: 'a-confirm' }, ['Текущие блоки оборота пропадут. Точно?',
              el('button', { type: 'button', class: 'a-btn a-btn--small a-btn--danger', text: 'Да', onclick: function () {
                c.back = presetBack(preset.p, b.routeId); changed(); cb.redrawAll(); } }),
              el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Нет', onclick: function () { preset.armed = false; drawPreset(); } })])
          : el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Применить', onclick: function () {
              if (!b.blocks.length) { c.back = presetBack(preset.p, b.routeId); changed(); cb.redrawAll(); } else { preset.armed = true; drawPreset(); } } })]));
    }
    drawPreset();
    return [
      el('div', { class: 'a-row a-row--end' }, [
        selectIn(b, 'routeId', 'Маршрут карточки', [['', '— не связана с маршрутом —']].concat(routes().map(function (x) {
          return [x.id, x.title + (x.dates && x.dates.from ? ' · ' + fmtDates(x.dates) : '')]; })), {
          hint: 'Нужен для счётчика дней, кнопки «Пройти маршрут», описания и текста обращения по умолчанию.',
          onChange: function () { cb.redrawAll(); } }),
        b.routeId ? el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Маршрут в библиотеке →', onclick: function () {
          ST.section = 'routes'; ST.openRoute = b.routeId; renderShell(); } }) : null]),
      sub('Блоки оборота — сверху вниз'),
      el('p', { class: 'a-hint', text: 'Стрелками ↑↓ меняется порядок, «видно / скрыто» — показывать ли блок. Кнопки в самом конце прижимаются к низу карточки.' }),
      collection(b.blocks, { visible: true, ordered: false, title: blockTitle,
        body: function (x) { return blockBody(x, b, cb); },
        empty: 'Оборот пока пустой — добавьте блоки или начните с заготовки.',
        addBox: function (push) {
          return el('div', { class: 'a-row a-row--end' }, [
            selectIn(addSel, 'k', 'Добавить блок', BLOCKS, {}),
            el('button', { type: 'button', class: 'a-btn a-btn--small', text: '+ Добавить', onclick: function () { push(newBlock(addSel.k)); } })]);
        }, onChange: cb.redrawGrid }),
      b.blocks.filter(function (x) { return x.visible !== false; }).length > 6
        ? el('p', { class: 'a-hint a-hint--warn', text: 'Включено много блоков — на телефоне оборот может не поместиться без прокрутки. Проверьте в «Посмотреть» → «Как на телефоне».' }) : null,
      presetBox
    ];
  }

  /* ---------- Метка по датам «до / идёт / после» ---------- */
  var PHASE_NAMES = { before: 'до начала', during: 'идёт', after: 'закончилось' };
  function phaseFields(c, cb) {
    var box = el('div', { class: 'a-phase' });
    function draw() {
      var ph = c.front.phase = c.front.phase || { on: false, from: '', to: '',
        before: { value: 'скоро', show: true }, during: { value: 'идёт сейчас', show: true }, after: { value: 'завершён', show: true }, glow: false };
      if (ph.statusBefore == null) { ph.statusAuto = ph.statusAuto || false;
        ph.statusBefore = { value: 'Вход открыт', show: true }; ph.statusDuring = { value: 'Идёт сейчас', show: true }; ph.statusAfter = { value: 'Завершён', show: true }; }
      var r = c.back && c.back.routeId ? routeById(c.back.routeId) : null, rd = (r && r.dates) || {};
      box.replaceChildren();
      add(box, [
        switchIn(ph, 'on', 'Менять надписи по датам', { onChange: function () { draw(); cb.redrawGrid(); },
          hint: 'Подпись внизу маленькой карточки (и, если хотите, статус) сама меняется: до начала, во время, после окончания.' }),
        ph.on ? [
          el('div', { class: 'a-row' }, [
            textIn(ph, 'from', 'С', { type: 'date' }),
            textIn(ph, 'to', 'по', { type: 'date' })]),
          el('p', { class: 'a-hint', text: r && rd.from ? 'Пусто — даты маршрута «' + r.title + '»: ' + fmtDates(rd) + '.' : 'Укажите даты: у карточки не выбран маршрут с датами (раздел «Оборот»).' }),
          sub('Подпись внизу'),
          optIn(ph, 'before', 'До начала', { ph: 'скоро' }),
          optIn(ph, 'during', 'Пока идёт', { ph: 'идёт сейчас' }),
          optIn(ph, 'after', 'После окончания', { ph: 'завершён' }),
          el('p', { class: 'a-hint', text: 'Если у этапа выключено «показывать» — в это время стоит обычная подпись (поле выше).' }),
          switchIn(ph, 'statusAuto', 'Статус тоже по датам', { onChange: function () { draw(); cb.redrawGrid(); },
            hint: 'Если выключить или снять «показывать» у этапа — стоит статус, написанный вручную (поле «Статус» выше).' }),
          ph.statusAuto ? [
            optIn(ph, 'statusBefore', 'Статус до начала', { ph: 'Вход открыт' }),
            optIn(ph, 'statusDuring', 'Статус, пока идёт', { ph: 'Маршрут идёт · можно наблюдать' }),
            optIn(ph, 'statusAfter', 'Статус после окончания', { ph: 'Завершён' })] : null,
          switchIn(ph, 'glow', 'Светиться, пока идёт', { onChange: cb.redrawGrid,
            hint: 'Цвет, сила и направление — из раздела «Оформление». Если там свечение выключено, будет «живое». После окончания погаснет само.' }),
          nowP
        ] : null
      ]);
      updNow();
    }
    var nowP = el('p', { class: 'a-phase-now' });
    // Строка «Сегодня: …» обновляется на ходу, без перерисовки полей (иначе сбивался бы курсор).
    function updNow() {
      var now = window.M13.phaseOf(c, { routes: DATA.routes, settings: DATA.settings });
      nowP.textContent = now ? 'Сегодня: ' + PHASE_NAMES[now.key] + (now.label ? ' — внизу «' + now.label + '»' : ' — внизу обычная подпись') +
          (c.front.phase.statusAuto ? (now.status ? ', статус «' + now.status + '»' : ', статус ручной') : '') + (now.glow ? ', карточка светится.' : '.')
        : 'Пока нет дат — метка не работает, стоит обычная подпись.';
    }
    draw();
    box.addEventListener('input', updNow); box.addEventListener('change', updNow);
    return box;
  }

  /* ---------- Копирование карточки из любого месяца ---------- */
  function copyCardBox(sc, i, cb) {
    var st = { month: sc.id, card: '', armed: false }, box = el('div', { class: 'a-copy' });
    function cardsOf(id) {
      return (DATA.showcases[id].cards || []).map(function (c, k) { return [String(k), (k + 1) + '. ' + ((c.front || {}).title || 'Без названия')]; })
        .filter(function (x) { return !(st.month === sc.id && +x[0] === i); });
    }
    function draw() {
      box.replaceChildren();
      var opts = cardsOf(st.month);
      if (!opts.some(function (x) { return x[0] === st.card; })) st.card = opts.length ? opts[0][0] : '';
      var src = DATA.showcases[st.month].cards[+st.card];
      add(box, [
        el('p', { class: 'a-hint', text: 'Заменить эту карточку копией другой — из этого или любого другого месяца. Копируется всё: лицо, оформление и оборот.' }),
        el('div', { class: 'a-row' }, [
          selectIn(st, 'month', 'Месяц', Object.keys(DATA.showcases).sort().map(function (id) { return [id, DATA.showcases[id].title]; }), { onChange: function () { st.armed = false; draw(); } }),
          selectIn(st, 'card', 'Карточка', opts.length ? opts : [['', 'нет карточек']], { onChange: function () { st.armed = false; draw(); } })]),
        st.armed
          ? el('div', { class: 'a-confirm' }, ['Карточка ' + (i + 1) + ' заменится копией «' + ((src.front || {}).title || '') + '». Точно?',
              el('button', { type: 'button', class: 'a-btn a-btn--small a-btn--danger', text: 'Да, заменить', onclick: function () {
                var n = clone(src); n.id = sc.cards[i].id; delete n._backs;
                if (n.back && n.back.type !== 'static') {
                  n.back = window.M13.toBlocks(n.back);
                  (n.back.blocks || []).forEach(function (x) { x.id = uid('b'); (x.items || []).forEach(function (it) { it.id = uid('i'); }); });
                }
                sc.cards[i] = n; changed(); cb.redrawAll(); toast('Готово: карточка скопирована. Не забудьте нажать «Сохранить».'); } }),
              el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Отмена', onclick: function () { st.armed = false; draw(); } })])
          : el('button', { type: 'button', class: 'a-btn a-btn--small', style: 'align-self:flex-start', text: 'Скопировать сюда', disabled: !src,
              onclick: function () { st.armed = true; draw(); } })]);
    }
    draw();
    return box;
  }

  function itemCalendar(it) {
    var box = el('div', { class: 'a-action' });
    function draw() {
      it.calendar = it.calendar || { on: false, label: 'В календарь', date: '', time: '', duration: 90 };
      box.replaceChildren();
      add(box, [switchIn(it.calendar, 'on', 'Кнопка «Добавить в календарь» на плашке', { onChange: draw,
          hint: 'Человек сохранит встречу в свой календарь — мы ничего о нём не узнаём и не храним.' }),
        it.calendar.on ? [textIn(it.calendar, 'label', 'Текст кнопки', { ph: 'В календарь' })].concat(calFields(it.calendar, { titlePh: 'Пусто — «' + (it.title || '') + '»' })) : null]);
    }
    draw();
    return box;
  }

  function cardForm(sc, i, cb) {
    var c = sc.cards[i];
    c.front = c.front || {};
    delete c._backs;
    var f = c.front;
    var interactive = c.interactive !== false && c.back && c.back.type && c.back.type !== 'static';
    var out = [
      el('div', { class: 'a-formhead' }, [
        el('button', { type: 'button', class: 'a-btn a-btn--small a-toMap', text: '← К сетке', onclick: function () { ST.mobileForm = false; renderMain(); } }),
        el('h2', { text: 'Карточка ' + (i + 1) + ' из 9' }),
        el('button', { type: 'button', class: 'a-btn a-btn--small', text: '← Сдвинуть', disabled: i === 0, onclick: function () { move(-1); } }),
        el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Сдвинуть →', disabled: i === 8, onclick: function () { move(1); } }),
        el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Посмотреть', onclick: function () { openPreview('showcase', sc.id, c.id); } })
      ]),
      el('div', { class: 'a-card', style: 'display:flex;flex-direction:column;gap:12px' }, [
        switchIn(c, 'visible', 'Показывать на витрине', { defTrue: true, hint: 'Если выключить, на этом месте будет пустая аккуратная клетка — сетка не сдвинется.', onChange: cb.redrawGrid }),
        switchIn({ v: interactive }, 'v', 'Карточка открывается и переворачивается', {
          hint: 'Если выключить — карточка просто показывает текст, как центральная «13 MIRRORS». Оборот при этом сохраняется.',
          onChange: function (on) {
            c.interactive = on;
            if (on && (!c.back || !c.back.type || c.back.type === 'static')) c.back = c._back || presetBack('simple');
            if (!on && c.back && c.back.type !== 'static') { c._back = c.back; c.back = { type: 'static' }; }
            if (on) delete c._back;
            changed(); cb.redrawAll();
          } })
      ]),
      block('Лицевая сторона', [
        imageIn(f, 'image', 'Картинка', { hint: 'Можно без картинки. Большие фото уменьшаются автоматически.', onChange: cb.redrawGrid }),
        textIn(f, 'eyebrow', 'Надпись сверху (мелко)', { ph: 'Маршрут, Продукт, Живые встречи…' }),
        textIn(f, 'title', 'Название'),
        optIn(f, 'subtitle', 'Подзаголовок', { ph: 'даты или короткая фраза' }),
        el('div', { class: 'a-row' }, [
          optIn(f, 'status', 'Статус', { ph: 'Вход открыт, Предзаказ, Осталось 3 места…' }),
          selectIn(f, 'statusStyle', 'Как показывать статус', [['line', 'Строкой текста'], ['pill', 'Плашкой (в рамке)']], { onChange: cb.redrawGrid })]),
        optIn(f, 'foot', 'Подпись внизу маленькой карточки', { ph: '3 формата, 4 встречи…' }),
        phaseFields(c, cb)
      ]),
      block('Оформление', [el('p', { class: 'a-hint', text: 'Шрифт, цвет текста, дымка и свечение только для этой карточки.' })]
        .concat(styleFields(f.style = f.style || {}, true, cb.redrawGrid)), { open: false })
    ];
    if (interactive) out.push(block('Оборот', backBlocksForm(c, cb)));
    out.push(block('Скопировать карточку', [copyCardBox(sc, i, cb)], { open: false, note: 'из этого или другого месяца' }));
    return out;

    function move(d) {
      var j = i + d; var t = sc.cards[j]; sc.cards[j] = c; sc.cards[i] = t;
      ST.card = j; changed(); cb.redrawAll();
    }
  }

  /* ================= МАРШРУТЫ ================= */
  function routeUsage(id) {
    var used = [];
    Object.keys(DATA.showcases).forEach(function (k) {
      DATA.showcases[k].cards.forEach(function (c, i) { if (c.back && c.back.routeId === id) used.push(DATA.showcases[k].title + ', карточка ' + (i + 1)); });
    });
    ['days', 'chronicles', 'reviews'].forEach(function (t) {
      (DATA.sandbox[t] || []).forEach(function (x) { if (x.routeId === id) used.push('Песочница'); });
    });
    return used.filter(function (v, i, a) { return a.indexOf(v) === i; });
  }
  function viewRoutes() {
    var list = routes();
    if (ST.openRoute) { list.forEach(function (r) { if (r.id === ST.openRoute) OPENED.add(r); }); ST.openRoute = null; }
    return [
      el('div', {}, [el('h1', { class: 'a-h1', text: 'Маршруты' }),
        el('p', { class: 'a-lead', text: 'Библиотека маршрутов. Маршрут меняется здесь один раз — и обновляется во всех витринах и в Песочнице.' })]),
      collection(list, { ordered: false, title: function (r) { return [r.title, fmtDates(r.dates)].filter(Boolean).join(' · '); },
        canDelete: function (r) { var u = routeUsage(r.id); return u.length ? 'Этот маршрут используется: ' + u.join('; ') + '. Сначала замените его там.' : null; },
        make: function () { return { id: uid('route'), title: 'Новый маршрут', dates: { from: '', to: '' }, kin: { value: '', show: false }, description: '', image: null, routeUrl: '' }; },
        addLabel: '+ Добавить маршрут',
        body: function (r) {
          r.dates = r.dates || { from: '', to: '' };
          return [
            textIn(r, 'title', 'Название'),
            el('div', { class: 'a-row' }, [textIn(r.dates, 'from', 'Первый день', { type: 'date' }), textIn(r.dates, 'to', 'Последний день', { type: 'date' })]),
            optIn(r, 'kin', 'Кин / тон / печать', { ph: 'например, Кин 111' }),
            textIn(r, 'description', 'Описание', { multi: true, rows: 4 }),
            textIn(r, 'routeUrl', 'Ссылка на страницу маршрута', { ph: 'https://13mirrors.ru/yellow-sun/',
              hint: 'Постоянная страница, где идут дни маршрута. Нужна для кнопки «Пройти маршрут».' }),
            imageIn(r, 'image', 'Картинка маршрута')
          ];
        } })
    ];
  }

  /* ================= ПЕСОЧНИЦА ================= */
  function routeOptions() { return [['', '— не указан —']].concat(routes().map(function (r) { return [r.id, r.title]; })); }
  function viewSandbox() {
    var sb = DATA.sandbox;
    sb.tabs = sb.tabs || { days: 'Примеры дней', chronicles: 'Что остаётся', reviews: 'Отзывы' };
    sb.labels = sb.labels || {};
    var t = ST.sbTab;
    var body;
    if (t === 'days') body = collection(sb.days = sb.days || [], { visible: true,
      title: function (x) { var r = routeById(x.routeId); return [r && r.title, x.day ? 'День ' + x.day : '', x.title].filter(Boolean).join(' · '); },
      make: function () { return { id: uid('d'), visible: true, routeId: '', day: null, kin: { value: '', show: false }, tone: { value: '', show: false }, seal: { value: '', show: false },
        title: 'Новый пример дня', meaning: '', question: '', practices: ['', ''], trace: '', image: null }; },
      addLabel: '+ Добавить пример дня',
      body: function (x) {
        x.practices = x.practices || ['', ''];
        return [
          el('div', { class: 'a-row' }, [selectIn(x, 'routeId', 'Маршрут', routeOptions()), textIn(x, 'day', 'Номер дня', { type: 'number' })]),
          el('div', { class: 'a-row3' }, [optIn(x, 'kin', 'Кин'), optIn(x, 'tone', 'Тон'), optIn(x, 'seal', 'Печать')]),
          textIn(x, 'title', 'Заголовок'),
          textIn(x, 'meaning', 'Смысл дня', { multi: true, rows: 4 }),
          textIn(x, 'question', 'Вопрос дня', { multi: true, rows: 2 }),
          el('div', { class: 'a-row' }, [textIn(x.practices, 0, 'Практика 1', { multi: true }), textIn(x.practices, 1, 'Практика 2', { multi: true })]),
          textIn(x, 'trace', '«Твой след»', { multi: true, rows: 2 }),
          imageIn(x, 'image', 'Картинка (необязательно)')
        ];
      } });
    else if (t === 'chronicles') body = collection(sb.chronicles = sb.chronicles || [], { visible: true,
      title: function (x) { var r = routeById(x.routeId); return [x.name, r && r.title].filter(Boolean).join(' · '); },
      make: function () { return { id: uid('c'), visible: true, routeId: '', name: 'Новая Летопись', note: '', fragment: '', lens: '', image: null }; },
      addLabel: '+ Добавить Летопись',
      body: function (x) { return [
        el('div', { class: 'a-row' }, [textIn(x, 'name', 'Название или номер'), selectIn(x, 'routeId', 'Маршрут', routeOptions())]),
        textIn(x, 'note', 'Краткое пояснение', { multi: true, rows: 2 }),
        textIn(x, 'fragment', 'Фрагмент Летописи', { multi: true, rows: 5 }),
        textIn(x, 'lens', '«Линза 13 MIRRORS»', { multi: true, rows: 3 }),
        imageIn(x, 'image', 'Картинка (необязательно)')]; } });
    else body = collection(sb.reviews = sb.reviews || [], { visible: true,
      title: function (x) { var r = routeById(x.routeId); return [x.author, r && r.title, x.month].filter(Boolean).join(' · '); },
      make: function () { return { id: uid('r'), visible: true, text: '', author: 'Участница маршрута', routeId: '', month: '', source: 'Telegram', signature: { show: true } }; },
      addLabel: '+ Добавить отзыв',
      body: function (x) {
        x.signature = x.signature || { show: false };
        return [
          el('p', { class: 'a-note', text: 'Сюда — только текст, подготовленный к публикации, и только с разрешения автора. Скриншоты переписок и исходники здесь не храним.' }),
          textIn(x, 'text', 'Текст отзыва', { multi: true, rows: 5 }),
          el('div', { class: 'a-row' }, [textIn(x, 'author', 'Как подписать', { ph: 'Имя, инициалы или «участница маршрута»' }), selectIn(x, 'routeId', 'Маршрут', routeOptions())]),
          el('div', { class: 'a-row' }, [textIn(x, 'month', 'Месяц и год', { ph: 'Октябрь 2026' }), selectIn(x, 'source', 'Откуда', [['Telegram', 'Telegram'], ['VK', 'VK'], ['другое', 'Другое']])]),
          switchIn(x.signature, 'show', 'Подпись «Опубликовано с разрешения…»')
        ];
      } });

    return [
      el('div', {}, [el('h1', { class: 'a-h1', text: 'Песочница' }),
        el('p', { class: 'a-lead', text: 'Одна общая страница «Как устроены маршруты 13 MIRRORS». В неё ведут кнопки со всех маршрутных карточек.' })]),
      el('div', { class: 'a-tabs' }, [['days', sb.tabs.days], ['chronicles', sb.tabs.chronicles], ['reviews', sb.tabs.reviews]].map(function (x) {
        return el('button', { type: 'button', class: t === x[0] ? 'is-active' : '', text: x[1], onclick: function () { ST.sbTab = x[0]; renderMain(); } });
      }).concat([el('button', { type: 'button', text: 'Посмотреть', onclick: function () { openPreview('sandbox'); } })])),
      body,
      block('Шапка страницы и надписи', [
        textIn(sb, 'eyebrow', 'Надпись сверху'), textIn(sb, 'title', 'Заголовок'), textIn(sb, 'intro', 'Вступление', { multi: true, rows: 2 }),
        optIn(sb, 'notice', 'Плашка-пометка', { hint: 'Например, «Тестовые примеры». Выключите, когда появятся настоящие.' }),
        sub('Названия вкладок'),
        el('div', { class: 'a-row3' }, [textIn(sb.tabs, 'days', 'Дни'), textIn(sb.tabs, 'chronicles', 'Летописи'), textIn(sb.tabs, 'reviews', 'Отзывы')]),
        sub('Подписи разделов внутри примеров'),
        el('div', { class: 'a-row' }, [
          textIn(sb.labels, 'day', 'День', { ph: 'День {n}', hint: '{n} заменится на номер дня' }), textIn(sb.labels, 'meaning', 'Смысл дня'),
          textIn(sb.labels, 'question', 'Вопрос дня'), textIn(sb.labels, 'practice', 'Практика', { ph: 'Практика {n}' }),
          textIn(sb.labels, 'trace', 'Твой след'), textIn(sb.labels, 'fragment', 'Фрагмент Летописи'),
          textIn(sb.labels, 'lens', 'Линза 13 MIRRORS'), textIn(sb.labels, 'review', 'Отзыв')]),
        textIn(sb, 'signatureText', 'Текст подписи под отзывом', { multi: true, rows: 2 })
      ], { open: false })
    ];
  }

  /* ================= КАРТЫ-ОТРАЖЕНИЯ ================= */
  function viewReflection() {
    var rf = DATA.reflection;
    rf.orderAction = rf.orderAction || { show: true, kind: 'contact', label: 'Заказать Карту-Отражение' };
    return [
      el('div', {}, [el('h1', { class: 'a-h1', text: 'Примеры Карт-Отражений' }),
        el('p', { class: 'a-lead', text: 'Страница, которая открывается кнопкой «Примеры» на обороте Карты-Отражения.' })]),
      el('div', { class: 'a-tabs' }, [el('button', { type: 'button', text: 'Посмотреть страницу', onclick: function () { openPreview('reflection'); } })]),
      collection(rf.items = rf.items || [], { visible: true, title: function (x) { return x.title; },
        make: function () { return { id: uid('e'), visible: true, image: null, title: 'Новый пример', text: '' }; }, addLabel: '+ Добавить пример',
        body: function (x) { return [imageIn(x, 'image', 'Изображение'), textIn(x, 'title', 'Название или архетип'), textIn(x, 'text', 'Короткий текст', { multi: true, rows: 2 })]; } }),
      block('Шапка страницы и кнопка', [
        textIn(rf, 'eyebrow', 'Надпись сверху'), textIn(rf, 'title', 'Заголовок'), textIn(rf, 'intro', 'Вступление', { multi: true, rows: 2 }),
        textIn(rf, 'placeholder', 'Надпись на примере без картинки'),
        switchIn(rf.orderAction, 'show', 'Кнопка заказа внизу страницы', { defTrue: true }),
        actionIn(rf, 'orderAction', '', { defLabel: 'Заказать Карту-Отражение' })
      ], { open: false })
    ];
  }

  /* ================= НАСТРОЙКИ ================= */
  var TEXT_LABELS = [
    ['kicker', 'Слово в шапке витрины'], ['draft', 'Пометка черновика'], ['open', 'Кнопка на маленькой карточке'],
    ['flipHint', 'Подсказка на лицевой стороне'], ['formatClosed', 'Подпись закрытого формата'], ['dayCounter', 'Счётчик дней ({n} и {total})'],
    ['contactTitle', 'Заголовок окна контакта'], ['contactMessageLabel', 'Подпись над текстом обращения'], ['contactHint', 'Подсказка в окне контакта'],
    ['contactCopied', 'Сообщение «текст скопирован»'], ['contactMissing', 'Если контакт не задан ({channel})'], ['close', 'Кнопка «Закрыть»'],
    ['calendarTitle', 'Заголовок окна календаря'], ['calendarGoogle', 'Кнопка Google Календаря'], ['calendarOther', 'Кнопка другого календаря'],
    ['calendarNote', 'Пояснение про время'], ['calendarMsk', 'Подпись «по Москве»'], ['calendarButton', 'Кнопка «в календарь» на плашке'],
    ['shareCopied', 'Сообщение «ссылка скопирована»'],
    ['backToCard', 'Кнопка «Назад к карте»'], ['backToShowcase', 'Кнопка «К витрине»'], ['backToList', 'Кнопка «К списку»'], ['loadError', 'Сообщение об ошибке загрузки']
  ];
  function viewSettings() {
    var st = DATA.settings;
    st.contacts = st.contacts || {}; st.texts = st.texts || {}; st.messages = st.messages || {};
    var reset = { armed: false };
    var resetBox = el('div');
    function drawReset() {
      resetBox.replaceChildren();
      add(resetBox, reset.armed
        ? el('div', { class: 'a-confirm' }, ['Все изменения в этом браузере пропадут. Точно?',
            el('button', { type: 'button', class: 'a-btn a-btn--small a-btn--danger', text: 'Да, вернуть исходное', onclick: function () {
              try { localStorage.removeItem(KEY); } catch (e) {}
              DATA = clone(ORIGINAL); dirty = false; savedAt = null; renderShell(); toast('Вернули исходные данные.'); } }),
            el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Отмена', onclick: function () { reset.armed = false; drawReset(); } })])
        : el('button', { type: 'button', class: 'a-btn a-btn--danger', text: 'Вернуть исходные данные…', onclick: function () { reset.armed = true; drawReset(); } }));
    }
    drawReset();
    return [
      el('div', {}, [el('h1', { class: 'a-h1', text: 'Настройки' })]),
      block('Контакты по умолчанию', [
        el('p', { class: 'a-hint', text: 'Сюда ведут все кнопки «Записаться», «Заказать» и т. п., если у кнопки не указаны свои контакты.' }),
        el('div', { class: 'a-row' }, [
          textIn(st.contacts, 'telegram', 'Telegram', { ph: 'имя пользователя без @', hint: 'Например: elena_13mirrors или ссылка t.me/…' }),
          textIn(st.contacts, 'vk', 'VK', { ph: 'короткий адрес страницы', hint: 'Например: id12345678 или имя из адреса vk.com/…' })])
      ]),
      block('Превью ссылки по умолчанию', [
        el('p', { class: 'a-hint', text: 'Картинка и подпись, которые Telegram и VK показывают под ссылкой. Используются для Песочницы, страницы примеров и для месяцев, у которых не задано своё превью.' }),
        shareFields(st.share = st.share || { title: '', description: '', image: null }, {
          resolve: function () { return shareOf(null); }, titlePh: st.siteTitle || '13 MIRRORS',
          titleHint: 'Если оставить пустым — будет название страницы.'
        }),
        textIn(st, 'siteUrl', 'Адрес витрины в интернете', { ph: 'https://13mirrors.ru/vitrina/', hint: 'Нужен мессенджерам, чтобы найти картинку. Менять не нужно.' })
      ], { open: false, note: 'для Песочницы, примеров и месяцев без своего превью' }),
      block('Форматы участия в маршрутах', DATA.formats.formats.map(function (fm) {
        return el('div', { class: 'a-row3' }, [textIn(fm, 'title', 'Название'), textIn(fm, 'price', 'Цена по умолчанию'), optIn(fm, 'note', 'Подпись')]);
      }).concat([el('p', { class: 'a-hint', text: 'В каждой маршрутной карточке цену можно переопределить.' })]), { open: false }),
      block('Готовые тексты обращений', [
        el('p', { class: 'a-hint', text: 'Подставляются, если у кнопки не написан свой текст. Слова в фигурных скобках заменяются сами: {route} — маршрут, {format} — формат, {item} — название плашки, {date} — дата, {card} — название карточки.' }),
        textIn(st.messages, 'route', 'Для форматов маршрута', { multi: true, rows: 2 }),
        textIn(st.messages, 'container', 'Для встреч и услуг', { multi: true, rows: 2 }),
        textIn(st.messages, 'offerItem', 'Для вариантов продукта', { multi: true, rows: 2 }),
        textIn(st.messages, 'offer', 'Для кнопок продукта', { multi: true, rows: 2 }),
        textIn(st.messages, 'text', 'Для текстовых карточек', { multi: true, rows: 2 })
      ], { open: false }),
      block('Надписи на витрине', [el('div', { class: 'a-row' }, TEXT_LABELS.map(function (x) { return textIn(st.texts, x[0], x[1]); }))], { open: false }),
      block('Резервная копия', [backupBox()], { note: 'скачать весь черновик файлом или вернуть из файла' }),
      block('Черновик в этом браузере', [
        el('p', { class: 'a-hint', text: GHS.token ? 'Кроме GitHub, черновик всегда запоминается и в этом браузере — на случай, если пропадёт связь.' : 'Пока вы не вошли в GitHub, изменения хранятся только в этом браузере на этом устройстве.' }),
        resetBox
      ], { open: false })
    ];
  }

  /* ================= ГЛАВНАЯ СТРАНИЦА 13mirrors.ru =================
     Тексты, картинки, цвет и шрифт главной хранятся в settings.home и публикуются вместе с витриной.
     Главная страница сама читает их из /vitrina/data/settings.json. Пустое поле — остаётся то, что в самой странице. */
  var HOME_DEFAULT = {
    imageWide: null, imageTall: null,
    lead1: 'Авторские психологические маршруты.', lead2: 'Created with you. For you.',
    promise: '13 MIRRORS не создаёт твоих миров.\nОн помогает их открыть.',
    story: 'Помнишь калейдоскоп? С каждым поворотом в нём рождается новый узор, но сам он ничего не создаёт — лишь меняет угол зрения.\n\nПереступая этот порог, ты не найдёшь готовых ответов, но здесь всегда есть вопрос. Здесь открываются твои миры и продолжается Путь к Себе.',
    scheduleWord: 'Расписание', ask: 'Задать вопрос',
    footer: '© 13 MIRRORS. Все материалы являются частью авторской разработки 13 MIRRORS.\n\nИспользование и воспроизведение — только с указанием авторства и по согласованию с автором.',
    accent: '#ecd3a3', font: 'Cormorant Garamond'
  };
  var HOME_FONTS = ['Cormorant Garamond', 'Lora', 'Playfair Display', 'Philosopher'];
  var MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function viewHome() {
    var st = DATA.settings, h = st.home = st.home || clone(HOME_DEFAULT);
    Object.keys(HOME_DEFAULT).forEach(function (k) { if (h[k] === undefined) h[k] = HOME_DEFAULT[k]; });
    var resetBox = el('div'), armed = false;
    function drawReset() {
      resetBox.replaceChildren();
      add(resetBox, armed
        ? el('div', { class: 'a-confirm' }, ['Тексты, картинки, цвет и шрифт главной вернутся к исходным. Точно?',
            el('button', { type: 'button', class: 'a-btn a-btn--small a-btn--danger', text: 'Да', onclick: function () { st.home = clone(HOME_DEFAULT); changed(); renderMain(); } }),
            el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Нет', onclick: function () { armed = false; drawReset(); } })])
        : el('button', { type: 'button', class: 'a-btn a-btn--small a-btn--ghost', text: 'Вернуть как было при запуске…', onclick: function () { armed = true; drawReset(); } }));
    }
    drawReset();
    return [
      el('div', {}, [el('h1', { class: 'a-h1', text: 'Главная страница' }),
        el('p', { class: 'a-lead', text: 'То, что видно по адресу 13mirrors.ru. Изменения появятся на сайте после «Опубликовать». Логотип и расположение блоков остаются как есть.' })]),
      el('div', { class: 'a-tabs' }, [
        el('button', { type: 'button', text: 'Посмотреть главную', onclick: function () { openHomePreview(false); } }),
        el('button', { type: 'button', text: '📱 Как на телефоне', onclick: function () { openHomePreview(true); } })]),
      block('Картинки', [
        el('div', { class: 'a-row' }, [
          imageIn(h, 'imageWide', 'Для компьютера — горизонтальная', { max: 2400, hint: 'Пусто — дверь, как сейчас. Логотип и текст стоят слева, поэтому левая часть картинки должна быть тёмной и спокойной.' }),
          imageIn(h, 'imageTall', 'Для телефона — вертикальная', { max: 2000, hint: 'Пусто — вертикальная дверь. Показывается верхняя часть, ниже — тёмный фон с текстом.' })])
      ]),
      block('Тексты', [
        el('div', { class: 'a-row' }, [textIn(h, 'lead1', 'Фраза под логотипом'), textIn(h, 'lead2', 'Вторая строка (курсивом)')]),
        textIn(h, 'promise', 'Строка с чертой слева', { multi: true, rows: 2, hint: 'Перенос строки — там, где нажмёте Enter.' }),
        textIn(h, 'story', 'Текст ниже', { multi: true, rows: 7, hint: 'Пустая строка между абзацами — новый абзац.' }),
        el('div', { class: 'a-row' }, [
          textIn(h, 'scheduleWord', 'Слово на кнопке', { hint: 'Название месяца добавится само: «' + (h.scheduleWord || 'Расписание') + ' ' + monthGenNow() + '».' }),
          textIn(h, 'ask', 'Ссылка в конце', { hint: 'Открывает окошко с Telegram и VK из «Настройки → Контакты».' })]),
        textIn(h, 'footer', 'Пометка внизу страницы', { multi: true, rows: 3 })
      ]),
      block('Цвет и шрифт', [
        el('div', { class: 'a-row' }, [
          colorIn(h, 'accent', 'Акцентный цвет — кнопка, курсив, ссылки'),
          selectIn(h, 'font', 'Шрифт текстов', HOME_FONTS.map(function (f) { return [f, f]; }), { hint: 'Логотип — картинка, он не меняется.' })])
      ], { open: false }),
      resetBox
    ];
  }
  function monthGenNow() { var m = /^\d{4}-(\d{2})$/.exec(DATA.settings.currentShowcase || ''); return m ? MONTHS_GEN[+m[1] - 1] : 'месяца'; }
  function openHomePreview(phone) {
    var pv = document.getElementById('a-preview');
    var fr = el('iframe', { class: phone ? 'a-phone-screen' : 'a-home-frame', title: 'Главная страница', src: '/?preview=1' });
    if (phone) fr.style.width = '375px';
    function send() { try { fr.contentWindow.postMessage({ m13home: DATA.settings.home || {}, contacts: DATA.settings.contacts || {}, monthGen: monthGenNow() }, location.origin); } catch (e) {} }
    fr.addEventListener('load', function () { send(); setTimeout(send, 400); });
    function onMsg(e) { if (e.origin === location.origin && e.data && e.data.m13homeReady) send(); }
    window.addEventListener('message', onMsg);
    var bar = el('div', { class: 'a-pbar' }, [
      el('button', { type: 'button', class: 'a-pclose', text: '← В панель', onclick: function () { window.removeEventListener('message', onMsg); closePreview(); } }),
      el('button', { type: 'button', class: 'a-pphone', text: phone ? '🖥 Как на компьютере' : '📱 Как на телефоне', onclick: function () { window.removeEventListener('message', onMsg); openHomePreview(!phone); } })]);
    pv.classList.toggle('is-phone', phone);
    pv.replaceChildren(phone ? el('div', { class: 'a-phone' }, [el('div', { class: 'a-phone-body' }, fr)]) : fr, bar);
    pv.classList.add('is-open'); document.body.style.overflow = 'hidden';
  }

  /* ================= ПРЕДПРОСМОТР ================= */
  // Два режима: во всё окно и «Как на телефоне». Для телефона витрина рисуется во встроенном окне (iframe)
  // шириной 375 px: у него своя ширина экрана, поэтому включается настоящая мобильная раскладка.
  var PHONE = { w: 375 }, pvPhone = false;
  function canPhone() { return window.innerWidth >= 600; }
  function previewData(showcaseId) {
    return { settings: DATA.settings, routes: DATA.routes, formats: DATA.formats, sandbox: DATA.sandbox, reflection: DATA.reflection,
      index: DATA.index, showcase: DATA.showcases[showcaseId] };
  }
  // Окно-«телефон»: пишем в пустой iframe страницу с тем же рендерером и ждём, пока он загрузится.
  // Вызывать, когда iframe уже вставлен в страницу.
  function fillPhone(fr, onReady) {
    var d = fr.contentDocument, base = location.href.replace(/[#?].*$/, '');
    d.open();
    d.write('<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><base href="' + base + '">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="stylesheet" href="../assets/vitrina.css"></head>' +
      '<body class="m13-body"><div id="m13"></div><script src="../assets/vitrina.js"><\/script></body></html>');
    d.close();
    var w = fr.contentWindow, tries = 0;
    (function wait() {
      if (w.M13 && w.M13.mount) onReady(w, w.document.getElementById('m13'));
      else if (++tries < 300) setTimeout(wait, 30);
      else toast('Не получилось показать витрину в режиме телефона. Обновите страницу.', true);
    })();
  }
  function openPreview(view, showcaseId, cardId) {
    if (!view) view = ST.section === 'sandbox' ? 'sandbox' : ST.section === 'reflection' ? 'reflection' : 'showcase';
    showcaseId = showcaseId || ST.showcase || DATA.settings.currentShowcase;
    var pv = document.getElementById('a-preview');
    var cur = view, M = null, mount = null;
    function go(v) {
      cur = v;
      bar.querySelectorAll('[data-v]').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-v') === v); });
      M.mount(mount, { base: '../', view: v, noHistory: true, onBack: function () { go('showcase'); }, data: previewData(showcaseId) })
        .then(function () { if (cardId && v === 'showcase') { M.openCard(cardId, true); cardId = null; } });
      pv.scrollTop = 0;
    }
    function build() {
      var usePhone = pvPhone && canPhone();
      pv.classList.toggle('is-phone', usePhone);
      phoneBtn.textContent = usePhone ? '🖥 Как на компьютере' : '📱 Как на телефоне';
      if (usePhone) {
        var fr = el('iframe', { class: 'a-phone-screen', title: 'Витрина на экране телефона', style: 'width:' + PHONE.w + 'px' });
        pv.replaceChildren(el('div', { class: 'a-phone' }, [el('div', { class: 'a-phone-body' }, fr),
          el('p', { class: 'a-phone-note', text: 'Экран ' + PHONE.w + ' px — как у обычного телефона. Внутри можно нажимать и листать.' })]), bar);
        fillPhone(fr, function (w, m) { M = w.M13; mount = m; go(cur); });
      } else {
        mount = el('div'); M = window.M13;
        pv.replaceChildren(mount, bar);
        go(cur);
      }
    }
    var phoneBtn = el('button', { type: 'button', class: 'a-pphone', onclick: function () {
      pvPhone = !pvPhone; document.body.classList.remove('m13-locked'); build(); } });
    var bar = el('div', { class: 'a-pbar' }, [
      el('button', { type: 'button', class: 'a-pclose', text: '← В панель', onclick: closePreview }),
      el('button', { type: 'button', 'data-v': 'showcase', text: 'Витрина', onclick: function () { go('showcase'); } }),
      el('button', { type: 'button', 'data-v': 'sandbox', text: 'Песочница', onclick: function () { go('sandbox'); } }),
      el('button', { type: 'button', 'data-v': 'reflection', text: 'Примеры', onclick: function () { go('reflection'); } }),
      canPhone() ? phoneBtn : null
    ]);
    pv.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    build();
  }
  function closePreview() {
    var pv = document.getElementById('a-preview');
    pv.classList.remove('is-open', 'is-phone'); pv.replaceChildren();
    document.body.style.overflow = ''; document.body.classList.remove('m13-locked');
  }

  /* ---------- Запуск ---------- */
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (dirty) save(); }
    if (e.key === 'Escape') {
      // Проверяем до того, как витрина закроет свою карточку (фаза перехвата): Esc закрывает только верхний слой
      var pv = document.getElementById('a-preview');
      if (pv && pv.classList.contains('is-open') && !document.querySelector('.a-preview .m13-overlay.is-open, .a-preview .m13-modal.is-open, .a-preview .m13-internal.is-open, .a-preview .m13-lb.is-open')) closePreview();
    }
  }, true);

  // Приводит данные к нынешнему виду (старые обороты → блоки).
  function migrate(D) {
    D.showcases = D.showcases || {};
    Object.keys(D.showcases).forEach(function (k) {
      (D.showcases[k].cards || []).forEach(function (c) {
        if (c.back && c.back.type !== 'static') c.back = window.M13.toBlocks(c.back);
        if (c._backs) delete c._backs;
      });
    });
    return D;
  }

  /* ================= GITHUB: вход, сохранение, публикация =================
     Черновик — в приватном репозитории 13mirrors-content (та же структура data/…, картинки внутри JSON).
     Сайт — в публичном vitrina: очищенные JSON, картинки файлами media/…, HTML-страницы с превью.
     Запись — одним коммитом через Git Data API (blobs → tree → commit → ref). Ключ — только в sessionStorage. */
  var GH = { owner: 'elenarasprugina', content: '13mirrors-content', site: 'vitrina', api: 'https://api.github.com' };
  var TOKEN_KEY = 'm13-gh-token';
  var GHS = { token: null, user: '', branch: {}, contentHead: null, contentTime: null, busy: false };
  try { GHS.token = sessionStorage.getItem(TOKEN_KEY) || null; } catch (e) {}

  function ghErr(status, what) {
    var e = new Error(status === 401 ? 'GitHub не принял ключ: возможно, он скопирован не полностью или срок его действия закончился. Создайте новый ключ и войдите снова.'
      : status === 403 ? 'У ключа нет нужных прав' + (what ? ' к репозиторию «' + what + '»' : '') + '. При создании ключа нужно выбрать оба репозитория и разрешить Contents: «Read and write».'
      : status === 404 ? 'Не найден репозиторий' + (what ? ' «' + what + '»' : '') + ' — или ключу не дали к нему доступ. Проверьте, что при создании ключа выбраны 13mirrors-content и vitrina.'
      : status === 409 || status === 422 ? 'GitHub отказался записать изменения: пока мы работали, данные там изменились. Попробуйте ещё раз.'
      : status === 0 ? 'Нет связи с GitHub. Проверьте интернет и попробуйте ещё раз.'
      : 'GitHub ответил ошибкой (' + status + '). Попробуйте ещё раз через минуту.');
    e.status = status; return e;
  }
  function api(method, path, body, what) {
    return fetch(GH.api + path, {
      method: method, cache: 'no-store',
      headers: { 'Authorization': 'Bearer ' + GHS.token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { var e = ghErr(r.status, what); e.gh = j; throw e; });
      return r.status === 204 ? null : r.json();
    }, function () { throw ghErr(0); });
  }
  function repoPath(repo) { return '/repos/' + GH.owner + '/' + repo; }
  function b64utf8(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function unb64utf8(b64) {
    var bin = atob(String(b64).replace(/\s/g, '')), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  // Ветка по умолчанию и последний коммит. Пустой репозиторий → null.
  function repoInfo(repo) {
    return api('GET', repoPath(repo), null, repo).then(function (r) {
      if (!r.permissions || !r.permissions.push) throw ghErr(403, repo);
      GHS.branch[repo] = r.default_branch || 'main';
      return r;
    });
  }
  function headOf(repo) {
    return api('GET', repoPath(repo) + '/git/ref/heads/' + GHS.branch[repo], null, repo)
      .then(function (r) { return r.object.sha; }, function (e) { if (e.status === 409 || e.status === 404) return null; throw e; });
  }
  // Первый файл в пустой репозиторий (Git Data API с пустым репозиторием не работает).
  function initRepo(repo) {
    return api('PUT', repoPath(repo) + '/contents/README.md', { message: 'Начало', content: b64utf8('# ' + repo + '\n\nЗаполняется из панели управления витриной 13 MIRRORS.\n') }, repo)
      .then(function (r) { return r.commit.sha; });
  }
  function treeOf(repo, commitSha) {
    return api('GET', repoPath(repo) + '/git/commits/' + commitSha, null, repo).then(function (c) {
      return api('GET', repoPath(repo) + '/git/trees/' + c.tree.sha + '?recursive=1', null, repo).then(function (t) {
        var map = {};
        (t.tree || []).forEach(function (x) { if (x.type === 'blob') map[x.path] = x.sha; });
        return { treeSha: c.tree.sha, files: map, date: (c.committer || c.author || {}).date || null };
      });
    });
  }
  function readText(repo, sha) {
    return api('GET', repoPath(repo) + '/git/blobs/' + sha, null, repo).then(function (b) {
      return b.encoding === 'base64' ? unb64utf8(b.content) : b.content;
    });
  }
  // files: { путь: {text} | {b64} | null (удалить) }. Возвращает sha нового коммита (или прежний, если ничего не изменилось).
  function commitFiles(repo, baseSha, baseTree, files, message, progress) {
    var paths = Object.keys(files), entries = [], done = 0;
    function next(i) {
      if (i >= paths.length) return Promise.resolve();
      var path = paths[i], f = files[path];
      if (f === null) { entries.push({ path: path, mode: '100644', type: 'blob', sha: null }); return next(i + 1); }
      var body = f.b64 != null ? { content: f.b64, encoding: 'base64' } : { content: f.text, encoding: 'utf-8' };
      return api('POST', repoPath(repo) + '/git/blobs', body, repo).then(function (b) {
        entries.push({ path: path, mode: '100644', type: 'blob', sha: b.sha });
        done++; if (progress) progress(done, paths.length);
        return next(i + 1);
      });
    }
    return next(0).then(function () {
      return api('POST', repoPath(repo) + '/git/trees', { base_tree: baseTree, tree: entries }, repo);
    }).then(function (t) {
      if (t.sha === baseTree) return baseSha;
      return api('POST', repoPath(repo) + '/git/commits', { message: message, tree: t.sha, parents: [baseSha] }, repo).then(function (c) {
        return api('PATCH', repoPath(repo) + '/git/refs/heads/' + GHS.branch[repo], { sha: c.sha, force: false }, repo).then(function () { return c.sha; });
      });
    });
  }

  /* ---------- Данные ↔ файлы ---------- */
  var DATA_FILES = ['settings', 'routes', 'formats', 'sandbox', 'reflection'];
  function jsonText(o) { return JSON.stringify(o, null, 2) + '\n'; }
  function draftFiles(D) {
    var out = {};
    DATA_FILES.forEach(function (n) { out['data/' + n + '.json'] = { text: jsonText(D[n]) }; });
    out['data/showcases/index.json'] = { text: jsonText(D.index) };
    Object.keys(D.showcases).forEach(function (id) { out['data/showcases/' + id + '.json'] = { text: jsonText(D.showcases[id]) }; });
    return out;
  }
  function loadDraftFrom(repo, head) {
    return treeOf(repo, head).then(function (t) {
      if (!t.files['data/settings.json']) return { empty: true, date: t.date };
      var D = { showcases: {} }, jobs = [];
      DATA_FILES.forEach(function (n) {
        var sha = t.files['data/' + n + '.json'];
        jobs.push(sha ? readText(repo, sha).then(function (x) { D[n] = JSON.parse(x); }) : Promise.resolve());
      });
      Object.keys(t.files).forEach(function (p) {
        var m = /^data\/showcases\/(\d{4}-\d{2})\.json$/.exec(p);
        if (m) jobs.push(readText(repo, t.files[p]).then(function (x) { D.showcases[m[1]] = JSON.parse(x); }));
      });
      if (t.files['data/showcases/index.json']) jobs.push(readText(repo, t.files['data/showcases/index.json']).then(function (x) { D.index = JSON.parse(x); }));
      return Promise.all(jobs).then(function () {
        DATA_FILES.forEach(function (n) { if (!D[n]) D[n] = clone(ORIGINAL[n]); });
        return { data: D, date: t.date };
      });
    });
  }

  /* ---------- Окно-вопрос и окно «идёт работа» ---------- */
  function dialog(o) {
    return new Promise(function (resolve) {
      var ov = el('div', { class: 'a-dialog' });
      function close(v) { ov.remove(); resolve(v); }
      add(ov, el('div', { class: 'a-dialog-box', role: 'dialog', 'aria-modal': 'true' }, [
        el('h3', { text: o.title }),
        o.body ? (typeof o.body === 'string' ? el('p', { text: o.body }) : o.body) : null,
        el('div', { class: 'a-dialog-btns' }, (o.buttons || [['ok', 'Понятно', 'dark']]).map(function (b) {
          return el('button', { type: 'button', class: 'a-btn' + (b[2] ? ' a-btn--' + b[2] : ''), text: b[1], onclick: function () { close(b[0]); } });
        }))]));
      document.body.appendChild(ov);
      var first = ov.querySelector('.a-dialog-btns .a-btn--dark') || ov.querySelector('.a-dialog-btns .a-btn');
      if (first) first.focus();
    });
  }
  var busyBox = null;
  function busy(text) {
    if (text == null) { if (busyBox) busyBox.remove(); busyBox = null; GHS.busy = false; updateState(); return; }
    GHS.busy = true;
    if (!busyBox) { busyBox = el('div', { class: 'a-dialog' }, el('div', { class: 'a-dialog-box a-busy' }, [el('div', { class: 'a-spinner' }), el('p')])); document.body.appendChild(busyBox); }
    busyBox.querySelector('p').textContent = text;
  }
  function fail(e) {
    busy(null); console.error(e);
    return dialog({ title: 'Не получилось', body: (e && e.message) || 'Что-то пошло не так. Попробуйте ещё раз.' });
  }

  /* ---------- Вход ---------- */
  function openLogin() {
    var st = { token: '' };
    var input = el('input', { class: 'a-input', type: 'password', autocomplete: 'off', placeholder: 'github_pat_…' });
    input.addEventListener('input', function () { st.token = input.value.trim(); });
    var body = el('div', { class: 'a-login' }, [
      el('p', { text: 'Вставьте ключ доступа GitHub (он начинается с github_pat_). Ключ хранится только в этой вкладке и забывается, когда вы её закрываете.' }),
      input,
      el('p', { class: 'a-hint', text: 'Как получить ключ — в инструкции «Первый вход и публикация». Никому не пересылайте ключ, даже помощникам.' })]);
    dialog({ title: 'Вход в GitHub', body: body, buttons: [['go', 'Войти', 'dark'], ['cancel', 'Отмена']] }).then(function (v) {
      if (v !== 'go') return;
      if (!/^(github_pat_|ghp_)\w{20,}/.test(st.token)) { dialog({ title: 'Ключ не похож на настоящий', body: 'Ключ GitHub начинается с «github_pat_» и довольно длинный. Скопируйте его целиком и попробуйте снова.' }); return; }
      GHS.token = st.token;
      connect(true);
    });
    setTimeout(function () { input.focus(); }, 50);
  }
  function logout() {
    GHS.token = null; GHS.user = ''; GHS.contentHead = null;
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
    renderShell(); toast('Вы вышли из GitHub. Черновик остался в этом браузере.');
  }
  // Проверить ключ и оба репозитория, загрузить черновик из GitHub.
  function connect(fresh) {
    busy('Подключаемся к GitHub…');
    return api('GET', '/user').then(function (u) {
      GHS.user = u.login || '';
      return repoInfo(GH.content);
    }).then(function () { return repoInfo(GH.site); }).then(function () {
      try { sessionStorage.setItem(TOKEN_KEY, GHS.token); } catch (e) {}
      busy('Загружаем черновик из GitHub…');
      return headOf(GH.content);
    }).then(function (head) {
      GHS.contentHead = head;
      if (!head) return { empty: true };
      return loadDraftFrom(GH.content, head);
    }).then(function (res) {
      busy(null);
      if (res.empty) {
        renderShell();
        dialog({ title: 'Вы вошли в GitHub', body: 'В репозитории черновиков пока пусто. Нажмите «Сохранить» — текущий черновик из этого браузера запишется туда.' });
        dirty = true; updateState();
        return;
      }
      GHS.contentTime = res.date;
      var gh = migrate(res.data), same = JSON.stringify(gh) === JSON.stringify(DATA);
      var hasLocal = false;
      try { hasLocal = !!localStorage.getItem(KEY); } catch (e) {}
      if (same || !hasLocal) { useData(gh); if (fresh) toast('Вы вошли в GitHub. Черновик загружен.'); return; }
      var fmt = function (d) { return d ? new Date(d).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'неизвестно когда'; };
      return dialog({ title: 'Какой черновик открыть?',
        body: 'Черновик в GitHub (сохранён ' + fmt(res.date) + ') отличается от черновика в этом браузере (' + (savedAt ? 'сохранён ' + fmt(savedAt) : 'не сохранён') + ').',
        buttons: [['gh', 'Из GitHub', 'dark'], ['local', 'Из этого браузера']] }).then(function (v) {
        if (v === 'gh') { useData(gh); toast('Открыт черновик из GitHub.'); }
        else { dirty = true; renderShell(); toast('Открыт черновик из этого браузера. Нажмите «Сохранить», чтобы записать его в GitHub.'); }
      });
    }).catch(function (e) {
      if (e.status === 401 || e.status === 403 || e.status === 404) { GHS.token = null; try { sessionStorage.removeItem(TOKEN_KEY); } catch (x) {} }
      renderShell(); return fail(e);
    });
  }
  function useData(D) {
    DATA = D; dirty = false;
    try { localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), data: DATA })); savedAt = Date.now(); } catch (e) {}
    renderShell();
  }

  /* ---------- Сохранение в GitHub ---------- */
  function saveToGitHub(quiet) {
    if (!GHS.token) return Promise.resolve(false);
    syncIndex();
    busy('Сохраняем черновик в GitHub…');
    return headOf(GH.content).then(function (head) {
      if (head && GHS.contentHead && head !== GHS.contentHead) {
        busy(null);
        return dialog({ title: 'Черновик в GitHub изменился', body: 'Пока вы работали, черновик в GitHub сохранили с другого устройства или вкладки. Если сохранить сейчас — те изменения заменятся этими.',
          buttons: [['over', 'Сохранить мои изменения', 'dark'], ['load', 'Открыть версию из GitHub'], ['cancel', 'Отмена']] }).then(function (v) {
          if (v === 'load') { GHS.contentHead = head; return connect(false).then(function () { return false; }); }
          if (v !== 'over') return false;
          busy('Сохраняем черновик в GitHub…');
          return head;
        });
      }
      return head || initRepo(GH.content);
    }).then(function (head) {
      if (!head) return false;
      return treeOf(GH.content, head).then(function (t) {
        var files = draftFiles(DATA);
        Object.keys(t.files).forEach(function (p) { if (/^data\/showcases\/\d{4}-\d{2}\.json$/.test(p) && !files[p]) files[p] = null; });
        return commitFiles(GH.content, head, t.treeSha, files, 'Черновик: ' + new Date().toLocaleString('ru-RU'));
      }).then(function (sha) {
        GHS.contentHead = sha; GHS.contentTime = new Date().toISOString();
        busy(null); updateState();
        if (!quiet) toast('Сохранено в GitHub. На сайте пока ничего не изменилось — для этого есть «Опубликовать».');
        return true;
      });
    }).catch(function (e) { fail(e); return false; });
  }

  /* ---------- Публикация ---------- */
  // Очистка для сайта: без скрытого (show:false, visible:false, выключенные этапы и календари), без служебных полей «_…».
  function cleanDeep(o) {
    if (Array.isArray(o)) return o.filter(function (x) { return !(x && typeof x === 'object' && x.visible === false); }).map(cleanDeep);
    if (!o || typeof o !== 'object') return o;
    var out = {};
    Object.keys(o).forEach(function (k) {
      var v = o[k];
      if (k.charAt(0) === '_') return;
      if (v && typeof v === 'object' && !Array.isArray(v) && v.show === false) return;
      if ((k === 'phase' || k === 'calendar') && v && typeof v === 'object' && !v.on) return;
      out[k] = cleanDeep(v);
    });
    return out;
  }
  function cleanShowcase(sc) {
    var cards = (sc.cards || []).map(function (c) { return c && c.visible === false ? { id: c.id, visible: false } : c; });
    var out = cleanDeep(Object.assign({}, sc, { cards: [] }));
    out.cards = cards.map(function (c) { return c.visible === false ? c : cleanDeep(c); });
    return out;
  }
  function publishedIds(D) { return Object.keys(D.showcases).filter(function (id) { return D.showcases[id].status === 'published'; }).sort(); }
  function buildSite(D) {
    var P = { showcases: {} }, ids = publishedIds(D);
    DATA_FILES.forEach(function (n) { P[n] = cleanDeep(D[n]); });
    ids.forEach(function (id) { P.showcases[id] = cleanShowcase(D.showcases[id]); });
    P.index = { showcases: ids.map(function (id) { var s = D.showcases[id]; return { id: id, title: s.title, status: 'published' }; }) };
    return P;
  }
  // Картинки data:… → файлы media/<отпечаток>.<расширение>. Одинаковые картинки — один файл.
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function extractImages(P) {
    var found = {}, list = [];
    (function walk(o) {
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach(function (k) {
        var v = o[k];
        if (typeof v === 'string' && /^data:image\//.test(v)) { if (!found[v]) { found[v] = true; list.push(v); } }
        else walk(v);
      });
    })(P);
    var map = {}, media = {};
    return Promise.all(list.map(function (uri) {
      var m = /^data:image\/([a-z+]+);base64,(.*)$/i.exec(uri);
      if (!m) return null;
      var ext = { jpeg: 'jpg', 'svg+xml': 'svg' }[m[1].toLowerCase()] || m[1].toLowerCase();
      var bin = atob(m[2]), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return crypto.subtle.digest('SHA-1', bytes).then(function (h) {
        var path = 'media/' + hex(h).slice(0, 20) + '.' + ext;
        map[uri] = path; media[path] = m[2];
      });
    })).then(function () {
      (function walk(o) {
        if (Array.isArray(o)) { o.forEach(walk); return; }
        if (!o || typeof o !== 'object') return;
        Object.keys(o).forEach(function (k) { var v = o[k]; if (typeof v === 'string' && map[v]) o[k] = map[v]; else walk(v); });
      })(P);
      return media;
    });
  }
  function siteFiles(P, media, existing) {
    var files = {};
    DATA_FILES.forEach(function (n) { files['data/' + n + '.json'] = { text: jsonText(P[n]) }; });
    files['data/showcases/index.json'] = { text: jsonText(P.index) };
    files['index.html'] = { text: pageHTML('main', null, P) };
    files['sandbox/index.html'] = { text: pageHTML('sandbox', null, P) };
    files['reflection/index.html'] = { text: pageHTML('reflection', null, P) };
    Object.keys(P.showcases).forEach(function (id) {
      var sc = P.showcases[id];
      files['data/showcases/' + id + '.json'] = { text: jsonText(sc) };
      files[id + '/index.html'] = { text: pageHTML('month', id, P) };
      (sc.cards || []).forEach(function (c) {
        if (c.visible === false || c.interactive === false || !c.back || c.back.type === 'static' || !/^[\w-]+$/.test(c.id)) return;
        files[id + '/' + c.id + '/index.html'] = { text: pageHTML('card', id, P, c.id) };
      });
    });
    Object.keys(media).forEach(function (p) { if (!existing[p]) files[p] = { b64: media[p] }; });
    // Снять с сайта месяцы, которые больше не опубликованы, и страницы удалённых карточек.
    var removed = [];
    Object.keys(existing).forEach(function (p) {
      var m = /^data\/showcases\/(\d{4}-\d{2})\.json$/.exec(p) || /^(\d{4}-\d{2})\//.exec(p);
      if (m && !files[p]) { files[p] = null; if (!P.showcases[m[1]] && removed.indexOf(m[1]) < 0) removed.push(m[1]); }
    });
    return { files: files, removed: removed };
  }
  function publish() {
    if (GHS.busy) return;
    if (!GHS.token) {
      dialog({ title: 'Сначала войдите в GitHub', body: 'Чтобы опубликовать витрину, нужен вход в GitHub — кнопка «Войти в GitHub» вверху.', buttons: [['login', 'Войти', 'dark'], ['cancel', 'Отмена']] })
        .then(function (v) { if (v === 'login') openLogin(); });
      return;
    }
    syncIndex();
    var ids = publishedIds(DATA), st = DATA.settings;
    if (!ids.length || ids.indexOf(st.currentShowcase) < 0) {
      var cur = DATA.showcases[st.currentShowcase];
      var why = !ids.length
        ? 'Ни одна витрина не отмечена как опубликованная, поэтому месяцы на сайт не попадут. Когда месяц будет готов — поставьте ему статус «Опубликована» (раздел «Витрины» → «Страница месяца»).'
        : 'По адресу 13mirrors.ru/vitrina/ открывается «' + (cur ? cur.title : st.currentShowcase) + '», но эта витрина — черновик. Поставьте ей статус «Опубликована» или включите «Открывать по основному адресу» у опубликованного месяца.';
      dialog({ title: 'Витрину пока не публикуем', body: why + '\n\nМожно опубликовать только главную страницу и настройки — контакты, надписи. Черновики месяцев при этом на сайт не попадут.',
        buttons: [['home', 'Опубликовать главную и контакты', 'dark'], ['cancel', 'Отмена']] }).then(function (v) { if (v === 'home') publishSettingsOnly(); });
      return;
    }
    var drafts = Object.keys(DATA.showcases).filter(function (id) { return ids.indexOf(id) < 0; });
    var body = el('div', {}, [
      el('p', { text: 'На сайт попадут: ' + ids.map(function (id) { return DATA.showcases[id].title; }).join(', ') + '. По основному адресу — «' + DATA.showcases[st.currentShowcase].title + '».' }),
      drafts.length ? el('p', { text: 'Останутся черновиками (на сайт не попадут): ' + drafts.map(function (id) { return DATA.showcases[id].title; }).join(', ') + '.' }) : null,
      el('p', { class: 'a-hint', text: 'Скрытые карточки, выключенные поля и служебные пометки на сайт не попадают. Черновик перед публикацией сохранится в GitHub.' })]);
    dialog({ title: 'Опубликовать витрину?', body: body, buttons: [['go', 'Опубликовать', 'dark'], ['cancel', 'Отмена']] }).then(function (v) {
      if (v !== 'go') return;
      if (dirty) try { localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), data: DATA })); savedAt = Date.now(); dirty = false; updateState(); } catch (e) {}
      saveToGitHub(true).then(function (ok) {
        if (!ok) return;
        var P = buildSite(DATA), media, removed = [];
        busy('Готовим картинки…');
        return extractImages(P).then(function (m) {
          media = m;
          busy('Смотрим, что сейчас на сайте…');
          return headOf(GH.site);
        }).then(function (head) { return head || initRepo(GH.site); }).then(function (head) {
          return treeOf(GH.site, head).then(function (t) {
            var sf = siteFiles(P, media, t.files); removed = sf.removed;
            busy('Публикуем…');
            return commitFiles(GH.site, head, t.treeSha, sf.files, 'Публикация: ' + ids.map(function (id) { return DATA.showcases[id].title; }).join(', '),
              function (d, n) { busy('Публикуем… ' + Math.round(d / n * 100) + '%'); });
          });
        }).then(function () {
          busy(null);
          dialog({ title: 'Опубликовано', body: 'Сайт обновится в течение пары минут: 13mirrors.ru/vitrina/' +
            (removed.length ? '\n\nСняты с сайта: ' + removed.map(function (id) { return (DATA.showcases[id] || {}).title || id; }).join(', ') + '.' : '') +
            '\n\nЕсли ссылкой уже делились в Telegram или VK, старое превью может держаться ещё какое-то время.' });
        });
      }).catch(fail);
    });
  }

  // Публикация только настроек (главная страница, контакты, надписи) — без месяцев.
  function publishSettingsOnly() {
    if (dirty) try { localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), data: DATA })); savedAt = Date.now(); dirty = false; updateState(); } catch (e) {}
    saveToGitHub(true).then(function (ok) {
      if (!ok) return;
      var P = { settings: cleanDeep(DATA.settings) }, media;
      busy('Готовим картинки…');
      return extractImages(P).then(function (m) { media = m; busy('Смотрим, что сейчас на сайте…'); return headOf(GH.site); })
        .then(function (head) { return head || initRepo(GH.site); })
        .then(function (head) {
          return treeOf(GH.site, head).then(function (t) {
            var files = { 'data/settings.json': { text: jsonText(P.settings) } };
            Object.keys(media).forEach(function (p) { if (!t.files[p]) files[p] = { b64: media[p] }; });
            busy('Публикуем…');
            return commitFiles(GH.site, head, t.treeSha, files, 'Публикация: главная страница и настройки');
          });
        }).then(function () {
          busy(null);
          dialog({ title: 'Опубликовано', body: 'Главная страница и контакты обновятся в течение пары минут: 13mirrors.ru\n\nМесяцы витрины остались как были.' });
        });
    }).catch(fail);
  }

  /* ---------- Резервная копия: весь черновик одним файлом ---------- */
  var BACKUP_APP = '13mirrors-vitrina';
  function downloadBackup() {
    syncIndex();
    var now = new Date();
    var stamp = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + '_' + pad(now.getHours()) + '-' + pad(now.getMinutes());
    var text = JSON.stringify({ app: BACKUP_APP, version: 1, createdAt: now.toISOString(), data: DATA });
    var url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    var a = el('a', { href: url, download: '13mirrors-kopiya-' + stamp + '.json' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    toast('Копия скачана: файл «13mirrors-kopiya-' + stamp + '.json». Сохраните его в надёжное место.');
  }
  function readBackup(file, done) {
    var r = new FileReader();
    r.onload = function () {
      var obj = null;
      try { obj = JSON.parse(String(r.result)); } catch (e) {}
      var d = obj && obj.app === BACKUP_APP ? obj.data : obj;
      if (!d || typeof d !== 'object' || !d.settings || !d.showcases || !d.routes) {
        toast('Это не копия витрины. Выберите файл, который скачивали кнопкой «Скачать копию» (он называется 13mirrors-kopiya-….json).', true);
        return;
      }
      done(d, obj && obj.createdAt ? new Date(obj.createdAt) : null);
    };
    r.onerror = function () { toast('Не получилось прочитать файл. Попробуйте ещё раз.', true); };
    r.readAsText(file);
  }
  function backupBox() {
    var box = el('div', { class: 'a-backup' }), pending = null;
    var file = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; file.value = '';
      if (f) readBackup(f, function (d, when) { pending = { data: d, when: when, name: f.name }; draw(); });
    });
    function draw() {
      box.replaceChildren();
      add(box, [
        el('p', { class: 'a-hint', text: 'Весь черновик — все месяцы, маршруты, Песочница, примеры, настройки и картинки — одним файлом. Скачивайте копию после больших изменений: если браузер очистится или вы перейдёте на другое устройство, всё можно будет вернуть.' }),
        el('div', { class: 'a-backup-btns' }, [
          el('button', { type: 'button', class: 'a-btn a-btn--dark', text: '↓ Скачать копию', onclick: downloadBackup }),
          el('button', { type: 'button', class: 'a-btn', text: '↑ Загрузить копию…', onclick: function () { file.click(); } }), file]),
        pending ? el('div', { class: 'a-note' }, [
          el('p', { text: 'Файл «' + pending.name + '»' + (pending.when ? ' от ' + pending.when.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '') +
            ': месяцев — ' + Object.keys(pending.data.showcases).length + ', маршрутов — ' + ((pending.data.routes || {}).routes || []).length + '.' }),
          el('p', { style: 'margin-top:6px', text: 'Текущий черновик в этом браузере заменится содержимым файла. Если в нём есть что-то нужное — сначала скачайте его копию.' }),
          el('div', { class: 'a-backup-btns', style: 'margin-top:10px' }, [
            el('button', { type: 'button', class: 'a-btn a-btn--danger', text: 'Да, заменить черновик', onclick: function () {
              DATA = migrate(pending.data); pending = null; dirty = true; save(); renderShell();
              toast('Готово: черновик восстановлен из копии и сохранён в этом браузере.'); } }),
            el('button', { type: 'button', class: 'a-btn', text: 'Отмена', onclick: function () { pending = null; draw(); } })])]) : null
      ]);
    }
    draw();
    return box;
  }

  function boot() {
    APP = document.getElementById('adm');
    APP.innerHTML = '<p style="padding:40px;color:#6b6b68">Загружаем данные…</p>';
    loadSource().then(function (src) {
      ORIGINAL = src;
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
      if (saved && saved.data) { DATA = saved.data; savedAt = saved.savedAt; } else DATA = clone(src);
      migrate(DATA);
      renderShell();
      if (GHS.token) connect(false);
    }).catch(function (e) {
      console.error(e);
      APP.innerHTML = '<p style="padding:40px">Не получилось загрузить данные витрины. Обновите страницу; если не поможет — напишите, что видите.</p>';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
