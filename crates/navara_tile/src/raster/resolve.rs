use navara_core::{Extent, Radians, TileXYZ, TilingScheme, overlapping_tiles_within_budget};
use navara_geometry::{TileUvTransform, uv_rect_from_extents};
use navara_math::FloatType;
use navara_tile_component::{RasterTileQuadtree, TileTextureFragmentQuery};
use rustc_hash::FxHashSet;

/// One WebMercator raster texture draped on a terrain tile: the texture fragment
/// entity, the affine UV mapping the terrain tile's `[0, 1]` UV into this raster
/// tile's texture, and the raster tile's geographic extent (used by the composite
/// shader to reproject the latitude axis when terrain and raster schemes differ).
#[derive(Debug, Clone, Copy)]
pub struct ResolvedRasterTexture {
    pub entity: bevy_ecs::entity::Entity,
    pub uv_transform: TileUvTransform,
    pub raster_extent: Extent<FloatType, Radians>,
}

/// Resolve the WebMercator raster tiles covering `terrain_extent` for one layer,
/// at the finest zoom `<= target_z` whose overlap fits `max_tiles` (the layer's
/// share of the terrain tile's raster texture-slot budget; see
/// [`overlapping_tiles_within_budget`]). Each overlapping WM tile contributes one
/// texture; a tile whose own fragment isn't loaded falls back to its nearest loaded
/// ancestor (several gaps may share one ancestor, which is emitted once), so the
/// result is at most `max_tiles` textures. For WebMercator terrain the overlap is a
/// single identity tile, matching the Phase 1 drape.
pub fn resolve_raster_textures(
    qt: &RasterTileQuadtree,
    terrain_extent: &Extent<FloatType, Radians>,
    target_z: usize,
    max_tiles: usize,
    layer_index: usize,
    texture_fragment: &TileTextureFragmentQuery,
) -> Vec<ResolvedRasterTexture> {
    let mut out = Vec::new();
    let mut resolved_coords: FxHashSet<TileXYZ> = FxHashSet::default();

    for coords in overlapping_tiles_within_budget(*terrain_extent, target_z, max_tiles) {
        let Some((entity, resolved)) =
            resolve_loaded_tile(qt, coords, layer_index, texture_fragment)
        else {
            continue;
        };
        // A coarser ancestor can back several of the requested tiles; drape it once.
        if !resolved_coords.insert(resolved) {
            continue;
        }

        let raster_extent = TilingScheme::WebMercator { tms: false }.tile_extent(resolved);
        out.push(ResolvedRasterTexture {
            entity,
            uv_transform: uv_rect_from_extents(*terrain_extent, raster_extent),
            raster_extent,
        });
    }

    out
}

/// Walk up from `coords` to the nearest tile (inclusive) whose `layer_index`
/// texture fragment has finished loading. Returns the fragment entity and the
/// coordinates of the tile it was found on.
fn resolve_loaded_tile(
    qt: &RasterTileQuadtree,
    coords: TileXYZ,
    layer_index: usize,
    texture_fragment: &TileTextureFragmentQuery,
) -> Option<(bevy_ecs::entity::Entity, TileXYZ)> {
    let (mut x, mut y, mut z) = (coords.x, coords.y, coords.z);
    loop {
        if let Some(leaf) = qt.qt.leaf((x, y, z))
            && let Some(tile) = qt.qt.get(leaf.handle())
            && let Some(entity) = tile
                .texture_fragment_entity_ids
                .as_ref()
                .and_then(|ids| ids.get(layer_index).copied().flatten())
            && texture_fragment
                .get(entity)
                .is_ok_and(|t| t.1.is_succeeded())
        {
            return Some((entity, TileXYZ { x, y, z }));
        }
        if z == 0 {
            return None;
        }
        z -= 1;
        x /= 2;
        y /= 2;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bevy_app::{App, Update};
    use bevy_ecs::prelude::{Res, ResMut, Resource};
    use navara_texture_fragment::{TextureFragment, TextureFragmentStatus};
    use navara_tile_component::{RasterTile, TileTextureFragmentMarker};

    #[derive(Resource, Default)]
    struct Out(Vec<ResolvedRasterTexture>);

    /// WebMercator terrain over its own tile resolves to a single identity drape
    /// (one texture, identity UV) — the Phase 1 behaviour the N:M path subsumes.
    #[test]
    fn resolve_wm_identity_single_texture() {
        let mut app = App::new();

        // Raster quadtree root (0,0,0) carrying a loaded texture for layer 0.
        let entity = app
            .world_mut()
            .spawn((
                TileTextureFragmentMarker(0),
                TextureFragment::with_status("u".into(), TextureFragmentStatus::Success),
            ))
            .id();

        let mut qt = RasterTileQuadtree::new_with_linear_qt();
        qt.qt
            .initialize_zero(&|(x, y, z)| RasterTile::new(TileXYZ { x, y, z }, 0., 0.));
        let handle = qt.qt.zero().unwrap().handle();
        qt.qt.get_mut(handle).unwrap().texture_fragment_entity_ids = Some(vec![Some(entity)]);

        // Terrain extent == the WM root tile extent.
        let terrain_extent =
            TilingScheme::WebMercator { tms: false }.tile_extent(TileXYZ { x: 0, y: 0, z: 0 });

        app.insert_resource(qt);
        app.init_resource::<Out>();
        app.add_systems(
            Update,
            move |raster_qt: Res<RasterTileQuadtree>,
                  texture_fragment: TileTextureFragmentQuery,
                  mut out: ResMut<Out>| {
                out.0 = resolve_raster_textures(
                    &raster_qt,
                    &terrain_extent,
                    0,
                    8,
                    0,
                    &texture_fragment,
                );
            },
        );
        app.update();

        let resolved = &app.world().resource::<Out>().0;
        assert_eq!(resolved.len(), 1);
        assert_eq!(resolved[0].entity, entity);
        // identity UV (terrain extent == raster extent).
        assert!((resolved[0].uv_transform.scale.x - 1.0).abs() < 1e-9);
        assert!((resolved[0].uv_transform.scale.y - 1.0).abs() < 1e-9);
        assert!(resolved[0].uv_transform.offset.x.abs() < 1e-9);
        assert!(resolved[0].uv_transform.offset.y.abs() < 1e-9);
    }

    /// Nothing loaded anywhere → no slots (the layer simply doesn't draw yet).
    #[test]
    fn resolve_empty_when_unloaded() {
        let mut app = App::new();
        let mut qt = RasterTileQuadtree::new_with_linear_qt();
        qt.qt
            .initialize_zero(&|(x, y, z)| RasterTile::new(TileXYZ { x, y, z }, 0., 0.));
        let terrain_extent =
            TilingScheme::WebMercator { tms: false }.tile_extent(TileXYZ { x: 0, y: 0, z: 0 });
        app.insert_resource(qt);
        app.init_resource::<Out>();
        app.add_systems(
            Update,
            move |raster_qt: Res<RasterTileQuadtree>,
                  texture_fragment: TileTextureFragmentQuery,
                  mut out: ResMut<Out>| {
                out.0 = resolve_raster_textures(
                    &raster_qt,
                    &terrain_extent,
                    0,
                    8,
                    0,
                    &texture_fragment,
                );
            },
        );
        app.update();
        assert!(app.world().resource::<Out>().0.is_empty());
    }
}
