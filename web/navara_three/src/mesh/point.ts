import { PointMesh as NavaraPointMesh, PointMaterial } from "@navara/engine";
import BatchDefinitioin from "@shaders/glsl/chunks/batch_definition.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import PointFragShader from "@shaders/glsl/point.frag.glsl";
import { Color, Sprite, SpriteMaterial } from "three";

import type { CommonUniforms } from "../uniforms";
import { createReplacer } from "../utils";

import { FeatureMesh } from "./featureMesh";

export class PointMesh extends Sprite implements FeatureMesh {
  constructor(m: NavaraPointMesh, uniforms: CommonUniforms) {
    super(new SpriteMaterial());

    this.initMaterial(m, uniforms);
  }

  private initMaterial(m: NavaraPointMesh, uniforms: CommonUniforms) {
    const meshMaterial = m.material;

    const material = this.material;

    material.userData.uPickable = {
      value: 0.0,
    };
    const batchId = m.geometry.batch_id ?? 0;

    material.onBeforeCompile = (shader) => {
      shader.uniforms.nvr_uBatchId = { value: batchId };
      shader.uniforms.nvr_uPickable = material.userData.uPickable;

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
          
          gl_FragColor.a = alpha;
          
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

    if (m.geometry.selected && uniforms?.highlightColor?.value) {
      material.color.set(uniforms.highlightColor.value);
      this.userData.isPicked = true;
    }

    this._update(meshMaterial, m.active);
  }

  _update(material: PointMaterial, active: boolean) {
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
}
