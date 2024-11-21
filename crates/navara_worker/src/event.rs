use bevy_ecs::event::Event;

use crate::DelegatedWorkerTasks;

#[derive(Event)]
pub struct WorkerCompletedEvent {
    pub task: DelegatedWorkerTasks,
}
