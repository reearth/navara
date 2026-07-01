use pmtiles::*;

// A real 265-byte archive: 5 tiles addressed through a root directory that
// is a single leaf pointer into a 5-entry leaf directory. Internal
// (directory) compression is gzip; tiles are uncompressed.
const LEAF_ARCHIVE: &[u8] = include_bytes!("./fixtures/leaf.pmtiles");

// ---- tile_id: ported from the PMTiles reference test vectors ----

#[test]
fn tile_id_matches_reference_vectors() {
    assert_eq!(tile_id(0, 0, 0), 0);
    assert_eq!(tile_id(1, 1, 0), 4);
    assert_eq!(tile_id(2, 1, 3), 11);
    assert_eq!(tile_id(3, 3, 0), 26);
    assert_eq!(tile_id(20, 0, 0), 366_503_875_925);
    let max = (1 << 31) - 1;
    assert_eq!(tile_id(31, max, 0), 6_148_914_691_236_517_204);
}

#[test]
#[should_panic(expected = "z <= 31")]
fn tile_id_rejects_zoom_past_31() {
    let _ = tile_id(32, 0, 0);
}

// ---- header ----

#[test]
fn header_parse_rejects_bad_input() {
    assert_eq!(Header::parse(&[]), Err(Error::UnexpectedEof));
    let mut not_pmtiles = vec![0u8; HEADER_SIZE];
    not_pmtiles[..4].copy_from_slice(b"XXXX");
    assert_eq!(Header::parse(&not_pmtiles), Err(Error::InvalidMagic));
}

#[test]
fn header_parse_reads_known_fields() {
    let h = Header::parse(LEAF_ARCHIVE).unwrap();
    assert_eq!(h.version, 3);
    assert_eq!(h.root_dir_offset, 127);
    assert_eq!(h.root_dir_length, 25);
    assert_eq!(h.leaf_dirs_offset, 233);
    assert_eq!(h.tile_data_offset, 260);
    assert_eq!(h.internal_compression, Compression::Gzip);
    assert_eq!(h.tile_compression, Compression::None);
    assert_eq!(h.tile_type, TileType::Unknown);
    assert_eq!(h.min_zoom, 0);
    assert_eq!(h.max_zoom, 1);
}

// ---- directory: gzip + varint decode + leaf-aware find, end to end ----

/// Slice, decompress, and parse the directory at `[offset, offset+length)`.
fn read_dir(h: &Header, offset: u64, length: u64) -> Directory {
    let raw = &LEAF_ARCHIVE[offset as usize..(offset + length) as usize];
    let bytes = decompress(h.internal_compression, raw).unwrap();
    Directory::parse(&bytes).unwrap()
}

#[test]
fn root_directory_is_a_single_leaf_pointer() {
    let h = Header::parse(LEAF_ARCHIVE).unwrap();
    let root = read_dir(&h, h.root_dir_offset, h.root_dir_length);
    assert_eq!(root.entries.len(), 1);
    let entry = &root.entries[0];
    assert!(entry.is_leaf());
    assert_eq!(entry.tile_id, 0);
    assert_eq!(entry.offset, 0);
    assert_eq!(entry.length, 27);
}

#[test]
fn find_descends_root_then_resolves_in_leaf() {
    let h = Header::parse(LEAF_ARCHIVE).unwrap();

    // The root has no exact entry for tile 3, but the single preceding
    // entry is a leaf pointer, so `find` returns it for the caller to
    // descend into.
    let root = read_dir(&h, h.root_dir_offset, h.root_dir_length);
    let leaf_ptr = root.find(3).expect("root yields the leaf pointer");
    assert!(leaf_ptr.is_leaf());

    // Descend into that leaf and resolve the actual tile entry.
    let leaf = read_dir(
        &h,
        h.leaf_dirs_offset + leaf_ptr.offset,
        u64::from(leaf_ptr.length),
    );
    assert_eq!(leaf.entries.len(), 5);
    let tile = leaf.find(3).expect("tile 3 present in leaf");
    assert!(!tile.is_leaf());
    assert_eq!(tile.tile_id, 3);
    assert_eq!(tile.offset, 3);
    assert_eq!(tile.length, 1);
    assert_eq!(tile.run_length, 1);
}

#[test]
fn directory_parse_rejects_hostile_entry_count() {
    // A count the remaining bytes can't possibly hold (each entry needs at
    // least 4 bytes) must fail before allocating, not OOM.
    let huge_count = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f];
    assert_eq!(Directory::parse(&huge_count), Err(Error::UnexpectedEof));
}

#[test]
fn find_returns_none_past_the_end() {
    // A leaf with ids 0..=4, none covering id 9.
    let dir = Directory {
        entries: (0..5)
            .map(|i| Entry {
                tile_id: i,
                offset: i,
                length: 1,
                run_length: 1,
            })
            .collect(),
    };
    assert!(dir.find(9).is_none());
}
