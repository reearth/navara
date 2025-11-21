use navara_wasm_types::{LayerEffectConfig, OverscaledTileHandle};
use serde::Serialize;
use wasm_bindgen::{prelude::*, JsValue};

use super::feature::RenderableFeature;

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct RenderableFeatureAddedEvent {
    // Entity
    pub ind: u32,
    pub gen: u32,
    pub bits: u64,

    #[wasm_bindgen(getter_with_clone)]
    pub feature: RenderableFeature,
    #[wasm_bindgen(getter_with_clone)]
    pub layer_id: String,
    pub overscaled_tile_handle: Option<OverscaledTileHandle>,
    #[wasm_bindgen(getter_with_clone)]
    #[serde(skip_serializing)]
    pub effect_config: JsValue,
}

impl<'a> From<navara_event::RenderableFeatureEvent<'a>> for RenderableFeatureAddedEvent {
    fn from(ev: navara_event::RenderableFeatureEvent<'a>) -> Self {
        let effect_config = ev
            .effect_config
            .clone()
            .and_then(|config| {
                let wasm_config: LayerEffectConfig = config.into();
                serde_wasm_bindgen::to_value(&wasm_config).ok()
            })
            .unwrap_or(JsValue::NULL);
        Self {
            ind: ev.component_event.ind,
            gen: ev.component_event.gen,
            bits: ev.component_event.bits,
            feature: RenderableFeature::from(ev.component_event.comp.0),
            layer_id: ev.component_event.comp.1 .0.clone(),
            overscaled_tile_handle: ev.component_event.comp.2.map(|v| v.into()),
            effect_config,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct RenderableFeatureChangedEvent {
    // Entity
    pub ind: u32,
    pub gen: u32,
    pub bits: u64,

    #[wasm_bindgen(getter_with_clone)]
    pub feature: RenderableFeature,
    #[wasm_bindgen(getter_with_clone)]
    pub layer_id: String,
    pub overscaled_tile_handle: Option<OverscaledTileHandle>,
    #[wasm_bindgen(getter_with_clone)]
    #[serde(skip_serializing)]
    pub effect_config: JsValue,
}

impl<'a> From<navara_event::RenderableFeatureEvent<'a>> for RenderableFeatureChangedEvent {
    fn from(ev: navara_event::RenderableFeatureEvent<'a>) -> Self {
        let effect_config = ev
            .effect_config
            .clone()
            .and_then(|config| {
                let wasm_config: LayerEffectConfig = config.into();
                serde_wasm_bindgen::to_value(&wasm_config).ok()
            })
            .unwrap_or(JsValue::NULL);
        Self {
            ind: ev.component_event.ind,
            gen: ev.component_event.gen,
            bits: ev.component_event.bits,
            feature: RenderableFeature::from(ev.component_event.comp.0),
            layer_id: ev.component_event.comp.1 .0.clone(),
            overscaled_tile_handle: ev.component_event.comp.2.map(|v| v.into()),
            effect_config,
        }
    }
}

#[wasm_bindgen]
#[derive(Debug, Clone, Serialize)]
pub struct RenderableFeatureRemovedEvent {
    // Entity
    pub ind: u32,
    pub gen: u32,
    pub bits: u64,

    #[wasm_bindgen(getter_with_clone)]
    pub layer_id: String,
}

impl<'a> From<navara_event_store::ReconstructableComponentEvent<&'a navara_layer::LayerId>>
    for RenderableFeatureRemovedEvent
{
    fn from(
        ev: navara_event_store::ReconstructableComponentEvent<&'a navara_layer::LayerId>,
    ) -> Self {
        Self {
            ind: ev.ind,
            gen: ev.gen,
            bits: ev.bits,
            layer_id: ev.comp.0.clone(),
        }
    }
}
