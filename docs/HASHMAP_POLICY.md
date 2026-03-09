# HashMap Policy: `FxHashMap` vs `std::HashMap`

## Problem

Rust's default `HashMap` uses SipHash, which is resistant to HashDoS attacks but slower than necessary for internal keys. Since most of our hash maps use keys that are never derived from untrusted external input (Entity IDs, numeric indices, algorithm-local data), we can safely use a faster hasher.

## Rule

| Key Source | Type to Use | Example |
|---|---|---|
| **Internal** (Entity IDs, indices, algorithm-local) | `FxHashMap` / `FxHashSet` | Tile cache keyed by `Entity`, edge dedup keyed by `(usize, usize)` |
| **External** (user input, network data, deserialized JSON) | `std::collections::HashMap` / `HashSet` | URL query params, layer IDs from developer API, MVT layer names |

## Classification Guide

### Use `FxHashMap` / `FxHashSet` when keys are:

- **ECS Entity IDs** (`bevy_ecs::entity::Entity`)
- **Numeric indices** (`usize`, `u32`, `u64`, tuples of integers)
- **Algorithm-local strings** (e.g., quantized coordinate keys generated internally)
- **Internal struct keys** (composed of Entity fields or other internal data)

### Keep `std::HashMap` / `HashSet` when keys are:

- **URL strings or query parameters** from network requests
- **Layer IDs** provided by the developer API (`String` from external sources)
- **Deserialized data** from JSON, MVT tiles, or other external formats
- **User-provided strings** that could be influenced by external input

## Usage

### Adding `rustc-hash` to a crate

Add to the crate's `Cargo.toml`:

```toml
rustc-hash.workspace = true
```

### Import and use

```rust
use rustc_hash::{FxHashMap, FxHashSet};

// Use ::default() — FxHashMap does not support ::new()
let mut map: FxHashMap<Entity, MyValue> = FxHashMap::default();
let mut set: FxHashSet<u64> = FxHashSet::default();
```
