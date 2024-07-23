use bevy_math::Vec3;
use bevy_transform::components::Transform;
use navara_core::{Angle, Ellipsoid, Meters, LLE};
use navara_layer::BillboardMaterial;

use crate::{map::feature::render::RenderableFeature, utils::coord::xyz_to_vec3};

pub fn construct_mesh(
    ellipsoid: Ellipsoid<f32>,
    point: &[f32; 3],
    material: &BillboardMaterial,
) -> Option<RenderableFeature> {
    let position = xyz_to_vec3(
        LLE {
            lng: Angle::new(point[0]),
            lat: Angle::new(point[1]),
            height: Meters::new(point[2] + material.height),
        }
        .rad()
        .to_xyz(ellipsoid),
    );

    Some(RenderableFeature::Billboard {
        material: material.clone(),
        transform: Transform::from_translation(position).with_scale(Vec3::new(
            material.size,
            material.size,
            material.size,
        )),
    })
}
