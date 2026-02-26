use navara_buffer_store::BufferStore;
use navara_core::{Aabb, CRS, EncodedVec3, WGS84_64};
use navara_feature_component::render::TransferablePointGeometry;
use navara_math::{Transform, Vec3};
use navara_tile_component::{
    RasterTileQuadtree, TileExtent, TileTerrainDataRequesterQuery, compute_terrain_height_at_point,
};

/// Holds position data encoded as either RTC or RTE f32 values.
/// Positions are encoded on push, avoiding intermediate `Vec<Vec3>` allocations.
pub enum PositionBuffer {
    Rtc { coords: Vec<f32>, center: Vec3 },
    Rte { high: Vec<f32>, low: Vec<f32> },
}

impl PositionBuffer {
    /// Creates a new buffer. RTC when `rtc_center` is `Some`, RTE when `None`.
    pub fn new(rtc_center: Option<Vec3>, capacity: usize) -> Self {
        if let Some(center) = rtc_center {
            Self::Rtc {
                coords: Vec::with_capacity(capacity * 3),
                center,
            }
        } else {
            Self::Rte {
                high: Vec::with_capacity(capacity * 3),
                low: Vec::with_capacity(capacity * 3),
            }
        }
    }

    /// Consumes this buffer and creates a `TransferablePointGeometry`.
    pub fn transfer(
        self,
        buf: &mut BufferStore,
        batch_indices: Vec<u32>,
        batch_ids: Vec<f32>,
    ) -> TransferablePointGeometry {
        match self {
            Self::Rtc { coords, .. } => {
                TransferablePointGeometry::with_buf_rtc(buf, coords, batch_indices, batch_ids)
            }
            Self::Rte { high, low } => {
                TransferablePointGeometry::with_buf_rte(buf, high, low, batch_indices, batch_ids)
            }
        }
    }

    /// Replaces position buffers in the geometry with the encoded positions from this buffer.
    pub fn apply_to(self, buf: &mut BufferStore, geometry: &mut TransferablePointGeometry) {
        match self {
            Self::Rtc { coords, .. } => {
                if let Some(position) = &mut geometry.position {
                    buf.remove(&position.data);
                    position.data = buf.new_f32(coords);
                }
            }
            Self::Rte { high, low } => {
                if let (Some(high_attr), Some(low_attr)) = (
                    &mut geometry.position_3d_high,
                    &mut geometry.position_3d_low,
                ) {
                    buf.remove(&high_attr.data);
                    high_attr.data = buf.new_f32(high);
                    buf.remove(&low_attr.data);
                    low_attr.data = buf.new_f32(low);
                }
            }
        }
    }

    /// Converts coordinates from the given CRS to ECEF, applies height and terrain offset,
    /// then encodes and appends the resulting world position.
    pub fn push_from_crs(&mut self, coords: Vec3, crs: &CRS, height: f32, terrain_height: f64) {
        let world_pos = crs.to_vec3(WGS84_64, coords, height + terrain_height as f32);
        match self {
            Self::Rtc {
                coords: buf,
                center,
            } => {
                buf.push((world_pos.x - center.x) as f32);
                buf.push((world_pos.y - center.y) as f32);
                buf.push((world_pos.z - center.z) as f32);
            }
            Self::Rte { high, low } => {
                let encoded = EncodedVec3::encode(world_pos);
                high.push(encoded.high.x as f32);
                high.push(encoded.high.y as f32);
                high.push(encoded.high.z as f32);
                low.push(encoded.low.x as f32);
                low.push(encoded.low.y as f32);
                low.push(encoded.low.z as f32);
            }
        }
    }
}

/// Computes the AABB center from a tile extent for RTC positioning.
/// Returns `None` for the RTE path (when no tile extent exists).
pub fn compute_rtc_center(tile_extent: Option<&TileExtent>) -> Option<Vec3> {
    tile_extent.map(|extent_component| {
        let aabb = Aabb::from_extent_f64(extent_component.extent, 0., 1.);
        aabb.center
    })
}

/// Builds a transform for a point feature.
/// RTC: translation at center + uniform scale. RTE: identity translation + uniform scale.
pub fn build_transform(rtc_center: Option<Vec3>, size: f32) -> Transform {
    let scale = Vec3::new(size as f64, size as f64, size as f64);
    if let Some(center) = rtc_center {
        Transform::from_translation(center).with_scale(scale)
    } else {
        Transform::from_scale(scale)
    }
}

/// Returns terrain height for a point, or 0.0 if `clamp_to_ground` is false.
pub fn resolve_terrain_height(
    coords: Vec3,
    crs: &CRS,
    clamp_to_ground: bool,
    qt: &mut RasterTileQuadtree,
    buf: &mut BufferStore,
    terrain_data_requester: &TileTerrainDataRequesterQuery,
) -> f64 {
    if clamp_to_ground {
        compute_terrain_height_at_point(
            qt,
            buf,
            terrain_data_requester,
            &crs.to_lng_lat(WGS84_64, coords),
        )
        .unwrap_or(0.)
    } else {
        0.
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_abs_diff_eq;
    use navara_math::{EPSILON4, EPSILON12};

    #[test]
    fn compute_rtc_center_returns_none_without_tile_extent() {
        assert!(compute_rtc_center(None).is_none());
    }

    #[test]
    fn compute_rtc_center_returns_center_for_tile_extent() {
        use navara_core::{Angle, Extent, Radians};
        let extent = Extent {
            west: Angle::<f64, Radians>::new(0.0),
            east: Angle::<f64, Radians>::new(0.1),
            south: Angle::<f64, Radians>::new(0.0),
            north: Angle::<f64, Radians>::new(0.1),
        };
        let tile_extent = TileExtent::new(extent);
        let center = compute_rtc_center(Some(&tile_extent));
        assert!(center.is_some());
    }

    #[test]
    fn push_from_crs_rtc_encodes_relative() {
        let center = Vec3::new(1.0, 2.0, 3.0);
        let mut buf = PositionBuffer::new(Some(center), 1);
        // Geocentric CRS passes coords through as-is
        buf.push_from_crs(Vec3::new(10.0, 20.0, 30.0), &CRS::Geocentric, 0.0, 0.0);
        match buf {
            PositionBuffer::Rtc { coords, .. } => {
                assert_eq!(coords.len(), 3);
                assert_eq!(coords[0], 9.0);
                assert_eq!(coords[1], 18.0);
                assert_eq!(coords[2], 27.0);
            }
            _ => panic!("expected RTC"),
        }
    }

    #[test]
    fn push_from_crs_rte_encodes_high_low() {
        let mut buf = PositionBuffer::new(None, 1);
        let input = Vec3::new(1_000_000.5, 2_000_000.25, 3_000_000.75);
        buf.push_from_crs(input, &CRS::Geocentric, 0.0, 0.0);
        match buf {
            PositionBuffer::Rte { high, low } => {
                assert_eq!(high.len(), 3);
                assert_eq!(low.len(), 3);
                let reconstructed_x = high[0] as f64 + low[0] as f64;
                let reconstructed_y = high[1] as f64 + low[1] as f64;
                let reconstructed_z = high[2] as f64 + low[2] as f64;
                assert_abs_diff_eq!(reconstructed_x, input.x, epsilon = EPSILON12);
                assert_abs_diff_eq!(reconstructed_y, input.y, epsilon = EPSILON12);
                assert_abs_diff_eq!(reconstructed_z, input.z, epsilon = EPSILON12);
            }
            _ => panic!("expected RTE"),
        }
    }

    #[test]
    fn push_from_crs_applies_height_and_terrain() {
        let coords = Vec3::new(100.0, 200.0, 300.0);
        let crs = CRS::Geocentric;
        let height = 5.0_f32;
        let terrain_height = 10.0_f64;

        // Compute expected world position using the same CRS conversion
        let expected = crs.to_vec3(WGS84_64, coords, height + terrain_height as f32);

        let mut buf = PositionBuffer::new(Some(Vec3::ZERO), 1);
        buf.push_from_crs(coords, &crs, height, terrain_height);

        match buf {
            PositionBuffer::Rtc { coords: result, .. } => {
                assert_eq!(result.len(), 3);
                // f32 precision loss from the RTC encoding
                assert_abs_diff_eq!(result[0] as f64, expected.x, epsilon = EPSILON4);
                assert_abs_diff_eq!(result[1] as f64, expected.y, epsilon = EPSILON4);
                assert_abs_diff_eq!(result[2] as f64, expected.z, epsilon = EPSILON4);
            }
            _ => panic!("expected RTC"),
        }
    }

    #[test]
    fn build_transform_rtc_has_translation_and_scale() {
        let center = Vec3::new(100.0, 200.0, 300.0);
        let t = build_transform(Some(center), 5.0);
        assert_eq!(t.translation, center);
        assert_eq!(t.scale, Vec3::new(5.0, 5.0, 5.0));
    }

    #[test]
    fn build_transform_rte_has_zero_translation_and_scale() {
        let t = build_transform(None, 3.0);
        assert_eq!(t.translation, Vec3::ZERO);
        assert_eq!(t.scale, Vec3::new(3.0, 3.0, 3.0));
    }

    #[test]
    fn build_point_geometry_rtc_sets_position() {
        let mut store = BufferStore::default();
        let center = Vec3::new(100.0, 200.0, 300.0);
        let mut positions = PositionBuffer::new(Some(center), 1);
        positions.push_from_crs(Vec3::new(101.0, 202.0, 303.0), &CRS::Geocentric, 0.0, 0.0);
        let geom = positions.transfer(&mut store, vec![0], vec![1.0]);
        assert!(geom.position.is_some());
        assert!(geom.position_3d_high.is_none());
        assert!(geom.position_3d_low.is_none());
    }

    #[test]
    fn build_point_geometry_rte_sets_high_low() {
        let mut store = BufferStore::default();
        let mut positions = PositionBuffer::new(None, 1);
        positions.push_from_crs(
            Vec3::new(1_000_000.0, 2_000_000.0, 3_000_000.0),
            &CRS::Geocentric,
            0.0,
            0.0,
        );
        let geom = positions.transfer(&mut store, vec![0], vec![1.0]);
        assert!(geom.position.is_none());
        assert!(geom.position_3d_high.is_some());
        assert!(geom.position_3d_low.is_some());
    }

    #[test]
    fn apply_to_rtc_replaces_buffer() {
        let mut store = BufferStore::default();
        let center = Vec3::new(100.0, 200.0, 300.0);
        let mut initial = PositionBuffer::new(Some(center), 1);
        initial.push_from_crs(Vec3::new(101.0, 202.0, 303.0), &CRS::Geocentric, 0.0, 0.0);
        let mut geom = initial.transfer(&mut store, vec![0], vec![1.0]);

        let mut updated = PositionBuffer::new(Some(center), 1);
        updated.push_from_crs(Vec3::new(110.0, 220.0, 330.0), &CRS::Geocentric, 0.0, 0.0);
        updated.apply_to(&mut store, &mut geom);

        let handle = &geom.position.as_ref().unwrap().data;
        let data = store.get_f32(handle).unwrap();
        assert_eq!(data.len(), 3);
        assert_eq!(data[0], 10.0); // 110 - 100
        assert_eq!(data[1], 20.0); // 220 - 200
        assert_eq!(data[2], 30.0); // 330 - 300
    }

    #[test]
    fn apply_to_rte_replaces_buffer() {
        let mut store = BufferStore::default();
        let mut initial = PositionBuffer::new(None, 1);
        initial.push_from_crs(
            Vec3::new(1_000_000.0, 2_000_000.0, 3_000_000.0),
            &CRS::Geocentric,
            0.0,
            0.0,
        );
        let mut geom = initial.transfer(&mut store, vec![0], vec![1.0]);

        let mut updated = PositionBuffer::new(None, 1);
        updated.push_from_crs(
            Vec3::new(1_000_001.0, 2_000_001.0, 3_000_001.0),
            &CRS::Geocentric,
            0.0,
            0.0,
        );
        updated.apply_to(&mut store, &mut geom);

        let high_handle = &geom.position_3d_high.as_ref().unwrap().data;
        let high_data = store.get_f32(high_handle).unwrap();
        assert_eq!(high_data.len(), 3);
        let low_handle = &geom.position_3d_low.as_ref().unwrap().data;
        let low_data = store.get_f32(low_handle).unwrap();
        assert_eq!(low_data.len(), 3);
    }
}
