use navara_math::Vec3;

/// Encodes a 64-bit floating-point value into high and low 32-bit components
/// Ref: https://help.agi.com/AGIComponents/html/BlogPrecisionsPrecisions.htm
///
/// This enables GPU RTE rendering by preserving precision when positions
/// are transformed to be relative to the camera.
#[derive(Debug, Clone, Copy)]
pub struct EncodedFloat {
    pub high: f32,
    pub low: f32,
}

impl EncodedFloat {
    /// Encode a single f64 value into high/low f32 components
    ///
    /// Algorithm:
    /// - For positive values: high = floor(value / 65536) * 65536
    /// - For negative values: high = -floor(-value / 65536) * 65536
    /// - low = value - high
    ///
    /// # Examples
    /// ```
    /// use navara_core::EncodedFloat;
    ///
    /// let encoded = EncodedFloat::encode(6371000.123456);
    /// assert!((encoded.high as f64 + encoded.low as f64 - 6371000.123456).abs() < 0.0001);
    /// ```
    pub fn encode(value: f64) -> Self {
        let double_high = if value >= 0.0 {
            (value / 65536.0).floor() * 65536.0
        } else {
            -((-value / 65536.0).floor() * 65536.0)
        };

        Self {
            high: double_high as f32,
            low: (value - double_high) as f32,
        }
    }

    /// Reconstruct the original value (for testing/validation)
    ///
    /// # Examples
    /// ```
    /// use navara_core::EncodedFloat;
    ///
    /// let encoded = EncodedFloat::encode(6371000.123456);
    /// let decoded = encoded.decode();
    /// assert!((decoded - 6371000.123456).abs() < 0.001);
    /// ```
    pub fn decode(&self) -> f64 {
        self.high as f64 + self.low as f64
    }
}

/// Encodes a Vec3 position into high and low components
#[derive(Debug, Clone, Copy)]
pub struct EncodedVec3 {
    pub high: Vec3,
    pub low: Vec3,
}

impl EncodedVec3 {
    /// Encode a Vec3 position (f64 components) into high/low Vec3 (f32 components)
    ///
    /// # Examples
    /// ```
    /// use navara_core::EncodedVec3;
    /// use navara_math::Vec3;
    ///
    /// let pos = Vec3::new(6371000.0, 6371000.0, 6371000.0);
    /// let encoded = EncodedVec3::encode(pos);
    /// ```
    pub fn encode(position: Vec3) -> Self {
        let x = EncodedFloat::encode(position.x as f64);
        let y = EncodedFloat::encode(position.y as f64);
        let z = EncodedFloat::encode(position.z as f64);

        Self {
            high: Vec3::new(x.high, y.high, z.high),
            low: Vec3::new(x.low, y.low, z.low),
        }
    }

    /// Encode from separate x, y, z values
    ///
    /// # Examples
    /// ```
    /// use navara_core::EncodedVec3;
    ///
    /// let encoded = EncodedVec3::encode_xyz(6371000.0, 6371000.0, 6371000.0);
    /// ```
    pub fn encode_xyz(x: f64, y: f64, z: f64) -> Self {
        let x_enc = EncodedFloat::encode(x);
        let y_enc = EncodedFloat::encode(y);
        let z_enc = EncodedFloat::encode(z);

        Self {
            high: Vec3::new(x_enc.high, y_enc.high, z_enc.high),
            low: Vec3::new(x_enc.low, y_enc.low, z_enc.low),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_positive() {
        let value = 6371000.123456;
        let encoded = EncodedFloat::encode(value);
        let decoded = encoded.decode();
        assert!((decoded - value).abs() < 0.001);
    }

    #[test]
    fn test_encode_negative() {
        let value = -6371000.123456;
        let encoded = EncodedFloat::encode(value);
        let decoded = encoded.decode();
        assert!((decoded - value).abs() < 0.001);
    }

    #[test]
    fn test_encode_zero() {
        let encoded = EncodedFloat::encode(0.0);
        assert_eq!(encoded.high, 0.0);
        assert_eq!(encoded.low, 0.0);
    }

    #[test]
    fn test_encode_vec3() {
        let pos = Vec3::new(6371000.0, 6371000.0, 6371000.0);
        let encoded = EncodedVec3::encode(pos);

        // Verify encoding preserves value
        let decoded_x = encoded.high.x as f64 + encoded.low.x as f64;
        assert!((decoded_x - pos.x as f64).abs() < 0.001);
    }

    #[test]
    fn test_encode_earth_radius() {
        let earth_radius = 6371000.0;
        let encoded = EncodedFloat::encode(earth_radius);
        let decoded = encoded.decode();
        // Should preserve ~6 decimal places
        assert!((decoded - earth_radius).abs() < 1.0);
    }

    #[test]
    fn test_encode_large_coordinates() {
        let pos = Vec3::new(6371000.0, 6371000.0, 6371000.0);
        let encoded = EncodedVec3::encode(pos);

        // Verify high/low split
        assert!(encoded.high.x.abs() > 6000000.0);
        assert!(encoded.low.x.abs() < 100000.0);
    }

    #[test]
    fn test_encode_preserves_sign() {
        let values = vec![1000.0, -1000.0, 0.0, -6371000.0];
        for val in values {
            let encoded = EncodedFloat::encode(val);
            let decoded = encoded.decode();
            assert_eq!(val.signum(), decoded.signum());
        }
    }
}
