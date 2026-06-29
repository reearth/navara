use wasm_bindgen::JsValue;

// These functions have been implemented based on this issue: https://github.com/rustwasm/wasm-bindgen/issues/1079#issuecomment-508577627
// As known issue, `::view` allows taking a reference, but it's mutable: https://github.com/rustwasm/wasm-bindgen/issues/1643

pub fn transfer_u8_array(byte_length: usize, f: &js_sys::Function) -> Vec<u8> {
    let buffer = vec![0; byte_length];
    unsafe {
        let array = js_sys::Uint8Array::view(&buffer);
        f.call1(&JsValue::NULL, &JsValue::from(array))
            .expect("The callback function should not throw");
    }
    buffer
}

pub fn transfer_u32_array(byte_length: usize, f: &js_sys::Function) -> Vec<u32> {
    let buffer = vec![0; byte_length];
    unsafe {
        let array = js_sys::Uint32Array::view(&buffer);
        f.call1(&JsValue::NULL, &JsValue::from(array))
            .expect("The callback function should not throw");
    }
    buffer
}

pub fn transfer_f32_array(byte_length: usize, f: &js_sys::Function) -> Vec<f32> {
    let buffer = vec![0.; byte_length];
    unsafe {
        let array = js_sys::Float32Array::view(&buffer);
        f.call1(&JsValue::NULL, &JsValue::from(array))
            .expect("The callback function should not throw");
    }
    buffer
}

pub fn transfer_f64_array(byte_length: usize, f: &js_sys::Function) -> Vec<f64> {
    let buffer = vec![0.; byte_length];
    unsafe {
        let array = js_sys::Float64Array::view(&buffer);
        f.call1(&JsValue::NULL, &JsValue::from(array))
            .expect("The callback function should not throw");
    }
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
