import type { EventManager } from "@navara/core";
import {
  generate_id_from_entity,
  IMAGE_EXTENSIONS,
  isEntityEvent,
  to_globe_gbuffer_id,
  to_globe_id,
} from "@navara/core";
import {
  type Events,
  type Transform,
  type EntityEvent,
  type ObjectTransformEvent,
  type DataRequestEvent,
  type RenderableFeatureAddedEvent,
  TextureFragmentRequestedEvent,
  TextureFragmentStatus,
  RenderableFeatureChangedEvent,
  PointMaterial,
  BillboardMaterial,
  ModelMaterial,
  PolylineMaterial,
  PolygonMaterial,
  DataRequesterRemovedEvent,
  DelegatedWorkerTasksResult,
  TransferableTile,
  TransferableMartini,
  ReconstructableEntity,
  ElevationDecoder,
  ReturnedTransferablePolygonBatchedFeature,
  ReturnedTransferablePolylineBatchedFeature,
} from "@navara/engine";
import { canWorkerProcessImmediately } from "@navara/worker";
import {
  type Camera,
  Mesh,
  Material,
  MeshLambertMaterial,
  Object3D,
  Texture,
  Sprite,
  Group,
  ShaderMaterial,
} from "three";

import { FEATURE_CONCURRENCY } from "../concurrency";
import type { AbortableTextureLoader } from "../loaders/AbortableTextureLoader";
import type { Scenes } from "../scene";
import { getImageDataFromImageBitmap } from "../tasks/getImageDataFromImageBitmap";
import { applyTextureAspect } from "../texture";
import type { TextureOptions } from "../textures";
import type { AbortControllers, MeshCache, WorkerPoolPromises } from "../type";
import type { CommonUniforms } from "../uniforms";

import { renderFeature } from "./feature";
import { ABORTABLE_IMAGE_LOADER, ABORTABLE_TEXTURE_LOADER } from "./loaders";
import { processMeshAdded, processMeshChanged } from "./tile";
import {
  processWorkerTaskDelegatedEvent,
  processWorkerTaskRemovedEvent,
} from "./worker";

export type BufferLoader = {
  u8: (handle: number) => Uint8Array | null;
  f32: (handle: number) => Float32Array | null;
  u32: (handle: number) => Uint32Array | null;
  setU8: (handle: number, bits: bigint, bytes: Uint8Array) => void;
  newU8: (bytes: Uint8Array) => number | undefined;
  newU32: (bytes: Uint32Array) => number | undefined;
  newF32: (bytes: Float32Array) => number | undefined;
  remove: (handle: number) => void;
  triggerDataRequesterFailed: (bits: bigint) => void;
};

export type TextureFragmentHandler = {
  triggerTextureFragmentLoaded: (
    bits: bigint,
    status: TextureFragmentStatus,
  ) => void;
};

export type WorkerTaskHandler = {
  triggerWorkerTaskCompleted: (
    bits: bigint,
    result: DelegatedWorkerTasksResult,
  ) => void;
  hasWorkerTask: (bits: bigint) => boolean;
};

export type TileHandler = {
  getMartini: (bits: ReconstructableEntity) => TransferableMartini | undefined;
  getTile: (handle: bigint) => TransferableTile | undefined;
  getParentTile: (handle: bigint) => TransferableTile | undefined;
  getTileElevationDecoder: (handle: bigint) => ElevationDecoder | undefined;
};

export type FeatureHandler = {
  getTransferablePolygonBatchedFeature: (
    bits: bigint,
  ) => ReturnedTransferablePolygonBatchedFeature | undefined;
  getTransferablePolylineBatchedFeature: (
    bits: bigint,
  ) => ReturnedTransferablePolylineBatchedFeature | undefined;
  markFeatureIsRendered: (
    type: "point" | "polyline" | "polygon" | "model",
    bits: bigint,
  ) => void;
};

export type MeshHandler = {
  setTileMeshPrepared: (handle: bigint) => void;
};

export function processEvent(
  eventManager: EventManager,
  scenes: Scenes,
  camera: Camera,
  meshes: MeshCache,
  abortControllers: AbortControllers,
  buf: BufferLoader,
  texFragment: TextureFragmentHandler,
  tileHandler: TileHandler,
  workerTaskHandler: WorkerTaskHandler,
  meshHandler: MeshHandler,
  featureHandler: FeatureHandler,
  loadedTexs: Map<string, Texture>,
  workerPoolPromises: WorkerPoolPromises,
  event: Events | undefined,
  uniforms: CommonUniforms,
  drapedFeatureMaterials: Map<string, Material>,
  textureOptions: TextureOptions,
) {
  eventManager.pushEvents(event);

  eventManager.forEachStack("camera_transform_updated", (ev) =>
    processCameraTransformUpdated(camera, ev),
  );

  eventManager.forEachStack("object_transform_updated", (ev) =>
    processObjectTransformUpdated(meshes, ev),
  );

  eventManager.processTransactionEvents(
    "meshEvent",
    {
      add: {
        key: "mesh_added",
      },
      remove: {
        key: "mesh_removed",
        // This process is not heavy for now, so we can process it infinitely.
        max: Infinity,
      },
      change: {
        key: "mesh_updated",
        // This process is not heavy for now, so we can process it infinitely.
        max: Infinity,
      },
    },
    async ({ type, event }) => {
      switch (type) {
        case "add":
          await processMeshAdded(
            scenes,
            meshes,
            event,
            buf,
            loadedTexs,
            textureOptions,
          );
          meshHandler.setTileMeshPrepared(event.tile_handle);
          break;
        case "remove":
          processObjectRemoved(scenes.globe, meshes, event, to_globe_id);
          processObjectRemoved(
            scenes.globeGBuffer,
            meshes,
            event,
            to_globe_gbuffer_id,
          );
          break;
        case "change":
          processMeshChanged(meshes, event);
          break;
      }
    },
    {
      shouldProcess: ({ type }) => {
        switch (type) {
          case "add":
            return canWorkerProcessImmediately();
          case "remove":
            return true;
          case "change":
            return true;
        }
      },
    },
  );

  eventManager.processTransactionEvents(
    "workerTaskEvent",
    {
      add: {
        key: "worker_task_delegated",
      },
      remove: {
        key: "worker_task_removed",
        max: Infinity,
      },
    },
    async ({ type, event }) => {
      switch (type) {
        case "add":
          await processWorkerTaskDelegatedEvent(
            event,
            buf,
            tileHandler,
            featureHandler,
            workerTaskHandler,
            workerPoolPromises,
          );
          break;
        case "remove":
          await processWorkerTaskRemovedEvent(event, workerPoolPromises);
          break;
      }
    },
    {
      shouldProcess: ({ type }) => {
        switch (type) {
          case "add":
            return canWorkerProcessImmediately();
          case "remove":
            return true;
          case "change":
            return true;
        }
      },
      onAbort: async (event) => {
        await processWorkerTaskRemovedEvent(event, workerPoolPromises);
      },
    },
  );

  eventManager.processTransactionEvents(
    "renderableFeatureEvent",
    {
      add: {
        key: "renderable_feature_added",
        max: FEATURE_CONCURRENCY,
      },
      remove: {
        key: "renderable_feature_removed",
        // This process is not heavy for now, so we can process it infinitely.
        max: Infinity,
      },
      change: {
        key: "renderable_feature_changed",
        // This process is not heavy for now, so we can process it infinitely.
        max: Infinity,
      },
    },
    async ({ type, event }) => {
      switch (type) {
        case "add":
          await processRenderableFeatureAdded(
            event,
            scenes,
            meshes,
            buf,
            uniforms,
            drapedFeatureMaterials,
            featureHandler,
          );
          break;
        case "remove":
          {
            processObjectRemoved(
              scenes.main,
              meshes,
              event,
              undefined,
              drapedFeatureMaterials,
            );
          }
          break;
        case "change":
          processRenderableFeatureChanged(
            event,
            meshes,
            drapedFeatureMaterials,
          );
          break;
      }
    },
    {
      shouldProcess: ({ type, event }) => {
        switch (type) {
          case "add":
            return true;
          case "remove":
            return true;
          case "change":
            if (isEntityEvent(event)) {
              const id = generate_id_from_entity(event);
              return meshes.has(id);
            }
            return true;
        }
      },
    },
  );

  eventManager.processTransactionEvents(
    "textureFragmentEvent",
    {
      add: {
        key: "texture_fragment_requested",
      },
      remove: {
        key: "texture_fragment_removed",
        // This process is not heavy for now, so we can process it infinitely.
        max: Infinity,
      },
    },
    async ({ type, event }) => {
      switch (type) {
        case "add":
          await processTextureFragmentRequested(
            event,
            texFragment,
            ABORTABLE_TEXTURE_LOADER,
            loadedTexs,
            abortControllers,
          );
          break;
        case "remove":
          processTextureFragmentRemoved(event, loadedTexs, abortControllers);
          break;
      }
    },
    {
      onAbort: (event) => {
        processTextureFragmentRemoved(event, loadedTexs, abortControllers);
      },
    },
  );

  eventManager.processTransactionEvents(
    "dataRequesterEvent",
    {
      add: {
        key: "data_requested",
      },
      remove: {
        key: "data_requester_removed",
        // This process is not heavy for now, so we can process it infinitely.
        max: Infinity,
      },
    },
    async ({ type, event }) => {
      switch (type) {
        case "add":
          await processRequestedData(event, buf, abortControllers);
          break;
        case "remove":
          processDataRequesterRemoved(event, buf, abortControllers);
          break;
      }
    },
    {
      shouldProcess: ({ type }) => {
        switch (type) {
          case "add":
            return canWorkerProcessImmediately();
          default:
            return true;
        }
      },
      onAbort: (event) => {
        processDataRequesterRemoved(event, buf, abortControllers);
      },
    },
  );
}

function processCameraTransformUpdated(
  camera: Camera,
  transform: Transform | undefined,
) {
  if (!transform) return;
  setTransform(camera, transform); // disable temporarily
}

function processObjectTransformUpdated(
  meshes: MeshCache,
  e: ObjectTransformEvent,
) {
  const id = generate_id_from_entity(e);
  const m = meshes.get(id);
  if (m) {
    setTransform(m, e.transform);
  }
}

function processObjectRemoved(
  parent: Object3D,
  meshes: MeshCache,
  obj: EntityEvent,
  wrapId?: (id: string) => string,
  drapedFeatureMaterials?: Map<string, Material>,
) {
  let id = generate_id_from_entity(obj);
  if (wrapId) {
    id = wrapId(id);
  }
  if (drapedFeatureMaterials) {
    drapedFeatureMaterials.delete(id);
  }
  const m = meshes.get(id);
  if (!m) return;

  meshes.delete(id);

  // Sprite, Mesh, and Group are all subclasses of Object3D
  if (m instanceof Object3D) {
    disposeObject3D(m);
  }

  // clear should after dispose, otherwise model's children will not be disposed
  m.clear();

  parent.remove(m);
}

function disposeObject3D(model: Object3D): void {
  model.traverse((object: Object3D) => {
    // model, polyline, polygon
    if (object instanceof Mesh) {
      const mesh = object as Mesh;

      // Dispose geometry
      if (mesh.geometry) {
        mesh.geometry.dispose();
        // Prevent GC overhead
        mesh.geometry.deleteAttribute("position");
        mesh.geometry.deleteAttribute("uv");
        mesh.geometry.deleteAttribute("normal");
        mesh.geometry.index = null;
      }

      // Dispose material(s)
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => {
            material.dispose();
          });
        } else {
          const material = mesh.material;
          material.dispose();
        }
      }
    }
    // point, billboard
    else if (object instanceof Sprite) {
      const sprite = object as Sprite;

      // Dispose material
      if (sprite.material) {
        if (Array.isArray(sprite.material)) {
          sprite.material.forEach((material) => {
            material.dispose();
          });
        } else {
          const material = sprite.material;
          material.dispose();
        }
      }
    }
  });
}

// TODO: Need to check if the cached texture is removed completely
async function processRequestedData(
  req: DataRequestEvent,
  buf: BufferLoader,
  abortControllers: AbortControllers,
) {
  const id = generate_id_from_entity(req);

  const abortController = (() => {
    const a = abortControllers.get(id);
    if (a) {
      return a;
    } else {
      const a = new AbortController();
      abortControllers.set(id, a);
      return a;
    }
  })();

  if (IMAGE_EXTENSIONS.includes(req.extension)) {
    await ABORTABLE_IMAGE_LOADER.loadAsyncWithAbort(req.url, abortController)
      .then(async (img) => {
        // TODO: Get OffScreeCanvas from main thread in worker.
        const canvas = document.createElement("canvas");
        canvas.height = img.height;
        canvas.width = img.width;
        const data = await getImageDataFromImageBitmap(
          await createImageBitmap(img),
          canvas.transferControlToOffscreen(),
        );

        if (abortController.signal.aborted) {
          return;
        }

        let u8a: Uint8Array | null = new Uint8Array(data);
        buf.setU8(req.handle, req.bits, u8a);

        // Prevent memory leak
        u8a.set([]);
        u8a = null;

        data.set([]);

        img.remove();
        canvas.remove();
      })
      .catch(() => {
        buf.triggerDataRequesterFailed(req.bits);
      })
      .finally(() => {
        abortControllers.delete(id);
      });
    return;
  }

  // TODO: Handle abort
  await fetch(req.url, { signal: abortController.signal })
    .then((res) => {
      if (!res.ok) throw new Error();
      return res.arrayBuffer();
    })
    .then((val) => {
      if (abortController.signal.aborted) {
        return;
      }

      const bytes = new Uint8Array(val);
      buf.setU8(req.handle, req.bits, bytes);

      // Prevent memory leak
      bytes.set([]);
    })
    .catch(() => {
      buf.triggerDataRequesterFailed(req.bits);
    })
    .finally(() => {
      abortControllers.delete(id);
    });
}

function processDataRequesterRemoved(
  req: DataRequesterRemovedEvent,
  buf: BufferLoader,
  abortControllers: AbortControllers,
) {
  const id = generate_id_from_entity(req);
  const abortController = abortControllers.get(id);
  buf.remove(req.handle);
  abortController?.abort();
}

async function processTextureFragmentRequested(
  req: TextureFragmentRequestedEvent,
  handler: TextureFragmentHandler,
  tex: AbortableTextureLoader,
  loadedTexes: Map<string, Texture>,
  abortControllers: AbortControllers,
) {
  const id = generate_id_from_entity(req);
  if (loadedTexes.has(id)) return;

  const abortController = (() => {
    const a = abortControllers.get(id);
    if (a) {
      return a;
    } else {
      const a = new AbortController();
      abortControllers.set(id, a);
      return a;
    }
  })();

  await tex
    .loadAsyncWithAbort(req.url, abortController)
    .then((t) => {
      loadedTexes.set(id, t);
      handler.triggerTextureFragmentLoaded(
        req.bits,
        TextureFragmentStatus.Success,
      );
    })
    .catch(() => {
      handler.triggerTextureFragmentLoaded(
        req.bits,
        TextureFragmentStatus.Fail,
      );
    })
    .finally(() => {
      abortControllers.delete(id);
    });
}

function processTextureFragmentRemoved(
  req: EntityEvent,
  loadedTexes: Map<string, Texture>,
  abortControllers: AbortControllers,
) {
  const id = generate_id_from_entity(req);
  const abortController = abortControllers.get(id);
  loadedTexes.get(id)?.dispose();
  loadedTexes.delete(id);
  abortController?.abort();
}

async function processRenderableFeatureAdded(
  ev: RenderableFeatureAddedEvent,
  scenes: Scenes,
  meshes: MeshCache,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  drapedFeatureMaterials: Map<string, Material>,
  featureHandler: FeatureHandler,
) {
  const id = generate_id_from_entity(ev);
  const obj = await renderFeature(ev.feature, buf, uniforms)?.then((r) => {
    const f = ev.feature;
    const type = (() => {
      if (f.point || f.billboard) return "point";
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

  const { point, billboard, polyline, polygon, model } = ev.feature;

  const feature = point ?? billboard ?? polyline ?? polygon ?? model;
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
}

// TODO: Update material in this function.
function processRenderableFeatureChanged(
  ev: RenderableFeatureChangedEvent,
  meshes: MeshCache,
  drapedFeatureMaterials: Map<string, Material>,
) {
  const id = generate_id_from_entity(ev);
  const obj = meshes.get(id);
  if (!obj) return;

  const { point, billboard, polyline, polygon, model } = ev.feature;

  const transform = (point ?? billboard ?? polyline ?? polygon ?? model)
    ?.transform;
  if (transform) {
    setTransform(obj, transform);
  }

  const material = (point ?? billboard ?? polyline ?? polygon ?? model)
    ?.material;
  const active =
    (point ?? billboard ?? polyline ?? polygon ?? model)?.active ?? true;

  if (material) {
    if (obj instanceof Sprite && material instanceof PointMaterial) {
      processPointChanged(obj, material, active);
    }
    if (obj instanceof Sprite && material instanceof BillboardMaterial) {
      processBillboardChanged(obj, material, active);
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
}

function processPointChanged(
  obj: Sprite,
  material: PointMaterial,
  active: boolean,
) {
  obj.userData.orgColor = material.color;
  if (!obj.userData.isPicked) {
    obj.material.color.set(material.color ?? 0);
  }
  obj.visible = (material.show ?? true) && active;

  obj.material.sizeAttenuation = !material.scale_by_distance;
  obj.material.needsUpdate = true;
}

function processBillboardChanged(
  obj: Sprite,
  material: BillboardMaterial,
  active: boolean,
) {
  obj.userData.orgColor = material.color;
  if (!obj.userData.isPicked) {
    obj.material.color.set(material.color ?? 0);
  }
  obj.visible = (material.show ?? true) && active;

  obj.material.sizeAttenuation = !material.scale_by_distance;
  obj.material.needsUpdate = true;
}

function processModelChanged(
  obj: Group,
  material: ModelMaterial,
  active: boolean,
) {
  obj.visible = (material.show ?? true) && active;
}

function processPolylineChanged(
  obj: Mesh,
  material: PolylineMaterial,
  active: boolean,
) {
  if (obj.material instanceof ShaderMaterial) {
    obj.material.uniforms.color.value.set(material.color);

    const [minHeight, maxHeight] = material.__internal__?.min_max_heights ?? [
      0, 0,
    ];
    obj.material.uniforms.minMaxHeightAndWidth.value = [
      minHeight,
      maxHeight,
      material.width,
    ];
    obj.visible = (material.show ?? true) && active;
  }
}

function processPolygonChanged(
  obj: Mesh,
  material: PolygonMaterial,
  active: boolean,
) {
  if (obj.material instanceof MeshLambertMaterial) {
    obj.material.color.set(material.color ?? 0);
    obj.visible = (material.show ?? true) && active;
    obj.material.wireframe = material.wireframe ?? false;
    obj.material.userData.uMinMaxHeight.value =
      material.__internal__?.min_max_heights;
    if (
      obj.material.userData.uClampToGround.value !== material.clamp_to_ground
    ) {
      obj.material.userData.uClampToGround.value = material.clamp_to_ground;
      // obj.material = obj.material.clone();
    }
    obj.userData.draped = material.clamp_to_ground;
  }
}

function setTransform(obj: Object3D, transform: Transform) {
  const { tx, ty, tz, qx, qy, qz, qw, sx, sy, sz } = transform;
  obj.position.set(tx, ty, tz);
  obj.quaternion.set(qx, qy, qz, qw);
  obj.scale.set(sx, sy, sz);
}
