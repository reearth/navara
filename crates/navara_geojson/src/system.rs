use bevy_ecs::{
    entity::Entity,
    query::{Added, Changed, Or, Without},
    system::{Commands, Query, Res, ResMut},
};

use navara_component::{Deleted, Priority};
use navara_core::CRS;

use navara_feature_component::{
    batch::{
        BatchId, BatchTable, FeatureBatchId, GlobalBatchIdAndSelections, IdPropertySelections,
        IdPropertyTable,
    },
    billboard::BillboardGeometry,
    model::ModelGeometry,
    point::PointGeometry,
    polygon::{PolygonGeometry, UpdatePolygon},
    polyline::PolylineGeometry,
    render::RenderableFeature,
    text::TextGeometry,
};

use navara_buffer_store::BufferStore;

use navara_geometry::{Hierarchy, WindingOrder};
use navara_layer::{
    DeleteGeoJsonLayerMarker, GeoJsonLayer, LayerId, LayerStore, UpdateGeoJsonLayerMarker,
};
use navara_material::Appearance;

use navara_math::{FloatType, Vec2, Vec3};
use navara_parser::geojson::{GeoJson, Geometry, Value};

use navara_layer::{GeoJsonLayerData, GeoJsonLayerDataRequesterMarker};

use navara_data_requester::{DataRequester, DataRequesterExtension, DataRequesterStatus};

fn coords(f: &[f64]) -> Vec3 {
    Vec3::new(
        f[0] as FloatType,
        f[1] as FloatType,
        *f.get(2).unwrap_or(&0.) as FloatType,
    )
}

fn multi_flat_coords(f: &[Vec<f64>]) -> Vec<FloatType> {
    f.iter()
        .flat_map(|p| {
            [
                p[0] as FloatType,
                p[1] as FloatType,
                *p.get(2).unwrap_or(&0.) as FloatType,
            ]
        })
        .collect::<Vec<_>>()
}

fn get_polygon_holes(f: &[Vec<Vec<f64>>]) -> Option<Vec<Hierarchy>> {
    let holes: Vec<Hierarchy> = f[1..]
        .iter()
        .map(|hole| Hierarchy {
            outer_ring: multi_flat_coords(hole),
            holes: None,
            expected_winding_order: WindingOrder::Unknown,
        })
        .collect();

    (!holes.is_empty()).then_some(holes)
}

fn generate_batch_id(
    batch_table_res: &mut BatchTable,
    id_prop_table_res: &mut IdPropertyTable,
    id_prop: String,
    properties: &Option<serde_json::Map<String, serde_json::Value>>,
) -> u32 {
    let props = properties
        .as_ref()
        .and_then(|prop| serde_json::to_value(prop).ok())
        .unwrap_or(serde_json::Value::Null);
    batch_table_res
        .init_values_with_id_props(Some(id_prop), props, id_prop_table_res)
        .unwrap_or(0)
}

#[allow(clippy::too_many_arguments)]
fn spawn_feature(
    commands: &mut Commands,
    buf: &mut BufferStore,
    batch_table_res: &mut BatchTable,
    id_prop_table_res: &mut IdPropertyTable,
    id_prop_sel_res: &IdPropertySelections,
    appearances: &[Appearance],
    geometry: &Geometry,
    layer_id: &str,
    properties: &Option<serde_json::Map<String, serde_json::Value>>,
) {
    for appearance in appearances {
        match appearance {
            Appearance::Point(v) => match &geometry.value {
                Value::Point(f) => {
                    let batch_id = generate_batch_id(
                        batch_table_res,
                        id_prop_table_res,
                        v.id_property.clone(),
                        properties,
                    );

                    commands.spawn((
                        LayerId(layer_id.to_owned()),
                        BatchId(Vec2::new(
                            batch_id as FloatType,
                            batch_table_res.get_selection(&batch_id, id_prop_sel_res) as FloatType,
                        )),
                        PointGeometry {
                            coords: coords(f),
                            crs: CRS::Geographic,
                        },
                        v.clone(),
                    ));
                }
                Value::MultiPoint(fs) => {
                    for f in fs {
                        let batch_id = generate_batch_id(
                            batch_table_res,
                            id_prop_table_res,
                            v.id_property.clone(),
                            properties,
                        );

                        commands.spawn((
                            LayerId(layer_id.to_owned()),
                            BatchId(Vec2::new(
                                batch_id as FloatType,
                                batch_table_res.get_selection(&batch_id, id_prop_sel_res)
                                    as FloatType,
                            )),
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
                    let batch_id = generate_batch_id(
                        batch_table_res,
                        id_prop_table_res,
                        v.id_property.clone(),
                        properties,
                    );

                    commands.spawn((
                        LayerId(layer_id.to_owned()),
                        BatchId(Vec2::new(
                            batch_id as FloatType,
                            batch_table_res.get_selection(&batch_id, id_prop_sel_res) as FloatType,
                        )),
                        BillboardGeometry {
                            coords: coords(f),
                            crs: CRS::Geographic,
                        },
                        v.clone(),
                    ));
                }
                Value::MultiPoint(fs) => {
                    for f in fs {
                        let batch_id = generate_batch_id(
                            batch_table_res,
                            id_prop_table_res,
                            v.id_property.clone(),
                            properties,
                        );

                        commands.spawn((
                            LayerId(layer_id.to_owned()),
                            BatchId(Vec2::new(
                                batch_id as FloatType,
                                batch_table_res.get_selection(&batch_id, id_prop_sel_res)
                                    as FloatType,
                            )),
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
            Appearance::Text(v) => match &geometry.value {
                Value::Point(f) => {
                    let batch_id = generate_batch_id(
                        batch_table_res,
                        id_prop_table_res,
                        v.id_property.clone(),
                        properties,
                    );

                    commands.spawn((
                        LayerId(layer_id.to_owned()),
                        BatchId(Vec2::new(
                            batch_id as FloatType,
                            batch_table_res.get_selection(&batch_id, id_prop_sel_res) as FloatType,
                        )),
                        TextGeometry {
                            coords: coords(f),
                            crs: CRS::Geographic,
                        },
                        v.clone(),
                    ));
                }
                Value::MultiPoint(fs) => {
                    for f in fs {
                        let batch_id = generate_batch_id(
                            batch_table_res,
                            id_prop_table_res,
                            v.id_property.clone(),
                            properties,
                        );

                        commands.spawn((
                            LayerId(layer_id.to_owned()),
                            BatchId(Vec2::new(
                                batch_id as FloatType,
                                batch_table_res.get_selection(&batch_id, id_prop_sel_res)
                                    as FloatType,
                            )),
                            TextGeometry {
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
                    let batch_id = generate_batch_id(
                        batch_table_res,
                        id_prop_table_res,
                        v.id_property.clone(),
                        properties,
                    );

                    commands.spawn((
                        LayerId(layer_id.to_owned()),
                        BatchId(Vec2::new(
                            batch_id as FloatType,
                            batch_table_res.get_selection(&batch_id, id_prop_sel_res) as FloatType,
                        )),
                        PolylineGeometry::with_buf(buf, multi_flat_coords(f), CRS::Geographic),
                        v.clone(),
                    ));
                }
                Value::MultiLineString(fs) => {
                    for f in fs {
                        let batch_id = generate_batch_id(
                            batch_table_res,
                            id_prop_table_res,
                            v.id_property.clone(),
                            properties,
                        );

                        commands.spawn((
                            LayerId(layer_id.to_owned()),
                            BatchId(Vec2::new(
                                batch_id as FloatType,
                                batch_table_res.get_selection(&batch_id, id_prop_sel_res)
                                    as FloatType,
                            )),
                            PolylineGeometry::with_buf(buf, multi_flat_coords(f), CRS::Geographic),
                            v.clone(),
                        ));
                    }
                }
                _ => {}
            },
            Appearance::Polygon(v) => match &geometry.value {
                Value::Polygon(f) => {
                    let batch_id = generate_batch_id(
                        batch_table_res,
                        id_prop_table_res,
                        v.id_property.clone(),
                        properties,
                    );

                    commands.spawn((
                        LayerId(layer_id.to_owned()),
                        BatchId(Vec2::new(
                            batch_id as FloatType,
                            batch_table_res.get_selection(&batch_id, id_prop_sel_res) as FloatType,
                        )),
                        PolygonGeometry {
                            hierarchy: Hierarchy {
                                outer_ring: f
                                    .first()
                                    .map_or_else(std::vec::Vec::new, |v| multi_flat_coords(v)),
                                holes: get_polygon_holes(f),
                                expected_winding_order: WindingOrder::Unknown,
                            }
                            .transfer(buf),
                            crs: CRS::Geographic,
                        },
                        v.clone(),
                    ));
                }
                Value::MultiPolygon(fs) => {
                    for f in fs {
                        let batch_id = generate_batch_id(
                            batch_table_res,
                            id_prop_table_res,
                            v.id_property.clone(),
                            properties,
                        );
                        commands.spawn((
                            LayerId(layer_id.to_owned()),
                            BatchId(Vec2::new(
                                batch_id as FloatType,
                                batch_table_res.get_selection(&batch_id, id_prop_sel_res)
                                    as FloatType,
                            )),
                            PolygonGeometry {
                                hierarchy: Hierarchy {
                                    outer_ring: multi_flat_coords(&f[0]),
                                    holes: get_polygon_holes(f),
                                    expected_winding_order: WindingOrder::Unknown,
                                }
                                .transfer(buf),
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
                    let batch_id = generate_batch_id(
                        batch_table_res,
                        id_prop_table_res,
                        v.id_property.clone(),
                        properties,
                    );

                    let global_batch_ids = vec![
                        batch_id,
                        batch_table_res.get_selection(&batch_id, id_prop_sel_res),
                    ];

                    let batch_length = global_batch_ids.len() / 2;
                    let ids_handle = buf.new_u32(global_batch_ids);
                    commands.spawn((
                        LayerId(layer_id.to_owned()),
                        FeatureBatchId(batch_id),
                        GlobalBatchIdAndSelections {
                            handle: ids_handle,
                            batch_length: batch_length as u32,
                        },
                        ModelGeometry {
                            coords: coords(f),
                            crs: CRS::Geographic,
                        },
                        v.clone(),
                    ));
                }
                Value::MultiPoint(fs) => {
                    for f in fs {
                        let batch_id = generate_batch_id(
                            batch_table_res,
                            id_prop_table_res,
                            v.id_property.clone(),
                            properties,
                        );

                        let global_batch_ids = vec![
                            batch_id,
                            batch_table_res.get_selection(&batch_id, id_prop_sel_res),
                        ];

                        let batch_length = global_batch_ids.len() / 2;
                        let ids_handle = buf.new_u32(global_batch_ids);
                        commands.spawn((
                            LayerId(layer_id.to_owned()),
                            FeatureBatchId(batch_id),
                            GlobalBatchIdAndSelections {
                                handle: ids_handle,
                                batch_length: batch_length as u32,
                            },
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
            _ => {}
        };
    }
}

#[allow(clippy::type_complexity)]
pub fn construct_feature(
    mut commands: Commands,
    mut batch_table_res: ResMut<BatchTable>,
    mut id_prop_table_res: ResMut<IdPropertyTable>,
    id_prop_sel_res: Res<IdPropertySelections>,
    mut buf: ResMut<BufferStore>,
    geojson_layers: Query<&GeoJsonLayer, Or<(Added<GeoJsonLayer>, Changed<GeoJsonLayer>)>>,
) {
    for layer in &geojson_layers {
        let appearances = &layer.appearances;

        if let Some(GeoJsonLayerData::GeoJson(geo_data)) = &layer.data {
            match &geo_data {
                GeoJson::FeatureCollection(fs) => {
                    for f in fs {
                        if let Some(g) = &f.geometry {
                            spawn_feature(
                                &mut commands,
                                &mut buf,
                                &mut batch_table_res,
                                &mut id_prop_table_res,
                                &id_prop_sel_res,
                                appearances,
                                g,
                                layer.layer_id.as_str(),
                                &f.properties,
                            );
                        }
                    }
                }
                GeoJson::Feature(f) => {
                    if let Some(g) = &f.geometry {
                        spawn_feature(
                            &mut commands,
                            &mut buf,
                            &mut batch_table_res,
                            &mut id_prop_table_res,
                            &id_prop_sel_res,
                            appearances,
                            g,
                            layer.layer_id.as_str(),
                            &f.properties,
                        );
                    }
                }
                GeoJson::Geometry(g) => {
                    spawn_feature(
                        &mut commands,
                        &mut buf,
                        &mut batch_table_res,
                        &mut id_prop_table_res,
                        &id_prop_sel_res,
                        appearances,
                        g,
                        layer.layer_id.as_str(),
                        &None,
                    );
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
                        render_info,
                        ..
                    } => {
                        if let Appearance::Billboard(mat) = &u.appearance {
                            material.update(mat, coordinates, crs, transform);
                            render_info.should_recalculate_height = true;
                        }
                    }
                    RenderableFeature::Text {
                        coordinates,
                        crs,
                        material,
                        transform,
                        render_info,
                        ..
                    } => {
                        if let Appearance::Text(mat) = &u.appearance {
                            material.update(mat, coordinates, crs, transform);
                            render_info.should_recalculate_height = true;
                        }
                    }
                    RenderableFeature::Point {
                        coordinates,
                        crs,
                        material,
                        transform,
                        render_info,
                        ..
                    } => {
                        if let Appearance::Point(mat) = &u.appearance {
                            material.update(mat, coordinates, crs, transform);
                            render_info.should_recalculate_height = true;
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
                            material.update(mat, coordinates, crs, transform);
                        }
                    }
                    RenderableFeature::Polyline { material, .. } => {
                        if let Appearance::Polyline(mat) = &u.appearance {
                            material.update(mat);
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

#[allow(clippy::type_complexity, clippy::too_many_arguments)]
pub fn delete_geo_json_layer(
    mut commands: Commands,
    mut layer_store: ResMut<LayerStore>,
    deleted: Query<(Entity, &DeleteGeoJsonLayerMarker)>,
    layers: Query<(Entity, &GeoJsonLayer)>,
    mut features: Query<&mut RenderableFeature>,
    mut buf: ResMut<BufferStore>,
    entities_with_layerid: Query<(Entity, &LayerId), Without<RenderableFeature>>,
    mut batch_table: ResMut<BatchTable>,
    mut id_prop_table_res: ResMut<IdPropertyTable>,
    batch_id: Query<&BatchId>,
) {
    for (e, d) in &deleted {
        let entities = layer_store.get(&d.0);
        if let Some(vec) = entities {
            // delete RenderableFeature and related Buffers
            for entity in vec {
                if let Ok(mut feature) = features.get_mut(*entity) {
                    feature.destroy(&mut buf, &mut batch_table, &mut id_prop_table_res);
                }

                commands.entity(*entity).insert(Deleted);
            }
        }

        // delete all entities with this layer id
        for (entity, l_id) in entities_with_layerid.iter() {
            if l_id.0 == d.0 {
                if batch_id.get(entity).is_ok() {
                    batch_table.remove(
                        &(batch_id.get(entity).unwrap().0.x as u32),
                        &mut id_prop_table_res,
                    );
                }

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

#[allow(clippy::type_complexity)]
pub fn request_geojson(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    geojson_layers: Query<(Entity, &GeoJsonLayer), Added<GeoJsonLayer>>,
) {
    for (e, l) in &geojson_layers {
        if let Some(GeoJsonLayerData::URL(url)) = &l.data {
            commands.spawn((
                GeoJsonLayerDataRequesterMarker(e),
                Priority::Medium,
                DataRequester::from_store(url.clone(), &mut buf, DataRequesterExtension::GeoJson),
            ));
        }
    }
}

#[allow(clippy::type_complexity)]
pub fn parse_geojson(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    requesters: Query<
        (Entity, &GeoJsonLayerDataRequesterMarker, &DataRequester),
        (Changed<DataRequester>, Without<Deleted>),
    >,
    mut layers: Query<&mut GeoJsonLayer>,
) {
    for (e, marker, req) in &requesters {
        if !matches!(req.status, DataRequesterStatus::Pending) {
            commands.entity(e).despawn();
        }

        if !matches!(req.status, DataRequesterStatus::Success) {
            continue;
        }

        let geojson = buf.remove_u8(&req.handle).unwrap();
        let geojson = GeoJson::from_reader(geojson.as_slice()).unwrap();

        if let Ok(mut l) = layers.get_mut(marker.0) {
            l.data = Some(GeoJsonLayerData::GeoJson(geojson));
        }
    }
}

#[cfg(test)]
mod test {
    use bevy_app::{App, Update};
    use navara_buffer_store::BufferStore;
    use navara_core::{xyz_to_vec3, Angle, Meters, LLE, WGS84_32};
    use navara_event_store::EventStore;
    use navara_feature::FeaturePlugin;
    use navara_feature_component::render::RenderableFeature;
    use navara_layer::{GeoJsonLayer, LayerStore};
    use navara_material::Appearance;
    use navara_material::{BillboardMaterial, PointMaterial};
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
            data: Some(navara_layer::GeoJsonLayerData::GeoJson(geojson)),
            crs: None,
            appearances,
        }
    }

    #[test]
    fn it_should_render_point_with_point() {
        let mut app = initialize_app();

        let material = PointMaterial::default();

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
                    geometry: _,
                    ..
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
                    geometry: _,
                    ..
                } => Some(transform.translation),
                _ => None,
            },
            Some(expects[1])
        );
    }

    #[test]
    fn it_should_render_point_with_multipoint() {
        let mut app = initialize_app();

        let material = PointMaterial::default();

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
                    geometry: _,
                    ..
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
                    geometry: _,
                    ..
                } => Some(transform.translation),
                _ => None,
            },
            Some(expects[1])
        );
    }

    #[test]
    fn it_should_render_billboard_with_point() {
        let mut app = initialize_app();

        let material = BillboardMaterial::default();

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
                    geometry: _,
                    ..
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
                    geometry: _,
                    ..
                } => Some(transform.translation),
                _ => None,
            },
            Some(expects[1])
        );
    }

    #[test]
    fn it_should_render_billboard_with_multipoint() {
        let mut app = initialize_app();

        let material = BillboardMaterial::default();

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
                    geometry: _,
                    ..
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
                    geometry: _,
                    ..
                } => Some(transform.translation),
                _ => None,
            },
            Some(expects[1])
        );
    }
}
