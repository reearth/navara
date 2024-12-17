use navara_geometry::Hierarchy;
use navara_math::FloatType;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Clone)]
pub struct TransferableHierarchy {
    #[wasm_bindgen(getter_with_clone)]
    pub outer_ring: Vec<FloatType>,
    #[wasm_bindgen(getter_with_clone)]
    pub holes: TransferableHoles,
    #[wasm_bindgen(getter_with_clone)]
    pub expected_winding_order: u8,
}

/// To transfer the hierarchy efficiently, the holes are managed as one-dimensional array.
#[wasm_bindgen]
#[derive(Clone)]
pub struct TransferableHoles {
    #[wasm_bindgen(getter_with_clone)]
    pub holes: Vec<FloatType>,
    #[wasm_bindgen(getter_with_clone)]
    pub expected_winding_orders: Vec<u8>,
    #[wasm_bindgen(getter_with_clone)]
    pub sizes: Vec<usize>,
}

impl From<TransferableHierarchy> for navara_geometry::Hierarchy {
    fn from(val: TransferableHierarchy) -> Self {
        let mut holes = vec![];
        let mut t_holes = val.holes;
        for (winding_order_idx, size) in t_holes.sizes.into_iter().enumerate() {
            holes.push(Hierarchy {
                outer_ring: t_holes.holes.drain(0..size).collect(),
                holes: None,
                expected_winding_order: WindingOrder(
                    t_holes.expected_winding_orders[winding_order_idx],
                )
                .into(),
            });
        }
        navara_geometry::Hierarchy {
            outer_ring: val.outer_ring,
            holes: Some(holes),
            expected_winding_order: WindingOrder(val.expected_winding_order).into(),
        }
    }
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct WindingOrder(pub u8);

impl From<WindingOrder> for navara_geometry::WindingOrder {
    fn from(val: WindingOrder) -> Self {
        match val.0 {
            0 => navara_geometry::WindingOrder::Unknown,
            1 => navara_geometry::WindingOrder::Clockwise,
            2 => navara_geometry::WindingOrder::CounterClockwise,
            _ => unimplemented!(),
        }
    }
}

impl From<navara_geometry::WindingOrder> for WindingOrder {
    fn from(val: navara_geometry::WindingOrder) -> Self {
        match val {
            navara_geometry::WindingOrder::Unknown => WindingOrder(0),
            navara_geometry::WindingOrder::Clockwise => WindingOrder(1),
            navara_geometry::WindingOrder::CounterClockwise => WindingOrder(2),
        }
    }
}
