mod id;

use fxhash::FxHashMap;
use std::fmt::Debug;

use num::PrimInt;

use crate::{
    traits::{GeoSpacialQuadLeaf, GeoSpacialQuadtree, Resource},
    Coords, QuadLeafHandle,
};

pub use id::*;

#[cfg_attr(feature = "bevy", derive(bevy_ecs::prelude::Resource))]
pub struct LinearQuadtree<U, V>
where
    U: PrimInt + Default,
{
    leaves: FxHashMap<LinearQuadleafId<U>, V>,
    params: LinearQuadleafIdParams,
}

impl<U, V> Resource for LinearQuadtree<U, V>
where
    U: PrimInt + Default + Sync + Send + 'static,
    V: Sync + Send + 'static + Debug,
{
}

impl<U, V> LinearQuadtree<U, V>
where
    U: PrimInt + Default + Sync + Send + 'static,
{
    pub fn new() -> Self {
        Self {
            leaves: FxHashMap::default(),
            params: LinearQuadleafIdParams::new(),
        }
    }

    fn insert(
        &mut self,
        coords: Coords<U>,
        init: &dyn Fn((U, U, U)) -> V,
    ) -> Option<LinearQuadleafIdKey> {
        let id = LinearQuadleafId::new(coords, &self.params)?;
        let key = id.key;
        self.leaves.insert(id, init(coords));
        Some(key)
    }

    fn entry(&self, coords: Coords<U>) -> Option<Box<dyn GeoSpacialQuadLeaf<U>>> {
        let key = LinearQuadleafId::make_key(coords, &self.params)?;
        if self.leaves.contains_key(&key) {
            Some(Box::new(Entry::new(key, coords)))
        } else {
            None
        }
    }
}

impl<U, V> GeoSpacialQuadtree<U, V> for LinearQuadtree<U, V>
where
    U: PrimInt + Default + Sync + Send + 'static,
    V: Sync + Send + 'static + Debug,
{
    fn initialize_leaf(
        &mut self,
        (x, y, z): Coords<U>,
        init: &dyn Fn(Coords<U>) -> V,
    ) -> Option<QuadLeafHandle> {
        self.insert((x, y, z), init)
    }

    fn leaf(&self, c: Coords<U>) -> Option<Box<dyn GeoSpacialQuadLeaf<U>>> {
        self.entry(c)
    }

    fn get(&self, handle: QuadLeafHandle) -> Option<&V> {
        self.leaves.get(&handle)
    }

    fn get_mut(&mut self, handle: QuadLeafHandle) -> Option<&mut V> {
        self.leaves.get_mut(&handle)
    }

    fn remove(&mut self, handle: QuadLeafHandle) -> Option<V> {
        self.leaves.remove(&handle)
    }
}

#[derive(Debug)]
struct Entry<U>
where
    U: PrimInt + Default + Sync + Send + 'static,
{
    key: LinearQuadleafIdKey,
    coords: Coords<U>,
}

impl<U> Entry<U>
where
    U: PrimInt + Default + Sync + Send + 'static,
{
    fn new(key: LinearQuadleafIdKey, coords: Coords<U>) -> Self {
        Self { key, coords }
    }
}

impl<U> GeoSpacialQuadLeaf<U> for Entry<U>
where
    U: PrimInt + Default + Sync + Send + 'static,
{
    fn handle(&self) -> QuadLeafHandle {
        self.key
    }

    fn coords(&self) -> Coords<U> {
        self.coords
    }
}

#[cfg(test)]
mod tests {
    use crate::utils::{test::unordered_elements_are, zxy_string};

    use super::*;

    #[test]
    fn children_should_be_queried_by_coords() {
        let mut qt: Box<dyn GeoSpacialQuadtree<u32, String>> = Box::new(LinearQuadtree::new());

        {
            let zero = qt.zero();
            debug_assert!(zero.is_none());
        }

        {
            qt.initialize_zero(&|(x, y, z)| zxy_string((z, x, y)));

            let zero = qt.zero();
            debug_assert!(zero.is_some());
            debug_assert_eq!(
                qt.get(zero.as_ref().unwrap().handle()).unwrap(),
                &zxy_string((0, 0, 0)),
            );
        }

        {
            qt.initialize_children((0, 0, 0), &|(x, y, z)| zxy_string((z, x, y)));

            let children = qt.children((0, 0, 0));
            debug_assert!(children.is_some());
            debug_assert!(unordered_elements_are(
                children
                    .unwrap()
                    .iter()
                    .map(|v| qt.get(v.handle()).unwrap()),
                vec![
                    &zxy_string((1, 0, 0)),
                    &zxy_string((1, 1, 0)),
                    &zxy_string((1, 0, 1)),
                    &zxy_string((1, 1, 1))
                ],
            ));
        }

        {
            qt.initialize_children((2, 2, 4), &|(x, y, z)| zxy_string((z, x, y)));

            let children = qt.children((2, 2, 4));
            debug_assert!(children.is_some());
            debug_assert!(unordered_elements_are(
                children
                    .unwrap()
                    .iter()
                    .map(|v| qt.get(v.handle()).unwrap()),
                vec![
                    &zxy_string((5, 4, 4)),
                    &zxy_string((5, 5, 4)),
                    &zxy_string((5, 4, 5)),
                    &zxy_string((5, 5, 5))
                ],
            ));
        }

        // Check parent
        {
            qt.initialize_leaf((2, 2, 4), &|(x, y, z)| zxy_string((z, x, y)));

            debug_assert_eq!(
                qt.get(qt.parent((4, 4, 5)).unwrap().handle()).unwrap(),
                &zxy_string((4, 2, 2))
            );
            debug_assert_eq!(
                qt.get(qt.parent((4, 5, 5)).unwrap().handle()).unwrap(),
                &zxy_string((4, 2, 2))
            );
            debug_assert_eq!(
                qt.get(qt.parent((5, 4, 5)).unwrap().handle()).unwrap(),
                &zxy_string((4, 2, 2))
            );
            debug_assert_eq!(
                qt.get(qt.parent((5, 5, 5)).unwrap().handle()).unwrap(),
                &zxy_string((4, 2, 2))
            );
        }

        {
            let children = qt.children((0, 0, 0));
            debug_assert!(children.is_some());
            debug_assert!(unordered_elements_are(
                children
                    .unwrap()
                    .iter()
                    .map(|v| qt.get(v.handle()).unwrap()),
                vec![
                    &zxy_string((1, 0, 0)),
                    &zxy_string((1, 1, 0)),
                    &zxy_string((1, 0, 1)),
                    &zxy_string((1, 1, 1))
                ],
            ));
        }
    }

    #[test]
    fn it_should_not_get_unxepected_children() {
        let mut qt: Box<dyn GeoSpacialQuadtree<u32, String>> = Box::new(LinearQuadtree::new());

        {
            let zero = qt.zero();
            debug_assert!(zero.is_none());
        }

        {
            qt.initialize_children((0, 5, 3), &|(x, y, z)| zxy_string((z, x, y)));

            let children = qt.children((0, 5, 3));
            debug_assert!(children.is_some());
            debug_assert!(unordered_elements_are(
                children
                    .unwrap()
                    .iter()
                    .map(|v| qt.get(v.handle()).unwrap()),
                vec![
                    &zxy_string((4, 0, 10)),
                    &zxy_string((4, 1, 10)),
                    &zxy_string((4, 0, 11)),
                    &zxy_string((4, 1, 11))
                ],
            ));
        }

        {
            // It should not get children which isn't matched exactly.
            let children = qt.children((0, 1, 1));
            debug_assert!(children.is_none());

            qt.initialize_children((0, 1, 1), &|(x, y, z)| zxy_string((z, x, y)));

            let children = qt.children((0, 1, 1));
            debug_assert!(children.is_some());
            debug_assert!(unordered_elements_are(
                children
                    .unwrap()
                    .iter()
                    .map(|v| qt.get(v.handle()).unwrap()),
                vec![
                    &zxy_string((2, 0, 2)),
                    &zxy_string((2, 1, 2)),
                    &zxy_string((2, 0, 3)),
                    &zxy_string((2, 1, 3))
                ],
            ));
        }
    }
}
