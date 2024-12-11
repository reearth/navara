use std::cmp::Ordering;

use bevy_ecs::component::Component;

#[derive(Component, PartialEq, Eq, Debug, Clone, Copy)]
pub enum Priority {
    Extreme,
    High,
    Medium,
    Low,
    VeryLow,
}

impl PartialOrd for Priority {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Priority {
    fn cmp(&self, other: &Self) -> Ordering {
        if matches!(self, Self::Extreme)
            && (matches!(other, Self::High | Self::Medium | Self::Low | Self::VeryLow))
            || matches!(self, Self::High)
                && (matches!(other, Self::Medium | Self::Low | Self::VeryLow))
            || matches!(self, Self::Medium) && matches!(other, Self::Low | Self::VeryLow)
            || matches!(self, Self::Low) && matches!(other, Self::VeryLow)
        {
            return Ordering::Less;
        }
        if matches!(self, Self::High) && matches!(other, Self::Extreme)
            || matches!(self, Self::Medium) && matches!(other, Self::Extreme | Self::High)
            || matches!(self, Self::Low)
                && matches!(other, Self::Extreme | Self::High | Self::Medium)
            || matches!(self, Self::VeryLow)
                && matches!(other, Self::Extreme | Self::High | Self::Medium | Self::Low)
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
            Priority::Extreme,
            Priority::VeryLow,
            Priority::High,
        ];
        d.sort();

        let expects = [
            Priority::Extreme,
            Priority::High,
            Priority::High,
            Priority::Medium,
            Priority::Low,
            Priority::VeryLow,
        ];

        for (i, result) in d.iter().enumerate() {
            assert_eq!(result, &expects[i]);
        }
    }
}
