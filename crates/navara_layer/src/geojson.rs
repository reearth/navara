use bevy_ecs::component::Component;
use bevy_ecs::entity::Entity;
use navara_core::CRS;
use navara_parser::geojson::GeoJson;

use navara_material::{Appearance, LayerEffectConfig};

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
    pub effect_config: LayerEffectConfig,
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
