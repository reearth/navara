use bevy_ecs::component::Component;
use navara_core::{is_tile_url, CRS};

use navara_material::{Appearance, VectorTileMaterial};

use crate::LayerData;

#[derive(Debug, Clone, PartialEq, Component)]
pub struct MvtLayer {
    pub layer_id: String,
    pub data: Option<LayerData>,
    pub appearances: Vec<Appearance>,
    pub crs: Option<CRS>,
}

impl MvtLayer {
    pub fn has_template_url(&self) -> bool {
        is_tile_url(&self.data.as_ref().unwrap().url)
    }

    pub fn vector_tile_appearance(&self) -> Option<&VectorTileMaterial> {
        self.appearances
            .iter()
            .find(|a| matches!(a, Appearance::VectorTile(_)))
            .and_then(|a| match a {
                Appearance::VectorTile(v) => Some(v),
                _ => None,
            })
    }

    pub fn merge(&self, other: &MvtLayer) -> MvtLayer {
        MvtLayer {
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
pub struct UpdateMvtLayerMarker {
    pub layer_id: String,
    pub appearance: Appearance,
}

#[derive(Debug, Component)]
pub struct DeleteMvtLayerMarker(pub String);
