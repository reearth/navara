mod store;

use bevy_app::PostUpdate;
use bevy_ecs::{
    component::Component,
    entity::Entity,
    event::{Event, EventReader},
    query::Added,
    system::{Query, ResMut},
};
pub use store::*;

use crate::event::EventStore;

pub struct BufferStorePlugin;

impl bevy_app::Plugin for BufferStorePlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.init_resource::<BufferStore>();
        app.add_event::<BufferStoreLoadedEvent>();
        app.add_event::<BufferStoreFailedEvent>();
        app.add_systems(
            PostUpdate,
            (
                send_data_requst_events,
                set_data_requester_loaded,
                set_data_requester_faled,
            ),
        );
    }
}

#[derive(Debug, Event)]
pub struct BufferStoreLoadedEvent {
    pub id: Entity,
    pub ty: BufferType,
}

#[derive(Debug, Event)]
pub struct BufferStoreFailedEvent {
    pub id: Entity,
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
    pub status: DataRequesterStatus,
}

impl DataRequester {
    pub fn new(handle: Handle, url: String) -> Self {
        Self {
            handle,
            url,
            status: DataRequesterStatus::default(),
        }
    }

    pub fn from_store(url: String, buf: &mut BufferStore) -> Self {
        Self::new(buf.new_handle(), url)
    }
}

pub fn set_data_requester_loaded(
    mut events: EventReader<BufferStoreLoadedEvent>,
    mut requests: Query<&mut DataRequester>,
) {
    for e in events.read() {
        if let Ok(mut d) = requests.get_mut(e.id) {
            d.status = DataRequesterStatus::Success;
        }
    }
}

pub fn set_data_requester_faled(
    mut events: EventReader<BufferStoreFailedEvent>,
    mut requests: Query<&mut DataRequester>,
) {
    for e in events.read() {
        if let Ok(mut d) = requests.get_mut(e.id) {
            d.status = DataRequesterStatus::Fail;
        }
    }
}

pub fn send_data_requst_events(
    mut events: ResMut<EventStore>,
    requests: Query<(Entity, &DataRequester), Added<DataRequester>>,
) {
    for (e, d) in requests.iter() {
        if !matches!(d.status, DataRequesterStatus::Pending) {
            continue;
        }
        events.data_requested.push(e);
    }
}
