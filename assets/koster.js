/* Костёр Самайна — пространство «Узоров» вместо сада (docs/koster-iskry.md; механика — её решения 30.10).
   Подгружается из assets/uzory.js, когда у узора space.scene = 'koster' (панель: «Узоры» → Пространство) или в адресе ?koster=1.
   Ход: листок «Что ты оставишь огню?» → человек пишет → «Отдать огню» — листок летит в огонь и сгорает
   (текст никуда не уходит и нигде не сохраняется) → из огня вылетает искра и раскрывается стеклянной картой →
   на карте человек пишет своё желание → «Отпустить искрой» (карта гаснет искрой и улетает вверх) / «Сохранить себе» (картинка на устройство).
   Раз в день (устройство помнит только дату, без текстов). Днём — пара бабочек, ночью — светлячки (по часам человека). */
(function () {
  'use strict';
  // 13 дней волны Белого Соединителя Миров — её тексты 31.10 (docs/koster-iskry.md): подпись и вопрос дня — в живом окошке на витрине,
  // искра-пожелание — на стеклянной карте. Она правит в панели («Узоры» → Пространство → «Костёр Самайна» → «13 дней»); пока не сохраняла — берутся эти.
  window.M13_KOSTER_DAYS = [
    { date: '2026-10-31', kin: '66 · Белый Магнитный Соединитель Миров', label: 'Костёр Самайна', ask: 'Что в твоей жизни уже закончилось, а ты всё ещё не можешь отпустить?', wish: 'Пусть получится отпустить то, что уже закончилось, — и заметить, что появляется на освободившемся месте.' },
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

    document.body.className = 'uz-body ks-body' + (OKNO ? ' uz-okno' : '');
    document.title = str((U.SET || {}).siteTitle, '13 MIRRORS') + ' · ' + T('kTitle', 'Костёр');
    var dayText = dayOf();

    root.innerHTML =
      '<div class="ks-scene" id="ks-scene"><video class="ks-video" id="ks-video" muted playsinline loop autoplay preload="auto"' +
        (POSTER ? ' poster="' + esc(POSTER) + '"' : '') + ' src="' + esc(VID) + '" aria-hidden="true"></video>' +
        '<div class="ks-shade"></div><canvas class="ks-fx" id="ks-fx"></canvas></div>' +
      // в живом окошке на витрине — только подпись дня поверх огня; вопрос дня окошко передаёт витрине — он на открытой карточке (её решение 31.10);
      // у самого костра вопроса нет — только листок
      (OKNO ? (dayText.label ? '<div class="ks-okq"><p class="ks-okq-l">' + esc(dayText.label) + '</p></div>' : '') :
      '<div class="uz-ui uz-top"><div><a class="uz-eyebrow" href="../">' + esc(T('eyebrow', 'Узоры')) + '</a><h1 class="uz-h1">' + esc(T('kTitle', 'Костёр')) + '</h1></div></div>' +
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
        '<p class="ks-card-note">' + esc(T('kWishNote', 'Твоё желание никуда не уходит — оно только у тебя.')) + '</p></div></div>');

    var scene = $('#ks-scene'), video = $('#ks-video'), fx = $('#ks-fx'), g = fx.getContext('2d');
    if (FAR < 1) { video.style.transform = 'translateX(-50%) scale(' + FAR + ')'; scene.classList.add('ks-far'); }
    var W = 0, H = 0, DPR = 1, last = performance.now(), now = 0, paused = false;
    var life = [], parts = [], spark = null, burn = null, flash = null;
    var tq = (location.search.match(/[?&]t=(\w+)/) || [])[1], hr = new Date().getHours();
    var night = tq ? tq !== 'day' && tq !== 'morning' : hr >= 17 || hr < 7;   // светлячки — с вечера до рассвета (по часам человека; проверка — ?t=day / ?t=night)
    var lifeKind = K.life === 'off' ? '' : K.life === 'fireflies' ? 'ff' : K.life === 'moths' ? 'bf' : night ? 'ff' : 'bf';

    function dayNow() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
    function iso() { var q = /[?&]den=(\d{4}-\d\d-\d\d)/.exec(location.search); if (q) return q[1]; var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    // вопрос и пожелание дня («Костёр Самайна» → «13 дней»; проверить другой день — ?den=2026-11-01 в адресе); дня нет в списке — общие надписи
    function dayOf() { var d = iso(); return (K.days || window.M13_KOSTER_DAYS).filter(function (x) { return x && x.date === d; })[0] || {}; }
    var MEM = 'm13uz-koster-' + IT.id;
    function daily() { return !PANEL && !SNOVA && K.daily !== false; }
    function doneToday() { try { return daily() && localStorage.getItem(MEM) === dayNow(); } catch (e) { return false; } }
    function markToday() { if (!daily()) return; try { localStorage.setItem(MEM, dayNow()); } catch (e) {} }

    /* ---------- где огонь на экране (видео — «обложкой» по центру) ---------- */
    function firePt() {
      var r = video.getBoundingClientRect(), s = Math.max(r.width / VW, r.height / VH), dw = VW * s, dh = VH * s;
      return { x: r.left + (r.width - dw) / 2 + FIRE.x * dw, y: r.top + (r.height - dh) / 2 + FIRE.y * dh, s: s };
    }
    function layout() {
      W = scene.clientWidth; H = scene.clientHeight; DPR = Math.min(window.devicePixelRatio || 1, 2);
      fx.width = Math.round(W * DPR); fx.height = Math.round(H * DPR); g.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (!life.length) seedLife();
    }

    /* ---------- живность: днём пара бабочек, ночью светлячки ---------- */
    function seedLife() {
      var n = lifeKind === 'ff' ? FF_N : lifeKind === 'bf' ? 2 : 0;
      for (var i = 0; i < n; i++) life.push({ x: W * (i % 2 ? .62 + Math.random() * .34 : .04 + Math.random() * .34), y: H * (.1 + Math.random() * .58), a: Math.random() * 6.28,
        v: lifeKind === 'ff' ? 7 + Math.random() * 10 : 34 + Math.random() * 16, ph: Math.random() * 6.28, bl: .3 + Math.random() * .6,
        sz: lifeKind === 'ff' ? .55 + Math.random() * .6 : 1, c: ['#f6f1e4', '#f3d65a', '#e9965a'][i % 3] });
    }
    function stepLife(dt) {
      life.forEach(function (b) {
        // держатся по краям, над огнём не летают — там жарко
        var fp = firePt(), dx = b.x - fp.x, away = Math.abs(dx) < Math.min(W * .2, 150 * fp.s) && b.y > H * .12 ? (dx < 0 ? -1 : 1) : 0;
        b.a += (Math.sin(now * (lifeKind === 'ff' ? .5 : 1.3) + b.ph) * .9 + (Math.random() - .5) * .6) * dt;
        if (away) b.a += (Math.atan2(0, away) - b.a) * Math.min(1, dt * .8);
        if (b.x < 20) b.a = 0; if (b.x > W - 20) b.a = Math.PI; if (b.y < 40) b.a = Math.PI / 2; if (b.y > H * .7) b.a = -Math.PI / 2;
        b.x += Math.cos(b.a) * b.v * dt; b.y += Math.sin(b.a) * b.v * dt * (lifeKind === 'bf' ? .6 : 1) + (lifeKind === 'bf' ? Math.sin(now * 6 + b.ph) * 12 * dt : 0);
      });
    }
    function drawLife() {
      life.forEach(function (b) {
        if (lifeKind === 'ff') {
          var on = Math.max(0, Math.sin(now * b.bl * 2 + b.ph)), r = (14 * on + 2) * b.sz, gr = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
          gr.addColorStop(0, 'rgba(232,255,170,' + (.25 + .7 * on) + ')'); gr.addColorStop(.3, 'rgba(190,240,120,' + (.25 * on) + ')'); gr.addColorStop(1, 'rgba(190,240,120,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, r, 0, 6.283); g.fill();
        } else {
          var f = Math.abs(Math.sin(now * 11 + b.ph)), s = 7, dir = Math.cos(b.a) < 0 ? -1 : 1;
          g.save(); g.translate(b.x, b.y); g.scale(dir, 1); g.rotate(-.25);
          g.fillStyle = b.c; g.globalAlpha = .92;
          [-1, 1].forEach(function (k) {
            g.save(); g.scale(1, .25 + .75 * f * (k > 0 ? 1 : .85));
            g.beginPath(); g.ellipse(-1, -s * .7 * k, s * .55, s * .8, k * .5, 0, 6.283); g.fill();
            g.beginPath(); g.ellipse(2, -s * .45 * k, s * .4, s * .5, -k * .4, 0, 6.283); g.fill();
            g.restore();
          });
          g.globalAlpha = 1; g.fillStyle = '#2b2018'; g.fillRect(-s * .5, -.8, s, 1.6); g.restore();
        }
      });
    }

    /* ---------- искорки, пепел, вспышка ---------- */
    function ember(x, y, k) {
      parts.push({ x: x, y: y, vx: (Math.random() - .5) * 40 * k, vy: -(40 + Math.random() * 90) * k, l: 0, L: .8 + Math.random() * 1.6, r: .8 + Math.random() * 1.8, ash: false });
    }
    function ash(x, y) { parts.push({ x: x, y: y, vx: (Math.random() - .5) * 30, vy: -(20 + Math.random() * 50), l: 0, L: 1.6 + Math.random() * 2, r: 1.5 + Math.random() * 3, ash: true, a: Math.random() * 6, va: (Math.random() - .5) * 6 }); }
    // искры от огня: летят вверх всё время, вразнобой
    var sparkAcc = 0;
    function fireSparks(dt) {
      if (!SPARKS || reduce) return;
      sparkAcc += dt * SPARKS;
      if (sparkAcc < 1) return;
      var fp = firePt();
      while (sparkAcc >= 1) {
        sparkAcc -= 1;
        var x = fp.x + (Math.random() - .5) * 230 * fp.s, y = fp.y - (Math.random() * 230 - 40) * fp.s, k = .6 + Math.random() * .9;
        parts.push({ x: x, y: y, vx: (Math.random() - .5) * 50 * k, vy: -(60 + Math.random() * 140) * k, l: 0, L: 1.2 + Math.random() * 2.6,
          r: .6 + Math.random() * 1.7, ash: false, tw: Math.random() * 6.28 });
      }
    }
    function stepParts(dt) {
      parts = parts.filter(function (p) {
        p.l += dt; if (p.l > p.L) return false;
        p.vx += Math.sin(now * 3 + p.y * .05) * 30 * dt; p.vy -= (p.ash ? 6 : 14) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; if (p.ash) p.a += p.va * dt;
        return true;
      });
    }
    function drawParts() {
      parts.forEach(function (p) {
        var o = 1 - p.l / p.L;
        if (p.ash) { g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = 'rgba(40,34,30,' + (.75 * o) + ')'; g.fillRect(-p.r, -p.r * .4, p.r * 2, p.r * .8); g.restore(); return; }
        if (p.tw != null) o *= .55 + .45 * Math.sin(now * 14 + p.tw);   // искра от огня мерцает
        g.fillStyle = 'rgba(255,' + Math.round(150 + 90 * o) + ',' + Math.round(60 + 80 * o) + ',' + o + ')';
        g.beginPath(); g.arc(p.x, p.y, p.r * (.6 + .4 * o), 0, 6.283); g.fill();
      });
      if (flash) {
        var f = flash.t / flash.L, r = 30 + f * Math.max(W, H) * .5, a = (1 - f) * .85, gr = g.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, r);
        gr.addColorStop(0, 'rgba(255,246,220,' + a + ')'); gr.addColorStop(.25, 'rgba(255,200,120,' + a * .5 + ')'); gr.addColorStop(1, 'rgba(255,170,90,0)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
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
      if (!spark) return;
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
      // листок рисуется на отдельном холсте во весь экран полосками — так он гнётся, колышется и скручивается
      var ov = document.createElement('canvas');
      ov.className = 'ks-burn'; ov.width = Math.round(W * DPR); ov.height = Math.round(H * DPR);
      document.body.appendChild(ov);
      var fp = firePt(), tx = fp.x - rect.left - rect.width / 2, ty = Math.max(H * .26, fp.y - 120 * fp.s) - rect.top - rect.height / 2;
      burn = { cv: cv, c: c, img: img, orig: orig, T0: T0, w: w, h: h, t: 0, fly: reduce ? .01 : 1.5, L: reduce ? 1.2 : 3.4, tx: tx, ty: ty, rect: rect,
        sc: .45 + .3 * FAR, rot: (Math.random() - .5) * 24, ph: Math.random() * 6.28, sway: (Math.random() < .5 ? -1 : 1) * (18 + Math.random() * 16),
        ov: ov, o: ov.getContext('2d'), N: 96, cols: [] };
    }
    // где на экране точка листка (xx, yy в пикселях картинки листка) — с учётом изгиба
    function burnPt(b, xx, yy) {
      var N = b.N, fi = xx / b.w * N, ci = Math.min(N - 1, Math.floor(fi)), col = b.cols[ci], f = (fi - ci) * b.rect.width / N, ly = (yy / b.h - .5) * b.rect.height * col.hs;
      var lx = col.x + Math.cos(col.a) * f - Math.sin(col.a) * ly, lyy = col.y + Math.sin(col.a) * f + Math.cos(col.a) * ly;
      var cs = Math.cos(b.R), sn = Math.sin(b.R);
      return { x: b.X + (lx * cs - lyy * sn) * b.S, y: b.Y + (lx * sn + lyy * cs) * b.S };
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
      // изгиб: полоски листка цепочкой, у каждой свой наклон — одна длинная пологая волна (её слова 31.10: «гармошкой» — мелкие изломы убраны); чем сильнее горит, тем больше скручивается
      var N = b.N, rw = b.rect.width, rh = b.rect.height, dw = rw / N, amp = .05 + .09 * mid + .12 * Math.min(1, pp), curl = .7 * Math.min(1, pp * 1.2);
      var x = 0, y = 0, cols = [], k, a, sx = 0, sy = 0;
      for (k = 0; k < N; k++) {
        var uc = k / (N - 1), m = uc * 2 - 1;
        a = amp * Math.sin(uc * Math.PI * 1.1 + b.t * 2.2 + b.ph) + curl * m * m * m * .5;
        cols.push({ x: x, y: y, a: a, hs: 1 - .02 * (1 + Math.sin(uc * 2.6 + b.t * 2.4 + b.ph)) * (.4 + Math.min(1, pp)) });
        sx += x + Math.cos(a) * dw / 2; sy += y + Math.sin(a) * dw / 2;
        x += Math.cos(a) * dw; y += Math.sin(a) * dw;
      }
      sx /= N; sy /= N;
      cols.forEach(function (c2) { c2.x -= sx; c2.y -= sy; });
      b.cols = cols;
      var O = b.o;
      O.setTransform(1, 0, 0, 1, 0, 0); O.clearRect(0, 0, b.ov.width, b.ov.height);
      O.setTransform(DPR, 0, 0, DPR, 0, 0); O.translate(b.X, b.Y); O.rotate(b.R); O.scale(b.S, b.S);
      var sw = b.w / N;
      for (k = 0; k < N; k++) {
        var cc = cols[k], hh = rh * cc.hs;
        O.save(); O.translate(cc.x, cc.y); O.rotate(cc.a);
        var ov2 = k < N - 1 ? 1.6 : 1;   // полоска берётся внахлёст со следующей — без швов
        O.drawImage(b.cv, k * sw, 0, sw * ov2, b.h, 0, -hh / 2, dw * ov2, hh);
        O.restore();
      }
      // свет и тень на сгибах — одной плавной заливкой вдоль листка (не полосками — иначе видны вертикальные швы)
      O.globalCompositeOperation = 'source-atop';
      var gx0 = cols[0].x, gx1 = cols[N - 1].x + Math.cos(cols[N - 1].a) * dw, gr = O.createLinearGradient(gx0, 0, gx1, 0);
      for (k = 0; k < N; k += 6) {
        var c1 = cols[Math.min(N - 1, k + 3)], c9 = cols[Math.max(0, k - 3)], da = (c1.a - c9.a) / 6;
        gr.addColorStop(k / (N - 1), da > 0 ? 'rgba(40,20,10,' + Math.min(.26, da * 9).toFixed(3) + ')' : 'rgba(255,240,215,' + Math.min(.16, -da * 6).toFixed(3) + ')');
      }
      O.fillStyle = gr; O.fillRect(gx0 - 10, -rh * 2, gx1 - gx0 + 20, rh * 4);
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
      drawLife(); drawParts(); drawSpark();
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
      // витрине — подпись и вопрос дня: нажатие на окошко откроет карточку с вопросом
      var tell = function () { if (dayText.ask && window.parent !== window) try { window.parent.postMessage({ m13koster: { label: dayText.label || '', ask: dayText.ask } }, '*'); } catch (e) {} };
      tell();
      window.addEventListener('message', function (e) {
        var m = e.data && e.data.m13okno; if (!m) return;
        if (m === 'play') tell();
        if (m === 'pause') { paused = true; video.pause(); }
        else if (paused) { paused = false; playVideo(); requestAnimationFrame(function (ts) { last = ts; frame(ts); }); }
      });
      return;
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
        burn.done = function () { setTimeout(sparkOut, 500); };
      };
      if (document.fonts && document.fonts.load) document.fonts.load('20px "Marck Script"').then(go, go); else go();
    };
    function sparkOut() {
      var fp = firePt(), to = { x: W / 2, y: H * (W < 700 ? .4 : .42) };
      flySpark({ x: fp.x + (Math.random() - .5) * 40 * fp.s, y: fp.y }, to, reduce ? .3 : 2.2, (Math.random() < .5 ? -1 : 1) * W * .12, function (x, y) {
        flash = { x: x, y: y, t: 0, L: 1.1 };
        for (var i = 0; i < 26; i++) ember(x, y, 1.4);
        markToday();
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
          showAfter(T('kAfter', 'Искра унесла твоё желание. Возвращайся завтра — к огню.'));
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
