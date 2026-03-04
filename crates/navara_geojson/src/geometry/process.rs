use bevy_ecs::entity::Entity;
use bevy_ecs::system::Commands;

use navara_buffer_store::BufferStore;
use navara_core::CRS;
use navara_feature_component::{
    BatchedFeatureMarker,
    batch::{BatchIndex, BatchTable},
    geometry_builder::spawn_point_entity,
    polygon::PolygonGeometry,
    polyline::PolylineGeometry,
};
use navara_geometry::{Hierarchy, WindingOrder};
use navara_material::Appearance;
use navara_math::Vec3;
use navara_parser::geojson::{GeoJson, Geometry, Value};

use super::builder::{GeometryAppearanceKind, GeometryBuilder};

fn coords(f: &[f64]) -> Vec3 {
    Vec3::new(f[0], f[1], *f.get(2).unwrap_or(&0.))
}

fn multi_flat_coords(f: &[Vec<f64>]) -> Vec<f64> {
    f.iter()
        .flat_map(|p| [p[0], p[1], *p.get(2).unwrap_or(&0.)])
        .collect::<Vec<_>>()
}

fn get_polygon_holes(f: &[Vec<Vec<f64>>]) -> Option<Vec<Hierarchy>> {
    let holes: Vec<Hierarchy> = f[1..]
        .iter()
        .map(|hole| Hierarchy {
            outer_ring: multi_flat_coords(hole),
            holes: None,
            expected_winding_order: WindingOrder::Unknown,
        })
        .collect();

    (!holes.is_empty()).then_some(holes)
}

/// Construct batched feature entities from GeoJSON data.
///
/// This follows the MVT batched feature pattern:
/// 1. For each feature, spawn child entities with `BatchedFeatureMarker` + geometry + `BatchIndex`
/// 2. Group children by geometry-appearance kind
/// 3. Spawn a `BatchedFeature` parent for each group with the appropriate marker and material
///
/// Returns the spawned `BatchedFeature` parent entity IDs.
pub fn construct_geometry(
    commands: &mut Commands,
    batch_table: &mut BatchTable,
    buf: &mut BufferStore,
    geojson: &GeoJson,
    appearances: &[Appearance],
    layer_id: &str,
) -> Vec<Entity> {
    let mut builder = GeometryBuilder::new(batch_table, layer_id);

    match geojson {
        GeoJson::FeatureCollection(features) => {
            for feature in features {
                if let Some(geometry) = &feature.geometry {
                    builder.begin_feature(&feature.properties);
                    process_geometry(commands, buf, &mut builder, geometry, appearances);
                }
            }
        }
        GeoJson::Feature(feature) => {
            if let Some(geometry) = &feature.geometry {
                builder.begin_feature(&feature.properties);
                process_geometry(commands, buf, &mut builder, geometry, appearances);
            }
        }
        GeoJson::Geometry(geometry) => {
            builder.begin_feature(&None);
            process_geometry(commands, buf, &mut builder, geometry, appearances);
        }
    }

    builder
        .groups
        .finalize(commands, buf, appearances, layer_id, true)
}

/// Process a single GeoJSON geometry, spawning child entities for each matching appearance.
///
/// `begin_feature` must be called by the caller before invoking this function.
/// GeometryCollection recurses without resetting feature state, so all
/// sub-geometries share a single feature's batch indices and properties.
fn process_geometry(
    commands: &mut Commands,
    buf: &mut BufferStore,
    builder: &mut GeometryBuilder,
    geometry: &Geometry,
    appearances: &[Appearance],
) {
    // Handle GeometryCollection by recursing into each sub-geometry.
    // No begin_feature here — sub-geometries share the parent feature's state.
    if let Value::GeometryCollection(geoms) = &geometry.value {
        for g in geoms {
            process_geometry(commands, buf, builder, g, appearances);
        }
        return;
    }

    for appearance in appearances {
        match appearance {
            Appearance::Point(_) => {
                spawn_point_children(commands, builder, geometry, GeometryAppearanceKind::Point);
            }
            Appearance::Billboard(_) => {
                spawn_point_children(
                    commands,
                    builder,
                    geometry,
                    GeometryAppearanceKind::Billboard,
                );
            }
            Appearance::Text(_) => {
                spawn_point_children(commands, builder, geometry, GeometryAppearanceKind::Text);
            }
            Appearance::Polyline(_) => {
                spawn_polyline_children(commands, buf, builder, geometry);
            }
            Appearance::Polygon(_) => {
                spawn_polygon_children(commands, buf, builder, geometry);
            }
            _ => {}
        }
    }
}

/// Spawn child entities for point-like geometry (Point, Billboard, Text).
fn spawn_point_children(
    commands: &mut Commands,
    builder: &mut GeometryBuilder,
    geometry: &Geometry,
    kind: GeometryAppearanceKind,
) {
    let spawn_one = |commands: &mut Commands, builder: &mut GeometryBuilder, coord: Vec3| {
        let entity = spawn_point_entity(commands, coord, CRS::Geographic, kind);
        let batch_index = builder.add_entity(kind, entity);
        commands.entity(entity).insert(BatchIndex(batch_index));
    };

    match &geometry.value {
        Value::Point(f) => {
            spawn_one(commands, builder, coords(f));
        }
        Value::MultiPoint(fs) => {
            for f in fs {
                spawn_one(commands, builder, coords(f));
            }
        }
        _ => {}
    }
}

/// Spawn child entities for polyline geometry.
fn spawn_polyline_children(
    commands: &mut Commands,
    buf: &mut BufferStore,
    builder: &mut GeometryBuilder,
    geometry: &Geometry,
) {
    let kind = GeometryAppearanceKind::Polyline;

    let spawn_one = |commands: &mut Commands,
                     buf: &mut BufferStore,
                     builder: &mut GeometryBuilder,
                     flat_coords: Vec<f64>| {
        let entity = commands
            .spawn((
                BatchedFeatureMarker,
                PolylineGeometry::with_buf(buf, flat_coords, CRS::Geographic),
            ))
            .id();

        let batch_index = builder.add_entity(kind, entity);
        commands.entity(entity).insert(BatchIndex(batch_index));
    };

    match &geometry.value {
        Value::LineString(f) => {
            spawn_one(commands, buf, builder, multi_flat_coords(f));
        }
        Value::MultiLineString(fs) => {
            for f in fs {
                spawn_one(commands, buf, builder, multi_flat_coords(f));
            }
        }
        _ => {}
    }
}

/// Spawn child entities for polygon geometry.
fn spawn_polygon_children(
    commands: &mut Commands,
    buf: &mut BufferStore,
    builder: &mut GeometryBuilder,
    geometry: &Geometry,
) {
    let kind = GeometryAppearanceKind::Polygon;

    let spawn_one = |commands: &mut Commands,
                     buf: &mut BufferStore,
                     builder: &mut GeometryBuilder,
                     f: &[Vec<Vec<f64>>]| {
        let entity = commands
            .spawn((
                BatchedFeatureMarker,
                PolygonGeometry {
                    hierarchy: Hierarchy {
                        outer_ring: f
                            .first()
                            .map_or_else(std::vec::Vec::new, |v| multi_flat_coords(v)),
                        holes: get_polygon_holes(f),
                        expected_winding_order: WindingOrder::Unknown,
                    }
                    .transfer(buf),
                    crs: CRS::Geographic,
                },
            ))
            .id();

        let batch_index = builder.add_entity(kind, entity);
        commands.entity(entity).insert(BatchIndex(batch_index));
    };

    match &geometry.value {
        Value::Polygon(f) => {
            spawn_one(commands, buf, builder, f);
        }
        Value::MultiPolygon(fs) => {
            for f in fs {
                spawn_one(commands, buf, builder, f);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use bevy_app::{App, Update};
    use bevy_ecs::prelude::Resource;
    use bevy_ecs::query::With;
    use bevy_ecs::system::{Commands, ResMut};
    use navara_buffer_store::BufferStore;
    use navara_core::CRS;
    use navara_feature_component::{
        BatchedFeatureMarker,
        batch::{BatchTable, BatchedFeature, FeatureBatchId, GlobalBatchIds},
        billboard::{BillboardGeometry, BillboardMarker},
        point::{PointGeometry, PointMarker},
        polygon::{PolygonGeometry, PolygonMarker},
        polyline::{PolylineGeometry, PolylineMarker},
        text::{TextGeometry, TextMarker},
    };
    use navara_material::{
        Appearance, BillboardMaterial, PointMaterial, PolygonMaterial, PolylineMaterial,
        TextMaterial,
    };
    use navara_parser::geojson::GeoJson;

    #[derive(Resource)]
    struct TestInput {
        geojson: GeoJson,
        appearances: Vec<Appearance>,
    }

    fn test_construct_system(
        mut commands: Commands,
        mut batch_table: ResMut<BatchTable>,
        mut buf: ResMut<BufferStore>,
        input: bevy_ecs::system::Res<TestInput>,
    ) {
        construct_geometry(
            &mut commands,
            &mut batch_table,
            &mut buf,
            &input.geojson,
            &input.appearances,
            "test_layer",
        );
    }

    fn run_construct(json: &str, appearances: Vec<Appearance>) -> App {
        let mut app = App::new();
        app.init_resource::<BufferStore>();
        app.init_resource::<BatchTable>();

        let geojson = GeoJson::from_json_value(json.parse().unwrap()).unwrap();
        app.insert_resource(TestInput {
            geojson,
            appearances,
        });
        app.add_systems(Update, test_construct_system);
        app.update();
        app
    }

    // --- Helper function tests ---

    #[test]
    fn coords_2d_defaults_z_to_zero() {
        let result = coords(&[139.75, 35.68]);
        assert_eq!(result.x, 139.75);
        assert_eq!(result.y, 35.68);
        assert_eq!(result.z, 0.0);
    }

    #[test]
    fn coords_3d_preserves_elevation() {
        let result = coords(&[139.75, 35.68, 100.5]);
        assert_eq!(result.x, 139.75);
        assert_eq!(result.y, 35.68);
        assert_eq!(result.z, 100.5);
    }

    #[test]
    fn multi_flat_coords_flattens_with_default_z() {
        let input = vec![vec![1.0, 2.0], vec![3.0, 4.0]];
        let result = multi_flat_coords(&input);
        assert_eq!(result, vec![1.0, 2.0, 0.0, 3.0, 4.0, 0.0]);
    }

    #[test]
    fn multi_flat_coords_flattens_with_z() {
        let input = vec![vec![1.0, 2.0, 10.0], vec![3.0, 4.0, 20.0]];
        let result = multi_flat_coords(&input);
        assert_eq!(result, vec![1.0, 2.0, 10.0, 3.0, 4.0, 20.0]);
    }

    #[test]
    fn get_polygon_holes_returns_none_for_single_ring() {
        let rings = vec![vec![
            vec![0.0, 0.0],
            vec![1.0, 0.0],
            vec![1.0, 1.0],
            vec![0.0, 0.0],
        ]];
        assert!(get_polygon_holes(&rings).is_none());
    }

    #[test]
    fn get_polygon_holes_returns_holes() {
        let rings = vec![
            vec![
                vec![0.0, 0.0],
                vec![10.0, 0.0],
                vec![10.0, 10.0],
                vec![0.0, 0.0],
            ],
            vec![
                vec![2.0, 2.0],
                vec![4.0, 2.0],
                vec![4.0, 4.0],
                vec![2.0, 2.0],
            ],
        ];
        let holes = get_polygon_holes(&rings).unwrap();
        assert_eq!(holes.len(), 1);
        assert_eq!(
            holes[0].outer_ring,
            vec![2.0, 2.0, 0.0, 4.0, 2.0, 0.0, 4.0, 4.0, 0.0, 2.0, 2.0, 0.0]
        );
    }

    // --- construct_geometry tests ---

    #[test]
    fn it_should_create_batched_feature_for_point() {
        let mut app = run_construct(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"name": "Tokyo"},
            "geometry": {
                "coordinates": [139.75227193360223, 35.68520091767046],
                "type": "Point"
            }
        },
        {
            "type": "Feature",
            "properties": {"name": "Shinjuku"},
            "geometry": {
                "coordinates": [139.77250531915263, 35.71562661633277],
                "type": "Point"
            }
        }
    ]
}"#,
            vec![Appearance::Point(PointMaterial::default())],
        );

        // Should have 1 BatchedFeature parent with PointMarker
        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PointMarker>>();
        let batched_features: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched_features.len(), 1);
        assert_eq!(batched_features[0].features.len(), 2);

        // Should have 2 child entities with BatchedFeatureMarker + PointGeometry
        let mut child_query = app
            .world_mut()
            .query_filtered::<&PointGeometry, With<BatchedFeatureMarker>>();
        let children: Vec<_> = child_query.iter(app.world()).collect();
        assert_eq!(children.len(), 2);
        assert_eq!(children[0].crs, CRS::Geographic);

        // Verify GlobalBatchIds
        let mut global_ids_query = app
            .world_mut()
            .query_filtered::<&GlobalBatchIds, With<PointMarker>>();
        let global_ids: Vec<_> = global_ids_query.iter(app.world()).collect();
        assert_eq!(global_ids.len(), 1);
        assert_eq!(global_ids[0].batch_length, 2);
    }

    #[test]
    fn it_should_create_batched_feature_for_multipoint() {
        let mut app = run_construct(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [
                    [139.75227193360223, 35.68520091767046],
                    [139.77250531915263, 35.71562661633277]
                ],
                "type": "MultiPoint"
            }
        }
    ]
}"#,
            vec![Appearance::Point(PointMaterial::default())],
        );

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PointMarker>>();
        let batched_features: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched_features.len(), 1);
        assert_eq!(batched_features[0].features.len(), 2);

        let mut child_query = app
            .world_mut()
            .query_filtered::<&PointGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(child_query.iter(app.world()).count(), 2);
    }

    #[test]
    fn it_should_create_batched_feature_for_billboard() {
        let mut app = run_construct(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [139.75, 35.68],
                "type": "Point"
            }
        },
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [139.77, 35.71],
                "type": "Point"
            }
        }
    ]
}"#,
            vec![Appearance::Billboard(BillboardMaterial::default())],
        );

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<BillboardMarker>>();
        let batched_features: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched_features.len(), 1);
        assert_eq!(batched_features[0].features.len(), 2);

        let mut child_query = app
            .world_mut()
            .query_filtered::<&BillboardGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(child_query.iter(app.world()).count(), 2);
    }

    #[test]
    fn it_should_create_batched_feature_for_text() {
        let mut app = run_construct(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [139.75, 35.68],
                "type": "Point"
            }
        }
    ]
}"#,
            vec![Appearance::Text(TextMaterial::default())],
        );

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<TextMarker>>();
        let batched_features: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched_features.len(), 1);
        assert_eq!(batched_features[0].features.len(), 1);

        let mut child_query = app
            .world_mut()
            .query_filtered::<&TextGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(child_query.iter(app.world()).count(), 1);
    }

    #[test]
    fn it_should_create_batched_feature_for_linestring() {
        let mut app = run_construct(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [
                    [139.75, 35.68],
                    [139.76, 35.69],
                    [139.77, 35.70]
                ],
                "type": "LineString"
            }
        },
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [
                    [139.78, 35.71],
                    [139.79, 35.72]
                ],
                "type": "LineString"
            }
        }
    ]
}"#,
            vec![Appearance::Polyline(PolylineMaterial::default())],
        );

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolylineMarker>>();
        let batched_features: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched_features.len(), 1);
        assert_eq!(batched_features[0].features.len(), 2);

        let mut child_query = app
            .world_mut()
            .query_filtered::<&PolylineGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(child_query.iter(app.world()).count(), 2);
    }

    #[test]
    fn it_should_create_batched_feature_for_multilinestring() {
        let mut app = run_construct(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [
                    [[139.75, 35.68], [139.76, 35.69]],
                    [[139.77, 35.70], [139.78, 35.71]]
                ],
                "type": "MultiLineString"
            }
        }
    ]
}"#,
            vec![Appearance::Polyline(PolylineMaterial::default())],
        );

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolylineMarker>>();
        let batched_features: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched_features.len(), 1);
        assert_eq!(batched_features[0].features.len(), 2);
    }

    #[test]
    fn it_should_create_batched_feature_for_polygon() {
        let mut app = run_construct(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [
                    [
                        [139.75, 35.68],
                        [139.76, 35.68],
                        [139.76, 35.69],
                        [139.75, 35.69],
                        [139.75, 35.68]
                    ]
                ],
                "type": "Polygon"
            }
        }
    ]
}"#,
            vec![Appearance::Polygon(PolygonMaterial::default())],
        );

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolygonMarker>>();
        let batched_features: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched_features.len(), 1);
        assert_eq!(batched_features[0].features.len(), 1);

        let mut child_query = app
            .world_mut()
            .query_filtered::<&PolygonGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(child_query.iter(app.world()).count(), 1);
    }

    #[test]
    fn it_should_create_batched_feature_for_multipolygon() {
        let mut app = run_construct(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [
                    [
                        [
                            [139.75, 35.68],
                            [139.76, 35.68],
                            [139.76, 35.69],
                            [139.75, 35.69],
                            [139.75, 35.68]
                        ]
                    ],
                    [
                        [
                            [139.77, 35.70],
                            [139.78, 35.70],
                            [139.78, 35.71],
                            [139.77, 35.71],
                            [139.77, 35.70]
                        ]
                    ]
                ],
                "type": "MultiPolygon"
            }
        }
    ]
}"#,
            vec![Appearance::Polygon(PolygonMaterial::default())],
        );

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolygonMarker>>();
        let batched_features: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched_features.len(), 1);
        assert_eq!(batched_features[0].features.len(), 2);
    }

    #[test]
    fn it_should_handle_single_feature_geojson() {
        let mut app = run_construct(
            r#"{
    "type": "Feature",
    "properties": {"name": "single"},
    "geometry": {
        "coordinates": [139.75, 35.68],
        "type": "Point"
    }
}"#,
            vec![Appearance::Point(PointMaterial::default())],
        );

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PointMarker>>();
        let batched_features: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched_features.len(), 1);
        assert_eq!(batched_features[0].features.len(), 1);
    }

    #[test]
    fn it_should_handle_geometry_only_geojson() {
        let mut app = run_construct(
            r#"{
    "coordinates": [139.75, 35.68],
    "type": "Point"
}"#,
            vec![Appearance::Point(PointMaterial::default())],
        );

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PointMarker>>();
        let batched_features: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched_features.len(), 1);
        assert_eq!(batched_features[0].features.len(), 1);
    }

    #[test]
    fn it_should_create_separate_batched_features_for_mixed_geometry() {
        let mut app = run_construct(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [139.75, 35.68],
                "type": "Point"
            }
        },
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [[139.75, 35.68], [139.76, 35.69]],
                "type": "LineString"
            }
        }
    ]
}"#,
            vec![
                Appearance::Point(PointMaterial::default()),
                Appearance::Polyline(PolylineMaterial::default()),
            ],
        );

        let mut point_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PointMarker>>();
        assert_eq!(point_query.iter(app.world()).count(), 1);

        let mut polyline_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolylineMarker>>();
        assert_eq!(polyline_query.iter(app.world()).count(), 1);
    }

    #[test]
    fn it_should_handle_polygon_with_holes() {
        let mut app = run_construct(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [
                    [
                        [139.75, 35.68],
                        [139.78, 35.68],
                        [139.78, 35.71],
                        [139.75, 35.71],
                        [139.75, 35.68]
                    ],
                    [
                        [139.76, 35.69],
                        [139.77, 35.69],
                        [139.77, 35.70],
                        [139.76, 35.70],
                        [139.76, 35.69]
                    ]
                ],
                "type": "Polygon"
            }
        }
    ]
}"#,
            vec![Appearance::Polygon(PolygonMaterial::default())],
        );

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolygonMarker>>();
        let batched_features: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched_features.len(), 1);
        assert_eq!(batched_features[0].features.len(), 1);

        let mut child_query = app
            .world_mut()
            .query_filtered::<&PolygonGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(child_query.iter(app.world()).count(), 1);
    }

    #[test]
    fn it_should_not_create_batched_feature_for_mismatched_appearance() {
        let mut app = run_construct(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [139.75, 35.68],
                "type": "Point"
            }
        }
    ]
}"#,
            vec![Appearance::Polyline(PolylineMaterial::default())],
        );

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolylineMarker>>();
        assert_eq!(batched_query.iter(app.world()).count(), 0);
    }

    #[derive(Resource, Default)]
    struct TestOutput(Vec<Entity>);

    fn test_construct_with_output_system(
        mut commands: Commands,
        mut batch_table: ResMut<BatchTable>,
        mut buf: ResMut<BufferStore>,
        input: bevy_ecs::system::Res<TestInput>,
        mut out: ResMut<TestOutput>,
    ) {
        out.0 = construct_geometry(
            &mut commands,
            &mut batch_table,
            &mut buf,
            &input.geojson,
            &input.appearances,
            "test_layer",
        );
    }

    #[test]
    fn it_should_return_spawned_parent_entities() {
        let mut app = App::new();
        app.init_resource::<BufferStore>();
        app.init_resource::<BatchTable>();
        app.init_resource::<TestOutput>();

        let geojson = GeoJson::from_json_value(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {},
            "geometry": { "coordinates": [139.75, 35.68], "type": "Point" }
        },
        {
            "type": "Feature",
            "properties": {},
            "geometry": { "coordinates": [139.75, 35.68], "type": "Point" }
        },
        {
            "type": "Feature",
            "properties": {},
            "geometry": { "coordinates": [139.75, 35.68], "type": "Point" }
        }
    ]
}"#
            .parse()
            .unwrap(),
        )
        .unwrap();
        app.insert_resource(TestInput {
            geojson,
            appearances: vec![Appearance::Point(PointMaterial::default())],
        });
        app.add_systems(Update, test_construct_with_output_system);
        app.update();

        let output = app.world().resource::<TestOutput>();
        assert_eq!(output.0.len(), 1);
    }

    #[test]
    fn it_should_handle_geometry_collection() {
        // GeometryCollection containing a Point and a LineString
        let mut app = run_construct(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"name": "collection"},
            "geometry": {
                "type": "GeometryCollection",
                "geometries": [
                    {
                        "type": "Point",
                        "coordinates": [139.75, 35.68]
                    },
                    {
                        "type": "LineString",
                        "coordinates": [[139.75, 35.68], [139.76, 35.69]]
                    },
                    {
                        "type": "Polygon",
                        "coordinates": [
                            [
                                [139.75, 35.68],
                                [139.76, 35.68],
                                [139.76, 35.69],
                                [139.75, 35.69],
                                [139.75, 35.68]
                            ]
                        ]
                    }
                ]
            }
        }
    ]
}"#,
            vec![
                Appearance::Point(PointMaterial::default()),
                Appearance::Polyline(PolylineMaterial::default()),
                Appearance::Polygon(PolygonMaterial::default()),
            ],
        );

        // Point from GeometryCollection
        let mut point_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PointMarker>>();
        let points: Vec<_> = point_query.iter(app.world()).collect();
        assert_eq!(points.len(), 1);
        assert_eq!(points[0].features.len(), 1);

        // LineString from GeometryCollection
        let mut polyline_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolylineMarker>>();
        let polylines: Vec<_> = polyline_query.iter(app.world()).collect();
        assert_eq!(polylines.len(), 1);
        assert_eq!(polylines[0].features.len(), 1);

        // Polygon from GeometryCollection
        let mut polygon_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolygonMarker>>();
        let polygons: Vec<_> = polygon_query.iter(app.world()).collect();
        assert_eq!(polygons.len(), 1);
        assert_eq!(polygons[0].features.len(), 1);
    }

    #[test]
    fn geometry_collection_sub_geometries_share_single_feature() {
        // A GeometryCollection with two Points inside a single Feature should
        // produce two child entities that share the same batch index (one feature).
        let mut app = run_construct(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"name": "collection"},
            "geometry": {
                "type": "GeometryCollection",
                "geometries": [
                    {
                        "type": "Point",
                        "coordinates": [139.75, 35.68]
                    },
                    {
                        "type": "Point",
                        "coordinates": [139.76, 35.69]
                    }
                ]
            }
        }
    ]
}"#,
            vec![Appearance::Point(PointMaterial::default())],
        );

        // Both points come from one feature → one BatchedFeature parent with 2 children
        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PointMarker>>();
        let batched: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched.len(), 1);
        assert_eq!(batched[0].features.len(), 2);

        // Both children should share batch index 0 (same feature)
        let mut child_query = app
            .world_mut()
            .query_filtered::<&BatchIndex, With<BatchedFeatureMarker>>();
        let indices: Vec<_> = child_query.iter(app.world()).map(|b| b.0).collect();
        assert_eq!(indices.len(), 2);
        assert_eq!(indices[0], 0);
        assert_eq!(indices[1], 0);

        // Properties should be stored once (not duplicated per sub-geometry)
        let mut batch_id_query = app
            .world_mut()
            .query_filtered::<&FeatureBatchId, With<PointMarker>>();
        let feature_batch_id = batch_id_query.iter(app.world()).next().unwrap().0;
        let batch_table = app.world().resource::<BatchTable>();
        let batch_value = batch_table.get(&feature_batch_id).unwrap();
        let properties = batch_value.properties.as_ref().unwrap();
        match properties {
            navara_feature_component::batch::BatchProperty::Values(values) => {
                assert_eq!(values.len(), 1); // one feature, not two
                assert_eq!(values[0], serde_json::json!({"name": "collection"}));
            }
            _ => panic!("Expected BatchProperty::Values"),
        }
    }

    #[test]
    fn it_should_handle_all_geometry_types_with_all_appearances() {
        let mut app = run_construct(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"type": "point"},
            "geometry": {
                "coordinates": [139.75, 35.68],
                "type": "Point"
            }
        },
        {
            "type": "Feature",
            "properties": {"type": "multipoint"},
            "geometry": {
                "coordinates": [[139.76, 35.69], [139.77, 35.70]],
                "type": "MultiPoint"
            }
        },
        {
            "type": "Feature",
            "properties": {"type": "linestring"},
            "geometry": {
                "coordinates": [[139.75, 35.68], [139.76, 35.69], [139.77, 35.70]],
                "type": "LineString"
            }
        },
        {
            "type": "Feature",
            "properties": {"type": "multilinestring"},
            "geometry": {
                "coordinates": [
                    [[139.75, 35.68], [139.76, 35.69]],
                    [[139.77, 35.70], [139.78, 35.71]]
                ],
                "type": "MultiLineString"
            }
        },
        {
            "type": "Feature",
            "properties": {"type": "polygon"},
            "geometry": {
                "coordinates": [
                    [
                        [139.75, 35.68],
                        [139.76, 35.68],
                        [139.76, 35.69],
                        [139.75, 35.69],
                        [139.75, 35.68]
                    ]
                ],
                "type": "Polygon"
            }
        },
        {
            "type": "Feature",
            "properties": {"type": "multipolygon"},
            "geometry": {
                "coordinates": [
                    [
                        [
                            [139.80, 35.72],
                            [139.81, 35.72],
                            [139.81, 35.73],
                            [139.80, 35.73],
                            [139.80, 35.72]
                        ]
                    ],
                    [
                        [
                            [139.82, 35.74],
                            [139.83, 35.74],
                            [139.83, 35.75],
                            [139.82, 35.75],
                            [139.82, 35.74]
                        ]
                    ]
                ],
                "type": "MultiPolygon"
            }
        }
    ]
}"#,
            vec![
                Appearance::Point(PointMaterial::default()),
                Appearance::Billboard(BillboardMaterial::default()),
                Appearance::Text(TextMaterial::default()),
                Appearance::Polyline(PolylineMaterial::default()),
                Appearance::Polygon(PolygonMaterial::default()),
            ],
        );

        // Point/MultiPoint features match Point, Billboard, and Text appearances.
        // Point: 1 (Point) + 2 (MultiPoint) = 3 children
        let mut point_batched = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PointMarker>>();
        let point_features: Vec<_> = point_batched.iter(app.world()).collect();
        assert_eq!(point_features.len(), 1);
        assert_eq!(point_features[0].features.len(), 3);

        // Billboard: same 3 children from Point/MultiPoint
        let mut billboard_batched = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<BillboardMarker>>();
        let billboard_features: Vec<_> = billboard_batched.iter(app.world()).collect();
        assert_eq!(billboard_features.len(), 1);
        assert_eq!(billboard_features[0].features.len(), 3);

        // Text: same 3 children from Point/MultiPoint
        let mut text_batched = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<TextMarker>>();
        let text_features: Vec<_> = text_batched.iter(app.world()).collect();
        assert_eq!(text_features.len(), 1);
        assert_eq!(text_features[0].features.len(), 3);

        // Polyline: 1 (LineString) + 2 (MultiLineString) = 3 children
        let mut polyline_batched = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolylineMarker>>();
        let polyline_features: Vec<_> = polyline_batched.iter(app.world()).collect();
        assert_eq!(polyline_features.len(), 1);
        assert_eq!(polyline_features[0].features.len(), 3);

        // Polygon: 1 (Polygon) + 2 (MultiPolygon) = 3 children
        let mut polygon_batched = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolygonMarker>>();
        let polygon_features: Vec<_> = polygon_batched.iter(app.world()).collect();
        assert_eq!(polygon_features.len(), 1);
        assert_eq!(polygon_features[0].features.len(), 3);

        // Verify child entity component types
        let mut point_children = app
            .world_mut()
            .query_filtered::<&PointGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(point_children.iter(app.world()).count(), 3);

        let mut billboard_children = app
            .world_mut()
            .query_filtered::<&BillboardGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(billboard_children.iter(app.world()).count(), 3);

        let mut text_children = app
            .world_mut()
            .query_filtered::<&TextGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(text_children.iter(app.world()).count(), 3);

        let mut polyline_children = app
            .world_mut()
            .query_filtered::<&PolylineGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(polyline_children.iter(app.world()).count(), 3);

        let mut polygon_children = app
            .world_mut()
            .query_filtered::<&PolygonGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(polygon_children.iter(app.world()).count(), 3);
    }

    #[test]
    fn it_should_have_separate_feature_batch_id_per_appearance() {
        // A Point feature with Point + Billboard + Text appearances gets separate
        // feature_batch_ids per kind, with properties duplicated into each batch.
        let mut app = run_construct(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"name": "shared"},
            "geometry": {
                "coordinates": [139.75, 35.68],
                "type": "Point"
            }
        }
    ]
}"#,
            vec![
                Appearance::Point(PointMaterial::default()),
                Appearance::Billboard(BillboardMaterial::default()),
                Appearance::Text(TextMaterial::default()),
            ],
        );

        // Each BatchedFeature parent should have its own FeatureBatchId
        let mut point_query = app
            .world_mut()
            .query_filtered::<&FeatureBatchId, With<PointMarker>>();
        let point_batch_id = point_query.iter(app.world()).next().unwrap().0;

        let mut billboard_query = app
            .world_mut()
            .query_filtered::<&FeatureBatchId, With<BillboardMarker>>();
        let billboard_batch_id = billboard_query.iter(app.world()).next().unwrap().0;

        let mut text_query = app
            .world_mut()
            .query_filtered::<&FeatureBatchId, With<TextMarker>>();
        let text_batch_id = text_query.iter(app.world()).next().unwrap().0;

        // Each batch has its own copy of the properties
        let batch_table = app.world().resource::<BatchTable>();
        for batch_id in [point_batch_id, billboard_batch_id, text_batch_id] {
            let batch_value = batch_table.get(&batch_id).unwrap();
            let properties = batch_value.properties.as_ref().unwrap();
            match properties {
                navara_feature_component::batch::BatchProperty::Values(values) => {
                    assert_eq!(values.len(), 1);
                    assert_eq!(values[0], serde_json::json!({"name": "shared"}));
                }
                _ => panic!("Expected BatchProperty::Values"),
            }
        }
    }
}
