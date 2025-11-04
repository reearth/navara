use crate::LayerData;
use bevy_ecs::component::Component;
use navara_material::RasterTerrainMaterial;

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub struct TerrainLayer {
    pub layer_id: String,
    pub data: Option<LayerData>,
    pub terrain_type: TerrainDataType,
    pub appearance: Option<RasterTerrainMaterial>,
}

impl TerrainLayer {
    pub fn is_over_max_zoom(&self, z: usize) -> bool {
        z >= self.appearance.as_ref().unwrap().max_zoom
    }

    pub fn is_over_min_zoom(&self, z: usize) -> bool {
        z >= self.appearance.as_ref().unwrap().min_zoom
    }
}

#[derive(Debug, Clone, PartialEq, Default)]
pub enum TerrainDataType {
    RasterDEM,
    QuantizedMesh,
    #[default]
    Unknown,
}

impl TerrainDataType {
    pub fn from_url(url: &str) -> Self {
        match url.split('?').next() {
            Some(s) if ["png", "pngraw"].iter().any(|e| s.ends_with(e)) => {
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
            TerrainDataType::from_url("https://example.com/terrain.terrain"),
            TerrainDataType::QuantizedMesh
        );

        assert_eq!(
            TerrainDataType::from_url("https://example.com/terrain.json"),
            TerrainDataType::Unknown
        );
    }
}
