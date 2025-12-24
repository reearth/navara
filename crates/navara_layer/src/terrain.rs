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
            TerrainAppearance::Raster(mat) => {
                let default = RasterTerrainMaterial::default();
                mat.max_zoom.or(default.max_zoom).unwrap_or(0)
            }
            TerrainAppearance::Ellipsoid(mat) => {
                let default = EllipsoidTerrainMaterial::default();
                mat.max_zoom.or(default.max_zoom).unwrap_or(0)
            }
        }
    }

    pub fn min_zoom(&self) -> usize {
        match self {
            TerrainAppearance::Raster(mat) => {
                let default = RasterTerrainMaterial::default();
                mat.min_zoom.or(default.min_zoom).unwrap_or(0)
            }
            TerrainAppearance::Ellipsoid(mat) => {
                let default = EllipsoidTerrainMaterial::default();
                mat.min_zoom.or(default.min_zoom).unwrap_or(0)
            }
        }
    }

    pub fn overscaled_max_zoom(&self) -> usize {
        match self {
            TerrainAppearance::Raster(mat) => {
                let default = RasterTerrainMaterial::default();
                mat.overscaled_max_zoom
                    .or(default.overscaled_max_zoom)
                    .unwrap_or(0)
            }
            TerrainAppearance::Ellipsoid(_) => 30, // Ellipsoid has no max zoom limit
        }
    }

    pub fn elevation_decoder(&self) -> Option<&ElevationDecoder> {
        match self {
            TerrainAppearance::Raster(mat) => mat.elevation_decoder.as_ref(),
            TerrainAppearance::Ellipsoid(_) => None,
        }
    }

    pub fn tile_size(&self) -> u32 {
        match self {
            TerrainAppearance::Raster(mat) => {
                let default = RasterTerrainMaterial::default();
                mat.tile_size.or(default.tile_size).unwrap_or(256)
            }
            TerrainAppearance::Ellipsoid(_) => 256,
        }
    }

    pub fn cast_shadow(&self) -> bool {
        match self {
            TerrainAppearance::Raster(mat) => {
                let default = RasterTerrainMaterial::default();
                mat.cast_shadow.or(default.cast_shadow).unwrap_or(false)
            }
            TerrainAppearance::Ellipsoid(mat) => {
                let default = EllipsoidTerrainMaterial::default();
                mat.cast_shadow.or(default.cast_shadow).unwrap_or(false)
            }
        }
    }

    pub fn receive_shadow(&self) -> bool {
        match self {
            TerrainAppearance::Raster(mat) => {
                let default = RasterTerrainMaterial::default();
                mat.receive_shadow.or(default.receive_shadow).unwrap_or(false)
            }
            TerrainAppearance::Ellipsoid(mat) => {
                let default = EllipsoidTerrainMaterial::default();
                mat.receive_shadow.or(default.receive_shadow).unwrap_or(false)
            }
        }
    }

    pub fn show(&self) -> bool {
        match self {
            TerrainAppearance::Raster(mat) => {
                let default = RasterTerrainMaterial::default();
                mat.show.or(default.show).unwrap_or(true)
            }
            TerrainAppearance::Ellipsoid(_) => true,
        }
    }

    pub fn show_bounding_box(&self) -> bool {
        match self {
            TerrainAppearance::Raster(mat) => {
                let default = RasterTerrainMaterial::default();
                mat.show_bounding_box
                    .or(default.show_bounding_box)
                    .unwrap_or(false)
            }
            TerrainAppearance::Ellipsoid(mat) => {
                let default = EllipsoidTerrainMaterial::default();
                mat.show_bounding_box
                    .or(default.show_bounding_box)
                    .unwrap_or(false)
            }
        }
    }

    /// Whether to render skirts along tile boundaries to hide gaps.
    pub fn skirt(&self) -> bool {
        match self {
            TerrainAppearance::Raster(mat) => {
                let default = RasterTerrainMaterial::default();
                mat.skirt.or(default.skirt).unwrap_or(true)
            }
            TerrainAppearance::Ellipsoid(_) => false, // Ellipsoid terrain doesn't need skirts
        }
    }

    /// Multiplier for the automatically calculated skirt height.
    pub fn skirt_exaggeration(&self) -> f32 {
        match self {
            TerrainAppearance::Raster(mat) => {
                let default = RasterTerrainMaterial::default();
                mat.skirt_exaggeration
                    .or(default.skirt_exaggeration)
                    .unwrap_or(1.0)
            }
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

    pub fn merge(&self, other: &TerrainLayer) -> TerrainLayer {
        TerrainLayer {
            layer_id: self.layer_id.clone(),
            data: other.data.clone().or_else(|| self.data.clone()),
            terrain_type: match other.terrain_type {
                TerrainDataType::Unknown => self.terrain_type.clone(),
                _ => other.terrain_type.clone(),
            },
            appearance: other.appearance.as_ref().and_then(|other_appearance| {
                self.appearance.as_ref().map(|self_appearance| {
                    match (other_appearance, self_appearance) {
                        (TerrainAppearance::Raster(dist), TerrainAppearance::Raster(src)) => {
                            TerrainAppearance::Raster(dist.merge(src))
                        }
                        (TerrainAppearance::Ellipsoid(dist), TerrainAppearance::Ellipsoid(src)) => {
                            TerrainAppearance::Ellipsoid(dist.merge(src))
                        }
                        _ => other_appearance.clone(),
                    }
                })
            }),
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
