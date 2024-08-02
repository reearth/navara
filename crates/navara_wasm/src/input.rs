use navara_input::{ButtonState, Key, KeyCode};
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

    pub fn into_ecs_input(self) -> Option<navara_input::Input> {
        match self.r#type {
            InputType::MouseDown => self.get_button().map(|button| {
                navara_input::Input::MouseButton(navara_input::MouseButtonInput {
                    button,
                    state: navara_input::ButtonState::Pressed,
                })
            }),
            InputType::MouseUp => self.get_button().map(|button| {
                navara_input::Input::MouseButton(navara_input::MouseButtonInput {
                    button,
                    state: navara_input::ButtonState::Released,
                })
            }),
            InputType::MouseMove => Some(navara_input::Input::MouseMove(
                navara_input::MouseMoveInput {
                    x: self.x.unwrap_or(0.0),
                    y: self.y.unwrap_or(0.0),
                },
            )),
            InputType::Wheel => Some(navara_input::Input::MouseScroll(
                navara_input::MouseScrollInput {
                    unit: navara_input::MouseScrollUnit::Line,
                    x: self.x.unwrap_or(0.0),
                    y: self.y.unwrap_or(0.0),
                },
            )),
            InputType::KeyDown => self.key_code.and_then(|k| {
                let key = match &*k {
                    "ControlLeft" => Some((Key::Control, KeyCode::ControlLeft)),
                    "ControlRight" => Some((Key::Control, KeyCode::ControlRight)),
                    _ => None,
                };
                key.map(|(logical_key, key_code)| {
                    navara_input::Input::Keyboard(navara_input::KeyboardInput {
                        logical_key, // ignore it because keyCode in JS is deprecated
                        key_code,
                        state: ButtonState::Pressed,
                    })
                })
            }),
            InputType::KeyUp => self.key_code.and_then(|k| {
                let key = match &*k {
                    "ControlLeft" => Some((Key::Control, KeyCode::ControlLeft)),
                    "ControlRight" => Some((Key::Control, KeyCode::ControlRight)),
                    _ => None,
                };
                key.map(|(logical_key, key_code)| {
                    navara_input::Input::Keyboard(navara_input::KeyboardInput {
                        logical_key, // ignore it because keyCode in JS is deprecated
                        key_code,
                        state: ButtonState::Released,
                    })
                })
            }),
        }
    }

    fn get_button(self) -> Option<navara_input::MouseButton> {
        match self.button {
            Some(0) => Some(navara_input::MouseButton::Left),
            Some(1) => Some(navara_input::MouseButton::Middle),
            Some(2) => Some(navara_input::MouseButton::Right),
            _ => None,
        }
    }
}
