pub use navara_vector_tile::{
    SourceId, TraversalConfig, VectorTileSourceCache, VectorTileSourceResources,
};

use navara_layer::MvtLayer;

/// Backward compatibility aliases.
pub type MvtSourceResources = VectorTileSourceResources;
pub type MvtSourceCache = VectorTileSourceCache;

/// Extension trait for creating SourceId from MvtLayer.
pub trait MvtSourceId {
    fn from_mvt_layer(layer: &MvtLayer) -> Option<SourceId>;
}

impl MvtSourceId for SourceId {
    fn from_mvt_layer(layer: &MvtLayer) -> Option<SourceId> {
        let data = layer.data.as_ref()?;
        let vt = layer.vector_tile_appearance();
        let max_zoom = vt.map(|v| v.max_zoom).unwrap_or(20);
        let max_sse = vt.map(|v| v.max_sse).unwrap_or(2.0);
        let overscaled_max_zoom = vt.map(|v| v.overscaled_max_zoom).unwrap_or(24);

        let traversal_config = TraversalConfig::from_appearances(
            &layer.appearances,
            max_zoom,
            max_sse,
            overscaled_max_zoom,
        );

        Some(SourceId::new(data.url.clone(), traversal_config))
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
