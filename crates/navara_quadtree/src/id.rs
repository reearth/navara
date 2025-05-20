use num::PrimInt;

use crate::{
    linear_quadtree::{LinearQuadleafId, LinearQuadleafIdParams},
    Coords, QuadLeafHandle,
};

/// Decode [`QuadLeafHandle`] to [`Coords`].
pub fn decode_quadleaf_handle<U: PrimInt + Default>(id: QuadLeafHandle) -> Coords<U> {
    LinearQuadleafId::decode_key(id, &LinearQuadleafIdParams::new())
}

/// Encode [`Coords`] to [`QuadLeafHandle`].
pub fn encode_quadleaf_handle<U: PrimInt + Default>(coords: Coords<U>) -> Option<QuadLeafHandle> {
    LinearQuadleafId::make_key(coords, &LinearQuadleafIdParams::new())
}
