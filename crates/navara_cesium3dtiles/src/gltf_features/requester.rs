use bevy_ecs::component::Component;

/// Marker for data requesters fetching glTF content with 1.1 extensions.
#[derive(Component)]
pub struct GltfFeaturesDataRequesterMarker;
