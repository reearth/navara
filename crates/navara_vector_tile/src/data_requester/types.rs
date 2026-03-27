use bevy_ecs::{
    component::Component,
    query::{Added, Changed, Or, Without},
    system::Query,
};
use navara_component::Deleted;
use navara_data_requester::DataRequester;
use navara_tile_component::TileHandle;

#[derive(Component)]
pub struct VectorTileDataRequesterMarker(pub TileHandle);

pub type VectorTileDataRequesterQuery<'world, 'state, 'a> =
    Query<'world, 'state, (&'a VectorTileDataRequesterMarker, &'a DataRequester), Without<Deleted>>;

pub type ChangedVectorTileDataRequesterQuery<'world, 'state, 'a> = Query<
    'world,
    'state,
    (&'a VectorTileDataRequesterMarker, &'a DataRequester),
    (
        Or<(Added<DataRequester>, Changed<DataRequester>)>,
        Without<Deleted>,
    ),
>;
