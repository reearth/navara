use crate::LayerData;
use bevy_ecs::component::Component;
use navara_core::ElevationDecoder;
use navara_material::{EllipsoidTerrainMaterial, RasterTerrainMaterial};

#[derive(Debug, Clone, PartialEq)]
pub enum TerrainAppearance {
    Raster(RasterTerrainMaterial),
    Ellipsoid(EllipsoidTerrainMaterial),
}

impl TerrainAppearance {
    pub fn max_zoom(&self) -> usize {
        match self {
            TerrainAppearance::Raster(mat) => mat.max_zoom,
            TerrainAppearance::Ellipsoid(mat) => mat.max_zoom,
        }
    }

    pub fn min_zoom(&self) -> usize {
        match self {
            TerrainAppearance::Raster(mat) => mat.min_zoom,
            TerrainAppearance::Ellipsoid(mat) => mat.min_zoom,
        }
    }

    pub fn overscaled_max_zoom(&self) -> usize {
        match self {
            TerrainAppearance::Raster(mat) => mat.overscaled_max_zoom,
            TerrainAppearance::Ellipsoid(_) => 30, // Ellipsoid has no max zoom limit
        }
    }

    pub fn elevation_decoder(&self) -> Option<&ElevationDecoder> {
        match self {
            TerrainAppearance::Raster(mat) => Some(&mat.elevation_decoder),
            TerrainAppearance::Ellipsoid(_) => None,
        }
    }

    pub fn tile_size(&self) -> u32 {
        match self {
            TerrainAppearance::Raster(mat) => mat.tile_size,
            TerrainAppearance::Ellipsoid(_) => 256,
        }
    }

    pub fn cast_shadow(&self) -> bool {
        match self {
            TerrainAppearance::Raster(mat) => mat.cast_shadow,
            TerrainAppearance::Ellipsoid(mat) => mat.cast_shadow,
        }
    }

    pub fn receive_shadow(&self) -> bool {
        match self {
            TerrainAppearance::Raster(mat) => mat.receive_shadow,
            TerrainAppearance::Ellipsoid(mat) => mat.receive_shadow,
        }
    }

    pub fn show(&self) -> bool {
        match self {
            TerrainAppearance::Raster(mat) => mat.show,
            TerrainAppearance::Ellipsoid(_) => true,
        }
    }

    pub fn show_bounding_box(&self) -> bool {
        match self {
            TerrainAppearance::Raster(mat) => mat.show_bounding_box,
            TerrainAppearance::Ellipsoid(mat) => mat.show_bounding_box,
        }
    }

    /// Whether to render skirts along tile boundaries to hide gaps.
    pub fn skirt(&self) -> bool {
        match self {
            TerrainAppearance::Raster(mat) => mat.skirt,
            TerrainAppearance::Ellipsoid(_) => false, // Ellipsoid terrain doesn't need skirts
        }
    }

    /// Multiplier for the automatically calculated skirt height.
    pub fn skirt_exaggeration(&self) -> f32 {
        match self {
            TerrainAppearance::Raster(mat) => mat.skirt_exaggeration,
            TerrainAppearance::Ellipsoid(_) => 1.0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub struct TerrainLayer {
    pub layer_id: String,
    pub data: Option<LayerData>,
    pub terrain_type: TerrainDataType,
    pub appearance: Option<TerrainAppearance>,
}

impl TerrainLayer {
    pub fn should_upsample(&self, z: usize) -> bool {
        self.is_over_max_zoom(z) && !self.is_over_overscaled_max_zoom(z)
    }

    pub fn is_over_max_zoom(&self, z: usize) -> bool {
        match &self.terrain_type {
            TerrainDataType::Ellipsoid => false, // Ellipsoid has no max zoom limit
            _ => self
                .appearance
                .as_ref()
                .is_some_and(|app| z >= app.max_zoom()),
        }
    }

    pub fn is_over_overscaled_max_zoom(&self, z: usize) -> bool {
        match &self.terrain_type {
            TerrainDataType::Ellipsoid => false, // Ellipsoid has no max zoom limit
            _ => self
                .appearance
                .as_ref()
                .is_some_and(|app| z >= app.overscaled_max_zoom()),
        }
    }

    pub fn is_over_min_zoom(&self, z: usize) -> bool {
        match &self.terrain_type {
            TerrainDataType::Ellipsoid => true, // Ellipsoid starts from zoom 0
            _ => self
                .appearance
                .as_ref()
                .is_some_and(|app| z >= app.min_zoom()),
        }
    }
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
