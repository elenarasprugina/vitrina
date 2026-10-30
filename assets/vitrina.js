/* 13 MIRRORS · Витрина — общий рендерер.
   Используется публичными страницами и (позже) предпросмотром в панели управления.
   Всё содержимое берётся из JSON в папке data/. Никаких форм, никакого сбора данных. */
(function () {
  'use strict';

  var M13 = window.M13 = {};

  /* ---------- Мелкие помощники ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function txt(s) { return esc(s).replace(/\n/g, '<br>'); }
  // Необязательное поле {value, show}: возвращает текст, только если он включён и не пустой.
  // «Надпись сверху» карточки: выключатель «показывать на сайте» (19.10) — выключена, остаётся только пометкой в панели
  function eyeOf(f) { return f.eyebrowShow === false ? '' : String(f.eyebrow || '').trim(); }
  function opt(f) {
    if (f == null) return '';
    if (typeof f === 'object') return f.show === false ? '' : String(f.value == null ? '' : f.value).trim();
    return String(f).trim();
  }
  function shown(f) { return !!f && f.show !== false; }
  function visibleSorted(list, max) {
    var out = (list || []).filter(function (x) { return x && x.visible !== false; });
    out.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    return max ? out.slice(0, max) : out;
  }
  function fill(tpl, vars) {
    var s = String(tpl || '').replace(/\{(\w+)\}/g, function (_, k) { return vars[k] == null ? '' : vars[k]; });
    return s.replace(/«\s*»/g, '').replace(/\(\s*\)/g, '').replace(/,\s*([.!?])/g, '$1')
      .replace(/\s+([.,!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  }
  function media(src) {
    if (!src) return '';
    if (/^(https?:|data:|blob:)/.test(src)) return src;
    // Полный адрес: относительный url() в CSS-переменной браузер отсчитывает от vitrina.css, а не от страницы
    var a = document.createElement('a');
    a.href = /^\//.test(src) ? src : S.base + src;
    return a.href;
  }
  function parseDate(iso) {
    if (!iso) return null;
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function today() {
    if (window.M13_TODAY) return parseDate(window.M13_TODAY);
    var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  /* ---------- Состояние ---------- */
  var S = { base: './', view: 'showcase', D: null, root: null, acts: [], layers: [], useHistory: true, card: null, lb: [], tiles: [] };

  function T(key) { return (S.D.settings.texts || {})[key] || ''; }
  function routeById(id) { return (S.D.routes.routes || []).filter(function (r) { return r.id === id; })[0] || null; }
  function formatById(id) { return (S.D.formats.formats || []).filter(function (f) { return f.id === id; })[0] || null; }

  /* ---------- Загрузка данных ---------- */
  // Файл пустой или обрезан (сайт как раз обновлялся, или браузер запомнил такую копию) — сразу ещё раз мимо памяти браузера
  // (cache: 'reload' заодно заменяет испорченную копию), потом через 1,5 и 4 с. Нет файла (404) — без повторов.
  function getJSON(url, n) {
    n = n || 0;
    return fetch(url, { cache: n ? 'reload' : 'no-cache' }).then(function (r) {
      if (r.status === 404) { var e = new Error('Не найден файл ' + url); e.final = true; throw e; }
      if (!r.ok) throw new Error('Не загрузился файл ' + url);
      return r.json();
    }).catch(function (e) {
      if (e.final || n >= 3) throw e;
      return new Promise(function (ok) { setTimeout(ok, [0, 1500, 4000][n]); }).then(function () { return getJSON(url, n + 1); });
    });
  }
  M13.load = function (base, showcaseId) {
    if (window.M13_DATA) {
      var P = window.M13_DATA;
      var id = showcaseId || P.settings.currentShowcase;
      return Promise.resolve({
        settings: P.settings, routes: P.routes, formats: P.formats, index: P.index,
        sandbox: P.sandbox, reflection: P.reflection, events: P.events || null, journeys: P.journeys || null, showcase: (P.showcases || {})[id] || null,
        kinCards: P.kinCards || null, kinMonth: P.kinMonth || null
      });
    }
    var d = base + 'data/';
    return Promise.all([
      getJSON(d + 'settings.json'), getJSON(d + 'routes.json'), getJSON(d + 'formats.json'),
      getJSON(d + 'sandbox.json'), getJSON(d + 'reflection.json'),
      getJSON(d + 'events.json').catch(function () { return null; }),   // событий может ещё не быть
      S.view === 'showcase' ? getJSON(d + 'journeys.json').catch(function () { return null; }) : null   // дни маршрутов — для карты дня на карточке
    ]).then(function (r) {
      var out = { settings: r[0], routes: r[1], formats: r[2], sandbox: r[3], reflection: r[4], events: r[5], journeys: r[6], index: null, showcase: null };
      var id = showcaseId || out.settings.currentShowcase;
      if (S.view !== 'showcase' && S.view !== 'soon' && S.view !== 'oferta') return out;
      return getJSON(d + 'showcases/' + id + '.json').then(function (sc) { out.showcase = sc; return out; });
    });
  };

  /* ---------- Запуск ---------- */
  M13.setStartEvent = function (id) { S.startEvent = id || null; };
  M13.boot = function () {
    var el = document.getElementById('m13'), base = el.getAttribute('data-base') || './', view = el.getAttribute('data-view') || 'showcase';
    // Основной адрес — месяц по календарю: наступил новый и он опубликован — сразу на его страницу (#карточка не теряется)
    var P = window.M13_DATA;
    if (view === 'showcase' && !el.getAttribute('data-showcase') && P && P.settings) {
      var id = M13.monthPick(P.settings, ((P.index || {}).showcases || []).map(function (x) { return x.id; }));
      if (id && id !== P.settings.currentShowcase) { location.replace(base + id + '/' + location.search + location.hash); return; }
    }
    M13.mount(el, { base: base, view: view, showcase: el.getAttribute('data-showcase') || null, soon: el.getAttribute('data-soon') || null, route: el.getAttribute('data-route') || null });
  };

  /* ---------- Месяцы как календарь (её «делаем» 20.10) ----------
     settings.months = {auto, startDay, arrows, soon: {word, font, color, note}}.
     auto (по умолчанию — да): основной адрес сам ведёт на месяц, который сейчас идёт (по Москве; новый месяц — с startDay-го числа, обычно 1-го),
     а если он ещё не опубликован — на последний опубликованный до него. Нет auto — как раньше, на выбранную в панели витрину (currentShowcase).
     Стрелки над сеткой: «← прошлый месяц · следующий →»; следующего ещё нет — страница-заглушка «Ноябрь · скоро» (без содержимого черновика). */
  function monthsOf(st) { return (st && st.months) || {}; }
  function ymId(y, m) { return y + '-' + (m < 10 ? '0' : '') + m; }
  function ymShift(id, k) { var p = id.split('-'), t = +p[0] * 12 + (+p[1] - 1) + k; return ymId(Math.floor(t / 12), t % 12 + 1); }
  M13.monthNow = function (st) {
    var t = mskToday(), day = Math.max(1, Math.min(28, Math.round(+monthsOf(st).startDay || 1))), id = ymId(t.getFullYear(), t.getMonth() + 1);
    return t.getDate() < day ? ymShift(id, -1) : id;
  };
  // Какая витрина открывается по основному адресу: ids — опубликованные месяцы. null — решает панель (auto выключено или нечего выбрать)
  M13.monthPick = function (st, ids) {
    if (monthsOf(st).auto === false) return null;
    var now = M13.monthNow(st), list = (ids || []).filter(function (id) { return /^\d{4}-\d{2}$/.test(id); }).sort(), out = null;
    list.forEach(function (id) { if (id <= now) out = id; });
    return out || list[0] || null;
  };
  // Страница-заглушка: месяц сразу после последнего опубликованного
  M13.monthSoon = function (ids) {
    var list = (ids || []).filter(function (id) { return /^\d{4}-\d{2}$/.test(id); }).sort();
    return list.length ? ymShift(list[list.length - 1], 1) : null;
  };
  M13.monthName = function (id, withYear) { var p = String(id || '').split('-'); return (MONTHS_NOM[+p[1] - 1] || '') + (withYear ? ' ' + p[0] : ''); };
  function pubIds() { return ((S.D.index || {}).showcases || []).filter(function (x) { return x && x.status !== 'draft'; }).map(function (x) { return x.id; }).sort(); }
  // Стрелки к соседним месяцам. id — эта страница (у заглушки — её месяц)
  // hd — шапка месяца: вид стрелок head.mnStyle ('' — просто надпись | glass), свой цвет надписи mnColor, цвет стекла mnBg
  function monthNavHTML(id, hd) {
    if (monthsOf(S.D.settings).arrows === false || !/^\d{4}-\d{2}$/.test(id || '')) return '';
    var ids = pubIds(), prev = null, next = null, soon = M13.monthSoon(ids);
    ids.forEach(function (x) { if (x < id) prev = x; if (x > id && !next) next = x; });
    if (!next && soon && soon > id) next = soon;
    if (!prev && !next) return '';
    var y = id.split('-')[0];
    function a(x, cls, label) { return '<a class="m13-mnav-' + cls + '" href="' + esc(S.base + x + '/') + '" data-m13-mnav="' + esc(x) + '">' + label + '</a>'; }
    function nm(x) { return esc(M13.monthName(x, x.split('-')[0] !== y)); }
    hd = hd || {};
    var glass = hd.mnStyle === 'glass', css = [], col = hd.mnColor || hd.color || '';
    if (hd.mnColor) css.push('--mn-c:' + hd.mnColor);
    if (glass) css.push('--mn-bg:' + (hd.mnBg ? 'color-mix(in srgb,' + hd.mnBg + ' 62%,transparent)' : col && lum(hexRgb(col)) > 150 ? 'rgba(14,10,6,.5)' : 'rgba(255,255,255,.62)'));
    return '<nav class="m13-mnav' + (glass ? ' m13-mnav--glass' : '') + (hd.mnColor ? ' m13-mnav--own' : '') + '"' + (css.length ? ' style="' + esc(css.join(';')) + '"' : '') + ' aria-label="Месяцы">' + (prev ? a(prev, 'prev', '← ' + nm(prev)) : '<span></span>') +
      (next ? a(next, 'next', nm(next) + (next === soon && ids.indexOf(next) < 0 ? ' · ' + esc(soonOf(S.D.settings).word) : '') + ' →') : '') + '</nav>';
  }
  function soonOf(st) { var o = monthsOf(st).soon || {}; return { word: String(o.word || '').trim() || 'скоро', font: o.font || '', color: o.color || '', note: String(o.note || '').trim(), size: o.size || 'l' }; }
  function mnavBind() {
    // В предпросмотре панели стрелки никуда не уводят; в окне ролика (M13.previewMonth) — открывают месяц здесь же
    if (S.onBack) S.root.querySelectorAll('[data-m13-mnav]').forEach(function (x) {
      x.addEventListener('click', function (e) { e.preventDefault(); if (M13.previewMonth) M13.previewMonth(x.getAttribute('data-m13-mnav')); });
    });
  }

  // opts: {base, view, showcase, data?}  data — готовые данные (для предпросмотра в панели).
  M13.mount = function (el, opts) {
    if (S.wakeT) wakeStop();
    S.root = el; S.base = opts.base || './'; S.view = opts.view || 'showcase';
    S.onBack = opts.onBack || null; S.layers = []; S.useHistory = !opts.noHistory; S.soon = opts.soon || null; S.route = opts.route || null; lock(false);
    el.classList.add('m13');
    el.innerHTML = '<div class="m13-loading">…</div>';
    var p = opts.data ? Promise.resolve(opts.data) : M13.load(S.base, opts.showcase);
    return p.then(function (D) {
      S.D = D;
      if (S.view === 'sandbox') renderStandalone('sandbox');
      else if (S.view === 'reflection') renderStandalone('reflection');
      else if (S.view === 'events') renderStandalone('events');
      else if (S.view === 'kin') renderStandalone('kin');
      else if (S.view === 'soon') renderSoon();
      else if (S.view === 'oferta') renderOferta();
      else if (S.view === 'routesoon') renderRouteSoon();
      else renderShowcase();
    }).catch(function (e) {
      console.error(e);
      var msg = (S.D && T('loadError')) || 'Не удалось загрузить витрину. Попробуйте обновить страницу.';
      el.innerHTML = '<div class="m13-loading">' + txt(msg) + '</div>';
    });
  };

  /* ---------- Действия (кнопки, плашки) ---------- */
  // Каждой кликабельной плашке присваивается номер; по нему находим действие и контекст клика.
  function act(action, ctx) {
    S.acts.push({ action: action || { kind: 'contact' }, ctx: ctx || {} });
    return ' data-m13-act="' + (S.acts.length - 1) + '"';
  }
  function runAct(i) {
    var a = S.acts[i]; if (!a) return;
    var action = a.action, ctx = a.ctx;
    if (action.kind === 'link') {
      var url = action.url || ctx.routeUrl;
      // страница этого же сайта (например, костёр в «Узорах») — в том же окне (её слова 31.10); чужой сайт и предпросмотр в панели — в новом
      if (url && !S.onBack && sameSite(url)) location.href = url;
      else if (url) window.open(url, '_blank', 'noopener');
    } else if (action.kind === 'internal') {
      openInternal(action.target, action.tab);
    } else if (action.kind === 'event') {
      if (S.view === 'events') showEvent(action.eventId); else openInternal('events', action.eventId);
    } else if (action.kind === 'calendar') {
      openCalendar(action.cal || action, ctx);
    } else if (action.kind === 'share') {
      shareCard(ctx);
    } else if (action.kind === 'download') {
      if (action.url) { var a = document.createElement('a'); a.href = action.url; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('download', ''); document.body.appendChild(a); a.click(); a.remove(); }
    } else if (ctx.item && zpKeyOf(action) && (action.kind || 'contact') === 'contact') {
      // Плашка с меткой: если эта встреча записывается по календарю — окошко записи (иначе всё равно «Куда написать?»)
      zpTry(action, ctx);
    } else {
      openContact(action, ctx);
    }
  }
  function bindActs(scope) {
    scope.querySelectorAll('[data-m13-tile]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); S.from = b; openTile(+b.getAttribute('data-m13-tile')); });
    });
    scope.querySelectorAll('[data-m13-act]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); S.from = b; runAct(+b.getAttribute('data-m13-act')); });
      if (b.getAttribute('role') === 'button') b.addEventListener('keydown', function (e) {
        if (e.target === b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); S.from = b; runAct(+b.getAttribute('data-m13-act')); } });
    });
  }

  /* ---------- Слои и кнопка «назад» телефона ---------- */
  // Открытая карточка, Песочница и окно контакта — «слои». Системная кнопка «назад» закрывает верхний слой.
  function pushLayer(name, closeFn, hash) {
    S.layers.push({ name: name, close: closeFn });
    hushSync();
    if (!S.useHistory) return;
    try { history.pushState({ m13: S.layers.length }, '', hash != null ? hash : location.href); }
    catch (e) { S.useHistory = false; }
  }
  function closeTop() {
    if (!S.layers.length) return;
    if (S.useHistory) { history.back(); return; }
    S.layers.pop().close();
    hushSync();
  }
  window.addEventListener('popstate', function () {
    var l = S.layers.pop();
    if (l) l.close();
    hushSync();
  });
  // Пока сетка закрыта карточкой или страницей (и пока летят звёзды календаря), бесконечные украшения под ней
  // (бегущий блик по контуру, дыхание свечения, мерцающая точка) стоят на паузе: их всё равно не видно за
  // затемнением, а телефону иначе приходится каждый кадр заново размывать весь экран — всё начинает тормозить.
  function hushSync() {
    if (!S.root || !S.root.classList) return;
    S.root.classList.toggle('m13-hush', !!S.flying || !!S.root.querySelector('#m13-overlay.is-open,.m13-internal.is-open'));
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && S.layers.length) closeTop();
    if (LB.open && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) lbGo(e.key === 'ArrowRight' ? 1 : -1);
  });
  function lock(on) { document.body.classList.toggle('m13-locked', on); }

  /* ================= ВИТРИНА ================= */
  // Кнопка «События и архив» в шапке витрины — если есть хоть одно видимое событие или маршрут в архиве (выключается в панели)
  // Вид — head.evStyle: glass (стекло, по умолчанию) | line (тонкий контур, как было) | fill (заливка); evSize l (по умолчанию) | m;
  // evColor — свой цвет (пусто — цвет надписей над сеткой); evBg — цвет стекла (пусто — светлое/тёмное под цвет надписи)
  function eventsLinkHTML(hd) {
    var ev = S.D.events || {}, st = S.D.settings || {};
    if (st.eventsLink === false || !((ev.items || []).some(function (e) { return e && e.visible !== false; }) || archRoutes().length)) return '';
    hd = hd || {};
    var kind = hd.evStyle === 'line' || hd.evStyle === 'fill' ? hd.evStyle : 'glass', col = hd.evColor || hd.color || '', css = [];
    if (hd.evColor) css.push('--ev-c:' + hd.evColor);
    if (kind === 'glass') css.push('--ev-bg:' + (hd.evBg ? 'color-mix(in srgb,' + hd.evBg + ' 62%,transparent)' : col && lum(hexRgb(col)) > 150 ? 'rgba(14,10,6,.5)' : 'rgba(255,255,255,.62)'));
    if (kind === 'fill') { var bg = col || '#232323'; css.push('--ev-c:' + bg, '--ev-ink:' + inkFor(bg)); }
    return '<a class="m13-evlink m13-evlink--' + kind + (hd.evSize === 'm' ? '' : ' m13-evlink--l') + (hd.evColor ? ' m13-evlink--own' : '') + '"' +
      (css.length ? ' style="' + esc(css.join(';')) + '"' : '') + ' href="' + esc(S.base + 'events/') + '" data-m13-evlink>' + txt(T('eventsLink') || 'События и архив') + ' →</a>';
  }
  // Фон: цвет + картинка (отдельная для телефона), затемнение и размытие — слоями под страницей.
  function rootOpen(bg) {
    var rs = [];
    if (bg.color) rs.push('--m13-bgc:' + bg.color);
    if (bg.image) {
      rs.push("--m13-bgimg:url('" + media(bg.image) + "')", "--m13-bgimg-t:url('" + media(bg.imageTall || bg.image) + "')");
      rs.push('--m13-dim:' + (Math.max(0, Math.min(90, +bg.dim || 0)) / 100), '--m13-blur:' + Math.max(0, Math.min(20, +bg.blur || 0)) + 'px' + bgSize(bg) + bgFx(bg));
    }
    return '<div class="m13-root' + (bg.image ? ' m13-root--img' + (+bg.blur > 0 ? ' m13-root--blur' : '') + bgWait(bg) : '') + '" style="' + esc(rs.join(';')) + '">';
  }
  /* Заглушка ещё не открытого месяца (S.soon = 'ГГГГ-ММ'): фон, верхняя строка и низ — как у последнего опубликованного месяца (S.D.showcase),
     посередине — название месяца и крупное слово («скоро») своим шрифтом; ниже — её строка (необязательно) и стрелка назад. Содержимого черновика здесь нет. */
  function renderSoon() {
    var sc = S.D.showcase || {}, st = S.D.settings, so = soonOf(st), id = S.soon || M13.monthSoon(pubIds()) || '';
    var name = M13.monthName(id, true);
    document.title = (st.siteTitle || '13 MIRRORS') + ' · ' + name + ' · ' + so.word;
    S.acts = [];
    var hd = sc.head || {}, cs = sc.cardStyle || {}, hs = [];
    if (hd.color) hs.push('--m13-head:' + hd.color);
    var mf = cs.font || '', wf = so.font || mf || 'Cormorant Garamond';
    if (mf) { ensureFont(mf); hs.push("--m13-hfont:'" + mf + "',Georgia,serif"); }
    ensureFont(wf);
    var css = hs.concat(["--m13-sfont:'" + wf + "',Georgia,serif", '--m13-shine:' + (hd.shineColor || cs.rimRunColor || '#fff3cf')]);
    if (so.color || hd.color) css.push('--m13-sc:' + (so.color || hd.color));
    var top = hd.top || (hd.logo ? 'logo' : 'text');
    var topText = String(hd.topText || '').trim() || [st.siteTitle || '13 MIRRORS', T('kicker')].filter(Boolean).join(' · ');
    var kicker = top === 'logo' ? '<h2 class="m13-logo-wrap m13-logo-wrap--' + (hd.topSize === 's' || hd.topSize === 'l' ? hd.topSize : 'm') + '">' + logoHTML(hd) + '</h2>'
      : top === 'none' ? '' : '<div class="m13-kicker"><span class="m13-gt">' + txt(topText) + '</span></div>';
    var foot = footHTML(hd, hs);
    S.root.innerHTML = rootOpen(sc.background || {}) + '<main class="m13-page m13-soon-page">' +
      '<header class="m13-header' + (hd.align === 'center' ? ' m13-header--center' : '') + (hd.color ? ' m13-header--tinted' : '') + '"' + (hs.length ? ' style="' + esc(hs.join(';')) + '"' : '') + '>' + kicker + '</header>' +
      '<section class="m13-soon m13-shine m13-soon--' + (so.size === 'm' || so.size === 'xl' ? so.size : 'l') + (so.color || hd.color ? ' m13-soon--tinted' : '') + '" style="' + esc(css.join(';')) + '">' +
        '<h1><span class="m13-soon-month">' + txt(name) + '</span><span class="m13-soon-word"><span class="m13-gt">' + txt(so.word) + '</span></span></h1>' +
        (so.note ? '<p class="m13-soon-note">' + txt(so.note) + '</p>' : '') + monthNavHTML(id) + '</section>' + foot + '</main></div>';
    bgWatch(S.root);
    var fl = S.root.querySelector('.m13-foot-logo');
    if (fl && S.onBack) fl.addEventListener('click', function (e) { e.preventDefault(); });
    mnavBind();
  }
  /* ---------- Реквизиты и страница «Условия и цены» (для ЮKassa, 28.10) ----------
     settings.legal = {name, status, inn, email, phone, foot, link, title, pricesTitle, payNote, offerTitle, offer}.
     Страница oferta/ (data-view="oferta"): исполнитель и контакты, «Услуги и цены» — сами с карточки «Индивидуальная работа»
     — всех платных карточек месяца, который идёт (строками: «Маршрут · название», под ним — формат и цена), и текст соглашения (пустая строка — новый абзац, строка с «# » — подзаголовок;
     подстановки {исполнитель} {статус} {инн} {почта} {телефон}). Внизу витрины — footMode: links (по умолчанию) — «Условия и цены» и «Конфиденциальность» по углам;
     full — ещё строка «имя · ИНН · почта · телефон»; none — ничего. */
  var LEGAL_DEF = {
    name: 'Распругина Елена Вячеславовна', status: '', inn: '272498468707',
    email: '13mirrors.host@gmail.com', phone: '', footMode: 'links', link: 'Условия и цены', title: 'Условия и цены',
    pricesTitle: 'Услуги и цены', payNote: 'Цены — в рублях. Оплата — полностью заранее, через ЮKassa. Время встреч — по Москве.',
    offerTitle: 'Публичная оферта',
    // Её редакция оферты от 28.10 (подстановки: {исполнитель} {статус} {инн} {почта} {телефон} {телеграм} {вк})
    offer: 'Редакция от 28 окт. 2026 г.\n\n' +
      'Настоящий документ является публичным предложением (офертой) заключить договор на оказание услуг на указанных ниже условиях.\n\n' +
      'Исполнитель: {исполнитель}, {статус}, ИНН {инн}.\nКлиент — физическое лицо, оплатившее услугу. Сайт — 13mirrors.ru.\n\n' +
      'Оплачивая услугу на Сайте, Клиент подтверждает, что ознакомился с условиями оферты и принимает их. Договор считается заключённым с момента оплаты.\n\n' +
      '# 1. Услуги\nИсполнитель оказывает услуги, представленные на Сайте в разделе «Услуги и цены»: маршруты 13 MIRRORS, индивидуальные встречи и сессии, события и другие предложения. Название, стоимость, длительность и формат каждой услуги указаны на её странице на Сайте.\n\n' +
      'Если услуга проходит онлайн, ссылку для подключения Исполнитель направляет Клиенту дополнительно. Для очных встреч адрес сообщается в переписке.\n\n' +
      'Услуги носят психологический, образовательный и рефлексивный характер. Они не являются медицинской помощью, не включают диагностику или лечение и не заменяют обращение к врачу. Материалы, основанные на календаре Dreamspell и авторских методиках 13 MIRRORS, не являются прогнозом, предсказанием или гарантией результата. Исполнитель не оказывает экстренную помощь: при угрозе жизни и здоровью Клиент обращается в экстренные службы (112).\n\n' +
      '# 2. Запись и оплата\nКлиент самостоятельно выбирает услугу на Сайте. Для индивидуальной встречи Клиент выбирает доступные дату и время; если не указано иное, время указано по Москве.\n\n' +
      'Услуга оплачивается полностью до её начала по цене, указанной на Сайте на момент оплаты. Оплата проходит через платёжный сервис ЮKassa. Клиент получает чек по адресу, указанному при оплате.\n\n' +
      'Если оплата прошла, а выбранное время оказалось занято, Исполнитель предлагает другое время либо возвращает оплату полностью.\n\n' +
      '# 3. Перенос и отмена индивидуальной встречи\nКлиенту желательно сообщить о переносе не позднее чем за 12 часов до начала встречи. В этом случае встречу можно перенести на другое доступное время по согласованию с Исполнителем. Перенос менее чем за 12 часов возможен по согласованию.\n\n' +
      'Клиент вправе отказаться от встречи до её проведения, в том числе менее чем за 12 часов. В этом случае возвращается оплата за вычетом фактически понесённых Исполнителем расходов, если они были.\n\n' +
      'Если Клиент не пришёл на встречу и не предупредил заранее, время встречи не продлевается; возможность переноса или возврата рассматривается по обращению Клиента.\n\n' +
      'Если встречу отменяет Исполнитель или она не состоялась по техническим причинам на его стороне, Клиент выбирает перенос на другое время или полный возврат.\n\n' +
      '# 4. Отказ от маршрута или программы\nКлиент вправе отказаться от участия в маршруте или другой программе в любое время.\n\n' +
      'Если программа ещё не началась, оплата возвращается за вычетом фактически понесённых Исполнителем расходов, если они были.\n\n' +
      'Если программа уже началась, возврат рассчитывается пропорционально неоказанной части (по числу дней или встреч) за вычетом фактически понесённых расходов.\n\n' +
      'Если маршрут или событие отменяет Исполнитель, Клиенту возвращается полная стоимость либо, по согласованию, предлагается перенос или другой подходящий вариант участия.\n\n' +
      '# 5. Возврат денежных средств\nДля возврата Клиенту нужно написать Исполнителю по адресу {почта}, в Telegram {телеграм} или VK {вк} и сообщить имя, название услуги, дату и сумму оплаты. Исполнитель отвечает на обращение и оформляет возврат в течение 10 календарных дней со дня получения заявления.\n\n' +
      'Возврат производится тем же способом, которым была совершена оплата, если иной способ не согласован или не требуется правилами платёжной системы. Срок поступления денег зависит от банка и платёжной системы.\n\n' +
      '# 6. Конфиденциальность и персональные данные\nИнформация, которой Клиент делится с Исполнителем в ходе индивидуальной работы, конфиденциальна и не передаётся третьим лицам, кроме случаев, предусмотренных законодательством РФ, и случаев угрозы жизни или здоровью Клиента или других лиц.\n\n' +
      'Банковские реквизиты карты обрабатываются платёжным сервисом ЮKassa и Исполнителю не передаются. Подробнее — на странице «Конфиденциальность» Сайта.\n\n' +
      '# 7. Авторские права и правила участия\nМатериалы маршрутов (тексты, аудио, видео, карты) являются объектами авторских прав Исполнителя и предоставляются Клиенту для личного использования. Копирование, распространение, публикация материалов и запись встреч без письменного согласия Исполнителя не допускаются.\n\n' +
      '# 8. Изменение оферты и споры\nИсполнитель вправе изменять условия оферты. Действует редакция, размещённая на Сайте на момент оплаты.\n\n' +
      'Претензии направляются по адресу, указанному в разделе 5; Исполнитель отвечает в течение 10 календарных дней. Споры, не разрешённые по соглашению, рассматриваются в соответствии с законодательством РФ.\n\n' +
      '# Реквизиты Исполнителя\n{исполнитель}, {статус}, ИНН {инн}. Почта: {почта}. Telegram: {телеграм}. VK: {вк}.'
  };
  M13.LEGAL_DEF = LEGAL_DEF;
  M13.legalOf = function (st) { return legalOf(st); };
  // Прежняя редакция (до 28.10, вписывалась в черновик панелью) — считается пустой: встаёт новая
  function legalOld(k, v) {
    if (k === 'offerTitle') return v === 'Пользовательское соглашение (договор-оферта)';
    if (k !== 'offer' || !v) return false;
    var h = 5381; for (var i = 0; i < v.length; i++) h = ((h * 33) ^ v.charCodeAt(i)) >>> 0;
    // 1oblguz — до 28.10, 1b3a6xg — первая «Публичная оферта» (с фразой про персональные данные и анкету)
    return h.toString(36) === '1oblguz' || h.toString(36) === '1b3a6xg';
  }
  M13.legalOld = legalOld;
  function legalOf(st) {
    var o = Object.assign({}, (st && st.legal) || {}), out = {};
    ['offer', 'offerTitle'].forEach(function (k) { if (legalOld(k, o[k])) o[k] = ''; });
    Object.keys(LEGAL_DEF).forEach(function (k) { out[k] = typeof LEGAL_DEF[k] === 'string' ? (String(o[k] == null ? '' : o[k]).trim() || LEGAL_DEF[k]) : (o[k] == null ? LEGAL_DEF[k] : o[k]); });
    // Телефон и статус могут быть пустыми (статус стёрт — его нет нигде)
    out.phone = String(o.phone || '').trim();
    if (o.status != null) out.status = String(o.status).trim();
    if (!o.footMode && o.foot === false) out.footMode = 'none';
    if (['full', 'links', 'none'].indexOf(out.footMode) < 0) out.footMode = 'links';
    return out;
  }
  function telHref(p) { return 'tel:' + String(p).replace(/[^\d+]/g, ''); }
  function legalSubst(s, L) {
    var ct = (S.D && S.D.settings && S.D.settings.contacts) || {}, tg = tgName(ct.telegram), vk = String(ct.vk || '').trim().replace(/^https?:\/\/(m\.)?vk\.(com|me)\//i, '').replace(/^@/, '').replace(/\/.*$/, '');
    var map = { 'исполнитель': L.name, 'статус': L.status, 'инн': L.inn, 'почта': L.email, 'телефон': L.phone, 'телеграм': tg ? 't.me/' + tg : '', 'вк': vk ? 'vk.com/' + vk : '' };
    return String(s).replace(/\{(исполнитель|статус|инн|почта|телефон|телеграм|вк)\}/g, function (m, k) { return map[k] || ''; }).replace(/,(\s*,)+/g, ',').replace(/ {2,}/g, ' ');
  }
  // Низ витрины: «Условия и цены» — в левом углу, «Конфиденциальность» — в правом (мелко, подчёркнуто); full — под ними «имя · ИНН · почта · телефон»
  function legalLineHTML() {
    var st = S.D.settings || {}, L = legalOf(st);
    if (L.footMode === 'none') return '';
    var priv = String(((st.home || {}).privacyTitle) || '').trim() || 'Конфиденциальность';
    var star = '<i class="m13-legal-star" aria-hidden="true">✦</i>';
    var links = '<a href="' + esc(S.base + 'oferta/') + '" data-m13-oferta>' + txt(L.link) + '</a>' + star +
      '<a href="' + esc(S.base + '../privacy/') + '" data-m13-priv>' + txt(priv) + '</a>';
    var req = '';
    if (L.footMode === 'full') {
      var parts = [txt(L.name), 'ИНН ' + txt(L.inn), '<a href="mailto:' + esc(L.email) + '">' + txt(L.email) + '</a>'];
      if (L.phone) parts.push('<a href="' + esc(telHref(L.phone)) + '">' + txt(L.phone) + '</a>');
      req = '<span class="m13-legal-req">' + parts.join('<span aria-hidden="true"> · </span>') + '</span>';
    }
    // Шрифт и цвет — как у надписей месяца над сеткой
    var sc = S.D.showcase || {}, mf = (sc.cardStyle || {}).font || '', hc = (sc.head || {}).color || '', css = [];
    if (mf && S.view !== 'oferta') css.push("--m13-hfont:'" + mf + "',Georgia,serif");
    if (hc && S.view !== 'oferta') css.push('color:' + hc);
    // Лёгкая тень под буквами, чтобы ссылки читались на пёстром фоне: светлые буквы — тёмная, тёмные — светлая
    if (S.view !== 'oferta' && /^#[0-9a-f]{6}$/i.test(hc)) {
      var lum = parseInt(hc.substr(1, 2), 16) * .3 + parseInt(hc.substr(3, 2), 16) * .59 + parseInt(hc.substr(5, 2), 16) * .11;
      css.push('--m13-lsh:' + (lum > 140 ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.7)'));
    }
    return '<p class="m13-legal-line"' + (css.length ? ' style="' + esc(css.join(';')) + '"' : '') + '><span class="m13-legal-links">' + links + '</span>' + req + '</p>';
  }
  function legalLineBind() {
    var a = S.root.querySelector('[data-m13-oferta]'), b = S.root.querySelector('[data-m13-priv]');
    // В предпросмотре панели: «Условия и цены» открывается здесь же, «Конфиденциальность» — не уводит из панели
    if (a && S.onBack) a.addEventListener('click', function (e) { e.preventDefault(); if (M13.previewGo) M13.previewGo('oferta'); });
    if (b && S.onBack) b.addEventListener('click', function (e) { e.preventDefault(); });
  }
  // Услуги и цены: все видимые карточки месяца, где есть цена (цифры): форматы маршрутов и плашки с ценой.
  // Группа — «Надпись сверху · Название» карточки, строки — название, подпись (длительность / примечание формата), цена.
  function hasPrice(v) { return /\d/.test(String(v || '')); }
  function priceGroups(sc) {
    var out = [];
    ((sc && sc.cards) || []).forEach(function (c) {
      if (!c || c.visible === false || !c.back || !c.back.blocks) return;
      var f = c.front || {}, rows = [];
      c.back.blocks.forEach(function (b) {
        if (!b || b.visible === false) return;
        if (b.kind === 'formats') (b.formats || []).forEach(function (x) {
          if (!x || x.visible === false || x.availability === 'closed') return;
          var fm = formatById(x.formatId) || {}, price = (x.price && opt(x.price)) || fm.price || '';
          if (hasPrice(price)) rows.push({ title: x.title || fm.title || '', sub: (x.note && opt(x.note)) || opt(fm.note), price: price });
        });
        if (b.kind === 'items') (b.items || []).slice().sort(function (x, y) { return (+x.order || 0) - (+y.order || 0); }).forEach(function (it) {
          if (!it || it.visible === false || !String(it.title || '').trim()) return;
          var price = opt(it.price);
          if (hasPrice(price)) rows.push({ title: String(it.title).trim(), sub: opt(it.duration), price: price });
        });
      });
      if (rows.length) out.push({ title: String(f.title || '').trim(), eyebrow: eyeOf(f), rows: rows });
    });
    return out;
  }
  function legalTextHTML(t, L) {
    return String(t || '').trim().split(/\n\s*\n/).map(function (par) {
      par = legalSubst(par.trim(), L);
      var m = /^#\s+([^\n]+)\n?([\s\S]*)$/.exec(par);
      if (m) return '<h3>' + txt(m[1]) + '</h3>' + (m[2].trim() ? '<p>' + txt(m[2].trim()) + '</p>' : '');
      return '<p>' + txt(par) + '</p>';
    }).join('');
  }
  function renderOferta() {
    var sc = S.D.showcase || {}, st = S.D.settings, L = legalOf(st), ct = st.contacts || {};
    document.title = (st.siteTitle || '13 MIRRORS') + ' · ' + L.title;
    S.acts = [];
    var hd = sc.head || {}, cs = sc.cardStyle || {}, hs = [];
    if (hd.color) hs.push('--m13-head:' + hd.color);
    var mf = cs.font || 'Cormorant Garamond';
    ensureFont(mf); ensureFont('Montserrat');
    var css = ["--m13-lfont:'" + mf + "',Georgia,serif"];
    if (cs.accent) css.push('--m13-lacc:' + cs.accent);
    // Подложка и буквы — как у оборота карточек месяца (светлый месяц — светлая страница)
    var pbg = /^#[0-9a-f]{6}$/i.test(cs.backBg || '') ? cs.backBg : /^#[0-9a-f]{6}$/i.test(cs.bg || '') ? cs.bg : '';
    if (pbg) css.push('--m13-lbg:' + pbg + 'eb');
    if (/^#[0-9a-f]{6}$/i.test(cs.textColor || '')) css.push('--m13-ltx:' + cs.textColor);
    if (pbg && parseInt(pbg.substr(1, 2), 16) + parseInt(pbg.substr(3, 2), 16) + parseInt(pbg.substr(5, 2), 16) > 384) css.push('--m13-lline:rgba(0,0,0,.14)');
    var top = hd.top || (hd.logo ? 'logo' : 'text');
    var topText = String(hd.topText || '').trim() || [st.siteTitle || '13 MIRRORS', T('kicker')].filter(Boolean).join(' · ');
    var kicker = top === 'logo' ? '<a class="m13-logo-wrap m13-logo-wrap--s" href="' + esc(S.base) + '" data-m13-lhome>' + logoHTML(hd) + '</a>'
      : '<div class="m13-kicker"><span class="m13-gt">' + txt(topText) + '</span></div>';
    var back = S.onBack ? '<button type="button" class="m13-iback" data-m13-lhome>' + txt(T('backToShowcase') || '← К витрине') + '</button>'
      : '<a class="m13-iback" href="' + esc(S.base) + '">' + txt(T('backToShowcase') || '← К витрине') + '</a>';
    function row(k, v) { return '<div><dt>' + txt(k) + '</dt><dd>' + v + '</dd></div>'; }
    var tg = String(ct.telegram || '').trim().replace(/^@/, ''), vk = String(ct.vk || '').trim();
    var who = row('Исполнитель', txt(L.name)) + (L.status ? row('Статус', txt(L.status)) : '') + row('ИНН', txt(L.inn)) +
      row('Почта', '<a href="mailto:' + esc(L.email) + '">' + txt(L.email) + '</a>') +
      (L.phone ? row('Телефон', '<a href="' + esc(telHref(L.phone)) + '">' + txt(L.phone) + '</a>') : '') +
      (tg ? row('Telegram', '<a href="' + esc(/^https?:/.test(tg) ? tg : 'https://t.me/' + tg.replace(/^t\.me\//, '')) + '" target="_blank" rel="noopener">' + txt('@' + tg.replace(/^(https?:\/\/)?t\.me\//, '')) + '</a>') : '') +
      (vk ? row('VK', '<a href="' + esc(/^https?:/.test(vk) ? vk : 'https://vk.com/' + vk.replace(/^vk\.com\//, '')) + '" target="_blank" rel="noopener">' + txt('vk.com/' + vk.replace(/^https?:\/\/(vk\.com\/)?/, '')) + '</a>') : '');
    var prices = priceGroups(sc).map(function (g) {
      return '<h3 class="m13-legal-group">' + (g.eyebrow ? '<span>' + txt(g.eyebrow) + '</span>' : '') + txt(g.title) + '</h3>' +
        '<ul class="m13-legal-prices">' + g.rows.map(function (it) {
          return '<li><span class="m13-legal-pt">' + txt(it.title) + (it.sub ? '<small>' + txt(it.sub) + '</small>' : '') + '</span>' +
            '<span class="m13-legal-pp">' + txt(it.price) + '</span></li>';
        }).join('') + '</ul>';
    }).join('');
    S.root.innerHTML = rootOpen(sc.background || {}) + '<main class="m13-page m13-legal-page">' +
      '<header class="m13-header m13-header--center' + (hd.color ? ' m13-header--tinted' : '') + '"' + (hs.length ? ' style="' + esc(hs.join(';')) + '"' : '') + '>' + kicker + '</header>' +
      '<article class="m13-legal" style="' + esc(css.join(';')) + '">' + back +
        '<h1>' + txt(L.title) + '</h1>' +
        '<section><dl class="m13-legal-who">' + who + '</dl></section>' +
        '<section id="prices"><h2>' + txt(L.pricesTitle) + '</h2>' + prices +
          '<p class="m13-legal-note">' + txt(L.payNote) + '</p></section>' +
        '<section id="oferta"><h2>' + txt(L.offerTitle) + '</h2>' + legalTextHTML(L.offer, L) + '</section>' +
        legalLineHTML() +
      '</article></main></div>';
    bgWatch(S.root);
    S.root.querySelectorAll('[data-m13-lhome]').forEach(function (x) {
      if (S.onBack) x.addEventListener('click', function (e) { e.preventDefault(); S.onBack(); });
    });
    legalLineBind();
    var h = (location.hash || '').slice(1), t = h && !S.onBack && document.getElementById(h);
    if (t && t.scrollIntoView) setTimeout(function () { t.scrollIntoView(); }, 60);
  }

  /* Заглушка маршрута routes/<id>/ (её «делаем» 26.10): страницы по дням ещё нет (маршрут «готовится» или не создан) —
     в цвете маршрута: «Маршрут», название, даты, «Маршрут начнётся 13 ноября» (идёт / завершён — по датам), строка описания
     из библиотеки маршрутов, «Задать вопрос» (Host: <печать>_question) и «← Витрина». Создаёт публикация (routeSoonPageHTML в admin.js),
     пока у маршрута нет своей страницы; появится страница — она займёт этот адрес. */
  function routeSoonRange(d) {
    var a = parseDate(d.from), b = parseDate(d.to); if (!a) return '';
    if (!b) return a.getDate() + ' ' + MONTHS_GEN[a.getMonth()];
    return a.getMonth() === b.getMonth() ? a.getDate() + '–' + b.getDate() + ' ' + MONTHS_GEN[b.getMonth()]
      : a.getDate() + ' ' + MONTHS_GEN[a.getMonth()] + ' – ' + b.getDate() + ' ' + MONTHS_GEN[b.getMonth()];
  }
  function mixHex(a, b, k) { var x = hexRgb(a), y = hexRgb(b); return '#' + [0, 1, 2].map(function (i) { return ('0' + Math.round(x[i] + (y[i] - x[i]) * k).toString(16)).slice(-2); }).join(''); }
  function renderRouteSoon() {
    var st = S.D.settings, sc = S.D.showcase || {}, cs = sc.cardStyle || {}, hd = sc.head || {};
    var r = (((S.D.routes || {}).routes) || []).filter(function (x) { return x && x.id === S.route; })[0] || { title: 'Маршрут', dates: {} };
    var d = r.dates || {}, from = parseDate(d.from), to = parseDate(d.to), now = mskToday(), line;
    if (from && now < from) line = 'Маршрут начнётся ' + from.getDate() + ' ' + MONTHS_GEN[from.getMonth()];
    else if (from && to && now <= to) line = 'Маршрут идёт · день ' + (Math.round((now - from) / 864e5) + 1) + ' из ' + (Math.round((to - from) / 864e5) + 1);
    else if (to) line = 'Маршрут завершён';
    else line = 'Маршрут скоро начнётся';
    document.title = (st.siteTitle || '13 MIRRORS') + ' · ' + r.title + ' · ' + line;
    S.acts = [];
    // Цвета — от цвета маршрута: светлая середина, глубокие края; надписи — тем же цветом, только темнее
    var tone = /^#[0-9a-f]{6}$/i.test(r.color || '') ? r.color : routeTone(r), rgb = hexRgb(tone);
    var pale = Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2]) < 40;   // белый маршрут — почти без цвета
    // Белый маршрут: надписи — цветом шапки месяца, но если он светлый (задуман для тёмного фона) — сгущаем до тёплого тёмного золота (27.10)
    var hc = /^#[0-9a-f]{6}$/i.test(hd.color || '') ? hd.color : '#6f5320', hrgb = hexRgb(hc);
    var ink = pale ? (hrgb[0] * 0.299 + hrgb[1] * 0.587 + hrgb[2] * 0.114 > 110 ? mixHex(hc, '#2e1f08', 0.72) : hc) : mixHex(tone, '#000000', 0.62);
    var css = ['--rs-c:' + tone, '--rs-l:' + mixHex(tone, '#ffffff', pale ? 0.55 : 0.78), '--rs-m:' + mixHex(tone, '#ffffff', pale ? 0.05 : 0.35),
      '--rs-d:' + mixHex(tone, pale ? '#6b5a3c' : '#000000', pale ? 0.42 : 0.45), '--rs-ink:' + ink, '--rs-btn:' + (pale ? ink : mixHex(tone, '#000000', 0.35)),
      '--m13-shine:' + (pale ? '#fff3cf' : mixHex(tone, '#ffffff', 0.85))];
    var font = cs.font || 'Cormorant Garamond'; ensureFont(font); css.push("--rs-font:'" + font + "',Georgia,serif");
    // Кнопка «Задать вопрос»: метка Host и контакты — с заглушки карточки маршрута, если она есть
    var card = (sc.cards || []).filter(function (c) { return c && c.back && c.back.routeId === r.id; })[0], stub = (card && card.back.stub) || {};
    var ask = String(stub.ask || '').trim() || 'Задать вопрос';
    var askBtn = '<button type="button" class="m13-rs-btn m13-rs-btn--main"' + act({ kind: 'contact', label: ask, telegram: stub.telegram || '', vk: stub.vk || '',
      host: String(stub.host || '').trim() || hostAuto(r.title, 'question'), message: 'Здравствуйте! Хочу узнать подробнее про маршрут «' + r.title + '».' }, { card: r.title, action: ask }) + '>' + txt(ask) + '</button>';
    var home = '<a class="m13-rs-btn" href="' + esc(S.base + (card ? '#' + encodeURIComponent(card.id) : '')) + '">' + txt(T('backToShowcase') || '← К витрине') + '</a>';
    var desc = String(r.description || '').trim();
    // Своя картинка фона (её «делаем» 27.10): r.soonBg = { image, imagePhone, pos: '' (по центру) | top | bottom | left | right, veil: 0–90 % (дымка цвета маршрута) }
    var bg = r.soonBg || {}, bgHTML = '';
    if (bg.image) {
      var bgCss = "--rs-img:url('" + media(bg.image) + "')" + (bg.imagePhone ? ";--rs-img-ph:url('" + media(bg.imagePhone) + "')" : '') +
        ';background-position:' + ({ top: '50% 0', bottom: '50% 100%', left: '0 50%', right: '100% 50%' }[bg.pos] || '50% 50%');
      bgHTML = '<i class="m13-rs-bg" aria-hidden="true" style="' + esc(bgCss) + '"></i>' +
        '<i class="m13-rs-veil" aria-hidden="true" style="opacity:' + (bg.veil == null ? 0.3 : Math.max(0, Math.min(90, +bg.veil || 0)) / 100) + '"></i>';
    }
    S.root.innerHTML = '<div class="m13-rs' + (bg.image ? ' m13-rs--img' : '') + '" style="' + esc(css.join(';')) + '">' + bgHTML + '<i class="m13-rs-glow" aria-hidden="true"></i>' +
      '<main class="m13-rs-in m13-shine">' +
      '<a class="m13-rs-top" href="' + esc(S.base) + '">' + txt([st.siteTitle || '13 MIRRORS', T('kicker')].filter(Boolean).join(' · ')) + '</a>' +
      '<p class="m13-rs-kind">Маршрут</p>' +
      '<h1 class="m13-rs-title"><span class="m13-gt">' + txt(r.title) + '</span></h1>' +
      (from ? '<p class="m13-rs-dates">' + txt(routeSoonRange(d)) + '</p>' : '') +
      '<p class="m13-rs-line">' + txt(line) + '</p>' +
      (desc ? '<p class="m13-rs-desc">' + txt(desc) + '</p>' : '') +
      '<div class="m13-rs-btns">' + askBtn + home + '</div>' +
      '</main></div>' + modalHTML() + '<div class="m13-toast" id="m13-toast" role="status" aria-live="polite"></div>';
    bindModal(); bindActs(S.root);
  }
  function renderShowcase() {
    var sc = S.D.showcase;
    if (!sc) throw new Error('Нет данных витрины');
    var st = S.D.settings;
    document.title = (st.siteTitle || '13 MIRRORS') + ' · ' + sc.title;
    S.acts = [];

    var bg = sc.background || {};
    // Шапка: цвет надписей, положение, логотип вместо текста
    var hd = sc.head || {}, hcls = 'm13-header' + (hd.align === 'center' ? ' m13-header--center' : '') + (hd.color ? ' m13-header--tinted' : '');
    // Заголовок месяца — тем же шрифтом, что и карточки (если он задан для всего месяца)
    var hf = (sc.cardStyle || {}).font, hs = [];
    if (hd.color) hs.push('--m13-head:' + hd.color);
    if (hf) { ensureFont(hf); hs.push("--m13-hfont:'" + hf + "',Georgia,serif"); }
    // Блик: по подписи (своё расписание) и приветственный — по верхней строке, названию и подписи при открытии
    var shineCss = '--m13-shine:' + (hd.shineColor || (sc.cardStyle || {}).rimRunColor || '#fff3cf');
    var hs2 = hs.slice();
    if (hd.welcome !== false) { hcls += ' m13-shine'; hs2.push(shineCss); }
    hcls += hazeOf(hd.topHaze, hd.topHazeK, hs2);
    // Верхняя строка: своя надпись (пусто — «13 MIRRORS · Витрина»), логотип или ничего; толщина и курсив надписи
    var top = hd.top || (hd.logo ? 'logo' : 'text');
    var topText = String(hd.topText || '').trim() || [st.siteTitle || '13 MIRRORS', T('kicker')].filter(Boolean).join(' · ');
    var tType = typeCss('', hd.topWeight, hd.topItalic);
    var kicker = top === 'logo' ? '<h2 class="m13-logo-wrap m13-logo-wrap--' + (hd.topSize === 's' || hd.topSize === 'l' ? hd.topSize : 'm') + '">' + logoHTML(hd) + '</h2>'
      : top === 'none' ? '' : '<div class="m13-kicker"' + (tType.length ? ' style="' + tType.join(';') + '"' : '') + '><span class="m13-gt">' + txt(topText) + '</span></div>';
    var root = rootOpen(bg);

    var intro = opt(sc.intro), draft = sc.status === 'draft' ? '<span class="m13-draft">' + txt(T('draft') || 'черновик') + '</span>' : '';
    // Сетка уменьшается и на высоту строки «Условия и цены ✦ Конфиденциальность», чтобы всё помещалось в экран
    // «События и архив» и стрелки месяцев: под названием (как было) или внизу, у нижнего края (head.navPos = 'bottom', её решения 30.10;
    // head.navLift — поднять над краем, px)
    var navs = eventsLinkHTML(hd) + monthNavHTML(sc.id, hd), low = hd.navPos === 'bottom' && navs, lift = Math.max(0, Math.min(300, +hd.navLift || 0));
    var below = low ? '<div class="m13-below' + (hd.color ? ' m13-header--tinted' : '') + '" style="' + esc(hs.concat(lift ? ['--nav-lift:' + lift + 'px'] : []).join(';')) + '">' + navs + '</div>' : '';
    var legal = legalLineHTML(), foot = footHTML(hd, hs), fh = (foot ? footHeight(hd) : 0) + (legal ? (legalOf(st).footMode === 'full' ? 40 : 20) : 0) + (low ? 100 + lift : 0);
    var html = root + '<main class="m13-page' + (fh ? ' m13-page--foot' : '') + '"' + (fh ? ' style="--m13-fh:' + fh + 'px"' : '') + '>' +
      '<header class="' + hcls + '"' + (hs2.length ? ' style="' + esc(hs2.join(';')) + '"' : '') + '>' + kicker +
      (hd.hideTitle ? '<h1 class="m13-sr">' + txt(sc.title) + '</h1>' + (draft ? '<div>' + draft + '</div>' : '')
        : '<h1><span class="m13-gt">' + txt(sc.title) + '</span>' + draft + '</h1>') +
      (intro ? '<p class="m13-intro">' + txt(intro) + '</p>' : '') + (low ? '' : navs) + '</header>' +
      '<div class="m13-stage"><section class="m13-grid" aria-label="Карточки месяца">' +
      (sc.cards || []).slice(0, 9).map(thumbHTML).join('') +
      '</section></div>' + below + foot + legal + '</main>' +
      overlayHTML() + internalHTML() + zpModalHTML() + modalHTML() + calModalHTML() + lightboxHTML() + '<div class="m13-toast" id="m13-toast" role="status" aria-live="polite"></div></div>';
    S.root.innerHTML = html;
    bgWatch(S.root);

    S.root.querySelectorAll('.m13-thumb[data-card]').forEach(function (b) {
      b.addEventListener('click', function () { openCard(b.getAttribute('data-card')); });
    });
    // В предпросмотре панели окошко открывает сад в новой вкладке (панель не закрывается)
    if (S.onBack) S.root.querySelectorAll('[data-m13-okno]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); window.open(a.href, '_blank'); }); });
    oknoMount();
    // Нажатие на закрытую обложку раскрывает её сразу; на всякий случай все обложки раскрываются не позже чем через 10 с
    var lids = S.root.querySelectorAll('.m13-lid');
    lids.forEach(function (l) { l.addEventListener('click', function (e) { e.stopPropagation(); lidOpen(l); }); });
    if (lids.length) setTimeout(function () { lids.forEach(lidOpen); }, 10000);
    bindOverlay(); bindModal(); zpBind();
    // В предпросмотре панели логотип внизу не уводит со страницы
    var fl = S.root.querySelector('.m13-foot-logo');
    if (fl && S.onBack) fl.addEventListener('click', function (e) { e.preventDefault(); });
    wake(hd); legalLineBind();
    // В предпросмотре панели сайта ещё нет — открываем события поверх витрины
    var evl = S.root.querySelector('[data-m13-evlink]');
    if (evl && S.onBack) evl.addEventListener('click', function (e) { e.preventDefault(); openInternal('events'); });
    mnavBind();

    // Прямая ссылка на карточку: /2026-10/#sun
    var h = decodeURIComponent((location.hash || '').slice(1));
    if (h && !S.onBack && S.useHistory && findCard(h)) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      openCard(h);
    }
    // Вернулись со страницы оплаты ЮKassa (или есть неоплаченная запись) — окошко записи скажет, что с ней
    zpResume();
  }

  // Логотип (картинка-маска цветом надписей): свой у месяца (head.logoImg), общий (settings.logo) или обычный.
  // Берутся только очертания картинки, цвет — цветом надписей. logoRatio — ширина / высота картинки.
  function logoHTML(hd) {
    var st = S.D.settings || {}, own = hd && hd.logoImg;
    var u = own ? media(hd.logoImg) : st.logo ? media(st.logo) : S.base + 'assets/logo.png';
    var r = +(own ? hd.logoRatio : st.logo ? st.logoRatio : 0) || 2454 / 545;
    return '<span class="m13-logo" role="img" aria-label="' + esc(st.siteTitle || '13 MIRRORS') + '" style="' +
      esc("-webkit-mask-image:url('" + u + "');mask-image:url('" + u + "');--m13-lr:" + r.toFixed(3)) + '"></span>';
  }
  // Дымка под надписями над сеткой и под ней: тёмная (для светлых букв) или светлая, сила 0–100
  function hazeOf(kind, k, css) {
    if (kind !== 'dark' && kind !== 'light') return '';
    var v = k == null || k === '' || isNaN(+k) ? 60 : Math.max(0, Math.min(100, +k));
    css.push('--m13-hk:' + (v / 100).toFixed(2));
    return ' m13-hz m13-hz--' + kind;
  }
  // Звёздочка у подписи: искра, звезда или месяц — вспыхивает вместе с бликом
  var STAR_PATH = {
    spark: 'M12 0C12.9 7.6 16.4 11.1 24 12 16.4 12.9 12.9 16.4 12 24 11.1 16.4 7.6 12.9 0 12 7.6 11.1 11.1 7.6 12 0Z',
    star: 'M12 1.8l2.8 6.6 7.2.6-5.5 4.7 1.7 7-6.2-3.8-6.2 3.8 1.7-7L2 9l7.2-.6z',
    moon: 'M19.6 15.8A8.6 8.6 0 0 1 8.2 4.4a8.6 8.6 0 1 0 11.4 11.4z'
  };
  function starHTML(hd, side) {
    var k = STAR_PATH[hd.starKind] ? hd.starKind : 'spark';
    return '<i class="m13-fstar m13-fstar--' + side + ' m13-fstar--' + k + '" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="' + STAR_PATH[k] + '"/></svg></i>';
  }
  // Под сеткой: логотип (ссылка на главную 13mirrors.ru), надпись («Увидимся за поворотом») или оба; размер, положение, блик
  function footHTML(hd, hs) {
    var b = hd.bottom || 'none'; if (b === 'none') return '';
    var logo = b === 'logo' || b === 'both', text = b === 'text' || b === 'both';
    var al = hd.bottomAlign === 'left' || hd.bottomAlign === 'right' ? hd.bottomAlign : 'center';
    var size = hd.bottomSize === 'm' || hd.bottomSize === 'l' ? hd.bottomSize : 's';
    var css = hs.slice(), cs = S.D.showcase.cardStyle || {}, shine = hd.shine || hd.welcome !== false;
    if (shine) css.push('--m13-shine:' + (hd.shineColor || cs.rimRunColor || '#fff3cf'));
    if (hd.starColor) css.push('--m13-stc:' + hd.starColor);
    var hz = hazeOf(hd.bottomHaze, hd.bottomHazeK, css);
    // Надпись: своё положение (пусто — как у логотипа), толщина и курсив; звёздочки по краям
    var ta = hd.bottomTextAlign === 'left' || hd.bottomTextAlign === 'center' || hd.bottomTextAlign === 'right' ? hd.bottomTextAlign : '';
    var ty = typeCss(cs.font || '', hd.bottomWeight, hd.bottomItalic), star = text && hd.star ? hd.star : '';
    return '<footer class="m13-foot m13-foot--' + al + ' m13-foot--' + size + (hd.color ? ' m13-header--tinted' : '') + (shine ? ' m13-shine' : '') + hz + '"' +
      (css.length ? ' style="' + esc(css.join(';')) + '"' : '') + '>' +
      (logo ? '<a class="m13-foot-logo" href="' + esc(S.base + '../') + '" aria-label="13 MIRRORS — на главную">' + logoHTML(hd) + '</a>' : '') +
      (text ? '<div class="m13-foot-text' + (ta ? ' m13-al-' + ta : '') + '"' + (ty.length ? ' style="' + ty.join(';') + '"' : '') + '>' +
        (star === 'before' || star === 'both' ? starHTML(hd, 'b') : '') +
        '<span class="m13-gt">' + txt(String(hd.bottomText || '').trim() || 'Увидимся за поворотом') + '</span>' +
        (star === 'after' || star === 'both' ? starHTML(hd, 'a') : '') + '</div>' : '') + '</footer>';
  }
  /* ---------- Блики: приветственный при открытии и по подписи ----------
     Приветственный (head.welcome, по умолчанию включён): через ~0,7 с свет проходит по верхней строке и названию,
     затем волной по карточкам (слева сверху — вправо вниз), затем по подписи со звёздочками.
     Блик по подписи (head.shine): сначала при открытии (или когда подпись появится на экране), потом —
     head.shineWhen: '' изредка (раз в 25 с) | often (раз в 8 с) | open (только при открытии).
     head.shineSpeed — сколько идёт один проход: fast | normal | slow (по умолчанию) | vslow. */
  var SHINE_MS = { fast: 1400, normal: 2200, slow: 3400, vslow: 5000 }, SHINE_EVERY = { often: 8000, '': 25000 };
  function wakeStop() {
    (S.wakeT || []).forEach(clearTimeout); S.wakeT = []; if (S.wakeIO) { S.wakeIO.disconnect(); S.wakeIO = null; }
    if (S.root) S.root.classList.remove('m13-hold-run');
  }
  function wake(hd) {
    wakeStop();
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var root = S.root, head = root.querySelector('.m13-header'), foot = root.querySelector('.m13-foot');
    var ms = SHINE_MS[hd.shineSpeed] || SHINE_MS.slow, welcome = hd.welcome !== false;
    var stars = !!root.querySelector('.m13-foot .m13-fstar'), own = !!foot && (hd.shine || stars);
    function later(fn, t) { S.wakeT.push(setTimeout(fn, t)); }
    function pass(n) {
      if (!n || !n.isConnected) return;
      n.style.setProperty('--m13-shd', ms + 'ms');
      n.classList.remove('m13-shining'); void n.offsetWidth; n.classList.add('m13-shining');
      later(function () { n.classList.remove('m13-shining'); }, ms + 1400);
    }
    function seen(n) { var r = n.getBoundingClientRect(); return r.bottom > 0 && r.top < (window.innerHeight || 800); }
    // Подпись ниже экрана (телефон) — блик, когда до неё докрутят
    function whenSeen(n, fn) {
      if (seen(n) || !window.IntersectionObserver) { fn(); return; }
      S.wakeIO = new IntersectionObserver(function (es) {
        if (!es.some(function (e) { return e.isIntersecting; })) return;
        S.wakeIO.disconnect(); S.wakeIO = null; later(fn, 350);
      });
      S.wakeIO.observe(n);
    }
    function again() {
      var every = hd.shineWhen === 'open' ? 0 : SHINE_EVERY[hd.shineWhen === 'often' ? 'often' : ''];
      if (!every || !hd.shine && !stars) return;
      later(function () { if (!document.hidden && seen(foot)) pass(foot); again(); }, every);
    }
    if (welcome) {
      later(function () { pass(head); }, 700);
      later(function () { sheenCards(false); }, 1000);
      // Бегущий блик по контурам ждёт, пока пройдёт приветствие (надпись, волна по карточкам, подпись), потом плавно появляется
      root.classList.add('m13-hold-run');
      later(function () { root.classList.remove('m13-hold-run'); }, Math.max(3600, 2100 + ms));
    }
    if (foot && (welcome || own)) later(function () { whenSeen(foot, function () { pass(foot); again(); }); }, welcome ? 2100 : 1200);
    // Обложки карточек: без приветственного блика — своя волна только по ним
    if (!welcome && root.querySelector('.m13-lid')) later(function () { sheenCards(true); }, 600);
  }
  // Мягкий свет волной по карточкам: каждой — свой момент, по месту в сетке.
  // head.wave — откуда идёт волна: corner (из левого верхнего угла, по умолчанию) | top | bottom | left | right | center;
  // head.waveSpeed — как быстро перебегает (fast | normal | slow | vslow); head.sheenKind — вид блика: soft | silk (шёлк) | bunny (солнечный зайчик) | edge (свет по контуру) | ray | flash |
  // confetti (мелкое разноцветное конфетти сыплется сверху) | popper (хлопушка из середины карточки)
  // (27.10 (4); прежние dust и motes убраны по её слову — у таких месяцев идёт мягкая полоса).
  // onlyLids — только по карточкам с обложкой (когда приветственный блик выключен).
  var WAVE_SPREAD = { fast: 400, normal: 650, slow: 1000, vslow: 1500 }, WAVE_PASS = { fast: 1200, normal: 1600, slow: 2100, vslow: 2800 };
  var SHEEN_KINDS = { soft: 1, silk: 1, bunny: 1, edge: 1, ray: 1, flash: 1, confetti: 1, popper: 1 };
  // Конфетти (27.10 (5), её «разноцветные, мелкие, не пятна»): крошки на карточку — полоски и кружочки, свой цвет, путь и поворот у каждой.
  // head.confettiShape: '' смесь | round только кружочки | strip только полоски; head.confettiCount: few | mid или пусто (средне) | many | lots — сколько крошек;
  // head.confettiColor (27.10 (8)): '' нежные | bright яркие | gold золото | silver серебро-зеркало | pearl перламутр (металл и перламутр поблёскивают).
  // Падение и покачивание — две отдельные анимации (translate и transform): раньше падение шло двумя отрезками и замирало на середине
  var CONFETTI_MS = 2600, CONFETTI_N = { few: 18, many: 50, lots: 75 }, CONFETTI_C = {
    soft: ['#f4c95d', '#ef8fa8', '#7fd1c1', '#8fb8f2', '#c4a3f0', '#f59a6b', '#fff6dc'],
    bright: ['#ff2d55', '#ffb300', '#00d1a0', '#1f7bff', '#b042ff', '#ff6a00', '#ffe600', '#ff4fd8'],
    gold: ['linear-gradient(135deg,#fff6cf,#e8b84a 45%,#9b6a16)', 'linear-gradient(135deg,#ffe9a8,#c99232 55%,#7a4e0e)', 'linear-gradient(135deg,#fffbe8,#f0cf7a 50%,#b8862c)'],
    silver: ['linear-gradient(135deg,#ffffff,#c3ccd8 40%,#6f7c8d)', 'linear-gradient(135deg,#eef3fa,#9eabbd 50%,#535f6f)', 'linear-gradient(135deg,#ffffff,#d9e0ea 45%,#8793a3)'],
    pearl: ['linear-gradient(135deg,#ffb8dc,#a9e4ff 50%,#cdb6ff)', 'linear-gradient(135deg,#9ff0d4,#ffc2e0 50%,#b9c8ff)', 'linear-gradient(135deg,#ffe2a0,#d0b8ff 50%,#9fe6ff)', 'linear-gradient(135deg,#c8b4ff,#ffd0e8 50%,#a6f0e0)']
  };
  function confetti(n, kind, delay, h, hd) {
    var cnt = CONFETTI_N[hd.confettiCount] || 32, shape = hd.confettiShape, col = CONFETTI_C[hd.confettiColor] ? hd.confettiColor : 'soft', pal = CONFETTI_C[col];
    var shine = col === 'gold' || col === 'silver' || col === 'pearl';
    n.className += ' m13-cf--' + col;
    for (var i = 0; i < cnt; i++) {
      var b = document.createElement('b'), dot = shape === 'round' || shape !== 'strip' && i % 2 === 0, w = dot ? 3.5 + Math.random() * 1.5 : 2.5 + Math.random() * 2.5;
      b.style.width = w.toFixed(1) + 'px'; b.style.height = (dot ? w : w * (1.6 + Math.random() * 0.8)).toFixed(1) + 'px';
      if (dot) b.style.borderRadius = '50%';
      b.style.background = pal[i % pal.length];
      if (col === 'bright') b.style.boxShadow = '0 0 3px ' + pal[i % pal.length];
      b.style.setProperty('--r', Math.round((Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 200)) + 'deg');
      // Кружочек не кувыркается через ребро — иначе он то и дело становится чёрточкой и пропадает
      b.style.setProperty('--fx', dot ? '0deg' : Math.round(150 + Math.random() * 210) + 'deg');
      var flut = Math.round(700 + Math.random() * 600), gl = shine ? ', ' + Math.round(350 + Math.random() * 450) + 'ms' : '', del;
      if (kind === 'popper') {
        var a = (i / cnt) * 6.283 + Math.random() * 0.35, d = h * (0.22 + Math.random() * 0.24);
        b.style.setProperty('--dx', Math.round(Math.cos(a) * d) + 'px'); b.style.setProperty('--dy', Math.round(Math.sin(a) * d - h * 0.06) + 'px');
        b.style.setProperty('--fy', Math.round(h * (0.1 + Math.random() * 0.12)) + 'px');
        del = delay + Math.round(Math.random() * 90);
        b.style.animationDuration = '1900ms' + gl;
      } else {
        b.style.left = (3 + Math.random() * 94).toFixed(1) + '%';
        b.style.setProperty('--dx', Math.round(8 + Math.random() * 14) + 'px'); b.style.setProperty('--fy', Math.round(h + 16) + 'px');
        del = delay + Math.round(Math.random() * (500 + cnt * 12));
        b.style.animationDuration = Math.round(CONFETTI_MS * (0.75 + Math.random() * 0.25)) + 'ms, ' + flut + 'ms' + gl;
      }
      b.style.animationDelay = del + 'ms, ' + (del - Math.round(Math.random() * flut)) + 'ms' + (shine ? ', ' + del + 'ms' : '');
      n.appendChild(b);
    }
  }
  // Пробник для панели: конфетти по образцу (box — любой блок с position:relative), с настройками hd
  M13.confettiDemo = function (box, hd) {
    var kind = hd.sheenKind === 'popper' ? 'popper' : 'confetti', n = document.createElement('i');
    box.querySelectorAll('i.m13-sheen').forEach(function (x) { x.remove(); });
    n.className = 'm13-sheen m13-sheen--' + kind; n.setAttribute('aria-hidden', 'true');
    n.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    box.appendChild(n); confetti(n, kind, 0, box.getBoundingClientRect().height || 160, hd);
    setTimeout(function () { n.remove(); }, CONFETTI_MS + 1800);
  };
  function sheenCards(onlyLids) {
    var g = S.root.querySelector('.m13-grid'); if (!g) return;
    var hd = S.D.showcase.head || {}, col = hd.shineColor || (S.D.showcase.cardStyle || {}).rimRunColor || '#fff3cf';
    var kind = SHEEN_KINDS[hd.sheenKind] ? hd.sheenKind : 'soft', spread = WAVE_SPREAD[hd.waveSpeed] || WAVE_SPREAD.normal, run = WAVE_PASS[hd.waveSpeed] || WAVE_PASS.normal;
    var G = g.getBoundingClientRect(), w = hd.wave;
    var list = [].slice.call(g.querySelectorAll('.m13-thumb:not(.m13-thumb--empty)')).map(function (t) {
      var R = t.getBoundingClientRect(), x = (R.left + R.width / 2 - G.left) / Math.max(1, G.width), y = (R.top + R.height / 2 - G.top) / Math.max(1, G.height);
      var v = w === 'top' ? y : w === 'bottom' ? 1 - y : w === 'left' ? x : w === 'right' ? 1 - x
        : w === 'center' ? Math.sqrt((x - 0.5) * (x - 0.5) + (y - 0.5) * (y - 0.5)) : x + y;
      return { t: t, v: v, lid: t.parentNode.querySelector(':scope > .m13-lid') };
    });
    var vs = list.map(function (o) { return o.v; }), lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
    list.forEach(function (o) {
      if (onlyLids && !o.lid) return;
      var delay = Math.round((hi > lo ? (o.v - lo) / (hi - lo) : 0) * spread);
      var n = document.createElement('i'); n.className = 'm13-sheen' + (kind !== 'soft' ? ' m13-sheen--' + kind : ''); n.setAttribute('aria-hidden', 'true');
      n.style.animationDelay = delay + 'ms'; n.style.animationDuration = run + 'ms';
      n.style.setProperty('--m13-shine-c', col);
      var host = o.lid ? o.lid.querySelector('.m13-lid-leaf') : o.t;
      host.appendChild(n);
      var conf = kind === 'confetti' || kind === 'popper';
      if (conf) confetti(n, kind, delay, host.getBoundingClientRect().height || 200, hd);
      S.wakeT.push(setTimeout(function () { n.remove(); }, delay + (conf ? CONFETTI_MS + 1600 : run) + 200));
      // Обложка раскрывается, когда блик почти прошёл, и после паузы
      if (o.lid) S.wakeT.push(setTimeout(function () { lidOpen(o.lid); }, delay + Math.round(run * 0.7) + (+o.lid.getAttribute('data-pause') || 0)));
    });
  }

  /* ---------- Обложка карточки при открытии витрины ----------
     Для всего месяца: cardStyle.lid = {open: '' (без обложки) | 'book', …}; у карточки: front.style.lid = {mode: '' (как у всей витрины) | 'off' | 'own', …}
     (своя обложка — все настройки в том же объекте). Волна приветственного блика доходит до карточки → блик по обложке → пауза →
     обложка раскрывается и убирается; нажатие на закрытую обложку раскрывает её сразу. Каждый раз при открытии витрины;
     «меньше движения» в системе — обложек нет.
     Настройки: from left | right | top | bottom; speed fast | normal | slow | vslow; pause (секунды, 0–3); shadow soft | deep;
     mat glass | color | image | frost (запотевшее зеркало); color; glass — прозрачность 0–90 %; blur — размытие, px; image; frost — плотность инея 0–100;
     rim '' | light | cold | gold, rimColor; sign '' | text | spark | star | moon | dandelion | logo | image; text, signImg, font, signColor,
     signSize s | m | l, signPos center | top | bottom; signMirror — одуванчик на изгибе зеркально.
     open: book — раскрывается на корешке; flip — переворот карты: обложка — рубашка, карточка приподнимается и переворачивается лицом
     (from left | right — слева направо / справа налево, top | bottom — сверху вниз / снизу вверх).
     feel: soft (по умолчанию) — мягкая: книга изгибается, как тетрадный лист, карта чуть пружинит, как картон |
     leather — как толстая мягкая кожа: тяжёлый плавный изгиб ровной дугой, скруглённый край, матовый тёплый свет; карта переворачивается плавно, без пружины |
     hard — твёрдая, как переплёт.
     envelope — конверт (её «делаем» 27.10): на закрытой обложке линии клапанов, печать на кончике клапана; печать тает → клапан откидывается
     (видна изнанка) → конверт уходит. from — где клапан (top по умолчанию | bottom | left | right);
     flap sharp (острый, по умолчанию) | gentle (пологий) | round (скруглённый); go down (А — конверт уезжает и тает, по умолчанию) |
     out (Б — карточка выдвигается из конверта, конверт уходит) | unfold (В — раскладывается на четыре клапана);
     seal wax (сургуч: капля, в ней знак из sign; по умолчанию) | sign (просто знак на кончике клапана) | none (без печати — знак стоит, где signPos);
     wax — цвет сургуча (#960c0d); inner — цвет изнанки (обычно — цвет обложки чуть темнее). */
  var LID_OPEN = { book: 1, flip: 1, envelope: 1 }, LID_MS = { fast: 700, normal: 1000, slow: 1400, vslow: 2000 }, LID_FROM = { left: 1, right: 1, top: 1, bottom: 1 };
  function lidQuiet() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function lidOf(c) {
    if (!c || c.visible === false || lidQuiet()) return null;
    var d = ((S.D.showcase || {}).cardStyle || {}).lid || {}, f = (((c.front || {}).style) || {}).lid || {};
    var L = f.mode === 'own' ? f : f.mode === 'off' ? null : d;
    return L && LID_OPEN[L.open] ? L : null;
  }
  function lidNum(v, def, lo, hi) { v = v == null || v === '' || isNaN(+v) ? def : +v; return Math.max(lo, Math.min(hi, v)); }
  // Семейство одуванчиков: у всех 12 лучей через 30° (15°, 45°, …) и стебель; цвет — currentColor.
  // kind: 'logo' — из логотипа (клиновидные лучи, кисточки из трёх точек, толстый стебель с зазором);
  // 'line' — прямой (тонкие лучи, вилочка из трёх веточек, крупная серединка); 'wave' — то же на изгибе (mirror — зеркально).
  // Геометрия утверждена ею 30.09.2026 (эскизы — docs/dandelions.js).
  var DAND = {};
  // 'flower' — цветок без стебля: головка одуванчика из логотипа (те же 12 лучей и кисточки), квадратный значок.
  function dandSVG(kind, mirror) {
    kind = kind === 'line' || kind === 'wave' || kind === 'flower' ? kind : 'logo';
    var key = kind + (kind === 'wave' && mirror ? '-m' : '');
    if (DAND[key]) return DAND[key];
    function xy(x, y) { return x.toFixed(2) + ' ' + y.toFixed(2); }
    function dot(x, y, k) { return 'M' + xy(x - k, y) + 'a' + k + ' ' + k + ' 0 1 0 ' + 2 * k + ' 0a' + k + ' ' + k + ' 0 1 0 ' + -2 * k + ' 0'; }
    var w = '', t = '', d = '', i, a, sa, ca;
    if (kind === 'logo' || kind === 'flower') {
      for (i = 0; i < 12; i++) {
        a = (15 + 30 * i) * Math.PI / 180; sa = Math.sin(a); ca = Math.cos(a);
        var ex = 50 + sa * 34, ey = 42 - ca * 34;
        // клиновидный луч: у серединки шире, к концу уже
        w += 'M' + xy(50 + ca * 1.25, 42 + sa * 1.25) + 'L' + xy(ex + ca * 0.8, ey + sa * 0.8) + 'L' + xy(ex - ca * 0.8, ey - sa * 0.8) + 'L' + xy(50 - ca * 1.25, 42 - sa * 1.25) + 'Z';
        [[0, 3.4], [-0.95, 3.1], [0.95, 3.1]].forEach(function (q) {
          var qx = ex + Math.sin(a + q[0]) * q[1], qy = ey - Math.cos(a + q[0]) * q[1];
          t += 'M' + xy(ex, ey) + 'L' + xy(qx, qy); d += dot(qx, qy, 1.3);
        });
      }
      return (DAND[key] = '<svg viewBox="' + (kind === 'flower' ? '10 2 80 80' : '0 0 100 124') + '" aria-hidden="true"><path fill="currentColor" d="' + w + '"/>' +
        '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width=".8" d="' + t + '"/><path fill="currentColor" d="' + d + '"/>' +
        '<circle cx="50" cy="42" r="4.6" fill="currentColor"/>' + (kind === 'flower' ? '' : '<rect x="47" y="69" width="6" height="53" fill="currentColor"/>') + '</svg>');
    }
    var k = 1.5;
    for (i = 0; i < 12; i++) {
      a = (15 + 30 * i) * Math.PI / 180; sa = Math.sin(a); ca = Math.cos(a);
      var fx = 50 + sa * 24, fy = 40 - ca * 24;
      w += 'M' + xy(50 + sa * 3.2, 40 - ca * 3.2) + 'L' + xy(fx, fy);
      [[0, 9.6], [-0.45, 5.3], [0.45, 5.3]].forEach(function (q) {
        var qx = fx + Math.sin(a + q[0]) * q[1], qy = fy - Math.cos(a + q[0]) * q[1];
        t += 'M' + xy(fx, fy) + 'L' + xy(qx, qy); d += dot(qx, qy, 1.2 * k + 0.1);
      });
    }
    var stem = kind === 'wave' ? 'M50 43.2C50.9 56 51.2 66 49.4 80C47.6 93 47.3 102 48.4 109C49.2 113.5 50.3 116 51.8 118.2' : 'M50 43.2V118.2';
    return (DAND[key] = '<svg viewBox="0 0 100 122" aria-hidden="true"><g' + (key === 'wave-m' ? ' transform="matrix(-1 0 0 1 100 0)"' : '') + '>' +
      '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="' + 0.7 * k + '" d="' + w + '"/>' +
      '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="' + 0.55 * k + '" d="' + t + '"/>' +
      '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="' + 1.1 * k + '" d="' + stem + '"/>' +
      '<path fill="currentColor" d="' + d + '"/><circle cx="50" cy="40" r="' + (3.6 + 0.5 * (k - 1)) + '" fill="currentColor"/></g></svg>');
  }
  M13.dandSVG = dandSVG;
  // Значки-одуванчики на обложке: sign → вид одуванчика
  var DAND_SIGN = { dandelion: 'logo', dandelion2: 'line', dandelion3: 'wave' };
  // Надпись или значок на обложке
  function lidSignInner(L, ty) {
    var k = L.sign;
    if (k === 'text') {
      var tx = String(L.text || '').trim(); if (!tx) return '';
      if (L.font) { ensureFont(L.font); ty.push("font-family:'" + L.font + "',Georgia,serif"); }
      return '<span class="m13-lid-tx">' + txt(tx) + '</span>';
    }
    if (STAR_PATH[k]) return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR_PATH[k] + '"/></svg>';
    if (DAND_SIGN[k]) return dandSVG(DAND_SIGN[k], !!L.signMirror);
    if (k === 'logo') return logoHTML(S.D.showcase.head || {});
    if (k === 'image' && L.signImg) return '<img alt="" src="' + esc(media(L.signImg)) + '">';
    return '';
  }
  function lidSign(L, dark) {
    var ty = [], inner = lidSignInner(L, ty), k = L.sign;
    if (!inner) return '';
    ty.push('color:' + (L.signColor || (dark ? '#f3e6cc' : '#3b2f24')));
    var at = L.signPos === 'top' || L.signPos === 'bottom' ? L.signPos : 'center', sz = L.signSize === 's' || L.signSize === 'l' ? L.signSize : 'm';
    return '<div class="m13-lid-sign m13-lid-sign--' + (DAND_SIGN[k] ? 'dand' : k) + ' m13-lid-at-' + at + ' m13-lid-sz-' + sz + '" style="' + esc(ty.join(';')) + '">' + inner + '</div>';
  }

  /* Конверт: геометрия в долях (0–100) «как будто клапан сверху»: x — поперёк, d — вглубь от края с клапаном; envAt переводит в место на карточке.
     Отверстие конверта — треугольник от углов края с клапаном к середине; клапан — своей формы поверх. */
  var ENV_TIP = { sharp: 60, gentle: 38, round: 56 };
  function envAt(from, x, d) { return from === 'bottom' ? [x, 100 - d] : from === 'left' ? [d, x] : from === 'right' ? [100 - d, x] : [x, d]; }
  function envFlap(shape) {
    if (shape !== 'round') return [[0, 0], [100, 0], [50, ENV_TIP[shape] || 60]];
    var pts = [[0, 0], [100, 0]], i, t, u;
    // скруглённый: две кривые от углов к низу клапана
    for (i = 1; i <= 10; i++) { t = i / 10; u = 1 - t; pts.push([u * u * u * 100 + 3 * u * u * t * 100 + 3 * u * t * t * 80 + t * t * t * 50, 3 * u * u * t * 26 + 3 * u * t * t * 56 + t * t * t * 56]); }
    for (i = 1; i < 10; i++) { t = i / 10; u = 1 - t; pts.push([u * u * u * 50 + 3 * u * u * t * 20 + 3 * u * t * t * 0, u * u * u * 56 + 3 * u * u * t * 56 + 3 * u * t * t * 26]); }
    return pts;
  }
  function envPoly(from, pts, back) {
    return 'polygon(' + pts.map(function (p) { var q = envAt(from, p[0], back ? 100 - p[1] : p[1]); return q[0].toFixed(2) + '% ' + q[1].toFixed(2) + '%'; }).join(',') + ')';
  }
  function envInside(pts, x, y) {
    for (var i = 0, j = pts.length - 1, c = false; i < pts.length; j = i++) {
      if ((pts[i][1] > y) !== (pts[j][1] > y) && x < (pts[j][0] - pts[i][0]) * (y - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0]) c = !c;
    }
    return c;
  }
  // Линии на закрытом конверте: косые от углов к середине (под клапаном не видны) и край клапана
  function envLines(from, shape) {
    var F = envFlap(shape), out = [], k;
    function pt(p) { var q = envAt(from, p[0], p[1]); return q[0].toFixed(2) + ',' + q[1].toFixed(2); }
    [[0, 0], [100, 0], [0, 100], [100, 100]].forEach(function (a) {
      var run = [];
      for (k = 0; k <= 40; k++) {
        var p = [a[0] + (50 - a[0]) * k / 40, a[1] + (50 - a[1]) * k / 40];
        if (!envInside(F, p[0], p[1]) || (k === 0 && a[1] === 0)) run.push(p);
        else { if (run.length > 1) out.push(run); run = []; }
      }
      if (run.length > 1) out.push(run);
    });
    var edge = F.slice(1).concat([F[0]]);
    var lines = out.map(function (r) { return '<polyline points="' + r.map(pt).join(' ') + '"/>'; }).join('');
    return '<svg class="m13-env-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + lines +
      '<polyline class="m13-env-edge" points="' + edge.map(pt).join(' ') + '"/></svg>' +
      '<i class="m13-env-face" style="clip-path:' + envPoly(from, F) + '"></i>';
  }
  // Печать на кончике клапана: сургуч со знаком или просто знак
  function envSeal(L, from, shape) {
    var seal = L.seal === 'sign' || L.seal === 'none' ? L.seal : 'wax';
    if (seal === 'none') return '';
    var ty = [], inner = lidSignInner(L, ty), sz = L.signSize === 's' || L.signSize === 'l' ? L.signSize : 'm';
    if (seal === 'sign' && !inner) return '';
    var at = envAt(from, 50, (ENV_TIP[shape] || 60) - (seal === 'wax' ? 4 : 2));
    ty.push('left:' + at[0] + '%', 'top:' + at[1] + '%', 'color:' + (L.signColor || (seal === 'wax' ? '#f2d9a8' : '#3b2f24')));
    if (seal === 'wax') ty.push('--m13-wax:' + (L.wax || '#960c0d'));
    return '<div class="m13-env-seal m13-env-seal--' + seal + ' m13-env-k-' + (DAND_SIGN[L.sign] ? 'dand' : L.sign || 'none') + ' m13-lid-sz-' + sz + '" style="' + esc(ty.join(';')) + '">' +
      (seal === 'wax' ? '<i class="m13-env-drop"></i>' : '') + (inner ? '<span class="m13-env-mark">' + inner + '</span>' : '') + '</div>';
  }
  function lidHTML(c, L) {
    var st = cardStyle(c), from = LID_FROM[L.from] ? L.from : L.open === 'envelope' ? 'top' : 'left', mat = L.mat === 'color' || L.mat === 'frost' || (L.mat === 'image' && L.image) ? L.mat : 'glass';
    var col = L.color || (mat === 'frost' ? '#e4ebf1' : st.bg || '#f4efe6'), rgb = hexRgb(col), dark = mat === 'image' || (mat !== 'frost' && lum(rgb) < 128);
    var css = ['--m13-lid-ms:' + (LID_MS[L.speed] || LID_MS.normal) + 'ms', '--m13-ac:' + (st.accent || '#ecd3a3')], leaf = [];
    // Плотный цвет листа для мягкого изгиба (у стекла и инея — как они выглядят поверх карточки): размытие на изгибающихся полосках не работает
    var under = hexRgb(st.bg || '#ffffff'), k = mat === 'frost' ? 0.2 + lidNum(L.frost, 60, 0, 100) / 200 : mat === 'glass' ? 1 - lidNum(L.glass, 35, 0, 90) / 100 : 1;
    css.push('--m13-lid-solid:rgb(' + rgb.map(function (v, j) { return Math.round(v * k + under[j] * (1 - k)); }).join(',') + ')');
    if (mat === 'color') leaf.push('background-color:' + col);
    else if (mat === 'image') leaf.push("background:" + col + " url('" + media(L.image) + "') center/cover no-repeat");
    else if (mat === 'frost') css.push('--m13-fr:' + (lidNum(L.frost, 60, 0, 100) / 100).toFixed(2), '--m13-frc:' + rgb.join(','));
    else {
      var gl = lidNum(L.glass, 35, 0, 90), bl = lidNum(L.blur, 8, 0, 20);
      leaf.push('background-color:rgba(' + rgb.join(',') + ',' + (1 - gl / 100).toFixed(2) + ')', '--m13-lb:' + bl + 'px');
    }
    var rim = L.rim === 'light' || L.rim === 'cold' || L.rim === 'gold' ? '<i class="m13-lay m13-rim m13-rim--' + L.rim + '"' + (L.rimColor ? ' style="' + esc('--m13-rc:' + L.rimColor) + '"' : '') + '></i>' : '';
    var env = L.open === 'envelope', shape = ENV_TIP[L.flap] ? L.flap : 'sharp', sign = env && L.seal !== 'none' ? envSeal(L, from, shape) : lidSign(L, dark), data = '';
    if (env) {
      // изнанка клапанов — цвет обложки чуть темнее (или свой)
      css.push('--m13-env-in:' + (L.inner || 'rgb(' + rgb.map(function (v, j) { return Math.round((v * k + under[j] * (1 - k)) * 0.9); }).join(',') + ')'));
      data = ' data-flap="' + shape + '" data-go="' + (L.go === 'out' || L.go === 'unfold' ? L.go : 'down') + '"';
      sign = envLines(from, shape) + sign;
    }
    return '<div class="m13-lid m13-lid--' + L.open + ' m13-lid--' + from + (L.feel === 'hard' ? ' m13-lid--hard' : ' m13-lid--soft' + (L.feel === 'leather' ? ' m13-lid--leather' : '')) + (L.shadow === 'deep' ? ' m13-lid--deep' : '') +
      (env && dark ? ' m13-env-dark' : '') + '" aria-hidden="true"' + data + ' data-pause="' +
      Math.round(lidNum(L.pause, 0.5, 0, 3) * 1000) + '" style="' + esc(css.join(';')) + '"><i class="m13-lid-cast"></i>' +
      '<div class="m13-lid-leaf m13-lid-' + mat + '"' + (leaf.length ? ' style="' + esc(leaf.join(';')) + '"' : '') + '>' +
      (mat === 'frost' ? '<i class="m13-lid-fog"></i>' : '') + sign + rim + '<i class="m13-lid-shade"></i></div></div>';
  }
  function lidOpen(lid) {
    if (!lid || !lid.isConnected || lid.classList.contains('is-open')) return;
    var cell = lid.parentNode, ms = parseFloat(lid.style.getPropertyValue('--m13-lid-ms')) || 1000, cl = lid.classList, total = ms;
    if (cl.contains('m13-lid--flip')) total = Math.round(ms * (cl.contains('m13-lid--leather') ? 1.5 : 1.3));
    else if (cl.contains('m13-lid--envelope')) total = lidEnvelope(lid, ms);
    else if (cl.contains('m13-lid--soft')) total = lidBend(lid, ms);
    // скорость — и для самой карточки (у переворота она поворачивается вместе с рубашкой; переменная стоит на обложке и до неё не доходит)
    cell.style.setProperty('--m13-lid-ms', ms + 'ms');
    cell.classList.add('m13-lid-going'); cl.add('is-open');
    setTimeout(function () { lid.remove(); cell.classList.remove('m13-lid-going', 'm13-lidcell--flip'); cell.style.removeProperty('--m13-lid-ms'); }, total + 80);
  }
  // Мягкая обложка, как тетрадный лист: лист режется на полоски вдоль корешка; лист поворачивается целиком, а чем дальше полоска
  // от корешка, тем больше она опережает — край идёт чуть впереди, лист выгибается наружу (как перелистываемая страница);
  // по изгибу бегут свет и тень; в конце край чуть «доплывает». Каждая полоска показывает свой
  // кусочек той же обложки (надпись, стекло, иней — без швов). Возвращает, сколько длится раскрытие (мс).
  // Кожа (m13-lid--leather): полосок больше, лист тяжелее — трогается и ложится плавнее, изгибается ровной дугой (без заострения к краю),
  // в конце край мягко «доплывает» дольше; свет на изгибе широкий, тёплый и матовый, тень чуть глубже.
  var BEND = {
    soft: { n: 12, lead: 34, pw: 1.4, P: 0.88, set: 7, setLen: 0.22, fade: 0.62, fadeLen: 0.45, end: 1.1, hl: 0.26, hlC: '255,255,255', shK: 1, lap: 0.8 },
    leather: { n: 20, lead: 44, pw: 1, P: 1, set: 9, setLen: 0.32, fade: 0.8, fadeLen: 0.52, end: 1.32, hl: 0.15, hlC: '255,238,212', shK: 1.15, lap: 1.2 }
  };
  function lidBend(lid, ms) {
    var leaf = lid.querySelector('.m13-lid-leaf'), W = lid.offsetWidth, H = lid.offsetHeight;
    if (!leaf || !W || !H || !window.requestAnimationFrame) return ms;
    var cl = lid.classList, from = cl.contains('m13-lid--right') ? 'right' : cl.contains('m13-lid--top') ? 'top' : cl.contains('m13-lid--bottom') ? 'bottom' : 'left';
    var B = cl.contains('m13-lid--leather') ? BEND.leather : BEND.soft;
    var vert = from === 'top' || from === 'bottom', near = from === 'left' || from === 'top', len = vert ? H : W, n = B.n, w = len / n;
    var deep = (cl.contains('m13-lid--deep') ? 0.75 : 0.5) * B.shK, box = document.createElement('div'), list = [], i;
    // Стекло и иней: размытие у повёрнутых полосок не работает, поэтому лист на время изгиба плотный — тем цветом,
    // каким обложка видится поверх карточки; настоящая обложка тает поверх полосок в первые мгновения
    var cs = getComputedStyle(leaf), clear = (cs.backdropFilter || cs.webkitBackdropFilter || 'none') !== 'none', solid = lid.style.getPropertyValue('--m13-lid-solid');
    box.className = 'm13-lid-bend';
    for (i = 0; i < n; i++) {
      // полоски чуть заходят одна на другую, чтобы между ними не светились щёлки
      var sz = w + (i < n - 1 ? B.lap : 0), at = near ? 0 : len - sz, off = near ? -i * w : -(len - sz - i * w);
      var st = document.createElement('div'), pc = leaf.cloneNode(true), sh = document.createElement('i'), hl = document.createElement('i');
      st.className = 'm13-lid-strip'; sh.className = 'm13-lid-sh'; hl.className = 'm13-lid-hl';
      st.style.cssText = vert ? 'left:0;top:' + at + 'px;width:' + W + 'px;height:' + sz + 'px' : 'top:0;left:' + at + 'px;height:' + H + 'px;width:' + sz + 'px';
      st.style.transformOrigin = { left: '0 50%', right: '100% 50%', top: '50% 0', bottom: '50% 100%' }[from];
      pc.classList.remove('m13-lid-leaf'); pc.classList.add('m13-lid-pc');
      pc.querySelectorAll('.m13-sheen,.m13-lid-shade').forEach(function (x) { x.remove(); });
      pc.style.width = W + 'px'; pc.style.height = H + 'px'; pc.style[vert ? 'top' : 'left'] = off + 'px';
      if (clear) { pc.style.backdropFilter = pc.style.webkitBackdropFilter = 'none'; if (solid) pc.style.backgroundColor = solid; if (pc.classList.contains('m13-lid-frost')) pc.style.backgroundImage = 'none'; }
      st.appendChild(pc); st.appendChild(sh); st.appendChild(hl); box.appendChild(st);
      list.push({ st: st, sh: sh, hl: hl });
    }
    // Полоски — поверх обложки; у стекла и инея они проявляются за первые мгновения (плавный переход), потом обложка прячется
    lid.insertBefore(box, leaf.nextSibling);
    if (!clear) leaf.style.visibility = 'hidden'; else box.style.opacity = '0';
    // кожа тяжелее: трогается и ложится плавнее (кривая четвёртой степени вместо третьей)
    function ease(p) { return B === BEND.leather ? (p < 0.5 ? 8 * Math.pow(p, 4) : 1 - Math.pow(-2 * p + 2, 4) / 2) : p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
    function cut(x) { return Math.max(0, Math.min(1, x)); }
    var t0 = 0, END = B.end, PHI = 172, dir = { left: 90, right: 270, top: 180, bottom: 0 }[from];
    function frame(now) {
      if (!box.isConnected) return;
      if (!t0) t0 = now;
      var t = (now - t0) / ms, X = 0, Z = 0, sh = [], bend = [];
      list.forEach(function (o, k) {
        var u = k / (n - 1), p = cut(t / B.P);
        var phi = PHI * ease(p) + B.lead * Math.pow(u, B.pw) * Math.sin(Math.PI * p) + B.set * u * u * Math.sin(Math.PI * cut((t - B.P) / B.setLen));
        var r = phi * Math.PI / 180, tr;
        if (from === 'left') tr = 'translate3d(' + X.toFixed(2) + 'px,0,' + Z.toFixed(2) + 'px) rotateY(' + (-phi).toFixed(2) + 'deg)';
        else if (from === 'right') tr = 'translate3d(' + (-X).toFixed(2) + 'px,0,' + Z.toFixed(2) + 'px) rotateY(' + phi.toFixed(2) + 'deg)';
        else if (from === 'top') tr = 'translate3d(0,' + X.toFixed(2) + 'px,' + Z.toFixed(2) + 'px) rotateX(' + phi.toFixed(2) + 'deg)';
        else tr = 'translate3d(0,' + (-X).toFixed(2) + 'px,' + Z.toFixed(2) + 'px) rotateX(' + (-phi).toFixed(2) + 'deg)';
        o.st.style.transform = tr;
        X += w * Math.cos(r); Z += w * Math.sin(r);
        // свет спереди и чуть со стороны края: чем круче полоска к нам, тем темнее
        sh.push(Math.max(0, 0.954 - Math.abs(0.954 * Math.cos(r) - 0.3 * Math.sin(r))) * deep);
        bend.push(phi);
      });
      // тень плавно перетекает от полоски к полоске (без ступенек); на самом изгибе — светлый блик
      // блик — там, где лист круче всего изгибается (разница углов соседних полосок)
      // (разница пересчитана на ширину полоски, чтобы при 12 и 20 полосках блик был одинаковой силы)
      var hl = bend.map(function (v, k) { return k ? Math.min(B.hl, Math.abs(v - bend[k - 1]) * (n - 1) / 396) : 0; });
      function grad(arr, k, c) {
        var a0 = (arr[k] + arr[Math.max(0, k - 1)]) / 2, a1 = (arr[k] + arr[Math.min(n - 1, k + 1)]) / 2;
        return 'linear-gradient(' + dir + 'deg,rgba(' + c + ',' + a0.toFixed(3) + '),rgba(' + c + ',' + arr[k].toFixed(3) + '),rgba(' + c + ',' + a1.toFixed(3) + '))';
      }
      list.forEach(function (o, k) { o.sh.style.background = grad(sh, k, '0,0,0'); o.hl.style.background = grad(hl, k, B.hlC); });
      var fade = 1 - cut((t - B.fade) / B.fadeLen);
      box.style.opacity = (clear ? Math.min(fade, cut(t / 0.12)) : fade).toFixed(3);
      if (clear && t > 0.12) leaf.style.visibility = 'hidden';
      if (t < END) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return Math.round(ms * END);
  }
  /* Конверт раскрывается (всё — по кадрам, время в долях скорости ms):
     печать тает (CSS) → клапан откидывается, с изнанкой и тенью (мягкий в конце чуть «доплывает») → дальше по data-go:
     down — конверт уезжает от клапана и тает; out — карточка выдвигается из конверта в сторону клапана (клапан уходит назад, за неё),
     конверт уезжает, карточка садится на место; unfold — три других клапана раскладываются наружу, потом всё тает.
     Стекло и иней: у повёрнутых кусков размытие не работает — они плотные, тем цветом, каким обложка видится поверх карточки. */
  function lidEnvelope(lid, ms) {
    var leaf = lid.querySelector('.m13-lid-leaf'), cell = lid.parentNode, card = cell.querySelector(':scope > .m13-thumb') || cell.firstElementChild;
    if (!leaf || !lid.offsetWidth || !window.requestAnimationFrame) return ms;
    var cl = lid.classList, from = cl.contains('m13-lid--right') ? 'right' : cl.contains('m13-lid--left') ? 'left' : cl.contains('m13-lid--bottom') ? 'bottom' : 'top';
    var shape = lid.getAttribute('data-flap') || 'sharp', go = lid.getAttribute('data-go') || 'down';
    var feel = cl.contains('m13-lid--hard') ? 'hard' : cl.contains('m13-lid--leather') ? 'leather' : 'soft', K = feel === 'leather' ? 1.25 : 1;
    var deep = cl.contains('m13-lid--deep') ? 0.5 : 0.32;
    var cs = getComputedStyle(leaf), clear = (cs.backdropFilter || cs.webkitBackdropFilter || 'none') !== 'none', solid = lid.style.getPropertyValue('--m13-lid-solid');
    var inner = lid.style.getPropertyValue('--m13-env-in') || solid, box = document.createElement('div');
    box.className = 'm13-env-box'; lid.insertBefore(box, leaf); box.appendChild(leaf);
    var ROT = { top: ['X', 1, '50% 0'], bottom: ['X', -1, '50% 100%'], left: ['Y', -1, '0 50%'], right: ['Y', 1, '100% 50%'] };
    // Клапан (или кусок конверта): лицо — тот же материал, изнанка — цвет изнанки; поворачивается на своём крае
    function piece(side, pts) {
      var w = document.createElement('div'), f = document.createElement('div'), b = document.createElement('div'), fs = document.createElement('i'), bs = document.createElement('i');
      w.className = 'm13-env-pc'; w.style.transformOrigin = ROT[side][2];
      f.className = leaf.className.replace('m13-lid-leaf', 'm13-env-mat'); f.style.cssText = leaf.style.cssText;
      if (clear) { f.style.backdropFilter = f.style.webkitBackdropFilter = 'none'; if (solid) f.style.backgroundColor = solid; f.style.backgroundImage = 'none'; }
      f.style.clipPath = f.style.webkitClipPath = envPoly(side, pts);
      b.className = 'm13-env-back'; b.style.background = inner; b.style.clipPath = b.style.webkitClipPath = envPoly(side, pts, true);
      b.style.transform = 'rotate' + ROT[side][0] + '(180deg)';
      fs.className = bs.className = 'm13-env-sh'; f.appendChild(fs); b.appendChild(bs); w.appendChild(f); w.appendChild(b);
      return { w: w, f: fs, b: bs, side: side };
    }
    function turn(o, a, sq) {
      var r = ROT[o.side], s = Math.abs(Math.sin(a * Math.PI / 180));
      o.w.style.transform = 'rotate' + r[0] + '(' + (r[1] * a).toFixed(2) + 'deg)' + (sq ? ' scale' + (r[0] === 'X' ? 'Y' : 'X') + '(' + sq.toFixed(3) + ')' : '');
      o.f.style.opacity = (s * deep).toFixed(3); o.b.style.opacity = (s * deep * 0.9).toFixed(3);
    }
    var flap = piece(from, envFlap(shape)), pcs = [];
    box.appendChild(flap.w); flap.w.style.opacity = '0';
    // остальные три клапана (для «раскладывается»): сначала соседние, потом напротив
    var SIDES = ['top', 'right', 'bottom', 'left'], fi = SIDES.indexOf(from);
    if (go === 'unfold') [1, 3, 2].forEach(function (k, j) { var o = piece(SIDES[(fi + k) % 4], [[0, 0], [100, 0], [50, 50]]); o.at = j < 2 ? 0.6 : 0.8; o.w.style.opacity = '0'; box.appendChild(o.w); pcs.push(o); });
    var away = { top: [0, 1], bottom: [0, -1], left: [1, 0], right: [-1, 0] }[from], W = lid.offsetWidth, H = lid.offsetHeight;
    var pocket = envPoly(from, [[0, 0], [50, 50], [100, 0], [100, 100], [0, 100]]), back = null;
    function cut(x) { return Math.max(0, Math.min(1, x)); }
    function io(p) { return feel === 'leather' ? (p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2) : p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
    function slide(el, p, k) { el.style.transform = 'translate(' + (away[0] * W * k * p).toFixed(1) + 'px,' + (away[1] * H * k * p).toFixed(1) + 'px)'; }
    var END = go === 'out' ? 2.1 : go === 'unfold' ? 1.75 : 1.6, t0 = 0, cardT = card.style.transform;
    function done() { if (back) back.remove(); if (go === 'out') card.style.transform = cardT; }
    function frame(now) {
      if (!box.isConnected) { done(); return; }
      if (!t0) t0 = now;
      var t = (now - t0) / ms / K;
      // клапан: 0,18–0,88; мягкий в конце чуть перелетает и возвращается
      var p = cut((t - 0.18) / 0.7), a = 180 * io(p) + (feel === 'soft' ? 9 * Math.sin(Math.PI * cut((p - 0.7) / 0.3)) : 0);
      if (t > 0.18) {
        flap.w.style.opacity = clear ? cut((t - 0.18) / 0.05).toFixed(3) : '1';
        if (t > 0.21 && !leaf.style.clipPath) leaf.style.clipPath = leaf.style.webkitClipPath = pocket;
      }
      turn(flap, a, feel === 'soft' ? 1 - 0.07 * Math.sin(Math.PI * p) : 0);
      if (go === 'down') {
        var q = io(cut((t - 0.85) / 0.7));
        slide(box, q, 0.7); box.style.opacity = (1 - Math.pow(q, 1.4)).toFixed(3);
      } else if (go === 'out') {
        // клапан лёг — уходит назад, за карточку (иначе карточка выедет из-под него)
        if (p >= 1 && !back) {
          back = document.createElement('div'); back.className = 'm13-env-behind';
          back.style.perspective = getComputedStyle(lid).perspective;
          back.appendChild(flap.w); cell.insertBefore(back, cell.firstChild);
        }
        var up = io(cut((t - 0.9) / 0.5)) * (1 - io(cut((t - 1.45) / 0.6))), q2 = io(cut((t - 1.35) / 0.6));
        card.style.transform = 'translate(' + (-away[0] * W * 0.36 * up).toFixed(1) + 'px,' + (-away[1] * H * 0.36 * up).toFixed(1) + 'px) scale(' + (1 + 0.02 * up).toFixed(4) + ')';
        slide(box, q2, 0.7); box.style.opacity = (1 - Math.pow(q2, 1.4)).toFixed(3);
        if (back) { slide(back, q2, 0.7); back.style.opacity = (1 - q2).toFixed(3); }
      } else {
        pcs.forEach(function (o) {
          var r = cut((t - o.at) / 0.6);
          if (t > 0.55) o.w.style.opacity = clear ? cut((t - 0.55) / 0.05).toFixed(3) : '1';
          turn(o, 180 * io(r) + (feel === 'soft' ? 7 * Math.sin(Math.PI * cut((r - 0.7) / 0.3)) : 0), 0);
        });
        if (t > (clear ? 0.6 : 0.56)) leaf.style.visibility = 'hidden';
        box.style.opacity = (1 - io(cut((t - 1.25) / 0.45))).toFixed(3);
      }
      if (t < END) requestAnimationFrame(frame);
      else done();
    }
    requestAnimationFrame(frame);
    return Math.round(ms * K * END);
  }
  // Карточка с обложкой: обложка стоит над карточкой в общей обёртке (m13-cell), чтобы при раскрытии выходить за её край
  function withLid(c, html) {
    var L = lidOf(c); if (!L || !html) return html;
    var lid = lidHTML(c, L), cls = 'm13-lidcell' + (L.open === 'flip' ? ' m13-lidcell--flip m13-flip--' + (LID_FROM[L.from] ? L.from : 'left') + (L.feel === 'hard' ? '' : L.feel === 'leather' ? ' m13-flip-leather' : ' m13-flip-soft') : '');
    if (html.indexOf('<div class="m13-cell ') === 0) return html.replace('<div class="m13-cell ', '<div class="m13-cell ' + cls + ' ').replace(/<\/div>$/, lid + '</div>');
    return '<div class="m13-cell ' + cls + '">' + html + lid + '</div>';
  }
  M13.wake = function () { if (S.D && S.D.showcase && S.root.querySelector('.m13-grid')) wake(S.D.showcase.head || {}); };

  // Сколько места нужно подписи внизу — на столько уменьшается сетка на компьютере
  function footHeight(hd) {
    var b = hd.bottom, h = 18;
    if (b === 'logo' || b === 'both') h += { s: 30, m: 50, l: 70 }[hd.bottomSize] || 30;
    if (b === 'text' || b === 'both') h += 29;
    return h;
  }

  function findCard(id) {
    return (S.D.showcase.cards || []).filter(function (c) {
      return c.id === id && c.visible !== false && (isCalCard(c) || (c.interactive !== false && c.back && c.back.type !== 'static'));
    })[0] || null;
  }


  /* ---------- Оформление карточки: шрифт, цвет текста, дымка на картинке, свечение ---------- */
  // Шрифты лежат на самом сайте (assets/fonts/<имя>.css + .woff2, копии с Google Fonts) — к Google браузер не обращается.
  // Браузер скачивает только те начертания и буквы, что реально есть на странице, поэтому курсив и тонкие подключены сразу
  var FONTS = {
    'Cormorant Garamond': 'cormorant-garamond', 'Playfair Display': 'playfair-display', 'Philosopher': 'philosopher', 'Lora': 'lora',
    'Montserrat': 'montserrat', 'Comfortaa': 'comfortaa', 'Marck Script': 'marck-script'
  };
  // Папка шрифтов — рядом с этим файлом (страницы витрины, маршрута и панель лежат на разной глубине)
  var FONT_DIR = (function () {
    var sc = document.currentScript, src = sc && sc.src;
    if (!src) { var all = document.getElementsByTagName('script'); for (var i = 0; i < all.length; i++) if (/assets\/vitrina\.js/.test(all[i].src)) src = all[i].src; }
    return src ? src.replace(/vitrina\.js(\?.*)?$/, 'fonts/') : 'assets/fonts/';
  })();
  M13.FONTS = Object.keys(FONTS);
  // Что умеет шрифт: толщины (300 тонкая, 400 обычная, 600 полужирная, 700 жирная) и курсив. Пусто (обычный шрифт устройства) — всё.
  M13.FONT_CAPS = {
    'Cormorant Garamond': { w: [300, 400, 600, 700], it: true }, 'Playfair Display': { w: [400, 600, 700], it: true },
    'Philosopher': { w: [400, 700], it: true }, 'Lora': { w: [400, 600, 700], it: true }, 'Montserrat': { w: [300, 400, 600, 700], it: true },
    'Comfortaa': { w: [300, 400, 600, 700], it: false }, 'Marck Script': { w: [400], it: false }
  };
  M13.fontCaps = function (name) { return M13.FONT_CAPS[name] || { w: [300, 400, 600, 700], it: true }; };
  // Толщина и курсив надписи: только то, что есть у шрифта (иначе браузер «подделает» — выйдет грубо)
  var FW = { light: 300, normal: 400, semi: 600, bold: 700 };
  function typeCss(font, w, it) {
    var caps = M13.fontCaps(font), out = [];
    if (FW[w] && caps.w.indexOf(FW[w]) >= 0) out.push('font-weight:' + FW[w]);
    if (it && caps.it) out.push('font-style:italic');
    return out;
  }
  var fontsLoaded = {};
  function ensureFont(name) {
    if (!name || !FONTS[name] || fontsLoaded[name]) return;
    fontsLoaded[name] = true;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = FONT_DIR + FONTS[name] + '.css';
    document.head.appendChild(l);
  }
  M13.ensureFont = ensureFont;
  /* ---------- Метка по датам: «до / идёт / после» ----------
     front.phase = {on, from?, to?, before{value,show}, during{…}, after{…}, glow}.
     Даты — свои (from/to) или, если пусто, даты маршрута карточки. */
  function phaseOf(c) {
    var ph = (c && c.front && c.front.phase) || null;
    if (!ph || !ph.on) return null;
    var r = c.back && c.back.routeId ? routeById(c.back.routeId) : null, rd = (r && r.dates) || {};
    var from = parseDate(ph.from || rd.from), to = parseDate(ph.to || rd.to);
    if (!from || !to) return null;
    var now = today(), key = now < from ? 'before' : now > to ? 'after' : 'during';
    var sk = 'status' + key.charAt(0).toUpperCase() + key.slice(1);
    return { key: key, label: opt(ph[key]), glow: key === 'during' && !!ph.glow, status: ph.statusAuto ? opt(ph[sk]) : '' };
  }
  M13.phaseOf = function (c, data) { var keep = S.D; if (data) S.D = data; try { return phaseOf(c); } finally { S.D = keep; } };

  /* ---------- Ближайшее событие на лицевой стороне (её решение 20.10.2026) ----------
     front.ev = {on, src: 'all' | тип события (meeting, meditation…) | 'pick', ids: [id событий для 'pick'], look: 'melt' (картинка тает) | 'frost' (матовое стекло с прорезью),
       h: высота «тает», % карточки (25–85, обычно 60), at: где прорезь у стекла, % сверху (15–70, обычно 48), y: какая часть картинки видна, % сверху (0–100, обычно 50),
       cap: '' (дата и название) | 'date' | 'none'}.
     Событие — из раздела «События»: видимое, с главной картинкой, ещё не закончилось (как во вкладке «Скоро»), ближайшее по дате.
     Прошло — само встаёт следующее; больше нет — карточка как была. Нажатие — как у карточки (увеличивается, потом оборот). */
  function evNear(c) {
    var o = c && c.front && c.front.ev;
    if (!o || !o.on || !(S.D.events || {}).items) return null;
    var src = o.src || 'all', ids = o.ids || [];
    return evList('soon').filter(function (e) {
      return e.cover && (src === 'all' || (src === 'pick' ? ids.indexOf(e.id) >= 0 : e.type === src));
    })[0] || null;
  }
  M13.evNear = function (c, data) { var keep = S.D; if (data) S.D = data; try { return evNear(c); } finally { S.D = keep; } };
  function evPeekHTML(c) {
    var e = evNear(c); if (!e) return '';
    var o = c.front.ev, frost = o.look === 'frost';
    function n(v, d, a, b) { v = parseFloat(v); return Math.max(a, Math.min(b, isNaN(v) ? d : v)); }
    var cap = o.cap === 'none' ? '' : o.cap === 'date' ? evDate(e) : [evDate(e), e.title].filter(Boolean).join(' · ');
    var css = "--m13-evi:url('" + media(e.cover) + "');--m13-evy:" + n(o.y, 50, 0, 100) + '%;' +
      (frost ? '--m13-eva:' + n(o.at, 48, 15, 70) + '%' : '--m13-evh:' + n(o.h, 60, 25, 85) + '%');
    return '<i class="m13-lay m13-evp m13-evp--' + (frost ? 'frost' : 'melt') + '" style="' + esc(css) + '">' +
      (frost ? '<i class="m13-evp-blur"></i><i class="m13-evp-slit"></i><i class="m13-evp-line"></i>' : '<i class="m13-evp-img"></i>') +
      (cap ? '<b class="m13-evp-cap">' + txt(cap) + '</b>' : '') + '</i>';
  }

  function statusOf(c) {
    var f = (c && c.front) || {}, ph = phaseOf(c);
    return (ph && ph.status) || opt(f.status);
  }
  function statusHTML(c, cls) {
    var st = statusOf(c); if (!st) return '';
    var pill = ((c.front || {}).statusStyle === 'pill');
    return '<div class="' + cls + (pill ? ' m13-status-pill' : '') + '">' + (pill ? '<span>' + txt(st) + '</span>' : txt(st)) + '</div>';
  }
  /* ---------- Увеличенная карточка маршрута: карта сегодняшнего дня и финальный ролик (её решение 04.10.2026) ----------
     Пока маршрут идёт и у него есть страница по дням (journeys, тот же routeId) — на лицевой стороне увеличенной карточки
     карта сегодняшнего дня, как её видит Наблюдение на странице маршрута (те же блоки и выключатели; день — как на странице маршрута, routeToday).
     После последнего дня — финальный ролик маршрута (routes[].finalVideo): играет сам при каждом открытии, ближе к концу
     проявляются надписи (finalText1/2) и логотип (finalLogo). У карточки можно выключить: front.dayShow / front.finalShow = false. */
  var MON_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function mskToday() {
    if (window.M13_TODAY) return parseDate(window.M13_TODAY);
    var n = new Date(Date.now() + 3 * 3600e3); return new Date(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  }
  /* День маршрута — как его считает страница маршрута (06.10, двери v2): у маршрутов с дверями (или «по часовому поясу участника») —
     по поясу, который страница маршрута запомнила на этом устройстве (m13ys-tz-…; только читаем, никуда не отправляется), нет его — по часам устройства;
     у спирали — по Москве, как было. */
  function routeToday(j) {
    var c = j && j.dayClock;
    if (window.M13_TODAY || !j || !(c === 'local' || (!c && j.scene === 'doors'))) return mskToday();
    var z = null, t = new Date(), P = {};
    try { z = JSON.parse(localStorage.getItem('m13ys-tz-' + j.id + '-' + (j.start || '')) || 'null'); } catch (e) {}
    if (z && z.tz) try {
      new Intl.DateTimeFormat('en-US', { timeZone: z.tz, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(t).forEach(function (x) { P[x.type] = +x.value; });
      if (P.year && P.month && P.day) return new Date(P.year, P.month - 1, P.day);
    } catch (e) {}
    if (z && z.off === +z.off) { var u = new Date(t.getTime() - z.off * 60e3); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()); }
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }
  function journeyOf(rid) {
    return (((S.D.journeys || {}).items) || []).filter(function (j) { return j && j.routeId === rid && (j.days || []).length; })[0] || null;
  }
  /* Живая обложка (двери v2, заход «б», 06.10): у маршрута со сценой «Двери» и включённой обложкой (journeys[].doors.cover.on, у карточки front.coverShow) —
     до начала, пока идёт (если карта дня на карточке выключена — front.dayShow) и после конца (если нет финального ролика) на лицевой стороне
     увеличенной карточки — сцена маршрута или своя картинка, мировые слои состоявшихся дней и жест сегодняшнего дня. */
  function coverOf(c, j, now) {
    var f = (c && c.front) || {}, D = (j && j.scene === 'doors' && j.doors) || null, C = (D && D.cover) || {};
    if (!D || C.on === false || f.coverShow === false || !(C.desktop || C.mobile || D.desktop || D.mobile)) return null;
    var from = parseDate(j.start), n = from ? Math.round((now - from) / 864e5) + 1 : 0;
    return { kind: 'cover', j: j, n: Math.max(0, Math.min(j.days.length + 1, n)) };
  }
  function liveOf(c) {
    var f = (c && c.front) || {}, rid = c && c.back && c.back.routeId, r = rid ? routeById(rid) : null;
    if (!r) return null;
    var j0 = journeyOf(rid), now = routeToday(j0), to = parseDate((r.dates || {}).to), cv = coverOf(c, j0, now);
    if (to && now > to) return f.finalShow !== false && r.finalVideo ? { kind: 'final', r: r } : cv;
    var j = f.dayShow !== false ? j0 : null, from = j && parseDate(j.start);
    if (!from) return cv;
    var n = Math.round((now - from) / 864e5) + 1;
    return n >= 1 && n <= j.days.length ? { kind: 'day', r: r, j: j, n: n } : cv;
  }
  // Сцена «Двери» — отдельные файлы (assets/doors.js, doors.css); витрина грузит их, только когда открыли карточку с живой обложкой
  var VV = ((document.currentScript && /[?&]v=([^&#]+)/.exec(document.currentScript.src)) || [])[1] || '';
  function needDoors(done) {
    if (window.M13D) { done(); return; }
    if (S.doorsQ) { S.doorsQ.push(done); return; }
    S.doorsQ = [done];
    var left = 2, base = S.base + 'assets/doors.', v = VV ? '?v=' + VV : '';
    function one() { if (--left) return; var q = S.doorsQ; S.doorsQ = null; if (window.M13D) q.forEach(function (f) { f(); }); }
    var ln = document.createElement('link'); ln.rel = 'stylesheet'; ln.href = base + 'css' + v; ln.onload = ln.onerror = one;
    var sc = document.createElement('script'); sc.src = base + 'js' + v; sc.onload = sc.onerror = one;
    document.head.appendChild(ln); document.head.appendChild(sc);
  }
  // Что человек выбрал и куда входил — то, что страница маршрута запомнила на этом устройстве (только читаем; никуда не отправляется)
  function routeLocal(j, what) {
    try { var o = JSON.parse(localStorage.getItem('m13ys-' + j.id + '-' + (j.start || '') + '-' + what) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; }
  }
  function coverPaint(front, lv) {
    var j = lv.j, C = j.doors.cover || {};
    var box = document.createElement('div'); box.className = 'm13-cover'; box.setAttribute('aria-hidden', 'true');
    front.insertBefore(box, front.firstChild);
    if (C.text === false) [].forEach.call(front.querySelectorAll(':scope > div:not(.m13-cover):not(.m13-flip-hint)'), function (n) { n.remove(); });
    needDoors(function () {
      if (!box.isConnected) return;
      var M = window.M13D, sc = null, key = '';
      function build() {
        var tall = front.clientHeight / Math.max(1, front.clientWidth) > 1.25, P = M.pick({ doors: { desktop: M.coverPic(j, 'desktop'), mobile: M.coverPic(j, 'mobile') } }, tall);
        if (sc && P.key === key) return;
        key = P.key; box.replaceChildren();
        if (C.fit !== 'cover' && P.src) { var bl = document.createElement('div'); bl.className = 'ys-dblur'; bl.style.backgroundImage = 'url("' + media(P.src) + '")'; box.appendChild(bl); }
        sc = M.cover(j, { key: key, base: S.base, day: lv.n, choice: C.marks ? routeLocal(j, 'choice') : {}, visits: C.marks ? routeLocal(j, 'doors') : {}, pats: C.marks ? routeLocal(j, 'kal') : {} });
        box.appendChild(sc.node);
        var dim = document.createElement('i'); dim.className = 'm13-cover-dim';
        dim.style.opacity = Math.max(0, Math.min(90, C.dim == null || C.dim === '' ? 40 : +C.dim)) / 100;
        box.appendChild(dim);
        sc.img.addEventListener('load', place); place();
      }
      function place() {
        if (!sc || !box.isConnected) return;
        var t = key === 'mobile', iw = sc.img.naturalWidth || (t ? 9 : 16), ih = sc.img.naturalHeight || (t ? 16 : 9);
        M.fit(sc.node, iw, ih, C.fit === 'cover' ? 'cover' : '', box.clientWidth, box.clientHeight);
      }
      build();
      requestAnimationFrame(function () { build(); place(); });
      if (!S.coverResize) { S.coverResize = true; window.addEventListener('resize', function () { if (S.coverFit) S.coverFit(); }); }
      S.coverFit = function () { if (box.isConnected) { build(); place(); } };
    });
  }
  // Метки в текстах дня ({день}, {кин}, {имя кина}…) — как на странице маршрута; метки выравнивания строк ({по центру}…) убираются
  function jFill(tpl, ctx) {
    return String(tpl == null ? '' : tpl).replace(/\{([^{}\n]{1,40})\}/g, function (all, name) {
      var k = name.trim().toLowerCase(); if (!Object.prototype.hasOwnProperty.call(ctx, k)) return all;
      var v = ctx[k]; return v && name.trim().charAt(0) !== k.charAt(0) ? v.charAt(0).toUpperCase() + v.slice(1) : v;
    }).split('\n').map(function (l) { return l.replace(/^\s*\{(слева|по центру|справа|по ширине)\}[ \t]*/i, ''); }).join('\n').trim();
  }
  function paras(t) { return String(t).split(/\n{2,}/).map(function (p) { return '<p>' + txt(p) + '</p>'; }).join(''); }
  function dayFrontHTML(lv) {
    var j = lv.j, n = lv.n, d = j.days[n - 1] || {}, fin = n === j.days.length, fb = (j.final || {}).blocks || {};
    var dt = parseDate(j.start); dt.setDate(dt.getDate() + n - 1);
    var ctx = { 'день': String(n), 'дата': dt.getDate() + ' ' + MON_GEN[dt.getMonth()], 'кин': d.kin == null ? '' : String(d.kin),
      'имя кина': d.kinName || '', 'печать': d.seal || '', 'тон': d.tone || '', 'что делаем': d.cardOperation || '', 'среда': d.environment || '' };
    var out = '';
    ((j.dayCard || {}).blocks || []).forEach(function (b) {
      if (!b || b.visible === false || (b.who && b.who.observation === false)) return;
      // День 13 — урезанная карта, как на странице маршрута (route.final.blocks)
      if (fin && !(fb[b.id] != null ? fb[b.id] !== false : (b.kind === 'small' || b.kind === 'title' || b.kind === 'question'))) return;
      var t, tt;
      // Свой кадр для телефона (d.imagePhone, панель → «✎ Настроить»): <picture> — на узком экране браузер берёт его
      if (b.kind === 'image') { if (d.image) { var ph = d.imagePhone ? '<source media="(max-width:560px)" srcset="' + esc(media(d.imagePhone)) + '">' : '';
        out += '<div class="m13-dc-img"><picture>' + ph + '<img class="m13-dc-bg" src="' + esc(media(d.image)) + '" alt="" aria-hidden="true"></picture><picture>' + ph + '<img src="' + esc(media(d.image)) + '" alt=""></picture></div>'; } return; }
      if (b.kind === 'small' || b.kind === 'title' || b.kind === 'note') {
        t = jFill(b.text, ctx); if (t) out += '<div class="m13-dc-' + b.kind + '">' + (b.kind === 'note' ? paras(t) : txt(t)) + '</div>';
        return;
      }
      if (b.kind !== 'text' && b.kind !== 'question') return;   // колесо, диск — только на странице маршрута
      t = jFill((d.texts || {})[b.id], ctx); if (!t) return;
      tt = jFill((d.texts || {})[b.id + 'Title'], ctx);
      out += '<div class="m13-dc-' + b.kind + '">' + (b.label ? '<div class="m13-dc-label">' + txt(b.label) + '</div>' : '') +
        (tt ? '<div class="m13-dc-sub">' + txt(tt) + '</div>' : '') + '<div class="m13-dc-body">' + paras(t) + '</div></div>';
    });
    var url = j.path ? S.base + j.path : lv.r.routeUrl || '';
    return '<div class="m13-dc">' + out + '</div><div class="m13-dc-foot">' +
      (url ? '<a class="m13-dc-go" href="' + esc(url) + '">' + txt(T('openRoute') || 'Открыть маршрут') + ' →</a>' : '') +
      '<div class="m13-flip-hint">' + txt(T('flipHint') || 'Нажать — открыть оборот') + '</div></div>';
  }
  // Карта дня: полосы прокрутки нет; если текст не поместился — низ мягко тает, пока не долистали
  function dcMore(box) {
    if (!box) return;
    if (box.m13More) { box.m13More(); return; }   // оборот карточки — один и тот же, при каждом открытии только пересчитать
    function upd() { box.classList.toggle('m13-dc--more', box.scrollHeight - box.scrollTop - box.clientHeight > 4); }
    box.addEventListener('scroll', upd);
    [].forEach.call(box.querySelectorAll('img'), function (im) { im.addEventListener('load', upd); });
    if (box.id === 'm13-backc') {
      box.m13More = function () { upd(); setTimeout(upd, 60); setTimeout(upd, 400); };
      box.addEventListener('load', upd, true);   // картинки оборота
      if (window.MutationObserver) new MutationObserver(function () { setTimeout(upd, 30); }).observe(box, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'open'] });
    }
    upd(); setTimeout(upd, 60);
  }
  // Идёт маршрут — карточка вырастает ровно на столько, сколько не помещается карте дня
  // (не выше экрана минус поля 14 px сверху и снизу). Картинка дня всегда целиком (её просьба 05.10:
  // обрезанная сверху половина не годится); не влез текст — дочитывается пальцем, низ мягко тает (dcMore).
  function dcFit(stage, box) {
    stage.style.height = '';
    if (!box || !stage.classList.contains('m13-st-day')) return;
    var ih = window.innerHeight, h = stage.offsetHeight, need = box.scrollHeight - box.clientHeight,
      max = Math.round(Math.max(ih - 28, ih * .88));
    if (need > 2 && h < max) stage.style.height = Math.min(max, h + need) + 'px';
    box.dispatchEvent(new Event('scroll'));
  }
  // Финальный ролик: без звука (так браузер запускает его сам), останавливается на последнем кадре
  function filmHTML(r, cls) {
    // Пока строки не заведены в панели (finalWords) — слова по умолчанию, как на странице Синей Руки
    var l1 = r.finalText1 == null && !r.finalWords ? 'Маршрут пройден' : opt(r.finalText1),
      l2 = r.finalText2 == null && !r.finalWords ? 'Увидимся за поворотом…' : opt(r.finalText2);
    return '<div class="m13-film' + (cls ? ' ' + cls : '') + '">' +
      '<video class="m13-film-v" muted playsinline preload="auto" src="' + esc(media(r.finalVideo)) + '"></video>' +
      '<div class="m13-film-words">' + (l1 ? '<div class="m13-film-l1">' + txt(l1) + '</div>' : '') + (l2 ? '<div class="m13-film-l2">' + txt(l2) + '</div>' : '') + '</div>' +
      (r.finalLogo !== false ? '<div class="m13-film-logo">' + logoHTML(null) + '</div>' : '') +
      '<button type="button" class="m13-film-play" aria-label="' + esc(T('playFilm') || 'Смотреть ролик') + '">▶</button></div>';
  }
  function filmStart(box) {
    var v = box.querySelector('video'); if (!v || box.m13film) return;
    box.m13film = true;
    function say() { box.classList.add('is-said'); }
    v.muted = true; v.playsInline = true;
    v.addEventListener('playing', function () { box.classList.add('is-on'); box.classList.remove('is-tap'); });
    v.addEventListener('timeupdate', function () { if (v.duration && isFinite(v.duration) && v.duration - v.currentTime <= 3.4) say(); });
    v.addEventListener('ended', say);
    v.addEventListener('error', function () { box.classList.remove('is-tap'); say(); });
    box.querySelector('.m13-film-play').addEventListener('click', function (e) { e.stopPropagation(); var q = v.play(); if (q && q.catch) q.catch(say); });
    // Телефон не дал запустить сам (например, iPhone в режиме энергосбережения) — кнопка ▶
    var p = v.play(); if (p && p.catch) p.catch(function () { if (!v.error) box.classList.add('is-tap'); });
  }
  function filmsStart(scope) { [].forEach.call(scope.querySelectorAll('.m13-film'), filmStart); }
  function filmsStop(scope) {
    [].forEach.call(scope.querySelectorAll('.m13-film video'), function (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} });
  }
  // Значки ✕ и ↺ у увеличенной карточки — рамка и знак в светлом оттенке её цвета (свечение, акцент, цвет маршрута)
  function mixHex(hex, to, k) {
    var a = hexRgb(hex), b = hexRgb(to);
    return 'rgb(' + a.map(function (v, i) { return Math.round(v + (b[i] - v) * k); }).join(',') + ')';
  }
  function iconVars(st, r) {
    var own = ((S.D && S.D.showcase && S.D.showcase.cardStyle) || {}).iconColor;
    if (/^#[0-9a-f]{6}$/i.test(own || '')) return '--m13-icb:' + mixHex(own, '#ffffff', .8) + ';--m13-ixl:' + own + ';--m13-ixc:' + own + ';--m13-ixg:' + mixHex(own, '#ffffff', .5);
    var hue = [st.glowColor, st.accent, r && r.color, st.rimColor].filter(function (x) { return /^#[0-9a-f]{6}$/i.test(x || ''); })[0];
    // Светлый фон за открытой карточкой: светлые значки на светлом стекле не видны — берём тёмный оттенок того же цвета
    if (st.veil === 'light') { hue = hue || '#5a4636';
      return '--m13-icb:' + mixHex(hue, '#ffffff', .8) + ';--m13-ixl:' + mixHex(hue, '#000000', .1) + ';--m13-ixc:' + mixHex(hue, '#000000', .3) + ';--m13-ixg:rgba(255,255,255,.7)'; }
    return hue ? '--m13-icb:' + mixHex(hue, '#ffffff', .8) + ';--m13-ixl:' + mixHex(hue, '#ffffff', .5) + ';--m13-ixc:' + mixHex(hue, '#ffffff', .85) + ';--m13-ixg:' + mixHex(hue, '#ffffff', .25) : '';
  }

  // Кнопка «закрыть» — одинаковая во всех окнах витрины (карточка, картинка крупно, окно отзыва; её просьба 07.10).
  // Панель, Витрина → оформление карточек: cardStyle.iconShape — форма: 'round' светящийся круг (обычно) | 'thin' тонкая линия,
  // без свечения | 'square' скруглённый квадрат | 'bare' только знак; cardStyle.closeMark — знак внутри: 'dot' светящаяся точка
  // (обычно) | 'ring' колечко | 'star' звёздочка-контур | 'cross' крестик | 'none' пусто (у «только знак» — точка)
  var X_MARK = {
    dot: '<circle cx="8" cy="8" r="2.4" fill="currentColor" stroke="none"/>',
    ring: '<circle cx="8" cy="8" r="4.2"/>',
    star: '<path d="M8 1.8 9.5 6.5 14.2 8 9.5 9.5 8 14.2 6.5 9.5 1.8 8 6.5 6.5Z"/>',
    cross: '<path d="M4 4 12 12M12 4 4 12"/>'
  };
  var UNFLIP_SVG = '<svg class="m13-xm m13-xm--back" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3.6 6.4A5 5 0 1 1 3.3 9.8"/><path d="M3.2 2.9 3.6 6.4 7 5.8"/></svg>';
  function xLook() {
    var cs = (S.D && S.D.showcase && S.D.showcase.cardStyle) || {}, sh = cs.iconShape, cm = cs.closeMark;
    if (cm === 'check') cm = 'cross';
    if (!cm || (cm === 'none' && sh === 'bare') || (cm !== 'none' && !X_MARK[cm])) cm = 'dot';
    S.root.classList.remove('m13-ic-square', 'm13-ic-bare', 'm13-ic-thin', 'm13-ic-flat', 'm13-ic-md', 'm13-ic-sm');
    // Размер знаков ✕ и ↺ (cardStyle.iconSize): '' — меньше (её просьба 27.10, теперь обычно) | 'sm' — совсем маленькие | 'lg' — крупные, как было
    if (cs.iconSize !== 'lg') S.root.classList.add(cs.iconSize === 'sm' ? 'm13-ic-sm' : 'm13-ic-md');
    if (sh === 'square' || sh === 'bare' || sh === 'thin') S.root.classList.add('m13-ic-' + sh);
    // Её просьба 27.10: значки без свечения и тени (cardStyle.iconGlow 'none') и своим цветом (cardStyle.iconColor) —
    // одинаково во всех окнах витрины; ↺ — тоже тонкой линией, как знак «закрыть»
    if (cs.iconGlow === 'none') S.root.classList.add('m13-ic-flat');
    var ic = /^#[0-9a-f]{6}$/i.test(cs.iconColor || '') ? cs.iconColor : '';
    S.root.style.setProperty('--m13-ixc', ic || ''); S.root.style.setProperty('--m13-ixl', ic || '');
    if (!ic) { S.root.style.removeProperty('--m13-ixc'); S.root.style.removeProperty('--m13-ixl'); }
    [].forEach.call(S.root.querySelectorAll('.m13-unflip'), function (b) { b.innerHTML = UNFLIP_SVG; });
    var svg = X_MARK[cm] ? '<svg class="m13-xm m13-xm--' + cm + '" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + X_MARK[cm] + '</svg>' : '';
    [].forEach.call(S.root.querySelectorAll('.m13-x:not(.m13-unflip)'), function (b) { b.innerHTML = svg; });
  }

  // Цвет текста на акцентной кнопке: белый на тёмном акценте, почти чёрный на светлом.
  function inkFor(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim()); if (!m) return '#fff';
    var n = parseInt(m[1], 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#1f1f1f' : '#fff';
  }
  function hexRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim()); if (!m) return [255, 255, 255];
    var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function lum(rgb) { return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]; }
  function accentVars(st) { return st.accent ? '--m13-ac:' + st.accent + ';--m13-ac-ink:' + inkFor(st.accent) : ''; }

  function cardStyle(c) {
    var d = (S.D.showcase && S.D.showcase.cardStyle) || {}, f = ((c && c.front) || {}).style || {};
    function pick(k, def) { return f[k] && f[k] !== 'inherit' ? f[k] : (d[k] || def); }
    function none(v) { return v === 'none' ? '' : v; }
    function num(k, def, lo, hi) {
      var v = f[k] != null && f[k] !== '' ? f[k] : d[k];
      v = v == null || v === '' || isNaN(+v) ? def : +v;
      return Math.max(lo, Math.min(hi, v));
    }
    var glow = pick('glow', 'off');
    var ph = phaseOf(c);
    if (ph && ph.glow && glow !== 'soft' && glow !== 'live') glow = 'live';
    return {
      font: f.font || d.font || '', textColor: f.textColor || d.textColor || '', bg: f.bg || d.bg || '',
      overlay: f.overlay && f.overlay !== 'inherit' ? f.overlay : (d.overlay || 'light'),
      accent: f.accent || d.accent || '',
      glow: glow, glowColor: f.glowColor || f.accent || d.glowColor || d.accent || '#e8c77a',
      glowStrength: pick('glowStrength', 'medium'), glowDir: pick('glowDir', 'around'),
      glass: num('glass', 0, 0, 100),
      glassBlur: num('glassBlur', 10, 0, 20),
      backBg: f.backBg || d.backBg || '', backText: f.backText || d.backText || '', backSize: pick('backSize', 'md'),
      // Прозрачность оборота (0 — сплошной) и размытие того, что за ним
      backGlass: num('backGlass', 0, 0, 90), backBlur: num('backBlur', 8, 0, 20),
      // Стекло и узор: кромка, узор (готовый или своя картинка), где он лежит, цвет, заметность; помощь тексту
      rim: none(pick('rim', '')), pattern: none(pick('pattern', '')),
      patternImage: f.patternImage || d.patternImage || '', patternPlace: pick('patternPlace', 'corners'),
      patternColor: f.patternColor || d.patternColor || '', patternOpacity: num('patternOpacity', 80, 5, 100),
      // Картинка узора (её просьба 26.10, ягоды): размер — % ширины карточки (0 — как было), наклон в градусах,
      // 'same' — в других углах не отражать, тень под картинкой
      patternSize: num('patternSize', 0, 0, 90), patternTilt: num('patternTilt', 0, -45, 45),
      patternMirror: pick('patternMirror', 'mirror'), patternShadow: none(pick('patternShadow', '')),
      // Блик леденца на стекле, 0 — нет; толщина контура в px (0 — как было, 1,3) и где он толще
      // Кнопки «открыть» и «Нажать — открыть оборот» (её просьба 27.10): вид, свой цвет рамки и надписи, без тени
      ctaLook: none(pick('ctaLook', '')), ctaColor: f.ctaColor || d.ctaColor || '', ctaShadow: none(pick('ctaShadow', '')),
      sheen: num('sheen', 0, 0, 100), rimWidth: num('rimWidth', 0, 0, 8), rimShape: none(pick('rimShape', '')),
      // Фон за открытой карточкой: dark (как было) | light — светлая молочная дымка | clear — почти без дымки
      veil: pick('veil', 'dark'),
      textHelp: none(pick('textHelp', '')), hazeStrength: num('hazeStrength', 60, 0, 100),
      // Контур (кромка): где (весь край / уголки), свой цвет, живость (дышит / бегущий блик) и цвет блика; темп живого свечения
      rimPlace: pick('rimPlace', 'edge'), rimColor: f.rimColor || d.rimColor || '', rimLive: none(pick('rimLive', '')),
      rimRunColor: f.rimRunColor || d.rimRunColor || '', glowTempo: pick('glowTempo', 'calm'),
      // Скорость бегущего блика по контуру и блика по кнопке: fast | normal | slow (по умолчанию) | vslow
      rimSpeed: pick('rimSpeed', 'slow'), btnSpeed: pick('btnSpeed', 'slow'),
      // Размер текста: название и мелкие надписи
      titleSize: pick('titleSize', 'md'), smallSize: pick('smallSize', 'md'),
      // Кнопки на обороте: вид главной, цвета, остальные кнопки, «живость»
      btnStyle: none(pick('btnStyle', '')), btnColor: f.btnColor || d.btnColor || '', btnColor2: f.btnColor2 || d.btnColor2 || '',
      btnDir: pick('btnDir', 'diag'), btnInk: f.btnInk || d.btnInk || '', btnOther: pick('btnOther', 'outline'),
      btnOtherColor: f.btnOtherColor || d.btnOtherColor || '', btnLive: none(pick('btnLive', '')),
      // Положение и выравнивание текста — у всех карточек одинаково: своё или общее месячное
      textPos: pick('textPos', ''),
      textAlign: pick('textAlign', '')
    };
  }
  function isStaticCard(c) { return !c || c.interactive === false || !c.back || c.back.type === 'static';
  }
  // Сила и направление свечения — через CSS-переменные: --m13-gk (множитель размера),
  // --m13-gy (сдвиг: 0 вокруг, 1 вниз, -1 вверх), --m13-gsp (1 — свет со всех сторон, -1 — только с одной).
  var GLOW_K = { weak: 0.55, medium: 1, strong: 1.7 };
  function glowVars(st) {
    var y = st.glowDir === 'bottom' ? 1 : st.glowDir === 'top' ? -1 : 0;
    return '--m13-glow:' + st.glowColor + ';--m13-gk:' + (GLOW_K[st.glowStrength] || 1) + ';--m13-gy:' + y + ';--m13-gsp:' + (y ? -1 : 1);
  }
  // Темп живого свечения: спокойное (по умолчанию), медленное, мерцающее
  var TEMPO = { slow: 'm13-gt-slow', flicker: 'm13-gt-flicker' };
  // Возвращает {cls, css} для карточки: классы и inline-стиль.
  function styleOf(c, hasImg) {
    var st = cardStyle(c), cls = [], css = [];
    if (st.font) { ensureFont(st.font); css.push("font-family:'" + st.font + "',Georgia,serif"); }
    if (st.textColor) { cls.push('m13-styled'); css.push('--m13-tc:' + st.textColor); }
    // Стекло и у карточек с картинкой: сквозь прозрачные места PNG (например, цветок без фона) видно стекло, а не белую карточку
    if (st.glass) {
      // «Зеркало»: цвет карточки полупрозрачный, сквозь него чуть видна картинка фона
      var rgb = hexRgb(st.bg || '#ffffff');
      css.push('background-color:rgba(' + rgb.join(',') + ',' + (1 - st.glass / 100).toFixed(2) + ')', '--m13-gb:' + st.glassBlur + 'px');
      if (!st.glassBlur) cls.push('m13-glass--clear');
      cls.push('m13-glass', lum(rgb) < 128 ? 'm13-glass--dark' : 'm13-glass--light');
    } else if (st.bg) css.push('background-color:' + st.bg);
    if (hasImg) cls.push('m13-ov-' + st.overlay);
    if (st.accent) { cls.push('m13-accent'); css.push(accentVars(st)); }
    if (st.textPos) cls.push('m13-pos-' + st.textPos);
    if (st.titleSize !== 'md') cls.push('m13-tt-' + st.titleSize);
    if (st.smallSize !== 'md') cls.push('m13-ts-' + st.smallSize);
    if (st.textAlign) cls.push('m13-align-' + st.textAlign);
    if (st.glow === 'soft' || st.glow === 'live') { cls.push('m13-glow-' + st.glow); css.push(glowVars(st)); }
    if (st.glow === 'live' && TEMPO[st.glowTempo]) cls.push(TEMPO[st.glowTempo]);
    if (st.ctaLook) cls.push('m13-cta-' + st.ctaLook);
    if (st.ctaColor) {
      cls.push('m13-cta-c'); css.push('--m13-cta:' + st.ctaColor);
      if (st.ctaLook === 'fill') css.push('--m13-cta-ink:' + (lum(hexRgb(st.ctaColor)) > 150 ? '#1c150c' : '#ffffff'));
    }
    if (st.ctaShadow === 'off') cls.push('m13-cta-flat');
    var lay = decoHTML(st, true);
    if (lay) cls.push('m13-deco');
    if (st.rim) cls.push('m13-has-rim');
    if (st.textHelp) {
      // Тень/затемнение под светлым текстом — тёмные, под тёмным — светлые
      var dark = st.textColor && lum(hexRgb(st.textColor)) < 128;
      cls.push('m13-th-' + st.textHelp + (dark ? ' m13-th--light' : ''));
      if (st.textHelp === 'haze') css.push('--m13-hz:' + (st.hazeStrength / 100).toFixed(2));
    }
    return { cls: cls.join(' '), css: css.join(';'), st: st, lay: lay };
  }

  // Кнопки оборота: классы и переменные для большой карточки. Пусто — как раньше (по акцентному цвету).
  var BTN_DIR = { h: '90deg', diag: '135deg', v: '180deg' };
  // Скорость: множитель длительности блика по кнопке (4,2 с) и перелива (6 с); круг бегущего блика по контуру — секунд
  var BTN_S = { fast: 0.7, normal: 1, slow: 1.55, vslow: 2.25 }, RIM_S = { fast: 5, normal: 7, slow: 12, vslow: 18 };
  function buttonLook(st, backDark) {
    var cls = [], css = [];
    if (st.btnStyle) {
      var c1 = st.btnColor || st.accent || '#ecd3a3', c2 = st.btnColor2 || c1;
      cls.push('m13-btn-' + st.btnStyle);
      var ink = st.btnInk, l1 = lum(hexRgb(c1));
      if (!ink && (st.btnStyle === 'fill' || st.btnStyle === 'gradient')) {
        var a = hexRgb(c1), b = hexRgb(st.btnStyle === 'gradient' ? c2 : c1);
        ink = lum([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]) > 150 ? '#1c150c' : '#ffffff';
      }
      // Стекло и контур прозрачные: надпись цветом кнопки, если он читается на обороте, иначе — цветом текста оборота
      if (!ink) ink = backDark ? (l1 > 110 ? c1 : '#efe4d2') : (l1 < 150 ? c1 : '#232323');
      css.push('--m13-b1:' + c1, '--m13-b2:' + c2, '--m13-bdir:' + (BTN_DIR[st.btnDir] || '135deg'));
      if (ink) css.push('--m13-bink:' + ink);
      if (st.btnLive) { cls.push('m13-btn-live-' + st.btnLive); css.push('--m13-gls:' + (BTN_S[st.btnSpeed] || BTN_S.slow)); }
      if (st.btnOther === 'same') cls.push('m13-btn-same');
    }
    if (st.btnOtherColor && st.btnOther !== 'same') { cls.push('m13-btn-other'); css.push('--m13-bo:' + st.btnOtherColor); }
    return { cls: cls, css: css };
  }

  // Слои поверх карточки: затемнение под текстом, узор, кромка. Добавляются последними,
  // текст карточки стоит над ними (.m13-deco > * — z-index 2).
  var PAT_ONE = { tl: 1, tr: 1, bl: 1, br: 1 }, RIM_SHAPES = { corners: 1, bottom: 1, top: 1, diag: 1 };
  function decoHTML(st, front) {
    var h = '';
    if (front && st.textHelp === 'shade') h += '<i class="m13-lay m13-shade" aria-hidden="true"></i>';
    var p = st.pattern, img = '';
    if (p === 'custom') img = st.patternImage ? media(st.patternImage) : '';
    else if (p === 'frost' || p === 'sparks' || p === 'kaleido') img = media('assets/patterns/' + p + '-' + (st.patternPlace === 'full' ? 'full' : 'corner') + '.webp');   // полный адрес: url() в переменной считается от vitrina.css
    if (img) {
      var col = st.patternColor || (p === 'frost' ? '#eef6ff' : st.accent || '#ecd3a3');
      // Где: corners | edge | full | один угол tl tr bl br | diag — два угла по диагонали
      var place = { full: 1, edge: 1, diag: 1 }[st.patternPlace] ? st.patternPlace : PAT_ONE[st.patternPlace] ? 'one m13-pat--at-' + st.patternPlace : 'corners';
      var pv = "--m13-pimg:url('" + img + "');--m13-pcol:" + col + ';--m13-pop:' + (st.patternOpacity / 100) +
        (st.patternTilt ? ';--m13-ptl:' + st.patternTilt + 'deg' : '') + (st.patternSize ? ';--m13-psz:' + st.patternSize + '%' : '');
      h += '<i class="m13-lay m13-pat m13-pat--' + place + (p === 'custom' ? ' m13-pat--img' : '') + (st.patternSize && place !== 'full' ? ' m13-pat--sz' : '') +
        (st.patternMirror === 'same' ? ' m13-pat--same' : '') + (st.patternShadow ? ' m13-pat--shadow' : '') + '" aria-hidden="true" style="' +
        esc(pv) + '"><i></i><i></i><i></i><i></i></i>';
    }
    // Блик леденца: косой светлый блик сверху и цвет, просвечивающий снизу (цвет контура, иначе акцент)
    if (st.sheen) {
      var shc = st.rimColor || (st.rim === 'candy' ? '#b8183c' : st.accent || '#ffffff');
      h += '<i class="m13-lay m13-candy" aria-hidden="true" style="' + esc('--m13-cy:' + (st.sheen / 100) + ';--m13-shc:' + shc) + '"></i>';
    }
    if (st.rim) {
      var rv = (st.rimColor ? '--m13-rc:' + st.rimColor + ';' : '') + '--m13-runc:' + (st.rimRunColor || st.accent || '#fff1c4') + ';--m13-rs:' + (RIM_S[st.rimSpeed] || RIM_S.slow) + 's' +
        (st.rimWidth ? ';--m13-rw:' + st.rimWidth + 'px' : '');
      // Контур толще в части края (уголки, низ, верх, диагональ) — второй, более толстый слой, видный только там
      // Свой цвет — на самой линии: у вида контура (светлый, золотой, леденец) свой цвет по умолчанию, он перебил бы цвет, заданный выше
      var rc = st.rimColor ? ' style="' + esc('--m13-rc:' + st.rimColor) + '"' : '';
      var thick = RIM_SHAPES[st.rimShape] ? '<i class="m13-rim-zone m13-rim-zone--' + st.rimShape + '"><i class="m13-rim m13-rim--thick m13-rim--' + esc(st.rim) + '"' + rc + '></i></i>' : '';
      h += '<i class="m13-lay m13-rimbox' + (st.rimPlace === 'corners' ? ' m13-rim--corners' : '') + (st.rimLive ? ' m13-rim--' + esc(st.rimLive) : '') +
        '" aria-hidden="true" style="' + esc(rv) + '"><i class="m13-rim m13-rim--' + esc(st.rim) + '"' + rc + '></i>' + thick +
        (st.rimLive === 'run' ? '<i class="m13-rim-run m13-rim-glow"></i><i class="m13-rim-run"></i>' : '') +
        (st.rimLive === 'fire' ? '<i class="m13-rim-fire"></i><i class="m13-rim-fire"></i>' : '') + '</i>';
    }
    return h;
  }

  // Живое свечение — отдельным слоем за карточкой: свет нарисован один раз, «дышат» только яркость и размер (плавно, без дрожи)
  function breathWrap(sty, html) {
    if (!/(^| )m13-glow-live( |$)/.test(sty.cls)) return html;
    var tempo = TEMPO[sty.st.glowTempo] || '';
    return '<div class="m13-cell ' + tempo + '" style="' + esc(glowVars(sty.st)) + '"><i class="m13-breath" aria-hidden="true"></i>' +
      html.replace(/ m13-glow-live/, '') + '</div>';
  }
  function thumbHTML(c) { return withLid(c, thumbCore(c)); }
  // Окошко: адрес страницы сайта (по умолчанию — сад «Мой цветок») и надпись-приглашение
  function oknoOf(c) {
    var o = (c.front || {}).okno; if (!o || !o.on) return null;
    var h = String(o.href || '').trim().replace(/^\/+/, '');
    return { href: /^[a-z0-9\/_-]+\/$/i.test(h) ? h : 'uzory/cvetok/', text: o.text };
  }
  // Сад в окошке грузится, когда витрина уже открылась и окошко видно; не видно — стоит на паузе (батарея и трафик)
  function oknoMount() {
    var boxes = S.root.querySelectorAll('.m13-okno[data-src]'); if (!boxes.length) return;
    function put(b) {
      if (b.firstChild) return;
      var fr = document.createElement('iframe');
      fr.setAttribute('title', 'Сад'); fr.setAttribute('tabindex', '-1'); fr.setAttribute('loading', 'lazy');
      fr.onload = function () { fr.classList.add('is-on'); };
      fr.src = b.getAttribute('data-src'); b.appendChild(fr);
    }
    function say(b, m) { var fr = b.firstChild; if (fr && fr.contentWindow) try { fr.contentWindow.postMessage({ m13okno: m }, '*'); } catch (e) {} }
    function go() {
      if (!('IntersectionObserver' in window)) { [].forEach.call(boxes, put); return; }
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { put(e.target); say(e.target, 'play'); } else say(e.target, 'pause'); });
      });
      [].forEach.call(boxes, function (b) { io.observe(b); });
    }
    if (document.readyState === 'complete') setTimeout(go, 600); else window.addEventListener('load', function () { setTimeout(go, 600); });
  }
  function thumbCore(c) {
    if (!c || c.visible === false) {
      return '<div class="m13-thumb m13-thumb--empty" aria-hidden="true"><span class="m13-empty-mark"></span></div>';
    }
    var f = c.front || {};
    // Карточка-календарь с мини-календарём на лицевой стороне: вместо картинки и надписей — сетка месяца
    if (isCalCard(c) && c.monthCal.face !== 'image') {
      var cs = styleOf(c, false);
      return breathWrap(cs, '<button type="button" class="m13-thumb m13-thumb--cal' + (cs.cls ? ' ' + cs.cls : '') + '" style="' + esc(cs.css) + '" data-card="' + esc(c.id) + '" aria-label="' +
        esc([eyeOf(f) || 'Календарь', (c.monthCal.title || M13.calMonthName(calYM()))].join(' · ')) + '">' + calMiniHTML(c) + cs.lay + '</button>');
    }
    var sty = styleOf(c, !!f.image);
    var css = (f.image ? "background-image:url('" + esc(media(f.image)) + "');" : '') + esc(sty.css);
    var evp = evPeekHTML(c), lay = evp + sty.lay;
    var cls = 'm13-thumb' + (f.image ? ' m13-thumb--img' : '') + (sty.cls ? ' ' + sty.cls : '') + (evp ? ' m13-has-ev' + (sty.lay ? '' : ' m13-deco') : '');
    var isStatic = !isCalCard(c) && (c.interactive === false || !c.back || c.back.type === 'static');
    var sub = opt(f.subtitle), foot = opt(f.foot), ok = oknoOf(c);
    var ph = phaseOf(c), phCls = '';
    if (ph && ph.label) { foot = ph.label; phCls = ' m13-phase m13-phase--' + ph.key; }
    // Крупное слово вместо надписей (её «скоро» на 4-й карточке ноября, 26.10) — как на странице «Ноябрь · скоро»
    var word = ok ? '' : String(f.word || '').trim();   // окошко с садом важнее слова
    if (word) {
      var so = soonOf(S.D.settings), wf = so.font || '';
      if (wf) ensureFont(wf);
      cls += ' m13-thumb--word';
      css += esc((wf ? "--m13-sfont:'" + wf + "',Georgia,serif;" : '') + (so.color ? '--m13-sc:' + so.color + ';' : ''));
      var wtext = '<div class="m13-thumb-word"><span class="m13-gt">' + txt(word) + '</span></div>';
      if (isStatic) return breathWrap(sty, '<div class="' + cls + ' m13-thumb--static" style="' + css + '" aria-label="' + esc(f.title || word) + '">' + wtext + lay + '</div>');
      return breathWrap(sty, '<button type="button" class="' + cls + '" style="' + css + '" data-card="' + esc(c.id) + '" aria-label="' + esc(f.title || word) + '">' + wtext + lay + '</button>');
    }
    var text = '<div class="m13-thumb-text">' +
      (eyeOf(f) ? '<div class="m13-mini-type">' + txt(eyeOf(f)) + '</div>' : '') +
      (f.title ? '<div class="m13-mini-title">' + txt(f.title) + '</div>' : '') +
      (sub ? '<div class="m13-mini-date">' + txt(sub) + '</div>' : '') +
      statusHTML(c, 'm13-mini-status') + '</div>';
    // Живое окошко (её решение 29.10): на карточке — живой сад «Узоров» (та же страница, без надписей); нажатие — вход в сад
    if (ok) return breathWrap(sty, '<a class="' + cls + ' m13-thumb--okno" style="' + css + '" href="' + esc(S.base + ok.href) + '" data-m13-okno>' +
      '<span class="m13-okno" data-src="' + esc(S.base + ok.href + '?okno=1') + '" aria-hidden="true"></span>' + text +
      '<div class="m13-mini-foot"><span class="m13-mini-cta m13-okno-go">' + txt(ok.text || 'Входи') + '</span></div>' + lay + '</a>');
    if (isStatic) return breathWrap(sty, '<div class="' + cls + ' m13-thumb--static" style="' + css + '">' + text + lay + '</div>');
    return breathWrap(sty, '<button type="button" class="' + cls + '" style="' + css + '" data-card="' + esc(c.id) + '">' + text +
      '<div class="m13-mini-foot">' + (foot ? '<span' + (phCls ? ' class="' + phCls.trim() + '"' : '') + '>' + txt(foot) + '</span>' : '') +
      '<span class="m13-mini-cta">' + txt(T('open') || 'открыть') + '</span></div>' + lay + '</button>');
  }

  /* ---------- Увеличенная карточка ---------- */
  function overlayHTML() {
    var closeBtn = '<button type="button" class="m13-x m13-close" aria-label="Закрыть" title="Закрыть"></button>';
    return '<div class="m13-overlay" id="m13-overlay" role="dialog" aria-modal="true">' +
      '<div class="m13-big-stage">' +
      '<div class="m13-big-card" id="m13-bigcard">' +
      '<div class="m13-face m13-front" id="m13-front"></div>' +
      '<div class="m13-face m13-back"><div class="m13-content" id="m13-backc"></div></div>' +
      // Кнопки ✕ и ↺ — на самой карточке и поворачиваются вместе с ней (её просьба 07.10): у лицевой стороны своя
      // «закрыть», у оборота — ↺ и «закрыть»
      '<div class="m13-ibar m13-ibar--front">' + closeBtn + '</div>' +
      '<div class="m13-ibar m13-ibar--back">' +
      '<button type="button" class="m13-x m13-unflip" id="m13-unflip" aria-label="Показать лицевую сторону" title="Лицевая сторона">↺</button>' + closeBtn + '</div>' +
      '</div>' +
      '</div></div>';
  }
  function bindOverlay() {
    var ov = S.root.querySelector('#m13-overlay');
    S.root.querySelector('#m13-front').addEventListener('click', function () {
      S.root.querySelector('#m13-bigcard').classList.add('is-flipped');
      var bc = S.root.querySelector('#m13-backc'); bc.scrollTop = 0; kaskGo(bc);
      var fv = S.root.querySelector('#m13-front video'); if (fv) fv.pause();
    });
    S.root.querySelector('#m13-unflip').addEventListener('click', function () {
      S.root.querySelector('#m13-bigcard').classList.remove('is-flipped');
    });
    [].forEach.call(S.root.querySelectorAll('.m13-close'), function (b) { b.addEventListener('click', closeTop); });
    ov.addEventListener('click', function (e) { if (e.target === ov) closeTop(); });
  }

  // Вопрос дня у костра на обороте маршрута: берётся из «Узоров» (костёр → «13 дней»; не сохраняла — черновик из assets/koster.js)
  function kosterDays() {
    if (S.kDays) return S.kDays;
    S.kDays = fetch(S.base + 'data/uzory.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (u) {
      var it = (u.items || []).filter(function (x) { return x && x.space && x.space.koster; })[0], d = it && it.space.koster.days;
      if (d && d.length) return d;
      return new Promise(function (ok) {
        if (window.M13_KOSTER_DAYS) return ok(window.M13_KOSTER_DAYS);
        var sc = document.createElement('script'); sc.src = S.base + 'assets/koster.js?v=' + Date.now().toString(36).slice(0, 5);
        sc.onload = function () { ok(window.M13_KOSTER_DAYS || []); }; sc.onerror = function () { ok([]); };
        document.head.appendChild(sc);
      });
    });
    return S.kDays;
  }
  function kaskFill(scope) {
    scope.classList.remove('m13-kmode');
    var p = scope.querySelector('[data-m13-kask]'); if (!p) return;
    scope.classList.add('m13-kmode');
    var t = today(), iso = t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
    kosterDays().then(function (days) {
      var d = (days || []).filter(function (x) { return x && x.date === iso; })[0], q = d && String(d.ask || '').trim();
      if (!q || !p.isConnected) return;
      p.innerHTML = q.split(/\s+/).map(function (w, i) { return '<span style="transition-delay:' + (i * .07).toFixed(2) + 's">' + txt(w) + '</span>'; }).join(' ');
      p.hidden = false; p.m13n = q.length;
      if (S.root.querySelector('#m13-bigcard').classList.contains('is-flipped')) kaskGo(scope);
    });
  }
  // через 6–11 с (по длине вопроса) после переворота вопрос рассеивается, как дым, по словам и место под ним плавно сходится
  function kaskGo(scope) {
    var p = scope.querySelector('[data-m13-kask]'); if (!p || p.hidden || p.m13t) return;
    p.m13t = setTimeout(function () {
      if (!p.isConnected) return;
      p.style.maxHeight = p.offsetHeight + 'px'; p.classList.add('is-smoke');
      setTimeout(function () { p.classList.add('is-gone'); }, 2600);
    }, Math.max(6000, Math.min(11000, 3500 + p.m13n * 60)));
  }
  function sameSite(url) {
    try { var u = new URL(url, location.href), b = new URL(S.base, location.href); return u.origin === location.origin && u.pathname.indexOf(b.pathname) === 0; } catch (e) { return false; }
  }
  function openCard(id) {
    var c = findCard(id); if (!c) return;
    S.card = c;
    // Карточка с плашками записи: заранее узнаём у программы записи, какие встречи записываются по календарю
    if (zpHasKeys(c)) zpServices().catch(function () {});
    var f = c.front || {};
    var front = S.root.querySelector('#m13-front');
    var sty = styleOf(c, !!f.image);
    front.className = 'm13-face m13-front' + (f.image ? ' m13-front--img' : '') + (sty.cls ? ' ' + sty.cls.replace(/m13-glow-\w+|m13-gt-\w+|m13-accent/g, '') : '');
    var big = S.root.querySelector('#m13-bigcard');
    big.classList.toggle('m13-accent', !!sty.st.accent);
    // Оборот: свой цвет; если он тёмный — весь текст и плашки на обороте становятся светлыми
    var bb = sty.st.backBg, dark = bb && lum(hexRgb(bb)) < 128;
    big.classList.toggle('m13-back-dark', !!dark);
    // Полупрозрачный оборот: цвет оборота (или светлый по умолчанию) с прозрачностью, за ним — размытие
    var bg = sty.st.backGlass;
    big.classList.toggle('m13-back-glass', !!bg);
    big.classList.toggle('m13-back-glass--clear', !!bg && !sty.st.backBlur);
    if (bg) bb = 'rgba(' + hexRgb(bb || '#f8f8f8').join(',') + ',' + (1 - bg / 100).toFixed(2) + ')';
    // Свой цвет и размер текста на обороте
    var btx = sty.st.backText;
    big.classList.toggle('m13-back-tx', !!btx);
    big.classList.remove('m13-bs-lg', 'm13-bs-xl');
    if (sty.st.backSize === 'lg' || sty.st.backSize === 'xl') big.classList.add('m13-bs-' + sty.st.backSize);
    var bl = buttonLook(sty.st, btx ? lum(hexRgb(btx)) > 128 : !!dark);
    if (btx) bl.css.push('--m13-btx:' + btx);
    big.className = big.className.replace(/\s*m13-btn-[\w-]+/g, '');
    bl.cls.forEach(function (k) { big.classList.add(k); });
    big.setAttribute('style', [accentVars(sty.st), bb ? '--m13-back:' + bb : '', bg ? '--m13-bb:' + sty.st.backBlur + 'px' : ''].concat(bl.css).filter(Boolean).join(';'));
    front.setAttribute('style', sty.css);
    front.style.backgroundImage = f.image ? "url('" + media(f.image) + "')" : '';
    var stage = S.root.querySelector('.m13-big-stage');
    stage.classList.remove('m13-glow-soft', 'm13-glow-live', 'm13-gt-slow', 'm13-gt-flicker', 'm13-st-day');
    xLook();
    stage.setAttribute('style', '');
    var cr = c.back && c.back.routeId ? routeById(c.back.routeId) : null;
    if (sty.st.glow === 'soft' || sty.st.glow === 'live') { stage.classList.add('m13-glow-' + sty.st.glow); stage.setAttribute('style', glowVars(sty.st)); }
    stage.setAttribute('style', [stage.getAttribute('style'), iconVars(sty.st, cr)].filter(Boolean).join(';'));
    if (sty.st.glow === 'live' && TEMPO[sty.st.glowTempo]) stage.classList.add(TEMPO[sty.st.glowTempo]);
    var sub = opt(f.subtitle), live = liveOf(c);
    front.innerHTML = '<div>' +
      (eyeOf(f) ? '<div class="m13-hero-type">' + txt(eyeOf(f)) + '</div>' : '') +
      (f.title ? '<div class="m13-hero-title">' + txt(f.title) + '</div>' : '') +
      (sub ? '<div class="m13-hero-date">' + txt(sub) + '</div>' : '') +
      statusHTML(c, 'm13-hero-status') +
      '</div><div class="m13-flip-hint">' + txt(T('flipHint') || 'Нажать — открыть оборот') + '</div>' + (live ? '' : evPeekHTML(c)) + sty.lay;
    if (front.querySelector('.m13-evp')) front.classList.add('m13-has-ev', 'm13-deco');
    // Маршрут идёт — карта сегодняшнего дня; закончился — финальный ролик (тогда ближайшее событие на увеличенной карточке не показываем)
    if (live && live.kind === 'day') { front.classList.add('m13-front--day'); stage.classList.add('m13-st-day'); front.innerHTML = dayFrontHTML(live) + sty.lay;
      // Край картинки дня (её выбор 07.10, панель → карточка → «Увеличенная карточка маршрута»): f.dayEdge '' — мягкий, уходит в тёмный цвет карточки |
      // 'strong' — тает в прозрачность (сквозь край видна картинка карточки) | 'hard' — ровный; f.dayEdgeH — высота перехода, % картинки (обычно 22);
      // f.dayBg 'dark' — под картой дня ровный тёмный фон вместо картинки карточки
      // 'oval' — тает со всех сторон овалом, без размытых боков; 'bg' — картинка — фон карточки: сверху во всю ширину, ниже темнеет до ровного фона (её выбор 07.10, сделано 14.10)
      var de = { hard: 1, strong: 1, oval: 1, bg: 1 }[f.dayEdge] ? f.dayEdge : 'soft', dh = parseFloat(f.dayEdgeH);
      front.classList.add('m13-dce-' + de);
      front.style.setProperty('--m13-dce', (isNaN(dh) ? (de === 'bg' ? 45 : de === 'oval' ? 30 : 22) : Math.max(5, Math.min(70, dh))) + '%');
      if (f.dayBg === 'dark' || de === 'bg') front.style.backgroundImage = '';
      (function (box) {
        function fit() { if (document.documentElement.contains(box)) dcFit(stage, box); }
        dcMore(box); fit(); [].forEach.call(box.querySelectorAll('img'), function (im) { im.addEventListener('load', fit); });
        // Картинка уже 16:9 (квадратная, высокая) — края мягко уходят в размытый фон, без резкого шва
        [].forEach.call(box.querySelectorAll('.m13-dc-img'), function (wr) {
          var im = wr.querySelector('img:not(.m13-dc-bg)');
          function nar() { if (im.naturalWidth && im.naturalWidth / im.naturalHeight < 1.6) wr.classList.add('m13-dc-img--narrow'); }
          if (im.complete) nar(); else im.addEventListener('load', nar);
        });
        // Шрифты догружаются позже — текст меняет высоту; меряем ещё раз (иначе низ «таял» зря или не хватало места)
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit); setTimeout(fit, 400);
        if (!S.dcResize) { S.dcResize = true; window.addEventListener('resize', function () { var st = S.root.querySelector('.m13-big-stage'); dcFit(st, st.querySelector('.m13-front--day .m13-dc')); }); }
      })(front.querySelector('.m13-dc'));
    }
    if (live && live.kind === 'cover') { front.classList.add('m13-front--cover'); front.style.backgroundImage = ''; coverPaint(front, live); }
    if (live && live.kind === 'final') {
      front.classList.add('m13-front--film'); front.style.backgroundImage = '';
      front.innerHTML = filmHTML(live.r) + '<div class="m13-flip-hint">' + txt(T('flipHint') || 'Нажать — открыть оборот') + '</div>';
      filmsStart(front);
    }
    [].forEach.call(front.querySelectorAll('.m13-dc-go'), function (a) { a.addEventListener('click', function (e) { e.stopPropagation(); }); });
    // Оборот: тот же узор и кромка (без затемнения под текстом — там свои плашки)
    var back = S.root.querySelector('.m13-back'), blay = decoHTML(sty.st, false);
    back.querySelectorAll(':scope > .m13-lay').forEach(function (n) { n.remove(); });
    back.classList.toggle('m13-deco', !!blay); back.classList.toggle('m13-has-rim', !!sty.st.rim);
    if (blay) back.insertAdjacentHTML('beforeend', blay);

    S.acts = [];
    var backc = S.root.querySelector('#m13-backc'), isCal = isCalCard(c);
    backc.innerHTML = isCal ? calHTML(c) : backHTML(c);
    bindActs(backc);
    kaskFill(backc);
    if (backc.querySelector('[data-m13-kin],[data-m13-kin-go],[data-m13-kin-wheel]')) kinBind(backc);
    dcMore(backc);
    if (isCal) calBind(backc, c);
    backc.querySelectorAll('[data-m13-lb]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation(); var p = b.getAttribute('data-m13-lb').split(':'); openLightbox(+p[0], +p[1]);
      });
    });

    // Календарь месяца открывается сразу сеткой (без лицевой стороны и переворота)
    big.classList.toggle('m13-calmode', isCal);
    if (isCal) {
      calUnlight();
      big.classList.add('m13-noanim', 'is-flipped'); void big.offsetWidth; big.classList.remove('m13-noanim');
    } else big.classList.remove('is-flipped');
    var ov = S.root.querySelector('#m13-overlay');
    ov.classList.remove('m13-veil--light', 'm13-veil--clear');
    if (sty.st.veil === 'light' || sty.st.veil === 'clear') ov.classList.add('m13-veil--' + sty.st.veil);
    ov.classList.add('is-open');
    evenRows(backc);
    // Поворот телефона, смена ширины окна, догрузка шрифта — выровнять заново
    if (!S.evenBound) {
      S.evenBound = true;
      var again = function () { if (S.card) evenRows(); };
      window.addEventListener('resize', again);
      if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', again);
    }
    lock(true);
    pushLayer('card', closeCardNow, '#' + encodeURIComponent(c.id));
  }
  // Квадраты форматов: в каждом ряду название, цена и подпись получают одинаковую высоту (по самой высокой),
  // поэтому в ряду всё стоит на одном уровне, а сами квадраты остаются по центру.
  var EVEN_PARTS = ['.m13-format-name', '.m13-format-price', '.m13-format-note'];
  function evenRows(root) {
    (root || S.root).querySelectorAll('.m13-formats').forEach(function (g) {
      var cells = [].slice.call(g.children), rows = {};
      cells.forEach(function (c) {
        EVEN_PARTS.forEach(function (q) { var n = c.querySelector(q); if (n) n.style.minHeight = ''; });
        (rows[c.offsetTop] = rows[c.offsetTop] || []).push(c);
      });
      Object.keys(rows).forEach(function (k) {
        EVEN_PARTS.forEach(function (q) {
          var ns = rows[k].map(function (c) { return c.querySelector(q); }).filter(Boolean);
          var h = Math.max.apply(null, ns.map(function (n) { return n.offsetHeight; }).concat(0));
          ns.forEach(function (n) { n.style.minHeight = h ? h + 'px' : ''; });
        });
      });
    });
  }
  M13.evenRows = evenRows;
  function closeCardNow() {
    var ov = S.root.querySelector('#m13-overlay');
    filmsStop(S.root.querySelector('#m13-front'));
    ov.getAnimations && ov.getAnimations({ subtree: true }).forEach(function (a) { a.cancel(); });
    ov.style.visibility = '';
    ov.classList.remove('m13-folding');
    S.root.querySelector('#m13-overlay').classList.remove('is-open');
    S.root.querySelector('#m13-bigcard').classList.remove('is-flipped');
    lock(false); S.card = null;
  }

  M13.openCard = function (id, flipped) {
    openCard(id);
    if (flipped && S.card) S.root.querySelector('#m13-bigcard').classList.add('is-flipped');
  };

  /* ---------- Календарь месяца — вид карточки ----------
     card.monthCal = {on, meetLabel, specialLabel, freeLabel, freeHide:[id карточки], days:[{id, date, label, cardId}], starColor}.
     Даты не вводятся дважды: маршруты — даты маршрутов карточек, встречи — текст даты плашек («08 октября»),
     особые дни (порталы) — свой список. Нажатие на число: календарь складывается в свою карточку,
     из неё летят звёзды в карточки этого дня; они вспыхивают и остаются подсвеченными до следующего раза. */
  function isCalCard(c) { return !!(c && c.monthCal && c.monthCal.on); }
  M13.isCalCard = isCalCard;
  var MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  function monOf(w) {
    w = String(w || '').toLowerCase();
    var P = ['янв', 'фев', 'мар', 'апр', 'ма', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    for (var i = 0; i < 12; i++) if (i === 4 ? /^ма[йя]$/.test(w) : w.indexOf(P[i]) === 0) return i + 1;
    return 0;
  }
  // Числа месяца из текста даты плашки: «08 октября», «8 и 15 октября», «8–10 окт», «с 8 по 10 октября», «08.10», «08.10.2026».
  // Возвращает дни, попадающие в месяц ym = {y, m}.
  M13.calDaysIn = function (text, ym) {
    var t = String(text || '').toLowerCase().replace(/ё/g, 'е'), out = [];
    function add(d, m, y) { if (m === ym.m && (!y || y === ym.y || y === ym.y % 100) && d >= 1 && d <= new Date(ym.y, ym.m, 0).getDate() && out.indexOf(d) < 0) out.push(d); }
    var re = /((?:\d{1,2}\s*(?:,|и|по|–|—|-)\s*)*\d{1,2})\s*([а-я]{3,})(?:\s+(\d{4}))?/g, m;
    while ((m = re.exec(t))) {
      var mon = monOf(m[2]); if (!mon) continue;
      var parts = m[1].split(/\s*(,|и|по|–|—|-)\s*/), prev = null, range = false;
      parts.forEach(function (x) {
        if (/^\d+$/.test(x)) { var d = +x; if (range && prev) { for (var k = prev + 1; k <= d; k++) add(k, mon, +m[3] || 0); } else add(d, mon, +m[3] || 0); prev = d; range = false; }
        else range = /[–—-]|по/.test(x);
      });
    }
    var re2 = /(^|[^\d:])(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?(?![\d:])/g;
    while ((m = re2.exec(t))) add(+m[2], +m[3], m[4] ? +m[4] : 0);
    return out.sort(function (a, b) { return a - b; });
  };
  function calYM() {
    var sc = S.D.showcase || {}, k = /^(\d{4})-(\d{2})/.exec(sc.id || '') || /^(\d{4})-(\d{2})/.exec((sc.period || {}).from || '');
    var n = today(); return k ? { y: +k[1], m: +k[2] } : { y: n.getFullYear(), m: n.getMonth() + 1 };
  }
  M13.calMonthName = function (ym) { return MONTHS_NOM[ym.m - 1] + ' ' + ym.y; };
  // Цвет маршрута в календаре: свой (route.color) или по названию — синий, жёлтый, красный, белый
  function routeTone(r) {
    if (r.color) return r.color;
    var t = String(r.title || '').toLowerCase().replace(/ё/g, 'е');
    return /син/.test(t) ? '#4f7fd0' : /желт/.test(t) ? '#e3b53a' : /красн/.test(t) ? '#d25a45' : /бел/.test(t) ? '#f3efe6' : '#9a8fb8';
  }
  M13.routeTone = routeTone;
  function calModel(cal) {
    var ym = calYM(), n = new Date(ym.y, ym.m, 0).getDate(), days = {}, routes = [], dated = {}, i;
    // Цвет маршрута в календаре: свой у этого календаря (monthCal.routeColors), иначе цвет маршрута
    function rcol(r) { return ((cal.routeColors || {})[r.id]) || routeTone(r); }
    for (i = 1; i <= n; i++) days[i] = { routes: [], meets: [], special: [], cards: [] };
    function hit(d, key, x, cardId) { var o = days[d]; if (!o) return; o[key].push(x); if (cardId && o.cards.indexOf(cardId) < 0) o.cards.push(cardId); if (cardId) dated[cardId] = true; }
    var cards = (S.D.showcase.cards || []).filter(function (c) { return c && c.visible !== false && !isCalCard(c); });
    cards.forEach(function (c) {
      if (c.interactive === false || !c.back || c.back.type === 'static') return;
      var b = M13.toBlocks(c.back), r = b.routeId ? routeById(b.routeId) : null, rd = r && r.dates;
      var from = rd && parseDate(rd.from), to = rd && parseDate(rd.to);
      if (from && to) {
        var any = false;
        for (i = 1; i <= n; i++) {
          var dt = new Date(ym.y, ym.m - 1, i);
          if (dt >= from && dt <= to) { any = true; hit(i, 'routes', { id: r.id, color: rcol(r), title: r.title, start: +dt === +from, end: +dt === +to }, c.id); }
        }
        if (any && !routes.some(function (x) { return x.id === r.id; })) routes.push({ id: r.id, title: r.title, color: rcol(r) });
      }
      if (b.stub && b.stub.on) return;
      (b.blocks || []).forEach(function (x) {
        if (x.kind !== 'items' || x.visible === false) return;
        (x.items || []).forEach(function (it) {
          if (!it || it.visible === false) return;
          M13.calDaysIn(opt(it.date), ym).forEach(function (d) { hit(d, 'meets', { title: it.title || '' }, c.id); });
        });
      });
    });
    var ids = cards.map(function (c) { return c.id; });
    (cal.days || []).forEach(function (x) {
      var dt = parseDate(x.date); if (!dt || dt.getFullYear() !== ym.y || dt.getMonth() + 1 !== ym.m) return;
      hit(dt.getDate(), 'special', { title: x.label || '' }, ids.indexOf(x.cardId) >= 0 ? x.cardId : '');
    });
    // Карточки без дат (открывающиеся) — строкой «Когда удобно — по договорённости»
    var hide = cal.freeHide || [];
    var free = cards.filter(function (c) {
      return c.interactive !== false && c.back && c.back.type !== 'static' && !dated[c.id] && hide.indexOf(c.id) < 0;
    });
    return { ym: ym, n: n, days: days, routes: routes, free: free };
  }
  M13.calFree = function (c, data) {
    var keep = S.D; if (data) S.D = data;
    try { return calModel(c.monthCal || {}).free.map(function (x) { return x.id; }); } finally { S.D = keep; }
  };
  // Вид календаря: что летит (звёзды / снежинки), цвет полёта, линия маршрута, сила свечения, цвета встреч и особых дней
  function calSnow(cal) { return (cal && cal.flyer) === 'snow'; }
  function calStar(cal) { return (cal && cal.starColor) || (calSnow(cal) ? '#cfe8ff' : '#f1cf78'); }
  var CAL_LINES = { thread: 1, band: 1, wave: 1, cloud: 1 }, CAL_GLOW = { none: 0, soft: 1, bright: 1.8 };
  function calLook(cal, extra) {
    cal = cal || {};
    var line = CAL_LINES[cal.line] ? cal.line : 'thread', g = CAL_GLOW[cal.glow] != null ? CAL_GLOW[cal.glow] : 1;
    var lw = cal.lineW === 'mid' || cal.lineW === 'thick' ? cal.lineW : 'thin';
    return ' class="' + extra + ' m13-cal--' + line + ' m13-cal--lw-' + lw + (cal.lineMode === 'days' ? ' m13-cal--seg' : '') + (g ? '' : ' m13-cal--flat') + '" style="' +
      esc('--m13-star:' + calStar(cal) + ';--m13-cg:' + g + ';--m13-cm:' + (cal.meetColor || '#f1c65a') + ';--m13-cs:' + (cal.specialColor || '#b48ee0') +
        (cal.numColor ? ';--m13-cn:' + cal.numColor : '')) + '"';
  }
  // Сетка месяца: большая (кнопки-числа с подписями) или мини на лицевой стороне (только для вида)
  function calGridHTML(M, mini) {
    var ym = M.ym, t0 = today(), wd = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    var first = (new Date(ym.y, ym.m - 1, 1).getDay() + 6) % 7;
    var h = wd.map(function (x) { return '<span class="m13-cal-wd">' + (mini ? x.charAt(0) : x) + '</span>'; }).join('');
    for (var p = 0; p < first; p++) h += '<span class="m13-cal-pad" aria-hidden="true"></span>';
    for (var d = 1; d <= M.n; d++) {
      var o = M.days[d], dt = new Date(ym.y, ym.m - 1, d), col = (first + d - 1) % 7;
      var mark = o.meets.length && o.special.length ? ' m13-cal-both' : o.meets.length ? ' m13-cal-meet' : o.special.length ? ' m13-cal-spec' : '';
      var cls = 'm13-cal-day' + mark + (dt < t0 ? ' is-past' : '') + (+dt === +t0 ? ' is-today' : '') + (o.cards.length ? '' : ' is-empty');
      var bars = o.routes.slice(0, 2).map(function (r) {
        return '<i style="--c:' + esc(r.color) + '" class="' + ((r.start || col === 0 || d === 1) ? 'm13-s' : '') + ((r.end || col === 6 || d === M.n) ? ' m13-e' : '') + '"></i>';
      }).join('');
      var inner = '<span class="m13-cal-n">' + d + '</span><span class="m13-cal-bars">' + bars + '</span>';
      if (mini) { h += '<span class="' + cls + '">' + inner + '</span>'; continue; }
      var say = [d + ' ' + MONTHS_GEN[ym.m - 1]].concat(o.routes.map(function (r) { return r.title; }), o.meets.map(function (x) { return x.title; }),
        o.special.map(function (x) { return x.title; })).filter(Boolean).join(' · ');
      h += '<button type="button" class="' + cls + '" data-day="' + d + '" title="' + esc(say) + '" aria-label="' + esc(say) + '"' + (o.cards.length ? '' : ' disabled') + '>' + inner + '</button>';
    }
    return '<div class="m13-cal-grid">' + h + '</div>';
  }
  // Лицевая сторона карточки-календаря: мини-календарь (рисуется сам) или своя картинка и надписи (face: 'image')
  function calMiniHTML(c) {
    var cal = c.monthCal || {}, M = calModel(cal);
    return '<div' + calLook(cal, 'm13-calmini') + ' aria-hidden="true"><div class="m13-calmini-t">' + txt(cal.title || M13.calMonthName(M.ym)) + '</div>' + calGridHTML(M, true) + '</div>';
  }
  function calHTML(c) {
    var cal = c.monthCal || {}, M = calModel(cal), ym = M.ym;
    var hasM = Object.keys(M.days).some(function (k) { return M.days[k].meets.length; });
    var hasS = Object.keys(M.days).some(function (k) { return M.days[k].special.length; });
    // Пояснения под сеткой: маршруты — столбиком (на телефоне в два столбца), под ними — встречи и особые дни одной строкой
    var lgR = M.routes.map(function (r) { return '<span class="m13-lg-r"><span class="m13-cal-bars"><i class="m13-s m13-e" style="--c:' + esc(r.color) + '"></i></span><span>' + txt(r.title) + '</span></span>'; }).join('');
    var lgM = (hasM ? '<span class="m13-cal-meet"><b class="m13-cal-n">8</b><span>' + txt(cal.meetLabel || 'Встречи') + '</span></span>' : '') +
      (hasS ? '<span class="m13-cal-spec"><b class="m13-cal-n">4</b><span>' + txt(cal.specialLabel || 'Особые дни') + '</span></span>' : '');
    var legend = (lgR ? '<div class="m13-lg-routes">' + lgR + '</div>' : '') + (lgM ? '<div class="m13-lg-marks">' + lgM + '</div>' : '');
    var free = M.free.length ? '<div class="m13-cal-free"><span class="m13-cal-free-l">' + txt(cal.freeLabel || 'Когда удобно — по договорённости:') + '</span>' +
      M.free.map(function (x) { return '<button type="button" class="m13-cal-chip" data-to="' + esc(x.id) + '">' + txt((x.front || {}).title || '') + '</button>'; }).join('') + '</div>' : '';
    var hint = cal.hint || (calSnow(cal) ? 'Нажмите на число — снежинки покажут, что в этот день.' : 'Нажмите на число — звёзды покажут, что в этот день.');
    return '<div' + calLook(cal, 'm13-cal') + '>' +
      '<div class="m13-cal-head"><div class="m13-eyebrow">' + txt(cal.eyebrow || 'Календарь') + '</div>' +
      '<h3>' + txt(cal.title || M13.calMonthName(ym)) + '</h3>' + (cal.noHint ? '' : '<div class="m13-cal-hint">' + txt(hint) + '</div>') + '</div>' +
      calGridHTML(M, false) + (legend ? '<div class="m13-cal-legend">' + legend + '</div>' : '') + free + zpBridgeHTML() + '</div>';
  }
  function calBind(scope, c) {
    var M = calModel(c.monthCal || {});
    scope.querySelectorAll('.m13-cal-day[data-day]').forEach(function (b) {
      b.addEventListener('click', function () { var o = M.days[+b.getAttribute('data-day')]; if (o && o.cards.length) calFly(c, o.cards); });
    });
    scope.querySelectorAll('.m13-cal-chip[data-to]').forEach(function (b) {
      b.addEventListener('click', function () { calFly(c, [b.getAttribute('data-to')]); });
    });
    zpBridgeBind(scope, M.ym);
  }
  function thumbOf(id) { return S.root.querySelector('.m13-grid [data-card="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'); }
  function calUnlight() {
    if (S.calTimers) S.calTimers.forEach(clearTimeout);
    S.calTimers = [];
    S.root.querySelectorAll('.m13-lit').forEach(function (n) { n.classList.remove('m13-lit'); n.style.removeProperty('--m13-star'); });
    S.root.querySelectorAll('.m13-star,.m13-spark,.m13-flash').forEach(function (n) { n.remove(); });
    S.flying = 0;
  }
  // Вспышка карточки, в которую прилетела звезда: свет — отдельным слоем поверх карточки (меняется только прозрачность),
  // сама карточка лишь чуть «вздыхает» масштабом. Раньше мигали яркость и тень самой карточки — телефон перерисовывал её
  // каждый кадр, а яркость поднимала собственные цвета картинки (у оранжевой карточки вспышка выходила красной).
  function calFlash(t, col) {
    if (!t.animate) return;
    var r = t.getBoundingClientRect(), f = document.createElement('i');
    f.className = 'm13-flash';
    f.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;border-radius:' +
      getComputedStyle(t).borderRadius + ';--m13-star:' + col;
    S.root.appendChild(f);
    var k = [{ transform: 'scale(1)' }, { transform: 'scale(1.05)', offset: .18 }, { transform: 'scale(1)' }], o = { duration: 1000, easing: 'ease-out' };
    t.animate(k, o);
    f.animate([{ opacity: 0, transform: 'scale(1)' }, { opacity: 1, transform: 'scale(1.05)', offset: .18 }, { opacity: 0, transform: 'scale(1)' }], o)
      .onfinish = function () { f.remove(); };
  }
  function calFly(c, ids) {
    var col = calStar(c.monthCal), from = thumbOf(c.id);
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ov = S.root.querySelector('#m13-overlay'), stage = S.root.querySelector('.m13-big-stage');
    function light(t) {
      t.style.setProperty('--m13-star', col);
      t.classList.add('m13-lit');
      if (!reduce) calFlash(t, col);
    }
    // Последняя звезда долетела и карточка отвспыхивала — украшения под ней снова оживают
    function landed() { S.calTimers.push(setTimeout(function () { S.flying = 0; hushSync(); }, 1000)); }
    function launch() {
      var ts = ids.map(thumbOf).filter(Boolean);
      ts.forEach(function (t, i) {
        if (reduce || !from || !from.animate) { light(t); return; }
        S.calTimers.push(setTimeout(function () {
          flyStar(from, t, col, function () { light(t); if (i === ts.length - 1) landed(); }, calSnow(c.monthCal));
        }, i * 150));
      });
      if (!ts.length || reduce || !from || !from.animate) { S.flying = 0; hushSync(); }
    }
    calUnlight();
    S.flying = 1;
    if (reduce || !from || !stage.animate) { ov.style.visibility = 'hidden'; closeTop(); launch(); return; }
    // Календарь складывается в свою маленькую карточку
    var R = stage.getBoundingClientRect(), T = from.getBoundingClientRect();
    var m0 = getComputedStyle(stage).transform, ty0 = 0;
    try { ty0 = new DOMMatrix(m0 === 'none' ? undefined : m0).m42; } catch (e) {}
    var dx = (T.left + T.width / 2) - (R.left + R.width / 2), dy = (T.top + T.height / 2) - (R.top + R.height / 2) + ty0;
    var a = stage.animate([{ transform: m0 === 'none' ? 'none' : m0, opacity: 1 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + (T.width / R.width) + ',' + (T.height / R.height) + ')', opacity: .35 }],
      { duration: 460, easing: 'cubic-bezier(.55,.05,.4,1)', fill: 'forwards' });
    // Затемнение и размытие под календарём тают одним слоем (меняется только прозрачность — это телефон делает легко);
    // стеклянное размытие самого календаря на время складывания снимаем — его пришлось бы пересчитывать каждый кадр
    ov.classList.add('m13-folding');
    a.onfinish = function () { ov.style.visibility = 'hidden'; closeTop(); launch(); };
  }
  // Звезда (или снежинка, snow) летит по дуге из карточки a в карточку b, за ней — 7 искр
  function flyStar(a, b, col, done, snow) {
    var A = a.getBoundingClientRect(), B = b.getBoundingClientRect();
    var x0 = A.left + A.width / 2, y0 = A.top + A.height / 2, x1 = B.left + B.width / 2, y1 = B.top + B.height / 2;
    var dist = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
    var cx = (x0 + x1) / 2 - (y1 - y0) * .25, cy = Math.min(y0, y1) - Math.max(50, dist * .35);
    var kf = [];
    for (var i = 0; i <= 24; i++) {
      var t = i / 24, u = 1 - t;
      var x = u * u * x0 + 2 * u * t * cx + t * t * x1, y = u * u * y0 + 2 * u * t * cy + t * t * y1;
      kf.push({ transform: 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + (0.7 + Math.sin(t * Math.PI) * .7).toFixed(2) + ')' + (snow ? ' rotate(' + Math.round(t * 240) + 'deg)' : '') });
    }
    var dur = Math.max(560, Math.min(950, 420 + dist * .8)), opt2 = { duration: dur, easing: 'cubic-bezier(.45,0,.35,1)', fill: 'both' };
    function dot(cls, delay, k) {
      var n = document.createElement('i'); n.className = cls; n.style.setProperty('--m13-star', col); S.root.appendChild(n);
      var an = n.animate(kf.map(function (f, j) { return { transform: f.transform + (k ? ' scale(' + k + ')' : ''), opacity: k ? (1 - j / 24) * .9 : 1 }; }), Object.assign({}, opt2, { delay: delay }));
      an.onfinish = function () { n.remove(); };
      return an;
    }
    for (var s2 = 1; s2 <= 7; s2++) dot('m13-spark', s2 * 26, (1 - s2 / 9).toFixed(2));
    dot(snow ? 'm13-star m13-snow' : 'm13-star', 0, 0).addEventListener('finish', done);
  }

  /* ---------- Оборот: общее ---------- */
  function headHTML(c, extraMeta) {
    var f = c.front || {};
    var st = statusOf(c), pill = f.statusStyle === 'pill';
    var meta = [opt(f.subtitle), pill ? '' : st].concat(extraMeta || []).filter(Boolean);
    var mh = meta.map(function (m) { return '<span>' + txt(m) + '</span>'; }).join('') + (pill && st ? '<span class="m13-status-pill"><span>' + txt(st) + '</span></span>' : '');
    return '<div class="m13-head">' + (eyeOf(f) ? '<div class="m13-eyebrow">' + txt(eyeOf(f)) + '</div>' : '') +
      '<h2>' + txt(f.title) + '</h2>' +
      (mh ? '<div class="m13-meta">' + mh + '</div>' : '') +
      '</div>';
  }
  function descHTML(s) { return s ? '<div class="m13-desc">' + txt(s) + '</div>' : ''; }

  /* ---------- Оборот: маршрут ---------- */
  function dayCounter(r) {
    if (!r || !r.dates || !r.dates.from || !r.dates.to) return '';
    var from = parseDate(r.dates.from), to = parseDate(r.dates.to);
    var now = today();
    var DAY = 86400000;
    var n = Math.round((now - from) / DAY) + 1, total = Math.round((to - from) / DAY) + 1;
    if (n < 1 || n > total) return '';
    return fill(T('dayCounter') || 'Сегодня день {n} из {total}', { n: n, total: total });
  }

  /* ---------- Оборот: контейнер (встречи, индивидуальная работа) ---------- */
  // Плашки-элементы (встречи, виды работы, варианты продукта) — одна общая схема.
  // Блок x (docs/plashki.md, 19.10): view 'list' (как было) | 'tiles' — по две в ряд, нажатие — окошко; lastTile 'center' | 'wide'; tileShape 'square' | 'card' (4:5).
  // У плашки: image — картинка (в списке маленькая слева, в плитке сверху); kinWheel — вместо картинки живое колесо «Узнать свой кин», нажатие — страница кина;
  // wide — во всю ширину карточки (её решение 29.10: встреча-знакомство — основа под остальными плашками): слева название, справа цена и кнопка.
  function itemsHTML(c, list, max, tplKey, x) {
    var items = visibleSorted(list, max || 10);
    if (!items.length) return '';
    x = x || {};
    if (x.view === 'tiles') return tilesHTML(c, items, tplKey, x);
    // Автовыравнивание: если какая-то часть (дата, описание, срок, цена) есть хотя бы у одной плашки,
    // у остальных на её месте пустая строка — тогда в ряду названия, цены и «Написать →» стоят на одном уровне.
    var one = items.length === 1, has = {};
    items.forEach(function (it) {
      if (opt(it.date)) has.date = 1; if (opt(it.text)) has.text = 1; if (opt(it.price)) has.price = 1;
      if (opt(it.duration) || opt(it.status)) has.meta = 1;
    });
    var solo = one;
    function part(cls, on, html) { return on ? '<div class="' + cls + '">' + html + '</div>' : (has[cls.slice(9)] && !solo ? '<div class="' + cls + '"></div>' : ''); }
    var rows = 2 + (has.date ? 1 : 0) + (has.text ? 1 : 0) + (has.meta ? 1 : 0) + (has.price ? 1 : 0);
    return '<div class="m13-items' + (one ? ' m13-items--one' : ' m13-items--rows') + '" style="--rows:' + rows + '">' + items.map(function (it) {
      var date = opt(it.date), text = opt(it.text), dur = opt(it.duration), price = opt(it.price), status = opt(it.status);
      var meta = [dur, status].filter(Boolean).join(' · ');
      var a = it.action || { kind: 'contact' };
      var ctx = { card: (c.front || {}).title, item: it.title, date: date, price: price, tplKey: tplKey };
      var cal = it.calendar && it.calendar.on && calActive(it.calendar) ? it.calendar : null;
      var pic = itemPic(it, 'm13-item-pic'), pc = pic ? ' m13-item--pic' + kinBgCls(it) : '';
      solo = one || !!it.wide;
      if (it.wide && !one) pc += ' m13-item--wide';
      if (it.kinWheel) { a = { kind: 'internal', target: 'kin' }; if (!a.label) a.label = kinT('wpGo').replace(/\s*→\s*$/, ''); }
      if (cal && !it.kinWheel) return '<div class="m13-item m13-item--cal' + pc + '" role="button" tabindex="0"' + act(a, ctx) + kinStyle(it) + '>' + pic +
        part('m13-item-date', date, txt(date)) +
        '<div class="m13-item-title">' + txt(it.title) + '</div>' +
        part('m13-item-text', text, txt(text)) +
        part('m13-item-meta', meta, txt(meta)) +
        part('m13-item-price', price, txt(price)) +
        '<div class="m13-item-acts"><span class="m13-item-action">' + txt(a.label || 'Написать') + ' →</span>' +
        '<button type="button" class="m13-item-cal"' + act({ kind: 'calendar', cal: cal }, ctx) + '>' + txt(cal.label || T('calendarButton') || 'В календарь') + '</button></div></div>';
      if (it.wide && !one) return '<button type="button" class="m13-item' + pc + '"' + act(a, ctx) + kinStyle(it) + '>' + pic +
        '<div class="m13-item-main">' + part('m13-item-date', date, txt(date)) +
        '<div class="m13-item-title">' + txt(it.title || (it.kinWheel ? kinT('wpTitle') : '')) + '</div>' +
        part('m13-item-text', text, txt(text)) + part('m13-item-meta', meta, txt(meta)) + '</div>' +
        '<div class="m13-item-side">' + part('m13-item-price', price, txt(price)) +
        '<div class="m13-item-action">' + txt(a.label || 'Написать') + ' →</div></div></button>';
      return '<button type="button" class="m13-item' + pc + '"' + act(a, ctx) + kinStyle(it) + '>' + pic +
        part('m13-item-date', date, txt(date)) +
        '<div class="m13-item-title">' + txt(it.title || (it.kinWheel ? kinT('wpTitle') : '')) + '</div>' +
        part('m13-item-text', text, txt(text)) +
        part('m13-item-meta', meta, txt(meta)) +
        part('m13-item-price', price, txt(price)) +
        '<div class="m13-item-action">' + txt(a.label || 'Написать') + ' →</div></button>';
    }).join('') + '</div>';
  }

  // Картинка плашки или живое колесо кина (колесо монтирует kinBind)
  function itemPic(it, cls) {
    if (it.kinWheel) return '<span class="' + cls + ' m13-pic-kw"><span class="m13-kwm" data-m13-kin-wheel></span></span>';
    return it.image ? '<span class="' + cls + '"><img src="' + esc(media(it.image)) + '" alt="" loading="lazy"></span>' : '';
  }
  function kinBgCls(it) { return it.kinWheel ? ' m13-kwb--' + kinMini().bg : ''; }
  function kinStyle(it) { var css = it.kinWheel ? kinLookCss(kinLook()) : ''; return css ? ' style="' + esc(css) + '"' : ''; }
  // Плитки: по две в ряд (и на телефоне), сверху картинка, под ней название и коротко цена; нечётная последняя — по центру или во всю ширину
  function tilesHTML(c, items, tplKey, x) {
    var odd = items.filter(function (it) { return !it.wide; }).length % 2 === 1, wide = x.lastTile === 'wide', last = items.length - 1;
    while (last > 0 && items[last].wide) last--;
    return '<div class="m13-tiles m13-tiles--' + (x.tileShape === 'card' ? 'card' : 'square') + '">' + items.map(function (it, i) {
      var date = opt(it.date), price = opt(it.price), a = it.action || { kind: 'contact' };
      var ctx = { card: (c.front || {}).title, item: it.title, date: date, price: price, tplKey: tplKey };
      var cls = 'm13-item m13-tile' + (it.wide ? ' m13-tile--wide' : odd && i === last && items.length > 1 ? (wide ? ' m13-tile--wide' : ' m13-tile--mid') : '') + kinBgCls(it);
      var line = price || (it.kinWheel ? opt(it.text) || kinT('wpSub') : '');   // у колеса — своё «Короткое описание», пусто — запасная строка
      var cal = it.calendar && it.calendar.on && calActive(it.calendar) ? it.calendar : null;
      var at = it.kinWheel ? act({ kind: 'internal', target: 'kin' }) : ' data-m13-tile="' + (S.tiles.push({ it: it, a: a, ctx: ctx, cal: cal, shape: x.tileShape }) - 1) + '"';
      return '<button type="button" class="' + cls + '"' + at + kinStyle(it) + '>' + itemPic(it, 'm13-tile-pic') +
        '<span class="m13-tile-t">' + (date ? '<span class="m13-item-date">' + txt(date) + '</span>' : '') +
        '<span class="m13-item-title">' + txt(it.title || (it.kinWheel ? kinT('wpTitle') : '')) + '</span>' +
        (line ? '<span class="m13-item-price">' + txt(line) + '</span>' : '') + '</span></button>';
    }).join('') + '</div>';
  }
  // Окошко плитки: картинка, полный текст, цена и кнопка плашки (как настроено у неё); оформление — как у окна «Куда написать?»
  function openTile(i) {
    var t = S.tiles[i]; if (!t) return;
    var it = t.it, a = t.a, m = S.root.querySelector('#m13-tile');
    if (!m) {
      S.root.querySelector('#m13-modal').insertAdjacentHTML('beforebegin', '<div class="m13-modal m13-tilem" id="m13-tile" role="dialog" aria-modal="true" aria-labelledby="m13-tile-t">' +
        '<div class="m13-modal-box"></div></div>');
      m = S.root.querySelector('#m13-tile');
      m.addEventListener('click', function (e) { if (e.target === m) closeTop(); });
    }
    applyWin();
    var box = m.querySelector('.m13-modal-box'), date = opt(it.date), price = opt(it.price), full = opt(it.full) || opt(it.text);
    var meta = [opt(it.duration), opt(it.status)].filter(Boolean).join(' · ');
    box.querySelectorAll(':scope > :not(.m13-lay)').forEach(function (n) { n.remove(); });
    box.insertAdjacentHTML('afterbegin', '<div class="m13-tilem-in">' +
      (it.image ? '<img class="m13-tilem-img' + (t.shape === 'card' ? ' m13-tilem-img--card' : '') + '" src="' + esc(media(it.image)) + '" alt="">' : '') +
      (date ? '<div class="m13-eyebrow">' + txt(date) + '</div>' : '') +
      '<h3 id="m13-tile-t">' + txt(it.title) + '</h3>' +
      (meta ? '<div class="m13-tilem-meta">' + txt(meta) + '</div>' : '') +
      (full ? '<div class="m13-tilem-text">' + txt(full) + '</div>' : '') +
      (price ? '<div class="m13-tilem-price">' + txt(price) + '</div>' : '') +
      '<div class="m13-actions"><button type="button" class="m13-action m13-action--primary"' + act(a, t.ctx) + '>' + txt(a.label || 'Написать') + '</button>' +
      (t.cal ? '<button type="button" class="m13-action"' + act({ kind: 'calendar', cal: t.cal }, t.ctx) + '>' + txt(t.cal.label || T('calendarButton') || 'В календарь') + '</button>' : '') + '</div>' +
      '<button type="button" class="m13-modal-close">' + txt(T('close') || 'Закрыть') + '</button></div>');
    bindActs(box);
    box.querySelector('.m13-modal-close').addEventListener('click', closeTop);
    box.scrollTop = 0;
    var was = document.body.classList.contains('m13-locked');
    m.classList.add('is-open'); lock(true);
    pushLayer('tile', function () { m.classList.remove('is-open'); lock(was); });
  }

  /* ---------- Оборот из блоков ----------
     back = {type:'blocks', routeId?, blocks:[{id, kind, visible, …}]}. Порядок блоков = порядок в массиве.
     Старые типы (route, container, offer, text) переводятся в блоки функцией M13.toBlocks. */
  function oid() { return 'b-' + Math.random().toString(36).slice(2, 8); }
  function ov(f) { return f == null ? '' : (typeof f === 'object' ? (f.show === false ? '' : f.value || '') : f); }
  function blk(kind, props, visible) {
    var o = { id: oid(), kind: kind, visible: visible !== false };
    for (var k in props) o[k] = props[k];
    return o;
  }
  M13.toBlocks = function (b) {
    if (!b || !b.type || b.type === 'static' || b.type === 'blocks') return b;
    var out = { type: 'blocks', routeId: b.routeId || '', blocks: [] }, L = out.blocks;
    if (b.type === 'route') {
      L.push(blk('desc', { text: ov(b.description) }));
      L.push(blk('day', {}, !!(b.dayCounter && b.dayCounter.show)));
      L.push(blk('routeButton', { label: (b.routeButton || {}).label || 'Пройти маршрут', url: '' }, !!(b.routeButton && b.routeButton.show)));
      L.push(blk('formats', { formats: b.formats || [], closed: b.closedFormats || 'dim' }));
      var sb = b.sandboxButton || {};
      L.push(blk('sandbox', { label: sb.label || 'Как устроены маршруты 13 MIRRORS' }, sb.show !== false));
    } else if (b.type === 'container') {
      L.push(blk('desc', { text: ov(b.description) }, shown(b.description)));
      L.push(blk('items', { items: b.items || [], max: b.max || 10, copyItems: b.copyItems !== false, tpl: 'container' }));
      L.push(blk('info', { text: ov(b.note) }, !!opt(b.note)));
    } else if (b.type === 'offer') {
      L.push(blk('images', { images: (b.images || []).map(function (x) { return typeof x === 'string' ? { id: oid(), src: x, visible: true } : x; }) }, (b.images || []).length > 0));
      L.push(blk('desc', { text: ov(b.description) }, shown(b.description)));
      L.push(blk('price', { label: b.priceLabel || '', value: ov(b.price) }, !!opt(b.price)));
      L.push(blk('items', { items: b.items || [], max: b.max || 10, copyItems: b.copyItems !== false, tpl: 'offerItem' }, (b.items || []).length > 0));
      L.push(blk('dates', { label: ov(b.datesLabel), dates: ov(b.dates), note: ov(b.datesNote) }, !!opt(b.dates)));
      L.push(blk('info', { text: ov(b.composition) }, !!opt(b.composition)));
      var ex = b.examples || {};
      L.push(blk('examples', { label: ex.label || 'Примеры' }, !!ex.show));
      L.push(blk('actions', { actions: (b.actions || []).slice(0, 2) }, (b.actions || []).length > 0));
    } else {
      L.push(blk('heading', { text: ov(b.title) }, !!opt(b.title)));
      L.push(blk('desc', { text: ov(b.text) }));
      L.push(blk('actions', { actions: b.action && b.action.label ? [b.action] : [] }, !!(b.action && b.action.label && b.action.visible !== false)));
    }
    return out;
  };

  var BUTTON_KINDS = { examples: 1, actions: 1, sandbox: 1 };
  // Оборот-заглушка: пока подробностей нет. Блоки оборота не трогаются — показывается только шапка,
  // текст «скоро» и кнопка «Задать вопрос» (у маршрутов — ещё «Как устроены маршруты»).
  var GEN_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  M13.stubText = function (c, data) {
    var D = data || S.D, rs = (D && D.routes && D.routes.routes) || [];
    var rid = c && c.back && c.back.routeId, r = null;
    rs.forEach(function (x) { if (x.id === rid) r = x; });
    var from = r && r.dates && r.dates.from, m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from || '');
    var when = m ? +m[3] + ' ' + GEN_MONTHS[+m[2] - 1] : '';
    if (r) return (when ? 'Маршрут начнётся ' + when + '. ' : '') + 'Подробное описание, форматы участия и запись появятся здесь совсем скоро.\n\n' +
      'Если хочется узнать больше уже сейчас — задайте вопрос, я с радостью отвечу.';
    return 'Подробности появятся здесь совсем скоро.\n\nЕсли хочется узнать больше уже сейчас — задайте вопрос, я с радостью отвечу.';
  };
  // Кнопка «Как устроены маршруты» на заглушке: своя настройка, а если её не трогали — как на обычном обороте
  function stubSandbox(c, stub) {
    if (stub.sandbox != null) return stub.sandbox !== false;
    return ((M13.toBlocks(c.back || {}) || {}).blocks || []).some(function (x) { return x && x.kind === 'sandbox' && x.visible !== false; });
  }
  M13.stubSandbox = stubSandbox;
  function stubHTML(c, r, kin, stub) {
    var title = (c.front || {}).title || '';
    var text = String(stub.text || '').trim() || M13.stubText(c);
    var label = String(stub.ask || '').trim() || 'Задать вопрос';
    return headHTML(c, kin ? [kin] : []) +
      '<div class="m13-info m13-stub">' + txt(text) + '</div>' +
      '<div class="m13-actions m13-push">' +
      '<button type="button" class="m13-action m13-action--primary"' +
      act({ kind: 'contact', label: label, telegram: stub.telegram || '', vk: stub.vk || '', host: String(stub.host || '').trim() || hostAuto(r && r.title, 'question'), message: 'Здравствуйте! Хочу узнать подробнее про «' + title + '».' }, { card: title, action: label }) + '>' + txt(label) + '</button>' +
      (r && stubSandbox(c, stub) ? '<button type="button" class="m13-action"' + act({ kind: 'internal', target: 'sandbox' }) + '>' +
        txt(stub.sandboxLabel || 'Как устроены маршруты 13 MIRRORS') + '</button>' : '') +
      '</div>';
  }

  function backHTML(c) {
    var b = M13.toBlocks(c.back || {}) || {}, f = c.front || {}, title = f.title;
    var r = b.routeId ? routeById(b.routeId) : null;
    var kin = r ? opt(r.kin) : '';
    var list = (b.blocks || []).filter(function (x) { return x && x.visible !== false; });
    // Кнопки в самом конце оборота прижимаются книзу — как было в прототипе.
    var push = list.length;
    while (push > 0 && BUTTON_KINDS[list[push - 1].kind]) push--;
    if (push === list.length) push = -1; // номер первого блока нижней группы кнопок (или -1)
    var price = '';
    list.forEach(function (x) { if (x.kind === 'price' && !price) price = String(x.value || '').trim(); });

    S.lb = []; S.tiles = [];
    var stub = (c.back || {}).stub;
    if (stub && stub.on) return stubHTML(c, r, kin, stub);
    var h = headHTML(c, kin ? [kin] : []), btnRun = [], runPush = false;
    // «Как идти по маршруту» — справа в строке «Сегодня день …» (её просьба 06.10: под форматами появлялась прокрутка);
    // счётчика дня нет (маршрут ещё не начался или уже прошёл) — отдельной строкой справа над форматами
    var how = howtoLink(c), howAtDay = !!how && list.some(function (x) { return x.kind === 'day' && dayCounter(r); });
    function flushBtns() {
      if (!btnRun.length) return '';
      var out = '<div class="m13-actions' + (runPush ? ' m13-push' : '') + (btnRun.length > 2 ? ' m13-actions--grid' : '') + '">' + btnRun.join('') + '</div>';
      btnRun = []; runPush = false; return out;
    }
    list.forEach(function (x, i) {
      var html = '';
      if (x.kind === 'examples' || x.kind === 'actions') {
        if (i === push) runPush = true;
        if (x.kind === 'examples') btnRun.push('<button type="button" class="m13-action' + (btnRun.length ? '' : ' m13-action--primary') + '"' +
          act({ kind: 'internal', target: 'reflection' }) + '>' + txt(x.label || 'Примеры') + '</button>');
        else (x.actions || []).slice(0, 4).forEach(function (a) {
          if (!a || a.visible === false) return;
          if (a.kind === 'calendar' && !calActive(a.cal || {})) return;
          btnRun.push('<button type="button" class="m13-action' + (btnRun.length ? '' : ' m13-action--primary') + '"' +
            act(a, { card: title, action: a.label, price: price, tplKey: 'offer' }) + '>' + txt(a.label || 'Написать') + '</button>');
        });
        return;
      }
      h += flushBtns();
      if (x.kind === 'desc') html = descHTML(String(x.text || '').trim() || (r && r.description) || '');
      else if (x.kind === 'heading') { var t = String(x.text || '').trim(); if (t) html = '<div class="m13-block-title">' + txt(t) + '</div>'; }
      else if (x.kind === 'images') {
        var imgs = (x.images || []).filter(function (m) { return m && m.visible !== false && m.src; });
        if (imgs.length) html = galleryHTML(imgs, 'row');
      }
      else if (x.kind === 'price') {
        var pv = String(x.value || '').trim();
        if (pv) html = '<div class="m13-price-line"><span>' + txt(x.label || title) + '</span><strong>' + txt(pv) + '</strong></div>';
      }
      else if (x.kind === 'day') {
        var dc = dayCounter(r);
        if (dc) html = '<div class="m13-dayrow"><div class="m13-day">' + txt(dc) + '</div>' + (howAtDay ? how : '') + '</div>';
        // вопрос дня у костра (её решение 31.10): под счётчиком, тает дымом вскоре после переворота карточки
        if (x.koster) html += '<p class="m13-kask" data-m13-kask hidden></p>';
        howAtDay = false;
      }
      else if (x.kind === 'routeButton') {
        var url = String(x.url || '').trim() || (r && r.routeUrl) || '';
        if (url) html = '<a class="m13-go" href="' + esc(url) + '" target="_blank" rel="noopener"><span>' +
          txt(x.label || 'Пройти маршрут') + '</span><span aria-hidden="true">→</span></a>';
      }
      else if (x.kind === 'formats') {
        html = formatsHTML(c, x, r);
        if (how && html && !howAtDay && h.indexOf('m13-howto') < 0) html = '<div class="m13-dayrow m13-dayrow--how">' + how + '</div>' + html;
      }
      else if (x.kind === 'items') html = itemsHTML(c, x.items, x.max, x.tpl || 'container', x);
      else if (x.kind === 'dates') {
        var ds = String(x.dates || '').trim();
        if (ds) html = '<div class="m13-dates">' + (x.label ? '<div class="m13-dates-label">' + txt(x.label) + '</div>' : '') +
          '<div class="m13-dates-list">' + txt(ds) + '</div>' + (x.note ? '<div class="m13-dates-note">' + txt(x.note) + '</div>' : '') + '</div>';
      }
      else if (x.kind === 'facts') {
        var fl = (x.facts || []).filter(function (q) { return q && q.visible !== false && String(q.text || '').trim(); });
        if (fl.length) html = '<div class="m13-facts">' + fl.map(function (q) { return '<span class="m13-fact">' + txt(String(q.text).trim()) + '</span>'; }).join('') + '</div>';
      }
      else if (x.kind === 'more') {
        var mt = String(x.text || '').trim();
        if (mt) html = '<details class="m13-more"><summary><span class="m13-more-open">' + txt(x.label || 'Подробнее') + ' ↓</span>' +
          '<span class="m13-more-close">' + txt(x.labelClose || 'Свернуть') + ' ↑</span></summary><div class="m13-more-text">' + txt(mt) + '</div></details>';
      }
      else if (x.kind === 'info') { var it = String(x.text || '').trim(); if (it) html = '<div class="m13-info">' + txt(it) + '</div>'; }
      else if (x.kind === 'kin') html = kinCardHTML(x, list);
      else if (x.kind === 'sandbox') {
        // m13-action — чтобы кнопка слушалась «Кнопок на обороте» (остальные кнопки: рамка или как главная; её просьба 27.10)
        html = '<button type="button" class="m13-soft m13-action' + (i === push ? ' m13-push' : '') + '"' + act({ kind: 'internal', target: 'sandbox' }) + '>' +
          txt(x.label || 'Как устроены маршруты 13 MIRRORS') + '</button>';
      }
      h += html;
    });
    h += flushBtns();
    return h;
  }

  function formatsHTML(c, x, r) {
    var rt = r || { title: (c.front || {}).title, routeUrl: '' };
    var list = (x.formats || []).filter(function (f) {
      return f.visible !== false && !(f.availability === 'closed' && x.closed === 'hide');
    });
    if (!list.length) return '';
    // Цена и подпись — у всех квадратов (пустые, если у этого нет), чтобы строки в ряду совпадали
    return '<div class="m13-formats" style="--n:' + Math.min(list.length, 3) + '">' + list.map(function (f) {
      var fm = formatById(f.formatId) || {};
      var name = f.title || fm.title || '';
      var price = (f.price && opt(f.price)) || fm.price || '';
      var note = (f.note && opt(f.note)) || opt(fm.note);
      var closed = f.availability === 'closed';
      if (closed) note = T('formatClosed') || 'набор закрыт';
      var inner = '<div class="m13-format-name">' + txt(name) + '</div>' +
        '<div class="m13-format-price">' + txt(price) + '</div>' +
        '<div class="m13-format-note">' + txt(note) + '</div>';
      if (closed) return '<div class="m13-format is-closed" aria-disabled="true">' + inner + '</div>';
      var ctx = { card: (c.front || {}).title, route: rt.title, format: name, price: price, routeUrl: rt.routeUrl, tplKey: 'route' };
      var a = f.action || { kind: 'contact' }, auto = (a.kind || 'contact') === 'contact' && !String(a.host || '').trim() && r && hostAuto(r.title, f.formatId);
      if (auto) a = Object.assign({}, a, { host: auto });
      return '<button type="button" class="m13-format"' + act(a, ctx) + '>' + inner + '</button>';
    }).join('') + '</div>';
  }
  // Под форматами — «Как идти по маршруту» (страница routes/<id>/kak/), если у маршрута по дням она заполнена (journeys[].howto, панель → «Как идти и отзыв»)
  function howtoLink(c) {
    var rid = c && c.back && c.back.routeId, j = rid ? journeyOf(rid) : null, h = j && j.howto;
    if (!h || h.on === false || h.card === '-' || !(h.sections || []).some(function (s) { return s && s.visible !== false && String(s.text || s.title || '').trim(); })) return '';
    return '<a class="m13-howto" href="' + esc(S.base + (j.path || 'routes/' + j.id + '/') + 'kak/') + '" target="_blank" rel="noopener"><span aria-hidden="true">?</span>' + txt(h.card || 'Как идти по маршруту') + '</a>';
  }

  /* ================= ОФОРМЛЕНИЕ ОКОН =================
     Окна «Куда написать?», «Добавить в календарь» и сообщение «Ссылка скопирована» берут оформление того, откуда открыты:
     с карточки — её оборот (цвет, прозрачность, размытие, цвет текста, шрифт, кнопки, контур), со страницы Песочницы,
     Событий или Примеров — оформление страницы. Своё оформление окон: showcase.cardStyle.win / look.win =
     {mode:'own', bg, glass, blur, text, font, accent, btnStyle, rim, rimColor}; mode '' — как у карточки (страницы).
     Ничего не оформлено — белые, как раньше. */
  function pageLookOf(w) { return (w === 'sandbox' ? (S.D.sandbox || {}).look : w === 'events' ? (S.D.events || {}).look : (S.D.reflection || {}).look) || {}; }
  function winFrom(o) {
    var rgb = hexRgb(o.bg || '#ffffff'), dark = lum(rgb) < 128;
    // Незаметная подложка: даже у очень прозрачного окна текст читается (не меньше 62% цвета и размытие за окном)
    var glass = Math.max(0, Math.min(90, +o.glass || 0)), a = Math.max(0.62, 1 - glass / 100);
    var blur = glass ? Math.max(8, +o.blur || 0) : 0;
    var tx = o.text || (dark ? '#efe4d2' : '#232323'), txLight = lum(hexRgb(tx)) > 128;
    var ac = o.accent || (txLight ? '#efe4d2' : '#232323');
    var cls = ['m13-win'], css = ['--w-bg:rgba(' + rgb.join(',') + ',' + a.toFixed(2) + ')', '--w-tx:' + tx, '--w-ac:' + ac, '--w-ac-ink:' + inkFor(ac)];
    if (blur) css.push('--w-blur:' + blur + 'px');
    if (o.font) { ensureFont(o.font); css.push("--w-font:'" + o.font + "',Georgia,serif"); cls.push('m13-win--font'); }
    if (o.accent) css.push(accentVars(o));
    if (o.btn) { var bl = buttonLook(o.btn, txLight); cls = cls.concat(bl.cls); css = css.concat(bl.css); }
    var lay = '';
    if (o.rim) {
      lay = decoHTML({ rim: o.rim, rimColor: o.rimColor, rimLive: o.rimLive, rimRunColor: o.rimRunColor, rimSpeed: o.rimSpeed, rimPlace: o.rimPlace, accent: o.accent }, false);
      cls.push('m13-has-rim');
      css.push('--w-rim:' + (o.rimColor || { light: 'rgba(255,255,255,.85)', cold: 'rgba(214,234,255,.95)' }[o.rim] || o.accent || '#ecd3a3'));
    }
    return { cls: cls, css: css, lay: lay };
  }
  function cardWin(c) {
    var st = cardStyle(c);
    if (!st.backBg && !st.backGlass && !st.backText && !st.font && !st.btnStyle && !st.rim && !st.accent) return null;
    return winFrom({ bg: st.backBg || '#f8f8f8', glass: st.backGlass, blur: st.backBlur, text: st.backText, font: st.font, accent: st.accent, btn: st,
      rim: st.rim, rimColor: st.rimColor, rimLive: st.rimLive, rimRunColor: st.rimRunColor, rimSpeed: st.rimSpeed, rimPlace: st.rimPlace });
  }
  function pageWin(lk) {
    if (lk.glass && typeof lk.glass === 'object') lk = Object.assign({}, lk, { glass: '' });
    if (!lk.panelBg && !lk.textColor && !lk.accent && !lk.glass && !lk.font) return null;
    return winFrom({ bg: lk.panelBg || '#ffffff', glass: lk.glass, blur: lk.glassBlur == null || lk.glassBlur === '' ? 8 : lk.glassBlur,
      text: lk.textColor, font: lk.font, accent: lk.accent });
  }
  function ownWin(w) {
    var rim = w.rim && w.rim !== 'none' ? w.rim : '';
    var tx = w.text || (lum(hexRgb(w.bg || '#ffffff')) < 128 ? '#efe4d2' : '#232323');
    return winFrom({ bg: w.bg || '#ffffff', glass: w.glass, blur: w.blur == null || w.blur === '' ? 10 : w.blur, text: w.text, font: w.font, accent: w.accent,
      btn: w.btnStyle && w.btnStyle !== 'none' ? { btnStyle: w.btnStyle, btnColor: w.accent || tx, accent: w.accent } : null, rim: rim, rimColor: w.rimColor });
  }
  function winSource() {
    var n = S.from && S.from.isConnected ? S.from : null;
    var pg = n && n.closest ? n.closest('[data-m13-page]') : null;
    if (!pg && !S.card) pg = S.root.querySelector('.m13-internal.is-open [data-m13-page]') || (S.view !== 'showcase' ? S.root.querySelector('[data-m13-page]') : null);
    var win;
    if (pg) {
      var lk = pageLookOf(pg.getAttribute('data-m13-page'));
      win = lk.win || {};
      return win.mode === 'own' ? ownWin(win) : pageWin(lk);
    }
    win = ((S.D.showcase && S.D.showcase.cardStyle) || {}).win || {};
    return win.mode === 'own' ? ownWin(win) : cardWin(S.card);
  }
  function applyWin() {
    var L = winSource();
    ['#m13-modal', '#m13-cal', '#m13-tile'].forEach(function (id) {
      var box = S.root.querySelector(id + ' .m13-modal-box'); if (!box) return;
      box.className = 'm13-modal-box' + (L ? ' ' + L.cls.join(' ') : '');
      box.setAttribute('style', L ? L.css.join(';') : '');
      box.querySelectorAll(':scope > .m13-lay').forEach(function (x) { x.remove(); });
      if (L && L.lay) box.insertAdjacentHTML('beforeend', L.lay);
    });
    var t = S.root.querySelector('#m13-toast');
    if (t) {
      var on = t.classList.contains('is-on');
      t.className = 'm13-toast' + (L ? ' m13-win-t' + (L.cls.indexOf('m13-win--font') >= 0 ? ' m13-win--font' : '') + (L.lay ? ' m13-has-rim' : '') : '') + (on ? ' is-on' : '');
      t.setAttribute('style', L ? L.css.join(';') : '');
    }
  }
  // Для панели: «Посмотреть окно» — открыть «Куда написать?» и «Ссылка скопирована» там, где сейчас витрина или страница
  M13.demoWin = function () {
    S.from = S.card ? S.root.querySelector('#m13-backc') : S.root.querySelector('.m13-internal.is-open [data-m13-page]') || S.root.querySelector('[data-m13-page]');
    openContact({ kind: 'contact' }, { card: S.card ? (S.card.front || {}).title : 'Пример' });
    setTimeout(function () { toast(T('shareCopied') || 'Ссылка скопирована — её можно отправить в чат.'); }, 500);
  };

  /* ================= ОКНО «КУДА НАПИСАТЬ?» ================= */
  function modalHTML() {
    return '<div class="m13-modal" id="m13-modal" role="dialog" aria-modal="true" aria-labelledby="m13-modal-t">' +
      '<div class="m13-modal-box">' +
      '<div class="m13-eyebrow" id="m13-modal-e"></div>' +
      '<h3 id="m13-modal-t"></h3>' +
      '<div class="m13-msg"><div class="m13-msg-label" id="m13-modal-l"></div><div id="m13-modal-m"></div></div>' +
      '<div class="m13-channels"><button type="button" class="m13-channel" data-ch="telegram">Telegram</button>' +
      '<button type="button" class="m13-channel" data-ch="vk">VK</button></div>' +
      '<p class="m13-hint" id="m13-modal-h" aria-live="polite"></p>' +
      '<button type="button" class="m13-modal-close" id="m13-modal-x"></button>' +
      '</div></div>';
  }
  var contactNow = null;
  function bindModal() {
    var m = S.root.querySelector('#m13-modal');
    m.addEventListener('click', function (e) { if (e.target === m) closeTop(); });
    S.root.querySelector('#m13-modal-x').addEventListener('click', closeTop);
    m.querySelectorAll('[data-ch]').forEach(function (b) {
      b.addEventListener('click', function () { goChannel(b.getAttribute('data-ch')); });
    });
  }
  function tgName(h) {
    return String(h || '').trim().replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\//i, '').replace(/^@/, '').replace(/[\/?#].*$/, '');
  }
  // Бот Host: имя — в «Настройках» (contacts.host), метка — у кнопки (action.host), вводится вручную.
  // Ссылка https://t.me/<бот>?start=<метка>: бот получит метку, когда человек нажмёт «Запустить».
  // Метки Host по печатям (её таблица 21.10): печать маршрута — по его названию, дальше _observation / _journey / _immersion / _question.
  // Своя «Метка Host» у кнопки главнее; пустая — ставится сама, если название маршрута — одна из 20 печатей.
  var HOST_SEALS = {
    'красный дракон': 'red_dragon', 'белый ветер': 'white_wind', 'синяя ночь': 'blue_night', 'жёлтое семя': 'yellow_seed',
    'красный змей': 'red_serpent', 'белый соединитель миров': 'white_worldbridger', 'синяя рука': 'blue_hand', 'жёлтая звезда': 'yellow_star',
    'красная луна': 'red_moon', 'белая собака': 'white_dog', 'синяя обезьяна': 'blue_monkey', 'жёлтый человек': 'yellow_human',
    'красный небесный странник': 'red_skywalker', 'белый волшебник': 'white_wizard', 'синий орёл': 'blue_eagle', 'жёлтый воин': 'yellow_warrior',
    'красная земля': 'red_earth', 'белое зеркало': 'white_mirror', 'синяя буря': 'blue_storm', 'жёлтое солнце': 'yellow_sun'
  };
  var HOST_FORMATS = { observe: 'observation', journey: 'journey', immersion: 'immersion', question: 'question' };
  function hostAuto(routeTitle, what) {
    var t = String(routeTitle || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim(), seal = '';
    for (var k in HOST_SEALS) if (k.replace(/ё/g, 'е') === t) seal = HOST_SEALS[k];
    return seal && HOST_FORMATS[what] ? seal + '_' + HOST_FORMATS[what] : '';
  }
  M13.hostAuto = hostAuto;
  function hostUrl(label, bot) {
    label = String(label || '').trim(); bot = tgName(bot);
    return bot && /^[A-Za-z0-9_-]{1,64}$/.test(label) ? 'https://t.me/' + encodeURIComponent(bot) + '?start=' + label : '';
  }
  function contactUrl(ch, handle, message) {
    var h = String(handle || '').trim();
    if (!h) return '';
    if (ch === 'telegram') {
      // Ссылка на бота с меткой, вписанная целиком (t.me/имя_бота?start=метка), — тоже работает
      var start = (h.match(/[?&]start=([A-Za-z0-9_-]{1,64})/) || [])[1];
      h = tgName(h);
      if (start) return 'https://t.me/' + encodeURIComponent(h) + '?start=' + start;
      return 'https://t.me/' + encodeURIComponent(h) + (message ? '?text=' + encodeURIComponent(message) : '');
    }
    h = h.replace(/^https?:\/\/(m\.)?(vk\.com|vk\.me)\//i, '').replace(/^@/, '').replace(/\/.*$/, '');
    return 'https://vk.me/' + encodeURIComponent(h);
  }
  function copyText(s) {
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = s; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, s.length);
        var ok = document.execCommand('copy'); document.body.removeChild(ta); return ok;
      } catch (e) { return false; }
    }
    var ok = fallback();
    if (!ok && navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(s).catch(function () {}); ok = true; }
    return ok;
  }
  function openContact(action, ctx) {
    var st = S.D.settings, def = st.contacts || {};
    var tpl = action.message || (st.messages || {})[ctx.tplKey] || 'Здравствуйте! Пишу насчёт «{card}».';
    var message = fill(tpl, {
      card: ctx.card || '', route: ctx.route || '', format: ctx.format || '', item: ctx.item || '',
      date: ctx.date || '', price: ctx.price || '', action: ctx.action || action.label || ''
    });
    contactNow = {
      message: message,
      telegram: action.telegram || def.telegram || '',
      host: hostUrl(action.host, def.host),
      vk: action.vk || def.vk || ''
    };
    var title = [ctx.format || ctx.item || (ctx.tplKey === 'offer' ? action.label : ''), ctx.route || ctx.card]
      .filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(' · ');
    var q = function (id) { return S.root.querySelector(id); };
    q('#m13-modal-e').textContent = T('contactTitle') || 'Куда написать?';
    q('#m13-modal-t').textContent = title || ctx.card || '';
    q('#m13-modal-l').textContent = T('contactMessageLabel') || 'Текст обращения';
    q('#m13-modal-m').textContent = message;
    var hint = q('#m13-modal-h');
    hint.textContent = T('contactHint'); hint.classList.remove('is-done');
    q('#m13-modal-x').textContent = T('close') || 'Закрыть';
    applyWin();
    q('#m13-modal').classList.add('is-open');
    pushLayer('contact', function () { q('#m13-modal').classList.remove('is-open'); contactNow = null; });
  }
  function goChannel(ch) {
    if (!contactNow) return;
    var url = ch === 'telegram' && contactNow.host || contactUrl(ch, contactNow[ch], ch === 'telegram' ? contactNow.message : '');
    // В бота Host текст не копируем: метка уже говорит, откуда человек пришёл
    if (ch === 'telegram' && /[?&]start=/.test(url)) { window.open(url, '_blank', 'noopener'); return; }
    var copied = copyText(contactNow.message);
    var hint = S.root.querySelector('#m13-modal-h');
    var name = ch === 'telegram' ? 'Telegram' : 'VK';
    if (url) {
      window.open(url, '_blank', 'noopener');
      hint.textContent = copied ? (T('contactCopied') || 'Текст скопирован — вставьте его в чат.') : '';
    } else {
      hint.textContent = fill(T('contactMissing') || 'Ссылка на {channel} ещё не задана.', { channel: name });
    }
    hint.classList.add('is-done');
  }

  /* ================= «ДОБАВИТЬ В КАЛЕНДАРЬ» =================
     cal = {date:'ГГГГ-ММ-ДД', time:'ЧЧ:ММ'?, duration: минут, title?, place?, details?}.
     Время — московское (UTC+3, без перехода на летнее). Календарь человека сам пересчитает в его пояс.
     Ничего никуда не отправляется: Google открывает готовое событие, файл .ics собирается прямо в браузере. */
  var MSK = 3;
  function calRange(cal) {
    var d = String(cal.date || '').split('-'); if (d.length !== 3) return null;
    var t = /^(\d{1,2}):(\d{2})$/.exec(String(cal.time || '').trim());
    if (!t) { // весь день
      var a = new Date(Date.UTC(+d[0], +d[1] - 1, +d[2])), b = new Date(a.getTime() + 86400000);
      return { allDay: true, start: a, end: b };
    }
    var st = new Date(Date.UTC(+d[0], +d[1] - 1, +d[2], +t[1] - MSK, +t[2]));
    return { allDay: false, start: st, end: new Date(st.getTime() + (+cal.duration || 60) * 60000) };
  }
  // После окончания события кнопка «в календарь» сама пропадает.
  function calActive(cal) { var r = calRange(cal || {}); return !!r && r.end.getTime() > (window.M13_TODAY ? today().getTime() : Date.now()); }
  function z(n) { return (n < 10 ? '0' : '') + n; }
  function utcStamp(dt, allDay) {
    var s = dt.getUTCFullYear() + z(dt.getUTCMonth() + 1) + z(dt.getUTCDate());
    return allDay ? s : s + 'T' + z(dt.getUTCHours()) + z(dt.getUTCMinutes()) + '00Z';
  }
  function calInfo(cal, ctx) {
    return { title: String(cal.title || '').trim() || [ctx.item, ctx.card].filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(' · '),
      place: String(cal.place || '').trim(), details: String(cal.details || '').trim() };
  }
  function googleUrl(cal, ctx) {
    var r = calRange(cal), inf = calInfo(cal, ctx);
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(inf.title) +
      '&dates=' + utcStamp(r.start, r.allDay) + '/' + utcStamp(r.end, r.allDay) +
      (inf.details ? '&details=' + encodeURIComponent(inf.details) : '') + (inf.place ? '&location=' + encodeURIComponent(inf.place) : '');
  }
  function icsText(cal, ctx) {
    var r = calRange(cal), inf = calInfo(cal, ctx);
    function e(v) { return String(v).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//13 MIRRORS//Vitrina//RU', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      'UID:' + utcStamp(r.start) + '-' + Math.random().toString(36).slice(2, 10) + '@13mirrors.ru', 'DTSTAMP:' + utcStamp(new Date()),
      r.allDay ? 'DTSTART;VALUE=DATE:' + utcStamp(r.start, true) : 'DTSTART:' + utcStamp(r.start),
      r.allDay ? 'DTEND;VALUE=DATE:' + utcStamp(r.end, true) : 'DTEND:' + utcStamp(r.end),
      'SUMMARY:' + e(inf.title)];
    if (inf.place) L.push('LOCATION:' + e(inf.place));
    if (inf.details) L.push('DESCRIPTION:' + e(inf.details));
    L.push('BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:' + e(inf.title), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR');
    return L.join('\r\n');
  }
  var MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function calHuman(cal) {
    var d = String(cal.date || '').split('-'), t = String(cal.time || '').trim();
    return (+d[2]) + ' ' + MONTHS_GEN[+d[1] - 1] + (t ? ', ' + t + ' ' + (T('calendarMsk') || 'по Москве') : '');
  }
  function calModalHTML() {
    return '<div class="m13-modal" id="m13-cal" role="dialog" aria-modal="true" aria-labelledby="m13-cal-t"><div class="m13-modal-box">' +
      '<div class="m13-eyebrow" id="m13-cal-e"></div><h3 id="m13-cal-t"></h3><div class="m13-cal-when" id="m13-cal-w"></div>' +
      '<div class="m13-channels m13-channels--col"><a class="m13-channel" id="m13-cal-g" target="_blank" rel="noopener"></a>' +
      '<a class="m13-channel m13-ch2" id="m13-cal-i" download="13mirrors.ics"></a></div>' +
      '<p class="m13-hint" id="m13-cal-h"></p><button type="button" class="m13-modal-close" id="m13-cal-x"></button></div></div>';
  }
  function openCalendar(cal, ctx) {
    if (!calRange(cal)) return;
    var q = function (id) { return S.root.querySelector(id); }, m = q('#m13-cal'), inf = calInfo(cal, ctx);
    q('#m13-cal-e').textContent = T('calendarTitle') || 'Добавить в календарь';
    q('#m13-cal-t').textContent = inf.title;
    q('#m13-cal-w').textContent = calHuman(cal) + (inf.place ? ' · ' + inf.place : '');
    var g = q('#m13-cal-g'); g.href = googleUrl(cal, ctx); g.textContent = T('calendarGoogle') || 'Google Календарь';
    var i = q('#m13-cal-i'); i.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(icsText(cal, ctx));
    i.textContent = T('calendarOther') || 'Apple или другой календарь';
    q('#m13-cal-h').textContent = cal.time ? (T('calendarNote') || 'Время указано московское — календарь сам покажет его в вашем часовом поясе.') : '';
    q('#m13-cal-x').textContent = T('close') || 'Закрыть';
    if (!m._bound) {
      m._bound = true;
      m.addEventListener('click', function (e) { if (e.target === m) closeTop(); });
      q('#m13-cal-x').addEventListener('click', closeTop);
    }
    applyWin();
    m.classList.add('is-open');
    pushLayer('calendar', function () { m.classList.remove('is-open'); });
  }

  /* ================= ЗАПИСЬ НА ВСТРЕЧУ (шаг 3 плана docs/zapis.md, 28.10) =================
     Плашка, чья метка (action.host) в панели включена «по календарю» («Запись» → «Виды встреч»), и строка-мостик под календарём
     витрины открывают окошко записи: свободные дни → время (Мск) → онлайн / очно → «Оплатить» (страница ЮKassa) → «Вы записаны».
     Свободное время и оплату ведёт программа записи на Beget (zapis.13mirrors.ru): о человеке туда ничего не уходит.
     Номер записи (Z-…) хранится только в браузере человека (localStorage m13-zapis) — чтобы после оплаты показать «Вы записаны».
     Запись выключена — у этих плашек «Запись временно через сообщение»; программа не отвечает — как раньше, «Куда написать?».
     settings.zapis = {look: 'calm' (по умолчанию) | 'vitrina' | 'own', own: {font: 'calm' | 'month' | имя шрифта, btn: fill | line | glass | shimmer,
     glint, mark: circle | glow | bold}, texts: {ключ: надпись}, bridge: {on, text, key}, tell: 'bot' (по умолчанию) | 'me'}. Цвета — всегда с витрины (как у «Куда написать?»).
     29.10: встреча без цены (встреча-знакомство) — «Записаться» вместо «Оплатить», запись сразу, без ЮKassa; номер такой записи — в localStorage
     m13-zapis-intro (новая запись с этого устройства отпускает прежнюю). Очные встречи: если встреча бывает и онлайн, и очно —
     сначала выбор «онлайн / очно», потом свободное время для этого вида (у очных своё: дорога, не больше N в день). */
  var ZP_URL = window.M13_ZAPIS_URL || 'https://zapis.13mirrors.ru/';
  var ZP_LS = 'm13-zapis';
  var ZP_LS_INTRO = 'm13-zapis-intro';
  // Надписи окна: [ключ, что это (для панели), как по умолчанию, длинная]. Подстановки: {название} {день} {время} {как} {часы} {цена} {минуты}
  var ZP_TXT = [
    ['eyebrow', 'Надпись над названием', 'Запись'],
    ['loading', 'Пока загружается', 'Смотрю свободное время…'],
    ['pick', 'Пока день не выбран', 'Выберите день — покажу свободное время.'],
    ['free', 'Пояснение: свободные дни', 'есть свободное время'],
    ['full', 'Пояснение: занятые дни', 'зачёркнуто — всё занято'],
    ['none', 'Свободного времени нет совсем', 'Сейчас всё время занято. Напишите мне — найдём время вместе.', true],
    ['times', 'Над временем', '{день} · время по Москве'],
    ['how', 'Над выбором «онлайн / очно» (когда очные встречи включены)', 'Как встречаемся'],
    ['online', 'Кнопка «онлайн»', 'онлайн'],
    ['offline', 'Кнопка «очно»', 'очно'],
    ['chosen', 'Над выбранным', 'Вы выбрали'],
    ['cancel', 'Про отмену и перенос', 'Если планы изменятся, напишите мне, пожалуйста, не позднее чем за {часы} до встречи.', true],
    ['pay', 'Кнопка оплаты', 'Оплатить {цена}'],
    ['agree', 'Под кнопкой оплаты (ссылка на «Условия и цены»)', 'Оплачивая, вы соглашаетесь с условиями записи и оплаты'],
    ['book', 'Кнопка записи у встречи без цены (встреча-знакомство)', 'Записаться'],
    ['booking', 'Пока записываю (встреча без цены)', 'Записываю…'],
    ['freeFull', 'Встреча без цены: на этот день запись уже заполнена', 'На этот день запись на эту встречу уже заполнена — выберите, пожалуйста, другой день.', true],
    ['ask', 'Кнопка вопроса', 'Задать вопрос'],
    ['askMsg', 'Сообщение для «Задать вопрос»', 'Здравствуйте! У меня вопрос про «{название}».', true],
    ['close', 'Кнопка закрыть', 'Закрыть'],
    ['paying', 'Пока открывается оплата', 'Открываю страницу оплаты ЮKassa…'],
    ['taken', 'Время только что заняли', 'Это время только что заняли — выберите, пожалуйста, другое.', true],
    ['many', 'Слишком много оплачивают сразу', 'Сейчас несколько человек одновременно оплачивают запись. Попробуйте, пожалуйста, через несколько минут.', true],
    ['soon', 'Оплата ещё не подключена (пока ЮKassa проверяет сайт)', 'Оплата на сайте скоро заработает. Напишите мне, пожалуйста, — запишу вас на это время.', true],
    ['backPick', 'Кнопка «назад к выбору»', '← Назад к выбору времени'],
    ['soonMsg', 'Сообщение, пока оплата не подключена', 'Здравствуйте! Хочу записаться: {название}, {день}, {время} (Мск), {как}.', true],
    ['payErr', 'Оплата не открылась', 'Не получилось открыть оплату. Попробуйте ещё раз или напишите мне.', true],
    ['checking', 'Проверка оплаты', 'Проверяю оплату…'],
    ['waitTitle', 'Оплата ещё не пришла: заголовок', 'Оплата ещё не пришла'],
    ['waitText', 'Оплата ещё не пришла: текст', 'Если вы уже оплатили, подождите минуту и нажмите «Проверить ещё раз».', true],
    ['hold', 'Сколько ещё держится время', 'Время держится за вами ещё'],
    ['check', 'Кнопка «проверить»', 'Проверить ещё раз'],
    ['payAgain', 'Кнопка «вернуться к оплате»', 'Вернуться к оплате'],
    ['dontPay', 'Кнопка «не оплачивать»', 'Не оплачивать, выбрать другое время'],
    ['goneTitle', 'Не оплачено: заголовок', 'Оплата не прошла'],
    ['goneText', 'Не оплачено: текст', 'Время снова свободно. Можно выбрать его ещё раз.', true],
    ['again', 'Кнопка «выбрать время»', 'Выбрать время'],
    ['doneTitle', 'После оплаты: заголовок', 'Вы записаны'],
    ['addCal', 'Кнопка календаря', 'Добавить в мой календарь'],
    ['addr', 'Очная встреча: подпись к адресу', 'Адрес'],
    ['noAddr', 'Очная встреча, адрес в панели не задан', 'Адрес пришлю в сообщении.'],
    ['contact', 'Просьба написать', 'Чтобы я могла с вами связаться, напишите мне, пожалуйста.', true],
    ['message', 'Готовое сообщение после записи', 'Здравствуйте! Я записан(а): {название}, {день}, {время} (Мск), {как}.', true],
    ['done', 'Кнопка в конце', 'Готово'],
    ['downTitle', 'Запись выключена или сбой: заголовок', 'Запись временно через сообщение'],
    ['downText', 'Запись выключена или сбой: текст', 'Сейчас я не вижу свободное время. Напишите мне — договоримся о дне и часе.', true],
    ['downBtn', 'Запись выключена или сбой: кнопка', 'Написать'],
    ['bridge', 'Строка-мостик под календарём витрины', 'Записаться на индивидуальную встречу →']
  ];
  M13.ZAPIS_TXT = ZP_TXT;
  var ZP_WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  var ZP_WD_FULL = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
  var ZP = { svc: null, svcT: 0, svcP: null, st: null, timer: 0 };

  function zpSet() { return (S.D && S.D.settings && S.D.settings.zapis) || {}; }
  function zpT(k) {
    var o = (zpSet().texts || {})[k];
    if (o != null && String(o).trim()) return String(o);
    for (var i = 0; i < ZP_TXT.length; i++) if (ZP_TXT[i][0] === k) return ZP_TXT[i][2];
    return '';
  }
  function zpPlural(n, a, b, c) { n = Math.abs(n) % 100; var k = n % 10; if (n > 10 && n < 20) return c; if (k > 1 && k < 5) return b; if (k === 1) return a; return c; }
  function zpRub(n) { return (+n || 0).toLocaleString('ru-RU') + ' ₽'; }
  // Дни — строки «2026-11-03» (по Москве); считаем в UTC, чтобы пояс человека не сдвигал числа
  function zpD(iso) { var p = String(iso).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function zpIso(d) { return d.getUTCFullYear() + '-' + z(d.getUTCMonth() + 1) + '-' + z(d.getUTCDate()); }
  function zpWd(iso) { return (zpD(iso).getUTCDay() + 6) % 7; }
  function zpDayLong(iso) { var d = zpD(iso); return ZP_WD_FULL[zpWd(iso)] + ', ' + d.getUTCDate() + ' ' + MONTHS_GEN[d.getUTCMonth()]; }
  function zpMin(t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1]); }
  function zpHm(m) { return z(Math.floor(m / 60)) + ':' + z(m % 60); }
  // «2026-10-28T17:39:38» по Москве → миллисекунды
  function zpMs(s) { var m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)/.exec(String(s || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - MSK, +m[5], +m[6]) : 0; }
  function zpLeft(until) { return Math.max(0, zpMs(until) - Date.now()); }
  // Подстановки в надписи окна
  function zpFill(k, st) {
    st = st || ZP.st || {};
    var sv = st.sv || {}, h = st.cancelH == null ? 12 : st.cancelH;
    var map = { 'название': sv.title || '', 'цена': sv.price ? zpRub(sv.price) : '', 'день': st.day ? zpDayLong(st.day) : '', 'время': st.time || '',
      'как': zpT(st.mode === 'offline' ? 'offline' : 'online'), 'часы': h + ' ' + zpPlural(h, 'час', 'часа', 'часов'),
      'минуты': st.holdMin ? st.holdMin + ' ' + zpPlural(st.holdMin, 'минуту', 'минуты', 'минут') : '' };
    return zpT(k).replace(/\{([а-яё]+)\}/g, function (m, w) { return map.hasOwnProperty(w) ? map[w] : m; }).replace(/\s{2,}/g, ' ').trim();
  }
  function zpStore(v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(ZP_LS) || 'null');
      if (v === null) localStorage.removeItem(ZP_LS); else localStorage.setItem(ZP_LS, JSON.stringify(v));
    } catch (e) {}
    return null;
  }
  function zpIntro(v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(ZP_LS_INTRO) || 'null');
      localStorage.setItem(ZP_LS_INTRO, JSON.stringify(v));
    } catch (e) {}
    return null;
  }
  function zpGet(q) {
    return fetch(ZP_URL + 'index.php?' + q, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('zapis ' + r.status); return r.json(); });
  }
  // text/plain — браузер отправляет сразу, без предварительного вопроса серверу
  function zpPost(a, body) {
    return fetch(ZP_URL + 'index.php?a=' + a, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body), cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('zapis ' + r.status); return r.json(); });
  }
  function zpServices() {
    if (ZP.svc && Date.now() - ZP.svcT < 120000) return Promise.resolve(ZP.svc);
    if (!ZP.svcP) ZP.svcP = zpGet('a=services').then(function (d) { ZP.svc = d; ZP.svcT = Date.now(); ZP.svcP = null; return d; },
      function (e) { ZP.svcP = null; throw e; });
    return ZP.svcP;
  }
  function zpKeyOf(a) { var k = String((a && a.host) || '').trim(); return /^[A-Za-z0-9_-]{1,60}$/.test(k) ? k : ''; }
  // Записывается ли эта встреча по календарю: 'open' — да, 'down' — запись сейчас выключена, '' — нет (обычное «Куда написать?»)
  function zpHow(d, key) {
    if (!d || !key) return '';
    if (d.open) return (d.services || []).some(function (s) { return s.key === key; }) ? 'open' : '';
    return (d.keys || []).indexOf(key) >= 0 ? 'down' : '';
  }
  // Есть ли на карточке плашки с меткой — тогда, открывая карточку, заранее спрашиваем программу записи (кнопка сработает сразу)
  function zpHasKeys(c) {
    return !!(c && c.back && (c.back.blocks || []).some(function (b) {
      return b && b.kind === 'items' && (b.items || []).some(function (it) { var a = it && it.action; return a && (a.kind || 'contact') === 'contact' && zpKeyOf(a); });
    }));
  }
  // Нажали на плашку с меткой: встреча по календарю — окошко записи, иначе — как всегда, «Куда написать?»
  function zpTry(action, ctx) {
    var key = zpKeyOf(action), from = S.from;
    if (from) from.classList.add('m13-wait');
    zpServices().then(function (d) {
      if (from) from.classList.remove('m13-wait');
      var how = zpHow(d, key);
      if (how) zpOpen(key, action, ctx, null, how === 'down'); else openContact(action, ctx);
    }, function () { if (from) from.classList.remove('m13-wait'); openContact(action, ctx); });
  }
  M13.zapisTry = zpTry;

  function zpModalHTML() {
    return '<div class="m13-modal m13-zp" id="m13-zp" role="dialog" aria-modal="true" aria-labelledby="m13-zp-t"><div class="m13-modal-box m13-zpw" id="m13-zp-box"></div></div>';
  }
  function zpBind() {
    var m = S.root.querySelector('#m13-zp'); if (!m) return;
    m.addEventListener('click', function (e) {
      if (e.target === m) { closeTop(); return; }
      var b = e.target.closest ? e.target.closest('[data-zp]') : null;
      if (!b || b.disabled) return;
      var v = b.getAttribute('data-v');
      zpDo(b.getAttribute('data-zp'), v, b);
    });
  }
  // Вид окна: «Спокойный» (по умолчанию) — шрифт тонкий и простой, кнопки ровные, контур — тонкая линия; «Как у витрины» — как «Куда написать?»;
  // «Свой» — шрифт, кнопки, блик и как отмечать свободные дни. Цвета всегда — с карточки (страницы), откуда открыто.
  function zpLook(box) {
    var zs = zpSet(), look = zs.look === 'vitrina' || zs.look === 'own' ? zs.look : 'calm', o = zs.own || {};
    var L = winSource(), cls = ['m13-modal-box', 'm13-zpw'], css = [], lay = '';
    box.querySelectorAll(':scope > .m13-lay').forEach(function (x) { x.remove(); });
    if (L && look === 'vitrina') { cls = cls.concat(L.cls); css = L.css.slice(); lay = L.lay || ''; }
    else if (L) { cls.push('m13-win'); css = L.css.filter(function (x) { return !/^--w-font:/.test(x); }); }
    var font = look === 'vitrina' ? '' : look === 'own' ? (o.font || 'calm') : 'calm';
    if (font === 'month') font = (S.card && cardStyle(S.card).font) || ((S.D.showcase || {}).cardStyle || {}).font || 'calm';
    if (font === 'calm') { ensureFont('Montserrat'); cls.push('m13-zpw--calm'); }
    else if (font && FONTS[font]) { ensureFont(font); css.push("--zp-font:'" + font + "',Georgia,serif"); cls.push('m13-zpw--font'); }
    cls.push('m13-zpw--mk-' + (look === 'vitrina' ? 'glow' : look === 'own' && /^(glow|bold)$/.test(o.mark) ? o.mark : 'circle'));
    if (look === 'own') { cls.push('m13-zpw--b-' + (/^(line|glass|shimmer)$/.test(o.btn) ? o.btn : 'fill')); if (o.glint) cls.push('m13-zpw--glint'); }
    box.className = cls.join(' ');
    box.setAttribute('style', css.join(';'));
    if (lay) box.insertAdjacentHTML('beforeend', lay);
  }
  function zpShow() {
    var m = S.root.querySelector('#m13-zp'); if (!m) return;
    zpLook(m.querySelector('.m13-modal-box'));
    if (!m.classList.contains('is-open')) {
      m.classList.add('is-open');
      pushLayer('zapis', function () { m.classList.remove('is-open'); clearInterval(ZP.timer); ZP.st = null; });
    }
    zpRender();
  }
  function zpOpen(key, action, ctx, ym, down, demo) {
    ZP.st = { key: key, action: action || { kind: 'contact', host: key }, ctx: ctx || {}, ym: ym || null, view: down ? 'down' : 'load',
      sv: ((ZP.svc && ZP.svc.services) || []).filter(function (s) { return s.key === key; })[0] || { title: (ctx && ctx.item) || '' },
      free: null, day: null, time: null, mode: '', modes: ['online'], flash: '', cancelH: 12, demo: !!demo };
    zpShow();
    if (!down && !demo) zpLoadFree();
  }
  M13.zapisOpen = zpOpen;
  function zpLoadFree() {
    var s = ZP.st;
    s.view = 'load'; zpRender();
    zpGet(zpFreeQ(s)).then(function (d) {
      if (ZP.st !== s) return;
      zpTakeFree(s, d);
      zpRender();
    }, function () { if (ZP.st !== s) return; s.view = 'down'; zpRender(); });
  }
  function zpFreeQ(s) { return 'a=free&s=' + encodeURIComponent(s.key) + (s.mode ? '&m=' + s.mode : ''); }
  function zpFree(s) { return !(+(s.sv || {}).price > 0); }
  function zpTakeFree(s, d) {
    if (!d || !d.open || !d.ok) { s.view = 'down'; return; }
    // Ключей ЮKassa ещё нет (магазин на проверке): время выбрать можно, «Оплатить» предложит написать
    s.nopay = !d.pay;
    s.free = d; s.sv = d.service; s.cancelH = d.cancelH; s.holdMin = d.holdMin; s.view = 'pick';
    s.modes = d.modes && d.modes.length ? d.modes : ['online']; s.mode = d.mode || s.modes[0];
    if (s.day && !(d.days[s.day] || []).length) { s.day = null; s.time = null; }
    if (s.time && (d.days[s.day] || []).indexOf(s.time) < 0) s.time = null;
    // Месяц: с календаря витрины (если там есть время), иначе — первый, где есть свободный день
    var first = Object.keys(d.days).filter(function (k) { return d.days[k].length; })[0] || d.from;
    var want = s.month || (s.ym ? s.ym.y + '-' + z(s.ym.m) : '');
    var lo = d.from.slice(0, 7), hi = d.to.slice(0, 7);
    s.month = want && want >= lo && want <= hi && Object.keys(d.days).some(function (k) { return k.slice(0, 7) === want && d.days[k].length; }) ? want : first.slice(0, 7);
  }

  function zpBtn(cls, act, label, extra) { return '<button type="button" class="' + cls + '" data-zp="' + act + '"' + (extra || '') + '>' + txt(label) + '</button>'; }
  function zpHead(s) {
    var sv = s.sv || {}, sub = [sv.minutes ? sv.minutes + ' ' + zpPlural(sv.minutes, 'минута', 'минуты', 'минут') : '', sv.price ? zpRub(sv.price) : ''].filter(Boolean).join(' · ');
    return '<div class="m13-zp-head"><div class="m13-eyebrow">' + txt(zpT('eyebrow')) + '</div><h3 id="m13-zp-t">' + txt(sv.title || '') + '</h3>' +
      (sub ? '<p class="m13-zp-sub">' + txt(sub) + '</p>' : '') + '</div>';
  }
  function zpWhen(s) { return zpDayLong(s.day) + ', ' + s.time + '–' + zpHm(zpMin(s.time) + (+(s.sv || {}).minutes || 60)) + ' (Мск) · ' + zpT(s.mode === 'offline' ? 'offline' : 'online'); }
  function zpRender() {
    var s = ZP.st, box = S.root && S.root.querySelector('#m13-zp-box'); if (!s || !box) return;
    var keep = box.scrollTop, h = '';
    clearInterval(ZP.timer);
    if (s.view === 'load' || s.view === 'paying' || s.view === 'booking' || s.view === 'checking') {
      h = zpHead(s) + '<p class="m13-zp-wait"><span class="m13-zp-spin" aria-hidden="true"></span>' + txt(zpT(s.view === 'load' ? 'loading' : s.view)) + '</p>' + zpBtn('m13-modal-close', 'close', zpT('close'));
    } else if (s.view === 'down') {
      h = zpHead(s) + '<div class="m13-msg"><div class="m13-msg-label">' + txt(zpT('downTitle')) + '</div>' + txt(zpT('downText')) + '</div>' +
        '<div class="m13-zp-col">' + zpBtn('m13-channel', 'ask', zpT('downBtn')) + zpBtn('m13-modal-close', 'close', zpT('close')) + '</div>';
    } else if (s.view === 'wait') {
      h = zpHead(s) + '<div class="m13-msg"><div class="m13-msg-label">' + txt(zpT('waitTitle')) + '</div>' + txt(zpT('waitText')) + '</div>' +
        (s.day ? '<p class="m13-zp-when">' + txt(zpWhen(s)) + '</p>' : '') +
        (s.until && zpLeft(s.until) ? '<p class="m13-hint">' + txt(zpT('hold')) + ' <b class="m13-zp-timer" data-zp-timer></b></p>' : '') +
        '<div class="m13-zp-col">' + zpBtn('m13-channel', 'check', zpT('check')) +
        (s.url && zpLeft(s.until) ? '<a class="m13-channel m13-ch2" href="' + esc(s.url) + '" rel="noopener">' + txt(zpT('payAgain')) + '</a>' : '') +
        zpBtn('m13-modal-close', 'drop', zpT('dontPay')) + '</div>';
    } else if (s.view === 'soon') {
      h = zpHead(s) + '<div class="m13-msg"><div class="m13-msg-label">' + txt(zpT('chosen')) + '</div><strong>' + txt((s.sv || {}).title || '') + '</strong><br>' + txt(zpWhen(s)) + '</div>' +
        '<p class="m13-zp-ask">' + txt(zpT('soon')) + '</p>' +
        '<div class="m13-zp-col">' + zpBtn('m13-channel', 'soonAsk', zpT('downBtn')) + zpBtn('m13-modal-close', 'back', zpT('backPick')) + '</div>';
    } else if (s.view === 'gone') {
      h = zpHead(s) + '<div class="m13-msg"><div class="m13-msg-label">' + txt(zpT('goneTitle')) + '</div>' + txt(zpT('goneText')) + '</div>' +
        '<div class="m13-zp-col">' + (s.key ? zpBtn('m13-channel', 'again', zpT('again')) : '') + zpBtn('m13-ch2 m13-channel', 'ask', zpT('ask')) + zpBtn('m13-modal-close', 'close', zpT('close')) + '</div>';
    } else if (s.view === 'done') {
      h = '<div class="m13-zp-ok" aria-hidden="true">✓</div><h3 id="m13-zp-t">' + txt(zpT('doneTitle')) + '</h3>' +
        '<div class="m13-msg"><strong>' + txt((s.sv || {}).title || '') + '</strong><br>' + txt(zpWhen(s)) +
        (s.mode === 'offline' ? '<br><span class="m13-zp-addr">' + txt(s.address ? zpT('addr') + ': ' + s.address : zpT('noAddr')) + '</span>' : '') + '</div>' +
        zpBtn('m13-channel m13-ch2 m13-zp-wide', 'cal', zpT('addCal')) +
        '<div class="m13-zp-sep"></div><p class="m13-zp-ask">' + txt(zpFill('contact')) + '</p>' +
        '<div class="m13-msg"><div class="m13-msg-label">' + txt(T('contactMessageLabel') || 'Текст обращения') + '</div>' + txt(zpFill('message')) + '</div>' +
        '<div class="m13-channels">' + zpBtn('m13-channel', 'tell', 'Telegram', ' data-v="telegram"') + zpBtn('m13-channel', 'tell', 'VK', ' data-v="vk"') + '</div>' +
        '<p class="m13-hint" data-zp-hint aria-live="polite"></p><p class="m13-hint">' + txt(zpFill('cancel')) + '</p>' + zpBtn('m13-modal-close', 'close', zpT('done'));
    } else {
      h = zpHead(s) + zpPickHTML(s);
    }
    box.querySelectorAll(':scope > :not(.m13-lay)').forEach(function (x) { x.remove(); });
    box.insertAdjacentHTML('afterbegin', h);
    box.scrollTop = s.view === 'pick' ? keep : 0;
    if (s.view === 'wait' && s.until) zpTick();
  }
  function zpPickHTML(s) {
    var d = s.free, ym = s.month.split('-'), y = +ym[0], mo = +ym[1];
    var lo = d.from.slice(0, 7), hi = d.to.slice(0, 7);
    var first = zpD(s.month + '-01'), n = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    var g = ZP_WD.map(function (w) { return '<span class="m13-zp-wd">' + w + '</span>'; }).join('');
    for (var i = 0; i < zpWd(s.month + '-01'); i++) g += '<span></span>';
    for (i = 1; i <= n; i++) {
      var iso = s.month + '-' + z(i), t = d.days[iso], st = !t ? 'off' : t.length ? 'free' : 'full';
      g += '<button type="button" class="m13-zp-day is-' + st + (iso === s.day ? ' is-sel' : '') + (iso === d.from ? ' is-today' : '') + '"' +
        (st === 'free' ? ' data-zp="day" data-v="' + iso + '"' : ' disabled') + ' aria-label="' + esc(zpDayLong(iso) + (st === 'free' ? ', есть время' : st === 'full' ? ', всё занято' : '')) + '"' +
        (iso === s.day ? ' aria-pressed="true"' : '') + '><span class="m13-zp-n">' + i + '</span></button>';
    }
    var any = Object.keys(d.days).some(function (k) { return d.days[k].length; });
    var h = (s.flash ? '<p class="m13-zp-flash" role="alert">' + txt(s.flash) + '</p>' : '') +
      (s.modes.length > 1 ? '<div class="m13-zp-group m13-zp-fmt"><div class="m13-msg-label">' + txt(zpT('how')) + '</div><div class="m13-zp-seg">' +
        s.modes.map(function (f) { return '<button type="button" data-zp="mode" data-v="' + f + '" class="' + (s.mode === f ? 'is-on' : '') + '" aria-pressed="' + (s.mode === f) + '">' + txt(zpT(f)) + '</button>'; }).join('') +
        '</div></div>' : '') +
      '<div class="m13-zp-mon"><button type="button" class="m13-zp-arr" data-zp="month" data-v="-1" aria-label="Прошлый месяц"' + (s.month <= lo ? ' disabled' : '') + '>‹</button>' +
      '<strong>' + txt(MONTHS_NOM[mo - 1] + ' ' + y) + '</strong>' +
      '<button type="button" class="m13-zp-arr" data-zp="month" data-v="1" aria-label="Следующий месяц"' + (s.month >= hi ? ' disabled' : '') + '>›</button></div>' +
      '<div class="m13-zp-grid">' + g + '</div>' +
      '<div class="m13-zp-legend"><span><i class="m13-zp-dot"></i>' + txt(zpT('free')) + '</span><span>' + txt(zpT('full')) + '</span></div>';
    if (!any) h += '<p class="m13-hint">' + txt(zpT('none')) + '</p>';
    else if (s.day) {
      h += '<div class="m13-zp-group"><div class="m13-msg-label">' + txt(zpFill('times')) + '</div><div class="m13-zp-slots">' +
        d.days[s.day].map(function (t) { return '<button type="button" class="m13-zp-slot' + (t === s.time ? ' is-sel' : '') + '" data-zp="time" data-v="' + t + '"' + (t === s.time ? ' aria-pressed="true"' : '') + '>' + t + '</button>'; }).join('') +
        '</div></div>';
    } else h += '<p class="m13-hint">' + txt(zpT('pick')) + '</p>';
    if (s.time) h += '<div class="m13-msg"><div class="m13-msg-label">' + txt(zpT('chosen')) + '</div><strong>' + txt(s.sv.title) + '</strong><br>' + txt(zpWhen(s)) + '</div>';
    h += '<p class="m13-hint">' + txt(zpFill('cancel')) + '</p>' +
      '<button type="button" class="m13-channel m13-zp-wide m13-zp-pay" data-zp="pay"' + (s.time ? '' : ' disabled') + '>' + txt(zpFree(s) ? zpFill('book') : zpFill('pay')) + '</button>' +
      (zpFree(s) ? '' : '<a class="m13-zp-agree" href="' + esc(S.base + 'oferta/#oferta') + '" target="_blank" rel="noopener">' + txt(zpT('agree')) + '</a>') +
      '<div class="m13-channels">' + zpBtn('m13-channel m13-ch2', 'ask', zpT('ask')) + zpBtn('m13-modal-close', 'close', zpT('close')) + '</div>';
    return h;
  }
  function zpTick() {
    var s = ZP.st;
    function upd() {
      var b = S.root.querySelector('[data-zp-timer]'), left = s && s.until ? zpLeft(s.until) : 0;
      if (b) { var sec = Math.ceil(left / 1000); b.textContent = Math.floor(sec / 60) + ':' + z(sec % 60); }
      if (!left || ZP.st !== s) { clearInterval(ZP.timer); if (ZP.st === s) zpCheck(s.code, true); }
    }
    upd(); ZP.timer = setInterval(upd, 1000);
  }
  function zpDo(a, v, b) {
    var s = ZP.st; if (!s) return;
    if (a === 'close') { closeTop(); return; }
    if (a === 'day') { s.day = v; s.time = null; s.flash = ''; zpRender(); zpScroll('.m13-zp-slots'); }
    else if (a === 'time') { s.time = v; zpRender(); zpScroll('.m13-zp-pay'); }
    else if (a === 'mode') { if (s.mode === v) return; s.mode = v; s.time = null; s.flash = ''; if (s.demo) zpRender(); else zpLoadFree(); }
    else if (a === 'month') {
      var p = s.month.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1 + (+v), 1));
      s.month = d.getUTCFullYear() + '-' + z(d.getUTCMonth() + 1); zpRender();
    }
    else if (a === 'pay') { if (zpFree(s)) zpBook(); else if (s.nopay && !s.demo && !S.onBack) { s.view = 'soon'; zpRender(); } else zpPay(); }
    else if (a === 'back') { s.view = 'pick'; zpRender(); }
    else if (a === 'soonAsk') openContact(Object.assign({}, s.action, { host: '', message: zpFill('soonMsg') }), Object.assign({}, s.ctx, { item: s.ctx.item || (s.sv || {}).title }));
    else if (a === 'ask') {
      var act = Object.assign({}, s.action, { message: zpFill('askMsg') });
      openContact(act, Object.assign({}, s.ctx, { item: s.ctx.item || (s.sv || {}).title }));
    }
    else if (a === 'cal') openCalendar({ date: s.day, time: s.time, duration: +(s.sv || {}).minutes || 60, title: ((s.sv || {}).title || '') + ' · 13 MIRRORS', details: zpFill('cancel') }, {});
    else if (a === 'tell') zpTell(v);
    else if (a === 'check') zpCheck(s.code, true);
    else if (a === 'drop') {
      zpPost('cancel', { c: s.code }).catch(function () {});
      zpStore(null); s.code = ''; s.until = ''; s.time = null; s.flash = '';
      zpLoadFree();
    }
    else if (a === 'again') { s.time = null; s.flash = ''; zpLoadFree(); }
  }
  function zpScroll(sel) {
    var n = S.root.querySelector('#m13-zp-box ' + sel);
    if (n && n.scrollIntoView) setTimeout(function () { n.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 30);
  }
  // «Оплатить»: программа записи держит время за человеком и даёт страницу оплаты ЮKassa; номер записи — только в этом браузере
  function zpPay() {
    var s = ZP.st, sv = s.sv || {};
    if (s.demo || S.onBack) { s.flash = 'Это предпросмотр: на сайте здесь откроется страница оплаты ЮKassa.'; zpRender(); return; }
    var prev = zpStore();
    s.view = 'paying'; s.flash = ''; zpRender();
    zpPost('hold', { s: s.key, day: s.day, time: s.time, mode: s.mode, prev: (prev && prev.code) || '', back: location.origin + location.pathname }).then(function (d) {
      if (ZP.st !== s) return;
      if (d && d.ok && d.url) {
        zpStore({ code: d.code, until: d.until, url: d.url, key: s.key, title: sv.title, minutes: sv.minutes, price: sv.price, day: s.day, time: s.time, mode: s.mode, cancelH: s.cancelH });
        location.href = d.url;
        return;
      }
      var why = d && d.why;
      s.flash = zpT(why === 'taken' ? 'taken' : why === 'many' ? 'many' : 'payErr');
      if (why === 'taken') { s.time = null; zpGet(zpFreeQ(s)).then(function (f) { if (ZP.st === s) { zpTakeFree(s, f); zpRender(); } }, function () { s.view = 'pick'; zpRender(); }); }
      else if (why === 'closed') s.view = 'down';
      else s.view = 'pick';
      zpRender();
    }, function () { if (ZP.st !== s) return; s.flash = zpT('payErr'); s.view = 'pick'; zpRender(); });
  }
  // Встреча без цены: записать сразу (без ЮKassa) → «Вы записаны»
  function zpBook() {
    var s = ZP.st, prev = zpIntro();
    if (s.demo || S.onBack) { s.code = ''; s.address = ''; s.view = 'done'; zpRender(); return; }
    s.view = 'booking'; s.flash = ''; zpRender();
    zpPost('hold', { s: s.key, day: s.day, time: s.time, mode: s.mode, prev: (prev && prev.code) || '' }).then(function (d) {
      if (ZP.st !== s) return;
      if (d && d.ok && d.booked) {
        zpIntro({ code: d.code, day: s.day });
        s.code = d.code; s.address = d.address || ''; s.view = 'done'; zpRender();
        return;
      }
      var why = d && d.why;
      s.flash = zpT(why === 'taken' ? 'taken' : why === 'full' ? 'freeFull' : 'payErr');
      s.view = why === 'closed' ? 'down' : 'pick';
      if (why === 'taken' || why === 'full') { s.time = null; if (why === 'full') s.day = null; zpLoadFree(); return; }
      zpRender();
    }, function () { if (ZP.st !== s) return; s.flash = zpT('payErr'); s.view = 'pick'; zpRender(); });
  }
  // После записи — написать ей: Telegram с готовым текстом — к боту Host с меткой плашки (action.host, как у её команд бота; по умолчанию, её решение 29.10)
  // или в её личный Telegram («Окошко на сайте» → «Куда ведёт Telegram»); VK — текст копируется
  function zpTell(ch) {
    var def = (S.D.settings || {}).contacts || {}, msg = zpFill('message'), st = ZP.st;
    var bot = hostUrl(st.key, def.host), me = contactUrl('telegram', def.telegram, msg);
    var url = ch === 'telegram' ? (zpSet().tell === 'me' ? me || bot : bot || me) : contactUrl('vk', def.vk, '');
    var ok = copyText(msg), hint = S.root.querySelector('[data-zp-hint]');
    if (url) window.open(url, '_blank', 'noopener');
    if (hint) {
      hint.textContent = url ? (ok ? (T('contactCopied') || 'Текст скопирован — вставьте его в чат.') : '') : fill(T('contactMissing') || 'Ссылка на {channel} ещё не задана.', { channel: ch === 'telegram' ? 'Telegram' : 'VK' });
      hint.classList.add('is-done');
    }
  }
  // Оплачено ли: после возврата с ЮKassa (?zapis=Z-…) или если в этом браузере есть неоплаченная запись
  function zpCheck(code, loud) {
    var s = ZP.st;
    if (loud && s) { s.view = 'checking'; zpRender(); }
    return zpGet('a=check&c=' + encodeURIComponent(code)).then(function (d) {
      var rec = zpStore() || {};
      if (d.status === 'paid') {
        zpStore(null);
        zpShowRec(code, d, rec, 'done');
      } else if (d.status === 'hold') {
        rec.until = d.until; rec.url = d.url || rec.url; zpStore(Object.assign(rec, { code: code }));
        if (loud) zpShowRec(code, d, rec, 'wait');
      } else if (d.status === 'gone') {
        zpStore(null);
        if (loud) zpShowRec(code, d, rec, 'gone');
      } else if (loud) zpShowRec(code, d, rec, 'wait');
    }, function () { if (loud) zpShowRec(code, {}, zpStore() || {}, 'wait'); });
  }
  function zpShowRec(code, d, rec, view) {
    var key = d.service || rec.key || '', s = ZP.st;
    if (!s || s.code !== code) {
      s = ZP.st = { key: key, action: { kind: 'contact', host: key }, ctx: { card: '' }, view: view, free: null, mode: 'online', modes: ['online'], flash: '', code: code };
    }
    s.view = view; s.code = code;
    s.sv = { title: d.title || rec.title || '', minutes: d.from && d.to ? zpMin(d.to) - zpMin(d.from) : rec.minutes, price: d.price || rec.price };
    s.day = d.day || rec.day; s.time = d.from || rec.time; s.mode = d.mode || rec.mode || 'online'; s.address = d.address || '';
    s.until = d.until || rec.until || ''; s.url = d.url || rec.url || ''; s.cancelH = rec.cancelH == null ? 12 : rec.cancelH;
    if (view === 'gone') { s.time = null; s.until = ''; }
    s.ctx.item = s.sv.title;
    zpShow();
  }
  function zpResume() {
    if (S.onBack) return;
    var m = /[?&]zapis=([A-Za-z0-9-]{3,20})/.exec(location.search), rec = zpStore(), code = m ? m[1] : rec && rec.code;
    if (m) {
      var q = location.search.replace(/([?&])zapis=[^&]*&?/, '$1').replace(/[?&]$/, '');
      try { history.replaceState(history.state, '', location.pathname + q + location.hash); } catch (e) {}
    }
    if (!code) return;
    // Вернулся с ЮKassa или время ещё держится — показываем окно; иначе проверяем молча (вдруг оплата дошла позже)
    var loud = !!m || !!(rec && zpLeft(rec.until));
    if (loud) zpShowRec(code, {}, rec || {}, 'checking');
    zpCheck(code, loud);
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted && S.root && S.view === 'showcase') zpResume(); });

  // Предпросмотр в панели: окошко с выдуманным расписанием (без программы записи), view: 'pick' | 'done' | 'down'
  M13.demoZapis = function (view) {
    var now = new Date(Date.now() + MSK * 3600000), from = zpIso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))), days = {};
    for (var i = 0; i <= 30; i++) {
      var iso = zpIso(new Date(zpD(from).getTime() + i * 86400000)), w = zpWd(iso);
      if (w > 4) continue;
      days[iso] = i < 1 || i % 6 === 3 ? [] : ['10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '17:00'].filter(function (t, k) { return (k + i) % 3; });
    }
    var to = zpIso(new Date(zpD(from).getTime() + 30 * 86400000));
    var card = S.card || null, it = null;
    ((card && card.back && card.back.blocks) || []).forEach(function (b) { (b.kind === 'items' ? b.items || [] : []).forEach(function (x) { if (!it && zpKeyOf(x.action)) it = x; }); });
    var title = (it && it.title) || 'Индивидуальная встреча', price = +String(it && opt(it.price) || '7000').replace(/\D/g, '') || 7000;
    var free = { open: true, ok: true, pay: true, from: from, to: to, days: days, cancelH: 12, holdMin: 15, service: { key: 'demo', title: title, minutes: 90, price: price } };
    zpOpen('demo', { kind: 'contact' }, { card: card ? (card.front || {}).title : '', item: title }, null, view === 'down', true);
    var s = ZP.st;
    if (view === 'down') { s.sv = free.service; zpRender(); return; }
    zpTakeFree(s, free);
    if (view === 'done') {
      s.day = Object.keys(days).filter(function (k) { return days[k].length; })[1]; s.time = days[s.day][0]; s.view = 'done';
    }
    zpRender();
  };
  // Строка-мостик под календарём витрины: «Записаться на индивидуальную встречу →»
  function zpBridgeHTML() {
    var b = zpSet().bridge || {};
    if (!b.on || !zpKeyOf({ host: b.key || 'individual_session' })) return '';
    return '<button type="button" class="m13-cal-bridge" data-zp-bridge>' + txt(String(b.text || '').trim() || zpT('bridge')) + '</button>';
  }
  function zpBridgeBind(scope, ym) {
    var btn = scope.querySelector('[data-zp-bridge]'); if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation(); S.from = btn;
      var b = zpSet().bridge || {}, key = zpKeyOf({ host: b.key || 'individual_session' }), action = { kind: 'contact', host: key };
      var ctx = { card: S.card ? (S.card.front || {}).title : '' };
      btn.classList.add('m13-wait');
      zpServices().then(function (d) {
        btn.classList.remove('m13-wait');
        var how = zpHow(d, key);
        if (how) zpOpen(key, action, ctx, ym, how === 'down'); else openContact(action, ctx);
      }, function () { btn.classList.remove('m13-wait'); openContact(action, ctx); });
    });
  }

  /* ================= КАРТИНКА КРУПНО =================
     Нажатие на картинку из галереи открывает её на весь экран; несколько — листаются пальцем или стрелками. */
  var LB = { open: false, list: [], i: 0 };
  function lightboxHTML() {
    return '<div class="m13-lb" id="m13-lb" role="dialog" aria-modal="true" aria-label="Картинка">' +
      '<div class="m13-lb-fig"><img class="m13-lb-img" id="m13-lb-img" alt=""><span class="m13-gl-box" id="m13-lb-gl"></span></div>' +
      '<button type="button" class="m13-lb-nav m13-lb-prev" id="m13-lb-prev" aria-label="Предыдущая">‹</button>' +
      '<button type="button" class="m13-lb-nav m13-lb-next" id="m13-lb-next" aria-label="Следующая">›</button>' +
      '<div class="m13-lb-cap" id="m13-lb-cap"></div>' +
      '<div class="m13-lb-count" id="m13-lb-count"></div>' +
      '<button type="button" class="m13-x m13-lb-close" id="m13-lb-x" aria-label="Закрыть"></button></div>';
  }
  // Галерея: до 10 картинок с подписями. mode 'row' — ряд маленьких (оборот карточки),
  // 'feature' — первая крупно с подписью, остальные рядом под ней (страницы). Крупно — в просмотрщике, с подписью.
  // ov — что поверх картинок (только в 'feature'): строка — стекло с надписью на первой картинке; или {gl, gllb, wm, wmlb} (glassOver / markParts):
  // gl — стекло на первой (главной) картинке, gllb — что на ней в просмотрщике; wm — водяной знак на остальных фото, wmlb — на них в просмотрщике
  // sq — остальные картинки под главной мелкими квадратиками (4 в ряд на телефоне, 6 на компьютере)
  function galleryHTML(list, mode, ov, sq) {
    var imgs = (list || []).filter(function (m) { return m && m.visible !== false && m.src; }).slice(0, 10);
    if (!imgs.length) return '';
    ov = typeof ov === 'string' ? { gl: ov, gllb: ov } : mode === 'feature' && ov ? ov : {};
    var gl = ov.gl || '', wm = ov.wm || '';
    var g = S.lb.push(imgs.map(function (m, k) {
      return { src: media(m.src), caption: String(m.caption || '').trim(), gl: k === 0 && gl ? ov.gllb || '' : wm ? ov.wmlb || '' : '' };
    })) - 1;
    function btn(m, k, cls, over) {
      return '<button type="button" class="' + cls + (over ? ' m13-has-mk' : '') + '" data-m13-lb="' + g + ':' + k + '" aria-label="Открыть картинку крупно">' +
        '<img src="' + esc(media(m.src)) + '" alt="' + esc(m.caption || '') + '" loading="lazy">' + (over ? '<span class="m13-gl-box">' + over + '</span>' : '') + '</button>';
    }
    function cap(m) { var c = String(m.caption || '').trim(); return c ? '<figcaption class="m13-cap">' + txt(c) + '</figcaption>' : ''; }
    if (mode === 'feature') {
      var top = gl || wm;
      return '<div class="m13-block m13-block--gallery"><figure class="m13-fig">' + btn(imgs[0], 0, 'm13-fig-img' + (top ? ' m13-gl-fig' : ''), top) + cap(imgs[0]) + '</figure>' +
        (imgs.length > 1 ? '<div class="m13-gallery m13-gallery--rest' + (sq ? ' m13-gallery--sq' : '') + '">' + imgs.slice(1).map(function (m, k) { return btn(m, k + 1, 'm13-gallery-item', wm); }).join('') + '</div>' : '') + '</div>';
    }
    return '<div class="m13-gallery">' + imgs.map(function (m, k) { return btn(m, k, 'm13-gallery-item'); }).join('') + '</div>';
  }
  function bindLightbox(scope) {
    scope.querySelectorAll('[data-m13-lb]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); var p = b.getAttribute('data-m13-lb').split(':'); openLightbox(+p[0], +p[1]); });
    });
    bindRings(scope);
  }
  function lbDraw() {
    var q = function (id) { return S.root.querySelector(id); }, n = LB.list.length, it = LB.list[LB.i];
    q('#m13-lb-img').src = typeof it === 'string' ? it : it.src;
    var c = q('#m13-lb-cap'); if (c) c.textContent = (it && it.caption) || '';
    // надпись и значки поверх картинки крупно (как выбрано в оформлении: «При увеличении»)
    var gb = q('#m13-lb-gl'); if (gb) gb.innerHTML = (it && it.gl) || '';
    q('#m13-lb-count').textContent = n > 1 ? (LB.i + 1) + ' / ' + n : '';
    q('#m13-lb-prev').hidden = q('#m13-lb-next').hidden = n < 2;
  }
  function lbGo(d) {
    var n = LB.list.length; if (n < 2) return;
    LB.i = (LB.i + d + n) % n; lbDraw();
  }
  function openLightbox(g, i) {
    var m = S.root.querySelector('#m13-lb'); if (!m || !S.lb || !S.lb[g]) return;
    LB.list = S.lb[g]; LB.i = i || 0; LB.open = true; xLook();
    if (!m._bound) {
      m._bound = true;
      m.addEventListener('click', function (e) { if (e.target === m) closeTop(); });
      S.root.querySelector('#m13-lb-x').addEventListener('click', closeTop);
      S.root.querySelector('#m13-lb-prev').addEventListener('click', function () { lbGo(-1); });
      S.root.querySelector('#m13-lb-next').addEventListener('click', function () { lbGo(1); });
      var x0 = null, y0 = null;
      m.addEventListener('touchstart', function (e) { var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
      m.addEventListener('touchend', function (e) {
        if (x0 == null) return;
        var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) lbGo(dx < 0 ? 1 : -1);
      });
    }
    lbDraw();
    m.classList.add('is-open');
    pushLayer('image', function () { m.classList.remove('is-open'); LB.open = false; });
  }

  /* ================= «ПОДЕЛИТЬСЯ» ================= */
  // Ссылка ведёт прямо на карточку: постоянный адрес месяца + страница карточки.
  function cardUrl() {
    var sc = S.D.showcase || {}, id = S.card ? S.card.id : '';
    var u = new URL(S.base + (sc.id ? sc.id + '/' : ''), location.href);
    // У каждой карточки на сайте есть своя страница-превью (…/2026-10/sun/) — её и отправляем:
    // Telegram и VK покажут картинку и название именно этой карточки, а человек попадёт сразу в неё.
    return u.origin + u.pathname + (id && /^[\w-]+$/.test(id) ? id + '/' : id ? '#' + encodeURIComponent(id) : '');
  }
  function toast(msg) {
    var t = S.root.querySelector('#m13-toast'); if (!t) return;
    t.textContent = msg; t.classList.add('is-on');
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('is-on'); }, 3200);
  }
  function shareCard(ctx) {
    var url = ctx.url || cardUrl(), title = [(S.D.settings || {}).siteTitle || '13 MIRRORS', ctx.card].filter(Boolean).join(' · ');
    if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      navigator.share({ title: title, url: url }).catch(function () {});
      return;
    }
    applyWin();
    toast(copyText(url) ? (T('shareCopied') || 'Ссылка скопирована — её можно отправить в чат.') : url);
  }

  /* ================= ВНУТРЕННИЕ СТРАНИЦЫ ================= */
  function internalHTML() {
    return '<div class="m13-internal" id="m13-int-sandbox"></div><div class="m13-internal" id="m13-int-reflection"></div><div class="m13-internal" id="m13-int-events"></div><div class="m13-internal" id="m13-int-kin"></div>';
  }
  // Открыть Песочницу или Примеры поверх открытой карточки («← Назад к карте» вернёт к обороту).
  function openInternal(target, tab) {
    var box = S.root.querySelector('#m13-int-' + target); if (!box) return;
    var back = '<button type="button" class="m13-iback" data-m13-iback>' + txt(T('backToCard') || '← Назад к карте') + '</button>';
    // Оформление страницы (фон, шрифт, цвета, размер текста) — как у отдельной страницы /sandbox/, /events/, /reflection/
    var lk = pageLook(target === 'sandbox' ? S.D.sandbox.look : target === 'events' ? (S.D.events || {}).look : (S.D.reflection || {}).look);
    box.innerHTML = '<div class="m13-standalone' + lk.cls + '" data-m13-page="' + target + '"' + (lk.css ? ' style="' + esc(lk.css) + '"' : '') + '>' +
      (target === 'sandbox' ? sandboxHTML(back) : target === 'events' ? eventsHTML(back) : target === 'kin' ? kinPage(back) : reflectionHTML(back)) + '</div>';
    bgWatch(box);
    if (target === 'sandbox') bindSandbox(box, tab || 'days', null, false);
    else if (target === 'events') bindEvents(box, tab || null, false);
    else if (target === 'kin') { kinBind(box, S.kinPre); S.kinPre = null; }
    else { bindActs(box); bindLightbox(box); }
    box.querySelector('[data-m13-iback]').addEventListener('click', closeTop);
    box.classList.add('is-open'); box.scrollTop = 0;
    evenGlassSoon(box);
    pushLayer(target, function () { box.classList.remove('is-open'); box.innerHTML = ''; });
  }

  // Песочница и Примеры как отдельные страницы: /sandbox/, /reflection/
  function renderStandalone(which) {
    var st = S.D.settings;
    var backHref = S.base;
    var back = S.onBack
      ? '<button type="button" class="m13-iback" data-m13-home>' + txt(T('backToShowcase') || '← К витрине') + '</button>'
      : '<a class="m13-iback" href="' + esc(backHref) + '">' + txt(T('backToShowcase') || '← К витрине') + '</a>';
    S.acts = [];
    var inner = which === 'sandbox' ? sandboxHTML(back) : which === 'events' ? eventsHTML(back) : which === 'kin' ? kinPage(back) : reflectionHTML(back);
    var lk = pageLook(which === 'sandbox' ? S.D.sandbox.look : which === 'events' ? (S.D.events || {}).look : (S.D.reflection || {}).look);
    S.root.innerHTML = '<div class="m13-standalone' + lk.cls + '" data-m13-page="' + which + '"' + (lk.css ? ' style="' + esc(lk.css) + '"' : '') + '>' + inner + '</div>' +
      modalHTML() + calModalHTML() + lightboxHTML() + '<div class="m13-toast" id="m13-toast" role="status" aria-live="polite"></div>';
    bgWatch(S.root);
    bindModal();
    var home = S.root.querySelector('[data-m13-home]');
    if (home) home.addEventListener('click', function () { S.onBack(); });
    if (which === 'events') {
      document.title = (st.siteTitle || '13 MIRRORS') + ' · ' + ((S.D.events || {}).title || 'События');
      bindEvents(S.root, S.onBack ? (S.startEvent || null) : (decodeURIComponent((location.hash || '').slice(1)) || null), !S.onBack);
    } else if (which === 'sandbox') {
      document.title = (st.siteTitle || '13 MIRRORS') + ' · ' + (S.D.sandbox.title || 'Песочница');
      var h = decodeURIComponent((location.hash || '').slice(1)).split('/');
      bindSandbox(S.root, S.onBack ? 'days' : (h[0] || 'days'), S.onBack ? null : (h[1] || null), !S.onBack);
    } else if (which === 'kin') {
      document.title = (st.siteTitle || '13 MIRRORS') + ' · ' + kinT('title');
      kinBind(S.root);
    } else {
      document.title = (st.siteTitle || '13 MIRRORS') + ' · ' + (S.D.reflection.eyebrow || 'Карта-Отражение');
      bindActs(S.root); bindLightbox(S.root); evenGlassSoon(S.root);
    }
  }

  // Оформление отдельной страницы (Песочница, Примеры Карт-Отражений): фон как у месяца, шрифт, цвета, стеклянные панели.
  // look = {background:{image,imageTall,color,dim,blur,fit}, font, textColor, accent, panelBg, glass, glassBlur, textSize}
  // Как лежит картинка фона: на весь экран (обрезается), целиком по центру, крупно (по высоте экрана с запасом)
  var BG_SIZE = { contain: 'contain', big: 'auto 135vh' };
  function bgSize(bg) { return BG_SIZE[bg.fit] ? ';--m13-bgsize:' + BG_SIZE[bg.fit] : ''; }
  // Яркость, контраст и насыщенность картинки фона: bg.bright / bg.contrast / bg.sat в процентах (100 — как есть, 50–150)
  function bgFx(bg) {
    var f = [['brightness', bg.bright], ['contrast', bg.contrast], ['saturate', bg.sat]].filter(function (x) {
      return x[1] != null && x[1] !== '' && !isNaN(+x[1]) && +x[1] !== 100;
    }).map(function (x) { return x[0] + '(' + (Math.max(30, Math.min(200, +x[1])) / 100) + ')'; });
    return f.length ? ';--m13-bgf:' + f.join(' ') : '';
  }
  // Картинка фона проявляется мягко, когда загрузится, а не появляется рывком поверх цвета.
  // Уже есть в памяти браузера (или загружена заранее, <link rel="preload"> при публикации) — сразу, без проявления.
  function bgUrl(bg) {
    var tall = window.matchMedia && window.matchMedia('(max-aspect-ratio:4/5)').matches;
    return media(tall && bg.imageTall ? bg.imageTall : bg.image);
  }
  function bgWait(bg) {
    var im = new Image();
    im.src = bgUrl(bg);
    return im.complete ? '' : ' m13-bg-wait';
  }
  function bgWatch(scope) {
    scope.querySelectorAll('.m13-bg-wait').forEach(function (box) {
      var cs = getComputedStyle(box), tall = window.matchMedia && window.matchMedia('(max-aspect-ratio:4/5)').matches;
      var m = /url\(['"]?([^'")]+)/.exec(cs.getPropertyValue(tall ? '--m13-bgimg-t' : '--m13-bgimg') || cs.getPropertyValue('--m13-bgimg'));
      function show() { box.classList.remove('m13-bg-wait'); }
      if (!m) { show(); return; }
      var im = new Image();
      im.onload = im.onerror = show;
      im.src = m[1];
      if (im.complete) show();
      setTimeout(show, 5000);
    });
  }
  function pageLook(lk) {
    if (!lk) return { cls: '', css: '' };
    if (lk.titleLine === false) { var r0 = pageLook(Object.assign({}, lk, { titleLine: true })); r0.cls += ' m13-noline'; return r0; }
    var bg = lk.background || {}, css = [], cls = '';
    if (bg.color) css.push('--m13-bgc:' + bg.color);
    if (bg.image) {
      cls += ' m13-root m13-root--img' + (+bg.blur > 0 ? ' m13-root--blur' : '') + bgWait(bg);
      css.push("--m13-bgimg:url('" + media(bg.image) + "')", "--m13-bgimg-t:url('" + media(bg.imageTall || bg.image) + "')",
        '--m13-dim:' + (Math.max(0, Math.min(90, +bg.dim || 0)) / 100), '--m13-blur:' + Math.max(0, Math.min(20, +bg.blur || 0)) + 'px' + bgSize(bg) + bgFx(bg));
    } else if (bg.color) cls += ' m13-root';
    var TK = { lg: 1.12, xl: 1.25 }, LH = { tight: 1.42, loose: 1.78 };
    if (TK[lk.textSize]) css.push('--m13-tk:' + TK[lk.textSize]);
    if (LH[lk.lineH]) css.push('--m13-lh:' + LH[lk.lineH]);
    if (lk.glass && typeof lk.glass === 'object') lk = Object.assign({}, lk, { glass: '' });
    var styled = lk.panelBg || lk.textColor || lk.accent || lk.glass || lk.font;
    if (!styled) { var tb0 = tabsLook(lk.tabs, '#232323', '#232323'); return { cls: cls + tb0.cls, css: css.concat(tb0.css).join(';') }; }
    cls += ' m13-look';
    var pan = hexRgb(lk.panelBg || '#ffffff'), darkPan = lum(pan) < 128;
    var glass = Math.max(0, Math.min(100, +lk.glass || 0));
    var tx = lk.textColor || (darkPan ? '#efe4d2' : '#232323'), ac = lk.accent || tx;
    // Заголовок стоит прямо на картинке: свой цвет (если задан) и мягкая тень — тёмная под светлым текстом, светлая под тёмным
    var hd = lk.headColor || tx;
    if (lk.headColor) css.push('--lk-hd:' + lk.headColor);
    css.push('--lk-tsh:' + (lum(hexRgb(hd)) > 128 ? '0 1px 2px rgba(0,0,0,.75),0 0 18px rgba(0,0,0,.55)' : '0 1px 2px rgba(255,255,255,.8),0 0 18px rgba(255,255,255,.6)'));
    css.push('--lk-tx:' + tx, '--lk-ac:' + ac, '--lk-ac-ink:' + inkFor(ac),
      '--lk-pan:rgba(' + pan.join(',') + ',' + (1 - glass / 100).toFixed(2) + ')',
      '--m13-gb:' + (lk.glassBlur == null || lk.glassBlur === '' ? 8 : Math.max(0, Math.min(20, +lk.glassBlur))) + 'px');
    if (lk.font) { ensureFont(lk.font); css.push("--lk-font:'" + lk.font + "',Georgia,serif"); cls += ' m13-look--font'; }
    var tb = tabsLook(lk.tabs, tx, ac);
    return { cls: cls + tb.cls, css: css.concat(tb.css).join(';') };
  }
  // Вкладки страницы и плашки фильтра по маршрутам: look.tabs = {active: '' (сплошная, как было) | glass (акцент с прозрачностью) | line (только контур),
  // glass — прозрачность стекла 0–90 % (70), rim: '' (как было) | none | line (тонкая линия) | glow (светящийся: выбранная ярче, остальные тише),
  // rimColor (пусто — акцентный), text — цвет текста выбранной вкладки (пусто: у сплошной — подбирается к цвету, у стекла и контура — цвет текста)}
  function tabsLook(t, tx, ac) {
    t = t || {};
    var act = t.active === 'glass' || t.active === 'line' ? t.active : '', rim = t.rim === 'none' || t.rim === 'line' || t.rim === 'glow' ? t.rim : '';
    if (!act && !rim && !t.text) return { cls: '', css: [] };
    var a = hexRgb(ac), gl = Math.max(0, Math.min(90, t.glass == null || t.glass === '' ? 70 : +t.glass));
    var css = ['--tb-a:' + a.join(','), '--tb-r:' + hexRgb(t.rimColor || ac).join(','), '--tb-ink:' + (t.text || (act ? tx : inkFor(ac)))];
    if (act === 'glass') css.push('--tb-fill:rgba(' + a.join(',') + ',' + (1 - gl / 100).toFixed(2) + ')');
    return { cls: ' m13-tbx' + (act ? ' m13-tb-' + act : '') + (rim ? ' m13-tr-' + rim : ''), css: css };
  }

  /* ---------- Песочница ---------- */
  var TABS = ['days', 'chronicles', 'reviews'];
  var LABELS = { day: 'День {n}', meaning: 'Смысл дня', thought: 'Мысль дня', question: 'Вопрос дня', practice: 'Практика {n}', practiceOne: 'Практика', trace: 'Твой след',
    fragment: 'Фрагмент Летописи', lens: 'Линза 13 MIRRORS', review: 'Отзыв' };
  function L(key, vars) { var l = (S.D.sandbox.labels || {})[key]; return fill(l == null || l === '' ? LABELS[key] : l, vars || {}); }

  // Текст с лёгкой разметкой: пустая строка — новый абзац, **жирный**, *курсив*, строки с «- » — список
  function rich(s) {
    return String(s || '').trim().split(/\n\s*\n/).map(function (par) {
      var lines = par.split('\n'), out = '', list = [];
      function inl(t) { return esc(t).replace(/__(.+?)__/g, '<u class="m13-u">$1</u>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>'); }
      function flush() { if (list.length) { out += '<ul>' + list.map(function (x) { return '<li>' + inl(x) + '</li>'; }).join('') + '</ul>'; list = []; } }
      var txtLines = [];
      lines.forEach(function (ln) {
        var m = /^\s*[-–•]\s+(.*)$/.exec(ln);
        if (m) { if (txtLines.length) { out += '<p>' + txtLines.map(inl).join('<br>') + '</p>'; txtLines = []; } list.push(m[1]); }
        else { flush(); if (ln.trim()) txtLines.push(ln.trim()); }
      });
      flush(); if (txtLines.length) out += '<p>' + txtLines.map(inl).join('<br>') + '</p>';
      return out;
    }).join('');
  }
  function plain(s) { return String(s || '').replace(/__(.+?)__/g, '$1').replace(/\*\*?(.+?)\*\*?/g, '$1').replace(/^\s*[-–•]\s+/gm, '').replace(/\s+/g, ' ').trim(); }
  function firstText(tab, it) { var t = ''; (M13.sbBlocks(tab, it, (S.D.sandbox || {}).labels) || []).some(function (b) { if (b.visible !== false && b.kind === 'text' && String(b.text || '').trim()) { t = b.text; return true; } }); return t; }
  function firstLine(s) { var t = plain(String(s || '').split(/\n\s*\n/)[0]); return t.length > 140 ? t.slice(0, 138) + '…' : t; }

  // Разделы примера (день, Летопись) — гибкие блоки: {kind:'text', title, text, look:'normal'|'thought'|'mantra', collapse}
  // или {kind:'images', images:[{src, caption}]}. Старые поля (meaning, thought, practices…) превращаются в блоки на лету.
  M13.sbBlocks = function (tab, it, labels) {
    if (it && it.blocks) return it.blocks;
    labels = labels || {};
    function lab(k, v) { var l = labels[k]; return fill(l == null || l === '' ? LABELS[k] : l, v || {}); }
    var B = [], n = 0;
    function tb(title, text, o) { if (String(text || '').trim()) B.push(Object.assign({ id: 'b' + (++n), kind: 'text', visible: true, title: title, text: String(text) }, o || {})); }
    if (it.image) B.push({ id: 'b' + (++n), kind: 'images', visible: true, images: [{ src: it.image, caption: '' }] });
    if (tab === 'days') {
      var pr = (it.practices || []).filter(function (x) { return String(x || '').trim(); });
      tb(lab('meaning'), it.meaning, { collapse: true });
      tb(lab('thought'), it.thought, { look: 'thought' });
      tb(lab('question'), it.question);
      pr.forEach(function (p, i) { tb(pr.length === 1 ? lab('practiceOne') : lab('practice', { n: i + 1 }), p, { collapse: true }); });
      tb(lab('trace'), it.trace);
    } else if (tab === 'chronicles') {
      tb('', it.note);
      tb(lab('fragment'), it.fragment, { collapse: true });
      tb(lab('lens'), it.lens);
    }
    return B;
  };
  // ov — водяной знак на фото раздела {wm, wmlb} (markParts), у событий и маршрутов в архиве
  function sbBlockHTML(b, ctx, ov) {
    if (!b || b.visible === false) return '';
    // «Остальные картинки»: square — квадратиками, row — лентой; пусто — у событий квадратиками, в остальных местах лентой
    var isEv = ctx && typeof ctx === 'object' && !Array.isArray(ctx);
    if (b.kind === 'images') return galleryHTML(b.images, 'feature', ov && ov.wm ? { wm: ov.wm, wmlb: ov.wmlb } : null, b.thumbs ? b.thumbs === 'square' : isEv);
    if (b.kind === 'hosts') return hostsHTML(b, isEv ? ctx : null);
    if (b.kind === 'program') return programHTML(b);
    var text = String(b.text || '').trim(); if (!text) return '';
    var paras = text.split(/\n\s*\n/), sb = S.D.sandbox || {}, body;
    // «Подробнее» включено у раздела: первый абзац виден, остальное раскрывается — только если текст правда длинный
    if (b.collapse && paras.length > 1 && text.length > 320) {
      body = '<div class="m13-rich">' + rich(paras[0]) + '</div><details class="m13-more m13-sb-more"><summary><span class="m13-more-open">' +
        txt(sb.moreLabel || 'Подробнее') + ' ↓</span><span class="m13-more-close">' + txt(sb.lessLabel || 'Свернуть') + ' ↑</span></summary>' +
        '<div class="m13-rich">' + rich(paras.slice(1).join('\n\n')) + '</div></details>';
    } else body = '<div class="m13-rich">' + rich(text) + '</div>';
    var look = b.look === 'thought' ? ' m13-thought' : b.look === 'mantra' ? ' m13-mantra' : '';
    return '<div class="m13-block' + look + '">' + (b.title ? '<div class="m13-block-title">' + txt(b.title) + '</div>' : '') + body + '</div>';
  }

  /* ---------- Ведущие и программа (разделы события) ----------
     Люди заводятся один раз в общем списке events.people = [{id, visible, photo, photoY (0–100, где лицо по высоте), name, role, about}],
     в событии — раздел {kind:'hosts', title, people:[{id, note}], layout:'auto'|'side'|'grid'|'ring', about (false — без «пары строк»),
     ringColor, ringBg, ringImage, ringHint}. Программа — {kind:'program', title, rows:[{time, what, hostId, who}]}. */
  function personById(id) { return ((S.D.events || {}).people || []).filter(function (p) { return p && p.id === id; })[0] || null; }
  function hostsOf(b) {
    return (b.people || []).map(function (x) {
      var p = x && personById(x.id);
      return p && p.visible !== false && String(p.name || '').trim() ? Object.assign({}, p, { note: String(x.note || '').trim() }) : null;
    }).filter(Boolean);
  }
  function initials(n) { return String(n || '').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase(); }
  function hostFace(p, cls) {
    var y = p.photoY == null || p.photoY === '' ? 30 : +p.photoY;
    return p.photo ? '<img class="' + cls + '" src="' + esc(media(p.photo)) + '" alt="" loading="lazy" style="object-position:50% ' + y + '%">'
      : '<span class="' + cls + ' m13-host-none" aria-hidden="true">' + txt(initials(p.name)) + '</span>';
  }
  function hostsHTML(b, e) {
    var list = hostsOf(b); if (!list.length) return '';
    var lay = b.layout === 'side' || b.layout === 'grid' || b.layout === 'ring' ? b.layout : (list.length <= 2 ? 'side' : 'grid');
    var head = b.title ? '<div class="m13-block-title">' + txt(b.title) + '</div>' : '';
    var rc = b.ringColor ? '--rc:' + esc(b.ringColor) + ';' : '';
    if (lay === 'ring') {
      var n = list.length, R = n > 1 ? 40 : 0, sz = Math.min(21, Math.max(11, 2 * Math.PI * 40 / n * 0.72));
      var img = b.ringImage || (e && e.cover) || '';
      var faces = list.map(function (p, k) {
        var a = -Math.PI / 2 + 2 * Math.PI * k / n;
        return '<button type="button" class="m13-ring-p" data-ring="' + k + '" data-name="' + esc(p.name) + '" data-role="' + esc(p.note || p.role || '') + '"' +
          ' aria-label="' + esc([p.name, p.note || p.role].filter(Boolean).join(' — ')) + '"' +
          ' style="left:' + (50 + R * Math.cos(a)).toFixed(2) + '%;top:' + (50 + R * Math.sin(a)).toFixed(2) + '%;width:' + sz.toFixed(2) + '%">' + hostFace(p, 'm13-ring-ph') + '</button>';
      }).join('');
      return '<div class="m13-block m13-hosts-block">' + head +
        '<div class="m13-ring-wrap' + (b.ringBg ? ' m13-ring-wrap--bg' : '') + '" style="' + rc + (b.ringBg ? '--ring-bg:' + esc(b.ringBg) + ';' : '') + '">' +
        '<div class="m13-ring">' + (n > 1 ? '<span class="m13-ring-c">' + (img ? '<img src="' + esc(media(img)) + '" alt="" loading="lazy">' : '<span class="m13-ring-mark">' + M13.dandSVG('logo') + '</span>') + '</span>' : '') + faces + '</div>' +
        '<p class="m13-ring-name" aria-live="polite">' + txt(String(b.ringHint || '').trim() || 'Нажмите на лицо — появится имя') + '</p></div></div>';
    }
    var about = b.about !== false;
    // Имя сразу под фото; строки «кто это», «что ведёт», «пара строк» — одинаковые у всех карточек
    // (пустая, если у этого человека нет), чтобы по сетке они начинались на одной высоте
    var has = function (f) { return list.some(function (p) { return String(p[f] || '').trim(); }); };
    var rows = [['role', 'm13-host-role'], ['note', 'm13-host-note']].concat(about ? [['about', 'm13-host-about']] : []).filter(function (r) { return has(r[0]); });
    return '<div class="m13-block m13-hosts-block">' + head + '<div class="m13-hosts m13-hosts--' + lay + (list.length === 1 ? ' m13-hosts--one' : '') + '"' +
      ' style="--hr:' + (rows.length + 2) + ';' + rc + '">' +
      list.map(function (p) {
        return '<div class="m13-host">' + hostFace(p, 'm13-host-ph') +
          '<div class="m13-host-name">' + txt(p.name) + '</div>' +
          rows.map(function (r) {
            var v = String(p[r[0]] || '').trim();
            return '<div class="' + r[1] + '">' + (!v ? '' : txt(v)) + '</div>';
          }).join('') + '</div>';
      }).join('') + '</div></div>';
  }
  function programHTML(b) {
    var rows = (b.rows || []).filter(function (r) { return r && r.visible !== false && (String(r.time || '').trim() || String(r.what || '').trim()); });
    if (!rows.length) return '';
    return '<div class="m13-block m13-prog-block">' + (b.title ? '<div class="m13-block-title">' + txt(b.title) + '</div>' : '') + '<div class="m13-prog">' +
      rows.map(function (r) {
        var p = r.hostId ? personById(r.hostId) : null, who = p ? p.name : String(r.who || '').trim();
        // Строка без времени и без ведущего — подзаголовок (день фестиваля)
        if (!String(r.time || '').trim() && !who) return '<div class="m13-prog-day">' + txt(r.what) + '</div>';
        return '<div class="m13-prog-row"><span class="m13-prog-t">' + txt(r.time || '') + '</span><span class="m13-prog-w">' + txt(r.what || '') + '</span>' +
          (who ? '<span class="m13-prog-who">' + txt(who) + '</span>' : '<span></span>') + '</div>';
      }).join('') + '</div></div>';
  }
  // Круг ведущих: нажатие (на компьютере и наведение) показывает имя и что ведёт
  function bindRings(scope) {
    scope.querySelectorAll('.m13-ring-wrap').forEach(function (w) {
      var cap = w.querySelector('.m13-ring-name');
      w.querySelectorAll('.m13-ring-p').forEach(function (b) {
        function show() {
          w.querySelectorAll('.m13-ring-p.is-on').forEach(function (x) { if (x !== b) x.classList.remove('is-on'); });
          b.classList.add('is-on');
          cap.innerHTML = txt(b.getAttribute('data-name')) + (b.getAttribute('data-role') ? '<small>' + txt(b.getAttribute('data-role')) + '</small>' : '');
        }
        b.addEventListener('click', function (e) { e.stopPropagation(); show(); });
        b.addEventListener('mouseenter', show);
        b.addEventListener('focus', show);
      });
    });
  }

  /* ---------- Библиотека: обложки → страница чтения (Песочница, События, архив маршрутов) ----------
     Сетка обложек с фильтром и «Показать ещё» (по 12); нажатие — пример на всю ширину: «← Все», «Предыдущий / Следующий».
     «Назад» телефона возвращает к обложкам на то же место. Отзывы — карточки, полный текст в окне поверх страницы. */
  var LIB_STEP = 12;
  function colorOf(it, r) { return (it && it.color) || (r && r.color) || ''; }
  function rcStyle(c) { return c ? ' style="--rc:' + esc(c) + '"' : ''; }
  // Картинка обложки: заполняет окошко (края обрезаются) или целиком — по бокам та же картинка, размытая и увеличенная
  function fitImgHTML(src, whole, lazy) {
    var u = esc(media(src)), l = lazy ? ' loading="lazy"' : '';
    return (whole ? '<img class="m13-fit-bg" src="' + u + '" alt="" aria-hidden="true"' + l + '>' : '') + '<img src="' + u + '" alt=""' + l + '>';
  }
  // c = {id, img, fit, color, top, title, line, text, nested}; fit 'whole' — картинка целиком;
  // nested — обложка внутри страницы (пример дня внутри маршрута архива)
  function coverHTML(c) {
    var whole = c.img && c.fit === 'whole', mk = c.gl && !glText(c.gl);
    return '<button type="button" class="m13-cover' + (c.color ? ' m13-rc' : '') + (c.img ? '' : ' m13-cover--noimg') + (c.gl ? ' m13-cover--gl' : '') + '" ' +
      (c.nested ? 'data-sub' : 'data-open') + '="' + esc(c.id) + '"' + rcStyle(c.color) + '>' +
      '<span class="m13-cover-img' + (whole ? ' m13-fit-whole' : '') + '">' + (c.img ? fitImgHTML(c.img, whole, true)
        : '<span class="m13-cover-ph">' + txt(c.ph || c.title || '') + '</span>') + (c.gl ? '<span class="m13-gl-box">' + c.gl + '</span>' : '') + '</span>' +
      // Со стеклом надпись и название уже на картинке — под ней только «Коротко»
      (c.gl && !mk ? (c.text ? '<span class="m13-cover-txt"><span class="m13-cover-sub">' + txt(c.text) + '</span></span>' : '') + '</button>' :
      '<span class="m13-cover-txt">' + (c.top ? '<span class="m13-cover-top">' + txt(c.top) + '</span>' : '') +
      '<span class="m13-cover-title">' + txt(c.title || '') + '</span>' +
      (c.line ? '<span class="m13-cover-line">' + txt(c.line) + '</span>' : '') +
      (c.text ? '<span class="m13-cover-sub">' + txt(c.text) + '</span>' : '') + '</span></button>');
  }
  // Шапка страницы чтения: картинка маршрута (или своя обложка), цветная кромка, названия
  function readHeadHTML(h) {
    // Со стеклом: картинка крупно, надписи — на стекле; над картинкой не повторяются (заголовок остаётся для читалок экрана).
    // Чего нет на стекле (тон, печать…), — строкой под картинкой.
    if (h.img && h.gl && h.gl.html) {
      var rest = (h.meta || []).slice(h.gl.kin ? 1 : 0);
      return '<header class="m13-read-glass' + (h.color ? ' m13-rc' : '') + '"' + rcStyle(h.color) + '>' +
        '<h3 class="m13-sr">' + txt([h.top, h.title, h.line].filter(Boolean).join(' · ')) + '</h3>' +
        galleryHTML([{ src: h.img, caption: '' }], 'feature', { gl: h.gl.html, gllb: h.gl.lb == null ? h.gl.html : h.gl.lb }) +
        (rest.length ? '<div class="m13-panel-meta">' + rest.map(function (m) { return '<span>' + txt(m) + '</span>'; }).join('') + '</div>' : '') + '</header>';
    }
    var g = h.img ? S.lb.push([{ src: media(h.img), caption: '' }]) - 1 : -1;
    var whole = h.fit === 'whole';
    return '<header class="m13-read-head' + (h.color ? ' m13-rc' : '') + '"' + rcStyle(h.color) + '>' +
      (h.img ? '<button type="button" class="m13-read-img' + (whole ? ' m13-fit-whole' : '') + '" data-m13-lb="' + g + ':0" aria-label="Открыть картинку крупно">' +
        fitImgHTML(h.img, whole) + '</button>' : '') +
      '<div class="m13-read-ht">' + (h.top ? '<div class="m13-eyebrow">' + txt(h.top) + '</div>' : '') + '<h3>' + txt(h.title || '') + '</h3>' +
      (h.line ? '<div class="m13-panel-day">' + txt(h.line) + '</div>' : '') +
      (h.meta && h.meta.length ? '<div class="m13-panel-meta">' + h.meta.map(function (m) { return '<span>' + txt(m) + '</span>'; }).join('') + '</div>' : '') +
      '</div></header>';
  }
  function shareBtnHTML(title, url) {
    return '<div class="m13-read-share"><button type="button" class="m13-action"' + act({ kind: 'share' }, { card: title, url: url }) + '>' +
      txt(T('shareButton') || 'Поделиться') + '</button></div>';
  }
  function libUrl(dir, id, hash) {
    var u = new URL(S.base + dir + '/', location.href);
    return u.origin + u.pathname + (/^[\w-]+$/.test(id) ? id + '/' : '#' + hash);
  }

  // o = {list(), cover(it), read(it), filterOf(it)→{k,label,color}, filterOn, intro, allLabel, hash(id|null)→'#…'|null,
  //      card(it) — вместо обложек карточки (отзывы), full(it) — текст в окне, sub(key, openId)→{back, html} — пример внутри страницы}
  function libBind(holder, o) {
    var st = { f: '', n: LIB_STEP, y: 0, y2: 0, open: null, layer: false };
    var page = holder.closest('.m13-ipage'), box = holder.closest('.m13-internal');
    function sy() { return box ? box.scrollTop : (window.pageYOffset || 0); }
    function to(y) { if (box) box.scrollTop = y; else window.scrollTo(0, y); }
    function setHash(h) { if (h) try { history.replaceState(history.state, '', h); } catch (e) {} }
    function opts() {
      if (!o.filterOf || o.filterOn === false) return [];
      var seen = {}, out = [];
      o.list().forEach(function (it) { var f = o.filterOf(it); if (f && f.k && !seen[f.k]) { seen[f.k] = 1; out.push(f); } });
      return out.length > 1 ? out : [];
    }
    function list() { var L = o.list(); return st.f ? L.filter(function (it) { var f = o.filterOf(it); return f && f.k === st.f; }) : L; }
    function reading(on) { if (page) page.classList.toggle('m13-reading', on); }
    function grid() {
      st.open = null; reading(false);
      var op = opts(); if (st.f && !op.some(function (f) { return f.k === st.f; })) st.f = '';
      var L = list();
      var chips = op.length ? '<div class="m13-chips" role="group">' + [{ k: '', label: T('filterAll') || 'Все' }].concat(op).map(function (f) {
        return '<button type="button" class="m13-chip' + (f.color ? ' m13-rc' : '') + (st.f === f.k ? ' is-active' : '') + '" data-f="' + esc(f.k) + '"' + rcStyle(f.color) + '>' + txt(f.label) + '</button>';
      }).join('') + '</div>' : '';
      holder.innerHTML = (o.intro || '') + chips +
        (L.length ? '<div class="' + (o.card ? 'm13-rvs' : 'm13-covers') + '">' + L.slice(0, st.n).map(o.card || function (it) { return coverHTML(o.cover(it)); }).join('') + '</div>' : '') +
        (L.length > st.n ? '<div class="m13-lib-more"><button type="button" class="m13-soft" data-more>' + txt(T('showMore') || 'Показать ещё') + ' · ' + (L.length - st.n) + '</button></div>' : '');
      holder.querySelectorAll('[data-f]').forEach(function (b) {
        b.addEventListener('click', function () { st.f = b.getAttribute('data-f'); st.n = LIB_STEP; grid(); });
      });
      var m = holder.querySelector('[data-more]');
      if (m) m.addEventListener('click', function () { var y = sy(); st.n += LIB_STEP; grid(); to(y); });
      holder.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { open(b.getAttribute('data-open'), true); }); });
      evenGlassSoon(holder);
    }
    function find(id) {
      function idx(L) { for (var i = 0; i < L.length; i++) if (L[i].id === id) return i; return -1; }
      var L = list(), i = idx(L);
      if (i < 0 && st.f) { st.f = ''; L = list(); i = idx(L); }
      return i < 0 ? null : { L: L, i: i };
    }
    function nav(L, i) {
      var p = L[i - 1], n = L[i + 1];
      function go(x, lab) { return x ? '<button type="button" class="m13-read-go" data-go="' + esc(x.id) + '">' + txt(lab) + '</button>' : '<span></span>'; }
      return '<nav class="m13-read-nav">' + go(p, T('prevItem') || '← Предыдущий') +
        '<button type="button" class="m13-read-go m13-read-all" data-all>' + txt(String(o.allLabel).replace(/^←\s*/, '')) + '</button>' +
        go(n, T('nextItem') || 'Следующий →') + '</nav>';
    }
    function render(L, i) {
      st.open = L[i].id; reading(true);
      holder.innerHTML = '<div class="m13-read"><button type="button" class="m13-iback m13-read-back" data-all>' + txt(o.allLabel) + '</button>' +
        o.read(L[i]) + nav(L, i) + '</div>';
      bindActs(holder); bindLightbox(holder); filmsStart(holder);
      holder.querySelectorAll('[data-all]').forEach(function (b) {
        b.addEventListener('click', function () { if (st.layer) closeTop(); else { back(); setHash(o.hash(null)); } });
      });
      holder.querySelectorAll('[data-go]').forEach(function (b) {
        b.addEventListener('click', function () { var id = b.getAttribute('data-go'), x = find(id); if (!x) return; render(x.L, x.i); to(0); setHash(o.hash(id)); });
      });
      holder.querySelectorAll('[data-sub]').forEach(function (b) { b.addEventListener('click', function () { openSub(b.getAttribute('data-sub')); }); });
      evenGlassSoon(holder);
    }
    function back() { grid(); to(st.y); }
    function open(id, push) {
      var x = find(id); if (!x) return false;
      if (o.card) { modal(x.L, x.i, push); return true; }
      if (!st.open) st.y = sy();
      render(x.L, x.i); to(0);
      if (push && !st.layer) { st.layer = true; pushLayer('read', function () { st.layer = false; back(); }, o.hash(id)); }
      else setHash(o.hash(id));
      return true;
    }
    // Пример внутри страницы (например, день маршрута на странице архива) — свой шаг «назад»
    function openSub(key) {
      var s = o.sub && o.sub(key, st.open); if (!s) return;
      st.y2 = sy();
      holder.innerHTML = '<div class="m13-read"><button type="button" class="m13-iback m13-read-back" data-subback>' + txt(s.back) + '</button>' + s.html + '</div>';
      bindActs(holder); bindLightbox(holder);
      holder.querySelector('[data-subback]').addEventListener('click', closeTop);
      to(0);
      pushLayer('sub', function () { var x = find(st.open); if (x) render(x.L, x.i); to(st.y2); });
    }
    // Окно с полным текстом (отзывы): стрелки к соседним, закрыть — крестик, мимо окна, Esc, «назад»
    function modal(L, i, push) {
      var host = page || holder, m = host.querySelector('.m13-rvm');
      if (!m) {
        host.insertAdjacentHTML('beforeend', '<div class="m13-rvm" role="dialog" aria-modal="true"><div class="m13-rvm-box">' +
          '<button type="button" class="m13-x m13-rvm-x" aria-label="Закрыть"></button><div class="m13-rvm-body"></div>' +
          '<div class="m13-rvm-nav"><button type="button" class="m13-rvm-go" data-d="-1" aria-label="Предыдущий">←</button><span class="m13-rvm-n"></span>' +
          '<button type="button" class="m13-rvm-go" data-d="1" aria-label="Следующий">→</button></div></div></div>');
        m = host.querySelector('.m13-rvm'); xLook();
        m.querySelector('.m13-rvm-x').addEventListener('click', closeTop);
        m.addEventListener('click', function (e) { if (e.target === m) closeTop(); });
        m.querySelectorAll('[data-d]').forEach(function (b) { b.addEventListener('click', function () { if (m._go) m._go(+b.getAttribute('data-d')); }); });
      }
      var cur = i, was = document.body.classList.contains('m13-locked');
      function draw() {
        m.querySelector('.m13-rvm-body').innerHTML = o.full(L[cur]);
        m.querySelector('.m13-rvm-n').textContent = L.length > 1 ? (cur + 1) + ' / ' + L.length : '';
        m.querySelectorAll('[data-d]').forEach(function (b) { var d = +b.getAttribute('data-d'); b.disabled = !L[cur + d]; b.hidden = L.length < 2; });
        m.querySelector('.m13-rvm-box').scrollTop = 0;
      }
      function key(e) { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') m._go(e.key === 'ArrowRight' ? 1 : -1); }
      m._go = function (d) { if (L[cur + d]) { cur += d; draw(); } };
      draw(); m.classList.add('is-open'); lock(true);
      document.addEventListener('keydown', key);
      pushLayer('review', function () { m.classList.remove('is-open'); lock(was); document.removeEventListener('keydown', key); m._go = null; });
    }
    return { grid: grid, open: open };
  }

  /* ---------- Песочница ---------- */
  // Обложек в ряд на компьютере: look.perRow 2 / 3 / 4 (по умолчанию 3; на телефоне всегда 2)
  function colsCls(lk) { var n = +((lk || {}).perRow); return n === 2 || n === 4 ? ' m13-cols-' + n : ''; }
  function sandboxHTML(backBtn) {
    var sb = S.D.sandbox, notice = opt(sb.notice);
    var tabs = TABS.filter(function (t) { return visibleSorted(sb[t]).length; });
    return '<div class="m13-ipage' + colsCls(sb.look) + '"><div class="m13-itop">' + backBtn + '</div>' +
      '<div class="m13-ihead"><div class="m13-eyebrow">' + txt(sb.eyebrow || '') + '</div>' +
      '<h2>' + txt(sb.title || '') + '</h2>' + (sb.intro ? '<p>' + txt(sb.intro) + '</p>' : '') +
      (notice ? '<span class="m13-notice">' + txt(notice) + '</span>' : '') + '</div>' +
      '<div class="m13-tabs" role="tablist" style="--n:' + tabs.length + '">' + tabs.map(function (t) {
        return '<button type="button" class="m13-tab" role="tab" data-tab="' + t + '">' + txt((sb.tabs || {})[t] || t) + '</button>';
      }).join('') + '</div>' +
      '<div class="m13-lib" data-sb></div></div>';
  }
  // Обложка примера дня / Летописи. Картинка: своя обложка или картинка маршрута (у каждой своё «целиком / заполнить»); цвет: свой или маршрута.
  function sbImg(it, r) { return it.cover ? { img: it.cover, fit: it.coverFit || '' } : { img: r.image || '', fit: r.coverFit || '' }; }
  function sbCover(t, it, nested) {
    var r = routeById(it.routeId) || {}, c = Object.assign({ id: nested ? t + ':' + it.id : it.id, color: colorOf(it, r), nested: nested }, sbImg(it, r));
    if (t === 'days') {
      var dayN = it.day ? L('day', { n: it.day }) : '';
      if (S.D.sandbox.headMain !== 'day' && r.title) { c.title = r.title; c.line = [dayN, it.title].filter(Boolean).join(' · '); }
      else { c.top = [r.title, dayN].filter(Boolean).join(' · '); c.title = it.title; }
      c.text = firstLine(it.question || it.thought || it.meaning || firstText(t, it));
    } else { c.top = r.title || ''; c.title = it.name; c.text = firstLine(it.note || it.fragment || firstText(t, it)); }
    c.gl = glassOn(t, it);
    return c;
  }
  function sbRead(t, it) {
    var sb = S.D.sandbox, r = routeById(it.routeId) || {}, h = Object.assign({ color: colorOf(it, r) }, sbImg(it, r));
    var blocks = pairPractices(M13.sbBlocks(t, it, sb.labels) || []);
    if (t === 'days') {
      var dayN = it.day ? L('day', { n: it.day }) : '';
      h.meta = [opt(it.kin), opt(it.tone), opt(it.seal)].filter(Boolean);
      if (sb.headMain !== 'day' && r.title) { h.title = r.title; h.line = [dayN, it.title].filter(Boolean).join(' · '); }
      else { h.top = [r.title, dayN].filter(Boolean).join(' · '); h.title = it.title; }
    } else { h.top = r.title || ''; h.title = it.name; }
    var gf = glassFor(t, it);
    if (gf.g) { var ov = glassOver(t, it, gf.g); h.gl = { html: ov.gl, lb: ov.gllb, kin: glassHas(gf.g, 'kin', 'кин') && t === 'days' && !!opt(it.kin) }; }
    return '<article class="m13-panel m13-read-panel">' + readHeadHTML(h) + blocks +
      shareBtnHTML([h.title, h.line].filter(Boolean).join(' · '), libUrl('sandbox', it.id, t + '/' + encodeURIComponent(it.id))) + '</article>';
  }
  // Практики, идущие подряд (заголовок начинается с «Практика»), на компьютере стоят по две в ряд
  function pairPractices(list) {
    var pre = String(L('practice', { n: '' })).trim().toLowerCase(), one = String(L('practiceOne')).trim().toLowerCase();
    function isPr(b) {
      var t = String(b.title || '').trim().toLowerCase();
      return b.kind === 'text' && b.visible !== false && String(b.text || '').trim() && b.look !== 'mantra' &&
        (t.indexOf('практик') === 0 || (pre && t.indexOf(pre) === 0) || (one && t.indexOf(one) === 0));
    }
    var out = '', run = [];
    function flush() {
      out += run.length > 1 ? '<div class="m13-pair">' + run.map(sbBlockHTML).join('') + '</div>' : run.map(sbBlockHTML).join('');
      run = [];
    }
    list.forEach(function (b) { if (isPr(b)) run.push(b); else { if (b.visible === false) return; flush(); out += sbBlockHTML(b); } });
    flush();
    return out;
  }
  function reviewCard(it) {
    var r = routeById(it.routeId) || {}, sb = S.D.sandbox, text = String(it.text || '').trim(), c = colorOf(it, r);
    var meta = [r.title, it.month].filter(Boolean).join(' · ');
    var long = text.length > 240 || text.split('\n').length > 4;
    return '<button type="button" class="m13-rv' + (c ? ' m13-rc' : '') + '" data-open="' + esc(it.id) + '"' + rcStyle(c) + '>' +
      '<span class="m13-rv-text">«' + esc(plain(text.replace(/\n+/g, ' ')).slice(0, 420)) + '»</span>' +
      (long ? '<span class="m13-rv-more">' + txt(sb.moreLabel || 'Подробнее') + ' →</span>' : '') +
      '<span class="m13-rv-foot"><span class="m13-rv-who">' + txt(it.author || '') + '</span>' +
      (meta ? '<span class="m13-rv-meta">' + txt(meta) + '</span>' : '') + '</span></button>';
  }
  function reviewFull(it) {
    var sb = S.D.sandbox, r = routeById(it.routeId) || {};
    var meta = [r.title, it.month, it.source].filter(Boolean);
    return '<div class="m13-eyebrow">' + txt(L('review')) + '</div><h3>' + txt(it.author || '') + '</h3>' +
      (meta.length ? '<div class="m13-panel-meta">' + meta.map(function (m) { return '<span>' + txt(m) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="m13-quote">«' + txt(String(it.text || '').trim()) + '»</div>' +
      (it.signature && it.signature.show ? '<div class="m13-sign">' + txt(sb.signatureText || '') + '</div>' : '');
  }
  function sbFilterOf(it) { var r = routeById(it.routeId); return r ? { k: r.id, label: r.title, color: r.color || '' } : null; }

  function bindSandbox(scope, tab, itemId, useHash) {
    var sb = S.D.sandbox, holder = scope.querySelector('[data-sb]');
    var tabs = scope.querySelectorAll('.m13-tab');
    var have = TABS.filter(function (t) { return visibleSorted(sb[t]).length; });
    if (have.indexOf(tab) < 0) tab = have[0] || 'days';
    function show(t, id) {
      tabs.forEach(function (b) {
        var on = b.getAttribute('data-tab') === t;
        b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      var intro = String(((sb.intros || {})[t]) || '').trim();
      var lib = libBind(holder, {
        list: function () { return visibleSorted(sb[t]); },
        filterOf: sbFilterOf, filterOn: sb.filter !== false,
        intro: intro ? '<div class="m13-sb-intro m13-rich">' + rich(intro) + '</div>' : '',
        allLabel: T('backToAll') || '← Все примеры',
        hash: function (x) { return useHash ? '#' + t + (x ? '/' + encodeURIComponent(x) : '') : null; },
        cover: function (it) { return sbCover(t, it); },
        read: function (it) { return sbRead(t, it); },
        card: t === 'reviews' ? reviewCard : null, full: reviewFull
      });
      if (!(id && lib.open(id, false))) lib.grid();
    }
    tabs.forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-tab'); show(t, null);
        if (useHash) try { history.replaceState(history.state, '', '#' + t); } catch (e) {}
      });
    });
    show(tab, itemId);
  }

  /* ---------- События: встречи, медитации, фестивали, поездки; архив маршрутов ---------- */
  // events = {eyebrow, title, intro, tabs:{soon, past, routes, cases}, look, filter, items:[{id, visible, type, title, date, dateEnd, time, duration,
  //   dateText, place, price, cover, summary, blocks, actions, archive}]}. Прошедшие — «Как это было», маршруты с галочкой «в архив» — «Прошедшие маршруты».
  var EVENT_TYPES = { meeting: 'Встреча', meditation: 'Медитация', festival: 'Фестиваль', trip: 'Поездка', practice: 'Практика', case: 'Пример практики', other: '' };
  var EVENT_PLURAL = { meeting: 'Встречи', meditation: 'Медитации', festival: 'Фестивали', trip: 'Поездки', practice: 'Практики', other: 'Другое' };
  var EV_TABS = ['soon', 'past', 'routes', 'cases'];
  var EV_TN = { soon: 'Скоро', past: 'Как это было', routes: 'Прошедшие маршруты', cases: 'Примеры практик' };
  var EV_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function evDate(e) {
    if (String(e.dateText || '').trim()) return String(e.dateText).trim();
    var a = parseDate(e.date), b = parseDate(e.dateEnd);
    if (!a) return '';
    var s1 = a.getDate() + ' ' + EV_MONTHS[a.getMonth()];
    if (b && b.getTime() !== a.getTime()) s1 = (a.getMonth() === b.getMonth() ? a.getDate() : s1) + '–' + b.getDate() + ' ' + EV_MONTHS[b.getMonth()];
    return s1 + (e.time ? ', ' + e.time : '');
  }
  function evTab(e) {
    if (e.type === 'case') return 'cases';
    var end = parseDate(e.dateEnd) || parseDate(e.date);
    return end && end.getTime() < today().getTime() ? 'past' : 'soon';
  }
  // Маршруты в архиве: галочка «Показывать в архиве» и маршрут уже закончился. Новые — сверху.
  function archRoutes() {
    var t = today().getTime();
    return ((S.D.routes || {}).routes || []).filter(function (r) {
      var end = parseDate((r.dates || {}).to);
      return r && r.archive && r.visible !== false && (!end || end.getTime() < t);
    }).sort(function (a, b) { return String((b.dates || {}).to || '').localeCompare(String((a.dates || {}).to || '')); });
  }
  function evList(tab) {
    if (tab === 'routes') return archRoutes();
    var ev = S.D.events || {}, L = (ev.items || []).filter(function (e) { return e && e.visible !== false && evTab(e) === tab && (tab !== 'past' || e.archive !== false); });
    function t(e) { var d = parseDate(e.date); return d ? d.getTime() : 9e15; }
    return L.sort(function (a, b) { return tab === 'past' ? t(b) - t(a) : t(a) - t(b); });
  }
  function eventUrl(e) { return libUrl('events', e.id, encodeURIComponent(e.id)); }
  function eventsHTML(backBtn) {
    var ev = S.D.events || {};
    var tabs = EV_TABS.filter(function (t) { return evList(t).length; });
    return '<div class="m13-ipage' + colsCls(ev.look) + '"><div class="m13-itop">' + backBtn + '</div>' +
      '<div class="m13-ihead"><div class="m13-eyebrow">' + txt(ev.eyebrow || '13 MIRRORS') + '</div>' +
      '<h2>' + txt(ev.title || 'События') + '</h2>' + (ev.intro ? '<p>' + txt(ev.intro) + '</p>' : '') + '</div>' +
      // Вкладки видны и когда она одна — как подпись раздела («Прошедшие маршруты»)
      (tabs.length ? '<div class="m13-tabs" role="tablist" style="--n:' + tabs.length + '">' + tabs.map(function (t) {
        return '<button type="button" class="m13-tab" role="tab" data-tab="' + t + '">' + txt((ev.tabs || {})[t] || EV_TN[t]) + '</button>';
      }).join('') + '</div>' : '') +
      (tabs.length ? '<div class="m13-lib" data-ev></div>' : '<p class="m13-sb-intro">' + txt(ev.empty || 'Скоро здесь появятся новые события.') + '</p>') + '</div>';
  }
  function evCover(e) {
    var g = e.cover ? glassOf(e) : null;
    return { id: e.id, img: e.cover || '', fit: e.coverFit || '', top: [EVENT_TYPES[e.type] || '', evDate(e)].filter(Boolean).join(' · '), title: e.title || '',
      text: e.summary ? firstLine(e.summary) : '', gl: g ? glassHTML(e, g) : '' };
  }
  /* ---------- Стекло с надписью на картинке события ----------
     events.look.imgGlass — образец для всех событий (on: false — выключен): {on, pos, tint, tintColor, glass, blur, rim, font, weight, color, size, align,
       top, topText, title, date, place, price, mark, extraOn, extra}; строки top/title/date/place/price — false, чтобы скрыть.
     У события item.glass = {mode: '' (как у всех) | 'off' | 'own', …те же поля}. Надпись — настоящий текст поверх картинки. */
  var GL_POS = { bottom: 1, band: 1, top: 1, left: 1, right: 1, center: 1, full: 1 };
  // Девять точек: сверху / по центру / снизу × слева / по центру / справа — надпись по ширине текста (или g.width)
  var GL_PT = { tl: 'left', tc: 'center', tr: 'right', ml: 'left', mc: 'center', mr: 'right', bl: 'left', bc: 'center', br: 'right' };
  var GL_WIDTH = { s: '36%', m: '50%', l: '70%', f: 'calc(100% - 2 * var(--gl-o))' };
  M13.GLASS_PT = GL_PT;
  /* «Свои строки» (g.write = 'own'): g.rows = [{id, visible, text, font, weight, italic, size, color, caps, gap, line}].
     В тексте — вставки {название}, {дата}, {место}, {цена}, {тип} (события), {маршрут}, {даты}, {день}, {кин} (маршруты), {кин} (карты).
     size: xs | s | m | l | xl | xxl — в долях ширины картинки (u), с пределами в px. gap — отступ перед строкой: '' | s | m | l. */
  var GL_ROW = { xs: [1.9, 7, 12], s: [2.6, 8.5, 16], m: [3.6, 10, 24], l: [5.4, 12, 36], xl: [7.6, 13, 52], xxl: [10, 15, 68] };
  var GL_GAP = { s: 0.7, m: 1.5, l: 2.8 };
  M13.GLASS_ROW = GL_ROW; M13.GLASS_GAP = GL_GAP;
  var GL_TINT = { light: '255,255,255', dark: '20,14,10', gold: '236,211,163' };
  var GL_DEF = { pos: 'bottom', tint: 'dark', glass: 70, blur: 8, rim: 'line', font: 'Cormorant Garamond', weight: 'normal', color: '#ecd3a3', size: 'm', align: '' };
  M13.GLASS_DEF = GL_DEF;
  // Где стекло по умолчанию: у событий — снизу, у картинок маршрутов и Карт-Отражений — полосой по нижнему краю
  var GL_POS_DEF = { event: 'bottom', days: 'band', chronicles: 'band', route: 'band', kin: 'band' };
  M13.GLASS_POS_DEF = GL_POS_DEF;
  /* Значки на картинке — два места: g.mark1, g.mark2 = {on, kind, mirror, at, pt, size, color, fade, all}.
     kind: dandelion (из логотипа) | dandelion2 (прямой) | dandelion3 (на изгибе; mirror — зеркально) | flower (без стебля) | logo (13 MIRRORS).
     at: 'text' — рядом с надписью, на стекле | 'free' — отдельно, в одной из девяти точек pt (по умолчанию справа снизу), без стекла, с лёгкой тенью.
     size s | m | l; color — пусто: цвет надписи; fade — прозрачность 0–90 % (по умолчанию: отдельно 60, рядом с надписью 0);
     all — водяной знак: и на всех фото объекта (галерея события, фото маршрута в архиве). Старое g.mark ('dandelion' | 'logo') = место 1 рядом с надписью. */
  var MK_KIND = { dandelion: 'logo', dandelion2: 'line', dandelion3: 'wave', flower: 'flower', logo: '' };
  var MK_DEF = [{ kind: 'dandelion', at: 'text' }, { kind: 'logo', at: 'free' }];
  // Размер: множитель; высота значка в долях размера шрифта (рядом с надписью — от строки даты, отдельно — от ширины картинки)
  var MK = { k: { s: 0.75, m: 1, l: 1.4 }, near: { dand: 2.1, flower: 1.7, logo: 1.15 }, free: { dand: 2.6, flower: 2, logo: 1 }, fs: [6, 3.4, 34], off: [6, 3, 36] };
  M13.MARK = MK; M13.MARK_DEF = MK_DEF;
  function mkType(kind) { return kind === 'logo' || kind === 'flower' ? kind : 'dand'; }
  function marksOf(g) {
    var L = [];
    if (!g) return L;
    [g.mark1, g.mark2].forEach(function (m, i) {
      if (!m || !m.on) return;
      var d = MK_DEF[i], at = m.at === 'text' || m.at === 'free' ? m.at : d.at;
      var fade = m.fade == null || m.fade === '' || isNaN(+m.fade) ? (at === 'free' ? 60 : 0) : Math.max(0, Math.min(90, +m.fade));
      L.push({ kind: MK_KIND[m.kind] != null ? m.kind : d.kind, mirror: !!m.mirror, at: at, pt: GL_PT[m.pt] ? m.pt : 'br', size: MK.k[m.size] ? m.size : 'm',
        color: /^#[0-9a-f]{6}$/i.test(m.color || '') ? m.color : '', fade: fade, all: at === 'free' && !!m.all });
    });
    if (g.mark1 == null && g.mark2 == null && (g.mark === 'dandelion' || g.mark === 'logo')) L.push({ kind: g.mark, at: 'text', pt: 'br', size: 'm', color: '', fade: 0, all: false });
    return L;
  }
  function markSVG(m) { return m.kind === 'logo' ? logoHTML({}) : dandSVG(MK_KIND[m.kind], m.mirror); }
  // col — цвет надписи (значок без своего цвета — им же); free — значок отдельно, поверх картинки
  function markHTML(m, col, free) {
    var c = m.color || col, st = ['color:' + c];
    if (m.fade) st.push('opacity:' + (1 - m.fade / 100).toFixed(2));
    if (free) st.push('--mk-sh:' + (lum(hexRgb(/^#[0-9a-f]{6}$/i.test(c) ? c : GL_DEF.color)) < 110 ? 'rgba(255,248,235,.55)' : 'rgba(0,0,0,.38)'));
    return '<span class="' + (free ? 'm13-mk m13-mk--' + m.pt : 'm13-gl-mk') + ' m13-mk-t-' + mkType(m.kind) + ' m13-mk-sz-' + m.size + '" style="' + esc(st.join(';')) + '">' + markSVG(m) + '</span>';
  }
  M13.marksOf = marksOf; M13.markSVG = markSVG;
  function glv(g, k) { return g[k] == null || g[k] === '' ? GL_DEF[k] : g[k]; }
  // Образец d (on: false — выключен) и своё у объекта f = {mode: '' (как у всех) | 'off' | 'own', …}
  function glassPick(d, f) { d = d || {}; f = f || {}; return f.mode === 'own' ? f : f.mode === 'off' ? null : d.on !== false ? d : null; }
  // Образец стекла на картинке — look.imgGlass (look.glass — это «Прозрачность панелей» страницы, число)
  function imgGlassOf(lk) { lk = lk || {}; return lk.imgGlass || (lk.glass && typeof lk.glass === 'object' ? lk.glass : null); }
  function glassOf(e, ev) { return glassPick(imgGlassOf((ev || S.D.events || {}).look), e && e.glass); }
  function glassLines(e, g) {
    function on(k) { return g[k] !== false; }
    return {
      top: on('top') ? String(g.topText || '').trim() || EVENT_TYPES[e.type] || '' : '',
      title: on('title') ? String(e.title || '').trim() : '',
      meta: [on('date') ? evDate(e) : '', on('place') ? e.place : '', on('price') ? e.price : ''].filter(function (x) { return String(x || '').trim(); }),
      extra: g.extraOn ? String(g.extra || '').trim() : ''
    };
  }
  /* Стекло на картинке маршрута: sandbox.look.imgGlass — образец для примеров дней, Летописей и маршрутов в архиве,
     у маршрута route.glass = {mode, …} — своё (действует везде, где стоит его картинка). Строки: top (надпись сверху; topText — своя,
     пусто — «Маршрут» или название маршрута), dates (даты маршрута), title, day («День N · …»), kin, extraOn + extra. */
  function routeGlassOf(r) { return glassPick(imgGlassOf((S.D.sandbox || {}).look), r && r.glass); }
  // Что можно написать на стекле: kind 'days' | 'chronicles' (x — пример, r — его маршрут) | 'route' (x — маршрут)
  function routeGlassSrc(kind, x, r) {
    var s = { kicker: T('archiveRoute') || 'Маршрут', dates: routeDates(r || {}), title: '', line: '', kin: '' };
    if (kind === 'days') {
      var dayN = x.day ? L('day', { n: x.day }) : '';
      if (S.D.sandbox.headMain !== 'day' && r.title) { s.title = r.title; s.line = [dayN, x.title].filter(Boolean).join(' · '); }
      else { s.kicker = r.title || s.kicker; s.title = x.title || ''; s.line = dayN; }
      s.kin = opt(x.kin);
    } else if (kind === 'chronicles') { s.kicker = r.title || s.kicker; s.title = x.name || ''; }
    else { s.title = r.title || ''; s.kin = opt(r.kin); }
    return s;
  }
  function routeGlassLines(s, g) {
    function on(k) { return g[k] !== false; }
    function ok(v) { return String(v || '').trim(); }
    return {
      top: [on('top') ? ok(g.topText) || s.kicker : '', on('dates') ? s.dates : ''].filter(ok).join(' · '),
      title: on('title') ? ok(s.title) : '',
      meta: [on('day') ? s.line : '', on('kin') ? s.kin : ''].filter(ok),
      extra: g.extraOn ? ok(g.extra) : ''
    };
  }
  /* Стекло на Карте-Отражении: reflection.look.imgGlass — образец, у карты item.glass = {mode, …}.
     Строки: title — название архетипа (крупно), kin — строка «Kin …» мелко под ним (по умолчанию выключена: кин есть на самой карте),
     topText — своя надпись сверху, extraOn + extra. */
  function kinGlassOf(it) { return glassPick(imgGlassOf((S.D.reflection || {}).look), it && it.glass); }
  function kinGlassLines(it, g) {
    function ok(v) { return String(v || '').trim(); }
    return { top: g.top !== false ? ok(g.topText) : '', title: g.title !== false ? ok(it.title) : '',
      meta: g.kin === true && ok(it.meta) ? [ok(it.meta)] : [], extra: g.extraOn ? ok(g.extra) : '' };
  }
  // Строки стекла для любого вида картинки (и для панели: предпросмотр, картинка превью ссылки)
  function glassLinesOf(kind, x, g) {
    if (kind === 'event') return glassLines(x, g);
    if (kind === 'kin') return kinGlassLines(x, g);
    if (kind === 'route') return routeGlassLines(routeGlassSrc('route', x, x), g);
    return routeGlassLines(routeGlassSrc(kind, x, routeById(x.routeId) || {}), g);
  }
  // Вставки для «своих строк»
  function glassTokens(kind, x) {
    if (kind === 'event') return { 'тип': EVENT_TYPES[x.type] || '', 'название': x.title || '', 'дата': evDate(x), 'место': x.place || '', 'цена': x.price || '' };
    if (kind === 'kin') return { 'название': x.title || '', 'кин': x.meta || '' };
    var r = kind === 'route' ? x : routeById(x.routeId) || {}, sr = routeGlassSrc(kind, x, r);
    return { 'название': sr.title, 'маршрут': r.title || '', 'даты': sr.dates, 'день': kind === 'days' ? sr.line : '', 'кин': sr.kin };
  }
  function glassRowsOf(kind, x, g) {
    if (g.write !== 'own') return null;
    var tk = glassTokens(kind, x);
    return (g.rows || []).filter(function (r) { return r && r.visible !== false; }).map(function (r) {
      var t = String(r.text || '').replace(/\{([^{}]+)\}/g, function (m, k) { var v = tk[k.trim().toLowerCase()]; return v == null ? '' : String(v).trim(); });
      // пустые вставки не оставляют висящих «·» и запятых
      t = t.replace(/\s*([·|,—–-])\s*(?=\s*[·|,—–-]|\s*$)/g, '').replace(/^\s*[·|,—–-]\s*/, '').replace(/[ \t]{2,}/g, ' ').trim();
      return t ? Object.assign({}, r, { text: t }) : null;
    }).filter(Boolean);
  }
  // Есть ли это на стекле: у своих строк — есть ли вставка {tok} в видимой строке, иначе — не выключена ли строка key
  function glassHas(g, key, tok) {
    if (!g) return false;
    if (g.write === 'own') return (g.rows || []).some(function (r) { return r && r.visible !== false && String(r.text || '').toLowerCase().indexOf('{' + tok + '}') >= 0; });
    return g[key] !== false;
  }
  // Какое стекло и на какой картинке: {g, img} (g — null, если стекла нет)
  function glassFor(kind, x) {
    var r, img;
    if (kind === 'event') { img = x.cover; return { img: img, g: img ? glassOf(x) : null }; }
    if (kind === 'kin') { img = x.image; return { img: img, g: img ? kinGlassOf(x) : null }; }
    r = kind === 'route' ? x : routeById(x.routeId) || {};
    img = kind === 'route' ? r.image : sbImg(x, r).img;
    return { img: img, g: img ? routeGlassOf(r) : null };
  }
  function glassBox(Ls, g, kind, rows) {
    var pt = GL_PT[g.pos] ? g.pos : '';
    var pos = pt ? 'pt m13-gl--' + pt : GL_POS[g.pos] ? g.pos : GL_POS_DEF[kind] || 'bottom', font = glv(g, 'font'), tint = glv(g, 'tint');
    var rgb = tint === 'own' ? hexRgb(g.tintColor || '#141414').join(',') : GL_TINT[tint] || GL_TINT.dark;
    var a = Math.max(0, Math.min(100, +glv(g, 'glass'))), bl = Math.max(0, Math.min(24, +glv(g, 'blur')));
    var al = g.align === 'left' || g.align === 'center' || g.align === 'right' ? g.align : pt ? GL_PT[pt] : pos === 'center' || pos === 'full' ? 'center' : 'left';
    var rim = g.rim === 'none' || g.rim === 'glow' ? g.rim : 'line', sz = g.size === 's' || g.size === 'l' ? g.size : 'm';
    var back = g.back === 'none' || g.back === 'rim' ? g.back : 'glass';
    if (back === 'rim' && rim === 'none') rim = 'line';
    // значки: рядом с надписью — в строке на стекле; отдельно — поверх картинки в своих точках (после стекла)
    var col = g.color || GL_DEF.color, MKS = marksOf(g);
    var mark = MKS.filter(function (m) { return m.at === 'text'; }).map(function (m) { return markHTML(m, col); }).join('');
    var free = MKS.filter(function (m) { return m.at === 'free'; }).map(function (m) { return markHTML(m, col, true); }).join('');
    if (rows ? !rows.length && !mark : !Ls.top && !Ls.title && !Ls.meta.length && !Ls.extra && !mark) return free;
    if (FONTS[font]) ensureFont(font);
    var ty = (FONTS[font] ? ["font-family:'" + font + "',Georgia,serif"] : []).concat(typeCss(font, glv(g, 'weight')));
    var rc = /^#[0-9a-f]{6}$/i.test(g.rimColor || '') ? g.rimColor : '';
    // Тень у букв: под тёмным текстом — светлая дымка, под светлым — тёмная
    var sh = lum(hexRgb(/^#[0-9a-f]{6}$/i.test(col) ? col : GL_DEF.color)) < 110 ? 'rgba(255,248,235,.6)' : 'rgba(0,0,0,.34)';
    var css = '--gl-bg:rgba(' + rgb + ',' + ((100 - a) / 100).toFixed(2) + ');--gl-b:' + bl + 'px;--gl-c:' + col + ';--gl-sh:' + sh +
      (rc ? ';--gl-rc:' + rc : '') + (pt && GL_WIDTH[g.width] ? ';--gl-w:' + GL_WIDTH[g.width] : '');
    var cls = 'm13-gl m13-gl--' + pos + ' m13-gl-al-' + al + ' m13-gl-rim-' + rim + ' m13-gl-sz-' + sz + (g.fit === 'even' ? ' m13-gl-even' : '') +
      (back !== 'glass' ? ' m13-gl-bk-' + back : '') + (rc ? ' m13-gl-rcs' : '') + (g.shadow === 'none' || g.shadow === 'strong' ? ' m13-gl-sh-' + g.shadow : '') + (rows ? ' m13-gl--own' : '');
    // fit 'even' — «одинаковая высота у всех»: плашки в одном ряду обложек/карт выравниваются по самой высокой (evenGlass)
    if (rows) return '<span class="' + cls + '" style="' + esc(css) + '">' + rows.map(function (r, i) {
      var f = r.font || font; if (FONTS[f]) ensureFont(f);
      var st = (FONTS[f] ? ["font-family:'" + f + "',Georgia,serif"] : []).concat(typeCss(f, r.weight || 'normal', !!r.italic));
      if (/^#[0-9a-f]{6}$/i.test(r.color || '')) st.push('color:' + r.color);
      return '<span class="m13-gl-r m13-gl-r--' + (GL_ROW[r.size] ? r.size : 'm') + (r.caps ? ' m13-gl-r--caps' : '') +
        (r.line && i ? ' m13-gl-r--line' : '') + (i && GL_GAP[r.gap] ? ' m13-gl-g-' + r.gap : '') + '" style="' + esc(st.join(';')) + '">' + txt(r.text) + '</span>';
    }).join('') + (mark ? '<span class="m13-gl-row m13-gl-r-mk">' + mark + '</span>' : '') + '</span>' + free;
    return '<span class="' + cls + '" style="' + esc(css) + '">' +
      (Ls.top ? '<span class="m13-gl-top">' + txt(Ls.top) + '</span>' : '') +
      (Ls.title ? '<span class="m13-gl-t" style="' + esc(ty.join(';')) + '">' + txt(Ls.title) + '</span>' : '') +
      (Ls.meta.length || mark ? '<span class="m13-gl-row">' + (Ls.meta.length ? '<span class="m13-gl-d">' + txt(Ls.meta.join(' · ')) + '</span>' : '') + mark + '</span>' : '') +
      (Ls.extra ? '<span class="m13-gl-x" style="' + esc(ty.slice(0, 1).join(';')) + '">' + txt(Ls.extra) + '</span>' : '') + '</span>' + free;
  }
  // Стекло целиком (строки само из полей или свои)
  function glassMake(kind, x, g) { return glassBox(glassLinesOf(kind, x, g), g, kind, glassRowsOf(kind, x, g)); }
  function glassHTML(e, g) { return glassMake('event', e, g); }
  function glassOn(kind, x) { var f = glassFor(kind, x); return f.g ? glassMake(kind, x, f.g) : ''; }
  /* Значки отдельно от надписи: free — все, что стоят в своих точках; wm — водяной знак (на остальных фото объекта);
     g.zoom — картинка крупно: '' — с надписью и значками | 'mark' — только значки, что стоят отдельно | 'plain' — как есть */
  function markParts(g) {
    var col = (g && g.color) || GL_DEF.color, fr = marksOf(g).filter(function (m) { return m.at === 'free'; });
    function h(L) { return L.map(function (m) { return markHTML(m, col, true); }).join(''); }
    var wm = h(fr.filter(function (m) { return m.all; }));
    return { free: h(fr), wm: wm, wmlb: g && g.zoom === 'plain' ? '' : wm };
  }
  // Для galleryHTML: стекло на главной картинке (gl) и что на ней крупно (gllb); водяной знак на остальных фото (wm) и крупно (wmlb)
  function glassOver(kind, x, g) {
    var mp = markParts(g), gl = glassMake(kind, x, g);
    return { gl: gl, gllb: g.zoom === 'plain' ? '' : g.zoom === 'mark' ? mp.free : gl, wm: mp.wm, wmlb: mp.wmlb };
  }
  // Есть ли на картинке надпись (а не только значки в углу)
  function glText(html) { return String(html || '').indexOf('class="m13-gl ') >= 0; }
  // «Одинаковая высота у всех»: в каждой сетке обложек / Карт-Отражений плашки получают высоту самой высокой
  function evenGlass(root) {
    root = root || S.root; if (!root) return;
    root.querySelectorAll('.m13-covers, .m13-examples').forEach(function (grp) {
      var gs = [].slice.call(grp.querySelectorAll('.m13-gl-even'));
      gs.forEach(function (x) { x.style.minHeight = ''; });
      if (gs.length < 2) return;
      var h = Math.max.apply(null, gs.map(function (x) { return x.offsetHeight; }));
      if (h) gs.forEach(function (x) { x.style.minHeight = h + 'px'; });
    });
    if (!S.glEvenBound) {
      S.glEvenBound = true;
      var again = function () { clearTimeout(S.glEvenT); S.glEvenT = setTimeout(function () { evenGlass(); }, 120); };
      window.addEventListener('resize', again);
      if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', again);
    }
  }
  function evenGlassSoon(root) { (window.requestAnimationFrame || setTimeout)(function () { evenGlass(root); }); }
  M13.evenGlass = evenGlass;
  // Для панели: стекло на примере события; D — черновик {events, settings}
  M13.glassPreview = function (e, g, D) {
    var keep = S.D, kb = S.base; S.D = Object.assign({}, S.D || {}, D || {}); S.base = '../';
    try { return g ? glassHTML(e, g) : ''; } finally { S.D = keep; S.base = kb; }
  };
  // Для панели: стекло любого вида. kind — 'event' | 'days' | 'chronicles' | 'route' | 'kin'; D — черновик целиком
  function withD(D, fn) {
    var keep = S.D, kb = S.base; S.D = Object.assign({}, S.D || {}, D || {}); S.base = '../';
    try { return fn(); } finally { S.D = keep; S.base = kb; }
  }
  M13.glassPreviewOf = function (kind, x, g, D) { return withD(D, function () { return g ? glassMake(kind, x, g) : ''; }); };
  M13.glassRowsOf = function (kind, x, g, D) { return withD(D, function () { return glassRowsOf(kind, x, g); }); };
  M13.glassTokens = function (kind, x, D) { return withD(D, function () { return glassTokens(kind, x); }); };
  M13.glassLinesOf = function (kind, x, g, D) { return withD(D, function () { return glassLinesOf(kind, x, g); }); };
  M13.glassFor = function (kind, x, D) { return withD(D, function () { return glassFor(kind, x); }); };
  M13.glassOf = function (e, ev) { return glassOf(e, ev); };
  M13.glassLines = function (e, g) { return glassLines(e, g); };
  M13.evDate = function (e) { return evDate(e); };
  function actionsHTML(acts, ctx) {
    var btns = acts.map(function (a, i) {
      return '<button type="button" class="m13-action' + (i ? '' : ' m13-action--primary') + '"' +
        act(a, Object.assign({ action: a.label }, ctx)) + '>' + txt(a.label || 'Написать') + '</button>';
    }).join('');
    return btns ? '<div class="m13-actions m13-ev-actions' + (acts.length > 2 ? ' m13-actions--grid' : '') + '">' + btns + '</div>' : '';
  }
  function evRead(e) {
    // g0 — стекло события (даже без главной картинки: от него водяной знак на фото галереи)
    var g0 = glassOf(e), g = e.cover ? g0 : null, ov = g ? glassOver('event', e, g) : null, gl = ov ? ov.gl : '', wm = g0 ? markParts(g0) : null;
    // Что уже написано на стекле, над картинкой не повторяется (название остаётся для читалок экрана)
    var TOK = { top: 'тип', title: 'название', date: 'дата', place: 'место', price: 'цена' };
    var on = function (k) { return !gl || !glassHas(g, k, TOK[k]); };
    var meta = [on('date') ? evDate(e) : '', on('place') ? e.place : '', on('price') ? e.price : ''].filter(function (x) { return String(x || '').trim(); });
    var past = evTab(e) === 'past';
    var acts = (e.actions || []).filter(function (a) {
      if (!a || a.visible === false) return false;
      if (past && a.kind !== 'share' && a.kind !== 'link') return false;   // прошедшее: без записи и календаря — только ссылки и «Поделиться»
      if (a.kind === 'calendar') return calActive(evCal(e, a));
      return true;
    }).slice(0, 4).map(function (a) { return a.kind === 'calendar' ? Object.assign({}, a, { cal: evCal(e, a) }) : a; });
    return '<article class="m13-panel m13-ev">' +
      (gl ? (on('top') ? '<div class="m13-eyebrow">' + txt(EVENT_TYPES[e.type] || '') + '</div>' : '') +
        '<h3' + (on('title') ? '' : ' class="m13-sr"') + '>' + txt(e.title || '') + '</h3>' + galleryHTML([{ src: e.cover, caption: e.coverCaption || '' }], 'feature', ov)
      : '<div class="m13-eyebrow">' + txt(EVENT_TYPES[e.type] || '') + '</div><h3>' + txt(e.title || '') + '</h3>') +
      (meta.length ? '<div class="m13-panel-meta m13-ev-meta">' + meta.map(function (m) { return '<span>' + txt(m) + '</span>'; }).join('') + '</div>' : '') +
      (e.cover && !gl ? galleryHTML([{ src: e.cover, caption: e.coverCaption || '' }], 'feature', wm) : '') +
      (e.summary ? '<div class="m13-block"><div class="m13-rich">' + rich(e.summary) + '</div></div>' : '') +
      (e.blocks || []).map(function (b) { return sbBlockHTML(b, e, wm); }).join('') +
      actionsHTML(acts, { card: e.title, price: e.price || '', url: eventUrl(e), tplKey: 'offer' }) +
      '</article>';
  }
  // Календарь события: из даты и времени самого события (если у кнопки свои — берутся они)
  function evCal(e, a) {
    var c = Object.assign({}, a.cal || {});
    if (!c.date) c.date = e.date || '';
    if (!c.time && e.time && /^\d{1,2}:\d{2}$/.test(e.time)) c.time = e.time;
    if (!c.duration) c.duration = +e.duration || 120;
    if (!c.title) c.title = e.title;
    if (!c.place) c.place = e.place || '';
    return c;
  }
  // Маршрут в архиве: обложка и страница (картинка, даты, кин, описание, «как это было», фото, кнопки, примеры дней и Летописи)
  function routeDates(r) { var d = r.dates || {}; return evDate({ date: d.from, dateEnd: d.to }); }
  function routeCover(r) {
    return { id: r.id, img: r.image || '', fit: r.coverFit || '', color: r.color || '', top: routeDates(r), title: r.title || '', text: firstLine(r.description || ''), gl: glassOn('route', r) };
  }
  function routeRead(r) {
    var sb = S.D.sandbox || {};
    var days = visibleSorted(sb.days).filter(function (x) { return x.routeId === r.id; });
    var chr = visibleSorted(sb.chronicles).filter(function (x) { return x.routeId === r.id; });
    var kin = opt(r.kin);
    var acts = (r.archiveActions || []).filter(function (a) { return a && a.visible !== false; }).slice(0, 4);
    if (r.routeUrl && r.archivePageBtn !== false) acts = acts.concat([{ kind: 'link', url: r.routeUrl, label: T('routePage') || 'Страница маршрута' }]).slice(0, 4);
    function sec(title, t, L) {
      return L.length ? '<section class="m13-read-sec"><div class="m13-block-title">' + txt(title) + '</div><div class="m13-covers m13-covers--mini">' +
        L.map(function (it) { return coverHTML(sbCover(t, it, true)); }).join('') + '</div></section>' : '';
    }
    var gr = glassFor('route', r), rov = gr.g ? glassOver('route', r, gr.g) : null, g0 = routeGlassOf(r), wm = g0 ? markParts(g0) : null;
    // Финальный ролик маршрута — вместо картинки наверху, играет сам при каждом открытии
    var film = r.finalVideo ? filmHTML(r, 'm13-film--read') : '';
    return '<article class="m13-panel m13-read-panel m13-ev">' + film +
      readHeadHTML({ img: film ? '' : r.image || '', fit: r.coverFit || '', color: r.color || '', top: [T('archiveRoute') || 'Маршрут', routeDates(r)].filter(Boolean).join(' · '), title: r.title, meta: kin ? [kin] : [],
        gl: rov ? { html: rov.gl, lb: rov.gllb, kin: glassHas(gr.g, 'kin', 'кин') } : null }) +
      (String(r.description || '').trim() ? '<div class="m13-block"><div class="m13-rich">' + rich(r.description) + '</div></div>' : '') +
      (r.archiveBlocks || []).map(function (b) { return sbBlockHTML(b, null, wm); }).join('') +
      actionsHTML(acts, { card: r.title, url: libUrl('events', r.id, encodeURIComponent(r.id)), routeUrl: r.routeUrl, tplKey: 'route' }) +
      sec((sb.tabs || {}).days || 'Примеры дней', 'days', days) + sec((sb.tabs || {}).chronicles || 'Летописи', 'chronicles', chr) +
      '</article>';
  }
  var EV = null;
  function showEvent(id) { if (EV) EV.show(null, id, true); }
  function bindEvents(scope, itemId, useHash) {
    var holder = scope.querySelector('[data-ev]');
    if (!holder) return;
    var ev = S.D.events || {}, tabs = scope.querySelectorAll('.m13-tab'), all = ev.items || [];
    function tabOf(id) {
      var e = all.filter(function (x) { return x.id === id && x.visible !== false; })[0];
      if (e) return evTab(e);
      return archRoutes().some(function (r) { return r.id === id; }) ? 'routes' : null;
    }
    function show(t, id, push) {
      var have = EV_TABS.filter(function (x) { return evList(x).length; });
      if (id && EV_TABS.indexOf(id) >= 0) { t = id; id = null; }
      if (id) { var tt = tabOf(id); if (tt) t = tt; else id = null; }
      if (have.indexOf(t) < 0) t = have[0];
      tabs.forEach(function (b) { var on = b.getAttribute('data-tab') === t; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      var routes = t === 'routes';
      var lib = libBind(holder, {
        list: function () { return evList(t); },
        filterOf: routes ? null : function (e) { return EVENT_PLURAL[e.type] ? { k: e.type, label: EVENT_PLURAL[e.type] } : null; },
        filterOn: ev.filter !== false,
        allLabel: routes ? (T('backToRoutes') || '← Все маршруты') : (T('backToEvents') || '← Все события'),
        hash: function (x) { return useHash ? '#' + (x ? encodeURIComponent(x) : t) : null; },
        cover: routes ? routeCover : evCover,
        read: routes ? routeRead : evRead,
        sub: function (key, rid) {
          var p = key.split(':'), sb = S.D.sandbox || {}, it = visibleSorted(sb[p[0]]).filter(function (x) { return x.id === p[1]; })[0];
          var r = routeById(rid) || {};
          return it ? { back: '← ' + (r.title || ''), html: sbRead(p[0], it) } : null;
        }
      });
      if (!(id && lib.open(id, !!push))) lib.grid();
    }
    tabs.forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-tab'); show(t, null);
        if (useHash) try { history.replaceState(history.state, '', '#' + t); } catch (x) {}
      });
    });
    EV = { show: show };
    show(null, itemId);
  }

  /* ---------- Примеры Карт-Отражений ---------- */
  function reflectionHTML(backBtn) {
    var rf = S.D.reflection, items = visibleSorted(rf.items);
    var oa = rf.orderAction;
    return '<div class="m13-ipage"><div class="m13-itop">' + backBtn + '</div>' +
      '<div class="m13-ihead"><div class="m13-eyebrow">' + txt(rf.eyebrow || '') + '</div>' +
      '<h2>' + txt(rf.title || '') + '</h2>' + (rf.intro ? '<p>' + txt(rf.intro) + '</p>' : '') + '</div>' +
      '<div class="m13-examples">' + items.map(function (it) {
        // Со стеклом: название (и, если включено, Kin) — на стекле, под картинкой не повторяются.
        // Нажатие на карту открывает её крупно, целиком.
        var gf = glassFor('kin', it), ov = gf.g ? glassOver('kin', it, gf.g) : null, gl = ov ? ov.gl : '';
        var lb = it.image ? S.lb.push([{ src: media(it.image), caption: '', gl: ov ? ov.gllb : '' }]) - 1 : -1;
        return '<div class="m13-example' + (gl ? ' m13-example--gl' : '') + '">' +
          (it.image ? '<button type="button" class="m13-ex-img' + (gl ? ' m13-fit-whole' : '') + '" data-m13-lb="' + lb + ':0" aria-label="' + esc((it.title ? it.title + ' — ' : '') + 'открыть крупно') + '">' +
              (gl ? fitImgHTML(it.image, true, true) + '<span class="m13-gl-box">' + gl + '</span>' : '<img src="' + esc(media(it.image)) + '" alt="' + esc(it.title) + '" loading="lazy">') + '</button>'
            : '<div class="m13-placeholder">' + txt(rf.placeholder || '') + '</div>') +
          // Всегда 4 части (картинка, подпись Kin, архетип, описание) — по ним плашки в ряду выравниваются автоматически
          '<em class="m13-example-meta">' + (gl ? '' : txt(it.meta || '')) + '</em>' +
          '<strong>' + (gl && glassHas(gf.g, 'title', 'название') ? '<span class="m13-sr">' + txt(it.title) + '</span>' : txt(it.title)) + '</strong>' +
          // Описание — под кнопкой «Подробнее»: текст любой длины, картинки в ряду стоят ровно
          (it.text ? (rf.textOpen ? '<span>' + txt(it.text) + '</span>'
            : '<details class="m13-more m13-ex-more"><summary><span class="m13-more-open">' + txt(rf.moreLabel || 'Подробнее') + ' ↓</span>' +
              '<span class="m13-more-close">' + txt(rf.lessLabel || 'Свернуть') + ' ↑</span></summary><div class="m13-more-text">' + txt(it.text) + '</div></details>') : '<span></span>') + '</div>';
      }).join('') + '</div>' +
      (oa && oa.show !== false && oa.label ? '<div class="m13-examples-cta"><button type="button" class="m13-action m13-action--primary"' +
        act(oa, { card: rf.eyebrow || 'Карта-Отражение', action: oa.label, tplKey: 'offer' }) + '>' + txt(oa.label) + '</button></div>' : '') +
      '</div>';
  }

  /* ================= СВОЙ КИН (19.10, её решения — docs/kin.md) =================
     Дата рождения → кин (assets/kin.js, расчёт из «космолёта»). Кин — ключ, а не описание: имя, цвет, знак печати, тон;
     базовый архетип печати 13 MIRRORS — только если она отметила его «Показать на сайте» (reflection.kin.arch[печать] = { name, essence }).
     Где: блок оборота «kin» (коротко + «Подробнее») и страница vitrina/kin/ (+ тон, галактический день рождения, печать в маршрутах-волнах).
     Дата считается здесь же, никуда не уходит и не запоминается (в адрес страницы тоже не попадает). Тексты — reflection.kin, пусто — KIN_T. */
  var KIN_T = {
    label: 'Дата рождения', ph: 'ДД.ММ.ГГГГ', go: 'Узнать', note: 'Дата считается прямо на вашем устройстве и никуда не отправляется.',
    bad: 'Проверьте дату: день, месяц и год — например, 26.07.1987.',
    hunab: 'В Dreamspell 29 февраля — день вне времени, 0.0 Хунаб Ку: своего кина у него нет. По правилу Dreamspell кин зависит от времени рождения:',
    noonBefore: 'до полудня', noonAfter: 'после полудня', noonBoth: 'не знаю',
    ifBefore: 'Если до полудня — кин 28 февраля', ifAfter: 'Если после полудня — кин 1 марта',
    archOn: 'Ваша печать — одна из граней архетипа 13 MIRRORS «{архетип}».',
    archOff: 'Ваша печать — одна из граней архетипа 13 MIRRORS, который ещё раскрывается.',
    archNote: 'Кин — ваш день в календаре Цолькин. Архетип больше кина и больше печати: он вырастает из печати, а его личное звучание раскрывается в Карте-Отражении.',
    more: 'Подробнее о вашем кине →',
    eyebrow: 'Карта-Отражение', title: 'Узнать свой кин', intro: '',
    toneH: 'Ваш тон', toneT: 'Тон {номер тона} — {тон}. В каждой 13‑дневной волне ваш день — {номер тона}-й.',
    birthH: 'Галактический день рождения', birthT: 'Ваш кин возвращается раз в 260 дней. Ближайший галактический день рождения — {дата}.',
    birthToday: 'Сегодня ваш галактический день рождения!',
    routeH: 'Ваша печать в маршрутах 13 MIRRORS', routeT: '«{маршрут}» · {даты}', routeD: 'Ваша печать — день {день}, {дата}',
    routeSoon: 'Информация о маршруте скоро появится.', routeOpen: 'Открыть маршрут', routeAsk: 'Узнать подробнее',
    routeMsg: 'Здравствуйте! Хочу узнать о маршруте «{маршрут}» ({даты}).',
    // колесо даты (assets/kinwheel.js)
    wHintY: 'Поверните внешнее кольцо пальцем — как диск сейфа. Под стрелку наверху — год рождения.',
    wHintM: 'Теперь среднее кольцо — месяц.', wHintD: 'И внутреннее — день.',
    wHintReady: 'Проверьте дату. Можно докрутить любое кольцо. Готово — «Открыть».',
    wHintOpen: 'Ваше место в круге 260 дней. Нажмите на любую точку — покажу, что это за кин.',
    wHintPick: 'Нажимайте на любые кины. Ваш — в круге, волна выбранного кина — ярче.',
    wHunab: 'Ниже — про 29 февраля: выберите, до или после полудня вы родились.',
    wMini: 'Узнать свой кин', wpTitle: 'Узнать свой кин', wpSub: 'по дате рождения', wpGo: 'Открыть →', wOpen: 'Открыть', wAgain: '← Изменить дату', wTyped: 'Ввести дату цифрами', wWheel: '← Выбрать на колесе',
    wMine: '↩ К моему кину', wNext: 'Ближайший день этого кина — {дата}.', wWave: 'Волна «{маршрут}» · {даты}, день {день} из 13',
    wShow: 'Показать на Цолькине', wLayWaves: 'Волны', wLaySpiral: 'Спираль', wLayGrid: 'Таблица',
    // подписи к подсвеченным волнам под Цолькином
    wNow: 'Сейчас идёт волна «{маршрут}» · {даты}, сегодня {день}-й день из 13.', wNowPast: 'Ваша печать была в ней {дата} — {день}-й день.',
    wSeal: 'Ваша печать придёт снова {дата}: Kin {кин}, {имя} — {день}-й день волны «{маршрут}» · {даты}.',
    wSealHere: 'Ваша печать придёт в этой же волне {дата}: Kin {кин}, {имя} — {день}-й день.',
    wSealToday: 'Сегодня — день вашей печати: Kin {кин}, {имя}.',
    // механизм после «Открыть» на странице (assets/kinmech.js, 21.10): шестерёнки и Цолькин в объёме
    mHint: 'Крутите любую шестерёнку пальцем: каждый зубец — один день. По бублику идёт огонёк — это день на шестерёнках.',
    mToday: 'Сегодня', mMine: 'Мой кин',
    mFormH: 'Форма', mKnot: 'Бублик', mCoil: 'Волна — виток', mTower: 'Башня',
    mFlatH: '', m3d: 'Объём', mClassic: 'Таблица', mCut: 'Полотно',
    mCutCap: 'Строки — 20 печатей, столбцы — 13 тонов. День за днём — шаг вниз и вправо, наискосок.',
    mClassicCap: '13 столбцов по 20 дней, дни идут сверху вниз.',
    mToTable: '▦ Показать в таблице',
    mLayH: 'Цвет показывает', mSeal: 'Печати', mCastle: 'Замки', mSeason: 'Сезоны',
    mHlH: 'Подсветить', mHlNone: 'ничего', mHlWave: 'волну', mHlSeal: 'эту печать', mHlTone: 'этот тон', mHlPort: 'порталы',
    // лишние пояснения убраны (её решение 21.10) — пусто: строки нет; свои слова она может вписать в панели
    mLegend: '', mAboutKnot: '', mAboutCoil: '', mAboutTower: ''
  };
  M13.KIN_T = KIN_T;   // панель: подсказки в полях текстов
  var KIN_COL = ['#c0453c', '#ece6d8', '#3f6fc4', '#e2b13a'];
  /* Цвета колеса и плашек — у каждого месяца свои (её решение 19.10): showcase.kinLook = { preset, bg, ink, ac, pan, tx, panOff }.
     preset — готовый набор (KIN_LOOKS) или 'month' (из оформления карточек месяца); bg/ink/ac — фон круга, надписи, золото;
     pan/tx — фон и текст плашек результата; panOff — плашки как у страницы. Пусто — из набора; нет kinLook — ночной круг, как было. */
  var KIN_LOOKS = {
    night: { name: 'Ночь (как в октябре)', bg: '#1a1735', bg2: '#100e22', ink: '#ece6f7', mut: '#a59dc2', ac: '#f0d68c', line: '#3a3560', pan: '', tx: '' },
    red: { name: 'Красный — огонь', bg: '#3b1512', ink: '#f8e7dc', ac: '#f3b86a', pan: '#2a100d', tx: '#f8e7dc' },
    white: { name: 'Белый — светлый', bg: '#f3efe6', ink: '#2b2620', ac: '#9a6a14', pan: '#faf7f0', tx: '#2b2620' },
    blue: { name: 'Синий — глубина', bg: '#10264a', ink: '#e3edfb', ac: '#9fd0f2', pan: '#0b1b36', tx: '#e3edfb' },
    yellow: { name: 'Жёлтый — золото', bg: '#3a2c0b', ink: '#fcf1d3', ac: '#ffd45a', pan: '#2a1f07', tx: '#fcf1d3' },
    green: { name: 'Зелёный — лес', bg: '#12291d', ink: '#e4f2e7', ac: '#d8c47c', pan: '#0c1d14', tx: '#e4f2e7' },
    rose: { name: 'Роза — рассвет', bg: '#3a1731', ink: '#f8e6f1', ac: '#f3c08c', pan: '#2a1023', tx: '#f8e6f1' }
  };
  M13.KIN_LOOKS = KIN_LOOKS;
  function kinHex(c) { return /^#[0-9a-f]{6}$/i.test(c || '') ? c : ''; }
  function kinMix(a, b, t) { var x = hexRgb(a), y = hexRgb(b); return '#' + [0, 1, 2].map(function (i) { return ('0' + Math.round(x[i] + (y[i] - x[i]) * t).toString(16)).slice(-2); }).join(''); }
  // Набор «как у витрины месяца»: фон оборота карточек, их текст и акцент
  function kinMonthSet(sc) {
    var cs = sc.cardStyle || {}, bg = kinHex(cs.backBg) || kinHex(cs.bg) || kinHex((sc.background || {}).color) || '#1a1735', dark = lum(hexRgb(bg)) < 140;
    var ink = kinHex(cs.textColor); if (!ink || (lum(hexRgb(ink)) < 140) === dark) ink = dark ? '#efe4d2' : '#232323';
    return { bg: bg, ink: ink, ac: kinHex(cs.accent) || kinHex((sc.head || {}).color) || ink, pan: kinHex(cs.backBg), tx: kinHex(cs.backBg) ? ink : '' };
  }
  // Итоговые цвета для этого месяца (на отдельной странице кина — месяц, который открывается по основному адресу) или null
  function kinLook(scIn) {
    var sc = scIn || S.D.showcase || S.D.kinMonth, lk = sc && sc.kinLook;
    if (!lk || !(lk.preset || lk.bg || lk.ink || lk.ac || lk.pan || lk.tx || lk.panOff)) return null;
    var p = lk.preset === 'month' ? kinMonthSet(sc) : KIN_LOOKS[lk.preset] || KIN_LOOKS.night;
    var bg = kinHex(lk.bg) || p.bg, light = lum(hexRgb(bg)) >= 140, ink = kinHex(lk.ink) || p.ink || (light ? '#2b2620' : '#ece6f7');
    var pan = lk.panOff ? '' : kinHex(lk.pan) || p.pan, tx = pan ? kinHex(lk.tx) || p.tx || (lum(hexRgb(pan)) >= 140 ? '#2b2620' : '#efe4d2') : '';
    var o = { bg: bg, bg2: !lk.bg && p.bg2 || kinMix(bg, light ? '#c9c0ae' : '#000000', light ? .35 : .38), ink: ink, light: light,
      mut: !lk.bg && !lk.ink && p.mut || kinMix(ink, bg, .32), line: !lk.bg && !lk.ink && p.line || kinMix(ink, bg, .74), gold: kinHex(lk.ac) || p.ac || ink, pan: pan, tx: tx };
    o.on = inkFor(o.gold);
    return o;
  }
  M13.kinLook = kinLook;   // панель: образец цветов
  function kinLookCss(o) {
    if (!o) return '';
    var c = ['--kw-bg:' + o.bg, '--kw-bg2:' + o.bg2, '--kw-ink:' + o.ink, '--kw-mut:' + o.mut, '--kw-gold:' + o.gold, '--kw-line:' + o.line, '--kw-on:' + o.on];
    if (o.pan) c.push('--kin-pan:' + o.pan, '--kin-tx:' + o.tx, '--kin-mut:' + kinMix(o.tx, o.pan, .4), '--kin-soft:' + kinMix(o.tx, o.pan, .2), '--kin-line:' + kinMix(o.tx, o.pan, .8));
    return c.join(';');
  }
  function kinCfg() { return (S.D.reflection || {}).kin || {}; }
  function kinT(k) { var v = kinCfg()[k]; return v != null && String(v).trim() !== '' ? String(v) : KIN_T[k]; }
  function kinFill(t, ctx) { return String(t || '').replace(/\{([^{}]{1,30})\}/g, function (all, n) { n = n.trim().toLowerCase(); return ctx[n] != null ? ctx[n] : all; }); }
  // kin.js (расчёт) и kinwheel.js (колесо) — по требованию, только где есть блок кина
  function needKin(done) {
    if (window.M13KIN && window.M13KINW) { done(); return; }
    if (S.kinQ) { S.kinQ.push(done); return; }
    S.kinQ = [done];
    var left = 0;
    [['M13KIN', 'kin'], ['M13KINW', 'kinwheel']].forEach(function (x) {
      if (window[x[0]]) return;
      left++;
      var sc = document.createElement('script'); sc.src = S.base + 'assets/' + x[1] + '.js' + (VV ? '?v=' + VV : '');
      sc.onload = sc.onerror = function () { if (--left) return; var q = S.kinQ; S.kinQ = null; if (window.M13KIN && window.M13KINW) q.forEach(function (f) { f(); }); };
      document.head.appendChild(sc);
    });
  }
  // механизм страницы кина (assets/kinmech.js) — только когда он включён и страница открыта
  function needMech(done) {
    if (window.M13KINM) { done(); return; }
    if (S.mechQ) { S.mechQ.push(done); return; }
    S.mechQ = [done];
    var sc = document.createElement('script'); sc.src = S.base + 'assets/kinmech.js' + (VV ? '?v=' + VV : '');
    sc.onload = sc.onerror = function () { var q = S.mechQ; S.mechQ = null; if (window.M13KINM) q.forEach(function (f) { f(); }); };
    document.head.appendChild(sc);
  }
  function kinMechOn() { return (kinCfg().mech || {}).on !== false; }
  function kinIso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function kinDay(iso) { var d = parseDate(iso); return d.getDate() + ' ' + MON_GEN[d.getMonth()] + ' ' + d.getFullYear(); }
  function kinRange(a, b) {
    var x = parseDate(a), y = parseDate(b);
    if (x.getFullYear() !== y.getFullYear()) return kinDay(a) + ' – ' + kinDay(b);
    if (x.getMonth() !== y.getMonth()) return x.getDate() + ' ' + MON_GEN[x.getMonth()] + ' – ' + kinDay(b);
    return x.getDate() + '–' + kinDay(b);
  }
  function kinAdd(iso, n) { var d = parseDate(iso); d.setDate(d.getDate() + n); return kinIso(d); }
  // «ДД.ММ.ГГГГ» → 'ГГГГ-ММ-ДД' (или '' — неверная дата)
  function kinParse(v) {
    var m = /^\s*(\d{1,2})[.\/\-\s](\d{1,2})[.\/\-\s](\d{4})\s*$/.exec(v || '');
    if (!m || +m[3] < 1000) return '';
    var d = new Date(+m[3], +m[2] - 1, +m[1]);
    return d.getMonth() === +m[2] - 1 && d.getDate() === +m[1] ? kinIso(d) : '';
  }
  // Знак тона — точки и черты майя (1 черта = 5)
  function toneSVG(n) {
    var bars = Math.floor(n / 5), dots = n % 5, h = 10 + bars * 9 + (dots ? 12 : 0), y = 6, out = '';
    for (var i = 0; i < dots; i++) out += '<circle cx="' + (24 - (dots - 1) * 5 + i * 10) + '" cy="' + y + '" r="3.4"/>';
    if (dots) y += 10;
    for (var j = 0; j < bars; j++) out += '<rect x="7" y="' + (y + j * 9) + '" width="34" height="5.4" rx="2.7"/>';
    return '<svg class="m13-kin-tone" viewBox="0 0 48 ' + Math.max(h, 20) + '" aria-hidden="true">' + out + '</svg>';
  }
  function sealHTML(I) {
    var img = (kinCfg().sealImg || {})[I.sealN], c = KIN_COL[I.color];
    return '<span class="m13-kin-seal' + (I.color === 1 ? ' m13-kin-seal--w' : '') + '" style="--kc:' + c + '">' + (img ? '<img src="' + esc(media(img)) + '" alt="">' : '<b>' + I.sealN + '</b>') + '</span>';
  }
  // Карточка кина; ниже в ней же — строки про архетип (её правка 19.10: не висят отдельно на картинке страницы)
  function kinSigHTML(I, cap) {
    return '<div class="m13-kin-sig"><div class="m13-kin-sigr">' + sealHTML(I) + '<div class="m13-kin-sigt">' + (cap ? '<small>' + txt(cap) + '</small>' : '') +
      '<em>Kin ' + I.kin + '</em><strong>' + txt(I.kinName) + '</strong>' +
      '<span>Печать — ' + txt(I.seal) + ' · Тон ' + I.toneN + ' — ' + txt(I.tone) + '</span></div>' + toneSVG(I.toneN) + '</div>' + kinArchHTML(I) + '</div>';
  }
  function kinArchHTML(I) {
    var a = (kinCfg().arch || {})[I.sealN], name = a && String(a.name || '').trim();
    return '<div class="m13-kin-arch">' + (name
      ? '<p class="m13-kin-arch-h">' + txt(kinFill(kinT('archOn'), { 'архетип': name })) + '</p>' + (a.essence ? '<p class="m13-kin-arch-e">' + txt(a.essence) + '</p>' : '')
      : '<p class="m13-kin-arch-h">' + txt(kinT('archOff')) + '</p>') +
      (kinT('archNote') ? '<p class="m13-kin-arch-n">' + txt(kinT('archNote')) + '</p>' : '') + '</div>';
  }
  // Маршруты-волны, где встретится печать: ближайшие n раз с сегодняшнего дня. Волна — 13 кинов от тона 1 (29 февраля пропускается);
  // название — по первому дню волны (так называются её маршруты), а если в «Маршрутах» есть маршрут с той же датой начала — его название
  function kinWaves(seal, n) {
    var K = window.M13KIN, t = kinIso(today()), out = [], i, d, k;
    for (i = 0; i < 560 && out.length < n; i++) {
      d = kinAdd(t, i); k = K.kinOf(d);
      if (!k || K.sealOf(k) !== seal) continue;
      var day = K.toneOf(k), a = d, b = d, s = day, e = day;
      while (s > 1) { a = kinAdd(a, -1); if (K.kinOf(a)) s--; }
      while (e < 13) { b = kinAdd(b, 1); if (K.kinOf(b)) e++; }
      var r = (S.D.routes.routes || []).filter(function (x) { return x && (x.dates || {}).from === a; })[0] || null;
      out.push({ date: d, kin: k, day: day, from: a, to: b, title: r ? r.title : K.sealName(K.sealOf(k - day + 1)), route: r });
    }
    return out;
  }
  // Карточка маршрута на витрине: в самой витрине — текущий месяц, на отдельной странице — то, что положила публикация (kinCards)
  function kinCardOf(r) {
    if (!r) return '';
    var cs = (S.D.showcase && S.D.showcase.cards) || null;
    if (cs) { var c = cs.filter(function (x) { return x && x.visible !== false && x.back && x.back.routeId === r.id; })[0]; return c ? c.id : ''; }
    return (S.D.kinCards || {})[r.id] || '';
  }
  function kinPageHTML(I, date) {
    var K = window.M13KIN, t = kinIso(today()), next = '', i, d;
    for (i = 0; i < 261; i++) { d = kinAdd(t, i); if (K.kinOf(d) === I.kin) { next = d; break; } }
    var ctx = { 'тон': I.tone, 'номер тона': String(I.toneN) };
    var h = '<section class="m13-kin-sec"><h3>' + txt(kinT('toneH')) + '</h3><p>' + txt(kinFill(kinT('toneT'), ctx)) + '</p></section>';
    if (next) h += '<section class="m13-kin-sec"><h3>' + txt(kinT('birthH')) + '</h3><p>' + txt(next === t ? kinT('birthToday') : kinFill(kinT('birthT'), { 'дата': kinDay(next) })) + '</p></section>';
    var ws = kinWaves(I.sealN, 2);
    if (ws.length) h += '<section class="m13-kin-sec"><h3>' + txt(kinT('routeH')) + '</h3>' + ws.map(function (w) {
      var c = { 'маршрут': w.title, 'даты': kinRange(w.from, w.to), 'день': String(w.day), 'дата': kinDay(w.date) }, cid = kinCardOf(w.route);
      // название и даты — первой строкой, день печати — второй; «Показать на Цолькине» и кнопка — в одну строку (её правка 19.10)
      return '<div class="m13-kin-route"><p class="m13-kin-rt">' + txt(kinFill(kinT('routeT'), c)) + '</p>' +
        (kinT('routeD') ? '<p class="m13-kin-rd">' + txt(kinFill(kinT('routeD'), c)) + '</p>' : '') +
        (cid ? '' : '<p class="m13-kin-soon">' + txt(kinT('routeSoon')) + '</p>') + '<div class="m13-kin-racts">' +
        '<button type="button" class="m13-kin-link" data-m13-kin-show="' + w.kin + '" data-m13-kin-date="' + w.date + '">' + txt(kinT('wShow')) + '</button>' + (cid
        ? '<button type="button" class="m13-action" data-m13-kin-card="' + esc(cid) + '">' + txt(kinT('routeOpen')) + '</button>'
        : '<button type="button" class="m13-action"' +
          act({ kind: 'contact', label: kinT('routeAsk'), message: kinFill(kinT('routeMsg'), c) }, { card: w.title, action: kinT('routeAsk') }) + '>' + txt(kinT('routeAsk')) + '</button>') + '</div></div>';
    }).join('') + '</section>';
    return h;
  }
  // Колесо даты (её решение 19.10 — «делаем»): кольца год / месяц / день → «Открыть» → Цолькин; ниже — «Ввести дату цифрами» (прежнее поле).
  // На обороте карточки (её решение 19.10, вечер: без прокрутки в карточке) — маленькое «тихо живое» колесо, нажатие — страница кина на весь экран.
  // Вид, фон и движение маленького колеса — reflection.kin.mini (docs/plashki.md): lay 'middle' посередине, но меньше (надпись в круге) | 'left' / 'right' — в плашке,
  // колесо слева / справа | 'pair' — рядом с картинкой; bg 'deep' цветной (как было) | 'glass' стекло | 'none' без фона; mv 'calm' | 'quiet' | 'still'.
  function kinMini() {
    var m = kinCfg().mini || {};
    return { lay: { left: 1, right: 1, pair: 1 }[m.lay] ? m.lay : 'middle', bg: { glass: 1, none: 1 }[m.bg] ? m.bg : 'deep', mv: { quiet: 1, still: 1 }[m.mv] ? m.mv : 'calm' };
  }
  function kinCardHTML(x, list) {
    var mi = kinMini(), css = kinLookCss(kinLook()), title = String(x.title || '').trim(), lay = mi.lay, img = x.image || '';
    if (lay === 'pair' && !img) list.forEach(function (b) {
      if (!img && b.kind === 'images') (b.images || []).forEach(function (m) { if (!img && m && m.visible !== false && m.src) img = m.src; }); });
    if (lay === 'pair' && !img) lay = 'middle';
    var h = '<div class="m13-kin m13-kin--card m13-kin--' + lay + '"' + (css ? ' style="' + esc(css) + '"' : '') + '>', go = ' data-m13-kin-go aria-label="' + esc(title || kinT('wpTitle')) + '"';
    if (lay === 'left' || lay === 'right') return h + '<button type="button" class="m13-item m13-kinp' + (lay === 'right' ? ' m13-kinp--rev' : '') + ' m13-kwb--' + mi.bg + '"' + go + '>' +
      '<span class="m13-kinp-w"><span class="m13-kwm" data-m13-kin-wheel></span></span>' +
      '<span class="m13-kinp-t">' + txt(title || kinT('wpTitle')) + '</span>' + (kinT('wpSub') ? '<span class="m13-kinp-s">' + txt(kinT('wpSub')) + '</span>' : '') +
      (kinT('wpGo') ? '<span class="m13-item-action">' + txt(kinT('wpGo')) + '</span>' : '') + '</button></div>';
    h = (title ? '<div class="m13-block-title">' + txt(title) + '</div>' : '') + h;
    var wheel = '<button type="button" class="m13-kwm-btn m13-kwb--' + mi.bg + '"' + go + '><span class="m13-kwm' + (lay === 'middle' ? ' m13-kwm--txt' : '') + '" data-m13-kin-wheel' +
      (lay === 'middle' ? ' data-text="1"' : '') + '></span></button>';
    if (lay === 'pair') return h + '<div class="m13-kinpair"><img src="' + esc(media(img)) + '" alt="" loading="lazy">' + wheel + '</div></div>';
    return h + wheel + '</div>';
  }
  function kinFormHTML(mode) {
    var lk = kinLook(), css = kinLookCss(lk), pg = kinCfg().page || {}, pb = pg.bg, pf = pg.font || 'lora';
    // фон большого колеса на странице кина — reflection.kin.page.bg: 'deep' (по умолч.) | 'glass' | 'none'
    pb = mode === 'page' && { glass: 1, none: 1 }[pb] ? ' m13-kin--pg-' + pb : '';
    // шрифт текста ответа на странице кина — reflection.kin.page.font: 'lora' (по умолч.) | 'sans' | 'site' (как у страницы); название кина — шрифтом страницы
    if (mode === 'page' && pf === 'lora') ensureFont('Lora');
    if (mode === 'page' && { lora: 1, sans: 1 }[pf]) pb += ' m13-kin--f-' + pf;
    return '<div class="m13-kin m13-kin--' + mode + pb + (lk && lk.pan ? ' m13-kin--own' : '') + '" data-m13-kin="' + mode + '"' + (css ? ' style="' + esc(css) + '"' : '') + '>' +
      '<div class="m13-kw"></div>' + (mode === 'page' && kinMechOn() ? '<div class="m13-km" hidden></div>' : '') +
      '<div class="m13-kin-links"><button type="button" class="m13-kin-link m13-kin-again" hidden>' + txt(kinT('wAgain')) + '</button>' +
      '<button type="button" class="m13-kin-link m13-kin-typed">' + txt(kinT('wTyped')) + '</button></div>' +
      '<label class="m13-kin-l" hidden><span>' + txt(kinT('label')) + '</span><span class="m13-kin-row">' +
      '<input class="m13-kin-in" type="text" inputmode="numeric" autocomplete="off" maxlength="10" placeholder="' + esc(kinT('ph')) + '">' +
      '<button type="button" class="m13-action m13-action--primary m13-kin-go">' + txt(kinT('go')) + '</button></span></label>' +
      (kinT('note') ? '<p class="m13-kin-note">' + txt(kinT('note')) + '</p>' : '') +
      '<div class="m13-kin-out" aria-live="polite"></div></div>';
  }
  // Колесо и поле даты: точки в поле ставятся сами; «Открыть» на колесе, Enter или «Узнать» — результат. pre — { date, noon } (из блока оборота на страницу)
  function kinBind(scope, pre) {
    ensureFont('Cormorant Garamond');
    scope.querySelectorAll('[data-m13-kin-go]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); openInternal('kin'); });
    });
    scope.querySelectorAll('[data-m13-kin-wheel]').forEach(function (b) {
      needKin(function () {
        var w = kinCfg().wheel || {};
        window.M13KINW.mount(b, { mini: true, mat: w.mat, T: kinT, look: kinLook(), mv: kinMini().mv, noText: !b.hasAttribute('data-text'),
          idle: function () { return !!S.root.querySelector('.m13-internal.is-open,#m13-tile.is-open'); } });
      });
    });
    scope.querySelectorAll('[data-m13-kin]').forEach(function (box) {
      var mode = box.getAttribute('data-m13-kin'), inp = box.querySelector('.m13-kin-in'), out = box.querySelector('.m13-kin-out'),
        lab = box.querySelector('.m13-kin-l'), tBtn = box.querySelector('.m13-kin-typed'), again = box.querySelector('.m13-kin-again'),
        st = { date: '', noon: '', shown: '' }, wheel = null, mech = null, kwEl = box.querySelector('.m13-kw'), kmEl = box.querySelector('.m13-km'), mechT = 0;
      // Механизм (21.10, docs/tzolkin-gears.md): после «Открыть» сейф уходит, на его месте шестерёнки и Цолькин в объёме
      function mechShow(kins, quiet) {
        clearTimeout(mechT);
        needMech(function () {
          // материал и подложка — как у колеса-сейфа, если она не выбрала для механизма своё (reflection.kin.mech.mat / .bg)
          var mc = kinCfg().mech || {}, wm = (kinCfg().wheel || {}).mat || 'bronze', pg = (kinCfg().page || {}).bg || 'deep',
            mm = { bronze: 1, gold: 1, silver: 1, glass: 1 }[mc.mat] ? mc.mat : wm, mb = { night: 1, deep: 1, glass: 1, none: 1 }[mc.bg] ? mc.bg : pg;
          if (!mech) kmEl.className = 'm13-km m13-km--mat-' + mm + ' m13-km--bg-' + mb;
          if (!mech) mech = window.M13KINM.mount(kmEl, { T: kinT, today: kinIso(today()), cfg: mc, mat: mm,
            waveTitle: function (from, t) { var r = ((S.D.routes || {}).routes || []).filter(function (x) { return x && (x.dates || {}).from === from; })[0]; return r ? r.title : t; } });
          kwEl.classList.add('is-going');
          mechT = setTimeout(function () {
            kwEl.hidden = true; kwEl.classList.remove('is-going'); box.classList.add('is-mech');
            mech.show(kins, quiet);
            if (!quiet) kmEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, quiet ? 0 : 1300);
        });
      }
      function mechHide() {
        clearTimeout(mechT);
        if (mech) mech.hide();
        if (kwEl) { kwEl.hidden = false; kwEl.classList.remove('is-going'); }
        box.classList.remove('is-mech');
      }
      box.addEventListener('click', function (e) { e.stopPropagation(); });
      inp.addEventListener('input', function () {
        var dg = inp.value.replace(/\D/g, '').slice(0, 8), v = dg.slice(0, 2) + (dg.length > 2 ? '.' + dg.slice(2, 4) : '') + (dg.length > 4 ? '.' + dg.slice(4) : '');
        if (/^\d{1,2}[.\/\-\s]\d{1,2}[.\/\-\s]\d{4}$/.test(inp.value.trim())) return;
        if (v !== inp.value) inp.value = v;
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); run(); } });
      box.querySelector('.m13-kin-go').addEventListener('click', run);
      tBtn.addEventListener('click', function () {
        lab.hidden = !lab.hidden; tBtn.textContent = kinT(lab.hidden ? 'wTyped' : 'wWheel');
        if (!lab.hidden) inp.focus();
      });
      again.addEventListener('click', function () {
        st.date = ''; st.noon = ''; st.shown = ''; out.innerHTML = ''; again.hidden = true;
        mechHide();
        if (wheel) wheel.reset();
        box.querySelector('.m13-kw').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      function run() {
        st.date = kinParse(inp.value); st.noon = ''; st.shown = '';
        if (st.date && wheel) wheel.setDate(st.date);
        draw();
      }
      function draw() {
        needKin(function () {
          var K = window.M13KIN;
          if (!st.date) { out.innerHTML = '<p class="m13-kin-bad">' + txt(kinT('bad')) + '</p>'; return; }
          var h = '', I = null, two = null;
          if (/-02-29$/.test(st.date)) {
            h += '<div class="m13-kin-hunab"><p>' + txt(kinT('hunab')) + '</p><div class="m13-kin-noon">' + [['b', 'noonBefore'], ['a', 'noonAfter'], ['?', 'noonBoth']].map(function (x) {
              return '<button type="button" class="m13-action' + (st.noon === x[0] ? ' is-on' : '') + '" data-noon="' + x[0] + '">' + txt(kinT(x[1])) + '</button>'; }).join('') + '</div></div>';
            var ib = K.info(K.kinOf(kinAdd(st.date, -1))), ia = K.info(K.kinOf(kinAdd(st.date, 1)));
            if (st.noon === 'b') I = ib; else if (st.noon === 'a') I = ia; else if (st.noon === '?') two = [ib, ia];
          } else I = K.info(K.kinOf(st.date));
          if (two) h += kinSigHTML(two[0], kinT('ifBefore')) + kinSigHTML(two[1], kinT('ifAfter'));
          else if (I) h += kinSigHTML(I);
          if (I && mode === 'page') h += kinPageHTML(I, st.date);
          if ((I || two) && mode === 'card') h += '<button type="button" class="m13-action m13-kin-more">' + txt(kinT('more')) + '</button>';
          var oa = (S.D.reflection || {}).orderAction;
          if ((I || two) && mode === 'page' && oa && oa.show !== false && oa.label) h += '<div class="m13-examples-cta"><button type="button" class="m13-action m13-action--primary"' +
            act(oa, { card: (S.D.reflection || {}).eyebrow || 'Карта-Отражение', action: oa.label, tplKey: 'offer' }) + '>' + txt(oa.label) + '</button></div>';
          out.innerHTML = h;
          // колесо: кин известен — точки перелетают в Цолькин (звон — один раз на дату); 29 февраля без ответа — ждём «до/после полудня»
          var kins = two ? [two[0].kin, two[1].kin] : I ? [I.kin] : [];
          if (wheel) {
            if (kins.length && st.shown !== kins.join()) { wheel.reveal(kins, st.quiet); again.hidden = false; if (kmEl) mechShow(kins, st.quiet); }
            else if (!kins.length) { if (kmEl) mechHide(); wheel.wait(kinT('wHunab')); }
          }
          st.shown = kins.join(); st.quiet = false;
          out.querySelectorAll('[data-noon]').forEach(function (b) { b.addEventListener('click', function () { st.noon = b.getAttribute('data-noon'); draw(); }); });
          var mb = out.querySelector('.m13-kin-more');
          if (mb) mb.addEventListener('click', function () { S.kinPre = { date: st.date, noon: st.noon }; openInternal('kin'); });
          out.querySelectorAll('[data-m13-kin-card]').forEach(function (b) { b.addEventListener('click', function () { kinGoCard(b.getAttribute('data-m13-kin-card')); }); });
          out.querySelectorAll('[data-m13-kin-show]').forEach(function (b) {
            b.addEventListener('click', function () {
              var k = +b.getAttribute('data-m13-kin-show');
              if (mech && kwEl.hidden) { mech.go(k, b.getAttribute('data-m13-kin-date')); kmEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
              if (!wheel) return;
              wheel.pick(k);
              kwEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
          });
          bindActs(out);
        });
      }
      needKin(function () {
        var w = kinCfg().wheel || {};
        wheel = window.M13KINW.mount(box.querySelector('.m13-kw'), {
          mat: w.mat, clk: w.clk, opn: w.opn, lay: w.lay, portals: w.portals !== false, laySwitch: w.laySwitch !== false,
          T: kinT, look: kinLook(),
          onOpen: function (iso) { st.date = iso; st.noon = ''; st.shown = ''; draw(); },
          waveTitle: function (from, t) { var r = ((S.D.routes || {}).routes || []).filter(function (x) { return x && (x.dates || {}).from === from; })[0]; return r ? r.title : t; }
        });
        if (pre && pre.date) {
          var p = pre.date.split('-'); inp.value = p[2] + '.' + p[1] + '.' + p[0];
          st.date = pre.date; st.noon = pre.noon || ''; st.quiet = true; wheel.setDate(pre.date); draw();
        }
      });
    });
  }
  // «Открыть маршрут»: в самой витрине — закрыть страницу кина и открыть карточку; на отдельной странице — витрина с этой карточкой
  function kinGoCard(id) {
    if (S.view === 'showcase' && S.D.showcase) { closeTop(); setTimeout(function () { openCard(id); }, 350); return; }
    if (S.onBack) { S.onBack(); return; }
    location.href = S.base + '#' + encodeURIComponent(id);
  }
  function kinPage(backBtn) {
    return '<div class="m13-ipage m13-kin-page"><div class="m13-itop">' + backBtn + '</div>' +
      '<div class="m13-ihead"><div class="m13-eyebrow">' + txt(kinT('eyebrow')) + '</div><h2>' + txt(kinT('title')) + '</h2>' +
      (kinT('intro') ? '<p>' + txt(kinT('intro')) + '</p>' : '') + '</div>' + kinFormHTML('page') + '</div>';
  }
})();
