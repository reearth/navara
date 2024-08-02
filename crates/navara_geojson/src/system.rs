use bevy_ecs::{
    query::{Added, Changed, Or},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_core::WGS84_32;
use navara_data_requester::DataRequester;
use navara_feature::{billboard, point, render::RenderableFeature};
use navara_layer::{Appearance, GeoJsonLayer};
use navara_parser::geojson::Value;
use navara_tile::{
    terrain::TerrainDataRequesterMarker,
    tile::{TileMeshMarker, TileQuadtree},
};

#[allow(clippy::type_complexity)]
pub fn construct_feature(
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
                    Appearance::Point(v) => match feature.geometry.as_ref().map(|g| &g.value) {
                        Some(Value::Point(f)) => add_command(point::construct_mesh(
                            WGS84_32,
                            &[f[0] as f32, f[1] as f32, *f.get(2).unwrap_or(&0.) as f32],
                            v,
                        )),
                        Some(Value::MultiPoint(fs)) => {
                            for f in fs {
                                add_command(point::construct_mesh(
                                    WGS84_32,
                                    &[f[0] as f32, f[1] as f32, *f.get(2).unwrap_or(&0.) as f32],
                                    v,
                                ))
                            }
                        }
                        _ => {}
                    },
                    Appearance::Billboard(v) => match feature.geometry.as_ref().map(|g| &g.value) {
                        Some(Value::Point(f)) => add_command(billboard::construct_mesh(
                            WGS84_32,
                            &[f[0] as f32, f[1] as f32, *f.get(2).unwrap_or(&0.) as f32],
                            v,
                        )),
                        Some(Value::MultiPoint(fs)) => {
                            for f in fs {
                                add_command(billboard::construct_mesh(
                                    WGS84_32,
                                    &[f[0] as f32, f[1] as f32, *f.get(2).unwrap_or(&0.) as f32],
                                    v,
                                ))
                            }
                        }
                        _ => {}
                    },
                    Appearance::Polyline(_v) => unimplemented!(),
                    Appearance::Polygon(_v) => unimplemented!(),
                    Appearance::Model(_v) => unimplemented!(),
                };
            }
        }
    }
}

// This is used to update the height of feature depending on the terrain height.
#[allow(clippy::type_complexity)]
pub fn update_feature_by_tile_change(
    mut qt: ResMut<TileQuadtree>,
    mut buf: ResMut<BufferStore>,
    mut features: Query<&mut RenderableFeature>,
    tile_meshes: Query<&TileMeshMarker, Added<TileMeshMarker>>,
    terrain_data_requester: Query<(&TerrainDataRequesterMarker, &DataRequester)>,
) {
    if tile_meshes.is_empty() {
        return;
    }

    // FIXME: Need to think about how to render a ton of features. We should manage a feature in a spatial data structure.
    for mut feature in &mut features {
        match feature.as_mut() {
            RenderableFeature::Point {
                material,
                transform,
                coordinates,
                render_info,
            } => point::update_height_by_terrain(
                &mut qt,
                &mut buf,
                WGS84_32,
                material,
                transform,
                coordinates,
                render_info,
                &terrain_data_requester,
            ),
            RenderableFeature::Billboard {
                material,
                transform,
                coordinates,
                render_info,
            } => billboard::update_height_by_terrain(
                &mut qt,
                &mut buf,
                WGS84_32,
                material,
                transform,
                coordinates,
                render_info,
                &terrain_data_requester,
            ),
            _ => unimplemented!(),
        }
    }
}

#[cfg(test)]
mod test {
    use bevy_app::{App, Update};
    use navara_buffer_store::BufferStore;
    use navara_core::{Angle, Meters, LLE, WGS84_32};
    use navara_feature::render::RenderableFeature;
    use navara_layer::{Appearance, BillboardMaterial, GeoJsonLayer, PointMaterial};
    use navara_math::{xyz_to_vec3, Vec2};
    use navara_parser::geojson::GeoJson;

    use super::construct_feature;

    fn initialize_app() -> App {
        let mut app = App::new();

        app.init_resource::<BufferStore>();
        app.add_systems(Update, construct_feature);

        app
    }

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
    fn it_should_render_point_with_point() {
        let mut app = initialize_app();

        let material = PointMaterial {
            show: true,
            size: 1.,
            color: 123,
            center: Vec2::new(1., 1.),
            height: 1.,
            scale_by_distance: (0., 1000.),
            clamp_to_ground: false,
            depth_test: false,
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
            vec![Appearance::Point(material.clone())],
        ));

        app.update();

        let mut renderable_features = app.world.query::<&RenderableFeature>();

        assert_eq!(renderable_features.iter(&app.world).count(), 2);

        let mut iter = renderable_features.iter(&app.world);

        let expects = [
            xyz_to_vec3(
                LLE {
                    #[allow(clippy::excessive_precision)]
                    lng: Angle::new(139.75227193360223),
                    #[allow(clippy::excessive_precision)]
                    lat: Angle::new(35.68520091767046),
                    height: Meters::new(0. + material.height),
                }
                .rad()
                .to_xyz(WGS84_32),
            ),
            xyz_to_vec3(
                LLE {
                    #[allow(clippy::excessive_precision)]
                    lng: Angle::new(139.77250531915263),
                    #[allow(clippy::excessive_precision)]
                    lat: Angle::new(35.71562661633277),
                    height: Meters::new(0. + material.height),
                }
                .rad()
                .to_xyz(WGS84_32),
            ),
        ];

        assert_eq!(
            match iter.next().unwrap() {
                RenderableFeature::Point {
                    material: _,
                    transform,
                    coordinates: _,
                    render_info: _,
                } => Some(transform.translation),
                _ => None,
            },
            Some(expects[0])
        );
        assert_eq!(
            match iter.next().unwrap() {
                RenderableFeature::Point {
                    material: _,
                    transform,
                    coordinates: _,
                    render_info: _,
                } => Some(transform.translation),
                _ => None,
            },
            Some(expects[1])
        );
    }

    #[test]
    fn it_should_render_point_with_multipoint() {
        let mut app = initialize_app();

        let material = PointMaterial {
            show: true,
            size: 1.,
            color: 123,
            center: Vec2::new(1., 1.),
            height: 1.,
            scale_by_distance: (0., 1000.),
            clamp_to_ground: false,
            depth_test: false,
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
            vec![Appearance::Point(material.clone())],
        ));

        app.update();

        let mut renderable_features = app.world.query::<&RenderableFeature>();

        assert_eq!(renderable_features.iter(&app.world).count(), 2);

        let mut iter = renderable_features.iter(&app.world);

        let expects = [
            xyz_to_vec3(
                LLE {
                    #[allow(clippy::excessive_precision)]
                    lng: Angle::new(139.75227193360223),
                    #[allow(clippy::excessive_precision)]
                    lat: Angle::new(35.68520091767046),
                    height: Meters::new(0. + material.height),
                }
                .rad()
                .to_xyz(WGS84_32),
            ),
            xyz_to_vec3(
                LLE {
                    #[allow(clippy::excessive_precision)]
                    lng: Angle::new(139.77250531915263),
                    #[allow(clippy::excessive_precision)]
                    lat: Angle::new(35.71562661633277),
                    height: Meters::new(0. + material.height),
                }
                .rad()
                .to_xyz(WGS84_32),
            ),
        ];

        assert_eq!(
            match iter.next().unwrap() {
                RenderableFeature::Point {
                    material: _,
                    transform,
                    coordinates: _,
                    render_info: _,
                } => Some(transform.translation),
                _ => None,
            },
            Some(expects[0])
        );
        assert_eq!(
            match iter.next().unwrap() {
                RenderableFeature::Point {
                    material: _,
                    transform,
                    coordinates: _,
                    render_info: _,
                } => Some(transform.translation),
                _ => None,
            },
            Some(expects[1])
        );
    }

    #[test]
    fn it_should_render_billboard_with_point() {
        let mut app = initialize_app();

        let material = BillboardMaterial {
            show: true,
            size: 1.,
            color: 123,
            center: Vec2::new(1., 1.),
            height: 1.,
            url: "https://example.com".to_string(),
            scale_by_distance: (0., 1000.),
            clamp_to_ground: false,
            depth_test: false,
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

        let expects = [
            xyz_to_vec3(
                LLE {
                    #[allow(clippy::excessive_precision)]
                    lng: Angle::new(139.75227193360223),
                    #[allow(clippy::excessive_precision)]
                    lat: Angle::new(35.68520091767046),
                    height: Meters::new(0. + material.height),
                }
                .rad()
                .to_xyz(WGS84_32),
            ),
            xyz_to_vec3(
                LLE {
                    #[allow(clippy::excessive_precision)]
                    lng: Angle::new(139.77250531915263),
                    #[allow(clippy::excessive_precision)]
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
                    coordinates: _,
                    render_info: _,
                } => Some(transform.translation),
                _ => None,
            },
            Some(expects[0])
        );
        assert_eq!(
            match iter.next().unwrap() {
                RenderableFeature::Billboard {
                    material: _,
                    transform,
                    coordinates: _,
                    render_info: _,
                } => Some(transform.translation),
                _ => None,
            },
            Some(expects[1])
        );
    }

    #[test]
    fn it_should_render_billboard_with_multipoint() {
        let mut app = initialize_app();

        let material = BillboardMaterial {
            show: true,
            size: 1.,
            color: 123,
            center: Vec2::new(1., 1.),
            height: 1.,
            url: "https://example.com".to_string(),
            scale_by_distance: (0., 1000.),
            clamp_to_ground: false,
            depth_test: false,
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

        let expects = [
            xyz_to_vec3(
                LLE {
                    #[allow(clippy::excessive_precision)]
                    lng: Angle::new(139.75227193360223),
                    #[allow(clippy::excessive_precision)]
                    lat: Angle::new(35.68520091767046),
                    height: Meters::new(0. + material.height),
                }
                .rad()
                .to_xyz(WGS84_32),
            ),
            xyz_to_vec3(
                LLE {
                    #[allow(clippy::excessive_precision)]
                    lng: Angle::new(139.77250531915263),
                    #[allow(clippy::excessive_precision)]
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
                    coordinates: _,
                    render_info: _,
                } => Some(transform.translation),
                _ => None,
            },
            Some(expects[0])
        );
        assert_eq!(
            match iter.next().unwrap() {
                RenderableFeature::Billboard {
                    material: _,
                    transform,
                    coordinates: _,
                    render_info: _,
                } => Some(transform.translation),
                _ => None,
            },
            Some(expects[1])
        );
    }
}
