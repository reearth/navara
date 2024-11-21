use geo_types::Coord;
use navara_math::{FloatType, Vec3};
use regex::Regex;
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
    pub fn new(url: &str, extent: u32) -> Self {
        let mut converter = Self {
            x0: 0.0,
            y0: 0.0,
            size: 0.0,
            scale_x: 0.0,
            scale_y: 0.0,
        };

        if let Some((x, y, z)) = converter.get_tile_pos_from_url(url) {
            converter.x0 = (extent as f64) * (x as f64);
            converter.y0 = (extent as f64) * (y as f64);
            converter.size = (extent as f64) * (2_u64.pow(z) as f64);
            converter.scale_x = 360.0 / converter.size;
            converter.scale_y = 2.0 / converter.size;
        }

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

    // Ref: https://github.com/mapbox/vector-tile-spec/tree/master/2.1#3-projection-and-bounds
    // The function get_tile_pos_from_url is designed to parse the values of x, y, and z
    // from the end of a URL in the format .../z/x/y.mvt
    fn get_tile_pos_from_url(&self, url: &str) -> Option<(u32, u32, u32)> {
        // Define a regular expression to match the three numbers in the URL
        let re = Regex::new(r"/(\d+)/(\d+)/(\d+)\.mvt$").unwrap();

        if let Some(captures) = re.captures(url) {
            // Parse and assign the three values to z, x, and y respectively
            let z: u32 = captures[1].parse().ok()?;
            let x: u32 = captures[2].parse().ok()?;
            let y: u32 = captures[3].parse().ok()?;

            // Return (x, y, z)
            Some((x, y, z))
        } else {
            None
        }
    }
}
