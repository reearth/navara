#![doc = include_str!("../README.md")]

mod order;
mod priority;

pub use order::*;
pub use priority::*;

use bevy_ecs::component::Component;

#[derive(Component)]
pub struct Deleted;

#[derive(Component)]
pub struct Requested;

#[derive(Component)]
pub struct Completed;

#[derive(Component)]
pub struct Ignored;

#[derive(Component)]
pub struct Rendered;
