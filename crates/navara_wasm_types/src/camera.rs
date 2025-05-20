use navara_math::FloatType;
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

#[wasm_bindgen]
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum CameraStatus {
    Idle,
    MoveStart,
    Move,
    MoveEnd,
}

impl From<CameraStatus> for navara_camera::CameraStatus {
    fn from(st: CameraStatus) -> Self {
        match st {
            CameraStatus::Idle => navara_camera::CameraStatus::Idle,
            CameraStatus::MoveStart => navara_camera::CameraStatus::MoveStart,
            CameraStatus::Move => navara_camera::CameraStatus::Move,
            CameraStatus::MoveEnd => navara_camera::CameraStatus::MoveEnd,
        }
    }
}

impl From<navara_camera::CameraStatus> for CameraStatus {
    fn from(st: navara_camera::CameraStatus) -> Self {
        match st {
            navara_camera::CameraStatus::Idle => CameraStatus::Idle,
            navara_camera::CameraStatus::MoveStart => CameraStatus::MoveStart,
            navara_camera::CameraStatus::Move => CameraStatus::Move,
            navara_camera::CameraStatus::MoveEnd => CameraStatus::MoveEnd,
        }
    }
}

#[wasm_bindgen]
pub struct CameraOrientation {
    pub heading: FloatType,
    pub pitch: FloatType,
    pub roll: FloatType,
}
