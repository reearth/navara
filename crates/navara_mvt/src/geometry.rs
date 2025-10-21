use bevy_ecs::{component::Component, entity::Entity, system::Commands};
use geo_types::{Geometry, LineString, MultiLineString, MultiPoint, MultiPolygon, Point, Polygon};
use navara_buffer_store::BufferStore;
use navara_core::{TileXYZ, CRS};
use navara_feature_component::{
    batch::{BatchIndex, BatchTable, FeatureBatchId, GlobalBatchIds},
    billboard::BillboardGeometry,
    point::PointGeometry,
    polygon::PolygonGeometry,
    polyline::PolylineGeometry,
    text::TextGeometry,
    BatchedFeatureMarker,
};
use navara_geometry::{Hierarchy, WindingOrder};
use navara_material::Appearance;
use navara_math::{FloatType, Vec3};
use navara_parser::mvt;

use crate::pos_converter::PosConverter;

#[derive(Clone, Copy)]
pub(crate) enum ConstructedGeometryType {
    Point,
    Polyline,
    Polygon,
}

pub(crate) struct ConstructedGeometry {
    pub feature_ids: Vec<Entity>,
    pub geometry_type: ConstructedGeometryType,
    pub feature_batch_id: FeatureBatchId,
    pub global_batch_ids: GlobalBatchIds,
}

// TODO: Store the coordinates into BufferStore.
// TODO: Move this process to worker.
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
) -> Option<Vec<ConstructedGeometry>> {
    let mut result = vec![];

    let reader = mvt::MvtReader::new(mvt_bin).ok()?;
    let layer_names = reader.get_layer_names().ok()?;

    for (index, name) in layer_names.iter().enumerate() {
        let extent = reader.get_extent(index);
        let mut converter = PosConverter::new(xyz, extent);
        let features = match reader.get_features(index) {
            Ok(f) => f,
            Err(_) => continue,
        };

        if let Some(ll) = limit_layers {
            if !ll.contains(name) {
                continue;
            }
        }

        // Assume a feature has only one type of geometry.
        let mut geometry_type = Option::None;

        let mut feature_ids = vec![];

        let feature_batch_id = batch_table
            .init_values(Some(layer_id.to_owned()))
            .unwrap_or(0);
        let mut global_batch_ids: Vec<u32> = vec![];

        for feature in features {
            let geom = feature.get_geometry();
            let props = feature
                .properties
                .as_ref()
                .and_then(|props| serde_json::to_value(props).ok())
                .unwrap_or(serde_json::Value::Null);

            let batch_idx = BatchIndex(global_batch_ids.len() as u32);

            let batch_id = batch_table
                .init_values(Some(layer_id.to_owned()))
                .unwrap_or(0);

            batch_table.add_values(feature_batch_id, props);

            global_batch_ids.push(batch_id);

            handle_geometry(
                commands,
                buf,
                &mut feature_ids,
                &mut geometry_type,
                geom,
                &mut converter,
                // For batched feature
                &batch_idx,
                appearances,
            );
        }

        if feature_ids.is_empty() {
            continue;
        }

        let batch_length = global_batch_ids.len();

        result.push(ConstructedGeometry {
            feature_ids,
            geometry_type: geometry_type.unwrap(),
            feature_batch_id: FeatureBatchId(feature_batch_id),
            global_batch_ids: GlobalBatchIds {
                handle: buf.new_u32(global_batch_ids),
                batch_length: batch_length as u32,
            },
        });
    }

    Some(result)
}

#[allow(clippy::too_many_arguments)]
fn handle_geometry(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    geometry_type: &mut Option<ConstructedGeometryType>,
    geom: &Geometry<f32>,
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
            if !appearances
                .iter()
                .any(|a| matches!(a, Appearance::Polyline(_)))
            {
                return;
            }

            *geometry_type = Some(ConstructedGeometryType::Polyline);

            let MultiLineString(lines) = v;

            construct_lines_geometry(commands, buf, feature_ids, lines, batch_index, converter);
        }
        Geometry::LineString(line) => {
            if !appearances
                .iter()
                .any(|a| matches!(a, Appearance::Polyline(_)))
            {
                return;
            }

            *geometry_type = Some(ConstructedGeometryType::Polyline);

            construct_line_geometry(commands, buf, feature_ids, line, batch_index, converter);
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
    points: &[Point<f32>],
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
    point: &Point<f32>,
    converter: &mut PosConverter,
    geometry: &F,
    batch_index: &BatchIndex,
) where
    F: Fn(FloatType, FloatType) -> G,
{
    let Point(pt) = point;
    let (x, y) = converter.project_point(pt);

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
    lines: &[LineString<f32>],
    batch_index: &BatchIndex,
    converter: &mut PosConverter,
) -> usize {
    let mut count = 0;
    for line in lines {
        construct_line_geometry(commands, buf, feature_ids, line, batch_index, converter);
        count += line.0.len();
    }

    count
}

#[allow(clippy::too_many_arguments)]
fn construct_line_geometry(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    line: &LineString<f32>,
    batch_index: &BatchIndex,
    converter: &mut PosConverter,
) {
    let LineString(points) = line;
    let geo_points = converter.project_points(points);

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
    polygons: &[Polygon<f32>],
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
    polygon: &Polygon<f32>,
    batch_index: &BatchIndex,
    converter: &mut PosConverter,
    flat: bool,
) {
    let LineString(outer) = polygon.exterior();
    let outer_vec = if flat {
        converter.project_points_on_center(outer)
    } else {
        converter.project_points(outer)
    };

    let interiors = polygon.interiors();
    let mut holes: Vec<Hierarchy> = Vec::new();

    // In the MVT spec, it is mentioned that the outer ring of a polygon is clockwise,
    // which is based on the origin being at the top-left.
    for LineString(hole) in interiors {
        holes.push(Hierarchy {
            outer_ring: if flat {
                converter.project_points_on_center(hole)
            } else {
                converter.project_points(hole)
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
