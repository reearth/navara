import {
  generate_id_from_entity,
  IMAGE_EXTENSIONS,
  isEntityEvent,
} from "@navara/core";
import {
  type Transform,
  type EntityEvent,
  type ObjectTransformEvent,
  type DataRequestEvent,
  type CameraFrustum,
  TextureFragmentRequestedEvent,
  TextureFragmentStatus,
  DataRequesterRemovedEvent,
  RenderableFeatureRemovedEvent,
  Events,
} from "@navara/engine";
import { radianToDegree } from "@navara/three_api";
import { canWorkerProcessImmediately } from "@navara/worker";
import { Mesh, Object3D, Sprite } from "three";

import { BatchedSdfTextMesh, Layer } from "..";
import { getImageDataFromImageBitmap } from "../tasks/getImageDataFromImageBitmap";

import { EventContext } from "./context";
import {
  checkFeatureParallel,
  processRenderableFeatureAdded,
  processRenderableFeatureChanged,
} from "./feature";
import { processHillshadeBackfilled } from "./hillshade";
import { ABORTABLE_IMAGE_LOADER, ABORTABLE_TEXTURE_LOADER } from "./loaders";
import { processMeshAdded, processMeshChanged } from "./tile";
import {
  processWorkerTaskDelegatedEvent,
  processWorkerTaskRemovedEvent,
} from "./worker";

export type {
  BufferLoader,
  TextureFragmentHandler,
  WorkerTaskHandler,
  TileHandler,
  GlobeHandler,
  FeatureHandler,
  MeshHandler,
  LayerHandler,
} from "./context";
export { EventContext } from "./context";
export { HillshadeContext } from "./HillshadeContext";
export { FetchCache } from "./FetchCache";

export function processEvent(ctx: EventContext, event: Events | undefined) {
  const {
    eventManager,
    scenes,
    meshes,
    meshHandler,
    viewEvents,
    layersManager,
    viewContext,
  } = ctx;

  eventManager.pushEvents(event);

  eventManager.forEachStack("camera_transform_updated", (ev) =>
    processCameraTransformUpdated(ctx, ev),
  );

  eventManager.forEachStack("camera_frustum_updated", (ev) =>
    processCameraFrustumUpdated(ctx, ev),
  );

  eventManager.forEachStack("object_transform_updated", (ev) =>
    processObjectTransformUpdated(ctx, ev),
  );

  eventManager.forEachStack("update_sample_terrain_height", (ev) =>
    viewEvents.emit("_sample_terrain_height_received", ev),
  );

  eventManager.forEachStack("hillshade_backfilled", (ev) =>
    processHillshadeBackfilled(ctx, ev),
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
          await processMeshAdded(ctx, event);
          meshHandler.setTileMeshPrepared(event.tile_handle);
          break;
        case "remove":
          processObjectRemoved(ctx, scenes.globe, event);
          break;
        case "change":
          processMeshChanged(ctx, event);
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
          await processWorkerTaskDelegatedEvent(ctx, event);
          break;
        case "remove":
          await processWorkerTaskRemovedEvent(ctx, event);
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
        await processWorkerTaskRemovedEvent(ctx, event);
      },
    },
  );

  eventManager.processTransactionEvents(
    "renderableFeatureEvent",
    {
      add: {
        key: "renderable_feature_added",
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
          await processRenderableFeatureAdded(ctx, event);
          break;
        case "remove":
          {
            const removed = event as RenderableFeatureRemovedEvent;
            const layer = layersManager.get(removed.layer_id);
            if (layer && layer instanceof Layer) {
              layer._unregisterFeatureEvaluator(removed.bits);
              layer.emit("featureRemoved", { featureSetId: removed.bits });
            }
            processObjectRemoved(ctx, scenes.mrt, event);
          }
          break;
        case "change":
          await processRenderableFeatureChanged(ctx, event);
          break;
      }
    },
    {
      shouldProcess: ({ type, event }) => {
        switch (type) {
          case "add":
            return (
              !checkFeatureParallel(event.feature) ||
              viewContext.concurrencyManager.canIncrement()
            );
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
          await processTextureFragmentRequested(ctx, event);
          break;
        case "remove":
          processTextureFragmentRemoved(ctx, event);
          break;
      }
    },
    {
      onAbort: (event) => {
        processTextureFragmentRemoved(ctx, event);
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
          await processRequestedData(ctx, event);
          break;
        case "remove":
          processDataRequesterRemoved(ctx, event);
          break;
      }
    },
    {
      onAbort: (event) => {
        processDataRequesterRemoved(ctx, event);
      },
    },
  );
}

function processCameraTransformUpdated(
  ctx: EventContext,
  transform: Transform | undefined,
) {
  if (!transform) return;
  setTransform(ctx.camera.raw, transform);

  ctx.camera.updateStatus();
}

function processCameraFrustumUpdated(
  ctx: EventContext,
  frustum: CameraFrustum | undefined,
) {
  if (!frustum) return;

  ctx.camera.raw.near = frustum.near;
  ctx.camera.raw.far = frustum.far;
  ctx.camera.raw.fov = radianToDegree(frustum.fov);
  ctx.camera.raw.updateProjectionMatrix();
  ctx.camera.emit("frustumChanged");
}

function processObjectTransformUpdated(
  ctx: EventContext,
  e: ObjectTransformEvent,
) {
  const id = generate_id_from_entity(e);
  const m = ctx.meshes.get(id);
  if (m) {
    setTransform(m, e.transform);
  }
}

function processObjectRemoved(
  ctx: EventContext,
  parent: Object3D,
  obj: EntityEvent,
) {
  const { meshes } = ctx;
  const id = generate_id_from_entity(obj);
  const m = meshes.get(id);
  if (!m) return;

  meshes.delete(id);

  // Sprite, Mesh, and Group are all subclasses of Object3D
  if (m instanceof Object3D) {
    disposeObject3D(m);
  }

  if (m instanceof BatchedSdfTextMesh) {
    m.dispose();
  }

  // Custom event not in Object3DEventMap
  // @ts-expect-error - removedFromWorld is a custom event
  m.dispatchEvent({ type: "removedFromWorld" });

  // clear should after dispose, otherwise model's children will not be disposed
  m.clear();

  parent.remove(m);
}

function disposeObject3D(model: Object3D): void {
  model.traverse((object: Object3D) => {
    if (object instanceof Mesh) {
      const mesh = object as Mesh;

      // Dispose geometry and aggressively drop all attributes
      const g = mesh.geometry;
      if (g) {
        g.dispose?.();

        // Remove every BufferAttribute (handles polyline/polygon custom attrs)
        if (g.attributes) {
          for (const key of Object.keys(g.attributes)) {
            g.deleteAttribute(key);
          }
        }

        g.index = null;
        g.boundingBox = null;
        g.boundingSphere = null;
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
    // point, billboard, text
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

function getOrCreateAbortController(
  abortControllers: Map<string, AbortController>,
  id: string,
): AbortController {
  const existing = abortControllers.get(id);
  if (existing) {
    return existing;
  }

  const controller = new AbortController();
  abortControllers.set(id, controller);
  return controller;
}

async function fetchImageAsUint8Array(
  ctx: EventContext,
  req: DataRequestEvent,
  id: string,
  abortController: AbortController,
): Promise<void> {
  const { buf, workerPoolPromises } = ctx;

  const img = await ABORTABLE_IMAGE_LOADER.loadAsyncWithAbort(
    req.url,
    abortController,
  );

  // TODO: Get OffScreenCanvas from main thread in worker.
  const canvas = document.createElement("canvas");
  canvas.height = img.height;
  canvas.width = img.width;

  const promise = getImageDataFromImageBitmap(
    await createImageBitmap(img),
    canvas.transferControlToOffscreen(),
  );

  workerPoolPromises.set(id, promise);

  try {
    const data = await promise;

    if (abortController.signal.aborted) {
      return;
    }

    let u8a: Uint8Array | null = new Uint8Array(data);
    buf.setU8(req.handle, req.bits, u8a);

    // Prevent memory leak
    u8a.set([]);
    u8a = null;
    data.set([]);
  } finally {
    workerPoolPromises.delete(id);
    img.remove();
    canvas.remove();
  }
}

async function fetchDataAsArrayBuffer(
  buf: EventContext["buf"],
  req: DataRequestEvent,
  abortController: AbortController,
): Promise<void> {
  const res = await fetch(req.url, { signal: abortController.signal });
  if (!res.ok) throw new Error();

  const val = await res.arrayBuffer();
  if (abortController.signal.aborted) {
    return;
  }

  const bytes = new Uint8Array(val);
  buf.setU8(req.handle, req.bits, bytes);

  // Prevent memory leak
  bytes.set([]);
}

async function performDataFetch(
  ctx: EventContext,
  req: DataRequestEvent,
  id: string,
  abortController: AbortController,
): Promise<void> {
  const { buf, abortControllers } = ctx;

  try {
    if (req.url === "https://tiles.mapterhorn.com/11/2013/1266.webp") {
      console.log("req 11/2013/1266");
    }
    if (IMAGE_EXTENSIONS.includes(req.extension)) {
      await fetchImageAsUint8Array(ctx, req, id, abortController);
    } else {
      await fetchDataAsArrayBuffer(buf, req, abortController);
    }
  } catch {
    // Fetch failed - data will not be written to buffer
    // Caller will detect empty buffer and trigger failure event
  } finally {
    abortControllers.delete(id);
  }
}

// TODO: Need to check if the cached texture is removed completely
async function processRequestedData(ctx: EventContext, req: DataRequestEvent) {
  const { buf, abortControllers, fetchCache } = ctx;
  const id = generate_id_from_entity(req);

  // Check if data already exists in shared handle (Rust-side deduplication)
  const dataExistedBefore = !!buf.u8(req.handle);
  if (dataExistedBefore) {
    // Data already loaded by another consumer, notify this consumer
    buf.triggerDataRequesterLoaded(req.bits, req.handle);
    return;
  }

  // Define fetch operation (only executed by first requester via FetchCache)
  const performFetch = async () => {
    const abortController = getOrCreateAbortController(abortControllers, id);
    await performDataFetch(ctx, req, id, abortController);
  };

  // All requesters queue through FetchCache to avoid microtask race conditions
  // Previously: isPending() check could race with Promise completion/deletion
  // Now: getOrCreateFetchPromise() atomically handles both new and pending requests
  if (fetchCache) {
    await fetchCache.getOrCreateFetchPromise(req.url, performFetch);
  } else {
    await performFetch();
  }

  // Only notify on failure
  // Success case: buf.setU8() already notified the requester during fetch
  // No need to notify again to avoid duplicate notifications
  if (!buf.u8(req.handle)) {
    buf.triggerDataRequesterFailed(req.bits);
  }
}

function processDataRequesterRemoved(
  ctx: EventContext,
  req: DataRequesterRemovedEvent,
) {
  const { abortControllers, workerPoolPromises, loadedTexs, hillshadeContext } =
    ctx;
  const id = generate_id_from_entity(req);
  const abortController = abortControllers.get(id);
  const workerPool = workerPoolPromises.get(id);

  // Clean up hillshade resources first (if applicable)
  // For hillshade entities, clearRenderTarget will dispose the RenderTarget and its texture
  if (hillshadeContext) {
    hillshadeContext.pendingEdges.delete(id);
    hillshadeContext.clearTempDem(id);
    hillshadeContext.clearRenderTarget(id);
  }

  // Dispose and remove texture from loadedTexs
  // For hillshade entities, texture is already disposed by clearRenderTarget above
  // Check isRenderTargetTexture to avoid double-dispose
  if (loadedTexs) {
    const texture = loadedTexs.get(id);
    if (texture && !texture.isRenderTargetTexture) {
      texture.dispose();
    }
    loadedTexs.delete(id);
  }

  // Note: Do NOT call buf.remove(req.handle) here!
  // The handle is shared among multiple consumers (via Rust DataManager)
  // Rust side manages the lifecycle and will remove data when ref count reaches 0

  abortController?.abort();
  workerPool?.cancel();

  abortControllers.delete(id);
  workerPoolPromises.delete(id);
}

async function processTextureFragmentRequested(
  ctx: EventContext,
  req: TextureFragmentRequestedEvent,
) {
  const { texFragment, loadedTexs, abortControllers } = ctx;
  const id = generate_id_from_entity(req);
  if (loadedTexs.has(id)) return;

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

  await ABORTABLE_TEXTURE_LOADER.loadAsyncWithAbort(req.url, abortController)
    .then((t) => {
      loadedTexs.set(id, t);
      texFragment.triggerTextureFragmentLoaded(
        req.bits,
        TextureFragmentStatus.Success,
      );
    })
    .catch(() => {
      texFragment.triggerTextureFragmentLoaded(
        req.bits,
        TextureFragmentStatus.Fail,
      );
    })
    .finally(() => {
      abortControllers.delete(id);
    });
}

function processTextureFragmentRemoved(ctx: EventContext, req: EntityEvent) {
  const { loadedTexs, abortControllers, hillshadeContext } = ctx;
  const id = generate_id_from_entity(req);
  const abortController = abortControllers.get(id);

  // Clean up hillshade resources first (if applicable)
  // For hillshade entities, clearRenderTarget will dispose the RenderTarget and its texture
  if (hillshadeContext) {
    hillshadeContext.pendingEdges.delete(id);
    hillshadeContext.clearTempDem(id);
    hillshadeContext.clearRenderTarget(id);
  }

  // Dispose and remove texture from loadedTexs
  // For hillshade entities, texture is already disposed by clearRenderTarget above
  // Check isRenderTargetTexture to avoid double-dispose
  const texture = loadedTexs.get(id);
  if (texture && !texture.isRenderTargetTexture) {
    texture.dispose();
  }
  loadedTexs.delete(id);

  abortController?.abort();
}

export function setTransform(
  obj: Object3D,
  transform: Transform,
  keepPosition?: boolean,
) {
  const { tx, ty, tz, qx, qy, qz, qw, sx, sy, sz } = transform;
  if (!keepPosition) {
    obj.position.set(tx, ty, tz);
  }
  obj.quaternion.set(qx, qy, qz, qw);
  obj.scale.set(sx, sy, sz);
}
