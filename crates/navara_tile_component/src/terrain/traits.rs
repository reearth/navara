use std::fmt::Debug;

use crate::{data_requester::TileTerrainDataRequesterQuery, tile::Tile};
use bevy_ecs::entity::Entity;
use martini::Martini;
use navara_buffer_store::BufferStore;
use navara_core::{Ellipsoid, Extent, LngLat, Radians, TileRegion};
use navara_geometry::{Geometry, UpsampledTerrainGeometry};
use navara_math::FloatType;

pub trait TerrainData: Debug + Sync + Send {
    fn upsample(
        &self,
        region: &TileRegion,
        uvs: &[FloatType],
        heights: &[FloatType],
        indices: &[u32],
    ) -> Option<UpsampledTerrainGeometry>;
    fn construct_terrain_mesh(
        &self,
        ellipsoid: Ellipsoid<FloatType>,
        tile: &Tile,
        bytes: &[u8],
        geoid_height: FloatType,
        martini: &mut Martini,
    ) -> (Geometry, FloatType, FloatType, Vec<FloatType>);
    fn data_requester_entity_id(&self) -> Option<Entity>;
    fn set_data_requester_entity_id(&mut self, e: Option<Entity>);
    /// Compute a terrain height at specified point.
    fn compute_height_at_point(
        &mut self,
        extent: &Extent<FloatType, Radians>,
        buf: &mut BufferStore,
        terrain_data_requesters: &TileTerrainDataRequesterQuery,
        point: &LngLat<FloatType, Radians>,
    ) -> Option<FloatType>;
    // Indicates the max height of the terrain from the globe surface.
    fn current_max_height(&self) -> Option<FloatType>;
    fn set_current_max_height(&mut self, h: FloatType);
    fn current_min_height(&self) -> Option<FloatType>;
    fn set_current_min_height(&mut self, h: FloatType);
    fn destroy(&mut self, buf: &mut BufferStore);
}
