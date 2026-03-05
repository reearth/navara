# navara_font

SDF text rendering pipeline for Navara. Handles font loading, text shaping, and glyph atlas management.

## Pipeline Overview

```
Font file (.ttf/.otf)
        |
        v
  +-----------+     +-----------+     +-------------+
  | rustybuzz |---->| fontsdf   |---->| guillotiere |
  | (shaping) |     | (SDF      |     | (atlas      |
  |           |     |  rasterize)|    |  packing)   |
  +-----------+     +-----------+     +-------------+
        |                                    |
        v                                    v
  ShapedGlyph[]                     SDF Atlas (R8 texture)
  (glyph IDs +                     (glyph positions +
   advances/offsets)                 pixel data)
        |                                    |
        +------ sent to TypeScript ----------+
                        |
                        v
              Instanced billboard quads
              (one quad per glyph, sampled
               from the shared atlas)
```

## How It Works

1. **Font Loading** — Font bytes are stored in `FontCache`. Each font gets its own `FontEntry` with a parsed `fontsdf::Font` and a dedicated `SDFAtlas`.

2. **Text Shaping** — `rustybuzz` (Rust port of HarfBuzz) takes a string and produces `ShapedGlyph`s: glyph IDs with advance/offset values in font units. This handles complex scripts (Arabic, CJK, ligatures).

3. **SDF Rasterization** — For each new glyph ID, `fontsdf` rasterizes a signed distance field at `SDF_PX_SIZE` (64px). The single-channel SDF encodes distance to the glyph edge, allowing sharp rendering at any scale.

4. **Atlas Packing** — `guillotiere` packs SDF bitmaps into a shared atlas texture (2048x2048 R8). Glyphs are tracked by LRU timestamps and evicted after 120 unused frames to reclaim space.

5. **Rendering** (TypeScript side) — Each text label is an `InstancedBufferGeometry` with one quad per glyph. The vertex shader positions quads using shaping data; the fragment shader samples the atlas and applies SDF thresholding for crisp edges, outlines, and backgrounds.

## Modules

| Module | Purpose |
|---|---|
| `resource.rs` | `FontCache`, `FontEntry`, `SDFAtlas`, `GlyphMetrics` — data structures and constants |
| `shaping.rs` | `shape_text()` — rustybuzz text shaping, returns positioned glyphs |
| `atlas.rs` | `ensure_glyphs_in_atlas()` — SDF rasterization, atlas packing, LRU eviction |

## Key Constants

| Constant | Value | Purpose |
|---|---|---|
| `SDF_PX_SIZE` | 64 | Rasterization size for each glyph SDF |
| `DEFAULT_ATLAS_SIZE` | 2048 | Atlas texture dimensions (2048x2048) |
| `LRU_MIN_AGE` | 120 | Frames before an unused glyph can be evicted |
