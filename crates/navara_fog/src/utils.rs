use navara_math::FloatType;

// Ref: https://github.com/CesiumGS/cesium/blob/82e59ed00973bd3866d9d175914f7e38dee927dd/packages/engine/Source/Core/Math.js#L1055
pub fn fog(distance_to_camera: FloatType, density: FloatType) -> FloatType {
    let scalar = distance_to_camera * density;
    1.0 - (-(scalar * scalar)).exp()
}
