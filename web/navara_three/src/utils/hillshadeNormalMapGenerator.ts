import HillshadeParsFragment from "@shaders/glsl/chunks/hillshade_pars_fragment.glsl";
import { packing } from "@takram/three-geospatial/shaders";
import {
  ClampToEdgeWrapping,
  DataTexture,
  Mesh,
  NearestFilter,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
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

        // Import packing functions (signNotZero, packNormalToVec2, etc.)
        ${packing}

        // Import DEM decoding and normal computation from hillshade shader
        ${HillshadeParsFragment}

        void main() {
          ivec2 texSize = textureSize(uDemTexture, 0);

          // Compute UV from gl_FragCoord using correct OUTPUT size (not DEM padded size)
          // gl_FragCoord ranges from (0.5, 0.5) to (width-0.5, height-0.5)
          // Map to UV [0,1] spanning pixel centers: (fragCoord - 0.5) / (size - 1)
          vec2 pixelCoord = gl_FragCoord.xy - 0.5;
          vec2 uv = pixelCoord / (uOutputSize - 1.0);

          // Check if this is valid terrain data
          float testHeight = sampleHeightBilinear(uDemTexture, uv, texSize);

          if (!isValidHeight(testHeight)) {
            // Invalid data (ocean/no-data), output default upward normal
            vec2 packed = packNormalToVec2(vec3(0.0, 0.0, 1.0));
            gl_FragColor = vec4(packed * 0.5 + 0.5, 0.0, 1.0);
            return;
          }

          // Compute normal from DEM
          vec3 normal = computeNormalFromDEM(uDemTexture, uv, uTexelSize, uMetersPerTexel);

          // Pack normal to RG channels and map to [0,1] for storage
          vec2 packed = packNormalToVec2(normal);
          gl_FragColor = vec4(packed * 0.5 + 0.5, 0.0, 1.0);
        }
      `,
    });

    // Create fullscreen quad
    const geometry = new PlaneGeometry(2, 2);
    this.quad = new Mesh(geometry, this.material);
    this.scene.add(this.quad);
  }

  /**
   * Generate normal map from DEM texture
   * @param demTexture - Source DEM texture (padded, e.g. 514x514 for 512 content)
   * @param metersPerTexel - Meters per texel for normal calculation
   * @param hillshadeConfig - Hillshade decoder configuration from Rust
   * @returns Normal map texture without padding (e.g. 512x512)
   */
  generate(
    demTexture: DataTexture,
    metersPerTexel: number,
    hillshadeConfig: HillshadeConfig,
  ): DataTexture {
    const paddedWidth = demTexture.image.width;
    const paddedHeight = demTexture.image.height;

    // Calculate content size (remove padding)
    // Power of 2 = no padding, otherwise has 2px padding (1px each side)
    const contentWidth = this.isPowerOfTwo(paddedWidth)
      ? paddedWidth
      : paddedWidth - 2;
    const contentHeight = this.isPowerOfTwo(paddedHeight)
      ? paddedHeight
      : paddedHeight - 2;

    // Guard against invalid/placeholder textures (e.g., 1x1 textures)
    // Need at least 2x2 to compute meaningful normals
    const minSize = 2;
    if (contentWidth < minSize || contentHeight < minSize) {
      console.warn(
        `HillshadeNormalMapGenerator: DEM texture too small (${contentWidth}x${contentHeight}), ` +
          `returning default flat normal map`,
      );

      // Return a minimal 1x1 texture with default upward normal (0, 0, 1)
      // Encoded as octahedral and mapped to [0,1]: (0.5, 0.5, 0, 1)
      const defaultPixels = new Uint8Array([127, 127, 0, 255]);
      const defaultTexture = new DataTexture(
        defaultPixels,
        1,
        1,
        RGBAFormat,
        UnsignedByteType,
      );
      defaultTexture.colorSpace = NoColorSpace;
      defaultTexture.needsUpdate = true;
      return defaultTexture;
    }

    // Calculate texel size for DEM sampling
    // Standard UV mapping: UV [0,1] maps to pixel centers [first, last]
    // So texelSize (UV distance between adjacent pixels) = 1 / (N - 1)
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

    // Create render target for CONTENT SIZE (without padding)
    // Use NearestFilter to avoid any hardware interpolation during generation
    const renderTarget = new WebGLRenderTarget(contentWidth, contentHeight, {
      format: RGBAFormat,
      type: UnsignedByteType,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
      colorSpace: NoColorSpace,
    });

    // Render to target
    const currentRenderTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(renderTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(currentRenderTarget);

    // Read pixels from render target
    const pixels = new Uint8Array(contentWidth * contentHeight * 4);
    this.renderer.readRenderTargetPixels(
      renderTarget,
      0,
      0,
      contentWidth,
      contentHeight,
      pixels,
    );

    // Clean up render target
    renderTarget.dispose();

    // Create normal map texture (content size, no padding)
    const normalMap = new DataTexture(
      pixels,
      contentWidth,
      contentHeight,
      RGBAFormat,
      UnsignedByteType,
    );
    normalMap.needsUpdate = true;
    // readRenderTargetPixels returns data in WebGL coordinate system (bottom-up)
    // Set flipY=true to match Three.js texture coordinate system (top-down)
    normalMap.flipY = true;
    // Use NearestFilter to avoid hardware interpolation of encoded normals
    // Manual bilinear interpolation is performed in sampleBilinearNormal()
    normalMap.minFilter = NearestFilter;
    normalMap.magFilter = NearestFilter;
    normalMap.wrapS = ClampToEdgeWrapping;
    normalMap.wrapT = ClampToEdgeWrapping;
    normalMap.colorSpace = NoColorSpace;

    return normalMap;
  }

  private isPowerOfTwo(n: number): boolean {
    return (n & (n - 1)) === 0 && n !== 0;
  }

  dispose(): void {
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}
