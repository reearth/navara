use std::fmt::Debug;

use num::PrimInt;

use crate::{linear_quadtree::LinearQuadtree, traits::GeoSpacialQuadtree};

/// Entry point for quadtree implementation.
/// ```
/// use navara_quadtree::Quadtree;
///
/// #[derive(Debug)]
/// struct Tile { x: u32, y: u32, z: u32 }
///
/// let qt: Quadtree<u32, Tile> = Quadtree::new_with_linear_qt(30);
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

    /// Initialize [`Quadtree`] with `LinearQuadtree`.
    /// - `depth`: The depth of quadtree.
    pub fn new_with_linear_qt() -> Self {
        Self::new(Box::new(LinearQuadtree::new()))
    }
}
