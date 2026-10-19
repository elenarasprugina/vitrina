# Сборка пробы «Маленькое колесо» (docs/kin-mini-proba.tpl.html): вставляет assets/kinwheel.js с пробными настройками.
# python3 docs/kin-mini-proba.build.py <папка> → <папка>/kin-mini-proba.html, bg.webp, maps.webp
import sys, os, shutil
out = sys.argv[1]
js = open('assets/kinwheel.js', encoding='utf8').read()
P = [
  ("if (reduce || !ctx.createConicGradient) return;\n      var g = (now % 5600) / 1700;",
   "var GL = o.glint || { per: 5600, dur: 1700, a: .42 };\n      if (reduce || o.still || !GL.per || !ctx.createConicGradient) return;\n      var g = (now % GL.per) / GL.dur;"),
  ("(.42 * k)", "(GL.a * k)"),
  ("if (reduce || now < dialT) return;", "if (reduce || o.still || now < dialT || (o.calm && dialToday)) return;"),
  ("sy = reduce ? +tp[0]", "sy = (reduce || o.still) ? +tp[0]"),
  ("rotFor('m', reduce ? +tp[1]", "rotFor('m', (reduce || o.still) ? +tp[1]"),
  ("rotFor('d', reduce ? +tp[2]", "rotFor('d', (reduce || o.still) ? +tp[2]"),
  ("dt / (o.mini ? 700 : 70)", "dt / (o.mini ? (o.ease || 700) : 70)"),
  ("(reduce ? .7 : .5 + .4 * Math.sin(now / 700 + k * .45))", "(reduce || o.still ? .7 : .5 + .4 * Math.sin(now / (o.twk || 700) + k * .45))"),
  ("if (o.mini) h = '<div class=\"m13-kw-mt\">' + esc(T('wMini')) + '</div><span class=\"m13-kw-open\">' + esc(T('wOpen')) + '</span>';",
   "if (o.mini) h = o.noText ? '' : '<div class=\"m13-kw-mt\">' + esc(T('wMini')) + '</div>' + (o.btn ? '<span class=\"m13-kw-open\">' + esc(T('wOpen')) + '</span>' : '');"),
  # tiny — колесо меньше ~150 px: без подписей на кольцах (дни и месяцы — точками), стрелка без значений
  ("if (dec && Math.abs(wrapPi(a)) > .2)", "if (dec && !o.tiny && Math.abs(wrapPi(a)) > .2)"),
  ("txt(MON[i], p[0], p[1], 12.5 * fx, M.ink, '500', 0, M.inkSh);",
   "if (o.tiny) { ctx.beginPath(); ctx.arc(p[0], p[1], 1.2 * f + .5, 0, TAU); ctx.fillStyle = M.ink; ctx.fill(); } else txt(MON[i], p[0], p[1], 12.5 * fx, M.ink, '500', 0, M.inkSh);"),
  ("txt(String(i + 1), p[0], p[1], 10 * fx,",
   "if (o.tiny) { ctx.beginPath(); ctx.arc(p[0], p[1], .9 * f + .4, 0, TAU); ctx.fillStyle = i <= dmax ? M.ink : M.dim; ctx.fill(); } else txt(String(i + 1), p[0], p[1], 10 * fx,"),
  ("[['y', .83, 13], ['m', .667, 13.5], ['d', .508, 12]].forEach(", "if (!o.tiny) [['y', .83, 13], ['m', .667, 13.5], ['d', .508, 12]].forEach("),
]
for a, b in P:
    assert js.count(a) == 1, a
    js = js.replace(a, b)
t = open('docs/kin-mini-proba.tpl.html', encoding='utf8').read()
os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'kin-mini-proba.html'), 'w', encoding='utf8').write(t.replace('<!--KWJS-->', js))
shutil.copy('media/ca0291e4004398d55e93.webp', os.path.join(out, 'bg.webp'))
shutil.copy('media/a890d0b2cae3689c59ab.webp', os.path.join(out, 'maps.webp'))
