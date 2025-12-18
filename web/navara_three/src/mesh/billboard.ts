import { Unimplemented } from "@navara/core";
import { BillboardMaterial as NavaraBillboardMaterial } from "@navara/engine";
import BatchDefinitioin from "@shaders/glsl/chunks/batch_definition.glsl";
import HeightParsVertex from "@shaders/glsl/chunks/height_pars_vertex.glsl";
import HorizonCulling from "@shaders/glsl/chunks/horizon_culling.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import { Color, Sprite, SpriteMaterial, LessDepth } from "three";
import invariant from "tiny-invariant";

import { TEXTURE_LOADER } from "../event/loaders";
import { createReplacer } from "../utils";

import { FeatureMesh } from "./featureMesh";

export class BillboardMesh extends Sprite implements FeatureMesh {

  constructor() {
    super(new SpriteMaterial());
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

    material.depthFunc = LessDepth;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.nvr_uBatchId = { value: batchId };
      shader.uniforms.nvr_uPickable = this.userData.uPickable;
      // Pass height uniform to shader
      shader.uniforms.uAddHeight = material.userData.uAddHeight;
      shader.uniforms.uOffsetDepth = material.userData.uOffsetDepth;

      // Declare uniform in vertex shader and apply to position
      shader.vertexShader = createReplacer(shader.vertexShader)
        .replace(
          "uniform vec2 center;",
          `
        uniform vec2 center;
        ${HeightParsVertex}
        flat out int vHorizonCulled;
        ${HorizonCulling}
        `,
        )
        .replace(
          "vec4 mvPosition = modelViewMatrix[ 3 ];",
          `
          // Offset anchor world position along globe normal by addHeight
          vec4 worldPosition = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);

          bool horizonCulled = nvr_horizon_culled(worldPosition.xyz, cameraPosition);
          if (horizonCulled) {
            vHorizonCulled = 1;
            // Optimization: make the mesh verticies collapse to a single point (degenerate triangle),
            //  so no fragments are generated (zero-area triangle), hence no fragment shader invocations.
            gl_Position = vec4(0.0);
            return;
          }
          vHorizonCulled = 0;

          vec3 globeNormal = normalize(worldPosition.xyz);
          worldPosition.xyz += globeNormal * uAddHeight;
          vec4 mvPosition = viewMatrix * worldPosition;
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
    this.frustumCulled = culled;
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
