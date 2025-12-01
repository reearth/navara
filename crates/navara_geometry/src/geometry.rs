use navara_buffer_store::{BufferStore, Handle};
use navara_math::{FloatType, Vec3};
use serde::Serialize;

/// A struct to construct a geometry.
#[derive(Debug, Clone, PartialEq)]
pub struct Geometry {
    /// Vector of vertex. The stride is 3.
    pub vertices: Vec<f32>,
    /// Vector of UV for a texture. The stride is 2.
    pub uvs: Vec<f32>,
    /// Vector of index that constracts a triangle.
    pub indices: Vec<u32>,
}

#[derive(Clone, Debug, Serialize)]
/// You should use this struct if you want to store [`Geometry`] to Bevy component.
pub struct TransferableGeometry {
    pub vertices: Handle,
    pub uvs: Handle,
    pub indices: Handle,
}

impl TransferableGeometry {
    pub fn with_buf(buf: &mut BufferStore, geo: Geometry) -> Self {
        Self {
            vertices: buf.new_f32(geo.vertices),
            uvs: buf.new_f32(geo.uvs),
            indices: buf.new_u32(geo.indices),
        }
    }
}

pub struct ReturnedConstructedTerrainMesh {
    pub geometry: Geometry,
    pub max_height: FloatType,
    pub min_height: FloatType,
    pub heights: Vec<f32>,
    pub rtc_translation: Option<Vec3>,
}
