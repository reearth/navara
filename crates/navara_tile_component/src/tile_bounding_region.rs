use navara_core::{Ellipsoid, Extent, Float, LLE, Meters, Radians, XYZ, vec3_to_xyz, xyz_to_vec3};
use navara_math::{FloatType, Vec3};

// Ref: https://github.com/CesiumGS/cesium/blob/290f01d9091c381a0d3f21e3131c0e9f488c6937/packages/engine/Source/Scene/TileBoundingRegion.js
#[derive(Debug, Clone)]
pub struct TileBoundingRegion<F: Float> {
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

impl TileBoundingRegion<FloatType> {
    pub fn from_extent_f64(e: Extent<f64, Radians>, ellipsoid: Ellipsoid<f64>) -> Self {
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
    use approx::assert_abs_diff_eq;
    use navara_core::{Angle, LLE, Meters, TileXYZ, WGS84_64, WGS84_A_32};
    use navara_math::{EPSILON1, EPSILON7};
    use navara_mock::camera::update_camera_transform;

    use super::TileBoundingRegion;

    #[test]
    fn get_correct_bounding_region_from_tile() {
        let tile_coords = TileXYZ { x: 0, y: 1, z: 1 };
        let tbr = TileBoundingRegion::from_extent_f64(tile_coords.extent(), WGS84_64);

        // northeast_corner
        assert_abs_diff_eq!(tbr.northeast_corner.x.val(), 6378137., epsilon = EPSILON1);
        assert_abs_diff_eq!(tbr.northeast_corner.y.val(), 0., epsilon = EPSILON7);
        assert_abs_diff_eq!(tbr.northeast_corner.z.val(), 0., epsilon = EPSILON7);

        // southwest_corner
        assert_abs_diff_eq!(
            tbr.southwest_corner.x.val(),
            -552058.2246913937,
            epsilon = EPSILON1
        );
        assert_abs_diff_eq!(tbr.southwest_corner.y.val(), 0., epsilon = EPSILON7);
        assert_abs_diff_eq!(
            tbr.southwest_corner.z.val(),
            -6332896.014929536,
            epsilon = EPSILON1
        );

        // north_normal
        assert_abs_diff_eq!(tbr.north_normal.x.val(), 0., epsilon = EPSILON7);
        assert_abs_diff_eq!(tbr.north_normal.y.val(), 0., epsilon = EPSILON7);
        assert_abs_diff_eq!(tbr.north_normal.z.val(), 1., epsilon = EPSILON7);

        // east_normal
        assert_abs_diff_eq!(tbr.east_normal.x.val(), 0., epsilon = EPSILON7);
        assert_abs_diff_eq!(tbr.east_normal.y.val(), 1., epsilon = EPSILON7);
        assert_abs_diff_eq!(tbr.east_normal.z.val(), 0., epsilon = EPSILON7);

        // south_normal
        assert_abs_diff_eq!(tbr.south_normal.x.val(), 4.3711385e-8, epsilon = EPSILON7);
        assert_abs_diff_eq!(tbr.south_normal.y.val(), 1., epsilon = EPSILON7);
        assert_abs_diff_eq!(tbr.south_normal.z.val(), 3.7849444e-9, epsilon = EPSILON7);

        // west_normal
        assert_abs_diff_eq!(tbr.west_normal.x.val(), 8.742277e-8, epsilon = EPSILON7);
        assert_abs_diff_eq!(tbr.west_normal.y.val(), 1., epsilon = EPSILON7);
        assert_abs_diff_eq!(tbr.west_normal.z.val(), 0., epsilon = EPSILON7);
    }

    #[test]
    fn get_correct_distance_to_camera() {
        let tile_coords = TileXYZ { x: 0, y: 1, z: 1 };
        let tbr = TileBoundingRegion::from_extent_f64(tile_coords.extent(), WGS84_64);

        let (camera_pos, camera_lle) = update_camera_transform(WGS84_A_32 as f64 * 3.);
        let camera_lle = LLE {
            lng: Angle::new(camera_lle.lng.val()),
            lat: Angle::new(camera_lle.lat.val()),
            height: Meters::new(camera_lle.height.val()),
        };
        assert_abs_diff_eq!(
            tbr.distance_to_camera(camera_pos, camera_lle),
            29916114.303112928,
            epsilon = EPSILON7
        );

        let (camera_pos, camera_lle) = update_camera_transform(WGS84_A_32 as f64);
        let camera_lle = LLE {
            lng: Angle::new(camera_lle.lng.val()),
            lat: Angle::new(camera_lle.lat.val()),
            height: Meters::new(camera_lle.height.val()),
        };
        assert_abs_diff_eq!(
            tbr.distance_to_camera(camera_pos, camera_lle),
            9020047.848073645,
            epsilon = EPSILON7
        );
    }
}
