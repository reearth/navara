use std::fmt::Debug;

use num::PrimInt;

use crate::utils::to_int;

#[cfg(feature = "bevy")]
pub trait Resource: bevy_ecs::system::Resource {}
#[cfg(not(feature = "bevy"))]
pub trait Resource {}

pub type Coords<U> = (U, U, U);

pub trait GeoSpacialQuadLeaf<U>
where
    U: PrimInt + Default + Sync + Send + 'static,
{
    fn coords(&self) -> Coords<U>;
    fn contains(&self, coords: Coords<U>) -> bool;
    fn handle(&self) -> u64;
}

pub trait GeoSpacialQuadtree<U, T>: Resource
where
    U: PrimInt + Default + Sync + Send + 'static,
    T: Sync + Send + 'static + Debug,
{
    /// Initialize a leaf with specified coordinates.
    /// The value which is made by `init` is stored internally as a custom value.
    fn initialize_leaf(&mut self, coords: Coords<U>, init: &dyn Fn(Coords<U>) -> T) -> Option<u64>;

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
    ) -> Vec<u64> {
        let mut result = Vec::with_capacity(4);
        for i in 0..4 {
            let i = to_int::<usize, U>(i);
            result.push(self.initialize_child((x, y, z), i, init));
        }
        result
    }

    /// Initialize a child of specified coordinates.
    fn initialize_child(
        &mut self,
        (x, y, z): Coords<U>,
        child_index: U,
        init: &dyn Fn(Coords<U>) -> T,
    ) -> u64 {
        self.initialize_leaf(self.child_coords((x, y, z), child_index), init)
            .unwrap()
    }

    /// Calculate child coords
    fn child_coords(&self, (x, y, z): Coords<U>, child_index: U) -> Coords<U> {
        let i = child_index;
        let x = (x << 1) + (i % (U::one() + U::one()));
        let y = (y << 1) + (i >> 1);
        let z = z + U::one();
        (x, y, z)
    }

    /// Get a leaf by specified coordinates.
    /// Note that this is too heavy task, so you should avoid using this method as much as you can.
    fn leaf(&self, coords: Coords<U>) -> Option<Box<dyn GeoSpacialQuadLeaf<U>>>;

    /// Get a root leaf.
    fn zero(&self) -> Option<Box<dyn GeoSpacialQuadLeaf<U>>> {
        self.leaf((U::zero(), U::zero(), U::zero()))
    }

    /// Get a parent of specified coordinates.
    fn parent(&self, (x, y, z): Coords<U>) -> Option<Box<dyn GeoSpacialQuadLeaf<U>>> {
        self.leaf((x >> 1, y >> 1, z - U::one()))
    }

    /// Get children of specified coordinates.
    fn children(&self, (x, y, z): Coords<U>) -> Option<Vec<Box<dyn GeoSpacialQuadLeaf<U>>>> {
        let mut children: Vec<Box<dyn GeoSpacialQuadLeaf<U>>> = Vec::with_capacity(4);
        for i in 0..4 {
            let i = to_int::<usize, U>(i);
            let (x, y, z) = self.child_coords((x, y, z), i);
            match self.leaf((x, y, z)) {
                Some(v) => children.push(v),
                None => return None,
            }
        }
        Some(children)
    }

    /// Get a custom value of a leaf.
    fn get(&self, handle: u64) -> Option<&T>;

    /// Get a custom value of a leaf with mutation.
    fn get_mut(&mut self, handle: u64) -> Option<&mut T>;

    /// Get a leaf by a leaf's handle.
    fn remove(&mut self, handle: u64) -> bool;
}
