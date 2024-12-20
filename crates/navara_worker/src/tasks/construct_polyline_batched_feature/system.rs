use crate::WorkerTaskMarker;
use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_core::{Extent, Radians};
use navara_feature_component::{
    polyline::construct_polyline_feature, render::TransferablePolylineGeometry,
};
use navara_geometry::PolylineGeometryAttributes;
use navara_material::PolylineMaterial;
use navara_math::FloatType;

use super::{ConstructPolylineBatchedFeatureParameters, ConstructPolylineBatchedFeatureResult};

#[allow(clippy::type_complexity)]
pub(crate) fn construct_polyline_batched_feature(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    polylines: Query<(
        &navara_feature_component::polyline::PolylineGeometry,
        &PolylineMaterial,
        &navara_feature_component::batch::BatchId,
    )>,
    constructors: Query<
        (Entity, &ConstructPolylineBatchedFeatureParameters),
        (
            Added<WorkerTaskMarker>,
            With<WorkerTaskMarker>,
            Without<Deleted>,
        ),
    >,
    features: Query<&navara_feature_component::batch::BatchedFeature>,
) {
    for (e, constructor) in &constructors {
        let batched_feature = features.get(constructor.batched_feature).unwrap();

        let Ok((_geometry, material, _batch_id)) =
            polylines.get(*batched_feature.features.first().unwrap())
        else {
            continue;
        };
        let mut combined_attributes = PolylineGeometryAttributes::with_batch_id();
        let mut indices = vec![];
        let mut index_offset = 0;

        let mut combined_extent: Option<Extent<f32, Radians>> = None;
        for feature_id in &batched_feature.features {
            let Ok((geometry, _material, batch_id)) = polylines.get(*feature_id) else {
                continue;
            };

            let Some((extent, mut constructed_geometry)) = construct_polyline_feature(
                material,
                buf.remove_f32(&geometry.coords).unwrap(),
                &geometry.crs,
            ) else {
                continue;
            };

            let position_length = constructed_geometry.attributes.position.data.len()
                / constructed_geometry.attributes.position.size as usize;
            if position_length == 0 {
                continue;
            }

            combined_extent = Some(match combined_extent {
                Some(e) => e.union(extent),
                None => extent,
            });

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

        commands
            .entity(e)
            .insert(ConstructPolylineBatchedFeatureResult {
                extent: combined_extent.unwrap(),
                geometry: TransferablePolylineGeometry::with_buf(
                    &mut buf,
                    navara_geometry::PolylineGeometry {
                        attributes: combined_attributes,
                        indices,
                    },
                ),
            });
    }
}
