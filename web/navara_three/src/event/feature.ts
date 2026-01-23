import type { EventHandler, TileHandle } from "@navara/core";
import { generate_id_from_entity } from "@navara/core";
import {
  type RenderableFeatureAddedEvent,
  type RenderableFeature,
  RenderableFeatureChangedEvent,
} from "@navara/engine";
import { Mesh, Sprite, Object3D, Material } from "three";

import type { ViewEvents } from "..";
import {
  parseSelectiveEffectOcclusion,
  type SelectiveEffectOcclusion,
} from "../core/SelectiveEffectHelper";
import type { ViewContext } from "../core/ViewContext";
import type { LayersManager } from "../layersManager";
import {
  InstancedBillboardMesh,
  InstancedPointMesh,
  InstancedTextMesh,
  ModelMesh,
  PolygonMesh,
  PolylineMesh,
} from "../mesh";
import { FEATURE_RENDER_ORDER } from "../renderOrder";
import type { Scenes, TexturizedSceneByTileCoordinates } from "../scene";
import type { MeshCache, RenderFlag } from "../type";
import type { CommonUniforms } from "../uniforms";

import {
  handleFeatureCreatedEventByLayerId,
  handleFeatureUpdatedEventByLayerId,
  handleFeatureVisibilityChangedEventByLayerId,
} from "./featureEvent";
import { renderBillboard, processBillboardChanged } from "./features/billboard";
import { renderModel, processModelChanged } from "./features/model";
import { renderPoint, processPointChanged } from "./features/point";
import { renderPolygon, processPolygonChanged } from "./features/polygon";
import {
  renderPolygonOutline,
  processPolygonOutlineChanged,
} from "./features/polygonOutline";
import { renderPolyline, processPolylineChanged } from "./features/polyline";
import { renderText, processTextChanged } from "./features/text";

import { setTransform, type BufferLoader, type FeatureHandler } from ".";

export function renderFeature(
  f: RenderableFeature,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  tileHandle: TileHandle | undefined,
  viewEvents: EventHandler<ViewEvents>,
  viewContext: ViewContext,
  layerId: string,
): Promise<Mesh | Sprite | Object3D | undefined> | undefined {
  if (f.point) {
    return renderPoint(f.point, buf, viewContext, layerId);
  }
  if (f.billboard) {
    return renderBillboard(f.billboard, buf, viewContext, layerId);
  }
  if (f.model) {
    return renderModel(
      f.model,
      buf,
      uniforms,
      viewEvents,
      viewContext,
      layerId,
    );
  }
  if (f.polyline) {
    return renderPolyline(
      f.polyline,
      buf,
      uniforms,
      viewEvents,
      viewContext,
      layerId,
    );
  }
  if (f.polygon) {
    return renderPolygon(
      f.polygon,
      buf,
      uniforms,
      tileHandle,
      viewEvents,
      viewContext,
      layerId,
    );
  }
  if (f.text) {
    return renderText(f.text, buf, uniforms, viewContext, layerId);
  }
}

export async function processRenderableFeatureAdded(
  ev: RenderableFeatureAddedEvent,
  scenes: Scenes,
  meshes: MeshCache,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  drapedFeatureMaterials: Map<string, Material>,
  texturizedSceneByTileCoordinates: TexturizedSceneByTileCoordinates,
  featureHandler: FeatureHandler,
  viewEvents: EventHandler<ViewEvents>,
  layersManager: LayersManager,
  viewContext: ViewContext,
  updatedAt: number,
  onConcurrency: (v: number) => void,
) {
  const id = generate_id_from_entity(ev);
  const feature = ev.feature;

  const { point, billboard, text, polyline, polygon, model } = feature;

  const overscaledTileHandle = ev.overscaled_tile_handle;

  const tileHandle = overscaledTileHandle?.handle;

  const featureLayerId = ev.layer_id;

  const useParallel = !!model;

  if (useParallel) {
    // Start parallel process
    onConcurrency(1);
  }

  const obj = await renderFeature(
    feature,
    buf,
    uniforms,
    tileHandle,
    viewEvents,
    viewContext,
    featureLayerId,
  )
    ?.then((r) => {
      const type = (() => {
        if (point || billboard || text) return "point";
        else if (model) return "model";
        else if (polyline) return "polyline";
        else if (polygon) return "polygon";
      })();
      if (type) {
        featureHandler.markFeatureIsRendered(type, ev.bits);
      }
      return r;
    })
    .finally(() => {
      if (useParallel) {
        // End parallel process
        onConcurrency(-1);
      }
    });

  if (!obj) return;

  // Sprite should be handled by mesh itself.
  const transform = (polyline ?? polygon ?? model)?.transform;
  if (transform) {
    setTransform(obj, transform);
  }

  obj.renderOrder = FEATURE_RENDER_ORDER;

  if (!obj.userData.draped) {
    scenes.mrt.add(obj);
  }

  meshes.set(id, obj);

  if (
    (obj instanceof PolygonMesh || obj instanceof PolylineMesh) &&
    obj.userData.draped &&
    tileHandle
  ) {
    obj.addEventListener("removedFromWorld", () => {
      texturizedSceneByTileCoordinates.remove(tileHandle, featureLayerId);
    });
    obj.addEventListener("needsUpdate", () => {
      texturizedSceneByTileCoordinates.setNeedsUpdate(tileHandle, true);
    });
  }

  if (obj instanceof PolygonMesh && obj.userData.draped && !tileHandle) {
    drapedFeatureMaterials.set(id, obj.material);
    obj.addEventListener("removedFromWorld", () => {
      drapedFeatureMaterials.delete(id);
    });
  }

  if (obj instanceof PolygonMesh && polygon && polygon.outline_geometry) {
    const outline = await renderPolygonOutline(polygon, buf, viewEvents);
    outline.renderOrder = FEATURE_RENDER_ORDER;
    scenes.mrt.add(outline);

    obj.outline = outline;

    obj.addEventListener("removedFromWorld", () => {
      obj.outline?.clear();
      obj.outline?.removeFromParent();
    });
  }

  // Register initial effects from Rust material if not already registered for this layer
  // All 5 material types in appearance.rs have post effect fields
  const material =
    feature.model?.material ??
    feature.polygon?.material ??
    feature.polyline?.material ??
    feature.point?.material ??
    feature.billboard?.material;
  if (material && viewContext.getLayerEffects(featureLayerId) === undefined) {
    viewContext.registerLayerEffects(
      featureLayerId,
      material.effectIds ?? [],
      parseSelectiveEffectOcclusion(
        material.selectiveEffectOcclusion as
          | SelectiveEffectOcclusion
          | undefined,
      ),
      material.emissiveIntensity,
    );
  }

  handleFeatureCreatedEventByLayerId(
    featureHandler,
    obj,
    viewEvents,
    layersManager,
    featureLayerId,
    ev.bits,
  );
  if (obj.visible) {
    handleFeatureUpdatedEventByLayerId(
      viewEvents,
      layersManager,
      featureLayerId,
      ev.bits,
      updatedAt,
    );
  }
}

export async function processRenderableFeatureChanged(
  ev: RenderableFeatureChangedEvent,
  meshes: MeshCache,
  drapedFeatureMaterials: Map<string, Material>,
  texturizedSceneByTileCoordinates: TexturizedSceneByTileCoordinates,
  renderFlag: RenderFlag,
  buf: BufferLoader,
  viewEvents: EventHandler<ViewEvents>,
  layersManager: LayersManager,
  viewContext: ViewContext,
  updatedAt: number,
) {
  const id = generate_id_from_entity(ev);
  const obj = meshes.get(id);
  if (!obj) return;

  const layerId = ev.layer_id;

  const overscaledTileHandle = ev.overscaled_tile_handle;
  const tileHandle = overscaledTileHandle?.handle;

  const { point, billboard, text, polyline, polygon, model } = ev.feature;

  // Update SelectiveEffect configuration from material (Core is SoT)
  // All 5 material types in appearance.rs have selective effect fields
  const material =
    model?.material ??
    polygon?.material ??
    polyline?.material ??
    point?.material ??
    billboard?.material;
  if (material) {
    viewContext.updateLayerEffects(
      layerId,
      material.effectIds,
      material.emissiveIntensity,
    );

    if (material.emissiveColor !== undefined) {
      viewContext.setLayerEmissiveColor(layerId, material.emissiveColor);
    }

    if (material.selectiveEffectOcclusion !== undefined) {
      const occlusion = parseSelectiveEffectOcclusion(
        material.selectiveEffectOcclusion as SelectiveEffectOcclusion,
      );
      if (occlusion !== undefined) {
        viewContext.setLayerSelectiveEffectOcclusion(layerId, occlusion);
      }
    }
  }

  const active =
    (point ?? billboard ?? text ?? polyline ?? polygon ?? model)?.active ??
    true;

  // Track previous active state from Rust to detect visibility changes
  // We store this in userData since obj.visible is managed internally by the mesh
  const prevActive = (obj.userData._active as boolean | undefined) ?? true;

  if (obj instanceof InstancedPointMesh && point) {
    processPointChanged(obj, point, buf, active);
  }
  if (obj instanceof InstancedBillboardMesh && billboard) {
    await processBillboardChanged(obj, billboard, buf, active);
  }
  if (obj instanceof InstancedTextMesh && text) {
    processTextChanged(obj, text, buf, active, renderFlag);
  }
  if (obj instanceof ModelMesh && model) {
    processModelChanged(obj, model, active);
  }
  if (obj instanceof PolylineMesh && polyline) {
    processPolylineChanged(obj, polyline, active);
  }
  if (obj instanceof PolygonMesh && polygon) {
    processPolygonChanged(obj, polygon, active, tileHandle);

    if (obj.outline) {
      processPolygonOutlineChanged(obj.outline, polygon, active);
    }
  }

  // Emit visibility changed event if active state changed
  if (prevActive !== active) {
    obj.userData._active = active;
    handleFeatureVisibilityChangedEventByLayerId(
      layersManager,
      layerId,
      ev.bits,
      active,
    );
  }

  // Handle a draped polygon mesh and polyline mesh
  if (
    (obj instanceof PolygonMesh || obj instanceof PolylineMesh) &&
    obj.userData.draped != null &&
    tileHandle
  ) {
    if (obj.userData.draped) {
      if (obj.visible) {
        texturizedSceneByTileCoordinates.add(tileHandle, layerId, obj as Mesh);
      }
    } else {
      texturizedSceneByTileCoordinates.remove(tileHandle, layerId);
    }
    texturizedSceneByTileCoordinates.setNeedsUpdate(tileHandle, true);
  }
  if (
    obj instanceof PolygonMesh &&
    obj.userData.draped != null &&
    !tileHandle
  ) {
    if (obj.userData.draped) {
      if (!drapedFeatureMaterials.has(id)) {
        obj.material.stencilWrite = false;
        obj.material.depthWrite = false;
        obj.material.depthTest = false;
        obj.material.colorWrite = false;
        drapedFeatureMaterials.set(id, obj.material);
      }
    } else {
      obj.material.depthWrite = true;
      obj.material.depthTest = true;
      obj.material.stencilWrite = false;
      obj.material.colorWrite = true;
      drapedFeatureMaterials.delete(id);
    }
  }

  // Point, billboard and text should be handled by their mesh.
  const transform = (polyline ?? polygon ?? model)?.transform;

  // This should be handled after the asynchronous process to avoid a conflict.
  if (transform) {
    setTransform(obj, transform);
  }

  obj.updateMatrix();

  if (obj.visible) {
    handleFeatureUpdatedEventByLayerId(
      viewEvents,
      layersManager,
      layerId,
      ev.bits,
      updatedAt,
    );
  }
}
