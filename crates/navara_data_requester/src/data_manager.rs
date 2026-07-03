//! Tile data manager for deduplicating data requests based on URL + byte range.
//!
//! When multiple layers (terrain, hillshade, etc.) request the same bytes,
//! the DataManager ensures only one network request is made and the
//! data is shared via BufferStore handles with reference counting.

use bevy_ecs::entity::Entity;
use bevy_ecs::prelude::Resource;
use navara_buffer_store::{BufferStore, Handle};
use rustc_hash::FxHashMap;

/// Identity of a shared fetch: a URL plus an optional HTTP byte range.
///
/// The byte range is part of the key because a `Range: bytes=offset-…` GET
/// returns a *different payload* than a full GET — or than a different range —
/// of the same URL. Deduplicating on URL alone would let two consumers asking
/// for distinct ranges share one handle/fetch, handing at least one of them the
/// wrong bytes. `None` (full-resource GET) is its own distinct key.
#[derive(Clone, PartialEq, Eq, Hash, Debug)]
struct RequestKey {
    url: String,
    byte_range: Option<(u64, u64)>,
}

/// Manages resource deduplication and sharing across multiple consumers.
///
/// The DataManager tracks which (URL, byte range) pairs have been requested and
/// maintains reference counts to ensure resources are only loaded once and
/// cleaned up when no longer needed.
#[derive(Default, Resource)]
pub struct DataManager {
    /// Maps request key (URL + byte range) to resource entry (handle + consumers)
    url_registry: FxHashMap<RequestKey, ResourceEntry>,
    /// Maps entity to its request key for cleanup lookup
    entity_to_url: FxHashMap<Entity, RequestKey>,
}

/// Information about a shared resource.
pub struct ResourceEntry {
    /// BufferStore handle for the shared data
    pub handle: Handle,
    /// Number of active consumers
    pub reference_count: usize,
    /// Whether a fetch has been enqueued for this URL.
    /// This prevents duplicate fetches when multiple consumers share a handle.
    /// Reset to false if all consumers are removed before fetch completes.
    pub fetch_enqueued: bool,
}

impl DataManager {
    /// Create a new DataManager.
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a consumer for a URL + byte range.
    ///
    /// Pass the same `byte_range` that the consumer's `DataRequester` carries
    /// (`None` for a full-resource GET). Consumers sharing a handle/fetch must
    /// agree on the bytes they want; see [`RequestKey`].
    ///
    /// Returns:
    /// - `handle`: BufferStore handle for the resource (new or existing)
    /// - `is_new_request`: true if this is the first request for this key
    /// - `fetch_already_enqueued`: true if a fetch has already been triggered for this key
    ///
    /// If the key is already registered, the existing handle is returned and
    /// the reference count is incremented. Otherwise, a new handle is created.
    pub fn register_consumer(
        &mut self,
        url: String,
        byte_range: Option<(u64, u64)>,
        entity: Entity,
        buf: &mut BufferStore,
    ) -> (Handle, bool, bool) {
        let key = RequestKey { url, byte_range };
        let is_new = !self.url_registry.contains_key(&key);

        let entry = self
            .url_registry
            .entry(key.clone())
            .or_insert_with(|| ResourceEntry {
                handle: buf.new_handle(),
                reference_count: 0,
                fetch_enqueued: false,
            });

        let fetch_already_enqueued = entry.fetch_enqueued;
        entry.reference_count += 1;
        self.entity_to_url.insert(entity, key);

        (entry.handle, is_new, fetch_already_enqueued)
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
        let key = self.entity_to_url.remove(&entity)?;
        let entry = self.url_registry.get_mut(&key)?;

        entry.reference_count = entry.reference_count.saturating_sub(1);

        let handle = entry.handle;

        if entry.reference_count == 0 {
            self.url_registry.remove(&key);
            Some((key.url, handle, true))
        } else {
            Some((key.url, handle, false))
        }
    }

    /// Get the reference count for a URL + byte range.
    pub fn get_ref_count(&self, url: &str, byte_range: Option<(u64, u64)>) -> usize {
        let key = RequestKey {
            url: url.to_string(),
            byte_range,
        };
        self.url_registry
            .get(&key)
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

    /// Try to mark that a fetch has been enqueued for an entity's URL.
    /// Returns true if this is the first fetch for this URL (caller should push event).
    /// Returns false if a fetch was already enqueued (caller should skip pushing event).
    /// This prevents duplicate fetches when multiple consumers for the same URL
    /// are spawned in the same frame.
    ///
    /// For entities not registered in DataManager (unmanaged DataRequesters),
    /// returns true to allow the event (fallback for tests and legacy code).
    pub fn try_mark_fetch_enqueued(&mut self, entity: Entity) -> bool {
        if let Some(entry) = self
            .entity_to_url
            .get(&entity)
            .and_then(|key| self.url_registry.get_mut(key))
        {
            if entry.fetch_enqueued {
                return false; // Already enqueued by another consumer
            }
            entry.fetch_enqueued = true;
            return true; // Successfully marked as first fetch
        }
        // Entity not in registry - allow event (for unmanaged DataRequesters)
        true
    }

    /// Reset the fetch_enqueued flag for an entity's URL.
    /// This is called when a fetch fails, allowing future consumers to retry.
    pub fn reset_fetch_enqueued(&mut self, entity: Entity) {
        if let Some(entry) = self
            .entity_to_url
            .get(&entity)
            .and_then(|key| self.url_registry.get_mut(key))
        {
            entry.fetch_enqueued = false;
        }
    }

    /// Get the handle associated with an entity.
    /// This works even if the entity component was deleted, as long as
    /// the entity is still registered in DataManager. Useful for failure
    /// broadcasting when the fetch leader might be gone.
    pub fn get_handle_for_entity(&self, entity: Entity) -> Option<Handle> {
        self.entity_to_url
            .get(&entity)
            .and_then(|key| self.url_registry.get(key))
            .map(|entry| entry.handle)
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
        let (_handle, is_new, fetch_already_enqueued) =
            manager.register_consumer(url.clone(), None, entity, &mut buf);

        assert!(is_new);
        assert!(!fetch_already_enqueued);
        assert_eq!(manager.len(), 1);
        assert_eq!(manager.get_ref_count(&url, None), 1);
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
        let (handle1, is_new1, fetch_already_enqueued1) =
            manager.register_consumer(url.clone(), None, entity1, &mut buf);
        assert!(is_new1);
        assert!(!fetch_already_enqueued1);

        // Second registration (same URL)
        let (handle2, is_new2, fetch_already_enqueued2) =
            manager.register_consumer(url.clone(), None, entity2, &mut buf);
        assert!(!is_new2);
        assert!(!fetch_already_enqueued2); // First consumer hasn't marked it yet
        assert_eq!(handle1, handle2); // Same handle
        assert_eq!(manager.get_ref_count(&url, None), 2);
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

        let _ = manager.register_consumer(url.clone(), None, entity1, &mut buf);
        let _ = manager.register_consumer(url.clone(), None, entity2, &mut buf);

        // Unregister first consumer
        let result = manager.unregister_consumer(entity1);
        assert!(result.is_some());
        let (returned_url, _handle, should_delete) = result.unwrap();
        assert_eq!(returned_url, url);
        assert!(!should_delete); // Still has one consumer
        assert_eq!(manager.get_ref_count(&url, None), 1);
    }

    #[test]
    fn test_unregister_last_consumer_deletes_entry() {
        let mut world = World::new();
        let entity = world.spawn_empty().id();
        let mut buf = BufferStore::default();
        let mut manager = DataManager::new();

        let url = "https://example.com/tile.png".to_string();
        let (handle, _, _) = manager.register_consumer(url.clone(), None, entity, &mut buf);

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

        let (handle1, _, _) = manager.register_consumer(url1.clone(), None, entity1, &mut buf);
        let (handle2, _, _) = manager.register_consumer(url2.clone(), None, entity2, &mut buf);

        assert_ne!(handle1, handle2); // Different handles
        assert_eq!(manager.len(), 2);
        assert_eq!(manager.get_ref_count(&url1, None), 1);
        assert_eq!(manager.get_ref_count(&url2, None), 1);
    }

    #[test]
    fn test_same_url_distinct_ranges_do_not_share_handle() {
        let mut world = World::new();
        let entity1 = world.spawn_empty().id();
        let entity2 = world.spawn_empty().id();
        let entity_full = world.spawn_empty().id();
        let mut buf = BufferStore::default();
        let mut manager = DataManager::new();

        let url = "https://example.com/archive.pmtiles".to_string();

        // Two consumers want different byte ranges of the same URL, plus one
        // wants the whole resource. All three are distinct fetches and must get
        // distinct handles — otherwise the shared fetch returns the wrong bytes.
        let (handle_a, is_new_a, _) =
            manager.register_consumer(url.clone(), Some((0, 100)), entity1, &mut buf);
        let (handle_b, is_new_b, _) =
            manager.register_consumer(url.clone(), Some((100, 50)), entity2, &mut buf);
        let (handle_full, is_new_full, _) =
            manager.register_consumer(url.clone(), None, entity_full, &mut buf);

        assert!(is_new_a);
        assert!(is_new_b);
        assert!(is_new_full);
        assert_ne!(handle_a, handle_b);
        assert_ne!(handle_a, handle_full);
        assert_ne!(handle_b, handle_full);

        // Three distinct keys for the same URL.
        assert_eq!(manager.len(), 3);
        assert_eq!(manager.get_ref_count(&url, Some((0, 100))), 1);
        assert_eq!(manager.get_ref_count(&url, Some((100, 50))), 1);
        assert_eq!(manager.get_ref_count(&url, None), 1);
    }

    #[test]
    fn test_same_url_same_range_shares_handle() {
        let mut world = World::new();
        let entity1 = world.spawn_empty().id();
        let entity2 = world.spawn_empty().id();
        let mut buf = BufferStore::default();
        let mut manager = DataManager::new();

        let url = "https://example.com/archive.pmtiles".to_string();
        let range = Some((0, 100));

        // Consumers asking for the *same* bytes still dedup onto one handle.
        let (handle1, is_new1, _) =
            manager.register_consumer(url.clone(), range, entity1, &mut buf);
        let (handle2, is_new2, _) =
            manager.register_consumer(url.clone(), range, entity2, &mut buf);

        assert!(is_new1);
        assert!(!is_new2);
        assert_eq!(handle1, handle2);
        assert_eq!(manager.len(), 1);
        assert_eq!(manager.get_ref_count(&url, range), 2);
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
