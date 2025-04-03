import type { PolylineMesh, PolylineMaterial } from "@navara/engine";
import GroundPolylineFragShader from "@shaders/glsl/groundPolyline.frag.glsl";
import PolylineFragShader from "@shaders/glsl/polyline.frag.glsl";
import PolylineVertShader from "@shaders/glsl/polyline.vert.glsl";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  ShaderMaterial,
  UniformsLib,
} from "three";

import type { BufferLoader } from "../";
import type { CommonUniforms } from "../../uniforms";

export async function renderPolyline(
  mesh: PolylineMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
) {
  const g = mesh.geometry;
  const position = buf.removeF32(g.position.data);
  const start = buf.removeF32(g.start.data);
  const forward_offset = buf.removeF32(g.forward_offset.data);
  const start_normals = buf.removeF32(g.start_normals.data);
  const end_normal_and_texture_coordinate_normalization_x = buf.removeF32(
    g.end_normal_and_texture_coordinate_normalization_x.data,
  );
  const right_normal_and_texture_coordinate_normalization_y = buf.removeF32(
    g.right_normal_and_texture_coordinate_normalization_y.data,
  );
  const indices = buf.removeU32(g.indices);
  const batchIdAndSel = g.batch_id_and_sel
    ? buf.removeF32(g.batch_id_and_sel.data)
    : undefined;
  const batchIdSize = g.batch_id_and_sel ? g.batch_id_and_sel.size : 0;
  const batchIndex = g.batch_index
    ? buf.removeU32(g.batch_index.data)
    : undefined;
  const batchIndexSize = g.batch_index ? g.batch_index.size : 0;

  if (
    !position ||
    !start ||
    !forward_offset ||
    !start_normals ||
    !end_normal_and_texture_coordinate_normalization_x ||
    !right_normal_and_texture_coordinate_normalization_y ||
    !indices ||
    !batchIdAndSel ||
    !batchIndex
  )
    return;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(position, g.position.size),
  );
  geometry.setAttribute("start", new BufferAttribute(start, g.start.size));
  geometry.setAttribute(
    "forward_offset",
    new BufferAttribute(forward_offset, g.forward_offset.size),
  );
  geometry.setAttribute(
    "start_normal",
    new BufferAttribute(start_normals, g.start_normals.size),
  );
  geometry.setAttribute(
    "end_normal_and_texture_coordinate_normalization_x",
    new BufferAttribute(
      end_normal_and_texture_coordinate_normalization_x,
      g.end_normal_and_texture_coordinate_normalization_x.size,
    ),
  );
  geometry.setAttribute(
    "right_normal_and_texture_coordinate_normalization_y",
    new BufferAttribute(
      right_normal_and_texture_coordinate_normalization_y,
      g.right_normal_and_texture_coordinate_normalization_y.size,
    ),
  );

  geometry.setAttribute(
    "batchIdAndSel",
    new BufferAttribute(batchIdAndSel, batchIdSize),
  );
  // Align to B3DM attribute: https://github.com/CesiumGS/3d-tiles/blob/492adb06b00870d9ee99b8d97c261a466783034c/specification/TileFormats/Batched3DModel/README.adoc#binary-gltf
  // TODO: However this need to be migrated to v1.1 in the future
  geometry.setAttribute(
    "_batchid",
    new BufferAttribute(batchIndex, batchIndexSize),
  );

  geometry.setIndex(new BufferAttribute(indices, 1));
  // geometry.computeVertexNormals();

  const [minHeight, maxHeight] = mesh.material.__internal__
    ?.min_max_heights ?? [0, 0];

  const uPickable = {
    value: 0.0,
  };

  const material = new ShaderMaterial({
    uniforms: {
      ...UniformsLib["lights"],
      minMaxHeightAndWidth: {
        value: [minHeight, maxHeight, mesh.material.width],
      },
      color: { value: new Color(mesh.material.color) },
      useGroundNormals: { value: !!mesh.material.use_ground_normals },
      viewportAndPixelRatio: uniforms.viewportAndPixelRatio,
      frustumNearFar: uniforms.frustumNearFar,
      frustumRatio: uniforms.frustumRatio,
      tGlobeDepth: uniforms.tGlobeDepth,
      uGlobeNormal: uniforms.tGlobeNormal,
      inverseProjectionMatrix: uniforms.inverseProjectionMatrix,
      nvr_uPickable: uPickable,
      nvr_uHighlightColor: uniforms.highlightColor,
    },
    vertexShader: PolylineVertShader,
    fragmentShader: mesh.material.clamp_to_ground
      ? GroundPolylineFragShader
      : PolylineFragShader,
    // fragmentShader: PolylineFragShader,
    depthTest: false,
    visible: mesh.material.show,
    lights: true,
  });

  material.userData.uPickable = uPickable;

  const m = new Mesh(geometry, material);
  m.userData.batchIdAndSel = batchIdAndSel;
  m.userData.batchIdSize = batchIdSize;

  return m;
}

export function processPolylineChanged(
  obj: Mesh,
  material: PolylineMaterial,
  active: boolean,
) {
  if (obj.material instanceof ShaderMaterial) {
    obj.material.uniforms.color.value.set(material.color);
    obj.material.uniforms.useGroundNormals.value =
      !!material.use_ground_normals;

    const [minHeight, maxHeight] = material.__internal__?.min_max_heights ?? [
      0, 0,
    ];
    obj.material.uniforms.minMaxHeightAndWidth.value = [
      minHeight,
      maxHeight,
      material.width,
    ];
    obj.visible = (material.show ?? true) && active;
  }
}
