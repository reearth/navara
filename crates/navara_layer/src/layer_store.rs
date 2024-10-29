use bevy_ecs::entity::Entity;
use bevy_ecs::system::Resource;
use std::collections::HashMap;

/// A store to preserve a relation between layer id and a feature's entity.
#[derive(Resource, Debug)]
pub struct LayerStore {
    map: HashMap<String, Vec<Entity>>,
}

impl Default for LayerStore {
    fn default() -> Self {
        Self::new()
    }
}

impl LayerStore {
    pub fn new() -> Self {
        Self {
            map: HashMap::new(),
        }
    }
    pub fn add(&mut self, key: String, e: Entity) {
        self.map.entry(key).or_default().push(e);
    }
    pub fn get(&self, key: &str) -> Option<&Vec<Entity>> {
        self.map.get(key)
    }
    pub fn remove(&mut self, key: &str) {
        self.map.remove(key);
    }
}
