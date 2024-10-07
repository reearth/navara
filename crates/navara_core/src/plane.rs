use navara_math::{Dir3, FloatType, Vec3};

#[derive(Clone, Copy, PartialEq, Debug)]
pub struct Plane {
    pub normal: Dir3,
    pub distance: FloatType,
}

impl Plane {
    pub fn from_point_normal(point: Vec3, normal: Vec3) -> Self {
        Self {
            normal: Dir3::new_unchecked(normal.into()),
            distance: normal.dot(point),
        }
    }

    pub fn get_distance_to_point(&self, point: Vec3) -> FloatType {
        self.normal.dot(point.into()) - self.distance
    }
}

impl Default for Plane {
    fn default() -> Self {
        Self {
            normal: Dir3::new_unchecked(Vec3::ONE.normalize().into()),
            distance: 0.,
        }
    }
}
