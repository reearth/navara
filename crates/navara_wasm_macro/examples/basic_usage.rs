use navara_wasm_macro::wasm_idl;
use wasm_bindgen::prelude::*;

#[wasm_idl(IdlExample)]
trait Example {
    fn hello();
    fn greet(&self, name: &str) -> String;
}

#[wasm_bindgen]
struct IdlExample {
    test: f32,
}

fn main() {
    println!("Basic usage example compiled successfully!");
    println!("Generated wasm_bindgen impl for IdlExample from Example trait");
}
