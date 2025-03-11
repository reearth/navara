use bevy_ecs::world::World;
use navara_data_requester::DataRequester;
use navara_event_store::{ComponentEvent, EntityEvent, EventStore, ReconstructableComponentEvent};
use navara_feature_component::render::RenderableFeature;
use navara_material::RasterTileInternalMaterial;
use navara_math::Transform;
use navara_mesh::Mesh;
use navara_texture_fragment::TextureFragment;
use navara_tile_component::TileMeshMarker;
use navara_worker::DelegatedWorkerTasksParameters;

#[derive(Debug, Default)]
pub struct Events<'a> {
    pub camera_transform_updated: Option<&'a Transform>,
    pub object_transform_updated: Vec<ComponentEvent<&'a Transform>>,
    pub mesh_removed: Vec<EntityEvent>,
    pub mesh_added: Vec<
        ComponentEvent<(
            &'a TileMeshMarker,
            &'a Mesh,
            &'a RasterTileInternalMaterial,
            &'a Transform,
        )>,
    >,
    pub mesh_updated: Vec<ComponentEvent<(&'a Mesh, &'a RasterTileInternalMaterial)>>,
    pub data_requested: Vec<ReconstructableComponentEvent<&'a DataRequester>>,
    pub data_requester_removed: Vec<ReconstructableComponentEvent<&'a DataRequester>>,
    pub texture_fragment_reqested: Vec<ReconstructableComponentEvent<&'a TextureFragment>>,
    pub texture_fragment_removed: Vec<EntityEvent>,
    pub worker_task_delegated:
        Vec<ReconstructableComponentEvent<&'a DelegatedWorkerTasksParameters>>,
    pub worker_task_removed: Vec<EntityEvent>,
    pub renderable_feature_added: Vec<ReconstructableComponentEvent<&'a RenderableFeature>>,
    pub renderable_feature_changed: Vec<ReconstructableComponentEvent<&'a RenderableFeature>>,
    pub renderable_feature_removed: Vec<EntityEvent>,
}

impl<'a> Events<'a> {
    pub fn from_event_store(world: &'a World, store: &EventStore) -> Option<Events<'a>> {
        let mut events = Self::default();

        let mut is_changed = false;

        if let Some(e) = store.camera_transform_updated {
            events.camera_transform_updated = world.get::<Transform>(e);
            is_changed = true;
        }

        for e in store.object_transform_updated.iter() {
            if let Some(e) = ComponentEvent::from_world(*e, world) {
                events.object_transform_updated.push(e);
                is_changed = true;
            }
        }

        for e in store.mesh_removed.iter() {
            events.mesh_removed.push((*e).into());
            is_changed = true;
        }

        for e in store.mesh_added.iter() {
            if let Some(e) = ComponentEvent::from_world_4(*e, world) {
                events.mesh_added.push(e);
                is_changed = true;
            }
        }

        for e in store.mesh_updated.iter() {
            if let Some(e) = ComponentEvent::from_world_2(*e, world) {
                events.mesh_updated.push(e);
                is_changed = true;
            }
        }

        for e in store.data_requested.iter() {
            if let Some(e) = ReconstructableComponentEvent::from_world(*e, world) {
                events.data_requested.push(e);
                is_changed = true;
            }
        }

        for e in store.data_requester_removed.iter() {
            if let Some(e) = ReconstructableComponentEvent::from_world(*e, world) {
                events.data_requester_removed.push(e);
                is_changed = true;
            }
        }

        for e in store.texture_fragment_reqested.iter() {
            if let Some(e) = ReconstructableComponentEvent::from_world(*e, world) {
                events.texture_fragment_reqested.push(e);
                is_changed = true;
            }
        }

        for e in store.texture_fragment_removed.iter() {
            events.texture_fragment_removed.push((*e).into());
            is_changed = true;
        }

        for e in store.worker_task_delegated.iter() {
            if let Some(e) = ReconstructableComponentEvent::from_world(*e, world) {
                events.worker_task_delegated.push(e);
                is_changed = true;
            }
        }

        for e in store.worker_task_removed.iter() {
            events.worker_task_removed.push((*e).into());
            is_changed = true;
        }

        for e in store.renderable_feature_added.iter() {
            if let Some(e) = ReconstructableComponentEvent::from_world(*e, world) {
                events.renderable_feature_added.push(e);
                is_changed = true;
            }
        }

        for e in store.renderable_feature_changed.iter() {
            if let Some(e) = ReconstructableComponentEvent::from_world(*e, world) {
                events.renderable_feature_changed.push(e);
                is_changed = true;
            }
        }

        for e in store.renderable_feature_removed.iter() {
            events.renderable_feature_removed.push((*e).into());
            is_changed = true;
        }

        is_changed.then_some(events)
    }
}
