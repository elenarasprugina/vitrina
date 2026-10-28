# Сборка пробы «Запись клиентов» (docs/zapis-proba.tpl.html): вставляет шрифт Cormorant Garamond (кириллица и латиница)
# и фон ноябрьской витрины прямо в страницу.
# python3 docs/zapis-proba.build.py <папка> → <папка>/zapis-proba.html
import sys, os, base64
out = sys.argv[1]
def b64(p): return base64.b64encode(open(p, 'rb').read()).decode()
def face(f, rng):
    return ("@font-face{font-family:'Cormorant Garamond';font-style:normal;font-weight:300 700;font-display:swap;"
            "src:url(data:font/woff2;base64,%s) format('woff2');unicode-range:%s;}" % (b64('assets/fonts/' + f), rng))
fonts = (face('cormorant-garamond-4f4a8253.woff2', 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116') +
         face('cormorant-garamond-2fed1d1b.woff2', 'U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+20BD,U+2122,U+2212'))
bg = "url(data:image/webp;base64,%s)" % b64('media/228a3201407a5619044d.webp')
t = open('docs/zapis-proba.tpl.html', encoding='utf8').read()
assert t.count('/*FONTS*/') == 1 and t.count('/*BG*/') == 1
os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'zapis-proba.html'), 'w', encoding='utf8').write(t.replace('/*FONTS*/', fonts).replace('/*BG*/', bg))
