use bevy_ecs::{
    entity::Entity,
    query::{Added, With},
    system::{Commands, Query, ResMut},
};

use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_core::WGS84_32;
use navara_feature_component::{
    batch::{BatchId, BatchTable, IdPropertyTable},
    id::FeatureId,
    render::{RenderInformation, RenderableFeature, TransferableSingleGeometry},
    LODFeatureMarker,
};
use navara_layer::{LayerId, LayerStore};
use navara_material::TextMaterial;
use navara_math::{Transform, Vec3};
use navara_tile_component::{
    compute_terrain_height_at_point, RasterTileQuadtree, TileMeshMarker,
    TileTerrainDataRequesterQuery,
};

use navara_feature_component::text::{TextGeometry, TextMarker};

#[allow(clippy::type_complexity)]
pub fn transfer_mesh(
    mut commands: Commands,
    mut texts: Query<
        (
            Entity,
            &LayerId,
            &BatchId,
            Option<&mut FeatureId>,
            &TextGeometry,
            &TextMaterial,
            Option<&LODFeatureMarker>,
        ),
        Added<TextGeometry>,
    >,
    mut layer_store: ResMut<LayerStore>,
) {
    for (entity, layer_id, batch_id, feature_id, geometry, material, lod_marker) in &mut texts {
        let position = geometry
            .crs
            .to_vec3(WGS84_32, geometry.coords, material.height);

        let entity = commands
            .spawn((
                TextMarker,
                layer_id.clone(),
                RenderableFeature::Text {
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
                        is_rendered: false,
                        should_recalculate_height: true,
                    },
                    geometry: TransferableSingleGeometry {
                        batch_id: Some(batch_id.0.x as u32),
                        selected: Some(batch_id.0.y as u32),
                    },
                    active: lod_marker.is_none(),
                },
            ))
            .id();

        if let Some(mut feature_id) = feature_id {
            feature_id.0 = Some(entity);
        }

        layer_store.add(layer_id.0.clone(), entity);
    }
}

// TODO: This system is executed whenever a tile is added.
//       This isn't efficient, so we need to update this system
//       to execute only when the layer's bounding box is within the camera frustum.
#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn update_height_by_terrain(
    mut qt: ResMut<RasterTileQuadtree>,
    mut buf: ResMut<BufferStore>,
    mut renderable_features: Query<(&TextMarker, &mut RenderableFeature)>,
    geometries: Query<&TextGeometry>,
    tile_meshes: Query<&TileMeshMarker, Added<TileMeshMarker>>,
    terrain_data_requester: TileTerrainDataRequesterQuery,
) {
    let is_tile_meshes_empty = tile_meshes.is_empty();

    for (_, mut feature) in &mut renderable_features {
        match feature.as_ref() {
            RenderableFeature::Text {
                render_info,
                material,
                active,
                ..
            } => {
                if is_tile_meshes_empty && !render_info.should_recalculate_height {
                    continue;
                }
                if !material.show || !active {
                    continue;
                }
            }
            _ => continue,
        };

        match feature.as_mut() {
            RenderableFeature::Text {
                coordinates: _,
                crs: _,
                material,
                transform,
                feature_id,
                render_info,
                geometry: _,
                ..
            } => {
                render_info.should_recalculate_height = false;
                let geometry = geometries.get(*feature_id).unwrap();
                if material.clamp_to_ground {
                    let terrain_height = compute_terrain_height_at_point(
                        &mut qt,
                        &mut buf,
                        &terrain_data_requester,
                        &geometry.crs.to_lng_lat(WGS84_32, geometry.coords),
                    )
                    .unwrap_or(0.);
                    render_info.current_terrain_height =
                        render_info.current_terrain_height.max(terrain_height);
                } else {
                    render_info.current_terrain_height = 0.;
                }
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

#[allow(clippy::type_complexity)]
pub fn remove_batched_feature(
    mut commands: Commands,
    mut removed_renderable_features: Query<&mut RenderableFeature, With<Deleted>>,
    removed_features: Query<
        (Entity, &FeatureId, Option<&BatchId>),
        (With<TextGeometry>, With<Deleted>),
    >,
    mut buf: ResMut<BufferStore>,
    mut batch_table_res: ResMut<BatchTable>,
    mut id_prop_table_res: ResMut<IdPropertyTable>,
) {
    for (feature_id, rendered_feature_id, batch_id) in &removed_features {
        let Some(rendered_feature_id) = rendered_feature_id.0 else {
            continue;
        };
        if let Ok(mut feature) = removed_renderable_features.get_mut(rendered_feature_id) {
            feature.destroy(&mut buf, &mut batch_table_res, &mut id_prop_table_res);
        }
        if let Some(batch_id) = batch_id {
            batch_table_res.remove(&(batch_id.0[0] as u32), &mut id_prop_table_res);
        }
        commands.entity(feature_id).despawn();
        commands.entity(rendered_feature_id).despawn();
    }
}
