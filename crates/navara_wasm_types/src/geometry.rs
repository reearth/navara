use js_sys::{Float32Array, Uint32Array};
use navara_math::FloatType;
use serde::Deserialize;
use wasm_bindgen::prelude::wasm_bindgen;

use crate::{copy_f32_array, copy_u32_array};

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Default, Deserialize)]
pub struct Geometry {
    /// Vector of vertex. The stride is 3.
    vertices: Vec<FloatType>,
    /// Vector of UV for a texture. The stride is 2.
    uvs: Vec<FloatType>,
    /// Vector of index that constracts a triangle.
    indices: Vec<u32>,
}

#[wasm_bindgen]
impl Geometry {
    #[wasm_bindgen(constructor)]
    pub fn new(vertices: Vec<FloatType>, indices: Vec<u32>, uvs: Vec<FloatType>) -> Self {
        Self {
            vertices,
            indices,
            uvs,
        }
    }

    #[wasm_bindgen(js_name = "transferVertices")]
    pub fn transfer_vertices(&self) -> Float32Array {
        copy_f32_array(&self.vertices)
    }

    #[wasm_bindgen(js_name = "transferUvs")]
    pub fn transfer_uvs(&self) -> Float32Array {
        copy_f32_array(&self.uvs)
    }

    #[wasm_bindgen(js_name = "transferIndices")]
    pub fn transfer_indices(&self) -> Uint32Array {
        copy_u32_array(&self.indices)
    }
}

impl From<navara_geometry::Geometry> for Geometry {
    fn from(d: navara_geometry::Geometry) -> Self {
        Self {
            vertices: d.vertices,
            uvs: d.uvs,
            indices: d.indices,
        }
    }
}

impl From<Geometry> for navara_geometry::Geometry {
    fn from(d: Geometry) -> Self {
        Self {
            vertices: d.vertices,
            uvs: d.uvs,
            indices: d.indices,
        }
    }
}

#[wasm_bindgen]
pub struct ReturnedConstructedTerrainMesh {
    geometry: Geometry,
    pub max_height: FloatType,
    pub min_height: FloatType,
    heights: Vec<FloatType>,
}

#[wasm_bindgen]
impl ReturnedConstructedTerrainMesh {
    #[wasm_bindgen(constructor)]
    pub fn new(
        geometry: Geometry,
        max_height: FloatType,
        min_height: FloatType,
        heights: Vec<FloatType>,
    ) -> Self {
        Self {
            geometry,
            max_height,
            min_height,
            heights,
        }
    }

    #[wasm_bindgen(js_name = "transferVertices")]
    pub fn transfer_vertices(&self) -> Float32Array {
        self.geometry.transfer_vertices()
    }

    #[wasm_bindgen(js_name = "transferUvs")]
    pub fn transfer_uvs(&self) -> Float32Array {
        self.geometry.transfer_uvs()
    }

    #[wasm_bindgen(js_name = "transferIndices")]
    pub fn transfer_indices(&self) -> Uint32Array {
        self.geometry.transfer_indices()
    }

    #[wasm_bindgen(js_name = "transferHeights")]
    pub fn transfer_heights(&self) -> Float32Array {
        copy_f32_array(&self.heights)
    }
}

impl From<navara_geometry::ReturnedConstructedTerrainMesh> for ReturnedConstructedTerrainMesh {
    fn from(d: navara_geometry::ReturnedConstructedTerrainMesh) -> Self {
        Self {
            geometry: d.geometry.into(),
            max_height: d.max_height,
            min_height: d.min_height,
            heights: d.heights,
        }
    }
}

impl From<ReturnedConstructedTerrainMesh> for navara_geometry::ReturnedConstructedTerrainMesh {
    fn from(d: ReturnedConstructedTerrainMesh) -> Self {
        Self {
            geometry: d.geometry.into(),
            max_height: d.max_height,
            min_height: d.min_height,
            heights: d.heights,
        }
    }
}

#[wasm_bindgen]
pub struct UpsamplableTerrainGeometry {
    uvs: Vec<FloatType>,
    heights: Vec<FloatType>,
    indices: Vec<u32>,
}

#[wasm_bindgen]
impl UpsamplableTerrainGeometry {
    #[wasm_bindgen(constructor)]
    pub fn new(uvs: Vec<FloatType>, indices: Vec<u32>, heights: Vec<FloatType>) -> Self {
        Self {
            uvs,
            indices,
            heights,
        }
    }
}

impl<'a> From<navara_geometry::UpsamplableTerrainGeometry<'a>> for UpsamplableTerrainGeometry {
    fn from(d: navara_geometry::UpsamplableTerrainGeometry<'a>) -> Self {
        Self {
            uvs: d.uvs.to_vec(),
            heights: d.heights.to_vec(),
            indices: d.indices.to_vec(),
        }
    }
}

impl<'a> From<&'a UpsamplableTerrainGeometry> for navara_geometry::UpsamplableTerrainGeometry<'a> {
    fn from(d: &'a UpsamplableTerrainGeometry) -> Self {
        Self {
            uvs: &d.uvs,
            heights: &d.heights,
            indices: &d.indices,
        }
    }
}
