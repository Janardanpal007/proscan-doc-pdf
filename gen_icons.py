# Generates ProScan launcher icons and splash screens into the Android res folder
import glob, math, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

RES = os.path.join(os.path.dirname(__file__), 'android', 'app', 'src', 'main', 'res')
BG = (8, 8, 11)
STOPS = [(168, 85, 247), (255, 79, 216), (255, 210, 63), (61, 255, 162), (56, 189, 248)]
LIME = (198, 255, 61)

def spectrum(t):
    t = max(0, min(1, t)) * (len(STOPS) - 1)
    i = min(int(t), len(STOPS) - 2); f = t - i
    a, b = STOPS[i], STOPS[i + 1]
    return tuple(int(a[k] + (b[k] - a[k]) * f) for k in range(3))

def glyph(size):
    """Scan-frame corners with spectrum gradient, document + lime scan line. Transparent background."""
    S = size * 4
    grad = Image.new('RGB', (S, S))
    gp = grad.load()
    for y in range(S):
        for x in range(S):
            gp[x, y] = spectrum((x + y) / (2 * S))
    mask = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(mask)
    m, L, w = S * 0.14, S * 0.22, S * 0.075
    r = w / 2
    for cx, cy, sx, sy in [(m, m, 1, 1), (S - m, m, -1, 1), (S - m, S - m, -1, -1), (m, S - m, 1, -1)]:
        d.line([(cx, cy + sy * L), (cx, cy), (cx + sx * L, cy)], fill=255, width=int(w), joint='curve')
        for px, py in [(cx, cy + sy * L), (cx + sx * L, cy)]:
            d.ellipse([px - r, py - r, px + r, py + r], fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    glow = Image.composite(grad, Image.new('RGB', (S, S)), mask.filter(ImageFilter.GaussianBlur(S * 0.03)))
    glow_a = mask.filter(ImageFilter.GaussianBlur(S * 0.03)).point(lambda v: int(v * 0.55))
    out.paste(glow, (0, 0), glow_a)
    out.paste(grad, (0, 0), mask)
    # document sheet
    dd = ImageDraw.Draw(out)
    x0, y0, x1, y1 = S * 0.33, S * 0.29, S * 0.67, S * 0.71
    dd.rounded_rectangle([x0, y0, x1, y1], radius=S * 0.035, fill=(245, 245, 247, 255))
    fold = S * 0.09
    dd.polygon([(x1 - fold, y0), (x1, y0 + fold), (x1, y0)], fill=(8, 8, 11, 255))
    dd.polygon([(x1 - fold, y0), (x1 - fold, y0 + fold), (x1, y0 + fold)], fill=(190, 190, 200, 255))
    for i in range(4):
        yy = y0 + S * (0.13 + i * 0.065)
        dd.rounded_rectangle([x0 + S * 0.05, yy, x1 - S * (0.05 if i % 2 == 0 else 0.11), yy + S * 0.022], radius=S * 0.011, fill=(150, 150, 165, 255))
    # lime scan line with glow
    ly = S * 0.5
    line = Image.new('L', (S, S), 0)
    ImageDraw.Draw(line).rounded_rectangle([S * 0.24, ly - S * 0.018, S * 0.76, ly + S * 0.018], radius=S * 0.018, fill=255)
    out.paste(Image.new('RGB', (S, S), LIME), (0, 0), line.filter(ImageFilter.GaussianBlur(S * 0.025)).point(lambda v: int(v * 0.8)))
    out.paste(Image.new('RGB', (S, S), LIME), (0, 0), line)
    return out.resize((size, size), Image.LANCZOS)

def legacy(size, round_):
    S = size * 4
    base = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    msk = Image.new('L', (S, S), 0)
    if round_: ImageDraw.Draw(msk).ellipse([0, 0, S - 1, S - 1], fill=255)
    else: ImageDraw.Draw(msk).rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.22, fill=255)
    base.paste(Image.new('RGBA', (S, S), BG + (255,)), (0, 0), msk)
    g = glyph(int(S * 0.86))
    base.alpha_composite(g, ((S - g.width) // 2, (S - g.height) // 2))
    return base.resize((size, size), Image.LANCZOS)

for d, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    folder = os.path.join(RES, 'mipmap-' + d)
    legacy(px, False).save(os.path.join(folder, 'ic_launcher.png'))
    legacy(px, True).save(os.path.join(folder, 'ic_launcher_round.png'))
    fg_size = int(px * 108 / 48)
    fg = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
    g = glyph(int(fg_size * 0.62))  # keep inside the adaptive-icon safe zone
    fg.alpha_composite(g, ((fg_size - g.width) // 2, (fg_size - g.height) // 2))
    fg.save(os.path.join(folder, 'ic_launcher_foreground.png'))

def font(px):
    for f in ['C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/arialbd.ttf']:
        if os.path.exists(f): return ImageFont.truetype(f, px)
    return ImageFont.load_default()

for f in glob.glob(os.path.join(RES, 'drawable*', 'splash.png')):
    W, H = Image.open(f).size
    img = Image.new('RGB', (W, H), BG)
    s = int(min(W, H) * 0.32)
    g = glyph(s)
    img.paste(g, ((W - s) // 2, int(H / 2 - s * 0.7)), g)
    dr = ImageDraw.Draw(img)
    fnt = font(max(14, int(s * 0.22)))
    text = 'ProScan'
    tw = dr.textlength(text, font=fnt)
    tx, ty = (W - tw) / 2, H / 2 + s * 0.38
    tm = Image.new('L', (W, H), 0); ImageDraw.Draw(tm).text((tx, ty), text, font=fnt, fill=255)
    grad = Image.new('RGB', (W, H)); gp = grad.load()
    for x in range(W):
        c = spectrum((x - tx) / max(1, tw))
        for y in range(int(ty), min(H, int(ty + s * 0.4))): gp[x, y] = c
    img.paste(grad, (0, 0), tm)
    img.save(f)
print('icons + splash generated')
