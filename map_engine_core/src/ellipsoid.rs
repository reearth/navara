use crate::{Float, Meters, One, Rad, Radians, LLE, XYZ};

#[derive(Debug, Copy, Clone, PartialEq)]
pub struct Ellipsoid<F: Float> {
    pub a: F,
    pub b: F,
}

pub const WGS84_A_64: f64 = 6378137.0;
pub const WGS84_A_32: f32 = 6378137.0;
pub const WGS84_FE_64: f64 = 1.0 / 298.257223563;
#[allow(clippy::excessive_precision)]
pub const WGS84_FE_32: f32 = 1.0 / 298.257223563;
pub const WGS84_B_64: f64 = WGS84_A_64 * (1.0 - WGS84_FE_64);
pub const WGS84_B_32: f32 = WGS84_A_32 * (1.0 - WGS84_FE_32);

pub const WGS84_64: Ellipsoid<f64> = Ellipsoid {
    a: WGS84_A_64,
    b: WGS84_B_64,
};

pub const WGS84_32: Ellipsoid<f32> = Ellipsoid {
    a: WGS84_A_32,
    b: WGS84_B_32,
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
        let e = self.eccentricity();
        e.powi(2)
    }

    pub fn lle_to_xyz(&self, lle: LLE<F, Radians>) -> XYZ<F> {
        let a = self.semi_major_axis();
        let e = self.eccentricity();
        let h = lle.height.val();
        let lat = lle.lat;
        let lon = lle.lng;

        let n = a / (F::one() - e.powi(2) * lat.sin().powi(2)).sqrt();
        let x = (n + h) * lat.cos() * lon.cos();
        let y = (n + h) * lat.cos() * lon.sin();
        let z = (n * (F::one() - e.powi(2)) + h) * lat.sin();

        XYZ {
            x: Meters::new(x),
            y: Meters::new(y),
            z: Meters::new(z),
        }
    }

    pub fn xyz_to_lle(&self, xyz: XYZ<F>) -> LLE<F, Radians> {
        let a = self.semi_major_axis();
        let e = self.eccentricity();
        let x = xyz.x.val();
        let y = xyz.y.val();
        let z = xyz.z.val();

        let p = (x.powi(2) + y.powi(2)).sqrt();
        let theta = (z * a) / (p * e);

        let lon = y.atan2(x);
        let lat = ((z + e.powi(2) * a * (theta.sin().powi(3)))
            / (p - e.powi(2) * a * (theta.cos().powi(3))))
        .atan();
        let h = (p / lat.cos()) - (a / (F::one() - e.powi(2) * lat.sin().powi(2)).sqrt());

        LLE {
            lat: Rad::new(lat),
            lng: Rad::new(lon),
            height: Meters::new(h),
        }
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
    use super::*;

    #[test]
    fn test_ellipsoid() {
        let e = WGS84_64;
        assert_eq!(e.semi_major_axis(), 6378137.0);
        assert_eq!(e.semi_minor_axis(), 6356752.314245);

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
    }
}
