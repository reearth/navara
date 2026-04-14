//! PNTS format parser implementation for the `TileContentParser` trait.

use navara_buffer_store::{BufferStore, Handle};
use navara_core::CRS;
use navara_feature_component::batch::{FeatureBatchId, GlobalBatchIds};
use navara_material::ModelInternalMaterial;
use navara_math::{Transform, Vec3};
use navara_parser::pnts::*;

use crate::tile_content_parser::{ParseContext, ParsedTileContent, TileContentParser};

use super::{RenderedCesium3dTileContentPntsMarker, requester::PntsDataRequesterMarker};

/// PNTS tile content parser.
pub struct PntsParser;

impl TileContentParser for PntsParser {
    type RenderedMarker = RenderedCesium3dTileContentPntsMarker;
    type RequesterMarker = PntsDataRequesterMarker;

    fn parse(ctx: &mut ParseContext) -> Option<ParsedTileContent> {
        let (draco_compressed, positions_center, positions_handle) =
            get_geometry_info_from_pnts(ctx.buf, ctx.requester_handle)?;

        let transform = match ctx.tile_transform {
            Some(t) => *t,
            None => Transform::IDENTITY,
        };

        let tile_aabb = ctx.tile_aabb.cloned();

        Some(ParsedTileContent {
            coords: positions_center,
            crs: CRS::Geocentric,
            model_bin_handle: positions_handle,
            transform,
            feature_batch_id: FeatureBatchId(0),
            global_batch_ids: GlobalBatchIds {
                handle: Handle::default(),
                batch_length: 0,
            },
            appearance_modifier: Some(Box::new(move |appearance| {
                appearance.internal = Some(ModelInternalMaterial {
                    draco_compressed,
                    point_cloud: true,
                    point_cloud_geodetic_normal: Vec3::ZERO,
                });
            })),
            extra_components: tile_aabb.map(|aabb| {
                Box::new(
                    move |entity_commands: &mut bevy_ecs::system::EntityCommands| {
                        entity_commands.insert(aabb);
                    },
                ) as crate::tile_content_parser::ExtraComponentsInserter
            }),
        })
    }
}

pub(crate) fn get_geometry_info_from_pnts(
    buf: &mut BufferStore,
    handle: Handle,
) -> Option<(bool, Vec3, Handle)> {
    let pnts_bin = buf.get_u8(&handle)?;
    let mut pnts = Pnts::from_data(pnts_bin).ok()?;

    let feature_table_json: serde_json::Value =
        parse_json_to_struct(&pnts.feature_table.json).ok()?;

    // Find out if the pnts uses Draco compression
    let draco_compression_meta = feature_table_json["extensions"]
        .as_object()
        .and_then(|ext| {
            if let Some(draco_meta) = ext["3DTILES_draco_point_compression"].as_object() {
                let properties = draco_meta["properties"].as_object().unwrap();
                let byte_offset = draco_meta["byteOffset"].as_u64().unwrap();
                let byte_length = draco_meta["byteLength"].as_u64().unwrap();
                Some((properties, byte_offset, byte_length))
            } else {
                None
            }
        });

    let mut position_bin_data: Vec<u8>;
    let mut draco_compressed = false;
    if let Some((_, byte_offset, byte_length)) = draco_compression_meta {
        // Draco compression
        // extract the draco compressed data from featuretable's binary blob
        position_bin_data = pnts.feature_table.binary.split_off(byte_offset as usize);
        position_bin_data.truncate(byte_length as usize);
        draco_compressed = true;
    } else {
        // No Draco compression
        const N_POSITION_COMPONENTS: usize = 3;
        const N_POSITION_COMPONENTS_BYTE_SIZE: usize = 4;

        let positions_len = feature_table_json["POINTS_LENGTH"].as_u64()? as usize;
        let positions_offset = feature_table_json["POSITION"]["byteOffset"].as_u64()? as usize;
        let positions_byte_size =
            positions_len * N_POSITION_COMPONENTS * N_POSITION_COMPONENTS_BYTE_SIZE;

        // TODO: support color, normal, etc for non-draco compressed data.
        // extract the position data from featuretable's binary blob
        position_bin_data = pnts.feature_table.binary.split_off(positions_offset);
        position_bin_data.truncate(positions_byte_size);
    }

    let position_bin_handle = buf.new_u8(position_bin_data);

    // NOTE: buffer is removed here to prevent duplicating data.
    buf.remove(&handle);

    let positions_center: Vec<f64> = match feature_table_json["RTC_CENTER"].as_array() {
        Some(arr) => arr.iter().map(|e| e.as_f64().unwrap()).collect(),
        None => vec![0.0, 0.0, 0.0],
    };

    Some((
        draco_compressed,
        Vec3::new(
            positions_center[0],
            positions_center[1],
            positions_center[2],
        ),
        position_bin_handle,
    ))
}
