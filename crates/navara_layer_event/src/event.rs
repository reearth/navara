use bevy_ecs::prelude::*;

use navara_layer::{
    DeleteB3dmLayerMarker, DeleteCesium3dTilesLayerMarker, DeleteGeoJsonLayerMarker,
    DeleteMvtLayerMarker, DeletePntsLayerMarker, DeleteRasterTileLayerMarker, LayerDescStore,
    LayerDescription, LayerId, UpdateB3dmLayerMarker, UpdateCesium3dTilesLayerMarker,
    UpdateGeoJsonLayerMarker, UpdateMvtLayerMarker, UpdatePntsLayerMarker,
    UpdateRasterTileLayerMarker,
};
use navara_material::{Appearance, ElevationHeatmapConfig, LayerEffectConfig};

#[derive(Debug, Clone, PartialEq, Event)]
pub struct AddLayerEvent(pub LayerDescription);

#[derive(Debug, Clone, PartialEq, Event)]
pub struct UpdateLayerEvent {
    pub layer_id: LayerId,
    pub appearance: Appearance,
    pub elevation_heatmap_config: Option<ElevationHeatmapConfig>,
    pub effect_config: Option<LayerEffectConfig>,
}

#[derive(Debug, Clone, PartialEq, Event)]
pub struct DeleteLayerEvent(pub LayerId);

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
            LayerDescription::B3dm(t) => {
                commands.spawn(t.clone());
            }
            LayerDescription::Pnts(t) => {
                commands.spawn(t.clone());
            }
            LayerDescription::Mvt(t) => {
                commands.spawn(t.clone());
            }
            LayerDescription::Cesium3dTiles(t) => {
                commands.spawn(t.clone());
            }
        }
    }
}

pub fn process_update_events(
    mut commands: Commands,
    mut layer_desc_store: ResMut<LayerDescStore>,
    mut events: EventReader<UpdateLayerEvent>,
) {
    for ev in events.read() {
        if let Some(effect_config) = &ev.effect_config {
            update_layer_effect_config(&mut layer_desc_store.map, &ev.layer_id.0, effect_config);
        }
        let layer_desc = match layer_desc_store.map.get(&ev.layer_id.0) {
            Some(l) => l,
            None => continue,
        };
        match layer_desc {
            LayerDescription::GeoJson(_) => {
                commands.spawn(UpdateGeoJsonLayerMarker {
                    appearance: ev.appearance.clone(),
                    layer_id: ev.layer_id.0.clone(),
                });
            }
            LayerDescription::B3dm(_) => {
                if let Appearance::Model(mat) = &ev.appearance {
                    commands.spawn(UpdateB3dmLayerMarker {
                        material: mat.clone(),
                        layer_id: ev.layer_id.0.clone(),
                    });
                }
            }
            LayerDescription::Pnts(_) => {
                if let Appearance::Model(mat) = &ev.appearance {
                    commands.spawn(UpdatePntsLayerMarker {
                        material: mat.clone(),
                        layer_id: ev.layer_id.0.clone(),
                    });
                }
            }
            LayerDescription::Cesium3dTiles(_) => {
                if let Appearance::Model(mat) = &ev.appearance {
                    commands.spawn(UpdateCesium3dTilesLayerMarker {
                        material: mat.clone(),
                        layer_id: ev.layer_id.0.clone(),
                    });
                }
            }
            LayerDescription::Mvt(_) => {
                commands.spawn(UpdateMvtLayerMarker {
                    appearance: ev.appearance.clone(),
                    layer_id: ev.layer_id.0.clone(),
                });
            }
            LayerDescription::Tiles(_) => {
                commands.spawn(UpdateRasterTileLayerMarker {
                    appearance: ev.appearance.clone(),
                    layer_id: ev.layer_id.0.clone(),
                    elevation_heatmap_config: ev.elevation_heatmap_config.clone(),
                });
            }
            _ => {}
        }
    }
}

fn update_layer_effect_config(
    store: &mut std::collections::HashMap<String, LayerDescription>,
    layer_id: &str,
    new_config: &LayerEffectConfig,
) {
    let Some(desc) = store.get_mut(layer_id) else {
        return;
    };

    match desc {
        LayerDescription::GeoJson(layer) => {
            if &layer.effect_config != new_config {
                layer.effect_config = new_config.clone();
            }
        }
        LayerDescription::Cesium3dTiles(layer) => {
            if &layer.effect_config != new_config {
                layer.effect_config = new_config.clone();
            }
        }
        _ => {}
    }
}

pub fn process_delete_events(
    mut commands: Commands,
    mut layer_desc_store: ResMut<LayerDescStore>,
    mut events: EventReader<DeleteLayerEvent>,
) {
    for ev in events.read() {
        let DeleteLayerEvent(layer_id) = ev;
        let layer_desc = match layer_desc_store.map.get(&layer_id.0) {
            Some(l) => l,
            None => continue,
        };
        match layer_desc {
            LayerDescription::GeoJson(_) => {
                commands.spawn(DeleteGeoJsonLayerMarker(layer_id.0.clone()));
            }
            LayerDescription::B3dm(_) => {
                commands.spawn(DeleteB3dmLayerMarker(layer_id.0.clone()));
            }
            LayerDescription::Pnts(_) => {
                commands.spawn(DeletePntsLayerMarker(layer_id.0.clone()));
            }
            LayerDescription::Cesium3dTiles(_) => {
                commands.spawn(DeleteCesium3dTilesLayerMarker(layer_id.0.clone()));
            }
            LayerDescription::Mvt(_) => {
                commands.spawn(DeleteMvtLayerMarker(layer_id.0.clone()));
            }
            LayerDescription::Tiles(_) => {
                commands.spawn(DeleteRasterTileLayerMarker(layer_id.0.clone()));
            }
            _ => {}
        };
        // delete stored value in LayerDescStore.
        layer_desc_store.map.remove(&layer_id.0);
    }
}
