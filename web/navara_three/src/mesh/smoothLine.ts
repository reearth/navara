import type { LatLngHeight } from "@navara/core";
import { encodePosition } from "@navara/engine-api";
import {
  geodeticToVector3,
  degreeToRadian,
  calcCameraPosition,
  calcModelMatrixRTE,
} from "@navara/three_api";

import {
  Object3D,
  CatmullRomCurve3,
  Vector3,
  InstancedBufferAttribute,
  Matrix4,
} from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import { overrideLineMaterialForMRT } from "../material";
import { createReplacer } from "../utils";

import { SpherePoints } from "./spherePoints";

export type SmoothLineConfig = {
  tension: number; // Curve stiffness: 0 = straight lines, higher = smoother curves (often 0–1)
  closed: boolean; // Whether the polyline is closed (connect the last point back to the first).
  segments: number; // Number of interpolation segments between each pair of input points.
  lineWidth: number; // Line thickness (in pixels)
  dashed: boolean; // Render the line with a dashed pattern
  dashSize: number; // Length of each dash unit when dashed is true
  dashOffset: number; // Offset of the dash pattern along the line
  gapSize: number; // Length of the gap between dashes when dashed is true
  color: number; // Line color as a hex integer (e.g., 0xff0000)
  showPoints: boolean; // Whether to display the sample points along the line
  pointSize: number; // Size of the point markers
  pointColor: number; // Point color as a hex integer (e.g., 0x00ff00)
  points: LatLngHeight[]; // Source positions as [lng, lat, height]
};

export const DefaultSmoothLineConfig: SmoothLineConfig = {
  tension: 0.5,
  closed: false,
  segments: 1,
  lineWidth: 1,
  dashed: false,
  dashOffset: 0,
  dashSize: 1000,
  gapSize: 500,
  color: 0xffffff,
  showPoints: true,
  pointSize: 2,
  pointColor: 0xffffff,
  points: [],
};

export class SmoothLine extends Object3D {
  private readonly _config: SmoothLineConfig[];
  private _lineMeshes: Line2[] = [];
  private _pointsMeshes: SpherePoints[] = [];
  private _pointsData: Vector3[][] = [];

  // Shared RTE uniforms for all line meshes
  private _sharedRTEUniforms = {
    modelViewMatrixRTE: { value: new Matrix4() },
    cameraPositionHigh: { value: new Vector3() },
    cameraPositionLow: { value: new Vector3() },
  };

  constructor(config: Partial<SmoothLineConfig>[] = []) {
    super();

    this._config = config.map((cfg) => {
      return { ...DefaultSmoothLineConfig, ...cfg };
    });

    if (this._config.length < 1) {
      return;
    }

    this.updatePointsData();
    this.initSubMeshes();
    this.setupRTECallback();
  }

  private updatePointsData(): void {
    this._pointsData = this._config.map((cfg) => {
      return cfg.points.map((point) => {
        return geodeticToVector3({
          lat: degreeToRadian(point.lat),
          lng: degreeToRadian(point.lng),
          height: point.height || 0,
        });
      });
    });
  }

  private initSubMeshes(): void {
    this._config.forEach((cfg, i) => {
      if (cfg.points.length > 1) {
        const lineMesh = this.createLineMesh(cfg, i);
        this._lineMeshes.push(lineMesh);
        this.add(lineMesh);

        const spherePoint = this.createSpherePointMesh(cfg, i);
        if (spherePoint) {
          this._pointsMeshes.push(spherePoint);
          this.add(spherePoint);
        }
      }
    });
  }

  private createLinePosAttr(
    config: SmoothLineConfig,
    index: number,
  ): {
    positionsHigh: Float32Array;
    positionsLow: Float32Array;
  } {
    // Create CatmullRom curve
    const curve = new CatmullRomCurve3(
      this._pointsData[index],
      config.closed,
      "catmullrom",
      config.tension,
    );

    // Sample points from the curve
    const segments = Math.max(
      DefaultSmoothLineConfig.segments,
      Math.floor(config.segments),
    );
    const points = curve.getPoints((config.points.length - 1) * segments);

    // If closed, add first point at the end
    if (config.closed && points.length > 0) {
      points.push(points[0].clone());
    }

    // Encode positions as RTE high/low components
    const positionsHigh = new Float32Array(points.length * 3);
    const positionsLow = new Float32Array(points.length * 3);

    for (let i = 0; i < points.length; i++) {
      const encoded = encodePosition(points[i].x, points[i].y, points[i].z);
      positionsHigh[3 * i + 0] = encoded.high.x;
      positionsHigh[3 * i + 1] = encoded.high.y;
      positionsHigh[3 * i + 2] = encoded.high.z;
      positionsLow[3 * i + 0] = encoded.low.x;
      positionsLow[3 * i + 1] = encoded.low.y;
      positionsLow[3 * i + 2] = encoded.low.z;
      encoded.free();
    }

    return { positionsHigh, positionsLow };
  }

  private createLineMesh(config: SmoothLineConfig, index: number): Line2 {
    if (config.points.length < 2) {
      return new Line2(new LineGeometry(), new LineMaterial());
    }

    const { positionsHigh, positionsLow } = this.createLinePosAttr(
      config,
      index,
    );

    const geometry = new LineGeometry();

    // Reconstruct full positions from high/low for LineGeometry setup
    // IMPORTANT: Must use real world-space positions (not dummy/zero data) because:
    // 1. LineGeometry.setPositions() calculates bounding box/sphere for frustum culling
    // 2. line.computeLineDistances() depends on real positions to calculate cumulative distances
    //    for dashed lines (instanceDistanceStart/instanceDistanceEnd attributes)
    const fullPositions = new Float32Array(positionsHigh.length);
    for (let i = 0; i < positionsHigh.length; i++) {
      fullPositions[i] = positionsHigh[i] + positionsLow[i];
    }
    geometry.setPositions(fullPositions);

    // Now create RTE versions of instanceStart and instanceEnd
    const numPoints = positionsHigh.length / 3;
    const instanceStartHigh = new Float32Array((numPoints - 1) * 3);
    const instanceStartLow = new Float32Array((numPoints - 1) * 3);
    const instanceEndHigh = new Float32Array((numPoints - 1) * 3);
    const instanceEndLow = new Float32Array((numPoints - 1) * 3);

    // Fill RTE instance attributes (each line segment from point i to point i+1)
    for (let i = 0; i < numPoints - 1; i++) {
      // Start point
      instanceStartHigh[i * 3 + 0] = positionsHigh[i * 3 + 0];
      instanceStartHigh[i * 3 + 1] = positionsHigh[i * 3 + 1];
      instanceStartHigh[i * 3 + 2] = positionsHigh[i * 3 + 2];
      instanceStartLow[i * 3 + 0] = positionsLow[i * 3 + 0];
      instanceStartLow[i * 3 + 1] = positionsLow[i * 3 + 1];
      instanceStartLow[i * 3 + 2] = positionsLow[i * 3 + 2];

      // End point
      instanceEndHigh[i * 3 + 0] = positionsHigh[(i + 1) * 3 + 0];
      instanceEndHigh[i * 3 + 1] = positionsHigh[(i + 1) * 3 + 1];
      instanceEndHigh[i * 3 + 2] = positionsHigh[(i + 1) * 3 + 2];
      instanceEndLow[i * 3 + 0] = positionsLow[(i + 1) * 3 + 0];
      instanceEndLow[i * 3 + 1] = positionsLow[(i + 1) * 3 + 1];
      instanceEndLow[i * 3 + 2] = positionsLow[(i + 1) * 3 + 2];
    }

    // Add RTE instance attributes (must be InstancedBufferAttribute like instanceStart/instanceEnd)
    geometry.setAttribute(
      "instanceStartHigh",
      new InstancedBufferAttribute(instanceStartHigh, 3),
    );
    geometry.setAttribute(
      "instanceStartLow",
      new InstancedBufferAttribute(instanceStartLow, 3),
    );
    geometry.setAttribute(
      "instanceEndHigh",
      new InstancedBufferAttribute(instanceEndHigh, 3),
    );
    geometry.setAttribute(
      "instanceEndLow",
      new InstancedBufferAttribute(instanceEndLow, 3),
    );

    // Create Line2 material
    const material = new LineMaterial({
      color: config.color,
      linewidth: config.lineWidth,
      dashed: config.dashed,
      transparent: false,
    });

    if (config.dashed) {
      material.dashSize = config.dashSize;
      material.gapSize = config.gapSize;
      material.dashOffset = config.dashOffset;
    }

    material.resolution.set(1920, 1080);
    overrideLineMaterialForMRT(material);

    // Inject RTE shader code via onBeforeCompile
    this.injectRTEShaderCode(material);

    // Create Line2 mesh
    const line = new Line2(geometry, material);
    if (config.dashed) {
      line.computeLineDistances();
    }

    return line;
  }

  private createSpherePointMesh(
    config: SmoothLineConfig,
    index: number,
  ): SpherePoints {
    // Create SpherePoint with the renderer
    const spherePoint = new SpherePoints({
      size: config.pointSize,
      color: config.pointColor,
      visible: config.showPoints,
    });

    // Set the control points as sphere points
    spherePoint.setPoints(this._pointsData[index]);

    return spherePoint;
  }

  updateConfig(newConfig: Partial<SmoothLineConfig>[]) {
    newConfig.forEach((cfg, i) => {
      if (!this._config[i]) {
        this._config[i] = { ...DefaultSmoothLineConfig, ...cfg };
        if (this._config[i].points.length > 1) {
          const lineMesh = this.createLineMesh(this._config[i], i);
          this._lineMeshes.push(lineMesh);
          this.add(lineMesh);

          const spherePoint = this.createSpherePointMesh(this._config[i], i);
          if (spherePoint) {
            this._pointsMeshes.push(spherePoint);
            this.add(spherePoint);
          }

          this.setupRTECallback();
        }
      } else {
        this.updateLineCfg(cfg, i);
        this.updatePointsCfg(cfg, i);
      }
    });
  }

  updateLineCfg(cfg: Partial<SmoothLineConfig>, i: number): void {
    let needRebuildLine = false;
    if (cfg.points !== undefined) {
      let pointsChanged = cfg.points.length !== this._config[i].points.length;
      if (!pointsChanged) {
        for (let j = 0; j < cfg.points.length; j++) {
          if (
            cfg.points[j].lng !== this._config[i].points[j].lng ||
            cfg.points[j].lat !== this._config[i].points[j].lat ||
            cfg.points[j].height !== this._config[i].points[j].height
          ) {
            pointsChanged = true;
            break;
          }
        }
      }

      if (pointsChanged) {
        this._config[i].points = cfg.points;
        this.updatePointsData();

        needRebuildLine = true;

        if (this._pointsMeshes[i]) {
          this._pointsMeshes[i].setPoints(this._pointsData[i]);
        }
      }
    }

    if (cfg.tension !== undefined && cfg.tension !== this._config[i].tension) {
      this._config[i].tension = cfg.tension;
      needRebuildLine = true;
    }

    if (cfg.closed !== undefined && cfg.closed !== this._config[i].closed) {
      this._config[i].closed = cfg.closed;
      needRebuildLine = true;
    }

    if (
      cfg.segments !== undefined &&
      cfg.segments !== this._config[i].segments
    ) {
      this._config[i].segments = cfg.segments;
      needRebuildLine = true;
    }

    if (needRebuildLine) {
      if (this._lineMeshes[i]) {
        this._lineMeshes[i].geometry.dispose();
        this._lineMeshes[i].material.dispose();
        this.remove(this._lineMeshes[i]);
      }
      const lineMesh = this.createLineMesh(this._config[i], i);
      this._lineMeshes[i] = lineMesh;
      this.add(lineMesh);

      // Re-setup RTE callback after rebuilding
      this.setupRTECallback();
    }

    if (
      cfg.lineWidth !== undefined &&
      cfg.lineWidth !== this._config[i].lineWidth
    ) {
      this._config[i].lineWidth = cfg.lineWidth;
      if (this._lineMeshes[i]) {
        const material = this._lineMeshes[i].material as LineMaterial;
        material.linewidth = cfg.lineWidth;
      }
    }

    if (cfg.color !== undefined && cfg.color !== this._config[i].color) {
      this._config[i].color = cfg.color;
      if (this._lineMeshes[i]) {
        const material = this._lineMeshes[i].material as LineMaterial;
        material.color.setHex(cfg.color);
      }
    }

    if (cfg.dashed !== undefined && cfg.dashed !== this._config[i].dashed) {
      this._config[i].dashed = cfg.dashed;
    }

    if (
      cfg.dashSize !== undefined &&
      cfg.dashSize !== this._config[i].dashSize
    ) {
      this._config[i].dashSize = cfg.dashSize;
    }

    if (cfg.gapSize !== undefined && cfg.gapSize !== this._config[i].gapSize) {
      this._config[i].gapSize = cfg.gapSize;
    }

    if (
      cfg.dashOffset !== undefined &&
      cfg.dashOffset !== this._config[i].dashOffset
    ) {
      this._config[i].dashOffset = cfg.dashOffset;
    }

    if (this._lineMeshes[i]) {
      const material = this._lineMeshes[i].material as LineMaterial;
      material.dashed = this._config[i].dashed;
      if (this._config[i].dashed) {
        material.dashSize = this._config[i].dashSize;
        material.gapSize = this._config[i].gapSize;
        material.dashOffset = this._config[i].dashOffset;
        this._lineMeshes[i].computeLineDistances();
      }
    }
  }

  updatePointsCfg(cfg: Partial<SmoothLineConfig>, i: number): void {
    let needUpdatePoints = false;
    if (
      cfg.showPoints !== undefined &&
      cfg.showPoints !== this._config[i].showPoints
    ) {
      this._config[i].showPoints = cfg.showPoints;
      needUpdatePoints = true;
    }

    if (
      cfg.pointSize !== undefined &&
      cfg.pointSize !== this._config[i].pointSize
    ) {
      this._config[i].pointSize = cfg.pointSize;
      needUpdatePoints = true;
    }

    if (
      cfg.pointColor !== undefined &&
      cfg.pointColor !== this._config[i].pointColor
    ) {
      this._config[i].pointColor = cfg.pointColor;
      needUpdatePoints = true;
    }

    if (needUpdatePoints && this._pointsMeshes[i]) {
      this._pointsMeshes[i].setOptions({
        size: this._config[i].pointSize,
        color: this._config[i].pointColor,
        visible: this._config[i].showPoints,
      });
    }
  }

  /**
   * Inject RTE shader code into LineMaterial via onBeforeCompile
   */
  private injectRTEShaderCode(material: LineMaterial): void {
    // Store shared RTE uniforms reference
    const sharedUniforms = this._sharedRTEUniforms;

    material.onBeforeCompile = (shader) => {
      // Add RTE uniforms
      shader.uniforms.u_cameraPositionHigh = sharedUniforms.cameraPositionHigh;
      shader.uniforms.u_cameraPositionLow = sharedUniforms.cameraPositionLow;
      shader.uniforms.modelViewMatrixRTE = sharedUniforms.modelViewMatrixRTE;

      // Modify vertex shader to use RTE instance attributes
      shader.vertexShader = createReplacer(shader.vertexShader)
        // Add RTE uniforms after instanceEnd attribute
        .replace(
          "attribute vec3 instanceEnd;",
          /* glsl */ `attribute vec3 instanceEnd;

        // RTE uniforms
        uniform vec3 u_cameraPositionHigh;
        uniform vec3 u_cameraPositionLow;
        uniform mat4 modelViewMatrixRTE;

        // RTE instance attributes
        attribute vec3 instanceStartHigh;
        attribute vec3 instanceStartLow;
        attribute vec3 instanceEndHigh;
        attribute vec3 instanceEndLow;`,
        )
        // Replace the start transformation
        .replace(
          "vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );",
          /* glsl */ `// Decode RTE position for start point
        vec3 startHighDiff = instanceStartHigh - u_cameraPositionHigh;
        vec3 startLowDiff = instanceStartLow - u_cameraPositionLow;
        vec3 startRTE = startHighDiff + startLowDiff;
        vec4 start = modelViewMatrixRTE * vec4( startRTE, 1.0 );`,
        )
        // Replace the end transformation
        .replace(
          "vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );",
          /* glsl */ `// Decode RTE position for end point
        vec3 endHighDiff = instanceEndHigh - u_cameraPositionHigh;
        vec3 endLowDiff = instanceEndLow - u_cameraPositionLow;
        vec3 endRTE = endHighDiff + endLowDiff;
        vec4 end = modelViewMatrixRTE * vec4( endRTE, 1.0 );`,
        ).source;
    };

    // Mark material as customized
    material.needsUpdate = true;
  }

  /**
   * Setup RTE callback for camera-relative rendering
   */
  private setupRTECallback(): void {
    if (this._lineMeshes.length === 0) {
      return;
    }

    const identityMatrix = new Matrix4();
    const tempModelViewMatrix = new Matrix4();
    const firstMesh = this._lineMeshes[0];

    // Save the original onBeforeRender from LineSegments2
    // It updates the resolution uniform which is critical for line width rendering
    const originalOnBeforeRender = firstMesh.onBeforeRender.bind(firstMesh);

    // Create the callback with proper Mesh.onBeforeRender signature
    // Line2 extends LineSegments2 extends Mesh, so it has the standard signature
    const callback: typeof Object3D.prototype.onBeforeRender = (
      renderer,
      _scene,
      camera,
    ) => {
      // First, call the original LineSegments2.onBeforeRender to update resolution
      // LineSegments2.onBeforeRender only needs the renderer parameter
      originalOnBeforeRender(renderer);

      // Then, update RTE uniforms
      // Calculate RTE model-view matrix
      calcModelMatrixRTE(
        identityMatrix,
        camera.matrixWorldInverse,
        tempModelViewMatrix,
      );

      // Calculate camera position in high/low precision
      const result = calcCameraPosition(camera.position, identityMatrix);

      // Update shared RTE uniforms
      this._sharedRTEUniforms.modelViewMatrixRTE.value.copy(
        tempModelViewMatrix,
      );
      this._sharedRTEUniforms.cameraPositionHigh.value.copy(result.high);
      this._sharedRTEUniforms.cameraPositionLow.value.copy(result.low);
    };

    // Set callback on the first Line2 mesh (all meshes share the uniforms)
    // Cast to Object3D to use the standard onBeforeRender signature
    (firstMesh as Object3D).onBeforeRender = callback;
  }

  dispose(): void {
    this._lineMeshes.forEach((mesh) => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    });

    this._pointsMeshes.forEach((spherePoint) => {
      spherePoint.dispose();
    });
  }

  onResize(width: number, height: number): void {
    const pixelRatio = window.devicePixelRatio || 1;
    this._lineMeshes.forEach((mesh) => {
      const material = mesh.material as LineMaterial;
      material.resolution.set(width * pixelRatio, height * pixelRatio);
    });
  }
}
