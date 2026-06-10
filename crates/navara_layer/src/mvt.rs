use bevy_ecs::component::Component;
use navara_core::{CRS, is_pmtiles_url, is_tile_url};

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

    /// Whether this layer's data points to a PMTiles archive (vs a `{z}/{x}/{y}`
    /// tile template).
    pub fn is_pmtiles(&self) -> bool {
        self.data.as_ref().is_some_and(|d| is_pmtiles_url(&d.url))
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
}

#[derive(Debug, Component)]
pub struct UpdateMvtLayerMarker {
    pub layer_id: String,
    pub appearance: Appearance,
}

#[derive(Debug, Component)]
pub struct DeleteMvtLayerMarker(pub String);
