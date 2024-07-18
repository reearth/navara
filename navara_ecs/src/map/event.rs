use bevy_ecs::prelude::*;

pub use navara_layer::{LayerDescription, TerrainDataType, TerrainLayer, TilesLayer};

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
                elevation_decoder,
            } => {
                commands.spawn(TerrainLayer {
                    url: url.clone(),
                    segments: *segments,
                    color: *color,
                    max_sse: *max_sse,
                    max_z: *max_z,
                    wireframe: *wireframe,
                    elevation_decoder: elevation_decoder.clone(),
                    terrain_type: TerrainDataType::from_url(url),
                });
            }
        }
    }
}
