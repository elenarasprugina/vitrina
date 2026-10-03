/* Яндекс Метрика 13 MIRRORS — один счётчик на весь сайт 13mirrors.ru: главная, Гримуар, Синяя Рука, витрина, маршруты.
   Подключение — одна строка в <head> каждой страницы:
     витрина: <script src="(./ | ../ | ../../)assets/metrika.js" async></script> (страницы, которые собирает панель, — pageHTML в admin.js);
     главная (репозиторий elenarasprugina.github.io): <script src="/vitrina/assets/metrika.js" async></script>.
   Номер счётчика и настройки — только здесь. Вебвизор выключен (её правило анонимности: он записал бы личные карты и коды участников).
   Не считаем: предпросмотр из панели (?preview=1, окошко внутри панели), копии сайта не на 13mirrors.ru (проверки, github.io).
   Страницы-превью для Telegram/VK (…/2026-10/sun/ и т. п.) счётчика не имеют и сразу переходят на витрину;
   перед переходом они кладут свой document.referrer в sessionStorage 'm13ref' — здесь он становится источником визита. */
(function () {
  var ID = 113328628;
  if (!/(^|\.)13mirrors\.ru$/.test(location.hostname)) return;
  if (/[?&]preview=1/.test(location.search)) return;
  try { if (window.top !== window.self) return; } catch (e) { return; }
  var ref = document.referrer;
  try { var s = sessionStorage.getItem('m13ref'); if (s != null) { sessionStorage.removeItem('m13ref'); ref = s; } } catch (e) {}

  // Код счётчика из Метрики (альтернативный CDN, без Вебвизора)
  (function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
    m[i].l = 1 * new Date();
    for (var j = 0; j < document.scripts.length; j++) { if (document.scripts[j].src === r) { return; } }
    k = e.createElement(t), a = e.getElementsByTagName(t)[0], k.async = 1, k.src = r, a.parentNode.insertBefore(k, a);
  })(window, document, 'script', 'https://mc.webvisor.org/metrika/tag_ww.js?id=' + ID, 'ym');

  window.ym(ID, 'init', { ssr: true, trackHash: true, clickmap: true, referrer: ref, url: location.href, accurateTrackBounce: true, trackLinks: true, webvisor: false });
})();
