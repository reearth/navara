use navara_core::utils::lerp;
use navara_math::FloatType;

fn interpolate(start: FloatType, end: FloatType, threshold: FloatType) -> FloatType {
    (threshold - start) / (end - start)
}

/// This is Sutherland–Hodgman based polygon culling algorithm for 2D.
/// Ref: https://github.com/CesiumGS/cesium/blob/7b93161da1cc03bdc796b204e7aa51fb7acebf04/packages/engine/Source/Core/Intersections2D.js#L40
pub(super) fn clip_2d_triangle_at_threshold(
    threshold: FloatType,
    keep_above: bool,
    coords: &[FloatType; 3],
) -> Vec<ClippedIndex> {
    let mut result = vec![];

    let is_behind = |v: FloatType| {
        if keep_above {
            v < threshold
        } else {
            v > threshold
        }
    };

    let v0_behind = is_behind(coords[0]);
    let v1_behind = is_behind(coords[1]);
    let v2_behind = is_behind(coords[2]);

    let behind_count = v0_behind as u8 + v1_behind as u8 + v2_behind as u8;

    match behind_count {
        0 => {
            // Completely in front of threshold
            result.push(ClippedIndex::Idx(0));
            result.push(ClippedIndex::Idx(1));
            result.push(ClippedIndex::Idx(2));
        }
        1 => {
            // A vertex is above the threashold
            if v0_behind {
                handle_single_vertex_behind(coords, 0, 1, 2, threshold, &mut result);
            } else if v1_behind {
                handle_single_vertex_behind(coords, 1, 2, 0, threshold, &mut result);
            } else {
                handle_single_vertex_behind(coords, 2, 0, 1, threshold, &mut result);
            }
        }
        2 => {
            // Two vertices are above the threashold
            if !v0_behind {
                handle_two_vertices_behind(coords, 0, 1, 2, threshold, &mut result);
            } else if !v1_behind {
                handle_two_vertices_behind(coords, 1, 2, 0, threshold, &mut result);
            } else {
                handle_two_vertices_behind(coords, 2, 0, 1, threshold, &mut result);
            }
        }
        _ => (),
    }

    result
}

fn handle_single_vertex_behind(
    coords: &[FloatType; 3],
    behind: usize,
    below1: usize,
    below2: usize,
    threshold: FloatType,
    result: &mut Vec<ClippedIndex>,
) {
    let interpolated1 = interpolate(coords[behind], coords[below1], threshold);
    let interpolated2 = interpolate(coords[behind], coords[below2], threshold);

    result.push(ClippedIndex::Idx(below1));
    result.push(ClippedIndex::Idx(below2));

    result.push(ClippedIndex::Interpolated(InterpolatedClippedIndex {
        idx1: behind,
        idx2: below2,
        ratio: interpolated2,
    })); // new vertex
    result.push(ClippedIndex::Interpolated(InterpolatedClippedIndex {
        idx1: behind,
        idx2: below1,
        ratio: interpolated1,
    })); // new vertex
}

fn handle_two_vertices_behind(
    coords: &[FloatType; 3],
    below: usize,
    behind1: usize,
    behind2: usize,
    threshold: FloatType,
    result: &mut Vec<ClippedIndex>,
) {
    let interpolated1 = interpolate(coords[behind1], coords[below], threshold);
    let interpolated2 = interpolate(coords[behind2], coords[below], threshold);

    result.push(ClippedIndex::Idx(below));
    result.push(ClippedIndex::Interpolated(InterpolatedClippedIndex {
        idx1: behind1,
        idx2: below,
        ratio: interpolated1,
    })); // new vertex
    result.push(ClippedIndex::Interpolated(InterpolatedClippedIndex {
        idx1: behind2,
        idx2: below,
        ratio: interpolated2,
    })); // new vertex
}

#[derive(Debug, Clone)]
pub(super) enum ClippedIndex {
    Idx(usize),
    Interpolated(InterpolatedClippedIndex),
}

impl ClippedIndex {
    pub(super) fn interpolate(&self, coords: &[FloatType; 3]) -> FloatType {
        match self {
            ClippedIndex::Idx(i) => coords[*i],
            ClippedIndex::Interpolated(i) => lerp(coords[i.idx1], coords[i.idx2], i.ratio),
        }
    }
}

#[derive(Debug, Clone)]
// Interpolate v1 and v2 by ratio.
pub(super) struct InterpolatedClippedIndex {
    idx1: usize,
    idx2: usize,
    ratio: FloatType,
}

#[cfg(test)]
mod test {
    use navara_assert::float::assert_delta;

    use super::{clip_2d_triangle_at_threshold, ClippedIndex, InterpolatedClippedIndex};

    #[test]
    fn it_should_clip_specified_coord() {
        let assert_clipped = |clipped: Vec<ClippedIndex>, expects: Vec<ClippedIndex>| {
            assert_eq!(clipped.len(), expects.len());
            for (i, clipped) in clipped.iter().enumerate() {
                match (clipped, &expects[i]) {
                    (ClippedIndex::Idx(result), ClippedIndex::Idx(expect)) => {
                        assert_eq!(result, expect);
                    }
                    (ClippedIndex::Interpolated(result), ClippedIndex::Interpolated(expect)) => {
                        assert_eq!(result.idx1, expect.idx1);
                        assert_eq!(result.idx2, expect.idx2);
                        assert_delta(result.ratio, expect.ratio, 0.01);
                    }
                    _ => {
                        unreachable!()
                    }
                }
            }
        };

        // v0 is behind
        let clipped = clip_2d_triangle_at_threshold(0.5, false, &[0.6, 0.2, 0.4]);
        let expects = &[
            ClippedIndex::Idx(1),
            ClippedIndex::Idx(2),
            ClippedIndex::Interpolated(InterpolatedClippedIndex {
                idx1: 0,
                idx2: 2,
                ratio: 0.5,
            }),
            ClippedIndex::Interpolated(InterpolatedClippedIndex {
                idx1: 0,
                idx2: 1,
                ratio: 0.25,
            }),
        ];
        assert_clipped(clipped, expects.to_vec());

        // v1 is behind
        let clipped = clip_2d_triangle_at_threshold(0.5, false, &[0.2, 0.6, 0.4]);
        let expects = &[
            ClippedIndex::Idx(2),
            ClippedIndex::Idx(0),
            ClippedIndex::Interpolated(InterpolatedClippedIndex {
                idx1: 1,
                idx2: 0,
                ratio: 0.25,
            }),
            ClippedIndex::Interpolated(InterpolatedClippedIndex {
                idx1: 1,
                idx2: 2,
                ratio: 0.5,
            }),
        ];
        assert_clipped(clipped, expects.to_vec());

        // v2 is behind
        let clipped = clip_2d_triangle_at_threshold(0.5, false, &[0.2, 0.4, 0.6]);
        let expects = &[
            ClippedIndex::Idx(0),
            ClippedIndex::Idx(1),
            ClippedIndex::Interpolated(InterpolatedClippedIndex {
                idx1: 2,
                idx2: 1,
                ratio: 0.5,
            }),
            ClippedIndex::Interpolated(InterpolatedClippedIndex {
                idx1: 2,
                idx2: 0,
                ratio: 0.25,
            }),
        ];
        assert_clipped(clipped, expects.to_vec());

        // v0 isn't behind
        let clipped = clip_2d_triangle_at_threshold(0.5, false, &[0.2, 0.8, 0.6]);
        let expects = &[
            ClippedIndex::Idx(0),
            ClippedIndex::Interpolated(InterpolatedClippedIndex {
                idx1: 1,
                idx2: 0,
                ratio: 0.5,
            }),
            ClippedIndex::Interpolated(InterpolatedClippedIndex {
                idx1: 2,
                idx2: 0,
                ratio: 0.25,
            }),
        ];
        assert_clipped(clipped, expects.to_vec());

        // v1 isn't behind
        let clipped = clip_2d_triangle_at_threshold(0.5, false, &[0.8, 0.2, 0.6]);
        let expects = &[
            ClippedIndex::Idx(1),
            ClippedIndex::Interpolated(InterpolatedClippedIndex {
                idx1: 2,
                idx2: 1,
                ratio: 0.25,
            }),
            ClippedIndex::Interpolated(InterpolatedClippedIndex {
                idx1: 0,
                idx2: 1,
                ratio: 0.5,
            }),
        ];
        assert_clipped(clipped, expects.to_vec());

        // v2 isn't behind
        let clipped = clip_2d_triangle_at_threshold(0.5, false, &[0.8, 0.6, 0.2]);
        let expects = &[
            ClippedIndex::Idx(2),
            ClippedIndex::Interpolated(InterpolatedClippedIndex {
                idx1: 0,
                idx2: 2,
                ratio: 0.5,
            }),
            ClippedIndex::Interpolated(InterpolatedClippedIndex {
                idx1: 1,
                idx2: 2,
                ratio: 0.25,
            }),
        ];
        assert_clipped(clipped, expects.to_vec());

        // everything is behind
        let clipped = clip_2d_triangle_at_threshold(0.5, false, &[0.8, 0.6, 0.9]);
        let expects = &[];
        assert_clipped(clipped, expects.to_vec());

        // everything isn't behind
        let clipped = clip_2d_triangle_at_threshold(0.5, false, &[0.1, 0.2, 0.3]);
        let expects = &[
            ClippedIndex::Idx(0),
            ClippedIndex::Idx(1),
            ClippedIndex::Idx(2),
        ];
        assert_clipped(clipped, expects.to_vec());
    }
}
