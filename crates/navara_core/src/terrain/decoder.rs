// Based on deck.gl's idea: https://deck.gl/docs/api-reference/geo-layers/terrain-layer#elevationdecoder
#[derive(Debug, Clone, PartialEq, Default)]
pub struct ElevationDecoder {
    pub r_scaler: f32,
    pub g_scaler: f32,
    pub b_scaler: f32,
    pub offset: f32,
    pub max_offset: f32,
    pub min_offset: f32,
    pub boundary: f32,
    pub epsilon: f32,
}
