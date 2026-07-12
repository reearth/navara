use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, Res},
};
use navara_component::{Deleted, Ignored, OrderByDistance, Priority, Requested};
use navara_data_requester::DataRequester;
use navara_tile_component::VectorTileQuadtree;

use crate::{VectorTileSourceResources, layer::tile_cache_manager::TileCacheManager};

use super::VectorTileDataRequesterMarker;

#[allow(clippy::type_complexity, clippy::too_many_arguments)]
pub fn filter_requestable_data_requester(
    mut commands: Commands,
    layers: Query<(Entity, &VectorTileSourceResources)>,
    mut qts: Query<&mut VectorTileQuadtree>,
    mut tcs: Query<&mut TileCacheManager>,
    data_requesters: Query<
        (
            Entity,
            &VectorTileDataRequesterMarker,
            &DataRequester,
            &OrderByDistance,
            &Priority,
        ),
        (Added<VectorTileDataRequesterMarker>, Without<Deleted>),
    >,
    requested_data_requesters: Query<
        Entity,
        (
            With<VectorTileDataRequesterMarker>,
            With<DataRequester>,
            With<Requested>,
            Without<Deleted>,
        ),
    >,
    limits: Res<navara_data_requester::RequestLimits>,
    pressure: Res<navara_memory::SsePressure>,
    ledger: Res<navara_memory::MemoryLedger>,
    estimates: Res<navara_memory::ReserveEstimates>,
) {
    let pendings = requested_data_requesters.iter().count();
    // Load gate: when the memory budget is exhausted, start ZERO new fetches
    // and settle on the already-loaded tiles instead of evicting → refetching
    // in an endless loop. In-flight requests proceed; forcing `num_skip == 0`
    // rejects every newly-Added requester this frame so none is dispatched.
    let num_skip = if pressure.load_gate_closed {
        0
    } else {
        (limits.max_pendings as i32 - pendings as i32).max(0)
    };

    let dispatched: Vec<_> = data_requesters
        .iter()
        .sort::<(&Priority, &OrderByDistance)>()
        .collect();

    // Reserve the per-layer adaptive estimate (EMA of previously landed
    // geometry costs, seeded by the vector constant while cold) for each
    // requester actually dispatched this frame. Only the admitted prefix —
    // NOT the rejected ones below — gets a reservation. The owning layer is
    // found through its cache manager's `requested_tile_caches` slot, the
    // same link the reject loop uses.
    if ledger.enabled() {
        for (e, marker, _, _, _) in dispatched.iter().take(num_skip as usize) {
            let layer_key = layers.iter().find_map(|(layer_entity, layer)| {
                let tc = tcs.get(layer.tile_cache_manager).ok()?;
                (tc.requested_tile_caches.get(&marker.0) == Some(e)).then_some(layer_entity)
            });
            let bytes = layer_key
                .map(|k| {
                    estimates.estimate(
                        navara_memory::ReserveKey::Layer(k),
                        navara_memory::DEFAULT_VECTOR_TILE_RESERVE_BYTES,
                    )
                })
                .unwrap_or(navara_memory::DEFAULT_VECTOR_TILE_RESERVE_BYTES);
            commands
                .entity(*e)
                .try_insert(navara_memory::ReservedCost { bytes });
        }
    }

    for (e, marker, _, _, _) in dispatched.into_iter().skip(num_skip as usize) {
        let handle = marker.0;
        for (_, layer) in &layers {
            let Ok(mut qt) = qts.get_mut(layer.quadtree) else {
                continue;
            };
            let Ok(mut tc) = tcs.get_mut(layer.tile_cache_manager) else {
                continue;
            };

            if tc.requested_tile_caches.get(&handle) != Some(&e) {
                continue;
            }
            tc.requested_tile_caches.remove(&handle);

            let Some(tile) = qt.qt.get_mut(handle) else {
                continue;
            };
            tile.data_requester_entity_id = None;
        }
        commands.entity(e).try_insert((Deleted, Ignored));
    }
}

#[cfg(test)]
mod load_gate_tests {
    use super::*;
    use bevy_app::{App, Update};
    use navara_data_requester::RequestLimits;
    use navara_memory::{MemoryLedger, SsePressure};

    fn spawn_requester(app: &mut App) -> Entity {
        app.world_mut()
            .spawn((
                DataRequester::default(),
                VectorTileDataRequesterMarker(0),
                OrderByDistance {
                    sse: 0.0,
                    distance: 0.0,
                },
                Priority::High,
            ))
            .id()
    }

    fn setup(gate_closed: bool) -> App {
        let mut app = App::new();
        app.init_resource::<RequestLimits>();
        app.init_resource::<MemoryLedger>();
        app.init_resource::<navara_memory::ReserveEstimates>();
        app.insert_resource(SsePressure {
            multiplier: 1.0,
            load_gate_closed: gate_closed,
            ..Default::default()
        });
        app.add_systems(Update, filter_requestable_data_requester);
        app
    }

    #[test]
    fn closed_gate_rejects_new_request() {
        let mut app = setup(true);
        let e = spawn_requester(&mut app);
        // `Added` sees the previous frame; two ticks so the filter observes it.
        app.update();
        app.update();
        assert!(app.world().get::<Deleted>(e).is_some());
    }

    #[test]
    fn open_gate_admits_new_request() {
        let mut app = setup(false);
        let e = spawn_requester(&mut app);
        app.update();
        app.update();
        assert!(app.world().get::<Deleted>(e).is_none());
    }
}
