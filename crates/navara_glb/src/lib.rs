#![doc = include_str!("../README.md")]

extern crate alloc;

use binrw::BinRead;
use navara_bin::{parse_json_to_struct_from_reader, BinaryReader};
use serde_json::Value;

#[derive(BinRead)]
pub struct GlbHeader {
    pub version: u32,
    pub length: u32,
}

#[derive(BinRead)]
pub struct GlbJsonChunk {
    #[allow(unused)]
    chunk_length: u32,
    #[allow(unused)]
    chunk_type: u32,
    #[br(parse_with = parse_json_to_struct_from_reader, args(chunk_length))]
    pub data: Value,
}

#[derive(BinRead)]
pub struct GlbInner {
    pub header: GlbHeader,
    pub json_chunk: GlbJsonChunk,
    // Ignore other chunks
    // #[br(count = header.length - chunk.chunk_length - 12)] // 12 is the size of the header
    // bin: Vec<u8>,
}

#[derive(BinRead)]
#[br(magic = b"glTF", little)]
pub struct GlbWithMagic(pub GlbInner);
impl BinaryReader<GlbWithMagic> for GlbWithMagic {}

#[derive(BinRead)]
#[br(little)]
pub struct Glb(pub GlbInner);
impl BinaryReader<Glb> for Glb {}

pub mod mock {
    pub fn create_mock_glb_data(header: bool) -> Vec<u8> {
        // JSON chunk
        let json = r#"
    {
    "meshes": [
        {
            "primitives": [
                {
                    "extensions": {
                        "KHR_draco_mesh_compression": {
                            "bufferView": 1
                        }
                    }
                }
            ]
        }
    ],
    "extensions": {
        "CESIUM_RTC": {
            "center": [
                1.0,
                2.0,
                3.0
            ]
        }
    }
    }"#;
        let padded_json = {
            let mut padded = json.as_bytes().to_vec();
            padded.resize((padded.len() + 3) & !3, 0); // Align 4 byte
            padded
        };

        let bin = vec![0; 10];

        // Chunk
        let mut chunk_json = vec![];
        chunk_json.extend_from_slice(&(padded_json.len() as u32).to_le_bytes()); // chunk length
        chunk_json.extend_from_slice(&1u32.to_le_bytes()); // chunk type
        chunk_json.extend_from_slice(&padded_json);

        // Chunk
        let mut chunk_bin = vec![];
        chunk_bin.extend_from_slice(&(bin.len() as u32).to_le_bytes()); // chunk length
        chunk_bin.extend_from_slice(&1u32.to_le_bytes()); // chunk type
        chunk_bin.extend_from_slice(&bin);

        // GLB header
        let header_size = 12;
        let length = header_size + chunk_json.len();
        let mut header_data = vec![];
        if header {
            header_data.extend_from_slice(b"glTF");
        }
        header_data.extend_from_slice(&2u32.to_le_bytes()); // version
        header_data.extend_from_slice(&(length as u32).to_le_bytes());

        let mut data = vec![];
        data.extend_from_slice(&header_data);
        data.extend_from_slice(&chunk_json);
        data.extend_from_slice(&chunk_bin);

        data
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mock::create_mock_glb_data;
    use serde_json::{Number, Value};

    #[test]
    fn it_should_parse_glb() {
        let data = create_mock_glb_data(false);
        let glb = Glb::from_data(data).unwrap();

        assert_eq!(glb.0.header.version, 2);
        assert_eq!(
            glb.0.json_chunk.data["meshes"][0]["primitives"][0]["extensions"]
                ["KHR_draco_mesh_compression"]["bufferView"]
                .as_u64()
                .unwrap(),
            1
        );
        assert_eq!(
            glb.0.json_chunk.data["extensions"]["CESIUM_RTC"]["center"],
            Value::Array(vec![
                Value::Number(Number::from_f64(1.0).unwrap()),
                Value::Number(Number::from_f64(2.0).unwrap()),
                Value::Number(Number::from_f64(3.0).unwrap()),
            ])
        )
    }

    #[test]
    fn it_should_parse_glb_with_magic() {
        let data = create_mock_glb_data(true);
        let glb = GlbWithMagic::from_data(data).unwrap();

        assert_eq!(glb.0.header.version, 2);
    }
}
