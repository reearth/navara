use serde::Serialize;
use wasm_bindgen::prelude::*;

/// This is used to share the entity id between WASM and client.
/// You can reconstruct Bevy Entity by `Entity:from_bits`.
#[wasm_bindgen]
#[derive(Clone, Debug, Default, Serialize)]
pub struct ReconstructableEntity(pub u64);
