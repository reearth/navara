use bevy_ecs::component::Component;

/// Marker component for rendered tiles containing glTF with 3D Tiles 1.1 extensions
/// (EXT_mesh_features and/or EXT_structural_metadata).
#[derive(Component)]
pub struct RenderedCesium3dTileContentGltfFeaturesMarker;
