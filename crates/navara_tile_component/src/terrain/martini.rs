use std::collections::HashMap;

use bevy_ecs::{component::Component, entity::Entity, system::Resource};

#[derive(Component)]
pub struct MartiniComponent {
    martini: martini::Martini,
}

impl MartiniComponent {
    pub fn new(size: u32) -> Self {
        Self {
            martini: martini::Martini::new(size),
        }
    }

    pub fn with_coords(size: u32, coords: Vec<u32>) -> Self {
        Self {
            martini: martini::Martini::with_coords(size, coords),
        }
    }

    pub fn get(&self) -> &martini::Martini {
        &self.martini
    }

    pub fn get_mut(&mut self) -> &mut martini::Martini {
        &mut self.martini
    }
}

#[derive(Default, Resource)]
pub struct CachedMartini(HashMap<u32, Entity>);

impl CachedMartini {
    pub fn insert(&mut self, k: u32, v: Entity) {
        self.0.insert(k, v);
    }
    pub fn get(&self, k: &u32) -> Option<&Entity> {
        self.0.get(k)
    }
    pub fn remove(&mut self, k: &u32) {
        self.0.remove(k);
    }
}
