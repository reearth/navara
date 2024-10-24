use bevy_ecs::component::Component;
use navara_core::CRS;

use navara_material::Appearance;

use crate::LayerData;

#[derive(Debug, Clone, PartialEq, Component)]
pub struct MvtLayer {
    pub layer_id: String,
    pub data: Option<LayerData>,
    pub appearances: Vec<Appearance>,
    pub crs: Option<CRS>,
}
