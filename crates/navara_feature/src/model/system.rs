use crate::{
    id::FeatureId,
    render::{RenderInformation, RenderableFeature},
    DeletedFeatureMarker,
};
use bevy_ecs::{
    entity::Entity,
    query::Added,
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_core::WGS84_32;
use navara_layer::{LayerId, LayerStore};
use navara_material::ModelMaterial;
use navara_math::{Quat, Transform, Vec3};
use navara_tile::{
    data_requester::TileTerrainDataRequesterQuery,
    tile::{compute_terrain_height_at_point, TileMeshMarker, TileQuadtree},
};

use super::{ModelBin, ModelGeometry, ModelMarker};

#[allow(clippy::type_complexity)]
pub fn transfer_mesh(
    mut commands: Commands,
    mut models: Query<
        (
            Entity,
            &LayerId,
            Option<&mut FeatureId>,
            &ModelGeometry,
            &ModelMaterial,
            // For GLB
            Option<&ModelBin>,
            Option<&Transform>,
            // For glTF
            // Option<&ModelJson>,
            Option<&DeletedFeatureMarker>,
        ),
        Added<ModelGeometry>,
    >,
    mut layer_store: ResMut<LayerStore>,
) {
    for (
        entity,
        layer_id,
        mut feature_id,
        geometry,
        material,
        bin,
        adjustment_transform,
        deleted_marker,
    ) in &mut models
    {
        if deleted_marker.is_some() {
            continue;
        }

        let position = geometry
            .crs
            .to_vec3(WGS84_32, geometry.coords, material.height);

        let transform = if material.should_rotate_in_default {
            let lnglat = geometry.crs.to_lng_lat(WGS84_32, geometry.coords);
            let lng = lnglat.lng.val();
            let lat = lnglat.lat.val();
            let rotation_y = Quat::from_rotation_y(-lat);
            let rotation_z = Quat::from_rotation_z(lng);
            let adjust_model = Quat::from_rotation_z(-std::f32::consts::PI / 2.0);
            let rotation = rotation_z * rotation_y * adjust_model;
            Transform::from_translation(position)
                .with_rotation(rotation)
                .with_scale(Vec3::new(material.size, material.size, material.size))
        } else {
            Transform::from_translation(position)
        };
        let transform = match adjustment_transform {
            Some(a) => transform.mul_transform(*a),
            None => transform,
        };

        let entity = commands.spawn((
            ModelMarker,
            RenderableFeature::Model {
                coordinates: geometry.coords,
                crs: geometry.crs.clone(),
                material: material.clone(),
                transform,
                feature_id: entity,
                render_info: RenderInformation {
                    current_terrain_height: 0.,
                },
                bin: bin.cloned(),
            },
        ));

        if let Some(f) = feature_id.as_mut() {
            f.0 = Some(entity.id());
        }

        layer_store.add(layer_id.0.clone(), entity.id());
    }
}

#[allow(clippy::too_many_arguments)]
pub fn update_height_by_terrain(
    mut qt: ResMut<TileQuadtree>,
    mut buf: ResMut<BufferStore>,
    mut renderable_features: Query<(&ModelMarker, &mut RenderableFeature)>,
    geometries: Query<&ModelGeometry>,
    tile_meshes: Query<&TileMeshMarker, Added<TileMeshMarker>>,
    terrain_data_requester: TileTerrainDataRequesterQuery,
) {
    if tile_meshes.is_empty() {
        return;
    }

    for (_, mut feature) in &mut renderable_features {
        match feature.as_mut() {
            RenderableFeature::Model {
                coordinates: _,
                crs: _,
                material,
                transform,
                feature_id,
                render_info,
                bin: _,
            } => {
                if !material.clamp_to_ground {
                    continue;
                }

                let geometry = match geometries.get(*feature_id) {
                    Ok(g) => g,
                    Err(_) => continue,
                };
                let terrain_height = if material.clamp_to_ground {
                    compute_terrain_height_at_point(
                        &mut qt,
                        &mut buf,
                        &terrain_data_requester,
                        &geometry.crs.to_lng_lat(WGS84_32, geometry.coords),
                    )
                    .unwrap_or(0.)
                } else {
                    0.
                };
                render_info.current_terrain_height =
                    render_info.current_terrain_height.max(terrain_height);
                let position = geometry.crs.to_vec3(
                    WGS84_32,
                    geometry.coords,
                    material.height + render_info.current_terrain_height,
                );

                transform.translation = position;
            }
            _ => unreachable!(),
        };
    }
}
