//! glTF with 3D Tiles 1.1 Extensions Processing
//!
//! This module handles loading and rendering of glTF tiles that contain
//! EXT_mesh_features and/or EXT_structural_metadata extensions (3D Tiles 1.1).
//!
//! # Differences from plain GLB (1.0)
//!
//! - Parses `EXT_mesh_features` to extract FeatureIdSets
//! - Parses `EXT_structural_metadata` to extract PropertyTables
//! - Generates batch IDs from the first (active) FeatureIdSet
//! - Registers property table in the BatchTable resource for picking/querying
//!
//! # Processing Pipeline
//!
//! 1. `RenderedCesium3dTileContent` + `RenderedCesium3dTileContentGltfFeaturesMarker` spawned
//! 2. `construct_model_by_cesium3dtiles_layer` parses glTF extensions and creates model entity
//! 3. `navara_feature::model::system::transfer_mesh` creates `RenderableFeature`
//! 4. `remove_invisible_rendered_tiles` handles visibility toggling (same as GLB)

use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use bevy_log::warn;
use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_core::CRS;
use navara_data_requester::{DataRequester, DataRequesterStatus};
use navara_feature_component::{
    batch::{BatchProperty, BatchTable, BatchTableValue, FeatureBatchId, GlobalBatchIds},
    id::FeatureId,
    model::{ModelBin, ModelGeometry},
    render::RenderableFeature,
};
use navara_layer::{Cesium3dTilesLayer, LayerId};
use navara_material::{Appearance, ModelMaterial};
use navara_math::{PI_OVER_TWO, Quat, Transform, Vec3};
use navara_parser::cesium3dtiles::property_table::GlbSchemaParser;

use crate::{
    Cesium3dTileContentDataRequesterMarker, Cesium3dTilesTree, RenderedCesium3dTileContent,
    TileOrderByDistance,
};

use super::{
    RenderedCesium3dTileContentGltfFeaturesMarker, requester::GltfFeaturesDataRequesterMarker,
};

/// Constructs model entities from glTF tiles with 1.1 extensions.
///
/// Triggered when a `RenderedCesium3dTileContent` with
/// `RenderedCesium3dTileContentGltfFeaturesMarker` is added.
///
/// Parses EXT_mesh_features and EXT_structural_metadata to extract
/// feature IDs and property tables, then maps them into the BatchTable
/// resource for unified picking/querying.
#[allow(clippy::too_many_arguments)]
pub fn construct_model_by_cesium3dtiles_layer(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut batch_table_res: ResMut<BatchTable>,
    requesters: Query<
        (
            &Cesium3dTileContentDataRequesterMarker,
            &GltfFeaturesDataRequesterMarker,
            &DataRequester,
        ),
        Without<Deleted>,
    >,
    mut rendered_tiles: Query<
        &mut RenderedCesium3dTileContent,
        (
            With<RenderedCesium3dTileContentGltfFeaturesMarker>,
            Added<RenderedCesium3dTileContent>,
        ),
    >,
    layers: Query<(Entity, &Cesium3dTilesLayer)>,
    trees: Query<&Cesium3dTilesTree>,
) {
    for mut tile in &mut rendered_tiles {
        let (_, _, req) = match requesters.get(tile.data_requester_id) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if !matches!(req.status, DataRequesterStatus::Success) {
            continue;
        }
        let (_, layer) = match layers.get(tile.layer_id) {
            Ok(l) => l,
            Err(_) => continue,
        };

        // Find tileset-level schema for this layer's trees
        let tileset_schema = trees.iter().find_map(|tree| {
            if tree.layer_id == tile.layer_id {
                tree.schema.as_ref()
            } else {
                None
            }
        });
        let mut appearance = match &layer.appearances[0] {
            Appearance::Model(m) => m.clone(),
            _ => unimplemented!(),
        };
        appearance.should_rotate_in_default = false;
        appearance.clamp_to_ground = false;

        // Parse the GLB to access glTF JSON and binary chunk
        let glb_bin = match buf.get_u8(&req.handle) {
            Some(bin) => bin,
            None => continue,
        };

        let glb_parser = match GlbSchemaParser::new(glb_bin) {
            Some(parser) => parser,
            None => {
                warn!("Failed to parse glTF JSON from GLB");
                continue;
            }
        };

        // Extract feature information from EXT_mesh_features
        let feature_count = glb_parser.feature_count();
        let property_table_index = glb_parser.property_table_index();

        // Generate global batch IDs from active feature set
        let mut global_batch_ids = Vec::with_capacity(feature_count as usize);
        for _ in 0..feature_count {
            let g_id = batch_table_res.gen_global_batch_id().unwrap_or(0);
            global_batch_ids.push(g_id);
        }

        // Extract and register property table if available
        let feature_batch_id = if feature_count > 0 {
            let property_table_data =
                property_table_index.and_then(|idx| glb_parser.property_table(idx, tileset_schema));

            let batch_property = property_table_data.map(BatchProperty::Cesium3dTilesetV11);

            batch_table_res
                .add(Some(BatchTableValue {
                    properties: batch_property,
                    layer_id: Some(layer.layer_id.clone()),
                }))
                .unwrap_or(0)
        } else {
            0
        };

        let batch_length = global_batch_ids.len();
        let ids_handle = buf.new_u32(global_batch_ids);

        let entity = commands.spawn((
            LayerId(layer.layer_id.to_owned()),
            FeatureId::default(),
            FeatureBatchId(feature_batch_id),
            GlobalBatchIds {
                handle: ids_handle,
                batch_length: batch_length as u32,
            },
            ModelGeometry {
                coords: Vec3::ZERO,
                crs: CRS::Geocentric,
            },
            appearance,
            ModelBin(req.handle),
            Transform::from_rotation(Quat::from_rotation_x(PI_OVER_TWO)),
        ));
        tile.feature_id = Some(entity.id());
    }
}

/// Handles visibility and cleanup of glTF 1.1 tiles.
///
/// Uses the same strategy as GLB tiles: toggle visibility when touched,
/// full cleanup when no longer touched or visible.
#[allow(clippy::type_complexity, clippy::too_many_arguments)]
pub fn remove_invisible_rendered_tiles(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    requesters: Query<
        &DataRequester,
        (
            With<Cesium3dTileContentDataRequesterMarker>,
            With<GltfFeaturesDataRequesterMarker>,
            Without<Deleted>,
        ),
    >,
    rendered_tiles: Query<
        (Entity, &RenderedCesium3dTileContent, &TileOrderByDistance),
        With<RenderedCesium3dTileContentGltfFeaturesMarker>,
    >,
    features: Query<
        &FeatureId,
        (
            With<LayerId>,
            With<ModelGeometry>,
            With<ModelMaterial>,
            With<Transform>,
        ),
    >,
    mut renderable_features: Query<&mut RenderableFeature>,
) {
    for (entity, tile, _) in &rendered_tiles {
        if tile.touched
            && let Some(id) = tile.feature_id
        {
            let mut renderable_feature = match features
                .get(id)
                .ok()
                .and_then(|renderable_feature_id| renderable_feature_id.0)
                .and_then(|renderable_feature_id| {
                    renderable_features.get_mut(renderable_feature_id).ok()
                }) {
                Some(renderable_feature) => renderable_feature,
                None => continue,
            };
            if let RenderableFeature::Model { active, .. } = renderable_feature.as_mut() {
                *active = tile.is_visible;
            }
            continue;
        }

        if tile.is_visible || tile.touched {
            continue;
        }

        if let Some(feature_id) = tile.feature_id {
            commands.entity(feature_id).insert(Deleted);
            if let Ok(rendered_feature_id) = features.get(feature_id)
                && let Some(rendered_feature_id) = rendered_feature_id.0
            {
                commands.entity(rendered_feature_id).insert(Deleted);
            }
        }

        // Remove data requester
        if let Ok(requester) = requesters.get(tile.data_requester_id) {
            buf.remove(&requester.handle);
            commands.entity(tile.data_requester_id).insert(Deleted);
        }

        commands.entity(entity).despawn();
    }
}
