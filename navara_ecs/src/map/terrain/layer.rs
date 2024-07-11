use bevy_ecs::component::Component;
use navara_core::terrain::ElevationDecoder;

use super::TerrainDataType;

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub struct TerrainLayer {
    pub url: String,
    pub segments: usize,
    pub color: u32,
    pub max_sse: f32,
    pub max_z: usize,
    pub wireframe: bool,
    pub elevation_decoder: ElevationDecoder,
    pub(crate) terrain_type: TerrainDataType,
}
