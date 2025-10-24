use navara_math::FloatType;

use crate::{FloatAttribute, UintAttribute};

#[derive(Clone, Debug, Default, PartialEq)]
pub struct PolygonGeometryAttributes {
    /// Regular position attribute (f32, Vec3)
    /// Present when use_rte = false (e.g., for MVT batched tiles)
    pub position: Option<FloatAttribute>,

    /// RTE: High bits of position encoding (f32)
    /// Present when use_rte = true
    pub position_3d_high: Option<FloatAttribute>,

    /// RTE: Low bits of position encoding (f32)
    /// Present when use_rte = true
    pub position_3d_low: Option<FloatAttribute>,

    pub normal: Option<FloatAttribute>,
    pub scale_normal_and_cap: Option<FloatAttribute>,
    pub batch_ids: Option<FloatAttribute>,
    pub batch_index: Option<UintAttribute>,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct PolygonGeometryUniforms {
    pub min_max_heights: Option<[FloatType; 2]>,
}
