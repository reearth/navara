use bevy_ecs::{entity::Entity, message::Message};

use crate::DelegatedWorkerTasksResult;

#[derive(Debug, Message)]
pub struct WorkerTaskCompletedEvent {
    pub parameters_id: Entity,
    pub result: DelegatedWorkerTasksResult,
}

/// A delegated task ended without a deliverable result (worker error, missing
/// input, ...). The delegator must still be released — one that never settles
/// stays `Requested` forever and permanently occupies one of the task kind's
/// pending dispatch slots. Handling marks the delegator `Deleted`, which tears
/// it down (and its delegatee) through the regular removal path; a delegator
/// already gone (e.g. cancelled while the failure was in flight) makes this a
/// no-op, so the platform side can report every non-completed settlement
/// without tracking cancellation races.
#[derive(Debug, Message)]
pub struct WorkerTaskFailedEvent {
    pub delegator_id: Entity,
}
