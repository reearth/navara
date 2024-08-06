use std::fmt::Debug;

use num::PrimInt;
use quadtree_rs::{
    area::{Area, AreaBuilder},
    point::Point,
};

use crate::{
    traits::{Coords, GeoSpacialQuadLeaf, GeoSpacialQuadtree, Resource},
    utils::to_int,
};

#[cfg_attr(feature = "bevy", derive(bevy_ecs::prelude::Resource))]
pub struct RegionQuadtree<U, V>
where
    U: PrimInt + Default,
{
    qt: quadtree_rs::Quadtree<U, V>,
    depth: usize,
}

impl<U, V> Resource for RegionQuadtree<U, V>
where
    U: PrimInt + Default + Sync + Send + 'static,
    V: Sync + Send + 'static + Debug,
{
}

impl<U, V> RegionQuadtree<U, V>
where
    U: PrimInt + Default + Sync + Send + 'static,
{
    pub fn new(depth: usize) -> Self {
        Self {
            qt: quadtree_rs::Quadtree::new(depth),
            depth,
        }
    }

    fn insert(&mut self, (x, y, z): Coords<U>, init: &dyn Fn((U, U, U)) -> V) -> Option<u64> {
        let width = ((to_int::<usize, U>(self.depth) - z) as U).pow(2);
        if width.is_zero() {
            return None;
        }

        match AreaBuilder::default()
            .anchor(Point { x, y })
            .dimensions((width, width))
            .build()
        {
            Ok(area) => self.qt.insert(area, init((x, y, z))),
            Err(e) => unreachable!("{}", e),
        }
    }

    fn query_strict(&self, (x, y, z): Coords<U>) -> Option<Box<dyn GeoSpacialQuadLeaf<U>>> {
        let cur_depth = to_int::<usize, U>(self.depth) - z;
        let width = cur_depth.pow(2) as U;
        if width.is_zero() {
            return None;
        }
        match AreaBuilder::default()
            .anchor(Point { x, y })
            .dimensions((width, width))
            .build()
        {
            Ok(area) => {
                let child = self.qt.query_strict(area);
                if let Some(child) = child.into_iter().next() {
                    let area = child.area();
                    let area_point = area.anchor();
                    let area_width = area.width();
                    if area_point.x != x || area_point.y != y || area_width != width {
                        return None;
                    }
                    return Some(Box::new(Entry::new(child, (x, y, z), self.depth)));
                }
                None
            }
            Err(e) => unreachable!("{}", e),
        }
    }
}

impl<U, V> GeoSpacialQuadtree<U, V> for RegionQuadtree<U, V>
where
    U: PrimInt + Default + Sync + Send + 'static,
    V: Sync + Send + 'static + Debug,
{
    fn initialize_leaf(
        &mut self,
        (x, y, z): Coords<U>,
        init: &dyn Fn(Coords<U>) -> V,
    ) -> Option<u64> {
        self.insert((x, y, z), init)
    }

    fn leaf(&self, c: Coords<U>) -> Option<Box<dyn GeoSpacialQuadLeaf<U>>> {
        self.query_strict(c)
    }

    fn get(&self, handle: u64) -> Option<&V> {
        self.qt.get(handle).map(|e| e.value_ref())
    }

    fn get_mut(&mut self, handle: u64) -> Option<&mut V> {
        self.qt.get_mut(handle).map(|e| e.value_mut())
    }

    fn remove(&mut self, handle: u64) -> bool {
        self.qt.delete_by_handle(handle).is_some()
    }
}

#[derive(Debug)]
struct Entry<U>
where
    U: PrimInt + Default + Sync + Send + 'static,
{
    handle: u64,
    area: Area<U>,
    x: U,
    y: U,
    z: U,
    max_depth: usize,
}

impl<U> Entry<U>
where
    U: PrimInt + Default + Sync + Send + 'static,
{
    fn new<V>(e: &quadtree_rs::entry::Entry<U, V>, (x, y, z): Coords<U>, max_depth: usize) -> Self {
        Self {
            handle: e.handle(),
            area: e.area(),
            x,
            y,
            z,
            max_depth,
        }
    }
}

impl<U> GeoSpacialQuadLeaf<U> for Entry<U>
where
    U: PrimInt + Default + Sync + Send + 'static,
{
    fn handle(&self) -> u64 {
        self.handle
    }

    fn coords(&self) -> (U, U, U) {
        (self.x, self.y, self.z)
    }

    fn contains(&self, (x, y, z): Coords<U>) -> bool {
        let width = (to_int::<usize, U>(self.max_depth) - z).pow(2) as U;
        match AreaBuilder::default()
            .anchor(Point { x, y })
            .dimensions((width, width))
            .build()
        {
            Ok(area) => self.area.contains(area),
            Err(_) => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::utils::{test::unordered_elements_are, zxy_string};

    use super::*;

    #[test]
    fn children_should_be_queried_by_coords() {
        let mut qt: Box<dyn GeoSpacialQuadtree<u32, String>> = Box::new(RegionQuadtree::new(20));

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
        let mut qt: Box<dyn GeoSpacialQuadtree<u32, String>> = Box::new(RegionQuadtree::new(20));

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

    #[test]
    fn coords_should_be_contained_in_children() {
        let mut qt: Box<dyn GeoSpacialQuadtree<u32, String>> = Box::new(RegionQuadtree::new(20));

        let current_coords = (2, 2, 4);

        qt.initialize_leaf(current_coords, &|(x, y, z)| zxy_string((z, x, y)));
        qt.initialize_children(current_coords, &|(x, y, z)| zxy_string((z, x, y)));

        let leaf = qt.leaf(current_coords).unwrap();

        // Check parent
        debug_assert!(!leaf.contains((1, 1, 3)));

        debug_assert!(leaf.contains((4, 4, 5)));
        debug_assert!(leaf.contains((5, 4, 5)));
    }

    #[test]
    fn it_should_create_children_if_inexistence() {
        let mut qt: Box<dyn GeoSpacialQuadtree<u32, String>> = Box::new(RegionQuadtree::new(20));

        let current_coords = (2, 2, 4);

        let children =
            qt.get_or_create_children(current_coords, &|(x, y, z)| zxy_string((z, x, y)));

        debug_assert!(unordered_elements_are(
            children.iter().map(|v| qt.get(v.0).unwrap()),
            vec![
                &zxy_string((5, 4, 4)),
                &zxy_string((5, 5, 4)),
                &zxy_string((5, 4, 5)),
                &zxy_string((5, 5, 5)),
            ],
        ));

        let handle = children[1].0;
        let removed = qt.remove(handle);
        assert!(removed);

        let children = qt.children(current_coords);
        // Because the number of children isn't four.
        assert!(children.is_none());

        let children =
            qt.get_or_create_children(current_coords, &|(x, y, z)| zxy_string((z, x, y)));

        debug_assert!(unordered_elements_are(
            children.iter().map(|v| qt.get(v.0).unwrap()),
            vec![
                &zxy_string((5, 4, 4)),
                &zxy_string((5, 5, 4)),
                &zxy_string((5, 4, 5)),
                &zxy_string((5, 5, 5)),
            ],
        ));
    }
}
