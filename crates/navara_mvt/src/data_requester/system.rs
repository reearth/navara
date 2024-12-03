use bevy_ecs::{
    entity::Entity,
    query::Added,
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::Priority;
use navara_core::is_tile_url;
use navara_data_requester::{DataRequester, DataRequesterExtension};
use navara_layer::MvtLayer;

use super::{MvtDataRequesterMarker, SingleMvtDataRequesterMarker};

/// Handle only one MVT file for debug.
pub fn request_single_mvt(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mvt_layers: Query<(Entity, &MvtLayer), Added<MvtLayer>>,
) {
    for (e, layer) in &mvt_layers {
        let url = layer.data.as_ref().unwrap().url.clone();
        if is_tile_url(&url) {
            continue;
        }

        commands.spawn((
            MvtDataRequesterMarker(e),
            SingleMvtDataRequesterMarker,
            Priority::Medium,
            DataRequester::from_store(
                layer.data.as_ref().unwrap().url.clone(),
                &mut buf,
                DataRequesterExtension::Mvt,
            ),
        ));
    }
}
