use bevy_ecs::{component::Component, entity::Entity};

#[derive(Component)]
pub struct PntsLayerDataRequesterMarker(pub Entity);

#[derive(Component)]
pub struct PntsDataRequesterMarker;
