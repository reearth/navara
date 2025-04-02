use bevy_ecs::{
    component::Component,
    entity::Entity,
    system::{Commands, Query, Resource},
};

use navara_buffer_store::{BufferStore, Handle};
use navara_component::Deleted;
use navara_math::Vec2;

use crate::id::FeatureId;

use navara_parser::b3dm::BatchTable as B3dmBatchTable;
use std::collections::{HashMap, HashSet};

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
        features: &Query<&FeatureId>,
    ) -> Vec<Entity> {
        let mut removed = vec![];
        for f in &self.features {
            if let Some(rendered_feature_id) = features.get(*f).ok().and_then(|f| f.0) {
                commands.entity(rendered_feature_id).insert(Deleted);
                removed.push(rendered_feature_id);
            }
            if let Some(mut e) = commands.get_entity(*f) {
                e.insert(Deleted);
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
pub struct BatchId(pub Vec2);

/// This is used to retrieve batch's properties by index.
#[derive(Component, Debug, Clone)]
pub struct BatchIndex(pub u32);

// b3dm feature's batch id
#[derive(Component, Debug, Default)]
pub struct FeatureBatchId(pub u32);

// The global batch ID and the selection state corresponding to the internal batch ID in b3dm.
#[derive(Component, Default, Clone, Debug)]
pub struct GlobalBatchIdAndSelections(pub Handle);

// Search b3dm feature by global batch id
#[derive(Resource, Default)]
pub struct FeatureBatchIdMap {
    pub map: HashMap<Entity, GlobalBatchIdAndSelections>,
}

impl FeatureBatchIdMap {
    pub fn new() -> Self {
        Self {
            map: HashMap::new(),
        }
    }

    pub fn add(&mut self, key: Entity, ids: GlobalBatchIdAndSelections) {
        self.map.insert(key, ids);
    }
    pub fn get(&self, key: &Entity) -> Option<&GlobalBatchIdAndSelections> {
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
    Values(Vec<serde_json::Value>),
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
    map: HashMap<u32, Option<BatchTableValue>>,
    handle: u32,
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
            handle: 0,
        }
    }

    pub fn add(&mut self, value: Option<BatchTableValue>) -> Option<u32> {
        let handle = self.handle;

        self.handle += 1;

        self.map.insert(handle, value);
        Some(handle)
    }

    pub fn add_id_prop(
        &mut self,
        id_prop: Option<String>,
        value: &serde_json::Value,
        id_prop_table: &mut IdPropertyTable,
    ) -> Option<u32> {
        let id_property_value = id_prop.and_then(|id_prop| value.get(id_prop)).cloned();
        let batch_id = self.add(Some(BatchTableValue {
            id_property_value: id_property_value.clone(),
            properties: None,
        }));

        // Next: Remove this
        if let Some(b_id) = batch_id {
            if let Some(id_property_value) = id_property_value {
                id_prop_table.add(id_property_value, b_id);
            }
        }

        batch_id
    }

    pub fn init_values(&mut self) -> Option<u32> {
        self.add(Some(BatchTableValue {
            id_property_value: None,
            properties: Some(BatchProperty::Values(vec![])),
        }))
    }

    pub fn init_values_with_id_props(
        &mut self,
        id_prop: Option<String>,
        value: serde_json::Value,
        id_prop_table: &mut IdPropertyTable,
    ) -> Option<u32> {
        let id_property_value = id_prop.and_then(|id_prop| value.get(id_prop)).cloned();
        let batch_id = self.add(Some(BatchTableValue {
            id_property_value: id_property_value.clone(),
            properties: Some(BatchProperty::Values(vec![value])),
        }));

        // Next: Remove this
        if let Some(b_id) = batch_id {
            if let Some(id_property_value) = id_property_value {
                id_prop_table.add(id_property_value, b_id);
            }
        }

        batch_id
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

    pub fn get_selection(&self, key: &u32, id_prop_sel_res: &IdPropertySelections) -> u32 {
        if let Some(value) = self.get(key) {
            if let Some(id_prop_val) = &value.id_property_value {
                return id_prop_sel_res.get_selection(id_prop_val);
            }
        }
        0
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
    map: HashMap<serde_json::Value, Vec<u32>>,
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

// store the selected id property values
#[derive(Resource)]
pub struct IdPropertySelections {
    set: HashSet<serde_json::Value>,
}

impl Default for IdPropertySelections {
    fn default() -> Self {
        Self::new()
    }
}

impl IdPropertySelections {
    pub fn new() -> Self {
        Self {
            set: HashSet::new(),
        }
    }

    pub fn add(&mut self, key: serde_json::Value) {
        self.set.insert(key);
    }

    pub fn get_selection(&self, key: &serde_json::Value) -> u32 {
        if self.set.contains(key) {
            1
        } else {
            0
        }
    }

    pub fn clear(&mut self) {
        self.set.clear();
    }
}
