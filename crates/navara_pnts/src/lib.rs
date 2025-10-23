#![doc = include_str!("../README.md")]
extern crate alloc;

pub use navara_bin::*;

use alloc::vec::Vec;
use binrw::BinRead;


#[derive(BinRead)]
pub struct Pnts {
    pub header: PntsHeader,
    #[br(args(header.feature_table_json_byte_length, header.feature_table_binary_byte_length))]
    pub feature_table: FeatureTable,
    #[br(args(header.batch_table_json_byte_length, header.batch_table_binary_byte_length))]
    pub batch_table: BatchTable,
}

impl BinaryReader<Pnts> for Pnts {}

#[derive(BinRead)]
#[br(magic = b"pnts", little)]
pub struct PntsHeader {
    pub version: u32,
    pub byte_length: u32,
    pub feature_table_json_byte_length: u32,
    pub feature_table_binary_byte_length: u32,
    pub batch_table_json_byte_length: u32,
    pub batch_table_binary_byte_length: u32,
}


#[derive(BinRead)]
#[br(import(feature_table_json_byte_length: u32, feature_table_binary_byte_length: u32))]
pub struct FeatureTable {
    #[br(count = feature_table_json_byte_length)]
    pub json: Vec<u8>,
    #[br(count = feature_table_binary_byte_length)]
    pub binary: Vec<u8>,
}

#[derive(BinRead)]
#[br(import(batch_table_json_byte_length: u32, batch_table_binary_byte_length: u32))]
pub struct BatchTable {
    #[br(count = batch_table_json_byte_length)]
    pub json: Vec<u8>,
    #[br(count = batch_table_binary_byte_length)]
    pub binary: Vec<u8>,
}

pub fn json(blob: &[u8]) -> Result<serde_json::Value, serde_json::Error> {
    parse_json_to_struct(&blob)
}