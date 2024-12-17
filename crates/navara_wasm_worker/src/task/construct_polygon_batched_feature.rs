use navara_geometry::{FloatAttribute, Hierarchy, PolygonGeometryAttributes, PolygonResource};
use navara_math::FloatType;
use navara_wasm_types::{
    polygon::{ConstructedPolygonGeometry, PolygonGeometry, TransferablePolygonBatchedFeature},
    PolygonMaterial,
};
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen(js_name = constructPolygonBatchedFeature)]
pub fn construct_polygon_batched_feature(
    mut features: TransferablePolygonBatchedFeature,
    material: PolygonMaterial,
) -> Option<ConstructedPolygonGeometry> {
    let mut polygon_resource = PolygonResource::new();
    let material: navara_material::PolygonMaterial = material.into();
    let crs: navara_core::CRS = (&features.crs).into();

    let mut extent_vec = Vec::new();
    let mut combined_attributes = PolygonGeometryAttributes {
        position: FloatAttribute::new(vec![], 3),
        normal: Some(FloatAttribute::new(vec![], 3)),
        scale_normal_and_cap: Some(FloatAttribute::new(vec![], 4)),
        batch_id: Some(FloatAttribute::new(vec![], 1)),
    };
    let mut indices = vec![];
    let mut index_offset = 0;

    for idx in 0..features.length {
        let (transferable_hierarchy, batch_id) = features.to_transferable_hierarchy_by_index(idx);
        let geometry_hierarchy: Hierarchy = transferable_hierarchy.into();

        let (extent_opt, polygon_result_opt) =
            navara_feature_component::polygon::construct_polygon_feature(
                geometry_hierarchy,
                &crs,
                &material,
                &mut polygon_resource,
            );

        let (extent, mut polygon_result) = match (extent_opt, polygon_result_opt) {
            (Some(extent), Some(polygon_result)) => (extent, polygon_result),
            _ => continue,
        };

        extent_vec.push(extent);

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

    if extent_vec.is_empty() {
        return None;
    }

    let mut combined_extent = extent_vec[0];
    for extent in extent_vec.iter().skip(1) {
        combined_extent = combined_extent.union(*extent);
    }

    Some(ConstructedPolygonGeometry {
        extent: (&combined_extent).into(),
        geometry: PolygonGeometry {
            attributes: combined_attributes.into(),
            indices,
        },
    })
}
