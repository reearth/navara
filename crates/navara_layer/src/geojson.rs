use bevy_ecs::component::Component;
use bevy_ecs::entity::Entity;
use navara_core::CRS;
use navara_parser::geojson::GeoJson;

use navara_material::Appearance;

#[derive(Debug, Clone, PartialEq)]
pub enum GeoJsonLayerData {
    GeoJson(GeoJson),
    URL(String),
}

#[derive(Debug, Clone, PartialEq, Component)]
pub struct GeoJsonLayer {
    pub layer_id: String,
    pub data: Option<GeoJsonLayerData>,
    pub appearances: Vec<Appearance>,
    pub crs: Option<CRS>,
}

impl GeoJsonLayer {
    pub fn merge(&self, other: &GeoJsonLayer) -> GeoJsonLayer {
        GeoJsonLayer {
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
pub struct UpdateGeoJsonLayerMarker {
    pub layer_id: String,
    pub appearance: Appearance,
}

#[derive(Debug, Component)]
pub struct DeleteGeoJsonLayerMarker(pub String);

#[derive(Debug, Component)]
pub struct GeoJsonLayerDataRequesterMarker(pub Entity);
