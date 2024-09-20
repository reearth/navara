use bevy_ecs::system::Resource;
use bevy_ecs::entity::Entity;
use std::collections::HashMap;

#[derive(Resource)] 
pub struct LayerStore { 
    pub map: HashMap<String, Vec<Entity>>, 
}