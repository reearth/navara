use bevy_ecs::{bundle::Bundle, component::Component, entity::Entity};

#[derive(Component)]
pub struct WorkerTaskMarker;

#[derive(Component)]
pub struct WorkerTaskDelegateeMarker(pub Entity);

#[derive(Component)]
pub struct WorkerTaskCompleted;

#[derive(Bundle)]
pub struct WorkerTaskBundle<Parameters: Component> {
    pub marker: WorkerTaskMarker,
    pub parameters: Parameters,
}

impl<Parameters: Component> WorkerTaskBundle<Parameters> {
    pub fn new(p: Parameters) -> Self {
        Self {
            marker: WorkerTaskMarker,
            parameters: p,
        }
    }
}
