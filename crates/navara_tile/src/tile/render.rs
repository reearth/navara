use std::cmp::Ordering;

use bevy_ecs::{component::Component, entity::Entity, system::Commands};

use navara_component::Deleted;
use navara_math::FloatType;
use navara_tile_component::TileHandle;

#[derive(Component, Default)]
pub struct RenderedTile {
    pub(crate) tile_handle: TileHandle,
    pub(crate) terrain_mesh_constructor: Option<Entity>,
    pub(crate) terrain_mesh_upsampler: Option<Entity>,
}

impl RenderedTile {
    pub fn destroy(&mut self, commands: &mut Commands) {
        if let Some(e) = self.terrain_mesh_constructor.take() {
            commands.entity(e).insert(Deleted);
        }
        if let Some(e) = self.terrain_mesh_upsampler.take() {
            commands.entity(e).insert(Deleted);
        }
    }
}

#[derive(Component, PartialEq, Debug)]
pub struct TileOrderByDistance(pub(crate) FloatType);

impl PartialOrd for TileOrderByDistance {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for TileOrderByDistance {
    fn cmp(&self, other: &Self) -> Ordering {
        if self.0 > other.0 {
            return Ordering::Greater;
        }
        if self.0 < other.0 {
            return Ordering::Less;
        }
        Ordering::Equal
    }
}

impl Eq for TileOrderByDistance {}

#[cfg(test)]
mod test {
    use super::TileOrderByDistance;

    #[test]
    fn it_should_sort_near_to_far_order() {
        let mut d = [
            TileOrderByDistance(0.2),
            TileOrderByDistance(0.5),
            TileOrderByDistance(0.1),
            TileOrderByDistance(0.),
            TileOrderByDistance(0.4),
            TileOrderByDistance(0.3),
        ];
        d.sort();

        let expects = [
            TileOrderByDistance(0.),
            TileOrderByDistance(0.1),
            TileOrderByDistance(0.2),
            TileOrderByDistance(0.3),
            TileOrderByDistance(0.4),
            TileOrderByDistance(0.5),
        ];

        for (i, result) in d.iter().enumerate() {
            assert_eq!(result, &expects[i]);
        }
    }
}
