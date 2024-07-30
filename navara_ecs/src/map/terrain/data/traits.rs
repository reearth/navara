use std::fmt::Debug;

use bevy_ecs::{entity::Entity, system::Query};
use martini::Martini;
use navara_core::{Ellipsoid, Extent, LngLat, Radians, TileRegion};
use navara_geometry::{Geometry, UpsampledTerrainGeometry};

use crate::{
    map::tile::{terrain::TerrainDataRequesterMarker, Tile},
    BufferStore, DataRequester,
};

pub trait TerrainData: Debug + Sync + Send {
    fn upsample(
        &self,
        region: &TileRegion,
        uvs: &[f32],
        heights: &[f32],
        indices: &[u32],
    ) -> Option<UpsampledTerrainGeometry>;
    fn construct_terrain_mesh(
        &self,
        ellipsoid: Ellipsoid<f32>,
        tile: &Tile,
        bytes: &[u8],
        geoid_height: f32,
        martini: &mut Martini,
    ) -> (Geometry, f32, Vec<f32>);
    fn data_requester_entity_id(&self) -> Option<Entity>;
    fn set_data_requester_entity_id(&mut self, e: Option<Entity>);
    /// Compute a terrain height at specified point.
    fn compute_height_at_point(
        &mut self,
        extent: &Extent<f32, Radians>,
        buf: &BufferStore,
        terrain_data_requesters: &Query<(&TerrainDataRequesterMarker, &DataRequester)>,
        point: &LngLat<f32, Radians>,
    ) -> Option<f32>;
    // Indicates the max height of the terrain from the globe surface.
    fn current_max_height(&self) -> Option<f32>;
    fn set_current_max_height(&mut self, h: f32);
}
