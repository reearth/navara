use earcut::Earcut;
use navara_math::FloatType;

use super::types::Polygon;

#[cfg_attr(feature = "bevy", derive(bevy_ecs::prelude::Resource))]
pub struct PolygonResource {
    pub earcut: Earcut<FloatType>,
}

impl Default for PolygonResource {
    fn default() -> Self {
        Self::new()
    }
}

impl PolygonResource {
    pub fn new() -> Self {
        Self {
            earcut: Earcut::new(),
        }
    }

    pub fn earcut(&mut self, polygon: &Polygon) -> Vec<u32> {
        let mut out = vec![];
        self.earcut.earcut(
            polygon.positions_2d.iter().map(|v| [v.x, v.y]),
            &polygon.hole_indices,
            &mut out,
        );
        out
    }
}
