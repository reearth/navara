//! The PMTiles archive state machine.
//!
//! [`PmtilesArchive`] tracks just enough state to turn a `z/x/y` request into a
//! byte range to fetch. It performs **no IO itself**: it emits the byte ranges
//! it needs ([`ByteRange`]) and is fed the resulting bytes back. The caller
//! owns the fetching (HTTP range requests, a local file, …), which keeps this
//! type a pure, deterministic state machine.
//!
//! Lifecycle:
//! 1. Repeatedly call [`take_bootstrap_request`](PmtilesArchive::take_bootstrap_request);
//!    fetch each returned range and feed it to
//!    [`on_bootstrap_bytes`](PmtilesArchive::on_bootstrap_bytes) until
//!    [`is_ready`](PmtilesArchive::is_ready).
//! 2. Call [`resolve`](PmtilesArchive::resolve) per tile. On [`Resolution::NeedLeaf`],
//!    fetch the leaf and feed it to [`on_leaf_bytes`](PmtilesArchive::on_leaf_bytes),
//!    then resolve again. On [`Resolution::Tile`], fetch the payload.

use std::collections::{HashMap, HashSet};

use crate::{Compression, Directory, Header, PmtError, tile_id};

/// A byte range to fetch from the archive: `length` bytes starting at `offset`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ByteRange {
    /// Absolute byte offset within the archive.
    pub offset: u64,
    /// Number of bytes.
    pub length: u64,
}

/// The result of resolving a tile coordinate against the loaded directories.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Resolution {
    /// A leaf directory must be fetched before the tile can be resolved. Fetch
    /// `request`, feed it to [`PmtilesArchive::on_leaf_bytes`] keyed by
    /// `leaf_offset`, then resolve again.
    NeedLeaf {
        /// Key to pass back to [`PmtilesArchive::on_leaf_bytes`].
        leaf_offset: u64,
        /// Bytes to fetch for the leaf directory.
        request: ByteRange,
    },
    /// The tile payload occupies `request`. Fetch it, then decompress with the
    /// header's [`tile_compression`](Header::tile_compression).
    Tile {
        /// Bytes to fetch for the tile payload.
        request: ByteRange,
    },
    /// The archive contains no tile at this coordinate.
    Absent,
}

/// Initial bootstrap read length. The spec recommends 16 KiB, which holds the
/// 127-byte header plus the root directory for essentially every real archive,
/// saving a round trip. If the root directory turns out to sit beyond this
/// window, a second request is issued for it.
const BOOTSTRAP_LEN: u64 = 16_384;

/// Internal bootstrap progression.
enum State {
    /// Header not yet requested.
    NeedHeader,
    /// Header request in flight.
    AwaitHeader,
    /// Header parsed, but the root directory was past the bootstrap window.
    NeedRootDir(Header),
    /// Root-directory request in flight.
    AwaitRootDir(Header),
    /// Fully bootstrapped and resolvable.
    Ready(Ready),
    /// Bootstrap failed (bad bytes or a failed fetch); the archive is inert.
    Failed,
}

/// State once the header and root directory are available.
struct Ready {
    header: Header,
    root_dir: Directory,
    /// Leaf directories already fetched, keyed by their offset within the
    /// leaf-directory section.
    leaves: HashMap<u64, Directory>,
    /// Leaf offsets whose fetch failed. Tiles behind them resolve to `Absent`
    /// instead of being re-requested forever.
    failed_leaves: HashSet<u64>,
}

/// A PMTiles v3 archive being resolved incrementally. URL-agnostic: the caller
/// pairs it with whatever locates the bytes.
pub struct PmtilesArchive {
    state: State,
}

impl Default for PmtilesArchive {
    fn default() -> Self {
        Self {
            state: State::NeedHeader,
        }
    }
}

impl PmtilesArchive {
    /// Create a fresh archive that still needs bootstrapping.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Whether the archive is bootstrapped and tiles can be [`resolve`](Self::resolve)d.
    #[must_use]
    pub fn is_ready(&self) -> bool {
        matches!(self.state, State::Ready(_))
    }

    /// Whether bootstrapping failed; the archive will issue no further requests.
    #[must_use]
    pub fn is_failed(&self) -> bool {
        matches!(self.state, State::Failed)
    }

    /// The parsed header, available once the header has been read.
    #[must_use]
    pub fn header(&self) -> Option<&Header> {
        match &self.state {
            State::Ready(r) => Some(&r.header),
            State::NeedRootDir(h) | State::AwaitRootDir(h) => Some(h),
            State::NeedHeader | State::AwaitHeader | State::Failed => None,
        }
    }

    /// The next byte range needed to finish bootstrapping, or `None` if a
    /// bootstrap fetch is already in flight, or the archive is ready/failed.
    ///
    /// Calling this marks the request as in flight, so it won't be handed out
    /// again until the bytes are fed back via [`on_bootstrap_bytes`](Self::on_bootstrap_bytes)
    /// (which advances the state) — this is what prevents duplicate fetches.
    pub fn take_bootstrap_request(&mut self) -> Option<ByteRange> {
        // Replace-with-`Failed` lets us move the owned `Header` out of the
        // state; every arm immediately overwrites it with the real next state.
        match std::mem::replace(&mut self.state, State::Failed) {
            State::NeedHeader => {
                self.state = State::AwaitHeader;
                Some(ByteRange {
                    offset: 0,
                    length: BOOTSTRAP_LEN,
                })
            }
            State::NeedRootDir(header) => {
                let request = ByteRange {
                    offset: header.root_dir_offset,
                    length: header.root_dir_length,
                };
                self.state = State::AwaitRootDir(header);
                Some(request)
            }
            other => {
                self.state = other;
                None
            }
        }
    }

    /// Feed the bytes fetched for the most recent
    /// [`take_bootstrap_request`](Self::take_bootstrap_request).
    ///
    /// # Errors
    /// Returns [`PmtError`] if the header or root directory is malformed. On
    /// error the archive transitions to failed and issues no further requests.
    pub fn on_bootstrap_bytes(&mut self, bytes: &[u8]) -> Result<(), PmtError> {
        // On any early return via `?`, the state stays `Failed`.
        match std::mem::replace(&mut self.state, State::Failed) {
            State::AwaitHeader => {
                let header = Header::parse(bytes)?;
                // `checked_add` guards against a corrupt header whose
                // offset+length wraps `u64`. When `end` is in-window it is
                // `<= bytes.len()` (a `usize`), so both `as usize` casts below
                // are lossless even on wasm32; an overflow or out-of-window end
                // falls through to a separate root-directory fetch.
                match header.root_dir_offset.checked_add(header.root_dir_length) {
                    Some(end) if end <= bytes.len() as u64 => {
                        // Root directory rode along in the bootstrap window.
                        let raw = &bytes[header.root_dir_offset as usize..end as usize];
                        let root_dir = parse_directory(header.internal_compression, raw)?;
                        self.state = State::Ready(Ready {
                            header,
                            root_dir,
                            leaves: HashMap::new(),
                            failed_leaves: HashSet::new(),
                        });
                    }
                    _ => {
                        self.state = State::NeedRootDir(header);
                    }
                }
                Ok(())
            }
            State::AwaitRootDir(header) => {
                // These bytes are exactly the root-directory range.
                let root_dir = parse_directory(header.internal_compression, bytes)?;
                self.state = State::Ready(Ready {
                    header,
                    root_dir,
                    leaves: HashMap::new(),
                    failed_leaves: HashSet::new(),
                });
                Ok(())
            }
            // No bootstrap request was outstanding; nothing to do.
            other => {
                self.state = other;
                Ok(())
            }
        }
    }

    /// Resolve a tile coordinate, walking the directory tree as far as the
    /// loaded directories allow.
    ///
    /// Only meaningful once [`is_ready`](Self::is_ready); returns
    /// [`Resolution::Absent`] otherwise (callers should gate on readiness).
    #[must_use]
    pub fn resolve(&self, z: u8, x: u32, y: u32) -> Resolution {
        let State::Ready(ready) = &self.state else {
            return Resolution::Absent;
        };
        // Out-of-range zoom is absent by definition, and this cheap early-out
        // also keeps `tile_id` away from the `z >= 32` shift overflow it would
        // panic on (PMTiles tile ids are only defined up to zoom 31).
        if z < ready.header.min_zoom || z > ready.header.max_zoom || z > 31 {
            return Resolution::Absent;
        }
        let id = tile_id(z, x, y);

        let mut dir = &ready.root_dir;
        loop {
            let Some(entry) = dir.find(id) else {
                return Resolution::Absent;
            };
            if !entry.is_leaf() {
                // Tile entry offsets are relative to `tile_data_offset`;
                // `checked_add` treats a corrupt offset that wraps `u64` as no
                // tile rather than emitting a bogus range request.
                let Some(offset) = ready.header.tile_data_offset.checked_add(entry.offset) else {
                    return Resolution::Absent;
                };
                return Resolution::Tile {
                    request: ByteRange {
                        offset,
                        length: u64::from(entry.length),
                    },
                };
            }
            // A leaf whose fetch previously failed: treat as no data rather
            // than re-requesting it forever.
            if ready.failed_leaves.contains(&entry.offset) {
                return Resolution::Absent;
            }
            // Leaf pointer: descend if cached, otherwise ask for it.
            match ready.leaves.get(&entry.offset) {
                Some(child) => dir = child,
                None => {
                    // Leaf entry offsets are relative to `leaf_dirs_offset`;
                    // a corrupt offset that wraps `u64` resolves to absent
                    // rather than producing a bogus range request.
                    let Some(offset) = ready.header.leaf_dirs_offset.checked_add(entry.offset)
                    else {
                        return Resolution::Absent;
                    };
                    return Resolution::NeedLeaf {
                        leaf_offset: entry.offset,
                        request: ByteRange {
                            offset,
                            length: u64::from(entry.length),
                        },
                    };
                }
            }
        }
    }

    /// Feed a fetched leaf directory back, keyed by the `leaf_offset` from the
    /// [`Resolution::NeedLeaf`] that requested it.
    ///
    /// # Errors
    /// Returns [`PmtError`] if the leaf directory is malformed.
    pub fn on_leaf_bytes(&mut self, leaf_offset: u64, bytes: &[u8]) -> Result<(), PmtError> {
        let State::Ready(ready) = &mut self.state else {
            return Ok(());
        };
        let dir = parse_directory(ready.header.internal_compression, bytes)?;
        ready.leaves.insert(leaf_offset, dir);
        Ok(())
    }

    /// Mark the archive failed (e.g. when a bootstrap fetch errors at the
    /// network layer). Stops all further requests.
    pub fn mark_failed(&mut self) {
        self.state = State::Failed;
    }

    /// Record that the leaf directory at `leaf_offset` failed to fetch. Tiles
    /// behind it will resolve to [`Resolution::Absent`] rather than looping on
    /// re-requests. No-op unless the archive is ready.
    pub fn mark_leaf_failed(&mut self, leaf_offset: u64) {
        if let State::Ready(ready) = &mut self.state {
            ready.failed_leaves.insert(leaf_offset);
        }
    }
}

/// Decompress then parse a directory blob.
fn parse_directory(compression: Compression, raw: &[u8]) -> Result<Directory, PmtError> {
    let bytes = crate::decompress(compression, raw)?;
    Directory::parse(&bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{HEADER_SIZE, TileType};

    const LEAF_ARCHIVE: &[u8] = include_bytes!("../tests/fixtures/leaf.pmtiles");

    #[test]
    fn bootstrap_in_one_read_then_resolve_through_a_leaf() {
        let mut archive = PmtilesArchive::new();

        // Bootstrap: one request, no duplicate while in flight.
        let req = archive.take_bootstrap_request().unwrap();
        assert_eq!(
            req,
            ByteRange {
                offset: 0,
                length: 16_384
            }
        );
        assert!(archive.take_bootstrap_request().is_none());

        // The fixture is 265 bytes, so the "16 KiB" fetch returns the whole
        // file; its root directory is in-window, so one read reaches Ready.
        archive.on_bootstrap_bytes(LEAF_ARCHIVE).unwrap();
        assert!(archive.is_ready());
        assert_eq!(archive.header().unwrap().tile_type, TileType::Unknown);

        // Tile (1,1,0) → tile id 4. The root is a single leaf pointer, so the
        // first resolve asks for the leaf.
        let Resolution::NeedLeaf {
            leaf_offset,
            request,
        } = archive.resolve(1, 1, 0)
        else {
            panic!("expected a leaf request");
        };
        assert_eq!(leaf_offset, 0);
        assert_eq!(
            request,
            ByteRange {
                offset: 233,
                length: 27
            }
        );

        // Feed the leaf, then resolve again to get the tile's byte range.
        let leaf_bytes =
            &LEAF_ARCHIVE[request.offset as usize..(request.offset + request.length) as usize];
        archive.on_leaf_bytes(leaf_offset, leaf_bytes).unwrap();

        let Resolution::Tile { request } = archive.resolve(1, 1, 0) else {
            panic!("expected a tile");
        };
        // tile_data_offset (260) + entry offset (4 for tile id 4), length 1.
        assert_eq!(
            request,
            ByteRange {
                offset: 264,
                length: 1
            }
        );
    }

    #[test]
    fn resolve_absent_for_out_of_range_zoom() {
        let mut archive = PmtilesArchive::new();
        archive.take_bootstrap_request();
        archive.on_bootstrap_bytes(LEAF_ARCHIVE).unwrap();

        // The fixture's header advertises max_zoom = 1, so a z = 2 request is
        // out of range. It resolves to Absent directly via the zoom early-out,
        // without descending into (or fetching) any leaf directory.
        assert_eq!(archive.header().unwrap().max_zoom, 1);
        assert_eq!(archive.resolve(2, 3, 3), Resolution::Absent);
    }

    #[test]
    fn bootstrap_falls_back_to_a_separate_root_dir_fetch() {
        // Header claims the root dir lives at byte 10_000, beyond the bytes we
        // hand back for the bootstrap read, forcing a second request.
        let header = synth_header(10_000, 5);
        let mut archive = PmtilesArchive::new();

        assert_eq!(archive.take_bootstrap_request().unwrap().offset, 0);
        archive.on_bootstrap_bytes(&header).unwrap();
        assert!(!archive.is_ready());

        let req = archive.take_bootstrap_request().unwrap();
        assert_eq!(
            req,
            ByteRange {
                offset: 10_000,
                length: 5
            }
        );

        // One uncompressed tile entry: count=1, id-delta=0, run=1, length=10, offset=1(→0).
        let root_dir_raw = [0x01u8, 0x00, 0x01, 0x0a, 0x01];
        archive.on_bootstrap_bytes(&root_dir_raw).unwrap();
        assert!(archive.is_ready());

        // tile_data_offset is 200 in the synthetic header; entry offset 0.
        assert_eq!(
            archive.resolve(0, 0, 0),
            Resolution::Tile {
                request: ByteRange {
                    offset: 200,
                    length: 10
                }
            }
        );
    }

    #[test]
    fn malformed_header_poisons_the_archive_without_retrying() {
        let mut archive = PmtilesArchive::new();
        archive.take_bootstrap_request();
        assert_eq!(
            archive.on_bootstrap_bytes(b"too short"),
            Err(PmtError::UnexpectedEof)
        );
        assert!(archive.is_failed());
        // No retry storm: a failed archive issues no further requests.
        assert!(archive.take_bootstrap_request().is_none());
    }

    #[test]
    fn marked_failed_leaf_resolves_to_absent() {
        let mut archive = PmtilesArchive::new();
        archive.take_bootstrap_request();
        archive.on_bootstrap_bytes(LEAF_ARCHIVE).unwrap();

        // Tile 4 routes through the (single) leaf pointer at offset 0.
        assert!(matches!(
            archive.resolve(1, 1, 0),
            Resolution::NeedLeaf { leaf_offset: 0, .. }
        ));

        // Once that leaf is marked failed, the tile resolves to Absent instead
        // of looping on another NeedLeaf.
        archive.mark_leaf_failed(0);
        assert_eq!(archive.resolve(1, 1, 0), Resolution::Absent);
    }

    #[test]
    fn mark_failed_stops_bootstrapping() {
        let mut archive = PmtilesArchive::new();
        archive.mark_failed();
        assert!(archive.is_failed());
        assert!(archive.take_bootstrap_request().is_none());
    }

    /// Build a minimal valid 127-byte header with no compression, an MVT tile
    /// type, leaf section at 100, tile section at 200, and a caller-chosen root
    /// directory location.
    fn synth_header(root_offset: u64, root_length: u64) -> Vec<u8> {
        let mut h = vec![0u8; HEADER_SIZE];
        h[0..7].copy_from_slice(b"PMTiles");
        h[7] = 3;
        h[8..16].copy_from_slice(&root_offset.to_le_bytes());
        h[16..24].copy_from_slice(&root_length.to_le_bytes());
        h[40..48].copy_from_slice(&100u64.to_le_bytes()); // leaf_dirs_offset
        h[56..64].copy_from_slice(&200u64.to_le_bytes()); // tile_data_offset
        h[97] = 1; // internal compression: none
        h[98] = 1; // tile compression: none
        h[99] = 1; // tile type: mvt
        h[100] = 0; // min zoom
        h[101] = 14; // max zoom
        h
    }
}
