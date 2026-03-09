use std::sync::Arc;

use geozero::mvt::tile;
use navara_property::PropertyValue;
use rustc_hash::FxHashMap;

/// Raw MVT layer data for lazy property parsing.
/// Properties are only parsed when accessed via `get_property`.
#[derive(Debug, Clone)]
pub struct MvtLayerData {
    /// Property key names (shared across all features in the layer)
    pub keys: Arc<Vec<String>>,
    /// Property values (shared across all features in the layer) - raw MVT format for lazy conversion
    pub values: Arc<Vec<tile::Value>>,
    /// Per-feature tags: pairs of (key_index, value_index) into keys and values
    pub feature_tags: Vec<Vec<u32>>,
}

/// A single MVT property value (mirrors protobuf tile::Value)
#[derive(Debug, Clone)]
pub enum MvtValue {
    String(String),
    Float(f32),
    Double(f64),
    Int(i64),
    UInt(u64),
    SInt(i64),
    Bool(bool),
}

impl MvtValue {
    pub fn to_value<V: PropertyValue>(&self) -> V {
        match self {
            MvtValue::String(s) => V::from_string(s.clone()),
            MvtValue::Float(f) => V::from_f32(*f),
            MvtValue::Double(d) => V::from_f64(*d),
            MvtValue::Int(i) => V::from_i64(*i),
            MvtValue::UInt(u) => V::from_u64(*u),
            MvtValue::SInt(i) => V::from_i64(*i),
            MvtValue::Bool(b) => V::from_bool(*b),
        }
    }
}

/// Convert raw MVT tile::Value to PropertyValue
fn tile_value_to_property<V: PropertyValue>(value: &tile::Value) -> V {
    if let Some(s) = &value.string_value {
        V::from_string(s.clone())
    } else if let Some(f) = value.float_value {
        V::from_f32(f)
    } else if let Some(d) = value.double_value {
        V::from_f64(d)
    } else if let Some(i) = value.int_value {
        V::from_i64(i)
    } else if let Some(u) = value.uint_value {
        V::from_u64(u)
    } else if let Some(i) = value.sint_value {
        V::from_i64(i)
    } else if let Some(b) = value.bool_value {
        V::from_bool(b)
    } else {
        V::null()
    }
}

impl MvtLayerData {
    /// Get properties for a specific feature index.
    /// Properties are converted lazily from raw MVT format.
    pub fn get_properties<V: PropertyValue>(&self, feature_index: usize) -> Option<V> {
        let tags = self.feature_tags.get(feature_index)?;
        let mut props = V::empty_map();

        for pair in tags.chunks(2) {
            if let [key_idx, value_idx] = pair {
                let key = self.keys.get(*key_idx as usize)?;
                let value = self.values.get(*value_idx as usize)?;
                V::insert(&mut props, key.clone(), tile_value_to_property(value));
            }
        }

        Some(V::finalize_map(props))
    }

    /// Get only the requested properties for a specific feature index.
    /// Returns `Vec<Option<V>>` in the same order as `keys` (None for missing keys).
    pub fn get_filtered_properties<V: PropertyValue>(
        &self,
        feature_index: usize,
        keys: &[String],
    ) -> Option<Vec<Option<V>>> {
        let tags = self.feature_tags.get(feature_index)?;

        let mut result: Vec<Option<V>> = keys.iter().map(|_| None).collect();
        let mut indexed_keys = FxHashMap::default();
        for (i, k) in keys.iter().enumerate() {
            indexed_keys.insert(k, i);
        }

        for pair in tags.chunks(2) {
            if let [key_idx, value_idx] = pair {
                let key = self.keys.get(*key_idx as usize)?;
                if let Some(pos) = indexed_keys.get(key) {
                    let value = self.values.get(*value_idx as usize)?;
                    result[*pos] = Some(tile_value_to_property(value));
                }
            }
        }

        Some(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use geozero::mvt::tile;
    use serde_json::json;
    use std::sync::Arc;

    fn make_layer_data() -> MvtLayerData {
        let keys = Arc::new(vec![
            "name".to_string(),
            "height".to_string(),
            "visible".to_string(),
        ]);
        let values = Arc::new(vec![
            tile::Value {
                string_value: Some("building_a".to_string()),
                ..Default::default()
            },
            tile::Value {
                double_value: Some(42.5),
                ..Default::default()
            },
            tile::Value {
                bool_value: Some(true),
                ..Default::default()
            },
            tile::Value {
                string_value: Some("building_b".to_string()),
                ..Default::default()
            },
            tile::Value {
                int_value: Some(100),
                ..Default::default()
            },
        ]);
        // Feature 0: name=building_a, height=42.5, visible=true
        // Feature 1: name=building_b, height=100 (no visible)
        let feature_tags = vec![vec![0, 0, 1, 1, 2, 2], vec![0, 3, 1, 4]];
        MvtLayerData {
            keys,
            values,
            feature_tags,
        }
    }

    #[test]
    fn test_get_properties_all_tags() {
        let layer = make_layer_data();
        let props: serde_json::Value = layer.get_properties(0).unwrap();
        let map = props.as_object().unwrap();

        assert_eq!(map["name"], json!("building_a"));
        assert_eq!(map["height"], json!(42.5));
        assert_eq!(map["visible"], json!(true));
    }

    #[test]
    fn test_get_properties_partial_tags() {
        let layer = make_layer_data();
        let props: serde_json::Value = layer.get_properties(1).unwrap();
        let map = props.as_object().unwrap();

        assert_eq!(map["name"], json!("building_b"));
        assert_eq!(map["height"], json!(100));
        assert!(!map.contains_key("visible"));
    }

    #[test]
    fn test_get_properties_out_of_bounds() {
        let layer = make_layer_data();
        let result: Option<serde_json::Value> = layer.get_properties(99);
        assert!(result.is_none());
    }

    #[test]
    fn test_get_filtered_properties_ordering_and_missing() {
        let layer = make_layer_data();
        let keys = vec![
            "visible".to_string(),
            "nonexistent".to_string(),
            "name".to_string(),
        ];

        let result: Vec<Option<serde_json::Value>> =
            layer.get_filtered_properties(0, &keys).unwrap();

        assert_eq!(result.len(), 3);
        assert_eq!(result[0], Some(json!(true)));
        assert_eq!(result[1], None);
        assert_eq!(result[2], Some(json!("building_a")));
    }

    #[test]
    fn test_get_filtered_properties_feature_missing_some_keys() {
        let layer = make_layer_data();
        // Feature 1 has no "visible" tag
        let keys = vec!["visible".to_string(), "name".to_string()];
        let result: Vec<Option<serde_json::Value>> =
            layer.get_filtered_properties(1, &keys).unwrap();

        assert_eq!(result[0], None);
        assert_eq!(result[1], Some(json!("building_b")));
    }
}
