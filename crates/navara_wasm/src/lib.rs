#![doc = include_str!("../README.md")]
mod appearance;
mod attribute;
mod event;
mod geometry;
mod input;
mod types;
mod unit;
mod utils;

use nanoid::nanoid;
use navara_ecs::App;
use navara_input::Key;
use navara_math::FloatType;
use wasm_bindgen::prelude::*;

pub use event::*;
pub use input::*;
pub use types::*;
pub use unit::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen(getter_with_clone)]
pub struct Core {
    pub id: String,
    app: App,
}

#[wasm_bindgen]
impl Core {
    #[wasm_bindgen(constructor)]
    pub fn new(id: String) -> Self {
        Self {
            id,
            app: App::new(),
        }
    }

    pub fn start(&mut self) {
        // debug
        self.app
            .trigger_event(navara_input::Input::Keyboard(navara_input::KeyboardInput {
                logical_key: Key::Character("a".into()),
                key_code: navara_input::KeyCode::KeyA,
                state: navara_input::ButtonState::Pressed,
            }));
    }

    pub fn update(&mut self) {
        self.app.update();
    }

    #[wasm_bindgen(js_name = readEvents)]
    pub fn read_events(&mut self) -> Option<Events> {
        self.app.read_events().map(|ev| ev.into())
    }

    pub fn input(&mut self, input: JsValue) {
        let Some(input) = Input::from(input) else {
            return;
        };

        let Some(input) = input.into_ecs_input() else {
            return;
        };

        self.app.trigger_event(input);
    }

    #[wasm_bindgen(js_name = getBufferU8)]
    pub fn get_buffer_u8(&self, handle: i32) -> Option<js_sys::Uint8Array> {
        let buf = self.app.get_buffer_u8(handle)?;

        Some(js_sys::Uint8Array::from(buf))
        // unsafe { Some(js_sys::Uint8Array::view(buf)) } // zero copy
    }

    #[wasm_bindgen(js_name = getBufferU32)]
    pub fn get_buffer_u32(&self, handle: i32) -> Option<js_sys::Uint32Array> {
        let buf = self.app.get_buffer_u32(handle)?;

        Some(js_sys::Uint32Array::from(buf))
        // unsafe { Some(js_sys::Uint32Array::view(buf)) } // zero copy
    }

    #[wasm_bindgen(js_name = getBufferF32)]
    pub fn get_buffer_f32(&self, handle: i32) -> Option<js_sys::Float32Array> {
        let buf = self.app.get_buffer_f32(handle)?;

        Some(js_sys::Float32Array::from(buf))
        // unsafe { Some(js_sys::Float32Array::view(buf)) } // zero copy
    }

    #[wasm_bindgen(js_name = setBufferU8)]
    pub fn set_buffer_u8(&mut self, handle: i32, bits: u64, data: &[u8]) {
        self.app.set_buffer(handle, bits, data.to_vec());
    }

    #[wasm_bindgen(js_name = triggerDataRequesterFailed)]
    pub fn trigger_data_requester_failed(&mut self, bits: u64) {
        self.app.trigger_data_requester_failed(bits);
    }

    pub fn resize(&mut self, width: FloatType, height: FloatType, pixel_ratio: FloatType) {
        self.app.resize(width, height, pixel_ratio);
    }

    #[wasm_bindgen(js_name = addLayer)]
    pub fn add_layer(&mut self, layer: JsValue) -> String {
        let layer_id = nanoid!();
        // TODO: Improve an undesirable cloning the layer.
        if let Some(ld) = LayerDescription::from(layer.clone()) {
            if let Some(layer_type) = ld.r#type {
                if let Some(l) = LayerDescription::to(&layer_id, layer_type.as_str(), layer) {
                    self.app.add_layer(layer_id.as_str(), l);
                }
            }
        }

        layer_id
    }

    #[wasm_bindgen(js_name = updateLayer)]
    pub fn update_layer(&mut self, layer_id: String, layer: JsValue) {
        let layer_type = self.app.get_layer_type(&layer_id);
        if layer_type == "geojson" {
            if let Some(l) = LayerDescription::to(layer_id.as_str(), layer_type, layer) {
                self.app.update_layer(layer_id.as_str(), l);
            }
        }
    }

    #[wasm_bindgen(js_name = triggerTextureFragmentLoaded)]
    pub fn trigger_texture_fragment_loaded(&mut self, bits: u64, status: TextureFragmentStatus) {
        self.app
            .trigger_texture_fragment_loaded(bits, status.into());
    }
}

#[wasm_bindgen(start)]
pub fn start() {
    utils::set_panic_hook();
    log("init navara_wasm");
}

// fn app<T>(id: String, f: impl FnOnce(&mut App) -> T) -> T {
//     static APP: OnceLock<Mutex<HashMap<String, App>>> = OnceLock::new();
//     let mut map = APP
//         .get_or_init(|| Mutex::new(HashMap::new()))
//         .lock()
//         .unwrap();

//     let app = map
//         .entry(id.to_string())
//         .or_insert_with(|| Mutex::new(App::new()))
//         .get_mut()
//         .unwrap();

//     f(app)
// }
