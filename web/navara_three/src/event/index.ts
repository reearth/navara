import type { EventHandler, EventManager } from "@navara/core";
import {
  generate_id_from_entity,
  IMAGE_EXTENSIONS,
  isEntityEvent,
} from "@navara/core";
import {
  type Events,
  type Transform,
  type EntityEvent,
  type ObjectTransformEvent,
  type DataRequestEvent,
  type CameraFrustum,
  TextureFragmentRequestedEvent,
  TextureFragmentStatus,
  DataRequesterRemovedEvent,
  DelegatedWorkerTasksResult,
  TransferableTile,
  TransferableMartini,
  ReconstructableEntity,
  ElevationDecoder,
  ReturnedTransferablePolygonBatchedFeature,
  ReturnedTransferablePolylineBatchedFeature,
  RenderableFeatureRemovedEvent,
  VectorTileState,
} from "@navara/engine";
import { canWorkerProcessImmediately } from "@navara/worker";
import { Mesh, Material, Object3D, Texture, Sprite } from "three";

import { type ViewEvents } from "..";
import { ThreeViewCamera } from "../camera";
import { FEATURE_CONCURRENCY } from "../concurrency";
import type { LayersManager } from "../layersManager";
import type { AbortableTextureLoader } from "../loaders/AbortableTextureLoader";
import type { Scenes, TexturizedSceneByTileCoordinates } from "../scene";
import { getImageDataFromImageBitmap } from "../tasks/getImageDataFromImageBitmap";
import type { TextureOptions } from "../textures";
import type {
  AbortControllers,
  MeshCache,
  WorkerPoolPromises,
  RenderFlag,
  TileMapByHandle,
} from "../type";
import type { CommonUniforms } from "../uniforms";

import {
  processRenderableFeatureAdded,
  processRenderableFeatureChanged,
} from "./feature";
import { ABORTABLE_IMAGE_LOADER, ABORTABLE_TEXTURE_LOADER } from "./loaders";
import { processMeshAdded, processMeshChanged } from "./tile";
import {
  processWorkerTaskDelegatedEvent,
  processWorkerTaskRemovedEvent,
} from "./worker";

import { radianToDegree } from "@navara/three_api";

export type BufferLoader = {
  u8: (handle: number) => Uint8Array | null;
  f32: (handle: number) => Float32Array | null;
  u32: (handle: number) => Uint32Array | null;
  removeU8: (handle: number) => Uint8Array | null;
  removeF32: (handle: number) => Float32Array | null;
  removeU32: (handle: number) => Uint32Array | null;
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
  getVectorTileStates: (handle: bigint) => VectorTileState[] | undefined;
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
  readPropertiesFromFeature(
    bits: bigint,
    callback: (batchId: number, properties?: Map<string, unknown>) => void,
  ): void;
};

export type MeshHandler = {
  setTileMeshPrepared: (handle: bigint) => void;
};

// This is used to count concurrency while adding RenderableFeature to avoid occupying a worker process.
let RENDERABLE_FEATURE_CONCURRENCY = 0;

export function processEvent(
  eventManager: EventManager,
  scenes: Scenes,
  camera: ThreeViewCamera,
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
  texturizedSceneByTileCoordinates: TexturizedSceneByTileCoordinates,
  tileMapByHandle: TileMapByHandle,
  textureOptions: TextureOptions,
  renderFlag: RenderFlag,
  viewEvents: EventHandler<ViewEvents>,
  layersManager: LayersManager,
  updatedAt: number,
) {
  eventManager.pushEvents(event);

  eventManager.forEachStack("camera_transform_updated", (ev) =>
    processCameraTransformUpdated(camera, ev),
  );

  eventManager.forEachStack("camera_frustum_updated", (ev) =>
    processCameraFrustumUpdated(camera, ev),
  );

  eventManager.forEachStack("object_transform_updated", (ev) =>
    processObjectTransformUpdated(meshes, ev),
  );

  eventManager.forEachStack("update_sample_terrain_height", (ev) =>
    viewEvents.emit("_sample_terrain_height_received", ev),
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
            tileHandler,
            loadedTexs,
            textureOptions,
            texturizedSceneByTileCoordinates,
            tileMapByHandle,
          );
          meshHandler.setTileMeshPrepared(event.tile_handle);
          break;
        case "remove":
          processObjectRemoved(scenes.globe, meshes, event);
          break;
        case "change":
          processMeshChanged(
            meshes,
            event,
            loadedTexs,
            textureOptions,
            tileMapByHandle,
          );
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
            texturizedSceneByTileCoordinates,
            featureHandler,
            viewEvents,
            layersManager,
            updatedAt,
            (v) => (RENDERABLE_FEATURE_CONCURRENCY += v),
          );
          break;
        case "remove":
          {
            const removed = event as RenderableFeatureRemovedEvent;
            layersManager
              .get(removed.layer_id)
              ?._unregisterFeatureEvaluator(removed.bits);

            processObjectRemoved(scenes.mrt, meshes, event);
          }
          break;
        case "change":
          await processRenderableFeatureChanged(
            event,
            meshes,
            drapedFeatureMaterials,
            texturizedSceneByTileCoordinates,
            renderFlag,
            buf,
          );
          break;
      }
    },
    {
      shouldProcess: ({ type, event }) => {
        switch (type) {
          case "add":
            return RENDERABLE_FEATURE_CONCURRENCY < FEATURE_CONCURRENCY;
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
  camera: ThreeViewCamera,
  transform: Transform | undefined,
) {
  if (!transform) return;
  setTransform(camera.innerCam, transform);

  camera.updateStatus();
}

function processCameraFrustumUpdated(
  camera: ThreeViewCamera,
  frustum: CameraFrustum | undefined,
) {
  if (!frustum) return;

  camera.innerCam.near = frustum.near;
  camera.innerCam.far = frustum.far;
  camera.innerCam.fov = radianToDegree(frustum.fov);
  camera.innerCam.updateProjectionMatrix();
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
) {
  const id = generate_id_from_entity(obj);
  const m = meshes.get(id);
  if (!m) return;

  meshes.delete(id);

  // Sprite, Mesh, and Group are all subclasses of Object3D
  if (m instanceof Object3D) {
    disposeObject3D(m);
  }

  m.dispatchEvent({ type: "removedFromWorld" } as any);

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
