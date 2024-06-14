use bevy_ecs::{entity::Entity, system::Resource, world::World};

use crate::{DataRequester, Transform};

use super::{ComponentEvent, Events};

#[derive(Debug, Default, Resource)]
pub struct EventStore {
    pub camera_transform_updated: Option<Entity>,
    pub object_transform_updated: Vec<Entity>,
    pub object_removed: Vec<Entity>,
    pub mesh_added: Vec<Entity>,
    pub mesh_updated: Vec<Entity>,
    pub data_requested: Vec<Entity>,
}

impl EventStore {
    pub fn clear(&mut self) {
        self.camera_transform_updated = None;
        self.object_transform_updated.clear();
        self.object_removed.clear();
        self.mesh_added.clear();
        self.mesh_updated.clear();
        self.data_requested.clear();
    }

    pub fn events<'a>(&self, world: &'a World) -> Events<'a> {
        let mut events = Events::default();
        if let Some(e) = self.camera_transform_updated {
            events.camera_transform_updated = world.get::<Transform>(e);
        }

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
            if let Some(e) = world.get::<DataRequester>(*e) {
                events.data_requested.push(e);
            }
        }

        events
    }
}
