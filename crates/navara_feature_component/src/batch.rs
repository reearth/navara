use bevy_ecs::{component::Component, entity::Entity, prelude::Resource, system::Commands};

use navara_buffer_store::{BufferStore, Handle};
use navara_component::Deleted;

use navara_parser::{b3dm::BatchTable as B3dmBatchTable, mvt::MvtLayerData};
use rustc_hash::FxHashMap;

use crate::unique_id::{UniqueFeatureId, UniqueGlobalBatchId, UniqueId};

#[derive(Component, Debug, Default)]
pub struct BatchedFeature {
    pub features: Vec<Entity>,
    pub construct_polygon_feature: Option<Entity>,
    pub construct_polyline_feature: Option<Entity>,
    /// Whether the feature should be active (visible) immediately when transferred.
    /// GeoJSON sets this to `true`; MVT tiles use `false` (activated by tile visibility).
    pub default_active: bool,
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
    pub map: FxHashMap<Entity, GlobalBatchIds>,
}

impl FeatureBatchIdMap {
    pub fn new() -> Self {
        Self {
            map: FxHashMap::default(),
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
    map: FxHashMap<u32, Option<BatchTableValue>>,
    unique_feature_batch_id: UniqueFeatureId,
    unique_global_batch_id: UniqueGlobalBatchId,
}

impl Default for BatchTable {
    fn default() -> Self {
        Self::new()
    }
}

impl BatchTable {
    pub fn new() -> Self {
        Self {
            map: FxHashMap::default(),
            unique_feature_batch_id: UniqueFeatureId::new(),
            unique_global_batch_id: UniqueGlobalBatchId::new(),
        }
    }

    pub fn len(&self) -> usize {
        self.map.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() > 0
    }

    /// Store the feature property to `map`.
    pub fn add(&mut self, value: Option<BatchTableValue>) -> Option<u32> {
        let key = self.unique_feature_batch_id.get()?;
        self.map.insert(key, value);
        Some(key)
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

    pub fn gen_global_batch_id(&mut self) -> Option<u32> {
        let key = self.unique_global_batch_id.get()?;

        Some(key)
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
