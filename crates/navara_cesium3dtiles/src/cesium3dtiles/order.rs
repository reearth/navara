use std::cmp::Ordering;

use bevy_ecs::component::Component;

#[derive(Component, PartialEq, Debug)]
pub struct TileOrderByDistance {
    pub distance_from_camera: f32,
    pub sse: f32,
}

impl PartialOrd for TileOrderByDistance {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for TileOrderByDistance {
    fn cmp(&self, other: &Self) -> Ordering {
        if self.sse > other.sse {
            return Ordering::Greater;
        }
        if self.sse < other.sse {
            return Ordering::Less;
        }
        if self.distance_from_camera.abs() > other.distance_from_camera.abs() {
            return Ordering::Greater;
        }
        if self.distance_from_camera.abs() < other.distance_from_camera.abs() {
            return Ordering::Less;
        }
        Ordering::Equal
    }
}

impl Eq for TileOrderByDistance {}

#[cfg(test)]
mod test {
    use super::TileOrderByDistance;

    #[test]
    fn it_should_sort_near_to_far_order() {
        let mut d = [
            TileOrderByDistance {
                sse: 0.1,
                distance_from_camera: 0.2,
            },
            TileOrderByDistance {
                sse: 0.3,
                distance_from_camera: 0.5,
            },
            TileOrderByDistance {
                sse: 0.5,
                distance_from_camera: 0.1,
            },
            TileOrderByDistance {
                sse: 0.2,
                distance_from_camera: 0.,
            },
            TileOrderByDistance {
                sse: 0.4,
                distance_from_camera: 0.4,
            },
            TileOrderByDistance {
                sse: 0.,
                distance_from_camera: 0.3,
            },
        ];
        d.sort();

        let expects = [
            TileOrderByDistance {
                sse: 0.,
                distance_from_camera: 0.3,
            },
            TileOrderByDistance {
                sse: 0.1,
                distance_from_camera: 0.2,
            },
            TileOrderByDistance {
                sse: 0.2,
                distance_from_camera: 0.,
            },
            TileOrderByDistance {
                sse: 0.3,
                distance_from_camera: 0.5,
            },
            TileOrderByDistance {
                sse: 0.4,
                distance_from_camera: 0.4,
            },
            TileOrderByDistance {
                sse: 0.5,
                distance_from_camera: 0.1,
            },
        ];

        for (i, result) in d.iter().enumerate() {
            assert_eq!(result, &expects[i]);
        }
    }
}
