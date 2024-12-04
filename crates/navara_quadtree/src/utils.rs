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
    use std::{collections::HashSet, hash::Hash};

    pub(crate) fn unordered_elements_are<T, X, Y>(x: X, y: Y) -> bool
    where
        X: IntoIterator<Item = T>,
        X::Item: PartialEq + Eq + Hash,
        Y: IntoIterator<Item = T>,
        Y::Item: PartialEq + Eq + Hash,
    {
        let hs1: HashSet<T> = HashSet::from_iter(x);
        let hs2: HashSet<T> = HashSet::from_iter(y);
        hs1 == hs2
    }
}
