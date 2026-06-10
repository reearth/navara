# navara_wasm_font_worker

Text rendering pipeline for Navara. Handles font loading, text shaping, and glyph
atlas management, exposed to TypeScript as the `FontCache` WASM module.

## Pipeline Overview

```text
Font file (.ttf/.otf/.woff/.woff2)
        |
        v
  +-----------+     +--------------------------+     +-------------+
  | rustybuzz |---->| rasterize (mode-dependent)|--->| guillotiere |
  | (shaping) |     |  SDF  : fontdue + sdf_*  |     | (atlas      |
  |           |     |  MSDF : fdsm             |     |  packing +  |
  |           |     |  Color: skrifa+tiny-skia |     |  growth)    |
  +-----------+     +--------------------------+     +-------------+
        |                                                  |
        v                                                  v
  ShapedGlyph[]                                   Atlas texture
  (glyph IDs +                                    (glyph rects + pixel data;
   advances/offsets)                               R8 for SDF, RGBA8 otherwise)
        |                                                  |
        +------ sent to TypeScript -------------------------+
                        |
                        v
              Instanced billboard quads
              (one quad per glyph, sampled
               from the shared atlas)
```

## How It Works

1. **Font Loading** — Font bytes (decompressed from WOFF/WOFF2 if needed) are stored
   in `FontCache` as a `FontEntry` with a parsed `fontdue::Font`. Fonts sharing an
   `atlas_key` (e.g. the faces of one family) share a single `Atlas`; a composite
   `(font_index, glyph_id)` key keeps their glyphs from colliding. COLRv1 fonts are
   detected on load and given a parallel RGBA color atlas.

2. **Text Shaping** — `rustybuzz` (Rust port of HarfBuzz) turns a string into
   `ShapedGlyph`s: glyph IDs with advance/offset values in font units. This handles
   complex scripts (Arabic, CJK, ligatures).

3. **Rasterization** — Each atlas is fixed to one mode, chosen per font:
   - **SDF** (default): `fontdue` rasterizes a bitmap at `SDF_PX_SIZE`, then
     `sdf_glyph_renderer` produces a single-channel (R8) signed distance field.
   - **MSDF** (`highQuality`): `fdsm` generates a 4-channel MTSDF from the vector
     outline — sharper corners at higher per-glyph cost.
   - **Color** (COLRv1): `skrifa` + `tiny-skia` paint the glyph into an RGBA bitmap.

4. **Atlas Packing & Growth** — `guillotiere` packs glyph rects into a shared atlas,
   starting at `DEFAULT_ATLAS_SIZE` (2048²). When it runs out of room the atlas doubles
   its side up to `MAX_ATLAS_SIZE` (8192²); growth preserves existing glyph positions,
   so metrics already handed to TypeScript stay valid.

5. **Eviction (reference counted by visibility)** — Glyphs are *not* evicted by age.
   Each glyph carries a `ref_count` of the **visible labels** using it, driven from
   TypeScript via `retainGlyphs` / `releaseGlyphs` (a label increments its glyphs when
   it becomes visible, decrements when it hides or is disposed). A glyph with
   `ref_count == 0` is off screen and may be freed when the atlas next needs space;
   a glyph with `ref_count >= 1` is pinned and never evicted, so an on-screen label can
   never render a stale or wrong glyph. When an eviction frees rects, `shapeText`
   reports `evicted = true` so TypeScript bumps a per-atlas generation and re-shapes any
   cached metrics that predate it.

6. **Rendering** (TypeScript side) — Each text label is an `InstancedBufferGeometry`
   with one quad per glyph. The vertex shader positions quads using shaping data; the
   fragment shader samples the atlas (median-of-RGB for MTSDF, `.r` for SDF, RGBA for
   color) and applies SDF thresholding for crisp edges, outlines, and backgrounds.

## Modules

| Module | Purpose |
|---|---|
| `cache.rs` | `FontCache`, `FontEntry` — font storage, atlas ownership, `retain_glyphs` / `release_glyphs` |
| `shaping.rs` | `shape_text()` — rustybuzz text shaping, returns positioned glyphs |
| `atlas.rs` | `Atlas`, `GlyphMetrics`, `ensure_glyphs_in_atlas()` — rasterization dispatch, packing, growth, and refcount eviction |
| `msdf.rs` | MTSDF rasterization via `fdsm` |
| `color_raster.rs` | COLRv1 color glyph rasterization via `skrifa` + `tiny-skia` |
| `lib.rs` | WASM bindings: `shapeText`, `loadFont` / `unloadFont`, `getFontAtlas` / `getColorAtlas`, `retainGlyphs` / `releaseGlyphs` |

## Key Constants

| Constant | Value | Purpose |
|---|---|---|
| `SDF_PX_SIZE` | 64 | Rasterization size for each glyph SDF/MSDF |
| `DEFAULT_ATLAS_SIZE` | 2048 | Initial SDF/MSDF atlas dimensions (2048²) |
| `DEFAULT_COLOR_ATLAS_SIZE` | 1024 | Initial COLRv1 color atlas dimensions (1024²) |
| `MAX_ATLAS_SIZE` | 8192 | Hard cap on atlas growth (doubling per step) |

Eviction has no frame/tick constant — it is purely reference counted by label
visibility (see step 5).
