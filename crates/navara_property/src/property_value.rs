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
