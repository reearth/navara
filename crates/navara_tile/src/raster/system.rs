use bevy_ecs::prelude::*;

use navara_camera::{CameraFrustum, CameraMarker};
use navara_component::{Deleted, Ignored, Order, OrderByDistance, Priority, Requested};
use navara_core::{TileXYZ, TilingScheme, WGS84_64};
use navara_fog::Fog;
use navara_frame::FrameManager;
use navara_math::Transform;
use navara_occluder::ellipsoidal_occluder::EllipsoidalOccluder;
use navara_texture_fragment::TextureFragment;
use navara_tile_component::{
    ChangedTileTextureFragmentQuery, RasterTile, RasterTileQuadtree, TerrainTileQuadtree,
    TileTextureFragmentMarker, TileTextureFragmentQuery,
};
use navara_window::Window;

use navara_layer::{TerrainLayer, TilesLayer};

use super::tile_cache_manager::RasterTileCacheManager;
use super::traverse::traverse_raster;

const MAX_PENDINGS: u32 = 50;

/// Rate-limit raster texture fragment requests. Regular textures belong to the
/// raster quadtree, so the rejected slot is cleared against `RasterTileQuadtree`
/// (using the fragment's `TileTextureFragmentMarker`, whose handle indexes the
/// raster quadtree for these entities).
#[allow(clippy::type_complexity)]
pub fn filter_requestable_raster_texture_fragment(
    mut commands: Commands,
    mut qt: ResMut<RasterTileQuadtree>,
    fragments: Query<
        (
            Entity,
            &TileTextureFragmentMarker,
            &OrderByDistance,
            &Priority,
        ),
        (
            With<TextureFragment>,
            Added<TileTextureFragmentMarker>,
            Without<Deleted>,
        ),
    >,
    requested_fragments: Query<Entity, (With<TextureFragment>, With<Requested>, Without<Deleted>)>,
) {
    let pendings = requested_fragments.iter().count();
    let num_skip = (MAX_PENDINGS as i32 - pendings as i32).max(0);

    for (e, marker, _, _) in fragments
        .iter()
        .sort::<(&Priority, &OrderByDistance)>()
        .skip(num_skip as usize)
    {
        let handle = marker.0;
        if let Some(tile) = qt.qt.get_mut(handle) {
            commands.entity(e).insert((Deleted, Ignored));

            // Clear the rejected slot to None so the next request pass can
            // re-spawn an entity for the same layer index.
            if let Some(tex_ids) = tile.texture_fragment_entity_ids.as_mut()
                && let Some(slot) = tex_ids
                    .iter_mut()
                    .find(|id| matches!(id, Some(id) if *id == e))
            {
                *slot = None;
            }
        }
    }
}

/// Initialize the WebMercator root of the raster quadtree once raster (texture)
/// layers exist. Raster tiles are always WebMercator (single root).
pub fn init_raster_tiling(tiles: Query<(&TilesLayer, &Order)>, mut qt: ResMut<RasterTileQuadtree>) {
    let has_raster_layers = tiles.iter().any(|(t, _)| t.hillshade_config.is_none());
    if !has_raster_layers {
        return;
    }

    for root in (TilingScheme::WebMercator { tms: false }).root_tiles() {
        let coords = (root.x, root.y, root.z);
        if qt.qt.leaf(coords).is_none() {
            qt.qt.initialize_leaf(coords, &|(x, y, z)| {
                RasterTile::new(TileXYZ { x, y, z }, 0., 0.)
            });
        }
    }
}

/// Drives raster tile traversal: select the LOD tiles by screen-space error and
/// request their textures. The resolved textures are later pulled into terrain
/// tiles by extent (see `update_mesh_material`).
#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn update_raster_tiles(
    mut commands: Commands,
    mut qt: ResMut<RasterTileQuadtree>,
    mut tc: ResMut<RasterTileCacheManager>,
    terrain_qt: Res<TerrainTileQuadtree>,
    frame: Res<FrameManager>,
    window: Res<Window>,
    globe: Res<navara_globe::Globe>,
    source_store: Res<navara_source::SourceStore>,
    tiles: Query<(&TilesLayer, &Order)>,
    terrain_layer: Query<&TerrainLayer>,
    texture_fragment: TileTextureFragmentQuery,
    changed_texture_fragment: ChangedTileTextureFragmentQuery,
    mut camera_set: ParamSet<(
        Query<(Ref<Transform>, Ref<CameraFrustum>), With<CameraMarker>>,
        Query<&Fog>,
    )>,
    occluder: Query<Ref<EllipsoidalOccluder>>,
) {
    let tiles_len = tiles.iter().len();
    let has_raster_layers = tiles.iter().any(|(t, _)| t.hillshade_config.is_none());
    if !has_raster_layers {
        tc.prev_layers_len = tiles_len;
        return;
    }

    let is_texture_fragment_changed = !changed_texture_fragment.is_empty();
    let is_layers_len_changed = tiles_len != tc.prev_layers_len;

    let occluder = match occluder.iter().next() {
        Some(o) => o,
        None => return,
    };

    let fog = camera_set.p1().single().unwrap().clone();
    let camera = camera_set.p0();
    let (camera, frustum) = match camera.single() {
        Ok(c) => c,
        Err(_) => return,
    };

    let needs_update = is_texture_fragment_changed
        // Terrain heights feed the raster SSE, so a terrain change must
        // re-traverse even when the camera is static (matches the vector pipeline).
        || terrain_qt.is_changed()
        || camera.is_added()
        || camera.is_changed()
        || frustum.is_changed()
        || occluder.is_changed()
        || is_layers_len_changed;
    if !needs_update {
        return;
    }

    tc.last_rendered_frame = frame.rendered_frame();
    tc.prev_layers_len = tiles_len;
    tc.is_updated_in_this_frame = true;

    let terrain_present = terrain_layer.iter().next().is_some();

    // Sort the layer list once per run; the traversal touches every visited tile.
    let sorted_layers: Vec<_> = tiles.iter().sort::<&Order>().collect();

    let root_coords = (TilingScheme::WebMercator { tms: false }).root_tiles();
    for root in &root_coords {
        let coords = (root.x, root.y, root.z);
        let Some(root_handle) = qt.qt.leaf(coords).map(|n| n.handle()) else {
            continue;
        };

        traverse_raster(
            &mut commands,
            &sorted_layers,
            &source_store,
            root_handle,
            &mut qt,
            &mut tc,
            &terrain_qt,
            &frame,
            &camera,
            &frustum,
            &window,
            &WGS84_64,
            &occluder,
            &texture_fragment,
            &fog,
            globe.max_sse as f64,
            terrain_present,
        );
    }
}

/// Prune raster tiles not visited in the latest traversal. Mirrors the terrain
/// `clear_caches` lifetime rule (kept for one extra frame to avoid thrashing).
pub fn clear_raster_caches(
    mut commands: Commands,
    mut qt: ResMut<RasterTileQuadtree>,
    mut tc: ResMut<RasterTileCacheManager>,
) {
    if !tc.is_updated_in_this_frame {
        return;
    }
    tc.is_updated_in_this_frame = false;

    let last_frame = tc.last_rendered_frame;
    let mut stale = vec![];
    for handle in tc.active_handles.iter() {
        let visited_at = match qt.qt.get(*handle) {
            Some(t) => t.visited_at,
            None => {
                stale.push(*handle);
                continue;
            }
        };
        if last_frame > visited_at + 1 {
            stale.push(*handle);
        }
    }

    for handle in stale {
        tc.active_handles.remove(&handle);
        if let Some(mut tile) = qt.qt.remove(handle) {
            tile.destroy(&mut commands);
        }
    }
}
