use bevy_ecs::{component::Component, entity::Entity};

#[derive(Component, Default, Debug)]
pub struct FeatureId(pub Option<Entity>);
