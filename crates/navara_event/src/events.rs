use bevy_ecs::world::World;
use navara_data_requester::DataRequester;
use navara_event_store::{ComponentEvent, EntityEvent, EventStore, ReconstructableComponentEvent};
use navara_feature::render::RenderableFeature;
use navara_math::Transform;
use navara_mesh::{Material, Mesh};
use navara_texture_fragment::TextureFragment;

#[derive(Debug, Default)]
pub struct Events<'a> {
    pub camera_transform_updated: Option<&'a Transform>,
    pub object_transform_updated: Vec<ComponentEvent<&'a Transform>>,
    pub object_removed: Vec<EntityEvent>,
    pub mesh_added: Vec<ComponentEvent<(&'a Mesh, &'a Material, &'a Transform)>>,
    pub mesh_updated: Vec<ComponentEvent<(&'a Mesh, &'a Material)>>,
    pub data_requested: Vec<ReconstructableComponentEvent<&'a DataRequester>>,
    pub texture_fragment_reqested: Vec<ReconstructableComponentEvent<&'a TextureFragment>>,
    pub texture_fragment_removed: Vec<EntityEvent>,
    pub renderable_feature_added: Vec<ReconstructableComponentEvent<&'a RenderableFeature>>,
    pub renderable_feature_changed: Vec<ReconstructableComponentEvent<&'a RenderableFeature>>,
    pub renderable_feature_removed: Vec<EntityEvent>,
}

impl<'a> Events<'a> {
    pub fn from_event_store(world: &'a World, store: &EventStore) -> Events<'a> {
        let mut events = Self::default();
        if let Some(e) = store.camera_transform_updated {
            events.camera_transform_updated = world.get::<Transform>(e);
        }

        for e in store.object_transform_updated.iter() {
            if let Some(e) = ComponentEvent::from_world(*e, world) {
                events.object_transform_updated.push(e);
            }
        }

        for e in store.object_removed.iter() {
            events.object_removed.push((*e).into());
        }

        for e in store.mesh_added.iter() {
            if let Some(e) = ComponentEvent::from_world_3(*e, world) {
                events.mesh_added.push(e);
            }
        }

        for e in store.mesh_updated.iter() {
            if let Some(e) = ComponentEvent::from_world_2(*e, world) {
                events.mesh_updated.push(e);
            }
        }

        for e in store.data_requested.iter() {
            if let Some(e) = ReconstructableComponentEvent::from_world(*e, world) {
                events.data_requested.push(e);
            }
        }

        for e in store.texture_fragment_reqested.iter() {
            if let Some(e) = ReconstructableComponentEvent::from_world(*e, world) {
                events.texture_fragment_reqested.push(e);
            }
        }

        for e in store.texture_fragment_removed.iter() {
            events.texture_fragment_removed.push((*e).into());
        }

        for e in store.renderable_feature_added.iter() {
            if let Some(e) = ReconstructableComponentEvent::from_world(*e, world) {
                events.renderable_feature_added.push(e);
            }
        }

        for e in store.renderable_feature_changed.iter() {
            if let Some(e) = ReconstructableComponentEvent::from_world(*e, world) {
                events.renderable_feature_changed.push(e);
            }
        }

        for e in store.renderable_feature_removed.iter() {
            events.renderable_feature_removed.push((*e).into());
        }

        events
    }
}
