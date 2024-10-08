use bevy_ecs::prelude::*;
use navara_core::{xyz_to_vec3, Angle, Meters, CRS, LLE, WGS84_32};
use navara_feature::{polygon::UpdatePolygon, render::RenderableFeature};
use navara_layer::{LayerDescription, LayerId, LayerStore};
use navara_material::Appearance;
use navara_math::{Quat, Transform, Vec3};

#[derive(Debug, Clone, PartialEq, Event)]
pub struct AddLayerEvent(pub LayerDescription);

#[derive(Debug, Clone, PartialEq, Event)]
pub struct UpdateLayerEvent {
    pub layer_id: LayerId,
    pub appearance: Appearance,
}

pub fn process_add_events(mut commands: Commands, mut events: EventReader<AddLayerEvent>) {
    for ev in events.read() {
        let AddLayerEvent(desc) = ev;
        match desc {
            LayerDescription::Tiles(t) => {
                commands.spawn(t.clone());
            }
            LayerDescription::Terrain(t) => {
                commands.spawn(t.clone());
            }
            LayerDescription::GeoJson(t) => {
                commands.spawn(t.clone());
            }
        }
    }
}

pub fn process_update_events(
    mut commands: Commands,
    layer_store: Res<LayerStore>,
    mut events: EventReader<UpdateLayerEvent>,
    mut features: Query<&mut RenderableFeature>,
) {
    for ev in events.read() {
        let entities = layer_store.map.get(&ev.layer_id);
        if let Some(vec) = entities {
            for entity in vec {
                if let Ok(mut feature) = features.get_mut(*entity) {
                    match &mut *feature {
                        RenderableFeature::Billboard {
                            coordinates,
                            crs,
                            material,
                            transform,
                            ..
                        } => {
                            if let Appearance::Billboard(mat) = &ev.appearance {
                                *material = mat.clone();
                                *transform = calc_transform(
                                    coordinates,
                                    crs,
                                    material.height,
                                    material.size,
                                    false,
                                );
                            }
                        }
                        RenderableFeature::Point {
                            coordinates,
                            crs,
                            material,
                            transform,
                            ..
                        } => {
                            if let Appearance::Point(mat) = &ev.appearance {
                                *material = mat.clone();
                                *transform = calc_transform(
                                    coordinates,
                                    crs,
                                    material.height,
                                    material.size,
                                    false,
                                );
                            }
                        }
                        RenderableFeature::Model {
                            coordinates,
                            crs,
                            material,
                            transform,
                            ..
                        } => {
                            if let Appearance::Model(mat) = &ev.appearance {
                                *material = mat.clone();
                                *transform = calc_transform(
                                    coordinates,
                                    crs,
                                    material.height,
                                    material.size,
                                    true,
                                );
                            }
                        }
                        RenderableFeature::Polyline { material, .. } => {
                            if let Appearance::Polyline(mat) = &ev.appearance {
                                *material = mat.clone();
                            }
                        }
                        RenderableFeature::Polygon { .. } => {
                            // TODO
                            // 1. ポリゴン更新用のシステムを作る
                            // 2. clamp_to_groundが更新されたらmin_max_heightsも更新
                            // 3. terrainの高さに応じてMax Heightを更新
                            if let Appearance::Polygon(mat) = &ev.appearance {
                                commands.spawn(UpdatePolygon {
                                    material: mat.clone(),
                                    feature_id: *entity,
                                });
                            }
                        }
                        _ => (),
                    };
                }
            }
        }
    }
}

fn calc_transform(
    coordinates: &Vec3,
    crs: &CRS,
    m_height: f32,
    m_size: f32,
    need_rotate: bool,
) -> Transform {
    let position = match crs {
        CRS::Geographic => {
            let lng = coordinates.x;
            let lat = coordinates.y;
            let height = coordinates.z;

            xyz_to_vec3(
                LLE {
                    lng: Angle::new(lng),
                    lat: Angle::new(lat),
                    height: Meters::new(height + m_height),
                }
                .rad()
                .to_xyz(WGS84_32),
            )
        }
        CRS::Geocentric => unimplemented!(),
        CRS::ESPG { code: _ } => unimplemented!(),
    };

    let mut transform =
        Transform::from_translation(position).with_scale(Vec3::new(m_size, m_size, m_size));

    if need_rotate {
        let lng = coordinates.x.to_radians();
        let lat = coordinates.y.to_radians();
        let rotation_y = Quat::from_rotation_y(-lat);
        let rotation_z = Quat::from_rotation_z(lng);
        let rotation = rotation_z * rotation_y;
        transform = transform.with_rotation(rotation);
    }

    transform
}
