use wasm_bindgen::prelude::*;

/// Coordinate reference system
#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Default)]
pub enum CRS {
    /// EPSG:4326
    #[default]
    Geographic,
    /// EPSG:4978
    Geocentric,
    // EPSG,
}

impl<'a> From<&'a CRS> for navara_core::CRS {
    fn from(val: &'a CRS) -> Self {
        match val {
            CRS::Geographic => Self::Geographic,
            CRS::Geocentric => Self::Geocentric,
        }
    }
}

impl From<navara_core::CRS> for CRS {
    fn from(val: navara_core::CRS) -> Self {
        match val {
            navara_core::CRS::Geographic => Self::Geographic,
            navara_core::CRS::Geocentric => Self::Geocentric,
            _ => unimplemented!(),
        }
    }
}
