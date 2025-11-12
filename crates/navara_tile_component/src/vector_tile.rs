use bevy_ecs::prelude::*;
use navara_component::Deleted;
use navara_core::{
    get_ellipsoid_terrain_level_zero_maximum_geometric_error, get_level_maximum_geometric_error,
    Aabb, Ellipsoid, Extent, Radians, TileXYZ, WGS84_64,
};
use navara_data_requester::DataRequesterStatus;
use navara_math::Vec3;

use navara_quadtree::Coords;

use crate::{Tile, TileHandle, VectorTileQuadtree};

use navara_math::FloatType;

use super::tile_bounding_region::TileBoundingRegion;

// Note Tile have to keep light size for caching efficiently.
// So if you want to store large data in this struct, use [`BufferStore`].
// And don't forget to destroy the stored data in [`Tile::destroy method`].
#[derive(Debug)]
pub struct VectorTile {
    pub coords: TileXYZ,
    pub extent: Extent<FloatType, Radians>,
    pub aabb: Aabb,
    pub bounding_region: Option<TileBoundingRegion<FloatType>>,
    pub children: Vec<TileHandle>,
    pub rendered_at: usize,
    pub visited_at: usize,
    pub data_requester_entity_id: Option<Entity>,
    pub occludee_point_in_scaled_space: Option<Vec3>,
    pub max_height: FloatType,
    pub distance_from_camera: FloatType,
    pub sse: FloatType,
    pub were_children_rendered: bool,
    /// Check this tile is actually rendered in the rendering engine, not selected.
    pub is_rendered: bool,
    /// This tile should be used to show the parent tile instead of the child tile if the child tile is still preparing.
    pub ready_parent_tile_handle: Option<TileHandle>,
}

impl Clone for VectorTile {
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
            data_requester_entity_id: self.data_requester_entity_id,
            occludee_point_in_scaled_space: self.occludee_point_in_scaled_space,
            max_height: self.max_height,
            distance_from_camera: 0.,
            sse: 0.,
            were_children_rendered: false,
            is_rendered: false,
            ready_parent_tile_handle: None,
        }
    }
}

impl VectorTile {
    pub fn new(coords: TileXYZ, max_height: FloatType) -> Self {
        let extent = coords.extent();

        Self {
            coords,
            extent: coords.extent(),
            aabb: Aabb::from_extent_f64(extent, 0., max_height),
            bounding_region: Some(TileBoundingRegion::from_extent_f64(extent, WGS84_64)),
            rendered_at: 0,
            visited_at: 0,
            data_requester_entity_id: None,
            occludee_point_in_scaled_space: None,
            children: Vec::with_capacity(4),
            max_height,
            distance_from_camera: 0.,
            sse: 0.,
            were_children_rendered: false,
            is_rendered: false,
            ready_parent_tile_handle: None,
        }
    }

    pub fn is_ready(&self, status: &DataRequesterStatus) -> bool {
        matches!(status, DataRequesterStatus::Success)
    }

    pub fn get_parent_tile<'a>(&self, qt: &'a VectorTileQuadtree) -> Option<&'a Self> {
        qt.qt
            .parent((self.coords.x, self.coords.y, self.coords.z))
            .and_then(|p| qt.qt.get(p.handle()))
    }

    // This function will be invoked before this tile is destroyed.
    pub fn destroy(&mut self, commands: &mut Commands) {
        if let Some(e) = self.data_requester_entity_id.take() {
            commands.entity(e).insert(Deleted);
        }
    }
}

impl Tile for VectorTile {
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

    fn max_height(&self) -> FloatType {
        self.max_height
    }

    fn set_max_height(&mut self, v: FloatType) {
        self.max_height = v;
    }

    fn has_terrain(&self) -> bool {
        false
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

    fn new_child((x, y, z): Coords<Self::CoordUnit>, max_height: FloatType) -> Self {
        Self::new(TileXYZ { x, y, z }, max_height)
    }
}
