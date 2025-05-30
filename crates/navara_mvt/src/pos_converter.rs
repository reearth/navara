use geo_types::Coord;
use navara_core::TileXYZ;
use navara_math::FloatType;
use navara_parser::mvt::{geometry::CoordinateTransform, tile::GeomType};
use std::f64::consts::PI;

#[derive(Debug, Clone, Copy)]
pub struct PosConverter {
    x0: f64,
    y0: f64,
    size: f64,
    scale_x: f64,
    scale_y: f64,
    extent: f32,
    flat: bool,
}

// The conversion method refers to:
// https://github.com/mapbox/vector-tile-js/blob/main/index.js#L135 (toGeoJSON(x, y, z) )
impl PosConverter {
    pub fn new(xyz: TileXYZ, extent: u32, flat: bool) -> Self {
        let mut converter = Self {
            x0: 0.0,
            y0: 0.0,
            size: 0.0,
            scale_x: 0.0,
            scale_y: 0.0,
            extent: extent as f32,
            flat,
        };

        converter.x0 = (extent as f64) * (xyz.x as f64);
        converter.y0 = (extent as f64) * (xyz.y as f64);
        converter.size = (extent as f64) * (2_u64.pow(xyz.z as u32) as f64);
        converter.scale_x = 360.0 / converter.size;
        converter.scale_y = 2.0 / converter.size;

        converter
    }

    pub fn project_point(&self, pt: &Coord<f32>) -> (FloatType, FloatType) {
        let x = (pt.x as f64 + self.x0) * self.scale_x - 180.0;
        let exp_value = f64::exp((1.0 - (pt.y as f64 + self.y0) * self.scale_y) * PI);
        let y = 360.0 / PI * (f64::atan(exp_value)) - 90.0;

        (x as FloatType, y as FloatType)
    }

    /// Construct a point based on the extent center.
    pub fn project_point_on_center(&self, pt: &Coord<f32>) -> (FloatType, FloatType) {
        let half_extent = self.extent / 2.0;
        let x = (pt.x - half_extent) / half_extent; // Xを [-1, 1] にスケーリング
        let y = -(pt.y - half_extent) / half_extent; // Yを [-1, 1] にスケーリングしつつ反転

        (x as FloatType, y as FloatType)
    }
}

impl CoordinateTransform for PosConverter {
    type Output = (f32, f32, f32);

    #[inline]
    fn transform(&self, x: f32, y: f32, geom_type: &GeomType) -> Self::Output {
        let flat_geom_type = matches!(geom_type, GeomType::Polygon);
        let (x, y) = if self.flat && flat_geom_type {
            self.project_point_on_center(&Coord { x, y })
        } else {
            self.project_point(&Coord { x, y })
        };

        (x, y, 0.)
    }
}
