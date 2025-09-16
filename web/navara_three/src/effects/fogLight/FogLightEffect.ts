import FogLightFragment from "@shaders/glsl/fogLight.frag.glsl?raw";
import { resolveIncludes } from "@takram/three-geospatial";
import {
  Effect as PostProcessingEffect,
  EffectAttribute,
} from "postprocessing";
import {
  PerspectiveCamera,
  OrthographicCamera,
  Color,
  Matrix4,
  Uniform,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
  DataTexture,
  FloatType,
  RGBAFormat,
  NearestFilter,
  ClampToEdgeWrapping,
  Texture,
} from "three";

import { depth, packing, transform } from "../../shaders";

export type FogLightDefinition = {
  position: { x: number; y: number; z: number };
  color: number | Color;
  intensity: number;
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
};

export const DEFAULT_FOG_LIGHT_EFFECT_OPTIONS: FogLightEffectOptions = {
  lights: [],
  fogDensity: 5,
  maxLights: 100,
  useSurfaceLighting: true,
};

export class FogLightEffect extends PostProcessingEffect {
  private camera: PerspectiveCamera | OrthographicCamera;
  private invProjectionMatrix: Matrix4;
  private invViewMatrix: Matrix4;
  private viewMatrix: Matrix4;
  private lightTex0: DataTexture;
  private lightTex1: DataTexture;
  private buf0: Float32Array;
  private buf1: Float32Array;

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
    const buf1 = new Float32Array(W * H * 4); // position,unused

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
      ["uLightCount", new Uniform(0)],
      ["uLightTexSize", new Uniform(new Vector2(W, H))],
      ["cameraPos", new Uniform(camera.position)],
      [
        "fogDensity",
        new Uniform(options.fogDensity ?? DEFAULT_FOG_LIGHT_EFFECT_OPTIONS.fogDensity),
      ],
      ["normalBuffer", new Uniform(options.normalBuffer ?? null)],
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
        attributes: EffectAttribute.DEPTH,
      },
    );

    this.camera = camera;
    this.invProjectionMatrix = new Matrix4();
    this.invViewMatrix = new Matrix4();
    this.viewMatrix = new Matrix4();
    this.lightTex0 = lightTex0;
    this.lightTex1 = lightTex1;
    this.buf0 = buf0;
    this.buf1 = buf1;
  }

  update(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    deltaTime: number,
  ): void {
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

    super.update(renderer, inputBuffer, deltaTime);
  }

  writeLight(
    i: number,
    color: Color,
    intensity: number,
    position: Vector3,
  ): void {
    const k = 4 * i;
    this.buf0[k + 0] = color.r;
    this.buf0[k + 1] = color.g;
    this.buf0[k + 2] = color.b;
    this.buf0[k + 3] = intensity;

    this.buf1[k + 0] = position.x;
    this.buf1[k + 1] = position.y;
    this.buf1[k + 2] = position.z;
    this.buf1[k + 3] = 0.0; // unused
  }

  updateLightTextures(): void {
    this.lightTex0.needsUpdate = true;
    this.lightTex1.needsUpdate = true;
  }
}
