/* 13 MIRRORS · Панель управления (этап 2: сохранение в этом браузере + предпросмотр).
   Подключение к GitHub (сохранение в приватный репозиторий и публикация) — этап 3. */
(function () {
  'use strict';

  var KEY = 'm13-admin-draft-v1';
  // Копия черновика в браузере — в IndexedDB (там сотни мегабайт; в localStorage всего ~5 МБ, картинки туда не влезают).
  // Старую копию из localStorage подхватываем и переносим.
  var LOCAL = (function () {
    var dbp = null, ST = 'kv';
    function open() {
      if (dbp) return dbp;
      dbp = new Promise(function (res, rej) {
        if (!window.indexedDB) return rej(new Error('no indexedDB'));
        var r = indexedDB.open('m13-admin', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore(ST); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      });
      return dbp;
    }
    function tx(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (res, rej) {
          var t = db.transaction(ST, mode), q = fn(t.objectStore(ST));
          t.oncomplete = function () { res(q && q.result); };
          t.onerror = t.onabort = function () { rej(t.error || new Error('idb')); };
        });
      });
    }
    function legacy() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
    return {
      get: function () {
        return tx('readonly', function (st) { return st.get(KEY); }).catch(function () { return null; })
          .then(function (v) { return v || legacy(); });
      },
      set: function (o) {
        return tx('readwrite', function (st) { return st.put(o, KEY); })
          .then(function () { try { localStorage.removeItem(KEY); } catch (e) {} },
            function () { localStorage.setItem(KEY, JSON.stringify(o)); });
      },
      del: function () {
        try { localStorage.removeItem(KEY); } catch (e) {}
        return tx('readwrite', function (st) { return st.delete(KEY); }).catch(function () {});
      }
    };
  })();
  function keepLocal() { var t = Date.now(); LOCAL.set({ savedAt: t, data: DATA }).then(function () { savedAt = t; }, function () {}); savedAt = savedAt || t; }
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
  function routeColorOf(x) { return function () { var r = routeById(x.routeId); return r && r.color; }; }
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
  function changed() { liveSoon(); if (!dirty) { dirty = true; updateState(); } }
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
    // Копия в браузере и сохранение в GitHub — независимо: если в браузере не хватит места, в GitHub всё равно сохраним
    LOCAL.set({ savedAt: t, data: DATA }).then(function () { return true; }, function () { return false; }).then(function (ok) {
      if (ok) savedAt = t;
      if (GHS.token) { dirty = false; updateState(); saveToGitHub(); return; }
      if (ok) { dirty = false; updateState(); toast('Сохранено в этом браузере. Чтобы черновик был доступен с других устройств и его можно было опубликовать — войдите в GitHub.'); }
      else toast('В этом браузере не хватает места для черновика. Войдите в GitHub и нажмите «Сохранить» — там места достаточно.', true);
    });
  }

  /* ---------- Загрузка ---------- */
  function getJSON(u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); }); }
  function loadSource() {
    if (window.M13_DATA) return Promise.resolve(clone(window.M13_DATA));
    var d = '../data/';
    return Promise.all(['settings', 'routes', 'formats', 'sandbox', 'reflection'].map(function (n) { return getJSON(d + n + '.json'); })
      .concat([getJSON(d + 'events.json').catch(function () { return EVENTS_DEFAULT(); })]))
      .then(function (r) {
        var out = { settings: r[0], routes: r[1], formats: r[2], sandbox: r[3], reflection: r[4], events: r[5], showcases: {} };
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
    function show(x) { return String(x).replace('.', ',') + (o.unit || ''); }
    o = o || {};
    var v = obj[key] == null || obj[key] === '' ? (o.def || 0) : +obj[key];
    var out = el('span', { class: 'a-range-val', text: show(v) });
    var r = el('input', { type: 'range', class: 'a-range', min: o.min || 0, max: o.max || 100, step: o.step || 1, value: v });
    r.addEventListener('input', function () { obj[key] = +r.value; out.textContent = show(r.value); changed(); if (o.onChange) o.onChange(+r.value); });
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
  // Пустое значение: o.inh() — цвет, который берётся «сверху» (у всей витрины, у маршрута),
  // o.base — цвет по умолчанию, если сверху ничего нет. Квадратик показывает то, что видно на сайте.
  function colorOptIn(obj, key, label, o) {
    o = o || {};
    var box = el('div', { class: 'a-field' });
    function val(x) { return typeof x === 'function' ? x() : x; }
    function hex(x) { return /^#[0-9a-f]{6}$/i.test(x || '') ? x : ''; }
    function draw() {
      var v = obj[key] || '', iv = v ? '' : hex(val(o.inh)), bv = v || iv ? '' : hex(val(o.base));
      var c = el('input', { type: 'color' }); c.value = hex(v) || iv || bv || o.pick || '#ffffff';
      c.addEventListener('input', function () { obj[key] = c.value; changed(); draw(); if (o.onChange) o.onChange(); });
      box.replaceChildren();
      add(box, [el('span', { class: 'a-label', text: label }),
        el('div', { class: 'a-color' + (v ? '' : iv || bv ? ' is-inh' : ' is-empty') }, [c,
          el('span', { class: 'a-hint', text: v ? v : iv ? (val(o.inhLabel) || 'как у всей витрины') + ': ' + iv : (o.none || 'по умолчанию') }),
          v ? el('button', { type: 'button', class: 'a-btn a-btn--small a-btn--ghost', text: 'Сбросить', onclick: function () {
            obj[key] = ''; changed(); draw(); if (o.onChange) o.onChange(); } }) : null]),
        o.hint ? el('span', { class: 'a-hint', text: o.hint }) : null]);
    }
    draw();
    box.redraw = draw;
    return box;
  }
  // Яркость цвета #rrggbb (0–255) — чтобы понять, тёмный ли оборот
  function hexLum(h) {
    h = /^#[0-9a-f]{6}$/i.test(h || '') ? h : '#ffffff';
    return 0.299 * parseInt(h.substr(1, 2), 16) + 0.587 * parseInt(h.substr(3, 2), 16) + 0.114 * parseInt(h.substr(5, 2), 16);
  }
  // У карточки: значение всей витрины (d — cardStyle месяца); у месяца — ничего
  function inhOf(d, forCard, k) { return forCard ? function () { return d[k]; } : null; }
  // Выбор шрифта: названия в списке написаны самими шрифтами (где браузер это умеет), под списком — образец
  function fontIn(obj, key, label, options, onChange, sampleText) {
    var sample = el('div', { class: 'a-font-sample', text: sampleText || 'Увидимся за поворотом · 13 MIRRORS · 3 000 ₽' });
    function show() { var f = obj[key] && obj[key] !== 'inherit' ? obj[key] : ''; if (f) window.M13.ensureFont(f); sample.style.fontFamily = f ? "'" + f + "',Georgia,serif" : ''; }
    var f = selectIn(obj, key, label, options, { onChange: function (v) { show(); if (onChange) onChange(v); } });
    fontLook(f); show();
    return el('div', { class: 'a-field' }, [f, sample]);
  }
  function fontLook(node) {
    var sel = node.querySelector('select');
    if (sel) [].forEach.call(sel.options, function (o) {
      if (!o.value || (window.M13.FONTS || []).indexOf(o.value) < 0) return;
      window.M13.ensureFont(o.value); o.style.fontFamily = "'" + o.value + "',Georgia,serif"; o.style.fontSize = '16px';
    });
    return node;
  }
  function fontOptions(inherit) {
    var list = [[ '', inherit ? 'Как у всей витрины' : 'Обычный (как сейчас)' ]];
    return list.concat((window.M13.FONTS || []).map(function (f) { return [f, f]; }));
  }
  // Поля оформления. forCard — для одной карточки (с вариантом «как у всей витрины»),
  // d — оформление всей витрины (cardStyle месяца), чтобы показать унаследованные цвета.
  function styleFields(stl, forCard, onChange, d) {
    var inh = forCard ? [['inherit', 'Как у всей витрины']] : [];
    d = forCard && d || {};
    var glowBox;
    var fontSel = fontLook(selectIn(stl, 'font', 'Шрифт', fontOptions(forCard), { onChange: function (v) { window.M13.ensureFont(v); preview(); onChange && onChange(); } }));
    var sample = el('div', { class: 'a-font-sample', text: 'Синяя Рука · Карта-Отражение · 3 000 ₽' });
    function preview() { var f = stl.font; if (f) window.M13.ensureFont(f); sample.style.fontFamily = f ? "'" + f + "',Georgia,serif" : ''; }
    preview();
    return [
      el('div', { class: 'a-row' }, [el('div', { class: 'a-field' }, [fontSel, sample]),
        colorOptIn(stl, 'textColor', 'Цвет текста', { none: forCard ? 'как у всей витрины' : 'обычный тёмный', pick: '#ffffff', inh: inhOf(d, forCard, 'textColor'), onChange: onChange })]),
      el('div', { class: 'a-row' }, [
        selectIn(stl, 'overlay', 'Дымка поверх картинки (чтобы текст читался)', inh.concat([['light', 'Светлая дымка — для тёмного текста'], ['dark', 'Тёмная дымка — для светлого текста'], ['none', 'Без дымки — картинка как есть']]),
          { def: forCard ? 'inherit' : 'light' }),
        colorOptIn(stl, 'bg', 'Цвет карточки (когда нет картинки)', { none: forCard ? 'как у всей витрины: белый' : 'белый', inh: inhOf(d, forCard, 'bg'), base: '#ffffff', onChange: onChange })]),
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
        colorOptIn(stl, 'accent', 'Акцентный цвет', { none: forCard ? 'как у всей витрины: без акцента' : 'без акцента', pick: '#8a6bb8', inh: inhOf(d, forCard, 'accent'),
          onChange: function () { if (glowBox) glowBox.redraw(); if (onChange) onChange(); } }),
        el('p', { class: 'a-hint', style: 'align-self:end', text: 'Красит рамку карточки, главную кнопку, счётчик дня и статус-плашку. Если цвет свечения не выбран — светится этим цветом.' })]),
      el('div', { class: 'a-row' }, [
        selectIn(stl, 'glow', 'Свечение', inh.concat([['off', 'Без свечения'], ['soft', 'Ровное свечение'], ['live', 'Живое (мягко пульсирует)']]),
          { def: forCard ? 'inherit' : 'off', onChange: onChange }),
        glowBox = colorOptIn(stl, 'glowColor', 'Цвет свечения', { none: forCard ? 'как у всей витрины: золотистый' : 'золотистый', base: '#e8c77a', onChange: onChange,
          // Без своего цвета свечение берёт акцентный (свой у карточки, потом у всей витрины)
          inh: function () { return stl.accent || d.glowColor || d.accent; },
          inhLabel: function () { return stl.accent || !d.glowColor && d.accent ? 'по акцентному цвету' : 'как у всей витрины'; } })]),
      el('div', { class: 'a-row' }, [
        selectIn(stl, 'glowStrength', 'Сила свечения', inh.concat([['weak', 'Слабое'], ['medium', 'Среднее'], ['strong', 'Сильное']]),
          { def: forCard ? 'inherit' : 'medium', onChange: onChange }),
        selectIn(stl, 'glowDir', 'Откуда идёт свет', inh.concat([['around', 'Вокруг всей карточки'], ['bottom', 'Снизу'], ['top', 'Сверху']]),
          { def: forCard ? 'inherit' : 'around', onChange: onChange })]),
      el('div', { class: 'a-row' }, [
        selectIn(stl, 'glowTempo', 'Дыхание живого свечения', inh.concat([['calm', 'Спокойное (вдох 4 с, выдох 5 с)'], ['slow', 'Медленное, медитативное'], ['flicker', 'Мерцающее']]),
          { def: forCard ? 'inherit' : 'calm', onChange: onChange, hint: 'Для «Живого» свечения. Контур, который дышит, дышит в том же ритме.' }),
        el('span')]),
      glassFields(stl, forCard, onChange, d),
      buttonFields(stl, forCard, onChange, d),
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
  function glassFields(stl, forCard, onChange, d) {
    var inh = forCard ? [['inherit', 'Как у всей витрины']] : [];
    d = d || {};
    var box = el('div', { class: 'a-glass' });
    function redraw() { if (onChange) onChange(); draw(); }
    function draw() {
      var pat = stl.pattern && stl.pattern !== 'inherit' ? stl.pattern : '';
      function val(k) { return stl[k] && stl[k] !== 'inherit' ? stl[k] : (forCard ? d[k] : '') || ''; }
      var tx = val('textHelp'), rim = val('rim') && val('rim') !== 'none', live = val('rimLive');
      var txBox;
      box.replaceChildren();
      add(box, [
        sub('Стекло и узор'),
        el('div', { class: 'a-row' }, [
          rangeOptIn(stl, 'glass', 'Прозрачность карточек («зеркала»)', { max: 100, step: 5, unit: '%', def: 60, onChange: onChange,
            hint: '0% — сплошной цвет. 60–90% — сквозь карточку видна картинка фона. 100% — только стекло. У карточки с картинкой стекло видно сквозь прозрачные места картинки (PNG без фона).' }, forCard),
          rangeOptIn(stl, 'glassBlur', 'Размытие за карточкой', { max: 20, step: 1, unit: ' px', def: 10, onChange: onChange,
            hint: '0 — картинка за карточкой чёткая. 2–4 — матовое стекло. 10 — сильно размыто.' }, forCard)]),
        el('div', { class: 'a-row' }, [
          selectIn(stl, 'textHelp', 'Чтобы текст читался', inh.concat([['none', 'Ничего не добавлять'], ['shadow', 'Тень у букв'], ['haze', 'Дымка под строками'], ['shade', 'Мягкое затемнение там, где текст']]),
            { def: forCard ? 'inherit' : 'none', onChange: redraw, hint: 'Пригодится, когда за прозрачной карточкой яркая картинка. «Дымка под строками» — облачко только вокруг текста, остальное стекло чистое.' }),
          tx === 'haze' ? rangeOptIn(stl, 'hazeStrength', 'Сила дымки', { max: 100, step: 5, unit: '%', def: 60, onChange: onChange }, forCard) : el('span')]),
        sub('Контур карточки'),
        el('div', { class: 'a-row' }, [
          selectIn(stl, 'rim', 'Контур', inh.concat([['none', 'Без контура'], ['light', 'Светлый'], ['cold', 'Холодный (зимний)'], ['gold', 'Золотой — акцентным цветом']]),
            { def: forCard ? 'inherit' : 'none', onChange: redraw, hint: 'Тонкая линия с бликом по краю карточки. Цвет можно задать свой — ниже.' }),
          rim ? selectIn(stl, 'rimPlace', 'Где', inh.concat([['edge', 'По всему краю'], ['corners', 'Только уголки']]), { def: forCard ? 'inherit' : 'edge', onChange: onChange }) : el('span')]),
        rim ? el('div', { class: 'a-row' }, [
          colorOptIn(stl, 'rimColor', 'Цвет контура', { none: 'как выбрано выше', pick: '#ecd3a3', inh: inhOf(d, forCard, 'rimColor'), onChange: onChange }),
          selectIn(stl, 'rimLive', 'Живость контура', inh.concat([['none', 'Спокойный'], ['breathe', 'Дышит'], ['run', 'Бегущий блик']]),
            { def: forCard ? 'inherit' : 'none', onChange: redraw, hint: 'Бегущий блик — светлая искра медленно обегает край. Лучше для одной-двух карточек.' })]) : null,
        rim && live === 'run' ? el('div', { class: 'a-row' }, [
          colorOptIn(stl, 'rimRunColor', 'Цвет бегущего блика', { none: 'акцентный или светло-золотой', pick: '#fff1c4', inh: inhOf(d, forCard, 'rimRunColor'),
            base: function () { return stl.accent || d.accent || '#fff1c4'; }, onChange: onChange }),
          selectIn(stl, 'rimSpeed', 'Скорость бегущего блика', inh.concat(RIM_SPEEDS), { def: forCard ? 'inherit' : 'slow', onChange: onChange,
            hint: 'Сколько блик идёт по кругу. Посмотреть — «Посмотреть» внизу, подождите полминуты.' })]) : null,
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
            : colorOptIn(stl, 'patternColor', 'Цвет узора', { none: 'иней — белый, остальные — акцентный', pick: '#eef6ff', inh: inhOf(d, forCard, 'patternColor'), onChange: onChange,
                base: function () { return pat === 'frost' ? '#eef6ff' : stl.accent || d.accent || '#ecd3a3'; } })]) : null,
        sub('Оборот карточки'),
        el('div', { class: 'a-row' }, [
          colorOptIn(stl, 'backBg', 'Цвет оборота', { none: forCard ? 'как у всей витрины: светлый' : 'светлый', pick: '#15110c', inh: inhOf(d, forCard, 'backBg'), base: '#f8f8f8',
            onChange: function () { if (txBox) txBox.redraw(); if (onChange) onChange(); } }),
          txBox = colorOptIn(stl, 'backText', 'Цвет текста на обороте', { none: forCard ? 'как у всей витрины: подберётся сам' : 'подберётся сам', pick: '#efe4d2', onChange: onChange,
            inh: inhOf(d, forCard, 'backText'),
            // Подбирается сам: на тёмном обороте светлый, на светлом тёмный
            base: function () { return hexLum(stl.backBg || d.backBg || '#f8f8f8') < 128 ? '#efe4d2' : '#202020'; },
            hint: 'Пусто — на тёмном обороте светлый, на светлом тёмный.' })]),
        el('div', { class: 'a-row' }, [
          rangeOptIn(stl, 'backGlass', 'Прозрачность оборота', { max: 90, step: 5, unit: '%', def: forCard ? 30 : 0, onChange: onChange,
            hint: '0% — сплошной цвет. 20–40% — сквозь оборот чуть видна витрина, текст читается. Плашки на светлом обороте остаются почти белыми.' }, forCard),
          rangeOptIn(stl, 'backBlur', 'Размытие за оборотом', { max: 20, step: 1, unit: ' px', def: 8, onChange: onChange,
            hint: 'Работает, когда оборот прозрачный. 0 — витрина за ним чёткая, 8–12 — матовое стекло.' }, forCard)]),
        el('div', { class: 'a-row' }, [
          selectIn(stl, 'backSize', 'Размер текста на обороте', inh.concat([['md', 'Обычный'], ['lg', 'Крупнее'], ['xl', 'Ещё крупнее']]),
            { def: forCard ? 'inherit' : 'md', onChange: onChange, hint: 'Описание, плашки, даты, подписи. Кнопки остаются как есть.' }),
          el('p', { class: 'a-hint', style: 'align-self:end', text: 'Узор и контур появляются и на обороте открытой карточки.' })])
      ]);
    }
    draw();
    return box;
  }

  // Скорость бликов: контур карточки, кнопка на обороте, подпись под сеткой
  var RIM_SPEEDS = [['fast', 'Быстрый — круг за 5 с'], ['normal', 'Обычный — круг за 7 с'], ['slow', 'Медленный — круг за 12 с'], ['vslow', 'Очень медленный — круг за 18 с']];
  var BTN_SPEEDS = [['fast', 'Быстрая'], ['normal', 'Обычная'], ['slow', 'Медленная'], ['vslow', 'Очень медленная']];
  var SHINE_SPEEDS = [['fast', 'Быстрый'], ['normal', 'Обычный'], ['slow', 'Медленный'], ['vslow', 'Очень медленный']];
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
  function buttonFields(stl, forCard, onChange, d) {
    var inh = forCard ? [['inherit', 'Как у всей витрины']] : [];
    d = d || {};
    function accentNow() { return stl.accent || d.accent || '#ecd3a3'; }
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
      var live = stl.btnLive && stl.btnLive !== 'inherit' ? stl.btnLive : forCard ? d.btnLive || '' : '';
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
            { def: forCard ? 'inherit' : 'none', onChange: redraw }) : el('span')]),
        on && live && live !== 'none' ? el('div', { class: 'a-row' }, [
          selectIn(stl, 'btnSpeed', 'Скорость блика и перелива', inh.concat(BTN_SPEEDS), { def: forCard ? 'inherit' : 'slow', onChange: onChange }), el('span')]) : null,
        on ? el('div', { class: 'a-row' }, [
          colorOptIn(stl, 'btnColor', bs === 'gradient' ? 'Первый цвет' : 'Цвет кнопки', { none: 'акцентный', pick: '#ecd3a3', inh: inhOf(d, forCard, 'btnColor'), base: accentNow, onChange: onChange }),
          bs === 'gradient' ? colorOptIn(stl, 'btnColor2', 'Второй цвет', { none: 'как первый', pick: '#c49a5a', inh: inhOf(d, forCard, 'btnColor2'),
              base: function () { return stl.btnColor || d.btnColor || accentNow(); }, onChange: onChange })
            : colorOptIn(stl, 'btnInk', 'Цвет надписи', { none: 'подберётся сам', pick: '#1c150c', inh: inhOf(d, forCard, 'btnInk'), onChange: onChange })]) : null,
        on && bs === 'gradient' ? el('div', { class: 'a-row' }, [
          selectIn(stl, 'btnDir', 'Направление градиента', inh.concat([['h', 'Слева направо'], ['diag', 'По диагонали'], ['v', 'Сверху вниз']]),
            { def: forCard ? 'inherit' : 'diag', onChange: onChange }),
          colorOptIn(stl, 'btnInk', 'Цвет надписи', { none: 'подберётся сам', pick: '#1c150c', inh: inhOf(d, forCard, 'btnInk'), onChange: onChange })]) : null,
        el('div', { class: 'a-row' }, [
          on ? selectIn(stl, 'btnOther', 'Остальные кнопки', inh.concat([['outline', 'Прозрачные с рамкой'], ['same', 'Такие же, как главная']]),
            { def: forCard ? 'inherit' : 'outline', onChange: onChange }) : el('span'),
          colorOptIn(stl, 'btnOtherColor', 'Цвет рамки и надписи остальных кнопок', { none: 'обычный', pick: '#ecd3a3', inh: inhOf(d, forCard, 'btnOtherColor'), onChange: onChange })])
      ]);
    }
    draw();
    return box;
  }

  // Сглаживание высокого качества; при сильном уменьшении — в несколько шагов (каждый не больше чем вдвое), так мелкие линии не «рвутся»
  function smooth(g) { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; return g; }
  function halve(img, iw, ih, targetW) {
    var src = img, w = iw, h = ih;
    while (w / 2 >= targetW * 1.05 && w > 2) {
      var c = document.createElement('canvas'); c.width = Math.round(w / 2); c.height = Math.round(h / 2);
      smooth(c.getContext('2d')).drawImage(src, 0, 0, c.width, c.height);
      src = c; w = c.width; h = c.height;
    }
    return src;
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
          var src = halve(img, iw, ih, crop[0] * iw / sw);
          var kx = (src === img ? iw : src.width) / iw;
          var g = smooth(c.getContext('2d')); g.fillStyle = '#fff'; g.fillRect(0, 0, crop[0], crop[1]);
          g.drawImage(src, (iw - sw) / 2 * kx, (ih - sh) / 2 * kx, sw * kx, sh * kx, 0, 0, crop[0], crop[1]);
          URL.revokeObjectURL(url); return res(c.toDataURL('image/jpeg', 0.9));
        }
        var w = iw, h = ih, k = Math.min(1, max / Math.max(w, h));
        w = Math.round(w * k); h = Math.round(h * k);
        c.width = w; c.height = h;
        smooth(c.getContext('2d')).drawImage(halve(img, iw, ih, w), 0, 0, w, h);
        var d = c.toDataURL('image/webp', 0.9);
        if (d.indexOf('data:image/webp') !== 0) d = hasAlpha(c) ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
        URL.revokeObjectURL(url); res(d);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('bad')); };
      img.src = url;
    });
  }
  // Есть ли в картинке прозрачные места (проверяем редкой сеткой — этого достаточно)
  function hasAlpha(c) {
    try {
      var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, step = Math.max(4, Math.floor(d.length / 4 / 40000)) * 4;
      for (var i = 3; i < d.length; i += step) if (d[i] < 250) return true;
    } catch (e) {}
    return false;
  }
  // Метка версии для ссылок на vitrina.js/css (опубликованные страницы, предпросмотр телефона): браузер не возьмёт старые из памяти
  var ASSET_V = window.M13V || Date.now();
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
    ['download', 'Скачать файл', 'Скачать'], ['event', 'Страница события (из «Событий»)', 'Подробнее']
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
        k === 'event' ? selectIn(a, 'eventId', 'Какое событие', [['', '— выберите —']].concat(((DATA.events || {}).items || []).map(function (e) { return [e.id, e.title || 'Без названия']; })),
          { hint: 'События заводятся в разделе «События». Откроется страница события — с описанием, картинками и кнопками.' }) : null,
        k === 'link' ? textIn(a, 'url', 'Ссылка', { ph: 'https://…', hint: o.linkHint || 'Полный адрес страницы, начиная с https://' }) : null,
        k === 'download' ? textIn(a, 'url', 'Ссылка на файл', { ph: 'https://…', hint: 'Пока — ссылкой (например, на Яндекс Диск). Загрузка файлов прямо из панели появится вместе с публикацией.' }) : null,
        k === 'calendar' ? (o.calAuto ? el('p', { class: 'a-hint', text: 'Дата, время, длительность и место возьмутся из события.' }) : calFields(a.cal = a.cal || { duration: 60 })) : null,
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
  var SECTIONS = [['showcases', 'Витрины'], ['home', 'Главная страница'], ['routes', 'Маршруты'], ['events', 'События'], ['sandbox', 'Песочница'], ['reflection', 'Карты-Отражения'], ['settings', 'Настройки']];

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
    else if (s === 'events') add(m, viewEvents());
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

  // Яркость, контраст и насыщенность картинки фона (100 % — как есть). Витрина применяет их фильтром к картинке, файл не меняется
  /* ---------- Живой предпросмотр фона: как картинка ляжет на компьютере и на телефоне ----------
     Меняется сразу вместе с ползунками (затемнение, размытие, яркость, контраст, насыщенность, как лежит); нажатие — крупно. */
  var LIVE = [], liveRaf = 0;
  function liveSoon() {
    if (liveRaf) return;
    liveRaf = requestAnimationFrame(function () {
      liveRaf = 0; LIVE = LIVE.filter(function (f) { return f.node.isConnected; });
      LIVE.forEach(function (f) { f.run(); });
    });
  }
  // Как на сайте (renderShowcase / pageLook в vitrina.js): размытие — в пикселях экрана, поэтому в маленькой картинке оно пропорционально меньше
  function bgPaint(frame, bg, tall) {
    var src = tall ? bg.imageTall || bg.image : bg.image, pic = frame.firstChild, dim = pic.nextSibling;
    var w = frame.clientWidth || (tall ? 69 : 250);
    var fx = [['brightness', bg.bright], ['contrast', bg.contrast], ['saturate', bg.sat]].filter(function (x) {
      return x[1] != null && x[1] !== '' && !isNaN(+x[1]) && +x[1] !== 100;
    }).map(function (x) { return x[0] + '(' + Math.max(30, Math.min(200, +x[1])) / 100 + ')'; });
    var bl = src ? Math.max(0, Math.min(20, +bg.blur || 0)) * w / (tall ? 390 : 1366) : 0;
    frame.style.backgroundColor = bg.color || '#f2f2f2';
    pic.style.backgroundImage = src ? "url('" + imgSrc(src) + "')" : 'none';
    pic.style.backgroundSize = bg.fit === 'contain' ? 'contain' : bg.fit === 'big' ? 'auto 135%' : 'cover';
    pic.style.filter = (bl ? 'blur(' + bl.toFixed(2) + 'px) ' : '') + fx.join(' ');
    pic.style.transform = bl ? 'scale(1.06)' : '';
    dim.style.background = src ? 'rgba(6,4,2,' + Math.max(0, Math.min(90, +bg.dim || 0)) / 100 + ')' : 'transparent';
  }
  function bgLive(bg) {
    function frame(tall) {
      var f = el('button', { type: 'button', class: 'a-bgpv' + (tall ? ' a-bgpv--tall' : ''), title: 'Посмотреть крупно', onclick: function () { bgBig(bg, tall); } }, [el('i'), el('i')]);
      LIVE.push({ node: f, run: function () { bgPaint(f, bg, tall); } });
      return f;
    }
    var box = el('div', { class: 'a-bgpvs' }, [
      el('div', { class: 'a-bgpv-col' }, [frame(false), el('span', { class: 'a-hint', text: 'Компьютер' })]),
      el('div', { class: 'a-bgpv-col' }, [frame(true), el('span', { class: 'a-hint', text: 'Телефон' })]),
      el('p', { class: 'a-hint', text: 'Так фон выглядит на сайте. Меняется сразу, пока двигаете ползунки. Нажмите на картинку — откроется крупно.' })]);
    setTimeout(liveSoon, 0);
    return box;
  }
  function bgBig(bg, tall) {
    var f = el('div', { class: 'a-bgpv a-bgpv--big' + (tall ? ' a-bgpv--tall' : '') }, [el('i'), el('i')]);
    var ov = el('div', { class: 'a-bgbig', onclick: function () { ov.remove(); } }, [f, el('p', { text: (tall ? 'Телефон' : 'Компьютер') + ' · нажмите, чтобы закрыть' })]);
    document.body.appendChild(ov);
    bgPaint(f, bg, tall);
  }
  function bgFxFields(bg) {
    var box = el('div', { class: 'a-glass' }), live = bgLive(bg);
    function draw() {
      box.replaceChildren();
      add(box, [live,
        el('div', { class: 'a-row3' }, [
          rangeIn(bg, 'bright', 'Яркость картинки', { min: 50, max: 150, step: 5, unit: '%', def: 100 }),
          rangeIn(bg, 'contrast', 'Контраст', { min: 50, max: 150, step: 5, unit: '%', def: 100 }),
          rangeIn(bg, 'sat', 'Насыщенность', { min: 0, max: 150, step: 5, unit: '%', def: 100, hint: '0% — чёрно-белая.' })]),
        el('div', { class: 'a-theme' }, [
          el('span', { class: 'a-hint', text: '100% — как в файле. Меняется только вид на сайте, сама картинка остаётся прежней.' }),
          bg.bright != null || bg.contrast != null || bg.sat != null ? el('button', { type: 'button', class: 'a-btn a-btn--small a-btn--ghost', text: 'Вернуть как в файле', onclick: function () {
            delete bg.bright; delete bg.contrast; delete bg.sat; changed(); draw(); } }) : null])]);
    }
    draw();
    return box;
  }


  /* ---------- Обложка карточки при открытии витрины ----------
     Месяц: sc.cardStyle.lid = {open: '' | 'book', …}; карточка: front.style.lid = {mode: '' (как у всей витрины) | 'off' | 'own', …}.
     Поля — в vitrina.js (lidHTML). Волна и вид блика — в «Бликах» (head.wave, head.waveSpeed, head.sheenKind). */
  var LID_OPENS = [['book', 'Книга — раскрывается на корешке'], ['flip', 'Переворот карты — обложка как рубашка']];
  var LID_DEF = { open: 'book', feel: 'soft', from: 'left', speed: 'normal', pause: 0.5, shadow: 'soft', mat: 'glass', glass: 35, blur: 8 };
  var DAND_KINDS = { dandelion: 'logo', dandelion2: 'line', dandelion3: 'wave' };
  function lidOnOf(sc, c) {
    var d = (sc.cardStyle || {}).lid || {}, f = ((c.front || {}).style || {}).lid || {};
    return f.mode === 'own' ? !!f.open : f.mode === 'off' ? false : !!d.open;
  }
  function dandIcon(sign, mirror) { var n = el('div', { class: 'a-lid-ic' }); n.innerHTML = window.M13.dandSVG ? window.M13.dandSVG(DAND_KINDS[sign], mirror) : ''; return n; }
  function lidFields(sc, c) {
    var cs = sc.cardStyle = sc.cardStyle || {}, box = el('div', { class: 'a-glass' }), L;
    if (c) { var fs = c.front.style = c.front.style || {}; L = fs.lid = fs.lid || {}; } else L = cs.lid = cs.lid || {};
    var d = cs.lid || {};
    function fill() { Object.keys(LID_DEF).forEach(function (k) { if (L[k] == null || L[k] === '') L[k] = LID_DEF[k]; }); }
    function draw() {
      var own = c ? L.mode === 'own' : !!L.open, mat = L.mat || 'glass', sign = L.sign || '', flip = L.open === 'flip';
      box.replaceChildren();
      add(box, [
        el('p', { class: 'a-hint', text: 'Когда витрина открывается, волна блика доходит до карточки, свет скользит по обложке — и она раскрывается. Под ней — лицевая сторона. ' +
          'Каждый раз при открытии. У кого в телефоне включено «уменьшить движение» — карточка сразу открыта.' }),
        c ? selectIn(L, 'mode', 'Обложка у этой карточки', [['', 'Как у всей витрины (' + (d.open ? 'есть обложка' : 'без обложки') + ')'], ['off', 'Без обложки'], ['own', 'Своя обложка']], {
          def: '', onChange: function (v) {
            if (v === 'own') { Object.keys(d).forEach(function (k) { if (L[k] == null) L[k] = clone(d[k]); }); if (!L.open) L.open = 'book'; fill(); }
            changed(); draw(); } })
          : selectIn(L, 'open', 'Обложка у карточек', [['', 'Без обложки (как обычно)']].concat(LID_OPENS), {
            def: '', onChange: function (v) { if (v) fill(); changed(); draw(); },
            hint: 'Для всех карточек месяца. Обычно обложку ставят одной-двум карточкам — в их формах, раздел «Обложка при открытии витрины».' }),
        own ? sub('Как открывается') : null,
        own ? el('div', { class: 'a-row' }, [
          c ? selectIn(L, 'open', 'Как раскрывается', LID_OPENS, { def: 'book', onChange: function () { changed(); draw(); } })
            : el('span', { class: 'a-hint', style: 'align-self:end', text: 'Скоро добавятся: свиток, жалюзи, конверт, уголок, лепестки, звёздная пыль, одуванчик, шторки.' }),
          flip ? selectIn(L, 'from', 'Куда переворачивается', [['left', 'Слева направо'], ['right', 'Справа налево'], ['top', 'Сверху вниз'], ['bottom', 'Снизу вверх']], { def: 'left' })
            : selectIn(L, 'from', 'Где корешок', [['left', 'Слева — как книга'], ['right', 'Справа'], ['top', 'Сверху — поднимается вверх'], ['bottom', 'Снизу — откидывается вниз']], { def: 'left' })]) : null,
        own ? selectIn(L, 'feel', 'Какая обложка', flip
          ? [['soft', 'Мягкая — в конце чуть пружинит, как картон'], ['leather', 'Кожаная — тяжёлая, переворачивается плавно, ложится без пружины'], ['hard', 'Твёрдая — ложится ровно']]
          : [['soft', 'Мягкая, как тетрадный лист — изгибается дугой'], ['leather', 'Мягкая, как толстая кожа — тяжёлый плавный изгиб'],
            ['hard', 'Твёрдая, как переплёт — поворачивается ровной доской']], { def: 'soft',
          hint: flip ? 'Обложка — это рубашка карты: карточка приподнимается, переворачивается вокруг середины и ложится лицом.'
            : 'Мягкая изгибается, по изгибу бегут свет и тень, в конце лист чуть «доплывает». Кожаная — плотнее и тяжелее: край чуть скруглён, лист выгибается ровной дугой, свет на изгибе тёплый и матовый.' }) : null,
        own ? el('div', { class: 'a-row3' }, [
          selectIn(L, 'speed', 'Скорость раскрытия', [['fast', 'Быстро — 0,7 с'], ['normal', 'Обычно — 1 с'], ['slow', 'Медленно — 1,4 с'], ['vslow', 'Очень медленно — 2 с']], { def: 'normal' }),
          rangeIn(L, 'pause', 'Пауза перед раскрытием', { max: 3, step: 0.5, unit: ' с', def: 0.5, hint: 'Сколько обложка стоит закрытой, когда по ней прошёл блик.' }),
          selectIn(L, 'shadow', 'Тень при раскрытии', [['soft', 'Мягкая'], ['deep', 'Глубокая, объёмная']], { def: 'soft' })]) : null,
        own ? sub('Из чего обложка') : null,
        own ? el('div', { class: 'a-row' }, [
          selectIn(L, 'mat', 'Материал', [['glass', 'Стекло'], ['color', 'Цвет'], ['image', 'Картинка'], ['frost', 'Запотевшее зеркало']], { def: 'glass', onChange: function () { changed(); draw(); } }),
          colorOptIn(L, 'color', mat === 'frost' ? 'Оттенок инея' : mat === 'glass' ? 'Цвет стекла' : mat === 'image' ? 'Цвет, пока грузится картинка' : 'Цвет обложки',
            { none: mat === 'frost' ? 'серебристый' : 'как у карточки', base: function () { return mat === 'frost' ? '#e4ebf1' : cs.bg || '#f4efe6'; } })]) : null,
        own && mat === 'glass' ? el('div', { class: 'a-row' }, [
          rangeIn(L, 'glass', 'Прозрачность стекла', { max: 90, step: 5, unit: '%', def: 35, hint: '0% — плотная обложка, ничего не видно. Больше — сквозь неё просвечивает карточка.' }),
          rangeIn(L, 'blur', 'Размытие под стеклом', { max: 20, unit: ' px', def: 8, hint: 'Насколько размыта карточка, которая просвечивает.' })]) : null,
        own && mat === 'frost' ? el('div', { class: 'a-row' }, [
          rangeIn(L, 'frost', 'Плотность инея', { max: 100, step: 5, unit: '%', def: 60, hint: 'Меньше — лёгкая испарина, сквозь неё видна карточка. Больше — густой иней.' }), el('span')]) : null,
        own && mat === 'image' ? imageIn(L, 'image', 'Картинка обложки', { max: 1400, hint: 'Ляжет на всю обложку, края обрежутся.' }) : null,
        own ? el('div', { class: 'a-row' }, [
          selectIn(L, 'rim', 'Контур обложки', [['', 'Без контура'], ['light', 'Светлый'], ['cold', 'Холодный, серебристый'], ['gold', 'Золотой — акцентным цветом']], { def: '', onChange: function () { changed(); draw(); } }),
          L.rim ? colorOptIn(L, 'rimColor', 'Цвет контура', { none: 'как выбрано слева', pick: '#ecd3a3' }) : el('span')]) : null,
        own ? sub('Надпись или значок') : null,
        own ? el('div', { class: 'a-row' }, [
          selectIn(L, 'sign', 'На обложке', [['', 'Ничего'], ['text', 'Надпись'], ['dandelion', 'Одуванчик из логотипа'], ['dandelion2', 'Одуванчик прямой'],
            ['dandelion3', 'Одуванчик на изгибе'], ['logo', 'Логотип целиком'],
            ['spark', 'Искра ✦'], ['star', 'Звезда'], ['moon', 'Месяц'], ['image', 'Своя картинка']], { def: '', onChange: function () { changed(); draw(); } }),
          sign === 'text' ? textIn(L, 'text', 'Текст', { multi: true, rows: 2, ph: '13 MIRRORS', hint: 'Например, «Октябрь» или «Открой меня». Можно в две строки.' })
            : DAND_KINDS[sign] ? el('div', {}, [dandIcon(sign, !!L.signMirror),
              sign === 'dandelion3' ? switchIn(L, 'signMirror', 'Зеркально', { onChange: function () { changed(); draw(); } }) : null]) : el('span')]) : null,
        own && sign === 'image' ? imageIn(L, 'signImg', 'Картинка-значок', { max: 800, hint: 'Лучше PNG с прозрачным фоном. Показывается целиком.' }) : null,
        own && sign === 'text' ? fontIn(L, 'font', 'Шрифт надписи', fontOptions(false), null, String(L.text || '').trim() || '13 MIRRORS') : null,
        own && sign ? el('div', { class: 'a-row3' }, [
          colorOptIn(L, 'signColor', 'Цвет', { none: 'подберётся сам', pick: '#ecd3a3' }),
          selectIn(L, 'signSize', 'Размер', [['s', 'Маленький'], ['m', 'Средний'], ['l', 'Крупный']], { def: 'm' }),
          selectIn(L, 'signPos', 'Где', [['center', 'По центру'], ['top', 'Сверху'], ['bottom', 'Снизу']], { def: 'center' })]) : null,
        own ? el('p', { class: 'a-hint', text: 'Откуда идёт волна по сетке, какой блик и как быстро он перебегает — в «Странице месяца», раздел «Блики».' }) : null,
        el('div', { class: 'a-theme' }, [el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Посмотреть раскрытие', onclick: function () { openPreview('showcase', sc.id); } })])
      ]);
    }
    draw();
    return box;
  }

  /* ---------- Окна «Куда написать?», «Добавить в календарь» и «Ссылка скопирована» ----------
     obj.win = {mode:'' | 'own', bg, glass, blur, text, font, accent, btnStyle, rim, rimColor}. obj — cardStyle месяца или look страницы. */
  function winFields(obj, page, preview) {
    var w = obj.win = obj.win || {}, box = el('div', { class: 'a-glass' });
    function draw() {
      var own = w.mode === 'own';
      box.replaceChildren();
      add(box, [
        el('p', { class: 'a-hint', text: 'Окна «Куда написать?» (Telegram / VK), «Добавить в календарь» и сообщение «Ссылка скопирована».' }),
        el('div', { class: 'a-row' }, [
          selectIn(w, 'mode', 'Как выглядят', [['', page ? 'Как у страницы' : 'Как у карточки, с которой открыты'], ['own', 'Своё оформление']], { def: '', onChange: draw }),
          el('p', { class: 'a-hint', style: 'align-self:end', text: own ? 'Одинаковые, какие бы ни были ' + (page ? 'панели страницы.' : 'карточки.')
            : page ? 'Берут цвет панелей, прозрачность, текст, шрифт и акцентный цвет страницы.'
              : 'Берут оборот карточки: цвет, прозрачность и размытие, текст, шрифт, кнопки и контур. У прозрачного стекла — лёгкая подложка, чтобы текст читался.' })]),
        own ? el('div', { class: 'a-row' }, [
          colorOptIn(w, 'bg', 'Цвет окна', { none: 'белый', pick: '#17120c', base: '#ffffff' }),
          colorOptIn(w, 'text', 'Цвет текста', { none: 'подберётся сам', pick: '#efe4d2', base: function () { return hexLum(w.bg || '#ffffff') < 128 ? '#efe4d2' : '#232323'; } })]) : null,
        own ? el('div', { class: 'a-row' }, [
          rangeIn(w, 'glass', 'Прозрачность окна', { max: 90, step: 5, unit: '%', hint: '0% — сплошное. Даже при большой прозрачности остаётся лёгкая подложка.' }),
          rangeIn(w, 'blur', 'Размытие за окном', { max: 20, unit: ' px', def: 10 })]) : null,
        own ? el('div', { class: 'a-row' }, [
          fontIn(w, 'font', 'Шрифт', fontOptions(false), null, 'Куда написать? · Telegram · VK'),
          colorOptIn(w, 'accent', 'Цвет кнопок', { none: 'подберётся сам', pick: '#ecd3a3',
            base: function () { return w.text || (hexLum(w.bg || '#ffffff') < 128 ? '#efe4d2' : '#232323'); } })]) : null,
        own ? el('div', { class: 'a-row' }, [
          selectIn(w, 'btnStyle', 'Вид кнопок', [['', 'Заливка цветом кнопок'], ['glass', 'Стекло — прозрачная с кромкой'], ['outline', 'Контур — только рамка']], { def: '' }),
          selectIn(w, 'rim', 'Контур окна', [['', 'Без контура'], ['light', 'Светлый'], ['cold', 'Холодный (зимний)'], ['gold', 'Золотой — цветом кнопок']], { def: '', onChange: draw })]) : null,
        own && w.rim ? colorOptIn(w, 'rimColor', 'Цвет контура', { none: 'как выбрано выше', pick: '#ecd3a3' }) : null,
        own ? readWarn(function () { return w.text || (hexLum(w.bg || '#ffffff') < 128 ? '#efe4d2' : '#232323'); },
          function () { return { color: w.bg || '#ffffff' }; }, function () { return (+w.glass || 0) > 40; }, 'Текст в окне') : null,
        el('div', { class: 'a-theme' }, [el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Посмотреть окно', onclick: preview })])
      ]);
    }
    draw();
    return box;
  }

  // Толщина и курсив: только то, что есть у шрифта. font — название шрифта ('' — обычный шрифт устройства)
  var WEIGHT_NAMES = { 300: ['light', 'Тонкая'], 400: ['normal', 'Обычная'], 600: ['semi', 'Полужирная'], 700: ['bold', 'Жирная'] };
  function weightOpts(font) {
    return window.M13.fontCaps(font).w.map(function (w) { return WEIGHT_NAMES[w]; });
  }
  // Образец надписи тем шрифтом, толщиной и наклоном, что будут на витрине
  function typeSample(text, font, w, it, upper) {
    if (font) window.M13.ensureFont(font);
    var caps = window.M13.fontCaps(font), fw = { light: 300, semi: 600, bold: 700 }[w] || 400;
    return el('div', { class: 'a-font-sample', text: text, style: (font ? "font-family:'" + font + "',Georgia,serif;" : '') +
      'font-weight:' + (caps.w.indexOf(fw) >= 0 ? fw : 400) + ';font-style:' + (it && caps.it ? 'italic' : 'normal') + (upper ? ';text-transform:uppercase;letter-spacing:.08em;font-size:13px' : '') });
  }
  function typeFields(hd, wKey, iKey, font, onChange) {
    var caps = window.M13.fontCaps(font), name = font || 'обычного шрифта';
    return el('div', { class: 'a-row' }, [
      selectIn(hd, wKey, 'Толщина букв', weightOpts(font), { def: 'normal', onChange: onChange,
        hint: caps.w.length < 4 ? 'У ' + (font ? 'шрифта «' + font + '»' : name) + ' есть только эти варианты.' : '' }),
      caps.it ? switchIn(hd, iKey, 'Курсив', { onChange: onChange }) : el('p', { class: 'a-hint', style: 'align-self:end', text: 'У шрифта «' + font + '» нет курсива.' })]);
  }
  // Логотип: берутся только очертания, цвет задаёт витрина. Прозрачные поля обрезаются;
  // если фона-прозрачности нет (логотип на белом), фон убирается сам по цвету уголков.
  function prepLogo(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var g = smooth(c.getContext('2d')); g.drawImage(halve(img, img.naturalWidth, img.naturalHeight, w), 0, 0, w, h); URL.revokeObjectURL(url);
        var D = g.getImageData(0, 0, w, h), px = D.data, i, removed = false;
        if (!hasAlpha(c)) {
          // Цвет фона — по четырём уголкам; чем ближе пиксель к нему, тем прозрачнее (края остаются мягкими)
          var cs = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4], bg = [0, 0, 0];
          cs.forEach(function (o) { bg[0] += px[o] / 4; bg[1] += px[o + 1] / 4; bg[2] += px[o + 2] / 4; });
          for (i = 0; i < px.length; i += 4) {
            var dd = Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]);
            px[i + 3] = Math.max(0, Math.min(255, Math.round((dd - 24) * 2.2)));
          }
          removed = true;
        }
        // Обрезать пустые поля вокруг
        var x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 < 0) return rej(new Error('empty'));
        g.putImageData(D, 0, 0);
        var o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
        o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
        var data = o.toDataURL('image/webp', 0.9);
        if (data.indexOf('data:image/webp') !== 0) data = o.toDataURL('image/png');
        res({ src: data, ratio: +(o.width / o.height).toFixed(3), removed: removed });
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('bad')); };
      img.src = url;
    });
  }
  function logoIn(obj, key, rKey, label, o) {
    o = o || {};
    var box = el('div', { class: 'a-field' });
    function draw() {
      var v = obj[key], shown = v ? imgSrc(v) : o.fallback ? o.fallback() : '../assets/logo.png';
      var file = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
      file.addEventListener('change', function () {
        var f = file.files && file.files[0]; if (!f) return;
        prepLogo(f).then(function (r) {
          obj[key] = r.src; obj[rKey] = r.ratio; changed(); draw(); if (o.onChange) o.onChange();
          toast(r.removed ? 'Логотип загружен. Фон у картинки был не прозрачный — убрали его сами. Проверьте, как вышло.' : 'Логотип загружен. Не забудьте «Сохранить».');
        }).catch(function () { toast('Не получилось взять логотип из этой картинки. Нужен PNG с прозрачным фоном.', true); });
      });
      box.replaceChildren();
      add(box, [label ? el('span', { class: 'a-label', text: label }) : null,
        el('div', { class: 'a-img' }, [
          el('div', { class: 'a-logo-thumb' }, [el('span', { style: "-webkit-mask-image:url('" + shown + "');mask-image:url('" + shown + "');aspect-ratio:" + (+obj[rKey] || (o.fallbackRatio && o.fallbackRatio()) || 4.5) })]),
          el('button', { type: 'button', class: 'a-btn a-btn--small', text: v ? 'Заменить' : 'Загрузить свой', onclick: function () { file.click(); } }),
          v ? el('button', { type: 'button', class: 'a-btn a-btn--small a-btn--ghost', text: o.resetText || 'Вернуть обычный', onclick: function () {
            delete obj[key]; delete obj[rKey]; changed(); draw(); if (o.onChange) o.onChange(); } }) : null, file]),
        el('span', { class: 'a-hint', text: o.hint || 'PNG с прозрачным фоном. Цвета картинки не важны: логотип красится цветом надписей. Пустые поля вокруг обрежутся сами.' })]);
    }
    draw();
    return box;
  }

  /* ---------- Читаемость: предупреждение «надпись сливается с фоном» ----------
     Сравниваем цвет надписи с фоном (цвет или средний цвет нужной части картинки с учётом затемнения).
     Пересчитывается само при любом изменении в панели. */
  var READ_CHECKS = [], readTimer = null;
  function relLum(rgb) {
    var a = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function hexToRgb(h) { var m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); if (!m) return null; var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function contrast(a, b) { var l1 = relLum(a), l2 = relLum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
  var imgAvgCache = {};
  // Средний цвет полосы картинки (part: 'top' | 'bottom' | 'all'), как она лежит на экране «на весь экран»
  function imgAvg(src, part) {
    var key = part + '|' + src.slice(0, 64) + src.length;
    if (imgAvgCache[key]) return imgAvgCache[key];
    return (imgAvgCache[key] = new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        try {
          var c = document.createElement('canvas'); c.width = 48; c.height = 48;
          var g = c.getContext('2d'); g.drawImage(img, 0, 0, 48, 48);
          var y0 = part === 'top' ? 0 : part === 'bottom' ? 34 : 0, hh = part === 'all' ? 48 : 14;
          var d = g.getImageData(0, y0, 48, hh).data, s2 = [0, 0, 0], n = 0;
          for (var i = 0; i < d.length; i += 4) { s2[0] += d[i]; s2[1] += d[i + 1]; s2[2] += d[i + 2]; n++; }
          res([s2[0] / n, s2[1] / n, s2[2] / n]);
        } catch (e) { res(null); }
      };
      img.onerror = function () { res(null); };
      img.src = imgSrc(src);
    }));
  }
  // bg(): {color, image, dim, part} — фон под надписью; fg(): цвет надписи; skip(): true — проверять не нужно (включена дымка)
  function readWarn(fg, bg, skip, what) {
    var node = el('p', { class: 'a-hint a-hint--warn a-readwarn', hidden: true });
    function run() {
      if (skip && skip()) { node.hidden = true; return; }
      var f = hexToRgb(fg()), b = bg() || {};
      if (!f) { node.hidden = true; return; }
      var base = hexToRgb(b.color) || [255, 255, 255];
      (b.image ? Promise.resolve(imgAvg(b.image, b.part || 'all')) : Promise.resolve(null)).then(function (avg) {
        var c = avg || base, k = Math.max(0, Math.min(0.9, (+b.dim || 0) / 100));
        if (avg && k) c = c.map(function (v, j) { return v * (1 - k) + [6, 4, 2][j] * k; });
        var r = contrast(f, c);
        node.hidden = r >= 3;
        node.textContent = '⚠ ' + (what || 'Надпись') + ' может плохо читаться: цвет почти сливается с фоном. Включите дымку или выберите цвет контрастнее.';
      });
    }
    READ_CHECKS.push({ node: node, run: run });
    setTimeout(run, 0);
    return node;
  }
  function recheckRead() {
    clearTimeout(readTimer);
    readTimer = setTimeout(function () {
      READ_CHECKS = READ_CHECKS.filter(function (x) { return x.node.isConnected; });
      READ_CHECKS.forEach(function (x) { x.run(); });
    }, 250);
  }
  document.addEventListener('input', recheckRead, true);
  document.addEventListener('change', recheckRead, true);

  // Верхняя строка, название месяца, подпись под сеткой (логотип — ссылка на главную, «Увидимся за поворотом»),
  // дымка под надписями, толщина и курсив, звёздочка, блики, свой логотип месяца
  var HAZE_OPTS = [['', 'Без дымки'], ['dark', 'Тёмная — для светлых букв'], ['light', 'Светлая — для тёмных букв']];
  function headFields(sc) {
    var hd = sc.head, st = DATA.settings, box = el('div', { class: 'a-glass' });
    if (!hd.top) hd.top = hd.logo ? 'logo' : 'text';
    var hf = (sc.cardStyle || {}).font || '';
    function headColor() { return hd.color || '#202020'; }
    function bgUnder(part) { return function () { var b = sc.background || {}; return { color: b.color || '#f2f2f2', image: b.image, dim: b.dim, part: part }; }; }
    function draw() {
      var b = hd.bottom || 'none', logoB = b === 'logo' || b === 'both', textB = b === 'text' || b === 'both';
      var anyLogo = hd.top === 'logo' || logoB, glow = hd.welcome !== false || (b !== 'none' && hd.shine);
      var lidAny = (sc.cards || []).some(function (c) { return c && c.visible !== false && lidOnOf(sc, c); });
      var topS = null, botS = null, defTop = [st.siteTitle || '13 MIRRORS', (st.texts || {}).kicker || 'Витрина'].join(' · ');
      box.replaceChildren();
      add(box, [
        el('div', { class: 'a-row' }, [
          selectIn(hd, 'top', 'Сверху, над названием месяца', [['text', 'Надпись'], ['logo', 'Логотип'], ['none', 'Ничего']], { def: 'text', onChange: function () { delete hd.logo; draw(); } }),
          hd.top === 'text' ? textIn(hd, 'topText', 'Надпись сверху', { ph: [st.siteTitle || '13 MIRRORS', (st.texts || {}).kicker || 'Витрина'].join(' · '),
            hint: 'Пусто — «13 MIRRORS · Витрина». У каждого месяца своя.', onInput: function (v) { if (topS) topS.textContent = v.trim() || defTop; } })
            : hd.top === 'logo' ? selectIn(hd, 'topSize', 'Размер логотипа сверху', [['s', 'Маленький'], ['m', 'Обычный'], ['l', 'Крупный']], { def: 'm' }) : el('span')]),
        hd.top === 'text' ? typeFields(hd, 'topWeight', 'topItalic', '', draw) : null,
        topS = hd.top === 'text' ? typeSample(String(hd.topText || '').trim() || defTop, '', hd.topWeight, hd.topItalic, true) : null,
        el('div', { class: 'a-row' }, [
          selectIn(hd, 'topHaze', 'Дымка под надписями сверху', HAZE_OPTS, { def: '', onChange: draw,
            hint: 'Мягкое облачко только вокруг букв и логотипа — чтобы читались на любой картинке.' }),
          hd.topHaze ? rangeIn(hd, 'topHazeK', 'Сила дымки сверху', { max: 100, step: 5, unit: '%', def: 60 }) : el('span')]),
        readWarn(headColor, bgUnder('top'), function () { return !!hd.topHaze; }, 'Надпись над сеткой'),
        switchIn(hd, 'hideTitle', 'Не показывать название месяца', { hint: 'Название «' + (sc.title || '') + '» остаётся в заголовке вкладки и в превью ссылки.' }),
        el('div', { class: 'a-row' }, [
          selectIn(hd, 'bottom', 'Под сеткой', [['none', 'Ничего'], ['logo', 'Логотип'], ['text', 'Надпись'], ['both', 'Логотип и надпись под ним']], { def: 'none', onChange: draw,
            hint: 'Логотип внизу — ссылка на главную 13mirrors.ru. На компьютере карточки станут чуть меньше, чтобы всё помещалось на экране.' }),
          textB ? textIn(hd, 'bottomText', 'Надпись внизу', { ph: 'Увидимся за поворотом', hint: 'Можно добавить значки ✦ ✧ ☾ — кнопка ✦ появляется у поля, когда в нём пишете.',
            onInput: function (v) { if (botS) botS.textContent = v.trim() || 'Увидимся за поворотом'; } }) : el('span')]),
        b !== 'none' ? el('div', { class: 'a-row' }, [
          logoB ? selectIn(hd, 'bottomSize', 'Размер логотипа внизу', [['s', 'Маленький, как подпись'], ['m', 'Средний'], ['l', 'Крупный']], { def: 's' }) : el('span'),
          selectIn(hd, 'bottomAlign', b === 'both' ? 'Положение логотипа' : 'Положение внизу', [['center', 'По центру'], ['left', 'Слева'], ['right', 'Справа']], { def: 'center' })]) : null,
        b === 'both' ? el('div', { class: 'a-row' }, [
          selectIn(hd, 'bottomTextAlign', 'Положение надписи', [['', 'Как у логотипа'], ['center', 'По центру'], ['left', 'Слева'], ['right', 'Справа']], { def: '' }), el('span')]) : null,
        textB ? typeFields(hd, 'bottomWeight', 'bottomItalic', hf, draw) : null,
        botS = textB ? typeSample(String(hd.bottomText || '').trim() || 'Увидимся за поворотом', hf, hd.bottomWeight, hd.bottomItalic) : null,
        textB ? el('div', { class: 'a-row' }, [
          selectIn(hd, 'star', 'Звёздочка у надписи', [['', 'Нет'], ['before', 'Перед надписью'], ['after', 'После надписи'], ['both', 'С обеих сторон']], { def: '', onChange: draw,
            hint: 'Тихо мерцает и вспыхивает вместе с бликом.' }),
          hd.star ? selectIn(hd, 'starKind', 'Какая', [['spark', 'Искра — четыре луча'], ['star', 'Звезда'], ['moon', 'Месяц']], { def: 'spark' }) : el('span')]) : null,
        textB && hd.star ? colorOptIn(hd, 'starColor', 'Цвет звёздочки', { none: 'как блик', base: function () { return hd.shineColor || (sc.cardStyle || {}).rimRunColor || '#fff3cf'; } }) : null,
        b !== 'none' ? el('div', { class: 'a-row' }, [
          selectIn(hd, 'bottomHaze', 'Дымка под подписью', HAZE_OPTS, { def: '', onChange: draw }),
          hd.bottomHaze ? rangeIn(hd, 'bottomHazeK', 'Сила дымки внизу', { max: 100, step: 5, unit: '%', def: 60 }) : el('span')]) : null,
        b !== 'none' ? readWarn(headColor, bgUnder('bottom'), function () { return !!hd.bottomHaze; }, 'Подпись под сеткой') : null,
        anyLogo ? logoIn(hd, 'logoImg', 'logoRatio', 'Логотип этого месяца', { resetText: 'Как в «Настройках»',
          fallback: function () { return st.logo ? imgSrc(st.logo) : '../assets/logo.png'; }, fallbackRatio: function () { return st.logo ? st.logoRatio : 0; },
          hint: 'Пусто — общий логотип из «Настроек». Свой — например, тонкий или жирный вариант для этого месяца. PNG с прозрачным фоном.' }) : null,
        sub('Блики'),
        switchIn(hd, 'welcome', 'Приветственный блик при открытии', { defTrue: true, onChange: draw,
          hint: 'Когда витрина открывается, один раз мягкий свет проходит по надписи сверху, волной по карточкам и по подписи внизу.' }),
        b !== 'none' ? switchIn(hd, 'shine', 'Блик по подписи', { onChange: draw, hint: 'Сразу при открытии (на телефоне — когда подпись появится на экране), потом по расписанию ниже.' }) : null,
        b !== 'none' && hd.shine ? el('div', { class: 'a-row' }, [
          selectIn(hd, 'shineWhen', 'Когда повторяется', [['open', 'Только при открытии'], ['', 'Изредка — раз в 25 секунд'], ['often', 'Чаще — раз в 8 секунд']], { def: '' }), el('span')]) : null,
        hd.welcome !== false || lidAny ? el('div', { class: 'a-row3' }, [
          selectIn(hd, 'sheenKind', 'Какой блик по карточкам', [['soft', 'Мягкая полоса'], ['ray', 'Тонкий яркий луч'], ['dust', 'Звёздная пыль'], ['flash', 'Вспышка из центра']], { def: 'soft' }),
          selectIn(hd, 'wave', 'Откуда идёт волна', [['corner', 'Из левого верхнего угла'], ['center', 'От центра'], ['top', 'Сверху'], ['bottom', 'Снизу'], ['left', 'Слева'], ['right', 'Справа']],
            { def: 'corner', hint: 'В каком порядке карточки получают блик (и раскрываются обложки).' }),
          selectIn(hd, 'waveSpeed', 'Как быстро перебегает', SHINE_SPEEDS, { def: 'normal' })]) : null,
        glow ? el('div', { class: 'a-row' }, [
          selectIn(hd, 'shineSpeed', 'Скорость блика', SHINE_SPEEDS, { def: 'slow', hint: 'Сколько свет идёт по надписи.' }),
          colorOptIn(hd, 'shineColor', 'Цвет блика', { none: 'светло-золотой', base: function () { return (sc.cardStyle || {}).rimRunColor || '#fff3cf'; },
            inh: function () { return (sc.cardStyle || {}).rimRunColor; }, inhLabel: 'как бегущий блик карточек' })]) : null,
        el('div', { class: 'a-theme' }, [el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Посмотреть надписи и блики', onclick: function () { openPreview('showcase', sc.id); } })])
      ]);
    }
    draw();
    return box;
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
          if (c.monthCal && c.monthCal.on) tags.push(['календарь', 0]);
          else if (c.back && c.back.stub && c.back.stub.on) tags.push(['заглушка', 1]);
          else if (isStatic) tags.push(['без оборота', 0]);
          else tags.push([b.routeId && routeById(b.routeId) ? 'маршрут' : 'оборот', 0]);
          if (c.visible !== false && lidOnOf(sc, c)) tags.push(['обложка', 0]);
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
              (isStatic && c.visible !== false && !(c.monthCal && c.monthCal.on) ? ' is-static' : '') + (f.image ? ' has-img ov-' + ov : '') + (tc ? ' has-tc' : ''),
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
        selectIn(sc.background, 'fit', 'Как лежит картинка', [['cover', 'На весь экран (края обрезаются)'], ['contain', 'Целиком, по центру'], ['big', 'Крупно, по высоте экрана']], { def: 'cover', hint: 'Для картинки на прозрачном фоне (например, цветок) — «Целиком» или «Крупно», вокруг будет цвет фона.' }),
        bgFxFields(sc.background),
        sub('Надписи над сеткой и под ней'),
        el('div', { class: 'a-row' }, [
          colorOptIn(sc.head = sc.head || {}, 'color', 'Цвет надписей и логотипа', { none: 'обычный тёмный', pick: '#ecd3a3' }),
          selectIn(sc.head, 'align', 'Положение надписей сверху', [['left', 'Слева'], ['center', 'По центру']])]),
        headFields(sc),
        optIn(sc, 'intro', 'Общий текст на странице (под заголовком)', { multi: true, rows: 2 }),
        sub('Обложка карточек при открытии витрины'),
        lidFields(sc, null),
        sub('Оформление всех карточек'),
        el('p', { class: 'a-hint', text: 'Задаётся один раз для всего месяца. У любой карточки можно поменять отдельно — в её форме, раздел «Оформление».' })
      ].concat(styleFields(sc.cardStyle = sc.cardStyle || {}, false, function () { drawGrid(); }), [
        sub('Окна и сообщения'),
        winFields(sc.cardStyle, false, function () {
          var c0 = (sc.cards || []).filter(function (c) { return c && c.visible !== false && c.interactive !== false && c.back && c.back.type !== 'static' && !(c.monthCal && c.monthCal.on); })[0];
          openPreview('showcase', sc.id, c0 ? c0.id : null, true);
        })]),
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
  var PAGE_TITLES = { sandbox: 'Как устроены маршруты', reflection: 'Карта-Отражение', events: 'События' };
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
  // Текст превью: без разметки, первый абзац, не длиннее 200 знаков
  function plainShort(t) {
    t = String(t || '').split(/\n\s*\n/)[0].replace(/__|\*\*?/g, '').replace(/^\s*[-–•]\s+/gm, '').replace(/\s+/g, ' ').trim();
    return t.length > 200 ? t.slice(0, 198) + '…' : t;
  }
  function previewOf(kind, id, D) {
    var rts = (D.routes || {}).routes || [];
    function rt(rid) { return rts.filter(function (r) { return r.id === rid; })[0] || {}; }
    if (kind === 'event') {
      var e = ((D.events || {}).items || []).filter(function (x) { return x.id === id; })[0] || {};
      // shareImage — картинка превью со стеклом и надписью (рисуется при публикации, bakeGlass)
      return { dir: 'events', hash: encodeURIComponent(id), title: e.title || '', desc: plainShort(e.summary), img: e.shareImage || e.cover, sized: !!e.shareImage };
    }
    if (kind === 'archroute') {
      var ar = rt(id);
      return { dir: 'events', hash: encodeURIComponent(id), title: ar.title || '', desc: plainShort(ar.description), img: ar.shareImage || ar.image, sized: !!ar.shareImage };
    }
    var sb = D.sandbox || {}, tab = (sb.days || []).some(function (x) { return x.id === id; }) ? 'days' : 'chronicles';
    var it = (sb[tab] || []).filter(function (x) { return x.id === id; })[0] || {}, r = rt(it.routeId);
    var blocks = window.M13.sbBlocks(tab, it, sb.labels) || [], first = blocks.filter(function (b) { return b.kind === 'text' && String(b.text || '').trim(); })[0];
    var title = tab === 'days' ? [r.title, it.day ? 'День ' + it.day : '', it.title].filter(Boolean).join(' · ') : [it.name, r.title].filter(Boolean).join(' · ');
    return { dir: 'sandbox', hash: tab + '/' + encodeURIComponent(id), title: title, desc: plainShort(first && first.text), img: it.shareImage || it.cover || r.image, sized: !!it.shareImage };
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
    if (kind === 'event' || kind === 'sbitem' || kind === 'archroute') {
      // Страница-превью события, примера Песочницы или маршрута в архиве: своя ссылка с картинкой и названием для Telegram/VK,
      // сразу открывает нужное на общей странице
      var pv = previewOf(kind, cardId, D);
      var ptitle = pv.title + ' · ' + site, pdesc = pv.desc || sh.description;
      var pimg = absImg(pv.img, D), psized = !!(pimg && pv.sized);
      if (!pimg) { pimg = absImg(sh.image, D); psized = !!pimg; }
      var ptarget = '../#' + pv.hash;
      return '<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="UTF-8">\n' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + escAttr(ptitle) + '</title>\n' +
        metaTags({ url: siteUrl(D) + pv.dir + '/' + encodeURIComponent(cardId) + '/', title: ptitle, description: pdesc, image: pimg, sized: psized }, D) + '\n' +
        '<meta http-equiv="refresh" content="0; url=' + ptarget + '">\n<link rel="canonical" href="' + escAttr(siteUrl(D) + pv.dir + '/') + '">\n</head>\n' +
        '<body style="font-family:sans-serif;padding:24px"><script>location.replace(' + JSON.stringify(ptarget) + ');</script>\n' +
        '<a href="' + ptarget + '">' + escAttr(pv.title || 'Открыть') + '</a>\n</body>\n</html>\n';
    }
    var base = kind === 'main' ? './' : '../';
    var url = siteUrl(D) + (kind === 'main' ? '' : kind === 'month' ? sc.id + '/' : kind + '/');
    var title = site + ' · ' + (sc ? sc.title : PAGE_TITLES[kind] || '');
    if (!sc && !String((st.share || {}).title || '').trim()) sh.title = title;
    var img = absImg(sh.image, D);
    return '<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n' +
      '<title>' + escAttr(title) + '</title>\n' + metaTags({ url: url, title: sh.title, description: sh.description, image: img, sized: true }, D) + '\n' +
      '<link rel="stylesheet" href="' + base + 'assets/vitrina.css?v=' + ASSET_V + '">\n</head>\n<body class="m13-body">\n' +
      '<div id="m13" data-base="' + base + '" data-view="' + (isMonth ? 'showcase' : kind) + '"' + (kind === 'month' ? ' data-showcase="' + escAttr(sc.id) + '"' : '') + '></div>\n' +
      '<script src="' + base + 'assets/vitrina.js?v=' + ASSET_V + '"></script>\n<script>M13.boot();</script>\n</body>\n</html>\n';
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
        ['font', 'textColor', 'bg', 'glass', 'glassBlur', 'rim', 'textHelp', 'pattern', 'patternImage', 'patternPlace', 'patternColor', 'patternOpacity', 'accent', 'overlay', 'backBg',
          'hazeStrength', 'rimPlace', 'rimColor', 'rimLive', 'rimRunColor', 'rimSpeed', 'win'].forEach(function (k) { delete sc.cardStyle[k]; });
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
      itemCalHint(it),
      optIn(it, 'text', 'Короткое описание', { multi: true, rows: 2 }),
      el('div', { class: 'a-row' }, [optIn(it, 'duration', 'Длительность', { ph: 'до 90 минут' }), optIn(it, 'status', 'Статус', { ph: 'осталось 2 места' })]),
      actionIn(it, 'action', 'Кнопка на плашке', { defLabel: 'Записаться', kinds: ['contact', 'link', 'event'] }),
      itemCalendar(it)
    ];
  }

  /* ---------- Календарь месяца (вид карточки) ---------- */
  function scYM(sc) { var m = /^(\d{4})-(\d{2})/.exec((sc && sc.id) || ''); return m ? { y: +m[1], m: +m[2] } : null; }
  function calOn(sc) { return !!sc && (sc.cards || []).some(function (c) { return c.visible !== false && c.monthCal && c.monthCal.on; }); }
  var MON_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  // Под датой плашки: попадёт ли встреча в календарь месяца (только если в месяце есть календарь)
  function itemCalHint(it) {
    var sc = DATA.showcases[ST.showcase], ym = scYM(sc);
    if (!ym || !calOn(sc)) return null;
    var h = el('span', { class: 'a-hint a-calhint' });
    function draw() {
      var t = optVal(it.date), d = window.M13.calDaysIn(t, ym);
      h.classList.toggle('a-hint--warn', !!t && !d.length);
      h.textContent = d.length ? 'В календаре месяца: ' + d.join(', ') + ' ' + MON_GEN[ym.m - 1] + ' ✓'
        : t ? 'Календарь не нашёл здесь дату этого месяца. Напишите так: «8 октября», «8 и 15 октября» или «08.10».'
        : 'Без даты (или дата скрыта) — в календарь месяца не попадёт.';
    }
    draw();
    setTimeout(function () { var row = h.previousSibling; if (row) { row.addEventListener('input', draw); row.addEventListener('change', draw); } }, 0);
    return h;
  }
  function monthCalFields(sc, c, cb) {
    var cal = c.monthCal, ym = scYM(sc) || { y: 2026, m: 1 };
    cal.days = cal.days || []; cal.freeHide = cal.freeHide || [];
    var cards = (sc.cards || []).filter(function (x) { return x !== c && x.visible !== false; });
    function cardName(x) { var f = x.front || {}; return f.title || f.eyebrow || x.id; }
    var data = { routes: DATA.routes, settings: DATA.settings, formats: DATA.formats, showcase: sc };
    // Что календарь видит сам: маршруты с датами и даты встреч
    var seen = el('div', { class: 'a-calseen' });
    function drawSeen() {
      var L = [];
      cards.forEach(function (x) {
        if (x.interactive === false || !x.back || x.back.type === 'static') return;
        var b = window.M13.toBlocks(x.back), r = b.routeId ? routeById(b.routeId) : null;
        if (r && r.dates && r.dates.from && r.dates.to) L.push(el('li', {}, [el('i', { class: 'a-calbar', style: 'background:' + window.M13.routeTone(r) }), r.title + ' — ' + fmtDates(r.dates)]));
        if (b.stub && b.stub.on) return;
        var ds = [];
        (b.blocks || []).forEach(function (k) {
          if (k.kind !== 'items' || k.visible === false) return;
          (k.items || []).forEach(function (it) { if (it.visible !== false) window.M13.calDaysIn(optVal(it.date), ym).forEach(function (d) { if (ds.indexOf(d) < 0) ds.push(d); }); });
        });
        if (ds.length) L.push(el('li', {}, [el('i', { class: 'a-caldot' }), '«' + cardName(x) + '»: встречи ' + ds.sort(function (a, b) { return a - b; }).join(', ') + ' ' + MON_GEN[ym.m - 1]]));
      });
      seen.replaceChildren(L.length ? el('ul', { class: 'a-callist' }, L) : el('p', { class: 'a-empty', text: 'Пока ни одной даты: у маршрутов карточек нет дат, у плашек — дат этого месяца.' }));
    }
    drawSeen();
    // Особые дни: дата, подпись, в какую карточку летит звезда
    var targets = [['', '— ни в какую, только точка —']].concat(cards.filter(function (x) { return x.interactive !== false && x.back && x.back.type !== 'static'; })
      .map(function (x) { return [x.id, cardName(x)]; }));
    var days = collection(cal.days, {
      title: function (d) { var p = (d.date || '').split('-'); return [p.length === 3 ? +p[2] + ' ' + MON_GEN[+p[1] - 1] : 'Без даты', d.label].filter(Boolean).join(' · '); },
      body: function (d) {
        return [el('div', { class: 'a-row' }, [textIn(d, 'date', 'Дата', { type: 'date' }), textIn(d, 'label', 'Подпись', { ph: 'Портальный день' })]),
          selectIn(d, 'cardId', 'Звезда летит в карточку', targets, { hint: 'Например, в «Свечи»: в портальные дни их изготавливают.' })];
      },
      make: function () { return { id: uid('cd'), date: ym.y + '-' + pad(ym.m) + '-01', label: cal.days.length ? (cal.days[cal.days.length - 1].label || '') : 'Портальный день', cardId: cal.days.length ? cal.days[cal.days.length - 1].cardId || '' : '' }; },
      onChange: function () { drawFree(); },
      addLabel: '+ Добавить особый день', empty: 'Пока нет. Например, портальные дни — сиреневая точка, звезда летит в карточку «Свечи».'
    });
    // Карточки без дат — строкой внизу календаря; любую можно убрать
    var freeBox = el('div', { class: 'a-calfree' });
    function drawFree() {
      var auto = window.M13.calFree({ monthCal: Object.assign({}, cal, { freeHide: [] }) }, data);
      var list = cards.filter(function (x) { return auto.indexOf(x.id) >= 0; });
      freeBox.replaceChildren();
      if (!list.length) { freeBox.appendChild(el('p', { class: 'a-empty', text: 'Все открывающиеся карточки уже есть в календаре по датам.' })); return; }
      list.forEach(function (x) {
        var o = { v: cal.freeHide.indexOf(x.id) < 0 };
        freeBox.appendChild(switchIn(o, 'v', cardName(x), { onChange: function (on) {
          var i = cal.freeHide.indexOf(x.id);
          if (on && i >= 0) cal.freeHide.splice(i, 1); if (!on && i < 0) cal.freeHide.push(x.id); changed(); } }));
      });
    }
    drawFree();
    // Цвета линий маршрутов именно в этом календаре (monthCal.routeColors); пусто — цвет маршрута из раздела «Маршруты»
    var calRoutes = [];
    cards.forEach(function (x) {
      if (x.interactive === false || !x.back || x.back.type === 'static') return;
      var b = window.M13.toBlocks(x.back), r = b.routeId ? routeById(b.routeId) : null;
      if (r && r.dates && r.dates.from && r.dates.to && calRoutes.indexOf(r) < 0) calRoutes.push(r);
    });
    var rcBox = el('div');
    function toneKind(r) { var t = String(r.title || '').toLowerCase().replace(/ё/g, 'е'); return /син/.test(t) ? 0 : /желт/.test(t) ? 1 : /красн/.test(t) ? 2 : /бел/.test(t) ? 3 : 4; }
    var RC_SETS = [
      ['Приглушённые', ['#7f9cc9', '#d6b666', '#c47d6c', '#e6e0d3', '#a498c0']],
      ['Пастель', ['#a9c4ec', '#f1da9a', '#eeab9d', '#f6f2e9', '#cbbfe6']],
      ['Золото и лунный свет', ['#b7c7e6', '#ecd3a3', '#d9a68b', '#f3ead8', '#c9b8de']],
      ['Драгоценные камни', ['#3f6fc4', '#e2a92e', '#b8413a', '#e9e4da', '#7a5bb5']]];
    function drawRC() {
      cal.routeColors = cal.routeColors || {};
      rcBox.replaceChildren();
      if (!calRoutes.length) return;
      add(rcBox, [
        el('p', { class: 'a-hint', text: 'Цвета линий именно в этом календаре. Пусто — цвет маршрута из раздела «Маршруты». Готовые наборы — одним нажатием, потом можно подправить.' }),
        el('div', { class: 'a-presets', style: 'margin-bottom:10px' }, RC_SETS.map(function (set) {
          return el('button', { type: 'button', class: 'a-btn a-btn--small a-preset', style: 'background:linear-gradient(90deg,' + set[1].slice(0, 4).join(',') + ')', text: set[0], onclick: function () {
            calRoutes.forEach(function (r) { cal.routeColors[r.id] = set[1][toneKind(r)]; }); changed(); drawRC(); } });
        }).concat([el('button', { type: 'button', class: 'a-btn a-btn--small a-btn--ghost', text: 'Как в «Маршрутах»', onclick: function () { cal.routeColors = {}; changed(); drawRC(); } })])),
        el('div', { class: 'a-row' }, calRoutes.map(function (r) {
          return colorOptIn(cal.routeColors, r.id, 'Линия «' + r.title + '»', { none: 'цвет маршрута', inh: function () { return window.M13.routeTone(r); }, inhLabel: 'цвет маршрута' });
        }))]);
    }
    drawRC();
    var starOpt = { none: cal.flyer === 'snow' ? 'ледяной' : 'золотой', base: function () { return cal.flyer === 'snow' ? '#cfe8ff' : '#f1cf78'; } };
    var starBox = colorOptIn(cal, 'starColor', 'Цвет звёзд или снежинок', starOpt);
    return [
      el('p', { class: 'a-hint', text: 'На маленькой карточке — мини-календарь месяца (или своя картинка). ' +
        'При нажатии открывается большой календарь. Даты вводить второй раз не нужно: маршруты берутся из раздела «Маршруты», встречи — из даты на плашке («8 октября»). ' +
        'Нажатие на число — календарь складывается в свою карточку, и звёзды летят в карточки этого дня.' }),
      selectIn(cal, 'face', 'На маленькой карточке', [['mini', 'Мини-календарь (рисуется сам)'], ['image', 'Своя картинка и надписи из «Лицевой стороны»']], { def: 'mini',
        hint: 'Мини-календарь только для вида: те же линии маршрутов и светящиеся числа. Цвет и стекло карточки — из «Оформления».', onChange: cb.redrawGrid }),
      el('div', { class: 'a-row' }, [textIn(cal, 'eyebrow', 'Надпись сверху', { ph: 'Календарь' }), textIn(cal, 'title', 'Заголовок', { ph: sc.title || '' })]),
      textIn(cal, 'hint', 'Подсказка под заголовком', { ph: 'Нажмите на число — звёзды покажут, что в этот день.' }),
      switchIn(cal, 'noHint', 'Не показывать подсказку'),
      sub('Как выглядит'),
      el('div', { class: 'a-row' }, [
        selectIn(cal, 'line', 'Линия маршрута', [['thread', 'Тонкая нить'], ['band', 'Широкая мягкая полоса'], ['wave', 'Волна'], ['cloud', 'Облачко — дымка за числами']], { def: 'thread',
          hint: 'Цвета линий — ниже, «Цвета маршрутов». На телефоне в мини-календаре всегда тонкая нить — так читается лучше.' }),
        selectIn(cal, 'glow', 'Свечение чисел и линий', [['soft', 'Мягкое'], ['bright', 'Яркое'], ['none', 'Без свечения']], { def: 'soft',
          hint: 'Для линий и светящихся чисел. На тёмном фоне красивее всего.' })]),
      el('div', { class: 'a-row' }, [
        colorOptIn(cal, 'meetColor', 'Цвет встреч', { none: 'золотой', base: '#f1c65a', pick: '#f1c65a', hint: 'Число дня встречи светится этим цветом.' }),
        colorOptIn(cal, 'specialColor', 'Цвет особых дней', { none: 'сиреневый', base: '#b48ee0', pick: '#b48ee0' })]),
      el('div', { class: 'a-row' }, [
        colorOptIn(cal, 'numColor', 'Цвет чисел', { none: 'как текст на обороте', pick: '#efe4d2', hint: 'Обычные числа. Встречи и особые дни — своими цветами (смешанными с этим).' }),
        selectIn(cal, 'lineW', 'Толщина линии', [['thin', 'Тонкая'], ['mid', 'Средняя'], ['thick', 'Толстая']], { def: 'thin', hint: 'Для нити, полосы и волны.' })]),
      selectIn(cal, 'lineMode', 'Линия через дни', [['solid', 'Сплошная — одной нитью через весь маршрут'], ['days', 'По дням — у каждого дня свой отрезок']], { def: 'solid' }),
      calRoutes.length ? sub('Цвета маршрутов') : null, rcBox,
      el('div', { class: 'a-row' }, [
        selectIn(cal, 'flyer', 'Что летит в карточки', [['star', 'Звёзды'], ['snow', 'Снежинки']], { def: 'star',
          hint: 'Снежинки — например, на декабрь и Новый год.', onChange: function () { starOpt.none = cal.flyer === 'snow' ? 'ледяной' : 'золотой'; starBox.redraw(); } }),
        starBox]),
      sub('Что календарь нашёл сам'), seen,
      sub('Особые дни'), days,
      el('div', { class: 'a-row' }, [textIn(cal, 'meetLabel', 'Подпись к встречам (в легенде)', { ph: 'Встречи' }), textIn(cal, 'specialLabel', 'Подпись к особым дням', { ph: 'Особые дни' })]),
      sub('Карточки без дат'),
      textIn(cal, 'freeLabel', 'Подпись строки', { ph: 'Когда удобно — по договорённости:' }),
      el('p', { class: 'a-hint', text: 'Открывающиеся карточки, у которых нет дат в этом месяце, стоят строкой внизу календаря. Выключите те, что там не нужны.' }),
      freeBox,
      el('button', { type: 'button', class: 'a-btn', text: 'Посмотреть календарь', onclick: function () { openPreview('showcase', sc.id, c.id); } })
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
    if (x.kind === 'images') return [galleryForm(x.images = x.images || [])];
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
  // Оборот-заглушка: вместо блоков оборота — текст «скоро» и «Задать вопрос». Блоки не удаляются.
  function stubFields(c, cb) {
    var box = el('div');
    function draw() {
      var st = (c.back = c.back || { type: 'blocks', blocks: [] }).stub = c.back.stub || { on: false };
      box.replaceChildren();
      add(box, [
        switchIn(st, 'on', 'Показывать на обороте заглушку «скоро»', {
          hint: 'Вместо описания, форматов и цен — короткий текст и кнопка «Задать вопрос». Всё, что уже заполнено в обороте, сохраняется; выключите — и оно вернётся.',
          onChange: function (v) {
            if (v && !String(st.text || '').trim()) st.text = window.M13.stubText(c, DATA);
            changed(); draw(); if (cb.redrawGrid) cb.redrawGrid();
          } }),
        st.on ? textIn(st, 'text', 'Текст на обороте', { multi: true, rows: 5, hint: 'Пустая строка — новый абзац. Дата старта маршрута подставилась сама — поправьте, если нужно.' }) : null,
        st.on ? el('div', { class: 'a-row' }, [
          textIn(st, 'ask', 'Надпись на кнопке', { ph: 'Задать вопрос', hint: 'Откроет окно «Telegram или VK» с готовым текстом «Хочу узнать подробнее про …».' }),
          c.back.routeId ? switchIn(st, 'sandbox', 'Кнопка «Как устроены маршруты 13 MIRRORS»', { defTrue: window.M13.stubSandbox(c, {}),
            hint: 'Если не трогать — как на обычном обороте.' }) : el('span')]) : null,
        st.on ? el('div', { class: 'a-theme' }, [
          el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Вернуть текст по умолчанию', onclick: function () { st.text = window.M13.stubText(c, DATA); changed(); draw(); } })]) : null
      ]);
    }
    draw();
    return [box];
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
  // Скопировать только оформление (без текстов) с другой карточки: лицевую сторону, оборот или всё; сюда или всем карточкам месяца
  var STYLE_FRONT = ['font', 'textColor', 'overlay', 'bg', 'textPos', 'textAlign', 'accent', 'glow', 'glowColor', 'glowStrength', 'glowDir',
    'glass', 'glassBlur', 'rim', 'pattern', 'patternImage', 'patternPlace', 'patternColor', 'patternOpacity', 'textHelp', 'titleSize', 'smallSize',
    'hazeStrength', 'rimPlace', 'rimColor', 'rimLive', 'rimRunColor', 'glowTempo', 'rimSpeed'];
  var STYLE_BACK = ['backBg', 'backText', 'backSize', 'backGlass', 'backBlur', 'btnSpeed'].concat(BTN_KEYS);
  function copyStyle(src, dst, what) {
    var fs = (src.front || {}).style || {}, df = dst.front = dst.front || {}, ds = df.style = df.style || {};
    var keys = what === 'front' ? STYLE_FRONT : what === 'back' ? STYLE_BACK : STYLE_FRONT.concat(STYLE_BACK);
    keys.forEach(function (k) { if (fs[k] != null && fs[k] !== '') ds[k] = clone(fs[k]); else delete ds[k]; });
    if (what !== 'back') { if ((src.front || {}).statusStyle) df.statusStyle = src.front.statusStyle; else delete df.statusStyle; }
  }
  function copyStyleBox(sc, i, cb) {
    var st = { month: sc.id, card: '', what: 'all', armed: false }, box = el('div', { class: 'a-copy' });
    function draw() {
      box.replaceChildren();
      var opts = (DATA.showcases[st.month].cards || []).map(function (c, k) { return [String(k), (k + 1) + '. ' + ((c.front || {}).title || 'Без названия')]; })
        .filter(function (x) { return !(st.month === sc.id && +x[0] === i); });
      if (!opts.some(function (x) { return x[0] === st.card; })) st.card = opts.length ? opts[0][0] : '';
      var src = DATA.showcases[st.month].cards[+st.card];
      var name = src ? '«' + ((src.front || {}).title || '') + '»' : '';
      add(box, [
        el('p', { class: 'a-hint', text: 'Берёт только вид — шрифт, цвета, стекло, узор, свечение, кнопки. Тексты, даты, картинки и блоки оборота не меняются. Пустые настройки станут «как у всей витрины».' }),
        el('div', { class: 'a-row3' }, [
          selectIn(st, 'month', 'Месяц', Object.keys(DATA.showcases).sort().map(function (id) { return [id, DATA.showcases[id].title]; }), { onChange: function () { st.armed = false; draw(); } }),
          selectIn(st, 'card', 'С какой карточки', opts.length ? opts : [['', 'нет карточек']], { onChange: function () { st.armed = false; draw(); } }),
          selectIn(st, 'what', 'Что взять', [['all', 'Всё оформление'], ['front', 'Только лицевую сторону'], ['back', 'Только оборот и кнопки']])]),
        st.armed
          ? el('div', { class: 'a-confirm' }, ['Оформление ' + name + ' получат все карточки этого месяца. Точно?',
              el('button', { type: 'button', class: 'a-btn a-btn--small a-btn--danger', text: 'Да, всем', onclick: function () {
                var n = 0;
                sc.cards.forEach(function (c) { if (c !== src) { copyStyle(src, c, st.what); n++; } });
                changed(); cb.redrawAll(); toast('Готово: оформление применено к ' + n + ' карточкам. Не забудьте «Сохранить».'); } }),
              el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Отмена', onclick: function () { st.armed = false; draw(); } })])
          : el('div', { class: 'a-theme' }, [
              el('button', { type: 'button', class: 'a-btn a-btn--small a-btn--dark', text: 'Применить к этой карточке', disabled: !src, onclick: function () {
                copyStyle(src, sc.cards[i], st.what); changed(); cb.redrawAll(); toast('Готово: оформление ' + name + ' применено. Тексты не тронуты.'); } }),
              el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Применить ко всем карточкам месяца', disabled: !src, onclick: function () { st.armed = true; draw(); } })])
      ]);
    }
    draw();
    return box;
  }

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
    var isCal = !!(c.monthCal && c.monthCal.on);
    var interactive = !isCal && c.interactive !== false && c.back && c.back.type && c.back.type !== 'static';
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
        selectIn({ v: isCal ? 'cal' : interactive ? 'open' : 'plain' }, 'v', 'Что делает карточка',
          [['plain', 'Просто показывает текст'], ['open', 'Открывается и переворачивается'], ['cal', 'Календарь месяца']], {
          hint: 'Все карточки одинаковые — и центральная тоже. «Открывается» — у карточки появятся оборот, заглушка, кнопки. ' +
            '«Календарь месяца» — при нажатии открывается сетка месяца с маршрутами, встречами и особыми днями. Оборот при переключении не теряется.',
          onChange: function (v) {
            if (v === 'cal') {
              c.monthCal = Object.assign({ days: [], freeHide: [] }, c.monthCal || {}, { on: true });
              if (!f.eyebrow && (!f.title || /^Карточка \d+$/.test(f.title))) { f.eyebrow = 'Календарь'; f.title = sc.title || ''; }
            } else {
              if (c.monthCal) c.monthCal.on = false;
              var on = v === 'open';
              c.interactive = on;
              if (on && (!c.back || !c.back.type || c.back.type === 'static')) c.back = c._back || presetBack('simple');
              if (!on && c.back && c.back.type !== 'static') { c._back = c.back; c.back = { type: 'static' }; }
              if (on) delete c._back;
            }
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
        .concat(styleFields(f.style = f.style || {}, true, cb.redrawGrid, sc.cardStyle)), { open: false }),
      block('Обложка при открытии витрины', [lidFields(sc, c)], { open: ((f.style || {}).lid || {}).mode === 'own', note: 'книга или переворот карты' })
    ];
    if (isCal) out.push(block('Календарь месяца', monthCalFields(sc, c, cb)));
    if (interactive) out.push(block('Пока подробностей нет: оборот-заглушка', stubFields(c, cb), { open: !!(c.back && c.back.stub && c.back.stub.on) }));
    if (interactive) out.push(block('Оборот', backBlocksForm(c, cb)));
    out.push(block('Скопировать оформление', [copyStyleBox(sc, i, cb)], { open: false, note: 'без текстов — только вид' }));
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
            imageIn(r, 'image', 'Картинка маршрута', { hint: 'Показывается на обложках примеров этого маршрута в Песочнице и в архиве.' }),
            fitIn(r, 'coverFit', 'Картинка маршрута на обложках', FIT_HINT + ' Действует у примеров без своей обложки и в архиве.'),
            glassOwnFields(r, 'route', { title: 'Стекло на картинке маршрута', img: function () { return !!r.image; },
              noImg: 'Нет картинки маршрута — стекло будет только у примеров со своей обложкой.', share: !!r.archive }),
            colorOptIn(r, 'color', 'Цвет маршрута', { none: 'без цвета', pick: '#c9a14a',
              hint: 'Лёгкий оттенок и свечение у обложек его примеров, Летописей, отзывов и в архиве. У отдельного примера можно поставить свой.' }),
            archiveFields(r)
          ];
        } })
    ];
  }
  // Архив: галочка «Показывать в архиве» и страница прошедшего маршрута («как это было», фото, кнопки)
  function archiveFields(r) {
    var box = el('div', { class: 'a-glass' });
    function draw() {
      box.replaceChildren();
      var ended = r.dates && r.dates.to && r.dates.to < new Date().toISOString().slice(0, 10);
      add(box, [sub('Архив прошедших маршрутов'),
        switchIn(r, 'archive', 'Показывать в архиве', { onChange: draw,
          hint: 'Маршрут появится на странице «События и архив» → «Прошедшие маршруты» после последнего дня. Без галочки — нигде не показывается.' })]);
      if (!r.archive) return;
      if (!r.archiveBlocks) r.archiveBlocks = [{ id: uid('sb'), kind: 'text', visible: true, title: 'Как это было', text: '', collapse: true },
        { id: uid('sb'), kind: 'images', visible: true, images: [] }];
      r.archiveActions = r.archiveActions || [];
      add(box, [
        el('p', { class: 'a-hint', text: ended ? 'Маршрут уже закончился — после публикации он будет в архиве.' : 'Маршрут ещё не закончился — в архиве появится сам после ' + fmtDates({ from: r.dates.to, to: '' }) + '.' }),
        el('p', { class: 'a-hint', text: 'На странице маршрута в архиве будут картинка, даты, кин, описание — и ниже то, что вы добавите здесь. Примеры дней и Летописи этого маршрута из Песочницы появятся сами.' }),
        sbBlocksForm({ blocks: r.archiveBlocks }, 'archive'),
        el('div', { class: 'a-glass' }, [sub('Кнопки на странице маршрута (до 4)'),
          el('p', { class: 'a-hint', text: 'Например, «Смотреть запись» — ссылка на видео. «Поделиться» даёт ссылку на страницу маршрута в архиве.' }),
          collection(r.archiveActions, { max: 4, visible: true, title: function (a) { return a.label || defLabel(kindOf(a)); },
            make: function () { return { kind: 'link', label: 'Смотреть запись', url: '' }; }, addLabel: '+ Добавить кнопку',
            body: function (a) { return [actionIn({ a: a }, 'a', '', { kinds: ['link', 'share', 'contact', 'download'] })]; } }),
          r.routeUrl ? switchIn(r, 'archivePageBtn', 'Кнопка «Страница маршрута» (ведёт на ссылку маршрута)', { defTrue: true }) : null]),
        el('div', { class: 'a-theme' }, [el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Посмотреть в архиве', onclick: function () { openPreview('events', null, r.id); } })])
      ]);
    }
    draw();
    return box;
  }

  /* ================= СОБЫТИЯ ================= */
  function EVENTS_DEFAULT() { return { eyebrow: '13 MIRRORS', title: 'События', intro: '', tabs: { soon: 'Скоро', past: 'Как это было', cases: 'Примеры практик' }, items: [] }; }
  var EV_TYPES = [['meeting', 'Встреча'], ['meditation', 'Медитация'], ['festival', 'Фестиваль'], ['trip', 'Поездка'], ['practice', 'Практика'], ['case', 'Пример практики (обезличенно)'], ['other', 'Другое']];
  // Заготовки разделов для каждого типа
  var EV_BLOCKS = {
    meeting: [['О встрече'], ['Для кого'], ['Что будет'], ['Ведущая']], meditation: [['О медитации'], ['Как проходит'], ['Что взять с собой']],
    festival: [['О фестивале'], ['Программа'], ['Ведущие'], ['Как добраться']], trip: [['О поездке'], ['Маршрут поездки'], ['Что включено'], ['Проживание']],
    practice: [['О практике'], ['Как проходит'], ['Для кого']], case: [['Запрос'], ['Как шла работа'], ['Что изменилось']], other: [['Описание']]
  };
  function evUsage(id) {
    var u = [];
    Object.keys(DATA.showcases).forEach(function (k) {
      (DATA.showcases[k].cards || []).forEach(function (c) {
        (((c.back || {}).blocks) || []).forEach(function (b) {
          (b.items || []).forEach(function (it) { if (it.action && it.action.kind === 'event' && it.action.eventId === id) u.push(DATA.showcases[k].title + ' → «' + ((c.front || {}).title || '') + '»'); });
          (b.actions || []).forEach(function (a) { if (a && a.kind === 'event' && a.eventId === id) u.push(DATA.showcases[k].title + ' → «' + ((c.front || {}).title || '') + '»'); });
        });
      });
    });
    return u;
  }
  /* ---------- Стекло с надписью на картинке события ----------
     events.look.imgGlass — образец для всех событий (on: false — выключен), item.glass = {mode: '' | 'off' | 'own', …те же поля}.
     Рисует витрина (M13.glassPreview), здесь — поля и живой предпросмотр: обложка в списке и главная картинка на странице события. */
  var GL_POS_OPTS = [['bottom', 'Снизу'], ['band', 'Полосой по нижнему краю'], ['top', 'Сверху'], ['left', 'Слева'], ['right', 'Справа'], ['center', 'По центру'], ['full', 'На всю картинку']];
  var GL_TINT_OPTS = [['dark', 'Тёмное'], ['light', 'Светлое'], ['gold', 'Золотистое'], ['own', 'Свой цвет']];
  var GL_RIM_OPTS = [['none', 'Без контура'], ['line', 'Тонкий'], ['glow', 'Светящийся']];
  var GL_W_OPTS = [['light', 'Тонкая'], ['normal', 'Обычная'], ['semi', 'Полужирная'], ['bold', 'Жирная']];
  var GL_SIZE_OPTS = [['s', 'Мельче'], ['m', 'Обычный'], ['l', 'Крупнее']];
  var GL_ALIGN_OPTS = [['', 'Само (по центру — у «по центру» и «на всю»)'], ['left', 'Слева'], ['center', 'По центру'], ['right', 'Справа']];
  var GL_MARK_OPTS = [['', 'Нет'], ['dandelion', 'Одуванчик'], ['logo', 'Логотип 13 MIRRORS']];
  var GL_FIT_OPTS = [['', 'По тексту'], ['even', 'Одинаковая у всех в ряду']];
  var GL_PT_OPTS = [['tl', 'Точка: сверху слева'], ['tc', 'Точка: сверху по центру'], ['tr', 'Точка: сверху справа'], ['ml', 'Точка: по центру слева'],
    ['mc', 'Точка: в самом центре'], ['mr', 'Точка: по центру справа'], ['bl', 'Точка: снизу слева'], ['bc', 'Точка: снизу по центру'], ['br', 'Точка: снизу справа']];
  var GL_WIDTH_OPTS = [['', 'По тексту'], ['s', 'Узкая (треть картинки)'], ['m', 'Средняя (половина)'], ['l', 'Широкая'], ['f', 'Во всю ширину']];
  var GL_BACK_OPTS = [['', 'Стекло'], ['none', 'Без стекла — текст прямо на картинке'], ['rim', 'Только рамка']];
  var GL_SHADOW_OPTS = [['', 'Мягкая'], ['strong', 'Сильная'], ['none', 'Без тени']];
  var GL_ROW_SIZE_OPTS = [['xs', 'Совсем мелко'], ['s', 'Мелко'], ['m', 'Средне'], ['l', 'Крупно'], ['xl', 'Очень крупно'], ['xxl', 'Огромно']];
  var GL_GAP_OPTS = [['', 'Без отступа'], ['s', 'Маленький'], ['m', 'Средний'], ['l', 'Большой']];
  // Вставки для своих строк — какие есть у каждого вида
  var GL_TOKENS = {
    event: [['название', 'название'], ['тип', 'тип: Встреча…'], ['дата', 'дата и время'], ['место', 'место'], ['цена', 'цена']],
    route: [['маршрут', 'маршрут'], ['даты', 'даты маршрута'], ['день', '«День 1 · …»'], ['кин', 'кин'], ['название', 'название']],
    kin: [['название', 'архетип'], ['кин', 'строка Kin']]
  };
  // С чего начинаются свои строки (потом всё можно поменять)
  function glassRowsStart(kind) {
    var id = function () { return uid('gr'); };
    if (kind === 'event') return [
      { id: id(), text: '{тип}', size: 'xs', caps: true, weight: 'light', font: 'Montserrat' },
      { id: id(), text: '{название}', size: 'xl', weight: 'bold' },
      { id: id(), text: '{дата} · {место}', size: 's', line: true, gap: 'm', font: 'Montserrat' }];
    if (kind === 'kin') return [{ id: id(), text: '{название}', size: 'l' }];
    return [
      { id: id(), text: 'Маршрут · {даты}', size: 'xs', caps: true, weight: 'light', font: 'Montserrat' },
      { id: id(), text: '{маршрут}', size: 'xl' },
      { id: id(), text: '{день}', size: 's', gap: 's' }];
  }
  // Редактор своих строк: до 6, у каждой текст со вставками, шрифт, толщина, курсив, размер, цвет, прописные, отступ, линия
  function glassRowsFields(g, kind) {
    var box = el('div', { class: 'a-gl-rows' });
    g.rows = g.rows || [];
    function draw() {
      box.replaceChildren();
      add(box, [
        el('p', { class: 'a-hint', text: 'Слова в фигурных скобках подставляются сами из полей — у каждого ' +
          (kind === 'event' ? 'события' : kind === 'kin' ? 'карты' : 'маршрута и примера') + ' свои. Пустая вставка не оставляет лишних «·».' }),
        collection(g.rows, { ordered: false, visible: true, max: 6, title: function (r) { return r.text || 'Пустая строка'; },
          make: function () { return { id: uid('gr'), text: '', size: 'm' }; }, addLabel: '+ Добавить строку', onChange: draw,
          body: function (r) {
            var chips = el('div', { class: 'a-gl-tokens' }, [el('span', { class: 'a-hint', text: 'Вставить:' })].concat(GL_TOKENS[kind].map(function (t) {
              return el('button', { type: 'button', class: 'a-btn a-btn--small a-btn--ghost', text: t[1], onclick: function () {
                r.text = (String(r.text || '').replace(/\s+$/, '') + (r.text ? ' ' : '') + '{' + t[0] + '}'); changed(); draw(); } });
            })));
            return [
              textIn(r, 'text', 'Текст строки', { ph: kind === 'event' ? 'Встреча · {дата}' : 'Свои слова и вставки' }),
              chips,
              el('div', { class: 'a-row3' }, [
                fontLook(selectIn(r, 'font', 'Шрифт', [['', 'Как у всей надписи']].concat((window.M13.FONTS || []).map(function (f) { return [f, f]; })), { def: '' })),
                selectIn(r, 'weight', 'Толщина', GL_W_OPTS, { def: 'normal' }),
                selectIn(r, 'size', 'Размер', GL_ROW_SIZE_OPTS, { def: 'm' })]),
              el('div', { class: 'a-row3' }, [switchIn(r, 'italic', 'Курсив'), switchIn(r, 'caps', 'Прописными, с разрядкой'),
                selectIn(r, 'gap', 'Отступ перед строкой', GL_GAP_OPTS, { def: '' })]),
              el('div', { class: 'a-row' }, [
                colorOptIn(r, 'color', 'Цвет строки', { inh: function () { return g.color || '#ecd3a3'; }, inhLabel: 'как у всей надписи' }),
                switchIn(r, 'line', 'Тонкая линия над строкой', { hint: 'Цветом контура. У первой строки не рисуется.' })])
            ];
          } })
      ]);
    }
    draw();
    return box;
  }
  /* Виды картинок со стеклом: 'event' — события (events.look.imgGlass, item.glass); 'route' — картинки маршрутов: примеры дней,
     Летописи, маршруты в архиве (sandbox.look.imgGlass, route.glass); 'kin' — Карты-Отражения (reflection.look.imgGlass, item.glass). */
  var GL_KINDS = {
    event: { pat: function () { var ev = DATA.events || {}; ev.look = ev.look || {}; return ev.look; }, all: 'Как у всех событий', where: 'События → Оформление страницы → Стекло на картинке' },
    route: { pat: function () { var sb = DATA.sandbox || {}; sb.look = sb.look || {}; return sb.look; }, all: 'Как у всех маршрутов', where: 'Песочница → Оформление страницы → Стекло на картинках маршрутов' },
    kin: { pat: function () { var rf = DATA.reflection || {}; rf.look = rf.look || {}; return rf.look; }, all: 'Как у всех Карт-Отражений', where: 'Карты-Отражения → Оформление страницы → Стекло на картинке' }
  };
  // Образец — look.imgGlass (look.glass занято: «Прозрачность панелей»)
  function glassPattern(kind) { var lk = GL_KINDS[kind || 'event'].pat(); return (lk.imgGlass = lk.imgGlass || {}); }
  // Пример для предпросмотра: ближайшее событие с картинкой, иначе — выдуманное
  function glassSample() {
    var L = ((DATA.events || {}).items || []).filter(function (e) { return e && e.cover && e.type !== 'case'; });
    var up = L.filter(function (e) { return e.visible !== false && (e.dateEnd || e.date || '9') >= new Date().toISOString().slice(0, 10); });
    return up[0] || L[0] || { type: 'meeting', title: 'PRO МАК', date: '2026-10-08', time: '19:00', place: 'Москва', price: 'свободный вход', cover: null };
  }
  // Для маршрутов — пример дня с картинкой (своей или маршрута), иначе маршрут с картинкой; для Карт — первая карта с картинкой
  function glassSampleOf(kind) {
    if (kind === 'event') return { k: 'event', x: glassSample() };
    if (kind === 'kin') {
      var ks = ((DATA.reflection || {}).items || []).filter(function (x) { return x && x.image; });
      return { k: 'kin', x: ks[0] || { title: 'Проводник пространств', meta: 'Kin 33 · Красный Резонансный Небесный Странник', image: null } };
    }
    var rs = (DATA.routes || {}).routes || [];
    var ds = ((DATA.sandbox || {}).days || []).filter(function (d) { var r = routeById(d.routeId); return d.visible !== false && (d.cover || (r && r.image)); });
    if (ds.length) return { k: 'days', x: ds[0] };
    var rr = rs.filter(function (r) { return r.image; })[0];
    return { k: 'route', x: rr || { title: 'Красный Дракон', dates: { from: '2026-08-27', to: '2026-09-08' }, image: null } };
  }
  // Предпросмотр: обложка в списке и картинка на странице. getS() → {k, x} — что показывать (пусто — пример)
  function glassDemo(g, getS, kind) {
    kind = kind || 'event';
    var cover = el('div', { class: 'a-gl-cover' + (kind === 'kin' ? ' a-gl-cover--kin' : '') }), page = el('div', { class: 'a-gl-page' });
    var cols = [el('div', { class: 'a-gl-col' }, [cover, el('span', { class: 'a-hint', text: kind === 'kin' ? 'Карта на странице «Примеры»' : 'Обложка в списке' })])];
    if (kind !== 'kin') cols.push(el('div', { class: 'a-gl-col' }, [page, el('span', { class: 'a-hint', text: kind === 'event' ? 'На странице события' : 'На странице примера' })]));
    var box = el('div', { class: 'a-gl-demo' }, cols);
    function paint(frame, img, html) {
      frame.innerHTML = (img ? '<img alt="" src="' + imgSrc(img).replace(/"/g, '&quot;') + '">' : '<span class="a-gl-noimg"></span>') +
        '<span class="m13-gl-box">' + html + '</span>';
    }
    function run() {
      var sm = (getS && getS()) || glassSampleOf(kind), M = window.M13;
      var img = M.glassFor(sm.k, sm.x, DATA).img, html = M.glassPreviewOf(sm.k, sm.x, g, DATA);
      paint(cover, img, html); if (kind !== 'kin') paint(page, img, html);
    }
    LIVE.push({ node: box, run: run });
    run();
    return box;
  }
  // Поля стекла с надписью на картинке (не путать с glassFields — «Стекло и узор» карточек): общие для образца и своего. getS — что показывать в предпросмотре (пусто — пример)
  function glassImgFields(g, getS, kind) {
    kind = kind || 'event';
    var box = el('div', { class: 'a-glass' });
    function redraw() { draw(); }
    function lines() {
      if (kind === 'event') return [
        el('p', { class: 'a-hint', text: 'Дата и время, место и цена берутся из полей события сами. Пустое поле на стекле не появляется.' }),
        switchIn(g, 'top', 'Надпись сверху', { defTrue: true, onChange: redraw }),
        g.top === false ? null : textIn(g, 'topText', 'Своя надпись сверху', { ph: 'пусто — тип события: Встреча, Медитация, Фестиваль…' }),
        switchIn(g, 'title', 'Название', { defTrue: true }),
        el('div', { class: 'a-row3' }, [switchIn(g, 'date', 'Дата и время', { defTrue: true }), switchIn(g, 'place', 'Место', { defTrue: true }), switchIn(g, 'price', 'Цена', { defTrue: true })])];
      if (kind === 'kin') return [
        el('p', { class: 'a-hint', text: 'Название архетипа и строка Kin берутся из полей карты сами. Kin уже есть на самой карте, поэтому обычно он выключен.' }),
        switchIn(g, 'title', 'Название архетипа (крупно)', { defTrue: true }),
        switchIn(g, 'kin', 'Строка «Kin …» — мелко под названием'),
        textIn(g, 'topText', 'Своя надпись сверху (мелко)', { ph: 'пусто — без надписи' })];
      return [
        el('p', { class: 'a-hint', text: 'Всё берётся само: название и даты — из маршрута, «День 1 · …» и кин — из примера дня. Пустое поле на стекле не появляется.' }),
        switchIn(g, 'top', 'Надпись сверху', { defTrue: true, onChange: redraw }),
        g.top === false ? null : textIn(g, 'topText', 'Своя надпись сверху', { ph: 'пусто — «Маршрут» (у Летописей — название маршрута)' }),
        el('div', { class: 'a-row' }, [switchIn(g, 'dates', 'Даты маршрута (в надписи сверху)', { defTrue: true }), switchIn(g, 'title', 'Название (крупно)', { defTrue: true })]),
        el('div', { class: 'a-row' }, [switchIn(g, 'day', '«День 1 · …» (у примеров дней)', { defTrue: true }), switchIn(g, 'kin', 'Кин', { defTrue: true })])];
    }
    function draw() {
      var own = g.write === 'own', back = g.back || '', pt = !!(window.M13.GLASS_PT || {})[g.pos];
      box.replaceChildren();
      add(box, [glassDemo(g, getS, kind), sub('Что написано на стекле'),
        selectIn(g, 'write', 'Как писать', [['', 'Само — строки из полей, как сейчас'], ['own', 'Свои строки — свой шрифт, толщина, курсив, размер у каждой']], { def: '', onChange: function (v) {
          if (v === 'own' && !(g.rows && g.rows.length)) {
            g.rows = glassRowsStart(kind);
            // у афиш событий свои строки начинаются без стекла — текст прямо на картинке
            if (kind === 'event' && !g.back) { g.back = 'none'; if (!g.pos || !(window.M13.GLASS_PT || {})[g.pos]) g.pos = 'tl'; }
          }
          changed(); redraw(); } })].concat(own ? [glassRowsFields(g, kind)] : lines(), [
        selectIn(g, 'mark', 'Маленький значок', GL_MARK_OPTS, { def: '' }),
        own ? null : switchIn(g, 'extraOn', 'Ещё строка — свой текст', { onChange: redraw }),
        !own && g.extraOn ? textIn(g, 'extra', 'Ещё строка', { ph: kind === 'event' ? 'Ведущая — Елена Распругина' : 'Created with you. For you.' }) : null,
        sub('Где надпись и подложка'),
        el('div', { class: 'a-row' }, [selectIn(g, 'pos', 'Где', GL_POS_OPTS.concat(GL_PT_OPTS), { def: kind === 'event' ? 'bottom' : 'band', onChange: redraw,
            hint: '«Точка» — надпись в углу, у края или в центре, шириной по тексту.' }),
          pt ? selectIn(g, 'width', 'Ширина надписи', GL_WIDTH_OPTS, { def: '' }) : el('span')]),
        el('div', { class: 'a-row' }, [selectIn(g, 'back', 'Подложка', GL_BACK_OPTS, { def: '', onChange: redraw }),
          selectIn(g, 'shadow', 'Тень у букв', GL_SHADOW_OPTS, { def: '', hint: 'Под тёмным текстом тень светлая, под светлым — тёмная. Без стекла помогает читать надпись на картинке.' })]),
        back ? null : el('div', { class: 'a-row' }, [selectIn(g, 'tint', 'Оттенок стекла', GL_TINT_OPTS, { def: 'dark', onChange: redraw }),
          g.tint === 'own' ? colorOptIn(g, 'tintColor', 'Цвет стекла', { pick: '#1c2a3a', none: 'не выбран — тёмный' }) : el('span')]),
        back ? null : el('div', { class: 'a-row' }, [
          rangeIn(g, 'glass', 'Прозрачность стекла', { max: 100, step: 5, unit: '%', def: 70, hint: 'Больше — прозрачнее, сквозь стекло видна картинка. 60–80% — надпись читается.' }),
          rangeIn(g, 'blur', 'Размытие за стеклом', { max: 20, unit: ' px', def: 8 })]),
        back === 'none' ? null : el('div', { class: 'a-row' }, [selectIn(g, 'rim', 'Контур', back === 'rim' ? GL_RIM_OPTS.slice(1) : GL_RIM_OPTS, { def: 'line' }),
          colorOptIn(g, 'rimColor', 'Цвет контура и линий', { none: 'как цвет текста', pick: '#b8893a' })]),
        back === 'none' && own ? colorOptIn(g, 'rimColor', 'Цвет линий между строками', { none: 'как цвет текста', pick: '#b8893a' }) : null,
        selectIn(g, 'fit', 'Высота стекла', GL_FIT_OPTS, { def: '', hint: 'По тексту — длинное название делает стекло выше. Одинаковая — в ряду обложек все стёкла одной высоты (по самому высокому), текст посередине.' }),
        sub('Текст'),
        el('div', { class: 'a-row' }, [
          fontIn(g, 'font', own ? 'Шрифт всей надписи' : 'Шрифт названия', (window.M13.FONTS || []).map(function (f) { return [f, f]; }), null, 'PRO МАК · Свет внутри · 13 MIRRORS'),
          own ? el('span') : selectIn(g, 'weight', 'Толщина букв названия', GL_W_OPTS, { def: 'normal', hint: 'Если у шрифта нет такой толщины — будет обычная.' })]),
        el('div', { class: 'a-row3' }, [
          colorOptIn(g, 'color', 'Цвет текста', { base: '#ecd3a3', none: 'золотистый' }),
          selectIn(g, 'size', own ? 'Размер всей надписи' : 'Размер текста', GL_SIZE_OPTS, { def: 'm' }),
          selectIn(g, 'align', 'Выравнивание', GL_ALIGN_OPTS, { def: '' })])
      ]));
    }
    draw();
    return box;
  }
  // «Оформление страницы»: образец на все картинки этого вида
  var GL_PAT_TEXT = {
    event: ['Картинка события видна целиком, поверх — прозрачное стекло с надписью (настоящий текст, не часть картинки). Это образец для всех событий, чтобы афиши были в одном ключе: меняются только картинка и слова. У любого события его можно выключить или сделать своё.',
      'Стекло с надписью на картинках событий', 'Как в эскизе: тёмное снизу, золотистый текст'],
    route: ['Картинка маршрута на обложках примеров дней, Летописей и маршрутов в архиве, а на странице примера — крупно, поверх неё прозрачное стекло с надписью. Это образец для всех маршрутов; у любого маршрута (раздел «Маршруты») его можно выключить или сделать своё.',
      'Стекло с надписью на картинках маршрутов', 'Как в эскизе: тёмное полосой снизу, золотистый текст'],
    kin: ['Карта крупно, поверх — прозрачное стекло с названием архетипа; нажатие открывает карту целиком. Это образец для всех карт; у любой карты его можно выключить или сделать своё.',
      'Стекло с надписью на Картах-Отражениях', 'Как в эскизе: тёмное полосой снизу, только название']
  };
  function glassPatternFields(kind) {
    kind = kind || 'event';
    var g = glassPattern(kind), box = el('div', { class: 'a-glass' }), T3 = GL_PAT_TEXT[kind];
    function draw() {
      box.replaceChildren();
      add(box, [
        el('p', { class: 'a-hint', text: T3[0] }),
        switchIn(g, 'on', T3[1], { defTrue: true, onChange: draw }),
        g.on === false ? null : el('div', { class: 'a-theme' }, [el('button', { type: 'button', class: 'a-btn a-btn--small', text: T3[2], onclick: function () {
          var keep = { on: g.on }; Object.keys(g).forEach(function (k) { delete g[k]; }); Object.assign(g, keep); changed(); draw(); } })]),
        g.on === false ? null : glassImgFields(g, null, kind)
      ]);
    }
    draw();
    return box;
  }
  // У события / маршрута / карты: как у всех / выключено / своё (своё начинается с копии образца).
  // img() — есть ли картинка; share — показать кнопку «Превью ссылки для Telegram»
  function glassOwnFields(x, kind, o) {
    o = o || {};
    var box = el('div', { class: 'a-glass' }), K = GL_KINDS[kind], sk = kind === 'route' ? 'route' : kind;
    function getS() {
      // у маршрута в предпросмотре — его пример дня (если есть), иначе сам маршрут, как в архиве
      if (kind === 'route') { var d = ((DATA.sandbox || {}).days || []).filter(function (y) { return y.routeId === x.id && y.visible !== false && !y.cover; })[0]; if (d) return { k: 'days', x: d }; }
      return { k: sk, x: x };
    }
    function draw() {
      var g = x.glass = x.glass || {}, pat = glassPattern(kind), has = o.img ? o.img() : true;
      box.replaceChildren();
      add(box, [
        sub(o.title || 'Стекло на картинке'),
        selectIn(g, 'mode', 'Стекло с надписью', [['', K.all], ['off', 'Выключено'], ['own', 'Своё']], { def: '', onChange: function (v) {
          if (v === 'own' && Object.keys(g).length < 2) { var c = clone(pat); delete c.on; Object.assign(g, c, { mode: 'own' }); }
          changed(); draw(); } }),
        !has ? el('p', { class: 'a-hint a-hint--warn', text: o.noImg || 'Нет картинки — стекла не будет.' }) : null,
        !g.mode ? el('p', { class: 'a-hint', text: pat.on === false ? 'Образец выключен (' + K.where + ') — стекла нет.' : 'Как задано в образце: ' + K.where + '.' }) : null,
        !g.mode && pat.on !== false && has ? glassDemo(pat, getS, kind) : null,
        g.mode === 'own' ? el('div', { class: 'a-theme' }, [el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Взять заново из образца', onclick: function () {
          var c = clone(pat); delete c.on; Object.keys(g).forEach(function (k) { delete g[k]; }); Object.assign(g, c, { mode: 'own' }); changed(); draw(); } })]) : null,
        g.mode === 'own' ? glassImgFields(g, getS, kind) : null,
        g.mode !== 'off' && has ? el('div', { class: 'a-theme' }, [
          o.share ? el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Превью ссылки для Telegram', onclick: function () { glassShareShow(sk, x); } }) : null,
          el('button', { type: 'button', class: 'a-btn a-btn--small', text: '↓ Сохранить картинку с надписью', onclick: function () { glassSave(sk, x); } })]) : null
      ]);
    }
    draw();
    return box;
  }
  function glassEventFields(e) { return glassOwnFields(e, 'event', { img: function () { return !!e.cover; }, noImg: 'Нет главной картинки — стекла не будет.', share: true }); }
  // У примера дня / Летописи: только кнопка превью (стекло задаётся у маршрута)
  function glassItemShare(t, x) {
    return el('div', { class: 'a-theme' }, [el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Превью ссылки для Telegram', onclick: function () { glassShareShow(t, x); } }),
      el('button', { type: 'button', class: 'a-btn a-btn--small', text: '↓ Сохранить картинку с надписью', onclick: function () { glassSave(t, x); } })]);
  }

  /* ---------- Превью ссылки на событие: стекло с надписью «впекается» в картинку 1200×630 ----------
     Мессенджеры показывают картинку из og:image, текста сайта не видят. При публикации для события со стеклом рисуется
     JPEG: картинка целиком (по бокам — она же, размытая), поверх — стекло с теми же строками, что на сайте. Файл — item.shareImage. */
  function loadImg(src) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
  }
  function glassWrap(ctx, text, w, max) {
    var words = String(text).split(/\s+/).filter(Boolean), lines = [], cur = '';
    words.forEach(function (wd) {
      var t = cur ? cur + ' ' + wd : wd;
      if (cur && ctx.measureText(t).width > w) { lines.push(cur); cur = wd; } else cur = t;
    });
    if (cur) lines.push(cur);
    if (max && lines.length > max) { lines = lines.slice(0, max); lines[max - 1] = lines[max - 1].replace(/\s*\S*$/, '') + '…'; }
    return lines;
  }
  // kind — 'event' | 'days' | 'chronicles' | 'route' | 'kin'; x — событие, пример, маршрут или карта.
  // Рисует то же, что на сайте: строки «само» или свои строки, место (края, полоса, девять точек), подложку, контур, тень у букв.
  // opt.native — картинка в родных пропорциях (до 2400 px по длинной стороне), надпись как на странице сайта; иначе — превью 1200×630
  function glassCanvas(kind, x, g, D, opt) {
    opt = opt || {};
    var M = window.M13, DEF = M.GLASS_DEF, W = SHARE_SIZE[0], H = SHARE_SIZE[1], PT = M.GLASS_PT || {};
    function v(k) { return g[k] == null || g[k] === '' ? DEF[k] : g[k]; }
    var L = M.glassLinesOf(kind, x, g, D), own = M.glassRowsOf(kind, x, g, D), font = v('font'), color = g.color || DEF.color, tint = v('tint');
    var pos = g.pos || M.GLASS_POS_DEF[kind] || DEF.pos, pt = PT[pos] ? pos : '', src = M.glassFor(kind, x, D).img;
    var back = g.back === 'none' || g.back === 'rim' ? g.back : 'glass', rimK = v('rim');
    if (back === 'rim' && rimK === 'none') rimK = 'line';
    var rimC = /^#[0-9a-f]{6}$/i.test(g.rimColor || '') ? g.rimColor : '';
    var rgb = tint === 'own' ? [1, 3, 5].map(function (i) { return parseInt((g.tintColor || '#141414').substr(i, 2), 16); }).join(',')
      : { light: '255,255,255', dark: '20,14,10', gold: '236,211,163' }[tint] || '20,14,10';
    var pageFont = ((kind === 'days' || kind === 'chronicles' ? D.sandbox : kind === 'kin' ? D.reflection : D.events) || {}).look;
    pageFont = (pageFont || {}).font || '';
    var WN = { light: 300, normal: 400, semi: 600, bold: 700 };
    function wOf(f, w) { var n = WN[w] || 400; return M.fontCaps(f).w.indexOf(n) >= 0 ? n : 400; }
    var W8 = wOf(font, v('weight'));
    var fam = function (f) { return f ? "'" + f + "', Georgia, serif" : 'Georgia, serif'; };
    var loads = [[font, W8, false], [pageFont, 600, false], [pageFont, 400, false]];
    (own || []).forEach(function (r) { var f = r.font || font; loads.push([f, wOf(f, r.weight), !!r.italic && M.fontCaps(f).it]); });
    loads.forEach(function (l) { if (l[0]) M.ensureFont(l[0]); });
    var fontsReady = document.fonts && document.fonts.load ? Promise.all(loads.map(function (l) {
      return document.fonts.load((l[2] ? 'italic ' : '') + l[1] + ' 40px ' + fam(l[0]), 'Аб');
    })).catch(function () {}) : Promise.resolve();
    var markP = g.mark === 'dandelion' ? loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(M.dandSVG('logo').replace(/currentColor/g, color).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="124" ')))
      : g.mark === 'logo' ? loadImg(D.settings.logo ? imgSrc(D.settings.logo) : '../assets/logo.png') : Promise.resolve(null);
    function hexL(h) { h = /^#[0-9a-f]{6}$/i.test(h || '') ? h : '#ecd3a3'; return 0.299 * parseInt(h.substr(1, 2), 16) + 0.587 * parseInt(h.substr(3, 2), 16) + 0.114 * parseInt(h.substr(5, 2), 16); }
    return Promise.all([loadImg(imgSrc(src)), fontsReady, markP.catch(function () { return null; })]).then(function (r) {
      var img = r[0], mk = r[2], c = document.createElement('canvas'), iw = img.naturalWidth, ih = img.naturalHeight, R, s, f;
      if (opt.native) {
        // сама картинка, без полей; надпись — как на странице события, где картинка шириной около 1000 px (f — во сколько раз крупнее)
        var kn = Math.min(1, 2400 / Math.max(iw, ih));
        W = Math.round(iw * kn); H = Math.round(ih * kn); c.width = W; c.height = H;
        R = { x: 0, y: 0, w: W, h: H }; s = 1; f = W / 1000;
      } else { c.width = W; c.height = H; s = 1.55; f = 1; }
      var ctx = c.getContext('2d');
      if (!opt.native) {
        // фон: та же картинка крупно и размыто; сверху — картинка целиком
        var sc = Math.max(W / iw, H / ih) * 1.15;
        ctx.fillStyle = '#16110d'; ctx.fillRect(0, 0, W, H);
        ctx.filter = 'blur(28px)'; ctx.drawImage(img, (W - iw * sc) / 2, (H - ih * sc) / 2, iw * sc, ih * sc); ctx.filter = 'none';
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, 0, W, H);
        var k = Math.min(W / iw, H / ih); R = { w: iw * k, h: ih * k }; R.x = (W - R.w) / 2; R.y = (H - R.h) / 2;
      }
      ctx.drawImage(img, R.x, R.y, R.w, R.h);
      // размеры — как на сайте (vitrina.css, .m13-gl); в превью Telegram крупнее (s): его показывают уменьшенным
      var u = Math.max(R.w / 100, 0.75 * R.h / 100), gk = { s: 0.84, l: 1.2 }[g.size] || 1;
      function cl(a, x, b) { return s * f * Math.max(a, Math.min(b, x / f)); }
      var ins = cl(6, 2.6 * u, 16), off = cl(8, 4 * u, 48), padY = cl(6, 3.2 * u, 22), padX = cl(8, 4 * u, 28), rad = cl(8, 2.2 * u, 14), gap = cl(2, 0.9 * u, 7);
      var side = pos === 'left' || pos === 'right';
      var fTop = cl(7.5, 2.3 * u * gk, 13), fT = side ? cl(11, 4.6 * u * gk, 34) : cl(12, 7.4 * u * gk, 50), fD = cl(9, 3 * u * gk, 18), fX = cl(10, 3.4 * u * gk, 21);
      var maxW = pt ? R.w - 2 * off : pos === 'band' ? R.w : side ? R.w * 0.44 : pos === 'center' ? R.w * 0.7 : R.w - 2 * ins;
      var WID = { s: 0.36, m: 0.5, l: 0.7 };
      var bw = pt ? (g.width === 'f' ? R.w - 2 * off : WID[g.width] ? R.w * WID[g.width] : maxW) : maxW, tw = bw - 2 * padX;
      var al = g.align || (pt ? PT[pt] : pos === 'center' || pos === 'full' ? 'center' : 'left');
      var mkW = mk ? (g.mark === 'logo' ? fD * 1.15 * mk.naturalWidth / mk.naturalHeight : fD * 2.1 * 100 / 124) : 0, mkH = mk ? (g.mark === 'logo' ? fD * 1.15 : fD * 2.1) : 0;
      var rows = [];
      if (own) {
        var RS = M.GLASS_ROW, GP = M.GLASS_GAP;
        own.forEach(function (rw, i) {
          var f = rw.font || font, z = RS[rw.size] || RS.m, size = cl(z[1], z[0] * u * gk, z[2]), it = !!rw.italic && M.fontCaps(f).it;
          ctx.font = (it ? 'italic ' : '') + wOf(f, rw.weight) + ' ' + size + 'px ' + fam(f);
          if ('letterSpacing' in ctx) ctx.letterSpacing = rw.caps ? (size * 0.24) + 'px' : '0px';
          var lh = rw.size === 'xs' || rw.size === 's' ? 1.3 : rw.size === 'm' ? 1.22 : rw.size === 'xxl' ? 0.98 : rw.size === 'xl' ? 1.02 : 1.12;
          var line = !!rw.line && i > 0, top = i ? (GP[rw.gap] || 0) * u * s + (line ? 1.2 * u * s : 0) : 0;
          rows.push({ f: ctx.font, size: size, lh: lh, ls: rw.caps ? 0.24 : 0, color: /^#[0-9a-f]{6}$/i.test(rw.color || '') ? rw.color : '',
            lines: glassWrap(ctx, rw.caps ? rw.text.toUpperCase() : rw.text, tw, 4), top: top, line: line, lpad: line ? 1.1 * u * s : 0 });
        });
        if (mk) rows.push({ mark: true, lines: [], size: fD, h: mkH, top: u * s });
      } else {
        if (L.top) { ctx.font = '600 ' + fTop + 'px ' + fam(pageFont); if ('letterSpacing' in ctx) ctx.letterSpacing = (fTop * 0.2) + 'px'; rows.push({ f: ctx.font, size: fTop, lines: glassWrap(ctx, L.top.toUpperCase(), tw, 2), ls: 0.2, a: 0.92 }); }
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        if (L.title) { ctx.font = W8 + ' ' + fT + 'px ' + fam(font); rows.push({ f: ctx.font, size: fT, lh: 1.05, lines: glassWrap(ctx, L.title, tw, 3) }); }
        if (L.meta.length || mk) {
          ctx.font = '400 ' + fD + 'px ' + fam(pageFont);
          var ml = L.meta.length ? glassWrap(ctx, L.meta.join(' · '), tw - (mk ? mkW + fD * 0.6 : 0), 3) : [];
          rows.push({ f: ctx.font, size: fD, lh: 1.3, lines: ml, mark: true, a: 0.96, h: Math.max(ml.length * fD * 1.3, mkH) });
        }
        if (L.extra) { ctx.font = 'italic 400 ' + fX + 'px ' + fam(font); rows.push({ f: ctx.font, size: fX, lh: 1.25, lines: glassWrap(ctx, L.extra, tw, 3) }); }
        rows.forEach(function (w, i) { if (i) w.top = gap; });
      }
      function widthOf(w) {
        ctx.font = w.f || ctx.font; if ('letterSpacing' in ctx) ctx.letterSpacing = w.ls ? (w.size * w.ls) + 'px' : '0px';
        return w.lines.reduce(function (m, l) { return Math.max(m, ctx.measureText(l).width); }, 0) + (w.mark && mk ? (w.lines.length ? fD * 0.6 : 0) + mkW : 0);
      }
      rows.forEach(function (w) { if (w.h == null) w.h = w.lines.length * w.size * (w.lh || 1.15) + (w.lpad || 0); w.top = w.top || 0; });
      // «по тексту» у девяти точек — ширина по самой длинной строке
      if (pt && !g.width) { bw = Math.min(maxW, rows.reduce(function (m, w) { return Math.max(m, widthOf(w)); }, 0) + 2 * padX); tw = bw - 2 * padX; }
      var ch = rows.reduce(function (a, w) { return a + w.h + w.top; }, 0);
      var fixed = side || pos === 'full', bh = fixed ? R.h - 2 * ins : Math.min(ch + 2 * padY, pos === 'band' ? R.h : R.h - 2 * (pt ? off : ins));
      var col = pt ? PT[pt] : '', row = pt ? pt.charAt(0) : '';
      var bx = pt ? (col === 'left' ? R.x + off : col === 'right' ? R.x + R.w - off - bw : R.x + (R.w - bw) / 2)
        : pos === 'band' ? R.x : pos === 'right' ? R.x + R.w - ins - bw : pos === 'center' ? R.x + (R.w - bw) / 2 : R.x + ins;
      var by = pt ? (row === 't' ? R.y + off : row === 'b' ? R.y + R.h - off - bh : R.y + (R.h - bh) / 2)
        : pos === 'top' || fixed ? R.y + ins : pos === 'center' ? R.y + (R.h - bh) / 2 : pos === 'band' ? R.y + R.h - bh : R.y + R.h - ins - bh;
      var r0 = pos === 'band' ? 0 : rad;
      function box() { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, r0); else ctx.rect(bx, by, bw, bh); }
      var lineC = rimC || color;
      // подложка: стекло (размытая картинка под ним и оттенок) — или ничего
      if (back === 'glass') {
        ctx.save(); box(); ctx.clip();
        var bl = Math.max(0, Math.min(24, +v('blur'))) * s;
        if (bl) { ctx.filter = 'blur(' + bl + 'px) saturate(1.2)'; ctx.drawImage(img, R.x, R.y, R.w, R.h); ctx.filter = 'none'; }
        ctx.fillStyle = 'rgba(' + rgb + ',' + ((100 - Math.max(0, Math.min(100, +v('glass')))) / 100) + ')'; ctx.fillRect(bx, by, bw, bh);
        ctx.restore();
      }
      if (back !== 'none' && rimK !== 'none') {
        ctx.save(); ctx.lineWidth = 2 * f; ctx.strokeStyle = lineC; ctx.globalAlpha = rimK === 'glow' ? 0.78 : rimC ? 0.88 : 0.42;
        if (rimK === 'glow') { ctx.shadowColor = lineC; ctx.shadowBlur = 22; }
        if (pos === 'band') { ctx.beginPath(); ctx.moveTo(bx, by + 1); ctx.lineTo(bx + bw, by + 1); ctx.stroke(); } else { box(); ctx.stroke(); }
        ctx.restore();
      }
      // текст; тень у букв — светлая под тёмным текстом, тёмная под светлым
      ctx.save(); if (back !== 'none') { box(); ctx.clip(); }
      var shC = hexL(color) < 110 ? 'rgba(255,248,235,.6)' : 'rgba(0,0,0,.34)', shK = (g.shadow === 'none' ? 0 : g.shadow === 'strong' ? 18 : 10) * f;
      ctx.textBaseline = 'top'; ctx.shadowColor = shC; ctx.shadowBlur = shK; ctx.shadowOffsetY = shK ? f : 0;
      var y = fixed ? (pos === 'full' ? by + (bh - ch) / 2 : by + bh - padY - ch) : by + padY;
      if (!fixed && g.fit === 'even') y = by + (bh - ch) / 2;
      function tx(w, x0) { return al === 'center' ? x0 + (tw - w) / 2 : al === 'right' ? x0 + tw - w : x0; }
      rows.forEach(function (w) {
        y += w.top;
        if (w.line) {
          ctx.save(); ctx.shadowBlur = 0; ctx.globalAlpha = 0.6; ctx.strokeStyle = lineC; ctx.lineWidth = 1.5 * f;
          ctx.beginPath(); ctx.moveTo(bx + padX, y); ctx.lineTo(bx + padX + tw, y); ctx.stroke(); ctx.restore();
          y += w.lpad;
        }
        ctx.fillStyle = w.color || color; ctx.globalAlpha = w.a || 1;
        if (w.f) ctx.font = w.f;
        if ('letterSpacing' in ctx) ctx.letterSpacing = w.ls ? (w.size * w.ls) + 'px' : '0px';
        var lh = w.size * (w.lh || 1.15), x0 = bx + padX, hh = w.h - (w.lpad || 0);
        if (w.mark) {
          var widest = w.lines.reduce(function (m, l) { return Math.max(m, ctx.measureText(l).width); }, 0);
          var full = widest + (mk ? (widest ? fD * 0.6 : 0) + mkW : 0), sx = tx(full, x0), ty = y + (hh - w.lines.length * lh) / 2;
          w.lines.forEach(function (l, i) { ctx.fillText(l, w.lines.length > 1 ? tx(ctx.measureText(l).width, x0) : sx, ty + i * lh); });
          if (mk) {
            var mx = sx + full - mkW, my = y + (hh - mkH) / 2;
            if (g.mark === 'logo') {   // логотип — только очертания, цветом текста
              var o = document.createElement('canvas'); o.width = Math.ceil(mkW * 2); o.height = Math.ceil(mkH * 2);
              var oc = o.getContext('2d'); oc.drawImage(mk, 0, 0, o.width, o.height); oc.globalCompositeOperation = 'source-in'; oc.fillStyle = color; oc.fillRect(0, 0, o.width, o.height);
              ctx.drawImage(o, mx, my, mkW, mkH);
            } else ctx.drawImage(mk, mx, my, mkW, mkH);
          }
        } else w.lines.forEach(function (l, i) { ctx.fillText(l, tx(ctx.measureText(l).width, x0), y + i * lh); });
        y += hh;
      });
      ctx.restore();
      return c;
    });
  }
  // При публикации: у каждого видимого события со стеклом — своя картинка превью (data:… → media/… в extractImages)
  // Также у примеров дней и Летописей (sandbox/<id>/) и маршрутов в архиве (events/<id>/) — стекло с картинки маршрута
  function bakeGlass(P) {
    var ev = P.events || {}, sb = P.sandbox || {}, jobs = [];
    function bake(kind, x, ok) {
      delete x.shareImage;
      var f = ok ? window.M13.glassFor(kind, x, P) : null;
      if (!f || !f.g || !f.img) return;
      jobs.push(glassCanvas(kind, x, f.g, P).then(function (c) { x.shareImage = c.toDataURL('image/jpeg', 0.88); }).catch(function () {}));
    }
    (ev.items || []).forEach(function (e) { if (e) bake('event', e, e.visible !== false && e.type !== 'case'); });
    ['days', 'chronicles'].forEach(function (t) { (sb[t] || []).forEach(function (x) { if (x) bake(t, x, x.visible !== false); }); });
    ((P.routes || {}).routes || []).forEach(function (r) { if (r) bake('route', r, r.visible !== false && !!r.archive); });
    return Promise.all(jobs);
  }
  // Имя файла: «13mirrors-pro-mak.jpg» (русские буквы — латиницей)
  var TRL = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
    у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  function fileSlug(t) {
    return String(t || '').toLowerCase().split('').map(function (ch) { return TRL[ch] != null ? TRL[ch] : ch; }).join('')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'kartinka';
  }
  function glassTitle(kind, x) { return kind === 'chronicles' ? x.name : kind === 'days' ? [((routeById(x.routeId) || {}).title), x.day ? 'den ' + x.day : ''].filter(Boolean).join(' ') : x.title; }
  function saveCanvas(c, name) {
    var a = el('a', { href: c.toDataURL('image/jpeg', 0.92), download: '13mirrors-' + fileSlug(name) + '.jpg' });
    document.body.appendChild(a); a.click(); a.remove();
  }
  function glassShareShow(kind, x) {
    var f = window.M13.glassFor(kind, x, DATA);
    if (!f.img || !f.g) { toast('Нет картинки или стекло выключено — в Telegram будет просто картинка.', true); return; }
    glassCanvas(kind, x, f.g, DATA).then(function (c) {
      var shown = el('img', { src: c.toDataURL('image/jpeg', 0.9), alt: '', style: 'display:block;width:100%;height:auto;border-radius:8px' });
      dialog({ title: 'Картинка превью для Telegram и VK', body: el('div', {}, [shown,
        el('p', { class: 'a-hint', text: 'Такая картинка появится в превью ссылки после публикации. На сайте надпись остаётся настоящим текстом.' }),
        el('div', { class: 'a-theme' }, [el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Скачать эту (1200 × 630)', onclick: function () { saveCanvas(c, glassTitle(kind, x) + '-telegram'); } })])]),
        buttons: [['ok', 'Понятно', 'dark']] });
    }).catch(function () { toast('Не получилось нарисовать превью — картинка не загрузилась.', true); });
  }
  // «Сохранить картинку с надписью»: картинка целиком, в своих пропорциях, надпись впечатана — как на странице сайта
  function glassSave(kind, x) {
    var f = window.M13.glassFor(kind, x, DATA);
    if (!f.img) { toast('Нет картинки — сохранять нечего.', true); return; }
    if (!f.g) { toast('Стекло с надписью выключено — включите его, чтобы сохранить картинку с надписью.', true); return; }
    glassCanvas(kind, x, f.g, DATA, { native: true }).then(function (c) { saveCanvas(c, glassTitle(kind, x)); toast('Картинка сохранена в «Загрузки».'); })
      .catch(function () { toast('Не получилось нарисовать картинку — она не загрузилась.', true); });
  }

  function viewEvents() {
    var ev = DATA.events = DATA.events || EVENTS_DEFAULT();
    ev.items = ev.items || []; ev.tabs = ev.tabs || {};
    var today = new Date().toISOString().slice(0, 10);
    return [
      el('div', {}, [el('h1', { class: 'a-h1', text: 'События' }),
        el('p', { class: 'a-lead', text: 'Встречи, медитации, фестивали, поездки, практики. Событие заводится здесь один раз — его можно открыть кнопкой с любой плашки или карточки витрины. Прошедшие события сами переходят во вкладку «Как это было»: добавьте туда фото и короткий рассказ.' })]),
      el('div', { class: 'a-tabs' }, [el('button', { type: 'button', text: 'Посмотреть страницу событий', onclick: function () { openPreview('events'); } })]),
      switchIn(DATA.settings, 'eventsLink', 'Кнопка «События и архив» в шапке витрины', { defTrue: true,
        hint: 'Появляется, когда есть хоть одно событие или маршрут в архиве. Надпись меняется в Настройках → «Надписи на витрине».' }),
      el('p', { class: 'a-hint', text: 'Прошедшие маршруты попадают на эту страницу из раздела «Маршруты» — галочкой «Показывать в архиве» у маршрута.' }),
      collection(ev.items, { visible: true,
        title: function (e) { var t = (EV_TYPES.filter(function (x) { return x[0] === e.type; })[0] || [])[1]; return [e.title || 'Без названия', e.date, t, e.date && (e.dateEnd || e.date) < today && e.type !== 'case' ? 'прошло' : ''].filter(Boolean).join(' · '); },
        canDelete: function (e) { var u = evUsage(e.id); return u.length ? 'На это событие ведут кнопки: ' + u.join('; ') + '. Сначала поменяйте их — или просто скройте событие.' : ''; },
        addBox: function (push) {
          var sel = { t: 'meeting' };
          return el('div', { class: 'a-row a-row--end' }, [
            selectIn(sel, 't', 'Новое событие', EV_TYPES),
            el('button', { type: 'button', class: 'a-btn', text: '+ Добавить событие', onclick: function () {
              push({ id: uid('ev'), visible: true, type: sel.t, title: sel.t === 'case' ? 'Пример практики' : 'Новое событие', date: '', dateEnd: '', time: '', duration: 120,
                place: '', price: '', cover: null, summary: '', archive: true,
                blocks: (EV_BLOCKS[sel.t] || EV_BLOCKS.other).map(function (b) { return { id: uid('sb'), kind: 'text', visible: true, title: b[0], text: '', collapse: true }; })
                  .concat([{ id: uid('sb'), kind: 'images', visible: true, images: [] }]),
                actions: sel.t === 'case' ? [] : [{ kind: 'contact', label: 'Записаться' }, { kind: 'calendar', label: 'Добавить в календарь' }, { kind: 'share', label: 'Поделиться' }] });
            } })]);
        },
        body: function (e) {
          e.actions = e.actions || []; e.blocks = e.blocks || [];
          return [
            el('div', { class: 'a-row' }, [textIn(e, 'title', 'Название'), selectIn(e, 'type', 'Тип', EV_TYPES, { def: 'meeting' })]),
            e.type === 'case' ? el('p', { class: 'a-note', text: 'Пример практики — только обезличенно и с разрешения человека: без имён и деталей, по которым его можно узнать.' }) : null,
            e.type === 'case' ? null : el('div', { class: 'a-row3' }, [textIn(e, 'date', 'Дата', { type: 'date' }), textIn(e, 'dateEnd', 'Последний день (если несколько)', { type: 'date' }), textIn(e, 'time', 'Начало', { ph: '19:00' })]),
            e.type === 'case' ? null : el('div', { class: 'a-row3' }, [textIn(e, 'duration', 'Длительность, минут', { type: 'number', ph: '120' }), textIn(e, 'place', 'Где', { ph: 'Онлайн / Москва, …' }), textIn(e, 'price', 'Стоимость', { ph: '1 500 ₽ / свободный вход' })]),
            e.type === 'case' ? null : textIn(e, 'dateText', 'Дата своими словами (необязательно)', { ph: 'Каждый четверг октября', hint: 'Если заполнено — показывается вместо даты.' }),
            imageIn(e, 'cover', 'Главная картинка', { max: 1800, hint: 'Показывается крупно наверху страницы и маленькой — в списке.' }),
            fitIn(e, 'coverFit', 'Главная картинка в списке', 'Наверху страницы события она всегда целиком. В списке окошко 4:3 — для вертикальной картинки выберите «целиком».'),
            textIn(e, 'coverCaption', 'Подпись под главной картинкой', { ph: 'необязательно' }),
            e.type === 'case' ? null : glassEventFields(e),
            textIn(e, 'summary', 'Коротко — одним-двумя предложениями', { multi: true, rows: 2, hint: 'Видно сразу, под картинкой, и в списке событий.' }),
            sbBlocksForm(e, 'event'),
            e.type === 'case' ? null : el('div', { class: 'a-glass' }, [sub('Кнопки (до 4)'),
              el('p', { class: 'a-hint', text: '«Добавить в календарь» сама берёт дату, время и место события. У прошедшего события остаются только «Ссылка» и «Поделиться».' }),
              collection(e.actions, { max: 4, visible: true, title: function (a) { return a.label || defLabel(kindOf(a)); },
                make: function () { return { kind: 'contact', label: 'Записаться' }; }, addLabel: '+ Добавить кнопку',
                body: function (a) { return [actionIn({ a: a }, 'a', '', { kinds: ['contact', 'link', 'calendar', 'share', 'download'], calAuto: true })]; } })]),
            e.type === 'case' ? null : switchIn(e, 'archive', 'Когда пройдёт — показывать в «Как это было»', { defTrue: true }),
            el('div', { class: 'a-theme' }, [el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Посмотреть это событие', onclick: function () { openPreview('events', null, e.id); } })])
          ];
        } }),
      block('Оформление страницы', lookFields(ev, 'events'), { open: !!ST.eventsLookOpen }),
      block('Шапка страницы и надписи', [
        textIn(ev, 'eyebrow', 'Надпись сверху'), textIn(ev, 'title', 'Заголовок'), textIn(ev, 'intro', 'Вступление', { multi: true, rows: 2 }),
        el('div', { class: 'a-row' }, [textIn(ev.tabs, 'soon', 'Вкладка «Скоро»'), textIn(ev.tabs, 'past', 'Вкладка «Как это было»'),
          textIn(ev.tabs, 'routes', 'Вкладка «Прошедшие маршруты»', { ph: 'Прошедшие маршруты' }), textIn(ev.tabs, 'cases', 'Вкладка «Примеры практик»')]),
        switchIn(ev, 'filter', 'Фильтр по типу над обложками', { defTrue: true, hint: '«Все · Встречи · Медитации…» — когда во вкладке события разных типов.' }),
        textIn(ev, 'empty', 'Если событий нет', { ph: 'Скоро здесь появятся новые события.' })
      ], { open: false })
    ];
  }

  /* ================= ПЕСОЧНИЦА ================= */
  // Как показывать картинку в окошке обложки (4:3)
  var FIT_OPTS = [['fill', 'Заполнить окошко (края обрезаются)'], ['whole', 'Показывать целиком']];
  var FIT_HINT = 'Для вертикальной картинки (паспорт архетипа) — «целиком»: она поместится вся, по бокам — она же, размытая.';
  function fitIn(obj, key, label, hint) { return selectIn(obj, key, label, FIT_OPTS, { def: 'fill', hint: hint || FIT_HINT }); }
  function routeOptions() { return [['', '— не указан —']].concat(routes().map(function (r) { return [r.id, r.title]; })); }
  // Оформление отдельной страницы (Песочница, Примеры): фон, шрифт, цвета, стеклянные панели.
  // Кнопка — взять всё у витрины месяца. which — 'sandbox' или 'reflection' (для предпросмотра).
  function lookFields(sb, which) {
    var lk = sb.look = sb.look || {};
    lk.background = lk.background || {};
    function redraw() { ST[which + 'LookOpen'] = true; changed(); renderMain(); }
    function fromMonth() {
      var ids = Object.keys(DATA.showcases).sort();
      var id = DATA.settings.currentShowcase && DATA.showcases[DATA.settings.currentShowcase] ? DATA.settings.currentShowcase : ids[ids.length - 1];
      var sc = id && DATA.showcases[id]; if (!sc) { toast('Нет витрины месяца, у которой можно взять оформление.', true); return; }
      var cs = sc.cardStyle || {}, bg = clone(sc.background || {});
      // Здесь много текста: фон чуть темнее, панели плотнее, чем карточки витрины
      if (bg.image) bg.dim = Math.max(+bg.dim || 0, 50);
      // Панели — цветом оборота карточек, текст в них — цветом текста оборота (пусто — подберётся по панели);
      // заголовок стоит на картинке — цветом надписей над сеткой витрины
      sb.look = { background: bg, font: cs.font || '', textColor: cs.backText || '', headColor: (sc.head || {}).color || cs.textColor || '',
        accent: cs.accent || (sc.head || {}).color || '', panelBg: cs.backBg || cs.bg || '', glass: 25, glassBlur: 8,
        textSize: cs.font === 'Cormorant Garamond' ? 'lg' : 'md' };
      toast('Оформление взято у витрины «' + (sc.title || id) + '». Можно подправить ниже.');
      redraw();
    }
    return [
      el('p', { class: 'a-hint', text: 'Как выглядит эта страница: фон, шрифт, цвета, панели. Тексты не меняются.' }),
      el('div', { class: 'a-theme' }, [
        el('button', { type: 'button', class: 'a-btn a-btn--dark', text: '✨ Как у витрины месяца', onclick: fromMonth }),
        el('button', { type: 'button', class: 'a-btn', text: 'Светлая, как было', onclick: function () { sb.look = {}; redraw(); } }),
        el('button', { type: 'button', class: 'a-btn', text: 'Посмотреть', onclick: function () { openPreview(which); } })]),
      sub('Фон страницы'),
      el('div', { class: 'a-row' }, [
        imageIn(lk.background, 'image', 'Фоновая картинка', { max: 2400, hint: 'Растягивается на весь экран.' }),
        imageIn(lk.background, 'imageTall', 'Картинка для телефона', { max: 2000, hint: 'Необязательно. Пусто — та же, что слева.' })]),
      el('div', { class: 'a-row3' }, [
        colorIn(lk.background, 'color', 'Цвет фона'),
        rangeIn(lk.background, 'dim', 'Затемнение картинки', { max: 90, step: 5, unit: '%', hint: 'Здесь много текста — обычно 45–65%.' }),
        rangeIn(lk.background, 'blur', 'Размытие картинки', { max: 20, unit: ' px' })]),
      selectIn(lk.background, 'fit', 'Как лежит картинка', [['cover', 'На весь экран (края обрезаются)'], ['contain', 'Целиком, по центру'], ['big', 'Крупно, по высоте экрана']], { def: 'cover', hint: 'Для картинки на прозрачном фоне (например, цветок) — «Целиком» или «Крупно», вокруг будет цвет фона.' }),
      bgFxFields(lk.background),
      sub('Текст и панели'),
      el('div', { class: 'a-row' }, [
        fontIn(lk, 'font', 'Шрифт', fontOptions(false), null, 'Примеры практик · День 3 · Мысль дня'),
        selectIn(lk, 'textSize', 'Размер текста', [['md', 'Обычный'], ['lg', 'Крупнее'], ['xl', 'Ещё крупнее']], { def: 'md',
          hint: 'Для шрифта Cormorant Garamond обычно лучше «Крупнее» — он сам по себе мелковат.' })]),
      selectIn(lk, 'lineH', 'Межстрочный интервал', [['', 'Обычный'], ['tight', 'Плотнее'], ['loose', 'Свободнее']], { def: '',
        hint: 'Расстояние между строками в текстах разделов. «Плотнее» — текст компактнее, меньше пустоты.' }),
      el('div', { class: 'a-row' }, [
        colorOptIn(lk, 'textColor', 'Цвет текста в панелях', { none: 'подберётся сам', pick: '#efe4d2' }),
        colorOptIn(lk, 'headColor', 'Цвет заголовка страницы', { none: 'как текст', pick: '#ecd3a3', hint: 'Заголовок и вступление стоят прямо на фоне.' })]),
      el('div', { class: 'a-row' }, [
        colorOptIn(lk, 'accent', 'Акцентный цвет', { none: 'как текст', pick: '#ecd3a3', hint: 'Выбранная вкладка и пример, линия у отзыва, кнопка заказа.' }),
        colorOptIn(lk, 'panelBg', 'Цвет панелей', { none: 'белый', pick: '#17120c' })]),
      switchIn(lk, 'titleLine', 'Тонкая линия под заголовками разделов', { defTrue: true }),
      which === 'reflection' ? null : selectIn(lk, 'perRow', 'Обложек в ряд на компьютере', [['2', '2 — крупно'], ['3', '3'], ['4', '4 — мелко']], { def: '3',
        hint: 'На телефоне всегда 2.' }),
      el('div', { class: 'a-row' }, [
        rangeIn(lk, 'glass', 'Прозрачность панелей', { max: 90, step: 5, unit: '%', hint: '0% — сплошные. 20–40% — сквозь панели чуть видна картинка, текст читается.' }),
        rangeIn(lk, 'glassBlur', 'Размытие за панелями', { max: 20, unit: ' px', def: 8 })]),
      which === 'events' ? sub('Стекло на картинке') : which === 'sandbox' ? sub('Стекло на картинках маршрутов') : sub('Стекло на картинке'),
      glassPatternFields(which === 'events' ? 'event' : which === 'sandbox' ? 'route' : 'kin'),
      which === 'reflection' ? null : sub('Вкладки'),
      which === 'reflection' ? null : tabsFields(lk, which),
      sub('Окна и сообщения'),
      winFields(lk, true, function () { openPreview(which, null, null, true); })
    ];
  }
  // Вкладки страницы и плашки фильтра по маршрутам: look.tabs = {active: '' | glass | line, glass, rim: '' | none | line | glow, rimColor, text} (tabsLook в vitrina.js)
  function tabsFields(lk, which) {
    var t = lk.tabs = lk.tabs || {}, box = el('div', { class: 'a-glass' });
    function tx() { return lk.textColor || (hexLum(lk.panelBg || '#ffffff') < 128 ? '#efe4d2' : '#232323'); }
    function ac() { return lk.accent || tx(); }
    function draw() {
      box.replaceChildren();
      add(box, [
        el('p', { class: 'a-hint', text: 'Вкладки вверху страницы и плашки фильтра над обложками (' + (which === 'events' ? 'по типу' : 'по маршрутам') + ') — выглядят одинаково.' }),
        el('div', { class: 'a-theme' }, [el('button', { type: 'button', class: 'a-btn a-btn--small', text: '✨ Рекомендуемый вид', onclick: function () {
          lk.tabs = { active: 'glass', glass: 70, rim: 'glow' }; t = lk.tabs; changed(); draw();
          toast('Выбранная вкладка — стекло акцентного цвета со светящимся контуром, остальные — с тихим контуром.'); } }),
          el('button', { type: 'button', class: 'a-btn a-btn--small', text: 'Как было', onclick: function () { lk.tabs = {}; t = lk.tabs; changed(); draw(); } })]),
        el('div', { class: 'a-row' }, [
          selectIn(t, 'active', 'Выбранная вкладка', [['', 'Сплошная, акцентным цветом'], ['glass', 'Стекло — акцентный цвет с прозрачностью'], ['line', 'Только контур']],
            { def: '', onChange: function () { changed(); draw(); } }),
          t.active === 'glass' ? rangeIn(t, 'glass', 'Прозрачность стекла', { max: 90, step: 5, unit: '%', def: 70, hint: 'Больше — прозрачнее, сквозь вкладку виден фон.' }) : el('span')]),
        el('div', { class: 'a-row' }, [
          selectIn(t, 'rim', 'Контур у вкладок', [['', 'Как было'], ['none', 'Без контура'], ['line', 'Тонкая линия'], ['glow', 'Светящийся — выбранная ярче, остальные тише']],
            { def: '', onChange: function () { changed(); draw(); } }),
          t.rim === 'line' || t.rim === 'glow' ? colorOptIn(t, 'rimColor', 'Цвет контура', { none: 'акцентный', inh: ac, inhLabel: 'акцентный' }) : el('span')]),
        colorOptIn(t, 'text', 'Цвет текста выбранной вкладки', { none: 'подберётся сам', pick: '#efe4d2',
          base: function () { return t.active === 'glass' || t.active === 'line' ? tx() : (hexLum(ac()) > 160 ? '#1f1f1f' : '#ffffff'); },
          hint: 'Если на выбранной вкладке текст плохо виден — задайте здесь.' }),
        el('p', { class: 'a-hint', text: 'Бегущего блика на вкладках нет — чтобы страница не перегружалась.' })
      ]);
    }
    draw();
    return box;
  }

  // Гибкие разделы примера (день, Летопись): текстовые блоки с заголовком и блоки-картинки. Старые поля → блоки при первом открытии.
  var SB_PRESETS = [
    ['meaning', 'Контур дня', { collapse: true }], ['thought', 'Мысль дня', { look: 'thought' }], ['mantra', 'Мантра дня', { look: 'mantra' }],
    ['question', 'Главный вопрос', {}], ['practice', 'Практика', { collapse: true }], ['trace', 'След дня', {}],
    ['fragment', 'Фрагмент Летописи', { collapse: true }], ['text', 'Свой блок', {}], ['images', 'Картинки (до 10)', {}]
  ];
  function sbPreset(k) {
    var p = SB_PRESETS.filter(function (x) { return x[0] === k; })[0] || SB_PRESETS[7];
    if (k === 'images') return { id: uid('sb'), kind: 'images', visible: true, images: [] };
    return Object.assign({ id: uid('sb'), kind: 'text', visible: true, title: k === 'text' ? '' : String(sbLabel(k) || p[1]).replace(/\s*\{n\}/, ''), text: '' }, p[2]);
  }
  var SB_LOOKS = [['normal', 'Обычный'], ['thought', 'Мысль — курсивом, крупнее'], ['mantra', 'Мантра — по центру, курсивом']];
  function galleryForm(list) {
    return collection(list, { visible: true, max: 10, title: function (m, k) { return (m.caption ? m.caption : 'Картинка ' + (k + 1)); },
      body: function (m) { return [imageIn(m, 'src', '', { max: 1800 }), textIn(m, 'caption', 'Подпись под картинкой', { ph: 'Работа участницы маршрута «Белый Волшебник»', hint: 'Мелко и бледнее основного текста, как подпись к фото. Можно пусто.' })]; },
      make: function () { return { id: uid('img'), src: null, caption: '', visible: true }; }, addLabel: '+ Добавить картинку', empty: 'Пока без картинок.' });
  }
  function sbBlocksForm(x, tab) {
    if (!x.blocks) {
      x.blocks = clone(window.M13.sbBlocks(tab, x, DATA.sandbox.labels) || []).map(function (b) { b.id = uid('sb'); return b; });
      ['meaning', 'thought', 'question', 'practices', 'trace', 'image', 'note', 'fragment', 'lens'].forEach(function (k) { delete x[k]; });
    }
    var sel = { k: 'text' };
    return el('div', { class: 'a-glass' }, [
      sub('Разделы'),
      el('p', { class: 'a-hint', text: 'Добавляйте, переименовывайте, переставляйте и скрывайте разделы. В текстах: пустая строка — новый абзац, **жирный**, *курсив*, __подчёркнутый__, строка с «- » — пункт списка.' }),
      collection(x.blocks, { visible: true,
        title: function (b) { return b.kind === 'images' ? 'Картинки · ' + (b.images || []).length + ' шт.' : (b.title || 'Без заголовка') + (b.text ? ' — ' + String(b.text).replace(/\s+/g, ' ').slice(0, 40) + '…' : ''); },
        body: function (b) {
          if (b.kind === 'images') return [galleryForm(b.images = b.images || [])];
          return [
            textIn(b, 'title', 'Заголовок раздела', { ph: 'Контур дня, Мантра дня, Вкус дня…' }),
            textIn(b, 'text', 'Текст', { multi: true, rows: 6 }),
            el('div', { class: 'a-row' }, [
              selectIn(b, 'look', 'Как показывать', SB_LOOKS, { def: 'normal' }),
              switchIn(b, 'collapse', 'Длинный текст — под «Подробнее»', { hint: 'Виден первый абзац, остальное раскрывается.' })])
          ];
        },
        addBox: function (push) {
          return el('div', { class: 'a-row a-row--end' }, [
            selectIn(sel, 'k', 'Добавить раздел', SB_PRESETS.map(function (p) { return [p[0], p[1]]; })),
            el('button', { type: 'button', class: 'a-btn', text: '+ Добавить', onclick: function () { push(sbPreset(sel.k)); } })]);
        } })
    ]);
  }
  var SB_LABELS = { meaning: 'Контур дня', thought: 'Мысль дня', mantra: 'Мантра дня', question: 'Главный вопрос', practice: 'Практика', trace: 'След дня', fragment: 'Фрагмент Летописи' };
  function sbLabel(k) { var l = ((DATA.sandbox || {}).labels || {})[k]; return (l && String(l).trim()) || SB_LABELS[k]; }
  function viewSandbox() {
    var sb = DATA.sandbox;
    sb.intros = sb.intros || {};
    sb.tabs = sb.tabs || { days: 'Примеры дней', chronicles: 'Что остаётся', reviews: 'Отзывы' };
    sb.labels = sb.labels || {};
    var t = ST.sbTab;
    var body;
    if (t === 'days') body = collection(sb.days = sb.days || [], { visible: true,
      title: function (x) { var r = routeById(x.routeId); return [r && r.title, x.day ? 'День ' + x.day : '', x.title].filter(Boolean).join(' · '); },
      make: function () { return { id: uid('d'), visible: true, routeId: '', day: null, kin: { value: '', show: false }, tone: { value: '', show: false }, seal: { value: '', show: false },
        title: 'Новый пример дня', blocks: [sbPreset('meaning'), sbPreset('thought'), sbPreset('question'), sbPreset('practice'), sbPreset('trace')] }; },
      addLabel: '+ Добавить пример дня',
      body: function (x) {
        return [
          el('div', { class: 'a-row' }, [selectIn(x, 'routeId', 'Маршрут', routeOptions()), textIn(x, 'day', 'Номер дня', { type: 'number' })]),
          el('div', { class: 'a-row3' }, [optIn(x, 'kin', 'Кин'), optIn(x, 'tone', 'Тон'), optIn(x, 'seal', 'Печать')]),
          textIn(x, 'title', 'Название дня', { hint: 'Например, «Красный Магнитный Дракон» или «День вне времени».' }),
          el('div', { class: 'a-row' }, [imageIn(x, 'cover', 'Своя обложка', { max: 1400, hint: 'Пусто — картинка маршрута. Например, паспорт архетипа.' }),
            colorOptIn(x, 'color', 'Свой цвет', { none: 'как у маршрута', pick: '#c9a14a', inh: routeColorOf(x), inhLabel: 'как у маршрута', hint: 'Если соседние обложки плохо смотрятся рядом.' })]),
          fitIn(x, 'coverFit', 'Своя обложка в окошке', 'Для вертикальной картинки (паспорт архетипа) — «целиком». Если своей обложки нет — как настроено у картинки маршрута в «Маршрутах».'),
          glassItemShare('days', x),
          sbBlocksForm(x, 'days')
        ];
      } });
    else if (t === 'chronicles') body = collection(sb.chronicles = sb.chronicles || [], { visible: true,
      title: function (x) { var r = routeById(x.routeId); return [x.name, r && r.title].filter(Boolean).join(' · '); },
      make: function () { return { id: uid('c'), visible: true, routeId: '', name: 'Новая Летопись', blocks: [sbPreset('fragment')] }; },
      addLabel: '+ Добавить Летопись',
      body: function (x) { return [
        el('div', { class: 'a-row' }, [textIn(x, 'name', 'Название или номер'), selectIn(x, 'routeId', 'Маршрут', routeOptions())]),
        el('div', { class: 'a-row' }, [imageIn(x, 'cover', 'Своя обложка', { max: 1400, hint: 'Пусто — картинка маршрута. Например, паспорт архетипа.' }),
            colorOptIn(x, 'color', 'Свой цвет', { none: 'как у маршрута', pick: '#c9a14a', inh: routeColorOf(x), inhLabel: 'как у маршрута', hint: 'Если соседние обложки плохо смотрятся рядом.' })]),
          fitIn(x, 'coverFit', 'Своя обложка в окошке', 'Для вертикальной картинки (паспорт архетипа) — «целиком». Если своей обложки нет — как настроено у картинки маршрута в «Маршрутах».'),
          glassItemShare('chronicles', x),
        sbBlocksForm(x, 'chronicles')]; } });
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
          switchIn(x.signature, 'show', 'Подпись «Опубликовано с разрешения…»'),
          colorOptIn(x, 'color', 'Свой цвет карточки', { none: 'как у маршрута', pick: '#c9a14a', inh: routeColorOf(x), inhLabel: 'как у маршрута' })
        ];
      } });

    return [
      el('div', {}, [el('h1', { class: 'a-h1', text: 'Песочница' }),
        el('p', { class: 'a-lead', text: 'Одна общая страница «Как устроены маршруты 13 MIRRORS». В неё ведут кнопки со всех маршрутных карточек.' })]),
      el('div', { class: 'a-tabs' }, [['days', sb.tabs.days], ['chronicles', sb.tabs.chronicles], ['reviews', sb.tabs.reviews]].map(function (x) {
        return el('button', { type: 'button', class: t === x[0] ? 'is-active' : '', text: x[1], onclick: function () { ST.sbTab = x[0]; renderMain(); } });
      }).concat([el('button', { type: 'button', text: 'Посмотреть', onclick: function () { openPreview('sandbox'); } })])),
      body,
      block('Оформление страницы', lookFields(sb, 'sandbox'), { open: !!ST.sandboxLookOpen }),
      block('Шапка страницы и надписи', [
        textIn(sb, 'eyebrow', 'Надпись сверху'), textIn(sb, 'title', 'Заголовок'), textIn(sb, 'intro', 'Вступление', { multi: true, rows: 2 }),
        optIn(sb, 'notice', 'Плашка-пометка', { hint: 'Например, «Тестовые примеры». Выключите, когда появятся настоящие.' }),
        sub('Названия вкладок'),
        el('div', { class: 'a-row3' }, [textIn(sb.tabs, 'days', 'Дни'), textIn(sb.tabs, 'chronicles', 'Летописи'), textIn(sb.tabs, 'reviews', 'Отзывы')]),
        switchIn(sb, 'filter', 'Фильтр по маршрутам над обложками', { defTrue: true, hint: '«Все · Красный Дракон · …» — появляется сам, когда в разделе примеры двух и больше маршрутов.' }),
        selectIn(sb, 'headMain', 'Что главное в примере дня', [['route', 'Маршрут крупно, ниже «День 1 · название дня»'], ['day', 'Название дня крупно, маршрут мелко сверху']], { def: 'route' }),
        el('div', { class: 'a-row' }, [textIn(sb, 'moreLabel', 'Кнопка «Подробнее»', { ph: 'Подробнее' }), textIn(sb, 'lessLabel', 'Кнопка «Свернуть»', { ph: 'Свернуть' })]),
        sub('Вводный текст вкладки (над списком; пусто — без него)'),
        el('div', { class: 'a-row3' }, [textIn(sb.intros, 'days', 'Дни', { multi: true, rows: 3 }), textIn(sb.intros, 'chronicles', 'Летописи', { multi: true, rows: 3 }), textIn(sb.intros, 'reviews', 'Отзывы', { multi: true, rows: 3 })]),
        el('p', { class: 'a-hint', text: 'Вкладка пропадает со страницы сама, если в ней нет ни одного видимого примера.' }),
        sub('Подписи разделов внутри примеров'),
        el('div', { class: 'a-row' }, [
          textIn(sb.labels, 'day', 'День', { ph: 'День {n}', hint: '{n} заменится на номер дня' }), textIn(sb.labels, 'meaning', 'Смысл дня'),
          textIn(sb.labels, 'thought', 'Мысль дня'),
          textIn(sb.labels, 'question', 'Вопрос дня'), textIn(sb.labels, 'practice', 'Практика', { ph: 'Практика {n}' }),
          textIn(sb.labels, 'practiceOne', 'Практика (если одна)', { ph: 'Практика' }),
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
        body: function (x) { return [imageIn(x, 'image', 'Изображение', { max: 1400 }), textIn(x, 'meta', 'Kin и название карты', { ph: 'Kin 68 · Жёлтая Электрическая Звезда', hint: 'Мелко над названием. Можно оставить пустым. Если у карты есть стекло — строка Kin на нём по умолчанию выключена.' }), textIn(x, 'title', 'Название или архетип'), textIn(x, 'text', 'Короткий текст', { multi: true, rows: 2 }),
          glassOwnFields(x, 'kin', { img: function () { return !!x.image; } })]; } }),
      block('Оформление страницы', lookFields(rf, 'reflection'), { open: !!ST.reflectionLookOpen }),
      block('Шапка страницы и кнопка', [
        textIn(rf, 'eyebrow', 'Надпись сверху'), textIn(rf, 'title', 'Заголовок'), textIn(rf, 'intro', 'Вступление', { multi: true, rows: 2 }),
        textIn(rf, 'placeholder', 'Надпись на примере без картинки'),
        switchIn(rf, 'textOpen', 'Показывать описание сразу (без кнопки «Подробнее»)', { hint: 'Выключено — описание раскрывается кнопкой, и картинки в ряду стоят ровно при любой длине текста.' }),
        el('div', { class: 'a-row' }, [textIn(rf, 'moreLabel', 'Кнопка «Подробнее»', { ph: 'Подробнее' }), textIn(rf, 'lessLabel', 'Кнопка «Свернуть»', { ph: 'Свернуть' })]),
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
    ['shareCopied', 'Сообщение «ссылка скопирована»'], ['eventsLink', 'Кнопка «События и архив» в шапке витрины'],
    ['backToCard', 'Кнопка «Назад к карте»'], ['backToShowcase', 'Кнопка «К витрине»'], ['backToList', 'Кнопка «К списку»'], ['loadError', 'Сообщение об ошибке загрузки'],
    ['backToAll', 'Песочница: «← Все примеры»'], ['backToEvents', 'События: «← Все события»'], ['backToRoutes', 'Архив: «← Все маршруты»'],
    ['prevItem', '«← Предыдущий»'], ['nextItem', '«Следующий →»'], ['showMore', '«Показать ещё»'], ['filterAll', 'Фильтр: «Все»'],
    ['shareButton', 'Кнопка «Поделиться» у примера'], ['routePage', 'Архив: кнопка «Страница маршрута»'], ['archiveRoute', 'Архив: подпись «Маршрут»']
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
              LOCAL.del();
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
      block('Логотип', [
        logoIn(st, 'logo', 'logoRatio', 'Логотип витрины', { hint: 'Показывается над сеткой и под ней (если так выбрано в «Странице месяца»). PNG с прозрачным фоном; если фон белый — уберём его сами. Цвет логотипа задаётся в каждом месяце: «Цвет надписей и логотипа». У месяца может быть свой логотип.' })
      ], { open: false, note: 'общий для всех месяцев' }),
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
    return { settings: DATA.settings, routes: DATA.routes, formats: DATA.formats, sandbox: DATA.sandbox, reflection: DATA.reflection, events: DATA.events,
      index: DATA.index, showcase: DATA.showcases[showcaseId] };
  }
  // Окно-«телефон»: пишем в пустой iframe страницу с тем же рендерером и ждём, пока он загрузится.
  // Вызывать, когда iframe уже вставлен в страницу.
  function fillPhone(fr, onReady) {
    var d = fr.contentDocument, base = location.href.replace(/[#?].*$/, '');
    d.open();
    d.write('<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><base href="' + base + '">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="stylesheet" href="../assets/vitrina.css?v=' + ASSET_V + '"></head>' +
      '<body class="m13-body"><div id="m13"></div><script src="../assets/vitrina.js?v=' + ASSET_V + '"><\/script></body></html>');
    d.close();
    var w = fr.contentWindow, tries = 0;
    (function wait() {
      if (w.M13 && w.M13.mount) onReady(w, w.document.getElementById('m13'));
      else if (++tries < 300) setTimeout(wait, 30);
      else toast('Не получилось показать витрину в режиме телефона. Обновите страницу.', true);
    })();
  }
  function openPreview(view, showcaseId, cardId, demo) {
    if (!view) view = ST.section === 'sandbox' ? 'sandbox' : ST.section === 'reflection' ? 'reflection' : ST.section === 'events' ? 'events' : 'showcase';
    showcaseId = showcaseId || ST.showcase || DATA.settings.currentShowcase;
    var pv = document.getElementById('a-preview');
    var cur = view, M = null, mount = null;
    function go(v) {
      cur = v;
      bar.querySelectorAll('[data-v]').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-v') === v); });
      if (v === 'events' && M.setStartEvent) M.setStartEvent(cardId || null);
      M.mount(mount, { base: '../', view: v, noHistory: true, onBack: function () { go('showcase'); }, data: previewData(showcaseId) })
        .then(function () {
          if (cardId && v === 'showcase') { M.openCard(cardId, true); cardId = null; }
          // «Посмотреть окно»: сразу открыть «Куда написать?» и сообщение «Ссылка скопирована»
          if (demo) { demo = false; setTimeout(function () { if (M.demoWin) M.demoWin(); }, 450); }
        });
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
      el('button', { type: 'button', 'data-v': 'events', text: 'События', onclick: function () { go('events'); } }),
      el('button', { type: 'button', class: 'a-preplay', text: '↻ Ещё раз', title: 'Открыть заново: блики и обложки', onclick: function () { go(cur); } }),
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

  /* ---------- Кнопка ✦ у текстовых полей: проверенные значки одним нажатием ----------
     Появляется у поля, в котором сейчас пишут. Эти значки ведут себя как буквы (берут цвет и шрифт надписи)
     и не превращаются на телефоне в цветные смайлы. */
  var GLYPHS = ['✦', '✧', '⋆', '✶', '✷', '✺', '❋', '✢', '✣', '❖', '☆', '★', '✿', '❀', '☾', '☽', '·', '◦', '•', '—', '«»'];
  var glyphBtn = null, glyphPop = null, glyphFor = null;
  function glyphOk(n) {
    if (!n || !n.matches || !n.matches('input.a-input, textarea.a-input')) return false;
    if (n.tagName === 'INPUT' && (n.type || 'text') !== 'text') return false;
    if (/https?:|@|t\.me|vk\.com|\d{2}:\d{2}/i.test(n.placeholder || '')) return false;
    return !n.closest('.a-preview');
  }
  function glyphPlace() {
    if (!glyphFor || !glyphFor.isConnected) { glyphHide(); return; }
    var r = glyphFor.getBoundingClientRect();
    // Поле ушло под верхнюю полосу или за экран — прячем кнопку и набор, пока оно не вернётся
    var off = r.top < 64 || r.top > window.innerHeight - 30;
    glyphBtn.style.visibility = glyphPop.style.visibility = off ? 'hidden' : '';
    glyphBtn.style.top = (r.top + 4) + 'px'; glyphBtn.style.left = (r.right - 30) + 'px';
    if (!glyphPop.hidden) { glyphPop.style.top = (r.bottom + 4) + 'px'; glyphPop.style.left = Math.max(8, Math.min(r.right - 262, window.innerWidth - 270)) + 'px'; }
  }
  function glyphHide() { if (glyphBtn) glyphBtn.hidden = true; if (glyphPop) glyphPop.hidden = true; glyphFor = null; }
  function glyphInsert(g) {
    var n = glyphFor; if (!n) return;
    var a = n.selectionStart == null ? n.value.length : n.selectionStart, b = n.selectionEnd == null ? a : n.selectionEnd;
    var ins = g === '«»' ? '«' + n.value.slice(a, b) + '»' : g, caret = g === '«»' ? a + ins.length - (b > a ? 0 : 1) : a + ins.length;
    n.value = n.value.slice(0, a) + ins + n.value.slice(b);
    n.setSelectionRange(caret, caret);
    n.dispatchEvent(new Event('input', { bubbles: true }));
    n.focus();
  }
  function glyphInit() {
    glyphBtn = el('button', { type: 'button', class: 'a-glyph-btn', title: 'Вставить значок', text: '✦', hidden: true });
    glyphPop = el('div', { class: 'a-glyph-pop', hidden: true }, [
      el('div', { class: 'a-glyph-grid' }, GLYPHS.map(function (g) {
        return el('button', { type: 'button', text: g, title: g === '«»' ? 'Кавычки «ёлочки»' : 'Вставить ' + g });
      })),
      el('p', { text: 'Значки ведут себя как буквы: берут цвет и шрифт надписи, блик проходит и по ним.' })]);
    // mousedown без фокуса: поле не теряет курсор
    [glyphBtn, glyphPop].forEach(function (n) { n.addEventListener('mousedown', function (e) { e.preventDefault(); }); });
    glyphBtn.addEventListener('click', function () { glyphPop.hidden = !glyphPop.hidden; glyphPlace(); });
    glyphPop.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { glyphInsert(b.textContent); } });
    document.body.appendChild(glyphBtn); document.body.appendChild(glyphPop);
    document.addEventListener('focusin', function (e) {
      if (glyphOk(e.target)) { glyphFor = e.target; glyphBtn.hidden = false; glyphPop.hidden = true; glyphPlace(); }
      else if (!glyphBtn.contains(e.target) && !glyphPop.contains(e.target)) glyphHide();
    });
    document.addEventListener('focusout', function () {
      setTimeout(function () { var a = document.activeElement; if (!glyphOk(a) && !glyphPop.contains(a) && !glyphBtn.contains(a)) glyphHide(); }, 0);
    });
    window.addEventListener('scroll', function () { if (glyphFor) glyphPlace(); }, true);
    window.addEventListener('resize', function () { if (glyphFor) glyphPlace(); });
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
    D.events = D.events || EVENTS_DEFAULT(); D.events.items = D.events.items || [];
    Object.keys(D.showcases).forEach(function (k) {
      (D.showcases[k].cards || []).forEach(function (c) {
        if (c.back && c.back.type !== 'static') c.back = window.M13.toBlocks(c.back);
        if (c._backs) delete c._backs;
      });
    });
    // Образец стекла на картинке мог оказаться в look.glass (там «Прозрачность панелей») — переносим в look.imgGlass
    [D.events, D.sandbox, D.reflection].forEach(function (x) {
      var lk = x && x.look;
      if (lk && lk.glass && typeof lk.glass === 'object') { if (!lk.imgGlass) lk.imgGlass = lk.glass; delete lk.glass; }
    });
    // Старый текст «Ссылка на карточку скопирована…» — кнопка есть и у примеров, событий, архива
    var tx = D.settings && D.settings.texts;
    if (tx && tx.shareCopied === 'Ссылка на карточку скопирована — её можно отправить в чат.') tx.shareCopied = 'Ссылка скопирована — её можно отправить в чат.';
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
  var DATA_FILES = ['settings', 'routes', 'formats', 'sandbox', 'reflection', 'events'];
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
        DATA_FILES.forEach(function (n) { if (!D[n]) D[n] = clone(ORIGINAL[n] || (n === 'events' ? EVENTS_DEFAULT() : {})); });
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
      hasLocal = savedAt != null;
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
    keepLocal();
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
      if ((k === 'phase' || k === 'calendar' || k === 'monthCal') && v && typeof v === 'object' && !v.on) return;
      out[k] = cleanDeep(v);
    });
    return out;
  }
  function cleanShowcase(sc) {
    var cards = (sc.cards || []).map(function (c) {
      if (c && c.visible === false) return { id: c.id, visible: false };
      var st = c && c.back && c.back.stub;
      if (!st) return c;
      // Заглушка включена — недописанные блоки оборота на сайт не уходят вовсе; выключена — убираем её из данных
      var back = Object.assign({}, c.back);
      if (st.on) { back.blocks = []; back.type = 'blocks'; } else delete back.stub;
      return Object.assign({}, c, { back: back });
    });
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
  // SHA-1 без crypto.subtle: на странице без https (http://…) браузер его не даёт
  function sha1(bytes) {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) return crypto.subtle.digest('SHA-1', bytes);
    var n = bytes.length, words = ((n + 8) >> 6) + 1, w = new Array(words * 16), i, j;
    for (i = 0; i < w.length; i++) w[i] = 0;
    for (i = 0; i < n; i++) w[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
    w[n >> 2] |= 0x80 << (24 - (n % 4) * 8);
    w[words * 16 - 2] = Math.floor(n / 0x20000000);
    w[words * 16 - 1] = (n * 8) >>> 0;
    var h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0, x = new Array(80);
    function rol(v, s) { return (v << s) | (v >>> (32 - s)); }
    for (i = 0; i < w.length; i += 16) {
      var a = h0, b = h1, c = h2, d = h3, e = h4, f, k, t;
      for (j = 0; j < 80; j++) {
        x[j] = j < 16 ? w[i + j] : rol(x[j - 3] ^ x[j - 8] ^ x[j - 14] ^ x[j - 16], 1);
        if (j < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
        else if (j < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
        else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
        else { f = b ^ c ^ d; k = 0xca62c1d6; }
        t = (rol(a, 5) + f + e + k + x[j]) | 0;
        e = d; d = c; c = rol(b, 30); b = a; a = t;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
    }
    var out = new Uint8Array(20);
    [h0, h1, h2, h3, h4].forEach(function (h, q) { for (var r = 0; r < 4; r++) out[q * 4 + r] = (h >>> (24 - r * 8)) & 255; });
    return Promise.resolve(out.buffer);
  }
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
      return sha1(bytes).then(function (h) {
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
    files['events/index.html'] = { text: pageHTML('events', null, P) };
    ((P.events || {}).items || []).forEach(function (e) {
      if (e && e.visible !== false && /^[\w-]+$/.test(e.id)) files['events/' + e.id + '/index.html'] = { text: pageHTML('event', null, P, e.id) };
    });
    // Маршруты с галочкой «в архиве» и примеры Песочницы — свои страницы-превью (ссылка «Поделиться»)
    ((P.routes || {}).routes || []).forEach(function (r) {
      if (r && r.archive && /^[\w-]+$/.test(r.id) && !files['events/' + r.id + '/index.html']) files['events/' + r.id + '/index.html'] = { text: pageHTML('archroute', null, P, r.id) };
    });
    ['days', 'chronicles'].forEach(function (t) {
      ((P.sandbox || {})[t] || []).forEach(function (it) {
        if (it && it.visible !== false && /^[\w-]+$/.test(it.id)) files['sandbox/' + it.id + '/index.html'] = { text: pageHTML('sbitem', null, P, it.id) };
      });
    });
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
      if (/^(events|sandbox)\/[\w-]+\/index\.html$/.test(p) && !files[p]) files[p] = null;   // страницы удалённых или скрытых событий и примеров
    });
    return { files: files, removed: removed };
  }
  // Для проверки страниц-превью из консоли браузера
  window.M13_ADMIN = { pageHTML: pageHTML, bakeGlass: bakeGlass, glassCanvas: glassCanvas };
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
      if (dirty) { keepLocal(); dirty = false; updateState(); }
      saveToGitHub(true).then(function (ok) {
        if (!ok) return;
        var P = buildSite(DATA), media, removed = [];
        busy('Готовим картинки…');
        return bakeGlass(P).then(function () { return extractImages(P); }).then(function (m) {
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
    if (dirty) { keepLocal(); dirty = false; updateState(); }
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
    glyphInit();
    APP.innerHTML = '<p style="padding:40px;color:#6b6b68">Загружаем данные…</p>';
    loadSource().then(function (src) {
      ORIGINAL = src;
      return LOCAL.get().then(function (saved) {
        if (saved && saved.data) { DATA = saved.data; savedAt = saved.savedAt; } else DATA = clone(src);
        migrate(DATA);
        // Копия из старого хранилища — переносим в новое (и освобождаем старое)
        if (saved && saved.data) LOCAL.set({ savedAt: savedAt, data: DATA }).catch(function () {});
        renderShell();
        if (GHS.token) connect(false);
      });
    }).catch(function (e) {
      console.error(e);
      APP.innerHTML = '<p style="padding:40px">Не получилось загрузить данные витрины. Обновите страницу; если не поможет — напишите, что видите.</p>';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
