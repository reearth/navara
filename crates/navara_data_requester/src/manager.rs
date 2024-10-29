use bevy_ecs::system::Resource;

/// This is used to prevent sending a lot of request.
#[derive(Debug, Default, Resource)]
pub struct DataRequesterManager {
    pub num_pending: u32,
}

const MAX_PENDING: u32 = 300;

impl DataRequesterManager {
    pub fn increment_pending(&mut self) {
        self.num_pending += 1;
    }
    pub fn decrement_pending(&mut self) {
        self.num_pending -= 1;
    }

    // TODO: Support prioritize request.
    /// Count the number of remaining pending.
    pub fn count_remaining_pending(&self) -> u32 {
        if self.num_pending >= MAX_PENDING {
            0
        } else {
            MAX_PENDING - self.num_pending
        }
    }
}
