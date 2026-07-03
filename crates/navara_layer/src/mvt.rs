use bevy_ecs::component::Component;
use navara_core::CRS;

use navara_material::Appearance;

#[derive(Debug, Clone, PartialEq, Component)]
pub struct MvtLayer {
    pub layer_id: String,
    /// Reference to the source whose fetch config (URL, zoom, ...) this layer
    /// uses. The loader resolves it live from `SourceStore`.
    pub source_id: Option<String>,
    /// Source layers (MapLibre `source-layer`) to render. `None` renders all.
    pub source_layers: Option<Vec<String>>,
    pub appearances: Vec<Appearance>,
    pub crs: Option<CRS>,
}

#[derive(Debug, Component)]
pub struct UpdateMvtLayerMarker {
    pub layer_id: String,
    pub appearance: Appearance,
}

#[derive(Debug, Component)]
pub struct DeleteMvtLayerMarker(pub String);
