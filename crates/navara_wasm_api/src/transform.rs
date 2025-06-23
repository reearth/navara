use wasm_bindgen::prelude::*;

use navara_camera::{get_pick_ray_from_camera, ray_ellipsoid_intersect};
use navara_core::{ray_plane, xyz_to_vec3, CRS, WGS84_32};
use navara_math::{FloatType, Vec3};
use navara_wasm_types::{
    CameraFrustum, Plane, Ray, Transform, Vec2 as Vec2Wasm, Vec3 as Vec3Wasm, Window, LLE,
};

#[wasm_bindgen(js_name = geodeticToXyz)]
pub fn geodetic_to_ecef(lle: LLE) -> Vec3Wasm {
    let lle_pt = Vec3::new(lle.lng.to_degrees(), lle.lat.to_degrees(), lle.height);

    let ecef_pt = CRS::Geographic.to_vec3(WGS84_32, lle_pt, 0.0);

    Vec3Wasm {
        x: ecef_pt.x,
        y: ecef_pt.y,
        z: ecef_pt.z,
    }
}

#[wasm_bindgen(js_name = xyzToGeodetic)]
pub fn ecef_to_geodetic(vec3: Vec3Wasm) -> LLE {
    let lle = CRS::Geocentric.to_lle(WGS84_32, vec3.into(), 0.0);
    lle.into()
}

#[wasm_bindgen(js_name = angleToRadian)]
pub fn angle_to_radian(degree: FloatType) -> FloatType {
    degree.to_radians()
}

#[wasm_bindgen(js_name = angleToDegree)]
pub fn angle_to_degree(radian: FloatType) -> FloatType {
    radian.to_degrees()
}

#[wasm_bindgen(js_name = screenToWorld)]
pub fn screen_to_world(
    window: Window,
    transform: Transform,
    frustum: CameraFrustum,
    screen_pos: Vec2Wasm,
) -> Option<Vec3Wasm> {
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

    let Some(point) = ray_ellipsoid_intersect(&ray, WGS84_32) else {
        // If no intersection, return the origin point
        return None;
    };

    Some(ray.get_point(point).into())
}

#[wasm_bindgen(js_name = geodeticSurfaceNormal)]
pub fn geodetic_surface_normal(lle: LLE) -> Vec3Wasm {
    let normal = WGS84_32.geodetic_surface_normal_from_lle((&lle).into());
    let normal_vec3 = xyz_to_vec3(normal).normalize();
    normal_vec3.into()
}

#[wasm_bindgen(js_name = eastNorthUpToFixedFrame)]
pub fn east_north_up_to_fixed_frame(origin: Vec3Wasm) -> Vec<f32> {
    let mat4 = navara_core::east_north_up_to_fixed_frame(origin.into(), WGS84_32);
    mat4.to_cols_array().to_vec()
}

#[wasm_bindgen(js_name = northEastDownToFixedFrame)]
pub fn north_east_down_to_fixed_frame(origin: Vec3Wasm) -> Vec<f32> {
    let mat4 = navara_core::north_east_down_to_fixed_frame(origin.into(), WGS84_32);
    mat4.to_cols_array().to_vec()
}

#[wasm_bindgen(js_name = northUpEastToFixedFrame)]
pub fn north_up_east_to_fixed_frame(origin: Vec3Wasm) -> Vec<f32> {
    let mat4 = navara_core::north_up_east_to_fixed_frame(origin.into(), WGS84_32);
    mat4.to_cols_array().to_vec()
}

#[wasm_bindgen(js_name = northWestUpToFixedFrame)]
pub fn north_west_up_to_fixed_frame(origin: Vec3Wasm) -> Vec<f32> {
    let mat4 = navara_core::north_west_up_to_fixed_frame(origin.into(), WGS84_32);
    mat4.to_cols_array().to_vec()
}

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
    transform: Transform,
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
    let lle = xyz.to_lle(WGS84_32);
    lle.height.val()
}
