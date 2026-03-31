use std::sync::Arc;

use geozero::mvt::tile;
use navara_core::CRS;
use navara_geometry::{Hierarchy, WindingOrder};
use navara_math::Vec3;

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
/// committed to the batch table when geometry is first added for that
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

    /// Ensure a kind is registered, lazily initializing its batch in the table.
    fn ensure_kind(&mut self, kind: GeometryAppearanceKind) {
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
    }

    /// Commit pending tags if this is the first geometry for this kind in the current feature.
    fn maybe_commit_tags(&mut self, commit_batch_id: Option<u32>) {
        if let Some(batch_id) = commit_batch_id {
            let tags = self.pending_tags.clone().unwrap();
            self.batch_table.add_mvt_feature_tags(batch_id, tags);
        }
    }

    /// Accumulate point geometry with pre-computed RTC-encoded position.
    pub(crate) fn add_point(
        &mut self,
        kind: GeometryAppearanceKind,
        coords: Vec3,
        crs: CRS,
        rtc_pos: [f32; 3],
        rtc_center: Vec3,
    ) -> u32 {
        self.ensure_kind(kind);
        let global_batch_id = self.batch_table.gen_global_batch_id().unwrap_or(0);
        let (batch_index, commit_batch_id) =
            self.groups
                .track_point_rtc(kind, coords, crs, rtc_pos, rtc_center, global_batch_id);
        self.maybe_commit_tags(commit_batch_id);
        batch_index
    }

    /// Accumulate polyline geometry without spawning a child entity.
    pub(crate) fn add_polyline(&mut self, points: Vec<f64>, crs: CRS) -> u32 {
        let kind = GeometryAppearanceKind::Polyline;
        self.ensure_kind(kind);
        let global_batch_id = self.batch_table.gen_global_batch_id().unwrap_or(0);
        let (batch_index, commit_batch_id) =
            self.groups
                .track_polyline(kind, points, crs, global_batch_id);
        self.maybe_commit_tags(commit_batch_id);
        batch_index
    }

    /// Accumulate polygon geometry without spawning a child entity.
    pub(crate) fn add_polygon(
        &mut self,
        outer_ring: Vec<f64>,
        holes: &[Hierarchy],
        winding_order: WindingOrder,
        crs: CRS,
    ) -> u32 {
        let kind = GeometryAppearanceKind::Polygon;
        self.ensure_kind(kind);
        let global_batch_id = self.batch_table.gen_global_batch_id().unwrap_or(0);
        let (batch_index, commit_batch_id) =
            self.groups
                .track_polygon(kind, outer_ring, holes, winding_order, crs, global_batch_id);
        self.maybe_commit_tags(commit_batch_id);
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
    fn begin_feature_without_add_does_not_store_tags() {
        let app = run_builder_test(|_, builder| {
            builder.begin_feature(vec![0, 0]);
        });
        let out = app.world().resource::<BuilderTestOutput>();
        assert!(out.groups.is_empty());
    }
}
