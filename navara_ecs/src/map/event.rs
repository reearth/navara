use bevy_ecs::prelude::*;

use crate::{event::EventStore, BufferStoreEvent, DataRequester};

use super::{LayerDescription, Tiles};

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
                    wireframe: *wireframe,
                });
            }
        }
    }
}

pub fn set_data_requester_loaded(
    mut events: EventReader<BufferStoreEvent>,
    mut requests: Query<&mut DataRequester>,
) {
    for e in events.read() {
        for mut d in &mut requests {
            if d.handle == e.handle {
                d.loaded = true;
            }
        }
    }
}

pub fn send_data_requst_events(
    mut events: ResMut<EventStore>,
    requests: Query<(Entity, &DataRequester), Added<DataRequester>>,
) {
    for (e, d) in requests.iter() {
        if d.loaded {
            continue;
        }
        events.data_requested.push(e);
    }
}
