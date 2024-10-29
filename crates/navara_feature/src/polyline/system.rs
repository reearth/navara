use crate::render::{RenderInformation, RenderableFeature, TransferablePolylineGeometry};
use bevy_ecs::{
    entity::Entity,
    query::Added,
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_core::{CRS, WGS84_32};
use navara_geometry::{
    create_polyline_geometry, PolylineGeometryOptions, TransferableFloatAttribute,
};
use navara_layer::{LayerId, LayerStore};
use navara_material::PolylineMaterial;
use navara_math::{Transform, Vec3};

use super::{PolylineGeometry, PolylineMarker};

fn to_transferable_geometry(
    buf: &mut ResMut<BufferStore>,
    geo: navara_geometry::PolylineGeometry,
) -> TransferablePolylineGeometry {
    let position = buf.new_f32(geo.attributes.position.data);
    let start = buf.new_f32(geo.attributes.start.data);
    let forward_offset = buf.new_f32(geo.attributes.forward_offset.data);
    let start_normals = buf.new_f32(geo.attributes.start_normals.data);
    let end_normal_and_texture_coordinate_normalization_x = buf.new_f32(
        geo.attributes
            .end_normal_and_texture_coordinate_normalization_x
            .data,
    );
    let right_normal_and_texture_coordinate_normalization_y = buf.new_f32(
        geo.attributes
            .right_normal_and_texture_coordinate_normalization_y
            .data,
    );
    let indices = buf.new_u32(geo.indices);

    TransferablePolylineGeometry {
        position: TransferableFloatAttribute {
            data: position,
            size: geo.attributes.position.size,
        },
        start: TransferableFloatAttribute {
            data: start,
            size: geo.attributes.start.size,
        },
        forward_offset: TransferableFloatAttribute {
            data: forward_offset,
            size: geo.attributes.forward_offset.size,
        },
        start_normals: TransferableFloatAttribute {
            data: start_normals,
            size: geo.attributes.start_normals.size,
        },
        end_normal_and_texture_coordinate_normalization_x: TransferableFloatAttribute {
            data: end_normal_and_texture_coordinate_normalization_x,
            size: geo
                .attributes
                .end_normal_and_texture_coordinate_normalization_x
                .size,
        },
        right_normal_and_texture_coordinate_normalization_y: TransferableFloatAttribute {
            data: right_normal_and_texture_coordinate_normalization_y,
            size: geo
                .attributes
                .right_normal_and_texture_coordinate_normalization_y
                .size,
        },
        indices,
    }
}

pub fn transfer_mesh(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    polylines: Query<
        (Entity, &LayerId, &PolylineGeometry, &PolylineMaterial),
        Added<PolylineGeometry>,
    >,
    mut layer_store: ResMut<LayerStore>,
) {
    for (entity, layer_id, geometry, material) in &polylines {
        let mut positions = vec![];
        for c in &geometry.coords {
            positions.push(geometry.crs.to_lle(WGS84_32, *c, material.height));
        }

        if let Some(geometry) = create_polyline_geometry(
            WGS84_32,
            PolylineGeometryOptions {
                positions,
                clamp_to_ground: material.clamp_to_ground,
                ..Default::default()
            },
        ) {
            let entity = commands.spawn((
                PolylineMarker,
                RenderableFeature::Polyline {
                    // TODO: Calculate coordinate to update transform
                    coordinates: Vec3::new(0., 0., 0.),
                    crs: CRS::Geocentric,
                    material: material.clone(),
                    geometry: to_transferable_geometry(&mut buf, geometry),
                    transform: Transform::default(),
                    feature_id: entity,
                    render_info: RenderInformation {
                        current_terrain_height: 0.,
                    },
                },
            ));

            layer_store.add(layer_id.0.clone(), entity.id());
        }
    }
}
