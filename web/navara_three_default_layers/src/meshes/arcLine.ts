import type { LatLng } from "@navara/core";
import { encodePosition } from "@navara/engine-api";
import {
  Color,
  overrideShaderMaterialForMRT,
  setupRTEBeforeRender,
} from "@navara/three";
import {
  getWGS84SemiMajorAxis,
  getWGS84EccentricitySquared,
  geodeticToVector3,
  degreeToRadian,
} from "@navara/three_api";
import ArclineFragShader from "@shaders/glsl/arcLine.frag.glsl";
import ArclineVertShader from "@shaders/glsl/arcLine.vert.glsl";
import {
  Object3D,
  Mesh,
  InstancedBufferGeometry,
  ShaderMaterial,
  BufferAttribute,
  InstancedBufferAttribute,
  InterleavedBufferAttribute,
  Vector2,
  Vector3,
  Matrix4,
  DoubleSide,
  Sphere,
  Box3,
} from "three";

export type ArcLineConfig = {
  thickness: number; // Thickness of the arc line
  transparent: boolean; // Enable `opacity`.
  opacity: number; // Opacity of the arc line
  segments: number; // Number of segments per arc line
  srcColor: Color; // Source color of the arc line
  tgtColor: Color; // Target color of the arc line
  height: number; // height from globe surface
  arcHeightScale: number; // Scale factor for arc height relative to distance between endpoints
  gradation: number; // Gradation factor for color interpolation along the arc
  dashed: boolean; // Enable dashed line
  dashSize: number; // Length of each dash (in world units)
  gapSize: number; // Length of gap between dashes (in world units)
  dashOffset: number; // Offset for dash pattern (in world units)
  geometry: LatLng[]; // Array of points in [lng, lat] pairs; each pair defines one arc line
};

export const DefaultArcLineConfig: ArcLineConfig = {
  thickness: 1,
  transparent: false,
  opacity: 1,
  segments: 64,
  srcColor: new Color().setHex(0xffffff),
  tgtColor: new Color().setHex(0xffffff),
  height: 0,
  arcHeightScale: 0.3,
  gradation: 0.5,
  dashed: false,
  dashSize: 1,
  gapSize: 1,
  dashOffset: 0,
  geometry: [],
};

/**
 * ArcLine - Geodesic arc line renderer for 3D globe visualization
 *
 * Renders arc lines between geographic coordinates on a WGS84 ellipsoid using
 * RTE (Relative-To-Eye) rendering for high precision.
 *
 * **Implementation:**
 * - ECEF coordinates are calculated on CPU side and encoded as high/low precision components
 * - Shader applies RTE transformation to maintain precision near the camera
 * - Geodesic interpolation is performed in absolute coordinates before RTE transformation
 *
 * **Precision Limitations:**
 * Due to floating-point precision constraints in the current implementation,
 * arc lines should be approximately **2km or longer** for reliable rendering.
 * Shorter arc lines may exhibit visual artifacts or precision issues.
 *
 * If future requirements need to support arc lines shorter than 2km,
 * the implementation will need to be redesigned with:
 * - RTC (Relative-To-Center) coordinate system per batch
 * - Alternative interpolation strategies
 * - Different vertex encoding schemes
 */
export class ArcLine extends Object3D {
  private readonly _config: ArcLineConfig[];
  private _subMeshes: Mesh<InstancedBufferGeometry, ShaderMaterial>[] = [];

  // Shared RTE uniforms for all sub-meshes
  private _sharedRTEUniforms = {
    modelViewMatrixRTE: { value: new Matrix4() },
    cameraPositionHigh: { value: new Vector3() },
    cameraPositionLow: { value: new Vector3() },
  };

  constructor(config: Partial<ArcLineConfig>[] = []) {
    super();

    this._config = config.map((cfg) => {
      return { ...DefaultArcLineConfig, ...cfg };
    });

    if (this._config.length < 1) {
      return;
    }

    this.initSubMeshes();
    this.updateBoundingSphere();
  }

  private initSubMeshes(): void {
    // Clear existing sub-meshes
    this._subMeshes.forEach((mesh) => {
      mesh.geometry.dispose();
      mesh.material.dispose();
      this.remove(mesh);
    });
    this._subMeshes = [];

    // Create a sub-mesh for each config
    this._config.forEach((cfg) => {
      const subMesh = this.createSubMesh(cfg);
      this._subMeshes.push(subMesh);
      this.add(subMesh);
    });

    // Setup shared RTE callback for all sub-meshes
    // All sub-meshes share the same RTE uniforms and can use the same modelViewMatrixRTE because:
    // 1. All sub-meshes are at origin (no local transforms)
    // 2. Real world positions are encoded in ECEF coordinates (per-instance attributes)
    // 3. modelViewMatrixRTE = identityMatrix * camera.matrixWorldInverse (rotation-only view matrix)
    // Only the first sub-mesh needs onBeforeRender/onBeforeShadow callbacks to update shared uniforms
    if (this._subMeshes.length > 0) {
      const identityMatrix = new Matrix4();
      const callback = setupRTEBeforeRender(
        this,
        this._sharedRTEUniforms,
        identityMatrix,
        identityMatrix,
      );

      if (callback) {
        this._subMeshes[0].onBeforeRender = callback;
        this._subMeshes[0].onBeforeShadow = callback;
      }
    }
  }

  private createSubMesh(
    config: ArcLineConfig,
  ): Mesh<InstancedBufferGeometry, ShaderMaterial> {
    const geo = new InstancedBufferGeometry();

    // Create geometry for this specific config only
    this.fillSingleConfigAttributes(config, geo);

    // Create instance data for this config only
    const numInstances = Math.floor(config.geometry.length / 2);
    if (numInstances === 0) {
      return new Mesh(geo, new ShaderMaterial());
    }

    // RTE mode: ECEF coordinates with high/low precision encoding
    const instanceSourceHigh = new Float32Array(numInstances * 3);
    const instanceSourceLow = new Float32Array(numInstances * 3);
    const instanceTargetHigh = new Float32Array(numInstances * 3);
    const instanceTargetLow = new Float32Array(numInstances * 3);
    const instanceParams1 = new Float32Array(numInstances * 4);
    const instanceParams2 = new Float32Array(numInstances * 3);
    const instanceDash = new Float32Array(numInstances * 4);
    const instanceSrcColor = new Float32Array(numInstances * 3);
    const instanceTgtColor = new Float32Array(numInstances * 3);

    geo.setAttribute(
      "aInstanceSourceHigh",
      new InstancedBufferAttribute(instanceSourceHigh, 3),
    );
    geo.setAttribute(
      "aInstanceSourceLow",
      new InstancedBufferAttribute(instanceSourceLow, 3),
    );
    geo.setAttribute(
      "aInstanceTargetHigh",
      new InstancedBufferAttribute(instanceTargetHigh, 3),
    );
    geo.setAttribute(
      "aInstanceTargetLow",
      new InstancedBufferAttribute(instanceTargetLow, 3),
    );

    geo.setAttribute(
      "aInstanceParams1",
      new InstancedBufferAttribute(instanceParams1, 4),
    );
    geo.setAttribute(
      "aInstanceParams2",
      new InstancedBufferAttribute(instanceParams2, 3),
    );
    geo.setAttribute(
      "aInstanceDash",
      new InstancedBufferAttribute(instanceDash, 4),
    );
    geo.setAttribute(
      "aInstanceSrcColor",
      new InstancedBufferAttribute(instanceSrcColor, 3),
    );
    geo.setAttribute(
      "aInstanceTgtColor",
      new InstancedBufferAttribute(instanceTgtColor, 3),
    );

    // Fill instance data for this config
    this.fillSingleConfigInstanceData(config, geo);

    // Create material
    const material = this.createMaterial();
    material.transparent = config.transparent;

    const mesh = new Mesh(geo, material);

    // Share RTE uniforms from the ArcLine group
    material.uniforms.modelViewMatrixRTE =
      this._sharedRTEUniforms.modelViewMatrixRTE;
    material.uniforms.u_cameraPositionHigh =
      this._sharedRTEUniforms.cameraPositionHigh;
    material.uniforms.u_cameraPositionLow =
      this._sharedRTEUniforms.cameraPositionLow;

    return mesh;
  }

  /**
   * Calculate the arc length between two points considering elevation.
   * Uses circular arc approximation for better performance.
   *        ╱‾‾‾╲
   *      ╱   h   ╲  ← sagitta (arcHeight)
   *     ╱_________╲
   *          c        ← chord (surfaceDistance)
   * Given chord length (surface distance) and sagitta (arc height),
   * we calculate the arc length using the formula:
   * - Radius: R = c²/(8h) + h/2
   * - Central angle: θ = 2 * arcsin(c/(2R))
   * - Arc length: L = R * θ
   */
  private calculateArcLength(
    point1: LatLng,
    point2: LatLng,
    arcHeight: number,
  ): number {
    const WGS84_A = getWGS84SemiMajorAxis();

    // Calculate geodesic distance on ellipsoid surface using Haversine formula
    // (approximation using spherical Earth with WGS84 semi-major axis)
    const lat1 = degreeToRadian(point1.lat);
    const lat2 = degreeToRadian(point2.lat);
    const lng1 = degreeToRadian(point1.lng);
    const lng2 = degreeToRadian(point2.lng);

    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const surfaceDistance = WGS84_A * c;

    // If no arc height, return surface distance
    if (arcHeight === 0) {
      return surfaceDistance;
    }

    // Use circular arc approximation for fast calculation
    const chordLength = surfaceDistance;
    const sagitta = arcHeight;

    // Calculate radius of the circular arc: R = c²/(8h) + h/2
    const R = (chordLength * chordLength) / (8 * sagitta) + sagitta / 2;

    // Calculate central angle: θ = 2 * arcsin(c/(2R))
    const halfChord = chordLength / 2;
    const sinHalfTheta = Math.min(1, halfChord / R); // Clamp to avoid numerical errors
    const theta = 2 * Math.asin(sinHalfTheta);

    // Calculate arc length: L = R * θ
    const arcLength = R * theta;

    return arcLength;
  }

  private fillSingleConfigAttributes(
    config: ArcLineConfig,
    geo: InstancedBufferGeometry,
  ): void {
    const configSegments = Math.max(2, config.segments);
    const steps = configSegments + 1;
    const vertCount = steps * 2;
    const idxCount = configSegments * 6;

    const positions = new Float32Array(vertCount * 3);
    const aVertexData = new Float32Array(vertCount * 2); // x=aT, y=aSide
    const indices = new Uint32Array(idxCount);

    let ip = 0;
    let vertexIndex = 0;

    // Fill vertex attributes for this single config
    for (let i = 0; i < steps; i++) {
      const t = i / configSegments;

      // Pack vertex data: x=aT, y=aSide
      aVertexData[vertexIndex * 2] = t; // aT for bottom vertex
      aVertexData[vertexIndex * 2 + 1] = -1; // aSide for bottom vertex

      aVertexData[(vertexIndex + 1) * 2] = t; // aT for top vertex
      aVertexData[(vertexIndex + 1) * 2 + 1] = 1; // aSide for top vertex

      vertexIndex += 2;
    }

    // Fill indices for this config
    for (let i = 0; i < configSegments; i++) {
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
    geo.setAttribute("aVertexData", new BufferAttribute(aVertexData, 2));
  }

  /**
   * Set instance attributes for a single arc (low-level setter)
   */
  private setInstanceAttributes(
    i: number,
    config: ArcLineConfig,
    segments: number,
    arcHeight: number,
    arcLength: number,
    instanceParams1: BufferAttribute | InterleavedBufferAttribute,
    instanceParams2: BufferAttribute | InterleavedBufferAttribute,
    instanceDash: BufferAttribute | InterleavedBufferAttribute,
    instanceSrcColor: BufferAttribute | InterleavedBufferAttribute,
    instanceTgtColor: BufferAttribute | InterleavedBufferAttribute,
  ): void {
    instanceParams1.setXYZW(
      i,
      config.height,
      arcHeight,
      config.thickness,
      config.opacity,
    );

    instanceParams2.setXYZ(i, segments, config.gradation, arcLength);

    instanceDash.setXYZW(
      i,
      config.dashed ? 1.0 : 0.0,
      config.dashSize,
      config.gapSize,
      config.dashOffset,
    );

    const srcColor = config.srcColor.raw;
    const tgtColor = config.tgtColor.raw;
    instanceSrcColor.setXYZ(i, srcColor.r, srcColor.g, srcColor.b);
    instanceTgtColor.setXYZ(i, tgtColor.r, tgtColor.g, tgtColor.b);
  }

  /**
   * Fill instance data for common attributes (params, dash, colors)
   * Calculates arcHeight and arcLength from geometry
   */
  private fillInstanceCommonData(
    i: number,
    config: ArcLineConfig,
    geom1: LatLng,
    geom2: LatLng,
    dist: number,
    segments: number,
    instanceParams1: BufferAttribute | InterleavedBufferAttribute,
    instanceParams2: BufferAttribute | InterleavedBufferAttribute,
    instanceDash: BufferAttribute | InterleavedBufferAttribute,
    instanceSrcColor: BufferAttribute | InterleavedBufferAttribute,
    instanceTgtColor: BufferAttribute | InterleavedBufferAttribute,
  ): void {
    const arcHeight = dist * config.arcHeightScale;
    const arcLength = this.calculateArcLength(geom1, geom2, arcHeight);

    this.setInstanceAttributes(
      i,
      config,
      segments,
      arcHeight,
      arcLength,
      instanceParams1,
      instanceParams2,
      instanceDash,
      instanceSrcColor,
      instanceTgtColor,
    );
  }

  /**
   * Update arc parameters (no WASM calls)
   * Updates: thickness, opacity, gradation, colors, dash parameters, height
   * Reads existing arcHeight, segments, arcLength from buffer
   */
  private updateArcParameters(
    config: ArcLineConfig,
    geo: InstancedBufferGeometry,
  ): void {
    const numInstances = geo.instanceCount;
    if (numInstances === 0) return;

    const instanceParams1 = geo.getAttribute("aInstanceParams1");
    const instanceParams2 = geo.getAttribute("aInstanceParams2");
    const instanceDash = geo.getAttribute("aInstanceDash");
    const instanceSrcColor = geo.getAttribute("aInstanceSrcColor");
    const instanceTgtColor = geo.getAttribute("aInstanceTgtColor");

    const params1Array = instanceParams1.array as Float32Array;
    const params2Array = instanceParams2.array as Float32Array;

    for (let i = 0; i < numInstances; i++) {
      // Read existing values from buffer (no WASM calls)
      const offset1 = i * 4;
      const offset2 = i * 3;
      const existingArcHeight = params1Array[offset1 + 1];
      const existingSegments = params2Array[offset2];
      const existingArcLength = params2Array[offset2 + 2];

      this.setInstanceAttributes(
        i,
        config,
        existingSegments,
        existingArcHeight,
        existingArcLength,
        instanceParams1,
        instanceParams2,
        instanceDash,
        instanceSrcColor,
        instanceTgtColor,
      );
    }

    instanceParams1.needsUpdate = true;
    instanceParams2.needsUpdate = true;
    instanceDash.needsUpdate = true;
    instanceSrcColor.needsUpdate = true;
    instanceTgtColor.needsUpdate = true;
  }

  /**
   * Update arc height and length (requires WASM calls for distance/arc calculation)
   * Updates: arcHeightScale (need to recalculate arcHeight/arcLength)
   * Does NOT re-encode ECEF coordinates
   */
  private updateArcHeightAndLength(
    config: ArcLineConfig,
    geo: InstancedBufferGeometry,
  ): void {
    const numInstances = Math.floor(config.geometry.length / 2);
    if (numInstances === 0) return;

    const instanceParams1 = geo.getAttribute("aInstanceParams1");
    const instanceParams2 = geo.getAttribute("aInstanceParams2");
    const instanceDash = geo.getAttribute("aInstanceDash");
    const instanceSrcColor = geo.getAttribute("aInstanceSrcColor");
    const instanceTgtColor = geo.getAttribute("aInstanceTgtColor");

    const segments = Math.max(2, Math.floor(config.segments));

    for (let i = 0; i < numInstances; i++) {
      const geom1 = config.geometry[i * 2];
      const geom2 = config.geometry[i * 2 + 1];

      // Calculate ECEF positions and distance (WASM calls)
      const lle1 = {
        lat: degreeToRadian(geom1.lat),
        lng: degreeToRadian(geom1.lng),
        height: 0,
      };
      const lle2 = {
        lat: degreeToRadian(geom2.lat),
        lng: degreeToRadian(geom2.lng),
        height: 0,
      };

      const pos1 = geodeticToVector3(lle1);
      const pos2 = geodeticToVector3(lle2);
      const dist = pos1.distanceTo(pos2);

      // Recalculate arcHeight and arcLength from config
      const arcHeight = dist * config.arcHeightScale;
      const arcLength = this.calculateArcLength(geom1, geom2, arcHeight);

      this.setInstanceAttributes(
        i,
        config,
        segments,
        arcHeight,
        arcLength,
        instanceParams1,
        instanceParams2,
        instanceDash,
        instanceSrcColor,
        instanceTgtColor,
      );
    }

    instanceParams1.needsUpdate = true;
    instanceParams2.needsUpdate = true;
    instanceDash.needsUpdate = true;
    instanceSrcColor.needsUpdate = true;
    instanceTgtColor.needsUpdate = true;
  }

  /**
   * Fill instance data for RTE mode (ECEF coordinates with high/low encoding)
   */
  private fillInstanceDataRTE(
    config: ArcLineConfig,
    numInstances: number,
    segments: number,
    geo: InstancedBufferGeometry,
  ): void {
    const instanceSourceHigh = geo.getAttribute("aInstanceSourceHigh");
    const instanceSourceLow = geo.getAttribute("aInstanceSourceLow");
    const instanceTargetHigh = geo.getAttribute("aInstanceTargetHigh");
    const instanceTargetLow = geo.getAttribute("aInstanceTargetLow");
    const instanceParams1 = geo.getAttribute("aInstanceParams1");
    const instanceParams2 = geo.getAttribute("aInstanceParams2");
    const instanceDash = geo.getAttribute("aInstanceDash");
    const instanceSrcColor = geo.getAttribute("aInstanceSrcColor");
    const instanceTgtColor = geo.getAttribute("aInstanceTgtColor");

    for (let i = 0; i < numInstances; i++) {
      const geom1 = config.geometry[i * 2];
      const geom2 = config.geometry[i * 2 + 1];

      const lle1 = {
        lat: degreeToRadian(geom1.lat),
        lng: degreeToRadian(geom1.lng),
        height: 0,
      };
      const lle2 = {
        lat: degreeToRadian(geom2.lat),
        lng: degreeToRadian(geom2.lng),
        height: 0,
      };

      const pos1 = geodeticToVector3(lle1);
      const pos2 = geodeticToVector3(lle2);
      const dist = pos1.distanceTo(pos2);

      // Encode positions as high/low precision components for RTE
      const encoded1 = encodePosition(pos1.x, pos1.y, pos1.z);
      const encoded2 = encodePosition(pos2.x, pos2.y, pos2.z);

      instanceSourceHigh.setXYZ(
        i,
        encoded1.high.x,
        encoded1.high.y,
        encoded1.high.z,
      );
      instanceSourceLow.setXYZ(
        i,
        encoded1.low.x,
        encoded1.low.y,
        encoded1.low.z,
      );
      instanceTargetHigh.setXYZ(
        i,
        encoded2.high.x,
        encoded2.high.y,
        encoded2.high.z,
      );
      instanceTargetLow.setXYZ(
        i,
        encoded2.low.x,
        encoded2.low.y,
        encoded2.low.z,
      );

      encoded1.free();
      encoded2.free();

      this.fillInstanceCommonData(
        i,
        config,
        geom1,
        geom2,
        dist,
        segments,
        instanceParams1,
        instanceParams2,
        instanceDash,
        instanceSrcColor,
        instanceTgtColor,
      );
    }

    instanceSourceHigh.needsUpdate = true;
    instanceSourceLow.needsUpdate = true;
    instanceTargetHigh.needsUpdate = true;
    instanceTargetLow.needsUpdate = true;
  }

  private fillSingleConfigInstanceData(
    config: ArcLineConfig,
    geo: InstancedBufferGeometry,
  ): void {
    const numInstances = Math.floor(config.geometry.length / 2);
    geo.instanceCount = numInstances;

    if (numInstances === 0) return;

    const segments = Math.max(2, Math.floor(config.segments));

    this.fillInstanceDataRTE(config, numInstances, segments, geo);

    // Mark common attributes as updated
    const instanceParams1 = geo.getAttribute("aInstanceParams1");
    const instanceParams2 = geo.getAttribute("aInstanceParams2");
    const instanceDash = geo.getAttribute("aInstanceDash");
    const instanceSrcColor = geo.getAttribute("aInstanceSrcColor");
    const instanceTgtColor = geo.getAttribute("aInstanceTgtColor");

    instanceParams1.needsUpdate = true;
    instanceParams2.needsUpdate = true;
    instanceDash.needsUpdate = true;
    instanceSrcColor.needsUpdate = true;
    instanceTgtColor.needsUpdate = true;
  }

  private createMaterial(): ShaderMaterial {
    const WGS84_A = getWGS84SemiMajorAxis();
    const WGS84_E2 = getWGS84EccentricitySquared();

    const material = new ShaderMaterial();
    material.vertexShader = ArclineVertShader;
    material.fragmentShader = ArclineFragShader;

    material.uniforms = {
      uViewport: { value: new Vector2(1920, 1080) },
      uA: { value: WGS84_A },
      uE2: { value: WGS84_E2 },
      u_cameraPositionHigh: { value: new Vector3() },
      u_cameraPositionLow: { value: new Vector3() },
      modelViewMatrixRTE: { value: new Matrix4() },
    };

    material.depthTest = true;
    material.depthWrite = true;
    // material.transparent = true;
    material.side = DoubleSide;

    // Apply MRT support for G-Buffer output
    overrideShaderMaterialForMRT(material, "normal");

    return material;
  }

  private updateBoundingSphere(): void {
    const box = new Box3();

    this._config.forEach((cfg) => {
      for (let i = 0; i < cfg.geometry.length; i += 2) {
        if (i + 1 >= cfg.geometry.length) break;

        const point1 = cfg.geometry[i];
        const point2 = cfg.geometry[i + 1];

        const pos1 = geodeticToVector3({
          lat: degreeToRadian(point1.lat),
          lng: degreeToRadian(point1.lng),
          height: cfg.height,
        });
        const pos2 = geodeticToVector3({
          lat: degreeToRadian(point2.lat),
          lng: degreeToRadian(point2.lng),
          height: cfg.height,
        });

        box.expandByPoint(pos1);
        box.expandByPoint(pos2);

        // Add arc peak point (t = 0.5, where sin(PI * t) = 1, maximum height)
        const midLng = (point1.lng + point2.lng) / 2;
        const midLat = (point1.lat + point2.lat) / 2;

        const dist = pos1.distanceTo(pos2);

        // The top of the arc is calculated in the shader, and the calculation method
        // here is not accurate—it's only used to estimate the bounding box.
        const peakHeight = cfg.height + dist * cfg.arcHeightScale;
        box.expandByPoint(
          geodeticToVector3({
            lat: degreeToRadian(midLat),
            lng: degreeToRadian(midLng),
            height: peakHeight,
          }),
        );
      }
    });

    // Update bounding info for each sub-mesh
    this._subMeshes.forEach((mesh) => {
      mesh.geometry.boundingBox = box.clone();
      mesh.geometry.boundingSphere = new Sphere();
      mesh.geometry.boundingBox.getBoundingSphere(mesh.geometry.boundingSphere);

      // Disable auto computation
      mesh.geometry.computeBoundingBox = () => {};
      mesh.geometry.computeBoundingSphere = () => {};
    });
  }

  // needsRebuild:
  //   segments, geometry.length
  // updateArcVertex:
  //   geometry.lng/lat
  // updateArcHeightAndLength:
  //   arcHeightScale
  // updateArcParameters:
  //   thickness, opacity, srcColor, tgtColor, gradation, dashed, dashSize, gapSize, dashOffset, height
  updateConfig(newConfig: Partial<ArcLineConfig>[]) {
    const changedConfigs = new Set<number>();
    const changedConfigsForMaterial = new Set<number>();
    const configsNeedingRebuild = new Set<number>();
    const configsNeedingUpdateArcVertex = new Set<number>();
    const configsNeedingUpdateArcHeightAndLength = new Set<number>();
    const configsNeedingUpdateArcParameters = new Set<number>();

    newConfig.forEach((cfg, i) => {
      if (!this._config[i]) {
        // New config - needs complete rebuild
        this._config[i] = { ...DefaultArcLineConfig, ...cfg };
        configsNeedingRebuild.add(i);
        changedConfigs.add(i);
      } else {
        let hasChanges = false;
        let needsRebuild = false;
        let needsUpdateArcVertex = false;
        let needsUpdateArcHeightAndLength = false;
        let needsUpdateArcParameters = false;

        // Check if segments changed (requires geometry rebuild)
        if (
          cfg.segments !== undefined &&
          cfg.segments !== this._config[i].segments
        ) {
          this._config[i].segments = cfg.segments;
          needsRebuild = true;
          hasChanges = true;
        }

        // Check if geometry changed
        if (cfg.geometry !== undefined) {
          if (cfg.geometry.length !== this._config[i].geometry.length) {
            this._config[i].geometry = cfg.geometry;
            needsRebuild = true;
            hasChanges = true;
          } else {
            for (let j = 0; j < cfg.geometry.length; j++) {
              if (
                cfg.geometry[j].lng !== this._config[i].geometry[j].lng ||
                cfg.geometry[j].lat !== this._config[i].geometry[j].lat
              ) {
                this._config[i].geometry[j].lng = cfg.geometry[j].lng;
                this._config[i].geometry[j].lat = cfg.geometry[j].lat;
                needsUpdateArcVertex = true;
                hasChanges = true;
              }
            }
          }
        }

        // arcHeightScale: need to recalculate arcHeight/arcLength
        if (
          cfg.arcHeightScale !== undefined &&
          cfg.arcHeightScale !== this._config[i].arcHeightScale
        ) {
          this._config[i].arcHeightScale = cfg.arcHeightScale;
          needsUpdateArcHeightAndLength = true;
          hasChanges = true;
        }

        // Arc parameters: only update attributes (no WASM calls)
        if (cfg.height !== undefined && cfg.height !== this._config[i].height) {
          this._config[i].height = cfg.height;
          needsUpdateArcParameters = true;
          hasChanges = true;
        }
        if (
          cfg.thickness !== undefined &&
          cfg.thickness !== this._config[i].thickness
        ) {
          this._config[i].thickness = cfg.thickness;
          needsUpdateArcParameters = true;
          hasChanges = true;
        }
        if (
          cfg.transparent !== undefined &&
          cfg.transparent !== this._config[i].transparent
        ) {
          this._config[i].transparent = cfg.transparent;
          changedConfigsForMaterial.add(i);
        }
        if (
          cfg.opacity !== undefined &&
          cfg.opacity !== this._config[i].opacity
        ) {
          this._config[i].opacity = cfg.opacity;
          needsUpdateArcParameters = true;
          hasChanges = true;
        }
        if (cfg.srcColor !== undefined) {
          if (cfg.srcColor.toHex() !== this._config[i].srcColor.toHex()) {
            this._config[i].srcColor = cfg.srcColor;
            needsUpdateArcParameters = true;
            hasChanges = true;
          }
        }
        if (cfg.tgtColor !== undefined) {
          if (cfg.tgtColor.toHex() !== this._config[i].tgtColor.toHex()) {
            this._config[i].tgtColor = cfg.tgtColor;
            needsUpdateArcParameters = true;
            hasChanges = true;
          }
        }
        if (
          cfg.gradation !== undefined &&
          cfg.gradation !== this._config[i].gradation
        ) {
          this._config[i].gradation = cfg.gradation;
          needsUpdateArcParameters = true;
          hasChanges = true;
        }
        if (cfg.dashed !== undefined && cfg.dashed !== this._config[i].dashed) {
          this._config[i].dashed = cfg.dashed;
          needsUpdateArcParameters = true;
          hasChanges = true;
        }
        if (
          cfg.dashSize !== undefined &&
          cfg.dashSize !== this._config[i].dashSize
        ) {
          this._config[i].dashSize = cfg.dashSize;
          needsUpdateArcParameters = true;
          hasChanges = true;
        }
        if (
          cfg.gapSize !== undefined &&
          cfg.gapSize !== this._config[i].gapSize
        ) {
          this._config[i].gapSize = cfg.gapSize;
          needsUpdateArcParameters = true;
          hasChanges = true;
        }
        if (
          cfg.dashOffset !== undefined &&
          cfg.dashOffset !== this._config[i].dashOffset
        ) {
          this._config[i].dashOffset = cfg.dashOffset;
          needsUpdateArcParameters = true;
          hasChanges = true;
        }

        if (hasChanges) {
          changedConfigs.add(i);
          if (needsRebuild) {
            configsNeedingRebuild.add(i);
          } else if (needsUpdateArcVertex) {
            configsNeedingUpdateArcVertex.add(i);
          } else if (needsUpdateArcHeightAndLength) {
            configsNeedingUpdateArcHeightAndLength.add(i);
          } else if (needsUpdateArcParameters) {
            configsNeedingUpdateArcParameters.add(i);
          }
        }
      }
    });

    // Handle configs that need complete rebuild
    configsNeedingRebuild.forEach((configIndex) => {
      if (this._subMeshes[configIndex]) {
        // Dispose old mesh
        this._subMeshes[configIndex].geometry.dispose();
        this._subMeshes[configIndex].material.dispose();
        this.remove(this._subMeshes[configIndex]);
      }

      // Create new mesh
      const newMesh = this.createSubMesh(this._config[configIndex]);
      this._subMeshes[configIndex] = newMesh;
      this.add(newMesh);
    });

    // Handle configs that need to update arc vertex (ECEF re-encoding)
    configsNeedingUpdateArcVertex.forEach((configIndex) => {
      if (this._subMeshes[configIndex]) {
        this.fillSingleConfigInstanceData(
          this._config[configIndex],
          this._subMeshes[configIndex].geometry,
        );
      }
    });

    // Handle configs that need to update arc height and length (WASM calls)
    configsNeedingUpdateArcHeightAndLength.forEach((configIndex) => {
      if (this._subMeshes[configIndex]) {
        this.updateArcHeightAndLength(
          this._config[configIndex],
          this._subMeshes[configIndex].geometry,
        );
      }
    });

    // Handle configs that only need to update arc parameters (no WASM calls)
    configsNeedingUpdateArcParameters.forEach((configIndex) => {
      if (this._subMeshes[configIndex]) {
        this.updateArcParameters(
          this._config[configIndex],
          this._subMeshes[configIndex].geometry,
        );
      }
    });

    // Update material
    changedConfigsForMaterial.forEach((configIndex) => {
      if (
        !configsNeedingRebuild.has(configIndex) &&
        this._subMeshes[configIndex]
      ) {
        this.updateMaterials(
          this._config[configIndex],
          this._subMeshes[configIndex],
        );
      }
    });

    // Only update bounding sphere if there were actual changes
    if (
      configsNeedingRebuild.size > 0 ||
      configsNeedingUpdateArcHeightAndLength.size > 0
    ) {
      this.updateBoundingSphere();
    }
  }

  updateMaterials(
    config: ArcLineConfig,
    subMesh: Mesh<InstancedBufferGeometry, ShaderMaterial>,
  ) {
    if (subMesh.material.transparent !== config.transparent) {
      subMesh.material.transparent = config.transparent;
    }
  }

  onResize(width: number, height: number): void {
    this._subMeshes.forEach((mesh) => {
      mesh.material.uniforms?.uViewport.value.set(width, height);
    });
  }

  dispose(): void {
    this._subMeshes.forEach((mesh) => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
  }
}
