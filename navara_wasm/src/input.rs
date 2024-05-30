use navara_ecs::{ButtonState, KeyCode};
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

    pub fn into_ecs_input(self) -> Option<navara_ecs::Input> {
        match self.r#type {
            InputType::MouseDown => self.get_button().map(|button| {
                navara_ecs::Input::MouseButton(navara_ecs::MouseButtonInput {
                    button,
                    state: navara_ecs::ButtonState::Pressed,
                })
            }),
            InputType::MouseUp => self.get_button().map(|button| {
                navara_ecs::Input::MouseButton(navara_ecs::MouseButtonInput {
                    button,
                    state: navara_ecs::ButtonState::Released,
                })
            }),
            InputType::MouseMove => Some(navara_ecs::Input::MouseMove(
                navara_ecs::MouseMoveInput {
                    x: self.x.unwrap_or(0.0),
                    y: self.y.unwrap_or(0.0),
                },
            )),
            InputType::Wheel => Some(navara_ecs::Input::MouseScroll(
                navara_ecs::MouseScrollInput {
                    unit: navara_ecs::MouseScrollUnit::Line,
                    x: self.x.unwrap_or(0.0),
                    y: self.y.unwrap_or(0.0),
                },
            )),
            InputType::KeyDown => self.key_code.map(|k| {
                navara_ecs::Input::Keyboard(navara_ecs::KeyboardInput {
                    scan_code: 0, // ignore it because keyCode in JS is deprecated
                    key_code: match &*k {
                        "ControlLeft" => Some(KeyCode::ControlLeft),
                        "ControlRight" => Some(KeyCode::ControlRight),
                        _ => None,
                    },
                    state: ButtonState::Pressed,
                })
            }),
            InputType::KeyUp => self.key_code.map(|k| {
                navara_ecs::Input::Keyboard(navara_ecs::KeyboardInput {
                    scan_code: 0, // ignore it because keyCode in JS is deprecated
                    key_code: match &*k {
                        "ControlLeft" => Some(KeyCode::ControlLeft),
                        "ControlRight" => Some(KeyCode::ControlRight),
                        _ => None,
                    },
                    state: ButtonState::Released,
                })
            }),
        }
    }

    fn get_button(self) -> Option<navara_ecs::MouseButton> {
        match self.button {
            Some(0) => Some(navara_ecs::MouseButton::Left),
            Some(1) => Some(navara_ecs::MouseButton::Middle),
            Some(2) => Some(navara_ecs::MouseButton::Right),
            _ => None,
        }
    }
}
