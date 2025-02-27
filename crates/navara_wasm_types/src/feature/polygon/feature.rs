use navara_feature_component::batch::BatchId;
use navara_geometry::Hierarchy;
use navara_math::{FloatType, Vec2};
use wasm_bindgen::prelude::*;

use crate::{
    copy_f32_array, copy_u32_array, copy_u8_array, transfer_f32_array, transfer_u32_array,
    transfer_u8_array, CRS,
};

use super::{TransferableHierarchy, TransferableHoles, WindingOrder};

/// To transfer the batched feature efficiently, the all feature's properties are managed as one-dimensional array.
#[wasm_bindgen]
#[derive(Debug, Default)]
pub struct TransferablePolygonBatchedFeature {
    outer_ring: Vec<FloatType>,
    outer_ring_sizes: Vec<u32>,
    /// All holes for a batched feature
    holes: Vec<FloatType>,
    /// Total holes for one feature.
    holes_total_sizes: Vec<u32>,
    /// Each hole size
    holes_sizes: Vec<u32>,
    /// Each hole boundaries
    holes_boundaries: Vec<u32>,
    batch_ids: Vec<u32>,
    expected_winding_orders: Vec<u8>,

    #[wasm_bindgen(getter_with_clone)]
    pub crs: CRS,

    pub length: usize,

    cur_idx: usize,
}

#[wasm_bindgen]
impl TransferablePolygonBatchedFeature {
    #[allow(clippy::too_many_arguments)]
    #[wasm_bindgen(constructor)]
    pub fn constructor(crs: CRS, length: usize) -> Self {
        Self {
            outer_ring: vec![],
            outer_ring_sizes: vec![],
            holes: vec![],
            holes_total_sizes: vec![],
            holes_sizes: vec![],
            holes_boundaries: vec![],
            batch_ids: vec![],
            expected_winding_orders: vec![],
            crs,
            length,
            cur_idx: 0,
        }
    }

    #[wasm_bindgen(js_name = "setOuterRing")]
    pub fn set_outer_ring(&mut self, byte_length: usize, f: &js_sys::Function) {
        unsafe { self.outer_ring = transfer_f32_array(byte_length, f) }
    }
    #[wasm_bindgen(js_name = "setOuterRingSizes")]
    pub fn set_outer_ring_sizes(&mut self, byte_length: usize, f: &js_sys::Function) {
        unsafe { self.outer_ring_sizes = transfer_u32_array(byte_length, f) }
    }
    #[wasm_bindgen(js_name = "setHoles")]
    pub fn set_holes(&mut self, byte_length: usize, f: &js_sys::Function) {
        unsafe { self.holes = transfer_f32_array(byte_length, f) }
    }
    #[wasm_bindgen(js_name = "setHolesSizes")]
    pub fn set_holes_sizes(&mut self, byte_length: usize, f: &js_sys::Function) {
        unsafe { self.holes_sizes = transfer_u32_array(byte_length, f) }
    }
    #[wasm_bindgen(js_name = "setHolesTotalSizes")]
    pub fn set_holes_total_sizes(&mut self, byte_length: usize, f: &js_sys::Function) {
        unsafe { self.holes_total_sizes = transfer_u32_array(byte_length, f) }
    }
    #[wasm_bindgen(js_name = "setHolesBoundaries")]
    pub fn set_holes_boundaries(&mut self, byte_length: usize, f: &js_sys::Function) {
        unsafe { self.holes_boundaries = transfer_u32_array(byte_length, f) }
    }
    #[wasm_bindgen(js_name = "setBatchIds")]
    pub fn set_batch_ids(&mut self, byte_length: usize, f: &js_sys::Function) {
        unsafe { self.batch_ids = transfer_u32_array(byte_length, f) }
    }
    #[wasm_bindgen(js_name = "setExpectedWindingOrders")]
    pub fn set_expected_winding_orders(&mut self, byte_length: usize, f: &js_sys::Function) {
        unsafe { self.expected_winding_orders = transfer_u8_array(byte_length, f) }
    }

    pub fn drop(self) {
        drop(self.outer_ring);
        drop(self.outer_ring_sizes);
        drop(self.holes);
        drop(self.holes_boundaries);
        drop(self.holes_sizes);
        drop(self.holes_total_sizes);
        drop(self.batch_ids);
        drop(self.expected_winding_orders);
    }

    #[wasm_bindgen(js_name = "transferBatchIds")]
    pub fn transfer_batch_ids(&mut self) -> js_sys::Uint32Array {
        copy_u32_array(&self.batch_ids)
    }

    #[wasm_bindgen(js_name = "transferOuterRing")]
    pub fn transfer_outer_ring(&mut self) -> js_sys::Float32Array {
        copy_f32_array(&self.outer_ring)
    }

    #[wasm_bindgen(js_name = "transferOuterRingSizes")]
    pub fn transfer_outer_ring_sizes(&mut self) -> js_sys::Uint32Array {
        copy_u32_array(&self.outer_ring_sizes)
    }

    #[wasm_bindgen(js_name = "transferHoles")]
    pub fn transfer_holes(&mut self) -> js_sys::Float32Array {
        copy_f32_array(&self.holes)
    }

    #[wasm_bindgen(js_name = "transferHolesBoundaries")]
    pub fn transfer_holes_boundaries(&mut self) -> js_sys::Uint32Array {
        copy_u32_array(&self.holes_boundaries)
    }

    #[wasm_bindgen(js_name = "transferHolesSizes")]
    pub fn transfer_holes_sizes(&mut self) -> js_sys::Uint32Array {
        copy_u32_array(&self.holes_sizes)
    }

    #[wasm_bindgen(js_name = "transferHolesTotalSizes")]
    pub fn transfer_holes_total_sizes(&mut self) -> js_sys::Uint32Array {
        copy_u32_array(&self.holes_total_sizes)
    }

    #[wasm_bindgen(js_name = "transferExpectedWindingOrders")]
    pub fn transfer_expected_winding_orders(&mut self) -> js_sys::Uint8Array {
        copy_u8_array(&self.expected_winding_orders)
    }
}

impl TransferablePolygonBatchedFeature {
    pub fn new<I: Iterator<Item = (usize, Hierarchy)>>(hierarchies: I, length: usize) -> Self {
        let mut outer_ring = Vec::with_capacity(length);
        let mut outer_ring_sizes = Vec::with_capacity(length);
        let mut holes = Vec::with_capacity(length);
        let mut holes_total_sizes = Vec::with_capacity(length);
        let mut holes_boundaries = Vec::with_capacity(length);
        let mut holes_sizes = Vec::with_capacity(length);
        let mut batch_ids = Vec::with_capacity(length * 2);
        let mut expected_winding_orders = Vec::with_capacity(length);

        for (batch_id, mut hierarchy) in hierarchies {
            outer_ring_sizes.push(hierarchy.outer_ring.len() as u32);
            outer_ring.append(&mut hierarchy.outer_ring);

            batch_ids.push(batch_id as u32);
            batch_ids.push(0);
            expected_winding_orders
                .push(Into::<WindingOrder>::into(hierarchy.expected_winding_order).0);

            let Some(h_holes) = hierarchy.holes else {
                continue;
            };
            holes_boundaries.push(h_holes.len() as u32);
            let mut holes_total_size = 0;
            for mut hole in h_holes {
                holes_total_size += hole.outer_ring.len();
                holes_sizes.push(hole.outer_ring.len() as u32);
                holes.append(&mut hole.outer_ring);
                expected_winding_orders
                    .push(Into::<WindingOrder>::into(hole.expected_winding_order).0);
            }
            holes_total_sizes.push(holes_total_size as u32);
        }

        TransferablePolygonBatchedFeature {
            outer_ring,
            outer_ring_sizes,
            holes,
            holes_sizes,
            holes_total_sizes,
            holes_boundaries,
            batch_ids,
            expected_winding_orders,
            crs: CRS::default(),
            length,
            ..Default::default()
        }
    }

    pub fn empty(length: usize) -> Self {
        let outer_ring = Vec::with_capacity(length);
        let outer_ring_sizes = Vec::with_capacity(length);
        let holes = Vec::with_capacity(length);
        let holes_total_sizes = Vec::with_capacity(length);
        let holes_boundaries = Vec::with_capacity(length);
        let holes_sizes = Vec::with_capacity(length);
        let batch_ids = Vec::with_capacity(length * 2);
        let expected_winding_orders = Vec::with_capacity(length);

        TransferablePolygonBatchedFeature {
            outer_ring,
            outer_ring_sizes,
            holes,
            holes_sizes,
            holes_total_sizes,
            holes_boundaries,
            batch_ids,
            expected_winding_orders,
            crs: CRS::default(),
            length,
            ..Default::default()
        }
    }

    pub fn add(&mut self, hierarchy: &mut Hierarchy, batch_id: &BatchId) {
        self.outer_ring_sizes
            .push(hierarchy.outer_ring.len() as u32);
        self.outer_ring.append(&mut hierarchy.outer_ring);

        self.batch_ids.push(batch_id.0.x as u32);
        self.batch_ids.push(batch_id.0.y as u32);
        self.expected_winding_orders
            .push(Into::<WindingOrder>::into(hierarchy.expected_winding_order).0);

        let Some(h_holes) = &mut hierarchy.holes else {
            return;
        };

        self.holes_boundaries.push(h_holes.len() as u32);
        let mut holes_total_size = 0;
        for hole in h_holes {
            holes_total_size += hole.outer_ring.len();
            self.holes_sizes.push(hole.outer_ring.len() as u32);
            self.holes.append(&mut hole.outer_ring);
            self.expected_winding_orders
                .push(Into::<WindingOrder>::into(hole.expected_winding_order).0);
        }
        self.holes_total_sizes.push(holes_total_size as u32);
    }

    pub fn to_transferable_hierarchy_by_index(
        &mut self,
        idx: usize,
    ) -> (TransferableHierarchy, BatchId) {
        let transferable_hierarchy = TransferableHierarchy {
            outer_ring: self
                .outer_ring
                .drain(..self.outer_ring_sizes[idx] as usize)
                .collect(),
            expected_winding_order: self.expected_winding_orders.remove(0),
            holes: TransferableHoles {
                holes: self
                    .holes
                    .drain(..self.holes_total_sizes[idx] as usize)
                    .collect(),
                sizes: self
                    .holes_sizes
                    .drain(..self.holes_boundaries[idx] as usize)
                    .collect(),
                expected_winding_orders: self
                    .expected_winding_orders
                    .drain(..self.holes_boundaries[idx] as usize)
                    .collect(),
            },
        };

        let batch_id = BatchId(Vec2::new(
            self.batch_ids[idx * 2] as FloatType,
            self.batch_ids[idx * 2 + 1] as FloatType,
        ));

        (transferable_hierarchy, batch_id)
    }
}

impl Iterator for TransferablePolygonBatchedFeature {
    type Item = (TransferableHierarchy, BatchId);
    fn next(&mut self) -> Option<Self::Item> {
        if self.cur_idx == self.length {
            return None;
        }

        let result = self.to_transferable_hierarchy_by_index(self.cur_idx);
        self.cur_idx += 1;
        Some(result)
    }
}

#[cfg(test)]
mod test {
    use super::TransferablePolygonBatchedFeature;
    use navara_geometry::Hierarchy;
    use navara_math::Vec2;

    #[test]
    fn it_should_get_a_hierarchy_of_batched_feature() {
        let hierarchies = vec![
            Hierarchy {
                #[rustfmt::skip]
                outer_ring: vec![
                    0., 0., 0.,
                    1., 1., 1.,
                    2., 2., 2.,
                ],
                holes: Some(vec![
                    Hierarchy {
                        #[rustfmt::skip]
                        outer_ring: vec![
                            3., 3., 3.,
                            4., 4., 4.,
                            5., 5., 5.,
                        ],
                        holes: None,
                        expected_winding_order: navara_geometry::WindingOrder::Clockwise,
                    },
                    Hierarchy {
                        #[rustfmt::skip]
                        outer_ring: vec![
                            6., 6., 6.,
                            7., 7., 7.,
                            8., 8., 8.,
                        ],
                        holes: None,
                        expected_winding_order: navara_geometry::WindingOrder::Clockwise,
                    },
                ]),
                expected_winding_order: navara_geometry::WindingOrder::CounterClockwise,
            },
            Hierarchy {
                #[rustfmt::skip]
                outer_ring: vec![
                    10., 10., 10.,
                    11., 11., 11.,
                    12., 12., 12.,
                ],
                holes: Some(vec![
                    Hierarchy {
                        outer_ring: vec![13., 13., 13.],
                        holes: None,
                        expected_winding_order: navara_geometry::WindingOrder::Clockwise,
                    },
                    Hierarchy {
                        #[rustfmt::skip]
                        outer_ring: vec![
                            14., 14., 14.,
                            15., 15., 15.
                        ],
                        holes: None,
                        expected_winding_order: navara_geometry::WindingOrder::Clockwise,
                    },
                ]),
                expected_winding_order: navara_geometry::WindingOrder::CounterClockwise,
            },
            Hierarchy {
                outer_ring: vec![20., 20., 20.],
                holes: Some(vec![
                    Hierarchy {
                        outer_ring: vec![21., 21., 21.],
                        holes: None,
                        expected_winding_order: navara_geometry::WindingOrder::Clockwise,
                    },
                    Hierarchy {
                        outer_ring: vec![22., 22., 22.],
                        holes: None,
                        expected_winding_order: navara_geometry::WindingOrder::Clockwise,
                    },
                ]),
                expected_winding_order: navara_geometry::WindingOrder::CounterClockwise,
            },
        ];

        struct BatchedHierarchy(usize, Vec<Hierarchy>);
        impl Iterator for BatchedHierarchy {
            type Item = (usize, Hierarchy);
            fn next(&mut self) -> Option<Self::Item> {
                if self.1.is_empty() {
                    return None;
                }
                let result = (self.0, self.1.remove(0));
                self.0 += 1;
                Some(result)
            }
        }

        let transferable_features = TransferablePolygonBatchedFeature::new(
            BatchedHierarchy(0, hierarchies.clone()),
            hierarchies.len(),
        );

        let mut features: Vec<Hierarchy> = vec![];
        let mut batch_ids = vec![];
        for (feature, batch_id) in transferable_features {
            features.push(feature.into());
            batch_ids.push(batch_id.0);
        }

        assert_eq!(features, hierarchies);
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
