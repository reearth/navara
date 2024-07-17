use bevy_ecs::{component::Component, entity::Entity, world::World};
use bevy_input::keyboard::KeyCode;
use bevy_math::{Quat, Vec2, Vec3};

use crate::{texture_fragment::TextureFragment, DataRequester, Material, Mesh, Transform};

#[derive(Debug, Default)]
pub struct Events<'a> {
    pub camera_transform_updated: Option<&'a Transform>,
    pub camera_control_event: Vec<CameraControlEvent>,
    pub object_transform_updated: Vec<ComponentEvent<&'a Transform>>,
    pub object_removed: Vec<EntityEvent>,
    pub mesh_added: Vec<ComponentEvent<(&'a Mesh, &'a Material, &'a Transform)>>,
    pub mesh_updated: Vec<ComponentEvent<(&'a Mesh, &'a Material)>>,
    pub data_requested: Vec<&'a DataRequester>,
    pub texture_fragment_reqested: Vec<ReconstructableComponentEvent<&'a TextureFragment>>,
    pub texture_fragment_removed: Vec<EntityEvent>,
    pub debug_camera_state: Option<CameraDebugState>,
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

#[derive(Debug, Clone)]
pub enum CameraControlEvent {
    FirstPerson(FirstPersonAction),
    Fly(FlyAction),
    Globe(GlobeAction),
    Planar(PlanarAction),
    Street(StreetAction),
    Dolly(DollyAction),
    Track(TrackAction),
    PanTilt(PanTiltAction),
    Inertia(InertiaAction),
}

#[derive(Debug, Clone)]
pub enum FirstPersonAction {
    Move(Vec3),
    Rotate(Quat),
}

#[derive(Debug, Clone)]
pub enum FlyAction {
    Move(Vec3),
    Rotate(Quat),
}

#[derive(Debug, Clone)]
pub enum GlobeAction {
    Track(Vec2),
    Dolly(f32),
    Rotate(Quat),
}

#[derive(Debug, Clone)]
pub enum PlanarAction {
    Pan(Vec2),
    Tilt(f32),
}

#[derive(Debug, Clone)]
pub enum StreetAction {
    Move(Vec3),
    Rotate(Quat),
}

#[derive(Debug, Clone)]
pub enum DollyAction {
    Move(f32),
}

#[derive(Debug, Clone)]
pub enum TrackAction {
    Move(Vec2),
}

#[derive(Debug, Clone)]
pub enum PanTiltAction {
    Pan(f32),
    Tilt(f32),
}

#[derive(Debug, Clone)]
pub enum InertiaAction {
    Apply(f32),
}

#[derive(Debug, Clone)]
pub struct CameraDebugState {
    pub current_control_type: CameraControlType,
    pub last_input: InputState,
}

#[derive(Debug, Clone, Copy)]
pub enum CameraControlType {
    FirstPerson,
    Fly,
    Globe,
    Planar,
    Street,
    Dolly,
    Track,
    PanTilt,
    Inertia,
}

#[derive(Debug, Clone)]
pub struct InputState {
    pub mouse_position: Vec2,
    pub mouse_delta: Vec2,
    pub scroll_delta: f32,
    pub pressed_keys: Vec<KeyCode>,
}
