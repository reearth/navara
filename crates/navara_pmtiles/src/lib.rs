//! TEMPORARY shim (step 1 of the PMTiles refactor).
//!
//! The pure parser has moved to the standalone [`pmtiles`] crate. This crate is
//! being repurposed into the Bevy-integration layer (step 3); until then it
//! re-exports `pmtiles` — including backward-compatible aliases for the
//! de-stuttered type names — so `navara_mvt` keeps compiling unchanged.

pub use pmtiles::*;

// Pre-rename aliases, dropped in step 3 when `navara_mvt` switches to the new
// names via `navara_parser::pmtiles`.
pub use pmtiles::{Archive as PmtilesArchive, Entry as DirEntry, Error as PmtError};
