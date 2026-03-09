use crate::PropertyValue;

/// Implementation of PropertyValue for serde_json::Value.
impl PropertyValue for serde_json::Value {
    type Map = serde_json::Map<String, serde_json::Value>;

    fn from_i64(v: i64) -> Self {
        serde_json::Value::Number(v.into())
    }

    fn from_u64(v: u64) -> Self {
        serde_json::Value::Number(v.into())
    }

    fn from_f32(v: f32) -> Self {
        serde_json::Value::Number(serde_json::Number::from_f64(v as f64).unwrap_or(0.into()))
    }

    fn from_f64(v: f64) -> Self {
        serde_json::Value::Number(serde_json::Number::from_f64(v).unwrap_or(0.into()))
    }

    fn from_bool(v: bool) -> Self {
        serde_json::Value::Bool(v)
    }

    fn from_string(v: String) -> Self {
        serde_json::Value::String(v)
    }

    fn null() -> Self {
        serde_json::Value::Null
    }

    fn from_array(v: Vec<Self>) -> Self {
        serde_json::Value::Array(v)
    }

    fn empty_map() -> Self::Map {
        serde_json::Map::new()
    }

    fn insert(map: &mut Self::Map, key: String, value: Self) {
        map.insert(key, value);
    }

    fn finalize_map(map: Self::Map) -> Self {
        serde_json::Value::Object(map)
    }
}

/// Convert a single serde_json::Value to a PropertyValue.
pub fn json_value_to_property_value<V: PropertyValue>(value: &serde_json::Value) -> Option<V> {
    match value {
        serde_json::Value::Null => Some(V::null()),
        serde_json::Value::Bool(b) => Some(V::from_bool(*b)),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Some(V::from_i64(i))
            } else if let Some(u) = n.as_u64() {
                Some(V::from_u64(u))
            } else {
                n.as_f64().map(V::from_f64)
            }
        }
        serde_json::Value::String(s) => Some(V::from_string(s.clone())),
        serde_json::Value::Array(arr) => {
            let mut result = Vec::with_capacity(arr.len());
            for e in arr {
                let Some(v) = json_value_to_property_value::<V>(e) else {
                    continue;
                };
                result.push(v);
            }

            Some(V::from_array(result))
        }
        serde_json::Value::Object(map) => {
            let mut prop = V::empty_map();
            for (key, v) in map {
                if let Some(converted) = json_value_to_property_value::<V>(v) {
                    V::insert(&mut prop, key.clone(), converted);
                }
            }
            Some(V::finalize_map(prop))
        }
    }
}

/// Convert a serde_json::Value::Object to property values filtered by [`keys`].
pub fn json_value_to_filtered_properties<V: PropertyValue>(
    value: &serde_json::Value,
    keys: &[String],
) -> Option<Vec<Option<V>>> {
    let serde_json::Value::Object(map) = value else {
        return None;
    };

    let mut result: Vec<Option<V>> = keys.iter().map(|_| None).collect();

    for (pos, key) in keys.iter().enumerate() {
        if let Some(v) = map.get(key) {
            result[pos] = json_value_to_property_value::<V>(v);
        }
    }

    Some(result)
}

/// Convert a serde_json::Value::Object to a PropertyValue (expects Object variant).
pub fn json_value_to_property<V: PropertyValue>(value: &serde_json::Value) -> Option<V> {
    let serde_json::Value::Object(map) = value else {
        return None;
    };
    let mut prop = V::empty_map();
    for (key, v) in map {
        if let Some(converted) = json_value_to_property_value::<V>(v) {
            V::insert(&mut prop, key.clone(), converted);
        }
    }
    Some(V::finalize_map(prop))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Value, json};

    #[test]
    fn test_json_value_to_property_value_nested_structures() {
        let input = json!({"items": [1, 2], "meta": {"nested": true}});
        let result: Value = json_value_to_property_value(&input).unwrap();
        assert_eq!(result["items"], json!([1, 2]));
        assert_eq!(result["meta"]["nested"], json!(true));
    }

    #[test]
    fn test_json_value_to_property_value_u64_branch() {
        // u64::MAX doesn't fit in i64, so it must take the u64 branch
        let input = Value::Number(serde_json::Number::from(u64::MAX));
        let result: Value = json_value_to_property_value(&input).unwrap();
        assert_eq!(result.as_u64(), Some(u64::MAX));
    }

    #[test]
    fn test_filtered_properties_ordering_and_missing_keys() {
        let obj = json!({"b": 2, "a": 1, "c": 3});
        let keys = vec!["c".to_string(), "missing".to_string(), "a".to_string()];
        let result: Vec<Option<Value>> =
            json_value_to_filtered_properties::<Value>(&obj, &keys).unwrap();

        assert_eq!(result.len(), 3);
        assert_eq!(result[0], Some(json!(3)));
        assert_eq!(result[1], None);
        assert_eq!(result[2], Some(json!(1)));
    }

    #[test]
    fn test_filtered_properties_non_object_returns_none() {
        assert!(
            json_value_to_filtered_properties::<Value>(&json!([1, 2]), &["a".into()]).is_none()
        );
    }

    #[test]
    fn test_json_value_to_property_rejects_non_object() {
        assert!(json_value_to_property::<Value>(&json!("string")).is_none());
        assert!(json_value_to_property::<Value>(&json!(42)).is_none());
        assert!(json_value_to_property::<Value>(&json!(null)).is_none());
    }
}
