//! Pure PMTiles v3 parsing primitives — no IO, no ECS.
//!
//! This crate knows how to read a PMTiles archive's header and directories and
//! how to map `z/x/y` to a tile ID, but it never fetches anything itself. A
//! higher layer feeds it byte ranges (obtained however it likes — HTTP range
//! requests, a local file, …) and uses the parsed offsets to ask for more.
//!
//! Scope: the container format only. The tile payloads it points at (MVT, PNG,
//! …) are decoded elsewhere.

mod archive;
mod decode;
mod directory;
mod error;
mod header;
mod tile_id;

pub use archive::{Archive, ByteRange, Resolution};
pub use decode::decompress;
pub use directory::{Directory, Entry};
pub use error::Error;
pub use header::{Compression, HEADER_SIZE, Header, TileType};
pub use tile_id::tile_id;
