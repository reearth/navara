#![doc = include_str!("../README.md")]

use bevy_app::{App, Plugin};
use bevy_ecs::prelude::Resource;
use serde::{Deserialize, Serialize};

/// Globe resource that manages shared properties across different material types.
///
/// This resource provides centralized configuration for VectorTile, RasterTile,
/// and RasterTerrain materials, replacing individual material properties with
/// a unified globe configuration.
#[derive(Debug, Clone, PartialEq, Resource, Serialize, Deserialize)]
pub struct Globe {
    /// Screen-space error threshold for level of detail (LOD) calculations.
    /// Used by VectorTileMaterial, RasterTileMaterial, and RasterTerrainMaterial.
    /// VectorTileMaterial can still override this individually if not using clamp_to_ground.
    pub max_sse: f32,

    /// Number of segments for mesh tessellation.
    /// Used by RasterTileMaterial.
    /// RasterTerrainMaterial maintains individual segment control.
    pub segments: usize,

    /// Base color for the globe surface (RGB as u32, e.g., 0xffffff for white).
    /// Used by VectorTileMaterial, RasterTileMaterial, and RasterTerrainMaterial.
    pub color: u32,

    /// Whether to hide underground geometry.
    /// Used by RasterTileMaterial and RasterTerrainMaterial.
    pub hide_underground: bool,

    /// Whether to compute normals from vertex positions instead of using no normal data.
    /// Used by RasterTileMaterial and RasterTerrainMaterial.
    pub should_compute_normal_from_vertex: bool,

    /// Whether materials should be transparent.
    /// Used by RasterTileMaterial and RasterTerrainMaterial.
    pub transparent: bool,

    /// Global opacity for materials (0.0 to 1.0).
    /// Used by RasterTileMaterial and RasterTerrainMaterial.
    /// Note: This is different from RasterTileMaterial's per-texture opacity used for blending.
    pub opacity: f32,

    /// Whether to render materials in wireframe mode.
    /// Used by RasterTileMaterial and RasterTerrainMaterial.
    pub wireframe: bool,
}

impl Default for Globe {
    fn default() -> Self {
        Self {
            max_sse: 2.0,
            segments: 10,
            color: 0xffffff,
            hide_underground: true,
            should_compute_normal_from_vertex: true,
            transparent: false,
            opacity: 1.0,
            wireframe: false,
        }
    }
}

/// Plugin that adds the Globe resource to the Bevy app.
pub struct GlobePlugin;

impl Plugin for GlobePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<Globe>();
    }
}
