use crate::LayerData;
use bevy_ecs::component::Component;
use navara_material::{Appearance, RasterTileMaterial};

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub struct TilesLayer {
    pub layer_id: String,
    pub data: Option<LayerData>,
    pub appearance: Option<Appearance>,
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
}

#[derive(Debug, Component)]
pub struct UpdateRasterTileLayerMarker {
    pub layer_id: String,
    pub appearance: Appearance,
}

#[derive(Debug, Component)]
pub struct DeleteRasterTileLayerMarker(pub String);
