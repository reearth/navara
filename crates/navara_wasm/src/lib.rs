#![doc = include_str!("../README.md")]
mod attribute;
mod camera;
mod entity;
mod event;
mod geometry;
mod input;
mod property_value;
mod types;
mod vector_tile;

use entity::ReconstructableEntity;
use feature::{
    ReturnedTransferablePolygonBatchedFeature, ReturnedTransferablePolylineBatchedFeature,
};
use navara_buffer_store::Handle;
use navara_ecs::{App, BatchProperties};
use navara_input::Key;
use navara_math::FloatType;
use navara_tile_component::TileHandle;
use navara_wasm_utils::set_panic_hook;
use polygon::TransferablePolygonBatchedFeature;
use polyline::TransferablePolylineBatchedFeature;
use rand::RngExt;
use wasm_bindgen::prelude::*;

pub use camera::*;
pub use event::*;
pub use input::*;
pub use navara_wasm_transferable::*;
pub use navara_wasm_types::*;
pub use types::*;
pub use vector_tile::*;
use worker::DelegatedWorkerTasksResult;

use crate::property_value::JsPropertyValue;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen(getter_with_clone)]
pub struct Core {
    pub id: String,
    app: App,
}

#[wasm_bindgen]
impl Core {
    #[wasm_bindgen(constructor)]
    pub fn new(id: String) -> Self {
        Self {
            id,
            app: App::new(),
        }
    }

    pub fn start(&mut self) {
        // debug
        self.app
            .trigger_event(navara_input::Input::Keyboard(navara_input::KeyboardInput {
                logical_key: Key::Character("a".into()),
                key_code: navara_input::KeyCode::KeyA,
                state: navara_input::ButtonState::Pressed,
            }));
    }

    pub fn update(&mut self, updated_at: f64) {
        self.app.update(updated_at);
    }

    #[wasm_bindgen(js_name = readEvents)]
    pub fn read_events(&mut self) -> Option<Events> {
        self.app.read_events().map(|ev| ev.into())
    }

    pub fn input(&mut self, input: JsValue) {
        let Some(input) = Input::from(input) else {
            return;
        };

        let Some(input) = input.into_ecs_input() else {
            return;
        };

        self.app.trigger_event(input);
    }

    #[wasm_bindgen(js_name = getBufferU8)]
    pub fn get_buffer_u8(&self, handle: i32) -> Option<js_sys::Uint8Array> {
        let buf = self.app.get_buffer_u8(handle)?;

        Some(copy_u8_array(buf))
    }

    #[wasm_bindgen(js_name = getBufferU32)]
    pub fn get_buffer_u32(&self, handle: i32) -> Option<js_sys::Uint32Array> {
        let buf = self.app.get_buffer_u32(handle)?;

        Some(copy_u32_array(buf))
    }

    #[wasm_bindgen(js_name = getBufferF32)]
    pub fn get_buffer_f32(&self, handle: i32) -> Option<js_sys::Float32Array> {
        let buf = self.app.get_buffer_f32(handle)?;

        Some(copy_f32_array(buf))
    }

    #[wasm_bindgen(js_name = getBufferF64)]
    pub fn get_buffer_f64(&self, handle: i32) -> Option<js_sys::Float64Array> {
        let buf = self.app.get_buffer_f64(handle)?;

        Some(copy_f64_array(buf))
    }

    #[wasm_bindgen(js_name = setBufferU8)]
    pub fn set_buffer_u8(
        &mut self,
        handle: i32,
        bits: u64,
        byte_length: usize,
        f: &js_sys::Function,
    ) {
        self.app
            .set_buffer_u8(handle, bits, transfer_u8_array(byte_length, f));
    }

    #[wasm_bindgen(js_name = newBufferU8)]
    pub fn new_buffer_u8(&mut self, byte_length: usize, f: &js_sys::Function) -> Option<Handle> {
        self.app.new_buffer_u8(transfer_u8_array(byte_length, f))
    }

    #[wasm_bindgen(js_name = newBufferU32)]
    pub fn new_buffer_u32(&mut self, byte_length: usize, f: &js_sys::Function) -> Option<Handle> {
        self.app.new_buffer_u32(transfer_u32_array(byte_length, f))
    }

    #[wasm_bindgen(js_name = newBufferF32)]
    pub fn new_buffer_f32(&mut self, byte_length: usize, f: &js_sys::Function) -> Option<Handle> {
        self.app.new_buffer_f32(transfer_f32_array(byte_length, f))
    }

    #[wasm_bindgen(js_name = newBufferF64)]
    pub fn new_buffer_f64(&mut self, byte_length: usize, f: &js_sys::Function) -> Option<Handle> {
        self.app.new_buffer_f64(transfer_f64_array(byte_length, f))
    }

    #[wasm_bindgen(js_name = newBufferU8Cloned)]
    pub fn new_buffer_u8_cloned(&mut self, data: &[u8]) -> Option<Handle> {
        self.app.new_buffer_u8(data.to_vec())
    }

    #[wasm_bindgen(js_name = newBufferU32Cloned)]
    pub fn new_buffer_u32_cloned(&mut self, data: &[u32]) -> Option<Handle> {
        self.app.new_buffer_u32(data.to_vec())
    }

    #[wasm_bindgen(js_name = newBufferF32Cloned)]
    pub fn new_buffer_f32_cloned(&mut self, data: &[f32]) -> Option<Handle> {
        self.app.new_buffer_f32(data.to_vec())
    }

    #[wasm_bindgen(js_name = removeBuffer)]
    pub fn remove_buffer(&mut self, handle: i32) {
        self.app.remove_buffer(handle);
    }

    #[wasm_bindgen(js_name = removeBufferU8)]
    pub fn remove_buffer_u8(&mut self, handle: i32) -> Option<js_sys::Uint8Array> {
        Some(copy_u8_array(&self.app.remove_buffer_u8(handle)?))
    }
    #[wasm_bindgen(js_name = removeBufferU32)]
    pub fn remove_buffer_u32(&mut self, handle: i32) -> Option<js_sys::Uint32Array> {
        Some(copy_u32_array(&self.app.remove_buffer_u32(handle)?))
    }
    #[wasm_bindgen(js_name = removeBufferF32)]
    pub fn remove_buffer_f32(&mut self, handle: i32) -> Option<js_sys::Float32Array> {
        Some(copy_f32_array(&self.app.remove_buffer_f32(handle)?))
    }
    #[wasm_bindgen(js_name = removeBufferF64)]
    pub fn remove_buffer_f64(&mut self, handle: i32) -> Option<js_sys::Float64Array> {
        Some(copy_f64_array(&self.app.remove_buffer_f64(handle)?))
    }

    #[wasm_bindgen(js_name = triggerDataRequesterFailed)]
    pub fn trigger_data_requester_failed(&mut self, bits: u64) {
        self.app.trigger_data_requester_failed(bits);
    }

    pub fn resize(&mut self, width: FloatType, height: FloatType, pixel_ratio: FloatType) {
        self.app.resize(width, height, pixel_ratio);
    }

    #[wasm_bindgen(js_name = addLayer)]
    pub fn add_layer(&mut self, layer: JsValue) -> String {
        let layer_id = generate_id();
        // TODO: Improve an undesirable cloning the layer.
        if let Some(ld) = LayerDescription::from(layer.clone())
            && let Some(layer_type) = ld.r#type
            && let Some(l) = LayerDescription::to(&layer_id, layer_type.as_str(), layer, None)
        {
            self.app.add_layer(layer_id.as_str(), l);
        }

        layer_id
    }

    #[wasm_bindgen(js_name = updateLayer)]
    pub fn update_layer(&mut self, layer_id: String, layer: JsValue) {
        let layer_type = self.app.get_layer_type(&layer_id).unwrap_or("");
        let old_layer_desc = self.app.get_layer_description(&layer_id);
        if let Some(l) = LayerDescription::to(layer_id.as_str(), layer_type, layer, old_layer_desc)
        {
            self.app.update_layer(layer_id.as_str(), l);
        }
    }

    #[wasm_bindgen(js_name = deleteLayer)]
    pub fn delete_layer(&mut self, layer_id: String) {
        self.app.delete_layer(layer_id.as_str());
    }

    #[wasm_bindgen(js_name = getLayerIndex)]
    pub fn get_layer_index(&self, layer_id: &str) -> Option<usize> {
        self.app.get_layer_index(layer_id)
    }

    #[wasm_bindgen(js_name = triggerTextureFragmentLoaded)]
    pub fn trigger_texture_fragment_loaded(&mut self, bits: u64, status: TextureFragmentStatus) {
        self.app
            .trigger_texture_fragment_loaded(bits, status.into());
    }

    #[wasm_bindgen(js_name = setTileMeshPrepared)]
    pub fn set_tile_mesh_prepared(&mut self, handle: TileHandle) {
        self.app.set_tile_mesh_prepared(handle);
    }

    #[wasm_bindgen(js_name = markFeatureIsRendered)]
    pub fn mark_feature_is_rendered(&mut self, feature_type: &str, bits: u64) {
        match feature_type {
            "point" => self.app.mark_point_is_rendered(bits),
            "polyline" => self.app.mark_polyline_is_rendered(bits),
            "polygon" => self.app.mark_polygon_is_rendered(bits),
            "model" => self.app.mark_model_is_rendered(bits),
            _ => unreachable!(),
        }
    }

    #[wasm_bindgen(js_name = triggerWorkerTaskCompleted)]
    pub fn trigger_worker_task_completed(&mut self, bits: u64, result: DelegatedWorkerTasksResult) {
        self.app.trigger_worker_task_completed(
            bits,
            match result {
                DelegatedWorkerTasksResult {
                    delegator_id,
                    construct_terrain_mesh: Some(v),
                    ..
                } => navara_worker::DelegatedWorkerTasksResult::ConstructTerrainMesh(
                    navara_worker::DelegatedWorkerTask::with_bits(delegator_id.0, v.into()),
                ),
                DelegatedWorkerTasksResult {
                    delegator_id,
                    upsample_terrain_mesh: Some(v),
                    ..
                } => navara_worker::DelegatedWorkerTasksResult::UpsampleTerrainMesh(
                    navara_worker::DelegatedWorkerTask::with_bits(delegator_id.0, v.into()),
                ),
                DelegatedWorkerTasksResult {
                    delegator_id,
                    construct_polygon_batched_feature: Some(v),
                    ..
                } => navara_worker::DelegatedWorkerTasksResult::ConstructPolygonBatchedFeature(
                    navara_worker::DelegatedWorkerTask::with_bits(delegator_id.0, v.into()),
                ),
                DelegatedWorkerTasksResult {
                    delegator_id,
                    construct_polyline_batched_feature: Some(v),
                    ..
                } => navara_worker::DelegatedWorkerTasksResult::ConstructPolylineBatchedFeature(
                    navara_worker::DelegatedWorkerTask::with_bits(delegator_id.0, v.into()),
                ),
                _ => unreachable!(),
            },
        );
    }

    #[wasm_bindgen(js_name = getMartini)]
    pub fn get_martini(
        &mut self,
        martini_id: ReconstructableEntity,
    ) -> Option<TransferableMartini> {
        self.app.get_martini(martini_id.0).map(|v| v.into())
    }

    #[wasm_bindgen(js_name = hasDataRequester)]
    pub fn has_data_requester(&mut self, id: u64) -> bool {
        self.app.has_data_requester(id)
    }
    #[wasm_bindgen(js_name = hasWorkerTask)]
    pub fn has_worker_task(&mut self, id: u64) -> bool {
        self.app.has_worker_task(id)
    }

    #[wasm_bindgen(js_name = getTile)]
    pub fn get_tile(&mut self, handle: TileHandle) -> Option<TransferableTile> {
        self.app.get_tile(handle).map(|v| v.into())
    }

    #[wasm_bindgen(js_name = getParentTile)]
    pub fn get_parent_tile(&mut self, handle: TileHandle) -> Option<TransferableTile> {
        self.app.get_parent_tile(handle).map(|v| v.into())
    }

    #[wasm_bindgen(js_name = getVectorTileStates)]
    pub fn get_vector_tile_states(&mut self, handle: TileHandle) -> Vec<VectorTileState> {
        let tiles = self.app.get_vector_tiles(handle);
        let mut res = vec![];
        for (layer_id, tile) in tiles {
            res.push(VectorTileState {
                layer_id,
                ready_parent_tile_handle: tile.ready_parent_tile_handle,
                is_rendered: tile.is_rendered,
            });
        }

        res
    }

    #[wasm_bindgen(js_name = getTileElevationDecoder)]
    pub fn get_tile_elevation_decoder(&mut self, handle: TileHandle) -> Option<ElevationDecoder> {
        self.app
            .get_tile_elevation_decoder(handle)
            .map(|v| v.into())
    }

    #[wasm_bindgen(js_name = getTransferablePolygonBatchedFeature)]
    pub fn get_transferable_polygon_batched_feature(
        &mut self,
        batched_feature_id: u64,
    ) -> Option<ReturnedTransferablePolygonBatchedFeature> {
        let (batched_geom, batch_ids_component, material) =
            self.app.take_batched_polygon_geometry(batched_feature_id)?;

        let mut transferable = TransferablePolygonBatchedFeature::from_batched(batched_geom);

        let buf_store = self.app.get_buffer_store()?;
        transferable.add_batch_id(&mut buf_store.get_u32(&batch_ids_component.handle)?.to_vec());

        Some(ReturnedTransferablePolygonBatchedFeature {
            transferable,
            material: material.into(),
        })
    }

    #[wasm_bindgen(js_name = getTransferablePolylineBatchedFeature)]
    pub fn get_transferable_polyline_batched_feature(
        &mut self,
        batched_feature_id: u64,
    ) -> Option<ReturnedTransferablePolylineBatchedFeature> {
        let (batched_geom, batch_ids_component, material) = self
            .app
            .take_batched_polyline_geometry(batched_feature_id)?;

        let mut transferable = TransferablePolylineBatchedFeature::from_batched(batched_geom);

        let buf_store = self.app.get_buffer_store()?;
        transferable.add_batch_id(&mut buf_store.get_u32(&batch_ids_component.handle)?.to_vec());

        Some(ReturnedTransferablePolylineBatchedFeature {
            transferable,
            material: material.into(),
        })
    }

    #[wasm_bindgen(js_name = readPropertyByGlobalBatchId)]
    pub fn read_property_by_global_batch_id(&mut self, batch_id: u32) -> BatchPropResult {
        let (properties, layer_id) = self
            .app
            .read_property_by_global_batch_id::<JsPropertyValue>(&batch_id);

        let properties_js = properties.map(|v| v.0).unwrap_or(JsValue::NULL);

        BatchPropResult {
            properties: properties_js,
            layer_id,
        }
    }

    #[wasm_bindgen(js_name = readAllBatchedProperties)]
    pub fn read_all_batched_properties(
        &mut self,
        renderable_feature_bits: u64,
        callback: &js_sys::Function,
    ) -> Result<(), JsValue> {
        let this = JsValue::NULL;
        self.app
            .read_all_batched_properties::<JsPropertyValue, JsValue, _>(
                renderable_feature_bits,
                None,
                &|batch_idx, batch_id, props| {
                    let batch_idx = JsValue::from(batch_idx as u32);
                    let batch_id = JsValue::from(batch_id);
                    match props {
                        BatchProperties::All(Some(v)) => {
                            callback.call3(&this, &batch_idx, &batch_id, &v.0)?
                        }
                        _ => callback.call2(&this, &batch_idx, &batch_id)?,
                    };
                    Ok(())
                },
            )?;
        Ok(())
    }

    #[wasm_bindgen(js_name = readFilteredBatchedProperties)]
    pub fn read_filtered_batched_properties(
        &mut self,
        renderable_feature_bits: u64,
        keys: Vec<JsValue>,
        callback: &js_sys::Function,
    ) -> Result<(), JsValue> {
        let keys: Vec<String> = keys.iter().filter_map(|k| k.as_string()).collect();

        let this = JsValue::NULL;
        self.app
            .read_all_batched_properties::<JsPropertyValue, JsValue, _>(
                renderable_feature_bits,
                Some(&keys),
                &|batch_idx, batch_id, props| {
                    let batch_idx = JsValue::from(batch_idx as u32);
                    let batch_id = JsValue::from(batch_id);
                    match props {
                        BatchProperties::Filtered(Some(values)) => {
                            let arr = js_sys::Array::new_with_length(values.len() as u32);
                            for (i, val) in values.into_iter().enumerate() {
                                match val {
                                    Some(v) => arr.set(i as u32, v.0),
                                    None => arr.set(i as u32, JsValue::UNDEFINED),
                                }
                            }
                            callback.call3(&this, &batch_idx, &batch_id, &arr.into())?
                        }
                        _ => callback.call2(&this, &batch_idx, &batch_id)?,
                    };
                    Ok(())
                },
            )?;
        Ok(())
    }

    #[wasm_bindgen(js_name = changeCamera)]
    pub fn change_camera(
        &mut self,
        position: Option<Vec<FloatType>>,
        pitch: Option<FloatType>,
        heading: Option<FloatType>,
        roll: Option<FloatType>,
    ) {
        self.app.change_camera(position, pitch, heading, roll);
    }

    #[wasm_bindgen(js_name = moveCamera)]
    pub fn move_camera(&mut self, direction: CameraDirection, amount: FloatType) {
        self.app.move_camera(direction.into(), amount);
    }

    #[wasm_bindgen(js_name = moveCameraWithDirection)]
    pub fn move_camera_with_direction(&mut self, direction: Vec<FloatType>, amount: FloatType) {
        self.app.move_camera_with_direction(direction, amount);
    }

    #[wasm_bindgen(js_name = flyTo)]
    pub fn fly_to(
        &mut self,
        position: Option<Vec<FloatType>>,
        pitch: Option<FloatType>,
        heading: Option<FloatType>,
        roll: Option<FloatType>,
        duration: Option<FloatType>,
        max_height: Option<FloatType>,
    ) {
        self.app
            .fly_to(position, pitch, heading, roll, duration, max_height);
    }

    #[wasm_bindgen(js_name = lookAt)]
    pub fn look_at(&mut self, target: Vec<FloatType>, offset: Vec<FloatType>) {
        self.app.look_at(target, offset);
    }

    #[wasm_bindgen(js_name = cameraFollow)]
    pub fn camera_follow(
        &mut self,
        enabled: bool,
        target: Option<Vec<FloatType>>,
        offset: Option<Vec<FloatType>>,
    ) {
        self.app.camera_follow(enabled, target, offset);
    }

    #[wasm_bindgen(js_name = getCameraStatus)]
    pub fn get_camera_status(&mut self) -> Option<CameraStatus> {
        if let Some(cam_st) = self.app.get_camera_status() {
            let mut status: Vec<CameraStatusType> = vec![];
            cam_st.status.iter().for_each(|st| {
                status.push((*st).into());
            });

            Some(CameraStatus { status })
        } else {
            None
        }
    }

    #[wasm_bindgen(js_name = getCameraPositionLLE)]
    pub fn get_camera_position_lle(&mut self) -> Option<Vec<f64>> {
        self.app.get_camera_position_lle()
    }

    #[wasm_bindgen(js_name = getCameraPositionECEF)]
    pub fn get_camera_position_ecef(&mut self) -> Option<Vec<f64>> {
        self.app.get_camera_position_ecef()
    }

    #[wasm_bindgen(js_name = getCameraOrientation)]
    pub fn get_camera_orientation(&mut self) -> Option<CameraOrientation> {
        if let Some((heading, pitch, roll)) = self.app.get_camera_orientation() {
            return Some(CameraOrientation {
                heading,
                pitch,
                roll,
            });
        }
        None
    }

    #[wasm_bindgen(js_name = getCameraFOVY)]
    pub fn get_camera_fov_y(&mut self) -> Option<FloatType> {
        self.app.get_camera_fov_y()
    }

    #[wasm_bindgen(js_name = rotateAroundAxis)]
    pub fn rotate_around_axis(&mut self, axis: Option<Vec<FloatType>>, angle: FloatType) {
        self.app.rotate_around_axis(axis, angle);
    }

    #[wasm_bindgen(js_name = sampleTerrainHeight)]
    pub fn sample_terrain_height(&mut self, lle: LLE) -> Option<FloatType> {
        self.app.sample_terrain_height((&lle).into())
    }

    #[wasm_bindgen(js_name = registerSampleTerrainHeightEvent)]
    pub fn register_sample_terrain_height_event(&mut self, lle: LLE) -> u64 {
        self.app.add_terrain_height_observer((&lle).into())
    }

    #[wasm_bindgen(js_name = unregisterSampleTerrainHeightEvent)]
    pub fn unregister_sample_terrain_height_event(&mut self, bits: u64) {
        self.app.remove_terrain_height_observer(bits);
    }

    #[wasm_bindgen(js_name = setFrustum)]
    pub fn set_frustum(
        &mut self,
        fov: Option<FloatType>,
        near: Option<FloatType>,
        far: Option<FloatType>,
    ) {
        self.app.set_frustum(fov, near, far);
    }

    #[wasm_bindgen(js_name = setCameraControl)]
    pub fn set_camera_control(&mut self, event: navara_wasm_types::CameraControlUpdateEvent) {
        self.app.set_camera_control(event.into());
    }

    // === Globe definition ===

    #[wasm_bindgen(js_name = getGlobe)]
    pub fn get_globe(&self) -> Option<Globe> {
        self.app.get_globe().map(|g| g.into())
    }

    #[wasm_bindgen(js_name = getGlobeTransparent)]
    pub fn get_globe_transparent(&self) -> Option<bool> {
        self.app.get_globe().map(|g| g.transparent)
    }

    #[wasm_bindgen(js_name = getGlobeMaxSse)]
    pub fn get_globe_max_sse(&self) -> Option<f32> {
        self.app.get_globe().map(|g| g.max_sse)
    }

    #[wasm_bindgen(js_name = getGlobeSegments)]
    pub fn get_globe_segments(&self) -> Option<f32> {
        self.app.get_globe().map(|g| g.segments as f32)
    }

    #[wasm_bindgen(js_name = getGlobeColor)]
    pub fn get_globe_color(&self) -> Option<u32> {
        self.app.get_globe().map(|g| g.color)
    }

    #[wasm_bindgen(js_name = getGlobeHideUnderground)]
    pub fn get_globe_hide_underground(&self) -> Option<bool> {
        self.app.get_globe().map(|g| g.hide_underground)
    }

    #[wasm_bindgen(js_name = getGlobeUseNormal)]
    pub fn get_globe_use_normal(&self) -> Option<bool> {
        self.app.get_globe().map(|g| g.use_normal)
    }

    #[wasm_bindgen(js_name = getGlobeOpacity)]
    pub fn get_globe_opacity(&self) -> Option<f32> {
        self.app.get_globe().map(|g| g.opacity)
    }

    #[wasm_bindgen(js_name = getGlobeWireframe)]
    pub fn get_globe_wireframe(&self) -> Option<bool> {
        self.app.get_globe().map(|g| g.wireframe)
    }

    #[wasm_bindgen(js_name = getGlobeElevationColormap)]
    pub fn get_globe_elevation_colormap(&self) -> Option<Vec<f32>> {
        self.app.get_globe().map(|g| g.elevation_colormap.clone())
    }

    #[wasm_bindgen(js_name = setGlobeTransparent)]
    pub fn set_globe_transparent(&mut self, value: bool) {
        self.app.set_globe_transparent(value);
    }

    #[wasm_bindgen(js_name = setGlobeMaxSse)]
    pub fn set_globe_max_sse(&mut self, value: f32) {
        self.app.set_globe_max_sse(value);
    }

    #[wasm_bindgen(js_name = setGlobeSegments)]
    pub fn set_globe_segments(&mut self, value: f32) {
        self.app.set_globe_segments(value as usize);
    }

    #[wasm_bindgen(js_name = setGlobeColor)]
    pub fn set_globe_color(&mut self, value: u32) {
        self.app.set_globe_color(value);
    }

    #[wasm_bindgen(js_name = setGlobeHideUnderground)]
    pub fn set_globe_hide_underground(&mut self, value: bool) {
        self.app.set_globe_hide_underground(value);
    }

    #[wasm_bindgen(js_name = setGlobeUseNormal)]
    pub fn set_globe_use_normal(&mut self, value: bool) {
        self.app.set_globe_use_normal(value);
    }

    #[wasm_bindgen(js_name = setGlobeOpacity)]
    pub fn set_globe_opacity(&mut self, value: f32) {
        self.app.set_globe_opacity(value);
    }

    #[wasm_bindgen(js_name = setGlobeWireframe)]
    pub fn set_globe_wireframe(&mut self, value: bool) {
        self.app.set_globe_wireframe(value);
    }

    #[wasm_bindgen(js_name = setGlobeElevationColormap)]
    pub fn set_globe_elevation_colormap(&mut self, value: Vec<f32>) {
        self.app.set_globe_elevation_colormap(value);
    }

    // === Globe definition ===
}

#[wasm_bindgen(js_name = generateId)]
pub fn generate_id() -> String {
    let mut rng = rand::rng();
    let id: u128 = rng.random();
    format!("{:032x}", id)
}

#[wasm_bindgen(start)]
pub fn start() {
    set_panic_hook();
    log("init navara_wasm");
}

// fn app<T>(id: String, f: impl FnOnce(&mut App) -> T) -> T {
//     static APP: OnceLock<Mutex<HashMap<String, App>>> = OnceLock::new();
//     let mut map = APP
//         .get_or_init(|| Mutex::new(HashMap::new()))
//         .lock()
//         .unwrap();

//     let app = map
//         .entry(id.to_string())
//         .or_insert_with(|| Mutex::new(App::new()))
//         .get_mut()
//         .unwrap();

//     f(app)
// }
