use bevy_ecs::entity::Entity;

pub use bevy_input::ButtonState;

pub type KeyCode = bevy_input::keyboard::KeyCode;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct KeyboardInput {
    pub scan_code: u32,
    pub key_code: Option<KeyCode>,
    pub state: ButtonState,
}

impl KeyboardInput {
    pub fn into_event(self, win: Entity) -> bevy_input::keyboard::KeyboardInput {
        bevy_input::keyboard::KeyboardInput {
            scan_code: self.scan_code,
            key_code: self.key_code,
            state: self.state,
            window: win,
        }
    }
}
