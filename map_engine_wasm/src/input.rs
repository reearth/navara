use serde::Deserialize;
use wasm_bindgen::prelude::*;

#[derive(Clone, Debug, PartialEq, Deserialize)]
pub struct Input {
    pub r#type: InputType,
    pub x: Option<f32>,
    pub y: Option<f32>,
    pub z: Option<f32>,
    pub button: Option<u32>,
    pub key_code: Option<String>,
    pub key: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
pub enum InputType {
    #[serde(rename = "keydown")]
    KeyDown,
    #[serde(rename = "keyup")]
    KeyUp,
    #[serde(rename = "mousedown")]
    MouseDown,
    #[serde(rename = "mouseup")]
    MouseUp,
    #[serde(rename = "mousemove")]
    MouseMove,
    #[serde(rename = "wheel")]
    Wheel,
}

impl Input {
    pub fn from(value: JsValue) -> Option<Self> {
        serde_wasm_bindgen::from_value(value).ok()
    }

    pub fn into_ecs_input(self) -> Option<map_engine_ecs::Input> {
        match self.r#type {
            // TODO
            // InputType::KeyDown => Some(map_engine_ecs::Input::Keyboard(
            //     map_engine_ecs::KeyboardInput {},
            // )),
            // InputType::KeyUp => Some(map_engine_ecs::Input::Keyboard(
            //     map_engine_ecs::KeyboardInput {},
            // )),
            InputType::MouseDown => Some(map_engine_ecs::Input::MouseButton(
                map_engine_ecs::MouseButtonInput {
                    button: map_engine_ecs::MouseButton::Left, // TODO
                    state: map_engine_ecs::ButtonState::Pressed,
                },
            )),
            InputType::MouseUp => Some(map_engine_ecs::Input::MouseButton(
                map_engine_ecs::MouseButtonInput {
                    button: map_engine_ecs::MouseButton::Left, // TODO
                    state: map_engine_ecs::ButtonState::Released,
                },
            )),
            InputType::MouseMove => Some(map_engine_ecs::Input::MouseMove(
                map_engine_ecs::MouseMoveInput {
                    x: self.x.unwrap_or(0.0),
                    y: self.y.unwrap_or(0.0),
                },
            )),
            InputType::Wheel => Some(map_engine_ecs::Input::MouseScroll(
                map_engine_ecs::MouseScrollInput {
                    unit: map_engine_ecs::MouseScrollUnit::Line,
                    x: self.x.unwrap_or(0.0),
                    y: self.y.unwrap_or(0.0),
                },
            )),
            _ => None,
        }
    }
}
