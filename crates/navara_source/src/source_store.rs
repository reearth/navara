use crate::{GeoJsonData, Source};
use bevy_ecs::prelude::Resource;
use std::collections::HashMap;

/// A registry mapping a source id to its [`Source`] definition, the spawned
/// source entity, and the number of layers currently referencing it.
///
/// This mirrors `LayerDescStore` on the layer side, and additionally tracks a
/// reference count so a source can be kept alive while any layer references it
/// and cleaned up once the last reference is gone.
#[derive(Resource, Debug, Default)]
pub struct SourceStore {
    map: HashMap<String, SourceEntry>,
    /// Maps a layer id to the source id it references, for reference counting.
    layer_sources: HashMap<String, String>,
}

#[derive(Debug)]
pub struct SourceEntry {
    pub source: Source,
    /// Number of layers currently referencing this source.
    pub ref_count: usize,
    // TODO: Remove with the legacy layer API.
    /// Whether this source was created implicitly for a legacy layer (1:1 with
    /// that layer). Implicit sources are reclaimed automatically once their last
    /// reference is dropped; explicit user sources are only removed via `delete`.
    pub implicit: bool,
}

impl SourceStore {
    pub fn new() -> Self {
        Default::default()
    }

    /// Insert an explicit (user-defined) source, or override an existing one
    /// with the same id. On override the later definition wins, while the
    /// existing reference count and `implicit` flag are preserved.
    pub fn add(&mut self, source_id: String, source: Source) {
        self.insert(source_id, source, false);
    }

    // TODO: Remove with the legacy layer API.
    /// Insert an implicit source created for a legacy layer. Implicit sources
    /// are reclaimed automatically when their last reference is unlinked.
    pub fn add_implicit(&mut self, source_id: String, source: Source) {
        self.insert(source_id, source, true);
    }

    fn insert(&mut self, source_id: String, source: Source, implicit: bool) {
        match self.map.get_mut(&source_id) {
            Some(entry) => entry.source = source,
            None => {
                self.map.insert(
                    source_id,
                    SourceEntry {
                        source,
                        ref_count: 0,
                        implicit,
                    },
                );
            }
        }
    }

    pub fn update(&mut self, source_id: String, source: Source) {
        if let Some(entry) = self.map.get_mut(&source_id) {
            entry.source = source;
        }
    }

    /// Replace a GeoJSON source's data with the parsed document (after a URL
    /// fetch), so layers read the inline GeoJSON live. No-op for non-geojson
    /// sources or unknown ids.
    pub fn set_geojson_data(&mut self, source_id: &str, geojson: navara_parser::geojson::GeoJson) {
        if let Some(entry) = self.map.get_mut(source_id)
            && let Source::GeoJson(s) = &mut entry.source
        {
            s.data = Some(GeoJsonData::GeoJson(geojson));
        }
    }

    /// Remove a source from the store and return its entry (for entity cleanup).
    pub fn delete(&mut self, source_id: &str) -> Option<SourceEntry> {
        self.map.remove(source_id)
    }

    pub fn get(&self, source_id: &str) -> Option<&Source> {
        self.map.get(source_id).map(|entry| &entry.source)
    }

    pub fn contains(&self, source_id: &str) -> bool {
        self.map.contains_key(source_id)
    }

    /// Increment the reference count when a layer starts referencing the source.
    /// Returns the new reference count.
    pub fn increment_ref(&mut self, source_id: &str) -> usize {
        match self.map.get_mut(source_id) {
            Some(entry) => {
                entry.ref_count += 1;
                entry.ref_count
            }
            None => 0,
        }
    }

    /// Decrement the reference count when a referencing layer is deleted.
    /// Returns the new reference count.
    pub fn decrement_ref(&mut self, source_id: &str) -> usize {
        match self.map.get_mut(source_id) {
            Some(entry) => {
                entry.ref_count = entry.ref_count.saturating_sub(1);
                entry.ref_count
            }
            None => 0,
        }
    }

    pub fn ref_count(&self, source_id: &str) -> usize {
        self.map.get(source_id).map_or(0, |entry| entry.ref_count)
    }

    /// Record that a layer references a source and increment its reference count.
    pub fn link_layer(&mut self, layer_id: String, source_id: &str) {
        self.increment_ref(source_id);
        self.layer_sources.insert(layer_id, source_id.to_owned());
    }

    /// Drop a layer's reference to its source (if any) and decrement the count.
    /// An implicit source is reclaimed once its last reference is gone (it is
    /// 1:1 with the legacy layer that created it); explicit sources are left for
    /// the user to remove via [`delete`](Self::delete).
    pub fn unlink_layer(&mut self, layer_id: &str) {
        if let Some(source_id) = self.layer_sources.remove(layer_id) {
            let ref_count = self.decrement_ref(&source_id);
            if ref_count == 0 && self.map.get(&source_id).is_some_and(|entry| entry.implicit) {
                self.map.remove(&source_id);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Tiles3dSource;

    fn source(id: &str) -> Source {
        Source::Tiles3d(Tiles3dSource {
            source_id: id.to_owned(),
            url: String::new(),
            crs: None,
        })
    }

    #[test]
    fn implicit_source_is_reclaimed_when_last_reference_is_unlinked() {
        let mut store = SourceStore::new();
        store.add_implicit("s".to_owned(), source("s"));
        store.link_layer("layer".to_owned(), "s");
        assert!(store.contains("s"));

        store.unlink_layer("layer");
        assert!(
            !store.contains("s"),
            "implicit source should be removed once unreferenced"
        );
    }

    #[test]
    fn explicit_source_is_kept_after_its_last_reference_is_unlinked() {
        let mut store = SourceStore::new();
        store.add("s".to_owned(), source("s"));
        store.link_layer("layer".to_owned(), "s");

        store.unlink_layer("layer");
        assert!(
            store.contains("s"),
            "explicit user source must survive at ref_count 0 (removed only via delete)"
        );
        assert_eq!(store.ref_count("s"), 0);
    }

    #[test]
    fn set_geojson_data_replaces_url_with_parsed_document() {
        use crate::GeoJsonSource;
        use navara_parser::geojson::GeoJson;

        let mut store = SourceStore::new();
        store.add(
            "g".to_owned(),
            Source::GeoJson(GeoJsonSource {
                source_id: "g".to_owned(),
                data: Some(GeoJsonData::Url("https://example.com/x.geojson".to_owned())),
                crs: None,
                tiled: false,
            }),
        );

        let parsed =
            GeoJson::from_reader(br#"{"type":"FeatureCollection","features":[]}"#.as_slice())
                .unwrap();
        store.set_geojson_data("g", parsed);

        match store.get("g") {
            Some(Source::GeoJson(s)) => assert!(
                matches!(s.data, Some(GeoJsonData::GeoJson(_))),
                "URL data should be replaced by the parsed GeoJSON document"
            ),
            _ => panic!("expected a geojson source"),
        }
    }
}
