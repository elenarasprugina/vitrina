# Сборка пробы «Свой кин · механизм» (docs/tzolkin-mech-proba.tpl.html): вставляет assets/kin.js, assets/kinwheel.js
# и стили колеса даты из assets/vitrina.css (от «Колесо даты (19.10» до «Маленькое «тихо живое» колесо»).
# python3 docs/tzolkin-mech-proba.build.py <папка> → <папка>/tzolkin-mech-proba.html
import sys, os
out = sys.argv[1]
kin = open('assets/kin.js', encoding='utf8').read()
kw = open('assets/kinwheel.js', encoding='utf8').read()
css = open('assets/vitrina.css', encoding='utf8').read()
a = css.index('/* Колесо даты (19.10'); b = css.index('/* Маленькое «тихо живое» колесо')
t = open('docs/tzolkin-mech-proba.tpl.html', encoding='utf8').read()
for m in ('/*KINJS*/', '/*KWJS*/', '/*KWCSS*/'): assert t.count(m) == 1, m
t = t.replace('/*KINJS*/', kin).replace('/*KWJS*/', kw).replace('/*KWCSS*/', css[a:b])
os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'tzolkin-mech-proba.html'), 'w', encoding='utf8').write(t)
