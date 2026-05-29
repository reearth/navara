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

/// An event for updating camera controller settings at runtime.
///
/// This event allows partial updates to the [`CameraController`](navara_camera::CameraController)
/// component. Only fields set to `Some` will be applied; `None` fields are ignored.
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Default)]
pub struct CameraControlUpdateEvent {
    /// Whether to automatically adjust near/far clipping planes based on camera distance
    /// from the Earth surface. When enabled, the camera uses three zones:
    /// - Near ground: near = 1.0, far = 1e6
    /// - Mid altitude: near = 100.0, far = 1e8
    /// - Far/Space: near = 1000.0, far = 1e9
    ///
    /// Default: `true`
    #[wasm_bindgen(js_name = autoAdjustNearFar)]
    pub auto_adjust_near_far: Option<bool>,
    /// The minimum distance (in meters) the camera can zoom in to the Earth surface.
    ///
    /// Default: `WGS84_B_64` (Earth's semi-minor axis, ~6,356,752 meters)
    #[wasm_bindgen(js_name = minimumZoomDistance)]
    pub minimum_zoom_distance: Option<FloatType>,
    /// The maximum distance (in meters) the camera can zoom out from the Earth surface.
    ///
    /// Default: `WGS84_B_64 * 10.0` (~63,567,523 meters)
    #[wasm_bindgen(js_name = maximumZoomDistance)]
    pub maximum_zoom_distance: Option<FloatType>,
    /// Multiplier for mouse drag rotation speed.
    ///
    /// Default: `2.0`
    #[wasm_bindgen(js_name = spinSpeed)]
    pub spin_speed: Option<FloatType>,
    /// Multiplier for scroll wheel zoom speed.
    ///
    /// Default: `0.6`
    #[wasm_bindgen(js_name = zoomSpeed)]
    pub zoom_speed: Option<FloatType>,
    /// Duration (in milliseconds) for spin inertia animation after releasing mouse drag.
    ///
    /// Default: `500.0`
    #[wasm_bindgen(js_name = spinDuration)]
    pub spin_duration: Option<f32>,
    /// Duration (in milliseconds) for zoom inertia animation after scroll wheel input.
    ///
    /// Default: `100.0`
    #[wasm_bindgen(js_name = zoomDuration)]
    pub zoom_duration: Option<f32>,
    /// Duration (in milliseconds) for translation inertia animation.
    ///
    /// Default: `500.0`
    #[wasm_bindgen(js_name = translateDuration)]
    pub translate_duration: Option<f32>,
    /// Whether mouse drag and touch swipe rotation (spin) are enabled.
    ///
    /// Default: `true`
    #[wasm_bindgen(js_name = enableSpin)]
    pub enable_spin: Option<bool>,
    /// Whether scroll wheel zoom is enabled.
    ///
    /// Default: `true`
    #[wasm_bindgen(js_name = enableZoom)]
    pub enable_zoom: Option<bool>,
    /// Whether tilt (right-click rotation) is enabled.
    ///
    /// Default: `true`
    #[wasm_bindgen(js_name = enableTilt)]
    pub enable_tilt: Option<bool>,
}

#[wasm_bindgen]
impl CameraControlUpdateEvent {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self::default()
    }
}

impl From<CameraControlUpdateEvent> for navara_camera::CameraControlUpdateEvent {
    fn from(e: CameraControlUpdateEvent) -> Self {
        Self {
            auto_adjust_near_far: e.auto_adjust_near_far,
            minimum_zoom_distance: e.minimum_zoom_distance,
            maximum_zoom_distance: e.maximum_zoom_distance,
            spin_speed: e.spin_speed,
            zoom_speed: e.zoom_speed,
            spin_duration: e.spin_duration,
            zoom_duration: e.zoom_duration,
            translate_duration: e.translate_duration,
            enable_spin: e.enable_spin,
            enable_zoom: e.enable_zoom,
            enable_tilt: e.enable_tilt,
        }
    }
}
