use bevy_ecs::prelude::*;
use bevy_math::Vec3;
use navara_core::{Ellipsoid, Extent, LngLat, Radians, TileRegion, TileXYZ, WGS84_32};
use navara_geometry::Geometry;

use navara_quadtree::{Coords, Quadtree};

use crate::{
    map::terrain::TerrainData, primitives::Aabb, BufferStore, CachedMeshHandle, DataRequester,
    DataRequesterStatus, TextureFragment, TextureFragmentStatus,
};

use navara_layer::TerrainLayer;

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
        if terrain_layer.is_none()
            && self.texture_fragment_entity_id.is_some()
            && data_requester_entity_id.is_none()
        {
            return is_texture_loaded;
        }

        is_texture_loaded
            && (self.is_terrain_ready(terrain_data_requester)
                || ((self.should_upsampling() && self.is_upsamplable(qt, terrain_data_requester, terrain_layer))
                    // This tile doesn't need to be upsampled, so pass it if the terrain has already been requested.
                    || matches!(self.get_terrain_data_requester(terrain_data_requester).map(|t| t.status), Some(DataRequesterStatus::Fail)))
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
        terrain_data_requesters: &Query<(&TerrainDataRequesterMarker, &DataRequester)>,
    ) -> bool {
        let terrain_data_requester = self.get_terrain_data_requester(terrain_data_requesters);
        terrain_data_requester.map_or(false, |s| {
            // If the status is failed and parent is succeeded, we need to upsample the terrain mesh.
            matches!(s.status, DataRequesterStatus::Success)
        })
    }

    pub(crate) fn is_upsamplable(
        &self,
        qt: &TileQuadtree,
        terrain_data_requester: &Query<(&TerrainDataRequesterMarker, &DataRequester)>,
        terrain_layer: &Option<&TerrainLayer>,
    ) -> bool {
        let terrain_req = self.get_terrain_data_requester(terrain_data_requester);
        terrain_layer.is_some()
            && (terrain_req.map_or(false, |t| matches!(t.status, DataRequesterStatus::Fail))
                || terrain_layer.map_or(false, |l| self.coords.z > l.max_z))
            && self.get_parent_tile(qt).map_or(false, |p| {
                p.is_terrain_ready(terrain_data_requester) || p.upsampled
            })
    }

    pub(crate) fn should_upsampling(&self) -> bool {
        // In low zoom level, we don't need to upsample it.
        self.coords.z > 1
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
    pub fn upsample(
        &self,
        ellipsoid: Ellipsoid<f32>,
        qt: &TileQuadtree,
        buf_store: &BufferStore,
    ) -> Option<(Geometry, Vec<f32>, f32)> {
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

        let mut upsampled_mesh = match self
            .terrain_data
            .as_ref()
            .and_then(|t| t.upsample(&region, uvs, heights, indices))
        {
            Some(u) => u,
            None => return None,
        };

        let (geometry, heights) = upsampled_mesh.construct_geometry(ellipsoid, &self.extent);

        Some((geometry, heights, upsampled_mesh.max_height))
    }
}

pub type TileQuadtree = Quadtree<usize, Tile>;
#[derive(Component)]
pub struct TileMeshMarker;

/// Compute a terrain height at specified point.
pub fn compute_terrain_height_at_point(
    qt: &TileQuadtree,
    buf: &BufferStore,
    point: &LngLat<f32, Radians>,
) -> Option<f32> {
    let tile = find_contained_child(qt, &|t| {
        t.extent.contains(point) && t.cached_mesh_handle.is_some()
    })?;
    let heights = buf.get_f32(&tile.cached_mesh_handle.as_ref()?.heights?)?;

    compute_terrain_height_from_tile(tile, heights, point)
}

/// Compute a terrain height at specified point.
/// Height is retrieved by a relative index of longitude and latitude to the specified point.
fn compute_terrain_height_from_tile(
    tile: &Tile,
    heights: &[f32],
    point: &LngLat<f32, Radians>,
) -> Option<f32> {
    let length = heights.len();
    let width = (length as f32).sqrt() as usize;

    let east = tile.extent.east;
    let north = tile.extent.north;
    let west = tile.extent.west;
    let south = tile.extent.south;

    let dist_ew = (east - west).val();
    let dist_ns = (north - south).val();

    let dist_wlng = (point.lng - west).val();
    let dist_slat = (point.lat - south).val();

    // In `navara_geoemetry::tile_triangles`, it constructs the mesh with an order as x is latitude and y is longitude.
    // So we need to follow the order.
    let x = ((dist_slat / dist_ns) * (width - 1) as f32).round() as usize;
    let y = ((dist_wlng / dist_ew) * (width - 1) as f32).round() as usize;

    heights.get((x + y * width).min(length - 1)).copied()
}

/// Find a child that the tile contains.
fn find_contained_child<'a>(
    qt: &'a TileQuadtree,
    contain: &dyn Fn(&Tile) -> bool,
) -> Option<&'a Tile> {
    traverse_contained_child(qt, (0, 0, 0), contain)
}

fn traverse_contained_child<'a>(
    qt: &'a TileQuadtree,
    coords: Coords<usize>,
    contain: &dyn Fn(&Tile) -> bool,
) -> Option<&'a Tile> {
    let v = qt.qt.get(qt.qt.leaf(coords)?.handle())?;
    if !contain(v) {
        return None;
    }

    let children = qt.qt.children(coords);
    if let Some(children) = children {
        for child in children {
            if let Some(v) = traverse_contained_child(qt, child.coords(), contain) {
                return Some(v);
            }
        }
    }

    if contain(v) {
        return Some(v);
    }

    None
}

#[cfg(test)]
mod test {
    use navara_core::{Angle, LngLat, TileXYZ};

    use super::{compute_terrain_height_from_tile, find_contained_child, Tile, TileQuadtree};

    #[test]
    fn it_should_compute_terrain_height_from_tile() {
        let tile = Tile::new(TileXYZ { x: 3, y: 1, z: 2 }, 0.);
        #[rustfmt::skip]
        let heights = &[
            0., 1., 2., 3.,
            4., 5., 6., 7.,
            8., 9., 10., 11.,
            12., 13., 14., 15.,
        ];
        let result = compute_terrain_height_from_tile(
            &tile,
            heights,
            &LngLat {
                lng: Angle::new(2.5),
                lat: Angle::new(0.5),
            },
        );

        assert_eq!(result.unwrap(), 9.);
    }

    #[test]
    fn it_should_find_contained_tile() {
        let mut qt = TileQuadtree::new_with_region_qt(20);

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
        qt.qt.initialize_children((0, 0, 0), &|v| {
            Tile::new(
                TileXYZ {
                    x: v.0,
                    y: v.1,
                    z: v.2,
                },
                0.,
            )
        });
        qt.qt.initialize_children((0, 0, 1), &|v| {
            Tile::new(
                TileXYZ {
                    x: v.0,
                    y: v.1,
                    z: v.2,
                },
                0.,
            )
        });
        qt.qt.initialize_children((1, 0, 1), &|v| {
            Tile::new(
                TileXYZ {
                    x: v.0,
                    y: v.1,
                    z: v.2,
                },
                0.,
            )
        });
        qt.qt.initialize_children((0, 1, 1), &|v| {
            Tile::new(
                TileXYZ {
                    x: v.0,
                    y: v.1,
                    z: v.2,
                },
                0.,
            )
        });
        qt.qt.initialize_children((1, 1, 1), &|v| {
            Tile::new(
                TileXYZ {
                    x: v.0,
                    y: v.1,
                    z: v.2,
                },
                0.,
            )
        });

        let child = find_contained_child(&qt, &|t| {
            t.extent.contains(&LngLat {
                lng: Angle::new(2.5),
                lat: Angle::new(1.1),
            })
        });
        assert_eq!(child.unwrap().coords, TileXYZ { x: 3, y: 1, z: 2 });
    }
}
