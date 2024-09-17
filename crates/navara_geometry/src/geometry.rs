use navara_math::FloatType;

/// A struct to construct a geometry.
#[derive(Debug, Clone, PartialEq)]
pub struct Geometry {
    /// Vector of vertex. The stride is 3.
    pub vertices: Vec<FloatType>,
    /// Vector of UV for a texture. The stride is 2.
    pub uvs: Vec<FloatType>,
    /// Vector of index that constracts a triangle.
    pub indices: Vec<u32>,
}
