use bevy_math::Vec3;
use bevy_transform::components::Transform;
use navara_core::{Angle, Degrees, Ellipsoid, Meters, LLE};
use navara_layer::{BillboardGeometry, BillboardMaterial};
use navara_parser::geojson::{Feature, Value};

use crate::map::feature::render::RenderableFeature;

pub fn construct_mesh(
    ellipsoid: Ellipsoid<f32>,
    feature: &Feature,
    material: &BillboardMaterial,
) -> Option<RenderableFeature> {
    let point = match feature.geometry.as_ref().map_or(None, |g| Some(&g.value)) {
        Some(Value::Point(v)) => v,
        Some(Value::MultiPoint(_v)) => unimplemented!(), // TODO: Support MultiPoint
        _ => return None,
    };

    let lle: LLE<f32, Degrees> = LLE {
        lng: Angle::new(point[0] as f32),
        lat: Angle::new(point[1] as f32),
        height: Meters::new(*point.get(2).unwrap_or(&0.) as f32),
    };
    let position = ellipsoid.lle_to_xyz(lle.rad());
    let position = Vec3::new(position.x.val(), position.y.val(), position.z.val());

    Some(RenderableFeature::Billboard {
        geometry: BillboardGeometry { position },
        material: material.clone(),
        transform: Transform::from_translation(position).with_scale(Vec3::new(
            material.size,
            material.size,
            material.size,
        )),
    })
}
