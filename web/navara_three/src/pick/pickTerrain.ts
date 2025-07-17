import {
  WebGLRenderer,
  WebGLRenderTarget,
  Vector2,
  Vector3,
  Vector4,
  PerspectiveCamera,
  Scene,
  RGBAFormat,
  Texture,
  ShaderMaterial,
  PlaneGeometry,
  Mesh,
  OrthographicCamera,
} from "three";

import type { Nullable } from "@navara/core";

export class TerrainPicker {
  pick(
    x: number,
    y: number,
    renderer: WebGLRenderer,
    depthTexture: Texture,
    camera: PerspectiveCamera,
  ): Nullable<Vector3> {
    const logDepthOrDepth = this._sampleDepthAt(x, y, renderer, depthTexture);
    if (logDepthOrDepth === null) {
      return null;
    }

    return this._reconstructWorldPosition(
      x,
      y,
      logDepthOrDepth,
      renderer,
      camera,
    );
  }

  // Ref: https://github.com/mrdoob/three.js/blob/f38421e7bf5bc37aac7d4ebbe66ad0cc15550c39/src/renderers/shaders/ShaderChunk/packing.glsl.js#L56-L58
  private _unpackRGBAToDepth(rgba: Uint8Array): number {
    // Constants
    const UnpackDownscale = 255 / 256; // 0..1 -> fraction (excluding 1)
    const PackFactors = [1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0];

    // Calculate unpack factors
    const UnpackFactors4 = [
      UnpackDownscale / PackFactors[0],
      UnpackDownscale / PackFactors[1],
      UnpackDownscale / PackFactors[2],
      1.0 / PackFactors[3],
    ];

    // Calculate dot product
    return (
      (rgba[0] / 256.0) * UnpackFactors4[0] +
      (rgba[1] / 256.0) * UnpackFactors4[1] +
      (rgba[2] / 256.0) * UnpackFactors4[2] +
      (rgba[3] / 256.0) * UnpackFactors4[3]
    );
  }

  // Helper function to sample depth from depth texture at screen position
  private _sampleDepthAt(
    x: number,
    y: number,
    renderer: WebGLRenderer,
    depthTexture: Texture,
  ): number | null {
    if (!depthTexture) {
      return null;
    }

    const width = renderer.getContext().drawingBufferWidth;
    const height = renderer.getContext().drawingBufferHeight;
    const pixelRatio = renderer.getPixelRatio();

    // Clamp coordinates to screen bounds
    const clampedX = Math.max(
      0,
      Math.min(width - 1, Math.floor(x * pixelRatio)),
    );
    const clampedY = Math.max(
      0,
      Math.min(height - 1, Math.floor(y * pixelRatio)),
    );

    // Create a 1x1 render target to sample a single pixel
    const sampleTarget = new WebGLRenderTarget(1, 1, { format: RGBAFormat });

    // Create a simple quad shader to sample the depth texture at the specific pixel
    const material = new ShaderMaterial({
      uniforms: {
        tDepth: { value: depthTexture },
        samplePos: {
          value: new Vector2(clampedX / width, 1.0 - clampedY / height), // Flip Y
        },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDepth;
        uniform vec2 samplePos;
        varying vec2 vUv;
        
        void main() {
          vec4 depthColor = texture2D(tDepth, samplePos);
          gl_FragColor = depthColor;
        }
      `,
    });

    // Create a simple plane geometry
    const geometry = new PlaneGeometry(2, 2);
    const mesh = new Mesh(geometry, material);

    // Render to the sample target
    const scene = new Scene();
    scene.add(mesh);

    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

    renderer.setRenderTarget(sampleTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    // Read the pixel
    const pixels = new Uint8Array(4);
    renderer.readRenderTargetPixels(sampleTarget, 0, 0, 1, 1, pixels);

    // Clean up
    geometry.dispose();
    material.dispose();
    sampleTarget.dispose();

    // Unpack RGBA to depth using the same formula as the shader
    return this._unpackRGBAToDepth(pixels);
  }

  private _reconstructWorldPosition(
    x: number,
    y: number,
    depth: number,
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
  ): Vector3 {
    const near = camera.near;
    const far = camera.far;

    const width = renderer.getContext().drawingBufferWidth;
    const height = renderer.getContext().drawingBufferHeight;
    const pixelRatio = renderer.getPixelRatio();

    // Convert screen coordinates to NDC [-1,1]
    const screenCoords = new Vector2(
      ((x * pixelRatio) / width) * 2.0 - 1.0,
      -(((y * pixelRatio) / height) * 2.0 - 1.0),
    );

    let clipCoords: Vector4;

    if (renderer.capabilities.logarithmicDepthBuffer) {
      const logDepthBufFC = 2.0 / Math.log2(far + 1.0);

      const linearDepth = Math.pow(2, depth / (logDepthBufFC * 0.5)) - 1.0;
      const depthFromCamera = linearDepth + near;

      clipCoords = new Vector4(
        screenCoords.x,
        screenCoords.y,
        depth * 2.0 - 1.0, // Convert depth [0,1] to NDC [-1,1]
        1.0,
      );

      const eyeCoordinate = clipCoords
        .clone()
        .applyMatrix4(camera.projectionMatrixInverse);

      if (eyeCoordinate.w !== 0) {
        eyeCoordinate.divideScalar(eyeCoordinate.w);
      }

      // For logarithmic depth, we need to scale the eye coordinate by the actual depth
      const eyeZ = -depthFromCamera; // Negative because camera looks down -Z
      const scaleFactor = eyeZ / eyeCoordinate.z;
      eyeCoordinate.x *= scaleFactor;
      eyeCoordinate.y *= scaleFactor;
      eyeCoordinate.z = eyeZ;

      // Transform to world space
      return new Vector3(
        eyeCoordinate.x,
        eyeCoordinate.y,
        eyeCoordinate.z,
      ).applyMatrix4(camera.matrixWorld);
    } else {
      // Linear depth buffer case
      clipCoords = new Vector4(
        screenCoords.x,
        screenCoords.y,
        depth * 2.0 - 1.0,
        1.0,
      );

      // Transform to eye coordinates
      const eyeCoordinate = clipCoords
        .clone()
        .applyMatrix4(camera.projectionMatrixInverse);
      eyeCoordinate.divideScalar(eyeCoordinate.w);

      // Transform to world space
      return new Vector3(
        eyeCoordinate.x,
        eyeCoordinate.y,
        eyeCoordinate.z,
      ).applyMatrix4(camera.matrixWorld);
    }
  }
}
