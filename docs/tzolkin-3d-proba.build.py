# Сборка пробы «Цолькин в объёме» (docs/tzolkin-3d-proba.tpl.html): вставляет assets/kin.js.
# python3 docs/tzolkin-3d-proba.build.py <папка> → <папка>/tzolkin-3d-proba.html
import sys, os
out = sys.argv[1]
js = open('assets/kin.js', encoding='utf8').read()
t = open('docs/tzolkin-3d-proba.tpl.html', encoding='utf8').read()
assert t.count('/*KINJS*/') == 1
os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'tzolkin-3d-proba.html'), 'w', encoding='utf8').write(t.replace('/*KINJS*/', js))
