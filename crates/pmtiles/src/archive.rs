//! The PMTiles archive state machine.
//!
//! [`Archive`] tracks just enough state to turn a `z/x/y` request into a
//! byte range to fetch. It performs **no IO itself**: it emits the byte ranges
//! it needs ([`ByteRange`]) and is fed the resulting bytes back. The caller
//! owns the fetching (HTTP range requests, a local file, …), which keeps this
//! type a pure, deterministic state machine.
//!
//! Lifecycle:
//! 1. Repeatedly call [`take_bootstrap_request`](Archive::take_bootstrap_request);
//!    fetch each returned range and feed it to
//!    [`on_bootstrap_bytes`](Archive::on_bootstrap_bytes) until
//!    [`is_ready`](Archive::is_ready).
//! 2. Call [`resolve`](Archive::resolve) per tile. On [`Resolution::NeedLeaf`],
//!    fetch the leaf and feed it to [`on_leaf_bytes`](Archive::on_leaf_bytes),
//!    then resolve again. On [`Resolution::Tile`], fetch the payload.

use std::collections::{HashMap, HashSet, VecDeque};

use crate::{Compression, Directory, Error, Header, tile_id};

/// Resident-byte cap for cached leaf directories. A global multi-GB archive
/// has thousands of leaf directories; caching them all costs 50–500MB. Beyond
/// this cap, the oldest leaves are dropped and re-fetched on demand (a leaf is
/// only a few KB, and `resolve` re-emits `NeedLeaf` for a missing one), so
/// resident leaf memory stays bounded. Sized generously so the working set of
/// a viewport rarely thrashes.
const LEAF_CACHE_MAX_BYTES: usize = 32 * 1024 * 1024;

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
    /// `request`, feed it to [`Archive::on_leaf_bytes`] keyed by
    /// `leaf_offset`, then resolve again.
    NeedLeaf {
        /// Key to pass back to [`Archive::on_leaf_bytes`].
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
    /// leaf-directory section. Byte-capped (see [`LEAF_CACHE_MAX_BYTES`]);
    /// dropped leaves are re-fetched on the next `resolve`.
    leaves: HashMap<u64, Directory>,
    /// Insertion order of `leaves`, for FIFO eviction under the byte cap.
    leaf_order: VecDeque<u64>,
    /// Current resident bytes of `leaves`.
    leaves_bytes: usize,
    /// Leaf offsets whose bytes were *permanently* unusable (malformed: a
    /// refetch would parse identically). Tiles behind them resolve to `Absent`
    /// instead of looping on re-requests. Transient fetch failures (network
    /// error, aborted request) are deliberately NOT recorded here — those are
    /// retried, since a leaf can be evicted and re-fetched under the byte cap.
    failed_leaves: HashSet<u64>,
}

impl Ready {
    /// Insert a fetched leaf, evicting oldest leaves (FIFO) to stay under the
    /// byte cap.
    fn insert_leaf(&mut self, leaf_offset: u64, dir: Directory) {
        // Replacing an existing leaf: reverse its old contribution first.
        if let Some(old) = self.leaves.remove(&leaf_offset) {
            self.leaves_bytes = self.leaves_bytes.saturating_sub(old.byte_len());
            self.leaf_order.retain(|&o| o != leaf_offset);
        }
        self.leaves_bytes += dir.byte_len();
        self.leaves.insert(leaf_offset, dir);
        self.leaf_order.push_back(leaf_offset);

        while self.leaves_bytes > LEAF_CACHE_MAX_BYTES && self.leaf_order.len() > 1 {
            let Some(evict) = self.leaf_order.pop_front() else {
                break;
            };
            if let Some(dropped) = self.leaves.remove(&evict) {
                self.leaves_bytes = self.leaves_bytes.saturating_sub(dropped.byte_len());
            }
        }
    }
}

/// A PMTiles v3 archive being resolved incrementally. URL-agnostic: the caller
/// pairs it with whatever locates the bytes.
pub struct Archive {
    state: State,
}

impl Default for Archive {
    fn default() -> Self {
        Self {
            state: State::NeedHeader,
        }
    }
}

impl Archive {
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
    /// Returns [`Error`] if the header or root directory is malformed. On
    /// error the archive transitions to failed and issues no further requests.
    pub fn on_bootstrap_bytes(&mut self, bytes: &[u8]) -> Result<(), Error> {
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
                            leaf_order: VecDeque::new(),
                            leaves_bytes: 0,
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
                    leaf_order: VecDeque::new(),
                    leaves_bytes: 0,
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
                let length = u64::from(entry.length);
                if length == 0 {
                    return Resolution::Absent;
                }
                // Tile entry offsets are relative to `tile_data_offset`;
                // `checked_add` treats a corrupt offset that wraps `u64` as no
                // tile rather than emitting a bogus range request.
                let Some(offset) = ready.header.tile_data_offset.checked_add(entry.offset) else {
                    return Resolution::Absent;
                };
                if offset.checked_add(length).is_none() {
                    return Resolution::Absent;
                }
                return Resolution::Tile {
                    request: ByteRange { offset, length },
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
                    let length = u64::from(entry.length);
                    if length == 0 {
                        return Resolution::Absent;
                    }
                    // Leaf entry offsets are relative to `leaf_dirs_offset`;
                    // a corrupt offset that wraps `u64` resolves to absent
                    // rather than producing a bogus range request.
                    let Some(offset) = ready.header.leaf_dirs_offset.checked_add(entry.offset)
                    else {
                        return Resolution::Absent;
                    };
                    if offset.checked_add(length).is_none() {
                        return Resolution::Absent;
                    }
                    return Resolution::NeedLeaf {
                        leaf_offset: entry.offset,
                        request: ByteRange { offset, length },
                    };
                }
            }
        }
    }

    /// Feed a fetched leaf directory back, keyed by the `leaf_offset` from the
    /// [`Resolution::NeedLeaf`] that requested it.
    ///
    /// # Errors
    /// Returns [`Error`] if the leaf directory is malformed.
    pub fn on_leaf_bytes(&mut self, leaf_offset: u64, bytes: &[u8]) -> Result<(), Error> {
        let State::Ready(ready) = &mut self.state else {
            return Ok(());
        };
        let dir = parse_directory(ready.header.internal_compression, bytes)?;
        ready.insert_leaf(leaf_offset, dir);
        Ok(())
    }

    /// Mark the archive failed (e.g. when a bootstrap fetch errors at the
    /// network layer). Stops all further requests.
    pub fn mark_failed(&mut self) {
        self.state = State::Failed;
    }

    /// Record that the leaf directory at `leaf_offset` is *permanently*
    /// unusable — its bytes landed but were malformed, so a refetch would fail
    /// identically. Tiles behind it resolve to [`Resolution::Absent`] rather
    /// than looping on re-requests. No-op unless the archive is ready.
    ///
    /// Do NOT call this for a transient fetch failure (network error or an
    /// aborted request): those leaves are re-fetchable and must stay
    /// retryable, otherwise a single dropped request would vanish an entire
    /// region of the map until reload.
    pub fn mark_leaf_failed(&mut self, leaf_offset: u64) {
        if let State::Ready(ready) = &mut self.state {
            ready.failed_leaves.insert(leaf_offset);
        }
    }
}

/// Decompress then parse a directory blob.
fn parse_directory(compression: Compression, raw: &[u8]) -> Result<Directory, Error> {
    let bytes = crate::decompress(compression, raw)?;
    Directory::parse(&bytes)
}

#[cfg(test)]
mod leaf_cache_tests {
    use super::*;
    use crate::directory::Entry;
    use crate::header::TileType;

    fn header() -> Header {
        Header {
            version: 3,
            root_dir_offset: 0,
            root_dir_length: 0,
            leaf_dirs_offset: 0,
            tile_data_offset: 0,
            internal_compression: Compression::None,
            tile_compression: Compression::None,
            tile_type: TileType::Mvt,
            min_zoom: 0,
            max_zoom: 20,
        }
    }

    fn ready() -> Ready {
        Ready {
            header: header(),
            root_dir: Directory::default(),
            leaves: HashMap::new(),
            leaf_order: VecDeque::new(),
            leaves_bytes: 0,
            failed_leaves: HashSet::new(),
        }
    }

    /// A directory whose entry vector is `bytes` large (approx).
    fn dir_of_bytes(bytes: usize) -> Directory {
        let n = (bytes / std::mem::size_of::<Entry>()).max(1);
        Directory {
            entries: vec![Entry::default(); n],
        }
    }

    #[test]
    fn caps_resident_bytes_and_evicts_oldest_fifo() {
        let mut r = ready();
        let per_leaf = 8 * 1024 * 1024; // 8MB each; cap is 32MB → holds ~4.

        // Insert more than the cap can hold.
        for offset in 0..10u64 {
            r.insert_leaf(offset, dir_of_bytes(per_leaf));
        }

        assert!(
            r.leaves_bytes <= LEAF_CACHE_MAX_BYTES,
            "resident bytes exceeded the cap: {}",
            r.leaves_bytes
        );
        // Oldest (0,1,...) evicted; the most recent survive.
        assert!(!r.leaves.contains_key(&0), "oldest leaf should be evicted");
        assert!(r.leaves.contains_key(&9), "newest leaf should be resident");
        // leaves map and order queue stay consistent.
        assert_eq!(r.leaves.len(), r.leaf_order.len());
    }

    #[test]
    fn reinserting_same_offset_does_not_double_count() {
        let mut r = ready();
        r.insert_leaf(5, dir_of_bytes(4 * 1024 * 1024));
        let once = r.leaves_bytes;
        r.insert_leaf(5, dir_of_bytes(4 * 1024 * 1024));
        assert_eq!(r.leaves_bytes, once, "re-insert should replace, not add");
        assert_eq!(r.leaf_order.len(), 1);
    }
}
