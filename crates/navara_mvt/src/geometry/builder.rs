use std::sync::Arc;

use bevy_ecs::entity::Entity;
use geozero::mvt::tile;

use navara_feature_component::{
    batch::BatchTable,
    geometry_builder::{GeometryAppearanceKind, GeometryGroups},
};
use navara_parser::mvt::MvtLayerData;

/// Accumulates feature entities and batch IDs during MVT geometry construction.
///
/// Each appearance kind gets its own batch with its own feature count and
/// batch indices. Tags are stored per-kind: when a feature produces entities
/// for multiple kinds, its tags are duplicated into each kind's batch.
///
/// Tags are stored lazily: `begin_feature` prepares the data, but it is only
/// committed to the batch table when `add_entity` is first called for that
/// kind. This avoids phantom batch entries for features whose geometry does
/// not match any appearance.
pub(crate) struct MvtGeometryBuilder<'a> {
    pub(crate) groups: GeometryGroups,
    keys: Arc<Vec<String>>,
    values: Arc<Vec<tile::Value>>,
    batch_table: &'a mut BatchTable,
    layer_id: &'a str,
    feature_count_hint: usize,
    pending_tags: Option<Vec<u32>>,
}

impl<'a> MvtGeometryBuilder<'a> {
    pub(crate) fn new(
        batch_table: &'a mut BatchTable,
        layer_id: &'a str,
        keys: Arc<Vec<String>>,
        values: Arc<Vec<tile::Value>>,
        feature_count_hint: usize,
    ) -> Self {
        Self {
            groups: GeometryGroups::new(),
            keys,
            values,
            batch_table,
            layer_id,
            feature_count_hint,
            pending_tags: None,
        }
    }

    /// Begin processing a new feature. Stores tags lazily.
    pub(crate) fn begin_feature(&mut self, tags: Vec<u32>) {
        self.pending_tags = Some(tags);
        self.groups.begin_feature();
    }

    /// Add an entity to the group for the given appearance kind.
    ///
    /// Lazily commits the pending feature tags to this kind's batch on first
    /// call per kind per feature. Returns the per-kind batch index for this
    /// feature (to be used as `BatchIndex` on the child entity).
    pub(crate) fn add_entity(&mut self, kind: GeometryAppearanceKind, entity: Entity) -> u32 {
        if !self.groups.has_kind(kind) {
            let mvt_layer_data = MvtLayerData {
                keys: Arc::clone(&self.keys),
                values: Arc::clone(&self.values),
                feature_tags: Vec::with_capacity(self.feature_count_hint),
            };
            let batch_id = self
                .batch_table
                .init_mvt(Some(self.layer_id.to_owned()), mvt_layer_data)
                .unwrap_or(0);
            self.groups.register_kind(kind, batch_id);
        }

        let global_batch_id = self.batch_table.gen_global_batch_id().unwrap_or(0);

        let (batch_index, commit_batch_id) =
            self.groups.track_entity(kind, entity, global_batch_id);

        if let Some(batch_id) = commit_batch_id {
            let tags = self.pending_tags.clone().unwrap();
            self.batch_table.add_mvt_feature_tags(batch_id, tags);
        }

        batch_index
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use bevy_app::{App, Update};
    use bevy_ecs::prelude::Resource;
    use bevy_ecs::system::{Commands, ResMut};
    use navara_feature_component::batch::BatchTable;
    use navara_feature_component::geometry_builder::GeometryGroup;

    #[derive(Resource, Default)]
    struct BuilderTestOutput {
        groups: Vec<GeometryGroup>,
    }

    fn run_builder_test(
        setup: impl FnOnce(&mut Commands, &mut MvtGeometryBuilder) + Send + Sync + 'static,
    ) -> App {
        let mut app = App::new();
        app.init_resource::<BatchTable>();
        app.init_resource::<BuilderTestOutput>();

        let setup = std::sync::Mutex::new(Some(setup));
        app.add_systems(
            Update,
            move |mut commands: Commands,
                  mut batch_table: ResMut<BatchTable>,
                  mut out: ResMut<BuilderTestOutput>| {
                let setup_fn = setup.lock().unwrap().take().unwrap();
                let keys = Arc::new(vec!["name".to_string(), "class".to_string()]);
                let values = Arc::new(vec![]);
                let mut builder =
                    MvtGeometryBuilder::new(&mut batch_table, "test_layer", keys, values, 0);
                setup_fn(&mut commands, &mut builder);
                out.groups = std::mem::take(&mut builder.groups.groups);
            },
        );
        app.update();
        app
    }

    #[test]
    fn new_builder_has_empty_groups() {
        let app = run_builder_test(|_, _| {});
        let out = app.world().resource::<BuilderTestOutput>();
        assert!(out.groups.is_empty());
    }

    #[test]
    fn add_entity_assigns_sequential_batch_indices() {
        let app = run_builder_test(|commands, builder| {
            let e1 = commands.spawn_empty().id();
            let e2 = commands.spawn_empty().id();
            let e3 = commands.spawn_empty().id();

            builder.begin_feature(vec![0, 0]);
            let idx1 = builder.add_entity(GeometryAppearanceKind::Point, e1);

            builder.begin_feature(vec![0, 1]);
            let idx2 = builder.add_entity(GeometryAppearanceKind::Point, e2);

            builder.begin_feature(vec![0, 2]);
            let idx3 = builder.add_entity(GeometryAppearanceKind::Point, e3);

            assert_eq!(idx1, 0);
            assert_eq!(idx2, 1);
            assert_eq!(idx3, 2);
        });
        let out = app.world().resource::<BuilderTestOutput>();
        assert_eq!(out.groups.len(), 1);
        assert_eq!(out.groups[0].entities.len(), 3);
        assert_eq!(out.groups[0].global_batch_ids.len(), 3);
    }

    #[test]
    fn begin_feature_without_add_entity_does_not_store_tags() {
        let app = run_builder_test(|_, builder| {
            builder.begin_feature(vec![0, 0]);
        });
        let out = app.world().resource::<BuilderTestOutput>();
        assert!(out.groups.is_empty());
    }

    #[test]
    fn add_entity_groups_entities_by_kind() {
        let app = run_builder_test(|commands, builder| {
            let e1 = commands.spawn_empty().id();
            let e2 = commands.spawn_empty().id();
            let e3 = commands.spawn_empty().id();

            builder.begin_feature(vec![]);
            builder.add_entity(GeometryAppearanceKind::Point, e1);

            builder.begin_feature(vec![]);
            builder.add_entity(GeometryAppearanceKind::Polyline, e2);

            builder.begin_feature(vec![]);
            builder.add_entity(GeometryAppearanceKind::Point, e3);
        });
        let out = app.world().resource::<BuilderTestOutput>();
        assert_eq!(out.groups.len(), 2);
        assert_eq!(out.groups[0].kind, GeometryAppearanceKind::Point);
        assert_eq!(out.groups[0].entities.len(), 2);
        assert_eq!(out.groups[1].kind, GeometryAppearanceKind::Polyline);
        assert_eq!(out.groups[1].entities.len(), 1);
    }

    #[test]
    fn batch_ids_separate_per_kind() {
        let app = run_builder_test(|commands, builder| {
            let e1 = commands.spawn_empty().id();
            let e2 = commands.spawn_empty().id();

            builder.begin_feature(vec![0, 0]);
            builder.add_entity(GeometryAppearanceKind::Point, e1);
            builder.add_entity(GeometryAppearanceKind::Billboard, e2);
        });
        let out = app.world().resource::<BuilderTestOutput>();
        assert_eq!(out.groups.len(), 2);
        assert_ne!(out.groups[0].batch_id, out.groups[1].batch_id);
    }

    #[test]
    fn per_kind_batch_indices_skip_unmatched_features() {
        let app = run_builder_test(|commands, builder| {
            builder.begin_feature(vec![0, 0]);
            let e0a = commands.spawn_empty().id();
            let idx0a = builder.add_entity(GeometryAppearanceKind::Point, e0a);
            let e0b = commands.spawn_empty().id();
            let idx0b = builder.add_entity(GeometryAppearanceKind::Billboard, e0b);
            assert_eq!(idx0a, 0);
            assert_eq!(idx0b, 0);

            builder.begin_feature(vec![0, 1]);
            let e1 = commands.spawn_empty().id();
            let idx1 = builder.add_entity(GeometryAppearanceKind::Polyline, e1);
            assert_eq!(idx1, 0);

            builder.begin_feature(vec![0, 0]);
            let e2a = commands.spawn_empty().id();
            let idx2a = builder.add_entity(GeometryAppearanceKind::Point, e2a);
            let e2b = commands.spawn_empty().id();
            let idx2b = builder.add_entity(GeometryAppearanceKind::Billboard, e2b);
            assert_eq!(idx2a, 1);
            assert_eq!(idx2b, 1);

            builder.begin_feature(vec![0, 0]);
            // Feature 3: no matching appearance

            builder.begin_feature(vec![0, 1]);
            let e4 = commands.spawn_empty().id();
            let idx4 = builder.add_entity(GeometryAppearanceKind::Polyline, e4);
            assert_eq!(idx4, 1);
        });

        let out = app.world().resource::<BuilderTestOutput>();
        assert_eq!(out.groups.len(), 3);

        let point_group = out
            .groups
            .iter()
            .find(|g| g.kind == GeometryAppearanceKind::Point)
            .unwrap();
        assert_eq!(point_group.entities.len(), 2);

        let billboard_group = out
            .groups
            .iter()
            .find(|g| g.kind == GeometryAppearanceKind::Billboard)
            .unwrap();
        assert_eq!(billboard_group.entities.len(), 2);

        let polyline_group = out
            .groups
            .iter()
            .find(|g| g.kind == GeometryAppearanceKind::Polyline)
            .unwrap();
        assert_eq!(polyline_group.entities.len(), 2);
    }
}
