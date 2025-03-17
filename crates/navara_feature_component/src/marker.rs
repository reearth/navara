use bevy_ecs::component::Component;

#[derive(Component)]
pub struct DeletedFeatureMarker;

#[derive(Component)]
pub struct BatchedFeatureMarker;

// This is used for a feature that is needed to switch LOD. For example, MVT's feature is need to be switched by LOD.
#[derive(Component)]
pub struct LODFeatureMarker;
