use std::fmt::Debug;

use num::PrimInt;

use crate::{region_quadtree::RegionQuadtree, traits::GeoSpacialQuadtree};

/// Entry point for each quadtree implementation.
/// If you want to use `RegionQuadtree` which is based on [quadtree_rs], you can use it as below.
/// ```
/// use navara_quadtree::Quadtree;
///
/// #[derive(Debug)]
/// struct Tile { x: u32, y: u32, z: u32 }
///
/// let qt: Quadtree<u32, Tile> = Quadtree::new_with_region_qt(30);
/// ```
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
    /// Initialize [`Quadtree`] with your struct.
    pub fn new(qt: Box<dyn GeoSpacialQuadtree<U, V>>) -> Self {
        Self { qt }
    }

    /// Initialize [`Quadtree`] with `RegionQuadtree`.
    /// - `depth`: The depth of quadtree.
    pub fn new_with_region_qt(depth: usize) -> Self {
        Self::new(Box::new(RegionQuadtree::new(depth)))
    }
}
