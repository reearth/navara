use std::cmp::Ordering;

use bevy_ecs::component::Component;

#[derive(Component)]
pub struct Requested;

#[derive(Component)]
pub struct Deleted;

#[derive(Component)]
pub struct Ignore;

#[derive(Component, PartialEq, Eq, Debug)]
pub enum Priority {
    High,
    Medium,
    Low,
}

impl PartialOrd for Priority {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Priority {
    fn cmp(&self, other: &Self) -> Ordering {
        if matches!(self, Self::High) && (matches!(other, Self::Medium | Self::Low))
            || matches!(self, Self::Medium) && matches!(other, Self::Low)
        {
            return Ordering::Less;
        }
        if matches!(self, Self::Medium) && matches!(other, Self::High)
            || matches!(self, Self::Low) && matches!(other, Self::High | Self::Medium)
        {
            return Ordering::Greater;
        }
        Ordering::Equal
    }
}

#[cfg(test)]
mod test {
    use super::Priority;

    #[test]
    fn it_should_sort_near_to_far_order() {
        let mut d = [
            Priority::Low,
            Priority::High,
            Priority::Medium,
            Priority::High,
        ];
        d.sort();

        let expects = [
            Priority::High,
            Priority::High,
            Priority::Medium,
            Priority::Low,
        ];

        for (i, result) in d.iter().enumerate() {
            assert_eq!(result, &expects[i]);
        }
    }
}
