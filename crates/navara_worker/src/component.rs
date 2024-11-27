use bevy_ecs::{bundle::Bundle, component::Component, entity::Entity};

#[derive(Component)]
pub struct WorkerTaskMarker;

#[derive(Component)]
pub struct WorkerTaskDelegateeMarker(pub Entity);

#[derive(Component)]
pub struct WorkerTaskCompleted;

#[derive(Bundle)]
pub struct WorkerTaskBundle<Marker: Component, Parameters: Component> {
    pub marker: Marker,
    pub worker_task_marker: WorkerTaskMarker,
    pub parameters: Parameters,
}

impl<Marker: Component, Parameters: Component> WorkerTaskBundle<Marker, Parameters> {
    pub fn new(m: Marker, p: Parameters) -> Self {
        Self {
            marker: m,
            worker_task_marker: WorkerTaskMarker,
            parameters: p,
        }
    }
}
