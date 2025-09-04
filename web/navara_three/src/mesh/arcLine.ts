import type { LngLat } from "@navara/core";
import {
  getWGS84SemiMajorAxis,
  getWGS84SemiMinorAxis,
  getWGS84EccentricitySquared,
  geodeticToVector3,
  degreeToRadian,
  LLE,
} from "@navara/three_api";

import {
  Mesh,
  InstancedBufferGeometry,
  ShaderMaterial,
  BufferAttribute,
  InstancedBufferAttribute,
  Vector2,
  Color,
  DoubleSide,
  Sphere,
  Box3,
} from "three";

import ArclineVertShader from "@shaders/glsl/arcLine.vert.glsl";
import { FEATURE_RENDER_ORDER } from "../renderOrder";

export type ArcLineConfig = {
  thickness: number;
  opacity: number;
  segments: number;
  srcColor: number;
  tgtColor: number;
  height: number;
  arcHeightScale: number;
  geometry: LngLat[];
};

export const DefaultArcLineConfig: ArcLineConfig = {
  thickness: 1,
  opacity: 1,
  segments: 64,
  srcColor: 0xffffff,
  tgtColor: 0xffffff,
  height: 0,
  arcHeightScale: 0.3,
  geometry: [],
};

export class ArcLine extends Mesh<InstancedBufferGeometry, ShaderMaterial> {
  private readonly _config: ArcLineConfig;

  constructor(config: Partial<ArcLineConfig> = {}) {
    const fullConfig = { ...DefaultArcLineConfig, ...config };

    super(new InstancedBufferGeometry(), new ShaderMaterial());

    this._config = fullConfig;
    this.renderOrder = FEATURE_RENDER_ORDER;

    this.initGeometry();
    this.initMaterial();
    this.updateInstanceData();
    this.updateBoundingSphere();
  }

  private initGeometry(): void {
    const geo = this.geometry;
    const config = this._config;
    const steps = config.segments + 1;
    const vertCount = steps * 2;
    const indCount = config.segments * 6;
    const numInstances = Math.floor(config.geometry.length / 2);

    // Clear existing attributes and index if they exist
    const attributeNames = Object.keys(geo.attributes);
    for (const name of attributeNames) {
      geo.deleteAttribute(name);
    }
    geo.setIndex(null);

    // Base geometry - template for single arc line
    const positions = new Float32Array(vertCount * 3);
    const aT = new Float32Array(vertCount);
    const aSide = new Float32Array(vertCount);
    const indices = new Uint32Array(indCount);

    // Fill base geometry data
    let p3 = 0,
      p1 = 0;
    for (let i = 0; i < steps; i++) {
      const tt = i / config.segments;
      for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
        const side = sideIdx === 0 ? -1 : 1;

        // Position will be recalculated in shader, set to 0 here
        positions[p3] = positions[p3 + 1] = positions[p3 + 2] = 0;
        aT[p1] = tt;
        aSide[p1] = side;

        p3 += 3;
        p1++;
      }
    }

    // Fill indices
    let ip = 0;
    for (let i = 0; i < config.segments; i++) {
      const i0 = i * 2;
      const i1 = i0 + 1;
      const i2 = (i + 1) * 2;
      const i3 = i2 + 1;

      indices[ip++] = i0;
      indices[ip++] = i1;
      indices[ip++] = i2;
      indices[ip++] = i1;
      indices[ip++] = i3;
      indices[ip++] = i2;
    }

    geo.setIndex(new BufferAttribute(indices, 1));
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    geo.setAttribute("aT", new BufferAttribute(aT, 1));
    geo.setAttribute("aSide", new BufferAttribute(aSide, 1));

    // Instance attribute arrays (lon/lat coordinates)
    const instanceSources = new Float32Array(numInstances * 2);
    const instanceTargets = new Float32Array(numInstances * 2);
    const instanceHeights = new Float32Array(numInstances);

    geo.setAttribute(
      "aInstanceSource",
      new InstancedBufferAttribute(instanceSources, 2),
    );
    geo.setAttribute(
      "aInstanceTarget",
      new InstancedBufferAttribute(instanceTargets, 2),
    );
    geo.setAttribute(
      "aInstanceHeight",
      new InstancedBufferAttribute(instanceHeights, 1),
    );
  }

  private initMaterial(): void {
    const WGS84_A = getWGS84SemiMajorAxis();
    const WGS84_B = getWGS84SemiMinorAxis();
    const WGS84_E2 = getWGS84EccentricitySquared();

    const config = this._config;

    this.material.vertexShader = ArclineVertShader;
    this.material.fragmentShader = `
      uniform float uOpacity;
      varying vec3 vColor;

      #include <logdepthbuf_pars_fragment>

      void main() {
        gl_FragColor = vec4(vColor, uOpacity);
        
        #include <logdepthbuf_fragment>
      }
    `;

    this.material.uniforms = {
      uThickness: { value: config.thickness },
      uViewport: { value: new Vector2(1920, 1080) },
      uSegments: { value: config.segments },
      uOpacity: { value: config.opacity },
      uHeight: { value: config.height },
      uR: { value: WGS84_A },
      uA: { value: WGS84_A },
      uB: { value: WGS84_B },
      uE2: { value: WGS84_E2 },
    };

    this.material.uniforms.uSrcColor = { value: new Color(config.srcColor) };
    this.material.uniforms.uTgtColor = { value: new Color(config.tgtColor) };

    this.material.depthTest = true;
    this.material.depthWrite = true;
    this.material.transparent = config.opacity < 1.0;
    this.material.side = DoubleSide;
  }

  private updateInstanceData(): void {
    if (!this._config.geometry.length) {
      this.geometry.instanceCount = 0;
      return;
    }

    const numInstances = Math.floor(this._config.geometry.length / 2);

    const instanceSources = this.geometry.getAttribute(
      "aInstanceSource",
    ) as InstancedBufferAttribute;
    const instanceTargets = this.geometry.getAttribute(
      "aInstanceTarget",
    ) as InstancedBufferAttribute;
    const instanceHeights = this.geometry.getAttribute(
      "aInstanceHeight",
    ) as InstancedBufferAttribute;

    // Set the instance count for rendering
    this.geometry.instanceCount = numInstances;

    for (let i = 0; i < numInstances; i++) {
      const geom1 = this._config.geometry[i * 2];
      const geom2 = this._config.geometry[i * 2 + 1];

      const lle1 = new LLE(
        degreeToRadian(geom1.lng),
        degreeToRadian(geom1.lat),
        0,
      );
      const lle2 = new LLE(
        degreeToRadian(geom2.lng),
        degreeToRadian(geom2.lat),
        0,
      );

      const pos1 = geodeticToVector3(lle1);
      const pos2 = geodeticToVector3(lle2);
      const dist = pos1.distanceTo(pos2);

      instanceSources.setXY(i, geom1.lng, geom1.lat);
      instanceTargets.setXY(i, geom2.lng, geom2.lat);
      instanceHeights.setX(i, dist * this._config.arcHeightScale);
    }

    instanceSources.needsUpdate = true;
    instanceTargets.needsUpdate = true;
    instanceHeights.needsUpdate = true;
  }

  private updateBoundingSphere(): void {
    if (!this._config.geometry.length) return;

    const box = new Box3();

    // Process each arc (pairs of points)
    for (let i = 0; i < this._config.geometry.length; i += 2) {
      if (i + 1 >= this._config.geometry.length) break;

      const point1 = this._config.geometry[i];
      const point2 = this._config.geometry[i + 1];

      const pos1 = geodeticToVector3(
        new LLE(
          degreeToRadian(point1.lng),
          degreeToRadian(point1.lat),
          this._config.height,
        ),
      );
      const pos2 = geodeticToVector3(
        new LLE(
          degreeToRadian(point2.lng),
          degreeToRadian(point2.lat),
          this._config.height,
        ),
      );

      box.expandByPoint(pos1);
      box.expandByPoint(pos2);

      // Add arc peak point (t = 0.5, where sin(PI * t) = 1, maximum height)
      const midLng = (point1.lng + point2.lng) / 2;
      const midLat = (point1.lat + point2.lat) / 2;

      const dist = pos1.distanceTo(pos2);

      // The top of the arc is calculated in the shader, and the calculation method
      // here is not accurate—it's only used to estimate the bounding box.
      const peakHeight =
        this._config.height + dist * this._config.arcHeightScale;
      const peakLLE = new LLE(
        degreeToRadian(midLng),
        degreeToRadian(midLat),
        peakHeight,
      );
      box.expandByPoint(geodeticToVector3(peakLLE));
    }

    this.geometry.boundingBox = box;
    this.geometry.boundingSphere = new Sphere();
    this.geometry.boundingBox.getBoundingSphere(this.geometry.boundingSphere);

    // Disable auto computation
    this.geometry.computeBoundingBox = () => {};
    this.geometry.computeBoundingSphere = () => {};
  }

  updateConfig(newConfig: Partial<ArcLineConfig>) {
    const segmentsChanged =
      newConfig.segments !== undefined &&
      newConfig.segments !== this._config.segments;
    const heightChanged =
      newConfig.height !== undefined &&
      newConfig.height !== this._config.height;
    const arcHeightScaleChanged =
      newConfig.arcHeightScale !== undefined &&
      newConfig.arcHeightScale !== this._config.arcHeightScale;

    if (newConfig.thickness !== undefined)
      this._config.thickness = newConfig.thickness;
    if (newConfig.opacity !== undefined)
      this._config.opacity = newConfig.opacity;
    if (newConfig.segments !== undefined)
      this._config.segments = newConfig.segments;
    if (newConfig.srcColor !== undefined)
      this._config.srcColor = newConfig.srcColor;
    if (newConfig.tgtColor !== undefined)
      this._config.tgtColor = newConfig.tgtColor;
    if (newConfig.height !== undefined) this._config.height = newConfig.height;
    if (newConfig.geometry !== undefined)
      this._config.geometry = newConfig.geometry;
    if (newConfig.arcHeightScale !== undefined)
      this._config.arcHeightScale = newConfig.arcHeightScale;

    this.material.uniforms.uThickness.value = this._config.thickness;
    this.material.uniforms.uOpacity.value = this._config.opacity;
    this.material.uniforms.uSegments.value = this._config.segments;
    this.material.uniforms.uHeight.value = this._config.height;
    this.material.uniforms.uSrcColor.value.set(this._config.srcColor);
    this.material.uniforms.uTgtColor.value.set(this._config.tgtColor);

    this.material.transparent = this._config.opacity < 1.0;

    if (segmentsChanged) {
      this.initGeometry();
    }

    if (heightChanged || arcHeightScaleChanged) {
      this.updateBoundingSphere();
    }

    if (segmentsChanged || heightChanged || arcHeightScaleChanged) {
      this.updateInstanceData();
    }
  }

  onResize(width: number, height: number): void {
    this.material.uniforms?.uViewport.value.set(width, height);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
