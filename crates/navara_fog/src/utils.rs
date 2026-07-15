use navara_math::FloatType;

// Ref: https://github.com/CesiumGS/cesium/blob/82e59ed00973bd3866d9d175914f7e38dee927dd/packages/engine/Source/Core/Math.js#L1055
pub fn fog(distance_to_camera: FloatType, density: FloatType) -> FloatType {
    let scalar = distance_to_camera * density;
    1.0 - (-(scalar * scalar)).exp()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The LOD fog SSE relaxation relies on these properties: no relaxation
    /// at the camera, monotonic growth with distance, saturating at 1, and a
    /// higher density pulling the ramp closer to the camera.
    #[test]
    fn fog_is_distance_weighted() {
        let density = 2.0e-4;
        assert_eq!(fog(0., density), 0.);
        assert!(fog(1_000., density) < fog(5_000., density));
        assert!(fog(5_000., density) < fog(50_000., density));
        assert!(fog(1_000_000., density) > 0.999);
        // Higher density → stronger relaxation at the same distance.
        assert!(fog(5_000., 4.0e-4) > fog(5_000., 2.0e-4));
    }
}
