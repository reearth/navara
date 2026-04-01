import {
  PolylineMesh as NavaraPolylineMesh,
  PolylineMaterial,
} from "@navara/engine";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Matrix4,
  ShaderMaterial,
  Texture,
  Vector2,
} from "three";

import type { ViewContext } from "../core";
import type { BufferLoader } from "../event";
import { createPolylineMaterialEnhancer } from "../material/enhancer";
import type { CommonUniforms } from "../uniforms";
import { arraysEqual } from "../utils";

import {
  BatchedFeatureMesh,
  type BatchedFeatureAttributes,
} from "./batchedFeature";
import type {
  BatchedAttributeName,
  DefaultBatchAttributeValues,
} from "./batchTexture";
import { setupRTECallback } from "./rtcRteHelper";

// Sentinel value for picking coordinate when not picking (reused to avoid allocations)
const PICKING_COORD_SENTINEL = new Vector2(-1, -1);

type Attributes = BatchedFeatureAttributes<{
  position: BufferAttribute;
  // RTE mode attributes (only present when useRTE=true)
  position_3d_high?: BufferAttribute;
  position_3d_low?: BufferAttribute;
  start_3d_high?: BufferAttribute;
  start_3d_low?: BufferAttribute;
  end_3d_high?: BufferAttribute;
  end_3d_low?: BufferAttribute;
  // Non-RTE mode attributes (only present when useRTE=false)
  start?: BufferAttribute;
  forward_offset?: BufferAttribute;
  // Common attributes (always present)
  start_normal: BufferAttribute;
  right_normal_and_texture_coordinate_normalization_y: BufferAttribute;
  end_normal_and_texture_coordinate_normalization_x: BufferAttribute;
  attrBatchId: BufferAttribute;
}>;

export class PolylineMesh extends BatchedFeatureMesh<
  BufferGeometry<Attributes>,
  ShaderMaterial
> {
  /** ViewContext for SelectiveEffect handling */
  private _viewContext: ViewContext;
  /** Layer ID for SelectiveEffect handling */
  private _layerId: string;
  /** Material enhancer for managing shader state */
  private _enhancedMaterial?: ReturnType<typeof createPolylineMaterialEnhancer>;
  /** Previous effectIds for SelectiveEffect registry diff */
  private _prevEffectIds?: string[];
  /** Flag indicating geometry initialization failed - mesh should never be visible */
  private _geometryInitFailed = false;

  constructor(
    mesh: NavaraPolylineMesh,
    buf: BufferLoader,
    uniforms: CommonUniforms,
    viewContext: ViewContext,
    layerId: string,
  ) {
    super(new BufferGeometry<Attributes>(), new ShaderMaterial());
    this._viewContext = viewContext;
    this._layerId = layerId;
    this.batchLength = mesh.batch_length;

    const geometryResult = this.initGeometry(mesh, buf);

    // If geometry init failed (missing required buffers), mark as permanently invisible
    if (!geometryResult.success) {
      console.warn(
        "PolylineMesh: Failed to initialize geometry due to missing required buffers. Mesh will be permanently invisible.",
      );
      this._geometryInitFailed = true;
      this.visible = false;
    }

    this.initMaterial(mesh, uniforms, geometryResult.useRTE);

    this.addEventListener("removedFromWorld", () => {
      this.dispose();
    });
  }

  private initGeometry(
    mesh: NavaraPolylineMesh,
    buf: BufferLoader,
  ): { success: true; useRTE: boolean } | { success: false; useRTE: false } {
    const g = mesh.geometry;
    const position = buf.removeF32(g.position.data);
    const position_high = g.position_high
      ? buf.removeF32(g.position_high.data)
      : null;
    const position_low = g.position_low
      ? buf.removeF32(g.position_low.data)
      : null;
    const start_high = g.start_high ? buf.removeF32(g.start_high.data) : null;
    const start_low = g.start_low ? buf.removeF32(g.start_low.data) : null;
    const end_high = g.end_high ? buf.removeF32(g.end_high.data) : null;
    const end_low = g.end_low ? buf.removeF32(g.end_low.data) : null;
    const start_normals = buf.removeF32(g.start_normals.data);
    const end_normal_and_texture_coordinate_normalization_x = buf.removeF32(
      g.end_normal_and_texture_coordinate_normalization_x.data,
    );
    const right_normal_and_texture_coordinate_normalization_y = buf.removeF32(
      g.right_normal_and_texture_coordinate_normalization_y.data,
    );
    const indices = buf.removeU32(g.indices);
    const batchIds = g.batch_ids ? buf.removeF32(g.batch_ids.data) : undefined;
    const batchIdSize = g.batch_ids ? g.batch_ids.size : 0;
    const batchIndex = g.batch_index
      ? buf.removeU32(g.batch_index.data)
      : undefined;
    const batchIndexSize = g.batch_index ? g.batch_index.size : 0;

    if (
      !position ||
      !start_normals ||
      !end_normal_and_texture_coordinate_normalization_x ||
      !right_normal_and_texture_coordinate_normalization_y ||
      !indices
    ) {
      return { success: false, useRTE: false };
    }

    const geometry = this.geometry;
    const useRTE = !!(
      position_high &&
      position_low &&
      start_high &&
      start_low &&
      end_high &&
      end_low
    );

    geometry.setAttribute(
      "position",
      new BufferAttribute(position, g.position.size),
    );

    if (useRTE) {
      // RTE attributes
      if (position_high && position_low) {
        geometry.setAttribute(
          "position_3d_high",
          new BufferAttribute(position_high, 3),
        );
        geometry.setAttribute(
          "position_3d_low",
          new BufferAttribute(position_low, 3),
        );
      }
      if (start_high && start_low) {
        geometry.setAttribute(
          "start_3d_high",
          new BufferAttribute(start_high, 3),
        );
        geometry.setAttribute(
          "start_3d_low",
          new BufferAttribute(start_low, 3),
        );
      }
      if (end_high && end_low) {
        geometry.setAttribute("end_3d_high", new BufferAttribute(end_high, 3));
        geometry.setAttribute("end_3d_low", new BufferAttribute(end_low, 3));
      }
    } else {
      const start = buf.removeF32(g.start.data);
      const forward_offset = buf.removeF32(g.forward_offset.data);

      if (!start || !forward_offset) {
        return { success: false, useRTE: false };
      }

      // Non-RTE mode: use regular start attribute
      geometry.setAttribute("start", new BufferAttribute(start, g.start.size));

      geometry.setAttribute(
        "forward_offset",
        new BufferAttribute(forward_offset, g.forward_offset.size),
      );
    }

    geometry.setAttribute(
      "start_normal",
      new BufferAttribute(start_normals, g.start_normals.size),
    );
    geometry.setAttribute(
      "end_normal_and_texture_coordinate_normalization_x",
      new BufferAttribute(
        end_normal_and_texture_coordinate_normalization_x,
        g.end_normal_and_texture_coordinate_normalization_x.size,
      ),
    );
    geometry.setAttribute(
      "right_normal_and_texture_coordinate_normalization_y",
      new BufferAttribute(
        right_normal_and_texture_coordinate_normalization_y,
        g.right_normal_and_texture_coordinate_normalization_y.size,
      ),
    );

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
    // geometry.computeVertexNormals();

    return { success: true, useRTE };
  }

  private initMaterial(
    mesh: NavaraPolylineMesh,
    uniforms: CommonUniforms,
    useRTE: boolean,
  ) {
    const meshMaterial = mesh.material;

    const [minHeight, maxHeight] = meshMaterial.__internal__?.minMaxHeights ?? [
      0, 0,
    ];

    this.castShadow = !!meshMaterial.castShadow;
    this.receiveShadow = !!meshMaterial.receiveShadow;

    const isTexturized = mesh.should_be_texturized;

    // Shader selection is handled by enhancer's transformShader
    this.material.depthTest = false;

    // Disable lighting for texturized rendering - the texture will be applied to the lit tile
    this.material.lights = !isTexturized;
    this.material.vertexColors = false;

    // Ignored if it is cloned.
    if (!this._enhancedMaterial) {
      // Create enhanced material with encapsulated state
      const enhancer = createPolylineMaterialEnhancer(this.material);
      this._enhancedMaterial = enhancer;
    }
    const enhancer = this._enhancedMaterial;

    enhancer.mount({
      base: {
        color: meshMaterial.color,
        minMaxHeight: [minHeight, maxHeight],
        width: meshMaterial.width,
        maxWidth: meshMaterial.maxWidth,
        clampToGround: !!meshMaterial.clampToGround,
        useGroundNormals: !!meshMaterial.useGroundNormals,
        isTexturized,
        pickable: false,
        useRTE,
        // External shared uniforms from CommonUniforms
        globeNormalTexture: uniforms.tGlobeNormal as { value: Texture | null },
        viewportAndPixelRatio: uniforms.viewportAndPixelRatio,
        frustumNearFar: uniforms.frustumNearFar,
        frustumRatio: uniforms.frustumRatio,
        tGlobeDepth: uniforms.tGlobeDepth,
        inverseProjectionMatrix: uniforms.inverseProjectionMatrix,
      },
    });

    // Initialize enhancer uniforms early so they're available before onBeforeCompile
    const mutates = enhancer.mutates();
    mutates.updateUniforms(this.material.uniforms, enhancer.states());

    // Set up RTE callback if needed
    const state = enhancer.states();
    if (state.useRTE) {
      const mutates = enhancer.mutates();
      const callback = setupRTECallback(
        this,
        (modelViewMatrixRTE, cameraPositionHigh, cameraPositionLow) =>
          mutates.updateRteUniforms(
            modelViewMatrixRTE,
            cameraPositionHigh,
            cameraPositionLow,
            state,
          ),
        new Matrix4(),
        new Matrix4(),
      );
      this.onBeforeRender = callback;
      this.onBeforeShadow = callback;

      // Disable frustum culling for RTE mode
      this.frustumCulled = false;
    }

    // Set up custom program cache key based on config flags that affect shader defines
    this.material.customProgramCacheKey = enhancer.programCacheKey;

    // Set onBeforeCompile to use enhancer
    this.material.onBeforeCompile = enhancer.transformShader;

    this._viewContext.applyShadowMaterial(this.material);

    this._initBatchedMaterial();

    this._update(meshMaterial, mesh.active);
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
    }
  }

  /**
   * Keep enhancer state in sync with batch-attribute usage so that
   * customProgramCacheKey reflects the correct shader configuration.
   *
   * This mirrors PolygonMesh._updateBatchAttribute: when batch color
   * is first enabled, also enable batchColorEnabled and set color to white.
   */
  _updateBatchAttribute(
    batchId: number,
    attribute: BatchedAttributeName,
    value: number | number[] | boolean,
  ): void {
    switch (attribute) {
      case "color": {
        // When batch color is first used, enable batchColorEnabled and set material.color to white
        if (!this.getEnhancer().states().batchColorEnabled) {
          // Set material.color to white (multiplier identity) and enable batch color mode
          this.getEnhancer().update({
            base: { batchColorEnabled: true, color: 0xffffff },
          });
        }
        this.getEnhancer().update({ base: { useBatchColorShow: true } });
        break;
      }
      case "show": {
        this.getEnhancer().update({ base: { useBatchColorShow: true } });
        break;
      }
      case "height":
        this.getEnhancer().update({ base: { useBatchHeight: true } });
        break;
      case "extrudedHeight":
        this.getEnhancer().update({ base: { useBatchExtrudedHeight: true } });
        break;
    }

    // Call parent to update the batch texture
    super._updateBatchAttribute(batchId, attribute, value);
  }

  _update(material: PolylineMaterial, active: boolean) {
    // If geometry initialization failed, keep mesh permanently invisible
    // to prevent WebGL errors from missing attributes/buffers
    if (this._geometryInitFailed) {
      this.visible = false;
      return;
    }

    const enhancer = this.getEnhancer();

    // Update mesh properties (not handled by enhancer)
    this.visible = (material.show ?? true) && active;
    this.castShadow = !!material.castShadow;
    this.receiveShadow = !!material.receiveShadow;

    // SelectiveEffect: effectIds handling (needs prev state for registry)
    if (!arraysEqual(this._prevEffectIds, material.effectIds)) {
      this._viewContext.selectiveEffectRegistry?.updateLinksForObject(
        this,
        material.effectIds ?? [],
        this._prevEffectIds ?? [],
        this._layerId,
      );
      this._prevEffectIds = material.effectIds ? [...material.effectIds] : [];
    }

    const base = enhancer.states();

    // Build update props from material
    const minMaxHeights = material.__internal__?.minMaxHeights;
    enhancer.update({
      base: {
        // `material.color` is used only when `batchColorEnabled` is `false`.
        // Otherwise the color is updated via `_setFeatureColor` or the batch data texture.
        color: base.batchColorEnabled ? undefined : material.color,
        minMaxHeight:
          minMaxHeights !== undefined
            ? [minMaxHeights[0], minMaxHeights[1]]
            : undefined,
        width: material.width,
        maxWidth: material.maxWidth,
        clampToGround: !!material.clampToGround,
        useGroundNormals: !!material.useGroundNormals,
      },
    });

    // Update material.lights flag based on isTexturized state
    // (lighting should be disabled for texturized/draped polylines)
    this.material.lights = !base.isTexturized;
  }

  /**
   * Get the enhancer, throwing if not initialized.
   * @throws Error if enhancer is not initialized
   */
  private getEnhancer(): NonNullable<typeof this._enhancedMaterial> {
    if (!this._enhancedMaterial) {
      throw new Error(
        "PolylineMesh material enhancer is not initialized. This usually indicates a failure during construction or geometry/material setup.",
      );
    }
    return this._enhancedMaterial;
  }

  get color() {
    return this.material.uniforms.color.value;
  }

  get draped(): boolean {
    return this.getEnhancer().states().isTexturized;
  }

  _setPickable(pickable: boolean, pickingCoord?: Vector2) {
    this.getEnhancer().update({ base: { pickable } });
    this.needsUpdate();

    const mutates = this.getEnhancer().mutates();
    if (pickable && pickingCoord) {
      mutates.setPickingCoord(pickingCoord);
    } else {
      // Reset to sentinel value when not picking or no coordinate provided
      mutates.setPickingCoord(PICKING_COORD_SENTINEL);
    }
  }


  _getDefaultBatchAttributeValues(): DefaultBatchAttributeValues {
    return {
      color: this.color,
    };
  }

  _setFeatureColor(color: Color): void {
    // Called by evaluator to override feature color
    // Set batchColorEnabled=true to prevent _update() from overwriting with material.color
    this.getEnhancer().update({
      base: { batchColorEnabled: true, color: color.getHex() },
    });
  }

  _setFeatureShow(visible: boolean): void {
    this.visible = visible;
  }

  dispose() {
    this._viewContext.removeShadowMaterial(this.material);
  }
}
