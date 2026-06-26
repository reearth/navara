use std::fmt::Debug;

use bevy_ecs::entity::Entity;
use navara_core::TileXYZ;
use navara_geometry::{TileUvTransform, uv_transform};
use navara_quadtree::Quadtree;

/// Resolve the deepest tile in a WebMercator quadtree that covers `coords`,
/// walking up to the nearest ancestor for which `pick` yields a usable entity.
///
/// Returns the chosen entity and an optional UV transform — `None` means the
/// exact tile was used (identity UV).
pub fn resolve_covering_tile<T>(
    qt: &Quadtree<usize, T>,
    coords: TileXYZ,
    pick: impl Fn(&T) -> Option<Entity>,
) -> Option<(Entity, Option<TileUvTransform>)>
where
    T: Sync + Send + 'static + Debug,
{
    // Exact tile first (identity UV).
    if let Some(leaf) = qt.qt.leaf((coords.x, coords.y, coords.z))
        && let Some(tile) = qt.qt.get(leaf.handle())
        && let Some(entity) = pick(tile)
    {
        return Some((entity, None));
    }

    // Climb ancestors for a coarser usable tile.
    let (mut x, mut y, mut z) = (coords.x, coords.y, coords.z);
    while z > 0 {
        z -= 1;
        x /= 2;
        y /= 2;
        if let Some(leaf) = qt.qt.leaf((x, y, z))
            && let Some(tile) = qt.qt.get(leaf.handle())
            && let Some(entity) = pick(tile)
        {
            return Some((entity, Some(uv_transform(coords, z))));
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::resolve_covering_tile;
    use bevy_ecs::{entity::Entity, world::World};
    use navara_core::TileXYZ;
    use navara_geometry::uv_transform;
    use navara_quadtree::Quadtree;

    #[derive(Debug)]
    struct TestTile {
        entity: Option<Entity>,
    }

    /// Build a quadtree with the (0,0,*) branch initialized down to z=2.
    fn build_qt() -> Quadtree<usize, TestTile> {
        let mut qt: Quadtree<usize, TestTile> = Quadtree::new_with_linear_qt();
        qt.qt.initialize_zero(&|_| TestTile { entity: None });
        qt.qt
            .initialize_children((0, 0, 0), &|_| TestTile { entity: None });
        qt.qt
            .initialize_children((0, 0, 1), &|_| TestTile { entity: None });
        qt
    }

    fn set_entity(qt: &mut Quadtree<usize, TestTile>, coords: (usize, usize, usize), e: Entity) {
        let handle = qt.qt.leaf(coords).unwrap().handle();
        qt.qt.get_mut(handle).unwrap().entity = Some(e);
    }

    fn coords(x: usize, y: usize, z: usize) -> TileXYZ {
        TileXYZ { x, y, z }
    }

    /// The exact tile is usable → returned with identity UV (`None`).
    #[test]
    fn exact_tile_returns_identity_uv() {
        let mut world = World::new();
        let e = world.spawn_empty().id();
        let mut qt = build_qt();
        set_entity(&mut qt, (0, 0, 2), e);

        let r = resolve_covering_tile(&qt, coords(0, 0, 2), |t| t.entity);
        assert_eq!(r, Some((e, None)));
    }

    /// Exact tile unusable, parent usable → parent entity + one-level UV sub-rect.
    #[test]
    fn falls_back_to_parent_with_uv_subrect() {
        let mut world = World::new();
        let parent = world.spawn_empty().id();
        let mut qt = build_qt();
        set_entity(&mut qt, (0, 0, 1), parent);

        let r = resolve_covering_tile(&qt, coords(0, 0, 2), |t| t.entity);
        assert_eq!(r, Some((parent, Some(uv_transform(coords(0, 0, 2), 1)))));
    }

    /// Climbs more than one level when nearer ancestors are unusable.
    #[test]
    fn climbs_multiple_levels_to_root() {
        let mut world = World::new();
        let root = world.spawn_empty().id();
        let mut qt = build_qt();
        set_entity(&mut qt, (0, 0, 0), root);

        let r = resolve_covering_tile(&qt, coords(0, 0, 2), |t| t.entity);
        assert_eq!(r, Some((root, Some(uv_transform(coords(0, 0, 2), 0)))));
    }

    /// The exact tile wins even when an ancestor is also usable.
    #[test]
    fn prefers_exact_over_ancestor() {
        let mut world = World::new();
        let exact = world.spawn_empty().id();
        let parent = world.spawn_empty().id();
        let mut qt = build_qt();
        set_entity(&mut qt, (0, 0, 2), exact);
        set_entity(&mut qt, (0, 0, 1), parent);

        let r = resolve_covering_tile(&qt, coords(0, 0, 2), |t| t.entity);
        assert_eq!(r, Some((exact, None)));
    }

    /// The target coords need not exist in the quadtree — a deeper terrain tile
    /// than the raster pyramid still resolves to the nearest usable ancestor.
    #[test]
    fn handles_missing_exact_tile() {
        let mut world = World::new();
        let leaf = world.spawn_empty().id();
        let mut qt = build_qt(); // deepest initialized level is z=2
        set_entity(&mut qt, (0, 0, 2), leaf);

        // z=3 is not in the quadtree, so the walk climbs to (0,0,2).
        let r = resolve_covering_tile(&qt, coords(0, 0, 3), |t| t.entity);
        assert_eq!(r, Some((leaf, Some(uv_transform(coords(0, 0, 3), 2)))));
    }

    /// Nothing usable anywhere on the ancestor chain → `None`.
    #[test]
    fn returns_none_when_no_ancestor_usable() {
        let qt = build_qt();
        let r = resolve_covering_tile(&qt, coords(0, 0, 2), |t| t.entity);
        assert_eq!(r, None);
    }
}
