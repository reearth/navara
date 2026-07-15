use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, Res, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::{Deleted, Ignored, OrderByDistance, Priority, Requested};
use navara_data_requester::{DataRequester, DataRequesterStatus};
use navara_tile_component::{TerrainDataRequesterMarker, TerrainTileQuadtree};

#[allow(clippy::type_complexity, clippy::too_many_arguments)]
pub(crate) fn filter_requestable_data_requester(
    mut commands: Commands,
    mut qt: ResMut<TerrainTileQuadtree>,
    mut buf: ResMut<BufferStore>,
    data_requesters: Query<
        (
            Entity,
            &TerrainDataRequesterMarker,
            &DataRequester,
            &OrderByDistance,
            &Priority,
        ),
        (Added<TerrainDataRequesterMarker>, Without<Deleted>),
    >,
    requested_data_requesters: Query<
        &DataRequester,
        (
            With<TerrainDataRequesterMarker>,
            With<Requested>,
            Without<Deleted>,
        ),
    >,
    limits: Res<navara_data_requester::RequestLimits>,
    pressure: Res<navara_memory::SsePressure>,
    ledger: Res<navara_memory::MemoryLedger>,
) {
    // Count only Pending DataRequesters with Requested marker.
    // Success+Requested entities exist (shared-handle consumers with already-loaded data)
    // and should not count toward the limit.
    let pendings = requested_data_requesters
        .iter()
        .filter(|dr| dr.status == DataRequesterStatus::Pending)
        .count();
    // Load gate: when the memory budget is exhausted, start ZERO new fetches
    // and settle on the already-loaded tiles instead of evicting → refetching
    // in an endless loop. In-flight requests proceed; forcing `num_skip == 0`
    // rejects every newly-Added requester this frame so none is dispatched.
    let num_skip = if pressure.load_gate_closed {
        0
    } else {
        (limits.max_pendings as i32 - pendings as i32).max(0)
    };

    // Limit the number of requests in this frame.
    // Skip DataRequesters with Success status - they already have
    // their data (loaded by previous consumers) and should not be subject to the
    // MAX_PENDINGS limit. Rejecting them would cause create-delete loops.
    let admissible: Vec<_> = data_requesters
        .iter()
        .sort::<(&Priority, &OrderByDistance)>()
        .filter(|(_, _, data_req, _, _)| data_req.status != DataRequesterStatus::Success)
        .collect();

    // Reserve the estimated cost for the requesters actually dispatched this
    // frame (the admitted prefix that is NOT skipped/rejected below). The
    // amount (EMA of landed terrain mesh costs, seeded by
    // `terrain_reserve_seed` on a cold start) is resolved by the `ReservedCost`
    // on_insert hook; the reservation is released when the fetch resolves or
    // the requester is despawned (see `ReservedCost`).
    if ledger.enabled() {
        for (e, _, _, _, _) in admissible.iter().take(num_skip as usize) {
            commands
                .entity(*e)
                .try_insert(navara_memory::ReservedCost::for_key(
                    navara_memory::ReserveKey::Terrain,
                ));
        }
    }

    for (e, marker, _data_req, _, _) in admissible.into_iter().skip(num_skip as usize) {
        let handle = marker.0;
        let tile = qt.qt.get_mut(handle);
        if let Some(tile) = tile {
            if let Some(terrain_data) = tile.terrain_data.as_mut() {
                terrain_data.set_data_requester_entity_id(None);
                terrain_data.destroy(&mut buf);
                tile.terrain_data = None;
            };

            commands.entity(e).insert((Deleted, Ignored));
        }
    }
}

#[cfg(test)]
mod load_gate_tests {
    use super::*;
    use bevy_app::{App, Update};
    use navara_core::TileXYZ;
    use navara_data_requester::RequestLimits;
    use navara_memory::{MemoryLedger, SsePressure};
    use navara_tile_component::TerrainTile;

    fn setup(gate_closed: bool) -> (App, Entity) {
        let mut app = App::new();
        app.init_resource::<BufferStore>();
        app.init_resource::<RequestLimits>();
        app.init_resource::<MemoryLedger>();
        app.init_resource::<navara_memory::ReserveEstimates>();
        app.insert_resource(SsePressure {
            multiplier: 1.0,
            load_gate_closed: gate_closed,
            ..Default::default()
        });

        let mut qt = TerrainTileQuadtree::new_with_linear_qt();
        qt.qt
            .initialize_zero(&|(x, y, z)| TerrainTile::new(TileXYZ { x, y, z }, 0., 0.));
        let handle = qt.qt.zero().unwrap().handle();
        app.insert_resource(qt);

        let e = app
            .world_mut()
            .spawn((
                DataRequester::default(),
                TerrainDataRequesterMarker(handle),
                OrderByDistance {
                    sse: 0.0,
                    distance: 0.0,
                },
                Priority::High,
            ))
            .id();

        app.add_systems(Update, filter_requestable_data_requester);
        (app, e)
    }

    #[test]
    fn closed_gate_rejects_new_request() {
        let (mut app, e) = setup(true);
        // `Added` sees the previous frame; two ticks so the filter observes it.
        app.update();
        app.update();
        assert!(app.world().get::<Deleted>(e).is_some());
    }

    #[test]
    fn open_gate_admits_new_request() {
        let (mut app, e) = setup(false);
        app.update();
        app.update();
        assert!(app.world().get::<Deleted>(e).is_none());
    }
}

#[cfg(test)]
mod reservation_tests {
    use super::*;
    use bevy_app::{App, Update};
    use navara_core::TileXYZ;
    use navara_data_requester::{
        RequestLimits, release_landed_reservations, remove_removed_data_requesters,
    };
    use navara_memory::{MemoryLedger, ReservedCost, SsePressure};
    use navara_tile_component::{TerrainTile, TileHandle};

    /// Budget-enabled app with `max_pendings = 1` so exactly one of two
    /// requesters is admitted (reserved) and the other is skipped/rejected.
    fn setup(gate_closed: bool) -> (App, TileHandle, Vec<Entity>) {
        let mut app = App::new();
        app.init_resource::<BufferStore>();
        app.init_resource::<navara_memory::ReserveEstimates>();
        app.insert_resource(RequestLimits { max_pendings: 1 });
        app.insert_resource(MemoryLedger {
            budget_bytes: Some(1_000_000),
            ..Default::default()
        });
        app.insert_resource(SsePressure {
            multiplier: 1.0,
            load_gate_closed: gate_closed,
            ..Default::default()
        });

        let mut qt = TerrainTileQuadtree::new_with_linear_qt();
        qt.qt
            .initialize_zero(&|(x, y, z)| TerrainTile::new(TileXYZ { x, y, z }, 0., 0.));
        let handle = qt.qt.zero().unwrap().handle();
        app.insert_resource(qt);

        let entities: Vec<Entity> = (0..2)
            .map(|i| {
                app.world_mut()
                    .spawn((
                        DataRequester::default(),
                        TerrainDataRequesterMarker(handle),
                        OrderByDistance {
                            sse: i as f64,
                            distance: i as f64,
                        },
                        Priority::High,
                    ))
                    .id()
            })
            .collect();

        app.add_systems(Update, filter_requestable_data_requester);
        (app, handle, entities)
    }

    #[test]
    fn dispatched_requester_gets_a_reservation_skipped_does_not() {
        let (mut app, _handle, entities) = setup(false);
        // `Added` sees the previous frame; two ticks so the filter observes it.
        app.update();
        app.update();

        let reserve = app
            .world()
            .resource::<MemoryLedger>()
            .cost_hints
            .terrain_reserve_seed();

        // Exactly one requester (the admitted prefix, max_pendings = 1) is
        // reserved; the other is rejected (Deleted) and carries no reservation.
        let reserved: Vec<_> = entities
            .iter()
            .filter(|e| app.world().get::<ReservedCost>(**e).is_some())
            .collect();
        let deleted: Vec<_> = entities
            .iter()
            .filter(|e| app.world().get::<Deleted>(**e).is_some())
            .collect();
        assert_eq!(reserved.len(), 1, "one dispatched requester is reserved");
        assert_eq!(deleted.len(), 1, "one requester is rejected");
        assert_eq!(
            app.world().resource::<MemoryLedger>().reserved_bytes,
            reserve
        );
    }

    #[test]
    fn warm_estimator_replaces_the_cold_start_seed() {
        let (mut app, _handle, _entities) = setup(false);
        // Warm the terrain pool with landed mesh costs well away from the
        // seed; constant samples make the estimate exactly their value.
        let landed: u64 = 5 * 1024 * 1024;
        {
            let mut estimates = app
                .world_mut()
                .resource_mut::<navara_memory::ReserveEstimates>();
            for _ in 0..navara_memory::RESERVE_MIN_SAMPLES {
                estimates.record(navara_memory::ReserveKey::Terrain, landed);
            }
        }

        app.update();
        app.update();

        let seed = app
            .world()
            .resource::<MemoryLedger>()
            .cost_hints
            .terrain_reserve_seed();
        assert_ne!(landed, seed, "test must distinguish EMA from seed");
        // The one admitted requester (max_pendings = 1) is reserved with the
        // EMA estimate, not the cold-start seed.
        assert_eq!(
            app.world().resource::<MemoryLedger>().reserved_bytes,
            landed
        );
    }

    #[test]
    fn closed_gate_reserves_nothing() {
        let (mut app, _handle, _entities) = setup(true);
        app.update();
        app.update();
        // Gate closed → num_skip = 0 → no requester admitted → no reservation.
        assert_eq!(app.world().resource::<MemoryLedger>().reserved_bytes, 0);
    }

    #[test]
    fn despawn_while_pending_releases_the_reservation() {
        // Abort path: a still-`Pending` requester marked `Deleted` is despawned
        // by `remove_removed_data_requesters`, and the `ReservedCost` on_remove
        // hook must release its bytes so the gate never wedges shut.
        use bevy_app::PreUpdate;

        let mut app = App::new();
        app.init_resource::<BufferStore>();
        app.init_resource::<navara_data_requester::DataManager>();
        app.init_resource::<navara_event_store::EventStore>();
        app.init_resource::<MemoryLedger>();
        app.add_systems(PreUpdate, remove_removed_data_requesters);

        let e = app
            .world_mut()
            .spawn((DataRequester::default(), ReservedCost::fixed(4096)))
            .id();
        assert_eq!(app.world().resource::<MemoryLedger>().reserved_bytes, 4096);

        // Abort: mark Deleted while still Pending; the system despawns it.
        app.world_mut()
            .entity_mut(e)
            .insert(navara_component::Deleted);
        app.update();

        assert!(app.world().get_entity(e).is_err(), "requester despawned");
        assert_eq!(
            app.world().resource::<MemoryLedger>().reserved_bytes,
            0,
            "on_remove released the reservation on despawn"
        );
    }

    #[test]
    fn resolve_releases_the_reservation_before_the_cost_lands() {
        // When the fetch resolves (status leaves Pending),
        // `release_landed_reservations` removes `ReservedCost` so it never
        // coexists with the actual TileCost that lands a frame later.
        let mut app = App::new();
        app.insert_resource(MemoryLedger {
            budget_bytes: Some(1_000_000),
            ..Default::default()
        });
        app.add_systems(Update, release_landed_reservations);

        let dr = DataRequester {
            status: DataRequesterStatus::Success,
            ..Default::default()
        };
        let e = app.world_mut().spawn((dr, ReservedCost::fixed(4096))).id();
        assert_eq!(app.world().resource::<MemoryLedger>().reserved_bytes, 4096);

        app.update();

        assert!(app.world().get::<ReservedCost>(e).is_none());
        assert_eq!(app.world().resource::<MemoryLedger>().reserved_bytes, 0);
    }
}
