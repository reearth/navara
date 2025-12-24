use crate::LayerData;
use bevy_ecs::component::Component;
use navara_material::{Appearance, ElevationHeatmapConfig, RasterTileMaterial};
use navara_parser::geojson::de;

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub struct TilesLayer {
    pub layer_id: String,
    pub data: Option<LayerData>,
    pub appearance: Option<Appearance>,
    pub elevation_heatmap_config: Option<ElevationHeatmapConfig>,
}

impl TilesLayer {
    pub fn appearance(&self) -> Option<&RasterTileMaterial> {
        self.appearance.as_ref().and_then(|a| match a {
            Appearance::RasterTile(v) => Some(v),
            _ => None,
        })
    }
    pub fn is_over_max_zoom(&self, z: usize) -> bool {
        let default = RasterTileMaterial::default();
        z >= self.appearance().unwrap().max_zoom.or(default.max_zoom).unwrap_or(usize::MAX)
    }

    pub fn is_over_min_zoom(&self, z: usize) -> bool {
        let default = RasterTileMaterial::default();
        z >= self.appearance().unwrap().min_zoom.or(default.min_zoom).unwrap_or(0)
    }

    pub fn merge(&self, other: &TilesLayer) -> TilesLayer {
        TilesLayer {
            layer_id: self.layer_id.clone(),
            data: other.data.clone().or_else(|| self.data.clone()),
            appearance: other.appearance.as_ref().and_then(|other_appearance| {
                self.appearance.as_ref().map(|self_appearance| other_appearance.merge(self_appearance))
            }),
            elevation_heatmap_config: other
                .elevation_heatmap_config
                .clone()
                .or_else(|| self.elevation_heatmap_config.clone()),
        }
    }
}

#[derive(Debug, Component)]
pub struct UpdateRasterTileLayerMarker {
    pub layer_id: String,
    pub appearance: Appearance,
    pub elevation_heatmap_config: Option<ElevationHeatmapConfig>,
}

#[derive(Debug, Component)]
pub struct DeleteRasterTileLayerMarker(pub String);
