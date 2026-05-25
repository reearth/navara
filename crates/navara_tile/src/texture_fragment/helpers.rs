use bevy_ecs::system::{Commands, Query};
use url::Url;

use navara_buffer_store::BufferStore;
use navara_component::{Order, OrderByDistance, Priority, Requested};
use navara_core::tile_url;
use navara_data_requester::{DataManager, DataRequester, DataRequesterExtension};
use navara_layer::TilesLayer;
use navara_material::Appearance;
use navara_texture_fragment::TextureFragment;
use navara_tile_component::{
    RasterTile, TileHandle, TileTextureFragmentMarker, TileTextureFragmentQuery,
};

use crate::hillshade::HillshadeTextureMarker;

#[allow(clippy::too_many_arguments)]
pub(crate) fn request_texture_fragment(
    commands: &mut Commands,
    leaf: &mut RasterTile,
    tiles: &Query<(&TilesLayer, &Order)>,
    handle: TileHandle,
    texture_fragment: &TileTextureFragmentQuery,
    data_requesters: &Query<&DataRequester>,
    priority: Priority,
    buf: &mut BufferStore,
    data_manager: &mut DataManager,
) {
    let sorted_tiles: Vec<_> = tiles.iter().sort::<&Order>().collect();
    let tiles_len = sorted_tiles.len();
    if tiles_len == 0 {
        return;
    }

    let coords = leaf.coords;
    let sse = leaf.sse;
    let distance_from_camera = leaf.distance_from_camera;

    // Both arrays must match `tiles_len`. Filter systems clear rejected slots
    // to None (rather than removing) so layer-index alignment is preserved
    // across frames. When a layer is added between calls, `add_order_to_tiles_layer`
    // assigns it the highest Order, so extending the arrays with trailing Nones
    // keeps existing layer indices intact; `delete_layer` handles shrinking.
    let tex_ids = leaf
        .texture_fragment_entity_ids
        .get_or_insert_with(|| vec![None; tiles_len]);
    if tex_ids.len() < tiles_len {
        tex_ids.resize(tiles_len, None);
    }
    let hill_ids = leaf
        .hillshade_entity_ids
        .get_or_insert_with(|| vec![None; tiles_len]);
    if hill_ids.len() < tiles_len {
        hill_ids.resize(tiles_len, None);
    }

    // Check whether every layer is already handled.
    // Out-of-zoom layers stay None; regular layers must have a queryable
    // TextureFragment entity; hillshade layers must have a queryable DataRequester.
    let all_layers_requested = {
        let tex_ids = leaf.texture_fragment_entity_ids.as_ref().unwrap();
        let hill_ids = leaf.hillshade_entity_ids.as_ref().unwrap();
        sorted_tiles.iter().enumerate().all(|(i, (layer, _))| {
            if !layer.is_over_min_zoom(coords.z) || layer.is_over_max_zoom(coords.z) {
                return true;
            }
            if layer.hillshade_config.is_some() {
                hill_ids[i].is_some_and(|e| data_requesters.get(e).is_ok())
            } else {
                tex_ids[i].is_some_and(|e| texture_fragment.contains(e))
            }
        })
    };
    if all_layers_requested {
        return;
    }

    for (i, (layer, _)) in sorted_tiles.iter().enumerate() {
        // Skip layers whose zoom range excludes this tile. The slot stays None.
        if !layer.is_over_min_zoom(coords.z) || layer.is_over_max_zoom(coords.z) {
            continue;
        }
        let is_hillshade = layer.hillshade_config.is_some();

        // Skip layers that already have a valid in-flight or completed entity.
        let already_requested = {
            let tex_ids = leaf.texture_fragment_entity_ids.as_ref().unwrap();
            let hill_ids = leaf.hillshade_entity_ids.as_ref().unwrap();
            if is_hillshade {
                hill_ids[i].is_some_and(|e| data_requesters.get(e).is_ok())
            } else {
                tex_ids[i].is_some_and(|e| texture_fragment.contains(e))
            }
        };
        if already_requested {
            continue;
        }

        let tms = matches!(layer.appearance.as_ref(), Some(Appearance::RasterTile(m)) if m.tms);
        let url = tile_url(layer.data.as_ref().unwrap().url.as_str(), &coords, tms);

        let entity_id = if is_hillshade {
            // Hillshade texture: use DataRequester so Rust can backfill edges.
            let extension = Url::parse(&url)
                .ok()
                .map(|parsed_url| DataRequesterExtension::from_url(&parsed_url))
                .unwrap_or(DataRequesterExtension::Png); // Fallback to PNG if URL parsing fails

            // Spawn entity first to get entity ID
            let entity_id = commands.spawn_empty().id();

            // Register with DataManager to get shared handle.
            // is_new=true means this is the first consumer for this URL.
            let (shared_handle, is_new) =
                data_manager.register_consumer(url.clone(), entity_id, buf);

            // Check if data already exists in BufferStore (loaded by previous consumer)
            let data_exists = buf.get_u8(&shared_handle).is_some();

            // Determine initial status: Success if data already loaded, otherwise Pending
            let initial_status = if !is_new && data_exists {
                navara_data_requester::DataRequesterStatus::Success
            } else {
                navara_data_requester::DataRequesterStatus::Pending
            };

            // Insert components with shared handle
            let mut entity_commands = commands.entity(entity_id);
            entity_commands.insert((
                TileTextureFragmentMarker(handle),
                HillshadeTextureMarker,
                DataRequester::new_with_status(shared_handle, url, extension, initial_status),
                OrderByDistance {
                    sse,
                    distance: distance_from_camera,
                },
                priority,
            ));

            // Insert Requested marker immediately if this entity should not trigger a fetch.
            // This prevents send_data_request_events from picking it up (filters Without<Requested>).
            if !is_new {
                entity_commands.insert(Requested);
            }

            entity_id
        } else {
            commands
                .spawn((
                    TileTextureFragmentMarker(handle),
                    TextureFragment::new(url),
                    OrderByDistance {
                        sse,
                        distance: distance_from_camera,
                    },
                    priority,
                ))
                .id()
        };

        if is_hillshade {
            leaf.hillshade_entity_ids.as_mut().unwrap()[i] = Some(entity_id);
        } else {
            leaf.texture_fragment_entity_ids.as_mut().unwrap()[i] = Some(entity_id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bevy_app::{App, Update};
    use bevy_ecs::{entity::Entity, prelude::Resource, system::ResMut};
    use navara_core::TileXYZ;
    use navara_layer::LayerData;
    use navara_material::{HillshadeConfig, RasterTileMaterial};

    fn regular_layer(layer_id: &str, min_zoom: usize, max_zoom: usize) -> TilesLayer {
        TilesLayer {
            layer_id: layer_id.to_string(),
            data: Some(LayerData {
                url: "https://example.com/{z}/{x}/{y}.png".to_string(),
            }),
            appearance: Some(Appearance::RasterTile(RasterTileMaterial {
                min_zoom,
                max_zoom,
                ..Default::default()
            })),
            elevation_heatmap_config: None,
            hillshade_config: None,
        }
    }

    fn hillshade_layer(layer_id: &str, min_zoom: usize, max_zoom: usize) -> TilesLayer {
        TilesLayer {
            layer_id: layer_id.to_string(),
            data: Some(LayerData {
                url: "https://example.com/{z}/{x}/{y}.png".to_string(),
            }),
            appearance: Some(Appearance::RasterTile(RasterTileMaterial {
                min_zoom,
                max_zoom,
                ..Default::default()
            })),
            elevation_heatmap_config: None,
            hillshade_config: Some(HillshadeConfig {
                elevation_decoder: Default::default(),
                exaggeration: 1.0,
            }),
        }
    }

    #[derive(Resource, Default, Clone)]
    struct CapturedSlots {
        tex_ids: Vec<Option<Entity>>,
        hill_ids: Vec<Option<Entity>>,
    }

    /// Run a single update where the caller can mutate a freshly-built `RasterTile`
    /// before and after the call to `request_texture_fragment`. The post-call state
    /// of both entity-id arrays is captured into `CapturedSlots`.
    fn run_request<F>(layers: Vec<(TilesLayer, Order)>, tile_z: usize, prepare: F) -> CapturedSlots
    where
        F: FnOnce(&mut RasterTile) + Send + Sync + 'static,
    {
        let mut app = App::new();
        app.init_resource::<BufferStore>();
        app.init_resource::<CapturedSlots>();
        app.init_resource::<DataManager>();

        for (layer, order) in layers {
            app.world_mut().spawn((layer, order));
        }

        let prepare = std::sync::Mutex::new(Some(prepare));
        app.add_systems(
            Update,
            move |mut commands: Commands,
                  mut buf: ResMut<BufferStore>,
                  mut data_manager: ResMut<DataManager>,
                  tiles: Query<(&TilesLayer, &Order)>,
                  texture_fragment: TileTextureFragmentQuery,
                  data_requesters: Query<&DataRequester>,
                  mut out: ResMut<CapturedSlots>| {
                let mut tile = RasterTile::new(
                    TileXYZ {
                        x: 0,
                        y: 0,
                        z: tile_z,
                    },
                    0.,
                    0.,
                );
                let prepare = prepare.lock().unwrap().take().unwrap();
                prepare(&mut tile);

                request_texture_fragment(
                    &mut commands,
                    &mut tile,
                    &tiles,
                    0,
                    &texture_fragment,
                    &data_requesters,
                    Priority::High,
                    &mut buf,
                    &mut data_manager,
                );

                out.tex_ids = tile.texture_fragment_entity_ids.clone().unwrap_or_default();
                out.hill_ids = tile.hillshade_entity_ids.clone().unwrap_or_default();
            },
        );
        app.update();
        app.world().resource::<CapturedSlots>().clone()
    }

    /// Regular layers must land in `texture_fragment_entity_ids` and hillshade
    /// layers must land in `hillshade_entity_ids` — never crossed. This is the
    /// invariant the misalignment bug used to break.
    #[test]
    fn mixed_layers_go_to_correct_arrays() {
        let captured = run_request(
            vec![
                (regular_layer("a", 0, 20), Order(0)),
                (regular_layer("c", 0, 20), Order(2)),
                (hillshade_layer("b", 0, 20), Order(1)),
            ],
            5,
            |_| {},
        );

        assert_eq!(captured.tex_ids.len(), 3);
        assert_eq!(captured.hill_ids.len(), 3);

        // Layer 0 (regular) — tex has Some, hill stays None.
        assert!(captured.tex_ids[0].is_some());
        assert!(captured.hill_ids[0].is_none());

        // Layer 1 (hillshade) — hill has Some, tex stays None.
        assert!(captured.tex_ids[1].is_none());
        assert!(captured.hill_ids[1].is_some());

        // Layer 2 (regular) — tex has Some, hill stays None.
        assert!(captured.tex_ids[2].is_some());
        assert!(captured.hill_ids[2].is_none());
    }

    /// When the filter has cleared a layer's slot to None, the next call must
    /// refill it into the array that matches the layer's type — the regression
    /// would refill a hillshade layer's slot into `texture_fragment_entity_ids`.
    #[test]
    fn filter_rejected_slots_refill_into_correct_array() {
        // Both arrays start at length 2 with all None — this is the state the
        // tile is in after the filter rejected the very first attempt on both
        // layers.
        let captured = run_request(
            vec![
                (regular_layer("a", 0, 20), Order(0)),
                (hillshade_layer("b", 0, 20), Order(1)),
            ],
            5,
            |tile| {
                tile.texture_fragment_entity_ids = Some(vec![None, None]);
                tile.hillshade_entity_ids = Some(vec![None, None]);
            },
        );

        // Layer 0 (regular) is refilled into tex.
        assert!(captured.tex_ids[0].is_some());
        assert!(captured.hill_ids[0].is_none());

        // Layer 1 (hillshade) is refilled into hill, NOT tex.
        assert!(
            captured.tex_ids[1].is_none(),
            "hillshade entity must not land in texture_fragment_entity_ids"
        );
        assert!(captured.hill_ids[1].is_some());
    }

    /// When a layer is added after the tile already has shorter arrays, the
    /// function must extend them (not panic). The new layer is always appended
    /// by `add_order_to_tiles_layer`, so trailing Nones preserve existing
    /// layer-to-index alignment.
    #[test]
    fn new_layer_with_shorter_existing_arrays_extends_without_panic() {
        let captured = run_request(
            vec![
                (regular_layer("a", 0, 20), Order(0)),
                (regular_layer("b", 0, 20), Order(1)),
                (regular_layer("c", 0, 20), Order(2)),
            ],
            5,
            |tile| {
                // Tile was previously built with only 2 layers; layer c was
                // added later. Without resize, accessing tex_ids[2] would panic.
                tile.texture_fragment_entity_ids = Some(vec![None, None]);
                tile.hillshade_entity_ids = Some(vec![None, None]);
            },
        );

        assert_eq!(captured.tex_ids.len(), 3);
        assert_eq!(captured.hill_ids.len(), 3);
        assert!(
            captured.tex_ids[2].is_some(),
            "newly appended layer must be spawned"
        );
    }

    /// Out-of-zoom layers must keep both array slots as `None` — no entity is
    /// spawned for them. This is what tells `is_texture_ready` apart from
    /// filter rejection.
    #[test]
    fn out_of_zoom_layer_leaves_both_slots_none() {
        // tile is at z=2, layer 1 has min_zoom=10 → out of range.
        let captured = run_request(
            vec![
                (regular_layer("a", 0, 20), Order(0)),
                (regular_layer("c", 0, 20), Order(2)),
                (regular_layer("b", 10, 20), Order(1)),
            ],
            2,
            |_| {},
        );

        assert_eq!(captured.tex_ids.len(), 3);
        assert_eq!(captured.hill_ids.len(), 3);

        assert!(captured.tex_ids[0].is_some());
        assert!(
            captured.tex_ids[1].is_none(),
            "out-of-zoom layer must not spawn"
        );
        assert!(captured.hill_ids[1].is_none());
        assert!(captured.tex_ids[2].is_some());
    }
}
