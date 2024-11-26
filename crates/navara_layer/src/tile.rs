use crate::LayerData;
use bevy_ecs::component::Component;
use navara_material::RasterTileMaterial;

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub struct TilesLayer {
    pub layer_id: String,
    pub data: Option<LayerData>,
    pub appearance: Option<RasterTileMaterial>,
}
