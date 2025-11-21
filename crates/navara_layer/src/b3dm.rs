use bevy_ecs::component::Component;
use navara_core::CRS;

use navara_material::{Appearance, LayerEffectConfig, ModelMaterial};

use crate::LayerData;

#[derive(Debug, Clone, PartialEq, Component)]
pub struct B3dmLayer {
    pub layer_id: String,
    pub data: Option<LayerData>,
    pub appearances: Vec<Appearance>,
    pub crs: Option<CRS>,
    pub effect_config: LayerEffectConfig,
}

#[derive(Debug, Component)]
pub struct UpdateB3dmLayerMarker {
    pub layer_id: String,
    pub material: ModelMaterial,
}

#[derive(Debug, Component)]
pub struct DeleteB3dmLayerMarker(pub String);
