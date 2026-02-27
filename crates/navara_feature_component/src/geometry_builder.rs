use bevy_ecs::entity::Entity;
use bevy_ecs::system::Commands;
use navara_buffer_store::BufferStore;
use navara_layer::LayerId;
use navara_material::Appearance;

use crate::{
    batch::{BatchedFeature, FeatureBatchId, GlobalBatchIds},
    billboard::BillboardMarker,
    id::FeatureId,
    point::PointMarker,
    polygon::PolygonMarker,
    polyline::PolylineMarker,
    text::TextMarker,
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

/// Per-kind batch state during geometry construction.
///
/// Shared between GeoJSON and MVT builders to track batch indices
/// and lazy commit state for each appearance kind.
pub struct KindBatchState {
    pub kind: GeometryAppearanceKind,
    pub batch_id: u32,
    pub feature_count: u32,
    /// Whether the current feature has been committed to this kind's batch.
    pub committed: bool,
    /// Batch index assigned to the current feature for this kind.
    pub current_batch_index: u32,
}

/// A group of feature entities sharing the same appearance kind.
pub struct GeometryGroup {
    pub kind: GeometryAppearanceKind,
    pub entities: Vec<Entity>,
    pub global_batch_ids: Vec<u32>,
}

/// Accumulates feature entities grouped by appearance kind during geometry construction.
///
/// Used by both GeoJSON and MVT builders to collect child entities into groups
/// before spawning `BatchedFeature` parents. Also manages per-kind batch state
/// and batch ID tracking.
pub struct GeometryGroups {
    pub groups: Vec<GeometryGroup>,
    pub batch_ids_by_kind: Vec<(GeometryAppearanceKind, u32)>,
    pub kind_states: Vec<KindBatchState>,
}

impl GeometryGroups {
    pub fn new() -> Self {
        Self {
            groups: Vec::new(),
            batch_ids_by_kind: Vec::new(),
            kind_states: Vec::new(),
        }
    }

    /// Get or create a group for the given kind, returning its index.
    pub fn get_or_create_group(&mut self, kind: GeometryAppearanceKind) -> usize {
        if let Some(pos) = self.groups.iter().position(|g| g.kind == kind) {
            pos
        } else {
            self.groups.push(GeometryGroup {
                kind,
                entities: Vec::new(),
                global_batch_ids: Vec::new(),
            });
            self.groups.len() - 1
        }
    }

    /// Add an entity to the group for the given kind.
    fn push_entity(&mut self, kind: GeometryAppearanceKind, entity: Entity, global_batch_id: u32) {
        let group_idx = self.get_or_create_group(kind);
        let group = &mut self.groups[group_idx];
        group.global_batch_ids.push(global_batch_id);
        group.entities.push(entity);
    }

    /// Check if a kind has already been initialized.
    pub fn has_kind(&self, kind: GeometryAppearanceKind) -> bool {
        self.kind_states.iter().any(|s| s.kind == kind)
    }

    /// Register a new kind with its batch_id.
    pub fn register_kind(&mut self, kind: GeometryAppearanceKind, batch_id: u32) {
        self.kind_states.push(KindBatchState {
            kind,
            batch_id,
            feature_count: 0,
            committed: false,
            current_batch_index: 0,
        });
        self.batch_ids_by_kind.push((kind, batch_id));
    }

    /// Reset committed flags for all kind states. Call once per feature.
    pub fn begin_feature(&mut self) {
        for state in &mut self.kind_states {
            state.committed = false;
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
        let state_idx = self
            .kind_states
            .iter()
            .position(|s| s.kind == kind)
            .unwrap();

        let commit_batch_id = if !self.kind_states[state_idx].committed {
            self.kind_states[state_idx].current_batch_index =
                self.kind_states[state_idx].feature_count;
            self.kind_states[state_idx].feature_count += 1;
            self.kind_states[state_idx].committed = true;
            Some(self.kind_states[state_idx].batch_id)
        } else {
            None
        };

        let batch_index = self.kind_states[state_idx].current_batch_index;
        self.push_entity(kind, entity, global_batch_id);

        (batch_index, commit_batch_id)
    }

    /// Finalize by spawning `BatchedFeature` parent entities.
    ///
    /// Iterates over all groups, creates `GlobalBatchIds` buffers, and spawns
    /// parent entities with the appropriate marker and material.
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

            let feature_batch_id = self
                .batch_ids_by_kind
                .iter()
                .find(|(k, _)| *k == group.kind)
                .map(|(_, id)| *id)
                .unwrap();

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
                FeatureBatchId(feature_batch_id),
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
    // Find matching appearance before spawning
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
        batch_ids_by_kind: Vec<(GeometryAppearanceKind, u32)>,
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
                out.batch_ids_by_kind = groups.batch_ids_by_kind;
            },
        );
        app.update();
        app
    }

    #[test]
    fn new_groups_is_empty() {
        let groups = GeometryGroups::new();
        assert!(groups.groups.is_empty());
        assert!(groups.batch_ids_by_kind.is_empty());
        assert!(groups.kind_states.is_empty());
    }

    #[test]
    fn get_or_create_group_returns_same_index_for_same_kind() {
        let mut groups = GeometryGroups::new();
        let idx1 = groups.get_or_create_group(GeometryAppearanceKind::Polygon);
        let idx2 = groups.get_or_create_group(GeometryAppearanceKind::Polygon);
        assert_eq!(idx1, idx2);
        assert_eq!(groups.groups.len(), 1);
    }

    #[test]
    fn get_or_create_group_returns_different_indices_for_different_kinds() {
        let mut groups = GeometryGroups::new();
        let idx1 = groups.get_or_create_group(GeometryAppearanceKind::Point);
        let idx2 = groups.get_or_create_group(GeometryAppearanceKind::Polyline);
        assert_ne!(idx1, idx2);
        assert_eq!(groups.groups.len(), 2);
    }

    #[test]
    fn push_entity_assigns_sequential_batch_indices() {
        let app = run_groups_test(|commands, groups| {
            let e1 = commands.spawn_empty().id();
            let e2 = commands.spawn_empty().id();
            let e3 = commands.spawn_empty().id();

            groups.push_entity(GeometryAppearanceKind::Point, e1, 100);
            groups.push_entity(GeometryAppearanceKind::Point, e2, 101);
            groups.push_entity(GeometryAppearanceKind::Point, e3, 102);
        });
        let out = app.world().resource::<GroupsTestOutput>();
        assert_eq!(out.groups.len(), 1);
        assert_eq!(out.groups[0].entities.len(), 3);
        assert_eq!(out.groups[0].global_batch_ids, vec![100, 101, 102]);
    }

    #[test]
    fn push_entity_groups_entities_by_kind() {
        let app = run_groups_test(|commands, groups| {
            let e1 = commands.spawn_empty().id();
            let e2 = commands.spawn_empty().id();
            let e3 = commands.spawn_empty().id();

            groups.push_entity(GeometryAppearanceKind::Point, e1, 10);
            groups.push_entity(GeometryAppearanceKind::Polyline, e2, 20);
            groups.push_entity(GeometryAppearanceKind::Point, e3, 11);
        });
        let out = app.world().resource::<GroupsTestOutput>();
        assert_eq!(out.groups.len(), 2);
        assert_eq!(out.groups[0].kind, GeometryAppearanceKind::Point);
        assert_eq!(out.groups[0].entities.len(), 2);
        assert_eq!(out.groups[1].kind, GeometryAppearanceKind::Polyline);
        assert_eq!(out.groups[1].entities.len(), 1);
    }

    #[test]
    fn register_kind_tracks_batch_ids() {
        let mut groups = GeometryGroups::new();
        groups.register_kind(GeometryAppearanceKind::Point, 42);
        groups.register_kind(GeometryAppearanceKind::Polyline, 99);

        assert!(groups.has_kind(GeometryAppearanceKind::Point));
        assert!(groups.has_kind(GeometryAppearanceKind::Polyline));
        assert!(!groups.has_kind(GeometryAppearanceKind::Polygon));
        assert_eq!(groups.batch_ids_by_kind.len(), 2);
    }

    #[test]
    fn begin_feature_resets_committed_flags() {
        let mut groups = GeometryGroups::new();
        groups.register_kind(GeometryAppearanceKind::Point, 1);

        // Simulate a commit
        groups.kind_states[0].committed = true;

        groups.begin_feature();
        assert!(!groups.kind_states[0].committed);
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
}
