//! Error type shared by the PMTiles parsing primitives.

/// Errors that can arise while parsing a PMTiles v3 archive.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PmtError {
    /// The header did not begin with the `PMTiles` magic string.
    InvalidMagic,
    /// The archive declares a spec version other than 3 (e.g. a legacy v2 file).
    UnsupportedVersion(u8),
    /// A buffer ended before the structure it should contain was fully read.
    UnexpectedEof,
    /// A compression byte did not map to a known compression kind.
    InvalidCompression(u8),
    /// A tile-type byte did not map to a known tile type.
    InvalidTileType(u8),
    /// A directory used an unsupported compression, or a gzip stream was corrupt.
    Decompression,
}

impl core::fmt::Display for PmtError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Self::InvalidMagic => write!(f, "not a PMTiles archive (bad magic number)"),
            Self::UnsupportedVersion(v) => {
                write!(f, "unsupported PMTiles version {v} (only v3 is supported)")
            }
            Self::UnexpectedEof => write!(f, "buffer ended before the structure was complete"),
            Self::InvalidCompression(b) => write!(f, "unknown compression byte {b}"),
            Self::InvalidTileType(b) => write!(f, "unknown tile-type byte {b}"),
            Self::Decompression => write!(f, "failed to decompress data"),
        }
    }
}

impl std::error::Error for PmtError {}
