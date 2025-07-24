use navara_wasm_macro::wasm_idl;
use wasm_bindgen::prelude::*;

// Example 1: Basic API with simple methods
#[wasm_idl(ApiClient)]
trait ApiTrait {
    fn get_data(endpoint: &str) -> String;
    fn post_data(endpoint: &str, data: &str) -> bool;
    fn get_status() -> i32;
    fn get_base_url(&self) -> String;
}

#[wasm_bindgen]
struct ApiClient {
    base_url: String,
}

// Example 2: Mathematical operations API
#[wasm_idl(MathProcessor)]
trait MathTrait {
    fn add(a: f64, b: f64) -> f64;
    fn multiply(a: f64, b: f64) -> f64;
    fn calculate_sqrt(value: f64) -> f64;
    fn get_precision(&self) -> f64;
    fn set_precision(&self, precision: f64);
}

#[wasm_bindgen]
struct MathProcessor {
    precision: f64,
}

// Example 3: Data processing API
#[wasm_idl(DataProcessor)]
trait DataTrait {
    fn process_buffer(data: &[u8]) -> Vec<u8>;
    fn validate_input(input: &str) -> bool;
    fn transform_data(input: &str) -> String;
    fn get_buffer_size(&self) -> usize;
    fn reset_buffer(&self);
}

#[wasm_bindgen]
struct DataProcessor {
    buffer_size: usize,
}

fn main() {
    println!("Dynamic trait examples compiled successfully!");
    println!("Generated IDL implementations for:");
    println!("- ApiClient from ApiTrait (with static and instance methods)");
    println!("- MathProcessor from MathTrait (with static and instance methods)");
    println!("- DataProcessor from DataTrait (with static and instance methods)");
}
