use wasm_bindgen::prelude::*;

use navara_camera::get_pick_ray_from_camera;
use navara_core::{ray_plane, WGS84_64};
use navara_math::{FloatType, Vec3};
use navara_wasm_types::{
    CameraFrustum, Plane, Ray, Transform as TransformWasm, Vec2 as Vec2Wasm, Vec3 as Vec3Wasm,
    Window,
};

#[wasm_bindgen(js_name = getPlaneFromPointNormal)]
pub fn get_plane_from_point_normal(point: Vec3Wasm, normal: Vec3Wasm) -> Plane {
    let point_vec3: Vec3 = point.into();
    let normal_vec3: Vec3 = normal.into();

    let core_plane = navara_core::Plane::from_point_normal(point_vec3, normal_vec3);
    core_plane.into()
}

#[wasm_bindgen(js_name = getPickRay)]
pub fn get_pick_ray(
    window: Window,
    transform: TransformWasm,
    frustum: CameraFrustum,
    screen_pos: Vec2Wasm,
) -> Ray {
    let window: navara_window::Window = (&window).into();
    let transform: navara_math::Transform = (&transform).into();
    let frustum: navara_camera::CameraFrustum = navara_camera::CameraFrustum::new(
        &transform,
        frustum.near,
        frustum.far,
        frustum.fov,
        frustum.aspect_ratio,
        0.0,
    );

    let ray = get_pick_ray_from_camera(&window, &transform, &frustum, screen_pos.into());
    ray.into()
}

#[wasm_bindgen(js_name = getRayPlaneIntersection)]
pub fn get_ray_plane_intersection(ray: Ray, plane: Plane) -> Option<Vec3Wasm> {
    let core_ray: navara_core::Ray = (&ray).into();
    let core_plane: navara_core::Plane = (&plane).into();

    ray_plane(&core_ray, core_plane).map(|point| point.into())
}

#[wasm_bindgen(js_name = getHeightFromEllipsoid)]
pub fn get_height_from_ellipsoid(point: Vec3Wasm) -> FloatType {
    let xyz = navara_core::vec3_to_xyz(point.into());
    let lle = xyz.to_lle(WGS84_64);
    lle.height.val()
}
