use navara_math::FloatType;

pub fn fog(distance_to_camera: FloatType, density: FloatType) -> FloatType {
    let scalar = distance_to_camera * density;
    1.0 - (-(scalar * scalar)).exp()
}
