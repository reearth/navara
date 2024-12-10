use bevy_ecs::component::Component;
use navara_core::ElevationDecoder;
use navara_math::{FloatType, Vec2};

#[derive(Debug, Clone, PartialEq)]
pub enum Appearance {
    Point(PointMaterial),
    Billboard(BillboardMaterial),
    Polyline(PolylineMaterial),
    Polygon(PolygonMaterial),
    Model(ModelMaterial),
    VectorTile(VectorTileMaterial),
}

impl Appearance {
    pub fn set(&mut self, appearance: &Appearance) {
        match (self, appearance) {
            (Appearance::Point(dist), Appearance::Point(src)) => {
                *dist = src.clone();
            }
            (Appearance::Polyline(dist), Appearance::Polyline(src)) => {
                *dist = src.clone();
            }
            (Appearance::Polygon(dist), Appearance::Polygon(src)) => {
                *dist = src.clone();
            }
            (Appearance::Model(dist), Appearance::Model(src)) => {
                *dist = src.clone();
            }
            (Appearance::VectorTile(dist), Appearance::VectorTile(src)) => {
                *dist = src.clone();
            }
            _ => {}
        }
    }
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PointMaterial {
    pub show: bool,
    pub size: FloatType,
    pub color: u32,
    pub center: Vec2,
    pub height: FloatType,
    /// near, far
    pub scale_by_distance: Option<bool>,
    pub clamp_to_ground: bool,
    pub depth_test: bool,
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct BillboardMaterial {
    pub show: bool,
    pub size: FloatType,
    pub color: u32,
    pub center: Vec2,
    pub height: FloatType,
    pub url: String,
    /// near, far
    pub scale_by_distance: Option<bool>,
    pub clamp_to_ground: bool,
    pub depth_test: bool,
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PolylineMaterial {
    pub show: bool,
    pub color: u32,
    pub width: f32,
    pub clamp_to_ground: bool,
    pub height: f32,
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PolygonMaterial {
    pub show: bool,
    pub color: u32,
    pub clamp_to_ground: bool,
    pub height: f32,
    pub extruded_height: Option<f32>,
    pub wireframe: bool,
    pub internal: Option<PolygonInternalMaterial>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PolygonInternalMaterial {
    pub min_max_heights: Vec<f32>,
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct ModelMaterial {
    pub show: bool,
    pub url: String,
    pub size: FloatType,
    pub height: FloatType,
    pub clamp_to_ground: bool,
    pub should_rotate_in_default: bool,
    pub max_sse: f32,
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct VectorTileMaterial {
    pub show: bool,
    pub max_sse: f32,
    pub max_zoom: usize,
}

impl Default for VectorTileMaterial {
    fn default() -> Self {
        Self {
            show: true,
            max_sse: 2.,
            max_zoom: 20,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Component, Default)]
pub struct RasterTileMaterial {
    pub show: bool,
    pub segments: usize,
    pub color: u32,
    pub max_sse: f32,
    pub max_zoom: usize,
    pub wireframe: bool,
}

#[derive(Debug, Clone, PartialEq, Component, Default)]
pub struct RasterTerrainMaterial {
    pub show: bool,
    pub segments: usize,
    pub max_zoom: usize,
    pub min_zoom: usize,
    pub wireframe: bool,
    pub elevation_decoder: ElevationDecoder,
    pub tile_size: u32,
}
