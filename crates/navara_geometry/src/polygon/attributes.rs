use crate::FloatAttribute;

#[derive(Clone, Debug, Default, PartialEq)]
pub struct PolygonGeometryAttributes {
    pub position: FloatAttribute,
    pub normal: Option<FloatAttribute>,
}
