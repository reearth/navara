//! Generic cleanup system for all tile content formats.
//!
//! This system removes tiles that are no longer visible AND no longer
//! touched. Touched tiles (e.g., parents in REPLACE refinement waiting
//! for children to load) are preserved to avoid unnecessary reconstruction.

use bevy_ecs::{
    entity::Entity,
    query::{With, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_data_requester::DataRequester;
use navara_feature_component::{id::FeatureId, model::ModelGeometry, render::RenderableFeature};
use navara_layer::LayerId;
use navara_material::ModelMaterial;
use navara_math::Transform;

use crate::{
    Cesium3dTileContentDataRequesterMarker, RenderedCesium3dTileContent, TileOrderByDistance,
    tile_content_parser::TileContentParser,
};

/// Generic cleanup for all tile content formats.
///
/// Deletes all associated entities when the tile is no longer visible
/// and no longer touched. Touched tiles are preserved during REPLACE
/// refinement to avoid reconstruction when they become visible again.
#[allow(clippy::type_complexity, clippy::too_many_arguments)]
pub fn remove_invisible_rendered_tiles<T: TileContentParser>(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    requesters: Query<
        &DataRequester,
        (
            With<Cesium3dTileContentDataRequesterMarker>,
            With<T::RequesterMarker>,
            Without<Deleted>,
        ),
    >,
    rendered_tiles: Query<
        (Entity, &RenderedCesium3dTileContent, &TileOrderByDistance),
        With<T::RenderedMarker>,
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
        // Touched tiles are preserved — toggle visibility instead of deleting
        // TODO: Disabling this reduce memory usage, so we can provide an API to do it,
        //       but we don't implement it to follow the specification.
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
            // Avoid updating `RenderableFeature`, because it trigger some processes.
            let RenderableFeature::Model { active, .. } = renderable_feature.as_ref() else {
                continue;
            };
            if *active != tile.is_visible
                && let RenderableFeature::Model { active, .. } = renderable_feature.as_mut()
            {
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
