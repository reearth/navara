import { EventHandler, Unimplemented } from "@navara/core";
import {
  ModelMaterial as NavaraModelMaterial,
  ModelMesh as NavaraModelMesh,
} from "@navara/engine";
import BatchTextureParsVertex from "@shaders/glsl/chunks/batch_texture_pars_vertex.glsl";
import BatchTextureVertex from "@shaders/glsl/chunks/batch_texture_vertex.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import ShadowMapDepthFragment from "@shaders/glsl/chunks/shadowmap_depth_fragment.glsl";
import ShadowMapDepthParsFragment from "@shaders/glsl/chunks/shadowmap_depth_pars_fragment.glsl";
import ShadowMapDepthParsVertex from "@shaders/glsl/chunks/shadowmap_depth_pars_vertex.glsl";
import ShadowMapDepthVertex from "@shaders/glsl/chunks/shadowmap_depth_vertex.glsl";
import ShowFragment from "@shaders/glsl/chunks/show_fragment.glsl";
import ShowParsFragment from "@shaders/glsl/chunks/show_pars_fragment.glsl";
import ShowParsVertex from "@shaders/glsl/chunks/show_pars_vertex.glsl";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  RGBADepthPacking,
  type NormalBufferAttributes,
  type WebGLProgramParametersWithUniforms,
} from "three";

import type { ViewEvents } from "..";
import type { BufferLoader } from "../event";
import type { CommonUniforms } from "../uniforms";
import { createReplacer } from "../utils";

import {
  getBatchDataTexture,
  initBatchDataTexture,
  initBatchedMaterial,
  updateBatchAttribute,
  type BatchTextureConfig,
} from "./batchTexture";
import type { FeatureMesh } from "./featureMesh";

export type ModelMaterial = MeshStandardMaterial | MeshPhysicalMaterial;

export type ModelBatchedAttributeName = "color" | "show" | "height";

export const MODEL_BATCH_TEXTURE_CONFIG: BatchTextureConfig = {
  rows: ["COLOR_SHOW", "HEIGHT"],
  batchLength: 0,
};

export class ModelMesh extends Object3D implements FeatureMesh {
  constructor(
    rawScene: Group,
    m: NavaraModelMesh,
    uniforms: CommonUniforms,
    buf: BufferLoader,
    viewEvents: EventHandler<ViewEvents>,
  ) {
    super();
    this.add(rawScene);
    this.init(m, uniforms, buf, viewEvents);
  }

  private init(
    m: NavaraModelMesh,
    uniforms: CommonUniforms,
    buf: BufferLoader,
    viewEvents: EventHandler<ViewEvents>,
  ) {
    const batchIdAndSelectedStatus = m.geometry.batch_id_and_selected_status;
    const dataSize = batchIdAndSelectedStatus?.size ?? 0;
    const batchIdAndSel = batchIdAndSelectedStatus
      ? buf.u32(batchIdAndSelectedStatus.data)
      : new Uint32Array(dataSize);

    this.userData.batchIdAndSel = batchIdAndSel;
    this.userData.dataSize = dataSize;

    const meshMaterial = m.material;

    // For Cesium 3D Tiles
    if (batchIdAndSel) {
      this.overrideCesium3DTilesMaterial(
        meshMaterial,
        batchIdAndSel,
        dataSize,
        uniforms,
        viewEvents,
      );
    }

    this.userData.prev = {};
    this.visible = meshMaterial.show ?? true;
    this.userData.prev.visible = this.visible;
  }

  _initBatchedMaterial(
    mesh: Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>,
  ) {
    initBatchedMaterial(mesh.material, MODEL_BATCH_TEXTURE_CONFIG);
  }

  _initBatchDataTexture(
    mesh: Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>,
    batchLength: number,
  ): void {
    const config: BatchTextureConfig = {
      ...MODEL_BATCH_TEXTURE_CONFIG,
      batchLength,
    };

    initBatchDataTexture(mesh.material, config);
  }

  _getBatchDataTexture(
    mesh: Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>,
  ): DataTexture | undefined {
    return getBatchDataTexture(mesh.material);
  }

  _updateBatchAttribute(
    mesh: Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>,
    batchId: number,
    attribute: ModelBatchedAttributeName,
    value: number | number[] | boolean,
  ): void {
    updateBatchAttribute(mesh.material, batchId, attribute, value, {
      color: mesh.material.color,
    });
  }

  private overrideCesium3DTilesMaterial(
    meshMaterial: NavaraModelMaterial,
    batchIdAndSel: Uint32Array<ArrayBufferLike>,
    dataSize: number,
    uniforms: CommonUniforms,
    viewEvents: EventHandler<ViewEvents>,
  ) {
    this.traverseMesh((mesh) => {
      const vertCnt = mesh.geometry.attributes?.position?.count;

      const attrBatchIdAndSel = new Float32Array(vertCnt * 2);
      const internalBatchIds = mesh.geometry.attributes?._batchid?.array;

      if (internalBatchIds) {
        let i = 0;
        for (const internalBatchId of internalBatchIds) {
          attrBatchIdAndSel[i * 2] = batchIdAndSel[internalBatchId * 2] ?? 0;
          attrBatchIdAndSel[i * 2 + 1] =
            batchIdAndSel[internalBatchId * 2 + 1] ?? 0;
          i++;
        }
      } else {
        for (let i = 0; i < vertCnt; i++) {
          attrBatchIdAndSel[i * 2] = batchIdAndSel[0];
          attrBatchIdAndSel[i * 2 + 1] = batchIdAndSel[1];
        }
      }

      mesh.geometry.setAttribute(
        "batchIdAndSel",
        new BufferAttribute(attrBatchIdAndSel, dataSize),
      );

      const mcolor = meshMaterial.color;

      mesh.castShadow = !!meshMaterial.cast_shadow;
      mesh.receiveShadow = !!meshMaterial.receive_shadow;

      mesh.material.userData.color = mcolor;
      mesh.material.userData.uPickable = {
        value: 0.0,
      };

      this.setMaterial(meshMaterial, mesh);

      this._initBatchedMaterial(mesh);

      mesh.material.onBeforeCompile = (
        shader: WebGLProgramParametersWithUniforms,
      ) => {
        shader.uniforms.nvr_uHighlightColor = uniforms.highlightColor;
        shader.uniforms.nvr_uPickable = mesh.material.userData.uPickable;

        if (mesh.material.userData.batchDataTexture) {
          shader.uniforms.batchDataTexture =
            mesh.material.userData.batchDataTexture;
        }

        // Update vertex shader
        shader.vertexShader = createReplacer(shader.vertexShader)
          .replace(
            "void main() {",
            `
                  in vec2 batchIdAndSel;
                  out vec2 nvr_vBatchIdAndSel;
                  
                  ${ShowParsVertex}
                  ${BatchTextureParsVertex}

                  ${ShadowMapDepthParsVertex}
    
                  void main() {
                    nvr_vBatchIdAndSel = batchIdAndSel;
              `,
          )
          .replace(
            "#include <color_vertex>",
            `
                  #include <color_vertex>

                  ${BatchTextureVertex}
            `,
          )
          .replace(
            "#include <clipping_planes_vertex>",
            `
    #include <clipping_planes_vertex>
    ${ShadowMapDepthVertex}
    `,
          ).source;

        // Update fragment shader
        shader.fragmentShader = createReplacer(shader.fragmentShader)
          .replace(
            "void main() {",
            `
                  uniform vec3 nvr_uHighlightColor;
                  uniform float nvr_uPickable;
                  in vec2 nvr_vBatchIdAndSel;
                  
                  ${ShowParsFragment}
                  
                  ${Pick}

                  ${ShadowMapDepthParsFragment}

                  void main() {
                    ${ShowFragment}
                    ${ShadowMapDepthFragment}
                  `,
          )
          .replace(
            "#include <color_fragment>",
            `
                  #include <color_fragment>
                  if(nvr_vBatchIdAndSel.y > 0.0) {
                    diffuseColor = vec4(nvr_uHighlightColor.xyz, 1.0);
                  }
                  `,
          )
          .replace(
            "#include <dithering_fragment>",
            `
                  #include <dithering_fragment>
    
                  if (nvr_uPickable > 0.0 && diffuseColor.a > 0.0) {
                    vec3 pickColor = nvr_batchIdToColor(nvr_vBatchIdAndSel.x);
                    gl_FragColor = vec4(pickColor.xyz, 1.0);
                  }
                  `,
          ).source;
      };

      this.initDepthMaterial(mesh);

      viewEvents.emit("_csmMounted", mesh.material);
    });
  }

  /**
   * Override a material that is used to generate a shadow map.
   */
  initDepthMaterial(
    mesh: Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>,
  ) {
    mesh.customDepthMaterial = mesh.material.clone();
    mesh.customDepthMaterial.needsUpdate = true;

    mesh.customDepthMaterial.userData = mesh.material.userData;

    const origin = mesh.material;

    mesh.customDepthMaterial.onBeforeCompile = (shader, renderer) => {
      origin.onBeforeCompile(shader, renderer);

      shader.defines = { ...origin.defines };
      shader.defines["USE_SHADOWMAP_DEPTH"] = 1;
      shader.defines["DEPTH_PACKING"] = RGBADepthPacking;
    };
  }

  _update(material: NavaraModelMaterial, active: boolean) {
    const next = (material.show ?? true) && active;
    if (this.userData.prev.visible !== next) {
      this.visible = next;
      this.userData.prev.visible = next;
    }

    this.traverseMesh((m) => {
      this.setMaterial(material, m);
    });
  }

  private setMaterial(
    src: NavaraModelMaterial,
    dist: Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>,
  ) {
    const distMaterial = dist.material;

    if (!distMaterial.userData.prev) {
      distMaterial.userData.prev = {};
    }
    if (distMaterial.userData.prev.color !== src.color) {
      const next = src.color ?? 0;
      distMaterial.color.set(next);
      distMaterial.userData.prev.color = next;
    }
    if (distMaterial.userData.prev.metalness !== src.metalness) {
      const next = src.metalness ?? 0;
      distMaterial.metalness = next;
      distMaterial.userData.prev.metalness = next;
    }
    if (distMaterial.userData.prev.roughness !== src.roughness) {
      const next = src.roughness ?? 0;
      distMaterial.roughness = next;
      distMaterial.userData.prev.roughness = next;
    }
    if (dist.castShadow !== src.cast_shadow) {
      dist.castShadow = !!src.cast_shadow;
    }
    if (dist.receiveShadow !== src.receive_shadow) {
      dist.receiveShadow = !!src.receive_shadow;
    }
  }

  traverseMesh(
    callback: (
      m: Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>,
    ) => void,
  ) {
    this.traverse((object: Object3D) => {
      if (!(object instanceof Mesh)) {
        return;
      }
      callback(object);
    });
  }

  _setFeatureColor(color: Color, m?: ModelMaterial) {
    m?.color.set(color);
  }

  _getFeatureColor(): Color {
    throw new Unimplemented();
  }

  _setFeatureShow(visible: boolean): void {
    this.visible = visible;
  }

  _setFeatureExtrudedHeight(_height: number): void {
    throw new Unimplemented();
  }

  _setFrustumCulled(culled: boolean): void {
    this.frustumCulled = culled;
  }
}
