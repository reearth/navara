use bevy_ecs::{
    component::Component,
    entity::Entity,
    system::{Commands, Query, Resource},
};

use navara_buffer_store::{BufferStore, Handle};
use navara_component::Deleted;

use crate::{id::FeatureId, render::RenderableFeature};

use navara_parser::b3dm::BatchTable as B3dmBatchTable;
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
    #[allow(clippy::too_many_arguments)]
    pub fn despawn_recursively(
        &self,
        commands: &mut Commands,
        buf: &mut BufferStore,
        batch_table: &mut BatchTable,
        id_prop_table: &mut IdPropertyTable,
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
                    batch_table.remove(&batchid.0, id_prop_table);
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

// b3dm feature's batch id
#[derive(Component, Debug)]
pub struct FeatureBatchId(pub u32);

// The global batch ID corresponding to the internal batch ID in b3dm.
#[derive(Component, Default, Clone, Debug)]
pub struct GlobalBatchIds(pub Handle);

// Search b3dm feature by global batch id
#[derive(Resource, Default)]
pub struct FeatureBatchIdMap {
    pub map: HashMap<Entity, GlobalBatchIds>,
}

impl FeatureBatchIdMap {
    pub fn new() -> Self {
        Self {
            map: HashMap::new(),
        }
    }

    pub fn add(&mut self, key: Entity, ids: GlobalBatchIds) {
        self.map.insert(key, ids);
    }
    pub fn get(&self, key: &Entity) -> Option<&GlobalBatchIds> {
        self.map.get(key)
    }
    pub fn remove(
        &mut self,
        key: &Entity,
        buf: &mut BufferStore,
        batch_table: &mut BatchTable,
        id_prop_table: &mut IdPropertyTable,
    ) -> bool {
        if let Some(ids) = self.get(key) {
            if let Some(global_ids) = buf.get_u32(&ids.0) {
                // remove global batch ids from batch table
                for id in global_ids {
                    batch_table.remove(id, id_prop_table);
                }
            }

            // remove global batch ids from buffer store
            buf.remove(&ids.0);
            self.map.remove(key);
            return true;
        }
        false
    }
}

pub enum BatchProperty {
    StringObj(String),
    Cesium3dTileset(B3dmBatchTable),
}

pub struct BatchTableValue {
    pub id_property_value: Option<serde_json::Value>,
    pub properties: Option<BatchProperty>,
}

impl BatchTableValue {
    pub fn empty() -> Self {
        Self {
            id_property_value: None,
            properties: None,
        }
    }
}

#[derive(Resource)]
pub struct BatchTable {
    pub map: HashMap<u32, Option<BatchTableValue>>,
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

    pub fn add(&mut self, value: Option<BatchTableValue>) -> Option<u32> {
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

    pub fn add_hash_map<T: Serialize>(
        &mut self,
        id_prop: Option<String>,
        prop: Option<&T>,
        id_prop_table: &mut IdPropertyTable,
    ) -> Option<u32> {
        let Some(prop) = prop else {
            return self.add(Some(BatchTableValue::empty()));
        };

        let props = serde_json::to_string(prop).unwrap_or("{}".to_string());

        if let Some(ref key) = id_prop {
            if !key.is_empty() {
                if let Ok(value) = serde_json::to_value(prop) {
                    let id_prop_value = value.get(key);
                    if id_prop_value.is_some() {
                        let batch_id = self.add(Some(BatchTableValue {
                            id_property_value: id_prop_value.cloned(),
                            properties: Some(BatchProperty::StringObj(props)),
                        }));

                        if let Some(b_id) = batch_id {
                            id_prop_table.add(id_prop_value.unwrap().clone(), b_id);
                        }

                        return batch_id;
                    }
                }
            }
        };

        self.add(Some(BatchTableValue {
            id_property_value: None,
            properties: Some(BatchProperty::StringObj(props)),
        }))
    }

    pub fn get(&self, key: &u32) -> Option<&BatchTableValue> {
        self.map.get(key).and_then(|value| value.as_ref())
    }

    pub fn remove(&mut self, key: &u32, id_prop_table: &mut IdPropertyTable) {
        if let Some(value) = self.get(key) {
            if let Some(id_prop_value) = &value.id_property_value {
                id_prop_table.remove(id_prop_value, *key);
            }
        }

        self.map.remove(key);
    }
}

#[derive(Resource)]
pub struct IdPropertyTable {
    // store the mapping of id property value to global batch ids
    pub map: HashMap<serde_json::Value, Vec<u32>>,
}

impl Default for IdPropertyTable {
    fn default() -> Self {
        Self::new()
    }
}

impl IdPropertyTable {
    pub fn new() -> Self {
        Self {
            map: HashMap::new(),
        }
    }

    pub fn add(&mut self, key: serde_json::Value, value: u32) {
        self.map.entry(key).or_default().push(value);
    }

    pub fn get(&self, key: &serde_json::Value) -> Option<&Vec<u32>> {
        self.map.get(key)
    }

    pub fn remove(&mut self, key: &serde_json::Value, value: u32) {
        if let Some(ids) = self.map.get_mut(key) {
            ids.retain(|&x| x != value);
            if ids.is_empty() {
                self.map.remove(key);
            }
        }
    }
}
