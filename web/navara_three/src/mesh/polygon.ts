import type { TileHandle } from "@navara/core";
import {
  PolygonMesh as NavaraPolygonMesh,
  PolygonMaterial,
} from "@navara/engine";
import type { Texture } from "three";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  MeshBasicMaterial,
  MeshLambertMaterial,
  RGBADepthPacking,
  Sphere,
  SphereGeometry,
  Mesh as ThreeMesh,
  Vector3,
} from "three";

import { PolygonOutlineMesh } from "..";
import type { ViewContext } from "../core";
import type { BufferLoader } from "../event";
import type { PolygonMaterialProps } from "../material/enhancer/polygon";
import { createPolygonMaterialEnhancer } from "../material/enhancer/polygon/polygonMaterialEnhancer";
import type { CommonUniforms } from "../uniforms";

import {
  BatchedFeatureMesh,
  type BatchedFeatureAttributes,
} from "./batchedFeature";
import type {
  BatchedAttributeName,
  DefaultBatchAttributeValues,
} from "./batchTexture";
import { setupRTECallback } from "./rtcRteHelper";

/** Set to true to render bounding spheres as wireframe spheres for debugging. */
const DEBUG_BOUNDING_SPHERE = false;

type Attributes = BatchedFeatureAttributes<{
  position?: BufferAttribute; // Present when use_rte = false
  position_3d_high?: BufferAttribute; // Present when use_rte = true
  position_3d_low?: BufferAttribute; // Present when use_rte = true
  normal: BufferAttribute;
  scaleNormalAndCap: BufferAttribute;
  attrBatchId: BufferAttribute;
}>;

export class PolygonMesh extends BatchedFeatureMesh<
  BufferGeometry<Attributes>,
  MeshLambertMaterial
> {
  outline?: PolygonOutlineMesh;

  private _baseBoundingSphere?: {
    surfaceCenter: Vector3; // Center point on ellipsoid surface (without height)
    aabbRadius: number; // Horizontal extent radius from AABB
  };

  /** Debug wireframe mesh visualizing the bounding sphere */
  private _debugBoundingSphereMesh?: ThreeMesh;

  /** Running min/max of per-feature batch height values */
  private _minBatchHeight = 0;
  private _maxBatchHeight = 0;
  /** Running max of per-feature batch extruded height values */
  private _maxBatchExtrudedHeight = 0;

  /** ViewContext for SelectiveEffect handling */
  private _viewContext: ViewContext;
  /** Layer ID for SelectiveEffect handling */
  private _layerId: string;
  private _uniforms: CommonUniforms;

  /** Enhanced material with encapsulated state */
  private _enhancedMaterial?: ReturnType<typeof createPolygonMaterialEnhancer>;

  constructor(
    viewContext: ViewContext,
    layerId: string,
    uniforms: CommonUniforms,
    buf: BufferGeometry<Attributes> = new BufferGeometry<Attributes>(),
    mat: MeshLambertMaterial = new MeshLambertMaterial(),
    enhancedMaterial?: ReturnType<typeof createPolygonMaterialEnhancer>,
  ) {
    super(buf, mat);

    this._viewContext = viewContext;
    this._layerId = layerId;
    this._uniforms = uniforms;
    this._enhancedMaterial = enhancedMaterial;
  }

  ready() {
    return !!this._enhancedMaterial;
  }

  init(
    mesh: NavaraPolygonMesh,
    buf: BufferLoader,
    tileHandle: TileHandle | undefined,
  ) {
    this.batchLength = mesh.batch_length;
    // Register cleanup listener first (before any potential early returns)
    // This ensures dispose() is called even if geometry initialization fails
    this.addEventListener("removedFromWorld", () => {
      this.dispose();
    });

    const { success, useRTE } = this.initGeometry(mesh, buf);
    if (!success) {
      console.warn("PolygonMesh.init: geometry initialization failed");
      return this;
    }
    this.initMaterial(mesh, this._uniforms, tileHandle, useRTE);
    this.initDepthMaterial();

    if (mesh.bounding_sphere) {
      const bs = mesh.bounding_sphere;

      this._baseBoundingSphere = {
        // If this mesh is tile based, RTC is used. In this case, this mesh is transformed through matrixWorld.
        surfaceCenter: useRTE
          ? new Vector3(bs.center_x, bs.center_y, bs.center_z)
          : new Vector3(),
        aabbRadius: bs.radius,
      };

      this._recalculateBoundingSphere();
    }

    return this;
  }

  clone() {
    return new PolygonMesh(
      this._viewContext,
      this._layerId,
      this._uniforms,
      this.geometry,
      this.material,
      this._enhancedMaterial,
    ) as this;
  }

  private initGeometry(
    mesh: NavaraPolygonMesh,
    buf: BufferLoader,
  ): { success: boolean; useRTE: boolean } {
    const g = mesh.geometry;

    // Check if RTE attributes are present
    const useRTE =
      g.position_3d_high !== undefined && g.position_3d_high.size > 0;

    const position =
      !useRTE && g.position ? buf.removeF32(g.position.data) : undefined;
    const position_3d_high =
      useRTE && g.position_3d_high
        ? buf.removeF32(g.position_3d_high.data)
        : undefined;
    const position_3d_low =
      useRTE && g.position_3d_low
        ? buf.removeF32(g.position_3d_low.data)
        : undefined;
    const normal = g.normal ? buf.removeF32(g.normal.data) : undefined;
    const scale_normal_and_cap = g.scale_normal_and_cap
      ? buf.removeF32(g.scale_normal_and_cap.data)
      : undefined;
    const indices = buf.removeU32(g.indices);
    const batchIds = g.batch_ids ? buf.removeF32(g.batch_ids.data) : undefined;
    const batchIdSize = g.batch_ids ? g.batch_ids.size : 0;
    const batchIndex = g.batch_index
      ? buf.removeU32(g.batch_index.data)
      : undefined;
    const batchIndexSize = g.batch_index ? g.batch_index.size : 0;

    if (!indices) return { success: false, useRTE: false };
    if (!useRTE && !position) return { success: false, useRTE: false };
    if (useRTE && (!position_3d_high || !position_3d_low))
      return { success: false, useRTE: false };

    const geometry = this.geometry;

    if (useRTE) {
      // RTE mode: set position_3d_high and position_3d_low
      if (
        position_3d_high &&
        position_3d_low &&
        g.position_3d_high &&
        g.position_3d_low
      ) {
        geometry.setAttribute(
          "position_3d_high",
          new BufferAttribute(position_3d_high, g.position_3d_high.size),
        );
        geometry.setAttribute(
          "position_3d_low",
          new BufferAttribute(position_3d_low, g.position_3d_low.size),
        );
      }
    } else {
      // Regular mode: set position
      if (position && g.position) {
        geometry.setAttribute(
          "position",
          new BufferAttribute(position, g.position.size),
        );
      }
    }

    if (g.normal && normal) {
      geometry.setAttribute(
        "normal",
        new BufferAttribute(normal, g.normal.size),
      );
    }
    if (g.scale_normal_and_cap && scale_normal_and_cap) {
      geometry.setAttribute(
        "scaleNormalAndCap",
        new BufferAttribute(scale_normal_and_cap, g.scale_normal_and_cap.size),
      );
    }

    if (batchIds) {
      geometry.setAttribute(
        "attrBatchId",
        new BufferAttribute(batchIds, batchIdSize),
      );
    }

    if (batchIndex) {
      this._setBatchIndex(Float32Array.from(batchIndex), batchIndexSize);
    }

    geometry.setIndex(new BufferAttribute(indices, 1));

    return { success: true, useRTE };
  }

  /**
   * Get the enhancer, throwing if not initialized.
   * @throws Error if enhancer is not initialized
   */
  private getEnhancer(): NonNullable<typeof this._enhancedMaterial> {
    if (!this._enhancedMaterial) {
      throw new Error("PolygonMesh must be initialized via init() before use");
    }
    return this._enhancedMaterial;
  }

  private enableWater() {
    if (!this._enhancedMaterial) return;

    const { base, water } = this._enhancedMaterial.states();

    // Disable water normal map if water is off or texturized
    if (!water.useWater || base.isTexturized) {
      this._enhancedMaterial.update({ water: { waterNormalMap: null } });
      return;
    }

    // Skip if not visible or already has water texture
    if (!this.visible || water.waterNormalMap) {
      return;
    }

    // Use shared water texture from CommonUniforms (must be enabled via Options.waterTexture.enabled)
    if (this._uniforms?.waterTexture.value) {
      this._enhancedMaterial.update({
        water: { waterNormalMap: this._uniforms.waterTexture.value },
      });
      this.material.needsUpdate = true;
    }
  }

  private initMaterial(
    mesh: NavaraPolygonMesh,
    uniforms: CommonUniforms,
    tileHandle: TileHandle | undefined,
    useRTE: boolean,
  ) {
    const meshMaterial = mesh.material;
    const mcolor = meshMaterial.color;

    this.castShadow = !!meshMaterial.castShadow;
    this.receiveShadow = !!meshMaterial.receiveShadow;

    // This mesh is texturized if it has a tile handle (terrain attachment).
    const isTexturized = !!tileHandle;
    const material = this.material;

    material.vertexColors = false;
    this.visible = !!meshMaterial.show;

    const uMinMaxHeights = meshMaterial.__internal__?.minMaxHeights;
    const minMaxHeight: [number, number] | undefined = uMinMaxHeights
      ? [uMinMaxHeights[0], uMinMaxHeights[1]]
      : undefined;

    // Ignored if it is cloned.
    if (!this._enhancedMaterial) {
      // Create enhanced material with encapsulated state
      const enhancer = createPolygonMaterialEnhancer(material);
      this._enhancedMaterial = enhancer;
    }
    const enhancer = this._enhancedMaterial;

    // Initialize material state with separated base and water props
    const initialProps: PolygonMaterialProps = {
      base: {
        color: mcolor,
        opacity: meshMaterial.opacity,
        transparent: meshMaterial.transparent,
        wireframe: meshMaterial.wireframe,
        minMaxHeight,
        clampToGround: meshMaterial.clampToGround,
        isTexturized,
        reflectivity: meshMaterial.reflectivity,
        roughness: meshMaterial.roughness,
        emissiveColor: meshMaterial.emissiveColor,
        emissiveIntensity: meshMaterial.emissiveIntensity,
        globeNormalTexture: uniforms.tGlobeNormal as { value: Texture | null },
        useRTE,
      },
      water: {
        water: meshMaterial.water,
        waterScaleNormal: meshMaterial.waterScaleNormal,
        waterSpeed: meshMaterial.waterSpeed,
        shininess: meshMaterial.shininess,
        specularStrength: meshMaterial.specularStrength,
        applyWaterNormal: meshMaterial.applyWaterNormal,
        specular: meshMaterial.specular,
        ior: meshMaterial.ior,
        timeUniform: uniforms.time as { value: number },
        skyEnvMap: uniforms.tSkyEnvMap.value,
      },
    };

    // Mount the enhancer
    enhancer.mount(initialProps);

    // Set up RTE if needed
    const { base } = enhancer.states();
    if (base.useRTE) {
      const { base: baseMutates } = enhancer.mutates();
      const callback = setupRTECallback(
        this,
        (modelViewMatrixRTE, cameraPositionHigh, cameraPositionLow) =>
          baseMutates.updateRteUniforms(
            modelViewMatrixRTE,
            cameraPositionHigh,
            cameraPositionLow,
            base,
          ),
      );
      this.onBeforeRender = callback;
      this.onBeforeShadow = callback;
    }

    this.enableWater();

    // Set up custom program cache key based on config flags that affect shader defines
    material.customProgramCacheKey = enhancer.programCacheKey;

    // Set up onBeforeCompile using the enhancer's transformShader
    material.onBeforeCompile = enhancer.transformShader;

    this._viewContext.applyShadowMaterial(material);

    this._initBatchedMaterial();

    this._update(meshMaterial, mesh.active, isTexturized);
  }

  /**
   * Override a material that is used to generate a shadow map.
   */
  private initDepthMaterial() {
    this.customDepthMaterial = this.material.clone();
    this.customDepthMaterial.needsUpdate = true;

    const origin = this.material;

    this.customDepthMaterial.onBeforeCompile = (shader, renderer) => {
      origin.onBeforeCompile(shader, renderer);

      shader.defines ??= {};
      Object.assign(shader.defines, origin.userData.defines || {});
      shader.defines["USE_SHADOWMAP_DEPTH"] = 1;
      shader.defines["DEPTH_PACKING"] = RGBADepthPacking;
    };
  }

  _update(material: PolygonMaterial, active: boolean, isTexturized: boolean) {
    const enhancer = this.getEnhancer();

    // Update mesh properties (not handled by enhancer)
    this.visible =
      (material.show ?? true) && (material.surfaceShow ?? true) && active;
    if (this._debugBoundingSphereMesh) {
      this._debugBoundingSphereMesh.visible = this.visible;
    }
    this.castShadow = !!material.castShadow;
    this.receiveShadow = !!material.receiveShadow;

    const { base } = enhancer.states();

    // Build props from material with separated base and water sections
    const minMaxHeights = material.__internal__?.minMaxHeights;
    const updateProps: PolygonMaterialProps = {
      base: {
        // `material.color` is used only when `batchColorEnabled` is `false`.
        // Otherwise the color is update via `setFeatureColor` or the batch data texture.
        color: base.batchColorEnabled ? undefined : material.color,
        opacity: material.opacity,
        transparent: !!material.transparent,
        wireframe: !!material.wireframe,
        minMaxHeight:
          minMaxHeights !== undefined
            ? [minMaxHeights[0], minMaxHeights[1]]
            : undefined,
        clampToGround: !!material.clampToGround,
        isTexturized,
        reflectivity: material.reflectivity,
        roughness: material.roughness,
        emissiveColor: material.emissiveColor,
        emissiveIntensity: material.emissiveIntensity,
        effectIdsMask:
          this._viewContext.selectiveEffectRegistry?.computeMask(
            this._viewContext.getLayerEffects(this._layerId) ?? [],
          ) ?? 0,
      },
      water: {
        water: !!material.water,
        waterScaleNormal: material.waterScaleNormal,
        waterSpeed: material.waterSpeed,
        shininess: material.shininess,
        specularStrength: material.specularStrength,
        applyWaterNormal: material.applyWaterNormal,
        specular: material.specular,
        ior: material.ior,
      },
    };

    // Update via enhancer
    enhancer.update(updateProps);

    // Post-update actions
    this.enableWater();
    this._recalculateBoundingSphere();
  }

  private _recalculateBoundingSphere() {
    const baseBounds = this._baseBoundingSphere;
    if (!baseBounds || !this._enhancedMaterial) {
      return;
    }

    if (!this.geometry.boundingSphere) {
      this.geometry.boundingSphere = new Sphere();
    }

    // Cache values to avoid multiple calls
    const { base } = this._enhancedMaterial.states();

    if (base.clampToGround) {
      this.geometry.boundingSphere?.set(
        baseBounds.surfaceCenter,
        baseBounds.aabbRadius,
      );
      return;
    }

    const { addHeight, addExtrudedHeight, minMaxHeight } = base;

    if (!minMaxHeight) return;

    // Compute effective min/max considering both uniform and per-feature batch values
    const minHeight = Math.min(
      minMaxHeight[0] + addHeight,
      minMaxHeight[0] + this._minBatchHeight,
    );
    const maxHeight = Math.max(
      minMaxHeight[1] + addHeight + addExtrudedHeight,
      minMaxHeight[1] + this._maxBatchHeight + this._maxBatchExtrudedHeight,
    );

    const heightOffset = (maxHeight - minHeight) / 2.0;
    const centerHeight = (maxHeight + minHeight) / 2.0;

    // Get surface normal from surface center
    const surfaceNormal = baseBounds.surfaceCenter.clone().normalize();

    // Calculate new center by elevating along surface normal
    const center = baseBounds.surfaceCenter
      .clone()
      .add(surfaceNormal.multiplyScalar(centerHeight));

    // Calculate new radius using Pythagorean theorem
    const radius = Math.sqrt(
      baseBounds.aabbRadius * baseBounds.aabbRadius +
        heightOffset * heightOffset,
    );

    // Update geometry bounding sphere
    this.geometry.boundingSphere?.set(center, radius);

    if (DEBUG_BOUNDING_SPHERE) {
      this._updateDebugBoundingSphereMesh(center, radius);
    }
  }

  private _updateDebugBoundingSphereMesh(center: Vector3, radius: number) {
    if (!this._debugBoundingSphereMesh) {
      const geo = new SphereGeometry(1, 16, 12);
      const mat = new MeshBasicMaterial({
        color: 0x00ff00,
        wireframe: true,
        depthTest: false,
        transparent: true,
        opacity: 0.3,
      });
      this._debugBoundingSphereMesh = new ThreeMesh(geo, mat);
      // this._debugBoundingSphereMesh.frustumCulled = false;
      this.add(this._debugBoundingSphereMesh);
    }

    this._debugBoundingSphereMesh.position.copy(center);
    this._debugBoundingSphereMesh.scale.setScalar(radius);
  }

  _getDefaultBatchAttributeValues(): DefaultBatchAttributeValues {
    return {
      color: this.material.color,
    };
  }

  _setFeatureColor(color: Color): void {
    this.getEnhancer().update({
      base: { batchColorEnabled: true, color: color.getHex() },
    });
  }

  _setFeatureShow(visible: boolean): void {
    this.visible = visible;
    this.outline?._setFeatureShow(this.outline.visible && visible);
    this.enableWater();
  }

  _setPickable(pickable: boolean): void {
    this.getEnhancer().update({ base: { pickable } });
    this.needsUpdate();
  }

  _updateBatchAttribute(
    batchId: number,
    attribute: BatchedAttributeName,
    value: number | number[] | boolean,
  ): void {
    switch (attribute) {
      case "color": {
        // When batch color is first used, enable batchColorEnabled and set material.color to white
        if (!this.getEnhancer().states().base.batchColorEnabled) {
          // Set material.color to white (multiplier identity) and enable batch color mode
          this.getEnhancer().update({
            base: { batchColorEnabled: true, color: 0xffffff },
          });
        }
        this.getEnhancer().update({ base: { useBatchColorShow: true } });
        this.outline?.enableBatchColorShow();
        break;
      }
      case "show": {
        this.getEnhancer().update({ base: { useBatchColorShow: true } });
        this.outline?.enableBatchColorShow();
        break;
      }
      case "height": {
        this.getEnhancer().update({ base: { useBatchHeight: true } });
        this.outline?.enableBatchHeight();
        const h = value as number;
        if (h > this._maxBatchHeight) this._maxBatchHeight = h;
        if (h < this._minBatchHeight) this._minBatchHeight = h;
        break;
      }
      case "extrudedHeight": {
        this.getEnhancer().update({ base: { useBatchExtrudedHeight: true } });
        this.outline?.enableBatchExtrudedHeight();
        const eh = value as number;
        if (eh > this._maxBatchExtrudedHeight)
          this._maxBatchExtrudedHeight = eh;
        break;
      }
    }

    // Call parent to update the batch texture
    super._updateBatchAttribute(batchId, attribute, value);

    if (attribute === "height" || attribute === "extrudedHeight") {
      this._recalculateBoundingSphere();
    }
  }

  _initBatchDataTexture(): void {
    // Call parent to create the texture
    super._initBatchDataTexture();

    // Update the enhancer with the new batchDataTexture
    const texture = this._getBatchDataTexture();
    if (texture) {
      this.getEnhancer().update({
        base: { useBatchTexture: true, batchDataTexture: { value: texture } },
      });
      // Share the same batch texture with outline (no duplicate data)
      this.outline?.initBatchTexture(texture);
    }
  }

  _setFeatureExtrudedHeight(height: number): void {
    this.getEnhancer().update({ base: { addExtrudedHeight: height } });
    this.outline?._setFeatureExtrudedHeight(height);
    this._recalculateBoundingSphere();
  }

  _setFeatureHeight(height: number): void {
    this.getEnhancer().update({ base: { addHeight: height } });
    this.outline?._setFeatureHeight(height);
    this._recalculateBoundingSphere();
  }

  get water(): boolean {
    return this.getEnhancer().states().water.useWater;
  }
  set water(v: boolean) {
    this.getEnhancer().update({ water: { water: v } });
  }

  /** Properties for material state used by TileMesh for texturized scene rendering */
  get waterScaleNormal(): number {
    return this.getEnhancer().states().water.waterScaleNormal;
  }
  get waterSpeed(): number {
    return this.getEnhancer().states().water.waterSpeed;
  }
  get shininess(): number {
    return this.getEnhancer().states().water.shininess;
  }
  get specularStrength(): number {
    return this.getEnhancer().states().water.specularStrength;
  }
  get applyWaterNormal(): boolean {
    return this.getEnhancer().states().water.applyWaterNormal;
  }
  get specular(): boolean {
    return this.getEnhancer().states().water.specular;
  }
  get reflectivity(): number {
    return this.getEnhancer().states().base.reflectivity;
  }
  get roughness(): number {
    return this.getEnhancer().states().base.roughness;
  }
  get clampToGround(): boolean {
    return this.getEnhancer().states().base.clampToGround;
  }

  dispose() {
    if (this._debugBoundingSphereMesh) {
      this._debugBoundingSphereMesh.geometry.dispose();
      (this._debugBoundingSphereMesh.material as MeshBasicMaterial).dispose();
      this.remove(this._debugBoundingSphereMesh);
      this._debugBoundingSphereMesh = undefined;
    }

    this._viewContext.removeShadowMaterial(this.material);
    this.customDepthMaterial?.dispose();
  }
}
