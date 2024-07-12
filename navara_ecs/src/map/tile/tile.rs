use bevy_ecs::prelude::*;
use bevy_math::Vec3;
use navara_core::{
    terrain::UpsampledTerrainMesh, Ellipsoid, Extent, Radians, TileRegion, TileXYZ, WGS84_32,
};

use navara_quadtree::Quadtree;

use crate::{
    map::terrain::{layer::TerrainLayer, TerrainData},
    primitives::Aabb,
    BufferStore, CachedMeshHandle, DataRequester, DataRequesterStatus, TextureFragment,
    TextureFragmentStatus,
};

use super::{terrain::TerrainDataRequesterMarker, tile_bounding_region::TileBoundingReagion};

pub(super) type TileHandle = u64;

#[derive(Component)]
pub(crate) struct TileTextureFragmentMarker;

#[derive(Debug)]
pub(crate) enum RenderedState {
    RenderedChildren,
    Culled,
}

#[derive(Debug)]
pub struct Tile {
    pub coords: TileXYZ,
    pub extent: Extent<f32, Radians>,
    pub aabb: Aabb,
    pub bounding_reagion: Option<TileBoundingReagion<f32>>,
    pub(super) rendered_at: usize,
    pub(super) visited_at: usize,
    pub(crate) terrain_data: Option<Box<dyn TerrainData>>,
    pub(super) texture_fragment_entity_id: Option<Entity>,
    pub(crate) occludee_point_in_scaled_space: Option<Vec3>,
    pub(crate) previous_rendered_state: Option<RenderedState>,
    pub(crate) cached_mesh_handle: Option<CachedMeshHandle>,
    pub(crate) upsampled: bool,
}

impl Tile {
    pub(super) fn new(coords: TileXYZ, max_height: f32) -> Self {
        let extent = coords.extent();

        Self {
            coords,
            extent: coords.extent(),
            aabb: Aabb::from_extent_f32(extent, max_height),
            bounding_reagion: Some(TileBoundingReagion::from_extent_f32(extent, WGS84_32)),
            rendered_at: 0,
            visited_at: 0,
            terrain_data: None,
            texture_fragment_entity_id: None,
            occludee_point_in_scaled_space: None,
            previous_rendered_state: None,
            cached_mesh_handle: None,
            upsampled: false,
        }
    }

    pub(super) fn is_ready(
        &self,
        qt: &TileQuadtree,
        texture_fragment: &Query<(&TileTextureFragmentMarker, &TextureFragment)>,
        terrain_data_requester: &Query<(&TerrainDataRequesterMarker, &DataRequester)>,
        terrain_layer: &Option<&TerrainLayer>,
    ) -> bool {
        let texture_fragment_status = self
            .texture_fragment_entity_id
            .map(|e| texture_fragment.get(e).map(|t| &t.1.status));
        let is_texture_loaded = texture_fragment_status
            .map_or(false, |s| matches!(s, Ok(TextureFragmentStatus::Success)));

        let data_requester_entity_id = self
            .terrain_data
            .as_ref()
            .and_then(|t| t.data_requester_entity_id());

        // This means a terrain isn't used.
        if self.texture_fragment_entity_id.is_some() && data_requester_entity_id.is_none() {
            return is_texture_loaded;
        }

        is_texture_loaded
            && (self.is_terrain_ready(qt, terrain_data_requester, terrain_layer)
                || terrain_layer.map_or(false, |l| self.coords.z > l.max_z))
    }

    pub(crate) fn get_terrain_data_requester(
        &self,
        terrain_data_requester: &Query<(&TerrainDataRequesterMarker, &DataRequester)>,
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

    pub(super) fn is_terrain_ready(
        &self,
        qt: &TileQuadtree,
        terrain_data_requesters: &Query<(&TerrainDataRequesterMarker, &DataRequester)>,
        terrain_layer: &Option<&TerrainLayer>,
    ) -> bool {
        let terrain_data_requester = self.get_terrain_data_requester(terrain_data_requesters);
        terrain_data_requester.map_or(false, |s| {
            // If the status is failed and parent is succeeded, we need to upsample the terrain mesh.
            matches!(s.status, DataRequesterStatus::Success)
        }) || self.is_upsamplable(qt, terrain_data_requesters, terrain_layer)
    }

    pub(crate) fn is_upsamplable(
        &self,
        qt: &TileQuadtree,
        terrain_data_requester: &Query<(&TerrainDataRequesterMarker, &DataRequester)>,
        terrain_layer: &Option<&TerrainLayer>,
    ) -> bool {
        let parent = self.get_parent_tile(qt);
        let terrain_req = self.get_terrain_data_requester(terrain_data_requester);
        terrain_layer.is_some()
            && parent.map_or(false, |p| {
                p.get_terrain_data_requester(terrain_data_requester)
                    .map_or(false, |t| matches!(t.status, DataRequesterStatus::Success))
                    || p.upsampled
            })
            && (terrain_req.map_or(false, |t| matches!(t.status, DataRequesterStatus::Fail))
                || terrain_layer.map_or(false, |l| self.coords.z > l.max_z))
    }

    pub(super) fn get_parent_tile<'a>(&self, qt: &'a TileQuadtree) -> Option<&'a Self> {
        qt.qt
            .parent((self.coords.x, self.coords.y, self.coords.z))
            .and_then(|p| qt.qt.get(p.handle()))
    }

    fn get_region(&self, qt: &TileQuadtree) -> Option<TileRegion> {
        let parent = match self.get_parent_tile(qt) {
            Some(p) => p,
            None => return None,
        };
        let parent_children_coords = qt
            .qt
            .children((parent.coords.x, parent.coords.y, parent.coords.z))
            .unwrap()
            .iter()
            .map(|t| t.coords())
            .collect::<Vec<_>>();

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
    pub(super) fn upsample(
        &self,
        ellipsoid: Ellipsoid<f32>,
        qt: &TileQuadtree,
        buf_store: &BufferStore,
    ) -> Option<(Vec<f32>, Vec<f32>, UpsampledTerrainMesh)> {
        let parent = match self.get_parent_tile(qt) {
            Some(p) => p,
            None => return None,
        };
        let region = match self.get_region(qt) {
            Some(r) => r,
            None => return None,
        };

        let cached_mesh_handle = match &parent.cached_mesh_handle {
            Some(c) => c,
            None => return None,
        };

        let (uvs, heights, indices) = match (
            buf_store.get_f32(&cached_mesh_handle.uvs),
            cached_mesh_handle
                .heights
                .and_then(|h| buf_store.get_f32(&h)),
            buf_store.get_u32(&cached_mesh_handle.indices),
        ) {
            (Some(u), Some(h), Some(i)) => (u, h, i),
            _ => return None,
        };

        let upsampled_mesh = match self
            .terrain_data
            .as_ref()
            .and_then(|t| t.upsample(&region, uvs, heights, indices))
        {
            Some(u) => u,
            None => return None,
        };

        let (vertices, uvs) = upsampled_mesh.construct_mesh(ellipsoid, &self.extent);

        Some((vertices, uvs, upsampled_mesh))
    }
}

pub type TileQuadtree = Quadtree<usize, Tile>;
