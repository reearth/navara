use std::cmp::Ordering;

use bevy_ecs::component::Component;

#[derive(Component, PartialEq, Debug, Clone)]
pub struct OrderByDistance(pub f32);

impl PartialOrd for OrderByDistance {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for OrderByDistance {
    fn cmp(&self, other: &Self) -> Ordering {
        if self.0 > other.0 {
            return Ordering::Greater;
        }
        if self.0 < other.0 {
            return Ordering::Less;
        }
        Ordering::Equal
    }
}

impl Eq for OrderByDistance {}

#[cfg(test)]
mod test {
    use super::OrderByDistance;

    #[test]
    fn it_should_sort_near_to_far_order() {
        let mut d = [
            OrderByDistance(0.2),
            OrderByDistance(0.5),
            OrderByDistance(0.1),
            OrderByDistance(0.),
            OrderByDistance(0.4),
            OrderByDistance(0.3),
        ];
        d.sort();

        let expects = [
            OrderByDistance(0.),
            OrderByDistance(0.1),
            OrderByDistance(0.2),
            OrderByDistance(0.3),
            OrderByDistance(0.4),
            OrderByDistance(0.5),
        ];

        for (i, result) in d.iter().enumerate() {
            assert_eq!(result, &expects[i]);
        }
    }
}
