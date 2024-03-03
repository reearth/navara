use crate::{Ellipsoid, Extent, Meters, Radians, LLE};

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
    tile_triangles(ellipsoid, extent, segments, |_, _| height)
}

pub fn tile_triangles_with_terrain(
    ellipsoid: Ellipsoid<f32>,
    extent: Extent<f32, Radians>,
    segments: usize,
    geoid_height: f32,
    terrain: &[u8],
    terrain_w: usize,
    terrain_h: usize,
) -> Geometry {
    let height = |x: usize, y: usize| -> f32 {
        let image_x = (x / segments) * (terrain_w - 1);
        let image_y = (1 - y / segments) * (terrain_h - 1);

        let i = image_y * terrain_w + image_x;
        let r = terrain[i * 4] as f32;
        let g = terrain[i * 4 + 1] as f32;
        let b = terrain[i * 4 + 2] as f32;

        // https://maps.gsi.go.jp/development/demtile.html
        let h = if r != 128.0 || g != 0.0 || b != 0.0 {
            if r >= 128.0 {
                r * 655.36 + g * 2.56 + b * 0.01 - 167772.16
            } else {
                r * 655.36 + g * 2.56 + b * 0.01
            }
        } else {
            0.0
        };

        h + geoid_height
    };

    tile_triangles(ellipsoid, extent, segments, height)
}

pub fn tile_triangles<F: Fn(usize, usize) -> f32>(
    ellipsoid: Ellipsoid<f32>,
    extent: Extent<f32, Radians>,
    segments: usize,
    height: F,
) -> Geometry {
    let segments = if segments == 0 { 1 } else { segments };

    let verties_count = (segments + 1) * (segments + 1);
    let mut vertices = Vec::with_capacity(verties_count);
    let mut uvs = Vec::with_capacity(verties_count);
    let mut indices = Vec::with_capacity(segments * segments * 6);

    let dlat = (extent.east - extent.west) / segments as f32;
    let dlng = (extent.north - extent.south) / segments as f32;

    for i in 0..=segments {
        for j in 0..=segments {
            let lle = LLE {
                lng: extent.west + dlat * i as f32,
                lat: extent.south + dlng * j as f32,
                height: Meters::new(height(i, j)),
            };
            let xyz = lle.to_xyz(ellipsoid);

            vertices.push([xyz.x.val(), xyz.y.val(), xyz.z.val()]);
            uvs.push([i as f32 / segments as f32, j as f32 / segments as f32]);
        }
    }

    for i in 0..segments {
        for j in 0..segments {
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

    Geometry {
        vertices,
        uvs,
        indices,
    }
}
