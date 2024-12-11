use geo_types::Coord;
use navara_core::TileXYZ;
use navara_math::{FloatType, Vec3};
use std::f64::consts::PI;

#[derive(Debug)]
pub struct PosConverter {
    x0: f64,
    y0: f64,
    size: f64,
    scale_x: f64,
    scale_y: f64,
}

// The conversion method refers to:
// https://github.com/mapbox/vector-tile-js/blob/main/index.js#L135 (toGeoJSON(x, y, z) )
impl PosConverter {
    pub fn new(xyz: TileXYZ, extent: u32) -> Self {
        let mut converter = Self {
            x0: 0.0,
            y0: 0.0,
            size: 0.0,
            scale_x: 0.0,
            scale_y: 0.0,
        };

        converter.x0 = (extent as f64) * (xyz.x as f64);
        converter.y0 = (extent as f64) * (xyz.y as f64);
        converter.size = (extent as f64) * (2_u64.pow(xyz.z as u32) as f64);
        converter.scale_x = 360.0 / converter.size;
        converter.scale_y = 2.0 / converter.size;

        converter
    }

    pub fn project_point(&mut self, pt: &Coord<f32>) -> (FloatType, FloatType) {
        let x = (pt.x as f64 + self.x0) * self.scale_x - 180.0;
        let exp_value = f64::exp((1.0 - (pt.y as f64 + self.y0) * self.scale_y) * PI);
        let y = 360.0 / PI * (f64::atan(exp_value)) - 90.0;

        (x as FloatType, y as FloatType)
    }

    pub fn project_points(&mut self, points: &Vec<Coord<f32>>) -> Vec<Vec3> {
        let mut ret = Vec::new();

        for pt in points {
            let (x, y) = self.project_point(pt);
            ret.push(Vec3::new(x, y, 0.0 as FloatType));
        }

        ret
    }
}
