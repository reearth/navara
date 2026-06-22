use navara_core::TileXYZ;
use navara_geometry::TileUvTransform;
use navara_tile_component::{RasterTileQuadtree, TileTextureFragmentQuery, resolve_covering_tile};

/// A raster texture resolved for a terrain tile's layer: the texture fragment
/// entity plus an optional UV sub-rect when the texture comes from a coarser
/// ancestor (parent fallback) rather than the exact tile.
#[derive(Debug, Clone, Copy)]
pub struct ResolvedRasterTexture {
    pub entity: bevy_ecs::entity::Entity,
    /// `None` when the texture is the tile's own (identity UV).
    pub uv_transform: Option<TileUvTransform>,
}

/// Resolve the raster texture for a regular layer at the given WebMercator
/// `coords`, pulling from the raster quadtree.
///
/// Phase 1: the terrain tile and raster tile share the WebMercator scheme, so
/// the lookup is by identical coordinates. The covering-tile walk (exact tile,
/// then ancestor fallback with a power-of-two UV sub-rect) is the generic
/// [`resolve_covering_tile`]; this wrapper just supplies the
/// "is this layer's texture loaded" predicate.
pub fn resolve_raster_texture(
    qt: &RasterTileQuadtree,
    coords: TileXYZ,
    layer_index: usize,
    texture_fragment: &TileTextureFragmentQuery,
) -> Option<ResolvedRasterTexture> {
    resolve_covering_tile(qt, coords, |tile| {
        let entity = tile
            .texture_fragment_entity_ids
            .as_ref()
            .and_then(|ids| ids.get(layer_index).copied().flatten())?;
        // Raster textures are backed by a `TextureFragment`; only return the tile
        // once its fragment has finished loading.
        texture_fragment
            .get(entity)
            .is_ok_and(|t| t.1.is_succeeded())
            .then_some(entity)
    })
    .map(|(entity, uv_transform)| ResolvedRasterTexture {
        entity,
        uv_transform,
    })
}
