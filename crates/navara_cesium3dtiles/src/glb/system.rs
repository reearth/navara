//! GLB (Binary glTF) Tile Processing
//!
//! This module handles loading and rendering of GLB tiles, which are the
//! simplest tile format containing just 3D model data without batch tables.
//!
//! # GLB Format
//!
//! GLB is the binary container format for glTF 2.0 models. Unlike B3DM,
//! GLB tiles have no batch table or feature table - they're pure geometry.
//!
//! # Processing Pipeline
//!
//! 1. `RenderedCesium3dTileContent` + `RenderedCesium3dTileContentGlbMarker` spawned
//! 2. `construct_model_by_cesium3dtiles_layer` creates model entity
//! 3. `navara_feature::model::system::transfer_mesh` creates `RenderableFeature`
//! 4. `remove_invisible_rendered_tiles` handles visibility toggling
//!
//! # Visibility Optimization
//!
//! Unlike B3DM/PNTS, GLB tiles support visibility toggling without full
//! reconstruction. When a tile goes out of view but is still touched
//! (e.g., parent in REPLACE refinement), it's hidden rather than deleted.
//! This reduces reconstruction overhead for rapidly changing views.

use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::{BufferStore, Handle};
use navara_component::Deleted;
use navara_core::CRS;
use navara_data_requester::{DataRequester, DataRequesterStatus};
use navara_feature_component::{
    batch::{FeatureBatchId, GlobalBatchIds},
    id::FeatureId,
    model::{ModelBin, ModelGeometry},
    render::RenderableFeature,
};
use navara_layer::{Cesium3dTilesLayer, LayerId};
use navara_material::{Appearance, ModelMaterial};
use navara_math::{Quat, Transform, Vec3, PI_OVER_TWO};

use crate::{
    Cesium3dTileContentDataRequesterMarker, RenderedCesium3dTileContent, TileOrderByDistance,
};

use super::{requester::GlbDataRequesterMarker, RenderedCesium3dTileContentGlbMarker};

/// Constructs model entities from GLB tile data.
///
/// Triggered when a `RenderedCesium3dTileContent` with `RenderedCesium3dTileContentGlbMarker`
/// is added. Creates a simple model entity without batch table support.
///
/// # Spawned Components
///
/// - `LayerId` - Links to parent layer
/// - `FeatureId` - Unique feature identifier (default)
/// - `FeatureBatchId(0)` - No batch table
/// - `GlobalBatchIds` - Empty batch IDs
/// - `ModelGeometry` - Origin position (GLB uses embedded coords)
/// - `ModelMaterial` - Appearance settings
/// - `ModelBin` - Handle to GLB binary data
/// - `Transform` - Rotation adjustment (Y-up to Z-up)
#[allow(clippy::too_many_arguments)]
pub fn construct_model_by_cesium3dtiles_layer(
    mut commands: Commands,
    requesters: Query<
        (
            &Cesium3dTileContentDataRequesterMarker,
            &GlbDataRequesterMarker,
            &DataRequester,
        ),
        Without<Deleted>,
    >,
    mut rendered_tiles: Query<
        &mut RenderedCesium3dTileContent,
        (
            With<RenderedCesium3dTileContentGlbMarker>,
            Added<RenderedCesium3dTileContent>,
        ),
    >,
    layers: Query<(Entity, &Cesium3dTilesLayer)>,
) {
    for mut tile in &mut rendered_tiles {
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
        appearance.should_rotate_in_default = Some(false);
        appearance.clamp_to_ground = Some(false);

        let entity = commands.spawn((
            LayerId(layer.layer_id.to_owned()),
            FeatureId::default(),
            FeatureBatchId(0),
            GlobalBatchIds {
                handle: Handle::default(),
                batch_length: 0,
            },
            ModelGeometry {
                coords: Vec3::ZERO,
                crs: CRS::Geocentric,
            },
            appearance,
            ModelBin(req.handle),
            // TODO: Check asset property in tileset.json.
            // TODO: Clamp the height to terrain height.
            Transform::from_rotation(Quat::from_rotation_x(PI_OVER_TWO)),
        ));
        tile.feature_id = Some(entity.id());
    }
}

/// Handles visibility and cleanup of GLB tiles.
///
/// GLB tiles have a different strategy than B3DM/PNTS:
///
/// # Visibility Toggle (touched = true)
///
/// If the tile is still touched (e.g., parent waiting for children in REPLACE),
/// it's hidden via `RenderableFeature.active = false` rather than deleted.
/// This avoids reconstruction when the tile becomes visible again.
///
/// # Full Cleanup (touched = false, is_visible = false)
///
/// When a tile is no longer touched or visible:
/// 1. Feature entity marked with `Deleted`
/// 2. Renderable feature entity marked with `Deleted`
/// 3. Data requester buffer removed
/// 4. Data requester entity marked with `Deleted`
/// 5. Rendered tile entity despawned
#[allow(clippy::type_complexity, clippy::too_many_arguments)]
pub fn remove_invisible_rendered_tiles(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    requesters: Query<
        &DataRequester,
        (
            With<Cesium3dTileContentDataRequesterMarker>,
            With<GlbDataRequesterMarker>,
            Without<Deleted>,
        ),
    >,
    rendered_tiles: Query<
        (Entity, &RenderedCesium3dTileContent, &TileOrderByDistance),
        With<RenderedCesium3dTileContentGlbMarker>,
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
        if tile.touched {
            if let Some(id) = tile.feature_id {
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
        }

        if tile.is_visible || tile.touched {
            continue;
        }

        if let Some(feature_id) = tile.feature_id {
            commands.entity(feature_id).insert(Deleted);
            if let Ok(rendered_feature_id) = features.get(feature_id) {
                if let Some(rendered_feature_id) = rendered_feature_id.0 {
                    commands.entity(rendered_feature_id).insert(Deleted);
                }
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
