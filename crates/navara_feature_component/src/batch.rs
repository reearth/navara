use bevy_ecs::{component::Component, entity::Entity, prelude::Resource, system::Commands};
use geozero::mvt::tile;

use navara_buffer_store::{BufferStore, Handle};
use navara_component::Deleted;
use rand::Rng;

use navara_parser::b3dm::BatchTable as B3dmBatchTable;
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Component, Debug, Default)]
pub struct BatchedFeature {
    pub features: Vec<Entity>,
    pub construct_polygon_feature: Option<Entity>,
    pub construct_polyline_feature: Option<Entity>,
}

impl BatchedFeature {
    /// Marks all child feature entities as `Deleted` for cleanup by dedicated systems.
    ///
    /// This method does NOT directly despawn entities because child entities may hold
    /// BufferStore handles (e.g., `PolylineGeometry.coords`, `PolygonGeometry.hierarchy`)
    /// that must be properly removed before despawning to avoid memory leaks.
    ///
    /// Cleanup systems will:
    /// 1. Query for entities with geometry components and `Deleted` marker
    /// 2. Remove buffer handles via `remove_from_buf` methods
    /// 3. Despawn the entities
    #[allow(clippy::too_many_arguments)]
    pub fn despawn_recursively(&self, commands: &mut Commands) {
        for f in &self.features {
            if let Ok(mut e) = commands.get_entity(*f) {
                e.insert(Deleted);
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

/// Raw MVT layer data for lazy property parsing.
/// Properties are only parsed when accessed via `get_property`.
#[derive(Debug, Clone)]
pub struct MvtLayerData {
    /// Property key names (shared across all features in the layer)
    pub keys: Arc<Vec<String>>,
    /// Property values (shared across all features in the layer) - raw MVT format for lazy conversion
    pub values: Arc<Vec<tile::Value>>,
    /// Per-feature tags: pairs of (key_index, value_index) into keys and values
    pub feature_tags: Vec<Vec<u32>>,
}

/// A single MVT property value (mirrors protobuf tile::Value)
#[derive(Debug, Clone)]
pub enum MvtValue {
    String(String),
    Float(f32),
    Double(f64),
    Int(i64),
    UInt(u64),
    SInt(i64),
    Bool(bool),
}

impl MvtValue {
    pub fn to_json(&self) -> serde_json::Value {
        match self {
            MvtValue::String(s) => serde_json::Value::String(s.clone()),
            MvtValue::Float(f) => serde_json::json!(*f),
            MvtValue::Double(d) => serde_json::json!(*d),
            MvtValue::Int(i) => serde_json::json!(*i),
            MvtValue::UInt(u) => serde_json::json!(*u),
            MvtValue::SInt(i) => serde_json::json!(*i),
            MvtValue::Bool(b) => serde_json::Value::Bool(*b),
        }
    }
}

/// Convert raw MVT tile::Value to serde_json::Value
fn tile_value_to_json(value: &tile::Value) -> serde_json::Value {
    if let Some(s) = &value.string_value {
        serde_json::Value::String(s.clone())
    } else if let Some(f) = value.float_value {
        serde_json::json!(f)
    } else if let Some(d) = value.double_value {
        serde_json::json!(d)
    } else if let Some(i) = value.int_value {
        serde_json::json!(i)
    } else if let Some(u) = value.uint_value {
        serde_json::json!(u)
    } else if let Some(i) = value.sint_value {
        serde_json::json!(i)
    } else if let Some(b) = value.bool_value {
        serde_json::Value::Bool(b)
    } else {
        serde_json::Value::Null
    }
}

impl MvtLayerData {
    /// Get properties for a specific feature index as JSON.
    /// Properties are converted lazily from raw MVT format.
    pub fn get_properties(&self, feature_index: usize) -> Option<serde_json::Value> {
        let tags = self.feature_tags.get(feature_index)?;
        let mut props = serde_json::Map::new();

        for pair in tags.chunks(2) {
            if let [key_idx, value_idx] = pair {
                let key = self.keys.get(*key_idx as usize)?;
                let value = self.values.get(*value_idx as usize)?;
                props.insert(key.clone(), tile_value_to_json(value));
            }
        }

        Some(serde_json::Value::Object(props))
    }
}

pub enum BatchProperty {
    Values(Vec<serde_json::Value>),
    Cesium3dTileset(B3dmBatchTable),
    /// Lazy MVT properties - parsed on demand
    Mvt(MvtLayerData),
}

pub struct BatchTableValue {
    pub properties: Option<BatchProperty>,
    pub layer_id: Option<String>,
}

impl BatchTableValue {
    pub fn empty() -> Self {
        Self {
            properties: None,
            layer_id: None,
        }
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

    pub fn init_values(&mut self, layer_id: Option<String>) -> Option<u32> {
        self.add(Some(BatchTableValue {
            properties: Some(BatchProperty::Values(vec![])),
            layer_id,
        }))
    }

    /// Initialize with lazy MVT property storage.
    /// Properties are not parsed until accessed.
    pub fn init_mvt(&mut self, layer_id: Option<String>, mvt_data: MvtLayerData) -> Option<u32> {
        self.add(Some(BatchTableValue {
            properties: Some(BatchProperty::Mvt(mvt_data)),
            layer_id,
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

    /// Add a feature's tags to the MVT batch property.
    /// Only applicable when the batch was initialized with `init_mvt`.
    pub fn add_mvt_feature_tags(&mut self, key: u32, tags: Vec<u32>) {
        let Some(Some(table_value)) = self.map.get_mut(&key) else {
            return;
        };

        let Some(BatchProperty::Mvt(mvt_data)) = &mut table_value.properties else {
            return;
        };

        mvt_data.feature_tags.push(tags);
    }

    pub fn get(&self, key: &u32) -> Option<&BatchTableValue> {
        self.map.get(key).and_then(|value| value.as_ref())
    }

    pub fn remove(&mut self, key: &u32) {
        self.map.remove(key);
    }
}
