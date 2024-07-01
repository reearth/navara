use bevy_ecs::prelude::*;
use bevy_math::Vec3;
use navara_core::{TileXYZ, WGS84_32};

use navara_quadtree::Quadtree;

use crate::{
    map::terrain::TerrainData, primitives::Aabb, Buffer, BufferStore, DataRequester,
    DataRequesterStatus, Handle, TextureFragment, TextureFragmentStatus,
};

use super::{terrain::TerrainDataRequesterMarker, tile_bounding_region::TileBoundingReagion};

pub(super) type TileHandle = u64;

#[derive(Component)]
pub(crate) struct TileTextureFragmentMarker;

#[derive(Debug)]
pub(crate) enum TileRegion {
    NorthWest,
    NorthEast,
    SouthEast,
    SouthWest,
}

#[derive(Debug, Default)]
pub struct Tile {
    pub coords: TileXYZ,
    pub aabb: Aabb,
    pub bounding_reagion: Option<TileBoundingReagion<f32>>,
    pub(super) rendered_at: usize,
    pub(super) terrain_data: Option<Box<dyn TerrainData>>,
    pub(super) texture_fragment_entity_id: Option<Entity>,
    pub(crate) occludee_point_in_scaled_space: Option<Vec3>,
    // TODO: Remove this property from BufferStore if unnecessary.
    pub(crate) upsampled_buf_handle: Option<Handle>,
}

impl Tile {
    pub(super) fn new(coords: TileXYZ) -> Self {
        let extent = coords.extent();
        Self {
            coords,
            aabb: Aabb::from_extent_f32(extent),
            bounding_reagion: Some(TileBoundingReagion::from_extent_f32(extent, WGS84_32)),
            ..Default::default()
        }
    }

    pub(super) fn is_ready(
        &self,
        _qt: &TileQuadtree,
        texture_fragment: &Query<(&TileTextureFragmentMarker, &TextureFragment)>,
        terrain_data_requester: &Query<(&TerrainDataRequesterMarker, &DataRequester)>,
    ) -> bool {
        let texture_fragment_status = self
            .texture_fragment_entity_id
            .map(|e| texture_fragment.get(e).map(|t| &t.1.status));
        let is_texture_loaded = texture_fragment_status
            .map_or(false, |s| matches!(s, Ok(TextureFragmentStatus::Success)));

        let data_requester_entity_id = self
            .terrain_data
            .as_ref()
            .map_or(None, |t| t.data_requester_entity_id());

        // This means a terrain isn't used.
        if self.texture_fragment_entity_id.is_some() && data_requester_entity_id.is_none() {
            return is_texture_loaded;
        }

        is_texture_loaded && self.is_terrain_ready(terrain_data_requester)
    }

    pub(crate) fn get_terrain_data_requester(
        &self,
        terrain_data_requester: &Query<(&TerrainDataRequesterMarker, &DataRequester)>,
    ) -> Option<DataRequester> {
        let data_requester_entity_id = self
            .terrain_data
            .as_ref()
            .map_or(None, |t| t.data_requester_entity_id());
        data_requester_entity_id.map_or(None, |e| {
            terrain_data_requester
                .get(e)
                .map_or(None, |d| Some(d.1.clone()))
        })
    }

    pub(super) fn is_terrain_ready(
        &self,
        terrain_data_requester: &Query<(&TerrainDataRequesterMarker, &DataRequester)>,
    ) -> bool {
        let terrain_data_requester = self.get_terrain_data_requester(terrain_data_requester);
        terrain_data_requester.map_or(false, |s| {
            // If the status is failed and parent is succeeded, we need to upsample the terrain mesh.
            matches!(
                s.status,
                DataRequesterStatus::Success | DataRequesterStatus::Fail
            )
        })
    }

    pub(super) fn get_parent_tile<'a>(&self, qt: &'a TileQuadtree) -> Option<&'a Self> {
        qt.qt
            .parent((self.coords.x, self.coords.y, self.coords.z))
            .map_or(None, |p| qt.qt.get(p.handle()))
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
        qt: &TileQuadtree,
        terrain_data_requesters: &Query<(&TerrainDataRequesterMarker, &DataRequester)>,
        buf_store: &BufferStore,
    ) -> Option<Buffer> {
        let parent = match self.get_parent_tile(qt) {
            Some(p) => p,
            None => return None,
        };
        let region = match self.get_region(qt) {
            Some(r) => r,
            None => return None,
        };

        self.terrain_data.as_ref().map_or(None, |t| {
            t.upsample(&region, parent, terrain_data_requesters, buf_store)
        })
    }
}

pub type TileQuadtree = Quadtree<usize, Tile>;
