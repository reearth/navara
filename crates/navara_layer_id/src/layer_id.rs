use bevy_ecs::component::Component;

#[derive(Hash, Eq, PartialEq, Debug, Component)]
pub struct LayerId(pub String);
