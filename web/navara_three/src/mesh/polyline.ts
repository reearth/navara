import {
  PolylineMesh as NavaraPolylineMesh,
  PolylineMaterial,
} from "@navara/engine";
import GroundPolylineFragShader from "@shaders/glsl/groundPolyline.frag.glsl";
import PolylineFragShader from "@shaders/glsl/polyline.frag.glsl";
import PolylineVertShader from "@shaders/glsl/polyline.vert.glsl";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ShaderMaterial,
  UniformsLib,
} from "three";

import type { BufferLoader } from "../event";
import type { CommonUniforms } from "../uniforms";

import {
  BatchedFeatureMesh,
  type BatchedFeatureAttributes,
} from "./batchedFeature";

type Attributes = BatchedFeatureAttributes<{
  position: BufferAttribute;
  start: BufferAttribute;
  normal: BufferAttribute;
  start_normal: BufferAttribute;
  right_normal_and_texture_coordinate_normalization_y: BufferAttribute;
  end_normal_and_texture_coordinate_normalization_x: BufferAttribute;
  forward_offset: BufferAttribute;
  batchIdAndSel: BufferAttribute;
}>;

export class PolylineMesh extends BatchedFeatureMesh<
  BufferGeometry<Attributes>,
  ShaderMaterial
> {
  constructor(
    mesh: NavaraPolylineMesh,
    buf: BufferLoader,
    uniforms: CommonUniforms,
  ) {
    super(new BufferGeometry<Attributes>(), new ShaderMaterial());
    this.initGeometry(mesh, buf);
    this.initMaterial(mesh, uniforms);
  }

  private initGeometry(mesh: NavaraPolylineMesh, buf: BufferLoader) {
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
      !indices
    )
      return;
    const geometry = this.geometry;

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

    if (batchIdAndSel) {
      geometry.setAttribute(
        "batchIdAndSel",
        new BufferAttribute(batchIdAndSel, batchIdSize),
      );
    }

    this._setBatchIndex(batchIndex, batchIndexSize);

    geometry.setIndex(new BufferAttribute(indices, 1));
    // geometry.computeVertexNormals();

    this.userData.batchIdAndSel = batchIdAndSel;
    this.userData.batchIdSize = batchIdSize;
  }

  private initMaterial(mesh: NavaraPolylineMesh, uniforms: CommonUniforms) {
    const meshMaterial = mesh.material;

    const [minHeight, maxHeight] = meshMaterial.__internal__
      ?.min_max_heights ?? [0, 0];

    const uPickable = {
      value: 0.0,
    };

    this.material.uniforms = {
      ...UniformsLib["lights"],
      minMaxHeightAndWidth: {
        value: [minHeight, maxHeight, meshMaterial.width],
      },
      color: { value: new Color(meshMaterial.color) },
      useGroundNormals: { value: !!meshMaterial.use_ground_normals },
      viewportAndPixelRatio: uniforms.viewportAndPixelRatio,
      frustumNearFar: uniforms.frustumNearFar,
      frustumRatio: uniforms.frustumRatio,
      tGlobeDepth: uniforms.tGlobeDepth,
      uGlobeNormal: uniforms.tGlobeNormal,
      inverseProjectionMatrix: uniforms.inverseProjectionMatrix,
      nvr_uPickable: uPickable,
      nvr_uHighlightColor: uniforms.highlightColor,
    };
    this.material.vertexShader = PolylineVertShader;
    this.material.fragmentShader = meshMaterial.clamp_to_ground
      ? GroundPolylineFragShader
      : PolylineFragShader;

    this.material.depthTest = false;
    this.material.visible = !!meshMaterial.show;
    this.material.lights = true;
    this.material.vertexColors = false;

    this.material.userData.color = meshMaterial.color;
    this.material.userData.uPickable = uPickable;

    this._update(meshMaterial, mesh.active);
  }

  _update(material: PolylineMaterial, active: boolean) {
    if (!this.material.userData.prev) {
      this.material.userData.prev = {};
    }
    const prev = this.material.userData.prev;

    if (prev.color !== material.color) {
      this.material.uniforms.color.value.set(material.color);
      prev.color = material.color;
    }

    if (prev.use_ground_normals !== material.use_ground_normals) {
      this.material.uniforms.useGroundNormals.value =
        !!material.use_ground_normals;
      prev.use_ground_normals = !!material.use_ground_normals;
    }

    const [minHeight, maxHeight] = material.__internal__?.min_max_heights ?? [
      0, 0,
    ];
    const width = material.width;
    if (
      prev.minHeight !== minHeight ||
      prev.maxHeight !== maxHeight ||
      prev.width !== width
    ) {
      this.material.uniforms.minMaxHeightAndWidth.value = [
        minHeight,
        maxHeight,
        width,
      ];
      prev.minHeight = minHeight;
      prev.maxHeight = maxHeight;
      prev.width = width;
    }

    const next = (material.show ?? true) && active;
    if (prev.visible !== next) {
      this.visible = next;
      prev.visible = next;
    }
  }

  get color() {
    return this.material.uniforms.color.value;
  }

  _setFeatureColor(color: Color): void {
    this.material.uniforms.color.value.set(color);
  }
}
