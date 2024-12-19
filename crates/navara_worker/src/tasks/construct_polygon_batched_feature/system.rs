use crate::WorkerTaskMarker;
use bevy_ecs::{
    entity::Entity,
    query::{Added, With, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_component::Deleted;
use navara_core::{Extent, Radians};
use navara_feature_component::render::TransferablePolygonGeometry;
use navara_geometry::{FloatAttribute, Hierarchy, PolygonGeometryAttributes, PolygonResource};
use navara_material::PolygonMaterial;
use navara_math::FloatType;

use super::{ConstructPolygonBatchedFeatureParameters, ConstructPolygonBatchedFeatureResult};

#[allow(clippy::type_complexity)]
pub(crate) fn construct_polygon_batched_feature(
    mut commands: Commands,
    mut polygon_resource: ResMut<PolygonResource>,
    mut buf: ResMut<BufferStore>,
    mut polygon: Query<(
        &navara_feature_component::polygon::PolygonGeometry,
        &PolygonMaterial,
        &navara_feature_component::batch::BatchId,
    )>,
    constructors: Query<
        (Entity, &ConstructPolygonBatchedFeatureParameters),
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

        let mut combined_attributes = PolygonGeometryAttributes {
            position: FloatAttribute::new(vec![], 3),
            normal: Some(FloatAttribute::new(vec![], 3)),
            scale_normal_and_cap: Some(FloatAttribute::new(vec![], 4)),
            batch_id: Some(FloatAttribute::new(vec![], 1)),
        };
        let mut indices = vec![];
        let mut index_offset = 0;

        let mut combined_extent: Option<Extent<f32, Radians>> = None;
        for feature_id in &batched_feature.features {
            let (geometry, material, batch_id) = match polygon.get_mut(*feature_id) {
                Ok(f) => f,
                Err(_) => continue,
            };

            let geometry_hierarchy =
                Hierarchy::from_transferred(&geometry.hierarchy, &mut buf).unwrap();

            let (extent_opt, polygon_result_opt) =
                navara_feature_component::polygon::construct_polygon_feature(
                    geometry_hierarchy,
                    &geometry.crs,
                    material,
                    &mut polygon_resource,
                );

            let (extent, mut polygon_result) = match (extent_opt, polygon_result_opt) {
                (Some(extent), Some(polygon_result)) => (extent, polygon_result),
                _ => continue,
            };

            combined_extent = Some(match combined_extent {
                Some(e) => e.union(extent),
                None => extent,
            });

            let position_length = polygon_result.geometry.attributes.position.data.len()
                / polygon_result.geometry.attributes.position.size as usize;
            if position_length == 0 {
                continue;
            }

            combined_attributes
                .position
                .data
                .append(&mut polygon_result.geometry.attributes.position.data);
            combined_attributes
                .normal
                .as_mut()
                .unwrap()
                .data
                .append(&mut polygon_result.geometry.attributes.normal.unwrap().data);
            combined_attributes
                .scale_normal_and_cap
                .as_mut()
                .unwrap()
                .data
                .append(
                    &mut polygon_result
                        .geometry
                        .attributes
                        .scale_normal_and_cap
                        .unwrap()
                        .data,
                );

            combined_attributes
                .batch_id
                .as_mut()
                .unwrap()
                .data
                .extend(std::iter::repeat(batch_id.0 as FloatType).take(position_length));

            if index_offset == 0 {
                indices.append(&mut polygon_result.geometry.indices);
            } else {
                for i in polygon_result.geometry.indices {
                    indices.push(i + index_offset);
                }
            }

            index_offset += position_length as u32;
        }

        commands
            .entity(e)
            .insert(ConstructPolygonBatchedFeatureResult {
                extent: combined_extent.unwrap(),
                geometry: TransferablePolygonGeometry::with_buf(
                    &mut buf,
                    navara_geometry::PolygonGeometry {
                        attributes: combined_attributes,
                        indices,
                    },
                ),
            });
    }
}
