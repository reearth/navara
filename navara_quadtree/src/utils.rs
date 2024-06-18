use num::{PrimInt, ToPrimitive};

use crate::traits::Coords;

pub fn to_int<V, U>(v: V) -> U
where
    V: ToPrimitive,
    U: PrimInt + Default,
{
    U::from(v).unwrap()
}

#[allow(dead_code)]
pub fn zxy_string((z, x, y): Coords<u32>) -> String {
    format!("{}/{}/{}", z, x, y)
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
