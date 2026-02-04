import { EventHandler, Unimplemented } from "@navara/core";
import {
  ModelMaterial as NavaraModelMaterial,
  ModelMesh as NavaraModelMesh,
  Vec3,
} from "@navara/engine";
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
import type { ViewContext } from "../core";
import {
  getSelectiveEffectConfig,
  SelectiveEffectOcclusionMode,
} from "../core/SelectiveEffectHelper";
import {
  getMaskPassContext,
  MaskPassPhase,
  evaluateMaskPassParticipation,
  applyMaskPassSkipState as applyMaskPassSkipStateBase,
  applyMaskPassRenderState,
  restoreMaterialState as restoreMaterialStateBase,
} from "../core/SelectiveEffectMaskContext";
import type { BufferLoader } from "../event";
import type { ModelMaterialProps } from "../material/enhancer/model";
import { createModelMaterialEnhancer } from "../material/enhancer/model";
import type { UniformValue } from "../material/types";
import type { CustomObject3DEventMap } from "../object3DEvent";
import type { CommonUniforms } from "../uniforms";
import { arraysEqual, createReplacer } from "../utils";

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

// TODO: Height to adjust the height based on its property.
export type ModelBatchedAttributeName = "color" | "show";

export const MODEL_BATCH_TEXTURE_CONFIG: BatchTextureConfig = {
  rows: ["COLOR_SHOW"],
  batchLength: 0,
};

type ModelMaterialEnhancer = ReturnType<typeof createModelMaterialEnhancer>;

export class ModelMesh
  extends Object3D<CustomObject3DEventMap>
  implements FeatureMesh, PickableMesh
{
  private viewContext: ViewContext;
  /** Layer ID for SelectiveEffect handling */
  private _layerId: string;
  private _uniforms: CommonUniforms;

  /** Enhanced materials with encapsulated state, one per child mesh */
  private _enhancers = new Map<
    Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>,
    ModelMaterialEnhancer
  >();

  // Minimal animation support (clip + speed)
  private mixer: AnimationMixer | null = null;

  // model credit for attribution
  credit: string | undefined;

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
    viewContext: ViewContext,
    layerId: string,
    credit?: string,
  ) {
    super();
    this.viewContext = viewContext;
    this._layerId = layerId;
    this._uniforms = uniforms;
    this.credit = credit;
    this.add(rawScene);
    this.init(m, buf, viewEvents);
    this.addEventListener("removedFromWorld", () => {
      this.dispose(viewEvents);
    });
  }

  get water(): boolean {
    for (const enhancer of this._enhancers.values()) {
      // Assume the first enhancer has the common value.
      return enhancer.states().water.useWater;
    }
    return false;
  }

  set water(v: boolean) {
    for (const enhancer of this._enhancers.values()) {
      enhancer.update({ water: { water: v } });
    }
  }

  private init(
    m: NavaraModelMesh,
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

    // For Cesium 3D Tiles
    if (batchIds) {
      this.overrideCesium3DTilesMaterial(
        meshMaterial,
        batchIds,
        dataSize,
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

    // Update the enhancer with the new batchDataTexture
    const texture = this._getBatchDataTexture(mesh);
    const enhancer = this._enhancers.get(mesh);
    if (texture && enhancer) {
      enhancer.update({
        base: { useBatchTexture: true, batchDataTexture: { value: texture } },
      });
    }
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
    const enhancer = this._enhancers.get(mesh);
    if (enhancer) {
      switch (attribute) {
        case "color": {
          // When batch color is first used, enable batchColorEnabled and set material.color to white
          if (!enhancer.states().base.batchColorEnabled) {
            enhancer.update({
              base: { batchColorEnabled: true, color: 0xffffff },
            });
          }
          enhancer.update({ base: { useBatchColorShow: true } });
          break;
        }
        case "show": {
          enhancer.update({ base: { useBatchColorShow: true } });
          break;
        }
      }
    }

    updateBatchAttribute(mesh.material, batchId, attribute, value, {
      color: mesh.material.color,
    });
  }

  private overrideCesium3DTilesMaterial(
    meshMaterial: NavaraModelMaterial,
    batchIds: Uint32Array<ArrayBufferLike>,
    dataSize: number,
    viewEvents: EventHandler<ViewEvents>,
  ) {
    const uniforms = this._uniforms;

    // Build initial props using buildUpdateProps plus initial-only external refs
    const updateProps = this.buildUpdateProps(meshMaterial);
    const initialProps: ModelMaterialProps = {
      ...updateProps,
      water: {
        ...updateProps.water,
        skyEnvMap: uniforms.tSkyEnvMap.value,
        // Pass waterNormalMap directly from uniforms if water is enabled
        waterNormalMap: uniforms.waterTexture as UniformValue<Texture | null>,
        timeUniform: uniforms.time as UniformValue<number>,
        skyEnvMapUniform: uniforms.tSkyEnvMap as UniformValue<Texture | null>,
      },
    };

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

      mesh.castShadow = !!meshMaterial.castShadow;
      mesh.receiveShadow = !!meshMaterial.receiveShadow;

      mesh.material.depthTest = true;
      mesh.material.depthWrite = true;

      // Create enhanced material with encapsulated state
      const enhancer = createModelMaterialEnhancer(mesh.material);
      this._enhancers.set(mesh, enhancer);

      // Mount the enhancer
      enhancer.mount(initialProps);

      // Set up custom program cache key based on config flags that affect shader defines
      mesh.material.customProgramCacheKey = () => enhancer.programCacheKey();

      // Set up onBeforeCompile using the enhancer's transformShader
      mesh.material.onBeforeCompile = enhancer.transformShader;

      this._initBatchedMaterial(mesh);

      this.initDepthMaterial(mesh, enhancer);

      // Setup onBeforeRender for SelectiveEffect state handling
      this.setupMeshOnBeforeRender(mesh, enhancer);

      viewEvents.emit("_csmMounted", mesh.material);
    });
  }

  /**
   * Setup onBeforeRender callback for a mesh to handle SelectiveEffect rendering
   *
   * Mesh determines its own depth/mask flags via onBeforeRender.
   * Uses MaskPassContext for self-determination during BaseMRT phase.
   *
   * SoT Flow:
   * - MaskPassContext provides runtime state (phase, activeEffects)
   * - SelectiveEffectManager provides layer configuration (occlusion), accessed via registry
   * - Mesh reads SoT, never modifies it
   */
  private setupMeshOnBeforeRender(
    mesh: Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>,
    enhancer: ModelMaterialEnhancer,
  ): void {
    mesh.onBeforeRender = () => {
      // Get MaskPassContext for current rendering state
      const ctx = getMaskPassContext();

      // Only process during BaseMRT phase (mask pass rendering)
      if (ctx.phase !== MaskPassPhase.BaseMRT) {
        // Not in mask pass - restore normal material state
        restoreMaterialStateBase(mesh.material);
        return;
      }

      // Get SelectiveEffectConfig from mesh (link() sets config on child meshes, not parent)
      const config = getSelectiveEffectConfig(mesh);
      const registry =
        ctx.registry ?? this.viewContext?.selectiveEffectRegistry;
      const layerId = this._layerId;

      // Context-based self-determination during BaseMRT
      this.applyMaskPassState(mesh, enhancer, config, registry, layerId, ctx);
    };
  }

  /**
   * Apply mask pass state based on MaskPassContext.
   * Called during BaseMRT phase for context-based self-determination.
   *
   * Uses shared helper for evaluation and render state, then applies
   * model-specific shader uniforms via enhancer mutates.
   */
  private applyMaskPassState(
    mesh: Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>,
    enhancer: ModelMaterialEnhancer,
    config: ReturnType<typeof getSelectiveEffectConfig>,
    registry: ReturnType<typeof getMaskPassContext>["registry"],
    layerId: string | undefined,
    ctx: ReturnType<typeof getMaskPassContext>,
  ): void {
    const material = mesh.material;

    // Use shared helper for evaluation
    const evaluation = evaluateMaskPassParticipation(
      config,
      registry,
      layerId,
      ctx,
    );

    if (!evaluation.shouldRender) {
      // Set shader uniforms to skip values via enhancer
      enhancer.update({
        base: {
          bloom: false,
          outline: false,
          occlusion: SelectiveEffectOcclusionMode.Skip,
        },
      });

      // Apply render state using shared helper
      applyMaskPassSkipStateBase(material);
      return;
    }

    // Set shader uniforms via enhancer
    enhancer.update({
      base: {
        bloom: evaluation.bloomActive,
        outline: evaluation.outlineActive,
        occlusion: evaluation.occlusion,
      },
    });

    // Apply render state using shared helper
    applyMaskPassRenderState(material, evaluation.isSilhouette);
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

      this.setPointsMaterial(meshMaterial, object);
    });
  }

  /**
   * Override a material that is used to generate a shadow map.
   */
  initDepthMaterial(
    mesh: Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>,
    enhancer: ModelMaterialEnhancer,
  ) {
    mesh.customDepthMaterial = mesh.material.clone();
    mesh.customDepthMaterial.needsUpdate = true;

    mesh.customDepthMaterial.onBeforeCompile = (shader) => {
      enhancer.transformShader(shader);

      shader.defines ??= {};
      Object.assign(shader.defines, mesh.material.userData?.defines || {});
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
      // Update all enhancers with new props
      const updateProps = this.buildUpdateProps(material);
      for (const [mesh, enhancer] of this._enhancers) {
        enhancer.update(updateProps);

        // Update mesh properties not managed by enhancer
        mesh.castShadow = !!material.castShadow;
        mesh.receiveShadow = !!material.receiveShadow;
      }
    } else {
      this.traversePoints((pnts) => {
        this.setPointsMaterial(material, pnts);
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

    // SelectiveEffect: effectIds handling at ModelMesh level
    if (!arraysEqual(this.userData.prev.effectIds, material.effectIds)) {
      this.viewContext.selectiveEffectRegistry?.updateLinksForObject(
        this,
        material.effectIds ?? [],
        this.userData.prev.effectIds ?? [],
        this._layerId,
      );
      this.userData.prev.effectIds = material.effectIds
        ? [...material.effectIds]
        : [];
    }
  }

  /**
   * Build update props from NavaraModelMaterial for enhancer.update().
   */
  private buildUpdateProps(material: NavaraModelMaterial): ModelMaterialProps {
    return {
      base: {
        color: material.color,
        metalness: material.metalness,
        roughness: material.roughness,
        emissiveColor: material.emissiveColor,
        emissiveIntensity: material.emissiveIntensity,
      },
      water: {
        water: material.water,
        waterScaleNormal: material.waterScaleNormal,
        waterSpeed: material.waterSpeed,
        shininess: material.shininess,
        specularStrength: material.specularStrength,
        applyWaterNormal: material.applyWaterNormal,
        specular: material.specular,
        ior: material.ior,
        reflectivity: material.reflectivity,
      },
    };
  }

  /**
   * Update PointsMaterial properties from NavaraModelMaterial.
   * Points use a separate code path since they don't use the material enhancer.
   */
  private setPointsMaterial(
    src: NavaraModelMaterial,
    dist: Points<BufferGeometry<NormalBufferAttributes>, PointsMaterial>,
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
    for (const enhancer of this._enhancers.values()) {
      enhancer.update({ base: { pickable } });
    }
  }

  _setFeatureHeight(_height: number) {
    // Height adjustment via batch textures is currently not implemented.
    // This method is intentionally a no-op to avoid breaking existing callers.
  }

  dispose(viewEvents: EventHandler<ViewEvents>) {
    this.traverseMesh((m) => {
      viewEvents.emit("_csmUnmounted", m.material);
    });
  }
}
