use std::fmt::Debug;

use crate::{raster_tile::RasterTile, terrain_data_requester::TileTerrainDataRequesterQuery};
use bevy_ecs::entity::Entity;
use martini::Martini;
use navara_buffer_store::BufferStore;
use navara_core::{ElevationDecoder, Ellipsoid, Extent, LngLat, Radians, TileRegion};
use navara_geometry::{
    ReturnedConstructedTerrainMesh, UpsamplableTerrainGeometry, UpsampledTerrainGeometry,
};
use navara_math::FloatType;

pub trait TerrainData: Debug + Sync + Send {
    fn upsample(
        &self,
        region: &TileRegion,
        upsamplable_geometry: UpsamplableTerrainGeometry,
    ) -> Option<UpsampledTerrainGeometry>;
    fn construct_terrain_mesh(
        &self,
        ellipsoid: Ellipsoid<FloatType>,
        tile: &RasterTile,
        bytes: &[u8],
        geoid_height: FloatType,
        martini: &mut Martini,
    ) -> ReturnedConstructedTerrainMesh;
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
    fn box_clone(&self) -> Box<dyn TerrainData>;
    fn decoder(&self) -> Option<&ElevationDecoder> {
        None
    }
}
