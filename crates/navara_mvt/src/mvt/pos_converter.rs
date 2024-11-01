use geo_types::Coord;
use navara_math::{std_float::consts::PI, FloatType, Vec3};
use regex::Regex;

#[derive(Debug)]
pub struct PosConverter {
    x0: f32,
    y0: f32,
    size: f32,
    scale_x: f32,
    scale_y: f32,
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
            converter.x0 = (extent as f32) * (x as f32);
            converter.y0 = (extent as f32) * (y as f32);
            converter.size = (extent as f32) * (2_u64.pow(z) as f32);
            converter.scale_x = 360.0 / converter.size;
            converter.scale_y = 2.0 / converter.size;
        }

        converter
    }

    pub fn project_point(&mut self, pt: &Coord<f32>) -> (f32, f32) {
        let x = (pt.x + self.x0) * self.scale_x - 180.0;
        let exp_value = f32::exp((1.0 - (pt.y + self.y0) * self.scale_y) * PI);
        let y = 360.0 / PI * (f32::atan(exp_value)) - 90.0;

        (x, y)
    }

    pub fn project_points(&mut self, points: &Vec<Coord<f32>>) -> Vec<Vec3> {
        let mut ret = Vec::new();

        for pt in points {
            let (x, y) = self.project_point(pt);
            ret.push(Vec3::new(x as FloatType, y as FloatType, 0.0 as FloatType));
        }

        ret
    }

    pub fn get_size(&mut self) -> f32 {
        self.size
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
