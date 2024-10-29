use bevy_ecs::{component::Component, entity::Entity};

#[derive(Component)]
pub struct B3dmLayerDataRequesterMarker(pub Entity);

#[derive(Component)]
pub struct B3dmDataRequesterMarker;
