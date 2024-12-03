use bevy_ecs::{
    entity::Entity,
    query::{Changed, With, Without},
    system::{Commands, Query, Res, ResMut},
};

use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_core::calc_transform;
use navara_data_requester::{DataRequester, DataRequesterStatus};
use navara_feature::{polygon::BatchedFeature, polygon::UpdatePolygon, render::RenderableFeature};
use navara_layer::{DeleteMvtLayerMarker, LayerId, LayerStore, MvtLayer, UpdateMvtLayerMarker};
use navara_material::Appearance;

use crate::{
    data_requester::{MvtDataRequesterMarker, SingleMvtDataRequesterMarker},
    geometry::construct_geometry,
};

#[allow(clippy::type_complexity)]
pub fn construct_single_mvt(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    requesters: Query<
        (Entity, &MvtDataRequesterMarker, &DataRequester),
        (
            Changed<DataRequester>,
            With<SingleMvtDataRequesterMarker>,
            Without<Deleted>,
        ),
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

        let mvt_bin = match buf.get_u8(&req.handle) {
            Some(b) => b,
            None => continue,
        };

        // TODO: Move this process to worker.
        match construct_geometry(
            &mut commands,
            mvt_bin,
            &layer.layer_id,
            &layer.data.as_ref().unwrap().url,
            &layer.appearances,
        ) {
            Some(f) if !f.is_empty() => {
                commands.spawn(BatchedFeature { features: f });
            }
            _ => {}
        };
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
