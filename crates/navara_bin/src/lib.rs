#![doc = include_str!("../README.md")]

extern crate alloc;

use alloc::boxed::Box;
use alloc::vec::Vec;
use binrw::io::Cursor;
use binrw::{BinRead, BinReaderExt};

#[binrw::parser(reader: reader)]
pub fn parse_json_to_struct_from_reader<T: serde::de::DeserializeOwned>(
    count: u32,
) -> binrw::BinResult<T> {
    let mut buf = alloc::vec![0u8; count as usize];
    binrw::io::Read::read_exact(reader, &mut buf).map_err(binrw::Error::Io)?;

    // Trim padding
    parse_json_to_struct(&buf).map_err(|e| {
        let pos = reader.stream_position();
        match pos {
            Ok(p) => binrw::Error::Custom {
                pos: p,
                err: Box::new(e),
            },
            Err(e) => binrw::Error::Io(e),
        }
    })
}

pub fn parse_json_to_struct<T: serde::de::DeserializeOwned>(buf: &[u8]) -> serde_json::Result<T> {
    // Trim padding
    let buf = buf
        .iter()
        .take_while(|&&b| b != 0)
        .cloned()
        .collect::<Vec<u8>>();

    serde_json::from_slice(&buf)
}

pub trait BinaryReader<B: BinRead> {
    fn from_data<'a>(data: Vec<u8>) -> Result<B, binrw::Error>
    where
        B::Args<'a>: Default,
    {
        let mut reader = Cursor::new(&data);
        reader.read_be()
    }
}
