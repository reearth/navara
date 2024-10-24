use bevy_ecs::{
    entity::Entity,
    query::{Added, Changed},
    system::{Commands, Query, Res, ResMut},
};
use bevy_log::error;
use navara_buffer_store::BufferStore;
use navara_camera::{CameraFrustum, CameraMarker};
use navara_data_requester::{DataRequester, DataRequesterExtension, DataRequesterStatus};
use navara_layer::Cesium3dTilesLayer;
use navara_math::{Transform, Vec3};
use navara_parser::cesium3dtiles;
use navara_window::Window;

use crate::RenderedCesium3dTileContent;

use super::{
    traversal::select_tiles, types::Cesium3dTileContentRequesterQuery, Cesium3dTilesMetadata,
    Cesium3dTilesMetadataDataRequesterMarker, Cesium3dTilesTree,
};

pub fn request_metadata(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    layers: Query<(Entity, &Cesium3dTilesLayer), Added<Cesium3dTilesLayer>>,
) {
    for (e, layer) in &layers {
        commands.spawn((
            Cesium3dTilesMetadataDataRequesterMarker(e),
            DataRequester::from_store(
                layer.data.as_ref().unwrap().url.clone(),
                &mut buf,
                DataRequesterExtension::Json,
            ),
        ));
    }
}

pub fn construct_cesium_3d_tiles_tree(
    mut commands: Commands,
    buf: Res<BufferStore>,
    requesters: Query<
        (&Cesium3dTilesMetadataDataRequesterMarker, &DataRequester),
        Changed<DataRequester>,
    >,
    layers: Query<&Cesium3dTilesLayer>,
) {
    for (marker, req) in &requesters {
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
        let layer = layers.get(marker.0).ok();
        let metadata = Cesium3dTilesMetadata(tileset_json);
        let tree = match Cesium3dTilesTree::new(&req.url, marker.0, layer, &metadata.0) {
            Ok(t) => t,
            Err(e) => {
                error!("tileset.json might be incorrect: {}", e);
                continue;
            }
        };

        commands.spawn((metadata, tree));
    }
}

pub fn traverse_cesium_3d_tiles_tree(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    window: Res<Window>,
    mut tiles: Query<(&Cesium3dTilesMetadata, &mut Cesium3dTilesTree)>,
    camera: Query<(&CameraMarker, &Transform, &CameraFrustum)>,
    requesters: Cesium3dTileContentRequesterQuery,
    mut rendered_tiles: Query<&mut RenderedCesium3dTileContent>,
) {
    for (metadata, mut tree) in &mut tiles {
        for (_, camera, frustum) in &camera {
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
                &window,
            );
        }
    }
}
