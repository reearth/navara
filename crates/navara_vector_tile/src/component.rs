use bevy_ecs::component::Component;

#[derive(Component)]
pub struct VectorTileFeatureMarker;

/// Marker inserted on a vector-tile source entity when a layer attaches to it
/// after tiles already rendered (e.g. a layer rebuilt against a live, cached
/// source). Resident tiles were built without that layer's features, so
/// `reload_source_tiles` destroys them and the next traversal re-renders each
/// tile with the source's current layer list.
#[derive(Component)]
pub struct ReloadSourceTiles;
