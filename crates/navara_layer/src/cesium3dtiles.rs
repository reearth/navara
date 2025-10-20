use bevy_ecs::component::Component;
use navara_core::CRS;
use navara_material::{Appearance, ModelMaterial};

use crate::LayerData;

#[derive(Debug, Clone, PartialEq, Component)]
pub struct Cesium3dTilesLayer {
    pub layer_id: String,
    pub data: Option<LayerData>,
    pub appearances: Vec<Appearance>,
    pub crs: Option<CRS>,
}

#[derive(Debug, Component)]
pub struct UpdateCesium3dTilesLayerMarker {
    pub layer_id: String,
    pub material: ModelMaterial,
}

#[derive(Debug, Component)]
pub struct DeleteCesium3dTilesLayerMarker(pub String);
