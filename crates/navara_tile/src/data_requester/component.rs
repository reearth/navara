use bevy_ecs::{component::Component, query::Without, system::Query};
use navara_data_requester::DataRequester;

use crate::tile::TileHandle;

#[derive(Component)]
pub struct TerrainDataRequesterMarker(pub TileHandle);

pub type TileTerrainDataRequesterQuery<'world, 'state, 'a> = Query<
    'world,
    'state,
    (&'a TerrainDataRequesterMarker, &'a DataRequester),
    Without<navara_data_requester::Deleted>,
>;
