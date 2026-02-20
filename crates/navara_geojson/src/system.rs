use bevy_ecs::{
    entity::Entity,
    query::{Added, Changed, Or, Without},
    system::{Commands, Query, Res, ResMut},
};

use navara_component::{Deleted, Priority};

use navara_feature_component::{
    batch::{BatchTable, BatchedFeature},
    polygon::UpdatePolygon,
    render::RenderableFeature,
};

use navara_buffer_store::BufferStore;

use navara_layer::{
    DeleteGeoJsonLayerMarker, GeoJsonLayer, LayerId, LayerStore, UpdateGeoJsonLayerMarker,
};
use navara_material::Appearance;

use navara_layer::{GeoJsonLayerData, GeoJsonLayerDataRequesterMarker};

use navara_data_requester::{DataRequester, DataRequesterExtension, DataRequesterStatus};
use navara_parser::geojson::GeoJson;

use crate::geometry;

#[allow(clippy::type_complexity)]
pub fn construct_feature(
    mut commands: Commands,
    mut batch_table_res: ResMut<BatchTable>,
    mut buf: ResMut<BufferStore>,
    geojson_layers: Query<&GeoJsonLayer, Or<(Added<GeoJsonLayer>, Changed<GeoJsonLayer>)>>,
) {
    for layer in &geojson_layers {
        if let Some(GeoJsonLayerData::GeoJson(geo_data)) = &layer.data {
            geometry::construct_geometry(
                &mut commands,
                &mut batch_table_res,
                &mut buf,
                geo_data,
                &layer.appearances,
                layer.layer_id.as_str(),
            );
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
        let mut all_rendered = true;
        if let Some(ids) = layer_store.get(&layer_id) {
            for id in ids {
                let mut f = match features.get_mut(*id) {
                    Ok(f) => f,
                    Err(_) => continue,
                };

                if !f.is_rendered() {
                    all_rendered = false;
                    continue;
                }

                match &mut *f {
                    RenderableFeature::Billboard {
                        material,
                        transform,
                        render_info,
                        ..
                    } => {
                        if let Appearance::Billboard(mat) = &u.appearance {
                            material.update(mat, transform);
                            render_info.should_recalculate_height = true;
                        }
                    }
                    RenderableFeature::Text {
                        material,
                        render_info,
                        ..
                    } => {
                        if let Appearance::Text(mat) = &u.appearance {
                            material.update(mat);
                            render_info.should_recalculate_height = true;
                        }
                    }
                    RenderableFeature::Point {
                        material,
                        transform,
                        render_info,
                        ..
                    } => {
                        if let Appearance::Point(mat) = &u.appearance {
                            material.update(mat, transform);
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
                    RenderableFeature::Polyline {
                        material,
                        render_info,
                        ..
                    } => {
                        if let Appearance::Polyline(mat) = &u.appearance {
                            material.update(mat);
                            render_info.should_recalculate_height = true;
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
        // Only despawn the update marker when all features have been rendered,
        // so unrendered features can be retried next frame.
        if all_rendered {
            commands.entity(e).despawn();
        }
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
    batched_features: Query<(Entity, &LayerId, &BatchedFeature), Without<RenderableFeature>>,
    mut batch_table: ResMut<BatchTable>,
) {
    for (e, d) in &deleted {
        let entities = layer_store.get(&d.0);
        if let Some(vec) = entities {
            // delete RenderableFeature and related Buffers
            for entity in vec {
                if let Ok(mut feature) = features.get_mut(*entity) {
                    feature.destroy(&mut buf, &mut batch_table);
                }

                commands.entity(*entity).insert(Deleted);
            }
        }

        // delete BatchedFeature entities with this layer id
        for (entity, l_id, batched) in batched_features.iter() {
            if l_id.0 == d.0 {
                batched.despawn_recursively(&mut commands);
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
