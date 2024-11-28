use navara_tile_component::RasterDEMData;
use navara_wasm_types::ElevationDecoder;
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub struct TransferableRasterDEMData {
    pub decoder: ElevationDecoder,
}

#[wasm_bindgen]
impl TransferableRasterDEMData {
    #[wasm_bindgen(constructor)]
    pub fn new(decoder: ElevationDecoder) -> Self {
        Self { decoder }
    }
}

impl<'a> From<&'a RasterDEMData> for TransferableRasterDEMData {
    fn from(value: &'a RasterDEMData) -> Self {
        Self {
            decoder: value.decoder.into(),
        }
    }
}

impl From<TransferableRasterDEMData> for RasterDEMData {
    fn from(value: TransferableRasterDEMData) -> Self {
        Self::new(value.decoder.into())
    }
}
