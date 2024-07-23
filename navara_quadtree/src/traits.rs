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
    fn initialize_leaf(&mut self, coords: Coords<U>, init: &dyn Fn(Coords<U>) -> T);

    /// Initialize a root leaf.
    fn initialize_zero(&mut self, init: &dyn Fn(Coords<U>) -> T) {
        let x = U::zero();
        let y = U::zero();
        let z = U::zero();
        self.initialize_leaf((x, y, z), init);
    }

    /// Initialize children of specified coordinates.
    fn initialize_children(&mut self, (x, y, z): Coords<U>, init: &dyn Fn(Coords<U>) -> T) {
        for i in 0..4 {
            let i = to_int::<usize, U>(i);
            let x = (x << 1) + (i % (U::one() + U::one()));
            let y = (y << 1) + (i >> 1);
            let z = z + U::one();
            self.initialize_leaf((x, y, z), init);
        }
    }

    /// Get children, or create children and return it if the number of children isn't four.
    fn get_or_create_children(
        &mut self,
        (x, y, z): Coords<U>,
        init: &dyn Fn(Coords<U>) -> T,
    ) -> Vec<Box<dyn GeoSpacialQuadLeaf<U>>> {
        let mut children: Vec<Box<dyn GeoSpacialQuadLeaf<U>>> = Vec::with_capacity(4);
        for i in 0..4 {
            let i = to_int::<usize, U>(i);
            let x = (x << 1) + (i % (U::one() + U::one()));
            let y = (y << 1) + (i >> 1);
            let z = z + U::one();
            if let Some(t) = self.leaf((x, y, z)) {
                children.push(t);
            } else {
                self.initialize_leaf((x, y, z), init);
                if let Some(t) = self.leaf((x, y, z)) {
                    children.push(t);
                } else {
                    unreachable!();
                }
            }
        }
        children
    }

    /// Get a leaf by specified coordinates.
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
            let x = (x << 1) + (i % (U::one() + U::one()));
            let y = (y << 1) + (i >> 1);
            let z = z + U::one();
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
