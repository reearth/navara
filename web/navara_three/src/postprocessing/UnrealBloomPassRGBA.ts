/**
 * UnrealBloomPassRGBA - Fork of Three.js UnrealBloomPass with Alpha Channel Preservation
 *
 * This is a modified version of Three.js's UnrealBloomPass that preserves the alpha channel
 * during Gaussian blur operations. The original implementation discards alpha values by
 * processing only RGB channels.
 *
 * Based on: three@0.167.1 - examples/jsm/postprocessing/UnrealBloomPass.js
 * Fork reason: Need to preserve alpha channel for per-object occlusion mode transmission
 * Modifications:
 *   - Gaussian blur shader processes RGBA instead of RGB
 *   - Composite shader preserves alpha channel
 *   - All texture sampling uses .rgba instead of .rgb
 *
 * Original source:
 * https://github.com/mrdoob/three.js/blob/r167/examples/jsm/postprocessing/UnrealBloomPass.js
 */

import {
  AdditiveBlending,
  Color,
  HalfFloatType,
  MeshBasicMaterial,
  ShaderMaterial,
  UniformsUtils,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import {
  Pass,
  FullScreenQuad,
} from "three/examples/jsm/postprocessing/Pass.js";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader.js";

/**
 * This pass is inspired by the bloom pass of Unreal Engine. It creates a
 * mip map chain of bloom textures and blurs them with different radii. Because
 * of the weighted combination of mips, and because larger blurs are done on
 * higher mips, this effect provides good quality and performance.
 *
 * **RGBA Modification**: This version preserves alpha channel through all blur operations.
 */
export class UnrealBloomPassRGBA extends Pass {
  public strength: number;
  public radius: number;
  public threshold: number;
  public resolution: Vector2;
  public clearColor: Color;

  private renderTargetsHorizontal: WebGLRenderTarget[] = [];
  private renderTargetsVertical: WebGLRenderTarget[] = [];
  private nMips = 5;
  private renderTargetBright!: WebGLRenderTarget;

  private highPassUniforms: any;
  private materialHighPassFilter!: ShaderMaterial;
  private separableBlurMaterials: ShaderMaterial[] = [];
  private compositeMaterial!: ShaderMaterial;
  private bloomTintColors: Vector3[] = [];

  private copyUniforms: any;
  private blendMaterial!: ShaderMaterial;

  private _oldClearColor = new Color();
  private _oldClearAlpha = 1;
  private _basic!: MeshBasicMaterial;
  private _fsQuad!: FullScreenQuad;

  static BlurDirectionX = new Vector2(1.0, 0.0);
  static BlurDirectionY = new Vector2(0.0, 1.0);

  constructor(
    resolution?: Vector2,
    strength = 1,
    radius?: number,
    threshold?: number,
  ) {
    super();

    this.strength = strength;
    this.radius = radius ?? 0;
    this.threshold = threshold ?? 0;
    this.resolution = resolution
      ? new Vector2(resolution.x, resolution.y)
      : new Vector2(256, 256);
    this.clearColor = new Color(0, 0, 0);
    this.needsSwap = false;

    // Initialize render targets
    let resx = Math.round(this.resolution.x / 2);
    let resy = Math.round(this.resolution.y / 2);

    this.renderTargetBright = new WebGLRenderTarget(resx, resy, {
      type: HalfFloatType,
    });
    this.renderTargetBright.texture.name = "UnrealBloomPassRGBA.bright";
    this.renderTargetBright.texture.generateMipmaps = false;

    for (let i = 0; i < this.nMips; i++) {
      const renderTargetHorizontal = new WebGLRenderTarget(resx, resy, {
        type: HalfFloatType,
      });
      renderTargetHorizontal.texture.name = "UnrealBloomPassRGBA.h" + i;
      renderTargetHorizontal.texture.generateMipmaps = false;
      this.renderTargetsHorizontal.push(renderTargetHorizontal);

      const renderTargetVertical = new WebGLRenderTarget(resx, resy, {
        type: HalfFloatType,
      });
      renderTargetVertical.texture.name = "UnrealBloomPassRGBA.v" + i;
      renderTargetVertical.texture.generateMipmaps = false;
      this.renderTargetsVertical.push(renderTargetVertical);

      resx = Math.round(resx / 2);
      resy = Math.round(resy / 2);
    }

    // Luminosity high pass material - RGBA preserving version
    // Original LuminosityHighPassShader destroys alpha channel (sets to 1.0)
    // This custom shader preserves alpha for maskMode transmission
    this.highPassUniforms = {
      tDiffuse: { value: null },
      luminosityThreshold: { value: threshold ?? 0.0 }, // Default 0.0 for passthrough
      smoothWidth: { value: 0.01 },
    };

    this.materialHighPassFilter = new ShaderMaterial({
      uniforms: this.highPassUniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float luminosityThreshold;
        uniform float smoothWidth;
        varying vec2 vUv;

        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);

          // RGB: Luminosity filtering (threshold=0.0 means passthrough)
          vec3 luma = vec3(0.299, 0.587, 0.114);
          float v = dot(texel.xyz, luma);
          vec4 outputColor = vec4(texel.rgb, texel.a);  // Preserve alpha!

          float alpha = smoothstep(luminosityThreshold, luminosityThreshold + smoothWidth, v);
          gl_FragColor = mix(vec4(0.0, 0.0, 0.0, texel.a), outputColor, alpha);
        }
      `,
    });

    // Gaussian blur materials (RGBA version)
    // Reduced kernel sizes for tighter bloom (max 11 → 7)
    const kernelSizeArray = [3, 5, 5, 7, 7];
    resx = Math.round(this.resolution.x / 2);
    resy = Math.round(this.resolution.y / 2);

    for (let i = 0; i < this.nMips; i++) {
      this.separableBlurMaterials.push(
        this._getSeparableBlurMaterial(kernelSizeArray[i]),
      );
      this.separableBlurMaterials[i].uniforms["invSize"].value = new Vector2(
        1 / resx,
        1 / resy,
      );

      resx = Math.round(resx / 2);
      resy = Math.round(resy / 2);
    }

    // Composite material
    this.compositeMaterial = this._getCompositeMaterial(this.nMips);
    this.compositeMaterial.uniforms["blurTexture1"].value =
      this.renderTargetsVertical[0].texture;
    this.compositeMaterial.uniforms["blurTexture2"].value =
      this.renderTargetsVertical[1].texture;
    this.compositeMaterial.uniforms["blurTexture3"].value =
      this.renderTargetsVertical[2].texture;
    this.compositeMaterial.uniforms["blurTexture4"].value =
      this.renderTargetsVertical[3].texture;
    this.compositeMaterial.uniforms["blurTexture5"].value =
      this.renderTargetsVertical[4].texture;
    this.compositeMaterial.uniforms["bloomStrength"].value = strength;
    this.compositeMaterial.uniforms["bloomRadius"].value = 0.1;

    // Exponentially reduced bloom factors for tighter bloom
    // Average contribution: 0.6 → 0.38 (37% reduction)
    const bloomFactors = [1.0, 0.5, 0.25, 0.1, 0.05];
    this.compositeMaterial.uniforms["bloomFactors"].value = bloomFactors;
    this.bloomTintColors = [
      new Vector3(1, 1, 1),
      new Vector3(1, 1, 1),
      new Vector3(1, 1, 1),
      new Vector3(1, 1, 1),
      new Vector3(1, 1, 1),
    ];
    this.compositeMaterial.uniforms["bloomTintColors"].value =
      this.bloomTintColors;

    // Blend material
    this.copyUniforms = UniformsUtils.clone(CopyShader.uniforms);
    this.blendMaterial = new ShaderMaterial({
      uniforms: this.copyUniforms,
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });

    this._basic = new MeshBasicMaterial();
    this._fsQuad = new FullScreenQuad(this._basic);
  }

  dispose(): void {
    for (const rt of this.renderTargetsHorizontal) {
      rt.dispose();
    }
    for (const rt of this.renderTargetsVertical) {
      rt.dispose();
    }
    this.renderTargetBright.dispose();

    for (const material of this.separableBlurMaterials) {
      material.dispose();
    }
    this.compositeMaterial.dispose();
    this.blendMaterial.dispose();
    this._basic.dispose();
    this._fsQuad.dispose();
  }

  setSize(width: number, height: number): void {
    let resx = Math.round(width / 2);
    let resy = Math.round(height / 2);

    this.renderTargetBright.setSize(resx, resy);

    for (let i = 0; i < this.nMips; i++) {
      this.renderTargetsHorizontal[i].setSize(resx, resy);
      this.renderTargetsVertical[i].setSize(resx, resy);

      this.separableBlurMaterials[i].uniforms["invSize"].value = new Vector2(
        1 / resx,
        1 / resy,
      );

      resx = Math.round(resx / 2);
      resy = Math.round(resy / 2);
    }
  }

  render(
    renderer: WebGLRenderer,
    _writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
    _deltaTime?: number,
    maskActive?: boolean,
  ): void {
    renderer.getClearColor(this._oldClearColor);
    this._oldClearAlpha = renderer.getClearAlpha();
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    renderer.setClearColor(this.clearColor, 0);

    if (maskActive) renderer.state.buffers.stencil.setTest(false);

    // Render input to screen
    if (this.renderToScreen) {
      this._fsQuad.material = this._basic;
      this._basic.map = readBuffer.texture;

      renderer.setRenderTarget(null);
      renderer.clear();
      this._fsQuad.render(renderer);
    }

    // 1. Extract Bright Areas
    this.highPassUniforms["tDiffuse"].value = readBuffer.texture;
    this.highPassUniforms["luminosityThreshold"].value = this.threshold;
    this._fsQuad.material = this.materialHighPassFilter;

    renderer.setRenderTarget(this.renderTargetBright);
    renderer.clear();
    this._fsQuad.render(renderer);

    // 2. Blur All the mips progressively
    let inputRenderTarget = this.renderTargetBright;

    for (let i = 0; i < this.nMips; i++) {
      this._fsQuad.material = this.separableBlurMaterials[i];

      this.separableBlurMaterials[i].uniforms["colorTexture"].value =
        inputRenderTarget.texture;
      this.separableBlurMaterials[i].uniforms["direction"].value =
        UnrealBloomPassRGBA.BlurDirectionX;
      renderer.setRenderTarget(this.renderTargetsHorizontal[i]);
      renderer.clear();
      this._fsQuad.render(renderer);

      this.separableBlurMaterials[i].uniforms["colorTexture"].value =
        this.renderTargetsHorizontal[i].texture;
      this.separableBlurMaterials[i].uniforms["direction"].value =
        UnrealBloomPassRGBA.BlurDirectionY;
      renderer.setRenderTarget(this.renderTargetsVertical[i]);
      renderer.clear();
      this._fsQuad.render(renderer);

      inputRenderTarget = this.renderTargetsVertical[i];
    }

    // Composite All the mips
    this._fsQuad.material = this.compositeMaterial;
    this.compositeMaterial.uniforms["bloomStrength"].value = this.strength;
    this.compositeMaterial.uniforms["bloomRadius"].value = this.radius;
    this.compositeMaterial.uniforms["bloomTintColors"].value =
      this.bloomTintColors;

    renderer.setRenderTarget(this.renderTargetsHorizontal[0]);
    renderer.clear();
    this._fsQuad.render(renderer);

    // Blend it additively over the input texture
    this._fsQuad.material = this.blendMaterial;
    this.copyUniforms["tDiffuse"].value =
      this.renderTargetsHorizontal[0].texture;

    if (maskActive) renderer.state.buffers.stencil.setTest(true);

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this._fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(readBuffer);
      this._fsQuad.render(renderer);
    }

    // Restore renderer settings
    renderer.setClearColor(this._oldClearColor, this._oldClearAlpha);
    renderer.autoClear = oldAutoClear;
  }

  /**
   * MODIFIED: Creates Gaussian blur material that preserves alpha channel
   * Original version used vec3 and discarded alpha with gl_FragColor = vec4(rgb, 1.0)
   */
  private _getSeparableBlurMaterial(kernelRadius: number): ShaderMaterial {
    const coefficients: number[] = [];

    for (let i = 0; i < kernelRadius; i++) {
      coefficients.push(
        (0.39894 * Math.exp((-0.5 * i * i) / (kernelRadius * kernelRadius))) /
          kernelRadius,
      );
    }

    return new ShaderMaterial({
      defines: {
        KERNEL_RADIUS: kernelRadius,
      },

      uniforms: {
        colorTexture: { value: null },
        invSize: { value: new Vector2(0.5, 0.5) },
        direction: { value: new Vector2(0.5, 0.5) },
        gaussianCoefficients: { value: coefficients },
      },

      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,

      fragmentShader: `
        #include <common>
        varying vec2 vUv;
        uniform sampler2D colorTexture;
        uniform vec2 invSize;
        uniform vec2 direction;
        uniform float gaussianCoefficients[KERNEL_RADIUS];

        void main() {
          float weightSum = gaussianCoefficients[0];
          // MODIFIED: Blur RGB only, preserve center pixel alpha
          vec4 centerSample = texture2D(colorTexture, vUv);
          vec3 diffuseSum = centerSample.rgb * weightSum;

          for(int i = 1; i < KERNEL_RADIUS; i++) {
            float x = float(i);
            float w = gaussianCoefficients[i];
            vec2 uvOffset = direction * invSize * x;
            // Sample RGB only for blurring
            vec3 sample1 = texture2D(colorTexture, vUv + uvOffset).rgb;
            vec3 sample2 = texture2D(colorTexture, vUv - uvOffset).rgb;
            diffuseSum += (sample1 + sample2) * w;
            weightSum += 2.0 * w;
          }

          // MODIFIED: RGB is blurred, alpha is preserved from center pixel
          gl_FragColor = vec4(diffuseSum / weightSum, centerSample.a);
        }
      `,
    });
  }

  /**
   * MODIFIED: Composite material that preserves alpha channel
   * Original version implicitly set alpha to 1.0 through vec4(vec3, 1.0) operations
   */
  private _getCompositeMaterial(nMips: number): ShaderMaterial {
    return new ShaderMaterial({
      defines: {
        NUM_MIPS: nMips,
      },

      uniforms: {
        blurTexture1: { value: null },
        blurTexture2: { value: null },
        blurTexture3: { value: null },
        blurTexture4: { value: null },
        blurTexture5: { value: null },
        bloomStrength: { value: 1.0 },
        bloomFactors: { value: null },
        bloomTintColors: { value: null },
        bloomRadius: { value: 0.0 },
      },

      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,

      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D blurTexture1;
        uniform sampler2D blurTexture2;
        uniform sampler2D blurTexture3;
        uniform sampler2D blurTexture4;
        uniform sampler2D blurTexture5;
        uniform float bloomStrength;
        uniform float bloomRadius;
        uniform float bloomFactors[NUM_MIPS];
        uniform vec3 bloomTintColors[NUM_MIPS];

        float lerpBloomFactor(const in float factor) {
          float mirrorFactor = 1.2 - factor;
          return mix(factor, mirrorFactor, bloomRadius);
        }

        void main() {
          // MODIFIED: Preserve alpha channel through composite
          vec4 sum = lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
            lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
            lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
            lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
            lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv);

          // Apply bloomStrength only to RGB, preserve alpha for maskMode
          // BUGFIX: Use alpha from highest resolution MIP (blurTexture1) to preserve occlusionMode
          float originalAlpha = texture2D(blurTexture1, vUv).a;
          vec3 bloomRGB = bloomStrength * sum.rgb;
          gl_FragColor = vec4(bloomRGB, originalAlpha);
        }
      `,
    });
  }
}
