use bevy_ecs::{
    entity::Entity,
    query::{Added, Without},
    system::{Commands, Query, ResMut},
};
use navara_buffer_store::BufferStore;
use navara_core::{Aabb, Extent, Radians, CRS, WGS84_32};
use navara_geometry::{
    create_polygon_geometry, FloatAttribute, Hierarchy, PolygonGeometryAttributes,
    PolygonGeometryOptions, PolygonGeometryResult, PolygonResource, TransferableFloatAttribute,
    WindingOrder,
};
use navara_layer::{LayerId, LayerStore};
use navara_material::{PolygonInternalMaterial, PolygonMaterial};
use navara_math::{FloatType, Transform, Vec3};
use navara_tile_component::{sample_terrain_height_within_extent, TileMeshMarker, TileQuadtree};

use crate::render::{PolygonRenderInformation, RenderableFeature, TransferablePolygonGeometry};

use super::{BatchId, BatchedFeature, PolygonGeometry, PolygonMarker, UpdatePolygon};

fn to_transferable_geometry(
    buf: &mut ResMut<BufferStore>,
    geo: navara_geometry::PolygonGeometry,
) -> TransferablePolygonGeometry {
    let position = buf.new_f32(geo.attributes.position.data);
    let normal = geo.attributes.normal.map(|n| (buf.new_f32(n.data), n.size));
    let scale_normal_and_cap = geo
        .attributes
        .scale_normal_and_cap
        .map(|n| (buf.new_f32(n.data), n.size));
    let indices = buf.new_u32(geo.indices);

    TransferablePolygonGeometry {
        position: TransferableFloatAttribute {
            data: position,
            size: geo.attributes.position.size,
        },
        normal: normal.map(|(normal, size)| TransferableFloatAttribute { data: normal, size }),
        scale_normal_and_cap: scale_normal_and_cap.map(|(scale_normal_and_cap, size)| {
            TransferableFloatAttribute {
                data: scale_normal_and_cap,
                size,
            }
        }),
        indices,
    }
}

#[allow(clippy::type_complexity)]
pub fn transfer_batched_mesh(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut polygon: Query<
        (
            Entity,
            &LayerId,
            &mut PolygonGeometry,
            &PolygonMaterial,
            &BatchId,
        ),
        (Added<PolygonGeometry>,),
    >,
    batched_features: Query<&BatchedFeature, Added<BatchedFeature>>,
    mut polygon_resource: ResMut<PolygonResource>,
    mut layer_store: ResMut<LayerStore>,
) {
    for batched_feature in &batched_features {
        let mut extent_vec = Vec::new();
        let mut material_opt: Option<PolygonMaterial> = None;
        let mut entity_opt: Option<Entity> = None;
        let mut layer_id_opt: Option<LayerId> = None;
        let mut combined_attributes = PolygonGeometryAttributes {
            position: FloatAttribute::new(vec![], 3),
            normal: Some(FloatAttribute::new(vec![], 3)),
            scale_normal_and_cap: Some(FloatAttribute::new(vec![], 4)),
            batch_id: Some(FloatAttribute::new(vec![], 1)),
        };
        let mut indices = Vec::new();
        let mut index_offset = 0;

        for feature_id in &batched_feature.features {
            let feature = polygon.get_mut(*feature_id);
            match feature {
                Ok((entity, layer_id, mut geometry, material, batch_id)) => {
                    if material_opt.is_none() {
                        material_opt = Some(material.clone());
                    }
                    if entity_opt.is_none() {
                        entity_opt = Some(entity);
                    }
                    if layer_id_opt.is_none() {
                        layer_id_opt = Some(layer_id.clone());
                    }

                    let (extent_opt, polygon_result_opt) =
                        triangulate_one_polygon(&mut geometry, material, &mut polygon_resource);

                    if let (Some(extent), Some(mut polygon_result)) = (extent_opt, polygon_result_opt) {
                        extent_vec.push(extent);

                        let position_length =
                            polygon_result.geometry.attributes.position.data.len() / 3;
                        if position_length > 0 {
                            combined_attributes
                                .position
                                .data
                                .append(&mut polygon_result.geometry.attributes.position.data);
                            combined_attributes.normal.as_mut().unwrap().data.append(
                                &mut polygon_result.geometry.attributes.normal.unwrap().data,
                            );
                            combined_attributes
                                .scale_normal_and_cap
                                .as_mut()
                                .unwrap()
                                .data
                                .append(
                                    &mut polygon_result
                                        .geometry
                                        .attributes
                                        .scale_normal_and_cap
                                        .unwrap()
                                        .data,
                                );

                            combined_attributes.batch_id.as_mut().unwrap().data.extend(
                                std::iter::repeat(batch_id.0 as FloatType)
                                    .take(position_length),
                            );

                            if index_offset == 0 {
                                indices.append(&mut polygon_result.geometry.indices);
                            } else {
                                let mut new_indices = polygon_result
                                    .geometry
                                    .indices
                                    .into_iter()
                                    .map(|i| i + index_offset)
                                    .collect::<Vec<_>>();
                                indices.append(&mut new_indices);
                            }

                            index_offset += position_length as u32;
                        }
                    }
                }
                Err(_e) => {}
            }
        }

        if !extent_vec.is_empty() {
            let mut combined_extent = extent_vec[0];
            for extent in extent_vec.iter().skip(1) {
                combined_extent = combined_extent.union(*extent);
            }

            let mut material = material_opt.unwrap();
            material.internal = Some(PolygonInternalMaterial {
                min_max_heights: vec![0., 0.],
            });

            let aabb = Aabb::from_extent_f32(combined_extent, 0., 0.);
            let surface_point = WGS84_32.scale_to_geodetic_surface(aabb.center);

            let entity = commands.spawn((
                PolygonMarker,
                RenderableFeature::Polygon {
                    // TODO: Calculate coordinate to update transform
                    coordinates: Vec3::new(0., 0., 0.),
                    crs: CRS::Geocentric,
                    material,
                    geometry: to_transferable_geometry(
                        &mut buf,
                        navara_geometry::PolygonGeometry {
                            attributes: combined_attributes.clone(),
                            indices: indices.clone(),
                        },
                    ),
                    transform: Transform::default(),
                    feature_id: None,
                    render_info: PolygonRenderInformation {
                        should_recalculate_height: true,
                        distance_to_center_from_ellipsoid_surface: -aabb
                            .center
                            .distance(surface_point.unwrap()),
                    },
                    extent: combined_extent,
                },
            ));

            layer_store.add(layer_id_opt.unwrap().0, entity.id());
        }
    }
}

#[allow(clippy::type_complexity)]
pub fn transfer_mesh(
    mut commands: Commands,
    mut buf: ResMut<BufferStore>,
    mut polygon: Query<
        (Entity, &LayerId, &mut PolygonGeometry, &PolygonMaterial),
        (Added<PolygonGeometry>, Without<BatchId>),
    >,
    mut polygon_resource: ResMut<PolygonResource>,
    mut layer_store: ResMut<LayerStore>,
) {
    for (entity, layer_id, mut geometry, material) in &mut polygon {
        let (extent_opt, polygon_result_opt) =
            triangulate_one_polygon(&mut geometry, material, &mut polygon_resource);
        if let (Some(extent), Some(polygon_result)) = (extent_opt, polygon_result_opt) {
            let mut material = material.clone();
            material.internal = Some(PolygonInternalMaterial {
                min_max_heights: vec![0., 0.],
            });

            let aabb = Aabb::from_extent_f32(extent, 0., 0.);
            let surface_point = WGS84_32.scale_to_geodetic_surface(aabb.center);

            // TODO: Don't forget removing the stored data from BufferStore when the feature is removed.
            let entity: bevy_ecs::system::EntityCommands<'_> = commands.spawn((
                PolygonMarker,
                RenderableFeature::Polygon {
                    // TODO: Calculate coordinate to update transform
                    coordinates: Vec3::new(0., 0., 0.),
                    crs: CRS::Geocentric,
                    material,
                    geometry: to_transferable_geometry(&mut buf, polygon_result.geometry),
                    transform: Transform::default(),
                    feature_id: Some(entity),
                    render_info: PolygonRenderInformation {
                        should_recalculate_height: true,
                        distance_to_center_from_ellipsoid_surface: -aabb
                            .center
                            .distance(surface_point.unwrap()),
                    },
                    extent,
                },
            ));

            layer_store.add(layer_id.0.clone(), entity.id());
        }
    }
}

pub fn update_polygon(
    mut commands: Commands,
    updated_polygons: Query<(Entity, &UpdatePolygon), Added<UpdatePolygon>>,
    mut features: Query<&mut RenderableFeature>,
) {
    for (e, updated) in &updated_polygons {
        let mut f = match features.get_mut(updated.feature_id) {
            Ok(f) => f,
            Err(_) => continue,
        };
        let f = f.as_mut();

        if let RenderableFeature::Polygon {
            material,
            render_info,
            ..
        } = f
        {
            let should_recalculate_height = material.clamp_to_ground
                != updated.material.clamp_to_ground
                || material.height != updated.material.height
                || material.extruded_height != updated.material.extruded_height;
            let internal = material.internal.clone();
            *material = updated.material.clone();
            material.internal = internal;
            render_info.should_recalculate_height = should_recalculate_height;
        }
        commands.entity(e).remove::<UpdatePolygon>();
    }
}

fn triangulate_one_polygon(
    geometry: &mut PolygonGeometry,
    material: &PolygonMaterial,
    polygon_resource: &mut PolygonResource,
) -> (Option<Extent<f32, Radians>>, Option<PolygonGeometryResult>) {
    geometry.hierarchy.align_winding_order();

    if geometry.hierarchy.expected_winding_order == WindingOrder::Unknown {
        // If all the vertices of a polygon lie on a single line, the winding order becomes WindingOrder::Unknown.
        // Such a polygon should be discarded.
        return (None, None);
    }

    let mut hierarchy = Hierarchy::default();
    for c in &geometry.hierarchy.outer_ring {
        hierarchy
            .outer_ring
            .push(geometry.crs.to_vec3(WGS84_32, *c, material.height));
    }

    if let Some(holes_before) = &geometry.hierarchy.holes {
        hierarchy.holes = Some(
            holes_before
                .iter()
                .map(|hole| Hierarchy {
                    outer_ring: hole
                        .outer_ring
                        .iter()
                        .map(|&c| geometry.crs.to_vec3(WGS84_32, c, material.height))
                        .collect(),
                    holes: None,
                    expected_winding_order: geometry.hierarchy.expected_winding_order,
                })
                .collect(),
        );
    }

    let extent = Extent::from_points(
        &geometry
            .hierarchy
            .outer_ring
            .iter()
            .map(|o| geometry.crs.to_lng_lat(WGS84_32, *o))
            .collect::<Vec<_>>(),
    );

    let polygon_result = create_polygon_geometry(
        PolygonGeometryOptions {
            hierarchy,
            clamp_to_ground: material.clamp_to_ground,
            height: material.height,
            extruded_height: material.extruded_height.unwrap_or_default(),
            ..Default::default()
        },
        polygon_resource,
    );

    (Some(extent), polygon_result)
}

// TODO: This system is executed whenever a tile is added.
//       This isn't efficient, so we need to update this system
//       to execute only when the layer's bounding box is within the camera frustum.
#[allow(clippy::too_many_arguments)]
pub fn update_height_by_terrain(
    mut qt: ResMut<TileQuadtree>,
    mut renderable_features: Query<(&PolygonMarker, &mut RenderableFeature)>,
    tile_meshes: Query<&TileMeshMarker, Added<TileMeshMarker>>,
) {
    let is_tile_meshes_empty = tile_meshes.is_empty();

    for (_, mut feature) in &mut renderable_features {
        match feature.as_ref() {
            RenderableFeature::Polygon { render_info, .. } => {
                if is_tile_meshes_empty && !render_info.should_recalculate_height {
                    continue;
                }
            }
            _ => continue,
        };
        match feature.as_mut() {
            RenderableFeature::Polygon {
                material,
                extent,
                render_info,
                ..
            } => {
                render_info.should_recalculate_height = false;

                let (min_height, max_height) = if material.clamp_to_ground {
                    let (min, max) = sample_terrain_height_within_extent(&mut qt, *extent);
                    // TODO: Find a good way to approximate more detail.
                    // Fix an issue the max height is off a bit.
                    let e = max / 100.;
                    (min, max + e)
                } else {
                    (material.height, material.extruded_height.unwrap_or(0.))
                };

                let internal = material.internal.as_mut().unwrap();
                internal.min_max_heights = calc_min_max_height(
                    min_height,
                    max_height,
                    material.clamp_to_ground,
                    render_info.distance_to_center_from_ellipsoid_surface,
                );
            }
            _ => unreachable!(),
        };
    }
}

fn calc_min_max_height(
    height: FloatType,
    extruded_height: FloatType,
    clamp_to_ground: bool,
    distance_to_center_from_ellipsoid_surface: FloatType,
) -> Vec<FloatType> {
    let height = if clamp_to_ground {
        height.min(distance_to_center_from_ellipsoid_surface)
    } else {
        height
    };
    let extruded_height = if clamp_to_ground {
        extruded_height
    } else {
        height + extruded_height
    };

    vec![height, extruded_height]
}
