#![doc = include_str!("../README.md")]

extern crate alloc;

mod types;

pub use navara_bin::*;

use alloc::vec::Vec;
use binrw::BinRead;
use navara_glb::Glb;
use serde::{Deserialize, Serialize};
use serde_json::{Number, Value};
use types::{ComponentType, DataType};

#[derive(BinRead)]
pub struct B3dm {
    pub header: B3dmHeader,
    #[br(args(header.feature_table_json_byte_length, header.feature_table_binary_byte_length))]
    pub feature_table: FeatureTable,
    #[br(args(header.batch_table_json_byte_length, header.batch_table_binary_byte_length))]
    pub batch_table: BatchTable,
    pub glb: Glb,
}

impl BinaryReader<B3dm> for B3dm {}

#[derive(BinRead)]
#[br(magic = b"b3dm", little)]
pub struct B3dmHeader {
    pub version: u32,
    pub byte_length: u32,
    pub feature_table_json_byte_length: u32,
    pub feature_table_binary_byte_length: u32,
    pub batch_table_json_byte_length: u32,
    pub batch_table_binary_byte_length: u32,
}

#[derive(BinRead, Deserialize, Serialize)]
pub struct FeatureTableJson {
    #[serde(alias = "BATCH_LENGTH")]
    pub batch_length: Option<u32>,
}

#[derive(BinRead)]
#[br(import(feature_table_json_byte_length: u32, feature_table_binary_byte_length: u32))]
pub struct FeatureTable {
    #[br(parse_with = parse_json_to_struct_from_reader, args(feature_table_json_byte_length))]
    pub json: FeatureTableJson,
    #[br(count = feature_table_binary_byte_length)]
    pub binary: Vec<u8>,
}

#[derive(BinRead)]
#[br(import(batch_table_json_byte_length: u32, batch_table_binary_byte_length: u32))]
pub struct BatchTable {
    #[br(count = batch_table_json_byte_length)]
    pub json_data: Vec<u8>,
    #[br(count = batch_table_binary_byte_length)]
    pub binary_data: Vec<u8>,
}

impl BatchTable {
    pub fn json(&self) -> Result<serde_json::Value, serde_json::Error> {
        parse_json_to_struct(&self.json_data)
    }

    pub fn read_property_from_binary(
        &self,
        batch_length: usize,
        offset: usize,
        data_type: DataType,
        component_type: ComponentType,
    ) -> Result<Vec<Value>, &'static str> {
        match data_type {
            DataType::Scalar => self.read_scalar(offset, batch_length, component_type),
            DataType::Vec2 | DataType::Vec3 | DataType::Vec4 => {
                self.read_vector(offset, batch_length, data_type, component_type)
            }
        }
    }

    fn read_scalar(
        &self,
        byte_offset: usize,
        count: usize,
        component_type: ComponentType,
    ) -> Result<Vec<Value>, &'static str> {
        (0..count)
            .map(|i| {
                let offset = byte_offset + i * component_type.size();
                self.read_value(offset, &component_type)
            })
            .collect()
    }

    fn read_vector(
        &self,
        byte_offset: usize,
        count: usize,
        data_type: DataType,
        component_type: ComponentType,
    ) -> Result<Vec<Value>, &'static str> {
        (0..count)
            .map(|i| {
                let offset = byte_offset + i * data_type.size() * component_type.size();
                let values = (0..data_type.size())
                    .map(|j| self.read_value(offset + j * component_type.size(), &component_type))
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(Value::Array(values))
            })
            .collect()
    }

    fn read_value(
        &self,
        offset: usize,
        component_type: &ComponentType,
    ) -> Result<Value, &'static str> {
        if offset + component_type.size() > self.binary_data.len() {
            return Err("Out of bounds read");
        }

        match component_type {
            ComponentType::Byte => Ok(Value::Number(
                (self.binary_data[offset] as i8 as i64).into(),
            )),
            ComponentType::UnsignedByte => Ok(Value::Number(self.binary_data[offset].into())),
            ComponentType::Short => Ok(Value::Number(
                (i16::from_le_bytes([self.binary_data[offset], self.binary_data[offset + 1]])
                    as i64)
                    .into(),
            )),
            ComponentType::UnsignedShort => Ok(Value::Number(
                u16::from_le_bytes([self.binary_data[offset], self.binary_data[offset + 1]]).into(),
            )),
            ComponentType::Int => Ok(Value::Number(
                (i32::from_le_bytes([
                    self.binary_data[offset],
                    self.binary_data[offset + 1],
                    self.binary_data[offset + 2],
                    self.binary_data[offset + 3],
                ]) as i64)
                    .into(),
            )),
            ComponentType::UnsignedInt => Ok(Value::Number(
                u32::from_le_bytes([
                    self.binary_data[offset],
                    self.binary_data[offset + 1],
                    self.binary_data[offset + 2],
                    self.binary_data[offset + 3],
                ])
                .into(),
            )),
            ComponentType::Float => Ok(Value::Number(
                Number::from_f64(f32::from_le_bytes([
                    self.binary_data[offset],
                    self.binary_data[offset + 1],
                    self.binary_data[offset + 2],
                    self.binary_data[offset + 3],
                ]) as f64)
                .unwrap(),
            )),
            ComponentType::Double => Ok(Value::Number(
                Number::from_f64(f64::from_le_bytes([
                    self.binary_data[offset],
                    self.binary_data[offset + 1],
                    self.binary_data[offset + 2],
                    self.binary_data[offset + 3],
                    self.binary_data[offset + 4],
                    self.binary_data[offset + 5],
                    self.binary_data[offset + 6],
                    self.binary_data[offset + 7],
                ]))
                .unwrap(),
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_abs_diff_eq;
    #[cfg(test)]
    use navara_glb::mock::create_mock_glb_data;
    use serde_json::Value;

    fn create_mock_b3dm_data() -> Vec<u8> {
        // Feature Table JSON
        let feature_table_json = r#"
{
	"BATCH_LENGTH": 5
}"#;
        let feature_table_json_padded = {
            let mut padded = feature_table_json.as_bytes().to_vec();
            padded.resize((padded.len() + 3) & !3, 0); // Align 4 byte
            padded
        };

        // Feature Table Binary
        let feature_table_binary = vec![0u8; 10];

        // Batch Table JSON
        let batch_table_json = r#"
{
	"some_property": [1,2,3,4,5],
	"test_property_byte": {
		"byteOffset": 0,
		"componentType": "BYTE",
		"type": "SCALAR"
	},
	"test_property_float": {
		"byteOffset": 5,
		"componentType": "FLOAT",
		"type": "SCALAR"
	},
	"test_property_vec3": {
		"byteOffset": 25,
		"componentType": "FLOAT",
		"type": "VEC3"
	}
}"#;
        let batch_table_json_padded = {
            let mut padded = batch_table_json.as_bytes().to_vec();
            padded.resize((padded.len() + 3) & !3, 0); // Align 4 byte
            padded
        };

        // Batch Table Binary
        let mut batch_table_binary = vec![];
        // test_property_byte
        batch_table_binary.append(&mut 1i8.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 2i8.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 3i8.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 4i8.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 5i8.to_le_bytes().to_vec());
        // test_property_float
        batch_table_binary.append(&mut 2.0f32.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 2.1f32.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 2.2f32.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 2.3f32.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 2.4f32.to_le_bytes().to_vec());
        // test_property_vec3
        batch_table_binary.append(&mut 3.0f32.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 4.0f32.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 5.0f32.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 3.1f32.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 4.1f32.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 5.1f32.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 3.2f32.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 4.2f32.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 5.2f32.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 3.3f32.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 4.3f32.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 5.3f32.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 3.4f32.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 4.4f32.to_le_bytes().to_vec());
        batch_table_binary.append(&mut 5.4f32.to_le_bytes().to_vec());

        // GLB Data (dummy)
        let glb_data = create_mock_glb_data(false);

        let mut header = Vec::new();
        header.extend_from_slice(b"b3dm");
        header.extend_from_slice(&1u32.to_le_bytes()); // version

        let header_size = 28;

        let total_byte_length = header_size
            + feature_table_json_padded.len()
            + feature_table_binary.len()
            + batch_table_json_padded.len()
            + batch_table_binary.len()
            + glb_data.len();

        header.extend_from_slice(&(total_byte_length as u32).to_le_bytes());
        header.extend_from_slice(&(feature_table_json_padded.len() as u32).to_le_bytes());
        header.extend_from_slice(&(feature_table_binary.len() as u32).to_le_bytes());
        header.extend_from_slice(&(batch_table_json_padded.len() as u32).to_le_bytes());
        header.extend_from_slice(&(batch_table_binary.len() as u32).to_le_bytes());

        let mut data = Vec::new();
        data.extend_from_slice(&header);
        data.extend_from_slice(&feature_table_json_padded);
        data.extend_from_slice(&feature_table_binary);
        data.extend_from_slice(&batch_table_json_padded);
        data.extend_from_slice(&batch_table_binary);
        data.extend_from_slice(&glb_data);

        data
    }

    #[test]
    fn test_b3dm_header_parsing() {
        let data = create_mock_b3dm_data();
        let b3dm = B3dm::from_data(data).unwrap();

        let batch_length = b3dm.feature_table.json.batch_length.unwrap() as usize;

        assert_eq!(b3dm.header.version, 1);
        assert_eq!(batch_length, 5);

        let batch_table_json = b3dm.batch_table.json().unwrap();
        assert_eq!(
            batch_table_json["some_property"],
            Value::Array(vec![
                Value::Number(1.into()),
                Value::Number(2.into()),
                Value::Number(3.into()),
                Value::Number(4.into()),
                Value::Number(5.into())
            ])
        );

        type Expects<'a> = Vec<(&'a str, Vec<Value>, Box<dyn Fn(Vec<Value>, Vec<Value>)>)>;

        // Batch table binary
        let expects: Expects = vec![
            (
                "test_property_byte",
                vec![
                    Value::Number(1.into()),
                    Value::Number(2.into()),
                    Value::Number(3.into()),
                    Value::Number(4.into()),
                    Value::Number(5.into()),
                ],
                Box::new(|a: Vec<Value>, b: Vec<Value>| assert_eq!(a, b)),
            ),
            (
                "test_property_float",
                vec![
                    Value::Number(Number::from_f64(2.0).unwrap()),
                    Value::Number(Number::from_f64(2.1).unwrap()),
                    Value::Number(Number::from_f64(2.2).unwrap()),
                    Value::Number(Number::from_f64(2.3).unwrap()),
                    Value::Number(Number::from_f64(2.4).unwrap()),
                ],
                Box::new(|a: Vec<Value>, b: Vec<Value>| {
                    for (i, a) in a.iter().enumerate() {
                        assert_abs_diff_eq!(
                            a.as_f64().unwrap(),
                            b[i].as_f64().unwrap(),
                            epsilon = 0.000001
                        );
                    }
                }),
            ),
            (
                "test_property_vec3",
                vec![
                    Value::Array(vec![
                        Value::Number(Number::from_f64(3.0).unwrap()),
                        Value::Number(Number::from_f64(4.0).unwrap()),
                        Value::Number(Number::from_f64(5.0).unwrap()),
                    ]),
                    Value::Array(vec![
                        Value::Number(Number::from_f64(3.1).unwrap()),
                        Value::Number(Number::from_f64(4.1).unwrap()),
                        Value::Number(Number::from_f64(5.1).unwrap()),
                    ]),
                    Value::Array(vec![
                        Value::Number(Number::from_f64(3.2).unwrap()),
                        Value::Number(Number::from_f64(4.2).unwrap()),
                        Value::Number(Number::from_f64(5.2).unwrap()),
                    ]),
                    Value::Array(vec![
                        Value::Number(Number::from_f64(3.3).unwrap()),
                        Value::Number(Number::from_f64(4.3).unwrap()),
                        Value::Number(Number::from_f64(5.3).unwrap()),
                    ]),
                    Value::Array(vec![
                        Value::Number(Number::from_f64(3.4).unwrap()),
                        Value::Number(Number::from_f64(4.4).unwrap()),
                        Value::Number(Number::from_f64(5.4).unwrap()),
                    ]),
                ],
                Box::new(|a: Vec<Value>, b: Vec<Value>| {
                    for (i, a) in a.iter().enumerate() {
                        let a = a.as_array().unwrap();
                        let b = b[i].as_array().unwrap();
                        // x
                        assert_abs_diff_eq!(
                            a[0].as_f64().unwrap(),
                            b[0].as_f64().unwrap(),
                            epsilon = 0.000001
                        );
                        // y
                        assert_abs_diff_eq!(
                            a[1].as_f64().unwrap(),
                            b[1].as_f64().unwrap(),
                            epsilon = 0.000001
                        );
                        // z
                        assert_abs_diff_eq!(
                            a[2].as_f64().unwrap(),
                            b[2].as_f64().unwrap(),
                            epsilon = 0.000001
                        );
                    }
                }),
            ),
        ];

        for (name, expect, assert) in expects {
            let property = &batch_table_json[name];
            let offset = property["byteOffset"].as_u64().unwrap() as usize;
            let component_type =
                ComponentType::from_str(property["componentType"].as_str().unwrap());
            let data_type = DataType::from_str(property["type"].as_str().unwrap());
            let property_value = b3dm
                .batch_table
                .read_property_from_binary(batch_length, offset, data_type, component_type)
                .unwrap();
            assert(property_value, expect);
        }
    }
}
