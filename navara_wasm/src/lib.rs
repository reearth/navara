#![doc = include_str!("../README.md")]
mod appearance;
mod event;
mod input;
mod types;
mod unit;
mod utils;

use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
};

use navara_ecs::App;
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
}

#[wasm_bindgen]
impl Core {
    #[wasm_bindgen(constructor)]
    pub fn new(id: String) -> Self {
        Self { id }
    }

    pub fn start(&self) {
        init(self.id.clone());
    }

    pub fn update(&self) {
        update(self.id.clone());
    }

    #[wasm_bindgen(js_name = readEvents)]
    pub fn read_events(&self) -> Option<Events> {
        read_events(self.id.clone())
    }

    pub fn input(&self, i: JsValue) {
        input(self.id.clone(), i);
    }

    #[wasm_bindgen(js_name = getBufferU8)]
    pub fn get_buffer_u8(&self, handle: i32) -> Option<js_sys::Uint8Array> {
        get_buffer_u8(self.id.clone(), handle)
    }

    #[wasm_bindgen(js_name = getBufferU32)]
    pub fn get_buffer_u32(&self, handle: i32) -> Option<js_sys::Uint32Array> {
        get_buffer_u32(self.id.clone(), handle)
    }

    #[wasm_bindgen(js_name = getBufferF32)]
    pub fn get_buffer_f32(&self, handle: i32) -> Option<js_sys::Float32Array> {
        get_buffer_f32(self.id.clone(), handle)
    }

    #[wasm_bindgen(js_name = setBufferU8)]
    pub fn set_buffer_u8(&self, handle: i32, bits: u64, data: &[u8]) {
        set_buffer_u8(self.id.clone(), handle, bits, data);
    }

    #[wasm_bindgen(js_name = triggerDataRequesterFailed)]
    pub fn trigger_data_requester_failed(&self, bits: u64) {
        trigger_data_requester_failed(self.id.clone(), bits);
    }

    pub fn resize(&self, width: f32, height: f32, pixel_ratio: f32) {
        resize(self.id.clone(), width, height, pixel_ratio);
    }

    #[wasm_bindgen(js_name = addLayer)]
    pub fn add_layer(&self, layer: JsValue) {
        add_layer(self.id.clone(), layer);
    }

    #[wasm_bindgen(js_name = triggerTextureFragmentLoaded)]
    pub fn trigger_texture_fragment_loaded(&self, bits: u64, status: TextureFragmentStatus) {
        trigger_texture_fragment_loaded(self.id.clone(), bits, status);
    }
}

#[wasm_bindgen(start)]
pub fn start() {
    utils::set_panic_hook();
    log("init navara_wasm");
}

pub fn init(id: String) {
    app(id, |a| {
        // debug
        a.trigger_event(navara_ecs::Input::Keyboard(navara_ecs::KeyboardInput {
            scan_code: 0,
            key_code: Some(navara_ecs::KeyCode::A),
            state: navara_ecs::ButtonState::Pressed,
        }));
    });
}

pub fn update(id: String) {
    app(id, |a| a.update());
}

pub fn read_events(id: String) -> Option<Events> {
    app(id, |a| a.read_events().map(|ev| ev.into()))
}

pub fn input(id: String, input: JsValue) {
    app(id, |a| {
        let Some(input) = Input::from(input) else {
            return;
        };

        let Some(input) = input.into_ecs_input() else {
            return;
        };

        a.trigger_event(input);
    });
}

pub fn get_buffer_u8(id: String, handle: i32) -> Option<js_sys::Uint8Array> {
    app(id, |a| {
        let buf = a.get_buffer_u8(handle)?;

        Some(js_sys::Uint8Array::from(buf))
        // unsafe { Some(js_sys::Uint8Array::view(buf)) } // zero copy
    })
}

pub fn get_buffer_u32(id: String, handle: i32) -> Option<js_sys::Uint32Array> {
    app(id, |a| {
        let buf = a.get_buffer_u32(handle)?;

        Some(js_sys::Uint32Array::from(buf))
        // unsafe { Some(js_sys::Uint32Array::view(buf)) } // zero copy
    })
}

pub fn get_buffer_f32(id: String, handle: i32) -> Option<js_sys::Float32Array> {
    app(id, |a| {
        let buf = a.get_buffer_f32(handle)?;

        Some(js_sys::Float32Array::from(buf))
        // unsafe { Some(js_sys::Float32Array::view(buf)) } // zero copy
    })
}

pub fn set_buffer_u8(id: String, handle: i32, bits: u64, buf: &[u8]) {
    app(id, |a| {
        a.set_buffer(handle, bits, buf.to_vec());
    });
}

pub fn trigger_data_requester_failed(id: String, bits: u64) {
    app(id, |a| {
        a.trigger_data_requester_failed(bits);
    });
}

pub fn resize(id: String, width: f32, height: f32, pixel_ratio: f32) {
    app(id, |a| {
        a.resize(width, height, pixel_ratio);
    });
}

pub fn trigger_texture_fragment_loaded(id: String, bits: u64, status: TextureFragmentStatus) {
    app(id, |a| {
        a.trigger_texture_fragment_loaded(bits, status.into());
    });
}

pub fn add_layer(id: String, layer: JsValue) {
    app(id, |a| {
        // TODO: Improve an undesirable cloning the layer.
        if let Some(ld) = LayerDescription::from(layer.clone()) {
            if let Some(l) = ld.to(layer) {
                a.add_layer(l);
            }
        }
    });
}

fn app<T>(id: String, f: impl FnOnce(&mut App) -> T) -> T {
    static APP: OnceLock<Mutex<HashMap<String, Mutex<App>>>> = OnceLock::new();
    let mut map = APP
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .unwrap();

    let app = map
        .entry(id.to_string())
        .or_insert_with(|| Mutex::new(App::new()))
        .get_mut()
        .unwrap();

    f(app)
}
