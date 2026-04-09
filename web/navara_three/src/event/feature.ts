import type { EventHandler, TileHandle } from "@navara/core";
import { generate_id_from_entity } from "@navara/core";
import {
  type RenderableFeatureAddedEvent,
  type RenderableFeature,
  RenderableFeatureChangedEvent,
} from "@navara/engine";
import type { FontManager } from "@navara/font";
import { Mesh, Sprite, Object3D } from "three";

import type { ViewEvents } from "..";
import { Color } from "../Color";
import type { ViewContext } from "../core/ViewContext";
import type { LayersManager } from "../layersManager";
import {
  BatchedSdfTextMesh,
  InstancedSpriteMesh,
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

import {
  setTransform,
  type BufferLoader,
  type FeatureHandler,
  type LayerHandler,
} from ".";

export function renderFeature(
  f: RenderableFeature,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  tileHandle: TileHandle | undefined,
  viewContext: ViewContext,
  layerId: string,
  fontManager?: FontManager,
): Promise<Mesh | Sprite | Object3D | undefined> | undefined {
  if (f.point) {
    return renderPoint(f.point, buf, viewContext);
  }
  if (f.billboard) {
    return renderBillboard(f.billboard, buf, viewContext);
  }
  if (f.model) {
    return renderModel(f.model, buf, uniforms, viewContext, layerId);
  }
  if (f.polyline) {
    return renderPolyline(f.polyline, buf, uniforms, viewContext);
  }
  if (f.polygon) {
    return renderPolygon(
      f.polygon,
      buf,
      uniforms,
      tileHandle,
      viewContext,
      layerId,
    );
  }
  if (f.text) {
    return renderText(f.text, buf, uniforms, layerId, fontManager);
  }
}

// Define whether the feature uses web worker internally.
// - `model` feature uses Web worker internally to parse glTF and its compression.
export const checkFeatureParallel = (feature: RenderableFeature): boolean => {
  const { model } = feature;
  return !!model;
};

export async function processRenderableFeatureAdded(
  ev: RenderableFeatureAddedEvent,
  scenes: Scenes,
  meshes: MeshCache,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  texturizedSceneByTileCoordinates: TexturizedSceneByTileCoordinates,
  featureHandler: FeatureHandler,
  viewEvents: EventHandler<ViewEvents>,
  layersManager: LayersManager,
  viewContext: ViewContext,
  updatedAt: number,
  fontManager?: FontManager,
) {
  const id = generate_id_from_entity(ev);
  const feature = ev.feature;

  const { point, billboard, text, polyline, polygon, model } = feature;

  const overscaledTileHandle = ev.overscaled_tile_handle;

  const tileHandle = overscaledTileHandle?.handle;

  const featureLayerId = ev.layer_id;

  const useParallel = checkFeatureParallel(feature);

  if (useParallel) {
    // Start parallel process
    viewContext.concurrencyManager.increment();
  }

  const obj = await renderFeature(
    feature,
    buf,
    uniforms,
    tileHandle,
    viewContext,
    featureLayerId,
    fontManager,
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
        viewContext.concurrencyManager.decrement();
      }
    });

  if (!obj) return;

  // Sprite should be handled by mesh itself.
  const transform = (polyline ?? polygon ?? model)?.transform;
  if (transform) {
    setTransform(obj, transform);
  }

  obj.renderOrder = FEATURE_RENDER_ORDER;

  // Add to MRT scene if not draped (draped features render to texturized scene)
  const isDraped =
    (obj instanceof PolygonMesh && obj.clampToGround) ||
    (obj instanceof PolylineMesh && obj.draped);
  if (!isDraped) {
    scenes.mrt.add(obj);
  }

  meshes.set(id, obj);

  if (isDraped && tileHandle) {
    obj.addEventListener("removedFromWorld", () => {
      texturizedSceneByTileCoordinates.remove(tileHandle, featureLayerId);
    });
    obj.addEventListener("needsUpdate", () => {
      texturizedSceneByTileCoordinates.setNeedsUpdate(tileHandle, true);
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

  // Store layer-level effectIds as fallback for meshes that don't carry material.effectIds directly.
  // Not SoT — mesh-level material.effectIds takes priority when available.
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
  texturizedSceneByTileCoordinates: TexturizedSceneByTileCoordinates,
  renderFlag: RenderFlag,
  buf: BufferLoader,
  viewEvents: EventHandler<ViewEvents>,
  layersManager: LayersManager,
  viewContext: ViewContext,
  updatedAt: number,
  layerHandler?: LayerHandler,
) {
  const id = generate_id_from_entity(ev);
  const obj = meshes.get(id);
  if (!obj) return;

  const layerId = ev.layer_id;

  const overscaledTileHandle = ev.overscaled_tile_handle;
  const tileHandle = overscaledTileHandle?.handle;

  const { point, billboard, text, polyline, polygon, model } = ev.feature;

  // Update layer-level effectIds fallback from material.
  // Not SoT — mesh-level material.effectIds takes priority when available.
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
      viewContext.setLayerEmissiveColor(
        layerId,
        new Color().setHex(material.emissiveColor),
      );
    }
  }

  const active =
    (point ?? billboard ?? text ?? polyline ?? polygon ?? model)?.active ??
    true;

  // Capture visibility before material updates to detect changes
  const prevVisible = obj.visible;

  if (obj instanceof InstancedSpriteMesh && point) {
    processPointChanged(obj, point, buf, active);
  }
  if (obj instanceof InstancedSpriteMesh && billboard) {
    await processBillboardChanged(obj, billboard, buf, active);
  }
  if (obj instanceof BatchedSdfTextMesh && text) {
    await processTextChanged(obj, text, buf, renderFlag, active);
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

  // Handle a draped polygon mesh and polyline mesh
  if (
    (obj instanceof PolygonMesh || obj instanceof PolylineMesh) &&
    tileHandle
  ) {
    if (
      (obj instanceof PolygonMesh && obj.clampToGround) ||
      (obj instanceof PolylineMesh && obj.draped)
    ) {
      if (obj.visible) {
        const layerIndex = layerHandler?.getLayerIndex(layerId);
        // Timing issue: `layerIndex` will be undefined if the layer is removed after this feature update event.
        if (layerIndex != null) {
          texturizedSceneByTileCoordinates.add(
            tileHandle,
            layerId,
            obj as Mesh,
            layerIndex,
            false,
          );
        }
      }
    } else {
      texturizedSceneByTileCoordinates.remove(tileHandle, layerId);
    }
    texturizedSceneByTileCoordinates.setNeedsUpdate(tileHandle, true);
  }

  // Emit visibility changed event if visibility actually changed after material updates
  if (prevVisible !== obj.visible) {
    handleFeatureVisibilityChangedEventByLayerId(
      layersManager,
      layerId,
      ev.bits,
      obj.visible,
    );
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
