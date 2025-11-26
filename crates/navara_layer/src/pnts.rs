use bevy_ecs::component::Component;
use navara_core::CRS;

use navara_material::{Appearance, ModelMaterial};

use crate::LayerData;

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PntsLayer {
    pub layer_id: String,
    pub data: Option<LayerData>,
    pub appearances: Vec<Appearance>,
    pub crs: Option<CRS>,
}

#[derive(Debug, Component)]
pub struct UpdatePntsLayerMarker {
    pub layer_id: String,
    pub material: ModelMaterial,
}

#[derive(Debug, Component)]
pub struct DeletePntsLayerMarker(pub String);
