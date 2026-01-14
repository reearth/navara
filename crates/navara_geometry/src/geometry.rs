use navara_buffer_store::{BufferStore, Handle};
use navara_math::{FloatType, Vec3};
use serde::Serialize;

/// A struct to construct a geometry.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Geometry {
    /// Vector of vertex. The stride is 3.
    pub vertices: Vec<f32>,
    /// Vector of UV for a texture. The stride is 2.
    pub uvs: Vec<f32>,
    /// Vector of index that constructs a triangle.
    pub indices: Vec<u32>,
    /// Vector of skirt vertex. The stride is 3.
    /// These are separate from main vertices to allow different shadow/normal handling.
    pub skirt_vertices: Option<Vec<f32>>,
    /// Vector of skirt UV. The stride is 2.
    pub skirt_uvs: Option<Vec<f32>>,
    /// Vector of skirt index that constructs a triangle.
    pub skirt_indices: Option<Vec<u32>>,
    /// Mapping from skirt vertex index to edge vertex index in main geometry.
    /// This allows copying normals from edge vertices to skirt vertices.
    pub skirt_indices_to_edge: Option<Vec<u32>>,
}

#[derive(Clone, Debug, Serialize)]
/// You should use this struct if you want to store [`Geometry`] to Bevy component.
pub struct TransferableGeometry {
    pub vertices: Handle,
    pub uvs: Handle,
    pub indices: Handle,
    pub skirt_vertices: Option<Handle>,
    pub skirt_uvs: Option<Handle>,
    pub skirt_indices: Option<Handle>,
    pub skirt_indices_to_edge: Option<Handle>,
}

impl TransferableGeometry {
    pub fn with_buf(buf: &mut BufferStore, geo: Geometry) -> Self {
        Self {
            vertices: buf.new_f32(geo.vertices),
            uvs: buf.new_f32(geo.uvs),
            indices: buf.new_u32(geo.indices),
            skirt_vertices: geo.skirt_vertices.map(|v| buf.new_f32(v)),
            skirt_uvs: geo.skirt_uvs.map(|v| buf.new_f32(v)),
            skirt_indices: geo.skirt_indices.map(|v| buf.new_u32(v)),
            skirt_indices_to_edge: geo.skirt_indices_to_edge.map(|v| buf.new_u32(v)),
        }
    }

    pub fn remove_from_buf(&self, buf: &mut BufferStore) {
        buf.remove(&self.vertices);
        buf.remove(&self.uvs);
        buf.remove(&self.indices);
        let _ = self.skirt_vertices.map(|i| buf.remove(&i));
        let _ = self.skirt_uvs.map(|i| buf.remove(&i));
        let _ = self.skirt_indices.map(|i| buf.remove(&i));
        let _ = self.skirt_indices_to_edge.map(|i| buf.remove(&i));
    }
}

pub struct ReturnedConstructedTerrainMesh {
    pub geometry: Geometry,
    pub max_height: FloatType,
    pub min_height: FloatType,
    pub heights: Vec<f32>,
    pub rtc_translation: Option<Vec3>,
}
