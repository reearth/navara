import { Unimplemented } from "@navara/core";
import { BillboardMaterial as NavaraBillboardMaterial } from "@navara/engine";
import BatchDefinitioin from "@shaders/glsl/chunks/batch_definition.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import { Color, Sprite, SpriteMaterial } from "three";
import invariant from "tiny-invariant";

import { TEXTURE_LOADER } from "../event/loaders";
import type { CommonUniforms } from "../uniforms";
import { createReplacer } from "../utils";

import { FeatureMesh } from "./featureMesh";

export class BillboardMesh extends Sprite implements FeatureMesh {
  constructor() {
    super(new SpriteMaterial());
  }

  async _init(
    material: NavaraBillboardMaterial,
    uniforms: CommonUniforms,
    batchId: number,
    selected: boolean,
    active: boolean,
  ) {
    await this.initMaterial(material, uniforms, batchId, selected, active);
  }

  private async initMaterial(
    meshMaterial: NavaraBillboardMaterial,
    uniforms: CommonUniforms,
    batchId: number,
    selected: boolean,
    active: boolean,
  ) {
    invariant(meshMaterial.url);

    const material = this.material;

    this.userData.uPickable = {
      value: 0.0,
    };

    material.onBeforeCompile = (shader) => {
      shader.uniforms.nvr_uBatchId = { value: batchId };
      shader.uniforms.nvr_uPickable = this.userData.uPickable;

      shader.fragmentShader = createReplacer(shader.fragmentShader)
        .replace(
          "#include <clipping_planes_pars_fragment>",
          `
        #include <clipping_planes_pars_fragment>
        ${BatchDefinitioin}
        ${Pick}
      `,
        )
        .replace(
          "#include <fog_fragment>",
          `
        #include <fog_fragment>
        if (nvr_uPickable > 0.0 && sampledDiffuseColor.a > 0.0) {
          vec3 pickColor = nvr_batchIdToColor(nvr_uBatchId);
          gl_FragColor = vec4(pickColor.xyz, 1.0);
        }
        `,
        ).source;
    };

    this.userData.batchId = batchId;
    this.userData.isPicked = false;
    this.userData.color = meshMaterial.color;

    if (selected && uniforms?.highlightColor?.value) {
      material.color.set(uniforms.highlightColor.value);
      this.userData.isPicked = true;
    }

    await this._update(meshMaterial, active);
  }

  async _update(material: NavaraBillboardMaterial, active: boolean) {
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

    const nextUrl = material.url;
    if (prev.url !== nextUrl) {
      const map = nextUrl ? await TEXTURE_LOADER.loadAsync(nextUrl) : undefined;
      if (map) {
        this.material.map = map;
      } else {
        this.material.map?.dispose();
      }
      prev.url = nextUrl;
    }

    const nextDepthTest = !!material.depth_test;
    if (prev.depthTest !== nextDepthTest) {
      this.material.depthTest = nextDepthTest;
      prev.depthTest = nextDepthTest;
    }

    const nextAlphaTest = material.alpha_test;
    if (prev.alphaTest !== nextAlphaTest) {
      this.material.alphaTest = nextAlphaTest ?? 0;
      prev.alphaTest = nextAlphaTest;
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

  _getFeatureColor(): Color {
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
