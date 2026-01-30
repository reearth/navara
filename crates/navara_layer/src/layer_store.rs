use bevy_ecs::entity::Entity;
use bevy_ecs::prelude::Resource;
use rustc_hash::FxHashMap;

/// A store to preserve a relation between layer id and a feature's entity.
#[derive(Resource, Debug)]
pub struct LayerStore {
    map: FxHashMap<String, Vec<Entity>>,
}

impl Default for LayerStore {
    fn default() -> Self {
        Self::new()
    }
}

impl LayerStore {
    pub fn new() -> Self {
        Self {
            map: FxHashMap::default(),
        }
    }
    pub fn add(&mut self, key: String, e: Entity) {
        self.map.entry(key).or_default().push(e);
    }
    pub fn get(&self, key: &str) -> Option<&Vec<Entity>> {
        self.map.get(key)
    }
    pub fn get_mut(&mut self, key: &str) -> Option<&mut Vec<Entity>> {
        self.map.get_mut(key)
    }
    pub fn remove(&mut self, key: &str) {
        self.map.remove(key);
    }

    pub fn remove_features(&mut self, layer_id: &str, features: &[Entity]) {
        let Some(stored_features) = self.get_mut(layer_id) else {
            return;
        };
        let mut removed = vec![];
        for (i, f) in stored_features.iter().enumerate() {
            if features.contains(f) {
                removed.push(i);
            }
        }

        for (offset, i) in removed.iter().enumerate() {
            stored_features.remove(i - offset);
        }
    }
}
