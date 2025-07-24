use navara_wasm_macro::wasm_idl;
use wasm_bindgen::prelude::*;

#[wasm_idl(IdlHandler)]
trait Handler {
    fn id(&self) -> u32;
}

#[wasm_bindgen]
struct IdlHandler;

// Define a trait with methods you want to expose to TypeScript
#[wasm_idl(IdlExample)]
trait Example {
    fn hello();
    fn greet(&self, name: &str) -> String;
    fn handler_id(&self) -> u32;
}

// Apply the wasm_bindgen attribute to the struct
#[wasm_bindgen]
pub struct IdlExample {
    pub test: f32,
}
