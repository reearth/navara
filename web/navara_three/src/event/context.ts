import type {
  Color as CoreColor,
  ColorMap,
  EventHandler,
  EventManager,
} from "@navara/core";
import type {
  DelegatedWorkerTasksResult,
  ElevationDecoder,
  ReconstructableEntity,
  ReturnedTransferablePolygonBatchedFeature,
  ReturnedTransferablePolylineBatchedFeature,
  TextureFragmentStatus,
  TransferableMartini,
  TransferableTile,
  VectorTileState,
} from "@navara/engine";
import type { FontManager } from "@navara/font";
import type { Texture } from "three";

import type { ViewEvents } from "..";
import type { ThreeViewCamera } from "../camera";
import type { ViewContext } from "../core";
import type { LayersManager } from "../layersManager";
import type { TileMesh } from "../mesh/tile";
import type { Scenes, TexturizedSceneByTileCoordinates } from "../scene";
import type { TextureOptions } from "../textures";
import type {
  AbortControllers,
  MeshCache,
  WorkerPoolPromises,
  RenderFlag,
  TileMapByHandle,
} from "../type";
import type { CommonUniforms } from "../uniforms";
import type { TextureSlot } from "../utils";

import type { HillshadeContext } from "./HillshadeContext";

export type BufferLoader = {
  u8: (handle: number) => Uint8Array | null;
  f32: (handle: number) => Float32Array | null;
  f64: (handle: number) => Float64Array | null;
  u32: (handle: number) => Uint32Array | null;
  removeU8: (handle: number) => Uint8Array | null;
  removeF32: (handle: number) => Float32Array | null;
  removeF64: (handle: number) => Float64Array | null;
  removeU32: (handle: number) => Uint32Array | null;
  setU8: (handle: number, bits: bigint, bytes: Uint8Array) => void;
  newU8: (bytes: Uint8Array) => number | undefined;
  newU32: (bytes: Uint32Array) => number | undefined;
  newF32: (bytes: Float32Array) => number | undefined;
  newF64: (bytes: Float64Array) => number | undefined;
  remove: (handle: number) => void;
  triggerDataRequesterLoaded: (bits: bigint, handle: number) => void;
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
  calcMetersPerTexel: (
    tileHandle: bigint,
    textureZoom: number,
    textureWidth: number,
  ) => number;
};

/**
 * Handler for accessing individual Globe properties from WASM.
 * This provides a reference-based interface instead of copying the entire Globe object.
 */
export type GlobeHandler = {
  getTransparent: () => boolean | undefined;
  getMaxSse: () => number | undefined;
  getSegments: () => number | undefined;
  getColor: () => CoreColor | undefined;
  getHideUnderground: () => boolean | undefined;
  getUseNormal: () => boolean | undefined;
  getOpacity: () => number | undefined;
  getWireframe: () => boolean | undefined;
  getElevationColormap: () => Float32Array | undefined;
  setTransparent: (value: boolean) => void;
  setMaxSse: (value: number) => void;
  setSegments: (value: number) => void;
  setColor: (value: CoreColor) => void;
  setHideUnderground: (value: boolean) => void;
  setUseNormal: (value: boolean) => void;
  setOpacity: (value: number) => void;
  setWireframe: (value: boolean) => void;
  setElevationColormap: (value: ColorMap) => void;
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
  readAllBatchedProperties(
    bits: bigint,
    callback: (
      batchIdx: number,
      batchId: number,
      properties?: Record<string, unknown>,
    ) => void,
  ): void;
  readFilteredBatchedProperties(
    bits: bigint,
    keys: string[],
    callback: (batchIdx: number, batchId: number, filtered?: unknown[]) => void,
  ): void;
};

export type MeshHandler = {
  setTileMeshPrepared: (handle: bigint) => void;
};

export type LayerHandler = {
  getLayerIndex: (layerId: string) => number | undefined;
};

type EventContextArgs = {
  eventManager: EventManager;
  scenes: Scenes;
  camera: ThreeViewCamera;
  meshes: MeshCache;
  abortControllers: AbortControllers;
  buf: BufferLoader;
  texFragment: TextureFragmentHandler;
  tileHandler: TileHandler;
  workerTaskHandler: WorkerTaskHandler;
  meshHandler: MeshHandler;
  featureHandler: FeatureHandler;
  loadedTexs: Map<string, Texture>;
  workerPoolPromises: WorkerPoolPromises;
  uniforms: CommonUniforms;
  texturizedSceneByTileCoordinates: TexturizedSceneByTileCoordinates;
  tileMapByHandle: TileMapByHandle;
  textureOptions: TextureOptions;
  renderFlag: RenderFlag;
  viewEvents: EventHandler<ViewEvents>;
  layersManager: LayersManager;
  viewContext: ViewContext;
  layerHandler?: LayerHandler;
  fontManager?: FontManager;
  textureFragmentIndex?: Map<string, Set<TextureSlot>>;
  tileMeshToFragmentIds?: Map<TileMesh, Set<string>>;
  hillshadeContext?: HillshadeContext;
};

/**
 * EventContext bundles all the shared state needed to process engine events
 * and propagate them into each processor.
 */
export class EventContext {
  readonly eventManager: EventManager;
  readonly scenes: Scenes;
  readonly camera: ThreeViewCamera;
  readonly meshes: MeshCache;
  readonly abortControllers: AbortControllers;
  readonly buf: BufferLoader;
  readonly texFragment: TextureFragmentHandler;
  readonly tileHandler: TileHandler;
  readonly workerTaskHandler: WorkerTaskHandler;
  readonly meshHandler: MeshHandler;
  readonly featureHandler: FeatureHandler;
  readonly loadedTexs: Map<string, Texture>;
  readonly workerPoolPromises: WorkerPoolPromises;
  readonly uniforms: CommonUniforms;
  readonly texturizedSceneByTileCoordinates: TexturizedSceneByTileCoordinates;
  readonly tileMapByHandle: TileMapByHandle;
  readonly textureOptions: TextureOptions;
  readonly renderFlag: RenderFlag;
  readonly viewEvents: EventHandler<ViewEvents>;
  readonly layersManager: LayersManager;
  readonly viewContext: ViewContext;
  readonly layerHandler?: LayerHandler;
  readonly fontManager?: FontManager;
  readonly textureFragmentIndex?: Map<string, Set<TextureSlot>>;
  readonly tileMeshToFragmentIds?: Map<TileMesh, Set<string>>;
  readonly hillshadeContext?: HillshadeContext;

  updatedAt = 0;

  constructor(args: EventContextArgs) {
    this.eventManager = args.eventManager;
    this.scenes = args.scenes;
    this.camera = args.camera;
    this.meshes = args.meshes;
    this.abortControllers = args.abortControllers;
    this.buf = args.buf;
    this.texFragment = args.texFragment;
    this.tileHandler = args.tileHandler;
    this.workerTaskHandler = args.workerTaskHandler;
    this.meshHandler = args.meshHandler;
    this.featureHandler = args.featureHandler;
    this.loadedTexs = args.loadedTexs;
    this.workerPoolPromises = args.workerPoolPromises;
    this.uniforms = args.uniforms;
    this.texturizedSceneByTileCoordinates =
      args.texturizedSceneByTileCoordinates;
    this.tileMapByHandle = args.tileMapByHandle;
    this.textureOptions = args.textureOptions;
    this.renderFlag = args.renderFlag;
    this.viewEvents = args.viewEvents;
    this.layersManager = args.layersManager;
    this.viewContext = args.viewContext;
    this.layerHandler = args.layerHandler;
    this.fontManager = args.fontManager;
    this.textureFragmentIndex = args.textureFragmentIndex;
    this.tileMeshToFragmentIds = args.tileMeshToFragmentIds;
    this.hillshadeContext = args.hillshadeContext;
  }
}
