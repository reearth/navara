use navara_core::{Extent, Radians};

#[derive(Debug, Clone, PartialEq)]
pub enum LayerDescription {
    Tiles {
        tile_url: String,
        terrain_url: Option<String>,
        z: usize,
        segments: usize,
        height: f32,
        extent: Option<Extent<f32, Radians>>,
        color: u32,
        max_sse: f32,
        max_z: usize,
        wireframe: bool,
    },
}
