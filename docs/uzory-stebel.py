# дорисовать стебель вниз: продолжить нижний кусок стебля (зеркально повторяя последние K строк) по его наклону, плавно к вертикали
import sys, math
from PIL import Image
import numpy as np
def runs(row, thr=140):
    r, x0 = [], None
    for x, v in enumerate(row):
        if v > thr and x0 is None: x0 = x
        if v <= thr and x0 is not None: r.append((x0, x - 1)); x0 = None
    if x0 is not None: r.append((x0, len(row) - 1))
    return r
def extend(src, dst, k=0.4, K=60):
    im = Image.open(src).convert('RGBA'); a = np.array(im); h, w = a.shape[:2]
    al = a[:, :, 3]
    ys = [y for y in range(h) if (al[y] > 200).sum() >= 3]; y0 = ys[-1]
    rr = runs(al[y0]); cur = max(rr, key=lambda r: r[1] - r[0])
    cs, ws = {}, {}
    for y in range(y0, y0 - K - 1, -1):
        rr = runs(al[y]); best = None
        for r in rr:
            if r[1] >= cur[0] - 3 and r[0] <= cur[1] + 3:
                if best is None or abs((r[0]+r[1]) - (cur[0]+cur[1])) < abs((best[0]+best[1]) - (cur[0]+cur[1])): best = r
        if best is None: break
        # слишком широкий кусок — лист прилип к стеблю: берём прежнюю ширину вокруг прежнего центра
        if best[1] - best[0] > (cur[1] - cur[0]) * 1.6 + 4: c = (cur[0] + cur[1]) / 2; best = (int(c - (cur[1]-cur[0])/2), int(c + (cur[1]-cur[0])/2))
        cur = best; cs[y] = (best[0] + best[1]) / 2; ws[y] = best[1] - best[0] + 1
    yk = sorted(cs); K = len(yk) - 1
    sl = np.polyfit(yk, [cs[y] for y in yk], 1)[0] if K > 10 else 0
    wd = int(np.median([ws[y] for y in yk])); half = wd // 2 + 4
    E = int(h * k); L = E / 3.0
    out = np.zeros((y0 + 1 + E, w, 4), np.uint8); out[:y0 + 1] = a[:y0 + 1]
    c0 = cs[y0]
    for r in range(1, E + 1):
        m = r % (2 * K); sy = y0 - (m if m <= K else 2 * K - m)
        sc = cs.get(sy, c0)
        tc = c0 + sl * L * (1 - math.exp(-r / L))
        for dx in range(-half, half + 1):
            sx = int(round(sc + dx)); tx = int(round(tc + dx))
            if 0 <= sx < w and 0 <= tx < w: out[y0 + r, tx] = a[sy, sx] if abs(dx) <= half else 0
        # чистим края, где в исходной строке был чужой лист
        for tx in list(range(int(tc) - half - 6, int(tc) - wd // 2 - 3)) + list(range(int(tc) + wd // 2 + 3, int(tc) + half + 7)):
            if 0 <= tx < w: out[y0 + r, tx, 3] = 0
    Image.fromarray(out).save(dst, 'WEBP', quality=88, method=6)
    print(src.split('/')[-1], 'h', h, '->', out.shape[0], 'slope %.2f width %d K %d' % (sl, wd, K))
if __name__ == '__main__':
    extend(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else .4)
