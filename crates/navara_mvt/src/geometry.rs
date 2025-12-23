use std::sync::Arc;

use bevy_ecs::{component::Component, entity::Entity, system::Commands};
use geo_types::{Geometry, LineString, MultiLineString, MultiPoint, MultiPolygon, Point, Polygon};
use geozero::mvt::{tile, Message, Tile as MvtTile};
use geozero::ToGeo;
use navara_buffer_store::BufferStore;
use navara_core::{Extent, Radians};
use navara_core::{TileXYZ, CRS};
use navara_feature_component::{
    batch::{BatchIndex, BatchTable, BatchedFeature, FeatureBatchId, GlobalBatchIds, MvtLayerData},
    billboard::{BillboardGeometry, BillboardMarker},
    id::FeatureId,
    point::{PointGeometry, PointMarker},
    polygon::{PolygonGeometry, PolygonMarker},
    polyline::{PolylineGeometry, PolylineMarker},
    text::{TextGeometry, TextMarker},
    BatchedFeatureMarker,
};
use navara_geometry::{Hierarchy, WindingOrder};
use navara_layer::LayerId;
use navara_material::Appearance;
use navara_math::{FloatType, Vec3};
use navara_tile_component::{OverscaledTileHandle, TileExtent, TileHandle};

use crate::component::MVTFeatureMarker;
use crate::pos_converter::PosConverter;

#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum ConstructedGeometryType {
    Point,
    Polyline,
    Polygon,
}

/// Process a single MVT layer and spawn entities for its features.
/// Returns the spawned batched feature entity.
#[allow(clippy::too_many_arguments)]
fn process_layer(
    commands: &mut Commands,
    batch_table: &mut BatchTable,
    buf: &mut BufferStore,
    mut layer: tile::Layer,
    xyz: TileXYZ,
    appearances: &[Appearance],
    layer_id: &str,
) -> Option<Entity> {
    let extent = layer.extent.unwrap_or(4096);
    let mut converter = PosConverter::new(xyz, extent);

    // Build MvtLayerData for lazy property parsing
    // Move keys and values directly - no clone or conversion needed
    let mvt_layer_data = MvtLayerData {
        keys: Arc::new(layer.keys),
        values: Arc::new(layer.values),
        feature_tags: Vec::with_capacity(layer.features.len()),
    };

    // Initialize batch with MVT lazy properties
    let feature_batch_id = batch_table
        .init_mvt(Some(layer_id.to_owned()), mvt_layer_data)
        .unwrap_or(0);

    let mut feature_ids: Vec<Entity> = Vec::with_capacity(layer.features.len());
    let mut global_batch_ids: Vec<u32> = Vec::with_capacity(layer.features.len());
    let mut geometry_type: Option<ConstructedGeometryType> = None;

    for feature in &mut layer.features {
        // Parse geometry using geozero's ToGeo trait
        let geom = match feature.to_geo() {
            Ok(g) => g,
            Err(_err) => continue,
        };

        let batch_idx = BatchIndex(global_batch_ids.len() as u32);

        let mut tags = Vec::with_capacity(feature.tags.len());
        tags.append(&mut feature.tags);

        // Store feature tags for lazy property parsing
        batch_table.add_mvt_feature_tags(feature_batch_id, tags);

        let batch_id = batch_table
            .init_values(Some(layer_id.to_owned()))
            .unwrap_or(0);
        global_batch_ids.push(batch_id);

        // Handle the geometry
        handle_geometry(
            commands,
            buf,
            &mut feature_ids,
            &mut geometry_type,
            &geom,
            &mut converter,
            &batch_idx,
            appearances,
        );
    }

    if feature_ids.is_empty() {
        return None;
    }

    let geometry_type = geometry_type?;
    let batch_length = global_batch_ids.len();

    let global_batch_ids = GlobalBatchIds {
        handle: buf.new_u32(global_batch_ids),
        batch_length: batch_length as u32,
    };
    let feature_batch_id = FeatureBatchId(feature_batch_id);

    // Now spawn the batched feature entity with appropriate marker
    let batched = BatchedFeature {
        features: feature_ids,
        ..Default::default()
    };

    spawn_batched_entity(
        commands,
        batched,
        geometry_type,
        appearances,
        layer_id,
        feature_batch_id,
        global_batch_ids,
    )
}

/// Spawn the batched feature entity with the appropriate marker component
fn spawn_batched_entity(
    commands: &mut Commands,
    batched: BatchedFeature,
    geometry_type: ConstructedGeometryType,
    appearances: &[Appearance],
    layer_id: &str,
    feature_batch_id: FeatureBatchId,
    global_batch_ids: GlobalBatchIds,
) -> Option<Entity> {
    fn spawn<M: Component, A: Component>(
        commands: &mut Commands,
        batched: BatchedFeature,
        layer_id: String,
        marker: M,
        appearance: A,
        feature_batch_id: FeatureBatchId,
        global_batch_ids: GlobalBatchIds,
    ) -> Entity {
        commands
            .spawn((
                marker,
                batched,
                FeatureId::default(),
                MVTFeatureMarker,
                LayerId(layer_id),
                appearance,
                feature_batch_id,
                global_batch_ids,
            ))
            .id()
    }

    match geometry_type {
        ConstructedGeometryType::Point => {
            let appearance = appearances.iter().find(|a| {
                matches!(
                    a,
                    Appearance::Point(_) | Appearance::Billboard(_) | Appearance::Text(_)
                )
            })?;

            let entity = match appearance {
                Appearance::Point(app) => spawn(
                    commands,
                    batched,
                    layer_id.to_string(),
                    PointMarker,
                    app.clone(),
                    feature_batch_id,
                    global_batch_ids,
                ),
                Appearance::Billboard(app) => spawn(
                    commands,
                    batched,
                    layer_id.to_string(),
                    BillboardMarker,
                    app.clone(),
                    feature_batch_id,
                    global_batch_ids,
                ),
                Appearance::Text(app) => spawn(
                    commands,
                    batched,
                    layer_id.to_string(),
                    TextMarker,
                    app.clone(),
                    feature_batch_id,
                    global_batch_ids,
                ),
                _ => return None,
            };
            Some(entity)
        }
        ConstructedGeometryType::Polyline => {
            let Appearance::Polyline(app) = appearances
                .iter()
                .find(|a| matches!(a, Appearance::Polyline(_)))?
            else {
                return None;
            };
            Some(spawn(
                commands,
                batched,
                layer_id.to_string(),
                PolylineMarker,
                app.clone(),
                feature_batch_id,
                global_batch_ids,
            ))
        }
        ConstructedGeometryType::Polygon => {
            let Appearance::Polygon(app) = appearances
                .iter()
                .find(|a| matches!(a, Appearance::Polygon(_)))?
            else {
                return None;
            };
            Some(spawn(
                commands,
                batched,
                layer_id.to_string(),
                PolygonMarker,
                app.clone(),
                feature_batch_id,
                global_batch_ids,
            ))
        }
    }
}

/// Main entry point: parse MVT binary and spawn entities for all layers.
/// Returns the spawned entity IDs.
///
/// If `tile_info` is provided, `OverscaledTileHandle` and `TileExtent` components
/// will be added to each spawned entity.
#[allow(clippy::too_many_arguments)]
pub fn construct_geometry(
    commands: &mut Commands,
    batch_table: &mut BatchTable,
    buf: &mut BufferStore,
    mvt_bin: Vec<u8>,
    xyz: TileXYZ,
    appearances: &[Appearance],
    limit_layers: &Option<Vec<String>>,
    layer_id: &str,
    tile_info: Option<(TileHandle, Extent<FloatType, Radians>)>,
) -> Option<Vec<Entity>> {
    // Decode MVT using prost protobuf decoder
    let tile = MvtTile::decode(mvt_bin.as_slice()).ok()?;

    let mut result = Vec::new();

    for layer in tile.layers {
        // Check layer filter
        if let Some(ll) = limit_layers {
            if !ll.contains(&layer.name) {
                continue;
            }
        }

        if let Some(entity) = process_layer(
            commands,
            batch_table,
            buf,
            layer,
            xyz,
            appearances,
            layer_id,
        ) {
            // Add tile-specific components if tile info is provided
            if let Some((tile_handle, tile_extent)) = tile_info {
                commands.entity(entity).insert((
                    OverscaledTileHandle::new(tile_handle),
                    TileExtent::new(tile_extent),
                ));
            }
            result.push(entity);
        }
    }

    if result.is_empty() {
        None
    } else {
        Some(result)
    }
}

#[allow(clippy::too_many_arguments)]
fn handle_geometry(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    geometry_type: &mut Option<ConstructedGeometryType>,
    geom: &Geometry<f64>,
    converter: &mut PosConverter,
    batch_index: &BatchIndex,
    appearances: &[Appearance],
) {
    match geom {
        Geometry::MultiPolygon(v) => {
            let Some(Appearance::Polygon(appearance)) = appearances
                .iter()
                .find(|a| matches!(a, Appearance::Polygon(_)))
            else {
                return;
            };

            *geometry_type = Some(ConstructedGeometryType::Polygon);

            let MultiPolygon(plgs) = v;
            let flat = appearance.clamp_to_ground;

            construct_polygons_geometry(
                commands,
                buf,
                feature_ids,
                plgs,
                batch_index,
                converter,
                flat,
            );
        }
        Geometry::Polygon(v) => {
            let Some(Appearance::Polygon(appearance)) = appearances
                .iter()
                .find(|a| matches!(a, Appearance::Polygon(_)))
            else {
                return;
            };

            *geometry_type = Some(ConstructedGeometryType::Polygon);
            let flat = appearance.clamp_to_ground;

            construct_polygon_geometry(commands, buf, feature_ids, v, batch_index, converter, flat);
        }
        Geometry::MultiPoint(v) => {
            *geometry_type = Some(ConstructedGeometryType::Point);
            let MultiPoint(points) = v;

            for one_appr in appearances {
                match one_appr {
                    Appearance::Point(_appearance) => {
                        construct_points_geometry(
                            commands,
                            feature_ids,
                            points,
                            converter,
                            |x, y| PointGeometry {
                                coords: Vec3::new(x, y, 0.0 as FloatType),
                                crs: CRS::Geographic,
                            },
                            batch_index,
                        );
                        break;
                    }
                    Appearance::Billboard(_appearance) => {
                        construct_points_geometry(
                            commands,
                            feature_ids,
                            points,
                            converter,
                            |x, y| BillboardGeometry {
                                coords: Vec3::new(x, y, 0.0 as FloatType),
                                crs: CRS::Geographic,
                            },
                            batch_index,
                        );
                        break;
                    }
                    Appearance::Text(_appearance) => {
                        construct_points_geometry(
                            commands,
                            feature_ids,
                            points,
                            converter,
                            |x, y| TextGeometry {
                                coords: Vec3::new(x, y, 0.0 as FloatType),
                                crs: CRS::Geographic,
                            },
                            batch_index,
                        );
                        break;
                    }
                    _ => {}
                };
            }
        }
        Geometry::Point(point) => {
            *geometry_type = Some(ConstructedGeometryType::Point);

            for one_appr in appearances {
                match one_appr {
                    Appearance::Point(_appearance) => {
                        construct_point_geometry(
                            commands,
                            feature_ids,
                            point,
                            converter,
                            &|x, y| PointGeometry {
                                coords: Vec3::new(x, y, 0.0 as FloatType),
                                crs: CRS::Geographic,
                            },
                            batch_index,
                        );
                        break;
                    }
                    Appearance::Billboard(_appearance) => {
                        construct_point_geometry(
                            commands,
                            feature_ids,
                            point,
                            converter,
                            &|x, y| BillboardGeometry {
                                coords: Vec3::new(x, y, 0.0 as FloatType),
                                crs: CRS::Geographic,
                            },
                            batch_index,
                        );
                        break;
                    }
                    Appearance::Text(_appearance) => {
                        construct_point_geometry(
                            commands,
                            feature_ids,
                            point,
                            converter,
                            &|x, y| TextGeometry {
                                coords: Vec3::new(x, y, 0.0 as FloatType),
                                crs: CRS::Geographic,
                            },
                            batch_index,
                        );
                        break;
                    }
                    _ => {}
                };
            }
        }
        Geometry::MultiLineString(v) => {
            let Some(Appearance::Polyline(appearance)) = appearances
                .iter()
                .find(|a| matches!(a, Appearance::Polyline(_)))
            else {
                return;
            };

            *geometry_type = Some(ConstructedGeometryType::Polyline);
            let flat = appearance.clamp_to_ground;
            let MultiLineString(lines) = v;

            construct_lines_geometry(
                commands,
                buf,
                feature_ids,
                lines,
                batch_index,
                converter,
                flat,
            );
        }
        Geometry::LineString(line) => {
            let Some(Appearance::Polyline(appearance)) = appearances
                .iter()
                .find(|a| matches!(a, Appearance::Polyline(_)))
            else {
                return;
            };

            *geometry_type = Some(ConstructedGeometryType::Polyline);
            let flat = appearance.clamp_to_ground;

            construct_line_geometry(
                commands,
                buf,
                feature_ids,
                line,
                batch_index,
                converter,
                flat,
            );
        }
        Geometry::GeometryCollection(geoms) => {
            for geom in &geoms.0 {
                handle_geometry(
                    commands,
                    buf,
                    feature_ids,
                    geometry_type,
                    geom,
                    converter,
                    batch_index,
                    appearances,
                );
            }
        }
        _ => {}
    };
}

#[allow(clippy::too_many_arguments)]
fn construct_points_geometry<G: Component, F>(
    commands: &mut Commands,
    feature_ids: &mut Vec<Entity>,
    points: &[Point<f64>],
    converter: &mut PosConverter,
    geometry: F,
    batch_index: &BatchIndex,
) where
    F: Fn(FloatType, FloatType) -> G,
{
    for point in points {
        construct_point_geometry(
            commands,
            feature_ids,
            point,
            converter,
            &geometry,
            batch_index,
        );
    }
}

#[allow(clippy::too_many_arguments)]
fn construct_point_geometry<G: Component, F>(
    commands: &mut Commands,
    feature_ids: &mut Vec<Entity>,
    point: &Point<f64>,
    converter: &mut PosConverter,
    geometry: &F,
    batch_index: &BatchIndex,
) where
    F: Fn(FloatType, FloatType) -> G,
{
    let (x, y) = converter.project_point(point.x(), point.y());

    let e = commands
        .spawn((
            BatchedFeatureMarker,
            geometry(x, y),
            BatchIndex(batch_index.0),
        ))
        .id();

    feature_ids.push(e);
}

#[allow(clippy::too_many_arguments)]
fn construct_lines_geometry(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    lines: &[LineString<f64>],
    batch_index: &BatchIndex,
    converter: &mut PosConverter,
    flat: bool,
) -> usize {
    let mut count = 0;
    for line in lines {
        construct_line_geometry(
            commands,
            buf,
            feature_ids,
            line,
            batch_index,
            converter,
            flat,
        );
        count += line.0.len();
    }
    count
}

#[allow(clippy::too_many_arguments)]
fn construct_line_geometry(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    line: &LineString<f64>,
    batch_index: &BatchIndex,
    converter: &mut PosConverter,
    flat: bool,
) {
    let geo_points = if flat {
        converter.project_points_on_center(&line.0)
    } else {
        converter.project_points(&line.0)
    };

    if geo_points.is_empty() {
        return;
    }

    let e = commands
        .spawn((
            BatchedFeatureMarker,
            PolylineGeometry::with_buf(buf, geo_points, CRS::Geographic),
            BatchIndex(batch_index.0),
        ))
        .id();

    feature_ids.push(e);
}

#[allow(clippy::too_many_arguments)]
fn construct_polygons_geometry(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    polygons: &[Polygon<f64>],
    batch_index: &BatchIndex,
    converter: &mut PosConverter,
    flat: bool,
) {
    for polygon in polygons {
        construct_polygon_geometry(
            commands,
            buf,
            feature_ids,
            polygon,
            batch_index,
            converter,
            flat,
        );
    }
}

#[allow(clippy::too_many_arguments)]
fn construct_polygon_geometry(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    polygon: &Polygon<f64>,
    batch_index: &BatchIndex,
    converter: &mut PosConverter,
    flat: bool,
) {
    let outer_vec = if flat {
        converter.project_points_on_center(&polygon.exterior().0)
    } else {
        converter.project_points(&polygon.exterior().0)
    };

    let interiors = polygon.interiors();
    let mut holes: Vec<Hierarchy> = Vec::new();

    // In the MVT spec, the outer ring of a polygon is clockwise,
    // which is based on the origin being at the top-left.
    for interior in interiors {
        holes.push(Hierarchy {
            outer_ring: if flat {
                converter.project_points_on_center(&interior.0)
            } else {
                converter.project_points(&interior.0)
            },
            holes: None,
            expected_winding_order: if flat {
                WindingOrder::Clockwise
            } else {
                WindingOrder::CounterClockwise
            },
        });
    }

    if outer_vec.is_empty() {
        return;
    }

    let entity = commands.spawn((
        BatchedFeatureMarker,
        PolygonGeometry {
            hierarchy: Hierarchy {
                outer_ring: outer_vec,
                holes: Some(holes),
                expected_winding_order: if flat {
                    WindingOrder::CounterClockwise
                } else {
                    WindingOrder::Clockwise
                },
            }
            .transfer(buf),
            crs: CRS::Geographic,
        },
        BatchIndex(batch_index.0),
    ));

    feature_ids.push(entity.id());
}
