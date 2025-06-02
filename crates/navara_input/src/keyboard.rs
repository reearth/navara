use bevy_ecs::entity::Entity;

pub use bevy_input::ButtonState;

pub type KeyCode = bevy_input::keyboard::KeyCode;
pub type Key = bevy_input::keyboard::Key;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KeyboardInput {
    pub logical_key: Key,
    pub key_code: KeyCode,
    pub state: ButtonState,
}

impl KeyboardInput {
    pub fn into_event(self, win: Entity) -> bevy_input::keyboard::KeyboardInput {
        bevy_input::keyboard::KeyboardInput {
            logical_key: self.logical_key,
            key_code: self.key_code,
            state: self.state,
            window: win,
            repeat: false,
            text: None,
        }
    }
}
