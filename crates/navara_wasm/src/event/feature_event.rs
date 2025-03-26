use serde::Serialize;
use wasm_bindgen::prelude::*;

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
}

impl<'a>
    From<
        navara_event_store::ReconstructableComponentEvent<(
            &'a navara_feature_component::render::RenderableFeature,
            &'a navara_layer::LayerId,
        )>,
    > for RenderableFeatureAddedEvent
{
    fn from(
        ev: navara_event_store::ReconstructableComponentEvent<(
            &'a navara_feature_component::render::RenderableFeature,
            &'a navara_layer::LayerId,
        )>,
    ) -> Self {
        Self {
            ind: ev.ind,
            gen: ev.gen,
            bits: ev.bits,
            feature: RenderableFeature::from(ev.comp.0),
            layer_id: ev.comp.1 .0.clone(),
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
}

impl<'a>
    From<
        navara_event_store::ReconstructableComponentEvent<(
            &'a navara_feature_component::render::RenderableFeature,
            &'a navara_layer::LayerId,
        )>,
    > for RenderableFeatureChangedEvent
{
    fn from(
        ev: navara_event_store::ReconstructableComponentEvent<(
            &'a navara_feature_component::render::RenderableFeature,
            &'a navara_layer::LayerId,
        )>,
    ) -> Self {
        Self {
            ind: ev.ind,
            gen: ev.gen,
            bits: ev.bits,
            feature: RenderableFeature::from(ev.comp.0),
            layer_id: ev.comp.1 .0.clone(),
        }
    }
}
