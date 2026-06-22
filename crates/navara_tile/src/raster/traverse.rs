use bevy_ecs::system::{Commands, Query};

use navara_camera::CameraFrustum;
use navara_component::{Order, Priority};
use navara_core::{Ellipsoid, TileXYZ};
use navara_fog::Fog;
use navara_frame::FrameManager;
use navara_layer::TilesLayer;
use navara_math::{FloatType, Transform};
use navara_occluder::ellipsoidal_occluder::EllipsoidalOccluder;
use navara_tile_component::{
    RasterTile, RasterTileQuadtree, TerrainInformationQuadtree, Tile, TileHandle,
    TileTextureFragmentQuery,
};
use navara_window::Window;

use super::request::request_raster_texture_fragment;
use super::tile_cache_manager::RasterTileCacheManager;

/// Borrow the terrain elevation for a WebMercator tile coordinate from the
/// terrain information quadtree (populated by the terrain pipeline). Raster tiles
/// are otherwise flat at height 0, which makes their screen-space error
/// underestimate detail on elevated terrain — so the raster stops subdividing
/// while the terrain keeps refining (e.g. via upsampling), leaving coarse
/// imagery on a detailed surface. Climbs to the nearest ancestor that has
/// rendered terrain info.
fn terrain_height(
    terrain_qt: &TerrainInformationQuadtree,
    coords: TileXYZ,
) -> (FloatType, FloatType) {
    let (mut x, mut y, mut z) = (coords.x, coords.y, coords.z);
    loop {
        if let Some(leaf) = terrain_qt.qt.leaf((x, y, z))
            && let Some(info) = terrain_qt.qt.get(leaf.handle())
        {
            return (info.max_height, info.min_height);
        }
        if z == 0 {
            return (0., 0.);
        }
        z -= 1;
        x /= 2;
        y /= 2;
    }
}

/// Raster (texture) tile traversal in the WebMercator quadtree.
///
/// Unlike the terrain traversal this is intentionally lenient and stateless:
/// raster tiles own no mesh and are never "rendered" directly — the terrain
/// tiles pull the resolved textures by extent at material-build time, walking up
/// to the nearest ready ancestor when a selected tile isn't loaded yet. So this
/// traversal only needs to:
///   1. mark visited tiles alive (so `clear_raster_caches` keeps the fallback
///      chain),
///   2. request the texture fragments along the selected LOD path (idempotent),
///   3. stop descending once the screen-space error is satisfied or all layers
///      are beyond their max zoom.
#[allow(clippy::too_many_arguments)]
pub fn traverse_raster(
    command: &mut Commands,
    tiles: &Query<(&TilesLayer, &Order)>,
    handle: TileHandle,
    qt: &mut RasterTileQuadtree,
    tc: &mut RasterTileCacheManager,
    terrain_qt: &TerrainInformationQuadtree,
    frame: &FrameManager,
    camera: &Transform,
    frustum: &CameraFrustum,
    window: &Window,
    ellipsoid: &Ellipsoid<FloatType>,
    occluder: &EllipsoidalOccluder,
    texture_fragment: &TileTextureFragmentQuery,
    fog: &Fog,
    max_sse: f64,
    terrain_present: bool,
) {
    let coords = match qt.qt.get(handle) {
        Some(tile) => tile.coords,
        None => return,
    };

    // Borrow the terrain elevation so the SSE matches the terrain's subdivision
    // depth instead of treating the tile as flat at sea level.
    let (max_height, min_height) = terrain_height(terrain_qt, coords);

    let tile = qt.qt.get_mut(handle).unwrap();
    tile.update_heights(max_height, min_height);
    tile.visited_at = frame.rendered_frame();
    tile.update_tile_occludee_point(ellipsoid, occluder);
    tc.active_handles.insert(handle);

    let is_culled_by_occlusion = !tile
        .occludee_point_in_scaled_space
        .map(|p| occluder.is_scaled_space_point_visible(p))
        .unwrap_or(true);
    if is_culled_by_occlusion {
        return;
    }

    let is_culled_by_frustum = !tile.intersect_with_camera_frustum(frustum);

    let distance_from_camera = tile.calc_distance_from_camera(camera, ellipsoid).abs();
    let sse = tile.calc_sse(
        frustum,
        window,
        ellipsoid,
        if terrain_present { 65. } else { 64. },
        distance_from_camera,
        fog,
    );
    let tile = qt.qt.get_mut(handle).unwrap();
    tile.sse = sse;
    tile.distance_from_camera = distance_from_camera;

    let coords_z = tile.coords.z;
    let is_over_min_z = tiles
        .iter()
        .filter(|(t, _)| t.hillshade_config.is_none())
        .any(|(t, _)| t.is_over_min_zoom(coords_z));

    // Request this level's textures along the selected path (idempotent: the
    // request helper skips layers that already have an in-flight/loaded
    // fragment). This gives the terrain pull a coarse fallback while finer
    // children load.
    if is_over_min_z {
        let tile = qt.qt.get_mut(handle).unwrap();
        request_raster_texture_fragment(
            command,
            tile,
            tiles,
            handle,
            texture_fragment,
            Priority::Medium,
        );
    }

    let meets_sse = sse <= max_sse && is_over_min_z;

    // Once the screen-space error is satisfied, stop: no need for finer tiles.
    // Beyond max zoom, the layer overscales (parent texture stretched), so we
    // also stop fetching new tiles there.
    let any_under_max = tiles
        .iter()
        .filter(|(t, _)| t.hillshade_config.is_none())
        .any(|(t, _)| !t.is_over_max_zoom(coords_z));
    if meets_sse || !any_under_max {
        return;
    }

    // Frustum-culled tiles do not descend.
    if is_culled_by_frustum {
        return;
    }

    if let Some(children) = RasterTile::traversable_children(qt, handle) {
        for child in children {
            traverse_raster(
                command,
                tiles,
                child,
                qt,
                tc,
                terrain_qt,
                frame,
                camera,
                frustum,
                window,
                ellipsoid,
                occluder,
                texture_fragment,
                fog,
                max_sse,
                terrain_present,
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use bevy_app::{App, Update};
    use bevy_ecs::prelude::{Res, ResMut, Resource};

    use navara_core::{Angle, ElevationDecoder, TileXYZ, WGS84_64, WGS84_A_64};
    use navara_layer::LayerData;
    use navara_material::{Appearance, HillshadeConfig, RasterTileMaterial};
    use navara_math::Vec3;
    use navara_texture_fragment::TextureFragment;
    use navara_tile_component::{TerrainInformation, TileTextureFragmentMarker};

    // ----- terrain_height -----------------------------------------------------

    /// Build a terrain-information quadtree with elevation set at the given
    /// `(coords, max_height, min_height)` entries. Leaves can be inserted at
    /// arbitrary coordinates without their ancestors (linear quadtree).
    fn terrain_qt_with(entries: &[(TileXYZ, f64, f64)]) -> TerrainInformationQuadtree {
        let mut qt = TerrainInformationQuadtree::new_with_linear_qt();
        for &(coords, max_height, min_height) in entries {
            qt.qt.initialize_leaf((coords.x, coords.y, coords.z), &|_| TerrainInformation {
                max_height,
                min_height,
            });
        }
        qt
    }

    #[test]
    fn terrain_height_returns_exact_match() {
        let qt = terrain_qt_with(&[(TileXYZ { x: 1, y: 2, z: 3 }, 1200., -30.)]);

        assert_eq!(
            terrain_height(&qt, TileXYZ { x: 1, y: 2, z: 3 }),
            (1200., -30.)
        );
    }

    #[test]
    fn terrain_height_climbs_to_nearest_ancestor() {
        // Info lives at the root and at z=1 (1,1,1). Querying a z=3 descendant of
        // (1,1,1) must borrow the *nearest* ancestor (z=1), not the root.
        let qt = terrain_qt_with(&[
            (TileXYZ { x: 0, y: 0, z: 0 }, 9999., -9999.),
            (TileXYZ { x: 1, y: 1, z: 1 }, 500., -10.),
        ]);

        // (7,7,3) -> (3,3,2) -> (1,1,1), the first ancestor that has info.
        assert_eq!(
            terrain_height(&qt, TileXYZ { x: 7, y: 7, z: 3 }),
            (500., -10.)
        );
    }

    #[test]
    fn terrain_height_falls_back_to_root() {
        // No intermediate info: the climb reaches the root and borrows its height.
        let qt = terrain_qt_with(&[(TileXYZ { x: 0, y: 0, z: 0 }, 42., -7.)]);

        assert_eq!(terrain_height(&qt, TileXYZ { x: 5, y: 5, z: 4 }), (42., -7.));
    }

    #[test]
    fn terrain_height_defaults_to_zero_when_absent() {
        // Nothing in the tree (not even the root): the climb bottoms out at z=0.
        let qt = terrain_qt_with(&[]);

        assert_eq!(terrain_height(&qt, TileXYZ { x: 5, y: 5, z: 4 }), (0., 0.));
    }

    // ----- traverse_raster ----------------------------------------------------

    /// The raster tile `traverse_raster` should visit. Passed via a resource so a
    /// single system can drive both the valid and the stale-handle scenarios.
    #[derive(Resource)]
    struct TargetHandle(TileHandle);

    /// Drives the screen-space-error threshold and `terrain_present` flag for the
    /// traversal so tests can force the "stop" vs "subdivide" decisions without
    /// fiddling with the camera geometry.
    #[derive(Resource)]
    struct TraverseConfig {
        max_sse: f64,
        terrain_present: bool,
    }

    /// Run `traverse_raster` from a Bevy system so its `Commands`/`Query`
    /// system-params are supplied. The camera sits at twice the Earth radius
    /// looking at the globe centre, which keeps the WebMercator root tile in view.
    #[allow(clippy::too_many_arguments)]
    fn run_traverse_system(
        mut commands: Commands,
        tiles: Query<(&TilesLayer, &Order)>,
        texture_fragment: TileTextureFragmentQuery,
        mut qt: ResMut<RasterTileQuadtree>,
        mut tc: ResMut<RasterTileCacheManager>,
        terrain_qt: Res<TerrainInformationQuadtree>,
        frame: Res<FrameManager>,
        window: Res<Window>,
        target: Res<TargetHandle>,
        config: Res<TraverseConfig>,
    ) {
        let camera_ecef = Vec3::new(WGS84_A_64 * 2.0, 0.0, 0.0);
        let camera = Transform::from_translation(camera_ecef).looking_at(Vec3::ZERO, Vec3::Y);
        let frustum = CameraFrustum::new(&camera, 0.1, 1e9, Angle::new(60.0).rad().val(), 1.0, 1.0);
        let occluder = EllipsoidalOccluder::new(&camera_ecef, WGS84_64);
        let fog = Fog {
            enabled: false,
            density: 0.,
            sse_factor: 1.0,
        };

        traverse_raster(
            &mut commands,
            &tiles,
            target.0,
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
            config.max_sse,
            config.terrain_present,
        );
    }

    /// App with the raster root tile, the terrain quadtree, and the supporting
    /// resources `traverse_raster` reads. `FramePlugin` advances the frame counter
    /// so `visited_at` becomes a meaningful non-zero value.
    fn app_with_root(terrain_qt: TerrainInformationQuadtree) -> (App, TileHandle) {
        let mut app = App::new();
        app.add_plugins(navara_frame::FramePlugin);

        let mut qt = RasterTileQuadtree::new_with_linear_qt();
        qt.qt
            .initialize_zero(&|(x, y, z)| RasterTile::new(TileXYZ { x, y, z }, 0., 0.));
        let handle = qt.qt.zero().unwrap().handle();
        app.insert_resource(qt);

        app.insert_resource(RasterTileCacheManager::default());
        app.insert_resource(terrain_qt);
        app.insert_resource(Window {
            width: 800.,
            height: 600.,
            pixel_ratio: 1.,
        });
        // Default: a huge SSE threshold so the root always satisfies the error and
        // the traversal stays at the root unless a test lowers it.
        app.insert_resource(TraverseConfig {
            max_sse: 1e30,
            terrain_present: false,
        });

        (app, handle)
    }

    /// A regular (non-hillshade) raster layer with the given zoom range.
    fn raster_layer(layer_id: &str, min_zoom: usize, max_zoom: usize) -> TilesLayer {
        TilesLayer {
            layer_id: layer_id.to_string(),
            data: Some(LayerData {
                url: "https://example.com/{z}/{x}/{y}.png".to_string(),
            }),
            appearance: Some(Appearance::TerrainTile(RasterTileMaterial {
                min_zoom,
                max_zoom,
                overscaled_max_zoom: max_zoom,
                ..Default::default()
            })),
            elevation_heatmap_config: None,
            hillshade_config: None,
        }
    }

    /// A hillshade layer. Hillshade is resolved on the terrain side, so the raster
    /// traversal must skip it entirely.
    fn hillshade_layer(layer_id: &str) -> TilesLayer {
        let mut layer = raster_layer(layer_id, 0, 20);
        layer.hillshade_config = Some(HillshadeConfig {
            elevation_decoder: ElevationDecoder::default(),
            exaggeration: 1.0,
        });
        layer
    }

    /// URLs of every (non-deleted) texture fragment currently in the world.
    fn requested_urls(app: &mut App) -> Vec<String> {
        let mut q = app.world_mut().query::<&TextureFragment>();
        let mut urls: Vec<String> = q.iter(app.world()).map(|t| t.url.clone()).collect();
        urls.sort();
        urls
    }

    #[test]
    fn traverse_raster_marks_root_visited_and_borrows_terrain_height() {
        let terrain_qt = {
            let mut qt = TerrainInformationQuadtree::new_with_linear_qt();
            qt.qt.initialize_zero(&|_| TerrainInformation {
                max_height: 1000.,
                min_height: -50.,
            });
            qt
        };
        let (mut app, handle) = app_with_root(terrain_qt);
        app.insert_resource(TargetHandle(handle));

        app.add_systems(Update, run_traverse_system);
        app.update();

        let frame = app.world().resource::<FrameManager>().rendered_frame();
        assert!(frame > 0, "FramePlugin should have advanced the frame");

        let qt = app.world().resource::<RasterTileQuadtree>();
        let tile = qt.qt.get(handle).unwrap();
        // The flat sea-level heights are replaced by the terrain elevation.
        assert_eq!((tile.max_height, tile.min_height), (1000., -50.));
        // The tile is stamped with the current frame...
        assert_eq!(tile.visited_at, frame);

        // ...and kept alive for the cache pruner.
        let tc = app.world().resource::<RasterTileCacheManager>();
        assert!(tc.active_handles.contains(&handle));
    }

    #[test]
    fn traverse_raster_ignores_unknown_handle() {
        let (mut app, _) = app_with_root(TerrainInformationQuadtree::new_with_linear_qt());

        // A handle the quadtree no longer holds: create a child leaf, capture its
        // handle, then drop it from the tree.
        let stale = {
            let mut qt = app.world_mut().resource_mut::<RasterTileQuadtree>();
            qt.qt
                .initialize_children((0, 0, 0), &|(x, y, z)| {
                    RasterTile::new(TileXYZ { x, y, z }, 0., 0.)
                });
            let stale = qt.qt.leaf((0, 0, 1)).unwrap().handle();
            qt.qt.remove(stale);
            stale
        };
        app.insert_resource(TargetHandle(stale));

        app.add_systems(Update, run_traverse_system);
        app.update();

        // Unknown handle is a no-op: nothing is marked alive.
        let tc = app.world().resource::<RasterTileCacheManager>();
        assert!(
            tc.active_handles.is_empty(),
            "an unknown handle must not touch the cache"
        );
    }

    // ----- tile requests ------------------------------------------------------

    #[test]
    fn traverse_raster_requests_texture_for_in_zoom_layer() {
        let (mut app, handle) = app_with_root(TerrainInformationQuadtree::new_with_linear_qt());
        app.insert_resource(TargetHandle(handle));
        app.world_mut().spawn((raster_layer("a", 0, 20), Order(0)));

        app.add_systems(Update, run_traverse_system);
        app.update();

        // Exactly one fragment, built from the root tile's own coordinates.
        assert_eq!(
            requested_urls(&mut app),
            vec!["https://example.com/0/0/0.png".to_string()]
        );

        // The fragment is tagged with the root tile handle...
        let mut markers = app.world_mut().query::<&TileTextureFragmentMarker>();
        let owners: Vec<TileHandle> = markers.iter(app.world()).map(|m| m.0).collect();
        assert_eq!(owners, vec![handle]);

        // ...and the tile records the entity in the single layer slot.
        let qt = app.world().resource::<RasterTileQuadtree>();
        let slots = qt
            .qt
            .get(handle)
            .unwrap()
            .texture_fragment_entity_ids
            .as_ref()
            .unwrap();
        assert_eq!(slots.len(), 1);
        assert!(slots[0].is_some());
    }

    #[test]
    fn traverse_raster_request_is_idempotent() {
        let (mut app, handle) = app_with_root(TerrainInformationQuadtree::new_with_linear_qt());
        app.insert_resource(TargetHandle(handle));
        app.world_mut().spawn((raster_layer("a", 0, 20), Order(0)));

        app.add_systems(Update, run_traverse_system);
        // Two passes with the same camera: the second must not re-spawn a fragment
        // for a layer that already has a queryable one.
        app.update();
        app.update();

        assert_eq!(
            requested_urls(&mut app),
            vec!["https://example.com/0/0/0.png".to_string()]
        );
    }

    #[test]
    fn traverse_raster_skips_hillshade_layer() {
        let (mut app, handle) = app_with_root(TerrainInformationQuadtree::new_with_linear_qt());
        app.insert_resource(TargetHandle(handle));
        // Regular layer at slot 0, hillshade layer at slot 1.
        app.world_mut().spawn((raster_layer("regular", 0, 20), Order(0)));
        app.world_mut().spawn((hillshade_layer("hill"), Order(1)));

        app.add_systems(Update, run_traverse_system);
        app.update();

        // Only the regular layer is fetched on the raster side.
        assert_eq!(
            requested_urls(&mut app),
            vec!["https://example.com/0/0/0.png".to_string()]
        );

        // The hillshade slot stays empty; the regular slot is filled.
        let qt = app.world().resource::<RasterTileQuadtree>();
        let slots = qt
            .qt
            .get(handle)
            .unwrap()
            .texture_fragment_entity_ids
            .as_ref()
            .unwrap();
        assert!(slots[0].is_some(), "regular layer slot should be requested");
        assert!(slots[1].is_none(), "hillshade slot must stay None");
    }

    #[test]
    fn traverse_raster_skips_layer_below_min_zoom() {
        let (mut app, handle) = app_with_root(TerrainInformationQuadtree::new_with_linear_qt());
        app.insert_resource(TargetHandle(handle));
        // A layer that only exists from zoom 2 upward. The root (z=0) and z=1 are
        // below its min zoom, so requests must only appear once the traversal
        // reaches z=2 (subdivision is forced to reach the layer's data).
        app.world_mut().spawn((raster_layer("a", 2, 20), Order(0)));

        app.add_systems(Update, run_traverse_system);
        app.update();

        let urls = requested_urls(&mut app);
        assert!(!urls.is_empty(), "the layer should be fetched at its min zoom");
        assert!(
            urls.iter().all(|u| u.starts_with("https://example.com/2/")),
            "no fetch below min zoom; got {urls:?}"
        );
    }

    // ----- screen-space error & max zoom subdivision --------------------------

    #[test]
    fn traverse_raster_stops_when_sse_satisfied() {
        let (mut app, handle) = app_with_root(TerrainInformationQuadtree::new_with_linear_qt());
        app.insert_resource(TargetHandle(handle));
        app.world_mut().spawn((raster_layer("a", 0, 20), Order(0)));
        // Huge threshold: the root's error is always acceptable.
        app.insert_resource(TraverseConfig {
            max_sse: 1e30,
            terrain_present: false,
        });

        app.add_systems(Update, run_traverse_system);
        app.update();

        // No subdivision: the z=1 children were never created.
        let qt = app.world().resource::<RasterTileQuadtree>();
        assert!(qt.qt.leaf((0, 0, 1)).is_none());
        let tc = app.world().resource::<RasterTileCacheManager>();
        assert_eq!(tc.active_handles.len(), 1);
    }

    #[test]
    fn traverse_raster_subdivides_when_sse_exceeds_threshold() {
        let (mut app, handle) = app_with_root(TerrainInformationQuadtree::new_with_linear_qt());
        app.insert_resource(TargetHandle(handle));
        // max_zoom=2 bounds how deep the forced subdivision goes.
        app.world_mut().spawn((raster_layer("a", 0, 2), Order(0)));
        // Zero threshold: the error is never satisfied, so the traversal descends.
        app.insert_resource(TraverseConfig {
            max_sse: 0.,
            terrain_present: false,
        });

        app.add_systems(Update, run_traverse_system);
        app.update();

        // The root was subdivided into its children.
        let qt = app.world().resource::<RasterTileQuadtree>();
        assert!(qt.qt.leaf((0, 0, 1)).is_some(), "root should have subdivided");
        let tc = app.world().resource::<RasterTileCacheManager>();
        assert!(tc.active_handles.len() > 1, "children must be visited");
    }

    #[test]
    fn traverse_raster_stops_subdividing_at_max_zoom() {
        let (mut app, handle) = app_with_root(TerrainInformationQuadtree::new_with_linear_qt());
        app.insert_resource(TargetHandle(handle));
        // Layer maxes out at zoom 0, so even an unsatisfiable error must not fetch
        // finer tiles past the max zoom.
        app.world_mut().spawn((raster_layer("a", 0, 0), Order(0)));
        app.insert_resource(TraverseConfig {
            max_sse: 0.,
            terrain_present: false,
        });

        app.add_systems(Update, run_traverse_system);
        app.update();

        // Beyond max zoom there is no subdivision despite the zero threshold.
        let qt = app.world().resource::<RasterTileQuadtree>();
        assert!(qt.qt.leaf((0, 0, 1)).is_none(), "must not descend past max zoom");
        let tc = app.world().resource::<RasterTileCacheManager>();
        assert_eq!(tc.active_handles.len(), 1);
    }
}
