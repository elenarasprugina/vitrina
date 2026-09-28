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

  function today() {
    if (window.M13_TODAY) return parseDate(window.M13_TODAY);
    var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  /* ---------- Состояние ---------- */
  var S = { base: './', view: 'showcase', D: null, root: null, acts: [], layers: [], useHistory: true, card: null, lb: [] };

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
    } else if (action.kind === 'calendar') {
      openCalendar(action.cal || action, ctx);
    } else if (action.kind === 'share') {
      shareCard(ctx);
    } else if (action.kind === 'download') {
      if (action.url) { var a = document.createElement('a'); a.href = action.url; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('download', ''); document.body.appendChild(a); a.click(); a.remove(); }
    } else {
      openContact(action, ctx);
    }
  }
  function bindActs(scope) {
    scope.querySelectorAll('[data-m13-act]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); runAct(+b.getAttribute('data-m13-act')); });
      if (b.getAttribute('role') === 'button') b.addEventListener('keydown', function (e) {
        if (e.target === b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); runAct(+b.getAttribute('data-m13-act')); } });
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
    if (LB.open && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) lbGo(e.key === 'ArrowRight' ? 1 : -1);
  });
  function lock(on) { document.body.classList.toggle('m13-locked', on); }

  /* ================= ВИТРИНА ================= */
  function renderShowcase() {
    var sc = S.D.showcase;
    if (!sc) throw new Error('Нет данных витрины');
    var st = S.D.settings;
    document.title = (st.siteTitle || '13 MIRRORS') + ' · ' + sc.title;
    S.acts = [];

    // Фон: цвет + картинка (отдельная для телефона), затемнение и размытие — слоями под страницей.
    var bg = sc.background || {}, rs = [];
    if (bg.color) rs.push('--m13-bgc:' + bg.color);
    if (bg.image) {
      rs.push("--m13-bgimg:url('" + media(bg.image) + "')", "--m13-bgimg-t:url('" + media(bg.imageTall || bg.image) + "')");
      rs.push('--m13-dim:' + (Math.max(0, Math.min(90, +bg.dim || 0)) / 100), '--m13-blur:' + Math.max(0, Math.min(20, +bg.blur || 0)) + 'px');
    }
    // Шапка: цвет надписей, положение, логотип вместо текста
    var hd = sc.head || {}, hcls = 'm13-header' + (hd.align === 'center' ? ' m13-header--center' : '') + (hd.color ? ' m13-header--tinted' : '');
    // Заголовок месяца — тем же шрифтом, что и карточки (если он задан для всего месяца)
    var hf = (sc.cardStyle || {}).font, hs = [];
    if (hd.color) hs.push('--m13-head:' + hd.color);
    if (hf) { ensureFont(hf); hs.push("--m13-hfont:'" + hf + "',Georgia,serif"); }
    var kicker = hd.logo
      ? '<h2 class="m13-logo-wrap"><span class="m13-logo" role="img" aria-label="' + esc(st.siteTitle || '13 MIRRORS') + '" style="-webkit-mask-image:url(\'' + S.base + 'assets/logo.png\');mask-image:url(\'' + S.base + 'assets/logo.png\')"></span></h2>'
      : '<div class="m13-kicker">' + esc([st.siteTitle || '13 MIRRORS', T('kicker')].filter(Boolean).join(' · ')) + '</div>';
    var root = '<div class="m13-root' + (bg.image ? ' m13-root--img' : '') + '" style="' + esc(rs.join(';')) + '">';

    var intro = opt(sc.intro);
    var html = root + '<main class="m13-page">' +
      '<header class="' + hcls + '"' + (hs.length ? ' style="' + esc(hs.join(';')) + '"' : '') + '>' + kicker +
      '<h1>' + esc(sc.title) + (sc.status === 'draft' ? '<span class="m13-draft">' + esc(T('draft') || 'черновик') + '</span>' : '') + '</h1>' +
      (intro ? '<p class="m13-intro">' + txt(intro) + '</p>' : '') + '</header>' +
      '<div class="m13-stage"><section class="m13-grid" aria-label="Карточки месяца">' +
      (sc.cards || []).slice(0, 9).map(thumbHTML).join('') +
      '</section></div></main>' +
      overlayHTML() + internalHTML() + modalHTML() + calModalHTML() + lightboxHTML() + '<div class="m13-toast" id="m13-toast" role="status" aria-live="polite"></div></div>';
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

  function statusOf(c) {
    var f = (c && c.front) || {}, ph = phaseOf(c);
    return (ph && ph.status) || opt(f.status);
  }
  function statusHTML(c, cls) {
    var st = statusOf(c); if (!st) return '';
    var pill = ((c.front || {}).statusStyle === 'pill');
    return '<div class="' + cls + (pill ? ' m13-status-pill' : '') + '">' + (pill ? '<span>' + esc(st) + '</span>' : esc(st)) + '</div>';
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
      backBg: f.backBg || d.backBg || '',
      // Стекло и узор: кромка, узор (готовый или своя картинка), где он лежит, цвет, заметность; помощь тексту
      rim: none(pick('rim', '')), pattern: none(pick('pattern', '')),
      patternImage: f.patternImage || d.patternImage || '', patternPlace: pick('patternPlace', 'corners'),
      patternColor: f.patternColor || d.patternColor || '', patternOpacity: num('patternOpacity', 80, 5, 100),
      textHelp: none(pick('textHelp', '')),
      // Размер текста: название и мелкие надписи
      titleSize: pick('titleSize', 'md'), smallSize: pick('smallSize', 'md'),
      // Кнопки на обороте: вид главной, цвета, остальные кнопки, «живость»
      btnStyle: none(pick('btnStyle', '')), btnColor: f.btnColor || d.btnColor || '', btnColor2: f.btnColor2 || d.btnColor2 || '',
      btnDir: pick('btnDir', 'diag'), btnInk: f.btnInk || d.btnInk || '', btnOther: pick('btnOther', 'outline'),
      btnOtherColor: f.btnOtherColor || d.btnOtherColor || '', btnLive: none(pick('btnLive', '')),
      // Положение и выравнивание текста. У неоткрывающихся карточек (как центральная) — только своё, без общего месячного.
      textPos: isStaticCard(c) ? (f.textPos && f.textPos !== 'inherit' ? f.textPos : '') : pick('textPos', ''),
      textAlign: isStaticCard(c) ? (f.textAlign && f.textAlign !== 'inherit' ? f.textAlign : '') : pick('textAlign', '')
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
  // Возвращает {cls, css} для карточки: классы и inline-стиль.
  function styleOf(c, hasImg) {
    var st = cardStyle(c), cls = [], css = [];
    if (st.font) { ensureFont(st.font); css.push("font-family:'" + st.font + "',Georgia,serif"); }
    if (st.textColor) { cls.push('m13-styled'); css.push('--m13-tc:' + st.textColor); }
    if (st.glass && !hasImg) {
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
    var lay = decoHTML(st, true);
    if (lay) cls.push('m13-deco');
    if (st.rim) cls.push('m13-has-rim');
    if (st.textHelp) {
      // Тень/затемнение под светлым текстом — тёмные, под тёмным — светлые
      var dark = st.textColor && lum(hexRgb(st.textColor)) < 128;
      cls.push('m13-th-' + st.textHelp + (dark ? ' m13-th--light' : ''));
    }
    return { cls: cls.join(' '), css: css.join(';'), st: st, lay: lay };
  }

  // Кнопки оборота: классы и переменные для большой карточки. Пусто — как раньше (по акцентному цвету).
  var BTN_DIR = { h: '90deg', diag: '135deg', v: '180deg' };
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
      if (st.btnLive) cls.push('m13-btn-live-' + st.btnLive);
      if (st.btnOther === 'same') cls.push('m13-btn-same');
    }
    if (st.btnOtherColor && st.btnOther !== 'same') { cls.push('m13-btn-other'); css.push('--m13-bo:' + st.btnOtherColor); }
    return { cls: cls, css: css };
  }

  // Слои поверх карточки: затемнение под текстом, узор, кромка. Добавляются последними,
  // текст карточки стоит над ними (.m13-deco > * — z-index 2).
  function decoHTML(st, front) {
    var h = '';
    if (front && st.textHelp === 'shade') h += '<i class="m13-lay m13-shade" aria-hidden="true"></i>';
    var p = st.pattern, img = '';
    if (p === 'custom') img = st.patternImage ? media(st.patternImage) : '';
    else if (p === 'frost' || p === 'sparks' || p === 'kaleido') img = S.base + 'assets/patterns/' + p + '-' + (st.patternPlace === 'full' ? 'full' : 'corner') + '.webp';
    if (img) {
      var col = st.patternColor || (p === 'frost' ? '#eef6ff' : st.accent || '#ecd3a3');
      var place = st.patternPlace === 'full' || st.patternPlace === 'edge' ? st.patternPlace : 'corners';
      h += '<i class="m13-lay m13-pat m13-pat--' + place + (p === 'custom' ? ' m13-pat--img' : '') + '" aria-hidden="true" style="' +
        esc("--m13-pimg:url('" + img + "');--m13-pcol:" + col + ';--m13-pop:' + (st.patternOpacity / 100)) + '"><i></i><i></i><i></i><i></i></i>';
    }
    if (st.rim) h += '<i class="m13-lay m13-rim m13-rim--' + esc(st.rim) + '" aria-hidden="true"></i>';
    return h;
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
    var sub = opt(f.subtitle), foot = opt(f.foot);
    var ph = phaseOf(c), phCls = '';
    if (ph && ph.label) { foot = ph.label; phCls = ' m13-phase m13-phase--' + ph.key; }
    var text = '<div class="m13-thumb-text">' +
      (f.eyebrow ? '<div class="m13-mini-type">' + esc(f.eyebrow) + '</div>' : '') +
      (f.title ? '<div class="m13-mini-title">' + esc(f.title) + '</div>' : '') +
      (sub ? '<div class="m13-mini-date">' + esc(sub) + '</div>' : '') +
      statusHTML(c, 'm13-mini-status') + '</div>';
    if (isStatic) return '<div class="' + cls + ' m13-thumb--static" style="' + css + '">' + text + sty.lay + '</div>';
    return '<button type="button" class="' + cls + '" style="' + css + '" data-card="' + esc(c.id) + '">' + text +
      '<div class="m13-mini-foot">' + (foot ? '<span' + (phCls ? ' class="' + phCls.trim() + '"' : '') + '>' + esc(foot) + '</span>' : '') +
      '<span class="m13-mini-cta">' + esc(T('open') || 'открыть') + '</span></div>' + sty.lay + '</button>';
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
    front.className = 'm13-face m13-front' + (f.image ? ' m13-front--img' : '') + (sty.cls ? ' ' + sty.cls.replace(/m13-glow-\w+|m13-accent/g, '') : '');
    var big = S.root.querySelector('#m13-bigcard');
    big.classList.toggle('m13-accent', !!sty.st.accent);
    // Оборот: свой цвет; если он тёмный — весь текст и плашки на обороте становятся светлыми
    var bb = sty.st.backBg, dark = bb && lum(hexRgb(bb)) < 128;
    big.classList.toggle('m13-back-dark', !!dark);
    var bl = buttonLook(sty.st, !!dark);
    big.className = big.className.replace(/\s*m13-btn-[\w-]+/g, '');
    bl.cls.forEach(function (k) { big.classList.add(k); });
    big.setAttribute('style', [accentVars(sty.st), bb ? '--m13-back:' + bb : ''].concat(bl.css).filter(Boolean).join(';'));
    front.setAttribute('style', sty.css);
    front.style.backgroundImage = f.image ? "url('" + media(f.image) + "')" : '';
    var stage = S.root.querySelector('.m13-big-stage');
    stage.classList.remove('m13-glow-soft', 'm13-glow-live');
    stage.setAttribute('style', '');
    if (sty.st.glow === 'soft' || sty.st.glow === 'live') { stage.classList.add('m13-glow-' + sty.st.glow); stage.setAttribute('style', glowVars(sty.st)); }
    var sub = opt(f.subtitle);
    front.innerHTML = '<div>' +
      (f.eyebrow ? '<div class="m13-hero-type">' + esc(f.eyebrow) + '</div>' : '') +
      (f.title ? '<div class="m13-hero-title">' + esc(f.title) + '</div>' : '') +
      (sub ? '<div class="m13-hero-date">' + esc(sub) + '</div>' : '') +
      statusHTML(c, 'm13-hero-status') +
      '</div><div class="m13-flip-hint">' + esc(T('flipHint') || 'Нажать — открыть оборот') + '</div>' + sty.lay;
    // Оборот: тот же узор и кромка (без затемнения под текстом — там свои плашки)
    var back = S.root.querySelector('.m13-back'), blay = decoHTML(sty.st, false);
    back.querySelectorAll(':scope > .m13-lay').forEach(function (n) { n.remove(); });
    back.classList.toggle('m13-deco', !!blay); back.classList.toggle('m13-has-rim', !!sty.st.rim);
    if (blay) back.insertAdjacentHTML('beforeend', blay);

    S.acts = [];
    var backc = S.root.querySelector('#m13-backc');
    backc.innerHTML = backHTML(c);
    bindActs(backc);
    backc.querySelectorAll('[data-m13-lb]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation(); var p = b.getAttribute('data-m13-lb').split(':'); openLightbox(+p[0], +p[1]);
      });
    });

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
    var st = statusOf(c), pill = f.statusStyle === 'pill';
    var meta = [opt(f.subtitle), pill ? '' : st].concat(extraMeta || []).filter(Boolean);
    var mh = meta.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') + (pill && st ? '<span class="m13-status-pill"><span>' + esc(st) + '</span></span>' : '');
    return '<div class="m13-head">' + (f.eyebrow ? '<div class="m13-eyebrow">' + esc(f.eyebrow) + '</div>' : '') +
      '<h2>' + esc(f.title) + '</h2>' +
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
  function itemsHTML(c, list, max, tplKey) {
    var items = visibleSorted(list, max || 10);
    if (!items.length) return '';
    return '<div class="m13-items' + (items.length === 1 ? ' m13-items--one' : '') + '">' + items.map(function (it) {
      var date = opt(it.date), text = opt(it.text), dur = opt(it.duration), price = opt(it.price), status = opt(it.status);
      var meta = [dur, status].filter(Boolean).join(' · ');
      var a = it.action || { kind: 'contact' };
      var ctx = { card: (c.front || {}).title, item: it.title, date: date, price: price, tplKey: tplKey };
      var cal = it.calendar && it.calendar.on && calActive(it.calendar) ? it.calendar : null;
      if (cal) return '<div class="m13-item m13-item--cal" role="button" tabindex="0"' + act(a, ctx) + '>' +
        (date ? '<div class="m13-item-date">' + esc(date) + '</div>' : '') +
        '<div class="m13-item-title">' + esc(it.title) + '</div>' +
        (text ? '<div class="m13-item-text">' + txt(text) + '</div>' : '') +
        (meta ? '<div class="m13-item-meta">' + esc(meta) + '</div>' : '') +
        (price ? '<div class="m13-item-price">' + esc(price) + '</div>' : '') +
        '<div class="m13-item-acts"><span class="m13-item-action">' + esc(a.label || 'Написать') + ' →</span>' +
        '<button type="button" class="m13-item-cal"' + act({ kind: 'calendar', cal: cal }, ctx) + '>' + esc(cal.label || T('calendarButton') || 'В календарь') + '</button></div></div>';
      return '<button type="button" class="m13-item"' + act(a, ctx) + '>' +
        (date ? '<div class="m13-item-date">' + esc(date) + '</div>' : '') +
        '<div class="m13-item-title">' + esc(it.title) + '</div>' +
        (text ? '<div class="m13-item-text">' + txt(text) + '</div>' : '') +
        (meta ? '<div class="m13-item-meta">' + esc(meta) + '</div>' : '') +
        (price ? '<div class="m13-item-price">' + esc(price) + '</div>' : '') +
        '<div class="m13-item-action">' + esc(a.label || 'Написать') + ' →</div></button>';
    }).join('') + '</div>';
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

    S.lb = [];
    var h = headHTML(c, kin ? [kin] : []), btnRun = [], runPush = false;
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
          act({ kind: 'internal', target: 'reflection' }) + '>' + esc(x.label || 'Примеры') + '</button>');
        else (x.actions || []).slice(0, 4).forEach(function (a) {
          if (!a || a.visible === false) return;
          if (a.kind === 'calendar' && !calActive(a.cal || {})) return;
          btnRun.push('<button type="button" class="m13-action' + (btnRun.length ? '' : ' m13-action--primary') + '"' +
            act(a, { card: title, action: a.label, price: price, tplKey: 'offer' }) + '>' + esc(a.label || 'Написать') + '</button>');
        });
        return;
      }
      h += flushBtns();
      if (x.kind === 'desc') html = descHTML(String(x.text || '').trim() || (r && r.description) || '');
      else if (x.kind === 'heading') { var t = String(x.text || '').trim(); if (t) html = '<div class="m13-block-title">' + esc(t) + '</div>'; }
      else if (x.kind === 'images') {
        var imgs = (x.images || []).filter(function (m) { return m && m.visible !== false && m.src; });
        if (imgs.length) {
          var g = S.lb.push(imgs.map(function (m) { return media(m.src); })) - 1;
          html = '<div class="m13-gallery">' + imgs.map(function (m, k) {
            return '<button type="button" class="m13-gallery-item" data-m13-lb="' + g + ':' + k + '" aria-label="Открыть картинку крупно">' +
              '<img src="' + esc(media(m.src)) + '" alt="" loading="lazy"></button>'; }).join('') + '</div>';
        }
      }
      else if (x.kind === 'price') {
        var pv = String(x.value || '').trim();
        if (pv) html = '<div class="m13-price-line"><span>' + esc(x.label || title) + '</span><strong>' + esc(pv) + '</strong></div>';
      }
      else if (x.kind === 'day') { var dc = dayCounter(r); if (dc) html = '<div class="m13-day">' + esc(dc) + '</div>'; }
      else if (x.kind === 'routeButton') {
        var url = String(x.url || '').trim() || (r && r.routeUrl) || '';
        if (url) html = '<a class="m13-go" href="' + esc(url) + '" target="_blank" rel="noopener"><span>' +
          esc(x.label || 'Пройти маршрут') + '</span><span aria-hidden="true">→</span></a>';
      }
      else if (x.kind === 'formats') html = formatsHTML(c, x, r);
      else if (x.kind === 'items') html = itemsHTML(c, x.items, x.max, x.tpl || 'container');
      else if (x.kind === 'dates') {
        var ds = String(x.dates || '').trim();
        if (ds) html = '<div class="m13-dates">' + (x.label ? '<div class="m13-dates-label">' + esc(x.label) + '</div>' : '') +
          '<div class="m13-dates-list">' + esc(ds) + '</div>' + (x.note ? '<div class="m13-dates-note">' + txt(x.note) + '</div>' : '') + '</div>';
      }
      else if (x.kind === 'facts') {
        var fl = (x.facts || []).filter(function (q) { return q && q.visible !== false && String(q.text || '').trim(); });
        if (fl.length) html = '<div class="m13-facts">' + fl.map(function (q) { return '<span class="m13-fact">' + esc(String(q.text).trim()) + '</span>'; }).join('') + '</div>';
      }
      else if (x.kind === 'more') {
        var mt = String(x.text || '').trim();
        if (mt) html = '<details class="m13-more"><summary><span class="m13-more-open">' + esc(x.label || 'Подробнее') + ' ↓</span>' +
          '<span class="m13-more-close">' + esc(x.labelClose || 'Свернуть') + ' ↑</span></summary><div class="m13-more-text">' + txt(mt) + '</div></details>';
      }
      else if (x.kind === 'info') { var it = String(x.text || '').trim(); if (it) html = '<div class="m13-info">' + txt(it) + '</div>'; }
      else if (x.kind === 'sandbox') {
        html = '<button type="button" class="m13-soft' + (i === push ? ' m13-push' : '') + '"' + act({ kind: 'internal', target: 'sandbox' }) + '>' +
          esc(x.label || 'Как устроены маршруты 13 MIRRORS') + '</button>';
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
    return '<div class="m13-formats" style="--n:' + Math.min(list.length, 3) + '">' + list.map(function (f) {
      var fm = formatById(f.formatId) || {};
      var name = f.title || fm.title || '';
      var price = (f.price && opt(f.price)) || fm.price || '';
      var note = (f.note && opt(f.note)) || opt(fm.note);
      var closed = f.availability === 'closed';
      if (closed) note = T('formatClosed') || 'набор закрыт';
      var inner = '<div class="m13-format-name">' + esc(name) + '</div>' +
        (price ? '<div class="m13-format-price">' + esc(price) + '</div>' : '') +
        (note ? '<div class="m13-format-note">' + esc(note) + '</div>' : '');
      if (closed) return '<div class="m13-format is-closed" aria-disabled="true">' + inner + '</div>';
      var ctx = { card: (c.front || {}).title, route: rt.title, format: name, price: price, routeUrl: rt.routeUrl, tplKey: 'route' };
      return '<button type="button" class="m13-format"' + act(f.action || { kind: 'contact' }, ctx) + '>' + inner + '</button>';
    }).join('') + '</div>';
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
      '<a class="m13-channel" id="m13-cal-i" download="13mirrors.ics"></a></div>' +
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
    m.classList.add('is-open');
    pushLayer('calendar', function () { m.classList.remove('is-open'); });
  }

  /* ================= КАРТИНКА КРУПНО =================
     Нажатие на картинку из галереи открывает её на весь экран; несколько — листаются пальцем или стрелками. */
  var LB = { open: false, list: [], i: 0 };
  function lightboxHTML() {
    return '<div class="m13-lb" id="m13-lb" role="dialog" aria-modal="true" aria-label="Картинка">' +
      '<img class="m13-lb-img" id="m13-lb-img" alt="">' +
      '<button type="button" class="m13-lb-nav m13-lb-prev" id="m13-lb-prev" aria-label="Предыдущая">‹</button>' +
      '<button type="button" class="m13-lb-nav m13-lb-next" id="m13-lb-next" aria-label="Следующая">›</button>' +
      '<div class="m13-lb-count" id="m13-lb-count"></div>' +
      '<button type="button" class="m13-lb-close" id="m13-lb-x" aria-label="Закрыть">×</button></div>';
  }
  function lbDraw() {
    var q = function (id) { return S.root.querySelector(id); }, n = LB.list.length;
    q('#m13-lb-img').src = LB.list[LB.i];
    q('#m13-lb-count').textContent = n > 1 ? (LB.i + 1) + ' / ' + n : '';
    q('#m13-lb-prev').hidden = q('#m13-lb-next').hidden = n < 2;
  }
  function lbGo(d) {
    var n = LB.list.length; if (n < 2) return;
    LB.i = (LB.i + d + n) % n; lbDraw();
  }
  function openLightbox(g, i) {
    var m = S.root.querySelector('#m13-lb'); if (!m || !S.lb || !S.lb[g]) return;
    LB.list = S.lb[g]; LB.i = i || 0; LB.open = true;
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
    var url = cardUrl(), title = [(S.D.settings || {}).siteTitle || '13 MIRRORS', ctx.card].filter(Boolean).join(' · ');
    if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      navigator.share({ title: title, url: url }).catch(function () {});
      return;
    }
    toast(copyText(url) ? (T('shareCopied') || 'Ссылка на карточку скопирована — её можно отправить в чат.') : url);
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
    var lk = pageLook(which === 'sandbox' ? S.D.sandbox.look : null);
    S.root.innerHTML = '<div class="m13-standalone' + lk.cls + '"' + (lk.css ? ' style="' + esc(lk.css) + '"' : '') + '>' + inner + '</div>' + modalHTML();
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

  // Оформление отдельной страницы (Песочница): фон как у месяца, шрифт, цвета, стеклянные панели.
  // look = {background:{image,imageTall,color,dim,blur}, font, textColor, accent, panelBg, glass, glassBlur}
  function pageLook(lk) {
    if (!lk) return { cls: '', css: '' };
    var bg = lk.background || {}, css = [], cls = '';
    if (bg.color) css.push('--m13-bgc:' + bg.color);
    if (bg.image) {
      cls += ' m13-root m13-root--img';
      css.push("--m13-bgimg:url('" + media(bg.image) + "')", "--m13-bgimg-t:url('" + media(bg.imageTall || bg.image) + "')",
        '--m13-dim:' + (Math.max(0, Math.min(90, +bg.dim || 0)) / 100), '--m13-blur:' + Math.max(0, Math.min(20, +bg.blur || 0)) + 'px');
    } else if (bg.color) cls += ' m13-root';
    var styled = lk.panelBg || lk.textColor || lk.accent || lk.glass || lk.font;
    if (!styled) return { cls: cls, css: css.join(';') };
    cls += ' m13-look';
    var pan = hexRgb(lk.panelBg || '#ffffff'), darkPan = lum(pan) < 128;
    var glass = Math.max(0, Math.min(100, +lk.glass || 0));
    var tx = lk.textColor || (darkPan ? '#efe4d2' : '#232323'), ac = lk.accent || tx;
    // Заголовок стоит прямо на картинке: мягкая тень, тёмная под светлым текстом и светлая под тёмным
    css.push('--lk-tsh:' + (lum(hexRgb(tx)) > 128 ? '0 1px 2px rgba(0,0,0,.75),0 0 18px rgba(0,0,0,.55)' : '0 1px 2px rgba(255,255,255,.8),0 0 18px rgba(255,255,255,.6)'));
    css.push('--lk-tx:' + tx, '--lk-ac:' + ac, '--lk-ac-ink:' + inkFor(ac),
      '--lk-pan:rgba(' + pan.join(',') + ',' + (1 - glass / 100).toFixed(2) + ')',
      '--m13-gb:' + (lk.glassBlur == null || lk.glassBlur === '' ? 8 : Math.max(0, Math.min(20, +lk.glassBlur))) + 'px');
    if (lk.font) { ensureFont(lk.font); css.push("--lk-font:'" + lk.font + "',Georgia,serif"); cls += ' m13-look--font'; }
    return { cls: cls, css: css.join(';') };
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
