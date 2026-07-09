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
        // Distinct from `None`: an unknown compression must fail decompression
        // on the other side, not be parsed as plain bytes.
        Compression::Unknown => 255,
    }
}

/// Inverse of [`compression_to_code`]; unrecognized codes map to `Unknown` so
/// they are rejected by `decompress` instead of being treated as passthrough.
pub fn compression_from_code(code: u8) -> Compression {
    match code {
        0 => Compression::None,
        1 => Compression::Gzip,
        2 => Compression::Brotli,
        3 => Compression::Zstd,
        _ => Compression::Unknown,
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

#[cfg(test)]
mod tests {
    use super::*;

    /// Every supported variant survives the code round trip; `Unknown` must not
    /// collapse onto `None`, or compressed bytes would be parsed as plain data.
    #[test]
    fn compression_codes_round_trip() {
        for c in [
            Compression::None,
            Compression::Gzip,
            Compression::Brotli,
            Compression::Zstd,
            Compression::Unknown,
        ] {
            assert_eq!(compression_from_code(compression_to_code(c)), c);
        }
    }

    #[test]
    fn unrecognized_codes_map_to_unknown() {
        assert_eq!(compression_from_code(42), Compression::Unknown);
    }

    /// An unknown compression fails decompression instead of passing the bytes
    /// through; only code 0 is a passthrough.
    #[test]
    fn decompress_by_code_rejects_unknown_and_passes_through_none() {
        let unknown = compression_to_code(Compression::Unknown);
        assert!(decompress_by_code(unknown, vec![1, 2, 3]).is_none());
        assert_eq!(decompress_by_code(0, vec![1, 2, 3]), Some(vec![1, 2, 3]));
    }
}
