/// A trait for constructing property values from primitive types.
/// This enables generic property reading that can target different output types
/// (e.g., serde_json::Value for Rust-side use, or JsValue for WASM).
pub trait PropertyValue: Sized {
    /// The map type used for building object properties.
    type Map;

    /// Create a value from an i64.
    fn from_i64(v: i64) -> Self;
    /// Create a value from a u64.
    fn from_u64(v: u64) -> Self;
    /// Create a value from an f32.
    fn from_f32(v: f32) -> Self;
    /// Create a value from an f64.
    fn from_f64(v: f64) -> Self;
    /// Create a value from a bool.
    fn from_bool(v: bool) -> Self;
    /// Create a value from a String.
    fn from_string(v: String) -> Self;
    /// Create a null value.
    fn null() -> Self;
    /// Create a value from an array of values.
    fn from_array(v: Vec<Self>) -> Self;
    /// Create an empty map.
    fn empty_map() -> Self::Map;
    /// Insert a key-value pair into the map.
    fn insert(map: &mut Self::Map, key: String, value: Self);
    /// Finalize the map into a value.
    fn finalize_map(map: Self::Map) -> Self;
}

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
