# Сборка пробы «Мой цветок» (docs/uzory-cvetok-proba.tpl.html): вставляет шрифт Cormorant Garamond (кириллица) прямо в страницу.
# python3 docs/uzory-cvetok-proba.build.py <папка> → <папка>/uzory-cvetok-proba.html
import sys, os, base64
out = sys.argv[1]
def face(style, f):
    b = base64.b64encode(open('assets/fonts/' + f, 'rb').read()).decode()
    return ("@font-face{font-family:'Cormorant Garamond';font-style:%s;font-weight:300 700;font-display:swap;"
            "src:url(data:font/woff2;base64,%s) format('woff2');unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}" % (style, b))
fonts = face('normal', 'cormorant-garamond-4f4a8253.woff2') + face('italic', 'cormorant-garamond-034e3f1d.woff2')
t = open('docs/uzory-cvetok-proba.tpl.html', encoding='utf8').read()
assert t.count('/*FONTS*/') == 1
os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'uzory-cvetok-proba.html'), 'w', encoding='utf8').write(t.replace('/*FONTS*/', fonts))
