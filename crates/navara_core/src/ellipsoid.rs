use navara_math::{FloatType, One, Vec3};

use crate::{scale_to_geodetic_surface, Float, Meters, Rad, Radians, LLE, XYZ};

#[derive(Debug, Copy, Clone, PartialEq)]
pub struct Ellipsoid<F: Float> {
    pub a: F,
    pub b: F,
    one_over_radii: [F; 3],
    one_over_radii_squared: [F; 3],
    center_tolerance_squared: F,
}

// TODO: Move this variable to the correct place.
pub const EARTH_RADIUS_F32: f32 = 6371000.;

pub const WGS84_A_64: f64 = 6378137.0;
pub const WGS84_A_32: f32 = 6378137.0;
pub const WGS84_FE_64: f64 = 1.0 / 298.257223563;
#[allow(clippy::excessive_precision)]
pub const WGS84_FE_32: f32 = 1.0 / 298.257223563;
pub const WGS84_B_64: f64 = 6_356_752.314_245_179;
pub const WGS84_B_32: f32 = 6_356_752.5;

pub const ONE_OVER_RADII_64: [f64; 3] = [1. / WGS84_A_64, 1. / WGS84_A_64, 1. / WGS84_B_64];
pub const ONE_OVER_RADII_32: [f32; 3] = [1. / WGS84_A_32, 1. / WGS84_A_32, 1. / WGS84_B_32];

pub const ONE_OVER_RADII_SQUARED_64: [f64; 3] = [
    1. / (WGS84_A_64 * WGS84_A_64),
    1. / (WGS84_A_64 * WGS84_A_64),
    1. / (WGS84_B_64 * WGS84_B_64),
];
pub const ONE_OVER_RADII_SQUARED_32: [f32; 3] = [
    1. / (WGS84_A_32 * WGS84_A_32),
    1. / (WGS84_A_32 * WGS84_A_32),
    1. / (WGS84_B_32 * WGS84_B_32),
];

pub const WGS84_64: Ellipsoid<f64> = Ellipsoid {
    a: WGS84_A_64,
    b: WGS84_B_64,
    one_over_radii: ONE_OVER_RADII_64,
    one_over_radii_squared: ONE_OVER_RADII_SQUARED_64,
    center_tolerance_squared: 0.1,
};

pub const WGS84_32: Ellipsoid<f32> = Ellipsoid {
    a: WGS84_A_32,
    b: WGS84_B_32,
    one_over_radii: ONE_OVER_RADII_32,
    one_over_radii_squared: ONE_OVER_RADII_SQUARED_32,
    center_tolerance_squared: 0.1,
};

pub const UNIT_SPHERE_32: Ellipsoid<f32> = Ellipsoid {
    a: 1.,
    b: 1.,
    one_over_radii: [1., 1., 1.],
    one_over_radii_squared: [1., 1., 1.],
    center_tolerance_squared: 0.1,
};

impl<F: Float + One<F>> Ellipsoid<F> {
    pub fn semi_major_axis(&self) -> F {
        self.a
    }

    pub fn semi_minor_axis(&self) -> F {
        self.b
    }

    pub fn flattening(&self) -> F {
        let a = self.semi_major_axis();
        let b = self.semi_minor_axis();
        (a - b) / a
    }

    pub fn eccentricity(&self) -> F {
        let a = self.semi_major_axis();
        let b = self.semi_minor_axis();
        (a.powi(2) - b.powi(2)).sqrt() / a
    }

    pub fn eccentricity_squared(&self) -> F {
        let a = self.semi_major_axis();
        let b = self.semi_minor_axis();
        F::one() - (b.powi(2) / a.powi(2))
    }

    pub fn lle_to_xyz(&self, lle: LLE<F, Radians>) -> XYZ<F> {
        let a = self.semi_major_axis();
        let e2 = self.eccentricity_squared();
        let h = lle.height.val();
        let lat = lle.lat;
        let lon = lle.lng;

        let n = a / (F::one() - e2 * lat.sin().powi(2)).sqrt();
        let x = (n + h) * lat.cos() * lon.cos();
        let y = (n + h) * lat.cos() * lon.sin();
        let z = (n * (F::one() - e2) + h) * lat.sin();

        XYZ {
            x: Meters::new(x),
            y: Meters::new(y),
            z: Meters::new(z),
        }
    }

    pub fn xyz_to_lle(&self, xyz: XYZ<F>) -> LLE<F, Radians> {
        let a = self.semi_major_axis();
        let b = self.semi_minor_axis();
        let e2 = self.eccentricity_squared();
        let x = xyz.x.val();
        let y = xyz.y.val();
        let z = xyz.z.val();

        let p = (x.powi(2) + y.powi(2)).sqrt();
        let theta = (z * a).atan2(p * b);

        let lon = y.atan2(x);
        let lat = (z + e2 * a * (theta.sin().powi(3))).atan2(p - e2 * a * (theta.cos().powi(3)));

        let n = a / (F::one() - e2 * lat.sin().powi(2)).sqrt();
        let x_surface = n * lat.cos() * lon.cos();
        let y_surface = n * lat.cos() * lon.sin();
        let z_surface = (n * (F::one() - e2)) * lat.sin();

        // Calculate the distance from the surface of ellipsoid as height
        let dx = x - x_surface;
        let dy = y - y_surface;
        let dz = z - z_surface;
        let h = (dx.powi(2) + dy.powi(2) + dz.powi(2)).sqrt();

        LLE {
            lat: Rad::new(lat),
            lng: Rad::new(lon),
            height: Meters::new(h),
        }
    }

    // Ref: https://github.com/CesiumGS/cesium/blob/11dd728dfee6c10657f8e1197776fc5a9237ef85/packages/engine/Source/Core/Ellipsoid.js#L333
    pub fn geodetic_surface_normal_from_lle(&self, lle: LLE<F, Radians>) -> XYZ<F> {
        let lng = lle.lng;
        let lat = lle.lat;
        let cos_latitude = lat.cos();

        let x = cos_latitude * lng.cos();
        let y = cos_latitude * lng.sin();
        let z = lat.sin();

        XYZ {
            x: Meters::new(x),
            y: Meters::new(y),
            z: Meters::new(z),
        }
    }

    // Ref: https://github.com/CesiumGS/cesium/blob/11dd728dfee6c10657f8e1197776fc5a9237ef85/packages/engine/Source/Core/Ellipsoid.js#L333
    pub fn geodetic_surface_normal_from_vec3(&self, xyz: XYZ<F>) -> XYZ<F> {
        XYZ {
            x: Meters::new(xyz.x.val() * self.one_over_radii_squared[0]),
            y: Meters::new(xyz.y.val() * self.one_over_radii_squared[1]),
            z: Meters::new(xyz.z.val() * self.one_over_radii_squared[2]),
        }
    }

    // Ref: https://github.com/CesiumGS/cesium/blob/11dd728dfee6c10657f8e1197776fc5a9237ef85/packages/engine/Source/Core/Ellipsoid.js#L591
    pub fn transform_position_to_scaled_space(&self, position: [F; 3]) -> [F; 3] {
        [
            position[0] * self.one_over_radii[0],
            position[1] * self.one_over_radii[1],
            position[2] * self.one_over_radii[2],
        ]
    }
}

impl Ellipsoid<FloatType> {
    // Ref: https://github.com/CesiumGS/cesium/blob/11dd728dfee6c10657f8e1197776fc5a9237ef85/packages/engine/Source/Core/Ellipsoid.js#L538
    pub fn scale_to_geodetic_surface(&self, p: Vec3) -> Option<Vec3> {
        scale_to_geodetic_surface(
            p,
            &self.one_over_radii,
            &self.one_over_radii_squared,
            self.center_tolerance_squared as f64,
        )
    }
}

impl<F: Float + One<F>> LLE<F, Radians> {
    pub fn to_xyz(self, e: Ellipsoid<F>) -> XYZ<F> {
        e.lle_to_xyz(self)
    }
}

impl<F: Float + One<F>> XYZ<F> {
    pub fn to_lle(self, e: Ellipsoid<F>) -> LLE<F, Radians> {
        e.xyz_to_lle(self)
    }
}

#[cfg(test)]
mod tests {
    use approx::assert_abs_diff_eq;

    use super::*;
    use crate::Deg;

    #[test]
    fn test_ellipsoid() {
        let e = WGS84_64;
        assert_eq!(e.semi_major_axis(), WGS84_A_64);
        assert_eq!(e.semi_minor_axis(), WGS84_B_64);

        let lle = LLE {
            lat: Rad::new(0.0),
            lng: Rad::new(0.0),
            height: Meters::new(0.0),
        };
        let xyz = lle.to_xyz(e);
        assert_eq!(xyz.x.val(), 6378137.0);
        assert_eq!(xyz.y.val(), 0.0);
        assert_eq!(xyz.z.val(), 0.0);

        let lle = xyz.to_lle(e);
        assert_eq!(lle.lat, Rad::new(0.0));
        assert_eq!(lle.lng, Rad::new(0.0));
        assert_eq!(lle.height, Meters::new(0.0));

        let lle = LLE {
            lat: Deg::new(34.00000048),
            lng: Deg::new(-117.3335693),
            height: Meters::new(251.702),
        };
        let xyz = lle.rad().to_xyz(e);
        assert!((-2430601.8 - xyz.x.val()).abs() < 0.1, "x: {}", xyz.x.val());
        assert!((-4702442.7 - xyz.y.val()).abs() < 0.1, "y: {}", xyz.y.val());
        assert!((3546587.4 - xyz.z.val()).abs() < 0.1, "z: {}", xyz.z.val());
    }

    #[test]
    fn test_height() {
        let lle = WGS84_32.xyz_to_lle(XYZ {
            x: Meters::new(-3959344.115631663),
            y: Meters::new(3_351_691.3),
            z: Meters::new(3_699_403.3),
        });
        let lng = lle.lng;
        let lat = lle.lat;
        let height = lle.height;

        // Calculated by Cesium
        let expected = (2.439_118_4, 0.622_666_8, 581.580);

        assert_abs_diff_eq!(lng.val(), expected.0, epsilon = 0.0001);
        assert_abs_diff_eq!(lat.val(), expected.1, epsilon = 0.0001);
        assert_abs_diff_eq!(height.val(), expected.2, epsilon = 0.5);
    }

    #[test]
    fn it_should_scale_coordinates_to_geodetic_surface() {
        // X
        let expected = Vec3::new(1.0, 0.0, 0.0);
        let p = Vec3::new(9.0, 0.0, 0.0);
        assert_eq!(
            UNIT_SPHERE_32.scale_to_geodetic_surface(p).unwrap(),
            expected
        );
        // Y
        let expected = Vec3::new(0.0, 1.0, 0.0);
        let p = Vec3::new(0.0, 8.0, 0.0);
        assert_eq!(
            UNIT_SPHERE_32.scale_to_geodetic_surface(p).unwrap(),
            expected
        );
        // Z
        let expected = Vec3::new(0.0, 0.0, 1.0);
        let p = Vec3::new(0.0, 0.0, 8.0);
        assert_eq!(
            UNIT_SPHERE_32.scale_to_geodetic_surface(p).unwrap(),
            expected
        );
        // XYZ
        let expected = Vec3::new(0.45584232, 0.5698029, 0.68376344);
        let p = Vec3::new(4.0, 5.0, 6.0);
        assert_eq!(
            UNIT_SPHERE_32.scale_to_geodetic_surface(p).unwrap(),
            expected
        );
    }
}
