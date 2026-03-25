use bevy_ecs::{entity::Entity, system::Commands};
use navara_buffer_store::BufferStore;
use navara_component::OrderByDistance;
use navara_core::CRS;
use navara_feature_component::{
    BatchedFeatureMarker,
    batch::{BatchIndex, BatchTable},
    polygon::PolygonGeometry,
};
use navara_geojson_vt::types::TileGeometry;
use navara_geometry::{Hierarchy, WindingOrder};
use navara_material::Appearance;
use navara_tile_component::{OverscaledTileHandle, TileExtent, TileHandle};
use navara_vector_tile::VectorTileFeatureMarker;

use crate::geometry::builder::{GeometryAppearanceKind, GeometryBuilder};

/// Construct polygon entities from GeoJsonVt tile features.
///
/// Converts tile-local coordinates [0, extent] to normalized [-1, 1] space
/// (same as MVT's PosConverter::project_points_on_center) and spawns
/// flat polygon geometry entities for clamped rendering.
#[allow(clippy::too_many_arguments)]
pub(crate) fn construct_geojson_tile_geometry(
    commands: &mut Commands,
    batch_table: &mut BatchTable,
    buf: &mut BufferStore,
    tile: &navara_geojson_vt::types::Tile,
    extent: u32,
    layer_id: &str,
    appearances: &[Appearance],
    tile_info: Option<(
        TileHandle,
        navara_core::Extent<navara_math::FloatType, navara_core::Radians>,
    )>,
    order: &OrderByDistance,
) -> Option<Vec<Entity>> {
    if tile.features.is_empty() {
        return None;
    }

    let half_extent = extent as f64 / 2.0;

    let mut builder = GeometryBuilder::new(batch_table, layer_id);

    for feature in &tile.features {
        let props_map = match feature.properties.as_ref() {
            serde_json::Value::Object(m) => Some(m.clone()),
            _ => None,
        };
        builder.begin_feature(&props_map);

        // Other geometry type will be added.
        #[allow(clippy::single_match)]
        match &feature.geometry {
            TileGeometry::Polygons(polygons) => {
                for polygon in polygons {
                    if polygon.is_empty() {
                        continue;
                    }

                    let outer_ring = tile_coords_to_flat(&polygon[0], half_extent);

                    let holes: Vec<Hierarchy> = polygon[1..]
                        .iter()
                        .map(|ring| Hierarchy {
                            outer_ring: tile_coords_to_flat(ring, half_extent),
                            holes: None,
                            expected_winding_order: WindingOrder::Clockwise,
                        })
                        .collect();

                    if outer_ring.is_empty() {
                        continue;
                    }

                    let entity = commands
                        .spawn((
                            BatchedFeatureMarker,
                            PolygonGeometry {
                                hierarchy: Hierarchy {
                                    outer_ring,
                                    holes: if holes.is_empty() { None } else { Some(holes) },
                                    expected_winding_order: WindingOrder::CounterClockwise,
                                }
                                .transfer(buf),
                                crs: CRS::Geographic,
                            },
                        ))
                        .id();

                    let batch_index = builder.add_entity(GeometryAppearanceKind::Polygon, entity);
                    commands.entity(entity).insert(BatchIndex(batch_index));
                }
            }
            _ => {}
        }
    }

    let entities = builder
        .groups
        .finalize(commands, buf, appearances, layer_id, false);

    for &entity in &entities {
        if let Some((tile_handle, tile_extent)) = tile_info {
            commands.entity(entity).insert((
                OverscaledTileHandle::new(tile_handle),
                TileExtent::new(tile_extent),
            ));
        }
        commands
            .entity(entity)
            .insert((order.clone(), VectorTileFeatureMarker));
    }

    if entities.is_empty() {
        None
    } else {
        Some(entities)
    }
}

/// Convert tile coordinates [0, extent] to normalized [-1, 1] flat coordinates.
///
/// This matches MVT's PosConverter::project_points_on_center behavior:
/// - x = (tile_x - extent/2) / (extent/2)
/// - y = -(tile_y - extent/2) / (extent/2)
/// - z = 0
fn tile_coords_to_flat(points: &[[f64; 2]], half_extent: f64) -> Vec<f64> {
    let mut ret = Vec::with_capacity(points.len() * 3);
    for pt in points {
        ret.push((pt[0] - half_extent) / half_extent);
        ret.push(-(pt[1] - half_extent) / half_extent);
        ret.push(0.0);
    }
    ret
}

#[cfg(test)]
mod test {
    use super::*;

    use std::sync::Arc;

    use bevy_app::{App, Update};
    use bevy_ecs::prelude::Resource;
    use bevy_ecs::query::With;
    use bevy_ecs::system::{Commands, ResMut};
    use navara_feature_component::{
        batch::{BatchTable, BatchedFeature},
        polygon::{PolygonGeometry, PolygonMarker},
    };
    use navara_geojson_vt::types::{Tile as VtTile, TileFeature};
    use navara_material::PolygonMaterial;

    // ── helpers ──────────────────────────────────────────────────────────

    fn polygon_feature(coords: Vec<Vec<[f64; 2]>>) -> TileFeature {
        TileFeature {
            geometry: TileGeometry::Polygons(vec![coords]),
            properties: Arc::new(serde_json::json!({})),
        }
    }

    fn polygon_feature_with_props(
        coords: Vec<Vec<[f64; 2]>>,
        props: serde_json::Value,
    ) -> TileFeature {
        TileFeature {
            geometry: TileGeometry::Polygons(vec![coords]),
            properties: Arc::new(props),
        }
    }

    fn point_feature(coords: Vec<[f64; 2]>) -> TileFeature {
        TileFeature {
            geometry: TileGeometry::Points(coords),
            properties: Arc::new(serde_json::json!({})),
        }
    }

    fn line_feature(coords: Vec<Vec<[f64; 2]>>) -> TileFeature {
        TileFeature {
            geometry: TileGeometry::Lines(coords),
            properties: Arc::new(serde_json::json!({})),
        }
    }

    fn make_tile(features: Vec<TileFeature>) -> VtTile {
        VtTile {
            features,
            z: 0,
            x: 0,
            y: 0,
            num_points: 0,
            num_simplified: 0,
            features_bbox: None,
        }
    }

    fn polygon_appearances() -> Vec<Appearance> {
        vec![Appearance::Polygon(PolygonMaterial {
            clamp_to_ground: true,
            ..Default::default()
        })]
    }

    #[derive(Resource)]
    struct TestInput {
        tile: VtTile,
        extent: u32,
        appearances: Vec<Appearance>,
    }

    #[derive(Resource, Default)]
    struct TestOutput(Option<Vec<Entity>>);

    fn test_system(
        mut commands: Commands,
        mut batch_table: ResMut<BatchTable>,
        mut buf: ResMut<BufferStore>,
        input: bevy_ecs::system::Res<TestInput>,
        mut out: ResMut<TestOutput>,
    ) {
        let order = OrderByDistance {
            sse: 0.0,
            distance: 0.0,
        };
        out.0 = construct_geojson_tile_geometry(
            &mut commands,
            &mut batch_table,
            &mut buf,
            &input.tile,
            input.extent,
            "test_layer",
            &input.appearances,
            None,
            &order,
        );
    }

    fn run_construct(tile: VtTile, appearances: Vec<Appearance>) -> App {
        let mut app = App::new();
        app.init_resource::<BufferStore>();
        app.init_resource::<BatchTable>();
        app.init_resource::<TestOutput>();
        app.insert_resource(TestInput {
            tile,
            extent: 4096,
            appearances,
        });
        app.add_systems(Update, test_system);
        app.update();
        app
    }

    // ── tile_coords_to_flat unit tests ──────────────────────────────────

    #[test]
    fn tile_coords_center_maps_to_origin() {
        let half = 2048.0;
        let result = tile_coords_to_flat(&[[2048.0, 2048.0]], half);
        assert_eq!(result, vec![0.0, 0.0, 0.0]);
    }

    #[test]
    fn tile_coords_corners_map_to_normalized() {
        let half = 2048.0;
        let result = tile_coords_to_flat(&[[0.0, 0.0], [4096.0, 4096.0]], half);
        // (0 - 2048)/2048 = -1, -(0 - 2048)/2048 = 1
        assert_eq!(result[0], -1.0); // x
        assert_eq!(result[1], 1.0); // y (inverted)
        assert_eq!(result[2], 0.0); // z
        // (4096 - 2048)/2048 = 1, -(4096 - 2048)/2048 = -1
        assert_eq!(result[3], 1.0);
        assert_eq!(result[4], -1.0);
        assert_eq!(result[5], 0.0);
    }

    #[test]
    fn tile_coords_empty_returns_empty() {
        let result = tile_coords_to_flat(&[], 2048.0);
        assert!(result.is_empty());
    }

    #[test]
    fn tile_coords_produces_three_components_per_point() {
        let result = tile_coords_to_flat(&[[100.0, 200.0], [300.0, 400.0]], 2048.0);
        assert_eq!(result.len(), 6);
    }

    // ── construct_geojson_tile_geometry tests ───────────────────────────

    #[test]
    fn empty_tile_returns_none() {
        let tile = make_tile(vec![]);
        let app = run_construct(tile, polygon_appearances());
        let out = app.world().resource::<TestOutput>();
        assert!(out.0.is_none());
    }

    #[test]
    fn single_polygon_creates_batched_feature() {
        let outer = vec![
            [0.0, 0.0],
            [4096.0, 0.0],
            [4096.0, 4096.0],
            [0.0, 4096.0],
            [0.0, 0.0],
        ];
        let tile = make_tile(vec![polygon_feature(vec![outer])]);
        let mut app = run_construct(tile, polygon_appearances());

        // One BatchedFeature parent with PolygonMarker
        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolygonMarker>>();
        let batched: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched.len(), 1);
        assert_eq!(batched[0].features.len(), 1);
        // Tiled GeoJSON features use default_active = false (activated by tile visibility)
        assert!(!batched[0].default_active);

        // One child entity with PolygonGeometry
        let mut child_query = app
            .world_mut()
            .query_filtered::<&PolygonGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(child_query.iter(app.world()).count(), 1);

        // Parent should have VectorTileFeatureMarker
        let mut marker_query = app
            .world_mut()
            .query_filtered::<&VectorTileFeatureMarker, With<PolygonMarker>>();
        assert_eq!(marker_query.iter(app.world()).count(), 1);

        // Should return entity IDs
        let out = app.world().resource::<TestOutput>();
        let entities = out.0.as_ref().unwrap();
        assert_eq!(entities.len(), 1);
    }

    #[test]
    fn multiple_features_create_multiple_children() {
        let outer1 = vec![
            [0.0, 0.0],
            [2048.0, 0.0],
            [2048.0, 2048.0],
            [0.0, 2048.0],
            [0.0, 0.0],
        ];
        let outer2 = vec![
            [2048.0, 2048.0],
            [4096.0, 2048.0],
            [4096.0, 4096.0],
            [2048.0, 4096.0],
            [2048.0, 2048.0],
        ];
        let tile = make_tile(vec![
            polygon_feature(vec![outer1]),
            polygon_feature(vec![outer2]),
        ]);
        let mut app = run_construct(tile, polygon_appearances());

        // One BatchedFeature parent with 2 child features
        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolygonMarker>>();
        let batched: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched.len(), 1);
        assert_eq!(batched[0].features.len(), 2);

        // Two child entities with PolygonGeometry
        let mut child_query = app
            .world_mut()
            .query_filtered::<&PolygonGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(child_query.iter(app.world()).count(), 2);
    }

    #[test]
    fn polygon_with_hole_creates_single_child() {
        let outer = vec![
            [0.0, 0.0],
            [4096.0, 0.0],
            [4096.0, 4096.0],
            [0.0, 4096.0],
            [0.0, 0.0],
        ];
        let hole = vec![
            [1024.0, 1024.0],
            [3072.0, 1024.0],
            [3072.0, 3072.0],
            [1024.0, 3072.0],
            [1024.0, 1024.0],
        ];
        let tile = make_tile(vec![polygon_feature(vec![outer, hole])]);
        let mut app = run_construct(tile, polygon_appearances());

        // One child with polygon geometry (hole is part of the same polygon)
        let mut child_query = app
            .world_mut()
            .query_filtered::<&PolygonGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(child_query.iter(app.world()).count(), 1);
    }

    #[test]
    fn non_polygon_geometry_produces_no_entities() {
        let tile = make_tile(vec![
            point_feature(vec![[2048.0, 2048.0]]),
            line_feature(vec![vec![[0.0, 0.0], [4096.0, 4096.0]]]),
        ]);
        let app = run_construct(tile, polygon_appearances());
        let out = app.world().resource::<TestOutput>();
        assert!(out.0.is_none());
    }

    #[test]
    fn empty_polygon_ring_is_skipped() {
        // A polygon with an empty outer ring should be skipped
        let tile = make_tile(vec![polygon_feature(vec![vec![]])]);
        let app = run_construct(tile, polygon_appearances());
        let out = app.world().resource::<TestOutput>();
        assert!(out.0.is_none());
    }

    #[test]
    fn mismatched_appearance_produces_no_entities() {
        let outer = vec![
            [0.0, 0.0],
            [4096.0, 0.0],
            [4096.0, 4096.0],
            [0.0, 4096.0],
            [0.0, 0.0],
        ];
        let tile = make_tile(vec![polygon_feature(vec![outer])]);
        // Use a non-polygon appearance
        let app = run_construct(
            tile,
            vec![Appearance::Polyline(
                navara_material::PolylineMaterial::default(),
            )],
        );
        let out = app.world().resource::<TestOutput>();
        assert!(out.0.is_none());
    }

    #[test]
    fn tile_info_attaches_overscaled_handle_and_extent() {
        // Use a dedicated system that passes tile_info
        let mut app = App::new();
        app.init_resource::<BufferStore>();
        app.init_resource::<BatchTable>();
        app.init_resource::<TestOutput>();

        let outer = vec![
            [0.0, 0.0],
            [4096.0, 0.0],
            [4096.0, 4096.0],
            [0.0, 4096.0],
            [0.0, 0.0],
        ];
        let tile = make_tile(vec![polygon_feature(vec![outer])]);

        app.insert_resource(TestInput {
            tile,
            extent: 4096,
            appearances: polygon_appearances(),
        });

        app.add_systems(
            Update,
            |mut commands: Commands,
             mut batch_table: ResMut<BatchTable>,
             mut buf: ResMut<BufferStore>,
             input: bevy_ecs::system::Res<TestInput>,
             mut out: ResMut<TestOutput>| {
                let order = OrderByDistance {
                    sse: 0.0,
                    distance: 0.0,
                };
                let tile_handle: TileHandle = 42;
                let tile_extent = navara_core::Extent::default();
                out.0 = construct_geojson_tile_geometry(
                    &mut commands,
                    &mut batch_table,
                    &mut buf,
                    &input.tile,
                    input.extent,
                    "test_layer",
                    &input.appearances,
                    Some((tile_handle, tile_extent)),
                    &order,
                );
            },
        );
        app.update();

        // Should have OverscaledTileHandle and TileExtent on the parent entity
        let mut handle_query = app.world_mut().query::<&OverscaledTileHandle>();
        assert_eq!(handle_query.iter(app.world()).count(), 1);

        let mut extent_query = app.world_mut().query::<&TileExtent>();
        assert_eq!(extent_query.iter(app.world()).count(), 1);
    }

    #[test]
    fn order_by_distance_is_attached_to_entities() {
        let outer = vec![
            [0.0, 0.0],
            [4096.0, 0.0],
            [4096.0, 4096.0],
            [0.0, 4096.0],
            [0.0, 0.0],
        ];
        let tile = make_tile(vec![polygon_feature(vec![outer])]);
        let mut app = run_construct(tile, polygon_appearances());

        let mut order_query = app
            .world_mut()
            .query_filtered::<&OrderByDistance, With<PolygonMarker>>();
        assert_eq!(order_query.iter(app.world()).count(), 1);
    }

    #[test]
    fn feature_properties_are_stored_in_batch_table() {
        let outer = vec![
            [0.0, 0.0],
            [4096.0, 0.0],
            [4096.0, 4096.0],
            [0.0, 4096.0],
            [0.0, 0.0],
        ];
        let tile = make_tile(vec![polygon_feature_with_props(
            vec![outer],
            serde_json::json!({"name": "test_polygon", "id": 42}),
        )]);
        let app = run_construct(tile, polygon_appearances());

        // Verify batch table has entries (properties are stored there)
        let batch_table = app.world().resource::<BatchTable>();
        assert!(!batch_table.is_empty());
    }

    #[test]
    fn multipolygon_creates_multiple_children_from_single_feature() {
        // A feature with multiple polygon geometries (Polygons variant wraps Vec<Vec<Vec<...>>>)
        let poly1_outer = vec![
            [0.0, 0.0],
            [2048.0, 0.0],
            [2048.0, 2048.0],
            [0.0, 2048.0],
            [0.0, 0.0],
        ];
        let poly2_outer = vec![
            [2048.0, 2048.0],
            [4096.0, 2048.0],
            [4096.0, 4096.0],
            [2048.0, 4096.0],
            [2048.0, 2048.0],
        ];
        // Create a feature with two separate polygon rings
        let feature = TileFeature {
            geometry: TileGeometry::Polygons(vec![vec![poly1_outer], vec![poly2_outer]]),
            properties: Arc::new(serde_json::json!({})),
        };
        let tile = make_tile(vec![feature]);
        let mut app = run_construct(tile, polygon_appearances());

        // Two polygon child entities from a single TileFeature with two polygons
        let mut child_query = app
            .world_mut()
            .query_filtered::<&PolygonGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(child_query.iter(app.world()).count(), 2);

        // BatchedFeature.features holds child entities, so len() == 2
        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolygonMarker>>();
        let batched: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched.len(), 1);
        assert_eq!(batched[0].features.len(), 2);
    }
}
