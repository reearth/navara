import type { TileHandle } from "@navara/core";
import { generate_id_from_entity } from "@navara/core";
import {
  type RenderableFeatureAddedEvent,
  type RenderableFeature,
  RenderableFeatureChangedEvent,
} from "@navara/engine";
import { Mesh, Sprite, Object3D } from "three";

import {
  BatchedSdfTextMesh,
  InstancedSpriteMesh,
  ModelMesh,
  PolygonMesh,
  PolylineMesh,
} from "../mesh";
import { FEATURE_RENDER_ORDER } from "../renderOrder";

import type { EventContext } from "./context";
import {
  handleFeatureCreatedEventByLayerId,
  handleFeatureUpdatedEventByLayerId,
  handleFeatureVisibilityChangedEventByLayerId,
} from "./featureEvent";
import { renderBillboard, processBillboardChanged } from "./features/billboard";
import { renderModel, processModelChanged } from "./features/model";
import { sumModelGpuBytes } from "./features/modelGpuBytes";
import { renderPoint, processPointChanged } from "./features/point";
import { renderPolygon, processPolygonChanged } from "./features/polygon";
import {
  renderPolygonOutline,
  processPolygonOutlineChanged,
} from "./features/polygonOutline";
import { renderPolyline, processPolylineChanged } from "./features/polyline";
import { renderText, processTextChanged } from "./features/text";

import { setTransform } from ".";

export function renderFeature(
  ctx: EventContext,
  f: RenderableFeature,
  tileHandle: TileHandle | undefined,
  layerId: string,
): Promise<Mesh | Sprite | Object3D | undefined> | undefined {
  if (f.point) {
    return renderPoint(ctx, f.point);
  }
  if (f.billboard) {
    return renderBillboard(ctx, f.billboard);
  }
  if (f.model) {
    return renderModel(ctx, f.model);
  }
  if (f.polyline) {
    return renderPolyline(ctx, f.polyline);
  }
  if (f.polygon) {
    return renderPolygon(ctx, f.polygon, tileHandle, layerId);
  }
  if (f.text) {
    return renderText(ctx, f.text, layerId);
  }
}

// Define whether the feature uses web worker internally.
// - `model` feature uses Web worker internally to parse glTF and its compression.
export const checkFeatureParallel = (feature: RenderableFeature): boolean => {
  const { model } = feature;
  return !!model;
};

export async function processRenderableFeatureAdded(
  ctx: EventContext,
  ev: RenderableFeatureAddedEvent,
) {
  const {
    scenes,
    meshes,
    texturizedSceneByTileCoordinates,
    featureHandler,
    viewEvents,
    layersManager,
    viewContext,
    updatedAt,
    layerHandler,
  } = ctx;
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

  const obj = await renderFeature(ctx, feature, tileHandle, featureLayerId)
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
      // The glTF/Draco decode happened on the JS side, so report the actual
      // decoded GPU size back to the ledger (its compressed-payload estimate
      // undercounts Draco content). Draco decode inflates geometry markedly.
      if (model && r) {
        featureHandler.reportFeatureGpuBytes(ev.bits, sumModelGpuBytes(r));
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
    // Insert the bakeable draped mesh into the per-tile cache now (it is fully built at
    // this point). Readiness/ancestor-fallback is decided entirely on the Rust side from
    // the ECS lifecycle, so no `scene_ready` is reported. Insert even when invisible —
    // the offscreen bake skips invisible meshes.
    const layerIndex = layerHandler?.getLayerIndex(featureLayerId);
    // Timing: the layer may have been removed before this event; skip the insert then (the
    // mesh object still exists, it just won't be baked for this layer).
    if (layerIndex != null) {
      texturizedSceneByTileCoordinates.add(
        tileHandle,
        featureLayerId,
        obj as Mesh,
        layerIndex,
      );
    }
    obj.addEventListener("removedFromWorld", () => {
      texturizedSceneByTileCoordinates.removeMesh(
        tileHandle,
        featureLayerId,
        obj as Mesh,
      );
    });
    obj.addEventListener("needsUpdate", () => {
      texturizedSceneByTileCoordinates.markDirty(tileHandle, featureLayerId);
    });
  }

  if (obj instanceof PolygonMesh && polygon && polygon.outline_geometry) {
    const outline = await renderPolygonOutline(ctx, polygon);
    outline.renderOrder = FEATURE_RENDER_ORDER;
    scenes.mrt.add(outline);

    obj.outline = outline;

    obj.addEventListener("removedFromWorld", () => {
      obj.outline?.clear();
      obj.outline?.removeFromParent();
    });
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
  ctx: EventContext,
  ev: RenderableFeatureChangedEvent,
) {
  const {
    meshes,
    texturizedSceneByTileCoordinates,
    viewEvents,
    layersManager,
    updatedAt,
  } = ctx;
  const id = generate_id_from_entity(ev);
  const obj = meshes.get(id);
  if (!obj) return;

  const layerId = ev.layer_id;

  const overscaledTileHandle = ev.overscaled_tile_handle;
  const tileHandle = overscaledTileHandle?.handle;

  const { point, billboard, text, polyline, polygon, model } = ev.feature;

  const active =
    (point ?? billboard ?? text ?? polyline ?? polygon ?? model)?.active ??
    true;

  // Capture visibility before material updates to detect changes
  const prevVisible = obj.visible;

  if (obj instanceof InstancedSpriteMesh && point) {
    processPointChanged(obj, point, active);
  }
  if (obj instanceof InstancedSpriteMesh && billboard) {
    await processBillboardChanged(obj, billboard, active);
  }
  if (obj instanceof BatchedSdfTextMesh && text) {
    await processTextChanged(obj, text, active);
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

  // A draped feature's material/visibility changed: bump the layer scene's revision so the
  // consuming TileMesh re-bakes (invisible meshes stay in the scene and are skipped at bake).
  // Cache membership is owned by CREATE / `removedFromWorld`; a runtime `clampToGround` flip
  // is not handled here (rare — the flag is set once at mesh init).
  if (
    ((obj instanceof PolygonMesh && obj.clampToGround) ||
      (obj instanceof PolylineMesh && obj.draped)) &&
    tileHandle
  ) {
    texturizedSceneByTileCoordinates.markDirty(tileHandle, layerId);
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
