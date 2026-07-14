//! Shared tuning constants for the memory-budget policy.
//!
//! Kept centralized here (rather than scattered across the modules that consume
//! them) so the engine's memory-policy knobs live in one discoverable place.
//! Re-exported at the crate root, so callers reach them as `navara_memory::*`.

/// Evict down to this fraction of the budget to avoid oscillating at the
/// budget line (evict ↔ refetch thrashing).
pub const HYSTERESIS_RATIO: f64 = 0.85;

/// Tiles retained fewer than this many frames are never evicted, so a tile
/// that just left the view survives an immediate pan-back.
pub const MIN_RETAIN_FRAMES: usize = 10;

/// Ceiling for the memory-pressure SSE multiplier (≈2 LOD levels coarser at
/// far distance when fully degraded).
pub const MAX_SSE_MULTIPLIER: f32 = 32.0;
/// Tiles closer than this many camera-heights keep full resolution even
/// under maximum pressure.
pub const DEGRADE_NEAR_HEIGHTS: f64 = 2.0;
/// Tiles beyond this many camera-heights get the full multiplier.
pub const DEGRADE_FAR_HEIGHTS: f64 = 10.0;
/// Camera-height floor so the near/far band stays sane at street level.
pub const DEGRADE_MIN_CAMERA_HEIGHT: f64 = 100.0;

/// Pressure raise step, applied once per stall window.
pub const PRESSURE_RAISE_STEP: f32 = 1.25;
/// Per-frame decay factor once usage is back under the hysteresis target.
pub const PRESSURE_DECAY: f32 = 0.98;
/// Consecutive no-eviction-progress frames (while over budget) required
/// before each raise step. Longer than [`MIN_RETAIN_FRAMES`], so eviction
/// always gets a chance to catch up before the next step — raising every
/// frame would spike straight to the ceiling during the retain protection.
pub const PRESSURE_STALL_FRAMES: u32 = 15;
/// Minimum change before the quantized [`SsePressure`](crate::SsePressure) is
/// re-published (each publish triggers a full re-traversal).
pub const PRESSURE_PUBLISH_DELTA: f32 = 0.25;
/// Frames after a raise during which decay is blocked even when usage is back
/// under the hysteresis target (~5s at 60fps). Without a cooldown the
/// controller oscillates when refinement itself re-blows the budget: raise →
/// coarsen → usage drops → immediate decay → re-refine → refetch the evicted
/// children → over budget → raise again, refetching the same tiles forever.
pub const PRESSURE_DECAY_COOLDOWN_MIN_FRAMES: u32 = 300;
/// Cooldown ceiling (~60s at 60fps). Each decay→re-raise round trip doubles
/// the cooldown up to this cap, so a scene whose refined working set simply
/// does not fit converges to a rare probe instead of a perpetual reload loop.
pub const PRESSURE_DECAY_COOLDOWN_MAX_FRAMES: u32 = 3600;

pub(crate) const DEFAULT_ATLAS_TILE_BYTES: u64 = 3 * 1024 * 1024;
// 256×256 RGBA plus ~1/3 mipmap overhead.
pub(crate) const DEFAULT_RASTER_TILE_BYTES: u64 = (256 * 256 * 4 * 133) / 100;

/// Cold-start *seed* for the vector (MVT) reservation estimator: used by
/// [`ReserveEstimates::estimate`](crate::ReserveEstimates::estimate) until a
/// layer has recorded its first [`RESERVE_MIN_SAMPLES`] landed costs, after
/// which the per-layer EMA statistics take over. ~500 KB is a mid-zoom-ish MVT
/// geometry cost — biased high enough to close the gate early on a cold layer
/// without starving it.
pub const DEFAULT_VECTOR_TILE_RESERVE_BYTES: u64 = 512 * 1024;

/// Cold-start *seed* for the 3D Tiles content reservation estimator
/// (b3dm/pnts/glb payloads). Content sizes vary wildly per tileset (KB to tens
/// of MB), which is exactly why the per-tileset EMA replaces this after the
/// first [`RESERVE_MIN_SAMPLES`] landed contents; ~2 MB only covers the cold
/// start.
pub const DEFAULT_TILES3D_RESERVE_BYTES: u64 = 2 * 1024 * 1024;

/// EMA smoothing factor for the reservation estimator. Effective window is
/// roughly `2/α − 1` ≈ the last ~25 samples. Deliberately on the fast side:
/// tile cost varies systematically with zoom band (mid-zoom MVT is far denser
/// than low-zoom), and a camera burst fetches from a narrow zoom band — a
/// recency-weighted mean automatically tracks the band currently being
/// fetched. That recency tracking is what makes a flat per-layer EMA
/// competitive with a per-(layer, zoom) table, without that table's
/// cold-start sparsity.
pub const RESERVE_EMA_ALPHA: f64 = 0.08;

/// Safety margin, in standard deviations, added to the EMA mean when producing
/// a reservation estimate. The load gate defends the SUM of all in-flight
/// costs, not each tile individually: a sum of N independent tile costs
/// concentrates around `N·mean` (CLT) with only ~`σ·√N` of spread at risk, so
/// reserving `mean + 1σ` per tile would over-protect the sum by ~`σ·N` and
/// starve loading near the budget. K = 0.5 keeps each estimate biased high
/// while staying near the statistically-at-risk margin for realistic burst
/// sizes (N ≈ 10–50 → √N/N ≈ 0.14–0.32).
pub const RESERVE_K_STDDEV: f64 = 0.5;

/// Floor for recorded samples and produced estimates: a degenerate run of tiny
/// tiles (empty ocean MVTs) must not zero future reservations.
pub const RESERVE_MIN_BYTES: u64 = 64 * 1024;
/// Ceiling for recorded samples and produced estimates: one heavy-tail outlier
/// (e.g. a 30 MB freak tile) must not inflate every future reservation.
/// Samples are clamped *before* they are folded into the EMA, so the outlier
/// cannot leak in through the mean/variance either.
pub const RESERVE_MAX_BYTES: u64 = 16 * 1024 * 1024;

/// Below this many recorded samples a layer's estimator falls back to the
/// caller-provided seed constant (see the `DEFAULT_*_RESERVE_BYTES` seeds).
pub const RESERVE_MIN_SAMPLES: u32 = 4;

/// Mesh geometry handed to Three.js now lands in a SINGLE resident copy: the
/// GPU upload. Three.js drops the CPU-side `BufferAttribute.array` via an
/// `onUpload` callback right after the first upload (see the web side's
/// `releaseGeometryArraysAfterUpload`), so no JS-heap clone of the WASM buffer
/// survives. A geometry buffer's GPU-side cost is therefore ~1× its byte
/// length. (The WASM `BufferStore` copy that terrain keeps for upsampling is
/// separate and already counted in `cpu_bytes`.) The constant is kept as a
/// single knob documenting this model rather than being inlined.
pub const GPU_GEOMETRY_RESIDENCY_FACTOR: u64 = 1;
