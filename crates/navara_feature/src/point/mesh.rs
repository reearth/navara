use bevy_ecs::system::Query;
use navara_buffer_store::BufferStore;
use navara_core::{Angle, Ellipsoid, LngLat, Meters, LLE};
use navara_data_requester::DataRequester;
use navara_layer::PointMaterial;
use navara_math::{xyz_to_vec3, Transform, Vec3};
use navara_tile::{
    data_requester::TerrainDataRequesterMarker,
    tile::{compute_terrain_height_at_point, TileQuadtree},
};

use crate::render::{RenderInformation, RenderableFeature};

pub fn construct_mesh(
    ellipsoid: Ellipsoid<f32>,
    point: &[f32; 3],
    material: &PointMaterial,
) -> Option<RenderableFeature> {
    let lng = point[0];
    let lat = point[1];
    let height = point[2];

    let position = xyz_to_vec3(
        LLE {
            lng: Angle::new(lng),
            lat: Angle::new(lat),
            height: Meters::new(height + material.height),
        }
        .rad()
        .to_xyz(ellipsoid),
    );

    Some(RenderableFeature::Point {
        material: material.clone(),
        transform: Transform::from_translation(position).with_scale(Vec3::new(
            material.size,
            material.size,
            material.size,
        )),
        coordinates: Vec3::new(lng, lat, height),
        render_info: RenderInformation {
            current_terrain_height: 0.,
        },
    })
}

#[allow(clippy::too_many_arguments)]
pub fn update_height_by_terrain(
    qt: &mut TileQuadtree,
    buf: &mut BufferStore,
    ellipsoid: Ellipsoid<f32>,
    material: &mut PointMaterial,
    transform: &mut Transform,
    point: &Vec3,
    render_info: &mut RenderInformation,
    terrain_data_requester: &Query<(&TerrainDataRequesterMarker, &DataRequester)>,
) {
    let terrain_height = if material.clamp_to_ground {
        compute_terrain_height_at_point(
            qt,
            buf,
            terrain_data_requester,
            &LngLat {
                lng: Angle::new(point.x).rad(),
                lat: Angle::new(point.y).rad(),
            },
        )
        .unwrap_or(0.)
    } else {
        0.
    };
    render_info.current_terrain_height = render_info.current_terrain_height.max(terrain_height);
    let position = xyz_to_vec3(
        LLE {
            lng: Angle::new(point.x),
            lat: Angle::new(point.y),
            height: Meters::new(point.z + material.height + render_info.current_terrain_height),
        }
        .rad()
        .to_xyz(ellipsoid),
    );

    transform.translation = position;
}
