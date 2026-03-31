use std::fmt::Debug;

use num::PrimInt;

use crate::{Coords, QuadLeafHandle, ancestor_coords, child_coords, parent_coords, utils::to_int};

#[cfg(feature = "bevy")]
pub trait Resource: bevy_ecs::prelude::Resource {}
#[cfg(not(feature = "bevy"))]
pub trait Resource {}

pub trait GeoSpacialQuadLeaf<U>
where
    U: PrimInt + Default + Sync + Send + 'static,
{
    fn coords(&self) -> Coords<U>;
    fn handle(&self) -> QuadLeafHandle;
}

pub trait GeoSpacialQuadtree<U, T>: Resource
where
    U: PrimInt + Default + Sync + Send + 'static,
    T: Sync + Send + 'static + Debug,
{
    /// Initialize a leaf with specified coordinates.
    /// The value which is made by `init` is stored internally as a custom value.
    fn initialize_leaf(
        &mut self,
        coords: Coords<U>,
        init: &dyn Fn(Coords<U>) -> T,
    ) -> Option<QuadLeafHandle>;

    /// Initialize a root leaf.
    fn initialize_zero(&mut self, init: &dyn Fn(Coords<U>) -> T) {
        let x = U::zero();
        let y = U::zero();
        let z = U::zero();
        self.initialize_leaf((x, y, z), init);
    }

    /// Initialize children of specified coordinates.
    fn initialize_children(
        &mut self,
        (x, y, z): Coords<U>,
        init: &dyn Fn(Coords<U>) -> T,
    ) -> Option<Vec<QuadLeafHandle>> {
        let mut result = Vec::with_capacity(4);
        for i in 0..4 {
            let i = to_int::<usize, U>(i);
            result.push(self.initialize_child((x, y, z), i, init)?);
        }
        Some(result)
    }

    /// Initialize a child of specified coordinates.
    fn initialize_child(
        &mut self,
        (x, y, z): Coords<U>,
        child_index: U,
        init: &dyn Fn(Coords<U>) -> T,
    ) -> Option<QuadLeafHandle> {
        self.initialize_leaf(child_coords((x, y, z), child_index), init)
    }

    /// Get a leaf by specified coordinates.
    /// Note that this is too heavy task, so you should avoid using this method as much as you can.
    fn leaf(&self, coords: Coords<U>) -> Option<Box<dyn GeoSpacialQuadLeaf<U>>>;

    /// Get a root leaf.
    fn zero(&self) -> Option<Box<dyn GeoSpacialQuadLeaf<U>>> {
        self.leaf((U::zero(), U::zero(), U::zero()))
    }

    /// Get a parent of specified coordinates.
    fn parent(&self, coords: Coords<U>) -> Option<Box<dyn GeoSpacialQuadLeaf<U>>> {
        self.leaf(parent_coords(coords))
    }

    /// Get an ancestor at the given target zoom level.
    fn ancestor(&self, coords: Coords<U>, target_z: U) -> Option<Box<dyn GeoSpacialQuadLeaf<U>>> {
        self.leaf(ancestor_coords(coords, target_z))
    }

    /// Get children of specified coordinates.
    fn children(&self, (x, y, z): Coords<U>) -> Option<Vec<Box<dyn GeoSpacialQuadLeaf<U>>>> {
        let mut children: Vec<Box<dyn GeoSpacialQuadLeaf<U>>> = Vec::with_capacity(4);
        for i in 0..4 {
            let i = to_int::<usize, U>(i);
            let (x, y, z) = child_coords((x, y, z), i);
            match self.leaf((x, y, z)) {
                Some(v) => children.push(v),
                None => return None,
            }
        }
        Some(children)
    }

    /// Get a custom value of a leaf.
    fn get(&self, handle: QuadLeafHandle) -> Option<&T>;

    /// Get a custom value of a leaf with mutation.
    fn get_mut(&mut self, handle: QuadLeafHandle) -> Option<&mut T>;

    /// Get a leaf by a leaf's handle.
    fn remove(&mut self, handle: QuadLeafHandle) -> Option<T>;
}
