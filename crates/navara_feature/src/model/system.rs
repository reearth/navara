use crate::render::{RenderInformation, RenderableFeature};
use bevy_ecs::{
    entity::Entity,
    query::Added,
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_core::{xyz_to_vec3, Angle, LngLat, Meters, CRS, LLE, WGS84_32};
use navara_data_requester::DataRequester;
use navara_layer::{LayerId, LayerStore};
use navara_material::ModelMaterial;
use navara_math::{Quat, Transform, Vec3};
use navara_tile::{
    data_requester::TerrainDataRequesterMarker,
    tile::{compute_terrain_height_at_point, TileMeshMarker, TileQuadtree},
};

use super::{ModelGeometry, ModelMarker};

pub fn transfer_mesh(
    mut commands: Commands,
    models: Query<(Entity, &LayerId, &ModelGeometry, &ModelMaterial), Added<ModelGeometry>>,
    mut layer_store: ResMut<LayerStore>,
) {
    for (entity, layer_id, geometry, material) in &models {
        let position = match geometry.crs {
            CRS::Geographic => {
                let lng = geometry.coords.x;
                let lat = geometry.coords.y;
                let height = geometry.coords.z;

                xyz_to_vec3(
                    LLE {
                        lng: Angle::new(lng),
                        lat: Angle::new(lat),
                        height: Meters::new(height + material.height),
                    }
                    .rad()
                    .to_xyz(WGS84_32),
                )
            }
            CRS::Geocentric => unimplemented!(),
            CRS::ESPG { code: _ } => unimplemented!(),
        };

        let lng = geometry.coords.x.to_radians();
        let lat = geometry.coords.y.to_radians();
        let rotation_y = Quat::from_rotation_y(-lat);
        let rotation_z = Quat::from_rotation_z(lng);
        let adjust_model = Quat::from_rotation_z( - std::f32::consts::PI / 2.0);
        let rotation = rotation_z * rotation_y * adjust_model;

        let entity = commands.spawn((
            ModelMarker,
            RenderableFeature::Model {
                coordinates: geometry.coords,
                crs: geometry.crs.clone(),
                material: material.clone(),
                transform: Transform::from_translation(position)
                    .with_rotation(rotation)
                    .with_scale(Vec3::new(material.size, material.size, material.size)),
                feature_id: entity,
                render_info: RenderInformation {
                    current_terrain_height: 0.,
                },
            },
        ));

        layer_store
            .map
            .entry(layer_id.clone())
            .or_default()
            .push(entity.id());
    }
}

#[allow(clippy::too_many_arguments)]
pub fn update_height_by_terrain(
    mut qt: ResMut<TileQuadtree>,
    mut buf: ResMut<BufferStore>,
    mut renderable_features: Query<(&ModelMarker, &mut RenderableFeature)>,
    geometries: Query<&ModelGeometry>,
    tile_meshes: Query<&TileMeshMarker, Added<TileMeshMarker>>,
    terrain_data_requester: Query<(&TerrainDataRequesterMarker, &DataRequester)>,
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
            } => {
                let geometry = geometries.get(*feature_id).unwrap();
                let terrain_height = if material.clamp_to_ground {
                    compute_terrain_height_at_point(
                        &mut qt,
                        &mut buf,
                        &terrain_data_requester,
                        &LngLat {
                            lng: Angle::new(geometry.coords.x).rad(),
                            lat: Angle::new(geometry.coords.y).rad(),
                        },
                    )
                    .unwrap_or(0.)
                } else {
                    0.
                };
                render_info.current_terrain_height =
                    render_info.current_terrain_height.max(terrain_height);
                let position = xyz_to_vec3(
                    LLE {
                        lng: Angle::new(geometry.coords.x),
                        lat: Angle::new(geometry.coords.y),
                        height: Meters::new(
                            geometry.coords.z
                                + material.height
                                + render_info.current_terrain_height,
                        ),
                    }
                    .rad()
                    .to_xyz(WGS84_32),
                );

                transform.translation = position;
            }
            _ => unreachable!(),
        };
    }
}
