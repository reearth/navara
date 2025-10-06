use bevy_ecs::{component::Component, entity::Entity, prelude::Resource, system::Commands};

use navara_buffer_store::{BufferStore, Handle};
use navara_component::Deleted;
use rand::Rng;

use navara_parser::b3dm::BatchTable as B3dmBatchTable;
use std::collections::HashMap;

#[derive(Component, Debug, Default)]
pub struct BatchedFeature {
    pub features: Vec<Entity>,
    pub construct_polygon_feature: Option<Entity>,
    pub construct_polyline_feature: Option<Entity>,
}

impl BatchedFeature {
    #[allow(clippy::too_many_arguments)]
    pub fn despawn_recursively(&self, commands: &mut Commands) {
        for f in &self.features {
            if let Ok(mut e) = commands.get_entity(*f) {
                e.despawn();
            }
        }
        if let Some(e) = self.construct_polyline_feature {
            let _ = commands.get_entity(e).as_mut().map(|e| e.insert(Deleted));
        }
        if let Some(e) = self.construct_polygon_feature {
            let _ = commands.get_entity(e).as_mut().map(|e| e.insert(Deleted));
        }
    }
}

#[derive(Component, Debug)]
pub struct BatchId(pub f32);

/// This is used to retrieve batch's properties by index.
#[derive(Component, Debug, Clone)]
pub struct BatchIndex(pub u32);

// b3dm feature's batch id
#[derive(Component, Debug, Default)]
pub struct FeatureBatchId(pub u32);

// The global batch ID and the selection state corresponding to the internal batch ID in b3dm.
#[derive(Component, Default, Clone, Debug)]
pub struct GlobalBatchIds {
    pub handle: Handle,
    pub batch_length: u32,
}

// Search b3dm feature by global batch id
#[derive(Resource, Default, Debug)]
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
    ) -> bool {
        if let Some(ids) = self.get(key) {
            if let Some(global_ids) = buf.get_u32(&ids.handle) {
                // remove global batch ids from batch table
                for id in global_ids {
                    batch_table.remove(id);
                }
            }

            // remove global batch ids from buffer store
            buf.remove(&ids.handle);
            self.map.remove(key);
            return true;
        }
        false
    }
}

pub enum BatchProperty {
    Values(Vec<serde_json::Value>),
    Cesium3dTileset(B3dmBatchTable),
}

pub struct BatchTableValue {
    pub properties: Option<BatchProperty>,
}

impl BatchTableValue {
    pub fn empty() -> Self {
        Self { properties: None }
    }
}

#[derive(Resource)]
pub struct BatchTable {
    map: HashMap<u32, Option<BatchTableValue>>,
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
        let mut rng = rand::rng();
        let mut key = rng.random_range(1..0xffffff);
        let mut retry_count = 10;
        while self.map.contains_key(&key) && retry_count > 0 {
            key = rng.random_range(1..0xffffff);
            retry_count -= 1;
        }

        if retry_count > 0 {
            self.map.insert(key, value);
            Some(key)
        } else {
            None
        }
    }

    pub fn init_values(&mut self) -> Option<u32> {
        self.add(Some(BatchTableValue {
            properties: Some(BatchProperty::Values(vec![])),
        }))
    }

    pub fn add_values(&mut self, key: u32, props: serde_json::Value) {
        let Some(Some(table_value)) = self.map.get_mut(&key) else {
            return;
        };

        let Some(BatchProperty::Values(values)) = &mut table_value.properties else {
            return;
        };

        values.push(props)
    }

    pub fn get(&self, key: &u32) -> Option<&BatchTableValue> {
        self.map.get(key).and_then(|value| value.as_ref())
    }

    pub fn remove(&mut self, key: &u32) {
        self.map.remove(key);
    }
}
