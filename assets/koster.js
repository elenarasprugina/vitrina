/* Костёр Самайна — пространство «Узоров» вместо сада (docs/koster-iskry.md; механика — её решения 30.10).
   Подгружается из assets/uzory.js, когда у узора space.scene = 'koster' (панель: «Узоры» → Пространство) или в адресе ?koster=1.
   Ход: листок «Что ты оставишь огню?» → человек пишет → «Отдать огню» — листок летит в огонь и сгорает
   (текст никуда не уходит и нигде не сохраняется) → из огня вылетает искра и раскрывается стеклянной картой →
   на карте человек пишет своё желание → «Отпустить искрой» (карта гаснет искрой и улетает вверх) / «Сохранить себе» (картинка на устройство).
   Раз в день (устройство помнит только дату, без текстов). У огня летают светлячки (бабочек убрали по её слову 31.10; панель: «Кто летает у огня» — светлячки / никого). */
(function () {
  'use strict';
  // 13 дней волны Белого Соединителя Миров — её тексты 31.10 (docs/koster-iskry.md): подпись и вопрос дня — в живом окошке на витрине,
  // искра-пожелание — на стеклянной карте. Она правит в панели («Узоры» → Пространство → «Костёр Самайна» → «13 дней»); пока не сохраняла — берутся эти.
  window.M13_KOSTER_DAYS = [
    { date: '2026-10-31', kin: '66 · Белый Магнитный Соединитель Миров', label: 'Костёр Самайна', ask: 'Что в твоей жизни уже закончилось, а ты всё ещё не можешь отпустить?', wish: 'Пусть получится отпустить то, что уже закончилось, — и заметить, что появляется в освободившемся пространстве.' },
    { date: '2026-11-01', kin: '67 · Синяя Лунная Рука', label: 'Белый Соединитель Миров', ask: 'За что ты продолжаешь держаться, хотя это уже не помогает тебе двигаться дальше?', wish: 'Пусть получится отпустить то, что больше не поддерживает, и найти то, на что действительно можно опереться сейчас.' },
    { date: '2026-11-02', kin: '68 · Жёлтая Электрическая Звезда', label: 'Белый Соединитель Миров', ask: 'Где ты всё ещё говоришь или поступаешь не совсем по-своему?', wish: 'Пусть сегодня найдётся хотя бы один момент, где получится сделать по-своему.' },
    { date: '2026-11-03', kin: '69 · Красная Самосущая Луна', label: 'Белый Соединитель Миров', ask: 'Какое чувство возвращается к тебе снова и снова — и о чём оно может говорить?', wish: 'Пусть сегодня получится не отталкивать это чувство, а немного побыть рядом и услышать его.' },
    { date: '2026-11-04', kin: '70 · Белая Обертонная Собака', label: 'Белый Соединитель Миров', ask: 'На что уходит слишком много твоих сил — хотя тебе хотелось бы тратить их на что-то живое и важное?', wish: 'Пусть часть сил, которые уходили на удержание старого, вернётся к тому, что тебе действительно дорого.' },
    { date: '2026-11-05', kin: '71 · Синяя Ритмическая Обезьяна', label: 'Белый Соединитель Миров', ask: 'Где в твоей жизни стало слишком много правильности, контроля или серьёзности?', wish: 'Пусть сегодня найдётся место для лёгкости, игры и чего-то неожиданного.' },
    { date: '2026-11-06', kin: '72 · Жёлтый Резонансный Человек', label: 'Белый Соединитель Миров', ask: 'Что обычно заглушает твой собственный отклик?', wish: 'Пусть сегодня найдётся немного тишины, в которой можно заметить собственный отклик.' },
    { date: '2026-11-07', kin: '73 · Красный Галактический Небесный Странник', label: 'Белый Соединитель Миров', ask: 'Какое привычное «надо» или «так правильно» тебе уже не подходит?', wish: 'Пусть то новое, что ты уже чувствуешь, найдёт место в обычной жизни и не превратится в очередное «надо».' },
    { date: '2026-11-08', kin: '74 · Белый Солнечный Волшебник', label: 'Белый Соединитель Миров', ask: 'Чего тебе хочется только потому, что страшно остаться без этого?', wish: 'Пусть станет чуть яснее, чего ты действительно хочешь — без спешки и страха.' },
    { date: '2026-11-09', kin: '75 · Синий Планетарный Орёл', label: 'Белый Соединитель Миров', ask: 'Что ты всё ещё думаешь о себе, хотя это уже давно не так?', wish: 'Пусть сегодня получится посмотреть на себя свежим взглядом и заметить то, чего раньше не было видно.' },
    { date: '2026-11-10', kin: '76 · Жёлтый Спектральный Воин', label: 'Белый Соединитель Миров', ask: 'От чего ты всё ещё защищаешься, хотя опасности уже нет?', wish: 'Пусть сегодня получится хотя бы немного ослабить ту защиту, которая когда-то была нужна, а теперь стала тяжёлой.' },
    { date: '2026-11-11', kin: '77 · Красная Кристаллическая Земля', label: 'Белый Соединитель Миров', ask: 'С чем ты всё ещё справляешься в одиночку, хотя можно было бы разделить это с кем-то?', wish: 'Пусть сегодня станет заметнее, с кем и чем тебе не обязательно справляться в одиночку.' },
    { date: '2026-11-12', kin: '78 · Белое Космическое Зеркало', label: 'Белый Соединитель Миров', ask: 'Что в тебе остаётся твоим, даже когда вокруг многое меняется?', wish: 'Пусть среди перемен останется ощущение того, что в тебе по-прежнему твоё.' }
  ];
  window.M13_KOSTER = function (root, U) {
    var IT = U.IT, SP = IT.space || {}, K = SP.koster || {}, T = U.T, esc = U.esc, str = U.str, PANEL = U.PANEL, OKNO = U.OKNO;
    var SNOVA = /[?&]snova=1/.test(location.search);   // проверка: огонь отвечает ещё раз в тот же день
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function $(s) { return root.querySelector(s) || document.querySelector(s); }
    var VID = U.imgUrl(str(K.video, 'assets/koster/ogon-7.mp4')), POSTER = U.imgUrl(str(K.poster, K.video ? '' : 'assets/koster/ogon-7-poster.jpg'));
    // где в кадре видео огонь (доли кадра 540 × 960): сердце пламени и кромка поленьев
    var FIRE = { x: .5, y: .46 }, VW = 540, VH = 960;
    // её замечания 30.10: огонь дальше (меньше на экране, края тают в темноту), искр от огня больше, светлячков больше
    var FAR = Math.max(.4, Math.min(1, (K.far == null || K.far === '' ? 100 : +K.far) / 100));
    var SPARKS = { off: 0, few: 5, mid: 12, many: 24, lots: 40 }[K.sparks || 'mid'];
    if (SPARKS == null) SPARKS = 12;
    var FF_N = Math.max(0, Math.min(40, K.ffN == null || K.ffN === '' ? 12 : +K.ffN));
    // светлячки: размер (панель «Светлячки: размер», 50–250 %); на телефоне чуть крупнее — иначе теряются на огне
    var FF_SZ = Math.max(.5, Math.min(2.5, (K.ffSize == null || K.ffSize === '' ? 100 : +K.ffSize) / 100)) * (Math.min(window.innerWidth, window.innerHeight) < 600 ? 1.25 : 1);

    document.body.className = 'uz-body ks-body' + (OKNO ? ' uz-okno' : '');
    document.title = str((U.SET || {}).siteTitle, '13 MIRRORS') + ' · ' + T('kTitle', 'Костёр');
    var dayText = dayOf();
    /* ---------- 13 тонов волны (её решение 31.10, docs/koster-iskry.md «Огонь по тонам»):
       сила огня растёт к 10-му тону и стихает к 13-му; у каждого тона свой полёт искр;
       ответ огня — искры цвета печати дня (мягкие, не спорят с пламенем) и знак тона (точки и черты) из искр;
       13 угольков — память человека о днях у огня (только на его устройстве: даты, без текстов) ---------- */
    var DAYS = (K.days || window.M13_KOSTER_DAYS || []).filter(function (x) { return x && /^\d{4}-\d\d-\d\d$/.test(x.date); })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var DAY_I = -1; DAYS.forEach(function (x, i) { if (x.date === iso()) DAY_I = i; });
    var KIN = parseInt(dayText.kin, 10) || 0;
    var TONE = +dayText.tone || (KIN > 0 ? (KIN - 1) % 13 + 1 : DAY_I >= 0 ? DAY_I % 13 + 1 : 0);
    var TONE_FX = K.toneFire !== false && TONE ? TONE : 0;   // характер огня по тону (0 — обычный огонь)
    // цвет печати: красный, белый, синий, жёлтый — мягкие, «магические» оттенки
    var SEAL_RGB = [[255, 150, 140], [228, 236, 255], [150, 198, 255], [255, 228, 150]];
    function hexRgb(h) { var m = /^#?([0-9a-f]{6})$/i.exec(str(h).trim()); return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4), 16)] : null; }
    var DCOL = hexRgb(dayText.color) || (KIN > 0 ? SEAL_RGB[(KIN - 1) % 20 % 4] : null) || [255, 214, 150];
    function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (+a).toFixed(3) + ')'; }
    // сила огня по тону: 1 — разжигается … 10 — в полную силу, 11–13 — стихает
    var POW_T = [.45, .55, .65, .72, .85, .85, .8, .95, 1, 1.1, .8, .7, .55];
    var POW = dayText.power ? Math.max(.3, Math.min(1.4, +dayText.power / 100)) : TONE_FX ? POW_T[TONE_FX - 1] : 1;
    if (TONE_FX || dayText.power) SPARKS *= Math.pow(POW, 1.5) * 1.3;
    // её слова 31.10: от огня — прямо на витрину (список «Узоры» с одной карточкой не нужен); пришли с месяца — на тот же месяц
    function backHref() {
      var r = document.referrer, base = '../../';
      try { var u = new URL(r), b = new URL(base, location.href); if (u.origin === location.origin && u.pathname.indexOf(b.pathname) === 0 && u.pathname.indexOf(b.pathname + 'uzory/') !== 0) return u.pathname + u.search; } catch (e) {}
      return base;
    }

    root.innerHTML =
      '<div class="ks-scene" id="ks-scene"><video class="ks-video" id="ks-video" muted playsinline loop autoplay preload="auto"' +
        (POSTER ? ' poster="' + esc(POSTER) + '"' : '') + ' src="' + esc(VID) + '" aria-hidden="true"></video>' +
        '<div class="ks-shade"></div><canvas class="ks-st" id="ks-st"></canvas><canvas class="ks-fx" id="ks-fx"></canvas></div>' +
      (OKNO ? '' :
      '<div class="uz-ui uz-top"><div><a class="uz-eyebrow" href="' + esc(backHref()) + '">' + esc(T('kBack', '← К витрине')) + '</a><h1 class="uz-h1">' + esc(T('kTitle', 'Костёр')) + '</h1></div></div>' +
      (K.sound === 'off' ? '' : '<button class="ks-snd" id="ks-snd" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h3l5-4v14l-5-4H4z"/>' +
        '<path class="ks-snd-on" d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"/><path class="ks-snd-off" d="M16 9.5l5 5M21 9.5l-5 5"/></svg></button>') +
      '<div class="uz-ui uz-bottom ks-bottom" id="ks-bottom">' +
        '<div class="uz-sheet" id="ks-ask"><p class="uz-q">' + esc(T('kAsk', 'Здесь ты можешь написать то, что хочешь отдать огню')) + '</p>' +
          '<div class="ks-paper-sh"><div class="ks-paper" id="ks-paper"><textarea id="ks-text" rows="4" maxlength="400" autocomplete="off" spellcheck="false" placeholder="' + esc(T('kPaperPh', 'Напиши здесь…')) + '"></textarea></div></div>' +
          '<p class="uz-p is-dim">' + esc(T('kNote', 'Никто, кроме огня, это не прочтёт.')) + '</p>' +
          '<div class="uz-row"><button class="uz-btn" id="ks-burn" type="button">' + esc(T('kBurn', 'Отдать огню')) + '</button></div></div>' +
        '<div class="uz-sheet" id="ks-after" hidden><p class="uz-p" id="ks-after-t"></p>' +
          '<button class="uz-link uz-link--dim" id="ks-stay" type="button">' + esc(T('kStay', 'Посидеть у огня')) + '</button></div>' +
      '</div>' +
      '<div class="ks-card-wrap" id="ks-card-wrap" hidden><div class="ks-card" id="ks-card"><div class="uz-dar-glass"></div><i class="ks-rim"></i><i class="ks-rim-run"></i>' +
        '<p class="uz-dar-lead">' + esc(T('kCardLead', 'Огонь отвечает')) + '</p>' +
        (str(dayText.wish, T('kCardText')) ? '<p class="ks-card-t">' + esc(str(dayText.wish, T('kCardText'))) + '</p>' : '') +
        '<textarea class="ks-wish" id="ks-wish" rows="3" maxlength="200" autocomplete="off" spellcheck="false" placeholder="' + esc(T('kWishPh', 'Загадай желание и напиши его здесь')) + '"></textarea>' +
        '<div class="uz-row"><button class="uz-btn" id="ks-go" type="button">' + esc(T('kRelease', 'Отпустить искрой')) + '</button>' +
          '<button class="uz-btn uz-btn--ghost" id="ks-save" type="button">' + esc(T('kSave', 'Сохранить себе')) + '</button></div>' +
        // строка под картой — только если она сама впишет (её слова 31.10: «Твоё желание никуда не уходит…» — лишняя)
        (T('kWishNote', '') ? '<p class="ks-card-note">' + esc(T('kWishNote', '')) + '</p>' : '') + '</div></div>');

    var scene = $('#ks-scene'), video = $('#ks-video'), fx = $('#ks-fx'), g = fx.getContext('2d'), stc = $('#ks-st'), sg = stc.getContext('2d');
    // сила огня по тону: в тихие дни пламя чуть приглушено, в сильные — во весь свет
    if (TONE_FX || dayText.power) video.style.filter = 'brightness(' + (.84 + .16 * Math.min(1.1, POW)).toFixed(3) + ')';
    if (FAR < 1) { video.style.transform = 'translateX(-50%) scale(' + FAR + ')'; scene.classList.add('ks-far'); }
    var W = 0, H = 0, DPR = 1, last = performance.now(), now = 0, paused = false;
    var life = [], parts = [], spark = null, burn = null, flash = null;
    // бабочек больше нет (её слово 31.10): прежние «По часам» и «Всегда бабочки» — тоже светлячки
    var lifeKind = K.life === 'off' ? '' : 'ff';

    function dayNow() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
    function iso() { var q = /[?&]den=(\d{4}-\d\d-\d\d)/.exec(location.search); if (q) return q[1]; var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    // вопрос и пожелание дня («Костёр Самайна» → «13 дней»; проверить другой день — ?den=2026-11-01 в адресе); дня нет в списке — общие надписи
    function dayOf() { var d = iso(); return (K.days || window.M13_KOSTER_DAYS).filter(function (x) { return x && x.date === d; })[0] || {}; }
    var MEM = 'm13uz-koster-' + IT.id;
    function daily() { return !PANEL && !SNOVA && K.daily !== false; }
    function doneToday() { try { return daily() && localStorage.getItem(MEM) === dayNow(); } catch (e) { return false; } }
    /* 13 камней у огня — память (её решение 31.10): камни переднего ряда в кадре поделены на 13 мест слева направо;
       день, когда огонь ответил, — его камень мягко светится цветом печати того дня. Устройство помнит только даты (без текстов). */
    var STONES = 'm13uz-koster-kamni-' + IT.id, STONES_ON = K.stones !== false && DAY_I >= 0, panelLit = {};
    function stoneDates() { try { return JSON.parse(localStorage.getItem(STONES) || '[]') || []; } catch (e) { return []; } }
    var litAt = {};   // номер камня → когда загорелся (для вспышки)
    function lightStone() {
      if (!STONES_ON) return;
      if (PANEL) panelLit[iso()] = 1;
      else { var have = stoneDates(); if (have.indexOf(iso()) < 0) { have.push(iso()); try { localStorage.setItem(STONES, JSON.stringify(have)); } catch (e) {} } }
      litAt[DAY_I] = now; stoneList = null;
    }
    function markToday() { if (!daily()) return; try { localStorage.setItem(MEM, dayNow()); } catch (e) {} }

    /* ---------- где огонь на экране (видео — «обложкой» по центру) ---------- */
    function firePt() {
      var r = video.getBoundingClientRect(), s = Math.max(r.width / VW, r.height / VH), dw = VW * s, dh = VH * s;
      return { x: r.left + (r.width - dw) / 2 + FIRE.x * dw, y: r.top + (r.height - dh) / 2 + FIRE.y * dh, s: s };
    }
    function vidPt(x, y) {
      var r = video.getBoundingClientRect(), s = Math.max(r.width / VW, r.height / VH), dw = VW * s, dh = VH * s;
      return { x: r.left + (r.width - dw) / 2 + x * s, y: r.top + (r.height - dh) / 2 + y * s, s: s };
    }
    // 13 мест на камнях переднего ряда (точки кадра 540 × 960, видео ogon-7): слева направо — дни 1…13
    var STONE_XY = [[62, 790], [96, 800], [131, 806], [166, 808], [201, 808], [236, 808], [271, 806], [306, 804], [341, 800], [376, 790], [411, 782], [446, 786], [481, 790]];
    var stoneList = null, oc = document.createElement('canvas'), ox = oc.getContext('2d');
    function stoneCol(d) { var kin = parseInt(d && d.kin, 10) || 0, c = hexRgb(d && d.color) || (kin > 0 ? SEAL_RGB[(kin - 1) % 20 % 4] : [255, 214, 150]);
      return [Math.round(c[0] * .6 + 255 * .4), Math.round(c[1] * .6 + 176 * .4), Math.round(c[2] * .6 + 100 * .4)]; }   // цвет дня, согретый огнём
    function drawStones() {
      sg.clearRect(0, 0, W, H);
      if (!STONES_ON || (K.video && !/ogon-7/.test(K.video))) return;   // места камней — только для этого видео
      if (!stoneList) { var have = PANEL ? panelLit : {}; if (!PANEL) stoneDates().forEach(function (d) { have[d] = 1; });
        stoneList = []; DAYS.slice(0, 13).forEach(function (d, i) { if (have[d.date]) stoneList.push({ i: i, c: stoneCol(d) }); }); }
      if (!stoneList.length || !video.videoWidth) return;
      // свет на камне — не пятно поверх: берём сам камень из кадра, делаем светлее и теплее (цвет дня), края тают мягко
      var kx = video.videoWidth / VW, ky = video.videoHeight / VH, RX = 44, RY = 24;
      stoneList.forEach(function (st) {
        var q = STONE_XY[st.i], p = vidPt(q[0], q[1]), w = Math.max(2, Math.ceil(2 * RX * p.s)), h = Math.max(2, Math.ceil(2 * RY * p.s)), t0 = litAt[st.i],
          f = t0 == null ? 1 : Math.min(1, (now - t0) / 1.6),
          a = Math.min(1, (.8 + .12 * Math.sin(now * 1.3 + st.i * 1.7) + .06 * Math.sin(now * 3.7 + st.i)) * f + (t0 == null ? 0 : Math.max(0, 1 - (now - t0) / 1.2) * .5));
        if (oc.width !== w || oc.height !== h) { oc.width = w; oc.height = h; }
        ox.setTransform(1, 0, 0, 1, 0, 0); ox.globalCompositeOperation = 'copy'; ox.globalAlpha = 1;
        try { ox.drawImage(video, (q[0] - RX) * kx, (q[1] - RY) * ky, 2 * RX * kx, 2 * RY * ky, 0, 0, w, h); } catch (e) { return; }
        ox.globalCompositeOperation = 'lighter'; ox.drawImage(oc, 0, 0); ox.globalAlpha = .5; ox.drawImage(oc, 0, 0); ox.globalAlpha = 1;   // камень втрое светлее — как от тлеющего угля рядом
        ox.globalCompositeOperation = 'multiply'; ox.fillStyle = rgba(st.c, 1); ox.fillRect(0, 0, w, h);   // в тон дня
        ox.globalCompositeOperation = 'lighter'; ox.fillStyle = rgba(st.c, .1); ox.fillRect(0, 0, w, h);
        ox.globalCompositeOperation = 'destination-in';
        ox.translate(w / 2, h / 2); ox.scale(1, h / w);
        var gr = ox.createRadialGradient(0, 0, 0, 0, 0, w / 2);
        gr.addColorStop(0, 'rgba(0,0,0,' + a.toFixed(3) + ')'); gr.addColorStop(.35, 'rgba(0,0,0,' + (a * .75).toFixed(3) + ')'); gr.addColorStop(.7, 'rgba(0,0,0,' + (a * .25).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ox.fillStyle = gr; ox.fillRect(-w / 2, -w / 2, w, w);
        sg.drawImage(oc, p.x - w / 2, p.y - h / 2, w, h);
      });
    }
    function layout() {
      W = scene.clientWidth; H = scene.clientHeight; DPR = Math.min(window.devicePixelRatio || 1, 2);
      fx.width = Math.round(W * DPR); fx.height = Math.round(H * DPR); g.setTransform(DPR, 0, 0, DPR, 0, 0);
      stc.width = fx.width; stc.height = fx.height; sg.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (!life.length) seedLife();
    }

    /* ---------- светлячки ---------- */
    function seedLife() {
      var n = lifeKind ? FF_N : 0;
      for (var i = 0; i < n; i++) life.push({ x: W * (i % 2 ? .62 + Math.random() * .34 : .04 + Math.random() * .34), y: H * (.1 + Math.random() * .58), a: Math.random() * 6.28,
        v: 7 + Math.random() * 10, ph: Math.random() * 6.28, bl: .3 + Math.random() * .6, sz: .7 + Math.random() * .5 });
    }
    function stepLife(dt) {
      life.forEach(function (b) {
        // держатся по краям, над огнём не летают — там жарко
        var fp = firePt(), dx = b.x - fp.x, away = Math.abs(dx) < Math.min(W * .2, 150 * fp.s) && b.y > H * .12 ? (dx < 0 ? -1 : 1) : 0;
        b.a += (Math.sin(now * .5 + b.ph) * .9 + (Math.random() - .5) * .6) * dt;
        if (away) b.a += (Math.atan2(0, away) - b.a) * Math.min(1, dt * .8);
        if (b.x < 20) b.a = 0; if (b.x > W - 20) b.a = Math.PI; if (b.y < 40) b.a = Math.PI / 2; if (b.y > H * .7) b.a = -Math.PI / 2;
        b.x += Math.cos(b.a) * b.v * dt; b.y += Math.sin(b.a) * b.v * dt;
      });
    }
    function drawLife() {
      if (!life.length) return;
      // ярче на огне: ядрышко светится всегда, ореол дышит (не гаснет до конца), свет складывается с огнём
      g.save(); g.globalCompositeOperation = 'lighter';
      life.forEach(function (b) {
        var w = Math.sin(now * b.bl * 2 + b.ph), on = .3 + .7 * (w > 0 ? w * w : 0), k = b.sz * FF_SZ, r = (9 + 17 * on) * k,
          gr = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
        gr.addColorStop(0, 'rgba(250,255,215,' + (.55 + .45 * on) + ')'); gr.addColorStop(.18, 'rgba(215,255,130,' + (.5 * on + .15) + ')');
        gr.addColorStop(.5, 'rgba(170,235,90,' + (.18 * on) + ')'); gr.addColorStop(1, 'rgba(170,235,90,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, r, 0, 6.283); g.fill();
        g.fillStyle = 'rgba(255,255,235,' + (.7 + .3 * on) + ')'; g.beginPath(); g.arc(b.x, b.y, 1.7 * k, 0, 6.283); g.fill();
      });
      g.restore();
    }

    /* ---------- искорки, пепел, вспышка ---------- */
    function ember(x, y, k, col) {
      parts.push({ x: x, y: y, vx: (Math.random() - .5) * 40 * k, vy: -(40 + Math.random() * 90) * k, l: 0, L: .8 + Math.random() * 1.6, r: .8 + Math.random() * 1.8, ash: false, col: col });
    }
    function ash(x, y) { parts.push({ x: x, y: y, vx: (Math.random() - .5) * 30, vy: -(20 + Math.random() * 50), l: 0, L: 1.6 + Math.random() * 2, r: 1.5 + Math.random() * 3, ash: true, a: Math.random() * 6, va: (Math.random() - .5) * 6 }); }
    // искры от огня: летят вверх всё время, вразнобой
    var sparkAcc = 0;
    // у каждого тона свой полёт искр (TONE_FX): 1 — одной струйкой, 2 — в две стороны, 3 — вспышками, 4 — ровно, 5 — высоко,
    // 6 — толчками, 7 — по спирали, 8 — во все стороны, 9 — огонь пульсирует светом, 10 — крупные, 11 — мелкие и тают, 12 — гранями, 13 — редкие и медленные
    var TM = TONE_FX;
    function fireSparks(dt) {
      if (!SPARKS || reduce) return;
      var rate = SPARKS;
      if (TM === 6) rate *= Math.sin(now * 2.4) > .35 ? 2.6 : .15;
      sparkAcc += dt * rate;
      if (TM === 3 && Math.random() < dt * .7) sparkAcc += 5 + Math.random() * 4;
      if (sparkAcc < 1) return;
      var fp = firePt(), spread = TM === 1 ? .35 : TM === 8 ? 1.5 : TM === 4 ? .8 : 1;
      while (sparkAcc >= 1) {
        sparkAcc -= 1;
        var x = fp.x + (Math.random() - .5) * 230 * fp.s * spread, y = fp.y - (Math.random() * 230 - 40) * fp.s, k = .6 + Math.random() * .9;
        var p = { x: x, y: y, vx: (Math.random() - .5) * 50 * k * (TM === 8 ? 2.2 : TM === 4 ? .4 : 1), vy: -(60 + Math.random() * 140) * k, l: 0, L: 1.2 + Math.random() * 2.6,
          r: .6 + Math.random() * 1.7, ash: false, tw: Math.random() * 6.28 };
        if (TM === 2) p.vx = (x < fp.x ? -1 : 1) * (25 + Math.random() * 45) * k;
        if (TM === 5) { p.vy *= 1.35; p.L *= 1.2; }
        if (TM === 1) p.vy *= 1.1;
        if (TM === 10) p.r *= 1.45;
        if (TM === 11) { p.r *= .6; p.L *= .6; }
        if (TM === 13) { p.vy *= .55; p.L *= 1.7; }
        if (TM === 7) p.sp = (Math.random() < .5 ? -1 : 1) * (50 + Math.random() * 50);
        if (TM === 4) p.st = 1;
        if (TM === 12) p.star = 1;
        if (TM && Math.random() < .2) p.col = DCOL;   // часть искр — цвета печати дня
        parts.push(p);
      }
    }
    // тёплый отсвет вокруг огня: сильнее в сильные дни, в Солнечный (9) — пульсирует
    function drawGlow() {
      if (!TONE_FX && !dayText.power) return;
      var fp = firePt(), pulse = TM === 9 ? .55 + .45 * Math.sin(now * 1.6) : .85 + .15 * Math.sin(now * 3.1) * Math.sin(now * 1.7),
        a = (.05 + .16 * POW) * pulse, r = Math.max(W, H) * (.25 + .2 * POW), gr = g.createRadialGradient(fp.x, fp.y, 0, fp.x, fp.y, r);
      gr.addColorStop(0, 'rgba(255,170,90,' + a.toFixed(3) + ')'); gr.addColorStop(.5, 'rgba(255,120,50,' + (a * .35).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,120,50,0)');
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
    }
    function stepParts(dt) {
      parts = parts.filter(function (p) {
        p.l += dt; if (p.l > p.L) return false;
        p.vx += Math.sin(now * 3 + p.y * .05) * (p.st ? 8 : 30) * dt; p.vy -= (p.ash ? 6 : 14) * dt;
        if (p.sp) p.vx += Math.cos(now * 2.2 + p.tw + p.l * 3) * p.sp * dt * 2;   // спираль (7-й тон)
        p.x += p.vx * dt; p.y += p.vy * dt; if (p.ash) p.a += p.va * dt;
        return true;
      });
    }
    function drawParts() {
      parts.forEach(function (p) {
        var o = 1 - p.l / p.L;
        if (p.ash) { g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = 'rgba(40,34,30,' + (.75 * o) + ')'; g.fillRect(-p.r, -p.r * .4, p.r * 2, p.r * .8); g.restore(); return; }
        if (p.tw != null) o *= .55 + .45 * Math.sin(now * 14 + p.tw);   // искра от огня мерцает
        if (p.col) {   // искра цвета печати — тонкий штрих по ходу полёта (её слова 31.10: никаких пятен), светлая с лёгким отливом
          var vl = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1, ln = Math.min(9, 2 + vl * .035) * (.5 + .5 * o);
          g.strokeStyle = rgba(p.col.map(function (v) { return Math.round(v + (255 - v) * .45); }), o); g.lineWidth = Math.max(.7, p.r * .7); g.lineCap = 'round';
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx / vl * ln, p.y - p.vy / vl * ln); g.stroke();
        } else {
          g.fillStyle = 'rgba(255,' + Math.round(150 + 90 * o) + ',' + Math.round(60 + 80 * o) + ',' + o + ')';
          g.beginPath(); g.arc(p.x, p.y, p.r * (.6 + .4 * o), 0, 6.283); g.fill();
        }
        if (p.star && Math.sin(now * 5 + p.tw * 3) > .7) {   // грань-блик (12-й тон)
          var L2 = p.r * 5 * o; g.strokeStyle = 'rgba(255,248,230,' + (.7 * o).toFixed(3) + ')'; g.lineWidth = .8;
          g.beginPath(); g.moveTo(p.x - L2, p.y); g.lineTo(p.x + L2, p.y); g.moveTo(p.x, p.y - L2); g.lineTo(p.x, p.y + L2); g.stroke();
        }
      });
      if (flash) {
        var f = flash.t / flash.L, r = 30 + f * Math.max(W, H) * .5, a = (1 - f) * .85, gr = g.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, r);
        gr.addColorStop(0, 'rgba(255,246,220,' + a + ')'); gr.addColorStop(.25, 'rgba(255,200,120,' + a * .5 + ')'); gr.addColorStop(1, 'rgba(255,170,90,0)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
    }

    /* ---------- знак тона бенгальским огнём (её решение 31.10): листок сгорел — из огня выскакивает яркая искорка и быстро
       прочерчивает знак тона тонкой светящейся линией (черта — 5, точка — 1; точки сверху, черты под ними), сыплет мелкими искрами;
       знак держится миг и осыпается вниз искрами; одна искра падает на камень этого дня — камень загорается ---------- */
    var sign = null, crackle = [];
    var CORE = DCOL.map(function (v) { return Math.round(v + (255 - v) * .5); });   // линия — светлая, с отливом цвета печати
    function startSign(done) {
      if (K.toneSign === false || !TONE || reduce) { done(); return; }
      var fp = firePt(), k = Math.max(.8, Math.min(1.25, Math.min(W, 700) / 390)) * 1.45, cx = fp.x, cy = Math.max(H * .2, fp.y - 230 * fp.s);
      var bars = Math.floor(TONE / 5), dots = TONE % 5, bw = 116 * k, gap = 24 * k, segs = [], i;
      var hgt = (dots ? 1 : 0) * gap + bars * gap, y0 = cy - hgt / 2 + (dots ? 0 : gap / 2);
      for (i = 0; i < dots; i++) segs.push({ dot: 1, x: cx + (i - (dots - 1) / 2) * 30 * k, y: y0 });
      for (i = 0; i < bars; i++) { var by = y0 + (dots ? gap : 0) + i * gap; segs.push({ x: cx - bw / 2, y: by, x2: cx + bw / 2 }); }
      // путь головы: из огня — к первому элементу, по элементам, между ними — быстрый невидимый перелёт
      var path = [], t = 0, hx = fp.x, hy = fp.y - 40 * fp.s;
      function go(x, y, dur, draw) { path.push({ t0: t, t1: t + dur, ax: hx, ay: hy, bx: x, by: y, draw: draw }); t += dur; hx = x; hy = y; }
      segs.forEach(function (sg2, n) {
        go(sg2.x, sg2.y, n ? .16 : .55, false);
        if (sg2.dot) { path.push({ t0: t, t1: t + .22, ax: hx, ay: hy, bx: hx, by: hy, dot: 1 }); t += .22; }
        else go(sg2.x2, sg2.y, .5, true);
      });
      sign = { t: 0, k: k, path: path, T: t, segs: segs, drawn: [], stars: [], done: done, phase: 0 };
    }
    var SG_HOLD = 1.2, SG_OUT = 1.1;
    function crack(x, y, k, down) {   // искорка бенгальского огня: тонкий штрих, гаснет за доли секунды
      var a = down ? Math.PI / 2 + (Math.random() - .5) * 1.4 : Math.random() * 6.283, v = (down ? 30 : 60) + Math.random() * (down ? 90 : 160);
      crackle.push({ x: x, y: y, vx: Math.cos(a) * v * k, vy: Math.sin(a) * v * k, l: 0, L: down ? .5 + Math.random() * .9 : .12 + Math.random() * .25, g: down ? 260 : 120 });
    }
    function stepSign(dt) {
      if (crackle.length) {
        g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
        crackle = crackle.filter(function (c) {
          c.l += dt; if (c.l > c.L) return false;
          c.vy += c.g * dt; c.x += c.vx * dt; c.y += c.vy * dt;
          var o = 1 - c.l / c.L, vl = Math.sqrt(c.vx * c.vx + c.vy * c.vy) || 1, ln = Math.min(10, 2 + vl * .03);
          g.strokeStyle = rgba(c.l < c.L * .3 ? [255, 250, 235] : CORE, o); g.lineWidth = .9;
          g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(c.x - c.vx / vl * ln, c.y - c.vy / vl * ln); g.stroke();
          return true;
        });
        g.restore();
      }
      if (!sign) return;
      var S = sign; S.t += dt;
      var t = S.t, k = S.k, out = Math.max(0, (t - S.T - SG_HOLD) / SG_OUT), hx = null, hy = null;
      // голова: где сейчас, что уже прочерчено
      S.path.forEach(function (sgm) {
        if (t < sgm.t0) return;
        var u = Math.min(1, (t - sgm.t0) / (sgm.t1 - sgm.t0)), x = sgm.ax + (sgm.bx - sgm.ax) * u, y = sgm.ay + (sgm.by - sgm.ay) * u;
        if (t <= sgm.t1) { hx = x; hy = y; }
        if (sgm.draw) sgm.u = u;
        if (sgm.dot && !sgm.lit && u > .3) { sgm.lit = 1; S.stars.push({ x: sgm.bx, y: sgm.by }); for (var n = 0; n < 10; n++) crack(sgm.bx, sgm.by, k * .8); }
      });
      if (hx != null && Math.random() < .9) { crack(hx, hy, k * .7); crack(hx, hy, k * .7); }
      var fade = 1 - Math.min(1, out * 1.15), fl = .85 + .15 * Math.sin(t * 23) * Math.sin(t * 7);
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      if (fade > 0) {
        // черты: тонкая светлая линия с узким свечением
        S.path.forEach(function (sgm) {
          if (!sgm.draw || !sgm.u) return;
          var x2 = sgm.ax + (sgm.bx - sgm.ax) * sgm.u, wob = out > 0 ? 1 - out : 1;
          g.strokeStyle = rgba(DCOL, .22 * fade * fl); g.lineWidth = 4.5 * k * .6;
          g.beginPath(); g.moveTo(sgm.ax, sgm.ay); g.lineTo(x2, sgm.by); g.stroke();
          g.strokeStyle = rgba(CORE, .95 * fade * fl * wob + .4 * fade); g.lineWidth = 1.6 * k * .6;
          g.beginPath(); g.moveTo(sgm.ax, sgm.ay); g.lineTo(x2, sgm.by); g.stroke();
          if (out > 0 && Math.random() < .7) crack(sgm.ax + Math.random() * (x2 - sgm.ax), sgm.by, k * .7, true);   // осыпается вниз
          else if (!out && Math.random() < .12) crack(sgm.ax + Math.random() * (x2 - sgm.ax), sgm.by, k * .5);   // потрескивает
        });
        // точки: звёздочка из тонких лучей и светлая сердцевинка
        S.stars.forEach(function (st) {
          var R = 6 * k * .8 * (.8 + .2 * Math.sin(t * 17 + st.x));
          g.strokeStyle = rgba(CORE, .9 * fade); g.lineWidth = 1.1;
          g.beginPath(); for (var n = 0; n < 4; n++) { var a = n * Math.PI / 4 + t * .6; g.moveTo(st.x - Math.cos(a) * R, st.y - Math.sin(a) * R); g.lineTo(st.x + Math.cos(a) * R, st.y + Math.sin(a) * R); } g.stroke();
          g.fillStyle = rgba([255, 252, 240], fade); g.beginPath(); g.arc(st.x, st.y, 1.7 * k * .7, 0, 6.283); g.fill();
          if (out > 0 && Math.random() < .5) crack(st.x, st.y, k * .7, true);
        });
      }
      // голова — яркая искорка
      if (hx != null) { g.fillStyle = 'rgba(255,253,245,1)'; g.beginPath(); g.arc(hx, hy, 2.2 * k * .7, 0, 6.283); g.fill(); }
      g.restore();
      if (out > 0 && !S.fell) {   // одна искра падает на камень этого дня
        S.fell = 1;
        var from = S.segs[S.segs.length - 1], fx2 = from.dot ? from.x : (from.x + from.x2) / 2;
        if (STONES_ON && STONE_XY[DAY_I] && !(K.video && !/ogon-7/.test(K.video))) {
          var q = STONE_XY[DAY_I], to = vidPt(q[0], q[1]);
          S.drop = { ax: fx2, ay: from.y, bx: to.x, by: to.y - 4, t: 0, L: 1.3, bend: (to.x - fx2) * .25 };
        }
      }
      if (S.drop) {
        var d = S.drop; d.t += dt;
        var u = Math.min(1, d.t / d.L), e = u * u, x = d.ax + (d.bx - d.ax) * e + Math.sin(u * Math.PI) * d.bend, y = d.ay + (d.by - d.ay) * e;
        if (u < 1) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,250,235,1)'; g.beginPath(); g.arc(x, y, 1.8, 0, 6.283); g.fill(); g.restore(); if (Math.random() < .8) crack(x, y, .5, true); }
        else if (!d.hit) { d.hit = 1; lightStone(); for (var n2 = 0; n2 < 14; n2++) crack(d.bx, d.by, .7); }
      }
      var ready = out >= 1 && (!S.drop || S.drop.hit);
      if (ready && S.done) { var dn = S.done; S.done = null; dn(); }
      if (ready) sign = null;
    }

    /* ---------- искра: летит по дуге от a к b, за ней — хвост ---------- */
    function flySpark(a, b, dur, bend, done) {
      spark = { a: a, b: b, t: 0, L: dur, bend: bend, tail: [], done: done };
    }
    function stepSpark(dt) {
      if (!spark) return;
      var s = spark; s.t += dt;
      var u = Math.min(1, s.t / s.L), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      var x = s.a.x + (s.b.x - s.a.x) * e + Math.sin(e * Math.PI) * s.bend + Math.sin(s.t * 9) * 4 * (1 - u);
      var y = s.a.y + (s.b.y - s.a.y) * e;
      s.x = x; s.y = y; s.tail.push({ x: x, y: y }); if (s.tail.length > 26) s.tail.shift();
      if (Math.random() < .5) ember(x, y, .4);
      if (u >= 1) { spark = null; if (s.done) s.done(x, y); }
    }
    function drawSpark() {
      if (!spark || spark.x == null) return;
      var s = spark, n = s.tail.length;
      for (var i = 1; i < n; i++) {
        g.strokeStyle = 'rgba(255,214,150,' + (i / n * .7) + ')'; g.lineWidth = 1 + i / n * 3; g.lineCap = 'round';
        g.beginPath(); g.moveTo(s.tail[i - 1].x, s.tail[i - 1].y); g.lineTo(s.tail[i].x, s.tail[i].y); g.stroke();
      }
      var gr = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, 26);
      gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(.2, 'rgba(255,220,150,.8)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(s.x, s.y, 26, 0, 6.283); g.fill();
    }

    /* ---------- листок сгорает: края темнеют, кромка тлеет, сгоревшее исчезает, летят искры и пепел ---------- */
    function wrapText(c, text, maxW) {
      var out = [];
      String(text).split(/\n/).forEach(function (para) {
        var words = para.split(/\s+/), ln = '';
        words.forEach(function (w) { var t2 = ln ? ln + ' ' + w : w; if (c.measureText(t2).width > maxW && ln) { out.push(ln); ln = w; } else ln = t2; });
        out.push(ln);
      });
      return out;
    }
    // неровный край листка (её слова 30.10: «не такой прямой, более живой») — один и тот же у листка в окошке и у того, что горит
    var DECK = (function () {
      var out = [], sides = [14, 6, 14, 6], j = function () { return Math.random() * Math.random() * 4.5; };
      sides.forEach(function (n, side) { for (var i = 0; i < n; i++) out.push({ s: side, t: i / n + (i ? (Math.random() - .5) * .4 / n : 0), j: side % 2 ? j() * .8 : j() }); });
      return out;
    })();
    function deckPt(d, w, h) {
      return d.s === 0 ? [d.t * w, d.j] : d.s === 1 ? [w - d.j, d.t * h] : d.s === 2 ? [w - d.t * w, h - d.j] : [d.j, h - d.t * h];
    }
    function deckClip() {
      return 'polygon(' + DECK.map(function (d) {
        var p = d.t * 100;
        return d.s === 0 ? p + '% ' + d.j + 'px' : d.s === 1 ? 'calc(100% - ' + d.j + 'px) ' + p + '%' : d.s === 2 ? (100 - p) + '% calc(100% - ' + d.j + 'px)' : d.j + 'px ' + (100 - p) + '%';
      }).join(',') + ')';
    }
    function paperCanvas(w, h, text) {
      var cv = document.createElement('canvas'), c = cv.getContext('2d'), k = 1.5;
      cv.width = Math.round(w * k); cv.height = Math.round(h * k); c.scale(k, k);
      c.beginPath(); DECK.forEach(function (d, i) { var p = deckPt(d, w, h); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); c.clip();
      var gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#f6ead2'); gr.addColorStop(1, '#e8d6b4');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(150,110,70,.35)'; c.lineWidth = 2.5; c.stroke();   // край чуть темнее, как у настоящей бумаги
      c.strokeStyle = 'rgba(120,90,60,.16)'; c.lineWidth = 1;
      for (var y = 36; y < h - 8; y += 26) { c.beginPath(); c.moveTo(14, y + .5); c.lineTo(w - 14, y + .5); c.stroke(); }
      c.fillStyle = '#3b2a1e'; c.font = '20px "Marck Script", cursive'; c.textBaseline = 'alphabetic';
      wrapText(c, text, w - 32).slice(0, Math.floor((h - 20) / 26)).forEach(function (l, i) { c.fillText(l, 16, 32 + i * 26); });
      return cv;
    }
    function noiseField(w, h) {
      // гладкий шум из нескольких слоёв: где кромка огня пройдёт раньше
      var f = new Float32Array(w * h), oct = [[6, .55], [14, .3], [34, .15]], x, y;
      oct.forEach(function (o) {
        var gw = o[0] + 2, gh = Math.ceil(o[0] * h / w) + 2, gv = [], i, j;
        for (i = 0; i < gw * gh; i++) gv.push(Math.random());
        for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
          var gx = x / w * o[0], gy = y / w * o[0], i0 = Math.floor(gx), j0 = Math.floor(gy), fx2 = gx - i0, fy2 = gy - j0;
          fx2 = fx2 * fx2 * (3 - 2 * fx2); fy2 = fy2 * fy2 * (3 - 2 * fy2);
          var v = gv[j0 * gw + i0] * (1 - fx2) * (1 - fy2) + gv[j0 * gw + i0 + 1] * fx2 * (1 - fy2) + gv[(j0 + 1) * gw + i0] * (1 - fx2) * fy2 + gv[(j0 + 1) * gw + i0 + 1] * fx2 * fy2;
          f[y * w + x] += v * o[1];
        }
      });
      return f;
    }
    function startBurn(rect, text) {
      var cv = paperCanvas(rect.width, rect.height, text), w = cv.width, h = cv.height, c = cv.getContext('2d');
      var img = c.getImageData(0, 0, w, h), orig = new Uint8ClampedArray(img.data), nf = noiseField(w, h), T0 = new Float32Array(w * h), i, x, y;
      // огонь снизу и с одного угла: нижний край занимается первым
      var cxr = .3 + Math.random() * .4;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        i = y * w + x; var dx = x / w - cxr, dy = 1 - y / h;
        T0[i] = .55 * Math.sqrt(dx * dx * .6 + dy * dy) + .45 * nf[i];
      }
      // листок рисуется на отдельном холсте во весь экран — ровный, обычной бумажкой (её слова 31.10: никакой «гармошки»)
      var ov = document.createElement('canvas');
      ov.className = 'ks-burn'; ov.width = Math.round(W * DPR); ov.height = Math.round(H * DPR);
      document.body.appendChild(ov);
      var fp = firePt(), tx = fp.x - rect.left - rect.width / 2, ty = Math.max(H * .26, fp.y - 120 * fp.s) - rect.top - rect.height / 2;
      burn = { cv: cv, c: c, img: img, orig: orig, T0: T0, w: w, h: h, t: 0, fly: reduce ? .01 : 1.5, L: reduce ? 1.2 : 3.4, tx: tx, ty: ty, rect: rect,
        sc: .45 + .3 * FAR, rot: (Math.random() - .5) * 24, ph: Math.random() * 6.28, sway: (Math.random() < .5 ? -1 : 1) * (18 + Math.random() * 16),
        ov: ov, o: ov.getContext('2d'), K: 1 };
    }
    // где на экране точка листка (xx, yy в пикселях картинки листка)
    function burnPt(b, xx, yy) {
      var lx = (xx / b.w - .5) * b.rect.width * b.K, ly = (yy / b.h - .5) * b.rect.height, cs = Math.cos(b.R), sn = Math.sin(b.R);
      return { x: b.X + (lx * cs - ly * sn) * b.S, y: b.Y + (lx * sn + ly * cs) * b.S };
    }
    function stepBurn(dt) {
      if (!burn) return;
      var b = burn; b.t += dt;
      var u = Math.min(1, b.t / b.fly), e = 1 - Math.pow(1 - u, 3), p = (b.t - b.fly) / b.L, pp = Math.max(0, p), mid = Math.sin(Math.PI * u);
      // полёт: не по линейке — покачивается, как лист на тёплом воздухе
      b.X = b.rect.left + b.rect.width / 2 + b.tx * e + Math.sin(b.t * 2.3 + b.ph) * b.sway * mid + Math.sin(b.t * 4.1) * 3 * pp;
      b.Y = b.rect.top + b.rect.height / 2 + b.ty * e - pp * 46 - mid * 18;
      b.R = (-.6 + (b.rot + .6) * e + Math.sin(b.t * 1.9 + b.ph) * (9 * mid + 6 * pp)) * Math.PI / 180;
      b.S = 1 - (1 - b.sc) * e - .12 * pp;
      if (p > 0) {
        var P = p * 1.25 - .08, d = b.img.data, o = b.orig, T0 = b.T0, n = b.w * b.h, i, j, q;
        for (i = 0; i < n; i++) {
          q = P - T0[i]; j = i * 4;
          if (q < -.07 || o[j + 3] === 0) continue;
          if (q < 0) { var s = 1 + q / .07; d[j] = o[j] * (1 - .55 * s); d[j + 1] = o[j + 1] * (1 - .7 * s); d[j + 2] = o[j + 2] * (1 - .85 * s); d[j + 3] = o[j + 3]; }   // темнеет, буреет
          else if (q < .025) { d[j] = 255; d[j + 1] = 150 + 90 * (1 - q / .025); d[j + 2] = 40 + 60 * (1 - q / .025); d[j + 3] = o[j + 3]; }   // тлеющая кромка
          else if (q < .06) { d[j] = 34; d[j + 1] = 24; d[j + 2] = 18; d[j + 3] = o[j + 3] * (1 - (q - .025) / .035); }   // уголь
          else d[j + 3] = 0;
        }
        b.c.putImageData(b.img, 0, 0);
      }
      // ровный листок: только чуть поворачивается в тёплом воздухе (сужается по ширине), свет и тень — одной плавной заливкой
      var rw = b.rect.width, rh = b.rect.height, tilt = (.12 + .25 * mid + .2 * Math.min(1, pp)) * Math.sin(b.t * 1.6 + b.ph);
      b.K = Math.cos(tilt);
      var O = b.o;
      O.setTransform(1, 0, 0, 1, 0, 0); O.clearRect(0, 0, b.ov.width, b.ov.height);
      O.setTransform(DPR, 0, 0, DPR, 0, 0); O.translate(b.X, b.Y); O.rotate(b.R); O.scale(b.S * b.K, b.S);
      O.drawImage(b.cv, -rw / 2, -rh / 2, rw, rh);
      O.globalCompositeOperation = 'source-atop';
      var gr = O.createLinearGradient(-rw / 2, 0, rw / 2, 0), sh = Math.min(.22, Math.abs(Math.sin(tilt)) * .9);
      gr.addColorStop(0, tilt > 0 ? 'rgba(40,20,10,' + sh.toFixed(3) + ')' : 'rgba(255,240,215,' + (sh * .6).toFixed(3) + ')');
      gr.addColorStop(1, tilt > 0 ? 'rgba(255,240,215,' + (sh * .6).toFixed(3) + ')' : 'rgba(40,20,10,' + sh.toFixed(3) + ')');
      O.fillStyle = gr; O.fillRect(-rw / 2 - 2, -rh / 2 - 2, rw + 4, rh + 4);
      O.globalCompositeOperation = 'source-over';
      if (p <= 0) return;
      // искры и пепел с кромки
      var tries = 40;
      while (tries--) {
        var xx = Math.floor(Math.random() * b.w), yy = Math.floor(Math.random() * b.h), qq = (p * 1.25 - .08) - b.T0[yy * b.w + xx];
        if (qq > 0 && qq < .03 && b.orig[(yy * b.w + xx) * 4 + 3]) { var sp = burnPt(b, xx, yy); if (Math.random() < .7) ember(sp.x, sp.y, .8); else ash(sp.x, sp.y); }
      }
      if (p >= 1) { b.ov.remove(); burn = null; if (b.done) b.done(); }
    }

    /* ---------- кадр ---------- */
    function frame(ts) {
      if (paused) return;
      var dt = Math.min(.05, (ts - last) / 1000); last = ts; now += dt;
      if (W !== scene.clientWidth || H !== scene.clientHeight) layout();
      g.clearRect(0, 0, W, H);
      if (!reduce) stepLife(dt);
      fireSparks(dt); stepParts(dt); stepSpark(dt); stepBurn(dt);
      if (flash) { flash.t += dt; if (flash.t > flash.L) flash = null; }
      drawStones(); drawGlow(); drawLife(); drawParts(); stepSign(dt); drawSpark();
      requestAnimationFrame(frame);
    }
    layout();
    requestAnimationFrame(function (ts) { last = ts; frame(ts); });
    window.addEventListener('resize', layout);
    function playVideo() { var pr = video.play(); if (pr && pr.catch) pr.catch(function () {}); }
    playVideo();
    // телефон в режиме энергосбережения не запускает видео сам — запустим от первого касания
    document.addEventListener('pointerdown', playVideo, { once: true });
    if (OKNO) {
      window.addEventListener('message', function (e) {
        var m = e.data && e.data.m13okno; if (!m) return;
        if (m === 'pause') { paused = true; video.pause(); }
        else if (paused) { paused = false; playVideo(); requestAnimationFrame(function (ts) { last = ts; frame(ts); }); }
      });
      return;
    }

    /* ---------- звук костра (её просьба 31.10): треск в стерео — щелчки слева и справа, в наушниках огонь вокруг ----------
       Звук не файл, а «живой»: собирается в браузере каждый раз заново (гул, шипение, треск и редкие хлопки поленьев) — ничего не скачивается.
       Своя запись (панель: «Костёр Самайна» → «Звук: своя запись») — играет по кругу вместо него.
       Браузер даёт включить звук только после касания: звук начинается с первого касания экрана. Выключил — устройство помнит. */
    sound();
    function sound() {
      var btn = $('#ks-snd'); if (!btn) return;
      var KEY = 'm13-koster-snd', VOL = Math.max(0, Math.min(1, (K.vol == null || K.vol === '' ? 70 : +K.vol) / 100));
      var on = true, ac = null, out = null, timer = 0, el = null, FILE = str(K.soundFile) ? U.imgUrl(K.soundFile) : '';
      try { on = localStorage.getItem(KEY) !== 'off'; } catch (e) {}
      function mark() {
        btn.classList.toggle('is-off', !on);
        btn.setAttribute('aria-label', on ? T('kSndOff', 'Выключить звук костра') : T('kSndOn', 'Включить звук костра'));
        btn.title = btn.getAttribute('aria-label');
      }
      mark();
      function start() {
        if (FILE) {
          if (!el) { el = new Audio(FILE); el.loop = true; el.volume = VOL; }
          var pr = el.play(); if (pr && pr.then) pr.then(unlocked, function () {}); else unlocked();
          return;
        }
        var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        // айфон с выключенным звонком глушит такой звук — просим играть как музыку
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
        if (!ac) build(new AC());
        if (ac.resume) { var rs = ac.resume(); if (rs && rs.then) rs.then(function () { if (ac.state === 'running') unlocked(); }, function () {}); }
        if (ac.state === 'running') unlocked();
        // её слова 31.10 «слышен с опозданием»: громкость набирается быстро (~0,3 с), первый треск — сразу
        out.gain.cancelScheduledValues(ac.currentTime); out.gain.setTargetAtTime(VOL, ac.currentTime, .1);
        if (!timer) { next = ac.currentTime + .02; tick(); timer = setInterval(tick, 60); }
      }
      function stop() {
        if (el) el.pause();
        if (!ac) return;
        out.gain.setTargetAtTime(0, ac.currentTime, .15);
        clearInterval(timer); timer = 0;
        setTimeout(function () { if (!timer && ac.suspend) ac.suspend(); }, 700);
      }
      var noise, roarG, hissG, roarF, until = 0, next = 0;
      function build(c) {
        ac = c; out = ac.createGain(); out.gain.value = 0; out.connect(ac.destination);
        // шум на 4 с — левый и правый разные, поэтому гул звучит широко, «вокруг»
        var n = ac.sampleRate * 4, i, ch, d, b = 0;
        noise = ac.createBuffer(2, n, ac.sampleRate);
        for (ch = 0; ch < 2; ch++) { d = noise.getChannelData(ch); for (i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
        function loop(off) { var s = ac.createBufferSource(); s.buffer = noise; s.loop = true; s.start(0, off); return s; }
        // гул пламени — низкий, медленно дышит
        roarF = ac.createBiquadFilter(); roarF.type = 'lowpass'; roarF.frequency.value = 170; roarF.Q.value = .5;
        roarG = ac.createGain(); roarG.gain.value = .5; loop(0).connect(roarF); roarF.connect(roarG); roarG.connect(out);
        // шипение — тихое, верхнее
        var hf = ac.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 3200; hf.Q.value = .5;
        hissG = ac.createGain(); hissG.gain.value = .025; loop(1.7).connect(hf); hf.connect(hissG); hissG.connect(out);
        next = ac.currentTime + .2;
      }
      // один щелчок: короткий всплеск шума, своя высота, своё место слева-справа
      function crack(t, pan, big) {
        var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), len = big ? .03 + Math.random() * .05 : .004 + Math.random() * .018;
        s.buffer = noise;
        f.type = big ? 'bandpass' : 'highpass'; f.frequency.value = big ? 300 + Math.random() * 700 : 1200 + Math.random() * 4000; f.Q.value = big ? 1.2 : .7;
        var amp = big ? .5 + Math.random() * .4 : .08 + Math.pow(Math.random(), 2) * .55;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + .001); g.gain.exponentialRampToValueAtTime(.0005, t + len);
        s.connect(f); f.connect(g);
        if (ac.createStereoPanner) { var p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(out); } else g.connect(out);
        s.start(t, Math.random() * 3.5, len + .02);
      }
      function tick() {
        var t = ac.currentTime, ahead = t + .25;
        // гул и шипение плавно гуляют
        if (t > until) { until = t + .3 + Math.random() * .6;
          roarG.gain.setTargetAtTime(.35 + Math.random() * .3, t, .4); roarF.frequency.setTargetAtTime(130 + Math.random() * 90, t, .5);
          hissG.gain.setTargetAtTime(.012 + Math.random() * .03, t, .3); }
        if (next < t) next = t;
        while (next < ahead) {
          var pan = (Math.random() * 2 - 1) * .9, r = Math.random();
          if (r < .06) crack(next, pan, true);                       // хлопок полена
          else if (r < .3) {                                          // россыпь щелчков в одном месте
            var k = 2 + Math.floor(Math.random() * 5), tt = next;
            while (k--) { crack(tt, Math.max(-1, Math.min(1, pan + (Math.random() - .5) * .2)), false); tt += .008 + Math.random() * .05; }
          } else crack(next, pan, false);
          next += -Math.log(1 - Math.random()) / 7;                   // в среднем ~7 раз в секунду, вразнобой
        }
      }
      // первое касание экрана — включаем (если не выключали); касание самой кнопки — не считается.
      // Айфон часто не пускает звук по первому «нажал» — ловим и «отпустил», и клик, и клавишу, пока звук правда не заиграет
      var GEST = ['pointerdown', 'touchend', 'click', 'keydown'];
      function first(e) {
        if (e.target && btn.contains(e.target)) return;
        if (!on) { unlocked(); return; }
        start();
      }
      function unlocked() { GEST.forEach(function (g) { document.removeEventListener(g, first, true); }); }
      GEST.forEach(function (g) { document.addEventListener(g, first, true); });
      btn.onclick = function () {
        on = !on; mark();
        try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {}
        unlocked();
        if (on) start(); else stop();
      };
      // ушли со страницы — тишина, вернулись — снова огонь
      document.addEventListener('visibilitychange', function () { if (!on || (!ac && !el)) return; if (document.hidden) stop(); else start(); });
    }

    /* ---------- ход: листок → огонь → искра → карта → желание ---------- */
    var ask = $('#ks-ask'), after = $('#ks-after'), afterT = $('#ks-after-t'), text = $('#ks-text'), paper = $('#ks-paper');
    paper.style.clipPath = deckClip();
    var wrap = $('#ks-card-wrap'), card = $('#ks-card'), wish = $('#ks-wish');
    function show(n) { [ask, after].forEach(function (x) { x.hidden = x !== n; }); }
    function showAfter(t) { afterT.textContent = t; show(after); }
    if (doneToday()) showAfter(T('kToday', 'Огонь уже ответил тебе сегодня. Возвращайся завтра — за новой искрой.'));
    $('#ks-stay').onclick = function () { after.hidden = true; };

    $('#ks-burn').onclick = function () {
      var r = paper.getBoundingClientRect(), t = text.value;
      text.value = '';   // текст не хранится нигде: остаётся только в картинке листка, которая сгорает
      text.blur();
      var go = function () {
        startBurn(r, t);
        ask.hidden = true;
        burn.done = function () { setTimeout(function () { startSign(sparkOut); }, 300); };
      };
      if (document.fonts && document.fonts.load) document.fonts.load('20px "Marck Script"').then(go, go); else go();
    };
    function sparkOut() {
      var fp = firePt(), to = { x: W / 2, y: H * (W < 700 ? .4 : .42) };
      flySpark({ x: fp.x + (Math.random() - .5) * 40 * fp.s, y: fp.y }, to, reduce ? .3 : 2.2, (Math.random() < .5 ? -1 : 1) * W * .12, function (x, y) {
        flash = { x: x, y: y, t: 0, L: 1.1 };
        for (var i = 0; i < 26; i++) ember(x, y, 1.4, TONE && i % 2 ? DCOL : null);
        markToday(); if (!TONE || K.toneSign === false || reduce) lightStone();
        wrap.hidden = false; card.classList.remove('is-gone'); card.style.transformOrigin = '';
        setTimeout(function () { try { wish.focus({ preventScroll: true }); } catch (e) {} }, 1300);
      });
    }
    $('#ks-go').onclick = function () {
      var r = card.getBoundingClientRect();
      wish.blur(); card.classList.add('is-gone');
      setTimeout(function () {
        wrap.hidden = true; wish.value = '';
        var x = r.left + r.width / 2, y = r.top + r.height / 2;
        flash = { x: x, y: y, t: 0, L: .7 };
        flySpark({ x: x, y: y }, { x: x + (Math.random() - .5) * W * .3, y: -40 }, reduce ? .3 : 2.4, (Math.random() < .5 ? -1 : 1) * W * .1, function () {
          showAfter(T('kAfter', 'Искра унесла твоё желание. Возвращайся к огню завтра.'));
        });
      }, reduce ? 50 : 900);
    };

    /* ---------- «Сохранить себе»: карта на огне, картинкой на устройство ---------- */
    $('#ks-save').onclick = function () {
      var go = function () { try { saveCard(); } catch (e) { console.error(e); } };
      var fl = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('40px "Marck Script"'), document.fonts.load('italic 500 40px "Cormorant Garamond"')]).catch(function () {}) : Promise.resolve();
      fl.then(go);
    };
    function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    function saveCard() {
      var Wc = 1080, Hc = 1350, cv = document.createElement('canvas'), c = cv.getContext('2d'), HEAD = '"Cormorant Garamond", Georgia, serif';
      cv.width = Wc; cv.height = Hc;
      c.fillStyle = '#0b0705'; c.fillRect(0, 0, Wc, Hc);
      try { var s = Math.max(Wc / VW, Hc / VH); c.drawImage(video, (Wc - VW * s) / 2, (Hc - VH * s) / 2, VW * s, VH * s); } catch (e) {}
      var sh = c.createLinearGradient(0, 0, 0, Hc); sh.addColorStop(0, 'rgba(8,5,4,.55)'); sh.addColorStop(.5, 'rgba(8,5,4,.35)'); sh.addColorStop(1, 'rgba(8,5,4,.8)');
      c.fillStyle = sh; c.fillRect(0, 0, Wc, Hc);
      var lead = T('kCardLead', 'Огонь отвечает'), t = str(dayText.wish, T('kCardText')), w = str(wish.value).trim(), X = 140, CW = Wc - 280, mw = CW - 120;
      var B = [{ f: '500 26px -apple-system, "Segoe UI", Roboto, sans-serif', c: 'rgba(233,184,114,.95)', t: lead.toUpperCase(), lh: 34, gap: 26 }];
      if (t) B.push({ f: 'italic 500 46px ' + HEAD, c: '#fff4e2', t: t, lh: 54, gap: 34 });
      if (w) B.push({ f: '52px "Marck Script", cursive', c: '#ffe2b0', t: w, lh: 64, gap: 0 });
      var th = 0; B.forEach(function (x) { c.font = x.f; x.L = wrapText(c, x.t, mw); th += x.L.length * x.lh + x.gap; });
      var CH = Math.max(420, th + 150), Y = (Hc - CH) / 2;
      c.save(); rrect(c, X, Y, CW, CH, 44); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 50; c.shadowOffsetY = 18;
      var gl = c.createLinearGradient(X, Y, X + CW, Y + CH); gl.addColorStop(0, 'rgba(255,240,220,.22)'); gl.addColorStop(.5, 'rgba(255,230,200,.08)'); gl.addColorStop(1, 'rgba(255,190,140,.16)');
      c.fillStyle = gl; c.fill(); c.restore();
      rrect(c, X, Y, CW, CH, 44); c.lineWidth = 2; c.strokeStyle = 'rgba(255,226,190,.6)'; c.stroke();
      var y = Y + (CH - th) / 2; c.textAlign = 'center'; c.textBaseline = 'top';
      B.forEach(function (x) { c.font = x.f; c.fillStyle = x.c; x.L.forEach(function (l) { c.fillText(l, Wc / 2, y); y += x.lh; }); y += x.gap; });
      c.font = '500 24px -apple-system, "Segoe UI", Roboto, sans-serif'; c.fillStyle = 'rgba(255,240,220,.6)'; c.fillText(str((U.SET || {}).siteTitle, '13 MIRRORS'), Wc / 2, Hc - 70);
      var name = '13mirrors-koster.png';
      cv.toBlob(function (blob) {
        try {
          var f = new File([blob], name, { type: 'image/png' });
          if (window.matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f] }).catch(function () {}); return; }
        } catch (e) {}
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      }, 'image/png');
    }
  };
})();
