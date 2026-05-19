//! Shared GPU buffer manager for COLRv1 color glyphs.
//!
//! Plays the role [`crate::color_atlas::ColorAtlas`] plays for the old RGBA
//! rasterized pipeline. Three parallel buffers:
//!
//! - `layer_headers` — fixed-size record per color layer
//!   ([`crate::curves::LAYER_HEADER_U32S`] u32, see
//!   [`crate::curves::color_pack`])
//! - `paint_params` — variable f32 blob, layout depends on the layer's
//!   PaintTag (solid / linear / radial / sweep)
//! - `clip_records` — fixed-size clip record
//!   ([`crate::curves::CLIP_RECORD_U32S`] u32 each)
//!
//! Linkage to [`crate::curve_atlas::CurveAtlas`]: each color glyph occupies
//! one or more *contiguous* layer slots; its glyph-local
//! `paint_params_offset` / `clip_records_offset` are biased to the global
//! offsets at insert time. The outline atlas records the
//! `[layer_start, layer_start + layer_count)` range on the color glyph's
//! header. Clip glyph references inside each layer point at GIDs which must
//! already exist in [`CurveAtlas`] — `ensure_color_glyphs` walks the
//! dependency tree and recursively populates the outline atlas first.

use crate::curve_atlas::{CurveAtlas, FreeList, composite_key};
use crate::curves::{
    CLIP_RECORD_U32S, ColorGlyph, LAYER_HEADER_U32S, PackedColorGlyph, extract_color_glyph,
    pack_color_glyph,
};
use rustc_hash::FxHashMap;
use skrifa::{GlyphId, prelude::FontRef};
use std::ops::Range;

/// Initial buffer capacities. Sized for a few hundred typical emoji glyphs.
pub const INITIAL_LAYER_CAPACITY: u32 = 1024 * LAYER_HEADER_U32S as u32;
pub const INITIAL_PAINT_CAPACITY: u32 = 16 * 1024;
pub const INITIAL_CLIP_CAPACITY: u32 = 1024 * CLIP_RECORD_U32S as u32;

/// Per-color-glyph allocation record. Tracks the buffer ranges so eviction
/// can free them later.
#[derive(Clone, Debug)]
pub struct ColorGlyphRecord {
    /// First layer header index (in *layer slots*, i.e. each slot is
    /// [`LAYER_HEADER_U32S`] u32s).
    pub layer_start: u32,
    pub layer_count: u32,
    /// Offset into `paint_params` (in f32 elements) and total length.
    pub paint_offset: u32,
    pub paint_count: u32,
    /// Offset into `clip_records` (in *clip slots*) and total clip count.
    pub clip_offset: u32,
    pub clip_count: u32,
}

#[derive(Clone, Debug, Default)]
pub struct ColorDirtyRanges {
    pub layer_headers: Option<Range<u32>>,
    pub paint_params: Option<Range<u32>>,
    pub clip_records: Option<Range<u32>>,
}

#[derive(Clone, Debug)]
pub struct ColorCurveAtlas {
    pub layer_headers: Vec<u32>,
    pub paint_params: Vec<f32>,
    pub clip_records: Vec<u32>,

    layer_alloc: FreeList,
    paint_alloc: FreeList,
    clip_alloc: FreeList,

    glyph_map: FxHashMap<u64, ColorGlyphRecord>,
    last_used: FxHashMap<u64, u64>,

    dirty_layer_headers: Option<Range<u32>>,
    dirty_paint_params: Option<Range<u32>>,
    dirty_clip_records: Option<Range<u32>>,
}

impl Default for ColorCurveAtlas {
    fn default() -> Self {
        Self::new()
    }
}

impl ColorCurveAtlas {
    pub fn new() -> Self {
        Self {
            layer_headers: vec![0; INITIAL_LAYER_CAPACITY as usize],
            paint_params: vec![0.0; INITIAL_PAINT_CAPACITY as usize],
            clip_records: vec![0; INITIAL_CLIP_CAPACITY as usize],
            layer_alloc: FreeList::new(INITIAL_LAYER_CAPACITY / LAYER_HEADER_U32S as u32),
            paint_alloc: FreeList::new(INITIAL_PAINT_CAPACITY),
            clip_alloc: FreeList::new(INITIAL_CLIP_CAPACITY / CLIP_RECORD_U32S as u32),
            glyph_map: FxHashMap::default(),
            last_used: FxHashMap::default(),
            dirty_layer_headers: None,
            dirty_paint_params: None,
            dirty_clip_records: None,
        }
    }

    pub fn contains(&self, key: u64) -> bool {
        self.glyph_map.contains_key(&key)
    }

    pub fn get_record(&self, key: u64) -> Option<&ColorGlyphRecord> {
        self.glyph_map.get(&key)
    }

    pub fn touch(&mut self, key: u64, current_frame: u64) {
        self.last_used.insert(key, current_frame);
    }

    pub fn take_dirty_ranges(&mut self) -> ColorDirtyRanges {
        ColorDirtyRanges {
            layer_headers: self.dirty_layer_headers.take(),
            paint_params: self.dirty_paint_params.take(),
            clip_records: self.dirty_clip_records.take(),
        }
    }

    /// Ensure each color glyph in `glyph_ids` is in this atlas. The matching
    /// outline glyphs (the color glyph itself plus every clip-glyph reference
    /// inside its paint graph) are inserted into `outline_atlas` first, and
    /// the outline glyph's header is updated with the
    /// `color_layer_start` / `color_layer_count` linkage.
    ///
    /// Returns `true` if any new color glyph was added to either atlas.
    pub fn ensure_color_glyphs(
        &mut self,
        outline_atlas: &mut CurveAtlas,
        font: &FontRef<'_>,
        font_index: u32,
        glyph_ids: &[u32],
        current_frame: u64,
    ) -> bool {
        let mut changed = false;
        for &gid in glyph_ids {
            let key = composite_key(font_index, gid);
            self.touch(key, current_frame);
            outline_atlas.touch(key, current_frame);
            if self.contains(key) {
                // Already inserted earlier in this run — only need to make
                // sure the outline atlas still has it.
                if !outline_atlas.contains(key)
                    && outline_atlas.ensure_glyphs(font, font_index, &[gid], current_frame)
                {
                    changed = true;
                }
                continue;
            }
            if self.try_insert(outline_atlas, font, font_index, gid, current_frame) {
                changed = true;
            }
        }
        changed
    }

    fn try_insert(
        &mut self,
        outline_atlas: &mut CurveAtlas,
        font: &FontRef<'_>,
        font_index: u32,
        gid: u32,
        current_frame: u64,
    ) -> bool {
        let glyph: ColorGlyph = match extract_color_glyph(font, GlyphId::new(gid)) {
            Some(g) => g,
            None => return false,
        };
        if glyph.layers.is_empty() {
            return false;
        }

        // 1. Make sure every clip-glyph GID has an outline entry first; the
        //    fragment shader dereferences these by header slot, and an
        //    in-flight color glyph that points at an absent outline would
        //    sample garbage.
        let mut clip_gids: Vec<u32> = glyph
            .layers
            .iter()
            .flat_map(|l| l.clips.iter().filter_map(clip_gid))
            .collect();
        clip_gids.sort_unstable();
        clip_gids.dedup();
        outline_atlas.ensure_glyphs(font, font_index, &clip_gids, current_frame);

        // 2. Pack and splice into the color buffers.
        let packed: PackedColorGlyph = pack_color_glyph(&glyph);
        let Some(record) = self.insert_packed(&packed, current_frame) else {
            return false;
        };

        // 3. The color glyph itself also needs an outline-atlas entry so the
        //    vertex shader can read a non-degenerate bbox for its quad and
        //    `bind_color_layers` has somewhere to write the flag. Most COLR
        //    emoji base glyphs have no monochrome outline of their own —
        //    `ensure_glyphs` skips those — so we insert a stub PackedGlyph
        //    using the COLR `clip_box` (or a unit-em fallback) as the bbox
        //    and no curves. The fragment shader's COLR path doesn't read
        //    the bands/curves for this slot, only the bbox and flag/range.
        let key = composite_key(font_index, gid);
        if !outline_atlas.contains(key) {
            let (bb_min, bb_max) = packed.clip_box.unwrap_or(([0.0, 0.0], [1.0, 1.0]));
            let mut header = [0.0f32; crate::curves::HEADER_F32_COUNT];
            header[crate::curves::HEADER_BBOX_MIN] = bb_min[0];
            header[crate::curves::HEADER_BBOX_MIN + 1] = bb_min[1];
            header[crate::curves::HEADER_BBOX_MAX] = bb_max[0];
            header[crate::curves::HEADER_BBOX_MAX + 1] = bb_max[1];
            // band_count = 0 → fragment shader's monochrome coverage path
            // returns 0 instantly; only the COLR path uses this slot.
            let stub = crate::curves::PackedGlyph {
                header,
                ..Default::default()
            };
            if !outline_atlas.insert_packed(font_index, gid, &stub, current_frame) {
                return false;
            }
        }

        // 4. Translate clip-glyph GIDs to outline-atlas header slots so the
        //    fragment shader can dereference them directly. Phase 2's pack
        //    format stores GIDs (it doesn't know about the outline atlas);
        //    we rewrite each glyph-clip record's gid field to the
        //    corresponding header_slot now that we've ensured the outlines.
        self.translate_clip_gids_to_slots(&record, outline_atlas, font_index);

        // 5. Bind the color layer range onto the outline glyph's header.
        outline_atlas.bind_color_layers(key, record.layer_start, record.layer_count);

        self.glyph_map.insert(key, record);
        self.last_used.insert(key, current_frame);
        true
    }

    /// Sentinel written into a clip record's slot field when the referenced
    /// glyph has no outline in the atlas (e.g. notdef / blank glyphs). The
    /// fragment shader treats this as "no clip" (clip passes everywhere).
    pub const MISSING_CLIP_SLOT: u32 = u32::MAX;

    fn translate_clip_gids_to_slots(
        &mut self,
        record: &ColorGlyphRecord,
        outline_atlas: &CurveAtlas,
        font_index: u32,
    ) {
        if record.clip_count == 0 {
            return;
        }
        let start = record.clip_offset as usize * CLIP_RECORD_U32S;
        let end = start + record.clip_count as usize * CLIP_RECORD_U32S;
        let mut dirtied = false;
        for slot in (start..end).step_by(CLIP_RECORD_U32S) {
            // Layout per [crate::curves::color_pack]:
            //   [0] = clip kind tag (0 = Glyph, 1 = Rect)
            //   [1] = gid (for Glyph) or min.x bits (for Rect)
            let tag = self.clip_records[slot];
            if tag != 0 {
                continue; // Not a glyph clip — nothing to translate.
            }
            let gid = self.clip_records[slot + 1];
            let new_slot = outline_atlas
                .get_record(composite_key(font_index, gid))
                .map(|r| r.header_slot)
                .unwrap_or(Self::MISSING_CLIP_SLOT);
            if self.clip_records[slot + 1] != new_slot {
                self.clip_records[slot + 1] = new_slot;
                dirtied = true;
            }
        }
        if dirtied {
            Self::touch_range(&mut self.dirty_clip_records, start as u32..end as u32);
        }
    }

    fn insert_packed(
        &mut self,
        packed: &PackedColorGlyph,
        current_frame: u64,
    ) -> Option<ColorGlyphRecord> {
        let layer_count = (packed.layer_headers.len() / LAYER_HEADER_U32S) as u32;
        let paint_count = packed.paint_params.len() as u32;
        let clip_count = (packed.clip_records.len() / CLIP_RECORD_U32S) as u32;

        let layer_start = self.alloc_with_growth(AllocKind::Layer, layer_count, current_frame)?;
        let paint_offset =
            match self.alloc_with_growth(AllocKind::Paint, paint_count, current_frame) {
                Some(o) => o,
                None => {
                    self.layer_alloc.free(layer_start, layer_count);
                    return None;
                }
            };
        let clip_offset = match self.alloc_with_growth(AllocKind::Clip, clip_count, current_frame) {
            Some(o) => o,
            None => {
                self.paint_alloc.free(paint_offset, paint_count);
                self.layer_alloc.free(layer_start, layer_count);
                return None;
            }
        };

        // -- Layer headers: copy verbatim, then rebase paint_offset and
        //    clip_offset in each header to point at the *global* buffers.
        let layer_byte_start = layer_start as usize * LAYER_HEADER_U32S;
        for i in 0..layer_count as usize {
            let src = i * LAYER_HEADER_U32S;
            let dst = layer_byte_start + src;
            self.layer_headers[dst..dst + LAYER_HEADER_U32S]
                .copy_from_slice(&packed.layer_headers[src..src + LAYER_HEADER_U32S]);
            // Slot offsets within one layer header (see color_pack.rs):
            //   [7] paint_offset (glyph-local f32 index)
            //   [8] paint_count  (unchanged)
            //   [9] clip_offset  (glyph-local clip slot index)
            //   [10] clip_count  (unchanged)
            self.layer_headers[dst + 7] += paint_offset;
            self.layer_headers[dst + 9] += clip_offset;
        }
        let layer_dirty_end = (layer_byte_start + layer_count as usize * LAYER_HEADER_U32S) as u32;
        Self::touch_range(
            &mut self.dirty_layer_headers,
            layer_byte_start as u32..layer_dirty_end,
        );

        // -- Paint params: copy raw.
        if paint_count > 0 {
            let start = paint_offset as usize;
            let end = start + paint_count as usize;
            self.paint_params[start..end].copy_from_slice(&packed.paint_params);
            Self::touch_range(&mut self.dirty_paint_params, start as u32..end as u32);
        }

        // -- Clip records: copy raw.
        if clip_count > 0 {
            let start = clip_offset as usize * CLIP_RECORD_U32S;
            let end = start + clip_count as usize * CLIP_RECORD_U32S;
            self.clip_records[start..end].copy_from_slice(&packed.clip_records);
            Self::touch_range(&mut self.dirty_clip_records, start as u32..end as u32);
        }

        Some(ColorGlyphRecord {
            layer_start,
            layer_count,
            paint_offset,
            paint_count,
            clip_offset,
            clip_count,
        })
    }

    /// Remove a color glyph and free its buffer ranges. Returns `true` if the
    /// glyph was present. The caller is responsible for also unbinding the
    /// outline atlas via [`CurveAtlas::clear_color_layers`].
    pub fn remove(&mut self, key: u64) -> bool {
        let Some(record) = self.glyph_map.remove(&key) else {
            return false;
        };
        self.last_used.remove(&key);
        self.layer_alloc
            .free(record.layer_start, record.layer_count);
        self.paint_alloc
            .free(record.paint_offset, record.paint_count);
        self.clip_alloc.free(record.clip_offset, record.clip_count);

        // Zero the layer headers so a stale lookup yields a no-op layer
        // (layer_count is zero in the glyph header, but we keep the buffer
        // tidy anyway).
        let start = record.layer_start as usize * LAYER_HEADER_U32S;
        let end = start + record.layer_count as usize * LAYER_HEADER_U32S;
        for v in &mut self.layer_headers[start..end] {
            *v = 0;
        }
        Self::touch_range(&mut self.dirty_layer_headers, start as u32..end as u32);
        true
    }

    /// Evict color glyphs older than `min_age` frames. The caller is
    /// responsible for clearing matching `CurveAtlas` color-layer bindings —
    /// pass the eviction list through `for_each_evicted`.
    pub fn evict_cold(
        &mut self,
        current_frame: u64,
        min_age: u64,
        mut for_each_evicted: impl FnMut(u64),
    ) {
        let cold: Vec<u64> = self
            .last_used
            .iter()
            .filter_map(|(&k, &t)| {
                if current_frame.saturating_sub(t) >= min_age {
                    Some(k)
                } else {
                    None
                }
            })
            .collect();
        for k in cold {
            if self.remove(k) {
                for_each_evicted(k);
            }
        }
    }

    fn alloc_with_growth(
        &mut self,
        kind: AllocKind,
        size: u32,
        _current_frame: u64,
    ) -> Option<u32> {
        if size == 0 {
            return Some(0);
        }
        if let Some(off) = self.alloc(kind, size) {
            return Some(off);
        }
        // Color-atlas eviction needs to also unbind from the outline atlas, so
        // we can't safely do it here without a back-reference. The caller's
        // `ensure_color_glyphs` runs eviction explicitly via `evict_cold` —
        // this path just grows.
        let cur = self.capacity(kind);
        let growth = (cur / 2).max(size).max(1024);
        self.grow(kind, growth);
        self.alloc(kind, size)
    }

    fn alloc(&mut self, kind: AllocKind, size: u32) -> Option<u32> {
        match kind {
            AllocKind::Layer => self.layer_alloc.alloc(size),
            AllocKind::Paint => self.paint_alloc.alloc(size),
            AllocKind::Clip => self.clip_alloc.alloc(size),
        }
    }

    fn capacity(&self, kind: AllocKind) -> u32 {
        match kind {
            AllocKind::Layer => self.layer_alloc.capacity(),
            AllocKind::Paint => self.paint_alloc.capacity(),
            AllocKind::Clip => self.clip_alloc.capacity(),
        }
    }

    fn grow(&mut self, kind: AllocKind, additional: u32) {
        match kind {
            AllocKind::Layer => {
                self.layer_alloc.grow(additional);
                let new_len = self.layer_alloc.capacity() as usize * LAYER_HEADER_U32S;
                self.layer_headers.resize(new_len, 0);
                self.dirty_layer_headers = Some(0..new_len as u32);
            }
            AllocKind::Paint => {
                self.paint_alloc.grow(additional);
                let new_len = self.paint_alloc.capacity() as usize;
                self.paint_params.resize(new_len, 0.0);
                self.dirty_paint_params = Some(0..new_len as u32);
            }
            AllocKind::Clip => {
                self.clip_alloc.grow(additional);
                let new_len = self.clip_alloc.capacity() as usize * CLIP_RECORD_U32S;
                self.clip_records.resize(new_len, 0);
                self.dirty_clip_records = Some(0..new_len as u32);
            }
        }
    }

    fn touch_range(slot: &mut Option<Range<u32>>, range: Range<u32>) {
        match slot {
            Some(existing) => {
                existing.start = existing.start.min(range.start);
                existing.end = existing.end.max(range.end);
            }
            None => *slot = Some(range),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum AllocKind {
    Layer,
    Paint,
    Clip,
}

fn clip_gid(clip: &crate::curves::ClipShape) -> Option<u32> {
    match clip {
        crate::curves::ClipShape::Glyph { gid, .. } => Some(*gid),
        crate::curves::ClipShape::Rect { .. } => None,
    }
}

/// Frame-end housekeeping: evict cold color glyphs and clear their bindings
/// on the matching outline atlas. The combined call is provided here so the
/// invariant "outline glyph has color binding ⇔ ColorCurveAtlas has the
/// record" survives eviction.
pub fn evict_cold_pair(
    color_atlas: &mut ColorCurveAtlas,
    outline_atlas: &mut CurveAtlas,
    current_frame: u64,
    min_age: u64,
) {
    color_atlas.evict_cold(current_frame, min_age, |key| {
        outline_atlas.clear_color_layers(key);
    });
    outline_atlas.evict_cold(current_frame, min_age);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cache::LRU_MIN_AGE;
    use crate::curves::{
        BlendKind, ClipShape, ColorGlyph, ColorLayer, PackedColorGlyph, PaintKind,
    };

    fn solid_glyph(rgba: [f32; 4], clip_gids: Vec<u32>) -> ColorGlyph {
        ColorGlyph {
            layers: vec![ColorLayer {
                clips: clip_gids
                    .into_iter()
                    .map(|gid| ClipShape::Glyph {
                        gid,
                        transform: [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
                    })
                    .collect(),
                transform: [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
                paint: PaintKind::Solid { rgba },
                blend: BlendKind::SrcOver,
            }],
            clip_box: None,
            units_per_em: 1000,
        }
    }

    fn pack(glyph: &ColorGlyph) -> PackedColorGlyph {
        pack_color_glyph(glyph)
    }

    #[test]
    fn insert_writes_layer_count_to_record() {
        let mut color = ColorCurveAtlas::new();
        let glyph = solid_glyph([1.0, 0.0, 0.0, 1.0], vec![]);
        let packed = pack(&glyph);
        let record = color.insert_packed(&packed, 0).unwrap();
        assert_eq!(record.layer_count, 1);
        assert_eq!(record.paint_count as usize, packed.paint_params.len());
        assert_eq!(record.clip_count, 0);
    }

    #[test]
    fn paint_offset_in_header_is_rebased() {
        let mut color = ColorCurveAtlas::new();

        // First insert: paint_offset 0.
        let g1 = solid_glyph([1.0, 0.0, 0.0, 1.0], vec![]);
        let r1 = color.insert_packed(&pack(&g1), 0).unwrap();
        let h1 = r1.layer_start as usize * LAYER_HEADER_U32S;
        // Layer header slot [7] holds the rebased paint_offset.
        assert_eq!(color.layer_headers[h1 + 7], r1.paint_offset);

        // Second insert: paint_offset > 0.
        let g2 = solid_glyph([0.0, 1.0, 0.0, 1.0], vec![]);
        let r2 = color.insert_packed(&pack(&g2), 0).unwrap();
        let h2 = r2.layer_start as usize * LAYER_HEADER_U32S;
        assert!(r2.paint_offset > 0);
        assert_eq!(color.layer_headers[h2 + 7], r2.paint_offset);
    }

    #[test]
    fn ensure_color_glyphs_binds_outline_header() {
        // The COLRv1 fixture is loaded via the integration test crate;
        // here we just exercise the bookkeeping with a hand-built glyph.
        let mut outline = CurveAtlas::new();
        let mut color = ColorCurveAtlas::new();

        // Hand-insert a placeholder outline entry for GID 1 so
        // bind_color_layers has something to flip.
        let packed_outline = crate::curves::PackedGlyph {
            bands: vec![0],
            band_curves: vec![],
            curves: vec![],
            ..Default::default()
        };
        let _ = outline.insert_packed(0, 1, &packed_outline, 0);

        // Hand-insert color record + bind manually (mimics the
        // ensure_color_glyphs flow).
        let glyph = solid_glyph([0.0, 0.0, 1.0, 1.0], vec![]);
        let record = color.insert_packed(&pack(&glyph), 0).unwrap();
        let key = composite_key(0, 1);
        outline.bind_color_layers(key, record.layer_start, record.layer_count);

        let outline_record = outline.get_record(key).unwrap();
        let h = outline_record.header_slot as usize * crate::curves::HEADER_F32_COUNT;
        let flags = outline.glyph_headers[h + crate::curves::HEADER_FLAGS] as u32;
        assert!(flags & crate::curves::FLAG_HAS_COLOR_LAYERS != 0);
        assert_eq!(
            outline.glyph_headers[h + crate::curves::HEADER_COLOR_LAYER_START] as u32,
            record.layer_start,
        );
    }

    #[test]
    fn evict_cold_pair_clears_outline_binding() {
        let mut outline = CurveAtlas::new();
        let mut color = ColorCurveAtlas::new();

        // Insert outline + color for GID 1 at frame 0.
        let packed_outline = crate::curves::PackedGlyph {
            bands: vec![0],
            ..Default::default()
        };
        let _ = outline.insert_packed(0, 1, &packed_outline, 0);
        let record = color
            .insert_packed(&pack(&solid_glyph([1.0; 4], vec![])), 0)
            .unwrap();
        let key = composite_key(0, 1);
        color.glyph_map.insert(key, record.clone());
        color.last_used.insert(key, 0);
        outline.bind_color_layers(key, record.layer_start, record.layer_count);

        // Evict after enough frames.
        evict_cold_pair(&mut color, &mut outline, LRU_MIN_AGE + 1, LRU_MIN_AGE);

        assert!(
            !color.contains(key),
            "color record should have been evicted"
        );
        // Outline atlas evicts its own glyphs too — but the key invariant we
        // care about is that no stale color-layer binding leaks: if the
        // outline record is gone the flag is moot, and if it lingers the
        // flag must be cleared.
        if let Some(rec) = outline.get_record(key) {
            let h = rec.header_slot as usize * crate::curves::HEADER_F32_COUNT;
            let flags = outline.glyph_headers[h + crate::curves::HEADER_FLAGS] as u32;
            assert_eq!(
                flags & crate::curves::FLAG_HAS_COLOR_LAYERS,
                0,
                "outline still flagged as having color layers after eviction",
            );
        }
    }
}
