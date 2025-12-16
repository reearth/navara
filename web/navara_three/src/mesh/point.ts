import { Unimplemented } from "@navara/core";
import { PointMaterial as NavaraPointMaterial } from "@navara/engine";
import BatchDefinitioin from "@shaders/glsl/chunks/batch_definition.glsl";
import HeightParsVertex from "@shaders/glsl/chunks/height_pars_vertex.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import PointFragShader from "@shaders/glsl/point.frag.glsl";
import { Color, Sprite, SpriteMaterial } from "three";

import { createReplacer } from "../utils";

import { FeatureMesh } from "./featureMesh";

export class PointMesh extends Sprite implements FeatureMesh {
  constructor(material: NavaraPointMaterial, batchId: number, active: boolean) {
    super(new SpriteMaterial());

    this.initMaterial(material, batchId, active);
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

    material.onBeforeCompile = (shader) => {
      shader.defines ??= {};
      Object.assign(shader.defines, material.userData.defines);
      shader.uniforms.nvr_uBatchId = { value: batchId };
      shader.uniforms.nvr_uPickable = this.userData.uPickable;
      // Pass height uniform to shader
      shader.uniforms.uAddHeight = material.userData.uAddHeight;

      shader.vertexShader = createReplacer(shader.vertexShader)
        .replace(
          "uniform vec2 center;",
          `
          uniform vec2 center;
          ${HeightParsVertex}
          out vec2 sprite_uv;
          out vec3 vWorldPosition;
          `,
        )
        .replace(
          "vec4 mvPosition = modelViewMatrix[ 3 ];",
          `
          // Offset anchor world position along globe normal by addHeight
          vec4 worldPosition = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          vWorldPosition = worldPosition.xyz;
          vec3 globeNormal = normalize(worldPosition.xyz);
          worldPosition.xyz += globeNormal * uAddHeight;
          vec4 mvPosition = viewMatrix * worldPosition;
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
          gl_FragDepth = 0.0;
          `,
        )
        .replace(
          `void main() {`,
        `
        in vec3 vWorldPosition;

        bool nvr_horizon_culled(vec3 worldPos, vec3 cameraPosition) {
          const vec3 EARTH_RADIUS = vec3(6378137.0, 6378137.0,6356752.3142451793);

          vec3 cameraPositionScaled = cameraPosition / EARTH_RADIUS;
          vec3 worldPosScaled = worldPos / EARTH_RADIUS;

          vec3 vt = cameraPositionScaled - worldPosScaled;
          vec3 vc = cameraPositionScaled;
          float a = dot(vc, vc) - 1.0;

          return  dot(vt, vc) > a;
        }

        void main() {
          if (nvr_horizon_culled(vWorldPosition, cameraPosition)) discard;
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
