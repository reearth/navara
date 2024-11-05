use navara_math::{FloatType, Vec3};

#[derive(Debug)]
pub struct Ray {
    pub origin: Vec3,
    pub direction: Vec3,
}

impl Ray {
    // Ref: https://github.com/CesiumGS/cesium/blob/0e9a425b475cd3cfdd90f35e9cdbdda453e448d8/packages/engine/Source/Core/Ray.js#L67
    pub fn get_point(&self, t: FloatType) -> Vec3 {
        self.origin + self.direction * t
    }
}
