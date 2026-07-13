//! Shared eviction-loop helpers, extracted from the per-layer
//! `enforce_memory_budget` systems (terrain / raster / vector / 3D Tiles) so
//! they share one policy instead of drifting. Each caller keeps only its
//! layer-specific entity/destroy logic and calls these pure helpers for the
//! filter / sort / target-loop bookkeeping.

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

#[cfg(test)]
mod tests {
    use super::*;

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
