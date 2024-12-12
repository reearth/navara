use navara_math::{Vec2, Vec3};

#[derive(Debug)]
pub struct Polygon {
    pub positions: Vec<Vec3>,
    pub hole_indices: Vec<u32>,
    pub positions_2d: Vec<Vec2>,
}

#[derive(Default, Debug, PartialEq, Copy, Clone)]
pub enum WindingOrder {
    #[default]
    Unknown,
    Clockwise,
    CounterClockwise,
}

#[derive(Default, Debug)]
pub struct Hierarchy {
    pub outer_ring: Vec<Vec3>,
    pub holes: Option<Vec<Hierarchy>>,
    pub expected_winding_order: WindingOrder, // for outer ring
}

impl Hierarchy {
    pub fn align_winding_order(&mut self) {
        match self.expected_winding_order {
            // If the polygon's orientation is unknown,
            // all outer rings and inner rings need to be checked,
            // adjusting the outer rings to CounterClockwise and the inner rings to Clockwise.
            WindingOrder::Unknown => {
                self.expected_winding_order = check_winding_order(&self.outer_ring);
                if self.expected_winding_order == WindingOrder::Clockwise {
                    self.outer_ring.reverse();
                    self.expected_winding_order = WindingOrder::CounterClockwise;
                }

                if let Some(holes) = self.holes.as_mut() {
                    for hole in holes.iter_mut() {
                        hole.expected_winding_order = check_winding_order(&hole.outer_ring);
                        if hole.expected_winding_order == WindingOrder::CounterClockwise {
                            hole.outer_ring.reverse();
                            hole.expected_winding_order = WindingOrder::Clockwise;
                        }
                    }
                }
            }
            WindingOrder::Clockwise => {
                self.outer_ring.reverse();
                self.expected_winding_order = WindingOrder::CounterClockwise;

                if let Some(holes) = self.holes.as_mut() {
                    for hole in holes.iter_mut() {
                        hole.outer_ring.reverse();
                        hole.expected_winding_order = WindingOrder::Clockwise;
                    }
                }
            }
            // In the MVT spec, it is mentioned that the outer ring of a polygon is clockwise,
            // which is based on the origin being at the top-left.
            WindingOrder::CounterClockwise => {}
        }
    }
}

// Use the area method to determine the orientation of a polygon.
// ref: https://github.com/CesiumGS/cesium/blob/91821cc54d274ad7a28ecc164a4c5c867849e111/packages/engine/Source/Core/PolygonPipeline.js#L56
fn check_winding_order(positions: &[Vec3]) -> WindingOrder {
    let length = positions.len();
    if length < 3 {
        return WindingOrder::Unknown;
    }

    let mut area = 0.0;
    for i in 0..length {
        let i0 = if i == 0 { length - 1 } else { i - 1 };
        let p0 = positions[i0];
        let p1 = positions[i];

        area += p0.x as f64 * p1.y as f64 - p1.x as f64 * p0.y as f64;
    }
    area *= 0.5;

    if area > 0.0 {
        WindingOrder::CounterClockwise
    } else if area < 0.0 {
        WindingOrder::Clockwise
    } else {
        WindingOrder::Unknown
    }
}

#[cfg(test)]
mod test {
    use navara_math::Vec3;

    use crate::WindingOrder;

    use super::check_winding_order;

    #[test]
    fn it_should_compute_counter_clockwise() {
        assert!(matches!(
            check_winding_order(&[
                Vec3::new(0., 0., 0.),
                Vec3::new(2., 0., 0.),
                Vec3::new(2., 1., 0.),
                Vec3::new(0., 1., 0.),
            ]),
            WindingOrder::CounterClockwise
        ));
    }

    #[test]
    fn it_should_compute_clockwise() {
        assert!(matches!(
            check_winding_order(&[
                Vec3::new(0., 0., 0.),
                Vec3::new(0., 2., 0.),
                Vec3::new(1., 2., 0.),
                Vec3::new(1., 0., 0.),
            ]),
            WindingOrder::Clockwise
        ));
    }
}
