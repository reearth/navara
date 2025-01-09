use bevy_ecs::{
    component::Component,
    entity::Entity,
    system::{Commands, Query, Resource},
};

use navara_buffer_store::BufferStore;
use navara_component::Deleted;

use crate::{id::FeatureId, render::RenderableFeature};

use rand::Rng;
use serde::Serialize;
use std::collections::HashMap;

#[derive(Component, Debug, Default)]
pub struct BatchedFeature {
    pub features: Vec<Entity>,
    pub construct_polygon_feature: Option<Entity>,
    pub construct_polyline_feature: Option<Entity>,
}

impl BatchedFeature {
    pub fn despawn_recursively(
        &self,
        commands: &mut Commands,
        buf: &mut BufferStore,
        batch_table: &mut BatchTable,
        features: &Query<&FeatureId>,
        batch_id: &Query<&BatchId>,
        renderable_features: &mut Query<&mut RenderableFeature>,
    ) -> Vec<Entity> {
        let mut removed = vec![];
        for f in &self.features {
            if let Some(rendered_feature_id) = features.get(*f).ok().and_then(|f| f.0) {
                if let Ok(mut feature) = renderable_features.get_mut(rendered_feature_id) {
                    feature.destroy(buf);
                }
                commands.entity(rendered_feature_id).despawn();
                removed.push(rendered_feature_id);
            }
            if let Some(mut e) = commands.get_entity(*f) {
                if let Ok(batchid) = batch_id.get(*f) {
                    batch_table.remove(&batchid.0);
                }
                e.despawn();
            }
        }
        if let Some(e) = self.construct_polyline_feature {
            commands.get_entity(e).as_mut().map(|e| e.insert(Deleted));
        }
        if let Some(e) = self.construct_polygon_feature {
            commands.get_entity(e).as_mut().map(|e| e.insert(Deleted));
        }
        removed
    }
}

#[derive(Component, Debug)]
pub struct BatchId(pub u32);

#[derive(Resource, Debug)]
pub struct BatchTable {
    map: HashMap<u32, String>,
}

impl Default for BatchTable {
    fn default() -> Self {
        Self::new()
    }
}

impl BatchTable {
    pub fn new() -> Self {
        Self {
            map: HashMap::new(),
        }
    }

    pub fn add(&mut self, value: String) -> Option<u32> {
        let mut rng = rand::thread_rng();
        let mut key = rng.gen_range(1..0xffffff);

        let mut retry_count = 10;
        while self.map.contains_key(&key) && retry_count > 0 {
            key = rng.gen_range(1..0xffffff);
            retry_count -= 1;
        }

        if retry_count > 0 {
            self.map.insert(key, value);
            Some(key)
        } else {
            None
        }
    }

    pub fn add_hash_map<T: Serialize>(&mut self, prop: &T) -> Option<u32> {
        let props = serde_json::to_string(prop).unwrap_or("{}".to_string());
        self.add(props)
    }

    pub fn get(&self, key: &u32) -> Option<&String> {
        self.map.get(key)
    }

    pub fn remove(&mut self, key: &u32) {
        self.map.remove(key);
    }
}
