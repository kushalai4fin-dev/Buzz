"""Draws the Buzz app icons: the Bee-Bee mascot on a coral tile.
Run from the project folder:  python3 scripts/make_icons.py   (needs Pillow)
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

CORAL = (255, 107, 87, 255)
PAPER = (255, 253, 247, 255)
INK = (43, 42, 51, 255)
SUN = (255, 209, 102, 255)
ROSE = (255, 180, 168, 255)


def ellipse_poly(cx, cy, rx, ry, angle_deg=0, n=72):
    a = math.radians(angle_deg)
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x, y = rx * math.cos(t), ry * math.sin(t)
        pts.append((cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)))
    return pts


def make(size, scale, path, flatten=False):
    S = size * 4  # draw big, shrink for smooth edges
    img = Image.new("RGBA", (S, S), CORAL)
    d = ImageDraw.Draw(img)

    def P(u, v):
        return (S * (0.5 + (u - 0.5) * scale), S * (0.5 + (v - 0.5) * scale))

    def poly(points):
        return [P(u, v) for u, v in points]

    lw = max(3, int(S * 0.016 * scale))

    def outlined(points, fill):
        pts = poly(points)
        d.polygon(pts, fill=fill)
        d.line(pts + [pts[0]], fill=INK, width=lw, joint="curve")

    # antennae
    for sx in (-1, 1):
        a = (0.5 + sx * 0.08, 0.36)
        b = (0.5 + sx * 0.17, 0.20)
        d.line([P(*a), P(*b)], fill=INK, width=lw)
        cx, cy = P(*b)
        r = S * 0.026 * scale
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=CORAL, outline=INK, width=lw)
    # wings
    outlined(ellipse_poly(0.34, 0.36, 0.085, 0.13, -28), PAPER)
    outlined(ellipse_poly(0.66, 0.36, 0.085, 0.13, 28), PAPER)

    # body with stripes clipped to it
    body = ellipse_poly(0.5, 0.58, 0.27, 0.235)
    pts = poly(body)
    d.polygon(pts, fill=SUN)
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    stripes = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stripes)
    for y0, h in ((0.675, 0.045), (0.76, 0.045)):
        sd.polygon([P(0.2, y0), P(0.5, y0 + 0.05), P(0.8, y0), P(0.8, y0 + h), P(0.5, y0 + h + 0.05), P(0.2, y0 + h)], fill=INK)
    img.paste(stripes, (0, 0), Image.composite(stripes.split()[3], Image.new("L", (S, S), 0), mask))
    d = ImageDraw.Draw(img)
    d.line(pts + [pts[0]], fill=INK, width=lw, joint="curve")

    # face
    for ex in (0.405, 0.595):
        cx, cy = P(ex, 0.55)
        r = S * 0.028 * scale
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=INK)
        r2 = r * 0.35
        d.ellipse([cx - r2 + r * 0.3, cy - r2 - r * 0.3, cx + r2 + r * 0.3, cy + r2 - r * 0.3], fill=PAPER)
    for ex in (0.31, 0.69):
        cx, cy = P(ex, 0.60)
        r = S * 0.03 * scale
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ROSE)
    (x0, y0), (x1, y1) = P(0.43, 0.58), P(0.57, 0.68)
    d.arc([x0, y0, x1, y1], start=15, end=165, fill=INK, width=lw)

    out = img.resize((size, size), Image.LANCZOS)
    if flatten:
        out = out.convert("RGB")
    out.save(path)


if __name__ == "__main__":
    folder = Path(__file__).resolve().parent.parent / "icons"
    folder.mkdir(exist_ok=True)
    make(192, 1.0, folder / "icon-192.png")
    make(512, 1.0, folder / "icon-512.png")
    make(512, 0.78, folder / "maskable-512.png")  # extra padding so round masks never clip the bee
    make(180, 1.0, folder / "apple-touch-icon.png", flatten=True)  # iOS wants an opaque square
    print("icons written to", folder)
