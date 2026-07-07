//! Draping WebMercator texturized-vector tiles onto a terrain tile (N:M when the
//! terrain is Geographic). Mirrors the raster imagery resolve
//! (`navara_tile::raster::resolve_raster_textures`) using the shared WebMercator tile
//! helpers in `navara_core`. Bakeable tiles are found from each tile's
//! `ready_parent_tile_handle` — the self-inclusive nearest active tile the traverse records
//! from the live ECS activation state. Like raster (which keeps a loaded texture at every
//! level so its resolve never leaves a hole), the resolve covers each requested tile with the
//! rendered self, its finer rendered descendants, or its nearest rendered ancestor — so no
//! sub-region is left un-draped whether the vector rendered coarser OR finer than the
//! terrain-driven zoom. Pure over the quadtrees so it is unit-testable without an `App`;
//! `navara_ecs` gathers the terrain extent + per-layer quadtrees and calls in.

use navara_core::{
    Extent, Radians, TileXYZ, TilingScheme, overlapping_tiles_within_budget, wm_zoom_for_lng_span,
};
use navara_geometry::{TileUvTransform, uv_rect_from_extents_mercator};
use navara_math::FloatType;
use navara_tile_component::{TileHandle, VectorTileQuadtree};

/// Maximum WebMercator vector tiles baked into a single layer's render target for one
/// terrain tile. Draping WebMercator vector onto a Geographic terrain tile is N:M and the
/// overlap grows toward the poles. Every overlapping source for a layer is accumulated into
/// that layer's one render target (see the web `renderVectorScenes`), so this cap is
/// **per layer** and independent of how many layers are draped — unlike a GPU texture-slot
/// budget (each draped layer already gets its own render target, capped web-side by
/// `numTexturizedVector`). Beyond this the overlap query coarsens the zoom.
pub const VECTOR_DRAPE_OVERLAP_BUDGET: usize = 5;

/// Generous WebMercator zoom cap for the overlap query: the vector traverse only renders
/// up to its own max zoom, so [`resolve_vector_tiles`]' ancestor walk-up naturally stops
/// at the deepest rendered tile — no need to thread each layer's configured max zoom here.
const VECTOR_RESOLVE_MAX_ZOOM: usize = 30;

/// Total cap on drape sources gathered per layer for one terrain tile. When the vector
/// subdivided finer than `target_z`, each overlapping tile can fan out to several rendered
/// descendants; this bounds the offscreen bake work (all sources draw into the layer's one
/// render target). Deep over-subdivision beyond this is truncated — rare, since the vector's
/// SSE tracks the terrain relief.
const VECTOR_DRAPE_MAX_SOURCES: usize = 16;

/// One WebMercator texturized-vector tile draped on a terrain tile. Mirrors
/// `ResolvedRasterTexture` (the raster imagery resolve) for the clamp-to-ground vector pipeline:
/// `tile_handle` is the WM vector tile whose offscreen-rendered scene the web side keys
/// by, `uv_transform` maps the terrain tile's `[0, 1]` UV into that vector tile's frame,
/// and `vector_extent` lets the composite shader reproject the latitude axis when terrain
/// and vector schemes differ. Only bakeable tiles are returned — the ancestor walk-up
/// resolves each tile's recorded drape source (`ready_parent_tile_handle`) here — so the web
/// side never has to search for an ancestor to fall back to.
#[derive(Debug, Clone, Copy)]
pub struct ResolvedVectorTile {
    pub tile_handle: TileHandle,
    pub uv_transform: TileUvTransform,
    pub vector_extent: Extent<FloatType, Radians>,
}

/// One WebMercator texturized-vector tile to drape on a terrain tile, flattened across
/// layers for the wasm boundary (one entry per overlapping WM vector tile per layer).
#[derive(Debug, Clone)]
pub struct ResolvedVectorTileState {
    pub layer_id: String,
    pub tile_handle: TileHandle,
    /// Mercator affine UV framing the terrain tile's sub-region of this vector
    /// tile, for the offscreen **bake** camera (`uv_rect_from_extents_mercator`).
    pub uv_offset: [f32; 2],
    pub uv_scale: [f32; 2],
    /// Terrain `[south, north]` latitude (radians) for Mercator reprojection;
    /// `None` on WebMercator terrain (identity drape, no reprojection).
    pub reproject_terrain_lat: Option<[f32; 2]>,
}

/// Resolve, for every clamp-to-ground vector layer, the WebMercator tiles covering
/// `terrain_extent` and flatten them for the wasm boundary. Picks the overlap zoom from
/// the terrain tile's longitude span, caps each layer's overlap (the sources are baked into
/// one render target per layer, so the cap is per-layer), and attaches the Mercator
/// reprojection latitude band when the terrain is Geographic.
pub fn resolve_vector_tile_states(
    terrain_extent: Extent<FloatType, Radians>,
    terrain_is_geographic: bool,
    layers: &[(String, &VectorTileQuadtree)],
) -> Vec<ResolvedVectorTileState> {
    let lng_span = (terrain_extent.east - terrain_extent.west).val();
    let target_z = wm_zoom_for_lng_span(lng_span, VECTOR_RESOLVE_MAX_ZOOM);

    let reproject_terrain_lat = terrain_is_geographic.then(|| {
        [
            terrain_extent.south.val() as f32,
            terrain_extent.north.val() as f32,
        ]
    });

    // Per-layer overlap cap: each layer's sources are baked into its own render target,
    // so the budget is NOT divided across layers (that would collapse N:M draping to one
    // coarse source per layer when several layers are draped).
    let max_tiles = VECTOR_DRAPE_OVERLAP_BUDGET;

    let mut out = Vec::new();
    for (layer_id, qt) in layers {
        for r in resolve_vector_tiles(qt, &terrain_extent, target_z, max_tiles) {
            out.push(ResolvedVectorTileState {
                layer_id: layer_id.clone(),
                tile_handle: r.tile_handle,
                uv_offset: [
                    r.uv_transform.offset.x as f32,
                    r.uv_transform.offset.y as f32,
                ],
                uv_scale: [r.uv_transform.scale.x as f32, r.uv_transform.scale.y as f32],
                reproject_terrain_lat,
            });
        }
    }
    out
}

/// Resolve the WebMercator texturized-vector tiles covering `terrain_extent` for one layer.
/// For every overlapping WM tile at `target_z` (the terrain-driven zoom), gather the bakeable
/// drape sources that cover it via [`collect_drape_sources`]: the tile itself if rendered,
/// else its finer rendered descendants (the vector subdivided deeper than the terrain), else
/// its nearest rendered ancestor. Deduped (a shared ancestor is draped once) and capped at
/// [`VECTOR_DRAPE_MAX_SOURCES`] total. For WebMercator terrain the overlap is a single
/// identity tile.
pub fn resolve_vector_tiles(
    qt: &VectorTileQuadtree,
    terrain_extent: &Extent<FloatType, Radians>,
    target_z: usize,
    max_tiles: usize,
) -> Vec<ResolvedVectorTile> {
    let mut sources: Vec<(TileHandle, TileXYZ)> = Vec::new();
    for coords in overlapping_tiles_within_budget(*terrain_extent, target_z, max_tiles) {
        if sources.len() >= VECTOR_DRAPE_MAX_SOURCES {
            break;
        }
        collect_drape_sources(qt, coords, VECTOR_DRAPE_MAX_SOURCES, &mut sources);
    }

    let mut out = Vec::new();
    let mut resolved_coords: Vec<TileXYZ> = Vec::new();
    for (tile_handle, resolved) in sources {
        // A coarser ancestor can back several of the requested tiles; drape it once.
        if resolved_coords.contains(&resolved) {
            continue;
        }
        resolved_coords.push(resolved);

        let vector_extent = TilingScheme::WebMercator { tms: false }.tile_extent(resolved);
        out.push(ResolvedVectorTile {
            tile_handle,
            // Mercator UV: this drives the offscreen bake camera, which frames the
            // terrain tile's sub-region of the (mercator-laid-out) vector scene.
            uv_transform: uv_rect_from_extents_mercator(*terrain_extent, vector_extent),
            vector_extent,
        });
    }

    out
}

/// Gather the bakeable drape sources covering `coords` into `out` (appending `(handle,
/// coords)`), bounded so `out` never exceeds `cap`. Three cases, mirroring how raster keeps a
/// texture available at every level so its resolve never leaves a hole:
/// 1. `coords` exists and is (or contains) rendered tiles → its rendered self / finer
///    descendants (the vector subdivided deeper than the terrain-driven `target_z`; the
///    ancestor-only walk-up would miss these, leaving the latitude-row gaps this fixes).
/// 2. `coords` exists but nothing in its subtree is rendered → its nearest rendered ancestor
///    (`ready_parent_tile_handle`).
/// 3. `coords` doesn't exist (the vector rendered coarser than `target_z`) → walk up to the
///    nearest existing tile's recorded source.
fn collect_drape_sources(
    qt: &VectorTileQuadtree,
    coords: TileXYZ,
    cap: usize,
    out: &mut Vec<(TileHandle, TileXYZ)>,
) {
    if out.len() >= cap {
        return;
    }
    if let Some(leaf) = qt.qt.leaf((coords.x, coords.y, coords.z)) {
        // Case 1: prefer the requested tile's own rendered subtree (self or finer leaves).
        if collect_from_subtree(qt, leaf.handle(), coords, cap, out) {
            return;
        }
        // Case 2: nothing rendered at or below → its recorded coarser ancestor source.
        if let Some(src) = source_of(qt, leaf.handle()) {
            out.push(src);
        }
        return;
    }
    // Case 3: the requested tile doesn't exist → walk up to the nearest existing tile.
    let (mut x, mut y, mut z) = (coords.x, coords.y, coords.z);
    while z > 0 {
        z -= 1;
        x /= 2;
        y /= 2;
        if let Some(leaf) = qt.qt.leaf((x, y, z)) {
            if let Some(src) = source_of(qt, leaf.handle()) {
                out.push(src);
            }
            return;
        }
    }
}

/// Append the rendered drape sources in `handle`'s subtree (self-inclusive) to `out`, bounded
/// by `cap`. A tile is a source when it recorded ITSELF as its drape source
/// (`ready_parent_tile_handle == Some(self)`, i.e. its features are active); otherwise descend
/// to its existing children to reach the finer rendered tiles. Returns whether it pushed any.
fn collect_from_subtree(
    qt: &VectorTileQuadtree,
    handle: TileHandle,
    coords: TileXYZ,
    cap: usize,
    out: &mut Vec<(TileHandle, TileXYZ)>,
) -> bool {
    if out.len() >= cap {
        return false;
    }
    if qt
        .qt
        .get(handle)
        .is_some_and(|t| t.ready_parent_tile_handle == Some(handle))
    {
        out.push((handle, coords));
        return true;
    }
    let mut found = false;
    for (dx, dy) in [(0, 0), (1, 0), (0, 1), (1, 1)] {
        let child = TileXYZ {
            x: coords.x * 2 + dx,
            y: coords.y * 2 + dy,
            z: coords.z + 1,
        };
        if let Some(child_leaf) = qt.qt.leaf((child.x, child.y, child.z))
            && collect_from_subtree(qt, child_leaf.handle(), child, cap, out)
        {
            found = true;
        }
    }
    found
}

/// The tile's recorded drape source (`ready_parent_tile_handle`) and that source tile's
/// coordinates, if any.
fn source_of(qt: &VectorTileQuadtree, handle: TileHandle) -> Option<(TileHandle, TileXYZ)> {
    let src = qt.qt.get(handle)?.ready_parent_tile_handle?;
    Some((src, qt.qt.get(src)?.coords))
}

#[cfg(test)]
mod tests {
    use super::*;
    use navara_tile_component::VectorTile;

    /// A vector quadtree whose WebMercator root tile is its own bakeable drape source
    /// (the self-inclusive `ready_parent_tile_handle` the traverse would record once the
    /// root's features are active).
    fn qt_with_drape_source_root() -> VectorTileQuadtree {
        let mut qt = VectorTileQuadtree::new_with_linear_qt();
        qt.qt
            .initialize_zero(&|(x, y, z)| VectorTile::new(TileXYZ { x, y, z }, 0., 0.));
        let handle = qt.qt.zero().unwrap().handle();
        qt.qt.get_mut(handle).unwrap().ready_parent_tile_handle = Some(handle);
        qt
    }

    fn wm_root_extent() -> Extent<FloatType, Radians> {
        TilingScheme::WebMercator { tms: false }.tile_extent(TileXYZ { x: 0, y: 0, z: 0 })
    }

    /// WebMercator terrain over its own tile resolves to a single identity drape — the
    /// same-scheme behaviour the N:M path subsumes.
    #[test]
    fn resolve_wm_identity_single_tile() {
        let qt = qt_with_drape_source_root();
        let root_handle = qt.qt.zero().unwrap().handle();

        let resolved = resolve_vector_tiles(&qt, &wm_root_extent(), 0, 8);

        assert_eq!(resolved.len(), 1);
        assert_eq!(resolved[0].tile_handle, root_handle);
        assert!((resolved[0].uv_transform.scale.x - 1.0).abs() < 1e-9);
        assert!((resolved[0].uv_transform.scale.y - 1.0).abs() < 1e-9);
        assert!(resolved[0].uv_transform.offset.x.abs() < 1e-9);
        assert!(resolved[0].uv_transform.offset.y.abs() < 1e-9);
    }

    /// A Geographic terrain tile overlaps several WM vector tiles, but only the rendered
    /// root is selectable, so every overlap falls back to it and it is draped once.
    #[test]
    fn resolve_geographic_falls_back_to_rendered_ancestor() {
        let qt = qt_with_drape_source_root();
        let root_handle = qt.qt.zero().unwrap().handle();
        let geo = TilingScheme::Geographic { tms: false };
        let terrain_extent = geo.tile_extent(TileXYZ { x: 1, y: 0, z: 1 });

        let resolved = resolve_vector_tiles(&qt, &terrain_extent, 3, 8);

        assert_eq!(
            resolved.len(),
            1,
            "shared ancestor draped once: {resolved:?}"
        );
        assert_eq!(resolved[0].tile_handle, root_handle);
    }

    /// Nothing rendered anywhere → no slots (the layer simply doesn't draw yet).
    #[test]
    fn resolve_empty_when_nothing_rendered() {
        let mut qt = VectorTileQuadtree::new_with_linear_qt();
        qt.qt
            .initialize_zero(&|(x, y, z)| VectorTile::new(TileXYZ { x, y, z }, 0., 0.));

        assert!(resolve_vector_tiles(&qt, &wm_root_extent(), 0, 8).is_empty());
    }

    /// The flattened per-layer entry point: WebMercator terrain → identity drape per layer,
    /// no reprojection latitude band, layer id propagated.
    #[test]
    fn resolve_states_wm_identity_per_layer() {
        let qt = qt_with_drape_source_root();
        let layers = vec![("buildings".to_string(), &qt)];

        let states = resolve_vector_tile_states(wm_root_extent(), false, &layers);

        assert_eq!(states.len(), 1);
        assert_eq!(states[0].layer_id, "buildings");
        assert!(states[0].reproject_terrain_lat.is_none());
        assert!((states[0].uv_scale[0] - 1.0).abs() < 1e-6);
        assert!((states[0].uv_scale[1] - 1.0).abs() < 1e-6);
    }

    /// Geographic terrain attaches the `[south, north]` reprojection band; each layer keeps
    /// the full per-layer overlap budget (it is not divided across layers).
    #[test]
    fn resolve_states_geographic_attaches_reproject_per_layer() {
        let qt_a = qt_with_drape_source_root();
        let qt_b = qt_with_drape_source_root();
        let geo = TilingScheme::Geographic { tms: false };
        let terrain_extent = geo.tile_extent(TileXYZ { x: 1, y: 0, z: 1 });
        let layers = vec![("a".to_string(), &qt_a), ("b".to_string(), &qt_b)];

        let states = resolve_vector_tile_states(terrain_extent, true, &layers);

        assert!(!states.is_empty());
        for s in &states {
            let band = s.reproject_terrain_lat.expect("geographic → Some band");
            assert!(band[0] < band[1], "south < north: {band:?}");
        }
        // Both layers contribute (only the rendered root is selectable → one each).
        assert!(states.iter().any(|s| s.layer_id == "a"));
        assert!(states.iter().any(|s| s.layer_id == "b"));
    }

    /// Build a root + its four z=1 children.
    fn qt_root_with_children() -> (VectorTileQuadtree, TileHandle, TileHandle) {
        let mut qt = VectorTileQuadtree::new_with_linear_qt();
        let init = |(x, y, z): (usize, usize, usize)| VectorTile::new(TileXYZ { x, y, z }, 0., 0.);
        qt.qt.initialize_zero(&init);
        let root_handle = qt.qt.zero().unwrap().handle();
        qt.qt.initialize_children((0, 0, 0), &init);
        let child_handle = qt.qt.leaf((0, 0, 1)).unwrap().handle();
        (qt, root_handle, child_handle)
    }

    fn collect(qt: &VectorTileQuadtree, coords: TileXYZ) -> Vec<(TileHandle, TileXYZ)> {
        let mut out = Vec::new();
        collect_drape_sources(qt, coords, 16, &mut out);
        out
    }

    /// The requested tile is itself rendered → it is its own drape source.
    #[test]
    fn collect_returns_the_rendered_self() {
        let (mut qt, _root, child) = qt_root_with_children();
        qt.qt.get_mut(child).unwrap().ready_parent_tile_handle = Some(child);

        assert_eq!(
            collect(&qt, TileXYZ { x: 0, y: 0, z: 1 }),
            vec![(child, TileXYZ { x: 0, y: 0, z: 1 })]
        );
    }

    /// The vector rendered FINER than the requested (terrain-driven) zoom: the requested
    /// coarse tile isn't rendered but a descendant is → the walk descends to the rendered
    /// descendant instead of climbing past it. This is the fix for the latitude-row gaps.
    #[test]
    fn collect_walks_down_to_rendered_descendant() {
        let (mut qt, root, child) = qt_root_with_children();
        qt.qt.get_mut(child).unwrap().ready_parent_tile_handle = Some(child);
        qt.qt.get_mut(root).unwrap().ready_parent_tile_handle = None;

        assert_eq!(
            collect(&qt, TileXYZ { x: 0, y: 0, z: 0 }),
            vec![(child, TileXYZ { x: 0, y: 0, z: 1 })]
        );
    }

    /// The requested tile exists but neither it nor its subtree is rendered → its recorded
    /// coarser ancestor backs it (the "show the parent while children prepare" fallback).
    #[test]
    fn collect_falls_back_to_recorded_ancestor() {
        let (mut qt, root, child) = qt_root_with_children();
        qt.qt.get_mut(root).unwrap().ready_parent_tile_handle = Some(root);
        // Child not active itself, but records root as its ready ancestor (as the traverse
        // threads down); its own subtree has nothing rendered.
        qt.qt.get_mut(child).unwrap().ready_parent_tile_handle = Some(root);

        assert_eq!(
            collect(&qt, TileXYZ { x: 0, y: 0, z: 1 }),
            vec![(root, TileXYZ { x: 0, y: 0, z: 0 })]
        );
    }

    /// The requested tile doesn't exist (the vector rendered coarser than the requested zoom)
    /// → walk up to the nearest existing tile's recorded source.
    #[test]
    fn collect_walks_up_when_requested_tile_is_absent() {
        let qt = qt_with_drape_source_root(); // root only, its own source; no children.

        assert_eq!(
            collect(&qt, TileXYZ { x: 0, y: 0, z: 1 }),
            vec![(qt.qt.zero().unwrap().handle(), TileXYZ { x: 0, y: 0, z: 0 })]
        );
    }
}
