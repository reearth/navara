#![doc = include_str!("../README.md")]

use bevy_ecs::{
    component::Component,
    entity::Entity,
    query::{With, Without},
    system::SystemState,
    world::{EntityRef, Mut},
};
use navara_buffer_store::{BufferStore, Handle};
use navara_camera::{
    get_heading, get_pitch, get_roll, CamDirType, CameraControlUpdateEvent, CameraDirection,
    CameraEvent, CameraFrustum, CameraMarker, CameraOrientation, CameraStatus, FrustumEvent,
};
use navara_component::{Deleted, Rendered};
use navara_core::{ElevationDecoder, LngLat, Radians, CRS, LLE, WGS84_64};
use navara_data_requester::DataRequester;
use navara_event::Events;
use navara_feature_component::{
    batch::{BatchProperty, BatchTable, BatchedFeature, FeatureBatchIdMap, GlobalBatchIds},
    render::RenderableFeature,
};
use navara_frame::FrameManager;
use navara_globe::Globe;
use navara_layer::{LayerDescStore, LayerDescription, LayerId, MvtLayer};
use navara_material::{PolygonMaterial, PolylineMaterial};
use navara_math::{FloatType, Transform, Vec3};
use navara_mvt::MvtLayerResources;
use navara_parser::b3dm::BatchTable as B3dmBatchTable;
use navara_texture_fragment::{TextureFragmentLoadedEvent, TextureFragmentStatus};
use navara_tile_component::{
    compute_terrain_height_at_point, MartiniComponent, RasterTile, RasterTileQuadtree,
    TerrainHeightObserver, TileHandle, TileTerrainDataRequesterQuery, VectorTile,
    VectorTileQuadtree,
};
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

    pub fn get_buffer_f32(&self, handle: i32) -> Option<&[f32]> {
        let store = self.app.world().get_resource::<BufferStore>()?;
        store.get_f32(&handle)
    }

    pub fn get_buffer_f64(&self, handle: i32) -> Option<&[f64]> {
        let store = self.app.world().get_resource::<BufferStore>()?;
        store.get_f64(&handle)
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

    pub fn new_buffer_f64(&mut self, data: Vec<f64>) -> Option<Handle> {
        let mut store = self.app.world_mut().get_resource_mut::<BufferStore>()?;
        Some(store.new_f64(data))
    }

    pub fn remove_buffer(&mut self, handle: i32) {
        let Some(mut store) = self.app.world_mut().get_resource_mut::<BufferStore>() else {
            return;
        };
        store.remove(&handle);
    }

    pub fn remove_buffer_u8(&mut self, handle: i32) -> Option<Vec<u8>> {
        let mut store = self.app.world_mut().get_resource_mut::<BufferStore>()?;
        store.remove_u8(&handle)
    }
    pub fn remove_buffer_u32(&mut self, handle: i32) -> Option<Vec<u32>> {
        let mut store = self.app.world_mut().get_resource_mut::<BufferStore>()?;
        store.remove_u32(&handle)
    }
    pub fn remove_buffer_f32(&mut self, handle: i32) -> Option<Vec<f32>> {
        let mut store = self.app.world_mut().get_resource_mut::<BufferStore>()?;
        store.remove_f32(&handle)
    }
    pub fn remove_buffer_f64(&mut self, handle: i32) -> Option<Vec<f64>> {
        let mut store = self.app.world_mut().get_resource_mut::<BufferStore>()?;
        store.remove_f64(&handle)
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
            RenderableFeature::Text { render_info, .. } => render_info,
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
                    LayerDescription::Pnts(_) => "pnts",
                    LayerDescription::Mvt(_) => "mvt",
                    LayerDescription::Cesium3dTiles(_) => "cesium3dtiles",
                };
            }
        }

        layer_type
    }

    pub fn update_layer(&mut self, layer_id: &str, mut desc: LayerDescription) {
        match &mut desc {
            LayerDescription::GeoJson(layer) => {
                for appearance in &layer.appearances {
                    self.app
                        .world_mut()
                        .send_event(navara_layer_event::UpdateLayerEvent {
                            layer_id: LayerId(layer_id.to_owned()),
                            appearance: appearance.clone(),
                            elevation_heatmap_config: None,
                        });
                }
            }
            LayerDescription::B3dm(layer) => {
                for appearance in &layer.appearances {
                    self.app
                        .world_mut()
                        .send_event(navara_layer_event::UpdateLayerEvent {
                            layer_id: LayerId(layer_id.to_owned()),
                            appearance: appearance.clone(),
                            elevation_heatmap_config: None,
                        });
                }
            }
            LayerDescription::Pnts(layer) => {
                for appearance in &layer.appearances {
                    self.app
                        .world_mut()
                        .send_event(navara_layer_event::UpdateLayerEvent {
                            layer_id: LayerId(layer_id.to_owned()),
                            appearance: appearance.clone(),
                            elevation_heatmap_config: None,
                        });
                }
            }
            LayerDescription::Cesium3dTiles(layer) => {
                for appearance in &layer.appearances {
                    self.app
                        .world_mut()
                        .send_event(navara_layer_event::UpdateLayerEvent {
                            layer_id: LayerId(layer_id.to_owned()),
                            appearance: appearance.clone(),
                            elevation_heatmap_config: None,
                        });
                }
            }
            LayerDescription::Mvt(layer) => {
                for appearance in &layer.appearances {
                    self.app
                        .world_mut()
                        .send_event(navara_layer_event::UpdateLayerEvent {
                            layer_id: LayerId(layer_id.to_owned()),
                            appearance: appearance.clone(),
                            elevation_heatmap_config: None,
                        });
                }
            }
            LayerDescription::Tiles(layer) => {
                if let Some(appearance) = layer.appearance.take() {
                    self.app
                        .world_mut()
                        .send_event(navara_layer_event::UpdateLayerEvent {
                            layer_id: LayerId(layer_id.to_owned()),
                            appearance,
                            elevation_heatmap_config: layer.elevation_heatmap_config.clone(),
                        });
                }
            }
            _ => (),
        }
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

    // TODO: Support other type of vector tile.
    pub fn get_vector_tiles(&mut self, handle: TileHandle) -> Vec<(String, &VectorTile)> {
        let world = self.app.world_mut();
        let mut layers = world.query::<(&MvtLayer, &MvtLayerResources)>();
        let mut qts = world.query::<&VectorTileQuadtree>();

        let mut result = vec![];
        for (layer, resource) in layers.iter(world) {
            let Ok(qt) = qts.get(world, resource.quadtree) else {
                continue;
            };
            let Some(tile) = qt.qt.get(handle) else {
                continue;
            };
            result.push((layer.layer_id.clone(), tile));
        }

        result
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

    fn get_batched_features_with_material<C: Component + Clone>(
        &self,
        batched_feature_id: u64,
    ) -> Option<(Vec<EntityRef>, GlobalBatchIds, C)> {
        let entity = Entity::from_bits(batched_feature_id);
        let world = self.app.world();
        let (batched_feature, batch_ids, material) = world
            .get_entity(entity)
            .ok()?
            .get_components::<(&BatchedFeature, &GlobalBatchIds, &C)>()?;

        let features = world.get_entity(&batched_feature.features[..]).ok()?;

        Some((features, batch_ids.clone(), material.clone()))
    }

    pub fn get_batched_features_for_polyline(
        &self,
        batched_feature_id: u64,
    ) -> Option<(Vec<EntityRef>, GlobalBatchIds, PolylineMaterial)> {
        self.get_batched_features_with_material(batched_feature_id)
    }

    pub fn get_batched_features_for_polygon(
        &self,
        batched_feature_id: u64,
    ) -> Option<(Vec<EntityRef>, GlobalBatchIds, PolygonMaterial)> {
        self.get_batched_features_with_material(batched_feature_id)
    }

    fn get_internal_batch_table(
        &mut self,
        entity: Entity,
        in_batch_len: &usize,
        in_batch_id: &usize,
    ) -> Option<serde_json::Map<String, serde_json::Value>> {
        let world = self.app.world_mut();
        let mut query = world.query::<&RenderableFeature>();

        let batch_table = world.get_resource::<BatchTable>()?;

        let renderable_feature = query.get(world, entity).ok()?;

        match renderable_feature {
            RenderableFeature::Model {
                feature_batch_id, ..
            } => batch_table.get(feature_batch_id).and_then(|batch_value| {
                let Some(batch_prop) = &batch_value.properties else {
                    return None;
                };

                let BatchProperty::Cesium3dTileset(in_batch_table) = batch_prop else {
                    return None;
                };

                let batch_table_json = in_batch_table.json().ok()?;

                get_prop_from_batch_table(
                    in_batch_table,
                    &batch_table_json,
                    in_batch_len,
                    in_batch_id,
                )
            }),
            RenderableFeature::Polyline {
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
            } => {
                let batch_value = batch_table.get(feature_batch_id)?;
                let batch_prop = batch_value.properties.as_ref()?;
                let BatchProperty::Values(values) = batch_prop else {
                    return None;
                };
                let serde_json::Value::Object(map) = values[*in_batch_id].clone() else {
                    return None;
                };
                Some(map)
            }
            _ => None,
        }
    }

    pub fn get_batch_prop(
        &mut self,
        batch_id: &u32,
    ) -> (
        Option<serde_json::Map<String, serde_json::Value>>,
        Option<String>,
    ) {
        // For batched features like MVT(polygon, polyline) and Cesium 3D Tiles.
        if let Some((entity, in_batch_id, in_batch_len)) =
            self.search_feature_entity_by_global_batch_id(batch_id)
        {
            let properties = self.get_internal_batch_table(entity, &in_batch_len, &in_batch_id);
            if properties.is_some() {
                // Get layer_id from batch table
                let layer_id = self
                    .app
                    .world()
                    .get_resource::<BatchTable>()
                    .and_then(|bt| bt.get(batch_id))
                    .and_then(|bv| bv.layer_id.clone());
                return (properties, layer_id);
            }
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
        let serde_json::Value::Object(map) = values[0].clone() else {
            return (None, layer_id);
        };

        (Some(map), layer_id)
    }

    pub fn read_properties_by_global_batch_ids<
        F: Fn(usize, u32, Option<serde_json::Map<String, serde_json::Value>>),
    >(
        &mut self,
        renderable_feature_bits: u64,
        callback: &F,
    ) -> Option<()> {
        let renderable_feature_entity = Entity::from_bits(renderable_feature_bits);

        if self
            .read_internal_batch_table(renderable_feature_entity, callback)
            .is_some()
        {
            return Some(());
        }

        Some(())
    }

    fn read_internal_batch_table<
        F: Fn(usize, u32, Option<serde_json::Map<String, serde_json::Value>>),
    >(
        &mut self,
        renderable_feature_entity: Entity,
        callback: &F,
    ) -> Option<()> {
        let world = self.app.world_mut();
        let mut query = world.query::<&RenderableFeature>();

        let batch_table = world.get_resource::<BatchTable>()?;

        let renderable_feature = query.get(world, renderable_feature_entity).ok()?;

        match renderable_feature {
            RenderableFeature::Model {
                feature_batch_id,
                batch_length,
                feature_id,
                ..
            } => {
                let batch_value = batch_table.get(feature_batch_id)?;
                let batch_prop = batch_value.properties.as_ref()?;

                match batch_prop {
                    BatchProperty::Cesium3dTileset(in_batch_table) => {
                        let batch_length = *batch_length as usize;

                        let batch_table_json = in_batch_table.json().ok()?;

                        let global_batch_ids_opt = world
                            .get_entity(*feature_id)
                            .ok()
                            .and_then(|e| e.get::<GlobalBatchIds>());

                        if let Some(global_batch_ids) = global_batch_ids_opt {
                            let buffer_store = world.get_resource::<BufferStore>()?;
                            let global_batch_id_array =
                                buffer_store.get_u32(&global_batch_ids.handle)?;

                            for batch_idx in 0..batch_length {
                                let props = get_prop_from_batch_table(
                                    in_batch_table,
                                    &batch_table_json,
                                    &batch_length,
                                    &batch_idx,
                                );
                                let global_batch_id = global_batch_id_array
                                    .get(batch_idx)
                                    .copied()
                                    .unwrap_or(batch_idx as u32);
                                callback(batch_idx, global_batch_id, props);
                            }
                        }
                    }
                    BatchProperty::Values(values) => {
                        let global_batch_ids_opt = world
                            .get_entity(*feature_id)
                            .ok()
                            .and_then(|e| e.get::<GlobalBatchIds>());

                        if let Some(global_batch_ids) = global_batch_ids_opt {
                            let buffer_store = world.get_resource::<BufferStore>()?;
                            let global_batch_id_array =
                                buffer_store.get_u32(&global_batch_ids.handle)?;

                            for (batch_idx, value) in values.iter().enumerate() {
                                let global_batch_id = global_batch_id_array
                                    .get(batch_idx)
                                    .copied()
                                    .unwrap_or(batch_idx as u32);

                                let serde_json::Value::Object(map) = value.clone() else {
                                    continue;
                                };
                                callback(batch_idx, global_batch_id, Some(map));
                            }
                        }
                    }
                }
            }
            RenderableFeature::Polygon {
                feature_batch_id, ..
            }
            | RenderableFeature::Polyline {
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
            } => {
                let batch_value = batch_table.get(feature_batch_id)?;
                let batch_prop = batch_value.properties.as_ref()?;
                let BatchProperty::Values(values) = batch_prop else {
                    return None;
                };

                let global_batch_ids_opt = world
                    .get_entity(renderable_feature_entity)
                    .ok()
                    .and_then(|e| e.get::<GlobalBatchIds>());

                if let Some(global_batch_ids) = global_batch_ids_opt {
                    let buffer_store = world.get_resource::<BufferStore>()?;
                    let global_batch_id_array = buffer_store.get_u32(&global_batch_ids.handle)?;

                    for (batch_idx, value) in values.iter().enumerate() {
                        let global_batch_id = global_batch_id_array
                            .get(batch_idx)
                            .copied()
                            .unwrap_or(batch_idx as u32);

                        let serde_json::Value::Object(map) = value.clone() else {
                            continue;
                        };
                        callback(batch_idx, global_batch_id, Some(map));
                    }
                } else {
                    for (batch_idx, value) in values.iter().enumerate() {
                        let serde_json::Value::Object(map) = value.clone() else {
                            continue;
                        };
                        callback(batch_idx, *feature_batch_id, Some(map));
                    }
                }
            }
            RenderableFeature::Unknown => {}
        }

        Some(())
    }

    pub fn search_feature_entity_by_global_batch_id(
        &self,
        global_batch_id: &u32,
    ) -> Option<(Entity, usize, usize)> {
        let map = self.app.world().get_resource::<FeatureBatchIdMap>()?;

        map.map.iter().find_map(|(entity, batch_ids)| {
            self.get_buffer_u32(batch_ids.handle).and_then(|vec_ids| {
                vec_ids
                    .iter()
                    .position(|id| id == global_batch_id)
                    .map(|i| (*entity, i, vec_ids.len()))
            })
        })
    }

    pub fn change_camera(
        &mut self,
        position: Option<Vec<FloatType>>,
        pitch: Option<FloatType>,
        heading: Option<FloatType>,
        roll: Option<FloatType>,
    ) {
        let pos = position.and_then(|v| (v.len() == 3).then(|| Vec3::new(v[0], v[1], v[2])));
        self.app.world_mut().send_event(CameraEvent::Change {
            position: pos,
            orientation: Some(CameraOrientation {
                pitch,
                heading,
                roll,
            }),
        });
    }

    pub fn move_camera(&mut self, direction: CameraDirection, amount: FloatType) {
        self.app.world_mut().send_event(CameraEvent::Translate {
            direction: CamDirType::Standard(direction),
            amount,
        });
    }

    pub fn move_camera_with_direction(&mut self, direction: Vec<FloatType>, amount: FloatType) {
        if direction.len() != 3 {
            return;
        }
        self.app.world_mut().send_event(CameraEvent::Translate {
            direction: CamDirType::Custom(Vec3::new(direction[0], direction[1], direction[2])),
            amount,
        });
    }

    pub fn fly_to(
        &mut self,
        position: Option<Vec<FloatType>>,
        pitch: Option<FloatType>,
        heading: Option<FloatType>,
        roll: Option<FloatType>,
        duration: Option<FloatType>,
        max_height: Option<FloatType>,
    ) {
        let pos = position.and_then(|v| (v.len() == 3).then(|| Vec3::new(v[0], v[1], v[2])));
        self.app.world_mut().send_event(CameraEvent::FlyTo {
            position: pos,
            orientation: Some(CameraOrientation {
                pitch,
                heading,
                roll,
            }),
            duration,
            max_height,
        });
    }

    pub fn look_at(&mut self, target: Vec<FloatType>, offset: Vec<FloatType>) {
        self.app.world_mut().send_event(CameraEvent::LookAt {
            target: Vec3::new(target[0], target[1], target[2]),
            offset: Vec3::new(offset[0], offset[1], offset[2]),
        });
    }

    pub fn camera_follow(
        &mut self,
        enabled: bool,
        target: Option<Vec<FloatType>>,
        offset: Option<Vec<FloatType>>,
    ) {
        let target_vec3 = target.and_then(|v| (v.len() == 3).then(|| Vec3::new(v[0], v[1], v[2])));
        let offset_vec3 = offset.and_then(|v| (v.len() == 3).then(|| Vec3::new(v[0], v[1], v[2])));

        self.app.world_mut().send_event(CameraEvent::Follow {
            enabled,
            target: target_vec3,
            offset: offset_vec3,
        });
    }

    pub fn get_camera_status(&mut self) -> Option<CameraStatus> {
        let world = self.app.world_mut();
        let mut query = world.query_filtered::<&CameraStatus, With<CameraMarker>>();

        if let Some(cam_st) = query.iter(world).next() {
            return Some(cam_st.clone());
        }

        None
    }

    pub fn get_camera_position_lle(&mut self) -> Option<Vec<FloatType>> {
        let world = self.app.world_mut();
        let mut query = world.query_filtered::<&Transform, With<CameraMarker>>();

        if let Some(transform) = query.iter(world).next() {
            let lle = CRS::Geocentric.to_lle(WGS84_64, transform.translation, 0.0);
            let start = lle.deg();
            return Some(vec![start.lng.val(), start.lat.val(), start.height.val()]);
        }

        None
    }

    pub fn get_camera_position_ecef(&mut self) -> Option<Vec<FloatType>> {
        let world = self.app.world_mut();
        let mut query = world.query_filtered::<&Transform, With<CameraMarker>>();

        if let Some(transform) = query.iter(world).next() {
            return Some(vec![
                transform.translation.x,
                transform.translation.y,
                transform.translation.z,
            ]);
        }

        None
    }

    pub fn get_camera_orientation(&mut self) -> Option<(FloatType, FloatType, FloatType)> {
        let world = self.app.world_mut();
        let mut query = world.query_filtered::<&Transform, With<CameraMarker>>();

        if let Some(transform) = query.iter(world).next() {
            return Some((
                get_heading(transform),
                get_pitch(transform),
                get_roll(transform),
            ));
        }

        None
    }

    pub fn get_camera_fov_y(&mut self) -> Option<FloatType> {
        let world = self.app.world_mut();
        let mut query = world.query_filtered::<&CameraFrustum, With<CameraMarker>>();

        if let Some(frustum) = query.iter(world).next() {
            return Some(frustum.fov_y);
        }

        None
    }

    pub fn rotate_around_axis(&mut self, axis: Option<Vec<FloatType>>, angle: FloatType) {
        let axis = axis.and_then(|v| (v.len() == 3).then(|| Vec3::new(v[0], v[1], v[2])));
        self.app
            .world_mut()
            .send_event(CameraEvent::RotateAroundAxis { axis, angle });
    }

    pub fn sample_terrain_height(&mut self, lle: LLE<FloatType, Radians>) -> Option<FloatType> {
        let world = self.app.world_mut();

        let _ = world.get_resource::<RasterTileQuadtree>()?;
        let _ = world.get_resource::<BufferStore>()?;

        let result = world.resource_scope(|world, mut qt: Mut<RasterTileQuadtree>| {
            world.resource_scope(|world, mut buf: Mut<BufferStore>| {
                let mut state: SystemState<TileTerrainDataRequesterQuery> = SystemState::new(world);
                let query = state.get(world);

                compute_terrain_height_at_point(
                    &mut qt,
                    &mut buf,
                    &query,
                    &LngLat::new(lle.lat.val(), lle.lng.val()),
                )
            })
        });

        result
    }

    pub fn add_terrain_height_observer(&mut self, lle: LLE<FloatType, Radians>) -> u64 {
        let world = self.app.world_mut();

        let e_id = world
            .commands()
            .spawn(TerrainHeightObserver { lle, height: None })
            .id();

        e_id.to_bits()
    }

    pub fn remove_terrain_height_observer(&mut self, bits: u64) {
        let world = self.app.world_mut();
        let entity = Entity::from_bits(bits);
        if world.get_entity(entity).is_ok() {
            world.commands().entity(entity).despawn();
        }
    }

    pub fn set_frustum(
        &mut self,
        fov: Option<FloatType>,
        near: Option<FloatType>,
        far: Option<FloatType>,
    ) {
        self.app
            .world_mut()
            .send_event(FrustumEvent { fov, near, far });
    }

    pub fn set_camera_control(&mut self, event: CameraControlUpdateEvent) {
        self.app.world_mut().send_event(event);
    }

    pub fn get_globe(&self) -> Option<&Globe> {
        self.app.world().get_resource::<Globe>()
    }

    pub fn get_globe_mut(&mut self) -> Option<Mut<Globe>> {
        self.app.world_mut().get_resource_mut::<Globe>()
    }

    // === Globe definition ===

    pub fn set_globe_transparent(&mut self, value: bool) {
        if let Some(mut globe) = self.get_globe_mut() {
            globe.transparent = value;
        }
    }

    pub fn set_globe_max_sse(&mut self, value: f32) {
        if let Some(mut globe) = self.get_globe_mut() {
            globe.max_sse = value;
        }
    }

    pub fn set_globe_segments(&mut self, value: usize) {
        if let Some(mut globe) = self.get_globe_mut() {
            globe.segments = value;
        }
    }

    pub fn set_globe_color(&mut self, value: u32) {
        if let Some(mut globe) = self.get_globe_mut() {
            globe.color = value;
        }
    }

    pub fn set_globe_hide_underground(&mut self, value: bool) {
        if let Some(mut globe) = self.get_globe_mut() {
            globe.hide_underground = value;
        }
    }

    pub fn set_globe_should_compute_normal_from_vertex(&mut self, value: bool) {
        if let Some(mut globe) = self.get_globe_mut() {
            globe.should_compute_normal_from_vertex = value;
        }
    }

    pub fn set_globe_opacity(&mut self, value: f32) {
        if let Some(mut globe) = self.get_globe_mut() {
            globe.opacity = value;
        }
    }

    pub fn set_globe_wireframe(&mut self, value: bool) {
        if let Some(mut globe) = self.get_globe_mut() {
            globe.wireframe = value;
        }
    }

    pub fn set_globe_elevation_colormap(&mut self, value: Vec<f32>) {
        if let Some(mut globe) = self.get_globe_mut() {
            globe.elevation_colormap = value;
        }
    }

    // === Globe definition ===
}

fn get_prop_from_batch_table(
    in_batch_table: &B3dmBatchTable,
    batch_table_json: &serde_json::Value,
    in_batch_len: &usize,
    in_batch_id: &usize,
) -> Option<serde_json::Map<String, serde_json::Value>> {
    if *in_batch_id >= *in_batch_len {
        return None;
    }

    let mut prop: serde_json::Map<String, serde_json::Value> = serde_json::Map::new();

    if let serde_json::Value::Object(map) = batch_table_json {
        for (key, value) in map {
            match value {
                serde_json::Value::Object(ref _m) => {
                    if let Ok(v) = in_batch_table.read_property_from_binary(*in_batch_id, value) {
                        prop.insert(key.clone(), v);
                    }
                }
                serde_json::Value::Array(arr) => {
                    prop.insert(key.clone(), arr[*in_batch_id].clone());
                }
                _ => {}
            }
        }
    }

    Some(prop)
}

impl Default for App {
    fn default() -> Self {
        Self::new()
    }
}
