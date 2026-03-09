//! Resource types for shared MVT source caching.

use bevy_ecs::prelude::*;
use navara_layer::MvtLayer;
use navara_material::Appearance;
use rustc_hash::FxHashMap;

/// Configuration for tile traversal derived from layer properties.
///
/// This struct contains all properties that affect tile traversal behavior.
/// It is created once when a source is registered and used throughout traversal,
/// ensuring consistent behavior for all layers sharing the same source.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct TraversalConfig {
    /// Whether any appearance has `clamp_to_ground=true` (affects texturization).
    pub has_clamp_to_ground: bool,
    /// Maximum zoom level for tile fetching.
    pub max_zoom: usize,
    /// Maximum SSE threshold for tile subdivision (stored as f32 bits for Hash/Eq).
    pub max_sse_bits: u32,
    /// Maximum zoom level for overscaling (reusing parent tile textures).
    pub overscaled_max_zoom: usize,
}

impl Default for TraversalConfig {
    fn default() -> Self {
        Self {
            has_clamp_to_ground: false,
            max_zoom: 20,
            max_sse_bits: 2.0_f32.to_bits(),
            overscaled_max_zoom: 24,
        }
    }
}

impl TraversalConfig {
    /// Creates a `TraversalConfig` from an `MvtLayer`.
    pub fn from_layer(layer: &MvtLayer) -> Self {
        let has_clamp_to_ground = layer.appearances.iter().any(|a| {
            matches!(a, Appearance::Polygon(p) if p.clamp_to_ground)
                || matches!(a, Appearance::Polyline(p) if p.clamp_to_ground)
        });

        let vt = layer.vector_tile_appearance();
        let max_zoom = vt.map(|v| v.max_zoom).unwrap_or(20);
        let max_sse = vt.map(|v| v.max_sse).unwrap_or(2.0);
        let overscaled_max_zoom = vt.map(|v| v.overscaled_max_zoom).unwrap_or(24);

        Self {
            has_clamp_to_ground,
            max_zoom,
            max_sse_bits: max_sse.to_bits(),
            overscaled_max_zoom,
        }
    }

    /// Returns the max SSE as f32.
    pub fn max_sse(&self) -> f32 {
        f32::from_bits(self.max_sse_bits)
    }
}

/// Unique identifier for a source that accounts for traversal-affecting properties.
///
/// Two layers with the same URL but different traversal properties will have
/// different SourceIds, ensuring correct cache behavior.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct SourceId {
    /// The URL template for the MVT source.
    pub url: String,
    /// Traversal configuration that affects tile fetching behavior.
    pub traversal_config: TraversalConfig,
}

impl SourceId {
    /// Creates a new `SourceId` from an `MvtLayer`.
    pub fn from_layer(layer: &MvtLayer) -> Option<Self> {
        let data = layer.data.as_ref()?;
        Some(Self {
            url: data.url.clone(),
            traversal_config: TraversalConfig::from_layer(layer),
        })
    }
}

/// Shared resources for a single MVT source.
///
/// When multiple `MvtLayer`s share the same source (URL + traversal config),
/// they reference the same `MvtSourceResources` entity instead of each having
/// their own quadtree and cache.
#[derive(Component)]
pub struct MvtSourceResources {
    /// Unique identifier for this source (URL + traversal config).
    pub source_id: SourceId,

    /// Entity containing the shared `VectorTileQuadtree`.
    pub quadtree: Entity,

    /// Entity containing the shared `TileCacheManager`.
    pub tile_cache_manager: Entity,

    /// Layer entities that reference this source.
    /// Used for reference counting to determine when to clean up.
    pub layer_refs: Vec<Entity>,
}

impl MvtSourceResources {
    /// Creates a new `MvtSourceResources` with the given parameters.
    pub fn new(
        source_id: SourceId,
        quadtree: Entity,
        tile_cache_manager: Entity,
        layer_refs: Vec<Entity>,
    ) -> Self {
        Self {
            source_id,
            quadtree,
            tile_cache_manager,
            layer_refs,
        }
    }

    /// Returns the URL for this source.
    pub fn url(&self) -> &str {
        &self.source_id.url
    }

    /// Returns the traversal configuration for this source.
    pub fn traversal_config(&self) -> &TraversalConfig {
        &self.source_id.traversal_config
    }

    /// Adds a layer reference to this source.
    pub fn add_layer_ref(&mut self, layer: Entity) {
        if !self.layer_refs.contains(&layer) {
            self.layer_refs.push(layer);
        }
    }

    /// Removes a layer reference from this source.
    /// Returns `true` if this was the last reference (source can be cleaned up).
    pub fn remove_layer_ref(&mut self, layer: Entity) -> bool {
        self.layer_refs.retain(|&e| e != layer);
        self.layer_refs.is_empty()
    }

    /// Returns `true` if no layers reference this source.
    pub fn has_no_refs(&self) -> bool {
        self.layer_refs.is_empty()
    }

    /// Returns the number of layers referencing this source.
    pub fn ref_count(&self) -> usize {
        self.layer_refs.len()
    }
}

/// Global registry mapping source identifiers to their shared resources.
///
/// This resource provides O(1) lookup to find existing shared resources
/// when a new layer is created with a source that's already in use.
/// Sources are keyed by both URL and traversal configuration.
#[derive(Resource, Default)]
pub struct MvtSourceCache {
    /// Map from SourceId to source resource entity.
    sources: FxHashMap<SourceId, Entity>,
}

impl MvtSourceCache {
    /// Creates a new empty source cache.
    pub fn new() -> Self {
        Self::default()
    }

    /// Looks up the entity for a source by SourceId.
    /// Returns `None` if no source exists for this SourceId.
    pub fn get_source(&self, source_id: &SourceId) -> Option<Entity> {
        self.sources.get(source_id).copied()
    }

    /// Registers a new source entity for the given SourceId.
    pub fn register_source(&mut self, source_id: SourceId, entity: Entity) {
        // Avoid accidental overwrite which would orphan the previously-registered entity
        debug_assert!(
            !self.sources.contains_key(&source_id),
            "MvtSourceCache: register_source called for an existing SourceId; this would overwrite the mapping and leak the old source entity"
        );
        self.sources.entry(source_id).or_insert(entity);
    }

    /// Returns `true` if a source exists for this SourceId.
    pub fn has_source(&self, source_id: &SourceId) -> bool {
        self.sources.contains_key(source_id)
    }

    /// Removes a source from the cache by SourceId.
    /// Called when the last layer referencing a source is deleted.
    pub fn remove_source(&mut self, source_id: &SourceId) {
        self.sources.remove(source_id);
    }

    /// Returns the number of registered sources.
    pub fn len(&self) -> usize {
        self.sources.len()
    }

    /// Returns `true` if no sources are registered.
    pub fn is_empty(&self) -> bool {
        self.sources.is_empty()
    }

    /// Iterates over all registered source entities.
    pub fn iter(&self) -> impl Iterator<Item = (&SourceId, &Entity)> {
        self.sources.iter()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_source_id(url: &str) -> SourceId {
        SourceId {
            url: url.to_string(),
            traversal_config: TraversalConfig::default(),
        }
    }

    fn make_source_id_with_config(url: &str, config: TraversalConfig) -> SourceId {
        SourceId {
            url: url.to_string(),
            traversal_config: config,
        }
    }

    #[test]
    fn test_source_id_equality_same_url_same_config() {
        let id1 = make_source_id("https://example.com/tiles");
        let id2 = make_source_id("https://example.com/tiles");

        assert_eq!(id1, id2);
    }

    #[test]
    fn test_source_id_inequality_different_url() {
        let id1 = make_source_id("https://example.com/tiles");
        let id2 = make_source_id("https://other.com/tiles");

        assert_ne!(id1, id2);
    }

    #[test]
    fn test_source_id_inequality_same_url_different_max_zoom() {
        let config1 = TraversalConfig {
            max_zoom: 18,
            ..Default::default()
        };
        let config2 = TraversalConfig {
            max_zoom: 20,
            ..Default::default()
        };

        let id1 = make_source_id_with_config("https://example.com/tiles", config1);
        let id2 = make_source_id_with_config("https://example.com/tiles", config2);

        assert_ne!(id1, id2);
    }

    #[test]
    fn test_source_id_inequality_same_url_different_clamp_to_ground() {
        let config1 = TraversalConfig {
            has_clamp_to_ground: false,
            ..Default::default()
        };
        let config2 = TraversalConfig {
            has_clamp_to_ground: true,
            ..Default::default()
        };

        let id1 = make_source_id_with_config("https://example.com/tiles", config1);
        let id2 = make_source_id_with_config("https://example.com/tiles", config2);

        assert_ne!(id1, id2);
    }

    #[test]
    fn test_source_id_inequality_same_url_different_max_sse() {
        let config1 = TraversalConfig {
            max_sse_bits: 2.0_f32.to_bits(),
            ..Default::default()
        };
        let config2 = TraversalConfig {
            max_sse_bits: 4.0_f32.to_bits(),
            ..Default::default()
        };

        let id1 = make_source_id_with_config("https://example.com/tiles", config1);
        let id2 = make_source_id_with_config("https://example.com/tiles", config2);

        assert_ne!(id1, id2);
    }

    #[test]
    fn test_traversal_config_max_sse() {
        let config = TraversalConfig {
            max_sse_bits: 3.5_f32.to_bits(),
            ..Default::default()
        };

        assert_eq!(config.max_sse(), 3.5);
    }

    #[test]
    fn test_source_cache_operations() {
        let mut cache = MvtSourceCache::new();
        let source_id = make_source_id("https://example.com/{z}/{x}/{y}.pbf");
        let entity = Entity::from_raw_u32(42).unwrap();

        assert!(!cache.has_source(&source_id));
        assert!(cache.get_source(&source_id).is_none());

        cache.register_source(source_id.clone(), entity);

        assert!(cache.has_source(&source_id));
        assert_eq!(cache.get_source(&source_id), Some(entity));
        assert_eq!(cache.len(), 1);

        cache.remove_source(&source_id);

        assert!(!cache.has_source(&source_id));
        assert!(cache.is_empty());
    }

    #[test]
    fn test_source_cache_different_configs_same_url() {
        let mut cache = MvtSourceCache::new();

        let config1 = TraversalConfig::default();
        let config2 = TraversalConfig {
            has_clamp_to_ground: true,
            ..Default::default()
        };

        let source_id1 = make_source_id_with_config("https://example.com/tiles", config1);
        let source_id2 = make_source_id_with_config("https://example.com/tiles", config2);

        let entity1 = Entity::from_raw_u32(1).unwrap();
        let entity2 = Entity::from_raw_u32(2).unwrap();

        cache.register_source(source_id1.clone(), entity1);
        cache.register_source(source_id2.clone(), entity2);

        // Both should exist as separate entries
        assert_eq!(cache.len(), 2);
        assert_eq!(cache.get_source(&source_id1), Some(entity1));
        assert_eq!(cache.get_source(&source_id2), Some(entity2));
    }
}
