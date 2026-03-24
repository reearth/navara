use crate::LayerDescription;
use bevy_ecs::prelude::Resource;
use std::collections::HashMap;

/// A store to preserve a relation between [`LayerId`] and [`LayerDescription`].
#[derive(Resource, Debug, Default)]
pub struct LayerDescStore {
    map: HashMap<String, LayerDescription>,
    order: HashMap<String, usize>,
    next_index: usize,
}

impl LayerDescStore {
    pub fn new() -> Self {
        Default::default()
    }

    pub fn add(&mut self, layer_id: String, desc: LayerDescription) {
        let index = self.next_index;
        self.next_index += 1;
        self.order.insert(layer_id.clone(), index);
        self.map.insert(layer_id, desc);
    }

    pub fn update(&mut self, layer_id: String, desc: LayerDescription) {
        self.map.insert(layer_id, desc);
    }

    pub fn delete(&mut self, layer_id: &str) {
        self.order.remove(layer_id);
        self.map.remove(layer_id);
    }

    pub fn get(&self, layer_id: &str) -> Option<&LayerDescription> {
        self.map.get(layer_id)
    }

    pub fn get_order(&self, layer_id: &str) -> Option<&usize> {
        self.order.get(layer_id)
    }
}
