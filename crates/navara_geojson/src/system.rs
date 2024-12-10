use bevy_ecs::{
    entity::Entity,
    query::{Added, Changed, Or},
    system::{Commands, Query, Res, ResMut},
};
use navara_core::{calc_transform, CRS};

use navara_feature::{
    billboard::BillboardGeometry, model::ModelGeometry, point::PointGeometry,
    polygon::PolygonGeometry, polygon::UpdatePolygon, polyline::PolylineGeometry,
    render::RenderableFeature,
};

use navara_buffer_store::BufferStore;

use navara_geometry::{Hierarchy, WindingOrder};
use navara_layer::{
    DeleteGeoJsonLayerMarker, GeoJsonLayer, LayerId, LayerStore, UpdateGeoJsonLayerMarker,
};
use navara_material::Appearance;

use navara_math::{FloatType, Vec3};
use navara_parser::geojson::{GeoJson, Geometry, Value};

fn coords(f: &[f64]) -> Vec3 {
    Vec3::new(
        f[0] as FloatType,
        f[1] as FloatType,
        *f.get(2).unwrap_or(&0.) as FloatType,
    )
}

fn multi_coords(f: &[Vec<f64>]) -> Vec<Vec3> {
    f.iter().map(|p| coords(p)).collect::<Vec<_>>()
}

fn get_polygon_holes(f: &[Vec<Vec<f64>>]) -> Option<Vec<Hierarchy>> {
    let holes: Vec<Hierarchy> = f[1..]
        .iter()
        .map(|hole| Hierarchy {
            outer_ring: multi_coords(hole),
            holes: None,
            expected_winding_order: WindingOrder::Unknown,
        })
        .collect();

    (!holes.is_empty()).then_some(holes)
}

fn spawn_feature(
    commands: &mut Commands,
    appearances: &[Appearance],
    geometry: &Geometry,
    layer_id: &str,
) {
    for appearance in appearances {
        match appearance {
            Appearance::Point(v) => match &geometry.value {
                Value::Point(f) => {
                    commands.spawn((
                        LayerId(layer_id.to_owned()),
                        PointGeometry {
                            coords: coords(f),
                            crs: CRS::Geographic,
                        },
                        v.clone(),
                    ));
                }
                Value::MultiPoint(fs) => {
                    for f in fs {
                        commands.spawn((
                            LayerId(layer_id.to_owned()),
                            PointGeometry {
                                coords: coords(f),
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
                        LayerId(layer_id.to_owned()),
                        BillboardGeometry {
                            coords: coords(f),
                            crs: CRS::Geographic,
                        },
                        v.clone(),
                    ));
                }
                Value::MultiPoint(fs) => {
                    for f in fs {
                        commands.spawn((
                            LayerId(layer_id.to_owned()),
                            BillboardGeometry {
                                coords: coords(f),
                                crs: CRS::Geographic,
                            },
                            v.clone(),
                        ));
                    }
                }
                _ => {}
            },
            Appearance::Polyline(v) => match &geometry.value {
                Value::LineString(f) => {
                    commands.spawn((
                        LayerId(layer_id.to_owned()),
                        PolylineGeometry {
                            coords: multi_coords(f),
                            crs: CRS::Geographic,
                        },
                        v.clone(),
                    ));
                }
                Value::MultiLineString(fs) => {
                    for f in fs {
                        commands.spawn((
                            LayerId(layer_id.to_owned()),
                            PolylineGeometry {
                                coords: multi_coords(f),
                                crs: CRS::Geographic,
                            },
                            v.clone(),
                        ));
                    }
                }
                _ => {}
            },
            Appearance::Polygon(v) => match &geometry.value {
                Value::Polygon(f) => {
                    commands.spawn((
                        LayerId(layer_id.to_owned()),
                        PolygonGeometry {
                            hierarchy: Hierarchy {
                                outer_ring: f
                                    .first()
                                    .map_or_else(std::vec::Vec::new, |v| multi_coords(v)),
                                holes: get_polygon_holes(f),
                                expected_winding_order: WindingOrder::Unknown,
                            },
                            crs: CRS::Geographic,
                        },
                        v.clone(),
                    ));
                }
                Value::MultiPolygon(fs) => {
                    for f in fs {
                        commands.spawn((
                            LayerId(layer_id.to_owned()),
                            PolygonGeometry {
                                hierarchy: Hierarchy {
                                    outer_ring: multi_coords(&f[0]),
                                    holes: get_polygon_holes(f),
                                    expected_winding_order: WindingOrder::Unknown,
                                },
                                crs: CRS::Geographic,
                            },
                            v.clone(),
                        ));
                    }
                }
                _ => {}
            },
            Appearance::Model(v) => match &geometry.value {
                Value::Point(f) => {
                    commands.spawn((
                        LayerId(layer_id.to_owned()),
                        ModelGeometry {
                            coords: coords(f),
                            crs: CRS::Geographic,
                        },
                        v.clone(),
                    ));
                }
                Value::MultiPoint(fs) => {
                    for f in fs {
                        commands.spawn((
                            LayerId(layer_id.to_owned()),
                            ModelGeometry {
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
            Appearance::VectorTile(_) => {}
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

        if let Some(geo_data) = &layer.data {
            match &geo_data {
                GeoJson::FeatureCollection(fs) => {
                    for f in fs {
                        if let Some(g) = &f.geometry {
                            spawn_feature(&mut commands, appearances, g, layer.layer_id.as_str());
                        }
                    }
                }
                GeoJson::Feature(f) => {
                    if let Some(g) = &f.geometry {
                        spawn_feature(&mut commands, appearances, g, layer.layer_id.as_str());
                    }
                }
                GeoJson::Geometry(g) => {
                    spawn_feature(&mut commands, appearances, g, layer.layer_id.as_str());
                }
            }
        }
    }
}

pub fn update_geo_json_layer(
    mut commands: Commands,
    layer_store: Res<LayerStore>,
    updated: Query<(Entity, &UpdateGeoJsonLayerMarker)>,
    mut features: Query<&mut RenderableFeature>,
) {
    for (e, u) in &updated {
        let layer_id = u.layer_id.clone();
        if let Some(ids) = layer_store.get(&layer_id) {
            for id in ids {
                let mut f = match features.get_mut(*id) {
                    Ok(f) => f,
                    Err(_) => continue,
                };

                match &mut *f {
                    RenderableFeature::Billboard {
                        coordinates,
                        crs,
                        material,
                        transform,
                        ..
                    } => {
                        if let Appearance::Billboard(mat) = &u.appearance {
                            let should_update_transform =
                                material.height != mat.height || material.size != mat.size;
                            *material = mat.clone();
                            if should_update_transform {
                                *transform = calc_transform(
                                    coordinates,
                                    crs,
                                    material.height,
                                    material.size,
                                    false,
                                );
                            }
                        }
                    }
                    RenderableFeature::Point {
                        coordinates,
                        crs,
                        material,
                        transform,
                        ..
                    } => {
                        if let Appearance::Point(mat) = &u.appearance {
                            let should_update_transform =
                                material.height != mat.height || material.size != mat.size;
                            *material = mat.clone();
                            if should_update_transform {
                                *transform = calc_transform(
                                    coordinates,
                                    crs,
                                    material.height,
                                    material.size,
                                    false,
                                );
                            }
                        }
                    }
                    RenderableFeature::Model {
                        coordinates,
                        crs,
                        material,
                        transform,
                        ..
                    } => {
                        if let Appearance::Model(mat) = &u.appearance {
                            let should_update_transform = material.height != mat.height
                                || material.size != mat.size
                                || material.should_rotate_in_default
                                    != mat.should_rotate_in_default;
                            *material = mat.clone();
                            if should_update_transform {
                                *transform = calc_transform(
                                    coordinates,
                                    crs,
                                    material.height,
                                    material.size,
                                    material.should_rotate_in_default,
                                );
                            }
                        }
                    }
                    RenderableFeature::Polyline { material, .. } => {
                        if let Appearance::Polyline(mat) = &u.appearance {
                            *material = mat.clone();
                        }
                    }
                    RenderableFeature::Polygon { .. } => {
                        if let Appearance::Polygon(mat) = &u.appearance {
                            commands.spawn(UpdatePolygon {
                                material: mat.clone(),
                                feature_id: *id,
                            });
                        }
                    }
                    _ => (),
                }
            }
        }
        commands.entity(e).despawn();
    }
}

#[allow(clippy::type_complexity)]
pub fn delete_geo_json_layer(
    mut commands: Commands,
    mut layer_store: ResMut<LayerStore>,
    deleted: Query<(Entity, &DeleteGeoJsonLayerMarker)>,
    layers: Query<(Entity, &GeoJsonLayer)>,
    mut features: Query<&mut RenderableFeature>,
    mut buf: ResMut<BufferStore>,
    entities_with_layerid: Query<(Entity, &LayerId)>,
) {
    for (e, d) in &deleted {
        let entities = layer_store.get(&d.0);
        if let Some(vec) = entities {
            // delete RenderableFeature and related Buffers
            for entity in vec {
                if let Ok(mut feature) = features.get_mut(*entity) {
                    match &mut *feature {
                        RenderableFeature::Polyline { geometry, .. } => {
                            geometry.remove_from_buf(&mut buf);
                        }
                        RenderableFeature::Polygon { geometry, .. } => {
                            geometry.remove_from_buf(&mut buf);
                        }
                        _ => (),
                    }
                }

                commands.entity(*entity).despawn();
            }
        }

        // delete all entities with this layer id
        for (entity, l_id) in entities_with_layerid.iter() {
            if l_id.0 == d.0 {
                commands.entity(entity).despawn();
            }
        }

        // delete stored layer id
        layer_store.remove(&d.0);

        for (e, l) in &layers {
            if l.layer_id != d.0 {
                continue;
            }
            commands.entity(e).despawn();
        }

        commands.entity(e).despawn();
    }
}

#[cfg(test)]
mod test {
    use bevy_app::{App, Update};
    use navara_buffer_store::BufferStore;
    use navara_core::{xyz_to_vec3, Angle, Meters, LLE, WGS84_32};
    use navara_event_store::EventStore;
    use navara_feature::{render::RenderableFeature, FeaturePlugin};
    use navara_layer::{GeoJsonLayer, LayerStore};
    use navara_material::Appearance;
    use navara_material::{BillboardMaterial, PointMaterial};
    use navara_math::Vec2;
    use navara_parser::geojson::GeoJson;
    use navara_tile_component::RasterTileQuadtree;

    use super::construct_feature;

    fn initialize_app() -> App {
        let mut app = App::new();

        app.init_resource::<BufferStore>();
        app.init_resource::<EventStore>();
        app.insert_resource(RasterTileQuadtree::new_with_linear_qt());
        app.insert_resource(LayerStore::new());
        app.add_plugins(FeaturePlugin);
        app.add_systems(Update, construct_feature);

        app
    }

    fn construct_geojson_layer(json: &str, appearances: Vec<Appearance>) -> GeoJsonLayer {
        let geojson = GeoJson::from_json_value(json.parse().unwrap()).unwrap();
        GeoJsonLayer {
            layer_id: "123".to_string(),
            data: Some(geojson),
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
            scale_by_distance: Some(true),
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
                    coordinates: _,
                    crs: _,
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
                    coordinates: _,
                    crs: _,
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
            scale_by_distance: Some(true),
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
                    coordinates: _,
                    crs: _,
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
                    coordinates: _,
                    crs: _,
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
            scale_by_distance: Some(true),
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
                    coordinates: _,
                    crs: _,
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
                    coordinates: _,
                    crs: _,
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
            scale_by_distance: Some(true),
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
                    coordinates: _,
                    crs: _,
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
                    coordinates: _,
                    crs: _,
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
