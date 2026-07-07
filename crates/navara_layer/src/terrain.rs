use bevy_ecs::component::Component;
use navara_material::TerrainMaterial;

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub struct TerrainLayer {
    pub layer_id: String,
    /// Id of the referenced `Source`. The loaders resolve the tile URL live
    /// from `SourceStore` by this id.
    pub source_id: Option<String>,
    pub terrain_type: TerrainDataType,
    /// Render-only appearance. The data format is carried by `terrain_type`;
    /// the ellipsoid case bakes its defaults (`skirt = false`) at construction.
    pub appearance: Option<TerrainMaterial>,
}

/// Spawned when a terrain layer's appearance is updated. Consumed by the tile
/// crate's `update_terrain_layer` system, which re-applies the render fields to
/// the live tiles. A source change is handled by rebuilding the layer (see
/// `Core::update_layer`), not through this marker.
#[derive(Debug, Component)]
pub struct UpdateTerrainLayerMarker {
    pub layer_id: String,
    pub material: TerrainMaterial,
}

/// Spawned when a terrain layer is deleted. Consumed by the tile crate's
/// `sync_terrain_layer_changes` system, which despawns the `TerrainLayer` entity
/// and re-flattens the globe.
#[derive(Debug, Component)]
pub struct DeleteTerrainLayerMarker(pub String);

#[derive(Debug, Clone, PartialEq, Default)]
pub enum TerrainDataType {
    RasterDEM,
    QuantizedMesh,
    Ellipsoid,
    #[default]
    Unknown,
}

impl TerrainDataType {
    pub fn from_url(url: &str) -> Self {
        match url.split('?').next() {
            Some(s) if ["png", "pngraw", "webp"].iter().any(|e| s.ends_with(e)) => {
                TerrainDataType::RasterDEM
            }
            Some(s) if ["terrain"].iter().any(|e| s.ends_with(e)) => TerrainDataType::QuantizedMesh,
            _ => TerrainDataType::Unknown,
        }
    }
}

#[cfg(test)]
mod test {
    use crate::TerrainDataType;

    #[test]
    fn it_should_return_correct_terrain_data_type() {
        assert_eq!(
            TerrainDataType::from_url("https://example.com/terrain.png"),
            TerrainDataType::RasterDEM
        );
        assert_eq!(
            TerrainDataType::from_url("https://example.com/terrain.png?token=abs"),
            TerrainDataType::RasterDEM
        );
        assert_eq!(
            TerrainDataType::from_url("https://example.com/terrain.pngraw"),
            TerrainDataType::RasterDEM
        );
        assert_eq!(
            TerrainDataType::from_url("https://example.com/terrain.webp"),
            TerrainDataType::RasterDEM
        );

        assert_eq!(
            TerrainDataType::from_url("https://example.com/terrain.terrain"),
            TerrainDataType::QuantizedMesh
        );

        assert_eq!(
            TerrainDataType::from_url("https://example.com/terrain.json"),
            TerrainDataType::Unknown
        );
    }
}
