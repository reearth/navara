//! Frame-level systems, ordering sets, and the [`MemoryPlugin`] that wires the
//! ledger, reservation estimator, and pressure controller into the schedule.

use bevy_app::{App, Plugin, PostUpdate, PreUpdate};
use bevy_ecs::prelude::{Res, ResMut};
use bevy_ecs::schedule::IntoScheduleConfigs;
use navara_buffer_store::BufferStore;

use crate::{MemoryLedger, ReserveEstimates, SsePressure, update_sse_pressure};

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
