//! Per-tile GPU cost accounting: the [`TileCost`] component and the retention
//! pool entry that carries it.

use bevy_ecs::lifecycle::HookContext;
use bevy_ecs::prelude::Component;
use bevy_ecs::world::DeferredWorld;

use crate::MemoryLedger;

/// Estimated memory cost of a rendered tile. `cpu` covers bytes held in the
/// WASM heap that are not already accounted by [`BufferStore`](navara_buffer_store::BufferStore);
/// `gpu_est` is a deterministic estimate of GPU-side allocations (textures,
/// render targets, vertex buffers) owned by the JS side for this tile.
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

/// Entry in a per-layer retention pool: a tile that is no longer visited but
/// is kept alive (deactivated) until the memory budget forces eviction.
#[derive(Clone, Copy, Debug)]
pub struct RetainedEntry {
    /// Frame at which the tile was moved into the retention pool.
    pub retained_at: usize,
    pub cost: TileCost,
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
