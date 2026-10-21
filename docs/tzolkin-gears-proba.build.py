# Сборка пробы «Шестерёнки Цолькина» (docs/tzolkin-gears-proba.tpl.html): вставляет assets/kin.js.
# python3 docs/tzolkin-gears-proba.build.py <папка> → <папка>/tzolkin-gears-proba.html
import sys, os
out = sys.argv[1]
js = open('assets/kin.js', encoding='utf8').read()
t = open('docs/tzolkin-gears-proba.tpl.html', encoding='utf8').read()
assert t.count('/*KINJS*/') == 1
os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'tzolkin-gears-proba.html'), 'w', encoding='utf8').write(t.replace('/*KINJS*/', js))
