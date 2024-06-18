use bevy_math::Vec3;

#[derive(Default, Clone, Copy, PartialEq, Debug)]
pub struct Plane {
    pub normal: Vec3,
    pub distance: f32,
}

impl Plane {
    pub fn from_point_normal(point: Vec3, normal: Vec3) -> Self {
        Self {
            normal,
            distance: normal.dot(point),
        }
    }

    pub fn get_distance_to_point(&self, point: Vec3) -> f32 {
        self.normal.dot(point) - self.distance
    }
}
