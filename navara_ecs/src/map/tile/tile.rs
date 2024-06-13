use bevy_ecs::prelude::*;
use bevy_math::Vec3;
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
    pub max_z: usize,
    pub wireframe: bool,
}

#[derive(Debug, Default)]
pub struct Tile {
    pub coords: TileXYZ,
    pub aabb: Aabb,
    pub bounding_reagion: Option<TileBoundingReagion<f32>>,
    pub(super) rendered_at: usize,
    pub(super) data_requester_entity_id: Option<Entity>,
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
}

pub type TileQuadtree = Quadtree<usize, Tile>;
