use bevy_ecs::{component::Component, entity::Entity};

#[derive(Component)]
pub struct MvtDataRequesterMarker(pub Entity);

#[derive(Component)]
pub struct SingleMvtDataRequesterMarker;

// #[derive(Component)]
// pub struct MvtContentDataRequesterMarker;
