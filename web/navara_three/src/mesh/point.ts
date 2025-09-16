import { Unimplemented } from "@navara/core";
import { PointMaterial as NavaraPointMaterial } from "@navara/engine";
import BatchDefinitioin from "@shaders/glsl/chunks/batch_definition.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import PointFragShader from "@shaders/glsl/point.frag.glsl";
import { Color, Sprite, SpriteMaterial } from "three";

import type { CommonUniforms } from "../uniforms";
import { createReplacer } from "../utils";

import { FeatureMesh } from "./featureMesh";

export class PointMesh extends Sprite implements FeatureMesh {
  constructor(
    material: NavaraPointMaterial,
    uniforms: CommonUniforms,
    batchId: number,
    selected: boolean,
    active: boolean,
  ) {
    super(new SpriteMaterial());

    this.initMaterial(material, uniforms, batchId, selected, active);
  }

  private initMaterial(
    meshMaterial: NavaraPointMaterial,
    uniforms: CommonUniforms,
    batchId: number,
    selected: boolean,
    active: boolean,
  ) {
    const material = this.material;

    this.userData.uPickable = {
      value: 0.0,
    };

    material.customProgramCacheKey = () => JSON.stringify(material.userData.defines);
    material.onBeforeCompile = (shader) => {
      shader.defines ??= {};
      Object.assign(shader.defines, material.userData.defines);
      shader.uniforms.nvr_uBatchId = { value: batchId };
      shader.uniforms.nvr_uPickable = this.userData.uPickable;

      shader.vertexShader = createReplacer(shader.vertexShader)
        .replace(
          "uniform vec2 center;",
          `
          uniform vec2 center;
          out vec2 sprite_uv;
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
          `,
        ).source;
    };

    if (meshMaterial.center) {
      this.center.set(meshMaterial.center.x, meshMaterial.center.y);
    }

    this.userData.batchId = batchId;
    this.userData.isPicked = false;

    if (selected && uniforms?.highlightColor?.value) {
      material.color.set(uniforms.highlightColor.value);
      this.userData.isPicked = true;
    }

    this._update(meshMaterial, active);
  }

  _update(material: NavaraPointMaterial, active: boolean) {
    if (!this.material.userData.prev) {
      this.material.userData.prev = {};
    }
    const prev = this.material.userData.prev;

    if (prev.color !== material.color) {
      if (!this.userData.isPicked) {
        this.material.color.set(material.color ?? 0);
      }
      prev.color = material.color;
    }

    const nextDepthTest = !!material.depth_test;
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

    const nextScaleByDistance = !material.scale_by_distance;
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
}
