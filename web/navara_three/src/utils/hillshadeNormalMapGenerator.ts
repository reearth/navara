import HillshadeParsFragment from "@shaders/glsl/chunks/hillshade_pars_fragment.glsl";
import {
  DataTexture,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";

import type { HillshadeConfig } from "../event/HillshadeContext";

/**
 * Generator for hillshade normal maps using offscreen rendering.
 * Converts DEM textures into pre-computed normal maps to improve runtime performance.
 */
export class HillshadeNormalMapGenerator {
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: OrthographicCamera;
  private material: ShaderMaterial;
  private quad: Mesh;

  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer;

    // Setup scene and camera for offscreen rendering
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create shader material for normal computation
    // Uses hillshade_pars_fragment.glsl for DEM decoding
    this.material = new ShaderMaterial({
      uniforms: {
        uDemTexture: { value: null },
        uTexelSize: { value: [0, 0] },
        uMetersPerTexel: { value: 1.0 },
        uOutputSize: { value: [0, 0] }, // Output render target size (content size without padding)
        // Hillshade decoder uniforms (will be set per-generation)
        uHillshadeRGBScaler: { value: [256, 1, 1 / 256] },
        uHillshadeBoundary: { value: 0 },
        uHillshadeMinOffset: { value: 0 },
        uHillshadeMaxOffset: { value: 0 },
        uHillshadeEpsilon: { value: 1.0 },
        uHillshadeOffset: { value: -32768 },
      },
      vertexShader: `
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        #define USE_HILLSHADE 1

        uniform sampler2D uDemTexture;
        uniform vec2 uTexelSize;
        uniform float uMetersPerTexel;
        uniform vec2 uOutputSize;

        // Import DEM decoding and normal computation from hillshade shader
        ${HillshadeParsFragment}

        void main() {
          ivec2 texSize = textureSize(uDemTexture, 0);

          // Compute UV from gl_FragCoord using correct OUTPUT size (not DEM padded size)
          // gl_FragCoord ranges from (0.5, 0.5) to (width-0.5, height-0.5)
          // Map to UV [0,1] spanning pixel centers: (fragCoord - 0.5) / (size - 1)
          vec2 pixelCoord = gl_FragCoord.xy - 0.5;
          vec2 uv = pixelCoord / (uOutputSize - 1.0);

          // Flip Y to match DEM texture coordinate system (top-down)
          // gl_FragCoord is OpenGL coords (y=0 at bottom), but DEM texture is top-down (y=0 at top)
          uv.y = 1.0 - uv.y;

          // Check if this is valid terrain data
          float testHeight = sampleHeightBilinear(uDemTexture, uv, texSize);

          if (!isValidHeight(testHeight)) {
            // Invalid data (ocean/no-data), output default upward normal (0, 0, 1)
            // Store directly in RGB channels, mapped from [-1,1] to [0,1]
            gl_FragColor = vec4(0.5, 0.5, 1.0, 1.0);
            return;
          }

          // Compute normal from DEM
          vec3 normal = computeNormalFromDEM(uDemTexture, uv, uTexelSize, uMetersPerTexel);

          // Store normal directly in RGB channels (linear, can use hardware bilinear filtering)
          // Map from [-1,1] to [0,1] for 8-bit storage
          gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);
        }
      `,
    });

    // Create fullscreen quad
    const geometry = new PlaneGeometry(2, 2);
    this.quad = new Mesh(geometry, this.material);
    this.scene.add(this.quad);
  }

  /**
   * Render normal map to an existing RenderTarget (GPU-only, no readback)
   * Used by HillshadeContext's RenderTarget pool to avoid GPU→CPU→GPU round-trip
   * @param renderTarget - Target to render to (owned by HillshadeContext)
   * @param demTexture - Source DEM texture (padded)
   * @param metersPerTexel - Meters per texel for normal calculation
   * @param hillshadeConfig - Hillshade decoder configuration
   */
  renderToTarget(
    renderTarget: WebGLRenderTarget,
    demTexture: DataTexture,
    metersPerTexel: number,
    hillshadeConfig: HillshadeConfig,
  ): void {
    const contentWidth = renderTarget.width;
    const contentHeight = renderTarget.height;

    // Calculate texel size for DEM sampling
    const texelSize = 1.0 / (contentWidth - 1);

    // Update shader uniforms
    this.material.uniforms.uDemTexture.value = demTexture;
    this.material.uniforms.uTexelSize.value = [texelSize, texelSize];
    this.material.uniforms.uMetersPerTexel.value = metersPerTexel;
    this.material.uniforms.uOutputSize.value = [contentWidth, contentHeight];

    // Update hillshade decoder uniforms from Rust config
    this.material.uniforms.uHillshadeRGBScaler.value =
      hillshadeConfig.rgbScaler;
    this.material.uniforms.uHillshadeBoundary.value = hillshadeConfig.boundary;
    this.material.uniforms.uHillshadeMinOffset.value =
      hillshadeConfig.minOffset;
    this.material.uniforms.uHillshadeMaxOffset.value =
      hillshadeConfig.maxOffset;
    this.material.uniforms.uHillshadeEpsilon.value = hillshadeConfig.epsilon;
    this.material.uniforms.uHillshadeOffset.value = hillshadeConfig.offset;

    const currentRenderTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(renderTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(currentRenderTarget);

    // RenderTarget.texture uses default flipY=false (OpenGL bottom-up)
    // Do not set flipY - shader UV transform should handle coordinate mapping
    renderTarget.texture.version++;
    renderTarget.texture.needsUpdate = true;
  }

  /**
   * Debug: Save normal map to file
   * @param renderTarget - RenderTarget to read from
   * @param filename - Output filename
   */
  dbgSaveNormalMap(renderTarget: WebGLRenderTarget, filename: string): void {
    const width = renderTarget.width;
    const height = renderTarget.height;
    const pixels = new Uint8Array(width * height * 4);

    this.renderer.readRenderTargetPixels(
      renderTarget,
      0,
      0,
      width,
      height,
      pixels,
    );

    // Create canvas and write pixels
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);

    // Download
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  dispose(): void {
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}
