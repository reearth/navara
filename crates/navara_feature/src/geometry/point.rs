use navara_buffer_store::BufferStore;
use navara_core::{CRS, EncodedVec3, WGS84_64};
use navara_feature_component::render::TransferablePointGeometry;
use navara_math::Vec3;
use navara_tile_component::{
    RasterTileQuadtree, TileTerrainDataRequesterQuery, compute_terrain_height_at_point,
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
    fn apply_to_rtc_replaces_buffer() {
        let mut store = BufferStore::default();
        let center = Vec3::new(100.0, 200.0, 300.0);
        let mut geom = TransferablePointGeometry::with_buf_rtc(
            &mut store,
            vec![1.0, 2.0, 3.0],
            vec![0],
            vec![1.0],
        );

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
        let mut geom = TransferablePointGeometry::with_buf_rte(
            &mut store,
            vec![1.0, 2.0, 3.0],
            vec![0.1, 0.2, 0.3],
            vec![0],
            vec![1.0],
        );

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
