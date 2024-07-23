use bevy_ecs::{entity::Entity, system::Resource, world::World};

use crate::Transform;

use super::{
    CameraControlEvent, CameraDebugState, ComponentEvent, Events, ReconstructableComponentEvent,
};

#[derive(Debug, Default, Resource)]
pub struct EventStore {
    pub camera_transform_updated: Option<Entity>,
    pub camera_control_events: Vec<CameraControlEvent>,
    pub debug_camera_state: Option<CameraDebugState>,
    pub object_transform_updated: Vec<Entity>,
    pub object_removed: Vec<Entity>,
    pub mesh_added: Vec<Entity>,
    pub mesh_updated: Vec<Entity>,
    pub data_requested: Vec<Entity>, // FIXME: Make a data_removed event to remove unnecessary data
    pub texture_fragment_reqested: Vec<Entity>,
    pub texture_fragment_removed: Vec<Entity>,
    pub renderable_feature_added: Vec<Entity>,
    pub renderable_feature_removed: Vec<Entity>,
}

impl EventStore {
    pub fn clear(&mut self) {
        self.camera_transform_updated = None;
        self.camera_control_events.clear();
        self.debug_camera_state = None;
        self.object_transform_updated.clear();
        self.object_removed.clear();
        self.mesh_added.clear();
        self.mesh_updated.clear();
        self.data_requested.clear();
        self.texture_fragment_reqested.clear();
        self.texture_fragment_removed.clear();
        self.renderable_feature_added.clear();
        self.renderable_feature_removed.clear();
    }

    pub fn events<'a>(&self, world: &'a World) -> Events<'a> {
        let mut events = Events::default();
        if let Some(e) = self.camera_transform_updated {
            events.camera_transform_updated = world.get::<Transform>(e);
        }

        events.camera_control_event = self.camera_control_events.clone();

        for e in self.object_transform_updated.iter() {
            if let Some(e) = ComponentEvent::from_world(*e, world) {
                events.object_transform_updated.push(e);
            }
        }

        for e in self.object_removed.iter() {
            events.object_removed.push((*e).into());
        }

        for e in self.mesh_added.iter() {
            if let Some(e) = ComponentEvent::from_world_3(*e, world) {
                events.mesh_added.push(e);
            }
        }

        for e in self.mesh_updated.iter() {
            if let Some(e) = ComponentEvent::from_world_2(*e, world) {
                events.mesh_updated.push(e);
            }
        }

        for e in self.data_requested.iter() {
            if let Some(e) = ReconstructableComponentEvent::from_world(*e, world) {
                events.data_requested.push(e);
            }
        }

        for e in self.texture_fragment_reqested.iter() {
            if let Some(e) = ReconstructableComponentEvent::from_world(*e, world) {
                events.texture_fragment_reqested.push(e);
            }
        }

        for e in self.texture_fragment_removed.iter() {
            events.texture_fragment_removed.push((*e).into());
        }

        events.debug_camera_state = self.debug_camera_state.clone();

        for e in self.renderable_feature_added.iter() {
            if let Some(e) = ReconstructableComponentEvent::from_world(*e, world) {
                events.renderable_feature_added.push(e);
            }
        }

        for e in self.renderable_feature_removed.iter() {
            events.renderable_feature_removed.push((*e).into());
        }
        events
    }
}
