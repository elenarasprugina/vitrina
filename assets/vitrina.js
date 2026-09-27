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
    return /^(https?:|data:|blob:|\/)/.test(src) ? src : S.base + src;
  }
  function parseDate(iso) {
    if (!iso) return null;
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  /* ---------- Состояние ---------- */
  var S = { base: './', view: 'showcase', D: null, root: null, acts: [], layers: [], useHistory: true, card: null };

  function T(key) { return (S.D.settings.texts || {})[key] || ''; }
  function routeById(id) { return (S.D.routes.routes || []).filter(function (r) { return r.id === id; })[0] || null; }
  function formatById(id) { return (S.D.formats.formats || []).filter(function (f) { return f.id === id; })[0] || null; }

  /* ---------- Загрузка данных ---------- */
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('Не найден файл ' + url);
      return r.json();
    });
  }
  M13.load = function (base, showcaseId) {
    if (window.M13_DATA) {
      var P = window.M13_DATA;
      var id = showcaseId || P.settings.currentShowcase;
      return Promise.resolve({
        settings: P.settings, routes: P.routes, formats: P.formats, index: P.index,
        sandbox: P.sandbox, reflection: P.reflection, showcase: (P.showcases || {})[id] || null
      });
    }
    var d = base + 'data/';
    return Promise.all([
      getJSON(d + 'settings.json'), getJSON(d + 'routes.json'), getJSON(d + 'formats.json'),
      getJSON(d + 'sandbox.json'), getJSON(d + 'reflection.json')
    ]).then(function (r) {
      var out = { settings: r[0], routes: r[1], formats: r[2], sandbox: r[3], reflection: r[4], index: null, showcase: null };
      var id = showcaseId || out.settings.currentShowcase;
      if (S.view !== 'showcase') return out;
      return getJSON(d + 'showcases/' + id + '.json').then(function (sc) { out.showcase = sc; return out; });
    });
  };

  /* ---------- Запуск ---------- */
  M13.boot = function () {
    var el = document.getElementById('m13');
    M13.mount(el, {
      base: el.getAttribute('data-base') || './',
      view: el.getAttribute('data-view') || 'showcase',
      showcase: el.getAttribute('data-showcase') || null
    });
  };

  // opts: {base, view, showcase, data?}  data — готовые данные (для предпросмотра в панели).
  M13.mount = function (el, opts) {
    S.root = el; S.base = opts.base || './'; S.view = opts.view || 'showcase';
    S.onBack = opts.onBack || null; S.layers = []; S.useHistory = !opts.noHistory; lock(false);
    el.classList.add('m13');
    el.innerHTML = '<div class="m13-loading">…</div>';
    var p = opts.data ? Promise.resolve(opts.data) : M13.load(S.base, opts.showcase);
    return p.then(function (D) {
      S.D = D;
      if (S.view === 'sandbox') renderStandalone('sandbox');
      else if (S.view === 'reflection') renderStandalone('reflection');
      else renderShowcase();
    }).catch(function (e) {
      console.error(e);
      var msg = (S.D && T('loadError')) || 'Не удалось загрузить витрину. Попробуйте обновить страницу.';
      el.innerHTML = '<div class="m13-loading">' + esc(msg) + '</div>';
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
      if (url) window.open(url, '_blank', 'noopener');
    } else if (action.kind === 'internal') {
      openInternal(action.target, action.tab);
    } else {
      openContact(action, ctx);
    }
  }
  function bindActs(scope) {
    scope.querySelectorAll('[data-m13-act]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); runAct(+b.getAttribute('data-m13-act')); });
    });
  }

  /* ---------- Слои и кнопка «назад» телефона ---------- */
  // Открытая карточка, Песочница и окно контакта — «слои». Системная кнопка «назад» закрывает верхний слой.
  function pushLayer(name, closeFn, hash) {
    S.layers.push({ name: name, close: closeFn });
    if (!S.useHistory) return;
    try { history.pushState({ m13: S.layers.length }, '', hash != null ? hash : location.href); }
    catch (e) { S.useHistory = false; }
  }
  function closeTop() {
    if (!S.layers.length) return;
    if (S.useHistory) { history.back(); return; }
    S.layers.pop().close();
  }
  window.addEventListener('popstate', function () {
    var l = S.layers.pop();
    if (l) l.close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && S.layers.length) closeTop();
  });
  function lock(on) { document.body.classList.toggle('m13-locked', on); }

  /* ================= ВИТРИНА ================= */
  function renderShowcase() {
    var sc = S.D.showcase;
    if (!sc) throw new Error('Нет данных витрины');
    var st = S.D.settings;
    document.title = (st.siteTitle || '13 MIRRORS') + ' · ' + sc.title;
    S.acts = [];

    var bg = sc.background || {};
    var root = '<div class="m13-root" style="' +
      (bg.color ? 'background-color:' + esc(bg.color) + ';' : '') +
      (bg.image ? "background-image:url('" + esc(media(bg.image)) + "');" : '') + '">';

    var intro = opt(sc.intro);
    var html = root + '<main class="m13-page">' +
      '<header class="m13-header"><div class="m13-kicker">' + esc([st.siteTitle || '13 MIRRORS', T('kicker')].filter(Boolean).join(' · ')) + '</div>' +
      '<h1>' + esc(sc.title) + (sc.status === 'draft' ? '<span class="m13-draft">' + esc(T('draft') || 'черновик') + '</span>' : '') + '</h1>' +
      (intro ? '<p class="m13-intro">' + txt(intro) + '</p>' : '') + '</header>' +
      '<div class="m13-stage"><section class="m13-grid" aria-label="Карточки месяца">' +
      (sc.cards || []).slice(0, 9).map(thumbHTML).join('') +
      '</section></div></main>' +
      overlayHTML() + internalHTML() + modalHTML() + '</div>';
    S.root.innerHTML = html;

    S.root.querySelectorAll('.m13-thumb[data-card]').forEach(function (b) {
      b.addEventListener('click', function () { openCard(b.getAttribute('data-card')); });
    });
    bindOverlay(); bindModal();

    // Прямая ссылка на карточку: /2026-10/#sun
    var h = decodeURIComponent((location.hash || '').slice(1));
    if (h && !S.onBack && S.useHistory && findCard(h)) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      openCard(h);
    }
  }

  function findCard(id) {
    return (S.D.showcase.cards || []).filter(function (c) {
      return c.id === id && c.visible !== false && c.interactive !== false && c.back && c.back.type !== 'static';
    })[0] || null;
  }


  /* ---------- Оформление карточки: шрифт, цвет текста, дымка на картинке, свечение ---------- */
  var FONTS = {
    'Cormorant Garamond': 'Cormorant+Garamond:wght@400;600;700', 'Playfair Display': 'Playfair+Display:wght@400;700;800',
    'Philosopher': 'Philosopher:wght@400;700', 'Lora': 'Lora:wght@400;600;700', 'Montserrat': 'Montserrat:wght@400;600;800',
    'Comfortaa': 'Comfortaa:wght@400;700', 'Marck Script': 'Marck+Script'
  };
  M13.FONTS = Object.keys(FONTS);
  var fontsLoaded = {};
  function ensureFont(name) {
    if (!name || !FONTS[name] || fontsLoaded[name]) return;
    fontsLoaded[name] = true;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + FONTS[name] + '&display=swap';
    document.head.appendChild(l);
  }
  M13.ensureFont = ensureFont;
  function cardStyle(c) {
    var d = (S.D.showcase && S.D.showcase.cardStyle) || {}, f = ((c && c.front) || {}).style || {};
    var glow = f.glow && f.glow !== 'inherit' ? f.glow : (d.glow || 'off');
    return {
      font: f.font || d.font || '', textColor: f.textColor || d.textColor || '', bg: f.bg || d.bg || '',
      overlay: f.overlay && f.overlay !== 'inherit' ? f.overlay : (d.overlay || 'light'),
      glow: glow, glowColor: f.glowColor || d.glowColor || '#e8c77a'
    };
  }
  // Возвращает {cls, css} для карточки: классы и inline-стиль.
  function styleOf(c, hasImg) {
    var st = cardStyle(c), cls = [], css = [];
    if (st.font) { ensureFont(st.font); css.push("font-family:'" + st.font + "',Georgia,serif"); }
    if (st.textColor) { cls.push('m13-styled'); css.push('--m13-tc:' + st.textColor); }
    if (st.bg) css.push('background-color:' + st.bg);
    if (hasImg) cls.push('m13-ov-' + st.overlay);
    if (st.glow === 'soft' || st.glow === 'live') { cls.push('m13-glow-' + st.glow); css.push('--m13-glow:' + st.glowColor); }
    return { cls: cls.join(' '), css: css.join(';'), st: st };
  }

  function thumbHTML(c) {
    if (!c || c.visible === false) {
      return '<div class="m13-thumb m13-thumb--empty" aria-hidden="true"><span class="m13-empty-mark"></span></div>';
    }
    var f = c.front || {};
    var sty = styleOf(c, !!f.image);
    var css = (f.image ? "background-image:url('" + esc(media(f.image)) + "');" : '') + esc(sty.css);
    var cls = 'm13-thumb' + (f.image ? ' m13-thumb--img' : '') + (sty.cls ? ' ' + sty.cls : '');
    var isStatic = c.interactive === false || !c.back || c.back.type === 'static';
    var sub = opt(f.subtitle), status = opt(f.status), foot = opt(f.foot);
    var text = '<div class="m13-thumb-text">' +
      (f.eyebrow ? '<div class="m13-mini-type">' + esc(f.eyebrow) + '</div>' : '') +
      (f.title ? '<div class="m13-mini-title">' + esc(f.title) + '</div>' : '') +
      (sub ? '<div class="m13-mini-date">' + esc(sub) + '</div>' : '') +
      (status ? '<div class="m13-mini-status">' + esc(status) + '</div>' : '') + '</div>';
    if (isStatic) return '<div class="' + cls + ' m13-thumb--static" style="' + css + '">' + text + '</div>';
    return '<button type="button" class="' + cls + '" style="' + css + '" data-card="' + esc(c.id) + '">' + text +
      '<div class="m13-mini-foot">' + (foot ? '<span>' + esc(foot) + '</span>' : '') +
      '<span class="m13-mini-cta">' + esc(T('open') || 'открыть') + '</span></div></button>';
  }

  /* ---------- Увеличенная карточка ---------- */
  function overlayHTML() {
    return '<div class="m13-overlay" id="m13-overlay" role="dialog" aria-modal="true">' +
      '<div class="m13-big-stage">' +
      '<button type="button" class="m13-close" id="m13-close" aria-label="Закрыть">×</button>' +
      '<div class="m13-big-card" id="m13-bigcard">' +
      '<div class="m13-face m13-front" id="m13-front"></div>' +
      '<div class="m13-face m13-back"><div class="m13-content" id="m13-backc"></div></div>' +
      '</div>' +
      '<button type="button" class="m13-unflip" id="m13-unflip" aria-label="Показать лицевую сторону" title="Лицевая сторона">↺</button>' +
      '</div></div>';
  }
  function bindOverlay() {
    var ov = S.root.querySelector('#m13-overlay');
    S.root.querySelector('#m13-front').addEventListener('click', function () {
      S.root.querySelector('#m13-bigcard').classList.add('is-flipped');
      var bc = S.root.querySelector('#m13-backc'); bc.scrollTop = 0;
    });
    S.root.querySelector('#m13-unflip').addEventListener('click', function () {
      S.root.querySelector('#m13-bigcard').classList.remove('is-flipped');
    });
    S.root.querySelector('#m13-close').addEventListener('click', closeTop);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeTop(); });
  }

  function openCard(id) {
    var c = findCard(id); if (!c) return;
    S.card = c;
    var f = c.front || {};
    var front = S.root.querySelector('#m13-front');
    var sty = styleOf(c, !!f.image);
    front.className = 'm13-face m13-front' + (f.image ? ' m13-front--img' : '') + (sty.cls ? ' ' + sty.cls.replace(/m13-glow-\w+/g, '') : '');
    front.setAttribute('style', sty.css);
    front.style.backgroundImage = f.image ? "url('" + media(f.image) + "')" : '';
    var stage = S.root.querySelector('.m13-big-stage');
    stage.classList.remove('m13-glow-soft', 'm13-glow-live');
    if (sty.st.glow === 'soft' || sty.st.glow === 'live') { stage.classList.add('m13-glow-' + sty.st.glow); stage.style.setProperty('--m13-glow', sty.st.glowColor); }
    var sub = opt(f.subtitle), status = opt(f.status);
    front.innerHTML = '<div>' +
      (f.eyebrow ? '<div class="m13-hero-type">' + esc(f.eyebrow) + '</div>' : '') +
      (f.title ? '<div class="m13-hero-title">' + esc(f.title) + '</div>' : '') +
      (sub ? '<div class="m13-hero-date">' + esc(sub) + '</div>' : '') +
      (status ? '<div class="m13-hero-status">' + esc(status) + '</div>' : '') +
      '</div><div class="m13-flip-hint">' + esc(T('flipHint') || 'Нажать — открыть оборот') + '</div>';

    S.acts = [];
    var backc = S.root.querySelector('#m13-backc');
    backc.innerHTML = backHTML(c);
    bindActs(backc);

    S.root.querySelector('#m13-bigcard').classList.remove('is-flipped');
    S.root.querySelector('#m13-overlay').classList.add('is-open');
    lock(true);
    pushLayer('card', closeCardNow, '#' + encodeURIComponent(c.id));
  }
  function closeCardNow() {
    S.root.querySelector('#m13-overlay').classList.remove('is-open');
    S.root.querySelector('#m13-bigcard').classList.remove('is-flipped');
    lock(false); S.card = null;
  }

  M13.openCard = function (id, flipped) {
    openCard(id);
    if (flipped && S.card) S.root.querySelector('#m13-bigcard').classList.add('is-flipped');
  };

  /* ---------- Оборот: общее ---------- */
  function headHTML(c, extraMeta) {
    var f = c.front || {};
    var meta = [opt(f.subtitle), opt(f.status)].concat(extraMeta || []).filter(Boolean);
    return '<div class="m13-head">' + (f.eyebrow ? '<div class="m13-eyebrow">' + esc(f.eyebrow) + '</div>' : '') +
      '<h2>' + esc(f.title) + '</h2>' +
      (meta.length ? '<div class="m13-meta">' + meta.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') + '</div>' : '') +
      '</div>';
  }
  function descHTML(s) { return s ? '<div class="m13-desc">' + txt(s) + '</div>' : ''; }

  function backHTML(c) {
    var b = c.back || {};
    if (b.type === 'route') return backRoute(c);
    if (b.type === 'container') return backContainer(c);
    if (b.type === 'offer') return backOffer(c);
    return backText(c);
  }

  /* ---------- Оборот: маршрут ---------- */
  function dayCounter(r) {
    if (!r || !r.dates || !r.dates.from || !r.dates.to) return '';
    var from = parseDate(r.dates.from), to = parseDate(r.dates.to);
    var now = new Date(); now = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var DAY = 86400000;
    var n = Math.round((now - from) / DAY) + 1, total = Math.round((to - from) / DAY) + 1;
    if (n < 1 || n > total) return '';
    return fill(T('dayCounter') || 'Сегодня день {n} из {total}', { n: n, total: total });
  }

  function backRoute(c) {
    var b = c.back, r = routeById(b.routeId) || { title: (c.front || {}).title, routeUrl: '' };
    var desc = opt(b.description) || r.description || '';
    var kin = opt(r.kin);
    var h = headHTML(c, kin ? [kin] : []) + descHTML(desc);

    if (b.dayCounter && b.dayCounter.show) {
      var dc = dayCounter(r);
      if (dc) h += '<div class="m13-day">' + esc(dc) + '</div>';
    }
    if (b.routeButton && b.routeButton.show && r.routeUrl) {
      h += '<a class="m13-go" href="' + esc(r.routeUrl) + '" target="_blank" rel="noopener"><span>' +
        esc(b.routeButton.label || 'Пройти маршрут') + '</span><span aria-hidden="true">→</span></a>';
    }

    var list = (b.formats || []).filter(function (x) {
      return x.visible !== false && !(x.availability === 'closed' && b.closedFormats === 'hide');
    });
    if (list.length) {
      h += '<div class="m13-formats" style="--n:' + Math.min(list.length, 3) + '">' + list.map(function (x) {
        var fm = formatById(x.formatId) || {};
        var name = x.title || fm.title || '';
        var price = (x.price && opt(x.price)) || fm.price || '';
        var note = (x.note && opt(x.note)) || opt(fm.note);
        var closed = x.availability === 'closed';
        if (closed) note = T('formatClosed') || 'набор закрыт';
        var inner = '<div class="m13-format-name">' + esc(name) + '</div>' +
          (price ? '<div class="m13-format-price">' + esc(price) + '</div>' : '') +
          (note ? '<div class="m13-format-note">' + esc(note) + '</div>' : '');
        if (closed) return '<div class="m13-format is-closed" aria-disabled="true">' + inner + '</div>';
        var ctx = { card: (c.front || {}).title, route: r.title, format: name, price: price, routeUrl: r.routeUrl, tplKey: 'route' };
        var a = x.action || { kind: 'contact' };
        return '<button type="button" class="m13-format"' + act(a, ctx) + '>' + inner + '</button>';
      }).join('') + '</div>';
    }

    var sb = b.sandboxButton || { show: true };
    if (sb.show !== false) {
      h += '<button type="button" class="m13-soft"' + act({ kind: 'internal', target: 'sandbox' }) + '>' +
        esc(sb.label || 'Как устроены маршруты 13 MIRRORS') + '</button>';
    }
    return h;
  }

  /* ---------- Оборот: контейнер (встречи, индивидуальная работа) ---------- */
  // Плашки-элементы (встречи, виды работы, варианты продукта) — одна общая схема.
  function itemsHTML(c, list, max, tplKey) {
    var items = visibleSorted(list, max || 10);
    if (!items.length) return '';
    return '<div class="m13-items' + (items.length === 1 ? ' m13-items--one' : '') + '">' + items.map(function (it) {
      var date = opt(it.date), text = opt(it.text), dur = opt(it.duration), price = opt(it.price), status = opt(it.status);
      var meta = [dur, status].filter(Boolean).join(' · ');
      var a = it.action || { kind: 'contact' };
      var ctx = { card: (c.front || {}).title, item: it.title, date: date, price: price, tplKey: tplKey };
      return '<button type="button" class="m13-item"' + act(a, ctx) + '>' +
        (date ? '<div class="m13-item-date">' + esc(date) + '</div>' : '') +
        '<div class="m13-item-title">' + esc(it.title) + '</div>' +
        (text ? '<div class="m13-item-text">' + txt(text) + '</div>' : '') +
        (meta ? '<div class="m13-item-meta">' + esc(meta) + '</div>' : '') +
        (price ? '<div class="m13-item-price">' + esc(price) + '</div>' : '') +
        '<div class="m13-item-action">' + esc(a.label || 'Написать') + ' →</div></button>';
    }).join('') + '</div>';
  }

  function backContainer(c) {
    var b = c.back;
    var h = headHTML(c) + descHTML(opt(b.description)) + itemsHTML(c, b.items, b.max, 'container');
    var note = opt(b.note);
    if (note) h += '<div class="m13-info">' + txt(note) + '</div>';
    return h;
  }

  /* ---------- Оборот: предложение (Карта-Отражение, Свечи) ---------- */
  function backOffer(c) {
    var b = c.back, title = (c.front || {}).title;
    var h = headHTML(c);
    var imgs = (b.images || []).filter(function (x) { return x && (typeof x === 'string' || (x.visible !== false && x.src)); });
    if (imgs.length) {
      h += '<div class="m13-gallery">' + imgs.map(function (x) {
        var src = typeof x === 'string' ? x : x.src;
        return '<img src="' + esc(media(src)) + '" alt="" loading="lazy">';
      }).join('') + '</div>';
    }
    h += descHTML(opt(b.description));
    var price = opt(b.price);
    if (price) h += '<div class="m13-price-line"><span>' + esc(b.priceLabel || title) + '</span><strong>' + esc(price) + '</strong></div>';
    h += itemsHTML(c, b.items, b.max, 'offerItem');
    var dates = opt(b.dates);
    if (dates) {
      var dl = opt(b.datesLabel), dn = opt(b.datesNote);
      h += '<div class="m13-dates">' + (dl ? '<div class="m13-dates-label">' + esc(dl) + '</div>' : '') +
        '<div class="m13-dates-list">' + esc(dates) + '</div>' +
        (dn ? '<div class="m13-dates-note">' + txt(dn) + '</div>' : '') + '</div>';
    }
    var comp = opt(b.composition);
    if (comp) h += '<div class="m13-info">' + txt(comp) + '</div>';

    var btns = [];
    if (b.examples && b.examples.show) btns.push({ a: { kind: 'internal', target: 'reflection', label: b.examples.label || 'Примеры' } });
    (b.actions || []).slice(0, 2).forEach(function (a) { if (a && a.visible !== false) btns.push({ a: a }); });
    if (btns.length) {
      h += '<div class="m13-actions">' + btns.map(function (x, i) {
        var ctx = { card: title, action: x.a.label, price: price, tplKey: 'offer' };
        return '<button type="button" class="m13-action' + (i === 0 ? ' m13-action--primary' : '') + '"' + act(x.a, ctx) + '>' +
          esc(x.a.label || 'Написать') + '</button>';
      }).join('') + '</div>';
    }
    return h;
  }

  /* ---------- Оборот: текст (запасной тип) ---------- */
  function backText(c) {
    var b = c.back || {}, title = (c.front || {}).title;
    var h = headHTML(c);
    var t = opt(b.title); if (t) h += '<div class="m13-block-title">' + esc(t) + '</div>';
    h += descHTML(opt(b.text));
    if (b.action && b.action.visible !== false && b.action.label) {
      h += '<div class="m13-actions"><button type="button" class="m13-action m13-action--primary"' +
        act(b.action, { card: title, tplKey: 'text' }) + '>' + esc(b.action.label) + '</button></div>';
    }
    return h;
  }

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
  function contactUrl(ch, handle, message) {
    var h = String(handle || '').trim();
    if (!h) return '';
    if (ch === 'telegram') {
      h = h.replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me)\//i, '').replace(/^@/, '').replace(/\/.*$/, '');
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
    q('#m13-modal').classList.add('is-open');
    pushLayer('contact', function () { q('#m13-modal').classList.remove('is-open'); contactNow = null; });
  }
  function goChannel(ch) {
    if (!contactNow) return;
    var copied = copyText(contactNow.message);
    var url = contactUrl(ch, contactNow[ch], ch === 'telegram' ? contactNow.message : '');
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

  /* ================= ВНУТРЕННИЕ СТРАНИЦЫ ================= */
  function internalHTML() {
    return '<div class="m13-internal" id="m13-int-sandbox"></div><div class="m13-internal" id="m13-int-reflection"></div>';
  }
  // Открыть Песочницу или Примеры поверх открытой карточки («← Назад к карте» вернёт к обороту).
  function openInternal(target, tab) {
    var box = S.root.querySelector('#m13-int-' + target); if (!box) return;
    var back = '<button type="button" class="m13-iback" data-m13-iback>' + esc(T('backToCard') || '← Назад к карте') + '</button>';
    box.innerHTML = target === 'sandbox' ? sandboxHTML(back) : reflectionHTML(back);
    if (target === 'sandbox') bindSandbox(box, tab || 'days', null, false);
    else bindActs(box);
    box.querySelector('[data-m13-iback]').addEventListener('click', closeTop);
    box.classList.add('is-open'); box.scrollTop = 0;
    pushLayer(target, function () { box.classList.remove('is-open'); box.innerHTML = ''; });
  }

  // Песочница и Примеры как отдельные страницы: /sandbox/, /reflection/
  function renderStandalone(which) {
    var st = S.D.settings;
    var backHref = S.base;
    var back = S.onBack
      ? '<button type="button" class="m13-iback" data-m13-home>' + esc(T('backToShowcase') || '← К витрине') + '</button>'
      : '<a class="m13-iback" href="' + esc(backHref) + '">' + esc(T('backToShowcase') || '← К витрине') + '</a>';
    S.acts = [];
    var inner = which === 'sandbox' ? sandboxHTML(back) : reflectionHTML(back);
    S.root.innerHTML = '<div class="m13-standalone">' + inner + '</div>' + modalHTML();
    bindModal();
    var home = S.root.querySelector('[data-m13-home]');
    if (home) home.addEventListener('click', function () { S.onBack(); });
    if (which === 'sandbox') {
      document.title = (st.siteTitle || '13 MIRRORS') + ' · ' + (S.D.sandbox.title || 'Песочница');
      var h = decodeURIComponent((location.hash || '').slice(1)).split('/');
      bindSandbox(S.root, S.onBack ? 'days' : (h[0] || 'days'), S.onBack ? null : (h[1] || null), !S.onBack);
    } else {
      document.title = (st.siteTitle || '13 MIRRORS') + ' · ' + (S.D.reflection.eyebrow || 'Карта-Отражение');
      bindActs(S.root);
    }
  }

  /* ---------- Песочница ---------- */
  var TABS = ['days', 'chronicles', 'reviews'];
  var LABELS = { day: 'День {n}', meaning: 'Смысл дня', question: 'Вопрос дня', practice: 'Практика {n}', trace: 'Твой след',
    fragment: 'Фрагмент Летописи', lens: 'Линза 13 MIRRORS', review: 'Отзыв' };
  function L(key, vars) { var l = (S.D.sandbox.labels || {})[key]; return fill(l == null || l === '' ? LABELS[key] : l, vars || {}); }

  function sandboxHTML(backBtn) {
    var sb = S.D.sandbox, notice = opt(sb.notice);
    var tabs = TABS.filter(function (t) { return visibleSorted(sb[t]).length; });
    return '<div class="m13-ipage"><div class="m13-itop">' + backBtn + '</div>' +
      '<div class="m13-ihead"><div class="m13-eyebrow">' + esc(sb.eyebrow || '') + '</div>' +
      '<h2>' + esc(sb.title || '') + '</h2>' + (sb.intro ? '<p>' + txt(sb.intro) + '</p>' : '') +
      (notice ? '<span class="m13-notice">' + esc(notice) + '</span>' : '') + '</div>' +
      '<div class="m13-tabs" role="tablist" style="--n:' + tabs.length + '">' + tabs.map(function (t) {
        return '<button type="button" class="m13-tab" role="tab" data-tab="' + t + '">' + esc((sb.tabs || {})[t] || t) + '</button>';
      }).join('') + '</div>' +
      '<div class="m13-sb" data-sb></div></div>';
  }

  function sbListItem(tab, it) {
    var r = routeById(it.routeId) || {};
    var top = '', title = '', sub = '';
    if (tab === 'days') { top = [r.title, it.day ? L('day', { n: it.day }) : ''].filter(Boolean).join(' · '); title = it.title; sub = it.question; }
    else if (tab === 'chronicles') { top = r.title || ''; title = it.name; sub = it.note; }
    else { top = [r.title, it.month].filter(Boolean).join(' · '); title = it.author; sub = it.text; }
    return '<button type="button" class="m13-sb-item" data-item="' + esc(it.id) + '">' +
      (top ? '<div class="m13-sb-item-top">' + esc(top) + '</div>' : '') +
      '<div class="m13-sb-item-title">' + esc(title) + '</div>' +
      (sub ? '<div class="m13-sb-item-sub">' + esc(sub) + '</div>' : '') + '</button>';
  }

  function sbDetail(tab, it) {
    var sb = S.D.sandbox, r = routeById(it.routeId) || {};
    var img = it.image ? '<img class="m13-panel-img" src="' + esc(media(it.image)) + '" alt="" loading="lazy">' : '';
    var toList = '<button type="button" class="m13-iback m13-sb-toList" data-tolist>' + esc(T('backToList') || '← К списку') + '</button>';
    if (tab === 'days') {
      var meta = [opt(it.kin), opt(it.tone), opt(it.seal)].filter(Boolean);
      var pr = (it.practices || []).filter(Boolean);
      return toList + '<article class="m13-panel">' +
        '<div class="m13-eyebrow">' + esc([r.title, it.day ? L('day', { n: it.day }) : ''].filter(Boolean).join(' · ')) + '</div>' +
        '<h3>' + esc(it.title) + '</h3>' +
        (meta.length ? '<div class="m13-panel-meta">' + meta.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') + '</div>' : '') +
        img +
        (it.meaning ? '<div class="m13-block"><div class="m13-block-title">' + esc(L('meaning')) + '</div><p>' + txt(it.meaning) + '</p></div>' : '') +
        (it.question ? '<div class="m13-block"><div class="m13-block-title">' + esc(L('question')) + '</div><p>' + txt(it.question) + '</p></div>' : '') +
        (pr.length ? '<div class="m13-practices">' + pr.map(function (p, i) {
          return '<div class="m13-practice"><strong>' + esc(L('practice', { n: i + 1 })) + '</strong>' + txt(p) + '</div>';
        }).join('') + '</div>' : '') +
        (it.trace ? '<div class="m13-block"><div class="m13-block-title">' + esc(L('trace')) + '</div><p>«' + txt(it.trace) + '»</p></div>' : '') +
        '</article>';
    }
    if (tab === 'chronicles') {
      return toList + '<article class="m13-panel">' +
        '<div class="m13-eyebrow">' + esc(r.title || '') + '</div><h3>' + esc(it.name) + '</h3>' +
        (it.note ? '<p class="m13-desc">' + txt(it.note) + '</p>' : '') + img +
        (it.fragment ? '<div class="m13-block"><div class="m13-block-title">' + esc(L('fragment')) + '</div><p>' + txt(it.fragment) + '</p></div>' : '') +
        (it.lens ? '<div class="m13-block"><div class="m13-block-title">' + esc(L('lens')) + '</div><p>' + txt(it.lens) + '</p></div>' : '') +
        '</article>';
    }
    var meta2 = [r.title, it.month, it.source].filter(Boolean);
    return toList + '<article class="m13-panel">' +
      '<div class="m13-eyebrow">' + esc(L('review')) + '</div><h3>' + esc(it.author || '') + '</h3>' +
      (meta2.length ? '<div class="m13-panel-meta">' + meta2.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="m13-block"><div class="m13-quote">«' + txt(it.text) + '»</div>' +
      (it.signature && it.signature.show ? '<div class="m13-sign">' + esc(sb.signatureText || '') + '</div>' : '') +
      '</div></article>';
  }

  function bindSandbox(scope, tab, itemId, useHash) {
    var sb = S.D.sandbox;
    var holder = scope.querySelector('[data-sb]');
    var isMobile = function () { return window.matchMedia('(max-width:680px)').matches; };
    var tabs = scope.querySelectorAll('.m13-tab');
    if (!visibleSorted(sb[tab]).length) tab = (tabs[0] && tabs[0].getAttribute('data-tab')) || 'days';

    function setHash(t, id) {
      if (!useHash) return;
      try { history.replaceState(null, '', '#' + t + (id ? '/' + encodeURIComponent(id) : '')); } catch (e) {}
    }
    function show(t, id, openDetail) {
      tab = t;
      tabs.forEach(function (b) {
        var on = b.getAttribute('data-tab') === t;
        b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      var items = visibleSorted(sb[t]);
      var cur = items.filter(function (x) { return x.id === id; })[0] || items[0];
      holder.innerHTML = '<nav class="m13-sb-list">' + items.map(function (it) { return sbListItem(t, it); }).join('') + '</nav>' +
        '<div class="m13-sb-detail">' + (cur ? sbDetail(t, cur) : '') + '</div>';
      holder.classList.toggle('is-detail', !!openDetail);
      // .m13-panel прячется на телефоне, пока не выбран элемент
      holder.querySelectorAll('.m13-sb-item').forEach(function (b) {
        var bid = b.getAttribute('data-item');
        b.classList.toggle('is-active', !!cur && bid === cur.id);
        b.addEventListener('click', function () {
          show(t, bid, true); setHash(t, bid);
          if (isMobile()) { var sc = scope.closest('.m13-internal') || window; sc.scrollTo(0, 0); }
        });
      });
      var tl = holder.querySelector('[data-tolist]');
      if (tl) tl.addEventListener('click', function () { show(t, cur && cur.id, false); setHash(t, null); });
    }
    tabs.forEach(function (b) {
      b.addEventListener('click', function () { show(b.getAttribute('data-tab'), null, false); setHash(b.getAttribute('data-tab'), null); });
    });
    show(tab, itemId, !!itemId);
  }

  /* ---------- Примеры Карт-Отражений ---------- */
  function reflectionHTML(backBtn) {
    var rf = S.D.reflection, items = visibleSorted(rf.items);
    var oa = rf.orderAction;
    return '<div class="m13-ipage"><div class="m13-itop">' + backBtn + '</div>' +
      '<div class="m13-ihead"><div class="m13-eyebrow">' + esc(rf.eyebrow || '') + '</div>' +
      '<h2>' + esc(rf.title || '') + '</h2>' + (rf.intro ? '<p>' + txt(rf.intro) + '</p>' : '') + '</div>' +
      '<div class="m13-examples">' + items.map(function (it) {
        return '<div class="m13-example">' +
          (it.image ? '<img src="' + esc(media(it.image)) + '" alt="' + esc(it.title) + '" loading="lazy">'
            : '<div class="m13-placeholder">' + esc(rf.placeholder || '') + '</div>') +
          '<strong>' + esc(it.title) + '</strong>' + (it.text ? '<span>' + txt(it.text) + '</span>' : '') + '</div>';
      }).join('') + '</div>' +
      (oa && oa.show !== false && oa.label ? '<div class="m13-examples-cta"><button type="button" class="m13-action m13-action--primary"' +
        act(oa, { card: rf.eyebrow || 'Карта-Отражение', action: oa.label, tplKey: 'offer' }) + '>' + esc(oa.label) + '</button></div>' : '') +
      '</div>';
  }
})();
