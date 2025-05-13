use bevy_ecs::{component::Component, entity::Entity, world::World};

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

impl<'a, A: Component, B: Component, C: Component, D: Component>
    ComponentEvent<(&'a A, &'a B, &'a C, &'a D)>
{
    pub fn from_world_4(e: Entity, world: &'a World) -> Option<Self> {
        let (Some(a), Some(b), Some(c), Some(d)) = (
            world.get::<A>(e),
            world.get::<B>(e),
            world.get::<C>(e),
            world.get::<D>(e),
        ) else {
            return None;
        };

        Some(Self::new(e, (a, b, c, d)))
    }
}

impl<'a, A: Component, B: Component, C: Component, D: Component, E: Component>
    ComponentEvent<(&'a A, &'a B, &'a C, &'a D, &'a E)>
{
    pub fn from_world_5(entity: Entity, world: &'a World) -> Option<Self> {
        let (Some(a), Some(b), Some(c), Some(d), Some(e)) = (
            world.get::<A>(entity),
            world.get::<B>(entity),
            world.get::<C>(entity),
            world.get::<D>(entity),
            world.get::<E>(entity),
        ) else {
            return None;
        };

        Some(Self::new(entity, (a, b, c, d, e)))
    }
}

#[derive(Debug)]
pub struct ReconstructableComponentEvent<T = ()> {
    pub ind: u32,
    pub gen: u32,
    pub bits: u64,
    pub comp: T,
}

impl<T> ReconstructableComponentEvent<T> {
    pub fn new(e: Entity, comp: T) -> Self {
        Self {
            ind: e.index(),
            gen: e.generation(),
            bits: e.to_bits(),
            comp,
        }
    }
}

impl<'a, T: Component> ReconstructableComponentEvent<&'a T> {
    pub fn from_world(e: Entity, world: &'a World) -> Option<Self> {
        world.get::<T>(e).map(|comp| Self::new(e, comp))
    }
}

impl<'a, T: Component, U: Component> ReconstructableComponentEvent<(&'a T, &'a U)> {
    pub fn from_world_2(e: Entity, world: &'a World) -> Option<Self> {
        let (Some(a), Some(b)) = (world.get::<T>(e), world.get::<U>(e)) else {
            return None;
        };

        Some(Self::new(e, (a, b)))
    }
}

impl<'a, T: Component, U: Component, V: Component>
    ReconstructableComponentEvent<(&'a T, &'a U, &'a V)>
{
    pub fn from_world_3(e: Entity, world: &'a World) -> Option<Self> {
        let (Some(a), Some(b), Some(c)) = (world.get::<T>(e), world.get::<U>(e), world.get::<V>(e))
        else {
            return None;
        };

        Some(Self::new(e, (a, b, c)))
    }
}

impl<'a, T: Component, U: Component, V: Component>
    ReconstructableComponentEvent<(&'a T, &'a U, Option<&'a V>)>
{
    pub fn from_world_2_and_option(e: Entity, world: &'a World) -> Option<Self> {
        let (Some(a), Some(b), c) = (world.get::<T>(e), world.get::<U>(e), world.get::<V>(e))
        else {
            return None;
        };

        Some(Self::new(e, (a, b, c)))
    }
}
