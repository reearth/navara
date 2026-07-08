//! ECS-free MVT geometry parse core.
//!
//! Decodes an MVT tile, projects tile coordinates to geographic/center space and
//! aggregates the vertices of each matched target layer into plain `Vec` buffers.
//! No batch-id assignment, tag registration or entity spawning happens here: the
//! output is pure data that the main thread finalizes (or that is transferred out
//! of a Web Worker). See [`parse_mvt_tile`].

use std::sync::Arc;

use geozero::GeomProcessor;
use geozero::mvt::{Message, Tile as MvtTile, process_geom, tile};
use navara_core::{CRS, TileXYZ, WGS84_64};
use navara_geometry::{Hierarchy, WindingOrder};
use navara_math::{FloatType, Vec3};

use super::config::{LayerParseConfig, LayerParseKind};
use super::pos_converter::PosConverter;

// ============================================================================
// Output types
// ============================================================================

/// Plain, ECS-free geometry payload for one parsed group.
///
/// The field layout intentionally mirrors the builder-side accumulators in
/// `navara_feature_component` so finalization is a direct field move.
#[derive(Debug, PartialEq)]
pub enum ParsedGeometry {
    Points {
        /// Geographic coordinates (lon, lat, 0) kept for terrain height updates.
        coords: Vec<Vec3>,
        batch_indices: Vec<u32>,
        /// RTC-encoded positions relative to the tile center (3 f32 per vertex).
        encoded_coords: Vec<f32>,
    },
    Polylines {
        points: Vec<f64>,
        points_sizes: Vec<u32>,
        batch_indices: Vec<u32>,
    },
    Polygons {
        outer_rings: Vec<f64>,
        outer_ring_sizes: Vec<u32>,
        holes: Vec<f64>,
        holes_total_sizes: Vec<u32>,
        holes_sizes: Vec<u32>,
        holes_boundaries: Vec<u32>,
        expected_winding_orders: Vec<u8>,
        batch_indices: Vec<u32>,
    },
}

impl ParsedGeometry {
    /// Number of geometry items. One global batch id must be generated per item
    /// during finalization; this equals `batch_indices.len()` for every kind.
    pub fn item_count(&self) -> usize {
        match self {
            ParsedGeometry::Points { batch_indices, .. } => batch_indices.len(),
            ParsedGeometry::Polylines { batch_indices, .. } => batch_indices.len(),
            ParsedGeometry::Polygons { batch_indices, .. } => batch_indices.len(),
        }
    }
}

/// One parsed geometry group for a single (layer, kind) pair.
pub struct ParsedLayerGroup {
    pub layer_id: String,
    pub kind: LayerParseKind,
    /// Number of distinct features that produced geometry for this kind.
    pub feature_count: u32,
    /// All per-feature MVT tag pairs concatenated, in commit order.
    pub feature_tags_flat: Vec<u32>,
    /// Per-feature tag counts, parallel to `feature_count`.
    pub feature_tag_sizes: Vec<u32>,
    pub keys: Arc<Vec<String>>,
    pub values: Arc<Vec<tile::Value>>,
    pub geometry: ParsedGeometry,
}

/// Flatten geographic `Vec3` coordinates into a packed `[x, y, z, ...]` buffer.
///
/// Inverse of [`unflatten_vec3`]. Both live here so the pack order is single-
/// sourced: the Web Worker packs point coordinates with this before transfer and
/// the main thread unpacks them with `unflatten_vec3` on completion.
pub fn flatten_vec3(coords: Vec<Vec3>) -> Vec<f64> {
    let mut out = Vec::with_capacity(coords.len() * 3);
    for c in coords {
        out.push(c.x);
        out.push(c.y);
        out.push(c.z);
    }
    out
}

/// Unpack a packed `[x, y, z, ...]` buffer into `Vec3`s. Inverse of [`flatten_vec3`].
///
/// `flat.len()` must be a multiple of 3 — always true for buffers produced by
/// [`flatten_vec3`]; a remainder means the packed streams and their meta got out
/// of sync (version skew or a corrupt tile), which would otherwise surface only
/// as silently mismatched coordinate/batch-index lengths downstream.
pub fn unflatten_vec3(flat: &[f64]) -> Vec<Vec3> {
    debug_assert!(
        flat.len().is_multiple_of(3),
        "packed vec3 stream length {} is not a multiple of 3",
        flat.len()
    );
    flat.chunks_exact(3)
        .map(|c| Vec3::new(c[0], c[1], c[2]))
        .collect()
}

// ============================================================================
// Internal per-kind accumulation
// ============================================================================

/// Growing plain buffers for a single geometry kind.
enum GeomBuf {
    Points {
        coords: Vec<Vec3>,
        batch_indices: Vec<u32>,
        encoded_coords: Vec<f32>,
    },
    Polylines {
        points: Vec<f64>,
        points_sizes: Vec<u32>,
        batch_indices: Vec<u32>,
    },
    Polygons {
        outer_rings: Vec<f64>,
        outer_ring_sizes: Vec<u32>,
        holes: Vec<f64>,
        holes_total_sizes: Vec<u32>,
        holes_sizes: Vec<u32>,
        holes_boundaries: Vec<u32>,
        expected_winding_orders: Vec<u8>,
        batch_indices: Vec<u32>,
    },
}

impl GeomBuf {
    fn new(kind: LayerParseKind) -> Self {
        match kind {
            LayerParseKind::Point | LayerParseKind::Billboard | LayerParseKind::Text => {
                GeomBuf::Points {
                    coords: Vec::new(),
                    batch_indices: Vec::new(),
                    encoded_coords: Vec::new(),
                }
            }
            LayerParseKind::Polyline => GeomBuf::Polylines {
                points: Vec::new(),
                points_sizes: Vec::new(),
                batch_indices: Vec::new(),
            },
            LayerParseKind::Polygon => GeomBuf::Polygons {
                outer_rings: Vec::new(),
                outer_ring_sizes: Vec::new(),
                holes: Vec::new(),
                holes_total_sizes: Vec::new(),
                holes_sizes: Vec::new(),
                holes_boundaries: Vec::new(),
                expected_winding_orders: Vec::new(),
                batch_indices: Vec::new(),
            },
        }
    }

    fn into_parsed(self) -> ParsedGeometry {
        match self {
            GeomBuf::Points {
                coords,
                batch_indices,
                encoded_coords,
            } => ParsedGeometry::Points {
                coords,
                batch_indices,
                encoded_coords,
            },
            GeomBuf::Polylines {
                points,
                points_sizes,
                batch_indices,
            } => ParsedGeometry::Polylines {
                points,
                points_sizes,
                batch_indices,
            },
            GeomBuf::Polygons {
                outer_rings,
                outer_ring_sizes,
                holes,
                holes_total_sizes,
                holes_sizes,
                holes_boundaries,
                expected_winding_orders,
                batch_indices,
            } => ParsedGeometry::Polygons {
                outer_rings,
                outer_ring_sizes,
                holes,
                holes_total_sizes,
                holes_sizes,
                holes_boundaries,
                expected_winding_orders,
                batch_indices,
            },
        }
    }
}

/// Per-kind group state, tracking per-feature batch indices while accumulating.
struct GroupAccum {
    kind: LayerParseKind,
    feature_count: u32,
    committed: bool,
    current_batch_index: u32,
    feature_tags_flat: Vec<u32>,
    feature_tag_sizes: Vec<u32>,
    geom: GeomBuf,
}

impl GroupAccum {
    fn new(kind: LayerParseKind) -> Self {
        Self {
            kind,
            feature_count: 0,
            committed: false,
            current_batch_index: 0,
            feature_tags_flat: Vec::new(),
            feature_tag_sizes: Vec::new(),
            geom: GeomBuf::new(kind),
        }
    }
}

// ============================================================================
// GeomProcessor
// ============================================================================

/// A [`GeomProcessor`] that walks MVT geometry commands and aggregates vertices
/// into per-kind plain buffers, projecting coordinates via [`PosConverter`].
struct MvtFeatureProcessor<'a> {
    groups: Vec<GroupAccum>,
    converter: &'a PosConverter,
    config: &'a LayerParseConfig,
    rtc_center: Vec3,

    /// Tags of the feature currently being processed (committed lazily per kind).
    pending_tags: Option<Vec<u32>>,
    /// Pre-projected coordinates for the current linestring/ring.
    projected: Vec<FloatType>,
    /// Polygon outer ring.
    outer_ring: Vec<FloatType>,
    /// Polygon hole rings, built during `linestring_end`.
    holes: Vec<Hierarchy>,
    /// Whether we are inside a point/multipoint geometry.
    in_point: bool,
    /// Whether `linestring_end` should push to rings (polygon) vs a polyline.
    in_polygon: bool,
}

impl<'a> MvtFeatureProcessor<'a> {
    fn new(converter: &'a PosConverter, config: &'a LayerParseConfig, rtc_center: Vec3) -> Self {
        Self {
            groups: Vec::new(),
            converter,
            config,
            rtc_center,
            pending_tags: None,
            projected: Vec::new(),
            outer_ring: Vec::new(),
            holes: Vec::new(),
            in_point: false,
            in_polygon: false,
        }
    }

    fn begin_feature(&mut self, tags: Vec<u32>) {
        self.pending_tags = Some(tags);
        for group in &mut self.groups {
            group.committed = false;
        }
    }

    /// Ensure a group for `kind` exists, commit the current feature into it on
    /// first use, and return `(group_index, batch_index)`. Returning the index
    /// lets callers address the group directly via `self.groups[idx]` instead of
    /// re-scanning `self.groups` for `kind` on every accumulated item.
    fn commit_group(&mut self, kind: LayerParseKind) -> (usize, u32) {
        let idx = match self.groups.iter().position(|g| g.kind == kind) {
            Some(idx) => idx,
            None => {
                self.groups.push(GroupAccum::new(kind));
                self.groups.len() - 1
            }
        };
        // Borrow the pending tags and the target group disjointly (distinct
        // fields) so the tags are appended without an intermediate clone.
        let pending = self.pending_tags.as_deref().unwrap_or(&[]);
        let group = &mut self.groups[idx];
        if !group.committed {
            group.current_batch_index = group.feature_count;
            group.feature_count += 1;
            group.committed = true;
            group.feature_tags_flat.extend_from_slice(pending);
            group.feature_tag_sizes.push(pending.len() as u32);
        }
        (idx, group.current_batch_index)
    }

    fn height_for(&self, kind: LayerParseKind) -> f32 {
        self.config
            .point_emitters
            .iter()
            .find(|e| e.kind == kind)
            .map(|e| e.height)
            .unwrap_or(0.0)
    }

    /// Project a single tile coordinate and accumulate it for `kind`.
    fn accumulate_point(&mut self, x: f64, y: f64, kind: LayerParseKind) {
        let (px, py) = self.converter.project_point(x, y);
        let coords = Vec3::new(px, py, 0.0 as FloatType);
        let world_pos = CRS::Geographic.to_vec3(WGS84_64, coords, self.height_for(kind));
        let rtc = [
            (world_pos.x - self.rtc_center.x) as f32,
            (world_pos.y - self.rtc_center.y) as f32,
            (world_pos.z - self.rtc_center.z) as f32,
        ];
        let (idx, batch_index) = self.commit_group(kind);
        if let GeomBuf::Points {
            coords: c,
            batch_indices,
            encoded_coords,
        } = &mut self.groups[idx].geom
        {
            c.push(coords);
            batch_indices.push(batch_index);
            encoded_coords.push(rtc[0]);
            encoded_coords.push(rtc[1]);
            encoded_coords.push(rtc[2]);
        }
    }

    fn accumulate_points_from_coord(&mut self, x: f64, y: f64) {
        // Copy the shared config reference out so the loop borrows the emitters
        // (which live for `'a`) rather than `self`, leaving `accumulate_point`'s
        // `&mut self` free without cloning the emitter Vec on every coordinate.
        let config = self.config;
        for emitter in &config.point_emitters {
            self.accumulate_point(x, y, emitter.kind);
        }
    }

    fn accumulate_polyline(&mut self) {
        if !self.config.polyline {
            return;
        }
        let points = std::mem::take(&mut self.projected);
        if points.is_empty() {
            return;
        }
        let (idx, batch_index) = self.commit_group(LayerParseKind::Polyline);
        if let GeomBuf::Polylines {
            points: p,
            points_sizes,
            batch_indices,
        } = &mut self.groups[idx].geom
        {
            points_sizes.push(points.len() as u32);
            p.extend(points);
            batch_indices.push(batch_index);
        }
    }

    fn accumulate_polygon(&mut self) {
        if !self.config.polygon || self.outer_ring.is_empty() {
            self.outer_ring.clear();
            self.holes.clear();
            return;
        }
        let outer = std::mem::take(&mut self.outer_ring);
        let holes = std::mem::take(&mut self.holes);
        let winding_order = if self.config.flat {
            WindingOrder::CounterClockwise
        } else {
            WindingOrder::Clockwise
        };
        let (idx, batch_index) = self.commit_group(LayerParseKind::Polygon);
        if let GeomBuf::Polygons {
            outer_rings,
            outer_ring_sizes,
            holes: hole_buf,
            holes_total_sizes,
            holes_sizes,
            holes_boundaries,
            expected_winding_orders,
            batch_indices,
        } = &mut self.groups[idx].geom
        {
            outer_ring_sizes.push(outer.len() as u32);
            outer_rings.extend(outer);
            expected_winding_orders.push(winding_order as u8);

            let mut total_hole_size: u32 = 0;
            let hole_count = holes.len() as u32;
            for hole in &holes {
                let hole_size = hole.outer_ring.len() as u32;
                hole_buf.extend_from_slice(&hole.outer_ring);
                holes_sizes.push(hole_size);
                expected_winding_orders.push(hole.expected_winding_order as u8);
                total_hole_size += hole_size;
            }
            holes_total_sizes.push(total_hole_size);
            holes_boundaries.push(hole_count);
            batch_indices.push(batch_index);
        }
    }
}

impl GeomProcessor for MvtFeatureProcessor<'_> {
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
        } else if self.config.flat {
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
                    expected_winding_order: if self.config.flat {
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

// ============================================================================
// Entry points
// ============================================================================

/// Parse an MVT tile into plain per-(layer, kind) geometry groups.
///
/// `rtc_center` is the tile-relative center used to encode point positions; the
/// caller computes it from the tile extent (or `Vec3::ZERO` when unknown).
/// `configs` describes each matched target layer; for every MVT sublayer the
/// last matching config wins (rendering the same features for multiple layers
/// with the same source provides no visual benefit).
pub fn parse_mvt_tile(
    mvt_bin: &[u8],
    xyz: TileXYZ,
    rtc_center: Vec3,
    configs: &[LayerParseConfig],
) -> Vec<ParsedLayerGroup> {
    if configs.is_empty() {
        return Vec::new();
    }
    let Ok(tile) = MvtTile::decode(mvt_bin) else {
        return Vec::new();
    };

    let mut result = Vec::new();
    for mvt_layer in tile.layers {
        parse_layer(mvt_layer, xyz, rtc_center, configs, &mut result);
    }
    result
}

fn parse_layer(
    mut mvt_layer: tile::Layer,
    xyz: TileXYZ,
    rtc_center: Vec3,
    configs: &[LayerParseConfig],
    out: &mut Vec<ParsedLayerGroup>,
) {
    let extent = mvt_layer.extent.unwrap_or(4096);
    let converter = PosConverter::new(xyz, extent);

    let Some(config) = configs
        .iter()
        .rev()
        .find(|c| c.matches_sublayer(&mvt_layer.name))
    else {
        return;
    };

    let keys = Arc::new(std::mem::take(&mut mvt_layer.keys));
    let values = Arc::new(std::mem::take(&mut mvt_layer.values));

    let mut processor = MvtFeatureProcessor::new(&converter, config, rtc_center);
    for feature in &mut mvt_layer.features {
        let tags = std::mem::take(&mut feature.tags);
        processor.begin_feature(tags);
        let _ = process_geom(feature, &mut processor);
    }

    for group in processor.groups {
        let geometry = group.geom.into_parsed();
        if geometry.item_count() == 0 {
            continue;
        }
        out.push(ParsedLayerGroup {
            layer_id: config.layer_id.clone(),
            kind: group.kind,
            feature_count: group.feature_count,
            feature_tags_flat: group.feature_tags_flat,
            feature_tag_sizes: group.feature_tag_sizes,
            keys: Arc::clone(&keys),
            values: Arc::clone(&values),
            geometry,
        });
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod test {
    use super::*;

    /// Encode a zigzag integer (MVT spec parameter encoding).
    fn zigzag(n: i32) -> u32 {
        ((n << 1) ^ (n >> 31)) as u32
    }

    /// Build an MVT command integer.
    fn command(id: u32, count: u32) -> u32 {
        (count << 3) | id
    }

    fn point_feature(x: i32, y: i32, tags: Vec<u32>) -> tile::Feature {
        tile::Feature {
            id: None,
            tags,
            r#type: Some(tile::GeomType::Point as i32),
            geometry: vec![command(1, 1), zigzag(x), zigzag(y)],
        }
    }

    fn multipoint_feature(points: &[(i32, i32)], tags: Vec<u32>) -> tile::Feature {
        let mut geometry = Vec::new();
        if !points.is_empty() {
            geometry.push(command(1, points.len() as u32));
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

    fn linestring_feature(points: &[(i32, i32)], tags: Vec<u32>) -> tile::Feature {
        let mut geometry = Vec::new();
        if let Some(&(x0, y0)) = points.first() {
            geometry.push(command(1, 1));
            geometry.push(zigzag(x0));
            geometry.push(zigzag(y0));
            if points.len() > 1 {
                geometry.push(command(2, (points.len() - 1) as u32));
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

    /// A polygon feature with an outer ring followed by hole rings.
    fn polygon_with_holes_feature(rings: &[&[(i32, i32)]], tags: Vec<u32>) -> tile::Feature {
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
                geometry.push(command(7, 1));
            }
        }
        tile::Feature {
            id: None,
            tags,
            r#type: Some(tile::GeomType::Polygon as i32),
            geometry,
        }
    }

    fn make_layer(name: &str, features: Vec<tile::Feature>) -> tile::Layer {
        tile::Layer {
            version: 2,
            name: name.to_string(),
            features,
            keys: vec!["name".to_string(), "class".to_string()],
            values: vec![],
            extent: Some(4096),
        }
    }

    fn encode_tile(layers: Vec<tile::Layer>) -> Vec<u8> {
        use geozero::mvt::Tile;
        Message::encode_to_vec(&Tile { layers })
    }

    fn xyz() -> TileXYZ {
        TileXYZ { x: 0, y: 0, z: 0 }
    }

    fn point_config() -> LayerParseConfig {
        LayerParseConfig {
            layer_id: "layer".to_string(),
            flat: false,
            point_emitters: vec![super::super::config::PointEmitter {
                kind: LayerParseKind::Point,
                height: 0.0,
            }],
            polyline: false,
            polygon: false,
            limit_layers: None,
        }
    }

    fn polyline_config() -> LayerParseConfig {
        LayerParseConfig {
            layer_id: "layer".to_string(),
            flat: false,
            point_emitters: vec![],
            polyline: true,
            polygon: false,
            limit_layers: None,
        }
    }

    fn polygon_config() -> LayerParseConfig {
        LayerParseConfig {
            layer_id: "layer".to_string(),
            flat: false,
            point_emitters: vec![],
            polyline: false,
            polygon: true,
            limit_layers: None,
        }
    }

    #[test]
    fn parses_points_with_per_feature_batch_indices() {
        let bin = encode_tile(vec![make_layer(
            "l",
            vec![
                point_feature(10, 20, vec![0, 0]),
                point_feature(30, 40, vec![0, 1]),
            ],
        )]);
        let groups = parse_mvt_tile(&bin, xyz(), Vec3::ZERO, &[point_config()]);
        assert_eq!(groups.len(), 1);
        let g = &groups[0];
        assert_eq!(g.kind, LayerParseKind::Point);
        assert_eq!(g.feature_count, 2);
        assert_eq!(g.feature_tags_flat, vec![0, 0, 0, 1]);
        assert_eq!(g.feature_tag_sizes, vec![2, 2]);
        match &g.geometry {
            ParsedGeometry::Points {
                coords,
                batch_indices,
                encoded_coords,
            } => {
                assert_eq!(coords.len(), 2);
                assert_eq!(batch_indices, &vec![0, 1]);
                assert_eq!(encoded_coords.len(), 6);
            }
            _ => panic!("expected points"),
        }
    }

    #[test]
    fn multipoint_shares_batch_index() {
        let bin = encode_tile(vec![make_layer(
            "l",
            vec![multipoint_feature(&[(1, 1), (2, 2), (3, 3)], vec![0, 0])],
        )]);
        let groups = parse_mvt_tile(&bin, xyz(), Vec3::ZERO, &[point_config()]);
        let g = &groups[0];
        assert_eq!(g.feature_count, 1);
        match &g.geometry {
            ParsedGeometry::Points {
                coords,
                batch_indices,
                ..
            } => {
                assert_eq!(coords.len(), 3);
                assert_eq!(batch_indices, &vec![0, 0, 0]);
            }
            _ => panic!("expected points"),
        }
    }

    #[test]
    fn parses_polylines() {
        let bin = encode_tile(vec![make_layer(
            "l",
            vec![
                linestring_feature(&[(0, 0), (10, 10)], vec![0, 0]),
                linestring_feature(&[(20, 20), (30, 30), (40, 40)], vec![0, 1]),
            ],
        )]);
        let groups = parse_mvt_tile(&bin, xyz(), Vec3::ZERO, &[polyline_config()]);
        let g = &groups[0];
        assert_eq!(g.kind, LayerParseKind::Polyline);
        match &g.geometry {
            ParsedGeometry::Polylines {
                points,
                points_sizes,
                batch_indices,
            } => {
                assert_eq!(points_sizes, &vec![6, 9]); // 2 pts * 3, 3 pts * 3
                assert_eq!(points.len(), 15);
                assert_eq!(batch_indices, &vec![0, 1]);
            }
            _ => panic!("expected polylines"),
        }
    }

    #[test]
    fn parses_single_ring_polygon() {
        // Clockwise ring (MVT convention for outer rings).
        let bin = encode_tile(vec![make_layer(
            "l",
            vec![polygon_feature(
                &[(0, 0), (100, 0), (100, 100), (0, 100)],
                vec![0, 0],
            )],
        )]);
        let groups = parse_mvt_tile(&bin, xyz(), Vec3::ZERO, &[polygon_config()]);
        let g = &groups[0];
        assert_eq!(g.kind, LayerParseKind::Polygon);
        assert_eq!(g.feature_count, 1);
        match &g.geometry {
            ParsedGeometry::Polygons {
                outer_ring_sizes,
                holes_boundaries,
                expected_winding_orders,
                batch_indices,
                ..
            } => {
                assert_eq!(outer_ring_sizes.len(), 1);
                assert_eq!(holes_boundaries, &vec![0]);
                assert_eq!(batch_indices, &vec![0]);
                assert_eq!(
                    expected_winding_orders,
                    &vec![WindingOrder::Clockwise as u8]
                );
            }
            _ => panic!("expected polygons"),
        }
    }

    #[test]
    fn multipolygon_shares_batch_index() {
        // Two exterior rings in a single feature (a multipolygon) accumulate as
        // two outer rings that share the feature's batch index.
        let bin = encode_tile(vec![make_layer(
            "l",
            vec![polygon_with_holes_feature(
                &[
                    &[(0, 0), (100, 0), (100, 100), (0, 100)],
                    &[(200, 200), (300, 200), (300, 300), (200, 300)],
                ],
                vec![0, 0],
            )],
        )]);
        let groups = parse_mvt_tile(&bin, xyz(), Vec3::ZERO, &[polygon_config()]);
        let g = &groups[0];
        assert_eq!(g.feature_count, 1);
        match &g.geometry {
            ParsedGeometry::Polygons {
                outer_ring_sizes,
                batch_indices,
                ..
            } => {
                assert_eq!(outer_ring_sizes.len(), 2);
                assert_eq!(batch_indices, &vec![0, 0]);
            }
            _ => panic!("expected polygons"),
        }
    }

    #[test]
    fn limit_layers_selects_sublayer() {
        let bin = encode_tile(vec![
            make_layer("roads", vec![point_feature(1, 1, vec![])]),
            make_layer("buildings", vec![point_feature(2, 2, vec![])]),
        ]);
        let mut config = point_config();
        config.limit_layers = Some(vec!["buildings".to_string()]);
        let groups = parse_mvt_tile(&bin, xyz(), Vec3::ZERO, &[config]);
        // Only the "buildings" sublayer matches.
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].geometry.item_count(), 1);
    }

    #[test]
    fn empty_configs_returns_nothing() {
        let bin = encode_tile(vec![make_layer("l", vec![point_feature(1, 1, vec![])])]);
        let groups = parse_mvt_tile(&bin, xyz(), Vec3::ZERO, &[]);
        assert!(groups.is_empty());
    }

    #[test]
    fn unflatten_vec3_round_trips_flatten_vec3() {
        let coords = vec![Vec3::new(1., 2., 3.), Vec3::new(4., 5., 6.)];
        assert_eq!(unflatten_vec3(&flatten_vec3(coords.clone())), coords);
    }

    /// A stream whose length isn't a multiple of 3 means the packed streams and
    /// meta got out of sync; fail fast in debug instead of silently dropping the
    /// remainder.
    #[test]
    #[should_panic(expected = "not a multiple of 3")]
    #[cfg(debug_assertions)]
    fn unflatten_vec3_rejects_truncated_stream() {
        unflatten_vec3(&[1., 2., 3., 4.]);
    }
}
