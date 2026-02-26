use navara_geometry::{OrthoCamTransform as GeometryOrthoCamTransform, ortho_camera_transform};
use navara_quadtree::decode_quadleaf_handle;
use navara_tile_component::TileHandle;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Debug, Clone, Copy)]
pub struct OrthoCamTransform {
    pub left: f32,
    pub right: f32,
    pub top: f32,
    pub bottom: f32,
}

#[wasm_bindgen]
impl OrthoCamTransform {
    #[wasm_bindgen(constructor)]
    pub fn new(left: f32, right: f32, top: f32, bottom: f32) -> Self {
        Self {
            left,
            right,
            top,
            bottom,
        }
    }
}

impl From<GeometryOrthoCamTransform> for OrthoCamTransform {
    fn from(transform: GeometryOrthoCamTransform) -> Self {
        Self {
            left: transform.left,
            right: transform.right,
            top: transform.top,
            bottom: transform.bottom,
        }
    }
}

impl From<OrthoCamTransform> for GeometryOrthoCamTransform {
    fn from(transform: OrthoCamTransform) -> Self {
        Self {
            left: transform.left,
            right: transform.right,
            top: transform.top,
            bottom: transform.bottom,
        }
    }
}

#[wasm_bindgen(js_name = "orthoCameraTransform")]
pub fn ortho_camera_transform_wasm(child: TileHandle, parent: TileHandle) -> OrthoCamTransform {
    let (x, y, z) = decode_quadleaf_handle::<usize>(child);
    let (_px, _py, pz) = decode_quadleaf_handle::<usize>(parent);
    let child = navara_core::TileXYZ { x, y, z };
    let transform = ortho_camera_transform(child, pz);
    transform.into()
}
