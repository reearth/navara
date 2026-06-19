//! PMTiles v3 directory: a sorted run of entries that map tile IDs to byte
//! ranges, encoded as four delta/LEB128-varint columns.

use crate::Error;

/// One directory entry.
///
/// An entry is either a **tile** (`run_length >= 1`, covering `run_length`
/// consecutive tile IDs starting at `tile_id`) or a **leaf-directory pointer**
/// (`run_length == 0`), in which case `offset`/`length` locate a child
/// directory in the leaf-directory section rather than a tile in the tile-data
/// section.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Entry {
    /// First tile ID this entry addresses.
    pub tile_id: u64,
    /// Byte offset, relative to the start of the section this entry points
    /// into (tile-data section for tiles, leaf-directory section for leaves).
    pub offset: u64,
    /// Byte length of the tile payload or child directory.
    pub length: u32,
    /// Number of consecutive tile IDs covered, or `0` for a leaf pointer.
    pub run_length: u32,
}

impl Entry {
    /// Whether this entry points to a child (leaf) directory rather than a tile.
    #[must_use]
    pub fn is_leaf(&self) -> bool {
        self.run_length == 0
    }
}

/// A parsed directory: entries sorted ascending by `tile_id`.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Directory {
    /// Entries in ascending `tile_id` order (as stored in the archive).
    pub entries: Vec<Entry>,
}

impl Directory {
    /// Parse a directory from its **decompressed** bytes.
    ///
    /// The encoding is: entry count, then four varint columns
    /// (delta-encoded tile IDs, run lengths, lengths, offsets). A zero offset
    /// is shorthand for "immediately after the previous entry"; any other
    /// offset is stored as `value - 1`.
    ///
    /// # Errors
    /// Returns [`Error::UnexpectedEof`] if the buffer ends mid-structure.
    pub fn parse(bytes: &[u8]) -> Result<Self, Error> {
        let mut cursor = bytes;
        let n = read_uvarint(&mut cursor)? as usize;
        // The count is untrusted input. Every entry occupies at least four
        // bytes (one per varint column), so a count the remaining buffer
        // cannot possibly satisfy is malformed — reject it before allocating
        // rather than letting a hostile count trigger a huge allocation.
        if n > cursor.len() / 4 {
            return Err(Error::UnexpectedEof);
        }
        let mut entries = vec![Entry::default(); n];

        // Column 1: tile IDs, delta-encoded from the previous entry.
        let mut tile_id = 0u64;
        for entry in &mut entries {
            tile_id += read_uvarint(&mut cursor)?;
            entry.tile_id = tile_id;
        }
        // Column 2: run lengths.
        for entry in &mut entries {
            let v = read_uvarint(&mut cursor)?;
            entry.run_length = u32::try_from(v).map_err(|_| Error::UnexpectedEof)?;
        }
        // Column 3: byte lengths.
        for entry in &mut entries {
            let v = read_uvarint(&mut cursor)?;
            entry.length = u32::try_from(v).map_err(|_| Error::UnexpectedEof)?;
        }
        // Column 4: offsets. 0 means "contiguous with the previous entry".
        for i in 0..entries.len() {
            let raw = read_uvarint(&mut cursor)?;
            entries[i].offset = if raw == 0 {
                let prev = i.checked_sub(1).ok_or(Error::UnexpectedEof)?;
                entries[prev].offset + u64::from(entries[prev].length)
            } else {
                raw - 1
            };
        }

        Ok(Self { entries })
    }

    /// Find the entry addressing `tile_id`, if any.
    ///
    /// Returns an exact match, or the covering entry when `tile_id` falls
    /// within a preceding entry's run length, or a preceding leaf-directory
    /// pointer (so the caller can descend into that leaf). Returns `None` when
    /// the archive has no data for this tile.
    #[must_use]
    pub fn find(&self, tile_id: u64) -> Option<&Entry> {
        match self.entries.binary_search_by(|e| e.tile_id.cmp(&tile_id)) {
            Ok(idx) => self.entries.get(idx),
            Err(next) => {
                // `next` is the insertion point; the candidate is the entry
                // just before it (mirrors the protomaps reference search).
                let prev = &self.entries[next.checked_sub(1)?];
                if prev.is_leaf() || (tile_id - prev.tile_id) < u64::from(prev.run_length) {
                    Some(prev)
                } else {
                    None
                }
            }
        }
    }
}

/// Read one unsigned LEB128 varint, advancing the cursor past it.
fn read_uvarint(cursor: &mut &[u8]) -> Result<u64, Error> {
    let mut result = 0u64;
    let mut shift = 0u32;
    loop {
        let (&byte, rest) = cursor.split_first().ok_or(Error::UnexpectedEof)?;
        *cursor = rest;
        result |= u64::from(byte & 0x7f) << shift;
        if byte & 0x80 == 0 {
            return Ok(result);
        }
        shift += 7;
        if shift >= 64 {
            // More continuation bits than a u64 can hold: malformed input.
            return Err(Error::UnexpectedEof);
        }
    }
}
