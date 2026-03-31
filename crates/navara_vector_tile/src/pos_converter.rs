use geo_types::Coord;
use navara_core::TileXYZ;
use navara_math::FloatType;
use std::f64::consts::PI;

/// Trait for types that can provide x, y, z coordinates.
pub trait AsXYZ {
    fn x(&self) -> f64;
    fn y(&self) -> f64;
    fn z(&self) -> f64;
}

impl AsXYZ for [f64; 2] {
    fn x(&self) -> f64 {
        self[0]
    }
    fn y(&self) -> f64 {
        self[1]
    }
    fn z(&self) -> f64 {
        0.0
    }
}

impl AsXYZ for [f64; 3] {
    fn x(&self) -> f64 {
        self[0]
    }
    fn y(&self) -> f64 {
        self[1]
    }
    fn z(&self) -> f64 {
        self[2]
    }
}

impl AsXYZ for Coord<f64> {
    fn x(&self) -> f64 {
        self.x
    }
    fn y(&self) -> f64 {
        self.y
    }
    fn z(&self) -> f64 {
        0.0
    }
}

#[derive(Debug)]
pub struct PosConverter {
    x0: f64,
    y0: f64,
    size: f64,
    scale_x: f64,
    scale_y: f64,
    extent: f32,
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
            extent: extent as f32,
        };

        converter.x0 = (extent as f64) * (xyz.x as f64);
        converter.y0 = (extent as f64) * (xyz.y as f64);
        converter.size = (extent as f64) * (2_u64.pow(xyz.z as u32) as f64);
        converter.scale_x = 360.0 / converter.size;
        converter.scale_y = 2.0 / converter.size;

        converter
    }

    /// Project a single point from tile coordinates (f64) to geographic coordinates.
    pub fn project_point(&self, px: f64, py: f64) -> (FloatType, FloatType) {
        let x = (px + self.x0) * self.scale_x - 180.0;
        let exp_value = f64::exp((1.0 - (py + self.y0) * self.scale_y) * PI);
        let y = 360.0 / PI * (f64::atan(exp_value)) - 90.0;

        (x as FloatType, y as FloatType)
    }

    /// Project a slice of coordinates to geographic coordinates.
    pub fn project_points<P: AsXYZ>(&self, points: &[P]) -> Vec<FloatType> {
        let mut ret = Vec::with_capacity(points.len() * 3);

        for pt in points {
            let (x, y) = self.project_point(pt.x(), pt.y());
            ret.push(x);
            ret.push(y);
            ret.push(pt.z());
        }

        ret
    }

    /// Project a single point from tile coordinates to center-based coordinates.
    pub fn project_point_on_center(&self, px: f64, py: f64) -> (FloatType, FloatType) {
        let half_extent = self.extent as f64 / 2.0;
        let x = (px - half_extent) / half_extent;
        let y = -(py - half_extent) / half_extent;
        (x, y)
    }

    /// Construct points based on the extent center.
    pub fn project_points_on_center<P: AsXYZ>(&self, points: &[P]) -> Vec<FloatType> {
        let half_extent = self.extent as f64 / 2.0;
        let mut ret = Vec::with_capacity(points.len() * 3);

        for pt in points {
            let x = (pt.x() - half_extent) / half_extent;
            let y = -(pt.y() - half_extent) / half_extent;

            ret.push(x);
            ret.push(y);
            ret.push(pt.z());
        }

        ret
    }
}
