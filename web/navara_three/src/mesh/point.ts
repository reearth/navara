import { Unimplemented } from "@navara/core";
import { PointMaterial as NavaraPointMaterial } from "@navara/engine";
import BatchDefinitioin from "@shaders/glsl/chunks/batch_definition.glsl";
import BillboardMatrix from "@shaders/glsl/chunks/billboardMat.glsl";
import HeightParsVertex from "@shaders/glsl/chunks/height_pars_vertex.glsl";
import HorizonCullingParsVertex from "@shaders/glsl/chunks/horizon_culling_pars_vertex.glsl";
import HorizonCullingVertex from "@shaders/glsl/chunks/horizon_culling_vertex.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import ProjectUniformVertexRte from "@shaders/glsl/chunks/project_uniform_vertex_rte.glsl";
import RtcSpriteVertex from "@shaders/glsl/chunks/rtc_sprite_vertex.glsl";
import RteUniformParsVertex from "@shaders/glsl/chunks/rte_uniform_pars_vertex.glsl";
import RteUniformVertex from "@shaders/glsl/chunks/rte_uniform_vertex.glsl";
import SpriteHeightParsVertex from "@shaders/glsl/chunks/sprite_height_pars_vertex.glsl";
import PointFragShader from "@shaders/glsl/point.frag.glsl";
import {
  Color,
  LessDepth,
  Matrix4,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";

import { createReplacer } from "../utils";

import { FeatureMesh } from "./featureMesh";
import { setupRTEMesh } from "./rteHelper";

export class PointMesh extends Sprite implements FeatureMesh {
  constructor(
    material: NavaraPointMaterial,
    batchId: number,
    active: boolean,
    useRTE = false,
  ) {
    super(new SpriteMaterial());

    this.userData.rtcPos = {
      value: new Vector3(),
    };
    this.userData.rtePosHigh = {
      value: new Vector3(),
    };
    this.userData.rtePosLow = {
      value: new Vector3(),
    };
    this.userData.useRTE = useRTE;

    this.initMaterial(material, batchId, active);

    // TODO: calculate bounding sphere and aabb
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

    // Set up RTE uniforms if using RTE (matching polygon.ts)
    const useRTE = this.userData.useRTE || false;
    if (useRTE) {
      this.userData.modelViewMatrixRTE = {
        value: new Matrix4(),
      };
      this.userData.cameraPositionHigh = {
        value: new Vector3(),
      };
      this.userData.cameraPositionLow = {
        value: new Vector3(),
      };

      // Point uses identity matrix for camera position (world space)
      const identityMatrix = new Matrix4();
      const callback = setupRTEMesh(
        this,
        this.userData,
        undefined,
        identityMatrix,
      );
      if (callback) {
        this.onBeforeRender = callback;
      }
    }

    material.depthFunc = LessDepth;
    material.onBeforeCompile = (shader) => {
      shader.defines ??= {};
      Object.assign(shader.defines, material.userData.defines);
      shader.uniforms.nvr_uBatchId = { value: batchId };
      shader.uniforms.nvr_uPickable = this.userData.uPickable;
      // Pass height uniform to shader
      shader.uniforms.uAddHeight = material.userData.uAddHeight;
      shader.uniforms.uOffsetDepth = material.userData.uOffsetDepth;

      // RTC/RTE: Pass position uniforms
      shader.uniforms.rtcPos = this.userData.rtcPos;
      shader.uniforms.rtePosHigh = this.userData.rtePosHigh;
      shader.uniforms.rtePosLow = this.userData.rtePosLow;
      shader.uniforms.useRTE = { value: useRTE };

      if (useRTE) {
        shader.uniforms.u_cameraPositionHigh = this.userData.cameraPositionHigh;
        shader.uniforms.u_cameraPositionLow = this.userData.cameraPositionLow;
        shader.uniforms.modelViewMatrixRTE = this.userData.modelViewMatrixRTE;
      } else {
        // Set default values for non-RTE mode
        shader.uniforms.u_cameraPositionHigh = { value: new Vector3() };
        shader.uniforms.u_cameraPositionLow = { value: new Vector3() };
        shader.uniforms.modelViewMatrixRTE = { value: new Matrix4() };
      }

      shader.vertexShader = createReplacer(shader.vertexShader)
        .replace(
          "uniform vec2 center;",
          `
          uniform vec2 center;
          ${HeightParsVertex}
          uniform vec3 rtcPos;
          uniform bool useRTE;
          ${RteUniformParsVertex}
          out vec2 sprite_uv;
          ${HorizonCullingParsVertex}
          ${SpriteHeightParsVertex}
          ${BillboardMatrix}
          `,
        )
        .replace(
          "vec4 mvPosition = modelViewMatrix[ 3 ];",
          `
          mat4 modelViewMatrixNoScale;
          vec4 mvPosition;

          if (useRTE) {
            ${RteUniformVertex}
            ${ProjectUniformVertexRte}

            ${HorizonCullingVertex}

            // Apply height offset
            mvPosition += mvr_getMvHeightOffset(absTransformed, uAddHeight);
          } else {
            ${RtcSpriteVertex}
            ${HorizonCullingVertex}

            // Apply height offset
            mvPosition = posMv + mvr_getMvHeightOffset(absTransformed, uAddHeight);
          }
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
    // RTE mode must always have frustumCulled = false
    // because mesh position (0,0,0) doesn't match actual rendering position
    if (this.userData.useRTE) {
      this.frustumCulled = false;
    } else {
      this.frustumCulled = culled;
    }
  }

  _setFeatureExtrudedHeight(_height: number): void {
    throw new Unimplemented();
  }

  _setFeatureHeight(height: number): void {
    this.material.userData.uAddHeight.value = height;
  }
}
