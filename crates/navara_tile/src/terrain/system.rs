use bevy_ecs::{
    query::Added,
    system::{Commands, Query, ResMut},
};
use navara_layer::TerrainLayer;
use navara_tile_component::{CachedMartini, MartiniComponent};

pub fn begine_terrain_layer(
    mut commands: Commands,
    mut cached_martini: ResMut<CachedMartini>,
    layers: Query<&TerrainLayer, Added<TerrainLayer>>,
) {
    for layer in layers.iter() {
        let size = layer.appearance.as_ref().unwrap().tile_size;
        if cached_martini.get(&size).is_some() {
            continue;
        }

        cached_martini.insert(size, commands.spawn(MartiniComponent::new(size + 1)).id());
    }
}
