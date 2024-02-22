use bevy_ecs::{entity::Entity, system::Resource, world::World};

use crate::Transform;

use super::{ComponentEvent, Events};

#[derive(Debug, Default, Resource)]
pub struct EventStore {
    pub camera_transform_updated: Option<Entity>,
    pub object_transform_updated: Vec<Entity>,
    pub object_removed: Vec<Entity>,
}

impl EventStore {
    pub fn clear(&mut self) {
        self.camera_transform_updated = None;
        self.object_transform_updated.clear();
        self.object_removed.clear();
    }

    pub fn events<'a>(&self, world: &'a World) -> Events<'a> {
        let mut events = Events::default();
        if let Some(e) = self.camera_transform_updated {
            events.camera_transform_updated = world.get::<Transform>(e);
        }

        for e in self.object_transform_updated.iter() {
            if let Some(e) = ComponentEvent::new(*e, world) {
                events.object_transform_updated.push(e);
            }
        }

        for e in self.object_removed.iter() {
            events.object_removed.push((*e).into());
        }

        events
    }
}
