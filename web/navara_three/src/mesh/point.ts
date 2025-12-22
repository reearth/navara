import { Unimplemented } from "@navara/core";
import { PointMaterial as NavaraPointMaterial } from "@navara/engine";
import BatchDefinitioin from "@shaders/glsl/chunks/batch_definition.glsl";
import HeightParsVertex from "@shaders/glsl/chunks/height_pars_vertex.glsl";
import HorizonCulling from "@shaders/glsl/chunks/horizon_culling.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import PointFragShader from "@shaders/glsl/point.frag.glsl";
import { Color, LessDepth, Sprite, SpriteMaterial, Vector3 } from "three";

import { createReplacer } from "../utils";

import { FeatureMesh } from "./featureMesh";

export class PointMesh extends Sprite implements FeatureMesh {
  constructor(material: NavaraPointMaterial, batchId: number, active: boolean) {
    super(new SpriteMaterial());

    // Initialize RTC offset uniform
    this.userData.relativeOffset = {
      value: new Vector3()
    };

    this.initMaterial(material, batchId, active);

    this.frustumCulled = false;
  }

  private initMaterial(
    meshMaterial: NavaraPointMaterial,
    batchId: number,
    active: boolean,
  ) {
    const material = this.material;

    this.userData.uPickable = {
      value: 0.0,
    };

    // Height uniform (same as polygon.ts)
    material.userData.uAddHeight = {
      value: 0.0,
    };

    material.userData.uOffsetDepth = {
      value: meshMaterial.offsetDepth ?? true,
    };

    material.depthFunc = LessDepth;
    material.onBeforeCompile = (shader) => {
      shader.defines ??= {};
      Object.assign(shader.defines, material.userData.defines);
      shader.uniforms.nvr_uBatchId = { value: batchId };
      shader.uniforms.nvr_uPickable = this.userData.uPickable;
      // Pass height uniform to shader
      shader.uniforms.uAddHeight = material.userData.uAddHeight;
      shader.uniforms.uOffsetDepth = material.userData.uOffsetDepth;

      // RTC: Pass relative offset uniform
      shader.uniforms.relativeOffset = this.userData.relativeOffset;

      shader.vertexShader = createReplacer(shader.vertexShader)
        .replace(
          "uniform vec2 center;",
          `
          uniform vec2 center;
          ${HeightParsVertex}
          uniform vec3 relativeOffset;
          out vec2 sprite_uv;
          flat out int vHorizonCulled;
          ${HorizonCulling}
          `,
        )
        .replace(
          "vec4 mvPosition = modelViewMatrix[ 3 ];",
          `
          // RTC: Calculate world position by combining tile center with local offset
          vec3 tileCenter = modelMatrix[3].xyz;
          vec3 worldPosition3 = tileCenter + relativeOffset;

          // Horizon culling using the actual point position
          bool horizonCulled = nvr_horizon_culled(worldPosition3, cameraPosition);
          if (horizonCulled) {
            vHorizonCulled = 1;
            // Optimization: make the mesh verticies collapse to a single point (degenerate triangle),
            //  so no fragments are generated (zero-area triangle), hence no fragment shader invocations.
            gl_Position = vec4(0.0);
            return;
          }
          vHorizonCulled = 0;

          // Apply height offset along surface normal
          vec3 globeNormal = normalize(worldPosition3);
          worldPosition3 += globeNormal * uAddHeight;

          // Standard Three.js transformation: world space -> camera space
          vec4 mvPosition = viewMatrix * vec4(worldPosition3, 1.0);
          `,
        )
        .replace(
          "gl_Position = projectionMatrix * mvPosition;",
          `
          gl_Position = projectionMatrix * mvPosition;
          sprite_uv = position.xy;
          `,
        ).source;

      shader.fragmentShader = createReplacer(shader.fragmentShader)
        .replace(
          "uniform float opacity;",
          `
          uniform float opacity;
          ${BatchDefinitioin}
          in vec2 sprite_uv;
          ${PointFragShader}
          ${Pick}
          uniform bool uOffsetDepth;
          `,
        )
        .replace(
          "#include <fog_fragment>",
          `
          #include <fog_fragment>

          float alpha = nvr_circle_alpha(sprite_uv);
          if (alpha == 0.) {
            discard;
          }

          #ifdef USE_AA
            gl_FragColor.a = alpha;
          #endif // USE_AA

          if (nvr_uPickable > 0.0 && alpha > 0.0) {
            vec3 pickColor = nvr_batchIdToColor(nvr_uBatchId);
            gl_FragColor = vec4(pickColor.xyz, 1.0);
          }

          // Offset depth to make sure to be drawn over ellipsoid surface
          if (uOffsetDepth) { gl_FragDepth -= 0.2; }

          `,
        )
        .replace(
          `void main() {`,
          `
        flat in int vHorizonCulled;

        void main() {
          if (vHorizonCulled == 1) discard;
            `,
        ).source;
    };

    if (meshMaterial.center) {
      this.center.set(meshMaterial.center.x, meshMaterial.center.y);
    }

    this.userData.batchId = batchId;

    this._update(meshMaterial, active);
  }

  _update(material: NavaraPointMaterial, active: boolean) {
    if (!this.material.userData.prev) {
      this.material.userData.prev = {};
    }
    const prev = this.material.userData.prev;

    if (prev.color !== material.color) {
      this.material.color.set(material.color ?? 0);
      prev.color = material.color;
    }

    const nextDepthTest = !!material.depthTest;
    if (prev.depthTest !== nextDepthTest) {
      this.material.depthTest = nextDepthTest;
      prev.depthTest = nextDepthTest;
    }

    const nextOffsetDepth = material.offsetDepth ?? true;
    if (nextOffsetDepth !== prev.offsetDepth) {
      this.material.userData.uOffsetDepth.value = nextOffsetDepth;
      prev.offsetDepth = nextOffsetDepth;
    }

    const nextTransparent = !!material.transparent;
    if (prev.transparent !== nextTransparent) {
      this.material.transparent = nextTransparent;
      this.material.userData.defines ??= {};
      this.material.userData.defines.USE_AA = nextTransparent;
      prev.transparent = nextTransparent;
      this.material.needsUpdate = true;
    }

    const nextVisible = (material.show ?? true) && active;
    if (prev.visible !== nextVisible) {
      this.visible = nextVisible;
      prev.visible = nextVisible;
    }

    const nextScaleByDistance = !material.scaleByDistance;
    if (prev.scaleByDistance !== nextScaleByDistance) {
      this.material.sizeAttenuation = nextScaleByDistance;
      prev.scaleByDistance = nextScaleByDistance;
    }

    const center = material.center;
    const nextX = center?.x ?? 0;
    const nextY = center?.y ?? 0;
    if (prev.centerX !== nextX || prev.centerY !== nextY) {
      this.center.set(nextX, nextY);
      prev.centerX = nextX;
      prev.centerY = nextY;
    }
  }

  _setFeatureColor(color: Color) {
    this.material.color.set(color);
  }

  _getFeatureColor() {
    return this.material.color;
  }

  _setFeatureShow(visible: boolean): void {
    this.visible = visible;
  }

  _setFrustumCulled(culled: boolean): void {
    this.frustumCulled = culled;
  }

  _setFeatureExtrudedHeight(_height: number): void {
    throw new Unimplemented();
  }

  _setFeatureHeight(height: number): void {
    this.material.userData.uAddHeight.value = height;
  }
}
