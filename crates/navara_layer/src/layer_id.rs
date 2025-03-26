use bevy_ecs::component::Component;

#[derive(Hash, Eq, PartialEq, Debug, Clone, Default, Component)]
pub struct LayerId(pub String);
