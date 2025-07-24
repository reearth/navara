use navara_wasm_macro::wasm_idl;
use wasm_bindgen::prelude::*;

// Test trait with both static and instance methods
#[wasm_idl(TestStruct)]
trait TestTrait {
    // Static method (no &self)
    fn static_method() -> String;

    // Instance method with &self
    fn instance_method(&self) -> String;

    // Instance method with &self and parameters
    fn instance_with_params(&self, param1: &str, param2: i32) -> String;

    // Static method with parameters
    fn static_with_params(param1: &str, param2: i32) -> String;
}

#[wasm_bindgen]
struct TestStruct {
    value: String,
}

// Test another trait with only instance methods
#[wasm_idl(InstanceOnlyStruct)]
trait InstanceOnlyTrait {
    fn get_value(&self) -> String;
    fn set_value(&self, new_value: &str);
    fn transform_value(&self, prefix: &str, suffix: &str) -> String;
}

#[wasm_bindgen]
struct InstanceOnlyStruct {
    data: String,
}

// Test trait with only static methods
#[wasm_idl(StaticOnlyStruct)]
trait StaticOnlyTrait {
    fn create_default() -> String;
    fn validate(input: &str) -> bool;
    fn process(input: &str, flags: i32) -> String;
}

#[wasm_bindgen]
struct StaticOnlyStruct {
    config: String,
}

fn main() {
    println!("Self methods test compiled successfully!");
    println!("Generated implementations for:");
    println!("- TestStruct with mixed static and instance methods");
    println!("- InstanceOnlyStruct with only instance methods");
    println!("- StaticOnlyStruct with only static methods");
}
