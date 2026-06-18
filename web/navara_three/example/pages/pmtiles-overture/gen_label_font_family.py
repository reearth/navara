#!/usr/bin/env python3
"""Generate labelFontFamily.json for the pmtiles-overture example.

Bold + wide multi-script label font. Latin/Vietnamese use Archivo at ExtraBold
(wght 800) and the widest width (wdth 125) for a bold, wide look; every other
script uses Noto at the heaviest weight Google Fonts offers it (800 where
available, else the nearest), so coverage stays global.

Each face's `unicodeRanges` is derived from the font's ACTUAL cmap, not from the
Google Fonts CSS `unicode-range`. The segmenter (FontManager `_findFaceForCodepoint`)
picks the first face whose range contains a glyph and never falls through if that
face actually lacks it — and Google's CJK webfonts share ONE slice partition
across JP/SC/KR (each font advertises the same ranges but ships only its own
glyphs, so SC "declares" Hangul it lacks). Building ranges from the real cmap
guarantees a face only claims codepoints it can render.

Face order = precedence (first match wins):
  1. Archivo (CDN)             — Latin/Vietnamese, bold+wide; face 0 fallback
  2. Noto Sans (CDN)           — Cyrillic/Greek + any Latin glyphs Archivo omits
  3. per-script Noto (CDN)     — restricted to cp >= 0x530 (Latin/Greek/Cyrillic above)
  4. Noto Sans JP / SC / KR    — full CJK; cmap-accurate so Hangul lands on KR

Usage: python3 gen_label_font_family.py labelFontFamily.json   (run from repo root)
"""
import json, re, sys, urllib.request, io
from concurrent.futures import ThreadPoolExecutor
from fontTools.ttLib import TTFont

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120 Safari/537.36")

def http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()

def fetch_css(family_query: str, axis_spec: str):
    """Return woff2 URLs for family@axis_spec, or None if that instance 404s."""
    try:
        css = http_get(f"https://fonts.googleapis.com/css2?family={family_query}:{axis_spec}").decode()
    except Exception:
        return None
    return re.findall(r"src:\s*url\((https://[^)]+\.woff2)\)", css)

# Noto static faces don't all offer 800 — fall back to the heaviest available.
WEIGHTS = ["wght@800", "wght@700", "wght@600", "wght@500", "wght@400"]

def fetch_heaviest(family_query: str):
    for spec in WEIGHTS:
        urls = fetch_css(family_query, spec)
        if urls:
            return urls, spec
    return None, None

def cmap_codepoints(font_bytes: bytes) -> set:
    return set(TTFont(io.BytesIO(font_bytes)).getBestCmap().keys())

def compress(cps) -> list:
    out = []
    for cp in sorted(cps):
        if out and cp == out[-1][1] + 1:
            out[-1][1] = cp
        else:
            out.append([cp, cp])
    return out

def make_face(url, cps, floor=0):
    cps = {c for c in cps if c >= floor}
    if not cps:
        return None
    return {"url": url, "unicodeRanges": [{"from": a, "to": b} for a, b in compress(cps)]}

def faces_from_urls(urls, floor):
    def build(u):
        return make_face(u, cmap_codepoints(http_get(u)), floor)
    with ThreadPoolExecutor(max_workers=16) as ex:
        return [f for f in ex.map(build, urls) if f]

# Per-script Noto families (CDN). Tibetan only exists as Serif on Google Fonts.
SCRIPTS = [
    "Noto+Sans+Arabic", "Noto+Sans+Hebrew", "Noto+Sans+Thaana", "Noto+Sans+NKo",
    "Noto+Sans+Syriac", "Noto+Sans+Thai", "Noto+Sans+Lao", "Noto+Sans+Khmer",
    "Noto+Sans+Myanmar", "Noto+Sans+Devanagari", "Noto+Sans+Bengali",
    "Noto+Sans+Gujarati", "Noto+Sans+Gurmukhi", "Noto+Sans+Tamil",
    "Noto+Sans+Telugu", "Noto+Sans+Kannada", "Noto+Sans+Malayalam",
    "Noto+Sans+Oriya", "Noto+Sans+Sinhala", "Noto+Sans+Georgian",
    "Noto+Sans+Armenian", "Noto+Sans+Ethiopic", "Noto+Serif+Tibetan",
    "Noto+Sans+Mongolian", "Noto+Sans+Tifinagh", "Noto+Sans+Adlam",
    "Noto+Sans+Cherokee", "Noto+Sans+Canadian+Aboriginal", "Noto+Sans+Vai",
    "Noto+Sans+Yi", "Noto+Sans+Osmanya",
]
CJK = ["Noto+Sans+JP", "Noto+Sans+SC", "Noto+Sans+KR"]
SCRIPT_FLOOR = 0x530  # below = Latin/IPA/diacritics/Greek/Cyrillic (Archivo+Noto handle).
                      # 0x530 = start of Armenian, the lowest script block below; the floor
                      # only trims redundancy (earlier faces win anyway), so it must never
                      # slice through a real block.

def add(faces, family_query, floor, axis_spec=None):
    if axis_spec:
        urls, used = fetch_css(family_query, axis_spec), axis_spec
    else:
        urls, used = fetch_heaviest(family_query)
    if not urls:
        print(f"  {family_query:30} SKIPPED (no instance)", file=sys.stderr)
        return
    built = faces_from_urls(urls, floor)
    faces += built
    print(f"  {family_query:30} {len(built):3} face(s)  @{used}", file=sys.stderr)

def main():
    path = sys.argv[1]
    family_name = json.load(open(path))["family"]

    faces = []
    # 1. Archivo ExtraBold + widest width = the bold, wide Latin look. Its
    #    basic-Latin slice (with 'A') must be face 0 (the fallback face).
    add(faces, "Archivo", 0, axis_spec="wght,wdth@800,125")
    faces.sort(key=lambda f: not any(r["from"] <= 0x41 <= r["to"] for r in f["unicodeRanges"]))
    # 2. Noto Sans bold backstop: Cyrillic/Greek + Latin glyphs Archivo omits.
    add(faces, "Noto+Sans", 0)
    # 3. Per-script Noto, heaviest available, restricted to their script.
    for fam in SCRIPTS:
        add(faces, fam, SCRIPT_FLOOR)
    # 4. CJK — full, cmap-accurate (Hangul correctly lands on KR).
    for fam in CJK:
        add(faces, fam, SCRIPT_FLOOR)

    json.dump({"family": family_name, "faces": faces},
              open(path, "w"), indent=2, ensure_ascii=False)
    open(path, "a").write("\n")
    print(f"wrote {len(faces)} faces", file=sys.stderr)

if __name__ == "__main__":
    main()
