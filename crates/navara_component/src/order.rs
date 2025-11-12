use std::cmp::Ordering;

use bevy_ecs::component::Component;

#[derive(Component, PartialEq, Eq, Debug, Clone)]
pub struct Order(pub usize);

impl PartialOrd for Order {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Order {
    fn cmp(&self, other: &Self) -> Ordering {
        self.0.cmp(&other.0)
    }
}

#[derive(Component, PartialEq, Debug, Clone)]
pub struct OrderByDistance {
    pub sse: f64,
    pub distance: f64,
}

impl PartialOrd for OrderByDistance {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for OrderByDistance {
    fn cmp(&self, other: &Self) -> Ordering {
        if self.sse > other.sse {
            return Ordering::Less;
        }
        if self.sse < other.sse {
            return Ordering::Greater;
        }
        if self.distance > other.distance {
            return Ordering::Greater;
        }
        if self.distance < other.distance {
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
            OrderByDistance {
                sse: 0.1,
                distance: 0.2,
            },
            OrderByDistance {
                sse: 0.3,
                distance: 0.5,
            },
            OrderByDistance {
                sse: 0.5,
                distance: 0.1,
            },
            OrderByDistance {
                sse: 0.2,
                distance: 0.,
            },
            OrderByDistance {
                sse: 0.4,
                distance: 0.4,
            },
            OrderByDistance {
                sse: 0.,
                distance: 0.3,
            },
        ];
        d.sort();

        let expects = [
            OrderByDistance {
                sse: 0.5,
                distance: 0.1,
            },
            OrderByDistance {
                sse: 0.4,
                distance: 0.4,
            },
            OrderByDistance {
                sse: 0.3,
                distance: 0.5,
            },
            OrderByDistance {
                sse: 0.2,
                distance: 0.,
            },
            OrderByDistance {
                sse: 0.1,
                distance: 0.2,
            },
            OrderByDistance {
                sse: 0.,
                distance: 0.3,
            },
        ];

        for (i, result) in d.iter().enumerate() {
            assert_eq!(result, &expects[i]);
        }
    }
}
