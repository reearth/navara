use bevy_ecs::{
    component::Component,
    query::{Added, Changed, Or, Without},
    system::Query,
};
use navara_component::Deleted;
use navara_data_requester::DataRequester;

use crate::TileHandle;

#[derive(Component)]
pub struct TerrainDataRequesterMarker(pub TileHandle);

pub type TileTerrainDataRequesterQuery<'world, 'state, 'a> =
    Query<'world, 'state, (&'a TerrainDataRequesterMarker, &'a DataRequester), Without<Deleted>>;

pub type ChangedTileTerrainDataRequesterQuery<'world, 'state, 'a> = Query<
    'world,
    'state,
    (&'a TerrainDataRequesterMarker, &'a DataRequester),
    (
        Or<(Added<DataRequester>, Changed<DataRequester>)>,
        Without<Deleted>,
    ),
>;
