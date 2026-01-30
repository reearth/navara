use crate::LayerDescription;
use bevy_ecs::prelude::Resource;
use rustc_hash::FxHashMap;

/// A store to preserve a relation between [`LayerId`] and [`LayerDescription`].
#[derive(Resource, Debug)]
pub struct LayerDescStore {
    pub map: FxHashMap<String, LayerDescription>,
}
