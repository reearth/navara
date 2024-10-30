use bevy_ecs::{component::Component, entity::Entity};

#[derive(Component, Default)]
pub struct FeatureId(pub Option<Entity>);
