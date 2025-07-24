use navara_wasm_macro::wasm_idl;
use wasm_bindgen::prelude::*;

// Example showing the new attribute-style usage on traits
#[wasm_idl(CustomApiClient)]
trait CustomApi {
    fn initialize() -> bool;
    fn cleanup();
    fn process_request(data: &str) -> String;
}

#[wasm_bindgen]
struct CustomApiClient {
    client_id: String,
}

// Another example with more complex method signatures
#[wasm_idl(DatabaseClient)]
trait DatabaseTrait {
    fn connect(url: &str) -> bool;
    fn query(sql: &str) -> Vec<String>;
    fn execute(command: &str) -> i32;
    fn disconnect();
}

#[wasm_bindgen]
struct DatabaseClient {
    connection_string: String,
}

fn main() {
    println!("Attribute-style examples compiled successfully!");
    println!("Generated implementations for:");
    println!("- CustomApiClient from CustomApi trait");
    println!("- DatabaseClient from DatabaseTrait trait");
}
