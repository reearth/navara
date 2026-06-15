//! Decompression of directory and tile payloads.

use std::io::Read;

use flate2::read::GzDecoder;

use crate::{Compression, Error};

/// Decompress `data` according to `compression`.
///
/// Supports the two compressions used by MVT PMTiles archives in practice:
/// [`Compression::None`] (returned as-is) and [`Compression::Gzip`]. Brotli,
/// Zstd, and Unknown are rejected with [`Error::Decompression`] — they are
/// out of scope for the MVT-only first version.
///
/// # Errors
/// Returns [`Error::Decompression`] on an unsupported compression or a
/// corrupt gzip stream.
pub fn decompress(compression: Compression, data: &[u8]) -> Result<Vec<u8>, Error> {
    match compression {
        Compression::None => Ok(data.to_vec()),
        Compression::Gzip => {
            let mut out = Vec::new();
            GzDecoder::new(data)
                .read_to_end(&mut out)
                .map_err(|_| Error::Decompression)?;
            Ok(out)
        }
        Compression::Brotli | Compression::Zstd | Compression::Unknown => {
            Err(Error::Decompression)
        }
    }
}
