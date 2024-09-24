use navara_core::{vec3_to_xyz, xyz_to_vec3, Ellipsoid, Extent, Float, Meters, Radians, LLE, XYZ};
use navara_math::{FloatType, Vec3};

// Ref: https://github.com/CesiumGS/cesium/blob/290f01d9091c381a0d3f21e3131c0e9f488c6937/packages/engine/Source/Scene/TileBoundingRegion.js
#[derive(Debug)]
pub struct TileBoundingReagion<F: Float> {
    pub extent: Extent<F, Radians>,
    pub southwest_corner: XYZ<F>,
    pub northeast_corner: XYZ<F>,
    pub west_normal: XYZ<F>,
    pub east_normal: XYZ<F>,
    pub south_normal: XYZ<F>,
    pub north_normal: XYZ<F>,
    pub maximum_height: F,
    pub minimum_height: F,
}

impl TileBoundingReagion<FloatType> {
    pub fn from_extent_f32(e: Extent<FloatType, Radians>, ellipsoid: Ellipsoid<FloatType>) -> Self {
        let southwest_corner_lle = LLE {
            lng: e.west,
            lat: e.south,
            height: Meters::new(0.),
        };
        let northeast_corner_lle = LLE {
            lng: e.east,
            lat: e.north,
            height: Meters::new(0.),
        };

        let southwest_corner = ellipsoid.lle_to_xyz(southwest_corner_lle);
        let northeast_corner = ellipsoid.lle_to_xyz(northeast_corner_lle);

        let western_midpoint_lle = LLE {
            lng: e.west,
            lat: (e.south + e.north) * 0.5,
            height: Meters::new(0.),
        };
        let eastern_midpoint_lle = LLE {
            lng: e.east,
            lat: western_midpoint_lle.lat,
            height: western_midpoint_lle.height,
        };

        let western_midpoint = ellipsoid.lle_to_xyz(western_midpoint_lle);
        let western_midpoint = xyz_to_vec3(western_midpoint);
        let west_vector = western_midpoint.cross(Vec3::Z);
        let west_normal = west_vector.normalize();

        let eastern_midpoint = ellipsoid.lle_to_xyz(eastern_midpoint_lle);
        let eastern_midpoint = xyz_to_vec3(eastern_midpoint);
        let east_normal = Vec3::Z.cross(eastern_midpoint).normalize();

        let mut west_vec = western_midpoint - eastern_midpoint;
        if west_vec.length() == 0. {
            west_vec = west_vector;
        }

        let south_surface_normal = ellipsoid.geodetic_surface_normal_from_lle(LLE {
            lng: e.east,
            lat: e.south,
            height: Meters::new(0.),
        });
        let south_surface_normal = xyz_to_vec3(south_surface_normal).normalize();
        let south_normal = south_surface_normal.cross(west_vec).normalize();

        let north_surface_normal = ellipsoid.geodetic_surface_normal_from_lle(LLE {
            lng: e.west,
            lat: e.north,
            height: Meters::new(0.),
        });
        let north_surface_normal = xyz_to_vec3(north_surface_normal).normalize();
        let north_normal = west_vec.cross(north_surface_normal).normalize();

        Self {
            extent: e,

            southwest_corner,
            northeast_corner,

            west_normal: vec3_to_xyz(west_normal),
            east_normal: vec3_to_xyz(east_normal),
            south_normal: vec3_to_xyz(south_normal),
            north_normal: vec3_to_xyz(north_normal),

            maximum_height: 0.,
            minimum_height: 0.,
        }
    }

    pub fn distance_to_camera(
        &self,
        camera_position: Vec3,
        camera_lle: LLE<FloatType, Radians>,
    ) -> FloatType {
        let camera_height = camera_lle.height.val();

        let mut result = 0.;
        if !self.extent.contains(&camera_lle.into()) {
            let southwest_corner = xyz_to_vec3(self.southwest_corner);
            let northeast_corner = xyz_to_vec3(self.northeast_corner);
            let west_normal = xyz_to_vec3(self.west_normal);
            let south_normal = xyz_to_vec3(self.south_normal);
            let east_normal = xyz_to_vec3(self.east_normal);
            let north_normal = xyz_to_vec3(self.north_normal);

            let vector_from_sourhwest_corner = camera_position - southwest_corner;
            let distance_to_west_plane = vector_from_sourhwest_corner.dot(west_normal);
            let distance_to_south_plane = vector_from_sourhwest_corner.dot(south_normal);

            let vector_from_northeast_corner = camera_position - northeast_corner;
            let distance_to_east_plane = vector_from_northeast_corner.dot(east_normal);
            let distance_to_north_plane = vector_from_northeast_corner.dot(north_normal);

            if distance_to_west_plane > 0. {
                result += distance_to_west_plane * distance_to_west_plane;
            } else if distance_to_east_plane > 0.0 {
                result += distance_to_east_plane * distance_to_east_plane;
            }

            if distance_to_south_plane > 0. {
                result += distance_to_south_plane * distance_to_south_plane;
            } else if distance_to_north_plane > 0.0 {
                result += distance_to_north_plane * distance_to_north_plane;
            }
        }

        if camera_height > self.maximum_height {
            let distance_above_top = camera_height - self.maximum_height;
            result += distance_above_top * distance_above_top;
        } else if camera_height < self.minimum_height {
            let distance_below_bottom = self.minimum_height - camera_height;
            result += distance_below_bottom * distance_below_bottom;
        }

        result.sqrt()
    }
}

#[cfg(test)]
mod test {
    use navara_core::{Meters, TileXYZ, EARTH_RADIUS_F32, WGS84_32, XYZ};
    use navara_mock::camera::update_camera_transform;

    use super::TileBoundingReagion;

    #[test]
    fn get_correct_bounding_region_from_tile() {
        let tile_coords = TileXYZ { x: 0, y: 1, z: 1 };
        let tbr = TileBoundingReagion::from_extent_f32(tile_coords.extent(), WGS84_32);
        debug_assert_eq!(
            tbr.northeast_corner,
            XYZ {
                x: Meters::new(6378137.),
                y: Meters::new(0.),
                z: Meters::new(0.),
            }
        );
        debug_assert_eq!(
            tbr.southwest_corner,
            XYZ {
                x: Meters::new(-552057.56),
                y: Meters::new(0.048262406),
                z: Meters::new(-6332896.0)
            }
        );
        debug_assert_eq!(
            tbr.north_normal,
            XYZ {
                x: Meters::new(0.),
                y: Meters::new(0.),
                z: Meters::new(-1.),
            }
        );
        debug_assert_eq!(
            tbr.east_normal,
            XYZ {
                x: Meters::new(0.),
                y: Meters::new(1.),
                z: Meters::new(0.),
            }
        );
        debug_assert_eq!(
            tbr.south_normal,
            XYZ {
                x: Meters::new(4.3711385e-8),
                y: Meters::new(1.),
                z: Meters::new(3.7849444e-9),
            }
        );
        debug_assert_eq!(
            tbr.west_normal,
            XYZ {
                x: Meters::new(8.742277e-8),
                y: Meters::new(1.),
                z: Meters::new(0.),
            }
        );
    }

    #[test]
    fn get_correct_distance_to_camera() {
        let tile_coords = TileXYZ { x: 0, y: 1, z: 1 };
        let tbr = TileBoundingReagion::from_extent_f32(tile_coords.extent(), WGS84_32);

        let (camera_pos, camera_lle) = update_camera_transform(EARTH_RADIUS_F32 * 3.);
        debug_assert_eq!(tbr.distance_to_camera(camera_pos, camera_lle), 29879596.0);

        let (camera_pos, camera_lle) = update_camera_transform(EARTH_RADIUS_F32);
        debug_assert_eq!(tbr.distance_to_camera(camera_pos, camera_lle), 9009958.0);
    }
}
