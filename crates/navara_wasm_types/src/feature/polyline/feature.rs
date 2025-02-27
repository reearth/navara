use navara_feature_component::batch::BatchId;
use navara_math::{FloatType, Vec2};
use wasm_bindgen::prelude::*;

use crate::{copy_f32_array, copy_u32_array, transfer_f32_array, transfer_u32_array, CRS};

/// To transfer the batched feature efficiently, the all feature's properties are managed as one-dimensional array.
#[wasm_bindgen]
#[derive(Debug, Default)]
pub struct TransferablePolylineBatchedFeature {
    points: Vec<FloatType>,
    points_sizes: Vec<u32>,
    batch_ids: Vec<u32>,

    #[wasm_bindgen(getter_with_clone)]
    pub crs: CRS,

    pub length: usize,

    cur_idx: usize,
}

#[wasm_bindgen]
impl TransferablePolylineBatchedFeature {
    #[allow(clippy::too_many_arguments)]
    #[wasm_bindgen(constructor)]
    pub fn constructor(crs: CRS, length: usize) -> Self {
        Self {
            points: vec![],
            points_sizes: vec![],
            batch_ids: vec![],
            crs,
            length,
            cur_idx: 0,
        }
    }

    #[wasm_bindgen(js_name = "setBatchIds")]
    pub fn set_batch_ids(&mut self, byte_length: usize, f: &js_sys::Function) {
        unsafe { self.batch_ids = transfer_u32_array(byte_length, f) }
    }
    #[wasm_bindgen(js_name = "setPoints")]
    pub fn set_points(&mut self, byte_length: usize, f: &js_sys::Function) {
        unsafe { self.points = transfer_f32_array(byte_length, f) }
    }
    #[wasm_bindgen(js_name = "setPointsSizes")]
    pub fn set_points_sizes(&mut self, byte_length: usize, f: &js_sys::Function) {
        unsafe { self.points_sizes = transfer_u32_array(byte_length, f) }
    }

    pub fn drop(self) {
        drop(self.points);
        drop(self.points_sizes);
        drop(self.batch_ids);
    }

    #[wasm_bindgen(js_name = "transferBatchIds")]
    pub fn transfer_batch_ids(&mut self) -> js_sys::Uint32Array {
        copy_u32_array(&self.batch_ids)
    }

    #[wasm_bindgen(js_name = "transferPoints")]
    pub fn transfer_points(&mut self) -> js_sys::Float32Array {
        copy_f32_array(&self.points)
    }

    #[wasm_bindgen(js_name = "transferPointsSizes")]
    pub fn transfer_points_sizes(&mut self) -> js_sys::Uint32Array {
        copy_u32_array(&self.points_sizes)
    }
}

impl TransferablePolylineBatchedFeature {
    pub fn new<I: Iterator<Item = (u32, Vec<FloatType>)>>(geometries: I, length: usize) -> Self {
        let mut points = Vec::with_capacity(length);
        let mut points_sizes = Vec::with_capacity(length);
        let mut batch_ids = Vec::with_capacity(length * 2);

        for (batch_id, mut ps) in geometries {
            points_sizes.push(ps.len() as u32);
            points.append(&mut ps);

            batch_ids.push(batch_id);
            batch_ids.push(0);
        }

        TransferablePolylineBatchedFeature {
            points,
            points_sizes,
            batch_ids,
            crs: CRS::default(),
            length,
            ..Default::default()
        }
    }

    pub fn empty(length: usize) -> Self {
        let points = Vec::with_capacity(length);
        let points_sizes = Vec::with_capacity(length);
        let batch_ids = Vec::with_capacity(length * 2);

        TransferablePolylineBatchedFeature {
            points,
            points_sizes,
            batch_ids,
            crs: CRS::default(),
            length,
            ..Default::default()
        }
    }

    pub fn add(&mut self, points: &mut Vec<FloatType>, batch_id: &BatchId) {
        self.points_sizes.push(points.len() as u32);
        self.points.append(points);

        self.batch_ids.push(batch_id.0.x as u32);
        self.batch_ids.push(batch_id.0.y as u32);
    }

    pub fn to_transferable_by_index(&mut self, idx: usize) -> (Vec<FloatType>, BatchId) {
        let points = self
            .points
            .drain(..self.points_sizes[idx] as usize)
            .collect();

        let batch_id = BatchId(Vec2::new(
            self.batch_ids[idx * 2] as FloatType,
            self.batch_ids[idx * 2 + 1] as FloatType,
        ));

        (points, batch_id)
    }
}

impl Iterator for TransferablePolylineBatchedFeature {
    type Item = (Vec<FloatType>, BatchId);
    fn next(&mut self) -> Option<Self::Item> {
        if self.cur_idx == self.length {
            return None;
        }

        let result = self.to_transferable_by_index(self.cur_idx);
        self.cur_idx += 1;
        Some(result)
    }
}

#[cfg(test)]
mod test {
    use navara_math::{FloatType, Vec2};

    use super::TransferablePolylineBatchedFeature;

    #[test]
    fn it_should_get_a_points_of_batched_feature() {
        #[rustfmt::skip]
        let points = vec![
                vec![
                    0., 0., 0.,
                    1., 1., 1.,
                    2., 2., 2.,
                ],
                vec![
                    10., 10., 10.,
                    11., 11., 11.,
                    12., 12., 12.,
                ],
                vec![20., 20., 20.],
        ];

        struct BatchedFeature(u32, Vec<Vec<FloatType>>);
        impl Iterator for BatchedFeature {
            type Item = (u32, Vec<FloatType>);
            fn next(&mut self) -> Option<Self::Item> {
                if self.1.is_empty() {
                    return None;
                }
                let result = (self.0, self.1.remove(0));
                self.0 += 1;
                Some(result)
            }
        }

        let transferable_features = TransferablePolylineBatchedFeature::new(
            BatchedFeature(0, points.clone()),
            points.len(),
        );

        let mut features: Vec<Vec<FloatType>> = vec![];
        let mut batch_ids = vec![];
        for (feature, batch_id) in transferable_features {
            features.push(feature);
            batch_ids.push(batch_id.0);
        }

        assert_eq!(features, points);
        assert_eq!(
            batch_ids,
            vec![
                Vec2::new(0.0, 0.0),
                Vec2::new(1.0, 0.0),
                Vec2::new(2.0, 0.0)
            ]
        );
    }
}
