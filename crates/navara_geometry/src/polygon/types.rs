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
                let input_order = check_winding_order(&self.outer_ring);
                if input_order != WindingOrder::CounterClockwise {
                    self.outer_ring.reverse();
                    self.expected_winding_order = WindingOrder::CounterClockwise;
                }

                if let Some(holes) = self.holes.as_mut() {
                    for hole in holes.iter_mut() {
                        let input_order = check_winding_order(&hole.outer_ring);
                        if input_order != WindingOrder::Clockwise {
                            hole.outer_ring.reverse();
                            hole.expected_winding_order = WindingOrder::Clockwise;
                        }
                    }
                }
            }
            // The polygons in MVT are known to have clockwise outer rings and counterclockwise inner rings.
            // No further checks are performed; they are directly reversed.
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
            WindingOrder::CounterClockwise => {}
        }
    }
}

// Use the area method to determine the orientation of a polygon.
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

        area += p0.x * p1.y - p1.x * p0.y;
    }

    if area > 0.0 {
        WindingOrder::CounterClockwise
    } else {
        WindingOrder::Clockwise
    }
}
