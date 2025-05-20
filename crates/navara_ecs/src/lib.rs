#![doc = include_str!("../README.md")]

use bevy_ecs::{
    component::Component,
    entity::Entity,
    query::{With, Without},
    world::{EntityRef, Mut},
};
use navara_buffer_store::{BufferStore, Handle};
use navara_camera::{
    get_heading, get_pitch, get_roll, CamDirType, CameraController, CameraDirection, CameraEvent,
    CameraMarker, CameraOrientation, CameraStatus,
};
use navara_component::{Deleted, Rendered};
use navara_core::{ElevationDecoder, CRS, WGS84_32};
use navara_data_requester::DataRequester;
use navara_event::Events;
use navara_feature_component::{
    batch::{
        BatchProperty, BatchTable, BatchedFeature, FeatureBatchIdMap, GlobalBatchIdAndSelections,
        IdPropertySelections, IdPropertyTable,
    },
    render::RenderableFeature,
};
use navara_frame::FrameManager;
use navara_layer::{LayerDescStore, LayerDescription, LayerId, MvtLayer};
use navara_material::{PolygonMaterial, PolylineMaterial};
use navara_math::{FloatType, Transform, Vec3};
use navara_mvt::MvtLayerResources;
use navara_parser::b3dm::BatchTable as B3dmBatchTable;
use navara_texture_fragment::{TextureFragmentLoadedEvent, TextureFragmentStatus};
use navara_tile_component::{
    MartiniComponent, RasterTile, RasterTileQuadtree, TileHandle, VectorTile, VectorTileQuadtree,
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
            LayerDescription::Tiles(layer) => layer.appearance.unwrap().clone(),
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
    ) -> Option<(Vec<EntityRef>, GlobalBatchIdAndSelections, C)> {
        let entity = Entity::from_bits(batched_feature_id);
        let world = self.app.world();
        let (batched_feature, batch_id_and_selected_status, material) = world
            .get_entity(entity)
            .ok()?
            .get_components::<(&BatchedFeature, &GlobalBatchIdAndSelections, &C)>()?;

        let features = world.get_entity(&batched_feature.features[..]).ok()?;

        Some((
            features,
            batch_id_and_selected_status.clone(),
            material.clone(),
        ))
    }

    pub fn get_batched_features_for_polyline(
        &self,
        batched_feature_id: u64,
    ) -> Option<(Vec<EntityRef>, GlobalBatchIdAndSelections, PolylineMaterial)> {
        self.get_batched_features_with_material(batched_feature_id)
    }

    pub fn get_batched_features_for_polygon(
        &self,
        batched_feature_id: u64,
    ) -> Option<(Vec<EntityRef>, GlobalBatchIdAndSelections, PolygonMaterial)> {
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

                let batch_table_json = in_batch_table.json().unwrap();

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
    ) -> Option<serde_json::Map<String, serde_json::Value>> {
        // For batched features like MVT(polygon, polyline) and Cesium 3D Tiles.
        if let Some((entity, in_batch_id, in_batch_len)) =
            self.search_feature_entity_by_global_batch_id(batch_id)
        {
            let properties = self.get_internal_batch_table(entity, &in_batch_len, &in_batch_id);
            if properties.is_some() {
                return properties;
            }
        };

        // For other features like GeoJSON and MVT point
        let batch_value = self
            .app
            .world()
            .get_resource::<BatchTable>()
            .unwrap()
            .get(batch_id)?;
        let Some(BatchProperty::Values(values)) = &batch_value.properties else {
            return None;
        };
        // This should include only one batch.
        let serde_json::Value::Object(map) = values[0].clone() else {
            return None;
        };

        Some(map)
    }

    pub fn read_properties_by_global_batch_ids<
        F: Fn(u32, Option<serde_json::Map<String, serde_json::Value>>),
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

    fn read_internal_batch_table<F: Fn(u32, Option<serde_json::Map<String, serde_json::Value>>)>(
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
                ..
            } => {
                let batch_value = batch_table.get(feature_batch_id)?;
                let batch_prop = batch_value.properties.as_ref()?;

                match batch_prop {
                    BatchProperty::Cesium3dTileset(in_batch_table) => {
                        let batch_length = *batch_length as usize;

                        let batch_table_json = in_batch_table.json().unwrap();

                        for batch_id in 0..batch_length {
                            let props = get_prop_from_batch_table(
                                in_batch_table,
                                &batch_table_json,
                                &batch_length,
                                &batch_id,
                            );
                            callback(batch_id as u32, props);
                        }
                    }
                    BatchProperty::Values(values) => {
                        for (batch_id, value) in values.iter().enumerate() {
                            let serde_json::Value::Object(map) = value.clone() else {
                                continue;
                            };
                            callback(batch_id as u32, Some(map));
                        }
                    }
                }
            }
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
                for (batch_id, value) in values.iter().enumerate() {
                    let serde_json::Value::Object(map) = value.clone() else {
                        continue;
                    };
                    callback(batch_id as u32, Some(map));
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

    pub fn clear_picking_status(&mut self) {
        if let Some(mut id_prop_sel) = self
            .app
            .world_mut()
            .get_resource_mut::<IdPropertySelections>()
        {
            id_prop_sel.clear();
        };
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

    pub fn get_camera_status(&mut self) -> CameraStatus {
        let world = self.app.world_mut();
        let mut query = world.query_filtered::<&CameraController, With<CameraMarker>>();

        if let Some(cam_ctrl) = query.iter(world).next() {
            return cam_ctrl.status;
        }

        CameraStatus::Idle
    }

    pub fn get_camera_position_lle(&mut self) -> Option<Vec<FloatType>> {
        let world = self.app.world_mut();
        let mut query = world.query_filtered::<&Transform, With<CameraMarker>>();

        if let Some(transform) = query.iter(world).next() {
            let lle = CRS::Geocentric.to_lle(WGS84_32, transform.translation, 0.0);
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
