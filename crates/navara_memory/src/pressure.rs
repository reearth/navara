//! Memory-pressure LOD control: the distance-weighted [`SseDegrade`], the
//! quantized [`SsePressure`] published to traversals, and the
//! [`update_sse_pressure`] controller that maintains them (raise on stalled
//! over-budget, decay under target with a post-raise cooldown).

use bevy_ecs::prelude::{Local, Res, ResMut, Resource};
use navara_buffer_store::BufferStore;

use crate::{
    DEGRADE_FAR_HEIGHTS, DEGRADE_MIN_CAMERA_HEIGHT, DEGRADE_NEAR_HEIGHTS, MAX_SSE_MULTIPLIER,
    MemoryLedger, PRESSURE_DECAY, PRESSURE_DECAY_COOLDOWN_MAX_FRAMES,
    PRESSURE_DECAY_COOLDOWN_MIN_FRAMES, PRESSURE_PUBLISH_DELTA, PRESSURE_RAISE_STEP,
    PRESSURE_STALL_FRAMES,
};

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
    mut local: Local<PressureLocal>,
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
