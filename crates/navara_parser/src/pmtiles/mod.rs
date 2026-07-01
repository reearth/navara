//! PMTiles v3 container parsing.
//!
//! A thin Navara-facing wrapper around the standalone [`pmtiles`] crate. Right
//! now it is a straight re-export, but it reserves the seam for Navara-specific
//! concerns to land here — rather than in the spec crate — as they appear
//! (e.g. unifying the error type, normalizing on `bytes::Bytes`, or
//! coordinate-conversion helpers).
pub use pmtiles::*;
