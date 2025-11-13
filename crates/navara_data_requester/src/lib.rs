#![doc = include_str!("../README.md")]

use bevy_app::{PostUpdate, PreUpdate};
use bevy_ecs::{
    component::Component,
    entity::Entity,
    event::EventReader,
    query::{Added, With, Without},
    schedule::IntoScheduleConfigs,
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::{BufferStore, BufferStoreFailedEvent, BufferStoreLoadedEvent, Handle};
use navara_component::{Deleted, Ignored, Priority, Requested};
use navara_event_store::EventStore;
use url::Url;

pub struct DataRequesterPlugin;

impl bevy_app::Plugin for DataRequesterPlugin {
    fn build(&self, app: &mut bevy_app::App) {
        app.add_systems(PreUpdate, remove_removed_data_requesters)
            .add_systems(
                PostUpdate,
                (
                    send_data_request_events,
                    send_data_request_events_with_priority,
                    set_data_requester_loaded,
                    set_data_requester_failed,
                )
                    .chain(),
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
        }
    }

    pub fn from_url(url: &Url) -> Self {
        match url.path() {
            v if v.ends_with("geojson") => Self::GeoJson,
            v if v.ends_with("json") => Self::Json,
            v if v.ends_with("b3dm") => Self::B3dm,
            v if v.ends_with("pnts") => Self::Pnts,
            v if v.ends_with("png") => Self::Png,
            v if v.ends_with("webp") => Self::WebP,
            v => unimplemented!("The extension of {} isn't supported", v),
        }
    }
}

impl DataRequester {
    pub fn new(handle: Handle, url: String, extension: DataRequesterExtension) -> Self {
        Self {
            handle,
            url,
            extension,
            status: DataRequesterStatus::default(),
        }
    }

    pub fn from_store(
        url: String,
        buf: &mut BufferStore,
        extension: DataRequesterExtension,
    ) -> Self {
        Self::new(buf.new_handle(), url, extension)
    }
}

pub fn set_data_requester_loaded(
    mut commands: Commands,
    mut events: EventReader<BufferStoreLoadedEvent>,
    mut requests: Query<&mut DataRequester>,
) {
    for e in events.read() {
        if let Ok(mut d) = requests.get_mut(e.id) {
            commands.entity(e.id).remove::<Requested>();
            d.status = DataRequesterStatus::Success;
        }
    }
}

pub fn set_data_requester_failed(
    mut commands: Commands,
    mut events: EventReader<BufferStoreFailedEvent>,
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
    requests: Query<Entity, (Added<DataRequester>, Without<Priority>, Without<Deleted>)>,
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
    requests: Query<(Entity, &Priority), (Added<DataRequester>, Without<Deleted>)>,
) {
    for (e, _) in requests.iter().sort::<&Priority>() {
        commands.entity(e).insert(Requested);
        events.data_requested.push(e);
    }
}

pub fn remove_removed_data_requesters(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    removed: Query<(Entity, &DataRequester), With<Deleted>>,
) {
    for (e, d) in removed.iter() {
        buf.remove(&d.handle);
        commands.entity(e).remove::<Requested>();
        commands.entity(e).despawn();
    }
}
