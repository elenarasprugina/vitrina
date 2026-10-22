# Склейка фона «Поляна + горизонт» (22.10 (6)): снизу её поляна со мхом (moh-rosa.webp), сверху небо и даль из фона «А» (a-dorozhka.webp),
# по шву — мягкий переход и лёгкая дымка. python3 docs/uzory-sloi-skleika.py → docs/uzory-sloi/polyana-gorizont.webp
from PIL import Image
import numpy as np
D = 'docs/uzory-sloi/'
sky = Image.open(D + 'a-dorozhka.webp').convert('RGB')
gl = Image.open(D + 'moh-rosa.webp').convert('RGB')
W, H = 2000, 1333; y0 = 540; ramp = 120  # где начинается поляна; ширина перехода
g = gl.crop((0, 140, 2000, 1333)).resize((W, H - y0), Image.LANCZOS)
a = np.ones((H - y0, W), np.float32); a[:ramp] = np.linspace(0, 1, ramp)[:, None] ** 1.5
out = sky.copy(); out.paste(g, (0, y0), Image.fromarray((a * 255).astype('uint8')))
arr = np.asarray(out).astype(np.float32); y = np.arange(H)[:, None]
f = np.exp(-((y - (y0 + ramp * .6)) / 70.0) ** 2) * .3
arr = arr * (1 - f[..., None]) + np.array([226, 226, 214], np.float32) * f[..., None]
Image.fromarray(arr.clip(0, 255).astype('uint8')).save(D + 'polyana-gorizont.webp', quality=86, method=6)
