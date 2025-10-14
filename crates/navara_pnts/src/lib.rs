#![doc = include_str!("../README.md")]

extern crate alloc;

mod types;

pub use navara_bin::*;

use alloc::vec::Vec;
use binrw::BinRead;
use serde::{Deserialize, Serialize};
use serde_json::{Number, Value};
use types::{ComponentType, DataType};

pub const PNTS_HEADER_SIZE: usize = 28;

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

pub fn read_property_from_binary(blob: &[u8], idx: usize, prop: &serde_json::Value) -> Result<Value, &'static str> {
    let offset = prop["byteOffset"].as_u64().unwrap() as usize;
    let component_type = ComponentType::from_str(prop["componentType"].as_str().unwrap());
    let data_type = DataType::from_str(prop["type"].as_str().unwrap());

    match data_type {
        DataType::Scalar => read_scalar(blob, offset, idx, component_type),
        DataType::Vec2 | DataType::Vec3 | DataType::Vec4 => {
            read_vector(blob, offset, idx, data_type, component_type)
        }
    }
}

fn read_scalar(blob: &[u8], byte_offset: usize, idx: usize, component_type: ComponentType) -> Result<Value, &'static str> {
    let offset = byte_offset + idx * component_type.size();
    read_value(blob, offset, &component_type)
}

fn read_vector(blob: &[u8], byte_offset: usize, idx: usize, data_type: DataType, component_type: ComponentType) -> Result<Value, &'static str> {
    let offset = byte_offset + idx * data_type.size() * component_type.size();
    let values = (0..data_type.size())
        .map(|j| read_value(blob, offset + j * component_type.size(), &component_type))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Value::Array(values))
}

fn read_value(blob: &[u8], offset: usize, component_type: &ComponentType) -> Result<Value, &'static str> {
    if offset + component_type.size() > blob.len() {
        return Err("Out of bounds read");
    }

    match component_type {
        ComponentType::Byte => Ok(Value::Number(
            (blob[offset] as i8 as i64).into(),
        )),
        ComponentType::UnsignedByte => Ok(Value::Number(blob[offset].into())),
        ComponentType::Short => Ok(Value::Number(
            (i16::from_le_bytes([blob[offset], blob[offset + 1]])
                as i64)
                .into(),
        )),
        ComponentType::UnsignedShort => Ok(Value::Number(
            u16::from_le_bytes([blob[offset], blob[offset + 1]]).into(),
        )),
        ComponentType::Int => Ok(Value::Number(
            (i32::from_le_bytes([
                blob[offset],
                blob[offset + 1],
                blob[offset + 2],
                blob[offset + 3],
            ]) as i64)
                .into(),
        )),
        ComponentType::UnsignedInt => Ok(Value::Number(
            u32::from_le_bytes([
                blob[offset],
                blob[offset + 1],
                blob[offset + 2],
                blob[offset + 3],
            ])
            .into(),
        )),
        ComponentType::Float => Ok(Value::Number(
            Number::from_f64(f32::from_le_bytes([
                blob[offset],
                blob[offset + 1],
                blob[offset + 2],
                blob[offset + 3],
            ]) as f64)
            .unwrap(),
        )),
        ComponentType::Double => Ok(Value::Number(
            Number::from_f64(f64::from_le_bytes([
                blob[offset],
                blob[offset + 1],
                blob[offset + 2],
                blob[offset + 3],
                blob[offset + 4],
                blob[offset + 5],
                blob[offset + 6],
                blob[offset + 7],
            ]))
            .unwrap(),
        )),
    }
}

// TODO: add tests

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_abs_diff_eq;
    #[cfg(test)]
    use serde_json::Value;
    use std::fs::read;

    #[test]
    fn it_should_parse_pnts() {
        let data = read("E:\\work-eukarya\\navara\\crates\\navara_pnts\\src\\test_data\\0.pnts").unwrap();
        let pnts = Pnts::from_data(&data).unwrap();

        let feature_table_json = json(&pnts.feature_table.json).unwrap();
        let batch_table_json = json(&pnts.batch_table.json).unwrap();

        let point_count = feature_table_json["POINTS_LENGTH"].as_u64().unwrap();
        assert!(point_count > 0);

        // let batch_length = pnts.feature_table.json.batch_length.unwrap() as usize;

        // assert_eq!(b3dm.header.version, 1);
        // assert_eq!(batch_length, 5);

        // let batch_table_json = b3dm.batch_table.json().unwrap();
        // assert_eq!(
        //     batch_table_json["some_property"],
        //     Value::Array(vec![
        //         Value::Number(1.into()),
        //         Value::Number(2.into()),
        //         Value::Number(3.into()),
        //         Value::Number(4.into()),
        //         Value::Number(5.into())
        //     ])
        // );

        // type Expects<'a> = Vec<(&'a str, Vec<Value>, Box<dyn Fn(Value, Value)>)>;

        // Batch table binary
        // let expects: Expects = vec![
        //     (
        //         "test_property_byte",
        //         vec![
        //             Value::Number(1.into()),
        //             Value::Number(2.into()),
        //             Value::Number(3.into()),
        //             Value::Number(4.into()),
        //             Value::Number(5.into()),
        //         ],
        //         Box::new(|a: Value, b: Value| assert_eq!(a, b)),
        //     ),
        //     (
        //         "test_property_float",
        //         vec![
        //             Value::Number(Number::from_f64(2.0).unwrap()),
        //             Value::Number(Number::from_f64(2.1).unwrap()),
        //             Value::Number(Number::from_f64(2.2).unwrap()),
        //             Value::Number(Number::from_f64(2.3).unwrap()),
        //             Value::Number(Number::from_f64(2.4).unwrap()),
        //         ],
        //         Box::new(|a: Value, b: Value| {
        //             assert_abs_diff_eq!(
        //                 a.as_f64().unwrap(),
        //                 b.as_f64().unwrap(),
        //                 epsilon = 0.000001
        //             );
        //         }),
        //     ),
        //     (
        //         "test_property_vec3",
        //         vec![
        //             Value::Array(vec![
        //                 Value::Number(Number::from_f64(3.0).unwrap()),
        //                 Value::Number(Number::from_f64(4.0).unwrap()),
        //                 Value::Number(Number::from_f64(5.0).unwrap()),
        //             ]),
        //             Value::Array(vec![
        //                 Value::Number(Number::from_f64(3.1).unwrap()),
        //                 Value::Number(Number::from_f64(4.1).unwrap()),
        //                 Value::Number(Number::from_f64(5.1).unwrap()),
        //             ]),
        //             Value::Array(vec![
        //                 Value::Number(Number::from_f64(3.2).unwrap()),
        //                 Value::Number(Number::from_f64(4.2).unwrap()),
        //                 Value::Number(Number::from_f64(5.2).unwrap()),
        //             ]),
        //             Value::Array(vec![
        //                 Value::Number(Number::from_f64(3.3).unwrap()),
        //                 Value::Number(Number::from_f64(4.3).unwrap()),
        //                 Value::Number(Number::from_f64(5.3).unwrap()),
        //             ]),
        //             Value::Array(vec![
        //                 Value::Number(Number::from_f64(3.4).unwrap()),
        //                 Value::Number(Number::from_f64(4.4).unwrap()),
        //                 Value::Number(Number::from_f64(5.4).unwrap()),
        //             ]),
        //         ],
        //         Box::new(|a: Value, b: Value| {
        //             let a = a.as_array().unwrap();
        //             let b = b.as_array().unwrap();
        //             // x
        //             assert_abs_diff_eq!(
        //                 a[0].as_f64().unwrap(),
        //                 b[0].as_f64().unwrap(),
        //                 epsilon = 0.000001
        //             );
        //             // y
        //             assert_abs_diff_eq!(
        //                 a[1].as_f64().unwrap(),
        //                 b[1].as_f64().unwrap(),
        //                 epsilon = 0.000001
        //             );
        //             // z
        //             assert_abs_diff_eq!(
        //                 a[2].as_f64().unwrap(),
        //                 b[2].as_f64().unwrap(),
        //                 epsilon = 0.000001
        //             );
        //         }),
        //     ),
        // ];

        // for (name, expect, assert) in expects {
        //     let property = &batch_table_json[name];

        //     for (batch_id, v) in expect.iter().enumerate() {
        //         let property_value = b3dm
        //             .batch_table
        //             .read_property_from_binary(batch_id, property)
        //             .unwrap();
        //         assert(property_value, v.clone());
        //     }
        // }
    }
}