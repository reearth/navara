#![doc = include_str!("../README.md")]
mod attribute;
mod entity;
mod event;
mod geometry;
mod input;
mod types;

use entity::ReconstructableEntity;
use feature::{
    ReturnedTransferablePolygonBatchedFeature, ReturnedTransferablePolylineBatchedFeature,
};
use nanoid::nanoid;
use navara_buffer_store::Handle;
use navara_ecs::App;
use navara_feature_component::batch::BatchId;
use navara_geometry::Hierarchy;
use navara_input::Key;
use navara_math::FloatType;
use navara_tile_component::TileHandle;
use navara_wasm_utils::set_panic_hook;
use polygon::TransferablePolygonBatchedFeature;
use polyline::TransferablePolylineBatchedFeature;
use wasm_bindgen::prelude::*;

pub use event::*;
pub use input::*;
pub use navara_wasm_transferable::*;
pub use navara_wasm_types::*;
pub use types::*;
use worker::DelegatedWorkerTasksResult;

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

    #[wasm_bindgen(js_name = setBufferU8)]
    pub fn set_buffer_u8(
        &mut self,
        handle: i32,
        bits: u64,
        byte_length: usize,
        f: &js_sys::Function,
    ) {
        unsafe {
            self.app
                .set_buffer_u8(handle, bits, transfer_u8_array(byte_length, f));
        }
    }

    #[wasm_bindgen(js_name = newBufferU8)]
    pub fn new_buffer_u8(&mut self, byte_length: usize, f: &js_sys::Function) -> Option<Handle> {
        unsafe { self.app.new_buffer_u8(transfer_u8_array(byte_length, f)) }
    }

    #[wasm_bindgen(js_name = newBufferU32)]
    pub fn new_buffer_u32(&mut self, byte_length: usize, f: &js_sys::Function) -> Option<Handle> {
        unsafe { self.app.new_buffer_u32(transfer_u32_array(byte_length, f)) }
    }

    #[wasm_bindgen(js_name = newBufferF32)]
    pub fn new_buffer_f32(&mut self, byte_length: usize, f: &js_sys::Function) -> Option<Handle> {
        unsafe { self.app.new_buffer_f32(transfer_f32_array(byte_length, f)) }
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

    #[wasm_bindgen(js_name = triggerDataRequesterFailed)]
    pub fn trigger_data_requester_failed(&mut self, bits: u64) {
        self.app.trigger_data_requester_failed(bits);
    }

    pub fn resize(&mut self, width: FloatType, height: FloatType, pixel_ratio: FloatType) {
        self.app.resize(width, height, pixel_ratio);
    }

    #[wasm_bindgen(js_name = addLayer)]
    pub fn add_layer(&mut self, layer: JsValue) -> String {
        let layer_id = nanoid!();
        // TODO: Improve an undesirable cloning the layer.
        if let Some(ld) = LayerDescription::from(layer.clone()) {
            if let Some(layer_type) = ld.r#type {
                if let Some(l) = LayerDescription::to(&layer_id, layer_type.as_str(), layer) {
                    self.app.add_layer(layer_id.as_str(), l);
                }
            }
        }

        layer_id
    }

    #[wasm_bindgen(js_name = updateLayer)]
    pub fn update_layer(&mut self, layer_id: String, layer: JsValue) {
        let layer_type = self.app.get_layer_type(&layer_id);
        if let Some(l) = LayerDescription::to(layer_id.as_str(), layer_type, layer) {
            self.app.update_layer(layer_id.as_str(), l);
        }
    }

    #[wasm_bindgen(js_name = deleteLayer)]
    pub fn delete_layer(&mut self, layer_id: String) {
        self.app.delete_layer(layer_id.as_str());
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
        let features = self.app.get_batched_features(batched_feature_id)?;

        let mut material: Option<PolygonMaterial> = None;

        let mut transferable = TransferablePolygonBatchedFeature::empty(features.len());

        let mut coords_handle_and_batch_ids = vec![];

        for f in &features {
            if material.is_none() {
                let m = f.get::<navara_material::PolygonMaterial>()?;
                material = Some(m.into());
            }

            let geometry = f.get::<navara_feature_component::polygon::PolygonGeometry>()?;
            let batch_id = f.get::<navara_feature_component::batch::BatchId>()?;

            coords_handle_and_batch_ids.push((geometry.hierarchy.clone(), batch_id.0));
        }

        let mut buf_store = self.app.get_buffer_store_mut()?;
        for (hierarchy, batch_id) in coords_handle_and_batch_ids {
            let mut hierarchy = Hierarchy::from_transferred(&hierarchy, &mut buf_store)?;

            transferable.add(&mut hierarchy, &BatchId(batch_id));
        }

        material.map(|material| ReturnedTransferablePolygonBatchedFeature {
            transferable,
            material,
        })
    }

    #[wasm_bindgen(js_name = getTransferablePolylineBatchedFeature)]
    pub fn get_transferable_polyline_batched_feature(
        &mut self,
        batched_feature_id: u64,
    ) -> Option<ReturnedTransferablePolylineBatchedFeature> {
        let features = self.app.get_batched_features(batched_feature_id)?;

        let mut material: Option<PolylineMaterial> = None;

        let mut transferable = TransferablePolylineBatchedFeature::empty(features.len());

        let mut coords_handle_and_batch_ids = vec![];

        for f in &features {
            if material.is_none() {
                let m = f.get::<navara_material::PolylineMaterial>()?;
                material = Some(m.into());
            }

            let geometry = f.get::<navara_feature_component::polyline::PolylineGeometry>()?;
            let batch_id = f.get::<navara_feature_component::batch::BatchId>()?;

            coords_handle_and_batch_ids.push((geometry.coords, batch_id.0));
        }

        let mut buf_store = self.app.get_buffer_store_mut()?;
        for (coords, batch_id) in coords_handle_and_batch_ids {
            // `coords` comes from Rust for sure.
            unsafe {
                let mut points = buf_store.remove_f32(&coords)?.to_vec();

                transferable.add(&mut points, &BatchId(batch_id));
            }
        }

        material.map(|material| ReturnedTransferablePolylineBatchedFeature {
            transferable,
            material,
        })
    }

    #[wasm_bindgen(js_name = getBatchProp)]
    pub fn get_batch_prop(&mut self, batch_id: u32) -> String {
        self.app.get_batch_prop(&batch_id)
    }
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
