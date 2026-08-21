use bevy_ecs::{
    change_detection::DetectChangesMut,
    entity::Entity,
    query::{Added, Changed, Or, Without},
    system::{Commands, Query, Res, ResMut},
};

use navara_component::{Deleted, Priority};

use navara_feature_component::{
    batch::{BatchTable, BatchedFeature},
    id::FeatureId,
    polygon::UpdatePolygon,
    render::RenderableFeature,
};

use navara_tile_component::VectorTileQuadtree;
use navara_vector_tile::{
    LayerResources, RenderedTile, TileCacheManager, TileSource, VectorTileFeatureMarker,
    VectorTileSourceCache, VectorTileSourceResources,
};

use navara_buffer_store::BufferStore;

use navara_layer::{
    DeleteGeoJsonLayerMarker, GeoJsonLayer, LayerId, LayerStore, UpdateGeoJsonLayerMarker,
};
use navara_material::Appearance;

use navara_layer::GeoJsonLayerDataRequesterMarker;
use navara_source::{GeoJsonData, Source, SourceStore};

use navara_data_requester::{DataRequester, DataRequesterExtension, DataRequesterStatus};
use navara_parser::geojson::GeoJson;

use crate::geometry;
use crate::tile::source::GeoJsonTileSource;

#[allow(clippy::type_complexity)]
pub fn construct_feature(
    mut commands: Commands,
    mut batch_table_res: ResMut<BatchTable>,
    mut buf: ResMut<BufferStore>,
    source_store: Res<SourceStore>,
    geojson_layers: Query<&GeoJsonLayer, Or<(Added<GeoJsonLayer>, Changed<GeoJsonLayer>)>>,
) {
    for layer in &geojson_layers {
        // Read the inline GeoJSON live from the referenced source. A URL source
        // is skipped here until `parse_geojson` writes the fetched document back
        // onto the source (which retriggers this system).
        if let Some(source_id) = layer.source_id.as_deref()
            && let Some(Source::GeoJson(s)) = source_store.get(source_id)
            && let Some(GeoJsonData::GeoJson(geo_data)) = &s.data
        {
            geometry::construct_geometry(
                &mut commands,
                &mut batch_table_res,
                &mut buf,
                geo_data,
                &layer.appearances,
                layer.layer_id.as_str(),
            );
        }
    }
}

pub fn update_geo_json_layer(
    mut commands: Commands,
    layer_store: Res<LayerStore>,
    updated: Query<(Entity, &UpdateGeoJsonLayerMarker)>,
    mut features: Query<&mut RenderableFeature>,
    layers: Query<(&GeoJsonLayer, Option<&LayerResources>)>,
    mut tile_sources: Query<&mut TileSource>,
) {
    for (e, u) in &updated {
        let layer_id = u.layer_id.clone();
        let mut all_rendered = true;
        if let Some(ids) = layer_store.get(&layer_id) {
            for id in ids {
                let mut f = match features.get_mut(*id) {
                    Ok(f) => f,
                    Err(_) => continue,
                };

                if !f.is_rendered() {
                    all_rendered = false;
                    continue;
                }

                match &mut *f {
                    RenderableFeature::Billboard {
                        material,
                        transform,
                        render_info,
                        ..
                    } => {
                        if let Appearance::Billboard(mat) = &u.appearance {
                            material.update(mat, transform);
                            render_info.should_recalculate_height = true;
                        }
                    }
                    RenderableFeature::Text {
                        material,
                        render_info,
                        ..
                    } => {
                        if let Appearance::Text(mat) = &u.appearance {
                            material.update(mat);
                            render_info.should_recalculate_height = true;
                        }
                    }
                    RenderableFeature::Point {
                        material,
                        transform,
                        render_info,
                        ..
                    } => {
                        if let Appearance::Point(mat) = &u.appearance {
                            material.update(mat, transform);
                            render_info.should_recalculate_height = true;
                        }
                    }
                    RenderableFeature::Polyline {
                        material,
                        render_info,
                        ..
                    } => {
                        if let Appearance::Polyline(mat) = &u.appearance {
                            material.update(mat);
                            render_info.should_recalculate_height = true;
                        }
                    }
                    RenderableFeature::Polygon { .. } => {
                        if let Appearance::Polygon(mat) = &u.appearance {
                            commands.spawn(UpdatePolygon {
                                material: mat.clone(),
                                feature_id: *id,
                            });
                        }
                    }
                    _ => (),
                }
            }
        }
        // Sync appearances to GeoJsonTileSource for tiled layers
        for (layer, layer_res) in &layers {
            if layer.layer_id != layer_id {
                continue;
            }
            if let Some(layer_res) = layer_res
                && let Ok(mut tile_source) = tile_sources.get_mut(layer_res.source)
                && let Some(geojson_source) = tile_source.downcast_mut::<GeoJsonTileSource>()
            {
                for appearance in geojson_source.appearances.iter_mut() {
                    appearance.set(&u.appearance);
                }
            }
        }

        // Only despawn the update marker when all features have been rendered,
        // so unrendered features can be retried next frame.
        if all_rendered {
            commands.entity(e).despawn();
        }
    }
}

#[allow(clippy::type_complexity, clippy::too_many_arguments)]
pub fn delete_geo_json_layer(
    mut commands: Commands,
    mut layer_store: ResMut<LayerStore>,
    deleted: Query<(Entity, &DeleteGeoJsonLayerMarker)>,
    layers: Query<(Entity, &GeoJsonLayer, Option<&LayerResources>)>,
    batched_features: Query<
        (Entity, &LayerId, &BatchedFeature),
        (Without<RenderableFeature>, Without<VectorTileFeatureMarker>),
    >,
    // For tiled layer cleanup (passed to LayerResources::destroy):
    feature_ids: Query<(&FeatureId, &LayerId)>,
    all_batched_features: Query<&BatchedFeature>,
    mut rendered_tiles: Query<&mut RenderedTile>,
    mut qts: Query<&mut VectorTileQuadtree>,
    tc: Query<&TileCacheManager>,
    mut sources: Query<&mut VectorTileSourceResources>,
    mut source_cache: ResMut<VectorTileSourceCache>,
) {
    for (e, d) in &deleted {
        layer_store.remove(&d.0);

        for (layer_entity, layer, resource) in &layers {
            if layer.layer_id != d.0 {
                continue;
            }

            if let Some(resource) = resource {
                // Tiled path: delegate to LayerResources::destroy()
                resource.destroy(
                    layer_entity,
                    &LayerId(layer.layer_id.clone()),
                    &mut commands,
                    &mut qts,
                    &tc,
                    &feature_ids,
                    &all_batched_features,
                    &mut rendered_tiles,
                    &mut sources,
                    &mut source_cache,
                );
            }

            // Clean up direct-path BatchedFeature entities regardless of the
            // tiled path: points/billboards/texts (and non-clamped
            // polylines/polygons) always go through the direct path even when
            // the layer is tiled, so they are invisible to
            // LayerResources::destroy(). The query excludes
            // VectorTileFeatureMarker so tile-derived batches are not
            // processed twice.
            for (entity, l_id, batched) in batched_features.iter() {
                if l_id.0 == d.0 {
                    batched.despawn_recursively(&mut commands);
                    commands.entity(entity).insert(Deleted);
                }
            }
            commands.entity(layer_entity).despawn();
        }

        commands.entity(e).despawn();
    }
}

#[allow(clippy::type_complexity)]
pub fn request_geojson(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    source_store: Res<SourceStore>,
    geojson_layers: Query<(Entity, &GeoJsonLayer), Added<GeoJsonLayer>>,
) {
    for (e, l) in &geojson_layers {
        // Only URL sources need fetching; inline GeoJSON is read directly.
        if let Some(source_id) = l.source_id.as_deref()
            && let Some(Source::GeoJson(s)) = source_store.get(source_id)
            && let Some(GeoJsonData::Url(url)) = &s.data
        {
            commands.spawn((
                GeoJsonLayerDataRequesterMarker(e),
                Priority::Medium,
                DataRequester::from_store(url.clone(), &mut buf, DataRequesterExtension::GeoJson),
            ));
        }
    }
}

#[allow(clippy::type_complexity)]
pub fn parse_geojson(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut source_store: ResMut<SourceStore>,
    requesters: Query<
        (Entity, &GeoJsonLayerDataRequesterMarker, &DataRequester),
        (Changed<DataRequester>, Without<Deleted>),
    >,
    mut layers: Query<&mut GeoJsonLayer>,
) {
    for (e, marker, req) in &requesters {
        if !matches!(req.status, DataRequesterStatus::Pending) {
            commands.entity(e).despawn();
        }

        if !matches!(req.status, DataRequesterStatus::Success) {
            continue;
        }

        let geojson = buf.remove_u8(&req.handle).unwrap();
        let Ok(geojson) = GeoJson::from_reader(geojson.as_slice()) else {
            continue;
        };

        // Cache the parsed document on the source so it (and any layer sharing
        // the source) reads it live, then mark the layer changed to retrigger
        // the chained `construct_feature` / `setup_tiled_geojson` this frame.
        if let Ok(mut l) = layers.get_mut(marker.0)
            && let Some(source_id) = l.source_id.clone()
        {
            source_store.set_geojson_data(&source_id, geojson);
            l.set_changed();
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use bevy_app::{App, Update};
    use navara_vector_tile::VectorTileFeatureMarker;

    fn make_layer(layer_id: &str) -> GeoJsonLayer {
        GeoJsonLayer {
            layer_id: layer_id.to_string(),
            source_id: None,
            appearances: vec![],
            crs: None,
            dynamic_sse_scale: None,
        }
    }

    // Points/billboards/texts always render through the direct (non-tiled)
    // path even when the layer is tiled because of clamp-to-ground
    // polylines/polygons. Deleting such a layer must mark those direct-path
    // batches Deleted too, not only the tile-derived ones.
    #[test]
    fn delete_tiled_layer_cleans_up_direct_path_features() {
        let mut app = App::new();
        app.init_resource::<LayerStore>();
        app.init_resource::<VectorTileSourceCache>();
        app.add_systems(Update, delete_geo_json_layer);

        let world = app.world_mut();
        let source = world.spawn_empty().id();
        let quadtree = world.spawn_empty().id();
        let tile_cache_manager = world.spawn_empty().id();

        world.spawn((
            make_layer("layer"),
            LayerResources {
                layer_id: "layer".to_string(),
                source,
                quadtree,
                tile_cache_manager,
            },
        ));

        let direct_feature = world
            .spawn((
                LayerId("layer".to_string()),
                BatchedFeature {
                    construct_polygon_feature: None,
                    construct_polyline_feature: None,
                    default_active: true,
                },
            ))
            .id();

        // Tile-derived batches are cleaned up by LayerResources::destroy();
        // the direct-path sweep must not touch them.
        let tiled_feature = world
            .spawn((
                LayerId("layer".to_string()),
                BatchedFeature {
                    construct_polygon_feature: None,
                    construct_polyline_feature: None,
                    default_active: false,
                },
                VectorTileFeatureMarker,
            ))
            .id();

        world.spawn(DeleteGeoJsonLayerMarker("layer".to_string()));

        app.update();

        assert!(
            app.world().entity(direct_feature).contains::<Deleted>(),
            "direct-path feature must be marked Deleted when a tiled layer is removed"
        );
        assert!(
            !app.world().entity(tiled_feature).contains::<Deleted>(),
            "tile-derived feature is owned by LayerResources::destroy() and must not be double-processed"
        );
    }

    #[test]
    fn delete_non_tiled_layer_cleans_up_direct_path_features() {
        let mut app = App::new();
        app.init_resource::<LayerStore>();
        app.init_resource::<VectorTileSourceCache>();
        app.add_systems(Update, delete_geo_json_layer);

        let world = app.world_mut();
        world.spawn(make_layer("layer"));

        let direct_feature = world
            .spawn((
                LayerId("layer".to_string()),
                BatchedFeature {
                    construct_polygon_feature: None,
                    construct_polyline_feature: None,
                    default_active: true,
                },
            ))
            .id();

        world.spawn(DeleteGeoJsonLayerMarker("layer".to_string()));

        app.update();

        assert!(
            app.world().entity(direct_feature).contains::<Deleted>(),
            "direct-path feature must be marked Deleted when a non-tiled layer is removed"
        );
    }
}
