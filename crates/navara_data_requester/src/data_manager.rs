//! Tile data manager for deduplicating data requests based on URL.
//!
//! When multiple layers (terrain, hillshade, etc.) request the same URL,
//! the DataManager ensures only one network request is made and the
//! data is shared via BufferStore handles with reference counting.

use bevy_ecs::entity::Entity;
use bevy_ecs::prelude::Resource;
use navara_buffer_store::{BufferStore, Handle};
use rustc_hash::FxHashMap;

/// Manages resource deduplication and sharing across multiple consumers.
///
/// The DataManager tracks which URLs have been requested and maintains
/// reference counts to ensure resources are only loaded once and cleaned up
/// when no longer needed.
#[derive(Default, Resource)]
pub struct DataManager {
    /// Maps URL to resource entry (handle + consumers)
    url_registry: FxHashMap<String, ResourceEntry>,
    /// Maps entity to URL for cleanup lookup
    entity_to_url: FxHashMap<Entity, String>,
}

/// Information about a shared resource.
pub struct ResourceEntry {
    /// BufferStore handle for the shared data
    pub handle: Handle,
    /// Number of active consumers
    pub reference_count: usize,
}

impl DataManager {
    /// Create a new DataManager.
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a consumer for a URL.
    ///
    /// Returns:
    /// - `handle`: BufferStore handle for the resource (new or existing)
    /// - `is_new_request`: true if this is the first request for this URL
    ///
    /// If the URL is already registered, the existing handle is returned and
    /// the reference count is incremented. Otherwise, a new handle is created.
    pub fn register_consumer(
        &mut self,
        url: String,
        entity: Entity,
        buf: &mut BufferStore,
    ) -> (Handle, bool) {
        let is_new = !self.url_registry.contains_key(&url);

        let entry = self
            .url_registry
            .entry(url.clone())
            .or_insert_with(|| ResourceEntry {
                handle: buf.new_handle(),
                reference_count: 0,
            });

        entry.reference_count += 1;
        self.entity_to_url.insert(entity, url);

        (entry.handle, is_new)
    }

    /// Unregister a consumer.
    ///
    /// Returns:
    /// - `Some((url, handle, should_delete))` if the entity was registered
    /// - `None` if the entity was not found
    ///
    /// The `should_delete` flag is true when this was the last consumer,
    /// indicating the BufferStore data should be removed.
    pub fn unregister_consumer(&mut self, entity: Entity) -> Option<(String, Handle, bool)> {
        let url = self.entity_to_url.remove(&entity)?;
        let entry = self.url_registry.get_mut(&url)?;

        entry.reference_count = entry.reference_count.saturating_sub(1);

        let handle = entry.handle;

        if entry.reference_count == 0 {
            self.url_registry.remove(&url);
            Some((url, handle, true))
        } else {
            Some((url, handle, false))
        }
    }

    /// Get the reference count for a URL.
    pub fn get_ref_count(&self, url: &str) -> usize {
        self.url_registry
            .get(url)
            .map(|e| e.reference_count)
            .unwrap_or(0)
    }

    /// Get total number of registered URLs.
    pub fn len(&self) -> usize {
        self.url_registry.len()
    }

    /// Check if there are no registered URLs.
    pub fn is_empty(&self) -> bool {
        self.url_registry.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bevy_ecs::world::World;

    #[test]
    fn test_register_consumer_creates_new_entry() {
        let mut world = World::new();
        let entity = world.spawn_empty().id();
        let mut buf = BufferStore::default();
        let mut manager = DataManager::new();

        let url = "https://example.com/tile.png".to_string();
        let (_handle, is_new) = manager.register_consumer(url.clone(), entity, &mut buf);

        assert!(is_new);
        assert_eq!(manager.len(), 1);
        assert_eq!(manager.get_ref_count(&url), 1);
    }

    #[test]
    fn test_register_consumer_reuses_existing_handle() {
        let mut world = World::new();
        let entity1 = world.spawn_empty().id();
        let entity2 = world.spawn_empty().id();
        let mut buf = BufferStore::default();
        let mut manager = DataManager::new();

        let url = "https://example.com/tile.png".to_string();

        // First registration
        let (handle1, is_new1) = manager.register_consumer(url.clone(), entity1, &mut buf);
        assert!(is_new1);

        // Second registration (same URL)
        let (handle2, is_new2) = manager.register_consumer(url.clone(), entity2, &mut buf);
        assert!(!is_new2);
        assert_eq!(handle1, handle2); // Same handle
        assert_eq!(manager.get_ref_count(&url), 2);
        assert_eq!(manager.len(), 1); // Still only 1 URL
    }

    #[test]
    fn test_unregister_consumer_decrements_refcount() {
        let mut world = World::new();
        let entity1 = world.spawn_empty().id();
        let entity2 = world.spawn_empty().id();
        let mut buf = BufferStore::default();
        let mut manager = DataManager::new();

        let url = "https://example.com/tile.png".to_string();

        manager.register_consumer(url.clone(), entity1, &mut buf);
        manager.register_consumer(url.clone(), entity2, &mut buf);

        // Unregister first consumer
        let result = manager.unregister_consumer(entity1);
        assert!(result.is_some());
        let (returned_url, _handle, should_delete) = result.unwrap();
        assert_eq!(returned_url, url);
        assert!(!should_delete); // Still has one consumer
        assert_eq!(manager.get_ref_count(&url), 1);
    }

    #[test]
    fn test_unregister_last_consumer_deletes_entry() {
        let mut world = World::new();
        let entity = world.spawn_empty().id();
        let mut buf = BufferStore::default();
        let mut manager = DataManager::new();

        let url = "https://example.com/tile.png".to_string();
        let (handle, _) = manager.register_consumer(url.clone(), entity, &mut buf);

        // Unregister only consumer
        let result = manager.unregister_consumer(entity);
        assert!(result.is_some());
        let (returned_url, returned_handle, should_delete) = result.unwrap();
        assert_eq!(returned_url, url);
        assert_eq!(returned_handle, handle);
        assert!(should_delete); // Should delete
        assert_eq!(manager.len(), 0); // Entry removed
    }

    #[test]
    fn test_multiple_urls() {
        let mut world = World::new();
        let entity1 = world.spawn_empty().id();
        let entity2 = world.spawn_empty().id();
        let mut buf = BufferStore::default();
        let mut manager = DataManager::new();

        let url1 = "https://example.com/tile1.png".to_string();
        let url2 = "https://example.com/tile2.png".to_string();

        let (handle1, _) = manager.register_consumer(url1.clone(), entity1, &mut buf);
        let (handle2, _) = manager.register_consumer(url2.clone(), entity2, &mut buf);

        assert_ne!(handle1, handle2); // Different handles
        assert_eq!(manager.len(), 2);
        assert_eq!(manager.get_ref_count(&url1), 1);
        assert_eq!(manager.get_ref_count(&url2), 1);
    }

    #[test]
    fn test_unregister_nonexistent_entity() {
        let mut world = World::new();
        let entity = world.spawn_empty().id();
        let mut manager = DataManager::new();

        let result = manager.unregister_consumer(entity);
        assert!(result.is_none());
    }
}
