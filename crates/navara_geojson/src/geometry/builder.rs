use bevy_ecs::entity::Entity;

use navara_feature_component::batch::BatchTable;

/// Identifies which geometry-appearance combination a group belongs to.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub(crate) enum GeometryAppearanceKind {
    Point,
    Billboard,
    Text,
    Polyline,
    Polygon,
}

/// Accumulates feature entities and batch IDs during geometry construction.
pub(crate) struct GeometryBuilder<'a> {
    pub(crate) groups: Vec<(GeometryAppearanceKind, Vec<Entity>, Vec<u32>)>,
    pub(crate) batch_ids_by_kind: Vec<(GeometryAppearanceKind, u32)>,
    batch_table: &'a mut BatchTable,
    layer_id: &'a str,
}

impl<'a> GeometryBuilder<'a> {
    pub(crate) fn new(batch_table: &'a mut BatchTable, layer_id: &'a str) -> Self {
        Self {
            groups: Vec::new(),
            batch_ids_by_kind: Vec::new(),
            batch_table,
            layer_id,
        }
    }

    pub(crate) fn get_or_init_batch_id(&mut self, kind: GeometryAppearanceKind) -> u32 {
        if let Some(entry) = self.batch_ids_by_kind.iter().find(|(k, _)| *k == kind) {
            entry.1
        } else {
            let id = self
                .batch_table
                .init_values(Some(self.layer_id.to_owned()))
                .unwrap_or(0);
            self.batch_ids_by_kind.push((kind, id));
            id
        }
    }

    pub(crate) fn get_or_create_group(&mut self, kind: GeometryAppearanceKind) -> usize {
        if let Some(pos) = self.groups.iter().position(|(k, _, _)| *k == kind) {
            pos
        } else {
            self.groups.push((kind, Vec::new(), Vec::new()));
            self.groups.len() - 1
        }
    }

    pub(crate) fn add_feature(
        &mut self,
        kind: GeometryAppearanceKind,
        properties: &Option<serde_json::Map<String, serde_json::Value>>,
        entity: Entity,
    ) -> u32 {
        let feature_batch_id = self.get_or_init_batch_id(kind);
        let group_idx = self.get_or_create_group(kind);

        let props = properties
            .as_ref()
            .and_then(|prop| serde_json::to_value(prop).ok())
            .unwrap_or(serde_json::Value::Null);
        self.batch_table.add_values(feature_batch_id, props);

        let batch_id = self
            .batch_table
            .init_values(Some(self.layer_id.to_owned()))
            .unwrap_or(0);
        self.groups[group_idx].2.push(batch_id);

        let batch_index = self.groups[group_idx].2.len() as u32 - 1;
        self.groups[group_idx].1.push(entity);
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

    #[derive(Resource)]
    struct BuilderTestOutput {
        groups: Vec<(GeometryAppearanceKind, Vec<Entity>, Vec<u32>)>,
        batch_ids_by_kind: Vec<(GeometryAppearanceKind, u32)>,
    }

    fn run_builder_test(
        setup: impl FnOnce(&mut Commands, &mut GeometryBuilder) + Send + Sync + 'static,
    ) -> App {
        let mut app = App::new();
        app.init_resource::<BatchTable>();
        app.insert_resource(BuilderTestOutput {
            groups: Vec::new(),
            batch_ids_by_kind: Vec::new(),
        });

        let setup = std::sync::Mutex::new(Some(setup));
        app.add_systems(
            Update,
            move |mut commands: Commands,
                  mut batch_table: ResMut<BatchTable>,
                  mut out: ResMut<BuilderTestOutput>| {
                let setup_fn = setup.lock().unwrap().take().unwrap();
                let mut builder = GeometryBuilder::new(&mut batch_table, "test_layer");
                setup_fn(&mut commands, &mut builder);
                out.groups = builder.groups;
                out.batch_ids_by_kind = builder.batch_ids_by_kind;
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
        assert!(out.batch_ids_by_kind.is_empty());
    }

    #[test]
    fn get_or_init_batch_id_returns_same_id_for_same_kind() {
        let app = run_builder_test(|_, builder| {
            let id1 = builder.get_or_init_batch_id(GeometryAppearanceKind::Point);
            let id2 = builder.get_or_init_batch_id(GeometryAppearanceKind::Point);
            assert_eq!(id1, id2);
        });
        let out = app.world().resource::<BuilderTestOutput>();
        assert_eq!(out.batch_ids_by_kind.len(), 1);
    }

    #[test]
    fn get_or_init_batch_id_returns_different_ids_for_different_kinds() {
        let app = run_builder_test(|_, builder| {
            let id1 = builder.get_or_init_batch_id(GeometryAppearanceKind::Point);
            let id2 = builder.get_or_init_batch_id(GeometryAppearanceKind::Polyline);
            assert_ne!(id1, id2);
        });
        let out = app.world().resource::<BuilderTestOutput>();
        assert_eq!(out.batch_ids_by_kind.len(), 2);
    }

    #[test]
    fn get_or_create_group_returns_same_index_for_same_kind() {
        let app = run_builder_test(|_, builder| {
            let idx1 = builder.get_or_create_group(GeometryAppearanceKind::Polygon);
            let idx2 = builder.get_or_create_group(GeometryAppearanceKind::Polygon);
            assert_eq!(idx1, idx2);
        });
        let out = app.world().resource::<BuilderTestOutput>();
        assert_eq!(out.groups.len(), 1);
    }

    #[test]
    fn get_or_create_group_returns_different_indices_for_different_kinds() {
        let app = run_builder_test(|_, builder| {
            let idx1 = builder.get_or_create_group(GeometryAppearanceKind::Point);
            let idx2 = builder.get_or_create_group(GeometryAppearanceKind::Polyline);
            assert_ne!(idx1, idx2);
        });
        let out = app.world().resource::<BuilderTestOutput>();
        assert_eq!(out.groups.len(), 2);
    }

    #[test]
    fn add_feature_assigns_sequential_batch_indices() {
        let app = run_builder_test(|commands, builder| {
            let e1 = commands.spawn_empty().id();
            let e2 = commands.spawn_empty().id();
            let e3 = commands.spawn_empty().id();

            let idx1 = builder.add_feature(GeometryAppearanceKind::Point, &None, e1);
            let idx2 = builder.add_feature(GeometryAppearanceKind::Point, &None, e2);
            let idx3 = builder.add_feature(GeometryAppearanceKind::Point, &None, e3);

            assert_eq!(idx1, 0);
            assert_eq!(idx2, 1);
            assert_eq!(idx3, 2);
        });
        let out = app.world().resource::<BuilderTestOutput>();
        assert_eq!(out.groups.len(), 1);
        assert_eq!(out.groups[0].1.len(), 3);
        assert_eq!(out.groups[0].2.len(), 3);
    }

    #[test]
    fn add_feature_groups_entities_by_kind() {
        let app = run_builder_test(|commands, builder| {
            let e1 = commands.spawn_empty().id();
            let e2 = commands.spawn_empty().id();
            let e3 = commands.spawn_empty().id();

            builder.add_feature(GeometryAppearanceKind::Point, &None, e1);
            builder.add_feature(GeometryAppearanceKind::Polyline, &None, e2);
            builder.add_feature(GeometryAppearanceKind::Point, &None, e3);
        });
        let out = app.world().resource::<BuilderTestOutput>();
        assert_eq!(out.groups.len(), 2);
        // Point group has 2 entities
        assert_eq!(out.groups[0].0, GeometryAppearanceKind::Point);
        assert_eq!(out.groups[0].1.len(), 2);
        assert_eq!(out.groups[0].2.len(), 2);
        // Polyline group has 1 entity
        assert_eq!(out.groups[1].0, GeometryAppearanceKind::Polyline);
        assert_eq!(out.groups[1].1.len(), 1);
        assert_eq!(out.groups[1].2.len(), 1);
    }

    #[test]
    fn add_feature_stores_properties_in_batch_table() {
        let props = Some(serde_json::Map::from_iter([(
            "name".to_string(),
            serde_json::Value::String("test".to_string()),
        )]));

        let app = run_builder_test(move |commands, builder| {
            let entity = commands.spawn_empty().id();
            builder.add_feature(GeometryAppearanceKind::Point, &props, entity);
        });

        let out = app.world().resource::<BuilderTestOutput>();
        let feature_batch_id = out.batch_ids_by_kind[0].1;

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
}
