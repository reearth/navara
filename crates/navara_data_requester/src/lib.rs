#![doc = include_str!("../README.md")]

mod data_manager;

use bevy_app::{PostUpdate, PreUpdate};
use bevy_ecs::{
    component::Component,
    entity::Entity,
    message::MessageReader,
    query::{Added, With, Without},
    schedule::{IntoScheduleConfigs, SystemSet},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::{BufferStore, BufferStoreFailedEvent, BufferStoreLoadedEvent, Handle};
use navara_component::{Deleted, Ignored, Priority, Requested};
use navara_event_store::EventStore;
use url::Url;

pub use data_manager::DataManager;

pub struct DataRequesterPlugin;

/// System sets that order data-request dispatch within [`PostUpdate`].
///
/// A consumer crate that supplies its own priority/sort sender (such as
/// `navara_cesium3dtiles`'s distance-ordered sender) should register it in
/// [`DataRequesterSet::PrioritizeRequests`] rather than ordering against the
/// built-in sender directly. That set is chained before
/// [`DataRequesterSet::SendRequests`], so the deferred `Requested` insert
/// from the consumer's sender is flushed at the sync point Bevy inserts
/// between the two sets (auto-inserted because the consumer sender holds
/// `Commands`; enabled by default) before the built-in priority-only sender
/// runs. Without that boundary the same entity could be enqueued twice in
/// one frame.
#[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
pub enum DataRequesterSet {
    /// Consumer-provided priority/sort senders run here, ahead of the
    /// built-in senders in [`DataRequesterSet::SendRequests`].
    PrioritizeRequests,
    /// Built-in senders that enqueue data requests and apply load results.
    SendRequests,
}

impl bevy_app::Plugin for DataRequesterPlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.init_resource::<DataManager>()
            .configure_sets(
                PostUpdate,
                (
                    DataRequesterSet::PrioritizeRequests,
                    DataRequesterSet::SendRequests,
                )
                    .chain(),
            )
            .add_systems(PreUpdate, remove_removed_data_requesters)
            .add_systems(
                PostUpdate,
                (
                    send_data_request_events,
                    send_data_request_events_with_priority,
                    set_data_requester_loaded,
                    set_data_requester_failed,
                )
                    .chain()
                    .in_set(DataRequesterSet::SendRequests),
            );
    }
}

#[derive(Default, Debug, Clone, PartialEq)]
pub enum DataRequesterStatus {
    #[default]
    Pending,
    Success,
    Fail,
}

#[derive(Debug, Clone, PartialEq, Default, Component)]
pub struct DataRequester {
    pub handle: Handle,
    pub url: String,
    pub extension: DataRequesterExtension,
    pub status: DataRequesterStatus,
    /// Whether this DataRequester's handle is managed by DataManager.
    /// If true, cleanup is handled via DataManager's refcounting.
    /// If false, handle cleanup is the responsibility of the owner.
    pub managed_by_data_manager: bool,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub enum DataRequesterExtension {
    #[default]
    Png,
    WebP,
    Json,
    B3dm,
    Pnts,
    Mvt,
    GeoJson,
    Glb,
    Gltf,
}

impl DataRequesterExtension {
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(v: &str) -> Self {
        match v {
            "png" => Self::Png,
            "webp" => Self::WebP,
            "json" => Self::Json,
            "b3dm" => Self::B3dm,
            "pnts" => Self::Pnts,
            "mvt" => Self::Mvt,
            "geojson" => Self::GeoJson,
            "glb" => Self::Glb,
            "gltf" => Self::Gltf,
            _ => unimplemented!("{}", v),
        }
    }

    #[allow(clippy::inherent_to_string)]
    pub fn to_string(&self) -> String {
        match self {
            Self::Png => "png".to_string(),
            Self::WebP => "webp".to_string(),
            Self::Json => "json".to_string(),
            Self::B3dm => "b3dm".to_string(),
            Self::Pnts => "pnts".to_string(),
            Self::Mvt => "mvt".to_string(),
            Self::GeoJson => "geojson".to_string(),
            Self::Glb => "glb".to_string(),
            Self::Gltf => "gltf".to_string(),
        }
    }

    pub fn from_url(url: &Url) -> Self {
        match url.path() {
            v if v.ends_with("geojson") => Self::GeoJson,
            v if v.ends_with("json") => Self::Json,
            v if v.ends_with("b3dm") => Self::B3dm,
            v if v.ends_with("pnts") => Self::Pnts,
            v if v.ends_with("png") => Self::Png,
            v if v.contains(".glb") => Self::Glb,
            v if v.ends_with("gltf") => Self::Gltf,
            v if v.ends_with("webp") => Self::WebP,
            v => unimplemented!("The extension of {} isn't supported", v),
        }
    }
}

impl DataRequester {
    /// Create a DataRequester with an unmanaged handle.
    /// The caller is responsible for handle cleanup.
    pub fn new(handle: Handle, url: String, extension: DataRequesterExtension) -> Self {
        Self {
            handle,
            url,
            extension,
            status: DataRequesterStatus::default(),
            managed_by_data_manager: false,
        }
    }

    /// Create a DataRequester with a DataManager-managed handle.
    /// Cleanup is handled via DataManager's refcounting.
    /// This should be used after calling `DataManager::register_consumer()`.
    pub fn new_with_status(
        handle: Handle,
        url: String,
        extension: DataRequesterExtension,
        status: DataRequesterStatus,
    ) -> Self {
        Self {
            handle,
            url,
            extension,
            status,
            managed_by_data_manager: true,
        }
    }

    pub fn from_store(
        url: String,
        buf: &mut BufferStore,
        extension: DataRequesterExtension,
    ) -> Self {
        Self::new(buf.new_handle(), url, extension)
    }

    pub fn is_succeeded(&self) -> bool {
        matches!(self.status, DataRequesterStatus::Success)
    }

    pub fn is_failed(&self) -> bool {
        matches!(self.status, DataRequesterStatus::Fail)
    }

    pub fn is_pending(&self) -> bool {
        matches!(self.status, DataRequesterStatus::Pending)
    }
}

pub fn set_data_requester_loaded(
    mut commands: Commands,
    mut events: MessageReader<BufferStoreLoadedEvent>,
    mut requests: Query<(Entity, &mut DataRequester), With<Requested>>,
) {
    for e in events.read() {
        let loaded_handle = e.handle;

        // Broadcast success to DataRequesters with matching handle.
        // Query filtered to With<Requested> for performance - all in-flight requests
        // have Requested marker (inserted by send_data_request_events), so this
        // skips already-successful DataRequesters while finding all pending ones.
        for (entity, mut data_req) in requests.iter_mut() {
            if data_req.handle == loaded_handle && data_req.status == DataRequesterStatus::Pending {
                commands.entity(entity).remove::<Requested>();
                data_req.status = DataRequesterStatus::Success;
            }
        }
    }
}

pub fn set_data_requester_failed(
    mut commands: Commands,
    mut events: MessageReader<BufferStoreFailedEvent>,
    mut requests: Query<&mut DataRequester>,
) {
    for e in events.read() {
        if let Ok(mut d) = requests.get_mut(e.id) {
            commands.entity(e.id).remove::<Requested>();
            d.status = DataRequesterStatus::Fail;
        }
    }
}

#[allow(clippy::type_complexity)]
pub fn send_data_request_events(
    mut commands: Commands,
    mut events: ResMut<EventStore>,
    requests: Query<
        Entity,
        (
            Added<DataRequester>,
            Without<Priority>,
            Without<Deleted>,
            Without<Requested>,
        ),
    >,
    removed: Query<Entity, (With<DataRequester>, With<Deleted>, Without<Ignored>)>,
) {
    for e in requests.iter() {
        commands.entity(e).insert(Requested);
        events.data_requested.push(e);
    }

    for e in removed.iter() {
        commands.entity(e).remove::<Requested>();
        events.data_requester_removed.push(e);
    }
}

#[allow(clippy::type_complexity)]
pub fn send_data_request_events_with_priority(
    mut commands: Commands,
    mut events: ResMut<EventStore>,
    requests: Query<
        (Entity, &Priority),
        (Added<DataRequester>, Without<Deleted>, Without<Requested>),
    >,
) {
    for (e, _) in requests.iter().sort::<&Priority>() {
        commands.entity(e).insert(Requested);
        events.data_requested.push(e);
    }
}

/// Marker trait for a secondary sort key used by
/// [`send_data_request_events_with_priority_and_sort`]. Implementors are
/// wrapped in [`RequestOrder<K>`] and compared after `Priority`; smaller
/// values (per [`Ord`]) are enqueued earlier within the same priority.
pub trait RequestOrderKey: Component + Ord + Send + Sync + 'static {}

/// Wrapper component attached to a [`DataRequester`] to control its
/// position in the request queue. Smaller `K` values (per [`Ord`]) are
/// enqueued earlier within the same [`Priority`].
#[derive(Component, PartialEq, Eq, PartialOrd, Ord, Debug, Clone)]
pub struct RequestOrder<K: RequestOrderKey>(pub K);

/// Priority + secondary-sort version of [`send_data_request_events_with_priority`].
///
/// Requests with the highest [`Priority`] are sent first; ties are broken by
/// the wrapped [`RequestOrderKey`] (smaller first). Already-`Requested`
/// entities are skipped so this can run alongside the default senders.
#[allow(clippy::type_complexity)]
pub fn send_data_request_events_with_priority_and_sort<K: RequestOrderKey>(
    mut commands: Commands,
    mut events: ResMut<EventStore>,
    requests: Query<
        (Entity, &Priority, &RequestOrder<K>),
        (Added<DataRequester>, Without<Deleted>, Without<Requested>),
    >,
) {
    for (e, _, _) in requests.iter().sort::<(&Priority, &RequestOrder<K>)>() {
        commands.entity(e).insert(Requested);
        events.data_requested.push(e);
    }
}

pub fn remove_removed_data_requesters(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut resource_manager: ResMut<DataManager>,
    removed: Query<(Entity, &DataRequester), With<Deleted>>,
) {
    for (e, d) in removed.iter() {
        if d.managed_by_data_manager {
            // Handle is managed by DataManager - use refcounting cleanup.
            // Note: unregister_consumer may return None if this entity was already
            // unregistered (e.g., by filter systems), which is fine - the handle
            // cleanup was already handled or is still shared by other consumers.
            if let Some((_url, handle, true)) = resource_manager.unregister_consumer(e) {
                buf.remove(&handle);
            }
        } else {
            // Handle is unmanaged - caller is responsible for cleanup
            buf.remove(&d.handle);
        }

        commands.entity(e).remove::<Requested>();
        commands.entity(e).despawn();
    }
}

#[cfg(test)]
mod tests {
    use std::cmp::Ordering;

    use bevy_app::App;
    use bevy_ecs::component::Component;

    use super::*;

    #[derive(Component, PartialEq, Eq, Clone, Copy, Debug)]
    struct TestKey(i32);

    impl PartialOrd for TestKey {
        fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
            Some(self.cmp(other))
        }
    }

    impl Ord for TestKey {
        fn cmp(&self, other: &Self) -> Ordering {
            self.0.cmp(&other.0)
        }
    }

    impl RequestOrderKey for TestKey {}

    fn spawn_requester(app: &mut App, priority: Priority, key: i32) -> bevy_ecs::entity::Entity {
        app.world_mut()
            .spawn((
                DataRequester::default(),
                priority,
                RequestOrder(TestKey(key)),
            ))
            .id()
    }

    #[test]
    fn priority_and_sort_enqueues_in_ascending_order() {
        let mut app = App::new();
        app.init_resource::<EventStore>();
        app.add_systems(
            bevy_app::Update,
            send_data_request_events_with_priority_and_sort::<TestKey>,
        );

        // Spawn in deliberately scrambled key order; the sender must reorder them.
        let e1 = spawn_requester(&mut app, Priority::High, 30);
        let e2 = spawn_requester(&mut app, Priority::High, 10);
        let e3 = spawn_requester(&mut app, Priority::High, 20);

        app.update();

        let order = app.world().resource::<EventStore>().data_requested.clone();
        assert_eq!(order, vec![e2, e3, e1]);

        // All three should now carry Requested so a second tick is a no-op.
        for e in [e1, e2, e3] {
            assert!(app.world().get::<Requested>(e).is_some());
        }
    }

    #[test]
    fn priority_and_sort_sorts_priority_before_key() {
        let mut app = App::new();
        app.init_resource::<EventStore>();
        app.add_systems(
            bevy_app::Update,
            send_data_request_events_with_priority_and_sort::<TestKey>,
        );

        // Lower-priority entity has a smaller key; priority must still win.
        let high = spawn_requester(&mut app, Priority::High, 100);
        let low = spawn_requester(&mut app, Priority::Low, 1);

        app.update();

        let order = app.world().resource::<EventStore>().data_requested.clone();
        assert_eq!(order, vec![high, low]);
    }

    #[test]
    fn default_sender_skips_already_requested_entities() {
        // Mirrors the production wiring: the priority+sort sender runs in
        // DataRequesterSet::PrioritizeRequests and the built-in priority-only
        // sender in DataRequesterSet::SendRequests, with the two sets chained
        // exactly as DataRequesterPlugin configures them. This exercises the
        // cross-set sync point (not an over-constrained single .chain()), so a
        // missing flush of the Requested insert would surface here as a
        // duplicate enqueue.
        let mut app = App::new();
        app.init_resource::<EventStore>();
        app.configure_sets(
            PostUpdate,
            (
                DataRequesterSet::PrioritizeRequests,
                DataRequesterSet::SendRequests,
            )
                .chain(),
        );
        app.add_systems(
            PostUpdate,
            send_data_request_events_with_priority_and_sort::<TestKey>
                .in_set(DataRequesterSet::PrioritizeRequests),
        );
        app.add_systems(
            PostUpdate,
            send_data_request_events_with_priority.in_set(DataRequesterSet::SendRequests),
        );

        let with_key = spawn_requester(&mut app, Priority::High, 5);
        // An entity that has Priority but no RequestOrder<TestKey> — should
        // be picked up by the default sender.
        let without_key = app
            .world_mut()
            .spawn((DataRequester::default(), Priority::High))
            .id();

        app.update();

        let order = app.world().resource::<EventStore>().data_requested.clone();
        // The keyed entity went first via the specialized sender; the keyless
        // one followed via the default sender — and the keyed one was not
        // re-pushed (no duplicates).
        assert_eq!(order.len(), 2);
        assert_eq!(order[0], with_key);
        assert_eq!(order[1], without_key);
    }
}
