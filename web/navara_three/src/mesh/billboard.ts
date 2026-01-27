import { Unimplemented } from "@navara/core";
import {
  BillboardMaterial as NavaraBillboardMaterial,
  type Transform,
} from "@navara/engine";
import BatchDefinitioin from "@shaders/glsl/chunks/batch_definition.glsl";
import BillboardMatrix from "@shaders/glsl/chunks/billboardMat.glsl";
import HeightParsVertex from "@shaders/glsl/chunks/height_pars_vertex.glsl";
import HorizonCullingParsVertex from "@shaders/glsl/chunks/horizon_culling_pars_vertex.glsl";
import HorizonCullingVertex from "@shaders/glsl/chunks/horizon_culling_vertex.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import RtcSpriteVertex from "@shaders/glsl/chunks/rtc_sprite_vertex.glsl";
import RteUniformParsVertex from "@shaders/glsl/chunks/rte_uniform_pars_vertex.glsl";
import RteUniformVertex from "@shaders/glsl/chunks/rte_uniform_vertex.glsl";
import SpriteHeightParsVertex from "@shaders/glsl/chunks/sprite_height_pars_vertex.glsl";
import {
  Color,
  LessDepth,
  Matrix4,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";
import invariant from "tiny-invariant";

import { TEXTURE_LOADER } from "../event/loaders";
import { createReplacer } from "../utils";

import { FeatureMesh } from "./featureMesh";
import {
  setupRTEBeforeRender,
  setRTEPosition,
  setRTCPosition,
} from "./rtcRteHelper";

export class BillboardMesh extends Sprite implements FeatureMesh {
  constructor(useRTE = false) {
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

    // TODO: calculate bounding sphere and aabb
    this.frustumCulled = false;
  }

  async _init(
    material: NavaraBillboardMaterial,
    batchId: number,
    active: boolean,
  ) {
    await this.initMaterial(material, batchId, active);
  }

  private async initMaterial(
    meshMaterial: NavaraBillboardMaterial,
    batchId: number,
    active: boolean,
  ) {
    invariant(meshMaterial.url);

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

    // Set up RTE uniforms if using RTE (matching point.ts)
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

      // Billboard uses identity matrix for camera position (world space)
      const identityMatrix = new Matrix4();
      const callback = setupRTEBeforeRender(
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

      // Declare uniform in vertex shader and apply to position
      shader.vertexShader = createReplacer(shader.vertexShader)
        .replace(
          "uniform vec2 center;",
          `
        uniform vec2 center;
        ${HeightParsVertex}
        uniform vec3 rtcPos;
        uniform bool useRTE;
        ${RteUniformParsVertex}
        ${HorizonCullingParsVertex}
        ${SpriteHeightParsVertex}
        ${BillboardMatrix}
        `,
        )
        .replace(
          "vec4 mvPosition = modelViewMatrix[ 3 ];",
          `
          vec4 mvPosition;

          if (useRTE) {
            // RTE mode: decode absolute world position and camera-relative position
            ${RteUniformVertex}

            // Remove scale from modelViewMatrixRTE to avoid scaling the anchor position
            mat4 modelViewMatrixRTENoScale = nvr_removeScaleFromMat4(modelViewMatrixRTE);
            mvPosition = modelViewMatrixRTENoScale * vec4(transformed, 1.0);

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
        ).source;

      shader.fragmentShader = createReplacer(shader.fragmentShader)
        .replace(
          "#include <clipping_planes_pars_fragment>",
          `
        #include <clipping_planes_pars_fragment>
        ${BatchDefinitioin}
        ${Pick}
        uniform bool uOffsetDepth;  
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

        // Offset depth to make sure to be drawn over ellipsoid surface
        if (uOffsetDepth) { gl_FragDepth -= 0.2; }
        `,
        )
        .replace(
          "void main() {",
          `
        flat in int vHorizonCulled;
        
        void main() {
          if (vHorizonCulled == 1) discard;
        `,
        ).source;
    };

    this.userData.batchId = batchId;
    this.userData.color = meshMaterial.color;

    await this._update(meshMaterial, active);
  }

  setPosition(
    useRTE: boolean,
    position: Float32Array<ArrayBufferLike> | null | undefined,
    positionHigh: Float32Array<ArrayBufferLike> | null | undefined,
    positionLow: Float32Array<ArrayBufferLike> | null | undefined,
    posIdx: number,
    transform: Transform,
  ): void {
    if (useRTE) {
      setRTEPosition(this, positionHigh, positionLow, posIdx, transform);
    } else {
      setRTCPosition(this, position, posIdx, transform);
    }
  }

  async _update(material: NavaraBillboardMaterial, active: boolean) {
    if (!this.material.userData.prev) {
      this.material.userData.prev = {};
    }
    const prev = this.material.userData.prev;

    if (prev.color !== material.color) {
      this.material.color.set(material.color ?? 0);
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

    const nextDepthTest = !!material.depthTest;
    if (prev.depthTest !== nextDepthTest) {
      this.material.depthTest = nextDepthTest;
      prev.depthTest = nextDepthTest;
    }

    const nextOffsetDepth = !!material.offsetDepth;
    if (prev.offsetDepth !== nextOffsetDepth) {
      this.material.userData.uOffsetDepth.value = nextOffsetDepth;
      prev.offsetDepth = nextOffsetDepth;
    }

    const nextTransparent = !!material.transparent;
    if (prev.transparent !== nextTransparent) {
      this.material.transparent = nextTransparent;
      prev.transparent = nextTransparent;
      this.material.needsUpdate = true;
    }

    const nextAlphaTest = material.alphaTest;
    if (prev.alphaTest !== nextAlphaTest) {
      this.material.alphaTest = nextAlphaTest ?? 0;
      prev.alphaTest = nextAlphaTest;
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

  _getFeatureColor(): Color {
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
    if (this.material?.userData?.uAddHeight) {
      this.material.userData.uAddHeight.value = height;
    }
  }
}
