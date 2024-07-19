use bevy_ecs::{
    query::{Added, Changed, Or},
    system::{Commands, Query},
};
use navara_core::WGS84_32;
use navara_layer::{Appearance, GeoJsonLayer};

use crate::map::feature::billboard;

pub fn update(
    mut commands: Commands,
    geojson_layers: Query<&GeoJsonLayer, Or<(Added<GeoJsonLayer>, Changed<GeoJsonLayer>)>>,
) {
    for layer in &geojson_layers {
        let features = &layer.features;
        let appearances = &layer.appearances;
        for feature in features {
            for appearance in appearances {
                let renderable_feature = match appearance {
                    Appearance::Point(_v) => unimplemented!(),
                    Appearance::Billboard(v) => billboard::construct_mesh(WGS84_32, &feature, v),
                    Appearance::Polyline(_v) => unimplemented!(),
                    Appearance::Polygon(_v) => unimplemented!(),
                    Appearance::Model(_v) => unimplemented!(),
                };

                if let Some(renderable_feature) = renderable_feature {
                    // FIXME: Need to cache the entity to update the feature.
                    let _entity = commands.spawn(renderable_feature);
                }
            }
        }
    }
}
