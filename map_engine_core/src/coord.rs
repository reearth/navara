// pub use radians::*;
use crate::unit::{Angle, Degrees, Float, Meters, Radians, Unit};

#[derive(Debug, Copy, Clone, PartialEq)]
pub struct LngLat<F: Float, U: Unit<F>> {
    pub lat: Angle<F, U>,
    pub lng: Angle<F, U>,
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

#[derive(Debug, Copy, Clone, PartialEq, Default)]
pub struct LLE<F: Float, U: Unit<F>> {
    pub lat: Angle<F, U>,
    pub lng: Angle<F, U>,
    pub height: Meters<F>,
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

#[derive(Debug, Copy, Clone, PartialEq, Default)]
pub struct XYZ<F: Float> {
    pub x: Meters<F>,
    pub y: Meters<F>,
    pub z: Meters<F>,
}
