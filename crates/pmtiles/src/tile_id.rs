//! Conversion from `z/x/y` tile coordinates to a PMTiles tile ID.
//!
//! PMTiles orders tiles along a Hilbert space-filling curve. The ID is the
//! count of all tiles in zoom levels below `z` (the pyramid base) plus the
//! tile's position along the Hilbert curve at level `z`.

use fast_hilbert::xy2h;

/// Number of tiles in all zoom levels below `z`, i.e. `(4^z - 1) / 3`.
///
/// `z` must be `<= 31` (the PMTiles maximum); above that `4^z` overflows.
fn pyramid_base(z: u8) -> u64 {
    ((1u64 << (2 * u32::from(z))) - 1) / 3
}

/// Map `z/x/y` to its PMTiles tile ID.
///
/// # Panics
/// Panics if `z > 31`; PMTiles tile IDs are only defined up to zoom 31.
#[must_use]
pub fn tile_id(z: u8, x: u32, y: u32) -> u64 {
    // Without this, z >= 32 would panic on shift overflow in debug but
    // silently return a wrong ID in release (masked shift); fail
    // deterministically in both.
    assert!(z <= 31, "PMTiles tile ids are only defined for z <= 31");
    if z == 0 {
        // 0/0/0 is tile ID 0; `xy2h` is not defined for order 0.
        return 0;
    }
    pyramid_base(z) + xy2h::<u32>(x, y, z)
}
