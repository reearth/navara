use bevy_ecs::{
    component::Component,
    entity::Entity,
    query::{Added, Changed, Or, Without},
    system::Query,
};
use navara_component::Deleted;
use navara_data_requester::DataRequester;
use navara_tile_component::TileHandle;

#[derive(Component)]
pub struct SingleMvtDataRequesterMarker(pub Entity);

#[derive(Component)]
pub struct MvtDataRequesterMarker(pub TileHandle);

pub type MvtDataRequesterQuery<'world, 'state, 'a> =
    Query<'world, 'state, (&'a MvtDataRequesterMarker, &'a DataRequester), Without<Deleted>>;

pub type ChangedMvtDataRequesterQuery<'world, 'state, 'a> = Query<
    'world,
    'state,
    (&'a MvtDataRequesterMarker, &'a DataRequester),
    (
        Or<(Added<DataRequester>, Changed<DataRequester>)>,
        Without<Deleted>,
    ),
>;
