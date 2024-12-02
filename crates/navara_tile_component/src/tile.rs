use bevy_ecs::prelude::*;
use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_core::{
    get_ellipsoid_terrain_level_zero_maximum_geometric_error, get_level_maximum_geometric_error,
    Aabb, Ellipsoid, Extent, LngLat, Radians, TileRegion, TileXYZ, WGS84_32,
};
use navara_data_requester::{DataRequester, DataRequesterStatus};
use navara_geometry::{ReturnedConstructedTerrainMesh, UpsamplableTerrainGeometry};
use navara_math::Vec3;

use navara_mesh::CachedMeshHandle;
use navara_quadtree::children_coords;
use navara_texture_fragment::TextureFragmentStatus;

use crate::{
    data_requester::TileTerrainDataRequesterQuery, terrain::TerrainData,
    texture_fragment::TileTextureFragmentQuery, TileHandle, TileQuadtree,
};

use navara_layer::TerrainLayer;
use navara_math::FloatType;

use super::tile_bounding_region::TileBoundingRegion;

// Note Tile have to keep light size for caching efficiently.
// So if you want to store large data in this struct, use [`BufferStore`].
// And don't forget to destroy the stored data in [`Tile::destroy method`].
#[derive(Debug)]
pub struct Tile {
    pub coords: TileXYZ,
    pub extent: Extent<FloatType, Radians>,
    pub aabb: Aabb,
    pub bounding_region: Option<TileBoundingRegion<FloatType>>,
    pub children: Vec<TileHandle>,
    pub rendered_at: usize,
    pub visited_at: usize,
    pub terrain_data: Option<Box<dyn TerrainData>>,
    pub texture_fragment_entity_id: Option<Entity>,
    pub occludee_point_in_scaled_space: Option<Vec3>,
    pub cached_mesh_handle: Option<CachedMeshHandle>,
    /// Whether it's upsampled tile or not.
    pub upsampled: bool,
    pub max_height: FloatType,
    pub distance_from_camera: FloatType,
    pub sse: FloatType,
}

impl Clone for Tile {
    fn clone(&self) -> Self {
        Self {
            coords: self.coords,
            extent: self.extent,
            aabb: self.aabb.clone(),
            bounding_region: self.bounding_region.clone(),
            // Note: `children` needs to be updated dynamically.
            children: vec![],
            rendered_at: self.rendered_at,
            visited_at: self.visited_at,
            terrain_data: self.terrain_data.as_ref().map(|t| t.box_clone()),
            texture_fragment_entity_id: self.texture_fragment_entity_id,
            occludee_point_in_scaled_space: self.occludee_point_in_scaled_space,
            cached_mesh_handle: self.cached_mesh_handle.clone(),
            upsampled: self.upsampled,
            max_height: self.max_height,
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
    pub should_upsample: bool,
}

impl Tile {
    pub fn new(coords: TileXYZ, max_height: FloatType) -> Self {
        let extent = coords.extent();

        Self {
            coords,
            extent: coords.extent(),
            aabb: Aabb::from_extent_f32(extent, 0., max_height),
            bounding_region: Some(TileBoundingRegion::from_extent_f32(extent, WGS84_32)),
            rendered_at: 0,
            visited_at: 0,
            terrain_data: None,
            texture_fragment_entity_id: None,
            occludee_point_in_scaled_space: None,
            cached_mesh_handle: None,
            upsampled: false,
            children: Vec::with_capacity(4),
            max_height,
            distance_from_camera: 0.,
            sse: 0.,
        }
    }

    pub fn is_ready(
        &self,
        qt: &TileQuadtree,
        texture_fragment: &TileTextureFragmentQuery,
        terrain_data_requester: &TileTerrainDataRequesterQuery,
        terrain_layer: &Option<&TerrainLayer>,
    ) -> ReadyState {
        let is_texture_loaded = self.is_texture_ready(texture_fragment);

        let data_requester_entity_id = self
            .terrain_data
            .as_ref()
            .and_then(|t| t.data_requester_entity_id());

        // This means a terrain isn't used.
        if terrain_layer.is_none()
            && self.texture_fragment_entity_id.is_some()
            && data_requester_entity_id.is_none()
        {
            return ReadyState {
                is_tile_ready: is_texture_loaded,
                is_texture_ready: is_texture_loaded,
                ..Default::default()
            };
        }

        let is_terrain_ready = self.is_terrain_ready(terrain_data_requester);
        let should_upsample =
            self.should_upsampling(
                terrain_layer.map_or(1, |t| t.appearance.as_ref().unwrap().max_zoom),
            ) && self.is_upsamplable(qt, texture_fragment, terrain_data_requester, terrain_layer);

        // This tile isn't upsamplable and it doesn't have the terrain, it should be rendered without terrain.
        let should_be_rendered_without_terrain = !self.should_upsampling(
            terrain_layer.map_or(1, |t| t.appearance.as_ref().unwrap().max_zoom),
        ) && matches!(
            self.get_terrain_data_requester(terrain_data_requester)
                .map(|t| t.status),
            Some(DataRequesterStatus::Fail)
        );

        ReadyState {
            is_tile_ready: is_texture_loaded
                && (is_terrain_ready || (should_upsample || should_be_rendered_without_terrain)),
            // || terrain_layer.map_or(false, |l| self.coords.z > l.max_z))
            is_texture_ready: is_texture_loaded,
            is_terrain_ready,
            should_upsample,
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

    pub fn is_texture_ready(&self, texture_fragment: &TileTextureFragmentQuery) -> bool {
        let texture_fragment_status = self
            .texture_fragment_entity_id
            .map(|e| texture_fragment.get(e).map(|t| &t.1.status));
        texture_fragment_status.map_or(false, |s| matches!(s, Ok(TextureFragmentStatus::Success)))
    }

    pub fn is_terrain_ready(
        &self,
        terrain_data_requesters: &TileTerrainDataRequesterQuery,
    ) -> bool {
        let terrain_data_requester = self.get_terrain_data_requester(terrain_data_requesters);
        terrain_data_requester.map_or(false, |s| {
            // If the status is failed and parent is succeeded, we need to upsample the terrain mesh.
            matches!(s.status, DataRequesterStatus::Success)
        })
    }

    pub fn is_parent_ready(
        &self,
        qt: &TileQuadtree,
        texture_fragments: &TileTextureFragmentQuery,
        terrain_data_requesters: &TileTerrainDataRequesterQuery,
    ) -> bool {
        self.get_parent_tile(qt).map_or(false, |p| {
            p.is_texture_ready(texture_fragments)
                && (p.is_terrain_ready(terrain_data_requesters) || p.upsampled)
                && p.cached_mesh_handle.is_some()
        })
    }

    pub fn is_upsamplable(
        &self,
        qt: &TileQuadtree,
        texture_fragment: &TileTextureFragmentQuery,
        terrain_data_requester: &TileTerrainDataRequesterQuery,
        terrain_layer: &Option<&TerrainLayer>,
    ) -> bool {
        let terrain_req = self.get_terrain_data_requester(terrain_data_requester);
        terrain_layer.is_some()
            && (terrain_req.map_or(false, |t| matches!(t.status, DataRequesterStatus::Fail))
                // If parent tile is upsampled, we don't need to wait failed request.
                || self.get_parent_tile(qt).map_or(false, |t| t.upsampled))
            && self.is_parent_ready(qt, texture_fragment, terrain_data_requester)
    }

    pub fn should_upsampling(&self, max_zoom: usize) -> bool {
        // In low zoom level, we don't need to upsample it.
        self.coords.z >= max_zoom
    }

    pub fn get_parent_tile<'a>(&self, qt: &'a TileQuadtree) -> Option<&'a Self> {
        qt.qt
            .parent((self.coords.x, self.coords.y, self.coords.z))
            .and_then(|p| qt.qt.get(p.handle()))
    }

    fn get_region(&self, parent: &Tile) -> Option<TileRegion> {
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
        parent: &Tile,
        upsamplable_geometry: UpsamplableTerrainGeometry,
    ) -> Option<ReturnedConstructedTerrainMesh> {
        let region = match self.get_region(parent) {
            Some(r) => r,
            None => return None,
        };

        let mut upsampled_mesh = match self
            .terrain_data
            .as_ref()
            .and_then(|t| t.upsample(&region, upsamplable_geometry))
        {
            Some(u) => u,
            None => return None,
        };

        let (geometry, heights) = upsampled_mesh.construct_geometry(ellipsoid, &self.extent);

        Some(ReturnedConstructedTerrainMesh {
            geometry,
            heights,
            max_height: upsampled_mesh.max_height,
            min_height: upsampled_mesh.min_height,
        })
    }

    pub fn get_level_maximum_geometric_error(
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
        if let Some(fragment) = self.texture_fragment_entity_id {
            commands.entity(fragment).insert(Deleted);
            self.texture_fragment_entity_id = None;
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

    pub fn is_root(&self) -> bool {
        self.coords.x == 0 && self.coords.y == 0 && self.coords.z == 0
    }
}

/// Compute a terrain height at specified point.
pub fn compute_terrain_height_at_point(
    qt: &mut TileQuadtree,
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
    qt: &mut TileQuadtree,
    extent: Extent<f32, Radians>,
) -> (FloatType, FloatType) {
    let tiles = find_contained_children(qt, &|t| {
        t.extent.intersects(extent)
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

    // Set default height if terrain_data isn't found.
    if !has_terrain_data {
        min_height = 0.0;
        max_height = 5000.0;
    }

    (min_height, max_height)
}

/// Find a child that the tile contains.
fn find_contained_child(qt: &TileQuadtree, contain: &dyn Fn(&Tile) -> bool) -> Option<TileHandle> {
    let handle = qt.qt.zero().map(|l| l.handle());
    traverse_contained_child(qt, handle.and_then(|h| qt.qt.get(h)), handle, contain)
}

/// Find a child that the tile contains.
fn find_contained_children(qt: &TileQuadtree, contain: &dyn Fn(&Tile) -> bool) -> Vec<TileHandle> {
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
    qt: &TileQuadtree,
    tile: Option<&Tile>,
    handle: Option<TileHandle>,
    contain: &dyn Fn(&Tile) -> bool,
) -> Option<TileHandle> {
    let h = handle?;
    let tile = tile?;

    if !contain(tile) {
        return None;
    }

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
    qt: &TileQuadtree,
    tile: Option<&Tile>,
    handle: Option<TileHandle>,
    contain: &dyn Fn(&Tile) -> bool,
    result: &mut Vec<TileHandle>,
) -> Option<TileHandle> {
    let h = handle?;
    let tile = tile?;

    if !contain(tile) {
        return None;
    }

    for child in &tile.children {
        if let Some(v) =
            traverse_contained_children(qt, qt.qt.get(*child), Some(*child), contain, result)
        {
            result.push(v);
        }
    }

    if contain(tile) {
        return Some(h);
    }

    None
}

#[cfg(test)]
mod test {
    use navara_core::{Angle, LngLat, TileXYZ};
    use navara_quadtree::Coords;

    use super::TileQuadtree;

    use super::{find_contained_child, Tile};

    fn setup_tile(qt: &mut TileQuadtree, coords: Coords<usize>) {
        let children = qt.qt.initialize_children(coords, &|v| {
            Tile::new(
                TileXYZ {
                    x: v.0,
                    y: v.1,
                    z: v.2,
                },
                0.,
            )
        });
        let tile = qt.qt.get_mut(qt.qt.leaf(coords).unwrap().handle()).unwrap();
        tile.children = children.unwrap();
    }

    #[test]
    fn it_should_find_contained_tile() {
        let mut qt = TileQuadtree::new_with_linear_qt();

        qt.qt.initialize_zero(&|v| {
            Tile::new(
                TileXYZ {
                    x: v.0,
                    y: v.1,
                    z: v.2,
                },
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
}
