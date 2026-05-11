use bevy_ecs::entity::Entity;
use navara_buffer_store::BufferStore;
use navara_feature_component::{
    batch::{BatchProperty, BatchTable, GlobalBatchIds},
    render::RenderableFeature,
};
use navara_property::{PropertyValue, json_value_to_filtered_properties, json_value_to_property};

use crate::App;

pub enum BatchProperties<V> {
    All(Option<V>),
    Filtered(Option<Vec<Option<V>>>),
}

impl App {
    /// Generate a new unique global batch id for picking.
    /// The returned id is in the range 1..0xffffff (24-bit RGB color range).
    pub fn gen_global_batch_id(&mut self) -> Option<u32> {
        let mut batch_table = self.app.world_mut().get_resource_mut::<BatchTable>()?;
        batch_table.gen_global_batch_id()
    }

    /// Get properties by a specified global batch id
    pub fn read_property_by_global_batch_id<V: PropertyValue>(
        &mut self,
        batch_id: &u32,
    ) -> (Option<V>, Option<String>) {
        // For batched features like MVT(polygon, polyline) and Cesium 3D Tiles.
        if let Some((entity, in_batch_id)) = self.search_feature_entity_by_global_batch_id(batch_id)
        {
            return self
                .read_batch_table_by_global_batch_id(entity, &in_batch_id)
                .map(|(properties, layer_id)| (Some(properties), Some(layer_id)))
                .unwrap_or((None, None));
        };

        // For other features like GeoJSON and MVT point
        let batch_table = match self.app.world().get_resource::<BatchTable>() {
            Some(bt) => bt,
            None => return (None, None),
        };

        let batch_value = match batch_table.get(batch_id) {
            Some(bv) => bv,
            None => return (None, None),
        };

        let layer_id = batch_value.layer_id.clone();

        let Some(BatchProperty::Values(values)) = &batch_value.properties else {
            return (None, layer_id);
        };
        // This should include only one batch.
        let properties: Option<V> = json_value_to_property(&values[0]);

        (properties, layer_id)
    }

    fn read_batch_table_by_global_batch_id<V: PropertyValue>(
        &mut self,
        entity: Entity,
        in_batch_id: &usize,
    ) -> Option<(V, String)> {
        let world = self.app.world_mut();
        let mut query = world.query::<&RenderableFeature>();

        let batch_table = world.get_resource::<BatchTable>()?;

        let renderable_feature = query.get(world, entity).ok()?;

        let feature_batch_id = match renderable_feature {
            RenderableFeature::Model {
                feature_batch_id, ..
            }
            | RenderableFeature::Polyline {
                feature_batch_id, ..
            }
            | RenderableFeature::Polygon {
                feature_batch_id, ..
            }
            | RenderableFeature::Point {
                feature_batch_id, ..
            }
            | RenderableFeature::Billboard {
                feature_batch_id, ..
            }
            | RenderableFeature::Text {
                feature_batch_id, ..
            } => *feature_batch_id,
            RenderableFeature::Unknown => return None,
        };

        let buf_store = world.get_resource::<BufferStore>()?;
        let batch_value = batch_table.get(&feature_batch_id)?;
        let batch_prop = batch_value.properties.as_ref()?;

        let properties = match batch_prop {
            BatchProperty::Cesium3dTileset(in_batch_table) => {
                let batch_table_json = in_batch_table.json().ok()?;
                in_batch_table.get_property(&batch_table_json, *in_batch_id)
            }
            BatchProperty::Values(values) => json_value_to_property(values.get(*in_batch_id)?),
            BatchProperty::Mvt(mvt_layer_data) => mvt_layer_data.get_properties(*in_batch_id),
            BatchProperty::Cesium3dTilesetV11(gltf_table) => {
                gltf_table.get_properties(*in_batch_id, buf_store)
            }
        }?;

        Some((properties, batch_value.layer_id.clone()?))
    }

    /// Read properties from a batched feature.
    /// The batched feature contains a lot of feature, so [`callback`] will be invoked to each feature's property.
    pub fn read_all_batched_properties<
        V: PropertyValue,
        E,
        F: Fn(usize, u32, BatchProperties<V>) -> Result<(), E>,
    >(
        &mut self,
        renderable_feature_bits: u64,
        keys: Option<&[String]>,
        callback: &F,
    ) -> Result<Option<()>, E> {
        let renderable_feature_entity = Entity::from_bits(renderable_feature_bits);

        self.read_batch_table::<V, E, F>(renderable_feature_entity, keys, callback)
    }

    fn read_batch_table<
        V: PropertyValue,
        E,
        F: Fn(usize, u32, BatchProperties<V>) -> Result<(), E>,
    >(
        &mut self,
        renderable_feature_entity: Entity,
        keys: Option<&[String]>,
        callback: &F,
    ) -> Result<Option<()>, E> {
        let world = self.app.world_mut();
        let mut query = world.query::<&RenderableFeature>();

        let Some(batch_table) = world.get_resource::<BatchTable>() else {
            return Ok(None);
        };

        let Ok(renderable_feature) = query.get(world, renderable_feature_entity) else {
            return Ok(None);
        };

        let (feature_batch_id, global_batch_ids_entity, model_batch_length) =
            match renderable_feature {
                RenderableFeature::Model {
                    feature_batch_id,
                    batch_length,
                    feature_id,
                    ..
                }
                | RenderableFeature::Point {
                    feature_batch_id,
                    batch_length,
                    feature_id,
                    ..
                }
                | RenderableFeature::Billboard {
                    feature_batch_id,
                    batch_length,
                    feature_id,
                    ..
                }
                | RenderableFeature::Text {
                    feature_batch_id,
                    batch_length,
                    feature_id,
                    ..
                }
                | RenderableFeature::Polygon {
                    feature_batch_id,
                    batch_length,
                    feature_id,
                    ..
                }
                | RenderableFeature::Polyline {
                    feature_batch_id,
                    batch_length,
                    feature_id,
                    ..
                } => (*feature_batch_id, *feature_id, Some(*batch_length as usize)),
                RenderableFeature::Unknown => return Ok(Some(())),
            };

        let Some(batch_value) = batch_table.get(&feature_batch_id) else {
            return Ok(None);
        };
        let Some(batch_prop) = batch_value.properties.as_ref() else {
            return Ok(None);
        };

        let global_batch_ids_opt = world
            .get_entity(global_batch_ids_entity)
            .ok()
            .and_then(|e| e.get::<GlobalBatchIds>());

        let global_batch_id_array = global_batch_ids_opt.and_then(|ids| {
            world
                .get_resource::<BufferStore>()
                .and_then(|store| store.get_u32(&ids.handle).map(|arr| arr.to_vec()))
        });

        match batch_prop {
            BatchProperty::Cesium3dTileset(in_batch_table) => {
                let Some(batch_length) = model_batch_length else {
                    return Ok(Some(()));
                };

                match keys {
                    None => {
                        let Some(batch_table_json) = in_batch_table.json().ok() else {
                            return Ok(None);
                        };
                        for batch_idx in 0..batch_length {
                            let props = in_batch_table.get_property(&batch_table_json, batch_idx);
                            let global_batch_id = global_batch_id_array
                                .as_ref()
                                .and_then(|arr| arr.get(batch_idx).copied())
                                .unwrap_or(batch_idx as u32);
                            callback(batch_idx, global_batch_id, BatchProperties::All(props))?;
                        }
                    }
                    Some(keys) => {
                        let Some(batch_table_json) = in_batch_table.json_filtered(keys).ok() else {
                            return Ok(None);
                        };
                        for batch_idx in 0..batch_length {
                            let props = in_batch_table.get_filtered_properties(
                                &batch_table_json,
                                batch_idx,
                                keys,
                            );
                            let global_batch_id = global_batch_id_array
                                .as_ref()
                                .and_then(|arr| arr.get(batch_idx).copied())
                                .unwrap_or(batch_idx as u32);
                            callback(batch_idx, global_batch_id, BatchProperties::Filtered(props))?;
                        }
                    }
                }
            }
            BatchProperty::Cesium3dTilesetV11(gltf_table) => {
                let Some(batch_length) = model_batch_length else {
                    return Ok(Some(()));
                };

                let binary = world
                    .get_resource::<BufferStore>()
                    .and_then(|bs| gltf_table.resolve_binary(bs));

                match keys {
                    None => {
                        for batch_idx in 0..batch_length {
                            let props: Option<V> =
                                binary.and_then(|b| gltf_table.table.get_properties(batch_idx, b));
                            let global_batch_id = global_batch_id_array
                                .as_ref()
                                .and_then(|arr| arr.get(batch_idx).copied())
                                .unwrap_or(batch_idx as u32);
                            callback(batch_idx, global_batch_id, BatchProperties::All(props))?;
                        }
                    }
                    Some(keys) => {
                        for batch_idx in 0..batch_length {
                            let props = binary.and_then(|b| {
                                gltf_table
                                    .table
                                    .get_filtered_properties::<V>(batch_idx, keys, b)
                            });
                            let global_batch_id = global_batch_id_array
                                .as_ref()
                                .and_then(|arr| arr.get(batch_idx).copied())
                                .unwrap_or(batch_idx as u32);
                            callback(batch_idx, global_batch_id, BatchProperties::Filtered(props))?;
                        }
                    }
                }
            }
            BatchProperty::Values(values) => {
                for (batch_idx, value) in values.iter().enumerate() {
                    let global_batch_id = global_batch_id_array
                        .as_ref()
                        .and_then(|arr| arr.get(batch_idx).copied())
                        .unwrap_or(feature_batch_id);
                    match keys {
                        None => {
                            let props: Option<V> = json_value_to_property(value);
                            callback(batch_idx, global_batch_id, BatchProperties::All(props))?;
                        }
                        Some(keys) => {
                            let props = json_value_to_filtered_properties::<V>(value, keys);
                            callback(batch_idx, global_batch_id, BatchProperties::Filtered(props))?;
                        }
                    }
                }
            }
            BatchProperty::Mvt(mvt_layer_data) => {
                for batch_idx in 0..mvt_layer_data.feature_tags.len() {
                    let global_batch_id = global_batch_id_array
                        .as_ref()
                        .and_then(|arr| arr.get(batch_idx).copied())
                        .unwrap_or(feature_batch_id);
                    match keys {
                        None => {
                            let props: Option<V> = mvt_layer_data.get_properties(batch_idx);
                            callback(batch_idx, global_batch_id, BatchProperties::All(props))?;
                        }
                        Some(keys) => {
                            let props =
                                mvt_layer_data.get_filtered_properties::<V>(batch_idx, keys);
                            callback(batch_idx, global_batch_id, BatchProperties::Filtered(props))?;
                        }
                    }
                }
            }
        }

        Ok(Some(()))
    }
}
