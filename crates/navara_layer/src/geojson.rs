use bevy_ecs::component::Component;
use bevy_ecs::entity::Entity;
use navara_core::CRS;

use navara_material::Appearance;

#[derive(Debug, Clone, PartialEq, Component)]
pub struct GeoJsonLayer {
    pub layer_id: String,
    /// The referenced GeoJSON source. The actual data (inline or fetched) lives
    /// on the source in `SourceStore` and is read live by the loaders.
    pub source_id: Option<String>,
    pub appearances: Vec<Appearance>,
    pub crs: Option<CRS>,
    /// Per-layer override for the horizon dynamic-SSE relaxation strength of
    /// the tiled render path (`0.0` off … `1.0` raster-equivalent). `None`
    /// falls back to a content-based default. Only applies to tiled GeoJSON
    /// (clamp-to-ground / `tiled` appearances), which shares the vector-tile
    /// traversal; non-tiled GeoJSON renders as batched features with no LOD.
    pub dynamic_sse_scale: Option<f32>,
}

#[derive(Debug, Component)]
pub struct UpdateGeoJsonLayerMarker {
    pub layer_id: String,
    pub appearance: Appearance,
}

#[derive(Debug, Component)]
pub struct DeleteGeoJsonLayerMarker(pub String);

#[derive(Debug, Component)]
pub struct GeoJsonLayerDataRequesterMarker(pub Entity);
