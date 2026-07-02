use wasm_bindgen::{JsCast, JsValue};

// These functions expose a freshly-allocated Rust `Vec` to the JS callback `f` as
// a typed-array *view into wasm linear memory*, so JS writes straight into the Vec
// with no extra copy.
//
// The subtlety: `js_sys::*Array::view` builds its view from wasm-bindgen's *cached*
// memory object (`getFloat64ArrayMemory0()` etc.). If a `memory.grow` occurred, that
// cache can be stale, and the resulting view is detached/out-of-bounds — the callback
// then writes into a dead buffer (`%TypedArray%.prototype.set on a detached ...
// ArrayBuffer`), seen intermittently once the worker's heap grows mid-transfer.
//
// We sidestep the stale cache by building the view over `wasm.memory.buffer` fetched
// *fresh* at this instant, right after the `vec!` allocation (which is what may grow
// the memory) and immediately before the callback. Nothing allocates in between, so
// the view always references the current buffer. Zero-copy, and grow-safe.
//
// Background: https://github.com/rustwasm/wasm-bindgen/issues/1079#issuecomment-508577627

/// The current wasm linear-memory `ArrayBuffer`, fetched fresh (not cached).
#[inline]
fn current_memory_buffer() -> JsValue {
    wasm_bindgen::memory()
        .unchecked_ref::<js_sys::WebAssembly::Memory>()
        .buffer()
}

pub fn transfer_u8_array(byte_length: usize, f: &js_sys::Function) -> Vec<u8> {
    let mut buffer = vec![0u8; byte_length];
    let ptr = buffer.as_mut_ptr() as u32;
    let buf = current_memory_buffer();
    let array = js_sys::Uint8Array::new_with_byte_offset_and_length(&buf, ptr, byte_length as u32);
    f.call1(&JsValue::NULL, array.as_ref())
        .expect("The callback function should not throw");
    buffer
}

pub fn transfer_u32_array(byte_length: usize, f: &js_sys::Function) -> Vec<u32> {
    let mut buffer = vec![0u32; byte_length];
    let ptr = buffer.as_mut_ptr() as u32;
    let buf = current_memory_buffer();
    let array = js_sys::Uint32Array::new_with_byte_offset_and_length(&buf, ptr, byte_length as u32);
    f.call1(&JsValue::NULL, array.as_ref())
        .expect("The callback function should not throw");
    buffer
}

pub fn transfer_f32_array(byte_length: usize, f: &js_sys::Function) -> Vec<f32> {
    let mut buffer = vec![0f32; byte_length];
    let ptr = buffer.as_mut_ptr() as u32;
    let buf = current_memory_buffer();
    let array =
        js_sys::Float32Array::new_with_byte_offset_and_length(&buf, ptr, byte_length as u32);
    f.call1(&JsValue::NULL, array.as_ref())
        .expect("The callback function should not throw");
    buffer
}

pub fn transfer_f64_array(byte_length: usize, f: &js_sys::Function) -> Vec<f64> {
    let mut buffer = vec![0f64; byte_length];
    let ptr = buffer.as_mut_ptr() as u32;
    let buf = current_memory_buffer();
    let array =
        js_sys::Float64Array::new_with_byte_offset_and_length(&buf, ptr, byte_length as u32);
    f.call1(&JsValue::NULL, array.as_ref())
        .expect("The callback function should not throw");
    buffer
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
