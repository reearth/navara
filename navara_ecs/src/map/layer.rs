#[derive(Debug, Clone, PartialEq)]
pub enum LayerDescription {
    Tiles {
        url: String,
        segments: usize,
        color: u32,
        max_sse: f32,
        max_z: usize,
        wireframe: bool,
    },
    Terrain {
        url: String,
        segments: usize,
        color: u32,
        max_sse: f32,
        max_z: usize,
        wireframe: bool,
    },
}
