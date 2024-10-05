use crate::LayerDescription;
use bevy_ecs::system::Resource;
use std::collections::HashMap;

#[derive(Resource)]
pub struct LayerDescStore {
    pub map: HashMap<String, LayerDescription>,
}
