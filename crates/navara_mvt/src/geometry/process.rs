use std::sync::Arc;

use bevy_ecs::{entity::Entity, system::Commands};
use geo_types::{Geometry, LineString, MultiLineString, MultiPoint, MultiPolygon, Point, Polygon};
use geozero::ToGeo;
use geozero::mvt::{Message, Tile as MvtTile, tile};
use navara_buffer_store::BufferStore;
use navara_component::OrderByDistance;
use navara_core::{CRS, TileXYZ};
use navara_core::{Extent, Radians};
use navara_feature_component::{
    BatchedFeatureMarker,
    batch::{BatchIndex, BatchTable},
    geometry_builder::{GeometryAppearanceKind, spawn_point_entity},
    polygon::PolygonGeometry,
    polyline::PolylineGeometry,
};
use navara_geometry::{Hierarchy, WindingOrder};
use navara_material::Appearance;
use navara_math::{FloatType, Vec3};
use navara_tile_component::{OverscaledTileHandle, TileExtent, TileHandle};
use navara_vector_tile::{PosConverter, VectorTileFeatureMarker};

use super::builder::MvtGeometryBuilder;

// ============================================================================
// Multi-layer support: Parse MVT once, spawn features for multiple layers
// ============================================================================

/// Information about a matched layer for multi-layer processing.
pub struct MatchedLayerInfo<'a> {
    /// The layer ID
    pub layer_id: &'a str,
    /// The layer's appearances
    pub appearances: &'a [Appearance],
    /// Optional layer filter for MVT sublayers
    pub limit_layers: &'a Option<Vec<String>>,
}

/// Main entry point for multi-layer MVT processing.
/// Parses MVT binary once and spawns entities for all matched layers.
///
/// This is more efficient than calling `construct_geometry` multiple times
/// when multiple layers share the same source URL.
#[allow(clippy::too_many_arguments)]
pub fn construct_geometry_multi_layer(
    commands: &mut Commands,
    batch_table: &mut BatchTable,
    buf: &mut BufferStore,
    mvt_bin: Vec<u8>,
    xyz: TileXYZ,
    matched_layers: &[MatchedLayerInfo],
    tile_info: Option<(TileHandle, Extent<FloatType, Radians>)>,
    order: &OrderByDistance,
) -> Option<Vec<Entity>> {
    if matched_layers.is_empty() {
        return None;
    }

    let tile = MvtTile::decode(mvt_bin.as_slice()).ok()?;

    let mut result = Vec::new();

    for mvt_layer in tile.layers {
        let entities = process_layer_multi(
            commands,
            batch_table,
            buf,
            mvt_layer,
            xyz,
            matched_layers,
            tile_info,
            order,
        );
        result.extend(entities);
    }

    if result.is_empty() {
        None
    } else {
        Some(result)
    }
}

/// Process a single MVT sublayer for the last matching target layer.
/// Uses only the last matched layer since rendering the same features multiple times
/// for different layers with the same source provides no visual benefit.
#[allow(clippy::too_many_arguments)]
fn process_layer_multi(
    commands: &mut Commands,
    batch_table: &mut BatchTable,
    buf: &mut BufferStore,
    mut mvt_layer: tile::Layer,
    xyz: TileXYZ,
    matched_layers: &[MatchedLayerInfo],
    tile_info: Option<(TileHandle, Extent<FloatType, Radians>)>,
    order: &OrderByDistance,
) -> Vec<Entity> {
    let extent = mvt_layer.extent.unwrap_or(4096);
    let mut converter = PosConverter::new(xyz, extent);

    // Use the last layer that wants this MVT sublayer.
    let target_layer = matched_layers.iter().rev().find(|ml| {
        ml.limit_layers
            .as_ref()
            .map(|ll| ll.contains(&mvt_layer.name))
            .unwrap_or(true)
    });

    let Some(target_layer) = target_layer else {
        return Vec::new();
    };

    let layer_id = target_layer.layer_id;

    let keys = Arc::new(std::mem::take(&mut mvt_layer.keys));
    let values = Arc::new(std::mem::take(&mut mvt_layer.values));
    let feature_count = mvt_layer.features.len();

    let mut builder = MvtGeometryBuilder::new(
        batch_table,
        layer_id,
        Arc::clone(&keys),
        Arc::clone(&values),
        feature_count,
    );

    for feature in &mut mvt_layer.features {
        let geom = match feature.to_geo() {
            Ok(g) => g,
            Err(_) => continue,
        };

        let tags = std::mem::take(&mut feature.tags);

        // Prepare feature data lazily — only committed when add_entity is first called.
        builder.begin_feature(tags);

        process_feature_geometry(
            commands,
            buf,
            &mut builder,
            &geom,
            &mut converter,
            target_layer.appearances,
        );
    }

    let entities = builder.groups.finalize(
        commands,
        buf,
        target_layer.appearances,
        target_layer.layer_id,
        false,
    );

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

    entities
}

/// Process all appearances for a single feature's geometry.
///
/// Unlike the old code which used `break` after the first point-like appearance,
/// this iterates ALL appearances, creating child entities for each matching one.
fn process_feature_geometry(
    commands: &mut Commands,
    buf: &mut BufferStore,
    builder: &mut MvtGeometryBuilder,
    geom: &Geometry<f64>,
    converter: &mut PosConverter,
    appearances: &[Appearance],
) {
    // Handle GeometryCollection by recursing into each sub-geometry
    if let Geometry::GeometryCollection(geoms) = geom {
        for g in &geoms.0 {
            process_feature_geometry(commands, buf, builder, g, converter, appearances);
        }
        return;
    }

    for appearance in appearances {
        match appearance {
            Appearance::Point(_) => {
                spawn_point_children(
                    commands,
                    builder,
                    geom,
                    converter,
                    GeometryAppearanceKind::Point,
                );
            }
            Appearance::Billboard(_) => {
                spawn_point_children(
                    commands,
                    builder,
                    geom,
                    converter,
                    GeometryAppearanceKind::Billboard,
                );
            }
            Appearance::Text(_) => {
                spawn_point_children(
                    commands,
                    builder,
                    geom,
                    converter,
                    GeometryAppearanceKind::Text,
                );
            }
            Appearance::Polyline(app) => {
                spawn_polyline_children(
                    commands,
                    buf,
                    builder,
                    geom,
                    converter,
                    app.clamp_to_ground,
                );
            }
            Appearance::Polygon(app) => {
                spawn_polygon_children(
                    commands,
                    buf,
                    builder,
                    geom,
                    converter,
                    app.clamp_to_ground,
                );
            }
            _ => {}
        }
    }
}

/// Spawn child entities for point-like geometry (Point, Billboard, Text).
fn spawn_point_children(
    commands: &mut Commands,
    builder: &mut MvtGeometryBuilder,
    geom: &Geometry<f64>,
    converter: &mut PosConverter,
    kind: GeometryAppearanceKind,
) {
    match geom {
        Geometry::Point(point) => {
            spawn_single_point(commands, builder, point, converter, kind);
        }
        Geometry::MultiPoint(MultiPoint(points)) => {
            for point in points {
                spawn_single_point(commands, builder, point, converter, kind);
            }
        }
        _ => {}
    }
}

fn spawn_single_point(
    commands: &mut Commands,
    builder: &mut MvtGeometryBuilder,
    point: &Point<f64>,
    converter: &mut PosConverter,
    kind: GeometryAppearanceKind,
) {
    let (x, y) = converter.project_point(point.x(), point.y());
    let coords = Vec3::new(x, y, 0.0 as FloatType);

    let entity = spawn_point_entity(commands, coords, CRS::Geographic, kind);
    let batch_index = builder.add_entity(kind, entity);
    commands.entity(entity).insert(BatchIndex(batch_index));
}

/// Spawn child entities for polyline geometry.
fn spawn_polyline_children(
    commands: &mut Commands,
    buf: &mut BufferStore,
    builder: &mut MvtGeometryBuilder,
    geom: &Geometry<f64>,
    converter: &mut PosConverter,
    flat: bool,
) {
    match geom {
        Geometry::LineString(line) => {
            spawn_single_line(commands, buf, builder, line, converter, flat);
        }
        Geometry::MultiLineString(MultiLineString(lines)) => {
            for line in lines {
                spawn_single_line(commands, buf, builder, line, converter, flat);
            }
        }
        _ => {}
    }
}

fn spawn_single_line(
    commands: &mut Commands,
    buf: &mut BufferStore,
    builder: &mut MvtGeometryBuilder,
    line: &LineString<f64>,
    converter: &mut PosConverter,
    flat: bool,
) {
    let geo_points = if flat {
        converter.project_points_on_center(&line.0)
    } else {
        converter.project_points(&line.0)
    };

    if geo_points.is_empty() {
        return;
    }

    let entity = commands
        .spawn((
            BatchedFeatureMarker,
            PolylineGeometry::with_buf(buf, geo_points, CRS::Geographic),
        ))
        .id();

    let batch_index = builder.add_entity(GeometryAppearanceKind::Polyline, entity);
    commands.entity(entity).insert(BatchIndex(batch_index));
}

/// Spawn child entities for polygon geometry.
fn spawn_polygon_children(
    commands: &mut Commands,
    buf: &mut BufferStore,
    builder: &mut MvtGeometryBuilder,
    geom: &Geometry<f64>,
    converter: &mut PosConverter,
    flat: bool,
) {
    match geom {
        Geometry::Polygon(polygon) => {
            spawn_single_polygon(commands, buf, builder, polygon, converter, flat);
        }
        Geometry::MultiPolygon(MultiPolygon(polygons)) => {
            for polygon in polygons {
                spawn_single_polygon(commands, buf, builder, polygon, converter, flat);
            }
        }
        _ => {}
    }
}

fn spawn_single_polygon(
    commands: &mut Commands,
    buf: &mut BufferStore,
    builder: &mut MvtGeometryBuilder,
    polygon: &Polygon<f64>,
    converter: &mut PosConverter,
    flat: bool,
) {
    let outer_vec = if flat {
        converter.project_points_on_center(&polygon.exterior().0)
    } else {
        converter.project_points(&polygon.exterior().0)
    };

    let interiors = polygon.interiors();
    let mut holes: Vec<Hierarchy> = Vec::new();

    // In the MVT spec, the outer ring of a polygon is clockwise,
    // which is based on the origin being at the top-left.
    for interior in interiors {
        holes.push(Hierarchy {
            outer_ring: if flat {
                converter.project_points_on_center(&interior.0)
            } else {
                converter.project_points(&interior.0)
            },
            holes: None,
            expected_winding_order: if flat {
                WindingOrder::Clockwise
            } else {
                WindingOrder::CounterClockwise
            },
        });
    }

    if outer_vec.is_empty() {
        return;
    }

    let entity = commands
        .spawn((
            BatchedFeatureMarker,
            PolygonGeometry {
                hierarchy: Hierarchy {
                    outer_ring: outer_vec,
                    holes: Some(holes),
                    expected_winding_order: if flat {
                        WindingOrder::CounterClockwise
                    } else {
                        WindingOrder::Clockwise
                    },
                }
                .transfer(buf),
                crs: CRS::Geographic,
            },
        ))
        .id();

    let batch_index = builder.add_entity(GeometryAppearanceKind::Polygon, entity);
    commands.entity(entity).insert(BatchIndex(batch_index));
}

#[cfg(test)]
mod test {
    use super::*;
    use bevy_app::{App, Update};
    use bevy_ecs::prelude::Resource;
    use bevy_ecs::query::With;
    use bevy_ecs::system::{Commands, ResMut};
    use geozero::mvt::tile;
    use navara_feature_component::{
        batch::{BatchTable, BatchedFeature, FeatureBatchId, GlobalBatchIds},
        billboard::{BillboardGeometry, BillboardMarker},
        point::{PointGeometry, PointMarker},
        polygon::{PolygonGeometry, PolygonMarker},
        polyline::{PolylineGeometry, PolylineMarker},
        text::{TextGeometry, TextMarker},
    };
    use navara_material::{
        BillboardMaterial, PointMaterial, PolygonMaterial, PolylineMaterial, TextMaterial,
    };

    /// Helper: encode a zigzag integer (MVT spec parameter encoding).
    fn zigzag(n: i32) -> u32 {
        ((n << 1) ^ (n >> 31)) as u32
    }

    /// Helper: create MVT command integer.
    fn command(id: u32, count: u32) -> u32 {
        (count << 3) | id
    }

    /// Helper: build a point feature at the given tile coordinates.
    fn point_feature(x: i32, y: i32, tags: Vec<u32>) -> tile::Feature {
        tile::Feature {
            id: None,
            tags,
            r#type: Some(tile::GeomType::Point as i32),
            geometry: vec![command(1, 1), zigzag(x), zigzag(y)],
        }
    }

    /// Helper: build a multipoint feature from multiple tile coordinates.
    fn multipoint_feature(points: &[(i32, i32)], tags: Vec<u32>) -> tile::Feature {
        let mut geometry = Vec::new();
        if !points.is_empty() {
            geometry.push(command(1, points.len() as u32)); // MoveTo(n)
            let mut prev = (0i32, 0i32);
            for &(x, y) in points {
                geometry.push(zigzag(x - prev.0));
                geometry.push(zigzag(y - prev.1));
                prev = (x, y);
            }
        }
        tile::Feature {
            id: None,
            tags,
            r#type: Some(tile::GeomType::Point as i32),
            geometry,
        }
    }

    /// Helper: build a multilinestring feature from multiple line segments.
    fn multilinestring_feature(lines: &[&[(i32, i32)]], tags: Vec<u32>) -> tile::Feature {
        let mut geometry = Vec::new();
        for line in lines {
            if let Some(&(x0, y0)) = line.first() {
                geometry.push(command(1, 1));
                geometry.push(zigzag(x0));
                geometry.push(zigzag(y0));
                if line.len() > 1 {
                    geometry.push(command(2, (line.len() - 1) as u32));
                    let mut prev = (x0, y0);
                    for &(x, y) in &line[1..] {
                        geometry.push(zigzag(x - prev.0));
                        geometry.push(zigzag(y - prev.1));
                        prev = (x, y);
                    }
                }
            }
        }
        tile::Feature {
            id: None,
            tags,
            r#type: Some(tile::GeomType::Linestring as i32),
            geometry,
        }
    }

    /// Helper: build a multipolygon feature from multiple polygon rings.
    fn multipolygon_feature(rings: &[&[(i32, i32)]], tags: Vec<u32>) -> tile::Feature {
        let mut geometry = Vec::new();
        for ring in rings {
            if let Some(&(x0, y0)) = ring.first() {
                geometry.push(command(1, 1));
                geometry.push(zigzag(x0));
                geometry.push(zigzag(y0));
                if ring.len() > 1 {
                    geometry.push(command(2, (ring.len() - 1) as u32));
                    let mut prev = (x0, y0);
                    for &(x, y) in &ring[1..] {
                        geometry.push(zigzag(x - prev.0));
                        geometry.push(zigzag(y - prev.1));
                        prev = (x, y);
                    }
                }
                geometry.push(command(7, 1)); // ClosePath
            }
        }
        tile::Feature {
            id: None,
            tags,
            r#type: Some(tile::GeomType::Polygon as i32),
            geometry,
        }
    }

    /// Helper: build a linestring feature from the given points.
    fn linestring_feature(points: &[(i32, i32)], tags: Vec<u32>) -> tile::Feature {
        let mut geometry = Vec::new();
        if let Some(&(x0, y0)) = points.first() {
            geometry.push(command(1, 1)); // MoveTo(1)
            geometry.push(zigzag(x0));
            geometry.push(zigzag(y0));
            if points.len() > 1 {
                geometry.push(command(2, (points.len() - 1) as u32)); // LineTo(n-1)
                let mut prev = (x0, y0);
                for &(x, y) in &points[1..] {
                    geometry.push(zigzag(x - prev.0));
                    geometry.push(zigzag(y - prev.1));
                    prev = (x, y);
                }
            }
        }
        tile::Feature {
            id: None,
            tags,
            r#type: Some(tile::GeomType::Linestring as i32),
            geometry,
        }
    }

    /// Helper: build a polygon feature from the given ring of points.
    fn polygon_feature(ring: &[(i32, i32)], tags: Vec<u32>) -> tile::Feature {
        let mut geometry = Vec::new();
        if let Some(&(x0, y0)) = ring.first() {
            geometry.push(command(1, 1));
            geometry.push(zigzag(x0));
            geometry.push(zigzag(y0));
            if ring.len() > 1 {
                geometry.push(command(2, (ring.len() - 1) as u32));
                let mut prev = (x0, y0);
                for &(x, y) in &ring[1..] {
                    geometry.push(zigzag(x - prev.0));
                    geometry.push(zigzag(y - prev.1));
                    prev = (x, y);
                }
            }
            geometry.push(command(7, 1)); // ClosePath
        }
        tile::Feature {
            id: None,
            tags,
            r#type: Some(tile::GeomType::Polygon as i32),
            geometry,
        }
    }

    /// Helper: build a tile::Layer with the given features.
    fn make_layer(
        name: &str,
        features: Vec<tile::Feature>,
        keys: Vec<String>,
        values: Vec<tile::Value>,
    ) -> tile::Layer {
        tile::Layer {
            version: 2,
            name: name.to_string(),
            features,
            keys,
            values,
            extent: Some(4096),
        }
    }

    /// Helper: encode a Tile to protobuf bytes.
    fn encode_tile(layers: Vec<tile::Layer>) -> Vec<u8> {
        use geozero::mvt::Tile;
        let tile = Tile { layers };
        Message::encode_to_vec(&tile)
    }

    #[derive(Resource)]
    struct MvtTestInput {
        mvt_bin: Vec<u8>,
        appearances: Vec<Appearance>,
    }

    #[derive(Resource, Default)]
    struct MvtTestOutput(Option<Vec<Entity>>);

    fn test_construct_system(
        mut commands: Commands,
        mut batch_table: ResMut<BatchTable>,
        mut buf: ResMut<BufferStore>,
        input: bevy_ecs::system::Res<MvtTestInput>,
        mut out: ResMut<MvtTestOutput>,
    ) {
        let xyz = TileXYZ { x: 0, y: 0, z: 0 };
        let matched_layers = [MatchedLayerInfo {
            layer_id: "test_layer",
            appearances: &input.appearances,
            limit_layers: &None,
        }];
        let order = OrderByDistance {
            sse: 0.0,
            distance: 0.0,
        };
        out.0 = construct_geometry_multi_layer(
            &mut commands,
            &mut batch_table,
            &mut buf,
            input.mvt_bin.clone(),
            xyz,
            &matched_layers,
            None,
            &order,
        );
    }

    fn run_mvt_construct(mvt_bin: Vec<u8>, appearances: Vec<Appearance>) -> App {
        let mut app = App::new();
        app.init_resource::<BufferStore>();
        app.init_resource::<BatchTable>();
        app.init_resource::<MvtTestOutput>();
        app.insert_resource(MvtTestInput {
            mvt_bin,
            appearances,
        });
        app.add_systems(Update, test_construct_system);
        app.update();
        app
    }

    #[test]
    fn point_creates_batched_feature_with_mvt_marker() {
        let layer = make_layer(
            "points",
            vec![
                point_feature(2048, 2048, vec![]),
                point_feature(1024, 1024, vec![]),
            ],
            vec![],
            vec![],
        );
        let mvt_bin = encode_tile(vec![layer]);

        let mut app = run_mvt_construct(mvt_bin, vec![Appearance::Point(PointMaterial::default())]);

        // Should have 1 BatchedFeature parent with PointMarker
        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PointMarker>>();
        let batched: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched.len(), 1);
        assert_eq!(batched[0].features.len(), 2);
        // MVT: default_active should be false
        assert!(!batched[0].default_active);

        // Should have VectorTileFeatureMarker
        let mut mvt_query = app
            .world_mut()
            .query_filtered::<&VectorTileFeatureMarker, With<PointMarker>>();
        assert_eq!(mvt_query.iter(app.world()).count(), 1);

        // 2 child entities with PointGeometry
        let mut child_query = app
            .world_mut()
            .query_filtered::<&PointGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(child_query.iter(app.world()).count(), 2);
    }

    #[test]
    fn multiple_appearances_create_separate_batched_features() {
        let layer = make_layer(
            "points",
            vec![
                point_feature(2048, 2048, vec![]),
                point_feature(1024, 1024, vec![]),
            ],
            vec![],
            vec![],
        );
        let mvt_bin = encode_tile(vec![layer]);

        let mut app = run_mvt_construct(
            mvt_bin,
            vec![
                Appearance::Point(PointMaterial::default()),
                Appearance::Billboard(BillboardMaterial::default()),
                Appearance::Text(TextMaterial::default()),
            ],
        );

        // Each appearance kind should produce its own BatchedFeature parent
        let mut point_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PointMarker>>();
        let points: Vec<_> = point_query.iter(app.world()).collect();
        assert_eq!(points.len(), 1);
        assert_eq!(points[0].features.len(), 2);

        let mut billboard_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<BillboardMarker>>();
        let billboards: Vec<_> = billboard_query.iter(app.world()).collect();
        assert_eq!(billboards.len(), 1);
        assert_eq!(billboards[0].features.len(), 2);

        let mut text_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<TextMarker>>();
        let texts: Vec<_> = text_query.iter(app.world()).collect();
        assert_eq!(texts.len(), 1);
        assert_eq!(texts[0].features.len(), 2);

        // Each parent should have VectorTileFeatureMarker
        let mut mvt_point = app
            .world_mut()
            .query_filtered::<&VectorTileFeatureMarker, With<PointMarker>>();
        assert_eq!(mvt_point.iter(app.world()).count(), 1);

        let mut mvt_billboard = app
            .world_mut()
            .query_filtered::<&VectorTileFeatureMarker, With<BillboardMarker>>();
        assert_eq!(mvt_billboard.iter(app.world()).count(), 1);

        let mut mvt_text = app
            .world_mut()
            .query_filtered::<&VectorTileFeatureMarker, With<TextMarker>>();
        assert_eq!(mvt_text.iter(app.world()).count(), 1);

        // Child entities: 2 per appearance kind = 6 total
        let mut point_children = app
            .world_mut()
            .query_filtered::<&PointGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(point_children.iter(app.world()).count(), 2);

        let mut billboard_children = app
            .world_mut()
            .query_filtered::<&BillboardGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(billboard_children.iter(app.world()).count(), 2);

        let mut text_children = app
            .world_mut()
            .query_filtered::<&TextGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(text_children.iter(app.world()).count(), 2);
    }

    #[test]
    fn linestring_creates_polyline_batched_feature() {
        let layer = make_layer(
            "roads",
            vec![linestring_feature(&[(0, 0), (100, 100), (200, 50)], vec![])],
            vec![],
            vec![],
        );
        let mvt_bin = encode_tile(vec![layer]);

        let mut app = run_mvt_construct(
            mvt_bin,
            vec![Appearance::Polyline(PolylineMaterial::default())],
        );

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolylineMarker>>();
        let batched: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched.len(), 1);
        assert_eq!(batched[0].features.len(), 1);

        let mut child_query = app
            .world_mut()
            .query_filtered::<&PolylineGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(child_query.iter(app.world()).count(), 1);
    }

    #[test]
    fn polygon_creates_polygon_batched_feature() {
        // Clockwise ring (MVT convention for outer rings)
        let layer = make_layer(
            "buildings",
            vec![polygon_feature(
                &[(0, 0), (4096, 0), (4096, 4096), (0, 4096)],
                vec![],
            )],
            vec![],
            vec![],
        );
        let mvt_bin = encode_tile(vec![layer]);

        let mut app = run_mvt_construct(
            mvt_bin,
            vec![Appearance::Polygon(PolygonMaterial::default())],
        );

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolygonMarker>>();
        let batched: Vec<_> = batched_query.iter(app.world()).collect();
        assert_eq!(batched.len(), 1);
        assert_eq!(batched[0].features.len(), 1);

        let mut child_query = app
            .world_mut()
            .query_filtered::<&PolygonGeometry, With<BatchedFeatureMarker>>();
        assert_eq!(child_query.iter(app.world()).count(), 1);
    }

    #[test]
    fn mismatched_appearance_produces_no_parent() {
        let layer = make_layer(
            "points",
            vec![point_feature(2048, 2048, vec![])],
            vec![],
            vec![],
        );
        let mvt_bin = encode_tile(vec![layer]);

        let mut app = run_mvt_construct(
            mvt_bin,
            vec![Appearance::Polyline(PolylineMaterial::default())],
        );

        let mut batched_query = app
            .world_mut()
            .query_filtered::<&BatchedFeature, With<PolylineMarker>>();
        assert_eq!(batched_query.iter(app.world()).count(), 0);
    }

    #[test]
    fn global_batch_ids_has_correct_length() {
        let layer = make_layer(
            "points",
            vec![
                point_feature(100, 100, vec![]),
                point_feature(200, 200, vec![]),
                point_feature(300, 300, vec![]),
            ],
            vec![],
            vec![],
        );
        let mvt_bin = encode_tile(vec![layer]);

        let mut app = run_mvt_construct(mvt_bin, vec![Appearance::Point(PointMaterial::default())]);

        let mut global_ids_query = app
            .world_mut()
            .query_filtered::<&GlobalBatchIds, With<PointMarker>>();
        let global_ids: Vec<_> = global_ids_query.iter(app.world()).collect();
        assert_eq!(global_ids.len(), 1);
        assert_eq!(global_ids[0].batch_length, 3);
    }

    #[test]
    fn construct_returns_entity_ids() {
        let layer = make_layer(
            "points",
            vec![point_feature(2048, 2048, vec![])],
            vec![],
            vec![],
        );
        let mvt_bin = encode_tile(vec![layer]);

        let app = run_mvt_construct(mvt_bin, vec![Appearance::Point(PointMaterial::default())]);

        let output = app.world().resource::<MvtTestOutput>();
        let entities = output.0.as_ref().unwrap();
        assert_eq!(entities.len(), 1);
    }

    #[test]
    fn empty_tile_returns_none() {
        let mvt_bin = encode_tile(vec![]);

        let app = run_mvt_construct(mvt_bin, vec![Appearance::Point(PointMaterial::default())]);

        let output = app.world().resource::<MvtTestOutput>();
        assert!(output.0.is_none());
    }

    #[test]
    fn it_should_handle_all_geometry_types_with_all_appearances() {
        // MVT layer with mixed geometry types:
        // - 1 Point + 1 MultiPoint(2) = 3 point children per point-like appearance
        // - 1 LineString + 1 MultiLineString(2 segments) = 3 polyline children
        // - 1 Polygon + 1 MultiPolygon(2 rings) = 3 polygon children
        let layer = make_layer(
            "mixed",
            vec![
                // Point features
                point_feature(100, 100, vec![]),
                multipoint_feature(&[(200, 200), (300, 300)], vec![]),
                // LineString features
                linestring_feature(&[(0, 0), (100, 100), (200, 50)], vec![]),
                multilinestring_feature(
                    &[&[(500, 500), (600, 600)], &[(700, 700), (800, 800)]],
                    vec![],
                ),
                // Polygon features
                polygon_feature(&[(0, 0), (1000, 0), (1000, 1000), (0, 1000)], vec![]),
                multipolygon_feature(
                    &[
                        &[(1500, 1500), (2000, 1500), (2000, 2000), (1500, 2000)],
                        &[(2500, 2500), (3000, 2500), (3000, 3000), (2500, 3000)],
                    ],
                    vec![],
                ),
            ],
            vec![],
            vec![],
        );
        let mvt_bin = encode_tile(vec![layer]);

        let mut app = run_mvt_construct(
            mvt_bin,
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

        // All 5 parent entities should have VectorTileFeatureMarker
        let mut mvt_query = app.world_mut().query::<&VectorTileFeatureMarker>();
        assert_eq!(mvt_query.iter(app.world()).count(), 5);
    }

    #[test]
    fn it_should_have_separate_feature_batch_id_per_appearance() {
        // A Point feature with Point + Billboard + Text appearances gets separate
        // feature_batch_ids per kind, with tags duplicated into each batch.
        let layer = make_layer(
            "points",
            vec![point_feature(2048, 2048, vec![0, 0])],
            vec!["name".to_string()],
            vec![tile::Value {
                string_value: Some("shared".to_string()),
                ..Default::default()
            }],
        );
        let mvt_bin = encode_tile(vec![layer]);

        let mut app = run_mvt_construct(
            mvt_bin,
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

        // Each batch has its own copy of the tags
        let batch_table = app.world().resource::<BatchTable>();
        for batch_id in [point_batch_id, billboard_batch_id, text_batch_id] {
            let batch_value = batch_table.get(&batch_id).unwrap();
            let properties = batch_value.properties.as_ref().unwrap();
            match properties {
                navara_feature_component::batch::BatchProperty::Mvt(mvt_data) => {
                    assert_eq!(mvt_data.feature_tags.len(), 1);
                    assert_eq!(mvt_data.feature_tags[0], vec![0, 0]);
                }
                _ => panic!("Expected BatchProperty::Mvt"),
            }
        }
    }

    #[test]
    fn geometry_collection_sub_geometries_share_single_feature() {
        // MVT doesn't natively produce GeometryCollections, but
        // process_feature_geometry handles them defensively. Verify that
        // sub-geometries share a single feature's batch state.
        let mut app = App::new();
        app.init_resource::<BufferStore>();
        app.init_resource::<BatchTable>();

        #[derive(Resource, Default)]
        struct Out {
            entity_count: usize,
            feature_count: u32,
        }
        app.init_resource::<Out>();

        app.add_systems(
            Update,
            |mut commands: Commands,
             mut batch_table: ResMut<BatchTable>,
             mut buf: ResMut<BufferStore>,
             mut out: ResMut<Out>| {
                let keys = Arc::new(vec!["name".to_string()]);
                let values = Arc::new(vec![tile::Value {
                    string_value: Some("gc_test".to_string()),
                    ..Default::default()
                }]);
                let mut builder =
                    MvtGeometryBuilder::new(&mut batch_table, "test_layer", keys, values, 1);

                let xyz = TileXYZ { x: 0, y: 0, z: 0 };
                let mut converter = PosConverter::new(xyz, 4096);

                // One feature with tags
                builder.begin_feature(vec![0, 0]);

                // Build a GeometryCollection with two Points
                let gc = Geometry::GeometryCollection(geo_types::GeometryCollection(vec![
                    Geometry::Point(Point::new(2048.0, 2048.0)),
                    Geometry::Point(Point::new(1024.0, 1024.0)),
                ]));

                let appearances = [Appearance::Point(PointMaterial::default())];
                process_feature_geometry(
                    &mut commands,
                    &mut buf,
                    &mut builder,
                    &gc,
                    &mut converter,
                    &appearances,
                );

                // Two child entities from the GeometryCollection
                let point_group = builder
                    .groups
                    .groups
                    .iter()
                    .find(|g| g.kind == GeometryAppearanceKind::Point);
                if let Some(group) = point_group {
                    out.entity_count = group.entities.len();
                }

                // feature_count should be 1 (one feature, not two)
                let group = builder
                    .groups
                    .groups
                    .iter()
                    .find(|g| g.kind == GeometryAppearanceKind::Point);
                if let Some(g) = group {
                    out.feature_count = g.feature_count;
                }
            },
        );
        app.update();

        let out = app.world().resource::<Out>();
        assert_eq!(out.entity_count, 2);
        assert_eq!(out.feature_count, 1);
    }
}
