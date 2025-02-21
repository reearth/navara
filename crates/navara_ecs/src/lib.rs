#![doc = include_str!("../README.md")]

use bevy_ecs::{
    entity::Entity,
    query::Without,
    world::{EntityRef, Mut},
};
use navara_buffer_store::{BufferStore, Handle};
use navara_component::{Deleted, Rendered};
use navara_core::ElevationDecoder;
use navara_data_requester::DataRequester;
use navara_event::Events;
use navara_feature_component::{
    batch::{
        BatchProperty, BatchTable, BatchedFeature, FeatureBatchIdMap, IdPropertySelections,
        IdPropertyTable,
    },
    render::RenderableFeature,
};
use navara_frame::FrameManager;
use navara_layer::{LayerDescStore, LayerDescription, LayerId};
use navara_math::FloatType;
use navara_parser::b3dm::BatchTable as B3dmBatchTable;
use navara_texture_fragment::{TextureFragmentLoadedEvent, TextureFragmentStatus};
use navara_tile_component::{MartiniComponent, RasterTile, RasterTileQuadtree, TileHandle};
use navara_window::{Window, WindowResizeEvent};
use navara_worker::{
    DelegatedWorkerTasksResult, WorkerTaskCompleted, WorkerTaskCompletedEvent, WorkerTaskMarker,
};

mod app;

pub struct App {
    app: bevy_app::App,
    win: bevy_ecs::entity::Entity,
}

impl App {
    pub fn new() -> Self {
        let mut app = bevy_app::App::new();

        app.add_plugins(app::Plugin);

        let win = app.world_mut().spawn_empty().id();

        Self { app, win }
    }

    pub fn update(&mut self, updated_at: f64) {
        self.set_updated_at(updated_at);
        self.app.update();
    }

    fn set_updated_at(&mut self, at: f64) {
        let Some(mut m) = self.app.world_mut().get_resource_mut::<FrameManager>() else {
            return;
        };
        m.set_updated_at(at);
    }

    pub fn trigger_event(&mut self, ev: navara_input::Input) {
        navara_input::trigger_event(self.app.world_mut(), self.win, ev);
    }

    pub fn read_events(&mut self) -> Option<Events> {
        let ev = self
            .app
            .world()
            .get_resource::<navara_event_store::EventStore>()?;
        Events::from_event_store(self.app.world(), ev)
    }

    pub fn get_buffer_u8(&self, handle: i32) -> Option<&[u8]> {
        let store = self.app.world().get_resource::<BufferStore>()?;
        store.get_u8(&handle)
    }

    pub fn get_buffer_u32(&self, handle: i32) -> Option<&[u32]> {
        let store = self.app.world().get_resource::<BufferStore>()?;
        store.get_u32(&handle)
    }

    pub fn get_buffer_f32(&self, handle: i32) -> Option<&[FloatType]> {
        let store = self.app.world().get_resource::<BufferStore>()?;
        store.get_f32(&handle)
    }

    pub fn set_buffer_u8(&mut self, handle: i32, bits: u64, data: Vec<u8>) {
        let Some(mut store) = self.app.world_mut().get_resource_mut::<BufferStore>() else {
            return;
        };
        store.set_u8(handle, data);

        // TODO: This is only for DataRequester, so curve out this function.
        self.app
            .world_mut()
            .send_event(navara_buffer_store::BufferStoreLoadedEvent {
                id: Entity::from_bits(bits),
                ty: navara_buffer_store::BufferType::U8,
                handle,
            });
    }

    pub fn new_buffer_u8(&mut self, data: Vec<u8>) -> Option<Handle> {
        let mut store = self.app.world_mut().get_resource_mut::<BufferStore>()?;
        Some(store.new_u8(data))
    }

    pub fn new_buffer_u32(&mut self, data: Vec<u32>) -> Option<Handle> {
        let mut store = self.app.world_mut().get_resource_mut::<BufferStore>()?;
        Some(store.new_u32(data))
    }

    pub fn new_buffer_f32(&mut self, data: Vec<f32>) -> Option<Handle> {
        let mut store = self.app.world_mut().get_resource_mut::<BufferStore>()?;
        Some(store.new_f32(data))
    }

    pub fn remove_buffer(&mut self, handle: i32) {
        let Some(mut store) = self.app.world_mut().get_resource_mut::<BufferStore>() else {
            return;
        };
        store.remove(&handle);
    }

    pub fn set_tile_mesh_prepared(&mut self, handle: TileHandle) {
        self.app
            .world_mut()
            .send_event(navara_tile::tile::MeshPreparedEvent {
                tile_handle: handle,
            });
    }

    pub fn mark_point_is_rendered(&mut self, bits: u64) {
        let entity = Entity::from_bits(bits);
        let world = self.app.world_mut();
        let mut query = world.query::<&mut RenderableFeature>();

        let Ok(mut feature) = query.get_mut(world, entity) else {
            return;
        };
        let render_info = match feature.as_mut() {
            RenderableFeature::Point { render_info, .. } => render_info,
            RenderableFeature::Billboard { render_info, .. } => render_info,
            _ => unreachable!("Unexpected RenderableFeature type"),
        };
        render_info.is_rendered = true;
        world.commands().entity(entity).insert(Rendered);
    }

    pub fn mark_polyline_is_rendered(&mut self, bits: u64) {
        let entity = Entity::from_bits(bits);
        let world = self.app.world_mut();
        let mut query = world.query::<&mut RenderableFeature>();

        let Ok(mut feature) = query.get_mut(world, entity) else {
            return;
        };
        let RenderableFeature::Polyline { render_info, .. } = feature.as_mut() else {
            unreachable!("Unexpected RenderableFeature type");
        };
        render_info.is_rendered = true;
        world.commands().entity(entity).insert(Rendered);
    }

    pub fn mark_polygon_is_rendered(&mut self, bits: u64) {
        let entity = Entity::from_bits(bits);
        let world = self.app.world_mut();
        let mut query = world.query::<&mut RenderableFeature>();

        let Ok(mut feature) = query.get_mut(world, entity) else {
            return;
        };
        let RenderableFeature::Polygon { render_info, .. } = feature.as_mut() else {
            unreachable!("Unexpected RenderableFeature type");
        };
        render_info.is_rendered = true;
        world.commands().entity(entity).insert(Rendered);
    }

    pub fn mark_model_is_rendered(&mut self, bits: u64) {
        let entity = Entity::from_bits(bits);
        let world = self.app.world_mut();
        let mut query = world.query::<&mut RenderableFeature>();

        let Ok(mut feature) = query.get_mut(world, entity) else {
            return;
        };
        let RenderableFeature::Model { render_info, .. } = feature.as_mut() else {
            unreachable!("Unexpected RenderableFeature type");
        };
        render_info.is_rendered = true;
        world.commands().entity(entity).insert(Rendered);
    }

    pub fn trigger_data_requester_failed(&mut self, bits: u64) {
        self.app
            .world_mut()
            .send_event(navara_buffer_store::BufferStoreFailedEvent {
                id: Entity::from_bits(bits),
            });
    }

    pub fn resize(&mut self, width: FloatType, height: FloatType, pixel_ratio: FloatType) {
        let Some(mut window_res) = self.app.world_mut().get_resource_mut::<Window>() else {
            return;
        };

        window_res.height = height * pixel_ratio;
        window_res.width = width * pixel_ratio;
        window_res.pixel_ratio = pixel_ratio;

        self.app.world_mut().send_event(WindowResizeEvent {
            width,
            height,
            pixel_ratio,
        });
    }

    pub fn trigger_texture_fragment_loaded(&mut self, bits: u64, status: TextureFragmentStatus) {
        self.app.world_mut().send_event(TextureFragmentLoadedEvent {
            id: Entity::from_bits(bits),
            status,
        });
    }

    pub fn trigger_worker_task_completed(&mut self, bits: u64, result: DelegatedWorkerTasksResult) {
        self.app.world_mut().send_event(WorkerTaskCompletedEvent {
            parameters_id: Entity::from_bits(bits),
            result,
        });
    }

    pub fn add_layer(&mut self, layer_id: &str, desc: LayerDescription) {
        if let Some(mut layer_desc_store) =
            self.app.world_mut().get_resource_mut::<LayerDescStore>()
        {
            layer_desc_store
                .map
                .insert(layer_id.to_owned(), desc.clone());
        }

        self.app
            .world_mut()
            .send_event(navara_layer_event::AddLayerEvent(desc));
    }

    pub fn get_layer_type(&mut self, layer_id: &String) -> &str {
        let mut layer_type = "";
        if let Some(layer_desc_store) = self.app.world().get_resource::<LayerDescStore>() {
            if let Some(desc) = layer_desc_store.map.get(layer_id) {
                layer_type = match desc {
                    LayerDescription::Tiles(_) => "tiles",
                    LayerDescription::Terrain(_) => "terrain",
                    LayerDescription::GeoJson(_) => "geojson",
                    LayerDescription::B3dm(_) => "b3dm",
                    LayerDescription::Mvt(_) => "mvt",
                    LayerDescription::Cesium3dTiles(_) => "cesium3dtiles",
                };
            }
        }

        layer_type
    }

    pub fn update_layer(&mut self, layer_id: &str, desc: LayerDescription) {
        // TODO: Support multiple appearance
        let appearance = match desc {
            LayerDescription::GeoJson(layer) => layer.appearances[0].clone(),
            LayerDescription::B3dm(layer) => layer.appearances[0].clone(),
            LayerDescription::Cesium3dTiles(layer) => layer.appearances[0].clone(),
            LayerDescription::Mvt(layer) => layer.appearances[0].clone(),
            _ => return,
        };
        self.app
            .world_mut()
            .send_event(navara_layer_event::UpdateLayerEvent {
                layer_id: LayerId(layer_id.to_owned()),
                appearance,
            });
    }

    pub fn delete_layer(&mut self, layer_id: &str) {
        self.app
            .world_mut()
            .send_event(navara_layer_event::DeleteLayerEvent(LayerId(
                layer_id.to_owned(),
            )));
    }

    pub fn has_data_requester(&mut self, bits: u64) -> bool {
        let entity = Entity::from_bits(bits);
        let world = self.app.world_mut();
        let mut query = world.query_filtered::<&DataRequester, Without<Deleted>>();

        query.get(world, entity).is_ok()
    }

    pub fn has_worker_task(&mut self, bits: u64) -> bool {
        let entity = Entity::from_bits(bits);
        let world = self.app.world_mut();
        let mut query = world
            .query_filtered::<&WorkerTaskMarker, (Without<Deleted>, Without<WorkerTaskCompleted>)>(
            );

        query.get(world, entity).is_ok()
    }

    pub fn get_martini(&mut self, martini_id: u64) -> Option<&MartiniComponent> {
        let martini_id = Entity::from_bits(martini_id);
        let world = self.app.world_mut();
        let mut query = world.query::<&MartiniComponent>();

        query.get(world, martini_id).ok()
    }

    pub fn get_tile(&mut self, handle: TileHandle) -> Option<&RasterTile> {
        let world = self.app.world_mut();
        let qt = world.get_resource::<RasterTileQuadtree>()?;

        qt.qt.get(handle)
    }

    pub fn get_parent_tile(&mut self, handle: TileHandle) -> Option<&RasterTile> {
        let world = self.app.world_mut();
        let qt = world.get_resource::<RasterTileQuadtree>()?;

        let tile = qt.qt.get(handle).unwrap();
        tile.get_parent_tile(qt)
    }

    pub fn get_tile_elevation_decoder(&mut self, handle: TileHandle) -> Option<ElevationDecoder> {
        let world = self.app.world_mut();
        let qt = world.get_resource::<RasterTileQuadtree>()?;

        let tile = qt.qt.get(handle).unwrap();
        tile.terrain_data.as_ref()?.decoder().copied()
    }

    pub fn get_buffer_store(&self) -> Option<&BufferStore> {
        let world = self.app.world();
        world.get_resource::<BufferStore>()
    }

    pub fn get_buffer_store_mut(&mut self) -> Option<Mut<BufferStore>> {
        let world = self.app.world_mut();
        world.get_resource_mut::<BufferStore>()
    }

    pub fn get_batched_features(&self, batched_feature_id: u64) -> Option<Vec<EntityRef>> {
        let entity = Entity::from_bits(batched_feature_id);
        let world = self.app.world();
        let batched_feature = world.get_entity(entity)?.get::<BatchedFeature>()?;

        let features = world
            .get_many_entities_dynamic(&batched_feature.features)
            .ok()?;

        Some(features)
    }

    fn get_internal_batch_table(&mut self, entity: Entity) -> Option<&B3dmBatchTable> {
        let world = self.app.world_mut();
        let mut query = world.query::<&RenderableFeature>();

        let batch_table = match world.get_resource::<BatchTable>() {
            Some(batch_table) => batch_table,
            None => return None,
        };

        if let Ok(RenderableFeature::Model {
            feature_batch_id, ..
        }) = query.get(world, entity)
        {
            batch_table.get(feature_batch_id).and_then(|batch_value| {
                let Some(batch_prop) = &batch_value.properties else {
                    return None;
                };

                if let BatchProperty::Cesium3dTileset(in_batch_table) = batch_prop {
                    return Some(in_batch_table);
                }

                None
            })
        } else {
            None
        }
    }

    pub fn get_batch_prop(&mut self, batch_id: &u32) -> String {
        if let Some((entity, in_batch_id, in_batch_len)) =
            self.search_feature_entity_by_global_batch_id(batch_id)
        {
            let in_batch_table = match self.get_internal_batch_table(entity) {
                Some(table) => table,
                None => return String::from("{}"),
            };
            return get_prop_from_batch_table(in_batch_table, &in_batch_len, &in_batch_id);
        }

        if let Some(batch_value) = self
            .app
            .world()
            .get_resource::<BatchTable>()
            .unwrap()
            .get(batch_id)
        {
            if let Some(BatchProperty::StringObj(prop_str)) = &batch_value.properties {
                return prop_str.clone();
            };

            return String::from("{}");
        }

        String::from("{}")
    }

    pub fn search_feature_entity_by_global_batch_id(
        &self,
        global_batch_id: &u32,
    ) -> Option<(Entity, usize, usize)> {
        let map = self.app.world().get_resource::<FeatureBatchIdMap>()?;

        map.map.iter().find_map(|(entity, batch_ids)| {
            self.get_buffer_u32(batch_ids.0).and_then(|vec_ids| {
                vec_ids
                    .iter()
                    .step_by(2)
                    .position(|id| id == global_batch_id)
                    .map(|i| (*entity, i, vec_ids.len() / 2))
            })
        })
    }

    // Get all batch ids that have the same id_property_value as the batch_id.
    pub fn get_picked_batch_ids(&mut self, batch_id: &u32) -> Vec<u32> {
        let world = self.app.world_mut();

        let (id_prop_val, picked_batch_ids) = {
            let Some(batch_table_res) = world.get_resource::<BatchTable>() else {
                return vec![*batch_id];
            };

            let Some(id_prop_table) = world.get_resource::<IdPropertyTable>() else {
                return vec![*batch_id];
            };

            let Some(batch_table_value) = batch_table_res.get(batch_id) else {
                return vec![*batch_id];
            };

            let Some(id_prop_val) = &batch_table_value.id_property_value else {
                return vec![*batch_id];
            };

            let Some(picked_batch_ids) = id_prop_table.get(id_prop_val) else {
                return vec![*batch_id];
            };

            (id_prop_val.clone(), picked_batch_ids.clone())
        };

        if let Some(mut id_prop_sel) = world.get_resource_mut::<IdPropertySelections>() {
            id_prop_sel.clear();
            id_prop_sel.add(id_prop_val);
        };

        picked_batch_ids
    }
}

fn get_prop_from_batch_table(
    in_batch_table: &B3dmBatchTable,
    in_batch_len: &usize,
    in_batch_id: &usize,
) -> String {
    if *in_batch_id >= *in_batch_len {
        return String::from("{}");
    }

    let mut prop: serde_json::Map<String, serde_json::Value> = serde_json::Map::new();
    let batch_table_json = in_batch_table.json().unwrap();

    if let serde_json::Value::Object(map) = batch_table_json {
        for (key, value) in map {
            match value {
                serde_json::Value::Object(ref _m) => {
                    if let Ok(arr) = in_batch_table.read_property_from_binary(*in_batch_len, &value)
                    {
                        prop.insert(key, arr[*in_batch_id].clone());
                    }
                }
                serde_json::Value::Array(arr) => {
                    prop.insert(key, arr[*in_batch_id].clone());
                }
                _ => {}
            }
        }
    }

    serde_json::to_string(&prop).unwrap()
}

impl Default for App {
    fn default() -> Self {
        Self::new()
    }
}
