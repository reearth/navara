use bevy_ecs::prelude::*;
use navara_buffer_store::BufferStore;
use navara_component::{Deleted, Order};
use navara_core::{
    Aabb, Ellipsoid, Extent, LngLat, Radians, TileRegion, TileXYZ, WGS84_64,
    get_ellipsoid_terrain_level_zero_maximum_geometric_error, get_level_maximum_geometric_error,
};
use navara_data_requester::{DataRequester, DataRequesterStatus};
use navara_geometry::{ReturnedConstructedTerrainMesh, UpsamplableTerrainGeometry};
use navara_math::Vec3;

use navara_mesh::CachedMeshHandle;
use navara_quadtree::{Coords, children_coords};

use crate::{
    RasterTileQuadtree, Tile, TileHandle, raster_tile_texture_fragment::TileTextureFragmentQuery,
    terrain::TerrainData, terrain_data_requester::TileTerrainDataRequesterQuery,
};

use navara_layer::{TerrainLayer, TilesLayer};
use navara_math::FloatType;

use super::tile_bounding_region::TileBoundingRegion;

// Note Tile have to keep light size for caching efficiently.
// So if you want to store large data in this struct, use [`BufferStore`].
// And don't forget to destroy the stored data in [`Tile::destroy method`].
#[derive(Debug)]
pub struct RasterTile {
    pub coords: TileXYZ,
    pub extent: Extent<FloatType, Radians>,
    pub aabb: Aabb,
    pub bounding_region: Option<TileBoundingRegion<FloatType>>,
    pub children: Vec<TileHandle>,
    pub were_children_rendered: bool,
    pub rendered_at: usize,
    pub visited_at: usize,
    pub terrain_data: Option<Box<dyn TerrainData>>,
    pub texture_fragment_entity_ids: Option<Vec<Option<Entity>>>,
    pub hillshade_entity_ids: Option<Vec<Option<Entity>>>,
    pub occludee_point_in_scaled_space: Option<Vec3>,
    pub cached_mesh_handle: Option<CachedMeshHandle>,
    /// Whether it's upsampled tile or not.
    pub upsampled: bool,
    pub max_height: f64,
    pub min_height: f64,
    pub distance_from_camera: FloatType,
    pub sse: FloatType,
}

impl Clone for RasterTile {
    fn clone(&self) -> Self {
        Self {
            coords: self.coords,
            extent: self.extent,
            aabb: self.aabb.clone(),
            bounding_region: self.bounding_region.clone(),
            // Note: `children` needs to be updated dynamically.
            children: vec![],
            were_children_rendered: false,
            rendered_at: self.rendered_at,
            visited_at: self.visited_at,
            terrain_data: self.terrain_data.as_ref().map(|t| t.box_clone()),
            texture_fragment_entity_ids: self.texture_fragment_entity_ids.clone(),
            hillshade_entity_ids: self.hillshade_entity_ids.clone(),
            occludee_point_in_scaled_space: self.occludee_point_in_scaled_space,
            cached_mesh_handle: self.cached_mesh_handle.clone(),
            upsampled: self.upsampled,
            max_height: self.max_height,
            min_height: self.min_height,
            distance_from_camera: 0.,
            sse: 0.,
        }
    }
}

#[derive(Default)]
pub struct ReadyState {
    pub is_tile_ready: bool,
    pub is_texture_ready: bool,
    pub is_terrain_ready: bool,
    pub is_upsamplable: bool,
}

impl RasterTile {
    pub fn new(coords: TileXYZ, max_height: FloatType, min_height: FloatType) -> Self {
        let extent = coords.extent();

        Self {
            coords,
            extent: coords.extent(),
            aabb: Aabb::from_extent_f64(extent, min_height, max_height),
            bounding_region: Some(TileBoundingRegion::from_extent_f64(extent, WGS84_64)),
            rendered_at: 0,
            visited_at: 0,
            terrain_data: None,
            texture_fragment_entity_ids: None,
            hillshade_entity_ids: None,
            occludee_point_in_scaled_space: None,
            cached_mesh_handle: None,
            upsampled: false,
            children: Vec::with_capacity(4),
            were_children_rendered: false,
            max_height,
            min_height,
            distance_from_camera: 0.,
            sse: 0.,
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn is_ready(
        &self,
        qt: &RasterTileQuadtree,
        texture_fragment: &TileTextureFragmentQuery,
        data_requesters: &Query<&navara_data_requester::DataRequester>,
        terrain_data_requester: &TileTerrainDataRequesterQuery,
        terrain_layer: &Option<&TerrainLayer>,
        has_tile_layer: bool,
        tiles: &Query<(&TilesLayer, &Order)>,
    ) -> ReadyState {
        let is_texture_loaded =
            self.is_texture_ready(texture_fragment, data_requesters, has_tile_layer);

        let data_requester_entity_id = self
            .terrain_data
            .as_ref()
            .and_then(|t| t.data_requester_entity_id());

        let use_terrain = terrain_layer
            .map(|l| l.is_over_min_zoom(self.coords.z))
            .unwrap_or(false);

        // This means a terrain isn't used.
        if !use_terrain
            && self
                .texture_fragment_entity_ids
                .as_ref()
                .is_some_and(|ids| !ids.is_empty())
            && data_requester_entity_id.is_none()
        {
            return ReadyState {
                is_tile_ready: true,
                is_texture_ready: is_texture_loaded,
                ..Default::default()
            };
        }

        // For ellipsoid terrain, terrain is always ready (no data loading needed)
        let is_ellipsoid_terrain = terrain_layer
            .map(|l| matches!(l.terrain_type, navara_layer::TerrainDataType::Ellipsoid))
            .unwrap_or(false);

        let is_terrain_ready = if is_ellipsoid_terrain {
            true
        } else {
            self.is_terrain_ready(terrain_data_requester)
        };

        let should_upsample = terrain_layer.is_some_and(|l| l.should_upsample(self.coords.z));

        let is_upsamplable =
            should_upsample && self.is_upsamplable(qt, terrain_data_requester, terrain_layer);

        // This tile isn't upsamplable and it doesn't have the terrain, it should be rendered without terrain.
        let should_be_rendered_without_terrain = !should_upsample
            && matches!(
                self.get_terrain_data_requester(terrain_data_requester)
                    .map(|t| t.status),
                Some(DataRequesterStatus::Fail)
            );

        // Check if any hillshade entity is ready
        // Also consider None entities as ready if they correspond to layers beyond max_zoom
        let is_hillshade_ready = self.hillshade_entity_ids.as_ref().is_some_and(|hill_ids| {
            hill_ids.iter().enumerate().any(|(i, &entity_opt)| {
                if let Some(entity) = entity_opt {
                    // Entity exists, check if it's ready
                    RasterTile::is_texture_entity_ready(entity, texture_fragment, data_requesters)
                } else {
                    // Entity is None, check if this layer is beyond max_zoom
                    tiles
                        .iter()
                        .sort::<&Order>()
                        .nth(i)
                        .is_some_and(|(layer, _)| {
                            layer.hillshade_config.is_some()
                                && layer.is_over_max_zoom(self.coords.z)
                        })
                }
            })
        });

        ReadyState {
            is_tile_ready: (is_terrain_ready
                || is_hillshade_ready
                || (is_upsamplable || should_be_rendered_without_terrain)),
            is_texture_ready: is_texture_loaded,
            is_terrain_ready,
            is_upsamplable,
        }
    }

    pub fn get_terrain_data_requester(
        &self,
        terrain_data_requester: &TileTerrainDataRequesterQuery,
    ) -> Option<DataRequester> {
        let data_requester_entity_id = self
            .terrain_data
            .as_ref()
            .and_then(|t| t.data_requester_entity_id());
        data_requester_entity_id.and_then(|e| {
            terrain_data_requester
                .get(e)
                .map_or(None, |d| Some(d.1.clone()))
        })
    }

    /// Check if a single texture entity is ready (either TextureFragment or DataRequester)
    pub fn is_texture_entity_ready(
        entity: Entity,
        texture_fragment: &TileTextureFragmentQuery,
        data_requesters: &Query<&navara_data_requester::DataRequester>,
    ) -> bool {
        // Check TextureFragment first
        if let Ok(t) = texture_fragment.get(entity) {
            return t.1.is_succeeded();
        }
        // Check DataRequester second (for hillshade)
        if let Ok(dr) = data_requesters.get(entity) {
            return dr.is_succeeded();
        }
        false
    }

    pub fn is_texture_ready(
        &self,
        texture_fragment: &TileTextureFragmentQuery,
        data_requesters: &Query<&navara_data_requester::DataRequester>,
        has_tile_layer: bool,
    ) -> bool {
        // If TileLayer is None, texture is considered ready
        if !has_tile_layer {
            return true;
        }

        self.texture_fragment_entity_ids
            .as_ref()
            .map(|e| {
                e.iter().any(|e| {
                    e.map(|entity| {
                        Self::is_texture_entity_ready(entity, texture_fragment, data_requesters)
                    })
                    .unwrap_or(false)
                })
            })
            .unwrap_or(false)
    }

    pub fn is_terrain_ready(
        &self,
        terrain_data_requesters: &TileTerrainDataRequesterQuery,
    ) -> bool {
        let terrain_data_requester = self.get_terrain_data_requester(terrain_data_requesters);
        terrain_data_requester.is_some_and(|s| {
            // If the status is failed and parent is succeeded, we need to upsample the terrain mesh.
            matches!(s.status, DataRequesterStatus::Success)
        })
    }

    pub fn is_parent_ready(
        &self,
        qt: &RasterTileQuadtree,
        terrain_data_requesters: &TileTerrainDataRequesterQuery,
    ) -> bool {
        self.get_parent_tile(qt).is_some_and(|p| {
            (p.is_terrain_ready(terrain_data_requesters) || p.upsampled)
                && p.cached_mesh_handle.is_some()
        })
    }

    pub fn is_upsamplable(
        &self,
        qt: &RasterTileQuadtree,
        terrain_data_requester: &TileTerrainDataRequesterQuery,
        terrain_layer: &Option<&TerrainLayer>,
    ) -> bool {
        terrain_layer.is_some() && self.is_parent_ready(qt, terrain_data_requester)
    }

    pub fn get_parent_tile<'a>(&self, qt: &'a RasterTileQuadtree) -> Option<&'a Self> {
        qt.qt
            .parent((self.coords.x, self.coords.y, self.coords.z))
            .and_then(|p| qt.qt.get(p.handle()))
    }

    fn get_region(&self, parent: &RasterTile) -> Option<TileRegion> {
        let parent_children_coords =
            children_coords((parent.coords.x, parent.coords.y, parent.coords.z));

        Some(match (self.coords.x, self.coords.y) {
            (x, y) if x == parent_children_coords[0].0 && y == parent_children_coords[0].1 => {
                TileRegion::NorthWest
            }
            (x, y) if x == parent_children_coords[1].0 && y == parent_children_coords[1].1 => {
                TileRegion::NorthEast
            }
            (x, y) if x == parent_children_coords[2].0 && y == parent_children_coords[2].1 => {
                TileRegion::SouthWest
            }
            (x, y) if x == parent_children_coords[3].0 && y == parent_children_coords[3].1 => {
                TileRegion::SouthEast
            }
            (_, _) => unreachable!(),
        })
    }

    // Steps of upsampling for the raster DEM.
    // 1. If the status of the request for the terrain is failed, check if the parent is succeeded or upsampled.
    // 2. If the tile has already been upsampled, use it
    // 3. Find a grid that matches with tile's extent. And get a binary from the grid area of the height-map.
    // 4. Store the binary into the BufferStore, and store the handle in the tile.
    pub fn upsample(
        &self,
        ellipsoid: Ellipsoid<FloatType>,
        parent: &RasterTile,
        upsamplable_geometry: UpsamplableTerrainGeometry,
    ) -> Option<ReturnedConstructedTerrainMesh> {
        let region = self.get_region(parent)?;

        let mut upsampled_mesh = self
            .terrain_data
            .as_ref()
            .and_then(|t| t.upsample(&region, upsamplable_geometry))?;

        let aabb = Aabb::from_extent_f64(
            self.extent,
            upsampled_mesh.min_height,
            upsampled_mesh.max_height,
        );
        let tile_center = aabb.center;

        // Generate geometry directly in local RTC space
        let (geometry, heights) =
            upsampled_mesh.construct_geometry(ellipsoid, &self.extent, &tile_center);

        Some(ReturnedConstructedTerrainMesh {
            geometry,
            heights,
            max_height: upsampled_mesh.max_height,
            min_height: upsampled_mesh.min_height,
            rtc_translation: Some(tile_center),
        })
    }

    // This function will be invoked before this tile is destroyed.
    pub fn destroy(
        &mut self,
        commands: &mut Commands,
        buf: &mut BufferStore,
        terrain_data_requester: &TileTerrainDataRequesterQuery,
    ) {
        if let Some(cached_mesh) = &self.cached_mesh_handle {
            buf.remove(&cached_mesh.vertices);
            buf.remove(&cached_mesh.indices);
            buf.remove(&cached_mesh.uvs);
            if let Some(h) = &cached_mesh.heights {
                buf.remove(h);
            }
            self.cached_mesh_handle = None;
        }

        if let Some(fragments) = self.texture_fragment_entity_ids.take() {
            for fragment in fragments.into_iter().flatten() {
                commands.entity(fragment).insert(Deleted);
            }
        }

        if let Some(hillshade_entities) = self.hillshade_entity_ids.take() {
            for hillshade_entity in hillshade_entities.into_iter().flatten() {
                commands.entity(hillshade_entity).insert(Deleted);
            }
        }

        if let Some(t) = &mut self.terrain_data {
            if let Some(e) = t.data_requester_entity_id() {
                let data_requester = terrain_data_requester.get(e).unwrap();
                buf.remove(&data_requester.1.handle);
                commands.entity(e).insert(Deleted);
                t.set_data_requester_entity_id(None);
            }
            t.destroy(buf);
        }
        self.upsampled = false;
    }
}

impl Tile for RasterTile {
    type CoordUnit = usize;

    fn aabb(&self) -> &Aabb {
        &self.aabb
    }

    fn bounding_region(&self) -> Option<&TileBoundingRegion<FloatType>> {
        self.bounding_region.as_ref()
    }

    fn coords(&self) -> &TileXYZ {
        &self.coords
    }

    fn extent(&self) -> &Extent<FloatType, Radians> {
        &self.extent
    }

    fn children(&self) -> &[TileHandle] {
        &self.children
    }

    fn set_children(&mut self, children: Vec<TileHandle>) {
        self.children = children;
    }

    fn occludee_point_in_scaled_space(&self) -> Option<&Vec3> {
        self.occludee_point_in_scaled_space.as_ref()
    }

    fn set_occludee_point_in_scaled_space(&mut self, p: Option<Vec3>) {
        self.occludee_point_in_scaled_space = p;
    }

    fn max_height(&self) -> f64 {
        self.terrain_data
            .as_ref()
            .and_then(|t| t.current_max_height())
            .unwrap_or(self.max_height)
    }
    fn min_height(&self) -> f64 {
        self.terrain_data
            .as_ref()
            .and_then(|t| t.current_min_height())
            .unwrap_or(self.min_height)
    }
    fn update_heights(&mut self, max_height: f64, min_height: f64) {
        if self.max_height == max_height && self.min_height == min_height {
            return;
        }
        self.max_height = max_height;
        self.min_height = min_height;
        if let Some(bounding_region) = &mut self.bounding_region {
            bounding_region.maximum_height = max_height;
            bounding_region.minimum_height = min_height;
        }
        self.aabb.update(self.extent, min_height, max_height);
        self.occludee_point_in_scaled_space = None;
    }

    fn has_terrain(&self) -> bool {
        self.terrain_data.is_some()
    }

    fn get_level_maximum_geometric_error(
        &self,
        ellipsoid: &Ellipsoid<FloatType>,
        height_map_width: FloatType,
    ) -> FloatType {
        get_level_maximum_geometric_error(
            self.coords.z,
            // TODO: Store the result of the level zero maximum geometric error to avoid too many caclulation.
            get_ellipsoid_terrain_level_zero_maximum_geometric_error(ellipsoid, height_map_width),
        )
    }

    fn new_child((x, y, z): Coords<Self::CoordUnit>, max_height: f64, min_height: f64) -> Self {
        Self::new(TileXYZ { x, y, z }, max_height, min_height)
    }
}

/// Compute a terrain height at specified point.
pub fn compute_terrain_height_at_point(
    qt: &mut RasterTileQuadtree,
    buf: &mut BufferStore,
    terrain_data_requesters: &TileTerrainDataRequesterQuery,
    point: &LngLat<FloatType, Radians>,
) -> Option<FloatType> {
    let tile_handle = find_contained_child(qt, &|t| {
        t.extent.contains(point) && t.cached_mesh_handle.is_some() && !t.upsampled
    })?;
    let tile = qt.qt.get_mut(tile_handle)?;

    tile.terrain_data.as_mut()?.compute_height_at_point(
        &tile.extent,
        buf,
        terrain_data_requesters,
        point,
    )
}

/// Compute a terrain height at specified point.
pub fn sample_terrain_height_within_extent(
    qt: &mut RasterTileQuadtree,
    extent: Extent<f64, Radians>,
) -> (FloatType, FloatType) {
    let tiles = find_contained_children(qt, &|t| {
        t.extent.intersects(extent)
            && extent.ratio(&t.extent) <= 1.
            && t.cached_mesh_handle.is_some()
            && !t.upsampled
            && t.terrain_data.is_some()
    });

    let mut max_height: FloatType = 0.;
    let mut min_height: FloatType = 9999.;
    let mut has_terrain_data = false;
    for tile_handle in tiles {
        let tile = qt.qt.get_mut(tile_handle);
        let terrain_data = match tile.and_then(|t| t.terrain_data.as_ref()) {
            Some(t) => t,
            None => continue,
        };
        if let (Some(min_terrain_height), Some(max_terrain_height)) = (
            terrain_data.current_min_height(),
            terrain_data.current_max_height(),
        ) {
            has_terrain_data = true;
            min_height = min_height.min(min_terrain_height);
            max_height = max_height.max(max_terrain_height);
        }
    }

    // Extrude more
    max_height *= 1.3;

    // If the difference is close, then it should be expanded.
    // Or set default height if terrain_data isn't found.
    {
        let diff = max_height - min_height;
        // Need to investigate more why we need to extrude
        // an additional height if the terrain closes to zero.
        let distance_from_surface = 2000.0;
        if diff <= distance_from_surface || !has_terrain_data {
            min_height = -distance_from_surface / 2.;
            max_height = distance_from_surface;
        }
    }

    (min_height, max_height)
}

/// Collect the deepest ready terrain tiles from the quadtree.
/// Returns handles of the deepest tiles (not necessarily quadtree leaves) that
/// have cached mesh, terrain data, and are not upsampled.
/// Used to batch-resolve terrain heights without per-point tree traversal.
pub fn collect_terrain_leaves(qt: &RasterTileQuadtree) -> Vec<TileHandle> {
    find_contained_children(qt, &|t| {
        t.cached_mesh_handle.is_some() && !t.upsampled && t.terrain_data.is_some()
    })
}

/// Find the deepest raster tile whose extent fully contains the given extent.
/// This is used to find the best-matching terrain tile for a vector tile feature,
/// avoiding per-point quadtree traversal.
///
/// Uses containment (not intersection) so the returned tile's DEM grid covers
/// all points within the given extent.
pub fn find_raster_tile_for_extent(
    qt: &RasterTileQuadtree,
    extent: &Extent<FloatType, Radians>,
) -> Option<TileHandle> {
    find_contained_child(qt, &|t| {
        t.extent.contains_extent(extent)
            && t.cached_mesh_handle.is_some()
            && !t.upsampled
            && t.terrain_data.is_some()
    })
}

/// Compute terrain height for a single point from a known tile.
/// Returns 0.0 if height cannot be determined.
pub fn compute_terrain_height_by_tile_handle(
    qt: &mut RasterTileQuadtree,
    buf: &mut BufferStore,
    terrain_data_requesters: &TileTerrainDataRequesterQuery,
    tile_handle: TileHandle,
    point: &LngLat<FloatType, Radians>,
) -> f64 {
    let Some(tile) = qt.qt.get_mut(tile_handle) else {
        return 0.0;
    };
    let extent = tile.extent;
    let Some(terrain_data) = tile.terrain_data.as_mut() else {
        return 0.0;
    };
    terrain_data
        .compute_height_at_point(&extent, buf, terrain_data_requesters, point)
        .unwrap_or(0.0)
}

/// Find a child that the tile contains.
fn find_contained_child(
    qt: &RasterTileQuadtree,
    contain: &dyn Fn(&RasterTile) -> bool,
) -> Option<TileHandle> {
    let handle = qt.qt.zero().map(|l| l.handle());
    traverse_contained_child(qt, handle.and_then(|h| qt.qt.get(h)), handle, contain)
}

/// Find a child that the tile contains.
fn find_contained_children(
    qt: &RasterTileQuadtree,
    contain: &dyn Fn(&RasterTile) -> bool,
) -> Vec<TileHandle> {
    let mut result = vec![];
    let handle = qt.qt.zero().map(|l| l.handle());
    traverse_contained_children(
        qt,
        handle.and_then(|h| qt.qt.get(h)),
        handle,
        contain,
        &mut result,
    );
    result
}

fn traverse_contained_child(
    qt: &RasterTileQuadtree,
    tile: Option<&RasterTile>,
    handle: Option<TileHandle>,
    contain: &dyn Fn(&RasterTile) -> bool,
) -> Option<TileHandle> {
    let h = handle?;
    let tile = tile?;

    for child in &tile.children {
        if let Some(v) = traverse_contained_child(qt, qt.qt.get(*child), Some(*child), contain) {
            return Some(v);
        }
    }

    if contain(tile) {
        return Some(h);
    }

    None
}

fn traverse_contained_children(
    qt: &RasterTileQuadtree,
    tile: Option<&RasterTile>,
    handle: Option<TileHandle>,
    contain: &dyn Fn(&RasterTile) -> bool,
    result: &mut Vec<TileHandle>,
) -> Option<TileHandle> {
    let h = handle?;
    let tile = tile?;

    let previous_result_len = result.len();

    for child in &tile.children {
        if let Some(v) =
            traverse_contained_children(qt, qt.qt.get(*child), Some(*child), contain, result)
        {
            result.push(v);
        }
    }

    if (previous_result_len == result.len()) && contain(tile) {
        return Some(h);
    }

    None
}

#[cfg(test)]
mod test {
    use navara_core::{Angle, LngLat, TileXYZ};
    use navara_quadtree::Coords;

    use super::RasterTileQuadtree;

    use super::{RasterTile, find_contained_child};

    fn setup_tile(qt: &mut RasterTileQuadtree, coords: Coords<usize>) {
        let children = qt.qt.initialize_children(coords, &|v| {
            RasterTile::new(
                TileXYZ {
                    x: v.0,
                    y: v.1,
                    z: v.2,
                },
                0.,
                0.,
            )
        });
        let tile = qt.qt.get_mut(qt.qt.leaf(coords).unwrap().handle()).unwrap();
        tile.children = children.unwrap();
    }

    #[test]
    fn it_should_find_contained_tile() {
        let mut qt = RasterTileQuadtree::new_with_linear_qt();

        qt.qt.initialize_zero(&|v| {
            RasterTile::new(
                TileXYZ {
                    x: v.0,
                    y: v.1,
                    z: v.2,
                },
                0.,
                0.,
            )
        });
        setup_tile(&mut qt, (0, 0, 0));
        setup_tile(&mut qt, (0, 0, 1));
        setup_tile(&mut qt, (1, 0, 1));
        setup_tile(&mut qt, (0, 1, 1));
        setup_tile(&mut qt, (1, 1, 1));

        let h = find_contained_child(&qt, &|t| {
            t.extent.contains(&LngLat {
                lng: Angle::new(2.5),
                lat: Angle::new(1.1),
            })
        });
        let child = qt.qt.get(h.unwrap());
        assert_eq!(child.unwrap().coords, TileXYZ { x: 3, y: 1, z: 2 });
    }

    use super::find_raster_tile_for_extent;
    use navara_mesh::CachedMeshHandle;

    /// Mark a tile as having terrain data and a cached mesh so it's eligible
    /// for `find_raster_tile_for_extent`.
    fn mark_tile_ready(qt: &mut RasterTileQuadtree, coords: Coords<usize>) {
        use crate::terrain::RasterDEMData;
        let handle = qt.qt.leaf(coords).unwrap().handle();
        let tile = qt.qt.get_mut(handle).unwrap();
        tile.cached_mesh_handle = Some(CachedMeshHandle {
            vertices: 0,
            indices: 0,
            uvs: 0,
            heights: None,
        });
        tile.terrain_data = Some(Box::new(RasterDEMData::default()));
    }

    fn setup_qt_with_ready_tiles() -> RasterTileQuadtree {
        let mut qt = RasterTileQuadtree::new_with_linear_qt();
        qt.qt.initialize_zero(&|v| {
            RasterTile::new(
                TileXYZ {
                    x: v.0,
                    y: v.1,
                    z: v.2,
                },
                0.,
                0.,
            )
        });
        setup_tile(&mut qt, (0, 0, 0));
        setup_tile(&mut qt, (0, 0, 1));
        setup_tile(&mut qt, (1, 0, 1));
        setup_tile(&mut qt, (0, 1, 1));
        setup_tile(&mut qt, (1, 1, 1));
        qt
    }

    #[test]
    fn find_raster_tile_for_extent_returns_deepest_matching_tile() {
        let mut qt = setup_qt_with_ready_tiles();

        // Mark a z=2 tile as ready (tile 3,1,2 covers roughly east/north quadrant)
        mark_tile_ready(&mut qt, (3, 1, 2));

        let tile_3_1_2 = qt.qt.get(qt.qt.leaf((3, 1, 2)).unwrap().handle()).unwrap();
        let target_extent = tile_3_1_2.extent;

        let result = find_raster_tile_for_extent(&qt, &target_extent);
        assert!(result.is_some());
        let found = qt.qt.get(result.unwrap()).unwrap();
        assert_eq!(found.coords, TileXYZ { x: 3, y: 1, z: 2 });
    }

    #[test]
    fn find_raster_tile_for_extent_returns_none_when_no_tile_ready() {
        let qt = setup_qt_with_ready_tiles();
        // No tiles are marked ready (no cached_mesh_handle or terrain_data)
        let extent = qt
            .qt
            .get(qt.qt.leaf((3, 1, 2)).unwrap().handle())
            .unwrap()
            .extent;
        let result = find_raster_tile_for_extent(&qt, &extent);
        assert!(result.is_none());
    }

    #[test]
    fn find_raster_tile_for_extent_skips_upsampled_tiles() {
        let mut qt = setup_qt_with_ready_tiles();
        mark_tile_ready(&mut qt, (3, 1, 2));

        // Mark the tile as upsampled
        let handle = qt.qt.leaf((3, 1, 2)).unwrap().handle();
        qt.qt.get_mut(handle).unwrap().upsampled = true;

        let extent = qt.qt.get(handle).unwrap().extent;
        let result = find_raster_tile_for_extent(&qt, &extent);
        assert!(result.is_none());
    }

    #[test]
    fn collect_terrain_leaves_returns_ready_tiles() {
        use super::collect_terrain_leaves;

        let mut qt = setup_qt_with_ready_tiles();

        // No tiles ready → empty
        assert!(collect_terrain_leaves(&qt).is_empty());

        // Mark two tiles as ready
        mark_tile_ready(&mut qt, (3, 1, 2));
        mark_tile_ready(&mut qt, (0, 0, 2));

        let leaves = collect_terrain_leaves(&qt);
        assert_eq!(leaves.len(), 2);
    }
}
