use crate::{b3dm::RenderedCesium3dTileContentB3dmMarker, pnts::RenderedCesium3dTileContentPntsMarker, RenderedCesium3dTileContent};
use bevy_ecs::{
    change_detection::DetectChanges,
    entity::Entity,
    query::{Added, Changed, Or, With, Without},
    system::{Commands, Query, Res, ResMut},
    world::Ref,
};
use bevy_log::error;
use navara_buffer_store::BufferStore;
use navara_camera::{CameraFrustum, CameraMarker};
use navara_component::{Deleted, Priority};

use navara_data_requester::{DataRequester, DataRequesterExtension, DataRequesterStatus};
use navara_feature_component::{
    id::FeatureId,
    model::{ModelBin, ModelGeometry},
    render::RenderableFeature,
};
use navara_layer::{
    Cesium3dTilesLayer, DeleteCesium3dTilesLayerMarker, LayerId, LayerStore,
    UpdateCesium3dTilesLayerMarker,
};
use navara_material::{Appearance, ModelMaterial};
use navara_math::{Transform, Vec3};
use navara_parser::cesium3dtiles;
use navara_window::Window;

use super::{
    traversal::{mark_rendered_tiles_invisible, select_tiles},
    types::{Cesium3dTileContentRequesterQuery, ChangedCesium3dTileContentRequesterQuery},
    Cesium3dTilesMetadata, Cesium3dTilesMetadataDataRequesterMarker, Cesium3dTilesTree,
};

pub fn request_metadata(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    layers: Query<(Entity, &Cesium3dTilesLayer), Added<Cesium3dTilesLayer>>,
) {
    for (e, layer) in &layers {
        commands.spawn((
            Cesium3dTilesMetadataDataRequesterMarker(e),
            Priority::Medium,
            DataRequester::from_store(
                layer.data.as_ref().unwrap().url.clone(),
                &mut buf,
                DataRequesterExtension::Json,
            ),
        ));
    }
}

#[allow(clippy::type_complexity)]
pub fn construct_cesium_3d_tiles_tree(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    requesters: Query<
        (
            Entity,
            &Cesium3dTilesMetadataDataRequesterMarker,
            &DataRequester,
        ),
        (Changed<DataRequester>, Without<Deleted>),
    >,
    layers: Query<&Cesium3dTilesLayer>,
) {
    for (e, marker, req) in &requesters {
        // TODO: Handle fail
        if !matches!(req.status, DataRequesterStatus::Success) {
            continue;
        }

        let json_bin = buf.get_u8(&req.handle).unwrap();
        let tileset_json = match serde_json::from_slice::<cesium3dtiles::tileset::Tileset>(json_bin)
        {
            Ok(d) => d,
            Err(e) => {
                error!("tileset.json is incorrect: {}", e);
                continue;
            }
        };
        buf.remove(&req.handle);
        commands.entity(e).despawn();

        let layer = match layers.get(marker.0) {
            Ok(l) => l,
            Err(_) => continue,
        };
        let metadata = Cesium3dTilesMetadata(tileset_json);
        let tree = match Cesium3dTilesTree::new(&req.url, marker.0, layer, &metadata.0) {
            Ok(t) => t,
            Err(e) => {
                error!("tileset.json might be incorrect: {}", e);
                continue;
            }
        };

        commands.spawn((LayerId(layer.layer_id.clone()), metadata, tree));
    }
}

#[allow(clippy::too_many_arguments)]
pub fn traverse_cesium_3d_tiles_tree(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    window: Res<Window>,
    mut tiles: Query<(&Cesium3dTilesMetadata, &mut Cesium3dTilesTree)>,
    camera: Query<(&CameraMarker, Ref<Transform>, &CameraFrustum)>,
    requesters: Cesium3dTileContentRequesterQuery,
    changed_requesters: ChangedCesium3dTileContentRequesterQuery,
    mut rendered_tiles: Query<&mut RenderedCesium3dTileContent>,
    features: Query<&FeatureId>,
    renderable_features: Query<&RenderableFeature>,
) {
    let is_data_requesters_changed = !changed_requesters.is_empty();

    for (metadata, mut tree) in &mut tiles {
        for (_, camera, frustum) in &camera {
            let needs_update = is_data_requesters_changed
                || camera.is_added()
                || camera.is_changed()
                || tree.is_added();
            if !needs_update {
                continue;
            }
            let camera_pos = camera.transform_point(Vec3::ZERO);
            select_tiles(
                &mut commands,
                &mut buf,
                tree.layer_id,
                tree.max_sse,
                &tree.base_url.clone(),
                &metadata.0.root,
                &mut tree.root,
                camera_pos,
                frustum,
                &requesters,
                &mut rendered_tiles,
                &features,
                &renderable_features,
                &window,
            );
        }
    }
}

#[allow(clippy::type_complexity)]
pub fn update_cesium3dtiles_layer(
    mut commands: Commands,
    layer_store: Res<LayerStore>,
    updated: Query<(Entity, &UpdateCesium3dTilesLayerMarker)>,
    mut layers: Query<&mut Cesium3dTilesLayer>,
    mut rendered_features: Query<&mut RenderableFeature>,
    rendered_tiles: Query<
        &RenderedCesium3dTileContent,
        Or<(With<RenderedCesium3dTileContentPntsMarker>, With<RenderedCesium3dTileContentB3dmMarker>)>,
    >,
    mut features: Query<
        &mut ModelMaterial,
        (
            With<LayerId>,
            With<ModelGeometry>,
            With<ModelBin>,
            With<ModelMaterial>,
            With<Transform>,
        ),
    >,
) {
    for (e, u) in &updated {
        let layer_id = u.layer_id.clone();
        for mut l in &mut layers {
            if l.layer_id != layer_id {
                continue;
            }
            for a in &mut l.appearances {
                if let Appearance::Model(mat) = a {
                    *mat = u.material.clone();
                    mat.should_rotate_in_default = false;
                    mat.clamp_to_ground = false;
                }
            }
        }
        if let Some(ids) = layer_store.get(&layer_id) {
            for id in ids {
                let mut f = match rendered_features.get_mut(*id) {
                    Ok(f) => f,
                    Err(_) => continue,
                };
                if let RenderableFeature::Model { material, .. } = f.as_mut() {
                    *material = u.material.clone();
                    material.should_rotate_in_default = false;
                    material.clamp_to_ground = false;
                }
            }
        }
        for rendered_tile in &rendered_tiles {
            if !matches!(layers.get(rendered_tile.layer_id), Ok(l) if l.layer_id == layer_id) {
                continue;
            }
            if let Some(mut mat) = rendered_tile
                .feature_id
                .and_then(|id| features.get_mut(id).ok())
            {
                *mat = u.material.clone();
                mat.should_rotate_in_default = false;
                mat.clamp_to_ground = false;
            }
        }
        commands.entity(e).despawn();
    }
}

#[allow(clippy::type_complexity)]
pub fn delete_cesium3dtiles_layer(
    mut commands: Commands,
    mut layer_store: ResMut<LayerStore>,
    deleted: Query<(Entity, &DeleteCesium3dTilesLayerMarker)>,
    layers: Query<(Entity, &Cesium3dTilesLayer)>,
    mut tiles: Query<(Entity, &LayerId, &mut Cesium3dTilesTree)>,
    mut rendered_tiles: Query<&mut RenderedCesium3dTileContent>,
) {
    for (e, d) in &deleted {
        for (e, layer_id, mut tree) in &mut tiles {
            if layer_id.0 != d.0 {
                continue;
            }
            mark_rendered_tiles_invisible(&mut tree.root, &mut rendered_tiles);
            commands.entity(e).despawn();
            layer_store.remove(&layer_id.0);
        }
        for (e, l) in &layers {
            if l.layer_id != d.0 {
                continue;
            }
            commands.entity(e).despawn();
        }
        commands.entity(e).despawn();
    }
}
