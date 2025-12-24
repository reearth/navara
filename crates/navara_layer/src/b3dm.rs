use bevy_ecs::component::Component;
use navara_core::CRS;

use navara_material::{Appearance, ModelMaterial};

use crate::LayerData;

#[derive(Debug, Clone, PartialEq, Component)]
pub struct B3dmLayer {
    pub layer_id: String,
    pub data: Option<LayerData>,
    pub appearances: Vec<Appearance>,
    pub crs: Option<CRS>,
}

impl B3dmLayer {
    pub fn merge(&self, other: &B3dmLayer) -> B3dmLayer {
        B3dmLayer {
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
pub struct UpdateB3dmLayerMarker {
    pub layer_id: String,
    pub material: ModelMaterial,
}

#[derive(Debug, Component)]
pub struct DeleteB3dmLayerMarker(pub String);
