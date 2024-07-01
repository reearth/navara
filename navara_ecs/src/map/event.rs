use bevy_ecs::prelude::*;

// use crate::{event::EventStore, BufferStoreEvent, DataRequester};

use super::{
    terrain::{layer::TerrainLayer, TerrainDataType},
    tile::layer::TilesLayer,
    LayerDescription,
};

#[derive(Debug, Clone, PartialEq, Event)]
pub struct AddLayerEvent(pub LayerDescription);

pub fn process_add_events(mut commands: Commands, mut events: EventReader<AddLayerEvent>) {
    for ev in events.read() {
        let AddLayerEvent(desc) = ev;
        match desc {
            LayerDescription::Tiles {
                url,
                segments,
                color,
                max_sse,
                max_z,
                wireframe,
            } => {
                commands.spawn(TilesLayer {
                    url: url.clone(),
                    segments: *segments,
                    color: *color,
                    max_sse: *max_sse,
                    max_z: *max_z,
                    wireframe: *wireframe,
                });
            }
            LayerDescription::Terrain {
                url,
                segments,
                color,
                max_sse,
                max_z,
                wireframe,
            } => {
                commands.spawn(TerrainLayer {
                    url: url.clone(),
                    segments: *segments,
                    color: *color,
                    max_sse: *max_sse,
                    max_z: *max_z,
                    wireframe: *wireframe,
                    terrain_type: match url.split(".").last() {
                        Some(s) if s == "png" => TerrainDataType::RasterDEM,
                        Some(s) if s == "terrain" => TerrainDataType::QuantizedMesh,
                        _ => TerrainDataType::Unknown,
                    },
                });
            }
        }
    }
}
