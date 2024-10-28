use bevy_ecs::{
    entity::Entity,
    query::{Added, Changed},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_core::CRS;
use navara_data_requester::{DataRequester, DataRequesterExtension, DataRequesterStatus};
use navara_feature::polygon::PolygonGeometry;
use navara_layer::{MvtLayer, LayerId};
use navara_geometry::Hierarchy;
use navara_material::Appearance;
use navara_math::{Quat, Transform, FloatType, Vec3, PI_OVER_TWO};
use navara_parser::mvt;
use geo_types::{Geometry, MultiPolygon, LineString};
use regex::Regex;
use bevy_log::info;

use super::requester::MvtDataRequesterMarker;

pub fn request_mvt(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mvt_layers: Query<(Entity, &MvtLayer), Added<MvtLayer>>,
) {
    
    for (e, layer) in &mvt_layers {
        commands.spawn((
            MvtDataRequesterMarker(e),
            DataRequester::from_store(
                layer.data.as_ref().unwrap().url.clone(),
                &mut buf,
                DataRequesterExtension::Mvt,
            ),
        ));
    }
}

fn get_tile_pos_from_url(url: &str) -> Option<(i32, i32, i32)> {
    // Define a regular expression to match the three numbers in the URL
    let re = Regex::new(r"/(\d+)/(\d+)/(\d+)\.mvt$").unwrap();
    
    if let Some(captures) = re.captures(url) {
        // Parse and assign the three values to z, x, and y respectively
        let z: i32 = captures[1].parse().ok()?;
        let x: i32 = captures[2].parse().ok()?;
        let y: i32 = captures[3].parse().ok()?;

        // Return (x, y, z)
        Some((x, y, z))
    } else {
        None
    }
}

pub fn construct_mvt(
    mut commands: Commands,
    buf: ResMut<BufferStore>,
    requesters: Query<(&MvtDataRequesterMarker, &DataRequester), Changed<DataRequester>>,
    mvt_layers: Query<(Entity, &MvtLayer)>,
) {
    for (marker, req) in &requesters {
        // TODO: Handle fail
        if !matches!(req.status, DataRequesterStatus::Success) {
            continue;
        }
        let (_, layer) = match mvt_layers.get(marker.0) {
            Ok(l) => l,
            Err(_) => unreachable!(),
        };

        let appearance = match &layer.appearances[0] {
            Appearance::Polygon(m) => m.clone(),
            _ => unimplemented!(),
        };

        let mut x = 0;
        let mut y = 0;
        let mut z = 0;
        match get_tile_pos_from_url(layer.data.as_ref().unwrap().url.as_str()) {
            Some((parsed_x, parsed_y, parsed_z)) => {
                x = parsed_x;
                y = parsed_y;
                z = parsed_z;
            }
            None => {
                continue;
            }
        }

        if let Some(mvt_bin) = buf.get_u8(&req.handle){
            if let Ok(reader) = mvt::MvtReader::new((*mvt_bin).to_vec()) {
                if let Ok(layer_names) = reader.get_layer_names(){
                    for (index, _name) in layer_names.iter().enumerate() {
                        if let Ok(features) = reader.get_features(index){
                            
                            for feature in features{
                                let geom = feature.get_geometry();
                                match geom {
                                    Geometry::MultiPolygon(a) => {
                                        let MultiPolygon(b) = a;
                                        for polygon in b {
                                            let LineString(outer) = polygon.exterior();
                                            let mut outer_vec = Vec::new();
                                            for pt in outer {
                                                let x = pt.x / 131072.0 * 10.0;
                                                let y = pt.y / 131072.0 * 10.0;
                                                outer_vec.push(Vec3::new(x as FloatType, y as FloatType, 0.0 as FloatType));
                                            }

                                            // TODO: holes are not support yet
                                            // let holes = polygon.interiors();
                                            // info!("holes.len {}", holes.len());

                                            commands.spawn((
                                                LayerId(layer.layer_id.to_owned()),
                                                PolygonGeometry {
                                                    hierarchy: Hierarchy {
                                                        outer_ring: outer_vec,
                                                        holes: std::vec::Vec::new(),
                                                    },
                                                    crs: CRS::Geographic,
                                                },
                                                appearance.clone(),
                                            ));
                                        }
                                    },
                                    _ => {}
                                }
                            }

                        }
                    }                    
                } 
            }
        }
    }
}
