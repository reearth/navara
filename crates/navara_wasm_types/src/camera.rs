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
pub enum CameraStatusType {
    Change,
    LookAt,
    Rotate,

    MoveStart,
    Moving,
    MoveEnd,
}

impl From<navara_camera::CameraStatusType> for CameraStatusType {
    fn from(st: navara_camera::CameraStatusType) -> Self {
        match st {
            navara_camera::CameraStatusType::Change => CameraStatusType::Change,
            navara_camera::CameraStatusType::LookAt => CameraStatusType::LookAt,
            navara_camera::CameraStatusType::Rotate => CameraStatusType::Rotate,
            navara_camera::CameraStatusType::MoveStart => CameraStatusType::MoveStart,
            navara_camera::CameraStatusType::Moving => CameraStatusType::Moving,
            navara_camera::CameraStatusType::MoveEnd => CameraStatusType::MoveEnd,
        }
    }
}

#[wasm_bindgen]
pub struct CameraStatus {
    #[wasm_bindgen(getter_with_clone)]
    pub status: Vec<CameraStatusType>,
}

#[wasm_bindgen]
pub struct CameraOrientation {
    pub heading: FloatType,
    pub pitch: FloatType,
    pub roll: FloatType,
}
