use std::{borrow::Borrow, hash::Hash};

use num::PrimInt;

use crate::types::Coords;

pub type LinearQuadleafIdKey = u64;

#[derive(PartialEq, Eq)]
pub struct LinearQuadleafId<U: PrimInt + Default> {
    pub coords: Coords<U>,
    pub key: LinearQuadleafIdKey,
}

// Max depth is 29 for now, this should be enough resolution for now.
// When we need to support more depth in the future, we need to look for other way.
const MAX_DEPTH: u64 = 29;

pub struct LinearQuadleafIdParams {
    xy_bits: u64,
}

impl LinearQuadleafIdParams {
    pub fn new() -> Self {
        let xy_bits = MAX_DEPTH;
        Self { xy_bits }
    }
}

impl<U: PrimInt + Default> LinearQuadleafId<U> {
    pub fn new(coords: Coords<U>, params: &LinearQuadleafIdParams) -> Option<Self> {
        Some(Self {
            coords,
            key: Self::make_key(coords, params)?,
        })
    }

    pub fn make_key((x, y, z): Coords<U>, params: &LinearQuadleafIdParams) -> Option<u64> {
        if z.to_u64()? >= MAX_DEPTH {
            return None;
        }

        let xy_bits = params.xy_bits;

        let x = x.to_u64()?;
        let y = y.to_u64()?;
        let z = z.to_u64()?;

        let z_part = z << (2 * xy_bits);
        let x_part = x << xy_bits;
        let y_part = y;

        Some(z_part | x_part | y_part)
    }

    #[allow(unused)]
    pub fn decode_key(key: LinearQuadleafIdKey, params: &LinearQuadleafIdParams) -> Coords<U> {
        let xy_bits = params.xy_bits;

        let z = U::from(key >> (2 * xy_bits)).unwrap();
        let x = U::from((key >> xy_bits) & ((1 << xy_bits) - 1)).unwrap();
        let y = U::from(key & ((1 << xy_bits) - 1)).unwrap();

        (x, y, z)
    }
}

impl<U: PrimInt + Default> Hash for LinearQuadleafId<U> {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.key.hash(state);
    }
}

impl<U: PrimInt + Default> PartialEq<LinearQuadleafIdKey> for LinearQuadleafId<U> {
    fn eq(&self, other: &LinearQuadleafIdKey) -> bool {
        &self.key == other
    }
}

impl<U: PrimInt + Default> Borrow<LinearQuadleafIdKey> for LinearQuadleafId<U> {
    fn borrow(&self) -> &LinearQuadleafIdKey {
        &self.key
    }
}

#[cfg(test)]
mod test {
    use crate::{linear_quadtree::LinearQuadleafId, types::Coords};

    use super::LinearQuadleafIdParams;

    #[test]
    fn it_should_get_key_from_coords() {
        let depth = 29;

        let max_z = depth - 1;
        let expects: Vec<Coords<u32>> = vec![
            (0, 0, 0),
            (0, 1, 0),
            (1, 0, 0),
            (1, 1, 0),
            (0, 0, 1),
            (0, 1, 1),
            (1, 0, 1),
            (1, 1, 1),
            (2u32.pow(max_z - 1), 2u32.pow(max_z - 1), max_z),
            (2u32.pow(max_z - 1), 2u32.pow(max_z), max_z),
            (2u32.pow(max_z), 2u32.pow(max_z - 1), max_z),
            (2u32.pow(max_z), 2u32.pow(max_z), max_z),
        ];

        let params = LinearQuadleafIdParams::new();

        for coords in expects {
            assert_eq!(
                LinearQuadleafId::decode_key(
                    LinearQuadleafId::make_key(coords, &params).unwrap(),
                    &params
                ),
                coords
            );
        }
    }
}
