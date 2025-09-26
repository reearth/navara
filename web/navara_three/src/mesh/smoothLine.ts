import type { LngLatHeight } from "@navara/core";
import { geodeticToVector3, degreeToRadian, LLE } from "@navara/three_api";

import { Object3D, CatmullRomCurve3, Vector3 } from "three";

import { overrideLineMaterialForMRT } from "../material";
import { SpherePoints } from "./spherePoints";

import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

export type SmoothLineConfig = {
  tension: number; // Curve stiffness: 0 = straight lines, higher = smoother curves (often 0–1)
  closed: boolean; // Whether the polyline is closed (connect the last point back to the first).
  segments: number; // Number of interpolation segments between each pair of input points.
  lineWidth: number; // Line thickness (in pixels)
  dashed: boolean; // Render the line with a dashed pattern
  dashSize: number; // Length of each dash unit when dashed is true
  gapSize: number; // Length of the gap between dashes when dashed is true
  color: number; // Line color as a hex integer (e.g., 0xff0000)
  showPoints: boolean; // Whether to display the sample points along the line
  pointSize: number; // Size of the point markers
  pointColor: number; // Point color as a hex integer (e.g., 0x00ff00)
  points: LngLatHeight[]; // Source positions as [lng, lat, height]
};

export const DefaultSmoothLineConfig: SmoothLineConfig = {
  tension: 0.5,
  closed: false,
  segments: 1,
  lineWidth: 1,
  dashed: false,
  dashSize: 1000,
  gapSize: 500,
  color: 0xffffff,
  showPoints: true,
  pointSize: 2,
  pointColor: 0xffffff,
  points: [],
};

export class SmoothLine extends Object3D {
  private readonly _curveType: "centripetal" | "chordal" | "catmullrom" =
    "catmullrom";
  private readonly _config: SmoothLineConfig[];
  private _lineMeshes: Line2[] = [];
  private _pointsMeshes: SpherePoints[] = [];
  private _pointsData: Vector3[][] = [];

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
  }

  private updatePointsData(): void {
    this._pointsData = this._config.map((cfg) => {
      return cfg.points.map((point) => {
        const lle = new LLE(
          degreeToRadian(point.lat),
          degreeToRadian(point.lng),
          point.height || 0,
        );
        return geodeticToVector3(lle);
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
  ): Float32Array {
    // Create CatmullRom curve
    const curve = new CatmullRomCurve3(
      this._pointsData[index],
      config.closed,
      this._curveType,
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

    // Create Line2 geometry
    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[3 * i + 0] = points[i].x;
      positions[3 * i + 1] = points[i].y;
      positions[3 * i + 2] = points[i].z;
    }

    return positions;
  }

  private createLineMesh(config: SmoothLineConfig, index: number): Line2 {
    if (config.points.length < 2) {
      return new Line2(new LineGeometry(), new LineMaterial());
    }

    const positions = this.createLinePosAttr(config, index);

    const geometry = new LineGeometry();
    geometry.setPositions(positions);

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
    }

    material.resolution.set(1920, 1080);
    overrideLineMaterialForMRT(material);

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

    if (this._lineMeshes[i]) {
      const material = this._lineMeshes[i].material as LineMaterial;
      material.dashed = this._config[i].dashed;
      if (this._config[i].dashed) {
        material.dashSize = this._config[i].dashSize;
        material.gapSize = this._config[i].gapSize;
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
