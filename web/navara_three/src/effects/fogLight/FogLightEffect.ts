import FogLightFragment from "@shaders/glsl/fogLight.frag.glsl?raw";
import { resolveIncludes } from "@takram/three-geospatial";
import {
  Effect as PostProcessingEffect,
  BlendFunction,
  DepthCopyPass,
} from "postprocessing";
import {
  PerspectiveCamera,
  OrthographicCamera,
  Matrix4,
  Uniform,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
  DataTexture,
  FloatType,
  RGBAFormat,
  RGFormat,
  NearestFilter,
  ClampToEdgeWrapping,
  Texture,
  RGBADepthPacking,
  type DepthPackingStrategies,
  Frustum,
  Sphere,
} from "three";

import type { Color } from "../../Color";
import { depth, packing, transform } from "../../shaders";

export type FogLightDefinition = {
  position: { x: number; y: number; z: number };
  color: number | Color;
  intensity: number;
  /** World-space influence radius of the fog light. Defaults to 500 if omitted. */
  radius?: number;
};

export type FogLightEffectOptions = {
  /** Array of fog light definitions with position, color, and intensity */
  lights?: FogLightDefinition[];
  /** Density of the volumetric fog (default: 5) */
  fogDensity?: number;
  /** Maximum number of lights supported (default: 100) */
  maxLights?: number;
  /** Optional normal buffer texture for surface lighting calculations */
  normalBuffer?: Texture;
  /** Whether to apply surface lighting effects (default: true) */
  useSurfaceLighting?: boolean;
  /** Tile size in pixels for tiled/clustered culling */
  tileSize?: number;
  /** Maximum lights iterated per tile on GPU (shader safety) */
  maxLightsPerTile?: number;
  /** Safety scale applied to analytic closest-approach distance h to get world radius */
  extentScale?: number;
  /** Debug: show grid extent overlay in the shader */
  debugShowGrid?: boolean;
  /**
   * Maximum distance from the camera at which fog lights are considered.
   * Lights whose entire influence sphere is farther than this value are culled on CPU.
   * Defaults to the camera's current `far` value.
   */
  maxFar?: number;
};

export const DEFAULT_FOG_LIGHT_EFFECT_OPTIONS: FogLightEffectOptions = {
  lights: [],
  fogDensity: 5,
  maxLights: 100,
  useSurfaceLighting: true,
  tileSize: 32,
  maxLightsPerTile: 64,
  extentScale: 0.8,
  debugShowGrid: false,
  maxFar: 1e6,
};

export class FogLightEffect extends PostProcessingEffect {
  private camera: PerspectiveCamera | OrthographicCamera;
  private invProjectionMatrix: Matrix4;
  private invViewMatrix: Matrix4;
  private viewMatrix: Matrix4;
  // Scratch and culling instances reused per frame
  private _vpM: Matrix4;
  private _frustum: Frustum;
  private _viewScratch: Vector3;
  private _ndcScratch: Vector3;
  private _sphereScratch: Sphere;
  private lightTex0: DataTexture;
  private lightTex1: DataTexture;
  private buf0: Float32Array;
  private buf1: Float32Array;
  private depthCopyPass: DepthCopyPass;
  // Tiled culling buffers
  private lightGridTex?: DataTexture;
  private lightIndexTex?: DataTexture;
  private gridBuf?: Float32Array;
  private indexBuf?: Float32Array;
  private tileCounts?: Uint16Array;
  private gridW = 0;
  private gridH = 0;
  private indexTexW = 0;
  private indexTexH = 1;
  private tileSizePx: number;
  private _maxLightsPerTile: number;
  // Extent tuning
  private _extentScale: number;
  // Culling distance (defaults to camera.far)
  private _maxFar: number;

  constructor(
    camera: PerspectiveCamera | OrthographicCamera,
    options: FogLightEffectOptions = {},
  ) {
    // Get max lights from options
    const maxLights =
      options.maxLights ?? DEFAULT_FOG_LIGHT_EFFECT_OPTIONS.maxLights ?? 0;

    // Calculate texture dimensions
    const W = Math.ceil(Math.sqrt(maxLights));
    const H = Math.ceil(maxLights / W);

    // Create buffers for DataTextures
    const buf0 = new Float32Array(W * H * 4); // color,intensity
    const buf1 = new Float32Array(W * H * 4); // position(xyz), radius(w)

    // Create DataTextures
    const lightTex0 = new DataTexture(buf0, W, H, RGBAFormat, FloatType);
    lightTex0.needsUpdate = true;
    lightTex0.magFilter = lightTex0.minFilter = NearestFilter;
    lightTex0.wrapS = lightTex0.wrapT = ClampToEdgeWrapping;

    const lightTex1 = new DataTexture(buf1, W, H, RGBAFormat, FloatType);
    lightTex1.needsUpdate = true;
    lightTex1.magFilter = lightTex1.minFilter = NearestFilter;
    lightTex1.wrapS = lightTex1.wrapT = ClampToEdgeWrapping;

    const uniforms = new Map<string, Uniform>([
      ["uLightTex0", new Uniform(lightTex0)],
      ["uLightTex1", new Uniform(lightTex1)],
      ["uLightTexSize", new Uniform(new Vector2(W, H))],
      ["cameraPos", new Uniform(camera.position)],
      [
        "fogDensity",
        new Uniform(
          options.fogDensity ?? DEFAULT_FOG_LIGHT_EFFECT_OPTIONS.fogDensity,
        ),
      ],
      ["normalBuffer", new Uniform(options.normalBuffer ?? null)],
      ["copiedDepthBuffer", new Uniform(null)],
      [
        "useSurfaceLighting",
        new Uniform(
          options.useSurfaceLighting ??
            DEFAULT_FOG_LIGHT_EFFECT_OPTIONS.useSurfaceLighting,
        ),
      ],
      ["resolution", new Uniform(new Vector2())],
      ["cameraNear", new Uniform(camera.near)],
      ["cameraFar", new Uniform(camera.far)],
      ["projectionMatrix", new Uniform(new Matrix4())],
      ["invProjectionMatrix", new Uniform(new Matrix4())],
      ["invViewMatrix", new Uniform(new Matrix4())],
      ["viewMatrix", new Uniform(new Matrix4())],
      // Tiled culling uniforms
      ["uLightGrid", new Uniform(null)],
      ["uLightGridSize", new Uniform(new Vector2(0, 0))],
      ["uLightIndex", new Uniform(null)],
      ["uLightIndexTexSize", new Uniform(new Vector2(0, 0))],
      [
        "uTileSizePx",
        new Uniform(
          options.tileSize ?? DEFAULT_FOG_LIGHT_EFFECT_OPTIONS.tileSize ?? 16,
        ),
      ],
    ]);

    super(
      "FogLightEffect",
      resolveIncludes(FogLightFragment, {
        core: {
          packing,
          depth,
          transform,
        },
      }),
      {
        uniforms,
        blendFunction: BlendFunction.NORMAL,
      },
    );

    this.camera = camera;
    this.invProjectionMatrix = new Matrix4();
    this.invViewMatrix = new Matrix4();
    this.viewMatrix = new Matrix4();
    this._vpM = new Matrix4();
    this._frustum = new Frustum();
    this._viewScratch = new Vector3();
    this._ndcScratch = new Vector3();
    this._sphereScratch = new Sphere();
    this.lightTex0 = lightTex0;
    this.lightTex1 = lightTex1;
    this.buf0 = buf0;
    this.buf1 = buf1;
    this.tileSizePx =
      options.tileSize ?? DEFAULT_FOG_LIGHT_EFFECT_OPTIONS.tileSize ?? 16;
    this._maxLightsPerTile =
      options.maxLightsPerTile ??
      DEFAULT_FOG_LIGHT_EFFECT_OPTIONS.maxLightsPerTile ??
      64;
    this._extentScale =
      options.extentScale ??
      DEFAULT_FOG_LIGHT_EFFECT_OPTIONS.extentScale ??
      3.0;

    // Far-distance culling threshold
    this._maxFar = options.maxFar ?? camera.far;

    if (options.debugShowGrid) {
      this.defines.set("DEBUG_SHOW_GRID", "1");
    }

    // This is necessary to avoid
    this.depthCopyPass = new DepthCopyPass();
    // Assign the copied depth texture to the uniform
    const depthBufferUniform = this.uniforms.get("copiedDepthBuffer");
    if (depthBufferUniform) {
      depthBufferUniform.value = this.depthCopyPass.texture;
      this.defines.set("DEPTH_PACKING", RGBADepthPacking.toString());
    }

    this.defines.set("MAX_LIGHTS_PER_TILE", this.maxLightsPerTile.toString());
  }

  setDepthTexture(
    depthTexture: Texture,
    depthPacking?: DepthPackingStrategies,
  ): void {
    this.depthCopyPass.setDepthTexture(depthTexture, depthPacking);
  }

  update(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    deltaTime: number,
  ): void {
    // Copy the depth buffer
    this.depthCopyPass.render(renderer, null, null);

    // Update camera matrices
    this.invProjectionMatrix.copy(this.camera.projectionMatrix).invert();
    this.invViewMatrix.copy(this.camera.matrixWorld);
    this.viewMatrix.copy(this.camera.matrixWorld).invert();

    const cameraPosUniform = this.uniforms.get("cameraPos");
    const cameraNearUniform = this.uniforms.get("cameraNear");
    const cameraFarUniform = this.uniforms.get("cameraFar");
    const projectionMatrixUniform = this.uniforms.get("projectionMatrix");
    const invProjectionMatrixUniform = this.uniforms.get("invProjectionMatrix");
    const invViewMatrixUniform = this.uniforms.get("invViewMatrix");
    const viewMatrixUniform = this.uniforms.get("viewMatrix");
    if (cameraPosUniform) cameraPosUniform.value.copy(this.camera.position);
    if (cameraNearUniform) cameraNearUniform.value = this.camera.near;
    if (cameraFarUniform) cameraFarUniform.value = this.camera.far;
    if (invProjectionMatrixUniform)
      invProjectionMatrixUniform.value.copy(this.invProjectionMatrix);
    if (projectionMatrixUniform)
      projectionMatrixUniform.value.copy(this.camera.projectionMatrix);
    if (invViewMatrixUniform)
      invViewMatrixUniform.value.copy(this.invViewMatrix);
    if (viewMatrixUniform) viewMatrixUniform.value.copy(this.viewMatrix);

    if (this.camera instanceof PerspectiveCamera) {
      if (this.defines.get("PERSPECTIVE_CAMERA") !== "1") {
        this.defines.set("PERSPECTIVE_CAMERA", "1");
      }
    } else {
      if (this.defines.get("PERSPECTIVE_CAMERA") != null) {
        this.defines.delete("PERSPECTIVE_CAMERA");
      }
    }

    // Update light count uniform from define (set by layer) if present
    const lightCount = this.lightCount;

    this.populateLightGrid(lightCount);

    super.update(renderer, inputBuffer, deltaTime);
  }

  writeLight(
    i: number,
    color: Color,
    intensity: number,
    position: Vector3,
    radius = 500,
  ): void {
    const k = 4 * i;
    this.buf0[k + 0] = color.raw.r;
    this.buf0[k + 1] = color.raw.g;
    this.buf0[k + 2] = color.raw.b;
    this.buf0[k + 3] = intensity;

    this.buf1[k + 0] = position.x;
    this.buf1[k + 1] = position.y;
    this.buf1[k + 2] = position.z;
    this.buf1[k + 3] = radius;
  }

  updateLightTextures(): void {
    this.lightTex0.needsUpdate = true;
    this.lightTex1.needsUpdate = true;
  }

  updateDepthBuffer(depthBuffer: Texture | null): void {
    const depthBufferUniform = this.uniforms.get("depthBuffer");
    if (depthBufferUniform) {
      depthBufferUniform.value = depthBuffer;
    }
  }

  setSize(width: number, height: number): void {
    this.depthCopyPass.setSize(width, height);
    const res = this.uniforms.get("resolution");
    if (res) (res.value as Vector2).set(width, height);
    // Recreate grid textures on size change
    this.gridW = Math.max(1, Math.ceil(width / this.tileSizePx));
    this.gridH = Math.max(1, Math.ceil(height / this.tileSizePx));
    const gridSizeUniform = this.uniforms.get("uLightGridSize");
    if (gridSizeUniform)
      (gridSizeUniform.value as Vector2).set(this.gridW, this.gridH);
    this.allocateGridTextures();
  }

  get lightCount() {
    const numDefine = this.defines.get("NUM_FOG_LIGHT");
    return Number(numDefine);
  }

  set maxLightsPerTile(v: number) {
    const value = Math.max(1, Math.floor(v));
    this._maxLightsPerTile = value;
    this.defines.set("MAX_LIGHTS_PER_TILE", String(value));
    // Reallocate index texture with new stride
    this.allocateGridTextures();
    this.setChanged();
  }
  get maxLightsPerTile(): number {
    return this._maxLightsPerTile;
  }

  set extentScale(v: number) {
    this._extentScale = Math.max(0, v);
  }
  get extentScale(): number {
    return this._extentScale;
  }

  set maxFar(v: number) {
    this._maxFar = Math.max(0, v);
  }
  get maxFar(): number {
    return this._maxFar;
  }

  private allocateGridTextures(): void {
    // Allocate or resize uLightGrid (gridW x gridH, RG32F: offset, count)
    const gridTexelCount = this.gridW * this.gridH;
    if (!this.gridBuf || this.gridBuf.length !== gridTexelCount * 2) {
      this.gridBuf = new Float32Array(gridTexelCount * 2);
      if (!this.lightGridTex) {
        this.lightGridTex = new DataTexture(
          this.gridBuf,
          this.gridW,
          this.gridH,
          RGFormat,
          FloatType,
        );
        this.lightGridTex.needsUpdate = true;
        this.lightGridTex.magFilter = this.lightGridTex.minFilter =
          NearestFilter;
        this.lightGridTex.wrapS = this.lightGridTex.wrapT = ClampToEdgeWrapping;
        const uni = this.uniforms.get("uLightGrid");
        if (uni) uni.value = this.lightGridTex;
      } else {
        // Rebind existing DataTexture with new buffer and size
        this.lightGridTex.image.data = this.gridBuf;
        this.lightGridTex.image.width = this.gridW;
        this.lightGridTex.image.height = this.gridH;
        this.lightGridTex.needsUpdate = true;
      }
    }
    // per-tile light counts buffer (CPU only)
    if (!this.tileCounts || this.tileCounts.length !== gridTexelCount) {
      this.tileCounts = new Uint16Array(gridTexelCount);
    }

    // Use fixed-stride packing: each tile reserves strideTexels = ceil(maxLightsPerTile/4) RGBA texels
    const strideTexels = Math.max(1, Math.ceil(this.maxLightsPerTile / 4));
    const indexTexelCapacity = Math.max(
      1,
      this.gridW * this.gridH * strideTexels,
    );
    if (!this.indexBuf || this.indexBuf.length !== indexTexelCapacity * 4) {
      // Use near-square 2D texture to avoid exceeding max texture size
      this.indexTexW = Math.ceil(Math.sqrt(indexTexelCapacity));
      this.indexTexH = Math.ceil(indexTexelCapacity / this.indexTexW);
      const roundedCapacity = this.indexTexW * this.indexTexH;
      this.indexBuf = new Float32Array(roundedCapacity * 4);
      if (!this.lightIndexTex) {
        this.lightIndexTex = new DataTexture(
          this.indexBuf,
          this.indexTexW,
          this.indexTexH,
          RGBAFormat,
          FloatType,
        );
        this.lightIndexTex.needsUpdate = true;
        this.lightIndexTex.magFilter = this.lightIndexTex.minFilter =
          NearestFilter;
        this.lightIndexTex.wrapS = this.lightIndexTex.wrapT =
          ClampToEdgeWrapping;
        const uni = this.uniforms.get("uLightIndex");
        if (uni) uni.value = this.lightIndexTex;
      } else {
        this.lightIndexTex.image.data = this.indexBuf;
        this.lightIndexTex.image.width = this.indexTexW;
        this.lightIndexTex.image.height = this.indexTexH;
        this.lightIndexTex.needsUpdate = true;
      }
      const sizeUni = this.uniforms.get("uLightIndexTexSize");
      if (sizeUni)
        (sizeUni.value as Vector2).set(this.indexTexW, this.indexTexH);
    }
  }

  // The idea is based on: https://www.aortiz.me/2018/12/21/CG.html
  private populateLightGrid(lightCount: number): void {
    if (
      !this.gridBuf ||
      !this.indexBuf ||
      !this.lightGridTex ||
      !this.lightIndexTex ||
      !this.tileCounts
    )
      return;

    // Reset per-tile counts; grid metadata is fully overwritten below
    this.tileCounts.fill(0);

    const resUniform = this.uniforms.get("resolution");
    if (!resUniform) return;
    const res = resUniform.value as Vector2;
    const width = res.x;
    const height = res.y;
    if (width <= 0 || height <= 0) return;

    const halfW = 0.5 * width;
    const halfH = 0.5 * height;

    // Precompute matrices
    const viewM = this.viewMatrix; // world -> view
    const projM = this.camera.projectionMatrix; // view -> clip
    const vpM = this._vpM.multiplyMatrices(projM, viewM); // world -> clip
    const frustum = this._frustum.setFromProjectionMatrix(vpM);

    // Scratch vectors to avoid allocations
    const view = this._viewScratch;
    const ndc = this._ndcScratch;
    const sphere = this._sphereScratch;

    // Helper: project world to pixel coordinates
    const projectToPixel = (
      wx: number,
      wy: number,
      wz: number,
    ): [number, number] => {
      ndc.set(wx, wy, wz).applyMatrix4(vpM); // becomes NDC via perspective divide
      const px = (ndc.x * 0.5 + 0.5) * width;
      const py = (ndc.y * 0.5 + 0.5) * height;
      return [px, py];
    };

    // Approximate screen-space radius (pixels) from world radius
    const fx = Math.abs(projM.elements[0]);
    const fy = Math.abs(projM.elements[5]);
    const computeScreenRadiusPx = (rWorld: number, viewZ: number): number => {
      if (this.camera instanceof PerspectiveCamera) {
        // Use a conservative depth when projecting the sphere: closest point of the sphere to the camera.
        // This inflates the screen radius and avoids missing tiles where the ray intersects the sphere near its front cap.
        const absViewZCenter = Math.abs(viewZ);
        const absViewZMin = Math.max(
          1e-3,
          Math.min(
            Math.max(this.camera.near * 0.5, 1e-3),
            absViewZCenter - rWorld,
          ),
        );
        const absViewZ = absViewZMin;
        const ndcRadiusX = (rWorld * fx) / absViewZ;
        const ndcRadiusY = (rWorld * fy) / absViewZ;
        return Math.max(
          Math.abs(ndcRadiusX) * halfW,
          Math.abs(ndcRadiusY) * halfH,
        );
      } else {
        const ndcRadiusX = rWorld * fx;
        const ndcRadiusY = rWorld * fy;
        return Math.max(
          Math.abs(ndcRadiusX) * halfW,
          Math.abs(ndcRadiusY) * halfH,
        );
      }
    };

    // Fixed-stride packing parameters
    const strideTexels = Math.max(1, Math.ceil(this.maxLightsPerTile / 4));
    const strideScalars = strideTexels * 4; // components per tile

    for (let i = 0; i < lightCount; i++) {
      const base = i * 4;
      const intensity = this.buf0[base + 3];
      if (intensity <= 0) continue;

      const wx = this.buf1[base + 0];
      const wy = this.buf1[base + 1];
      const wz = this.buf1[base + 2];

      // Compute camera-to-light distance using scratch vector to satisfy TS types
      view.set(wx, wy, wz);
      const distance = this.camera.position.distanceTo(view);

      // World-space influence radius: read from buffer (w component)
      const radius = this.buf1[base + 3] || 0;
      const ratio = (radius * 4) / distance;

      // const rWorld = Math.max(0, radius * this.extentScale);
      const rWorld =
        this.estimatePointLightRange(
          intensity,
          this.uniforms.get("fogDensity")?.value ?? 1,
        ) * ratio;

      // Additional far-distance culling: if the nearest point of the light's
      // influence sphere is beyond maxFar from the camera, skip it.
      if (distance - rWorld > this._maxFar) continue;

      // Camera-space position (also used later for screen-radius)
      view.set(wx, wy, wz).applyMatrix4(viewM);

      // Frustum culling in world space using a bounding sphere
      sphere.center.set(wx, wy, wz);
      sphere.radius = rWorld;
      if (!frustum.intersectsSphere(sphere)) continue;

      // Project to screen pixels (after passing frustum test)
      const [px, py] = projectToPixel(wx, wy, wz);
      if (!isFinite(px) || !isFinite(py)) continue;

      // View-space Z for perspective scaling of pixel radius
      const rPx = computeScreenRadiusPx(rWorld, view.z);
      if (!isFinite(rPx) || rPx <= 0) continue;

      // Tile range overlapped by this light's screen-space AABB
      // Use a small pixel padding to avoid rounding/off-by-one gaps on edges.
      // Also compute the max side with ceil(...)-1 to ensure inclusive coverage
      // of tiles when the light's AABB touches a tile boundary.
      // Compute the overlapped tile range in tile coordinates BEFORE clamping
      const minTx = Math.floor((px - rPx) / this.tileSizePx);
      const maxTx = Math.ceil((px + rPx) / this.tileSizePx) - 1;
      const minTy = Math.floor((py - rPx) / this.tileSizePx);
      const maxTy = Math.ceil((py + rPx) / this.tileSizePx) - 1;

      // If the AABB is completely outside the grid, skip early
      if (maxTx < 0 || minTx >= this.gridW || maxTy < 0 || minTy >= this.gridH)
        continue;

      // Now clamp to the valid tile range
      const x0 = Math.max(0, Math.min(this.gridW - 1, minTx));
      const x1 = Math.max(0, Math.min(this.gridW - 1, maxTx));
      const y0 = Math.max(0, Math.min(this.gridH - 1, minTy));
      const y1 = Math.max(0, Math.min(this.gridH - 1, maxTy));

      for (let ty = y0; ty <= y1; ty++) {
        const baseTile = ty * this.gridW;
        for (let tx = x0; tx <= x1; tx++) {
          const tileIdx = baseTile + tx;
          const cnt = this.tileCounts[tileIdx];
          if (cnt < this.maxLightsPerTile) {
            const startScalar = tileIdx * strideScalars; // component 0 start for this tile
            this.indexBuf[startScalar + cnt] = i;
            this.tileCounts[tileIdx] = cnt + 1;
          }
        }
      }
    }

    // Write per-tile metadata using fixed stride (aligned texel offset)
    for (let t = 0; t < this.gridW * this.gridH; t++) {
      const k = t * 2;
      const offsetTexel = t * strideTexels;
      this.gridBuf[k + 0] = offsetTexel;
      this.gridBuf[k + 1] = this.tileCounts[t];
    }

    // Upload
    this.lightGridTex.needsUpdate = true;
    this.lightIndexTex.needsUpdate = true;
  }

  // Estimate a point light's effective world-space range for culling
  // Follow calculateFogScattering: use the analytic upper bound of the
  // integral with attenuation 1/(1+0.1*h).
  private estimatePointLightRange(
    intensity: number,
    fogDensity: number,
  ): number {
    const I = Math.max(intensity, 0);
    if (I <= 0) return 0;
    const D = fogDensity;

    const minIntegral = 0.001; // perceptual threshold
    const c = I * D;
    const sqrtDisc = Math.sqrt(c / minIntegral);
    const r = Math.max(1, sqrtDisc);

    return r * this.extentScale;
  }

  // range estimation removed; radius is provided per light

  set debugShowGrid(v: boolean) {
    if (v) this.defines.set("DEBUG_SHOW_GRID", "1");
    else this.defines.delete("DEBUG_SHOW_GRID");
    this.setChanged();
  }

  get debugShowGrid(): boolean {
    return this.defines.get("DEBUG_SHOW_GRID") === "1";
  }
}
