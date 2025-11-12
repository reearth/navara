pub mod feature;
mod feature_event;
pub mod worker;

use feature_event::{
    RenderableFeatureAddedEvent, RenderableFeatureChangedEvent, RenderableFeatureRemovedEvent,
};

use navara_tile_component::TileHandle;
use serde::Serialize;
use wasm_bindgen::prelude::*;
use worker::WorkerTaskDelegatedEvent;

use navara_wasm_types::{CameraFrustum, Globe, RasterTileInternalMaterial, Transform, Vec2, LLE};

#[wasm_bindgen(getter_with_clone)]
#[derive(Debug, Clone, Serialize)]
pub struct Events {
    pub camera_transform_updated: Option<Transform>,
    pub camera_frustum_updated: Option<CameraFrustum>,
    pub object_transform_updated: Vec<ObjectTransformEvent>,
    pub mesh_removed: Vec<EntityEvent>,
    pub mesh_added: Vec<MeshAdded>,
    pub mesh_updated: Vec<MeshChanged>,
    pub data_requested: Vec<DataRequestEvent>,
    pub data_requester_removed: Vec<DataRequesterRemovedEvent>,
    pub texture_fragment_requested: Vec<TextureFragmentRequestedEvent>,
    pub texture_fragment_removed: Vec<EntityEvent>,
    pub worker_task_delegated: Vec<WorkerTaskDelegatedEvent>,
    pub worker_task_removed: Vec<EntityEvent>,
    pub renderable_feature_added: Vec<RenderableFeatureAddedEvent>,
    pub renderable_feature_changed: Vec<RenderableFeatureChangedEvent>,
    pub renderable_feature_removed: Vec<RenderableFeatureRemovedEvent>,
    pub update_sample_terrain_height: Vec<TerrainHeightUpdatedEvent>,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct ObjectTransformEvent {
    pub ind: u32,
    pub gen: u32,
    pub transform: Transform,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct MeshAdded {
    pub ind: u32,
    pub gen: u32,
    pub tile_handle: TileHandle,
    pub ready_parent_tile_handle: Option<TileHandle>,
    pub mesh: Mesh,
    #[wasm_bindgen(getter_with_clone)]
    pub material: RasterTileInternalMaterial,
    pub transform: Transform,
    #[wasm_bindgen(getter_with_clone)]
    pub globe: Globe,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct MeshChanged {
    pub ind: u32,
    pub gen: u32,
    pub ready_parent_tile_handle: Option<TileHandle>,
    pub mesh: Mesh,
    #[wasm_bindgen(getter_with_clone)]
    pub material: RasterTileInternalMaterial,
    #[wasm_bindgen(getter_with_clone)]
    pub globe: Globe,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize)]
pub struct Mesh {
    pub vertices: i32, // handle
    pub uvs: i32,      // handle
    pub indices: i32,  // handle
    pub active: bool,
    pub render_order: i32,
    pub uv_transform: TileUvTransform,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize)]
pub struct TileUvTransform {
    pub offset: Vec2,
    pub scale: Vec2,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct DataRequestEvent {
    // Entity
    pub ind: u32,
    pub gen: u32,
    pub bits: u64,

    pub handle: i32, // handle
    #[wasm_bindgen(getter_with_clone)]
    pub extension: String,
    #[wasm_bindgen(getter_with_clone)]
    pub url: String,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct DataRequesterRemovedEvent {
    // Entity
    pub ind: u32,
    pub gen: u32,
    pub bits: u64,

    pub handle: i32,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub enum TextureFragmentStatus {
    Success,
    Fail,
    Pending,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct TextureFragmentRequestedEvent {
    pub ind: u32,
    pub gen: u32,
    pub bits: u64,
    #[wasm_bindgen(getter_with_clone)]
    pub url: String,
    #[wasm_bindgen(getter_with_clone)]
    pub status: TextureFragmentStatus,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct TerrainHeightUpdatedEvent {
    pub ind: u32,
    pub gen: u32,
    pub bits: u64,
    pub lle: LLE,
    pub height: Option<f64>,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct EntityEvent {
    pub ind: u32,
    pub gen: u32,
}

impl From<navara_event::Events<'_>> for Events {
    fn from(ev: navara_event::Events) -> Self {
        Self {
            camera_transform_updated: ev.camera_transform_updated.map(|ev| ev.into()),
            camera_frustum_updated: ev.camera_frustum_updated.map(|ev| ev.into()),
            object_transform_updated: ev
                .object_transform_updated
                .into_iter()
                .map(|ev| ev.into())
                .collect(),
            mesh_removed: ev.mesh_removed.into_iter().map(|ev| ev.into()).collect(),
            mesh_added: ev.mesh_added.into_iter().map(|ev| ev.into()).collect(),
            mesh_updated: ev.mesh_updated.into_iter().map(|ev| ev.into()).collect(),
            data_requested: ev.data_requested.into_iter().map(|ev| ev.into()).collect(),
            data_requester_removed: ev
                .data_requester_removed
                .into_iter()
                .map(|ev| ev.into())
                .collect(),
            texture_fragment_requested: ev
                .texture_fragment_reqested
                .into_iter()
                .map(|ev| ev.into())
                .collect(),
            texture_fragment_removed: ev
                .texture_fragment_removed
                .into_iter()
                .map(|ev| ev.into())
                .collect(),
            worker_task_delegated: ev
                .worker_task_delegated
                .into_iter()
                .map(|ev| ev.into())
                .collect(),
            worker_task_removed: ev
                .worker_task_removed
                .into_iter()
                .map(|ev| ev.into())
                .collect(),
            renderable_feature_added: ev
                .renderable_feature_added
                .into_iter()
                .map(|ev| ev.into())
                .collect(),
            renderable_feature_changed: ev
                .renderable_feature_changed
                .into_iter()
                .map(|ev| ev.into())
                .collect(),
            renderable_feature_removed: ev
                .renderable_feature_removed
                .into_iter()
                .map(|ev| ev.into())
                .collect(),
            update_sample_terrain_height: ev
                .update_sample_terrain_height
                .into_iter()
                .map(|ev| ev.into())
                .collect(),
        }
    }
}

impl From<navara_event_store::EntityEvent> for EntityEvent {
    fn from(ev: navara_event_store::EntityEvent) -> Self {
        Self {
            ind: ev.ind,
            gen: ev.gen,
        }
    }
}

impl<'a>
    From<
        navara_event_store::ReconstructableComponentEvent<
            &'a navara_tile_component::TerrainHeightObserver,
        >,
    > for TerrainHeightUpdatedEvent
{
    fn from(
        ev: navara_event_store::ReconstructableComponentEvent<
            &'a navara_tile_component::TerrainHeightObserver,
        >,
    ) -> Self {
        Self {
            ind: ev.ind,
            gen: ev.gen,
            bits: ev.bits,
            lle: ev.comp.lle.into(),
            height: ev.comp.height,
        }
    }
}

impl<'a> From<navara_event_store::ComponentEvent<&'a navara_math::Transform>>
    for ObjectTransformEvent
{
    fn from(ev: navara_event_store::ComponentEvent<&'a navara_math::Transform>) -> Self {
        Self {
            ind: ev.ind,
            gen: ev.gen,
            transform: ev.comp.into(),
        }
    }
}

impl
    From<
        navara_event_store::ComponentEventWithResource<
            (
                &navara_tile_component::TileMeshMarker,
                &navara_mesh::Mesh,
                &navara_material::RasterTileInternalMaterial,
                &navara_math::Transform,
            ),
            &navara_globe::Globe,
        >,
    > for MeshAdded
{
    fn from(
        ev: navara_event_store::ComponentEventWithResource<
            (
                &navara_tile_component::TileMeshMarker,
                &navara_mesh::Mesh,
                &navara_material::RasterTileInternalMaterial,
                &navara_math::Transform,
            ),
            &navara_globe::Globe,
        >,
    ) -> Self {
        Self {
            ind: ev.comp.ind,
            gen: ev.comp.gen,
            tile_handle: ev.comp.comp.0.handle,
            ready_parent_tile_handle: ev.comp.comp.0.ready_parent_tile_handle,
            mesh: ev.comp.comp.1.into(),
            material: ev.comp.comp.2.into(),
            transform: ev.comp.comp.3.into(),
            globe: ev.resource.into(),
        }
    }
}

impl
    From<
        navara_event_store::ComponentEventWithResource<
            (
                &navara_tile_component::TileMeshMarker,
                &navara_mesh::Mesh,
                &navara_material::RasterTileInternalMaterial,
            ),
            &navara_globe::Globe,
        >,
    > for MeshChanged
{
    fn from(
        ev: navara_event_store::ComponentEventWithResource<
            (
                &navara_tile_component::TileMeshMarker,
                &navara_mesh::Mesh,
                &navara_material::RasterTileInternalMaterial,
            ),
            &navara_globe::Globe,
        >,
    ) -> Self {
        Self {
            ind: ev.comp.ind,
            gen: ev.comp.gen,
            ready_parent_tile_handle: ev.comp.comp.0.ready_parent_tile_handle,
            mesh: ev.comp.comp.1.into(),
            material: ev.comp.comp.2.into(),
            globe: ev.resource.into(),
        }
    }
}

impl<'a> From<&'a navara_mesh::Mesh> for Mesh {
    fn from(m: &'a navara_mesh::Mesh) -> Self {
        Self {
            vertices: m.vertices,
            uvs: m.uvs,
            indices: m.indices,
            active: m.active,
            render_order: m.render_order,
            uv_transform: (&m.uv_transform).into(),
        }
    }
}

impl<'a> From<&'a navara_geometry::TileUvTransform> for TileUvTransform {
    fn from(m: &'a navara_geometry::TileUvTransform) -> Self {
        Self {
            offset: m.offset.into(),
            scale: m.scale.into(),
        }
    }
}

impl<'a>
    From<
        navara_event_store::ReconstructableComponentEvent<&'a navara_data_requester::DataRequester>,
    > for DataRequestEvent
{
    fn from(
        ev: navara_event_store::ReconstructableComponentEvent<
            &'a navara_data_requester::DataRequester,
        >,
    ) -> Self {
        Self {
            ind: ev.ind,
            gen: ev.gen,
            bits: ev.bits,
            handle: ev.comp.handle,
            extension: ev.comp.extension.to_string(),
            url: ev.comp.url.clone(),
        }
    }
}

impl<'a>
    From<
        navara_event_store::ReconstructableComponentEvent<&'a navara_data_requester::DataRequester>,
    > for DataRequesterRemovedEvent
{
    fn from(
        ev: navara_event_store::ReconstructableComponentEvent<
            &'a navara_data_requester::DataRequester,
        >,
    ) -> Self {
        Self {
            ind: ev.ind,
            gen: ev.gen,
            bits: ev.bits,
            handle: ev.comp.handle,
        }
    }
}

impl<'a>
    From<
        navara_event_store::ReconstructableComponentEvent<
            &'a navara_texture_fragment::TextureFragment,
        >,
    > for TextureFragmentRequestedEvent
{
    fn from(
        ev: navara_event_store::ReconstructableComponentEvent<
            &'a navara_texture_fragment::TextureFragment,
        >,
    ) -> Self {
        Self {
            ind: ev.ind,
            gen: ev.gen,
            bits: ev.bits,
            url: ev.comp.url.clone(),
            status: ev.comp.status.clone().into(),
        }
    }
}

impl From<TextureFragmentStatus> for navara_texture_fragment::TextureFragmentStatus {
    fn from(value: TextureFragmentStatus) -> Self {
        match value {
            TextureFragmentStatus::Success => {
                navara_texture_fragment::TextureFragmentStatus::Success
            }
            TextureFragmentStatus::Fail => navara_texture_fragment::TextureFragmentStatus::Fail,
            TextureFragmentStatus::Pending => {
                navara_texture_fragment::TextureFragmentStatus::Pending
            }
        }
    }
}

impl From<navara_texture_fragment::TextureFragmentStatus> for TextureFragmentStatus {
    fn from(value: navara_texture_fragment::TextureFragmentStatus) -> Self {
        match value {
            navara_texture_fragment::TextureFragmentStatus::Success => {
                TextureFragmentStatus::Success
            }
            navara_texture_fragment::TextureFragmentStatus::Fail => TextureFragmentStatus::Fail,
            navara_texture_fragment::TextureFragmentStatus::Pending => {
                TextureFragmentStatus::Pending
            }
        }
    }
}
