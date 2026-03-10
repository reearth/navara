use js_sys::{Array, Object, Reflect};
use navara_property::PropertyValue;
use wasm_bindgen::JsValue;

/// A newtype wrapper around JsValue that implements PropertyValue.
/// This allows direct construction of JavaScript values during property reading,
/// avoiding the overhead of serde_wasm_bindgen conversion.
pub struct JsPropertyValue(pub JsValue);

impl PropertyValue for JsPropertyValue {
    type Map = Object;

    fn from_i64(v: i64) -> Self {
        JsPropertyValue(JsValue::from_f64(v as f64))
    }

    fn from_u64(v: u64) -> Self {
        JsPropertyValue(JsValue::from_f64(v as f64))
    }

    fn from_f32(v: f32) -> Self {
        JsPropertyValue(JsValue::from_f64(v as f64))
    }

    fn from_f64(v: f64) -> Self {
        JsPropertyValue(JsValue::from_f64(v))
    }

    fn from_bool(v: bool) -> Self {
        JsPropertyValue(JsValue::from_bool(v))
    }

    fn from_string(v: String) -> Self {
        JsPropertyValue(JsValue::from_str(&v))
    }

    fn null() -> Self {
        JsPropertyValue(JsValue::NULL)
    }

    fn from_array(v: Vec<Self>) -> Self {
        let arr = Array::new();
        for item in v {
            arr.push(&item.0);
        }
        JsPropertyValue(arr.into())
    }

    fn empty_map() -> Self::Map {
        Object::new()
    }

    fn insert(map: &mut Self::Map, key: String, value: Self) {
        let _ = Reflect::set(map, &JsValue::from_str(&key), &value.0);
    }

    fn finalize_map(map: Self::Map) -> Self {
        JsPropertyValue(map.into())
    }
}
