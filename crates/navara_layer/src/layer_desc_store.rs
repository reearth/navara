use crate::LayerDescription;
use bevy_ecs::system::Resource;
use std::collections::HashMap;

/// A store to preserve a relation between [`LayerId`] and [`LayerDescription`].
#[derive(Resource, Debug)]
pub struct LayerDescStore {
    pub map: HashMap<String, LayerDescription>,
}
