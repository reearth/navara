use crate::Geometry;
use navara_core::{Ellipsoid, Extent, Meters, Radians, LLE};
use navara_math::FloatType;

/// Construct a flat tile geometry.
pub fn tile_triangles_flat(
    ellipsoid: Ellipsoid<FloatType>,
    extent: &Extent<FloatType, Radians>,
    segments: usize,
    height: FloatType,
) -> Geometry {
    tile_triangles(ellipsoid, extent, segments, &mut |_, _| height)
}

/// Calculate a tile geometry.
pub(crate) fn tile_triangles<F: FnMut(usize, usize) -> FloatType>(
    ellipsoid: Ellipsoid<FloatType>,
    extent: &Extent<FloatType, Radians>,
    segments: usize,
    height: &mut F,
) -> Geometry {
    let segments = if segments == 0 { 1 } else { segments };

    let verties_count = (segments + 1) * (segments + 1);
    let mut vertices = Vec::with_capacity(verties_count);
    let mut uvs = Vec::with_capacity(verties_count);
    let mut indices = Vec::with_capacity(segments * segments * 6);

    let dlng = (extent.east - extent.west) / segments as FloatType;
    let dlat = (extent.north - extent.south) / segments as FloatType;

    for i in 0..=segments {
        for j in 0..=segments {
            let lle = LLE {
                lng: extent.west + dlng * i as FloatType,
                lat: extent.south + dlat * j as FloatType,
                height: Meters::new(height(i, j)),
            };
            let xyz = lle.to_xyz(ellipsoid);

            vertices.push(xyz.x.val());
            vertices.push(xyz.y.val());
            vertices.push(xyz.z.val());

            uvs.push(i as FloatType / segments as FloatType);
            uvs.push(j as FloatType / segments as FloatType);

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
