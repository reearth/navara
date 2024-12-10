use earcutr::earcut;

use super::types::Polygon;

#[cfg_attr(feature = "bevy", derive(bevy_ecs::prelude::Resource))]
pub struct PolygonResource;

impl Default for PolygonResource {
    fn default() -> Self {
        Self::new()
    }
}

impl PolygonResource {
    pub fn new() -> Self {
        Self
    }

    pub fn earcut(&mut self, polygon: &Polygon) -> Vec<usize> {
        earcut(
            &polygon
                .positions_2d
                .iter()
                .flat_map(|v| [v.x, v.y])
                .collect::<Vec<_>>(),
            &polygon
                .hole_indices
                .iter()
                .map(|v| (*v) as usize)
                .collect::<Vec<_>>(),
            2,
        )
        .unwrap()
    }
}
