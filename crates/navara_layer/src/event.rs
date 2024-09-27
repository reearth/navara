use bevy_ecs::prelude::*;
use navara_feature::render::RenderableFeature;
use navara_material::Appearance;

pub use crate::{LayerDescription, LayerStore};

#[derive(Debug, Clone, PartialEq, Event)]
pub struct AddLayerEvent(pub LayerDescription);

#[derive(Debug, Clone, PartialEq, Event)]
pub struct UpdateLayerEvent {
    pub layer_id: String,
    pub appearance: Appearance,
}

pub fn process_add_events(mut commands: Commands, mut events: EventReader<AddLayerEvent>) {
    for ev in events.read() {
        let AddLayerEvent(desc) = ev;
        match desc {
            LayerDescription::Tiles(t) => {
                commands.spawn(t.clone());
            }
            LayerDescription::Terrain(t) => {
                commands.spawn(t.clone());
            }
            LayerDescription::GeoJson(t) => {
                commands.spawn(t.clone());
            }
        }
    }
}

pub fn process_update_events(mut commands: Commands, layer_store: Res<LayerStore>, mut events: EventReader<UpdateLayerEvent>, mut features: Query<&mut RenderableFeature>) {
    for ev in events.read() {
        let entities = layer_store.map.get(&ev.layer_id);
        for entity in entities {
	        let mut feature = features.get_mut(entity);
         feature.material = ev.appearance;
        }
    }
}