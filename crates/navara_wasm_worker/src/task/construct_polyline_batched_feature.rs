use navara_core::{Extent, Radians};
use navara_feature_component::polyline::construct_polyline_feature;
use navara_geometry::PolylineGeometryAttributes;
use navara_math::FloatType;
use navara_wasm_types::{
    polyline::{ConstructedPolylineGeometry, PolylineGeometry, TransferablePolylineBatchedFeature},
    PolylineMaterial,
};
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen(js_name = constructPolylineBatchedFeature)]
pub fn construct_polyline_batched_feature(
    mut features: TransferablePolylineBatchedFeature,
    material: PolylineMaterial,
) -> Option<ConstructedPolylineGeometry> {
    let material: navara_material::PolylineMaterial = material.into();
    let crs: navara_core::CRS = (&features.crs).into();

    let mut combined_attributes = PolylineGeometryAttributes::with_batch_id();
    let mut indices = vec![];
    let mut index_offset = 0;

    let mut combined_extent: Option<Extent<f32, Radians>> = None;

    for idx in 0..features.length {
        let (geometry, batch_id) = features.to_transferable_by_index(idx);

        let Some((extent, mut constructed_geometry)) =
            construct_polyline_feature(&material, geometry, &crs)
        else {
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

        let mut batch_ids = vec![];
        for _i in 0..position_length {
            batch_ids.push(batch_id.0.x as FloatType);
            batch_ids.push(batch_id.0.y as FloatType);
        }
        combined_attributes
            .batch_id_and_sel
            .as_mut()
            .unwrap()
            .data
            // TODO: Avoid cast
            .append(&mut batch_ids);

        if index_offset == 0 {
            indices.append(&mut constructed_geometry.indices);
        } else {
            for i in constructed_geometry.indices {
                indices.push(i + index_offset);
            }
        }

        index_offset += position_length as u32;
    }

    features.drop();

    Some(ConstructedPolylineGeometry::new(
        (&combined_extent.unwrap()).into(),
        PolylineGeometry::new(combined_attributes.into(), indices),
    ))
}
