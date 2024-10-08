use crate::{tile_triangles, Geometry};
use navara_core::{ElevationDecoder, Ellipsoid, Extent, Radians};
use navara_math::FloatType;

/// Decode pixels to a terrain height.
pub fn decode_height_from_dem(
    r: i64,
    g: i64,
    b: i64,
    geoid_height: FloatType,
    decoder: &ElevationDecoder,
) -> FloatType {
    let x = r as FloatType * decoder.r_scaler
        + g as FloatType * decoder.g_scaler
        + b as FloatType * decoder.b_scaler;
    let h = if x != decoder.boundary {
        if x > decoder.boundary {
            x + decoder.max_offset
        } else {
            x + decoder.min_offset
        }
    } else {
        0.
    };
    h * decoder.epsilon + decoder.offset + geoid_height
}

/// Encode a terrain height to pixels.
pub fn encode_height_to_dem(
    height: FloatType,
    geoid_height: FloatType,
    decoder: &ElevationDecoder,
) -> (i64, i64, i64) {
    let h = ((height - decoder.offset - geoid_height) / decoder.epsilon) as i64;
    let r = (h >> 16) & 255;
    let g = (h >> 8) & 255;
    let b = h & 255;
    (r, g, b)
}

/// Construct a terrain geometry.
#[allow(clippy::too_many_arguments)]
pub fn tile_triangles_with_terrain(
    ellipsoid: Ellipsoid<FloatType>,
    extent: &Extent<FloatType, Radians>,
    segments: usize,
    geoid_height: FloatType,
    terrain: &[u8],
    terrain_w: usize,
    terrain_h: usize,
    decoder: &ElevationDecoder,
) -> (Geometry, FloatType, Vec<FloatType>) {
    let mut max_height = 0.0f32;
    let mut heights = vec![];
    let mut height = |x: usize, y: usize| -> FloatType {
        let image_x = x * (terrain_w - 1) / segments;
        let image_y = (terrain_h - 1) - y * (terrain_h - 1) / segments;

        let i = image_y * terrain_w + image_x;
        let r = terrain[i * 4] as i64;
        let g = terrain[i * 4 + 1] as i64;
        let b = terrain[i * 4 + 2] as i64;

        let height = decode_height_from_dem(r, g, b, geoid_height, decoder);

        max_height = max_height.max(height);
        heights.push(height);

        height
    };

    (
        tile_triangles(ellipsoid, extent, segments, &mut height),
        max_height,
        heights,
    )
}

#[cfg(test)]
mod test {
    use navara_core::ElevationDecoder;

    use crate::{decode_height_from_dem, encode_height_to_dem};

    #[test]
    fn test_gsi_raster_dem_conversion() {
        // https://maps.gsi.go.jp/development/demtile.html
        let decoder = ElevationDecoder {
            r_scaler: 65536.,
            g_scaler: 256.,
            b_scaler: 1.,
            offset: 0.,
            max_offset: -16777216.,
            min_offset: 0.,
            boundary: 8388608.,
            epsilon: 0.01,
        };
        let geoid_height = 1.;
        let expected_height = 3747.95;
        let decoded_rgba = encode_height_to_dem(expected_height, geoid_height, &decoder);
        let encoded_height = decode_height_from_dem(
            decoded_rgba.0,
            decoded_rgba.1,
            decoded_rgba.2,
            geoid_height,
            &decoder,
        );
        debug_assert_eq!(encoded_height, expected_height);
    }

    #[test]
    fn test_mapbox_raster_dem_conversion() {
        // https://docs.mapbox.com/data/tilesets/guides/access-elevation-data/#decode-data
        let decoder = ElevationDecoder {
            r_scaler: 65536.,
            g_scaler: 256.,
            b_scaler: 1.,
            offset: -10000.,
            max_offset: 0.,
            min_offset: 0.,
            boundary: 10000.,
            epsilon: 0.1,
        };
        let geoid_height = 1.;
        let expected_height = 407.2002;
        let decoded_rgba = encode_height_to_dem(expected_height, geoid_height, &decoder);
        let encoded_height = decode_height_from_dem(
            decoded_rgba.0,
            decoded_rgba.1,
            decoded_rgba.2,
            geoid_height,
            &decoder,
        );
        debug_assert_eq!(encoded_height, expected_height);
    }
}
