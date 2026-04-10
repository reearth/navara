use std::collections::HashMap;
use std::sync::Arc;

use navara_property::PropertyValue;
use rustc_hash::FxHashMap;

/// Stores property table data from EXT_structural_metadata for lazy decoding.
pub struct PropertyTableData {
    /// Number of features (rows) in the table.
    pub count: u32,
    /// Property names and their binary data.
    /// Key: property name, Value: raw binary data for that column.
    pub properties: Arc<HashMap<String, PropertyColumnData>>,
}

/// Binary data for a single property column in a PropertyTable.
pub struct PropertyColumnData {
    /// Raw binary data containing the values.
    pub values: Vec<u8>,
    /// The component type (e.g. UINT8, FLOAT32, STRING).
    pub component_type: String,
    /// The top-level type (e.g. SCALAR, VEC2, VEC3, STRING).
    pub element_type: String,
    /// Sentinel value from schema `noData` property, encoded as little-endian bytes.
    /// When a decoded value's raw bytes match this, the value is treated as null.
    /// Used for numeric types only.
    pub no_data: Option<Vec<u8>>,
    /// Sentinel string value from schema `noData` property for STRING types.
    /// When a decoded string matches this, the value is treated as null.
    pub string_no_data: Option<String>,
    /// Byte offsets for STRING type properties (from `stringOffsets` buffer view).
    /// Per spec, this is an array of `count + 1` offsets marking string boundaries.
    pub string_offsets: Option<Vec<u8>>,
    /// Component type for string offsets (UINT8, UINT16, or UINT32). Defaults to UINT32.
    pub string_offset_type: String,
    /// Whether integer values should be normalized to [0,1] or [-1,1] range.
    pub normalized: bool,
    /// Offset to add after normalization/scaling: `finalValue = offset + scale * value`.
    /// For SCALAR: single-element vec. For VEC/MAT: one element per component.
    pub offset: Option<Vec<f64>>,
    /// Scale factor: `finalValue = offset + scale * value`.
    /// For SCALAR: single-element vec. For VEC/MAT: one element per component.
    pub scale: Option<Vec<f64>>,
}

impl PropertyTableData {
    /// Get all properties for a feature at the given index.
    pub fn get_properties<V: PropertyValue>(&self, index: usize) -> Option<V> {
        if index >= self.count as usize {
            return None;
        }
        let mut props = V::empty_map();
        for (name, col) in self.properties.as_ref() {
            let value = read_column_value::<V>(col, index).unwrap_or_else(V::null);
            V::insert(&mut props, name.clone(), value);
        }
        Some(V::finalize_map(props))
    }

    /// Get filtered properties for a feature at the given index.
    /// Returns `Vec<Option<V>>` in the same order as `keys`.
    pub fn get_filtered_properties<V: PropertyValue>(
        &self,
        index: usize,
        keys: &[String],
    ) -> Option<Vec<Option<V>>> {
        if index >= self.count as usize {
            return None;
        }
        let mut indexed_keys = FxHashMap::default();
        for (i, k) in keys.iter().enumerate() {
            indexed_keys.insert(k.as_str(), i);
        }
        let mut result: Vec<Option<V>> = keys.iter().map(|_| None).collect();
        for (name, col) in self.properties.as_ref() {
            if let Some(&pos) = indexed_keys.get(name.as_str()) {
                result[pos] = read_column_value::<V>(col, index);
            }
        }
        Some(result)
    }
}

/// Read a value from a column, returning null if it matches the noData sentinel.
/// Applies normalization, scale, and offset transforms per 3D Tiles 1.1 spec.
fn read_column_value<V: PropertyValue>(col: &PropertyColumnData, index: usize) -> Option<V> {
    if is_no_data(col, index) {
        return Some(V::null());
    }
    if col.element_type == "STRING" {
        return match read_string_value(&col.values, index, col.string_offsets.as_deref(), &col.string_offset_type) {
            Some(s) if col.string_no_data.as_deref() == Some(s.as_str()) => Some(V::null()),
            Some(s) => Some(V::from_string(s)),
            None => None,
        };
    }

    // If normalization, offset, or scale is needed, decode as f64 and transform
    if col.normalized || col.offset.is_some() || col.scale.is_some() {
        let elem_count = element_count(&col.element_type);
        let comp_size = component_size(&col.component_type);
        let base_offset = index * elem_count * comp_size;

        if elem_count == 1 {
            // SCALAR path
            let raw = read_raw_f64(&col.values, index, &col.component_type)?;
            let norm = if col.normalized {
                normalize_value(raw, &col.component_type)
            } else {
                raw
            };
            let scale = col
                .scale
                .as_ref()
                .and_then(|s| s.first().copied())
                .unwrap_or(1.0);
            let offset = col
                .offset
                .as_ref()
                .and_then(|o| o.first().copied())
                .unwrap_or(0.0);
            return Some(V::from_f64(offset + scale * norm));
        }

        // VEC/MAT path: per-component transform
        let mut arr = Vec::with_capacity(elem_count);
        for i in 0..elem_count {
            let byte_off = base_offset + i * comp_size;
            let raw = read_raw_f64_at(&col.values, byte_off, &col.component_type)?;
            let norm = if col.normalized {
                normalize_value(raw, &col.component_type)
            } else {
                raw
            };
            let scale = col
                .scale
                .as_ref()
                .and_then(|s| s.get(i).copied())
                .unwrap_or(1.0);
            let offset = col
                .offset
                .as_ref()
                .and_then(|o| o.get(i).copied())
                .unwrap_or(0.0);
            arr.push(V::from_f64(offset + scale * norm));
        }
        return Some(V::from_array(arr));
    }

    read_value::<V>(&col.values, index, &col.component_type, &col.element_type)
}

/// Check if the raw bytes at the given index match the noData sentinel value.
fn is_no_data(col: &PropertyColumnData, index: usize) -> bool {
    let Some(no_data) = &col.no_data else {
        return false;
    };
    let size = no_data.len();
    if size == 0 {
        return false;
    }
    let offset = index * size;
    col.values
        .get(offset..offset + size)
        .is_some_and(|bytes| bytes == no_data.as_slice())
}

/// Encode a JSON `noData` value to little-endian bytes matching the given component type.
pub fn encode_no_data(no_data: &serde_json::Value, component_type: &str) -> Option<Vec<u8>> {
    match component_type {
        "INT8" => no_data.as_i64().map(|v| (v as i8).to_le_bytes().to_vec()),
        "UINT8" => no_data.as_u64().map(|v| (v as u8).to_le_bytes().to_vec()),
        "INT16" => no_data.as_i64().map(|v| (v as i16).to_le_bytes().to_vec()),
        "UINT16" => no_data.as_u64().map(|v| (v as u16).to_le_bytes().to_vec()),
        "INT32" => no_data.as_i64().map(|v| (v as i32).to_le_bytes().to_vec()),
        "UINT32" => no_data.as_u64().map(|v| (v as u32).to_le_bytes().to_vec()),
        "INT64" => no_data.as_i64().map(|v| v.to_le_bytes().to_vec()),
        "UINT64" => no_data.as_u64().map(|v: u64| v.to_le_bytes().to_vec()),
        "FLOAT32" => no_data.as_f64().map(|v| (v as f32).to_le_bytes().to_vec()),
        "FLOAT64" => no_data.as_f64().map(|v: f64| v.to_le_bytes().to_vec()),
        _ => None,
    }
}

/// Returns the byte size of a single component for the given 3D Tiles 1.1 component type.
pub fn component_size(component_type: &str) -> usize {
    match component_type {
        "INT8" | "UINT8" => 1,
        "INT16" | "UINT16" => 2,
        "INT32" | "UINT32" | "FLOAT32" => 4,
        "INT64" | "UINT64" | "FLOAT64" => 8,
        _ => 0,
    }
}

/// Returns the number of scalar components per element for the given element type.
pub fn element_count(element_type: &str) -> usize {
    match element_type {
        "SCALAR" => 1,
        "VEC2" => 2,
        "VEC3" => 3,
        "VEC4" => 4,
        "MAT2" => 4,
        "MAT3" => 9,
        "MAT4" => 16,
        _ => 1,
    }
}

/// Decode a single scalar value from binary data at the given byte offset.
pub fn read_scalar<V: PropertyValue>(
    bytes: &[u8],
    offset: usize,
    component_type: &str,
) -> Option<V> {
    match component_type {
        "INT8" => bytes.get(offset).map(|&b| V::from_i64(b as i8 as i64)),
        "UINT8" => bytes.get(offset).map(|&b| V::from_u64(b as u64)),
        "INT16" => bytes
            .get(offset..offset + 2)
            .map(|b| V::from_i64(i16::from_le_bytes([b[0], b[1]]) as i64)),
        "UINT16" => bytes
            .get(offset..offset + 2)
            .map(|b| V::from_u64(u16::from_le_bytes([b[0], b[1]]) as u64)),
        "INT32" => bytes
            .get(offset..offset + 4)
            .map(|b| V::from_i64(i32::from_le_bytes([b[0], b[1], b[2], b[3]]) as i64)),
        "UINT32" => bytes
            .get(offset..offset + 4)
            .map(|b| V::from_u64(u32::from_le_bytes([b[0], b[1], b[2], b[3]]) as u64)),
        "INT64" => bytes.get(offset..offset + 8).map(|b| {
            V::from_i64(i64::from_le_bytes([
                b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7],
            ]))
        }),
        "UINT64" => bytes.get(offset..offset + 8).map(|b| {
            V::from_u64(u64::from_le_bytes([
                b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7],
            ]))
        }),
        "FLOAT32" => bytes
            .get(offset..offset + 4)
            .map(|b| V::from_f32(f32::from_le_bytes([b[0], b[1], b[2], b[3]]))),
        "FLOAT64" => bytes.get(offset..offset + 8).map(|b| {
            V::from_f64(f64::from_le_bytes([
                b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7],
            ]))
        }),
        _ => None,
    }
}

/// Decode one element at the given feature index from binary column data.
///
/// Supports SCALAR, VEC2/3/4, MAT2/3/4, STRING, and BOOLEAN element types.
pub fn read_value<V: PropertyValue>(
    bytes: &[u8],
    index: usize,
    component_type: &str,
    element_type: &str,
) -> Option<V> {
    match element_type {
        "SCALAR" => {
            let size = component_size(component_type);
            let offset = index * size;
            read_scalar::<V>(bytes, offset, component_type)
        }
        "STRING" => read_string_value(bytes, index, None, "UINT32").map(V::from_string),
        "BOOLEAN" => {
            let byte_offset = index / 8;
            let bit_offset = index % 8;
            bytes
                .get(byte_offset)
                .map(|&b| V::from_bool((b >> bit_offset) & 1 == 1))
        }
        "VEC2" | "VEC3" | "VEC4" | "MAT2" | "MAT3" | "MAT4" => {
            let count = element_count(element_type);
            let size = component_size(component_type);
            let base_offset = index * count * size;
            let mut arr = Vec::with_capacity(count);
            for i in 0..count {
                arr.push(read_scalar::<V>(
                    bytes,
                    base_offset + i * size,
                    component_type,
                )?);
            }
            Some(V::from_array(arr))
        }
        _ => {
            let size = component_size(component_type);
            let offset = index * size;
            read_scalar::<V>(bytes, offset, component_type)
        }
    }
}

/// Read a single offset value from the string offsets buffer.
fn read_string_offset(offsets: &[u8], index: usize, offset_type: &str) -> Option<usize> {
    match offset_type {
        "UINT8" => offsets.get(index).map(|&b| b as usize),
        "UINT16" => {
            let pos = index * 2;
            offsets
                .get(pos..pos + 2)
                .map(|b| u16::from_le_bytes([b[0], b[1]]) as usize)
        }
        // Default: UINT32
        _ => {
            let pos = index * 4;
            offsets
                .get(pos..pos + 4)
                .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]) as usize)
        }
    }
}

/// Decode a string from binary column data.
/// Uses stringOffsets when available (spec-compliant), falls back to
/// null-separated strings when stringOffsets is absent.
fn read_string_value(
    bytes: &[u8],
    index: usize,
    string_offsets: Option<&[u8]>,
    string_offset_type: &str,
) -> Option<String> {
    if let Some(offsets) = string_offsets {
        let start = read_string_offset(offsets, index, string_offset_type)?;
        let end = read_string_offset(offsets, index + 1, string_offset_type)?;
        if start <= end && end <= bytes.len() {
            return Some(String::from_utf8_lossy(&bytes[start..end]).into_owned());
        }
        return None;
    }

    // Fallback: null-separated strings (when stringOffsets is absent)
    let mut current_index = 0;
    let mut start = 0;
    for (i, &b) in bytes.iter().enumerate() {
        if b == 0 {
            if current_index == index {
                return Some(String::from_utf8_lossy(&bytes[start..i]).into_owned());
            }
            current_index += 1;
            start = i + 1;
        }
    }
    if current_index == index && start < bytes.len() {
        return Some(String::from_utf8_lossy(&bytes[start..]).into_owned());
    }
    None
}

/// Read a single scalar value as f64 from binary data at the given feature index.
fn read_raw_f64(bytes: &[u8], index: usize, component_type: &str) -> Option<f64> {
    let size = component_size(component_type);
    read_raw_f64_at(bytes, index * size, component_type)
}

/// Read a single scalar value as f64 from binary data at the given byte offset.
fn read_raw_f64_at(bytes: &[u8], offset: usize, component_type: &str) -> Option<f64> {
    match component_type {
        "INT8" => bytes.get(offset).map(|&b| (b as i8) as f64),
        "UINT8" => bytes.get(offset).map(|&b| b as f64),
        "INT16" => bytes
            .get(offset..offset + 2)
            .map(|b| i16::from_le_bytes([b[0], b[1]]) as f64),
        "UINT16" => bytes
            .get(offset..offset + 2)
            .map(|b| u16::from_le_bytes([b[0], b[1]]) as f64),
        "INT32" => bytes
            .get(offset..offset + 4)
            .map(|b| i32::from_le_bytes([b[0], b[1], b[2], b[3]]) as f64),
        "UINT32" => bytes
            .get(offset..offset + 4)
            .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]) as f64),
        "INT64" => bytes
            .get(offset..offset + 8)
            .map(|b| i64::from_le_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]]) as f64),
        "UINT64" => bytes
            .get(offset..offset + 8)
            .map(|b| u64::from_le_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]]) as f64),
        "FLOAT32" => bytes
            .get(offset..offset + 4)
            .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]) as f64),
        "FLOAT64" => bytes
            .get(offset..offset + 8)
            .map(|b| f64::from_le_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]])),
        _ => None,
    }
}

/// Normalize an integer value per 3D Tiles 1.1 spec.
/// Unsigned: value / maxUint, Signed: max(value / maxInt, -1.0)
fn normalize_value(raw: f64, component_type: &str) -> f64 {
    match component_type {
        "UINT8" => raw / 255.0,
        "UINT16" => raw / 65535.0,
        "UINT32" => raw / 4294967295.0,
        "UINT64" => raw / u64::MAX as f64,
        "INT8" => (raw / 127.0).max(-1.0),
        "INT16" => (raw / 32767.0).max(-1.0),
        "INT32" => (raw / 2147483647.0).max(-1.0),
        "INT64" => (raw / i64::MAX as f64).max(-1.0),
        // FLOAT types: no normalization needed
        _ => raw,
    }
}

/// Infer the component type and element type from the buffer size and feature count.
/// Used as a fallback when no schema is available.
pub fn infer_component_type(values_len: usize, count: u32) -> (String, String) {
    if count == 0 {
        return ("UINT32".to_string(), "SCALAR".to_string());
    }
    let bytes_per_feature = values_len / count as usize;
    let component_type = match bytes_per_feature {
        1 => "UINT8",
        2 => "UINT16",
        8 => "FLOAT64",
        // 4 bytes: could be UINT32, INT32, or FLOAT32 — default to FLOAT32
        // as it's the most common in practice for property data
        _ => "FLOAT32",
    };
    (component_type.to_string(), "SCALAR".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn make_property_table() -> PropertyTableData {
        let mut properties = HashMap::new();

        // height: 3 features, FLOAT32 SCALAR
        let mut height_bytes = Vec::new();
        height_bytes.extend_from_slice(&10.5f32.to_le_bytes());
        height_bytes.extend_from_slice(&20.0f32.to_le_bytes());
        height_bytes.extend_from_slice(&30.75f32.to_le_bytes());
        properties.insert(
            "height".to_string(),
            PropertyColumnData {
                values: height_bytes,
                component_type: "FLOAT32".to_string(),
                element_type: "SCALAR".to_string(),
                no_data: None,
                string_no_data: None,
                string_offsets: None,
                string_offset_type: String::new(),
                normalized: false,
                offset: None,
                scale: None,
            },
        );

        // id: 3 features, UINT32 SCALAR
        let mut id_bytes = Vec::new();
        id_bytes.extend_from_slice(&100u32.to_le_bytes());
        id_bytes.extend_from_slice(&200u32.to_le_bytes());
        id_bytes.extend_from_slice(&300u32.to_le_bytes());
        properties.insert(
            "id".to_string(),
            PropertyColumnData {
                values: id_bytes,
                component_type: "UINT32".to_string(),
                element_type: "SCALAR".to_string(),
                no_data: None,
                string_no_data: None,
                string_offsets: None,
                string_offset_type: String::new(),
                normalized: false,
                offset: None,
                scale: None,
            },
        );

        // name: 3 features, STRING with stringOffsets
        let name_bytes = b"building_abuilding_bbuilding_c".to_vec();
        let mut name_offsets = Vec::new();
        name_offsets.extend_from_slice(&0u32.to_le_bytes());
        name_offsets.extend_from_slice(&10u32.to_le_bytes());
        name_offsets.extend_from_slice(&20u32.to_le_bytes());
        name_offsets.extend_from_slice(&30u32.to_le_bytes());
        properties.insert(
            "name".to_string(),
            PropertyColumnData {
                values: name_bytes,
                component_type: String::new(),
                element_type: "STRING".to_string(),
                no_data: None,
                string_no_data: None,
                string_offsets: Some(name_offsets),
                string_offset_type: "UINT32".to_string(),
                normalized: false,
                offset: None,
                scale: None,
            },
        );

        PropertyTableData {
            count: 3,
            properties: Arc::new(properties),
        }
    }

    #[test]
    fn test_get_properties_all() {
        let table = make_property_table();
        let props: Value = table.get_properties(0).unwrap();
        let map = props.as_object().unwrap();

        assert_eq!(map["id"].as_u64(), Some(100));
        assert!((map["height"].as_f64().unwrap() - 10.5).abs() < 1e-6);
        assert_eq!(map["name"].as_str(), Some("building_a"));
    }

    #[test]
    fn test_get_properties_second_feature() {
        let table = make_property_table();
        let props: Value = table.get_properties(1).unwrap();
        let map = props.as_object().unwrap();

        assert_eq!(map["id"].as_u64(), Some(200));
        assert!((map["height"].as_f64().unwrap() - 20.0).abs() < 1e-6);
        assert_eq!(map["name"].as_str(), Some("building_b"));
    }

    #[test]
    fn test_get_properties_last_feature() {
        let table = make_property_table();
        let props: Value = table.get_properties(2).unwrap();
        let map = props.as_object().unwrap();

        assert_eq!(map["id"].as_u64(), Some(300));
        assert!((map["height"].as_f64().unwrap() - 30.75).abs() < 1e-6);
        assert_eq!(map["name"].as_str(), Some("building_c"));
    }

    #[test]
    fn test_get_properties_no_data_returns_null() {
        let mut properties = HashMap::new();

        let mut height_bytes = Vec::new();
        height_bytes.extend_from_slice(&10.5f32.to_le_bytes());
        height_bytes.extend_from_slice(&(-9999.0f32).to_le_bytes());
        height_bytes.extend_from_slice(&30.0f32.to_le_bytes());
        properties.insert(
            "height".to_string(),
            PropertyColumnData {
                values: height_bytes,
                component_type: "FLOAT32".to_string(),
                element_type: "SCALAR".to_string(),
                no_data: Some((-9999.0f32).to_le_bytes().to_vec()),
                string_no_data: None,
                string_offsets: None,
                string_offset_type: String::new(),
                normalized: false,
                offset: None,
                scale: None,
            },
        );

        let table = PropertyTableData {
            count: 3,
            properties: Arc::new(properties),
        };

        let props: Value = table.get_properties(0).unwrap();
        assert!((props["height"].as_f64().unwrap() - 10.5).abs() < 1e-6);

        let props: Value = table.get_properties(1).unwrap();
        assert!(props["height"].is_null());

        let props: Value = table.get_properties(2).unwrap();
        assert!((props["height"].as_f64().unwrap() - 30.0).abs() < 1e-6);
    }

    #[test]
    fn test_get_properties_no_data_uint32() {
        let mut properties = HashMap::new();

        let mut id_bytes = Vec::new();
        id_bytes.extend_from_slice(&100u32.to_le_bytes());
        id_bytes.extend_from_slice(&0u32.to_le_bytes());
        properties.insert(
            "id".to_string(),
            PropertyColumnData {
                values: id_bytes,
                component_type: "UINT32".to_string(),
                element_type: "SCALAR".to_string(),
                no_data: Some(0u32.to_le_bytes().to_vec()),
                string_no_data: None,
                string_offsets: None,
                string_offset_type: String::new(),
                normalized: false,
                offset: None,
                scale: None,
            },
        );

        let table = PropertyTableData {
            count: 2,
            properties: Arc::new(properties),
        };

        let props: Value = table.get_properties(0).unwrap();
        assert_eq!(props["id"].as_u64(), Some(100));

        let props: Value = table.get_properties(1).unwrap();
        assert!(props["id"].is_null());
    }

    #[test]
    fn test_get_properties_out_of_bounds() {
        let table = make_property_table();
        let result: Option<Value> = table.get_properties(3);
        assert!(result.is_none());
    }

    #[test]
    fn test_get_filtered_properties_ordering_and_missing() {
        let table = make_property_table();
        let keys = vec![
            "name".to_string(),
            "nonexistent".to_string(),
            "id".to_string(),
        ];
        let result: Vec<Option<Value>> = table.get_filtered_properties(0, &keys).unwrap();

        assert_eq!(result.len(), 3);
        assert_eq!(result[0], Some(Value::String("building_a".to_string())));
        assert_eq!(result[1], None);
        assert_eq!(result[2].as_ref().and_then(|v| v.as_u64()), Some(100));
    }

    #[test]
    fn test_get_filtered_properties_out_of_bounds() {
        let table = make_property_table();
        let keys = vec!["id".to_string()];
        let result: Option<Vec<Option<Value>>> = table.get_filtered_properties(99, &keys);
        assert!(result.is_none());
    }

    #[test]
    fn test_encode_no_data() {
        use serde_json::json;

        let bytes = encode_no_data(&json!(-9999.0), "FLOAT32").unwrap();
        assert_eq!(bytes, (-9999.0f32).to_le_bytes().to_vec());

        let bytes = encode_no_data(&json!(0), "UINT32").unwrap();
        assert_eq!(bytes, 0u32.to_le_bytes().to_vec());

        let bytes = encode_no_data(&json!(255), "UINT8").unwrap();
        assert_eq!(bytes, vec![255u8]);

        assert!(encode_no_data(&json!("text"), "FLOAT32").is_none());
    }

    #[test]
    fn test_read_scalar_uint32() {
        let bytes = 42u32.to_le_bytes();
        let v: Value = read_scalar(&bytes, 0, "UINT32").unwrap();
        assert_eq!(v.as_u64(), Some(42));
    }

    #[test]
    fn test_read_scalar_float32() {
        let bytes = 2.5f32.to_le_bytes();
        let v: Value = read_scalar(&bytes, 0, "FLOAT32").unwrap();
        let f = v.as_f64().unwrap();
        assert!((f - 2.5).abs() < 0.001);
    }

    #[test]
    fn test_read_scalar_int8() {
        let bytes = vec![0xFE]; // -2 as i8
        let v: Value = read_scalar(&bytes, 0, "INT8").unwrap();
        assert_eq!(v.as_i64(), Some(-2));
    }

    #[test]
    fn test_read_value_vec3_float32() {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&1.0f32.to_le_bytes());
        bytes.extend_from_slice(&2.0f32.to_le_bytes());
        bytes.extend_from_slice(&3.0f32.to_le_bytes());
        bytes.extend_from_slice(&4.0f32.to_le_bytes());
        bytes.extend_from_slice(&5.0f32.to_le_bytes());
        bytes.extend_from_slice(&6.0f32.to_le_bytes());

        let v: Value = read_value(&bytes, 1, "FLOAT32", "VEC3").unwrap();
        let arr = v.as_array().unwrap();
        assert_eq!(arr.len(), 3);
        assert!((arr[0].as_f64().unwrap() - 4.0).abs() < 1e-6);
        assert!((arr[1].as_f64().unwrap() - 5.0).abs() < 1e-6);
        assert!((arr[2].as_f64().unwrap() - 6.0).abs() < 1e-6);
    }

    #[test]
    fn test_read_value_boolean() {
        let bytes = vec![0b00000101];
        let v0: Value = read_value(&bytes, 0, "", "BOOLEAN").unwrap();
        assert_eq!(v0.as_bool(), Some(true));
        let v1: Value = read_value(&bytes, 1, "", "BOOLEAN").unwrap();
        assert_eq!(v1.as_bool(), Some(false));
        let v2: Value = read_value(&bytes, 2, "", "BOOLEAN").unwrap();
        assert_eq!(v2.as_bool(), Some(true));
    }

    #[test]
    fn test_read_multiple_scalars() {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&10u32.to_le_bytes());
        bytes.extend_from_slice(&20u32.to_le_bytes());
        bytes.extend_from_slice(&30u32.to_le_bytes());

        let v: Value = read_value(&bytes, 0, "UINT32", "SCALAR").unwrap();
        assert_eq!(v.as_u64(), Some(10));
        let v: Value = read_value(&bytes, 1, "UINT32", "SCALAR").unwrap();
        assert_eq!(v.as_u64(), Some(20));
        let v: Value = read_value(&bytes, 2, "UINT32", "SCALAR").unwrap();
        assert_eq!(v.as_u64(), Some(30));
    }

    #[test]
    fn test_out_of_bounds_returns_none() {
        let bytes = vec![0u8; 4];
        let v: Option<Value> = read_value(&bytes, 10, "UINT32", "SCALAR");
        assert!(v.is_none());
    }

    #[test]
    fn test_string_with_offsets() {
        let values = b"helloworld!".to_vec();
        let mut offsets = Vec::new();
        offsets.extend_from_slice(&0u32.to_le_bytes());
        offsets.extend_from_slice(&5u32.to_le_bytes());
        offsets.extend_from_slice(&10u32.to_le_bytes());
        offsets.extend_from_slice(&11u32.to_le_bytes());

        let col = PropertyColumnData {
            values,
            component_type: String::new(),
            element_type: "STRING".to_string(),
            no_data: None,
            string_no_data: None,
            string_offsets: Some(offsets),
            string_offset_type: "UINT32".to_string(),
            normalized: false,
            offset: None,
            scale: None,
        };

        let v: Value = read_column_value(&col, 0).unwrap();
        assert_eq!(v.as_str(), Some("hello"));
        let v: Value = read_column_value(&col, 1).unwrap();
        assert_eq!(v.as_str(), Some("world"));
        let v: Value = read_column_value(&col, 2).unwrap();
        assert_eq!(v.as_str(), Some("!"));
    }

    #[test]
    fn test_string_with_uint16_offsets() {
        let values = b"ab".to_vec();
        let mut offsets = Vec::new();
        offsets.extend_from_slice(&0u16.to_le_bytes());
        offsets.extend_from_slice(&1u16.to_le_bytes());
        offsets.extend_from_slice(&2u16.to_le_bytes());

        let col = PropertyColumnData {
            values,
            component_type: String::new(),
            element_type: "STRING".to_string(),
            no_data: None,
            string_no_data: None,
            string_offsets: Some(offsets),
            string_offset_type: "UINT16".to_string(),
            normalized: false,
            offset: None,
            scale: None,
        };

        let v: Value = read_column_value(&col, 0).unwrap();
        assert_eq!(v.as_str(), Some("a"));
        let v: Value = read_column_value(&col, 1).unwrap();
        assert_eq!(v.as_str(), Some("b"));
    }

    #[test]
    fn test_string_without_offsets_null_separated() {
        // When stringOffsets is absent, strings are decoded via null separators
        let col = PropertyColumnData {
            values: b"hello\0world\0".to_vec(),
            component_type: String::new(),
            element_type: "STRING".to_string(),
            no_data: None,
            string_no_data: None,
            string_offsets: None,
            string_offset_type: String::new(),
            normalized: false,
            offset: None,
            scale: None,
        };

        let v: Value = read_column_value(&col, 0).unwrap();
        assert_eq!(v.as_str(), Some("hello"));
        let v: Value = read_column_value(&col, 1).unwrap();
        assert_eq!(v.as_str(), Some("world"));
    }

    #[test]
    fn test_string_without_offsets_no_trailing_null() {
        // Last string may not have a trailing null
        let col = PropertyColumnData {
            values: b"hello\0world".to_vec(),
            component_type: String::new(),
            element_type: "STRING".to_string(),
            no_data: None,
            string_no_data: None,
            string_offsets: None,
            string_offset_type: String::new(),
            normalized: false,
            offset: None,
            scale: None,
        };

        let v: Value = read_column_value(&col, 0).unwrap();
        assert_eq!(v.as_str(), Some("hello"));
        let v: Value = read_column_value(&col, 1).unwrap();
        assert_eq!(v.as_str(), Some("world"));
    }

    #[test]
    fn test_string_without_offsets_no_data() {
        // noData sentinel should work with null-separated strings too
        let col = PropertyColumnData {
            values: "hello\0\u{FFFF}\0bye".as_bytes().to_vec(),
            component_type: String::new(),
            element_type: "STRING".to_string(),
            no_data: None,
            string_no_data: Some("\u{FFFF}".to_string()),
            string_offsets: None,
            string_offset_type: String::new(),
            normalized: false,
            offset: None,
            scale: None,
        };

        let v: Value = read_column_value(&col, 0).unwrap();
        assert_eq!(v.as_str(), Some("hello"));
        let v: Value = read_column_value(&col, 1).unwrap();
        assert!(v.is_null());
        let v: Value = read_column_value(&col, 2).unwrap();
        assert_eq!(v.as_str(), Some("bye"));
    }

    #[test]
    fn test_infer_component_type() {
        assert_eq!(
            infer_component_type(100, 100),
            ("UINT8".to_string(), "SCALAR".to_string())
        );
        assert_eq!(
            infer_component_type(200, 100),
            ("UINT16".to_string(), "SCALAR".to_string())
        );
        assert_eq!(
            infer_component_type(400, 100),
            ("FLOAT32".to_string(), "SCALAR".to_string())
        );
        assert_eq!(
            infer_component_type(800, 100),
            ("FLOAT64".to_string(), "SCALAR".to_string())
        );
        assert_eq!(
            infer_component_type(0, 0),
            ("UINT32".to_string(), "SCALAR".to_string())
        );
    }

    #[test]
    fn test_normalized_uint8() {
        let col = PropertyColumnData {
            values: vec![255, 128],
            component_type: "UINT8".to_string(),
            element_type: "SCALAR".to_string(),
            no_data: None,
            string_no_data: None,
            string_offsets: None,
            string_offset_type: String::new(),
            normalized: true,
            offset: None,
            scale: None,
        };

        let v: Value = read_column_value(&col, 0).unwrap();
        assert!((v.as_f64().unwrap() - 1.0).abs() < 1e-6);

        let v: Value = read_column_value(&col, 1).unwrap();
        assert!((v.as_f64().unwrap() - 128.0 / 255.0).abs() < 1e-6);
    }

    #[test]
    fn test_offset_and_scale() {
        let mut values = Vec::new();
        values.extend_from_slice(&10.0f32.to_le_bytes());
        values.extend_from_slice(&20.0f32.to_le_bytes());

        let col = PropertyColumnData {
            values,
            component_type: "FLOAT32".to_string(),
            element_type: "SCALAR".to_string(),
            no_data: None,
            string_no_data: None,
            string_offsets: None,
            string_offset_type: String::new(),
            normalized: false,
            offset: Some(vec![100.0]),
            scale: Some(vec![2.0]),
        };

        let v: Value = read_column_value(&col, 0).unwrap();
        assert!((v.as_f64().unwrap() - 120.0).abs() < 1e-6);

        let v: Value = read_column_value(&col, 1).unwrap();
        assert!((v.as_f64().unwrap() - 140.0).abs() < 1e-6);
    }

    #[test]
    fn test_normalized_with_offset_and_scale() {
        let mut values = Vec::new();
        values.extend_from_slice(&32768u16.to_le_bytes());

        let col = PropertyColumnData {
            values,
            component_type: "UINT16".to_string(),
            element_type: "SCALAR".to_string(),
            no_data: None,
            string_no_data: None,
            string_offsets: None,
            string_offset_type: String::new(),
            normalized: true,
            offset: Some(vec![10.0]),
            scale: Some(vec![100.0]),
        };

        let v: Value = read_column_value(&col, 0).unwrap();
        let expected = 10.0 + 100.0 * (32768.0 / 65535.0);
        assert!((v.as_f64().unwrap() - expected).abs() < 0.01);
    }

    #[test]
    fn test_vec3_with_offset_and_scale() {
        let mut values = Vec::new();
        values.extend_from_slice(&1.0f32.to_le_bytes());
        values.extend_from_slice(&2.0f32.to_le_bytes());
        values.extend_from_slice(&3.0f32.to_le_bytes());

        let col = PropertyColumnData {
            values,
            component_type: "FLOAT32".to_string(),
            element_type: "VEC3".to_string(),
            no_data: None,
            string_no_data: None,
            string_offsets: None,
            string_offset_type: String::new(),
            normalized: false,
            offset: Some(vec![10.0, 20.0, 30.0]),
            scale: Some(vec![2.0, 3.0, 4.0]),
        };

        let v: Value = read_column_value(&col, 0).unwrap();
        let arr = v.as_array().unwrap();
        assert!((arr[0].as_f64().unwrap() - 12.0).abs() < 1e-6);
        assert!((arr[1].as_f64().unwrap() - 26.0).abs() < 1e-6);
        assert!((arr[2].as_f64().unwrap() - 42.0).abs() < 1e-6);
    }

    #[test]
    fn test_vec3_normalized() {
        let values = vec![255u8, 128, 0];

        let col = PropertyColumnData {
            values,
            component_type: "UINT8".to_string(),
            element_type: "VEC3".to_string(),
            no_data: None,
            string_no_data: None,
            string_offsets: None,
            string_offset_type: String::new(),
            normalized: true,
            offset: None,
            scale: None,
        };

        let v: Value = read_column_value(&col, 0).unwrap();
        let arr = v.as_array().unwrap();
        assert!((arr[0].as_f64().unwrap() - 1.0).abs() < 1e-6);
        assert!((arr[1].as_f64().unwrap() - 128.0 / 255.0).abs() < 1e-4);
        assert!((arr[2].as_f64().unwrap() - 0.0).abs() < 1e-6);
    }
}
