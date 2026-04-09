use bevy_ecs::prelude::*;
use navara_geojson_vt::{GeoJsonVt, Options as GeoJsonVtOptions};
use navara_layer::{GeoJsonLayer, GeoJsonLayerData};
use navara_material::Appearance;
use navara_tile_component::VectorTileQuadtree;
use navara_vector_tile::{
    LayerResources, SourceId, TileCacheManager, TileSource, TraversalConfig, VectorTileSourceCache,
    VectorTileSourceResources,
};

use super::source::GeoJsonTileSource;

#[derive(Component)]
pub(crate) struct Tiled;

/// Sets up tiled rendering for GeoJSON layers with clamped polygon appearances.
///
/// When a GeoJsonLayer with `clamp_to_ground` polygon is added, this system:
/// 1. Builds a GeoJsonVt spatial index from the GeoJSON data
/// 2. Creates VectorTileSourceResources for the tile pipeline
/// 3. Registers the source in VectorTileSourceCache
#[allow(clippy::type_complexity)]
pub fn setup_tiled_geojson(
    mut commands: Commands,
    geojson_layers: Query<(Entity, &GeoJsonLayer), (Changed<GeoJsonLayer>, Without<Tiled>)>,
    mut source_cache: ResMut<VectorTileSourceCache>,
) {
    for (layer_entity, layer) in &geojson_layers {
        let is_tiled = layer.appearances.iter().any(|a| {
            matches!(a, Appearance::Polygon(p) if p.clamp_to_ground || p.tiled)
                || matches!(a, Appearance::Polyline(p) if p.clamp_to_ground)
        });
        if !is_tiled {
            continue;
        }

        let geojson = match &layer.data {
            Some(GeoJsonLayerData::GeoJson(g)) => g,
            _ => continue,
        };

        let opts = GeoJsonVtOptions {
            // Avoid to stop the tile splitting unexpectedly.
            index_max_points: 0,
            ..Default::default()
        };
        let max_zoom = opts.max_zoom;
        let extent = opts.extent;
        let vt = GeoJsonVt::new(geojson, opts);

        let traversal_config =
            TraversalConfig::from_appearances(&layer.appearances, max_zoom as usize, 2.0, 24);
        let source_id = SourceId::new(format!("geojson:{}", layer.layer_id), traversal_config);

        let quadtree = commands
            .spawn(VectorTileQuadtree::new_with_linear_qt())
            .id();
        let tile_cache_manager = commands.spawn(TileCacheManager::default()).id();

        let source_entity = commands
            .spawn((
                VectorTileSourceResources::new(
                    source_id.clone(),
                    quadtree,
                    tile_cache_manager,
                    vec![layer_entity],
                ),
                TileSource(Box::new(GeoJsonTileSource {
                    vt,
                    extent,
                    layer_id: layer.layer_id.clone(),
                    appearances: layer.appearances.clone(),
                    prepared: Default::default(),
                })),
            ))
            .id();

        source_cache.register_source(source_id, source_entity);

        commands
            .entity(layer_entity)
            .insert(LayerResources {
                layer_id: layer.layer_id.clone(),
                source: source_entity,
                quadtree,
                tile_cache_manager,
            })
            .insert(Tiled);
    }
}
