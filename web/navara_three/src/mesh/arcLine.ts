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
  Object3D,
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
import { overrideShaderMaterialForMRT } from "../material";

export type ArcLineConfig = {
  thickness: number; // Thickness of the arc line
  // opacity: number; // Opacity of the arc line
  segments: number; // Number of segments per arc line
  srcColor: number; // Source color of the arc line
  tgtColor: number; // Target color of the arc line
  height: number; // height from globe surface
  arcHeightScale: number; // Scale factor for arc height relative to distance between endpoints
  geometry: LngLat[]; // Array of points in [lng, lat] pairs; each pair defines one arc line
};

export const DefaultArcLineConfig: ArcLineConfig = {
  thickness: 1,
  // opacity: 1,
  segments: 64,
  srcColor: 0xffffff,
  tgtColor: 0xffffff,
  height: 0,
  arcHeightScale: 0.3,
  geometry: [],
};

export class ArcLine extends Object3D {
  private readonly _config: ArcLineConfig[];
  private _subMeshes: Mesh<InstancedBufferGeometry, ShaderMaterial>[] = [];

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

    const instanceSourceTarget = new Float32Array(numInstances * 4);
    const instanceParams = new Float32Array(numInstances * 4);
    const instanceSegments = new Float32Array(numInstances);
    const instanceSrcColor = new Float32Array(numInstances * 3);
    const instanceTgtColor = new Float32Array(numInstances * 3);

    geo.setAttribute(
      "aInstanceSourceTarget",
      new InstancedBufferAttribute(instanceSourceTarget, 4),
    );
    geo.setAttribute(
      "aInstanceParams",
      new InstancedBufferAttribute(instanceParams, 4),
    );
    geo.setAttribute(
      "aInstanceSegments",
      new InstancedBufferAttribute(instanceSegments, 1),
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
    const mesh = new Mesh(geo, material);

    return mesh;
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

  private fillSingleConfigInstanceData(
    config: ArcLineConfig,
    geo: InstancedBufferGeometry,
  ): void {
    const numInstances = Math.floor(config.geometry.length / 2);
    geo.instanceCount = numInstances;

    if (numInstances === 0) return;

    const instanceSourceTarget = geo.getAttribute("aInstanceSourceTarget");
    const instanceParams = geo.getAttribute("aInstanceParams");
    const instanceSegments = geo.getAttribute("aInstanceSegments");
    const instanceSrcColor = geo.getAttribute("aInstanceSrcColor");
    const instanceTgtColor = geo.getAttribute("aInstanceTgtColor");

    const segments = Math.max(2, Math.floor(config.segments));

    for (let i = 0; i < numInstances; i++) {
      const geom1 = config.geometry[i * 2];
      const geom2 = config.geometry[i * 2 + 1];

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

      // Pack source/target: srcLon, srcLat, tgtLon, tgtLat
      instanceSourceTarget.setXYZW(
        i,
        geom1.lng,
        geom1.lat,
        geom2.lng,
        geom2.lat,
      );

      // Pack params: height, arcHeight, thickness, opacity
      instanceParams.setXYZW(
        i,
        config.height,
        dist * config.arcHeightScale,
        config.thickness,
        1.0,
      );

      // Set segments
      instanceSegments.setX(i, segments);

      const srcColor = new Color(config.srcColor);
      const tgtColor = new Color(config.tgtColor);
      instanceSrcColor.setXYZ(i, srcColor.r, srcColor.g, srcColor.b);
      instanceTgtColor.setXYZ(i, tgtColor.r, tgtColor.g, tgtColor.b);
    }

    instanceSourceTarget.needsUpdate = true;
    instanceParams.needsUpdate = true;
    instanceSegments.needsUpdate = true;
    instanceSrcColor.needsUpdate = true;
    instanceTgtColor.needsUpdate = true;
  }

  private createMaterial(): ShaderMaterial {
    const WGS84_A = getWGS84SemiMajorAxis();
    const WGS84_B = getWGS84SemiMinorAxis();
    const WGS84_E2 = getWGS84EccentricitySquared();

    const material = new ShaderMaterial();
    material.vertexShader = ArclineVertShader;
    material.fragmentShader = `
      in float vOpacity;
      in vec3 vColor;

      #include <logdepthbuf_pars_fragment>

      void main() {
        // Calculate screen-space normal for line geometry
        vec3 fdx = dFdx(gl_FragCoord.xyz);
        vec3 fdy = dFdy(gl_FragCoord.xyz);
        vec3 normal = normalize(cross(fdx, fdy));
        
        // Ensure normal faces camera
        if (normal.z < 0.0) normal = -normal;
        
        gl_FragColor = vec4(vColor, vOpacity);
        
        #include <logdepthbuf_fragment>
      }
    `;

    material.uniforms = {
      uViewport: { value: new Vector2(1920, 1080) },
      uR: { value: WGS84_A },
      uA: { value: WGS84_A },
      uB: { value: WGS84_B },
      uE2: { value: WGS84_E2 },
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

        const pos1 = geodeticToVector3(
          new LLE(
            degreeToRadian(point1.lng),
            degreeToRadian(point1.lat),
            cfg.height,
          ),
        );
        const pos2 = geodeticToVector3(
          new LLE(
            degreeToRadian(point2.lng),
            degreeToRadian(point2.lat),
            cfg.height,
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
        const peakHeight = cfg.height + dist * cfg.arcHeightScale;
        const peakLLE = new LLE(
          degreeToRadian(midLng),
          degreeToRadian(midLat),
          peakHeight,
        );
        box.expandByPoint(geodeticToVector3(peakLLE));
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

  updateConfig(newConfig: Partial<ArcLineConfig>[]) {
    const changedConfigs = new Set<number>();
    const configsNeedingRebuild = new Set<number>();

    newConfig.forEach((cfg, i) => {
      if (!this._config[i]) {
        // New config - needs complete rebuild
        this._config[i] = { ...DefaultArcLineConfig, ...cfg };
        configsNeedingRebuild.add(i);
        changedConfigs.add(i);
      } else {
        let hasChanges = false;
        let needsRebuild = false;

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
                hasChanges = true;
              }
            }
          }
        }

        // Update other properties (these don't need geometry rebuild)
        if (
          cfg.thickness !== undefined &&
          cfg.thickness !== this._config[i].thickness
        ) {
          this._config[i].thickness = cfg.thickness;
          hasChanges = true;
        }
        if (
          cfg.srcColor !== undefined &&
          cfg.srcColor !== this._config[i].srcColor
        ) {
          this._config[i].srcColor = cfg.srcColor;
          hasChanges = true;
        }
        if (
          cfg.tgtColor !== undefined &&
          cfg.tgtColor !== this._config[i].tgtColor
        ) {
          this._config[i].tgtColor = cfg.tgtColor;
          hasChanges = true;
        }
        if (cfg.height !== undefined && cfg.height !== this._config[i].height) {
          this._config[i].height = cfg.height;
          hasChanges = true;
        }
        if (
          cfg.arcHeightScale !== undefined &&
          cfg.arcHeightScale !== this._config[i].arcHeightScale
        ) {
          this._config[i].arcHeightScale = cfg.arcHeightScale;
          hasChanges = true;
        }

        if (hasChanges) {
          changedConfigs.add(i);
          if (needsRebuild) {
            configsNeedingRebuild.add(i);
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

    // Handle configs that only need instance data update
    changedConfigs.forEach((configIndex) => {
      if (
        !configsNeedingRebuild.has(configIndex) &&
        this._subMeshes[configIndex]
      ) {
        this.fillSingleConfigInstanceData(
          this._config[configIndex],
          this._subMeshes[configIndex].geometry,
        );
      }
    });

    // Only update bounding sphere if there were actual changes
    if (changedConfigs.size > 0) {
      this.updateBoundingSphere();
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
