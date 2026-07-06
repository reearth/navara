use bevy_ecs::component::Component;
use navara_core::CRS;

use navara_material::{Appearance, ModelMaterial};

#[derive(Debug, Clone, PartialEq, Component)]
pub struct PntsLayer {
    pub layer_id: String,
    /// Reference to the source whose fetch config (URL) this layer uses. The
    /// loader resolves it live from `SourceStore`.
    pub source_id: Option<String>,
    pub appearances: Vec<Appearance>,
    pub crs: Option<CRS>,
}

#[derive(Debug, Component)]
pub struct UpdatePntsLayerMarker {
    pub layer_id: String,
    pub material: ModelMaterial,
}

#[derive(Debug, Component)]
pub struct DeletePntsLayerMarker(pub String);
