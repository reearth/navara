use bevy_ecs::system::Resource;
use bevy_ecs::entity::Entity;
use std::collections::HashMap;
use crate::LayerId;

#[derive(Resource, Debug)] 
pub struct LayerStore { 
    pub map: HashMap<LayerId, Vec<Entity>>, 
}