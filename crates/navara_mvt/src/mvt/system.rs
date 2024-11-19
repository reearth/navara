use bevy_ecs::{
    entity::Entity,
    query::{Added, Changed, Without},
    system::{Commands, Query, Res, ResMut},
};

use geo_types::{Geometry, LineString, MultiLineString, MultiPoint, MultiPolygon, Point};
use navara_buffer_store::BufferStore;
use navara_component::{Deleted, Priority};
use navara_core::{calc_transform, CRS};
use navara_data_requester::{DataRequester, DataRequesterExtension, DataRequesterStatus};
use navara_feature::{
    point::PointGeometry, polygon::PolygonGeometry, polygon::UpdatePolygon,
    polyline::PolylineGeometry, render::RenderableFeature,
};
use navara_geometry::Hierarchy;
use navara_layer::{DeleteMvtLayerMarker, LayerId, LayerStore, MvtLayer, UpdateMvtLayerMarker};
use navara_material::Appearance;
use navara_math::Vec3;
use navara_parser::mvt;

use super::pos_converter::PosConverter;
use super::requester::MvtDataRequesterMarker;

pub fn request_mvt(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mvt_layers: Query<(Entity, &MvtLayer), Added<MvtLayer>>,
) {
    for (e, layer) in &mvt_layers {
        commands.spawn((
            MvtDataRequesterMarker(e),
            Priority::Medium,
            DataRequester::from_store(
                layer.data.as_ref().unwrap().url.clone(),
                &mut buf,
                DataRequesterExtension::Mvt,
            ),
        ));
    }
}

#[allow(clippy::type_complexity)]
pub fn construct_mvt(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    requesters: Query<
        (Entity, &MvtDataRequesterMarker, &DataRequester),
        (Changed<DataRequester>, Without<Deleted>),
    >,
    mvt_layers: Query<(Entity, &MvtLayer)>,
) {
    for (e, marker, req) in &requesters {
        // TODO: Handle fail
        if !matches!(req.status, DataRequesterStatus::Success) {
            continue;
        }
        let (_, layer) = match mvt_layers.get(marker.0) {
            Ok(l) => l,
            Err(_) => unreachable!(),
        };

        commands.entity(e).despawn();

        if let Some(mvt_bin) = buf.get_u8(&req.handle) {
            if let Ok(reader) = mvt::MvtReader::new((*mvt_bin).to_vec()) {
                if let Ok(layer_names) = reader.get_layer_names() {
                    for (index, _name) in layer_names.iter().enumerate() {
                        let extent = reader.get_extent(index);
                        let mut converter =
                            PosConverter::new(layer.data.as_ref().unwrap().url.as_str(), extent);
                        if converter.get_size() == 0.0 {
                            continue;
                        }
                        if let Ok(features) = reader.get_features(index) {
                            for feature in features {
                                let geom = feature.get_geometry();
                                match geom {
                                    Geometry::MultiPolygon(v) => {
                                        let MultiPolygon(plgs) = v;

                                        for one_appr in &layer.appearances {
                                            if let Appearance::Polygon(appearance) = one_appr {
                                                // TODO: Merge these geometries into one
                                                for polygon in plgs {
                                                    let LineString(outer) = polygon.exterior();
                                                    let outer_vec = converter.project_points(outer);
                                                    // TODO: holes are not support yet
                                                    // let holes = polygon.interiors();
                                                    // info!("holes.len {}", holes.len());

                                                    if outer_vec.len() < 50 {
                                                        // A large number of polygons can cause the webpage to slow down,
                                                        // so for now, only draw some of the larger polygons.
                                                        continue;
                                                    }

                                                    commands.spawn((
                                                        LayerId(layer.layer_id.to_owned()),
                                                        PolygonGeometry {
                                                            hierarchy: Hierarchy {
                                                                outer_ring: outer_vec,
                                                                holes: std::vec::Vec::new(),
                                                            },
                                                            crs: CRS::Geographic,
                                                        },
                                                        appearance.clone(),
                                                    ));
                                                }
                                                break;
                                            }
                                        }
                                    }
                                    Geometry::MultiPoint(v) => {
                                        let MultiPoint(points) = v;

                                        for one_appr in &layer.appearances {
                                            if let Appearance::Point(appearance) = one_appr {
                                                for point in points {
                                                    let Point(pt) = point;
                                                    let (x, y) = converter.project_point(pt);

                                                    commands.spawn((
                                                        LayerId(layer.layer_id.to_owned()),
                                                        PointGeometry {
                                                            coords: Vec3::new(x, y, 0.0),
                                                            crs: CRS::Geographic,
                                                        },
                                                        appearance.clone(),
                                                    ));
                                                }
                                                break;
                                            }
                                        }
                                    }
                                    Geometry::MultiLineString(v) => {
                                        let MultiLineString(lines) = v;

                                        for one_appr in &layer.appearances {
                                            if let Appearance::Polyline(appearance) = one_appr {
                                                for line in lines {
                                                    let LineString(points) = line;
                                                    let geo_points =
                                                        converter.project_points(points);

                                                    commands.spawn((
                                                        LayerId(layer.layer_id.to_owned()),
                                                        PolylineGeometry {
                                                            coords: geo_points,
                                                            crs: CRS::Geographic,
                                                        },
                                                        appearance.clone(),
                                                    ));
                                                }
                                                break;
                                            }
                                        }
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                }
            }
        }

        buf.remove(&req.handle);
    }
}

pub fn update_mvt_layer(
    mut commands: Commands,
    layer_store: Res<LayerStore>,
    updated: Query<(Entity, &UpdateMvtLayerMarker)>,
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

                match &u.appearance {
                    Appearance::Point(pt) => {
                        if let RenderableFeature::Point {
                            coordinates,
                            crs,
                            material,
                            transform,
                            ..
                        } = f.as_mut()
                        {
                            let should_update_transform =
                                material.height != pt.height || material.size != pt.size;
                            *material = pt.clone();
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
                    Appearance::Polyline(polyline) => {
                        if let RenderableFeature::Polyline { material, .. } = f.as_mut() {
                            *material = polyline.clone();
                        }
                    }
                    Appearance::Polygon(polygon) => {
                        if let RenderableFeature::Polygon { .. } = f.as_mut() {
                            commands.spawn(UpdatePolygon {
                                material: polygon.clone(),
                                feature_id: *id,
                            });
                        }
                    }
                    _ => {}
                }
            }
        }
        commands.entity(e).despawn();
    }
}

#[allow(clippy::type_complexity)]
pub fn delete_mvt_layer(
    mut commands: Commands,
    mut layer_store: ResMut<LayerStore>,
    deleted: Query<(Entity, &DeleteMvtLayerMarker)>,
    layers: Query<(Entity, &MvtLayer)>,
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
