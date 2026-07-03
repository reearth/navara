use bevy_ecs::component::Component;
use navara_material::{Appearance, ElevationHeatmapConfig, HillshadeConfig, RasterMaterial};

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub struct TilesLayer {
    pub layer_id: String,
    /// Id of the referenced `Source`. The loaders resolve the tile URL live
    /// from `SourceStore` by this id.
    pub source_id: Option<String>,
    pub appearance: Option<Appearance>,
    pub elevation_heatmap_config: Option<ElevationHeatmapConfig>,
    pub hillshade_config: Option<HillshadeConfig>,
}

impl TilesLayer {
    pub fn appearance(&self) -> Option<&RasterMaterial> {
        self.appearance.as_ref().and_then(|a| match a {
            Appearance::TerrainTile(v) => Some(v),
            _ => None,
        })
    }
}

#[derive(Debug, Component)]
pub struct UpdateRasterTileLayerMarker {
    pub layer_id: String,
    pub appearance: Appearance,
    pub elevation_heatmap_config: Option<ElevationHeatmapConfig>,
    pub hillshade_config: Option<HillshadeConfig>,
}

#[derive(Debug, Component)]
pub struct DeleteRasterTileLayerMarker(pub String);
