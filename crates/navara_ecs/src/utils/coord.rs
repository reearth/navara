use bevy_math::Vec3;
use navara_core::{Meters, XYZ};

pub(crate) fn xyz_to_vec3(xyz: XYZ<f32>) -> Vec3 {
    Vec3::new(xyz.x.val(), xyz.y.val(), xyz.z.val())
}

pub(crate) fn vec3_to_xyz(vec: Vec3) -> XYZ<f32> {
    XYZ {
        x: Meters::new(vec.x),
        y: Meters::new(vec.y),
        z: Meters::new(vec.z),
    }
}
