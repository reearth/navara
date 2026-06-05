---
name: font-atlas-refcount
description: How font-atlas glyph residency / Rust↔TS sync must work in navara_wasm_font_worker
metadata:
  type: feedback
---

For the font glyph atlas (`crates/navara_wasm_font_worker` + `web/navara_font`), glyph
residency must be **visibility-driven reference counting**, NOT a tick/age LRU.

- A glyph's atlas `ref_count` = number of currently-**visible** labels using it.
- A label (`SDFTextMesh`) increments its glyphs' refcounts when it becomes visible and
  decrements when it hides or is disposed (driven from `markVisibility` / `_setFeatureShow`).
- A glyph with `ref_count == 0` is unreferenced and may be evicted; visible glyphs
  (`>= 1`) are never evicted, so on-screen labels never go stale.
- Eviction is lazy (only in `ensure_glyphs_in_atlas` under atlas pressure) and frees
  unreferenced glyphs. The worker reports a single `evicted: bool`; TS bumps a per-atlas
  **generation counter** (`_atlasGeneration`). Cached shape results carry the generation
  they were built under, so `isTextPrepared` treats pre-eviction results as stale and
  re-shapes them on next show. (An earlier draft used a precise reverse index
  glyph→entries; the generation counter replaced it as a simpler, more future-proof
  equivalent — over-invalidation is harmless because visible glyphs are never evicted.)

**Why:** the old tick LRU (`last_used`, `LRU_MIN_AGE`, `FontCache::tick`) evicted glyphs
that were still on screen — TS shapes each text once and never re-touches it, so a static
label went "cold" and its glyphs were freed, rendering the wrong character. The user
explicitly rejected a shape-cache-tied pinning approach and the tick clock.

**How to apply:** never reintroduce a tick/age clock for the font atlas. Keep refcounts
balanced (retain/release per visible mesh; release on dispose/text-change/font-change).
Eviction is lazy (on atlas-pressure in `ensure_glyphs_in_atlas`), protecting glyphs added
in the current shaping call. Done on branch `fix/atlasSync` (2026-06-05).
