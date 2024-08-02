use bevy_math::{Dir3, Vec3};

#[derive(Clone, Copy, PartialEq, Debug)]
pub struct Plane {
    pub normal: Dir3,
    pub distance: f32,
}

impl Plane {
    pub fn from_point_normal(point: Vec3, normal: Vec3) -> Self {
        Self {
            normal: Dir3::new_unchecked(normal),
            distance: normal.dot(point),
        }
    }

    pub fn get_distance_to_point(&self, point: Vec3) -> f32 {
        self.normal.dot(point) - self.distance
    }
}

impl Default for Plane {
    fn default() -> Self {
        Self {
            normal: Dir3::new_unchecked(Vec3::ONE.normalize()),
            distance: 0.,
        }
    }
}
