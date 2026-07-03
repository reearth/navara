use bevy_ecs::prelude::*;

use navara_layer::{
    DeleteB3dmLayerMarker, DeleteCesium3dTilesLayerMarker, DeleteGeoJsonLayerMarker,
    DeleteMvtLayerMarker, DeletePntsLayerMarker, DeleteRasterTileLayerMarker, LayerDescStore,
    LayerDescription, LayerId, UpdateB3dmLayerMarker, UpdateCesium3dTilesLayerMarker,
    UpdateGeoJsonLayerMarker, UpdateMvtLayerMarker, UpdatePntsLayerMarker,
    UpdateRasterTileLayerMarker,
};
use navara_material::{Appearance, ElevationHeatmapConfig, HillshadeConfig};

#[derive(Debug, Clone, PartialEq, Message)]
pub struct AddLayerEvent(pub LayerDescription);

#[derive(Debug, Clone, PartialEq, Message)]
pub struct UpdateLayerEvent {
    pub layer_id: LayerId,
    pub appearance: Appearance,
    pub elevation_heatmap_config: Option<ElevationHeatmapConfig>,
    pub hillshade_config: Option<HillshadeConfig>,
}

#[derive(Debug, Clone, PartialEq, Message)]
pub struct DeleteLayerEvent(pub LayerId);

/// Generic "this layer's entity is alive" tag, added to every layer entity by
/// [`process_add_events`]. It exists continuously from the layer's add until a
/// per-crate delete system despawns the entity, so — unlike a teardown marker
/// that is spawned late and cleared within a frame — its presence/absence is a
/// deterministic, un-missable signal that [`flush_layer_reloads`] uses to detect
/// when a reset's teardown has completed.
#[derive(Debug, Clone, PartialEq, Component)]
pub struct LiveLayer(pub String);

/// A layer scheduled to be reset: torn down and re-added with `desc` once its
/// teardown finishes. Pushed by `App::reset_layer` when a referenced source
/// changes (see the source `update` flow).
#[derive(Debug, Clone, PartialEq)]
pub struct PendingReload {
    pub layer_id: String,
    pub desc: LayerDescription,
    /// Set once this layer's [`LiveLayer`] tag has been observed, so the re-add
    /// waits for teardown to actually start (guards the rare case of a reset
    /// queued before the layer entity has even spawned).
    pub seen_alive: bool,
    /// The layer's order index captured before teardown, restored on re-add so
    /// `get_layer_index` stays stable across a source update (teardown otherwise
    /// drops the index and the re-add would assign a fresh, higher one).
    pub order: Option<usize>,
}

/// Queue of layers waiting to be re-added after teardown, drained by
/// [`flush_layer_reloads`].
#[derive(Resource, Debug, Default)]
pub struct LayerReloadQueue {
    pub pending: Vec<PendingReload>,
}

pub fn process_add_events(mut commands: Commands, mut events: MessageReader<AddLayerEvent>) {
    for ev in events.read() {
        let AddLayerEvent(desc) = ev;
        // Tag every layer entity with a `LiveLayer` so `flush_layer_reloads` can
        // tell when a reset's old entity has been torn down.
        match desc {
            LayerDescription::Tiles(t) => {
                commands.spawn((*t.clone(), LiveLayer(t.layer_id.clone())));
            }
            LayerDescription::Terrain(t) => {
                commands.spawn((*t.clone(), LiveLayer(t.layer_id.clone())));
            }
            LayerDescription::GeoJson(t) => {
                commands.spawn((*t.clone(), LiveLayer(t.layer_id.clone())));
            }
            LayerDescription::B3dm(t) => {
                commands.spawn((*t.clone(), LiveLayer(t.layer_id.clone())));
            }
            LayerDescription::Pnts(t) => {
                commands.spawn((t.clone(), LiveLayer(t.layer_id.clone())));
            }
            LayerDescription::Mvt(t) => {
                commands.spawn((t.clone(), LiveLayer(t.layer_id.clone())));
            }
            LayerDescription::Cesium3dTiles(t) => {
                commands.spawn((t.clone(), LiveLayer(t.layer_id.clone())));
            }
        }
    }
}

pub fn process_update_events(
    mut commands: Commands,
    layer_desc_store: ResMut<LayerDescStore>,
    mut events: MessageReader<UpdateLayerEvent>,
) {
    for ev in events.read() {
        let layer_desc = match layer_desc_store.get(&ev.layer_id.0) {
            Some(l) => l,
            None => continue,
        };
        match layer_desc {
            LayerDescription::GeoJson(_) => {
                commands.spawn(UpdateGeoJsonLayerMarker {
                    appearance: ev.appearance.clone(),
                    layer_id: ev.layer_id.0.clone(),
                });
            }
            LayerDescription::B3dm(_) => {
                if let Appearance::Model(mat) = &ev.appearance {
                    commands.spawn(UpdateB3dmLayerMarker {
                        material: mat.clone(),
                        layer_id: ev.layer_id.0.clone(),
                    });
                }
            }
            LayerDescription::Pnts(_) => {
                if let Appearance::Model(mat) = &ev.appearance {
                    commands.spawn(UpdatePntsLayerMarker {
                        material: mat.clone(),
                        layer_id: ev.layer_id.0.clone(),
                    });
                }
            }
            LayerDescription::Cesium3dTiles(_) => {
                if let Appearance::Model(mat) = &ev.appearance {
                    commands.spawn(UpdateCesium3dTilesLayerMarker {
                        material: mat.clone(),
                        layer_id: ev.layer_id.0.clone(),
                    });
                }
            }
            LayerDescription::Mvt(_) => {
                commands.spawn(UpdateMvtLayerMarker {
                    appearance: ev.appearance.clone(),
                    layer_id: ev.layer_id.0.clone(),
                });
            }
            LayerDescription::Tiles(_) => {
                commands.spawn(UpdateRasterTileLayerMarker {
                    appearance: ev.appearance.clone(),
                    layer_id: ev.layer_id.0.clone(),
                    elevation_heatmap_config: ev.elevation_heatmap_config.clone(),
                    hillshade_config: ev.hillshade_config.clone(),
                });
            }
            _ => {}
        }
    }
}

pub fn process_delete_events(
    mut commands: Commands,
    mut layer_desc_store: ResMut<LayerDescStore>,
    mut events: MessageReader<DeleteLayerEvent>,
) {
    for ev in events.read() {
        let DeleteLayerEvent(layer_id) = ev;
        let layer_desc = match layer_desc_store.get(&layer_id.0) {
            Some(l) => l,
            None => continue,
        };
        let id = layer_id.0.clone();
        match layer_desc {
            LayerDescription::GeoJson(_) => {
                commands.spawn(DeleteGeoJsonLayerMarker(id));
            }
            LayerDescription::B3dm(_) => {
                commands.spawn(DeleteB3dmLayerMarker(id));
            }
            LayerDescription::Pnts(_) => {
                commands.spawn(DeletePntsLayerMarker(id));
            }
            LayerDescription::Cesium3dTiles(_) => {
                commands.spawn(DeleteCesium3dTilesLayerMarker(id));
            }
            LayerDescription::Mvt(_) => {
                commands.spawn(DeleteMvtLayerMarker(id));
            }
            LayerDescription::Tiles(_) => {
                commands.spawn(DeleteRasterTileLayerMarker(id));
            }
            _ => {}
        };
        // delete stored value in LayerDescStore.
        layer_desc_store.delete(&layer_id.0);
    }
}

/// Re-adds layers queued for reset once their teardown has completed.
///
/// A reset (source `update`) tears a layer down and re-adds it with the same
/// `layer_id`. The re-add must wait until teardown finishes: per-crate delete
/// systems match layer entities by `layer_id`, so a same-frame re-add could be
/// despawned by the still-pending teardown.
///
/// The teardown signal is the layer entity's [`LiveLayer`] tag, which exists
/// continuously from add until the per-crate delete system despawns the entity.
/// A queued reload re-adds once that tag has been **seen alive and then gone**:
/// its absence means the old entity was despawned (so the delete system ran and
/// the typed marker was consumed), and requiring it to have been seen first
/// guards the rare case of a reset queued before the layer entity has spawned.
/// Because the tag is continuous (not a brief marker), this observation can't be
/// missed regardless of per-crate delete scheduling.
pub fn flush_layer_reloads(
    mut queue: ResMut<LayerReloadQueue>,
    mut layer_desc_store: ResMut<LayerDescStore>,
    live: Query<&LiveLayer>,
    mut add_events: MessageWriter<AddLayerEvent>,
) {
    if queue.pending.is_empty() {
        return;
    }

    // Layer ids whose entity is currently alive.
    let alive: std::collections::HashSet<&str> = live.iter().map(|l| l.0.as_str()).collect();

    let mut ready: Vec<(String, LayerDescription, Option<usize>)> = Vec::new();
    queue.pending.retain_mut(|reload| {
        if alive.contains(reload.layer_id.as_str()) {
            // Old entity still alive: teardown in flight (or not started). Wait.
            reload.seen_alive = true;
            true
        } else if reload.seen_alive {
            // Was alive, now gone: teardown complete, safe to re-add.
            ready.push((reload.layer_id.clone(), reload.desc.clone(), reload.order));
            false
        } else {
            // Haven't seen the entity yet; wait for it to appear first.
            true
        }
    });

    for (layer_id, desc, order) in ready {
        // `process_delete_events` removed the stored description (and its order)
        // on teardown, so re-register it before respawning the layer entity,
        // restoring the captured order so `get_layer_index` stays stable.
        layer_desc_store.add_with_order(layer_id, desc.clone(), order);
        add_events.write(AddLayerEvent(desc));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bevy_app::{App, Update};
    use navara_layer::{LayerDescStore, TilesLayer};

    fn tiles_desc(id: &str) -> LayerDescription {
        LayerDescription::Tiles(Box::new(TilesLayer {
            layer_id: id.to_owned(),
            source_id: Some("s".to_owned()),
            appearance: None,
            elevation_heatmap_config: None,
            hillshade_config: None,
        }))
    }

    fn flush_app() -> App {
        let mut app = App::new();
        app.add_message::<AddLayerEvent>();
        app.init_resource::<LayerReloadQueue>();
        app.init_resource::<LayerDescStore>();
        app.add_systems(Update, flush_layer_reloads);
        app
    }

    fn queue_reload(app: &mut App, layer_id: &str) {
        app.world_mut()
            .resource_mut::<LayerReloadQueue>()
            .pending
            .push(PendingReload {
                layer_id: layer_id.to_owned(),
                desc: tiles_desc(layer_id),
                seen_alive: false,
                order: None,
            });
    }

    #[test]
    fn reload_waits_for_teardown_then_re_adds() {
        let mut app = flush_app();
        queue_reload(&mut app, "L");

        // The layer entity is alive (teardown in flight).
        let entity = app.world_mut().spawn(LiveLayer("L".to_owned())).id();

        // While the layer entity is alive, the reload stays queued.
        app.update();
        {
            let queue = app.world().resource::<LayerReloadQueue>();
            assert_eq!(queue.pending.len(), 1, "reload stays queued while alive");
            assert!(queue.pending[0].seen_alive, "the live layer is observed");
        }
        assert!(
            app.world().resource::<LayerDescStore>().get("L").is_none(),
            "layer is not re-registered while tearing down"
        );

        // Teardown completes: the layer entity is despawned.
        app.world_mut().entity_mut(entity).despawn();

        // Seen alive, now gone -> re-add.
        app.update();
        assert!(
            app.world()
                .resource::<LayerReloadQueue>()
                .pending
                .is_empty(),
            "reload is dropped once re-added"
        );
        assert!(
            app.world().resource::<LayerDescStore>().get("L").is_some(),
            "layer is re-registered after teardown completes"
        );
    }

    #[test]
    fn reload_does_not_fire_before_layer_seen_alive() {
        let mut app = flush_app();
        queue_reload(&mut app, "L");

        // No LiveLayer yet (entity not spawned): must not re-add, so a reset
        // queued before the layer entity exists doesn't fire prematurely.
        app.update();

        let queue = app.world().resource::<LayerReloadQueue>();
        assert_eq!(
            queue.pending.len(),
            1,
            "waits until the layer is seen alive"
        );
        assert!(!queue.pending[0].seen_alive);
        assert!(
            app.world().resource::<LayerDescStore>().get("L").is_none(),
            "layer must not be re-added before its entity is observed"
        );
    }

    /// End-to-end reset cycle with realistic timing: `process_delete_events`
    /// spawns the teardown marker, a stub per-crate consumer (mimicking
    /// `navara_tile::delete_layer`) despawns it a frame later, and
    /// `flush_layer_reloads` re-adds only afterwards. Guards against the re-add
    /// silently never firing (the "layer disappears but never comes back" bug).
    #[test]
    fn reset_cycle_tears_down_then_re_adds() {
        use navara_layer::{DeleteRasterTileLayerMarker, LayerId};

        let mut app = App::new();
        app.add_plugins(crate::LayerPlugin);
        app.init_resource::<LayerDescStore>();
        // The already-rendered layer entity, tagged `LiveLayer` as `process_add_events` would.
        app.world_mut()
            .spawn((tiles_layer_component("L"), LiveLayer("L".to_owned())));
        // Stub teardown consumer: despawn the raster delete marker entity plus the
        // matching layer entity (clearing its `LiveLayer`), like navara_tile.
        app.add_systems(
            Update,
            |mut commands: Commands,
             markers: Query<(Entity, &DeleteRasterTileLayerMarker)>,
             layers: Query<(Entity, &TilesLayer)>| {
                for (marker_entity, marker) in &markers {
                    for (layer_entity, layer) in &layers {
                        if layer.layer_id == marker.0 {
                            commands.entity(layer_entity).despawn();
                        }
                    }
                    commands.entity(marker_entity).despawn();
                }
            },
        );

        // Seed the stored description and emulate `App::reset_layer`.
        app.world_mut()
            .resource_mut::<LayerDescStore>()
            .add("L".to_owned(), tiles_desc("L"));
        app.world_mut()
            .write_message(DeleteLayerEvent(LayerId("L".to_owned())));
        queue_reload(&mut app, "L");

        // Drive several frames to let teardown complete and the reload fire.
        for _ in 0..6 {
            app.update();
        }

        assert!(
            app.world()
                .resource::<LayerReloadQueue>()
                .pending
                .is_empty(),
            "reload must be drained once teardown completes"
        );
        assert!(
            app.world().resource::<LayerDescStore>().get("L").is_some(),
            "layer must be re-registered after the reset cycle"
        );
        let layer_count = app
            .world_mut()
            .query::<&TilesLayer>()
            .iter(app.world())
            .filter(|l| l.layer_id == "L")
            .count();
        assert_eq!(
            layer_count, 1,
            "exactly one layer entity should exist after the reset (old torn down, new re-added)"
        );
    }

    fn tiles_layer_component(id: &str) -> TilesLayer {
        TilesLayer {
            layer_id: id.to_owned(),
            source_id: Some("s".to_owned()),
            appearance: None,
            elevation_heatmap_config: None,
            hillshade_config: None,
        }
    }
}
