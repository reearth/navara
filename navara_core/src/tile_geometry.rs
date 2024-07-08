use crate::{terrain::ElevationDecoder, Ellipsoid, Extent, Meters, Radians, LLE};

#[derive(Debug, Clone, PartialEq)]
pub struct Geometry {
    pub vertices: Vec<[f32; 3]>,
    pub uvs: Vec<[f32; 2]>,
    pub indices: Vec<u32>,
}

pub fn tile_triangles_flat(
    ellipsoid: Ellipsoid<f32>,
    extent: Extent<f32, Radians>,
    segments: usize,
    height: f32,
) -> Geometry {
    tile_triangles(ellipsoid, extent, segments, &mut |_, _| height)
}

pub fn decode_height_from_gsi_dem(
    r: i64,
    g: i64,
    b: i64,
    geoid_height: f32,
    decoder: &ElevationDecoder,
) -> f32 {
    let x = r as f32 * decoder.r_scaler + g as f32 * decoder.g_scaler + b as f32 * decoder.b_scaler;
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

pub fn encode_height_to_gsi_dem(
    height: f32,
    geoid_height: f32,
    decoder: &ElevationDecoder,
) -> (i64, i64, i64) {
    let h = ((height - decoder.offset - geoid_height) / decoder.epsilon) as i64;
    let r = (h >> 16) & 255;
    let g = (h >> 8) & 255;
    let b = (h >> 0) & 255;
    (r, g, b)
}

pub fn tile_triangles_with_terrain(
    ellipsoid: Ellipsoid<f32>,
    extent: Extent<f32, Radians>,
    segments: usize,
    geoid_height: f32,
    terrain: &[u8],
    terrain_w: usize,
    terrain_h: usize,
    decoder: &ElevationDecoder,
) -> (Geometry, f32) {
    let mut max_height = 0.0f32;
    let mut height = |x: usize, y: usize| -> f32 {
        let image_x = x * (terrain_w - 1) / segments;
        let image_y = (terrain_h - 1) - y * (terrain_h - 1) / segments;

        let i = image_y * terrain_w + image_x;
        let r = terrain[i * 4] as i64;
        let g = terrain[i * 4 + 1] as i64;
        let b = terrain[i * 4 + 2] as i64;

        let height = decode_height_from_gsi_dem(r, g, b, geoid_height, decoder);

        max_height = max_height.max(height);

        height
    };

    (
        tile_triangles(ellipsoid, extent, segments, &mut height),
        max_height,
    )
}

pub fn tile_triangles<F: FnMut(usize, usize) -> f32>(
    ellipsoid: Ellipsoid<f32>,
    extent: Extent<f32, Radians>,
    segments: usize,
    height: &mut F,
) -> Geometry {
    let segments = if segments == 0 { 1 } else { segments };

    let verties_count = (segments + 1) * (segments + 1);
    let mut vertices = Vec::with_capacity(verties_count);
    let mut uvs = Vec::with_capacity(verties_count);
    let mut indices = Vec::with_capacity(segments * segments * 6);

    let dlng = (extent.east - extent.west) / segments as f32;
    let dlat = (extent.north - extent.south) / segments as f32;

    for i in 0..=segments {
        for j in 0..=segments {
            let lle = LLE {
                lng: extent.west + dlng * i as f32,
                lat: extent.south + dlat * j as f32,
                height: Meters::new(height(i, j)),
            };
            let xyz = lle.to_xyz(ellipsoid);

            vertices.push([xyz.x.val(), xyz.y.val(), xyz.z.val()]);
            uvs.push([i as f32 / segments as f32, j as f32 / segments as f32]);

            if i != segments && j != segments {
                let a = i * (segments + 1) + j;
                let b = (i + 1) * (segments + 1) + j;
                let c = b + 1;
                let d = a + 1;

                indices.push(a as u32);
                indices.push(b as u32);
                indices.push(d as u32);
                indices.push(b as u32);
                indices.push(c as u32);
                indices.push(d as u32);
            }
        }
    }

    Geometry {
        vertices,
        uvs,
        indices,
    }
}

#[cfg(test)]
mod test {
    use crate::{
        terrain::ElevationDecoder,
        tile_geometry::{decode_height_from_gsi_dem, encode_height_to_gsi_dem},
    };

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
        let decoded_rgba = encode_height_to_gsi_dem(expected_height, geoid_height, &decoder);
        let encoded_height = decode_height_from_gsi_dem(
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
        let decoded_rgba = encode_height_to_gsi_dem(expected_height, geoid_height, &decoder);
        let encoded_height = decode_height_from_gsi_dem(
            decoded_rgba.0,
            decoded_rgba.1,
            decoded_rgba.2,
            geoid_height,
            &decoder,
        );
        debug_assert_eq!(encoded_height, expected_height);
    }
}
