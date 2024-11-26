use navara_math::FloatType;
use serde::Deserialize;
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Default, Deserialize)]
pub struct Geometry {
    /// Vector of vertex. The stride is 3.
    #[wasm_bindgen(getter_with_clone)]
    pub vertices: Vec<FloatType>,
    /// Vector of UV for a texture. The stride is 2.
    #[wasm_bindgen(getter_with_clone)]
    pub uvs: Vec<FloatType>,
    /// Vector of index that constracts a triangle.
    #[wasm_bindgen(getter_with_clone)]
    pub indices: Vec<u32>,
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
    #[wasm_bindgen(getter_with_clone)]
    pub geometry: Geometry,
    pub max_height: FloatType,
    pub min_height: FloatType,
    #[wasm_bindgen(getter_with_clone)]
    pub heights: Vec<FloatType>,
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
    #[wasm_bindgen(getter_with_clone)]
    pub uvs: Vec<FloatType>,
    #[wasm_bindgen(getter_with_clone)]
    pub heights: Vec<FloatType>,
    #[wasm_bindgen(getter_with_clone)]
    pub indices: Vec<u32>,
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
