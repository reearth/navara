import {
  PolygonMesh as NavaraPolygonMesh,
  PolygonMaterial,
} from "@navara/engine";
import BatchTextureParsVertex from "@shaders/glsl/chunks/batch_texture_pars_vertex.glsl";
import BranchFreeTernary from "@shaders/glsl/chunks/branchFreeTernary.glsl";
import ExtrudedHeightParsVertex from "@shaders/glsl/chunks/extruded_height_pars_vertex.glsl";
import ExtrudedHeightVertex from "@shaders/glsl/chunks/extruded_height_vertex.glsl";
import HeightParsVertex from "@shaders/glsl/chunks/height_pars_vertex.glsl";
import HeightVertex from "@shaders/glsl/chunks/height_vertex.glsl";
import { Color, type DataTexture, InstancedBufferAttribute } from "three";
import {
  Line2,
  LineGeometry,
  LineMaterial,
  LineSegmentsGeometry,
} from "three-stdlib";

import type { EventContext } from "../event/context";
import { overrideLineMaterialForMRT } from "../material";
import { createReplacer } from "../utils/replacer";

import { FEATURE_BATCH_TEXTURE_CONFIG } from "./batchedFeature";
import { initBatchedMaterial } from "./batchTexture";
import type { FeatureMesh } from "./featureMesh";

class NvLineGeometry extends LineGeometry {
  setPositions(
    array: Float32Array,
    skipIdx: Uint32Array = new Uint32Array(),
  ): this {
    const positions: number[] = [];
    const skipSet = new Set(skipIdx);

    for (let i = 0; i < array.length - 3; i += 3) {
      const currentIndex = i / 3;
      if (skipSet.has(currentIndex)) {
        continue;
      }

      // segment start
      positions.push(array[i], array[i + 1], array[i + 2]);
      // segment end
      positions.push(array[i + 3], array[i + 4], array[i + 5]);
    }

    const points = new Float32Array(positions);

    // This function is used to override LineGeometry's setPositions,
    // so we don't call super.setPositions.
    LineSegmentsGeometry.prototype.setPositions.call(this, points);
    return this;
  }
}

export class PolygonOutlineMesh extends Line2 implements FeatureMesh {
  readonly ctx: EventContext;
  private resizeEventUnsubscribe?: () => void;

  constructor(mesh: NavaraPolygonMesh, ctx: EventContext) {
    super(new NvLineGeometry(), new LineMaterial());
    this.ctx = ctx;
    this.initGeometry(mesh);
    this.initMaterial(mesh);
  }

  private initGeometry(mesh: NavaraPolygonMesh) {
    const g = mesh.outline_geometry;
    if (!g || !g.position) {
      return;
    }
    const position = this.ctx.buf.removeF32(g.position.data);
    if (!position) {
      return;
    }

    const scale_normal_and_cap = g.scale_normal_and_cap
      ? this.ctx.buf.removeF32(g.scale_normal_and_cap.data)
      : undefined;

    const skipIdx = g.skip_indices
      ? (this.ctx.buf.removeU32(g.skip_indices) ?? undefined)
      : undefined;

    const batchIndex = g.batch_index
      ? this.ctx.buf.removeF32(g.batch_index.data)
      : undefined;

    // Convert position buffer to Line2 format
    const lineGeometry = this.geometry as NvLineGeometry;
    lineGeometry.setPositions(position, skipIdx);

    // Add scale_normal_and_cap attributes if available
    if (g.scale_normal_and_cap && scale_normal_and_cap) {
      const size = g.scale_normal_and_cap.size;
      this.initScaleNormalCapAttributes(
        scale_normal_and_cap,
        skipIdx,
        size,
        lineGeometry,
      );
    }

    // Add per-segment batch index attribute for batch texture lookups
    if (batchIndex) {
      const segmentBatchIds: number[] = [];
      const skipSet = new Set(skipIdx ?? []);
      for (let i = 0; i < batchIndex.length - 1; i++) {
        if (skipSet.has(i)) continue;
        segmentBatchIds.push(batchIndex[i]);
      }
      lineGeometry.setAttribute(
        "_batchid",
        new InstancedBufferAttribute(new Float32Array(segmentBatchIds), 1),
      );
    }
  }

  private initScaleNormalCapAttributes(
    scale_normal_and_cap: Float32Array<ArrayBufferLike>,
    skipIdx: Uint32Array<ArrayBufferLike> | undefined,
    size: number,
    lineGeometry: LineGeometry,
  ) {
    // Create separate arrays for start and end points of line segments
    const scaleDataStart: number[] = [];
    const scaleDataEnd: number[] = [];
    const skipSet = new Set(skipIdx ?? []);

    for (let i = 0; i < scale_normal_and_cap.length / size - 1; i++) {
      if (skipSet.has(i)) {
        continue;
      }

      // For each line segment, add start and end scale normal data
      const startIdx = i * size;
      const endIdx = (i + 1) * size;

      // Start point data
      for (let j = 0; j < size; j++) {
        scaleDataStart.push(scale_normal_and_cap[startIdx + j]);
      }

      // End point data
      for (let j = 0; j < size; j++) {
        scaleDataEnd.push(scale_normal_and_cap[endIdx + j]);
      }
    }

    lineGeometry.setAttribute(
      "scaleNormalAndCapStart",
      new InstancedBufferAttribute(new Float32Array(scaleDataStart), size),
    );
    lineGeometry.setAttribute(
      "scaleNormalAndCapEnd",
      new InstancedBufferAttribute(new Float32Array(scaleDataEnd), size),
    );
  }

  private initMaterial(mesh: NavaraPolygonMesh) {
    const meshMaterial = mesh.material;
    const material = this.material;

    // Set basic material properties
    material.color.set(meshMaterial.outlineColor ?? 0xffffff);
    material.linewidth = meshMaterial.outlineWidth ?? 1;

    const resizeHandler = (w: number, h: number) => {
      material.resolution.set(w, h);
    };

    this.ctx.viewEvents.on("resize", resizeHandler);
    this.resizeEventUnsubscribe = () =>
      this.ctx.viewEvents.off("resize", resizeHandler);

    // Set up height adjustment uniforms
    const uMinMaxHeights = meshMaterial.__internal__?.minMaxHeights;
    material.userData.uMinMaxHeight = {
      value: uMinMaxHeights,
    };
    material.userData.uAddExtrudedHeight = {
      value: 0.0,
    };
    material.userData.uAddHeight = {
      value: 0.0,
    };

    // Set up batch texture material defines (row indices, row count)
    initBatchedMaterial(material, FEATURE_BATCH_TEXTURE_CONFIG);

    material.onBeforeCompile = (shader) => {
      // Merge user-defined defines (batch texture, color/show, height, etc.)
      shader.defines ??= {};
      Object.assign(shader.defines, material.userData.defines || {});

      shader.uniforms.uMinMaxHeight = material.userData.uMinMaxHeight;
      shader.uniforms.uAddExtrudedHeight = material.userData.uAddExtrudedHeight;
      shader.uniforms.uAddHeight = material.userData.uAddHeight;

      // Batch texture uniform (shared from parent PolygonMesh)
      if (material.userData.batchDataTexture) {
        shader.uniforms.batchDataTexture = material.userData.batchDataTexture;
      }

      shader.vertexShader = createReplacer(shader.vertexShader)
        .replace(
          "attribute vec3 instanceEnd;",
          `
        attribute vec3 instanceEnd;
        attribute vec4 scaleNormalAndCapStart;
        attribute vec4 scaleNormalAndCapEnd;
        varying float nvr_vShow;
        uniform vec2 uMinMaxHeight;
        ${ExtrudedHeightParsVertex}
        ${HeightParsVertex}
        ${BranchFreeTernary}
        ${BatchTextureParsVertex}
        `,
        )
        .replace(
          "vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );",
          `
        ${ExtrudedHeightVertex}
        ${HeightVertex}

        nvr_vShow = 1.0;
        #ifdef USE_BATCH_TEXTURE
          float batchId = _batchid;
          #ifdef USE_BATCH_COLOR_SHOW
            // Color is ignored.
            vec4 batchColorShow = getBatchColorShow(batchId);
            nvr_vShow = batchColorShow.a;
          #endif
          #ifdef USE_BATCH_EXTRUDED_HEIGHT
            addExtrudedHeight = getBatchExtrudedHeight(batchId);
          #endif
          #ifdef USE_BATCH_HEIGHT
            addHeight = getBatchHeight(batchId);
          #endif
        #endif

        vec3 adjustedInstanceStart = instanceStart;
        adjustedInstanceStart.xyz += scaleNormalAndCapStart.xyz * nvr_branchFreeTernary(
          scaleNormalAndCapStart.w == 0.0,
          uMinMaxHeight.x + addHeight,
          uMinMaxHeight.y + addExtrudedHeight
        );
        vec4 start = modelViewMatrix * vec4( adjustedInstanceStart, 1.0 );
        `,
        )
        .replace(
          "vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );",
          `
        vec3 adjustedInstanceEnd = instanceEnd;
        adjustedInstanceEnd.xyz += scaleNormalAndCapEnd.xyz * nvr_branchFreeTernary(
          scaleNormalAndCapEnd.w == 0.0,
          uMinMaxHeight.x + addHeight,
          uMinMaxHeight.y + addExtrudedHeight
        );
        vec4 end = modelViewMatrix * vec4( adjustedInstanceEnd, 1.0 );
        `,
        ).source;

      shader.fragmentShader = createReplacer(shader.fragmentShader).replace(
        "void main() {",
        `
        varying float nvr_vShow;
        varying float nvr_vHasBatchColor;
        void main() {
          if (nvr_vShow < 0.5) discard;
        `,
      ).source;
    };

    // Apply MRT compatibility
    overrideLineMaterialForMRT(material);

    // Update based on initial state
    this._update(meshMaterial, mesh.active);
  }

  _update(material: PolygonMaterial, active: boolean) {
    if (!this.userData.prev) {
      this.userData.prev = {};
    }
    const prev = this.userData.prev;
    const lineMaterial = this.material;

    // Update color
    if (prev.color !== material.outlineColor) {
      const nextColor = material.outlineColor ?? 0xffffff;
      lineMaterial.color.set(nextColor);
      prev.color = nextColor;
    }

    // Update visibility
    const nextVisible =
      (material.show ?? true) && (material.outlineShow ?? true) && active;
    if (prev.visible !== nextVisible) {
      this.visible = nextVisible;
      prev.visible = nextVisible;
    }

    // Update line width
    if (prev.width !== material.outlineWidth) {
      const nextWidth = material.outlineWidth ?? 1;
      lineMaterial.linewidth = nextWidth;
      prev.width = nextWidth;
    }

    // Update height values for shader-based adjustment
    const [min, max] = material.__internal__?.minMaxHeights ?? [];
    if (prev.min !== min || prev.max !== max) {
      lineMaterial.userData.uMinMaxHeight.value = [min, max];
      prev.min = min;
      prev.max = max;
    }
  }

  _setFeatureColor(color: Color) {
    this.material.color.set(color);
  }

  _getFeatureColor() {
    return this.material.color;
  }

  _setFeatureShow(visible: boolean): void {
    this.visible = visible;
  }

  _setFrustumCulled(culled: boolean): void {
    this.frustumCulled = culled;
  }

  _setFeatureExtrudedHeight(height: number): void {
    this.material.userData.uAddExtrudedHeight.value = height;
  }

  _setFeatureHeight(height: number): void {
    this.material.userData.uAddHeight.value = height;
  }

  // Utility method to update resolution (should be called when renderer size changes)
  updateResolution(width: number, height: number): void {
    this.material.resolution.set(width, height);
  }

  initBatchTexture(texture: DataTexture) {
    this.material.userData.batchDataTexture = { value: texture };
    this.material.userData.defines ??= {};
    this.material.userData.defines.USE_BATCH_TEXTURE = true;
    this.material.needsUpdate = true;
  }

  enableBatchColorShow() {
    this.material.userData.defines ??= {};
    this.material.userData.defines.USE_BATCH_COLOR_SHOW = true;
    this.material.needsUpdate = true;
  }

  enableBatchHeight() {
    this.material.userData.defines ??= {};
    this.material.userData.defines.USE_BATCH_HEIGHT = true;
    this.material.needsUpdate = true;
  }

  enableBatchExtrudedHeight() {
    this.material.userData.defines ??= {};
    this.material.userData.defines.USE_BATCH_EXTRUDED_HEIGHT = true;
    this.material.needsUpdate = true;
  }

  // Clean up event listeners when the object is destroyed
  dispose(): void {
    this.resizeEventUnsubscribe?.();
    this.resizeEventUnsubscribe = undefined;
  }
}
