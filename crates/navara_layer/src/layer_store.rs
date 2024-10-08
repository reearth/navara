use crate::LayerId;
use bevy_ecs::entity::Entity;
use bevy_ecs::system::Resource;
use std::collections::HashMap;

/// A store to preserve a relation between [`LayerId`] and a feature's entity.
#[derive(Resource, Debug)]
pub struct LayerStore {
    pub map: HashMap<LayerId, Vec<Entity>>,
}
