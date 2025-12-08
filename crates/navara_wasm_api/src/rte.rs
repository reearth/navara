use navara_wasm_types::EncodedVec3;
use wasm_bindgen::prelude::*;

/// Encode a camera position into RTE high/low components
///
/// Takes camera position in f64 ECEF coordinates and returns
/// an EncodedCamera with separate high and low f32 components
/// for each axis, enabling GPU RTE rendering.
///
/// # Arguments
/// * `x` - Camera X position in ECEF coordinates (meters)
/// * `y` - Camera Y position in ECEF coordinates (meters)
/// * `z` - Camera Z position in ECEF coordinates (meters)
///
/// # Example
/// ```ignore
/// // In JavaScript/TypeScript:
/// const camera = encodeCamera(6371000.0, 0.0, 0.0);
/// // Use camera.high_x, camera.low_x, etc. in shaders
/// ```
#[wasm_bindgen(js_name = encodePosition)]
pub fn encode_position(x: f64, y: f64, z: f64) -> EncodedVec3 {
    let encoded = navara_core::EncodedVec3::encode_xyz(x, y, z);

    encoded.into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_position() {
        let camera = encode_position(6371000.0, 0.0, 0.0);

        // Verify the encoding preserves the value
        let reconstructed_x = camera.high.x as f64 + camera.low.x as f64;
        assert!((reconstructed_x - 6371000.0).abs() < 1.0);
    }

    #[test]
    fn test_encode_position_all_axes() {
        let camera = encode_position(6371000.0, 6371000.0, 6371000.0);

        // Verify all axes are encoded
        let reconstructed_x = camera.high.x as f64 + camera.low.x as f64;
        let reconstructed_y = camera.high.y as f64 + camera.low.y as f64;
        let reconstructed_z = camera.high.z as f64 + camera.low.z as f64;

        assert!((reconstructed_x - 6371000.0).abs() < 1.0);
        assert!((reconstructed_y - 6371000.0).abs() < 1.0);
        assert!((reconstructed_z - 6371000.0).abs() < 1.0);
    }
}
