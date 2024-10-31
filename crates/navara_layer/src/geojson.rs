use bevy_ecs::component::Component;
use navara_core::CRS;
use navara_parser::geojson::GeoJson;

use navara_material::Appearance;

#[derive(Debug, Clone, PartialEq, Component)]
pub struct GeoJsonLayer {
    pub layer_id: String,
    pub data: Option<GeoJson>,
    pub appearances: Vec<Appearance>,
    pub crs: Option<CRS>,
}

#[derive(Debug, Component)]
pub struct UpdateGeoJsonLayerMarker {
    pub layer_id: String,
    pub appearance: Appearance,
}

#[derive(Debug, Component)]
pub struct DeleteGeoJsonLayerMarker(pub String);
