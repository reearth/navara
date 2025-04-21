use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum CameraDirection {
    Forward,
    Backward,
    Left,
    Right,
    Up,
    Down,
}

impl From<CameraDirection> for navara_camera::CameraDirection {
    fn from(dir: CameraDirection) -> Self {
        match dir {
            CameraDirection::Forward => navara_camera::CameraDirection::Forward,
            CameraDirection::Backward => navara_camera::CameraDirection::Backward,
            CameraDirection::Left => navara_camera::CameraDirection::Left,
            CameraDirection::Right => navara_camera::CameraDirection::Right,
            CameraDirection::Up => navara_camera::CameraDirection::Up,
            CameraDirection::Down => navara_camera::CameraDirection::Down,
        }
    }
}
