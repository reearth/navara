use bevy_ecs::prelude::*;
use bevy_math::Vec3;
use navara_core::{TileXYZ, WGS84_32};

use navara_quadtree::Quadtree;

use crate::{
    map::terrain::TerrainData, primitives::Aabb, DataRequester, DataRequesterStatus,
    TextureFragment, TextureFragmentStatus,
};

use super::{terrain::TerrainDataRequesterMarker, tile_bounding_region::TileBoundingReagion};

pub(super) type TileHandle = u64;

#[derive(Component)]
pub(crate) struct TileTextureFragmentMarker;

#[derive(Debug, Default)]
pub struct Tile {
    pub coords: TileXYZ,
    pub aabb: Aabb,
    pub bounding_reagion: Option<TileBoundingReagion<f32>>,
    pub(super) rendered_at: usize,
    pub(super) terrain_data: TerrainData,
    pub(super) texture_fragment_entity_id: Option<Entity>,
    pub(crate) occludee_point_in_scaled_space: Option<Vec3>,
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

        // This means a terrain isn't used.
        if self.texture_fragment_entity_id.is_some()
            && self.terrain_data.data_requester_entity_id.is_none()
        {
            return is_texture_loaded;
        }

        is_texture_loaded && self.is_terrain_ready(terrain_data_requester)
    }

    pub(super) fn is_terrain_ready(
        &self,
        terrain_data_requester: &Query<(&TerrainDataRequesterMarker, &DataRequester)>,
    ) -> bool {
        let terrain_data_requester_status =
            self.terrain_data
                .data_requester_entity_id
                .map_or(None, |e| {
                    terrain_data_requester
                        .get(e)
                        .map_or(None, |d| Some(&d.1.status))
                });
        terrain_data_requester_status.map_or(false, |s| {
            // If the status is failed and parent is succeeded, we need to upsample the terrain mesh.
            matches!(s, DataRequesterStatus::Success | DataRequesterStatus::Fail)
        })
    }
}

pub type TileQuadtree = Quadtree<usize, Tile>;
