use bevy_ecs::{bundle::Bundle, component::Component, entity::Entity};

#[derive(Component)]
pub struct WorkerTaskMarker;

#[derive(Component)]
pub struct WorkerTaskDelegateeMarker(pub Entity);

#[derive(Component)]
pub struct WorkerTaskCompleted;

/// Marks a task result whose BufferStore handles were transferred to their
/// final owner (e.g. a tile mesh) by the consuming system. Result components
/// whose `on_remove` hook frees unconsumed buffers skip entities carrying this
/// marker, so consumers that take over handle ownership must insert it
/// together with `Deleted`.
#[derive(Component)]
pub struct WorkerTaskResultConsumed;

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
