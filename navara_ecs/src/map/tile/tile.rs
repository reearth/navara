use bevy_ecs::prelude::*;
use bevy_math::Vec3;
use instant::Instant;
use navara_core::{Extent, LngLat, Radians, TileXYZ, LLE, WGS84_32};

use navara_quadtree::Quadtree;

use crate::primitives::Aabb;

use super::tile_bounding_region::TileBoundingReagion;

pub(super) type TileHandle = u64;

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub struct Tiles {
    pub tile_url: Option<String>,
    pub terrain_url: Option<String>,
    pub z: usize,
    pub segments: usize,
    pub height: f32,
    pub extent: Option<Extent<f32, Radians>>,
    pub color: u32,
    pub max_sse: f32,
    pub wireframe: bool,
}

#[derive(Debug, Default)]
pub struct Tile {
    pub coords: TileXYZ,
    pub aabb: Aabb,
    pub bounding_reagion: Option<TileBoundingReagion<f32>>,
    pub(super) rendered_at: Option<Instant>,
    pub(super) data_requester_entity_id: Option<Entity>,
    pub(super) texture_fragment_entity_id: Option<Entity>,
    pub(crate) occludee_point_in_scaled_space: Option<Vec3>,
}

impl Tile {
    pub(super) fn new(coords: TileXYZ) -> Self {
        let extent = coords.extent();
        Self {
            coords,
            aabb: Aabb::from_lle_f32(
                LLE::from(LngLat {
                    lng: extent.west,
                    lat: extent.south,
                }),
                LLE::from(LngLat {
                    lng: extent.east,
                    lat: extent.north,
                }),
            ),
            bounding_reagion: Some(TileBoundingReagion::from_extent_f32(extent, WGS84_32)),
            ..Default::default()
        }
    }

    pub(super) fn is_coords_zero(&self) -> bool {
        self.coords.x == 0 && self.coords.y == 0 && self.coords.z == 0
    }
}

pub type TileQuadtree = Quadtree<usize, Tile>;
