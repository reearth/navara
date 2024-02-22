use serde::Serialize;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(getter_with_clone)]
#[derive(Debug, Clone, Serialize)]
pub struct Events {
    pub camera_transform_updated: Option<Transform>,
    pub object_transform_updated: Vec<ObjectTransformEvent>,
    pub object_removed: Vec<ObjectEvent>,
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct ObjectEvent {
    pub ind: u32,
    pub gen: u32,
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
    pub tx: f32,
    pub ty: f32,
    pub tz: f32,
    pub qx: f32,
    pub qy: f32,
    pub qz: f32,
    pub qw: f32,
    pub sx: f32,
    pub sy: f32,
    pub sz: f32,
}

impl<'a> From<map_engine_ecs::Events<'a>> for Events {
    fn from(ev: map_engine_ecs::Events) -> Self {
        Self {
            camera_transform_updated: ev.camera_transform_updated.map(|ev| (*ev).into()),
            object_transform_updated: ev
                .object_transform_updated
                .into_iter()
                .map(|ev| ev.into())
                .collect(),
            object_removed: ev.object_removed.into_iter().map(|ev| ev.into()).collect(),
        }
    }
}

impl From<map_engine_ecs::EntityEvent> for ObjectEvent {
    fn from(ev: map_engine_ecs::EntityEvent) -> Self {
        Self {
            ind: ev.ind,
            gen: ev.gen,
        }
    }
}

impl<'a> From<map_engine_ecs::ComponentEvent<'a, map_engine_ecs::Transform>>
    for ObjectTransformEvent
{
    fn from(ev: map_engine_ecs::ComponentEvent<'a, map_engine_ecs::Transform>) -> Self {
        Self {
            ind: ev.ind,
            gen: ev.gen,
            transform: (*ev.comp).into(),
        }
    }
}

impl From<map_engine_ecs::Transform> for Transform {
    fn from(t: map_engine_ecs::Transform) -> Self {
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
