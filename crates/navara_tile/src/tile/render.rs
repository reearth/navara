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
