use num::{PrimInt, ToPrimitive};

use crate::types::Coords;

pub fn to_int<V, U>(v: V) -> U
where
    V: ToPrimitive,
    U: PrimInt + Default,
{
    U::from(v).unwrap()
}

#[allow(dead_code)]
pub(crate) fn zxy_string((z, x, y): Coords<u32>) -> String {
    format!("{}/{}/{}", z, x, y)
}

/// Calculate parent coords. Returns (x >> 1, y >> 1, z - 1), clamping z at 0.
pub fn parent_coords<U: PrimInt + Default + Sync + Send + 'static>(
    (x, y, z): Coords<U>,
) -> Coords<U> {
    (
        x >> 1,
        y >> 1,
        z.checked_sub(&U::one()).unwrap_or_else(U::zero),
    )
}

/// Calculate ancestor coords at a given target zoom level.
/// Shifts x and y right by `(z - target_z)` bits and sets z to `target_z`.
/// If `target_z >= z`, returns the original coords unchanged.
pub fn ancestor_coords<U: PrimInt + Default + Sync + Send + 'static>(
    (x, y, z): Coords<U>,
    target_z: U,
) -> Coords<U> {
    if target_z >= z {
        return (x, y, z);
    }
    let shift = z - target_z;
    (
        x >> shift.to_usize().unwrap(),
        y >> shift.to_usize().unwrap(),
        target_z,
    )
}

/// Calculate child coords
pub fn child_coords<U: PrimInt + Default + Sync + Send + 'static>(
    (x, y, z): Coords<U>,
    child_index: U,
) -> Coords<U> {
    let i = child_index;
    let x = (x << 1) + (i % (U::one() + U::one()));
    let y = (y << 1) + (i >> 1);
    let z = z + U::one();
    (x, y, z)
}

/// Get children of specified coordinates.
pub fn children_coords<U: PrimInt + Default + Sync + Send + 'static>(
    (x, y, z): Coords<U>,
) -> Vec<Coords<U>> {
    let mut children = Vec::with_capacity(4);
    for i in 0..4 {
        let i = to_int::<usize, U>(i);
        let coords = child_coords((x, y, z), i);
        children.push(coords)
    }
    children
}

#[cfg(test)]
pub(crate) mod test {
    use std::hash::Hash;

    use rustc_hash::FxHashSet;

    use super::*;

    pub(crate) fn unordered_elements_are<T, X, Y>(x: X, y: Y) -> bool
    where
        X: IntoIterator<Item = T>,
        X::Item: PartialEq + Eq + Hash,
        Y: IntoIterator<Item = T>,
        Y::Item: PartialEq + Eq + Hash,
    {
        let hs1: FxHashSet<T> = FxHashSet::from_iter(x);
        let hs2: FxHashSet<T> = FxHashSet::from_iter(y);
        hs1 == hs2
    }

    // ── parent_coords ───────────────────────────────────────────────────

    #[test]
    fn parent_coords_of_root_clamps_z_at_zero() {
        assert_eq!(parent_coords((0u32, 0, 0)), (0, 0, 0));
    }

    #[test]
    fn parent_coords_z1_children_map_to_root() {
        assert_eq!(parent_coords((0u32, 0, 1)), (0, 0, 0));
        assert_eq!(parent_coords((1u32, 0, 1)), (0, 0, 0));
        assert_eq!(parent_coords((0u32, 1, 1)), (0, 0, 0));
        assert_eq!(parent_coords((1u32, 1, 1)), (0, 0, 0));
    }

    #[test]
    fn parent_coords_higher_zoom() {
        // z=5, x=20, y=14 -> z=4, x=10, y=7
        assert_eq!(parent_coords((20u32, 14, 5)), (10, 7, 4));
    }

    #[test]
    fn parent_coords_is_inverse_of_child_coords() {
        let origin = (3u32, 5, 4);
        for i in 0..4u32 {
            let child = child_coords(origin, i);
            assert_eq!(parent_coords(child), origin);
        }
    }

    // ── ancestor_coords ─────────────────────────────────────────────────

    #[test]
    fn ancestor_coords_same_zoom_returns_identity() {
        assert_eq!(ancestor_coords((8u32, 7, 4), 4), (8, 7, 4));
    }

    #[test]
    fn ancestor_coords_higher_target_returns_identity() {
        assert_eq!(ancestor_coords((8u32, 7, 4), 6), (8, 7, 4));
    }

    #[test]
    fn ancestor_coords_to_root() {
        assert_eq!(ancestor_coords((8u32, 7, 4), 0), (0, 0, 0));
    }

    #[test]
    fn ancestor_coords_one_level_up_matches_parent() {
        let coords = (20u32, 14, 5);
        assert_eq!(ancestor_coords(coords, 4), parent_coords(coords));
    }

    #[test]
    fn ancestor_coords_multiple_levels() {
        // z=6, x=40, y=28 -> z=2: shift=4, x=40>>4=2, y=28>>4=1
        assert_eq!(ancestor_coords((40u32, 28, 6), 2), (2, 1, 2));
    }

    #[test]
    fn ancestor_coords_consistent_with_repeated_parent() {
        let coords = (40u32, 28, 6);
        let mut stepped = coords;
        for _ in 0..4 {
            stepped = parent_coords(stepped);
        }
        assert_eq!(ancestor_coords(coords, 2), stepped);
    }
}
