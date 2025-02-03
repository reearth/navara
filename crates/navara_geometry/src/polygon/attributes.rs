use navara_math::FloatType;

use crate::FloatAttribute;

#[derive(Clone, Debug, Default, PartialEq)]
pub struct PolygonGeometryAttributes {
    pub position: FloatAttribute,
    pub normal: Option<FloatAttribute>,
    pub scale_normal_and_cap: Option<FloatAttribute>,
    pub batch_id: Option<FloatAttribute>,
    pub extruded_height: Option<FloatAttribute>,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct PolygonGeometryUniforms {
    pub min_max_heights: Option<[FloatType; 2]>,
}
