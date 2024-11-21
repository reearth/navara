use crate::render::{RenderInformation, RenderableFeature};
use bevy_ecs::{
    entity::Entity,
    query::Added,
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_core::WGS84_32;
use navara_layer::{LayerId, LayerStore};
use navara_material::BillboardMaterial;
use navara_math::{Transform, Vec3};
use navara_tile_component::{
    compute_terrain_height_at_point, TileMeshMarker, TileQuadtree, TileTerrainDataRequesterQuery,
};

use super::{BillboardGeometry, BillboardMarker};

pub fn transfer_mesh(
    mut commands: Commands,
    billboards: Query<
        (Entity, &LayerId, &BillboardGeometry, &BillboardMaterial),
        Added<BillboardGeometry>,
    >,
    mut layer_store: ResMut<LayerStore>,
) {
    for (entity, layer_id, geometry, material) in &billboards {
        let position = geometry
            .crs
            .to_vec3(WGS84_32, geometry.coords, material.height);

        let entity = commands.spawn((
            BillboardMarker,
            RenderableFeature::Billboard {
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

#[allow(clippy::too_many_arguments)]
pub fn update_height_by_terrain(
    mut qt: ResMut<TileQuadtree>,
    mut buf: ResMut<BufferStore>,
    mut renderable_features: Query<(&BillboardMarker, &mut RenderableFeature)>,
    geometries: Query<&BillboardGeometry>,
    tile_meshes: Query<&TileMeshMarker, Added<TileMeshMarker>>,
    terrain_data_requester: TileTerrainDataRequesterQuery,
) {
    if tile_meshes.is_empty() {
        return;
    }

    for (_, mut feature) in &mut renderable_features {
        match feature.as_mut() {
            RenderableFeature::Billboard {
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
