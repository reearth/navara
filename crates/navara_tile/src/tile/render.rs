use std::cmp::Ordering;

use bevy_ecs::component::Component;

use super::TileHandle;

#[derive(Component)]
pub struct RenderedTile {
    pub(crate) tile_handle: TileHandle,
}

#[derive(Component, PartialEq, Debug)]
pub struct RenderedTileDistance(pub(crate) f32);

impl PartialOrd for RenderedTileDistance {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for RenderedTileDistance {
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

impl Eq for RenderedTileDistance {}

#[cfg(test)]
mod test {
    use super::RenderedTileDistance;

    #[test]
    fn it_should_sort_near_to_far_order() {
        let mut d = [
            RenderedTileDistance(0.2),
            RenderedTileDistance(0.5),
            RenderedTileDistance(0.1),
            RenderedTileDistance(0.),
            RenderedTileDistance(0.4),
            RenderedTileDistance(0.3),
        ];
        d.sort();

        let expects = [
            RenderedTileDistance(0.),
            RenderedTileDistance(0.1),
            RenderedTileDistance(0.2),
            RenderedTileDistance(0.3),
            RenderedTileDistance(0.4),
            RenderedTileDistance(0.5),
        ];

        for (i, result) in d.iter().enumerate() {
            assert_eq!(result, &expects[i]);
        }
    }
}
