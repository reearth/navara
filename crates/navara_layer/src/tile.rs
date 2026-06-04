use crate::LayerData;
use bevy_ecs::component::Component;
use navara_material::{Appearance, ElevationHeatmapConfig, HillshadeConfig, RasterTileMaterial};

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub struct TilesLayer {
    pub layer_id: String,
    pub data: Option<LayerData>,
    pub appearance: Option<Appearance>,
    pub elevation_heatmap_config: Option<ElevationHeatmapConfig>,
    pub hillshade_config: Option<HillshadeConfig>,
}

impl TilesLayer {
    pub fn appearance(&self) -> Option<&RasterTileMaterial> {
        self.appearance.as_ref().and_then(|a| match a {
            Appearance::RasterTile(v) => Some(v),
            _ => None,
        })
    }
    pub fn is_over_max_zoom(&self, z: usize) -> bool {
        z >= self.appearance().unwrap().max_zoom
    }

    pub fn is_over_min_zoom(&self, z: usize) -> bool {
        z >= self.appearance().unwrap().min_zoom
    }

    pub fn is_over_overscaled_max_zoom(&self, z: usize) -> bool {
        z >= self.appearance().unwrap().overscaled_max_zoom
    }

    /// Check if this layer should use overscaled parent tiles.
    /// Returns true when z >= max_zoom and z < overscaled_max_zoom
    /// (max_zoom is an exclusive upper bound for new data requests).
    pub fn should_overscale(&self, z: usize) -> bool {
        self.is_over_max_zoom(z) && !self.is_over_overscaled_max_zoom(z)
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
