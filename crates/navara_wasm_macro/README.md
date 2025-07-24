# navara_wasm_macro

A procedural macro for generating WASM IDL (Interface Definition Language) from Rust traits.

## Overview

This crate provides a clean and intuitive way to generate `wasm_bindgen` implementations for TypeScript interfaces from Rust trait definitions. The macro applies directly to trait definitions and generates implementations for specified structs.

## Features

- **Simple and intuitive** - Apply the macro directly to trait definitions
- **No hardcoded dependencies** - Works with any trait and struct combination
- **Clean syntax** - Specify the target struct as a parameter
- **Full method support** - Handles both static and instance methods with complex signatures
- **TypeScript-compatible** - Generates proper wasm_bindgen bindings

## Usage

Apply the `#[wasm_idl(StructName)]` attribute to a trait definition. The macro will generate a `wasm_bindgen` implementation of the trait methods for the specified struct.

The macro supports both static methods and instance methods:

```rust
use navara_wasm_macro::wasm_idl;
use wasm_bindgen::prelude::*;

#[wasm_idl(IdlExample)]
trait Example {
    fn hello();                              // Static method
    fn greet(&self, name: &str) -> String;   // Instance method
    fn calculate(a: f64, b: f64) -> f64;     // Static method
    fn get_value(&self) -> f32;              // Instance method
}

#[wasm_bindgen]
struct IdlExample {
    test: f32,
}
```

## Generated Code

The macro generates the following `wasm_bindgen` implementation:

```rust
#[wasm_bindgen]
impl IdlExample {
    #[wasm_bindgen]
    pub fn hello() {                         // Static method
        unreachable!();
    }
    
    #[wasm_bindgen]
    pub fn greet(&self, name: &str) -> String {  // Instance method
        unreachable!();
    }
    
    #[wasm_bindgen]
    pub fn calculate(a: f64, b: f64) -> f64 {    // Static method
        unreachable!();
    }
    
    #[wasm_bindgen]
    pub fn get_value(&self) -> f32 {             // Instance method
        unreachable!();
    }
}
```

## Examples

### Basic API

```rust
#[wasm_idl(ApiClient)]
trait ApiTrait {
    fn get_data(endpoint: &str) -> String;
    fn post_data(endpoint: &str, data: &str) -> bool;
    fn get_status() -> i32;
}

#[wasm_bindgen]
struct ApiClient {
    base_url: String,
}
```

### Mathematical Operations

```rust
#[wasm_idl(MathProcessor)]
trait MathTrait {
    fn add(a: f64, b: f64) -> f64;
    fn multiply(a: f64, b: f64) -> f64;
    fn calculate_sqrt(value: f64) -> f64;
}

#[wasm_bindgen]
struct MathProcessor {
    precision: f64,
}
```

### Database Operations

```rust
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
```

## Examples Directory

See the `examples/` directory for more usage patterns:

- `basic_usage.rs` - Simple trait-to-struct generation with static and instance methods
- `dynamic_trait.rs` - Multiple trait definitions with mixed method types
- `attribute_style.rs` - Complex method signatures  
- `self_methods.rs` - Comprehensive test of static vs instance methods

## Advantages

- ✅ **Intuitive syntax** - Macro is applied where it logically belongs (on the trait)
- ✅ **No hardcoded dependencies** - Works with any trait and struct combination
- ✅ **Clean and readable** - Easy to understand what struct will get the implementation
- ✅ **Maintainable** - No complex parsing or trait registry required
- ✅ **Flexible** - Support for complex method signatures and return types

## Limitations

- Generated methods contain `unreachable!()` and are meant for IDL generation only
- Does not support generic traits or complex type parameters yet
- Each trait can only generate implementation for one struct per macro application

## Future Enhancements

- Support for generic traits and type parameters
- Custom implementation bodies instead of `unreachable!()`
- Multiple target structs per trait
- Integration with existing trait implementations
- More sophisticated type mapping for TypeScript