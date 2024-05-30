use std::fmt::Debug;

use num::PrimInt;

use crate::{region_quadtree::RegionQuadtree, traits::GeoSpacialQuadtree};

#[cfg_attr(feature = "bevy", derive(bevy_ecs::prelude::Resource))]
pub struct Quadtree<U, V>
where
    U: PrimInt + Default + Sync + Send + 'static,
    V: Sync + Send + 'static + Debug,
{
    pub qt: Box<dyn GeoSpacialQuadtree<U, V>>,
}

impl<U, V> Quadtree<U, V>
where
    U: PrimInt + Default + Sync + Send + 'static,
    V: Sync + Send + 'static + Debug,
{
    pub fn new(qt: Box<dyn GeoSpacialQuadtree<U, V>>) -> Self {
        Self { qt }
    }

    pub fn new_with_region_qt(depth: usize) -> Self {
        Self::new(Box::new(RegionQuadtree::new(depth)))
    }
}
