import { EventHandler, Unimplemented } from "@navara/core";
import {
  ModelMaterial as NavaraModelMaterial,
  ModelMesh as NavaraModelMesh,
  Vec3,
} from "@navara/engine";
import BatchTextureParsVertex from "@shaders/glsl/chunks/batch_texture_pars_vertex.glsl";
import BatchTextureVertex from "@shaders/glsl/chunks/batch_texture_vertex.glsl";
import HeightParsVertex from "@shaders/glsl/chunks/height_pars_vertex.glsl";
import HeightVertex from "@shaders/glsl/chunks/height_vertex.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import ShadowMapDepthFragment from "@shaders/glsl/chunks/shadowmap_depth_fragment.glsl";
import ShadowMapDepthParsFragment from "@shaders/glsl/chunks/shadowmap_depth_pars_fragment.glsl";
import ShadowMapDepthParsVertex from "@shaders/glsl/chunks/shadowmap_depth_pars_vertex.glsl";
import ShadowMapDepthVertex from "@shaders/glsl/chunks/shadowmap_depth_vertex.glsl";
import ShowFragment from "@shaders/glsl/chunks/show_fragment.glsl";
import ShowParsFragment from "@shaders/glsl/chunks/show_pars_fragment.glsl";
import ShowParsVertex from "@shaders/glsl/chunks/show_pars_vertex.glsl";
import SpecularParsFragment from "@shaders/glsl/chunks/spucular_pars_fragment.glsl";
import WaterParsFragment from "@shaders/glsl/chunks/water_pars_fragment.glsl?raw";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  Group,
  Mesh,
  Points,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  RGBADepthPacking,
  Texture,
  type NormalBufferAttributes,
  type WebGLProgramParametersWithUniforms,
  ShaderChunk,
  PointsMaterial,
} from "three";
import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  LoopRepeat,
} from "three";

import type { ViewEvents } from "..";
import type { BufferLoader } from "../event";
import type { CustomObject3DEventMap } from "../object3DEvent";
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
import type { PickableMesh } from "./pickableMesh";

export type ModelMaterial = MeshStandardMaterial | MeshPhysicalMaterial;

export type ModelBatchedAttributeName = "color" | "show" | "height";

export const MODEL_BATCH_TEXTURE_CONFIG: BatchTextureConfig = {
  rows: ["COLOR_SHOW", "HEIGHT"],
  batchLength: 0,
};

export class ModelMesh
  extends Object3D<CustomObject3DEventMap>
  implements FeatureMesh, PickableMesh
{
  water = false;
  private waterNormalMapTexture: Texture | null = null;
  private _uniforms?: CommonUniforms;

  // Minimal animation support (clip + speed)
  private mixer: AnimationMixer | null = null;

  /**
   * Returns the shared water normal map texture if water is enabled.
   * The texture must be enabled via Options.waterTexture.enabled.
   */
  private enableWaterNormalMap(water: boolean): Texture | null {
    // Only use if water is enabled
    if (!water) {
      return null;
    }

    // Use shared water texture from CommonUniforms if available
    if (!this.waterNormalMapTexture && this._uniforms?.waterTexture.value) {
      this.waterNormalMapTexture = this._uniforms.waterTexture.value;
    }

    return this.waterNormalMapTexture;
  }
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
    this._uniforms = uniforms;
    this.add(rawScene);
    this.init(m, uniforms, buf, viewEvents);
    this.addEventListener("removedFromWorld", () => {
      this.dispose(viewEvents);
    });
  }

  private init(
    m: NavaraModelMesh,
    uniforms: CommonUniforms,
    buf: BufferLoader,
    viewEvents: EventHandler<ViewEvents>,
  ) {
    const batchIdsData = m.geometry.batch_ids;
    const dataSize = batchIdsData?.size ?? 0;
    const batchIds = batchIdsData
      ? buf.u32(batchIdsData.data)
      : new Uint32Array(dataSize);

    this.userData.batchIds = batchIds;
    this.userData.dataSize = dataSize;

    const meshMaterial = m.material;

    this.waterNormalMapTexture = this.enableWaterNormalMap(
      !!meshMaterial.water,
    );

    // For Cesium 3D Tiles
    if (batchIds) {
      this.overrideCesium3DTilesMaterial(
        meshMaterial,
        batchIds,
        dataSize,
        uniforms,
        viewEvents,
      );
    }

    if (meshMaterial.__internal__?.pointCloud) {
      // Point cloud specific initialization can go here
      this.overridePntsMaterial(meshMaterial);
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
      const initSpeed = meshMaterial.animationSpeed as number | undefined;
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

      const clipName = meshMaterial.animationActiveClip as string | undefined;
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
    batchIds: Uint32Array<ArrayBufferLike>,
    dataSize: number,
    uniforms: CommonUniforms,
    viewEvents: EventHandler<ViewEvents>,
  ) {
    this.traverseMesh((mesh) => {
      const vertCnt = mesh.geometry.attributes?.position?.count;

      const attrBatchIds = new Float32Array(vertCnt);
      const internalBatchIds = mesh.geometry.attributes?._batchid?.array;

      if (internalBatchIds) {
        let i = 0;
        for (const internalBatchId of internalBatchIds) {
          attrBatchIds[i] = batchIds[internalBatchId] ?? 0;
          i++;
        }
      } else {
        for (let i = 0; i < vertCnt; i++) {
          attrBatchIds[i] = batchIds[0];
        }
      }

      mesh.geometry.setAttribute(
        "batchId",
        new BufferAttribute(attrBatchIds, dataSize),
      );

      const mcolor = meshMaterial.color;

      mesh.castShadow = !!meshMaterial.castShadow;
      mesh.receiveShadow = !!meshMaterial.receiveShadow;

      mesh.material.depthTest = true;
      mesh.material.depthWrite = true;

      mesh.material.userData.color = mcolor;
      mesh.material.userData.uPickable = {
        value: 0.0,
      };
      mesh.material.userData.reflectivity = {
        value: meshMaterial.reflectivity ?? 0,
      };
      mesh.material.userData.uAddHeight = {
        value: 0.0,
      };
      mesh.material.userData.waterScaleNormal = {
        value: meshMaterial.waterScaleNormal ?? 0.01,
      };
      mesh.material.userData.waterSpeed = {
        value: meshMaterial.waterSpeed ?? 0.0003,
      };
      mesh.material.userData.shininess = {
        value: meshMaterial.shininess ?? 30.0,
      };
      mesh.material.userData.specularStrength = {
        value: meshMaterial.specularStrength ?? 1.0,
      };
      mesh.material.userData.applyWaterNormal = {
        value: (meshMaterial.applyWaterNormal ?? false) ? 1.0 : 0.0,
      };
      mesh.material.userData.waterNormalMap = {
        value: this.waterNormalMapTexture,
      };
      mesh.material.userData.specular = {
        value: meshMaterial.specular ?? false,
      };
      mesh.material.userData.ior = {
        value: meshMaterial.ior ?? 1.33333,
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
        mesh.material.onBeforeCompile.toString() +
        JSON.stringify(mesh.material.userData.defines);

      mesh.material.onBeforeCompile = (
        shader: WebGLProgramParametersWithUniforms,
      ) => {
        shader.defines ??= {};
        Object.assign(shader.defines, mesh.material.userData.defines);
        if (this.water && uniforms.tSkyEnvMap.value) {
          shader.defines.USE_SKY_ENVMAP = "1";
          shader.uniforms.tSkyEnvMap = uniforms.tSkyEnvMap;
        }
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
        shader.uniforms.uSpecular = mesh.material.userData.specular;
        shader.uniforms.uIor = mesh.material.userData.ior;
        shader.uniforms.uTime = uniforms.time;
        shader.uniforms.uAddHeight = mesh.material.userData.uAddHeight;

        if (mesh.material.userData.batchDataTexture) {
          shader.uniforms.batchDataTexture =
            mesh.material.userData.batchDataTexture;
        }

        // Update vertex shader
        shader.vertexShader = createReplacer(shader.vertexShader)
          .replace(
            "void main() {",
            `
                  in float batchId;
                  out float nvr_vBatchId;
                  out vec3 vPosition;
                  
                  ${ShowParsVertex}
                  ${HeightParsVertex}
                  ${BatchTextureParsVertex}

                  ${ShadowMapDepthParsVertex}
    
                  void main() {
                    nvr_vBatchId = batchId;
              `,
          )
          .replace(
            "#include <begin_vertex>",
            `
    #include <begin_vertex>
    ${HeightVertex}
    transformed.xyz += normal * addHeight;
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
                  uniform float nvr_uPickable;
                  uniform sampler2D uWaterNormalMap;
                  uniform samplerCube tSkyEnvMap;
                  uniform float uWaterScaleNormal;
                  uniform float uWaterSpeed;
                  uniform float uShininess;
                  uniform float uSpecularStrength;
                  uniform float uApplyWaterNormal;
                  uniform bool uSpecular;
                  uniform float uIor;
                  uniform float uTime;
                  // uniform float reflectivity;
                  in float nvr_vBatchId;

                  ${ShowParsFragment}

                  ${Pick}

                  ${ShadowMapDepthParsFragment}

                  void main() {
                    ${ShowFragment}
                    ${ShadowMapDepthFragment}
                  `,
          )
          .replace(
            "#include <lights_physical_pars_fragment>",
            `
        #include <lights_physical_pars_fragment>
        ${WaterParsFragment}
        ${SpecularParsFragment}
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
            diffuseColor.rgb,
            normal
          );
        #else
          if(uSpecular) {
            specular = computeSpecular(
              vViewPosition,
              origNormal,
              uShininess,
              uSpecularStrength,
              uIor
            );
          }
          #include <normal_fragment_maps>
        #endif
        `,
          )
          .replace(
            "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
            `
            vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
            #if defined(WATER) && defined(USE_SKY_ENVMAP)
              vec3 envColor = getSkyEnv(geometryNormal, tSkyEnvMap, vPosition);
              outgoingLight += envColor * reflectivity;
            #endif
            outgoingLight += specular;
          `,
          )
          .replace(
            "#include <dithering_fragment>",
            `
                  #include <dithering_fragment>
    
                  if (nvr_uPickable > 0.0 && diffuseColor.a > 0.0) {
                    vec3 pickColor = nvr_batchIdToColor(nvr_vBatchId);
                    gl_FragColor = vec4(pickColor.xyz, 1.0);
                  }
                  `,
          )
          .replace(
            "outputBuffer1 = vec4(packNormalToVec2(normal), metalnessFactor, roughnessFactor)",
            `
            vec3 finalNormal = mix(origNormal, normalize(origNormal * 0.7 + normal), uApplyWaterNormal);
            outputBuffer1 = vec4(packNormalToVec2(finalNormal), metalnessFactor, roughnessFactor)
            `,
          ).source;
      };

      this.initDepthMaterial(mesh);

      viewEvents.emit("_csmMounted", mesh.material);
    });
  }

  private traversePoints(
    f: (
      points: Points<BufferGeometry<NormalBufferAttributes>, PointsMaterial>,
    ) => void,
  ) {
    this.traverse((object: Object3D) => {
      if (object instanceof Points) {
        f(object);
      }
    });
  }

  private overridePntsMaterial(meshMaterial: NavaraModelMaterial) {
    this.traverse((object: Object3D) => {
      if (!(object instanceof Points)) {
        return;
      }

      const material = object.material;
      material.userData.uAddHeight = { value: meshMaterial.height ?? 0.0 };

      const geodetic_normal: Vec3 =
        meshMaterial.__internal__?.pointCloudGeodeticNormal ??
        new Vec3(0, 0, 0);

      material.onBeforeCompile = (
        shader: WebGLProgramParametersWithUniforms,
      ) => {
        shader.uniforms.uAddHeight = material.userData.uAddHeight;

        // Update vertex shader
        const colorDivisior = 65535.0;
        shader.vertexShader = createReplacer(shader.vertexShader)
          .replace(
            "#include <color_vertex>",
            createReplacer(ShaderChunk.color_vertex)
              .replace(
                "vColor = vec4( 1.0 );",
                `vColor = vec4( 1.0 / ${colorDivisior}.0 );`,
              )
              .replace(
                "vColor = vec3( 1.0 );",
                `vColor = vec3( 1.0 / ${colorDivisior}.0 );`,
              ).source,
          )
          .replace(
            "#include <common>",
            `#include <common>
          uniform float uAddHeight;`,
          )
          .replace(
            "#include <project_vertex>",
            createReplacer(ShaderChunk.project_vertex)
              .replace(
                "vec4 mvPosition = vec4( transformed, 1.0 );",
                `vec4 mvPosition = vec4( transformed, 1.0 );
               // point cloud geodetic normal in world space - precomputed
               vec3 normal = vec3(${geodetic_normal.x}, ${geodetic_normal.y}, ${geodetic_normal.z});
               vec4 mvNormal = viewMatrix * vec4(normal, 0.0);`,
              )
              .replace(
                "gl_Position = projectionMatrix * mvPosition;",
                `mvPosition += mvNormal * uAddHeight;
               gl_Position = projectionMatrix * mvPosition;`,
              ).source,
          ).source;
      };

      this.setMaterial(material, object);
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

    if (!material.__internal__?.pointCloud) {
      this.traverseMesh((m) => {
        this.setMaterial(material, m);
      });
    } else {
      this.traversePoints((pnts) => {
        this.setMaterial(material, pnts);
      });
    }

    // Minimal animation updates: speed and active clip
    if (this.mixer) {
      const nextSpeed = material.animationSpeed as number | undefined;
      if (nextSpeed !== undefined && nextSpeed !== this.animationSpeed) {
        this.animationSpeed = nextSpeed;
        if (this.currentAction) {
          this.currentAction.timeScale = this.animationSpeed;
        }
      }

      const nextClip = material.animationActiveClip as string | undefined;
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
    dist:
      | Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>
      | Points<BufferGeometry<NormalBufferAttributes>, PointsMaterial>,
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
    if (distMaterial instanceof PointsMaterial) {
      if (distMaterial.userData.prev.pointSize !== src.pointSize) {
        const next = src.pointSize ?? 0;
        distMaterial.userData.prev.pointSize = distMaterial.size;
        distMaterial.size = next;
      }
      if (distMaterial.userData.prev.uAddHeight !== src.height) {
        const next = src.height ?? 0;
        distMaterial.userData.prev.uAddHeight =
          distMaterial.userData.uAddHeight.value;
        distMaterial.userData.uAddHeight.value = next;
      }
    }
    if (
      distMaterial instanceof MeshStandardMaterial ||
      distMaterial instanceof MeshPhysicalMaterial
    ) {
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

          distMaterial.userData.waterNormalMap.value =
            this.enableWaterNormalMap(next);
        } else {
          delete distMaterial.userData.defines.WATER;
          distMaterial.userData.waterNormalMap.value = null;
        }
        distMaterial.needsUpdate = true;
      }
      if (distMaterial.userData.prev.reflectivity !== src.reflectivity) {
        const next = src.reflectivity ?? 0;
        distMaterial.userData.reflectivity.value = next;
        distMaterial.userData.prev.reflectivity = next;
      }
      if (
        distMaterial.userData.prev.waterScaleNormal !== src.waterScaleNormal
      ) {
        const next = src.waterScaleNormal ?? 0.01;
        distMaterial.userData.waterScaleNormal.value = next;
        distMaterial.userData.prev.waterScaleNormal = next;
      }
      if (distMaterial.userData.prev.waterSpeed !== src.waterSpeed) {
        const next = src.waterSpeed ?? 0.0003;
        distMaterial.userData.waterSpeed.value = next;
        distMaterial.userData.prev.waterSpeed = next;
      }
      if (distMaterial.userData.prev.shininess !== src.shininess) {
        const next = src.shininess ?? 0;
        distMaterial.userData.shininess.value = next;
        distMaterial.userData.prev.shininess = next;
      }
      if (
        distMaterial.userData.prev.specularStrength !== src.specularStrength
      ) {
        const next = src.specularStrength ?? 0;
        distMaterial.userData.specularStrength.value = next;
        distMaterial.userData.prev.specularStrength = next;
      }
      if (
        distMaterial.userData.prev.applyWaterNormal !== src.applyWaterNormal
      ) {
        const next = src.applyWaterNormal ?? 0;
        distMaterial.userData.applyWaterNormal.value = next;
        distMaterial.userData.prev.applyWaterNormal = next;
      }
      if (distMaterial.userData.prev.specular !== src.specular) {
        const next = src.specular ?? false;
        distMaterial.userData.specular.value = next;
        distMaterial.userData.prev.specular = next;
      }
      if (dist.castShadow !== src.castShadow) {
        dist.castShadow = !!src.castShadow;
      }
      if (dist.receiveShadow !== src.receiveShadow) {
        dist.receiveShadow = !!src.receiveShadow;
      }
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

  _setPickable(pickable: boolean): void {
    this.traverseMesh((mesh) => {
      if ("userData" in mesh.material && mesh.material.userData.uPickable) {
        mesh.material.userData.uPickable.value = pickable ? 1.0 : 0.0;
      }
    });
  }

  _setFeatureHeight(height: number, m?: ModelMaterial): void {
    if (m) {
      m.userData.uAddHeight.value = height;
    }
  }

  dispose(viewEvents: EventHandler<ViewEvents>) {
    this.traverseMesh((m) => {
      viewEvents.emit("_csmMounted", m.material);
    });
  }
}
