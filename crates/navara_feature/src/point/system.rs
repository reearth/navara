use crate::render::{RenderInformation, RenderableFeature};
use bevy_ecs::{
    entity::Entity,
    query::Added,
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_core::WGS84_32;
use navara_data_requester::DataRequester;
use navara_layer::{LayerId, LayerStore};
use navara_material::PointMaterial;
use navara_math::{Transform, Vec3};
use navara_tile::{
    data_requester::TerrainDataRequesterMarker,
    tile::{compute_terrain_height_at_point, TileMeshMarker, TileQuadtree},
};

use super::{PointGeometry, PointMarker};

pub fn transfer_mesh(
    mut commands: Commands,
    points: Query<(Entity, &LayerId, &PointGeometry, &PointMaterial), Added<PointGeometry>>,
    mut layer_store: ResMut<LayerStore>,
) {
    for (entity, layer_id, geometry, material) in &points {
        let position = geometry
            .crs
            .to_vec3(WGS84_32, geometry.coords, material.height);

        let entity = commands.spawn((
            PointMarker,
            RenderableFeature::Point {
                coordinates: geometry.coords,
                crs: geometry.crs.clone(),
                material: material.clone(),
                transform: Transform::from_translation(position).with_scale(Vec3::new(
                    material.size,
                    material.size,
                    material.size,
                )),
                feature_id: entity,
                render_info: RenderInformation {
                    current_terrain_height: 0.,
                },
            },
        ));

        layer_store.add(layer_id.0.clone(), entity.id());
    }
}

// TODO: This system is executed whenever a tile is added.
//       This isn't efficient, so we need to update this system
//       to execute only when the layer's bounding box is within the camera frustum.
#[allow(clippy::too_many_arguments)]
pub fn update_height_by_terrain(
    mut qt: ResMut<TileQuadtree>,
    mut buf: ResMut<BufferStore>,
    mut renderable_features: Query<(&PointMarker, &mut RenderableFeature)>,
    geometries: Query<&PointGeometry>,
    tile_meshes: Query<&TileMeshMarker, Added<TileMeshMarker>>,
    terrain_data_requester: Query<(&TerrainDataRequesterMarker, &DataRequester)>,
) {
    if tile_meshes.is_empty() {
        return;
    }

    for (_, mut feature) in &mut renderable_features {
        match feature.as_mut() {
            RenderableFeature::Point {
                coordinates: _,
                crs: _,
                material,
                transform,
                feature_id,
                render_info,
            } => {
                if !material.clamp_to_ground {
                    continue;
                }

                let geometry = geometries.get(*feature_id).unwrap();
                let terrain_height = compute_terrain_height_at_point(
                    &mut qt,
                    &mut buf,
                    &terrain_data_requester,
                    &geometry.crs.to_lng_lat(WGS84_32, geometry.coords),
                )
                .unwrap_or(0.);
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
