#![doc = include_str!("../README.md")]

use bevy_app::PostUpdate;
use bevy_ecs::{
    component::Component,
    entity::Entity,
    event::EventReader,
    query::Added,
    system::{Query, ResMut},
};
use navara_buffer_store::{BufferStore, BufferStoreFailedEvent, BufferStoreLoadedEvent, Handle};
use navara_event_store::EventStore;

pub struct DataRequesterPlugin;

impl bevy_app::Plugin for DataRequesterPlugin {
    fn build(&self, app: &mut bevy_app::App) {
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
    requests: Query<Entity, Added<DataRequester>>,
) {
    for e in requests.iter() {
        events.data_requested.push(e);
    }
}
