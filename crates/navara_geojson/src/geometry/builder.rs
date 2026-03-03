use bevy_ecs::entity::Entity;

use navara_feature_component::batch::BatchTable;
pub(crate) use navara_feature_component::geometry_builder::GeometryAppearanceKind;
use navara_feature_component::geometry_builder::GeometryGroups;

/// Accumulates feature entities and batch IDs during geometry construction.
///
/// Each appearance kind gets its own batch with its own feature count and
/// batch indices. Properties are stored per-kind: when a feature produces
/// entities for multiple kinds, its properties are duplicated into each
/// kind's batch.
///
/// Properties are stored lazily: `begin_feature` prepares the data, but it is
/// only committed to the batch table when `add_entity` is first called for that
/// kind. This avoids phantom batch entries for features whose geometry does
/// not match any appearance.
pub(crate) struct GeometryBuilder<'a> {
    pub(crate) groups: GeometryGroups,
    batch_table: &'a mut BatchTable,
    layer_id: &'a str,
    pending_properties: Option<serde_json::Value>,
}

impl<'a> GeometryBuilder<'a> {
    pub(crate) fn new(batch_table: &'a mut BatchTable, layer_id: &'a str) -> Self {
        Self {
            groups: GeometryGroups::new(),
            batch_table,
            layer_id,
            pending_properties: None,
        }
    }

    /// Begin processing a new feature. Stores properties lazily.
    pub(crate) fn begin_feature(
        &mut self,
        properties: &Option<serde_json::Map<String, serde_json::Value>>,
    ) {
        let props = properties
            .as_ref()
            .and_then(|prop| serde_json::to_value(prop).ok())
            .unwrap_or(serde_json::Value::Null);
        self.pending_properties = Some(props);
        self.groups.begin_feature();
    }

    /// Add an entity to the group for the given appearance kind.
    ///
    /// Lazily commits the pending feature properties to this kind's batch on
    /// first call per kind per feature. Returns the per-kind batch index for
    /// this feature (to be used as `BatchIndex` on the child entity).
    pub(crate) fn add_entity(&mut self, kind: GeometryAppearanceKind, entity: Entity) -> u32 {
        if !self.groups.has_kind(kind) {
            let batch_id = self
                .batch_table
                .init_values(Some(self.layer_id.to_owned()))
                .unwrap_or(0);
            self.groups.register_kind(kind, batch_id);
        }

        let global_batch_id = self
            .batch_table
            .init_values(Some(self.layer_id.to_owned()))
            .unwrap_or(0);

        let (batch_index, commit_batch_id) =
            self.groups.track_entity(kind, entity, global_batch_id);

        if let Some(batch_id) = commit_batch_id {
            let props = self.pending_properties.clone().unwrap();
            self.batch_table.add_values(batch_id, props);
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
        setup: impl FnOnce(&mut Commands, &mut GeometryBuilder) + Send + Sync + 'static,
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
                let mut builder = GeometryBuilder::new(&mut batch_table, "test_layer");
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

            builder.begin_feature(&None);
            let idx1 = builder.add_entity(GeometryAppearanceKind::Point, e1);

            builder.begin_feature(&None);
            let idx2 = builder.add_entity(GeometryAppearanceKind::Point, e2);

            builder.begin_feature(&None);
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
    fn add_entity_groups_entities_by_kind() {
        let app = run_builder_test(|commands, builder| {
            let e1 = commands.spawn_empty().id();
            let e2 = commands.spawn_empty().id();
            let e3 = commands.spawn_empty().id();

            builder.begin_feature(&None);
            builder.add_entity(GeometryAppearanceKind::Point, e1);

            builder.begin_feature(&None);
            builder.add_entity(GeometryAppearanceKind::Polyline, e2);

            builder.begin_feature(&None);
            builder.add_entity(GeometryAppearanceKind::Point, e3);
        });
        let out = app.world().resource::<BuilderTestOutput>();
        assert_eq!(out.groups.len(), 2);
        assert_eq!(out.groups[0].kind, GeometryAppearanceKind::Point);
        assert_eq!(out.groups[0].entities.len(), 2);
        assert_eq!(out.groups[0].global_batch_ids.len(), 2);
        assert_eq!(out.groups[1].kind, GeometryAppearanceKind::Polyline);
        assert_eq!(out.groups[1].entities.len(), 1);
        assert_eq!(out.groups[1].global_batch_ids.len(), 1);
    }

    #[test]
    fn begin_feature_without_add_entity_does_not_store_properties() {
        let app = run_builder_test(|_, builder| {
            builder.begin_feature(&None);
        });
        let out = app.world().resource::<BuilderTestOutput>();
        assert!(out.groups.is_empty());
    }

    #[test]
    fn begin_feature_stores_properties_in_batch_table() {
        let props = Some(serde_json::Map::from_iter([(
            "name".to_string(),
            serde_json::Value::String("test".to_string()),
        )]));

        let app = run_builder_test(move |commands, builder| {
            let entity = commands.spawn_empty().id();
            builder.begin_feature(&props);
            builder.add_entity(GeometryAppearanceKind::Point, entity);
        });

        let out = app.world().resource::<BuilderTestOutput>();
        let feature_batch_id = out.groups[0].batch_id;

        let batch_table = app.world().resource::<BatchTable>();
        let batch_value = batch_table.get(&feature_batch_id).unwrap();
        let properties = batch_value.properties.as_ref().unwrap();
        match properties {
            navara_feature_component::batch::BatchProperty::Values(values) => {
                assert_eq!(values.len(), 1);
                assert_eq!(values[0], serde_json::json!({"name": "test"}));
            }
            _ => panic!("Expected BatchProperty::Values"),
        }
    }

    #[test]
    fn batch_ids_separate_per_kind() {
        let app = run_builder_test(|commands, builder| {
            let e1 = commands.spawn_empty().id();
            let e2 = commands.spawn_empty().id();

            builder.begin_feature(&None);
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
            // Feature 0: Point → Point + Billboard appearances
            builder.begin_feature(&None);
            let e0a = commands.spawn_empty().id();
            let idx0a = builder.add_entity(GeometryAppearanceKind::Point, e0a);
            let e0b = commands.spawn_empty().id();
            let idx0b = builder.add_entity(GeometryAppearanceKind::Billboard, e0b);
            assert_eq!(idx0a, 0);
            assert_eq!(idx0b, 0);

            // Feature 1: LineString → Polyline appearance
            builder.begin_feature(&None);
            let e1 = commands.spawn_empty().id();
            let idx1 = builder.add_entity(GeometryAppearanceKind::Polyline, e1);
            assert_eq!(idx1, 0);

            // Feature 2: Point → Point + Billboard appearances
            builder.begin_feature(&None);
            let e2a = commands.spawn_empty().id();
            let idx2a = builder.add_entity(GeometryAppearanceKind::Point, e2a);
            let e2b = commands.spawn_empty().id();
            let idx2b = builder.add_entity(GeometryAppearanceKind::Billboard, e2b);
            assert_eq!(idx2a, 1);
            assert_eq!(idx2b, 1);

            // Feature 3: Polygon → no matching appearance
            builder.begin_feature(&None);

            // Feature 4: LineString → Polyline appearance
            builder.begin_feature(&None);
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
