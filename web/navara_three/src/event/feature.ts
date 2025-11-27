import type { EventHandler, TileHandle } from "@navara/core";
import { generate_id_from_entity } from "@navara/core";
import {
  type RenderableFeatureAddedEvent,
  type RenderableFeature,
  RenderableFeatureChangedEvent,
} from "@navara/engine";
import { Mesh, Sprite, Object3D, Material } from "three";

import type { ViewEvents } from "..";
import type { ViewContext } from "../core";
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
  applyEffectPayloadToObject,
  handleFeatureCreatedEventByLayerId,
  handleFeatureUpdatedEventByLayerId,
  type FeatureEffectPayload,
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

type EngineLayerEffectConfig = {
  effect_ids?: string[];
  emissive_intensity?: number;
  emissive_color?: number;
  post_effect_depth_test?: boolean;
};

const extractEffectPayloadFromEvent = (
  ev: RenderableFeatureAddedEvent | RenderableFeatureChangedEvent,
): FeatureEffectPayload | undefined => {
  const effectConfig = (
    ev as unknown as {
      effect_config?: EngineLayerEffectConfig | null;
    }
  ).effect_config;

  if (!effectConfig) {
    return undefined;
  }

  return {
    effectIds: effectConfig.effect_ids ?? undefined,
    emissiveIntensity: effectConfig.emissive_intensity ?? undefined,
    emissiveColor: effectConfig.emissive_color ?? undefined,
    postEffectDepthTest: effectConfig.post_effect_depth_test ?? undefined,
  };
};

export function renderFeature(
  f: RenderableFeature,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  tileHandle: TileHandle | undefined,
  viewEvents: EventHandler<ViewEvents>,
  viewContext: ViewContext,
  layerId?: string,
): Promise<Mesh | Sprite | Object3D | undefined> | undefined {
  if (f.point) {
    return renderPoint(f.point, buf);
  }
  if (f.billboard) {
    return renderBillboard(f.billboard, buf);
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
    return renderPolyline(f.polyline, buf, uniforms, viewEvents);
  }
  if (f.polygon) {
    return renderPolygon(f.polygon, buf, uniforms, tileHandle, viewEvents);
  }
  if (f.text) {
    return renderText(f.text, buf, uniforms);
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

  const useParallel = !!model;

  if (useParallel) {
    // Start parallel process
    onConcurrency(1);
  }

  const effectPayload = extractEffectPayloadFromEvent(ev);

  const obj = await renderFeature(
    feature,
    buf,
    uniforms,
    tileHandle,
    viewEvents,
    viewContext,
    ev.layer_id,
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

  const featureLayerId = ev.layer_id;

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

  // Link to selective effects from layer config cache
  // Must be done after obj is added to scene so world matrices are valid
  if (obj instanceof PolygonMesh && obj.userData.draped && tileHandle) {
    obj.addEventListener("removedFromWorld", () => {
      texturizedSceneByTileCoordinates.remove(tileHandle, featureLayerId);
    });
    obj.addEventListener("needsUpdate", () => {
      texturizedSceneByTileCoordinates.setNeedsUpdate(tileHandle, true);
    });
  } else if (obj instanceof PolygonMesh && obj.userData.draped && !tileHandle) {
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

  handleFeatureCreatedEventByLayerId(
    featureHandler,
    obj,
    viewEvents,
    layersManager,
    viewContext,
    featureLayerId,
    ev.bits,
    effectPayload,
  );
  handleFeatureUpdatedEventByLayerId(
    viewEvents,
    layersManager,
    featureLayerId,
    ev.bits,
    updatedAt,
  );
}

// TODO: Update material in this function.
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

  const active =
    (point ?? billboard ?? text ?? polyline ?? polygon ?? model)?.active ??
    true;

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
    processModelChanged(obj, model, active, viewContext, layerId);
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

  // Handle a draped mesh
  if (obj instanceof PolygonMesh && obj.userData.draped != null && tileHandle) {
    if (obj.userData.draped) {
      if (obj.visible) {
        texturizedSceneByTileCoordinates.add(tileHandle, layerId, obj as Mesh);
      }
    } else {
      texturizedSceneByTileCoordinates.remove(tileHandle, layerId);
    }
    texturizedSceneByTileCoordinates.setNeedsUpdate(tileHandle, true);
  } else if (
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

  const effectPayload = extractEffectPayloadFromEvent(ev);
  applyEffectPayloadToObject(obj, viewContext, layerId, effectPayload);

  handleFeatureUpdatedEventByLayerId(
    viewEvents,
    layersManager,
    layerId,
    ev.bits,
    updatedAt,
  );
}
