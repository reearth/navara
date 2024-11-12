mod feature;
mod feature_event;

use feature_event::{RenderableFeatureAddedEvent, RenderableFeatureChangedEvent};
use navara_math::FloatType;
use navara_tile::tile::TileHandle;
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(getter_with_clone)]
#[derive(Debug, Clone, Serialize)]
pub struct Events {
    pub camera_transform_updated: Option<Transform>,
    pub object_transform_updated: Vec<ObjectTransformEvent>,
    pub mesh_removed: Vec<EntityEvent>,
    pub mesh_added: Vec<MeshAdded>,
    pub mesh_updated: Vec<MeshChanged>,
    pub data_requested: Vec<DataRequestEvent>,
    pub data_requester_removed: Vec<EntityEvent>,
    pub texture_fragment_requested: Vec<TextureFragmentRequestedEvent>,
    pub texture_fragment_removed: Vec<EntityEvent>,
    pub renderable_feature_added: Vec<RenderableFeatureAddedEvent>,
    pub renderable_feature_changed: Vec<RenderableFeatureChangedEvent>,
    pub renderable_feature_removed: Vec<EntityEvent>,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct ObjectTransformEvent {
    pub ind: u32,
    pub gen: u32,
    pub transform: Transform,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize)]
pub struct Transform {
    pub tx: FloatType,
    pub ty: FloatType,
    pub tz: FloatType,
    pub qx: FloatType,
    pub qy: FloatType,
    pub qz: FloatType,
    pub qw: FloatType,
    pub sx: FloatType,
    pub sy: FloatType,
    pub sz: FloatType,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct MeshAdded {
    pub ind: u32,
    pub gen: u32,
    pub tile_handle: TileHandle,
    pub mesh: Mesh,
    #[wasm_bindgen(getter_with_clone)]
    pub material: MeshMaterial,
    pub transform: Transform,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct MeshChanged {
    pub ind: u32,
    pub gen: u32,
    pub mesh: Mesh,
    #[wasm_bindgen(getter_with_clone)]
    pub material: MeshMaterial,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Copy, Serialize)]
pub struct Mesh {
    pub vertices: i32, // handle
    pub uvs: i32,      // handle
    pub indices: i32,  // handle
    pub active: bool,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct TextureFragment {
    pub ind: u32,
    pub gen: u32,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct MeshMaterial {
    pub color: u32,
    pub show: bool,
    pub wireframe: bool,
    pub should_compute_normal_from_vertex: bool,
    #[wasm_bindgen(getter_with_clone)]
    pub texture_fragment: Option<TextureFragment>,
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
pub struct EntityEvent {
    pub ind: u32,
    pub gen: u32,
}

impl<'a> From<navara_event::Events<'a>> for Events {
    fn from(ev: navara_event::Events) -> Self {
        Self {
            camera_transform_updated: ev.camera_transform_updated.map(|ev| ev.into()),
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

impl<'a> From<&'a navara_math::Transform> for Transform {
    fn from(t: &'a navara_math::Transform) -> Self {
        Self {
            tx: t.translation.x,
            ty: t.translation.y,
            tz: t.translation.z,
            qx: t.rotation.x,
            qy: t.rotation.y,
            qz: t.rotation.z,
            qw: t.rotation.w,
            sx: t.scale.x,
            sy: t.scale.y,
            sz: t.scale.z,
        }
    }
}

impl
    From<
        navara_event_store::ComponentEvent<(
            &navara_tile::tile::TileMeshMarker,
            &navara_mesh::Mesh,
            &navara_mesh::Material,
            &navara_math::Transform,
        )>,
    > for MeshAdded
{
    fn from(
        ev: navara_event_store::ComponentEvent<(
            &navara_tile::tile::TileMeshMarker,
            &navara_mesh::Mesh,
            &navara_mesh::Material,
            &navara_math::Transform,
        )>,
    ) -> Self {
        Self {
            ind: ev.ind,
            gen: ev.gen,
            tile_handle: ev.comp.0 .0,
            mesh: ev.comp.1.into(),
            material: ev.comp.2.clone().into(),
            transform: ev.comp.3.into(),
        }
    }
}

impl From<navara_event_store::ComponentEvent<(&navara_mesh::Mesh, &navara_mesh::Material)>>
    for MeshChanged
{
    fn from(
        ev: navara_event_store::ComponentEvent<(&navara_mesh::Mesh, &navara_mesh::Material)>,
    ) -> Self {
        Self {
            ind: ev.ind,
            gen: ev.gen,
            mesh: ev.comp.0.into(),
            material: ev.comp.1.clone().into(),
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
        }
    }
}

impl From<navara_mesh::Material> for MeshMaterial {
    fn from(m: navara_mesh::Material) -> Self {
        Self {
            color: m.color,
            show: m.show,
            wireframe: m.wireframe,
            should_compute_normal_from_vertex: m.should_compute_normal_from_vertex,
            texture_fragment: m.texture_fragment.map(|t| TextureFragment {
                ind: t.index(),
                gen: t.generation(),
            }),
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
