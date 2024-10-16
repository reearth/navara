use bevy_ecs::{
    entity::Entity,
    query::{Added, Changed},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_core::CRS;
use navara_data_requester::{DataRequester, DataRequesterExtension, DataRequesterStatus};
use navara_feature::model::{ModelBin, ModelGeometry};
use navara_layer::{B3dmLayer, LayerId};
use navara_material::Appearance;
use navara_math::{Quat, Transform, Vec3, PI_OVER_TWO};
use navara_parser::{b3dm::B3dm, glb::BinaryReader};

use super::requester::B3dmDataRequesterMarker;

pub fn request_model(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    b3dm_layers: Query<(Entity, &B3dmLayer), Added<B3dmLayer>>,
) {
    for (e, layer) in &b3dm_layers {
        commands.spawn((
            B3dmDataRequesterMarker(e),
            DataRequester::from_store(
                layer.data.as_ref().unwrap().url.clone(),
                &mut buf,
                DataRequesterExtension::B3dm,
            ),
        ));
    }
}

// TODO for GLB
// - We could use TextureFragment to fetch GLB.
// - However we might need to transform the position by the extension.
// FIXME: Store BatchTable to Bevy Resource.
pub fn construct_model(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    requesters: Query<(&B3dmDataRequesterMarker, &DataRequester), Changed<DataRequester>>,
    b3dm_layers: Query<(Entity, &B3dmLayer)>,
) {
    for (marker, req) in &requesters {
        // TODO: Handle fail
        if !matches!(req.status, DataRequesterStatus::Success) {
            continue;
        }
        let (_, layer) = match b3dm_layers.get(marker.0) {
            Ok(l) => l,
            Err(_) => unreachable!(),
        };
        let mut appearance = match &layer.appearances[0] {
            Appearance::Model(m) => m.clone(),
            _ => unimplemented!(),
        };
        appearance.should_rotate_in_default = false;

        let b3dm_bin = buf.get_u8(&req.handle).unwrap();
        let b3dm = B3dm::from_data(b3dm_bin).unwrap();
        let center =
            match b3dm.glb.0.json_chunk.data["extensions"]["CESIUM_RTC"]["center"].as_array() {
                Some(a) => {
                    let mut center = Vec::with_capacity(a.len());
                    for v in a {
                        match v.as_f64() {
                            Some(v) => center.push(v),
                            None => continue,
                        }
                    }
                    center
                }
                None => continue,
            };
        let glb_bin = match b3dm.extract_glb(b3dm_bin) {
            Ok(b) => b,
            Err(_) => unreachable!("B3DM should contain GLB"),
        };

        let glb_bin_handle = buf.new_u8(glb_bin);

        commands.spawn((
            LayerId(layer.layer_id.to_owned()),
            ModelGeometry {
                coords: Vec3::new(center[0] as f32, center[1] as f32, center[2] as f32),
                crs: CRS::Geocentric,
            },
            appearance,
            ModelBin(glb_bin_handle),
            // TODO: Check asset property in tileset.json.
            // TODO: Clamp the height to terrain height.
            Transform::from_rotation(Quat::from_rotation_x(PI_OVER_TWO)),
        ));

        buf.remove(&req.handle);
    }
}
