# Сборка пробы «Сад на слоях» (docs/uzory-sloi-proba.tpl.html): одна страница — код сайта (assets/uzory.js, uzory.css),
# данные data/uzory.json, шрифт и её картинки (docs/uzory-sloi/) — всё внутри.
# python3 docs/uzory-sloi-proba.build.py <папка> → <папка>/uzory-sloi-proba.html
import sys, os, base64, json
out = sys.argv[1]
def b64(p): return base64.b64encode(open(p, 'rb').read()).decode()
def face(style, f):
    return ("@font-face{font-family:'Cormorant Garamond';font-style:%s;font-weight:300 700;font-display:swap;"
            "src:url(data:font/woff2;base64,%s) format('woff2');unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}" % (style, b64('assets/fonts/' + f)))
fonts = face('normal', 'cormorant-garamond-4f4a8253.woff2') + face('italic', 'cormorant-garamond-034e3f1d.woff2')
st = json.load(open('data/settings.json', encoding='utf8'))
data = {'uzory': json.load(open('data/uzory.json', encoding='utf8')), 'settings': {'siteTitle': st.get('siteTitle'), 'contacts': st.get('contacts')}}
t = open('docs/uzory-sloi-proba.tpl.html', encoding='utf8').read()
for k, v in [('/*FONTS*/', fonts), ('/*CSS*/', open('assets/uzory.css', encoding='utf8').read()),
             ('/*JS*/', open('assets/uzory.js', encoding='utf8').read().replace('</script', '<\\/script')),
             ('/*DATA*/', json.dumps(data, ensure_ascii=False).replace('</', '<\\/')),
             ('/*IMG_MOH*/', 'data:image/webp;base64,' + b64('docs/uzory-sloi/moh-rosa.webp')),
             ('/*IMG_MOH_FOTO*/', 'data:image/webp;base64,' + b64('docs/uzory-sloi/moh-rosa-foto.webp')),
             ('/*IMG_ROMASHKA*/', 'data:image/webp;base64,' + b64('docs/uzory-sloi/cvety/romashka.webp')),
             ('/*IMG_MAK*/', 'data:image/webp;base64,' + b64('docs/uzory-sloi/cvety/mak.webp')),
             ('/*IMG_LAVANDA*/', 'data:image/webp;base64,' + b64('docs/uzory-sloi/cvety/lavanda.webp')),
             ('/*IMG_PION*/', 'data:image/webp;base64,' + b64('docs/uzory-sloi/cvety/pion.webp')),
             ('/*IMG_PG*/', 'data:image/webp;base64,' + b64('docs/uzory-sloi/polyana-gorizont.webp')),
             ('/*IMG_PODSOLNUH*/', 'data:image/webp;base64,' + b64('docs/uzory-sloi/cvety/podsolnuh.webp')),
             ('/*IMG_PODSNEZHNIK*/', 'data:image/webp;base64,' + b64('docs/uzory-sloi/cvety/podsnezhnik.webp')),
             ('/*IMG_NEZABUDKA*/', 'data:image/webp;base64,' + b64('docs/uzory-sloi/cvety/nezabudka.webp')),
             ('/*IMG_LANDYSH*/', 'data:image/webp;base64,' + b64('docs/uzory-sloi/cvety/landysh.webp')),
             ('/*IMG_ODUVANCHIK*/', 'data:image/webp;base64,' + b64('docs/uzory-sloi/cvety/oduvanchik.webp')),
             ('/*IMG_A1*/', 'data:image/webp;base64,' + b64('docs/uzory-sloi/a-dorozhka.webp')),
             ('/*IMG_A2*/', 'data:image/webp;base64,' + b64('docs/uzory-sloi/a-kochki.webp')),
             ('/*IMG_ROZA*/', 'data:image/webp;base64,' + b64('docs/uzory-sloi/cvety/roza.webp')),
             ('/*IMG_LILIYA*/', 'data:image/webp;base64,' + b64('docs/uzory-sloi/cvety/liliya.webp')),
             ('/*IMG_VASILYOK*/', 'data:image/webp;base64,' + b64('docs/uzory-sloi/cvety/vasilyok.webp')),
             ('/*IMG_ROSA*/', 'data:image/webp;base64,' + b64('docs/uzory-sloi/rosa-fon.webp'))]:
    assert t.count(k) == 1, k
    t = t.replace(k, v)
os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'uzory-sloi-proba.html'), 'w', encoding='utf8').write(t)
