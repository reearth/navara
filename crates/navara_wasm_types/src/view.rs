use wasm_bindgen::JsValue;

// These functions hand a freshly-allocated, *standalone* JS typed array to the
// callback `f`, let JS fill it, then copy it into an owned Rust `Vec`.
//
// We deliberately do NOT use `js_sys::*Array::view`, which returns a view into
// wasm's linear memory: such a view is only valid until the next allocation that
// grows the memory, after which its backing `ArrayBuffer` is detached. Because the
// view escapes into the JS callback (and back), any `memory.grow` along the way
// leaves the callback writing into a detached/out-of-bounds buffer — observed as
// intermittent `%TypedArray%.prototype.set on a detached ... ArrayBuffer` panics
// once the worker's heap is large enough to grow mid-transfer.
//
// A standalone JS array lives on the JS heap, not in wasm memory, so it is immune
// to `memory.grow`. The single wasm-memory write happens inside `to_vec`, which
// creates its view and uses it in one step with no intervening allocation.
//
// Background: https://github.com/wasm-bindgen/wasm-bindgen/blob/c9ee617e9a63340bfba0cecd7d53ba5262f25ddc/crates/js-sys/src/lib.rs#L6251-L6263

pub fn transfer_u8_array(byte_length: usize, f: &js_sys::Function) -> Vec<u8> {
    let array = js_sys::Uint8Array::new_with_length(byte_length as u32);
    f.call1(&JsValue::NULL, array.as_ref())
        .expect("The callback function should not throw");
    array.to_vec()
}

pub fn transfer_u32_array(byte_length: usize, f: &js_sys::Function) -> Vec<u32> {
    let array = js_sys::Uint32Array::new_with_length(byte_length as u32);
    f.call1(&JsValue::NULL, array.as_ref())
        .expect("The callback function should not throw");
    array.to_vec()
}

pub fn transfer_f32_array(byte_length: usize, f: &js_sys::Function) -> Vec<f32> {
    let array = js_sys::Float32Array::new_with_length(byte_length as u32);
    f.call1(&JsValue::NULL, array.as_ref())
        .expect("The callback function should not throw");
    array.to_vec()
}

pub fn transfer_f64_array(byte_length: usize, f: &js_sys::Function) -> Vec<f64> {
    let array = js_sys::Float64Array::new_with_length(byte_length as u32);
    f.call1(&JsValue::NULL, array.as_ref())
        .expect("The callback function should not throw");
    array.to_vec()
}

pub fn copy_u8_array(buf: &[u8]) -> js_sys::Uint8Array {
    let array = js_sys::Uint8Array::new(&JsValue::from(buf.len()));
    array.copy_from(buf);
    array
}
pub fn copy_u32_array(buf: &[u32]) -> js_sys::Uint32Array {
    let array = js_sys::Uint32Array::new(&JsValue::from(buf.len()));
    array.copy_from(buf);
    array
}
pub fn copy_f32_array(buf: &[f32]) -> js_sys::Float32Array {
    let array = js_sys::Float32Array::new(&JsValue::from(buf.len()));
    array.copy_from(buf);
    array
}
pub fn copy_f64_array(buf: &[f64]) -> js_sys::Float64Array {
    let array = js_sys::Float64Array::new(&JsValue::from(buf.len()));
    array.copy_from(buf);
    array
}
