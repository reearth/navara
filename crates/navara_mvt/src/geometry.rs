use bevy_ecs::{component::Component, entity::Entity, system::Commands};
use navara_buffer_store::BufferStore;
use navara_core::{TileXYZ, CRS};
use navara_feature_component::{
    batch::{
        BatchIndex, BatchTable, FeatureBatchId, GlobalBatchIdAndSelections, IdPropertySelections,
        IdPropertyTable,
    },
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
use navara_parser::mvt::{
    self,
    geometry::{CoordinateStorage, FlatCoordinateStorage3D, Geometry, GeometryIterator},
};

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
    pub global_batch_id_and_selections: GlobalBatchIdAndSelections,
}

// TODO: Store the coordinates into BufferStore.
// TODO: Move this process to worker.
#[allow(clippy::too_many_arguments)]
pub fn construct_geometry(
    commands: &mut Commands,
    batch_table: &mut BatchTable,
    id_prop_table_res: &mut IdPropertyTable,
    buf: &mut BufferStore,
    mvt_bin: Vec<u8>,
    id_prop_sel_res: &IdPropertySelections,
    xyz: TileXYZ,
    appearances: &[Appearance],
    limit_layers: &Option<Vec<String>>,
) -> Option<Vec<ConstructedGeometry>> {
    let mut result = vec![];

    let reader = mvt::MvtReader::new(mvt_bin).ok()?;
    let layer_names = reader.get_layer_names().ok()?;

    let flat = appearances.iter().any(|a| {
        let Appearance::Polygon(a) = a else {
            return false;
        };
        a.clamp_to_ground
    });

    for (index, name) in layer_names.iter().enumerate() {
        let extent = reader.get_extent(index);
        let converter = PosConverter::new(xyz, extent, flat);
        let features = match reader.get_features_iter(index, converter) {
            Some(f) => f,
            None => continue,
        };

        if let Some(ll) = limit_layers {
            if !ll.contains(name) {
                continue;
            }
        }

        // Assume a feature has only one type of geometry.
        let mut geometry_type = Option::None;

        let mut feature_ids = vec![];

        let feature_batch_id = batch_table.init_values().unwrap_or(0);
        let mut global_batch_id_and_selections: Vec<u32> = vec![];

        for mut feature in features {
            let props = feature
                .properties
                .take()
                .map(serde_json::Value::Object)
                .unwrap_or(serde_json::Value::Null);
            let geom = feature.geometry;

            let batch_idx = BatchIndex((global_batch_id_and_selections.len() / 2) as u32);

            handle_geometry(
                commands,
                buf,
                &mut feature_ids,
                &mut geometry_type,
                geom,
                // For batched feature
                &batch_idx,
                appearances,
            );

            let id_prop = get_id_property(geometry_type.as_ref(), appearances);
            let batch_id = batch_table
                .add_id_prop(id_prop, &props, id_prop_table_res)
                .unwrap_or(0);
            batch_table.add_values(feature_batch_id, props);
            global_batch_id_and_selections.push(batch_id);
            global_batch_id_and_selections
                .push(batch_table.get_selection(&batch_id, id_prop_sel_res));
        }

        if feature_ids.is_empty() {
            continue;
        }

        let batch_length = global_batch_id_and_selections.len() / 2;

        result.push(ConstructedGeometry {
            feature_ids,
            geometry_type: geometry_type.unwrap(),
            feature_batch_id: FeatureBatchId(feature_batch_id),
            global_batch_id_and_selections: GlobalBatchIdAndSelections {
                handle: buf.new_u32(global_batch_id_and_selections),
                batch_length: batch_length as u32,
            },
        });
    }

    Some(result)
}

fn get_id_property(
    geom: Option<&ConstructedGeometryType>,
    appearances: &[Appearance],
) -> Option<String> {
    match geom? {
        ConstructedGeometryType::Polygon => {
            match appearances
                .iter()
                .find(|a| matches!(a, Appearance::Polygon(_)))
            {
                Some(Appearance::Polygon(a)) => Some(a.id_property.clone()),
                _ => None,
            }
        }
        ConstructedGeometryType::Point => {
            match appearances
                .iter()
                .find(|a| matches!(a, Appearance::Point(_)))
            {
                Some(Appearance::Point(a)) => Some(a.id_property.clone()),
                _ => None,
            }
        }
        ConstructedGeometryType::Polyline => {
            match appearances
                .iter()
                .find(|a| matches!(a, Appearance::Polyline(_)))
            {
                Some(Appearance::Polyline(a)) => Some(a.id_property.clone()),
                _ => None,
            }
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn handle_geometry(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    geometry_type: &mut Option<ConstructedGeometryType>,
    geoms: GeometryIterator<'_, FlatCoordinateStorage3D, PosConverter>,
    batch_index: &BatchIndex,
    appearances: &[Appearance],
) {
    for geom in geoms {
        let Ok(geom) = geom else {
            continue;
        };
        match geom {
            Geometry::Polygon { exterior, holes } => {
                let Some(Appearance::Polygon(appearance)) = appearances
                    .iter()
                    .find(|a| matches!(a, Appearance::Polygon(_)))
                else {
                    return;
                };

                *geometry_type = Some(ConstructedGeometryType::Polygon);

                let flat = appearance.clamp_to_ground;

                construct_polygon_geometry(
                    commands,
                    buf,
                    feature_ids,
                    exterior,
                    holes,
                    batch_index,
                    flat,
                );
            }
            Geometry::Point { x, y } => {
                *geometry_type = Some(ConstructedGeometryType::Point);

                for one_appr in appearances {
                    match one_appr {
                        Appearance::Point(_appearance) => {
                            construct_point_geometry(
                                commands,
                                feature_ids,
                                x,
                                y,
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
                                x,
                                y,
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
                                x,
                                y,
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
            Geometry::LineString(line) => {
                if !appearances
                    .iter()
                    .any(|a| matches!(a, Appearance::Polyline(_)))
                {
                    return;
                }

                *geometry_type = Some(ConstructedGeometryType::Polyline);

                construct_line_geometry(commands, buf, feature_ids, line, batch_index);
            }
            _ => {}
        };
    }
}

#[allow(clippy::too_many_arguments)]
fn construct_point_geometry<G: Component, F>(
    commands: &mut Commands,
    feature_ids: &mut Vec<Entity>,
    x: f32,
    y: f32,
    geometry: &F,
    batch_index: &BatchIndex,
) where
    F: Fn(FloatType, FloatType) -> G,
{
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
fn construct_line_geometry(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    line: FlatCoordinateStorage3D,
    batch_index: &BatchIndex,
) {
    let geo_points = line.into_transformed_vec();

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
fn construct_polygon_geometry(
    commands: &mut Commands,
    buf: &mut BufferStore,
    feature_ids: &mut Vec<Entity>,
    exterior: FlatCoordinateStorage3D,
    holes: Vec<FlatCoordinateStorage3D>,
    batch_index: &BatchIndex,
    flat: bool,
) {
    let outer_vec = exterior.into_transformed_vec();

    let interiors = holes;
    let mut holes: Vec<Hierarchy> = Vec::new();

    // In the MVT spec, it is mentioned that the outer ring of a polygon is clockwise,
    // which is based on the origin being at the top-left.
    for hole in interiors {
        holes.push(Hierarchy {
            outer_ring: hole.into_transformed_vec(),
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
