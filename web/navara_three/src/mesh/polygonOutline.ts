import type { EventHandler } from "@navara/core";
import {
  PolygonMesh as NavaraPolygonMesh,
  PolygonMaterial,
} from "@navara/engine";
import type { ViewEvents } from "@navara/three";
import BranchFreeTernary from "@shaders/glsl/chunks/branchFreeTernary.glsl";
import { Color, InstancedBufferAttribute } from "three";
import {
  Line2,
  LineGeometry,
  LineMaterial,
  LineSegmentsGeometry,
} from "three-stdlib";

import type { BufferLoader } from "../event";
import { overrideLineMaterialForMRT } from "../material";
import { createReplacer } from "../utils/replacer";

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
  private resizeEventUnsubscribe?: () => void;

  constructor(
    mesh: NavaraPolygonMesh,
    buf: BufferLoader,
    viewEvents: EventHandler<ViewEvents>,
  ) {
    super(new NvLineGeometry(), new LineMaterial());
    this.initGeometry(mesh, buf);
    this.initMaterial(mesh, viewEvents);
  }

  private initGeometry(mesh: NavaraPolygonMesh, buf: BufferLoader) {
    const g = mesh.outline_geometry;
    if (!g || !g.position) {
      return;
    }
    const position = buf.removeF32(g.position.data);
    if (!position) {
      return;
    }

    const scale_normal_and_cap = g.scale_normal_and_cap
      ? buf.removeF32(g.scale_normal_and_cap.data)
      : undefined;

    const skipIdx = g.skip_indices
      ? (buf.removeU32(g.skip_indices) ?? undefined)
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

  private initMaterial(
    mesh: NavaraPolygonMesh,
    viewEvents: EventHandler<ViewEvents>,
  ) {
    const meshMaterial = mesh.material;
    const material = this.material;

    // Set basic material properties
    material.color.set(meshMaterial.outline_color ?? 0xffffff);
    material.linewidth = meshMaterial.outline_width ?? 1;

    const resizeHandler = (w: number, h: number) => {
      material.resolution.set(w, h);
    };

    viewEvents.on("resize", resizeHandler);
    this.resizeEventUnsubscribe = () => viewEvents.off("resize", resizeHandler);

    // Set up height adjustment uniforms
    const uMinMaxHeights = meshMaterial.__internal__?.min_max_heights;
    material.userData.uMinMaxHeight = {
      value: uMinMaxHeights,
    };
    material.userData.uAddExtrudedHeight = {
      value: 0.0,
    };

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uMinMaxHeight = material.userData.uMinMaxHeight;
      shader.uniforms.uAddExtrudedHeight = material.userData.uAddExtrudedHeight;

      shader.vertexShader = createReplacer(shader.vertexShader)
        .replace(
          "attribute vec3 instanceEnd;",
          `
        attribute vec3 instanceEnd;
        attribute vec4 scaleNormalAndCapStart;
        attribute vec4 scaleNormalAndCapEnd;
        uniform vec2 uMinMaxHeight;
        uniform float uAddExtrudedHeight;
        ${BranchFreeTernary}
        `,
        )
        .replace(
          "vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );",
          `
        // Apply height adjustment to start point
        vec3 adjustedInstanceStart = instanceStart;

        adjustedInstanceStart.xyz += scaleNormalAndCapStart.xyz * nvr_branchFreeTernary(scaleNormalAndCapStart.w == 0.0, uMinMaxHeight.x, uMinMaxHeight.y + uAddExtrudedHeight);
        vec4 start = modelViewMatrix * vec4( adjustedInstanceStart, 1.0 );
        `,
        )
        .replace(
          "vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );",
          `
        // Apply height adjustment to end point  
        vec3 adjustedInstanceEnd = instanceEnd;

        adjustedInstanceEnd.xyz += scaleNormalAndCapEnd.xyz * nvr_branchFreeTernary(scaleNormalAndCapEnd.w == 0.0, uMinMaxHeight.x, uMinMaxHeight.y + uAddExtrudedHeight);
        vec4 end = modelViewMatrix * vec4( adjustedInstanceEnd, 1.0 );
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
    if (prev.color !== material.outline_color) {
      const nextColor = material.outline_color ?? 0xffffff;
      lineMaterial.color.set(nextColor);
      prev.color = nextColor;
    }

    // Update visibility
    const nextVisible =
      (material.show ?? true) && (material.outline_show ?? true) && active;
    if (prev.visible !== nextVisible) {
      this.visible = nextVisible;
      prev.visible = nextVisible;
    }

    // Update line width
    if (prev.width !== material.outline_width) {
      const nextWidth = material.outline_width ?? 1;
      lineMaterial.linewidth = nextWidth;
      prev.width = nextWidth;
    }

    // Update height values for shader-based adjustment
    const [min, max] = material.__internal__?.min_max_heights ?? [];
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

  // Utility method to update resolution (should be called when renderer size changes)
  updateResolution(width: number, height: number): void {
    this.material.resolution.set(width, height);
  }

  // Clean up event listeners when the object is destroyed
  dispose(): void {
    this.resizeEventUnsubscribe?.();
    this.resizeEventUnsubscribe = undefined;
  }
}
