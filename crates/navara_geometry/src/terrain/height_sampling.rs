use navara_core::{Extent, LngLat, Radians, lerp};
use navara_math::FloatType;

use crate::tile::mercator_y;

/// Height of a triangle-mesh surface at a point in a tile's normalized (u, v)
/// space, interpolated across the triangle containing it. Sampling the nearest
/// vertex instead is piecewise constant, so anything following the surface as
/// it moves stutters and reads a height the rendered mesh does not have.
///
/// `interleaved` is (u, v, height) per vertex and `indices` three vertex
/// indices per triangle – the mesh's own topology. Points outside every
/// triangle fall back to the nearest vertex.
///
/// `search_hint` is the triangle to test first, updated to whichever answered.
/// Passing it back each time turns the scan into a hit on the first test, since
/// successive samples of a moving point share a triangle or a neighbour.
pub fn sample_mesh_height(
    interleaved: &[f32],
    indices: &[u32],
    u: f32,
    v: f32,
    search_hint: &mut usize,
) -> f32 {
    let vertex_count = interleaved.len() / 3;
    let triangle_count = indices.len() / 3;
    let vertex = |i: u32| -> (f32, f32, f32) {
        let base = i as usize * 3;
        (
            interleaved[base],
            interleaved[base + 1],
            interleaved[base + 2],
        )
    };

    for offset in 0..triangle_count {
        let triangle = (*search_hint + offset) % triangle_count;
        let (i0, i1, i2) = (
            indices[triangle * 3],
            indices[triangle * 3 + 1],
            indices[triangle * 3 + 2],
        );
        if i0 as usize >= vertex_count || i1 as usize >= vertex_count || i2 as usize >= vertex_count
        {
            continue;
        }
        let (u0, v0, h0) = vertex(i0);
        let (u1, v1, h1) = vertex(i1);
        let (u2, v2, h2) = vertex(i2);

        // Barycentric weights, left scaled by the triangle's signed area so the
        // rejection test is a sign check with no division. Only the triangle
        // that answers pays for the divide.
        let area = (v1 - v2) * (u0 - u2) + (u2 - u1) * (v0 - v2);
        if area == 0.0 {
            continue;
        }
        let w0 = (v1 - v2) * (u - u2) + (u2 - u1) * (v - v2);
        let w1 = (v2 - v0) * (u - u2) + (u0 - u2) * (v - v2);
        let w2 = area - w0 - w1;
        // A point on a shared edge has to land on one of the two triangles
        // rather than fall through to the nearest-vertex scan.
        let tolerance = area.abs() * EDGE_TOLERANCE;
        let inside = if area > 0.0 {
            w0 >= -tolerance && w1 >= -tolerance && w2 >= -tolerance
        } else {
            w0 <= tolerance && w1 <= tolerance && w2 <= tolerance
        };
        if !inside {
            continue;
        }

        *search_hint = triangle;
        return (w0 * h0 + w1 * h1 + w2 * h2) / area;
    }

    let mut best_dist_sq = f32::INFINITY;
    let mut best_height = 0.0f32;
    for i in 0..vertex_count {
        let (vu, vv, vh) = vertex(i as u32);
        let du = vu - u;
        let dv = vv - v;
        let dist_sq = du * du + dv * dv;
        if dist_sq < best_dist_sq {
            best_dist_sq = dist_sq;
            best_height = vh;
        }
    }
    best_height
}

/// How far outside a triangle, relative to its area, a point may sit and still
/// be treated as inside it.
const EDGE_TOLERANCE: f32 = 1e-5;

/// Height of a raster-DEM tile at a point, bilinear between the four
/// surrounding grid samples. `heights` is the decoded square grid with row 0
/// at the tile's south edge. The grid is a WebMercator tile image: rows are
/// uniform in Mercator northing, so the row lookup uses the Mercator fraction,
/// not the latitude fraction. Rounding to the nearest sample instead holds one
/// texel's height across its whole footprint, which stutters for anything
/// tracking the surface as it moves. This reads the DEM grid, while the mesh
/// drawn from it is a martini simplification of the same grid, so the two
/// diverge by the mesh's error budget where samples were dropped.
pub fn sample_dem_grid_height(
    extent: &Extent<FloatType, Radians>,
    heights: &[f32],
    point: &LngLat<FloatType, Radians>,
) -> Option<FloatType> {
    let length = heights.len();
    let width = (length as FloatType).sqrt() as usize;
    if width == 0 {
        return None;
    }

    let east = extent.east;
    let north = extent.north;
    let west = extent.west;
    let south = extent.south;

    let dist_ew = (east - west).val();
    let merc_south = mercator_y(south.val());
    let merc_ns = mercator_y(north.val()) - merc_south;
    if dist_ew == 0.0 || merc_ns == 0.0 {
        return None;
    }

    let dist_wlng = (point.lng - west).val();
    let merc_slat = mercator_y(point.lat.val()) - merc_south;

    let last = (width - 1) as FloatType;
    let fx = ((dist_wlng / dist_ew) * last).clamp(0., last);
    let fy = ((merc_slat / merc_ns) * last).clamp(0., last);

    let x0 = fx.floor() as usize;
    let y0 = fy.floor() as usize;
    let x1 = (x0 + 1).min(width - 1);
    let y1 = (y0 + 1).min(width - 1);
    let tx = fx - x0 as FloatType;
    let ty = fy - y0 as FloatType;

    // Both axes are clamped to the grid, so every index is in range.
    let at = |x: usize, y: usize| heights[(x + y * width).min(length - 1)] as FloatType;
    let bottom = lerp(at(x0, y0), at(x1, y0), tx);
    let top = lerp(at(x0, y1), at(x1, y1), tx);
    Some(lerp(bottom, top, ty))
}

#[cfg(test)]
mod test {
    use super::sample_mesh_height;

    // Unit square split into two triangles, with a height at each corner:
    //   (0,0)=0  (1,0)=10  (0,1)=20  (1,1)=30
    const VERTICES: [f32; 12] = [
        0.0, 0.0, 0.0, //
        1.0, 0.0, 10.0, //
        0.0, 1.0, 20.0, //
        1.0, 1.0, 30.0,
    ];
    const INDICES: [u32; 6] = [0, 1, 2, 1, 3, 2];

    fn sample(u: f32, v: f32) -> f32 {
        sample_mesh_height(&VERTICES, &INDICES, u, v, &mut 0)
    }

    #[test]
    fn returns_the_exact_height_at_a_vertex() {
        assert_eq!(sample(0.0, 0.0), 0.0);
        assert_eq!(sample(1.0, 0.0), 10.0);
        assert_eq!(sample(1.0, 1.0), 30.0);
    }

    #[test]
    fn interpolates_across_a_triangle() {
        // Midpoint of the (0,0)-(1,0) edge: halfway between 0 and 10.
        assert!((sample(0.5, 0.0) - 5.0).abs() < 1e-5);
        // Centre of the lower-left triangle: the mean of 0, 10 and 20.
        assert!((sample(1.0 / 3.0, 1.0 / 3.0) - 10.0).abs() < 1e-5);
    }

    #[test]
    fn is_continuous_as_the_sample_point_moves() {
        // The whole point of interpolating: no step as the point crosses the
        // diagonal shared by the two triangles.
        let mut previous = sample(0.0, 1.0);
        for step in 1..=100 {
            let t = step as f32 / 100.0;
            let height = sample(t, 1.0 - t);
            assert!(
                (height - previous).abs() < 1.0,
                "step of {} at t={t}",
                height - previous
            );
            previous = height;
        }
    }

    #[test]
    fn falls_back_to_the_nearest_vertex_outside_the_mesh() {
        assert_eq!(sample(2.0, 2.0), 30.0);
    }

    #[test]
    fn answers_the_same_from_any_search_hint() {
        // The hint only picks where the scan starts, never which triangle the
        // point is in — a stale hint from an earlier sample must not change
        // the answer.
        for hint in 0..4 {
            let mut search_hint = hint;
            let height = sample_mesh_height(&VERTICES, &INDICES, 0.25, 0.25, &mut search_hint);
            assert!((height - 7.5).abs() < 1e-5, "hint {hint} gave {height}");
        }
    }

    #[test]
    fn reports_the_triangle_that_answered() {
        let mut search_hint = 0;
        sample_mesh_height(&VERTICES, &INDICES, 0.9, 0.9, &mut search_hint);
        // The upper-right triangle, so the next sample nearby starts there.
        assert_eq!(search_hint, 1);
    }
}
