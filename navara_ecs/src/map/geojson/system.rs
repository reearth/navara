use bevy_ecs::{
    query::{Added, Changed, Or},
    system::{Commands, Query},
};
use navara_core::WGS84_32;
use navara_layer::{Appearance, GeoJsonLayer};
use navara_parser::geojson::Value;

use crate::map::feature::{billboard, render::RenderableFeature};

pub fn update(
    mut commands: Commands,
    geojson_layers: Query<&GeoJsonLayer, Or<(Added<GeoJsonLayer>, Changed<GeoJsonLayer>)>>,
) {
    let mut add_command = |renderable_feature: Option<RenderableFeature>| {
        if let Some(renderable_feature) = renderable_feature {
            // FIXME: Need to cache the entity to update the feature.
            let _entity = commands.spawn(renderable_feature);
        }
    };

    for layer in &geojson_layers {
        let features = &layer.features;
        let appearances = &layer.appearances;
        for feature in features {
            for appearance in appearances {
                match appearance {
                    Appearance::Point(_v) => unimplemented!(),
                    Appearance::Billboard(v) => {
                        match feature.geometry.as_ref().map_or(None, |g| Some(&g.value)) {
                            Some(Value::Point(f)) => add_command(billboard::construct_mesh(
                                WGS84_32,
                                &[f[0] as f32, f[1] as f32, *f.get(2).unwrap_or(&0.) as f32],
                                v,
                            )),
                            Some(Value::MultiPoint(fs)) => {
                                for f in fs {
                                    add_command(billboard::construct_mesh(
                                        WGS84_32,
                                        &[
                                            f[0] as f32,
                                            f[1] as f32,
                                            *f.get(2).unwrap_or(&0.) as f32,
                                        ],
                                        v,
                                    ))
                                }
                            }
                            _ => {}
                        }
                    }
                    Appearance::Polyline(_v) => unimplemented!(),
                    Appearance::Polygon(_v) => unimplemented!(),
                    Appearance::Model(_v) => unimplemented!(),
                };
            }
        }
    }
}

#[cfg(test)]
mod test {
    use bevy_app::{App, Update};
    use navara_core::{Angle, Meters, LLE, WGS84_32};
    use navara_layer::{Appearance, BillboardMaterial, GeoJsonLayer};
    use navara_parser::geojson::GeoJson;

    use crate::map::feature::render::RenderableFeature;
    use crate::utils::coord::xyz_to_vec3;
    use crate::Vec2;

    use super::update;

    fn construct_geojson_layer(json: &str, appearances: Vec<Appearance>) -> GeoJsonLayer {
        let geojson = GeoJson::from_json_value(json.parse().unwrap()).unwrap();
        let features = match &geojson {
            GeoJson::FeatureCollection(f) => f.features.clone(),
            GeoJson::Feature(f) => vec![f.clone()],
            _ => unimplemented!(),
        };
        GeoJsonLayer {
            features,
            data: geojson,
            crs: None,
            appearances,
        }
    }

    #[test]
    fn it_should_render_billboard_with_point() {
        let mut app = App::new();

        app.add_systems(Update, update);

        let material = BillboardMaterial {
            show: true,
            size: 1.,
            color: 123,
            center: Vec2::new(1., 1.),
            height: 1.,
            url: "https://example.com".to_string(),
            scale_by_distance: (0., 1000.),
        };

        app.world.spawn(construct_geojson_layer(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [
                    139.75227193360223,
                    35.68520091767046
                ],
                "type": "Point"
            }
        },
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [
                    139.77250531915263,
                    35.71562661633277
                ],
                "type": "Point"
            }
        }
    ]
}"#,
            vec![Appearance::Billboard(material.clone())],
        ));

        app.update();

        let mut renderable_features = app.world.query::<&RenderableFeature>();

        assert_eq!(renderable_features.iter(&app.world).count(), 2);

        let mut iter = renderable_features.iter(&app.world);

        let expects = vec![
            xyz_to_vec3(
                LLE {
                    lng: Angle::new(139.75227193360223),
                    lat: Angle::new(35.68520091767046),
                    height: Meters::new(0. + material.height),
                }
                .rad()
                .to_xyz(WGS84_32),
            ),
            xyz_to_vec3(
                LLE {
                    lng: Angle::new(139.77250531915263),
                    lat: Angle::new(35.71562661633277),
                    height: Meters::new(0. + material.height),
                }
                .rad()
                .to_xyz(WGS84_32),
            ),
        ];

        assert_eq!(
            match iter.next().unwrap() {
                RenderableFeature::Billboard {
                    material: _,
                    transform,
                } => Some(transform.translation),
                _ => None,
            },
            Some(expects[0].clone())
        );
        assert_eq!(
            match iter.next().unwrap() {
                RenderableFeature::Billboard {
                    material: _,
                    transform,
                } => Some(transform.translation),
                _ => None,
            },
            Some(expects[1].clone())
        );
    }

    #[test]
    fn it_should_render_billboard_with_multipoint() {
        let mut app = App::new();

        app.add_systems(Update, update);

        let material = BillboardMaterial {
            show: true,
            size: 1.,
            color: 123,
            center: Vec2::new(1., 1.),
            height: 1.,
            url: "https://example.com".to_string(),
            scale_by_distance: (0., 1000.),
        };

        app.world.spawn(construct_geojson_layer(
            r#"{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "coordinates": [
                    [
                        139.75227193360223,
                        35.68520091767046
                    ],
                    [
                        139.77250531915263,
                        35.71562661633277
                    ]
                ],
                "type": "MultiPoint"
            }
        }
    ]
}"#,
            vec![Appearance::Billboard(material.clone())],
        ));

        app.update();

        let mut renderable_features = app.world.query::<&RenderableFeature>();

        assert_eq!(renderable_features.iter(&app.world).count(), 2);

        let mut iter = renderable_features.iter(&app.world);

        let expects = vec![
            xyz_to_vec3(
                LLE {
                    lng: Angle::new(139.75227193360223),
                    lat: Angle::new(35.68520091767046),
                    height: Meters::new(0. + material.height),
                }
                .rad()
                .to_xyz(WGS84_32),
            ),
            xyz_to_vec3(
                LLE {
                    lng: Angle::new(139.77250531915263),
                    lat: Angle::new(35.71562661633277),
                    height: Meters::new(0. + material.height),
                }
                .rad()
                .to_xyz(WGS84_32),
            ),
        ];

        assert_eq!(
            match iter.next().unwrap() {
                RenderableFeature::Billboard {
                    material: _,
                    transform,
                } => Some(transform.translation),
                _ => None,
            },
            Some(expects[0].clone())
        );
        assert_eq!(
            match iter.next().unwrap() {
                RenderableFeature::Billboard {
                    material: _,
                    transform,
                } => Some(transform.translation),
                _ => None,
            },
            Some(expects[1].clone())
        );
    }
}
