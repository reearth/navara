use navara_math::{FloatType, RawDVec3, Vec3};

// pub use radians::*;
use crate::unit::{Angle, Degrees, Float, Meters, Radians, Unit};

#[derive(Copy, Clone, PartialEq)]
pub struct LngLat<F: Float, U: Unit<F>> {
    pub lat: Angle<F, U>,
    pub lng: Angle<F, U>,
}

impl<F: Float + std::fmt::Debug, U: Unit<F>> std::fmt::Debug for LngLat<F, U> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "LngLat({:?}, {:?})", self.lng, self.lat)
    }
}

impl<F: Float + std::fmt::Display, U: Unit<F>> std::fmt::Display for LngLat<F, U> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "LngLat({}, {})", self.lng, self.lat)
    }
}

impl<F: Float, U: Unit<F>> LngLat<F, U> {
    pub fn with_elevation(&self, elevation: Meters<F>) -> LLE<F, U> {
        LLE {
            lat: self.lat,
            lng: self.lng,
            height: elevation,
        }
    }
}

impl<F: Float, U: Unit<F>> From<LLE<F, U>> for LngLat<F, U> {
    fn from(lle: LLE<F, U>) -> Self {
        Self {
            lat: lle.lat,
            lng: lle.lng,
        }
    }
}

impl<F: Float> LngLat<F, Radians> {
    pub fn deg(self) -> LngLat<F, Degrees> {
        LngLat {
            lat: self.lat.deg(),
            lng: self.lng.deg(),
        }
    }
}

impl<F: Float> LngLat<F, Degrees> {
    pub fn rad(self) -> LngLat<F, Radians> {
        LngLat {
            lat: self.lat.rad(),
            lng: self.lng.rad(),
        }
    }
}

#[derive(PartialEq, Default)]
pub struct LLE<F: Float, U: Unit<F>> {
    pub lat: Angle<F, U>,
    pub lng: Angle<F, U>,
    pub height: Meters<F>,
}

impl<F: Float, U: Unit<F>> LLE<F, U> {
    pub fn from_float(lng: F, lat: F, height: F) -> Self {
        Self {
            lng: Angle::new(lng),
            lat: Angle::new(lat),
            height: Meters::new(height),
        }
    }
}

impl<F: Float + std::fmt::Debug, U: Unit<F>> std::fmt::Debug for LLE<F, U> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "LLE({:?}, {:?}, {:?})", self.lng, self.lat, self.height)
    }
}

impl<F: Float + std::fmt::Display, U: Unit<F>> std::fmt::Display for LLE<F, U> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "LLE({}, {}, {})", self.lng, self.lat, self.height)
    }
}

impl<F: Float, U: Unit<F>> From<LngLat<F, U>> for LLE<F, U> {
    fn from(lle: LngLat<F, U>) -> Self {
        Self {
            lat: lle.lat,
            lng: lle.lng,
            height: Meters::new(F::ZERO),
        }
    }
}

impl<F: Float> LLE<F, Degrees> {
    pub fn rad(self) -> LLE<F, Radians> {
        LLE {
            lat: self.lat.rad(),
            lng: self.lng.rad(),
            height: self.height,
        }
    }
}

impl<F: Float> LLE<F, Radians> {
    pub fn deg(self) -> LLE<F, Degrees> {
        LLE {
            lat: self.lat.deg(),
            lng: self.lng.deg(),
            height: self.height,
        }
    }
}

impl<F: Float> Copy for LLE<F, Radians> {}
impl<F: Float> Clone for LLE<F, Radians> {
    fn clone(&self) -> Self {
        *self
    }
}

impl<F: Float> Copy for LLE<F, Degrees> {}
impl<F: Float> Clone for LLE<F, Degrees> {
    fn clone(&self) -> Self {
        *self
    }
}

#[derive(Debug, Copy, Clone, PartialEq, Default)]
pub struct XYZ<F: Float> {
    pub x: Meters<F>,
    pub y: Meters<F>,
    pub z: Meters<F>,
}

impl From<XYZ<f32>> for Vec3 {
    fn from(val: XYZ<FloatType>) -> Self {
        xyz_to_vec3(val)
    }
}
impl From<Vec3> for XYZ<f32> {
    fn from(val: Vec3) -> Self {
        vec3_to_xyz(val)
    }
}

impl From<XYZ<f64>> for RawDVec3 {
    fn from(val: XYZ<f64>) -> Self {
        xyz_to_dvec3(val)
    }
}
impl From<RawDVec3> for XYZ<f64> {
    fn from(val: RawDVec3) -> Self {
        dvec3_to_xyz(val)
    }
}

pub fn xyz_to_vec3(xyz: XYZ<f32>) -> Vec3 {
    Vec3::new(xyz.x.val(), xyz.y.val(), xyz.z.val())
}

pub fn vec3_to_xyz(vec: Vec3) -> XYZ<f32> {
    XYZ {
        x: Meters::new(vec.x),
        y: Meters::new(vec.y),
        z: Meters::new(vec.z),
    }
}

pub fn xyz_to_dvec3(xyz: XYZ<f64>) -> RawDVec3 {
    RawDVec3::new(xyz.x.val(), xyz.y.val(), xyz.z.val())
}

pub fn dvec3_to_xyz(vec: RawDVec3) -> XYZ<f64> {
    XYZ {
        x: Meters::new(vec.x),
        y: Meters::new(vec.y),
        z: Meters::new(vec.z),
    }
}

/// Coordinate reference system
#[derive(Debug, Clone, PartialEq, Default)]
pub enum CRS {
    /// EPSG:4326
    #[default]
    Geographic,
    /// EPSG:4978
    Geocentric,
    ESPG {
        code: String,
    },
}
