use navara_core::{Extent, Radians};
use navara_geometry::{
    FloatAttribute, Hierarchy, PolygonGeometryAttributes, PolygonResource, UintAttribute,
};
use navara_math::FloatType;
use navara_wasm_types::{
    polygon::{ConstructedPolygonGeometry, PolygonGeometry, TransferablePolygonBatchedFeature},
    PolygonMaterial,
};
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen(js_name = constructPolygonBatchedFeature)]
pub fn construct_polygon_batched_feature(
    features: TransferablePolygonBatchedFeature,
    material: PolygonMaterial,
    flat: bool,
) -> Option<ConstructedPolygonGeometry> {
    if flat {
        construct_flat_polygon(features, material)
    } else {
        construct_polygon(features, material)
    }
}

pub fn construct_polygon(
    mut features: TransferablePolygonBatchedFeature,
    material: PolygonMaterial,
) -> Option<ConstructedPolygonGeometry> {
    let mut polygon_resource = PolygonResource::new();
    let material: navara_material::PolygonMaterial = material.into();
    let crs: navara_core::CRS = (&features.crs).into();

    let mut combined_attributes = PolygonGeometryAttributes {
        position: Some(FloatAttribute::new(vec![], 3)),
        position_3d_high: None,
        position_3d_low: None,
        normal: None,
        scale_normal_and_cap: Some(FloatAttribute::new(vec![], 4)),
        batch_ids: Some(FloatAttribute::new(vec![], 1)),
        batch_index: Some(UintAttribute::new(vec![], 1)),
    };
    let mut indices = vec![];
    let mut index_offset = 0;

    let mut combined_extent: Option<Extent<f32, Radians>> = None;
    for idx in 0..features.length {
        let (transferable_hierarchy, batch_idx, batch_id) =
            features.to_transferable_hierarchy_by_index(idx);
        let geometry_hierarchy: Hierarchy = transferable_hierarchy.into();

        let (extent_opt, polygon_result_opt) =
            navara_feature_component::polygon::construct_polygon_feature(
                geometry_hierarchy,
                &crs,
                &material,
                &mut polygon_resource,
                false, // use_rte = false for batched MVT features
            );

        let (extent, mut polygon_result) = match (extent_opt, polygon_result_opt) {
            (Some(extent), Some(polygon_result)) => (extent, polygon_result),
            _ => continue,
        };

        combined_extent = Some(match combined_extent {
            Some(e) => e.union(extent),
            None => extent,
        });

        let position_length = polygon_result
            .geometry
            .attributes
            .position
            .as_ref()
            .unwrap()
            .data
            .len()
            / polygon_result
                .geometry
                .attributes
                .position
                .as_ref()
                .unwrap()
                .size as usize;
        if position_length == 0 {
            continue;
        }

        combined_attributes
            .position
            .as_mut()
            .unwrap()
            .data
            .append(&mut polygon_result.geometry.attributes.position.unwrap().data);
        if let Some(normal) = polygon_result.geometry.attributes.normal.as_mut() {
            combined_attributes
                .normal
                .get_or_insert_with(|| FloatAttribute::new(vec![], 3))
                .data
                .append(&mut normal.data);
        }
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

        let mut batch_ids = vec![];
        let mut batch_indices = vec![];
        for _i in 0..position_length {
            batch_ids.push(batch_id.0 as FloatType);

            batch_indices.push(batch_idx.0);
        }

        combined_attributes
            .batch_ids
            .as_mut()
            .unwrap()
            .data
            .append(&mut batch_ids);
        combined_attributes
            .batch_index
            .as_mut()
            .unwrap()
            .data
            .append(&mut batch_indices);

        if index_offset == 0 {
            indices.append(&mut polygon_result.geometry.indices);
        } else {
            for i in polygon_result.geometry.indices {
                indices.push(i + index_offset);
            }
        }

        index_offset += position_length as u32;
    }

    Some(ConstructedPolygonGeometry::new(
        PolygonGeometry::new(combined_attributes.into(), indices),
        Some((&combined_extent?).into()),
    ))
}

pub fn construct_flat_polygon(
    mut features: TransferablePolygonBatchedFeature,
    material: PolygonMaterial,
) -> Option<ConstructedPolygonGeometry> {
    let mut polygon_resource = PolygonResource::new();
    let material: navara_material::PolygonMaterial = material.into();

    let mut combined_attributes = PolygonGeometryAttributes {
        position: Some(FloatAttribute::new(vec![], 3)),
        position_3d_high: None,
        position_3d_low: None,
        normal: None,
        scale_normal_and_cap: None,
        batch_ids: Some(FloatAttribute::new(vec![], 1)),
        batch_index: Some(UintAttribute::new(vec![], 1)),
    };
    let mut indices = vec![];
    let mut index_offset = 0;

    for idx in 0..features.length {
        let (transferable_hierarchy, batch_idx, batch_id) =
            features.to_transferable_hierarchy_by_index(idx);
        let geometry_hierarchy: Hierarchy = transferable_hierarchy.into();

        let polygon_result_opt = navara_feature_component::polygon::construct_flat_polygon_feature(
            geometry_hierarchy,
            &material,
            &mut polygon_resource,
            false, // use_rte = false for batched MVT features
        );

        let mut polygon_result = match polygon_result_opt {
            Some(polygon_result) => polygon_result,
            None => continue,
        };

        let position_length = polygon_result
            .geometry
            .attributes
            .position
            .as_ref()
            .unwrap()
            .data
            .len()
            / polygon_result
                .geometry
                .attributes
                .position
                .as_ref()
                .unwrap()
                .size as usize;
        if position_length == 0 {
            continue;
        }

        combined_attributes
            .position
            .as_mut()
            .unwrap()
            .data
            .append(&mut polygon_result.geometry.attributes.position.unwrap().data);

        let mut batch_ids = vec![];
        let mut batch_indices = vec![];
        for _i in 0..position_length {
            batch_ids.push(batch_id.0 as FloatType);

            batch_indices.push(batch_idx.0);
        }

        combined_attributes
            .batch_ids
            .as_mut()
            .unwrap()
            .data
            .append(&mut batch_ids);
        combined_attributes
            .batch_index
            .as_mut()
            .unwrap()
            .data
            .append(&mut batch_indices);

        if index_offset == 0 {
            indices.append(&mut polygon_result.geometry.indices);
        } else {
            for i in polygon_result.geometry.indices {
                indices.push(i + index_offset);
            }
        }

        index_offset += position_length as u32;
    }

    Some(ConstructedPolygonGeometry::new(
        PolygonGeometry::new(combined_attributes.into(), indices),
        None,
    ))
}
