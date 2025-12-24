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

impl PntsLayer {
    pub fn merge(&self, other: &PntsLayer) -> PntsLayer {
        PntsLayer {
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
pub struct UpdatePntsLayerMarker {
    pub layer_id: String,
    pub material: ModelMaterial,
}

#[derive(Debug, Component)]
pub struct DeletePntsLayerMarker(pub String);
