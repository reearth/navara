use std::fmt::Debug;

use navara_camera::CameraFrustum;
use navara_core::{
    vec3_to_xyz, xyz_to_vec3, Aabb, Ellipsoid, Extent, Meters, Radians, TileXYZ, LLE,
};
use navara_math::{FloatType, Transform, Vec3};
use navara_occluder::ellipsoidal_occluder::EllipsoidalOccluder;
use navara_quadtree::{num::PrimInt, to_int, Coords, Quadtree};
use navara_window::Window;

use crate::{TileBoundingRegion, TileHandle};

pub trait Tile {
    type CoordUnit: PrimInt + Default + Sync + Send + 'static;

    fn occludee_point_in_scaled_space(&self) -> Option<&Vec3>;
    fn set_occludee_point_in_scaled_space(&mut self, p: Option<Vec3>);

    fn extent(&self) -> &Extent<FloatType, Radians>;
    fn coords(&self) -> &TileXYZ;
    fn bounding_region(&self) -> Option<&TileBoundingRegion<FloatType>>;
    fn aabb(&self) -> &Aabb;
    fn max_height(&self) -> FloatType;

    /// This is cached children, the children might be removed after the tile is cleared.
    /// If you want to traverse all children correctly, you need to use [`Tile::traversable_children`].
    fn children(&self) -> &[TileHandle];
    fn set_children(&mut self, children: Vec<TileHandle>);

    fn update_tile_occludee_point(
        &mut self,
        ellipsoid: &Ellipsoid<FloatType>,
        occluder: &EllipsoidalOccluder,
    ) {
        if self.occludee_point_in_scaled_space().is_some() {
            return;
        }

        let extent = self.extent();
        let center = self.aabb().center;
        let max_height = Meters::new(self.max_height());

        let positions = vec![
            xyz_to_vec3(ellipsoid.lle_to_xyz(LLE {
                lng: extent.west,
                lat: extent.south,
                height: max_height,
            })),
            xyz_to_vec3(ellipsoid.lle_to_xyz(LLE {
                lng: extent.east,
                lat: extent.south,
                height: max_height,
            })),
            xyz_to_vec3(ellipsoid.lle_to_xyz(LLE {
                lng: extent.west,
                lat: extent.north,
                height: max_height,
            })),
            xyz_to_vec3(ellipsoid.lle_to_xyz(LLE {
                lng: extent.east,
                lat: extent.north,
                height: max_height,
            })),
        ];

        self.set_occludee_point_in_scaled_space(
            occluder.compute_horizontal_culling_point(ellipsoid, center, positions),
        );
    }

    fn is_root(&self) -> bool {
        let coords = self.coords();
        coords.x == 0 && coords.y == 0 && coords.z == 0
    }

    fn intersect_with_camera_frustum(&self, frustum: &CameraFrustum) -> bool {
        frustum.intersection_with_aabb(self.aabb())||
		// Avoid frustum culling with root tile
		self.is_root()
    }

    fn calc_distance_from_camera(
        &self,
        camera: &Transform,
        ellipsoid: &Ellipsoid<FloatType>,
    ) -> FloatType {
        let camera_pos = camera.transform_point(Vec3::ZERO);
        self.bounding_region()
            .unwrap()
            .distance_to_camera(camera_pos, ellipsoid.xyz_to_lle(vec3_to_xyz(camera_pos)))
    }

    fn get_level_maximum_geometric_error(
        &self,
        ellipsoid: &Ellipsoid<FloatType>,
        height_map_width: FloatType,
    ) -> FloatType;

    // Ref: https://github.com/CesiumGS/cesium/blob/3b393448d7e976165c0260fab9ea90843583c3a7/packages/engine/Source/Scene/QuadtreePrimitive.js#L1245
    fn calc_sse(
        &self,
        frustum: &CameraFrustum,
        window: &Window,
        ellipsoid: &Ellipsoid<FloatType>,
        height_map_width: FloatType,
        distance_from_camera: FloatType,
    ) -> FloatType {
        let max_geometric_error =
            self.get_level_maximum_geometric_error(ellipsoid, height_map_width);

        // TODO: Support fog culling

        (max_geometric_error * window.height)
            / (distance_from_camera * frustum.sse_denominator)
            / window.pixel_ratio
    }

    fn new_child(coords: Coords<Self::CoordUnit>, max_height: FloatType) -> Self;

    /// This is used to align children, because a child might be removed in quadtree.
    fn traversable_children(
        qt: &mut Quadtree<Self::CoordUnit, Self>,
        handle: TileHandle,
    ) -> Option<Vec<TileHandle>>
    where
        Self: Sized + Sync + Send + 'static + Debug,
    {
        let tile = qt.qt.get(handle).unwrap();
        let children = tile.children();
        let coords = tile.coords();
        let coords = (to_int(coords.x), to_int(coords.y), to_int(coords.z));
        let parent_max_height = tile.max_height();
        let init = |coords| Self::new_child(coords, parent_max_height);
        if children.is_empty() {
            let children = qt.qt.initialize_children(coords, &init)?;
            let tile = qt.qt.get_mut(handle).unwrap();
            tile.set_children(children.clone());
            return Some(children);
        }

        let children = children.to_vec();
        let mut new_children = Vec::with_capacity(4);
        for (i, c) in children.iter().enumerate() {
            let c = *c;
            let is_tile_some = qt.qt.get(c).is_some();
            if is_tile_some {
                new_children.push(c);
                continue;
            }
            new_children.push(qt.qt.initialize_child(coords, to_int(i), &init)?);
        }
        Some(new_children)
    }
}
