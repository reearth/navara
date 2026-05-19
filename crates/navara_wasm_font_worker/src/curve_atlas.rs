//! Shared GPU buffer manager for the Slug-style outline pipeline.
//!
//! Plays the role [`crate::atlas::SDFAtlas`] does for the old SDF pipeline:
//! it owns the buffers that hold glyph data, allocates space for each
//! requested glyph on demand, evicts cold glyphs under LRU, and tells the JS
//! side which byte ranges changed this frame so uploads can be incremental.
//!
//! Four parallel buffers per atlas key:
//!
//! - `glyph_headers` — fixed-size slot per glyph
//!   (`HEADER_F32_COUNT` f32, see [`crate::curves::pack`])
//! - `band_data` — one u32 per band entry, variable length per glyph
//! - `band_curves` — one u32 per band-curves entry, variable length per glyph
//!   (stored as u32 even though only the low 16 bits are used, so the GPU side
//!   can read with a single `texelFetch` against an R32UI texture)
//! - `curve_data` — `CURVE_F32_COUNT` f32 per quadratic Bezier, variable length
//!
//! Allocation:
//!
//! - `glyph_headers` uses a slot allocator with a free list of slot indices.
//!   Each glyph occupies exactly one slot.
//! - The three variable buffers use a [`FreeList`] first-fit allocator. The
//!   buffers grow when an allocation can't be satisfied even after eviction.
//!
//! Dirty range tracking: each buffer records the byte range that was touched
//! since the last `take_dirty_ranges()` call. JS uploads just that range.
//! When the buffer grows the dirty range expands to cover the whole new
//! buffer (since `Vec::resize` may relocate the backing allocation, and the
//! JS texture has to be reallocated anyway).

use crate::cache::LRU_MIN_AGE;
use crate::curves::{
    BAND_COUNT_DEFAULT, GlyphOutline, HEADER_BAND_CURVES_OFFSET, HEADER_BANDS_OFFSET,
    HEADER_COLOR_LAYER_COUNT, HEADER_COLOR_LAYER_START, HEADER_CURVES_OFFSET, HEADER_F32_COUNT,
    HEADER_FLAGS, PackedGlyph, build_bands, extract_glyph_outline, pack_glyph,
};
use rustc_hash::FxHashMap;
use skrifa::{GlyphId, prelude::FontRef};
use std::ops::Range;

// ---------------------------------------------------------------------------
// FreeList — first-fit allocator over a flat 1D buffer.
// ---------------------------------------------------------------------------

/// First-fit free-list allocator. Operates over element indices, not bytes —
/// the caller decides what an element is (a `u32`, an `f32`, a header slot).
#[derive(Clone, Debug)]
pub struct FreeList {
    /// Free ranges, sorted by start, never overlapping, never empty.
    free: Vec<Range<u32>>,
    capacity: u32,
}

impl FreeList {
    pub fn new(capacity: u32) -> Self {
        let mut free = Vec::with_capacity(4);
        if capacity > 0 {
            free.push(0..capacity);
        }
        Self { free, capacity }
    }

    pub fn capacity(&self) -> u32 {
        self.capacity
    }

    /// Try to allocate `size` contiguous elements. Returns the starting index
    /// or `None` if no free range is large enough.
    pub fn alloc(&mut self, size: u32) -> Option<u32> {
        if size == 0 {
            // Zero-size allocations get a placeholder offset at the start. The
            // caller still needs an offset to record in the glyph header so
            // free() can clean up symmetrically.
            return Some(0);
        }
        for i in 0..self.free.len() {
            let len = self.free[i].end - self.free[i].start;
            if len >= size {
                let offset = self.free[i].start;
                self.free[i].start += size;
                if self.free[i].is_empty() {
                    self.free.remove(i);
                }
                return Some(offset);
            }
        }
        None
    }

    /// Return `size` elements at `offset` to the pool, merging with any
    /// adjacent free range.
    pub fn free(&mut self, offset: u32, size: u32) {
        if size == 0 {
            return;
        }
        let end = offset + size;
        let pos = self.free.partition_point(|r| r.start < offset);
        // Sanity: the new range must not overlap a neighbour.
        debug_assert!(
            pos == 0 || self.free[pos - 1].end <= offset,
            "double free or overlapping free at offset {offset}",
        );
        debug_assert!(
            pos == self.free.len() || self.free[pos].start >= end,
            "double free or overlapping free at offset {offset}",
        );
        self.free.insert(pos, offset..end);

        // Merge with the previous range if adjacent.
        if pos > 0 && self.free[pos - 1].end == self.free[pos].start {
            self.free[pos - 1].end = self.free[pos].end;
            self.free.remove(pos);
        }
        // After the potential merge above, `pos` may now point at the merged
        // entry — recompute the index we want to test against.
        let merged_idx = if pos > 0 && pos <= self.free.len() {
            (pos - 1).min(self.free.len().saturating_sub(1))
        } else {
            pos
        };
        if merged_idx + 1 < self.free.len()
            && self.free[merged_idx].end == self.free[merged_idx + 1].start
        {
            self.free[merged_idx].end = self.free[merged_idx + 1].end;
            self.free.remove(merged_idx + 1);
        }
    }

    /// Append `additional` free elements to the end of the pool, growing the
    /// total capacity. Merges with the trailing free range when possible.
    pub fn grow(&mut self, additional: u32) {
        if additional == 0 {
            return;
        }
        let new_capacity = self.capacity + additional;
        match self.free.last_mut() {
            Some(last) if last.end == self.capacity => {
                last.end = new_capacity;
            }
            _ => {
                self.free.push(self.capacity..new_capacity);
            }
        }
        self.capacity = new_capacity;
    }
}

// ---------------------------------------------------------------------------
// CurveAtlas — shared buffers + per-glyph records + LRU.
// ---------------------------------------------------------------------------

/// Initial capacity (in elements) for each buffer. Picked so that a typical
/// page of running text fits without grow events; not a hard cap (the buffer
/// grows on demand).
pub const INITIAL_HEADER_SLOTS: u32 = 512;
pub const INITIAL_BAND_CAPACITY: u32 = 4 * 1024;
pub const INITIAL_BAND_CURVES_CAPACITY: u32 = 8 * 1024;
pub const INITIAL_CURVE_CAPACITY: u32 = 64 * 1024;

/// Composite (font_index, glyph_id) key — matches [`crate::atlas::composite_key`].
pub use crate::atlas::composite_key;

/// Cached glyph record. Indexes into the four buffers.
#[derive(Clone, Debug)]
pub struct CurveGlyphRecord {
    /// Slot in `glyph_headers`. Multiply by `HEADER_F32_COUNT` for the f32
    /// offset; the slot itself is what the vertex shader receives as the
    /// glyph's GPU id.
    pub header_slot: u32,
    pub bands_offset: u32,
    pub bands_count: u32,
    pub band_curves_offset: u32,
    pub band_curves_count: u32,
    pub curves_offset: u32,
    pub curves_count: u32,
}

/// Dirty byte ranges since the last drain. Empty ranges mean no upload is
/// needed for that buffer.
#[derive(Clone, Debug, Default)]
pub struct DirtyRanges {
    pub headers: Option<Range<u32>>,
    pub bands: Option<Range<u32>>,
    pub band_curves: Option<Range<u32>>,
    pub curves: Option<Range<u32>>,
}

/// Shared GPU buffer manager for one atlas key (font family or standalone).
#[derive(Clone, Debug)]
pub struct CurveAtlas {
    // -- Backing storage. Each buffer is one element-array; element size is
    //    fixed per buffer (see the module doc).
    pub glyph_headers: Vec<f32>,
    pub band_data: Vec<u32>,
    pub band_curves: Vec<u32>,
    pub curve_data: Vec<f32>,

    // -- Allocators.
    /// Slot allocator for `glyph_headers`. Each entry is one slot index; one
    /// slot occupies `HEADER_F32_COUNT` consecutive f32s.
    header_slots: FreeList,
    band_alloc: FreeList,
    band_curves_alloc: FreeList,
    curve_alloc: FreeList,

    // -- Per-glyph metadata.
    glyph_map: FxHashMap<u64, CurveGlyphRecord>,
    last_used: FxHashMap<u64, u64>,

    // -- Dirty tracking. We record the min/max touched index per buffer;
    //    `take_dirty_ranges()` drains and resets.
    dirty_headers: Option<Range<u32>>,
    dirty_bands: Option<Range<u32>>,
    dirty_band_curves: Option<Range<u32>>,
    dirty_curves: Option<Range<u32>>,
}

impl Default for CurveAtlas {
    fn default() -> Self {
        Self::new()
    }
}

impl CurveAtlas {
    pub fn new() -> Self {
        let headers_capacity = INITIAL_HEADER_SLOTS as usize * HEADER_F32_COUNT;
        Self {
            glyph_headers: vec![0.0; headers_capacity],
            band_data: vec![0; INITIAL_BAND_CAPACITY as usize],
            band_curves: vec![0; INITIAL_BAND_CURVES_CAPACITY as usize],
            curve_data: vec![0.0; INITIAL_CURVE_CAPACITY as usize],
            header_slots: FreeList::new(INITIAL_HEADER_SLOTS),
            band_alloc: FreeList::new(INITIAL_BAND_CAPACITY),
            band_curves_alloc: FreeList::new(INITIAL_BAND_CURVES_CAPACITY),
            curve_alloc: FreeList::new(INITIAL_CURVE_CAPACITY),
            glyph_map: FxHashMap::default(),
            last_used: FxHashMap::default(),
            dirty_headers: None,
            dirty_bands: None,
            dirty_band_curves: None,
            dirty_curves: None,
        }
    }

    pub fn contains(&self, key: u64) -> bool {
        self.glyph_map.contains_key(&key)
    }

    pub fn get_record(&self, key: u64) -> Option<&CurveGlyphRecord> {
        self.glyph_map.get(&key)
    }

    pub fn touch(&mut self, key: u64, current_frame: u64) {
        self.last_used.insert(key, current_frame);
    }

    /// Drain and reset dirty ranges. Callers upload exactly the returned
    /// ranges.
    pub fn take_dirty_ranges(&mut self) -> DirtyRanges {
        DirtyRanges {
            headers: self.dirty_headers.take(),
            bands: self.dirty_bands.take(),
            band_curves: self.dirty_band_curves.take(),
            curves: self.dirty_curves.take(),
        }
    }

    /// Force every buffer to be marked fully dirty. Useful after eviction
    /// reshuffles or in tests.
    pub fn mark_all_dirty(&mut self) {
        if !self.glyph_headers.is_empty() {
            self.dirty_headers = Some(0..self.glyph_headers.len() as u32);
        }
        if !self.band_data.is_empty() {
            self.dirty_bands = Some(0..self.band_data.len() as u32);
        }
        if !self.band_curves.is_empty() {
            self.dirty_band_curves = Some(0..self.band_curves.len() as u32);
        }
        if !self.curve_data.is_empty() {
            self.dirty_curves = Some(0..self.curve_data.len() as u32);
        }
    }

    /// Ensure each glyph in `glyph_ids` has an entry in this atlas. Returns
    /// `true` when any new glyph was added (the caller's `atlas_changed`
    /// signal). LRU timestamps are updated for every requested glyph even
    /// when it was already present.
    pub fn ensure_glyphs(
        &mut self,
        font: &FontRef<'_>,
        font_index: u32,
        glyph_ids: &[u32],
        current_frame: u64,
    ) -> bool {
        let mut changed = false;
        for &glyph_id in glyph_ids {
            let key = composite_key(font_index, glyph_id);
            self.touch(key, current_frame);
            if self.contains(key) {
                continue;
            }
            if self.try_insert(font, glyph_id, font_index, current_frame) {
                changed = true;
            }
        }
        changed
    }

    fn try_insert(
        &mut self,
        font: &FontRef<'_>,
        glyph_id: u32,
        font_index: u32,
        current_frame: u64,
    ) -> bool {
        let outline: GlyphOutline = match extract_glyph_outline(font, GlyphId::new(glyph_id)) {
            Some(o) => o,
            None => return false,
        };
        // Empty-outline glyphs (e.g. the monochrome stub for a COLRv1 emoji
        // base glyph, whose `glyf` entry has zero contours because the visible
        // content lives entirely in the COLR paint graph) carry no curves and
        // would land here with a degenerate (0,0)-(0,0) bbox — collapsing the
        // quad in the vertex shader and skipping the fragment shader's COLR
        // path entirely. Skipping the insert lets the color pipeline's
        // stub-glyph path (color_curve_atlas::try_insert) own the header for
        // these slots, using the COLR `clip_box` as a non-degenerate bbox.
        if outline.curves.is_empty() {
            return false;
        }
        let banded = build_bands(outline, BAND_COUNT_DEFAULT);
        let packed = pack_glyph(&banded);
        self.insert_packed(font_index, glyph_id, &packed, current_frame)
    }

    /// Splice a pre-packed glyph into the atlas. Used by `ensure_glyphs` for
    /// glyphs freshly extracted from a font, and by tests + the color atlas
    /// for hand-built glyphs.
    pub fn insert_packed(
        &mut self,
        font_index: u32,
        glyph_id: u32,
        packed: &PackedGlyph,
        current_frame: u64,
    ) -> bool {
        let bands_size = packed.bands.len() as u32;
        let band_curves_size = packed.band_curves.len() as u32;
        let curves_size = packed.curves.len() as u32;

        // Allocate (eviction + grow on failure).
        let header_slot = match self.alloc_header_slot(current_frame) {
            Some(s) => s,
            None => return false,
        };
        let bands_offset = match self.alloc_with_growth(AllocKind::Bands, bands_size, current_frame)
        {
            Some(o) => o,
            None => {
                self.header_slots.free(header_slot, 1);
                return false;
            }
        };
        let band_curves_offset =
            match self.alloc_with_growth(AllocKind::BandCurves, band_curves_size, current_frame) {
                Some(o) => o,
                None => {
                    self.band_alloc.free(bands_offset, bands_size);
                    self.header_slots.free(header_slot, 1);
                    return false;
                }
            };
        let curves_offset =
            match self.alloc_with_growth(AllocKind::Curves, curves_size, current_frame) {
                Some(o) => o,
                None => {
                    self.band_curves_alloc
                        .free(band_curves_offset, band_curves_size);
                    self.band_alloc.free(bands_offset, bands_size);
                    self.header_slots.free(header_slot, 1);
                    return false;
                }
            };

        // Write to backing buffers.
        // 1. Header — copy the packed header, then patch in the offsets.
        let header_start = (header_slot as usize) * HEADER_F32_COUNT;
        let header_end = header_start + HEADER_F32_COUNT;
        self.glyph_headers[header_start..header_end].copy_from_slice(&packed.header);
        self.glyph_headers[header_start + HEADER_BANDS_OFFSET] = bands_offset as f32;
        self.glyph_headers[header_start + HEADER_BAND_CURVES_OFFSET] = band_curves_offset as f32;
        self.glyph_headers[header_start + HEADER_CURVES_OFFSET] = curves_offset as f32;
        // Flags slot left as packed it (Phase 1 always zero). Phase 3 color
        // wiring sets `FLAG_HAS_COLOR_LAYERS` separately via
        // `mark_has_color_layers`.
        debug_assert_eq!(
            self.glyph_headers[header_start + HEADER_FLAGS],
            0.0,
            "Phase 1 pack should leave flags zeroed",
        );
        Self::touch_range(
            &mut self.dirty_headers,
            header_start as u32..header_end as u32,
        );

        // 2. Bands.
        let bands_start = bands_offset as usize;
        let bands_end = bands_start + bands_size as usize;
        self.band_data[bands_start..bands_end].copy_from_slice(&packed.bands);
        Self::touch_range(&mut self.dirty_bands, bands_start as u32..bands_end as u32);

        // 3. Band curves — widen u16 → u32 for the GPU texture.
        let bc_start = band_curves_offset as usize;
        let bc_end = bc_start + band_curves_size as usize;
        for (i, &v) in packed.band_curves.iter().enumerate() {
            self.band_curves[bc_start + i] = v as u32;
        }
        Self::touch_range(&mut self.dirty_band_curves, bc_start as u32..bc_end as u32);

        // 4. Curve data.
        let cv_start = curves_offset as usize;
        let cv_end = cv_start + curves_size as usize;
        self.curve_data[cv_start..cv_end].copy_from_slice(&packed.curves);
        Self::touch_range(&mut self.dirty_curves, cv_start as u32..cv_end as u32);

        // Record.
        let key = composite_key(font_index, glyph_id);
        self.glyph_map.insert(
            key,
            CurveGlyphRecord {
                header_slot,
                bands_offset,
                bands_count: bands_size,
                band_curves_offset,
                band_curves_count: band_curves_size,
                curves_offset,
                curves_count: curves_size,
            },
        );
        self.last_used.insert(key, current_frame);
        true
    }

    /// Free a glyph's allocations and zero its header slot so a stale read
    /// would land on an empty record (band_count = 0) rather than a former
    /// glyph's data.
    pub fn remove(&mut self, key: u64) -> bool {
        let Some(record) = self.glyph_map.remove(&key) else {
            return false;
        };
        self.last_used.remove(&key);
        self.header_slots.free(record.header_slot, 1);
        self.band_alloc
            .free(record.bands_offset, record.bands_count);
        self.band_curves_alloc
            .free(record.band_curves_offset, record.band_curves_count);
        self.curve_alloc
            .free(record.curves_offset, record.curves_count);

        // Zero the header so a stale shader read renders nothing.
        let header_start = record.header_slot as usize * HEADER_F32_COUNT;
        let header_end = header_start + HEADER_F32_COUNT;
        for v in &mut self.glyph_headers[header_start..header_end] {
            *v = 0.0;
        }
        Self::touch_range(
            &mut self.dirty_headers,
            header_start as u32..header_end as u32,
        );
        true
    }

    /// Bind a range of color layers to a glyph's header. Sets the
    /// `FLAG_HAS_COLOR_LAYERS` bit and writes the `[start, count)` range in
    /// the color-layer header buffer. The fragment shader uses this to switch
    /// to the COLRv1 evaluation path.
    pub fn bind_color_layers(&mut self, key: u64, start: u32, count: u32) {
        let Some(record) = self.glyph_map.get(&key) else {
            return;
        };
        let base = record.header_slot as usize * HEADER_F32_COUNT;
        let flag_idx = base + HEADER_FLAGS;
        // Store flag mask + offsets as plain `as f32` numeric values rather
        // than `f32::from_bits`. Small u32 bit patterns (1, 2, 3, ...) decode
        // as denormal floats (~1.4e-45) and ANGLE / Metal on macOS flushes
        // those to zero on register loads, which caused `floatBitsToUint`
        // to read 0 in the shader and silently bypass the COLR path. The
        // numeric path stays exact for any u32 < 2^24, which is well above
        // realistic layer-count / flag-mask values.
        let existing = self.glyph_headers[flag_idx] as u32;
        self.glyph_headers[flag_idx] = (existing | crate::curves::FLAG_HAS_COLOR_LAYERS) as f32;
        self.glyph_headers[base + HEADER_COLOR_LAYER_START] = start as f32;
        self.glyph_headers[base + HEADER_COLOR_LAYER_COUNT] = count as f32;
        Self::touch_range(
            &mut self.dirty_headers,
            base as u32 + HEADER_FLAGS as u32..base as u32 + HEADER_COLOR_LAYER_COUNT as u32 + 1,
        );
    }

    /// Clear color-layer binding from a glyph: clears the flag bit and zeroes
    /// the start/count slots so a stale shader read renders no color overlay.
    pub fn clear_color_layers(&mut self, key: u64) {
        let Some(record) = self.glyph_map.get(&key) else {
            return;
        };
        let base = record.header_slot as usize * HEADER_F32_COUNT;
        let flag_idx = base + HEADER_FLAGS;
        // Mirror `bind_color_layers`: numeric mask, not bit pattern (avoids
        // denormal-flush). Clears only the COLR bit so other flags survive.
        let existing = self.glyph_headers[flag_idx] as u32;
        self.glyph_headers[flag_idx] = (existing & !crate::curves::FLAG_HAS_COLOR_LAYERS) as f32;
        self.glyph_headers[base + HEADER_COLOR_LAYER_START] = 0.0;
        self.glyph_headers[base + HEADER_COLOR_LAYER_COUNT] = 0.0;
        Self::touch_range(
            &mut self.dirty_headers,
            base as u32 + HEADER_FLAGS as u32..base as u32 + HEADER_COLOR_LAYER_COUNT as u32 + 1,
        );
    }

    fn alloc_header_slot(&mut self, current_frame: u64) -> Option<u32> {
        if let Some(slot) = self.header_slots.alloc(1) {
            return Some(slot);
        }
        self.evict_cold(current_frame, LRU_MIN_AGE);
        if let Some(slot) = self.header_slots.alloc(1) {
            return Some(slot);
        }
        // Grow by 50% (rounded up to a sensible minimum).
        let growth = (self.header_slots.capacity() / 2).max(64);
        self.grow_headers(growth);
        self.header_slots.alloc(1)
    }

    fn alloc_with_growth(&mut self, kind: AllocKind, size: u32, current_frame: u64) -> Option<u32> {
        if size == 0 {
            return Some(0);
        }
        if let Some(off) = self.alloc(kind, size) {
            return Some(off);
        }
        self.evict_cold(current_frame, LRU_MIN_AGE);
        if let Some(off) = self.alloc(kind, size) {
            return Some(off);
        }
        let cur = self.capacity(kind);
        let growth = (cur / 2).max(size).max(1024);
        self.grow(kind, growth);
        self.alloc(kind, size)
    }

    fn alloc(&mut self, kind: AllocKind, size: u32) -> Option<u32> {
        match kind {
            AllocKind::Bands => self.band_alloc.alloc(size),
            AllocKind::BandCurves => self.band_curves_alloc.alloc(size),
            AllocKind::Curves => self.curve_alloc.alloc(size),
        }
    }

    fn capacity(&self, kind: AllocKind) -> u32 {
        match kind {
            AllocKind::Bands => self.band_alloc.capacity(),
            AllocKind::BandCurves => self.band_curves_alloc.capacity(),
            AllocKind::Curves => self.curve_alloc.capacity(),
        }
    }

    fn grow(&mut self, kind: AllocKind, additional: u32) {
        match kind {
            AllocKind::Bands => {
                self.band_alloc.grow(additional);
                let new_len = self.band_alloc.capacity() as usize;
                self.band_data.resize(new_len, 0);
                // Resizing potentially relocated the buffer → JS must reupload
                // the whole thing.
                self.dirty_bands = Some(0..new_len as u32);
            }
            AllocKind::BandCurves => {
                self.band_curves_alloc.grow(additional);
                let new_len = self.band_curves_alloc.capacity() as usize;
                self.band_curves.resize(new_len, 0);
                self.dirty_band_curves = Some(0..new_len as u32);
            }
            AllocKind::Curves => {
                self.curve_alloc.grow(additional);
                let new_len = self.curve_alloc.capacity() as usize;
                self.curve_data.resize(new_len, 0.0);
                self.dirty_curves = Some(0..new_len as u32);
            }
        }
    }

    fn grow_headers(&mut self, additional_slots: u32) {
        self.header_slots.grow(additional_slots);
        let new_slots = self.header_slots.capacity() as usize;
        self.glyph_headers.resize(new_slots * HEADER_F32_COUNT, 0.0);
        self.dirty_headers = Some(0..self.glyph_headers.len() as u32);
    }

    /// Free every glyph last used more than `min_age` frames ago. Frees both
    /// the allocator ranges and the header slot, zeroing the freed header so
    /// a stale shader read renders nothing.
    pub fn evict_cold(&mut self, current_frame: u64, min_age: u64) {
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
            self.remove(k);
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
    Bands,
    BandCurves,
    Curves,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::curves::CURVE_F32_COUNT;

    // -------- FreeList --------

    #[test]
    fn free_list_first_fit_and_merge() {
        let mut f = FreeList::new(100);
        let a = f.alloc(20).unwrap(); // 0..20
        let b = f.alloc(30).unwrap(); // 20..50
        let c = f.alloc(50).unwrap(); // 50..100
        assert_eq!((a, b, c), (0, 20, 50));

        // Free middle, then adjacent — should merge.
        f.free(b, 30);
        f.free(a, 20);
        // Now 0..50 free + 50..100 used. Next alloc(50) lands at 0.
        assert_eq!(f.alloc(50), Some(0));
    }

    #[test]
    fn free_list_grow_extends_trailing_range() {
        let mut f = FreeList::new(10);
        let _ = f.alloc(10).unwrap();
        assert_eq!(f.alloc(5), None);
        f.grow(20);
        assert_eq!(f.capacity(), 30);
        assert_eq!(f.alloc(5), Some(10));
    }

    #[test]
    fn free_list_fragmentation_then_compaction_via_grow() {
        // Allocate 3 blocks, free the middle one. The pool should be split.
        let mut f = FreeList::new(30);
        let _a = f.alloc(10).unwrap(); // 0..10
        let b = f.alloc(10).unwrap(); // 10..20
        let _c = f.alloc(10).unwrap(); // 20..30
        f.free(b, 10); // now [10..20] free
        // An 11-element request fails because the middle hole is only 10 wide.
        assert_eq!(f.alloc(11), None);
        // Growing makes a 20-wide range at the end available.
        f.grow(20);
        assert_eq!(f.alloc(11), Some(30));
    }

    // -------- CurveAtlas --------

    fn make_atlas() -> CurveAtlas {
        CurveAtlas::new()
    }

    fn fake_packed(curve_count: usize, band_count: usize) -> PackedGlyph {
        let mut bands = Vec::with_capacity(band_count);
        let mut band_curves = Vec::with_capacity(curve_count);
        for i in 0..band_count {
            // Each band points at one curve.
            let start = i as u32;
            bands.push((start << 16) | 1);
            band_curves.push(i as u16 % curve_count.max(1) as u16);
        }
        let curves = vec![0.5; curve_count * CURVE_F32_COUNT];
        let mut header = [0.0; HEADER_F32_COUNT];
        header[crate::curves::HEADER_BAND_COUNT] = band_count as f32;
        PackedGlyph {
            header,
            bands,
            band_curves,
            curves,
        }
    }

    #[test]
    fn insert_writes_offsets_to_header() {
        let mut atlas = make_atlas();
        let packed = fake_packed(3, 2);
        let ok = atlas.insert_packed(0, 7, &packed, 0);
        assert!(ok);

        let record = atlas.get_record(composite_key(0, 7)).unwrap().clone();
        let h_start = record.header_slot as usize * HEADER_F32_COUNT;
        // Header bands_offset / band_curves_offset / curves_offset reflect
        // the record.
        assert_eq!(
            atlas.glyph_headers[h_start + HEADER_BANDS_OFFSET] as u32,
            record.bands_offset,
        );
        assert_eq!(
            atlas.glyph_headers[h_start + HEADER_BAND_CURVES_OFFSET] as u32,
            record.band_curves_offset,
        );
        assert_eq!(
            atlas.glyph_headers[h_start + HEADER_CURVES_OFFSET] as u32,
            record.curves_offset,
        );
    }

    #[test]
    fn dirty_ranges_drain_on_take() {
        let mut atlas = make_atlas();
        let _ = atlas.insert_packed(0, 1, &fake_packed(2, 2), 0);
        let d = atlas.take_dirty_ranges();
        assert!(d.headers.is_some());
        assert!(d.bands.is_some());
        assert!(d.band_curves.is_some());
        assert!(d.curves.is_some());

        // Second take with no work is empty.
        let d2 = atlas.take_dirty_ranges();
        assert!(d2.headers.is_none() && d2.bands.is_none());
    }

    #[test]
    fn remove_zeroes_header_and_frees_ranges() {
        let mut atlas = make_atlas();
        let _ = atlas.insert_packed(0, 1, &fake_packed(2, 2), 0);
        let key = composite_key(0, 1);
        let record = atlas.get_record(key).unwrap().clone();
        let h_start = record.header_slot as usize * HEADER_F32_COUNT;

        assert!(atlas.remove(key));
        assert!(!atlas.contains(key));
        // Header zeroed.
        assert_eq!(
            &atlas.glyph_headers[h_start..h_start + HEADER_F32_COUNT],
            &[0.0; HEADER_F32_COUNT]
        );
        // Slot reusable: insert again should land at the same slot.
        let _ = atlas.insert_packed(0, 2, &fake_packed(2, 2), 0);
        let new_record = atlas.get_record(composite_key(0, 2)).unwrap();
        assert_eq!(new_record.header_slot, record.header_slot);
    }

    #[test]
    fn evict_cold_drops_stale_glyphs() {
        let mut atlas = make_atlas();
        // Frame 0: insert two glyphs.
        let _ = atlas.insert_packed(0, 1, &fake_packed(2, 2), 0);
        let _ = atlas.insert_packed(0, 2, &fake_packed(2, 2), 0);
        // Bump the frame counter past the eviction threshold, then touch
        // only one glyph at the same "now" frame so it stays fresh.
        let now = LRU_MIN_AGE + 10;
        atlas.touch(composite_key(0, 1), now);
        atlas.evict_cold(now, LRU_MIN_AGE);
        assert!(atlas.contains(composite_key(0, 1)));
        assert!(!atlas.contains(composite_key(0, 2)));
    }

    #[test]
    fn alloc_growth_when_buffer_exhausted() {
        // Force a tiny initial capacity by manipulating after construction.
        let mut atlas = make_atlas();
        // Shrink curve allocator to almost-empty so the next insert triggers
        // a grow path.
        atlas.curve_alloc = FreeList::new(2 * CURVE_F32_COUNT as u32);
        atlas.curve_data = vec![0.0; 2 * CURVE_F32_COUNT];

        let _ = atlas.insert_packed(0, 1, &fake_packed(2, 2), 0);
        // 2 curves fit exactly. Inserting a 3-curve glyph forces growth.
        let initial_cap = atlas.curve_alloc.capacity();
        let ok = atlas.insert_packed(0, 2, &fake_packed(3, 2), 0);
        assert!(ok, "growth path should have absorbed the larger glyph");
        assert!(
            atlas.curve_alloc.capacity() > initial_cap,
            "expected curve buffer to grow from {} but stayed there",
            initial_cap,
        );
    }

    #[test]
    fn bind_color_layers_sets_flag_and_range() {
        let mut atlas = make_atlas();
        let _ = atlas.insert_packed(0, 1, &fake_packed(1, 1), 0);
        let key = composite_key(0, 1);
        let h_start = atlas.get_record(key).unwrap().header_slot as usize * HEADER_F32_COUNT;

        assert_eq!(atlas.glyph_headers[h_start + HEADER_FLAGS] as u32, 0);
        atlas.bind_color_layers(key, 42, 5);
        assert_eq!(
            atlas.glyph_headers[h_start + HEADER_FLAGS] as u32,
            crate::curves::FLAG_HAS_COLOR_LAYERS,
        );
        assert_eq!(
            atlas.glyph_headers[h_start + crate::curves::HEADER_COLOR_LAYER_START] as u32,
            42,
        );
        assert_eq!(
            atlas.glyph_headers[h_start + crate::curves::HEADER_COLOR_LAYER_COUNT] as u32,
            5,
        );

        atlas.clear_color_layers(key);
        assert_eq!(atlas.glyph_headers[h_start + HEADER_FLAGS] as u32, 0);
        assert_eq!(
            atlas.glyph_headers[h_start + crate::curves::HEADER_COLOR_LAYER_START],
            0.0,
        );
        assert_eq!(
            atlas.glyph_headers[h_start + crate::curves::HEADER_COLOR_LAYER_COUNT],
            0.0,
        );
    }
}
