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

// https://maps.gsi.go.jp/development/demtile.html
// x = R * {r_scaler} + G * {g_scaler} + B * {b_scaler}
// IF x < {boundary},　h = x * {epsilon}
// IF x = {boundary},　h = NA
// IF x > {boundary},　h = (x - {max_offset}) * {epsilon}
pub const JAPAN_GSI_ELEVATION_DECODER: ElevationDecoder = ElevationDecoder {
    r_scaler: 65536.,
    g_scaler: 256.,
    b_scaler: 1.,
    offset: 0.,
    max_offset: -16777216.,
    min_offset: 0.,
    boundary: 8388608.,
    epsilon: 0.01,
};

// https://docs.mapbox.com/data/tilesets/guides/access-elevation-data/#decode-data
// elevation = {offset} + (({R} * {r_scaler} + {G} * {g_scaler} + {B} * {b_scaler}) * {epsilon})
pub const MAPBOX_ELEVATION_DECODER: ElevationDecoder = ElevationDecoder {
    r_scaler: 65536.,
    g_scaler: 256.,
    b_scaler: 1.,
    offset: -10000.,
    epsilon: 0.1,
    boundary: 10000.,

    // Unused
    max_offset: 0.,
    min_offset: 0.,
};

// https://github.com/tilezen/joerd/blob/0b86765156d0612d837548c2cf70376c43b3405c/docs/formats.md#terrarium
// elevation = {offset} + ({R} * {r_scaler} + {G} * {g_scaler} + {B} * {b_scaler})
pub const TERRARIUM_ELEVATION_DECODER: ElevationDecoder = ElevationDecoder {
    r_scaler: 256.,
    g_scaler: 1.,
    b_scaler: 1.0 / 256.0,
    offset: -32768.,

    // Unused
    epsilon: 1.,
    boundary: 0.,
    max_offset: 0.,
    min_offset: 0.,
};
