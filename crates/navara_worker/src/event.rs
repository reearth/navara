use bevy_ecs::{entity::Entity, event::Event};

use crate::DelegatedWorkerTasksResult;

#[derive(Debug, Event)]
pub struct WorkerTaskCompletedEvent {
    pub parameters_id: Entity,
    pub result: DelegatedWorkerTasksResult,
}
