pub use navara_vector_tile::{
    SourceId, TraversalConfig, VectorTileSourceCache, VectorTileSourceResources,
};

use navara_layer::MvtLayer;

/// Backward compatibility aliases.
pub type MvtSourceResources = VectorTileSourceResources;
pub type MvtSourceCache = VectorTileSourceCache;

/// Extension trait for creating SourceId from MvtLayer.
pub trait MvtSourceId {
    /// Build a [`SourceId`] from the resolved tile URL template and the
    /// traversal config, which is taken from the referenced [`Source`]
    /// (zoom/sse) and the layer's appearances (clamp-to-ground).
    fn from_mvt_layer(
        layer: &MvtLayer,
        url: String,
        source: &navara_source::Source,
    ) -> Option<SourceId>;
}

impl MvtSourceId for SourceId {
    fn from_mvt_layer(
        layer: &MvtLayer,
        url: String,
        source: &navara_source::Source,
    ) -> Option<SourceId> {
        // Per-layer horizon-relaxation override lives on the vector source; a
        // non-vector source (shouldn't happen for an MVT layer) falls back to
        // the content-based default.
        let dynamic_sse_scale = match source {
            navara_source::Source::VectorTile(s) => s.dynamic_sse_scale,
            _ => None,
        };

        let traversal_config = TraversalConfig::from_appearances(
            &layer.appearances,
            source.min_zoom(),
            source.max_zoom(),
            source.max_sse(),
            source.overscaled_max_zoom(),
            dynamic_sse_scale,
        );

        Some(SourceId::new(url, traversal_config))
    }
}

#[cfg(test)]
mod tests {
    use bevy_ecs::entity::Entity;

    use super::*;

    fn make_source_id(url: &str) -> SourceId {
        SourceId::new(url.to_string(), TraversalConfig::default())
    }

    fn make_source_id_with_config(url: &str, config: TraversalConfig) -> SourceId {
        SourceId::new(url.to_string(), config)
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
    fn test_source_id_inequality_same_url_different_min_zoom() {
        let config1 = TraversalConfig {
            min_zoom: 0,
            ..Default::default()
        };
        let config2 = TraversalConfig {
            min_zoom: 5,
            ..Default::default()
        };

        let id1 = make_source_id_with_config("https://example.com/tiles", config1);
        let id2 = make_source_id_with_config("https://example.com/tiles", config2);

        assert_ne!(id1, id2);
    }

    #[test]
    fn test_from_appearances_threads_min_zoom() {
        // The data-available floor must survive the source → config plumbing;
        // if it drops back to 0, the traversal's min-zoom clamp is a no-op and
        // dynamic-SSE relaxation coarsens features away again (#697).
        let config = TraversalConfig::from_appearances(&[], 7, 16, 2.0, 24, None);
        assert_eq!(config.min_zoom, 7);
        assert_eq!(config.max_zoom, 16);
    }

    #[test]
    fn test_from_appearances_dynamic_sse_scale_defaults_and_override() {
        use navara_vector_tile::{CLAMP_TO_GROUND_DYNAMIC_SSE_SCALE, GEOMETRY_DYNAMIC_SSE_SCALE};

        // No clamp-to-ground appearances → geometry default (slight relaxation).
        let geometry = TraversalConfig::from_appearances(&[], 0, 16, 2.0, 24, None);
        assert_eq!(geometry.dynamic_sse_scale(), GEOMETRY_DYNAMIC_SSE_SCALE);
        assert!(geometry.dynamic_sse_scale() < CLAMP_TO_GROUND_DYNAMIC_SSE_SCALE);

        // An explicit override wins over the content-based default.
        let overridden = TraversalConfig::from_appearances(&[], 0, 16, 2.0, 24, Some(1.0));
        assert_eq!(overridden.dynamic_sse_scale(), 1.0);
    }

    #[test]
    fn test_source_cache_operations() {
        let mut cache = VectorTileSourceCache::new();
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
        let mut cache = VectorTileSourceCache::new();

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

        assert_eq!(cache.len(), 2);
        assert_eq!(cache.get_source(&source_id1), Some(entity1));
        assert_eq!(cache.get_source(&source_id2), Some(entity2));
    }
}
