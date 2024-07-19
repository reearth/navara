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
}

impl<'a>
    From<
        navara_ecs::ReconstructableComponentEvent<
            &'a navara_ecs::map::feature::render::RenderableFeature,
        >,
    > for RenderableFeatureAddedEvent
{
    fn from(
        ev: navara_ecs::ReconstructableComponentEvent<
            &'a navara_ecs::map::feature::render::RenderableFeature,
        >,
    ) -> Self {
        Self {
            ind: ev.ind,
            gen: ev.gen,
            bits: ev.bits,
            feature: RenderableFeature::from(ev.comp),
        }
    }
}
