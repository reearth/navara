mod event;
mod input;
mod utils;

use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
};

use map_engine_ecs::App;
use wasm_bindgen::prelude::*;

pub use event::*;
pub use input::*;

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

    #[wasm_bindgen]
    pub fn input(&self, i: JsValue) {
        input(self.id.clone(), i);
    }
}

#[wasm_bindgen(start)]
pub fn start() {
    utils::set_panic_hook();
    log("init map_engine_wasm");
}

pub fn init(id: String) {
    app(id, |a| {
        // debug
        a.trigger_event(map_engine_ecs::Input::Keyboard(
            map_engine_ecs::KeyboardInput {
                scan_code: 0,
                key_code: Some(map_engine_ecs::KeyCode::A),
                state: map_engine_ecs::ButtonState::Pressed,
            },
        ));
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
