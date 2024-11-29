use navara_math::FloatType;
// Based on deck.gl's idea: https://deck.gl/docs/api-reference/geo-layers/terrain-layer#elevationdecoder
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct ElevationDecoder {
    pub r_scaler: FloatType,
    pub g_scaler: FloatType,
    pub b_scaler: FloatType,
    pub offset: FloatType,
    pub max_offset: FloatType,
    pub min_offset: FloatType,
    pub boundary: FloatType,
    pub epsilon: FloatType,
}
