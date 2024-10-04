use bevy_ecs::{
    entity::Entity,
    query::Added,
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_core::{Angle, Meters, CRS, LLE, WGS84_32};
use navara_geometry::{
    create_polyline_geometry, PolylineGeometryOptions, TransferableFloatAttribute,
};
use navara_material::PolylineMaterial;
use navara_math::{Transform, Vec3};
use navara_layer::{LayerStore, LayerId};
use crate::render::{RenderInformation, RenderableFeature, TransferablePolylineGeometry};

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
    polylines: Query<(Entity, &LayerId, &PolylineGeometry, &PolylineMaterial), Added<PolylineGeometry>>,
    mut layer_store: ResMut<LayerStore>
) {
    for (entity, layer_id, geometry, material) in &polylines {
        let positions = match geometry.crs {
            CRS::Geographic => {
                let mut positions = vec![];
                for c in &geometry.coords {
                    let lng = c.x;
                    let lat = c.y;
                    let height = c.z;

                    positions.push(
                        LLE {
                            lng: Angle::new(lng),
                            lat: Angle::new(lat),
                            height: Meters::new(height + material.height),
                        }
                        .rad(),
                    );
                }
                positions
            }
            CRS::Geocentric => unimplemented!(),
            CRS::ESPG { code: _ } => unimplemented!(),
        };

        if let Some(geometry) = create_polyline_geometry(
            WGS84_32,
            PolylineGeometryOptions {
                positions,
                clamp_to_ground: material.clamp_to_ground,
                ..Default::default()
            },
        ) {
            // TODO: Don't forget removing the stored data from BufferStore when the feature is removed.
            let entity = commands.spawn((
                PolylineMarker,
                RenderableFeature::Polyline {
                    coordinates: Vec3::new(0.,0.,0.),
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

            layer_store.map.entry(layer_id.clone())
                       .or_insert_with(Vec::new)
                       .push(entity.id());
        }
    }
}
