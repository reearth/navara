use navara_math::{FloatType, Quat, Vec3};
use serde::Serialize;
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

// TODO: Use TypedArray to avoid unnecessary clone.
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize)]
pub struct Transform {
    pub tx: FloatType,
    pub ty: FloatType,
    pub tz: FloatType,
    pub qx: FloatType,
    pub qy: FloatType,
    pub qz: FloatType,
    pub qw: FloatType,
    pub sx: FloatType,
    pub sy: FloatType,
    pub sz: FloatType,
}

#[wasm_bindgen]
impl Transform {
    #[wasm_bindgen(constructor)]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        tx: FloatType,
        ty: FloatType,
        tz: FloatType,
        qx: FloatType,
        qy: FloatType,
        qz: FloatType,
        qw: FloatType,
        sx: FloatType,
        sy: FloatType,
        sz: FloatType,
    ) -> Self {
        Self {
            tx,
            ty,
            tz,
            qx,
            qy,
            qz,
            qw,
            sx,
            sy,
            sz,
        }
    }
}

impl<'a> From<&'a navara_math::Transform> for Transform {
    fn from(t: &'a navara_math::Transform) -> Self {
        Self {
            tx: t.translation.x,
            ty: t.translation.y,
            tz: t.translation.z,
            qx: t.rotation.x,
            qy: t.rotation.y,
            qz: t.rotation.z,
            qw: t.rotation.w,
            sx: t.scale.x,
            sy: t.scale.y,
            sz: t.scale.z,
        }
    }
}

impl<'a> From<&'a Transform> for navara_math::Transform {
    fn from(t: &'a Transform) -> Self {
        navara_math::Transform {
            translation: Vec3::new(t.tx, t.ty, t.tz),
            rotation: Quat::from_xyzw(t.qx, t.qy, t.qz, t.qw),
            scale: Vec3::new(t.sx, t.sy, t.sz),
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize)]
pub struct CameraFrustum {
    pub near: FloatType,
    pub far: FloatType,
    pub fov: FloatType,
    pub aspect_ratio: FloatType,
}

#[wasm_bindgen]
impl CameraFrustum {
    #[wasm_bindgen(constructor)]
    pub fn new(near: FloatType, far: FloatType, fov: FloatType, aspect_ratio: FloatType) -> Self {
        Self {
            near,
            far,
            fov,
            aspect_ratio,
        }
    }
}

impl<'a> From<&'a navara_camera::CameraFrustum> for CameraFrustum {
    fn from(t: &'a navara_camera::CameraFrustum) -> Self {
        Self {
            near: t.near,
            far: t.far,
            fov: t.fov,
            aspect_ratio: t.aspect_ratio,
        }
    }
}
