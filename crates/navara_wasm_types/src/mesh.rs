use navara_buffer_store::Handle;
use serde::Deserialize;
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Default, Copy, Deserialize)]
pub struct CachedMeshHandle {
    pub vertices: Handle,
    pub indices: Handle,
    pub uvs: Handle,
    pub heights: Option<Handle>,
}

#[wasm_bindgen]
impl CachedMeshHandle {
    #[wasm_bindgen(constructor)]
    pub fn new(vertices: Handle, indices: Handle, uvs: Handle, heights: Option<Handle>) -> Self {
        Self {
            vertices,
            indices,
            uvs,
            heights,
        }
    }
}

impl From<navara_mesh::CachedMeshHandle> for CachedMeshHandle {
    fn from(d: navara_mesh::CachedMeshHandle) -> Self {
        Self {
            vertices: d.vertices,
            uvs: d.uvs,
            indices: d.indices,
            heights: d.heights,
        }
    }
}

impl From<CachedMeshHandle> for navara_mesh::CachedMeshHandle {
    fn from(d: CachedMeshHandle) -> Self {
        Self {
            vertices: d.vertices,
            uvs: d.uvs,
            indices: d.indices,
            heights: d.heights,
        }
    }
}
