use bevy_ecs::component::Component;
use navara_material::{
    EllipsoidTerrainMaterial, QuantizedMeshTerrainMaterial, RasterTerrainMaterial,
};

#[derive(Debug, Clone, PartialEq)]
pub enum TerrainAppearance {
    Raster(RasterTerrainMaterial),
    Ellipsoid(EllipsoidTerrainMaterial),
    QuantizedMesh(QuantizedMeshTerrainMaterial),
}

impl TerrainAppearance {
    pub fn cast_shadow(&self) -> bool {
        match self {
            TerrainAppearance::Raster(mat) => mat.cast_shadow,
            TerrainAppearance::Ellipsoid(mat) => mat.cast_shadow,
            TerrainAppearance::QuantizedMesh(mat) => mat.cast_shadow,
        }
    }

    pub fn receive_shadow(&self) -> bool {
        match self {
            TerrainAppearance::Raster(mat) => mat.receive_shadow,
            TerrainAppearance::Ellipsoid(mat) => mat.receive_shadow,
            TerrainAppearance::QuantizedMesh(mat) => mat.receive_shadow,
        }
    }

    pub fn show(&self) -> bool {
        match self {
            TerrainAppearance::Raster(mat) => mat.show,
            TerrainAppearance::Ellipsoid(_) => true,
            TerrainAppearance::QuantizedMesh(mat) => mat.show,
        }
    }

    pub fn show_bounding_box(&self) -> bool {
        match self {
            TerrainAppearance::Raster(mat) => mat.show_bounding_box,
            TerrainAppearance::Ellipsoid(mat) => mat.show_bounding_box,
            TerrainAppearance::QuantizedMesh(mat) => mat.show_bounding_box,
        }
    }

    /// Whether to render skirts along tile boundaries to hide gaps.
    pub fn skirt(&self) -> bool {
        match self {
            TerrainAppearance::Raster(mat) => mat.skirt,
            TerrainAppearance::Ellipsoid(_) => false, // Ellipsoid terrain doesn't need skirts
            TerrainAppearance::QuantizedMesh(mat) => mat.skirt,
        }
    }

    /// Multiplier for the automatically calculated skirt height.
    pub fn skirt_exaggeration(&self) -> f32 {
        match self {
            TerrainAppearance::Raster(mat) => mat.skirt_exaggeration,
            TerrainAppearance::Ellipsoid(_) => 1.0,
            TerrainAppearance::QuantizedMesh(mat) => mat.skirt_exaggeration,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub struct TerrainLayer {
    pub layer_id: String,
    /// Id of the referenced `Source`. The loaders resolve the tile URL live
    /// from `SourceStore` by this id.
    pub source_id: Option<String>,
    pub terrain_type: TerrainDataType,
    pub appearance: Option<TerrainAppearance>,
}

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
