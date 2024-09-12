use bevy_ecs::{
    query::{Added, Changed, Or},
    system::{Commands, Query},
};
use navara_core::CRS;
use navara_feature::{billboard::BillboardGeometry, point::PointGeometry};
use navara_layer::{Appearance, GeoJsonLayer};

use navara_math::{FloatType, Vec3};
use navara_parser::geojson::{GeoJson, Geometry, Value};

use bevy_log::info;

fn spawn_feature(commands: &mut Commands, appearances: &[Appearance], geometry: &Geometry) {
    for appearance in appearances {
        match appearance {
            Appearance::Point(v) => match &geometry.value {
                Value::Point(f) => {
                    commands.spawn((
                        PointGeometry {
                            coords: Vec3::new(
                                f[0] as FloatType,
                                f[1] as FloatType,
                                *f.get(2).unwrap_or(&0.) as FloatType,
                            ),
                            crs: CRS::Geographic,
                        },
                        v.clone(),
                    ));
                }
                Value::MultiPoint(fs) => {
                    for f in fs {
                        commands.spawn((
                            PointGeometry {
                                coords: Vec3::new(
                                    f[0] as FloatType,
                                    f[1] as FloatType,
                                    *f.get(2).unwrap_or(&0.) as FloatType,
                                ),
                                crs: CRS::Geographic,
                            },
                            v.clone(),
                        ));
                    }
                }
                _ => {}
            },
            Appearance::Billboard(v) => match &geometry.value {
                Value::Point(f) => {
                    commands.spawn((
                        BillboardGeometry {
                            coords: Vec3::new(
                                f[0] as FloatType,
                                f[1] as FloatType,
                                *f.get(2).unwrap_or(&0.) as FloatType,
                            ),
                            crs: CRS::Geographic,
                        },
                        v.clone(),
                    ));
                }
                Value::MultiPoint(fs) => {
                    for f in fs {
                        commands.spawn((
                            BillboardGeometry {
                                coords: Vec3::new(
                                    f[0] as FloatType,
                                    f[1] as FloatType,
                                    *f.get(2).unwrap_or(&0.) as FloatType,
                                ),
                                crs: CRS::Geographic,
                            },
                            v.clone(),
                        ));
                    }
                }
                _ => {}
            },
            Appearance::Polyline(_v) => unimplemented!(),
            Appearance::Polygon(_v) => unimplemented!(),
            Appearance::Model(_v) => {
                info!("{:?}", geometry);
            },
        };
    }
}

#[allow(clippy::type_complexity)]
pub fn construct_feature(
    mut commands: Commands,
    geojson_layers: Query<&GeoJsonLayer, Or<(Added<GeoJsonLayer>, Changed<GeoJsonLayer>)>>,
) {
    for layer in &geojson_layers {
        let appearances = &layer.appearances;
        match &layer.data {
            GeoJson::FeatureCollection(fs) => {
                for f in fs {
                    if let Some(g) = &f.geometry {
                        spawn_feature(&mut commands, appearances, g);
                    }
                }
            }
            GeoJson::Feature(f) => {
                if let Some(g) = &f.geometry {
                    spawn_feature(&mut commands, appearances, g);
                }
            }
            GeoJson::Geometry(g) => {
                spawn_feature(&mut commands, appearances, g);
            }
        }
    }
}

#[cfg(test)]
mod test {
    use bevy_app::{App, Update};
    use navara_buffer_store::BufferStore;
    use navara_core::{xyz_to_vec3, Angle, Meters, LLE, WGS84_32};
    use navara_event_store::EventStore;
    use navara_feature::{render::RenderableFeature, FeaturePlugin};
    use navara_layer::{Appearance, BillboardMaterial, GeoJsonLayer, PointMaterial};
    use navara_math::Vec2;
    use navara_parser::geojson::GeoJson;
    use navara_tile::tile::TileQuadtree;

    use super::construct_feature;

    fn initialize_app() -> App {
        let mut app = App::new();

        app.init_resource::<BufferStore>();
        app.init_resource::<EventStore>();
        app.insert_resource(TileQuadtree::new_with_region_qt(30));
        app.add_plugins(FeaturePlugin);
        app.add_systems(Update, construct_feature);

        app
    }

    fn construct_geojson_layer(json: &str, appearances: Vec<Appearance>) -> GeoJsonLayer {
        let geojson = GeoJson::from_json_value(json.parse().unwrap()).unwrap();
        GeoJsonLayer {
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

        app.world_mut().spawn(construct_geojson_layer(
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
        app.update();

        let mut renderable_features = app.world_mut().query::<&RenderableFeature>();

        assert_eq!(renderable_features.iter(app.world()).count(), 2);

        let mut iter = renderable_features.iter(app.world());

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
                    feature_id: _,
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
                    feature_id: _,
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

        app.world_mut().spawn(construct_geojson_layer(
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
        app.update();

        let mut renderable_features = app.world_mut().query::<&RenderableFeature>();

        assert_eq!(renderable_features.iter(app.world()).count(), 2);

        let mut iter = renderable_features.iter(app.world());

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
                    feature_id: _,
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
                    feature_id: _,
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

        app.world_mut().spawn(construct_geojson_layer(
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
        app.update();

        let mut renderable_features = app.world_mut().query::<&RenderableFeature>();

        assert_eq!(renderable_features.iter(app.world()).count(), 2);

        let mut iter = renderable_features.iter(app.world());

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
                    feature_id: _,
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
                    feature_id: _,
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

        app.world_mut().spawn(construct_geojson_layer(
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
        app.update();

        let mut renderable_features = app.world_mut().query::<&RenderableFeature>();

        assert_eq!(renderable_features.iter(app.world()).count(), 2);

        let mut iter = renderable_features.iter(app.world());

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
                    feature_id: _,
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
                    feature_id: _,
                    render_info: _,
                } => Some(transform.translation),
                _ => None,
            },
            Some(expects[1])
        );
    }
}
