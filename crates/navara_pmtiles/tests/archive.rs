//! End-to-end tests for the [`PmtilesArchive`] bootstrap/resolve state machine,
//! driven entirely through the crate's public API.

use navara_pmtiles::*;

const LEAF_ARCHIVE: &[u8] = include_bytes!("./fixtures/leaf.pmtiles");

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
