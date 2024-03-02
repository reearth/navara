use crate::{Ellipsoid, Extent, Meters, Radians, LLE};

#[derive(Debug, Clone, PartialEq)]
pub struct Geometry {
    pub vertices: Vec<[f32; 3]>,
    pub uvs: Vec<[f32; 2]>,
    pub indices: Vec<u32>,
}

pub fn tile_triangles<F: Fn(usize, usize) -> f32>(
    ellipsoid: Ellipsoid<f32>,
    extent: Extent<f32, Radians>,
    segments: usize,
    height: F,
) -> Geometry {
    let segments = if segments == 0 { 1 } else { segments };

    let mut vertices = Vec::new();
    let mut uvs = Vec::new();
    let mut indices = Vec::new();

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
