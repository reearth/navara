use bevy_ecs::{entity::Entity, message::Message};

use crate::DelegatedWorkerTasksResult;

#[derive(Debug, Message)]
pub struct WorkerTaskCompletedEvent {
    pub parameters_id: Entity,
    pub result: DelegatedWorkerTasksResult,
}
