import type { EventHandler } from "@navara/core";
import { generate_id_from_entity } from "@navara/core";
import {
  type RenderableFeatureAddedEvent,
  type RenderableFeature,
  RenderableFeatureChangedEvent,
  PointMaterial,
  BillboardMaterial,
  TextMaterial,
  ModelMaterial,
  PolylineMaterial,
  PolygonMaterial,
} from "@navara/engine";
import { Mesh, Sprite, Object3D, Material, Group } from "three";

import type { ViewEvents } from "..";
import type { Scenes } from "../scene";
import { applyTextureAspect } from "../texture";
import type { MeshCache, RenderFlag } from "../type";
import type { CommonUniforms } from "../uniforms";

import {
  handleFeatureCreatedEventByLayerId,
  handleFeatureUpdatedEventByLayerId,
} from "./featureEvent";
import { renderBillboard, processBillboardChanged } from "./features/billboard";
import { renderModel, processModelChanged } from "./features/model";
import { renderPoint, processPointChanged } from "./features/point";
import { renderPolygon, processPolygonChanged } from "./features/polygon";
import { renderPolyline, processPolylineChanged } from "./features/polyline";
import { renderText , processTextChanged } from "./features/text";

import type { BufferLoader, FeatureHandler } from ".";
import { setTransform } from ".";


export function renderFeature(
  f: RenderableFeature,
  buf: BufferLoader,
  uniforms: CommonUniforms,
): Promise<Mesh | Sprite | Object3D | undefined> | undefined {
  if (f.point) {
    return renderPoint(f.point, uniforms);
  }
  if (f.billboard) {
    return renderBillboard(f.billboard, uniforms);
  }
  if (f.model) {
    return renderModel(f.model, buf, uniforms);
  }
  if (f.polyline) {
    return renderPolyline(f.polyline, buf, uniforms);
  }
  if (f.polygon) {
    return renderPolygon(f.polygon, buf, uniforms);
  }
  if (f.text) {
    return renderText(f.text, uniforms);
  }
}

export async function processRenderableFeatureAdded(
  ev: RenderableFeatureAddedEvent,
  scenes: Scenes,
  meshes: MeshCache,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  drapedFeatureMaterials: Map<string, Material>,
  featureHandler: FeatureHandler,
  viewEvents: EventHandler<ViewEvents>,
) {
  const id = generate_id_from_entity(ev);
  const obj = await renderFeature(ev.feature, buf, uniforms)?.then((r) => {
    const f = ev.feature;
    const type = (() => {
      if (f.point || f.billboard || f.text) return "point";
      else if (f.model) return "model";
      else if (f.polyline) return "polyline";
      else if (f.polygon) return "polygon";
    })();
    if (type) {
      featureHandler.markFeatureIsRendered(type, ev.bits);
    }
    return r;
  });
  if (!obj) return;

  const featureLayerId = ev.layer_id;
  const { point, billboard, text, polyline, polygon, model } = ev.feature;

  const feature = point ?? billboard ?? text ?? polyline ?? polygon ?? model;
  const transform = feature?.transform;
  if (transform) {
    setTransform(obj, transform);
  }
  applyTextureAspect(obj);

  obj.renderOrder = 1;

  const material = feature?.material;
  obj.visible = (material?.show ?? true) && !!feature?.active;

  if (!obj.userData.draped) {
    scenes.main.add(obj);
  }

  meshes.set(id, obj);

  if (obj.userData.draped && obj instanceof Mesh) {
    drapedFeatureMaterials.set(id, obj.material as Material);
  }

  handleFeatureCreatedEventByLayerId(obj, viewEvents, featureLayerId);
}

// TODO: Update material in this function.
export function processRenderableFeatureChanged(
  ev: RenderableFeatureChangedEvent,
  meshes: MeshCache,
  drapedFeatureMaterials: Map<string, Material>,
  renderFlag: RenderFlag,
  viewEvents: EventHandler<ViewEvents>,
  updatedAt: number,
) {
  const id = generate_id_from_entity(ev);
  const obj = meshes.get(id);
  if (!obj) return;

  const featureLayerId = ev.layer_id;
  const { point, billboard, text, polyline, polygon, model } = ev.feature;

  const transform = (point ?? billboard ?? text ?? polyline ?? polygon ?? model)
    ?.transform;
  if (transform) {
    setTransform(obj, transform);
  }

  const material = (point ?? billboard ?? text ?? polyline ?? polygon ?? model)
    ?.material;
  const active =
    (point ?? billboard ?? text ?? polyline ?? polygon ?? model)?.active ??
    true;

  if (material) {
    if (obj instanceof Sprite && material instanceof PointMaterial) {
      processPointChanged(obj, material, active);
    }
    if (obj instanceof Sprite && material instanceof BillboardMaterial) {
      processBillboardChanged(obj, material, active);
    }
    if (obj instanceof Group && material instanceof TextMaterial) {
      processTextChanged(obj, material, active, renderFlag);
    }
    if (obj instanceof Group && material instanceof ModelMaterial) {
      processModelChanged(obj, material, active);
    }
    if (obj instanceof Mesh && material instanceof PolylineMaterial) {
      processPolylineChanged(obj, material, active);
    }
    if (obj instanceof Mesh && material instanceof PolygonMaterial) {
      processPolygonChanged(obj, material, active);
    }

    // Handle a draped mesh
    if (obj instanceof Mesh && obj.userData.draped != null) {
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
  }

  applyTextureAspect(obj);

  obj.updateMatrix();

  handleFeatureUpdatedEventByLayerId(
    obj,
    viewEvents,
    featureLayerId,
    updatedAt,
  );
}
