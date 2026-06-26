use navara_core::{Extent, Radians, TileXYZ, TilingScheme, web_mercator_overlapping_tiles};
use navara_geometry::{TileUvTransform, uv_rect_from_extents};
use navara_math::FloatType;
use navara_tile_component::{RasterTileQuadtree, TileTextureFragmentQuery};

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

/// Pick the WebMercator zoom whose tiles roughly match a terrain tile of the
/// given longitude span, so one terrain tile overlaps only a handful of raster
/// tiles. A WM tile at zoom `z` spans `2π / 2^z` radians of longitude, so
/// `z = log2(2π / span)`. For WebMercator terrain this returns the terrain tile's
/// own zoom (identity drape). Clamped to the layer's `max_zoom`.
pub fn wm_zoom_for_lng_span(lng_span: FloatType, max_zoom: usize) -> usize {
    if lng_span <= 0. {
        return 0;
    }
    let z = (std::f64::consts::TAU / lng_span).log2().round();
    (z.max(0.) as usize).min(max_zoom)
}

/// The WebMercator tiles covering `terrain_extent`, at the finest zoom `<= target_z`
/// whose overlap count fits `max_tiles`. Draping WebMercator raster on a Geographic
/// terrain tile is N:M and the overlap grows toward the poles (Mercator compresses
/// latitude), so a single terrain tile can request more raster tiles than the
/// composite shader has slots for. Coarsening the zoom shrinks the count — each step
/// roughly halves the tile grid on both axes — so we drop to the finest zoom that
/// still fits the per-layer slot budget. At least one tile is always returned (a
/// `max_tiles` of 0 is treated as 1); the budget caps fan-out, it never drops a layer.
fn overlapping_tiles_within_budget(
    terrain_extent: &Extent<FloatType, Radians>,
    target_z: usize,
    max_tiles: usize,
) -> Vec<TileXYZ> {
    let budget = max_tiles.max(1);
    let mut z = target_z;
    loop {
        let tiles = web_mercator_overlapping_tiles(*terrain_extent, z);
        if tiles.len() <= budget || z == 0 {
            return tiles;
        }
        z -= 1;
    }
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
    let mut resolved_coords: Vec<TileXYZ> = Vec::new();

    for coords in overlapping_tiles_within_budget(terrain_extent, target_z, max_tiles) {
        let Some((entity, resolved)) =
            resolve_loaded_tile(qt, coords, layer_index, texture_fragment)
        else {
            continue;
        };
        // A coarser ancestor can back several of the requested tiles; drape it once.
        if resolved_coords.contains(&resolved) {
            continue;
        }
        resolved_coords.push(resolved);

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

    #[test]
    fn wm_zoom_matches_tile_lng_span() {
        // A WM tile at zoom z spans 2π/2^z radians; the helper recovers z.
        for z in [0usize, 3, 7, 12] {
            let span = std::f64::consts::TAU / (1u64 << z) as f64;
            assert_eq!(wm_zoom_for_lng_span(span, 30), z);
        }
        // Clamped to max_zoom.
        let tiny = std::f64::consts::TAU / (1u64 << 20) as f64;
        assert_eq!(wm_zoom_for_lng_span(tiny, 5), 5);
    }

    #[test]
    fn budget_coarsens_zoom_until_overlap_fits() {
        // A Geographic tile draped by WebMercator overlaps several WM tiles; pick a
        // zoom fine enough that the unbounded overlap exceeds a tight budget.
        let geo = TilingScheme::Geographic { tms: false };
        let extent = geo.tile_extent(TileXYZ { x: 1, y: 0, z: 3 });
        let target_z = wm_zoom_for_lng_span((extent.east - extent.west).val(), 30);

        let unbounded = web_mercator_overlapping_tiles(extent, target_z).len();
        assert!(unbounded >= 2, "need a multi-tile overlap to test the cap");

        // The budget caps the count and never coarsens past what's needed.
        for budget in 1..=unbounded {
            let tiles = overlapping_tiles_within_budget(&extent, target_z, budget);
            assert!(
                tiles.len() <= budget,
                "budget {budget} exceeded by {tiles:?}"
            );
            assert!(!tiles.is_empty());
            // The chosen zoom is the finest that fits: it never exceeds target_z.
            assert!(tiles.iter().all(|t| t.z <= target_z));
        }

        // A budget at/above the unbounded count leaves the target zoom untouched.
        let full = overlapping_tiles_within_budget(&extent, target_z, unbounded);
        assert_eq!(full.len(), unbounded);
        assert!(full.iter().all(|t| t.z == target_z));

        // A zero budget is treated as one tile, never an empty drape.
        assert!(!overlapping_tiles_within_budget(&extent, target_z, 0).is_empty());
    }

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
