use navara_math::{Quat, Transform, Vec3};

// pub use radians::*;
use crate::{
    Ellipsoid, WGS84_64,
    unit::{Angle, Degrees, Float, Meters, Radians, Unit},
};

#[derive(PartialEq)]
pub struct LngLat<F: Float, U: Unit<F>> {
    pub lat: Angle<F, U>,
    pub lng: Angle<F, U>,
}

impl<F: Float, U: Unit<F>> LngLat<F, U> {
    pub fn new(lat: F, lng: F) -> Self {
        Self {
            lat: Angle::new(lat),
            lng: Angle::new(lng),
        }
    }
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

impl<F: Float, U: Unit<F>> Copy for LngLat<F, U> {}
impl<F: Float, U: Unit<F>> Clone for LngLat<F, U> {
    fn clone(&self) -> Self {
        *self
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

    pub fn max(&self, v: &Self) -> Self {
        Self {
            lng: self.lng.max(v.lng),
            lat: self.lat.max(v.lat),
        }
    }

    pub fn min(&self, v: &Self) -> Self {
        Self {
            lng: self.lng.min(v.lng),
            lat: self.lat.min(v.lat),
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

impl<F: Float, U: Unit<F>> Copy for LLE<F, U> {}
impl<F: Float, U: Unit<F>> Clone for LLE<F, U> {
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

impl From<XYZ<f64>> for Vec3 {
    fn from(val: XYZ<f64>) -> Self {
        xyz_to_vec3(val)
    }
}
impl From<Vec3> for XYZ<f64> {
    fn from(val: Vec3) -> Self {
        vec3_to_xyz(val)
    }
}

pub fn xyz_to_vec3(xyz: XYZ<f64>) -> Vec3 {
    Vec3::new(xyz.x.val(), xyz.y.val(), xyz.z.val())
}

pub fn vec3_to_xyz(vec: Vec3) -> XYZ<f64> {
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

impl CRS {
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(v: &str) -> Self {
        match v {
            "EPSG:4326" => CRS::Geographic,
            "EPSG:4978" => CRS::Geocentric,
            _ => CRS::ESPG {
                code: v.to_string(),
            },
        }
    }

    pub fn to_vec3(&self, ellipsoid: Ellipsoid<f64>, coords: Vec3, height: f32) -> Vec3 {
        match self {
            CRS::Geographic => {
                let lng = coords.x;
                let lat = coords.y;
                let alt = coords.z;

                xyz_to_vec3(
                    LLE {
                        lng: Angle::new(lng),
                        lat: Angle::new(lat),
                        height: Meters::new(alt + height as f64),
                    }
                    .rad()
                    .to_xyz(ellipsoid),
                )
            }
            CRS::Geocentric => {
                if height == 0. {
                    return coords;
                }
                let mut lle = vec3_to_xyz(coords).to_lle(ellipsoid);
                lle.height = Meters::new(lle.height.val() + height as f64);
                lle.to_xyz(ellipsoid).into()
            }
            CRS::ESPG { code: _ } => unimplemented!(),
        }
    }

    pub fn to_lle(
        &self,
        ellipsoid: Ellipsoid<f64>,
        coords: Vec3,
        height: f32,
    ) -> LLE<f64, Radians> {
        match self {
            CRS::Geographic => {
                let lng = coords.x;
                let lat = coords.y;
                let alt = coords.z;

                LLE {
                    lng: Angle::new(lng),
                    lat: Angle::new(lat),
                    height: Meters::new(alt + height as f64),
                }
                .rad()
            }
            CRS::Geocentric => {
                let mut lle = vec3_to_xyz(coords).to_lle(ellipsoid);
                lle.height = Meters::new(lle.height.val() + height as f64);
                lle
            }
            CRS::ESPG { code: _ } => unimplemented!(),
        }
    }

    pub fn to_lng_lat(&self, ellipsoid: Ellipsoid<f64>, coords: Vec3) -> LngLat<f64, Radians> {
        match self {
            CRS::Geographic => {
                let lng = coords.x;
                let lat = coords.y;

                LngLat {
                    lng: Angle::new(lng),
                    lat: Angle::new(lat),
                }
                .rad()
            }
            CRS::Geocentric => {
                let lle = vec3_to_xyz(coords).to_lle(ellipsoid);
                LngLat {
                    lng: lle.lng,
                    lat: lle.lat,
                }
            }
            CRS::ESPG { code: _ } => unimplemented!(),
        }
    }
}

pub fn calc_transform(
    coordinates: &Vec3,
    crs: &CRS,
    m_height: f32,
    m_size: f32,
    need_rotate: bool,
) -> Transform {
    let position = crs.to_vec3(WGS84_64, *coordinates, m_height);

    let mut transform = Transform::from_translation(position).with_scale(Vec3::new(
        m_size as f64,
        m_size as f64,
        m_size as f64,
    ));

    if need_rotate {
        let lng = coordinates.x.to_radians();
        let lat = coordinates.y.to_radians();
        let rotation_y = Quat::from_rotation_y(-lat);
        let rotation_z = Quat::from_rotation_z(lng);
        let adjust_model = Quat::from_rotation_z(-std::f64::consts::PI / 2.0);
        let rotation = rotation_z * rotation_y * adjust_model;
        transform = transform.with_rotation(rotation);
    }

    transform
}
