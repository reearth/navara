use std::sync::Arc;

use bevy_ecs::{entity::Entity, system::Commands};
use geozero::GeomProcessor;
use geozero::mvt::{Message, Tile as MvtTile, process_geom, tile};
use navara_buffer_store::BufferStore;
use navara_component::OrderByDistance;
use navara_core::{Aabb, CRS, TileXYZ, WGS84_64};
use navara_core::{Extent, Radians};
use navara_feature_component::{batch::BatchTable, geometry_builder::GeometryAppearanceKind};
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

    {
        let rtc_center = tile_info
            .map(|(_, ext)| Aabb::from_extent_f64(ext, 0., 1.).center)
            .unwrap_or(Vec3::ZERO);
        let mut processor = MvtFeatureProcessor::new(
            &mut builder,
            &mut converter,
            target_layer.appearances,
            rtc_center,
        );
        for feature in &mut mvt_layer.features {
            let tags = std::mem::take(&mut feature.tags);
            processor.builder.begin_feature(tags);
            let _ = process_geom(feature, &mut processor);
        }
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

// ============================================================================
// GeomProcessor implementation: spawn entities directly during MVT decoding
// ============================================================================

/// A [`GeomProcessor`] that accumulates geometry into batched components as MVT
/// geometry is decoded, eliminating both intermediate `geo_types::Geometry`
/// allocation and per-feature child entity spawning.
struct MvtFeatureProcessor<'a, 'bt> {
    builder: &'a mut MvtGeometryBuilder<'bt>,
    converter: &'a mut PosConverter,
    appearances: &'a [Appearance],

    /// Pre-projected coordinates for current linestring/ring.
    projected: Vec<FloatType>,
    /// Polygon outer ring.
    outer_ring: Vec<FloatType>,
    /// Polygon hole rings, built as `Hierarchy` in `linestring_end`.
    holes: Vec<Hierarchy>,
    /// Whether the polyline/polygon appearance uses `clamp_to_ground`.
    flat: bool,
    /// Whether we are inside a point/multipoint geometry.
    in_point: bool,
    /// Whether linestring_end should push to rings (polygon) vs spawn polyline.
    in_polygon: bool,
    /// RTC center for point encoding (from tile extent).
    rtc_center: Vec3,
    /// Per-kind material heights for point encoding.
    point_height: f32,
    billboard_height: f32,
    text_height: f32,
}

impl<'a, 'bt> MvtFeatureProcessor<'a, 'bt> {
    fn new(
        builder: &'a mut MvtGeometryBuilder<'bt>,
        converter: &'a mut PosConverter,
        appearances: &'a [Appearance],
        rtc_center: Vec3,
    ) -> Self {
        let flat = appearances.iter().any(|a| match a {
            Appearance::Polyline(app) => app.clamp_to_ground,
            Appearance::Polygon(app) => app.clamp_to_ground,
            _ => false,
        });

        let mut point_height = 0.0f32;
        let mut billboard_height = 0.0f32;
        let mut text_height = 0.0f32;
        for a in appearances {
            match a {
                Appearance::Point(m) => point_height = m.height,
                Appearance::Billboard(m) => billboard_height = m.height,
                Appearance::Text(m) => text_height = m.height,
                _ => {}
            }
        }

        Self {
            builder,
            converter,
            appearances,
            projected: Vec::new(),
            outer_ring: Vec::new(),
            holes: Vec::new(),
            flat,
            in_point: false,
            in_polygon: false,
            rtc_center,
            point_height,
            billboard_height,
            text_height,
        }
    }

    fn height_for_kind(&self, kind: GeometryAppearanceKind) -> f32 {
        match kind {
            GeometryAppearanceKind::Point => self.point_height,
            GeometryAppearanceKind::Billboard => self.billboard_height,
            GeometryAppearanceKind::Text => self.text_height,
            _ => 0.0,
        }
    }

    fn accumulate_point(&mut self, x: f64, y: f64, kind: GeometryAppearanceKind) {
        let (px, py) = self.converter.project_point(x, y);
        let coords = Vec3::new(px, py, 0.0 as FloatType);
        let world_pos = CRS::Geographic.to_vec3(WGS84_64, coords, self.height_for_kind(kind));
        let rtc = [
            (world_pos.x - self.rtc_center.x) as f32,
            (world_pos.y - self.rtc_center.y) as f32,
            (world_pos.z - self.rtc_center.z) as f32,
        ];
        self.builder
            .add_point(kind, coords, CRS::Geographic, rtc, self.rtc_center);
    }

    fn accumulate_points_from_coord(&mut self, x: f64, y: f64) {
        let appearances = self.appearances;
        for appearance in appearances {
            match appearance {
                Appearance::Point(_) => {
                    self.accumulate_point(x, y, GeometryAppearanceKind::Point);
                }
                Appearance::Billboard(_) => {
                    self.accumulate_point(x, y, GeometryAppearanceKind::Billboard);
                }
                Appearance::Text(_) => {
                    self.accumulate_point(x, y, GeometryAppearanceKind::Text);
                }
                _ => {}
            }
        }
    }

    fn accumulate_polyline(&mut self) {
        for appearance in self.appearances {
            let Appearance::Polyline(_) = appearance else {
                continue;
            };

            let geo_points = std::mem::take(&mut self.projected);

            if geo_points.is_empty() {
                break;
            }
            self.builder.add_polyline(geo_points, CRS::Geographic);
            break;
        }
    }

    fn accumulate_polygon(&mut self) {
        if self.outer_ring.is_empty() {
            return;
        }
        for appearance in self.appearances {
            let Appearance::Polygon(_) = appearance else {
                continue;
            };
            let outer_vec = std::mem::take(&mut self.outer_ring);
            let holes = std::mem::take(&mut self.holes);
            if outer_vec.is_empty() {
                break;
            }
            let winding_order = if self.flat {
                WindingOrder::CounterClockwise
            } else {
                WindingOrder::Clockwise
            };
            self.builder
                .add_polygon(outer_vec, &holes, winding_order, CRS::Geographic);
            break;
        }
    }
}

impl<'a, 'bt> GeomProcessor for MvtFeatureProcessor<'a, 'bt> {
    fn multi_dim(&self) -> bool {
        true
    }

    fn coordinate(
        &mut self,
        x: f64,
        y: f64,
        _z: Option<f64>,
        _m: Option<f64>,
        _t: Option<f64>,
        _tm: Option<u64>,
        _idx: usize,
    ) -> geozero::error::Result<()> {
        if self.in_point {
            self.accumulate_points_from_coord(x, y);
        } else if self.flat {
            let (cx, cy) = self.converter.project_point_on_center(x, y);
            self.projected.push(cx);
            self.projected.push(cy);
            self.projected.push(0.0);
        } else {
            let (gx, gy) = self.converter.project_point(x, y);
            self.projected.push(gx);
            self.projected.push(gy);
            self.projected.push(0.0);
        }
        Ok(())
    }

    fn point_begin(&mut self, _idx: usize) -> geozero::error::Result<()> {
        self.in_point = true;
        Ok(())
    }

    fn point_end(&mut self, _idx: usize) -> geozero::error::Result<()> {
        self.in_point = false;
        Ok(())
    }

    fn multipoint_begin(&mut self, _size: usize, _idx: usize) -> geozero::error::Result<()> {
        self.in_point = true;
        Ok(())
    }

    fn multipoint_end(&mut self, _idx: usize) -> geozero::error::Result<()> {
        self.in_point = false;
        Ok(())
    }

    fn linestring_begin(
        &mut self,
        _tagged: bool,
        size: usize,
        _idx: usize,
    ) -> geozero::error::Result<()> {
        self.projected.clear();
        self.projected.reserve(size * 3);
        Ok(())
    }

    fn linestring_end(&mut self, _tagged: bool, _idx: usize) -> geozero::error::Result<()> {
        if self.in_polygon {
            if self.outer_ring.is_empty() {
                self.outer_ring = std::mem::take(&mut self.projected);
            } else {
                self.holes.push(Hierarchy {
                    outer_ring: std::mem::take(&mut self.projected),
                    holes: None,
                    expected_winding_order: if self.flat {
                        WindingOrder::Clockwise
                    } else {
                        WindingOrder::CounterClockwise
                    },
                });
            }
        } else {
            self.accumulate_polyline();
        }
        Ok(())
    }

    fn polygon_begin(
        &mut self,
        _tagged: bool,
        _size: usize,
        _idx: usize,
    ) -> geozero::error::Result<()> {
        self.in_polygon = true;
        self.outer_ring.clear();
        self.holes.clear();
        Ok(())
    }

    fn polygon_end(&mut self, _tagged: bool, _idx: usize) -> geozero::error::Result<()> {
        self.accumulate_polygon();
        self.in_polygon = false;
        Ok(())
    }
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
        batched_geometry::{BatchedPointGeometry, BatchedPolygonGeometry, BatchedPolylineGeometry},
        billboard::BillboardMarker,
        point::PointMarker,
        polygon::PolygonMarker,
        polyline::PolylineMarker,
        text::TextMarker,
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

        // Should have 1 BatchedFeature parent with PointMarker and BatchedPointGeometry
        let mut query = app
            .world_mut()
            .query_filtered::<(&BatchedFeature, &BatchedPointGeometry), With<PointMarker>>();
        let results: Vec<_> = query.iter(app.world()).collect();
        assert_eq!(results.len(), 1);
        let (batched, geom) = results[0];
        assert!(!batched.default_active);
        assert_eq!(geom.coords.len(), 2);
        let buf = app.world().resource::<BufferStore>();
        assert_eq!(geom.batch_indices(buf).unwrap(), &[0, 1]);

        // Should have VectorTileFeatureMarker
        let mut mvt_query = app
            .world_mut()
            .query_filtered::<&VectorTileFeatureMarker, With<PointMarker>>();
        assert_eq!(mvt_query.iter(app.world()).count(), 1);
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

        // Each appearance kind should produce its own parent with BatchedPointGeometry
        let mut point_query = app
            .world_mut()
            .query_filtered::<&BatchedPointGeometry, With<PointMarker>>();
        let points: Vec<_> = point_query.iter(app.world()).collect();
        assert_eq!(points.len(), 1);
        assert_eq!(points[0].coords.len(), 2);

        let mut billboard_query = app
            .world_mut()
            .query_filtered::<&BatchedPointGeometry, With<BillboardMarker>>();
        let billboards: Vec<_> = billboard_query.iter(app.world()).collect();
        assert_eq!(billboards.len(), 1);
        assert_eq!(billboards[0].coords.len(), 2);

        let mut text_query = app
            .world_mut()
            .query_filtered::<&BatchedPointGeometry, With<TextMarker>>();
        let texts: Vec<_> = text_query.iter(app.world()).collect();
        assert_eq!(texts.len(), 1);
        assert_eq!(texts[0].coords.len(), 2);

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

        let mut query = app
            .world_mut()
            .query_filtered::<(&BatchedFeature, &BatchedPolylineGeometry), With<PolylineMarker>>();
        let results: Vec<_> = query.iter(app.world()).collect();
        assert_eq!(results.len(), 1);
        let (_batched, geom) = results[0];

        let buf = app.world().resource::<BufferStore>();
        assert_eq!(geom.feature_count(buf), 1); // 1 polyline feature
        assert_eq!(geom.batch_indices(buf).unwrap(), &[0]);
        // 3 points * 3 coords = 9
        assert_eq!(geom.points(buf).unwrap().len(), 9);
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

        let mut query = app
            .world_mut()
            .query_filtered::<(&BatchedFeature, &BatchedPolygonGeometry), With<PolygonMarker>>();
        let results: Vec<_> = query.iter(app.world()).collect();
        assert_eq!(results.len(), 1);
        let (_batched, geom) = results[0];

        let buf = app.world().resource::<BufferStore>();
        assert_eq!(geom.feature_count(buf), 1); // 1 polygon
        assert_eq!(geom.batch_indices(buf).unwrap(), &[0]);
        // 4 vertices + closing vertex from ClosePath = 5 * 3 coords = 15
        assert_eq!(geom.outer_rings(buf).unwrap().len(), 15);
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

        let mut query = app
            .world_mut()
            .query_filtered::<(&GlobalBatchIds, &BatchedPointGeometry), With<PointMarker>>();
        let results: Vec<_> = query.iter(app.world()).collect();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].0.batch_length, 3);
        assert_eq!(results[0].1.coords.len(), 3);
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
        // - 1 Point + 1 MultiPoint(2) = 3 point coords per point-like appearance
        // - 1 LineString + 1 MultiLineString(2 segments) = 3 polyline segments
        // - 1 Polygon + 1 MultiPolygon(2 rings) = 3 polygon features
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

        // Point: 1 + 2 (multipoint) = 3 coords
        let mut point_query = app
            .world_mut()
            .query_filtered::<&BatchedPointGeometry, With<PointMarker>>();
        let points: Vec<_> = point_query.iter(app.world()).collect();
        assert_eq!(points.len(), 1);
        assert_eq!(points[0].coords.len(), 3);

        // Billboard: same 3 coords
        let mut billboard_query = app
            .world_mut()
            .query_filtered::<&BatchedPointGeometry, With<BillboardMarker>>();
        let billboards: Vec<_> = billboard_query.iter(app.world()).collect();
        assert_eq!(billboards.len(), 1);
        assert_eq!(billboards[0].coords.len(), 3);

        // Text: same 3 coords
        let mut text_query = app
            .world_mut()
            .query_filtered::<&BatchedPointGeometry, With<TextMarker>>();
        let texts: Vec<_> = text_query.iter(app.world()).collect();
        assert_eq!(texts.len(), 1);
        assert_eq!(texts[0].coords.len(), 3);

        // Polyline: 1 (LineString) + 2 (MultiLineString) = 3 segments
        let mut polyline_query = app
            .world_mut()
            .query_filtered::<&BatchedPolylineGeometry, With<PolylineMarker>>();
        let polylines: Vec<_> = polyline_query.iter(app.world()).collect();
        assert_eq!(polylines.len(), 1);
        let buf = app.world().resource::<BufferStore>();
        assert_eq!(polylines[0].feature_count(buf), 3);

        // Polygon: 1 (Polygon) + 2 (MultiPolygon) = 3 polygons
        let mut polygon_query = app
            .world_mut()
            .query_filtered::<&BatchedPolygonGeometry, With<PolygonMarker>>();
        let polygons: Vec<_> = polygon_query.iter(app.world()).collect();
        assert_eq!(polygons.len(), 1);
        let buf = app.world().resource::<BufferStore>();
        assert_eq!(polygons[0].feature_count(buf), 3);

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
}
