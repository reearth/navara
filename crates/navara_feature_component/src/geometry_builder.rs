use bevy_ecs::entity::Entity;
use bevy_ecs::system::Commands;
use bevy_log::warn;
use navara_buffer_store::BufferStore;
use navara_core::CRS;
use navara_layer::LayerId;
use navara_material::Appearance;
use navara_math::Vec3;

use crate::{
    BatchedFeatureMarker,
    batch::{BatchedFeature, FeatureBatchId, GlobalBatchIds},
    billboard::{BillboardGeometry, BillboardMarker},
    id::FeatureId,
    point::{PointGeometry, PointMarker},
    polygon::PolygonMarker,
    polyline::PolylineMarker,
    text::{TextGeometry, TextMarker},
};

/// Identifies which geometry-appearance combination a group belongs to.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum GeometryAppearanceKind {
    Point,
    Billboard,
    Text,
    Polyline,
    Polygon,
}

/// A group of feature entities sharing the same appearance kind,
/// with per-kind batch state for tracking indices during construction.
pub struct GeometryGroup {
    pub kind: GeometryAppearanceKind,
    pub entities: Vec<Entity>,
    pub global_batch_ids: Vec<u32>,
    pub batch_id: u32,
    pub feature_count: u32,
    /// Whether the current feature has been committed to this kind's batch.
    pub committed: bool,
    /// Batch index assigned to the current feature for this kind.
    pub current_batch_index: u32,
}

/// Accumulates feature entities grouped by appearance kind during geometry construction.
///
/// Used by both GeoJSON and MVT builders to collect child entities into groups
/// before spawning `BatchedFeature` parents.
pub struct GeometryGroups {
    pub groups: Vec<GeometryGroup>,
}

impl GeometryGroups {
    pub fn new() -> Self {
        Self { groups: Vec::new() }
    }

    /// Check if a kind has already been registered.
    pub fn has_kind(&self, kind: GeometryAppearanceKind) -> bool {
        self.groups.iter().any(|g| g.kind == kind)
    }

    /// Register a new kind with its batch_id, creating its group.
    pub fn register_kind(&mut self, kind: GeometryAppearanceKind, batch_id: u32) {
        self.groups.push(GeometryGroup {
            kind,
            entities: Vec::new(),
            global_batch_ids: Vec::new(),
            batch_id,
            feature_count: 0,
            committed: false,
            current_batch_index: 0,
        });
    }

    /// Reset committed flags for all groups. Call once per feature.
    pub fn begin_feature(&mut self) {
        for group in &mut self.groups {
            group.committed = false;
        }
    }

    /// Track an entity for a kind. Returns `(batch_index, commit_batch_id)`.
    ///
    /// If `commit_batch_id` is `Some(id)`, the caller should commit pending
    /// feature data (properties or tags) to that batch ID.
    pub fn track_entity(
        &mut self,
        kind: GeometryAppearanceKind,
        entity: Entity,
        global_batch_id: u32,
    ) -> (u32, Option<u32>) {
        let group = self.groups.iter_mut().find(|g| g.kind == kind).unwrap();

        let commit_batch_id = if !group.committed {
            group.current_batch_index = group.feature_count;
            group.feature_count += 1;
            group.committed = true;
            Some(group.batch_id)
        } else {
            None
        };

        let batch_index = group.current_batch_index;
        group.global_batch_ids.push(global_batch_id);
        group.entities.push(entity);

        (batch_index, commit_batch_id)
    }

    /// Finalize by spawning `BatchedFeature` parent entities.
    pub fn finalize(
        self,
        commands: &mut Commands,
        buf: &mut BufferStore,
        appearances: &[Appearance],
        layer_id: &str,
        default_active: bool,
    ) -> Vec<Entity> {
        let mut result = Vec::new();

        for group in self.groups {
            if group.entities.is_empty() {
                continue;
            }

            let batch_length = group.global_batch_ids.len() as u32;
            let global_batch_ids = GlobalBatchIds {
                handle: buf.new_u32(group.global_batch_ids),
                batch_length,
            };

            let batched = BatchedFeature {
                features: group.entities,
                default_active,
                ..Default::default()
            };

            if let Some(entity) = spawn_batched_entity(
                commands,
                batched,
                group.kind,
                appearances,
                layer_id,
                FeatureBatchId(group.batch_id),
                global_batch_ids,
            ) {
                result.push(entity);
            }
        }

        result
    }
}

impl Default for GeometryGroups {
    fn default() -> Self {
        Self::new()
    }
}

/// Spawn a point-like child entity with the appropriate geometry component.
///
/// Handles Point, Billboard, and Text kinds. Panics if called with Polyline or Polygon.
pub fn spawn_point_entity(
    commands: &mut Commands,
    coords: Vec3,
    crs: CRS,
    kind: GeometryAppearanceKind,
) -> Entity {
    match kind {
        GeometryAppearanceKind::Point => commands
            .spawn((BatchedFeatureMarker, PointGeometry { coords, crs }))
            .id(),
        GeometryAppearanceKind::Billboard => commands
            .spawn((BatchedFeatureMarker, BillboardGeometry { coords, crs }))
            .id(),
        GeometryAppearanceKind::Text => commands
            .spawn((BatchedFeatureMarker, TextGeometry { coords, crs }))
            .id(),
        _ => unreachable!("spawn_point_entity called with non-point kind: {:?}", kind),
    }
}

/// Spawn a `BatchedFeature` parent entity with the appropriate marker and material.
fn spawn_batched_entity(
    commands: &mut Commands,
    batched: BatchedFeature,
    kind: GeometryAppearanceKind,
    appearances: &[Appearance],
    layer_id: &str,
    feature_batch_id: FeatureBatchId,
    global_batch_ids: GlobalBatchIds,
) -> Option<Entity> {
    let appearance = appearances.iter().find(|a| {
        matches!(
            (kind, a),
            (GeometryAppearanceKind::Point, Appearance::Point(_))
                | (GeometryAppearanceKind::Billboard, Appearance::Billboard(_))
                | (GeometryAppearanceKind::Text, Appearance::Text(_))
                | (GeometryAppearanceKind::Polyline, Appearance::Polyline(_))
                | (GeometryAppearanceKind::Polygon, Appearance::Polygon(_))
        )
    })?;

    let mut ec = commands.spawn((
        batched,
        FeatureId::default(),
        LayerId(layer_id.to_string()),
        feature_batch_id,
        global_batch_ids,
    ));

    match appearance {
        Appearance::Point(mat) => {
            ec.insert((PointMarker, mat.clone()));
        }
        Appearance::Billboard(mat) => {
            ec.insert((BillboardMarker, mat.clone()));
        }
        Appearance::Text(mat) => {
            ec.insert((TextMarker, mat.clone()));
        }
        Appearance::Polyline(mat) => {
            ec.insert((PolylineMarker, mat.clone()));
        }
        Appearance::Polygon(mat) => {
            ec.insert((PolygonMarker, mat.clone()));
        }
        Appearance::Model(_) => {
            warn!("Model material isn't supported");
        }
        _ => {}
    }

    Some(ec.id())
}

#[cfg(test)]
mod test {
    use super::*;
    use bevy_app::{App, Update};
    use bevy_ecs::prelude::Resource;
    use bevy_ecs::system::{Commands, ResMut};

    #[derive(Resource, Default)]
    struct GroupsTestOutput {
        groups: Vec<GeometryGroup>,
    }

    fn run_groups_test(
        setup: impl FnOnce(&mut Commands, &mut GeometryGroups) + Send + Sync + 'static,
    ) -> App {
        let mut app = App::new();
        app.init_resource::<GroupsTestOutput>();

        let setup = std::sync::Mutex::new(Some(setup));
        app.add_systems(
            Update,
            move |mut commands: Commands, mut out: ResMut<GroupsTestOutput>| {
                let setup_fn = setup.lock().unwrap().take().unwrap();
                let mut groups = GeometryGroups::new();
                setup_fn(&mut commands, &mut groups);
                out.groups = std::mem::take(&mut groups.groups);
            },
        );
        app.update();
        app
    }

    #[test]
    fn new_groups_is_empty() {
        let groups = GeometryGroups::new();
        assert!(groups.groups.is_empty());
    }

    #[test]
    fn register_kind_creates_group() {
        let mut groups = GeometryGroups::new();
        groups.register_kind(GeometryAppearanceKind::Point, 42);
        groups.register_kind(GeometryAppearanceKind::Polyline, 99);

        assert!(groups.has_kind(GeometryAppearanceKind::Point));
        assert!(groups.has_kind(GeometryAppearanceKind::Polyline));
        assert!(!groups.has_kind(GeometryAppearanceKind::Polygon));
        assert_eq!(groups.groups.len(), 2);
        assert_eq!(groups.groups[0].batch_id, 42);
        assert_eq!(groups.groups[1].batch_id, 99);
    }

    #[test]
    fn begin_feature_resets_committed_flags() {
        let mut groups = GeometryGroups::new();
        groups.register_kind(GeometryAppearanceKind::Point, 1);

        groups.groups[0].committed = true;

        groups.begin_feature();
        assert!(!groups.groups[0].committed);
    }

    #[test]
    fn track_entity_returns_commit_on_first_call_per_feature() {
        let app = run_groups_test(|commands, groups| {
            groups.register_kind(GeometryAppearanceKind::Point, 42);

            groups.begin_feature();
            let e1 = commands.spawn_empty().id();
            let (idx1, commit1) = groups.track_entity(GeometryAppearanceKind::Point, e1, 100);
            assert_eq!(idx1, 0);
            assert_eq!(commit1, Some(42));

            // Second entity for same feature+kind: no commit
            let e2 = commands.spawn_empty().id();
            let (idx2, commit2) = groups.track_entity(GeometryAppearanceKind::Point, e2, 101);
            assert_eq!(idx2, 0); // same batch index (same feature)
            assert!(commit2.is_none());

            // New feature
            groups.begin_feature();
            let e3 = commands.spawn_empty().id();
            let (idx3, commit3) = groups.track_entity(GeometryAppearanceKind::Point, e3, 102);
            assert_eq!(idx3, 1);
            assert_eq!(commit3, Some(42));
        });
        let out = app.world().resource::<GroupsTestOutput>();
        assert_eq!(out.groups.len(), 1);
        assert_eq!(out.groups[0].entities.len(), 3);
    }

    #[test]
    fn track_entity_groups_entities_by_kind() {
        let app = run_groups_test(|commands, groups| {
            groups.register_kind(GeometryAppearanceKind::Point, 1);
            groups.register_kind(GeometryAppearanceKind::Polyline, 2);

            groups.begin_feature();
            let e1 = commands.spawn_empty().id();
            groups.track_entity(GeometryAppearanceKind::Point, e1, 10);
            let e2 = commands.spawn_empty().id();
            groups.track_entity(GeometryAppearanceKind::Polyline, e2, 20);

            groups.begin_feature();
            let e3 = commands.spawn_empty().id();
            groups.track_entity(GeometryAppearanceKind::Point, e3, 11);
        });
        let out = app.world().resource::<GroupsTestOutput>();
        assert_eq!(out.groups.len(), 2);
        assert_eq!(out.groups[0].kind, GeometryAppearanceKind::Point);
        assert_eq!(out.groups[0].entities.len(), 2);
        assert_eq!(out.groups[0].global_batch_ids, vec![10, 11]);
        assert_eq!(out.groups[1].kind, GeometryAppearanceKind::Polyline);
        assert_eq!(out.groups[1].entities.len(), 1);
    }
}
