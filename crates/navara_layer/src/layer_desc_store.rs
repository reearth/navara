use bevy_ecs::system::Resource;
pub use crate::LayerDescription;
use std::collections::HashMap;

#[derive(Resource)] 
pub struct LayerDescStore { 
    pub map: HashMap<String, LayerDescription>, 
}