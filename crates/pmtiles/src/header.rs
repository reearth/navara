//! The fixed-layout PMTiles v3 header (the first 127 bytes of an archive).
//!
//! The byte layout is defined by the spec and is little-endian throughout:
//! <https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md>

use crate::Error;

/// Size of the PMTiles v3 header, in bytes.
pub const HEADER_SIZE: usize = 127;

const MAGIC: &[u8] = b"PMTiles";

/// Compression applied to directories (internal) or tile payloads.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Compression {
    /// Unspecified / unknown.
    Unknown,
    /// No compression.
    None,
    /// gzip.
    Gzip,
    /// Brotli (not supported by this crate yet).
    Brotli,
    /// Zstandard (not supported by this crate yet).
    Zstd,
}

impl Compression {
    fn from_byte(b: u8) -> Result<Self, Error> {
        Ok(match b {
            0 => Self::Unknown,
            1 => Self::None,
            2 => Self::Gzip,
            3 => Self::Brotli,
            4 => Self::Zstd,
            other => return Err(Error::InvalidCompression(other)),
        })
    }
}

/// The encoding of the tile payloads stored in the archive.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TileType {
    /// Unspecified / unknown.
    Unknown,
    /// Mapbox Vector Tile.
    Mvt,
    /// PNG image.
    Png,
    /// JPEG image.
    Jpeg,
    /// WebP image.
    Webp,
    /// AVIF image.
    Avif,
    /// MapLibre Vector Tile.
    Mlt,
}

impl TileType {
    fn from_byte(b: u8) -> Result<Self, Error> {
        Ok(match b {
            0 => Self::Unknown,
            1 => Self::Mvt,
            2 => Self::Png,
            3 => Self::Jpeg,
            4 => Self::Webp,
            5 => Self::Avif,
            6 => Self::Mlt,
            other => return Err(Error::InvalidTileType(other)),
        })
    }
}

/// The parsed PMTiles v3 header.
///
/// Only the fields needed to locate and decode tiles are kept; the spec's
/// metadata/bounds/center fields are intentionally omitted for now.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Header {
    /// Spec version. Always 3 for a successfully parsed header.
    pub version: u8,
    /// Absolute byte offset of the (compressed) root directory.
    pub root_dir_offset: u64,
    /// Byte length of the (compressed) root directory.
    pub root_dir_length: u64,
    /// Absolute byte offset of the leaf-directory section. Leaf entries'
    /// offsets are relative to this.
    pub leaf_dirs_offset: u64,
    /// Absolute byte offset of the tile-data section. Tile entries' offsets
    /// are relative to this.
    pub tile_data_offset: u64,
    /// Compression applied to directories.
    pub internal_compression: Compression,
    /// Compression applied to tile payloads.
    pub tile_compression: Compression,
    /// Encoding of the tile payloads.
    pub tile_type: TileType,
    /// Minimum zoom level present in the archive.
    pub min_zoom: u8,
    /// Maximum zoom level present in the archive.
    pub max_zoom: u8,
}

impl Header {
    /// Parse a header from the first [`HEADER_SIZE`] bytes of an archive.
    ///
    /// `bytes` may be longer than the header (e.g. the 16 KiB bootstrap read);
    /// only the leading header region is inspected.
    ///
    /// # Errors
    /// Returns [`Error`] if the buffer is too short, the magic number is
    /// wrong, the version is not 3, or a compression/tile-type byte is invalid.
    pub fn parse(bytes: &[u8]) -> Result<Self, Error> {
        if bytes.len() < HEADER_SIZE {
            return Err(Error::UnexpectedEof);
        }
        if &bytes[0..MAGIC.len()] != MAGIC {
            return Err(Error::InvalidMagic);
        }
        let version = bytes[7];
        if version != 3 {
            return Err(Error::UnsupportedVersion(version));
        }

        // `bytes.len() >= HEADER_SIZE` was checked above, so every fixed offset
        // below is in bounds and the slice conversions cannot fail.
        let u64_at = |off: usize| -> u64 {
            u64::from_le_bytes(bytes[off..off + 8].try_into().expect("8 bytes in range"))
        };

        Ok(Self {
            version,
            root_dir_offset: u64_at(8),
            root_dir_length: u64_at(16),
            // bytes 24..40 are metadata offset/length (unused for tile lookup).
            leaf_dirs_offset: u64_at(40),
            // bytes 48..56 are leaf-dirs length (unused; each entry carries its own length).
            tile_data_offset: u64_at(56),
            // bytes 64..96 are data length and tile counts (unused for tile lookup).
            internal_compression: Compression::from_byte(bytes[97])?,
            tile_compression: Compression::from_byte(bytes[98])?,
            tile_type: TileType::from_byte(bytes[99])?,
            min_zoom: bytes[100],
            max_zoom: bytes[101],
        })
    }
}
