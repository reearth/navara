import { Unimplemented } from "@navara/core";
import {
  PolygonMesh as NavaraPolygonMesh,
  PolygonMaterial,
} from "@navara/engine";
import { Color } from "three";
import {
  Line2,
  LineGeometry,
  LineMaterial,
  LineSegmentsGeometry,
} from "three-stdlib";

import type { BufferLoader } from "../event";
import { overrideLineMaterialForMRT } from "../material";

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
    LineSegmentsGeometry.prototype.setPositions.call(this, points);
    return this;
  }
}

export class PolygonOutlineMesh extends Line2 implements FeatureMesh {
  constructor(mesh: NavaraPolygonMesh, buf: BufferLoader) {
    super(new NvLineGeometry(), new LineMaterial());
    this.initGeometry(mesh, buf);
    this.initMaterial(mesh);
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

    const skipIdx = g.skip_indices
      ? (buf.removeU32(g.skip_indices) ?? undefined)
      : undefined;

    // Convert position buffer to Line2 format
    const lineGeometry = this.geometry as NvLineGeometry;
    lineGeometry.setPositions(position, skipIdx);

    // Essential for Line2 rendering
    this.computeLineDistances();
  }

  private initMaterial(mesh: NavaraPolygonMesh) {
    const meshMaterial = mesh.material;
    const material = this.material as LineMaterial;

    // Set basic material properties
    material.color.set(meshMaterial.outline_color ?? 0xffffff);
    material.linewidth = meshMaterial.outline_width ?? 1;

    material.resolution.set(1200, 760);

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
    const lineMaterial = this.material as LineMaterial;

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

  _setFeatureExtrudedHeight(_height: number): void {
    throw new Unimplemented();
  }

  // Utility method to update resolution (should be called when renderer size changes)
  updateResolution(width: number, height: number): void {
    (this.material as LineMaterial).resolution.set(width, height);
  }
}
