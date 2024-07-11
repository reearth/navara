use bevy_ecs::component::Component;

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub enum TerrainDataType {
    RasterDEM,
    QuantizedMesh,
    #[default]
    Unknown,
}
