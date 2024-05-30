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
    fn initialize_leaf(&mut self, coords: Coords<U>, init: &dyn Fn(Coords<U>) -> T);

    fn initialize_zero(&mut self, init: &dyn Fn(Coords<U>) -> T) {
        let x = U::zero();
        let y = U::zero();
        let z = U::zero();
        self.initialize_leaf((x, y, z), init);
    }

    fn initialize_children(&mut self, (x, y, z): Coords<U>, init: &dyn Fn(Coords<U>) -> T) {
        for i in 0..4 {
            let i = to_int::<usize, U>(i);
            let x = (x << 1) + (i % (U::one() + U::one()));
            let y = (y << 1) + (i >> 1);
            let z = z + U::one();
            self.initialize_leaf((x, y, z), init);
        }
    }

    fn leaf(&self, coords: Coords<U>) -> Option<Box<dyn GeoSpacialQuadLeaf<U>>>;

    fn zero(&self) -> Option<Box<dyn GeoSpacialQuadLeaf<U>>> {
        self.leaf((U::zero(), U::zero(), U::zero()))
    }

    fn parent(&self, (x, y, z): Coords<U>) -> Option<Box<dyn GeoSpacialQuadLeaf<U>>> {
        self.leaf((x >> 1, y >> 1, z - U::one()))
    }

    fn children(&self, (x, y, z): Coords<U>) -> Option<Vec<Box<dyn GeoSpacialQuadLeaf<U>>>> {
        let mut children: Vec<Box<dyn GeoSpacialQuadLeaf<U>>> = Vec::with_capacity(4);
        for i in 0..4 {
            let i = to_int::<usize, U>(i);
            let x = ((x << 1) + (i % (U::one() + U::one()))) as U;
            let y = ((y << 1) + (i >> 1)) as U;
            let z = z + U::one();
            match self.leaf((x, y, z)) {
                Some(v) => children.push(v),
                None => return None,
            }
        }
        Some(children)
    }

    fn get(&self, handle: u64) -> Option<&T>;

    fn get_mut(&mut self, handle: u64) -> Option<&mut T>;
    // fn initialize_children(&self);
}
