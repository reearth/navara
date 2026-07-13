//! Memory budgeting for tile caches.
//!
//! [`MemoryLedger`] tracks the engine-wide memory usage (exact CPU bytes from
//! [`BufferStore`] plus incrementally-maintained GPU estimates) against an
//! optional budget. When `budget_bytes` is `None` (the default) the budget
//! feature is disabled and tile lifecycles keep their original
//! destroy-on-unvisited behavior.

use std::collections::HashMap;

use bevy_app::{App, Plugin, PostUpdate, PreUpdate};
use bevy_ecs::entity::Entity;
use bevy_ecs::lifecycle::HookContext;
use bevy_ecs::prelude::{Component, Res, ResMut, Resource};
use bevy_ecs::schedule::IntoScheduleConfigs;
use bevy_ecs::world::DeferredWorld;
use navara_buffer_store::BufferStore;

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
/// Minimum change before the quantized [`SsePressure`] is re-published (each
/// publish triggers a full re-traversal).
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

const DEFAULT_ATLAS_TILE_BYTES: u64 = 3 * 1024 * 1024;
// 256×256 RGBA plus ~1/3 mipmap overhead.
const DEFAULT_RASTER_TILE_BYTES: u64 = (256 * 256 * 4 * 133) / 100;

/// Cold-start *seed* for the vector (MVT) reservation estimator: used by
/// [`ReserveEstimates::estimate`] until a layer has recorded its first
/// [`RESERVE_MIN_SAMPLES`] landed costs, after which the per-layer EMA
/// statistics take over. ~500 KB is a mid-zoom-ish MVT geometry cost — biased
/// high enough to close the gate early on a cold layer without starving it.
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

/// Estimated memory cost of a rendered tile. `cpu` covers bytes held in the
/// WASM heap that are not already accounted by [`BufferStore`]; `gpu_est` is
/// a deterministic estimate of GPU-side allocations (textures, render
/// targets, vertex buffers) owned by the JS side for this tile.
///
/// Component hooks keep [`MemoryLedger::gpu_bytes_est`] in sync with the
/// component's lifecycle: insertion adds the estimate, and replacement,
/// removal, or entity despawn subtracts it — every destroy path stays
/// accounted without manual bookkeeping.
#[derive(Clone, Copy, Default, Debug, Component)]
#[component(on_insert = on_tile_cost_insert, on_replace = on_tile_cost_replace)]
pub struct TileCost {
    pub cpu: u64,
    pub gpu_est: u64,
}

impl TileCost {
    pub fn total(&self) -> u64 {
        self.cpu + self.gpu_est
    }
}

fn on_tile_cost_insert(mut world: DeferredWorld, ctx: HookContext) {
    let Some(cost) = world.get::<TileCost>(ctx.entity).copied() else {
        return;
    };
    if let Some(mut ledger) = world.get_resource_mut::<MemoryLedger>() {
        ledger.add_gpu(cost);
    }
}

fn on_tile_cost_replace(mut world: DeferredWorld, ctx: HookContext) {
    let Some(cost) = world.get::<TileCost>(ctx.entity).copied() else {
        return;
    };
    if let Some(mut ledger) = world.get_resource_mut::<MemoryLedger>() {
        ledger.sub_gpu(cost);
    }
}

/// A dispatch-time *reservation* of a tile's estimated cost, attached to the
/// data-requester entity the moment a fetch is actually dispatched (not for
/// requesters rejected by the load gate / pending cap). While it exists the
/// reserved bytes count toward [`MemoryLedger::hard_usage`] (so the load gate
/// and pressure controller see in-flight work *before* it lands) and toward
/// [`MemoryLedger::usage`] (so reserving proactively drives eviction of old
/// pooled tiles to make room — "evict old to load new").
///
/// The reserved amount is resolved centrally by the `on_insert` hook: insert
/// [`ReservedCost::for_key`] and the hook computes
/// `ReserveEstimates::estimate(key, MemoryLedger::reserve_seed(key))` at apply
/// time, so the dispatch systems don't each duplicate the estimate/seed dance
/// (the resolved amount is stored on the component so `on_replace` releases
/// exactly what was added). [`ReservedCost::fixed`] bypasses the estimator for
/// callers that already know the amount (tests, no-layer fallbacks).
///
/// Component hooks keep [`MemoryLedger::reserved_bytes`] leak-free across every
/// exit path: `on_insert` adds the estimate, `on_replace` subtracts it. Bevy
/// fires `on_replace` on replace, remove, AND despawn, so this single hook
/// covers all three — an aborted request (requester despawned while still
/// `Pending`) releases its reservation automatically. Registering `on_remove`
/// too would double-subtract on every removal/despawn (Bevy fires `on_replace`
/// then `on_remove`). The [`release_landed_reservations`] system removes the
/// component the frame the fetch resolves (status leaves `Pending`), *before*
/// the actual `TileCost` lands a frame later, so a reservation and its measured
/// cost never systematically double-count.
#[derive(Clone, Copy, Default, Debug, Component)]
#[component(on_insert = on_reserved_cost_insert, on_replace = on_reserved_cost_remove)]
pub struct ReservedCost {
    /// `Some` until the `on_insert` hook resolves it into `bytes`.
    key: Option<ReserveKey>,
    bytes: u64,
}

impl ReservedCost {
    /// Reservation whose amount the `on_insert` hook resolves from the per-key
    /// EMA (seeded by [`MemoryLedger::reserve_seed`]) at command-apply time.
    pub fn for_key(key: ReserveKey) -> Self {
        Self {
            key: Some(key),
            bytes: 0,
        }
    }

    /// Reservation of a known, fixed amount (no estimator lookup).
    pub fn fixed(bytes: u64) -> Self {
        Self { key: None, bytes }
    }

    /// The reserved amount; 0 for a `for_key` reservation whose hook has not
    /// applied yet.
    pub fn bytes(&self) -> u64 {
        self.bytes
    }
}

fn on_reserved_cost_insert(mut world: DeferredWorld, ctx: HookContext) {
    let Some(reserved) = world.get::<ReservedCost>(ctx.entity).copied() else {
        return;
    };
    let bytes = match reserved.key {
        None => reserved.bytes,
        Some(key) => {
            let Some(ledger) = world.get_resource::<MemoryLedger>() else {
                return;
            };
            let seed = ledger.reserve_seed(key);
            let bytes = world
                .get_resource::<ReserveEstimates>()
                .map_or(seed, |estimates| estimates.estimate(key, seed));
            // Store the resolved amount so `on_replace` releases exactly what
            // was added (the EMA may have moved by then). Plain mutation — no
            // hook re-fires.
            if let Some(mut reserved) = world.get_mut::<ReservedCost>(ctx.entity) {
                reserved.bytes = bytes;
            }
            bytes
        }
    };
    if let Some(mut ledger) = world.get_resource_mut::<MemoryLedger>() {
        ledger.reserved_bytes += bytes;
    }
}

fn on_reserved_cost_remove(mut world: DeferredWorld, ctx: HookContext) {
    let Some(reserved) = world.get::<ReservedCost>(ctx.entity).copied() else {
        return;
    };
    if let Some(mut ledger) = world.get_resource_mut::<MemoryLedger>() {
        ledger.reserved_bytes = ledger.reserved_bytes.saturating_sub(reserved.bytes);
    }
}

/// Key for one reservation-estimator pool: landed-cost statistics must not be
/// pooled across layers (different MVT sources / 3D tilesets have wildly
/// different tile sizes), so each layer entity gets its own EMA.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ReserveKey {
    /// Per-layer pool keyed by the vector MVT source layer entity. Split from
    /// [`Self::Tiles3dLayer`] (rather than one generic layer variant) so the
    /// cold-start seed is derivable from the key alone — see
    /// [`MemoryLedger::reserve_seed`].
    VectorLayer(Entity),
    /// Per-tileset pool keyed by the 3D Tiles layer (tileset) entity —
    /// b3dm/pnts/glb sizes vary wildly ACROSS tilesets, so pools are never
    /// merged.
    Tiles3dLayer(Entity),
    /// Single pipeline-wide pool for hillshade DEM tiles. Their payload is a
    /// per-source constant (`tile_size² × 4` RGBA plus fixed edge strips), so
    /// a per-layer split would buy no accuracy and only slow the cold start.
    Hillshade,
    /// Single pipeline-wide pool for terrain tiles (RasterDEM and quantized
    /// mesh alike — one terrain source per session, so a per-source split
    /// would buy nothing). Unlike hillshade the landed cost is NOT a
    /// per-source constant: quantized-mesh payloads vary with vertex count
    /// (terrain roughness), and the resident cost is dominated by the mesh
    /// geometry plus the composite-atlas seed. Fed the full per-tile mesh
    /// cost from `attach_terrain_mesh_cost`.
    Terrain,
}

/// Exponentially-weighted running mean and variance of landed tile costs.
#[derive(Debug, Clone, Copy, Default)]
pub struct EmaStats {
    mean: f64,
    var: f64,
    samples: u32,
}

impl EmaStats {
    /// Folds one (pre-clamped) sample into the EW statistics using the
    /// standard stable formulation:
    /// `mean += α·(x − mean)`; `var += α·((x − mean_old)·(x − mean_new) − var)`.
    fn record(&mut self, x: f64) {
        if self.samples == 0 {
            self.mean = x;
            self.var = 0.0;
        } else {
            let mean_old = self.mean;
            self.mean += RESERVE_EMA_ALPHA * (x - mean_old);
            self.var += RESERVE_EMA_ALPHA * ((x - mean_old) * (x - self.mean) - self.var);
        }
        self.samples = self.samples.saturating_add(1);
    }

    fn estimate(&self) -> f64 {
        self.mean + RESERVE_K_STDDEV * self.var.max(0.0).sqrt()
    }
}

/// Per-layer adaptive reservation estimator: running EMA mean + variance of
/// the ACTUAL costs of previously landed tiles, fed from each pipeline's
/// cost-attach point (vector `transfer_mesh` geometry bytes, 3D Tiles
/// `construct_system` payload bytes, hillshade DEM payload + edge strips).
/// [`Self::estimate`] returns `mean + K·stddev` (see [`RESERVE_K_STDDEV`]),
/// clamped to `[RESERVE_MIN_BYTES, RESERVE_MAX_BYTES]`; until a key has
/// [`RESERVE_MIN_SAMPLES`] samples it returns the caller's seed unchanged.
///
/// Entries are never explicitly dropped on layer removal: none of the
/// pipelines has a single cheap teardown choke point that still sees the layer
/// entity, and each entry is ~40 bytes keyed by layer entity — bounded by the
/// number of layers created over the session, which is negligible next to a
/// single tile payload.
#[derive(Resource, Debug, Default)]
pub struct ReserveEstimates {
    stats: HashMap<ReserveKey, EmaStats>,
}

impl ReserveEstimates {
    /// Records the actual landed cost of one tile for `key`. The sample is
    /// clamped to `[RESERVE_MIN_BYTES, RESERVE_MAX_BYTES]` BEFORE the EMA
    /// update, so a heavy-tail outlier cannot inflate (nor an empty tile
    /// deflate) future reservations through the statistics.
    pub fn record(&mut self, key: ReserveKey, sample_bytes: u64) {
        let clamped = sample_bytes.clamp(RESERVE_MIN_BYTES, RESERVE_MAX_BYTES);
        self.stats.entry(key).or_default().record(clamped as f64);
    }

    /// Reservation estimate for the next fetch of `key`: `mean + K·stddev`
    /// clamped to the sane range, or `seed_bytes` while the key is cold
    /// (fewer than [`RESERVE_MIN_SAMPLES`] samples).
    pub fn estimate(&self, key: ReserveKey, seed_bytes: u64) -> u64 {
        match self.stats.get(&key) {
            Some(s) if s.samples >= RESERVE_MIN_SAMPLES => {
                (s.estimate() as u64).clamp(RESERVE_MIN_BYTES, RESERVE_MAX_BYTES)
            }
            _ => seed_bytes,
        }
    }
}

/// Entry in a per-layer retention pool: a tile that is no longer visited but
/// is kept alive (deactivated) until the memory budget forces eviction.
#[derive(Clone, Copy, Debug)]
pub struct RetainedEntry {
    /// Frame at which the tile was moved into the retention pool.
    pub retained_at: usize,
    pub cost: TileCost,
}

/// Shared eviction-loop helpers, extracted from the per-layer
/// `enforce_memory_budget` systems (terrain / raster / vector / 3D Tiles) so
/// they share one policy instead of drifting. Each caller keeps only its
/// layer-specific entity/destroy logic and calls these pure helpers for the
/// filter / sort / target-loop bookkeeping.
pub mod eviction {
    use core::cmp::Ordering;

    use crate::MIN_RETAIN_FRAMES;

    /// Whether a pooled tile whose last-render was `visited_at` should survive
    /// the pool purge given the last fully-rendered frame. The `+ 1` grace
    /// keeps a tile pooled for one extra frame after it stops being visited, so
    /// an immediate pan-back reactivates it without a refetch. Unified across
    /// terrain and vector (vector previously used a strict `<` with no grace).
    #[inline]
    pub fn survives_purge(visited_at: usize, last_rendered_frame: usize) -> bool {
        visited_at + 1 < last_rendered_frame
    }

    /// Whether a retained entry is old enough to be an eviction candidate:
    /// tiles retained fewer than [`MIN_RETAIN_FRAMES`] frames are protected so
    /// a tile that just left the view survives an immediate pan-back.
    #[inline]
    pub fn is_evictable(retained_at: usize, current_frame: usize) -> bool {
        current_frame.saturating_sub(retained_at) >= MIN_RETAIN_FRAMES
    }

    /// Ordering for eviction candidates: oldest `visited_at` first, then the
    /// farthest tile first among equals (a larger distance evicts earlier).
    /// Raster carries no per-entity distance and passes `0.0` for both, which
    /// degrades this to a pure `visited_at` sort.
    #[inline]
    pub fn order(a: (usize, f64), b: (usize, f64)) -> Ordering {
        a.0.cmp(&b.0).then(b.1.total_cmp(&a.1))
    }

    /// Running byte-budget bookkeeping for the evict-until-target loop. Holds
    /// the live usage estimate and stops once it drops to the hysteresis
    /// target, mirroring `MemoryLedger::usage` (GPU estimate + synchronously
    /// freed CPU bytes) without double counting.
    #[derive(Debug, Clone, Copy)]
    pub struct EvictBudget {
        usage_est: u64,
        target: u64,
    }

    impl EvictBudget {
        #[inline]
        pub fn new(usage_est: u64, target: u64) -> Self {
            Self { usage_est, target }
        }

        /// Whether byte-driven eviction should continue (usage still over the
        /// hysteresis target).
        #[inline]
        pub fn over_target(&self) -> bool {
            self.usage_est > self.target
        }

        /// Credit one evicted tile: subtract its GPU estimate plus whatever CPU
        /// bytes its destroy freed synchronously from the store.
        #[inline]
        pub fn credit(&mut self, gpu_est: u64, cpu_freed: u64) {
            self.usage_est = self
                .usage_est
                .saturating_sub(gpu_est)
                .saturating_sub(cpu_freed);
        }

        #[inline]
        pub fn usage_est(&self) -> u64 {
            self.usage_est
        }
    }
}

/// GPU cost constants that only the JS side knows precisely (e.g. composite
/// atlas dimensions depend on device options). Overridable via
/// `setMemoryCostHints`.
#[derive(Debug, Clone, Copy)]
pub struct CostHints {
    /// Composite atlas cost per terrain tile. Every terrain tile pays this:
    /// the JS `TileMesh` acquires an atlas eagerly in its constructor, so a
    /// raster-only terrain scene still holds one per tile. Seeded into
    /// `TerrainTileGpuCost.drape` at mesh-attach time (see
    /// `attach_terrain_mesh_cost`) so it binds against the budget even before
    /// any vector layer drapes.
    pub atlas_tile_bytes: u64,
    /// Raster texture cost per fragment (w×h×4 plus mipmap overhead).
    pub raster_tile_bytes: u64,
}

impl CostHints {
    /// Cold-start reservation seed for a hillshade DEM fetch.
    ///
    /// Derivation from the hillshade pipeline's actual allocations: the
    /// resident cost of a landed hillshade tile is the decoded RGBA DEM
    /// payload (`tile_size² × 4` bytes — `raster_tile_bytes` covers this and
    /// already carries a ~33% mipmap margin) plus the four boundary edge
    /// strips `store_extracted_edges` keeps in `BufferStore` for neighbor
    /// backfill (`4 strips × tile_size px × 4 B/px = 16·tile_size` bytes,
    /// i.e. `4/tile_size` ≈ 1/64 of the payload at the standard 256). The
    /// `+ 1/64` term folds that edge overhead into the seed.
    pub fn hillshade_reserve_seed(&self) -> u64 {
        self.raster_tile_bytes + self.raster_tile_bytes / 64
    }

    /// Cold-start reservation seed for a terrain (RasterDEM / quantized-mesh)
    /// fetch, used until [`ReserveKey::Terrain`] has recorded its first
    /// [`RESERVE_MIN_SAMPLES`] landed mesh costs.
    ///
    /// Derivation from what a landed terrain tile actually costs the ledger:
    /// the decoded DEM / mesh-geometry buffers (a RasterDEM decode is on the
    /// order of one raster tile; quantized-mesh varies with vertex count —
    /// the EMA takes over for that) plus the composite atlas EVERY terrain
    /// tile pays at mesh attach (`atlas_tile_bytes`, ~3 MB — the dominant
    /// term). Seeding only the raster hint here, as this used to, undercounts
    /// the eventual resident cost by roughly an order of magnitude and lets a
    /// camera-move terrain burst slip past the load gate.
    pub fn terrain_reserve_seed(&self) -> u64 {
        self.raster_tile_bytes + self.atlas_tile_bytes
    }
}

impl Default for CostHints {
    fn default() -> Self {
        Self {
            atlas_tile_bytes: DEFAULT_ATLAS_TILE_BYTES,
            raster_tile_bytes: DEFAULT_RASTER_TILE_BYTES,
        }
    }
}

#[derive(Resource, Debug)]
pub struct MemoryLedger {
    /// Total budget (CPU + GPU estimate). `None` disables budgeting and
    /// retention entirely, preserving the original lifecycle.
    pub budget_bytes: Option<u64>,
    /// Mirror of `BufferStore::total_bytes`, refreshed each frame for stats.
    pub cpu_bytes: u64,
    /// Incrementally maintained sum of `TileCost::gpu_est` for live tiles.
    pub gpu_bytes_est: u64,
    /// CPU bytes held outside `BufferStore` (plain `Vec`s/`HashMap`s the
    /// store can't see — chiefly the MVT feature attribute tables in
    /// `BatchTable`). Synced each frame by contributor systems in
    /// [`MemoryAccountingSet`]. For attribute-rich data (e.g. Overture) this
    /// dominates, so counting it is what makes the budget/eviction/SSE-degrade
    /// actually bind.
    pub external_cpu_bytes: u64,
    /// Sum of every layer's fully-evictable retention pool cost (terrain /
    /// raster / vector / 3D Tiles), synced each frame in
    /// [`MemoryAccountingSet`]. Subtracted from [`Self::usage`] to form
    /// [`Self::hard_usage`], the *resident* footprint the load gate and
    /// pressure react to. Without this, a healthy *full* LRU cache (retained
    /// tiles eviction can reclaim on demand) is indistinguishable from genuine
    /// memory exhaustion: the gate closes at `usage >= budget`, stops all new
    /// loads, and terrain never descends to its overscale/upsample band.
    pub retained_evictable_bytes: u64,
    /// Sum of every live [`ReservedCost`]: the estimated cost of tiles whose
    /// fetch has been dispatched but whose actual [`TileCost`] has not yet
    /// landed. Folded into [`Self::usage`] (and thus [`Self::hard_usage`]) so
    /// the load gate closes *before* in-flight decode/upload peaks blow the
    /// budget, and so reserving drives eviction of old pooled tiles to make
    /// room. Maintained incrementally by the [`ReservedCost`] component hooks.
    pub reserved_bytes: u64,
    /// GPU bytes of tiles evicted THIS frame whose `TileCost` hook has not yet
    /// fired (the destroy defers the despawn — meshes to next frame's
    /// `remove_removed_mesh`, 3D Tiles content to the end of this `Update`), so
    /// `gpu_bytes_est` still contains them. Each pipeline's `enforce_memory_budget`
    /// adds an evicted candidate's `gpu_est` here at destroy time; [`Self::usage`]
    /// and [`Self::hard_usage`] subtract it (saturating). Without this, the four
    /// pipelines' eviction loops each read the *same* stale `usage` in the same
    /// frame (their `EvictBudget` credit is stack-local), so a single overage
    /// gets evicted up to four times over. Zeroed once per frame by
    /// [`reset_pending_evicted_gpu_bytes`] in `PreUpdate` after
    /// `remove_removed_mesh` has applied the deferred despawns — at which point
    /// `gpu_bytes_est` already reflects them and the credit must not persist.
    pub pending_evicted_gpu_bytes: u64,
    /// Continuous memory-pressure SSE multiplier, maintained by
    /// [`update_sse_pressure`]; traversals read the quantized [`SsePressure`]
    /// instead.
    pub sse_multiplier: f32,
    /// Resting/base SSE multiplier: the value pressure decays to (a floor). A
    /// value above 1 makes far tiles permanently coarser regardless of memory
    /// pressure — set above 1 on mobile to shrink the working set from the start.
    pub min_sse_multiplier: f32,
    /// Ceiling the memory-pressure multiplier may rise to. Larger on mobile
    /// so the degrade can shed more of the visible set before the tab is
    /// killed.
    pub max_sse_multiplier: f32,
    pub cost_hints: CostHints,
    /// Cumulative number of tiles evicted by budget enforcement (stats).
    pub evicted_count: u64,
}

impl Default for MemoryLedger {
    fn default() -> Self {
        Self {
            budget_bytes: None,
            cpu_bytes: 0,
            gpu_bytes_est: 0,
            external_cpu_bytes: 0,
            retained_evictable_bytes: 0,
            reserved_bytes: 0,
            pending_evicted_gpu_bytes: 0,
            sse_multiplier: 1.0,
            min_sse_multiplier: 1.0,
            max_sse_multiplier: MAX_SSE_MULTIPLIER,
            cost_hints: CostHints::default(),
            evicted_count: 0,
        }
    }
}

impl MemoryLedger {
    pub fn enabled(&self) -> bool {
        self.budget_bytes.is_some()
    }

    pub fn add_gpu(&mut self, cost: TileCost) {
        self.gpu_bytes_est += cost.gpu_est;
    }

    pub fn sub_gpu(&mut self, cost: TileCost) {
        debug_assert!(
            self.gpu_bytes_est >= cost.gpu_est,
            "gpu_bytes_est underflow: {} - {}",
            self.gpu_bytes_est,
            cost.gpu_est
        );
        self.gpu_bytes_est = self.gpu_bytes_est.saturating_sub(cost.gpu_est);
    }

    /// Current total usage: exact `BufferStore` CPU bytes + externally
    /// accounted CPU bytes (attribute tables) + estimated GPU bytes +
    /// dispatch-time reservations for in-flight fetches ([`ReservedCost`]).
    /// Including reservations here means both the load gate/pressure
    /// ([`Self::hard_usage`]) *and* eviction ([`Self::needs_eviction`]) react to
    /// them: the gate closes before in-flight peaks land, and reserving evicts
    /// old pooled tiles to make room for the incoming ones.
    pub fn usage(&self, cpu_total: u64) -> u64 {
        (cpu_total + self.external_cpu_bytes + self.gpu_bytes_est + self.reserved_bytes)
            .saturating_sub(self.pending_evicted_gpu_bytes)
    }

    /// Record that a tile evicted this frame (whose deferred despawn has not yet
    /// fired its `TileCost` hook) has freed `gpu_est` GPU bytes, so every
    /// pipeline's later [`Self::usage`] read this frame excludes it and does not
    /// re-evict the same overage. See [`Self::pending_evicted_gpu_bytes`].
    pub fn credit_pending_eviction(&mut self, gpu_est: u64) {
        self.pending_evicted_gpu_bytes += gpu_est;
    }

    /// Cold-start seed for a [`ReserveKey`]'s reservation estimate — the value
    /// [`ReserveEstimates::estimate`] returns until the key's EMA has enough
    /// samples. Centralized here (keyed by the reservation key alone) so the
    /// `ReservedCost` `on_insert` hook can resolve a reservation without each
    /// dispatch system duplicating the seed choice.
    pub fn reserve_seed(&self, key: ReserveKey) -> u64 {
        match key {
            ReserveKey::VectorLayer(_) => DEFAULT_VECTOR_TILE_RESERVE_BYTES,
            ReserveKey::Tiles3dLayer(_) => DEFAULT_TILES3D_RESERVE_BYTES,
            ReserveKey::Hillshade => self.cost_hints.hillshade_reserve_seed(),
            ReserveKey::Terrain => self.cost_hints.terrain_reserve_seed(),
        }
    }

    /// [`Self::usage`] minus the fully-evictable retention pool: the resident
    /// footprint that cannot be freed without evicting *visible / protected /
    /// in-flight* tiles. The load gate and memory-pressure controller key off
    /// this — a full-but-healthy LRU cache (reclaimable on demand) must not
    /// read as memory exhaustion and stall new loads. Eviction itself still
    /// uses the full [`Self::usage`] to cap the cache at the budget.
    pub fn hard_usage(&self, cpu_total: u64) -> u64 {
        self.usage(cpu_total)
            .saturating_sub(self.retained_evictable_bytes)
    }

    /// Whether an eviction pass should run: always when over budget, and —
    /// while the load gate is closed — anywhere above the gate-reopen target.
    /// Without the second arm, usage stranded in the hysteresis band
    /// (target < usage <= budget, e.g. from in-loop estimate drift) would keep
    /// the gate closed forever with eviction dormant: nothing could pull usage
    /// down to the reopen threshold and no new tile would ever load again.
    pub fn needs_eviction(&self, usage: u64, load_gate_closed: bool) -> bool {
        match self.budget_bytes {
            Some(budget) => usage > budget || (load_gate_closed && usage > self.evict_target()),
            None => false,
        }
    }

    pub fn over_budget(&self, usage: u64) -> bool {
        self.budget_bytes.is_some_and(|budget| usage > budget)
    }

    /// Eviction stops once usage drops to this target (hysteresis).
    pub fn evict_target(&self) -> u64 {
        self.budget_bytes
            .map(|budget| (budget as f64 * HYSTERESIS_RATIO) as u64)
            .unwrap_or(u64::MAX)
    }
}

/// Distance-weighted memory-pressure LOD degrade, computed once per
/// traversal run. Scales a tile's `max_sse` threshold by 1..multiplier via a
/// smoothstep over the tile's distance from camera, normalized by the camera
/// height: near tiles (≤ 2×height) keep full resolution, far tiles
/// (≥ 10×height) tolerate up to `multiplier`× the error and both stay
/// coarser and stop subdividing earlier — shrinking the visible set, which
/// eviction alone cannot do.
///
/// The near band is degraded only by pressure ABOVE the device's *resting*
/// base (`min_sse_multiplier`), not by the absolute multiplier. At rest
/// (multiplier == min) the `near_floor` weight is 0, so near-camera tiles keep
/// full resolution on every device — including iOS, whose resting min is > 1.
/// As pressure climbs toward the device's configured `max_sse_multiplier` the
/// floor ramps to 1, so even a near-top-down view (whose entire visible set
/// sits in the near band) is eventually degraded once eviction alone cannot
/// get under budget.
#[derive(Clone, Copy, Debug)]
pub struct SseDegrade {
    multiplier: f64,
    near: f64,
    inv_span: f64,
    /// Minimum smoothstep weight applied even inside the near band; 0 keeps the
    /// near band fully protected (at/below the resting base), 1 degrades it in
    /// full (at the configured ceiling).
    near_floor: f64,
}

impl SseDegrade {
    /// No degradation (identity); used when pressure is 1.0 and by tests.
    pub const NONE: Self = Self {
        multiplier: 1.0,
        near: 0.0,
        inv_span: 0.0,
        near_floor: 0.0,
    };

    /// Builds a degrade whose near-band floor ramps over the device's own
    /// resting `min`..configured `max` multiplier range. `min` is the resting
    /// base pressure decays to; near tiles stay fully protected while the
    /// multiplier is at (or below) it, and are fully degraded once it reaches
    /// `max`. A degenerate range (`max <= min`) yields a floor that saturates
    /// to 1 for any multiplier above `min`.
    pub fn new(multiplier: f32, camera_height_m: f64, min: f32, max: f32) -> Self {
        let h = camera_height_m.max(DEGRADE_MIN_CAMERA_HEIGHT);
        // Ramp the near-band floor from 0 at the resting `min` to 1 at the
        // configured `max`. Basing this on pressure ABOVE the resting base (not
        // the absolute multiplier) is what keeps near tiles full-resolution at
        // rest even when `min > 1` (e.g. iOS). Guard the degenerate span.
        let span = (max - min).max(f32::EPSILON);
        let near_floor = ((multiplier - min) / span).clamp(0.0, 1.0) as f64;
        Self {
            multiplier: multiplier.max(1.0) as f64,
            near: DEGRADE_NEAR_HEIGHTS * h,
            inv_span: 1.0 / ((DEGRADE_FAR_HEIGHTS - DEGRADE_NEAR_HEIGHTS) * h),
            near_floor,
        }
    }

    /// `max_sse` scaled by the distance-weighted multiplier. Identity when
    /// the multiplier is 1 (fast path). Within the near band the result is
    /// identity while pressure rests at the base (`near_floor == 0`); under
    /// higher pressure the `near_floor` lifts the weight so the near band
    /// degrades too.
    pub fn effective_max_sse(&self, max_sse: f64, distance_from_camera: f64) -> f64 {
        if self.multiplier <= 1.0 {
            return max_sse;
        }
        let t = ((distance_from_camera - self.near) * self.inv_span).clamp(0.0, 1.0);
        let s = t * t * (3.0 - 2.0 * t); // smoothstep
        // Floor the distance weight so the near band is no longer fully exempt
        // once pressure climbs above the resting base.
        let w = s.max(self.near_floor);
        max_sse * (1.0 + (self.multiplier - 1.0) * w)
    }
}

/// Quantized memory-pressure SSE multiplier, published for the traversals.
///
/// Written ONLY when the published value actually changes, so
/// `Res<SsePressure>::is_changed()` is a valid re-traversal trigger — unlike
/// [`MemoryLedger`], which `sync_cpu_bytes` writes every frame.
#[derive(Resource, Debug)]
pub struct SsePressure {
    pub multiplier: f32,
    /// Device resting base multiplier (`MemoryLedger::min_sse_multiplier`),
    /// republished here so traversals can build an [`SseDegrade`] whose
    /// near-band floor ramps over the device's real range without also reading
    /// the ledger.
    pub min: f32,
    /// Device configured ceiling multiplier (`MemoryLedger::max_sse_multiplier`).
    pub max: f32,
    /// When `true`, memory is exhausted: traversals must not START loading new
    /// child tiles, even where SSE says refine — they settle on the current
    /// (already loaded) tile instead. Children that are already loaded keep
    /// rendering; this freezes the working set rather than coarsening it, so
    /// an over-tight budget degrades to "stops refining" instead of an endless
    /// evict → refetch reload loop. Closes at `usage >= budget`, reopens at
    /// `usage <= evict_target()` (hysteresis band holds the previous state).
    pub load_gate_closed: bool,
}

impl Default for SsePressure {
    fn default() -> Self {
        Self {
            multiplier: 1.0,
            min: 1.0,
            max: MAX_SSE_MULTIPLIER,
            load_gate_closed: false,
        }
    }
}

pub struct PressureLocal {
    last_evicted: u64,
    stall_frames: u32,
    /// Frames left before decay is allowed again after a raise.
    decay_cooldown: u32,
    /// Adaptive cooldown length: doubles on every decay→re-raise round trip
    /// (evidence that the refined working set does not fit), resets once the
    /// multiplier rests at the device minimum.
    cooldown_len: u32,
    /// Set by a decay step; a subsequent raise consuming it is a round trip.
    decayed_since_raise: bool,
}

impl Default for PressureLocal {
    fn default() -> Self {
        Self {
            last_evicted: 0,
            stall_frames: 0,
            decay_cooldown: 0,
            cooldown_len: PRESSURE_DECAY_COOLDOWN_MIN_FRAMES,
            decayed_since_raise: false,
        }
    }
}

/// Maintains the continuous pressure value in `ledger.sse_multiplier` and
/// publishes it (quantized) to [`SsePressure`]:
/// - over budget with no eviction progress for a full stall window (the
///   pools are dry or protected — the visible set alone exceeds the budget)
///   → one raise step per window;
/// - back under the hysteresis target → slow decay toward exactly 1.0, but
///   only after the post-raise cooldown expires. Decaying immediately would
///   re-refine, refetch the just-evicted children, re-blow the budget and
///   raise again — an endless coarsen/reload oscillation. The cooldown
///   doubles on every such round trip (up to a cap), so a working set that
///   simply does not fit converges to a rare probe instead of a reload loop;
/// - in between → hold.
pub fn update_sse_pressure(
    buf: Res<BufferStore>,
    mut ledger: ResMut<MemoryLedger>,
    mut pressure: ResMut<SsePressure>,
    mut local: bevy_ecs::prelude::Local<PressureLocal>,
) {
    let min = ledger.min_sse_multiplier;
    let max = ledger.max_sse_multiplier.max(min);
    // The resting/base multiplier is a floor applied on every device policy,
    // so start from at least `min` (mobile keeps far tiles coarse always).
    let mut multiplier = ledger.sse_multiplier.max(min);

    if let Some(budget) = ledger.budget_bytes {
        // Gate and pressure react to the *resident* footprint (`hard_usage`),
        // not the total: the retention LRU pool is fully evictable, so counting
        // it here would let a healthy full cache close the load gate and raise
        // pressure — stalling new loads and coarsening LOD (blocking terrain
        // upsample from descending). Eviction still caps the cache against the
        // full `usage` in each layer's `enforce_memory_budget`.
        let usage = ledger.hard_usage(buf.total_bytes() as u64);
        // Load gate with hysteresis: close at the budget line, reopen only
        // once eviction pulled usage down to the target, hold in between.
        // Write-guarded — the open transition must be change-detected so the
        // traversals re-run and resume the descent that was cut short.
        let gate = if usage >= budget {
            true
        } else if usage <= ledger.evict_target() {
            false
        } else {
            pressure.load_gate_closed
        };
        if pressure.load_gate_closed != gate {
            pressure.load_gate_closed = gate;
        }
        if usage > budget {
            let progressed = ledger.evicted_count != local.last_evicted;
            if progressed {
                local.stall_frames = 0;
            } else {
                local.stall_frames += 1;
            }
            if local.stall_frames >= PRESSURE_STALL_FRAMES {
                multiplier = (multiplier * PRESSURE_RAISE_STEP).min(max);
                // One step per stall window: give eviction (and the retain
                // protection) a chance to catch up before raising again.
                local.stall_frames = 0;
                // A raise right after we decayed means the decay itself
                // re-blew the budget: back off the next probe exponentially.
                if local.decayed_since_raise {
                    local.cooldown_len =
                        (local.cooldown_len * 2).min(PRESSURE_DECAY_COOLDOWN_MAX_FRAMES);
                    local.decayed_since_raise = false;
                }
                local.decay_cooldown = local.cooldown_len;
            }
        } else {
            local.stall_frames = 0;
            if usage <= ledger.evict_target() {
                if local.decay_cooldown > 0 {
                    local.decay_cooldown -= 1;
                } else {
                    multiplier = (multiplier * PRESSURE_DECAY).max(min);
                    local.decayed_since_raise = true;
                    if multiplier < min + 0.01 {
                        multiplier = min;
                    }
                }
            }
            // Hysteresis band (target < usage <= budget): hold.
        }
        if multiplier == min {
            // At rest: forget the backoff so the next pressure episode starts
            // with a fresh, short probe interval.
            local.cooldown_len = PRESSURE_DECAY_COOLDOWN_MIN_FRAMES;
            local.decayed_since_raise = false;
        }
    } else {
        // Budget disabled: rest at the base multiplier (device policy still
        // applies), and never block loading.
        local.stall_frames = 0;
        local.decay_cooldown = 0;
        local.cooldown_len = PRESSURE_DECAY_COOLDOWN_MIN_FRAMES;
        local.decayed_since_raise = false;
        multiplier = min;
        if pressure.load_gate_closed {
            pressure.load_gate_closed = false;
        }
    }

    local.last_evicted = ledger.evicted_count;
    ledger.sse_multiplier = multiplier;

    // Republish the device range so traversals build the near-band degrade
    // against the real min/max (change-guarded to avoid needless re-traversal).
    if pressure.min != min {
        pressure.min = min;
    }
    if pressure.max != max {
        pressure.max = max;
    }

    // Quantized, write-guarded publish; the exact-`min` case must always land
    // or a decay ending within the quantization delta would strand the
    // published value above the base forever.
    if (pressure.multiplier - multiplier).abs() > PRESSURE_PUBLISH_DELTA
        || (multiplier == min && pressure.multiplier != min)
    {
        pressure.multiplier = multiplier;
    }
}

/// Zeroes [`MemoryLedger::pending_evicted_gpu_bytes`] at the start of each
/// frame. Registered by [`MemoryPlugin`] in `PreUpdate` inside
/// [`PendingEvictionResetSet`]; `navara_ecs` orders that set AFTER
/// `navara_mesh::remove_removed_mesh`, which despawns the previous frame's
/// evicted meshes and thereby fires their `TileCost` hooks — so by the time
/// this clears the credit, `gpu_bytes_est` already reflects the eviction and
/// the pending credit must not persist (double-subtract). The counter is
/// re-accumulated during the same frame's `Update` eviction pass.
pub fn reset_pending_evicted_gpu_bytes(mut ledger: ResMut<MemoryLedger>) {
    ledger.pending_evicted_gpu_bytes = 0;
}

/// `PreUpdate` set holding [`reset_pending_evicted_gpu_bytes`]. The system is
/// registered here in [`MemoryPlugin`], but its correctness depends on running
/// after the deferred despawns of the previous frame's evictions have applied
/// (firing the `TileCost` hooks) — a constraint against `navara_mesh`, which
/// this crate does not depend on. `navara_ecs`, where both crates are in
/// scope, orders this set after `remove_removed_mesh`.
#[derive(bevy_ecs::schedule::SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub struct PendingEvictionResetSet;

/// Mirrors the exact BufferStore byte count into the ledger for stats, and
/// periodically verifies (debug builds only) that the incremental accounting
/// matches a from-scratch recomputation.
pub fn sync_cpu_bytes(
    buf: Res<BufferStore>,
    mut ledger: ResMut<MemoryLedger>,
    mut frame_counter: bevy_ecs::prelude::Local<u32>,
) {
    ledger.cpu_bytes = buf.total_bytes() as u64;

    if cfg!(debug_assertions) {
        *frame_counter = frame_counter.wrapping_add(1);
        if frame_counter.is_multiple_of(256) {
            debug_assert_eq!(
                buf.total_bytes(),
                buf.recomputed_total_bytes(),
                "BufferStore byte accounting drifted"
            );
        }
    }
}

/// `PostUpdate` set for systems that fold non-`BufferStore` bytes into
/// [`MemoryLedger::external_cpu_bytes`] (e.g. the `BatchTable` attribute
/// tables, synced from `navara_feature`). The pressure/stat systems run
/// after this set so they see the current frame's external bytes.
#[derive(bevy_ecs::schedule::SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub struct MemoryAccountingSet;

pub struct MemoryPlugin;

impl Plugin for MemoryPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<MemoryLedger>();
        app.init_resource::<SsePressure>();
        app.init_resource::<ReserveEstimates>();
        app.add_systems(
            PreUpdate,
            reset_pending_evicted_gpu_bytes.in_set(PendingEvictionResetSet),
        );
        app.add_systems(
            PostUpdate,
            (sync_cpu_bytes, update_sse_pressure)
                .chain()
                .after(MemoryAccountingSet),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disabled_by_default() {
        let ledger = MemoryLedger::default();
        assert!(!ledger.enabled());
        assert!(!ledger.over_budget(u64::MAX - 1));
        assert_eq!(ledger.evict_target(), u64::MAX);
    }

    #[test]
    fn needs_eviction_drains_the_hysteresis_band_while_the_gate_is_closed() {
        let ledger = MemoryLedger {
            budget_bytes: Some(1000), // evict target = 850
            ..Default::default()
        };
        // Over budget: always evict, gate or not.
        assert!(ledger.needs_eviction(1001, false));
        // In the band with the gate open: dormant (normal hysteresis).
        assert!(!ledger.needs_eviction(900, false));
        // In the band with the gate closed: must drain to the reopen target,
        // or the gate (and all new tile loads) would stay blocked forever.
        assert!(ledger.needs_eviction(900, true));
        // At/below the target the gate can reopen: stop.
        assert!(!ledger.needs_eviction(850, true));
        // No budget: never evict.
        let disabled = MemoryLedger::default();
        assert!(!disabled.needs_eviction(u64::MAX - 1, true));
    }

    #[test]
    fn tracks_gpu_estimate() {
        let mut ledger = MemoryLedger::default();
        let cost = TileCost {
            cpu: 0,
            gpu_est: 100,
        };
        ledger.add_gpu(cost);
        ledger.add_gpu(cost);
        assert_eq!(ledger.gpu_bytes_est, 200);
        ledger.sub_gpu(cost);
        assert_eq!(ledger.gpu_bytes_est, 100);
        assert_eq!(ledger.usage(50), 150);
    }

    #[test]
    fn usage_includes_external_cpu_bytes() {
        let ledger = MemoryLedger {
            gpu_bytes_est: 100,
            external_cpu_bytes: 300,
            ..Default::default()
        };
        // BufferStore cpu (50) + external (300) + gpu (100).
        assert_eq!(ledger.usage(50), 450);
    }

    #[test]
    fn hooks_keep_gpu_estimate_in_sync() {
        let mut world = bevy_ecs::world::World::new();
        world.init_resource::<MemoryLedger>();

        let cost = TileCost {
            cpu: 0,
            gpu_est: 100,
        };
        let e = world.spawn(cost).id();
        assert_eq!(world.resource::<MemoryLedger>().gpu_bytes_est, 100);

        // Replacing accounts the delta.
        world.entity_mut(e).insert(TileCost {
            cpu: 0,
            gpu_est: 40,
        });
        assert_eq!(world.resource::<MemoryLedger>().gpu_bytes_est, 40);

        // Despawn subtracts.
        world.despawn(e);
        assert_eq!(world.resource::<MemoryLedger>().gpu_bytes_est, 0);
    }

    #[test]
    fn reservations_count_toward_usage_and_hard_usage() {
        let ledger = MemoryLedger {
            gpu_bytes_est: 100,
            reserved_bytes: 300,
            ..Default::default()
        };
        // usage = cpu(50) + external(0) + gpu(100) + reserved(300).
        assert_eq!(ledger.usage(50), 450);
        // No retention pool, so hard_usage == usage: the gate sees reservations.
        assert_eq!(ledger.hard_usage(50), 450);
    }

    #[test]
    fn reservation_closes_the_gate_while_resident_usage_alone_is_under_budget() {
        // Resident footprint (gpu) is under budget, but a large in-flight
        // reservation pushes hard_usage over it — the gate must react so
        // in-flight work fits under the budget.
        let ledger = MemoryLedger {
            budget_bytes: Some(1000),
            gpu_bytes_est: 800,
            reserved_bytes: 300,
            ..Default::default()
        };
        // Without reservations hard_usage would be 800 < 1000 (gate open); with
        // them it is 1100 >= 1000.
        assert!(ledger.hard_usage(0) >= 1000);
        // usage(0) = 1100 > budget → eviction is driven by the reservation too.
        assert!(ledger.needs_eviction(ledger.usage(0), false));
    }

    #[test]
    fn reserved_cost_hook_releases_on_despawn() {
        let mut world = bevy_ecs::world::World::new();
        world.init_resource::<MemoryLedger>();

        let e = world.spawn(ReservedCost::fixed(500)).id();
        assert_eq!(world.resource::<MemoryLedger>().reserved_bytes, 500);

        // Replacing accounts the delta (on_replace subtract + on_insert add).
        world.entity_mut(e).insert(ReservedCost::fixed(200));
        assert_eq!(world.resource::<MemoryLedger>().reserved_bytes, 200);

        // Explicit remove releases it.
        world.entity_mut(e).remove::<ReservedCost>();
        assert_eq!(world.resource::<MemoryLedger>().reserved_bytes, 0);

        // Hold TWO live reservations and release one: the released bytes must be
        // subtracted EXACTLY once. Bevy fires `on_replace` then `on_remove` on
        // every removal/despawn, so a stray `on_remove` registration would
        // subtract twice here — leaving 700 - 500 = 200 instead of 700. A single
        // live reservation saturates at 0 and cannot catch this.
        let a = world.spawn(ReservedCost::fixed(500)).id();
        let _b = world.spawn(ReservedCost::fixed(700)).id();
        assert_eq!(world.resource::<MemoryLedger>().reserved_bytes, 1200);
        // Despawn `a` (abort path): only its 500 bytes are released, `b`'s 700
        // remain — a double subtract would leave 200.
        world.despawn(a);
        assert_eq!(world.resource::<MemoryLedger>().reserved_bytes, 700);
    }

    #[test]
    fn reserved_cost_for_key_resolves_via_hook() {
        let mut world = bevy_ecs::world::World::new();
        world.init_resource::<MemoryLedger>();
        world.init_resource::<ReserveEstimates>();

        // Cold estimator → the hook resolves to the key's seed.
        let seed = world
            .resource::<MemoryLedger>()
            .reserve_seed(ReserveKey::Terrain);
        let e = world.spawn(ReservedCost::for_key(ReserveKey::Terrain)).id();
        assert_eq!(world.resource::<MemoryLedger>().reserved_bytes, seed);
        assert_eq!(world.get::<ReservedCost>(e).unwrap().bytes(), seed);

        // Warm the EMA past RESERVE_MIN_SAMPLES with a distinct landed cost:
        // a new reservation resolves to the EMA estimate, and releasing the
        // old one still subtracts the amount IT was resolved at.
        let landed = 4 * 1024 * 1024;
        for _ in 0..RESERVE_MIN_SAMPLES {
            world
                .resource_mut::<ReserveEstimates>()
                .record(ReserveKey::Terrain, landed);
        }
        let estimate = world
            .resource::<ReserveEstimates>()
            .estimate(ReserveKey::Terrain, seed);
        assert_ne!(estimate, seed, "test must distinguish EMA from seed");
        let e2 = world.spawn(ReservedCost::for_key(ReserveKey::Terrain)).id();
        assert_eq!(
            world.resource::<MemoryLedger>().reserved_bytes,
            seed + estimate
        );
        world.despawn(e);
        assert_eq!(world.resource::<MemoryLedger>().reserved_bytes, estimate);
        world.despawn(e2);
        assert_eq!(world.resource::<MemoryLedger>().reserved_bytes, 0);
    }

    #[test]
    fn pending_eviction_credit_lowers_usage_and_hard_usage() {
        let mut ledger = MemoryLedger {
            gpu_bytes_est: 1000,
            ..Default::default()
        };
        // usage = cpu(50) + gpu(1000) = 1050.
        assert_eq!(ledger.usage(50), 1050);
        // An eviction whose deferred despawn has not fired yet: gpu_bytes_est
        // still holds the 300, but usage must already exclude it so the next
        // pipeline's enforce pass this frame does not re-evict the same overage.
        ledger.credit_pending_eviction(300);
        assert_eq!(ledger.usage(50), 750);
        assert_eq!(ledger.hard_usage(50), 750);
        // Saturates rather than underflowing if the credit exceeds usage.
        ledger.credit_pending_eviction(10_000);
        assert_eq!(ledger.usage(50), 0);
    }

    #[test]
    fn hard_usage_excludes_the_evictable_retention_pool() {
        let ledger = MemoryLedger {
            gpu_bytes_est: 900,
            external_cpu_bytes: 0,
            retained_evictable_bytes: 700,
            ..Default::default()
        };
        // usage = cpu(50) + external(0) + gpu(900) = 950.
        assert_eq!(ledger.usage(50), 950);
        // hard usage subtracts the fully-evictable retention pool.
        assert_eq!(ledger.hard_usage(50), 250);
        // Saturates instead of underflowing when the pool exceeds usage.
        let over = MemoryLedger {
            gpu_bytes_est: 100,
            retained_evictable_bytes: 10_000,
            ..Default::default()
        };
        assert_eq!(over.hard_usage(0), 0);
    }

    #[test]
    fn budget_and_hysteresis() {
        let ledger = MemoryLedger {
            budget_bytes: Some(1000),
            ..Default::default()
        };
        assert!(ledger.enabled());
        assert!(ledger.over_budget(1001));
        assert!(!ledger.over_budget(1000));
        assert_eq!(ledger.evict_target(), 850);
    }
}

#[cfg(test)]
mod reserve_estimator_tests {
    use super::*;

    const SEED: u64 = 512 * 1024;

    fn key_a() -> ReserveKey {
        ReserveKey::VectorLayer(Entity::from_raw_u32(1).unwrap())
    }

    fn key_b() -> ReserveKey {
        ReserveKey::VectorLayer(Entity::from_raw_u32(2).unwrap())
    }

    #[test]
    fn falls_back_to_the_seed_until_min_samples() {
        let mut est = ReserveEstimates::default();
        // No samples at all: seed.
        assert_eq!(est.estimate(key_a(), SEED), SEED);
        // One fewer than the minimum: still the seed.
        for _ in 0..RESERVE_MIN_SAMPLES - 1 {
            est.record(key_a(), 1024 * 1024);
        }
        assert_eq!(est.estimate(key_a(), SEED), SEED);
        // At the minimum the statistics take over.
        est.record(key_a(), 1024 * 1024);
        assert_ne!(est.estimate(key_a(), SEED), SEED);
    }

    #[test]
    fn ema_mean_and_variance_update_correctly() {
        // Constant samples: mean converges to the value, variance stays 0, so
        // the estimate equals the value exactly (K·0 adds nothing).
        let mut est = ReserveEstimates::default();
        let x = 2 * 1024 * 1024;
        for _ in 0..RESERVE_MIN_SAMPLES {
            est.record(key_a(), x);
        }
        assert_eq!(est.estimate(key_a(), SEED), x);

        // Reference-check the incremental formulas against a hand-rolled
        // computation over a varying sequence.
        let samples = [1_000_000u64, 3_000_000, 2_000_000, 5_000_000, 1_500_000];
        let mut est2 = ReserveEstimates::default();
        let (mut mean, mut var) = (samples[0] as f64, 0.0f64);
        for &s in &samples {
            est2.record(key_b(), s);
        }
        for &s in &samples[1..] {
            let x = s as f64;
            let mean_old = mean;
            mean += RESERVE_EMA_ALPHA * (x - mean_old);
            var += RESERVE_EMA_ALPHA * ((x - mean_old) * (x - mean) - var);
        }
        let expected = ((mean + RESERVE_K_STDDEV * var.max(0.0).sqrt()) as u64)
            .clamp(RESERVE_MIN_BYTES, RESERVE_MAX_BYTES);
        assert_eq!(est2.estimate(key_b(), SEED), expected);
        // Varying samples must produce a positive variance (estimate > mean).
        assert!(var > 0.0);
        assert!(expected as f64 > mean);
    }

    #[test]
    fn estimate_is_clamped_both_ways() {
        // Huge samples: both the sample clamp and the estimate clamp cap at
        // the ceiling, so one freak tile cannot inflate future reservations.
        let mut hi = ReserveEstimates::default();
        for _ in 0..RESERVE_MIN_SAMPLES {
            hi.record(key_a(), u64::MAX);
        }
        assert_eq!(hi.estimate(key_a(), SEED), RESERVE_MAX_BYTES);

        // Tiny samples: the floor stops a degenerate run from zeroing the
        // reservation.
        let mut lo = ReserveEstimates::default();
        for _ in 0..RESERVE_MIN_SAMPLES {
            lo.record(key_a(), 1);
        }
        assert_eq!(lo.estimate(key_a(), SEED), RESERVE_MIN_BYTES);
    }

    #[test]
    fn per_layer_pools_do_not_cross_contaminate() {
        let mut est = ReserveEstimates::default();
        for _ in 0..RESERVE_MIN_SAMPLES {
            est.record(key_a(), 128 * 1024);
            est.record(key_b(), 8 * 1024 * 1024);
        }
        let a = est.estimate(key_a(), SEED);
        let b = est.estimate(key_b(), SEED);
        assert_eq!(a, 128 * 1024);
        assert_eq!(b, 8 * 1024 * 1024);
        // A third, untouched key still gets the seed.
        assert_eq!(est.estimate(ReserveKey::Hillshade, SEED), SEED);
    }

    #[test]
    fn hillshade_seed_folds_edge_overhead_into_the_raster_hint() {
        let hints = CostHints::default();
        assert_eq!(
            hints.hillshade_reserve_seed(),
            hints.raster_tile_bytes + hints.raster_tile_bytes / 64
        );
        assert!(hints.hillshade_reserve_seed() > hints.raster_tile_bytes);
    }

    #[test]
    fn terrain_seed_folds_the_atlas_into_the_raster_hint() {
        let hints = CostHints::default();
        assert_eq!(
            hints.terrain_reserve_seed(),
            hints.raster_tile_bytes + hints.atlas_tile_bytes
        );
        // The atlas dominates: the seed must be atlas-scale, not raster-scale.
        assert!(hints.terrain_reserve_seed() > hints.atlas_tile_bytes);
    }
}

#[cfg(test)]
mod eviction_tests {
    use super::MIN_RETAIN_FRAMES;
    use super::eviction::*;

    #[test]
    fn order_sorts_by_visited_at_then_distance_desc() {
        // Tuples are (visited_at, distance). Expected eviction order:
        // oldest visited first; among equal visited_at, farthest first.
        let mut items = vec![
            (5usize, 10.0f64), // newest visited
            (2, 3.0),          // oldest, nearer
            (2, 9.0),          // oldest, farther → should lead
            (4, 100.0),
        ];
        items.sort_by(|a, b| order(*a, *b));
        assert_eq!(items, vec![(2, 9.0), (2, 3.0), (4, 100.0), (5, 10.0)]);
    }

    #[test]
    fn order_degrades_to_visited_at_when_distance_is_zero() {
        // Raster passes 0.0 for distance: the sort is then a pure visited_at asc.
        let mut items = vec![(3usize, 0.0f64), (1, 0.0), (2, 0.0)];
        items.sort_by(|a, b| order(*a, *b));
        assert_eq!(items, vec![(1, 0.0), (2, 0.0), (3, 0.0)]);
    }

    #[test]
    fn is_evictable_respects_min_retain_frames() {
        assert!(!is_evictable(100, 100 + MIN_RETAIN_FRAMES - 1));
        assert!(is_evictable(100, 100 + MIN_RETAIN_FRAMES));
    }

    #[test]
    fn survives_purge_has_a_one_frame_grace() {
        // visited_at == last-1 survives (the +1 grace); older does not.
        assert!(survives_purge(8, 10)); // 8 + 1 < 10
        assert!(!survives_purge(9, 10)); // 9 + 1 == 10, not < 10
        assert!(!survives_purge(10, 10));
    }

    #[test]
    fn evict_budget_stops_at_target() {
        let mut b = EvictBudget::new(300, 200);
        assert!(b.over_target());
        b.credit(50, 60); // 300 - 110 = 190 <= 200
        assert!(!b.over_target());
        assert_eq!(b.usage_est(), 190);
        // Saturates instead of underflowing.
        b.credit(1000, 0);
        assert_eq!(b.usage_est(), 0);
    }
}

#[cfg(test)]
mod sse_degrade_tests {
    use super::*;

    /// Default device range (`min = 1`, `max = MAX_SSE_MULTIPLIER`).
    fn degrade(multiplier: f32, camera_height_m: f64) -> SseDegrade {
        SseDegrade::new(multiplier, camera_height_m, 1.0, MAX_SSE_MULTIPLIER)
    }

    #[test]
    fn identity_when_multiplier_is_one() {
        let degrade = degrade(1.0, 1000.0);
        assert_eq!(degrade.effective_max_sse(2.0, 1e9), 2.0);
        assert_eq!(SseDegrade::NONE.effective_max_sse(2.0, 1e9), 2.0);
    }

    #[test]
    fn near_tiles_keep_full_resolution_at_rest() {
        // At the resting base (multiplier == min): near band is fully
        // protected even though far tiles already coarsen.
        let h = 1000.0;
        let degrade = SseDegrade::new(4.0, h, 4.0, 32.0);
        assert_eq!(degrade.effective_max_sse(2.0, 0.0), 2.0);
        assert_eq!(
            degrade.effective_max_sse(2.0, DEGRADE_NEAR_HEIGHTS * h),
            2.0
        );
    }

    #[test]
    fn far_tiles_get_the_full_multiplier() {
        let h = 1000.0;
        let degrade = degrade(4.0, h);
        let far = degrade.effective_max_sse(2.0, DEGRADE_FAR_HEIGHTS * h);
        assert!((far - 8.0).abs() < 1e-9);
        assert!((degrade.effective_max_sse(2.0, 1e9) - 8.0).abs() < 1e-9);
    }

    #[test]
    fn monotonic_between_near_and_far() {
        let h = 1000.0;
        let degrade = degrade(4.0, h);
        let a = degrade.effective_max_sse(2.0, 3.0 * h);
        let b = degrade.effective_max_sse(2.0, 5.0 * h);
        let c = degrade.effective_max_sse(2.0, 8.0 * h);
        assert!(2.0 < a && a < b && b < c && c < 8.0);
    }

    #[test]
    fn camera_height_floor_applies() {
        // h=0 behaves like h=DEGRADE_MIN_CAMERA_HEIGHT.
        let degrade0 = degrade(4.0, 0.0);
        let floor = degrade(4.0, DEGRADE_MIN_CAMERA_HEIGHT);
        let d = 500.0;
        assert_eq!(
            degrade0.effective_max_sse(2.0, d),
            floor.effective_max_sse(2.0, d)
        );
    }

    #[test]
    fn near_band_fully_protected_at_the_resting_min() {
        // FIX 4: with min=1, a multiplier == min (== 1) is the identity fast
        // path; but crucially, even a device whose resting base is > 1 keeps
        // the near band at full resolution AT REST. iOS: min=8, max=64.
        let h = 1000.0;
        let degrade = SseDegrade::new(8.0, h, 8.0, 64.0);
        // At rest the near band is identity (near_floor == 0)...
        assert_eq!(degrade.effective_max_sse(2.0, 0.0), 2.0);
        assert_eq!(
            degrade.effective_max_sse(2.0, DEGRADE_NEAR_HEIGHTS * h),
            2.0
        );
        // ...while far tiles still take the resting multiplier.
        let far = degrade.effective_max_sse(2.0, DEGRADE_FAR_HEIGHTS * h);
        assert!((far - 2.0 * 8.0).abs() < 1e-9, "far={far}");
    }

    #[test]
    fn near_band_partially_degraded_above_the_resting_base() {
        // min=1, max=32, m=16: near_floor = (16-1)/(32-1) = 15/31.
        let h = 1000.0;
        let m = 16.0f32;
        let degrade = degrade(m, h);
        let expected_floor = ((m - 1.0) / (MAX_SSE_MULTIPLIER - 1.0)) as f64;
        assert!(expected_floor > 0.0 && expected_floor < 1.0);
        let near = degrade.effective_max_sse(2.0, 0.0);
        let expected = 2.0 * (1.0 + (m as f64 - 1.0) * expected_floor);
        assert!(
            (near - expected).abs() < 1e-9,
            "near={near} expected={expected}"
        );
        // Strictly between identity and the full multiplier.
        assert!(2.0 < near && near < 2.0 * m as f64);
    }

    #[test]
    fn near_band_fully_degraded_at_the_configured_max() {
        // FIX 4/7: at multiplier == configured max the near_floor saturates to
        // 1, so even the nearest tile gets the full multiplier — the degrade
        // bites everywhere. Exercise a non-default (iOS-like) range min=8/max=64.
        let h = 1000.0;
        let degrade = SseDegrade::new(64.0, h, 8.0, 64.0);
        let near = degrade.effective_max_sse(2.0, 0.0);
        assert!((near - 2.0 * 64.0).abs() < 1e-9, "near={near}");
    }

    #[test]
    fn far_still_dominates_near_under_high_pressure() {
        // The floor never inverts the distance ordering: a far tile is always
        // degraded at least as much as a near one.
        let h = 1000.0;
        let degrade = degrade(16.0, h);
        let near = degrade.effective_max_sse(2.0, 0.0);
        let far = degrade.effective_max_sse(2.0, DEGRADE_FAR_HEIGHTS * h);
        assert!(near <= far);
    }

    #[test]
    fn floor_ramps_against_the_configured_ceiling() {
        // A lower ceiling makes the near-band floor reach 1.0 sooner: min=1,
        // max=8, m=8 → floor == 1, so the near tile gets the full multiplier.
        let h = 1000.0;
        let degrade = SseDegrade::new(8.0, h, 1.0, 8.0);
        let near = degrade.effective_max_sse(2.0, 0.0);
        assert!((near - 2.0 * 8.0).abs() < 1e-9, "near={near}");
    }

    #[test]
    fn degenerate_range_does_not_panic() {
        // max <= min: the span guard prevents div-by-zero. At the resting base
        // (multiplier == min == max) the near band is still fully protected
        // (floor 0 — it's at rest), and only far tiles take the multiplier.
        let h = 1000.0;
        let at_rest = SseDegrade::new(8.0, h, 8.0, 8.0);
        assert_eq!(at_rest.effective_max_sse(2.0, 0.0), 2.0);
        // Any multiplier ABOVE the degenerate min saturates the floor to 1, so
        // the near tile takes the full multiplier — no panic on the tiny span.
        let above = SseDegrade::new(16.0, h, 8.0, 8.0);
        let near = above.effective_max_sse(2.0, 0.0);
        assert!((near - 2.0 * 16.0).abs() < 1e-9, "near={near}");
    }
}

#[cfg(test)]
mod sse_pressure_tests {
    use super::*;
    use bevy_app::Update;

    fn new_app(budget: Option<u64>, gpu_est: u64) -> bevy_app::App {
        let mut app = bevy_app::App::new();
        app.init_resource::<BufferStore>();
        app.insert_resource(MemoryLedger {
            budget_bytes: budget,
            gpu_bytes_est: gpu_est,
            ..Default::default()
        });
        app.init_resource::<SsePressure>();
        app.add_systems(Update, update_sse_pressure);
        app
    }

    #[test]
    fn raises_one_step_per_stall_window_when_over_budget() {
        let mut app = new_app(Some(100), 1000);

        for _ in 0..PRESSURE_STALL_FRAMES - 1 {
            app.update();
        }
        assert_eq!(app.world().resource::<MemoryLedger>().sse_multiplier, 1.0);

        app.update();
        assert_eq!(app.world().resource::<MemoryLedger>().sse_multiplier, 1.25);
        assert_eq!(
            app.world().resource::<SsePressure>().multiplier,
            1.0,
            "0.25 delta is not > PRESSURE_PUBLISH_DELTA yet"
        );

        // A second full window raises again and now publishes.
        for _ in 0..PRESSURE_STALL_FRAMES {
            app.update();
        }
        assert_eq!(
            app.world().resource::<MemoryLedger>().sse_multiplier,
            1.5625
        );
        assert_eq!(app.world().resource::<SsePressure>().multiplier, 1.5625);
    }

    #[test]
    fn eviction_progress_resets_the_stall_window() {
        let mut app = new_app(Some(100), 1000);

        for _ in 0..PRESSURE_STALL_FRAMES * 3 {
            // Evictions progress every frame: pressure must never rise.
            app.world_mut().resource_mut::<MemoryLedger>().evicted_count += 1;
            app.update();
        }
        assert_eq!(app.world().resource::<MemoryLedger>().sse_multiplier, 1.0);
    }

    #[test]
    fn decays_and_snaps_back_to_exactly_one() {
        let mut app = new_app(Some(100), 1000);
        app.world_mut()
            .resource_mut::<MemoryLedger>()
            .sse_multiplier = 4.0;
        app.world_mut().resource_mut::<SsePressure>().multiplier = 4.0;

        // Drop usage to zero (below the evict target).
        app.world_mut().resource_mut::<MemoryLedger>().gpu_bytes_est = 0;

        let mut published = vec![4.0f32];
        for _ in 0..200 {
            app.update();
            let p = app.world().resource::<SsePressure>().multiplier;
            if p != *published.last().unwrap() {
                published.push(p);
            }
        }

        assert_eq!(app.world().resource::<MemoryLedger>().sse_multiplier, 1.0);
        assert_eq!(app.world().resource::<SsePressure>().multiplier, 1.0);
        // Quantized publishes: consecutive values differ by more than the
        // delta, except the final snap to exactly 1.0.
        for pair in published.windows(2) {
            let is_final_snap = pair[1] == 1.0;
            assert!(
                (pair[0] - pair[1]).abs() > PRESSURE_PUBLISH_DELTA || is_final_snap,
                "publish spam: {:?}",
                published
            );
        }
    }

    #[test]
    fn disabling_the_budget_resets_pressure() {
        let mut app = new_app(Some(100), 1000);
        app.world_mut()
            .resource_mut::<MemoryLedger>()
            .sse_multiplier = 4.0;
        app.world_mut().resource_mut::<SsePressure>().multiplier = 4.0;

        app.world_mut().resource_mut::<MemoryLedger>().budget_bytes = None;
        app.update();

        assert_eq!(app.world().resource::<MemoryLedger>().sse_multiplier, 1.0);
        assert_eq!(app.world().resource::<SsePressure>().multiplier, 1.0);
    }

    #[test]
    fn holds_in_the_hysteresis_band() {
        // usage 90 with budget 100: over target (85) but under budget.
        let mut app = new_app(Some(100), 90);
        app.world_mut()
            .resource_mut::<MemoryLedger>()
            .sse_multiplier = 2.0;

        for _ in 0..PRESSURE_STALL_FRAMES * 2 {
            app.update();
        }
        assert_eq!(app.world().resource::<MemoryLedger>().sse_multiplier, 2.0);
    }

    fn new_app_with_range(budget: Option<u64>, gpu_est: u64, min: f32, max: f32) -> bevy_app::App {
        let mut app = bevy_app::App::new();
        app.init_resource::<BufferStore>();
        app.insert_resource(MemoryLedger {
            budget_bytes: budget,
            gpu_bytes_est: gpu_est,
            min_sse_multiplier: min,
            max_sse_multiplier: max,
            ..Default::default()
        });
        app.init_resource::<SsePressure>();
        app.add_systems(Update, update_sse_pressure);
        app
    }

    #[test]
    fn base_multiplier_floor_settles_at_min() {
        // Under budget, no pressure: rests at the base (min), not 1.0.
        let mut app = new_app_with_range(Some(1000), 0, 1.5, 8.0);
        app.update();
        assert_eq!(app.world().resource::<MemoryLedger>().sse_multiplier, 1.5);
        // min != 1.0 so it must publish to SsePressure.
        assert_eq!(app.world().resource::<SsePressure>().multiplier, 1.5);
    }

    #[test]
    fn base_multiplier_applies_even_without_budget() {
        let mut app = new_app_with_range(None, 0, 2.0, 8.0);
        app.update();
        assert_eq!(app.world().resource::<MemoryLedger>().sse_multiplier, 2.0);
    }

    #[test]
    fn pressure_is_clamped_to_max() {
        // Tiny max: even sustained over-budget can't exceed it.
        let mut app = new_app_with_range(Some(100), 100_000, 1.0, 2.0);
        for _ in 0..PRESSURE_STALL_FRAMES * 20 {
            app.update();
        }
        assert_eq!(app.world().resource::<MemoryLedger>().sse_multiplier, 2.0);
    }

    #[test]
    fn decay_floors_at_min_not_one() {
        let mut app = new_app_with_range(Some(1000), 0, 1.5, 8.0);
        app.world_mut()
            .resource_mut::<MemoryLedger>()
            .sse_multiplier = 6.0;
        for _ in 0..500 {
            app.update();
        }
        // Decays down to the base floor, never below.
        assert_eq!(app.world().resource::<MemoryLedger>().sse_multiplier, 1.5);
        assert_eq!(app.world().resource::<SsePressure>().multiplier, 1.5);
    }

    /// Runs one full stall window while over budget so exactly one raise fires.
    fn raise_once(app: &mut bevy_app::App) -> f32 {
        app.world_mut().resource_mut::<MemoryLedger>().gpu_bytes_est = 1000;
        for _ in 0..PRESSURE_STALL_FRAMES {
            app.update();
        }
        app.world().resource::<MemoryLedger>().sse_multiplier
    }

    #[test]
    fn decay_waits_for_the_cooldown_after_a_raise() {
        let mut app = new_app(Some(100), 1000);
        let raised = raise_once(&mut app);
        assert_eq!(raised, 1.25);

        // Usage drops under the evict target, but the post-raise cooldown must
        // hold the multiplier — decaying immediately would re-refine, refetch
        // the just-evicted children and re-blow the budget (reload oscillation).
        app.world_mut().resource_mut::<MemoryLedger>().gpu_bytes_est = 0;
        for _ in 0..PRESSURE_DECAY_COOLDOWN_MIN_FRAMES {
            app.update();
            assert_eq!(
                app.world().resource::<MemoryLedger>().sse_multiplier,
                raised,
                "no decay during the cooldown"
            );
        }

        app.update();
        assert!(
            app.world().resource::<MemoryLedger>().sse_multiplier < raised,
            "decay resumes once the cooldown expires"
        );
    }

    #[test]
    fn cooldown_backs_off_exponentially_on_a_decay_reraise_round_trip() {
        let mut app = new_app(Some(100), 1000);
        raise_once(&mut app);

        // Drain the first cooldown and take one decay step.
        app.world_mut().resource_mut::<MemoryLedger>().gpu_bytes_est = 0;
        for _ in 0..PRESSURE_DECAY_COOLDOWN_MIN_FRAMES + 1 {
            app.update();
        }

        // The decay re-blew the budget → the next raise doubles the cooldown.
        let raised = raise_once(&mut app);
        app.world_mut().resource_mut::<MemoryLedger>().gpu_bytes_est = 0;
        for _ in 0..PRESSURE_DECAY_COOLDOWN_MIN_FRAMES * 2 {
            app.update();
            assert_eq!(
                app.world().resource::<MemoryLedger>().sse_multiplier,
                raised,
                "doubled cooldown holds twice as long"
            );
        }
        app.update();
        assert!(app.world().resource::<MemoryLedger>().sse_multiplier < raised);
    }

    #[test]
    fn load_gate_closes_at_budget_and_reopens_at_target() {
        // Budget 100, target 85. Start over budget: the gate must close so
        // traversals stop starting new child loads.
        let mut app = new_app(Some(100), 120);
        app.update();
        assert!(app.world().resource::<SsePressure>().load_gate_closed);

        // In the hysteresis band (target < usage < budget): hold closed.
        app.world_mut().resource_mut::<MemoryLedger>().gpu_bytes_est = 90;
        app.update();
        assert!(app.world().resource::<SsePressure>().load_gate_closed);

        // At/below the evict target: reopen so the descent resumes.
        app.world_mut().resource_mut::<MemoryLedger>().gpu_bytes_est = 85;
        app.update();
        assert!(!app.world().resource::<SsePressure>().load_gate_closed);

        // Back in the band from below: stay open (no flicker at the line).
        app.world_mut().resource_mut::<MemoryLedger>().gpu_bytes_est = 95;
        app.update();
        assert!(!app.world().resource::<SsePressure>().load_gate_closed);
    }

    #[test]
    fn full_retention_cache_keeps_the_gate_open_and_pressure_at_rest() {
        // gpu_est 1000 against a budget of 100 would normally close the gate
        // and ratchet pressure to the ceiling — but here it is ALL evictable
        // retention, so the resident footprint (hard_usage) is 0. A full-but-
        // healthy cache must not stall loads or coarsen LOD.
        let mut app = new_app(Some(100), 1000);
        app.world_mut()
            .resource_mut::<MemoryLedger>()
            .retained_evictable_bytes = 1000;

        for _ in 0..PRESSURE_STALL_FRAMES * 3 {
            app.update();
        }

        assert_eq!(app.world().resource::<MemoryLedger>().sse_multiplier, 1.0);
        assert!(!app.world().resource::<SsePressure>().load_gate_closed);
    }

    #[test]
    fn resident_set_over_budget_still_closes_the_gate() {
        // Same 1000 of gpu_est, but only 200 is evictable retention: the
        // resident footprint is 800 > budget 100, so the gate must still close
        // and pressure must still rise — genuine exhaustion is unchanged.
        let mut app = new_app(Some(100), 1000);
        app.world_mut()
            .resource_mut::<MemoryLedger>()
            .retained_evictable_bytes = 200;

        for _ in 0..PRESSURE_STALL_FRAMES {
            app.update();
        }

        assert!(app.world().resource::<SsePressure>().load_gate_closed);
        assert!(app.world().resource::<MemoryLedger>().sse_multiplier > 1.0);
    }

    #[test]
    fn reservations_close_the_load_gate() {
        // Budget 100; resident gpu is only 60 (< budget), but a 50-byte
        // reservation for in-flight fetches pushes hard_usage to 110 >= 100, so
        // the gate must close before the in-flight peak lands.
        let mut app = new_app(Some(100), 60);
        app.world_mut()
            .resource_mut::<MemoryLedger>()
            .reserved_bytes = 50;
        app.update();
        assert!(app.world().resource::<SsePressure>().load_gate_closed);

        // Release the reservation: usage drops to 60 <= target(85), gate reopens.
        app.world_mut()
            .resource_mut::<MemoryLedger>()
            .reserved_bytes = 0;
        app.update();
        assert!(!app.world().resource::<SsePressure>().load_gate_closed);
    }

    #[test]
    fn disabling_the_budget_opens_the_load_gate() {
        let mut app = new_app(Some(100), 120);
        app.update();
        assert!(app.world().resource::<SsePressure>().load_gate_closed);

        app.world_mut().resource_mut::<MemoryLedger>().budget_bytes = None;
        app.update();
        assert!(!app.world().resource::<SsePressure>().load_gate_closed);
    }
}
