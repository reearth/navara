#![doc = include_str!("../README.md")]

mod model;

use bevy_ecs::{entity::Entity, prelude::Resource};

pub use model::*;

#[derive(Debug, Default, Resource)]
pub struct EventStore {
    pub camera_transform_updated: Option<Entity>,
    pub object_transform_updated: Vec<Entity>,
    pub mesh_removed: Vec<Entity>,
    pub mesh_added: Vec<Entity>,
    pub mesh_updated: Vec<Entity>,
    pub data_requested: Vec<Entity>,
    pub data_requester_removed: Vec<Entity>,
    pub texture_fragment_reqested: Vec<Entity>,
    pub texture_fragment_removed: Vec<Entity>,
    pub worker_task_delegated: Vec<Entity>,
    pub worker_task_removed: Vec<Entity>,
    pub renderable_feature_added: Vec<Entity>,
    pub renderable_feature_changed: Vec<Entity>,
    pub renderable_feature_removed: Vec<Entity>,
    pub update_sample_terrain_height: Vec<Entity>,
}

impl EventStore {
    pub fn clear(&mut self) {
        self.camera_transform_updated = None;
        self.object_transform_updated.clear();
        self.mesh_removed.clear();
        self.mesh_added.clear();
        self.mesh_updated.clear();
        self.data_requested.clear();
        self.data_requester_removed.clear();
        self.texture_fragment_reqested.clear();
        self.texture_fragment_removed.clear();
        self.worker_task_delegated.clear();
        self.worker_task_removed.clear();
        self.renderable_feature_added.clear();
        self.renderable_feature_changed.clear();
        self.renderable_feature_removed.clear();
        self.update_sample_terrain_height.clear();
    }
}
