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
import WaterParsFragment from "@shaders/glsl/chunks/water_pars_fragment.glsl?raw";
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
  RepeatWrapping,
  RGBADepthPacking,
  Texture,
  type NormalBufferAttributes,
  type WebGLProgramParametersWithUniforms,
} from "three";
import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  LoopRepeat,
} from "three";

import { TEXTURE_LOADER, WATER_NORMAL_URL, type ViewEvents } from "..";
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
  water = false;
  private waterNormalMapTexture: Texture | null = null;

  // Minimal animation support (clip + speed)
  private mixer: AnimationMixer | null = null;
  private actions = new Map<string, AnimationAction>();
  private currentAction: AnimationAction | null = null;
  private animationSpeed = 1.0;
  private lastUpdateTime?: number;

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

    // Load water normal map once for the entire ModelMesh if water is enabled
    if (meshMaterial.water) {
      this.waterNormalMapTexture = TEXTURE_LOADER.load(
        meshMaterial.water_normal_url ?? WATER_NORMAL_URL,
        (texture) => {
          texture.wrapS = texture.wrapT = RepeatWrapping;
        },
      );
    }

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

    // Initialize minimal animation features if GLTF animations exist on the scene
    const gltfAnimations: AnimationClip[] | undefined = (
      this.children[0] as Group
    )?.userData?.gltfAnimations;
    if (gltfAnimations && gltfAnimations.length > 0) {
      const target = this.children[0] as Group;
      this.mixer = new AnimationMixer(target);

      // Read initial speed from material if provided
      const initSpeed = meshMaterial.animation_speed as number | undefined;
      this.animationSpeed = initSpeed ?? 1.0;

      gltfAnimations.forEach((clip) => {
        if (!this.mixer) {
          console.warn("Animation mixer not initialized");
          return;
        }
        const action = this.mixer.clipAction(clip);
        action.timeScale = this.animationSpeed;
        action.setLoop(LoopRepeat, Infinity);
        this.actions.set(clip.name, action);
      });

      const clipName = meshMaterial.animation_active_clip as string | undefined;
      if (clipName && this.actions.has(clipName)) {
        const action = this.actions.get(clipName);
        if (!action) {
          console.warn(`Animation action "${clipName}" not found`);
          return;
        }
        action.reset().play();
        this.currentAction = action;
      }

      // Tick mixer on each frame
      viewEvents.on("preRender", (t: number) => {
        if (!this.mixer) return;
        if (this.lastUpdateTime == null) {
          this.lastUpdateTime = t;
          return;
        }
        const dt = (t - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = t;
        this.mixer.update(dt);
      });
    }
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
      mesh.material.userData.reflectivity = {
        value: meshMaterial.reflectivity ?? 0,
      };
      mesh.material.userData.waterScaleNormal = {
        value: meshMaterial.water_scale_normal ?? 0.01,
      };
      mesh.material.userData.waterSpeed = {
        value: meshMaterial.water_speed ?? 0.0003,
      };
      mesh.material.userData.shininess = {
        value: meshMaterial.shininess ?? 30.0,
      };
      mesh.material.userData.specularStrength = {
        value: meshMaterial.specular_strength ?? 1.0,
      };
      mesh.material.userData.applyWaterNormal = {
        value: (meshMaterial.apply_water_normal ?? false) ? 1.0 : 0.0,
      };
      mesh.material.userData.waterNormalMap = {
        value: this.waterNormalMapTexture,
      };

      this.water = !!meshMaterial.water;
      this.setMaterial(meshMaterial, mesh);

      this._initBatchedMaterial(mesh);

      // Set water define if water is enabled
      if (this.water) {
        mesh.material.userData.defines = mesh.material.userData.defines || {};
        mesh.material.userData.defines.WATER = 1;
      }

      mesh.material.customProgramCacheKey = () =>
        JSON.stringify(mesh.material.userData.defines);
      mesh.material.onBeforeCompile = (
        shader: WebGLProgramParametersWithUniforms,
      ) => {
        shader.defines ??= {};
        Object.assign(shader.defines, mesh.material.userData.defines);
        shader.uniforms.nvr_uHighlightColor = uniforms.highlightColor;
        shader.uniforms.nvr_uPickable = mesh.material.userData.uPickable;
        shader.uniforms.reflectivity = mesh.material.userData.reflectivity;
        shader.uniforms.uWaterNormalMap = mesh.material.userData.waterNormalMap;
        shader.uniforms.uWaterScaleNormal =
          mesh.material.userData.waterScaleNormal;
        shader.uniforms.uWaterSpeed = mesh.material.userData.waterSpeed;
        shader.uniforms.uShininess = mesh.material.userData.shininess;
        shader.uniforms.uSpecularStrength =
          mesh.material.userData.specularStrength;
        shader.uniforms.uApplyWaterNormal =
          mesh.material.userData.applyWaterNormal;
        shader.uniforms.uTime = uniforms.time;

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
                  out vec3 vPosition;
                  
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
    vPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
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
                  uniform sampler2D uWaterNormalMap;
                  uniform float uWaterScaleNormal;
                  uniform float uWaterSpeed;
                  uniform float uShininess;
                  uniform float uSpecularStrength;
                  uniform float uApplyWaterNormal;
                  uniform float uTime;
                  // uniform float reflectivity;
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
            "#include <lights_pars_begin>",
            `
        #include <lights_pars_begin>
        ${WaterParsFragment}
        `,
          )
          .replace(
            "#include <normal_fragment_maps>",
            `
        vec3 origNormal = normal;
        vec3 specular;

        #ifdef WATER
          specular = computeWaterSpecularSimple(
            uWaterNormalMap,
            vPosition.xy * uWaterScaleNormal,
            uTime * uWaterSpeed,
            vViewPosition,
            uShininess,
            uSpecularStrength,
            normal
          );
        #else
          #include <normal_fragment_maps>
        #endif
        `,
          )
          .replace(
            "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
            `
            vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
            outgoingLight += specular;
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
          )
          .replace(
            "outputBuffer1 = vec4(packNormalToVec2(normal), metalnessFactor, roughnessFactor)",
            `
            vec3 finalNormal = mix(origNormal, normal, uApplyWaterNormal);
            outputBuffer1 = vec4(packNormalToVec2(finalNormal), metalnessFactor, roughnessFactor)
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

    mesh.customDepthMaterial.customProgramCacheKey = () =>
      mesh.customDepthMaterial
        ? JSON.stringify(mesh.customDepthMaterial.userData.defines)
        : "";
    mesh.customDepthMaterial.onBeforeCompile = (shader, renderer) => {
      origin.onBeforeCompile(shader, renderer);

      shader.defines ??= {};
      Object.assign(shader.defines, origin.userData?.defines || {});
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

    // Minimal animation updates: speed and active clip
    if (this.mixer) {
      const nextSpeed = material.animation_speed as number | undefined;
      if (nextSpeed !== undefined && nextSpeed !== this.animationSpeed) {
        this.animationSpeed = nextSpeed;
        if (this.currentAction) {
          this.currentAction.timeScale = this.animationSpeed;
        }
      }

      const nextClip = material.animation_active_clip as string | undefined;
      if (nextClip && this.actions.has(nextClip)) {
        const nextAction = this.actions.get(nextClip);
        if (!nextAction) {
          console.warn(`Animation action "${nextClip}" not found`);
          return;
        }
        if (this.currentAction !== nextAction) {
          if (this.currentAction) this.currentAction.stop();
          nextAction.timeScale = this.animationSpeed;
          nextAction.reset().play();
          this.currentAction = nextAction;
        }
      }
    }
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
    if (distMaterial.userData.prev.water !== src.water) {
      const next = !!src.water;
      this.water = next;
      distMaterial.userData.prev.water = next;
      // Update water define
      distMaterial.userData.defines = distMaterial.userData.defines || {};
      if (next) {
        distMaterial.userData.defines.WATER = 1;
        // Load water texture once at ModelMesh level if not already loaded
        if (!this.waterNormalMapTexture) {
          this.waterNormalMapTexture = TEXTURE_LOADER.load(
            src.water_normal_url ?? WATER_NORMAL_URL,
            (texture) => {
              texture.wrapS = texture.wrapT = RepeatWrapping;
            },
          );
        }
        // Share the same texture instance across all meshes
        distMaterial.userData.waterNormalMap.value = this.waterNormalMapTexture;
      } else {
        delete distMaterial.userData.defines.WATER;
      }
      distMaterial.needsUpdate = true;
    }
    if (distMaterial.userData.prev.reflectivity !== src.reflectivity) {
      const next = src.reflectivity ?? 0;
      distMaterial.userData.reflectivity.value = next;
      distMaterial.userData.prev.reflectivity = next;
    }
    if (
      distMaterial.userData.prev.waterScaleNormal !== src.water_scale_normal
    ) {
      const next = src.water_scale_normal ?? 0.01;
      distMaterial.userData.waterScaleNormal.value = next;
      distMaterial.userData.prev.waterScaleNormal = next;
    }
    if (distMaterial.userData.prev.waterSpeed !== src.water_speed) {
      const next = src.water_speed ?? 0.0003;
      distMaterial.userData.waterSpeed.value = next;
      distMaterial.userData.prev.waterSpeed = next;
    }
    if (distMaterial.userData.prev.shininess !== src.shininess) {
      const next = src.shininess ?? 0;
      distMaterial.userData.shininess.value = next;
      distMaterial.userData.prev.shininess = next;
    }
    if (distMaterial.userData.prev.specularStrength !== src.specular_strength) {
      const next = src.specular_strength ?? 0;
      distMaterial.userData.specularStrength.value = next;
      distMaterial.userData.prev.specularStrength = next;
    }
    if (
      distMaterial.userData.prev.applyWaterNormal !== src.apply_water_normal
    ) {
      const next = src.apply_water_normal ?? 0;
      distMaterial.userData.applyWaterNormal.value = next;
      distMaterial.userData.prev.applyWaterNormal = next;
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
