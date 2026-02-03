import type { EventHandler } from "@navara/core";
import {
  PolylineMesh as NavaraPolylineMesh,
  PolylineMaterial,
} from "@navara/engine";
import FlatPolylineFragShader from "@shaders/glsl/flatPolyline.frag.glsl";
import FlatPolylineVertShader from "@shaders/glsl/flatPolyline.vert.glsl";
import GroundPolylineFragShader from "@shaders/glsl/groundPolyline.frag.glsl";
import PolylineFragShader from "@shaders/glsl/polyline.frag.glsl";
import PolylineVertShader from "@shaders/glsl/polyline.vert.glsl";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ShaderMaterial,
  UniformsLib,
  Matrix4,
  Vector3,
} from "three";

import type { ViewEvents } from "..";
import type { ViewContext } from "../core";
import type { BufferLoader } from "../event";
import { packing } from "../shaders";
import type { CommonUniforms } from "../uniforms";
import { arraysEqual } from "../utils";

import {
  BatchedFeatureMesh,
  type BatchedFeatureAttributes,
} from "./batchedFeature";
import type { DefaultBatchAttributeValues } from "./batchTexture";
import { setupRTEBeforeRender } from "./rtcRteHelper";

type Attributes = BatchedFeatureAttributes<{
  position: BufferAttribute;
  position_3d_high?: BufferAttribute;
  position_3d_low?: BufferAttribute;
  start: BufferAttribute;
  start_3d_high?: BufferAttribute;
  start_3d_low?: BufferAttribute;
  end_3d_high?: BufferAttribute;
  end_3d_low?: BufferAttribute;
  normal: BufferAttribute;
  start_normal: BufferAttribute;
  right_normal_and_texture_coordinate_normalization_y: BufferAttribute;
  end_normal_and_texture_coordinate_normalization_x: BufferAttribute;
  forward_offset: BufferAttribute;
  attrBatchId: BufferAttribute;
}>;

export class PolylineMesh extends BatchedFeatureMesh<
  BufferGeometry<Attributes>,
  ShaderMaterial
> {
  /** ViewContext for SelectiveEffect handling */
  private _viewContext: ViewContext;
  /** Layer ID for SelectiveEffect handling */
  private _layerId: string;

  constructor(
    mesh: NavaraPolylineMesh,
    buf: BufferLoader,
    uniforms: CommonUniforms,
    viewEvents: EventHandler<ViewEvents>,
    viewContext: ViewContext,
    layerId: string,
  ) {
    super(new BufferGeometry<Attributes>(), new ShaderMaterial());
    this._viewContext = viewContext;
    this._layerId = layerId;
    this.initGeometry(mesh, buf);
    this.initMaterial(mesh, uniforms, viewEvents);

    // Set draped flag for texturized rendering
    this.userData.draped = mesh.should_be_texturized;

    this.addEventListener("removedFromWorld", () => {
      this.dispose(viewEvents);
    });
  }

  private initGeometry(mesh: NavaraPolylineMesh, buf: BufferLoader) {
    const g = mesh.geometry;
    const position = buf.removeF32(g.position.data);
    const position_high = g.position_high
      ? buf.removeF32(g.position_high.data)
      : null;
    const position_low = g.position_low
      ? buf.removeF32(g.position_low.data)
      : null;
    const start = buf.removeF32(g.start.data);
    const start_high = g.start_high ? buf.removeF32(g.start_high.data) : null;
    const start_low = g.start_low ? buf.removeF32(g.start_low.data) : null;
    const end_high = g.end_high ? buf.removeF32(g.end_high.data) : null;
    const end_low = g.end_low ? buf.removeF32(g.end_low.data) : null;
    const forward_offset = buf.removeF32(g.forward_offset.data);
    const start_normals = buf.removeF32(g.start_normals.data);
    const end_normal_and_texture_coordinate_normalization_x = buf.removeF32(
      g.end_normal_and_texture_coordinate_normalization_x.data,
    );
    const right_normal_and_texture_coordinate_normalization_y = buf.removeF32(
      g.right_normal_and_texture_coordinate_normalization_y.data,
    );
    const indices = buf.removeU32(g.indices);
    const batchIds = g.batch_ids ? buf.removeF32(g.batch_ids.data) : undefined;
    const batchIdSize = g.batch_ids ? g.batch_ids.size : 0;
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

    // RTE attributes
    if (position_high && position_low) {
      geometry.setAttribute(
        "position_3d_high",
        new BufferAttribute(position_high, 3),
      );
      geometry.setAttribute(
        "position_3d_low",
        new BufferAttribute(position_low, 3),
      );
      this.userData.useRTE = true;
    } else {
      // Non-RTE mode: use regular start attribute
      geometry.setAttribute("start", new BufferAttribute(start, g.start.size));
    }

    // RTE attributes for start
    if (start_high && start_low) {
      geometry.setAttribute(
        "start_3d_high",
        new BufferAttribute(start_high, 3),
      );
      geometry.setAttribute("start_3d_low", new BufferAttribute(start_low, 3));
    } else {
      geometry.setAttribute(
        "forward_offset",
        new BufferAttribute(forward_offset, g.forward_offset.size),
      );
    }

    // RTE attributes for end
    if (end_high && end_low) {
      geometry.setAttribute("end_3d_high", new BufferAttribute(end_high, 3));
      geometry.setAttribute("end_3d_low", new BufferAttribute(end_low, 3));
    }

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

    if (batchIds) {
      geometry.setAttribute(
        "attrBatchId",
        new BufferAttribute(batchIds, batchIdSize),
      );
    }

    if (batchIndex) {
      this._setBatchIndex(Float32Array.from(batchIndex), batchIndexSize);
    }

    geometry.setIndex(new BufferAttribute(indices, 1));
    // geometry.computeVertexNormals();

    this.userData.batchIds = batchIds;
    this.userData.batchIdSize = batchIdSize;
  }

  private initMaterial(
    mesh: NavaraPolylineMesh,
    uniforms: CommonUniforms,
    viewEvents: EventHandler<ViewEvents>,
  ) {
    const meshMaterial = mesh.material;

    const [minHeight, maxHeight] = meshMaterial.__internal__?.minMaxHeights ?? [
      0, 0,
    ];

    const uPickable = {
      value: 0.0,
    };

    this.castShadow = !!meshMaterial.castShadow;
    this.receiveShadow = !!meshMaterial.receiveShadow;

    // Set up RTE uniforms and callback if using RTE
    const useRTE = this.userData.useRTE;
    if (useRTE) {
      this.userData.modelViewMatrixRTE = { value: new Matrix4() };
      this.userData.cameraPositionHigh = { value: new Vector3() };
      this.userData.cameraPositionLow = { value: new Vector3() };

      // RTE mode: mesh should be at origin with identity transform
      // Real world positions are encoded in position_3d_high/low attributes (ECEF coordinates)
      // Similar to arcLine RTE implementation
      const identityMatrix = new Matrix4();
      const callback = setupRTEBeforeRender(
        this,
        this.userData,
        identityMatrix,
        identityMatrix,
      );
      if (callback) {
        this.onBeforeRender = callback;
      }

      // Disable frustum culling for RTE mode - mesh is at origin but represents distant coordinates
      this.frustumCulled = false;
    }

    this.material.uniforms = {
      ...UniformsLib["lights"],
      minMaxHeightAndWidth: {
        value: [minHeight, maxHeight, meshMaterial.width],
      },
      color: { value: new Color(meshMaterial.color) },
      useGroundNormals: { value: !!meshMaterial.useGroundNormals },
      viewportAndPixelRatio: uniforms.viewportAndPixelRatio,
      frustumNearFar: uniforms.frustumNearFar,
      frustumRatio: uniforms.frustumRatio,
      tGlobeDepth: uniforms.tGlobeDepth,
      uGlobeNormal: uniforms.tGlobeNormal,
      inverseProjectionMatrix: uniforms.inverseProjectionMatrix,
      nvr_uPickable: uPickable,
    };

    const isTexturized = mesh.should_be_texturized;

    // Select shaders based on rendering mode
    if (isTexturized) {
      // Flat polyline for texturized tile rendering
      this.material.vertexShader = FlatPolylineVertShader;
      this.material.fragmentShader = FlatPolylineFragShader;
    } else {
      // 3D polyline for globe rendering
      this.material.vertexShader = PolylineVertShader;
      this.material.fragmentShader =
        `${packing}\n` +
        (meshMaterial.clampToGround
          ? GroundPolylineFragShader
          : PolylineFragShader);
    }

    this.material.depthTest = false;
    this.material.visible = !!meshMaterial.show;
    // Disable lighting for texturized rendering - the texture will be applied to the lit tile
    this.material.lights = !isTexturized;
    this.material.vertexColors = false;

    this.material.userData.uPickable = uPickable;
    this.material.onBeforeCompile = (shader) => {
      shader.defines ??= {};
      Object.assign(shader.defines, this.material.userData.defines);

      // Add RTE uniforms and defines if using RTE
      if (useRTE) {
        shader.defines.USE_RTE = true;
        shader.uniforms.u_cameraPositionHigh = this.userData.cameraPositionHigh;
        shader.uniforms.u_cameraPositionLow = this.userData.cameraPositionLow;
        shader.uniforms.modelViewMatrixRTE = this.userData.modelViewMatrixRTE;
      }

      if (this.material.userData.batchDataTexture) {
        shader.uniforms.batchDataTexture =
          this.material.userData.batchDataTexture;
      }
    };
    viewEvents.emit("_csmMounted", this.material);

    this._initBatchedMaterial();

    this._update(meshMaterial, mesh.active);
  }

  _update(material: PolylineMaterial, active: boolean) {
    if (!this.material.userData.prev) {
      this.material.userData.prev = {};
    }
    const prev = this.material.userData.prev;

    // Only update material.color if batchTexture color is not being used
    if (prev.color !== material.color) {
      const next = material.color ?? 0;
      // If batchTexture color is not enabled, update material.color directly
      if (!this.material.userData._batchColorTouched) {
        this.material.uniforms.color.value.set(material.color);
      }
      prev.color = next;
    }

    if (prev.useGroundNormals !== material.useGroundNormals) {
      this.material.uniforms.useGroundNormals.value =
        !!material.useGroundNormals;
      prev.useGroundNormals = !!material.useGroundNormals;
    }

    const [minHeight, maxHeight] = material.__internal__?.minMaxHeights ?? [
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

    if (this.castShadow !== material.castShadow) {
      this.castShadow = !!material.castShadow;
    }
    if (this.receiveShadow !== material.receiveShadow) {
      this.receiveShadow = !!material.receiveShadow;
    }

    // SelectiveEffect: effectIds handling
    // ShaderMaterial doesn't have built-in emissive, so only effectIds is handled
    if (!arraysEqual(prev.effectIds, material.effectIds)) {
      this._viewContext.selectiveEffectRegistry?.updateLinksForObject(
        this,
        material.effectIds ?? [],
        prev.effectIds ?? [],
        this._layerId,
      );
      prev.effectIds = material.effectIds ? [...material.effectIds] : [];
    }
  }

  get color() {
    return this.material.uniforms.color.value;
  }

  _getDefaultBatchAttributeValues(): DefaultBatchAttributeValues {
    return {
      color: this.color,
    };
  }

  _setFeatureColor(color: Color): void {
    // If batchTexture is being used, update via batchTexture
    if (this.material.userData._batchColorTouched) {
      super._setFeatureColor(color);
    } else {
      // Otherwise, update material.uniforms.color directly
      this.material.uniforms.color.value.set(color);
    }
  }

  _setFeatureShow(visible: boolean): void {
    this.visible = visible;
  }

  dispose(viewEvents: EventHandler<ViewEvents>) {
    viewEvents.emit("_csmUnmounted", this.material);
  }
}
