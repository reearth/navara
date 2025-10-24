use navara_wasm_utils::set_panic_hook;
use wasm_bindgen::prelude::*;

mod ellipsoid;
mod intersection;
mod rte;
mod transform;

pub use ellipsoid::*;
pub use intersection::*;
pub use rte::*;
pub use transform::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen(start)]
pub fn start() {
    set_panic_hook();
    log("init navara_wasm_api");
}
