use navara_math::{Vec2, Vec3};

#[derive(Debug)]
pub struct Polygon {
    pub positions: Vec<Vec3>,
    pub hole_indices: Vec<u32>,
    pub positions_2d: Vec<Vec2>,
}

#[derive(Default, Debug)]
pub struct Hierarchy {
    pub outer_ring: Vec<Vec3>,
    pub holes: Option<Vec<Hierarchy>>,
}
