use crate::{
    b3dm::RenderedCesium3dTileContentB3dmMarker, cesium3dtiles::traversal::select_tiles,
    glb::RenderedCesium3dTileContentGlbMarker, pnts::RenderedCesium3dTileContentPntsMarker,
    Cesium3dTilesJsonTileSetStateMap, Cesium3dTilesTreeOrder, RenderedCesium3dTileContent,
};
use bevy_ecs::{
    change_detection::DetectChanges,
    entity::Entity,
    query::{Added, Changed, Or, With, Without},
    system::{Commands, ParamSet, Query, Res, ResMut},
    world::Ref,
};
use bevy_log::error;
use navara_buffer_store::BufferStore;
use navara_camera::{CameraFrustum, CameraMarker};
use navara_component::{Deleted, Priority};

use navara_data_requester::{DataRequester, DataRequesterExtension, DataRequesterStatus};
use navara_feature_component::{
    id::FeatureId,
    model::{ModelBin, ModelGeometry, ModelMarker},
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
    traversal::mark_rendered_tiles_invisible,
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
            // The root tileset is always prioritized.
            Cesium3dTilesTreeOrder {
                index: 0,
                distance: Default::default(),
            },
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
            Option<&Cesium3dTilesTreeOrder>,
        ),
        (Changed<DataRequester>, Without<Deleted>),
    >,
    layers: Query<&Cesium3dTilesLayer>,
) {
    for (e, marker, req, order) in &requesters {
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

        // Root tree's requester should be removed at this time, but other nested tree should preserve the component.
        // It is removed by each `remove_invisible_rendered_tiles` system.
        if order.map(|o| o.index).unwrap_or(0) == 0 {
            commands.entity(e).insert(Deleted);
        }

        let layer = match layers.get(marker.0) {
            Ok(l) => l,
            Err(_) => continue,
        };
        let metadata = Cesium3dTilesMetadata(tileset_json);
        let mut tree = match Cesium3dTilesTree::new(&req.url, marker.0, layer, &metadata.0) {
            Ok(t) => t,
            Err(e) => {
                error!("tileset.json might be incorrect: {}", e);
                continue;
            }
        };

        tree.root.parent_data_requester_id = Some(e);

        let mut entity = commands.spawn((LayerId(layer.layer_id.clone()), metadata, tree));

        if let Some(order) = order {
            entity.insert(order.clone());
        }
    }
}

#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn traverse_cesium_3d_tiles_tree(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut sync_json_tilesets: ResMut<Cesium3dTilesJsonTileSetStateMap>,
    window: Res<Window>,
    mut tiles: Query<(
        &Cesium3dTilesMetadata,
        &mut Cesium3dTilesTree,
        &Cesium3dTilesTreeOrder,
    )>,
    camera: Query<(&CameraMarker, Ref<Transform>, &CameraFrustum)>,
    requesters: Cesium3dTileContentRequesterQuery,
    changed_requesters: ChangedCesium3dTileContentRequesterQuery,
    mut rendered_tiles: ParamSet<(
        Query<&mut RenderedCesium3dTileContent>,
        Query<
            (),
            Or<(
                Added<RenderedCesium3dTileContent>,
                Changed<RenderedCesium3dTileContent>,
            )>,
        >,
    )>,
    features: Query<&FeatureId>,
    mut renderable_features: ParamSet<(
        Query<&RenderableFeature>,
        Query<(), (Changed<RenderableFeature>, With<ModelMarker>)>,
    )>,
) {
    let is_data_requesters_changed = !changed_requesters.is_empty();
    let changed_rendered_tiles = !rendered_tiles.p1().is_empty();
    let changed_renderable_features = !renderable_features.p1().is_empty();

    let mut rendered_tiles = rendered_tiles.p0();
    let renderable_features = renderable_features.p0();

    // Sort tree by `Cesium3dTilesTreeOrder` that has a order of each tile.
    for (metadata, mut tree, order) in &mut tiles.iter_mut().sort::<&Cesium3dTilesTreeOrder>() {
        for (_, camera, frustum) in &camera {
            let needs_update = is_data_requesters_changed
                || changed_rendered_tiles
                || changed_renderable_features
                || camera.is_added()
                || camera.is_changed()
                || tree.is_added()
                || sync_json_tilesets.needs_update();
            if !needs_update {
                continue;
            }
            let camera_pos = camera.transform_point(Vec3::ZERO);
            select_tiles(
                &mut commands,
                &mut buf,
                &mut sync_json_tilesets,
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
                order,
            );
        }
    }

    sync_json_tilesets.set_needs_update(false);
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
        Or<(
            With<RenderedCesium3dTileContentPntsMarker>,
            With<RenderedCesium3dTileContentB3dmMarker>,
            With<RenderedCesium3dTileContentGlbMarker>,
        )>,
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
                    let mut new_mat = u.material.clone();
                    new_mat.internal = mat.internal.clone();
                    *mat = new_mat;
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
                    let mut new_mat = u.material.clone();
                    new_mat.internal = material.internal.clone();
                    *material = new_mat;
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
                let mut new_mat = u.material.clone();
                new_mat.internal = mat.internal.clone();
                *mat = new_mat;
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
            mark_rendered_tiles_invisible(&mut commands, &mut tree.root, &mut rendered_tiles);
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

#[allow(clippy::type_complexity, clippy::too_many_arguments)]
pub fn remove_invisible_tileset(
    mut commands: Commands,
    mut tiles: Query<(Entity, &mut Cesium3dTilesTree, &Cesium3dTilesTreeOrder)>,
    mut rendered_tiles: Query<&mut RenderedCesium3dTileContent>,
) {
    for (entity, mut tree, order) in &mut tiles {
        let tile = &tree.root;

        let is_root_tree = order.index == 0;

        if !tile.state.removed || is_root_tree {
            continue;
        }

        mark_rendered_tiles_invisible(&mut commands, &mut tree.root, &mut rendered_tiles);

        commands.entity(entity).despawn();
    }
}
