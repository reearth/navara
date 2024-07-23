use bevy_ecs::component::Component;
use navara_core::CRS;
use navara_parser::geojson::{Feature, GeoJson};

use crate::Appearance;

#[derive(Debug, Clone, PartialEq, Component)]
pub struct GeoJsonLayer {
    pub data: GeoJson,
    pub appearances: Vec<Appearance>,
    pub crs: Option<CRS>,
    pub features: Vec<Feature>,
}
