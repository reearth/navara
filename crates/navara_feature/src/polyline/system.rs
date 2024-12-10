use crate::{
    batch::{BatchId, BatchedFeature},
    id::FeatureId,
    render::{RenderInformation, RenderableFeature, TransferablePolylineGeometry},
};
use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_core::{CRS, WGS84_32};
use navara_geometry::{
    create_polyline_geometry, PolylineGeometryAttributes, PolylineGeometryOptions,
    TransferableFloatAttribute,
};
use navara_layer::{LayerId, LayerStore};
use navara_material::PolylineMaterial;
use navara_math::{FloatType, Transform, Vec3};

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
        batch_id: geo
            .attributes
            .batch_id
            .map(|batch_id| TransferableFloatAttribute {
                data: buf.new_f32(batch_id.data),
                size: batch_id.size,
            }),
        indices,
    }
}

#[allow(clippy::type_complexity)]
pub fn transfer_batched_mesh(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    polylines: Query<
        (&LayerId, &PolylineGeometry, &PolylineMaterial, &BatchId),
        Added<PolylineGeometry>,
    >,
    mut batched_features: Query<
        (&BatchedFeature, Option<&mut FeatureId>),
        (Added<BatchedFeature>, With<PolylineMarker>),
    >,
    mut layer_store: ResMut<LayerStore>,
) {
    for (batched_feature, feature_id) in &mut batched_features {
        let Ok((layer_id, _geometry, material, _batch_id)) =
            polylines.get(*batched_feature.features.first().unwrap())
        else {
            continue;
        };
        let mut combined_attributes = PolylineGeometryAttributes::with_batch_id();
        let mut indices = vec![];
        let mut index_offset = 0;

        for feature_id in &batched_feature.features {
            let Ok((_layer_id, geometry, _material, batch_id)) = polylines.get(*feature_id) else {
                continue;
            };

            let Some(mut constructed_geometry) = triangulate_one_polyline(material, geometry)
            else {
                continue;
            };

            let position_length = constructed_geometry.attributes.position.data.len()
                / constructed_geometry.attributes.position.size as usize;
            if position_length == 0 {
                continue;
            }

            combined_attributes
                .position
                .data
                .append(&mut constructed_geometry.attributes.position.data);
            combined_attributes
                .start
                .data
                .append(&mut constructed_geometry.attributes.start.data);
            combined_attributes
                .forward_offset
                .data
                .append(&mut constructed_geometry.attributes.forward_offset.data);
            combined_attributes
                .start_normals
                .data
                .append(&mut constructed_geometry.attributes.start_normals.data);
            combined_attributes
                .end_normal_and_texture_coordinate_normalization_x
                .data
                .append(
                    &mut constructed_geometry
                        .attributes
                        .end_normal_and_texture_coordinate_normalization_x
                        .data,
                );
            combined_attributes
                .right_normal_and_texture_coordinate_normalization_y
                .data
                .append(
                    &mut constructed_geometry
                        .attributes
                        .right_normal_and_texture_coordinate_normalization_y
                        .data,
                );
            combined_attributes
                .batch_id
                .as_mut()
                .unwrap()
                .data
                // TODO: Avoid cast
                .append(&mut vec![batch_id.0 as FloatType; position_length]);

            if index_offset == 0 {
                indices.append(&mut constructed_geometry.indices);
            } else {
                for i in constructed_geometry.indices {
                    indices.push(i + index_offset);
                }
            }

            index_offset += position_length as u32;
        }

        let entity = commands
            .spawn((
                PolylineMarker,
                RenderableFeature::Polyline {
                    // TODO: Calculate coordinate to update transform
                    coordinates: Vec3::new(0., 0., 0.),
                    crs: CRS::Geocentric,
                    material: material.clone(),
                    geometry: to_transferable_geometry(
                        &mut buf,
                        navara_geometry::PolylineGeometry {
                            attributes: combined_attributes,
                            indices,
                        },
                    ),
                    transform: Transform::default(),
                    feature_id: None,
                    render_info: RenderInformation {
                        current_terrain_height: 0.,
                    },
                },
            ))
            .id();

        if let Some(mut feature_id) = feature_id {
            feature_id.0 = Some(entity);
        }

        layer_store.add(layer_id.0.clone(), entity);
    }
}

#[allow(clippy::type_complexity)]
pub fn transfer_mesh(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut polylines: Query<
        (
            Entity,
            &LayerId,
            Option<&mut FeatureId>,
            &PolylineGeometry,
            &PolylineMaterial,
        ),
        (Added<PolylineGeometry>, Without<BatchId>),
    >,
    mut layer_store: ResMut<LayerStore>,
) {
    for (entity, layer_id, feature_id, geometry, material) in &mut polylines {
        if let Some(geometry) = triangulate_one_polyline(material, geometry) {
            let entity = commands
                .spawn((
                    PolylineMarker,
                    RenderableFeature::Polyline {
                        // TODO: Calculate coordinate to update transform
                        coordinates: Vec3::new(0., 0., 0.),
                        crs: CRS::Geocentric,
                        material: material.clone(),
                        geometry: to_transferable_geometry(&mut buf, geometry),
                        transform: Transform::default(),
                        feature_id: Some(entity),
                        render_info: RenderInformation {
                            current_terrain_height: 0.,
                        },
                    },
                ))
                .id();

            if let Some(mut feature_id) = feature_id {
                feature_id.0 = Some(entity);
            }

            layer_store.add(layer_id.0.clone(), entity);
        }
    }
}

fn triangulate_one_polyline(
    material: &PolylineMaterial,
    geometry: &PolylineGeometry,
) -> Option<navara_geometry::PolylineGeometry> {
    let mut positions = vec![];
    for c in &geometry.coords {
        positions.push(geometry.crs.to_lle(WGS84_32, *c, material.height));
    }

    create_polyline_geometry(
        WGS84_32,
        PolylineGeometryOptions {
            positions,
            clamp_to_ground: material.clamp_to_ground,
            granularity: 1000000000.,
            ..Default::default()
        },
    )
}
