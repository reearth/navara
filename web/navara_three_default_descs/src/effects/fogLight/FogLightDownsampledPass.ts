import PostProcessingCommon from "@shaders/glsl/postprocessingCommon.vert.glsl";
import { resolveIncludes } from "@takram/three-geospatial";
import { depth } from "@takram/three-geospatial/shaders";
import { EffectPass, Pass, Resolution } from "postprocessing";
import {
  NoBlending,
  ShaderMaterial,
  Texture,
  WebGLRenderTarget,
  PerspectiveCamera,
  type OrthographicCamera,
  type WebGLRenderer,
  type DepthPackingStrategies,
  LinearSRGBColorSpace,
  LinearFilter,
  type TextureDataType,
  Vector2,
} from "three";

import { FogLightEffect } from "./FogLightEffect";

// Depth-aware (joint bilateral) upsampling: the low-res fog is combined from
// the 4 nearest low-res texels, weighted by bilinear position AND view-space
// depth similarity against the full-res pixel. At depth discontinuities the
// dissimilar-depth texels drop out, which removes the halo artifacts plain
// bilinear upsampling produces along silhouette edges.
const CompositeFrag = /* glsl */ `
#include <common>
#include <packing>
#include "core/depth"

uniform sampler2D inputBuffer;
uniform sampler2D fogLow;
uniform sampler2D lowDepthBuffer; // RGBA-packed low-res depth (DepthCopyPass)
uniform sampler2D fullDepthBuffer; // full-res scene depth
uniform vec2 lowResolution;
uniform float cameraNear;
uniform float cameraFar;

varying vec2 vUv;

float depthToViewZ(const float depth) {
  #ifdef PERSPECTIVE_CAMERA
  return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
  #else
  return orthographicDepthToViewZ(depth, cameraNear, cameraFar);
  #endif
}

float readFullViewZ(const vec2 uv) {
  #if FULL_DEPTH_PACKING == 3201
  float d = unpackRGBAToDepth(texture2D(fullDepthBuffer, uv));
  #else
  float d = texture2D(fullDepthBuffer, uv).r;
  #endif
  return depthToViewZ(reverseLogDepth(d, cameraNear, cameraFar));
}

float readLowViewZ(const ivec2 coord) {
  float d = unpackRGBAToDepth(texelFetch(lowDepthBuffer, coord, 0));
  return depthToViewZ(reverseLogDepth(d, cameraNear, cameraFar));
}

void main() {
  vec4 baseTex = texture2D(inputBuffer, vUv);

  float zFull = readFullViewZ(vUv);

  ivec2 lowSize = ivec2(lowResolution);
  vec2 texelPos = vUv * lowResolution - 0.5;
  vec2 f = fract(texelPos);
  ivec2 baseCoord = ivec2(floor(texelPos));

  vec3 acc = vec3(0.0);
  float weightSum = 0.0;
  vec3 nearestFog = vec3(0.0);
  float nearestDiff = 1e20;

  for (int i = 0; i < 4; ++i) {
    ivec2 offset = ivec2(i & 1, i >> 1);
    ivec2 coord = clamp(baseCoord + offset, ivec2(0), lowSize - 1);
    vec3 fog = texelFetch(fogLow, coord, 0).rgb;
    float zLow = readLowViewZ(coord);

    float bilinear = (offset.x == 0 ? 1.0 - f.x : f.x) *
                     (offset.y == 0 ? 1.0 - f.y : f.y);
    // Relative view-depth difference; ~10% depth gap halves the weight.
    float diff = abs(zLow - zFull) / max(abs(zFull), 1e-3);
    float weight = bilinear * exp(-diff * 8.0);

    acc += fog * weight;
    weightSum += weight;
    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearestFog = fog;
    }
  }

  // All neighbors rejected (thin silhouette): fall back to the nearest-depth
  // sample instead of blending across the discontinuity.
  vec3 fog = weightSum > 1e-4 ? acc / weightSum : nearestFog;

  gl_FragColor = vec4(baseTex.rgb + fog, baseTex.a);
}
`;

export type FogLightDownsampledOptions = {
  /** 1: full-res, 2: half, 4: quarter */
  downsample: number;
};

// Renders FogLightEffect into a low-res target and composites back to
// full-res with depth-aware upsampling. At downsample=1 the low-res
// indirection is bypassed and the effect renders directly to the output.
export class FogLightDownsampledPass extends Pass {
  private options: FogLightDownsampledOptions;
  private inner: EffectPass;
  private effect: FogLightEffect;
  private innerCamera: PerspectiveCamera | OrthographicCamera;
  private lowRT: WebGLRenderTarget;
  private compositeMat: ShaderMaterial;
  readonly resolution: Resolution;

  constructor(
    camera: PerspectiveCamera | OrthographicCamera,
    effect: FogLightEffect,
    opts: FogLightDownsampledOptions,
  ) {
    super("FogLightDownsampledPass");

    this.effect = effect;
    this.options = opts;
    this.innerCamera = camera;

    // Fog-only output is only needed when compositing from the low-res RT.
    this.effect.setFogOnlyOutput(opts.downsample > 1);

    // Inner effect pass that renders into a low-res RT.
    this.inner = new EffectPass(camera, effect);

    this.lowRT = new WebGLRenderTarget(1, 1, { depthBuffer: false });
    this.lowRT.texture.name = "FogLight.Low";
    this.lowRT.texture.minFilter = LinearFilter;
    this.lowRT.texture.magFilter = LinearFilter;
    this.lowRT.texture.generateMipmaps = false;

    this.compositeMat = new ShaderMaterial({
      uniforms: {
        inputBuffer: { value: null as Texture | null },
        fogLow: { value: this.lowRT.texture },
        lowDepthBuffer: { value: effect.copiedDepthTexture },
        fullDepthBuffer: { value: null as Texture | null },
        lowResolution: { value: new Vector2(1, 1) },
        cameraNear: { value: camera.near },
        cameraFar: { value: camera.far },
      },
      defines: {
        FULL_DEPTH_PACKING: "0",
      },
      vertexShader: PostProcessingCommon,
      fragmentShader: resolveIncludes(CompositeFrag, { core: { depth } }),
      blending: NoBlending,
      toneMapped: false,
      depthWrite: false,
      depthTest: false,
    });
    if (camera instanceof PerspectiveCamera) {
      this.compositeMat.defines.PERSPECTIVE_CAMERA = "1";
    }

    this.fullscreenMaterial = this.compositeMat;
    this.needsSwap = true; // We write into outputBuffer (or screen) after producing fogLow.
    this.needsDepthTexture = true; // Forward composer depth to inner effect.

    // Manage scaled resolution for the inner pass + lowRT.
    const scale = Math.max(1, opts.downsample ?? 1);
    this.resolution = new Resolution(
      this,
      Resolution.AUTO_SIZE,
      Resolution.AUTO_SIZE,
      1 / scale,
    );
    this.resolution.addEventListener("change", () => {
      // The composer will call setSize; we just mirror here when base size changes.
      this.setSize(this.resolution.baseWidth, this.resolution.baseHeight);
    });
  }

  // Forward depth texture to the inner pass/effect and the composite material.
  setDepthTexture(
    depthTexture: Texture,
    depthPacking?: DepthPackingStrategies,
  ): void {
    this.inner.setDepthTexture(depthTexture, depthPacking);
    this.compositeMat.uniforms.fullDepthBuffer.value = depthTexture;
    const packing = String(depthPacking ?? 0);
    if (this.compositeMat.defines.FULL_DEPTH_PACKING !== packing) {
      this.compositeMat.defines.FULL_DEPTH_PACKING = packing;
      this.compositeMat.needsUpdate = true;
    }
  }

  render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
    deltaTime: number,
    stencilTest?: boolean,
  ): void {
    // Full-res: skip the low-res RT and composite entirely.
    if (this.options.downsample <= 1) {
      if (this.inner.renderToScreen !== this.renderToScreen) {
        this.inner.renderToScreen = this.renderToScreen;
      }
      this.inner.render(
        renderer,
        inputBuffer,
        outputBuffer,
        deltaTime,
        stencilTest,
      );
      return;
    }

    // 1) Render fog (fog-only) into low-res target using the inner EffectPass.
    if (this.inner.renderToScreen) {
      this.inner.renderToScreen = false;
    }
    this.inner.render(
      renderer,
      inputBuffer,
      this.lowRT,
      deltaTime,
      stencilTest,
    );

    // 2) Composite low-res fog over full-res input with depth-aware upsampling.
    this.compositeMat.uniforms.inputBuffer.value = inputBuffer.texture;
    this.compositeMat.uniforms.cameraNear.value = this.innerCamera.near;
    this.compositeMat.uniforms.cameraFar.value = this.innerCamera.far;
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.render(this.scene, this.camera);
  }

  setSize(width: number, height: number): void {
    // Update resolution scaling and allocate low-res target.
    this.resolution.setBaseSize(width, height);
    const w = this.resolution.width;
    const h = this.resolution.height;
    this.lowRT.setSize(w, h);
    this.effect.setSize(w, h);
    (this.compositeMat.uniforms.lowResolution.value as Vector2).set(w, h);
  }

  initialize(
    renderer: WebGLRenderer,
    alpha: boolean,
    frameBufferType: TextureDataType,
  ): void {
    // Initialize inner pass for framebuffer precision/encoding.
    this.inner.initialize(renderer, alpha, frameBufferType);
    // Make lowRT precision match the composer.
    this.lowRT.texture.type = frameBufferType;
    // Keep low-res RT linear to avoid double-encoding paths.
    this.lowRT.texture.colorSpace = LinearSRGBColorSpace;
  }

  dispose(): void {
    super.dispose();
    this.lowRT.dispose();
    this.compositeMat.dispose();
    this.inner.dispose();
  }

  get downsample(): number {
    return this.options.downsample;
  }

  set downsample(value: number) {
    const v = Math.max(1, value);
    this.options.downsample = v;
    this.resolution.scale = 1 / v;
    this.effect.setFogOnlyOutput(v > 1);
  }
}
