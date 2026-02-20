use bevy_ecs::entity::Entity;
use bevy_ecs::system::Commands;

use navara_buffer_store::BufferStore;
use navara_core::CRS;
use navara_feature_component::{
    batch::{BatchIndex, BatchTable, BatchedFeature, FeatureBatchId, GlobalBatchIds},
    billboard::{BillboardGeometry, BillboardMarker},
    id::FeatureId,
    point::{PointGeometry, PointMarker},
    polygon::{PolygonGeometry, PolygonMarker},
    polyline::{PolylineGeometry, PolylineMarker},
    text::{TextGeometry, TextMarker},
    BatchedFeatureMarker,
};
use navara_geometry::{Hierarchy, WindingOrder};
use navara_layer::LayerId;
use navara_material::Appearance;
use navara_math::Vec3;
use navara_parser::geojson::{GeoJson, Geometry, Value};

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

/// Identifies which geometry-appearance combination a group belongs to.
#[derive(Clone, Copy, PartialEq, Eq, Hash)]
enum GeometryAppearanceKind {
    Point,
    Billboard,
    Text,
    Polyline,
    Polygon,
}

/// Accumulates feature entities and batch IDs during geometry construction.
struct GeometryBuilder<'a> {
    groups: Vec<(GeometryAppearanceKind, Vec<Entity>, Vec<u32>)>,
    batch_ids_by_kind: Vec<(GeometryAppearanceKind, u32)>,
    batch_table: &'a mut BatchTable,
    layer_id: &'a str,
}

impl<'a> GeometryBuilder<'a> {
    fn new(batch_table: &'a mut BatchTable, layer_id: &'a str) -> Self {
        Self {
            groups: Vec::new(),
            batch_ids_by_kind: Vec::new(),
            batch_table,
            layer_id,
        }
    }

    fn get_or_init_batch_id(&mut self, kind: GeometryAppearanceKind) -> u32 {
        if let Some(entry) = self.batch_ids_by_kind.iter().find(|(k, _)| *k == kind) {
            entry.1
        } else {
            let id = self
                .batch_table
                .init_values(Some(self.layer_id.to_owned()))
                .unwrap_or(0);
            self.batch_ids_by_kind.push((kind, id));
            id
        }
    }

    fn get_or_create_group(&mut self, kind: GeometryAppearanceKind) -> usize {
        if let Some(pos) = self.groups.iter().position(|(k, _, _)| *k == kind) {
            pos
        } else {
            self.groups.push((kind, Vec::new(), Vec::new()));
            self.groups.len() - 1
        }
    }

    fn add_feature(
        &mut self,
        kind: GeometryAppearanceKind,
        properties: &Option<serde_json::Map<String, serde_json::Value>>,
        entity: Entity,
    ) -> u32 {
        let feature_batch_id = self.get_or_init_batch_id(kind);
        let group_idx = self.get_or_create_group(kind);

        let props = properties
            .as_ref()
            .and_then(|prop| serde_json::to_value(prop).ok())
            .unwrap_or(serde_json::Value::Null);
        self.batch_table.add_values(feature_batch_id, props);

        let batch_id = self
            .batch_table
            .init_values(Some(self.layer_id.to_owned()))
            .unwrap_or(0);
        self.groups[group_idx].2.push(batch_id);

        let batch_index = self.groups[group_idx].2.len() as u32 - 1;
        self.groups[group_idx].1.push(entity);
        batch_index
    }
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
                    process_geometry(
                        commands,
                        buf,
                        &mut builder,
                        geometry,
                        appearances,
                        &feature.properties,
                    );
                }
            }
        }
        GeoJson::Feature(feature) => {
            if let Some(geometry) = &feature.geometry {
                process_geometry(
                    commands,
                    buf,
                    &mut builder,
                    geometry,
                    appearances,
                    &feature.properties,
                );
            }
        }
        GeoJson::Geometry(geometry) => {
            process_geometry(commands, buf, &mut builder, geometry, appearances, &None);
        }
    }

    // Spawn a BatchedFeature parent entity for each group
    let mut result = Vec::new();
    for (kind, feature_ids, global_batch_ids) in builder.groups {
        if feature_ids.is_empty() {
            continue;
        }

        let feature_batch_id = builder
            .batch_ids_by_kind
            .iter()
            .find(|(k, _)| *k == kind)
            .map(|(_, id)| *id)
            .unwrap_or(0);

        let batch_length = global_batch_ids.len() as u32;
        let global_batch_ids = GlobalBatchIds {
            handle: buf.new_u32(global_batch_ids),
            batch_length,
        };

        let batched = BatchedFeature {
            features: feature_ids,
            default_active: true,
            ..Default::default()
        };

        if let Some(entity) = spawn_batched_entity(
            commands,
            batched,
            kind,
            appearances,
            layer_id,
            FeatureBatchId(feature_batch_id),
            global_batch_ids,
        ) {
            result.push(entity);
        }
    }

    result
}

/// Process a single GeoJSON geometry, spawning child entities for each matching appearance.
fn process_geometry(
    commands: &mut Commands,
    buf: &mut BufferStore,
    builder: &mut GeometryBuilder,
    geometry: &Geometry,
    appearances: &[Appearance],
    properties: &Option<serde_json::Map<String, serde_json::Value>>,
) {
    for appearance in appearances {
        match appearance {
            Appearance::Point(_) => {
                spawn_point_children(
                    commands,
                    builder,
                    geometry,
                    properties,
                    GeometryAppearanceKind::Point,
                );
            }
            Appearance::Billboard(_) => {
                spawn_point_children(
                    commands,
                    builder,
                    geometry,
                    properties,
                    GeometryAppearanceKind::Billboard,
                );
            }
            Appearance::Text(_) => {
                spawn_point_children(
                    commands,
                    builder,
                    geometry,
                    properties,
                    GeometryAppearanceKind::Text,
                );
            }
            Appearance::Polyline(_) => {
                spawn_polyline_children(commands, buf, builder, geometry, properties);
            }
            Appearance::Polygon(_) => {
                spawn_polygon_children(commands, buf, builder, geometry, properties);
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
    properties: &Option<serde_json::Map<String, serde_json::Value>>,
    kind: GeometryAppearanceKind,
) {
    let spawn_one = |commands: &mut Commands, builder: &mut GeometryBuilder, coord: Vec3| {
        let entity = match kind {
            GeometryAppearanceKind::Point => commands
                .spawn((
                    BatchedFeatureMarker,
                    PointGeometry {
                        coords: coord,
                        crs: CRS::Geographic,
                    },
                    BatchIndex(0), // placeholder, updated below
                ))
                .id(),
            GeometryAppearanceKind::Billboard => commands
                .spawn((
                    BatchedFeatureMarker,
                    BillboardGeometry {
                        coords: coord,
                        crs: CRS::Geographic,
                    },
                    BatchIndex(0),
                ))
                .id(),
            GeometryAppearanceKind::Text => commands
                .spawn((
                    BatchedFeatureMarker,
                    TextGeometry {
                        coords: coord,
                        crs: CRS::Geographic,
                    },
                    BatchIndex(0),
                ))
                .id(),
            _ => unreachable!(),
        };

        let batch_index = builder.add_feature(kind, properties, entity);
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
    properties: &Option<serde_json::Map<String, serde_json::Value>>,
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
                BatchIndex(0),
            ))
            .id();

        let batch_index = builder.add_feature(kind, properties, entity);
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
    properties: &Option<serde_json::Map<String, serde_json::Value>>,
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
                BatchIndex(0),
            ))
            .id();

        let batch_index = builder.add_feature(kind, properties, entity);
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

/// Spawn a `BatchedFeature` parent entity with the appropriate marker and material.
#[allow(clippy::too_many_arguments)]
fn spawn_batched_entity(
    commands: &mut Commands,
    batched: BatchedFeature,
    kind: GeometryAppearanceKind,
    appearances: &[Appearance],
    layer_id: &str,
    feature_batch_id: FeatureBatchId,
    global_batch_ids: GlobalBatchIds,
) -> Option<Entity> {
    match kind {
        GeometryAppearanceKind::Point => {
            let Appearance::Point(mat) = appearances
                .iter()
                .find(|a| matches!(a, Appearance::Point(_)))?
            else {
                return None;
            };
            Some(
                commands
                    .spawn((
                        PointMarker,
                        batched,
                        FeatureId::default(),
                        LayerId(layer_id.to_string()),
                        mat.clone(),
                        feature_batch_id,
                        global_batch_ids,
                    ))
                    .id(),
            )
        }
        GeometryAppearanceKind::Billboard => {
            let Appearance::Billboard(mat) = appearances
                .iter()
                .find(|a| matches!(a, Appearance::Billboard(_)))?
            else {
                return None;
            };
            Some(
                commands
                    .spawn((
                        BillboardMarker,
                        batched,
                        FeatureId::default(),
                        LayerId(layer_id.to_string()),
                        mat.clone(),
                        feature_batch_id,
                        global_batch_ids,
                    ))
                    .id(),
            )
        }
        GeometryAppearanceKind::Text => {
            let Appearance::Text(mat) = appearances
                .iter()
                .find(|a| matches!(a, Appearance::Text(_)))?
            else {
                return None;
            };
            Some(
                commands
                    .spawn((
                        TextMarker,
                        batched,
                        FeatureId::default(),
                        LayerId(layer_id.to_string()),
                        mat.clone(),
                        feature_batch_id,
                        global_batch_ids,
                    ))
                    .id(),
            )
        }
        GeometryAppearanceKind::Polyline => {
            let Appearance::Polyline(mat) = appearances
                .iter()
                .find(|a| matches!(a, Appearance::Polyline(_)))?
            else {
                return None;
            };
            Some(
                commands
                    .spawn((
                        PolylineMarker,
                        batched,
                        FeatureId::default(),
                        LayerId(layer_id.to_string()),
                        mat.clone(),
                        feature_batch_id,
                        global_batch_ids,
                    ))
                    .id(),
            )
        }
        GeometryAppearanceKind::Polygon => {
            let Appearance::Polygon(mat) = appearances
                .iter()
                .find(|a| matches!(a, Appearance::Polygon(_)))?
            else {
                return None;
            };
            Some(
                commands
                    .spawn((
                        PolygonMarker,
                        batched,
                        FeatureId::default(),
                        LayerId(layer_id.to_string()),
                        mat.clone(),
                        feature_batch_id,
                        global_batch_ids,
                    ))
                    .id(),
            )
        }
    }
}

#[cfg(test)]
mod test {
    use bevy_app::{App, Update};
    use bevy_ecs::query::With;
    use navara_buffer_store::BufferStore;
    use navara_event_store::EventStore;
    use navara_feature::FeaturePlugin;
    use navara_feature_component::{
        batch::{BatchedFeature, GlobalBatchIds},
        billboard::{BillboardGeometry, BillboardMarker},
        id::FeatureId,
        point::{PointGeometry, PointMarker},
        polygon::{PolygonGeometry, PolygonMarker},
        polyline::{PolylineGeometry, PolylineMarker},
        text::{TextGeometry, TextMarker},
        BatchedFeatureMarker,
    };
    use navara_layer::{GeoJsonLayer, GeoJsonLayerData, LayerStore};
    use navara_material::{
        Appearance, BillboardMaterial, PointMaterial, PolygonMaterial, PolylineMaterial,
        TextMaterial,
    };
    use navara_parser::geojson::GeoJson;
    use navara_tile_component::RasterTileQuadtree;

    use crate::system::construct_feature;

    fn initialize_app() -> App {
        let mut app = App::new();

        app.init_resource::<BufferStore>();
        app.init_resource::<EventStore>();
        app.insert_resource(RasterTileQuadtree::new_with_linear_qt());
        app.insert_resource(LayerStore::new());
        app.add_plugins(FeaturePlugin);
        app.add_systems(Update, construct_feature);

        app
    }

    fn construct_geojson_layer(json: &str, appearances: Vec<Appearance>) -> GeoJsonLayer {
        let geojson = GeoJson::from_json_value(json.parse().unwrap()).unwrap();
        GeoJsonLayer {
            layer_id: "test_layer".to_string(),
            data: Some(GeoJsonLayerData::GeoJson(geojson)),
            crs: None,
            appearances,
        }
    }

    #[test]
    fn it_should_create_batched_feature_for_point() {
        let mut app = initialize_app();

        app.world_mut().spawn(construct_geojson_layer(
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
        ));

        app.update();

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
        assert_eq!(child_query.iter(app.world()).count(), 2);

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
        let mut app = initialize_app();

        app.world_mut().spawn(construct_geojson_layer(
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
        ));

        app.update();

        // MultiPoint spawns 2 child entities
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
        let mut app = initialize_app();

        app.world_mut().spawn(construct_geojson_layer(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [139.75227193360223, 35.68520091767046],
                "type": "Point"
            }
        },
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [139.77250531915263, 35.71562661633277],
                "type": "Point"
            }
        }
    ]
}"#,
            vec![Appearance::Billboard(BillboardMaterial::default())],
        ));

        app.update();

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
        let mut app = initialize_app();

        app.world_mut().spawn(construct_geojson_layer(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [139.75227193360223, 35.68520091767046],
                "type": "Point"
            }
        }
    ]
}"#,
            vec![Appearance::Text(TextMaterial::default())],
        ));

        app.update();

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
        let mut app = initialize_app();

        app.world_mut().spawn(construct_geojson_layer(
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
        ));

        app.update();

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
        let mut app = initialize_app();

        app.world_mut().spawn(construct_geojson_layer(
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
        ));

        app.update();

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolylineMarker>>();
        let batched_features: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched_features.len(), 1);
        // MultiLineString with 2 line strings = 2 child entities
        assert_eq!(batched_features[0].features.len(), 2);
    }

    #[test]
    fn it_should_create_batched_feature_for_polygon() {
        let mut app = initialize_app();

        app.world_mut().spawn(construct_geojson_layer(
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
        ));

        app.update();

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
        let mut app = initialize_app();

        app.world_mut().spawn(construct_geojson_layer(
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
        ));

        app.update();

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolygonMarker>>();
        let batched_features: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched_features.len(), 1);
        assert_eq!(batched_features[0].features.len(), 2);
    }

    #[test]
    fn it_should_handle_single_feature_geojson() {
        let mut app = initialize_app();

        app.world_mut().spawn(construct_geojson_layer(
            r#"{
    "type": "Feature",
    "properties": {"name": "single"},
    "geometry": {
        "coordinates": [139.75, 35.68],
        "type": "Point"
    }
}"#,
            vec![Appearance::Point(PointMaterial::default())],
        ));

        app.update();

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PointMarker>>();
        let batched_features: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched_features.len(), 1);
        assert_eq!(batched_features[0].features.len(), 1);
    }

    #[test]
    fn it_should_handle_geometry_only_geojson() {
        let mut app = initialize_app();

        app.world_mut().spawn(construct_geojson_layer(
            r#"{
    "coordinates": [139.75, 35.68],
    "type": "Point"
}"#,
            vec![Appearance::Point(PointMaterial::default())],
        ));

        app.update();

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PointMarker>>();
        let batched_features: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched_features.len(), 1);
        assert_eq!(batched_features[0].features.len(), 1);
    }

    #[test]
    fn it_should_create_separate_batched_features_for_mixed_geometry() {
        let mut app = initialize_app();

        // A FeatureCollection with both Point and LineString, with both Point and Polyline appearances
        app.world_mut().spawn(construct_geojson_layer(
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
        ));

        app.update();

        // Should have separate BatchedFeature entities for Point and Polyline
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
    fn it_should_have_feature_id_on_batched_feature() {
        let mut app = initialize_app();

        app.world_mut().spawn(construct_geojson_layer(
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
            vec![Appearance::Point(PointMaterial::default())],
        ));

        app.update();
        // Second update needed: construct_feature spawns BatchedFeature in first frame,
        // transfer_batched_mesh detects it via Added<BatchedFeature> in the next frame.
        app.update();

        // BatchedFeature parent should have FeatureId
        let mut query = app
            .world_mut()
            .query_filtered::<&FeatureId, With<PointMarker>>();
        let feature_ids: Vec<_> = query.iter(app.world()).collect();
        assert_eq!(feature_ids.len(), 1);
        // After transfer_batched_mesh processes it, FeatureId should point to the RenderableFeature
        assert!(feature_ids[0].0.is_some());
    }

    #[test]
    fn it_should_handle_polygon_with_holes() {
        let mut app = initialize_app();

        app.world_mut().spawn(construct_geojson_layer(
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
        ));

        app.update();

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
        let mut app = initialize_app();

        // Point geometry with Polyline appearance — should produce no batched features
        app.world_mut().spawn(construct_geojson_layer(
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
        ));

        app.update();

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolylineMarker>>();
        assert_eq!(batched_query.iter(app.world()).count(), 0);
    }
}
