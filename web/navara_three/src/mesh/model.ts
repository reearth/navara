import { Unimplemented } from "@navara/core";
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
  PointsMaterial,
} from "three";
import invariant from "tiny-invariant";

import type { EventContext } from "../event/context";
import {
  createModelMaterialEnhancer,
  createPntsEnhancer,
} from "../material/enhancer/model";
import type { ModelMaterialProps, PntsProps } from "../material/enhancer/model";
import type { UniformValue } from "../material/types";
import type { CustomObject3DEventMap } from "../object3DEvent";

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
type PntsMaterialEnhancer = ReturnType<typeof createPntsEnhancer>;

export class ModelMesh
  extends Object3D<CustomObject3DEventMap>
  implements FeatureMesh, PickableMesh
{
  readonly ctx: EventContext;
  /** Enhanced materials with encapsulated state, one per child mesh */
  private _enhancers = new Map<
    Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>,
    ModelMaterialEnhancer
  >();

  /** Enhanced materials for point cloud objects, one per Points child */
  private _pntsEnhancers = new Map<
    Points<BufferGeometry<NormalBufferAttributes>, PointsMaterial>,
    PntsMaterialEnhancer
  >();

  // model credit for attribution
  credit: string | undefined;
  batchLength?: number;

  constructor(
    ctx: EventContext,
    gltfInfo: {
      scene: Group;
      credit?: string;
    },
    m: NavaraModelMesh,
  ) {
    super();
    this.ctx = ctx;
    this.credit = gltfInfo.credit;
    this.batchLength = m.batch_length;
    this.add(gltfInfo.scene);
    this.init(m);
    this.addEventListener("removedFromWorld", () => {
      this.dispose();
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

  private init(m: NavaraModelMesh) {
    const { buf } = this.ctx;
    const batchIdsData = m.geometry.batch_ids;
    const dataSize = batchIdsData?.size ?? 0;
    const batchIds = batchIdsData
      ? buf.u32(batchIdsData.data)
      : new Uint32Array(dataSize);

    const meshMaterial = m.material;

    // For Cesium 3D Tiles
    if (batchIds) {
      this.overrideCesium3DTilesMaterial(meshMaterial, batchIds, dataSize);
    }

    if (meshMaterial.__internal__?.pointCloud) {
      // Point cloud specific initialization can go here
      this.overridePntsMaterial(meshMaterial);
    }

    this.visible = meshMaterial.show ?? true;
  }

  _initBatchedMaterial(
    mesh: Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>,
  ) {
    initBatchedMaterial(mesh.material, MODEL_BATCH_TEXTURE_CONFIG);
  }

  _initBatchDataTexture(
    mesh: Mesh<BufferGeometry<NormalBufferAttributes>, ModelMaterial>,
  ): void {
    invariant(this.batchLength != null);

    const config: BatchTextureConfig = {
      ...MODEL_BATCH_TEXTURE_CONFIG,
      batchLength: this.batchLength,
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
  ) {
    const uniforms = this.ctx.uniforms;

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
      // B3DM (1.0) uses _batchid; glTF with EXT_mesh_features (1.1) uses _FEATURE_ID_N.
      // Assign _FEATURE_ID_0 to _batchid so the batch texture shader works unchanged.
      // Also accept lowercase _feature_id_0 as a compatibility fallback.
      const attrs = mesh.geometry.attributes;
      const featureIdAttribute =
        attrs?.["_FEATURE_ID_0"] ?? attrs?.["_feature_id_0"];
      if (!attrs?._batchid && featureIdAttribute) {
        // TODO: Support other feature ID semantics such as `_FEATURE_ID_n`.
        // Need to clone, since it might be switch to different feature ID attributes.
        mesh.geometry.setAttribute("_batchid", featureIdAttribute.clone());
      }
      const internalBatchIds = attrs?._batchid?.array;

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

      this.ctx.viewContext.applyShadowMaterial(mesh.material);
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
    const geodeticNormal: Vec3 =
      meshMaterial.__internal__?.pointCloudGeodeticNormal ?? new Vec3(0, 0, 0);

    const initialProps: PntsProps = {
      color: meshMaterial.color ?? 0,
      pointSize: meshMaterial.pointSize ?? 1,
      height: meshMaterial.height ?? 0,
      geodeticNormal,
    };

    this.traversePoints((points) => {
      const enhancer = createPntsEnhancer(points.material);
      this._pntsEnhancers.set(points, enhancer);

      enhancer.mount(initialProps);

      points.material.customProgramCacheKey = () => enhancer.programCacheKey();
      points.material.onBeforeCompile = enhancer.transformShader;
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
    this.visible = (material.show ?? true) && active;

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
      const pntsProps: PntsProps = {
        color: material.color,
        pointSize: material.pointSize,
        height: material.height,
      };
      for (const enhancer of this._pntsEnhancers.values()) {
        enhancer.update(pntsProps);
      }
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
        effectIdsMask:
          this.ctx.viewContext.selectiveEffectRegistry?.computeMask(
            material.effectIds ?? [],
          ) ?? 0,
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

  _getRenderable(): Object3D {
    return this;
  }

  _setFeatureHeight(_height: number) {
    // Height adjustment via batch textures is currently not implemented.
    // This method is intentionally a no-op to avoid breaking existing callers.
  }

  dispose() {
    this.traverseMesh((m) => {
      this.ctx.viewContext.removeShadowMaterial(m.material);
    });
  }
}
