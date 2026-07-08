//! PMTiles v3 container parsing.
//!
//! A thin Navara-facing wrapper around the standalone [`pmtiles`] crate. Right
//! now it is a straight re-export, but it reserves the seam for Navara-specific
//! concerns to land here — rather than in the spec crate — as they appear
//! (e.g. unifying the error type, normalizing on `bytes::Bytes`, or
//! coordinate-conversion helpers).
pub use pmtiles::*;

/// Stable small code for [`Compression`], used to carry the tile compression
/// across the Web Worker boundary (where enums can't cross directly).
pub fn compression_to_code(c: Compression) -> u8 {
    match c {
        Compression::None => 0,
        Compression::Gzip => 1,
        Compression::Brotli => 2,
        Compression::Zstd => 3,
        Compression::Unknown => 0,
    }
}

/// Inverse of [`compression_to_code`]; unknown codes fall back to `None`.
pub fn compression_from_code(code: u8) -> Compression {
    match code {
        1 => Compression::Gzip,
        2 => Compression::Brotli,
        3 => Compression::Zstd,
        _ => Compression::None,
    }
}

/// Decompress `data` for the given compression code, returning `None` on
/// failure. Code `0` (no compression) returns the input unchanged (no copy).
pub fn decompress_by_code(code: u8, data: Vec<u8>) -> Option<Vec<u8>> {
    if code == 0 {
        return Some(data);
    }
    decompress(compression_from_code(code), &data).ok()
}
