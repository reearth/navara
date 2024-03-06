use bevy_ecs::{component::Component, entity::Entity, world::World};

use crate::{DataRequester, Material, Mesh, Transform};

#[derive(Debug, Default)]
pub struct Events<'a> {
    pub camera_transform_updated: Option<&'a Transform>,
    pub object_transform_updated: Vec<ComponentEvent<&'a Transform>>,
    pub object_removed: Vec<EntityEvent>,
    pub mesh_added: Vec<ComponentEvent<(&'a Mesh, &'a Material, &'a Transform)>>,
    pub mesh_updated: Vec<ComponentEvent<(&'a Mesh, &'a Material)>>,
    pub data_requested: Vec<&'a DataRequester>,
}

#[derive(Debug)]
pub struct EntityEvent {
    pub ind: u32,
    pub gen: u32,
}

#[derive(Debug)]
pub struct ComponentEvent<T = ()> {
    pub ind: u32,
    pub gen: u32,
    pub comp: T,
}

impl From<Entity> for EntityEvent {
    fn from(e: Entity) -> Self {
        Self {
            ind: e.index(),
            gen: e.generation(),
        }
    }
}

impl<T> ComponentEvent<T> {
    pub fn new(e: Entity, comp: T) -> Self {
        Self {
            ind: e.index(),
            gen: e.generation(),
            comp,
        }
    }
}

impl<'a, T: Component> ComponentEvent<&'a T> {
    pub fn from_world(e: Entity, world: &'a World) -> Option<Self> {
        world.get::<T>(e).map(|comp| Self::new(e, comp))
    }
}

impl<'a, T: Component, U: Component> ComponentEvent<(&'a T, &'a U)> {
    pub fn from_world_2(e: Entity, world: &'a World) -> Option<Self> {
        let (Some(a), Some(b)) = (world.get::<T>(e), world.get::<U>(e)) else {
            return None;
        };

        Some(Self::new(e, (a, b)))
    }
}

impl<'a, T: Component, U: Component, V: Component> ComponentEvent<(&'a T, &'a U, &'a V)> {
    pub fn from_world_3(e: Entity, world: &'a World) -> Option<Self> {
        let (Some(a), Some(b), Some(c)) = (world.get::<T>(e), world.get::<U>(e), world.get::<V>(e))
        else {
            return None;
        };

        Some(Self::new(e, (a, b, c)))
    }
}
