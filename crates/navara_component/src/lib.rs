#![doc = include_str!("../README.md")]

mod priority;

pub use priority::*;

use bevy_ecs::component::Component;

#[derive(Component)]
pub struct Deleted;

#[derive(Component)]
pub struct Requested;

#[derive(Component)]
pub struct Ignored;

#[derive(Component)]
pub struct Rendered;
