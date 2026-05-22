//! Generic construct system for all tile content formats.
//!
//! This system handles the common lifecycle of constructing model entities
//! from tile data. Format-specific parsing is delegated to `TileContentParser`
//! implementations.

use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_core::Aabb;
use navara_data_requester::{DataRequester, DataRequesterStatus};
use navara_feature_component::{
    batch::BatchTable,
    id::FeatureId,
    model::{ModelBin, ModelGeometry},
};
use navara_layer::{Cesium3dTilesLayer, LayerId};
use navara_material::Appearance;

use crate::{
    Cesium3dTileContentDataRequesterMarker, Cesium3dTilesTree, RenderedCesium3dTileContent,
    TileOrderByDistance, TileTransform,
    tile_content_parser::{ParseContext, TileContentParser},
};

/// Generic system that constructs model entities from tile data.
///
/// Triggered when a `RenderedCesium3dTileContent` with the format-specific
/// tile marker is added. Delegates parsing to `T::parse()` and handles
/// the common spawn logic.
#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn construct_model_by_cesium3dtiles_layer<T: TileContentParser>(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut batch_table_res: ResMut<BatchTable>,
    requesters: Query<
        (
            &Cesium3dTileContentDataRequesterMarker,
            &T::RequesterMarker,
            &DataRequester,
        ),
        Without<Deleted>,
    >,
    mut rendered_tiles: Query<
        (
            &mut RenderedCesium3dTileContent,
            Option<&TileTransform>,
            Option<&Aabb>,
            &TileOrderByDistance,
        ),
        (With<T::RenderedMarker>, Added<RenderedCesium3dTileContent>),
    >,
    layers: Query<(Entity, &Cesium3dTilesLayer)>,
    trees: Query<&Cesium3dTilesTree>,
) {
    for (mut tile, tile_transform, tile_aabb, _) in
        rendered_tiles.iter_mut().sort::<&TileOrderByDistance>()
    {
        let (_, _, req) = match requesters.get(tile.data_requester_id) {
            Ok(v) => v,
            Err(_) => continue,
        };
        // TODO: Handle fail
        if !matches!(req.status, DataRequesterStatus::Success) {
            continue;
        }
        let (_, layer) = match layers.get(tile.layer_id) {
            Ok(l) => l,
            Err(_) => continue,
        };
        let mut appearance = match &layer.appearances[0] {
            Appearance::Model(m) => m.clone(),
            _ => unimplemented!(),
        };
        appearance.should_rotate_in_default = false;
        appearance.clamp_to_ground = false;

        // Find tileset-level schema (needed for glTF Features)
        let tileset_schema = trees.iter().find_map(|tree| {
            if tree.layer_id == tile.layer_id {
                tree.schema.as_ref()
            } else {
                None
            }
        });

        // Copy handle before borrowing buf mutably (Handle is Copy/i32)
        let requester_handle = req.handle;

        let mut ctx = ParseContext {
            buf: &mut buf,
            batch_table: &mut batch_table_res,
            requester_handle,
            layer_id: &layer.layer_id,
            tile_transform: tile_transform.map(|t| &t.transform),
            tile_aabb,
            tileset_schema,
        };

        let parsed = match T::parse(&mut ctx) {
            Some(p) => p,
            None => continue,
        };

        // Apply format-specific appearance modifications
        if let Some(modifier) = parsed.appearance_modifier {
            modifier(&mut appearance);
        }

        // Spawn entity with common components
        let mut entity_commands = commands.spawn((
            LayerId(layer.layer_id.to_owned()),
            FeatureId::default(),
            parsed.feature_batch_id,
            parsed.global_batch_ids,
            ModelGeometry {
                coords: parsed.coords,
                crs: parsed.crs,
            },
            appearance,
            ModelBin(parsed.model_bin_handle),
            parsed.transform,
        ));

        // Apply format-specific extra components (e.g., Aabb for PNTS)
        if let Some(extra) = parsed.extra_components {
            extra(&mut entity_commands);
        }

        tile.feature_id = Some(entity_commands.id());
    }
}
