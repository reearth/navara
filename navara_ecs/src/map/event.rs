use bevy_ecs::prelude::*;

// use crate::{event::EventStore, BufferStoreEvent, DataRequester};

use super::{tile::Tiles, LayerDescription};

#[derive(Debug, Clone, PartialEq, Event)]
pub struct AddLayerEvent(pub LayerDescription);

pub fn process_add_events(mut commands: Commands, mut events: EventReader<AddLayerEvent>) {
    for ev in events.read() {
        let AddLayerEvent(desc) = ev;
        match desc {
            LayerDescription::Tiles {
                tile_url,
                terrain_url,
                z,
                segments,
                height,
                extent,
                color,
                max_sse,
                max_z,
                wireframe,
            } => {
                commands.spawn(Tiles {
                    tile_url: Some(tile_url.clone()),
                    terrain_url: terrain_url.clone(),
                    z: *z,
                    segments: *segments,
                    height: *height,
                    extent: *extent,
                    color: *color,
                    max_sse: *max_sse,
                    max_z: *max_z,
                    wireframe: *wireframe,
                });
            }
        }
    }
}
