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

impl Cesium3dTilesLayer {
    pub fn merge(&self, other: &Cesium3dTilesLayer) -> Cesium3dTilesLayer {
        Cesium3dTilesLayer {
            layer_id: self.layer_id.clone(),
            data: other.data.clone().or_else(|| self.data.clone()),
            appearances: self.appearances.clone().into_iter().enumerate().map(|(i, self_appearance)| {
                other.appearances.get(i).map(|other_appearance| other_appearance.merge(&self_appearance)).unwrap_or(self_appearance)
            }).collect(),
            crs: other.crs.clone().or_else(|| self.crs.clone()),
        }
    }
}

#[derive(Debug, Component)]
pub struct UpdateCesium3dTilesLayerMarker {
    pub layer_id: String,
    pub material: ModelMaterial,
}

#[derive(Debug, Component)]
pub struct DeleteCesium3dTilesLayerMarker(pub String);
